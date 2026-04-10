"use strict";
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // public/app.js
  var import_lightweight_charts_standalone_production = __require("/vendor/lightweight-charts/lightweight-charts.standalone.production.mjs");
  var STORAGE_KEY = "stock-project-recommendations-v2";
  var LEGACY_STORAGE_KEY = "band-stock-recommendations-v2";
  var UI_STATE_STORAGE_KEY = "stock-project-ui-state-v1";
  var PAGE_SIZE_ALL = 999;
  var DEFAULT_CATEGORY = "longTerm";
  var DEFAULT_LONG_TERM_BUCKET = "buy";
  var DEFAULT_SWING_BUCKET = "execution";
  var SWING_LOOKBACK_DAYS = 15;
  var SERVER_RECOMMENDATION_REFRESH_INTERVAL_MS = 60 * 1e3;
  var DEFAULT_VISIBLE_TRADING_SESSIONS = 45;
  var DEFAULT_VISIBLE_MARKET_WATCH_SESSIONS = {
    daily: 45,
    weekly: 52,
    yearly: 8
  };
  var SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 10 * 1e3;
  var LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 30 * 1e3;
  var ACTIVE_ANALYSIS_REFRESH_INTERVAL_MS = 5 * 1e3;
  var APP_VIEWS = ["news", "index", "analysis", "movers"];
  var PAGE_SIZE_OPTIONS = /* @__PURE__ */ new Set([5, 10, PAGE_SIZE_ALL]);
  var HANGUL_BASE = 44032;
  var HANGUL_END = 55203;
  var CHOSUNG = [
    "\u3131",
    "\u3132",
    "\u3134",
    "\u3137",
    "\u3138",
    "\u3139",
    "\u3141",
    "\u3142",
    "\u3143",
    "\u3145",
    "\u3146",
    "\u3147",
    "\u3148",
    "\u3149",
    "\u314A",
    "\u314B",
    "\u314C",
    "\u314D",
    "\u314E"
  ];
  var defaultRecommendationCatalog = [
    { key: "\uC5D4\uC528\uC18C\uD504\uD2B8", name: "\uC5D4\uC528\uC18C\uD504\uD2B8", symbol: "036570", anchorDate: "2026-03-22", note: "215000\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "TIGER \uBBF8\uAD6D30\uB144\uAD6D\uCC44\uCEE4\uBC84\uB4DC\uCF5C\uC561\uD2F0\uBE0C(H)", name: "TIGER \uBBF8\uAD6D30\uB144\uAD6D\uCC44\uCEE4\uBC84\uB4DC\uCF5C\uC561\uD2F0\uBE0C(H)", symbol: "476550", anchorDate: "2026-03-12", note: "7445\uC6D0 1\uCC28\uB9E4\uC218" },
    { key: "\uD3EC\uC2A4\uCF54DX", name: "\uD3EC\uC2A4\uCF54DX", symbol: "022100", anchorDate: "2026-03-12", latestMentionDate: "2026-03-12", note: "31550\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "CJ\uB300\uD55C\uD1B5\uC6B4", name: "CJ\uB300\uD55C\uD1B5\uC6B4", symbol: "000120", anchorDate: "2026-03-05", note: "112800\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "\uC81C\uC6B0\uC2A4", name: "\uC81C\uC6B0\uC2A4", symbol: "079370", anchorDate: "2026-03-02", latestMentionDate: "2026-03-05", note: "17600\uC6D0 \uC544\uB798 \uBD84\uD560\uB9E4\uC218" },
    { key: "\uB098\uBB34\uAC00", name: "\uB098\uBB34\uAC00", symbol: "190510", anchorDate: "2026-02-27", latestMentionDate: "2026-03-05", note: "22500\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "OCI", name: "OCI", symbol: "456040", anchorDate: "2025-07-28", note: "AS \uAE00\uC5D0\uC11C \uC0AD\uC81C \uC804 \uBAA9\uB85D" },
    { key: "\uC544\uBAA8\uB808\uD37C\uC2DC\uD53D", name: "\uC544\uBAA8\uB808\uD37C\uC2DC\uD53D", symbol: "090430", anchorDate: "2025-07-28", note: "AS \uAE00\uC5D0\uC11C \uC0AD\uC81C \uC804 \uBAA9\uB85D" },
    { key: "KODEX 2\uCC28\uC804\uC9C0\uC0B0\uC5C5\uB808\uBC84\uB9AC\uC9C0", name: "KODEX 2\uCC28\uC804\uC9C0\uC0B0\uC5C5\uB808\uBC84\uB9AC\uC9C0", symbol: "462330", anchorDate: "2025-07-28", note: "AS \uAE00\uC5D0\uC11C \uC0AD\uC81C \uC804 \uBAA9\uB85D" },
    { key: "\uC140\uD2B8\uB9AC\uC628\uC81C\uC57D", name: "\uC140\uD2B8\uB9AC\uC628\uC81C\uC57D", symbol: "068760", anchorDate: "2025-07-25", note: "53700\uC6D0 \uC774\uD558 \uB610\uB294 \uB2E4\uC74C\uB0A0 \uC2DC\uAC00 \uC774\uD558" },
    { key: "\uC5D8\uC564\uC5D0\uD504", name: "\uC5D8\uC564\uC5D0\uD504", symbol: "066970", anchorDate: "2025-07-25", note: "64500\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "\uC5D0\uCF54\uD504\uB85C\uBE44\uC5E0", name: "\uC5D0\uCF54\uD504\uB85C\uBE44\uC5E0", symbol: "247540", anchorDate: "2025-07-24", note: "112000\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "\uB124\uC624\uC704\uC988", name: "\uB124\uC624\uC704\uC988", symbol: "095660", anchorDate: "2025-07-14", note: "\uCD5C\uADFC\uCD94\uCC9C \uC774\uD6C4 AS \uAE00 \uC5B8\uAE09" },
    { key: "BGF\uB9AC\uD14C\uC77C", name: "BGF\uB9AC\uD14C\uC77C", symbol: "282330", anchorDate: "2025-07-28", note: "112500\uC6D0 \uC774\uD558 1\uCC28\uB9E4\uC218" },
    { key: "LG\uC0DD\uD65C\uAC74\uAC15", name: "LG\uC0DD\uD65C\uAC74\uAC15", symbol: "051900", anchorDate: "2025-07-15", note: "330000\uC6D0 \uC774\uD558\uBD80\uD130 \uC190\uC808\uAC00 \uAD6C\uAC04\uAE4C\uC9C0" },
    { key: "\uC0BC\uC131\uC804\uC790", name: "\uC0BC\uC131\uC804\uC790", symbol: "005930", anchorDate: "2024-11-01", note: "59000\uC6D0 \uC774\uD558 \uC911\uAE30 1\uCC28\uB9E4\uC218" },
    { key: "\uC624\uB9AC\uC628\uD640\uB529\uC2A4", name: "\uC624\uB9AC\uC628\uD640\uB529\uC2A4", symbol: "001800", anchorDate: "2025-05-29", note: "\uBC15\uC2A4\uAD8C \uC800\uD56D\uB300 \uB3CC\uD30C \uC5EC\uBD80 \uAD00\uCC30" },
    { key: "\uCEF4\uD22C\uC2A4", name: "\uCEF4\uD22C\uC2A4", symbol: "078340", anchorDate: "2024-08-29", note: "40050\uC6D0 \uC774\uD558\uBD80\uD130 \uC190\uC808\uAC00 \uAD6C\uAC04 \uBD84\uD560\uB9E4\uC218" }
  ];
  var stockMasterSeed = [
    { code: "005930", name: "\uC0BC\uC131\uC804\uC790", market: "KOSPI", aliases: ["\uC0BC\uC804"] },
    { code: "000660", name: "SK\uD558\uC774\uB2C9\uC2A4", market: "KOSPI", aliases: ["\uD558\uC774\uB2C9\uC2A4", "skh"] },
    { code: "035420", name: "NAVER", market: "KOSPI", aliases: ["\uB124\uC774\uBC84"] },
    { code: "005380", name: "\uD604\uB300\uCC28", market: "KOSPI", aliases: ["\uD604\uCC28"] },
    { code: "012330", name: "\uD604\uB300\uBAA8\uBE44\uC2A4", market: "KOSPI", aliases: ["\uBAA8\uBE44\uC2A4"] },
    { code: "068270", name: "\uC140\uD2B8\uB9AC\uC628", market: "KOSPI", aliases: [] },
    { code: "207940", name: "\uC0BC\uC131\uBC14\uC774\uC624\uB85C\uC9C1\uC2A4", market: "KOSPI", aliases: ["\uC0BC\uBC14"] },
    { code: "373220", name: "LG\uC5D0\uB108\uC9C0\uC194\uB8E8\uC158", market: "KOSPI", aliases: ["\uC5D8\uC9C0\uC5D4\uC194", "lg\uC5D4\uC194"] },
    { code: "051910", name: "LG\uD654\uD559", market: "KOSPI", aliases: [] },
    { code: "006400", name: "\uC0BC\uC131SDI", market: "KOSPI", aliases: [] },
    { code: "035720", name: "\uCE74\uCE74\uC624", market: "KOSPI", aliases: [] },
    { code: "105560", name: "KB\uAE08\uC735", market: "KOSPI", aliases: [] },
    { code: "055550", name: "\uC2E0\uD55C\uC9C0\uC8FC", market: "KOSPI", aliases: [] },
    { code: "034020", name: "\uB450\uC0B0\uC5D0\uB108\uBE4C\uB9AC\uD2F0", market: "KOSPI", aliases: ["\uB450\uBE4C"] },
    { code: "017670", name: "SK\uD154\uB808\uCF64", market: "KOSPI", aliases: ["\uC5D0\uC2A4\uCF00\uC774\uD154\uB808\uCF64"] },
    { code: "032830", name: "\uC0BC\uC131\uC0DD\uBA85", market: "KOSPI", aliases: [] },
    { code: "086790", name: "\uD558\uB098\uAE08\uC735\uC9C0\uC8FC", market: "KOSPI", aliases: ["\uD558\uB098\uAE08\uC735"] },
    { code: "003550", name: "LG", market: "KOSPI", aliases: [] },
    { code: "028260", name: "\uC0BC\uC131\uBB3C\uC0B0", market: "KOSPI", aliases: [] },
    { code: "066570", name: "LG\uC804\uC790", market: "KOSPI", aliases: [] },
    { code: "096770", name: "SK\uC774\uB178\uBCA0\uC774\uC158", market: "KOSPI", aliases: ["sk\uC774\uB178"] },
    { code: "259960", name: "\uD06C\uB798\uD504\uD1A4", market: "KOSPI", aliases: [] },
    { code: "011200", name: "HMM", market: "KOSPI", aliases: ["\uC5D0\uC774\uCE58\uC5E0\uC5E0"] },
    { code: "090430", name: "\uC544\uBAA8\uB808\uD37C\uC2DC\uD53D", market: "KOSPI", aliases: [] },
    { code: "051900", name: "LG\uC0DD\uD65C\uAC74\uAC15", market: "KOSPI", aliases: [] },
    { code: "000270", name: "\uAE30\uC544", market: "KOSPI", aliases: [] },
    { code: "003670", name: "\uD3EC\uC2A4\uCF54\uD4E8\uCC98\uC5E0", market: "KOSPI", aliases: ["\uD3EC\uD4E8"] },
    { code: "036570", name: "\uC5D4\uC528\uC18C\uD504\uD2B8", market: "KOSPI", aliases: ["\uC5D4\uC528"] },
    { code: "000120", name: "CJ\uB300\uD55C\uD1B5\uC6B4", market: "KOSPI", aliases: [] },
    { code: "456040", name: "OCI", market: "KOSPI", aliases: [] },
    { code: "001800", name: "\uC624\uB9AC\uC628\uD640\uB529\uC2A4", market: "KOSPI", aliases: [] },
    { code: "282330", name: "BGF\uB9AC\uD14C\uC77C", market: "KOSPI", aliases: [] },
    { code: "035900", name: "JYP Ent.", market: "KOSDAQ", aliases: ["jyp"] },
    { code: "041510", name: "\uC5D0\uC2A4\uC5E0", market: "KOSDAQ", aliases: ["sm"] },
    { code: "263750", name: "\uD384\uC5B4\uBE44\uC2A4", market: "KOSDAQ", aliases: [] },
    { code: "247540", name: "\uC5D0\uCF54\uD504\uB85C\uBE44\uC5E0", market: "KOSDAQ", aliases: ["\uC5D0\uCF54\uBE44\uC5E0"] },
    { code: "086520", name: "\uC5D0\uCF54\uD504\uB85C", market: "KOSDAQ", aliases: [] },
    { code: "091990", name: "\uC140\uD2B8\uB9AC\uC628\uD5EC\uC2A4\uCF00\uC5B4", market: "KOSDAQ", aliases: [] },
    { code: "196170", name: "\uC54C\uD14C\uC624\uC820", market: "KOSDAQ", aliases: [] },
    { code: "028300", name: "HLB", market: "KOSDAQ", aliases: ["\uC5D0\uC774\uCE58\uC5D8\uBE44"] },
    { code: "095660", name: "\uB124\uC624\uC704\uC988", market: "KOSDAQ", aliases: [] },
    { code: "078340", name: "\uCEF4\uD22C\uC2A4", market: "KOSDAQ", aliases: [] },
    { code: "068760", name: "\uC140\uD2B8\uB9AC\uC628\uC81C\uC57D", market: "KOSDAQ", aliases: [] },
    { code: "066970", name: "\uC5D8\uC564\uC5D0\uD504", market: "KOSDAQ", aliases: [] },
    { code: "022100", name: "\uD3EC\uC2A4\uCF54DX", market: "KOSDAQ", aliases: ["\uD3EC\uB514\uC5D1\uC2A4"] },
    { code: "079370", name: "\uC81C\uC6B0\uC2A4", market: "KOSDAQ", aliases: [] },
    { code: "190510", name: "\uB098\uBB34\uAC00", market: "KOSDAQ", aliases: [] },
    { code: "476550", name: "TIGER \uBBF8\uAD6D30\uB144\uAD6D\uCC44\uCEE4\uBC84\uB4DC\uCF5C\uC561\uD2F0\uBE0C(H)", market: "ETF", aliases: ["tiger \uBBF8\uAD6D30\uB144"] },
    { code: "462330", name: "KODEX 2\uCC28\uC804\uC9C0\uC0B0\uC5C5\uB808\uBC84\uB9AC\uC9C0", market: "ETF", aliases: ["kodex 2\uCC28\uC804\uC9C0"] }
  ];
  var indexWatchSeed = [
    {
      key: "KOSPI",
      name: "KOSPI",
      symbol: "KRX:KOSPI",
      category: "\uC9C0\uC218",
      status: "ready",
      note: "\uAD6D\uB0B4 \uB300\uD45C \uC9C0\uC218 \uD750\uB984\uC744 \uCC28\uD2B8\uC640 \uD568\uAED8 \uD655\uC778\uD558\uB294 \uAE30\uBCF8 \uBCF4\uB4DC\uC785\uB2C8\uB2E4."
    },
    {
      key: "KOSDAQ",
      name: "KOSDAQ",
      symbol: "KRX:KOSDAQ",
      category: "\uC9C0\uC218",
      status: "ready",
      note: "\uC131\uC7A5\uC8FC\uC640 \uC911\uC18C\uD615\uC8FC \uD750\uB984\uC744 \uD568\uAED8 \uBCF4\uB294 \uBCF4\uC870 \uC9C0\uC218\uC785\uB2C8\uB2E4."
    },
    {
      key: "USDKRW",
      name: "\uB2EC\uB7EC / \uC6D0",
      symbol: "KRW=X",
      category: "\uD658\uC728",
      status: "ready",
      note: "\uB124\uC774\uBC84 \uB300\uC2E0 \uBCC4\uB3C4 \uD658\uC728 \uC2DC\uC138 \uC18C\uC2A4\uB85C \uB3D9\uC77C \uCC28\uD2B8 \uD615\uC2DD\uC5D0 \uB9DE\uCDB0 \uD45C\uC2DC\uD569\uB2C8\uB2E4."
    },
    {
      key: "GOLD",
      name: "\uAD6D\uC81C \uAE08",
      symbol: "GC=F",
      category: "\uC6D0\uC790\uC7AC",
      status: "ready",
      note: "\uAD6D\uC81C \uAE08 \uC120\uBB3C \uAE30\uC900\uC73C\uB85C \uAC19\uC740 \uCE74\uB4DC/\uD31D\uC5C5 \uCC28\uD2B8 \uD615\uC2DD\uC5D0 \uB9DE\uCDB0 \uD655\uC7A5\uD588\uC2B5\uB2C8\uB2E4."
    },
    {
      key: "BTC",
      name: "\uBE44\uD2B8\uCF54\uC778",
      symbol: "BTC-USD",
      category: "\uAC00\uC0C1\uC790\uC0B0",
      status: "ready",
      note: "\uBE44\uD2B8\uCF54\uC778 \uB2EC\uB7EC \uAE30\uC900 \uC2DC\uC138\uB97C \uAC19\uC740 \uCE74\uB4DC\uC640 \uCC28\uD2B8 \uD31D\uC5C5 \uD750\uB984\uC73C\uB85C \uD655\uC778\uD569\uB2C8\uB2E4."
    }
  ];
  var fundamentalsGuideText = [
    "\uC7AC\uBB34\uC9C0\uD45C\uB294 \uB124\uC774\uBC84 \uAE08\uC735 \uAE30\uC900 \uCD5C\uADFC 2\uAC1C \uC5F0\uAC04\uACFC \uCD5C\uB300 8\uAC1C \uBD84\uAE30 \uD750\uB984\uC744 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
    "\uBD84\uAE30 \uB370\uC774\uD130\uB294 \uCD5C\uB300 8\uAC1C\uAE4C\uC9C0 \uBCF4\uC5EC\uC8FC\uBA70, \uC2E4\uC81C \uD655\uC815 \uBD84\uAE30\uC640 \uCD94\uC815 \uBD84\uAE30(E)\uB97C \uD45C\uC5D0\uC11C \uBD84\uB9AC\uD574\uC11C \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
    "ETF\uB098 \uC9C0\uC218\uD615 \uC0C1\uD488\uC740 \uAE30\uC5C5 \uC7AC\uBB34\uC81C\uD45C\uAC00 \uC5C6\uC5B4 \uD45C\uC2DC\uB418\uC9C0 \uC54A\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
  ].join("\n");
  var businessAreaGuideText = [
    "\uC0AC\uC5C5 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uB9F5\uC740 \uD604\uC7AC \uAE30\uC5C5\uAC1C\uC694 \uBB38\uC7A5\uC744 \uBC14\uD0D5\uC73C\uB85C \uC790\uB3D9 \uCD94\uC815\uD55C \uC6D0\uD615 \uADF8\uB798\uD504\uC785\uB2C8\uB2E4.",
    "\uC815\uD655\uD55C \uB9E4\uCD9C \uBE44\uC911 \uACF5\uC2DC\uAC00 \uC544\uB2C8\uB77C, \uC5B4\uB5A4 \uC0AC\uC5C5 \uCD95\uC73C\uB85C \uD68C\uC0AC\uB97C \uC774\uD574\uD558\uBA74 \uC88B\uC740\uC9C0 \uBE60\uB974\uAC8C \uBCF4\uC5EC\uC8FC\uB294 \uCC38\uACE0\uC6A9 \uB9F5\uC785\uB2C8\uB2E4.",
    "\uCD94\uD6C4 \uC0AC\uC5C5\uBD80\uBB38 \uB9E4\uCD9C \uBE44\uC911 \uB370\uC774\uD130\uAC00 \uC5F0\uACB0\uB418\uBA74 \uAC19\uC740 UI\uC5D0 \uC2E4\uC81C \uBE44\uC911\uC73C\uB85C \uAD50\uCCB4\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
  ].join("\n");
  var businessAreaPalette = ["#c45a2d", "#177245", "#2563eb", "#d97706", "#7c3aed", "#0f766e"];
  var fundamentalMetricGuides = {
    "\uB9E4\uCD9C\uC561": "\uD68C\uC0AC\uAC00 \uC77C\uC815 \uAE30\uAC04 \uB3D9\uC548 \uC62C\uB9B0 \uC804\uCCB4 \uB9E4\uCD9C\uC785\uB2C8\uB2E4. \uC678\uD615 \uC131\uC7A5 \uC18D\uB3C4\uB97C \uBCFC \uB54C \uBA3C\uC800 \uD655\uC778\uD569\uB2C8\uB2E4.",
    "\uC601\uC5C5\uC774\uC775": "\uBCF8\uC5C5\uC73C\uB85C \uBC8C\uC5B4\uB4E4\uC778 \uC774\uC775\uC785\uB2C8\uB2E4. \uC77C\uD68C\uC131\uBCF4\uB2E4 \uC0AC\uC5C5 \uCCB4\uB825 \uD310\uB2E8\uC5D0 \uB354 \uC720\uC6A9\uD569\uB2C8\uB2E4.",
    "\uC21C\uC774\uC775": "\uC601\uC5C5\uC678\uC190\uC775\uACFC \uC138\uAE08\uAE4C\uC9C0 \uBC18\uC601\uD55C \uCD5C\uC885 \uC774\uC775\uC785\uB2C8\uB2E4. \uC8FC\uC8FC\uC5D0\uAC8C \uADC0\uC18D\uB418\uB294 \uACB0\uACFC\uC5D0 \uAC00\uAE5D\uC2B5\uB2C8\uB2E4.",
    "ROE": "\uC790\uAE30\uC790\uBCF8 \uB300\uBE44 \uC5BC\uB9C8\uB098 \uC774\uC775\uC744 \uB0C8\uB294\uC9C0 \uBCF4\uC5EC\uC8FC\uB294 \uC218\uC775\uC131 \uC9C0\uD45C\uC785\uB2C8\uB2E4. \uB192\uC744\uC218\uB85D \uC790\uBCF8 \uD6A8\uC728\uC774 \uC88B\uC2B5\uB2C8\uB2E4.",
    "\uBD80\uCC44\uBE44\uC728": "\uC790\uAE30\uC790\uBCF8 \uB300\uBE44 \uBD80\uCC44 \uADDC\uBAA8\uC785\uB2C8\uB2E4. \uC77C\uBC18\uC801\uC73C\uB85C \uB108\uBB34 \uB192\uC73C\uBA74 \uC7AC\uBB34 \uBD80\uB2F4\uC774 \uD070 \uD3B8\uC785\uB2C8\uB2E4.",
    "EPS": "\uC8FC\uB2F9\uC21C\uC774\uC775\uC785\uB2C8\uB2E4. \uC21C\uC774\uC775\uC744 \uBC1C\uD589\uC8FC\uC2DD \uC218\uB85C \uB098\uB208 \uAC12\uC73C\uB85C, \uC8FC\uB2F9 \uC774\uC775 \uC218\uC900\uC744 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
    "BPS": "\uC8FC\uB2F9\uC21C\uC790\uC0B0\uC785\uB2C8\uB2E4. \uD68C\uC0AC\uC758 \uC21C\uC790\uC0B0\uC744 \uC8FC\uC2DD \uC218\uB85C \uB098\uB208 \uAC12\uC73C\uB85C, \uC790\uC0B0\uAC00\uCE58 \uCC38\uACE0\uC6A9\uC785\uB2C8\uB2E4.",
    "PER": "\uC8FC\uAC00\uB97C \uC8FC\uB2F9\uC21C\uC774\uC775\uC73C\uB85C \uB098\uB208 \uAC12\uC785\uB2C8\uB2E4. \uC774\uC775 \uB300\uBE44 \uD604\uC7AC \uC8FC\uAC00\uAC00 \uC5BC\uB9C8\uB098 \uBE44\uC2FC\uC9C0 \uBCFC \uB54C \uC501\uB2C8\uB2E4.",
    "PBR": "\uC8FC\uAC00\uB97C \uC8FC\uB2F9\uC21C\uC790\uC0B0\uC73C\uB85C \uB098\uB208 \uAC12\uC785\uB2C8\uB2E4. \uC790\uC0B0\uAC00\uCE58 \uB300\uBE44 \uD604\uC7AC \uC8FC\uAC00 \uC218\uC900\uC744 \uBCFC \uB54C \uC501\uB2C8\uB2E4."
  };
  var fundamentalMetricDefinitions = [
    { key: "revenue", label: "\uB9E4\uCD9C\uC561", digits: 0 },
    { key: "operatingIncome", label: "\uC601\uC5C5\uC774\uC775", digits: 0 },
    { key: "netIncome", label: "\uC21C\uC774\uC775", digits: 0 },
    { key: "roe", label: "ROE", digits: 2, suffix: "%" },
    { key: "debtRatio", label: "\uBD80\uCC44\uBE44\uC728", digits: 2, suffix: "%" },
    { key: "eps", label: "EPS", digits: 0 },
    { key: "bps", label: "BPS", digits: 0 },
    { key: "per", label: "PER", digits: 2 },
    { key: "pbr", label: "PBR", digits: 2 }
  ];
  var timeframes = ["daily", "weekly", "monthly"];
  var timeframeLabels = {
    daily: "\uC77C\uBD09",
    weekly: "\uC8FC\uBD09",
    monthly: "\uC6D4\uBD09"
  };
  var marketWatchTimeframes = ["daily", "weekly", "yearly"];
  var marketWatchTimeframeLabels = {
    daily: "\uC77C\uBD09",
    weekly: "\uC8FC\uBD09",
    yearly: "\uC5F0\uBD09"
  };
  var moversScoreGuideText = [
    "\uC810\uC218\uB294 0~100\uC810\uC73C\uB85C \uACC4\uC0B0\uB429\uB2C8\uB2E4.",
    "\uB4F1\uB77D\uB960: 7% / 12% / 20% \uAD6C\uAC04\uC5D0\uC11C \uAC00\uC810",
    "\uAC70\uB798\uB7C9: 20\uC77C \uD3C9\uADE0 \uB300\uBE44 2\uBC30 \uC774\uC0C1\uC77C \uB54C \uAC00\uC810, 3\uBC30\xB76\uBC30 \uAD6C\uAC04\uC5D0\uC11C \uCD94\uAC00 \uAC00\uC810",
    "\uAE30\uC220 \uC2E0\uD638: 20\uC77C\xB760\uC77C \uACE0\uC810 \uB3CC\uD30C \uB610\uB294 \uC800\uC810 \uC774\uD0C8 \uC2DC \uAC00\uC810",
    "\uC885\uAC00 \uC704\uCE58: \uAE09\uB4F1\uC8FC\uB294 \uACE0\uAC00 \uBD80\uADFC, \uAE09\uB77D\uC8FC\uB294 \uC800\uAC00 \uBD80\uADFC \uC720\uC9C0 \uC2DC \uAC00\uC810",
    "\uAC70\uB798\uB300\uAE08: 300\uC5B5 / 1000\uC5B5 \uC774\uC0C1\uC77C \uB54C \uAC00\uC810",
    "\uD574\uC11D: 80\uC810 \uC774\uC0C1 \uD3ED\uBC1C, 60\uC810 \uC774\uC0C1 \uAC15\uD568, \uADF8 \uBBF8\uB9CC \uAD00\uCC30"
  ].join("\n");
  var swingScoreGuideText = [
    `\uC2A4\uC719 \uC5D4\uC9C4\uC740 \uCD5C\uADFC ${SWING_LOOKBACK_DAYS}\uAC70\uB798\uC77C\uC744 \uAE30\uC900\uC73C\uB85C \uBD05\uB2C8\uB2E4.`,
    "\uCCAB \uB2E8\uACC4\uB294 \uAE30\uC900\uBD09\uC785\uB2C8\uB2E4. \uAC00\uACA9\uACFC \uAC70\uB798\uB7C9\uC774 \uD568\uAED8 \uBD99\uC73C\uBA74\uC11C \uC2DC\uC138\uC758 \uCD95\uC774 \uC138\uC6CC\uC838\uC57C \uD569\uB2C8\uB2E4.",
    "\uADF8 \uB2E4\uC74C\uC740 \uB20C\uB9BC\uC785\uB2C8\uB2E4. \uAC70\uB798\uB7C9\uC774 \uC904\uACE0, \uAE30\uC900\uBD09 \uC800\uC810\uC774\uB098 \uD575\uC2EC \uAC00\uACA9\uB300\uB97C \uD06C\uAC8C \uD6FC\uC190\uD558\uC9C0 \uC54A\uB294 \uC870\uC815\uC774 \uB098\uC640\uC57C \uD569\uB2C8\uB2E4.",
    "\uB20C\uB9BC\uC774 \uCDA9\uBD84\uD788 \uC9C4\uD589\uB418\uBA74 \uBD84\uD560\uB9E4\uC218 \uAD6C\uAC04\uC744 \uB530\uB85C \uC7A1\uC2B5\uB2C8\uB2E4. \uBCF4\uD1B5 \uB3CC\uD30C\uC120 \uADFC\uCC98\uC5D0\uC11C \uBC84\uD2F0\uB294\uC9C0\uC640 \uC774\uD0C8\uC120\uC774 \uBA85\uD655\uD55C\uC9C0\uAC00 \uD575\uC2EC\uC785\uB2C8\uB2E4.",
    "\uC7AC\uB3CC\uD30C\uAC00 \uB098\uC640\uB3C4 \uB108\uBB34 \uBA40\uB9AC \uB2EC\uC544\uB098\uBA74 \uCD94\uACA9\uBCF4\uB2E4 \uD655\uC778 \uAD6C\uAC04\uC73C\uB85C \uB461\uB2C8\uB2E4.",
    "\uC774\uD0C8\uC740 \uAE30\uC900\uBD09 \uC800\uC810\uC774\uB098 \uB20C\uB9BC \uC800\uC810\uC744 \uD6FC\uC190\uD574 \uAD6C\uC870\uAC00 \uBB34\uB108\uC9C4 \uACBD\uC6B0\uC785\uB2C8\uB2E4.",
    "\uD654\uBA74\uC5D0\uB294 \uC810\uC218 \uB300\uC2E0 \uD604\uC7AC \uC0C1\uD0DC\uC640 \uC9C4\uC785 \uAD6C\uAC04, \uC774\uD0C8 \uAE30\uC900\uC744 \uC911\uC2EC\uC73C\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4."
  ].join("\n");
  var MARKET_EVENT_GROUP_ORDER = ["macro", "policy", "market", "earnings", "news"];
  var MARKET_EVENT_CATEGORY_LABELS = {
    earnings: "Earnings",
    macro: "Macro",
    policy: "Policy / Regulation",
    market: "Market",
    news: "Other"
  };
  var MARKET_EVENT_CATEGORY_BADGE_LABELS = {
    earnings: "\uC2E4\uC801",
    macro: "\uB9E4\uD06C\uB85C",
    policy: "\uC815\uCC45",
    market: "\uC2DC\uC7A5",
    news: "\uAE30\uD0C0"
  };
  var MARKET_EVENT_IMPORTANCE_LABELS = {
    high: "High",
    medium: "Medium",
    low: "Low"
  };
  var defaultRecommendationBySymbol = new Map(defaultRecommendationCatalog.map((item) => [item.symbol, item]));
  var persistedUiState = loadUiState();
  var recommendationCatalog = loadCatalog();
  var currentCategory = isValidCategory(persistedUiState?.currentCategory) ? persistedUiState.currentCategory : DEFAULT_CATEGORY;
  var currentLongTermBucket = isValidLongTermBucket(persistedUiState?.currentLongTermBucket) ? persistedUiState.currentLongTermBucket : DEFAULT_LONG_TERM_BUCKET;
  var currentSwingBucket = isValidSwingBucket(persistedUiState?.currentSwingBucket) ? persistedUiState.currentSwingBucket : DEFAULT_SWING_BUCKET;
  var currentAnalysis = null;
  var selectedKey = typeof persistedUiState?.selectedKey === "string" ? persistedUiState.selectedKey : getFilteredInitialKey();
  var activeChart = null;
  var resizeObserver = null;
  var itemsPerPage = PAGE_SIZE_OPTIONS.has(Number(persistedUiState?.itemsPerPage)) ? Number(persistedUiState.itemsPerPage) : 5;
  var currentPage = Number.isInteger(persistedUiState?.currentPage) && persistedUiState.currentPage > 0 ? persistedUiState.currentPage : 1;
  var activeView = resolveInitialAppView(persistedUiState?.activeView);
  var hasLoadedMovers = false;
  var stockSearchQuery = "";
  var selectedStockOption = null;
  var stockSearchUniverse = [];
  var stockUniverseLoaded = false;
  var stockUniverseLoading = false;
  var marketWatchItems = /* @__PURE__ */ new Map();
  var marketWatchLoaded = false;
  var marketWatchLoading = false;
  var marketWatchChartState = null;
  var marketWatchChartViewportByKey = /* @__PURE__ */ new Map();
  var marketWatchTimeframeByKey = new Map(indexWatchSeed.map((item) => [item.key, "daily"]));
  var activeMarketWatchKey = null;
  var marketWatchRefreshTimer = null;
  var marketEventCalendarPayload = null;
  var marketEventCalendarLoaded = false;
  var marketEventCalendarLoading = false;
  var marketEventCalendarError = "";
  var marketEventCalendarSelectedDate = "";
  var marketEventCalendarVisibleMonth = "";
  var marketEventCalendarExpandedGroups = /* @__PURE__ */ new Set();
  var stockModalPointerDownOnBackdrop = false;
  var marketEventModalPointerDownOnBackdrop = false;
  var serverLongTermPicksLoaded = false;
  var serverSwingPicksLoaded = false;
  var recommendationUniverseScanLoading = false;
  var swingPatternByKey = /* @__PURE__ */ new Map();
  var realtimeStockSnapshots = /* @__PURE__ */ new Map();
  var stockSnapshotRefreshTimer = null;
  var stockSnapshotLoading = false;
  var lastVisibleStockSnapshotSignature = "";
  var activeAnalysisRefreshTimer = null;
  var activeAnalysisRealtimeLoading = false;
  var serverRecommendationRefreshTimer = null;
  var serverRecommendationSyncInFlight = false;
  var latestRiseMovers = [];
  var latestFallMovers = [];
  var appTabs = document.querySelector("#appTabs");
  var newsView = document.querySelector("#newsView");
  var indexView = document.querySelector("#indexView");
  var analysisView = document.querySelector("#analysisView");
  var moversView = document.querySelector("#moversView");
  var stockSelector = document.querySelector("#stockSelector");
  var results = document.querySelector("#results");
  var summaryBar = document.querySelector("#summaryBar");
  var errorBox = document.querySelector("#errorBox");
  var statusBadge = document.querySelector("#statusBadge");
  var pageSizeSelect = document.querySelector("#pageSizeSelect");
  var pageStatus = document.querySelector("#pageStatus");
  var prevPageBtn = document.querySelector("#prevPageBtn");
  var nextPageBtn = document.querySelector("#nextPageBtn");
  var runUniverseRecommendationBtn = document.querySelector("#runUniverseRecommendationBtn");
  var openAddStockBtn = document.querySelector("#openAddStockBtn");
  var recommendationScopeTitle = document.querySelector("#recommendationScopeTitle");
  var recommendationScopeHelp = document.querySelector("#recommendationScopeHelp");
  var stockModal = document.querySelector("#stockModal");
  var stockModalTitle = document.querySelector("#stockModalTitle");
  var closeStockModalBtn = document.querySelector("#closeStockModalBtn");
  var cancelStockModalBtn = document.querySelector("#cancelStockModalBtn");
  var indexChartModal = document.querySelector("#indexChartModal");
  var closeIndexChartModalBtn = document.querySelector("#closeIndexChartModalBtn");
  var indexChartModalTitle = document.querySelector("#indexChartModalTitle");
  var indexChartModalMeta = document.querySelector("#indexChartModalMeta");
  var indexChartModalPrice = document.querySelector("#indexChartModalPrice");
  var indexChartModalChange = document.querySelector("#indexChartModalChange");
  var indexChartModalToolbar = document.querySelector("#indexChartModalToolbar");
  var indexChartModalLegend = document.querySelector("#indexChartModalLegend");
  var indexChartModalContainer = document.querySelector("#indexChartModalContainer");
  var indexChartModalTooltip = document.querySelector("#indexChartModalTooltip");
  var indexChartModalStartDate = document.querySelector("#indexChartModalStartDate");
  var indexChartModalEndDate = document.querySelector("#indexChartModalEndDate");
  var swingScoreModal = document.querySelector("#swingScoreModal");
  var closeSwingScoreModalBtn = document.querySelector("#closeSwingScoreModalBtn");
  var swingScoreModalMeta = document.querySelector("#swingScoreModalMeta");
  var swingScoreModalBody = document.querySelector("#swingScoreModalBody");
  var marketEventModal = document.querySelector("#marketEventModal");
  var closeMarketEventModalBtn = document.querySelector("#closeMarketEventModalBtn");
  var marketEventModalMeta = document.querySelector("#marketEventModalMeta");
  var marketEventModalBody = document.querySelector("#marketEventModalBody");
  var stockForm = document.querySelector("#stockForm");
  var stockSearchInput = document.querySelector("#stockSearchInput");
  var stockSearchResults = document.querySelector("#stockSearchResults");
  var selectedStockCard = document.querySelector("#selectedStockCard");
  var indexWatchList = document.querySelector("#indexWatchList");
  var marketEventCalendarBoard = document.querySelector("#marketEventCalendarBoard");
  var moversRiseThemesList = document.querySelector("#moversRiseThemesList");
  var moversFallThemesList = document.querySelector("#moversFallThemesList");
  var stockNameInput = document.querySelector("#stockNameInput");
  var stockSymbolInput = document.querySelector("#stockSymbolInput");
  var stockPriceInput = document.querySelector("#stockPriceInput");
  var stockDateInput = document.querySelector("#stockDateInput");
  var stockCategoryTabs = document.querySelector("#stockCategoryTabs");
  var longTermBucketTabs = document.querySelector("#longTermBucketTabs");
  var swingBucketTabs = document.querySelector("#swingBucketTabs");
  var stockCategorySelect = document.querySelector("#stockCategorySelect");
  var longTermBucketField = document.querySelector("#longTermBucketField");
  var longTermBucketSelect = document.querySelector("#longTermBucketSelect");
  var stockNoteInput = document.querySelector("#stockNoteInput");
  var moversStatusBadge = document.querySelector("#moversStatusBadge");
  var moversSummaryBar = document.querySelector("#moversSummaryBar");
  var moversErrorBox = document.querySelector("#moversErrorBox");
  var moversMarketSelect = document.querySelector("#moversMarketSelect");
  var moversLimitSelect = document.querySelector("#moversLimitSelect");
  var moversMinChangeInput = document.querySelector("#moversMinChangeInput");
  var moversMinVolumeInput = document.querySelector("#moversMinVolumeInput");
  var moversMinScoreInput = document.querySelector("#moversMinScoreInput");
  var refreshMoversBtn = document.querySelector("#refreshMoversBtn");
  var riseMoversList = document.querySelector("#riseMoversList");
  var fallMoversList = document.querySelector("#fallMoversList");
  var riseCountLabel = document.querySelector("#riseCountLabel");
  var fallCountLabel = document.querySelector("#fallCountLabel");
  var scoreGuideIcons = document.querySelectorAll("[data-score-guide]");
  initializeApp();
  appTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) {
      return;
    }
    const view = button.dataset.view;
    if (!view || view === activeView) {
      return;
    }
    switchAppView(view);
  });
  window.addEventListener("hashchange", () => {
    const hashView = resolveHashAppView();
    if (!hashView || hashView === activeView) {
      return;
    }
    switchAppView(hashView);
  });
  window.addEventListener("focus", () => {
    void syncServerRecommendations({ silent: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncServerRecommendations({ silent: true });
    }
  });
  indexWatchList?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-index-open]");
    if (!trigger) {
      return;
    }
    const key = trigger.dataset.indexOpen;
    if (!key) {
      return;
    }
    openIndexChartModal(key);
  });
  marketEventCalendarBoard?.addEventListener("click", (event) => {
    const navigationButton = event.target.closest("[data-calendar-nav]");
    if (navigationButton) {
      const direction = navigationButton.dataset.calendarNav;
      if (direction === "prev" || direction === "next") {
        marketEventCalendarVisibleMonth = addMonthsToMonthKey(
          marketEventCalendarVisibleMonth || getMonthKeyFromDate(getTodayInSeoulDateText()),
          direction === "prev" ? -1 : 1
        );
        renderMarketEventCalendarBoard();
      }
      return;
    }
    const dateButton = event.target.closest("[data-calendar-date]");
    if (dateButton) {
      const nextDate = dateButton.dataset.calendarDate;
      if (nextDate) {
        marketEventCalendarSelectedDate = nextDate;
        marketEventCalendarVisibleMonth = getMonthKeyFromDate(nextDate);
        marketEventCalendarExpandedGroups = /* @__PURE__ */ new Set();
        renderMarketEventCalendarBoard();
        openMarketEventModal(nextDate);
      }
      return;
    }
    const expandButton = event.target.closest("[data-event-group-expand]");
    if (expandButton) {
      const groupKey = expandButton.dataset.eventGroupExpand;
      if (groupKey) {
        if (marketEventCalendarExpandedGroups.has(groupKey)) {
          marketEventCalendarExpandedGroups.delete(groupKey);
        } else {
          marketEventCalendarExpandedGroups.add(groupKey);
        }
        renderMarketEventCalendarBoard();
      }
    }
  });
  indexChartModalToolbar?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index-timeframe]");
    if (!button || !activeMarketWatchKey) {
      return;
    }
    const timeframe = button.dataset.indexTimeframe;
    if (!marketWatchTimeframes.includes(timeframe)) {
      return;
    }
    if (marketWatchTimeframeByKey.get(activeMarketWatchKey) === timeframe) {
      return;
    }
    marketWatchTimeframeByKey.set(activeMarketWatchKey, timeframe);
    renderIndexChartModal();
  });
  stockSelector.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-key]");
    if (deleteButton) {
      const key2 = deleteButton.dataset.deleteKey;
      if (key2) {
        removeStock(key2);
      }
      return;
    }
    const button = event.target.closest("[data-stock-key]");
    if (!button) {
      return;
    }
    const key = button.dataset.stockKey;
    if (!key) {
      return;
    }
    selectedKey = key;
    renderSelector();
    await runAnalysisByKey(key);
  });
  pageSizeSelect.addEventListener("change", () => {
    itemsPerPage = Number(pageSizeSelect.value) || 10;
    currentPage = 1;
    renderSelector();
  });
  stockCategoryTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }
    const category = button.dataset.category;
    if (!category || category === currentCategory) {
      return;
    }
    currentCategory = category;
    currentPage = 1;
    selectedKey = getFilteredCatalog()[0]?.key ?? null;
    startStockSnapshotAutoRefresh();
    renderCategoryTabs();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    renderSelector();
    if (selectedKey) {
      void runAnalysisByKey(selectedKey);
      return;
    }
    renderEmptyResultsForCurrentFilter();
  });
  longTermBucketTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-long-term-bucket]");
    if (!button || currentCategory !== DEFAULT_CATEGORY) {
      return;
    }
    const nextBucket = button.dataset.longTermBucket;
    if (!isValidLongTermBucket(nextBucket) || nextBucket === currentLongTermBucket) {
      return;
    }
    currentLongTermBucket = nextBucket;
    currentPage = 1;
    selectedKey = getFilteredCatalog()[0]?.key ?? null;
    renderLongTermBucketTabs();
    renderSelector();
    if (selectedKey) {
      void runAnalysisByKey(selectedKey);
      return;
    }
    renderEmptyResultsForCurrentFilter();
  });
  swingBucketTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-swing-bucket]");
    if (!button || currentCategory !== "swing") {
      return;
    }
    const nextBucket = button.dataset.swingBucket;
    if (!isValidSwingBucket(nextBucket) || nextBucket === currentSwingBucket) {
      return;
    }
    currentSwingBucket = nextBucket;
    currentPage = 1;
    selectedKey = getFilteredCatalog()[0]?.key ?? null;
    renderSwingBucketTabs();
    renderSelector();
    if (selectedKey) {
      void runAnalysisByKey(selectedKey);
      return;
    }
    renderEmptyResultsForCurrentFilter();
  });
  prevPageBtn.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    renderSelector();
  });
  nextPageBtn.addEventListener("click", () => {
    currentPage = Math.min(getTotalPages(), currentPage + 1);
    renderSelector();
  });
  runUniverseRecommendationBtn?.addEventListener("click", () => {
    void runRecommendationUniverseScan();
  });
  openAddStockBtn.addEventListener("click", () => {
    openStockModal();
  });
  closeStockModalBtn.addEventListener("click", closeStockModal);
  cancelStockModalBtn.addEventListener("click", closeStockModal);
  closeIndexChartModalBtn?.addEventListener("click", closeIndexChartModal);
  closeSwingScoreModalBtn?.addEventListener("click", closeSwingScoreModal);
  closeMarketEventModalBtn?.addEventListener("click", closeMarketEventModal);
  stockModal.addEventListener("pointerdown", (event) => {
    stockModalPointerDownOnBackdrop = event.target === stockModal;
  });
  stockModal.addEventListener("click", (event) => {
    if (event.target === stockModal && stockModalPointerDownOnBackdrop) {
      closeStockModal();
    }
    stockModalPointerDownOnBackdrop = false;
  });
  indexChartModal?.addEventListener("click", (event) => {
    if (event.target === indexChartModal) {
      closeIndexChartModal();
    }
  });
  swingScoreModal?.addEventListener("click", (event) => {
    if (event.target === swingScoreModal) {
      closeSwingScoreModal();
    }
  });
  marketEventModal?.addEventListener("pointerdown", (event) => {
    marketEventModalPointerDownOnBackdrop = event.target === marketEventModal;
  });
  marketEventModal?.addEventListener("click", (event) => {
    if (event.target === marketEventModal && marketEventModalPointerDownOnBackdrop) {
      closeMarketEventModal();
    }
    marketEventModalPointerDownOnBackdrop = false;
  });
  marketEventModalBody?.addEventListener("click", (event) => {
    const expandButton = event.target.closest("[data-event-group-expand]");
    if (!expandButton) {
      return;
    }
    const groupKey = expandButton.dataset.eventGroupExpand;
    if (!groupKey) {
      return;
    }
    if (marketEventCalendarExpandedGroups.has(groupKey)) {
      marketEventCalendarExpandedGroups.delete(groupKey);
    } else {
      marketEventCalendarExpandedGroups.add(groupKey);
    }
    renderMarketEventModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stockModal.classList.contains("hidden")) {
      closeStockModal();
      return;
    }
    if (event.key === "Escape" && indexChartModal && !indexChartModal.classList.contains("hidden")) {
      closeIndexChartModal();
      return;
    }
    if (event.key === "Escape" && swingScoreModal && !swingScoreModal.classList.contains("hidden")) {
      closeSwingScoreModal();
      return;
    }
    if (event.key === "Escape" && marketEventModal && !marketEventModal.classList.contains("hidden")) {
      closeMarketEventModal();
    }
  });
  stockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = buildStockFromForm();
    if (!item) {
      return;
    }
    recommendationCatalog = [...recommendationCatalog, item];
    currentCategory = item.category ?? DEFAULT_CATEGORY;
    if (item.category !== "swing") {
      currentLongTermBucket = item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET;
    }
    startStockSnapshotAutoRefresh();
    selectedKey = item.key;
    currentPage = getTotalPagesForCount(getFilteredCatalog().length);
    saveCatalog();
    if (item.category === "swing") {
      await refreshSwingPatternSnapshots();
    }
    closeStockModal();
    renderCategoryTabs();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    renderSelector();
    await runAnalysisByKey(item.key);
  });
  stockSearchInput?.addEventListener("input", () => {
    stockSearchQuery = stockSearchInput.value.trim();
    if (selectedStockOption && stockSearchInput.value.trim() !== `${selectedStockOption.name} (${selectedStockOption.code})`) {
      clearSelectedStockOption();
    }
    renderStockSearchResults();
  });
  stockCategorySelect?.addEventListener("change", () => {
    syncLongTermBucketField();
  });
  stockSearchResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stock-code]");
    if (!button) {
      return;
    }
    const code = button.dataset.stockCode;
    if (!code) {
      return;
    }
    const item = stockSearchUniverse.find((candidate) => candidate.code === code);
    if (!item) {
      return;
    }
    selectStockOption(item);
  });
  refreshMoversBtn?.addEventListener("click", async () => {
    await loadMovers();
  });
  results.addEventListener("click", (event) => {
    const fundamentalsButton = event.target.closest("[data-fundamentals-scroll]");
    if (fundamentalsButton) {
      const targetId = fundamentalsButton.dataset.fundamentalsTarget;
      const direction = fundamentalsButton.dataset.fundamentalsScroll;
      if (targetId && direction) {
        const container = document.getElementById(targetId);
        if (container) {
          const distance = Math.max(container.clientWidth * 0.72, 220);
          container.scrollBy({
            left: direction === "prev" ? -distance : distance,
            behavior: "smooth"
          });
        }
      }
      return;
    }
    const scoreExplainButton = event.target.closest("[data-score-explain-toggle]");
    if (scoreExplainButton) {
      openSwingScoreModal(scoreExplainButton);
      return;
    }
    const button = event.target.closest("[data-timeframe]");
    if (!button || !currentAnalysis) {
      return;
    }
    const timeframe = button.dataset.timeframe;
    if (!timeframes.includes(timeframe)) {
      return;
    }
    currentAnalysis.activeTimeframe = timeframe;
    updateChartView(timeframe);
  });
  async function initializeApp() {
    stockSearchUniverse = buildStockSearchUniverse();
    await loadServerLongTermPicks();
    await loadServerSwingPicks();
    await refreshSwingPatternSnapshots();
    restoreUiState();
    applyScoreGuideTooltips();
    renderAppTabs();
    renderCategoryTabs();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    updateUniverseRecommendationButton();
    syncLongTermBucketField();
    renderIndexWatchList();
    renderMarketEventCalendarBoard();
    renderMoversThemeLists();
    renderSelector();
    renderStockSearchResults();
    if (selectedKey) {
      void runAnalysisByKey(selectedKey);
    }
    void loadStockUniverse();
    void loadMarketWatch();
    void loadMarketEventCalendar();
    void loadMovers({ background: true, preserveMoversUi: true });
    void loadRealtimeStockSnapshots({ background: true });
    startMarketWatchAutoRefresh();
    startStockSnapshotAutoRefresh();
    startActiveAnalysisAutoRefresh();
    startServerRecommendationAutoRefresh();
  }
  function startServerRecommendationAutoRefresh() {
    if (serverRecommendationRefreshTimer) {
      clearInterval(serverRecommendationRefreshTimer);
    }
    serverRecommendationRefreshTimer = window.setInterval(() => {
      void syncServerRecommendations({ silent: true });
    }, SERVER_RECOMMENDATION_REFRESH_INTERVAL_MS);
  }
  function mergeRecommendations(baseItems, incomingItems) {
    const merged = /* @__PURE__ */ new Map();
    for (const item of baseItems) {
      const normalized = normalizeRecommendation(item);
      merged.set(normalized.key, normalized);
    }
    for (const item of incomingItems) {
      const normalized = normalizeRecommendation(item);
      if (!merged.has(normalized.key)) {
        merged.set(normalized.key, normalized);
      }
    }
    return [...merged.values()];
  }
  function isServerUniverseRecommendation(item) {
    return item?.source === "server-universe";
  }
  function syncServerLongTermRecommendations(baseItems, incomingItems) {
    const preserved = baseItems.filter((item) => (item.category ?? DEFAULT_CATEGORY) !== DEFAULT_CATEGORY || !isServerUniverseRecommendation(item));
    const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
    return mergeRecommendations(normalizedIncoming, preserved);
  }
  function syncServerSwingRecommendations(baseItems, incomingItems) {
    const preserved = baseItems.filter((item) => (item.category ?? DEFAULT_CATEGORY) !== "swing" || !isServerUniverseRecommendation(item));
    const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
    return mergeRecommendations(normalizedIncoming, preserved);
  }
  function syncSelectedKeyWithCatalog() {
    const visibleKeys = new Set(recommendationCatalog.map((item) => item.key));
    const filteredKeys = new Set(getFilteredCatalog().map((item) => item.key));
    if (!selectedKey || !visibleKeys.has(selectedKey) || !filteredKeys.has(selectedKey)) {
      selectedKey = getFilteredInitialKey();
    }
  }
  async function loadServerLongTermPicks(force = false) {
    if (serverLongTermPicksLoaded && !force) {
      return false;
    }
    try {
      const response = await fetch("/analysis/server-long-term-picks");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC11C\uBC84 \uC911\uC7A5\uAE30 \uC885\uBAA9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      const nextCatalog = syncServerLongTermRecommendations(recommendationCatalog, items);
      const changed = JSON.stringify(nextCatalog) !== JSON.stringify(recommendationCatalog);
      recommendationCatalog = nextCatalog;
      if (changed) {
        saveCatalog();
      }
      syncSelectedKeyWithCatalog();
      return changed;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      serverLongTermPicksLoaded = true;
    }
  }
  async function loadServerSwingPicks(force = false) {
    if (serverSwingPicksLoaded && !force) {
      return false;
    }
    try {
      const response = await fetch("/analysis/server-swing-picks");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC11C\uBC84 \uC2A4\uC719 \uC885\uBAA9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const executionItems = Array.isArray(payload.executionItems) ? payload.executionItems : [];
      const watchItems = Array.isArray(payload.watchItems) ? payload.watchItems : [];
      const items = executionItems.length || watchItems.length ? [
        ...executionItems.map((item) => ({ ...item, bucket: "execution" })),
        ...watchItems.map((item) => ({ ...item, bucket: "watch" }))
      ] : Array.isArray(payload.items) ? payload.items : [];
      const nextCatalog = syncServerSwingRecommendations(recommendationCatalog, items);
      const changed = JSON.stringify(nextCatalog) !== JSON.stringify(recommendationCatalog);
      recommendationCatalog = nextCatalog;
      if (changed) {
        saveCatalog();
      }
      const visibleKeys = new Set(recommendationCatalog.map((item) => item.key));
      for (const key of [...swingPatternByKey.keys()]) {
        if (!visibleKeys.has(key)) {
          swingPatternByKey.delete(key);
        }
      }
      syncSelectedKeyWithCatalog();
      return changed;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      serverSwingPicksLoaded = true;
    }
  }
  async function syncServerRecommendations(options = {}) {
    if (serverRecommendationSyncInFlight) {
      return;
    }
    serverRecommendationSyncInFlight = true;
    try {
      const [longTermChanged, swingChanged] = await Promise.all([
        loadServerLongTermPicks(true),
        loadServerSwingPicks(true)
      ]);
      if (!longTermChanged && !swingChanged) {
        return;
      }
      if (swingChanged) {
        await refreshSwingPatternSnapshots();
      }
      renderCategoryTabs();
      renderLongTermBucketTabs();
      renderSwingBucketTabs();
      renderSelector();
      if (selectedKey) {
        await runAnalysisByKey(selectedKey);
      }
      if (!options.silent) {
        const swingItems = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing");
        const executionCount = swingItems.filter((item) => item.swingBucket === "execution").length;
        const watchCount = swingItems.filter((item) => item.swingBucket === "watch").length;
        showSummary(`\uC11C\uBC84 \uCD94\uCC9C \uC885\uBAA9\uC744 \uB2E4\uC2DC \uBC18\uC601\uD588\uC2B5\uB2C8\uB2E4. \uC2A4\uC719 \uB9E4\uC218\uD6C4\uBCF4 ${executionCount}\uAC1C / \uAD00\uC2EC\uD6C4\uBCF4 ${watchCount}\uAC1C\uC785\uB2C8\uB2E4.`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      serverRecommendationSyncInFlight = false;
    }
  }
  async function refreshSwingPatternSnapshots() {
    const swingItems = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing");
    if (!swingItems.length) {
      swingPatternByKey = /* @__PURE__ */ new Map();
      return;
    }
    try {
      const response = await fetch("/analysis/smart-money-patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: swingItems.map((item) => ({
            name: item.name,
            symbol: item.symbol,
            note: item.note
          })),
          filters: {
            lookbackTradingDays: SWING_LOOKBACK_DAYS
          }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC2A4\uC719 \uD328\uD134 \uC0C1\uD0DC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const bySymbol = new Map(swingItems.map((item) => [item.symbol, item.key]));
      const next = /* @__PURE__ */ new Map();
      for (const analysis of Array.isArray(payload.analyses) ? payload.analyses : []) {
        const key = bySymbol.get(analysis.symbol);
        if (key) {
          next.set(key, analysis);
        }
      }
      swingPatternByKey = next;
    } catch (error) {
      console.error(error);
    }
  }
  function renderAppTabs() {
    if (appTabs) {
      for (const tab of appTabs.querySelectorAll("[data-view]")) {
        tab.classList.toggle("active", tab.dataset.view === activeView);
      }
    }
    newsView?.classList.toggle("hidden", activeView !== "news");
    indexView?.classList.toggle("hidden", activeView !== "index");
    analysisView?.classList.toggle("hidden", activeView !== "analysis");
    moversView?.classList.toggle("hidden", activeView !== "movers");
  }
  function getMarketWatchMovingAverageConfig(timeframe) {
    if (timeframe === "weekly") {
      return [
        { key: "fast", label: "5\uC8FC\uC120", period: 5, className: "fast-line", color: "#177245" },
        { key: "short", label: "20\uC8FC\uC120", period: 20, className: "short-line", color: "#d84c3f" },
        { key: "long", label: "60\uC8FC\uC120", period: 60, className: "long-line", color: "#2563eb" }
      ];
    }
    if (timeframe === "yearly") {
      return [
        { key: "short", label: "3\uB144\uC120", period: 3, className: "short-line", color: "#d84c3f" },
        { key: "long", label: "5\uB144\uC120", period: 5, className: "long-line", color: "#2563eb" }
      ];
    }
    return [
      { key: "fast", label: "5\uC77C\uC120", period: 5, className: "fast-line", color: "#177245" },
      { key: "short", label: "20\uC77C\uC120", period: 20, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "60\uC77C\uC120", period: 60, className: "long-line", color: "#2563eb" }
    ];
  }
  function renderIndexWatchList() {
    if (!indexWatchList) {
      return;
    }
    indexWatchList.innerHTML = indexWatchSeed.map((item) => {
      const snapshot = marketWatchItems.get(item.key);
      const trendClass = snapshot?.changePercent > 0 ? "positive" : snapshot?.changePercent < 0 ? "negative" : "neutral";
      const priceDirectionClass = snapshot?.changeAmount > 0 ? "positive" : snapshot?.changeAmount < 0 ? "negative" : "neutral";
      const priceDirectionValue = snapshot?.changeAmount;
      const categoryLabel = item.category;
      const pillLabel = item.status === "planned" ? "\uCD94\uAC00 \uC608\uC815" : marketWatchLoading && !snapshot ? "\uBD88\uB7EC\uC624\uB294 \uC911" : snapshot?.error ? "\uC5F0\uB3D9 \uC2E4\uD328" : snapshot?.changePercent != null ? "\uCC28\uD2B8 \uBCF4\uAE30" : "\uC5F0\uB3D9 \uC900\uBE44";
      if (item.status === "ready") {
        return `
          <button class="index-watch-card index-watch-trigger" type="button" data-index-open="${escapeHtml(item.key)}">
            <div class="index-watch-head">
              <div>
                <span class="index-watch-name">${escapeHtml(item.name)}</span>
                <span class="index-watch-meta">${escapeHtml(categoryLabel)} / ${escapeHtml(item.symbol)}</span>
              </div>
              <span class="index-watch-pill ${escapeHtml(item.status)}">${pillLabel}</span>
            </div>
            ${snapshot?.changePercent != null && snapshot?.price != null ? `
                  <div class="index-watch-card-body">
                    <div class="index-watch-card-price ${priceDirectionClass}">
                      <span class="index-watch-card-price-value">${formatDecimal(snapshot.price)}</span>
                      <span class="index-watch-card-price-state">${formatSignedPointDelta(priceDirectionValue)}</span>
                    </div>
                    <div class="index-watch-card-change ${trendClass}">${formatPercent(snapshot.changePercent)}</div>
                    <div class="index-watch-card-hint">\uCE74\uB4DC\uB97C \uB204\uB974\uBA74 \uCC28\uD2B8\uAC00 \uC5F4\uB9BD\uB2C8\uB2E4.</div>
                  </div>
                ` : `
                  <div class="index-watch-placeholder">
                    ${snapshot?.error ? escapeHtml(snapshot.error) : marketWatchLoading ? "\uC9C0\uC218 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4." : "\uC9C0\uC218 \uB370\uC774\uD130\uB97C \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4."}
                  </div>
                `}
          </button>
        `;
      }
      return `
        <article class="index-watch-card planned-card">
          <div class="index-watch-head">
            <div>
              <span class="index-watch-name">${escapeHtml(item.name)}</span>
              <span class="index-watch-meta">${escapeHtml(categoryLabel)} / ${escapeHtml(item.symbol)}</span>
            </div>
            <span class="index-watch-pill ${escapeHtml(item.status)}">${pillLabel}</span>
          </div>
          <div class="index-watch-note">${escapeHtml(item.note)}</div>
        </article>
      `;
    }).join("");
  }
  async function loadMarketEventCalendar(options = {}) {
    if (marketEventCalendarLoading) {
      return;
    }
    const isBackground = Boolean(options.background && marketEventCalendarLoaded);
    marketEventCalendarLoading = true;
    if (!isBackground || !marketEventCalendarPayload) {
      renderMarketEventCalendarBoard();
    }
    try {
      const response = await fetch("/analysis/market-event-calendar");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC2DC\uC7A5 \uC774\uBCA4\uD2B8 \uCE98\uB9B0\uB354\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      marketEventCalendarPayload = {
        generatedAt: payload.generatedAt,
        timezone: payload.timezone,
        events: Array.isArray(payload.events) ? payload.events : [],
        summaries: Array.isArray(payload.summaries) ? payload.summaries : []
      };
      marketEventCalendarLoaded = true;
      marketEventCalendarError = "";
      syncMarketEventCalendarSelection();
    } catch (error) {
      console.error(error);
      marketEventCalendarError = error instanceof Error ? error.message : "\uC2DC\uC7A5 \uC774\uBCA4\uD2B8 \uCE98\uB9B0\uB354\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
      if (!marketEventCalendarPayload) {
        marketEventCalendarSelectedDate = getTodayInSeoulDateText();
        marketEventCalendarVisibleMonth = getMonthKeyFromDate(marketEventCalendarSelectedDate);
      }
    } finally {
      marketEventCalendarLoading = false;
      renderMarketEventCalendarBoard();
    }
  }
  function syncMarketEventCalendarSelection() {
    const today = getTodayInSeoulDateText();
    const dates = getSortedMarketEventDates();
    if (dates.includes(marketEventCalendarSelectedDate)) {
      marketEventCalendarVisibleMonth = marketEventCalendarVisibleMonth || getMonthKeyFromDate(marketEventCalendarSelectedDate);
      return;
    }
    if (dates.includes(today)) {
      marketEventCalendarSelectedDate = today;
    } else {
      marketEventCalendarSelectedDate = dates.find((date) => date >= today) ?? dates[0] ?? today;
    }
    marketEventCalendarVisibleMonth = getMonthKeyFromDate(marketEventCalendarSelectedDate);
    marketEventCalendarExpandedGroups = /* @__PURE__ */ new Set();
  }
  function renderMarketEventCalendarBoard() {
    if (!marketEventCalendarBoard) {
      return;
    }
    const payload = marketEventCalendarPayload ?? {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      timezone: "Asia/Seoul",
      events: [],
      summaries: []
    };
    const selectedDate = marketEventCalendarSelectedDate || getTodayInSeoulDateText();
    const visibleMonth = marketEventCalendarVisibleMonth || getMonthKeyFromDate(selectedDate);
    const eventsByDate = groupMarketEventsByDate(payload.events);
    const summariesByDate = new Map((payload.summaries ?? []).map((summary) => [summary.date, summary]));
    const highImportanceCount = payload.events.filter((event) => event.importance === "high").length;
    const upcomingCount = payload.events.filter((event) => event.date >= getTodayInSeoulDateText()).length;
    const statusKind = marketEventCalendarError ? "error" : marketEventCalendarLoading && !marketEventCalendarLoaded ? "loading" : "done";
    const statusText = marketEventCalendarError ? "\uC624\uB958" : marketEventCalendarLoading && !marketEventCalendarLoaded ? "\uB85C\uB529 \uC911" : `${payload.events.length}\uAC1C \uC77C\uC815`;
    marketEventCalendarBoard.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Market Event Calendar</h2>
        <p class="field-help">\uC2E4\uC801, \uAC70\uC2DC\uC9C0\uD45C, \uC815\uCC45 \uC77C\uC815\uC744 \uB2EC\uB825\uC5D0\uC11C \uD6D1\uACE0 \uC120\uD0DD\uD55C \uB0A0\uC9DC\uC758 \uC0C1\uC138 \uC774\uBCA4\uD2B8\uB97C \uC544\uB798 \uD328\uB110\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.</p>
      </div>
      <span class="status-badge ${statusKind}">${escapeHtml(statusText)}</span>
    </div>
    <div class="market-event-toolbar">
      <div class="market-event-stat-list">
        <span class="market-event-stat-chip">\uC6D4\uAC04 \uC77C\uC815 ${escapeHtml(String(payload.events.length))}\uAC74</span>
        <span class="market-event-stat-chip emphasis">High ${escapeHtml(String(highImportanceCount))}\uAC74</span>
        <span class="market-event-stat-chip">\uC608\uC815 ${escapeHtml(String(upcomingCount))}\uAC74</span>
      </div>
      <div class="market-event-month-nav">
        <button class="ghost-button small-button" type="button" data-calendar-nav="prev">\uC774\uC804</button>
        <strong>${escapeHtml(formatMarketEventMonthLabel(visibleMonth))}</strong>
        <button class="ghost-button small-button" type="button" data-calendar-nav="next">\uB2E4\uC74C</button>
      </div>
    </div>
    ${marketEventCalendarError ? `<div class="error-box market-event-error-box">${escapeHtml(marketEventCalendarError)}</div>` : ""}
    <div class="market-event-panel-body">
      <div class="market-event-calendar-shell">
        ${renderEventCalendarGrid(visibleMonth, summariesByDate, selectedDate)}
      </div>
    </div>
  `;
  }
  function renderEventCalendarGrid(visibleMonth, summariesByDate, selectedDate) {
    const weekdayLabels = ["\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0", "\uC77C"];
    const cells = buildMarketEventCalendarCells(visibleMonth).map(
      (cell) => cell.type === "blank" ? renderEmptyEventCalendarCell() : renderEventCalendarCell(cell, summariesByDate.get(cell.date), selectedDate)
    ).join("");
    return `
    <div class="market-event-calendar-grid">
      <div class="market-event-weekdays">
        ${weekdayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="market-event-cells">
        ${cells}
      </div>
    </div>
  `;
  }
  function renderEmptyEventCalendarCell() {
    return '<div class="market-event-calendar-cell empty" aria-hidden="true"></div>';
  }
  function renderEventCalendarCell(cell, summary, selectedDate) {
    const isSelected = cell.date === selectedDate;
    const isToday = cell.date === getTodayInSeoulDateText();
    const classNames = [
      "market-event-calendar-cell",
      isSelected ? "selected" : "",
      summary ? "has-events" : "",
      summary?.hasHighImportance ? "high-importance" : "",
      isToday ? "today" : ""
    ].filter(Boolean).join(" ");
    const showHighlight = Boolean(summary?.highlightTitle && summary.hasHighImportance);
    return `
    <button class="${classNames}" type="button" data-calendar-date="${escapeHtml(cell.date)}">
      <span class="market-event-calendar-day">${escapeHtml(String(cell.dayNumber))}</span>
      ${summary ? `
            <div class="market-event-calendar-summary">
              <div class="market-event-calendar-counts">
                ${summary.earningsCount ? `<span class="market-event-mini-badge earnings">E${summary.earningsCount}</span>` : ""}
                ${summary.macroCount ? `<span class="market-event-mini-badge macro">M${summary.macroCount}</span>` : ""}
                ${summary.otherCount ? `<span class="market-event-mini-badge other">O${summary.otherCount}</span>` : ""}
              </div>
              <div class="market-event-calendar-flags">
                <span class="market-event-dot-row">
                  ${summary.earningsCount ? '<i class="market-event-dot earnings"></i>' : ""}
                  ${summary.macroCount ? '<i class="market-event-dot macro"></i>' : ""}
                  ${summary.policyCount || summary.marketCount || summary.newsCount ? '<i class="market-event-dot other"></i>' : ""}
                </span>
                ${summary.hasHighImportance ? '<span class="market-event-priority-flag">!</span>' : ""}
              </div>
              ${showHighlight ? `<span class="market-event-calendar-highlight">${escapeHtml(truncateText(summary.highlightTitle, 18))}</span>` : `<span class="market-event-calendar-total">${escapeHtml(String(summary.totalCount))} events</span>`}
            </div>
          ` : '<span class="market-event-calendar-empty">-</span>'}
    </button>
  `;
  }
  function renderEventDetailPanel(selectedDate, events, summary) {
    const grouped = /* @__PURE__ */ new Map();
    for (const event of events) {
      const items = grouped.get(event.category) ?? [];
      items.push(event);
      grouped.set(event.category, items);
    }
    const sections = MARKET_EVENT_GROUP_ORDER.filter((category) => grouped.has(category)).map((category) => {
      const items = grouped.get(category) ?? [];
      const expandKey = `${selectedDate}:${category}`;
      const expanded = marketEventCalendarExpandedGroups.has(expandKey);
      const initialCount = category === "earnings" ? 4 : 5;
      const visibleItems = expanded ? items : items.slice(0, initialCount);
      return `
        <section class="market-event-detail-group">
          <div class="market-event-detail-group-head">
            <div class="market-event-detail-group-title">
              ${renderEventCategoryBadge(category)}
              <strong>${escapeHtml(MARKET_EVENT_CATEGORY_LABELS[category])}</strong>
            </div>
            <span class="market-event-detail-count">${escapeHtml(String(items.length))}\uAC74</span>
          </div>
          <div class="market-event-detail-list">
            ${visibleItems.map((item) => renderEventDetailItem(item)).join("")}
          </div>
          ${items.length > initialCount ? `
                <button class="ghost-button small-button market-event-detail-expand" type="button" data-event-group-expand="${escapeHtml(expandKey)}">
                  ${expanded ? "\uC811\uAE30" : `+${items.length - initialCount} more`}
                </button>
              ` : ""}
        </section>
      `;
    }).join("");
    return `
    <section class="market-event-detail-panel">
      <div class="market-event-detail-head">
        <div>
          <span class="section-meta">Selected Date</span>
          <h3>${escapeHtml(formatKoreanChartDate(selectedDate))}</h3>
          <p class="field-help">
            ${summary ? `\uC2E4\uC801 ${summary.earningsCount}\uAC74 / \uB9E4\uD06C\uB85C ${summary.macroCount}\uAC74 / \uAE30\uD0C0 ${summary.otherCount}\uAC74` : "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uB4F1\uB85D\uB41C \uC774\uBCA4\uD2B8\uAC00 \uC5C6\uC73C\uBA74 \uBE48 \uC0C1\uD0DC\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4."}
          </p>
        </div>
      </div>
      ${sections ? sections : `
            <div class="empty-state market-event-detail-empty">
              <p>\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uC608\uC815\uB41C \uC774\uBCA4\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
              <p>\uC911\uC694 \uC77C\uC815\uC774 \uC788\uB294 \uB0A0\uC9DC\uB97C \uB20C\uB7EC \uC0C1\uC138 \uBAA9\uB85D\uC744 \uD655\uC778\uD558\uC138\uC694.</p>
            </div>
          `}
    </section>
  `;
  }
  function openMarketEventModal(dateText) {
    if (!marketEventModal) {
      return;
    }
    marketEventCalendarSelectedDate = dateText;
    marketEventCalendarExpandedGroups = /* @__PURE__ */ new Set();
    renderMarketEventModal();
    marketEventModal.classList.remove("hidden");
  }
  function closeMarketEventModal() {
    marketEventModal?.classList.add("hidden");
  }
  function renderMarketEventModal() {
    if (!marketEventModalMeta || !marketEventModalBody) {
      return;
    }
    const payload = marketEventCalendarPayload ?? {
      events: [],
      summaries: []
    };
    const selectedDate = marketEventCalendarSelectedDate || getTodayInSeoulDateText();
    const eventsByDate = groupMarketEventsByDate(payload.events);
    const summariesByDate = new Map((payload.summaries ?? []).map((summary) => [summary.date, summary]));
    const selectedEvents = eventsByDate.get(selectedDate) ?? [];
    const selectedSummary = summariesByDate.get(selectedDate);
    marketEventModalMeta.textContent = selectedSummary ? `\uC2E4\uC801 ${selectedSummary.earningsCount}\uAC74 / \uB9E4\uD06C\uB85C ${selectedSummary.macroCount}\uAC74 / \uAE30\uD0C0 ${selectedSummary.otherCount}\uAC74` : "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uC608\uC815\uB41C \uC774\uBCA4\uD2B8\uB97C \uD31D\uC5C5\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.";
    marketEventModalBody.innerHTML = renderEventDetailPanel(selectedDate, selectedEvents, selectedSummary);
  }
  function renderEventDetailItem(event) {
    const meta = [event.time, event.companyName ? `${event.companyName}${event.ticker ? ` (${event.ticker})` : ""}` : event.location].filter(Boolean).join(" / ");
    return `
    <article class="market-event-detail-item">
      <div class="market-event-detail-item-main">
        <div class="market-event-detail-item-top">
          <strong>${escapeHtml(event.title)}</strong>
          <span class="market-event-importance ${escapeHtml(event.importance)}">${escapeHtml(MARKET_EVENT_IMPORTANCE_LABELS[event.importance])}</span>
        </div>
        <div class="market-event-detail-item-meta">
          ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
          <span>${escapeHtml(MARKET_EVENT_CATEGORY_BADGE_LABELS[event.category])}</span>
        </div>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      </div>
    </article>
  `;
  }
  function renderEventCategoryBadge(category) {
    return `<span class="market-event-category-badge ${escapeHtml(category)}">${escapeHtml(MARKET_EVENT_CATEGORY_BADGE_LABELS[category])}</span>`;
  }
  function getSortedMarketEventDates() {
    return [...new Set((marketEventCalendarPayload?.events ?? []).map((event) => event.date))].sort(
      (left, right) => left.localeCompare(right)
    );
  }
  function groupMarketEventsByDate(events) {
    const map = /* @__PURE__ */ new Map();
    for (const event of events ?? []) {
      const items = map.get(event.date) ?? [];
      items.push(event);
      map.set(event.date, items);
    }
    return map;
  }
  function buildMarketEventCalendarCells(monthKey) {
    const firstDate = `${monthKey}-01`;
    const [year, month] = monthKey.split("-").map(Number);
    const firstDateObject = /* @__PURE__ */ new Date(`${firstDate}T00:00:00Z`);
    const weekStartOffset = (firstDateObject.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = Array.from({ length: weekStartOffset }, () => ({ type: "blank" }));
    for (let index = 0; index < daysInMonth; index += 1) {
      const date = addUtcDays(firstDate, index);
      cells.push({
        type: "date",
        date,
        dayNumber: Number(date.slice(8, 10))
      });
    }
    const trailingBlankCount = (7 - (cells.length % 7 || 7)) % 7;
    for (let index = 0; index < trailingBlankCount; index += 1) {
      cells.push({ type: "blank" });
    }
    return cells;
  }
  function getTodayInSeoulDateText() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(/* @__PURE__ */ new Date());
  }
  function getMonthKeyFromDate(dateText) {
    return typeof dateText === "string" ? dateText.slice(0, 7) : "";
  }
  function addMonthsToMonthKey(monthKey, delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(Date.UTC(year, (month ?? 1) - 1 + delta, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  function formatMarketEventMonthLabel(monthKey) {
    const date = /* @__PURE__ */ new Date(`${monthKey}-01T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return monthKey;
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      timeZone: "UTC"
    }).format(date);
  }
  var macroThemeRules = [
    { label: "\uBC18\uB3C4\uCCB4/\uC804\uC790", keywords: ["\uBC18\uB3C4\uCCB4", "\uC804\uC790\uBD80\uD488", "\uC804\uC790\uC9D1\uC801", "\uB514\uC2A4\uD50C\uB808\uC774", "\uAD11\uD559", "\uC13C\uC11C"] },
    { label: "\uC18C\uD504\uD2B8\uC6E8\uC5B4/\uD50C\uB7AB\uD3FC", keywords: ["\uC18C\uD504\uD2B8\uC6E8\uC5B4", "\uC815\uBCF4\uC11C\uBE44\uC2A4", "\uD3EC\uD138", "\uB370\uC774\uD130\uBCA0\uC774\uC2A4", "\uCEF4\uD4E8\uD130 \uD504\uB85C\uADF8\uB798\uBC0D"] },
    { label: "\uD1B5\uC2E0/\uB124\uD2B8\uC6CC\uD06C\uC7A5\uBE44", keywords: ["\uD1B5\uC2E0", "\uBC29\uC1A1 \uC7A5\uBE44", "\uB124\uD2B8\uC6CC\uD06C", "\uBB34\uC120", "\uC720\uC120"] },
    { label: "\uBC14\uC774\uC624/\uD5EC\uC2A4\uCF00\uC5B4", keywords: ["\uC758\uC57D\uD488", "\uC758\uB8CC", "\uC81C\uC57D", "\uBC14\uC774\uC624", "\uAC74\uAC15", "\uC9C4\uB2E8", "\uCE58\uACFC"] },
    { label: "2\uCC28\uC804\uC9C0/\uC18C\uC7AC", keywords: ["\uC804\uC9C0", "\uBC30\uD130\uB9AC", "\uC591\uADF9\uC7AC", "\uC74C\uADF9\uC7AC", "\uB9AC\uD2AC", "\uC18C\uC7AC"] },
    { label: "\uC804\uB825/\uC778\uD504\uB77C", keywords: ["\uC804\uB3D9\uAE30", "\uBC1C\uC804\uAE30", "\uC804\uB825", "\uCF00\uC774\uBE14", "\uC804\uAE30\uC7A5\uBE44", "\uBC30\uC804", "\uBCC0\uC555\uAE30"] },
    { label: "\uAE30\uACC4/\uB85C\uBD07/\uC790\uB3D9\uD654", keywords: ["\uD2B9\uC218\uBAA9\uC801\uC6A9 \uAE30\uACC4", "\uC77C\uBC18\uBAA9\uC801\uC6A9 \uAE30\uACC4", "\uAE30\uACC4\uC7A5\uBE44", "\uB85C\uBD07", "\uC790\uB3D9\uD654", "\uAE08\uD615"] },
    { label: "\uC790\uB3D9\uCC28/\uBD80\uD488", keywords: ["\uC790\uB3D9\uCC28", "\uD2B8\uB808\uC77C\uB7EC", "\uCC28\uCCB4", "\uCC28\uB7C9", "\uB0B4\uC7A5\uC7AC"] },
    { label: "\uD654\uD559/\uC18C\uC7AC", keywords: ["\uD654\uD559", "\uD50C\uB77C\uC2A4\uD2F1", "\uACE0\uBB34", "\uD569\uC131\uC218\uC9C0", "\uB3C4\uB8CC", "\uBE44\uAE08\uC18D\uAD11\uBB3C"] },
    { label: "\uCCA0\uAC15/\uAE08\uC18D", keywords: ["1\uCC28 \uAE08\uC18D", "\uCCA0\uAC15", "\uC8FC\uC870", "\uBE44\uCCA0", "\uAE08\uC18D", "\uC54C\uB8E8\uBBF8\uB284"] },
    { label: "\uAC74\uC124/\uBD80\uB3D9\uC0B0", keywords: ["\uAC74\uC124", "\uD1A0\uBAA9", "\uBD80\uB3D9\uC0B0", "\uC5D4\uC9C0\uB2C8\uC5B4\uB9C1"] },
    { label: "\uC720\uD1B5/\uC18C\uBE44\uC7AC", keywords: ["\uB3C4\uB9E4", "\uC18C\uB9E4", "\uC720\uD1B5", "\uBC31\uD654\uC810", "\uC0DD\uD65C\uC6A9\uD488"] },
    { label: "\uC74C\uC2DD\uB8CC/\uB18D\uC2DD\uD488", keywords: ["\uC2DD\uB8CC\uD488", "\uC74C\uB8CC", "\uB18D\uC5C5", "\uC218\uC0B0", "\uC0AC\uB8CC", "\uCD95\uC0B0"] },
    { label: "\uC5D4\uD130/\uCF58\uD150\uCE20", keywords: ["\uC601\uD654", "\uBE44\uB514\uC624", "\uBC29\uC1A1", "\uC74C\uC545", "\uC624\uB77D", "\uAD11\uACE0", "\uCD9C\uD310", "\uAC8C\uC784"] },
    { label: "\uBB3C\uB958/\uC6B4\uC1A1", keywords: ["\uC6B4\uC218", "\uCC3D\uACE0", "\uC721\uC0C1", "\uD56D\uACF5", "\uD574\uC0C1", "\uBB3C\uB958"] },
    { label: "\uAE08\uC735", keywords: ["\uC740\uD589", "\uBCF4\uD5D8", "\uAE08\uC735", "\uC99D\uAD8C", "\uC5EC\uC2E0"] },
    { label: "\uC5D0\uB108\uC9C0/\uC6D0\uC790\uC7AC", keywords: ["\uC11D\uC720", "\uAC00\uC2A4", "\uAD11\uC5C5", "\uC5D0\uB108\uC9C0", "\uC11D\uD0C4"] }
  ];
  function mapSectorToMacroTheme(sector) {
    if (!sector) {
      return "";
    }
    for (const rule of macroThemeRules) {
      if (rule.keywords.some((keyword) => sector.includes(keyword))) {
        return rule.label;
      }
    }
    return sector;
  }
  function buildMoverThemes(items, direction) {
    const grouped = /* @__PURE__ */ new Map();
    for (const item of items) {
      const sector = getSectorLabel(item.symbol);
      if (!sector) {
        continue;
      }
      const macroTheme = mapSectorToMacroTheme(sector);
      const existing = grouped.get(macroTheme) ?? {
        theme: macroTheme,
        direction,
        items: [],
        sectors: /* @__PURE__ */ new Set()
      };
      existing.items.push(item);
      existing.sectors.add(sector);
      grouped.set(macroTheme, existing);
    }
    return [...grouped.values()].map((group) => {
      const avgScore = group.items.reduce((sum, item) => sum + (item.alertScore ?? 0), 0) / Math.max(group.items.length, 1);
      const avgChangePercent = group.items.reduce((sum, item) => sum + Math.abs(item.changePercent ?? 0), 0) / Math.max(group.items.length, 1);
      const topItems = [...group.items].sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0)).slice(0, 3).map((item) => ({
        name: item.name,
        changePercent: item.changePercent ?? 0
      }));
      return {
        theme: group.theme,
        direction: group.direction,
        count: group.items.length,
        sectorCount: group.sectors.size,
        sectors: [...group.sectors].slice(0, 2),
        avgScore,
        avgChangePercent,
        topItems
      };
    }).sort((left, right) => {
      const countPriority = Number(right.count >= 2) - Number(left.count >= 2);
      if (countPriority !== 0) {
        return countPriority;
      }
      if (right.avgScore !== left.avgScore) {
        return right.avgScore - left.avgScore;
      }
      if (right.avgChangePercent !== left.avgChangePercent) {
        return right.avgChangePercent - left.avgChangePercent;
      }
      return right.count - left.count;
    }).slice(0, 5);
  }
  function renderMoversThemeLists() {
    renderMoversThemeList(moversRiseThemesList, buildMoverThemes(latestRiseMovers, "rise"), "rise");
    renderMoversThemeList(moversFallThemesList, buildMoverThemes(latestFallMovers, "fall"), "fall");
  }
  function renderMoversThemeList(container, themes, direction) {
    if (!container) {
      return;
    }
    if (!hasLoadedMovers) {
      container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "\uAE09\uB4F1" : "\uAE09\uB77D"} \uD14C\uB9C8\uB97C \uACC4\uC0B0\uD558\uB294 \uC911\uC785\uB2C8\uB2E4.</p>
      </div>
    `;
      return;
    }
    if (!themes.length) {
      container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "\uAC15\uD558\uAC8C \uBB36\uC774\uB294 \uAE09\uB4F1 \uC5C5\uC885\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uAC15\uD558\uAC8C \uBB36\uC774\uB294 \uAE09\uB77D \uC5C5\uC885\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4."}</p>
      </div>
    `;
      return;
    }
    container.innerHTML = themes.map((theme, index) => {
      const trendClass = direction === "rise" ? "positive" : "negative";
      const countBadges = [
        theme.sectorCount > 1 ? `<span class="movers-theme-count-badge">\uC5C5\uC885 ${escapeHtml(String(theme.sectorCount))}</span>` : "",
        `<span class="movers-theme-count-badge">\uC885\uBAA9 ${escapeHtml(String(theme.count))}</span>`
      ].filter(Boolean).join("");
      const representatives = theme.topItems.map(
        (item) => `<span class="movers-theme-chip">${escapeHtml(item.name)} <strong class="${trendClass}">${formatPercent(
          item.changePercent
        )}</strong></span>`
      ).join("");
      const sectorSummary = theme.sectors.length ? theme.sectors.join(" / ") : "";
      return `
        <article class="movers-theme-card ${direction}">
          <div class="movers-theme-main">
            <span class="movers-theme-rank">${index + 1}</span>
            <div class="movers-theme-copy">
              <h3>${escapeHtml(theme.theme)}</h3>
              ${sectorSummary ? `<div class="movers-theme-subtitle">${escapeHtml(sectorSummary)}</div>` : ""}
            </div>
          </div>
          <div class="movers-theme-stat">
            <span class="movers-theme-label">\uD3C9\uADE0 \uC810\uC218</span>
            <span class="movers-theme-value">${escapeHtml(String(Math.round(theme.avgScore)))}</span>
          </div>
          <div class="movers-theme-stat">
            <span class="movers-theme-label">\uD3C9\uADE0 \uB4F1\uB77D\uB960</span>
            <span class="movers-theme-value ${trendClass}">${direction === "rise" ? "+" : "-"}${escapeHtml(
        theme.avgChangePercent.toFixed(2)
      )}%</span>
          </div>
          <div class="movers-theme-tail">${countBadges}</div>
          <div class="movers-theme-representatives">${representatives}</div>
        </article>
      `;
    }).join("");
  }
  function switchAppView(view) {
    activeView = APP_VIEWS.includes(view) ? view : "analysis";
    renderAppTabs();
    persistUiState();
    if (activeView === "analysis") {
      void loadRealtimeStockSnapshots({ background: true });
      void refreshCurrentAnalysisRealtime({ background: true });
    }
    if (activeView === "index") {
      if (!marketWatchLoaded && !marketWatchLoading) {
        void loadMarketWatch();
      } else {
        renderIndexWatchList();
      }
      if (!marketEventCalendarLoaded && !marketEventCalendarLoading) {
        void loadMarketEventCalendar();
      } else {
        renderMarketEventCalendarBoard();
      }
    }
    if (activeView === "movers" && !hasLoadedMovers) {
      void loadMovers();
    }
  }
  async function loadMarketWatch(options = {}) {
    if (marketWatchLoading) {
      return;
    }
    const isBackground = Boolean(options.background && marketWatchLoaded);
    marketWatchLoading = true;
    if (!isBackground) {
      renderIndexWatchList();
    }
    try {
      const response = await fetch("/analysis/market-watch");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC9C0\uC218 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      marketWatchItems = new Map(items.map((item) => [item.key, item]));
      marketWatchLoaded = true;
    } catch (error) {
      console.error(error);
    } finally {
      marketWatchLoading = false;
      renderIndexWatchList();
      if (activeMarketWatchKey && indexChartModal && !indexChartModal.classList.contains("hidden")) {
        renderIndexChartModal();
      }
    }
  }
  function startMarketWatchAutoRefresh() {
    if (marketWatchRefreshTimer) {
      clearInterval(marketWatchRefreshTimer);
    }
    marketWatchRefreshTimer = window.setInterval(() => {
      if (activeView !== "index") {
        return;
      }
      void loadMarketWatch({ background: true });
    }, 5e3);
  }
  function cleanupMarketWatchCharts() {
    if (marketWatchChartState) {
      const visibleRange = marketWatchChartState.chart?.timeScale().getVisibleLogicalRange?.();
      if (visibleRange && Number.isFinite(visibleRange.from) && Number.isFinite(visibleRange.to) && marketWatchChartState.viewportKey) {
        marketWatchChartViewportByKey.set(marketWatchChartState.viewportKey, {
          from: visibleRange.from,
          to: visibleRange.to
        });
      }
      marketWatchChartState.resizeObserver?.disconnect();
      marketWatchChartState.chart?.remove();
      marketWatchChartState = null;
    }
  }
  function getMarketWatchViewportKey(snapshotKey, timeframe) {
    return `${snapshotKey}:${timeframe}`;
  }
  function buildIndexMovingAverage(points, period) {
    const result = [];
    for (let index = 0; index < points.length; index += 1) {
      if (index + 1 < period) {
        continue;
      }
      const window2 = points.slice(index - period + 1, index + 1);
      const average = window2.reduce((sum, point) => sum + point.close, 0) / period;
      result.push({
        time: points[index].date,
        value: average
      });
    }
    return result;
  }
  function createMarketWatchChartState(container, tooltip) {
    const chart = (0, import_lightweight_charts_standalone_production.createChart)(container, {
      width: container.clientWidth || 640,
      height: 420,
      layout: {
        background: { type: import_lightweight_charts_standalone_production.ColorType.Solid, color: "#fffaf1" },
        textColor: "#695d4e",
        fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
      },
      grid: {
        vertLines: { color: "rgba(31,26,20,0.04)" },
        horzLines: { color: "rgba(31,26,20,0.06)" }
      },
      crosshair: {
        mode: import_lightweight_charts_standalone_production.CrosshairMode.Normal,
        vertLine: {
          color: "rgba(159,62,25,0.24)",
          width: 1,
          style: import_lightweight_charts_standalone_production.LineStyle.Dashed,
          labelVisible: false
        },
        horzLine: {
          color: "rgba(159,62,25,0.2)",
          width: 1,
          style: import_lightweight_charts_standalone_production.LineStyle.Dashed
        }
      },
      rightPriceScale: {
        borderColor: "rgba(31,26,20,0.08)",
        scaleMargins: {
          top: 0.08,
          bottom: 0.26
        }
      },
      timeScale: {
        borderColor: "rgba(31,26,20,0.08)",
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true
      }
    });
    const candleSeries = chart.addSeries(import_lightweight_charts_standalone_production.CandlestickSeries, {
      upColor: "#d84c3f",
      downColor: "#2f6ee5",
      borderUpColor: "#d84c3f",
      borderDownColor: "#2f6ee5",
      wickUpColor: "#d84c3f",
      wickDownColor: "#2f6ee5",
      priceLineVisible: false
    });
    const volumeSeries = chart.addSeries(import_lightweight_charts_standalone_production.HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0
      }
    });
    const movingAverageSeries = [
      chart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
        color: "#177245",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      }),
      chart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
        color: "#d84c3f",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      }),
      chart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      })
    ];
    const state = {
      chart,
      resizeObserver: null,
      candleSeries,
      volumeSeries,
      movingAverageSeries,
      container,
      tooltip,
      points: [],
      viewportKey: null
    };
    chart.subscribeCrosshairMove((param) => {
      if (!state.tooltip || !param.point || !param.time || !param.seriesData.size) {
        state.tooltip?.classList.add("hidden");
        return;
      }
      const candleData = param.seriesData.get(state.candleSeries);
      if (!candleData || !("open" in candleData)) {
        state.tooltip.classList.add("hidden");
        return;
      }
      const point = state.points.find((candidate) => candidate.date === String(param.time));
      if (!point) {
        state.tooltip.classList.add("hidden");
        return;
      }
      const left = Math.min(param.point.x + 16, state.container.clientWidth - 190);
      const top = Math.max(param.point.y - 16, 12);
      state.tooltip.style.left = `${left}px`;
      state.tooltip.style.top = `${top}px`;
      state.tooltip.classList.remove("hidden");
      state.tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
      <div>\uC2DC\uAC00 ${formatDecimal(candleData.open)}</div>
      <div>\uACE0\uAC00 ${formatDecimal(candleData.high)}</div>
      <div>\uC800\uAC00 ${formatDecimal(candleData.low)}</div>
      <div>\uC885\uAC00 ${formatDecimal(candleData.close)}</div>
      <div>\uAC70\uB798\uB7C9 ${formatNumber(point.volume)}</div>
    `;
    });
    const resizeObserver2 = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver2.observe(container);
    state.resizeObserver = resizeObserver2;
    return state;
  }
  function syncMarketWatchChart({ container, tooltip, snapshot, timeframe }) {
    if (!container) {
      return;
    }
    const chartWindow = snapshot?.chartSets?.[timeframe] ?? snapshot?.chartSets?.daily;
    const points = chartWindow?.points;
    if (!points?.length) {
      return;
    }
    const movingAverageConfig = getMarketWatchMovingAverageConfig(timeframe);
    const viewportKey = getMarketWatchViewportKey(snapshot.key, timeframe);
    const savedViewport = marketWatchChartViewportByKey.get(viewportKey);
    const previousViewportKey = marketWatchChartState?.viewportKey ?? null;
    const currentVisibleRange = marketWatchChartState?.chart?.timeScale().getVisibleLogicalRange?.();
    if (previousViewportKey && previousViewportKey !== viewportKey && currentVisibleRange && Number.isFinite(currentVisibleRange.from) && Number.isFinite(currentVisibleRange.to)) {
      marketWatchChartViewportByKey.set(previousViewportKey, {
        from: currentVisibleRange.from,
        to: currentVisibleRange.to
      });
    }
    if (!marketWatchChartState || marketWatchChartState.container !== container) {
      cleanupMarketWatchCharts();
      marketWatchChartState = createMarketWatchChartState(container, tooltip);
    }
    marketWatchChartState.container = container;
    marketWatchChartState.tooltip = tooltip;
    marketWatchChartState.points = points;
    marketWatchChartState.viewportKey = viewportKey;
    marketWatchChartState.candleSeries.setData(
      points.map((point) => ({
        time: point.date,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close
      }))
    );
    marketWatchChartState.volumeSeries.setData(
      points.map((point) => ({
        time: point.date,
        value: point.volume ?? 0,
        color: (point.close ?? 0) >= (point.open ?? point.close ?? 0) ? "rgba(216,76,63,0.34)" : "rgba(47,110,229,0.3)"
      }))
    );
    for (const [index, series] of marketWatchChartState.movingAverageSeries.entries()) {
      const config = movingAverageConfig[index];
      if (!config) {
        series.setData([]);
        continue;
      }
      series.applyOptions({ color: config.color });
      series.setData(buildIndexMovingAverage(points, config.period));
    }
    if (tooltip) {
      tooltip.classList.add("hidden");
    }
    if (currentVisibleRange && previousViewportKey === viewportKey && Number.isFinite(currentVisibleRange.from) && Number.isFinite(currentVisibleRange.to)) {
      marketWatchChartState.chart.timeScale().setVisibleLogicalRange(currentVisibleRange);
    } else if (savedViewport) {
      marketWatchChartState.chart.timeScale().setVisibleLogicalRange(savedViewport);
    } else {
      setDefaultMarketWatchVisibleRange(marketWatchChartState.chart, points, timeframe);
    }
  }
  function setDefaultMarketWatchVisibleRange(chart, points, timeframe) {
    const visibleSessions = DEFAULT_VISIBLE_MARKET_WATCH_SESSIONS[timeframe] ?? DEFAULT_VISIBLE_TRADING_SESSIONS;
    if (!Array.isArray(points) || !points.length) {
      chart.timeScale().fitContent();
      return;
    }
    const endIndex = points.length - 1;
    const startIndex = Math.max(0, points.length - visibleSessions);
    chart.timeScale().setVisibleLogicalRange({
      from: startIndex - 1,
      to: endIndex + 0.5
    });
  }
  function openIndexChartModal(key) {
    activeMarketWatchKey = key;
    indexChartModal?.classList.remove("hidden");
    window.requestAnimationFrame(() => {
      renderIndexChartModal();
    });
    void loadMarketWatch({ background: true });
  }
  function closeIndexChartModal() {
    activeMarketWatchKey = null;
    cleanupMarketWatchCharts();
    indexChartModal?.classList.add("hidden");
  }
  function openSwingScoreModal(button) {
    if (!swingScoreModal || !swingScoreModalBody || !swingScoreModalMeta) {
      return;
    }
    const label = button.dataset.scoreLabel ?? "\uC0C1\uD0DC";
    const description = decodeURIComponent(button.dataset.scoreDescription ?? "");
    const summary = decodeURIComponent(button.dataset.scoreSummary ?? "");
    const guide = decodeURIComponent(button.dataset.scoreGuide ?? "");
    const action = decodeURIComponent(button.dataset.scoreAction ?? "");
    const entry = decodeURIComponent(button.dataset.scoreEntry ?? "");
    const invalidation = decodeURIComponent(button.dataset.scoreInvalidation ?? "");
    const reasons = JSON.parse(decodeURIComponent(button.dataset.scoreReasons ?? "%5B%5D"));
    swingScoreModalMeta.textContent = label;
    swingScoreModalBody.innerHTML = `
    <div class="swing-pattern-summary">${escapeHtml(summary)}</div>
    <div class="swing-pattern-copy">${escapeHtml(description)}</div>
    ${action ? `<div class="swing-pattern-copy"><strong>\uC804\uB7B5:</strong> ${escapeHtml(action)}</div>` : ""}
    ${entry || invalidation ? `
          <div class="swing-reason-list">
            ${entry ? `<span class="swing-reason-chip">\uC9C4\uC785 \uAD6C\uAC04 ${escapeHtml(entry)}</span>` : ""}
            ${invalidation ? `<span class="swing-reason-chip">\uC774\uD0C8 \uAE30\uC900 ${escapeHtml(invalidation)}</span>` : ""}
          </div>
        ` : ""}
    <div class="swing-pattern-copy">${escapeHtml(guide).replaceAll("\n", "<br>")}</div>
    <div class="swing-reason-list">
      ${(Array.isArray(reasons) ? reasons : []).map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`).join("")}
    </div>
  `;
    swingScoreModal.classList.remove("hidden");
  }
  function closeSwingScoreModal() {
    swingScoreModal?.classList.add("hidden");
  }
  function renderIndexChartModal() {
    if (!activeMarketWatchKey) {
      return;
    }
    const seed = indexWatchSeed.find((item) => item.key === activeMarketWatchKey);
    const snapshot = marketWatchItems.get(activeMarketWatchKey);
    if (!seed || !snapshot || !indexChartModalContainer || !indexChartModalTooltip) {
      return;
    }
    const timeframe = marketWatchTimeframeByKey.get(activeMarketWatchKey) ?? "daily";
    const chartWindow = snapshot.chartSets?.[timeframe] ?? snapshot.chartSets?.daily;
    const movingAverageConfig = getMarketWatchMovingAverageConfig(timeframe);
    const trendClass = snapshot.changePercent > 0 ? "positive" : snapshot.changePercent < 0 ? "negative" : "neutral";
    if (indexChartModalTitle) {
      indexChartModalTitle.textContent = seed.name;
    }
    if (indexChartModalMeta) {
      indexChartModalMeta.textContent = `${seed.category} / ${seed.symbol}`;
    }
    if (indexChartModalPrice) {
      indexChartModalPrice.textContent = formatDecimal(snapshot.price);
    }
    if (indexChartModalChange) {
      indexChartModalChange.className = `index-chart-modal-change ${trendClass}`;
      indexChartModalChange.textContent = `${formatPercent(snapshot.changePercent)} / ${formatSignedDecimal(snapshot.changeAmount)}`;
    }
    if (indexChartModalToolbar) {
      indexChartModalToolbar.innerHTML = marketWatchTimeframes.map(
        (option) => `
          <button
            class="timeframe-tab ${option === timeframe ? "active" : ""}"
            type="button"
            data-index-timeframe="${option}"
          >
            ${marketWatchTimeframeLabels[option]}
          </button>
        `
      ).join("");
    }
    if (indexChartModalLegend) {
      indexChartModalLegend.innerHTML = movingAverageConfig.map(
        (line) => `
          <span class="legend-item"><span class="legend-line ${line.className}"></span>${line.label}</span>
        `
      ).join("");
    }
    if (indexChartModalStartDate) {
      indexChartModalStartDate.textContent = chartWindow?.startDate ?? "-";
    }
    if (indexChartModalEndDate) {
      indexChartModalEndDate.textContent = chartWindow?.endDate ?? "-";
    }
    indexChartModalTooltip.classList.add("hidden");
    syncMarketWatchChart({
      container: indexChartModalContainer,
      tooltip: indexChartModalTooltip,
      snapshot,
      timeframe
    });
  }
  function normalizeSearchText(value) {
    return String(value).trim().toLowerCase().replace(/\s+/g, "");
  }
  function extractChosung(value) {
    return [...String(value)].map((char) => {
      const code = char.charCodeAt(0);
      if (code >= HANGUL_BASE && code <= HANGUL_END) {
        return CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)] ?? char;
      }
      return char;
    }).join("");
  }
  function buildStockSearchUniverse() {
    const unique = /* @__PURE__ */ new Map();
    for (const item of defaultRecommendationCatalog) {
      if (!unique.has(item.symbol)) {
        unique.set(item.symbol, {
          code: item.symbol,
          name: item.name,
          market: "WATCHLIST",
          sector: void 0,
          aliases: []
        });
      }
    }
    for (const item of stockMasterSeed) {
      unique.set(item.code, item);
    }
    return [...unique.values()].map((item) => {
      const aliases = Array.isArray(item.aliases) ? item.aliases : [];
      return {
        ...item,
        aliases,
        sector: item.sector,
        normalizedName: normalizeSearchText(item.name),
        normalizedCode: normalizeSearchText(item.code),
        chosung: extractChosung(item.name),
        normalizedAliases: aliases.map((alias) => normalizeSearchText(alias))
      };
    });
  }
  function mergeStockUniverse(remoteItems) {
    const merged = /* @__PURE__ */ new Map();
    for (const item of buildStockSearchUniverse()) {
      merged.set(item.code, item);
    }
    for (const item of remoteItems) {
      merged.set(item.code, {
        code: item.code,
        name: item.name,
        market: item.market || "KRX",
        sector: item.sector,
        aliases: [],
        normalizedName: normalizeSearchText(item.name),
        normalizedCode: normalizeSearchText(item.code),
        chosung: extractChosung(item.name),
        normalizedAliases: []
      });
    }
    return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  }
  async function loadStockUniverse() {
    if (stockUniverseLoading || stockUniverseLoaded) {
      return;
    }
    stockUniverseLoading = true;
    renderStockSearchResults();
    try {
      const response = await fetch("/analysis/stock-universe");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC804\uCCB4 \uC885\uBAA9 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      stockSearchUniverse = mergeStockUniverse(items);
      stockUniverseLoaded = true;
      repairRecommendationsFromUniverse(items);
      renderMoversThemeLists();
      if (hasLoadedMovers && activeView === "movers") {
        void loadMovers();
      }
    } catch (error) {
      console.error(error);
    } finally {
      stockUniverseLoading = false;
      renderStockSearchResults();
    }
  }
  function repairRecommendationsFromUniverse(items) {
    const universeNameByCode = new Map(
      items.filter((item) => typeof item?.code === "string" && typeof item?.name === "string").map((item) => [item.code, item.name])
    );
    const selectedSymbol = recommendationCatalog.find((item) => item.key === selectedKey)?.symbol ?? null;
    let changed = false;
    recommendationCatalog = recommendationCatalog.map((item) => {
      const repaired = repairRecommendationText(item, universeNameByCode.get(item.symbol));
      if (repaired.name !== item.name || repaired.key !== item.key || repaired.note !== item.note) {
        changed = true;
      }
      return repaired;
    });
    if (!changed) {
      return;
    }
    if (selectedSymbol) {
      selectedKey = recommendationCatalog.find((item) => item.symbol === selectedSymbol)?.key ?? selectedKey;
    }
    saveCatalog();
    renderSelector();
    if (selectedKey) {
      const repairedSelected = recommendationCatalog.find((item) => item.key === selectedKey);
      if (repairedSelected) {
        void runAnalysisByKey(repairedSelected.key);
      }
    }
  }
  function getStockSearchResults(query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return stockSearchUniverse.slice(0, 12);
    }
    const ranked = stockSearchUniverse.map((item) => {
      let score = 0;
      if (item.normalizedCode === normalizedQuery) {
        score += 120;
      } else if (item.normalizedCode.startsWith(normalizedQuery)) {
        score += 100;
      }
      if (item.normalizedName === normalizedQuery) {
        score += 95;
      } else if (item.normalizedName.startsWith(normalizedQuery)) {
        score += 80;
      } else if (item.normalizedName.includes(normalizedQuery)) {
        score += 55;
      }
      if (item.chosung.startsWith(query)) {
        score += 70;
      } else if (item.chosung.includes(query)) {
        score += 45;
      }
      if (item.normalizedAliases.some((alias) => alias === normalizedQuery)) {
        score += 60;
      } else if (item.normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))) {
        score += 40;
      }
      return { item, score };
    }).filter((entry) => entry.score > 0).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.item.name.localeCompare(right.item.name, "ko");
    });
    return ranked.slice(0, 20).map((entry) => entry.item);
  }
  function renderStockSearchResults() {
    if (!stockSearchResults) {
      return;
    }
    if (stockUniverseLoading && !stockUniverseLoaded && !stockSearchQuery) {
      stockSearchResults.innerHTML = `<div class="stock-search-empty">\uC804\uCCB4 \uC885\uBAA9 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</div>`;
      return;
    }
    const results2 = getStockSearchResults(stockSearchQuery);
    if (!results2.length) {
      stockSearchResults.innerHTML = `<div class="stock-search-empty">\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC885\uBAA9\uBA85, \uC885\uBAA9\uCF54\uB4DC, \uCD08\uC131\uC73C\uB85C \uB2E4\uC2DC \uCC3E\uC544\uBCF4\uC138\uC694.</div>`;
      return;
    }
    stockSearchResults.innerHTML = results2.map((item) => {
      const selected = selectedStockOption?.code === item.code;
      return `
        <button class="stock-search-item ${selected ? "selected" : ""}" type="button" data-stock-code="${escapeHtml(item.code)}">
          <span class="stock-search-item-head">
            <span class="stock-search-name">${escapeHtml(item.name)}</span>
            <span class="stock-search-code">${escapeHtml(item.code)}</span>
          </span>
          <span class="stock-search-meta">${escapeHtml(item.market)} / \uCD08\uC131 ${escapeHtml(item.chosung)}</span>
        </button>
      `;
    }).join("");
  }
  function selectStockOption(item) {
    selectedStockOption = item;
    stockNameInput.value = item.name;
    stockSymbolInput.value = item.code;
    if (selectedStockCard) {
      selectedStockCard.classList.remove("hidden");
      selectedStockCard.innerHTML = `
      <span class="selected-stock-label">\uC120\uD0DD\uB41C \uC885\uBAA9</span>
      <span class="selected-stock-name">${escapeHtml(item.name)}</span>
      <span class="selected-stock-meta">${escapeHtml(item.code)} / ${escapeHtml(item.market)}</span>
    `;
    }
    if (stockSearchInput) {
      stockSearchInput.value = `${item.name} (${item.code})`;
    }
    renderStockSearchResults();
    stockPriceInput.focus();
  }
  function clearSelectedStockOption() {
    selectedStockOption = null;
    stockNameInput.value = "";
    stockSymbolInput.value = "";
    if (selectedStockCard) {
      selectedStockCard.classList.add("hidden");
      selectedStockCard.innerHTML = "";
    }
  }
  function getMoversFilters() {
    return {
      market: moversMarketSelect?.value || "all",
      limit: Number(moversLimitSelect?.value || 5),
      minChangePercent: Number(moversMinChangeInput?.value || 5),
      minVolumeRatio: Number(moversMinVolumeInput?.value || 2),
      minAlertScore: Number(moversMinScoreInput?.value || 40)
    };
  }
  async function loadMovers(options = {}) {
    const filters = getMoversFilters();
    const preserveMoversUi = Boolean(options.preserveMoversUi);
    setMoversStatus("loading", "\uC21C\uC704 \uC870\uD68C \uC911");
    showMoversSummary("");
    showMoversError("");
    if (riseMoversList && !preserveMoversUi) {
      riseMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB4F1\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
    }
    if (fallMoversList && !preserveMoversUi) {
      fallMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB77D\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
    }
    try {
      const [risePayload, fallPayload] = await Promise.all([
        fetchMoversByDirection("rise", filters),
        fetchMoversByDirection("fall", filters)
      ]);
      hasLoadedMovers = true;
      latestRiseMovers = risePayload.analyses;
      latestFallMovers = fallPayload.analyses;
      renderMoversThemeLists();
      renderMoversList(riseMoversList, risePayload.analyses, "rise");
      renderMoversList(fallMoversList, fallPayload.analyses, "fall");
      if (riseCountLabel) {
        riseCountLabel.textContent = `${risePayload.analyses.length}\uAC1C`;
      }
      if (fallCountLabel) {
        fallCountLabel.textContent = `${fallPayload.analyses.length}\uAC1C`;
      }
      setMoversStatus("done", "\uC870\uD68C \uC644\uB8CC");
      showMoversSummary(
        `${filters.market === "all" ? "\uC804\uCCB4 \uC2DC\uC7A5" : filters.market} \uAE30\uC900\uC73C\uB85C \uAE09\uB4F1 ${risePayload.analyses.length}\uAC1C, \uAE09\uB77D ${fallPayload.analyses.length}\uAC1C\uB97C \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "\uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      setMoversStatus("error", "\uC870\uD68C \uC2E4\uD328");
      showMoversError(message);
      latestRiseMovers = [];
      latestFallMovers = [];
      hasLoadedMovers = true;
      renderMoversThemeLists();
      renderMoversList(riseMoversList, [], "rise");
      renderMoversList(fallMoversList, [], "fall");
      if (riseCountLabel) {
        riseCountLabel.textContent = "0\uAC1C";
      }
      if (fallCountLabel) {
        fallCountLabel.textContent = "0\uAC1C";
      }
    }
  }
  async function fetchMoversByDirection(direction, filters) {
    const params = new URLSearchParams({
      direction,
      market: filters.market,
      limit: String(filters.limit),
      minChangePercent: String(filters.minChangePercent),
      minVolumeRatio: String(filters.minVolumeRatio),
      minAlertScore: String(filters.minAlertScore)
    });
    const response = await fetch(`/analysis/korean-movers?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "\uAE09\uB4F1/\uAE09\uB77D \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
    return {
      ...payload,
      analyses: Array.isArray(payload.analyses) ? payload.analyses : []
    };
  }
  function renderMoversList(container, items, direction) {
    if (!container) {
      return;
    }
    if (!items?.length) {
      container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAE09\uB4F1\uC8FC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAE09\uB77D\uC8FC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</p>
      </div>
    `;
      return;
    }
    container.innerHTML = items.map((item, index) => {
      const changeClass = (item.changePercent ?? 0) >= 0 ? "positive" : "negative";
      const sector = getSectorLabel(item.symbol);
      const signalLabel = item.signal === "explosive" ? "\uD3ED\uBC1C" : item.signal === "strong" ? "\uAC15\uD568" : "\uAD00\uCC30";
      const edgeMetricLabel = direction === "rise" ? "\uACE0\uC810 \uB3CC\uD30C" : "\uC800\uC810 \uC774\uD0C8";
      const edgeMetricValue = direction === "rise" ? item.breakout60d ? "60\uC77C" : item.breakout20d ? "20\uC77C" : "-" : item.breakdown60d ? "60\uC77C" : item.breakdown20d ? "20\uC77C" : "-";
      return `
        <article class="mover-card ${direction}">
          <div class="mover-row">
            <div class="mover-title">
              <span class="mover-rank">${index + 1}</span>
              <div class="mover-copy">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="mover-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.market)}${sector ? ` / ${escapeHtml(sector)}` : ""} / \uC810\uC218 ${escapeHtml(String(item.alertScore))} ${renderInfoIcon(moversScoreGuideText, "\uC810\uC218 \uAE30\uC900 \uC548\uB0B4")}</div>
              </div>
            </div>
            <div class="mover-price-line">
              <span class="mover-price">${formatNumber(item.price)}\uC6D0</span>
              <span class="mover-change ${changeClass}">${formatPercent(item.changePercent)}</span>
            </div>
            <div class="mover-metrics-inline">
              <span class="mover-metric-chip">\uAC70\uB798 ${formatMultiplier(item.volumeRatio20d)}</span>
              <span class="mover-metric-chip">\uB300\uAE08 ${formatKoreanEok(item.estimatedTurnover)}</span>
              <span class="mover-metric-chip">${edgeMetricLabel} ${edgeMetricValue}</span>
              <span class="mover-metric-chip">${direction === "rise" ? "\uACE0\uAC00\uBD80\uADFC" : "\uC800\uAC00\uBD80\uADFC"} ${direction === "rise" ? item.closedNearHigh ? "\uC720\uC9C0" : "-" : item.closedNearLow ? "\uC720\uC9C0" : "-"}</span>
            </div>
            <span class="signal-pill ${escapeHtml(item.signal)}">${signalLabel}</span>
          </div>
        </article>
      `;
    }).join("");
  }
  function applyScoreGuideTooltips() {
    for (const icon of scoreGuideIcons) {
      icon.setAttribute("data-tooltip", moversScoreGuideText);
    }
  }
  function renderInfoIcon(text, label = "\uC548\uB0B4") {
    return `<span class="inline-info-icon" data-tooltip="${escapeHtml(text)}" aria-label="${escapeHtml(label)}" tabindex="0">i</span>`;
  }
  function getSectorLabel(symbol) {
    const item = stockSearchUniverse.find((candidate) => candidate.code === symbol);
    if (!item || typeof item.sector !== "string" || !item.sector.trim()) {
      return "";
    }
    return item.sector.trim();
  }
  function renderSelector() {
    const pagedItems = getPagedItems();
    stockSelector.innerHTML = pagedItems.map((item) => {
      const selected = item.key === selectedKey;
      const swingPattern = item.category === "swing" ? swingPatternByKey.get(item.key)?.pattern : null;
      const swingAssessment = item.category === "swing" ? getSwingAssessment(swingPattern) : null;
      const swingTradePlan = item.category === "swing" ? getSwingCardTradePlan(item.note, swingPattern) : null;
      const titleText = item.category === "swing" ? `${item.name} (${item.symbol})` : item.name;
      const metaText = item.category === "swing" ? "" : `${item.symbol} / ${item.anchorDate}`;
      const longTermBucketLabel = item.category === "swing" ? "" : getLongTermBucketLabel(item.longTermBucket);
      const swingBucketLabel = item.category === "swing" ? getSwingBucketLabel(item.swingBucket) : "";
      const longTermInsightNote = item.category === "swing" ? "" : item.longTermInsightNote ?? item.note;
      const longTermInsightKeywords = Array.isArray(item.longTermInsightKeywords) ? item.longTermInsightKeywords : null;
      const longTermKeywords = item.category === "swing" ? [] : longTermInsightKeywords?.length ? longTermInsightKeywords : extractLongTermKeywords(longTermInsightNote, item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET);
      const longTermNoteSummary = item.category === "swing" ? "" : longTermInsightKeywords?.length ? longTermInsightKeywords.slice(0, 4).join(" / ") : formatLongTermSummary(longTermInsightNote, item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET);
      const realtimeLine = renderStockRealtimeLine(item);
      return `
        <article class="stock-card ${selected ? "selected" : ""}">
          <span class="stock-card-head">
            <button class="stock-card-select" type="button" data-stock-key="${escapeHtml(item.key)}">
              <span class="stock-card-name">${escapeHtml(titleText)}</span>
              ${metaText ? `<span class="stock-card-meta">${escapeHtml(metaText)}</span>` : ""}
              ${realtimeLine}
              ${longTermBucketLabel ? `<span class="stock-card-group-pill ${escapeHtml(item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET)}">${escapeHtml(longTermBucketLabel)}</span>` : ""}
              ${swingBucketLabel ? `<span class="stock-card-group-pill ${escapeHtml(item.swingBucket === "watch" ? "watch" : "buy")}">${escapeHtml(swingBucketLabel)}</span>` : ""}
              ${item.category === "swing" && swingTradePlan ? `
                    <span class="stock-card-trade-grid">
                      <span class="stock-card-trade-item">
                        <span class="stock-card-trade-label">\uB9E4\uC218\uAC00</span>
                        <span class="stock-card-trade-value stock-card-trade-value-group">
                          ${swingTradePlan.buyLevels.length ? `
                                <span class="stock-card-trade-badges">
                                  ${swingTradePlan.buyLevels.map(
        (level) => `<span class="stock-card-trade-badge">${escapeHtml(level)}</span>`
      ).join("")}
                                </span>
                              ` : `<span class="stock-card-trade-summary">${escapeHtml(swingTradePlan.buySummary)}</span>`}
                        </span>
                      </span>
                      <span class="stock-card-trade-item">
                        <span class="stock-card-trade-label">\uC190\uC808\uAC00</span>
                        <span class="stock-card-trade-value">${escapeHtml(swingTradePlan.stop)}</span>
                      </span>
                    </span>
                  ` : swingAssessment ? `
                      <span class="stock-card-badges">
                        <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">\uC0C1\uD0DC: ${escapeHtml(swingAssessment.label)}</span>
                        <span class="stock-pattern-score">\uCD5C\uADFC ${SWING_LOOKBACK_DAYS}\uAC70\uB798\uC77C \uAE30\uC900 / ${escapeHtml(swingAssessment.action)}</span>
                      </span>
                    ` : ""}
              ${item.category === "swing" ? "" : longTermKeywords.length ? `
                      <span class="stock-card-keywords" title="${escapeHtml(longTermInsightNote ?? "")}">
                        ${longTermKeywords.map(
        (keyword) => `<span class="stock-card-keyword ${escapeHtml(item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET)}">${escapeHtml(keyword)}</span>`
      ).join("")}
                      </span>
                    ` : `<span class="stock-card-note">${escapeHtml(longTermNoteSummary || longTermInsightNote || "")}</span>`}
            </button>
            <button class="stock-card-delete" type="button" data-delete-key="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.name)} \uC0AD\uC81C">\xD7</button>
          </span>
        </article>
      `;
    }).join("");
    if (!pagedItems.length) {
      stockSelector.innerHTML = `<div class="empty-state"><p>${getCurrentFilterEmptyMessage()}</p></div>`;
    }
    updatePaginationUi();
    maybePrefetchVisibleRealtimeSnapshots();
    persistUiState();
  }
  function isValidAppView(view) {
    return APP_VIEWS.includes(view);
  }
  function resolveHashAppView() {
    const hash = window.location.hash.replace(/^#/, "").trim();
    return isValidAppView(hash) ? hash : null;
  }
  function resolveInitialAppView(savedView) {
    const hashView = resolveHashAppView();
    if (hashView) {
      return hashView;
    }
    return isValidAppView(savedView) ? savedView : "analysis";
  }
  function syncAppViewHash(view) {
    if (!isValidAppView(view)) {
      return;
    }
    const nextHash = `#${view}`;
    if (window.location.hash === nextHash) {
      return;
    }
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }
  function loadUiState() {
    try {
      const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  function persistUiState() {
    const payload = {
      activeView,
      currentCategory,
      currentLongTermBucket,
      currentSwingBucket,
      selectedKey,
      itemsPerPage,
      currentPage
    };
    try {
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }
    syncAppViewHash(activeView);
  }
  function restoreUiState() {
    if (pageSizeSelect) {
      pageSizeSelect.value = PAGE_SIZE_OPTIONS.has(itemsPerPage) ? String(itemsPerPage) : "5";
    }
    if (!getFilteredCatalog().some((item) => item.key === selectedKey)) {
      selectedKey = getFilteredInitialKey();
    }
    currentPage = Math.min(Math.max(1, currentPage), getTotalPagesForCount(getFilteredCatalog().length));
  }
  function getRealtimeSnapshotKey(item) {
    return item?.key ?? item?.symbol ?? "";
  }
  function getVisibleStockSnapshotSignature() {
    return getPagedItems().map((item) => getRealtimeSnapshotKey(item)).filter(Boolean).join("|");
  }
  function getStockSnapshotRefreshInterval() {
    return currentCategory === "swing" ? SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS : LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS;
  }
  function renderStockRealtimeLine(item) {
    const snapshot = realtimeStockSnapshots.get(getRealtimeSnapshotKey(item));
    if (snapshot?.error) {
      return `<span class="stock-card-live-row muted">${escapeHtml(snapshot.error)}</span>`;
    }
    if (typeof snapshot?.latestClose !== "number") {
      return `<span class="stock-card-live-row muted">\uC2E4\uC2DC\uAC04 \uC2DC\uC138 \uB300\uAE30</span>`;
    }
    const trendClass = snapshot.changePercent > 0 ? "positive" : snapshot.changePercent < 0 ? "negative" : "neutral";
    const changeText = snapshot.changePercent == null ? "-" : `${formatPercent(snapshot.changePercent)} / ${formatSignedDecimal(snapshot.changeAmount ?? 0)}`;
    const latestDateText = snapshot.latestDate ? `${escapeHtml(snapshot.latestDate)} \uAE30\uC900` : "\uC2E4\uC2DC\uAC04";
    return `
    <span class="stock-card-live-row ${trendClass}">
      <span class="stock-card-live-price">${formatNumber(snapshot.latestClose)}\uC6D0</span>
      <span class="stock-card-live-change">${changeText}</span>
      <span class="stock-card-live-stamp">${latestDateText}</span>
    </span>
  `;
  }
  function maybePrefetchVisibleRealtimeSnapshots() {
    if (activeView !== "analysis") {
      return;
    }
    const signature = getVisibleStockSnapshotSignature();
    if (!signature || signature === lastVisibleStockSnapshotSignature) {
      return;
    }
    void loadRealtimeStockSnapshots({ background: true });
  }
  async function loadRealtimeStockSnapshots(options = {}) {
    if (stockSnapshotLoading) {
      return;
    }
    const visibleItems = getPagedItems();
    if (!visibleItems.length) {
      realtimeStockSnapshots = /* @__PURE__ */ new Map();
      lastVisibleStockSnapshotSignature = "";
      renderSelector();
      return;
    }
    stockSnapshotLoading = true;
    try {
      const response = await fetch("/analysis/realtime-stocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: visibleItems.map((item) => ({
            key: item.key,
            name: item.name,
            symbol: item.symbol,
            category: item.category ?? DEFAULT_CATEGORY
          }))
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC2E4\uC2DC\uAC04 \uC2DC\uC138\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      realtimeStockSnapshots = new Map(
        items.map((item) => [item.key ?? item.symbol, item])
      );
      lastVisibleStockSnapshotSignature = getVisibleStockSnapshotSignature();
      renderSelector();
    } catch (error) {
      console.error(error);
      if (!options.background) {
        showError(error instanceof Error ? error.message : "\uC2E4\uC2DC\uAC04 \uC2DC\uC138\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
    } finally {
      stockSnapshotLoading = false;
    }
  }
  function startStockSnapshotAutoRefresh() {
    if (stockSnapshotRefreshTimer) {
      clearInterval(stockSnapshotRefreshTimer);
    }
    stockSnapshotRefreshTimer = window.setInterval(() => {
      if (activeView !== "analysis") {
        return;
      }
      void loadRealtimeStockSnapshots({ background: true });
    }, getStockSnapshotRefreshInterval());
  }
  function renderCategoryTabs() {
    if (!stockCategoryTabs) {
      return;
    }
    for (const tab of stockCategoryTabs.querySelectorAll("[data-category]")) {
      tab.classList.toggle("active", tab.dataset.category === currentCategory);
    }
    renderRecommendationScopePanel();
  }
  function updateUniverseRecommendationButton() {
    if (!runUniverseRecommendationBtn) {
      return;
    }
    runUniverseRecommendationBtn.disabled = recommendationUniverseScanLoading;
    if (!recommendationUniverseScanLoading) {
      runUniverseRecommendationBtn.textContent = currentCategory === "swing" ? "\uC2A4\uC719 \uCD94\uCC9C \uAC80\uC0C9" : "\uC911\uC7A5\uAE30 \uCD94\uCC9C \uAC80\uC0C9";
      return;
    }
    runUniverseRecommendationBtn.textContent = currentCategory === "swing" ? "\uC2A4\uC719 \uCD94\uCC9C \uAC80\uC0C9 \uC911..." : "\uC911\uC7A5\uAE30 \uCD94\uCC9C \uAC80\uC0C9 \uC911...";
  }
  function renderRecommendationScopePanel() {
    const categoryLabel = currentCategory === "swing" ? "\uC2A4\uC719" : "\uC911\uC7A5\uAE30";
    const activeBucketLabel = currentCategory === "swing" ? getSwingBucketLabel(currentSwingBucket) : getLongTermBucketLabel(currentLongTermBucket);
    if (recommendationScopeTitle) {
      recommendationScopeTitle.textContent = `${categoryLabel} \uCD94\uCC9C / ${activeBucketLabel}`;
    }
    if (recommendationScopeHelp) {
      recommendationScopeHelp.textContent = currentCategory === "swing" ? "\uC0C1\uB2E8\uC5D0\uC11C \uC2A4\uC719 \uD750\uB984\uC744 \uACE0\uB974\uACE0, \uB9E4\uC218\uD6C4\uBCF4\uC640 \uAD00\uC2EC\uD6C4\uBCF4\uB97C \uAC19\uC740 \uD654\uBA74\uC5D0\uC11C \uB118\uACA8\uBCF4\uBA70 \uC9C1\uC811 \uC885\uBAA9\uC744 \uCD94\uAC00\uD558\uAC70\uB098 \uCD94\uCC9C \uAC80\uC0C9 \uACB0\uACFC\uB97C \uBD99\uC5EC\uC11C \uAD00\uB9AC\uD569\uB2C8\uB2E4." : "\uC0C1\uB2E8\uC5D0\uC11C \uC911\uC7A5\uAE30 \uD750\uB984\uC744 \uC720\uC9C0\uD55C \uCC44 \uB9E4\uC218\uD6C4\uBCF4\uAD70\uACFC \uAD00\uCC30\uAD70\uC744 \uB098\uB220 \uBCF4\uACE0, \uD544\uC694\uD55C \uC885\uBAA9\uC740 \uBC14\uB85C \uCD94\uAC00\uD558\uAC70\uB098 \uCD94\uCC9C \uAC80\uC0C9\uC73C\uB85C \uCC44\uC6CC \uB123\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
    }
    if (openAddStockBtn) {
      openAddStockBtn.textContent = currentCategory === "swing" ? "\uC2A4\uC719 \uCD94\uCC9C \uCD94\uAC00" : "\uC911\uC7A5\uAE30 \uCD94\uCC9C \uCD94\uAC00";
    }
    updateUniverseRecommendationButton();
  }
  function renderLongTermBucketTabs() {
    if (!longTermBucketTabs) {
      return;
    }
    const isVisible = currentCategory === DEFAULT_CATEGORY;
    longTermBucketTabs.classList.toggle("hidden", !isVisible);
    if (!isVisible) {
      renderRecommendationScopePanel();
      return;
    }
    const counts = getLongTermBucketCounts();
    for (const tab of longTermBucketTabs.querySelectorAll("[data-long-term-bucket]")) {
      const bucket = tab.dataset.longTermBucket;
      if (!isValidLongTermBucket(bucket)) {
        continue;
      }
      tab.classList.toggle("active", bucket === currentLongTermBucket);
      tab.textContent = `${getLongTermBucketLabel(bucket)} ${counts[bucket]}\uAC1C`;
    }
    renderRecommendationScopePanel();
  }
  function renderSwingBucketTabs() {
    if (!swingBucketTabs) {
      return;
    }
    const isVisible = currentCategory === "swing";
    swingBucketTabs.classList.toggle("hidden", !isVisible);
    if (!isVisible) {
      renderRecommendationScopePanel();
      return;
    }
    const counts = getSwingBucketCounts();
    for (const tab of swingBucketTabs.querySelectorAll("[data-swing-bucket]")) {
      const bucket = tab.dataset.swingBucket;
      if (!isValidSwingBucket(bucket)) {
        continue;
      }
      tab.classList.toggle("active", bucket === currentSwingBucket);
      tab.textContent = `${getSwingBucketLabel(bucket)} ${counts[bucket]}\uAC1C`;
    }
    renderRecommendationScopePanel();
  }
  async function runRecommendationUniverseScan() {
    if (recommendationUniverseScanLoading) {
      return;
    }
    const requestedCategory = currentCategory === "swing" ? "swing" : DEFAULT_CATEGORY;
    const requestedLabel = requestedCategory === "swing" ? "\uC2A4\uC719" : "\uC911\uC7A5\uAE30";
    recommendationUniverseScanLoading = true;
    updateUniverseRecommendationButton();
    showError("");
    showSummary(`${requestedLabel} universe \uAC80\uC0C9\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4. \uC885\uBAA9 \uC218\uAC00 \uB9CE\uC544 \uC2DC\uAC04\uC774 \uAC78\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
    try {
      const response = await fetch("/analysis/recommendation-universe-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category: requestedCategory
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `${requestedLabel} universe \uAC80\uC0C9\uC744 \uC2E4\uD589\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.`);
      }
      if (payload.category === "swing") {
        const executionItems = Array.isArray(payload.executionItems) ? payload.executionItems : [];
        const watchItems = Array.isArray(payload.watchItems) ? payload.watchItems : [];
        const items2 = executionItems.length || watchItems.length ? [
          ...executionItems.map((item) => ({ ...item, bucket: "execution" })),
          ...watchItems.map((item) => ({ ...item, bucket: "watch" }))
        ] : Array.isArray(payload.items) ? payload.items : [];
        recommendationCatalog = syncServerSwingRecommendations(recommendationCatalog, items2);
        serverSwingPicksLoaded = true;
        await refreshSwingPatternSnapshots();
        if (currentCategory === "swing") {
          currentPage = 1;
          if (currentSwingBucket === "execution" && !executionItems.length && watchItems.length) {
            currentSwingBucket = "watch";
          } else if (currentSwingBucket === "watch" && !watchItems.length && executionItems.length) {
            currentSwingBucket = "execution";
          }
          selectedKey = getFilteredCatalog()[0]?.key ?? null;
        }
        saveCatalog();
        syncSelectedKeyWithCatalog();
        renderCategoryTabs();
        renderLongTermBucketTabs();
        renderSwingBucketTabs();
        renderSelector();
        if (currentCategory === "swing" && selectedKey) {
          await runAnalysisByKey(selectedKey);
        }
        const swingDiffCount = Array.isArray(payload.universeDiff?.changes) ? payload.universeDiff.changes.length : 0;
        showSummary(
          `\uC2A4\uC719 universe \uAC80\uC0C9\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB9E4\uC218\uD6C4\uBCF4 ${payload.executionCount ?? executionItems.length}\uAC1C / \uAD00\uC2EC\uD6C4\uBCF4 ${payload.watchCount ?? watchItems.length}\uAC1C\uB97C \uBC18\uC601\uD588\uC2B5\uB2C8\uB2E4.${swingDiffCount ? ` \uBCC0\uD654 ${swingDiffCount}\uAC74\uC744 \uC54C\uB9BC \uAE30\uC900\uC73C\uB85C \uCC98\uB9AC\uD588\uC2B5\uB2C8\uB2E4.` : " \uBCC0\uD654 \uC885\uBAA9\uC740 \uC5C6\uC5C8\uC2B5\uB2C8\uB2E4."}`
        );
        return;
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      recommendationCatalog = syncServerLongTermRecommendations(recommendationCatalog, items);
      serverLongTermPicksLoaded = true;
      if (currentCategory === DEFAULT_CATEGORY) {
        currentPage = 1;
        if (currentLongTermBucket === "buy" && !payload.buyCount && payload.watchCount) {
          currentLongTermBucket = "watch";
        } else if (currentLongTermBucket === "watch" && !payload.watchCount && payload.buyCount) {
          currentLongTermBucket = "buy";
        }
        selectedKey = getFilteredCatalog()[0]?.key ?? null;
      }
      saveCatalog();
      syncSelectedKeyWithCatalog();
      renderCategoryTabs();
      renderLongTermBucketTabs();
      renderSwingBucketTabs();
      renderSelector();
      if (currentCategory === DEFAULT_CATEGORY && selectedKey) {
        await runAnalysisByKey(selectedKey);
      }
      const longTermDiffCount = Array.isArray(payload.universeDiff?.changes) ? payload.universeDiff.changes.length : 0;
      showSummary(
        `\uC911\uC7A5\uAE30 universe \uAC80\uC0C9\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB9E4\uC218\uD6C4\uBCF4 ${payload.buyCount ?? 0}\uAC1C / \uAD00\uCC30\uAD70 ${payload.watchCount ?? 0}\uAC1C\uB97C \uBC18\uC601\uD588\uC2B5\uB2C8\uB2E4.${longTermDiffCount ? ` \uBCC0\uD654 ${longTermDiffCount}\uAC74\uC744 \uC54C\uB9BC \uAE30\uC900\uC73C\uB85C \uCC98\uB9AC\uD588\uC2B5\uB2C8\uB2E4.` : " \uBCC0\uD654 \uC885\uBAA9\uC740 \uC5C6\uC5C8\uC2B5\uB2C8\uB2E4."}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "universe \uAC80\uC0C9 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      console.error(error);
      showError(message);
      showSummary("");
    } finally {
      recommendationUniverseScanLoading = false;
      updateUniverseRecommendationButton();
    }
  }
  function loadCatalog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) {
        return defaultRecommendationCatalog.map(normalizeRecommendation);
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) {
        return defaultRecommendationCatalog.map(normalizeRecommendation);
      }
      const normalized = parsed.filter(isValidRecommendation).map(normalizeRecommendation).map(repairRecommendationText);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return normalized;
    } catch {
      return defaultRecommendationCatalog.map(normalizeRecommendation);
    }
  }
  function saveCatalog() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recommendationCatalog));
  }
  function isValidRecommendation(item) {
    return Boolean(
      item && typeof item.key === "string" && typeof item.name === "string" && typeof item.symbol === "string" && typeof item.anchorDate === "string"
    );
  }
  function normalizeRecommendation(item) {
    const category = item?.category === "swing" ? "swing" : DEFAULT_CATEGORY;
    return {
      ...item,
      category,
      longTermBucket: category === "swing" ? void 0 : resolveLongTermBucket(item),
      swingBucket: category === "swing" ? resolveSwingBucket(item) : void 0,
      source: typeof item?.source === "string" ? item.source : void 0
    };
  }
  function resolveLongTermBucket(item) {
    if (item?.longTermBucket === "watch") {
      return "watch";
    }
    if (item?.longTermBucket === "buy") {
      return "buy";
    }
    return inferLongTermBucketFromNote(item?.note);
  }
  function inferLongTermBucketFromNote(note) {
    const normalizedNote = typeof note === "string" ? note.toLowerCase() : "";
    if (!normalizedNote) {
      return DEFAULT_LONG_TERM_BUCKET;
    }
    const watchKeywords = ["\uAD00\uCC30", "\uB3CC\uD30C \uC5EC\uBD80", "\uC0AD\uC81C \uC804 \uBAA9\uB85D", "as \uAE00", "\uC5B8\uAE09"];
    return watchKeywords.some((keyword) => normalizedNote.includes(keyword)) ? "watch" : "buy";
  }
  function isValidLongTermBucket(value) {
    return value === "buy" || value === "watch";
  }
  function isValidCategory(value) {
    return value === "swing" || value === DEFAULT_CATEGORY;
  }
  function resolveSwingBucket(item) {
    if (item?.swingBucket === "watch" || item?.bucket === "watch") {
      return "watch";
    }
    if (item?.swingBucket === "execution" || item?.bucket === "execution") {
      return "execution";
    }
    return DEFAULT_SWING_BUCKET;
  }
  function isValidSwingBucket(value) {
    return value === "execution" || value === "watch";
  }
  function getSwingBucketLabel(bucket) {
    return bucket === "watch" ? "\uAD00\uC2EC\uD6C4\uBCF4" : "\uB9E4\uC218\uD6C4\uBCF4";
  }
  function getLongTermBucketLabel(bucket) {
    return bucket === "watch" ? "\uAD00\uCC30\uAD70" : "\uB9E4\uC218\uD6C4\uBCF4\uAD70";
  }
  function looksCorruptedText(value) {
    if (typeof value !== "string") {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return /�/.test(trimmed) || /\?{2,}/.test(trimmed);
  }
  function repairRecommendationText(item, fallbackName) {
    const source = defaultRecommendationBySymbol.get(item.symbol);
    const next = { ...item };
    const repairedName = looksCorruptedText(next.name) ? source?.name ?? fallbackName ?? next.name : next.name;
    if (repairedName) {
      next.name = repairedName;
    }
    if (looksCorruptedText(next.key)) {
      next.key = `${next.name}-${next.symbol}`;
    }
    if (looksCorruptedText(next.note)) {
      next.note = source?.note;
    }
    return next;
  }
  function getFilteredInitialKey() {
    return getFilteredCatalog()[0]?.key ?? null;
  }
  function getFilteredCatalog() {
    const filtered = recommendationCatalog.filter((item) => {
      if ((item.category ?? DEFAULT_CATEGORY) !== currentCategory) {
        return false;
      }
      if (currentCategory === "swing") {
        return (item.swingBucket ?? DEFAULT_SWING_BUCKET) === currentSwingBucket;
      }
      return (item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET) === currentLongTermBucket;
    });
    if (currentCategory !== "swing") {
      return filtered;
    }
    return [...filtered].sort((left, right) => compareSwingItems(left, right));
  }
  function getPagedItems() {
    const filteredCatalog = getFilteredCatalog();
    if (itemsPerPage === PAGE_SIZE_ALL) {
      return filteredCatalog;
    }
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCatalog.slice(start, start + itemsPerPage);
  }
  function getTotalPages() {
    return getTotalPagesForCount(getFilteredCatalog().length);
  }
  function getTotalPagesForCount(count) {
    if (itemsPerPage === PAGE_SIZE_ALL) {
      return 1;
    }
    return Math.max(1, Math.ceil(count / itemsPerPage));
  }
  function updatePaginationUi() {
    const totalPages = getTotalPages();
    currentPage = Math.min(currentPage, totalPages);
    pageStatus.textContent = `${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    prevPageBtn.style.opacity = prevPageBtn.disabled ? "0.5" : "1";
    nextPageBtn.style.opacity = nextPageBtn.disabled ? "0.5" : "1";
  }
  function removeStock(key) {
    const removedItem = recommendationCatalog.find((item) => item.key === key);
    recommendationCatalog = recommendationCatalog.filter((item) => item.key !== key);
    swingPatternByKey.delete(key);
    if (!recommendationCatalog.length) {
      recommendationCatalog = [];
      selectedKey = null;
      currentAnalysis = null;
      cleanupChart();
      saveCatalog();
      renderSelector();
      setStatus("idle", "\uB300\uAE30 \uC911");
      showSummary("");
      showError("");
      results.classList.add("empty");
      results.innerHTML = `<div class="empty-state"><p>\uB4F1\uB85D\uB41C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC885\uBAA9\uC744 \uCD94\uAC00\uD574\uC8FC\uC138\uC694.</p></div>`;
      return;
    }
    if (selectedKey === key) {
      selectedKey = getFilteredCatalog()[0]?.key ?? recommendationCatalog[0]?.key ?? null;
    }
    currentPage = Math.min(currentPage, getTotalPages());
    saveCatalog();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    renderSelector();
    if (removedItem?.category === "swing") {
      void refreshSwingPatternSnapshots().then(() => {
        renderSwingBucketTabs();
        renderSelector();
      });
    }
    if (selectedKey) {
      runAnalysisByKey(selectedKey);
    }
  }
  function openStockModal() {
    stockForm.reset();
    if (stockModalTitle) {
      stockModalTitle.textContent = currentCategory === "swing" ? "\uC2A4\uC719 \uCD94\uCC9C \uCD94\uAC00" : "\uC911\uC7A5\uAE30 \uCD94\uCC9C \uCD94\uAC00";
    }
    if (stockCategorySelect) {
      stockCategorySelect.value = currentCategory;
    }
    if (longTermBucketSelect) {
      longTermBucketSelect.value = currentLongTermBucket;
    }
    syncLongTermBucketField();
    stockSearchQuery = "";
    clearSelectedStockOption();
    if (stockSearchInput) {
      stockSearchInput.value = "";
    }
    if (!stockUniverseLoaded) {
      void loadStockUniverse();
    }
    renderStockSearchResults();
    showError("");
    stockModal.classList.remove("hidden");
    stockSearchInput.focus();
  }
  function closeStockModal() {
    stockModalPointerDownOnBackdrop = false;
    stockModal.classList.add("hidden");
  }
  function buildStockFromForm() {
    const name = stockNameInput.value.trim();
    const symbol = stockSymbolInput.value.trim();
    const anchorDate = stockDateInput.value;
    const category = stockCategorySelect?.value === "swing" ? "swing" : DEFAULT_CATEGORY;
    const longTermBucket = category === "swing" ? void 0 : isValidLongTermBucket(longTermBucketSelect?.value) ? longTermBucketSelect.value : DEFAULT_LONG_TERM_BUCKET;
    const swingBucket = category === "swing" ? currentSwingBucket : void 0;
    const recommendedPrice = Number(stockPriceInput.value);
    const extraNote = stockNoteInput.value.trim();
    if (!selectedStockOption || !name || !symbol || !anchorDate || !Number.isFinite(recommendedPrice) || recommendedPrice <= 0) {
      showError("\uBA3C\uC800 \uAC80\uC0C9 \uACB0\uACFC\uC5D0\uC11C \uC885\uBAA9\uC744 \uC120\uD0DD\uD558\uACE0 \uCD94\uCC9C\uAC00\uC640 \uAE30\uC900\uC77C\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
      return null;
    }
    const key = createRecommendationKey(name, symbol);
    if (recommendationCatalog.some((item) => item.key === key || item.symbol === symbol)) {
      showError("\uC774\uBBF8 \uB4F1\uB85D\uB41C \uC885\uBAA9\uBA85 \uB610\uB294 \uC885\uBAA9\uCF54\uB4DC\uC785\uB2C8\uB2E4.");
      return null;
    }
    return {
      key,
      name,
      symbol,
      category,
      source: "manual",
      longTermBucket,
      swingBucket,
      anchorDate,
      note: [formatNumber(recommendedPrice) + "\uC6D0 \uAE30\uC900", extraNote].filter(Boolean).join(" / ")
    };
  }
  function syncLongTermBucketField() {
    const isLongTerm = stockCategorySelect?.value !== "swing";
    longTermBucketField?.classList.toggle("hidden", !isLongTerm);
    if (longTermBucketSelect) {
      longTermBucketSelect.disabled = !isLongTerm;
      if (isLongTerm && !isValidLongTermBucket(longTermBucketSelect.value)) {
        longTermBucketSelect.value = DEFAULT_LONG_TERM_BUCKET;
      }
    }
  }
  function getLongTermBucketCounts() {
    return recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === DEFAULT_CATEGORY).reduce(
      (counts, item) => {
        const bucket = item.longTermBucket === "watch" ? "watch" : "buy";
        counts[bucket] += 1;
        return counts;
      },
      { buy: 0, watch: 0 }
    );
  }
  function getSwingBucketCounts() {
    return recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing").reduce(
      (counts, item) => {
        const bucket = item.swingBucket === "watch" ? "watch" : "execution";
        counts[bucket] += 1;
        return counts;
      },
      { execution: 0, watch: 0 }
    );
  }
  function getCurrentFilterEmptyMessage() {
    if (currentCategory === "swing") {
      return currentSwingBucket === "watch" ? "\uAD00\uC2EC\uD6C4\uBCF4 \uD0ED\uC5D0\uB294 \uC544\uC9C1 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC5D4\uC9C4 \uC2A4\uCE94 \uACB0\uACFC\uAC00 \uB4E4\uC5B4\uC624\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4." : "\uB9E4\uC218\uD6C4\uBCF4 \uD0ED\uC5D0\uB294 \uC544\uC9C1 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC5D4\uC9C4 \uC2A4\uCE94 \uACB0\uACFC\uAC00 \uB4E4\uC5B4\uC624\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
    }
    return `${getLongTermBucketLabel(currentLongTermBucket)}\uC5D0\uB294 \uC544\uC9C1 \uB4F1\uB85D\uB41C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC885\uBAA9 \uCD94\uAC00\uB85C \uC2DC\uC791\uD574\uBCF4\uC138\uC694.`;
  }
  function renderEmptyResultsForCurrentFilter() {
    currentAnalysis = null;
    cleanupChart();
    showSummary("");
    showError("");
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>${getCurrentFilterEmptyMessage()}</p></div>`;
  }
  function createRecommendationKey(name, symbol) {
    return `${name}-${symbol}`;
  }
  async function runAnalysisByKey(key) {
    const item = recommendationCatalog.find((candidate) => candidate.key === key);
    if (!item) {
      return;
    }
    setStatus("loading", "\uBD84\uC11D \uC911");
    showSummary("");
    showError("");
    results.classList.remove("empty");
    results.innerHTML = `<div class="empty-state"><p>${escapeHtml(item.name)}  \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
    try {
      const response = await fetch("/analysis/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ items: [item] })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uBD84\uC11D \uC694\uCCAD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const analysis = payload.analyses?.[0];
      if (!analysis) {
        throw new Error("\uBD84\uC11D \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      }
      let swingPatternAnalysis = null;
      if (item.category === "swing") {
        try {
          const swingResponse = await fetch("/analysis/smart-money-patterns", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              items: [
                {
                  name: item.name,
                  symbol: item.symbol,
                  note: item.note
                }
              ],
              filters: {
                lookbackTradingDays: SWING_LOOKBACK_DAYS
              }
            })
          });
          const swingPayload = await swingResponse.json();
          if (!swingResponse.ok) {
            throw new Error(swingPayload.error ?? "\uC2A4\uC719 \uD328\uD134 \uACB0\uACFC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
          }
          swingPatternAnalysis = Array.isArray(swingPayload.analyses) ? swingPayload.analyses[0] ?? null : null;
          if (swingPatternAnalysis) {
            swingPatternByKey.set(item.key, swingPatternAnalysis);
          }
        } catch (error) {
          console.error(error);
        }
      }
      currentAnalysis = enrichAnalysis(analysis, item, swingPatternAnalysis);
      if (item.category !== "swing" && currentAnalysis.longTermReview) {
        const insightChanged = applyLongTermInsightToCatalog(item.key, currentAnalysis.longTermReview);
        if (insightChanged) {
          renderSelector();
        }
      }
      results.classList.remove("empty");
      results.innerHTML = renderCard(currentAnalysis);
      mountInteractiveChart(
        currentAnalysis.chartSets[currentAnalysis.activeTimeframe],
        currentAnalysis.tradingAnchorDate,
        currentAnalysis.swingTradeOverlay
      );
      void refreshCurrentAnalysisRealtime({ background: true });
      setStatus("done", "\uC644\uB8CC");
      if (item.category === "swing" && currentAnalysis.swingAssessment) {
        showSummary(
          `${item.name} \uBD84\uC11D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uCD5C\uADFC ${SWING_LOOKBACK_DAYS}\uAC70\uB798\uC77C \uAE30\uC900 ${currentAnalysis.swingAssessment.label} \uC0C1\uD0DC\uC785\uB2C8\uB2E4.`
        );
      } else if (item.category !== "swing" && currentAnalysis.longTermReview) {
        const assessment = getLongTermReviewAssessment(currentAnalysis.longTermReview);
        const passText = currentAnalysis.longTermReview.enginePass ? "\uC5D4\uC9C4 \uD1B5\uACFC" : "\uC5D4\uC9C4 \uAD00\uCC30/\uC81C\uC678";
        showSummary(`${item.name} \uBD84\uC11D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC911\uC7A5\uAE30 \uC5D4\uC9C4 \uAE30\uC900 ${assessment.groupLabel} / ${passText} \uC0C1\uD0DC\uC785\uB2C8\uB2E4.`);
      } else {
        showSummary(`${item.name} \uBD84\uC11D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD655\uB300/\uCD95\uC18C, \uB4DC\uB798\uADF8 \uC774\uB3D9, \uD234\uD301\uC744 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      setStatus("error", "\uC624\uB958");
      showError(message);
      results.classList.add("empty");
      results.innerHTML = `<div class="empty-state"><p>\uC624\uB958\uB97C \uD574\uACB0\uD55C \uB4A4 \uB2E4\uC2DC \uC120\uD0DD\uD574\uC8FC\uC138\uC694.</p></div>`;
    }
  }
  function enrichAnalysis(analysis, item, swingPatternAnalysis = null) {
    const daily = analysis.chartWindow.points;
    const swingPattern = swingPatternAnalysis?.pattern ?? null;
    return {
      key: item.key,
      ...analysis,
      category: item.category ?? DEFAULT_CATEGORY,
      longTermReview: analysis.longTermReview ?? null,
      swingBucket: item.swingBucket,
      swingPatternAnalysis,
      swingAssessment: swingPattern ? getSwingAssessment(swingPattern) : null,
      swingTradeOverlay: getSwingTradeOverlay(item.note, swingPattern),
      chartSets: {
        daily: toChartPoints(daily),
        weekly: aggregateCandles(daily, "weekly"),
        monthly: aggregateCandles(daily, "monthly")
      },
      activeTimeframe: "daily"
    };
  }
  function averageDefinedNumbers(values) {
    const normalized = (Array.isArray(values) ? values : []).filter((value) => typeof value === "number" && Number.isFinite(value));
    if (!normalized.length) {
      return void 0;
    }
    return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
  }
  function ratioNumber(value, base) {
    if (typeof value !== "number" || !Number.isFinite(value) || typeof base !== "number" || !Number.isFinite(base) || base === 0) {
      return void 0;
    }
    return value / base;
  }
  function formatRealtimeSyncLabel(value) {
    if (!value) {
      return "\uC2E4\uC2DC\uAC04 \uC2DC\uC138 \uB3D9\uAE30\uD654 \uB300\uAE30";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "\uC2E4\uC2DC\uAC04 \uC2DC\uC138 \uAC31\uC2E0 \uC644\uB8CC";
    }
    return `\uC2E4\uC2DC\uAC04 \uAC31\uC2E0 ${date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })}`;
  }
  function applyRealtimeDetailToAnalysis(analysis, detail) {
    const dailyPoints = Array.isArray(detail?.chartWindow?.points) ? detail.chartWindow.points : [];
    const latestPoint = dailyPoints.at(-1);
    if (!latestPoint) {
      return analysis;
    }
    const latestClose = typeof detail.latestClose === "number" ? detail.latestClose : latestPoint.close;
    const afterAnchorPoints = dailyPoints.filter((point) => point.date >= analysis.tradingAnchorDate);
    const referencePoints = afterAnchorPoints.length ? afterAnchorPoints : [latestPoint];
    const highestPoint = referencePoints.reduce((best, point) => point.close > best.close ? point : best, referencePoints[0]);
    const lowestPoint = referencePoints.reduce((best, point) => point.close < best.close ? point : best, referencePoints[0]);
    const avgVolume20Latest = averageDefinedNumbers(dailyPoints.slice(-20).map((point) => point.volume));
    return {
      ...analysis,
      resolvedSymbol: detail.resolvedSymbol ?? analysis.resolvedSymbol,
      latestClose,
      latestDate: detail.latestDate ?? latestPoint.date,
      latestVolume: latestPoint.volume,
      latestVolumeVs20d: ratioNumber(latestPoint.volume, avgVolume20Latest),
      returnSinceAnchor: analysis.anchorClose ? (latestClose - analysis.anchorClose) / analysis.anchorClose * 100 : analysis.returnSinceAnchor,
      maxGainPercent: analysis.anchorClose ? (highestPoint.close - analysis.anchorClose) / analysis.anchorClose * 100 : analysis.maxGainPercent,
      maxDrawdownPercent: analysis.anchorClose ? (lowestPoint.close - analysis.anchorClose) / analysis.anchorClose * 100 : analysis.maxDrawdownPercent,
      highestClose: {
        date: highestPoint.date,
        close: highestPoint.close
      },
      lowestClose: {
        date: lowestPoint.date,
        close: lowestPoint.close
      },
      chartWindow: detail.chartWindow,
      chartSets: {
        daily: toChartPoints(dailyPoints),
        weekly: aggregateCandles(dailyPoints, "weekly"),
        monthly: aggregateCandles(dailyPoints, "monthly")
      }
    };
  }
  function syncLiveMetric(selector, text) {
    const node = results.querySelector(selector);
    if (node) {
      node.textContent = text;
    }
  }
  function updateCurrentAnalysisDom(analysis, fetchedAt) {
    const returnClass = analysis.returnSinceAnchor > 0 ? "positive" : analysis.returnSinceAnchor < 0 ? "negative" : "neutral";
    const activeRange = getChartSeriesRange(analysis.chartSets?.[analysis.activeTimeframe]);
    const returnPill = results.querySelector("[data-live-return-pill]");
    if (returnPill) {
      returnPill.className = `return-pill ${returnClass}`;
      returnPill.textContent = formatPercent(analysis.returnSinceAnchor);
    }
    syncLiveMetric("[data-live-current-price]", formatNumber(analysis.latestClose));
    syncLiveMetric("[data-live-max-gain]", formatPercent(analysis.maxGainPercent));
    syncLiveMetric("[data-live-max-drawdown]", formatPercent(analysis.maxDrawdownPercent));
    syncLiveMetric("[data-live-highest-close]", formatNumber(analysis.highestClose.close));
    syncLiveMetric("[data-live-lowest-close]", formatNumber(analysis.lowestClose.close));
    syncLiveMetric("[data-live-latest-volume-ratio]", formatMultiplier(analysis.latestVolumeVs20d));
    syncLiveMetric("[data-live-chart-start]", activeRange.startDate);
    syncLiveMetric("[data-live-chart-end]", activeRange.endDate);
    syncLiveMetric("[data-live-sync-line]", formatRealtimeSyncLabel(fetchedAt));
    const fundamentalsPriceReference = results.querySelector(".fundamentals-price-reference");
    if (fundamentalsPriceReference) {
      fundamentalsPriceReference.textContent = `\uAC00\uACA9 \uAE30\uC900: ${formatNumber(analysis.latestClose)}\uC6D0 (${analysis.latestDate} \uC885\uAC00)`;
    }
  }
  async function refreshCurrentAnalysisRealtime(options = {}) {
    if (activeAnalysisRealtimeLoading || activeView !== "analysis" || !currentAnalysis || !selectedKey) {
      return;
    }
    const item = recommendationCatalog.find((candidate) => candidate.key === selectedKey);
    if (!item) {
      return;
    }
    activeAnalysisRealtimeLoading = true;
    try {
      const response = await fetch("/analysis/realtime-stock-detail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key: item.key,
          name: item.name,
          symbol: item.symbol,
          anchorDate: item.anchorDate,
          category: item.category ?? DEFAULT_CATEGORY
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "\uC2E4\uC2DC\uAC04 \uCC28\uD2B8\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      currentAnalysis = applyRealtimeDetailToAnalysis(currentAnalysis, payload);
      updateCurrentAnalysisDom(currentAnalysis, payload.fetchedAt);
      updateInteractiveChartData(
        currentAnalysis.chartSets[currentAnalysis.activeTimeframe],
        currentAnalysis.tradingAnchorDate,
        currentAnalysis.swingTradeOverlay
      );
    } catch (error) {
      console.error(error);
      if (!options.background) {
        showError(error instanceof Error ? error.message : "\uC2E4\uC2DC\uAC04 \uCC28\uD2B8\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
    } finally {
      activeAnalysisRealtimeLoading = false;
    }
  }
  function startActiveAnalysisAutoRefresh() {
    if (activeAnalysisRefreshTimer) {
      clearInterval(activeAnalysisRefreshTimer);
    }
    activeAnalysisRefreshTimer = window.setInterval(() => {
      void refreshCurrentAnalysisRealtime({ background: true });
    }, ACTIVE_ANALYSIS_REFRESH_INTERVAL_MS);
  }
  function toChartPoints(points) {
    let previousClose = null;
    const normalized = points.map((point) => {
      const chartPoint = normalizeChartPoint(point, previousClose);
      previousClose = chartPoint.close ?? previousClose;
      return chartPoint;
    });
    return fillMissingWeekdayPoints(normalized);
  }
  function aggregateCandles(points, timeframe) {
    const buckets = /* @__PURE__ */ new Map();
    let previousClose = null;
    for (const point of points) {
      const normalizedPoint = normalizeChartPoint(point, previousClose);
      previousClose = normalizedPoint.close ?? previousClose;
      const key = timeframe === "weekly" ? getWeekKey(point.date) : point.date.slice(0, 7);
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          time: point.date,
          open: normalizedPoint.open,
          high: normalizedPoint.high,
          low: normalizedPoint.low,
          close: normalizedPoint.close,
          value: normalizedPoint.value
        });
        continue;
      }
      existing.high = Math.max(existing.high, normalizedPoint.high);
      existing.low = Math.min(existing.low, normalizedPoint.low);
      existing.close = normalizedPoint.close;
      existing.value += normalizedPoint.value;
    }
    return [...buckets.values()];
  }
  function getWeekKey(dateText) {
    const date = /* @__PURE__ */ new Date(`${dateText}T00:00:00Z`);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 864e5 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  function addUtcDays(dateText, days) {
    const date = /* @__PURE__ */ new Date(`${dateText}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function isNonTradingPoint(point) {
    return (point.open ?? 0) === 0 && (point.high ?? 0) === 0 && (point.low ?? 0) === 0 && (point.volume ?? 0) === 0;
  }
  function normalizeChartPoint(point, previousClose) {
    const isHalted = isNonTradingPoint(point);
    const referenceClose = previousClose ?? point.close;
    const open = isHalted ? referenceClose : point.open ?? point.close;
    const high = isHalted ? referenceClose : point.high ?? point.close;
    const low = isHalted ? referenceClose : point.low ?? point.close;
    const close = point.close ?? referenceClose;
    return {
      time: point.date,
      open,
      high,
      low,
      close,
      value: point.volume ?? 0,
      isWhitespace: false,
      isHalted
    };
  }
  function isWeekday(dateText) {
    const day = (/* @__PURE__ */ new Date(`${dateText}T00:00:00Z`)).getUTCDay();
    return day >= 1 && day <= 5;
  }
  function fillMissingWeekdayPoints(points) {
    if (!points.length) {
      return [];
    }
    const filled = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      let cursor = addUtcDays(previous.time, 1);
      while (cursor < current.time) {
        if (isWeekday(cursor)) {
          filled.push({
            time: cursor,
            isWhitespace: true,
            isHalted: false
          });
        }
        cursor = addUtcDays(cursor, 1);
      }
      filled.push(current);
    }
    return filled;
  }
  function setStatus(kind, text) {
    statusBadge.className = `status-badge ${kind}`;
    statusBadge.textContent = text;
  }
  function showSummary(text) {
    if (!text) {
      summaryBar.classList.add("hidden");
      summaryBar.textContent = "";
      return;
    }
    summaryBar.classList.remove("hidden");
    summaryBar.textContent = text;
  }
  function showError(text) {
    if (!text) {
      errorBox.classList.add("hidden");
      errorBox.textContent = "";
      return;
    }
    errorBox.classList.remove("hidden");
    errorBox.textContent = text;
  }
  function setMoversStatus(kind, text) {
    if (!moversStatusBadge) {
      return;
    }
    moversStatusBadge.className = `status-badge ${kind}`;
    moversStatusBadge.textContent = text;
  }
  function showMoversSummary(text) {
    if (!moversSummaryBar) {
      return;
    }
    if (!text) {
      moversSummaryBar.classList.add("hidden");
      moversSummaryBar.textContent = "";
      return;
    }
    moversSummaryBar.classList.remove("hidden");
    moversSummaryBar.textContent = text;
  }
  function showMoversError(text) {
    if (!moversErrorBox) {
      return;
    }
    if (!text) {
      moversErrorBox.classList.add("hidden");
      moversErrorBox.textContent = "";
      return;
    }
    moversErrorBox.classList.remove("hidden");
    moversErrorBox.textContent = text;
  }
  function formatLongTermGroupLabel(group) {
    return group === "buy candidate" ? "\uB9E4\uC218 \uAC00\uB2A5 \uD6C4\uBCF4\uAD70" : "\uAD00\uCC30 \uD6C4\uBCF4\uAD70";
  }
  function formatLongTermLabel(label) {
    switch (label) {
      case "leader correction watch":
        return "\uB300\uD45C\uC8FC \uC870\uC815 \uAD00\uCC30";
      case "deep value review":
        return "\uAE4A\uC740 \uC870\uC815 \uC7AC\uAC80\uD1A0";
      case "base-forming candidate":
        return "\uBCA0\uC774\uC2A4 \uD615\uC131 \uD6C4\uBCF4";
      case "needs more stabilization":
        return "\uC548\uC815\uD654 \uB354 \uD544\uC694";
      default:
        return label ?? "-";
    }
  }
  function formatLongTermFundamentalTrend(trend) {
    switch (trend) {
      case "improving":
        return "\uAC1C\uC120";
      case "weakening":
        return "\uC57D\uD654";
      case "cyclical_downturn":
        return "\uC21C\uD658 \uB454\uD654";
      default:
        return "-";
    }
  }
  function extractLongTermKeywords(note, bucket = DEFAULT_LONG_TERM_BUCKET) {
    if (typeof note !== "string" || !note.trim()) {
      return [];
    }
    const segments = note.split(/[|,/]/).map((segment) => segment.trim()).filter(Boolean);
    const keywords = [];
    const pushKeyword = (label) => {
      if (!label || keywords.includes(label) || keywords.length >= 5) {
        return;
      }
      keywords.push(label);
    };
    for (const segment of segments) {
      const normalized = segment.toLowerCase();
      if (!normalized) {
        continue;
      }
      if (normalized.includes("\uC911\uC7A5\uAE30 \uAD00\uCC30 \uD6C4\uBCF4\uAD70") || normalized.includes("\uC911\uC7A5\uAE30 \uB9E4\uC218 \uAC00\uB2A5 \uD6C4\uBCF4\uAD70") || normalized.includes("watch candidate") || normalized.includes("buy candidate")) {
        continue;
      }
      if (normalized.includes("\uAE4A\uC740 \uC870\uC815 \uC7AC\uAC80\uD1A0") || normalized.includes("deep value review")) {
        pushKeyword("\uAE4A\uC740 \uC870\uC815");
        continue;
      }
      if (normalized.includes("\uBCA0\uC774\uC2A4 \uD615\uC131 \uD6C4\uBCF4") || normalized.includes("base-forming candidate")) {
        pushKeyword("\uBCA0\uC774\uC2A4 \uD615\uC131");
        continue;
      }
      if (normalized.includes("\uB300\uD45C\uC8FC \uC870\uC815 \uAD00\uCC30") || normalized.includes("leader correction watch")) {
        pushKeyword("\uB300\uD45C\uC8FC \uC870\uC815");
        continue;
      }
      if (normalized.includes("\uC548\uC815\uD654 \uB354 \uD544\uC694") || normalized.includes("needs more stabilization")) {
        pushKeyword("\uC548\uC815\uD654 \uD544\uC694");
        continue;
      }
      const totalMatch = normalized.match(/(?:total|총점)\s*(\d+)/i);
      if (totalMatch) {
        pushKeyword(`\uCD1D\uC810 ${Number(totalMatch[1])}\uC810`);
        continue;
      }
      const drawdownMatch = normalized.match(/(?:drawdown|낙폭)\s*(-?\d+(?:\.\d+)?)%/i);
      if (drawdownMatch) {
        pushKeyword(`\uB099\uD3ED ${Math.round(Math.abs(Number(drawdownMatch[1])))}%`);
        continue;
      }
      const firstBuyMatch = segment.match(/(\d[\d,]*)원[^|]*1차\s*매수/i);
      if (firstBuyMatch) {
        pushKeyword(`1\uCC28\uB9E4\uC218 ${Number(firstBuyMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}\uC6D0`);
        continue;
      }
      const splitBuyMatch = segment.match(/(\d[\d,]*)원[^|]*분할매수/i);
      if (splitBuyMatch) {
        pushKeyword(`\uBD84\uD560\uB9E4\uC218 ${Number(splitBuyMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}\uC6D0`);
        continue;
      }
      const belowPriceMatch = segment.match(/(\d[\d,]*)원\s*이하/i);
      if (belowPriceMatch) {
        pushKeyword(`\uAE30\uC900\uAC00 ${Number(belowPriceMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}\uC6D0`);
        if (normalized.includes("\uB9E4\uC218")) {
          pushKeyword("\uB9E4\uC218 \uAD6C\uAC04");
        }
        continue;
      }
      if (normalized.includes("\uC190\uC808\uAC00 \uAD6C\uAC04")) {
        pushKeyword("\uC190\uC808 \uAD6C\uAC04");
        continue;
      }
      if (normalized.includes("\uB2E4\uC74C\uB0A0 \uC2DC\uAC00 \uC774\uD558") || normalized.includes("\uC2DC\uAC00 \uC774\uD558")) {
        pushKeyword("\uC2DC\uAC00 \uC774\uD558");
        continue;
      }
      if (normalized.includes("\uC911\uAE30 1\uCC28\uB9E4\uC218")) {
        pushKeyword("\uC911\uAE30 1\uCC28\uB9E4\uC218");
        continue;
      }
      const belowHighMatch = normalized.match(/(?:고점 대비\s*|)(\d+(?:\.\d+)?)%\s+below/i);
      if (belowHighMatch) {
        pushKeyword(`\uACE0\uC810 \uB300\uBE44 ${Math.round(Number(belowHighMatch[1]))}%\u2193`);
        continue;
      }
      if (normalized.includes("profit trend improving") || normalized.includes("\uC2E4\uC801 \uAC1C\uC120")) {
        pushKeyword("\uC2E4\uC801 \uAC1C\uC120");
        continue;
      }
      if (normalized.includes("temporary loss still weak") || normalized.includes("\uC801\uC790 \uAD6C\uAC04")) {
        pushKeyword("\uC801\uC790 \uAD6C\uAC04");
        continue;
      }
      if (normalized.includes("cyclical downturn stabilizing") || normalized.includes("\uC5C5\uD669 \uC548\uC815\uD654")) {
        pushKeyword("\uC5C5\uD669 \uC548\uC815\uD654");
        continue;
      }
      if (normalized.includes("profitable and structurally intact") || normalized.includes("\uD751\uC790 \uAD6C\uC870")) {
        pushKeyword("\uD751\uC790 \uAD6C\uC870");
        continue;
      }
      if (normalized.includes("deteriorating_financial_momentum") || normalized.includes("\uC2E4\uC801 \uB454\uD654")) {
        pushKeyword("\uC2E4\uC801 \uB454\uD654");
        continue;
      }
      if (normalized.includes("ma120 turning upward") || normalized.includes("ma120 \uC0C1\uD5A5")) {
        pushKeyword("MA120 \uC0C1\uD5A5");
        continue;
      }
      if (normalized.includes("ma120 flattening") || normalized.includes("ma120 \uD3C9\uD0C4")) {
        pushKeyword("MA120 \uD3C9\uD0C4");
        continue;
      }
      if (normalized.includes("ma120 still falling") || normalized.includes("ma120 \uD558\uB77D")) {
        pushKeyword("MA120 \uD558\uB77D");
        continue;
      }
      if (normalized.includes("higher lows forming") || normalized.includes("\uBC14\uB2E5 \uC548\uC815\uD654")) {
        pushKeyword("\uBC14\uB2E5 \uC548\uC815\uD654");
        continue;
      }
      if (normalized.includes("base forming but still incomplete") || normalized.includes("\uBC14\uB2E5 \uD615\uC131 \uC911")) {
        pushKeyword("\uBC14\uB2E5 \uD615\uC131 \uC911");
        continue;
      }
      if (normalized.includes("base not formed yet") || normalized.includes("\uBC14\uB2E5 \uBBF8\uC644\uC131")) {
        pushKeyword("\uBC14\uB2E5 \uBBF8\uC644\uC131");
        continue;
      }
      if (normalized.includes("overextended above ma120") || normalized.includes("\uC774\uACA9 \uACFC\uC5F4")) {
        pushKeyword("\uC774\uACA9 \uACFC\uC5F4");
        continue;
      }
      if (normalized.includes("worsening_debt")) {
        pushKeyword("\uBD80\uCC44 \uBD80\uB2F4");
        continue;
      }
      if (normalized.includes("unclear_business_model")) {
        pushKeyword("\uC0AC\uC5C5 \uAC00\uC2DC\uC131 \uC57D\uD568");
        continue;
      }
      if (normalized.includes("\uC0AD\uC81C \uC804 \uBAA9\uB85D")) {
        pushKeyword("\uC0AD\uC81C \uC804 \uBAA9\uB85D");
        continue;
      }
      if (normalized.includes("\uB3CC\uD30C \uC5EC\uBD80") || normalized.includes("\uB3CC\uD30C \uAD00\uCC30")) {
        pushKeyword("\uB3CC\uD30C \uAD00\uCC30");
        continue;
      }
      if (normalized.includes("as \uAE00") && normalized.includes("\uC5B8\uAE09")) {
        pushKeyword("AS \uC7AC\uC5B8\uAE09");
        continue;
      }
      if (normalized.includes("\uAD00\uCC30")) {
        pushKeyword("\uAD00\uCC30");
        continue;
      }
    }
    if (keywords.length) {
      return keywords;
    }
    const compact = note.trim().replace(/\s+/g, " ");
    const maxLength = bucket === "buy" ? 30 : 24;
    return [compact.length > maxLength ? `${compact.slice(0, maxLength)}\u2026` : compact];
  }
  function formatLongTermSummary(note, bucket = DEFAULT_LONG_TERM_BUCKET) {
    const keywords = extractLongTermKeywords(note, bucket).slice(0, 4);
    if (!keywords.length) {
      return "";
    }
    return keywords.join(" / ");
  }
  function buildLongTermInsightFromReview(review) {
    const candidate = review?.candidate;
    if (!candidate) {
      return null;
    }
    const bucket = candidate.candidateGroup === "watch candidate" ? "watch" : "buy";
    const keywords = [
      formatLongTermLabel(candidate.label),
      `\uCD1D\uC810 ${candidate.scores.totalScore}\uC810`,
      candidate.drawdownPct != null ? `\uB099\uD3ED ${Math.round(Math.abs(candidate.drawdownPct))}%` : null,
      candidate.baseStructure.isStabilizing ? "\uBC14\uB2E5 \uC548\uC815\uD654" : candidate.baseStructure.higherLowCount >= 2 ? "\uBC14\uB2E5 \uD615\uC131 \uC911" : "\uBC14\uB2E5 \uBBF8\uC644\uC131",
      candidate.financials?.financialMomentum === "deteriorating" ? "\uC2E4\uC801 \uB454\uD654" : candidate.financials?.operatingProfitTrend === "improving" || candidate.financials?.netIncomeTrend === "improving" ? "\uC2E4\uC801 \uAC1C\uC120" : null
    ].filter(Boolean);
    return {
      bucket,
      note: keywords.join(" | "),
      keywords
    };
  }
  function applyLongTermInsightToCatalog(key, review) {
    const insight = buildLongTermInsightFromReview(review);
    if (!insight) {
      return false;
    }
    let changed = false;
    recommendationCatalog = recommendationCatalog.map((item) => {
      if (item.key !== key || (item.category ?? DEFAULT_CATEGORY) === "swing") {
        return item;
      }
      const next = {
        ...item,
        longTermBucket: insight.bucket,
        longTermInsightNote: insight.note,
        longTermInsightKeywords: insight.keywords
      };
      if (JSON.stringify(next) !== JSON.stringify(item)) {
        changed = true;
      }
      return next;
    });
    if (changed) {
      saveCatalog();
    }
    return changed;
  }
  function getLongTermReviewAssessment(review) {
    const candidate = review?.candidate;
    if (!candidate) {
      return {
        className: "broken",
        groupLabel: "\uAD00\uCC30 \uC81C\uC678",
        statusLabel: "\uC5D4\uC9C4 \uB300\uC0C1 \uC544\uB2D8",
        action: "\uC911\uC7A5\uAE30 \uB300\uD45C\uC8FC \uC5D4\uC9C4 \uB300\uC0C1\uC5D0\uC11C \uC81C\uC678",
        summary: review?.filterReasons?.[0] ?? "\uD3C9\uAC00 \uAC00\uB2A5\uD55C \uC911\uC7A5\uAE30 \uC5D4\uC9C4 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
      };
    }
    if (review.enginePass && candidate.candidateGroup === "buy candidate") {
      return {
        className: "ready",
        groupLabel: "\uB9E4\uC218 \uAC00\uB2A5 \uD6C4\uBCF4\uAD70",
        statusLabel: formatLongTermLabel(candidate.label),
        action: "\uBD84\uD560\uB9E4\uC218 \uAC80\uD1A0 \uAC00\uB2A5",
        summary: formatLongTermSummary(candidate.reasonSummary, "buy")
      };
    }
    return {
      className: candidate.label === "deep value review" ? "caution" : "watch",
      groupLabel: formatLongTermGroupLabel(candidate.candidateGroup),
      statusLabel: formatLongTermLabel(candidate.label),
      action: review.enginePass ? "\uAD00\uCC30 \uC720\uC9C0" : "\uC5D4\uC9C4 \uC870\uAC74 \uBBF8\uCDA9\uC871",
      summary: formatLongTermSummary(candidate.reasonSummary, candidate.candidateGroup === "buy candidate" ? "buy" : "watch")
    };
  }
  function renderLongTermReviewPanel(review) {
    if (!review) {
      return "";
    }
    const assessment = getLongTermReviewAssessment(review);
    const candidate = review.candidate;
    const filterReasonChips = Array.isArray(review.filterReasons) ? review.filterReasons.map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`).join("") : "";
    const sourceLabel = review.seedSource === "curated" ? "\uC5D4\uC9C4 \uC2DC\uB4DC" : "\uC218\uB3D9 \uCD94\uAC00 \uD3C9\uAC00";
    return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>\uC911\uC7A5\uAE30 \uC5D4\uC9C4 \uC9C4\uB2E8</h4>
          <div class="swing-pattern-copy">${escapeHtml(assessment.summary)}</div>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(assessment.className)}">${escapeHtml(assessment.groupLabel)}</span>
      </div>
      <div class="swing-pattern-copy">${escapeHtml(assessment.statusLabel)} / ${escapeHtml(assessment.action)} / ${escapeHtml(sourceLabel)}</div>
      ${candidate ? `
            <div class="metric-grid swing-metric-grid">
              <div class="metric">
                <span class="metric-label">\uD6C4\uBCF4\uAD70</span>
                <span class="metric-value">${escapeHtml(formatLongTermGroupLabel(candidate.candidateGroup))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uAD6C\uC870 \uB77C\uBCA8</span>
                <span class="metric-value">${escapeHtml(formatLongTermLabel(candidate.label))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uCD1D\uC810</span>
                <span class="metric-value">${candidate.scores.totalScore}\uC810</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uACE0\uC810 \uB300\uBE44</span>
                <span class="metric-value">${formatPercent(candidate.drawdownPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA120 \uAE30\uC6B8\uAE30</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma120Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA240 \uAE30\uC6B8\uAE30</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma240Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uCD5C\uADFC \uC800\uC810 \uACBD\uACFC</span>
                <span class="metric-value">${formatNumber(candidate.baseStructure.daysSinceLastLowBreak)}\uC77C</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uC800\uC810 \uB300\uBE44 \uAC70\uB9AC</span>
                <span class="metric-value">${formatPercent(candidate.baseStructure.distanceFromLowPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uB300\uD45C\uC131 \uC810\uC218</span>
                <span class="metric-value">${candidate.scores.leaderScore}\uC810</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uC870\uC815 \uC810\uC218</span>
                <span class="metric-value">${candidate.scores.correctionScore}\uC810</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uCD94\uC138 \uC810\uC218</span>
                <span class="metric-value">${candidate.scores.trendScore}\uC810</span>
              </div>
              <div class="metric">
                <span class="metric-label">\uC548\uC815\uD654 \uC810\uC218</span>
                <span class="metric-value">${candidate.scores.stabilizationScore}\uC810</span>
                </div>
                <div class="metric">
                  <span class="metric-label">\uC7AC\uBB34 \uC810\uC218</span>
                  <span class="metric-value">${candidate.scores?.financialScore ?? "-"}${candidate.scores?.financialScore != null ? "\uC810" : ""}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">\uB9E4\uCD9C \uCD94\uC138</span>
                  <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.revenueTrend ?? candidate.fundamentals?.revenueTrend))}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">\uC601\uC5C5\uC774\uC775 \uCD94\uC138</span>
                  <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.operatingProfitTrend ?? candidate.fundamentals?.operatingProfitTrend))}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">ROE / \uBD80\uCC44\uBE44\uC728</span>
                  <span class="metric-value">${(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe) != null ? `${formatSignedDecimal(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe)}%` : "-"} / ${(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio) != null ? `${formatDecimal(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio)}%` : "-"}</span>
                </div>
              </div>
            ` : ""}
      ${filterReasonChips ? `
            <div class="swing-reason-list">
              ${filterReasonChips}
            </div>
          ` : ""}
    </section>
  `;
  }
  function renderCard(item) {
    const returnClass = item.returnSinceAnchor > 0 ? "positive" : item.returnSinceAnchor < 0 ? "negative" : "neutral";
    const longTermAssessment = item.category !== "swing" && item.longTermReview ? getLongTermReviewAssessment(item.longTermReview) : null;
    const longTermInsightNote = item.category === "swing" ? "" : item.longTermInsightNote ?? item.note;
    const longTermNoteSummary = item.category === "swing" ? "" : formatLongTermSummary(longTermInsightNote, item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET);
    return `
    <article class="result-card">
      <div class="card-head">
        <div class="title-wrap">
          <h3>${escapeHtml(item.name || item.shortName || item.symbol)}</h3>
          <div class="meta-line">
            ${escapeHtml(item.symbol)} / \uAE30\uC900\uC77C ${escapeHtml(item.anchorDate)} / \uC2E4\uC81C \uAC70\uB798\uC77C ${escapeHtml(item.tradingAnchorDate)}
          </div>
          <div class="meta-line" data-live-sync-line>\uC2E4\uC2DC\uAC04 \uC2DC\uC138 \uB3D9\uAE30\uD654 \uB300\uAE30</div>
          ${item.swingAssessment ? `<div class="meta-line">\uC2A4\uC719 \uD310\uC815 ${escapeHtml(item.swingAssessment.label)} / ${escapeHtml(item.swingAssessment.action)}</div>` : ""}
          ${item.category === "swing" ? `<div class="meta-line">\uC2A4\uC719 \uBC84\uD0B7 ${escapeHtml(getSwingBucketLabel(item.swingBucket ?? DEFAULT_SWING_BUCKET))}</div>` : ""}
          ${longTermAssessment ? `<div class="meta-line">\uC911\uC7A5\uAE30 \uC5D4\uC9C4 ${escapeHtml(longTermAssessment.groupLabel)} / ${escapeHtml(longTermAssessment.statusLabel)}</div>` : ""}
          ${longTermNoteSummary ? `<div class="meta-line">${escapeHtml(longTermNoteSummary)}</div>` : longTermInsightNote ? `<div class="meta-line">${escapeHtml(longTermInsightNote)}</div>` : ""}
        </div>
        <div class="return-pill ${returnClass}" data-live-return-pill>
          ${formatPercent(item.returnSinceAnchor)}
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">\uAE30\uC900\uC77C \uC885\uAC00</span>
          <span class="metric-value">${formatNumber(item.anchorClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uD604\uC7AC \uC885\uAC00</span>
          <span class="metric-value" data-live-current-price>${formatNumber(item.latestClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uCD5C\uB300 \uC0C1\uC2B9</span>
          <span class="metric-value" data-live-max-gain>${formatPercent(item.maxGainPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uCD5C\uB300 \uD558\uB77D</span>
          <span class="metric-value" data-live-max-drawdown>${formatPercent(item.maxDrawdownPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uCD5C\uACE0 \uC885\uAC00</span>
          <span class="metric-value" data-live-highest-close>${formatNumber(item.highestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uCD5C\uC800 \uC885\uAC00</span>
          <span class="metric-value" data-live-lowest-close>${formatNumber(item.lowestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uAE30\uC900\uC77C \uAC70\uB798\uB7C9 \uBC30\uC218</span>
          <span class="metric-value">${formatMultiplier(item.anchorVolumeVs20dBefore)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uCD5C\uADFC \uAC70\uB798\uB7C9 \uBC30\uC218</span>
          <span class="metric-value" data-live-latest-volume-ratio>${formatMultiplier(item.latestVolumeVs20d)}</span>
        </div>
      </div>

      <div class="chart-wrap">
        <div class="chart-toolbar">
          ${timeframes.map(
      (timeframe) => `
                <button class="timeframe-tab ${timeframe === item.activeTimeframe ? "active" : ""}" type="button" data-timeframe="${timeframe}">
                  ${timeframeLabels[timeframe]}
                </button>
              `
    ).join("")}
        </div>
        <div class="chart-box interactive-chart-box">
          <div class="chart-hint">\uB9C8\uC6B0\uC2A4 \uD720\uB85C \uD655\uB300/\uCD95\uC18C, \uB4DC\uB798\uADF8\uB85C \uC774\uB3D9, \uC2ED\uC790\uC120 \uD234\uD301\uC744 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.</div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-line ma5"></span>5\uC77C\uC120</span>
            <span class="legend-item"><span class="legend-line ma20"></span>20\uC77C\uC120</span>
            <span class="legend-item"><span class="legend-line ma60"></span>60\uC77C\uC120</span>
          </div>
          <div id="chartStack" class="chart-stack">
            <div id="priceChartContainer" class="chart-canvas chart-canvas-price"></div>
            <div id="volumeChartContainer" class="chart-canvas chart-canvas-volume"></div>
          </div>
          <div id="chartTooltip" class="chart-tooltip hidden"></div>
          <div class="chart-caption">
            <span class="timeframe-caption">${timeframeLabels[item.activeTimeframe]}</span>
            <span data-live-chart-start>${escapeHtml(item.chartWindow.startDate)}</span>
            <span data-live-chart-end>${escapeHtml(item.chartWindow.endDate)}</span>
          </div>
        </div>
      </div>

      ${renderSwingPatternPanel(item.swingPatternAnalysis, item.swingAssessment)}
      ${item.category !== "swing" ? renderLongTermReviewPanel(item.longTermReview) : ""}

      <div class="fundamentals-wrap">
        ${renderFundamentals(item.fundamentals, {
      latestClose: item.latestClose,
      latestDate: item.latestDate,
      sectorLabel: getSectorLabel(item.symbol),
      stockName: item.name || item.shortName || item.symbol
    })}
      </div>
    </article>
  `;
  }
  function compareSwingItems(left, right) {
    const leftAssessment = getSwingAssessment(swingPatternByKey.get(left.key)?.pattern);
    const rightAssessment = getSwingAssessment(swingPatternByKey.get(right.key)?.pattern);
    const leftRank = leftAssessment?.rank ?? 0;
    const rightRank = rightAssessment?.rank ?? 0;
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }
    const leftScore = leftAssessment?.sortScore ?? -1;
    const rightScore = rightAssessment?.sortScore ?? -1;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return right.anchorDate.localeCompare(left.anchorDate);
  }
  function resolveLegacySwingStatus(pattern) {
    if (!pattern) {
      return "none";
    }
    if (pattern.stage === "breakout" && pattern.matched && pattern.actionable) {
      return "breakout_confirmed";
    }
    if (pattern.stage === "breakout" && pattern.matched && typeof pattern.referenceCloseVsBreakoutLevelPercent === "number" && pattern.referenceCloseVsBreakoutLevelPercent > 8) {
      return "breakout_extended";
    }
    if (pattern.stage === "breakout" && pattern.matched) {
      return "breakout_ready";
    }
    if (pattern.stage === "setup" && pattern.matched && pattern.actionable) {
      return "buy_ready";
    }
    if (pattern.stage === "setup" && pattern.matched) {
      return "pullback_ready";
    }
    return pattern.stage === "setup" ? "pivot_formed" : "none";
  }
  function getSwingAssessment(pattern) {
    if (!pattern) {
      return null;
    }
    const status = pattern.status ?? resolveLegacySwingStatus(pattern);
    const rankScore = pattern.finalRankScore ?? pattern.regimeAdjustedScore ?? pattern.patternScore ?? 0;
    const statusMap = {
      none: {
        label: "\uAD00\uCC30 \uC804",
        className: "watch",
        rank: 0,
        description: "\uAE30\uC900\uBD09\uACFC \uB20C\uB9BC \uAD6C\uC870\uAC00 \uC544\uC9C1 \uBD84\uD560\uB9E4\uC218 \uAD00\uC810\uC5D0\uC11C \uCDA9\uBD84\uD788 \uC7A1\uD788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
        action: "\uAD6C\uC870 \uD655\uC778\uC774 \uBA3C\uC800"
      },
      pivot_formed: {
        label: "\uAE30\uC900\uBD09 \uD615\uC131",
        className: "watch",
        rank: 2,
        description: "\uAC70\uB798\uB7C9\uACFC \uAC00\uACA9\uC774 \uBD99\uB294 \uAE30\uC900\uBD09\uC740 \uBCF4\uC600\uC9C0\uB9CC, \uC544\uC9C1 \uB20C\uB9BC\uC774 \uCDA9\uBD84\uD788 \uC9C4\uD589\uB418\uC9C0\uB294 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
        action: "\uB20C\uB9BC \uD655\uC778 \uB300\uAE30"
      },
      pullback_early: {
        label: "\uB20C\uB9BC \uCD08\uAE30",
        className: "watch",
        rank: 3,
        description: "\uAE30\uC900\uBD09 \uC774\uD6C4 \uC870\uC815\uC774 \uC2DC\uC791\uB410\uC9C0\uB9CC, \uC2DC\uAC04\uC774\uB098 \uAC00\uACA9 \uC18C\uD654\uAC00 \uC544\uC9C1 \uB354 \uD544\uC694\uD569\uB2C8\uB2E4.",
        action: "\uC131\uAE09\uD55C \uC9C4\uC785 \uAE08\uC9C0"
      },
      pullback_ready: {
        label: "\uB20C\uB9BC \uC644\uC131",
        className: "setup",
        rank: 4,
        description: "\uAC70\uB798\uB7C9\uC774 \uC2DD\uC73C\uBA74\uC11C \uB20C\uB9BC \uAD6C\uC870\uAC00 \uC5B4\uB290 \uC815\uB3C4 \uC815\uB9AC\uB410\uACE0, \uC774\uC81C \uAE30\uC900 \uAC00\uACA9\uB300\uB97C \uB2E4\uC2DC \uD655\uC778\uD560 \uC218 \uC788\uB294 \uAD6C\uAC04\uC785\uB2C8\uB2E4.",
        action: "\uBD84\uD560\uB9E4\uC218 \uC900\uBE44"
      },
      buy_ready: {
        label: "1\uCC28 \uB9E4\uC218 \uAC00\uB2A5",
        className: "setup",
        rank: 6,
        description: "\uB20C\uB9BC\uC774 \uCDA9\uBD84\uD788 \uC9C4\uD589\uB410\uACE0 \uD604\uC7AC \uAC00\uACA9\uC774 \uBD84\uD560\uB9E4\uC218 \uAD6C\uAC04 \uADFC\uCC98\uC5D0\uC11C \uBC84\uD2F0\uB294 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
        action: "1\uCC28 \uBD84\uD560\uB9E4\uC218 \uAC00\uB2A5"
      },
      breakout_extended: {
        label: "\uCD94\uACA9 \uAE08\uC9C0",
        className: "caution",
        rank: 2,
        description: "\uB3CC\uD30C \uAD6C\uC870 \uC790\uCCB4\uB294 \uC0B4\uC544 \uC788\uC9C0\uB9CC \uAC00\uACA9\uC774 \uB108\uBB34 \uBA40\uB9AC \uB2EC\uC544\uB098 \uC2E0\uADDC \uC9C4\uC785\uC740 \uBD88\uB9AC\uD55C \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
        action: "\uB20C\uB9BC \uC7AC\uD615\uC131 \uB300\uAE30"
      },
      breakout_ready: {
        label: "\uC7AC\uB3CC\uD30C \uB300\uAE30",
        className: "ready",
        rank: 5,
        description: "\uAD6C\uC870\uB294 \uC0B4\uC544 \uC788\uC9C0\uB9CC \uBC14\uB85C \uCD94\uACA9\uD558\uAE30\uBCF4\uB2E4 \uB3CC\uD30C\uC120 \uC548\uCC29\uC774\uB098 \uC7AC\uD655\uC778\uC744 \uAE30\uB2E4\uB9AC\uB294 \uD3B8\uC774 \uC88B\uC2B5\uB2C8\uB2E4.",
        action: "\uC7AC\uB3CC\uD30C \uD655\uC778 \uB300\uAE30"
      },
      breakout_confirmed: {
        label: "\uC7AC\uB3CC\uD30C \uD655\uC778",
        className: "complete",
        rank: 7,
        description: "\uB20C\uB9BC \uB4A4 \uC7AC\uB3CC\uD30C\uAC00 \uD655\uC778\uB41C \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uCD94\uACA9\uBCF4\uB2E4 \uBCF4\uC720\xB7\uB20C\uB9BC \uC7AC\uD655\uC778\uC744 \uD568\uAED8 \uBD10\uC57C \uD569\uB2C8\uB2E4.",
        action: "\uCD94\uACA9\uBCF4\uB2E4 \uC7AC\uD655\uC778"
      },
      broken: {
        label: "\uC774\uD0C8",
        className: "broken",
        rank: 1,
        description: "\uAE30\uC900\uBD09 \uC800\uC810\uC774\uB098 \uB20C\uB9BC \uC800\uC810\uC774 \uD6FC\uC190\uB3FC \uAD6C\uC870\uAC00 \uBB34\uB108\uC9C4 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
        action: "\uAD00\uCC30 \uC885\uB8CC"
      }
    };
    const base = statusMap[status] ?? statusMap.none;
    return {
      ...base,
      status,
      sortScore: rankScore
    };
  }
  function getSwingStructureLabel(pattern) {
    if (!pattern) {
      return "-";
    }
    if (pattern.stage === "breakout") {
      return "\uC7AC\uB3CC\uD30C \uD655\uC778 \uB2E8\uACC4";
    }
    if (pattern.setupType === "time_correction") {
      return "\uC2DC\uAC04 \uC870\uC815\uD615";
    }
    if (pattern.setupType === "volatile_power_digestion") {
      return "\uBCC0\uB3D9\uC131 \uC18C\uD654\uD615";
    }
    if (pattern.stage === "setup") {
      return "\uAC00\uACA9 \uB20C\uB9BC\uD615";
    }
    return "\uAD6C\uC870 \uAD00\uCC30";
  }
  function formatSwingPriceBand(low, high) {
    if (typeof low !== "number" && typeof high !== "number") {
      return "-";
    }
    if (typeof low === "number" && typeof high === "number") {
      return `${formatNumber(low)}\uC6D0 ~ ${formatNumber(high)}\uC6D0`;
    }
    const single = typeof high === "number" ? high : low;
    return single == null ? "-" : `${formatNumber(single)}\uC6D0`;
  }
  function parseSwingPlanSegment(note, label) {
    if (typeof note !== "string" || !note.trim()) {
      return null;
    }
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = note.match(new RegExp(`(?:^|\\|)\\s*${escapedLabel}\\s*([^|]+)`));
    return match?.[1]?.trim() ?? null;
  }
  function parsePriceNumbers(text) {
    if (typeof text !== "string" || !text.trim()) {
      return [];
    }
    const matches = [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)];
    return matches.filter((match) => isLikelyPriceMatch(text, match[0], match.index ?? 0)).map((match) => Number.parseFloat(match[0].replaceAll(",", ""))).filter((value) => Number.isFinite(value) && value > 0);
  }
  function isLikelyPriceMatch(text, rawValue, index) {
    const normalized = String(rawValue ?? "").replaceAll(",", "");
    if (!normalized) {
      return false;
    }
    const nextText = text.slice(index + String(rawValue).length, index + String(rawValue).length + 2);
    if (nextText.startsWith("\uC6D0")) {
      return true;
    }
    const integerPart = normalized.split(".")[0] ?? normalized;
    return integerPart.length >= 4 || String(rawValue).includes(",");
  }
  function collectPriceMatches(text) {
    if (typeof text !== "string" || !text.trim()) {
      return [];
    }
    return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => ({
      value: Number.parseFloat(match[0].replaceAll(",", "")),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      raw: match[0]
    })).filter((entry) => Number.isFinite(entry.value) && entry.value > 0 && isLikelyPriceMatch(text, entry.raw, entry.index));
  }
  function findPricesNearLabels(note, labels, options = {}) {
    if (typeof note !== "string" || !note.trim()) {
      return [];
    }
    const {
      searchBefore = true,
      searchAfter = true,
      maxGapBefore = 10,
      maxGapAfter = 10,
      collectAll = false
    } = options;
    const numberMatches = collectPriceMatches(note);
    if (!numberMatches.length) {
      return [];
    }
    const candidates = [];
    for (const label of labels) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?:^|\\|)\\s*(${escapedLabel})(?=\\s|[:\uFF1A]|$)`, "g");
      for (const match of note.matchAll(regex)) {
        const prefix = match[0] ?? "";
        const captured = match[1] ?? label;
        const labelIndex = (match.index ?? 0) + prefix.lastIndexOf(captured);
        const labelEnd = labelIndex + captured.length;
        const nearby = [];
        if (searchBefore) {
          const beforeMatches = numberMatches.filter((entry) => entry.end <= labelIndex && labelIndex - entry.end <= maxGapBefore).sort((left, right) => right.end - left.end);
          nearby.push(...beforeMatches);
        }
        if (searchAfter) {
          const afterMatches = numberMatches.filter((entry) => entry.index >= labelEnd && entry.index - labelEnd <= maxGapAfter).sort((left, right) => left.index - right.index);
          nearby.push(...afterMatches);
        }
        if (!nearby.length) {
          continue;
        }
        if (collectAll) {
          candidates.push(...nearby.map((entry) => entry.value));
        } else {
          candidates.push(nearby[0].value);
        }
      }
    }
    return [...new Set(candidates)];
  }
  function parseSwingPlanNumbersFromNote(note) {
    const buySegment = parseSwingPlanSegment(note, "\uB9E4\uC218\uAC00") ?? parseSwingPlanSegment(note, "\uB9E4\uC218");
    const stopSegment = parseSwingPlanSegment(note, "\uC190\uC808\uAC00") ?? parseSwingPlanSegment(note, "\uC190\uC808");
    const buyPricesFromSegment = parsePriceNumbers(buySegment);
    const stopPricesFromSegment = parsePriceNumbers(stopSegment);
    const buyPricesFromNearby = buyPricesFromSegment.length ? [] : findPricesNearLabels(note, ["\uB9E4\uC218\uAC00", "\uB9E4\uC218"], {
      searchBefore: true,
      searchAfter: true,
      maxGapBefore: 12,
      maxGapAfter: 18,
      collectAll: true
    });
    const stopPricesFromNearby = stopPricesFromSegment.length ? [] : findPricesNearLabels(note, ["\uC190\uC808\uAC00", "\uC190\uC808"], {
      searchBefore: true,
      searchAfter: true,
      maxGapBefore: 4,
      maxGapAfter: 12,
      collectAll: false
    });
    return {
      buyPrices: [.../* @__PURE__ */ new Set([...buyPricesFromSegment, ...buyPricesFromNearby])],
      stopPrice: [...stopPricesFromSegment, ...stopPricesFromNearby][0]
    };
  }
  function sanitizeSwingTradeLevels(buyPrices, stopPrice) {
    const normalizedStopPrice = Number.isFinite(stopPrice) && stopPrice > 0 ? Math.round(stopPrice * 100) / 100 : void 0;
    const normalizedBuyPrices = [...new Set(
      (Array.isArray(buyPrices) ? buyPrices : []).filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.round(value * 100) / 100)
    )].filter((value) => normalizedStopPrice == null || value > normalizedStopPrice).sort((left, right) => right - left);
    return {
      buyPrices: normalizedBuyPrices,
      stopPrice: normalizedStopPrice
    };
  }
  function getSwingTradeOverlay(note, pattern) {
    const notePlan = parseSwingPlanNumbersFromNote(note);
    const patternBuyPrices = pattern?.buyPlan ? [pattern.buyPlan.firstBuyPrice, pattern.buyPlan.secondBuyPrice, pattern.buyPlan.thirdBuyPrice] : pattern && (typeof pattern.entryZoneLow === "number" || typeof pattern.entryZoneHigh === "number") ? [pattern.entryZoneHigh, pattern.entryZoneLow] : [];
    const buyPrices = patternBuyPrices.length ? patternBuyPrices : notePlan.buyPrices;
    const stopPriceRaw = notePlan.stopPrice;
    const stopPriceFromNote = Number.isFinite(stopPriceRaw) && stopPriceRaw > 0 ? Math.round(stopPriceRaw * 100) / 100 : void 0;
    const stopPriceFromPattern = pattern && typeof pattern.buyPlan?.stopLossPrice === "number" && pattern.buyPlan.stopLossPrice > 0 ? Math.round(pattern.buyPlan.stopLossPrice * 100) / 100 : pattern && typeof pattern.invalidationPrice === "number" && pattern.invalidationPrice > 0 ? Math.round(pattern.invalidationPrice * 100) / 100 : void 0;
    const sanitized = sanitizeSwingTradeLevels(buyPrices, stopPriceFromPattern ?? stopPriceFromNote);
    return {
      buyPrices: sanitized.buyPrices,
      stopPrice: sanitized.stopPrice
    };
  }
  function getSwingCardTradePlan(note, pattern) {
    const overlay = getSwingTradeOverlay(note, pattern);
    const buyPlan = pattern?.buyPlan;
    const buyLevelsFromOverlay = overlay.buyPrices.map((price, index) => `${index + 1}\uCC28 ${formatNumber(price)}\uC6D0`);
    const buyLevelsFromPlan = buyPlan ? [buyPlan.firstBuyPrice, buyPlan.secondBuyPrice, buyPlan.thirdBuyPrice].filter((price) => Number.isFinite(price) && price > 0).map((price, index) => `${index + 1}\uCC28 ${formatNumber(price)}\uC6D0`) : [];
    const buyFromNote = parseSwingPlanSegment(note, "\uB9E4\uC218\uAC00") ?? parseSwingPlanSegment(note, "\uB9E4\uC218");
    const buyLevelsFromNote = !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && buyFromNote ? splitSwingTradeSegments(buyFromNote).map((segment, index) => formatSwingBuyLevel(segment, index)) : [];
    const buySummaryFromPattern = !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && pattern ? `\uC9C4\uC785 \uAD6C\uAC04 ${formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh)}` : null;
    const stopFromPattern = typeof overlay.stopPrice === "number" && overlay.stopPrice > 0 ? `${formatNumber(overlay.stopPrice)}\uC6D0` : null;
    const stopFromNote = parseSwingPlanSegment(note, "\uC190\uC808\uAC00") ?? parseSwingPlanSegment(note, "\uC190\uC808");
    const buyLevels = buyLevelsFromOverlay.length ? buyLevelsFromOverlay : buyLevelsFromPlan.length ? buyLevelsFromPlan : buyLevelsFromNote;
    return {
      buyLevels,
      buySummary: buySummaryFromPattern ?? (buyLevels.length ? "-" : buyFromNote ?? "-"),
      stop: stopFromPattern ?? stopFromNote ?? "-"
    };
  }
  function splitSwingTradeSegments(text) {
    if (typeof text !== "string" || !text.trim()) {
      return [];
    }
    return text.split("/").map((segment) => segment.trim()).filter(Boolean);
  }
  function formatSwingBuyLevel(segment, index) {
    const trimmed = String(segment ?? "").trim();
    if (!trimmed) {
      return "";
    }
    if (/[1-9]차/.test(trimmed) || /^진입\s*구간/.test(trimmed)) {
      return trimmed;
    }
    return `${index + 1}\uCC28 ${trimmed}`;
  }
  function renderSwingPatternPanel(swingPatternAnalysis, swingAssessment) {
    if (!swingPatternAnalysis || !swingPatternAnalysis.pattern || !swingAssessment) {
      return "";
    }
    const pattern = swingPatternAnalysis.pattern;
    const scoreReasons = encodeURIComponent(JSON.stringify(pattern.reasons?.length ? pattern.reasons : [pattern.summary]));
    const scoreDescription = encodeURIComponent(swingAssessment.description);
    const scoreSummary = encodeURIComponent(pattern.summary ?? "");
    const scoreGuide = encodeURIComponent(swingScoreGuideText);
    const scoreAction = encodeURIComponent(swingAssessment.action);
    const scoreEntry = encodeURIComponent(formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh));
    const scoreInvalidation = encodeURIComponent(
      typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}\uC6D0` : "-"
    );
    const priceLocation = pattern.referenceCloseVsBreakoutLevelPercent == null ? "-" : `\uB3CC\uD30C\uC120 ${pattern.referenceCloseVsBreakoutLevelPercent.toFixed(1)}% / \uD53C\uD06C ${pattern.referenceCloseVsPeakPercent == null ? "-" : `${pattern.referenceCloseVsPeakPercent.toFixed(1)}%`}`;
    return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>\uC2A4\uC719 \uD328\uD134 \uD310\uC815</h4>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">${escapeHtml(swingAssessment.label)}</span>
      </div>

      <div class="metric-grid swing-metric-grid">
        <button
          class="metric metric-button"
          type="button"
          data-score-explain-toggle="modal"
          data-score-label="${escapeHtml(swingAssessment.label)}"
          data-score-description="${escapeHtml(scoreDescription)}"
          data-score-summary="${escapeHtml(scoreSummary)}"
          data-score-guide="${escapeHtml(scoreGuide)}"
          data-score-action="${escapeHtml(scoreAction)}"
          data-score-entry="${escapeHtml(scoreEntry)}"
          data-score-invalidation="${escapeHtml(scoreInvalidation)}"
          data-score-reasons="${escapeHtml(scoreReasons)}"
        >
          <span class="metric-label">\uC0C1\uD0DC \uC124\uBA85</span>
          <span class="metric-value">${escapeHtml(swingAssessment.label)}</span>
          <span class="metric-hint">\uB20C\uB7EC\uC11C \uC804\uB7B5 \uBCF4\uAE30</span>
        </button>
        <div class="metric">
          <span class="metric-label">\uAE30\uC900 \uC708\uB3C4\uC6B0</span>
          <span class="metric-value">${SWING_LOOKBACK_DAYS}\uAC70\uB798\uC77C</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uB0B4\uBD80 \uAD6C\uC870</span>
          <span class="metric-value">${escapeHtml(getSwingStructureLabel(pattern))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uC9C4\uC785 \uAD6C\uAC04</span>
          <span class="metric-value">${escapeHtml(formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uC774\uD0C8 \uAE30\uC900</span>
          <span class="metric-value">${typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}\uC6D0` : "-"}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uC120\uD589 \uC218\uAE09\uC77C</span>
          <span class="metric-value">${escapeHtml(pattern.leadInDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uAE09\uB4F1 \uD53C\uD06C\uC77C</span>
          <span class="metric-value">${escapeHtml(pattern.surgePeakDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uAE09\uB4F1 \uC720\uC9C0</span>
          <span class="metric-value">${pattern.surgeContinuationSessions == null ? "-" : `${escapeHtml(String(pattern.surgeContinuationSessions + 1))}\uAC70\uB798\uC77C`}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uB20C\uB9BC \uAD6C\uAC04</span>
          <span class="metric-value">${escapeHtml(pattern.pullbackStartDate ?? "-")} ~ ${escapeHtml(pattern.pullbackEndDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uB20C\uB9BC \uBC94\uC704</span>
          <span class="metric-value">${pattern.pullbackRangePercent == null ? "-" : `${escapeHtml(pattern.pullbackRangePercent.toFixed(1))}%`}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uB3CC\uD30C\uC77C</span>
          <span class="metric-value">${escapeHtml(pattern.breakoutDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">\uD604\uC7AC \uAC00\uACA9 \uC704\uCE58</span>
          <span class="metric-value">${escapeHtml(priceLocation)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">${pattern.stage === "breakout" ? "\uB3CC\uD30C \uD6C4 \uACBD\uACFC" : "\uD53C\uD06C \uD6C4 \uACBD\uACFC"}</span>
          <span class="metric-value">${pattern.stage === "breakout" ? pattern.sessionsSinceBreakout == null ? "-" : `${escapeHtml(String(pattern.sessionsSinceBreakout))}\uAC70\uB798\uC77C` : pattern.sessionsSincePeak == null ? "-" : `${escapeHtml(String(pattern.sessionsSincePeak))}\uAC70\uB798\uC77C`}</span>
        </div>
      </div>
    </section>
  `;
  }
  function cleanupChart() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (activeChart) {
      clearInteractivePriceLines(activeChart);
      activeChart.priceChart.remove();
      activeChart.volumeChart.remove();
      activeChart = null;
    }
  }
  function buildInteractiveCandleSeriesData(points) {
    return points.map(
      (point) => point.isWhitespace ? {
        time: point.time
      } : {
        time: point.time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close
      }
    );
  }
  function buildInteractiveVolumeSeriesData(points) {
    return points.map(
      (point) => point.isWhitespace ? {
        time: point.time
      } : {
        time: point.time,
        value: point.value,
        color: point.isHalted ? "rgba(120, 128, 140, 0.22)" : point.close >= point.open ? "rgba(216,76,63,0.35)" : "rgba(47,110,229,0.32)"
      }
    );
  }
  function clearInteractivePriceLines(chartEntry) {
    if (!chartEntry?.priceLines?.length) {
      chartEntry.priceLines = [];
      return;
    }
    for (const priceLine of chartEntry.priceLines) {
      chartEntry.candleSeries.removePriceLine(priceLine);
    }
    chartEntry.priceLines = [];
  }
  function applyInteractivePriceLines(chartEntry, points, anchorDate, swingTradeOverlay = null) {
    clearInteractivePriceLines(chartEntry);
    const buyPrices = Array.isArray(swingTradeOverlay?.buyPrices) ? swingTradeOverlay.buyPrices.filter((price) => Number.isFinite(price) && price > 0) : [];
    const hasTradeOverlay = buyPrices.length > 0 || typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0;
    const anchorPoint = points.find((point) => point.time === anchorDate && !point.isWhitespace) ?? points.find((point) => !point.isWhitespace);
    if (!hasTradeOverlay && anchorPoint?.close != null) {
      chartEntry.priceLines.push(
        chartEntry.candleSeries.createPriceLine({
          price: anchorPoint.close,
          color: "rgba(159,62,25,0.85)",
          lineStyle: import_lightweight_charts_standalone_production.LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: `\uAE30\uC900\uC77C ${anchorDate}`
        })
      );
    }
    buyPrices.forEach((price, index) => {
      chartEntry.priceLines.push(
        chartEntry.candleSeries.createPriceLine({
          price,
          color: "rgba(202, 138, 4, 0.95)",
          lineStyle: import_lightweight_charts_standalone_production.LineStyle.Dashed,
          lineWidth: 2,
          axisLabelVisible: true,
          title: buyPrices.length > 1 ? `${index + 1}\uCC28 \uB9E4\uC218` : "\uB9E4\uC218\uAC00"
        })
      );
    });
    if (typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0) {
      chartEntry.priceLines.push(
        chartEntry.candleSeries.createPriceLine({
          price: swingTradeOverlay.stopPrice,
          color: "rgba(185, 28, 28, 0.95)",
          lineStyle: import_lightweight_charts_standalone_production.LineStyle.Dotted,
          lineWidth: 2,
          axisLabelVisible: true,
          title: "\uC190\uC808\uAC00"
        })
      );
    }
  }
  function updateInteractiveChartData(points, anchorDate, swingTradeOverlay = null, options = {}) {
    if (!activeChart) {
      mountInteractiveChart(points, anchorDate, swingTradeOverlay);
      return;
    }
    activeChart.chartState.points = points;
    activeChart.anchorDate = anchorDate;
    activeChart.swingTradeOverlay = swingTradeOverlay;
    activeChart.candleSeries.setData(buildInteractiveCandleSeriesData(points));
    activeChart.volumeSeries.setData(buildInteractiveVolumeSeriesData(points));
    activeChart.ma5Series.setData(buildMovingAverage(points, 5));
    activeChart.ma20Series.setData(buildMovingAverage(points, 20));
    activeChart.ma60Series.setData(buildMovingAverage(points, 60));
    applyInteractivePriceLines(activeChart, points, anchorDate, swingTradeOverlay);
    if (options.resetVisibleRange) {
      setDefaultVisibleTradingRange(activeChart.priceChart, points);
    }
  }
  function mountInteractiveChart(points, anchorDate, swingTradeOverlay = null) {
    const priceContainer = document.querySelector("#priceChartContainer");
    const volumeContainer = document.querySelector("#volumeChartContainer");
    const stack = document.querySelector("#chartStack");
    const tooltip = document.querySelector("#chartTooltip");
    if (!priceContainer || !volumeContainer || !stack || !tooltip) {
      return;
    }
    cleanupChart();
    const commonChartOptions = {
      width: stack.clientWidth || 840,
      layout: {
        background: { type: import_lightweight_charts_standalone_production.ColorType.Solid, color: "#fdfaf4" },
        textColor: "#695d4e",
        fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
      },
      grid: {
        vertLines: { color: "rgba(31,26,20,0.05)", style: import_lightweight_charts_standalone_production.LineStyle.Dashed },
        horzLines: { color: "rgba(31,26,20,0.08)", style: import_lightweight_charts_standalone_production.LineStyle.Dashed }
      },
      crosshair: {
        mode: import_lightweight_charts_standalone_production.CrosshairMode.Normal,
        vertLine: {
          color: "rgba(159,62,25,0.45)",
          width: 1,
          style: import_lightweight_charts_standalone_production.LineStyle.Dashed,
          labelVisible: false
        },
        horzLine: { color: "rgba(159,62,25,0.25)", width: 1, style: import_lightweight_charts_standalone_production.LineStyle.Dashed }
      },
      rightPriceScale: {
        borderColor: "rgba(31,26,20,0.12)"
      },
      timeScale: {
        borderColor: "rgba(31,26,20,0.12)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true
      }
    };
    const priceChart = (0, import_lightweight_charts_standalone_production.createChart)(priceContainer, {
      ...commonChartOptions,
      height: 330
    });
    const volumeChart = (0, import_lightweight_charts_standalone_production.createChart)(volumeContainer, {
      ...commonChartOptions,
      height: 120
    });
    const candleSeries = priceChart.addSeries(import_lightweight_charts_standalone_production.CandlestickSeries, {
      upColor: "#d84c3f",
      downColor: "#2f6ee5",
      borderUpColor: "#d84c3f",
      borderDownColor: "#2f6ee5",
      wickUpColor: "#d84c3f",
      wickDownColor: "#2f6ee5",
      priceLineVisible: false
    });
    const volumeSeries = volumeChart.addSeries(import_lightweight_charts_standalone_production.HistogramSeries, {
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: 0
      }
    });
    const ma5Series = priceChart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
      color: "#177245",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const ma20Series = priceChart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
      color: "#d84c3f",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const ma60Series = priceChart.addSeries(import_lightweight_charts_standalone_production.LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const chartState = {
      points
    };
    candleSeries.setData(buildInteractiveCandleSeriesData(points));
    volumeSeries.setData(buildInteractiveVolumeSeriesData(points));
    ma5Series.setData(buildMovingAverage(points, 5));
    ma20Series.setData(buildMovingAverage(points, 20));
    ma60Series.setData(buildMovingAverage(points, 60));
    let syncingRange = false;
    const syncVisibleRange = (sourceChart, targetChart) => {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncingRange || range == null) {
          return;
        }
        syncingRange = true;
        targetChart.timeScale().setVisibleLogicalRange(range);
        syncingRange = false;
      });
    };
    syncVisibleRange(priceChart, volumeChart);
    syncVisibleRange(volumeChart, priceChart);
    priceChart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !param.seriesData.size) {
        tooltip.classList.add("hidden");
        return;
      }
      const currentPoints = activeChart?.chartState?.points ?? chartState.points;
      const candleData = param.seriesData.get(candleSeries);
      if (!candleData || !("open" in candleData)) {
        const point2 = currentPoints.find((candidate) => candidate.time === String(param.time));
        if (!point2?.isWhitespace) {
          tooltip.classList.add("hidden");
          return;
        }
        const left2 = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
        const top2 = Math.max(param.point.y - 18, 12);
        tooltip.style.left = `${left2}px`;
        tooltip.style.top = `${top2}px`;
        tooltip.classList.remove("hidden");
        tooltip.innerHTML = `
        <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
        <div>${point2?.isHalted ? "\uAC70\uB798\uC815\uC9C0" : "\uAC70\uB798 \uC5C6\uC74C"}</div>
      `;
        return;
      }
      const point = currentPoints.find((candidate) => candidate.time === String(param.time));
      const left = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
      const top = Math.max(param.point.y - 18, 12);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.classList.remove("hidden");
      tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
      ${point?.isHalted ? `<div>\uAC70\uB798\uC815\uC9C0</div>` : ""}
      <div>\uC2DC\uAC00 ${formatNumber(candleData.open)}</div>
      <div>\uACE0\uAC00 ${formatNumber(candleData.high)}</div>
      <div>\uC800\uAC00 ${formatNumber(candleData.low)}</div>
      <div>\uC885\uAC00 ${formatNumber(candleData.close)}</div>
      <div>\uAC70\uB798\uB7C9 ${formatNumber(point?.value)}</div>
    `;
    });
    setDefaultVisibleTradingRange(priceChart, points);
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = entry.contentRect.width;
      priceChart.applyOptions({ width });
      volumeChart.applyOptions({ width });
    });
    resizeObserver.observe(stack);
    activeChart = {
      priceChart,
      volumeChart,
      priceContainer,
      volumeContainer,
      candleSeries,
      volumeSeries,
      ma5Series,
      ma20Series,
      ma60Series,
      chartState,
      anchorDate,
      swingTradeOverlay,
      priceLines: []
    };
    applyInteractivePriceLines(activeChart, points, anchorDate, swingTradeOverlay);
  }
  function buildMovingAverage(points, period) {
    const result = [];
    const tradingPoints = points.filter((point) => !point.isWhitespace && typeof point.close === "number");
    for (let index = 0; index < tradingPoints.length; index += 1) {
      if (index + 1 < period) {
        continue;
      }
      const window2 = tradingPoints.slice(index - period + 1, index + 1);
      const average = window2.reduce((sum, point) => sum + point.close, 0) / period;
      result.push({
        time: tradingPoints[index].time,
        value: average
      });
    }
    return result;
  }
  function setDefaultVisibleTradingRange(priceChart, points, visibleSessions = DEFAULT_VISIBLE_TRADING_SESSIONS) {
    const tradingIndexes = points.map((point, index) => ({ point, index })).filter(({ point }) => !point.isWhitespace && typeof point.close === "number");
    if (!tradingIndexes.length) {
      priceChart.timeScale().fitContent();
      return;
    }
    const endIndex = tradingIndexes.at(-1).index;
    const startIndex = tradingIndexes[Math.max(0, tradingIndexes.length - visibleSessions)].index;
    priceChart.timeScale().setVisibleLogicalRange({
      from: startIndex - 1,
      to: endIndex + 0.5
    });
  }
  function getChartSeriesRange(points) {
    const normalized = Array.isArray(points) ? points.filter((point) => point?.time) : [];
    return {
      startDate: normalized[0]?.time ?? "-",
      endDate: normalized.at(-1)?.time ?? "-"
    };
  }
  function updateChartView(timeframe) {
    if (!currentAnalysis) {
      return;
    }
    for (const tab of results.querySelectorAll(".timeframe-tab")) {
      tab.classList.toggle("active", tab.dataset.timeframe === timeframe);
    }
    const caption = results.querySelector(".timeframe-caption");
    if (caption) {
      caption.textContent = timeframeLabels[timeframe];
    }
    const range = getChartSeriesRange(currentAnalysis.chartSets[timeframe]);
    syncLiveMetric("[data-live-chart-start]", range.startDate);
    syncLiveMetric("[data-live-chart-end]", range.endDate);
    updateInteractiveChartData(
      currentAnalysis.chartSets[timeframe],
      currentAnalysis.tradingAnchorDate,
      currentAnalysis.swingTradeOverlay,
      { resetVisibleRange: true }
    );
  }
  function renderFundamentals(fundamentals, priceContext) {
    const priceReference = priceContext?.latestClose != null ? `\uAC00\uACA9 \uAE30\uC900: ${formatNumber(priceContext.latestClose)}\uC6D0${priceContext?.latestDate ? ` (${priceContext.latestDate} \uC885\uAC00)` : ""}` : "";
    const businessProfileHtml = renderBusinessProfile(fundamentals, priceContext);
    const hasAnnualHistory = Array.isArray(fundamentals?.annualHistory) && fundamentals.annualHistory.length > 0;
    const hasQuarterlyHistory = Array.isArray(fundamentals?.quarterlyHistory) && fundamentals.quarterlyHistory.length > 0;
    const hasFinancials = Boolean(fundamentals?.annual || fundamentals?.quarterly || hasAnnualHistory || hasQuarterlyHistory);
    if (!hasFinancials && !businessProfileHtml) {
      return `
      <section class="fundamentals-panel empty-fundamentals">
        <div class="fundamentals-head">
          <h4>\uC7AC\uBB34\uC9C0\uD45C ${renderInfoIcon(fundamentalsGuideText, "\uC7AC\uBB34\uC9C0\uD45C \uC548\uB0B4")}</h4>
          ${priceReference ? `<span>${escapeHtml(priceReference)}</span>` : ""}
        </div>
        <p>\uC774 \uC885\uBAA9\uC740 \uC7AC\uBB34 \uB370\uC774\uD130\uB97C \uCC3E\uC9C0 \uBABB\uD588\uAC70\uB098 ETF\uC5EC\uC11C \uD45C\uC2DC\uD560 \uC7AC\uBB34\uC9C0\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
      </section>
    `;
    }
    return `
      <section class="fundamentals-panel">
        <div class="fundamentals-head">
          <h4>\uC7AC\uBB34\uC9C0\uD45C ${renderInfoIcon(fundamentalsGuideText, "\uC7AC\uBB34\uC9C0\uD45C \uC548\uB0B4")}</h4>
          <span>${escapeHtml(fundamentals?.source || "\uB370\uC774\uD130 \uC5C6\uC74C")}</span>
        </div>
        ${priceReference ? `<div class="fundamentals-price-reference">${escapeHtml(priceReference)}</div>` : ""}
        ${businessProfileHtml}
        ${hasFinancials ? `
              ${renderQuarterlyHistoryTable(fundamentals)}
            ` : `<div class="fundamental-empty">\uC7AC\uBB34 \uC218\uCE58\uB294 \uC544\uC9C1 \uBE44\uC5B4 \uC788\uC9C0\uB9CC, \uC0AC\uC5C5 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uB9F5\uC740 \uBA3C\uC800 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</div>`}
      </section>
  `;
  }
  function renderBusinessProfile(fundamentals, priceContext) {
    const businessAreas = getBusinessAreasForRender(fundamentals, priceContext?.sectorLabel);
    const businessSummary = typeof fundamentals?.businessSummary === "string" ? fundamentals.businessSummary.trim() : "";
    if (!businessAreas.length && !businessSummary) {
      return "";
    }
    const profileSource = fundamentals?.businessAreasSource || (priceContext?.sectorLabel ? `\uC5C5\uC885 \uAE30\uC900 \uAE30\uBCF8 \uB9F5 \xB7 ${priceContext.sectorLabel}` : "\uC0AC\uC5C5 \uAC1C\uC694 \uAE30\uBC18 \uCD94\uC815");
    return `
    <section class="business-profile-panel">
      <div class="business-profile-head">
        <div>
          <h5>\uC0AC\uC5C5 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uB9F5 ${renderInfoIcon(businessAreaGuideText, "\uC0AC\uC5C5 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC548\uB0B4")}</h5>
          <div class="business-profile-copy">\uD55C \uC885\uBAA9\uC774 \uAC00\uC9C4 \uC5EC\uB7EC \uC0AC\uC5C5 \uCD95\uC744 \uC6D0\uD615 \uADF8\uB798\uD504\uB85C \uBE60\uB974\uAC8C \uC77D\uB294 \uBCF4\uB4DC\uC785\uB2C8\uB2E4.</div>
        </div>
        <span class="business-profile-source">${escapeHtml(profileSource)}</span>
      </div>

      <div class="business-profile-layout">
        <div class="business-profile-chart-wrap">
          <div class="business-profile-chart" style="background:${escapeHtml(buildBusinessAreaGradient(businessAreas))};">
            <div class="business-profile-chart-hole">
              <strong>${escapeHtml(priceContext?.stockName || "\uC0AC\uC5C5 \uAD6C\uC870")}</strong>
              <span>${escapeHtml(String(businessAreas.length || 1))}\uAC1C \uCD95</span>
            </div>
          </div>
        </div>

        <div class="business-profile-legend">
          ${businessAreas.map(
      (area, index) => `
                <div class="business-profile-item">
                  <span class="business-profile-swatch" style="background:${escapeHtml(getBusinessAreaColor(index))};"></span>
                  <div class="business-profile-item-copy">
                    <strong>${escapeHtml(area.label)}</strong>
                    <span>${escapeHtml(String(area.weight))}%</span>
                  </div>
                </div>
              `
    ).join("")}
        </div>
      </div>

      ${businessSummary ? `<div class="business-profile-summary">${escapeHtml(truncateText(businessSummary, 210))}</div>` : ""}
    </section>
  `;
  }
  function getBusinessAreasForRender(fundamentals, sectorLabel) {
    if (Array.isArray(fundamentals?.businessAreas) && fundamentals.businessAreas.length) {
      return fundamentals.businessAreas.filter((item) => item && typeof item.label === "string" && Number.isFinite(item.weight)).slice(0, 5);
    }
    if (!sectorLabel) {
      return [];
    }
    return [
      {
        label: sectorLabel,
        weight: 100,
        source: "sector_fallback"
      }
    ];
  }
  function getBusinessAreaColor(index) {
    return businessAreaPalette[index % businessAreaPalette.length];
  }
  function buildBusinessAreaGradient(areas) {
    if (!areas.length) {
      return "conic-gradient(#d8cdbd 0 100%)";
    }
    let cursor = 0;
    const stops = areas.map((area, index) => {
      const start = cursor;
      const end = Math.min(100, cursor + area.weight);
      cursor = end;
      return `${getBusinessAreaColor(index)} ${start}% ${end}%`;
    });
    if (cursor < 100) {
      stops.push(`rgba(121, 103, 82, 0.12) ${cursor}% 100%`);
    }
    return `conic-gradient(${stops.join(", ")})`;
  }
  function buildFundamentalsTablePeriods(history, fallback, limit = 8) {
    const items = Array.isArray(history) ? history.filter(Boolean) : [];
    const deduped = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of items) {
      const key = item?.label;
      if (!key || seen.has(key)) {
        continue;
      }
      deduped.push(item);
      seen.add(key);
    }
    if ((!deduped.length || fallback?.label && !seen.has(fallback.label)) && fallback?.label) {
      deduped.push(fallback);
    }
    return deduped.slice(-limit);
  }
  function renderQuarterlyHistoryTable(fundamentals) {
    const annualPeriods = buildFundamentalsTablePeriods(fundamentals?.annualHistory, fundamentals?.annual, 2);
    const actualQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyHistory, fundamentals?.quarterly, 8);
    const estimatedQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyEstimateHistory, void 0, 8);
    if (!annualPeriods.length && !actualQuarterlyPeriods.length && !estimatedQuarterlyPeriods.length) {
      return "";
    }
    const tableId = "fundamentalsQuarterlyHistory";
    const annualHeader = annualPeriods.length ? `<th colspan="${annualPeriods.length}" class="fundamentals-group annual">\uC5F0\uAC04</th>` : "";
    const actualQuarterlyHeader = actualQuarterlyPeriods.length ? `<th colspan="${actualQuarterlyPeriods.length}" class="fundamentals-group quarterly">\uC2E4\uC81C \uBD84\uAE30</th>` : "";
    const estimatedQuarterlyHeader = estimatedQuarterlyPeriods.length ? `<th colspan="${estimatedQuarterlyPeriods.length}" class="fundamentals-group estimated">\uCD94\uC815 \uBD84\uAE30 (E)</th>` : "";
    const annualCells = annualPeriods.map(
      (period, index) => {
        const needsSectionEnd = index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
        return `<th class="fundamentals-period-head annual ${needsSectionEnd ? "section-end" : ""}">${escapeHtml(period.label)}</th>`;
      }
    ).join("");
    const actualQuarterlyCells = actualQuarterlyPeriods.map(
      (period, index) => `<th class="fundamentals-period-head quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${escapeHtml(period.label)}</th>`
    ).join("");
    const estimatedQuarterlyCells = estimatedQuarterlyPeriods.map(
      (period, index) => `<th class="fundamentals-period-head estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${escapeHtml(period.label)}</th>`
    ).join("");
    return `
    <section class="fundamentals-history-section">
      <div class="fundamentals-history-head">
        <div>
          <h5>\uC7AC\uBB34 \uD750\uB984 \uD45C</h5>
          <p>\uCD5C\uADFC 2\uAC1C \uC5F0\uAC04, \uC2E4\uC81C \uBD84\uAE30 \uCD5C\uB300 8\uAC1C\uB97C \uC6B0\uC120 \uBCF4\uC5EC\uC8FC\uACE0 \uCD94\uC815 \uBD84\uAE30(E)\uB294 \uBCC4\uB3C4 \uAD6C\uAC04\uC73C\uB85C \uBD84\uB9AC\uD569\uB2C8\uB2E4.</p>
        </div>
        <div class="fundamentals-scroll-controls">
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="prev" data-fundamentals-target="${tableId}" aria-label="\uC774\uC804 \uC7AC\uBB34 \uAD6C\uAC04 \uBCF4\uAE30">\u2039</button>
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="next" data-fundamentals-target="${tableId}" aria-label="\uB2E4\uC74C \uC7AC\uBB34 \uAD6C\uAC04 \uBCF4\uAE30">\u203A</button>
        </div>
      </div>
      <div id="${tableId}" class="fundamentals-table-scroll">
        <table class="fundamentals-table">
          <thead>
            <tr>
              <th rowspan="2" class="fundamentals-sticky-col">\uC9C0\uD45C</th>
              ${annualHeader}
              ${actualQuarterlyHeader}
              ${estimatedQuarterlyHeader}
            </tr>
            <tr>
              ${annualCells}
              ${actualQuarterlyCells}
              ${estimatedQuarterlyCells}
            </tr>
          </thead>
          <tbody>
            ${fundamentalMetricDefinitions.map(
      (metric) => `
                  <tr>
                    <th class="fundamentals-sticky-col">${metric.label}${renderInfoIcon(fundamentalMetricGuides[metric.label], `${metric.label} \uC124\uBA85`)}</th>
                    ${annualPeriods.map(
        (period, index) => {
          const needsSectionEnd = index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
          return `<td class="annual ${needsSectionEnd ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`;
        }
      ).join("")}
                    ${actualQuarterlyPeriods.map(
        (period, index) => `<td class="quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
      ).join("")}
                    ${estimatedQuarterlyPeriods.map(
        (period, index) => `<td class="estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
      ).join("")}
                  </tr>
                `
    ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
  }
  function formatFundamentalMetricValue(metric, value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    if ((metric?.digits ?? 0) > 0) {
      return `${new Intl.NumberFormat("ko-KR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: metric.digits
      }).format(value)}${metric.suffix ?? ""}`;
    }
    return `${formatNumber(value)}${metric?.suffix ?? ""}`;
  }
  function formatNumber(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
  }
  function truncateText(value, maxLength = 210) {
    if (!value || value.length <= maxLength) {
      return value || "";
    }
    return `${value.slice(0, maxLength - 1)}\u2026`;
  }
  function formatDecimal(value, digits = 2) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return new Intl.NumberFormat("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }
  function formatPercent(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }
  function formatSignedDecimal(value, digits = 2) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatDecimal(value, digits)}`;
  }
  function formatSignedPointDelta(value, digits = 2) {
    if (value == null || Number.isNaN(value)) {
      return "(0.00)";
    }
    const sign = value > 0 ? "+" : "";
    return `(${sign}${formatDecimal(value, digits)})`;
  }
  function formatMultiplier(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${value.toFixed(2)}x`;
  }
  function formatKoreanEok(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value / 1e8)}\uC5B5`;
  }
  function formatKoreanChartDate(value) {
    if (!value) {
      return "-";
    }
    const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC"
    }).format(date);
  }
  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
})();
