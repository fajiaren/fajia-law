/* ==========================================================================
   v19 · 全站检索（命令面板）
   - 数据源 window.FJ_SEARCH（300 条：文章/合集/学院课程/大纲/资料页）
   - 中英文关键词都能命中：中文匹配原字段，英文经 window.FJ_EN 查译文匹配
   - 常见检索主题快捷标签、类型过滤、键盘上下选择、回车打开
   ========================================================================== */
(function () {
  "use strict";
  // 检索只在首页启用：文章页 / 资料页不得弹出检索面板遮挡阅读。
  var _p = location.pathname;
  if (!/(^|\/)index\.html$/.test(_p) && _p !== "/" && !/\/$/.test(_p)) return;
  var IDX = window.FJ_SEARCH || { items: [], topics: [] };
  /* 英译表按需加载：这里每次现取，词典晚到（idle 时载入）也能立刻生效 */
  function ENM() { return window.FJ_EN || {}; }
  var ITEMS = IDX.items || [];
  var LABEL = {
    article: { zh: "文章", en: "Article" },
    album:   { zh: "合集", en: "Collection" },
    college: { zh: "学院", en: "Academy" },
    course:  { zh: "课程", en: "Course" },
    outline: { zh: "要点", en: "Topic" },
    lib:     { zh: "资料", en: "Resource" }
  };
  var en = function () { return document.body && document.body.classList.contains("fj-en"); };
  var L = function (o) { return en() ? o.en : o.zh; };

  var overlay, input, list, chips, stat, active = 0, results = [];

  // 把中文串翻成英文（查预生成表），用于英文检索匹配
  function toEN(s) {
    if (!s) return "";
    var m = ENM();
    if (m[s]) return m[s];
    // 整句未命中时按标点切分逐段查
    return String(s).split(/[\s|·:：，,。、（）()【】\[\]—-]+/).map(function (p) {
      return ENM()[p] || p;
    }).join(" ");
  }
  /* 检索串归一：抹掉书名号、括号、引号、标点与空白。
     资料名多是《实习带教保密协议》，访客只会打「实习带教保密协议」，
     不归一就永远差一个字符——这正是一整批资料搜不到的原因。 */
  var NOISE = /[《》〈〉【】\[\]（）()「」『』“”‘’"'·•、，。；：！？,.;:!?/\\|—–_~\s]/g;
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().replace(NOISE, "");
  }

  function hay(it) {
    return norm([it.t, it.cat, it.s, toEN(it.t), toEN(it.cat), toEN(it.s), it.ce || ""].join(" "));
  }
  // 预计算检索串（含英文），避免每次输入重算
  function buildHay() {
    ITEMS.forEach(function (it) {
      it._h = hay(it);
      it._n = norm(it.t);
      it._ne = norm(toEN(it.t));
    });
  }
  buildHay();
  /* 英译表晚到后重建检索串，让英文关键词立刻可命中 */
  window.__fjRebuildSearch = buildHay;

  function normUrl(u) {
    if (!u) return "#";
    if (/^(#|a\/|lib\/|https?:)/.test(u)) return u;
    return u;
  }

  function score(it, q) {
    var ql = norm(q);
    if (!ql) return 0;
    var t = it._n, te = it._ne;
    if (t === ql || te === ql) return 100;
    if (t.indexOf(ql) === 0 || te.indexOf(ql) === 0) return 80;
    if (t.indexOf(ql) >= 0 || te.indexOf(ql) >= 0) return 60;
    if (it._h.indexOf(ql) >= 0) return 30;
    return 0;
  }

  /* 两字片段覆盖率：查的词被拆开、或多打了几个字时用它兜底。
     「实习带教保密」-> 实习/习带/带教/教保/保密 里命中几段，命中越多越像。 */
  function coverage(h, q) {
    if (q.length < 2) return 0;
    var hit = 0, total = 0;
    for (var i = 0; i < q.length - 1; i++) {
      total++;
      if (h.indexOf(q.substr(i, 2)) >= 0) hit++;
    }
    return total ? hit / total : 0;
  }

  function search(q) {
    var raw = q.trim();
    if (!raw) return [];
    // 多关键词：空格切分，全部命中才保留（AND），任一在标题命中加权
    var terms = raw.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    if (!terms.length) return [];
    var scored = [];
    ITEMS.forEach(function (it) {
      var ok = terms.every(function (tm) { return it._h.indexOf(tm) >= 0; });
      if (!ok) return;
      var sc = score(it, raw);
      terms.forEach(function (tm) {
        if (it._n.indexOf(tm) >= 0) sc += 15;
      });
      scored.push({ it: it, sc: sc });
    });
    /* 严格全命中后仍然空手，再放宽到「片段覆盖率 ≥ 62%」。
       宁可多给几条让人自己认，也不要直接说「没有匹配结果」。 */
    if (!scored.length) {
      var q2 = norm(raw);
      ITEMS.forEach(function (it) {
        var cov = coverage(it._h, q2);
        if (cov < 0.62) return;
        scored.push({ it: it, sc: 12 * cov + (it._n.indexOf(q2) >= 0 ? 20 : 0) });
      });
    }
    scored.sort(function (a, b) { return b.sc - a.sc; });
    return scored.slice(0, 40).map(function (x) { return x.it; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c];
    });
  }
  function hl(text, q) {
    if (!q.trim()) return esc(text);
    var terms = q.trim().split(/\s+/).filter(Boolean);
    var out = esc(text);
    terms.forEach(function (tm) {
      if (!tm) return;
      var re = new RegExp("(" + tm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function render(q) {
    results = search(q);
    active = 0;
    var countTxt = en() ? (results.length + " results") : ("命中 " + results.length + " 条");
    stat.textContent = q.trim() ? countTxt : "";
    if (!q.trim()) {
      list.innerHTML = "";
      return;
    }
    if (!results.length) {
      list.innerHTML = '<div class="fs-empty">' +
        (en() ? "No matches. Try shorter keywords or a topic below." : "没有匹配结果，试试更短的关键词或下方主题。") + "</div>";
      return;
    }
    list.innerHTML = results.map(function (it, i) {
      var lab = L(LABEL[it.ty] || { zh: "内容", en: "Content" });
      var disp = en() ? (toEN(it.t) || it.t) : it.t;
      var cat = en() ? (toEN(it.cat) || it.cat) : it.cat;
      return '<a class="fs-item' + (i === 0 ? " on" : "") + '" data-i="' + i + '" href="' +
        esc(normUrl(it.u)) + '">' +
        '<span class="fs-kind k-' + it.ty + '">' + esc(lab) + "</span>" +
        '<span class="fs-main"><b>' + hl(disp, q) + "</b>" +
        (cat ? '<em>' + esc(cat) + "</em>" : "") + "</span>" +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>' +
        "</a>";
    }).join("");
  }

  function move(delta) {
    if (!results.length) return;
    var nodes = list.querySelectorAll(".fs-item");
    nodes[active] && nodes[active].classList.remove("on");
    active = (active + delta + nodes.length) % nodes.length;
    nodes[active] && nodes[active].classList.add("on");
    nodes[active] && nodes[active].scrollIntoView({ block: "nearest" });
  }
  function open() {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add("fs-open");
    setTimeout(function () { input.focus(); }, 30);
    render(input.value);
  }
  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("fs-open");
  }

  function renderChips() {
    if (!chips) return;
    chips.innerHTML = (IDX.topics || []).map(function (tp) {
      var label = en() ? tp.en : tp.zh;
      return '<button type="button" class="fs-chip" data-q="' + esc(en() ? tp.en : tp.zh) + '">' +
        esc(label) + "</button>";
    }).join("");
  }

  function build() {
    if (document.getElementById("fs-overlay")) return;
    overlay = document.createElement("div");
    overlay.id = "fs-overlay";
    overlay.className = "fs-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="fs-panel" role="dialog" aria-modal="true" aria-label="Search">' +
        '<div class="fs-top">' +
          '<svg class="fs-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.6 15.6L21 21"/></svg>' +
          '<input type="search" id="fs-input" autocomplete="off" spellcheck="false" ' +
            'placeholder="' + (en() ? "Search the whole site…" : "检索全站：关键词、标题、主题…") + '">' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<div class="fs-chips" id="fs-chips"></div>' +
        '<div class="fs-stat" id="fs-stat"></div>' +
        '<div class="fs-list" id="fs-list"></div>' +
        '<div class="fs-foot">' +
          '<span><kbd>↑</kbd><kbd>↓</kbd> ' + (en() ? "navigate" : "选择") + '</span>' +
          '<span><kbd>↵</kbd> ' + (en() ? "open" : "打开") + '</span>' +
          '<span class="fs-brand">法家人 · SEARCH</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = document.getElementById("fs-input");
    list = document.getElementById("fs-list");
    chips = document.getElementById("fs-chips");
    stat = document.getElementById("fs-stat");

    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        var node = list.querySelector(".fs-item.on") || list.querySelector(".fs-item");
        if (node) location.href = node.getAttribute("href");
      }
    });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".fs-chip");
      if (!b) return;
      input.value = b.getAttribute("data-q");
      render(input.value);
      input.focus();
    });
    list.addEventListener("mouseover", function (e) {
      var it = e.target.closest(".fs-item");
      if (!it) return;
      [].forEach.call(list.querySelectorAll(".fs-item"), function (n) { n.classList.remove("on"); });
      it.classList.add("on");
      active = parseInt(it.getAttribute("data-i"), 10) || 0;
    });

    document.addEventListener("keydown", function (e) {
      // ⌘K / Ctrl+K / 斜杠 唤起；ESC 关闭
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "/" && !/INPUT|TEXTAREA/.test((e.target.tagName || "")) && overlay.hidden) { e.preventDefault(); open(); }
      else if (e.key === "Escape" && !overlay.hidden) { close(); }
    });
    renderChips();
  }

  function init() {
    build();
    // 导航栏搜索按钮（幂等）
    if (!document.getElementById("fs-trigger")) {
      var btn = document.createElement("button");
      btn.id = "fs-trigger";
      btn.type = "button";
      btn.className = "fs-trigger";
      btn.setAttribute("aria-label", en() ? "Search" : "检索全站");
      btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.6"/><path d="M12.8 12.8L17.5 17.5"/></svg>' +
        '<span>' + (en() ? "Search" : "检索") + '</span><kbd>⌘K</kbd>';
      btn.addEventListener("click", open);
      var nav = document.querySelector(".nav-inner") || document.querySelector(".nav") || document.body;
      nav.appendChild(btn);
    }
    // 英文模式更新占位与按钮文案
    if (en()) {
      if (input) input.placeholder = "Search the whole site…";
      var b = document.getElementById("fs-trigger");
      if (b) { var sp = b.querySelector("span"); if (sp) sp.textContent = "Search"; }
      renderChips();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
