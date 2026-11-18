/* ==========================================================================
   资料页层级导航（v17）
   - 面包屑三级可点：学院 / 馆(sub) / 课(kid)，回到学院页对应模块
   - 同级资料横跳：当前「课」下的全部资料，点哪个读哪个
   - 上 / 下一篇：在同一「课」的资料间顺序翻
   纯前端：从 data.js(KB) 与 library.js(LIB) 反查当前页归属，不改每页正文。
   ========================================================================== */
(function () {
  "use strict";
  var KB = window.KB || {};
  var LIB = (window.LIB && window.LIB.items) || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fileOf(url) {
    return (url || location.pathname).split("/").pop().split("#")[0].split("?")[0];
  }
  var here = fileOf(location.href);
  if (!/\.html$/.test(here)) return;

  /* 建立 kidId -> {sub, kid} 映射 */
  var KID2SUB = {};
  (KB.college && KB.college.subs || []).forEach(function (sub) {
    (sub.kids && sub.kids.length ? sub.kids : [sub]).forEach(function (k) {
      KID2SUB[k.id] = { sub: sub, kid: k };
    });
  });

  /* 在 LIB.items 里定位当前页 */
  var found = null;
  Object.keys(LIB).forEach(function (kidId) {
    (LIB[kidId] || []).forEach(function (it, i) {
      if (fileOf(it.p) === here) found = { kidId: kidId, item: it, index: i, list: LIB[kidId] };
    });
  });
  if (!found) return;   // 非资料页（如首页）不处理

  var meta = KID2SUB[found.kidId] || {};
  var sub = meta.sub, kid = meta.kid;
  var crumb = $(".lb-crumb");
  var kicker = $(".lb-kicker");
  if (!crumb) return;

  /* 学院回链：带 kid 参数，college.js 据此展开对应课 */
  var collegeUrl = "../index.html#college";
  if (kid && kid.key) collegeUrl = "../index.html#college&kid=" + encodeURIComponent(kid.key);

  /* ---- 1. 面包屑三级可点 ---- */
  var parts = [];
  parts.push('<a href="../index.html#college" class="cb-root">法家人学院</a><i>/</i>');
  if (sub) {
    var subUrl = "../index.html#college";
    if (sub.key) subUrl += "&sub=" + encodeURIComponent(sub.key);
    if (kid && kid.key) subUrl += "&kid=" + encodeURIComponent(kid.key);
    parts.push('<a href="' + subUrl + '">' + esc(sub.title) + '</a><i>/</i>');
  } else {
    parts.push('<b>' + esc((kicker && kicker.textContent || "").split("·")[0].trim()) + '</b><i>/</i>');
  }
  if (kid) {
    parts.push('<a href="' + collegeUrl + '">' + esc(kid.title) + '</a><i>/</i>');
  }
  parts.push('<span>' + esc(found.item.topic || found.item.t || "") + '</span>');
  crumb.innerHTML = parts.join("");

  /* ---- 2. 在正文顶部插入「同级资料」路径条 ---- */
  var doc = $(".lb-doc");
  if (doc && found.list.length > 1) {
    var nav = document.createElement("nav");
    nav.className = "lb-siblings";
    var head = document.createElement("div");
    head.className = "ls-head";
    head.innerHTML = '<b>' + esc(kid ? kid.title : found.kidId) + ' · 同级资料</b>' +
                     '<span>' + found.list.length + ' 篇 · 点标题直接跳转</span>';
    nav.appendChild(head);
    var chips = document.createElement("div");
    chips.className = "ls-chips";
    found.list.forEach(function (it, i) {
      var a = document.createElement("a");
      a.href = fileOf(it.p);
      a.className = i === found.index ? "on" : "";
      a.title = it.n || it.t || "";
      a.innerHTML = '<em>' + (i + 1) + '</em>' + esc(it.topic || it.t);
      chips.appendChild(a);
    });
    nav.appendChild(chips);

    /* 上 / 下一篇 */
    var pager = document.createElement("div");
    pager.className = "ls-pager";
    var prev = found.list[found.index - 1];
    var next = found.list[found.index + 1];
    pager.innerHTML =
      (prev ? '<a class="ls-prev" href="' + fileOf(prev.p) + '">‹ 上一篇<br><b>' + esc(prev.topic || prev.t) + '</b></a>'
            : '<span class="ls-prev ls-dis">已是第一篇</span>') +
      (next ? '<a class="ls-next" href="' + fileOf(next.p) + '">下一篇 ›<br><b>' + esc(next.topic || next.t) + '</b></a>'
            : '<span class="ls-next ls-dis">已是最后一篇</span>');
    nav.appendChild(pager);
    doc.insertBefore(nav, doc.children[1] || null);
  }
})();
