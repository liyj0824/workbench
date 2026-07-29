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
    /* ===== 时政 ===== */
    { cat: "时政", hl: ["新质生产力"], text: "2024年政府工作报告将'加快发展新质生产力'列为首要任务。以科技创新为核心驱动力，具有高科技、高效能、高质量特征。" },
    { cat: "时政", hl: ["二十届三中全会"], text: "2024年7月举行，重点研究进一步全面深化改革、推进中国式现代化问题。" },
    { cat: "时政", hl: ["新中国成立75周年"], text: "2024年10月1日是中华人民共和国成立75周年。中国从一穷二白发展为世界第二大经济体，人均GDP突破1.2万美元。" },
    { cat: "时政", hl: ["神舟十八号","中国空间站"], text: "2024年神舟十八号、十九号接续发射，中国空间站进入常态化运营阶段。" },
    { cat: "时政", hl: ["嫦娥六号","月背采样"], text: "2024年6月嫦娥六号成功着陆月球背面，完成人类首次月球背面采样返回。" },
    { cat: "时政", hl: ["全国两会","GDP增长5%"], text: "2025年3月两会召开，政府工作报告提出GDP增长5%左右、城镇新增就业1200万人以上。" },
    { cat: "时政", hl: ["延迟退休"], text: "2024年9月通过渐进式延迟法定退休年龄决定，从2025年起用15年时间逐步延迟。" },
    { cat: "时政", hl: ["低空经济"], text: "被2024年政府工作报告列为新增长引擎，涵盖无人机配送、低空文旅、应急救援等业态。" },
    { cat: "时政", hl: ["中国式现代化"], text: "五个特征：人口规模巨大、共同富裕、物质精神协调、人与自然和谐共生、走和平发展道路。" },
    { cat: "时政", hl: ["碳达峰碳中和"], text: "中国承诺2030年前碳达峰、2060年前碳中和，推动能源结构转型。" },
    { cat: "时政", hl: ["一带一路"], text: "2023年第三届高峰论坛，2024年进入高质量发展新阶段，中欧班列持续扩容。" },
    { cat: "时政", hl: ["C919国产大飞机"], text: "2024年开启常态化商业运营并逐步扩大航线，标志国产民机进入商业运营新阶段。" },
    { cat: "时政", hl: ["巴黎奥运会"], text: "2024年巴黎奥运会中国代表团取得40金27银24铜，境外参赛最好成绩。" },
    { cat: "时政", hl: ["粮食安全"], text: "2024年中央一号文件聚焦三农，要求粮食产量保持在1.3万亿斤以上。" },
    /* ===== 经济 ===== */
    { cat: "经济", hl: ["货币政策三大法宝"], text: "三大法宝：再贴现率（商业银行向央行借钱利率）、法定存款准备金率（必须缴存比例）、公开市场业务（买卖国债调节货币量）。" },
    { cat: "经济", hl: ["财政政策"], text: "扩张性：减税增支应对衰退/通缩；紧缩性：增税减支应对过热/通胀。财政被称为'内在稳定器'。" },
    { cat: "经济", hl: ["汇率变动"], text: "本币贬值（汇率下降）利于出口不利于进口；本币升值利于进口不利于出口。" },
    { cat: "经济", hl: ["三驾马车"], text: "拉动经济增长：投资（政府支出）、消费（居民需求）、出口（外部需求）。全球经济治理三驾马车：WTO、IMF、世界银行。" },
    { cat: "经济", hl: ["恩格尔系数"], text: "食品支出占总消费比重。系数越高越贫穷，越接近0越富裕。长期趋势才明显。" },
    { cat: "经济", hl: ["基尼系数"], text: "衡量收入分配差异。0-1之间，越接近0越平等；0.4以上差距较大，0.6以上收入悬殊。" },
    { cat: "经济", hl: ["GDP与GNP"], text: "GDP=境内生产（国土概念）；GNP=国民生产（国民概念）。二手车/股票/扶贫资金不计入当年GDP。" },
    { cat: "经济", hl: ["PMI采购经理指数"], text: "衡量经济景气度。荣枯分水线50%：高于扩张，低于收缩。" },
    { cat: "经济", hl: ["CPI消费者物价指数"], text: "反映通货膨胀水平的重要指标，被称为'晴雨表'。CPI上涨=物价涨=购买力下降。" },
    { cat: "经济", hl: ["通货膨胀VS通货紧缩"], text: "通胀：总需求大于总供给导致物价涨货币贬值，对策控货币供应；通缩：总需求小于总供给导致物价跌货币升值，对策扩内需刺激消费。" },
    { cat: "经济", hl: ["货币五大职能"], text: "价值尺度（标价）、流通手段（一手交钱一手交货）、支付手段（赊账）、贮藏手段（存钱）、世界货币。基本职能：价值尺度+流通手段。" },
    { cat: "经济", hl: ["市场配置缺陷"], text: "自发性（逐利造假如假奶粉）、盲目性（跟风烂市）、滞后性（事后调节如手机滞销才减产）。核心机制：价格机制。" },
    { cat: "经济", hl: ["看不见的手VS看得见的手"], text: "看不见的手=市场经济（亚当斯密《国富论》）；看得见的手=宏观调控（凯恩斯《通论》）。" },
    /* ===== 地理 ===== */
    { cat: "地理", hl: ["我国地势三级阶梯"], text: "一二级分界：昆仑山-祁连山-横断山；二三级分界：大兴安岭-太行山-巫山-雪峰山。" },
    { cat: "地理", hl: ["四大高原"], text: "青藏高原（世界屋脊/地热丰富）、内蒙古高原（最平坦/瀚海）、黄土高原（千沟万壑）、云贵高原（喀斯特崎岖）。" },
    { cat: "地理", hl: ["四大盆地"], text: "塔里木（最大/沙漠）、准噶尔（最北/塞北江南）、柴达木（最高/聚宝盆）、四川（最低/紫色盆地）。" },
    { cat: "地理", hl: ["三大平原"], text: "东北平原（最大/黑土）、华北平原（黄淮海/黄河冲积）、长江中下游（鱼米之乡/低于50米）。" },
    { cat: "地理", hl: ["长江黄河"], text: "长江：唐古拉山到11省市东海（第一大河/黄金水道）；黄河：巴颜喀拉山到9省渤海（几字形/含沙最多/母亲河）。" },
    { cat: "地理", hl: ["湖泊"], text: "淡水湖：鄱阳湖（最大）、洞庭湖、太湖、洪泽湖、巢湖。咸水湖：青海湖（最大）、纳木错（最高）、艾丁湖（最低）。" },
    { cat: "地理", hl: ["五岳"], text: "东岳泰山（山东/五岳之首）、西岳华山（陕西/最高最险）、北岳恒山（山西/悬空寺）、南岳衡山（湖南/独秀）、中岳嵩山（河南）。" },
    { cat: "地理", hl: ["三山五岳三山"], text: "安徽黄山（四绝：奇松怪石云海温泉）、江西庐山（匡庐奇秀甲天下）、浙江雁荡山（东南第一山）。" },
    { cat: "地理", hl: ["四大石窟"], text: "敦煌莫高窟（甘肃/内容最丰）、云冈石窟（山西/东方精魂）、麦积山石窟（甘肃/泥塑特色）、龙门石窟（河南/造像最多/卢舍那大佛）。" },
    { cat: "地理", hl: ["二十四节气"], text: "春：立春雨水惊蛰春分清明谷雨；夏：立夏小满芒种夏至小暑大暑；秋：立秋处暑白露秋分寒露霜降；冬：立冬小雪大雪冬至小寒大寒。" },
    { cat: "地理", hl: ["世界之最"], text: "最深海沟：马里亚纳（11000m）；最大沙漠：撒哈拉；最大半岛：阿拉伯；最高峰：珠穆朗玛；最大淡水湖：苏必利尔；最大咸水湖：里海。" },
    /* ===== 人文 ===== */
    { cat: "人文", hl: ["诸子百家"], text: "儒家孔孟荀（仁政/性善/性恶）；道家老庄（无为/逍遥）；墨家墨子（兼爱非攻）；法家韩非（法治）；兵家孙武孙膑（《孙子兵法》）。" },
    { cat: "人文", hl: ["四书五经"], text: "四书：《大学》《中庸》《论语》《孟子》。五经：《诗》《书》《礼》《易》《春秋》。加《乐经》称六经。" },
    { cat: "人文", hl: ["唐宋八大家"], text: "韩愈、柳宗元、欧阳修、王安石、苏轼、苏洵、苏辙、曾巩。三苏：苏洵苏轼苏辙。韩柳欧苏为四大家。" },
    { cat: "人文", hl: ["初唐四杰"], text: "王勃（《滕王阁序》落霞孤鹜）、杨炯、卢照邻、骆宾王（《咏鹅》神童）。" },
    { cat: "人文", hl: ["四大名楼"], text: "滕王阁（王勃/落霞孤鹜）、黄鹤楼（崔颢/昔人已乘）、岳阳楼（范仲淹/先忧后乐）、鹳雀楼（王之涣/更上一层楼）。" },
    { cat: "人文", hl: ["李白杜甫"], text: "李白（诗仙/浪漫/将进酒蜀道难）；杜甫（诗圣/现实主义/诗史/三吏三别/茅屋秋风）。合称李杜/大李杜。" },
    { cat: "人文", hl: ["唐诗分期"], text: "初唐四杰；盛唐：王孟（山水）高岑边塞加李杜；中唐：白居易（诗魔/琵琶行）李贺（诗鬼）；晚唐：小李杜（杜牧李商隐）。" },
    /* ===== 法律/公文 ===== */
    { cat: "法律", hl: ["公文15种"], text: "决议、决定、公报、公告、通知、通报、通告、命令(令)、议案、报告、请示、批复、意见、函、纪要。口诀：两决两公三个通，令议批复函纪要。" },
    { cat: "法律", hl: ["公文结构"], text: "版头（份号密级紧急程度发文标志发文字号签发人）到主体（标题主送正文附件署名日期印章附注附件）到版记（抄送印发机关日期页码）。" },
    { cat: "法律", hl: ["行政监督体系"], text: "内部监督（第一道防线）：一般监督加专门审计监督；外部监督（第二道）：立法加监察加司法加政党加社会监督。" },
    { cat: "法律", hl: ["心理效应常考"], text: "首因效应（第一印象/先入为主）、近因效应（最新印象）、晕轮效应（光环/以偏概全）、破窗效应（从众）、门槛效应（得寸进尺）、马太效应（强者越强）。" },
    /* ===== 科技/生活 ===== */
    { cat: "科技", hl: ["北斗卫星导航"], text: "中国自主建设的全球卫星导航系统，2020年全面建成开通，定位精度达厘米级，服务全球。" },
    { cat: "科技", hl: ["量子科技"], text: "'九章'量子计算原型机、'墨子号'量子科学实验卫星，中国在量子通信和计算领域处于国际第一梯队。" },
    { cat: "科技", hl: ["新能源"], text: "光伏装机容量全球第一；新能源汽车产销量连续多年世界第一；特高压输电技术领先全球。" },
    { cat: "生活", hl: ["陆上邻国14个"], text: "口诀：月娥姑娘真腼腆（越俄缅蒙不丹），哈吉塔印老尼朝（哈吉塔印老尼朝），巴阿（巴阿）。（朝鲜巴基斯坦阿富汗）" },
    { cat: "生活", hl: ["省级行政区"], text: "23个省、5个自治区、4个直辖市、2个特别行政区，共34个省级行政区。" }
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
    /* ===== 成语区块 ===== */
    var idiomSection = document.createElement("div"); idiomSection.className = "fact-section";
    idiomSection.innerHTML = '<div class="card-title" style="font-size:14px;padding:8px 0;">成语积累 <button class="mini-btn" id="idiom-refresh">换一批</button></div>';
    var idiomBody = document.createElement("div"); idiomBody.id = "idiom-body";
    idiomSection.appendChild(idiomBody);
    fl.appendChild(idiomSection);
    renderIdiomList();
    /* ===== 常识区块 ===== */
    var knowSection = document.createElement("div"); knowSection.className = "fact-section";
    knowSection.innerHTML = '<div class="card-title" style="font-size:14px;padding:8px 0;margin-top:6px;">常识 · 时政 <button class="mini-btn" id="know-refresh">换一批</button></div>';
    var knowBody = document.createElement("div"); knowBody.id = "know-body";
    knowSection.appendChild(knowBody);
    fl.appendChild(knowSection);
    renderKnowledgeList();
    /* 绑定独立刷新 */
    $("idiom-refresh").onclick = renderIdiomList;
    $("know-refresh").onclick = renderKnowledgeList;
  }
  function renderIdiomList() {
    var body = $("idiom-body"); if (!body) return; body.innerHTML = "";
    var idioms = IDIOMS.sort(function () { return Math.random() - 0.5; }).slice(0, 6);
    idioms.forEach(function (w) { body.appendChild(factItem("成语", w.word, w.explain, false)); });
  }
  function renderKnowledgeList() {
    var body = $("know-body"); if (!body) return; body.innerHTML = "";
    var sz = KNOWLEDGE.filter(function (k) { return k.cat === "时政"; });
    var others = KNOWLEDGE.filter(function (k) { return k.cat !== "时政"; }).sort(function () { return Math.random() - 0.5; });
    var know = []; if (sz.length) know.push(sz[Math.floor(Math.random() * sz.length)]);
    know = know.concat(others.slice(0, 2));
    know.forEach(function (k) {
      var key = factKey(k);
      var customHl = Store.data.customHighlights[key];
      body.appendChild(factItem(k.cat, k.text, null, k.cat === "时政", k.hl, k.table, key, customHl));
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
      + '<div style="margin:14px 0 6px;font-size:13px;color:#5f7a5a;font-weight:600;">\u9636\u6BB5\u8BBE\u7F6E:</div>'
      + '<div id="phase-opt-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">'
      /* 选项A：基础+提升 */
      + '<label class="phase-opt-card" data-phase-val="default">'
      + '<div class="phase-opt-dot"></div>'
      + '<div class="phase-opt-text"><strong>\u57FA\u7840\u5B66\u4E60</strong><span>+</span><strong>\u63D0\u5347\u9636\u6BB5</strong></div>'
      + '<div class="phase-opt-hint">\u4E24\u4E2A\u9ED8\u8BA4\u9636\u6BB5</div>'
      + '<input type="radio" name="scat-phase" value="default" checked style="display:none;">'
      + '</label>'
      /* 选项B：单一阶段 */
      + '<label class="phase-opt-card" data-phase-val="single">'
      + '<div class="phase-opt-dot"></div>'
      + '<div class="phase-opt-text"><strong>\u53EA\u4E00\u4E2A\u9636\u6BB5</strong></div>'
      + '<div class="phase-opt-hint">\u7B80\u5355\u76F4\u63A5</div>'
      + '<input type="radio" name="scat-phase" value="single" style="display:none;">'
      + '</label>'
      /* 选项C：自定义 — 占满一行 */
      + '</div><div id="phase-opt-custom-row" style="margin-bottom:10px;">'
      + '<label class="phase-opt-card phase-opt-wide" data-phase-val="custom" style="width:100%;">'
      + '<div class="phase-opt-dot"></div>'
      + '<div class="phase-opt-text"><strong>\u81EA\u5B9A\u4E49\u9636\u6BB5\u540D</strong></div>'
      + '<div class="phase-opt-hint">\u81EA\u5DF1\u586B\u5199\u9636\u6BB5\u540D\u79F0</div>'
      + '<input type="radio" name="scat-phase" value="custom" style="display:none;">'
      + '</label></div>'
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
    /* fact-refresh 已拆分为 idiom-refresh / know-refresh，在 renderFactList 内绑定 */
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
