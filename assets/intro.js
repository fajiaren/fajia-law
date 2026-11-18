/* ==========================================================================
   法家人 · 开场动画控制
   顺序：忒弥斯浮现 → 光在她手里的天平上聚起 → 光涌开 → 门随光退开、首页显现
   无音效；任何点击/按键都能加速，跳过按钮直接进入。
   收尾时强制回到页面顶部（=「关于网站」首页），并接管浏览器的滚动位置恢复，
   否则刷新前停在页面下方（例如「咨询与合作」）的访客，动画结束会被带到原处。
   ========================================================================== */
(function () {
  var el = document.getElementById("fj-intro");
  if (!el) return;

  var root = document.documentElement;
  var skip = document.getElementById("fj-intro-skip");

  /* 深链（#articles 等）与调试参数直接跳过开场 */
  var hash = location.hash.replace("#", "");
  var bypass = /[?&]nointro=1/.test(location.search) ||
    (hash && hash !== "about" && hash !== "home");
  if (bypass) {
    if (el.parentNode) el.parentNode.removeChild(el);
    return;
  }

  var timers = [];
  var opened = false;

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  /* -------- 落点控制：开场期间不接受浏览器恢复的滚动位置 -------- */
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) { }

  function toHome() {
    if (window.scrollTo) {
      try { window.scrollTo(0, 0); } catch (e) { }
    }
    var pane = document.getElementById("about");
    /* 保底：若浏览器在解锁 overflow 后又把位置拉回去，直接对准首屏 */
    if (pane && pane.scrollIntoView && Math.abs(window.pageYOffset || 0) > 8) {
      try { pane.scrollIntoView({ block: "start", behavior: "auto" }); } catch (e2) { }
    }
  }

  root.classList.add("fj-lock");
  el.setAttribute("aria-hidden", "false");
  toHome();
  window.addEventListener("load", toHome);

  function finish() {
    if (opened) return;
    opened = true;
    clear();
    toHome();                       /* 门开的那一刻页面就在首页，开门见到的就是首屏 */
    el.classList.add("is-open");
    /* 与 CSS 的 fi-flood 1.3s 对齐：光散尽的那一刻就把外框淡掉，
       中间不再有「暗底裸露」的过渡帧（v18 的闪黑就是它）。 */
    at(1200, function () {
      el.classList.add("is-done");
      root.classList.remove("fj-lock");
      el.setAttribute("aria-hidden", "true");
      toHome();
      /* 地址栏同步为 #about：刷新后仍从首页进入，且不会跳过开场 */
      try { history.replaceState(null, "", "#about"); } catch (e) { }
    });
    at(1600, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      toHome();
    });
  }

  /* -------- 自动播放时间线 -------- */
  at(60, function () { el.classList.add("is-run"); });
  at(1150, function () { el.classList.add("is-lift"); });   /* 光在她掌心那具天平上亮起 */
  at(1950, function () { el.classList.add("is-glow"); });   /* 光铺开、门缝见金线 */
  at(3050, finish);                                        /* 光涌过、门退开 */

  /* -------- 交互：点一下就往下走，但保留「亮 → 光 → 开」的先后 -------- */
  function advance(e) {
    if (skip && (e.target === skip || skip.contains(e.target))) return;
    if (opened) return;
    clear();
    el.classList.add("is-run");
    if (!el.classList.contains("is-lift")) {
      el.classList.add("is-lift");
      at(760, function () { el.classList.add("is-glow"); });
      at(1450, finish);
    } else {
      el.classList.add("is-glow");
      at(520, finish);
    }
  }
  el.addEventListener("click", advance);

  if (skip) {
    skip.addEventListener("click", function (e) {
      e.stopPropagation();
      finish();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (opened) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      finish();
    }
  });
})();
