/* ==========================================================================
   法家人 · 文章页交互 v3
   - 阅读进度 / 回到顶部
   - 朗读器：女声 / 男声，六档语速（0.5–2.0），段落高亮跟随
   - 模板全文：复制、打印
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PARAS = window.ART_PARAS || [];
  var els = $$(".art-body [data-i]");
  var byIndex = {};
  els.forEach(function (el) { byIndex[+el.dataset.i] = el; });

  /* ---------------- 阅读进度 ---------------- */
  var bar = $("#rd-bar i");
  var toTop = $("#to-top");

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? h.scrollTop / max : 0;
    if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
    if (toTop) toTop.classList.toggle("on", h.scrollTop > 700);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------------- 模板：复制 / 打印 ---------------- */
  var plain = $("#doc-plain");
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = plain ? plain.value : "";
      if (!text) return;
      var done = function () {
        btn.textContent = "已复制";
        btn.classList.add("is-done");
        setTimeout(function () {
          btn.textContent = "复制全文";
          btn.classList.remove("is-done");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });
  $$("[data-print]").forEach(function (btn) {
    btn.addEventListener("click", function () { window.print(); });
  });

  /* 作者原声（真人录音）已下线：站内只保留浏览器合成音朗读。 */

  /* ---------------- 朗读器 ---------------- */
  var box = $("#tts");
  if (!box || !("speechSynthesis" in window) || !PARAS.length) {
    if (box) box.style.display = "none";
    var note0 = $("#tts-note");
    if (note0) note0.textContent = "当前浏览器不支持语音朗读，建议使用 Edge、Chrome 或 Safari 打开。";
    return;
  }

  var synth = window.speechSynthesis;
  var btnPlay = $("#tts-play");
  var btnStop = $("#tts-stop");
  var selVoice = $("#tts-voice");
  var selRate = $("#tts-rate");
  var label = $("#tts-label");
  var prog = $("#tts-prog");
  var fill = $("#tts-fill");

  var state = {
    playing: false,
    paused: false,
    idx: 0,
    voices: [],
    voice: null,
    pitch: 1,
    rate: 1,
    sim: false,
    token: 0
  };

  /* --- 音色识别 ---
     旧版本只按「微软在线音色」的名单认男声，漏掉了系统自带的中文男声：
     macOS 是 Eddy / Reed / Rocko / Grandpa，Windows 与 Edge 还有 Yunxi / Yunjian / Yunyang。
     匹配不到真男声时，代码会回落成「女声 + pitch 0.62」的降调模拟，
     听起来仍是同一个女声 —— 这就是「选了男声还是女声」的原因。
     现在改成：先排除女声名单，再匹配男声名单，最后兜底 voiceURI / 名称里的 male。 */
  var MALE_A = /eddy|reed|rocko|grandpa|yunxi|yunjian|yunyang|yunfeng|yunhao|yunye|yunze|yunjie|kangkang|wanlung|liang|zhiwei/i;
  var FEMALE_A = /ting-?ting|婷婷|meijia|美佳|sinji|善怡|xiaoxiao|晓晓|xiaoyi|晓伊|xiaohan|晓涵|xiaomo|晓墨|xiaorui|晓睿|xiaoshuang|晓双|xiaoyan|晓颜|xiaoxuan|晓萱|huihui|慧慧|yaoyao|瑶瑶|lili|丽丽|xiaoyu|晓宇|sandy|shelley|grandma|flo\b/i;

  function isMale(v) {
    var n = (v && v.name) || "";
    if (!n) return false;
    if (FEMALE_A.test(n)) return false;
    if (MALE_A.test(n)) return true;
    return /\bmale\b/i.test(n) || /male/i.test(String(v.voiceURI || ""));
  }

  function niceName(v) {
    return (v.name || "")
      .replace(/^Microsoft\s+/i, "")
      .replace(/^Google\s+/i, "")
      .replace(/\s*-\s*Chinese.*$/i, "")
      .replace(/\s*\(Chinese.*?\)$/i, "")
      .replace(/\s*\(.*?\)\s*$/i, "")
      .replace(/\s*（.*?）\s*$/i, "")
      .trim() || v.lang;
  }

  function quality(v) {
    var n = v.name || "";
    var s = 0;
    if (/natural|online|premium|enhanced|neural/i.test(n)) s += 40;
    if (/xiaoxiao|yunxi|yunyang|yunjian|eddy|reed|rocko/i.test(n)) s += 30;
    if (/^zh-CN/i.test(v.lang)) s += 12;
    return s;
  }

  var MALE_FALLBACK = null;   /* 系统没有真男声时的降调近似 */

  /* 让用户看得见当前在用哪一支音色，而不是靠猜 */
  function showCur() {
    var note = $("#tts-note");
    if (!note) return;
    var tag = $("#tts-cur");
    if (!tag) {
      tag = document.createElement("span");
      tag.id = "tts-cur";
      tag.className = "tts-cur";
      note.appendChild(tag);
    }
    var v = state.voice;
    var label = v ? niceName(v) : "系统默认";
    var kind = state.sim ? "女声降调模拟" : (isMale(v || {}) ? "男声" : "女声");
    tag.textContent = "　当前：" + label + "（" + kind + "）" +
      (state.sim ? " · 本机未装中文男声" : "");
  }

  function loadVoices() {
    var all = synth.getVoices() || [];
    var zh = all.filter(function (v) {
      return /^zh/i.test(v.lang) || /chinese|mandarin|中文|普通话/i.test(v.name);
    });
    if (!zh.length) return;

    var fem = [], male = [];
    zh.forEach(function (v) { (isMale(v) ? male : fem).push(v); });
    fem.sort(function (a, b) { return quality(b) - quality(a); });
    male.sort(function (a, b) { return quality(b) - quality(a); });

    state.voices = fem.concat(male);

    if (!male.length && fem.length) {
      MALE_FALLBACK = { name: "男声 · 降调模拟", lang: fem[0].lang, _synth: true, _base: fem[0] };
    } else {
      MALE_FALLBACK = null;
    }

    var saved = "";
    try { saved = localStorage.getItem("fajia.voice") || ""; } catch (e) {}

    var html = "";
    if (fem.length) {
      html += '<optgroup label="女声">' + fem.map(function (v) {
        return '<option value="' + state.voices.indexOf(v) + '">' + niceName(v) + "</option>";
      }).join("") + "</optgroup>";
    }
    var maleOpts = male.map(function (v) {
      return '<option value="' + state.voices.indexOf(v) + '">' + niceName(v) + "</option>";
    }).join("");
    if (!male.length && MALE_FALLBACK) {
      maleOpts = '<option value="m">' + MALE_FALLBACK.name + "</option>";
    }
    if (maleOpts) html += '<optgroup label="男声">' + maleOpts + "</optgroup>";

    selVoice.innerHTML = html;

    var pick = fem.length ? state.voices.indexOf(fem[0]) : 0;
    if (saved) {
      if (saved === "m" && MALE_FALLBACK) pick = "m";
      else state.voices.forEach(function (v, i) { if (v.name === saved) pick = i; });
    }
    selVoice.value = String(pick);
    applyVoice(String(pick));
    showCur();
  }

  function applyVoice(val) {
    if (val === "m" && MALE_FALLBACK) {
      state.voice = MALE_FALLBACK._base;
      state.pitch = 0.35;   /* 只是近似：真正男声请安装系统中文男声 */
      state.sim = true;
      return;
    }
    var v = state.voices[+val];
    if (!v) return;
    state.voice = v;
    state.pitch = 1;
    state.sim = false;
  }

  loadVoices();
  if (typeof synth.onvoiceschanged !== "undefined") {
    synth.addEventListener("voiceschanged", function () {
      if (!state.voices.length) loadVoices();
    });
  }

  var savedRate = "";
  try { savedRate = localStorage.getItem("fajia.rate") || ""; } catch (e) {}
  if (savedRate && selRate) { state.rate = parseFloat(savedRate) || 1; selRate.value = String(state.rate); }

  /* --- 工具 --- */
  function setUI() {
    box.classList.toggle("is-on", state.playing);
    var total = PARAS.length;
    var n = Math.min(state.idx + 1, total);
    var shown = state.playing || state.idx > 0 ? n : 0;
    label.textContent = state.playing
      ? (state.paused ? "已暂停" : "正在朗读")
      : (state.idx > 0 ? "继续朗读" : "听全文");
    prog.textContent = shown + " / " + total + " 段";
    fill.style.width = (shown / total * 100).toFixed(1) + "%";
    btnPlay.setAttribute("aria-label", state.playing && !state.paused ? "暂停朗读" : "开始朗读");
  }

  function mark(i) {
    $$(".art-body .is-tts").forEach(function (el) { el.classList.remove("is-tts"); });
    var el = byIndex[i];
    if (!el) return;
    el.classList.add("is-tts");
    var r = el.getBoundingClientRect();
    var top = window.innerHeight * 0.34;
    if (r.top < 90 || r.bottom > window.innerHeight - 40) {
      window.scrollTo({ top: window.scrollY + r.top - top, behavior: "smooth" });
    }
  }

  /* 长段落切成句子，避免部分引擎超长截断 */
  function chunks(text) {
    if (!text) return [];
    if (text.length <= 220) return [text];
    var parts = text.match(/[^。！？；!?;\n]+[。！？；!?;\n]?/g) || [text];
    var out = [], buf = "";
    parts.forEach(function (p) {
      if ((buf + p).length > 200 && buf) { out.push(buf); buf = p; }
      else buf += p;
    });
    if (buf) out.push(buf);
    return out;
  }

  function speakChunk(list, k, tok) {
    if (tok !== state.token) return;
    if (k >= list.length) { next(tok); return; }
    var u = new SpeechSynthesisUtterance(list[k]);
    u.lang = (state.voice && state.voice.lang) || "zh-CN";
    if (state.voice) u.voice = state.voice;
    u.rate = state.rate;
    u.pitch = state.pitch || 1;
    u.onend = function () {
      if (tok !== state.token) return;
      setTimeout(function () { speakChunk(list, k + 1, tok); }, 30);
    };
    u.onerror = function (e) {
      if (tok !== state.token) return;
      if (e && (e.error === "interrupted" || e.error === "canceled")) return;
      next(tok);
    };
    synth.speak(u);
  }

  function speakIndex(i) {
    if (i >= PARAS.length) { stop(); return; }
    state.idx = i;
    mark(i);
    setUI();
    var tok = ++state.token;
    try { synth.cancel(); } catch (e) {}
    setTimeout(function () {
      if (tok !== state.token) return;
      speakChunk(chunks(PARAS[i]), 0, tok);
    }, 60);
  }

  function next(tok) {
    if (tok !== state.token) return;
    if (!state.playing) return;
    speakIndex(state.idx + 1);
  }

  function play() {
    if (state.paused) {
      state.paused = false;
      state.playing = true;
      try { synth.resume(); } catch (e) {}
      setUI();
      return;
    }
    if (state.playing) {
      state.paused = true;
      try { synth.pause(); } catch (e) {}
      setUI();
      return;
    }
    state.playing = true;
    state.paused = false;
    speakIndex(state.idx);
  }

  function stop() {
    state.playing = false;
    state.paused = false;
    state.token++;
    try { synth.cancel(); } catch (e) {}
    $$(".art-body .is-tts").forEach(function (el) { el.classList.remove("is-tts"); });
    setUI();
    prog.textContent = "0 / " + PARAS.length + " 段";
    fill.style.width = "0%";
    label.textContent = "听全文";
  }

  btnPlay.addEventListener("click", play);
  btnStop.addEventListener("click", stop);

  selVoice.addEventListener("change", function () {
    var val = selVoice.value;
    applyVoice(val);
    showCur();
    try {
      localStorage.setItem("fajia.voice", val === "m" ? "m" : (state.voice ? state.voice.name : ""));
    } catch (e) {}
    if (state.playing && !state.paused) speakIndex(state.idx);
  });

  if (selRate) {
    selRate.addEventListener("change", function () {
      state.rate = parseFloat(selRate.value) || 1;
      try { localStorage.setItem("fajia.rate", String(state.rate)); } catch (e) {}
      if (state.playing && !state.paused) speakIndex(state.idx);
    });
  }

  /* 点击段落从该段开始（点链接则跳转，不打断） */
  els.forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var i = +el.dataset.i;
      var sel = window.getSelection && String(window.getSelection());
      if (sel && sel.length > 2) return;
      state.playing = true;
      state.paused = false;
      speakIndex(i);
    });
  });

  /* 页面隐藏时暂停 */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state.playing && !state.paused) {
      state.paused = true;
      try { synth.pause(); } catch (e) {}
      setUI();
    }
  });

  window.addEventListener("beforeunload", function () {
    try { synth.cancel(); } catch (e) {}
  });

  setUI();
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
