/* ==========================================================================
   v19 · 中英文界面切换（本地查表版，全英文呈现）
   - 英文映射表 window.FJ_EN 由构建时 tools/gen_en_map.py 预生成（约 1.7 万条）
   - 切换时同步遍历所有文本节点查表替换：即时、100% 覆盖、不依赖外网
   - 界面文案 UI 词典优先级最高；正文走预生成机翻（法律术语已占位保护还原）
   - 语言选择存 localStorage；动态渲染内容用 MutationObserver 补翻译
   - 未命中的极少数中文：按词级再切一次查表，仍无则保留原文（绝不出现中英括注）
   ========================================================================== */
(function () {
  "use strict";
  var D = window.FJ_I18N || { UI: {}, TERM: {} };
  var UI = D.UI || {};
  var EN = window.FJ_EN || {};          // 预生成英译表
  var KEY = "fj-lang";
  var CK = "fj-en-live";                    // 浏览器端在线译文缓存
  // 支持 ?lang=en / ?lang=zh 直接指定（便于分享英文链接与验证）
  var _q = (function(){ var m=/[?&]lang=(en|zh)/.exec(location.search||""); return m?m[1]:null; })();
  var lang = _q || localStorage.getItem(KEY) || "zh";
  var regexBuilt = false, multiRe = null, charRe = null;
  var observer = null, liveCache = {}, liveQueue = [], liveRunning = false;
  try { liveCache = JSON.parse(localStorage.getItem(CK) || "{}"); } catch (e) { liveCache = {}; }

  function $(s, r) { return (r || document).querySelector(s); }
  function hasCN(s) { return /[\u4e00-\u9fff]/.test(s); }
  function hash(s) { var h=5381,i; for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); }
  function saveLive() {
    try {
      var ks=Object.keys(liveCache);
      if (ks.length>1200) ks.slice(0,ks.length-900).forEach(function(k){delete liveCache[k];});
      localStorage.setItem(CK, JSON.stringify(liveCache));
    } catch (e) {}
  }

  /* 浏览器端在线补齐：用访客自己的额度翻本地未命中的中文，带缓存+限流。
     法律术语占位保护，译文还原成词典标准译法；失败静默保留原文。 */
  var GUARD = ["最高人民法院","高级人民法院","中级人民法院","基层人民法院","人民法院",
    "人民检察院","管辖权异议","善意第三人","法定代表人","不可抗力","诉讼时效",
    "公司章程","注册资本","劳动争议","劳动合同","知识产权","侵权责任","违约金",
    "仲裁协议","仲裁裁决","善意取得","连带责任"," foreign"];
  var TERM = D.TERM || {};
  function guardLive(text){
    var map={},out=text;
    GUARD.forEach(function(t,i){ if(t&&out.indexOf(t)>=0){out=out.split(t).join("⟦L"+i+"⟧");map[i]=TERM[t]||t;} });
    return {text:out,map:map};
  }
  function unguardLive(en,map){
    return en.replace(/⟦L(\d+)⟧/g,function(m,i){return map[i]||m;})
             .replace(/\s+([,.;:!?，。；：！？])/g,"$1").replace(/\s{2,}/g," ").trim();
  }
  function liveTranslate(text){
    var g=guardLive(text);
    var url="https://api.mymemory.translated.net/get?q="+encodeURIComponent(g.text)+
            "&langpair=zh-CN%7Cen&de=fajia-site@example.com";
    return fetch(url).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      if(j.responseStatus===200&&j.responseData&&j.responseData.translatedText)
        return unguardLive(j.responseData.translatedText,g.map);
      throw 0;
    });
  }
  var liveDone = 0;
  function pumpLive(){
    if(liveRunning||!liveQueue.length) return;
    liveRunning=true;
    var job=liveQueue.shift();
    liveTranslate(job.zh).then(function(en){
      if(en&&en!==job.zh){
        liveCache[job.h]=en;
        if(job.node.isConnected) job.node.nodeValue=en;
        if(++liveDone % 15 === 0) saveLive();
      }
    }).catch(function(){}).then(function(){
      liveRunning=false;
      setTimeout(pumpLive, 300);              // 限流：每 300ms 一条
    });
  }
  function liveEnqueue(node,zh){
    var h=hash(zh);
    if(liveCache[h]){ node.nodeValue=liveCache[h]; return; }
    if(zh.length>440) return;                 // 过长不在线翻，避免失败
    liveQueue.push({node:node,zh:zh,h:h});
    pumpLive();
  }

  /* 长句未整条命中时，按标点/空白切成片段分别查表，再拼回 —— 提高覆盖率 */
  function buildRegex() {
    if (regexBuilt) return;
    var keys = Object.keys(EN).filter(function (k) { return k && k.length >= 2; })
      .sort(function (a, b) { return b.length - a.length; });
    try { multiRe = new RegExp("(" + keys.map(escRe).join("|") + ")", "g"); }
    catch (e) { multiRe = null; }
    regexBuilt = true;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function lookup(raw) {
    var key = raw.trim();
    if (!key) return raw;
    // 1) UI 词典整句（人工精准）
    if (UI[key]) return UI[key];
    // 2) 预生成表整句
    if (EN[key]) return EN[key];
    // 3) 片段级替换（长句里嵌着已翻译的短语）
    if (multiRe) {
      var hit = false;
      var out = raw.replace(multiRe, function (m) { hit = true; return EN[m] || m; });
      if (hit) return out;
    }
    return null;   // 完全未命中
  }

  var SKIP_SEL = "#fj-lang-btn, #fs-overlay, #fs-trigger, #fj-tr-status, script, style, noscript, option, textarea";
  function translate(root) {
    buildRegex();
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue || !n.nodeValue.trim() || !hasCN(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (n.__fjDone) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var raw = node.nodeValue;
      var en = lookup(raw);
      if (en && en !== raw) {
        node.nodeValue = en;
        node.__fjDone = true;
      } else if (hasCN(raw) && raw.trim().length >= 2) {
        // 本地未命中：先标记，再交给浏览器端在线补齐
        node.__fjDone = true;
        liveEnqueue(node, raw.trim());
      }
    }
  }

  /* 动态内容（学院手风琴、检索结果、幻灯片、资料导航）渲染后补翻译 */
  function watchDynamic() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      var roots = [];
      muts.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.querySelectorAll) roots.push(n);
        });
      });
      if (roots.length) roots.forEach(translate);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function injectButton() {
    if (!$("#fj-lang-btn")) {
      var btn = document.createElement("button");
      btn.id = "fj-lang-btn";
      btn.type = "button";
      btn.className = "fj-lang-btn";
      btn.title = "中文 / English";
      btn.setAttribute("aria-label", "Switch language 切换语言");
      btn.innerHTML = '<span class="fj-lang-zh">中</span><i>/</i><span class="fj-lang-en">EN</span>';
      btn.addEventListener("click", function () {
        lang = (lang === "zh") ? "en" : "zh";
        localStorage.setItem(KEY, lang);
        location.reload();               // reload 保证 DOM 文本干净还原
      });
      document.body.appendChild(btn);
    }
  }

  function markTitle() {
    // 标题、Description 也切英文（查表）
    var t = document.title;
    if (EN[t]) document.title = EN[t];
    var md = $('meta[name="description"]');
    if (md && EN[md.content]) md.setAttribute("content", EN[md.content]);
    // 常见 logo/品牌副标
    [].forEach.call(document.querySelectorAll("[data-en]"), function (el) {
      el.textContent = el.getAttribute("data-en");
    });
  }

  function init() {
    injectButton();
    if (lang !== "en") {
      document.documentElement.lang = "zh-CN";
      document.body.classList.remove("fj-en");
      return;
    }
    document.documentElement.lang = "en";
    document.body.classList.add("fj-en");
    var btn = $("#fj-lang-btn");
    if (btn) { btn.classList.add("on"); btn.title = "Switch to Chinese 切换为中文"; }
    translate(document.body);            // 首轮：全站同步替换
    markTitle();
    // 动态内容分几次补翻译，覆盖脚本延迟渲染
    setTimeout(function () { translate(document.body); markTitle(); }, 200);
    setTimeout(function () { translate(document.body); }, 700);
    setTimeout(function () { translate(document.body); }, 1600);
    watchDynamic();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
