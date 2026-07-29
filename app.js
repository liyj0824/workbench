/* 小李的工作台 —— 按完整规格实现，基于「每次改动必保存」的可靠地基 */
(function () {
  "use strict";
  var KEY = "workbench_v2_spec";
  var SEEN_TIPS_KEY = "workbench_seen_tips_v1";
  var AUTO_BACKUP_KEY = "workbench_auto_backup";
  /* 自动备份：每次保存数据时，额外存一份到独立 key，用于检测数据丢失 */
  var _lastBackupHash = "";
  function getDataHash(d) {
    var parts = [];
    if (d.life) {
      parts.push("m" + (d.life.memo ? d.life.memo.length : 0));
      parts.push("w" + (d.life.weight ? d.life.weight.length : 0));
      parts.push("n" + (d.ent && d.ent.novels ? d.ent.novels.length : 0));
      parts.push("p" + (d.life.period && d.life.period.records ? d.life.period.records.length : 0));
      parts.push("a" + (d.life.accounts && d.life.accounts.entries ? d.life.accounts.entries.length : 0));
    }
    return parts.join("-");
  }
  function saveAutoBackup() {
    try {
      var h = getDataHash(Store.data);
      if (h === _lastBackupHash) return; /* 数据没变，不重复写 */
      _lastBackupHash = h;
      var backup = { data: Store.data.dataVersion ? Store.data : clone(Store.data), hash: h, time: new Date().toISOString(), v: 1 };
      /* 只保留最近数据量信息用于比对 */
      backup.meta = { memos: (Store.data.life.memo || []).length, weight: (Store.data.life.weight || []).length, novels: (Store.data.ent && Store.data.ent.novels || []).length };
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
    } catch(e) { console.warn("auto-backup failed", e); }
  }
  function checkDataLossAndRecover() {
    try {
      var raw = localStorage.getItem(AUTO_BACKUP_KEY);
      if (!raw) return false;
      var ab = JSON.parse(raw);
      if (!ab || !ab.meta || !ab.data) return false;
      var curMemos = (Store.data.life.memo || []).length;
      var curWeight = (Store.data.life.weight || []).length;
      var curNovels = (Store.data.ent && Store.data.ent.novels || []).length;
      /* 如果备份里有数据但当前是空的（或接近空），说明可能被重置了 */
      var hadData = (ab.meta.memos > 0 || ab.meta.weight > 0 || ab.meta.novels > 0);
      var nowEmpty = (curMemos <= 0 && curWeight <= 0 && curNovels <= 0);
      if (hadData && nowEmpty) {
        var bt = ab.time || "";
        var timeStr = "";
        try { var td = new Date(bt); timeStr = td.getMonth()+1+"/"+td.getDate()+" "+("0"+td.getHours()).slice(-2)+":"+("0"+td.getMinutes()).slice(-2); } catch(e) { timeStr = bt; }
        var recoverHtml = ''
          + '<h3 style="margin:0 0 8px;color:#b00020;">\u26A0\uFE0F \u68C0\u6D4B\u5230\u6570\u636E\u53EF\u80FD\u88AB\u91CD\u7F6E</h3>'
          + '<p class="hint">\u4F60\u7684\u5DE5\u4F5C\u53F0\u6570\u636E\u4F3C\u4E4E\u88AB\u6E05\u7A7A\u4E86\uFF08\u5907\u5FD8/\u4F53\u91CD/\u5C0F\u8BF4\u5747\u4E3A\u7A7A\uFF09\u3002</p>'
          + '<div style="background:#fff8e1;border-radius:8px;padding:10px 14px;margin:8px 0;font-size:13px;">'
          + '<b>\u81EA\u52A8\u5907\u4EFD\u65F6\u95F4</b>\uFF1A' + timeStr + '<br>'
          + '<b>\u5907\u4EFD\u5185\u5BB9</b>\uFF1A\u5907\u5FD8 ' + ab.meta.memos + ' \u6761 \u00B7 \u4F53\u91CD ' + ab.meta.weight + ' \u6761 \u00B7 \u5C0F\u8BF4 ' + ab.meta.novels + ' \u90E8'
          + '</div>'
          + '<p class="hint" style="font-size:12px;">\u53EF\u80FD\u539F\u56FE\uFF1A\u6D4F\u89C8\u5668\u6E05\u9664\u7F13\u5B58/PWA\u91CD\u65B0\u5B89\u88C5/\u624B\u673A\u7CFB\u7EDF\u5386\u53F2\u6E05\u7406</p>'
          + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="recover-yes" style="margin-right:8px;">\u6062\u590D\u5907\u4EFD</button><button class="mini-btn" id="recover-no">\u7565\u8FC7</button></div>';
        openModal(recoverHtml);
        $("recover-yes").onclick = function () {
          closeModal();
          localStorage.setItem(KEY, JSON.stringify(ab.data));
          Store.load();
          normalizeLifeSelection();
          applyBg(document.body, Store.data.settings.globalBg);
          applyFont();
          applyMemoPriorityColors();
          applyHighlightColor();
          renderBottomNav(); renderHome();
          toast("\u5DF2\u4ECE\u81EA\u52A8\u5907\u4EFD\u6062\u590D\u6570\u636E");
        };
        $("recover-no").onclick = closeModal;
        return true;
      }
    } catch(e) { console.warn("data-loss check failed", e); }
    return false;
  }

  /* ============ 工具 ============ */
  function $(id) { return document.getElementById(id); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function factKey(k) {
    var text = k.text || "";
    if (!text && k.table && k.table.length) {
      text = k.table.map(function (r) { return (r || []).join(" "); }).join(" ");
    }
    return k.cat + "|" + text.slice(0, 60);
  }
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
  /* 未定事件簿风格 —— 圆角方形人物头像 */
  var WEIDING_ICONS = {
    home: "assets/icons/weiding/home.png",
    study: "assets/icons/weiding/study.png",
    ent: "assets/icons/weiding/ent.png",
    life: "assets/icons/weiding/life.png",
    settings: "assets/icons/weiding/settings.png"
  };

  /* ============ 默认数据 ============ */
  function defaultModules() {
    var names = ["言语理解与表达", "数量关系", "判断推理", "资料分析", "常识判断", "申论"];
    var pal = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8"];
    return names.map(function (n, i) {
      return {
        name: n,
        barColor: pal[i],
        phases: [
          { key: "p1", name: "基础学习", color: pal[i] },
          { key: "p2", name: "提升阶段", color: pal[(i + 2) % pal.length] }
        ],
        records: { p1: [], p2: [] },
        fieldLabels: null
      };
    });
  }
  function defaultData() {
    return {
      settings: { iconStyle: "oil", globalBg: null, navColor: "#8fa382", homeBg: null, rainAlert: false, showThumbs: true, fontStyle: "song", hiddenTabs: [], memoPriorityColors: null, highlightColor: "#c8e0db", seenTips: false, quickAddVisible: true, quickAddHiddenBtns: [] },
      customHighlights: {},
      study: {
        categories: [{ name: "公考", modules: defaultModules() }],
        basicTagPool: { subject: [] },
        improveTagPool: { bookName: [] },
        /* 新版：全局标签记忆池（按字段key索引） */
        studyTagPools: {},
        /* 字段模板库 */
        fieldTemplates: [
          {
            name: "\u57FA\u7840\u5B66\u4E60\uFF08\u89C6\u9891\u8BFE\uFF09",
            desc: "\u9002\u5408\u770B\u89C6\u9891\u8BBE\u3001\u7F51\u8BFE",
            fields: [
              { key: "date", type: "date", label: "\u65E5\u671F" },
              { key: "courseName", type: "text", label: "\u8BFE\u7A0B\u540D\u79F0" },
              { key: "lessonNo", type: "number", label: "\u8BFE\u7A0B\u5E8F\u53F7" },
              { key: "note", type: "note", label: "\u7B14\u8BB0" }
            ]
          },
          {
            name: "\u63D0\u5347\u9636\u6BB5\uFF08\u505A\u9898\uFF09",
            desc: "\u9002\u5408\u505A\u8BD5\u5377\u3001\u7EC3\u4E60\u518C",
            fields: [
              { key: "date", type: "date", label: "\u65E5\u671F" },
              { key: "paperName", type: "text", label: "\u8BD5\u5377\u540D\u79F0" },
              { key: "chapterNo", type: "number", label: "\u7AE0\u8282\u5E8F\u53F7" },
              { key: "pageRange", type: "text", label: "\u9875\u7801", memo: false },
              { key: "status", type: "status", label: "\u72B6\u6001", options: ["\u5F85\u6279\u6539", "\u521D\u6B21\u6279\u6539\uFF0C\u672A\u590D\u4E60", "\u5DF2\u590D\u4E60"] },
              { key: "note", type: "note", label: "\u7B14\u8BB0" }
            ]
          },
          {
            name: "\u901A\u7528\u7B80\u5355\u7248",
            desc: "\u53EA\u6709\u65E5\u671F\u3001\u540D\u79F0\u548C\u7B14\u8BB0",
            fields: [
              { key: "date", type: "date", label: "\u65E5\u671F" },
              { key: "itemName", type: "text", label: "\u540D\u79F0" },
              { key: "note", type: "note", label: "\u7B14\u8BB0" }
            ]
          }
        ]
      },
      ent: {
        tagPools: { perspective: ["主攻", "主受", "双视角"], progress: ["正在阅读中", "已读完"], plot: [], author: [] },
        novels: [],
        inspiration: []
      },
      life: {
        order: ["weather", "sleep", "period", "meds", "weight", "memo", "accounts", "wardrobe", "docs", "travel"],
        hidden: [],
        homeVisible: ["weather", "memo"],
        weather: { city: "鞍山市", temp: null, precip: 0, today: null, tomorrow: null },
        sleep: { records: [], remind: "", enabled: false },
        period: { records: [], cycle: 28 },
        meds: [],
        weight: [],
        weightUnit: "jin",
        memo: [],
        accounts: {
          entries: [],
          tags: {
            expense: { online: ["游戏", "零食", "家具用品", "文具"], offline: ["零食", "日用品"] },
            income: { online: ["工资", "零花钱"] }
          }
        },
        wardrobe: { items: [], tags: defaultWardrobeTags() },
        travel: { trips: [], defaultPackTags: defaultTravelPackTags() },
        docs: [],
        cardBg: { weather: null, sleep: null, period: null, meds: null, weight: null, memo: null, accounts: null, wardrobe: null, travel: null, docs: null }
      }
    };
  }
  var LIFE_FEATS = [
    { key: "weather", name: "天气提醒" }, { key: "sleep", name: "睡眠提醒" },
    { key: "period", name: "经期记录" }, { key: "meds", name: "用药提醒" },
    { key: "weight", name: "体重管理" }, { key: "memo", name: "备忘录" },
    { key: "accounts", name: "记账" },
    { key: "wardrobe", name: "穿衣提醒" },
    { key: "docs", name: "证件记录" },
    { key: "travel", name: "旅游计划" }
  ];
  var SEASONS = [["spring", "春"], ["summer", "夏"], ["autumn", "秋"], ["winter", "冬"]];
  var WCATS = [["top", "衣服"], ["pants", "裤子"], ["shoes", "鞋子"], ["acc", "配饰"]];
  function defaultWardrobeTags() {
    return {
      top: { spring: ["衬衫", "卫衣", "毛衣", "风衣", "冲锋衣", "羽绒服"], summer: ["短袖", "防晒服"], autumn: ["毛衣", "冲锋衣", "卫衣"], winter: ["保暖卫衣", "毛衣", "羽绒服"] },
      pants: { spring: ["运动裤"], summer: ["运动裤"], autumn: ["运动裤"], winter: ["运动裤"] },
      shoes: { spring: ["运动鞋"], summer: ["运动鞋"], autumn: ["运动鞋"], winter: ["运动鞋"] },
      acc: { spring: [], summer: [], autumn: [], winter: ["围巾", "手套"] }
    };
  }
  var PACK_CATS = [["documents", "证件类"], ["electronics", "电子设备"], ["clothes", "衣物"], ["toiletries", "洗漱用品"], ["medicine", "药品"], ["others", "其他"]];
  function defaultTravelPackTags() {
    return [
      { name: "身份证", cat: "documents" },
      { name: "手机", cat: "electronics" }, { name: "充电宝", cat: "electronics" }, { name: "耳机", cat: "electronics" }, { name: "数据线及插头", cat: "electronics" },
      { name: "外穿衣服", cat: "clothes" }, { name: "睡衣", cat: "clothes" }, { name: "袜子", cat: "clothes" }, { name: "内衣", cat: "clothes" },
      { name: "洗漱用品", cat: "toiletries" },
      { name: "药品", cat: "medicine" },
      { name: "水杯", cat: "others" }, { name: "随身背包", cat: "others" }, { name: "手纸", cat: "others" }, { name: "伴手礼", cat: "others" }
    ];
  }
  function currentSeason() {
    var m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return "spring";
    if (m >= 6 && m <= 8) return "summer";
    if (m >= 9 && m <= 11) return "autumn";
    return "winter";
  }

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
            if (!this.data.settings.highlightColor) this.data.settings.highlightColor = "#c8e0db";
            if (!this.data.settings.hiddenTabs) this.data.settings.hiddenTabs = [];
            if (!this.data.customHighlights) this.data.customHighlights = {};
            this.data.study = Object.assign(d.study, p.study || {});
            this.data.ent = Object.assign(d.ent, p.ent || {});
            this.data.life = Object.assign(d.life, p.life || {});
            if (!this.data.life.order) this.data.life.order = d.life.order.slice();
            if (!this.data.life.hidden) this.data.life.hidden = [];
            /* 旧数据可能没有 accounts，d.life.accounts 会是 undefined，
               clone(undefined) 会抛错导致后续兼容逻辑中断，因此先兜底。 */
            if (!this.data.life.accounts) this.data.life.accounts = clone(d.life.accounts || defaultData().life.accounts);
            if (!this.data.life.wardrobe) this.data.life.wardrobe = clone(d.life.wardrobe || defaultData().life.wardrobe);
            if (!this.data.life.travel) this.data.life.travel = clone(d.life.travel || defaultData().life.travel);
            if (!this.data.life.docs) this.data.life.docs = [];
            if (!this.data.life.homeVisible) this.data.life.homeVisible = defaultData().life.homeVisible.slice();
            if (!this.data.life.weather) this.data.life.weather = defaultData().life.weather;
            if (!this.data.life.weather.today) this.data.life.weather.today = null;
            if (!this.data.life.weather.tomorrow) this.data.life.weather.tomorrow = null;
            (this.data.life.period.records || []).forEach(function (r) { if (!r.id) r.id = uid(); });
            (this.data.life.weight || []).forEach(function (r) { if (!r.id) r.id = uid(); });
            (this.data.life.memo || []).forEach(function (m) {
              if (!m.id) m.id = uid();
              if (!m.priority) m.priority = "ninu";
              // 旧三档优先级迁移到四象限
              if (m.priority === "urgent") m.priority = "iu";
              else if (m.priority === "important") m.priority = "inu";
              else if (m.priority === "normal") m.priority = "ninu";
              if (!m.items) m.items = [];
            });
            if (!this.data.settings.memoPriorityColors) this.data.settings.memoPriorityColors = defaultMemoPriorityColors();
            // 补全新增的象限颜色键
            var dpc = defaultMemoPriorityColors();
            Object.keys(dpc).forEach(function (k) { if (!self.data.settings.memoPriorityColors[k]) self.data.settings.memoPriorityColors[k] = dpc[k]; });
            applyMemoPriorityColors();
            (this.data.life.travel.trips || []).forEach(function (trip) {
              (trip.days || []).forEach(function (day) {
                // 旧次日交通：time 可能是 datetime-local 的 ISO 字符串，拆成 date + time
                if (day.nextTransfer && day.nextTransfer.time && !day.nextTransfer.date) {
                  var nt = day.nextTransfer;
                  var parts = nt.time.split("T");
                  if (parts.length === 2) { nt.date = parts[0]; nt.time = parts[1]; }
                }
                (day.spots || []).forEach(function (spot) {
                  if (!spot.prevTransport) spot.prevTransport = { type: spot.transferType && spot.transfer ? (spot.transferType || "") : "", info: spot.transport || "", transfer: !!spot.transfer, transferType: "", transferInfo: spot.transferInfo || "" };
                  if (!spot.nextTransport) spot.nextTransport = { type: "", info: "", transfer: false, transferType: "", transferInfo: "" };
                  // 旧字段迁移：hotSpots → note；transferInfo 字符串保留
                  if (spot.hotSpots != null && spot.note == null) spot.note = spot.hotSpots;
                  if (spot.prevTransport.transfer && typeof spot.prevTransport.transferInfo === "string" && !spot.prevTransport.transferType) {
                    spot.prevTransport.transferType = "";
                  }
                  if (spot.nextTransport.transfer && typeof spot.nextTransport.transferInfo === "string" && !spot.nextTransport.transferType) {
                    spot.nextTransport.transferType = "";
                  }
                });
              });
              (trip.laundry || []).forEach(function (it) {
                if (!it.wearDate && it.date) it.wearDate = it.date;
              });
            });
            if (!this.data.life.cardBg) this.data.life.cardBg = {};
            this.data.life.cardBg = Object.assign(d.life.cardBg, this.data.life.cardBg);
            /* 把新增功能默认加入可见列表（兼容旧数据） */
            var defaultOrder = ["weather", "sleep", "period", "meds", "weight", "memo", "accounts", "wardrobe", "docs", "travel"];
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
        saveAutoBackup();
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

  var state = { tab: "home", cat: 0, mod: 0, phase: "basic", entSub: "novel", entFilter: null, entSearch: "", lifeSel: "weather", accFilter: { type: null, channel: null, tag: null }, wardrobeFilter: { season: null, category: null }, travelSel: null, travelSub: "itinerary", spotViewMode: "all" };

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
  function parseHexInput(val) {
    val = (val || "").trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(val)) return null;
    if (val.length === 3) val = val.split("").map(function (c) { return c + c; }).join("");
    return "#" + val.toLowerCase();
  }
  function escapeRegExp(s) { return (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  // %s 占位符填充（用于外链搜索模板；无占位符则原样返回）
  function fillTpl(tpl, q) {
    tpl = tpl || "";
    if (tpl.indexOf("%s") >= 0) return tpl.replace("%s", encodeURIComponent(q));
    return tpl;
  }
  // 按当天日期确定性地取出 n 条，保证“更多”且每天轮换见新词
  function pickByDay(arr, n) {
    var dayIdx = Math.floor(Date.now() / 86400000);
    var out = [];
    for (var i = 0; i < n; i++) out.push(arr[(dayIdx + i) % arr.length]);
    return out;
  }
  function openColorPicker(initial, cb) {
    var hex = (initial || "#a9c4b5").toLowerCase();
    var hsv = hexToHsv(hex);
    var h = hsv[0], s = hsv[1], v = hsv[2];
    openModal('<h3>取色（色相 / 饱和度 / 明度）</h3>' +
      '<div class="picker">' +
      '<div class="hex-row"><span>颜色代码</span><input type="text" id="pk-hex" value="' + hex + '" maxlength="7" placeholder="#a9c4b5"></div>' +
      '<div class="row"><span>色相</span><input type="range" id="pk-h" min="0" max="359" value="' + h + '" style="flex:1"></div>' +
      '<div class="row"><span>饱和</span><input type="range" id="pk-s" min="0" max="100" value="' + s + '" style="flex:1"></div>' +
      '<div class="row"><span>明度</span><input type="range" id="pk-v" min="0" max="100" value="' + v + '" style="flex:1"></div>' +
      '<div class="preview" id="pk-prev"></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="pk-cancel">返回</button><button class="btn-primary" id="pk-ok">确定</button></div></div>');
    function setSlidersFromHex() {
      var parsed = parseHexInput($("pk-hex").value);
      if (!parsed) { $("pk-hex").classList.add("invalid"); return; }
      $("pk-hex").classList.remove("invalid");
      var nhsv = hexToHsv(parsed); h = nhsv[0]; s = nhsv[1]; v = nhsv[2];
      $("pk-h").value = h; $("pk-s").value = s; $("pk-v").value = v;
      updatePreview();
    }
    function updatePreview() {
      var curHex = rgbToHex.apply(null, hsvToRgb(h, s, v));
      $("pk-prev").style.background = curHex;
      $("pk-hex").value = curHex;
      $("pk-hex").classList.remove("invalid");
    }
    ["pk-h", "pk-s", "pk-v"].forEach(function (id) { $(id).addEventListener("input", function () { h = +$("pk-h").value; s = +$("pk-s").value; v = +$("pk-v").value; updatePreview(); }); });
    $("pk-hex").addEventListener("input", setSlidersFromHex);
    $("pk-hex").addEventListener("change", setSlidersFromHex);
    updatePreview();
    $("pk-ok").onclick = function () { closeModal(); cb(rgbToHex.apply(null, hsvToRgb(h, s, v))); };
    $("pk-cancel").onclick = closeModal;
  }
  function openBgPicker(cb) {
    var hex = "#a9c4b5"; var hsv = hexToHsv(hex); var h = hsv[0], s = hsv[1], v = hsv[2];
    openModal('<h3>背景（颜色或图片）</h3>' +
      '<div class="picker">' +
      '<div class="hex-row"><span>颜色代码</span><input type="text" id="pk-hex" value="' + hex + '" maxlength="7" placeholder="#a9c4b5"></div>' +
      '<div class="row"><span>色相</span><input type="range" id="pk-h" min="0" max="359" value="' + h + '" style="flex:1"></div>' +
      '<div class="row"><span>饱和</span><input type="range" id="pk-s" min="0" max="100" value="' + s + '" style="flex:1"></div>' +
      '<div class="row"><span>明度</span><input type="range" id="pk-v" min="0" max="100" value="' + v + '" style="flex:1"></div>' +
      '<div class="preview" id="pk-prev"></div>' +
      '<div class="row"><span>图片</span><input type="file" id="pk-img" accept="image/*"></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="pk-cancel">返回</button><button class="btn-primary" id="pk-ok">确定</button></div></div>');
    var imgData = null;
    $("pk-img").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { imgData = rd.result; }; rd.readAsDataURL(f);
    });
    function setSlidersFromHex() {
      var parsed = parseHexInput($("pk-hex").value);
      if (!parsed) { $("pk-hex").classList.add("invalid"); return; }
      $("pk-hex").classList.remove("invalid");
      var nhsv = hexToHsv(parsed); h = nhsv[0]; s = nhsv[1]; v = nhsv[2];
      $("pk-h").value = h; $("pk-s").value = s; $("pk-v").value = v;
      updatePreview();
    }
    function updatePreview() {
      var curHex = rgbToHex.apply(null, hsvToRgb(h, s, v));
      $("pk-prev").style.background = curHex;
      $("pk-hex").value = curHex;
      $("pk-hex").classList.remove("invalid");
    }
    ["pk-h", "pk-s", "pk-v"].forEach(function (id) { $(id).addEventListener("input", function () { h = +$("pk-h").value; s = +$("pk-s").value; v = +$("pk-v").value; updatePreview(); }); });
    $("pk-hex").addEventListener("input", setSlidersFromHex);
    $("pk-hex").addEventListener("change", setSlidersFromHex);
    updatePreview();
    $("pk-ok").onclick = function () {
      closeModal();
      if (imgData) cb({ type: "image", value: imgData });
      else cb({ type: "color", value: rgbToHex.apply(null, hsvToRgb(h, s, v)) });
    };
    $("pk-cancel").onclick = closeModal;
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
  function openCustomHlModal(key, currentHl, onSave) {
    var html = '<div class="modal-title">自定义高亮 / 遮罩词</div>' +
      '<div style="margin:10px 0 14px;font-size:14px;color:var(--ink);line-height:1.55;">输入要高亮的关键词，用逗号、顿号或空格分隔；留空则恢复默认高亮。</div>' +
      '<input id="hl-edit-input" type="text" value="' + esc((currentHl || []).join("，")) + '" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(123,154,115,.35);background:var(--cream);color:var(--ink);font-size:15px;font-family:inherit;outline:none;">' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
      '<button id="hl-edit-cancel" class="mini-btn">取消</button>' +
      '<button id="hl-edit-save" class="mini-btn" style="background:var(--green-deep);color:#fff;">保存</button>' +
      '</div>';
    openModal(html);
    $("hl-edit-cancel").onclick = closeModal;
    $("hl-edit-save").onclick = function () {
      var v = $("hl-edit-input").value.trim();
      var arr = v ? v.split(/[,\s，、]+/).filter(function (x) { return x; }) : [];
      closeModal(); onSave(arr);
    };
  }

  /* ============ 日期工具 ============ */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtYMD(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseYMD(s) { var p = String(s).split("-"); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function ymdCmp(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function dayDiff(a, b) { var pa = parseYMD(a), pb = parseYMD(b); return Math.round((new Date(pb.y, pb.m, pb.d).getTime() - new Date(pa.y, pa.m, pa.d).getTime()) / 86400000); }
  function addDays(ymd, n) { var p = parseYMD(ymd); var d = new Date(p.y, p.m, p.d); d.setDate(d.getDate() + n); return fmtYMD(d); }
  function todayStr() { return fmtYMD(new Date()); }
  function formatChineseDate(ymd) { var p = parseYMD(ymd); return p.m + 1 + "月" + p.d + "日"; }
  function parseDateFromText(text, base) {
    base = base || todayStr();
    var t = String(text || "").trim();
    if (!t) return null;
    var rel = { "今天": 0, "明天": 1, "后天": 2, "大后天": 3 };
    for (var k in rel) { if (t.indexOf(k) >= 0) return addDays(base, rel[k]); }
    var m1 = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
    if (m1) { var cy = new Date().getFullYear(); return pad2(cy) + "-" + pad2(+m1[1]) + "-" + pad2(+m1[2]); }
    return null;
  }

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
        (function (dateStr) {
          if (mode === "single") {
            if (dateStr === selStart) cell.classList.add("sel");
            cell.onclick = function () { closeCal(); opts.onConfirm && opts.onConfirm(dateStr); };
          } else {
            if (dateStr === selStart) cell.classList.add("rstart");
            if (dateStr === selEnd && selEnd !== selStart) cell.classList.add("rend");
            if (selStart && selEnd && ymdCmp(dateStr, selStart) >= 0 && ymdCmp(dateStr, selEnd) <= 0) cell.classList.add("inrange");
            cell.onclick = function () { onRangeClick(dateStr); };
          }
        })(ds);
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
      var topbar = document.createElement("div"); topbar.className = "cal-topbar";
      var back = document.createElement("button"); back.className = "cal-back"; back.textContent = "返回";
      back.onclick = function () { closeCal(); };
      topbar.appendChild(back); wrap.appendChild(topbar);
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

  /* ============ 时间选择器（与日历统一风格，带返回） ============ */
  function openTimePicker(opts) {
    opts = opts || {};
    var value = opts.value || "";
    var parts = String(value).split(":"); var h = parts[0] || ""; var m = parts[1] || "";
    var selH = h && /^\d{1,2}$/.test(h) ? pad2(parseInt(h, 10) % 24) : "22";
    var selM = m && /^\d{1,2}$/.test(m) ? pad2(parseInt(m, 10) % 60) : "30";
    var overlay = document.createElement("div"); overlay.className = "cal-overlay";
    var panel = document.createElement("div"); panel.className = "cal-modal time-modal";
    function render() {
      panel.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "cal-picker";
      var topbar = document.createElement("div"); topbar.className = "cal-topbar";
      var back = document.createElement("button"); back.className = "cal-back"; back.textContent = "返回";
      back.onclick = function () { closeTp(); };
      topbar.appendChild(back); wrap.appendChild(topbar);
      var tip = document.createElement("div"); tip.className = "cal-tip"; tip.textContent = "选择提醒时间";
      wrap.appendChild(tip);
      var row = document.createElement("div"); row.className = "time-pick-row";
      var hs = document.createElement("select"); hs.className = "time-select"; hs.id = "tp-h";
      for (var i = 0; i < 24; i++) { var o = document.createElement("option"); o.value = pad2(i); o.textContent = pad2(i); if (pad2(i) === selH) o.selected = true; hs.appendChild(o); }
      var sep = document.createElement("span"); sep.className = "time-sep"; sep.textContent = ":";
      var ms = document.createElement("select"); ms.className = "time-select"; ms.id = "tp-m";
      for (var j = 0; j < 60; j += 5) { var o2 = document.createElement("option"); o2.value = pad2(j); o2.textContent = pad2(j); if (pad2(j) === selM) o2.selected = true; ms.appendChild(o2); }
      row.appendChild(hs); row.appendChild(sep); row.appendChild(ms); wrap.appendChild(row);
      var bar = document.createElement("div"); bar.className = "cal-bar";
      var ok = document.createElement("button"); ok.className = "btn-primary"; ok.textContent = "确定";
      ok.onclick = function () { var v = hs.value + ":" + ms.value; closeTp(); opts.onConfirm && opts.onConfirm(v); };
      bar.appendChild(ok); wrap.appendChild(bar);
      panel.appendChild(wrap);
    }
    overlay.appendChild(panel); document.body.appendChild(overlay);
    overlay.onclick = function (e) { if (e.target === overlay) closeTp(); };
    function closeTp() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
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
      /* 标题行 */
      var titleRow = document.createElement("div");
      titleRow.style.cssText = "font-size:11px;color:#8a887d;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;";
      titleRow.innerHTML = '<span>\u5DF2\u5B58\u6807\u7B7E (' + pool.length + ')</span>';
      cand.appendChild(titleRow);
      pool.forEach(function (t, ti) {
        if (selected.indexOf(t) >= 0) return;
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:4px;margin:2px 0;";
        /* 点选按钮 */
        var p = document.createElement("span"); p.className = "tagpill"; p.style.cursor = "pointer"; p.style.opacity = ".8"; p.textContent = "+ " + t;
        p.onclick = function () { if (selected.indexOf(t) < 0) selected.push(t); Store.save(); createTagControl(container, pool, selected, opts); };
        row.appendChild(p);
        /* 改名按钮 */
        var renBtn = document.createElement("button");
        renBtn.className = "mini-btn"; renBtn.textContent = "\u6539"; renBtn.title = "\u4FEE\u6539\u6807\u7B7E\u540D";
        renBtn.style.cssText = "padding:1px 6px;font-size:11px;line-height:1;";
        renBtn.onclick = function (e) { e.stopPropagation();
          var newName = prompt("\u4FEE\u6539\u6807\u7B7E\u300C" + t + "\u300D\u4E3A\uFF1A", t);
          if (newName && newName.trim() && newName.trim() !== t) {
            var nn = newName.trim();
            /* 更新池中 */
            pool[ti] = nn;
            /* 更新已选中同名的 */
            for (var si = 0; si < selected.length; si++) {
              if (selected[si] === t) selected[si] = nn;
            }
            Store.save(); createTagControl(container, pool, selected, opts);
          }
        };
        row.appendChild(renBtn);
        /* 删除按钮 */
        var delBtn = document.createElement("button");
        delBtn.className = "mini-btn danger"; delBtn.textContent = "\u5220"; delBtn.title = "\u5220\u9664\u6807\u7B7E";
        delBtn.style.cssText = "padding:1px 6px;font-size:11px;line-height:1;";
        delBtn.onclick = function (e) { e.stopPropagation();
          if (!confirm("\u786E\u8BA4\u5220\u9664\u6807\u7B7E\u300C" + t + "\u300D\uFF1F")) return;
          pool.splice(ti, 1);
          Store.save(); createTagControl(container, pool, selected, opts);
        };
        row.appendChild(delBtn);
        cand.appendChild(row);
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
  var CUTE_QUOTES = [
    { text: "再见和日落都是未完待续。", explain: "今天结束的地方，是明天的开头呀。" },
    { text: "做无名小花，做快乐小狗。", explain: "不用当主角，当个开心的小角色也很好。" },
    { text: "人生缓缓，自有答案。", explain: "别急，慢慢走，该亮的灯会一盏盏亮起来。" },
    { text: "今天也要做一颗软乎乎的甜豆。", explain: "软一点，甜一点，世界就软一点。" },
    { text: "心里装着小星星，日子就不会太暗。", explain: "哪怕一点点光，也够照亮脚下。" },
    { text: "慢慢来，比较快。", explain: "喘口气，反而走得更远。" },
    { text: "把烦恼叠成纸船，放它去远方。", explain: "有些事，交给河流就好。" },
    { text: "你已经做得很好啦，真的。", explain: "这句是专门说给你听的。" },
    { text: "风很温柔，你也是。", explain: "今天的风都在替我夸你。" },
    { text: "生活明朗，万物可爱。", explain: "睁开眼，就是新的小确幸。" },
    { text: "小小的我，也有大大的快乐。", explain: "快乐不按个头算。" },
    { text: "抬头看云，低头种花，都很浪漫。", explain: "认真生活的人，自带滤镜。" },
    { text: "今天的快乐是充电宝，先充满再说。", explain: "照顾好自己，才有力气奔赴。" },
    { text: "就算是一朵小乌云，也会下雨给大家看彩虹。", explain: "你也有自己的温柔本事。" },
    { text: "把日子过成软绵绵的棉花糖。", explain: "甜而不腻，刚刚好。" },
    { text: "走累了的星星，就回家休息一下吧。", explain: "累了不是错，歇歇再发光。" },
    { text: "世界很吵，但你可以做自己的轻音乐。", explain: "按自己的节奏，哼给自己听。" },
    { text: "兜里揣着糖和好心情出门啦。", explain: "今天也要甜甜地过。" }
  ];

  var IDIOMS = [
    { word: "源远流长", explain: "源头远，水流长。也比喻历史悠久。" },
    { word: "连绵不绝", explain: "意思是连续而不中断。" },
    { word: "博大精深", explain: "博大：广大。精深：精湛深刻。形容学识、思想、理论广博丰富，精湛 深刻" },
    { word: "历久弥新", explain: "弥：更加。指经历长久的时间而更加鲜活，更加有活力，更显价值。" },
    { word: "兼容并蓄", explain: "并：一起。蓄：积聚，储存。对不同的人或事物都能同时收容保留。" },
    { word: "一脉相承", explain: "一脉：指一个血统或一个派系。相承：相续传承。由一个血统或一个派 别世代相传承袭下来。比喻人或事物间的传承关系。也作“一脉相传 ““ 一脉相通”。" },
    { word: "血脉相通", explain: "血脉：血统。原指有血缘亲属关系。也比喻极亲近的关系。" },
    { word: "薪火相传", explain: "意思是比喻学问和技艺代代相传。比喻师生授受不绝，或种族、血统、 文化精神的传承，绵延不尽。" },
    { word: "不绝如缕", explain: "绝：断。缕：细线。像一根细线那样，似断非断。也作“不绝若线”。 比喻情势危急。" },
    { word: "陈陈相因", explain: "粮仓里的米谷一年接一年地堆积起来。比喻沿袭老一套，没有改进。" },
    { word: "口耳相传", explain: "口说耳听，递相传授。" },
    { word: "难以为继", explain: "难以继续下去。" },
    { word: "后继无人", explain: "继：继续，继承。没有继承的人。形容事业缺少接班人。" },
    { word: "继往开来", explain: "继承前人的事业，开辟未来的道路。" },
    { word: "承上启下", explain: "接续上面的，引起下面的。也指诗文中连接沟通文字的字句，使文字自 然过渡。" },
    { word: "推陈出新", explain: "推去旧的，产生新的。后多指在文化艺术方面去掉旧的糟粕，吸取其精 华，创造出新的来。(多形容文化但不绝对)" },
    { word: "吐故纳新", explain: "纳：使进入，吸入。道家的养生术，吐出浊气，吸进新鲜空气。后多比 喻扬弃旧的，吸收新的。(多形容事物在发展中呈现新的面貌)" },
    { word: "革故鼎新", explain: "革：除去。鼎新：立新。指革除旧的，建立新的。多指改朝换代或重大 变 革 。(多政治角度)" },
    { word: "弃旧图新", explain: "意思是抛弃旧的，谋求新的。多指由坏的转向好的，离开错误的道路走 向正确的道路。" },
    { word: "去芜存菁", explain: "意思是除去杂质、保留精华。" },
    { word: "除旧布新", explain: "意思是清除旧的，建立新的；以新的代替旧的。" },
    { word: "激浊扬清", explain: "强调通过主动干预清除负面因素并弘扬正面价值，侧重点在于“激”与 “扬”的联动作用，既包含对浑浊、消极现象的批判与清除，又包含对 清澈、积极价值的彰显与推广。" },
    { word: "去伪存真", explain: "“去伪”:排除虚假、伪装的事物；“存真”:保留真实、真正的事物 。是指去除虚假、保留真实，常用于形容辨别真伪、保持真实的态度或 行为。" },
    { word: "另辟蹊径", explain: "意思是另外开辟一条路。比喻另创一种风格或方法。" },
    { word: "标新立异", explain: "标：表明。异：独特，与众不同。原意为表明新颖的义理，提出与众不 同的见解。后指故意提出新奇的见解，表示自己与众不同。(主观上故 意性；辨析感情色彩)" },
    { word: "与时俱进", explain: "时：时间。俱：一起，一同。进：前进。与时间一起前进。指不断进 取，永不停滞。" },
    { word: "剑走偏锋", explain: "指不走常规，找一些新的、不同以往的办法来解决问题，以求出奇制胜 " },
    { word: "不拘一格", explain: "不拘一格指不拘泥于一种规格、方式，比喻打破常规。" },
    { word: "别具一格", explain: "是指具有独特的风格，与众不同，常用于文学、艺术、书法等领域。" },
    { word: "空前绝后", explain: "是指从前没有过，今后也不会再有，形容独一无二或非凡的成就。" },
    { word: "举世无双", explain: "全世界再没有第二个，形容极为稀有或优秀的人或物。" },
    { word: "匠心独运", explain: "匠心：精巧的心思。具有独到的创造性。多指文学艺术的创作构思。同 “独具匠心”“匠心独运”。(侧重文艺创作的心思巧妙)" },
    { word: "别出心裁", explain: "心裁：内心的决断。另外想出与众不同的办法、主意。也作“独出心裁 “。 (侧重想法构思巧妙)" },
    { word: "异想天开", explain: "异：奇异、奇特。天开：凭空、根本不存在的事情。意思是想法非常离 奇、荒唐，暂时难以实现，也可指超强的想象力。" },
    { word: "独树一帜", explain: "单独树起一面旗帜。比喻创造独特风格，自成一家。同“别树一帜”。 (侧重风格)" },
    { word: "自成一家", explain: "意思是指在某一方面的学问或技术有独到的见解或独特的做法，能自成 体系。" },
    { word: "别开生面", explain: "比喻另外开创新的局面或新的形式。" },
    { word: "不落窠臼", explain: "意为不落俗套，有独创风格(多用于形容文章或艺术作品)。" },
    { word: "特立独行", explain: "“特”:独特；“立”:立身，整体表达了坚守自我、独立行事的意思 。是指形容人的志行高洁、行为独特，不随俗、不随波逐流，强调与众 不同的品格和独立精神。" },
    { word: "墨守成规", explain: "形容因循守旧，不肯改变。" },
    { word: "抱残守缺", explain: "残、缺：不完整。①固守陈旧残缺的东西不放，形容保守，不知改进。 ②保存虽有残缺但仍有价值的古物。" },
    { word: "因循守旧", explain: "因循：沿用旧办法。指一直沿用旧办法而不加改变。(侧重新与旧)" },
    { word: "固步自封", explain: "封：限制在一定的范围内。比喻因循守旧，安于现状，不求创新进取。 (侧重开放与封闭)" },
    { word: "食古不化", explain: "意思是读书、作画一味学习古人，拘泥陈法，不善于灵活运用。指对所 学的古代知识理解得不透，不善于按现在的情况来运用。" },
    { word: "泥古不化", explain: "“泥”:表示拘泥、固执；“不化”:强调缺乏灵活性和变通能力。是 指固执地拘泥于古代的制度、成规或古人的说法，而不根据具体情况加 以变通。" },
    { word: "按部就班", explain: "部：类别。班：次序。原指写文章按类别安排文义，按顺序组织文辞。 后指按照一定的次序或部置进行。(中性词)" },
    { word: "循规蹈矩", explain: "循：依照。规：圆规。蹈：踩。矩：曲尺。规、矩是定方圆的标准规 则，借指行为的准则。原指遵守规矩，不敢违反。后指拘守旧准则，不 敢稍作变动。(中性词)" },
    { word: "照本宣科", explain: "原指照着书本或讲稿逐字宣读。引申为机械执行既定规则或文本内容， 完全依赖书面指示而缺乏实际调整，批评其缺乏创造性。" },
    { word: "循序渐进", explain: "循：顺，按照。序：次序。指事物的发展或学习工作等按照一定的步骤 逐渐深入或提高。" },
    { word: "有条不紊", explain: "条：条理。紊：乱。形容办事很有条理。" },
    { word: "望而却步", explain: "却步：不敢前进，往后退。形容遇到危险、困难或力所不及的事就往后 退 缩 。(侧重行为上的退却，多因为害怕、惊讶、震撼、犹豫、顾虑 等 )" },
    { word: "望而生畏", explain: "指看见了就害怕。(侧重情绪上的害怕)" },
    { word: "畏蕙不前", explain: "畏惧退缩，不敢前进。" },
    { word: "停滞不前", explain: "意指事物因受阻而停止发展或无法继续前进 ，多用于描述事物发展进程 的中断状态。" },
    { word: "骑虎难下", explain: "骑在虎背上难以下来。比喻事情遇到困难，迫于形势不能中止，陷入进 退两难的境地。(侧重同一件事已经开始了就难以停止)" },
    { word: "进退维谷", explain: "谷：困窘。指前进或后退都处于困难境地。形容进退两难。同“进退两 难”“进退失据”。(侧重很难抉择)" },
    { word: "进退失据", explain: "同“进退失据”“进退两难”。" },
    { word: "瞻前顾后", explain: "多用于形容顾虑太多，犹豫不决。" },
    { word: "踟蹰不前", explain: "意思为迟疑不决，不敢前进。" },
    { word: "裹足不前", explain: "比喻因心存顾虑而停止行动或不敢向前，与踟蹰不前相比停滞程度更彻 底，暗示难以突破。" },
    { word: "举步维艰", explain: "抬脚行走十分困难。形容已陷入十分艰难的处境。" },
    { word: "寸步难行", explain: "寸步：很短的距离。一步也难以行走。形容行走十分困难。也形容陷入 困难境地，无法进行活动。(程度较重)" },
    { word: "大海捞针", explain: "是指在大海里捞一根针，形象地描绘了目标极小而范围极大的情境，比 喻事情极难找到或完成，就像在大海里捞一根针一样。" },
    { word: "岌岌可危", explain: "岌岌：山高陡峭，就要倒下的样子。形容非常危险，快要倾覆或灭亡" },
    { word: "危如累卵", explain: "比喻形势非常危险，如同堆起来的蛋，随时都有塌下打碎的可能。" },
    { word: "命悬一线", explain: "处境危险，随时可能丧失生命。" },
    { word: "风雨飘摇", explain: "飘摇：飘荡。在风雨中飘荡不定。比喻局势动荡不安，很不稳定。" },
    { word: "孤注一掷", explain: "孤注：指孤单的一次投入或押注；一掷：指一次投掷或行动。比喻把所 有的力量、财物或希望都投入到一次行动中，冒极大风险以求成功。常 用于形容在绝境中采取最后的努力或赌博式的决策。" },
    { word: "铤而走险", explain: "铤：快跑的样子；走险：奔赴险地。指在走投无路或面临困境时，采取 冒险行为。" },
    { word: "背水一战", explain: "原意指背靠临近河水之地摆阵，或布下阵势，后来指处于绝境之中，为 求出路而决一死战。多用于军事行动，也可用于比喻有“决战”性质的 行动，含褒义。" },
    { word: "千钧一发", explain: "指千钧重物悬挂在一根头发上，形象地描绘了极度危险的情境，强调事 情的紧迫性和后果的严重性，常用来比喻万分危急或异常要紧的情况。" },
    { word: "首当其冲", explain: "首：指头部或最前面。当：有承受之意。冲：指要冲或冲击的意思。比 喻首先承受冲击、攻击或灾难，常用于形容在某种事件或情况下最先受 到影响的人或事物。" },
    { word: "危在旦夕", explain: "旦夕：早晨和晚上，形容时间短。形容危险就在眼前。" },
    { word: "迫在眉睫", explain: "形容事情已逼近眼前，形势十分紧急。" },
    { word: "刻不容缓", explain: "刻：指短暂的时间；缓：延迟。指形势紧迫，一刻也不允许拖延。" },
    { word: "层出不穷", explain: "层出：接连出现。穷：尽。接连出现，没有穷尽。(主语是事物)" },
    { word: "风起云涌", explain: "形容雄浑磅礴之势；也比喻事物迅速发展，声势浩大。" },
    { word: "方兴未艾", explain: "意思是事物正在发展，尚未达到止境。" },
    { word: "雨后春笋", explain: "春天下雨后竹笋长得又多又快，比喻新生事物大量涌现和蓬勃发展。 (侧重数量多)" },
    { word: "横空出世", explain: "形容人或物高大，横在空中，浮出人世，或比喻卓尔不群。(侧重突出 、明显)" },
    { word: "异军突起", explain: "异军：另一支军队。比喻一支新生力量突然崛起。(侧重新生事物)" },
    { word: "应运而生", explain: "应运：应天命。指顺应天命而降生。后泛指顺应时机而产生。" },
    { word: "落地生根", explain: "字面意思指植物落到地面上便扎根生长，引申义表示某人或某事在一个 地方稳定下来，生根发芽，形容生活、工作或事业的稳定发展。" },
    { word: "高歌猛进", explain: "意思是高声歌唱，勇猛前进；形容在前进的道路上，充满乐观精神。" },
    { word: "如火如荼", explain: "原比喻军容之盛，现在形容旺盛、热烈或激烈。" },
    { word: "如日中天", explain: "像太阳正运行到正午。比喻正发展到最兴盛的阶段。" },
    { word: "势如破竹", explain: "势：形势。破竹：劈开竹子。形势如同劈竹子一样，劈开头上几节，下 面各节就顺着刀口裂开了。后用来形容节节胜利，毫无阻碍。" },
    { word: "突飞猛进", explain: "形容发展十分迅速。" },
    { word: "日臻完善", explain: "意指一天天逐步达到完美的境地，用于描述事物在持续改进中趋于完善 0" },
    { word: "枝繁叶茂", explain: "本义是指树木枝条繁多、绿叶茂密的自然生长状态，引申为比喻家族兴 旺或事业繁荣。" },
    { word: "势不可挡", explain: "形容事物或力量的发展趋势非常强劲，无法阻挡，常用于描述某种强大 的力量或趋势，表示其来势迅猛，无法抵挡。" },
    { word: "一日千里", explain: "一天跑一千里。也比喻进步、发展很快。" },
    { word: "日新月异", explain: "形容发展变化很快，新事物、新气象不断出现。" },
    { word: "与日俱增", explain: "指随着时间的推移不断增长。" },
    { word: "愈演愈烈", explain: "形容某种事件、矛盾或情况随着时间发展而越加严重或恶化，通常用于 负面情境，表达一种不良或不可控的发展趋势。" },
    { word: "日渐式微", explain: "事物逐渐地由兴盛而衰落。" },
    { word: "每况愈下", explain: "指情况越来越坏，越来越糟糕。(也可形容身体或精神越来越糟糕)" },
    { word: "江河日下", explain: "长江大河的水，日夜流向下游而不止。比喻事物日趋衰落，情况一天不 如 一 天 。(多指国势等事物发展趋势)" },
    { word: "水涨船高", explain: "水位上涨，船体也随着上升。比喻事物随着它所凭借的基础而增长。" },
    { word: "此消彼长", explain: "指这个下降，那个上升。" },
    { word: "波澜壮阔", explain: "原形容水面辽阔，现比喻声势雄壮或规模宏大。" },
    { word: "柳暗花明", explain: "垂柳浓密，鲜花夺目。形容柳树成荫，繁花似锦的春天景象。也比喻在 困难中遇到转机。" },
    { word: "拨云见日", explain: "拨开乌云见到太阳。比喻冲破黑暗见到光明。也比喻疑团消除，心里顿 时明白。" },
    { word: "浩浩荡荡", explain: "原意指水势汹涌广阔，后引申为事物规模宏大、气势磅礴，也可形容人 流或群体活动声势浩大。" },
    { word: "汹涌澎湃", explain: "“汹涌”表示水流奔腾、波涛翻滚的样子；“澎湃”表示水声或声势浩 大。形容水势或声势非常猛烈、浩大，也比喻感情、力量或气势强烈、 不可阻挡。" },
    { word: "大气磅礴", explain: "“大气”指盛大宏伟的气势，“磅礴”意为广大无边的样子。形容气势 浩大、雄伟壮观，常用于描写景象、场面或文艺作品的宏大气势。" },
    { word: "气壮山河", explain: "形容气势如高山大河般雄壮豪迈，使祖国山河因而更加壮丽。" },
    { word: "峰回路转", explain: "原指山势曲折致道路迂回，后多比喻事情经历挫折或低谷后出现转机或 变化。" },
    { word: "相形见绌", explain: "形：对照，比较。绌：不够，不足。跟同类的人或同类事物相比较，显 出很不足。" },
    { word: "出类拔萃", explain: "出：超出。类：同类。拔：高出。萃：指聚在一起的人或物。指人的品 德才能出众，高出同类之上。(侧重能力或品德)(高于同类)" },
    { word: "无与伦比", explain: "意思是指事物非常完美，没有能够与它相比的同类的东西。" },
    { word: "先发制人", explain: "发：发动；制：控制。原指在战争中的双方，先采取行动的往往处于主 动地位，可以制伏对方。后来泛指先下手采取行动。" },
    { word: "百舸争流", explain: "舸：大船。上百条大船争着向前行驶。形容竞争激烈，人人都奋勇争先" },
    { word: "干帆竞发", explain: "竞：竞赛。数不清的船只争相出发。形容竞争激烈，也形容事物蓬勃发 展、气势磅礴。" },
    { word: "争先恐后", explain: "争着向前，唯恐落后。形容竞争激烈，人人都不甘落后。" },
    { word: "大浪淘沙", explain: "淘：用水冲洗，去掉杂质。在大浪中洗净沙石。比喻经过激烈的竞争或 时代变迁的筛选，淘汰不好的，留下好的。侧重在“经历改变而完成筛 选”。" },
    { word: "无出其右", explain: "右：古时以右边为上位，古人写字从右往左竖写，右则在前。指无人能 战胜或超过。" },
    { word: "脱颖而出", explain: "颖：细长物体的尖端。比喻才能完全显露出来。(侧重能力)(明显 地)" },
    { word: "崭露头角", explain: "崭：高出。比喻突出地显露出才能。(侧重能力)" },
    { word: "鹤立鸡群", explain: "鹤站在鸡群中间。比喻仪表或才能在人群中显得很突出。" },
    { word: "独占鳌头", explain: "鳌头：古代宫殿门前台阶上的鳌鱼浮雕，科举进士发榜时状元站在鳌头 之上迎榜。原指科举考试中了状元，后比喻在某个领域或竞争中位列首 位或第一名。" },
    { word: "一枝独秀", explain: "指一枝花独自开放，比喻在同类人或同类事物中出类拔萃。" },
    { word: "望其项背", explain: "项：脖子的后部。能够看到别人的颈项和脊背。比喻有能力赶得上。 (常用于否定句：难以~、无法~、不能~)" },
    { word: "望尘莫及", explain: "莫：不能。及：到，赶上。指望见前面人马扬起的尘土而追赶不上。比 喻远远落在后面，相差甚远。也用以表示自谦。" },
    { word: "相提并论", explain: "把不同的人或不同的事情放在一起谈论或看待。(侧重于评价几个人或 事物之间有没有差距/能否比得上。多用于否定句中)" },
    { word: "同日而语", explain: "指相提并论。(侧重于强调时间上的对比，多形容与自身的比较。现有 时也有例外)(多用于否定句中)" },
    { word: "等量齐观", explain: "等：同等。齐：一样。把不同的事物一律同等看待。" },
    { word: "一概而论", explain: "用同一标准来对待或处理(多用于否定):不能～。" },
    { word: "一视同仁", explain: "原指圣人对百姓一样看待，同施仁爱。后多表示对人同样看待，不分厚 薄。" },
    { word: "不偏不倚", explain: "偏：偏向；倚：歪斜。不偏向任何一方，保持中立、公正。形容态度或 立场公正，没有偏向。" },
    { word: "力有未逮", explain: "指有意愿却做不到。" },
    { word: "爱莫能助", explain: "爱：爱惜；莫：不。虽然心中关切同情，却没有力量帮助。" },
    { word: "鞭长莫及", explain: "及：到。原意是鞭子虽长，也不能打马肚子。比喻相隔太远，力量达不 到。(有时会用于形容“虽有能力，但能力有限”)" },
    { word: "望洋兴叹", explain: "望洋：仰视的样子。仰望海神而兴叹。原指在伟大事物面前感叹自己的 渺小。现多比喻做事时因力不胜任或没有条件而感到无可奈何。" },
    { word: "回天乏术", explain: "回天：比喻力量大，能移转极难挽回的时势；乏术：缺少方法。比喻局 势或病情严重，已无法挽救。" },
    { word: "力不从心", explain: "心里很想做某事，但能力、体力或条件达不到，做不到。" },
    { word: "杯水车薪", explain: "原义是用一杯水去扑灭一车燃烧的柴草；比喻力量太小，无法解决问题 。" },
    { word: "捉襟见肘", explain: "捉襟：整理衣襟。肘：胳膊肘儿。形容衣裳破旧。也比喻困难很多，应 付不过来。(侧重人力、物力等资源有限)" },
    { word: "顾此失彼", explain: "顾了这个，丢了那个。形容忙乱或慌张的情景。(侧重考虑不周全)" },
    { word: "左支右绌", explain: "支：支持；绌：屈曲，引申为不足。原指弯弓射箭的姿势，左手支持， 右手屈曲。指力量不足，应付了这方面，那方面又出了问题。(侧重能 力有限，应付不过来)" },
    { word: "独木难支", explain: "一根木头支不住高大的房子。比喻一个人的力量单薄，维持不住全局。" },
    { word: "应接不暇", explain: "暇：空闲。原指景物很多，顾不上观赏。后形容太繁忙，应付不过来。 (主语是人)(侧重人或事物太多忙不过来)" },
    { word: "自顾不暇", explain: "自顾：顾及自己；不暇：没有空闲、来不及。连自己都照顾、应付不过 来，没有多余精力去管别人的事。" },
    { word: "分身乏术", explain: "没法分出精力同时做几件事，忙不过来、顾此失彼、没有多余精力。" },
    { word: "浮光掠影", explain: "浮光：水面上的反光。掠影：一闪而过的影子。比喻因事物很快消逝而 使人对它的印象不深。(侧重抽象语境)" },
    { word: "走马观花", explain: "走马：骑马快跑。比喻观察事物或者了解情况不深入细致。(侧重于用 眼看具体事物的过程)(一般不形容读书)" },
    { word: "蜻蜓点水", explain: "比喻进行某些动作时只轻轻接触表面。也比喻肤浅不深入。" },
    { word: "浅尝辄止", explain: "辄：立即，就。只略微尝试一下就停止。比喻做事不求深入。(侧重停 止 )" },
    { word: "囫囵吞枣", explain: "囫囵：整个的。把枣子整个吞下。比喻笼统地接受，不加分析、甄别， 不求甚解。" },
    { word: "不求甚解", explain: "甚：很，极。原指读书只领会要旨，不必在一字一句上下功夫。后指只 求懂个大概，不去深入理会。" },
    { word: "举一反三", explain: "反：类推，推论。指举出一件事，就可以触类旁通，类推出许多同类事 物 来 。(侧重于具象的事物层面。)(侧重类推)" },
    { word: "融会贯通", explain: "融会：融合。贯通：全面透彻地了解。指把各方面的知识、道理融合贯 穿，从而获得对事物全面、透彻地理解和领悟。(侧重融合)" },
    { word: "触类旁通", explain: "触：接触。通：通晓。指掌握了某一事物的规律或知识，就能够以此类 推，了解同类的其他事物。(侧重于抽象的思维层面。)(侧重类推)" },
    { word: "相辅相成", explain: "辅：辅助，帮助。指两种事物互相辅助，互相促成，缺 一 不可。" },
    { word: "相得益彰", explain: "相得：互相投合。益：更加。彰：明显。两个人或两件事相互配合，双 方的能力和作用更能显示出来。" },
    { word: "锦上添花", explain: "指在有彩色花纹的丝织品上再绣上花朵。比喻美上加美，喜上加喜。" },
    { word: "珠联璧合", explain: "珠联：像珍珠一样串在一起。璧合：像碧玉一样合在一起。原指一种日 月重合、五星相联的天相。后多比喻美好的人及事物凑在一起。同“珠 连璧合”。(侧重结合)" },
    { word: "互为表里", explain: "甲为乙的外表，乙为甲的内里；比喻互相依存，互相接受。" },
    { word: "交相辉映", explain: "各种光亮、色彩相互照耀、映射。常用语形容美好的景象。" },
    { word: "相映成趣", explain: "映：映衬。趣：意趣。相互衬托着，显得很有情趣，很有意思。" },
    { word: "双峰并峙", explain: "意思通常指的是两座高大的山峰彼此对立地耸立着。这个成语不仅用来 形容自然界的景观，也常用于比喻在某一领域或文化上同时达到极高成 就的两个人物或事物。" },
    { word: "并行不悖", explain: "悖：违反，违背。指同时进行而互相不违背。" },
    { word: "齐头并进", explain: "指几方面同时前进。" },
    { word: "双管齐下", explain: "管：笔管。比喻一件事同时采用两种办法或两件事同时进行。" },
    { word: "并驾齐驱", explain: "并驾：几匹马并排在一起拉车。齐驱：共同快跑。比喻相互之间不相上 下。" },
    { word: "本末倒置", explain: "本：树根。末：树梢。比喻把事情的轻重主次颠倒了过来。" },
    { word: "舍本逐末", explain: "舍：放弃。本：根本。逐：追求。末：枝节。比喻放弃根本，追求末 节，轻重主次倒置。" },
    { word: "喧宾夺主", explain: "喧：吵吵嚷嚷。客人的声音压倒了主人的声音。比喻外来的或次要的事 物占据了原有的或主要的事物的位置。" },
    { word: "因小失大", explain: "因：为了。指为了小的利益造成大的损失。" },
    { word: "因噎废食", explain: "废：停止。比喻因为碰到挫折，连该做的事情也不做了。" },
    { word: "非此即彼", explain: "不是这个，就是那个。指在两者之间必选其一，不容许中间状态存在。" },
    { word: "背道而驰", explain: "背：逆着。道：道路。向着相反的道路奔驰。比喻彼此方向目标完全相 反。也比喻背离正确的目标，朝相反的方向走。" },
    { word: "南辕北辙", explain: "辕：车辕，车前驾牲口的直木。辙：车轮经过留下的痕迹。本要往南边 去却驾车向北。比喻行动和目的截然相反。(多形容同一个主语、侧重 目标与做法相反)" },
    { word: "分道扬镳", explain: "道：道路。镳：马嚼子。分开道路，驱马前进。指分道而行。也比喻思 想、志趣不同而各人干各人的事。也作“扬镳分路”。" },
    { word: "缘木求鱼", explain: "缘木：爬树。比喻方向、方法不对，就不可能达到目的。(侧重方法错 误)" },
    { word: "拔苗助长", explain: "用来比喻违反事物的发展规律，急于求成，反而坏事。也作“揠苗助长" },
    { word: "越俎代庖", explain: "越：超过。俎：古代盛牛羊等祭品的器具。庖：厨师。比喻处理超过自 己职权范围的事情。" },
    { word: "削足适履", explain: "履：鞋。鞋小脚大，把脚削去一块来凑合鞋的大小。比喻不合理地迁就 凑合或不顾具体条件，生搬硬套。" },
    { word: "闭门造车", explain: "关起门来造车子。比喻不管客观情况如何，只凭主观愿望办事。(多形 容不开放、自我封闭)" },
    { word: "刻舟求剑", explain: "求：寻找。比喻拘泥、不变通，不懂得根据实际情况处理问题。也比喻 徒劳无功，达不到目的。" },
    { word: "守株待兔", explain: "株：树桩子。比喻心存侥幸，不劳而获。也比喻死守狭隘经验，不知变 通。" },
    { word: "掩耳盗铃", explain: "掩：掩盖，遮盖。比喻自欺欺人。同“掩耳偷铃”。" },
    { word: "邯郸学步", explain: "比喻一味地模仿别人，不仅没学到本事，反而把原来的本事也丢了。" },
    { word: "东施效颦", explain: "比喻盲目地胡乱模仿，效果适得其反。" },
    { word: "与虎谋皮", explain: "跟老虎商量取下它的皮来，比喻跟坏人商量要其牺牲自己的利益，是绝 对办不到的。" },
    { word: "潜移默化", explain: "潜：暗中。默：毫无声息。指受到外来影响而在不知不觉中发生变化 (侧重长时间)。" },
    { word: "耳濡目染", explain: "濡：沾染。因经常听到看到而不知不觉受到影响。同“耳染目濡”“目 染耳濡”“目濡耳染”。(侧重身处某种外在环境中)" },
    { word: "如沐春风", explain: "通常用来形容人感到非常舒适和愉悦。它的意思是像沐浴在春风里一 样，感受到舒适的感觉。" },
    { word: "润物无声", explain: "指有大胸怀者，做了贡献而不张扬，默默奉献。(也指文化教育等对人 的潜移默化的影响)" },
    { word: "成风化人", explain: "成风，倡树一种社会风气。化人，感染人、影响人、教育人。通过倡导 树立一种社会风气来影响、教育感化社会大众。" },
    { word: "耳提面命", explain: "“耳提”,提着耳朵叮嘱；“面命”,当面指教，形容教诲殷切。多指 (长辈对晚辈、上级对下级)恳切地教导。" },
    { word: "苦口婆心", explain: "用来形容一个人善意且耐心地反复劝导他人。" },
    { word: "循循善诱", explain: "循循：有次序的样子。诱：引导。指善于有步骤地引导别人。多形容教 育得法。" },
    { word: "诲人不倦", explain: "诲：教诲，教导。教导人时很有耐心而不知疲倦。" },
    { word: "春风化雨", explain: "宜于万物生长的和风，适时的雨。后用来比喻良好的教育。多用来称颂 师长对学生及晚辈潜移默化的教诲。(也可用来形容文化或教育等对人 的影响)" },
    { word: "和风细雨", explain: "意思是比喻耐心地和颜悦色地批评或劝说。" },
    { word: "醍醐灌顶", explain: "醍醐：从牛乳中提炼出的纯酥油，佛教比喻最高的佛法。灌：浇。顶： 头顶。比喻给人灌输智慧，使人从迷惑中醒悟或彻底觉悟。也比喻舒适 畅快。" },
    { word: "振聋发聩", explain: "比喻唤醒糊涂麻木之人。" },
    { word: "如履薄冰", explain: "履：踩，走过。形容战战兢兢、小心谨慎的样子。" },
    { word: "兢兢业业", explain: "原形容畏惧的样子。后多用来形容小心谨慎、不敢懈怠的样子。" },
    { word: "一丝不苟", explain: "一丝：极小的事物；苟：敷衍了事、马虎。连最细微的地方也不马虎， 形容办事认真细致，一点儿不马虎。" },
    { word: "殚精竭虑", explain: "殚：竭尽。用尽精力和心思。" },
    { word: "呕心沥血", explain: "呕：吐。沥：滴。形容费尽心思。" },
    { word: "苦心孤诣", explain: "苦心：用尽心思。诣：(学业、技能等)所达到的程度。孤诣：别人达 不到的程度。指尽心竭力钻研，达到了别人所达不到的地步。也指为了 达到目的而费尽心思。" },
    { word: "废寝忘食", explain: "顾不上睡觉，忘记了吃饭。形容对某事专心致志。" },
    { word: "皓首穷经", explain: "皓：白。穷经：彻底钻研经书。钻研经籍直到人老头白。也作“白首穷 经 ” 。(也可形容长期钻研)" },
    { word: "心无旁骛", explain: "旁；另外的。骛：追求。心思没有另外的追求，形容心思集中，专心致 志。" },
    { word: "乐此不疲", explain: "因酷爱干某事而不感觉厌烦。形容对某事特别爱好而沉浸其中。" },
    { word: "挖空心思", explain: "想方设法，费尽心机。(多含贬义)" },
    { word: "千锤百炼", explain: "经过无数次锤打、锻炼。形容反复磨炼，使技艺或诗文达到极高水平" },
    { word: "持之以恒", explain: "持：指坚持、保持；之：代指所要坚持的事物；恒：指恒心、长久。指 用恒心长久地坚持下去，不中途松懈。" },
    { word: "精益求精", explain: "已经很好了，还要做得更好。形容追求卓越、不断进步。" },
    { word: "夜以继日", explain: "日夜不停地做某事。多形容十分勤奋、勤恳、忙碌。" },
    { word: "焚膏继晷", explain: "焚：点燃；膏：灯油或蜡烛；继：接续；晷：日影、日光。意思是点燃 灯烛来接替日光照明，形容夜以继日地用功读书或努力工作。" },
    { word: "夙兴夜寐", explain: "夙：早。兴：起来。寐：睡觉。早起晚睡，形容勤奋辛劳。" },
    { word: "目不窥园", explain: "窥：看。形容学习专心致志，十分刻苦。" },
    { word: "栉风沐雨", explain: "栉：梳头。沐：洗头。形容人辛苦地四处奔波。" },
    { word: "风餐露宿", explain: "在风中吃饭，在露天住宿。形容旅途中的辛苦劳累。" },
    { word: "筚路蓝缕", explain: "筚路：柴车。蓝缕：又旧又破的衣服。意思是驾着柴车穿着破旧衣服去 开辟山林。现用来形容创业的艰难与辛苦。也作“荜路蓝缕”。(词义 有拓展，也可形容事情发展的初期阶段)" },
    { word: "披星戴月", explain: "身披星光，头顶月色。形容早出晚归或连夜赶路。也作“戴月披星”。" },
    { word: "摩顶放踵", explain: "意思是从头顶到脚跟都擦伤了；形容不辞劳苦，不顾身体。" },
    { word: "胼手胝足", explain: "意思是手脚生茧。形容劳动十分辛勤。" },
    { word: "孜孜不倦", explain: "孜孜：勤奋的样子。形容勤奋、不知疲倦。" },
    { word: "孜孜以求", explain: "孜孜：勤勉的样子。意思是不知疲倦地探求。" },
    { word: "条分缕析", explain: "缕：线。一条条分析。形容分析得有条理，很细致。" },
    { word: "抽丝剥茧", explain: "意思是丝得一根一根地抽，茧得一层一层地剥；形容分析事物极为细 致，而且一步一步很有层次。" },
    { word: "深入浅出", explain: "指讲话或文章的内容深刻，语言文字却浅显易懂。" },
    { word: "纲举目张", explain: "指提起大网的总绳一撒，所有的网眼就都张开。比喻抓住事物的主要环 节，就可带动一切。" },
    { word: "提纲挈领", explain: "意思是抓住事物的关键部分或者核心要点，然后用简洁明了的方式进行 概述或表达。" },
    { word: "以一持万", explain: "用来形容抓住了关键的环节或因素，从而能够控制和影响整个局面。它 强调的是在处理问题时识别并把握住核心部分的重要性，以此来驾驭复 杂的情况或者广泛的领域。" },
    { word: "博采众长", explain: "博采：广泛搜集采纳。从多方面吸取各家的长处。" },
    { word: "见贤思齐", explain: "指见到有才德的人就想着与他齐平。" },
    { word: "量力而行", explain: "意思是指根据自身的实际能力和条件来决定行动的范围，做事不要超过 自己的能力范围，以免出现意外问题。" },
    { word: "厚积薄发", explain: "厚积：充分积累。薄发：少量地慢慢地释放。形容积累丰富的学问而不 轻易表现出来。" },
    { word: "脚踏实地", explain: "原意是脚踏在坚实的土地上，比喻做事踏实、认真、稳重，不浮夸、不 好高骛远。" },
    { word: "返璞归真", explain: "璞：未经雕琢的玉。去掉外在的修饰，回归到本真、朴素的状态。" },
    { word: "行稳致远", explain: "指行进平稳才能达到长远的目标。比喻脚踏实地、稳扎稳打做事，才能 走得长远。" },
    { word: "当仁不让", explain: "当：面对。仁：符合道义的事。后指遇到应该做的事，勇于承当，不推 诿 。(侧重情理上)" },
    { word: "义不容辞", explain: "义：道义。辞：推辞。道义上不容许推辞。指理应接受。(侧重良心、 道义上)" },
    { word: "责无旁贷", explain: "责：责任。贷：推卸。指自己应尽的责任，不能推给别人。(侧重责任 、职责上)" },
    { word: "过犹不及", explain: "过：过分。不及：不够。事情做得过了头，就跟做得不够一样，都不合 适。" },
    { word: "矫枉过正", explain: "矫枉：矫正弯曲。指纠正偏失错误，超过了应有的限度。" },
    { word: "于事无补", explain: "指某种言行对于解决问题没有帮助。" },
    { word: "作茧自缚", explain: "蚕吐丝作茧，把自己包在里面。比喻自己束缚了自己或使自己陷入困境" },
    { word: "扬汤止沸", explain: "把开水从锅中舀出来，再倒回去，以阻止锅中的水沸腾。比喻不能解决 根本问题的做法。" },
    { word: "隔靴搔痒", explain: "比喻说话、做事、写文章不中肯，没有抓住关键。" },
    { word: "临渊羡鱼", explain: "比喻有欲望想得到某种东西，但却没有实际行动。" },
    { word: "有恃无恐", explain: "因有所依仗而毫不害怕。" },
    { word: "堂而皇之", explain: "形容公然而毫不掩饰(多含贬义),强调表面上的正当性或气势宏大， 可能隐含虚伪或掩饰。" },
    { word: "明目张胆", explain: "强调公开、毫无顾忌地做坏事，带有明显的贬义。" },
    { word: "浑水摸鱼", explain: "趁水浑浊抓鱼。指先在敌人或者对手内部制造混乱，然后乘其混乱之 际，获取利益。" },
    { word: "虚张声势", explain: "假装强大的声势来吓唬人。形容虚假夸张地造势。" },
    { word: "落井下石", explain: "有人掉进井里，不但不救，反而往井里扔石头。比喻趁人有难时加以陷 害或打击。" },
    { word: "投机取巧", explain: "指利用时机和不正当手段谋取利益，不走正道。" },
    { word: "以偏概全", explain: "用片面的情况去概括整体，得出错误的结论。" },
    { word: "吹毛求疵", explain: "疵：小毛病。吹开皮上的毛，寻找里面的小毛病。比喻刻意挑剔别人或 事物的细小缺点。" },
    { word: "抱薪救火", explain: "薪：柴草。怀抱柴草去救火。比喻以错误的方式消灭祸患，反而使祸患 加重 。" },
    { word: "画地为牢", explain: "牢：牢狱。在地上画个圈儿，作为牢狱。比喻局限在小圈子里活动。" },
    { word: "以邻为壑", explain: "壑：深沟。意为把邻国当成排洪水的沟壑。后用来比喻把困难、灾祸推 给别人。(多宏观语境，国家、城市、地区等)" },
    { word: "穿凿附会", explain: "意思是把讲不通的或不相干的道理、事情硬扯在一起进行解释。" },
    { word: "亦步亦趋", explain: "步：走。趋：快走。比喻因缺乏主见，任何事都模仿、追随他人。( 侧 重行动)" },
    { word: "唯利是图", explain: "唯：只有；图：图谋，追求。只要有利可图，什么事都干。" },
    { word: "隔岸观火", explain: "指站在对岸观望火灾；用来比喻对别人的急难不加救助，而采取看热闹 的态度。" },
    { word: "置身事外", explain: "置：安放。把自己放在事情之外。形容毫不关心。" },
    { word: "袖手旁观", explain: "袖手：把手揣在袖子里。比喻置身事外，既不过问，也不协助别人。 (侧重从旁边看)" },
    { word: "作壁上观", explain: "原指双方交战，自己站在壁垒上旁观。后多比喻站在一旁看着，不动手 帮助。" },
    { word: "坐收渔利", explain: "比喻利用别人的矛盾而从中获利" },
    { word: "坐享其成", explain: "意思为自己不出力而享受别人取得的成果。" },
    { word: "竭泽而渔", explain: "排尽湖中或池中的水捕鱼。比喻取利只顾眼前，不作长远打算。" },
    { word: "杀鸡取卵", explain: "卵：蛋。为了要得到蛋，不惜把鸡杀了。比喻贪图眼前微小的好处而损 害长远的利益。" },
    { word: "寅吃卯粮", explain: "寅、卯：古代用于纪年等的十二地支中的两个，寅在卯之前。寅年吃了 卯年的粮食。比喻经济困难，入不敷出。同“寅支卯粮”。(侧重由于 有困难而提前预支)" },
    { word: "饮鸩止渴", explain: "鸩：毒酒。比喻用有害的方法解决面临的困难，而不顾后果。" },
    { word: "急功近利", explain: "功：成功；近：眼前的。急于求成，贪图眼前的成效和利益。" },
    { word: "颠沛流离", explain: "颠沛：跌倒，比喻困顿，受挫折。流离：流转离散。形容生活困苦，流 落异乡，无安身之所。(可指人，也可指物)" },
    { word: "流离失所", explain: "失所：失去安身之处。形容到处流浪，没有安身的地方。(多指因灾荒 、战乱等导致的失去居所)" },
    { word: "背井离乡", explain: "背：离开。井：古制八家为井，这里指家宅。指被迫离开家乡，到外地 求 生 。(也指主动离开家乡，到外地生活/工作)" },
    { word: "安居乐业", explain: "安：安定；乐：喜爱，愉快；业：职业。指安定愉快地生活和劳动。" },
    { word: "海晏河清", explain: "晏：平静。黄河水清了，大海没有浪了。比喻天下太平。" },
    { word: "国泰民安", explain: "泰：太平。国家太平，人民生活安定。形容社会安定，人民生活幸福。" },
    { word: "安土重迁", explain: "土：乡土；重：看得重，不轻易。安于本乡本土，不愿轻易迁移。" },
    { word: "休戚与共", explain: "休：欢乐，吉庆。戚：忧愁，悲哀。指忧喜祸福彼此共同承担。形容关 系密切同甘共苦。" },
    { word: "同气连枝", explain: "同气：同胞兄弟；连枝：比喻兄弟。比喻同胞兄弟姐妹，现引申为彼此 的关系很密切。" },
    { word: "同舟共济", explain: "济：渡过。同乘一条船过河。比喻齐心协力渡过困难。" },
    { word: "同心同德", explain: "思想统一，信念一致。形容大家团结一条心。" },
    { word: "和衷共济", explain: "衷：内心。和衷：指同心。大家同心渡过江河。比喻同心协力，渡过难 关。现也可比喻齐心协力。" },
    { word: "水乳交融", explain: "水和乳汁融合在一起。比喻意气相投、感情融洽。(侧重融合)" },
    { word: "相濡以沫", explain: "濡：沾湿，浸润。沫：唾沫。意为泉水干涸，鱼用唾沫相互湿润。后比 喻在困境中用微薄的力量相互帮助。" },
    { word: "风清气正", explain: "指社会风气清新正派，环境整洁，没有污染和腐败。通常用来形容政治 环境清明，社会治理健康。" },
    { word: "守望相助", explain: "守：防守。望：瞭望。指彼此关照，互相帮助。" },
    { word: "一衣带水", explain: "原形容像一条衣带那样狭窄的河流。现比喻仅隔一水，极其邻近。" },
    { word: "唇齿相依", explain: "嘴唇与牙齿互相依存。比喻关系极为密切。" },
    { word: "波诡云谲", explain: "好像云彩和水波那样，形态不可捉摸。" },
    { word: "风云变幻", explain: "风、云：风和云，比喻变幻动荡的局势。变幻：变化不定。像风和云那 样变化莫测。比喻局势多变或情况复杂。" },
    { word: "纵横捭阖", explain: "纵横：用游说来联合。捭阖：开合。指在政治、外交上运用手段进行联 合或分化。" },
    { word: "貌合神离", explain: "指表面上关系很密切，实际上是两条心。" },
    { word: "沆瀣一气", explain: "泛指臭味相投的人结合在一起。" },
    { word: "同流合污", explain: "原指言行与不良的习俗、世道相合。后指跟坏人一起干坏事。" },
    { word: "因地制宜", explain: "根据不同地方的基本情况，制定相应的办法。" },
    { word: "量体裁衣", explain: "按身材裁剪衣服。也比与按实际情况办事。" },
    { word: "对症下药", explain: "医生针对病症开方用药。比喻针对问题所在确定解决方法。" },
    { word: "有的放矢", explain: "的：箭靶。矢：箭。对着靶子射箭。比喻目的性强，有针对性。" },
    { word: "因时制宜", explain: "是指根据时间变化或不同情况，采取适合的策略或措施。" },
    { word: "因势利导", explain: "因：顺着。势：趋势。利导：引导。指顺着事物的发展趋势而加以引导 。 ( 褒 义 )" },
    { word: "保驾护航", explain: "保护某事物能让其能正常发展。" },
    { word: "穿针引线", explain: "使线的一头通过针眼。比喻从中联系、拉拢。" },
    { word: "添砖加瓦", explain: "指建筑施工过程中添加砖块和瓦片，比喻通过具体行动为集体事业增添 一分微薄的力量。" },
    { word: "各司其职", explain: "司：主管，经营；职：职务。每人都负责做自己职责范围内的事。" },
    { word: "群策群力", explain: "指大家共同出谋划策、齐心协力，发挥集体的智慧和力量。" },
    { word: "广开言路", explain: "广：扩大；言路：进言的道路。指尽量给下面创造发表意见的条件。" },
    { word: "集思广益", explain: "集：积重。思：想法，智慧。广：扩大。益：益处，效果。指集中众人 的智慧，可以收到更好的效果。" },
    { word: "正本清源", explain: "正本：从根本上整顿；清源：从源头上清理。从根本上整顿，从源头上 清理。比喻从根本上加以整顿清理。" },
    { word: "慎终如始", explain: "慎：谨慎；如：像。谨慎收尾，如同开始时一样。指始终要谨慎从事" },
    { word: "开源节流", explain: "开发财源，节省支出，以储蓄财力。" },
    { word: "精打细算", explain: "意思是精密地计划，详细地计算。指在使用人力、物力时计算得很精细" },
    { word: "细水长流", explain: "比喻节约使用财物，使经常不缺用。也比喻一点一滴不间断地做某件 事，精细安排，长远打算。" },
    { word: "量入为出", explain: "入：收入。根据收入的情况来安排支出。" },
    { word: "立竿见影", explain: "在阳光下竖起竹竿，立刻就能看到它的影子。比喻效果显著迅速。" },
    { word: "一劳永逸", explain: "逸：安逸。指辛苦一次把事情办好，以后就不用费力了。" },
    { word: "行之有效", explain: "之：代词，它，指办法、措施等；效：成效，效果。实行起来有成效。 指某种方法或措施已经实行过，证明很有效用。" },
    { word: "一蹴而就", explain: "蹴：踏；就：成功。踏一步就可以获得成功，比喻事情很容易做。同“ 一蹴而得”。(多用于否定句中)" },
    { word: "迎刃而解", explain: "刃：刀刃。解：分开。把竹子劈开口，下面的一段竹子就迎着刀刃裂开 了。比喻主要问题解决了，其他的问题就很容易解决。(常搭配“问题 “)" },
    { word: "事半功倍", explain: "事：所要做的事情，指措施。功：功效。形容费力小，收效大。" },
    { word: "釜底抽薪", explain: "釜：锅。薪：柴。从锅底下抽出柴火。比喻从根本上解决问题。" },
    { word: "标本兼治", explain: "标本：事物的枝节和根本。从枝节和根本方面都得到治理。" },
    { word: "触手可及", explain: "伸手便可接触到。形容距离很近。" },
    { word: "唾手可得", explain: "唾手：往手上吐唾沫。比喻极容易得到。" },
    { word: "手到擒来", explain: "擒：捉拿。一出手就把人捉住。形容做事毫不费力或很有把握。" },
    { word: "信手拈来", explain: "信手：随手；拈：用两三个手指头捏东西。随手拿来，多指写文章时能 自由纯熟地选用词语或应用典故、素材，用不着怎么思考。(多用于引 用资料、数据、典故等)(也可形容做事不费力)" },
    { word: "游刃有余", explain: "比喻工作熟练，实际经验很丰富，解决困难问题毫不费事。[近]应付 自如。" },
    { word: "一步登天", explain: "指一步跨上青天，比喻一下子就达到很高的境界或程度，有时也比喻人 突然得志，爬上高位。" },
    { word: "轻而易举", explain: "形容非常轻松，毫不费力。" },
    { word: "得心应手", explain: "指心里怎么想，手就能怎么做。比喻技艺纯熟或做事情非常顺利。" },
    { word: "举重若轻", explain: "举起沉重的东西像举轻物一 样 。比喻能力强且能轻松应对繁难事务或处 理复杂问题。" },
    { word: "束手无策", explain: "策：办法。手被捆住，无法应对。形容遇到问题没有解决的办法。" },
    { word: "一筹莫展", explain: "筹：计策。展：施展。一点计策也施展不出。形容没有一点办法。" },
    { word: "功亏一篑", explain: "篑：盛土的筐，指一筐土。后用来比喻做事情只差最后一点而前功尽弃" },
    { word: "适得其反", explain: "适：恰好。结果与愿望恰好相反。(侧重取得反面结果)" },
    { word: "功败垂成", explain: "垂：接近，将要。事情在将要成功的时候失败了。含惋惜意。同“事败 垂成”。" },
    { word: "失之交臂", explain: "交臂：胳膊碰胳膊，指擦肩而过。形容当面错过。" },
    { word: "高屋建瓴", explain: "建：倾倒。瓴：水瓶。从高屋脊上往下倒瓶中的水。形容居高临下，不 可阻挡的形势。" },
    { word: "高瞻远瞩", explain: "瞻：望。瞩：注视。登高望远。形容目光远大。(更宏观)" },
    { word: "深谋远虑", explain: "计谋深远，考虑周密。" },
    { word: "审时度势", explain: "审：详查，观察。时：当前情况。度：估计。势：发展趋势。观察时 机，估计发展趋势。用来指对形势有洞察力。也作“审时定势”“审几 度势”。" },
    { word: "运筹帷幄", explain: "筹：谋划。帷幄：古代军队中的帐幕。指在帐幕中谋划计策。后指在后 方指挥、筹划。" },
    { word: "统筹兼顾", explain: "意思是统一筹划，全面照顾。" },
    { word: "身体力行", explain: "身：亲身。体：体验。指亲身体验，努力实践。" },
    { word: "亲力亲为", explain: "亲自参与，不由别人来代替。" },
    { word: "克己奉公", explain: "克己：约束自己；奉公：以公事为重。克制自己的私心，一心为公。" },
    { word: "以身作则", explain: "身：自身。则：榜样。自己以行动给大家做出榜样。" },
    { word: "上行下效", explain: "行：做。效：效法。指上面的人怎么做，下面的人就跟着怎么干。" },
    { word: "事必躬亲", explain: "躬亲：亲自做。凡事都一定要自己亲自去做。" },
    { word: "率先垂范", explain: "垂范：做出榜样。首先做出榜样。" },
    { word: "一马当先", explain: "原指作战时策马冲锋在前，后形容处于领先地位或工作中积极带头。" },
    { word: "身先士卒", explain: "指作战时将领亲自带头，冲在士兵前面。现也指领导带头，走在群众前 面。" },
    { word: "一以贯之", explain: "指做人做事，按照一个道理，从始至终都不会改变。贯：一直，习惯。" },
    { word: "矢志不渝", explain: "矢志不渝(矢：誓；渝：改变)指立下志愿，绝不改变。" },
    { word: "前仆后继", explain: "意思是指前面的人倒下了，后面的人继续跟上去。英勇斗争，不怕牺牲 。" },
    { word: "视死如归", explain: "把死看得像回家一样平常。形容不怕牺牲生命。" },
    { word: "大义凛然", explain: "大义：正义。凛然：令人敬畏的样子。形容为了坚持真理而表现出的严 峻不可侵犯的样子。" },
    { word: "踔厉奋发", explain: "踔chuō,形容精神振奋，斗志昂扬。" },
    { word: "笃行不怠", explain: "意思是切实履行自己所学的内容，不感到倦怠。" },
    { word: "赓续前行", explain: "意思是指不断地延续和发展，保持进步的态度和生活方式。" },
    { word: "奋楫争先", explain: "意思是奋力划动船桨的人争先恐后走在前头。" },
    { word: "砥砺前行", explain: "经历磨炼，克服困难，往前进步的意思。也作“砥砺奋进”。" },
    { word: "勇毅前行", explain: "意思是勇敢并且坚毅地向前进步或发展。" },
    { word: "披荆斩棘", explain: "指拨开荆丛，砍掉荆棘。比喻开创事业或在前进道路上清除障碍，艰苦 奋斗" },
    { word: "百折不挠", explain: "指虽然受到很多挫折，但仍不动摇、退缩或屈服。形容意志坚强。" },
    { word: "任重道远", explain: "任：负担；道：路途。指担子很重，路很远。比喻肩负的责任重大，并 且需要经过长期艰苦的努力。" },
    { word: "好高骛远", explain: "骛：通“务”,追求。指不切实际地追求过高、过远的目标。" },
    { word: "好大喜功", explain: "喜欢做大事、立大功。多形容浮夸、不切实际的行为。" },
    { word: "沽名钓誉", explain: "比喻故意矫情做作，用手段猎取名声或赞誉。" },
    { word: "附庸风雅", explain: "附庸：依傍，追随；风雅：泛指诗歌。指缺乏文化修养的人为了装点门 面而结交文人，参加有关文化活动，以示自己有一定的文化素养(装文 化人)。" },
    { word: "独善其身", explain: "意思是不得志时也要注意自身的修养。后指只顾保持自身修养而不顾他 人或全局。(语境要素：个人与外部的对比、保全保护)" },
    { word: "明哲保身", explain: "明哲：聪明有智慧。指聪明有智慧之人，善于趋安避危，保全自身。也 指为保全个人利益而回避原则问题的处世态度。" },
    { word: "虚与委蛇", explain: "虚：不真实，假意。与：跟。委蛇：敷衍。指对人虚情假意，敷衍应酬 。" },
    { word: "委曲求全", explain: "曲意迁就，以求事成，或保全大局。" },
    { word: "敷衍塞责", explain: "敷衍：马虎应付。塞责：搪塞责任。做事马虎，应付一下以搪塞责任。" },
    { word: "曲意逢迎", explain: "曲意：违背本意。违背自己的本心，千方百计迎合或讨好别人。" },
    { word: "投其所好", explain: "意思是迎合别人的喜好。" },
    { word: "阿谀奉承", explain: "阿谀：为讨好而说好听的话。奉承：恭维别人。为讨好而说好听的话恭 维别人。也作“阿谀逢迎”。" },
    { word: "趋炎附势", explain: "趋：奔走；炎：热，比喻权势。奉承和依附有权有势的人。" },
    { word: "如蚁附膻", explain: "附：趋附；膻：羊肉的气味。像蚂蚁趋附羊肉一般。比喻许多臭味相投 的人追求不好的事物。也比喻许多人依附有钱有势的人。" },
    { word: "掩人耳目", explain: "掩：遮盖。堵住人的耳朵，遮住人的眼睛。比喻以假象来蒙蔽别人。" },
    { word: "阳奉阴违", explain: "指表面遵从、暗地违背的行为。" },
    { word: "兴师动众", explain: "意思是指大规模出兵。现多指动用很多人力做某件事。" },
    { word: "劳民伤财", explain: "意思是既使人民劳苦，又耗费钱财；现也指滥用人力物力。" },
    { word: "朝令夕改", explain: "早上颁布的政令，晚上就改了。形容政令无常。也形容主张、办法等经 常改变。" },
    { word: "粗枝大叶", explain: "绘画，画树木粗枝大叶，不用工笔。比喻工作粗糙，不认真细致。" },
    { word: "大而化之", explain: "化：感化。原指把真诚、善良、完美的品德发扬光大，使人的思想品德 得以完美。后用来形容做事大大咧咧，不谨慎，不细致。" },
    { word: "具体而微", explain: "具体：各部分已大体具备；微：微小。指事物的各个组成部分大体都有 了，不过形状和规模比较小些。" },
    { word: "哗众取宠", explain: "用浮夸的言词或做作的行动去迎合群众，以博取好感和支持。" },
    { word: "凌空蹈虚", explain: "形容不切实际、虚浮空泛。" },
    { word: "厚此薄彼", explain: "厚：重视；薄：轻视。指重视这一方而轻视那一方，对人对事不能一视 同仁。" },
    { word: "从谏如流", explain: "谏：直言规劝。听从规劝像流水一样自然。形容乐于接受别人的批评意 见。" },
    { word: "从善如流", explain: "从：听从；善：好的，正确的；如流：好像流水向下，形容迅速。形容 能迅速地接受别人的好意见。" },
    { word: "闻过则喜", explain: "过：过失；则：就。听到别人批评自己的缺点或错误，表示欢迎和高兴 指虚心接受意见" },
    { word: "虚怀若谷", explain: "虚：谦虚；谷：山谷。胸怀像山谷一样深广。形容十分谦虚，能容纳别 人的意见。" },
    { word: "文过饰非", explain: "文、饰：掩饰；过、非：错误。用漂亮的言辞掩饰自己的过失和错误" },
    { word: "怙恶不悛", explain: "怙：依靠，依仗；悛：改过，悔改。坚持作恶，不肯悔改。" },
    { word: "欲盖弥彰", explain: "盖：遮掩；弥：更加；彰：明显。想掩盖坏事的真相，结果反而更明显 地暴露出来。" },
    { word: "讳疾忌医", explain: "指隐瞒疾病、不愿医治，比喻怕人批评而掩饰自己的缺点和错误。" },
    { word: "刚愎自用", explain: "愎：任性；刚愎：强硬固执；自用：自以为是。十分固执自信，不考虑 别人的意见。" },
    { word: "固执己见", explain: "顽固地坚持自己的意见，不肯改变。" },
    { word: "自以为是", explain: "指自己认为自己正确，形容主观不虚心的态度。" },
    { word: "洗心革面", explain: "洗心：指清除坏思想。革面：改变旧面貌。比喻彻底悔改。" },
    { word: "脱胎换骨", explain: "原为道教用语。指修道者得道以后，就转凡胎为圣胎，换凡骨为仙骨。 现比喻通过教育，思想得到彻底改造。" },
    { word: "改头换面", explain: "①原为佛教语。指众生在轮回中形变神不变。②指改变面目。③指改正 错误。④比喻只改变形式，而内容、实质不变。" },
    { word: "惩前毖后", explain: "指批判以前所犯的错误，吸取教训，使以后谨慎些，不致再犯。" },
    { word: "一成不变", explain: "成：形成。指事物一形成就不再改变。多用于否定句中。" },
    { word: "亘古不变", explain: "从古至今永远也不会改变。多褒义。" },
    { word: "改弦更张", explain: "更：改换；张：给乐器上弦。改换、调整乐器上的弦，使声音和谐。比 喻改革制度或变更计划、方法。" },
    { word: "改弦易辙", explain: "改弦：更换琴弦。易：改变。辙：车轮压过的痕迹，指道路。比喻改变 方向或做法。同“更弦易辙”“改辕易辙”。" },
    { word: "变幻莫测", explain: "变幻：没有规则地改变。变化奇特，不可预测。" },
    { word: "瞬息万变", explain: "瞬：一眨眼。息：一呼吸。在极短时间里就发生很多变化。形容变化很 多很快。" },
    { word: "光怪陆离", explain: "光怪：奇异的光彩；陆离：色彩繁杂。形容事物奇形怪状，五颜六色， 常用来描述景象的离奇多变，也比喻世事离奇古怪、纷繁怪异。" },
    { word: "经久不衰", explain: "①精神饱满的状态，身体健壮的外表，或幼年期到成年期之间的时期的 精神特征；青年人的活力或朝气。②形容某事或某人经历很长时间仍旧 保持较高的旺盛状态事例。" },
    { word: "长盛不衰", explain: "长久兴盛而不衰败，比喻长时间保持旺盛的势头。" },
    { word: "今非昔比", explain: "现在不能和过去相比。形容变化大。(多形容现在比过去好)" },
    { word: "天翻地覆", explain: "覆：翻过来。形容变化巨大。也形容闹得很凶。" },
    { word: "时过境迁", explain: "境：环境。迁：变迁。时间过去了，环境或情况也随之改变了。" },
    { word: "沧海桑田", explain: "沧海：大海。桑田：种桑树的地。大海变为桑田，桑田变为大海。比喻 世事变化非常大。" },
    { word: "斗转星移", explain: "斗：北斗星。表示一夜之间时间的推移。后也指岁月流逝。" },
    { word: "白云苍狗", explain: "苍：青色，泛指青黑色。比喻世事变化无常。也作“白衣苍狗”。" },
    { word: "恍如隔世", explain: "恍：仿佛；世：三十年为一世。仿佛隔了一个时代。指一种因人事或景 物变化很大而引起的感触。" },
    { word: "根深蒂固", explain: "蒂：草木之根。比喻基础稳固。(中性)(侧重深)" },
    { word: "积习难改", explain: "积习：指多年养成的习惯。长期形成的某种习惯，很难改变。" },
    { word: "积重难返", explain: "积：积习。返：返回，回头。积习深重，难以改变。多指长期存在的恶 习，弊端已经发展到了难以革除的地步。(侧重时间久)" },
    { word: "覆水难收", explain: "倒在地上的水难收回来，说明一旦事情发生，就很难再改变或挽回。比 喻事成定局，无法挽回。" },
    { word: "顺势而为", explain: "顺应形势做事情。" },
    { word: "大势所趋", explain: "大势：整个局势。趋：趋向。整个局势发展的方向。" },
    { word: "势在必行", explain: "势：形势。客观形势决定必须这样做。" },
    { word: "随波逐流", explain: "随：跟着。逐：追赶。随着波浪起伏，跟着流水漂荡。比喻自己没有主 见，只是随着别人走。同“随波逐浪”。" },
    { word: "因陋就简", explain: "指在条件有限的情况下，利用现有简陋条件将就办事，强调适应环境而 非追求完善。该成语褒贬取决于“简”的合理性一灵活务实则褒，降低 标准则贬。" },
    { word: "推波助澜", explain: "澜：大的波浪。比喻推动、助长事物的声势及发展。(中性词)" },
    { word: "顺水推舟", explain: "舟：船。顺着水流的方向推船。比喻顺应某个趋势说话办事。" },
    { word: "理所当然", explain: "指从道理上讲，应该如此。" },
    { word: "顺理成章", explain: "意思是写文章、做事情顺着条理就能做好。比喻随着某种情况的发展而 自然产生的结果。" },
    { word: "天经地义", explain: "指天地间理所当然而不能改变的道理；也指理所当然，不容置疑的问题" },
    { word: "水到渠成", explain: "意思是当水流到某处时，自然会形成一条水道。这个成语用来比喻当条 件成熟时，事情会自然成功，并不需要强求。" },
    { word: "顺其自然", explain: "意思是顺着事物本来的性质自然发展。" },
    { word: "未雨绸缪", explain: "绸缪：缠绕，引申指修缮。比喻事先做好防备工作。" },
    { word: "常备不懈", explain: "意思是时刻准备着，毫不松懈。" },
    { word: "防患未然", explain: "患：灾祸。未然：没有这样，指没有发生。在祸患还没有发生之前就进 行防备。" },
    { word: "防微杜渐", explain: "微：细小，指事物的苗头。杜：杜绝，堵塞。渐：事物的开头。指在不 良的事物刚刚露出苗头时，就加以制止和杜绝，不让它发展下去。" },
    { word: "居安思危", explain: "处在安定的环境时而能想到可能会出现的危难。" },
    { word: "曲突徙薪", explain: "原义是把烟囱改建成弯的，把灶旁的柴草搬走；比喻事先采取措施，才 能防止灾祸；在句子中可充当作谓语、定语。" },
    { word: "高枕无忧", explain: "垫高枕头睡觉，无所忧虑。" },
    { word: "临渴掘井", explain: "临；接近。感到口渴才挖井。比喻平时没有准备，事到临头才想办法。" },
    { word: "江心补漏", explain: "指船到江心才补漏洞。比喻临到紧急关头才设法补救，为时已晚。偏正 式结构；在句中一般作谓语、定语。" },
    { word: "亡羊补牢", explain: "意指丢失了再去修补羊圈，还不算晚。后用来比喻出了问题以后及时想 法补救，以免继续受损失。也指出了问题才想法补救，已经太晚了。" },
    { word: "尾大不掉", explain: "掉：摇动，摆动。比喻属下势力强大，不服从指挥调度。也比喻事情前 轻后重，难以驾驭的现象。" },
    { word: "各行其是", explain: "指各人按照自己认为正确的去做。" },
    { word: "各自为政", explain: "各人按自己的主张办事。(多用来形容工作，单位之间、部门之间)" },
    { word: "如鱼得水", explain: "好像鱼得到水一样。比喻得到跟自己非常投合的人或对自己很适合的环 境。" },
    { word: "面面俱到", explain: "各方面都照顾得很周到。也指不仅各方面都照顾到，而且每一个方面都 处理得很得当。" },
    { word: "独当一面", explain: "意思是指单独负责一个方面的工作或任务。" },
    { word: "纸上谈兵", explain: "兵：用兵之道。比喻空谈理论，不能解决实际问题。(侧重只有理论而 没有行动)" },
    { word: "无根之木", explain: "意思是比喻没有根据或基础的事物。" },
    { word: "坐而论道", explain: "意思是坐着空谈大道理。指口头说说，不见行动。" },
    { word: "水中捞月", explain: "指在水中捞月亮；比喻去做根本做不到的事情，只能徒劳无功。含贬义 。" },
    { word: "画饼充饥", explain: "画个饼子来解饿。本比喻徒有虚名而于实际无好处。后多用来比喻以空 想来安慰自己。" },
    { word: "故弄玄虚", explain: "玄虚：用来掩盖真相，使人迷惑的欺骗手段。故意玩弄花招，迷惑人， 欺骗人。" },
    { word: "空穴来风", explain: "穴：洞，指有孔洞便会进风。比喻消息和传闻的产生都是有原因和根据 的，现代汉语中多用来指消息和传说毫无根据。" },
    { word: "天马行空", explain: "天马：汉武帝对从西域大宛国得到的汗血马的称号；行空：腾空飞行。 指天马奔驰于天空，形容才华横溢，气势豪放，不受约束，也形容言论 或行为浮躁、不踏实，不着边际。" },
    { word: "空中楼阁", explain: "悬在空中的楼阁。比喻崇高通达。后多用来比喻虚构的事物或脱离实际 的空想。" },
    { word: "镜花水月", explain: "镜子里的花，水里的月亮。比喻虚幻的东西。" },
    { word: "海市蜃楼", explain: "比喻虚无缥缈而不实际存在的事物，也比喻不可企及的虚无的梦想。" },
    { word: "天方夜谭", explain: "本义指代《一千零一夜》的故事合集，引申义形容言论内容荒诞夸张、 脱离现实。" },
    { word: "虚无缥缈", explain: "虚无：指空虚状态；缥缈：表示若有若无的形态。组合后特指难以把握 的虚幻景象。" },
    { word: "接踵而至", explain: "意思是指人们前脚跟着后脚，接连不断地来，形容人接连而来或事情持 续发生。" },
    { word: "络绎不绝", explain: "络绎：前后相接、连续不断的样子。形容车船人马等前后相接，往来不 断。" },
    { word: "纷至沓来", explain: "纷：众多。沓：又多又重复。形容连续不断地纷纷到来。" },
    { word: "蜂拥而至", explain: "像一窝蜂似地一拥而来。形容很多人乱哄哄地朝一个地方聚拢。" },
    { word: "门庭若市", explain: "门庭：门口和庭院。若：如，好像。门口和庭院就像集市一样，热闹非 凡。形容往来的人很多。" },
    { word: "无人问津", explain: "津：渡口。没有人来询问渡口。比喻没人过问、受到冷落。(形容某事 物受冷落、无人理睬。程度较重)" },
    { word: "门庭冷落", explain: "形容十分冷落，宾客稀少。" },
    { word: "门可罗雀", explain: "罗：张网捕捉。大门之前可以张起网来捕麻雀。形容十分冷落，宾客稀 少。" },
    { word: "人迹罕至", explain: "罕：少。指偏僻荒凉、少有人到的地方。(侧重偏僻荒凉)" },
    { word: "不期而遇", explain: "没约定而意外相遇。" },
    { word: "不期而至", explain: "指事先没有约定而意外到来，没有预料地到来。" },
    { word: "萍水相逢", explain: "比喻从不认识的人偶然相遇。" },
    { word: "如影随形", explain: "好像影子总是跟着身体一样。比喻两个人关系亲密，常在一起。" },
    { word: "熙熙攘攘", explain: "熙熙：和乐的样子。攘攘：乱纷纷的样子。形容人来人往，纷杂拥挤。" },
    { word: "人山人海", explain: "形容聚集的人非常多。" },
    { word: "车水马龙", explain: "车像流水，马如游龙。形容车马来来往往的热闹景象。同“马龙车水” 。" },
    { word: "川流不息", explain: "形容行人、车马很多，像水流一样连续不断。" },
    { word: "万人空巷", explain: "空巷：街道里弄里的人全部走空。指家家户户的人都从巷里出来了。多 形容庆祝、欢迎等盛况。" },
    { word: "子然一身", explain: "孑然：孤单的样子。指孤身一人。(常用褒义，形容追寻事业或理想)" },
    { word: "茕茕子立", explain: "茕茕：孤单，无依靠。子立：孤立。形容一个人孤苦伶仃，无依无靠。" },
    { word: "形影相吊", explain: "吊：慰问。只有自己的身体和影子相互慰问。形容无依无靠，非常孤单 " },
    { word: "形单影只", explain: "只：指单独。形容孤独，没有伴侣。" },
    { word: "参差不齐", explain: "参差：高低、长短、大小不齐的样子。形容不一致、有差别。(多搭配 水平、质量、进展等)" },
    { word: "泥沙俱下", explain: "俱：都。泥土和沙子一同随水冲了下来。比喻人或事物好坏混杂在一起 。(侧重量大且好坏都有)" },
    { word: "良莠不齐", explain: "莠：狗尾草，比喻坏人。指好人、坏人混在一起。同“良莠不一”。 (现在用法不只形容人，也可形容事物)" },
    { word: "鱼龙混杂", explain: "比喻坏人和好人混在一起。同“龙蛇混杂”。(现在用法不只形容人， 也可形容事物)" },
    { word: "鱼目混珠", explain: "用鱼眼睛假冒珍珠。比喻以假乱真。(也可指以次充好)" },
    { word: "滥竽充数", explain: "滥：失实，不真实。竽：一种簧管乐器。比喻没有真实本领的人，混在 行家队伍里充数。也比喻以次充好。(可用于自谦)" },
    { word: "买椟还珠", explain: "椟：木匣子。还：退还。比喻没有眼光，不识货，取舍失当。" },
    { word: "蔚然成风", explain: "蔚然：草木茂盛的样子。形容一种事物逐渐发展流行，形成风气。( 多 含褒义)" },
    { word: "风靡一时", explain: "靡：倒下。风靡：风一吹，就随之倒下。形容某一种事物在一个时期内 非常流行。(中性)" },
    { word: "如雷贯耳", explain: "形容人的名声很大。" },
    { word: "炙手可热", explain: "炙：烤。手一靠近就感觉很烫，比喻气焰盛，权势大。" },
    { word: "名噪一时", explain: "意思是一时名声很大。指名声传扬于一个时期。" },
    { word: "闻名遐迩", explain: "形容名声很大，主要指远近闻名。" },
    { word: "声名显赫", explain: "表示人的声望或事物的影响力极其盛大。" },
    { word: "靡然成风", explain: "指相互跟风，群起效尤而成风气，贬义词，多指不好的风气。" },
    { word: "大行其道", explain: "新潮事物流行成为一种风尚。(中性，多贬义)" },
    { word: "甚嚣尘上", explain: "甚：很。嚣：喧闹。尘上：尘土飞扬。形容对某事议论纷纷。(中性 词，多贬义)" },
    { word: "声名鹊起", explain: "鹊起：喻指名声大作。形容名声迅速提高。" },
    { word: "名声大噪", explain: "名声广泛地传播开去。噪：传扬。" },
    { word: "趋之若鹜", explain: "鹜：鸭子。像鸭子一样成群地跑过去。比喻很多人争相追逐、趋附。含 贬义。(现在有时非贬义)" },
    { word: "以讹传讹", explain: "把本来就不正确的话又错误地传出去，结果越传越错。" },
    { word: "无孔不入", explain: "比喻见空子就钻；利用一切漏洞或机会(多指做坏事)。" },
    { word: "铺天盖地", explain: "形容来势猛，声势大，到处都是。" },
    { word: "道听途说", explain: "途：道路。在路上听来的话，又在路上向人传播。指没有根据的传言。" },
    { word: "街谈巷议", explain: "指人们在街头巷尾闲谈议论。也指街头巷尾人们的议论。" },
    { word: "稗官野史", explain: "稗官：古代专门给帝王讲述街谈巷议、风俗故事的小官，后作为小说的 代称。野史：私家记载的逸闻琐事之作。后用来称小说及不见经传的逸 闻琐事的著述。" },
    { word: "脍炙人口", explain: "脍：切得很细的肉。炙：烤熟的肉。美味的食品人人爱吃。比喻好的诗 文或事物为众人所喜爱和传诵。" },
    { word: "津津乐道", explain: "指很有兴趣地谈论。" },
    { word: "喜闻乐见", explain: "意思是喜欢听，乐意看。形容很受欢迎。" },
    { word: "深入人心", explain: "指思想、理论等广泛地得到人们的理解和接受。" },
    { word: "三人成虎", explain: "比喻说的人多了，就能使人们把谣言当作事实。" },
    { word: "众口铄金", explain: "铄：熔化金属。原指众人的言论能使金属熔化，后比喻舆论力量强大或 流言积累可混淆是非。" },
    { word: "烟消云散", explain: "比喻事物全部消失。同“烟消雾散”。" },
    { word: "灰飞烟灭", explain: "比喻人或事物迅即消失。" },
    { word: "化为乌有", explain: "乌有：虚幻，不存在。指变得什么都没有。" },
    { word: "子虚乌有", explain: "指假设的、不存在的事情。" },
    { word: "稍纵即逝", explain: "纵：放松。逝：消失。稍微一放松就消失了。形容时间或机会很容易失 掉。" },
    { word: "昙花一现", explain: "比喻人或事物存在的时间很短，刚一出现就迅速消失了。" },
    { word: "销声匿迹", explain: "销声：消除声音。匿迹：隐匿踪迹。指隐藏起来或不公开露面。同“消 声匿迹”“匿迹销声”。" },
    { word: "偃旗息鼓", explain: "偃：放倒。息：停息。放倒旗帜，停止击鼓，指军队为不暴露目标而隐 蔽行动或停止作战。后也比喻事情中止。也作“掩旗息鼓”。" },
    { word: "死灰复燃", explain: "死灰：冷却了的灰。燃：烧。冷却的灰又重新烧起来。比喻失势的人又 重新得势。也比喻已经消亡的事物又重新活动起来。多含贬义。" },
    { word: "卷土重来", explain: "卷土：卷起尘土。形容人马奔跑之状。比喻失败以后又重新恢复势力； 也比喻消失了的人或事物重新出现。(中性，多贬义)" },
    { word: "沉渣泛起", explain: "渣：渣滓。泛：浮。已经沉到水底的渣滓又漂浮了起来。比喻已经绝迹 了的腐朽、陈旧事物又重新出现。(贬义)" },
    { word: "土崩瓦解", explain: "瓦解：制瓦时先把陶土制成圆筒形，分解为四，即成瓦，比喻事物的分 裂。像土崩塌，瓦破碎一样，不可收拾。比喻彻底垮台。" },
    { word: "分崩离析", explain: "分：分开。崩：倒塌。离析：离散。形容家庭、集团、组织或国家分裂 瓦解。" },
    { word: "毋庸置疑", explain: "毋：无。庸：用。置疑：怀疑。用不着怀疑。" },
    { word: "显而易见", explain: "事情或道理非常明显，极容易看清楚。" },
    { word: "不言而喻", explain: "喻：明白。不用说什么就能明白。也作“不言自明”。" },
    { word: "昭然若揭", explain: "昭然：明显、显著的样子。揭：原意为高举，现也指揭开。意思是形容 真相毕露，所有一切都已显现了出来。" },
    { word: "有目共睹", explain: "形容人人都可以看到，极其明显。" },
    { word: "一目了然", explain: "一眼就看得很清楚。形容事物、事情原委很清晰，一看就知道是怎么回 事。" },
    { word: "大张旗鼓", explain: "形容进攻的声势和规模很大；也形容群众活动声势和规模很大。" },
    { word: "无处遁形", explain: "遁：迁移、离去；形：形体、踪迹。指没有地方可以隐藏形迹，形容在 严密检查或困境下彻底暴露，无法逃避。" },
    { word: "语焉不详", explain: "是指虽然提到了，但说得不详细。" },
    { word: "讳莫如深", explain: "原意为事件重大，讳而不言。后指把事情隐瞒得很紧。" },
    { word: "暗度陈仓", explain: "意思是指暗中进行某种活动。" },
    { word: "不露声色", explain: "意思是心里面的计划或者想法并不通过言语和面部表情直接表现出来。" },
    { word: "闪烁其词", explain: "指说话故意含糊其辞、回避真相或要害问题，带有遮掩或推诿的意味。" },
    { word: "扑朔迷离", explain: "出自《木兰诗》:“雄兔脚扑朔，雌兔眼迷离”,形容事情错综复杂、 难以分辨清楚。" },
    { word: "雾里看花", explain: "原指年老眼花，看花像隔了一层雾一样。现形容对事物看不真切。" },
    { word: "似是而非", explain: "指好像是对的，实际上不对；好像是，又好像不是。形容相似而不同但 又容易被混淆的事物。" },
    { word: "高深莫测", explain: "高深：山川高而且深；测：测量。指为人或事深沉不可测，使人难以理 解。" },
    { word: "含糊其辞", explain: "辞：话。话说得不清不楚，含含糊糊。形容有顾虑，不敢把话照直说出 来。" },
    { word: "置若罔闻", explain: "置：放，指放在一边。若：好像。罔：没有。放在一边，好像没有听到 。指不加理睬。" },
    { word: "熟视无睹", explain: "熟视：细看，经常看。睹：看见。看惯了就像没看见一样。也指对眼前 的事物或现象漠不关心。" },
    { word: "闭目塞听", explain: "塞：堵塞。闭着眼睛，堵住耳朵。指不与外界接触，脱离实际。" },
    { word: "充耳不闻", explain: "充：塞住。形容故意不听别人的话。也形容对某些事漠不关心。也作“ 听而不闻”。(主观上故意或不重视)" },
    { word: "置之不理", explain: "置：放置。理：理睬。指放在一边而不予理睬。也作“置之不顾”。" },
    { word: "嗤之以鼻", explain: "嗤：讥笑。用鼻子发出笑声，表示轻蔑，不以为然。" },
    { word: "视如敝屣", explain: "敝屣：破鞋子。像破烂鞋子一样看待。比喻非常轻视。" },
    { word: "不屑一顾", explain: "不屑：认为不值得。顾：回头看。不值得一看，表示轻视、看不起。" },
    { word: "束之高阁", explain: "阁：放东西的架子。把东西捆绑起来，放在高高的架子上。比喻弃置不 用。(多形容有价值的东西)" },
    { word: "爱不释手", explain: "释：放下。喜爱得舍不得放手。" },
    { word: "手不释卷", explain: "卷：古代指抄写的卷帙，即书籍。手中一直拿着书籍片刻不放。形容勤 勉好学或读书入迷。" },
    { word: "视若珍宝", explain: "形容十分珍爱，将其当成无价之宝。" },
    { word: "奉为圭臬", explain: "奉：信奉，尊奉。圭臬：古代用以测日影的仪器，比喻法度或准则。指 把某些事物或言论尊奉为准则。" },
    { word: "举足轻重", explain: "形容有实力，地位重要，能左右局势的发展。" },
    { word: "无足轻重", explain: "没有它并不轻些，有它也并不重些。指无关紧要。" },
    { word: "细枝末节", explain: "末节：小事情，小节。细小的树枝，微末的环节。比喻事情或问题的细 小而无关紧要的部分。" },
    { word: "驾轻就熟", explain: "比喻对所做的事情熟悉，办起来容易。" },
    { word: "轻车熟路", explain: "轻车：负载轻的车子。驾着负载很轻的车子，走熟悉的道路。比喻事情 又轻松又熟悉，办起来很容易。" },
    { word: "了如指掌", explain: "了：明了，明白。指掌：指着手掌。指对事物的了解非常清楚，像把东 西放在手掌里让人看一样。" },
    { word: "耳熟能详", explain: "详：详细地说出来。指听得多了，也就能详尽地讲述出来。" },
    { word: "如数家珍", explain: "家珍：家中收藏的珍宝。如同数自己家藏的珍宝那样清楚。形容对所讲 述的东西非常熟悉。" },
    { word: "烂熟于心", explain: "烂：程度很深。心中有数，十分熟悉。" },
    { word: "妇孺皆知", explain: "孺：小孩。妇女、小孩全都知道。指众所周知。" },
    { word: "家喻户晓", explain: "喻：知道，明白。家家户户都知道。形容人人皆知。" },
    { word: "不甚了了", explain: "意思是指心里不太明白，不是很清楚。" },
    { word: "默默无闻", explain: "意思是指做事无声无息，无人知晓，做了好事不声张，不图名利，没人 知道。" },
    { word: "鲜为人知", explain: "鲜：少。为：被。知：知道。很少有人知道。" },
    { word: "匪夷所思", explain: "形容人的思想、言谈、技艺、事情等离奇，超出寻常，指行为举止离奇 古怪，超出常情，不是一般人根据常理所能想象的。" },
    { word: "不可思议", explain: "原有神秘奥妙的意思，是佛教用语。现多指无法想象，难以理解。" },
    { word: "感同身受", explain: "意为内心感激就如同亲身受到恩惠一样。后指虽未亲身经历，但感受就 同亲身经历过一样。" },
    { word: "设身处地", explain: "设：设想；身：自身。指设想自身处在别人的地位或环境中，替别人的 处境着想。" },
    { word: "身临其境", explain: "身：亲身。指亲自到了那个境地，获得切身的感受。" },
    { word: "推己及人", explain: "推：推想。指以自己的心思去推想别人的心思，设身处地为别人着想。" },
    { word: "司空见惯", explain: "原指司空看惯了某事以为平淡；后比喻常见之事；不足为奇。" },
    { word: "屡见不鲜", explain: "鲜：新鲜。经常见到，并不新鲜。同“数见不鲜”。" },
    { word: "习以为常", explain: "常做某种事情或常见某种现象，成了习惯，就觉得很平常了。" },
    { word: "不足为奇", explain: "不值得奇怪。指某些现象或事物很平常，没有什么特别的。" },
    { word: "见怪不怪", explain: "看到奇异的事物，镇定自若，不大惊小怪。" },
    { word: "无独有偶", explain: "意思是虽然罕见，但是不止一个，还有可以配对的，表示两件事或两个 人十分相似。" },
    { word: "习焉不察", explain: "习：习惯；焉：语气词，有“于此”的意思；察：觉察。指经常接触某 种事物，反而觉察不到其中存在的问题。" },
    { word: "微不足道", explain: "微：微小；道：谈起。意义、价值等小得不值得一提。" },
    { word: "各持己见", explain: "持：抓住不放。各人都坚持自己的意见。" },
    { word: "众说纷纭", explain: "纷纭：多而姑乱。人多嘴杂，议论纷纷。(前面可加主语，也可不加主 语；有时可做形容词)(侧重观点多)" },
    { word: "莫衷一是", explain: "莫：不能。衷：折衷，判断。是：对。不能断定哪个对，哪个不对。也 指意见纷纭，分歧很大，不能得出一致的结论。(侧重观点难以统一)" },
    { word: "针锋相对", explain: "意思是针尖对锋芒。比喻双方在策略、论点及行动方式等方面尖锐对立" },
    { word: "各执一词", explain: "指不同的人或群体持有不同的说法或观点，且这些观点往往相互对立， 强调多方观点的对立与争论。核心在于展现不同立场间的矛盾冲突，常 用于描述公开争论或复杂局面。" },
    { word: "见仁见智", explain: "对同一事物或问题，不同的人因立场、角度或认知差异会产生不同的理 解和看法。强调观点的主观性和多样性，常用于表达对分歧的包容态度 ○" },
    { word: "各抒己见", explain: "抒：抒发、发表；见：见解。意指各人充分表达自己的见解。" },
    { word: "不置可否", explain: "置：搁置，安放；可否：可以不可以。不说可以，也不说不可以。指不 表明自己的态度。" },
    { word: "模棱两可", explain: "模棱：含糊，不明确；两可：可以这样，也可以那样。指不表示明确的 态度，或没有明确的主张。" },
    { word: "人心所向", explain: "意思指的是人民群众所拥护的、向往的事物或者方向。" },
    { word: "人心向背", explain: "人心：民众的意愿；向背：拥护或反对。指人民群众出自内心的拥护或 反对。" },
    { word: "不负众望", explain: "意思是指为人所信服，很争气，不辜负大家的期望。" },
    { word: "不孚众望", explain: "孚：信服。不能使群众信服。" },
    { word: "异口同声", explain: "不同的人说出相同的语，用于形容众人意见一致。" },
    { word: "众口一词", explain: "指所有人说同样的话，形容意见完全一致。" },
    { word: "一孔之见", explain: "从一个小孔里看到的事物。比喻片面的观点见解。多谦称自己的看法。" },
    { word: "管窥蠡测", explain: "管：竹管。窥：从孔隙中看。蠡：夸瓜瓢瓜。测：测量。管中视天，以瓢量 海水，喻眼光狭小，见识不广或不自量力。(中性词)(侧重整体与部 分对比)" },
    { word: "盲人摸象", explain: "比喻看问题不全面，以偏概全。(现更多用字面义，形容做一件事毫无 头绪地摸索)" },
    { word: "管中窥豹", explain: "管：竹管。从管中看豹。比喻见识狭小，看不到全面。(也可以比喻只 看事物的一部分而推测全貌一最近多用)(中性词)(侧重整体与部分 对比)" },
    { word: "坐井观天", explain: "比喻眼界不开阔，见识不广。" },
    { word: "一叶障目", explain: "眼睛被一片树叶挡住，指看不到事物的全貌。" },
    { word: "断章取义", explain: "引用他人文章或谈话，只截取其中一段的意思，而不顾全文和原意。" },
    { word: "一叶知秋", explain: "看见一片落叶，就知道秋天将临。比喻发现一点预兆就知道事物将来的 发展趋向。也作“落叶知秋”“叶落知秋”。(侧重从预兆推知未来)" },
    { word: "见微知著", explain: "微：小，指事物微小的迹象。著:显明，指事物的发展。谓看到事物的 苗头，就能知道它的未来发展趋势和实质。同“睹微知著”。(侧重大 小对比)" },
    { word: "由表及里", explain: "表：表面；及：达到、直达；里：本质。从表面现象看到本质。" },
    { word: "冰山一角", explain: "比喻事物已经显露出来的一小部分，隐含的内容或真相往往更为复杂和 深刻。" },
    { word: "可见一斑", explain: "一斑：豹身上的一块斑纹。比喻从观察到的事物的一部分可以推知其全 貌。" },
    { word: "远见卓识", explain: "解释为有远大的眼光和卓越的见解。" },
    { word: "真知灼见", explain: "灼：明白，透彻。指正确而透彻的认识，高明的见解。" },
    { word: "鞭辟入里", explain: "形容做学问切实。今多形容分析问题透彻，切中要害。" },
    { word: "一针见血", explain: "意思是比喻说话直截了当，切中要害。" },
    { word: "一语中的", explain: "意思是指一句话就说中要害，一句话就说清了事情的重点。" },
    { word: "一语成谶", explain: "就是一句(不好的)话说中了，就是“不幸而言中”(不吉利的事情， 诅咒别人似的)。" },
    { word: "字字珠玑", explain: "比喻说话或文章的词句非常优美，就像每个字都是珍贵的珍珠一样。" },
    { word: "颠扑不破", explain: "颠：跌到；扑：拍打；破：打破。比喻学说或理论正确可靠，无法被推 翻。" },
    { word: "针砭时弊", explain: "针：中医针刺疗法；砭：砭石刮治医术；时弊：特定时期的社会问题。 比喻用尖锐的言辞揭示社会弊端，批评时代错误，以求改正和社会进步" },
    { word: "洞若观火", explain: "洞：透彻。指清楚得就像看火一样，形容观察事物透彻分明。" },
    { word: "明察秋毫", explain: "明：视觉敏锐；察：看；秋毫：鸟兽秋天新长出的细毛。本义为视力好 到能查辨秋天鸟兽的细毛；后多形容人精明，目光敏锐，能洞察一切。" },
    { word: "一览无余", explain: "览：看。余：剩余。形容一下子就可以看清楚。同“一览无遗”“一览 而尽”。(侧重看的全)" },
    { word: "大有可为", explain: "比喻指前途极有希望，值得去做" },
    { word: "无可厚非", explain: "意为不可过分指责，表示虽有缺点，但是可以理解或原谅。也说未可厚 非。" },
    { word: "无可非议", explain: "意思是没有什么可以指责的，表示言行合乎情理。可用来形容人、事、 思想、行动、品质等。" },
    { word: "差强人意", explain: "差：尚，稍微。强：振奋。还算能振奋心意。形容大致上还能够令人满 意 。(现多误用，辨析词义)" },
    { word: "毋庸讳言", explain: "意思是指用不着隐讳，可以直说的内容。毋庸指不用。" },
    { word: "缄口不言", explain: "缄：封闭；言：说话。封住嘴巴；不开口说话。" },
    { word: "乏善可陈", explain: "善：良好成绩；陈：陈述，告诉。意思是没有什么好的可以称道的。" },
    { word: "外强中干", explain: "外强：外表强大；中干：内部枯竭，缺乏支撑或实质力量。指外表强 大，内实空虚。" },
    { word: "名副其实", explain: "名：名声；副：符合；实：实际。指名声或名称与实际相符合。" },
    { word: "当之无愧", explain: "当：担当、承当；无愧：毫无愧色，不必感到惭愧。指承受得起某种称 号或荣誉而毫无惭愧，强调资格或成就与所获荣誉相匹配。" },
    { word: "色厉内荏", explain: "色：神色、模样；厉：严厉强硬；荏：软弱怯懦。指外表强硬，内心虚 弱。" },
    { word: "敬而远之", explain: "敬：尊敬；远：表示不接近。指表面上表示尊敬却不愿接近。" },
    { word: "难能可贵", explain: "难：困难；能：能够、有能力做到；可：值得；贵：珍贵。指难以实现 之事得以完成而显得珍贵。" },
    { word: "凤毛麟角", explain: "凤毛：凤凰的毛。麟角：鹿麒麟的角。比喻珍贵而稀少的人或事物。" },
    { word: "寥若晨星", explain: "稀少得好像清晨的星星一样。形容很少。" },
    { word: "屈指可数", explain: "屈：弯曲。指：手指。可数：可以数清。扳着手指就可以数清楚，形容 数量极少、非常稀少。" },
    { word: "九牛一毛", explain: "九头牛身上的一根毛，比喻极大数量中极其微小、微不足道的一部分。" },
    { word: "沧海一粟", explain: "沧海：大海；粟：谷子、小米。大海里的一粒小米，比喻非常渺小、微 不足道，在宏大的事物里占极其微小的一部分。" },
    { word: "车载斗量", explain: "能用车载，能用斗量，比喻数量多，不可胜数，多指不足为奇，很常见" },
    { word: "不胜枚举", explain: "胜：尽。枚：量词，个。举：列举。不能够一个一个地全部列举出来。 形容数量很多。(多用于形容举例子/枚举时)" },
    { word: "俯拾皆是", explain: "形容到处都有，很容易取得。" },
    { word: "数不胜数", explain: "数：计算。胜：尽。形容数量极多，数也数不完。" },
    { word: "不一而足", explain: "不是一事一物能够使之满足的。后也用来形容所说的事物或现象不止一 种，而是很多，不能——列举。" },
    { word: "五花八门", explain: "原指五行阵和八门阵。这是古代两种战术变化很多的阵势。比喻变化多 端或花样繁多。" },
    { word: "包罗万象", explain: "包罗：包括；万象：宇宙间的一切景象，指各种事物。形容内容丰富， 应有尽有。" },
    { word: "林林总总", explain: "林林：众多的样子；总总：众多而杂乱的样子。形容众多。" },
    { word: "比比皆是", explain: "比比：到处、处处。到处都是，形容数量非常多、随处可见" },
    { word: "不可胜数", explain: "胜：尽。多的数不尽，形容数量极多。" },
    { word: "不计其数", explain: "没法计算数目，形容数量极多。" },
    { word: "汗牛充栋", explain: "充：装满。栋：栋宇，房屋。形容藏书或者著作极多。" },
    { word: "浩如烟海", explain: "浩：广大。烟海：雾气弥漫的大海。形容事物(多指书籍、文献等)数 量繁多，极其丰富。" },
    { word: "卷帙浩繁", explain: "形容书籍很多或一部书的篇幅很长。" },
    { word: "错落有致", explain: "意思是形容事物的布局虽然参差不齐，但却极有情趣，使人看了有好感" },
    { word: "鳞次栉比", explain: "鳞：鱼鳞。次：次序。栉：梳子和篦子的总称。比：排列。像鱼鳞或梳 篦的齿那样紧密地排列着。形容建筑物等密集、排列整齐的样子。" },
    { word: "星罗棋布", explain: "意思是像天空中的星星和棋盘上的棋子一样罗列、分布着。形容数量众 多，散布的范围很广。" },
    { word: "美轮美奂", explain: "多用于形容建筑物雄伟壮观，富丽堂皇；也用来形容雕刻或建筑艺术的 精美效果。" },
    { word: "富丽堂皇", explain: "形容建筑物宏伟豪华。" },
    { word: "雕梁画柱", explain: "彩绘装饰得十分华丽的房屋。" },
    { word: "流光溢彩", explain: "流动的光影，满溢的色彩。形容光彩明亮绚烂、色彩华丽耀眼。" },
    { word: "飞阁流丹", explain: "飞阁：凌空高架的楼阁、廊桥。流丹：朱红漆彩鲜亮欲滴，像在流动。 形容建筑高耸凌空、彩绘鲜艳夺目，精巧华丽。" },
    { word: "如出一辙", explain: "辙：车辙。好像出自同一车辙。比喻两种事物非常相似。(或两种以上 事物)" },
    { word: "千篇一律", explain: "一千篇文章都是一个样子。形容事物形式、内容呆板雷同，没有新意、 毫无变化。" },
    { word: "不约而同", explain: "原意是事先没有约定而一齐前来会合。后用来指没有事先商量约定而彼 此的看法或言行相同。(侧重行为上)" },
    { word: "不谋而合", explain: "谋：商量；合：相同。事先没有商量而彼此的做法或意见却相同。也作 “不谋而同”。(侧重思想上)" },
    { word: "殊途同归", explain: "殊：不同的；途：道路，途径；归：趋向。从不同的道路，走到同一个 目的地。比喻采取不同的方法而得到相同的结果。" },
    { word: "异曲同工", explain: "曲：曲调。工：工巧，精致。比喻不同人的文艺作品同样精彩。也比喻 不同的做法有同样的好的效果。" },
    { word: "大相径庭", explain: "径：门外小路。庭：厅堂前的院子。指彼此相差很远或截然不同。" },
    { word: "泾渭分明", explain: "泾、渭：甘肃、陕西境内的两条河。古人认为泾水清、渭水浊。泾水流 入渭水时，清浊不混。比喻界限清楚、是非分明。" },
    { word: "千姿百态", explain: "形容姿态、形态多种多样，各不相同。" },
    { word: "相去甚远", explain: "互相之间存在很大差异和距离。" },
    { word: "判若云泥", explain: "意思是高低差别就像天上的云彩和地下的泥土那样悬殊。" },
    { word: "天壤之别", explain: "指高天和平地的区别。极言差别之大。" },
    { word: "天差地别", explain: "形容两者差距极大、完全不一样，一个天上一个地下。" },
    { word: "迥然不同", explain: "迥然：相差很远的样子。形容事物之间差异显著、毫无相似之处。" },
    { word: "各有千秋", explain: "千秋：千年，指久远。各自有其可以长久流传的价值。也比喻各有各的 优点和特色。" },
    { word: "平分秋色", explain: "原指昼和夜平均分占秋天景色。后比喻双方各得一半。也比喻两方平 手，不分上下。" },
    { word: "分庭抗礼", explain: "庭：庭院。抗：对等。客人与主人分立在庭的两侧，以平等的地位相对 行礼。后用来比喻彼此地位或势力相等，平起平坐或互相对立。" },
    { word: "巧夺天工", explain: "夺：压倒，胜过。人工的精巧胜过天然。形容技艺精妙高超。" },
    { word: "精雕细琢", explain: "精心细致地雕刻琢磨。形容做事仔细用心。多指艺术品的创作。" },
    { word: "鬼斧神工", explain: "形容技艺高超神妙。同“神工鬼斧”。(侧重非人工的)" },
    { word: "炉火纯青", explain: "意思是认为炼到炉里发出纯青色的火焰就算成功了，后用来比喻功夫达 到了纯熟完美的境界。" },
    { word: "登堂入室", explain: "堂、室：古代宫室前为堂后为室。比喻学识由浅入深，逐步达到很高的 成就。同“升堂入室”。" },
    { word: "登峰造极", explain: "意思是登上顶峰，指到达最高点；比喻学问、技艺等已达到最高的境界 。" },
    { word: "目无全牛", explain: "比喻技艺熟练到了得心应手的境界。" },
    { word: "庖丁解牛", explain: "解：分解。比喻经过反复实践，掌握了事物的客观规律，做事得心应 手，运用自如。" },
    { word: "出神入化", explain: "形容技艺、文笔、表演等高超到绝妙的境界，达到神妙完美、炉火纯青 的地步。" },
    { word: "蔚为大观", explain: "蔚：茂盛；大观：盛大的景象。发展成为盛大壮观的景象。形容事物美 好繁多，给人一种盛大的印象。" },
    { word: "洋洋大观", explain: "洋洋：盛大、众多的样子；大观：丰富多彩的景象。形容美好的事物众 多丰盛。" },
    { word: "琳琅满目", explain: "琳琅：美玉。所见皆美玉。比喻杰出人才、好文章或精美物品很多。 (多形容商品)" },
    { word: "引人入胜", explain: "引：吸引。胜：胜地。带人进入风景优美的地方。形容风景、作品很吸 引人。" },
    { word: "雅俗共赏", explain: "文雅的人和通俗的人都能欣赏。形容文艺作品格调适中、既有内涵又通 俗易懂，大众和行家都喜欢。" },
    { word: "叹为观止", explain: "叹：赞叹。观止：看到这里就停止，不再看别的了，称赞所看的事物尽 善尽美。赞美所看到的事物好到了极点。" },
    { word: "赏心悦目", explain: "悦目：看了舒服。指看到美好的景色而心情愉快。" },
    { word: "目不暇接", explain: "暇：空闲。接：接触。眼睛来不及看。形容吸引人的事物很多，看不过 来。(主语是人)" },
    { word: "眼花缭乱", explain: "缭乱：纷乱。因看到繁杂的事物而感到迷乱。(主语是人)" },
    { word: "心驰神往", explain: "驰：奔驰。心神奔向所向往的事物。形容一心向往。" },
    { word: "魂牵梦萦", explain: "在梦魂中还牵挂萦绕着。形容思念深切，无法排遣。" },
    { word: "拍案叫绝", explain: "拍：拍打；案：桌子。形容对某事物极度赞赏。" },
    { word: "目不转睛", explain: "眼睛一动不动地盯着看，形容注意力高度集中。" },
    { word: "侃侃而谈", explain: "“侃侃”指理直气壮，从容不迫。该成语可以表示一个人在说话时表现 出的自信和从容，也可以形容一个人善于交谈、风度翩翩。(褒义词)" },
    { word: "高谈阔论", explain: "指漫无边际地大发言论(多含贬义)。" },
    { word: "夸夸其谈", explain: "说话或写文章浮夸、不切实际。" },
    { word: "口若悬河", explain: "“悬河”指瀑布。意为说话滔滔不绝，像河水倾泻一样，形容能说善 辩，话语不断。" },
    { word: "巧舌如簧", explain: "意思是舌头灵巧，能言善辩，形容能说会道，善于狡辩。" },
    { word: "巧言令色", explain: "用来形容那些擅长使用花言巧语和伪善的面容来取悦他人的人。(含贬 义 )" },
    { word: "娓娓道来", explain: "是一种说话的方式，意思是不紧不慢地、从容地讲述。" },
    { word: "信口雌黄", explain: "信：任凭，听任；雌黄：即鸡冠石，黄色矿物，用作颜料。古人用黄纸 写字，写错了，用雌黄涂抹后改写。比喻不顾事实，随口乱说。" },
    { word: "言简意赅", explain: "赅：完备。形容言语简练而意思完备。" },
    { word: "直言不讳", explain: "讳：避忌、隐瞒。指说话坦率直白，毫无隐瞒与顾忌，有话直说。" },
    { word: "人云亦云", explain: "云：说。人家怎么说，自己也跟着怎么说。指没有主见或创见。(侧重 于说)" },
    { word: "拾人牙慧", explain: "拾：捡取。牙慧：指别人说过的话。比喻袭用他人的意见或言论。" },
    { word: "推心置腹", explain: "意思是把赤诚的心交给人家。比喻真心待人。" },
    { word: "开诚布公", explain: "开诚：敞开胸怀，表示诚意。布公：公正无私地发表自己的见解。表示 坦白无私，真诚相待，能诚恳坦率地提出自己的看法。" },
    { word: "披肝沥胆", explain: "披：剖露。沥：滴下。露出肝脏，滴出胆汁。比喻对人对事非常忠诚。" },
    { word: "老调重弹", explain: "调：调子；曲调。陈旧的曲调重新弹奏。比喻已经说过的话再说过；也 指说话或文章没有新意。" },
    { word: "陈词滥调", explain: "陈词：陈旧的不合实用的言辞；滥：空泛；失真。陈旧、空泛、不切实 际的论调。" },
    { word: "老生常谈", explain: "老书生经常讲的话。比喻听厌了的没有新鲜意思的话。(也做中性)" },
    { word: "不经之谈", explain: "不经：不合常理、没有根据。指荒诞无稽、没有根据的言论。" },
    { word: "无稽之谈", explain: "无稽：没有考证、没有根据。指完全没有事实依据的说法和言论。" },
    { word: "流言蜚语", explain: "毫无根据的坏话、谣言和私下议论，多指背后恶意中伤、搬弄是非的话" },
    { word: "危言耸听", explain: "故意说吓人、夸张离谱的话，使人听了震惊害怕。" },
    { word: "绘声绘色", explain: "绘：描绘。形容描写、叙事生动逼真。同“绘声绘影”“绘影绘声”。" },
    { word: "活灵活现", explain: "意思是形容神情逼真、传神，使人有亲眼所见的感觉。" },
    { word: "惟妙惟肖", explain: "惟：语气助词。肖：相像。形容描写、模仿得非常逼真。" },
    { word: "栩栩如生", explain: "栩栩：生动的样子。指艺术形象非常逼真，如同活的一样。" },
    { word: "有声有色", explain: "形容说话或表演精彩生动。" },
    { word: "一板一眼", explain: "比喻言语、行动有条理或合规矩。有时也比喻做事死板，不懂得灵活掌 握。" },
    { word: "呼之欲出", explain: "字面意思是叫一声就像会出来似的，形容画像或文学作品的人物描写非 常生动逼真，也可指某事即将揭晓或出现。" },
    { word: "此起彼伏", explain: "这里起来，那里落下。表示频繁地出现或产生。同“此起彼落”。( 多 形容声音或事物接连不断出现)" },
    { word: "经久不息", explain: "经过长时间停不下来。" },
    { word: "震耳欲聋", explain: "形容声音很大，耳朵都快震聋了。" },
    { word: "人声鼎沸", explain: "鼎：古代煮食器；沸：沸腾。形容人群的声音吵吵嚷嚷，就像煮开了锅 一样。" },
    { word: "沸反盈天", explain: "沸：沸腾。反：翻转。盈：充满。像沸腾的水那样翻滚着，响声充满了 空间。形容喧哗吵闹，一片混乱，强调现场声音的极度喧闹与混乱，直 接描述具体场合的嘈杂声(如集会、争吵现场)。(程度稍重)" },
    { word: "沸沸扬扬", explain: "像水沸腾后气泡、热气蒸腾翻滚一样，形容人声喧扰，议论纷纷，侧重 描述议论的广泛传播，多用于抽象信息(如流言、政策)的传播扩散。" },
    { word: "佶屈骜牙", explain: "佶屈：曲折；聲牙：不顺口。指文章读起来不顺口。" },
    { word: "入木三分", explain: "形容书法笔力强劲。后也比喻看问题精辟、深刻。(也可形容对人物的 描写刻画形象深刻)" },
    { word: "只言片语", explain: "简短零碎的话语、文字。形容语言文字数量极少。" },
    { word: "妙笔生花", explain: "比喻文笔高超、才思敏捷，写出的诗文或书画精彩动人。" },
    { word: "春秋笔法", explain: "即用笔曲折而意含褒贬的写作手法。" },
    { word: "皮里阳秋", explain: "意思是藏在心里不说出来的言论，表面上不直接发表评论，但实际上内 心有着褒贬不同的看法。" },
    { word: "微言大义", explain: "意思是包含在精微语言里的深刻的道理。" },
    { word: "字斟句酌", explain: "用来形容人在写作或说话时的态度非常认真和细致，对于每一个字词和 句子都会进行仔细地考虑和推敲。" },
    { word: "连篇累牍", explain: "形容篇幅过多，文辞冗长。" },
    { word: "妙趣横生", explain: "洋溢着美妙的意趣，多指语言、文章、故事、表演等生动有趣，一点不 枯燥。" },
    { word: "一气呵成", explain: "①形容文章的气势首尾贯通。②形容完成整个工作的过程中不间断，不 松懈。" },
    { word: "倚马可待", explain: "倚靠着即将出征的战马起草文件，却可以立等完稿。形容文思敏捷，文 章写得快。" },
    { word: "一挥而就", explain: "原义是一挥笔就能成功(就：完成)。指才思敏捷，写字、作文或画画 速度很快。" },
    { word: "文不加点", explain: "点：古人写文章在字的右上角涂一点，表示删去。文章不用涂改，一气 写成。形容文思敏捷，写作技巧高超。" },
    { word: "身无长物", explain: "除自身外再没有多余的东西。形容贫穷。" },
    { word: "一文不名", explain: "形容人非常穷困，一文钱都没有。" },
    { word: "一穷二白", explain: "穷：指物质基础差；白：指文化和科学落后。比喻基础差，底子薄。" },
    { word: "积贫积弱", explain: "意思是长期积累的贫困衰弱，形容极度的贫困和弱小。或指以前的行为 导致现在的衰弱局面。" },
    { word: "筚门圭窦", explain: "筚门：柴门(用竹条或树枝编成的门)。圭窦：上尖下方的圭形的门洞 。形容住室极其简陋。旧指穷人住处。" },
    { word: "桑枢瓮牖", explain: "枢：门上的转轴；瓮牖：简陋的窗户。用桑树做门轴，用瓦罐做窗户， 比喻贫苦之家。" },
    { word: "肥马轻裘", explain: "裘：皮衣。骑肥壮的马，穿轻暖的皮衣。形容阔绰。" },
    { word: "钟鸣鼎食", explain: "钟：古代乐器；鼎：古代炊器。击钟列鼎而食。形容贵族的豪华排场。" },
    { word: "养尊处优", explain: "养：指生活。指生活在有人伺候、条件优裕的环境中。" },
    { word: "待价而沽", explain: "待价：指等待高价；沽：卖，出售。多比喻等待有好的待遇、条件才肯 答应任职或做事。" },
    { word: "奇货可居", explain: "奇货：珍贵的货物；居：囤积。意为把稀有的货物储存起来，等待高价 卖出去，后比喻拿某种专长或独占的东西作为资本，等待时机，以捞取 名利地位。" },
    { word: "随遇而安", explain: "随：顺从。遇：境遇。安：安然。处在任何环境中，都能安然自得，感 到满足。" },
    { word: "安之若素", explain: "素：平常。指身处逆境、遭到困难或遭受挫折时能泰然处之，跟平常一 样。" },
    { word: "安贫乐道", explain: "道：主张，思想。安于贫穷，以坚持自己的信念为乐。旧时士大夫所主 张的为人处世之道。" },
    { word: "泰然处之", explain: "面对紧急情况或困难时，保持冷静并妥善处理，强调对具体问题的应对 态度和行动。" },
    { word: "神色自若", explain: "外表神态自然，不显露紧张或慌乱，侧重于外在表情的平稳，不因外界 影响而变化。" },
    { word: "从容不迫", explain: "从容：不慌不忙，很镇静；不迫：不急促。不慌不忙，沉着镇定。" },
    { word: "波澜不惊", explain: "本义：水面风平浪静，没有波浪。引申义：形容人心态沉稳、遇事淡 定，情绪毫无起伏；形容局面、局势平稳无变化，没有风波和动荡。" },
    { word: "踌躇满志", explain: "形容对自己的现状或取得的成就非常得意、满怀信心，志向得到满足， 神态得意从容。" },
    { word: "意气风发", explain: "精神振作、气概豪迈，朝气蓬勃、充满干劲与理想抱负。侧重年轻有朝 气、精神昂扬，偏褒义。" },
    { word: "心旷神怡", explain: "心境开阔，精神愉悦舒畅。" },
    { word: "无所适从", explain: "适：往。从：跟随。不知听从哪一个好。指不知该怎么办。(侧重面临 选择)" },
    { word: "如坐针毡", explain: "像坐在插着针的毡子上。形容心神不定，坐立不安。" },
    { word: "如芒在背", explain: "如同芒刺扎于背上，形容焦躁的心情。" },
    { word: "手足无措", explain: "措：安放。手脚不知放到哪里才好。形容举止慌乱，或无法应对。" },
    { word: "杯弓蛇影", explain: "将映在酒杯里的弓影误认为蛇。比喻因疑神疑鬼而引起恐惧。" },
    { word: "心浮气躁", explain: "内心轻浮不沉稳，性情急躁不安；做事静不下心、没耐心，容易浮躁冲 动。" },
    { word: "举棋不定", explain: "拿着棋子不知下哪一步好。比喻遇事犹豫不决，拿不定主意。" },
    { word: "噤若寒蝉", explain: "噤：闭口不作声。像深秋的蝉那样一声不吭。比喻因害怕有所顾虑而不 敢说话。" },
    { word: "谈虎色变", explain: "色：脸色。比喻一提起可怕的事情，脸色就变了。" },
    { word: "畏首畏尾", explain: "形容做事胆小，多所猜忌顾虑，畏缩不前。" },
    { word: "投鼠忌器", explain: "投：用东西去掷；忌：怕，有所顾虑。想用东西打老鼠，又怕打坏了近 旁的器物。比喻做事有顾忌，不敢放手干。" },
    { word: "肆意妄为", explain: "妄：胡乱，非分的，超出常规的。妄为：胡作非为。指不顾一切由着自 己的性子胡作非为。亦作“肆意妄行”。" },
    { word: "肆无忌惮", explain: "肆：放肆。忌：顾忌。惮：惧怕。非常放肆，毫无顾忌和畏惧。" },
    { word: "按图索骥", explain: "索：寻找。骥：良马。照着图像去寻找良马。比喻做事死守教条，而不 懂得变通。也比喻依据一定的线索去寻找事物。(中性词)" },
    { word: "刨根问底", explain: "比喻追究底细。" },
    { word: "顺藤摸瓜", explain: "摸：寻找。比喻按照某个线索查究事情。" },
    { word: "披沙拣金", explain: "从大量数据中筛选有价值信息。" },
    { word: "捕风捉影", explain: "比喻说话或做事时用似是而非的迹象做根据。" },
    { word: "妄自菲薄", explain: "妄：不合理地，无根据地。菲薄：轻视，瞧不起。毫无根据地小看自己 。形容自轻自贱。" },
    { word: "自惭形秽", explain: "惭：惭愧。形：形象，模样。秽：邪恶，丑陋。因为自己模样丑陋而感 到惭愧。也泛指自己觉得不如别人而感到惭愧。" },
    { word: "自暴自弃", explain: "暴：损害。弃：抛弃。指自己糟蹋自己，自己看不起自己，甘心于落后 。(程度较重)" },
    { word: "自怨自艾", explain: "自怨：悔恨自己的错误。自艾：改正自己的错误。原指悔恨并且改正自 己的错误，后多指悔恨。(埋怨自己)" },
    { word: "怨天尤人", explain: "怨：怨恨。天：指命运。尤：责怪。指遇到挫折、麻烦时一味抱怨命运 和别人，而不寻找自身的原因。(埋怨他人)" },
    { word: "夜郎自大", explain: "夜郎：汉代时位于我国西南部的一个小国。比喻妄自尊大。" },
    { word: "盛气凌人", explain: "盛气：骄横的气势。凌：欺负。指以骄横的气势欺负人。" },
    { word: "孤芳自赏", explain: "比喻自命清高、自我欣赏，脱离群体，看不起别人，只顾陶醉在自己的 才华或品性里。多为贬义。" },
    { word: "刮骨疗毒", explain: "刮去骨中的毒素，彻底清除伤害。比喻彻底整治、根除问题，强调决断 和勇气。" },
    { word: "壮士断腕", explain: "勇士手腕被毒蛇咬伤，立刻斩断手腕，防止毒液蔓延全身。比喻在紧要 关头，能当机立断，知所取舍。" },
    { word: "刀刃向内", explain: "把刀子的锋芒对准自己内部。比喻敢于正视自身问题、整治内部弊病， 不护短、不遮掩。侧重于自我反省、自我整改、从严治内。" },
    { word: "去腐生肌", explain: "中药医术用语，去掉腐烂的皮肉，长出新的肌肉。比喻清除腐朽落后、 有害的事物，催生新生力量、焕发新活力。" },
    { word: "猛药去疴", explain: "疴：重病、顽疾。用药力猛烈的药治好重病。比喻用严厉、强硬的手 段，整治根深蒂固的顽疾和积弊。" },
    { word: "弹冠相庆", explain: "弹冠：掸掉帽子上的灰尘。指即将做官而互相庆贺，多用于贬义。" },
    { word: "额手相庆", explain: "额手：把手举到额头上。把手举到额头上互相庆贺。" },
    { word: "优胜劣汰", explain: "指生物在生存竞争中适应力强的保存下来，适应力差的被淘汰。" },
    { word: "弱肉强食", explain: "弱者的肉是强者的食物。比喻弱者被强者所欺凌、吞并等。(常用于形 容竞争)" },
    { word: "粉墨登场", explain: "粉墨：傅粉施墨，指化妆。场：戏场，舞台。化好妆登台演戏。也比喻 登上政治舞台，含讥讽义。(字面义时为中性词，比喻义时为贬义词)" },
    { word: "百家争鸣", explain: "比喻各种学术派别竞相争辩鸣放。" },
    { word: "百花齐放", explain: "各色的鲜花一齐开放。后多比喻文艺上不同的形式和风格自由地发展。" },
    { word: "耸人听闻", explain: "耸：惊动。指故意夸大或捏造事实，使人听后感到震惊。" },
    { word: "骇人听闻", explain: "骇：震惊。使人听了非常吃惊、害怕。" },
    { word: "不易之论", explain: "易：更改。指不可更改的言论。" },
    { word: "不刊之论", explain: "刊：削，修改。不可改动或不可磨灭的言论。" },
    { word: "曲高和寡", explain: "曲：音乐曲调。高：高深。和：跟着唱。意为曲调越高深，能跟着唱的 人越少。比喻思想、言行、文艺作品等高深，不能为多数人所理解接受 0" },
    { word: "阳春白雪", explain: "原为战国时楚国的深奥高雅的歌曲。后泛指高雅、不通俗的文学艺术。" },
    { word: "戎马侄惚", explain: "戎马：本指战马，借指军事；佐惚：繁忙。形容军务繁忙。" },
    { word: "厉兵秣马", explain: "厉：同“砺”,磨；兵：兵器；秣：喂牲口。磨好兵器，喂好马。形容 准备战斗。" },
    { word: "不容置喙", explain: "喙：嘴。不容许插嘴。" },
    { word: "不容置疑", explain: "容：允许。不允许加以怀疑。指绝对真实可信。" },
    { word: "不以为然", explain: "表示不认为某观点或行为是正确的，带有明确的否定态度，强调对他人 意见的反对或不认同。" },
    { word: "不以为意", explain: "指对事物不重视、不放在心上，侧重表达对事件或提醒的漠视或轻视态 度。" },
    { word: "移花接木", explain: "把枝条、嫩芽从一种花木嫁接到另一种花木上。比喻暗中更换。" },
    { word: "偷梁换柱", explain: "比喻暗中耍手段改变事物内容，以假代真，以劣代优。" },
    { word: "李代桃僵", explain: "李：李树。桃：桃树。僵：枯死。李树代桃树而死。比喻兄弟相爱相 助，患难与共。也比喻以此代彼(多贬义)或代人受过。" },
    { word: "张冠李戴", explain: "冠：帽子。比喻弄错了事实或对象。(主观上故意或者不故意)" },
    { word: "错综复杂", explain: "形容头绪多、关系纷乱，情况繁杂、很难理清。" },
    { word: "盘根错节", explain: "树木树根盘绕、枝节交错。比喻事情关系复杂、牵连众多，难以处理和 厘清。" },
    { word: "铭刻", explain: "侧重指在器物、石碑等表面刻下文字或图案，也常用于抽象语境，如将 情感、记忆深深记在心中。" },
    { word: "镌刻", explain: "强调用工具在坚硬物体上精细雕刻，侧重“雕刻”的动作本身，多用于 艺术创作、碑文等正式场景。" },
    { word: "描绘", explain: "强调画出，描画，描述。" },
    { word: "刻画", explain: "本义指通过雕刻和绘画等艺术手段在物体上创造出图案或形象。通常用 来形容通过文字、绘画或其他艺术形式对人物、景象等进行细致入微的 描绘，以突出其形象和性格特征。" },
    { word: "擘画", explain: "指对事务进行规划、设计和安排，常用于形容对重大事务的宏观布局和 细致规划，对事情有深远的考虑和计划，含有策略性和智慧性的意味。" },
    { word: "描摹", explain: "本义指通过透明纸覆盖在原件上，按照可见的线条或文字进行复制，如 描摹图画、版画或手抄本。在文学创作中，描摹指通过文字细腻地描绘 人物、场景、情感等，使读者能够形象地感受到所描述的内容。 这种技巧强调对细节的捕捉和生动的表达，以增强作品的表现力和感染 力。" },
    { word: "勾勒", explain: "指用线条画出轮廓，也表示用简单的笔墨描写事物的大致情况。" },
    { word: "凝聚", explain: "侧重指通过吸引力或共同作用，使思想、力量、情感等抽象事物聚集在 一起。" },
    { word: "凝结", explain: "原指液体遇冷变成固体(如“水汽凝结成冰”),引申为抽象事物通过 过程逐渐固定、形成。" },
    { word: "凝固", explain: "原指在温度降低时，物质由液态变为固态的过程，引申为形容事物因某 种原因(如情绪、氛围等)变得固定、停滞或不再变化，多用来描述氛 围、表情、时间感等。" },
    { word: "汇聚", explain: "侧重指像水流一样从多个方向集中到一处，强调动态的“汇合过程”, 对象多为水流、人群、力量等，带有较强的方向性和流动性。" },
    { word: "汇集", explain: "更侧重把分散的事物收集、整合到一起，强调“集中的结果”,适用范 围较广。" },
    { word: "聚集", explain: "强调“从各处集合到某一地点”,侧重空间上的集中，对象可以是人和 物。" },
    { word: "承载", explain: "支撑，托着物体，承受它的重量，也指某种事物(如文化、情感、信息 等)依托于另一事物存在或表达。" },
    { word: "载体", explain: "指某些能传递能量或承载其他物质的物质。现也泛指一切能够承载其他 事物的事物。" },
    { word: "延伸", explain: "指在原有基础上延长、扩展或发展。" },
    { word: "代表", explain: "直接指代或替代某一事物，强调明确的对应关系；通常用于具体事物或 概念的指代。" },
    { word: "象征", explain: "用具体事物表现某些抽象意义。" },
    { word: "标志", explain: "表明特征的记号或事物；表明某种特征。" },
    { word: "反映", explain: "本义把情况或意见等向上级转达、报告，比喻把客观事物的实质表现或 显示出来。" },
    { word: "印证", explain: "通过其他事物进一步证明。" },
    { word: "见证", explain: "本义证明证据指证人或证物。" },
    { word: "桥梁", explain: "指跨越障碍物(如河流、山谷、道路等)的建筑物，用于连接两地，使 交通畅通。比喻义指在人与人、群体与群体、文化与文化之间起连接作 用的事物或角色。" },
    { word: "媒介", explain: "指在两种事物之间起传递、连接作用的中介物或手段。它可以是具体的 物质载体，也可以是抽象的传播方式。" },
    { word: "枢纽", explain: "指主门户开合之枢与提系器物之纽。引申义比喻事物中起决定性作用的 部分。" },
    { word: "纽带", explain: "指用于捆束或连接物品的带子，如绳索、系带等。引申义比喻能够联系 、维系人或事物的关系或因素，强调其连接、团结的作用。" },
    { word: "缩影", explain: "指可以代表同类整体的微小具体代表；从小处就能看出整体的样子。" },
    { word: "典型", explain: "主要指具有代表性的人、事物或语言现象，能够反映某一类对象的共性 特征。" },
    { word: "映照", explain: "侧重客观呈现物体的影像或状态，常用于自然现象或具体场景。" },
    { word: "折射", explain: "原指光线从一种介质进入另一种介质时，因速度变化而改变传播方向， 导致影像变形，侧重物理现象或抽象层面的“间接反映”(如通过现象 看本质)。" },
    { word: "映射", explain: "原指数学中元素与元素的对应关系，引申为“通过某种方式将一事物的 特征对应到另一事物上”,强调“对应关系”。" },
    { word: "投射", explain: "指光线、影子等直接投向物体，或心理学术语中“将自身特质归因于他 人”的心理机制，强调“主动投向”的动作。" },
    { word: "诠释", explain: "说明，解释，多用于书面。" },
    { word: "阐释", explain: "阐述并解释。" },
    { word: "彰显", explain: "显赫，明显，显著,鲜明地显示。" },
    { word: "凸显", explain: "本义是凸出显露。" },
    { word: "渲染", explain: "原意是国画的一种画法，用水墨或淡的色彩涂抹画面，以加强艺术效 果，多用来比喻夸大的形容或者对事物突出的描写和烘托。" },
    { word: "烘托", explain: "原意是国画的一种画法，用水墨或淡的色彩点染轮廓外部，使物象鲜 明，多用来突出气氛或情感。" },
    { word: "交融", explain: "强调不同事物相互渗透形成新整体。" },
    { word: "融合", explain: "指不同元素结合后失去原有界限，形成统一体。" },
    { word: "融入", explain: "侧重一方主动适应或加入另一体系。" },
    { word: "介入", explain: "指外部力量主动干预或参与。" },
    { word: "渗透", explain: "本义为液体缓慢透入。现多比喻事物或势力逐渐进入，或军队利用敌部 署的间隙或有利地形秘密渗入敌纵深或后方的作战行动的军事术语。" },
    { word: "渗入", explain: "指液体慢慢地透过孔隙或缝隙进入另一种物质内部。例如，雨水渗入土 壤，墨水渗入纸张等，也表示某种思想、文化、影响等逐渐进入或渗透 到某个领域或群体中。" },
    { word: "裹挟", explain: "本义是指(风、流水等)把别的东西卷入，使随着移动。现比喻(形势 、潮流等)把人卷进去，迫使其采取某种态度。" },
    { word: "嵌入", explain: "把一物紧紧镶入、植入另一物内部，融进去、嵌进去。侧重有形。" },
    { word: "植入", explain: "把事物有意识地放进、融入另一事物里，暗中渗透、扎根进去。侧重无 形。" },
    { word: "积淀", explain: "侧重指长期积累后形成的文化、经验、传统等抽象事物，强调过程的漫 长性和结果的厚重感，多用于精神层面。" },
    { word: "沉淀", explain: "原指液体中杂质下沉或溶液中溶质析出(如“泥沙沉淀”),引申为思 想、情感等抽象事物在经历后慢慢凝结、稳定，侧重自然积累或筛选的 过程。" },
    { word: "积累", explain: "指通过不断收集、聚集具体或抽象的事物，侧重数量的增加，使用范围 更广泛。" },
    { word: "滋润", explain: "①形容湿润、不干燥状态，指物体含有适量水分，舒适饱满的状态。② 补充水分，使不干燥。③形容生活舒适、富足，形容生活宽裕、惬意、 手里钱财宽裕。" },
    { word: "浸润", explain: "指液体缓慢渗入固体物质中的自然过程。引申义指的是思想和文化的熏 陶，情感和氛围的渗透。" },
    { word: "滋生", explain: "指生物(多指微生物或有害生物)产生、繁殖的过程。引申义指的是引 发不良现象，导致负面事物产生或蔓延。" },
    { word: "涵养", explain: "表示内在修养，也指道德、学问等方面的修养。" },
    { word: "滋养", explain: "提供养分，促进生长，指通过物质或精神养料使生物或事物健康成长。 其次指维持生命活力，强调持续供给生存所需的根本养分。" },
    { word: "腐蚀", explain: "引申为人在坏的思想、行为、环境等因素影响下逐渐变质堕落；多用于 比喻人的思想或行为的变质；这通常是一个“由里及外”的过程，可能 表示更严重的变质或破坏。" },
    { word: "侵蚀", explain: "指逐渐侵害使变坏，多指从外部对物体进行侵害，通常包含“由外及里 ”的过程，程度稍轻。" },
    { word: "培育", explain: "本意为培养幼小的生物，使它发育成长，常用于人才、经济、精神等成 长。" },
    { word: "激发", explain: "指给予刺激使其奋发出原有的潜力。" },
    { word: "激励", explain: "指通过刺激和正面鼓励使其奋发，通常侧重需要鼓励。" },
    { word: "引领", explain: "引导；带领，侧重在前带头开路。" },
    { word: "引导", explain: "本义是指通过行为帮人走出困境，或是带着人向某个目标集体行动，通 过行为帮人走出困境。侧重从旁指点路径。" },
    { word: "推动", explain: "通过提供动力或创造条件促使事物发展，对象可以是具体行动(如政策 实施)或抽象概念(如科技创新)。" },
    { word: "发扬", explain: "主要表示发展、推广、提升某种事物，使其更加显著、壮大或广泛传播 。" },
    { word: "弘扬", explain: "意思是广泛宣传、发扬光大，通常用于精神、文化、思想等抽象事物的 传播与推广。" },
    { word: "贯穿", explain: "强调事物在空间或逻辑上的连通性，既可指具体事物穿过或连接空间 (如铁路贯穿全国),也可指逻辑或时间维度的持续关联(如主题贯穿 始 终 ) 。" },
    { word: "贯通", explain: "更侧重对事物的全面掌握或深层连接；既包含透彻理解，表示对知识体 系的全盘掌握(如贯通中西文化),也可指复杂结构的整体连通(如工 程贯通多个节点)。" },
    { word: "重塑", explain: "侧重指在原有基础上进行改造、更新，使形态、结构或形象发生根本性 变化，强调“从旧到新的转型”。" },
    { word: "重构", explain: "侧重指对事物的结构、框架或系统进行根本性的调整或重新设计，强调 从底层逻辑或组织形式上优化，常用于技术、理论、流程等理性场景。" },
    { word: "演进", explain: "指逐渐地进化，强调的是事物在长久发展变化中向好的方向推进；常用 于描述科技、文化、社会制度等方面在长时间内逐渐进步、完善的过程 。" },
    { word: "演变", explain: "指的是历时较久的发展变化，侧重于描述事物在时间推移中发生的变 化；适用于描述各种事物在长时间内发生的变化，无论这种变化是积极 的还是消极的。" },
    { word: "演绎", explain: "在逻辑学和数学领域指一种从一般到特殊的推理方法，即从普遍认可的 前提中必然推出结论。在表演和文化领域指演员或艺术家对角色、作品 的诠释和表现；更强调“推理性”或“表现性”,而非“变化性”。" },
    { word: "转化", explain: "指事物性质、形态、功能或归属发生改变的过程，强调从一种状态转变 为另一种状态。广泛适用于自科学、社会科学及日常生活。" },
    { word: "蜕变", explain: "原指蝉蜕壳变，后比喻形质的改变、转化；用于形容彻底而剧烈的质变 9" },
    { word: "嬗变", explain: "指事物逐渐演变、更替，尤其强调新旧交替、传承与变化的过程。多用 于描述历史、文化、权力或思想体系的变迁。" },
    { word: "趋势", explain: "事物发展变化的大体走向、主流动向，是长期慢慢形成的走向。表示未 来走向，中性词。" },
    { word: "态势", explain: "事物当下整体的状态、形势、局面。表示当前状态。" },
    { word: "催生", explain: "指通过外部力量促使新事物产生或加速发展，强调人为干预或客观条件 推动的生成过程。广泛用于政策、经济、科技等领域，是描述创新发展 过程的精准用词。" },
    { word: "催化", explain: "指通过催化剂改变化学反应速率(加快或减慢)而自身不被消耗的过 程，比喻某种因素加速事态发展或转变。" },
    { word: "衍生", explain: "指从原有事物中自然发展出新的事物，强调派生关系和自然延伸的特性 。" },
    { word: "囊括", explain: "强调全部包含，要求无遗漏；多用于竞赛、全集等需绝对完整的语境" },
    { word: "涵盖", explain: "侧重范围覆盖允许部分缺失；常见于学术、展览等描述广泛领域的场景" },
    { word: "蕴含", explain: "指事物内部包含抽象的思想、情感或意义；多用于精神层面，如哲理、 情感、深意等(抽象内容)。" },
    { word: "蕴藏", explain: "指具体资源或潜在事物隐藏在内部，未被发掘。" },
    { word: "包蕴", explain: "与“蕴含”相近，但更强调“包容性”,多用于文学或哲学语境(抽象 内容);书面语色彩较强，侧重整体包含复杂内容。" },
    { word: "意蕴", explain: "指事物内在的含义或情调；强调抽象的美感或深层意义，常用于艺术、 文学领域。" },
    { word: "泥沼", explain: "本义指湿软的沼泽地，比喻难以摆脱的困境或复杂局面；强调陷入后难 以脱身，带有被动性和挣扎感；常用于形容在困境中挣扎。 常用动词搭配：陷入泥沼。" },
    { word: "牢笼", explain: "指具体的囚禁工具(如笼子),比喻束缚自由的环境或制度；强调物理 或精神上的禁锢，带有强制性，形容在困境中挣扎。 常用动词搭配：冲破牢笼。" },
    { word: "窠臼", explain: "指陈旧的模式或规矩，多用于批评思维或行为的僵化；强调对创新或突 破的阻碍，常与“传统”“习惯”关联；常用于突破创新场景。 常用动词搭配：打破窠臼、陷入窠臼。" },
    { word: "桎梏", explain: "原指脚镣手铐，比喻严重的束缚(如思想、制度);强调强烈的限制 性，多用于抽象层面的压抑；常用于形容严重束缚的场景。 常用动词搭配：打破桎梏、破除桎梏。" },
    { word: "藩篱", explain: "本义为篱笆，比喻界限或隔阂(如文化、国家关系);中性词，可指保 护性屏障或需要突破的障碍；常用于跨越界限的场景。 常用动词搭配：超越藩篱、跳出藩篱、消除藩篱、冲破藩篱、破除藩篱" },
    { word: "壁垒", explain: "古代军营的围墙、防御工事。比喻阻碍事物流通、进入或融合的门槛、 隔阂、屏障。多指规则、行业、客观门槛。 常用动词搭配：突破壁垒、打破壁垒、破除壁垒" },
    { word: "隔阂", explain: "彼此情意沟通的障碍或思想上的距离。多指人情感情上的距离。 常用动词搭配：消除隔阂、产生隔阂、造成隔阂、打破隔阂" },
    { word: "障碍", explain: "阻挡前进、阻碍事情顺利进行的事物或困难。通用泛指，一切挡路、碍 事的东西，适用范围最广。 常用动词搭配：克服障碍、跨越障碍、移除障碍、设置障碍、突破障碍" },
    { word: "羁绊", explain: "侧重指因情感、关系或责任产生的牵连，既有牵挂的温暖感，也可能带 来一定限制。 常用动词搭配：冲破羁绊、摆脱羁绊。" },
    { word: "束缚", explain: "强调用强制手段限制自由，带有明显的负面色彩，侧重外界的压迫或规 则的禁锢。 常用动词搭配：摆脱束缚。" },
    { word: "妨碍", explain: "侧重指干扰、阻碍，使事情不能顺利进行，对象可以是具体行为或抽象 事物，语气相对较轻。" },
    { word: "阻滞", explain: "强调因阻碍而使进程变慢甚至停滞，侧重动作的持续性和阻碍的强度， 常用于水流、交通、进程等。" },
    { word: "制约", explain: "指事物之间相互限制、约束，强调一种客观的因果关系或条件限制。" },
    { word: "踟蹰", explain: "指心中犹疑，要走不走的样子。" },
    { word: "徜徉", explain: "指悠闲自在地漫步，带有享受、闲适的意味，多用于描写人在特定环境 中的惬意状态。" },
    { word: "徘徊", explain: "表示在一个地方来回走动，或比喻犹豫不决，也比喻事物在某个范围内 来回波动、起伏。" },
    { word: "圭臬", explain: "本指古代测日影的仪器圭表，现多比喻法度、准则或典范，常用来形容 把某些言论或事物当作自己的准则。" },
    { word: "准绳", explain: "原指测定平直的器具，现多比喻言论、行动所依据的原则或标准。" },
    { word: "剥离", explain: "指附着物或覆盖物在物理、化学或外力作用下脱落、分开的过程，在商 业语境中也常指企业分离非核心业务或资产的行为。" },
    { word: "剔除", explain: "指通过辨别筛选将不合格或不需要的部分去除；核心语义包含“辨别” 与“清除”双重动作，强调主体对客体进行价值判断后的主动排除行 为，通常针对的是“不好的“、“不合适的”或“不合格的”部分。" },
    { word: "分离", explain: "指事物或人的分开、隔离、离别。兼具具象与抽象维度：既可指物质的 分割，亦能表达情感疏离。" },
    { word: "甄别", explain: "核心含义是审查、辨别优劣真伪以及考核鉴定能力品质，常用于描述对 事物或人员进行仔细筛选的过程。该词具有三重核心内涵：其一指对事 物进行审查以区分差异；其二特指古代对官吏资历的核查；其三 指通过特定条件筛选淘汰对象。" },
    { word: "鉴别", explain: "指辨别真假好坏，常用于对事物的真实性或品质进行判断。强调对事物 内在属性的评价，通常涉及专业判断或特定知识，不同于普通的视觉区 分。" },
    { word: "辨别", explain: "指通过观察、分析和比较，识别出事物之间的差异，从而在思想上将它 们区分开来。这个过程不仅适用于具体事物(如辨别颜色、声),也适 用于抽象概念(如辨别是非、真伪)。" },
    { word: "识别", explain: "指区分、分辨，通过特征分析确认对象的身份或性质，侧重于确认、认 出，强调通过特征判断出对象，对象可为人、事物、信息等。" },
    { word: "风向标", explain: "本义是指指示和测定风向的仪器，通常安装在高杆上，其箭头指向风的 来向，引申义为表示某种事物的发展方向或趋势。" },
    { word: "指南针", explain: "本义是指一种利用磁针在地磁场作用下指示方向的仪器，是中国古代四 大发明之一，引申义比喻指导行动的准则。" },
    { word: "助推器", explain: "本义是指一种内含燃料、用于推动火箭或飞船升天的动力装置，引申义 为能够对事物发展起到稳定推动、促进作用的内容或力量，常用于形容 提升士气、信心或效益的事物。" },
    { word: "压舱石", explain: "本义是指空船航行时放置在船舱底部以稳定船身的重物(如石块、铸 铁),现引申为比喻为维持事物稳定、健康发展的关键因素或可靠保证" },
    { word: "晴雨表", explain: "本义是指预测天气晴或雨的气压表，引申义为比喻能敏锐地反映某种变 化的事物。" },
    { word: "定盘星", explain: "本义是指传统杆秤上标识零重量起算点的基准星，常引申为比喻行事或 决策时所依据的明确标准或主意。" },
    { word: "指挥棒", explain: "本义是指乐队指挥或交通警察指挥时使用的棒状工具，常引申为比喻起 导向作用的事物。" },
    { word: "试金石", explain: "本义是指一种黑色坚硬的硅质岩石，古人通过在其表面摩擦黄金来辨别 成色，现引申为比喻精确可靠的检验方法或依据，常被赋予见证真伪与 品质的象征意义。" },
    { word: "敲门砖", explain: "本义是指临时敲门的砖石，后引申为比喻借以求得名利的初步手段，通 常指为了达到特定目标而采用的工具，一旦目标达成，其价值便可能终 结或被抛弃。" },
    { word: "磨刀石", explain: "本义是指用于磨砺刀具(如菜刀、剪刀等)的石块或工具，通过反复摩 擦使刀刃变得锋利，现常引申为能使人或事物变得更好、更锋利的磨练 工具或环境。" },
    { word: "硬通货", explain: "本义是指在国际上被广泛认可，能作为计价、支付和结算手段使用的货 币或资产，其核心在于币值稳定且信用良好，常引申为比喻价值稳定、 广泛认可、具有高保值性或核心竞争力的资产、商品、技术或资 源等。" },
    { word: "牛鼻子", explain: "本义是指牛的鼻子，牛鼻子是控制牛行动的要害部位，牵住这里牛就会 顺从，因此常用来比喻事物的主要矛盾或影响全局的关键点。" },
    { word: "桥头堡", explain: "本义是指设在大桥桥头的装饰性建筑物、为控制桥梁渡口设立的碉堡据 点以及泛指进攻的据点与前哨阵地，现多引申为比喻某一领域的前沿阵 地、战略据点或对外开放的重要窗口。" },
    { word: "车轮战", explain: "原为军事术语，是指己方分散兵力，轮流与敌人作战，或采取迂回战 术，在体力和智力上使别人疲劳，然后消灭敌人，其核心比喻意义在于 利用人数、次数或时间上的轮替优势，对单一目标进行持续不断的消耗" },
    { word: "持久战", explain: "是指持续时间较长的作战，战争中正义的一方，在敌强己弱的情况下， 通常在战略上采用持久战的方针，通过长期的作战，逐步削弱敌人，转 劣势为优势，变被动为主动，最后赢得战争的胜利。" },
    { word: "攻坚战", explain: "是指一种战斗的形式，攻克敌方设有坚固防御的要地如城池、关隘、要 塞或据点的作战，现引申为广泛应用于需集中优势资源解决的重大任务 之中，以实现阶段性或全局性目标。" },
    { word: "蔓延", explain: "本义指蔓草一类植物不断向四周延伸、扩展。本义适用于“草”。词义 引申，“蔓延”也指向周围扩散、延伸，速度一般较快。" },
    { word: "秉承", explain: "强调接受、承接，按指示办事或处理问题。更侧重于“继承”的意味， 常用于正式场合。" },
    { word: "秉持", explain: "强调个体或集体在行动中所坚守的原则或持有的态度。更侧重于“持有 ”的意味，适用于各种语境。" },
    { word: "契合", explain: "指十分符合，也可用于表示意气相投。" },
    { word: "观照", explain: "指人对事物特性进行观察、体验、判断等特有的心理活动。现泛指仔细 观察，审视。" },
    { word: "审视", explain: "指仔细地看，含一定的思考意味。" },
    { word: "沿袭", explain: "依照旧传统或原有规定办事。" },
    { word: "肇始", explain: "指事物或事件的起源和起始阶段，强调某事的初创或初始状态。" },
    { word: "发轫", explain: "本义是指古代车辆在出发前，需要拿掉支住车轮的木头，使车辆能够开 始行驶。借指开始行动或启程，常用于描述旅行、行程的开始，比喻事 物的起始阶段，强调某事的开始或初创状态，常用于描述新事物、新局 面的出现。" },
    { word: "开端", explain: "指事物或事件的起始阶段，强调某事的起始点或初始状态。" },
    { word: "滥觞", explain: "原指江河发源处。现比喻事物的开始或起源，在某些文献中，“滥觞” 也有波及、影响的意思，指某事对周围事物产生的影响，在某些情况 下，“滥觞”还有泛滥、过分的意思，用于描述某事过度发展或超 出控制。" },
    { word: "孕育", explain: "本义指对生命或事物的养育和滋养，使其得以成长和发展。多用于比喻 在既存的事物中酝酿着新事物，如思想、文化、艺术作品等的形成和发 展。" },
    { word: "式微", explain: "指事物由兴盛而衰落，强调渐进性的衰落过程。" },
    { word: "湮灭", explain: "通常指彻底消失或毁灭，强调事物从存在到不存在的不可逆过程。" },
    { word: "共鸣", explain: "一指物体因共振而发声的现象，二指由别人的某种思想感情引起相同的 思想感情。" },
    { word: "升华", explain: "一指固态物质不经液态直接变为气态，二指比喻事物的提高和精炼。" },
    { word: "支撑", explain: "指让物体不倒塌，让事物发展不失败、不崩溃，用于积极的语境。" },
    { word: "塑造", explain: "指用语言文字等艺术手段描写形象，或对原材料或已有的事物进行改造 或加工，使其呈现出新的形态或特征；亦指用石膏、黏土等做成人或物 的形象。用于积极的语境。" },
    { word: "媲美", explain: "指美好的程度可以相比，类似比美之意。一般都用于一种东西可以和另 一种东西相比。" },
    { word: "凝视", explain: "指聚精会神地观看，不眨眼睛，神情专注。适用多种语境，后面可接抽 象和具体名词。" },
    { word: "引擎", explain: "本义指把(如热能、化学能、核能、辐射能和升高的水的势能等形式 的)能量转变为机械力和运动的机器。现在常引申为推动事物发展的动 力。一般用于积极语境。" },
    { word: "审慎", explain: "指周密谨慎、细致稳重，强调在决策、行动前要权衡利弊，妥善行动。" },
    { word: "耦合", explain: "两个或多个事物(系统、部分、因素)相互关联、彼此影响、联动配 合，牵一发而动。" },
    { word: "赓续", explain: "继续、延续、继承并传承下去。" },
  ];
  var KNOWLEDGE = [
    { cat: "时政", hl: ["新质生产力", "科技创新", "新发展理念"], text: "2024年政府工作报告将'加快发展新质生产力'列为首要任务。新质生产力以科技创新为核心驱动力，具有高科技、高效能、高质量特征，符合新发展理念。" },
    { cat: "时政", hl: ["二十届三中全会", "全面深化改革", "中国式现代化"], text: "2024年7月，中国共产党第二十届中央委员会第三次全体会议在北京举行，重点研究进一步全面深化改革、推进中国式现代化问题。" },
    { cat: "时政", hl: ["新中国成立75周年", "第二大经济体"], text: "2024年10月1日是中华人民共和国成立75周年。75年来，中国从一穷二白发展为世界第二大经济体，人均GDP突破1.2万美元。" },
    { cat: "时政", hl: ["神舟十八号", "中国空间站"], text: "2024年，神舟十八号、神舟十九号载人飞船接续发射，中国空间站进入常态化运营阶段，航天员乘组顺利完成多次出舱活动和空间科学实验。" },
    { cat: "时政", hl: ["嫦娥六号", "月背采样"], text: "2024年6月，嫦娥六号探测器成功着陆月球背面南极-艾特肯盆地，完成人类首次月球背面采样返回任务。" },
    { cat: "时政", hl: ["全国两会", "GDP增长5%", "新增就业"], text: "2025年3月，十四届全国人大三次会议和全国政协十四届三次会议在北京召开，政府工作报告提出GDP增长5%左右、城镇新增就业1200万人以上等目标。" },
    { cat: "时政", hl: ["反外国制裁法", "国家主权"], text: "《中华人民共和国反外国制裁法》于2021年实施，2024年国务院据此制定《实施〈反外国制裁法〉的规定》，完善反制措施，维护国家主权安全。" },
    { cat: "时政", hl: ["延迟退休", "法定退休年龄"], text: "2024年9月，全国人大常委会通过《关于实施渐进式延迟法定退休年龄的决定》，从2025年1月1日起，用15年时间逐步延迟男、女职工法定退休年龄。" },
    { cat: "时政", hl: ["生育支持", "生育友好型社会"], text: "2024年10月，国务院办公厅印发《关于加快完善生育支持政策体系推动建设生育友好型社会的若干措施》，从强化生育服务支持、加强育幼体系建设等方面发力。" },
    { cat: "时政", hl: ["低空经济", "新增长引擎", "无人机"], text: "低空经济被2024年政府工作报告列为新增长引擎，指以低空空域为依托，以通用航空产业为主导，涵盖无人机配送、低空文旅、应急救援等新业态。" },
    { cat: "时政", hl: ["中国式现代化", "共同富裕"], text: "中国式现代化是人口规模巨大的现代化、全体人民共同富裕的现代化、物质文明和精神文明相协调的现代化、人与自然和谐共生的现代化、走和平发展道路的现代化。" },
    { cat: "时政", hl: ["长江十年禁渔", "江豚", "生物多样性"], text: "2021年起长江干流、大型通江湖泊和重要支流实行为期十年的常年禁捕。2024年监测显示，长江水生生物多样性逐步恢复，江豚种群数量止跌回升。" },
    { cat: "时政", hl: ["碳达峰", "碳中和", "双碳"], text: "中国承诺2030年前实现碳达峰、2060年前实现碳中和。'双碳'目标推动能源结构转型，加快发展风电、光伏、核电等清洁能源。" },
    { cat: "时政", hl: ["一带一路", "中欧班列"], text: "2023年举办第三届'一带一路'国际合作高峰论坛，2024年进入高质量发展新阶段，中欧班列、西部陆海新通道等标志性项目持续扩容。" },
    { cat: "时政", hl: ["数字经济促进法", "数据安全"], text: "2024年，《中华人民共和国数字经济促进法》立法进程加快，旨在促进数字经济高质量发展，保障数据安全，完善数字治理体系。" },
    { cat: "时政", hl: ["粮食安全", "中央一号文件", "种业振兴"], text: "2024年中央一号文件再次聚焦'三农'，强调确保国家粮食安全，要求粮食产量保持在1.3万亿斤以上，深入实施种业振兴行动。" },
    { cat: "时政", hl: ["反腐败", "中央纪委"], text: "2024年，中央纪委国家监委持续深化反腐败斗争，集中整治群众身边不正之风和腐败问题，推进受贿行贿一起查，铲除腐败问题产生的土壤条件。" },
    { cat: "时政", hl: ["C919", "国产大飞机"], text: "C919大型客机是中国首款按照国际适航标准研制的干线客机。2024年C919开启常态化商业运营并逐步扩大航线网络，标志国产民机进入商业运营新阶段。" },
    { cat: "时政", hl: ["巴黎奥运会", "40金"], text: "2024年7月至8月，第33届夏季奥运会在法国巴黎举行。中国体育代表团取得40金27银24铜的境外参赛最好成绩。" },
    { cat: "时政", hl: ["哈尔滨亚冬会", "亚洲冬季运动会"], text: "2025年2月，第九届亚洲冬季运动会在黑龙江省哈尔滨市举行。这是中国继1996年哈尔滨亚冬会、2007年长春亚冬会后第三次举办亚冬会。" },
    { cat: "时政", hl: ["RCEP", "全球最大自贸区"], text: "RCEP（区域全面经济伙伴关系协定）于2022年1月生效，是全球最大自贸区。2024年进一步促进中国与东盟、日韩、澳新等成员国贸易投资自由化便利化。" },
    { cat: "经济", hl: ["货币政策", "货币政策法宝来", "三大法宝"], text: "", table: [["概念", "货币政策指中央银行通过控制货币供给量以及通过调节利率来影响投资和整个经济以达到一定经济目标的行为"], ["三大法宝", "再贴现率指商业银行将已从客户处贴现的未到期合格商业票据(如银行承兑汇票)转让给中央银行以获取资金时，中央银行收取的利息率"], ["三大法宝", "法定存款准备金率指中央银行以法律形式规定的商业银行及其他金融机构必须缴纳的存款准备金占其存款总额的最低比例"], ["三大法宝", "公开市场业务指中央银行在金融市场公开买卖有价证券(如国债、政府债券、央行票据等)以调节货币供应量和市场利率的行为"], ["种类", "扩张性货币政策：经济萧条时采用/通货紧缩时采用；具体措施：降低法定存款准备金率、降低再贴现率，买入有价债券、降低利率"], ["种类", "紧缩性货币政策：经济过热期采用/通货膨胀时采用；具体措施：提高法定存款准备金率、提高再贴现率，卖出有价债券、提高利率"]] },
    { cat: "经济", hl: ["财政政策", "经济衰退宜扩张"], text: "", table: [["概念", "财政政策指政府通过改变财政收入(主要包括税收和公债)和财政支出(主要包括政府购买和转移支付)的结构来影响总需求，进而影响国民收入的政策。财政政策被称为社会活动的“内在稳定器 ”"], ["种类", "扩张性财政政策：经济衰退期实行/通货紧缩时采用；具体措施：减少税收、增发国债、增加转移支付"], ["种类", "紧缩性财政政策：经济过热期采用/通货膨胀时采用；具体措施：增加税收、减发国债、减少转移支付"]] },
    { cat: "经济", hl: ["三次分配", "初次分配企业定", "初次分配"], text: "", table: [["初次分配", "属于微观分配行为，主要由生产部门自主进行。如企业职工薪酬、最低工资保障、企业利润等"], ["再分配", "属于宏观分配行为，主要由政府对初次分配的结果进行调节。如公务员的工资、个人所得税、社会保障、转移支付等"], ["第三次分配", "建立在自愿性的基础上，以慈善公益方式进行"]] },
    { cat: "经济", hl: ["汇率", "汇率下降：增加出口", "汇率变动"], text: "", table: [["汇率", "汇率指两种货币之间兑换的比率，或者说是用一国货币来表示另一国货币的价格"], ["汇率变动", "本币汇率下降(本币贬值)→增加出口，减少进口"], ["汇率变动", "本币汇率上升(本币升值)→增加进口，减少出口"]] },
    { cat: "经济", hl: ["三驾马车", "三驾马车金融业", "WTO"], text: "", table: [["拉动国民经济增长三驾马车", "投资：政府通过一系列的财政预算包括发行国债，对教育、科技、国防、卫生等事业的支出，是辅助性的扩大内需"], ["拉动国民经济增长三驾马车", "消费：即本国居民的消费需求，它是经济的主要动力"], ["拉动国民经济增长三驾马车", "出口：指外部需求，即通过本国企业的产品打入国际市场，参与国际竞争，扩大自己的产品销路"], ["全球经济治理三驾马车", "世界贸易组织(WTO):1995年成立，总部设在瑞士日内瓦，独立于联合国的永久性国际组织。被誉为“经济联合国”,职责是解决成员间贸易争端"], ["全球经济治理三驾马车", "国际货币基金组织(IMF):1945年成立，总部设在美国华盛顿，联合国的专门机构。在金融危机中扮演“救火队”角色，防止全球经济系统性风险扩散"], ["全球经济治理三驾马车", "世界银行(WB):1945年成立，总部设在美国华盛顿，属于联合国的专门机构。职责是向发展中国家提供长期贷款和技术援助，支持基础设施、教育、医疗等发展项目。世界银行的宗旨是向成员国提供贷款和投资推进国际贸易均衡发展"], ["全球经济治理三驾马车", "WTO、IMF和WB也被称为世界经济发展的三大支柱"], ["金融业三驾马车", "银行：在金融体系中具有基础性地位，是资金流动的主要渠道"], ["金融业三驾马车", "证券：证券行业主要包括证券发行、证券交易和证券服务等"], ["金融业三驾马车", "保险：提供风险管理和长期资金支持，发挥社会稳定器和资本蓄水池的作用"]] },
    { cat: "经济", hl: ["恩格尔系数", "食品支出除以总", "比例"], text: "", table: [["概念", "恩格尔系数(%)=食品支出总额/家庭或个人消费支出总额×100%,即食品支出总额占个人消费支出总额的比重"], ["比例", "恩格尔系数是根据恩格尔定律而得出的比例数，介于0和1之间。恩格尔系数与其所反映的家庭或国家的富裕程度成反比，对一个国家而言，一个国家越穷，每个国民的平均支出中用来购买食物的费用所占比例就越大，恩格尔系数也就越高"], ["特征", "(1)恩格尔系数是一种长期趋势，时间越长趋势越明显，某一年份恩格尔系数波动是正常的；(2)在进行国际比较时应注意可比口径，在中国城市，由于住房、医疗、交通等方面存在大量补贴，因此进行国际比较时应调整到相同口径；(3)地区间消费习惯不同，恩格尔系数略有不同"]] },
    { cat: "经济", hl: ["基尼系数", "收入分配看基尼", "比例"], text: "", table: [["概念", "基尼系数是国际上用来综合考查居民内部收入分配差异状况的一个重要分析指标"], ["比例", "其值在0和1之间。越接近0就表明收入分配越是趋向平等。按照国际一般标准，0.4以上的基尼系数表示收入差距较大，当基尼系数达到0.6时，则表示收入悬殊"]] },
    { cat: "经济", hl: ["国内生产总值", "国内生产GDP", "GDP"], text: "", table: [["GDP", "国内生产总值(GDP)是指在一定时期内(一个季度或一年),一个国家或地区的经济中所生产出的全部最终产品和劳务的价值，常被公认为衡量国家经济状况的最佳指标。GDP不仅可以反映一个国家的经济表现，还可以反映一国的国力与财富。举例：①二手车：二手车已计入其生产年度国内生产总值，不是新生产的，因此不能计入当年国内生产总值。②股票：购买股票并不产生新的价值，不计入国内生产总值。③扶贫资金：扶贫资金属于政府转移支付，只是简单地通过税收把收入从一个人或一个组织手中转移到另一个人或另一个组织手中，并没有发生相应的货物或劳务的交换，不计入国内生产总值"]] },
    { cat: "经济", hl: ["国民生产总值", "国民生产GNP", "GNP"], text: "", table: [["概念", "国民生产总值(GNP)是一个国民概念，是指某国国民所拥有的全部生产要素在一定时期内所生产的最终产品的市场价值"], ["计算方式", "GNP是指一个国家(或地区)所有国民在一定时期内新生产的产品和服务价值的总和。国民生产总值不仅计入了物质生产部门的增加值，而且也计入了所有服务部门的增加值，因而反映了现代产业结构的变化，反映了教育、科学技术、金融等第三产业在社会经济中的作用"]] },
    { cat: "经济", hl: ["采购经理指数 (PMI)", "采购经理PMI", "PMI"], text: "", table: [["PMI的本质", "采购经理指数(PMI)是衡量经济景气程度的关键指标，通过调查采购经理的月度数据综合计算得出。通常采购经理人指数与金属需求指标密切相关"], ["荣枯分水线", "高于50%:表示经济扩张(如制造业生产、订单等指标向好)"], ["荣枯分水线", "低于50%:表示经济收缩(如需求下降、生产放缓)"]] },
    { cat: "经济", hl: ["消费指数CPI", "基本功能"], text: "①居民收入涨幅下跌 ②通货膨胀压力增大 ③居民生活成本增加 ④恩格尔系数在下降", table: [["概念", "消费者物价指数(CPI)是一项反映居民家庭一般所购买的消费品和服务项目价格水平变动情况的宏观经济指标，通常作为观察通货膨胀水平的重要指标。国家统计局公布的CPI数据被人们称为反映社会经济生活状况的“晴雨表”。CPI是一个滞后性的数据，它反映的是过去一段时间内消费品及服务价格水平的变动情况，而不是对未来经济活动的预测"], ["基本功能", "(1)衡量通货膨胀(通货紧缩); (2)国民经济核算；(3)契约指数化调整；(4)反映货币购买力变动；(5)反映对职工实际工资的影响；(6)反映对股市的影响"], ["计算方法", "消费者物价指数的计算不要求列出一张涵盖全国全部产品的清单。国家统计局根据全国城乡居民家庭消费支出的抽样调查资料统一确定商品和服务项目的类别，设置包括：食品烟酒、衣着、居住、生活用品及服务、交通通信、教育文化娱乐、医疗保健、其他用品及服务八大类268个基本分类，基本涵盖了城乡居民的全部消费内容。它的计算方法是取一篮子商品中每一项商品的价格变化，并将其加权平均。CPI上涨说明物价上涨，货币的购买力下降；CPI下跌则说明物价下跌，货币的购买力增强"]] },
    { cat: "经济", hl: ["赤字率", "财政风险赤字率", "比例"], text: "", table: [["赤字率", "赤字率，指财政赤字占GDP的比重，即一定时期内财政赤字额与同期GDP之间的比例关系，是衡量财政风险的一个重要指标。提高财政赤字率属于积极财政政策，意味着政府财政支出大于财政收入，政府通过扩大支出或减少税收等方式来刺激经济增长"], ["比例", "国际上评价一国财政赤字风险有两个指标：(1)赤字率(赤字占GDP比重)不超过3%; (2)负债率(国债余额占GDP比重)不超过60%"]] },
    { cat: "经济", hl: ["货币职能", "货币职能记清楚", "口诀速背"], text: "口诀速背", table: [["概念", "货币职能是指货币在经济活动中所起的作用，它是货币本质的具体体现。货币职能包括价值尺度、支付手段、流通手段、贮藏手段、世界货币口诀：价流世支贮(谐音记忆：甲流是只猪)"], ["五大职能", "价值尺度：价值标签。价值尺度是货币用来衡量和表现商品价值大小的职能，货币通过自身价值作为尺度来量化商品的价值量，比如一件商品标价多少"], ["五大职能", "支付手段：支付手段是货币在清偿债务、支付工资、租金、赋税等过程中发挥的职能。其特点是货币的支付与商品交换在时间上相分离，即交钱与交货时间不同"], ["五大职能", "流通手段：流通手段强调货币在商品交换过程中充当媒介，其核心在于“一手交钱，一手交货”式的商品买卖场景。在商品流通中，货币不断地从买者手中转移到卖者手中，实现商品的交换"], ["五大职能", "贮藏手段：贮藏手段要求货币退出流通领域，被人们当作财富储存起来，通常是为了保存财富以备未来之需，并且一般要求货币是足值的，如金银等"], ["五大职能", "世界货币：在世界上能通用的货币"], ["货币基本职能是价值尺度和流通手段", "货币基本职能是价值尺度和流通手段"]] },
    { cat: "经济", hl: ["市场经济", "自发性损人利己", "市场配置"], text: "", table: [["市场配置", "市场配置是指通过市场机制进行资源配置的方式。市场配置是一种事后调节，是用“看不见的手”来调节的"], ["市场配置", "市场配置的缺陷：(1)自发性：逐利、使用不正当竞争手段。例如：假冒伪劣、欺诈、环境污染、以次充好，假奶粉、排污偷排。(2)盲目性：掌握信息不全、盲目跟风生产。例如：果农盲目扩种致烂市。(3)滞后性：事后调节、商品生产调整滞后。例如：手机滞销后才减产"], ["市场机制", "风险机制"], ["市场机制", "供求机制"], ["市场机制", "竞争机制"], ["市场机制", "价格机制(核心)"]] },
    { cat: "经济", hl: ["两只手", "斯密巨著国富论", "看不见的手"], text: "", table: [["看不见的手", "市场经济体制"], ["看不见的手", "亚当 ·斯密在《国富论》提出“看不见的手”理论，认为每个人在追求自身利益时，都会“被一只看不见的手引导着去达到并非出于其本意的目的”的论断，他反对重商主义，支持自由经济政策。亚当 ·斯密被认为是现代经济学之父"], ["看得见的手", "政府宏观调控"], ["看得见的手", "《就业、利息和货币通论》是英国经济学家凯恩斯创作的经济学著作，该书是现代政府干预经济政策的理论基础，是现代西方经济崛起的原动力，标志着现代西方宏观经济学的产生"]] },
    { cat: "经济", hl: ["宏观调控", "增长就业物价定", "口诀释义"], text: "口诀释义", table: [["我国宏观调控的目标", "(1)促进经济增长(最重要的目标); (2)增加就业；(3)稳定物价；(4)保持国际收支平衡"], ["我国宏观调控的手段", "(1)经济手段国家在尊重市场规律的基础上借助经济杠杆的调节作用，对国民经济进行宏观调控。财政政策和货币政策是宏观调控中最常用的经济手段。我国宏观经济调控以经济手段和法律手段为主，其中经济手段是我国宏观调控的基石和最主要手段。(2)行政手段国家依靠行政机构，采取强制性的命令、指示、规定等行政方式来调节经济活动，以达到宏观调控目标的一种手段。行政手段具有权威性、纵向性、无偿性和速效性等特点。(3)法律手段国家依靠法制力量，通过经济立法、经济司法和经济仲裁，运用经济法规来调节经济关系和经济活动，以达到宏观调控目标的一种手段"]] },
    { cat: "经济", hl: ["按劳分配", "国有企业按劳分", "项目"], text: "", table: [["项目", "存在方式", "特点"], ["按劳分配", "只存在于公有制企业", "按劳分配是初级阶段的分配主体，但不是社会唯一的分配原则<br>等量劳动领取等量消费品原则，还不可能在全社会的公有制经济范围内按统一标准实现<br>按劳分配还不能以每个劳动者的劳动时间为尺度，只能以商品交换实现的价值量所间接反映的劳动量为尺度<br>按劳分配必须借助于商品货币形式来实现"], ["按生产要素分配", "存在于私营企业或外资企业", "劳动、资本、技术、管理"]] },
    { cat: "经济", hl: ["通货膨胀", "通胀物价涨", "| 通货膨胀"], text: "", table: [["| 通货膨胀", "通货紧缩"], ["实质", "社会总需求大于社会总供给，供不应求", "社会总需求小于社会总供给，供大于求"], ["原因", "纸币的发行量超过流通中实际需要的货币量", "纸币的发行量少于流通中实际需要的货币量"], ["危害", "物价上涨、货币贬值", "物价下跌、货币升值"], ["对策", "控制货币供应量与信贷规模", "扩大内需、刺激消费"]] },
    { cat: "经济", hl: ["欧盟", "欧盟源自欧共体", "EU"], text: "", table: [["简介", "欧洲联盟，简称欧盟(EU),总部设在比利时首都布鲁塞尔，是由欧洲共同体发展而来的，欧洲联盟是欧洲地区规模较大的区域性经济合作的国际组织，创始成员国有6个，分别为法国、德国、意大利、荷兰、比利时和卢森堡。正式官方语言有24种。2020年1月30日，欧盟正式批准了英国脱欧。英国结束了其47年的欧盟成员国身份"], ["组织架构", "(1)理事会：包括欧盟理事会和欧洲理事会。欧盟理事会又称部长理事会，欧盟立法与政策制定、协调机构。欧洲理事会，又称欧盟首脑会议或欧盟峰会，是欧盟最高决策机构。(2)欧盟委员会：简称欧委会，欧盟立法建议与执行机构。(3)欧洲议会：欧盟监督、咨询和立法机构。(4)欧洲法院：欧盟的仲裁机构。负责审理和裁决在执行欧共体条约和有关规定中发生的各种争执。(5)审计院：负责审计欧盟及其各机构的账目，审查欧盟收支状况，并确保对欧盟财政进行正常管理"]] },
    { cat: "经济", hl: ["世界贸易组织", "世贸经济联合国", "XX"], text: "口诀速背 XX", table: [["简介", "世界贸易组织，简称世贸组织(WTO),是一个独立于联合国的永久性国际组织。WTO是20世纪90 年代，在关贸总协定的基础上成立了法律地位更加明确的国际组织。总部设在瑞士日内瓦莱蒙湖畔，WTO成员之间的贸易额占世界的绝大多数，有“经济联合国”之称。官方语言为英文、法文和西班牙文，这三种语言的文本为正式文本，具有法律效力，中文译本仅供参考，不具有法律效力。WTO是全球贸易机制中影响最大最广泛最具权威性的国际经济组织。WTO的目标是建立一个完整的、更具有活力的和永久性的多边贸易体制"], ["发展历程", "1995年1月1日，世界贸易组织正式成立，与关贸总协定共存一年至1995年12月31日。2001年12月11日，中华人民共和国经过15年的谈判正式加入，这是关贸总协定/世贸历史上谈判时间最长的一次"], ["基本原则", "(1)互惠原则。(2)透明度原则。(3)市场准入原则。(4)促进公平竞争原则。(5)经济发展原则。(6)非歧视性原则"], ["组织架构", "(1)部长级会议：世贸组织的最高决策权力机构。(2)总理事会：由世界贸易组织所有成员方的代表组成，定期召开会议。总理事会还必须履行其解决贸易争端和审议各成员贸易政策的职责。(3)专门委员会：部长会议下设立专门委员会，以处理特定的贸易及其他有关事宜。(4)秘书处与总干事"], ["职能", "(1)管理职能。(2)组织职能。(3)协调职能。(4)调节职能。(5)提供职能"]] },
    { cat: "经济", hl: ["国际货币基金组织", "特别提款基金创", "IMF"], text: "", table: [["简介", "国际货币基金组织(IMF)是根据1944年7月在布雷顿森林会议签订的《国际货币基金协定》,于 1945年12月27日成立，总部在美国华盛顿。IMF是联合国的专门机构。IMF与世界银行同时成立，并列为世界两大金融机构。监察货币汇率和各国贸易情况，提供技术和资金协助，确保全球金融制度运作正常"], ["职能", "(1)制定成员国间的汇率政策和经常项目的支付以及货币兑换性方面的规则，并进行监督；(2)对发生国际收支困难的成员国在必要时提供紧急资金融通，避免其他国家受其影响；(3)为成员国提供有关国际货币合作与协商等会议场所；(4)促进国际间的金融与货币领域的合作；(5)促进国际经济一体化的步伐；(6)维护国际间的汇率秩序；(7)协助成员国之间建立经常性多边支付体系等"], ["特别提款权", "国际货币基金组织于1969年创设“特别提款权(SDR)”。特别提款权(SDR)是国际货币基金组织创设的一种储备资产和记账单位，用于会员国和基金组织国，以及会员国之间的支付，称“纸黄金”。它是基金组织分配给会员国的一种使用资金的权利。会员国在发生国际收支逆差时，可用它向基金组织指定的其他会员国换取外汇，以偿付国际收支逆差或偿还基金组织的贷款，还可与黄金、自由兑换货币一样充当国际储备。但由于其只是一种记账单位，不是真正货币，所以使用时必须先换成其他货币，不能直接用于贸易或非贸易的支付。因为它是国际货币基金组织原有的普通提款权以外的一种补充，所以称为特别提款权(SDR)。特别提款权不是一种有形的货币，它看不见摸不着，只是一种账面资产。人民币纳人国际货币基金组织特别提款权货币篮子，成为继美元、欧元、英镑、日元之后的第五个成员"]] },
    { cat: "经济", hl: ["亚洲基础设施投资银行", "基础设施亚投行", "AIIB"], text: "", table: [["亚投行", "亚投行(AIIB)是一个政府间性质的亚洲区域多边开发机构，其成立宗旨是促进亚洲区域的建设互联互通化和经济一体化的过程，并且加强中国及其他亚洲国家和地区的合作。亚投行重点支持基础设施建设。亚投行是首个由中国倡议设立的多边金融机构，总部设在北京。2015年3月12日英国是第一个申请加入亚投行的西方国家"]] },
    { cat: "经济", hl: ["上海合作组织", "上合组织SCO", "五国，中俄哈吉塔牵头"], text: "五国，中俄哈吉塔牵头", table: [["概述", "上海合作组织(SCO),简称上合组织。成立于2001年6月15日。是一个永久性政府间国际组织，是第一个以中国城市命名的国际组织。上合组织的前身是中国、俄罗斯、哈萨克斯坦、吉尔吉斯斯坦和塔吉克斯坦的“上海五国”机制"], ["论坛", "2025年5月19日至20日，2025年上海合作组织减贫和可持续发展论坛在陕西举行。本次论坛当日在陕西西安开幕，主题为“持续减贫，合作发展——推动上合组织国家减贫和可持续发展”。2025年5月20日，国家主席习近平向2025年上海合作组织减贫和可持续发展论坛致贺信。习近平指出，消除贫困是全球性难题，也是世界各国共同目标。中国经过艰苦努力，成功打赢脱贫攻坚战，提前10年实现联合国2030年可持续发展议程减贫目标，走出一条中国特色减贫道路，谱写了人类反贫困历史新篇章。习近平强调，减贫问题说到底是发展问题。中方作为上海合作组织轮值主席国，愿同各方持续加强政策沟通，分享减贫经验，深化务实合作，帮助更多国家探索符合自身国情的减贫和可持续发展道路，携手建设远离贫困、共同繁荣的美好世界"]] },
    { cat: "经济", hl: ["陆上邻国", "月娥姑娘真腼腆", "口诀释义"], text: "口诀释义", table: [["陆上邻国 (14个)", "越南、俄罗斯、缅甸、蒙古、不丹、哈萨克斯坦、吉尔吉斯斯坦、塔吉克斯坦、印度、老挝、尼泊尔、朝鲜、巴基斯坦、阿富汗"]] },
    { cat: "地理", hl: ["著名地貌", "西北风蚀西南喀", "喀斯特地貌"], text: "", table: [["喀斯特地貌", "喀斯特地貌，又叫岩溶地貌，是具有溶蚀力的水对可溶性岩石(大多为石灰岩)进行溶蚀作用等所形成的地表和地下形态的总称。我国喀斯特地貌分布区域较广，在我国主要分布在西南地区(广西、云南、贵州、西藏东南部等地区)。贵州荔波、重庆武隆、四川九寨沟、贵州黄果树瀑布、桂林山水、云南石林、湖南黄龙洞等都是著名的喀斯特景观"], ["丹霞地貌", "1939年，构造地质学家把红色岩层上发育的地貌称为丹霞地形。一般认为，有陡崖的陆相红层地貌为丹霞地貌。2010年，“中国丹霞”入选世界自然遗产。典型的丹霞地貌分布在福建武夷山、浙江江郎山、江西龙虎山、广东丹霞山、云南老君山、湖南崑山、甘肃张掖、贵州赤水、美国科罗拉多大峡谷等地"], ["雅丹地貌", "雅丹地貌，是一种典型的风蚀性地貌(回旋形土墩),有些地貌外观如同古城堡，俗称 “魔鬼城”。典型的风蚀地貌(回旋形土墩):新疆罗布泊地区、青海柴达木盆地的魔鬼城"], ["冰川地貌", "由冰川作用塑造的地貌，属于气候地貌范畴"]] },
    { cat: "地理", hl: ["河流湖泊", "河流", "湖泊"], text: "长江它来自唐古拉中国第一大第一长，流经十一省三峡葛洲坝入东海太平洋", table: [["河流", "黄河", "黄河发源于青藏高原巴颜喀拉山，流经9个省(自治区),青海、四川、甘肃、宁夏、内蒙古、山西、陕西、河南及山东。渭河是黄河最长、最大的支流。黄河呈“几”字形，是世界上含沙量最多的河流。在冬春季节，可能有凌汛现象出现，被称为“母亲河”“中华民族的摇篮”,于山东东营流入渤海。小浪底水利枢纽是治理开发黄河的关键性工程；龙羊峡、青铜峡是黄河上比较重要的水电站"], ["河流", "长江", "长江发源于青藏高原唐古拉山脉(唐古拉山脉被誉为“青藏分水岭”),长江是中国第一大河、第一长河，是世界第三大河，仅次于非洲的尼罗河与南美洲的亚马孙河，水量也是世界第三。汉江是长江最长的支流，嘉陵江是长江流域面积最大的支流，岷江是长江径流量最大的支流。长江是我国水量最大的河流，地跨三级阶梯，水能资源丰富，有“黄金水道”之称。葛洲坝水电站是长江上第一座大型水电站。长江流经11个省(市、自治区),青海(青)一四川(川)—西藏(藏)—云南(滇)一重庆(渝) — 湖北(鄂) — 湖南(湘) — 江西(赣) — 安徽(皖) — 江苏(苏) — 上海 (沪),于上海崇明岛注入东海"], ["湖泊", "淡水湖", "江西的鄱阳湖(最大)、湖南洞庭湖、江苏太湖和洪泽湖、安徽巢湖"], ["湖泊", "咸水湖", "青海湖(最大)、西藏纳木错(最高)、新疆艾丁湖(最低)"]] },
    { cat: "地理", hl: ["地势地形", "上昆仑祁连和横断看看", "地势第一阶梯盆地"], text: "", table: [["地势", "第一阶梯", "盆地：柴达木盆地高原：青藏高原"], ["地势", "第二阶梯", "高原：内蒙古高原、黄土高原、云贵高原盆地：准噶尔盆地、四川盆地、塔里木盆地"], ["地势", "第三阶梯", "平原：东北平原、华北平原、长江中下游平原丘陵：辽东丘陵、山东丘陵、东南丘陵"], ["地势", "我国地势第一、二级阶梯分界线：昆仑山—祁连山—横断山我国地势第二、三级阶梯分界线：大兴安岭—太行山—巫山—雪峰山秦岭—淮河一线以南主要为水稻种植区，以北为小麦种植区", "我国地势第一、二级阶梯分界线：昆仑山—祁连山—横断山我国地势第二、三级阶梯分界线：大兴安岭—太行山—巫山—雪峰山秦岭—淮河一线以南主要为水稻种植区，以北为小麦种植区"], ["地形", "四大高原", "青藏高原：世界上海拔最高的高原，被称为“世界屋脊”“世界第三极”。地热资源、太阳能、水能资源非常丰富。大约5000万年前，印度板块与欧亚板块相碰撞，形成了青藏高原<br>内蒙古高原：称为“瀚海”,我国第二大高原，是我国最平坦的高原，有典型的风蚀地貌<br>黄土高原：世界黄土分布最广的“黄土地”,流水侵蚀，地表千沟万壑<br>云贵高原：喀斯特地貌发育典型，地势崎岖不平，有许多“坝子”"], ["地形", "四大盆地", "塔里木盆地：我国最大的内陆盆地，内有中国最大沙漠塔克拉玛干沙漠和中国最大的内流河塔里木河<br>准噶尔盆地：我国位置最北的盆地，有典型的风蚀雅丹地貌。位于天山以北，降水较多，农牧业发达，被誉为“塞北江南”<br>柴达木盆地：我国地势最高的盆地，存储丰富的盐、石油、煤以及多种金属矿藏，被称为 “聚宝盆”,有风蚀雅丹地貌<br>四川盆地：我国四大盆地中地势最低的盆地，有“紫色盆地”之称"], ["地形", "三大平原", "东北平原：我国面积最大的平原，地跨黑吉辽和内蒙古四个省级行政区。东北平原是全球仅有的三大黑土区域之一(另外两个分别是乌克兰大平原和美国密西西比河流域)。东北平原是由北部的松嫩平原、南部的辽河平原和东北部的三江平原三部分组成，平原中部有一条稍隆起的分水岭高地<br>华北平原：位于燕山以南，淮河以北，太行山以东，濒临渤海和黄海。跨越京、津、冀、鲁、豫、皖、苏7省市，又称黄淮海平原，由黄河、淮河、海河等河流合力冲积而成<br>长江中下游平原：位于四川盆地以东，海拔在50米以下，地跨鄂、湘、赣、皖、苏、浙、沪等7省市，湖泊密布，素有“鱼米之乡”“水乡泽国”的美誉"], ["地形", "三大丘陵", "东南丘陵：位于我国东南部，包括江南丘陵、浙闽丘陵、两广丘陵等，是我国面积最大的丘陵。黄山、庐山、武夷山、桂林山水皆位于东南丘陵地区<br>山东丘陵：位于山东半岛上，著名旅游景点有泰山<br>辽东丘陵：位于辽东半岛上，著名旅游景点有千山"]] },
    { cat: "地理", hl: ["宗教名山", "四大佛教名山", "四大道教名山"], text: "四大佛教名山：四大佛教的第一山，去山西来五台，浙江的普陀峨眉四川，安徽九华别搞乱梵净山：黔金丝猴梵净山待，一级保护肩有点白", table: [["四大道教名山", "湖北武当山：道教第一名山。武当山是道教名山和武当武术的发源地，被称为“亘古无双胜境，天下第一仙山”"], ["四大道教名山", "四川青城山：青城山分为前山和后山，群峰环绕起伏、林木葱茏幽翠，享有“青城天下幽” 的美誉"], ["四大道教名山", "安徽齐云山：齐云山位于安徽省黄山市休宁县齐云山镇。齐云山古称白岳，因遥观山顶与云平齐得名，是道教名山之一，属安徽道教主要活动场所及著名风景游览区。"], ["四大道教名山", "江西龙虎山：龙虎山是中国典型的丹霞地貌风景，是中国道教发祥地，2007年加入世界地质公园网络"], ["四大佛教名山", "山西五台山：文殊菩萨的道场，世界文化遗产，位于黄河流域"], ["四大佛教名山", "四川峨眉山：普贤菩萨的道场，世界文化与自然双遗产"], ["四大佛教名山", "安徽九华山：地藏菩萨的道场，九华山位于安徽省池州市"], ["四大佛教名山", "浙江普陀山：观世音菩萨的道场，普陀山位于东海"], ["梵净山", "梵净山是中国佛教重要名山，但不属于传统四大佛教名山，而常被视为“佛教第五大名山” 或“弥勒菩萨道场”的代表。第42届世界遗产大会上，中国贵州铜仁梵净山成功列入世界自然遗产名录。一级保护动物黔金丝猴分布在梵净山，其特点是肩部长有一小块白色的毛"]] },
    { cat: "地理", hl: ["三山五岳", "三山：黄山的美名唐朝改", "三山"], text: "江西庐山多教派，白鹿洞朱熹在。雁荡山浙江南北分开，在东南第一展风采五岳：看泰山衡山华山嵩山，加上恒山五岳都不简单。这东岳领头那南岳独秀，西高北悬中岳书院踢球 ①奇松 ②怪石 ③云海 ④温泉", table: [["三山", "安徽黄山", "黄山位于安徽省，在唐朝时更名为“黄山”,是世界文化与自然双重遗产，代表景观有 “四绝三瀑”,“四绝”指奇松、怪石、云海、温泉；“三瀑”指人字瀑、百丈泉、九龙瀑"], ["三山", "江西庐山", "庐山，又名匡山、匡庐，位于江西省九江市境内，以雄、奇、险、秀闻名于世，素有“匡庐奇秀甲天下”之誉。白鹿洞书院位于庐山五老峰上，是朱熹重建并讲学的书院"], ["三山", "浙江雁荡山", "雁荡山位于我国浙江省乐清市境内，分为南雁荡山、北雁荡山，素有“寰中绝胜”“海上名山”之誉，史称“东南第一山”"], ["五岳", "东岳泰山 (山东)", "东岳泰山位于山东泰安，又名岱山、岱宗、岱岳、东岳、泰岳，有“五岳之首”、“五岳之长”、五岳之尊、“天下第一山”之称。泰山有“五绝”和“六美”: “五绝”指的是泰山五道风景线：南麓的岱宗坊、红门宫，山顶的玉皇顶、日观峰、仙人崖。“六美”指是指泰山的六个景点：旭日东升、云海玉盘、晚霞夕照、黄河金带、天门云梯和雾凇奇观"], ["五岳", "西岳华山 (陕西)", "西岳华山海拔为五岳最高，华山有“奇险天下第一山”的美誉"], ["五岳", "北岳恒山 (山西)", "北岳恒山有著名的悬空寺"], ["五岳", "南岳衡山 (湖南)", "南岳衡山享有“五岳独秀”的美名"], ["五岳", "中岳嵩山 (河南)", "嵩山位于河南省的中部地区，是中国最重要的道教圣地之一。地处河南省登封市西北面，是五岳中的中岳。嵩山南麓有“嵩山汉三阙”,分别是太室阙、少室阙、启母阙。其中启母阙和少室阙上都有“蹴鞠图”。蹴鞠指古人以脚踢皮球的活动，类似今日的足球。嵩阳书院位于嵩山南麓，是“宋初四大书院”(岳麓书院、白鹿洞书院、嵩阳书院、应天书院)之一"]] },
    { cat: "地理", hl: ["四大石窟", "敦煌莫高麦积山", "口诀速背X"], text: "口诀速背X", table: [["甘肃敦煌莫高窟", "莫高窟俗称“千佛洞”,保存了长达1000多年的古代珍贵壁画和彩塑艺术品，位于甘肃敦煌鸣沙山东麓。它始建于十六国的前秦时期，历经十六国、北朝、隋、唐、五代、西夏、元等历代的兴建，是中国石窟中内容最丰富的佛教艺术宝库，是世界现存佛教艺术的瑰宝。莫高窟有众多泥塑造像和大量精美壁画，是建筑、雕塑、壁画三者结合的立体艺术，是一座世界艺术宝库。1987年莫高窟被列入《世界遗产名录》"], ["山西大同云冈石窟", "云冈石窟位于山西省大同市，开凿从北魏文成帝和平初(460年)起，是中国第一个规模巨大的石窟群，是东方石雕艺术的精魂，也是中西文化融合的典范，代表着公元5—6世纪佛教艺术的最高成就。云冈石窟与印度阿旃陀石窟、阿富汗巴米扬石窟并称为世界三大石雕艺术宝库"], ["甘肃天水麦积山石窟", "麦积山石窟位于甘肃省天水市麦积区，始建于后秦(384—417年),因山形酷似麦垛而得名。麦积山石窟以泥塑为其特色，塑像的大小于真人相若，被誉为“东方塑像馆”“东方雕塑艺术陈列馆”"], ["河南洛阳龙门石窟", "龙门石窟始凿于北魏孝文帝迁都洛阳之际，繁荣于唐代，断续营造400余年。2345个窟龛、近11万尊造像、2800多块碑刻题记、近80座佛塔……历经1500多个春秋的龙门石窟，是世界上造像最多、规模最大的石刻宝库，联合国教科文组织称之为“中国石刻艺术的最高峰”。2000年11月，龙门石窟被列入《世界遗产名录》,位居中国各大石窟之首。龙门石窟被誉为中国最大的露天石刻艺术博物馆。龙门石窟是北魏、唐代皇家贵族发愿造像最集中的地方，是皇家意志和行为的体现，具有浓厚的国家宗教色彩。龙门石窟最大的佛造像是奉先寺卢舍那大佛。卢舍那大佛是唐高宗时期所造，相传是按照武则天的形象雕刻"], ["河南洛阳龙门石窟", "习近平总书记在龙门石窟考察时指出：“文旅融合前景广阔，要推动文旅产业高质量发展，真正打造成为支柱产业、民生产业、幸福产业。”要把这些中华文化瑰宝保护好、传承好、传播好"]] },
    { cat: "地理", hl: ["四大名楼", "江西滕王王勃显", "江南三大名楼"], text: "", table: [["四大名楼", "江西滕王阁，因王勃的《滕王阁序》而闻名。落霞与孤鹜齐飞，秋水共长天一色。渔舟唱晚，响穷彭蠡之滨，雁阵惊寒，声断衡阳之浦"], ["四大名楼", "湖北黄鹤楼，因崔颢的《黄鹤楼》而闻名。昔人已乘黄鹤去，此地空余黄鹤楼。黄鹤一去不复返，白云千载空悠悠。晴川历历汉阳树，芳草萋萋鹦鹉洲。日暮乡关何处是?烟波江上使人愁"], ["四大名楼", "湖南岳阳楼，因范仲淹的《岳阳楼记》而闻名。岳阳楼是中国十大历史文化名楼，古代四大名楼之一，世称“天下第一楼”"], ["四大名楼", "山西鹳雀楼，因王之涣《登鹳雀楼》而闻名。鹳雀楼位于山西省永济市蒲州古城西面的黄河东岸。欲穷千里目，更上一层楼"], ["江南三大名楼", "滕王阁、黄鹤楼、岳阳楼，均位于长江沿岸"]] },
    { cat: "地理", hl: ["二十四节气", "大寒", "名称"], text: "大寒", table: [["名称", "春天的节气：立春、雨水、惊蛰、春分、清明、谷雨夏天的节气：立夏、小满、芒种、夏至、小暑、大暑秋天的节气：立秋、处暑、白露、秋分、寒露、霜降冬天的节气：立冬、小雪、大雪、冬至、小寒、大寒"], ["反映特征", "反映季节：立春、立夏、立秋、立冬"], ["反映特征", "反映太阳高度：春分、秋分、夏至、冬至"], ["反映特征", "反映寒热程度：小暑、大暑、处暑、小寒、大寒"], ["反映特征", "反映降水现象：雨水、谷雨、小雪、大雪"], ["反映特征", "反映气温变化：白露、寒露、霜降"], ["反映特征", "反映自然物候：惊蛰、清明"], ["反映特征", "反映作物的成熟、收成情况：小满、芒种"]] },
    { cat: "地理", hl: ["旅游景点", "京杭大运河", "贝加尔湖"], text: "淡水蓄水量贝加尔最大，印尼索马里和斯里兰卡，做生意丝绸路都到达，法国巴黎塞纳河边呀 【拓展】维多利亚湖是非洲最大的湖泊，是非洲最大的淡水湖，世界第二大淡水湖，也是尼罗河的主要水库。维多利亚湖位于东非高原上，位于非洲中东部，该湖大部分在坦桑尼亚和乌干达境内，是乌干达、坦桑尼亚与肯尼亚三国的界湖，是众多人公认的世界上最美的地方。", table: [["京杭大运河", "京杭大运河是世界上里程最长、工程最大的古代运河，也是最古老的运河之一，与长城、坎儿井并称为中国古代的三项伟大工程，并且使用至今，是中国古代劳动人民创造的一项伟大工程，是中国文化地位的象征之一。京杭大运河北起北京(涿郡)、南到杭州(余杭),途经北京、天津两市及河北、山东、江苏、浙江四省，贯通海河、黄河、淮河、长江、钱塘江五大水系，全长约1797千米。2014年6月22日，在卡塔尔多哈召开的第38届世界遗产委员会会议上，中国提交的 “大运河”项目成功入选《世界遗产名录》,成为中国第46个世界遗产项目"], ["贝加尔湖", "贝加尔湖位于俄罗斯东西伯利亚南部，是世界第一深湖、也是世界上蓄水量最大的淡水湖，淡水储量达到了全世界总量的五分之一。长636千米，平均宽48千米，面积为 3.15万平方千米，由地层断裂陷落而成。贝加尔湖被称为“西伯利亚的蓝眼睛”"], ["伏尔加河", "伏尔加河位于俄罗斯的西南部，是欧洲最长的河流，也是世界最长的内流河，源头自北向南注入里海"], ["多瑙河", "多瑙河是欧洲第二长河，是世界上流经国家最多的一条河流。它发源于德国西南部黑林山东麓海拔679米的地方，自西向东流经奥地利、斯洛伐克、匈牙利、克罗地亚、塞尔维亚、保加利亚、罗马尼亚、摩尔多瓦、乌克兰等10个国家后，流入黑海"], ["苏伊士运河", "亚洲与非洲的分界线是苏伊士运河"], ["福建武夷山", "福建武夷山属于丹霞地貌，是由陆相红色砂砾岩构成的具有陡峭坡面的地貌形态。武夷山是福建、江西两省重要的林区、茶叶产地，武夷山大红袍是武夷山最负盛名的茶，被誉为“茶中之王”。其两侧存在多处造型奇特的丹霞峰林地貌景观，成为旅游观赏的景点"], ["青藏高原", "青藏高原湖区是我国最大的湖区，湖泊众多。青藏高原是世界上最高的高原，平均海拔4000米以上，位于青藏高原边缘上的喜马拉雅山，有世界屋脊之誉"], ["亚马孙平原", "世界上面积最大的冲积平原"], ["里海", "里海是世界上面积最大的湖，世界上面积最大的咸水湖，里海地处欧洲与亚洲内陆交界处，也是世界上接壤周边国家最多的湖，一共与5个国家接壤"], ["苏必利尔湖", "苏必利尔湖是世界上面积最大的淡水湖，为美国和加拿大共有，蓄水量占五大湖蓄水量一半以上"], ["马里亚纳海沟", "马里亚纳海沟是世界上最深的海沟，位于西太平洋。马里亚纳海沟深达11000多米，是全世界海洋最深之处，被称为“地球第四极”,一直是世界各国海洋科考的一个难关。世界四极分别是南极、北极、青藏高原和马里亚纳海沟"], ["撒哈拉沙漠", "撒哈拉沙漠是世界上最大的沙漠，形成于约250万年前，是世界最大的沙质荒漠，面积约932万平方千米，位于非洲北部。该地区气候条件非常恶劣，是地球上最不适合生物生存的地方之一"], ["阿拉伯半岛", "阿拉伯半岛是世界上最大的半岛，从中东向东南方伸入印度洋，面积约300万平方千米，位于亚洲与非洲之间"], ["珠穆朗玛峰", "珠穆朗玛峰是世界上最高的山峰，喜马拉雅山脉是由印度洋板块与亚欧板块碰撞挤压形成的，其主峰珠穆朗玛峰还在持续升高。珠穆朗玛峰是我国与尼泊尔交界处"], ["死海", "死海是世界上最低的湖泊，也是世界上最深的咸水湖，位于以色列、巴勒斯坦、约旦交界处。死海中含有高浓度的盐分，为一般海水的8.6倍，致使水中没有生物存活，甚至连死海沿岸的陆地上也很少有生物，这也是人们给它起名叫“死海”的原因之一。死海是世界上盐度最高的水体，其表面的盐度为227%—275%,深度40米处的盐度更达到281%。有地壳断裂陷落形成的死海是世界陆地最低点，被称为“世界的肚脐”"], ["中国死海", "运城盐湖是世界三大硫酸钠型内陆盐湖之一。由于其盐含量类似中东的“死海”,湖水密度达每立方厘米1.25克—1.29克(大于人体密度),人在水中可以漂浮不沉，故被誉为“中国死海”"]] },
    { cat: "地理", hl: ["四书五经", "四书：中学论子", "五经"], text: "五经：诗书礼易春秋六经：诗书礼易乐春秋", table: [["四书", "《中庸》是中国古代论述人生修养境界的一部道德哲学专著,是儒家经典之一，核心思想围绕 “中庸之道”展开，强调不偏不倚、折中调和的处世态度和道德准则。原属《礼记》第三十一篇，相传作者是战国子思(孔伋)。孔伋，字子思，是孔子的嫡孙，继承孔子思想，代表作《中庸》,被尊为“述圣”"], ["四书", "《大学》阐述了儒家的基本教义和教育原则，强调个人修养和社会责任"], ["四书", "《论语》是孔子及其弟子的语录集，体现了儒家思想的核心，成书于战国初期。“温故而知新，可以为师矣”出自《论语 ·为政》。“士不可以不弘毅，任重而道远”出自《论语 ·泰伯章》"], ["四书", "《孟子》阐述了人性论，强调仁政和教育的作用。孟子，鲁国邹(今山东邹城)人，战国时期儒家思想代表人物之一，中国古代思想家、哲学家、政治家、教育家，与孔子并称“孔孟”,被后人称为“亚圣”。提出“人性本善”“民为贵，社稷次之，君为轻”"], ["五经", "《诗经》又称诗三百，是我国最早的诗歌总集。其收集诗歌的时间范围是西周初年至春秋中叶 (前11世纪至前6世纪)。反映了古代社会生活和风土人情。内容：风、雅、颂；表现手法：赋、比、兴"], ["五经", "《尚书》记载了上古历史文献"], ["五经", "《礼记》记录了古代的礼仪制度和行为规范"], ["五经", "《周易》包含了六十四卦象，探讨了宇宙万物的变化规律"], ["五经", "《春秋》是鲁国的编年体史书，据传由孔子修订，约成书于春秋时期"], ["六经", "《诗经》《尚书》《礼记》《周易》《乐经》《春秋》"]] },
    { cat: "人文", hl: ["诸子百家", "儒家代表有三贤", "儒家"], text: "子列前篇。墨家兼爱与尚贤，尚同非攻天下传。法家代表韩非鞅，韩非子里寓言藏。杂家代表韦佼安，吕氏春秋不韦编来解答。因此，选择 C 选项。", table: [["儒家", "儒家的代表人物是孔子、孟子、荀子。孔子将“仁”视为最高道德准则，主张统治者应“为政以德”(《论语 ·为政》),即通过自身的道德修养和仁爱的态度治理国家，而非依靠刑罚暴力。他认为“其身正，不令而行；其身不正，虽令不从”,强调统治者的榜样作用"], ["道家", "道家的代表人物是老子、庄子。道家代表作：《道德经》,又名《老子》,分为《德经》与《道经》,内容以“道德”为纲宗。句式整齐，以韵文为主，韵散结合，富有音韵之美。《庄子》,又名《南华经》,大量运用寓言，名篇有《逍遥游》《齐物论》等。老子的观点：“无为而治”“上善若水”“柔弱胜刚强”“祸兮福之所倚，福兮祸之所伏”“道生一，一生二，二生三，三生万物”。庄子的观点：“天人合一 ”“清静无为”“庖丁解牛”“庄周梦蝶”“鹏程万里”"], ["墨家", "墨家的代表人物是墨子(墨翟),墨家学派创始人，墨家思想的奠基者，被后世弟子尊为“巨子” (墨家最高领袖),是战国时期平民思想的代表。墨家提出“兼爱”“非攻”“尚贤”“尚同”“节用”“节葬”“非乐”等十大主张，同时信奉“天志”和“明鬼”。墨子在科技领域成就突出，被称为“古代科学家”,《墨子》中记载了小孔成像、杠杆原理等光学和力学知识"], ["法家", "法家代表人物有管仲、李悝、吴起、商鞅、韩非。法家代表作：《韩非子》是战国时期思想家韩非的著作总集，善于运用浅近的寓言来说明抽象的道理，具有较强的论辩性。成语“守株待兔”“滥竽充数”均出自《韩非子》。法家的观点：以法治国。经济上，主张废井田，重农抑商、奖励耕战；政治上，主张废分封，设郡县，实行君主专制。不法古、不循今"], ["杂家", "杂家的代表人物有吕不韦、尸佼、刘安。杂家是战国末期至汉初兴起的思想流派，其特点是“兼儒墨，合名法”,融合各家学说之长，注重实用性和综合性，旨在为统治者提供治国安邦的理论体系。杂家代表作：《吕氏春秋》,汇集了先秦诸子百家的思想，包括儒家、道家、法家、墨家、农家等，是一部典型的“杂家”著作。成书时间是战国末期(约公元前3世纪),由秦国丞相吕不韦组织门客编撰而成"], ["兵家", "兵家的代表人物是孙武和孙膑。孙武，春秋时期著名的军事家、政治家，被尊称“兵圣”或“孙子”,又称“兵家至圣”,被誉为 “百世兵家之师”“东方兵学的鼻祖”,著作《孙子兵法》。孙膑，战国时期军事家，著作《孙膑兵法》中提出了前所未见的新型战术理念，是中国古代军事理论的瑰宝"]] },
    { cat: "人文", hl: ["唐宋八大家"], text: "X", table: [["唐宋八大家", "韩愈，字退之，世称韩昌黎、昌黎先生。苏轼称赞韩愈“文起八代之衰”,韩愈与柳宗元并称为“韩柳”。韩愈是唐代古文运动的倡导者，被称为“唐宋八大家之首”。著作：①“闻道有先后，术业有专攻”“传道授业解惑”出自《师说》。②“如此孩提者，又可冀其成立邪?”出自《祭十二郎文》,孩提指2—3岁的儿童，幼儿时期。③“世有伯乐，然后有千里马。千里马常有，而伯乐不常有”出自《马说》。④“业精于勤，荒于嬉；行成于思，毁于随”“焚膏油以继晷，恒兀兀以穷年”出自《进学解》。⑤“天街小雨润如酥，草色遥看近却无。最是一年春好处，绝胜烟柳满皇都”出自《早春呈水部张十八员外 ·其一》,描写和赞美的是早春的美景。皇都即帝都，指长安"], ["唐宋八大家", "柳宗元，字子厚，山西河东人。柳宗元被称为柳河东，是以籍贯命名的。著作：①《捕蛇者说》《黔之驴》《永州八记》。②“孤舟蓑笠翁，独钓寒江雪”出自五言绝句《江雪》"], ["唐宋八大家", "欧阳修，字永叔，号醉翁，晚号六一居士，谥号文忠，故世称欧阳文忠公。欧阳修是北宋文坛的领袖、宋代散文的奠基人，标志着北宋诗文革新运动最高成就。代表作：《新唐书》《新五代史》《醉翁亭记》。《醉翁亭记》考点：①“环滁皆山也。其西南诸峰，林壑尤美，望之蔚然而深秀者，琅琊也”。②因 《醉翁亭记》而驰誉古今的山是琅琊山，醉翁亭位于安徽省滁州市西南琅琊山旁"], ["唐宋八大家", "王安石，字介甫，号半山，谥文，封荆国公，世人又称王荆公，因籍贯临川，故亦称王临川。依靠宋神宗实行变法，被列宁誉为“中国十一世纪的改革家”。“宰相肚里能撑船”说的是王安石。著作：①“不畏浮云遮望眼，自缘身在最高层”出自《登飞来峰》。②“爆竹声中一岁除，春风送暖入屠苏。千门万户瞳瞳日，总把新桃换旧符”出自《元日》。③“千古凭高对此，谩嗟荣辱。六朝旧事随流水，但寒烟衰草凝绿”,金陵咏古词句，出自《桂枝香》。④《伤仲永》《游褒禅山记》"], ["唐宋八大家", "苏轼，字子瞻，号东坡居士，宋词豪放派代表。苏轼打破了诗与词的界限，使词走向广阔的社会生活中。“乌台诗案”是元丰二年(1079年)御史何正臣上表弹劾苏轼的案件。著作：《赤壁赋》《江城子》《念奴娇 ·赤壁怀古》《水调歌头》"], ["唐宋八大家", "苏洵，字明允，擅长散文，尤擅政论"], ["唐宋八大家", "苏辙，字子由，自号颍滨遗老。著作：《黄州快哉亭记》《上枢密韩太尉书》"], ["唐宋八大家", "曾巩：字子固，世称南丰先生，著作：《墨池记》"], ["一门父子三词客：北宋文学家苏洵、苏轼、苏辙千古文章四大家：韩愈、柳宗元、欧阳修、苏轼", "一门父子三词客：北宋文学家苏洵、苏轼、苏辙千古文章四大家：韩愈、柳宗元、欧阳修、苏轼"]] },
    { cat: "人文", hl: ["初唐四杰", "初唐的孤鹜起"], text: "", table: [["初唐四杰", "王勃", "王勃位列“初唐四杰”之首，王勃的代表作有《滕王阁序》《送杜少府之任蜀州》《乾元殿颂》《王子安集》等。“落霞与孤鹜齐飞，秋水共长天一色”出自《滕王阁序》。“海内存知己，天涯若比邻”出自《送杜少府之任蜀州》。“九月九日望乡台，他席他乡送客杯”出自《九日登高》。“江送巴南水，山横塞北云”出自《江亭夜月送别二首》"], ["初唐四杰", "杨炯", "杨炯，唐代文学家，692年任盈川县令，吏治以严酷著称。后人称他为“杨盈川”。“宁为百夫长，胜作一书生”出自《从军行》"], ["初唐四杰", "卢照邻", "卢照邻代表作《长安古意》是初唐七言歌行的代表作之一。“雪似胡沙暗，冰如汉月明”出自《雨雪曲》"], ["初唐四杰", "骆宾王", "骆宾王活跃于唐高宗至武则天时期。公元683年，随徐敬业在扬州起兵反对武则天，撰写《为徐敬业讨武瞾檄》,兵败后下落不明。生平充满谜团。相传七岁作《咏鹅》诗，“鹅，鹅，鹅，曲项向天歌。白毛浮绿水，红掌拨清波”流传千古，成为中国文学史上“神童”的经典案例"]] },
    { cat: "人文", hl: ["唐诗", "愿作比翼的琵琶女", "盛唐"], text: "雪戴蓑笠，柳宗元永州记，李贺叹天老矣。诗囚孟郊写游子吟，登科后春风得意。晚唐杜牧李商隐，阿房宫赋和无题。", table: [["盛唐", "山水诗人", "王维，字摩诘，有“诗佛”之称，苏东坡曾盛赞他的诗“诗中有画，画中有诗”。著作：①“大漠孤烟直，长河落日圆”出自《使至塞上》。“长河落日圆”指光的直线传播，其中的 “河”指的是黄河。②“独在异乡为异客，每逢佳节倍思亲”出自《九月九日忆山东兄弟》,诗中的“佳节”指的是重阳节。③“劝君更尽一杯酒，西出阳关无故人”出自《送元二使安西》,诗句中的“阳关”在今天的甘肃敦煌"], ["盛唐", "边塞诗人", "孟浩然，被称为孟襄阳，是以籍贯命名的，今湖北襄阳人。著作：①“人事有代谢，往来成古今”出自《与诸子登岘山》。②“春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少”出自《春晓》。③“移舟泊烟渚，日暮客愁新。野旷天低树，江清月近人”出自《宿建德江》。④“故人具鸡黍，邀我至田家”“待到重阳日，还来就菊花”出自田园诗《过故人庄》 边塞派诗人以高适、岑参、李颀、王昌龄、王之涣最为知名，而高、岑成就最高，所以也叫高岑诗派。王昌龄、王之涣并称“二王”。著作：①“莫愁前路无知己，天下谁人不识君”——高适《别董大》。②“忽如一夜春风来，千树万树梨花开”——岑参《白雪歌送武判官归京》。③“但使龙城飞将在，不教胡马度阴山”——王昌龄《出塞》。④“白日依山尽，黄河入海流”——王之涣《登鹳雀楼》。⑤“羌笛何须怨杨柳，春风不度玉门关”——王之涣《凉州词》。“凉州”是今甘肃武威市，“玉门关”在今甘肃敦煌市西北"], ["盛唐", "大李杜", "李白，字太白，号青莲居士，人称“谪仙人”“诗仙”,有《李太白集》传世，《梦游天姥吟留别》 等，创造了古代浪漫主义文学的高峰。著作：①“孤帆远影碧空尽，唯见长江天际流”出自《黄鹤楼送孟浩然之广陵》。②“天生我材必有用，千金散尽还复来”出自《将进酒》。③“我醉欲眠卿且去，明朝有意抱琴来”出自《山中与幽人对酌》。④“日照香炉生紫烟，遥看瀑布挂前川”出自《望庐山瀑布》。⑤“又闻子规啼夜月，愁空山。蜀道之难，难于上青天，使人听此凋朱颜!”出自《蜀道难》。⑥“长风破浪会有时，直挂云帆济沧海”出自《行路难》,体现的哲理是事物发展是前进性与曲折性的统一。⑦“脚著谢公屐，身登青云梯。半壁见海日，空中闻天鸡”出自《梦游天姥吟留别》,“谢公”指的是谢灵运。⑧“床前明月光，疑是地上霜”出自《静夜思》。⑨“青梅竹马，两小无猜”出自《长干行》 杜甫，字子美，自号少陵野老，世称“杜工部”“诗圣”,其诗被称为“诗史”,唐代现实主义诗人，常被称为“老杜”,又与李白合称“李杜”“大李杜”。有《杜工部集》传世。著作：①“三吏”(《新安吏》《石壕吏》《潼关吏》)。②“三别”(《新婚别》《无家别》《垂老别》)。③“国破山河在，城春草木深。感时花溅泪，恨别鸟惊心”出自《春望》。④“无边落木萧萧下，不尽长江滚滚来”出自《登高》。⑤“岱宗夫如何?齐鲁青未了”“会当凌绝顶，一览众山小”出自《望岳》,是杜甫登泰山写下的豪言壮语。“岱宗”指的是泰山。⑥“露从今夜白，月是故乡明”出自《月夜忆舍弟》。<br>⑦“安得广厦千万间，大庇天下寒士俱欢颜!风雨不动安如山”出自《茅屋为秋风所破歌》。⑧“三顾频烦天下计，两朝开济老臣心”出自《蜀相》。⑨《北征》《兵车行》《闻官军收河南河北》"], ["中唐", "诗魔", "白居易，字乐天，号香山居士，世称“诗魔”“诗王”,现实主义诗人。著作：①“风翻白浪花千片，雁点青天字一行”出自《江楼晚眺景物鲜奇吟玩成篇寄水部张员外》。②“同是天涯沦落人，相逢何必曾相识”出自《琵琶行》。③“文章合为时而著,歌诗合为事而作”出自《与元九书》。④“日出江花红胜火，春来江水绿如蓝”出自《忆江南》。⑤“回眸一笑百媚生，六宫粉黛无颜色”“在天愿作比翼鸟，在地愿为连理枝”出自《长恨歌》。⑥“半匹红绡一丈绫，系向牛头充炭直”出自《卖炭翁》,在经济学上来说，其中的“红绡” “绫”代表的是一般等价物。⑦“乱花渐欲迷人眼，浅草才能没马蹄。最爱湖东行不足，绿杨阴里白沙堤”出自《钱塘湖春行》,描写的是杭州西湖的风景。⑧“离离原上草，一岁一枯荣。野火烧不尽，春风吹又生”出自《赋得古原草送别》"], ["中唐", "诗鬼", "李贺，字长吉，浪漫主义诗人，世称李昌谷，著有《昌谷集》。被后人誉为“诗鬼”。著作：①“黑云压城城欲摧，甲光向日金鳞开”出自《雁门太守行》。②“衰兰送客咸阳道，天若有情天亦老”出自《金铜仙人辞汉歌》。③“昆山玉碎凤凰叫，芙蓉泣露香兰笑”出自《李凭箜篌引》。④“老兔寒蟾泣天色，云楼半开壁斜白”出自《梦天》。⑤“长吉体”是李贺的诗歌所独有的风格意境，李贺特别擅长短篇，如《天上谣》《梦天》《帝子歌》等，被后人称为“长吉体”的代表作"], ["中唐", "诗豪", "刘禹锡，字梦得，人称“诗豪”,代表作有《陋室铭》《竹枝词》《杨柳枝词》《乌衣巷》等。著作：①“山不在高，有仙则名。水不在深，有龙则灵”出自《陋室铭》。②“唯有牡丹真国色，花开时节动京城”出自《赏牡丹》。③“旧时王谢堂前燕，飞入寻常百姓家”出自《乌衣巷》。④“塞北梅花羌笛吹，淮南桂树小山词。请君莫奏前朝曲，听唱新翻杨柳枝”出自《杨柳枝词》, 这首诗体现的哲理是事物是不断变发展的，要有创新精神"], ["中唐", "诗囚", "孟郊，人称“诗囚”,与贾岛并称为“郊寒岛瘦”。其代表作有《游子吟》《登科后》。“春风得意马蹄疾，一日看尽长安花”出自《登科后》"], ["晚唐", "小李杜", "李商隐，字义山，号玉溪生，创写了以男女之情为题材的无题诗。其诗构思新奇，风格秾丽，尤其是一些爱情诗和无题诗写得缠绵悱恻，优美动人，后世广为传诵。著作：①“沧海月明珠有泪，蓝田日暖玉生烟”出自《锦瑟》。②“相见时难别亦难，东风无力百花残。春蚕到死丝方尽，蜡炬成灰泪始干”出自《无题 ·相见时难别亦难》。③“君问归期未有期，巴山夜雨涨秋池。何当共剪西窗烛，却话巴山夜雨时”出自《夜雨寄北》。④“历览前贤国与家，成由节俭破由奢”出自《咏史》,这是李商隐在总结唐朝由盛世走向衰败的历史教训时写下的警世名言<br>杜牧，字牧之，世称杜樊川，因晚年隐居樊川，号“樊川居士”,作品集《樊川文集》。杜牧是我国第一个大量用七绝写咏史诗的诗人。他以七绝咏史见长，作品被称为“二十八字史论”。著作：①“东风不与周郎便，铜雀春深锁二乔”出自《赤壁》。②“商女不知亡国恨，隔江犹唱后庭花”出自《泊秦淮》。③“停车坐爱枫林晚，霜叶红于二月花”出自《山行》。④“天阶夜色凉如水，卧看牵牛织女星”出自《秋夕》。⑤“清明时节雨纷纷，路上行人欲断魂”出自《清明》。⑥“南朝四百八十寺，多少楼台烟雨中”出自《江南春》。⑦“灭六国者六国也，非秦也；族秦者秦也，非天下也”出自《阿房宫赋》。“勾心斗角”一词出自《阿房宫赋》。⑧“一骑红尘妃子笑，无人知是荔枝来”出自《过华清宫》"]] },
    { cat: "人文", hl: ["宋词", "范仲淹岳阳楼与谁同归", "豪放派"], text: "", table: [["豪放派", "范仲淹", "范仲淹，字希文，世称范文正公，代表作《岳阳楼记》,是一篇散文，重点描写的是洞庭湖的景色。①《岳阳楼记》常考名句：“先天下之忧而忧，后天下之乐而乐”。“居庙堂之高则忧其民，处江湖之远则忧其君”。“政通人和，百废具兴”。“阴风怒号，浊浪排空”。“长烟一空，皓月千里”。“不以物喜，不以己悲”。②“羌管悠悠霜满地，人不寐，将军白发征夫泪”出自《渔家傲 ·秋思》"], ["豪放派", "辛弃疾", "辛弃疾，字幼安，号稼轩，山东济南人。南宋豪放派词人、将领。辛弃疾艺术风格多样，但以豪放为主，有“词中之龙”之称。与苏轼合称“苏辛”,与李清照并称“济南二安”。主要作品有《稼轩长短句》《清平乐》。著作：①“江晚正愁余，山深闻鹧鸪”出自《菩萨蛮 ·书江西造口壁》,“鹧鸪”这个意象表达了诗人离愁别绪，落魄、怀古的情绪。②“想当年，金戈铁马，气吞万里如虎”出自《永遇乐 ·京口北固亭怀古》,属于怀古诗。③《美芹十论》从第一论以至于第十论，无一不是精辟之论。同时，这也是一部很好的军事论著,有着很高的研究价值。除此之外，《美芹十论》成了辛弃疾的代名词，郭沫若先生为辛弃疾墓写过一副挽联：“铁板铜琶，继东坡高唱大江东去(上联);美芹悲黍，冀南宋莫随鸿雁南飞(下联)。”<br>④“稻花香里说丰年，听取蛙声一片”出自《西江月 ·夜行黄沙道中》。⑤“八百里分麾下炙，五十弦翻塞外声，沙场秋点兵”出自《破阵子 ·为陈同甫赋壮词以寄之》。⑥“东风夜放花千树，更吹落，星如雨。宝马雕车香满路。凤箫声动，玉壶光转，一夜鱼龙舞。蛾儿雪柳黄金缕，笑语盈盈暗香去。众里寻他千百度。蓦然回首，那人却在，灯火阑珊处”出自辛弃疾的 《青玉案 ·元夕》。其中“青玉案”是词牌名，“元夕”是题名。⑦著名的国学大师王国维说：“古今之成大事业、大学问者，必经过三种之境界。”他引用宋词中的名句来形容这三种境界。第一境界是：“昨夜西风凋碧树，独上高楼，望尽天涯路”(出自晏殊的《蝶恋花 ·槛菊愁烟兰泣露》)。第二境界是：“衣带渐宽终不悔，为伊消得人憔悴”(出自柳永的《蝶恋花 ·伫倚危楼风细细》)。第三境界是：“众里寻他千百度。蓦然回首，那人却在，灯火阑珊处”。⑧《九议》撰写于宋孝宗乾道年间(1165—1173年),当时辛弃疾参与耿京起义，擒杀叛徒张安国，回归南宋，面对南宋在与金国对峙中的被动局面，他结合自身抗金经验和对时局的洞察，写下这组奏议，希望能说服朝廷转变国策，积极备战抗金，但不被朝廷采纳"], ["豪放派", "岳飞", "岳飞，字鹏举，代表作：《满江红 ·怒发冲冠》《小重山 · 昨夜寒蛩不住鸣》。《满江红 ·怒发冲冠》考点：①《满江红 ·怒发冲冠》是南宋抗金民族英雄岳飞创作的一首词，表现了作者抗击金兵、收复故土、统一祖国的强烈的爱国精神。②常考名句：A.“笑谈渴饮匈奴血”,其中“匈奴”是指女真统治者。B.“靖康耻，犹未雪。臣子恨，何时灭”讲述了发生在宋朝的“靖康之变”(金破东京擒二帝),“靖康”指的是年号。C.“莫等闲，白了少年头，空悲切”表达了岳飞对南宋抗金历史事件的感慨。从哲学角度看，这句话说明了时间的一维性"], ["豪放派", "陆游", "陆游 ，字务观，号放翁，现存诗9300余首，是中国古代存诗最多的诗人，诗集为《剑南诗稿》,文集为《渭南文集》。代表作是《示儿》《钗头凤》。①《示儿》考点：“王师北定中原日，家祭无忘告乃翁”出自《示儿》,直接导致北宋灭亡的历史事件是靖康之变。②《钗头凤 ·红酥手》考点：A.《钗头凤 ·红酥手》描写了词人与原配唐婉的爱情悲剧。记述了词人与唐氏被迫分开后，在禹迹寺南沈园的一次偶然相遇的情景。陆游乘醉吟赋这首词，信笔题于园壁之上。B.“春如旧，人空瘦，泪痕红浥鲛绡透”出自《钗头凤 ·红酥手》"], ["婉约派", "李煜", "李煜，字重光，号钟隐、莲峰居士，史称五代十国时期“南唐后主”“千古词帝”。李煜虽出身皇室，却不喜参政和国家大事，他一心潜没于诗词文学的深海，精书法、工绘画、通音律，诗文均有一定造诣，尤以词的成就最高。代表作：①《虞美人》 A.虞美人是词牌名，代表作有李煜《虞美人 ·春花秋月何时了》《虞美人 ·风回小院庭芜绿》等。B.《虞美人 ·春花秋月何时了》名句：“雕栏玉砌应犹在，只是朱颜改”。“问君能有几多愁?恰似一江春水向东流”。②《相见欢 ·无言独上西楼》 A.李煜的名篇，词牌名为相见欢，咏的却是离别愁。B.原文：无言独上西楼，月如钩。寂寞梧桐深院锁清秋。剪不断，理还乱，是离愁。别是一般滋味在心头。③《浪淘沙 ·帘外雨潺潺》 A.浪淘沙原为唐教坊曲名，后用为词牌名。中唐刘禹锡、白居易依小调《浪淘沙》唱和而首创乐府歌辞《浪淘沙》。B.原文：帘外雨潺潺，春意阑珊。罗衾不耐五更寒。梦里不知身是客，一晌贪欢。独自莫凭栏，无限江山。别时容易见时难。流水落花春去也，天上人间"], ["婉约派", "柳、永", "柳永，字耆卿，原名三变，北宋婉约派词人的代表人物。柳永制作大量慢词长调，以“白衣卿相”自谓，精通音律，擅长铺陈点染，其创作重心主要在词的创作，擅长用细腻的笔触描写都市繁华和男女情感。柳永的词在宋元时代流传最广，“凡有井水饮处，皆能歌柳词”。代表作：①《雨霖铃 ·寒蝉凄切》 原文：寒蝉凄切，对长亭晚，骤雨初歇。都门帐饮无绪，留恋处，兰舟催发。执手相看泪眼，竟无语凝噎。念去去，千里烟波，暮霭沉沉楚天阔。多情自古伤离别，更那堪，冷落清秋节!今宵酒醒何处?杨柳岸，晓风残月。此去经年，应是良辰好景虚设。便纵有千种风情，更与何人说? ②《蝶恋花 ·伫倚危楼风细细》 原文：伫倚危楼风细细，望极春愁，黯黯生天际。草色烟光残照里，无言谁会凭阑意。拟把疏狂图一醉，对酒当歌，强乐还无味。衣带渐宽终不悔，为伊消得人憔悴。③“渔市孤烟袅寒碧，水村残叶舞愁红”出自《雪梅香 ·景萧索》。④“渐霜风凄紧，关河冷落，残照当楼”“惟有长江水，无语东流”“想佳人，妆楼颗望，误几回、天际识归舟”出自《八声甘州 ·对潇潇暮雨洒江天》。被苏轼评价为“唐人高处，不过如此” ⑤“三秋桂子，十里荷花”出自《望海潮 ·东南形胜》"], ["婉约派", "秦观", "秦观，字少游，号淮海居士，属于“苏门四学士”(黄庭坚、秦观、晁补之、张耒)之一。代表作：《鹊桥仙 ·纤云弄巧》。《鹊桥仙 ·纤云弄巧》是一首咏七夕的节序词，借牛郎织女悲欢离合的神话故事，讴歌了真挚、细腻、纯洁、坚贞的爱情。原文：纤云弄巧，飞星传恨，银汉迢迢暗度。金风玉露一相逢，便胜却人间无数。柔情似水，佳期如梦，忍顾鹊桥归路。两情若是久长时，又岂在朝朝暮暮"], ["婉约派", "李清照", "李清照，号易安居士，与辛弃疾并称“济南二安”,被称为“千古第一才女”“三瘦词人”,被誉为 “词国皇后”。代表作：《一剪梅》《声声慢》《醉花阴》。①李清照被称为“三瘦词人”,所谓“三瘦”是指她喜以“瘦”字入词，来形容花容人貌，并创造了三个因“瘦”而名传千古的佳句：A.“莫道不销魂，帘卷西风，人比黄花瘦”出自《醉花阴》。此句中的“黄花”指的是菊花。B.“知否，知否?应是绿肥红瘦”出自《如梦令 ·昨夜雨疏风骤》。这里的“红瘦”指的是海棠花。这句词描写的是暮春时节的景色。暮春是春季的最后阶段，此时春天即将过去，夏天即将到来。词中的“绿肥”指的是树叶枝叶繁茂，“红瘦”则指花朵凋零稀少。这种景象正是暮春时节的特点。C.“新来瘦，非干病酒，不是悲秋”出自《凤凰台上忆吹箫》。②“此情无计可消除，才下眉头，却上心头”出自《一剪梅 ·红藕香残玉簟秋》。③“暗淡轻黄体性柔，情疏迹远只香留。何须浅碧深红色，自是花中第一流”出自《鹧鸪天 ·桂花》,词中描述的是桂花。④“生当作人杰，死亦为鬼雄”出自《夏日绝句》。⑤“乍暖还寒时候，最难将息”出自《声声慢 ·寻寻觅觅》。“将息”是指保养身体。⑥“莫许杯深琥珀浓，未成沉醉意先融”出自《浣溪沙 ·莫许杯深琥珀浓》。意思是不要说这酒杯太深，如琥珀般的酒太浓，而未醉即已意蚀魂消。⑦李清照在《词论》中批评柳永“虽协音律，而词语尘下”,意思是柳永的词虽然符合音律要求，但用词俗气，不够高雅。这一评价反映了李清照对词的艺术标准的高要求，她推崇典雅含蓄的风格，而柳永的词多写市井风情、男女艳情，语言通俗直白，故被李清照诟病。⑧“大明湖畔，趵突泉边，故居在垂杨深处；漱玉集中，金石录里，文采有后主遗风”是郭沫若为李清照题写的楹联"]] },
    { cat: "人文", hl: ["元曲", "口诀速背元曲四大悲剧"], text: "口诀速背元曲四大悲剧：梧汉赵窦(谐音记忆：武汉找豆) 元曲四大爱情剧：拜西墙倩(谐音记忆：白锡抢钱)", table: [["元曲", "元曲四大家 “郑关白马”", "郑光祖：《倩女离魂》一张倩女。关汉卿：《窦娥冤》—窦娥；《救风尘》一赵盼儿；《望江亭》—谭记儿。1958年，关汉卿被世界和平理事会列为世界十大文化名人。白朴：《墙头马上》—裴少俊；《梧桐雨》—唐明皇、杨贵妃。马致远：《汉宫秋》—王昭君、汉元帝；《青衫泪》一白居易"], ["元曲", "元曲四大悲剧", "《窦娥冤》《梧桐雨》《汉宫秋》《赵氏孤儿》"], ["元曲", "元曲四大爱情剧", "《拜月亭》、《西厢记》(王实甫著,主角为崔莺莺、红娘、张生)、《墙头马上》、《倩女离魂》"]] },
    { cat: "人文", hl: ["明清文学", "汤显祖四梦里游弋"], text: "", table: [["明", "汤显祖", "《牡丹亭》《紫钗记》《南柯记》《邯郸记》合称“临川四梦”<br>“独写菖蒲竹叶杯，蓬城芳草踏初回。情知不向瓯江死，舟楫何劳吊屈来”出自汤显祖的《午日处州禁竞渡》"], ["明", "徐光启", "明代著名科学家，《农政全书》是中国古代的一部农业百科全书"], ["明", "宋应星", "明末科学家，著《天工开物》一书，对明代农业、手工业生产技术进行了总结，被誉为“中国17世纪的工艺百科全书”"], ["明", "徐霞客", "地理学家，著《徐霞客游记》,最早揭示了中国西南地区石灰岩地貌的各种特征，徐霞客也因此成为世界上科学考察石灰岩地貌的先驱"], ["明", "李时珍", "著《本草纲目》,集十六世纪以前中国本草学之大成"], ["明", "四大奇书 “西金三水”", "《 金瓶梅》为章回体长篇小说，作者署名兰陵笑笑生，被列为明代“四大奇书”之首。《三国演义》是我国第一部长篇章回小说，罗贯中著,全名《三国志通俗演义》,是历史演义小说的经典之作，成书于明代。《水浒传》施耐庵著,作于元末明初，是中国历史上第一部用白话文写成的章回小说。《 西游记》吴承恩著,是一部规模宏伟、结构完整、用幻想形式来反映社会矛盾的巨著,作于明朝中期，西游记中的西天古称天竺，也就是现在的印度，它是佛陀故乡、佛教圣地"], ["清", "南洪北孔", "洪昇：《长生殿》<br>孔尚任：《桃花扇》"], ["清", "曹雪芹", "《红楼梦》:中国古典小说的巅峰，被誉为“中国封建社会的百科全书”"], ["清", "蒲松龄", "《聊斋志异》:古典文言短篇小说的巅峰。“写鬼写妖高人一等，刺贪刺虐入木三分”, “鬼狐有性格，笑骂成文章”"], ["清", "《四库全书》", "《四库全书》:清朝乾隆皇帝在“文字狱”的背景下亲自组织大批学者编写，为当时世界上最大的一部丛书，基本囊括了清代前期的古代所有的图书。1772年开始，经十年编成。丛书分经、史、子、集四部，故名四库。经、史、子、集四分法是古代图书分类的主要方法，它基本上囊括了古代所有图书，故称“全书”。乾隆三十八年(1773 年)二月，《四库全书》正式开始编修，以纪晓岚、陆锡熊、孙士毅为总纂官，陆费墀为总校官，下设纂修官、分校官及监造官等400余人"]] },
    { cat: "人文", hl: ["文字发展史", "甲骨文", "金文"], text: "", table: [["甲骨文", "殷商时代写在龟甲和兽骨上的占卜文字，最早出土于河南安阳(殷墟),2017年人选《世界记忆名录》"], ["金文", "商、周时期刻铸在钟、鼎及其他青铜器上的铭文，又称“钟鼎文”"], ["大篆", "春秋战国到秦时通行的字体，包括“籀文”和“石鼓文”"], ["小篆", "秦朝统一文字为小篆。著名的秦代石刻有《泰山刻石》《会稽刻石》"], ["隶书", "由小篆演变而来，产生于秦，通行于汉，为后世草书、楷书、行书的产生和演变奠定了基础，讲究蚕头燕尾"], ["草书", "直接从隶书演变而来，汉初始有草书。特点是结构简省、笔画连绵"], ["楷书", "又称正书或真书，出现于汉末，魏晋南北朝时期通行。特点是横平竖直"], ["行书", "行书是介于楷书、草书之间的一种字体，代表作：东晋王羲之《兰亭序》"]] },
    { cat: "科技", hl: ["两栖攻击舰", "四川舷号51", "075型两栖攻击舰"], text: "", table: [["075型两栖攻击舰", "海南舰(舷号31),全称中国人民解放军海军海南舰，是中国自主研制的075型两栖攻击舰首舰，可搭载30架各类直升机(直-8/直-20系列)及两栖装甲车辆，具备立体登陆作战能力。2021年4月23日，海南舰在海南三亚某军港集中交接入列。海南舰并非航空母舰"], ["075型两栖攻击舰", "广西舰(舷号32),全称中国人民解放军海军广西舰，是首艘以少数民族自治区命名的军舰，是中国建造的第二艘075型两栖攻击舰。广西舰配备了直通甲板和坞舱，可搭载直升机、两栖气垫登陆艇、两栖战车等两栖作战装备，具备立体登陆作战能力。广西舰并非航空母舰"], ["075型两栖攻击舰", "安徽舰(舷号33),全称中国人民解放军海军安徽舰，是中国第三艘075型两栖攻击舰。安徽舰配备了直通甲板和坞舱，可搭载直升机、两栖气垫登陆艇、两栖战车等两栖作战装备，具备立体登陆作战能力。2022年11月，中国人民解放军海军官宣中国人民解放军海军安徽舰入列。安徽舰并非航空母舰"], ["075型两栖攻击舰", "湖北舰(舷号34),中国人民解放军海军湖北舰，是中国第四艘075型两栖攻击舰。2023 年12月14日，中国第四艘075型两栖攻击舰在上海沪东中华造船厂顺利下水。2025年8 月1日，南海舰队官方账号发文，确认中国第四艘075型两栖攻击舰命名为“湖北舰”。湖北舰最大排水量超过4万吨，配备了直通甲板和坞舱，可搭载直升机、两栖气垫登陆艇、两栖战车等两栖作战装备，具备立体登陆作战能力"], ["076型两栖攻击舰", "四川舰(舷号51),全称中国人民解放军海军四川舰，于2024年12月27日正式下水命名，是中国自主研制建造，全球首创“两栖攻击舰+电磁弹射”技术的战舰，设置双舰岛式上层建筑和全纵通飞行甲板，可搭载固定翼飞机、直升机、两栖装备等。四川舰并非航空母舰"]] },
    { cat: "科技", hl: ["天问系列", "天问一号首发射", "天问一号"], text: "", table: [["天问一号", "2020年7月23日，天问一号在文昌航天发射场由长征五号遥四运载火箭发射升空，飞行约7个月抵达火星，并通过2至3个月的环绕飞行后着陆火星表面，开展探测任务。天问一号执行“绕、落、巡”三大任务。天问一号是我国第一颗人造火星卫星，也是我国成功着陆火星的首枚火星探测器。天问一号发射后实现了从地月系到行星系跨越。天问一号团队获得2022年度“世界航天奖”"], ["天问二号", "2025年5月29日，天问二号在西昌卫星发射中心用长征三号乙遥运载火箭成功发射升空。天问二号总的任务周期大约是10年，其中用两年半左右的时间完成对小行星2016HO3的伴飞、取样并返回地球。此后则会继续它的第二项任务：对主带彗星311P的伴飞探测。天问二号探测器的发射成功标志着中国首次小行星探测与采样返回之旅顺利迈出第一步。天问二号是继嫦娥五号月球采样后，中国首次实现小行星采样返回，将验证采样返回技术、深空导航与通信技术"]] },
    { cat: "科技", hl: ["神舟系列", "神舟十八成员", "【神十八】口诀"], text: "【神十八】口诀：聪富苏 【神十九】口诀：送菜王 【神二十】口诀：中冬王 【3舱3船组合体】口诀：船变舱不变 ①神舟二十号飞船采用的电源是镉镍电池，与神舟十八号飞船不同 ②神舟二十号任务中首次进入太空开展实验的生物是涡虫 ③陈冬是中国执行载人航天任务次数最多的航天员 ④神舟二十号发射后将会在空间站形成两舱两船组合体 ⑤神舟二十号乘组包括陈冬、陈中瑞、王杰", table: [["神舟二十号", "2025年4月24日，神舟二十号载人飞船在酒泉卫星发射中心搭载长征二号F遥二十运载火箭发射。神舟二十号载人飞船入轨后成功对接于空间站天和核心舱径向端口，整个对接过程历时约6.5小时。2025年4月24日是第十个“中国航天日”"], ["科研任务", "神舟二十号开展3项生命科学实验，研究对象分别为斑马鱼、涡虫和链霉菌，首次进入太空的是涡虫"], ["航天员", "①神舟十八号航天员是叶光富、李聪、李广苏(三人均为“80后”)。神舟十八号乘组在轨期间开展了国内首次在轨水生生态研究(斑马鱼、金鱼藻)和国际首次植物茎尖干细胞功能研究，推动空间科学实验创新。②神舟十九号航天员是蔡旭哲(“70后”)、宋令东(“90后”)、王浩泽(“90后”)。首位执行舱外活动的“90后”航天员是宋令东。③神舟二十号航天员是陈中瑞(“80后”)、陈冬(“70后”)、王杰(“80后”) 【总结】“70后”“80后”“90后”齐聚“天宫”,完成中国航天史上第6次“太空会师”, 也是两名指令长时隔3年后再次相聚“天宫”"], ["3舱3船", "①天和核心舱：中国空间站发射入轨的首个舱段，是中国研制的规模非常大、系统非常复杂的航天器。2021年4月29日11时23分，天和核心舱由长征五号B遥二运载火箭搭载发射，在文昌航天发射场点火升空。后续，天和核心舱先后迎接天舟货运飞船和神舟飞船的访问，在全面完成空间站关键技术验证后，与问天实验舱、梦天实验舱实施交会对接，完成中国空间站三舱组合体在轨组装建造。②问天实验舱：2022年7月24日，问天实验舱搭载长征五号B遥三运载火箭在文昌航天发射场发射，主要面向空间生命科学研究。2022年7月25日3时13分，问天实验舱成功对接于天和核心舱前向端口。③梦天实验舱：2022年10月31日，梦天实验舱搭乘长征五号B遥四运载火箭在文昌航天发射场发射。2022年11月1日，成功对接于天和核心舱前向端口。2022年11月3日，空间站梦天实验舱顺利完成转位，空间站“T”字基本构型在轨组装完成。梦天实验舱的定位是“工作实验”,因此并没有休息空间的存在，它的入轨对接可以支持航天员进行大规模的科学载荷实验"], ["锂离子电池", "自神舟十八号起飞船采用锂离子电池，替代镉镍电池，能量密度更高且环保，还能为整船减重约50公斤"], ["女性航天员", "刘洋是我国第一个女航天员。王浩泽是我国第一个女飞行工程师。王亚平是我国第一个太空行走的女航天员"], ["飞行工程师", "中国3位飞行工程师：朱杨柱、王浩泽、王杰朱杨柱是中国第一个飞行工程师。王浩泽是中国第一个飞行女工程师。王杰是第三批航天员中首个参与在轨轮换的飞行工程师"], ["航天员之最", "杨利伟是我国第一个航天员。翟志刚是我国第一个太空行走的航天员。桂海潮是我国第一个飞天的载荷专家"], ["钱学森最高成就奖", "2021年，吴伟仁(中国探月工程总设计师)获2020年度钱学森最高成就奖 2022年，包为民(运载火箭技术专家)获2021年度钱学森最高成就奖 2023年，周建平(中国载人航天工程总设计师)获2022年度钱学森最高成就奖 2024年，杨利伟(中国首飞航天员)获2023年度钱学森最高成就奖"]] },
    { cat: "科技", hl: ["天舟系列", "天舟货运补给", "口诀释义"], text: "口诀释义", table: [["概述", "天舟系列货运飞船负责为空间站(或空间实验室)运输补给物资和载荷、补加推进剂、在轨存储和下行废弃物资，任务结束后受控陨落于预定区域"], ["天舟八号", "2024年11月15日，搭载天舟八号货运飞船的长征七号遥九运载火箭在我国文昌航天发射场点火发射。约10分钟后，天舟八号货运飞船与火箭成功分离并进入预定轨道，之后飞船太阳能帆板顺利展开，发射取得圆满成功"], ["天舟九号", "2025年7月15日，天舟九号搭载长征七号遥十运载火箭在文昌发射升空，成功对接于空间站天和核心舱后向端口。同日，神舟二十号航天员乘组进入天舟九号开展货物转运等相关工作。天舟九号是空间站应用与发展阶段组批生产的第四艘货运飞船，承担着为神舟二十号和神舟二十一号乘组运送物资的任务，装载了航天员在轨驻留消耗品、推进剂、应用实验装置等物资，共约6.5吨，为空间站在轨运营和航天员长期驻留提供了有力保障和支撑"]] },
    { cat: "科技", hl: ["嫦娥六号", "嫦娥六号文昌起", "嫦娥五号"], text: "", table: [["嫦娥五号", "2020年11月，长征五号遥五运载火箭搭载“嫦娥五号”探测器在中国文昌航天发射场成功发射，并于2020年12月实现了中国首次月球无人采样返回，标志着中国探月工程“绕、落、回”三步走战略的全面实现，展现深空探测领域自主创新能力。“嫦娥五号”月球样品为一类新的月海玄武岩"], ["嫦娥六号", "2024年5月，“嫦娥六号”搭载长征五号遥八运载火箭在中国文昌航天发射场成功发射，开启世界首次月球背面采样返回之旅，并于2024年6月实现世界首次月球背面采样返回。2025年3月21日，中国科学家通过“嫦娥六号”采回的月球背面月壤样品研究，确定月球最古老、最大的撞击遗迹——南极—艾特肯盆地(SPA盆地)形成于42.5亿年前。该成果被国际权威期刊《自然》列为2025年度重大科学发现，属于国家重大科技专项的标志性成就"]] },
    { cat: "科技", hl: ["科技奖项", "诺奖瑞典立", "口诀释义"], text: "口诀释义", table: [["世界科技奖项", "诺贝尔奖", "①诺贝尔奖是根据瑞典化学家诺贝尔的遗嘱设立的。是以诺贝尔的部分遗产作为基金在1900年创立的。诺贝尔奖包括物理学奖、化学奖、和平奖、生理学或医学奖、文学奖、经济学奖。诺贝尔奖遵循的原则是，除了公布最终获奖者外，候选人的名单都不对外公开，并设置了50年的保密期。<br>②12月10日是诺贝尔逝世纪念日，每年这天(除因战时中断外)分别在瑞典斯德哥尔摩和挪威奥斯陆举行诺贝尔奖的授奖仪式。诺贝尔生理学或医学奖、物理学奖、化学奖、文学奖、经济学奖在瑞典首都斯德哥尔摩颁发，诺贝尔和平奖在挪威首都奥斯陆颁发。③中国籍获奖者：杨振宁(1957年，诺贝尔物理学奖，与李政道一起)、莫言(2012年，诺贝尔文学奖)、屠呦呦(2015年，诺贝尔生理学或医学奖，分离出青蒿素用于疟疾治疗)。④两次获得诺贝尔奖的有：居里夫人、莱纳斯 ·鲍林、约翰 · 巴丁、弗雷德里克 ·桑格和卡尔 · 巴里 ·夏普莱斯"], ["世界科技奖项", "其他奖项", "①菲尔兹奖——数学界 ②图灵奖——计算机界(专门奖励对计算机事业作出重要贡献的个人，被誉为“计算机界的诺贝尔奖”) ③普利策奖——新闻界(被誉为“新闻界的诺贝尔奖”) ④南丁格尔奖——护理界 ⑤劳伦斯奖——体育界 ⑥普利兹克奖——建筑界 ⑦拉斯克奖——医学界"], ["中国国家最高科学技术奖", "概况", "国家最高科学技术奖是中国五个国家科学技术奖(国家最高科学技术奖、国家自然科学奖、国家技术发明奖、国家科学技术进步奖、中华人民共和国国际科学技术合作奖)中最高等级的奖项，于 2000年设立，每年评选一次。国家最高科学技术奖由国家主席签署并颁发奖章、证书和奖金，奖金额由国务院规定(目前为800万元)"], ["中国国家最高科学技术奖", "获奖者", "①首届获奖者袁隆平(获得“共和国勋章”“杂交水稻之父”)、吴文俊(数学家)。②2023年度获奖者李德仁(地球空间信息领域)、薛其坤(凝聚态物理领域，首次实现了量子反常霍尔效应)。③其他部分获奖者王选(“当代毕昇”)、吴孟超(“中国肝胆外科之父”)。孙家栋(获得“共和国勋章”“中国北斗之父”“中国卫星之父”)。程开甲(获得“八一勋章”“两弹一星”元勋)、于敏(“共和国勋章”“中国氢弹之父”)。屠呦呦(获得“共和国勋章”,研究发现了青蒿素，获得2015年诺贝尔生理学或医学奖)。黄旭华(获得“共和国勋章”“中国核潜艇之父”)"]] },
    { cat: "科技", hl: ["科考站", "南极长城开先河", "两船七站一基地"], text: "", table: [["两船七站一基地", "两船七站一基地", "两船七站一基地"], ["两船", "雪龙号", "“雪龙”号于1993年由乌克兰赫尔松船厂建造完工，中国从乌克兰购得后经改装而成，1994 年开始执行中国的南极考察任务。2015年11月7日，中国南极科学考察队乘“雪龙”号破冰船，赴南极执行科考任务，继长城站、中山站、昆仑站和泰山站之后，中国第五座南极考察站在此次科考中确定选址"], ["两船", "雪龙2号", "“雪龙2”号极地考察船(H2560)是中国第一艘自主建造的极地科学考察破冰船，是全球第一艘采用船艏、船艉双向破冰技术的极地科考破冰船，能够在1.5米厚的冰层中连续破冰航行。2016年12月20日开工，2018年9月10日正式在上海下水。2019年7月交付并首航南极。2019年10月，中国第36次南极科学考察启程。本次考察实施两船四站考察任务，我国首艘自主建造的极地科学考察破冰船——“雪龙2”号将与“雪龙”号一起“双龙探极”,开启中国极地考察新格局"], ["一基地", "“一基地”指位于上海浦东的中国极地考察国内基地(负责极地考察后勤保障),中国所有极地科考任务(如南极站补给、北极考察)均从该基地出发，是连接国内与极地的“大本营”。同时服务“雪龙” 号和“雪龙2”号，保障双船协同运作。“一基地”是我国极地科考体系的国内后勤中枢，是支撑“双龙探极”及多站联动的战略基础设施。", "“一基地”指位于上海浦东的中国极地考察国内基地(负责极地考察后勤保障),中国所有极地科考任务(如南极站补给、北极考察)均从该基地出发，是连接国内与极地的“大本营”。同时服务“雪龙” 号和“雪龙2”号，保障双船协同运作。“一基地”是我国极地科考体系的国内后勤中枢，是支撑“双龙探极”及多站联动的战略基础设施。"], ["南极科考站", "长城站", "1985年2月，我国第一个南极科考站——长城站在南极洲乔治王岛菲尔德斯半岛南部建设完成。位于南极圈外的乔治王岛，无极昼极夜现象。地球上最后一个被发现，唯一没有人定居，被人们称为第七大陆的洲是南极洲。南极洲位于地球南端，四周被南冰洋所包围，全洲无定居居民，只有来自世界各地的科学考察人员和捕鲸队"], ["南极科考站", "中山站", "中山站建立于1989年2月26日，是中国第二个南极考察站，位于南极圈内的拉斯曼丘陵。由于其特殊的地理位置，在极夜期间，更容易观测到极光现象。极光由太阳风与地球磁场和高层大气相互作用产生，南极圈内是观赏极光的理想区域之一，所以中山站有较多机会欣赏到绚丽多彩的极光"], ["南极科考站", "昆仑站", "昆仑站是南极内陆冰盖最高点上的科学考察站。昆仑站的纬度最高，它最接近极点，是我国南极科考站中距南极点最近的科考站。昆仑站位于冰穹A地区，极度缺氧，平均气温常年在零下 30摄氏度以下，被称为“人类不可到达的生命禁区”"], ["南极科考站", "泰山站", "泰山站是继长城站、中山站、昆仑站之后中国的第四个南极科学考察站。2014年1月3日，“泰山站”完成主体封顶；2014年2月8日上午11点，中国海洋局宣布，中国南极泰山站正式建成开站。泰山站位于中山站与昆仑站之间的伊丽莎白公主地，距离中山站约520公里，海拔高度约2621米，是一座南极内陆考察的度夏站。泰山站是南极内陆考察的中转站，支撑冰盖深空探测和物资补给。"], ["南极科考站", "秦岭站", "①2024年2月7日，南极大陆的新地标——中国南极秦岭站开站，这是中国第五个南极考察站。习近平总书记强调，更好地认识极地、保护极地、利用极地，为造福人类、推动构建人类命运共同体作出新的更大的贡献。②秦岭站的主体设计为南十字星造型，设计理念源自中国航海家郑和下西洋使用的南十字星导航。③秦岭站是我国继长城站、中山站之后第三个常年考察站；是我国首个面向太平洋扇区的考察站；是新时代我国建成的第一个越冬考察站"], ["北极科考站", "黄河站", "黄河站建成于2004年7月28日，是中国首个北极科考站，北极黄河站拥有全球极地科考中规模最大的空间物理观测点，位于挪威斯匹次卑尔根群岛。该地区处于北极圈以北，是北极熊等北极动物的栖息地。在黄河站周边，有机会观察到北极熊等极地动物。黄河站研究重点是生态、冰川、海洋"], ["北极科考站", "中-冰北极站", "中冰联合北极科学考察站(简称“中冰站”)是中国与冰岛合作建立的北极科学考察站，2018 年10月，正式揭牌。中冰站位于冰岛北部城市阿克雷里附近，是中国在北极地区继黄河站之后的第二个重要科研基地，也是中国首个与其他国家联合运营的北极科考站。合作建站是我国参与北极治理、提升国际科研话语权的重要举措。中冰联合管理，研究重点是北极气候变化、大气与空间物理、冰川与海洋环境、极光观测等。"]] },
    { cat: "科技", hl: ["法的作用", "指引作用", "评价作用"], text: "指引自己，评价他人，预测你我他，教育大多数，强制一小撮法具有指引、评价、预测、教育和强制五种规范作用。", table: [["指引作用", "指引作用，是指法对本人行为起到导向、引路的作用。指引作用对象是每个人自己的行为。根据法律规范的行为模式，分为确定的指引和有选择的指引。其中，义务模式对人们行为的指引是确定的指引，而权利模式对人们行为的指引是有选择的指引，即不确定的指引"], ["评价作用", "评价作用，是指法律作为人们对他人行为的评价标准所起的作用。评价作用对象是他人的行为"], ["预测作用", "预测作用，是指人们根据法律可预先估计人们相互间将怎样行为以及行为的后果等，从而对自己的行为作出合理的安排。预测作用对象是人们的相互行为"]] },
    { cat: "法律", hl: ["国家机构", "改变与撤销：", "领导关系"], text: "领导关系：上级既可撤销也可改变下级立法监督关系：上级只能撤销不能改变下级立法", table: [["全国人大", "全国最高的权力机关、立法机关。全国人大和全国人大常委会之间的关系是领导和被领导关系。(全国人大可以改变或者撤销全国人大常务委员会不适当的决定)"], ["全国人大常委会", "全国人民代表大会的常设机关，不是一个独立的立法机关，在全国人民代表大会闭会期间行使最高国家权力。全国人大常委会与全国人大是隶属关系。全国人大常委会和地方人大常委会是监督和被监督关系。全国人大常委会和国务院之间是监督和被监督关系(全国人大常委会有权撤销国务院制定的同宪法、法律相抵触的行政法规、决定和命令)"], ["国家主席", "性质：中华人民共和国主席是我国的国家元首，包括国家主席和副主席。是我国国家机构的重要组成部分。对外代表中华人民共和国"], ["中央军委", "性质：全国武装力量的最高领导机关。军委主席没有任期限制，对全国人大及其常委会负责"], ["国务院", "性质：最高国家行政机关，中央人民政府。职权：制定行政法规，发布决定和命令等"], ["法院", "性质：审判机关。领导体制：上下级法院是监督与被监督关系"], ["检察院", "性质：法律监督机关。领导体制：上下级检察院之间是领导与被领导关系"], ["监察委员会", "性质：监察机关。领导体制：上下级监察委员会之间是领导与被领导的关系"]] },
    { cat: "法律", hl: ["国家制度", "选举制度：普遍平等与秘密", "ABD"], text: "制度：普遍平等与秘密，公民十八有权利。直选间选县为界，城乡同票一比一，差额选举有效力，快速判断出 ABD 是正确答案。因此，选择 ABD选项。", table: [["国体", "中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。我国的国体是人民民主专政"], ["政体", "政体是国家政权的组织形式，即统治阶级为实现其统治而采用的国家政权机关的组织体系和运作方式。国体决定政体，政体反映国体。我国的政体是人民代表大会制度。人民代表大会制度是我国的根本政治制度，是我国人民民主专政的政权组织形式，中华人民共和国的一切权力属于人民。人民行使国家权力的机关是全国人民代表大会和地方各级人民代表大会"], ["根本制度", "社会主义制度是中华人民共和国的根本制度"], ["政党制度", "中国的政党制度是中国共产党领导的多党合作和政治协商制度。中国人民政治协商会议是中国人民爱国统一战线的组织，是中国共产党领导的多党合作和政治协商的重要机构。共产党是执政党，民主党派是参政党，中国共产党同各民主党派合作的十六字方针是“长期共存、互相监督、肝胆相照、荣辱与共”"], ["选举制度", "(1)选举权的普遍性原则 ①凡年满18周岁的中华人民共和国公民，除依法被剥夺政治权利的人以外，不分民族、种族、性别、职业、家庭出身、宗教信仰、教育程度、财产状况和居住期限，都享有选举权和被选举权。②精神病人享有选举权，不能行使选举权的，经选举委员会确认，不列入选民名单"], ["选举制度", "(2)选举权的平等性原则 ①在一次选举中选民平等地拥有相同的投票权。②原则上每一代表所代表的选民人数相同"], ["选举制度", "(3)直接选举和间接选举并用的原则直接选举，即由选民直接选举人大代表。不设区的市、市辖区、县、自治县、乡、民族乡、镇的人民代表大会的代表，由选民直接选举。间接选举，即由下一级人民代表大会选举上一级人民代表大会代表。全国人民代表大会的代表，省、自治区、直辖市、设区的市、自治州的人民代表大会的代表，由下一级人民代表大会选举"], ["选举制度", "(4)秘密投票原则全国和地方各级人民代表大会代表的选举，一律采用无记名投票的方法"], ["选举制度", "(5)差额选举原则指候选人的人数多于应选代表的名额，给选民提供更多选择空间，促进候选人之间的竞争，避免“等额选举”可能导致的形式化"], ["选举制度", "选举程序：①直接选举：采取双过半原则在选民直接选举人民代表大会代表时，选区全体选民的过半数参加投票，选举有效。代表候选人获得参加投票的选民过半数的选票时，始得当选。②间接选举：代表候选人获得全体代表过半数的选票时，始得当选"], ["民族区域自治制度", "①民族自治地方：自治区、自治州、自治县。②自治机关：民族自治地方的自治机关是自治区、自治州、自治县的人民代表大会和人民政府。③领导担任：自治区、自治州、自治县的人民代表大会常务委员会中应当有实行区域自治的民族的公民担任主任或者副主任。自治区主席、自治州州长、自治县县长由实行区域自治的民族的公民担任"], ["特别行政区制度", "特别行政区拥有高度自治权，主要有行政管理权、立法权、独立的司法权和终审权，但是不拥有外交权和防务权"], ["基层群众自治制度", "居民委员会和村民委员会是我国的基层群众自治组织，居民委员会、村民委员会的主任、副主任和委员由居民选举"]] },
    { cat: "法律", hl: ["全国人大", "性质和地位", "职权"], text: "主席提名定总理，总理提名定兄弟(副务员部审总秘)", table: [["性质和地位", "全国人大是国家最高权力机关、立法机关"], ["职权", "修改宪法。由全国人民代表大会常务委员会或者五分之一以上的全国人民代表大会代表提议，并由全国人民代表大会以全体代表的三分之二以上的多数通过"], ["职权", "监督宪法的实施"], ["职权", "制定和修改刑事、民事、国家机构的和其他的基本法律。法律和其他议案由全国人民代表大会以全体代表的过半数通过"], ["职权", "选举中华人民共和国主席、副主席"], ["职权", "根据中华人民共和国主席的提名，决定国务院总理的人选；根据国务院总理的提名，决定国务院副总理、国务委员、各部部长、各委员会主任、审计长、秘书长的人选"], ["职权", "选举中央军事委员会主席；根据中央军事委员会主席的提名，决定中央军事委员会其他组成人员的人选"], ["职权", "选举国家监察委员会主任"], ["职权", "选举最高人民法院院长"], ["职权", "选举最高人民检察院检察长"], ["职权", "审查和批准国民经济和社会发展计划和计划执行情况的报告"], ["职权", "审查和批准国家的预算和预算执行情况的报告"], ["职权", "改变或者撤销全国人民代表大会常务委员会不适当的决定"], ["职权", "批准省、自治区和直辖市的建置"], ["职权", "决定特别行政区的设立及其制度"], ["职权", "决定战争和和平的问题"], ["职权", "应当由最高国家权力机关行使的其他职权"]] },
    { cat: "法律", hl: ["全国人大常委会", "性质和地位", "组成和任期"], text: "个提请，五个闭会期间，五个决定", table: [["性质和地位", "全国人大常委会是全国人民代表大会的常设机关，在全国人民代表大会闭会期间行使最高国家权力机关的部分职权。全国人大常委会与全国人大是隶属关系"], ["组成和任期", "(1)全国人大常委会由委员长、副委员长若干人、秘书长、委员若干人组成。他们都由每届全国人大第一次会议主席团从代表中提出人选，常委会的组成人员不得担任国家行政机关、监察机关、审判机关和检察机关的职务。自第十届全国人大起，全国人大常委会还增设了若干专职委员。(2)全国人大常委会的任期与全国人大相同，即五年。委员长、副委员长连续任职不得超过两届"], ["职权", "解释宪法，监督宪法的实施"], ["职权", "制定和修改除应当由全国人民代表大会制定的法律以外的其他法律"], ["职权", "在全国人民代表大会闭会期间，对全国人民代表大会制定的法律进行部分补充和修改，但是不得同该法律的基本原则相抵触"], ["职权", "解释法律"], ["职权", "在全国人民代表大会闭会期间，审查和批准国民经济和社会发展计划、国家预算在执行过程中所必须作的部分调整方案"], ["职权", "监督国务院、中央军事委员会、国家监察委员会、最高人民法院和最高人民检察院的工作"], ["职权", "撤销国务院制定的同宪法、法律相抵触的行政法规、决定和命令"], ["职权", "撤销省、自治区、直辖市国家权力机关制定的同宪法、法律和行政法规相抵触的地方性法规和决议"], ["职权", "在全国人民代表大会闭会期间，根据国务院总理的提名，决定部长、委员会主任、审计长、秘书长的人选"], ["职权", "在全国人民代表大会闭会期间，根据中央军事委员会主席的提名，决定中央军事委员会其他组成人员的人选"], ["职权", "根据国家监察委员会主任的提请，任免国家监察委员会副主任、委员"], ["职权", "根据最高人民法院院长的提请，任免最高人民法院副院长、审判员、审判委员会委员和军事法院院长"], ["职权", "根据最高人民检察院检察长的提请，任免最高人民检察院副检察长、检察员、检察委员会委员和军事检察院检察长，并且批准省、自治区、直辖市的人民检察院检察长的任免"], ["职权", "决定驻外全权代表的任免"], ["职权", "决定同外国缔结的条约和重要协定的批准和废除"], ["职权", "规定军人和外交人员的衔级制度和其他专门衔级制度"], ["职权", "规定和决定授予国家的勋章和荣誉称号"], ["职权", "决定特赦"], ["职权", "在全国人民代表大会闭会期间，如果遇到国家遭受武装侵犯或者必须履行国际间共同防止侵略的条约的情况，决定战争状态的宣布"], ["职权", "决定全国总动员或者局部动员"], ["职权", "决定全国或者个别省、自治区、直辖市进入紧急状态"], ["职权", "全国人民代表大会授予的其他职权"]] },
    { cat: "法律", hl: ["中华人民共和国主席", "性质和地位", "职权"], text: "权”。因此，选择 B 选项。B 、C项都正确，D 项错误。因此，选择D 选项。", table: [["性质和地位", "中华人民共和国主席是我国的国家元首，是我国国家机构的重要组成部分。对外代表中华人民共和国。国家主席并不是一个职务，而是一个国家机构。我国国家元首职权由国家主席与全国人民代表大会常务委员会共同行使"], ["职权", "(外事权)代表国家，进行国事活动"], ["职权", "(外事权)代表国家，接受外国使节"], ["职权", "(公布权)根据全国人大常委会的决定，宣布批准或废除条约和重要协定"], ["职权", "(公布权)公布法律，发布命令"], ["职权", "(公布权)发布特赦令、宣布进入紧急状态、动员令、宣布战争状态等"], ["职权", "(任免权)国务院总理、副总理、国务委员、各部部长、各委员会主任、审计长、秘书长，经全国人大或全国人大常委会正式确定人选后，由国家主席宣布其任职或免职。国家主席根据全国人大常委会的决定，派出或召回驻外大使"], ["职权", "(荣典权)根据全国人大常委会的决定，代表国家向那些对国家有重大功勋的人授予荣誉奖章和光荣称号。注：国家主席行使职权须以全国人大或全国人大常委会的决定为依据，主要采取主席令的形式"]] },
    { cat: "法律", hl: ["公民的基本权利", "人身自由权：秘宅格生肉", "平等权"], text: "", table: [["平等权", "《宪法》第三十三条第二款规定，中华人民共和国公民在法律面前一律平等。平等权体现在社会生活的各个方面，如政治权利平等、经济机会平等、社会生活中的平等对待等。公民依法享有平等权，以保障自身在社会中的公平地位和发展机会。注意：不能将平等视为平均主义，不允许任何区别对待，平等权也不意味着部分弱者可以享有法律特权"], ["政治权利和自由", "选举权和被选举权是我国公民最基本的政治权利"], ["政治权利和自由", "政治自由包括言论、出版、集会、结社、游行、示威的自由"], ["监督权和获得赔偿权", "监督权和获得赔偿权包括批评权、建议权、申诉权、控告权、检举权以及获得赔偿权"], ["宗教信仰自由", "①自主选择权：中华人民共和国公民有宗教信仰自由。②禁止强制与歧视：任何国家机关、社会团体和个人不得强制公民信仰宗教或者不信仰宗教，不得歧视信仰宗教的公民和不信仰宗教的公民。③合法宗教活动受保护：国家保护正常的宗教活动。任何人不得利用宗教进行破坏社会秩序、损害公民身体健康、妨碍国家教育制度的活动。④宗教事务独立原则：宗教团体和宗教事务不受外国势力的支配"], ["人身自由权", "①生命权。"], ["人身自由权", "②人身自由不受侵犯。A.任何公民，非经人民检察院批准或者决定或者人民法院决定，并由公安机关执行，不受逮捕。B.禁止非法拘禁和以其他方法非法剥夺或者限制公民的人身自由，禁止非法搜查公民的身体"], ["人身自由权", "③公民的住宅不受侵犯。禁止非法搜查或者非法侵入公民的住宅"], ["人身自由权", "④人格尊严不受侵犯。禁止用任何方法对公民进行侮辱、诽谤和诬告陷害"], ["人身自由权", "⑤公民的通信自由和通信秘密受法律的保护。除因国家安全或者追查刑事犯罪的需要，由公安机关或者检察机关依照法律规定的程序对通信进行检查外，任何组织或者个人不得以任何理由侵犯公民的通信自由和通信秘密。例：李某系刘某的姐姐，某日李某在家时收到快递邮来的信件，信件收件人是刘某，李某在未经刘某同意的情况下拆开阅读，李某的行为侵犯了刘某的通信秘密"], ["社会经济、文化教育方面的权利", "社会经济权利", "劳动权：公民有劳动的权利和义务，国家通过各种途径创造劳动就业条件，加强劳动保护，改善劳动条件，并在发展生产的基础上提高劳动报酬和福利待遇 (《宪法》第四十二条)<br>休息权：劳动者有休息的权利，国家发展劳动者休息和休养的设施，规定职工的工作时间和休假制度(《宪法》第四十三条)<br>获得物质帮助权：公民在年老、疾病或丧失劳动能力时，有从国家和社会获得物质帮助的权利。国家发展为公民享受这些权利所需要的社会保险、社会救济和医疗卫生事业(《宪法》第四十五条)<br>财产权：公民的合法的私有财产不受侵犯。国家依照法律规定保护公民的私有财产权和继承权。国家为了公共利益的需要，可以依照法律规定对公民的私有财产实行征收或征用并给予补偿(《宪法》第十三条)"], ["社会经济、文化教育方面的权利", "文化教育权利", "受教育权：公民有受教育的权利和义务。国家培养青年、少年、儿童在品德、智力、体质等方面全面发展(《宪法》第四十六条)<br>文化权利和自由：公民有进行科学研究、文学艺术创作和其他文化活动的自由。国家对于从事教育、科学、技术、文学、艺术和其他文化事业的公民的有益于人民的创造性工作，给以鼓励和帮助(《宪法》第四十七条)"]] },
    { cat: "法律", hl: ["宪法修正案与宪法史", "1993年", "宪法修正案"], text: "1993年：初级特色政协商，五县联产立市场 1999年：法治邓论分配多，私营统分危国上 2004年：三个代表乡里变，社保人权土地偿 2018年：党领导就是本质的特征，党领导一切写进宪法中。新时代的核心价值观，五千年的文明代代传。新宪法增加就职要宣誓，主席任期和人大要一致。国务院有了新的职权，生态文明建设更精彩 (一)前四次《宪法修正案》 (二)2018年第五次《宪法修正案》", table: [["宪法修正案", "时间", "基本政治制度", "基本经济制度", "其他"], ["宪法修正案", "1988年", "一", "①私营经济是补充，保护合法权益，国家引导、监督、管理；②土地使用权转让", "一"], ["宪法修正案", "1993年", "①正处初级阶段，中国特色，改革开放；②多党合作，政治协商", "③国营改国有；④家庭联产承包责任制；⑤实行社会主义市场经济；集体独立，民主管理", "⑥县三改五"], ["宪法修正案", "1999年", "①长期初级，沿着建设中特道路，邓小平理论；②法治国家", "③发展社会主义市场经济，按劳分配为主，多种分配并存；④统分结合；⑤个体私营重要，保护合法权益，国家引导、监督、管理", "⑥反革命改危害国家安全"], ["宪法修正案", "时间", "基本政治制度", "基本经济制度", "其他"], ["宪法修正案", "2004年", "①沿着特色，三个代表；②政治文明；③社会主义事业建设者", "④为公共利益需要，对土地征收征用并补偿；⑤非公经济，保护合法权益，国家鼓励、支持、引导、监督、管理", "⑥保护合法私有财产权，征收征用并补偿；⑦社保制度；⑧人权制度；⑨特区人大代表；⑩戒严改成紧急状态；⑪主席国事活动；⑫乡三改五；⑬增国歌"], ["2018年", "①在马列毛邓三科习近平新时代中国特色社会主义思想指引下 ②和谐美丽现代化强国/伟大复兴 ③致力复兴的爱国者 ④平等团结互助和谐民族关系 ⑤倡导社会主义核心价值观 ⑥宪法和法律委员会 ⑦和平发展/互利共赢/命运共同体 ⑧党领导是最本质的特征 ⑨增就职要宣誓", "⑩删主席副主席不超两届 ⑪设区的市可定地方性法规 ⑫增监察委员会 ⑬增人大产生监察机关 ⑭删国务院/县以上政府监察职能 ⑤增人大常委监督监察委职能 ⑯增人大选举并罢免监察委主任职能 ⑰增人大常委会任免国家监察委副主任/委员职能 ⑱增人大常委不得担任监察机关职务 ⑲社会主义“法制”变社会主义“法治” ②0国务院职权增加“生态文明建设”"]] },
    { cat: "法律", hl: ["抵押权 VS 质押权", "不得抵押的财产", "抵押权"], text: "不得抵押的财产：公鸭争土鸡", table: [["抵押权", "抵押人(即债务人或第三人)", "动产", "区分原则(抵押合同和抵押权并非同时生效)", "约定担保物权", "不转移占有", "《民法典》第四百零一条：“抵押权人在债务履行期限届满前，与抵押人约定债务人不履行到期债务时抵押财产归债权人所有的，只能依法就抵押财产优先受偿”"], ["抵押权", "抵押权人(即债权人)", "不动产", "区分原则(抵押合同和抵押权并非同时生效)", "约定担保物权", "不转移占有", "《民法典》第四百零一条：“抵押权人在债务履行期限届满前，与抵押人约定债务人不履行到期债务时抵押财产归债权人所有的，只能依法就抵押财产优先受偿”"], ["抵押权", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产", "下列财产不得抵押：(1)土地所有权；(2)宅基地、自留地、自留山等集体所有的土地使用权，但是法律规定可以抵押的除外；(3)学校、幼儿园、医疗机构等为公益目的成立的非营利法人的教育设施、医疗卫生设施和其他公益设施；(4)所有权、使用权不明或者有争议的财产；(5)依法被查封、扣押、监管的财产；(6)法律、行政法规规定不得抵押的其他财产"], ["质权", "出质人(即债务人或第三人)", "动产", "区分原则(质押合同和质权并非同时生效)", "约定担保物权", "转移占有", "《民法典》第四百二十八条：“质权人在债务履行期限届满前，与出质人约定债务人不履行到期债务时质押财产归债权人所有的，只能依法就质押财产优先受偿”"], ["质权", "质权人(即债权人)", "权利", "区分原则(质押合同和质权并非同时生效)", "约定担保物权", "转移占有", "《民法典》第四百二十八条：“质权人在债务履行期限届满前，与出质人约定债务人不履行到期债务时质押财产归债权人所有的，只能依法就质押财产优先受偿”"], ["留置权", "留置权人(即债权人)", "动产", "", "法定担保物权", "转移占有", "留置的财产必须与债权人的债权有牵连关系"], ["留置权", "债务人", "动产", "", "法定担保物权", "转移占有", "留置的财产必须与债权人的债权有牵连关系"]] },
    { cat: "法律", hl: ["诉讼时效VS 追诉时效", "三年有效期", "诉讼时效三年有效期"], text: "", table: [["诉讼时效", "三年有效期：向人民法院请求保护民事权利的诉讼时效期间为三年。法律另有规定的，依照其规定"], ["诉讼时效", "四年有两际：4年(国际货物买卖合同和国际技术转让合同)"], ["诉讼时效", "五年人寿险：根据《保险法》规定，人寿保险的受益人向保险人请求给付保险金的诉讼时效期间为五年，自其知道或者应当知道保险事故发生之日起计算"], ["诉讼时效", "二十殊可延：诉讼时效期间自权利人知道或者应当知道权利受到损害以及义务人之日起计算。法律另有规定的，依照其规定。但是自权利受到损害之日起超过二十年的，人民法院不予保护，有特殊情况的，人民法院可以根据权利人的申请决定延长"], ["刑法追诉时效", "(1)法定最高刑为不满5年有期徒刑的，追诉时效的期限为5年；(2)法定最高刑为5年以上不满10年有期徒刑的，追诉时效期限为10年；(3)法定最高刑为10年以上有期徒刑的，追诉时效的期限为15年；(4)法定最高刑为无期徒刑、死刑的，追诉时效的期限为20年；如果20年以后认为必须追诉的，报请最高人民检察院核准后，仍然可以追诉"]] },
    { cat: "法律", hl: ["民事主体 VS 犯罪主体", "十六到十八", "BC"], text: "十二到十四，两故致死或残疾十四十六未成年，八种重罪要承担，杀抢爆炸和强奸，伤重致死别小看，放火投毒加毒贩，犯了必究莫等闲闲。因此，选择 BC 选项。", table: [["项目", "“ 无人 ”", "“ 限人 ”", "“ 完人 ”"], ["民事主体", "人<8周岁无民事行为能力人实施的民事法律行为无效。由其法定代理人代理实施民事法律行为", "8周岁≤人<18周岁实施民事法律行为由其法定代理人代理或者经其法定代理人同意、追认；但是，可以独立实施纯获利益的民事法律行为或者与其年龄、智力相适应的民事法律行为", "人≥18周岁<br>16周岁≤人<18周岁(“十六到十八，自己挣钱自己花”,即已满16周岁不满18周岁的人能以自己的劳动收入养活自己的，视为完全民事行为能力人)"], ["项目", "“ 无人 ”", "“ 限人 ”", "“ 完人 ”"], ["犯罪主体", "人<12周岁不负刑事责任", "①12周岁≤人<14周岁，犯故意杀人、故意伤害罪，致人死亡或者以特别残忍手段致人重伤造成严重残疾，情节恶劣，经最高人民检察院核准追诉的，应当负刑事责任。(口诀：两故致死或残疾) ②14周岁≤人<16周岁(“两故、两抢、两火、两毒”:即只对八种行为负责——故意杀人、故意伤害致人重伤或死亡、抢劫、强奸、放火、爆炸、贩卖毒品、投放危险物质) 注：八罪指的是八种行为而非八个具体罪名，如14到16周岁的人对绑架罪不负责任，但是，如果在参与绑架的过程中有撕票行为，则应认定为故意杀人罪", "人≥16周岁"]] },
    { cat: "法律", hl: ["宣告失踪 VS 宣告死亡", "宣告死亡法律后果", "项目"], text: "宣告死亡法律后果：家破人亡妻子散，死亡撤销破镜圆，除非再婚或书面，有权请求财产返", table: [["项目", "宣告失踪", "宣告死亡"], ["申请条件不同", "自然人下落不明满2年", "①一般情况下，下落不明满4年；②因意外事件下落不明的，满2年；③因意外事件下落不明，经有关机关证明该自然人不可能生存的，申请宣告死亡不受2年时间的限制。注意：对同一自然人，有的利害关系人申请宣告死亡，有的申请宣告失踪，符合宣告死亡条件的，人民法院应当宣告死亡"], ["申请条件不同", "有利害关系人的申请", "申请人包括：①配偶；②父母、子女；③兄弟姐妹、祖父母、外祖父母、孙子女、外孙子女；④其他有民事权利义务关系的人"], ["申请条件不同", "须经法院宣告", "须经法院宣告"], ["项目", "宣告失踪", "宣告死亡"], ["法律后果不同", "财产代管制度 (为失踪人设立财产管理人，有权代理失踪人从事一定的民事活动，包括代理失踪人履行债务和受领他人的履行 )", "“妻离子散，家破人亡” 《民法典》第47条：对同一自然人，有的利害关系人申请宣告死亡，有的利害关系人申请宣告失踪，符合本法规定的宣告死亡条件的，人民法院应当宣告死亡。《民法典》第48条：被宣告死亡的人，人民法院宣告死亡的判决作出之日视为其死亡的日期；因意外事件下落不明宣告死亡的，意外事件发生之日视为其死亡的日期。《民法典》第50条：被宣告死亡的人重新出现，经本人或者利害关系人申请，人民法院应当撤销死亡宣告。《民法典》第51条：被宣告死亡的人的婚姻关系，自死亡宣告之日起消除。死亡宣告被撤销的，婚姻关系自撤销死亡宣告之日起自行恢复。但是，其配偶再婚或者向婚姻登记机关书面声明不愿意恢复的除外。《民法典》第52条：被宣告死亡的人在被宣告死亡期间，其子女被他人依法收养的，在死亡宣告被撤销后，不得以未经本人同意为由主张收养行为无效 《民法典》第53条：被撤销死亡宣告的人有权请求依照本法第六编取得其财产的民事主体返还财产；无法返还的，应当给予适当补偿"], ["注：宣告失踪不是宣告死亡的必经程序", "注：宣告失踪不是宣告死亡的必经程序", "注：宣告失踪不是宣告死亡的必经程序"]] },
    { cat: "法律", hl: ["行政诉讼 VS行政复议", "行政诉讼被告：复议维持的", "被申请人"], text: "机关是被告 【行政诉讼的被告】 《行政诉讼法》第二十六条规定：“公民、法人或者其他组织直接向人民法院提起诉讼的，作出行政行为的行政机关是被告。经复议的案件，复议机关决定维持原行政行为的，作出原行政行为的行政机关和复议机关是共同被告；复议机关改变原行政行为的，复议机关是被告。复议机关在法定期限内未作出复议决定，公民、法人或者其他组织起诉原行政行为的，作出原行政行为的行政机关是被告；起诉复议机关不作为的 ，复议机关是被告。” 【行政复议机关的确定】", table: [["被申请人", "复议机关"], ["县级以上政府部门", "本级人民政府"], ["省级以下人民政府", "上一级人民政府"], ["垂直领导机关", "上一级主管部门"], ["省部级单位", "原机关自己"], ["政府派出机关", "设立该派出机关的人民政府"], ["县级以上政府部门派出机构", "本级人民政府"], ["直辖市/设区的市政府部门派出机构", "派出机构所在地的人民政府"], ["国务院部门设立的派出机构", "国务院部门"], ["本级政府或其工作部门授权的组织", "本级人民政府"], ["国务院部门授权的组织", "国务院部门"]] },
    { cat: "法律", hl: ["行政处罚", "行政处分"], text: "", table: [["行政处罚", "(一)警告、通报批评；(二)罚款、没收违法所得、没收非法财物；(三)暂扣许可证件、降低资质等级、吊销许可证件；(四)限制开展生产经营活动、责令停产停业、责令关闭、限制从业；(五)行政拘留；(六)法律、行政法规规定的其他行政处罚", "(一)警告、通报批评；(二)罚款、没收违法所得、没收非法财物；(三)暂扣许可证件、降低资质等级、吊销许可证件；(四)限制开展生产经营活动、责令停产停业、责令关闭、限制从业；(五)行政拘留；(六)法律、行政法规规定的其他行政处罚"], ["行政处分", "警告、记过、记大过、降级、撤职、开除", "警告、记过、记大过、降级、撤职、开除"], ["刑罚", "主刑", "管制(323):管制的期限为三个月以上二年以下。数罪并罚时，最高不能超过三年<br>拘役(161):拘役的期限为一个月以上六个月以下，数罪并罚时，最高不能超过一年<br>有期徒刑(615):判决宣告以前一人犯数罪的，除判处死刑和无期徒刑的以外，应当在总和刑期以下、数刑中最高刑期以上，酌情决定执行的刑期，但是有期徒刑总和刑期不满三十五年的，最高不能超过二十年，总和刑期在三十五年以上的，最高不能超过二十五年。一般情况下，有期徒刑的期限为六个月以上十五年以下<br>无期徒刑<br>死刑：包括死刑立即执行和死刑缓期二年执行。死刑适用于罪行极其严重的犯罪分子。除由最高人民法院判决以外，都应报最高院核准，死缓的，可以由省高院判决或核准三类人不适用死刑：犯罪时不满18周岁的人；审判时怀孕的妇女；审判时已满75周岁的人，但以特别残忍手段致人死亡的除外"], ["刑罚", "附加刑", "罚金、剥夺政治权利、没收财产以及只能适用于犯罪的外国人的驱逐出境"]] },
    { cat: "法律", hl: ["行政强制执行", "行政强制措施"], text: "行政强制执行：加处滞纳不迟疑，划款拍卖解难题，排除妨碍复原状，代履行时找人替", table: [["行政强制措施", "行政机关在行政管理过程中，为制止违法行为、防止证据损毁、避免危害发生、控制危险扩大等情形，依法对公民的人身自由实施暂时性限制，或者对公民、法人或其他组织的财物实施暂时性控制的行为"], ["行政强制措施", "种类：限制公民人身自由；查封场所、设施或财物；扣押财物；冻结存款、汇款；其他行政强制措施"], ["行政强制执行", "行政机关或行政机关申请法院，对不履行行政决定的公民、法人或其他组织，依法强制履行义务的行为"], ["行政强制执行", "种类：加处罚款或滞纳金；划拨存款、汇款；拍卖或依法处理查封、扣押的场所、设施或财物；排除妨碍、恢复原状；代履行；其他强制执行方式"]] },
    { cat: "法律", hl: ["犯罪未遂VS 犯罪中止", "未遂是欲达目的而不能", "项目"], text: "", table: [["项目", "犯罪未遂", "犯罪中止"], ["含义不同", "欲达目的而不能", "能达目的而不欲"], ["项目", "犯罪未遂", "犯罪中止"], ["构成要件不同", "(1)行为人已经着手实行犯罪；(2)犯罪没有得逞；(3)犯罪未得逞是由于行为人意志以外的原因", "(1)行为人主观上具有中止犯罪的决意；(2)行为人客观上实施了中止犯罪的行为；(3)犯罪中止必须发生在犯罪过程中，而不能发生在犯罪过程之外；(4)犯罪中止必须是有效地停止了犯罪行为或者有效地避免了危害结果"]] },
    { cat: "法律", hl: ["刑罚的具体运用", "一般累犯五年内", "累犯"], text: "从重锤，缓刑假释全作废", table: [["累犯", "一般累犯：前后罪都是故意犯罪；前后罪都被判处有期徒刑以上刑罚；后罪发生的时间，必须在前罪所判处的刑罚执行完毕或者赦免以后的五年之内"], ["累犯", "特别累犯：危害国家安全犯罪、恐怖活动犯罪、黑社会性质的组织犯罪的犯罪分子，在刑罚执行完毕或者赦免以后，在任何时候再犯上述任一类罪的，都以累犯论处。对累犯的处罚：应当从重处罚。累犯不适用缓刑、假释"], ["自首", "一般自首：犯罪以后自动投案；如实交代自己所犯的全部罪行"], ["自首", "特别自首：主体必须是被采取强制措施的犯罪嫌疑人、被告人和正在服刑的罪犯；必须如实供述司法机关还未掌握的本人其他罪行"], ["立功", "一般立功：是犯罪分子到案后检举、揭发他人犯罪行为，包括共同犯罪案件中的犯罪分子揭发同案犯共同犯罪以外的其他犯罪，经查证属实；提供侦破其他案件的重要线索，经查证属实；阻止他人犯罪活动；协助司法机关抓捕其他犯罪嫌疑人(包括同案犯);具有其他有利于国家和社会的突出表现 《刑法》第六十八条：犯罪分子有揭发他人犯罪行为，查证属实的，或者提供重要线索，从而得以侦破其他案件等立功表现的，可以从轻或者减轻处罚；有重大立功表现的，可以减轻或者免除处罚"], ["立功", "重大立功：犯罪分子检举、揭发他人重大犯罪行为，经查证属实；提供侦破其他重大案件的线索，经查证属实；阻止他人重大犯罪活动；协助司法机关抓捕其他重大犯罪嫌疑人(包括同案犯);对国家和社会有其他重大贡献等表现。所称“重大犯罪”“重大案件”“重大犯罪嫌疑人”的标准，一般是指犯罪嫌疑人、被告人可能被判处无期徒刑以上刑罚或者案件在本省、自治区、直辖市或者全国范围内有较大影响的情形"], ["缓刑", "条件：①犯罪分子被判处的刑罚是拘役或者是三年以下有期徒刑。②犯罪情节较轻，有悔罪表现，没有再犯罪的危险，宣告缓刑对所居住社区没有重大不良影响。③犯罪分子不是累犯和犯罪集团的首要分子"], ["减刑", "减刑以后实际执行的刑期不能少于下列期限：(一)判处管制、拘役、有期徒刑的，不能少于原判刑期的二分之一；(二)判处无期徒刑的，不能少于十三年；(三)人民法院依照《刑法》第五十条第二款规定，限制减刑的死刑缓期执行的犯罪分子，缓期执行期满后依法减为无期徒刑的，不能少于二十五年，缓期执行期满后依法减为二十五年有期徒刑的，不能少于二十年"], ["假释", "①假释只适用于被判处有期徒刑或者无期徒刑的犯罪分子。②被判处有期徒刑的犯罪分子，执行原判刑期二分之一以上，被判处无期徒刑的犯罪分子，实际执行十三年以上，才可以适用假释。如果有特殊情况，经最高人民法院核准，可以不受上述执行刑期的限制。③假释只适用于刑罚执行期间认真遵守监规，接受教育改造，确有悔改表现，没有再犯罪危险的犯罪分子。④对累犯以及因故意杀人、强奸、抢劫、绑架、放火、爆炸、投放危险物质或者有组织的暴力性犯罪被判处十年以上有期徒刑、无期徒刑的犯罪分子，不得假释"]] },
    { cat: "法律", hl: ["治安管理处罚法", "十六到十八", "实施时间"], text: "法，恶劣都处罚，例外有一个，哺乳期妈妈", table: [["实施时间", "2025年6月27日，第十四届全国人大常委会第十六次会议表决通过新修订的《治安管理处罚法》,自2026年1月1日起施行"], ["重构“被殴打还手即互殴”的认定标准", "《治安管理处罚法》第十九条：为了免受正在进行的不法侵害而采取的制止行为，造成损害的，不属于违反治安管理行为，不受处罚；制止行为明显超过必要限度，造成较大损害的，依法给予处罚，但是应当减轻处罚；情节较轻的，不予处罚"], ["宠物伤人可直接治安处罚", "《治安管理处罚法》第八十九条：饲养动物，干扰他人正常生活的，处警告；警告后不改正的，或者放任动物恐吓他人的，处一千元以下罚款。违反有关法律、法规、规章规定，出售、饲养烈性犬等危险动物的，处警告；警告后不改正的，或者致使动物伤害他人的，处五日以下拘留或者一千元以下罚款；情节较重的，处五日以上十日以下拘留。未对动物采取安全措施，致使动物伤害他人的，处一千元以下罚款；情节较重的，处五日以上十日以下拘留。驱使动物伤害他人的，依照本法第五十一条的规定处罚"], ["14—18周岁严重违法可拘留", "《治安管理处罚法》第二十三条：违反治安管理行为人有下列情形之一，依照本法应当给予行政拘留处罚的，不执行行政拘留处罚：(一)已满十四周岁不满十六周岁的；(二)已满十六周岁不满十八周岁，初次违反治安管理的；(三)七十周岁以上的；(四)怀孕或者哺乳自己不满一周岁婴儿的。前款第一项、第二项、第三项规定的行为人违反治安管理情节严重、影响恶劣的，或者第一项、第三项规定的行为人在一年以内二次以上违反治安管理的，不受前款规定的限制"], ["新增听证程序", "《治安管理处罚法》第一百一十七条：公安机关作出吊销许可证件、处四千元以上罚款的治安管理处罚决定或者采取责令停业整顿措施前，应当告知违反治安管理行为人有权要求举行听证；违反治安管理行为人要求听证的，公安机关应当及时依法举行听证。对依照本法第二十三条第二款规定可能执行行政拘留的未成年人，公安机关应当告知未成年人和其监护人有权要求举行听证；未成年人和其监护人要求听证的，公安机关应当及时依法举行听证。对未成年人案件的听证不公开举行。前两款规定以外的案情复杂或者具有重大社会影响的案件，违反治安管理行为人要求听证，公安机关认为必要的，应当及时依法举行听证。公安机关不得因违反治安管理行为人要求听证而加重其处罚"]] },
    { cat: "法律", hl: ["公职的丧失", "项目", "辞职"], text: "", table: [["项目", "特点", "应注意问题"], ["辞职", "公务员自己提出，辞职后无特殊待遇", "想辞职而辞不了：①未满最低服务年限；②担任涉密职位或未满原职脱密期限；③重要公务尚未处理完毕且须本人继续处理；④正接受审计、纪检、刑事审查不想辞而必须辞：①引咎辞职；②责令引咎辞职"], ["辞退", "单位单方面决定，被辞退后按照失业处理", "①“笨”年度考核连续2年不称职(1年不称职仅降1级);②“傻”不胜任现职又不接受其他安排；③“变”因所在单位变动需要调整工作，本人拒绝合理安排；④“狂”不履行义务，不遵守纪律，不适合继续工作又不宜开除的；⑤“懒”连续旷工超15天或1年累计旷工超30天"], ["退休", "因客观原因丧失职位，可获退休金和其他待遇", "正常退休：达到法定年龄提前退休：①工龄满30年；②距规定退休年龄不足5年且工龄满20年；③符合规定的其他情况"]] },
    { cat: "法律", hl: ["公务员错误命令抵抗权", "-2命令有错可抵抗", "命令有错可抵抗"], text: "", table: [["命令有错可抵抗", "公务员执行公务时，认为上级的决定或命令有错误的，可以向上级提出改正或撤销该决定或者命令的意见"], ["上级坚持应执行", "上级不改变该决定或者命令，或者要求立即执行的，公务员应当执行该决定或者命令"], ["执行后果上级负", "执行的后果由上级负责，公务员不承担责任"], ["明显违法责自负", "公务员执行明显违法的决定或者命令的，应当依法承担相应的责任"]] },
    { cat: "法律", hl: ["春秋五霸与战国七雄", "春秋五霸：齐桓首霸尊周王", "战国七雄"], text: "战国七雄：东齐西秦南楚北燕，中间是赵魏韩", table: [["春秋五霸", "春秋五霸，是指春秋时期五个诸侯之长。《史记 ·索隐》中认为春秋五霸指的是：齐桓公、宋襄公、晋文公、秦穆公、楚庄王"], ["春秋五霸", "齐桓首霸尊周王", "齐桓公首倡“尊王攘夷”,尊奉周王为中原之主，抵御北方游牧民族以及南方楚蛮的大举入侵，重用管仲称霸。春秋时齐桓公争霸，屡次与诸侯会盟，其中在鲁僖公年间的四次，齐国带有军队，被称为“兵车之会”"], ["春秋五霸", "宋襄泓水仁义上", "宋襄公以“仁义”为旗，泓水之战坚守礼制。泓水之战中，楚兵强大，宋襄公讲究“仁义”,要待楚兵渡河列阵后再战，结果大败受伤，次年伤重而死，葬于襄陵。筑台望母：相传宋襄公因为思念自己的母亲而建筑了一个高台，每到自己的生日、母亲的生日和平时节假日，宋襄公都会登高遥望远方，思念自己的母亲。宋襄公筑台望母的故事在后世流传甚广，渐成佳话"], ["春秋五霸", "晋文退避智谋广", "晋文公城濮之战“退避三舍”,智取中原霸权。公元前632年，楚国和晋国的军队在作战时相遇。晋文公为了实现他许下的诺言，下令军队后退九十里，驻扎在城濮。楚军见晋军后退，以为对方害怕了，马上追击。晋军利用楚军骄傲轻敌的弱点，集中兵力，大破楚军，取得了城濮之战的胜利"], ["春秋五霸", "秦穆拓疆西戎强", "秦穆公开拓西部疆域，称霸西戎。羊皮换贤：秦穆公以五张黑羊皮从楚国赎回沦为奴隶的百里奚，拜为大夫，称 “五羖大夫”。百里奚辅佐穆公改革内政，发展农业，使秦国迅速崛起。体现了秦穆公不拘一格、重视人才的治国理念，成为重视人才的典范"]] },
    { cat: "历史", hl: ["盛世之治", "汉朝文景光武兴", "盛世"], text: "", table: [["盛世", "所在朝代"], ["汉朝文景光武兴", "西汉文景之治：汉文帝、汉景帝"], ["汉朝文景光武兴", "东汉光武中兴：汉光武帝"], ["隋朝开皇焕新程", "隋朝开皇之治：隋文帝"], ["唐朝贞观开元盛", "唐朝贞观之治：唐太宗"], ["唐朝贞观开元盛", "唐朝开元盛世：唐玄宗"], ["康乾盛世留英名", "清朝康乾盛世：清圣祖(康熙)、清世宗(雍正)、清高宗(乾隆)"], ["康乾盛世留英名", "【清朝皇帝】努尔哈赤皇顺康，雍乾嘉道咸同光。清朝一共十二帝，最后宣统很悲伤"]] },
    { cat: "历史", hl: ["古代战争", "涿鹿之战", "甘之战"], text: "口诀速背鸣条之战、牧野之战：汤在鸣条把夏桀拉下了王座，姬发胜于牧野纣了断了自我淝水之战：前秦兵将广投鞭能断江，草木的模样吓得心发慌长勺之战、城濮之战、桂陵之战、长平之战：曹刿靠什么,赶走了齐国，城濮之战退避三舍楚也打不过，围魏救赵救韩是孙膑妙计多，长平白起赢下那谈兵的赵括巨鹿之战、垓下之战：巨鹿项羽狂豪气冲万丈，入秦的刘邦约法有三章，垓下的月光四面楚歌响，别姬的霸王自刎在乌江三国战役：汉末分三国，三战三把火，许攸献策焚毁乌巢袁绍气不过，周郎趁着东风把曹船烧", table: [["涿鹿之战", "距今大约4600年前，人文初祖黄帝部落联合炎帝部落，与蚩尤在涿鹿进行了一场大战，蚩尤战败，炎黄部落取得胜利。涿鹿之战的目的是双方争夺适于放牧和浅耕的中原地带。涿鹿之战对于古代华夏族由远古时代向文明时代的转变产生了重大的影响，有力地奠定了华夏集团据有广大中原地区的基础，并起到了进一步融合各氏族部落的催化作用"], ["甘之战", "启在其父禹死后，通过武力排除各反对力量，最终登上华夏部落联盟领袖之位，甘之战是启讨伐不服他最高领袖地位的有扈氏的战争，最终获胜，启建立中国第一个王朝—夏朝。夏朝(约公元前2070—公元前1600年)是中国史书中记载的第一个世袭制朝代，在春秋战国时期之前"], ["鸣条之战", "夏朝末年(约公元前1600年),在商灭夏的战争中，商汤率领商部落士兵与夏桀的军队在鸣条 (今山西省夏县之西)进行的一场决战，商军大败夏军。这场战争成为夏王朝灭亡的转折点。战争的结果导致夏王朝灭亡，商汤建立了中国的第二个王朝—商朝"], ["牧野之战", "商纣王穷兵黩武，加剧了社会和阶级矛盾，牧野之战兵败自焚于鹿台，商朝灭亡。牧野之战发生在商朝末年(约公元前1046年),是武王伐纣的决胜战，战场地点为牧野(今河南省新乡)。牧野之战是中国历史上以少胜多、先发制人的著名战例，也是中国古代车战初期的著名战例。周武王姬发率军直捣商都朝歌，在牧野大破商军，商朝军队阵前倒戈。商亡，周武王建立周朝，都城在镐，史称西周。西周采用分封制和井田制"], ["长勺之战", "长勺之战指春秋时期(公元前684年)齐国与鲁国之间的一场战役，发生于长勺(今山东省莱芜)。长勺之战是历史上著名的以少胜多的战役。齐强鲁弱，齐国兵力远超鲁国。但鲁国在曹刿的指挥下，采用“一鼓作气，再而衰，三而竭”的策略(等齐军三次击鼓后才反击),以劣势兵力击败齐军"], ["城濮之战", "公元前632年，晋文公退避三舍，大破楚军，奠定了晋国的霸主地位。晋国为战胜敌人，造成自己强大的假象，用虎皮蒙马吓唬敌人，让敌军误以为是真老虎冲过来，吓得纷纷后退"], ["桂陵之战", "公元前354年，魏国围攻赵国都城邯郸，田忌、孙膑率军援救。孙膑引兵攻魏都大梁(今河南省开封),诱使魏将庞涓赶回应战。孙膑又在桂陵(今河南省长垣)伏袭，大败魏军，生擒庞涓。成语：围魏救赵"], ["马陵之战", "公元前342年，魏国攻打韩国，韩国向齐国求救。齐国派孙膑用“减灶计”诱敌。交战的双方分别是齐国与魏国。马陵之战是设伏歼敌的战例，孙膑利用庞涓的弱点，制造假象。引诱其就范，在战局中始终居于主动地位。成语：减灶诱敌"], ["长平之战", "长平之战是战国时期(公元前260年)秦国名将白起率军在赵国的长平一带同赵国的军队发生的战争。“纸上谈兵”这个典故出自长平之战中的赵括。长平之战是战国历史的最后转折。此战是中国古代军事史上最早、规模最大、最彻底的大型歼灭战"], ["巨鹿之战", "公元前207年，项羽在巨鹿与秦军决战，最终以少胜多，大败秦军。成语“破釜沉舟”源于巨鹿之战。“约法三章”指刘邦入关后公布的临时法规：“杀人者死，伤人及盗抵罪”"], ["垓下之战", "楚汉相争的最后阶段(公元前202年),刘邦率领的汉军与项羽的楚军在垓下(今安徽省灵璧)展开决战。汉军由刘邦、韩信、彭越等多路军队汇合，总兵力约70万；楚军总兵力约10万，且粮草匮乏、士气低落。汉军采用“十面埋伏”战术，将楚军围困，并以“四面楚歌”瓦解楚军军心。项羽率残军突围至乌江，汉军发起战略追击，最终楚军全军覆没，项羽自刎。此战是中国古代大规模追击战的经典战例，结束了秦末混战的局面，标志着西汉王朝的建立。琵琶曲《十面埋伏》运用音乐手段表现了垓下之战的激烈战况，向世人展现了一幅生动感人的古战场画面"], ["官渡之战", "官渡之战发生于东汉末年(公元200年),曹军与袁军相持于官渡，袁绍谋士许攸因受猜忌投奔曹操，献策指出袁绍军粮囤积于乌巢(今河南省封丘西),且防守薄弱。曹操突袭袁军粮仓，击败袁军主力。曹操以少胜多，大败袁绍，为其统一北方奠定了基础"], ["赤壁之战", "赤壁之战发生在东汉末年(公元208年),曹操南下与孙权、刘备联军在赤壁决战。孙刘联军使用火攻，由周瑜指挥，在长江流域赤壁一带大破曹军。以少胜多，赤壁之战奠定了三国鼎立的基础。赤壁之战是第一次在长江流域进行的大规模江河作战，也是孙、曹、刘各家都派出主力参加的唯一的战事。赤壁之战是三国时期“三大战役”中最为著名的一场。典故：火烧赤壁、草船借箭"], ["夷陵之战", "夷陵之战又称彝陵之战、猇亭之战，是刘备对东吴发动的大规模战役，是中国古代战争史上一次著名的积极防御的成功战例，也是三国“三大战役”的最后一场。刘备称帝三个月后，以替关羽报仇为由，挥兵东吴。孙权求和不成，一面向曹魏求和，避免两线作战，一面派陆逊率军应战。陆逊用以逸待劳的方法，趁蜀军懈怠、防备松懈之时发起反击。他派士兵携带茅草，趁夜突袭蜀军营地，顺风放火。最终打败蜀军。夷陵之战的惨败，是蜀汉继关羽失荆州后又一次实力大损"], ["淝水之战", "公元383年，前秦皇帝苻坚亲自率领九十万大军南下进攻东晋，号称把马鞭丢入江中就能堵塞长江截断水流。东晋仅以八万军力在谢石、谢玄指挥下，奋勇抗击前秦军。苻坚看到东晋军队阵容严整，又远望八公山，把山上的草木都当成晋军，十分恐惧。两军相遇于淝水。结果，前秦军兵败如山倒，高度紧张的前秦士兵听到风声和鹤叫声也疑心是追兵，前秦从此一蹶不振。淝水之战是以少胜多的一场著名战役。人物：谢玄，苻坚。成语：投鞭断流、风声鹤唳、草木皆兵"]] },
    { cat: "历史", hl: ["变法和改革", "李悝变法尽地力", "口诀速背X 李悝变法"], text: "口诀速背X 李悝变法：李悝变法尽地力，制定法经用平籴洋务运动：十九世纪的洋务，口号自强和求富，曾李左张是人物", table: [["管仲改革", "春秋时期，齐桓公任用管仲进行改革，主要内容有“叁其国而伍其鄙”“相地而衰征”等"], ["李悝变法", "李悝是战国初期魏国的改革家，主持了最早的系统性变法之一。他主张政治上废止世袭贵族特权，经济上推行“尽地力之教”,实行“平籴法”,率先制定 《法经》,以法律的形式肯定和保护变法"], ["商鞅变法", "战国时期，秦孝公任用商鞅进行两次变法，主要内容有废井田，开阡陌，确立土地私有制；奖励军功，按功授爵；户籍什伍制，连坐法。商鞅变法的“分户令”推动了自耕农经济的发展"], ["北魏孝文帝改革", "主要内容有整顿吏治，颁布“均田令”,迁都洛阳，学习汉族文化，与汉族人联姻，等等"], ["王安石变法", "宋神宗任用王安石进行变法，变法内容有青苗法、免役法(募役法)、农田水利法、方田均税法、保甲法等。王安石被列宁誉为“中国十一世纪的改革家”"], ["张居正改革", "明神宗万历年间，张居正改革主张整顿吏治，实行“一条鞭法”,即把各州县的田赋、徭役以及其他杂征总为一条，合并征收银两，按亩折算缴纳。张居正改革的“一条鞭法”意在整顿赋役制度"], ["洋务运动", "① 1 9 世纪 6 0 — 9 0 年代 ，洋务派掀起了一场 “ 师夷长技以自强 ” 的洋务运动 。前期以 “ 自强 ” 为旗号 ，后期打出 “ 求富 ” 的旗号 。② 代表人物 ：洋务派在中央以恭亲王奕诉为代表 ，在地方以曾国藩 、李鸿章 、左宗棠 、张之洞为代表 。【 奕诉 】 1 8 6 1 年 ，奕诉会同桂良 、文祥上奏 《 通筹夷务全局酌拟章程六条 》 , 推行以富国强兵为目标的洋务运动 。根本目的是维护清王朝的统治 。【 左宗棠 】湘军的重要领导人之一 ，参与了平定太平天国运动 。【 李鸿章 】 李鸿章创办的第一个民用企业是轮船招商局 ，李鸿章在南京设立的军工企业是金陵机器局 。③ 指导思想 ：中学为体 ，西学为用 。④ 主要内容 ：A . 创建近代海军和训练式海军 ；B . 派遣留学生出国深造 ；C . 兴办新式学堂 ( 京师同文馆是中国近代第一所新式学堂 ，以培养外语和外交人才为主要目标 ) ; D . 创办近代军事工业和民用工业 ( 曾国藩创办安庆内军械厂 ，李鸿章建江南制造总局 ，左宗棠创办福州船政局 ，张之洞创办汉阳兵工厂 ) 。⑤ 影响 ：开始了中国早期的工业化进程 ，开辟了近代教育学先河"], ["戊戌变法", "1895年，康有为、梁启超等组织“公车上书”,揭开了戊戌变法的序幕。1898年，光绪皇帝颁布《定国是诏》,宣布开始变法，持续了103天，史称戊戌变法，又称百日维新。1898年9月21日，慈禧太后发动“戊戌政变”,标志着戊戌变法失败。戊戌变法中设立的京师大学堂是中国近代第一所国立大学"], ["辛亥革命", "1905年，孙中山在东京成立中国同盟会。同盟会是中国第一个资产阶级革命政党，以“驱除鞑虏，恢复中华，创立民国，平均地权”为纲领。该纲领后来又被解释为三民主义，即民族、民权、民生，其中民权主义是三民主义的核心。1911年10月10日，武昌起义爆发，辛亥革命开始。1912年1月1日，中华民国临时政府在南京宣告成立。孙中山就任中华民国第一任临时大总统。辛亥革命传播了民主共和的理念，在中华大地上建立起亚洲第一个共和制国家，以巨大的震撼力和深刻的影响力推动了中国社会变革，为实现中华民族伟大复兴探索了道路"]] },
    { cat: "历史", hl: ["农民起义", "秦朝末期大泽乡", "陈胜吴广起义"], text: "成起义，口号均田和免粮", table: [["陈胜吴广起义", "陈胜吴广起义又称大泽乡起义，公元前209年，陈胜、吴广在大泽乡发起了我国历史上第一次大规模的农民战争，具有首创精神，“斩木为兵，揭竿为旗”。提出“王侯将相，宁有种乎”的口号。大泽乡起义是我国秦朝末期农民战争的一部分。毛泽东《贺新郎 ·读史》:“更陈王奋起挥黄钺”中的“陈王”指的是陈胜。西汉司马迁《史记 · 陈涉世家》: ①“将军身披坚执锐、伐无道、诛暴秦、复立楚国之社稷，攻宜为王。” ②“苟富贵，勿相忘”“燕雀安知鸿鹄之志哉”“天下苦秦久矣，吾闻二世少子也，不当立，当立者乃公子扶苏”"], ["绿林赤眉起义", "西汉末年王莽篡权时发生的农民起义，赤眉军后来与刘演、刘秀起义军会合，成为光武中兴的源头"], ["黄巾起义", "东汉初期的光武帝调整了统治政策，使社会出现了“光武中兴”的局面。但东汉后期，豪强地主势力发展，社会黑暗，爆发了黄巾大起义。黄巾起义是我国历史上规模最大的一次带有宗教色彩的起义。东汉末年，巨鹿人张角号召百姓起义，纷纷揭竿而起，他们头扎黄巾，高喊“苍天已死，黄天当立，岁在甲子，天下大吉”的口号，史称“黄巾起义”。这次起义给予了东汉沉重打击，促使东汉政权名存实亡"], ["瓦岗寨起义", "瓦岗寨起义又称瓦岗军起义，是隋大业七年(611年)至隋大业十四年(618年)期间发生的一场农民起义"], ["黄巢起义", "875年，唐朝爆发黄巢起义，以“天补均平”为口号。黄巢起义后，唐朝的统治已虚弱不堪，地方上的藩镇势力又有所发展"], ["红巾起义", "1351年，元朝征发15万民工修治黄河，韩山童、刘福通趁机在颍州(今安徽省阜阳) 发动起义。因消息泄露，韩山童被捕牺牲，刘福通继续领导起义军，以红巾为号，迅速攻占颍州，红巾起义正式爆发。后红巾军内部分裂，朱元璋在众多势力中胜出，1368年朱元璋攻占元大都，元朝灭亡，明朝建立。红巾起义虽未直接建立新王朝，但其推翻元朝的历史使命由朱元璋完成了。红巾起义是元末农民起义，是一次农民阶级的反封建斗争，这次农民战争规模之大、历时之久、起义阶段的全面程度是空前的"], ["李自成起义", "明朝末年，李自成农民军提出“均田免赋”的口号，1644年，攻占北京，明朝灭亡。李自成起义提出了“均田免赋”“平买平卖”等口号，在一定程度上推动了历史的进步"], ["“反清复明”运动", "反清复明，是指在清朝统治期间，民间所采取的对抗清朝政权而欲恢复明朝的行为"], ["太平天国运动", "太平天国运动是清朝咸丰元年到同治三年(1851年—1864年)期间，以金田起义为开端，由洪秀全、杨秀清、萧朝贵、冯云山、韦昌辉、石达开等组成的领导集团从广西金田村率先发起的反对清朝封建统治和外国资本主义侵略的农民起义战争，是19世纪中叶中国规模最大的一场反清运动。1864年，随着太平天国都城天京(南京)的陷落，标志着太平天国运动失败"]] },
    { cat: "历史", hl: ["不平等条约", "战争"], text: "", table: [["战争", "不平等条约", "主要内容", "影响"], ["鸦片战争 (1840—1842年)", "《南京条约》", "①割让香港岛给英国；②赔款2100万银元；③开放广州、厦门、福州、宁波、上海为通商口岸；④协定关税", "中国近代第一个不平等条约，中国开始沦为半殖民地半封建社会"], ["第二次鸦片战争 (1856—1860年)", "《天津条约》", "①外国公使进驻北京；②外国传教士可到内地传教；③外国商船和军舰可在长江各口岸航行", "使中国丧失了大片的领土和大量的主权，中国的半殖民地半封建化程度进一步加深"], ["第二次鸦片战争 (1856—1860年)", "《北京条约》", "①增开天津为通商口岸；②割让九龙司地方一区给英国", "使中国丧失了大片的领土和大量的主权，中国的半殖民地半封建化程度进一步加深"], ["甲午中日战争 (1894—1895年)", "《马关条约》", "①清政府割辽东半岛、台湾全岛及其附属各岛屿、澎湖列岛给日本；②赔偿日本军费白银2亿两；③开放沙市、重庆、苏州、杭州为通商口岸；④允许日本在中国开办工厂", "帝国主义列强对华经济侵略由商品输出转变为以资本输出为主，中国社会的半殖民地半封建化程度大大加深"], ["八国联军侵华战争 (1900—1901年)", "《辛丑条约》", "①赔款白银本息共计9.8亿多两；②北京设“使馆区”,各国驻兵保护；③设外务部，位于六部之上", "清政府沦为帝国主义列强统治中国的工具，中国完全陷入半殖民地半封建社会的深渊"]] },
    { cat: "历史", hl: ["中共党史", "一大是党创立", "会议"], text: "六大苏联瞅一瞅，八一南昌第一枪，八七老毛还靠枪。过三湾要靠党，古田那军队要增强，朱毛带队上井冈，五次围剿受重创，丢了山头长征慌，遵义会议挽救党。瓦窑一起来抗日，洛川敌后抗日忙。开七大毛确立，七届二中快胜利，进入城市离开乡，你说我党棒不棒。八大主矛搞建设，九大十大不用讲，十一三中搞开放，重心放到建设上，团结一致向前看，党的历史转折点，实事求是解思想，小平精髓记心上。", table: [["会议", "时间", "地点", "内容"], ["中共一大", "1921年 7 月", "上海浙江嘉兴", "第一个共产主义小组在上海成立；确定党的名称为“中国共产党”;规定了党的奋斗目标，宣告了中国共产党的正式成立；选举陈独秀为中央局书记"], ["中共二大", "1922年 7 月", "上海", "分析了国际形势，制定了党的最高纲领和最低纲领。最高纲领：共产主义。最低纲领：消除内乱，打倒军阀；推翻帝国主义的压迫；中华民族统一为真正的民主共和国。指出了中国革命要分两步走，在中国近代史上第一次提出了彻底的反帝反封建的民主革命纲领(消除内乱，打倒军阀，建设国内和平)。中国共产党第一个党章在中共二大上诞生"], ["中共三大", "1923年 6 月", "广州", "确定国共合作，决定全体共产党员以个人名义加入国民党，以建立各民主阶级的统一战线，同时保持共产党在组织上、政治上的独立性，为第一次国共合作打下政治基础"], ["国共第一次合作", "1924年", "广州", "会上确定了“联俄、联共、扶助农工”新三民主义。国民党一大的召开，标志着第一次国共合作的正式形成"], ["会议", "时间", "地点", "内容"], ["中共四大", "1925年 1 月", "上海", "大会着重讨论了无产阶级在民族革命运动中的地位，提出无产阶级在民主革命中的领导权问题和工农联盟问题"], ["中共五大", "1927年 4 月", "汉口", "批评了陈独秀的右倾错误，并决定党的重大方针政策。实际上没有解决任何问题"], ["南昌起义", "1927年 8月1日", "南昌", "南昌起义打响了武装反抗国民党统治的第一枪；领导者：周恩来、贺龙、叶挺、朱德、刘伯承"], ["八七会议", "1927年 8月7日", "汉口", "八七会议总结了失败教训，纠正了陈独秀右倾投降主义错误，确定了土地革命和武装反抗国民党反动派统治的总方针，并把发动农民举行秋收起义作为当前党的主要任务。毛泽东提出政权是从枪杆子中取得的。瞿秋白开始担任领导工作"], ["三湾改编", "1927年9月", "三湾", "提出党对军队绝对领导"], ["秋收起义", "1927年 9 月 9 日", "湖南", "秋收起义创立了第一个农村革命根据地——井冈山革命根据地"], ["中共六大", "1928年 6 月", "莫斯科", "明确规定了没收一切土地，确定了依靠贫雇农、联合中农的阶级路线，对富农的政策也有调整，但没有根本解决"], ["古田会议", "1929年", "福建古田", "确立了共产党对红军的绝对领导"], ["会议", "时间", "地点", "内容"], ["遵义会议", "1935年 1 月", "遵义", "结束了王明“左”倾冒险主义在党中央的统治，开始确立了以毛泽东为代表的新的中央的正确领导；是中国共产党第一次独立自主地运用马克思列宁主义原理解决中国革命问题；是中国共产党从幼年走向成熟的标志"], ["瓦窑堡会议", "1935年 12月", "陕北瓦窑堡", "批判了党内长期存在着的“左”倾关门主义，决定建立最广泛的抗日民族统一战线"], ["洛川会议", "1937年 8 月", "洛川", "制定全面抗战路线，通过了《关于目前形势与党的任务的决定》和《抗日救国十大纲领》。会议决定把党的工作重心放在战区和敌后，开辟敌后战场，建立敌后抗日根据地"], ["中共七大", "1945年 4 月", "延安", "①毛泽东作《论联合政府》的政治报告，提出我党的三大作风：理论联系实际、密切联系群众、批评与自我批评。(这是区别其他政党的标志)。②确立了毛泽东思想为党的指导思想"], ["七届二中全会", "1949年 3 月", "西柏坡", "工作重心由农村转移到城市；首次提出加强执政党建设。提出“两个务必”"], ["中共八大", "1956年", "北京", "①分析了国内形势和主要矛盾的变化，指出我国国内的主要矛盾是人民对经济文化迅速发展的需求同当前经济文化不能满足人民需要的状况之间的矛盾。②大会肯定陈云提出的“三个主体，三个补充”思想"], ["会议", "时间", "地点", "内容"], ["十一届三中全会", "1978年 12月", "北京", "邓小平：《解放思想，实事求是，团结一致向前看》,重新确立了解放思想、实事求是的原则；作出了把党的工作重点转移到社会主义现代化建设上来的战略决策；提出了改革开放的重要思想。改革开放是党和人民事业大踏步赶上时代的重要法宝。十一届三中全会是划时代的，开启了改革开放和社会主义现代化建设新时期"], ["中共十二大", "1982年 9 月", "北京", "邓小平提出走自己的道路，建设有中国特色社会主义。它标志着建设有中国特色社会主义思想的正式确立"], ["中共十三大", "1987年 10月", "北京", "系统地阐述了关于社会主义初级阶段的理论：①已经进入社会主义初级阶段；②长期处于社会主义初级阶段。党在社会主义初级阶段的基本路线：一个中心：经济建设(核心);两个基本点：四项基本原则(立国之本)、改革开放(强国之路)"], ["会议", "时间", "地点", "内容"], ["南方谈话", "1992年", "一", "①坚持党的“一个中心、两个基本点”的基本路线，一百年不动摇；②不要纠缠于姓“资”还是姓“社”的问题讨论。改革开放的判断标准主要看是否有利于发展社会主义社会的生产力，是否有利于增强社会主义国家的综合国力，是否有利于提高人民的生活水平。现在要警惕“右”,但主要是防止“左”。计划和市场不是社会主义和资本主义的本质区别；③发展才是硬道理，重申了科技是第一生产力；④坚持两手抓，两手都要硬；⑤社会主义本质理论：社会主义的本质是解放生产力，发展生产力，消灭剥削，消灭两极分化，最终达到共同富裕"], ["中共十四大", "1992年 10月", "北京", "确定我国经济体制改革的目标是建立社会主义市场经济体制"], ["中共十五大", "1997年 9 月", "北京", "①依法治国，建设社会主义法治国家，是党领导人民治理国家的基本方略，完整地提出和论述了党在社会主义初级阶段的基本纲领；②非公有制经济是我国社会主义市场经济的重要组成部分；③把邓小平理论确立为中国共产党的指导思想并载入党章"], ["中共十六大", "2002年 11月", "北京", "高举邓小平理论伟大旗帜，全面贯彻“三个代表”重要思想，继往开来，与时俱进，提出全面建设小康社会的奋斗目标"], ["会议", "时间", "地点", "内容", "内容"], ["中共十七大", "2007年", "北京", "①高举中国特色社会主义伟大旗帜，以邓小平理论和“三个代表”重要思想为指导，深入贯彻落实科学发展观，继续解放思想，坚持改革开放，推动科学发展，促进社会和谐，为夺取全面建设小康社会新胜利而奋斗；②把反腐倡廉建设作为党建重要内容与思想建设、组织建设、作风建设、制度建设并列", "①高举中国特色社会主义伟大旗帜，以邓小平理论和“三个代表”重要思想为指导，深入贯彻落实科学发展观，继续解放思想，坚持改革开放，推动科学发展，促进社会和谐，为夺取全面建设小康社会新胜利而奋斗；②把反腐倡廉建设作为党建重要内容与思想建设、组织建设、作风建设、制度建设并列"], ["中共十八大", "2012年 11月", "北京", "两个同步", "居民收入增长和经济发展同步；劳动报酬的增长和劳动生产率提高同步"], ["中共十八大", "2012年 11月", "北京", "双翻番", "国内生产总值和城乡居民人均收入比2010年翻一番"], ["中共十八大", "2012年 11月", "北京", "三个自信", "全党要坚定：道路自信、理论自信、制度自信。(文化自信)"], ["中共十八大", "2012年 11月", "北京", "三清反腐", "干部清正、政府清廉、政治清明"], ["中共十八大", "2012年 11月", "北京", "四个意识", "忧患意识、创新意识、宗旨意识、使命意识"], ["中共十八大", "2012年 11月", "北京", "四种监督", "党内监督、民主监督、法律监督和舆论监督"], ["中共十八大", "2012年 11月", "北京", "五位一体", "经济、政治、文化、社会、生态文明建设"], ["会议", "时间", "地点", "内容", "内容"], ["中共十八大", "2012年 11月", "北京", "八个坚持", "坚持人民主体地位；坚持解放和发展生产力坚持推进改革开放；坚持维护社会公平正义坚持走共同富裕道路；坚持促进社会和谐坚持和平发展；坚持党的领导"], ["中共十八大", "2012年 11月", "北京", "改革不走 “ 两条路 ”", "坚定不移高举中国特色社会主义伟大旗帜既不走封闭僵化的老路、也不走改旗易帜的邪路"], ["中共十八大", "2012年 11月", "北京", "新四化", "坚持走中国特色新型工业化、信息化、城镇化、农业现代化道路"], ["中共十八大", "2012年 11月", "北京", "强化国有经济", "经济体制改革的核心问题是处理好政府和市场的关系"], ["中共十八大", "2012年 11月", "北京", "反腐败与政治清明", "十八大报告将反腐败提高到“亡党亡国”的高度"], ["中共十八大", "2012年 11月", "北京", "生态文明与美丽中国", "十八大报告首次专章论述生态文明，首次提出“推进绿色发展、循环发展、低碳发展”和“建设美丽中国”"], ["十八届三中全会", "2013年 11月", "北京", "①主题：全面深化改革；②总目标：完善和发展中国特色社会主义制度，推进国家治理体系和治理能力现代化；③方向：社会主义市场经济；④出发点落脚点：增进人民福祉、促进社会公平正义；⑤重点：经济体制改革，核心：处理好政府和市场的关系；⑥总依据：社会主义初级阶段；⑦总任务：实现社会主义现代化和中华民族的伟大复兴；⑧十八届三中全会也是划时代的，开启了新时代全面深化改革、系统整体设计推进改革新征程，开创了我国改革开放全新局面", "①主题：全面深化改革；②总目标：完善和发展中国特色社会主义制度，推进国家治理体系和治理能力现代化；③方向：社会主义市场经济；④出发点落脚点：增进人民福祉、促进社会公平正义；⑤重点：经济体制改革，核心：处理好政府和市场的关系；⑥总依据：社会主义初级阶段；⑦总任务：实现社会主义现代化和中华民族的伟大复兴；⑧十八届三中全会也是划时代的，开启了新时代全面深化改革、系统整体设计推进改革新征程，开创了我国改革开放全新局面"], ["会议", "时间", "地点", "内容"], ["十八届四中全会", "2014年 11月", "北京", "《中共中央关于全面推进依法治国若干重大问题的决定》 总目标：建设中国特色社会主义法治体系，建设社会主义法治国家。党的领导是中国特色社会主义最本质的特征，是社会主义法治最根本的保证"], ["十八届五中全会", "2015年 11月", "北京", "“十三五”时期，经济保持中高速增长，年均经济增速为6.5%; 五个发展：实现创新发展、协调发展、绿色发展、开放发展、共享发展；二孩政策；加强党建和反腐"], ["十八届六中全会", "2016年 10月", "北京", "①十八届六中全会的一个主题、两个板块：一个主题：全面从严治党；两个板块：严肃党内政治生活、加强党内监督。②十八届六中全会将继续实施积极的财政政策和稳健的货币政策。③十八届六中全会将全面落实“去产能、去库存、去杠杆、降成本、补短板”供给侧改革五大重点任务，抑制资产泡沫，房市调控有望分化。④去产能和去杠杆的关键是深化国有企业和金融部门的基础性改革，行政和市场手段相结合去产能"], ["会议", "时间", "地点", "内容"], ["中共十九大", "2017年 10月", "北京", "主题：不忘初心，牢记使命，高举中国特色社会主义伟大旗帜，决胜全面建成小康社会，夺取新时代中国特色社会主义伟大胜利，为实现中华民族伟大复兴的中国梦不懈奋斗。主要矛盾：中国特色社会主义进入新时代，我国社会主要矛盾已经转化为人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾。基本路线：领导和团结全国各族人民，以经济建设为中心，坚持四项基本原则，坚持改革开放，自力更生，艰苦创业，为把我国建设成为富强民主文明和谐美丽的社会主义现代化强国而奋斗。两个阶段：第一个阶段，从二○二○年到二○三五年，在全面建成小康社会的基础上，再奋斗十五年，基本实现社会主义现代化。第二个阶段，从二○三五年到本世纪中叶，在基本实现现代化的基础上，再奋斗十五年，把我国建成富强民主文明和谐美丽的社会主义现代化强国。中国共产党人的初心和使命：为中国人民谋幸福，为中华民族谋复兴"], ["十九届二中全会", "2018年 1 月", "北京", "①宪法是国家的根本法，是治国安邦的总章程，是党和人民意志的集中体现。依法治国首先是依宪治国。②坚持习近平新时代中国特色社会主义思想。③坚持和加强党对一切工作的领导。中国共产党领导是中国特色社会主义最本质的特征，是中国特色社会主义制度最大的优势，必须坚持和加强党对一切工作的领导"], ["会议", "时间", "地点", "内容"], ["十九届二中全会", "2018年 1 月", "北京", "④五位一体、新发展理念和奋斗目标。经济建设、政治建设、文化建设、社会建设、生态文明建设“五位一体”总体布局，创新、协调、绿色、开放、共享的新发展理念，到2020年全面建成小康社会、到2035年基本实现社会主义现代化、到本世纪中叶建成社会主义现代化强国的奋斗目标，实现中华民族伟大复兴。⑤构建人类命运共同体"], ["十九届三中全会", "2018年 2 月", "北京", "①审议通过了《中共中央关于深化党和国家机构改革的决定》和《深化党和国家机构改革方案》。②指导思想：马克思列宁主义、毛泽东思想、邓小平理论、“三个代表” 重要思想、科学发展观、习近平新时代中国特色社会主义思想为指导。③党领导一切：不忘初心、牢记使命，全面加强党对一切工作的领导。④总基调：稳中求进。⑤总体布局：五位一体。⑥战略布局：四个全面。⑦深化党和国家机构改革的重要保障：机构编制法定化。⑧深化党和国家机构改革的首要任务：完善坚持党的全面领导的制度，加强党对各领域各方面工作领导，确保党的领导全覆盖，确保党的领导更加坚强有力"], ["会议", "时间", "地点", "内容"], ["十九届四中全会", "2019年 10月", "北京", "审议《中共中央关于坚持和完善中国特色社会主义制度、推进国家治理体系和治理能力现代化若干重大问题的决定》"], ["十九届五中全会", "2020年 10月", "北京", "2020年10月29日，中国共产党第十九届中央委员会第五次全体会议通过 《中国共产党第十九届中央委员会第五次全体会议公报》。全会提出了到二○三五年基本实现社会主义现代化远景目标，这就是：1.基本实现新型工业化、信息化、城镇化、农业现代化，建成现代化经济体系 ；2.基本实现国家治理体系和治理能力现代化，人民平等参与、平等发展权利得到充分保障；3.基本建成法治国家、法治政府、法治社会；4.建成文化强国、教育强国、人才强国、体育强国、健康中国，国民素质和社会文明程度达到新高度，国家文化软实力显著增强；广泛形成绿色生产生活方式，碳排放达峰后稳中有降，生态环境根本好转，美丽中国建设目标基本实现"], ["十九届六中全会", "2021年 11月", "北京", "通过《关于党的百年奋斗重大成就和历史经验的决议》 对比记忆：《关于建国以来党的若干历史问题的决议》1981年6月27日中国共产党十一届六中全会通过对比记忆：《关于若干历史问题的决议》"], ["会议", "时间", "地点", "内容"], ["中共二十大", "2022年 10月", "北京", "中国式现代化，是中国共产党领导的社会主义现代化，既有各国现代化的共同特征，更有基于自己国情的中国特色。中国式现代化是人口规模巨大的现代化，是全体人民共同富裕的现代化，是物质文明和精神文明相协调的现代化，是人与自然和谐共生的现代化，是走和平发展道路的现代化。从现在起，中国共产党的中心任务就是团结带领全国各族人民全面建成社会主义现代化强国、实现第二个百年奋斗目标，以中国式现代化全面推进中华民族伟大复兴"], ["二十届三中全会", "2024年 7 月", "北京", "审议通过了《中共中央关于进一步全面深化改革推进中国式现代化的决定》。进一步全面深化改革的总目标是继续完善和发展中国特色社会主义制度，推进国家治理体系和治理能力现代化。到二O三五年，全面建成高水平社会主义市场经济体制，中国特色社会主义制度更加完善，基本实现国家治理体系和治理能力现代化，基本实现社会主义现代化，为到本世纪中叶全面建成社会主义现代化强国奠定坚实基础。“七个聚焦”: ①聚焦构建高水平社会主义市场经济体制；②聚焦发展全过程人民民主；③聚焦建设社会主义文化强国；④聚焦提高人民生活品质；⑤聚焦建设美丽中国；⑥聚焦建设更高水平平安中国；⑦聚焦提高党的领导水平和长期执政能力，继续把改革推向前进。到二○二九年中华人民共和国成立八十周年时，完成本决定提出的改革任务"]] },
    { cat: "历史", hl: ["管理职能VS 政府职能", "管理职能记4条", "管理职能组织职能"], text: "", table: [["管理职能", "组织职能：政府机构和工作人员把制订的计划方案付诸实施的活动过程"], ["管理职能", "计划职能：计划职能属于决策性职能。决策是管理的核心。计划职能是对未来活动进行的预先筹划和安排，它包括确定组织的目标、制定实现目标的策略和方案以及分配资源等。计划职能是管理活动的首要职能。例：不打无准备之仗"], ["管理职能", "领导职能：管理者通过激励、指导、沟通、协调冲突等方式影响组织成员。领导职能是实现管理效率和效果的灵魂，是管理过程的核心环节"], ["管理职能", "控制职能：保证组织各部门各环节能按预定要求运作而实现组织目标"], ["政府职能", "政治职能(最核心):包括军事保卫职能、外交职能、治安职能、民主政治建设职能。例：钓鱼岛巡航护渔"], ["政府职能", "经济职能：主要是利用经济杠杆进行调节。包括宏观调控职能、提供公共物品和服务职能、市场监管职能。例：提高个人所得税专项附加扣除标准"], ["政府职能", "文化职能：包括发展科学技术、教育、文化事业和卫生体育的职能。例：某市政府加强体育公园、健身步道等基础设施建设，完善“15分钟健身圈”,构建 “处处可健身”的高品质运动空间"], ["政府职能", "社会职能：包括调节社会分配和组织社会保障职能；保护生态环境和自然资源职能；促进社会化服务体系建立职能；提高人口质量，实行计划生育职能。例：某省深入实施全民参保计划，针对新业态从业人员、农民工等重点群体特点，分类施策、精准扩面；政府积极推动医疗事业改革，健全大病救助体系，完善社会保障体系；开展老年人居家适老化改造；建设无烟示范社区；实施汽车国六排放标准"]] },
    { cat: "人文", hl: ["管理层次 VS 管理幅度", "层次与规模成正比", "项目"], text: "", table: [["项目", "管理层次"], ["组织规模", "管理层次与组织规模成正比：组织规模越大，包含的成员越多，则层次越多"], ["管理幅度", "管理层次与管理幅度成反比：在组织规模已定的条件下，主管直接控制的下属越多，管理层次越少，相反，管理幅度减小，则管理层次增加。例：管理的事务越难越多，越不规范，则要求管理幅度越小"], ["项目", "管理层次", "管理层次"], ["扁平结构", "扁平结构指通过减少行政管理层次，裁减冗余人员，从而建立一种紧凑、干练的组织结构。美国管理学家德鲁克认为，“组织不良常见的病症，也就是最严重的病症，便是管理层次太多”。扁平化管理可以较好地解决这种“病症”,即减少管理层次，形成一条最短的指挥链。①优点：能够提高管理效率，减少管理失误，降低管理费用，扩大管理幅度。扁平组织分权程度高，几乎每个成员都有一定的决定权，在分权程度比较高的组织，组织成员更加自由，分权有利于下级因地制宜贯彻上级指示，充分发挥自己的聪明才干。②缺点：由于管理幅度较宽，权力分散，不易实施严密控制，加重了对下属组织及人员进行协调", "扁平结构指通过减少行政管理层次，裁减冗余人员，从而建立一种紧凑、干练的组织结构。美国管理学家德鲁克认为，“组织不良常见的病症，也就是最严重的病症，便是管理层次太多”。扁平化管理可以较好地解决这种“病症”,即减少管理层次，形成一条最短的指挥链。①优点：能够提高管理效率，减少管理失误，降低管理费用，扩大管理幅度。扁平组织分权程度高，几乎每个成员都有一定的决定权，在分权程度比较高的组织，组织成员更加自由，分权有利于下级因地制宜贯彻上级指示，充分发挥自己的聪明才干。②缺点：由于管理幅度较宽，权力分散，不易实施严密控制，加重了对下属组织及人员进行协调"], ["扁平结构", "的负担 |"], ["锥形结构", "管理层次多，管理幅度小。①优点：管理严密、分工明确、易于协调。②缺点：管理人员多，易造成“官多兵少”;协调工作会大量增加；有可能会出现职能交叉，推诿扯皮的现象；等级森严，影响下属积极性", "管理层次多，管理幅度小。①优点：管理严密、分工明确、易于协调。②缺点：管理人员多，易造成“官多兵少”;协调工作会大量增加；有可能会出现职能交叉，推诿扯皮的现象；等级森严，影响下属积极性"]] },
    { cat: "人文", hl: ["行政监督体系", "内部监督：内部第一道防线", "外部监督"], text: "外部监督：外部监督二道线，有力有效的监管，监党立法和社会，司法检察院法院", table: [["类型", "地位", "分类和常考案例", "分类和常考案例"], ["内部行政监督", "第一道防线，最直接、最迅速", "一般监督", "①日常监督。例：行政机关上下级之间的监督<br>②职能监督。例：财政部对各部委预算工作的监督<br>③主管监督。例：上级政府的工作部门对下级政府相应的工作部门的监管，市财政局对县财政局的监督"], ["内部行政监督", "第一道防线，最直接、最迅速", "专门监督", "审计监督，即政府自我监督。例：审计署对财政资金管理的监督"], ["外部行政监督", "第二道防线最有力、最有效", "立法监督", "人大及其常委会审议政府工作报告"], ["外部行政监督", "第二道防线最有力、最有效", "监察监督", "监察委员会开展反腐败工作"], ["外部行政监督", "第二道防线最有力、最有效", "司法监督", "检察院、法院及司法行政机关等，通过行政诉讼、刑事诉讼程序监督等方式，对行政机关履职过程实施制约"], ["外部行政监督", "第二道防线最有力、最有效", "政党监督", "党的纪律检查委员会处理党员违纪"], ["外部行政监督", "第二道防线最有力、最有效", "社会监督", "①社会团体监督。例：中国福利会对国家机关的监督。②公民监督。例：公民向有关部门提出批评、建议。③社会舆论监督。例：新闻媒体曝光行政人员失职行为"]] },
    { cat: "人文", hl: ["心理效应", "蝴蝶效应：蝴蝶翅膀扇", "口诀速背首因效应"], text: "口诀速背首因效应：首因初印象，先入定交往，新官三把火，恶人先告状门槛效应：门槛步步登，得寸再进尺，小求先应下，大求顺然至棘轮效应：棘轮单向前，考察消费观，由俭入奢易，由奢入俭难蝴蝶效应：蝴蝶翅膀扇，微变引巨澜。一发动全身，小动撼大千马太效应：马太效应强弱分，富者越富穷越贫，两极分化显分明晕轮效应指基于某个方面的突出印象(如外貌、能力)来整体评价一个人或事物，忽略其他方面。“以偏概全”意为用局部或片面的看法来概括整体，与晕轮效应一致。B 项对应正确。", table: [["晕轮效应", "晕轮效应也叫光环效应，是在人际交往中，人身上表现出的某一方面特征，掩盖了其他特征，从而造成人际认知的障碍。晕轮效应的最大弊端就在于以偏概全。例：爱屋及乌；情人眼里出西施；一白遮百丑；某位私塾先生见一学生相貌丑陋，觉得他一定没什么才气，因此对他的态度十分冷淡"], ["首因效应", "首因效应是美国心理学家洛钦斯首先提出的，也叫首次效应、优先效应或第一印象效应，指交往双方形成的第一次印象对今后交往关系的影响，也是“先入为主”带来的效果。例：“新官上任三把火”“早来晚走”“恶人先告状”“先发制人”“下马威”等，都是想利用首因效应占得先机"], ["近因效应", "近因效应是指最新出现的刺激物促使印象形成的心理效果。1957年，由美国心理学家卢琴斯根据实验首次提出。实验证明，在有两个或两个以上意义不同的刺激物依次出现的场合，印象形成的决定因素是后来新出现的刺激物。例如，介绍一个人，前面先讲他的优点，接着“但是”,讲了许多缺点，那么后面的话对印象形成产生的效果就属于近因效应"], ["羊群效应", "羊群效应也称从众效应，指当个体受到群体的影响，会怀疑并改变自己的观点、判断和行为，朝着与群体大多数人一致的方向变化。就是通常人们所说的“随大流”,人云亦云"], ["刻板效应", "刻板效应也叫定型效应，人们用印刻在自己头脑中的关于某人、某一类人的固定印象，来作为判断和评价人的依据的现象"], ["破窗效应", "破窗效应指的是一个房子如果窗户破了，没有人去修补，隔不久，其他的窗户也会莫名其妙地被人打破。这里体现的是一种从众心理"], ["马蝇效应", "马蝇效应是指再懒惰的马，只要身上有马蝇叮咬，它也会精神抖擞，飞快奔跑。因此，有压力才有动力"], ["鸟笼效应", "鸟笼效应是指一个人买了一个空鸟笼放在家里，随后很有可能会因为用这只笼子而再买一只鸟。因此，人们常常会成为物品的“俘虏”"], ["鲶鱼效应", "鲶鱼效应，原是指鲶鱼在搅动小鱼生存环境的同时，也激活了小鱼的求生能力。从人才开发的角度来看，“鲶鱼效应”是企业管理者激发员工活力的有效措施，具体是指组织管理部门通过引进优秀人才以激活原有员工的活力，产生一石激起千层浪的激荡效果。例：机关单位实行的公开招考和竞争上岗，能够使人产生危机感从而更好地工作，体现了鲶鱼效应的原理"], ["木桶效应", "“木桶效应”又称“木桶原理”“短板理论”,是由美国管理学家彼得提出的经典理论，其核心思想可概括为：一只木桶能装多少水，不取决于最长的那块木板，而取决于最短的那块木板。因此，在一个团队中，我们应该把最弱的成员剔除"], ["门槛效应", "门槛效应即登门槛效应，又称得寸进尺效应，指一个人一旦接受了他人的一个微不足道的要求，为了避免认知上的不协调，或想给他人以前后一致的印象，就有可能接受更大的要求。这种现象，犹如登门坎时要一级台阶一级台阶地登，这样能更容易更顺利地登上高处。“得寸进尺”是典型的门槛效应"], ["马太效应", "马太效应是社会学家和经济学家们常用的术语，反映了两极分化的社会现象，即“富的更富，穷的更穷”"], ["刺猬效应", "“刺猬效应”是一个源于生物学观察、后被引申到人际关系与管理领域的经典理论，核心探讨的是 “距离与关系”的动态平衡。刺猬法则强调的就是人际交往中的“心理距离效应”。运用到管理实践中，就是领导者如果要搞好工作，应该与下属保持亲密关系，但这是“亲密有间” 的关系，是一种不远不近的恰当合作关系"], ["棘轮效应", "棘轮效应指人们在消费时的一种习惯。当工资收入达到某个水平后，此时的消费习惯，如爱消费高档次的衣服和食品，会稳定在某一个水平；而当工资再一次提高时，消费习惯可能会上调，但是不会随着收入的降低而减低自己的消费水平。例：由俭入奢易，由奢入俭难"], ["霍桑效应", "霍桑效应指当被观察者知道自己被关注、被观察或者被注意到而改变行为倾向的反应，经常被用来暗示被试者可能由于受到研究者的关注而改善他们的行为表现，且这种改善并非源于对自变量的操纵。霍桑效应是根据实验地点命名的，霍桑工厂实验表明，工人由于被挑选出来参与试验，感到被关注和重视，而表现出工作效率提高"], ["青蛙效应", "青蛙效应是指如果将一只青蛙放进沸水中，它会跳出来，但如果将它放进冷水中慢慢加热，青蛙会因为察觉不到危险而被煮死。青蛙效应告诉人们，企业竞争环境的改变大多是渐热式的，如果管理者与员工对环境之变化没有疼痛的感觉，最后就会像这只青蛙一样，被煮熟、淘汰了仍不知道"], ["挤出效应", "挤出效应是政府为了平衡财政预算赤字，采取发行政府债券的方式，向私人借贷资金市场筹措资金，从而使市场利率上升，私人投资和支出因而相应地下降"], ["边际效应", "边际效应指随着消费量的增加，每增加一单位商品或服务的效用递减"], ["投射效应", "投射效应是指将自己的特点归因到其他人身上的倾向。在认知和对他人形成印象时，以为他人也具备与自己相似的特性的现象，把自己的感情、意志、特性投射到他人身上并强加于人，即推己及人的认知障碍"], ["蝴蝶效应", "蝴蝶效应指一个微小的初始事件可能引发一系列连锁反应，最终导致重大变化。例：“牵一发而动全身”"], ["隧道效应", "经济学上的隧道效应是指由于市场结构和行为导致的资源配置失灵现象。在这种情况下，市场参与者因信息不对称和利益冲突等原因，无法有效配置资源，最终导致经济效率下降"]] },
    { cat: "人文", hl: ["公文要素", "左上一行是份号", "公文 18要素"], text: "", table: [["公文 18要素", "版头", "份号、密级和保密期限、紧急程度、发文机关标志、发文字号、签发人"], ["公文 18要素", "主体", "标题、主送机关、正文、附件说明、发文机关署名、成文日期、印章、附注、附件"], ["公文 18要素", "版记", "抄送机关、印发机关和印发日期"], ["公文 18要素", "页码 |"], ["份号", "公文印制份数的顺序编号。涉密公文应当标注份号。份号顶格编排在版心左上角第一行，一般使用6位3号阿拉伯数字，不足的用0补齐", "公文印制份数的顺序编号。涉密公文应当标注份号。份号顶格编排在版心左上角第一行，一般使用6位3号阿拉伯数字，不足的用0补齐"]] },
    { cat: "人文", hl: ["公文种类", "公文种类：两决两公三个通", "全，公报决议是新添"], text: "全，公报决议是新添", table: [["公文种类 15种", "决议、决定、公报、公告、通知、通报、通告、命令(令)、议案、报告、请示、批复、意见、函、纪要"], ["决议。适用于会议讨论通过的重大决策事项", "决议。适用于会议讨论通过的重大决策事项"], ["决定。适用于对重要事项作出决策和部署、奖惩有关单位和人员、变更或者撤销下级机关不适当的决定事项", "决定。适用于对重要事项作出决策和部署、奖惩有关单位和人员、变更或者撤销下级机关不适当的决定事项"], ["命令(令)。适用于公布行政法规和规章、宣布施行重大强制性措施、批准授予和晋升衔级、嘉奖有关单位和人员", "命令(令)。适用于公布行政法规和规章、宣布施行重大强制性措施、批准授予和晋升衔级、嘉奖有关单位和人员"], ["公报。适用于公布重要决定或者重大事项", "公报。适用于公布重要决定或者重大事项"], ["公告。适用于向国内外宣布重要事项或者法定事项", "公告。适用于向国内外宣布重要事项或者法定事项"]] },
  ];
  function renderHomeQuote() {
    var roll = Math.random(), q, cls = "";
    if (roll < 0.25) { q = EN_QUOTES[Math.floor(Math.random() * EN_QUOTES.length)]; cls = " en"; }
    else if (roll < 0.65) { q = CUTE_QUOTES[Math.floor(Math.random() * CUTE_QUOTES.length)]; cls = " cute"; }
    else { q = ZH_QUOTES[Math.floor(Math.random() * ZH_QUOTES.length)]; }
    var qEl = $("home-quote-text"); qEl.textContent = q.text;
    var exEl = $("home-quote-explain"); exEl.textContent = q.explain || ""; exEl.style.display = q.explain ? "" : "none";
    $("home-quote").className = "home-quote" + cls;
    applyBg($("home-quote"), Store.data.settings.homeBg);
  }
  function renderMathGrid() {
    var mg = $("math-grid"); mg.innerHTML = "";
    for (var i = 0; i < 10; i++) {
      var a = Math.floor(Math.random() * 100), b = Math.floor(Math.random() * 100), op = ["+", "-"][Math.floor(Math.random() * 2)], r;
      if (op === "+") r = a + b; else { if (a < b) { var t = a; a = b; b = t; } r = a - b; }
      var d = document.createElement("div"); d.className = "mq";
      d.innerHTML = a + " " + op + " " + b + " = <span class='ans'>" + r + "</span>";
      d.onclick = function () { this.classList.toggle("revealed"); };
      mg.appendChild(d);
    }
  }
  function renderFactList() {
    var fl = $("fact-list"); fl.innerHTML = "";
    // 成语来源条
    var idiomBar = document.createElement("div"); idiomBar.className = "fact-source-bar";
    idiomBar.innerHTML = '<span class="fsb-title">成语积累</span>';
    fl.appendChild(idiomBar);
    var idioms = IDIOMS.sort(function () { return Math.random() - 0.5; }).slice(0, 6);
    idioms.forEach(function (w) { fl.appendChild(factItem("成语", w.word, w.explain, false)); });
    // 常识/时政来源条
    var sz = KNOWLEDGE.filter(function (k) { return k.cat === "时政"; });
    var others = KNOWLEDGE.filter(function (k) { return k.cat !== "时政"; }).sort(function () { return Math.random() - 0.5; });
    var know = []; if (sz.length) know.push(sz[Math.floor(Math.random() * sz.length)]);
    know = know.concat(others.slice(0, 2));
    var szBar = document.createElement("div"); szBar.className = "fact-source-bar";
    szBar.innerHTML = '<span class="fsb-title">常识 · 时政</span>';
    fl.appendChild(szBar);
    know.forEach(function (k) {
      var key = factKey(k);
      var customHl = Store.data.customHighlights[key];
      fl.appendChild(factItem(k.cat, k.text, null, k.cat === "时政", k.hl, k.table, key, customHl));
    });
  }
  function renderHomeThumbs() {
    var ht = $("home-thumbs"); ht.innerHTML = "";
    if (Store.data.settings.showThumbs) {
      var visible = Store.data.life.homeVisible || ["weather", "memo"];
      visible.forEach(function (key) { var el = renderThumb(key); if (el) ht.appendChild(el); });
      if (!ht.children.length) { var e = document.createElement("div"); e.className = "thumb"; e.textContent = "点击生活速览标题右侧的「选择模块」添加卡片"; ht.appendChild(e); }
    }
  }
  function renderHome() {
    renderHomeQuote();
    renderMathGrid();
    renderFactList();
    renderHomeThumbs();
    applyQuickAddVisibility();
  }
  function applyQuickAddVisibility() {
    var card = $("quick-add-card");
    if (!card) return;
    var s = Store.data.settings;
    var hidden = s.quickAddHiddenBtns || [];
    /* 整个卡片显示/隐藏 */
    card.style.display = s.quickAddVisible !== false ? "" : "none";
    /* 各按钮显示/隐藏 */
    var btnMap = { "qa-memo": "memo", "qa-weight": "weight", "qa-period": "period", "qa-account": "account" };
    Object.keys(btnMap).forEach(function(id) {
      var el = $(id);
      if (el) el.style.display = hidden.indexOf(btnMap[id]) >= 0 ? "none" : "";
    });
  }
  function openQuickAddSettings() {
    var s = Store.data.settings;
    var hidden = s.quickAddHiddenBtns || [];
    var items = [
      { id: "memo", label: "\u5907\u5FD8" },
      { id: "weight", label: "\u4F53\u91CD" },
      { id: "period", label: "\u7ECF\u671F" },
      { id: "account", label: "\u8BB0\u8D26" }
    ];
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u5FEB\u901F\u8BB0\u4E00\u7B14 \u8BBE\u7F6E</h3>'
      + '<div style="margin-bottom:10px;"><label><input type="checkbox" id="qa-show-card"' + (s.quickAddVisible !== false ? " checked" : "") + '> \u663E\u793A\u201C\u5FEB\u901F\u8BB0\u4E00\u7B14\u201D\u5361\u7247</label></div>'
      + '<p class="hint" style="font-size:13px;">\u52FE\u9009\u8981\u663E\u793A\u7684\u6309\u94AE\uFF08\u53D6\u6D88\u52FE\u9009\u5219\u9690\u85CF\uFF09:</p>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    items.forEach(function(it) {
      html += '<label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#f8f6f1;border-radius:6px;cursor:pointer;"><input type="checkbox" data-qa-btn="' + it.id + '"' + (hidden.indexOf(it.id) < 0 ? " checked" : "") + '> ' + it.label + '</label>';
    });
    html += '</div><div style="text-align:right;margin-top:12px;"><button class="btn-primary" id="qa-set-ok">\u786E\u5B9A</button></div>';
    openModal(html);
    $("qa-set-ok").onclick = function () {
      s.quickAddVisible = $("qa-show-card").checked;
      var newHidden = [];
      document.querySelectorAll("[data-qa-btn]").forEach(function(cb) {
        if (!cb.checked) newHidden.push(cb.getAttribute("data-qa-btn"));
      });
      s.quickAddHiddenBtns = newHidden;
      Store.save(); closeModal(); applyQuickAddVisibility(); toast("\u5DF2\u4FDD\u5B58");
    };
  }
  /* 首页快速记一笔 */
  function openQuickMemo() {
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u5FEB\u901F\u8BB0\u5907\u5FD8</h3>'
      + '<div class="row"><label>\u6807\u9898</label><input id="qm-title" placeholder="\u5FEB\u5199\u4E00\u53E5"></div>'
      + '<div class="row"><label>\u4E18\u9500\u7EA7</label><select id="qm-pri">' + MEMO_PRIORITY.map(function(x){return '<option value="'+x.key+'">'+x.name+'</option>';}).join('') + '</select></div>'
      + '<textarea id="qm-content" placeholder="\u5185\u5BB9\uFF08\u9009\u586B\uFF09" style="width:100%;height:60px;border-radius:8px;border:1px solid #ccc;padding:6px;font-size:14px;font-family:var(--font-song);resize:none;box-sizing:border-box;"></textarea>'
      + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="qm-save">\u4FDD\u5B58</button><button class="mini-btn" id="qm-cancel">\u53D6\u6D88</button></div>';
    openModal(html);
    $("qm-cancel").onclick = closeModal;
    $("qm-save").onclick = function () {
      var title = ($("qm-title").value || "").trim();
      if (!title) { toast("\u8BF7\u586B\u5199\u6807\u9898"); return; }
      Store.data.life.memo.unshift({ id: uid(), title: title, priority: $("qm-pri").value || "ninu", date: todayStr(), content: ($("qm-content").value || "").trim(), items: [] });
      Store.save(); closeModal(); renderHome(); toast("\u5907\u5FD8\u5DF2\u8BB0");
    };
    /* 自动聚焦标题输入框 */
    setTimeout(function () { var t = $("qm-title"); if (t) t.focus(); }, 200);
  }
  function openQuickWeight() {
    var unit = Store.data.life.weightUnit || "jin";
    var ulabel = unit === "jin" ? "\u65A4" : "kg";
    var ph = unit === "jin" ? "120" : "60";
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u5FEB\u901F\u8BB0\u4F53\u91CD</h3>'
      + '<div class="row"><label>\u65E5\u671F</label><span id="qw-date-disp" class="date-disp">' + todayStr() + '</span></div>'
      + '<div class="row"><label>\u4F53\u91CD（' + ulabel + '）</label><input type="number" id="qw-v" placeholder="' + ph + '" style="width:120px;"></div>'
      + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="qw-save">\u8BB0\u5F55</button><button class="mini-btn" id="qw-cancel">\u53D6\u6D88</button></div>';
    openModal(html);
    $("qw-cancel").onclick = closeModal;
    $("qw-save").onclick = function () {
      var v = parseFloat($("qw-v").value);
      if (isNaN(v)) { toast("\u8BF7\u8F93\u5165\u4F53\u91CD"); return; }
      Store.data.life.weight.push({ id: uid(), date: todayStr(), v: v, unit: unit });
      Store.save(); closeModal(); renderHome(); renderHomeThumbs(); toast("\u4F53\u91CD\u5DF2\u8BB0\uFF1A" + v + " " + ulabel);
    };
    setTimeout(function () { var t = $("qw-v"); if (t) t.focus(); }, 200);
  }
  function openQuickPeriod() {
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u5FEB\u901F\u8BB0\u7ECF\u671F</h3>'
      + '<div class="row"><label>\u5F00\u59CB\u65E5\u671F</label><span id="qp-start-disp" class="date-disp">' + todayStr() + '</span><button class="mini-btn" id="qp-start-pick">\u9009\u62E9</button></div>'
      + '<p class="hint" style="font-size:12px;">\u4EC5\u8BB0\u5F55\u5F00\u59CB\u65E5\u5373\u53EF\uFF0C\u7ED3\u675F\u65E5\u53EF\u4EE5\u540E\u8865\u3002</p>'
      + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="qp-save">\u8BB0\u5F55</button><button class="mini-btn" id="qp-cancel">\u53D6\u6D88</button></div>';
    openModal(html);
    var startDate = todayStr();
    $("qp-cancel").onclick = closeModal;
    $("qp-start-pick").onclick = function () { openDatePicker({ mode: "single", value: startDate, onConfirm: function(d) { startDate = d; $("qp-start-disp").textContent = d; } }); };
    $("qp-save").onclick = function () {
      Store.data.life.period.records.push({ id: uid(), start: startDate, end: "" });
      Store.save(); closeModal(); renderHome(); renderHomeThumbs(); toast("\u7ECF\u671F\u5DF2\u8BB0\uFF1A" + startDate);
    };
  }
  function openQuickAccount() {
    var tags = Store.data.life.accounts.tags;
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u5FEB\u901F\u8BB0\u8D26</h3>'
      + '<div class="row"><label>\u7C7B\u578B</label><select id="qa-atype"><option value="expense">\u652F\u51FA</option><option value="income">\u6536\u5165</option></select></div>'
      + '<div class="row"><label>\u6E20\u9053</label><select id="qa-achan"><option value="online">\u7EBF\u4E0A</option><option value="offline">\u7EBF\u4E0B</option></select></div>'
      + '<div class="row"><label>\u6807\u7B7E</label><select id="qa-atag"></select><input id="qa-newtag" placeholder="\u6CA1\u6709\uFF1F\u8F93\u5165\u65B0\u6807\u7B7E" style="margin-top:6px;"></div>'
      + '<div class="row"><label>\u91D1\u989D</label><input type="number" id="qa-aamt" placeholder="0.00"></div>'
      + '<textarea id="qa-anote" placeholder="\u5907\u6CE8" style="width:100%;height:50px;border-radius:8px;border:1px solid #ccc;padding:6px;font-size:14px;font-family:var(--font-song);resize:none;box-sizing:border-box;"></textarea>'
      + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="qa-asave">\u4FDD\u5B58</button><button class="mini-btn" id="qa-acancel">\u53D6\u6D88</button></div>';
    openModal(html);
    function updateQATags() {
      var t = $("qa-atype").value, c = $("qa-achan").value;
      var opts = (tags[t] && tags[t][c]) || [];
      var sel = $("qa-atag"); sel.innerHTML = "";
      opts.forEach(function(tag) { var o = document.createElement("option"); o.value = tag; o.textContent = tag; sel.appendChild(o); });
    }
    $("qa-atype").onchange = updateQATags; $("qa-achan").onchange = updateQATags;
    updateQATags();
    $("qa-acancel").onclick = closeModal;
    $("qa-asave").onclick = function () {
      var amt = parseFloat($("qa-aamt").value);
      if (isNaN(amt) || amt <= 0) { toast("\u8BF7\u8F93\u5165\u91D1\u989D"); return; }
      var type = $("qa-atype").value, channel = $("qa-achan").value;
      var tag = $("qa-newtag").value.trim() || $("qa-atag").value;
      if (!tag) { toast("\u8BF7\u9009\u62E9\u6216\u8F93\u5165\u6807\u7B7E"); return; }
      if (!tags[type]) tags[type] = {};
      if (!tags[type][channel]) tags[type][channel] = [];
      if (tags[type][channel].indexOf(tag) < 0) tags[type][channel].push(tag);
      Store.data.life.accounts.entries.unshift({ id: uid(), date: todayStr(), type: type, channel: channel, tag: tag, amount: amt, note: $("qa-anote").value.trim() });
      Store.save(); closeModal(); renderHome(); renderHomeThumbs(); toast("\u8D26\u5355\u5DF2\u8BB0\uFF1A" + (type === "expense" ? "-" : "+") + amt);
    };
  }
  function renderThumb(key) {
    var L = Store.data.life;
    if (key === "weather") {
      var w = L.weather;
      if (!w || !w.city) return null;
      var td = document.createElement("div"); td.className = "thumb weather";
      var line = w.temp != null ? (w.temp + "℃，降水 " + (w.precip || 0) + "mm") : "未获取";
      var tmr = w.tomorrow ? ("明天 " + w.tomorrow.tempMin + "~" + w.tomorrow.tempMax + "℃，降水 " + (w.tomorrow.precip || 0) + "mm") : "";
      td.innerHTML = "<b>天气 · " + esc(w.city) + "</b><br>" + esc(line) + (tmr ? "<br><span style='opacity:.9;font-size:13px'>" + esc(tmr) + "</span>" : "");
      return td;
    }
    if (key === "memo") {
      if (!L.memo.length) return null;
      var last = L.memo[0];
      var parsedDate = parseDateFromText(last.content || last.title || "", todayStr()) || last.date;
      var dateText = parsedDate ? formatChineseDate(parsedDate) : "";
      var preview = last.title || "";
      if (!preview && last.items && last.items.length) preview = last.items[0].text;
      if (!preview) preview = last.content || "备忘";
      var md = document.createElement("div"); md.className = "thumb memo";
      md.innerHTML = "<b>备忘录 · " + esc(preview) + (dateText ? "（" + esc(dateText) + "）" : "") + "</b>" +
        (last.content ? "<br>" + esc(last.content) : "");
      return md;
    }
    if (key === "accounts") {
      var s = calcAccountStats({});
      var net = s.monthInc - s.monthExp;
      var el = document.createElement("div"); el.className = "thumb accounts";
      el.innerHTML = "<b>记账 · 本月结余</b><br>" + (net >= 0 ? "+" : "") + "¥" + net.toFixed(2);
      return el;
    }
    if (key === "travel") {
      var trips = L.travel && L.travel.trips;
      if (!trips || !trips.length) return null;
      var trip = trips[0];
      var el = document.createElement("div"); el.className = "thumb travel";
      el.innerHTML = "<b>旅行 · " + esc(trip.name || "未命名") + "</b><br>" + esc((trip.startDate || "未设出发日") + " 起，共 " + (trip.days ? trip.days.length : 0) + " 天");
      return el;
    }
    if (key === "meds") {
      if (!L.meds.length) return null;
      var next = computeNextMedTime(L.meds[0]);
      var el = document.createElement("div"); el.className = "thumb meds";
      el.innerHTML = "<b>用药 · " + esc(L.meds[0].name || "用药") + "</b><br>" + (next ? "下次提醒 " + esc(next) : "暂无提醒时间");
      return el;
    }
    if (key === "period") {
      var recs = L.period && L.period.records;
      if (!recs || !recs.length) return null;
      var last = recs.slice().sort(function (a, b) { return ymdCmp(a.start || a.date, b.start || b.date); }).pop();
      var next = predictPeriod(last.start || last.date, L.period.cycle);
      var el = document.createElement("div"); el.className = "thumb period";
      el.innerHTML = "<b>经期 · 预计下次</b><br>" + esc(next || "—");
      return el;
    }
    return null;
  }
  function computeNextMedTime(med) {
    var times = computeMedTimes(med);
    if (!times.length) return "";
    var now = new Date(), sh = now.getHours(), sm = now.getMinutes();
    for (var i = 0; i < times.length; i++) {
      var p = times[i].split(":"); var th = +p[0], tm = +p[1];
      if (th > sh || (th === sh && tm > sm)) return times[i];
    }
    return times[0] + "（明日）";
    }
  function openThumbPicker() {
    var visible = Store.data.life.homeVisible || [];
    var html = '<h3>选择要在首页显示的生活模块</h3><div class="thumb-pick-list">' +
      LIFE_FEATS.map(function (f) {
        var checked = visible.indexOf(f.key) >= 0 ? " checked" : "";
        return '<label class="thumb-pick-row"><input type="checkbox" value="' + f.key + '"' + checked + '> ' + esc(f.name) + '</label>';
      }).join("") +
      '</div><div class="form-actions"><button class="btn-secondary" id="tp-cancel">返回</button><button class="btn-primary" id="tp-save">确定</button></div>';
    openModal(html);
    $("tp-cancel").onclick = closeModal;
    $("tp-save").onclick = function () {
      var checked = [];
      var boxes = document.querySelectorAll(".thumb-pick-row input");
      for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) checked.push(boxes[i].value); }
      Store.data.life.homeVisible = checked;
      Store.save(); closeModal(); renderHome();
    };
  }
  function applyHighlight(html, hl) {
    if (!hl || !hl.length) return html;
    hl.forEach(function (kw) {
      if (!kw) return;
      var re = new RegExp(escapeRegExp(kw), "g");
      html = html.replace(re, "<mark class=\"hl-mask\" title=\"点击切换显示/隐藏\">" + esc(kw) + "</mark>");
    });
    return html;
  }
  function factItem(tag, text, explain, isSZ, hl, table, key, customHl) {
    var activeHl = (customHl && customHl.length) ? customHl : hl;
    var d = document.createElement("div"); d.className = "fact-item" + (isSZ ? " shizheng" : "");
    var html = '<span class="tag">' + esc(tag) + '</span>';
    if (key) html += '<button class="hl-edit" title="自定义高亮/遮罩词">✎</button>';
    if (table && table.length) {
      html += '<div class="fact-table-wrap"><table class="fact-table">';
      // First row is treated as the header (as extracted from docx tables)
      html += '<thead><tr>';
      table[0].forEach(function (cell) {
        html += '<th>' + applyHighlight(esc(cell || ""), activeHl) + '</th>';
      });
      html += '</tr></thead><tbody>';
      for (var ri = 1; ri < table.length; ri++) {
        var row = table[ri];
        html += '<tr>';
        row.forEach(function (cell, ci) {
          html += '<td>' + applyHighlight(esc(cell || "").replace(/&lt;br&gt;/g, '<br>'), activeHl) + '</td>';
        });
        // Pad missing cells to keep column count
        for (var ci = row.length; ci < table[0].length; ci++) html += '<td></td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    } else {
      var body = applyHighlight(esc(text || "").replace(/&lt;br&gt;/g, '<br>'), activeHl);
      html += '<span class="body">' + body;
      if (explain) html += '<span class="explain">（' + esc(explain) + '）</span>';
      html += "</span>";
    }
    d.innerHTML = html;
    d.querySelectorAll("mark.hl-mask").forEach(function (m) {
      m.onclick = function (e) { e.stopPropagation(); this.classList.toggle("masked"); };
    });
    if (key) {
      d.querySelector(".hl-edit").onclick = function (e) {
        e.stopPropagation();
        openCustomHlModal(key, activeHl || [], function (newHl) {
          if (newHl && newHl.length) Store.data.customHighlights[key] = newHl;
          else delete Store.data.customHighlights[key];
          Store.save(); renderHome();
        });
      };
    }
    return d;
  }

  /* ============ 学习 ============ */
  function curModule() { var c = Store.data.study.categories[state.cat]; return c ? c.modules[state.mod] : null; }
  /* 返回当前阶段对象 {key, name, color} */
  function curPhase() {
    var m = curModule();
    if (!m || !m.phases || m.phases.length === 0) return null;
    /* state.phase 存的是阶段 key，如 "p1" "p2" */
    var found = m.phases.filter(function (p) { return p.key === state.phase; })[0];
    if (!found) { state.phase = m.phases[0].key; found = m.phases[0]; }
    return found;
  }
  /* 返回当前阶段的记录数组 */
  function curPhaseRecords() {
    var m = curModule();
    if (!m || !m.records) return [];
    ensurePhases(m);
    return m.records[state.phase] || [];
  }
  /* 迁移旧数据格式（basic/improve → phases/records），并确保每阶段有字段定义 */
  function ensurePhases(m) {
    if (m.phases && m.records) {
      /* 确保每个阶段都有 fields 定义（新版） */
      m.phases.forEach(function (p) {
        if (!p.fields || !p.fields.length) {
          p.fields = getDefaultPhaseFields(m, p);
        }
      });
      return;
    }
    var hasImprove = Array.isArray(m.improve);
    var pn1 = (m.phaseNames && m.phaseNames.basic) || "\u57FA\u7840\u5B66\u4E60";
    var pn2 = (m.phaseNames && m.phaseNames.improve) || "\u63D0\u5347\u9636\u6BB5";
    var phase1 = { key: "p1", name: pn1, color: m.basicColor || m.barColor || "#a9c4b5", fields: [
      { key: "date", type: "date", label: "\u65E5\u671F" },
      { key: "subject", type: "text", label: "\u8BFE\u7A0B\u79D1\u76EE" },
      { key: "no", type: "number", label: "\u8BFE\u7A0B\u5E8F\u53F7" },
      { key: "progress", type: "status", label: "\u8FDB\u5EA6", options: ["\u672A\u5B8C\u6210", "\u5DF2\u5B8C\u6210"] },
      { key: "note", type: "note", label: "\u7B14\u8BB0" }
    ] };
    var phases = [phase1];
    var records = { p1: Array.isArray(m.basic) ? migrateOldBasicRecords(m.basic, m) : [] };
    if (hasImprove) {
      var phase2 = { key: "p2", name: pn2, color: m.improveColor || m.barColor || "#bcd3cb", fields: [
        { key: "date", type: "date", label: "\u65E5\u671F" },
        { key: "bookName", type: "text", label: "\u9898\u518C\u540D\u79F0" },
        { key: "chapterNo", type: "number", label: "\u8BD5\u5377\u7AE0\u8282\u5E8F\u53F7" },
        { key: "pageNo", type: "text", label: "\u9875\u7801", memo: false },
        { key: "status", type: "status", label: "\u72B6\u6001", options: ["\u672A\u5B8C\u6210", "\u5DF2\u5B8C\u6210"] },
        { key: "note", type: "note", label: "\u7B14\u8BB0" }
      ] };
      phases.push(phase2);
      records.p2 = migrateOldImproveRecords(m.improve, m);
    }
    m.phases = phases;
    m.records = records;
    /* 默认选中第一个阶段 */
    if (!state.phase || !records.hasOwnProperty(state.phase)) state.phase = phases[0].key;
  }
  /* 旧版基础阶段记录迁移：subject/no/progress/note → 新字段 */
  function migrateOldBasicRecords(arr, m) {
    if (!arr) return [];
    return arr.map(function (it) {
      return { id: it.id || uid(), date: it.date || todayStr(), subject: it.subject || "", no: it.no || "", progress: it.progress || "todo", note: it.note || "" };
    });
  }
  /* 旧版提升阶段记录迁移：bookName/chapterNo/pageNo/photos/note → 新字段 */
  function migrateOldImproveRecords(arr, m) {
    if (!arr) return [];
    return arr.map(function (it) {
      return { id: it.id || uid(), date: it.date || todayStr(), bookName: it.bookName || "", chapterNo: it.chapterNo || "", pageNo: it.pageNo || "", status: "todo", note: it.note || "", photos: it.photos || [] };
    });
  }
  /* 获取阶段的默认字段（用于还没有fields的旧阶段） */
  function getDefaultPhaseFields(m, p) {
    var idx = m.phases.indexOf(p);
    var fl = m.fieldLabels || {};
    if (idx === 0) {
      return [
        { key: "date", type: "date", label: fl.date || "\u65E5\u671F" },
        { key: "subject", type: "text", label: fl.basicSubject || "\u8BFE\u7A0B\u79D1\u76EE" },
        { key: "no", type: "number", label: fl.basicNo || "\u8BFE\u7A0B\u5E8F\u53F7" },
        { key: "progress", type: "status", label: "\u8FDB\u5EA6", options: [fl.basicProgressTodo || "\u672A\u5B8C\u6210", fl.basicProgressDone || "\u5DF2\u5B8C\u6210"] },
        { key: "note", type: "note", label: fl.note || "\u7B14\u8BB0" }
      ];
    }
    return [
      { key: "date", type: "date", label: fl.date || "\u65E5\u671F" },
      { key: "bookName", type: "text", label: fl.improveSubject || "\u9898\u518C\u540D\u79F0" },
      { key: "chapterNo", type: "number", label: fl.improveChapter || "\u8BD5\u5377\u7AE0\u8282\u5E8F\u53F7" },
      { key: "pageNo", type: "text", label: fl.improvePage || "\u9875\u7801", memo: false },
      { key: "status", type: "status", label: "\u72B6\u6001", options: ["\u672A\u5B8C\u6210", "\u5DF2\u5B8C\u6210"] },
      { key: "note", type: "note", label: fl.note || "\u7B14\u8BB0" }
    ];
  }
  function renderStudyNav() {
    var box = $("study-cats"); box.innerHTML = "";
    Store.data.study.categories.forEach(function (cat, ci) {
      /* 项目标题行：名称 + 编辑/删除 */
      var h = document.createElement("div"); h.className = "nav-cat";
      h.innerHTML = '<span class="nav-cat-name">' + esc(cat.name) + '</span>'
        + '<span class="nav-cat-actions"><button class="mini-btn nav-act" data-editcat="' + ci + '" title="\u7F16\u8F91\u540D\u79F0">✎</button><button class="mini-btn nav-act danger" data-delcat="' + ci + '" title="\u5220\u9664\u9879\u76EE">×</button></span>';
      box.appendChild(h);
      /* 项目编辑/删除绑定 */
      h.querySelector("[data-editcat]").onclick = function (e) { e.stopPropagation(); editCategory(ci); };
      h.querySelector("[data-delcat]").onclick = function (e) { e.stopPropagation(); deleteCategory(ci); };
      cat.modules.forEach(function (m, mi) {
        var b = document.createElement("button");
        b.className = "nav-mod" + (ci === state.cat && mi === state.mod ? " active" : "");
        b.setAttribute("draggable", "true");
        b.innerHTML = '<span class="dot" style="background:' + esc(m.barColor) + '"></span>' + esc(m.name)
          + '<span class="updown"><a data-move="up" data-mi="' + mi + '">▲</a> <a data-move="down" data-mi="' + mi + '">▼</a></span>'
          + '<button class="mini-btn nav-mod-del" data-delmod="' + ci + '-' + mi + '" title="\u5220\u9664\u6A21\u5757">×</button>';
        b.onclick = function (e) {
          if (e.target.getAttribute("data-move") || e.target.classList.contains("nav-mod-del")) return;
          state.cat = ci; state.mod = mi; renderStudyNav(); renderStudyMain();
        };
        b.querySelector('[data-move="up"]').onclick = function (e) { e.stopPropagation(); moveModule(ci, mi, -1); };
        b.querySelector('[data-move="down"]').onclick = function (e) { e.stopPropagation(); moveModule(ci, mi, 1); };
        /* 模块删除 */
        var delBtn = b.querySelector("[data-delmod]");
        if (delBtn) delBtn.onclick = function (e) { e.stopPropagation(); deleteModule(ci, mi); };
        /* 模块双击编辑名称（保留） */
        b.ondblclick = function (e) { if (e.target.getAttribute("data-move") || e.target.classList.contains("nav-mod-del")) return; editModuleName(ci, mi); };
        bindDrag(b, cat.modules, mi, function () { state.mod = mi; renderStudyNav(); renderStudyMain(); });
        box.appendChild(b);
      });
      /* 该项目下添加模块按钮 */
      var addModBtn = document.createElement("button");
      addModBtn.className = "mini-btn nav-addmod";
      addModBtn.textContent = "+ \u6A21\u5757";
      addModBtn.onclick = function () { addModuleToCategory(ci); };
      box.appendChild(addModBtn);
    });
    applyStudyColor();
  }
  /* ======== 项目CRUD ======== */
  function editCategory(ci) {
    var cat = Store.data.study.categories[ci];
    var name = prompt("\u4FEE\u6539\u9879\u76EE\u540D\u79F0:", cat.name);
    if (!name || !(name = name.trim())) return;
    cat.name = name; Store.save(); renderStudyNav(); toast("\u5DF2\u4FEE\u6539");
  }
  function deleteCategory(ci) {
    var cat = Store.data.study.categories[ci];
    if (!confirm("\u786E\u5B9A\u5220\u9664\u9879\u76EE\u300C" + cat.name + "\u300D\uFF1F\n\u8BE5\u9879\u76EE\u4E0B\u6240\u6709\u6A21\u5757\u548C\u8BB0\u5F55\u90FD\u5C06\u88AB\u5220\u9664\uFF01")) return;
    Store.data.study.categories.splice(ci, 1);
    if (state.cat >= Store.data.study.categories.length) state.cat = Math.max(0, Store.data.study.categories.length - 1);
    state.mod = 0; var _nm = curModule(); state.phase = (_nm && _nm.phases && _nm.phases[0]) ? _nm.phases[0].key : "p1";
    Store.save(); renderStudyNav(); renderStudyMain(); toast("\u5DF2\u5220\u9664");
  }
  /* ======== 模块CRUD ======== */
  function addModuleToCategory(ci) {
    var pal = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8", "#c4bda9", "#cfbcd3"];
    var cat = Store.data.study.categories[ci];
    var existingCount = cat.modules.length;
    var n = prompt("\u8F93\u5165\u65B0\u6A21\u5757\u540D\u79F0:");
    if (!n || !(n = n.trim())) return;
    /* 继承同项目第一个模块的阶段配置（如果有） */
    var refPhases = null;
    if (cat.modules.length > 0 && cat.modules[0].phases) {
      var refMod = cat.modules[0];
      ensurePhases(refMod);
      refPhases = refMod.phases.map(function (p) { return { key: "p" + (existingCount + 1) + "_" + p.key, name: p.name, color: pal[existingCount % pal.length], fields: p.fields ? clone(p.fields) : null }; });
    }
    if (!refPhases) refPhases = [{ key: "p1", name: "\u57FA\u7840\u5B66\u4E60", color: pal[existingCount % pal.length], fields: [
      { key: "date", type: "date", label: "\u65E5\u671F" },
      { key: "itemName", type: "text", label: "\u540D\u79F0" },
      { key: "note", type: "note", label: "\u7B14\u8BB0" }
    ] }];
    var records = {};
    refPhases.forEach(function (p) { records[p.key] = []; });
    var m = {
      name: n,
      barColor: refPhases[0].color,
      phases: refPhases,
      records: records,
      fieldLabels: null
    };
    cat.modules.push(m);
    state.cat = ci; state.mod = cat.modules.length - 1; state.phase = refPhases[0].key;
    Store.save(); renderStudyNav(); renderStudyMain(); toast("\u5DF2\u6DFB\u52A0\u6A21\u5757\u300C" + n + "\u300D");
  }
  function editModuleName(ci, mi) {
    var m = Store.data.study.categories[ci].modules[mi];
    var n = prompt("\u4FEE\u6539\u6A21\u5757\u540D\u79F0:", m.name);
    if (!n || !(n = n.trim())) return;
    m.name = n; Store.save(); renderStudyNav();
    $("module-name").textContent = n; toast("\u5DF2\u4FEE\u6539");
  }
  function deleteModule(ci, mi) {
    var m = Store.data.study.categories[ci].modules[mi];
    if (!confirm("\u786E\u5B9A\u5220\u9664\u6A21\u5757\u300C" + m.name + "\u300D\uFF1F\n\u8BE5\u6A21\u5757\u4E0B\u6240\u6709\u8BB0\u5F55\u90FD\u5C06\u88AB\u5220\u9664\uFF01")) return;
    Store.data.study.categories[ci].modules.splice(mi, 1);
    if (Store.data.study.categories[ci].modules.length === 0) {
      /* 如果项目下没有模块了，删掉整个项目 */
      Store.data.study.categories.splice(ci, 1);
      if (state.cat >= Store.data.study.categories.length) state.cat = Math.max(0, Store.data.study.categories.length - 1);
    } else {
      if (state.mod >= Store.data.study.categories[ci].modules.length) state.mod = Store.data.study.categories[ci].modules.length - 1;
    }
    state.mod = 0; var _nm = curModule(); state.phase = (_nm && _nm.phases && _nm.phases[0]) ? _nm.phases[0].key : "p1";
    Store.save(); renderStudyNav(); renderStudyMain(); toast("\u5DF2\u5220\u9664");
  }
  /* ======== 阶段编辑 ======== */
  function renderPhaseTabs() {
    var box = $("study-phase-tabs"); if (!box) return;
    var m = curModule();
    if (!m) { box.innerHTML = ""; return; }
    ensurePhases(m);
    var html = '';
    m.phases.forEach(function (p, idx) {
      var active = state.phase === p.key ? ' active' : '';
      html += '<button class="phase' + active + '" data-pkey="' + esc(p.key) + '">' + esc(p.name)
        + ' <span class="phase-edit" data-rename="' + esc(p.key) + '" title="\u4FEE\u6539\u540D\u79F0">✎</span>'
        + ' <span class="phase-fields" data-fields="' + esc(p.key) + '" title="\u8BBE\u7F6E\u5B57\u6BB5">\u2699</span>'
        + (m.phases.length > 1 ? ' <span class="phase-del" data-delp="' + esc(p.key) + '" title="\u5220\u9664\u6B64\u9636\u6BB5">×</span>' : '')
        + '</button>';
    });
    html += '<button class="phase phase-add" id="phase-add-btn" title="\u65B0\u589E\u9636\u6BB5">+</button>';
    box.innerHTML = html;
    /* 阶段切换 */
    box.querySelectorAll(".phase[data-pkey]").forEach(function(btn) {
      btn.addEventListener("click", function (e) {
        if (e.target.classList.contains("phase-edit") || e.target.classList.contains("phase-del") || e.target.classList.contains("phase-fields")) return;
        state.phase = this.getAttribute("data-pkey"); renderStudyMain();
      });
    });
    /* 改名 */
    box.querySelectorAll(".phase-edit").forEach(function(sp) {
      sp.onclick = function (e) { e.stopPropagation(); renamePhase(this.getAttribute("data-rename")); };
    });
    /* 设置字段 */
    box.querySelectorAll(".phase-fields").forEach(function(sp) {
      sp.onclick = function (e) { e.stopPropagation(); editPhaseFields(this.getAttribute("data-fields")); };
    });
    /* 删除 */
    box.querySelectorAll(".phase-del").forEach(function(sp) {
      sp.onclick = function (e) { e.stopPropagation(); deletePhase(this.getAttribute("data-delp")); };
    });
    /* 新增 */
    var addBtn = $("phase-add-btn");
    if (addBtn) addBtn.onclick = addPhase;
  }
  function renamePhase(pkey) {
    var m = curModule(); if (!m) return;
    var p = m.phases.filter(function (x) { return x.key === pkey; })[0];
    if (!p) return;
    var n = prompt("\u4FEE\u6539\u9636\u6BB5\u540D\u79F0:", p.name);
    if (!n || !(n = n.trim())) return;
    p.name = n; Store.save(); renderPhaseTabs(); toast("\u5DF2\u4FEE\u6539");
  }
  function addPhase() {
    var m = curModule(); if (!m) return;
    ensurePhases(m);
    var n = prompt("\u65B0\u9636\u6BB5\u540D\u79F0:");
    if (!n || !(n = n.trim())) return;
    var pal = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8", "#c4bda9", "#cfbcd3"];
    var key = "p" + (m.phases.length + 1);
    var newPhase = { key: key, name: n, color: pal[m.phases.length % pal.length], fields: [
      { key: "date", type: "date", label: "\u65E5\u671F" },
      { key: "itemName", type: "text", label: "\u540D\u79F0" },
      { key: "note", type: "note", label: "\u7B14\u8BB0" }
    ] };
    m.phases.push(newPhase);
    m.records[key] = [];
    state.phase = key;
    Store.save(); renderStudyMain(); toast("\u5DF2\u589E\u52A0\u9636\u6BB5\u300C" + n + "\u300D");
  }
  function deletePhase(pkey) {
    var m = curModule(); if (!m || m.phases.length <= 1) return;
    var p = m.phases.filter(function (x) { return x.key === pkey; })[0];
    if (!p) return;
    if (!confirm("\u786E\u5B9A\u5220\u9664\u9636\u6BB5\u300C" + p.name + "\u300D\uFF1F\n\u8BE5\u9636\u6BB5\u4E0B\u7684 " + (m.records[pkey] ? m.records[pkey].length : 0) + " \u6761\u8BB0\u5F55\u4E5F\u5C06\u88AB\u5220\u9664\uFF01")) return;
    /* 删除阶段和记录 */
    m.phases = m.phases.filter(function (x) { return x.key !== pkey; });
    delete m.records[pkey];
    /* 如果删的是当前阶段，切到第一个 */
    if (state.phase === pkey && m.phases.length > 0) state.phase = m.phases[0].key;
    Store.save(); renderStudyMain(); toast("\u5DF2\u5220\u9664\u9636\u6BB5");
  }
  function applyStudyColor() {
    var m = curModule(); if (!m) return;
    document.documentElement.style.setProperty("--study-color", m.barColor);
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
    ensurePhases(m);
    $("module-name").textContent = m.name;
    $("module-dot").style.background = m.barColor;
    /* 模块改名按钮（放在主内容区头部，方便手机操作） */
    var head = $("module-head");
    var oldRename = head.querySelector(".mod-head-rename");
    if (oldRename) oldRename.remove();
    var renameBtn = document.createElement("button");
    renameBtn.className = "mini-btn mod-head-rename";
    renameBtn.title = "修改模块名称";
    renameBtn.textContent = "\u270E";
    renameBtn.onclick = function () { editModuleName(state.cat, state.mod); };
    head.appendChild(renameBtn);
    /* 动态渲染阶段标签 */
    renderPhaseTabs();
    var cp = curPhase();
    var cpKey = cp ? cp.key : (m.phases[0] ? m.phases[0].key : "p1");
    state.phase = cpKey;
    /* 颜色选择器：显示当前模块所有阶段的颜色 */
    $("study-swatches").innerHTML = "";
    m.phases.forEach(function (p) {
      var sw = document.createElement("span"); sw.className = "swatch"; sw.style.background = p.color;
      sw.onclick = function () { setPhaseColor(p.key, p.color); }; $("study-swatches").appendChild(sw);
    });
        /* 列表渲染 —— 按字段定义顺序依次显示，不猜测 */
    var ul = $("study-list"); ul.innerHTML = "";
    var list = curPhaseRecords();
    var phaseFields = cp.fields || getDefaultPhaseFields(m, cp);
    list.forEach(function (it) {
      var li = document.createElement("li");
      /* 竖列显示：按字段定义顺序，每字段一行，左对齐 */
      var rows = [];
      phaseFields.forEach(function(f) {
        var val = it[f.key];
        if (val == null || val === undefined || String(val).trim() === "") {
          /* 尝试已知旧版 key 做兼容（仅一次，不猜测） */
          var legacyMap = {
            "text": ["subject", "bookName", "basicSubject", "improveSubject", "title", "name", "courseName", "itemName"],
            "number": ["no", "basicNo", "chapterNo", "improveChapter", "pageNo", "num", "seq"],
            "status": ["progress", "basicProgress"]
          };
          var candidates = legacyMap[f.type] || [];
          var found = false;
          for (var ci = 0; ci < candidates.length; ci++) {
            if (it[candidates[ci]] != null && String(it[candidates[ci]]).trim()) {
              val = it[candidates[ci]]; found = true; break;
            }
          }
          if (!found) { val = ""; }
        }
        var sVal = (val != null) ? String(val).trim() : "";
        if (f.type === "note") return; /* 笔记单独处理 */
        var dispVal = sVal;
        if (f.type === "number" && sVal) {
          dispVal = sVal.length < 2 ? "0" + sVal : sVal;
        }
        if (!dispVal) dispVal = "\u2014"; /* 空值显示 — */
        rows.push('<div class="it-row"><span class="it-flabel">' + esc(f.label) + '</span><span class="it-fval">' + esc(dispVal) + '</span></div>');
      });
      var titleHtml = rows.join("");
      if (!titleHtml) titleHtml = '<div class="it-row"><span style="color:#bbb">\u8BB0\u5F55</span></div>';
      /* 笔记和照片 */
      var bodyHtml = "", photosHtml = "";
      phaseFields.forEach(function(f) {
        var val = it[f.key];
        if (f.type === "note" && val && String(val).trim()) {
          bodyHtml += '<div class="it-body">' + esc(String(val).trim()) + "</div>";
        }
      });
      if (it.photos && it.photos.length) photosHtml = '<div class="photos">' + it.photos.map(function(p){return '<img src="'+esc(p)+'">';}).join("")+"</div>";
      li.innerHTML = '<div class="it-title">' + titleHtml + '</div>'
        + bodyHtml
        + photosHtml
        + '<div class="it-actions"><button data-act="edit">编辑</button><button data-act="del" class="del">删除</button></div>';
      li.setAttribute("data-id", it.id); ul.appendChild(li);
    });
    applyStudyColor();
    /* 更新建按钮文字 */
    var addBtn = $("study-add");
    if (addBtn) addBtn.textContent = "+ \u65B0\u5EFA（" + esc(cp ? cp.name : "\u5B66\u4E60") + "）";
  }
  function setPhaseColor(pkey, hex) {
    var m = curModule(); if (!m) return;
    ensurePhases(m);
    var p = m.phases.filter(function (x) { return x.key === pkey; })[0];
    if (!p) return;
    openColorPicker(p.color, function (c) {
      p.color = c;
      if (pkey === state.phase) m.barColor = c;
      Store.save(); renderStudyNav(); renderStudyMain();
    });
  }
  function setModuleColor(hex) {
    var m = curModule(); if (!m) return;
    ensurePhases(m);
    var cp = curPhase();
    if (cp) { cp.color = hex; m.barColor = hex; }
    Store.save(); renderStudyNav(); renderStudyMain();
  }
  function showStudyForm(editId) {
    var m = curModule(); if (!m) return;
    ensurePhases(m);
    var cp = curPhase();
    if (!cp) return;
    var phaseLabel = cp.name || "学习";
    var fields = cp.fields || getDefaultPhaseFields(m, cp);
    var records = curPhaseRecords();
    var it = editId ? records.filter(function (x) { return x.id === editId; })[0] : null;

    /* 构建动态表单 */
    var html = '<h3>' + (it ? "编辑" : "新建") + '（' + esc(phaseLabel) + '）</h3>'
      + '<div style="text-align:right;margin-bottom:6px;"><button class="mini-btn" id="sf-editfields" title="设置字段">⚙ 设置字段</button></div>'
      + '<div id="sf-dynamic-fields"></div>'
      + '<div class="form-actions"><button class="btn-secondary" id="sf-cancel">返回</button><button class="btn-primary" id="sf-save">保存</button></div>';
    openModal(html);

    /* 渲染动态字段 */
    var fieldContainer = $("sf-dynamic-fields");
    var sfDate = it && it.date ? it.date : "";
    var sfPhotos = (it && it.photos) ? it.photos.slice() : [];

    fields.forEach(function(f, fi) {
      var val = it ? (it[f.key] != null ? it[f.key] : "") : "";
      var wrapper = document.createElement("div");
      wrapper.className = "sf-field-group";

      if (f.type === "date") {
        wrapper.innerHTML = '<div class="row"><label>' + esc(f.label) + '</label><span id="sf-date-disp" class="date-disp">' + (val ? esc(val) : "未选择（默认今天）") + '</span><button class="mini-btn" id="sf-date-pick">选择日期</button></div>';
        fieldContainer.appendChild(wrapper);
      } else if (f.type === "text") {
        if (f.memo === false) {
          wrapper.innerHTML = '<div class="row"><label>' + esc(f.label) + '</label><input id="sf-text-' + fi + '" type="text" value="' + esc(val) + '" placeholder="输入' + esc(f.label) + '（不记忆）" style="flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:14px;"></div>';
          fieldContainer.appendChild(wrapper);
        } else {
          wrapper.innerHTML = '<div style="font-size:13px;color:#5f7a5a;margin:6px 0 2px;">' + esc(f.label) + '</div><div id="sf-text-' + fi + '" class="tagctrl"></div>';
          fieldContainer.appendChild(wrapper);
          var pool = getTagPool(f.key);
          var selArr = val ? [String(val)] : [];
          /* 延迟渲染标签控件，等 DOM 插入后 */
          setTimeout(function() {
            var el = document.getElementById("sf-text-" + fi);
            if (el) createTagControl(el, pool, selArr, { placeholder: "输入" + f.label });
          }, 0);
        }
      } else if (f.type === "number") {
        var gridOn = f.grid !== false;
        wrapper.innerHTML = '<div class="row"><label>' + esc(f.label) + '</label><input id="sf-num-' + fi + '" type="number" value="' + esc(val) + '" placeholder="序号" style="width:90px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:14px;"></div>'
          + (gridOn ? '<div style="font-size:11px;color:#999;margin:2px 0 0;">上面也可手动输入任意数字（如 85）</div>' : '')
          + '<div id="sf-numgrid-' + fi + '" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;"></div>';
        fieldContainer.appendChild(wrapper);
        /* 数字点选网格 */
        var grid = wrapper.querySelector("#sf-numgrid-" + fi);
        if (grid && gridOn) {
          for (var ni = 1; ni <= 30; ni++) {
            var nb = document.createElement("button");
            nb.className = "mini-btn"; nb.textContent = ni; nb.style.cssText = "padding:2px 8px;font-size:12px;";
            nb.onclick = (function(n, inputEl) { return function() { inputEl.value = n; }; })(ni, wrapper.querySelector("#sf-num-" + fi));
            grid.appendChild(nb);
          }
        } else if (grid) {
          grid.style.display = "none";
        }
      } else if (f.type === "status") {
        var opts = f.options || ["选项1", "选项2"];
        var optsHtml = opts.map(function(oi) { return '<option value="' + esc(oi) + '">' + esc(oi) + '</option>'; }).join("");
        optsHtml += '<option value="__custom__">-- 新增选项 --</option>';
        wrapper.innerHTML = '<div class="row"><label>' + esc(f.label) + '</label><select id="sf-status-' + fi + '">' + optsHtml + '</select>'
          + '<input id="sf-newstatus-' + fi + '" placeholder="输入新选项" style="display:none;width:100%;margin-top:4px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;"></div>';
        fieldContainer.appendChild(wrapper);
        if (val && opts.indexOf(val) >= 0) wrapper.querySelector("#sf-status-" + fi).value = val;
        else if (val) wrapper.querySelector("#sf-status-" + fi).value = "__custom__";
        /* 新增选项逻辑 */
        var statusSel = wrapper.querySelector("#sf-status-" + fi);
        var newStInput = wrapper.querySelector("#sf-newstatus-" + fi);
        if (statusSel && newStInput) {
          statusSel.onchange = function() {
            if (this.value === "__custom__") { newStInput.style.display = ""; newStInput.focus(); }
            else { newStInput.style.display = "none"; }
          };
        }
      } else if (f.type === "note") {
        wrapper.innerHTML = '<textarea id="sf-note-' + fi + '" placeholder="' + esc(f.label) + '">' + esc(String(val)) + '</textarea>'
          + (fi === fields.length - 1 || true ? '<input id="sf-photo" type="file" accept="image/*" style="margin-top:4px;">' : '');
        fieldContainer.appendChild(wrapper);
      }
    });

    /* 设置字段按钮 */
    $("sf-editfields").onclick = function () { closeModal(); editPhaseFields(cp.key); };

    $("sf-cancel").onclick = closeModal;

    /* 日期选择器 */
    var datePickBtn = $("sf-date-pick");
    if (datePickBtn) datePickBtn.onclick = function () {
      openDatePicker({ mode: "single", value: sfDate || undefined, onConfirm: function (d) { sfDate = d; var disp = $("sf-date-disp"); if (disp) disp.textContent = d; } });
    };

    /* 保存：收集所有字段值 */
    $("sf-save").onclick = function () {
      var file = $("sf-photo") && $("sf-photo").files && $("sf-photo").files[0];
      function commit() {
        var obj = { id: it ? it.id : uid() };
        obj.date = sfDate || todayStr();
        /* 收集各字段值 */
        fields.forEach(function(f, fi) {
          if (f.type === "date") {
            obj[f.key] = sfDate || todayStr();
          } else if (f.type === "text") {
            var tcEl = document.getElementById("sf-text-" + fi);
            if (f.memo === false) {
              obj[f.key] = tcEl ? (tcEl.value || "").trim() : "";
          } else {
              /* 标签控件：从已选区域读取 tagpill（不是 tagchip！） */
              var selWrap = tcEl ? tcEl.querySelector(".tag-sel") : null;
              var chips = selWrap ? selWrap.querySelectorAll(".tagpill") : [];
              var textVal = [];
              chips.forEach(function(t) { var txt = t.textContent.replace(/\s*\u00D7\s*$/, "").trim(); if (txt) textVal.push(txt); });
              obj[f.key] = textVal.join("") || "";
              saveToTagPool(f.key, obj[f.key]);
            }
          } else if (f.type === "number") {
            var numInput = document.getElementById("sf-num-" + fi);
            obj[f.key] = numInput ? numInput.value.trim() : "";
          } else if (f.type === "status") {
            var stSel = document.getElementById("sf-status-" + fi);
            var newStInput = document.getElementById("sf-newstatus-" + fi);
            var stVal = stSel ? stSel.value : "";
            if (stVal === "__custom__" && newStInput) {
              stVal = newStInput.value.trim();
              if (stVal) {
                /* 将新选项加入字段定义 */
                if (!f.options) f.options = [];
                if (f.options.indexOf(stVal) < 0) f.options.push(stVal);
                Store.save();
              }
            }
            obj[f.key] = stVal || (f.options && f.options[0]) || "";
          } else if (f.type === "note") {
            var noteEl = document.getElementById("sf-note-" + fi);
            obj[f.key] = noteEl ? noteEl.value.trim() : "";
          }
        });
        /* 照片 */
        if (sfPhotos && sfPhotos.length > 0) obj.photos = sfPhotos;
        var arr = curPhaseRecords();
        if (it) { var i = arr.indexOf(it); if (i >= 0) arr[i] = obj; } else arr.unshift(obj);
        Store.save(); closeModal(); renderStudyMain(); toast("已保存");
      }
      if (file) { var rd = new FileReader(); rd.onload = function () { if (!sfPhotos) sfPhotos = []; sfPhotos.push(rd.result); commit(); }; rd.onerror = function () { commit(); }; rd.readAsDataURL(file); }
      else commit();
    };
  }


    /* ======== 阶段字段编辑器（含模板库） ======== */
  function editPhaseFields(phaseKey) {
    var m = curModule(); if (!m) return;
    ensurePhases(m);
    var p = m.phases.filter(function (x) { return x.key === phaseKey; })[0];
    if (!p) return;
    if (!p.fields) p.fields = getDefaultPhaseFields(m, p);
    var fields = clone(p.fields);
    var typeOptions = [
      { type: "date",   label: "日期", desc: "日期选择器" },
      { type: "text",   label: "文本", desc: "文本输入，自动记忆标签" },
      { type: "number", label: "数字", desc: "数字，提供点选网格" },
      { type: "status", label: "状态", desc: "下拉选项，可新增" },
      { type: "note",   label: "笔记", desc: "多行文本+图片上传" }
    ];
    function renderEditor() {
      var html = '<h3 style="margin:0 0 8px;">⚙ 设置「' + esc(p.name) + '」的字段</h3>'
        + '<div style="margin-bottom:8px;"><button class="mini-btn" id="fe-help">? 字段类型说明（看不懂点这里）</button></div>';
      var templates = Store.data.study.fieldTemplates || [];
      if (templates.length > 0) {
        html += '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#5f7a5a;font-weight:600;display:block;margin-bottom:4px;">模板库（点击应用）:</label><div style="display:flex;flex-direction:column;gap:4px;">';
        templates.forEach(function(t, ti) {
          html += '<button class="mini-btn tpl-btn" data-tpl="' + ti + '" style="text-align:left;padding:6px 10px;font-size:13px;"><b>' + esc(t.name) + '</b> <span style="color:#888;font-size:11px;">' + esc(t.desc || "") + '</span></button>';
        });
        html += '</div></div>';
      }
      html += '<label style="font-size:13px;color:#5f7a5a;font-weight:600;display:block;margin:6px 0 4px;">当前字段:</label><div id="fe-field-list"></div>';
      html += '<div style="margin-top:8px;"><label style="font-size:13px;color:#5f7a5a;font-weight:600;">+ 添加字段:</label><div id="fe-add-area" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;"></div></div>';
      html += '<div class="form-actions" style="margin-top:12px;"><button class="btn-secondary" id="fe-cancel">返回</button><button class="btn-primary" id="fe-save">保存</button></div>';
      openModal(html);
      templates.forEach(function(t, ti) {
        var btn = document.querySelector('[data-tpl="' + ti + '"]');
        if (btn) btn.onclick = function () {
          if (!confirm("应用模板「" + t.name + "」？当前字段将被替换。")) return;
          fields = clone(t.fields); renderEditor();
        };
      });
      renderFieldList();
      var helpBtn = $("fe-help");
      if (helpBtn) helpBtn.onclick = showFieldTypeGuide;
      var addArea = $("fe-add-area");
      if (addArea) {
        typeOptions.forEach(function(topt) {
          var b = document.createElement("button");
          b.className = "mini-btn"; b.textContent = topt.label; b.title = topt.desc;
          b.onclick = function () {
            var newKey = "cf_" + Date.now().toString(36) + "_" + topt.type;
            var newField = { key: newKey, type: topt.type, label: topt.label };
            if (topt.type === "status") newField.options = ["选项1", "选项2"];
            fields.push(newField); renderFieldList();
          };
          addArea.appendChild(b);
        });
      }
      $("fe-cancel").onclick = closeModal;
      $("fe-save").onclick = function () {
        if (fields.length === 0) { toast("至少需要一个字段"); return; }
        p.fields = fields; Store.save(); closeModal();
        toast("「" + p.name + "」字段已更新"); renderStudyMain();
      };
    }
    function renderFieldList() {
      var box = $("fe-field-list"); if (!box) return;
      if (fields.length === 0) { box.innerHTML = '<p class="hint" style="font-size:12px;">还没有字段，下方选择类型添加</p>'; return; }
      box.innerHTML = "";
      fields.forEach(function(f, fi) {
        var row = document.createElement("div");
        row.className = "fe-field-row";
        row.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f8f6f1;border-radius:6px;margin-bottom:4px;";
        var tc = f.type==="date"?"#d4edda":f.type==="text"?"#cce5ff":f.type==="number"?"#fff3cd":f.type==="status"?"#f8d7da":"#e2e3e5";
        var typeBadge = '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:'+tc+';color:#333;">' + f.type + '</span>';
        var labelHtml = '<input id="felabel-' + fi + '" value="' + esc(f.label) + '" placeholder="字段名称" style="flex:1;min-width:0;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;">';
        var optsHtml = '';
        if (f.type === "text") {
          var memoOn = f.memo !== false;
          optsHtml += '<label style="font-size:11px;color:#666;display:flex;align-items:center;gap:2px;white-space:nowrap;"><input type="checkbox" id="fememo-' + fi + '"' + (memoOn ? ' checked' : '') + '> 记忆标签</label>';
        }
        if (f.type === "number") {
          var gridOn = f.grid !== false;
          optsHtml += '<label style="font-size:11px;color:#666;display:flex;align-items:center;gap:2px;white-space:nowrap;"><input type="checkbox" id="fegrid-' + fi + '"' + (gridOn ? ' checked' : '') + '> 点选网格</label>';
        }
        if (f.type === "status" && f.options) {
          optsHtml += '<span style="font-size:11px;color:#888;">(' + f.options.join("/") + ')</span><button class="mini-btn" id="feopts-' + fi + '" style="padding:1px 6px;font-size:11px;">编辑</button>';
        }
        row.setAttribute("draggable", "true");
        row.setAttribute("data-fi", fi);
        row.innerHTML = '<span style="cursor:grab;color:#aaa;" title="拖动排序">:::</span> ' + typeBadge + ' ' + labelHtml + ' ' + optsHtml + ' <button class="mini-btn danger" data-fdel="' + fi + '" style="padding:1px 6px;font-size:11px;">删</button>';
        box.appendChild(row);
        /* 拖动排序 */
        row.ondragstart = function (e) { e.dataTransfer.setData("text/fi", fi); this.style.opacity = "0.4"; };
        row.ondragend = function () { this.style.opacity = ""; };
        row.ondragover = function (e) { e.preventDefault(); this.style.borderTop = "2px solid #5f7a5a"; };
        row.ondragleave = function () { this.style.borderTop = ""; };
        row.ondrop = function (e) {
          e.preventDefault();
          this.style.borderTop = "";
          var fromFi = parseInt(e.dataTransfer.getData("text/fi"));
          var toFi = parseInt(this.getAttribute("data-fi"));
          if (fromFi !== toFi && !isNaN(fromFi) && !isNaN(toFi)) {
            var moved = fields.splice(fromFi, 1)[0];
            fields.splice(toFi, 0, moved);
            renderFieldList();
          }
        };
        row.querySelector("[data-fdel]").onclick = function () { fields.splice(parseInt(this.getAttribute("data-fdel")), 1); renderFieldList(); };
        row.querySelector("#felabel-" + fi).onchange = function () { fields[fi].label = this.value.trim() || fields[fi].label; };
        var memoChk = document.getElementById("fememo-" + fi);
        if (memoChk) memoChk.onchange = function () { if (this.checked) delete fields[fi].memo; else fields[fi].memo = false; };
        var gridChk = document.getElementById("fegrid-" + fi);
        if (gridChk) gridChk.onchange = function () { if (this.checked) delete fields[fi].grid; else fields[fi].grid = false; };
        var optBtn = document.getElementById("feopts-" + fi);
        if (optBtn) optBtn.onclick = function () { editStatusOptions(fi); };
      });
    }
    function editStatusOptions(fi) {
      var f = fields[fi];
      if (!f.options) f.options = [];
      var currOpts = f.options.slice();
      var html = '<h3 style="margin:0 0 8px;">编辑「' + esc(f.label) + '」的选项</h3><p class="hint" style="font-size:12px;">每行一个选项，留空删除。</p><div id="fe-opts-list">';
      currOpts.forEach(function(oi, oiIdx) {
        html += '<div style="display:flex;gap:4px;margin:3px 0;"><input id="feoi-' + oiIdx + '" value="' + esc(oi) + '" style="flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;"><button class="mini-btn danger" data-odel="' + oiIdx + '" style="padding:2px 6px;font-size:11px">删</button></div>';
      });
      html += '</div><button class="mini-btn" id="fe-opt-add" style="margin-top:4px;">+ 新增</button><div class="form-actions" style="margin-top:10px;"><button class="btn-primary" id="fe-opt-save">确定</button></div>';
      openModal(html);
      document.querySelectorAll("[data-odel]").forEach(function(b) {
        b.onclick = function () { currOpts.splice(parseInt(this.getAttribute("data-odel")), 1); editStatusOptions(fi); };
      });
      $("fe-opt-add").onclick = function () { currOpts.push("新选项" + (currOpts.length + 1)); editStatusOptions(fi); };
      $("fe-opt-save").onclick = function () {
        var newOpts = [];
        currOpts.forEach(function(oi, oiIdx) { var inp = document.getElementById("feoi-" + oiIdx); if (inp && inp.value.trim()) newOpts.push(inp.value.trim()); });
        f.options = newOpts.length > 0 ? newOpts : ["选项1"];
        closeModal(); renderFieldList();
      };
    }
    renderEditor();
  }
  /* 字段类型说明（小贴士） */
  function showFieldTypeGuide() {
    var html = '<h3 style="margin:0 0 10px;">字段类型说明</h3>'
      + '<div style="font-size:13px;line-height:1.8;">'
      + '<p><b>① 日期</b>：选哪天学的，点「选择日期」弹日历。留空默认今天。</p>'
      + '<p><b>② 文本</b>：课程名称、试卷名称等文字。默认<b>自动记忆</b>——填过的值下次自动出现在候选里，点一下即可；不想要记忆（如页码区间）可在「设置字段」里取消勾选「记忆标签」。</p>'
      + '<p><b>③ 数字</b>：第几节课、第几章。提供 1–30 点选网格，也可直接在框里手输任意数字（比如 85 节）。「设置字段」里取消「点选网格」可只留手输框。</p>'
      + '<p><b>④ 状态</b>：做题进度等。下拉选择，不够用点「-- 新增选项 --」随时加（如「需重做」）。</p>'
      + '<p><b>⑤ 笔记</b>：多行文字 + 照片上传。照片存在本机浏览器，换设备/清缓存会丢，重要照片请另存。</p>'
      + '<p style="color:#5f7a5a;">用法：在「⚙ 设置字段」里从模板库一键套用，或自己增删字段、改名、改类型。</p>'
      + '</div>'
      + '<div class="form-actions" style="margin-top:10px;"><button class="btn-primary" id="ftg-close">知道了</button></div>';
    openModal(html);
    var c = $("ftg-close"); if (c) c.onclick = closeModal;
  }
  /* 标签池：文本字段自动记忆 */
  function getTagPool(fieldKey) {
    if (!Store.data.study.studyTagPools) Store.data.study.studyTagPools = {};
    if (!Store.data.study.studyTagPools[fieldKey]) Store.data.study.studyTagPools[fieldKey] = [];
    return Store.data.study.studyTagPools[fieldKey];
  }
  function saveToTagPool(fieldKey, value) {
    if (!value || !fieldKey) return;
    var pool = getTagPool(fieldKey);
    if (pool.indexOf(value) < 0) { pool.push(value); if (pool.length > 50) pool.shift(); Store.save(); }
  }


  function showStudyCategoryForm() {
    var pal = ["#a9c4b5", "#bcd3cb", "#aec9cf", "#bcd0c0", "#b0cdd6", "#c3d7c8", "#c4bda9", "#cfbcd3"];
    var pIdx = 0;
    var html = ''
      + '<h3 style="margin:0 0 10px;">\u65B0\u5EFA\u5B66\u4E60\u9879\u76EE</h3>'
      + '<div class="row"><label>\u9879\u76EE\u540D\u79F0</label><input id="scat-name" placeholder="\u5982\uFF1A\u8003\u7814\u3001\u6559\u8D44\u3001\u82F1\u8BED"></div>'
      + '<div style="margin:10px 0;"><label style="font-size:13px;color:#5f7a5a;font-weight:600;">\u6A21\u5757\u5217\u8868\uFF08\u70B9\u51FB\u6DFB\u52A0\uFF09:</label><div id="scat-mods" style="margin-top:6px;"></div></div>'
      + '<button class="mini-btn" id="scat-addmod" style="margin-bottom:8px;">+ \u6DFB\u52A0\u6A21\u5757</button>'
      + '<div style="margin:10px 0;font-size:13px;color:#5f7a5a;">\u9636\u6BB5\u8BBE\u7F6E:</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#f8f6f1;border-radius:6px;cursor:pointer;"><input type="radio" name="scat-phase" value="default" checked> \u57FA\u7840\u5B66\u4E60 / \u63D0\u5347\u9636\u6BB5</label>'
      + '<label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#f8f6f1;border-radius:6px;cursor:pointer;"><input type="radio" name="scat-phase" value="single"> \u53EA\u4E00\u4E2A\u9636\u6BB5</label>'
      + '<label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#f8f6f1;border-radius:6px;cursor:pointer;"><input type="radio" name="scat-phase" value="custom"> \u81EA\u5B9A\u4E49\u9636\u6BB5\u540D</label>'
      + '</div>'
      + '<div id="scat-custom-phases" style="display:none;margin-bottom:10px;">'
      + '<input id="scat-phase1" placeholder="\u9636\u6BB51\u540D\u79F0" value="\u57FA\u7840\u5B66\u4E60" style="width:45%;margin-right:4px;">'
      + '<input id="scat-phase2" placeholder="\u9636\u6BB52\u540D\u79F0" value="\u63D0\u5347\u9636\u6BB5" style="width:45%;">'
      + '</div>'
      + '<p class="hint" style="font-size:12px;">\u63D0\u793A\uFF1A\u6BCF\u4E2A\u5B66\u4E60\u9879\u76EE\u7684\u6A21\u5757\u90FD\u662F\u72EC\u7ACB\u7684\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u9879\u76EE\u3002</p>'
      + '<div class="form-actions"><button class="btn-secondary" id="scat-cancel">\u8FD4\u56DE</button><button class="btn-primary" id="scat-save">\u521B\u5EFA</button></div>';
    openModal(html);
    /* 模块列表渲染 */
    var modList = [];
    function renderMods() {
      var box = $("scat-mods"); if (!box) return;
      box.innerHTML = "";
      if (modList.length === 0) { box.innerHTML = '<p class="hint" style="font-size:12px;">\u8FD8\u6CA1\u6709\u6DFB\u52A0\u6A21\u5757\uFF0C\u70B9\u4E0A\u65B9\u201C+\u6DFB\u52A0\u6A21\u5757\u201D</p>'; return; }
      modList.forEach(function(m, i) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0;padding:4px 8px;background:#f8f6f1;border-radius:6px;";
        row.innerHTML = '<span style="width:12px;height:12px;border-radius:50%;background:' + m.color + ';flex-shrink:0;"></span>'
          + '<span style="flex:1;font-size:14px;">' + esc(m.name) + '</span>'
          + '<button class="mini-btn" data-rmmod="' + i + '">\u5220\u9664</button>';
        box.appendChild(row);
      });
      /* 绑定删除 */
      box.querySelectorAll("[data-rmmod]").forEach(function(btn) {
        btn.onclick = function () { var idx = parseInt(this.getAttribute("data-rmmod")); modList.splice(idx, 1); renderMods(); };
      });
    }
    renderMods();
    /* 添加模块 */
    $("scat-addmod").onclick = function () {
      var n = prompt("\u8F93\u5165\u6A21\u5757\u540D\u79F0\uFF08\u5982\uFF1A\u5355\u8BCD\u3001\u53E3\u8BED\u3001\u77ED\u7247\u9605\u8BFB\uFF09:");
      if (!n || !n.trim()) return;
      modList.push({ name: n.trim(), color: pal[pIdx % pal.length] });
      pIdx++;
      renderMods();
    };
    /* 阶段类型切换 */
    document.querySelectorAll("[name='scat-phase']").forEach(function(r) {
      r.onchange = function () { $("scat-custom-phases").style.display = this.value === "custom" ? "" : "none"; };
    });
    /* 取消/保存 */
    $("scat-cancel").onclick = closeModal;
    $("scat-save").onclick = function () {
      var name = ($("scat-name").value || "").trim();
      if (!name) { toast("\u8BF7\u8F93\u5165\u9879\u76EE\u540D\u79F0"); return; }
      if (modList.length === 0) { toast("\u8BF7\u81F3\u5C11\u6DFB\u52A0\u4E00\u4E2A\u6A21\u5757"); return; }
      var phaseType = document.querySelector("[name='scat-phase']:checked").value;
      /* 构建阶段列表（含默认字段） */
      var defaultFieldsBasic = [
        { key: "date", type: "date", label: "\u65E5\u671F" },
        { key: "courseName", type: "text", label: "\u8BFE\u7A0B\u540D\u79F0" },
        { key: "lessonNo", type: "number", label: "\u8BFE\u7A0B\u5E8F\u53F7" },
        { key: "note", type: "note", label: "\u7B14\u8BB0" }
      ];
      var defaultFieldsImprove = [
        { key: "date", type: "date", label: "\u65E5\u671F" },
        { key: "paperName", type: "text", label: "\u8BD5\u5377\u540D\u79F0" },
        { key: "chapterNo", type: "number", label: "\u7AE0\u8282\u5E8F\u53F7" },
        { key: "pageRange", type: "text", label: "\u9875\u7801" },
        { key: "status", type: "status", label: "\u72B6\u6001", options: ["\u5F85\u6279\u6539", "\u521D\u6B21\u6279\u6539\uFF0C\u672A\u590D\u4E60", "\u5DF2\u590D\u4E60"] },
        { key: "note", type: "note", label: "\u7B14\u8BB0" }
      ];
      var defaultFieldsSimple = [
        { key: "date", type: "date", label: "\u65E5\u671F" },
        { key: "itemName", type: "text", label: "\u540D\u79F0" },
        { key: "note", type: "note", label: "\u7B14\u8BB0" }
      ];
      var phases = [];
      if (phaseType === "single") {
        phases = [{ key: "p1", name: "\u5B66\u4E60", color: pal[0], fields: defaultFieldsSimple }];
      } else if (phaseType === "custom") {
        var p1 = ($("scat-phase1").value || "").trim() || "\u57FA\u7840\u5B66\u4E60";
        var p2 = ($("scat-phase2").value || "").trim() || "\u63D0\u5347\u9636\u6BB5";
        phases = [{ key: "p1", name: p1, color: pal[0], fields: clone(defaultFieldsBasic) }, { key: "p2", name: p2, color: pal[1], fields: clone(defaultFieldsImprove) }];
      } else {
        phases = [{ key: "p1", name: "\u57FA\u7840\u5B66\u4E60", color: pal[0], fields: clone(defaultFieldsBasic) }, { key: "p2", name: "\u63D0\u5347\u9636\u6BB5", color: pal[1], fields: clone(defaultFieldsImprove) }];
      }
      var modules = modList.map(function(m, i) {
        var modPhases = phases.map(function (p, pi) {
          return { key: m.name + "_" + p.key, name: p.name, color: m.color, fields: p.fields ? clone(p.fields) : null };
        });
        var records = {};
        modPhases.forEach(function (mp) { records[mp.key] = []; });
        return {
          name: m.name,
          barColor: m.color,
          phases: modPhases,
          records: records
        };
      });
      Store.data.study.categories.push({ name: name, modules: modules });
      state.cat = Store.data.study.categories.length - 1;
      state.mod = 0;
      state.phase = modules[0].phases[0].key;
      Store.save(); closeModal();
      renderStudyNav(); renderStudyMain();
      toast("\u5DF2\u521B\u5EFA\u300C" + name + "\u300D");
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
      '<div class="form-actions"><button class="btn-secondary" id="nf-cancel">返回</button><button class="btn-primary" id="nf-save">保存</button></div>');
    var per = n ? n.perspective.slice() : [], prog = n ? n.progress.slice() : [], plot = n ? n.plot.slice() : [], author = n ? n.author.slice() : [];
    $("nf-cancel").onclick = closeModal;
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
      '<div class="form-actions"><button class="btn-secondary" id="if-cancel">返回</button><button class="btn-primary" id="if-save">保存</button></div>');
    $("if-cancel").onclick = closeModal;
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
      b.onclick = function (e) { if (e.target.getAttribute && e.target.getAttribute("data-move")) return; state.lifeSel = key; renderLifeNav(); renderLifeMain(); };
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
    else if (key === "wardrobe") html += lifeWardrobeHtml();
    else if (key === "travel") html += lifeTravelHtml();
    else if (key === "docs") html += lifeDocsHtml();
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
    var checked = s.enabled ? " checked" : "";
    return '<div class="row"><label>每日睡眠提醒</label>' +
      '<label class="pack-item sleep-toggle"><input type="checkbox" id="ls-enabled"' + checked + '><span>到点发送通知提醒我睡觉</span></label></div>' +
      '<div class="row"><label>提醒时间</label><span id="ls-remind-disp" class="date-disp">' + esc(s.remind || "未选择") + '</span><button class="mini-btn" id="ls-remind-pick">选择</button></div>' +
      '<p class="hint">提示：首次启用时请允许浏览器/手机通知权限。应用打开时会在到点弹出提醒。</p>';
  }
  function lifePeriodHtml() {
    var p = Store.data.life.period;
    var lastStart = p.records.length ? (p.records[p.records.length - 1].start || p.records[p.records.length - 1].date) : "";
    var next = lastStart ? predictPeriod(lastStart, p.cycle) : "";
    return '<div class="row"><label>周期（天）</label><input type="number" id="lp-cycle" value="' + esc(p.cycle || 28) + '"></div>' +
      '<div class="row"><label>开始日期</label><span id="lp-start-disp" class="date-disp">未选择</span><button class="mini-btn" id="lp-start-pick">选择</button></div>' +
      '<div class="row"><label>结束日期</label><span id="lp-end-disp" class="date-disp">未选择</span><button class="mini-btn" id="lp-end-pick">选择</button></div>' +
      '<button class="mini-btn" id="lp-add">记录</button>' +
      (next ? '<div class="weight-log">预计下次：' + next + "</div>" : "") +
      buildPeriodStats(p.records);
  }
  function buildPeriodStats(records) {
    if (!records || !records.length) return "";
    var arr = records.slice().sort(function (a, b) { return ymdCmp(a.start || a.date, b.start || b.date); });
    var html = '<div class="period-stats"><div class="filter-cat">统计</div>';
    arr.forEach(function (r, i) {
      var s = r.start || r.date || "", e = r.end || r.date || "";
      var dur = s && e ? (dayDiff(s, e) + 1) : 0;
      html += '<div class="ps-row" data-pi="' + i + '"><span class="ps-idx">第 ' + (i + 1) + ' 次</span><span class="ps-date">' + esc(s) + (s !== e ? " ~ " + esc(e) : "") + '</span><span class="ps-dur">持续 ' + dur + ' 天</span><button class="mini-btn edit-period" data-pi="' + i + '">编辑</button><button class="mini-btn danger del-period" data-pi="' + i + '">删除</button></div>';
      if (i > 0) {
        var gap = dayDiff(arr[i - 1].start || arr[i - 1].date, s);
        html += '<div class="ps-gap">间隔 ' + gap + ' 天</div>';
      }
    });
    html += '</div>';
    return html;
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
    var w = Store.data.life.weight.slice().sort(function (a, b) { return ymdCmp(a.date, b.date); });
    var unit = Store.data.life.weightUnit || "jin";
    function unitLabel(u) { return u === "jin" ? "斤" : "kg"; }
    function toDisplay(v, u) {
      var kg = (u === "jin") ? v / 2 : v;
      return Math.round((unit === "jin" ? kg * 2 : kg) * 10) / 10;
    }
    var diffHtml = calcWeightDiff(w, unit);
    var rows = w.slice(-5).map(function (r) {
      var u = r.unit || "kg";
      return '<div class="weight-log" data-wid="' + esc(r.id) + '">' + esc(r.date) + "：" + toDisplay(r.v, u) + " " + unitLabel(unit) +
        '<span class="weight-actions"><button class="mini-btn edit-weight" data-wid="' + esc(r.id) + '">编辑</button><button class="mini-btn danger del-weight" data-wid="' + esc(r.id) + '">删除</button></span></div>';
    }).join("");
    return '<div class="row"><label>日期</label><span id="lw-date-disp" class="date-disp">' + todayStr() + '</span><button class="mini-btn" id="lw-date-pick">选择日期</button></div>' +
      '<div class="unit-toggle"><span class="ut-label">单位</span>' +
        '<button data-unit="kg" class="' + (unit === "kg" ? "on" : "") + '">kg</button>' +
        '<button data-unit="jin" class="' + (unit === "jin" ? "on" : "") + '">斤</button>' +
      '</div>' +
      '<div class="row"><label>记录体重（' + unitLabel(unit) + '）</label><input type="number" id="lw-v" placeholder="' + (unit === "jin" ? "120" : "60") + '"><button class="mini-btn" id="lw-add">记录</button></div>' +
      (diffHtml ? '<div class="weight-diff">' + diffHtml + '</div>' : '') + rows;
  }
  function calcWeightDiff(sorted, unit) {
    if (sorted.length < 2) return "";
    var last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
    function toKg(v, u) { return (u === "jin") ? v / 2 : v; }
    var diff = toKg(last.v, last.unit || "kg") - toKg(prev.v, prev.unit || "kg");
    var disp = Math.round((unit === "jin" ? diff * 2 : diff) * 10) / 10;
    var sign = disp > 0 ? "+" : (disp < 0 ? "" : "");
    var trend = disp > 0 ? "上升" : (disp < 0 ? "下降" : "持平");
    return "比上次（" + esc(prev.date) + "）" + trend + " " + sign + Math.abs(disp) + (unit === "jin" ? " 斤" : " kg");
  }
  function showWeightForm(id) {
    var rec = Store.data.life.weight.filter(function (x) { return x.id === id; })[0];
    if (!rec) return;
    var unit = Store.data.life.weightUnit || "jin";
    function toDisplay(v, u) { var kg = (u === "jin") ? v / 2 : v; return Math.round((unit === "jin" ? kg * 2 : kg) * 10) / 10; }
    openModal('<h3>编辑体重记录</h3>' +
      '<div class="row"><label>日期</label><span id="lw-edit-date-disp" class="date-disp">' + esc(rec.date) + '</span><button class="mini-btn" id="lw-edit-date-pick">选择</button></div>' +
      '<div class="row"><label>体重（' + (unit === "jin" ? "斤" : "kg") + '）</label><input type="number" id="lw-edit-v" value="' + toDisplay(rec.v, rec.unit || "kg") + '"></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="lw-edit-cancel">返回</button><button class="btn-primary" id="lw-edit-save">保存</button></div>');
    var editDate = rec.date;
    $("lw-edit-cancel").onclick = closeModal;
    $("lw-edit-date-pick").onclick = function () { openDatePicker({ mode: "single", value: editDate, onConfirm: function (d) { editDate = d; $("lw-edit-date-disp").textContent = d; } }); };
    $("lw-edit-save").onclick = function () {
      var v = parseFloat($("lw-edit-v").value); if (isNaN(v)) { toast("请输入体重数值"); return; }
      rec.date = editDate; rec.v = v; rec.unit = unit;
      Store.save(); closeModal(); renderLifeMain(); renderHome(); toast("已更新");
    };
  }
  // 四象限优先级：重要+紧急、重要+不紧急、不重要+紧急、不重要+不紧急
  var MEMO_PRIORITY = [
    { key: "iu", name: "重要且紧急", cls: "priority-iu" },
    { key: "inu", name: "重要不紧急", cls: "priority-inu" },
    { key: "niu", name: "紧急不重要", cls: "priority-niu" },
    { key: "ninu", name: "不重要不紧急", cls: "priority-ninu" }
  ];
  function defaultMemoPriorityColors() {
    return { iu: "#c58d85", inu: "#9fb39a", niu: "#8ea6b8", ninu: "#c4b8a8" };
  }
  function priorityFromFlags(important, urgent) {
    if (important && urgent) return "iu";
    if (important) return "inu";
    if (urgent) return "niu";
    return "ninu";
  }
  function applyMemoPriorityColors() {
    var cols = (Store.data && Store.data.settings && Store.data.settings.memoPriorityColors) || defaultMemoPriorityColors();
    MEMO_PRIORITY.forEach(function (p) {
      var hex = cols[p.key] || defaultMemoPriorityColors()[p.key];
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      document.documentElement.style.setProperty("--memo-" + p.key, hex);
      document.documentElement.style.setProperty("--memo-" + p.key + "-rgb", r + "," + g + "," + b);
    });
  }
  function applyHighlightColor() {
    var hex = (Store.data && Store.data.settings && Store.data.settings.highlightColor) || "#f6e7a0";
    document.documentElement.style.setProperty("--hl", hex);
  }
  function lifeMemoHtml() {
    var memos = Store.data.life.memo;
    var rows = memos.map(function (m, i) {
      var p = MEMO_PRIORITY.filter(function (x) { return x.key === (m.priority || "normal"); })[0] || MEMO_PRIORITY[0];
      var itemsHtml = (m.items || []).map(function (it, ii) {
        return '<div class="memo-item" data-mi="' + i + '" data-ii="' + ii + '">' +
          '<span class="memo-check" data-mi="' + i + '" data-ii="' + ii + '"></span>' +
          '<span class="memo-item-text">' + esc(it.text) + '</span>' +
          '<button class="mini-btn danger del-item" data-mi="' + i + '" data-ii="' + ii + '">删除</button></div>';
      }).join("");
      return '<div class="memo-card ' + p.cls + '" data-mi="' + i + '">' +
        '<div class="memo-actions"><button class="mini-btn danger del-memo" data-mi="' + i + '">删除备忘</button></div>' +
        '<div class="row"><label>标题</label><input class="memo-title" data-mi="' + i + '" value="' + esc(m.title || "") + '"></div>' +
        '<div class="row"><label>优先级</label><select class="memo-priority" data-mi="' + i + '">' +
          MEMO_PRIORITY.map(function (x) { return '<option value="' + x.key + '"' + (x.key === p.key ? " selected" : "") + '>' + x.name + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="row"><label>日期</label><span class="date-disp memo-date-disp" data-mi="' + i + '">' + esc(m.date || todayStr()) + '</span><button class="mini-btn memo-date-pick" data-mi="' + i + '">选择日期</button></div>' +
        '<div class="row"><label>内容</label><textarea class="memo-content" data-mi="' + i + '" placeholder="写点什么，或直接添加下面的事项…">' + esc(m.content || "") + '</textarea></div>' +
        (itemsHtml ? '<div class="memo-items">' + itemsHtml + '</div>' : '') +
        '<div class="memo-add-item"><input class="memo-new-item" data-mi="' + i + '" placeholder="新增一条事项，回车添加"><button class="mini-btn add-item" data-mi="' + i + '">+</button></div>' +
        '</div>';
    }).join("");
    return rows +
      '<div class="mommy-sort">' +
        '<div class="mommy-head"><b>贴心整理台</b><button class="mini-btn" id="memo-color-set">颜色设置</button></div>' +
        '<div class="mommy-tip">把脑子里乱糟糟的事一股脑写下来，我帮你理成清单。结果可以手动改日期、时间、优先级和文字。</div>' +
        '<textarea id="mommy-input" placeholder=""></textarea>' +
        '<button class="btn-primary" id="mommy-sort-btn">✨ 帮我理成清单</button>' +
        '<div id="mommy-result"></div>' +
      '</div>' +
      '<div class="memo-card new-memo">' +
      '<div class="row"><label>新备忘</label><input id="lm-title" placeholder="标题"></div>' +
      '<div class="row"><label>优先级</label><select id="lm-priority">' + MEMO_PRIORITY.map(function (x) { return '<option value="' + x.key + '">' + x.name + '</option>'; }).join("") + '</select></div>' +
      '<div class="row"><label>日期</label><span id="lm-date-disp" class="date-disp">' + todayStr() + '</span><button class="mini-btn" id="lm-date-pick">选择日期</button></div>' +
      '<textarea id="lm-content" placeholder="内容"></textarea>' +
      '<button class="mini-btn" id="lm-new">添加</button></div>';
  }

  /* ============ 贴心整理台：自然语言 → 待办清单 ============ */
  // 解析器：返回 [{text, date, time, priority, source}]
  function parseTasksFromText(text, base) {
    base = base || todayStr();
    var raw = String(text || "").replace(/\r/g, "");
    // 1. 先按中英文/数字标点断成候选句子
    var segs = raw.split(/[\n。；;！!？?\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    // 若是长段落没有断句符，按「，、」和「要/得/记得/去/把」等动词粗略切
    if (segs.length <= 1 && raw.length > 12) {
      segs = raw.split(/[，,、]/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 2; });
    }
    var tasks = [];
    var DATE_WORDS = [
      { re: /大后天/, off: 3 }, { re: /后天/, off: 2 }, { re: /明天|明日/, off: 1 },
      { re: /今天|今日/, off: 0 }, { re: /周一|星期一/, wd: 1 }, { re: /周二|星期二/, wd: 2 },
      { re: /周三|星期三|周3/, wd: 3 }, { re: /周四|星期四/, wd: 4 }, { re: /周五|星期五/, wd: 5 },
      { re: /周六|星期六/, wd: 6 }, { re: /周日|星期天|周天|星期日/, wd: 0 },
      { re: /下周一|下星期一/, wd: 1, next: true }, { re: /下周二|下星期二/, wd: 2, next: true },
      { re: /下周三|下星期三/, wd: 3, next: true }, { re: /下周四|下星期四/, wd: 4, next: true },
      { re: /下周五|下星期五/, wd: 5, next: true }, { re: /下周六|下星期六/, wd: 6, next: true },
      { re: /下周日|下星期天|下周日/, wd: 0, next: true }
    ];
    function weekdayDate(wd, nextWeek) {
      var now = new Date(); var cur = now.getDay(); var target = wd;
      var diff = (target - cur + 7) % 7; if (diff === 0) diff = 7; if (nextWeek) diff += 7;
      return addDays(base, diff);
    }
    var MONTH_RE = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/;
    var TIME_RE = /(\d{1,2})\s*[:：点]\s*(\d{1,2})?\s*分?|(\d{1,2})\s*点|早上\s*(\d{1,2})|上午\s*(\d{1,2})|中午\s*(\d{1,2})|下午\s*(\d{1,2})|晚上\s*(\d{1,2})|凌晨\s*(\d{1,2})|(\d{1,2})\s*[点時]\s*半/;
    var IMPORTANT_RE = /重要|关键|核心|千万别忘|一定要|记得|别忘|必须|务必|尽快|优先|不可忽视|不容小觑/;
    var URGENT_RE = /紧急|马上|立刻|赶紧|赶快|立马|速速|刻不容缓|迫在眉睫|立即|即刻/;
    function cleanTask(s) {
      return s.replace(/^(然后|还有|另外|再|要|得|记得|去|把|请|帮我|我想|我要|需要|应该|最好|尽量)/, "")
              .replace(/(呢|吧|啊|呀|哦|哈|啦|嘛|咯|诶|呃)$/, "").trim();
    }
    segs.forEach(function (seg) {
      // 过滤掉纯连接词/太短的无效段
      if (seg.length < 2) return;
      if (/^(然后|还有|另外|再|和|跟|以及|并且|而且|所以|但是|不过|如果|要是)$/.test(seg)) return;
      var task = { text: "", date: null, time: null, priority: "ninu", source: seg };
      // 日期
      var found = false;
      for (var i = 0; i < DATE_WORDS.length; i++) {
        if (DATE_WORDS[i].re.test(seg)) { task.date = DATE_WORDS[i].next ? weekdayDate(DATE_WORDS[i].wd, true) : (DATE_WORDS[i].wd != null ? weekdayDate(DATE_WORDS[i].wd, false) : addDays(base, DATE_WORDS[i].off)); found = true; break; }
      }
      if (!found) {
        var mm = seg.match(MONTH_RE);
        if (mm) { var cy = new Date().getFullYear(); task.date = pad2(cy) + "-" + pad2(+mm[1]) + "-" + pad2(+mm[2]); }
      }
      // 时间
      var tm = seg.match(TIME_RE);
      if (tm) {
        var h = null, m = 0;
        if (tm[1] != null) { h = +tm[1]; m = tm[2] != null ? +tm[2] : 0; }
        else if (tm[3] != null) { h = +tm[3]; }
        else if (tm[4] != null) { h = +tm[4]; }
        else if (tm[5] != null) { h = +tm[5]; }
        else if (tm[6] != null) { h = +tm[6]; }
        else if (tm[7] != null) { h = +tm[7] + 12; }
        else if (tm[8] != null) { h = +tm[8] + 12; }
        else if (tm[9] != null) { h = +tm[9] + 12; }
        else if (tm[10] != null) { h = +tm[10]; m = 30; }
        if (h != null) { if (h >= 24) h = 23; task.time = pad2(h) + ":" + pad2(m); }
      }
      // 优先级：按重要 × 紧急 两个维度判断四象限
      var isImportant = IMPORTANT_RE.test(seg);
      var isUrgent = URGENT_RE.test(seg);
      task.priority = priorityFromFlags(isImportant, isUrgent);
      task.text = cleanTask(seg);
      if (task.text.length >= 2) tasks.push(task);
    });
    // 去重（同文本）
    var seen = {};
    tasks = tasks.filter(function (t) { if (seen[t.text]) return false; seen[t.text] = 1; return true; });
    return tasks;
  }
  function sortMommyTasks(tasks) {
    var prRank = { iu: 0, inu: 1, niu: 2, ninu: 3 };
    tasks.sort(function (a, b) {
      if (a.date && b.date) { var c = ymdCmp(a.date, b.date); if (c) return c; }
      else if (a.date) return -1;
      else if (b.date) return 1;
      if (prRank[a.priority] !== prRank[b.priority]) return prRank[a.priority] - prRank[b.priority];
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  }
  function renderMommyTaskRow(t, i) {
    var p = MEMO_PRIORITY.filter(function (x) { return x.key === t.priority; })[0] || MEMO_PRIORITY[0];
    var when = t.date ? formatChineseDate(t.date) : "未选日期";
    var timeVal = t.time || "";
    return '<div class="mommy-task ' + p.cls + '" data-ti="' + i + '">' +
      '<span class="mommy-dot"></span>' +
      '<div class="mommy-task-body">' +
        '<input class="mommy-task-text" data-ti="' + i + '" value="' + esc(t.text) + '">' +
        '<div class="mommy-task-meta">' +
          '<span class="date-disp mommy-task-date" data-ti="' + i + '">' + esc(when) + '</span>' +
          '<button class="mini-btn mommy-date-pick" data-ti="' + i + '">改日期</button>' +
          '<input type="time" class="mommy-task-time" data-ti="' + i + '" value="' + esc(timeVal) + '">' +
          '<select class="mommy-task-priority" data-ti="' + i + '">' +
            MEMO_PRIORITY.map(function (x) { return '<option value="' + x.key + '"' + (x.key === p.key ? " selected" : "") + '>' + x.name + '</option>'; }).join("") +
          '</select>' +
          '<button class="mini-btn danger mommy-task-del" data-ti="' + i + '">删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function renderMommyResult(box, tasks) {
    if (!tasks.length) { box.innerHTML = '<div class="mommy-bubble">' + esc(mommyReply([])) + '</div>'; return; }
    box.innerHTML = '<div class="mommy-bubble">' + esc(mommyReply(tasks)).replace(/\n/g, "<br>") + '</div>' +
      '<div class="mommy-tasks">' + tasks.map(renderMommyTaskRow).join("") + '</div>' +
      '<button class="btn-primary" id="mommy-save">收进我的待办清单</button>';
    box.querySelectorAll(".mommy-task-text").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var idx = +this.getAttribute("data-ti"); tasks[idx].text = this.value.trim() || tasks[idx].text;
      });
    });
    box.querySelectorAll(".mommy-date-pick").forEach(function (b) {
      b.onclick = function () {
        var idx = +this.getAttribute("data-ti");
        openDatePicker({ mode: "single", value: tasks[idx].date || todayStr(), onConfirm: function (d) {
          tasks[idx].date = d;
          var dateSpan = box.querySelector('.mommy-task-date[data-ti="' + idx + '"]');
          if (dateSpan) dateSpan.textContent = formatChineseDate(d);
        } });
      };
    });
    box.querySelectorAll(".mommy-task-time").forEach(function (inp) {
      inp.addEventListener("change", function () { tasks[+this.getAttribute("data-ti")].time = this.value || null; });
    });
    box.querySelectorAll(".mommy-task-priority").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var idx = +this.getAttribute("data-ti"); tasks[idx].priority = this.value;
        var row = box.querySelector('.mommy-task[data-ti="' + idx + '"]');
        if (row) { row.className = row.className.replace(/priority-\w+/g, ""); row.classList.add("priority-" + this.value); }
      });
    });
    box.querySelectorAll(".mommy-task-del").forEach(function (b) {
      b.onclick = function () {
        var idx = +this.getAttribute("data-ti");
        if (!confirm("删除这条整理结果？")) return;
        tasks.splice(idx, 1);
        renderMommyResult(box, tasks);
      };
    });
    $("mommy-save").onclick = function () {
      if (!tasks.length) return;
      if (!confirm("我把这 " + tasks.length + " 件事存成你的待办清单，可以吗？")) return;
      tasks.forEach(function (t) {
        Store.data.life.memo.unshift({ id: uid(), title: t.text, content: t.time ? ("⏰ " + t.time) : "", date: t.date || todayStr(), priority: t.priority, items: [] });
      });
      Store.save(); renderLifeMain(); renderHome();
      toast("已经帮你收好啦 💕");
      box.innerHTML = "";
    };
  }
  // 甜宠口吻回复（男朋友式引导：温柔夸奖、不爹味、不动物形象、不肉麻）
  function mommyReply(tasks) {
    if (!tasks.length) return "你好像还没写要做什么～不急，想到了随时跟我说。";
    var iu = tasks.filter(function (t) { return t.priority === "iu"; }).length;
    var dated = tasks.filter(function (t) { return t.date; }).length;
    var pet = Math.random() > 0.5 ? "乖小孩" : "宝贝";
    var lines = [];
    var opens = [
      pet + "，我帮你理了一下，一共 " + tasks.length + " 件事。",
      "好，一共 " + tasks.length + " 件，已经按时间和轻重缓急排好啦。" + pet + "别慌。",
      "整理好了，总共 " + tasks.length + " 件，不复杂，我们一件件来。"
    ];
    lines.push(opens[Math.floor(Math.random() * opens.length)]);
    if (iu) lines.push("有 " + iu + " 件既重要又紧急的，建议你先做掉，压力会小很多。");
    if (dated === tasks.length) lines.push("每件都有日期，你照着顺序勾就行。");
    else if (dated) lines.push("有 " + dated + " 件定了时间，剩下的你可以自己安排。");
    else lines.push("这些事还没定具体时间，你随心安排就好。");
    var closes = [
      "能把事情都摊开说，挺棒的。慢慢来，我陪着你。",
      "别担心，有我在呢。做完一件就夸你一次。",
      "先动起来就好，" + pet + "最厉害了。"
    ];
    lines.push(closes[Math.floor(Math.random() * closes.length)]);
    return lines.join("\n");
  }
  function openMemoColorSettings() {
    var cols = (Store.data.settings.memoPriorityColors) || defaultMemoPriorityColors();
    var rows = MEMO_PRIORITY.map(function (p) {
      var hex = cols[p.key] || defaultMemoPriorityColors()[p.key];
      var hsv = hexToHsv(hex);
      return '<div class="memo-color-row" data-ck="' + p.key + '">' +
        '<div class="memo-color-name"><span class="memo-color-dot" style="background:' + hex + '"></span>' + esc(p.name) + '</div>' +
        '<div class="memo-color-inputs">' +
          '<div class="hex-row"><span>颜色代码</span><input type="text" class="mck-hex" data-ck="' + p.key + '" value="' + hex + '" maxlength="7"></div>' +
          '<div class="row"><span>色相</span><input type="range" class="mck-h" data-ck="' + p.key + '" min="0" max="359" value="' + hsv[0] + '"></div>' +
          '<div class="row"><span>饱和</span><input type="range" class="mck-s" data-ck="' + p.key + '" min="0" max="100" value="' + hsv[1] + '"></div>' +
          '<div class="row"><span>明度</span><input type="range" class="mck-v" data-ck="' + p.key + '" min="0" max="100" value="' + hsv[2] + '"></div>' +
        '</div>' +
      '</div>';
    }).join("");
    openModal('<h3>优先级颜色设置</h3>' +
      '<div class="memo-color-settings">' +
      '<p class="hint">四象限颜色可自由调整；颜色越柔和，备忘录卡片底色也越柔和。</p>' +
      rows +
      '<div class="form-actions"><button class="btn-secondary" id="mck-reset">恢复默认</button><button class="btn-secondary" id="mck-cancel">返回</button><button class="btn-primary" id="mck-ok">确定</button></div>' +
      '</div>');
    function updateOne(key) {
      var hexInput = document.querySelector('.mck-hex[data-ck="' + key + '"]');
      var h = +document.querySelector('.mck-h[data-ck="' + key + '"]').value;
      var s = +document.querySelector('.mck-s[data-ck="' + key + '"]').value;
      var v = +document.querySelector('.mck-v[data-ck="' + key + '"]').value;
      var hex = rgbToHex.apply(null, hsvToRgb(h, s, v));
      hexInput.value = hex;
      var dot = document.querySelector('.memo-color-row[data-ck="' + key + '"] .memo-color-dot');
      if (dot) dot.style.background = hex;
    }
    function setSlidersFromHex(key) {
      var input = document.querySelector('.mck-hex[data-ck="' + key + '"]');
      var parsed = parseHexInput(input.value);
      if (!parsed) { input.classList.add("invalid"); return; }
      input.classList.remove("invalid");
      var hsv = hexToHsv(parsed);
      document.querySelector('.mck-h[data-ck="' + key + '"]').value = hsv[0];
      document.querySelector('.mck-s[data-ck="' + key + '"]').value = hsv[1];
      document.querySelector('.mck-v[data-ck="' + key + '"]').value = hsv[2];
      updateOne(key);
    }
    MEMO_PRIORITY.forEach(function (p) {
      var key = p.key;
      ["mck-h", "mck-s", "mck-v"].forEach(function (cls) {
        document.querySelector('.' + cls + '[data-ck="' + key + '"]').addEventListener("input", function () { updateOne(key); });
      });
      document.querySelector('.mck-hex[data-ck="' + key + '"]').addEventListener("input", function () { setSlidersFromHex(key); });
      document.querySelector('.mck-hex[data-ck="' + key + '"]').addEventListener("change", function () { setSlidersFromHex(key); });
    });
    $("mck-reset").onclick = function () {
      Store.data.settings.memoPriorityColors = defaultMemoPriorityColors();
      Store.save(); applyMemoPriorityColors(); renderLifeMain(); renderHome(); closeModal();
    };
    $("mck-cancel").onclick = closeModal;
    $("mck-ok").onclick = function () {
      var newCols = {};
      var valid = true;
      MEMO_PRIORITY.forEach(function (p) {
        var parsed = parseHexInput(document.querySelector('.mck-hex[data-ck="' + p.key + '"]').value);
        if (!parsed) { valid = false; }
        else newCols[p.key] = parsed;
      });
      if (!valid) { toast("请检查颜色代码格式"); return; }
      Store.data.settings.memoPriorityColors = newCols;
      Store.save(); applyMemoPriorityColors(); renderLifeMain(); renderHome(); closeModal();
    };
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
      '<div class="form-actions"><button class="btn-secondary" id="af-cancel">返回</button><button class="btn-primary" id="af-save">保存</button></div>');
    var afDate = it ? it.date : todayStr();
    $("af-cancel").onclick = closeModal;
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

  /* ============ 穿衣提醒 / 云衣柜 ============ */
  function compressImageFile(file, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        try {
          var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          cb(cv.toDataURL("image/jpeg", 0.72));
        } catch (e) { cb(rd.result); }
      };
      img.onerror = function () { cb(rd.result); };
      img.src = rd.result;
    };
    rd.onerror = function () { cb(null); };
    rd.readAsDataURL(file);
  }
  function lifeWardrobeHtml() {
    return '<div class="wardrobe">' +
      '<p class="hint" style="margin:-6px 0 10px;">把衣物拍照收纳进来，按季节和类别整理，明年换季就能想起去年穿了啥。照片只存在本程序里，与手机相册无关。</p>' +
      '<div class="wf-filters">' +
        '<div class="wf-chip-row" id="wf-season-row"></div>' +
        '<div class="wf-chip-row" id="wf-cat-row"></div>' +
      '</div>' +
      '<div class="wf-actions"><button class="mini-btn" id="wf-tagman">标签管理</button></div>' +
      '<div class="wf-grid" id="wf-grid"></div>' +
      '<button class="btn-primary" id="wf-add">+ 添加衣物</button>' +
    '</div>';
  }
  function renderWardrobeFilters() {
    var sr = $("wf-season-row"); if (sr) {
      sr.innerHTML = "";
      var allS = document.createElement("button"); allS.className = "wf-chip" + (!state.wardrobeFilter.season ? " active" : ""); allS.textContent = "全部";
      allS.onclick = function () { state.wardrobeFilter.season = null; renderWardrobeFilters(); renderWardrobeGrid(); }; sr.appendChild(allS);
      SEASONS.forEach(function (s) {
        var b = document.createElement("button");
        b.className = "wf-chip" + (state.wardrobeFilter.season === s[0] ? " active" : "") + (s[0] === currentSeason() ? " cur" : "");
        b.textContent = s[1] + (s[0] === currentSeason() ? " ·今" : "");
        b.onclick = function () { state.wardrobeFilter.season = s[0]; renderWardrobeFilters(); renderWardrobeGrid(); }; sr.appendChild(b);
      });
    }
    var cr = $("wf-cat-row"); if (cr) {
      cr.innerHTML = "";
      var allC = document.createElement("button"); allC.className = "wf-chip" + (!state.wardrobeFilter.category ? " active" : ""); allC.textContent = "全部";
      allC.onclick = function () { state.wardrobeFilter.category = null; renderWardrobeFilters(); renderWardrobeGrid(); }; cr.appendChild(allC);
      WCATS.forEach(function (c) {
        var b = document.createElement("button"); b.className = "wf-chip" + (state.wardrobeFilter.category === c[0] ? " active" : ""); b.textContent = c[1];
        b.onclick = function () { state.wardrobeFilter.category = c[0]; renderWardrobeFilters(); renderWardrobeGrid(); }; cr.appendChild(b);
      });
    }
  }
  function renderWardrobeGrid() {
    var grid = $("wf-grid"); if (!grid) return;
    var f = state.wardrobeFilter;
    var items = Store.data.life.wardrobe.items.filter(function (it) {
      if (f.season && it.season !== f.season) return false;
      if (f.category && it.category !== f.category) return false;
      return true;
    });
    grid.innerHTML = "";
    if (!items.length) { grid.innerHTML = '<p class="hint" style="background:none;box-shadow:none;text-align:center;padding:24px 0;">该分类下暂无衣物，点下方“添加衣物”开始收纳吧</p>'; return; }
    items.forEach(function (it) {
      var card = document.createElement("div"); card.className = "wf-card"; card.setAttribute("data-id", it.id);
      var seasonName = (SEASONS.filter(function (s) { return s[0] === it.season; })[0] || [])[1] || "";
      var catName = (WCATS.filter(function (c) { return c[0] === it.category; })[0] || [])[1] || "";
      var img = it.photo ? '<img class="wf-photo" src="' + it.photo + '" alt="' + esc(it.type) + '">' : '<div class="wf-photo wf-noimg">无图</div>';
      card.innerHTML = img + '<div class="wf-cap">' + esc(it.type) + '</div>' +
        '<div class="wf-badges"><span class="wf-badge">' + seasonName + '</span><span class="wf-badge">' + catName + '</span></div>';
      card.onclick = function () { showWardrobeForm(it.id); };
      grid.appendChild(card);
    });
  }
  function showWardrobeForm(editId) {
    var W = Store.data.life.wardrobe;
    var it = editId ? W.items.filter(function (x) { return x.id === editId; })[0] : null;
    openModal('<h3>' + (it ? "编辑衣物" : "添加衣物") + '</h3>' +
      '<div class="row"><label>照片</label><input type="file" id="wf-photo" accept="image/*" capture="environment"></div>' +
      '<img id="wf-prev" class="wf-prev' + (it && it.photo ? "" : " hidden") + '" src="' + (it && it.photo ? it.photo : "") + '">' +
      '<div class="row"><label>季节</label><select id="wf-season">' + SEASONS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="row"><label>类别</label><select id="wf-cat">' + WCATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="row"><label>类型</label><select id="wf-type"></select><input id="wf-newtype" placeholder="或输入新类型（如：卫衣）" style="margin-top:6px;"></div>' +
      '<textarea id="wf-note" placeholder="备注（颜色、尺码、购买时间…）">' + (it ? esc(it.note) : "") + '</textarea>' +
      (it ? '<button class="mini-btn danger" id="wf-del" style="margin-bottom:10px;">删除这件衣物</button>' : '') +
      '<div class="form-actions"><button class="btn-secondary" id="wf-cancel">返回</button><button class="btn-primary" id="wf-save">保存</button></div>');
    if (it) { $("wf-season").value = it.season; $("wf-cat").value = it.category; }
    $("wf-cancel").onclick = closeModal;
    function updateTypes() {
      var cat = $("wf-cat").value, season = $("wf-season").value;
      var opts = (W.tags[cat] && W.tags[cat][season]) || [];
      var sel = $("wf-type"); sel.innerHTML = "";
      opts.forEach(function (t) { var o = document.createElement("option"); o.value = t; o.textContent = t; sel.appendChild(o); });
    }
    $("wf-season").onchange = updateTypes; $("wf-cat").onchange = updateTypes; updateTypes();
    if (it && it.type) {
      var sel = $("wf-type");
      var match = Array.prototype.some.call(sel.options, function (o) { return o.value === it.type; });
      if (match) sel.value = it.type; else $("wf-newtype").value = it.type;
    }
    var pendingPhoto = it ? it.photo : null;
    $("wf-photo").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      compressImageFile(f, function (data) {
        if (data) { pendingPhoto = data; var pv = $("wf-prev"); pv.src = data; pv.classList.remove("hidden"); }
        else toast("图片读取失败");
      });
    });
    if (it) $("wf-del").onclick = function () {
      if (!confirm("删除这件衣物？")) return;
      W.items = W.items.filter(function (x) { return x.id !== it.id; });
      Store.save(); closeModal(); renderWardrobeGrid(); toast("已删除");
    };
    $("wf-save").onclick = function () {
      var season = $("wf-season").value, cat = $("wf-cat").value;
      var type = $("wf-newtype").value.trim() || $("wf-type").value;
      if (!type) { toast("请选择或输入类型"); return; }
      if (!pendingPhoto) { toast("请先选一张照片（拍照或相册）"); return; }
      if (!W.tags[cat]) W.tags[cat] = { spring: [], summer: [], autumn: [], winter: [] };
      if (!W.tags[cat][season]) W.tags[cat][season] = [];
      if (W.tags[cat][season].indexOf(type) < 0) W.tags[cat][season].push(type);
      var obj = { id: it ? it.id : uid(), season: season, category: cat, type: type, photo: pendingPhoto, note: $("wf-note").value.trim(), created: it ? it.created : todayStr() };
      if (it) { var i = W.items.indexOf(it); W.items[i] = obj; } else W.items.unshift(obj);
      Store.save(); closeModal(); renderWardrobeFilters(); renderWardrobeGrid(); toast("已保存");
    };
  }
  function showWardrobeTagManager() {
    var W = Store.data.life.wardrobe;
    openModal('<h3>衣物类型标签管理</h3><div id="wtm-tree"></div>' +
      '<div class="tag-add-row"><select id="wtm-cat">' + WCATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select>' +
      '<select id="wtm-season">' + SEASONS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("") + '</select>' +
      '<input id="wtm-new" placeholder="新类型名"><button class="mini-btn" id="wtm-add">添加</button></div>' +
      '<button class="mini-btn" id="wtm-close" style="margin-top:10px;">关闭</button>');
    function draw() {
      var box = $("wtm-tree"); box.innerHTML = "";
      WCATS.forEach(function (cat) {
        var catH = document.createElement("div"); catH.className = "filter-cat"; catH.textContent = cat[1]; box.appendChild(catH);
        SEASONS.forEach(function (season) {
          var arr = (W.tags[cat[0]] && W.tags[cat[0]][season[0]]) || [];
          if (!arr.length && season[0] !== "winter") return;
          var subH = document.createElement("div"); subH.className = "filter-cat acc-subbranch"; subH.textContent = "　" + season[1]; box.appendChild(subH);
          arr.forEach(function (tag, idx) {
            var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0 4px 24px;";
            var span = document.createElement("span"); span.className = "tagpill"; span.textContent = tag;
            span.ondblclick = function () {
              var nv = prompt("修改类型名：", tag); if (!nv) return; nv = nv.trim(); if (!nv) return;
              var i = arr.indexOf(tag); if (i >= 0) arr[i] = nv;
              W.items.forEach(function (it) { if (it.category === cat[0] && it.season === season[0] && it.type === tag) it.type = nv; });
              Store.save(); draw(); renderWardrobeGrid();
            };
            var up = document.createElement("button"); up.className = "mini-btn"; up.textContent = "▲"; if (idx === 0) up.disabled = true;
            up.onclick = function () { if (idx > 0) { var t = arr[idx]; arr[idx] = arr[idx - 1]; arr[idx - 1] = t; Store.save(); draw(); } };
            var down = document.createElement("button"); down.className = "mini-btn"; down.textContent = "▼"; if (idx === arr.length - 1) down.disabled = true;
            down.onclick = function () { if (idx < arr.length - 1) { var t = arr[idx]; arr[idx] = arr[idx + 1]; arr[idx + 1] = t; Store.save(); draw(); } };
            var del = document.createElement("button"); del.className = "mini-btn danger"; del.textContent = "×";
            del.onclick = function () { arr.splice(idx, 1); W.items.forEach(function (it) { if (it.category === cat[0] && it.season === season[0] && it.type === tag) it.type = ""; }); Store.save(); draw(); renderWardrobeGrid(); };
            row.appendChild(span); row.appendChild(up); row.appendChild(down); row.appendChild(del); box.appendChild(row);
          });
        });
      });
    }
    draw();
    $("wtm-add").onclick = function () {
      var cat = $("wtm-cat").value, season = $("wtm-season").value, v = $("wtm-new").value.trim();
      if (!v) return;
      if (!W.tags[cat]) W.tags[cat] = { spring: [], summer: [], autumn: [], winter: [] };
      if (!W.tags[cat][season]) W.tags[cat][season] = [];
      if (W.tags[cat][season].indexOf(v) < 0) { W.tags[cat][season].push(v); Store.save(); $("wtm-new").value = ""; draw(); renderWardrobeFilters(); }
    };
    $("wtm-close").onclick = closeModal;
  }
  function bindWardrobeHandlers() {
    renderWardrobeFilters(); renderWardrobeGrid();
    $("wf-add").onclick = function () { showWardrobeForm(null); };
    $("wf-tagman").onclick = showWardrobeTagManager;
  }

  /* ============ 旅游计划 ============ */
  function packCatName(key) { return (PACK_CATS.filter(function (c) { return c[0] === key; })[0] || [])[1] || key; }
  function curTrip() { var T = Store.data.life.travel; return T && T.trips ? T.trips.filter(function (t) { return t.id === state.travelSel; })[0] || null : null; }
  function allSpotNames(trip) {
    var arr = [];
    (trip.days || []).forEach(function (d) { (d.spots || []).forEach(function (s) { if (s.name) arr.push(s.name); }); });
    return arr;
  }
  function gaodeUrl(from, to, mode) {
    mode = mode || "walk";
    var f = encodeURIComponent(from || ""), t = encodeURIComponent(to || "");
    return "https://uri.amap.com/navigation?to=,," + t + "&from=,," + f + "&mode=" + mode + "&callnative=1";
  }
  function lifeTravelHtml() {
    return '<div class="layout acc-layout" id="travel-layout">' +
      '<nav class="side-nav acc-nav" id="travel-nav"><button class="fold-btn" id="travel-fold">‹</button><div class="nav-scroll" id="travel-trips"></div><button class="mini-btn" id="travel-add-trip" style="margin:8px 10px 12px;">+ 新建旅行</button></nav>' +
      '<div class="main-work acc-main" id="travel-main"><p class="hint">从左侧选择或新建旅行计划</p></div>' +
      '</div>';
  }
  function renderTravelNav() {
    var box = $("travel-trips"); if (!box) return;
    box.innerHTML = "";
    var T = Store.data.life.travel;
    var h = document.createElement("div"); h.className = "nav-cat"; h.textContent = "目的地"; box.appendChild(h);
    (T.trips || []).forEach(function (t) {
      var item = document.createElement("div");
      item.className = "travel-trip-item";
      var b = document.createElement("button");
      b.className = "nav-mod" + (state.travelSel === t.id ? " active" : "");
      b.setAttribute("data-tid", t.id || "");
      b.textContent = esc(t.name);
      b.onclick = function () { state.travelSel = t.id; renderTravelNav(); renderTravelMain(); };
      var del = document.createElement("button");
      del.className = "trip-del-btn";
      del.setAttribute("aria-label", "删除");
      del.setAttribute("data-del", t.id);
      del.textContent = "×";
      del.onclick = function (e) { e.stopPropagation(); if (!confirm("确定要删除旅行计划「" + t.name + "」吗？")) return; T.trips = T.trips.filter(function (x) { return x.id !== t.id; }); if (state.travelSel === t.id) state.travelSel = T.trips[0] ? T.trips[0].id : null; Store.save(); renderTravelNav(); renderTravelMain(); };
      item.appendChild(b); item.appendChild(del);
      box.appendChild(item);
    });
  }
  function renderTravelMain() {
    var box = $("travel-main"); if (!box) return;
    var trip = curTrip();
    if (!trip) { box.innerHTML = '<p class="hint">从左侧选择或新建旅行计划</p>'; return; }
    var html = '<div class="travel-trip">' +
      '<div class="travel-head">' +
        '<h3>' + esc(trip.name) + '</h3>' +
        '<span class="travel-dates">' + esc(trip.startDate || "") + (trip.endDate && trip.endDate !== trip.startDate ? " ～ " + esc(trip.endDate) : "") + '</span>' +
        '<button class="mini-btn" id="trip-edit">编辑行程</button>' +
      '</div>' +
      '<div class="sub-tabs travel-tabs">' +
        '<button class="sub' + (state.travelSub === "itinerary" ? " active" : "") + '" data-ts="itinerary">日程</button>' +
        '<button class="sub' + (state.travelSub === "food" ? " active" : "") + '" data-ts="food">美食</button>' +
        '<button class="sub' + (state.travelSub === "hotel" ? " active" : "") + '" data-ts="hotel">酒店</button>' +
        '<button class="sub' + (state.travelSub === "pack" ? " active" : "") + '" data-ts="pack">行李</button>' +
        '<button class="sub' + (state.travelSub === "laundry" ? " active" : "") + '" data-ts="laundry">换洗</button>' +
      '</div>' +
      '<div id="travel-body"></div>' +
      '</div>';
    box.innerHTML = html;
    $("trip-edit").onclick = function () { showTripForm(trip.id); };
    box.querySelectorAll(".travel-tabs .sub").forEach(function (b) { b.onclick = function () { state.travelSub = this.getAttribute("data-ts"); renderTravelMain(); }; });
    var body = $("travel-body");
    if (state.travelSub === "itinerary") body.innerHTML = travelItineraryHtml(trip);
    else if (state.travelSub === "food") body.innerHTML = travelFoodHtml(trip);
    else if (state.travelSub === "hotel") body.innerHTML = travelHotelHtml(trip);
    else if (state.travelSub === "pack") body.innerHTML = travelPackHtml(trip);
    else if (state.travelSub === "laundry") body.innerHTML = travelLaundryHtml(trip);
    bindTravelSubHandlers(trip);
  }
  function travelItineraryHtml(trip) {
    var days = trip.days || [];
    var html = '<p class="hint" style="margin:-4px 0 10px;">按天规划景点；每个景点可切换「全部/备注/交通」视图。景点卡片内各区块可长按/拖拽排序，景点可跨天拖拽调整。</p>';
    html += '<button class="mini-btn" id="ti-add-day" style="margin-bottom:12px;">+ 添加日程</button>';
    if (!days.length) return html + '<p class="hint">还没有日程，先添加一天吧</p>';
    var tabs = '<button class="spot-tab' + (state.spotViewMode === "all" ? " active" : "") + '" data-sv="all">全部</button>' +
               '<button class="spot-tab' + (state.spotViewMode === "note" ? " active" : "") + '" data-sv="note">备注</button>' +
               '<button class="spot-tab' + (state.spotViewMode === "traffic" ? " active" : "") + '" data-sv="traffic">交通</button>';
    days.forEach(function (d, di) {
      html += '<div class="travel-day" data-di="' + di + '">' +
        '<div class="day-title"><b>第 ' + (di + 1) + ' 天</b><span>' + esc(d.date || "未填日期") + '</span><button class="mini-btn" data-addspot="' + di + '">+ 景点</button></div>' +
        '<div class="day-spots" data-di="' + di + '">';
      (d.spots || []).forEach(function (s, si) {
        html += renderSpotCard(s, di, si, tabs);
      });
      html += '</div></div>';
      if (di < days.length - 1) {
        var nt = d.nextTransfer || {};
        html += '<div class="day-transfer" data-di="' + di + '">' +
          '<div class="dt-title">第 ' + (di + 1) + ' 天 → 第 ' + (di + 2) + ' 天 重要交通</div>' +
          (nt.type ? '<div class="dt-body">' + esc(nt.type) + ' · ' + esc(nt.info || "") + '</div>' +
                     '<div class="dt-time">日期：' + esc(nt.date || "?") + '</div>' +
                     '<div class="dt-time">时间：' + esc(nt.time || "?") + '</div>' +
                     '<div class="dt-time">建议提前到：<br>' + esc(nt.departTime || "?") + '</div>' : '<div class="dt-body">未记录</div>') +
          '<button class="mini-btn" data-dt="' + di + '">' + (nt.type ? "编辑" : "+ 添加交通") + '</button>' +
          '</div>';
      }
    });
    return html;
  }
  function travelFoodHtml(trip) {
    var foods = trip.foods || [];
    var html = '<p class="hint" style="margin:-4px 0 10px;">记录景区周边美食、地方特色与要买的特产。</p>' +
      '<button class="mini-btn" id="tf-add" style="margin-bottom:12px;">+ 添加美食/特产</button>';
    if (!foods.length) return html + '<p class="hint">还没有记录</p>';
    var kinds = { nearby: "周边美食", specialty: "特色美食", souvenir: "特产" };
    foods.forEach(function (f, i) {
      html += '<div class="travel-food" data-fi="' + i + '">' +
        '<div class="food-title">' + esc(f.name || "未命名") + '<span class="wf-badge">' + (kinds[f.kind] || f.kind) + '</span></div>' +
        (f.spotName ? '<div class="spot-meta">关联景点：' + esc(f.spotName) + '</div>' : "") +
        (f.note ? '<div class="spot-body">' + esc(f.note) + '</div>' : "") +
        '<div class="spot-actions"><button class="mini-btn" data-editfood="' + i + '">编辑</button><button class="mini-btn danger" data-delfood="' + i + '">删除</button></div>' +
        '</div>';
    });
    return html;
  }
  function travelHotelHtml(trip) {
    var hotels = trip.hotels || [];
    var html = '<p class="hint" style="margin:-4px 0 10px;">按行程添加酒店，标注地点与居住时间段。</p>' +
      '<button class="mini-btn" id="th-add" style="margin-bottom:12px;">+ 添加酒店</button>';
    if (!hotels.length) return html + '<p class="hint">还没有酒店记录</p>';
    hotels.forEach(function (h, i) {
      html += '<div class="travel-hotel" data-hi="' + i + '">' +
        '<div class="food-title">' + esc(h.name || "未命名") + '</div>' +
        '<div class="spot-meta">' + esc(h.location || "未填地点") + " · " + esc(h.startDate || "?") + " ～ " + esc(h.endDate || "?") + '</div>' +
        (h.note ? '<div class="spot-body">' + esc(h.note) + '</div>' : "") +
        '<div class="spot-actions"><button class="mini-btn" data-edithotel="' + i + '">编辑</button><button class="mini-btn danger" data-delhotel="' + i + '">删除</button></div>' +
        '</div>';
    });
    return html;
  }
  function travelPackHtml(trip) {
    var tags = trip.packTags || [];
    var html = '<p class="hint" style="margin:-4px 0 10px;">出行前勾选要带的东西；去往下一站或返程时再用它做检查。</p>' +
      '<div class="pack-progress">已准备 <b id="pack-checked">0</b>/' + tags.length + '</div>' +
      '<div class="pack-actions" style="margin-bottom:12px;"><button class="mini-btn" id="tp-add">+ 新增物品</button><button class="mini-btn" id="tp-reset">全部未勾选</button></div>';
    PACK_CATS.forEach(function (c) {
      var list = tags.filter(function (t) { return t.cat === c[0]; });
      if (!list.length) return;
      html += '<div class="pack-group"><div class="filter-cat">' + c[1] + '</div>';
      list.forEach(function (t, i) {
        html += '<label class="pack-item"><input type="checkbox" data-pid="' + t.id + '"' + (t.checked ? " checked" : "") + '><span>' + esc(t.name) + '</span></label>';
      });
      html += '</div>';
    });
    return html;
  }
  function travelLaundryHtml(trip) {
    var laundry = trip.laundry || [];
    var html = '<p class="hint" style="margin:-4px 0 10px;">旧内衣等用完即丢的衣物：记录更换日期与丢弃日期，照片存在程序内，删本地相册不影响。</p>' +
      '<button class="mini-btn" id="tl-add" style="margin-bottom:12px;">+ 添加衣物</button>';
    if (!laundry.length) return html + '<p class="hint">还没有换洗衣物记录</p>';
    html += '<div class="wf-grid">';
    laundry.forEach(function (it, i) {
      var wear = it.wearDate || it.date || "";
      var discard = it.discardDate || "";
      var dateRange = wear + (discard ? " ~ " + discard : " 起");
      var img = it.photo ? '<img class="wf-photo" src="' + it.photo + '">' : '<div class="wf-photo wf-noimg">无图</div>';
      html += '<div class="wf-card" data-li="' + i + '">' + img +
        '<div class="wf-cap">' + esc(it.name || "衣物") + '</div>' +
        '<div class="wf-badges"><span class="wf-badge">' + esc(dateRange) + '</span></div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }
  function bindTravelSubHandlers(trip) {
    if (state.travelSub === "itinerary") {
      $("ti-add-day").onclick = function () { showDayForm(trip); };
      $("travel-body").querySelectorAll("[data-addspot]").forEach(function (b) { b.onclick = function () { showSpotForm(trip, +this.getAttribute("data-addspot")); }; });
      $("travel-body").querySelectorAll("[data-editspot]").forEach(function (b) { b.onclick = function () { var p = this.getAttribute("data-editspot").split("-"); showSpotForm(trip, +p[0], +p[1]); }; });
      $("travel-body").querySelectorAll("[data-delspot]").forEach(function (b) { b.onclick = function () { var p = this.getAttribute("data-delspot").split("-"); if (!confirm("删除这个景点？")) return; trip.days[+p[0]].spots.splice(+p[1], 1); Store.save(); renderTravelMain(); }; });
      $("travel-body").querySelectorAll("[data-gaode]").forEach(function (b) { b.onclick = function () { var url = gaodeUrl(this.getAttribute("data-from"), this.getAttribute("data-to")); window.open(url, "_blank"); }; });
      $("travel-body").querySelectorAll(".spot-tab").forEach(function (b) { b.onclick = function () { state.spotViewMode = this.getAttribute("data-sv"); renderTravelMain(); }; });
      $("travel-body").querySelectorAll("[data-dt]").forEach(function (b) { b.onclick = function () { showDayTransferForm(trip, +this.getAttribute("data-dt")); }; });
      $("travel-body").querySelectorAll(".travel-spot").forEach(function (el) { bindSpotDrag(el, trip); });
      $("travel-body").querySelectorAll(".travel-spot").forEach(function (el) { bindSpotSectionDrag(el, trip, +el.getAttribute("data-di"), +el.getAttribute("data-si")); });
      setupTravelDropZones(trip);
    } else if (state.travelSub === "food") {
      $("tf-add").onclick = function () { showFoodForm(trip); };
      $("travel-body").querySelectorAll("[data-editfood]").forEach(function (b) { b.onclick = function () { showFoodForm(trip, +this.getAttribute("data-editfood")); }; });
      $("travel-body").querySelectorAll("[data-delfood]").forEach(function (b) { b.onclick = function () { if (!confirm("删除？")) return; trip.foods.splice(+this.getAttribute("data-delfood"), 1); Store.save(); renderTravelMain(); }; });
    } else if (state.travelSub === "hotel") {
      $("th-add").onclick = function () { showHotelForm(trip); };
      $("travel-body").querySelectorAll("[data-edithotel]").forEach(function (b) { b.onclick = function () { showHotelForm(trip, +this.getAttribute("data-edithotel")); }; });
      $("travel-body").querySelectorAll("[data-delhotel]").forEach(function (b) { b.onclick = function () { if (!confirm("删除？")) return; trip.hotels.splice(+this.getAttribute("data-delhotel"), 1); Store.save(); renderTravelMain(); }; });
    } else if (state.travelSub === "pack") {
      var tags = trip.packTags || [];
      var checked = tags.filter(function (t) { return t.checked; }).length;
      $("pack-checked").textContent = checked;
      $("tp-add").onclick = function () { showPackTagForm(trip); };
      $("tp-reset").onclick = function () { tags.forEach(function (t) { t.checked = false; }); Store.save(); renderTravelMain(); };
      $("travel-body").querySelectorAll("[data-pid]").forEach(function (cb) { cb.onchange = function (e) { var el = e && e.target || this; var t = tags.filter(function (x) { return x.id === el.getAttribute("data-pid"); })[0]; if (t) { t.checked = el.checked; Store.save(); $("pack-checked").textContent = tags.filter(function (x) { return x.checked; }).length; } }; });
    } else if (state.travelSub === "laundry") {
      $("tl-add").onclick = function () { showLaundryForm(trip); };
      $("travel-body").querySelectorAll(".wf-card").forEach(function (c) { c.onclick = function () { showLaundryForm(trip, +this.getAttribute("data-li")); }; });
    }
  }
  function bindSpotSectionDrag(cardEl, trip, di, si) {
    var secs = cardEl.querySelectorAll(".spot-sec");
    var spot = trip.days[di].spots[si];
    if (!spot.sectionOrder) spot.sectionOrder = ["open", "note", "prevTraffic", "nextTraffic", "gaode"];
    var dragSec = null, dragK = null, touchTimer = null, ghost = null;
    secs.forEach(function (sec) {
      sec.addEventListener("dragstart", function (e) {
        dragSec = sec; dragK = sec.getAttribute("data-sec");
        sec.classList.add("dragging");
        e.dataTransfer.setData("text/plain", "sec:" + dragK);
        e.dataTransfer.effectAllowed = "move";
      });
      sec.addEventListener("dragend", function () { sec.classList.remove("dragging"); dragSec = null; dragK = null; });
      sec.addEventListener("dragover", function (e) { e.preventDefault(); sec.classList.add("dragover"); });
      sec.addEventListener("dragleave", function () { sec.classList.remove("dragover"); });
      sec.addEventListener("drop", function (e) {
        e.preventDefault(); sec.classList.remove("dragover");
        var fromK = e.dataTransfer.getData("text/plain").replace("sec:", "");
        var toK = sec.getAttribute("data-sec");
        if (!fromK || fromK === toK) return;
        var order = spot.sectionOrder || ["open", "note", "prevTraffic", "nextTraffic", "gaode"];
        var fromI = order.indexOf(fromK), toI = order.indexOf(toK);
        if (fromI < 0 || toI < 0) return;
        order.splice(fromI, 1); order.splice(toI, 0, fromK);
        Store.save(); renderTravelMain();
      });
      // 手机长按
      sec.addEventListener("touchstart", function (e) {
        touchTimer = setTimeout(function () {
          dragK = sec.getAttribute("data-sec"); dragSec = sec;
          sec.classList.add("dragging");
          ghost = sec.cloneNode(true); ghost.classList.add("drag-ghost"); document.body.appendChild(ghost);
          var touch = e.touches[0]; positionGhost(ghost, touch.clientX, touch.clientY);
        }, 500);
      }, { passive: true });
      sec.addEventListener("touchmove", function (e) {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        if (!ghost) return;
        e.preventDefault();
        var touch = e.touches[0]; positionGhost(ghost, touch.clientX, touch.clientY);
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        var tsec = target && target.closest(".spot-sec");
        cardEl.querySelectorAll(".spot-sec").forEach(function (x) { x.classList.remove("dragover"); });
        if (tsec && tsec.closest(".travel-spot") === cardEl) tsec.classList.add("dragover");
      });
      sec.addEventListener("touchend", function (e) {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        if (!ghost || !dragK) { cleanupDrag(); return; }
        var touch = e.changedTouches[0];
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        var tsec = target && target.closest(".spot-sec");
        var toK = tsec && tsec.closest(".travel-spot") === cardEl ? tsec.getAttribute("data-sec") : null;
        cleanupDrag();
        if (toK && toK !== dragK) {
          var order = spot.sectionOrder || ["open", "note", "prevTraffic", "nextTraffic", "gaode"];
          var fromI = order.indexOf(dragK), toI = order.indexOf(toK);
          if (fromI >= 0 && toI >= 0) { order.splice(fromI, 1); order.splice(toI, 0, dragK); Store.save(); renderTravelMain(); }
        }
        dragK = null; dragSec = null;
      });
      function cleanupDrag() {
        if (ghost) { ghost.parentNode.removeChild(ghost); ghost = null; }
        if (dragSec) dragSec.classList.remove("dragging");
        cardEl.querySelectorAll(".spot-sec").forEach(function (x) { x.classList.remove("dragover"); });
      }
    });
  }
  function positionGhost(g, x, y) {
    g.style.position = "fixed"; g.style.left = (x - g.offsetWidth / 2) + "px"; g.style.top = (y - 20) + "px"; g.style.zIndex = 9999;
  }
  function bindSpotDrag(spotEl, trip) {
    var di = +spotEl.getAttribute("data-di"), si = +spotEl.getAttribute("data-si");
    var dragging = false, touchTimer = null, ghost = null;
    spotEl.addEventListener("dragstart", function (e) {
      dragging = true; spotEl.classList.add("dragging");
      e.dataTransfer.setData("text/plain", JSON.stringify({ di: di, si: si }));
      e.dataTransfer.effectAllowed = "move";
    });
    spotEl.addEventListener("dragend", function () { dragging = false; spotEl.classList.remove("dragging"); });
    spotEl.addEventListener("touchstart", function (e) {
      touchTimer = setTimeout(function () {
        dragging = true; spotEl.classList.add("dragging");
        ghost = spotEl.cloneNode(true); ghost.classList.add("drag-ghost"); document.body.appendChild(ghost);
        var touch = e.touches[0]; positionGhost(ghost, touch.clientX, touch.clientY);
      }, 600);
    }, { passive: true });
    spotEl.addEventListener("touchmove", function (e) {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      if (!ghost) return;
      e.preventDefault();
      var touch = e.touches[0]; positionGhost(ghost, touch.clientX, touch.clientY);
      document.querySelectorAll(".travel-spot, .day-spots").forEach(function (x) { x.classList.remove("dragover"); });
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      var tspot = target && target.closest(".travel-spot");
      if (tspot) tspot.classList.add("dragover");
      else { var tday = target && target.closest(".day-spots"); if (tday) tday.classList.add("dragover"); }
    });
    spotEl.addEventListener("touchend", function (e) {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      if (!ghost) return;
      var touch = e.changedTouches[0];
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      cleanup();
      var tspot = target && target.closest(".travel-spot");
      var tday = target && target.closest(".day-spots");
      var src = { di: di, si: si };
      if (tspot) {
        var tdi = +tspot.getAttribute("data-di"), tsi = +tspot.getAttribute("data-si");
        moveSpot(trip, src.di, src.si, tdi, tsi, "before");
      } else if (tday) {
        var tdi2 = +tday.getAttribute("data-di");
        moveSpot(trip, src.di, src.si, tdi2, null, "append");
      }
    });
    function cleanup() {
      if (ghost) { ghost.parentNode.removeChild(ghost); ghost = null; }
      spotEl.classList.remove("dragging");
      document.querySelectorAll(".travel-spot, .day-spots").forEach(function (x) { x.classList.remove("dragover"); });
    }
  }
  function moveSpot(trip, fromDi, fromSi, toDi, toSi, mode) {
    var fromDay = trip.days[fromDi], toDay = trip.days[toDi];
    var spot = fromDay.spots.splice(fromSi, 1)[0];
    if (!spot) return;
    if (mode === "append") toDay.spots.push(spot);
    else {
      var insertAt = toSi;
      if (fromDi === toDi && fromSi < toSi) insertAt--;
      toDay.spots.splice(insertAt, 0, spot);
    }
    Store.save(); renderTravelMain(); toast("已调整顺序");
  }
  function setupTravelDropZones(trip) {
    document.querySelectorAll(".travel-spot").forEach(function (el) {
      el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("dragover"); });
      el.addEventListener("dragleave", function () { el.classList.remove("dragover"); });
      el.addEventListener("drop", function (e) {
        e.preventDefault(); el.classList.remove("dragover");
        try {
          var src = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (src.di == null) return;
          var tdi = +el.getAttribute("data-di"), tsi = +el.getAttribute("data-si");
          moveSpot(trip, src.di, src.si, tdi, tsi, "before");
        } catch (err) {}
      });
    });
    document.querySelectorAll(".day-spots").forEach(function (el) {
      el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("dragover"); });
      el.addEventListener("dragleave", function () { el.classList.remove("dragover"); });
      el.addEventListener("drop", function (e) {
        e.preventDefault(); el.classList.remove("dragover");
        try {
          var src = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (src.di == null) return;
          moveSpot(trip, src.di, src.si, +el.getAttribute("data-di"), null, "append");
        } catch (err) {}
      });
    });
  }
  function showTripForm(editId) {
    var T = Store.data.life.travel;
    var trip = editId ? T.trips.filter(function (t) { return t.id === editId; })[0] : null;
    openModal('<h3>' + (trip ? "编辑旅行" : "新建旅行") + '</h3>' +
      '<input id="tf-name" placeholder="旅行名称 / 目的地" value="' + (trip ? esc(trip.name) : "") + '">' +
      '<div class="row"><label>开始日期</label><span id="tf-start-disp" class="date-disp">' + (trip && trip.startDate ? esc(trip.startDate) : "未选择") + '</span><button class="mini-btn" id="tf-start-pick">选择</button></div>' +
      '<div class="row"><label>结束日期</label><span id="tf-end-disp" class="date-disp">' + (trip && trip.endDate ? esc(trip.endDate) : "未选择") + '</span><button class="mini-btn" id="tf-end-pick">选择</button></div>' +
      '<textarea id="tf-note" placeholder="备注">' + (trip ? esc(trip.note || "") : "") + '</textarea>' +
      '<div class="form-actions"><button class="btn-secondary" id="tf-cancel">返回</button><button class="btn-primary" id="tf-save">保存</button></div>');
    var startDate = trip ? trip.startDate : "", endDate = trip ? trip.endDate : "";
    $("tf-cancel").onclick = closeModal;
    $("tf-start-pick").onclick = function () { openDatePicker({ mode: "single", value: startDate, onConfirm: function (d) { startDate = d; $("tf-start-disp").textContent = d; } }); };
    $("tf-end-pick").onclick = function () { openDatePicker({ mode: "single", value: endDate, onConfirm: function (d) { endDate = d; $("tf-end-disp").textContent = d; } }); };
    $("tf-save").onclick = function () {
      var name = $("tf-name").value.trim(); if (!name) { toast("请填写旅行名称"); return; }
      var obj = trip ? clone(trip) : { id: uid(), days: [], foods: [], hotels: [], packTags: clone(T.defaultPackTags || defaultTravelPackTags()).map(function (t) { return { id: uid(), name: t.name, cat: t.cat, checked: false }; }), laundry: [] };
      obj.name = name; obj.startDate = startDate; obj.endDate = endDate; obj.note = $("tf-note").value.trim();
      if (trip) { var i = T.trips.indexOf(trip); T.trips[i] = obj; } else { T.trips.unshift(obj); state.travelSel = obj.id; }
      Store.save(); closeModal(); renderTravelNav(); renderTravelMain(); toast("已保存");
    };
  }
  function showDayForm(trip) {
    openModal('<h3>添加日程</h3>' +
      '<div class="row"><label>日期</label><span id="td-date-disp" class="date-disp">' + (trip.startDate ? esc(trip.startDate) : "未选择") + '</span><button class="mini-btn" id="td-date-pick">选择</button></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="td-cancel">返回</button><button class="btn-primary" id="td-save">保存</button></div>');
    var date = trip.startDate || "";
    $("td-cancel").onclick = closeModal;
    $("td-date-pick").onclick = function () { openDatePicker({ mode: "single", value: date, onConfirm: function (d) { date = d; $("td-date-disp").textContent = d; } }); };
    $("td-save").onclick = function () {
      if (!date) { toast("请选择日期"); return; }
      if (!trip.days) trip.days = [];
      trip.days.push({ date: date, spots: [] });
      Store.save(); closeModal(); renderTravelMain(); toast("已添加日程");
    };
  }
  var SPOT_SECTIONS = {
    open: function (s) { return s.openTime ? '<div class="spot-meta">开放时间：' + esc(s.openTime) + '</div>' : ""; },
    note: function (s) { return s.note ? '<div class="spot-body">备注：' + esc(s.note) + '</div>' : ""; },
    prevTraffic: function (s) {
      var t = s.prevTransport || {};
      if (!t.type && !t.info) return "";
      var line = esc(t.type) + " " + esc(t.info || "");
      if (t.transfer && t.transferType) line += ' · 换乘：' + esc(t.transferType) + " " + esc(t.transferInfo || "");
      return '<div class="spot-traffic-prev"><span class="sec-label">从上一景点到此处</span><div>来：' + line + '</div></div>';
    },
    nextTraffic: function (s) {
      var t = s.nextTransport || {};
      if (!t.type && !t.info) return "";
      var line = esc(t.type) + " " + esc(t.info || "");
      if (t.transfer && t.transferType) line += ' · 换乘：' + esc(t.transferType) + " " + esc(t.transferInfo || "");
      return '<div class="spot-traffic-next"><span class="sec-label">从此处到下一景点</span><div>去：' + line + '</div></div>';
    },
    gaode: function (s) { return '<div class="spot-gaode"><button class="mini-btn" data-gaode data-from="' + esc(s.gaodeFrom || "") + '" data-to="' + esc(s.gaodeTo || s.name || "") + '">高德导航</button></div>'; },
    mapPhotos: function (s) {
      if (!s.mapPhotos || !s.mapPhotos.length) return "";
      return '<div class="spot-map-photos"><span class="sec-label">地图截图</span><div class="photos">' + s.mapPhotos.map(function(p){return '<img src="'+esc(p)+'">';}).join("")+'</div></div>';
    }
  };
  function renderSpotCard(s, di, si, tabs) {
    var view = state.spotViewMode || "all";
    var showAll = view === "all", showNote = view === "note" || showAll, showTraffic = view === "traffic" || showAll;
    var order = s.sectionOrder || ["open", "note", "prevTraffic", "nextTraffic", "gaode", "mapPhotos"];
    var secs = [];
    order.forEach(function (k) {
      if (k === "open" && !showAll) return;
      if (k === "note" && !showNote) return;
      if ((k === "prevTraffic" || k === "nextTraffic") && !showTraffic) return;
      var html = SPOT_SECTIONS[k](s);
      if (html) secs.push('<div class="spot-sec" data-sec="' + k + '" draggable="true">' +
        '<div class="drag-handle" title="长按或拖拽排序">⋮⋮</div>' + html + '</div>');
    });
    return '<div class="travel-spot" data-di="' + di + '" data-si="' + si + '" draggable="true">' +
      '<div class="spot-tabs">' + tabs + '</div>' +
      '<div class="spot-title">' + esc(s.name || "未命名景点") + '</div>' +
      '<div class="spot-sec-list">' + secs.join("") + '</div>' +
      '<div class="spot-actions">' +
        '<button class="mini-btn" data-editspot="' + di + "-" + si + '">编辑</button>' +
        '<button class="mini-btn danger" data-delspot="' + di + "-" + si + '">删除</button>' +
      '</div>' +
      '</div>';
  }
  function showSpotForm(trip, dayIdx, spotIdx) {
    var day = trip.days[dayIdx];
    var s = (spotIdx != null && day.spots[spotIdx]) ? day.spots[spotIdx] : null;
    var prevName = "";
    if (spotIdx != null && spotIdx > 0) prevName = day.spots[spotIdx - 1].name || "";
    else if (dayIdx > 0 && trip.days[dayIdx - 1].spots.length) prevName = trip.days[dayIdx - 1].spots[trip.days[dayIdx - 1].spots.length - 1].name || "";
    var emptySpot = { id: uid(), name: "", openTime: "", note: "", prevTransport: { type: "", info: "", transfer: false, transferType: "", transferInfo: "" }, nextTransport: { type: "", info: "", transfer: false, transferType: "", transferInfo: "" }, gaodeFrom: prevName, gaodeTo: "" };
    var it = s || emptySpot;
    if (!it.prevTransport) it.prevTransport = { type: "", info: "", transfer: false, transferType: "", transferInfo: "" };
    if (!it.nextTransport) it.nextTransport = { type: "", info: "", transfer: false, transferType: "", transferInfo: "" };
    // 旧数据兼容：旧字段 mapText/mapPhoto/hotSpots/hotPhotos/recs/recsHidden 保留读取但不再写入新字段
    if (s && s.note == null && s.hotSpots != null) it.note = s.hotSpots;
    var types = ["", "步行", "公交", "地铁", "出租车", "网约车", "景区大巴", "高铁", "飞机", "火车", "大巴", "其他"];
    function typeOpts(sel) { return types.map(function (t) { return '<option value="' + t + '"' + (sel === t ? " selected" : "") + '>' + (t || "请选择") + '</option>'; }).join(""); }
    openModal('<h3>' + (s ? "编辑景点" : "添加景点") + '</h3>' +
      '<input id="ts-name" placeholder="景点名称" value="' + esc(it.name) + '">' +
      '<div class="row"><label>开放时间</label><input id="ts-open" placeholder="如 08:30-17:00" value="' + esc(it.openTime) + '"></div>' +
      '<div class="row"><label>备注</label><textarea id="ts-note" placeholder="随手记：必吃美食 / 最佳机位 / 避坑提醒">' + esc(it.note) + '</textarea></div>' +
      '<div class="ts-section">' +
        '<div class="filter-cat">从上一景点到此处</div>' +
        '<div class="row"><label>交通类型</label><select id="ts-prev-type">' + typeOpts(it.prevTransport.type) + '</select></div>' +
        '<div class="row"><label>详细信息</label><input id="ts-prev-info" placeholder="公交 xxx路 / 地铁 x线" value="' + esc(it.prevTransport.info) + '"></div>' +
        '<label class="pack-item transfer-check" style="margin:6px 0;"><input type="checkbox" id="ts-prev-transfer"' + (it.prevTransport.transfer ? " checked" : "") + '><span>需要换乘</span></label>' +
        '<div class="row transfer-info-row"' + (it.prevTransport.transfer ? "" : " style=\"display:none\"") + '><label>换乘交通类型</label><select id="ts-prev-transfer-type">' + typeOpts(it.prevTransport.transferType) + '</select></div>' +
        '<div class="row transfer-info-row"' + (it.prevTransport.transfer ? "" : " style=\"display:none\"") + '><label>换乘详细信息</label><input id="ts-prev-transfer-info" placeholder="如：地铁3号线换乘公交101路" value="' + esc(it.prevTransport.transferInfo) + '"></div>' +
      '</div>' +
      '<div class="ts-section">' +
        '<div class="filter-cat">从此处到下一景点</div>' +
        '<div class="row"><label>交通类型</label><select id="ts-next-type">' + typeOpts(it.nextTransport.type) + '</select></div>' +
        '<div class="row"><label>详细信息</label><input id="ts-next-info" placeholder="公交 xxx路 / 地铁 x线" value="' + esc(it.nextTransport.info) + '"></div>' +
        '<label class="pack-item transfer-check" style="margin:6px 0;"><input type="checkbox" id="ts-next-transfer"' + (it.nextTransport.transfer ? " checked" : "") + '><span>需要换乘</span></label>' +
        '<div class="row transfer-info-row"' + (it.nextTransport.transfer ? "" : " style=\"display:none\"") + '><label>换乘交通类型</label><select id="ts-next-transfer-type">' + typeOpts(it.nextTransport.transferType) + '</select></div>' +
        '<div class="row transfer-info-row"' + (it.nextTransport.transfer ? "" : " style=\"display:none\"") + '><label>换乘详细信息</label><input id="ts-next-transfer-info" placeholder="如：地铁3号线换乘公交101路" value="' + esc(it.nextTransport.transferInfo) + '"></div>' +
      '</div>' +
      '<div class="ts-section">' +
        '<div class="filter-cat">高德导航</div>' +
        '<div class="row"><label>起点</label><input id="ts-from" placeholder="起点名称" value="' + esc(it.gaodeFrom || prevName) + '"></div>' +
        '<div class="row"><label>终点</label><input id="ts-to" placeholder="终点名称" value="' + esc(it.gaodeTo || it.name) + '"></div>' +
      '</div>' +
      '<div class="ts-section">' +
        '<div class="filter-cat">地图（可添加截图/路线图）</div>' +
        '<input id="ts-map-photo" type="file" accept="image/*" multiple style="margin:4px 0;">' +
        (it.mapPhotos && it.mapPhotos.length ? '<div id="ts-map-preview" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">' + it.mapPhotos.map(function(p,i){return '<img src="'+esc(p)+'" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #ddd;cursor:pointer;" data-mpi="'+i+'">';}).join("")+'</div>' : '') +
        '<p class="hint" style="font-size:11px;">照片存入数据中，本地删除原文件不影响此处显示。</p>' +
      '</div>' +
      '<div class="form-actions"><button class="btn-secondary" id="ts-cancel">返回</button><button class="btn-primary" id="ts-save">保存</button></div>');
    $("ts-cancel").onclick = closeModal;
    function toggleTransferRows(prefix) {
      var checked = $("ts-" + prefix + "-transfer").checked;
      document.querySelectorAll("#modal .ts-section .transfer-info-row").forEach(function (row) {
        // 仅控制当前 section 内的两行：通过判断 select/input id 前缀
        var sel = row.querySelector("select"); var inp = row.querySelector("input");
        if ((sel && sel.id === "ts-" + prefix + "-transfer-type") || (inp && inp.id === "ts-" + prefix + "-transfer-info")) {
          row.style.display = checked ? "" : "none";
        }
      });
    }
    $("ts-prev-transfer").onchange = function () { toggleTransferRows("prev"); };
    $("ts-next-transfer").onchange = function () { toggleTransferRows("next"); };
    /* 地图照片：读取已有 + 新增 */
    var mapPhotoList = (it && it.mapPhotos) ? it.mapPhotos.slice() : [];
    var mapPreviewArea = document.getElementById("ts-map-preview");
    if (mapPreviewArea) {
      mapPreviewArea.querySelectorAll("[data-mpi]").forEach(function(img) {
        img.onclick = function () {
          var idx = parseInt(this.getAttribute("data-mpi"));
          if (!confirm("删除这张地图截图？")) return;
          mapPhotoList.splice(idx, 1);
          this.remove();
          /* 刷新 data-mpi 索引 */
          mapPreviewArea.querySelectorAll("[data-mpi]").forEach(function(el, ni) { el.setAttribute("data-mpi", String(ni)); });
        };
      });
    }
    $("ts-save").onclick = function () {
      var name = $("ts-name").value.trim(); if (!name) { toast("请填写景点名称"); return; }
      var obj = s ? clone(s) : { id: uid() };
      obj.name = name; obj.openTime = $("ts-open").value.trim(); obj.note = $("ts-note").value.trim();
      obj.prevTransport = { type: $("ts-prev-type").value, info: $("ts-prev-info").value.trim(), transfer: $("ts-prev-transfer").checked, transferType: $("ts-prev-transfer-type").value, transferInfo: $("ts-prev-transfer-info").value.trim() };
      obj.nextTransport = { type: $("ts-next-type").value, info: $("ts-next-info").value.trim(), transfer: $("ts-next-transfer").checked, transferType: $("ts-next-transfer-type").value, transferInfo: $("ts-next-transfer-info").value.trim() };
      obj.gaodeFrom = $("ts-from").value.trim(); obj.gaodeTo = $("ts-to").value.trim();
      /* 地图照片 */
      var mapFileInput = $("ts-map-photo");
      var newMapFiles = (mapFileInput && mapFileInput.files) ? mapFileInput.files : [];
      function commitSpot() {
        if (mapPhotoList.length > 0) obj.mapPhotos = mapPhotoList;
        else delete obj.mapPhotos;
        // 清理旧字段（数据瘦身）
        delete obj.mapText; delete obj.mapPhoto; delete obj.hotSpots; delete obj.hotPhotos; delete obj.recs; delete obj.recsHidden;
        if (s) day.spots[spotIdx] = obj; else day.spots.push(obj);
        Store.save(); closeModal(); renderTravelMain(); toast("已保存");
      }
      if (newMapFiles.length > 0) {
        var pending = newMapFiles.length;
        for (var fi2 = 0; fi2 < newMapFiles.length; fi2++) {
          (function(file) {
            var rd2 = new FileReader();
            rd2.onload = function () { mapPhotoList.push(rd2.result); if (--pending === 0) commitSpot(); };
            rd2.onerror = function () { if (--pending === 0) commitSpot(); };
            rd2.readAsDataURL(file);
          })(newMapFiles[fi2]);
        }
      } else {
        commitSpot();
      }
    };
  }
  function showDayTransferForm(trip, di) {
    var day = trip.days[di];
    var nt = day.nextTransfer || {};
    var types = ["", "高铁", "飞机", "火车", "大巴", "地铁", "其他"];
    var date = nt.date || "";
    var time = nt.time || "";
    openModal('<h3>第 ' + (di + 1) + ' 天 → 第 ' + (di + 2) + ' 天 交通</h3>' +
      '<div class="row"><label>交通类型</label><select id="dt-type">' + types.map(function (t) { return '<option value="' + t + '"' + (nt.type === t ? " selected" : "") + '>' + (t || "请选择") + '</option>'; }).join("") + '</select></div>' +
      '<div class="row"><label>班次 / 信息</label><input id="dt-info" placeholder="G1234 济南西→曲阜东" value="' + esc(nt.info || "") + '"></div>' +
      '<div class="row"><label>出发日期</label><span id="dt-date-disp" class="date-disp">' + (date || "未选择") + '</span><button class="mini-btn" id="dt-date-pick">选择</button></div>' +
      '<div class="row"><label>出发时间</label><input type="time" id="dt-time" value="' + esc(time) + '"></div>' +
      '<div class="row"><label>建议提前出发</label><span id="dt-depart-disp" class="date-disp">' + (nt.departTime || "根据类型自动计算") + '</span></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="dt-cancel">返回</button><button class="btn-primary" id="dt-save">保存</button></div>');
    $("dt-cancel").onclick = closeModal;
    $("dt-date-pick").onclick = function () { openDatePicker({ mode: "single", value: date, onConfirm: function (d) { date = d; $("dt-date-disp").textContent = d; } }); };
    function calcDepart() {
      var ty = $("dt-type").value, t = $("dt-time").value, d = date;
      if (!t || !ty || !d) { $("dt-depart-disp").textContent = "根据类型自动计算"; return; }
      try {
        var dt = new Date(d + "T" + t);
        if (isNaN(dt.getTime())) { $("dt-depart-disp").textContent = "无法计算"; return; }
        var offset = ty === "飞机" ? 3 * 60 * 60 * 1000 : (ty === "高铁" ? 90 * 60 * 1000 : 0);
        if (offset) dt.setTime(dt.getTime() - offset);
        $("dt-depart-disp").textContent = fmtYMD(dt) + " " + pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
      } catch (e) { $("dt-depart-disp").textContent = "无法计算"; }
    }
    $("dt-type").onchange = calcDepart; $("dt-time").onchange = calcDepart; calcDepart();
    $("dt-save").onclick = function () {
      var ty = $("dt-type").value;
      var depart = $("dt-depart-disp").textContent;
      day.nextTransfer = { type: ty, info: $("dt-info").value.trim(), date: date, time: $("dt-time").value.trim(), departTime: depart.indexOf("自动") >= 0 ? "" : depart };
      Store.save(); closeModal(); renderTravelMain(); toast("已保存");
    };
  }
  function showFoodForm(trip, idx) {
    var f = idx != null ? trip.foods[idx] : null;
    var spotNames = allSpotNames(trip);
    openModal('<h3>' + (f ? "编辑" : "添加") + '美食 / 特产</h3>' +
      '<input id="tfd-name" placeholder="名称" value="' + (f ? esc(f.name) : "") + '">' +
      '<div class="row"><label>分类</label><select id="tfd-kind"><option value="nearby">景区周边美食</option><option value="specialty">特色美食</option><option value="souvenir">特产</option></select></div>' +
      '<div class="row" id="tfd-spot-row"><label>关联景点</label><select id="tfd-spot"><option value="">不关联</option>' + spotNames.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join("") + '</select></div>' +
      '<textarea id="tfd-note" placeholder="地址、人均、推荐菜、购买数量…">' + (f ? esc(f.note) : "") + '</textarea>' +
      '<div class="form-actions"><button class="btn-secondary" id="tfd-cancel">返回</button><button class="btn-primary" id="tfd-save">保存</button></div>');
    if (f) { $("tfd-kind").value = f.kind || "nearby"; if (f.spotName) $("tfd-spot").value = f.spotName; }
    $("tfd-kind").onchange = function () { $("tfd-spot-row").style.display = this.value === "nearby" ? "" : "none"; };
    $("tfd-kind").onchange();
    $("tfd-cancel").onclick = closeModal;
    $("tfd-save").onclick = function () {
      var name = $("tfd-name").value.trim(); if (!name) { toast("请填写名称"); return; }
      var obj = f ? clone(f) : { id: uid() };
      obj.name = name; obj.kind = $("tfd-kind").value; obj.spotName = $("tfd-kind").value === "nearby" ? $("tfd-spot").value : ""; obj.note = $("tfd-note").value.trim();
      if (f) trip.foods[idx] = obj; else trip.foods.push(obj);
      Store.save(); closeModal(); renderTravelMain(); toast("已保存");
    };
  }
  function showHotelForm(trip, idx) {
    var h = idx != null ? trip.hotels[idx] : null;
    openModal('<h3>' + (h ? "编辑" : "添加") + '酒店</h3>' +
      '<input id="th-name" placeholder="酒店名称" value="' + (h ? esc(h.name) : "") + '">' +
      '<input id="th-location" placeholder="地点 / 地址" value="' + (h ? esc(h.location) : "") + '">' +
      '<div class="row"><label>入住日期</label><span id="th-start-disp" class="date-disp">' + (h && h.startDate ? esc(h.startDate) : "未选择") + '</span><button class="mini-btn" id="th-start-pick">选择</button></div>' +
      '<div class="row"><label>离店日期</label><span id="th-end-disp" class="date-disp">' + (h && h.endDate ? esc(h.endDate) : "未选择") + '</span><button class="mini-btn" id="th-end-pick">选择</button></div>' +
      '<textarea id="th-note" placeholder="备注">' + (h ? esc(h.note) : "") + '</textarea>' +
      '<div class="form-actions"><button class="btn-secondary" id="th-cancel">返回</button><button class="btn-primary" id="th-save">保存</button></div>');
    var startDate = h ? h.startDate : "", endDate = h ? h.endDate : "";
    $("th-cancel").onclick = closeModal;
    $("th-start-pick").onclick = function () { openDatePicker({ mode: "single", value: startDate, onConfirm: function (d) { startDate = d; $("th-start-disp").textContent = d; } }); };
    $("th-end-pick").onclick = function () { openDatePicker({ mode: "single", value: endDate, onConfirm: function (d) { endDate = d; $("th-end-disp").textContent = d; } }); };
    $("th-save").onclick = function () {
      var name = $("th-name").value.trim(); if (!name) { toast("请填写酒店名称"); return; }
      var obj = h ? clone(h) : { id: uid() };
      obj.name = name; obj.location = $("th-location").value.trim(); obj.startDate = startDate; obj.endDate = endDate; obj.note = $("th-note").value.trim();
      if (h) trip.hotels[idx] = obj; else trip.hotels.push(obj);
      Store.save(); closeModal(); renderTravelMain(); toast("已保存");
    };
  }
  function showPackTagForm(trip) {
    openModal('<h3>新增行李物品</h3>' +
      '<input id="tp-name" placeholder="物品名称">' +
      '<div class="row"><label>分类</label><select id="tp-cat">' + PACK_CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="tp-cancel">返回</button><button class="btn-primary" id="tp-save">保存</button></div>');
    $("tp-cancel").onclick = closeModal;
    $("tp-save").onclick = function () {
      var name = $("tp-name").value.trim(); if (!name) { toast("请填写物品名称"); return; }
      var cat = $("tp-cat").value;
      trip.packTags.push({ id: uid(), name: name, cat: cat, checked: false });
      var defs = Store.data.life.travel.defaultPackTags;
      if (!defs.some(function (t) { return t.name === name && t.cat === cat; })) defs.push({ name: name, cat: cat });
      Store.save(); closeModal(); renderTravelMain(); toast("已添加");
    };
  }
  function showLaundryForm(trip, idx) {
    var it = idx != null ? trip.laundry[idx] : null;
    var wearDate = it ? (it.wearDate || it.date || todayStr()) : todayStr();
    var discardDate = it ? (it.discardDate || "") : "";
    openModal('<h3>' + (it ? "编辑" : "添加") + '换洗衣物</h3>' +
      '<input id="tl-name" placeholder="衣物名称" value="' + (it ? esc(it.name) : "") + '">' +
      '<div class="row"><label>照片</label><input type="file" id="tl-photo" accept="image/*"></div>' +
      (it && it.photo ? '<img id="tl-prev" class="wf-prev" src="' + it.photo + '">' : '<img id="tl-prev" class="wf-prev hidden">') +
      '<div class="row"><label>更换日期</label><span id="tl-wear-disp" class="date-disp">' + esc(wearDate) + '</span><button class="mini-btn" id="tl-wear-pick">选择</button></div>' +
      '<div class="row"><label>丢弃日期</label><span id="tl-discard-disp" class="date-disp">' + (discardDate ? esc(discardDate) : "未选择") + '</span><button class="mini-btn" id="tl-discard-pick">选择</button></div>' +
      (it ? '<button class="mini-btn danger" id="tl-del" style="margin-bottom:10px;">删除</button>' : "") +
      '<div class="form-actions"><button class="btn-secondary" id="tl-cancel">返回</button><button class="btn-primary" id="tl-save">保存</button></div>');
    $("tl-cancel").onclick = closeModal;
    $("tl-wear-pick").onclick = function () { openDatePicker({ mode: "single", value: wearDate, onConfirm: function (d) { wearDate = d; $("tl-wear-disp").textContent = d; } }); };
    $("tl-discard-pick").onclick = function () { openDatePicker({ mode: "single", value: discardDate, onConfirm: function (d) { discardDate = d; $("tl-discard-disp").textContent = d; } }); };
    var pendingPhoto = it ? it.photo : null;
    $("tl-photo").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      compressImageFile(f, function (data) { if (data) { pendingPhoto = data; var pv = $("tl-prev"); pv.src = data; pv.classList.remove("hidden"); } });
    });
    if (it) $("tl-del").onclick = function () { if (!confirm("删除这条记录？")) return; trip.laundry.splice(idx, 1); Store.save(); closeModal(); renderTravelMain(); toast("已删除"); };
    $("tl-save").onclick = function () {
      var name = $("tl-name").value.trim(); if (!name) { toast("请填写衣物名称"); return; }
      var obj = it ? clone(it) : { id: uid() };
      obj.name = name; obj.photo = pendingPhoto; obj.wearDate = wearDate; obj.discardDate = discardDate || "";
      if (it) trip.laundry[idx] = obj; else trip.laundry.push(obj);
      Store.save(); closeModal(); renderTravelMain(); toast("已保存");
    };
  }
  function bindTravelHandlers() {
    renderTravelNav(); renderTravelMain();
    $("travel-fold").onclick = function () { var n = $("travel-nav"); n.classList.toggle("collapsed"); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };
    $("travel-add-trip").onclick = function () { showTripForm(null); };
  }

  function bindLifeHandlers(key) {
    var L = Store.data.life;
    if (key === "weather") {
      $("lw-city").addEventListener("change", function () { L.weather.city = this.value; Store.save(); });
      $("lw-fetch").onclick = function () { fetchWeather(); };
    } else if (key === "sleep") {
      var sleepRemind = L.sleep.remind || "";
      $("ls-enabled").addEventListener("change", function () {
        L.sleep.enabled = this.checked;
        Store.save();
        if (this.checked && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
        scheduleSleepNotify();
      });
      $("ls-remind-pick").onclick = function () {
        openTimePicker({ value: sleepRemind, onConfirm: function (v) { sleepRemind = v; L.sleep.remind = v; $("ls-remind-disp").textContent = v; Store.save(); scheduleSleepNotify(); } });
      };
      scheduleSleepNotify();
    } else if (key === "period") {
      $("lp-cycle").addEventListener("change", function () { L.period.cycle = parseInt(this.value, 10) || 28; Store.save(); });
      var lpStart = "", lpEnd = "";
      $("lp-start-pick").onclick = function () {
        openDatePicker({ mode: "single", value: lpStart, onConfirm: function (d) { lpStart = d; $("lp-start-disp").textContent = d; } });
      };
      $("lp-end-pick").onclick = function () {
        openDatePicker({ mode: "single", value: lpEnd, onConfirm: function (d) { lpEnd = d; $("lp-end-disp").textContent = d; } });
      };
      $("lp-add").onclick = function () {
        if (!lpStart) { toast("请先选择开始日期"); return; }
        if (!lpEnd) lpEnd = lpStart;
        L.period.records.push({ id: uid(), start: lpStart, end: lpEnd });
        L.period.records.sort(function (a, b) { return ymdCmp(a.start || a.date, b.start || b.date); });
        Store.save(); renderLifeMain();
      };
      $("life-detail").querySelectorAll(".edit-period").forEach(function (b) {
        b.onclick = function () {
          var idx = +this.getAttribute("data-pi");
          var sorted = L.period.records.slice().sort(function (a, b2) { return ymdCmp(a.start || a.date, b2.start || b2.date); });
          var target = sorted[idx];
          if (!target) return;
          openDatePicker({ mode: "range", value: { start: target.start || target.date, end: target.end || target.date }, onConfirm: function (res) {
            target.start = res.start; target.end = res.end;
            L.period.records.sort(function (a, b2) { return ymdCmp(a.start || a.date, b2.start || b2.date); });
            Store.save(); renderLifeMain(); toast("已更新");
          } });
        };
      });
      $("life-detail").querySelectorAll(".del-period").forEach(function (b) {
        b.onclick = function () {
          var idx = +this.getAttribute("data-pi");
          var sorted = L.period.records.slice().sort(function (a, b2) { return ymdCmp(a.start || a.date, b2.start || b2.date); });
          var target = sorted[idx];
          if (!target) return;
          if (!confirm("确定删除第 " + (idx + 1) + " 条经期记录？")) return;
          L.period.records = L.period.records.filter(function (r) { return (r.start || r.date) !== (target.start || target.date) || (r.end || r.date) !== (target.end || target.date); });
          Store.save(); renderLifeMain();
        };
      });
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
      var ut = $("life-detail").querySelectorAll(".unit-toggle button");
      for (var ui = 0; ui < ut.length; ui++) {
        ut[ui].onclick = function () { Store.data.life.weightUnit = this.getAttribute("data-unit"); Store.save(); renderLifeMain(); };
      }
      $("lw-add").onclick = function () { var v = parseFloat($("lw-v").value); if (isNaN(v)) return; L.weight.push({ id: uid(), date: lwDate, v: v, unit: Store.data.life.weightUnit || "jin" }); Store.save(); renderLifeMain(); renderHome(); };
      $("life-detail").querySelectorAll(".edit-weight").forEach(function (b) { b.onclick = function () { showWeightForm(this.getAttribute("data-wid")); }; });
      $("life-detail").querySelectorAll(".del-weight").forEach(function (b) { b.onclick = function () { var id = this.getAttribute("data-wid"); if (!confirm("删除这条体重记录？")) return; L.weight = L.weight.filter(function (x) { return x.id !== id; }); Store.save(); renderLifeMain(); renderHome(); }; });
    } else if (key === "memo") {
      var lmDate = todayStr();
      $("lm-date-pick").onclick = function () {
        openDatePicker({ mode: "single", value: lmDate, onConfirm: function (d) { lmDate = d; $("lm-date-disp").textContent = d; } });
      };
      // 贴心整理台
      if ($("mommy-sort-btn")) {
        $("mommy-sort-btn").onclick = function () {
          var txt = ($("mommy-input") ? $("mommy-input").value : "").trim();
          if (!txt) { toast("先跟我说说你脑子里有哪些事嘛～"); return; }
          var tasks = parseTasksFromText(txt);
          sortMommyTasks(tasks);
          renderMommyResult($("mommy-result"), tasks);
        };
      }
      if ($("memo-color-set")) {
        $("memo-color-set").onclick = openMemoColorSettings;
      }
      $("lm-new").onclick = function () {
        if (!$("lm-title").value.trim() && !$("lm-content").value.trim()) return;
        L.memo.unshift({ id: uid(), title: $("lm-title").value.trim(), content: $("lm-content").value.trim(), date: lmDate, priority: $("lm-priority").value || "normal", items: [] });
        Store.save(); renderLifeMain(); renderHome();
      };
      $("life-detail").querySelectorAll(".del-memo").forEach(function (b) { b.onclick = function () { if (!confirm("删除这条备忘？")) return; L.memo.splice(+this.getAttribute("data-mi"), 1); Store.save(); renderLifeMain(); renderHome(); }; });
      $("life-detail").querySelectorAll(".memo-title").forEach(function (el) { el.addEventListener("change", function () { L.memo[+this.getAttribute("data-mi")].title = this.value; Store.save(); renderHome(); }); });
      $("life-detail").querySelectorAll(".memo-content").forEach(function (el) { el.addEventListener("change", function () { L.memo[+this.getAttribute("data-mi")].content = this.value; Store.save(); renderHome(); }); });
      $("life-detail").querySelectorAll(".memo-priority").forEach(function (el) { el.addEventListener("change", function () { L.memo[+this.getAttribute("data-mi")].priority = this.value; Store.save(); renderLifeMain(); renderHome(); }); });
      $("life-detail").querySelectorAll(".memo-date-pick").forEach(function (b) {
        b.onclick = function () {
          var idx = +this.getAttribute("data-mi");
          openDatePicker({ mode: "single", value: L.memo[idx].date, onConfirm: function (d) { L.memo[idx].date = d; Store.save(); renderLifeMain(); renderHome(); } });
        };
      });
      function addMemoItem(idx, text) {
        text = text.trim(); if (!text) return;
        if (!L.memo[idx].items) L.memo[idx].items = [];
        L.memo[idx].items.push({ text: text, done: false });
        Store.save(); renderLifeMain(); renderHome();
      }
      $("life-detail").querySelectorAll(".add-item").forEach(function (b) {
        b.onclick = function () {
          var idx = +this.getAttribute("data-mi");
          var inp = $("life-detail").querySelector('.memo-new-item[data-mi="' + idx + '"]');
          addMemoItem(idx, inp ? inp.value : "");
        };
      });
      $("life-detail").querySelectorAll(".memo-new-item").forEach(function (el) {
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addMemoItem(+this.getAttribute("data-mi"), this.value); } });
      });
      $("life-detail").querySelectorAll(".memo-check").forEach(function (el) {
        el.onclick = function () {
          var idx = +this.getAttribute("data-mi"), ii = +this.getAttribute("data-ii");
          if (L.memo[idx] && L.memo[idx].items) { L.memo[idx].items.splice(ii, 1); Store.save(); renderLifeMain(); renderHome(); }
        };
      });
      $("life-detail").querySelectorAll(".del-item").forEach(function (b) {
        b.onclick = function () {
          var idx = +this.getAttribute("data-mi"), ii = +this.getAttribute("data-ii");
          if (L.memo[idx] && L.memo[idx].items) { L.memo[idx].items.splice(ii, 1); Store.save(); renderLifeMain(); renderHome(); }
        };
      });
    } else if (key === "accounts") {
      bindAccountHandlers();
    } else if (key === "wardrobe") {
      bindWardrobeHandlers();
    } else if (key === "travel") {
      bindTravelHandlers();
    } else if (key === "docs") {
      $("ld-add").onclick = function () { showDocForm(); };
      $("life-detail").querySelectorAll("[data-tpl]").forEach(function (b) { b.onclick = function () { showDocForm(null, b.getAttribute("data-tpl")); }; });
      $("life-detail").querySelectorAll("[data-editdoc]").forEach(function (b) { b.onclick = function () { showDocForm(b.getAttribute("data-editdoc")); }; });
      $("life-detail").querySelectorAll("[data-deldoc]").forEach(function (b) { b.onclick = function () { var id = b.getAttribute("data-deldoc"); Store.data.life.docs = Store.data.life.docs.filter(function (x) { return x.id !== id; }); Store.save(); renderLifeMain(); }; });
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
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + g.results[0].latitude + "&longitude=" + g.results[0].longitude + "&current=temperature_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=2&timezone=auto";
        return fetch(url);
      })
      .then(function (r) { return r.json(); }).then(function (w) {
        var todayTemp = Math.round(w.current.temperature_2m);
        var todayPrecip = w.current.precipitation || 0;
        var daily = w.daily || {};
        var tMax = daily.temperature_2m_max || [], tMin = daily.temperature_2m_min || [], dPrecip = daily.precipitation_sum || [];
        var tmr = { tempMax: tMax[1] != null ? Math.round(tMax[1]) : null, tempMin: tMin[1] != null ? Math.round(tMin[1]) : null, precip: dPrecip[1] || 0 };
        Store.data.life.weather.temp = todayTemp; Store.data.life.weather.precip = todayPrecip;
        Store.data.life.weather.today = { temp: todayTemp, precip: todayPrecip };
        Store.data.life.weather.tomorrow = tmr;
        Store.save(); renderLifeMain(); renderHome();
        if (Store.data.settings.rainAlert) {
          var body = city + " 今天 " + todayTemp + "℃，降水 " + todayPrecip + "mm";
          if (tmr.tempMax != null) body += "；明天 " + tmr.tempMin + "~" + tmr.tempMax + "℃，降水 " + tmr.precip + "mm";
          var hasRain = todayPrecip > 0 || tmr.precip > 0;
          notify(hasRain ? "天气 / 降雨提醒" : "天气提醒", body + (hasRain ? "，出门记得带伞哦" : ""));
        }
        toast("天气已更新");
      }).catch(function () { toast("天气获取失败"); });
  }
  function notify(title, body) {
    try { if (!("Notification" in window)) return; if (Notification.permission === "granted") new Notification(title, { body: body }); else if (Notification.permission !== "denied") Notification.requestPermission().then(function (p) { if (p === "granted") new Notification(title, { body: body }); }); } catch (e) {}
  }
  var sleepTimer = null, lastSleepNotifyDate = "";
  function scheduleSleepNotify() {
    if (sleepTimer) { clearInterval(sleepTimer); sleepTimer = null; }
    var s = Store.data.life.sleep;
    if (!s || !s.enabled || !s.remind) return;
    function check() {
      var now = new Date();
      var today = fmtYMD(now);
      var parts = String(s.remind).split(":");
      if (parts.length < 2) return;
      var rh = parseInt(parts[0], 10), rm = parseInt(parts[1], 10);
      if (now.getHours() === rh && now.getMinutes() === rm && lastSleepNotifyDate !== today) {
        lastSleepNotifyDate = today;
        notify("该睡觉啦 🌙", "到点了，早点休息吧~");
      }
    }
    check();
    sleepTimer = setInterval(check, 60000);
  }

  /* ============ 证件记录 ============ */
  function lifeDocsHtml() {
    var docs = Store.data.life.docs;
    var tpls = ["身份证", "驾驶证", "行驶证", "护照", "港澳通行证"];
    var html = '<button class="mini-btn" id="ld-add">+ 添加证件</button>' +
      '<div class="doc-templates">常用：' + tpls.map(function (n) { return '<button class="mini-btn tpl" data-tpl="' + n + '">' + n + '</button>'; }).join("") + '</div>';
    if (!docs.length) return html + '<p class="hint">还没有记录，点“添加证件”或从上方常用证件快速建。</p>';
    var sorted = docs.slice().sort(function (a, b) { return ymdCmp(a.expiry || "9999-12-31", b.expiry || "9999-12-31"); });
    html += '<div class="doc-list">';
    sorted.forEach(function (d) {
      var left = d.expiry ? dayDiff(todayStr(), d.expiry) : null;
      var cnt = left == null ? "未填到期日" : (left >= 0 ? ("还有 " + left + " 天到期") : ("已过期 " + (-left) + " 天"));
      var cls = left == null ? "" : (left < 0 ? " expired" : (left <= 30 ? " soon" : ""));
      html += '<div class="doc-card ' + cls + '" data-id="' + esc(d.id) + '">' +
        '<div class="doc-name">' + esc(d.name) + '</div>' +
        '<div class="doc-exp">到期：' + esc(d.expiry || "—") + '　<span class="doc-cnt">' + cnt + '</span></div>' +
        (d.note ? '<div class="doc-note">' + esc(d.note) + '</div>' : '') +
        '<div class="spot-actions"><button class="mini-btn" data-editdoc="' + esc(d.id) + '">编辑</button><button class="mini-btn danger" data-deldoc="' + esc(d.id) + '">删除</button></div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }
  function showDocForm(docId, presetName) {
    var doc = docId != null ? Store.data.life.docs.filter(function (x) { return x.id === docId; })[0] : null;
    var name0 = doc ? doc.name : (presetName || "");
    var expiry0 = doc ? doc.expiry : "";
    openModal('<h3>' + (doc ? "编辑证件" : "添加证件") + '</h3>' +
      '<div class="row"><label>证件名称</label><input id="ld-name" placeholder="如 身份证 / 驾驶证" value="' + esc(name0) + '"></div>' +
      '<div class="row"><label>到期日</label><span id="ld-exp-disp" class="date-disp">' + (expiry0 ? esc(expiry0) : "未选择") + '</span><button class="mini-btn" id="ld-exp-pick">选择</button></div>' +
      '<div class="row"><label>备注</label><input id="ld-note" placeholder="如 证号后四位 / 换证地点" value="' + (doc ? esc(doc.note || "") : "") + '"></div>' +
      '<div class="form-actions"><button class="btn-secondary" id="ld-cancel">返回</button><button class="btn-primary" id="ld-save">保存</button></div>');
    var expiry = expiry0;
    $("ld-exp-pick").onclick = function () {
      openDatePicker({ mode: "single", value: expiry, onConfirm: function (d) { expiry = d; $("ld-exp-disp").textContent = d; } });
    };
    $("ld-cancel").onclick = closeModal;
    $("ld-save").onclick = function () {
      var name = $("ld-name").value.trim(); if (!name) { toast("请填写证件名称"); return; }
      var note = $("ld-note").value.trim();
      if (doc) { doc.name = name; doc.expiry = expiry; doc.note = note; }
      else Store.data.life.docs.push({ id: uid(), name: name, expiry: expiry, note: note });
      Store.save(); closeModal(); renderLifeMain();
    };
  }

  /* ============ 标签点击筛选 / 列表操作 ============ */
  function onListClick(e) {
    var tagEl = e.target.closest ? e.target.closest("[data-tag]") : null;
    if (tagEl) { state.entFilter = tagEl.getAttribute("data-tag"); renderNovelFilterNav(); renderEntList(); return; }
    var btn = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!btn) return;
    var li = btn.closest("li"); if (!li) return; var id = li.getAttribute("data-id"); var act = btn.getAttribute("data-act");
    if (state.tab === "study") {
      var m = curModule(); var arr = curPhaseRecords();
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
      else if (style === "weiding" && WEIDING_ICONS[t[0]]) iconHtml = '<img class="nav-weiding" src="' + WEIDING_ICONS[t[0]] + '" alt="' + t[1] + '">';
      else iconHtml = (ICONS.guofeng[t[0]] || "");
      b.innerHTML = iconHtml + "<span>" + t[1] + "</span>";
      if (style === "oil" || style === "weiding") {
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
  function openHelp() {
    var d = Store.data || {};
    var ent = d.ent || {};
    var life = d.life || {};
    var ns = (ent.novels ? ent.novels.length : 0);
    var nm = (life.memo ? life.memo.length : 0);
    var nw = (life.weight ? life.weight.length : 0);
    var html = ''
      + '<div style="max-height:72vh;overflow:auto;-webkit-overflow-scrolling:touch;">'
      + '<h3 style="margin:0 0 4px;">使用说明 / 备份小贴士</h3>'
      + '<p class="hint" style="margin-top:0;">你的工作台数据只存在这台设备的浏览器里，不会上传任何服务器。换手机/电脑、清缓存、重装都会丢，靠"备份"来搬家。</p>'
      + '<h4 style="margin:14px 0 4px;">一、备份（导出）</h4>'
      + '<ol style="margin:4px 0;padding-left:20px;line-height:1.8;">'
      + '<li>进 <b>设置 → 数据备份</b></li>'
      + '<li>点「导出数据」，下载文件：<code>小李的工作台备份-年月日.json</code></li>'
      + '<li>建议立刻存到 <b>百度网盘</b>（你已是会员，上传快又稳）</li>'
      + '</ol>'
      + '<h4 style="margin:14px 0 4px;">二、换设备 / 恢复（导入）</h4>'
      + '<ol style="margin:4px 0;padding-left:20px;line-height:1.8;">'
      + '<li>新设备打开工作台 → <b>设置 → 数据备份 → 导入数据</b></li>'
      + '<li>选你存到百度网盘的 json 文件</li>'
      + '<li>确认"覆盖"，数据即恢复</li>'
      + '</ol>'
      + '<p class="hint" style="color:#b00020;">注意：导入会覆盖当前数据。导入前先在本机导一份备份更稳妥；文件名带日期，多留几份不同日期的备份更保险。</p>'
      + '<h4 style="margin:14px 0 4px;">三、手机 ↔ 电脑 共享（推荐姿势）</h4>'
      + '<ol style="margin:4px 0;padding-left:20px;line-height:1.8;">'
      + '<li>在 A 设备点「导出」→ 传到百度网盘</li>'
      + '<li>在 B 设备从百度网盘下载该 json → 点「导入」</li>'
      + '<li>反过来同理。虽是手动，但免费、国内畅通、绝不会丢</li>'
      + '</ol>'
      + '<p class="hint">当前数据：备忘 ' + nm + ' 条 · 体重 ' + nw + ' 条 · 小说 ' + ns + ' 部。记得常备份～</p>'
      + '<div style="text-align:right;margin-top:12px;"><button class="btn-primary" id="help-ok">我知道了</button></div>'
      + '</div>';
    openModal(html);
    var ok = document.getElementById("help-ok");
    if (ok) ok.onclick = closeModal;
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
    $("set-hlcolor").onclick = function () { openColorPicker(Store.data.settings.highlightColor || "#c8e0db", function (c) { Store.data.settings.highlightColor = c; Store.save(); applyHighlightColor(); }); };
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
    $("set-help").onclick = openHelp;
    $("set-export").onclick = function () {
      try {
        var backupObj = clone(Store.data);
        backupObj._backupTime = new Date().toISOString();
        backupObj._backupVersion = "2.1";
        var raw = JSON.stringify(backupObj, null, 2);
        var blob = new Blob([raw], { type: "application/json" });
        var a = document.createElement("a");
        var d = new Date();
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        a.href = URL.createObjectURL(blob);
        a.download = "小李的工作台备份-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
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
          /* 统计备份数据量 */
          var ent = obj.ent || {};
          var life = obj.life || {};
          var study = obj.study || {};
          var nNovels = (ent.novels ? ent.novels.length : 0);
          var nMemo = (life.memo ? life.memo.length : 0);
          var nWeight = (life.weight ? life.weight.length : 0);
          var nPeriod = (life.period && life.period.records ? life.period.records.length : 0);
          var nAccounts = (life.accounts && life.accounts.entries ? life.accounts.entries.length : 0);
          var nInsp = (ent.inspiration ? ent.inspiration.length : 0);
          var nCats = (study.categories ? study.categories.length : 0);
          var totalItems = nNovels + nMemo + nWeight + nPeriod + nAccounts + nInsp;
          /* 备份时间 */
          var bt = obj._backupTime;
          var timeStr = "";
          if (bt) {
            try { var td = new Date(bt); timeStr = td.getFullYear() + "-" + ("0"+(td.getMonth()+1)).slice(-2) + "-" + ("0"+td.getDate()).slice(-2) + " " + ("0"+td.getHours()).slice(-2) + ":" + ("0"+td.getMinutes()).slice(-2); } catch(e) { timeStr = bt; }
          } else {
            timeStr = "未知（旧版备份）";
          }
          /* 预览弹窗 */
          var previewHtml = ''
            + '<h3 style="margin:0 0 8px;">导入预览</h3>'
            + '<p class="hint" style="margin-top:0;">备份时间：<b>' + timeStr + '</b></p>'
            + '<div style="background:#f8f6f1;border-radius:8px;padding:10px 14px;margin:8px 0;line-height:1.9;font-size:14px;">'
            + '备忘 <b>' + nMemo + '</b> 条<br>'
            + '体重 <b>' + nWeight + '</b> 条<br>'
            + '小说 <b>' + nNovels + '</b> 部<br>'
            + '经期 <b>' + nPeriod + '</b> 条<br>'
            + '记账 <b>' + nAccounts + '</b> 笔<br>'
            + '灵感 <b>' + nInsp + '</b> 条<br>'
            + '学习项目 <b>' + nCats + '</b> 个<br>'
            + '</div>'
            + '<p style="color:#b00020;margin:6px 0;font-size:13px;">注意：导入将覆盖当前全部数据！建议先在本机「导出」一份当前备份。</p>'
            + '<div style="text-align:right;margin-top:10px;"><button class="btn-primary" id="import-confirm" style="margin-right:8px;">确认导入</button><button class="mini-btn" id="import-cancel">取消</button></div>';
          openModal(previewHtml);
          $("import-confirm").onclick = function () {
            closeModal();
            localStorage.setItem(KEY, JSON.stringify(obj));
            Store.load();
            normalizeLifeSelection();
            applyBg(document.body, Store.data.settings.globalBg);
            applyFont();
            applyMemoPriorityColors();
            applyHighlightColor();
            renderBottomNav();
            switchTab("home");
            toast("导入成功，数据已恢复（共 " + totalItems + " 条记录）");
          };
          $("import-cancel").onclick = closeModal;
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
    /* 数据丢失检测与自动恢复 */
    checkDataLossAndRecover();
    scheduleSleepNotify();
    normalizeLifeSelection();
    applyBg(document.body, Store.data.settings.globalBg);
    applyFont();
    applyMemoPriorityColors();
    applyHighlightColor();

    $("math-refresh").onclick = renderMathGrid;
    $("fact-refresh").onclick = renderFactList;
    $("home-thumb-pick").onclick = openThumbPicker;

    /* 首页快速记一笔 */
    $("qa-memo").onclick = openQuickMemo;
    $("qa-weight").onclick = openQuickWeight;
    $("qa-period").onclick = openQuickPeriod;
    $("qa-account").onclick = openQuickAccount;
    $("qa-toggle").onclick = openQuickAddSettings;

    $("study-fold").onclick = function () { var n = $("study-nav"); n.classList.toggle("collapsed"); n.parentElement.classList.toggle("collapsed", n.classList.contains("collapsed")); this.textContent = n.classList.contains("collapsed") ? "›" : "‹"; };
    var pts = document.querySelectorAll(".phase");
    for (var p = 0; p < pts.length; p++) {
      pts[p].addEventListener("click", function () { state.phase = this.getAttribute("data-pkey"); renderStudyMain(); });
    }
    $("study-color").onclick = function () { var m = curModule(); if (!m) return; ensurePhases(m); var cp = curPhase(); openColorPicker(cp ? cp.color : m.barColor, function (cc) { setModuleColor(cc); }); };
    $("study-add").onclick = function () { showStudyForm(null); };
    $("study-new-cat").onclick = function () { showStudyCategoryForm(); };
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
    /* 使用说明只弹一次（永久记住，不依赖 Store.data，防止数据丢失后重复弹） */
    if (!localStorage.getItem(SEEN_TIPS_KEY)) { localStorage.setItem(SEEN_TIPS_KEY, "1"); openHelp(); }
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
