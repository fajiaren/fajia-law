/* ==========================================================================
   法家人 · 全站增强模块 v1
   - 留言直达邮箱（formsubmit 转发，不依赖访客邮件客户端）
   - 网站访问统计（不蒜子，零注册；仅统计，不收集个人信息）
   - 全局返回顶部悬浮按钮（文章页已有文内回顶则跳过）
   - 文章页一键分享（微信 / 复制链接 / 微博）
   加载方式：由 app.js / academy.js / legal-tools.js / article.js 尾部的引导器加载
   ========================================================================== */
(function () {
  "use strict";

  var isArticle = !!document.querySelector("#art-body");
  var inSubDir = /(^|\/)a\/[^/]*\.html?$/i.test(location.pathname);
  var assetBase = inSubDir ? "../assets/" : "assets/";

  /* ---------------- 1. 留言直达邮箱 ----------------
     formsubmit.co 免费转发：POST 到 /ajax/邮箱，邮件直接进站长 163 邮箱。
     现有 app.js 的留言逻辑会读取 window.FAJIA_MESSAGE_ENDPOINT，
     若存在则走 fetch(JSON POST)，失败自动回退 mailto。 */
  window.FAJIA_MESSAGE_ENDPOINT = "https://formsubmit.co/ajax/xiaowuji1357@163.com";

  /* ---------------- 2. 访问统计（不蒜子）----------------
     只统计站点 PV/UV 与本页浏览数，不记录 IP 或任何个人身份信息。
     计数显示在页脚；脚本加载失败也不影响页面。 */
  function initStats() {
    var hosts = ["busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"];
    var s = document.createElement("script");
    s.src = "https://" + hosts[0];
    s.async = true;
    var done = false;
    s.onload = function () { done = true; };
    document.head.appendChild(s);

    function footer() {
      return document.querySelector(".foot") || document.querySelector(".ac-foot") ||
             document.querySelector(".t-foot") || document.querySelector("footer");
    }
    function mount() {
      if (document.querySelector("#fajia-stats")) return;
      var f = footer();
      if (!f) return;
      var box = document.createElement("div");
      box.id = "fajia-stats";
      box.setAttribute("style", "text-align:center;font-size:12px;line-height:1.9;opacity:.6;margin-top:14px;letter-spacing:.02em");
      box.innerHTML = '本站访问 <span id="busuanzi_value_site_pv">—</span> 次 · ' +
                      '访客 <span id="busuanzi_value_site_uv">—</span> 位' +
                      (isArticle ? ' · 本文阅读 <span id="busuanzi_value_page_pv">—</span> 次' : '');
      f.appendChild(box);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  }

  /* ---------------- 3. 返回顶部悬浮按钮 ----------------
     文章页已有 #to-top 文内回顶，跳过；其余页面注入右下角悬浮按钮。 */
  function initBackToTop() {
    if (document.querySelector("#to-top") || document.querySelector("#fajia-backtop")) return;
    var btn = document.createElement("button");
    btn.id = "fajia-backtop";
    btn.type = "button";
    btn.setAttribute("aria-label", "返回顶部");
    btn.setAttribute("title", "返回顶部");
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    var css = document.createElement("style");
    css.textContent =
      '#fajia-backtop{position:fixed;right:22px;bottom:26px;z-index:9999;width:46px;height:46px;' +
      'border-radius:50%;border:1px solid rgba(0,0,0,.12);background:#fff;color:#1d3a5f;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.14);display:flex;align-items:center;justify-content:center;' +
      'cursor:pointer;opacity:0;visibility:hidden;transform:translateY(10px);transition:.25s ease}' +
      '#fajia-backtop.on{opacity:1;visibility:visible;transform:none}' +
      '#fajia-backtop:hover{background:#1d3a5f;color:#fff}' +
      '@media (max-width:640px){#fajia-backtop{right:14px;bottom:16px;width:42px;height:42px}}';
    document.head.appendChild(css);
    document.body.appendChild(btn);
    btn.addEventListener("click", function () {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); }
      catch (e) { window.scrollTo(0, 0); }
    });
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (y > 500) btn.classList.add("on"); else btn.classList.remove("on");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- 4. 文章页一键分享 ----------------
     微信：在微信内唤起分享面板；在普通浏览器复制链接并提示。
     微博 / 复制链接：直接可用。 */
  function initShare() {
    if (!isArticle) return;
    var head = document.querySelector(".art-head");
    if (!head || document.querySelector("#fajia-share")) return;

    var bar = document.createElement("div");
    bar.id = "fajia-share";
    bar.setAttribute("style", "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 4px;font-size:13px");
    bar.innerHTML =
      '<span style="opacity:.6;margin-right:2px">分享本文</span>' +
      '<button type="button" data-act="wechat" style="' + btnStyle() + '">微信</button>' +
      '<button type="button" data-act="weibo" style="' + btnStyle() + '">微博</button>' +
      '<button type="button" data-act="copy" style="' + btnStyle() + '">复制链接</button>' +
      '<span id="fajia-share-tip" style="opacity:0;color:#1d8a5f;transition:.2s"></span>';
    head.appendChild(bar);

    function btnStyle() {
      return "padding:6px 14px;border:1px solid rgba(0,0,0,.16);border-radius:999px;background:#fff;" +
             "color:#1d3a5f;cursor:pointer;font-size:13px;line-height:1.2;transition:.2s";
    }
    function tip(msg) {
      var t = document.querySelector("#fajia-share-tip");
      if (!t) return;
      t.textContent = msg; t.style.opacity = "1";
      setTimeout(function () { t.style.opacity = "0"; }, 2200);
    }
    function copyLink() {
      var url = location.href.split("#")[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { tip("链接已复制"); }, function () { fallbackCopy(url, tip); });
      } else { fallbackCopy(url, tip); }
    }
    function fallbackCopy(url, cb) {
      var ta = document.createElement("textarea");
      ta.value = url; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); cb("链接已复制"); }
      catch (e) { cb("复制失败，请手动复制地址栏"); }
      document.body.removeChild(ta);
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      var title = document.title;
      var url = location.href.split("#")[0];
      if (act === "copy") { copyLink(); }
      else if (act === "weibo") {
        window.open("https://service.weibo.com/share/share.php?url=" + encodeURIComponent(url) +
                    "&title=" + encodeURIComponent(title), "_blank", "noopener,noreferrer,width=680,height=520");
      } else if (act === "wechat") {
        var ua = navigator.userAgent.toLowerCase();
        if (ua.indexOf("micromessenger") !== -1) {
          tip("点右上角 ··· 分享给朋友或朋友圈");
        } else {
          copyLink();
          tip("链接已复制，粘贴到微信即可分享");
        }
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function start() {
    initStats();
    initBackToTop();
    initShare();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
