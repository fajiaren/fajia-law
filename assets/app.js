/* ==========================================================================
   法家人 · 站点交互
   - 文章与观点：四模块切换 / 合集折叠 / 标题搜索
   - 形象照可替换（本地 localStorage 持久化）
   - 留言表单：可配置接口，未配置时回落到邮件
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- 站点配置 ---------------- */
  var SITE = {
    name: "王天豪",
    phone: "13571999722",
    email: "xiaowuji1357@163.com",
    /* 留言接收接口（选填）。留空则使用邮件方式。
       支持任意接受 JSON POST 的地址，例如 "https://formspree.io/f/xxxxxxx" */
    messageEndpoint: "",
    portraitKey: "fajia.portrait.v1"
  };

  var KB = window.KB || { modules: [], articles: [], albums: [], cases: [], stats: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var pad = function (n) { return n < 10 ? "0" + n : String(n); };
  /* 文章编号统一三位：RS-027（与文章页、站内说明一致） */
  var no3 = function (n) {
    n = +n || 0;
    return n < 10 ? "00" + n : (n < 100 ? "0" + n : String(n));
  };

  var state = { module: KB.modules.length ? KB.modules[0].id : "", q: "" };
  var codeMap = null;

  /* ---------------- 深链参数 ----------------
     文章页的「收录于」用 ?m=<模块>&c=<合集>#articles 指回目录。
     没有这两个参数时，从任何一篇文章点回来都会落在第一个模块（涉外），
     看起来就像是「跳到了错的地方」。 */
  var DEEP = (function () {
    var out = {};
    String(location.search || "").replace(/^\?/, "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1));
      out[k] = v;
    });
    return out;
  })();

  function openCol(id) {
    if (!id) return;
    var col = document.querySelector('.col[data-col="' + id + '"], .kid[data-col="' + id + '"]');
    if (!col) return;
    var kid = col.classList.contains("kid");
    var host = kid ? col.parentElement.closest(".col") : null;
    if (host) {
      host.classList.add("is-open");
      var hh = host.querySelector(".col-head");
      if (hh) hh.setAttribute("aria-expanded", "true");
    }
    col.classList.add("is-open");
    var hd = col.querySelector(".col-head, .kid-head");
    if (hd) hd.setAttribute("aria-expanded", "true");
    var row = col.querySelector(".art-row");
    if (row) row.classList.add("is-hit");
  }

  function codeOf(albumId) {
    if (!codeMap) {
      codeMap = {};
      (KB.albums || []).forEach(function (al) { codeMap[al.id] = al.code; });
    }
    return codeMap[albumId] || "";
  }

  /* ---------------- 顶部数字 ---------------- */
  function setText(sel, v) {
    var el = $(sel);
    if (el && v != null) el.textContent = v;
  }
  function boot() {
    var st = KB.stats || {};
    setText("#s-articles", st.articles);
    setText("#hero-count", st.articles);
    setText("#t-total", st.articles);
    setText("#s-albums", st.albums);
    setText("#s-templates", 18);
    setText("#s-years", (st.since && st.until) ? (Number(st.until) - Number(st.since) + 1) : 3);
    setText("#year", new Date().getFullYear());
  }

  /* ---------------- 文章检索 ---------------- */
  function articlesOf(albumId) {
    return KB.articles
      .filter(function (a) { return albumId in a.ns; })
      .sort(function (x, y) { return x.ns[albumId] - y.ns[albumId]; });
  }

  function hl(text, q) {
    if (!q) return esc(text);
    var i = String(text).toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }

  function urlOf(a) {
    return a.k ? "a/" + a.k + ".html" : a.u;
  }

  function rowHTML(a, albumId, q) {
    var code = albumId ? codeOf(albumId) : "";
    var no = albumId ? a.ns[albumId] : 0;
    return '<a class="art-row" href="' + esc(urlOf(a)) + '">' +
      '<span class="art-no">' + esc(code ? code + "-" + no3(no) : "") + "</span>" +
      '<span class="art-t">' + hl(a.t, q) + "</span>" +
      '<span class="art-d">' + esc(a.d || "未标注") + "</span>" +
      '<span class="art-r">' + (a.r || 0) + "</span>" +
      "</a>";
  }

  /* ---------------- 模块与合集 ---------------- */
  function renderTabs() {
    var tabs = $("#mod-tabs");
    if (!tabs) return;
    tabs.innerHTML = KB.modules.map(function (m) {
      var on = m.id === state.module;
      return '<button class="mod-tab' + (on ? " is-on" : "") + '" type="button" role="tab" ' +
        'aria-selected="' + on + '" data-m="' + esc(m.id) + '">' +
        '<span class="mod-tab-top">' +
        '<span class="mod-tab-name">' + esc(m.name) + "</span>" +
        '<span class="mod-tab-cnt">' + m.count + " 篇</span>" +
        "</span>" +
        '<span class="mod-tab-en">' + esc(m.en) + "</span>" +
        '<span class="mod-tab-desc">' + esc(m.desc) + "</span>" +
        "</button>";
    }).join("");
  }

  function renderPanel() {
    var panel = $("#panel");
    if (!panel) return;
    var mod = KB.modules.filter(function (m) { return m.id === state.module; })[0];
    if (!mod) { panel.innerHTML = ""; return; }

    var html = '<div class="mod-lead"><b>' + esc(mod.name) + "</b><span>" + esc(mod.lead) + "</span></div>";
    html += '<div class="col-list">';

    mod.subs.forEach(function (sub) {
      var items = articlesOf(sub.id);
      var kids = sub.kids || [];
      var kidTotal = kids.reduce(function (n, k) { return n + k.count; }, 0);
      var total = items.length + kidTotal;

      html += '<div class="col" data-col="' + esc(sub.id) + '">';
      html += '<button class="col-head" type="button" aria-expanded="false">' +
        '<span class="col-code">' + esc(sub.code) + "</span>" +
        '<span class="col-name">' + esc(sub.title) +
        '<span class="c">' + (total ? total + " 篇" : "筹备中") + "</span>" +
        "</span>" +
        '<span class="col-desc">' + esc(sub.desc) + "</span>" +
        '<span class="col-n">' + (total ? pad(total) : "—") + "</span>" +
        '<span class="col-chev" aria-hidden="true"></span>' +
        "</button>";
      html += '<div class="col-body">';

      if (items.length) {
        html += items.map(function (a) { return rowHTML(a, sub.id, ""); }).join("");
      } else if (!total) {
        html += '<p class="empty-note" style="margin:12px 0">该合集暂时还没有文章，内容正在整理中。</p>';
      }

      kids.forEach(function (k) {
        var kidItems = articlesOf(k.id);
        html += '<div class="kid" data-col="' + esc(k.id) + '">';
        html += '<button class="kid-head" type="button" aria-expanded="false">' +
          '<span class="col-code">' + esc(k.code) + "</span>" +
          '<span class="col-name">' + esc(k.title) +
          '<span class="c">' + (kidItems.length ? kidItems.length + " 篇" : "筹备中") + "</span>" +
          "</span>" +
          '<span class="col-desc">' + esc(k.desc) + "</span>" +
          '<span class="col-n">' + (kidItems.length ? pad(kidItems.length) : "—") + "</span>" +
          '<span class="col-chev" aria-hidden="true"></span>' +
          "</button>";
        html += '<div class="col-body">' +
          (kidItems.length
            ? kidItems.map(function (a) { return rowHTML(a, k.id, ""); }).join("")
            : '<p class="empty-note" style="margin:12px 0">子合集筹备中，欢迎在留言区提出你关心的选题。</p>') +
          "</div>";
        html += "</div>";
      });

      html += "</div></div>";
    });

    html += "</div>";
    panel.innerHTML = html;

    $$(".col-head, .kid-head", panel).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var box = btn.parentElement;
        var open = box.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });

    // 默认展开第一个有文章的合集，避免首屏看到一列折叠项
    var first = $$(".col", panel).filter(function (c) { return $(".art-row", c); })[0];
    if (first) {
      first.classList.add("is-open");
      var h = $(".col-head", first);
      if (h) h.setAttribute("aria-expanded", "true");
    }
  }

  /* ---------------- 搜索 ---------------- */
  function doSearch(q) {
    state.q = String(q || "").trim();
    var box = $("#search-result");
    var panel = $("#panel");
    var tabs = $("#mod-tabs");
    var clear = $("#search-clear");
    if (clear) clear.classList.toggle("on", !!state.q);

    if (!state.q) {
      box.hidden = true;
      panel.hidden = false;
      tabs.hidden = false;
      return;
    }

    var ql = state.q.toLowerCase();
    var hits = KB.articles.filter(function (a) { return a.t.toLowerCase().indexOf(ql) >= 0; });

    panel.hidden = true;
    tabs.hidden = true;
    box.hidden = false;

    var rows = hits.map(function (a) {
      var ids = Object.keys(a.ns);
      var best = ids[0];
      ids.forEach(function (id) { if (a.ns[id] < a.ns[best]) best = id; });
      return { a: a, id: best };
    }).sort(function (x, y) { return String(y.a.d).localeCompare(String(x.a.d)); });

    $("#sr-head").innerHTML = "搜索「<b>" + esc(state.q) + "</b>」命中 <b>" + hits.length + "</b> 篇" +
      (hits.length ? '<span class="sr-ctx">按发表时间倒序</span>' : "");

    $("#sr-list").innerHTML = hits.length
      ? rows.map(function (r) {
          var sub = (KB.albums || []).filter(function (al) { return al.id === r.id; })[0];
          var ctx = (sub ? sub.title : "") + " · " + (sub ? sub.code : "") + "-" + no3(r.a.ns[r.id]);
          return '<div style="border-top:1px solid var(--line)">' +
            '<div style="padding:9px 10px 0"><span class="sr-ctx">' + esc(ctx) + "</span></div>" +
            '<a class="art-row" href="' + esc(urlOf(r.a)) + '" ' +
            'style="grid-template-columns:minmax(0,1fr) 84px 54px;border-top:0">' +
            '<span class="art-t">' + hl(r.a.t, state.q) + "</span>" +
            '<span class="art-d">' + esc(r.a.d || "未标注") + "</span>" +
            '<span class="art-r">' + (r.a.r || 0) + "</span>" +
            "</a></div>";
        }).join("")
      : '<p class="empty-note">没有匹配的文章。换个更短的关键词试试，例如「竞业」「外包」「仲裁」。</p>';
  }

  /* ---------------- 年度刊汇（文章区置顶） ---------------- */
  function renderPin() {
    var box = $("#pin-list");
    if (!box) return;
    var pin = KB.pin;
    if (!pin) { var wrap = $("#pin"); if (wrap) wrap.hidden = true; return; }

    var items = articlesOf(pin.albumId);
    if (pin.desc) {
      var d = $(".pin-side p");
      if (d) d.textContent = pin.desc;
    }
    box.innerHTML = items.length
      ? items.slice().reverse().map(function (a) {
          return '<a class="pin-card" href="' + esc(urlOf(a)) + '">' +
            '<span class="pin-y">' + esc(String(a.d || "").slice(0, 4) || "—") + "</span>" +
            "<b>" + esc(a.t) + "</b>" +
            "<i>" + esc(a.d || "") + " · 阅读 " + (a.r || 0) + "</i>" +
            '<span class="pin-go" aria-hidden="true">' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h10M9 4l4 4-4 4"/></svg>' +
            "</span></a>";
        }).join("")
      : '<p class="empty-note" style="padding:20px">年度刊汇整理中。</p>';
  }

  /* ---------------- 职业成就：实务论著 / 荣誉奖项 ---------------- */
  function renderWorks() {
    var box = $("#work-list");
    if (!box) return;
    var w = KB.works || {};
    var items = articlesOf(w.albumId);

    setText("#work-n", items.length ? pad(items.length) : "—");

    if (!items.length) {
      box.innerHTML = '<p class="ach-empty">专著与合著正在整理，出版后会按年份排入。</p>';
      return;
    }
    box.innerHTML = items.map(function (a) {
      // 书籍封面：优先用本地封面（离线也可见），否则退回数据层里的封面地址
      var cover = (w.covers && w.covers[a.k]) || (a.k === "22eac3b0c944" ? "assets/img/book-thailand-labor.jpg" : (a.c || ""));
      var thumb = cover
        ? '<img class="wk-cover" src="' + esc(cover) + '" alt="' + esc(a.t) + ' 封面" loading="lazy">'
        : '<span class="wk-cover wk-cover-ph" aria-hidden="true">封</span>';
      return '<a class="work-card has-cover" href="' + esc(urlOf(a)) + '">' +
        '<span class="wk-n">' + esc(w.code || "SL") + "-" + no3(a.ns[w.albumId]) + "</span>" +
        thumb +
        '<div class="wk-main"><b>' + esc(a.t) + "</b>" +
        "<i>" + esc(a.tpl || "实务论著") + " · " + esc(a.d || "") + " · 阅读 " + (a.r || 0) + "</i></div>" +
        '<span class="wk-go" aria-hidden="true">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h10M9 4l4 4-4 4"/></svg>' +
        "</span></a>";
    }).join("");
  }

  function renderHonors() {
    var box = $("#honor-list");
    if (!box) return;
    var hs = KB.honors || [];
    setText("#honor-n", hs.length ? pad(hs.length) : "—");

    if (!hs.length) {
      box.innerHTML = '<p class="ach-empty">这一栏随年资累积：执业荣誉、专业奖项、社会兼职与受聘职务。' +
        "整理完成后按年份排入，与论著并列。</p>" +
        '<ul class="honor-slot" aria-hidden="true">' +
        ['<li><i>20__</i><b>奖项或荣誉</b><em>授予机构</em></li>',
         '<li><i>20__</i><b>社会兼职 / 受聘职务</b><em>聘任单位</em></li>'].join("") +
        "</ul>";
      return;
    }
    box.innerHTML = '<ol class="honor-list">' + hs.map(function (h) {
      return "<li><i>" + esc(h.y || "") + "</i><b>" + esc(h.t || "") + "</b>" +
        "<em>" + esc(h.org || "") + "</em></li>";
    }).join("") + "</ol>";
  }

  /* ---------------- 代表业绩 ---------------- */
  function renderCases() {
    var box = $("#case-list");
    if (!box) return;
    var list = KB.cases || [];
    if (!list.length) {
      box.innerHTML = '<p class="empty-note">办案复盘正在整理中。</p>';
      return;
    }
    box.innerHTML = list.map(function (c) {
      return '<a class="case-card" href="' + esc(c.k ? "a/" + c.k + ".html" : c.u) + '">' +
        "<div>" +
        '<div class="case-meta"><span>CASE NOTE</span><em>' + esc(c.d) + "</em><em>·</em><em>阅读 " + (c.r || 0) + "</em></div>" +
        '<h3 class="case-title">' + esc(c.t) + "</h3>" +
        '<p class="case-desc">从争议解决视角还原办案思路：先判断什么、再取舍什么、最后怎么落地。</p>' +
        "</div>" +
        '<span class="case-go" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>' +
        "</a>";
    }).join("");
  }

  /* ---------------- 章节导航（纵向滚动） ----------------
     v9：放弃横向分屏。整页在普通文档流里一起滚，
     导航 / 底部分段 / 续接按钮都只是「锚点 + 平滑滚动」，
     不再碰 transform，也不再有固定的整屏容器 —— 内容多长都能完整渲染。 */
  function initScrollNav() {
    var panes = $$(".pane");
    if (!panes.length) return;

    var links = $$("#nav-links a");
    var dots = $$("#dots button");
    var nav = $("#nav");
    var bar = $("#read-bar i");
    var drawer = $("#nav-drawer");
    var burger = $("#nav-burger");
    var cur = -1;

    function scrollY() {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }
    function navH() {
      var v = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue("--navh"), 10);
      return isNaN(v) ? 70 : v;
    }
    function topOf(el) {
      return el.getBoundingClientRect().top + scrollY();
    }

    function paint(n) {
      if (n === cur) return;
      cur = n;
      links.forEach(function (a) {
        var on = +a.dataset.go === n;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      dots.forEach(function (b) {
        var on = +b.dataset.go === n;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-current", on ? "true" : "false");
      });
    }

    function closeDrawer() {
      if (drawer) drawer.classList.remove("open");
      if (burger) {
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    }

    function jump(el, smooth) {
      var y = topOf(el) - navH() - (el.classList.contains("pane") ? 1 : 18);
      if (y < 0) y = 0;
      function instant() {
        var root = document.documentElement;
        root.classList.add("no-smooth");
        window.scrollTo(0, y);
        void root.offsetHeight;
        root.classList.remove("no-smooth");
      }
      /* 首次深链 / 返回页面：必须一次到位。
         此时若走 CSS 的 scroll-behavior:smooth，页面会从顶部一路滑下去，
         遇到卡顿甚至会停在起点，看起来就像「打开是空的」。 */
      if (smooth === false) { instant(); return; }

      var from = scrollY();
      try { window.scrollTo({ top: y, behavior: "smooth" }); }
      catch (e) { instant(); return; }

      /* 省电模式 / 无障碍设置 / 合成器卡住时，平滑滚动可能根本不启动，
         表现就是「点了导航没反应」。420ms 后仍在原地就直接跳过去。 */
      setTimeout(function () {
        if (Math.abs(scrollY() - from) < 4 && Math.abs(y - from) > 8) instant();
        update();
      }, 420);
    }

    function hashTo(id, smooth) {
      var t = id && document.getElementById(id);
      if (!t) return false;
      jump(t, smooth);
      return true;
    }

    /* 滚动时：判断当前章节、更新阅读进度、给导航加边线 */
    function update() {
      var y = scrollY();
      var probe = y + navH() + Math.min(window.innerHeight * 0.34, 300);
      var n = 0;
      for (var k = 0; k < panes.length; k++) {
        if (topOf(panes[k]) <= probe) n = k;
      }
      paint(n);
      if (nav) nav.classList.toggle("is-stuck", y > 4);
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (y / max) * 100 : 0;
        bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    /* 站内锚点一律接管：导航、底部分段、首屏按钮、续接按钮、正文链接 */
    document.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var a = e.target.closest('a[href^="#"], [data-go]');
      if (!a) return;
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      if (!id && a.dataset && a.dataset.go != null) {
        var p = panes[+a.dataset.go];
        if (p) id = p.id;
      }
      if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      hashTo(id, true);
      try { history.replaceState(null, "", "#" + id); } catch (err) { }
      closeDrawer();
      /* 不依赖 scroll 事件：滚动被冻结时高亮也要跟上 */
      setTimeout(update, 80);
      setTimeout(update, 700);
    });

    if (burger && drawer) {
      burger.addEventListener("click", function () {
        var open = drawer.classList.toggle("open");
        burger.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", String(open));
      });
    }

    /* 浏览器前进/后退、手改 hash */
    window.addEventListener("hashchange", function () {
      hashTo((location.hash || "").replace("#", ""), true);
    });
    /* Safari 从往返缓存恢复 */
    window.addEventListener("pageshow", function (e) { if (e.persisted) onScroll(); });

    /* 章节入场：只是加个类触发位移动画，观察器失效也不会隐藏内容 */
    if (typeof IntersectionObserver === "function") {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-inview");
          io.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -16% 0px", threshold: 0.01 });
      panes.forEach(function (p) { io.observe(p); });
    } else {
      panes.forEach(function (p) { p.classList.add("is-inview"); });
    }

    /* 初始定位：支持 #services 这类深链；图片加载完后高度会变，再校一次 */
    function place() {
      onScroll();
      var h = (location.hash || "").replace("#", "");
      if (h) hashTo(h, false);
    }
    if (document.readyState === "complete") place();
    else window.addEventListener("load", place);
    setTimeout(place, 320);
  }

  /* ---------------- 入场动效 ----------------
     只挂类名，动画由 .pane.is-inview 触发（纯 CSS，见 style.css）。
     这样即使脚本或观察器失效，内容也不会被永久隐藏。 */
  function initReveal() {
    var sel = ".about-top > *, .kind-list, .letter, .srv-card, .cred-col, .qr-card, .stmt, .form-card, " +
      ".contact-top > *, .pin, .ach-col, .colg-tab";
    $$(sel).forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.animationDelay = (i % 3) * 70 + "ms";
    });
  }

  /* ---------------- 形象照替换 ---------------- */
  function initPortrait() {
    var img = $("#portrait");
    var btn = $("#portrait-edit");
    var file = $("#portrait-file");
    if (!img || !btn || !file) return;

    var DEFAULT_SRC = img.getAttribute("src");
    var reset = null;

    function apply(src) {
      img.src = src;
      if (src === DEFAULT_SRC) {
        if (reset) { reset.remove(); reset = null; }
      } else if (!reset) {
        reset = document.createElement("button");
        reset.type = "button";
        reset.className = "figure-edit";
        reset.style.right = "auto";
        reset.style.left = "10px";
        reset.textContent = "恢复默认";
        reset.addEventListener("click", function (e) {
          e.stopPropagation();
          try { localStorage.removeItem(SITE.portraitKey); } catch (err) {}
          apply(DEFAULT_SRC);
        });
        btn.parentElement.appendChild(reset);
      }
    }

    try {
      var saved = localStorage.getItem(SITE.portraitKey);
      if (saved) apply(saved);
    } catch (err) {}

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      file.value = "";
      file.click();
    });

    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f || !/^image\//.test(f.type)) return;
      var reader = new FileReader();
      reader.onload = function () {
        var data = String(reader.result);
        try {
          localStorage.setItem(SITE.portraitKey, data);
        } catch (err) {
          window.alert("照片太大，没能保存在本机。换一张更小的图片即可，或直接替换 assets/img/portrait.jpg。");
        }
        apply(data);
      };
      reader.readAsDataURL(f);
    });
  }

  /* ---------------- 留言表单 ---------------- */
  function initForm() {
    var form = $("#msg-form");
    if (!form) return;
    var status = $("#form-status");

    function say(kind, msg) {
      status.className = "form-status on " + kind;
      status.innerHTML = msg;
    }
    function mailto(name, contact, body) {
      var subject = "【网站留言】" + name + " 的法律咨询";
      var text = "称呼：" + name + "\n联系方式：" + contact + "\n\n" + body + "\n\n—— 来自 fajia 网站留言";
      return "mailto:" + SITE.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#f-name").value.trim();
      var contact = $("#f-contact").value.trim();
      var body = $("#f-body").value.trim();

      if (!name || !contact || !body) {
        say("warn", "请把「称呼、联系方式、事情描述」三项都填好，我才能准确回复。");
        return;
      }

      var endpoint = window.FAJIA_MESSAGE_ENDPOINT || SITE.messageEndpoint;
      if (endpoint) {
        say("warn", "正在发送…");
        // 来源标记：按域名区分公开站 / 学员站，收件箱标题即可分辨
        var siteLabel = /github\.io/i.test(location.hostname) ? "公开站"
          : (/workbuddy/i.test(location.hostname) ? "学员站" : "本站");
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: name, contact: contact, message: body,
            site: siteLabel,
            _subject: "【法家人·" + siteLabel + "留言】" + name
          })
        }).then(function (r) {
          if (!r.ok) throw new Error("bad status");
          form.reset();
          say("ok", "已收到，我会尽快回复你。如情况紧急，可直接致电 " + SITE.phone + "。");
        }).catch(function () {
          say("warn", "发送失败，请改用邮件：<a href=\"" + mailto(name, contact, body) +
            '" style="text-decoration:underline">' + SITE.email + "</a>");
        });
        return;
      }

      window.location.href = mailto(name, contact, body);
      say("ok", "已为你打开邮件客户端，点击「发送」即可送达。<br>若没有反应，请直接写信至 <b>" +
        SITE.email + "</b>，或致电 " + SITE.phone + "。");
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (DEEP.m && KB.modules.some(function (m) { return m.id === DEEP.m; })) state.module = DEEP.m;
    boot();
    renderTabs();
    renderPanel();
    if (DEEP.c) openCol(DEEP.c);
    renderPin();
    renderCases();
    renderWorks();
    renderHonors();
    initReveal();
    initScrollNav();
    initPortrait();
    initForm();

    var tabs = $("#mod-tabs");
    if (tabs) {
      tabs.addEventListener("click", function (e) {
        var b = e.target.closest("[data-m]");
        if (!b) return;
        state.module = b.dataset.m;
        renderTabs();
        renderPanel();
      });
    }

    var input = $("#search");
    var clear = $("#search-clear");
    var timer = null;
    if (input) {
      input.addEventListener("input", function () {
        clearTimeout(timer);
        var v = input.value;
        timer = setTimeout(function () { doSearch(v); }, 130);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { input.value = ""; doSearch(""); }
      });
    }
    if (clear) {
      clear.addEventListener("click", function () {
        if (input) { input.value = ""; input.focus(); }
        doSearch("");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* 全站增强引导器（留言直达/访问统计/返回顶部/文章分享） */
(function () {
  if (window.__FJ_ENHANCE_LOADED__) return;
  window.__FJ_ENHANCE_LOADED__ = true;
  var sc = document.createElement("script");
  var self = document.currentScript && document.currentScript.src;
  var base = self && /\/assets\//.test(self) ? self.slice(0, self.lastIndexOf("/") + 1) : "assets/";
  sc.src = base + "enhance.js?v=1";
  sc.async = false;
  document.head.appendChild(sc);
})();
