/* 小李的工作台 —— 按完整规格实现，基于「每次改动必保存」的可靠地基 */
(function () {
  "use strict";
  var KEY = "workbench_v2_spec";

  /* ============ 工具 ============ */
  function $(id) { return document.getElementById(id); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.className = "show";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ""; }, 1800);
  }

  /* ============ 图标 ============ */
  var ICONS = {
    /* 国风水墨 —— 手绘白色线条小花/小叶，可爱 */
    guofeng: {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="6.2" r="1.9"/><circle cx="17.2" cy="9.2" r="1.9"/><circle cx="15.4" cy="16" r="1.9"/><circle cx="8.6" cy="16" r="1.9"/><circle cx="6.8" cy="9.2" r="1.9"/></svg>',
      study: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V10"/><path d="M12 13c-2-.3-3.6-1.4-4.2-3.2C9.8 9 11.6 9.6 12 11.5"/><path d="M12 11c2-.3 3.6-1.4 4.2-3.2C14.2 7 12.4 7.6 12 9.5"/></svg>',
      ent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v5"/><path d="M12 18c-1.6-.4-2.8-1.3-3.2-2.8C11 15.4 12 16 12 17.4"/><path d="M12 17c1.6-.4 2.8-1.3 3.2-2.8C13 15.4 12 16 12 17.4"/><circle cx="12" cy="9.5" r="1.8"/><circle cx="12" cy="4.8" r="1.6"/><circle cx="16.4" cy="7.4" r="1.6"/><circle cx="14.8" cy="13" r="1.6"/><circle cx="9.2" cy="13" r="1.6"/><circle cx="7.6" cy="7.4" r="1.6"/></svg>',
      life: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20C6.5 17 5 12 6.5 5c5.5.8 10 4 10.5 11-.2 2.2-2 4-4.5 4z"/><path d="M12 20c-.6-5 .4-9.5 4-13"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="5.5" r="1.6"/><circle cx="17.5" cy="8.7" r="1.6"/><circle cx="17.5" cy="15.3" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/><circle cx="6.5" cy="15.3" r="1.6"/><circle cx="6.5" cy="8.7" r="1.6"/></svg>'
    }
  };
  /* 油画小花（莫奈睡莲风）—— 真实图片，装饰用，与名称无关 */
  var OIL_ICONS = {
    home: "assets/icon-home.png",
    study: "assets/icon-study.png",
    ent: "assets/icon-ent.png",
    life: "assets/icon-life.png",
    settings: "assets/icon-settings.png"
  };

  /* ============ 默认数据 ============ */
  function defaultModules() {
    var names = ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断", "申论"];
    /* 莫兰迪淡绿 / 青色系，低饱和柔和 */
    var pal = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8"];
    return names.map(function (n, i) {
      return { name: n, barColor: pal[i], basicColor: pal[i], improveColor: pal[(i + 2) % pal.length], basic: [], improve: [] };
    });
  }
  function defaultData() {
    return {
      settings: { iconStyle: "oil", globalBg: null, navColor: "#8fa382", homeBg: null, rainAlert: false, showThumbs: true, fontStyle: "song", hiddenTabs: [] },
      study: {
        categories: [{ name: "公考", modules: defaultModules() }],
        basicTagPool: { subject: [] },
        improveTagPool: { bookName: [] }
      },
      ent: {
        tagPools: { perspective: ["主攻", "主受", "双视角"], progress: ["正在阅读中", "已读完"], plot: [], author: [] },
        novels: [],
        inspiration: []
      },
      life: {
        order: ["weather", "sleep", "period", "meds", "weight", "memo", "accounts"],
        hidden: [],
        weather: { city: "鞍山市", temp: null, precip: 0 },
        sleep: { records: [], remind: "" },
        period: { records: [], cycle: 28 },
        meds: [],
        weight: [],
        memo: [],
        accounts: {
          entries: [],
          tags: {
            expense: { online: ["游戏", "零食", "家具用品", "文具"], offline: ["零食", "日用品"] },
            income: { online: ["工资", "零花钱"] }
          }
        },
        cardBg: { weather: null, sleep: null, period: null, meds: null, weight: null, memo: null, accounts: null }
      }
    };
  }
  var LIFE_FEATS = [
    { key: "weather", name: "天气提醒" }, { key: "sleep", name: "睡眠提醒" },
    { key: "period", name: "经期记录" }, { key: "meds", name: "用药提醒" },
    { key: "weight", name: "体重管理" }, { key: "memo", name: "备忘录" },
    { key: "accounts", name: "记账" }
  ];

  /* ============ 存储 ============ */
  var Store = {
    data: defaultData(),
    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var p = JSON.parse(raw);
          if (p && typeof p === "object") {
            var d = defaultData();
            this.data = Object.assign(d, p);
            var self = this;
            this.data.settings = Object.assign(d.settings, p.settings || {});
            if (!this.data.settings.hiddenTabs) this.data.settings.hiddenTabs = [];
            this.data.study = Object.assign(d.study, p.study || {});
            this.data.ent = Object.assign(d.ent, p.ent || {});
            this.data.life = Object.assign(d.life, p.life || {});
            if (!this.data.life.order) this.data.life.order = d.life.order.slice();
            if (!this.data.life.hidden) this.data.life.hidden = [];
            /* 旧数据可能没有 accounts，d.life.accounts 会是 undefined，
               clone(undefined) 会抛错导致后续兼容逻辑中断，因此先兜底。 */
            if (!this.data.life.accounts) this.data.life.accounts = clone(d.life.accounts || defaultData().life.accounts);
            if (!this.data.life.cardBg) this.data.life.cardBg = {};
            this.data.life.cardBg = Object.assign(d.life.cardBg, this.data.life.cardBg);
            /* 把新增功能默认加入可见列表（兼容旧数据） */
            var defaultOrder = ["weather", "sleep", "period", "meds", "weight", "memo", "accounts"];
            defaultOrder.forEach(function (k) { if (self.data.life.order.indexOf(k) < 0 && self.data.life.hidden.indexOf(k) < 0) self.data.life.order.push(k); });
            /* 旧模块配色迁移到莫兰迪淡绿/青色系 */
            var OLD = ["#5f7a5a", "#b08d4f", "#3a6ea5", "#a5503a", "#7a5aa5", "#4a8a6a"];
            var NEW = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8"];
            this.data.study.categories.forEach(function (c) {
              c.modules.forEach(function (m) {
                ["barColor", "basicColor", "improveColor"].forEach(function (k) {
                  var i = OLD.indexOf(m[k]); if (i >= 0) m[k] = NEW[i];
                });
              });
            });
          }
        }
      } catch (e) { console.warn("读取失败", e); }
    },
    save: function () {
      var ss = $("save-state");
      if (ss) { ss.className = "saving"; ss.textContent = "保存中…"; }
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        if (ss) { ss.className = "saved"; ss.textContent = "已保存"; }
        return true;
      } catch (e) {
        console.error("保存失败", e);
        if (ss) { ss.className = "error"; ss.textContent = "保存失败"; }
        toast("⚠️ 保存失败：存储空间可能已满");
        return false;
      }
    }
  };

  var state = { tab: "home", cat: 0, mod: 0, phase: "basic", entSub: "novel", entFilter: null, entSearch: "", lifeSel: "weather", accFilter: { type: null, channel: null, tag: null } };

  /* ============ 取色器 ============ */
  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100; var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function rgbToHex(r, g, b) { return "#" + [r, g, b].map(function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function hexToHsv(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [Math.round(h), Math.round(s * 100), Math.round(v * 100)];
  }
  function openColorPicker(initial, cb) {
    var hsv = hexToHsv(initial || "#a9c4b5");
    var h = hsv[0], s = hsv[1], v = hsv[2];
    openModal('<h3>取色（色相 / 饱和度 / 明度）</h3>' +
      '<div class="picker">' +
      '<div class="row"><span>色相</span><input type="range" id="pk-h" min="0" max="359" value="' + h + '" style="flex:1"></div>' +
      '<div class="row"><span>饱和</span><input type="range" id="pk-s" min="0" max="100" value="' + s + '" style="flex:1"></div>' +
      '<div class="row"><span>明度</span><input type="range" id="pk-v" min="0" max="100" value="' + v + '" style="flex:1"></div>' +
      '<div class="preview" id="pk-prev"></div>' +
      '<button class="btn-primary" id="pk-ok">确定</button></div>');
    function upd() {
      h = +$("pk-h").value; s = +$("pk-s").value; v = +$("pk-v").value;
      $("pk-prev").style.background = rgbToHex.apply(null, hsvToRgb(h, s, v));
    }
    ["pk-h", "pk-s", "pk-v"].forEach(function (id) { $(id).addEventListener("input", upd); });
    upd();
    $("pk-ok").onclick = function () { closeModal(); cb(rgbToHex.apply(null, hsvToRgb(h, s, v))); };
  }
  function openBgPicker(cb) {
    var hsv = hexToHsv("#a9c4b5"); var h = hsv[0], s = hsv[1], v = hsv[2];
    openModal('<h3>背景（颜色或图片）</h3>' +
      '<div class="picker">' +
      '<div class="row"><span>色相</span><input type="range" id="pk-h" min="0" max="359" value="' + h + '" style="flex:1"></div>' +
      '<div class="row"><span>饱和</span><input type="range" id="pk-s" min="0" max="100" value="' + s + '" style="flex:1"></div>' +
      '<div class="row"><span>明度</span><input type="range" id="pk-v" min="0" max="100" value="' + v + '" style="flex:1"></div>' +
      '<div class="preview" id="pk-prev"></div>' +
      '<div class="row"><span>图片</span><input type="file" id="pk-img" accept="image/*"></div>' +
      '<button class="btn-primary" id="pk-ok">确定</button></div>');
    var imgData = null;
    $("pk-img").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { imgData = rd.result; }; rd.readAsDataURL(f);
    });
    function upd() { h = +$("pk-h").value; s = +$("pk-s").value; v = +$("pk-v").value; $("pk-prev").style.background = rgbToHex.apply(null, hsvToRgb(h, s, v)); }
    ["pk-h", "pk-s", "pk-v"].forEach(function (id) { $(id).addEventListener("input", upd); }); upd();
    $("pk-ok").onclick = function () {
      closeModal();
      if (imgData) cb({ type: "image", value: imgData });
      else cb({ type: "color", value: rgbToHex.apply(null, hsvToRgb(h, s, v)) });
    };
  }
  function applyBg(el, bg) {
    if (!bg) { el.style.background = ""; return; }
    if (bg.type === "image") el.style.background = "center/cover no-repeat url(" + bg.value + ")";
    else el.style.background = bg.value;
  }

  /* ============ 字体 ============ */
  var FONT_MAP = {
    slimgold: '"Ma Shan Zheng","Zhi Mang Xing","KaiTi",serif',
    song: '"Noto Serif SC","Songti SC","STSong","SimSun","宋体",serif',
    fang: '"Noto Serif SC","FangSong","STFangsong","仿宋",serif',
    kai: '"Long Cang","KaiTi","STKaiti","楷体",serif'
  };
  function applyFont() {
    var s = Store.data.settings.fontStyle || "song";
    document.documentElement.style.setProperty("--ui-font", FONT_MAP[s] || FONT_MAP.song);
  }

  /* ============ 弹窗 ============ */
  function openModal(html) { $("modal-box").innerHTML = html; $("modal").hidden = false; }
  function closeModal() { $("modal").hidden = true; $("modal-box").innerHTML = ""; }

  /* ============ 日期工具 ============ */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtYMD(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseYMD(s) { var p = String(s).split("-"); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function ymdCmp(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function todayStr() { return fmtYMD(new Date()); }

  /* ============ 月历日期选择器 ============ */
  // opts: { mode:"single"|"range", value: "YYYY-MM-DD" 或 {start,end}, onConfirm(res) }
  function openDatePicker(opts) {
    opts = opts || {};
    var mode = opts.mode === "range" ? "range" : "single";
    var now = new Date();
    var initView = opts.value ? (typeof opts.value === "string" ? parseYMD(opts.value) : parseYMD(opts.value.start || opts.value.end)) : { y: now.getFullYear(), m: now.getMonth() };
    var view = { y: initView.y, m: initView.m };
    var selStart = null, selEnd = null;
    if (opts.value) {
      if (mode === "range" && opts.value.start) { selStart = opts.value.start; selEnd = opts.value.end || opts.value.start; }
      else { selStart = typeof opts.value === "string" ? opts.value : (opts.value.start || opts.value.end); selEnd = selStart; }
    } else { selStart = todayStr(); selEnd = selStart; }
    var tStr = todayStr();

    function title() { return view.y + "年" + (view.m + 1) + "月"; }
    function buildHeader() {
      var h = document.createElement("div"); h.className = "cal-head";
      var prev = document.createElement("button"); prev.className = "cal-nav"; prev.textContent = "‹";
      var t = document.createElement("div"); t.className = "cal-title"; t.textContent = title();
      var next = document.createElement("button"); next.className = "cal-nav"; next.textContent = "›";
      prev.onclick = function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); };
      next.onclick = function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); };
      h.appendChild(prev); h.appendChild(t); h.appendChild(next);
      return h;
    }
    function buildGrid() {
      var grid = document.createElement("div"); grid.className = "cal-grid";
      ["日", "一", "二", "三", "四", "五", "六"].forEach(function (w) {
        var c = document.createElement("div"); c.className = "cal-wk"; c.textContent = w; grid.appendChild(c);
      });
      var first = new Date(view.y, view.m, 1).getDay();
      var days = new Date(view.y, view.m + 1, 0).getDate();
      for (var i = 0; i < first; i++) { var blank = document.createElement("div"); blank.className = "cal-cell empty"; grid.appendChild(blank); }
      for (var d = 1; d <= days; d++) {
        var ds = view.y + "-" + pad2(view.m + 1) + "-" + pad2(d);
        var cell = document.createElement("div"); cell.className = "cal-cell"; cell.textContent = d;
        if (ds === tStr) cell.classList.add("today");
        if (mode === "single") {
          if (ds === selStart) cell.classList.add("sel");
          cell.onclick = function () { closeCal(); opts.onConfirm && opts.onConfirm(ds); };
        } else {
          if (ds === selStart) cell.classList.add("rstart");
          if (ds === selEnd && selEnd !== selStart) cell.classList.add("rend");
          if (selStart && selEnd && ymdCmp(ds, selStart) >= 0 && ymdCmp(ds, selEnd) <= 0) cell.classList.add("inrange");
          cell.onclick = function () { onRangeClick(ds); };
        }
        grid.appendChild(cell);
      }
      return grid;
    }
    function onRangeClick(ds) {
      if (!selStart || (selStart && selEnd)) { selStart = ds; selEnd = null; }
      else if (ymdCmp(ds, selStart) >= 0) { selEnd = ds; closeCal(); opts.onConfirm && opts.onConfirm({ start: selStart, end: selEnd }); return; }
      else { selStart = ds; selEnd = null; }
      render();
    }
    function render() {
      panel.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "cal-picker";
      var tip = document.createElement("div"); tip.className = "cal-tip";
      tip.textContent = mode === "range" ? (selStart && selEnd ? ("已选 " + selStart + " 至 " + selEnd) : (selStart ? ("起 " + selStart + " — 请点击结束日（可翻月）") : "请点击开始日")) : "点击日期即可选择";
      wrap.appendChild(tip);
      wrap.appendChild(buildHeader());
      wrap.appendChild(buildGrid());
      if (mode === "range") {
        var bar = document.createElement("div"); bar.className = "cal-bar";
        var done = document.createElement("button"); done.className = "btn-primary"; done.textContent = "完成";
        done.onclick = function () { closeCal(); opts.onConfirm && opts.onConfirm({ start: selStart, end: selEnd || selStart }); };
        var reselect = document.createElement("button"); reselect.className = "mini-btn"; reselect.textContent = "重选";
        reselect.onclick = function () { selStart = null; selEnd = null; render(); };
        bar.appendChild(done); bar.appendChild(reselect); wrap.appendChild(bar);
      }
      panel.appendChild(wrap);
    }
    var overlay = document.createElement("div"); overlay.className = "cal-overlay";
    var panel = document.createElement("div"); panel.className = "cal-modal";
    overlay.appendChild(panel); document.body.appendChild(overlay);
    overlay.onclick = function (e) { if (e.target === overlay) closeCal(); };
    function closeCal() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    render();
  }

  /* ============ 标签控件 ============ */
  function createTagControl(container, pool, selected, opts) {
    opts = opts || {};
    container.innerHTML = "";
    var selWrap = document.createElement("div"); selWrap.className = "tag-sel";
    selected.forEach(function (t) {
      var p = document.createElement("span"); p.className = "tagpill"; p.textContent = t;
      var x = document.createElement("span"); x.textContent = " ×"; x.style.cursor = "pointer"; x.style.color = "#b5483b";
      x.onclick = function () { var i = selected.indexOf(t); if (i >= 0) selected.splice(i, 1); Store.save(); createTagControl(container, pool, selected, opts); };
      p.appendChild(x); selWrap.appendChild(p);
    });
    container.appendChild(selWrap);
    var row = document.createElement("div"); row.className = "tag-add-row";
    var inp = document.createElement("input"); inp.placeholder = opts.placeholder || "输入标签后回车或点添加";
    var btn = document.createElement("button"); btn.className = "mini-btn"; btn.textContent = "添加";
    function add() { var val = inp.value.trim(); if (!val) return; if (selected.indexOf(val) < 0) selected.push(val); if (pool.indexOf(val) < 0) pool.push(val); inp.value = ""; Store.save(); createTagControl(container, pool, selected, opts); }
    btn.onclick = add;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    row.appendChild(inp); row.appendChild(btn); container.appendChild(row);
    if (pool.length) {
      var cand = document.createElement("div"); cand.className = "tag-sel"; cand.style.marginTop = "6px";
      pool.forEach(function (t) {
        if (selected.indexOf(t) >= 0) return;
        var p = document.createElement("span"); p.className = "tagpill"; p.style.cursor = "pointer"; p.style.opacity = ".8"; p.textContent = "+ " + t;
        p.onclick = function () { if (selected.indexOf(t) < 0) selected.push(t); Store.save(); createTagControl(container, pool, selected, opts); };
        cand.appendChild(p);
      });
      container.appendChild(cand);
    }
  }

  /* ============ 主页 ============ */
  var ZH_QUOTES = [
    { text: "博学之，审问之，慎思之，明辨之，笃行之。", explain: "要广泛地学习，详细地求教，慎重地思考，清晰地辨别，并切实地付诸行动。" },
    { text: "不积跬步，无以至千里；不积小流，无以成江海。", explain: "不积累半步一步，就走不到千里之外；不汇积细小水流，就成不了大江大海。比喻学问要靠日积月累。" },
    { text: "业精于勤，荒于嬉；行成于思，毁于随。", explain: "学业因勤奋而精进，因玩乐而荒废；做事因独立思考而成功，因盲目跟从而失败。" },
    { text: "志之所趋，无远弗届；穷山距海，不能限也。", explain: "志向所奔赴的地方，再远也能到达；纵使高山大海，也无法将它阻挡。" },
    { text: "宝剑锋从磨砺出，梅花香自苦寒来。", explain: "宝剑的锋利来自反复磨砺，梅花的清香来自凛冽寒冬。比喻好成绩要经过艰苦磨炼。" },
    { text: "千淘万漉虽辛苦，吹尽狂沙始到金。", explain: "千万遍淘洗过滤虽然辛苦，吹尽狂沙才能得到真金。比喻历经磨砺终会见到成果。" }
  ];
  var EN_QUOTES = [
    { text: "Stay hungry, stay foolish.", explain: "译：保持饥饿，保持愚蠢。意指永远保有求知若渴的心态与敢于试错的勇气。" },
    { text: "The best is yet to come.", explain: "译：最好的尚未到来。是在鼓励你——前方还有更精彩的事在等你。" },
    { text: "Dream big, work hard.", explain: "译：敢梦远大，踏实去干。先敢想，再拼命做。" },
    { text: "Keep going, you're doing great.", explain: "译：继续前行，你已经做得很棒了。给自己打气：别停，你做得很好。" }
  ];
  var IDIOMS = [
    { word: "锲而不舍", explain: "不停地雕刻。比喻做事情能坚持到底，有恒心、有毅力。" },
    { word: "厚积薄发", explain: "大量地积累，少量地释放。形容准备充分，才能把事办好。" },
    { word: "持之以恒", explain: "长期坚持下去，一刻也不松懈。" },
    { word: "精益求精", explain: "已经很好了，还追求更好。" },
    { word: "笃行致远", explain: "脚踏实地、知行合一，方能走得长远。" },
    { word: "韦编三绝", explain: "编联竹简的皮绳断了多次。形容读书勤奋。" },
    { word: "焚膏继晷", explain: "点燃灯烛接替日光。形容夜以继日地勤学或工作。" },
    { word: "孜孜不倦", explain: "勤勉努力，不知疲倦。" },
    { word: "日就月将", explain: "日有所得，月有所进。形容积少成多、不断进步。" },
    { word: "行稳致远", explain: "步子走稳，才能走得远。比喻做事踏实方能长久。" }
  ];
  var KNOWLEDGE = [
    { cat: "时政", text: "二十届三中全会强调以经济体制改革为牵引，全面推进中国式现代化。" },
    { cat: "时政", text: "今年《政府工作报告》将‘新质生产力’列为高质量发展的重要抓手。" },
    { cat: "人文", text: "‘四书’指《大学》《中庸》《论语》《孟子》，为儒家核心经典。" },
    { cat: "历史", text: "科举制始于隋，至清光绪三十一年废除，绵延约一千三百年。" },
    { cat: "科技", text: "我国‘东数西算’工程将东部算力需求有序引导至西部枢纽节点。" },
    { cat: "地理", text: "我国地势西高东低，呈三级阶梯分布，季风气候显著。" },
    { cat: "经济", text: "GDP 衡量一国一定时期内生产的最终产品和服务的总价值。" },
    { cat: "法律", text: "民事主体从事民事活动，应遵循自愿、公平、诚信原则。" },
    { cat: "历史", text: "丝绸之路是古代东西方文明交流的重要通道，始于西汉张骞通西域。" },
    { cat: "科技", text: "人工智能大模型训练依赖海量数据与高性能算力集群。" }
  ];
  function renderHome() {
    var en = Math.random() < 0.4;
    var q = en ? EN_QUOTES[Math.floor(Math.random() * EN_QUOTES.length)] : ZH_QUOTES[Math.floor(Math.random() * ZH_QUOTES.length)];
    var qEl = $("home-quote-text"); qEl.textContent = q.text;
    var exEl = $("home-quote-explain"); exEl.textContent = q.explain || ""; exEl.style.display = q.explain ? "" : "none";
    $("home-quote").className = "home-quote" + (en ? " en" : "");
    applyBg($("home-quote"), Store.data.settings.homeBg);

    var mg = $("math-grid"); mg.innerHTML = "";
    for (var i = 0; i < 10; i++) {
      var a = Math.floor(Math.random() * 100), b = Math.floor(Math.random() * 100), op = ["+", "-"][Math.floor(Math.random() * 2)], r;
      if (op === "+") r = a + b; else { if (a < b) { var t = a; a = b; b = t; } r = a - b; }
      var d = document.createElement("div"); d.className = "mq";
      d.innerHTML = a + " " + op + " " + b + " = <span class='ans'>" + r + "</span>";
      d.onclick = function () { this.classList.toggle("revealed"); };
      mg.appendChild(d);
    }

    var fl = $("fact-list"); fl.innerHTML = "";
    var idioms = IDIOMS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var sz = KNOWLEDGE.filter(function (k) { return k.cat === "时政"; });
    var others = KNOWLEDGE.filter(function (k) { return k.cat !== "时政"; }).sort(function () { return Math.random() - 0.5; });
    var know = []; if (sz.length) know.push(sz[Math.floor(Math.random() * sz.length)]);
    know = know.concat(others.slice(0, 2));
    idioms.forEach(function (w) { fl.appendChild(factItem("成语", w.word, w.explain, false)); });
    know.forEach(function (k) { fl.appendChild(factItem(k.cat, k.text, null, k.cat === "时政")); });

    var ht = $("home-thumbs"); ht.innerHTML = "";
    if (Store.data.settings.showThumbs) {
      var w = Store.data.life.weather;
      if (w && w.city) {
        var td = document.createElement("div"); td.className = "thumb weather";
        td.innerHTML = "<b>天气 · " + esc(w.city) + "</b><br>" + (w.temp != null ? (w.temp + "℃，降水 " + (w.precip || 0) + "mm") : "未获取");
        ht.appendChild(td);
      }
      if (Store.data.life.memo.length) {
        var last = Store.data.life.memo[0];
        var md = document.createElement("div"); md.className = "thumb memo";
        md.innerHTML = "<b>备忘录 · " + esc(last.title || "备忘") + "</b><br>" + esc(last.content || "");
        ht.appendChild(md);
      }
      if (!ht.children.length) { var e = document.createElement("div"); e.className = "thumb"; e.textContent = "天气与备忘录将显示在这里"; ht.appendChild(e); }
    }
  }
  function factItem(tag, text, explain, isSZ) {
    var d = document.createElement("div"); d.className = "fact-item" + (isSZ ? " shizheng" : "");
    var html = '<span class="tag">' + esc(tag) + '</span><span class="body">' + esc(text);
    if (explain) html += '<span class="explain">（' + esc(explain) + '）</span>';
    html += "</span>";
    d.innerHTML = html; return d;
  }

  /* ============ 学习 ============ */
  function curModule() { var c = Store.data.study.categories[state.cat]; return c ? c.modules[state.mod] : null; }
  function renderStudyNav() {
    var box = $("study-cats"); box.innerHTML = "";
    Store.data.study.categories.forEach(function (cat, ci) {
      var h = document.createElement("div"); h.className = "nav-cat"; h.textContent = cat.name; box.appendChild(h);
      cat.modules.forEach(function (m, mi) {
        var b = document.createElement("button");
        b.className = "nav-mod" + (ci === state.cat && mi === state.mod ? " active" : "");
        b.setAttribute("draggable", "true");
        b.innerHTML = '<span class="dot" style="background:' + esc(m.barColor) + '"></span>' + esc(m.name) +
          '<span class="updown"><a data-move="up" data-mi="' + mi + '">▲</a> <a data-move="down" data-mi="' + mi + '">▼</a></span>';
        b.onclick = function (e) { if (e.target.getAttribute("data-move")) return; state.cat = ci; state.mod = mi; renderStudyNav(); renderStudyMain(); };
        b.querySelector('[data-move="up"]').onclick = function (e) { e.stopPropagation(); moveModule(ci, mi, -1); };
        b.querySelector('[data-move="down"]').onclick = function (e) { e.stopPropagation(); moveModule(ci, mi, 1); };
        bindDrag(b, cat.modules, mi, function () { state.mod = mi; renderStudyNav(); renderStudyMain(); });
        box.appendChild(b);
      });
    });
  }
  function moveModule(ci, mi, dir) {
    var arr = Store.data.study.categories[ci].modules; var j = mi + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[mi]; arr[mi] = arr[j]; arr[j] = t;
    state.mod = j; Store.save(); renderStudyNav(); renderStudyMain();
  }
  function bindDrag(el, arr, idx, after) {
    el.addEventListener("dragstart", function (e) { el.classList.add("dragging"); e.dataTransfer.setData("text/plain", idx); });
    el.addEventListener("dragend", function () { el.classList.remove("dragging"); });
    el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("dragover"); });
    el.addEventListener("dragleave", function () { el.classList.remove("dragover"); });
    el.addEventListener("drop", function (e) {
      e.preventDefault(); el.classList.remove("dragover");
      var from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      var to = arr.indexOf(el.__mod); if (isNaN(to)) to = idx;
      if (isNaN(from) || from === to) return;
      var t = arr[from]; arr.splice(from, 1); arr.splice(to, 0, t);
      Store.save(); after();
    });
  }
  function renderStudyMain() {
    var m = curModule(); if (!m) return;
    m.__mod = state.mod;
    $("module-name").textContent = m.name;
    $("module-dot").style.background = m.barColor;
    var pts = document.querySelectorAll(".phase");
    for (var i = 0; i < pts.length; i++) pts[i].classList.toggle("active", pts[i].getAttribute("data-phase") === state.phase);
    $("study-swatches").innerHTML = "";
    [m.basicColor, m.improveColor, m.barColor].forEach(function (c) {
      var sw = document.createElement("span"); sw.className = "swatch"; sw.style.background = c;
      sw.onclick = function () { setModuleColor(c); }; $("study-swatches").appendChild(sw);
    });
    var ul = $("study-list"); ul.innerHTML = "";
    var list = state.phase === "basic" ? m.basic : m.improve;
    list.forEach(function (it) {
      var li = document.createElement("li");
      if (state.phase === "basic") {
        li.innerHTML = '<div class="it-title">' + esc(it.subject || "课程") + '</div>' +
          '<div class="it-meta">' + esc(it.date || "") + "　序号 " + esc(it.no || "") + "　" + (it.progress === "done" ? "已完成" : "未完成") + '</div>' +
          (it.note ? '<div class="it-body">' + esc(it.note) + "</div>" : "") +
          '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      } else {
        li.innerHTML = '<div class="it-title">' + esc(it.bookName || "题册") + '</div>' +
          '<div class="it-meta">' + esc(it.date || "") + "　章节 " + esc(it.chapterNo || "") + "　页码 " + esc(it.pageNo || "") + '</div>' +
          (it.note ? '<div class="it-body">' + esc(it.note) + "</div>" : "") +
          (it.photos && it.photos.length ? '<div class="photos">' + it.photos.map(function (p) { return '<img src="' + esc(p) + '">'; }).join("") + "</div>" : "") +
          '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      }
      li.setAttribute("data-id", it.id); ul.appendChild(li);
    });
  }
  function setModuleColor(hex) {
    var m = curModule(); if (!m) return;
    if (state.phase === "basic") m.basicColor = hex; else m.improveColor = hex;
    m.barColor = hex; Store.save(); renderStudyNav(); renderStudyMain();
  }
  function showStudyForm(editId) {
    var m = curModule(); if (!m) return;
    var isBasic = state.phase === "basic";
    var it = editId ? (isBasic ? m.basic : m.improve).filter(function (x) { return x.id === editId; })[0] : null;
    var pool = isBasic ? Store.data.study.basicTagPool.subject : Store.data.study.improveTagPool.bookName;
    var sel = it ? [it.subject || it.bookName || ""].filter(Boolean) : [];
    openModal('<h3>' + (it ? "编辑" : "新建") + (isBasic ? "（基础学习）" : "（提升阶段）") + '</h3>' +
      (isBasic
        ? '<div class="row"><label>日期</label><span id="sf-date-disp" class="date-disp">' + (it && it.date ? esc(it.date) : "未选择（默认今天）") + '</span><button class="mini-btn" id="sf-date-pick">选择日期</button></div>' +
          '<div style="font-size:13px;color:#5f7a5a;margin:6px 0 2px;">课程科目</div><div id="sf-subj" class="tagctrl"></div>' +
          '<input id="sf-no" placeholder="课程序号（01, 02…）" value="' + (it ? esc(it.no) : "") + '">' +
          '<select id="sf-prog"><option value="todo">未完成</option><option value="done">已完成</option></select>' +
          '<textarea id="sf-note" placeholder="笔记">' + (it ? esc(it.note) : "") + '</textarea>'
        : '<div class="row"><label>日期</label><span id="sf-date-disp" class="date-disp">' + (it && it.date ? esc(it.date) : "未选择（默认今天）") + '</span><button class="mini-btn" id="sf-date-pick">选择日期</button></div>' +
          '<div style="font-size:13px;color:#5f7a5a;margin:6px 0 2px;">题册名称</div><div id="sf-subj" class="tagctrl"></div>' +
          '<input id="sf-ch" placeholder="试卷章节序号（01, 02…）" value="' + (it ? esc(it.chapterNo) : "") + '">' +
          '<input id="sf-pg" placeholder="题测页码（01, 02…）" value="' + (it ? esc(it.pageNo) : "") + '">' +
          '<textarea id="sf-note" placeholder="笔记">' + (it ? esc(it.note) : "") + '</textarea>' +
          '<input id="sf-photo" type="file" accept="image/*" style="margin-bottom:8px;">') +
      '<button class="btn-primary" id="sf-save">保存</button>');
    var sfDate = it && it.date ? it.date : "";
    $("sf-date-pick").onclick = function () {
      openDatePicker({ mode: "single", value: sfDate || undefined, onConfirm: function (d) { sfDate = d; $("sf-date-disp").textContent = d; } });
    };
    createTagControl($("sf-subj"), pool, sel, { placeholder: "输入科目/题册名" });
    $("sf-save").onclick = function () {
      var photos = (it && it.photos) ? it.photos.slice() : [];
      var file = $("sf-photo") && $("sf-photo").files && $("sf-photo").files[0];
      function commit() {
        var obj = isBasic
          ? { id: it ? it.id : uid(), date: sfDate || todayStr(), subject: sel.join("") || "课程", no: $("sf-no").value.trim(), progress: $("sf-prog").value, note: $("sf-note").value.trim() }
          : { id: it ? it.id : uid(), date: sfDate || todayStr(), bookName: sel.join("") || "题册", chapterNo: $("sf-ch").value.trim(), pageNo: $("sf-pg").value.trim(), note: $("sf-note").value.trim(), photos: photos };
        var arr = isBasic ? m.basic : m.improve;
        if (it) { var i = arr.indexOf(it); arr[i] = obj; } else arr.unshift(obj);
        Store.save(); closeModal(); renderStudyMain(); toast("已保存");
      }
      if (file) { var rd = new FileReader(); rd.onload = function () { photos.push(rd.result); commit(); }; rd.onerror = function () { commit(); }; rd.readAsDataURL(file); }
      else commit();
    };
  }

  /* ============ 娱乐 —— 小说 ============ */
  function renderNovelFilterNav() {
    var box = $("novel-filters"); if (!box) return;
    box.innerHTML = "";
    var pool = Store.data.ent.tagPools;
    var cats = [
      { key: null, name: "全部", tags: ["全部"] },
      { key: "perspective", name: "视角", tags: pool.perspective },
      { key: "progress", name: "进度", tags: pool.progress },
      { key: "plot", name: "情节萌点", tags: pool.plot },
      { key: "author", name: "作者", tags: pool.author }
    ];
    cats.forEach(function (cat) {
      if (cat.key !== null && !cat.tags.length) return;
      var h = document.createElement("div"); h.className = "filter-cat"; h.textContent = cat.name; box.appendChild(h);
      cat.tags.forEach(function (t) {
        var b = document.createElement("button"); b.className = "filter-tag" + (state.entFilter === t ? " active" : "");
        var span = document.createElement("span"); span.textContent = t; b.appendChild(span);
        var c = document.createElement("span"); c.className = "count";
        var cnt = t === "全部" ? Store.data.ent.novels.length : Store.data.ent.novels.filter(function (n) {
          return (n.perspective || []).indexOf(t) >= 0 || (n.progress || []).indexOf(t) >= 0 ||
            (n.plot || []).indexOf(t) >= 0 || (n.author || []).indexOf(t) >= 0;
        }).length;
        c.textContent = cnt; b.appendChild(c);
        b.onclick = function () { state.entFilter = (t === "全部" ? null : t); renderNovelFilterNav(); renderEntList(); };
        box.appendChild(b);
      });
    });
  }
  function renderEntList() {
    var ul = $("novel-list"); ul.innerHTML = "";
    var filter = state.entFilter;
    var search = (state.entSearch || "").trim().toLowerCase();
    var list = Store.data.ent.novels.filter(function (n) {
      if (filter) {
        var inTags = (n.perspective || []).indexOf(filter) >= 0 || (n.progress || []).indexOf(filter) >= 0 ||
          (n.plot || []).indexOf(filter) >= 0 || (n.author || []).indexOf(filter) >= 0;
        if (!inTags) return false;
      }
      if (search && (n.name || "").toLowerCase().indexOf(search) < 0) return false;
      return true;
    });
    if (!list.length) {
      var empty = document.createElement("li"); empty.className = "hint"; empty.style.cssText = "background:none;box-shadow:none;text-align:center;padding:24px 0;";
      empty.textContent = search ? "没有找到匹配的小说" : "还没有小说记录，点击底部添加吧";
      ul.appendChild(empty); return;
    }
    list.forEach(function (n) {
      var li = document.createElement("li"); li.className = "novel-card";
      var tags = [].concat(n.perspective || [], n.progress || [], n.plot || [], n.author || []).map(function (t) {
        return '<span class="tagpill clickable' + (state.entFilter === t ? ' active' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + "</span>";
      }).join(" ");
      li.innerHTML = '<div class="it-title">' + esc(n.name || "(无名)") + '</div>' +
        (n.charText ? '<div class="it-body">人设：' + esc(n.charText) + "</div>" : "") +
        (tags ? '<div class="novel-tags">' + tags + "</div>" : "") +
        '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      li.setAttribute("data-id", n.id); ul.appendChild(li);
    });
  }
  function showNovelForm(editId) {
    var n = editId ? Store.data.ent.novels.filter(function (x) { return x.id === editId; })[0] : null;
    var pool = Store.data.ent.tagPools;
    openModal('<h3>' + (n ? "编辑小说" : "添加小说") + '</h3>' +
      '<input id="nf-name" placeholder="小说名称" value="' + (n ? esc(n.name) : "") + '">' +
      '<div class="kv"><label>视角</label><div id="nf-p" class="tagctrl"></div></div>' +
      '<div class="kv"><label>阅读进度</label><div id="nf-pr" class="tagctrl"></div></div>' +
      '<input id="nf-char" placeholder="人设（文本）" value="' + (n ? esc(n.charText) : "") + '">' +
      '<div class="kv"><label>情节萌点</label><div id="nf-plot" class="tagctrl"></div></div>' +
      '<div class="kv"><label>作者</label><div id="nf-author" class="tagctrl"></div></div>' +
      '<button class="btn-primary" id="nf-save">保存</button>');
    var per = n ? n.perspective.slice() : [], prog = n ? n.progress.slice() : [], plot = n ? n.plot.slice() : [], author = n ? n.author.slice() : [];
    createTagControl($("nf-p"), pool.perspective, per, { placeholder: "选择/添加" });
    createTagControl($("nf-pr"), pool.progress, prog, { placeholder: "选择/添加" });
    createTagControl($("nf-plot"), pool.plot, plot, { placeholder: "回车或添加" });
    createTagControl($("nf-author"), pool.author, author, { placeholder: "回车或添加" });
    $("nf-save").onclick = function () {
      var obj = { id: n ? n.id : uid(), name: $("nf-name").value.trim(), perspective: per, progress: prog, charText: $("nf-char").value.trim(), plot: plot, author: author };
      if (n) { var i = Store.data.ent.novels.indexOf(n); Store.data.ent.novels[i] = obj; } else Store.data.ent.novels.unshift(obj);
      Store.save(); closeModal(); renderEntList(); renderNovelFilterNav(); toast("已保存");
    };
  }
  function showTagManager() {
    var pool = Store.data.ent.tagPools;
    openModal('<h3>标签管理</h3>' +
      '<div class="tag-add-row" style="margin:6px 0;"><input id="tm-new" placeholder="新预设标签"><button class="mini-btn" id="tm-add">添加预设</button></div>' +
      '<div id="tm-list"></div><button class="mini-btn" id="tm-close" style="margin-top:10px;">关闭</button>');
    var allKeys = ["perspective", "progress", "plot", "author"];
    function draw() {
      var box = $("tm-list"); box.innerHTML = "";
      allKeys.forEach(function (k) {
        pool[k].forEach(function (t) {
          var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0;";
          var span = document.createElement("span"); span.className = "tagpill"; span.textContent = t;
          span.ondblclick = function () { var nv = prompt("修改标签名：", t); if (!nv) return; nv = nv.trim(); if (!nv) return; var arr = pool[k]; var i = arr.indexOf(t); if (i >= 0) arr[i] = nv; Store.data.ent.novels.forEach(function (no) { ["perspective", "progress", "plot", "author"].forEach(function (f) { if (no[f]) { var j = no[f].indexOf(t); if (j >= 0) no[f][j] = nv; } }); }); Store.save(); draw(); renderNovelFilterNav(); renderEntList(); };
          var del = document.createElement("button"); del.className = "mini-btn danger"; del.textContent = "×";
          del.onclick = function () { var arr = pool[k]; var i = arr.indexOf(t); if (i >= 0) arr.splice(i, 1); Store.data.ent.novels.forEach(function (no) { ["perspective", "progress", "plot", "author"].forEach(function (f) { if (no[f]) { var j = no[f].indexOf(t); if (j >= 0) no[f].splice(j, 1); } }); }); Store.save(); draw(); renderNovelFilterNav(); renderEntList(); };
          row.appendChild(span); row.appendChild(del); box.appendChild(row);
        });
      });
    }
    draw();
    $("tm-add").onclick = function () { var v = $("tm-new").value.trim(); if (!v) return; if (pool.plot.indexOf(v) < 0) { pool.plot.push(v); Store.save(); $("tm-new").value = ""; draw(); renderNovelFilterNav(); } };
    $("tm-close").onclick = closeModal;
  }
  function renderInspList() {
    var ul = $("insp-list"); ul.innerHTML = "";
    Store.data.ent.inspiration.forEach(function (it) {
      var li = document.createElement("li");
      li.innerHTML = '<div class="it-title">' + esc(it.title || "灵感") + '</div>' +
        '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      li.setAttribute("data-id", it.id); ul.appendChild(li);
    });
  }
  function showInspForm(editId) {
    var it = editId ? Store.data.ent.inspiration.filter(function (x) { return x.id === editId; })[0] : null;
    openModal('<h3>' + (it ? "编辑灵感" : "新建灵感") + '</h3>' +
      '<input id="if-title" placeholder="标题" value="' + (it ? esc(it.title) : "") + '">' +
      '<div class="rte-tools"><button data-c="bold">B</button><button data-c="italic">I</button><button data-c="insertUnorderedList">• 列表</button></div>' +
      '<div class="rte" id="if-rte" contenteditable="true">' + (it ? it.html : "") + '</div>' +
      '<input id="if-photo" type="file" accept="image/*" style="margin-top:8px;">' +
      '<button class="btn-primary" id="if-save">保存</button>');
    $("if-rte").previousElementSibling.querySelectorAll("button").forEach(function (b) { b.onclick = function () { document.execCommand(b.getAttribute("data-c"), false, null); }; });
    $("if-save").onclick = function () {
      var html = $("if-rte").innerHTML;
      var obj = { id: it ? it.id : uid(), title: $("if-title").value.trim() || "灵感", html: html };
      if (it) { var i = Store.data.ent.inspiration.indexOf(it); Store.data.ent.inspiration[i] = obj; } else Store.data.ent.inspiration.unshift(obj);
      Store.save(); closeModal(); renderInspList(); toast("已保存");
    };
  }

  /* ============ 生活 ============ */
  function renderLifeNav() {
    var box = $("life-feats"); box.innerHTML = "";
    var order = Store.data.life.order;
    order.forEach(function (key, idx) {
      var f = LIFE_FEATS.filter(function (x) { return x.key === key; })[0]; if (!f) return;
      var b = document.createElement("button");
      b.className = "nav-mod" + (state.lifeSel === key ? " active" : "");
      b.setAttribute("draggable", "true");
      b.innerHTML = esc(f.name) + '<span class="updown"><a data-move="up">▲</a> <a data-move="down">▼</a></span>';
      b.onclick = function (e) { if (e.target.getAttribute("data-move")) return; state.lifeSel = key; renderLifeNav(); renderLifeMain(); };
      b.querySelector('[data-move="up"]').onclick = function (e) { e.stopPropagation(); moveLife(idx, -1); };
      b.querySelector('[data-move="down"]').onclick = function (e) { e.stopPropagation(); moveLife(idx, 1); };
      bindDrag(b, order, idx, function () { renderLifeNav(); renderLifeMain(); });
      box.appendChild(b);
    });
    var hidden = Store.data.life.hidden;
    if (hidden.length) {
      var hr = document.createElement("div"); hr.className = "nav-cat"; hr.textContent = "预留功能"; box.appendChild(hr);
      hidden.forEach(function (key) {
        var f = LIFE_FEATS.filter(function (x) { return x.key === key; })[0]; if (!f) return;
        var b = document.createElement("button"); b.className = "nav-mod reserved";
        b.innerHTML = esc(f.name) + '<span class="updown"><a data-show="' + key + '">显示</a></span>';
        b.querySelector('[data-show]').onclick = function (e) { e.stopPropagation(); showLifeFeature(key); };
        box.appendChild(b);
      });
    }
  }
  function moveLife(idx, dir) {
    var arr = Store.data.life.order; var j = idx + dir; if (j < 0 || j >= arr.length) return;
    var t = arr[idx]; arr[idx] = arr[j]; arr[j] = t; Store.save(); renderLifeNav(); renderLifeMain();
  }
  function hideLifeFeature(key) {
    var order = Store.data.life.order, hidden = Store.data.life.hidden;
    var i = order.indexOf(key); if (i < 0) return;
    order.splice(i, 1); if (hidden.indexOf(key) < 0) hidden.push(key);
    if (state.lifeSel === key) state.lifeSel = order[0] || "";
    Store.save(); renderLifeNav(); renderLifeMain();
  }
  function showLifeFeature(key) {
    var order = Store.data.life.order, hidden = Store.data.life.hidden;
    var i = hidden.indexOf(key); if (i < 0) return;
    hidden.splice(i, 1); if (order.indexOf(key) < 0) order.push(key);
    state.lifeSel = key;
    Store.save(); renderLifeNav(); renderLifeMain();
  }
  function renderLifeMain() {
    var box = $("life-detail"); var key = state.lifeSel;
    if (!key) { box.innerHTML = '<p class="hint">所有生活功能已隐藏，可在左侧“预留功能”中恢复</p>'; return; }
    var f = LIFE_FEATS.filter(function (x) { return x.key === key; })[0];
    if (!f) { box.innerHTML = '<p class="hint">从左侧选择功能</p>'; return; }
    var bg = Store.data.life.cardBg[key];
    var html = '<div class="life-card" id="lc"><h3>' + esc(f.name) + '<button class="mini-btn bg-btn" id="lc-bg">背景</button><button class="mini-btn danger" id="lc-hide">隐藏</button></h3>';
    if (key === "weather") html += lifeWeatherHtml();
    else if (key === "sleep") html += lifeSleepHtml();
    else if (key === "period") html += lifePeriodHtml();
    else if (key === "meds") html += lifeMedsHtml();
    else if (key === "weight") html += lifeWeightHtml();
    else if (key === "memo") html += lifeMemoHtml();
    else if (key === "accounts") html += lifeAccountsHtml();
    html += '</div>';
    box.innerHTML = html;
    applyBg($("lc"), bg);
    $("lc-bg").onclick = function () { openBgPicker(function (r) { Store.data.life.cardBg[key] = r; Store.save(); renderLifeMain(); }); };
    $("lc-hide").onclick = function () { hideLifeFeature(key); };
    bindLifeHandlers(key);
  }
  function lifeWeatherHtml() {
    var w = Store.data.life.weather;
    return '<div class="row"><label>城市</label><input id="lw-city" value="' + esc(w.city || "") + '"></div>' +
      '<button class="mini-btn" id="lw-fetch">获取天气</button>' +
      (w.temp != null ? '<div class="weight-log">' + esc(w.city) + "：" + w.temp + "℃，降水 " + (w.precip || 0) + "mm</div>" : "");
  }
  function lifeSleepHtml() {
    var s = Store.data.life.sleep;
    var rows = s.records.map(function (r) { return '<div class="weight-log">' + esc(r.date) + " 睡 " + esc(r.sleep) + " 起 " + esc(r.wake) + "</div>"; }).join("");
    return '<div class="row"><label>提醒时间</label><input type="time" id="ls-remind" value="' + esc(s.remind || "") + '"></div>' +
      '<div class="row"><label>记录（日期/入睡/起床）</label><input id="ls-date" placeholder="2026-07-27"><input id="ls-sleep" placeholder="23:00"><input id="ls-wake" placeholder="07:00"><button class="mini-btn" id="ls-add">记录</button></div>' +
      rows;
  }
  function lifePeriodHtml() {
    var p = Store.data.life.period;
    var rows = p.records.slice(-5).map(function (r) {
      var s = r.start || r.date, e = r.end || r.date;
      return '<div class="weight-log">' + esc(s) + (s !== e ? " ～ " + esc(e) : "") + "</div>";
    }).join("");
    var lastStart = p.records.length ? (p.records[p.records.length - 1].start || p.records[p.records.length - 1].date) : "";
    var next = lastStart ? predictPeriod(lastStart, p.cycle) : "";
    return '<div class="row"><label>周期（天）</label><input type="number" id="lp-cycle" value="' + esc(p.cycle || 28) + '"></div>' +
      '<div class="row"><label>本次经期</label><span id="lp-range-disp" class="date-disp">未选择（点右侧选起止日）</span><button class="mini-btn" id="lp-pick">选择日期</button></div>' +
      '<button class="mini-btn" id="lp-add">记录</button>' +
      (next ? '<div class="weight-log">预计下次：' + next + "</div>" : "") + rows;
  }
  function predictPeriod(last, cycle) {
    try { var d = new Date(last); d.setDate(d.getDate() + (parseInt(cycle, 10) || 28)); return d.toISOString().slice(0, 10); } catch (e) { return ""; }
  }
  function lifeMedsHtml() {
    var meds = Store.data.life.meds;
    var rows = meds.map(function (m, i) {
      return '<div class="med-row" data-mi="' + i + '"><button class="del-med" data-mi="' + i + '">删除</button>' +
        '<div class="row"><label>药名</label><input class="med-name" data-mi="' + i + '" value="' + esc(m.name) + '"></div>' +
        '<div class="row"><label>间隔</label><select class="med-iv" data-mi="' + i + '">' +
        [6, 8, 12].map(function (v) { return '<option value="' + v + '"' + (m.interval == v ? " selected" : "") + '>每 ' + v + ' 小时</option>'; }).join("") + '</select></div>' +
        '<div class="row"><label>首次服药</label><input type="time" class="med-start" data-mi="' + i + '" value="' + esc(m.start || "08:00") + '"></div>' +
        '<div class="row"><label>天数</label><input type="number" class="med-days" data-mi="' + i + '" value="' + esc(m.days || 7) + '"></div>' +
        '<div class="weight-log">服药时间：' + computeMedTimes(m).join("、") + '</div></div>';
    }).join("");
    return rows + '<button class="mini-btn" id="lm-add">+ 添加用药</button>';
  }
  function computeMedTimes(med) {
    var parts = (med.start || "08:00").split(":"); var sh = parseInt(parts[0], 10) || 8, sm = parseInt(parts[1], 10) || 0;
    var iv = parseInt(med.interval, 10) || 8; var times = [];
    for (var h = sh; h < 24; h += iv) times.push((h < 10 ? "0" + h : h) + ":" + (sm < 10 ? "0" + sm : sm));
    return times;
  }
  function lifeWeightHtml() {
    var w = Store.data.life.weight;
    var rows = w.slice(-5).map(function (r) { return '<div class="weight-log">' + esc(r.date) + "：" + esc(r.v) + " kg</div>"; }).join("");
    return '<div class="row"><label>日期</label><span id="lw-date-disp" class="date-disp">' + todayStr() + '</span><button class="mini-btn" id="lw-date-pick">选择日期</button></div>' +
      '<div class="row"><label>记录体重(kg)</label><input type="number" id="lw-v" placeholder="60.5"><button class="mini-btn" id="lw-add">记录</button></div>' + rows;
  }
  function lifeMemoHtml() {
    var memos = Store.data.life.memo;
    var rows = memos.map(function (m, i) {
      return '<div class="med-row" data-mi="' + i + '"><button class="del-med" data-mi="' + i + '">删除</button>' +
        '<div class="row"><label>标题</label><input class="memo-title" data-mi="' + i + '" value="' + esc(m.title) + '"></div>' +
        '<div class="row"><label>内容</label><textarea class="memo-content" data-mi="' + i + '">' + esc(m.content) + '</textarea></div>' +
        (m.date ? '<div class="weight-log">日期：' + esc(m.date) + '</div>' : '') + '</div>';
    }).join("");
    return rows + '<div class="row"><label>新备忘</label><input id="lm-title" placeholder="标题"><textarea id="lm-content" placeholder="内容"></textarea>' +
      '<div class="row"><label>日期</label><span id="lm-date-disp" class="date-disp">' + todayStr() + '</span><button class="mini-btn" id="lm-date-pick">选择日期</button></div>' +
      '<button class="mini-btn" id="lm-new">添加</button></div>';
  }
  /* ============ 记账 ============ */
  var accNavState = { expense: true, income: true };
  var TYPE_LABELS = { expense: "支出", income: "收入" };
  var CHAN_LABELS = { online: "线上", offline: "线下" };
  function lifeAccountsHtml() {
    return '<div class="layout acc-layout" id="acc-layout">' +
      '<nav class="side-nav acc-nav" id="acc-nav"><button class="fold-btn" id="acc-fold">‹</button><div class="nav-scroll" id="acc-filters"></div><button class="mini-btn" id="acc-tag-manage" style="margin:8px 10px 12px;">标签管理</button></nav>' +
      '<div class="main-work acc-main">' +
        '<div class="acc-stats">' +
          '<div class="stat-card exp"><b>本月支出</b><span id="acc-month-exp">0</span></div>' +
          '<div class="stat-card inc"><b>本月收入</b><span id="acc-month-inc">0</span></div>' +
          '<div class="stat-card net"><b>本月结余</b><span id="acc-month-net">0</span></div>' +
          '<div class="stat-card exp"><b>本年支出</b><span id="acc-year-exp">0</span></div>' +
          '<div class="stat-card inc"><b>本年收入</b><span id="acc-year-inc">0</span></div>' +
          '<div class="stat-card net"><b>本年结余</b><span id="acc-year-net">0</span></div>' +
        '</div>' +
        '<div class="acc-filter-info" id="acc-filter-info"></div>' +
        '<ul class="item-list" id="acc-list"></ul>' +
        '<button class="btn-primary" id="acc-add">+ 记一笔</button>' +
      '</div>' +
    '</div>';
  }
  function matchAccountFilter(e, filter) {
    filter = filter || state.accFilter;
    if (filter.type && e.type !== filter.type) return false;
    if (filter.channel && e.channel !== filter.channel) return false;
    if (filter.tag && e.tag !== filter.tag) return false;
    return true;
  }
  function countAccounts(filter) {
    return Store.data.life.accounts.entries.filter(function (e) { return matchAccountFilter(e, filter); }).length;
  }
  function calcAccountStats(filter) {
    var s = { monthExp: 0, monthInc: 0, yearExp: 0, yearInc: 0 };
    var now = new Date(), cy = now.getFullYear(), cm = now.getMonth() + 1;
    Store.data.life.accounts.entries.forEach(function (e) {
      if (!matchAccountFilter(e, filter)) return;
      var p = parseYMD(e.date);
      var ey = p.y, em = p.m + 1;
      if (e.type === "expense") {
        if (ey === cy && em === cm) s.monthExp += (+e.amount || 0);
        if (ey === cy) s.yearExp += (+e.amount || 0);
      } else {
        if (ey === cy && em === cm) s.monthInc += (+e.amount || 0);
        if (ey === cy) s.yearInc += (+e.amount || 0);
      }
    });
    return s;
  }
  function renderAccountNav() {
    var box = $("acc-filters"); if (!box) return;
    box.innerHTML = "";
    var tags = Store.data.life.accounts.tags;
    var filter = state.accFilter;
    function allBtn() {
      var b = document.createElement("button"); b.className = "filter-tag" + (!filter.type ? " active" : "");
      b.innerHTML = '<span>全部</span><span class="count">' + countAccounts({}) + "</span>";
      b.onclick = function () { state.accFilter = { type: null, channel: null, tag: null }; renderAccountNav(); renderAccountList(); };
      box.appendChild(b);
    }
    allBtn();
    ["expense", "income"].forEach(function (type) {
      if (!tags[type]) return;
      var typeCount = countAccounts({ type: type });
      var expanded = !!accNavState[type];
      var h = document.createElement("div"); h.className = "filter-cat acc-branch";
      var arrow = document.createElement("span"); arrow.className = "acc-arrow"; arrow.textContent = expanded ? "▼" : "▶";
      var label = document.createElement("span"); label.className = "acc-label";
      var activeType = filter.type === type && !filter.channel;
      label.innerHTML = '<span class="' + (activeType ? "active" : "") + '">' + TYPE_LABELS[type] + '</span>';
      var cnt = document.createElement("span"); cnt.className = "count"; cnt.textContent = typeCount;
      h.appendChild(arrow); h.appendChild(label); h.appendChild(cnt);
      h.onclick = function (e) {
        if (e.target === arrow) { e.stopPropagation(); accNavState[type] = !accNavState[type]; renderAccountNav(); return; }
        state.accFilter = { type: type, channel: null, tag: null }; renderAccountNav(); renderAccountList();
      };
      box.appendChild(h);
      var children = document.createElement("div"); children.className = "acc-children" + (expanded ? "" : " collapsed");
      for (var ch in tags[type]) {
        (function (channel) {
          var chanTags = tags[type][channel] || [];
          var chanCount = countAccounts({ type: type, channel: channel });
          var chExpanded = !!accNavState[type + "-" + channel];
          var chH = document.createElement("div"); chH.className = "filter-cat acc-subbranch";
          var chArrow = document.createElement("span"); chArrow.className = "acc-arrow"; chArrow.textContent = chExpanded ? "▼" : "▶";
          var chLabel = document.createElement("span"); chLabel.className = "acc-label";
          var activeChan = filter.type === type && filter.channel === channel && !filter.tag;
          chLabel.innerHTML = '<span class="' + (activeChan ? "active" : "") + '">　' + CHAN_LABELS[channel] + '</span>';
          var chCnt = document.createElement("span"); chCnt.className = "count"; chCnt.textContent = chanCount;
          chH.appendChild(chArrow); chH.appendChild(chLabel); chH.appendChild(chCnt);
          chH.onclick = function (e) {
            if (e.target === chArrow) { e.stopPropagation(); accNavState[type + "-" + channel] = !chExpanded; renderAccountNav(); return; }
            state.accFilter = { type: type, channel: channel, tag: null }; renderAccountNav(); renderAccountList();
          };
          children.appendChild(chH);
          var tagBox = document.createElement("div"); tagBox.className = "acc-children" + (chExpanded ? "" : " collapsed");
          chanTags.forEach(function (tag) {
            var tagCount = countAccounts({ type: type, channel: channel, tag: tag });
            var tb = document.createElement("button"); tb.className = "filter-tag" + (filter.type === type && filter.channel === channel && filter.tag === tag ? " active" : "");
            tb.innerHTML = '<span>　　' + esc(tag) + '</span><span class="count">' + tagCount + "</span>";
            tb.onclick = function () { state.accFilter = { type: type, channel: channel, tag: tag }; renderAccountNav(); renderAccountList(); };
            tagBox.appendChild(tb);
          });
          children.appendChild(tagBox);
        })(ch);
      }
      box.appendChild(children);
    });
  }
  function renderAccountList() {
    var filter = state.accFilter;
    var list = Store.data.life.accounts.entries.filter(function (e) { return matchAccountFilter(e, filter); });
    list.sort(function (a, b) { return ymdCmp(b.date, a.date); });
    var stats = calcAccountStats(filter);
    $("acc-month-exp").textContent = "¥" + stats.monthExp.toFixed(2);
    $("acc-month-inc").textContent = "¥" + stats.monthInc.toFixed(2);
    $("acc-month-net").textContent = "¥" + (stats.monthInc - stats.monthExp).toFixed(2);
    $("acc-year-exp").textContent = "¥" + stats.yearExp.toFixed(2);
    $("acc-year-inc").textContent = "¥" + stats.yearInc.toFixed(2);
    $("acc-year-net").textContent = "¥" + (stats.yearInc - stats.yearExp).toFixed(2);
    var info = $("acc-filter-info");
    if (!filter.type) info.textContent = "当前：全部";
    else if (!filter.channel) info.textContent = "当前：" + TYPE_LABELS[filter.type];
    else if (!filter.tag) info.textContent = "当前：" + TYPE_LABELS[filter.type] + " - " + CHAN_LABELS[filter.channel];
    else info.textContent = "当前：" + TYPE_LABELS[filter.type] + " - " + CHAN_LABELS[filter.channel] + " - " + filter.tag;
    var ul = $("acc-list"); ul.innerHTML = "";
    if (!list.length) { var empty = document.createElement("li"); empty.className = "hint"; empty.style.cssText = "background:none;box-shadow:none;text-align:center;padding:24px 0;"; empty.textContent = "该分类下暂无记录"; ul.appendChild(empty); return; }
    list.forEach(function (e) {
      var li = document.createElement("li");
      var cls = e.type === "expense" ? "exp" : "inc";
      var sign = e.type === "expense" ? "-" : "+";
      var tagText = [TYPE_LABELS[e.type], e.channel ? CHAN_LABELS[e.channel] : "", e.tag].filter(Boolean).join(" · ");
      li.innerHTML = '<div class="it-title">' + esc(e.date) + ' <span class="acc-tagline">' + esc(tagText) + '</span></div>' +
        '<div class="it-body">' + (e.note ? esc(e.note) : "无备注") + '</div>' +
        '<div class="acc-amount ' + cls + '">' + sign + "¥" + (+e.amount || 0).toFixed(2) + '</div>' +
        '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      li.setAttribute("data-id", e.id); ul.appendChild(li);
    });
  }
  function showAccountForm(editId) {
    var entries = Store.data.life.accounts.entries;
    var it = editId ? entries.filter(function (x) { return x.id === editId; })[0] : null;
    var tags = Store.data.life.accounts.tags;
    openModal('<h3>' + (it ? "编辑账单" : "记一笔") + '</h3>' +
      '<div class="row"><label>日期</label><span id="af-date-disp" class="date-disp">' + (it ? esc(it.date) : todayStr()) + '</span><button class="mini-btn" id="af-date-pick">选择日期</button></div>' +
      '<div class="row"><label>类型</label><select id="af-type"><option value="expense">支出</option><option value="income">收入</option></select></div>' +
      '<div class="row"><label>渠道</label><select id="af-chan"><option value="online">线上</option><option value="offline">线下</option></select></div>' +
      '<div class="row"><label>标签</label><select id="af-tag"></select><input id="af-newtag" placeholder="没有？输入新标签" style="margin-top:6px;"></div>' +
      '<div class="row"><label>金额</label><input type="number" id="af-amt" placeholder="0.00" value="' + (it ? it.amount : "") + '"></div>' +
      '<textarea id="af-note" placeholder="备注">' + (it ? esc(it.note) : "") + '</textarea>' +
      '<button class="btn-primary" id="af-save">保存</button>');
    var afDate = it ? it.date : todayStr();
    $("af-date-pick").onclick = function () {
      openDatePicker({ mode: "single", value: afDate, onConfirm: function (d) { afDate = d; $("af-date-disp").textContent = d; } });
    };
    function updateTagOptions() {
      var t = $("af-type").value, c = $("af-chan").value;
      var opts = (tags[t] && tags[t][c]) || [];
      var sel = $("af-tag"); sel.innerHTML = "";
      opts.forEach(function (tag) { var o = document.createElement("option"); o.value = tag; o.textContent = tag; if (it && it.tag === tag) o.selected = true; sel.appendChild(o); });
    }
    $("af-type").onchange = updateTagOptions; $("af-chan").onchange = updateTagOptions;
    if (it) { $("af-type").value = it.type; $("af-chan").value = it.channel; }
    updateTagOptions();
    $("af-save").onclick = function () {
      var amt = parseFloat($("af-amt").value);
      if (isNaN(amt) || amt <= 0) { toast("请输入金额"); return; }
      var type = $("af-type").value, channel = $("af-chan").value;
      var tag = $("af-newtag").value.trim() || $("af-tag").value;
      if (!tag) { toast("请选择或输入标签"); return; }
      if (!tags[type]) tags[type] = {};
      if (!tags[type][channel]) tags[type][channel] = [];
      if (tags[type][channel].indexOf(tag) < 0) tags[type][channel].push(tag);
      var obj = { id: it ? it.id : uid(), date: afDate, type: type, channel: channel, tag: tag, amount: amt, note: $("af-note").value.trim() };
      if (it) { var i = entries.indexOf(it); entries[i] = obj; } else entries.unshift(obj);
      Store.save(); closeModal(); renderAccountList(); renderAccountNav(); toast("已保存");
    };
  }
  function showAccountTagManager() {
    var tags = Store.data.life.accounts.tags;
    openModal('<h3>记账标签管理</h3><div id="atm-tree"></div>' +
      '<div class="tag-add-row"><select id="atm-type"><option value="expense">支出</option><option value="income">收入</option></select>' +
      '<select id="atm-chan"><option value="online">线上</option><option value="offline">线下</option></select>' +
      '<input id="atm-new" placeholder="新标签名"><button class="mini-btn" id="atm-add">添加</button></div>' +
      '<button class="mini-btn" id="atm-close" style="margin-top:10px;">关闭</button>');
    function draw() {
      var box = $("atm-tree"); box.innerHTML = "";
      ["expense", "income"].forEach(function (type) {
        if (!tags[type]) return;
        var typeH = document.createElement("div"); typeH.className = "filter-cat"; typeH.textContent = TYPE_LABELS[type]; box.appendChild(typeH);
        for (var ch in tags[type]) {
          (function (channel) {
            var chH = document.createElement("div"); chH.className = "filter-cat acc-subbranch"; chH.innerHTML = "　" + CHAN_LABELS[channel]; box.appendChild(chH);
            var arr = tags[type][channel] || [];
            arr.forEach(function (tag, idx) {
              var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0 4px 24px;";
              var span = document.createElement("span"); span.className = "tagpill"; span.textContent = tag;
              span.ondblclick = function () { var nv = prompt("修改标签名：", tag); if (!nv) return; nv = nv.trim(); if (!nv) return; var i = arr.indexOf(tag); if (i >= 0) arr[i] = nv; entriesReplaceTag(type, channel, tag, nv); Store.save(); draw(); renderAccountNav(); renderAccountList(); };
              var up = document.createElement("button"); up.className = "mini-btn"; up.textContent = "▲"; if (idx === 0) up.disabled = true;
              up.onclick = function () { if (idx > 0) { var t = arr[idx]; arr[idx] = arr[idx - 1]; arr[idx - 1] = t; Store.save(); draw(); renderAccountNav(); } };
              var down = document.createElement("button"); down.className = "mini-btn"; down.textContent = "▼"; if (idx === arr.length - 1) down.disabled = true;
              down.onclick = function () { if (idx < arr.length - 1) { var t = arr[idx]; arr[idx] = arr[idx + 1]; arr[idx + 1] = t; Store.save(); draw(); renderAccountNav(); } };
              var del = document.createElement("button"); del.className = "mini-btn danger"; del.textContent = "×";
              del.onclick = function () { arr.splice(idx, 1); entriesClearTag(type, channel, tag); Store.save(); draw(); renderAccountNav(); renderAccountList(); };
              row.appendChild(span); row.appendChild(up); row.appendChild(down); row.appendChild(del); box.appendChild(row);
            });
          })(ch);
        }
      });
    }
    function entriesReplaceTag(type, channel, oldTag, newTag) {
      Store.data.life.accounts.entries.forEach(function (e) { if (e.type === type && e.channel === channel && e.tag === oldTag) e.tag = newTag; });
    }
    function entriesClearTag(type, channel, tag) {
      Store.data.life.accounts.entries.forEach(function (e) { if (e.type === type && e.channel === channel && e.tag === tag) e.tag = ""; });
    }
    draw();
    $("atm-add").onclick = function () {
      var type = $("atm-type").value, channel = $("atm-chan").value, v = $("atm-new").value.trim();
      if (!v) return; if (!tags[type]) tags[type] = {}; if (!tags[type][channel]) tags[type][channel] = [];
      if (tags[type][channel].indexOf(v) < 0) { tags[type][channel].push(v); Store.save(); $("atm-new").value = ""; draw(); renderAccountNav(); }
    };
    $("atm-close").onclick = closeModal;
  }
  function bindAccountHandlers() {
    $("acc-fold").onclick = function () { var n = $("acc-nav"); n.classList.toggle("collapsed"); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };
    $("acc-tag-manage").onclick = showAccountTagManager;
    $("acc-add").onclick = function () { showAccountForm(null); };
    $("acc-list").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]"); if (!btn) return;
      var li = btn.closest("li"); if (!li) return; var id = li.getAttribute("data-id"); var act = btn.getAttribute("data-act");
      var entries = Store.data.life.accounts.entries;
      var it = entries.filter(function (x) { return x.id === id; })[0];
      if (act === "del") { if (!confirm("删除这条记录？")) return; Store.data.life.accounts.entries = entries.filter(function (x) { return x.id !== id; }); Store.save(); renderAccountList(); renderAccountNav(); }
      else if (act === "edit") showAccountForm(id);
    });
    renderAccountNav(); renderAccountList();
  }

  function bindLifeHandlers(key) {
    var L = Store.data.life;
    if (key === "weather") {
      $("lw-city").addEventListener("change", function () { L.weather.city = this.value; Store.save(); });
      $("lw-fetch").onclick = function () { fetchWeather(); };
    } else if (key === "sleep") {
      $("ls-remind").addEventListener("change", function () { L.sleep.remind = this.value; Store.save(); });
      $("ls-add").onclick = function () { L.sleep.records.push({ date: $("ls-date").value.trim(), sleep: $("ls-sleep").value.trim(), wake: $("ls-wake").value.trim() }); Store.save(); renderLifeMain(); };
    } else if (key === "period") {
      $("lp-cycle").addEventListener("change", function () { L.period.cycle = parseInt(this.value, 10) || 28; Store.save(); });
      var lpRange = null;
      $("lp-pick").onclick = function () {
        openDatePicker({ mode: "range", onConfirm: function (r) { lpRange = r; $("lp-range-disp").textContent = r.start + (r.start !== r.end ? " ～ " + r.end : ""); } });
      };
      $("lp-add").onclick = function () {
        if (!lpRange) { toast("请先选择经期起止日"); return; }
        L.period.records.push({ start: lpRange.start, end: lpRange.end });
        Store.save(); renderLifeMain();
      };
    } else if (key === "meds") {
      $("lm-add").onclick = function () { L.meds.push({ name: "", interval: 8, start: "08:00", days: 7 }); Store.save(); renderLifeMain(); };
      $("life-detail").querySelectorAll(".del-med").forEach(function (b) { b.onclick = function () { L.meds.splice(+b.getAttribute("data-mi"), 1); Store.save(); renderLifeMain(); }; });
      $("life-detail").querySelectorAll(".med-name").forEach(function (el) { el.addEventListener("change", function () { L.meds[+el.getAttribute("data-mi")].name = this.value; Store.save(); }); });
      $("life-detail").querySelectorAll(".med-iv").forEach(function (el) { el.addEventListener("change", function () { L.meds[+el.getAttribute("data-mi")].interval = +this.value; Store.save(); renderLifeMain(); }); });
      $("life-detail").querySelectorAll(".med-start").forEach(function (el) { el.addEventListener("change", function () { L.meds[+el.getAttribute("data-mi")].start = this.value; Store.save(); renderLifeMain(); }); });
      $("life-detail").querySelectorAll(".med-days").forEach(function (el) { el.addEventListener("change", function () { L.meds[+el.getAttribute("data-mi")].days = +this.value || 7; Store.save(); renderLifeMain(); }); });
    } else if (key === "weight") {
      var lwDate = todayStr();
      $("lw-date-pick").onclick = function () {
        openDatePicker({ mode: "single", value: lwDate, onConfirm: function (d) { lwDate = d; $("lw-date-disp").textContent = d; } });
      };
      $("lw-add").onclick = function () { var v = parseFloat($("lw-v").value); if (isNaN(v)) return; L.weight.push({ date: lwDate, v: v }); Store.save(); renderLifeMain(); renderHome(); };
    } else if (key === "memo") {
      var lmDate = todayStr();
      $("lm-date-pick").onclick = function () {
        openDatePicker({ mode: "single", value: lmDate, onConfirm: function (d) { lmDate = d; $("lm-date-disp").textContent = d; } });
      };
      $("lm-new").onclick = function () { if (!$("lm-title").value.trim() && !$("lm-content").value.trim()) return; L.memo.unshift({ id: uid(), title: $("lm-title").value.trim(), content: $("lm-content").value.trim(), date: lmDate }); Store.save(); renderLifeMain(); renderHome(); };
      $("life-detail").querySelectorAll(".del-med").forEach(function (b) { b.onclick = function () { L.memo.splice(+b.getAttribute("data-mi"), 1); Store.save(); renderLifeMain(); renderHome(); }; });
      $("life-detail").querySelectorAll(".memo-title").forEach(function (el) { el.addEventListener("change", function () { L.memo[+el.getAttribute("data-mi")].title = this.value; Store.save(); }); });
      $("life-detail").querySelectorAll(".memo-content").forEach(function (el) { el.addEventListener("change", function () { L.memo[+el.getAttribute("data-mi")].content = this.value; Store.save(); }); });
    } else if (key === "accounts") {
      bindAccountHandlers();
    }
  }
  function fetchWeather() {
    var city = $("lw-city") ? $("lw-city").value.trim() : "";
    if (!city && Store.data.life.weather.city) city = Store.data.life.weather.city;
    if (!city) { toast("请先填城市"); return; }
    doFetchWeather(city);
  }
  function doFetchWeather(city) {
    Store.data.life.weather.city = city; Store.save(); toast("获取天气中…");
    fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&language=zh&count=1")
      .then(function (r) { return r.json(); }).then(function (g) {
        if (!g.results || !g.results.length) throw new Error("未找到");
        return fetch("https://api.open-meteo.com/v1/forecast?latitude=" + g.results[0].latitude + "&longitude=" + g.results[0].longitude + "&current=temperature_2m,precipitation");
      })
      .then(function (r) { return r.json(); }).then(function (w) {
        Store.data.life.weather.temp = Math.round(w.current.temperature_2m); Store.data.life.weather.precip = w.current.precipitation || 0;
        Store.save(); renderLifeMain(); renderHome();
        if (Store.data.life.weather.precip > 0 && Store.data.settings.rainAlert) notify("降雨提醒", city + "今日有降水，记得带伞");
        toast("天气已更新");
      }).catch(function () { toast("天气获取失败"); });
  }
  function notify(title, body) {
    try { if (!("Notification" in window)) return; if (Notification.permission === "granted") new Notification(title, { body: body }); else if (Notification.permission !== "denied") Notification.requestPermission().then(function (p) { if (p === "granted") new Notification(title, { body: body }); }); } catch (e) {}
  }

  /* ============ 标签点击筛选 / 列表操作 ============ */
  function onListClick(e) {
    var tagEl = e.target.closest ? e.target.closest("[data-tag]") : null;
    if (tagEl) { state.entFilter = tagEl.getAttribute("data-tag"); renderNovelFilterNav(); renderEntList(); return; }
    var btn = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!btn) return;
    var li = btn.closest("li"); if (!li) return; var id = li.getAttribute("data-id"); var act = btn.getAttribute("data-act");
    if (state.tab === "study") {
      var m = curModule(); var arr = state.phase === "basic" ? m.basic : m.improve;
      var it = arr.filter(function (x) { return x.id === id; })[0];
      if (act === "del") { if (!confirm("删除这条？")) return; arr.splice(arr.indexOf(it), 1); Store.save(); renderStudyMain(); }
      else if (act === "edit") showStudyForm(id);
    } else if (state.tab === "ent") {
      if (state.entSub === "novel") {
        var n = Store.data.ent.novels.filter(function (x) { return x.id === id; })[0];
        if (act === "del") { if (!confirm("删除这部作品？")) return; Store.data.ent.novels = Store.data.ent.novels.filter(function (x) { return x.id !== id; }); Store.save(); renderEntList(); }
        else if (act === "edit") showNovelForm(id);
      } else {
        var ins = Store.data.ent.inspiration.filter(function (x) { return x.id === id; })[0];
        if (act === "del") { if (!confirm("删除这条灵感？")) return; Store.data.ent.inspiration = Store.data.ent.inspiration.filter(function (x) { return x.id !== id; }); Store.save(); renderInspList(); }
        else if (act === "edit") showInspForm(id);
      }
    }
  }

  /* ============ 底栏 ============ */
  function renderBottomNav() {
    var bar = $("bottombar"); bar.innerHTML = "";
    var style = Store.data.settings.iconStyle;
    var hidden = Store.data.settings.hiddenTabs || [];
    var tabs = [["home", "主页"], ["study", "学习"], ["ent", "娱乐"], ["life", "生活"], ["settings", "个性化"]];
    tabs.forEach(function (t) {
      if (hidden.indexOf(t[0]) >= 0) return;
      var b = document.createElement("button"); b.className = "tab" + (state.tab === t[0] ? " active" : "");
      b.setAttribute("data-tab", t[0]);
      var iconHtml;
      if (style === "oil" && OIL_ICONS[t[0]]) iconHtml = '<img class="nav-flower" src="' + OIL_ICONS[t[0]] + '" alt="' + t[1] + '">';
      else iconHtml = (ICONS.guofeng[t[0]] || "");
      b.innerHTML = iconHtml + "<span>" + t[1] + "</span>";
      if (style === "oil") {
        var im = b.querySelector("img");
        if (im) im.onerror = function () { var s = document.createElement("span"); s.className = "nav-fallback"; this.parentNode.replaceChild(s, this); };
      }
      b.onclick = function () { switchTab(t[0]); };
      bar.appendChild(b);
    });
    document.documentElement.style.setProperty("--navsel", Store.data.settings.navColor);
  }

  /* ============ 初始化 ============ */
  function switchTab(tab) {
    state.tab = tab;
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) pages[i].hidden = pages[i].getAttribute("data-page") !== tab;
    var tabs = document.querySelectorAll("#bottombar .tab");
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle("active", tabs[j].getAttribute("data-tab") === tab);
    if (tab === "home") renderHome();
    else if (tab === "study") { renderStudyNav(); renderStudyMain(); }
    else if (tab === "ent") { renderNovelFilterNav(); renderEntList(); if (state.entSub === "insp") renderInspList(); }
    else if (tab === "life") { renderLifeNav(); renderLifeMain(); }
    else if (tab === "settings") renderSettings();
  }
  function renderSettings() {
    $("set-icon").value = Store.data.settings.iconStyle;
    $("set-rain").checked = !!Store.data.settings.rainAlert;
    $("set-thumbs").checked = Store.data.settings.showThumbs !== false;
    $("set-icon").onchange = function () { Store.data.settings.iconStyle = this.value; Store.save(); renderBottomNav(); };
    $("set-font").value = Store.data.settings.fontStyle || "song";
    $("set-font").onchange = function () { Store.data.settings.fontStyle = this.value; Store.save(); applyFont(); };
    $("set-globalbg").onclick = function () { openBgPicker(function (r) { Store.data.settings.globalBg = r; Store.save(); applyBg(document.body, r); }); };
    $("set-navcolor").onclick = function () { openColorPicker(Store.data.settings.navColor, function (c) { Store.data.settings.navColor = c; Store.save(); renderBottomNav(); }); };
    $("set-homebg").onclick = function () { openBgPicker(function (r) { Store.data.settings.homeBg = r; Store.save(); applyBg($("home-quote"), r); }); };
    $("set-rain").onchange = function () { Store.data.settings.rainAlert = this.checked; Store.save(); if (this.checked && "Notification" in window && Notification.permission === "default") Notification.requestPermission(); };
    $("set-thumbs").onchange = function () { Store.data.settings.showThumbs = this.checked; Store.save(); renderHome(); };
    document.querySelectorAll(".set-tab").forEach(function (cb) {
      cb.checked = (Store.data.settings.hiddenTabs || []).indexOf(cb.value) < 0;
      cb.onchange = function () {
        var hidden = Store.data.settings.hiddenTabs || [];
        var i = hidden.indexOf(this.value);
        if (this.checked) { if (i >= 0) hidden.splice(i, 1); }
        else { if (i < 0) hidden.push(this.value); }
        Store.data.settings.hiddenTabs = hidden;
        Store.save(); renderBottomNav();
        if (hidden.indexOf(state.tab) >= 0) switchTab("home");
      };
    });
    $("set-clear").onclick = function () { if (!confirm("确定清空全部数据？不可恢复。")) return; Store.data = defaultData(); Store.save(); state.lifeSel = "weather"; switchTab("home"); toast("已清空"); };
    $("set-export").onclick = function () {
      try {
        var raw = JSON.stringify(Store.data, null, 2);
        var blob = new Blob([raw], { type: "application/json" });
        var a = document.createElement("a");
        var d = new Date();
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        a.href = URL.createObjectURL(blob);
        a.download = "小李的工作台备份-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast("已导出备份文件");
      } catch (e) { toast("导出失败：" + e.message); }
    };
    $("set-import").onclick = function () { $("set-import-file").click(); };
    $("set-import-file").onchange = function () {
      var f = this.files && this.files[0];
      this.value = "";
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== "object" || !obj.settings || !obj.life) { toast("文件格式不对，请选择导出的备份文件"); return; }
          if (!confirm("导入将覆盖当前数据，确定继续？")) return;
          localStorage.setItem(KEY, JSON.stringify(obj));
          Store.load();
          normalizeLifeSelection();
          applyBg(document.body, Store.data.settings.globalBg);
          applyFont();
          renderBottomNav();
          switchTab("home");
          toast("导入成功，数据已恢复");
        } catch (e) { toast("导入失败：文件无法解析"); }
      };
      reader.onerror = function () { toast("读取文件失败"); };
      reader.readAsText(f, "utf-8");
    };
  }

  function normalizeLifeSelection() {
    var order = Store.data.life.order;
    if (order.indexOf(state.lifeSel) < 0) state.lifeSel = order[0] || "";
  }

  function init() {
    Store.load();
    normalizeLifeSelection();
    applyBg(document.body, Store.data.settings.globalBg);
    applyFont();

    $("math-refresh").onclick = renderHome;
    $("fact-refresh").onclick = renderHome;

    $("study-fold").onclick = function () { var n = $("study-nav"); n.classList.toggle("collapsed"); n.parentElement.classList.toggle("collapsed", n.classList.contains("collapsed")); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };
    var pts = document.querySelectorAll(".phase");
    for (var p = 0; p < pts.length; p++) {
      pts[p].addEventListener("click", function () { state.phase = this.getAttribute("data-phase"); renderStudyMain(); });
    }
    $("study-color").onclick = function () { var m = curModule(); if (!m) return; openColorPicker(state.phase === "basic" ? m.basicColor : m.improveColor, function (c) { setModuleColor(c); }); };
    $("study-add").onclick = function () { showStudyForm(null); };
    $("study-list").addEventListener("click", onListClick);

    // 娱乐
    var subs = document.querySelectorAll(".sub");
    for (var s = 0; s < subs.length; s++) {
      subs[s].addEventListener("click", function () {
        state.entSub = this.getAttribute("data-sub");
        for (var k = 0; k < subs.length; k++) subs[k].classList.toggle("active", subs[k].getAttribute("data-sub") === state.entSub);
        $("ent-novel").hidden = state.entSub !== "novel"; $("ent-insp").hidden = state.entSub !== "insp";
        if (state.entSub === "novel") { renderNovelFilterNav(); renderEntList(); } else renderInspList();
      });
    }
    $("n-add").onclick = function () { showNovelForm(null); };
    $("n-tag-manage").onclick = showTagManager;
    $("novel-search").addEventListener("input", function () { state.entSearch = this.value; renderEntList(); });
    $("novel-fold").onclick = function () { var n = $("novel-nav"); n.classList.toggle("collapsed"); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };
    $("novel-list").addEventListener("click", onListClick);
    $("insp-add").onclick = function () { showInspForm(null); };
    $("insp-list").addEventListener("click", onListClick);

    // 生活
    $("life-fold").onclick = function () { var n = $("life-nav"); n.classList.toggle("collapsed"); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };

    $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });

    renderBottomNav();
    if (typeof fetch === "function" && Store.data.life.weather.city && Store.data.life.weather.temp == null) doFetchWeather(Store.data.life.weather.city);
    renderHome();
    toast("数据已加载，可放心使用");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  if ("serviceWorker" in navigator) window.addEventListener("load", function () {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.update(); });
    });
    navigator.serviceWorker.register("sw.js").then(function (r) {
      r.addEventListener("updatefound", function () {
        var w = r.installing;
        if (w) w.addEventListener("statechange", function () { if (w.state === "activated") window.location.reload(); });
      });
    }).catch(function () {});
  });
})();
