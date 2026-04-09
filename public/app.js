import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart
} from "/vendor/lightweight-charts/lightweight-charts.standalone.production.mjs";

const STORAGE_KEY = "stock-project-recommendations-v2";
const LEGACY_STORAGE_KEY = "band-stock-recommendations-v2";
const UI_STATE_STORAGE_KEY = "stock-project-ui-state-v1";
const PAGE_SIZE_ALL = 999;
const DEFAULT_CATEGORY = "longTerm";
const DEFAULT_LONG_TERM_BUCKET = "buy";
const DEFAULT_SWING_BUCKET = "execution";
const SWING_LOOKBACK_DAYS = 15;
const DEFAULT_VISIBLE_TRADING_SESSIONS = 45;
const DEFAULT_VISIBLE_MARKET_WATCH_SESSIONS = {
  daily: 45,
  weekly: 52,
  yearly: 8
};
const SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 10 * 1000;
const LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 30 * 1000;
const ACTIVE_ANALYSIS_REFRESH_INTERVAL_MS = 5 * 1000;
const APP_VIEWS = ["news", "index", "analysis", "movers"];
const PAGE_SIZE_OPTIONS = new Set([5, 10, PAGE_SIZE_ALL]);
const HANGUL_BASE = 44032;
const HANGUL_END = 55203;
const CHOSUNG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ"
];

const defaultRecommendationCatalog = [
  { key: "엔씨소프트", name: "엔씨소프트", symbol: "036570", anchorDate: "2026-03-22", note: "215000원 이하 1차매수" },
  { key: "TIGER 미국30년국채커버드콜액티브(H)", name: "TIGER 미국30년국채커버드콜액티브(H)", symbol: "476550", anchorDate: "2026-03-12", note: "7445원 1차매수" },
  { key: "포스코DX", name: "포스코DX", symbol: "022100", anchorDate: "2026-03-12", latestMentionDate: "2026-03-12", note: "31550원 이하 1차매수" },
  { key: "CJ대한통운", name: "CJ대한통운", symbol: "000120", anchorDate: "2026-03-05", note: "112800원 이하 1차매수" },
  { key: "제우스", name: "제우스", symbol: "079370", anchorDate: "2026-03-02", latestMentionDate: "2026-03-05", note: "17600원 아래 분할매수" },
  { key: "나무가", name: "나무가", symbol: "190510", anchorDate: "2026-02-27", latestMentionDate: "2026-03-05", note: "22500원 이하 1차매수" },
  { key: "OCI", name: "OCI", symbol: "456040", anchorDate: "2025-07-28", note: "AS 글에서 삭제 전 목록" },
  { key: "아모레퍼시픽", name: "아모레퍼시픽", symbol: "090430", anchorDate: "2025-07-28", note: "AS 글에서 삭제 전 목록" },
  { key: "KODEX 2차전지산업레버리지", name: "KODEX 2차전지산업레버리지", symbol: "462330", anchorDate: "2025-07-28", note: "AS 글에서 삭제 전 목록" },
  { key: "셀트리온제약", name: "셀트리온제약", symbol: "068760", anchorDate: "2025-07-25", note: "53700원 이하 또는 다음날 시가 이하" },
  { key: "엘앤에프", name: "엘앤에프", symbol: "066970", anchorDate: "2025-07-25", note: "64500원 이하 1차매수" },
  { key: "에코프로비엠", name: "에코프로비엠", symbol: "247540", anchorDate: "2025-07-24", note: "112000원 이하 1차매수" },
  { key: "네오위즈", name: "네오위즈", symbol: "095660", anchorDate: "2025-07-14", note: "최근추천 이후 AS 글 언급" },
  { key: "BGF리테일", name: "BGF리테일", symbol: "282330", anchorDate: "2025-07-28", note: "112500원 이하 1차매수" },
  { key: "LG생활건강", name: "LG생활건강", symbol: "051900", anchorDate: "2025-07-15", note: "330000원 이하부터 손절가 구간까지" },
  { key: "삼성전자", name: "삼성전자", symbol: "005930", anchorDate: "2024-11-01", note: "59000원 이하 중기 1차매수" },
  { key: "오리온홀딩스", name: "오리온홀딩스", symbol: "001800", anchorDate: "2025-05-29", note: "박스권 저항대 돌파 여부 관찰" },
  { key: "컴투스", name: "컴투스", symbol: "078340", anchorDate: "2024-08-29", note: "40050원 이하부터 손절가 구간 분할매수" }
];

const stockMasterSeed = [
  { code: "005930", name: "삼성전자", market: "KOSPI", aliases: ["삼전"] },
  { code: "000660", name: "SK하이닉스", market: "KOSPI", aliases: ["하이닉스", "skh"] },
  { code: "035420", name: "NAVER", market: "KOSPI", aliases: ["네이버"] },
  { code: "005380", name: "현대차", market: "KOSPI", aliases: ["현차"] },
  { code: "012330", name: "현대모비스", market: "KOSPI", aliases: ["모비스"] },
  { code: "068270", name: "셀트리온", market: "KOSPI", aliases: [] },
  { code: "207940", name: "삼성바이오로직스", market: "KOSPI", aliases: ["삼바"] },
  { code: "373220", name: "LG에너지솔루션", market: "KOSPI", aliases: ["엘지엔솔", "lg엔솔"] },
  { code: "051910", name: "LG화학", market: "KOSPI", aliases: [] },
  { code: "006400", name: "삼성SDI", market: "KOSPI", aliases: [] },
  { code: "035720", name: "카카오", market: "KOSPI", aliases: [] },
  { code: "105560", name: "KB금융", market: "KOSPI", aliases: [] },
  { code: "055550", name: "신한지주", market: "KOSPI", aliases: [] },
  { code: "034020", name: "두산에너빌리티", market: "KOSPI", aliases: ["두빌"] },
  { code: "017670", name: "SK텔레콤", market: "KOSPI", aliases: ["에스케이텔레콤"] },
  { code: "032830", name: "삼성생명", market: "KOSPI", aliases: [] },
  { code: "086790", name: "하나금융지주", market: "KOSPI", aliases: ["하나금융"] },
  { code: "003550", name: "LG", market: "KOSPI", aliases: [] },
  { code: "028260", name: "삼성물산", market: "KOSPI", aliases: [] },
  { code: "066570", name: "LG전자", market: "KOSPI", aliases: [] },
  { code: "096770", name: "SK이노베이션", market: "KOSPI", aliases: ["sk이노"] },
  { code: "259960", name: "크래프톤", market: "KOSPI", aliases: [] },
  { code: "011200", name: "HMM", market: "KOSPI", aliases: ["에이치엠엠"] },
  { code: "090430", name: "아모레퍼시픽", market: "KOSPI", aliases: [] },
  { code: "051900", name: "LG생활건강", market: "KOSPI", aliases: [] },
  { code: "000270", name: "기아", market: "KOSPI", aliases: [] },
  { code: "003670", name: "포스코퓨처엠", market: "KOSPI", aliases: ["포퓨"] },
  { code: "036570", name: "엔씨소프트", market: "KOSPI", aliases: ["엔씨"] },
  { code: "000120", name: "CJ대한통운", market: "KOSPI", aliases: [] },
  { code: "456040", name: "OCI", market: "KOSPI", aliases: [] },
  { code: "001800", name: "오리온홀딩스", market: "KOSPI", aliases: [] },
  { code: "282330", name: "BGF리테일", market: "KOSPI", aliases: [] },
  { code: "035900", name: "JYP Ent.", market: "KOSDAQ", aliases: ["jyp"] },
  { code: "041510", name: "에스엠", market: "KOSDAQ", aliases: ["sm"] },
  { code: "263750", name: "펄어비스", market: "KOSDAQ", aliases: [] },
  { code: "247540", name: "에코프로비엠", market: "KOSDAQ", aliases: ["에코비엠"] },
  { code: "086520", name: "에코프로", market: "KOSDAQ", aliases: [] },
  { code: "091990", name: "셀트리온헬스케어", market: "KOSDAQ", aliases: [] },
  { code: "196170", name: "알테오젠", market: "KOSDAQ", aliases: [] },
  { code: "028300", name: "HLB", market: "KOSDAQ", aliases: ["에이치엘비"] },
  { code: "095660", name: "네오위즈", market: "KOSDAQ", aliases: [] },
  { code: "078340", name: "컴투스", market: "KOSDAQ", aliases: [] },
  { code: "068760", name: "셀트리온제약", market: "KOSDAQ", aliases: [] },
  { code: "066970", name: "엘앤에프", market: "KOSDAQ", aliases: [] },
  { code: "022100", name: "포스코DX", market: "KOSDAQ", aliases: ["포디엑스"] },
  { code: "079370", name: "제우스", market: "KOSDAQ", aliases: [] },
  { code: "190510", name: "나무가", market: "KOSDAQ", aliases: [] },
  { code: "476550", name: "TIGER 미국30년국채커버드콜액티브(H)", market: "ETF", aliases: ["tiger 미국30년"] },
  { code: "462330", name: "KODEX 2차전지산업레버리지", market: "ETF", aliases: ["kodex 2차전지"] }
];

const indexWatchSeed = [
  {
    key: "KOSPI",
    name: "KOSPI",
    symbol: "KRX:KOSPI",
    category: "지수",
    status: "ready",
    note: "국내 대표 지수 흐름을 차트와 함께 확인하는 기본 보드입니다."
  },
  {
    key: "KOSDAQ",
    name: "KOSDAQ",
    symbol: "KRX:KOSDAQ",
    category: "지수",
    status: "ready",
    note: "성장주와 중소형주 흐름을 함께 보는 보조 지수입니다."
  },
  {
    key: "USDKRW",
    name: "달러 / 원",
    symbol: "KRW=X",
    category: "환율",
    status: "ready",
    note: "네이버 대신 별도 환율 시세 소스로 동일 차트 형식에 맞춰 표시합니다."
  },
  {
    key: "GOLD",
    name: "국제 금",
    symbol: "GC=F",
    category: "원자재",
    status: "ready",
    note: "국제 금 선물 기준으로 같은 카드/팝업 차트 형식에 맞춰 확장했습니다."
  }
];

const fundamentalsGuideText = [
  "재무지표는 네이버 금융 기준 최근 2개 연간과 최대 8개 분기 흐름을 보여줍니다.",
  "분기 데이터는 최대 8개까지 보여주며, 실제 확정 분기와 추정 분기(E)를 표에서 분리해서 표시합니다.",
  "ETF나 지수형 상품은 기업 재무제표가 없어 표시되지 않을 수 있습니다."
].join("\n");
const businessAreaGuideText = [
  "사업 포트폴리오 맵은 현재 기업개요 문장을 바탕으로 자동 추정한 원형 그래프입니다.",
  "정확한 매출 비중 공시가 아니라, 어떤 사업 축으로 회사를 이해하면 좋은지 빠르게 보여주는 참고용 맵입니다.",
  "추후 사업부문 매출 비중 데이터가 연결되면 같은 UI에 실제 비중으로 교체할 수 있습니다."
].join("\n");
const businessAreaPalette = ["#c45a2d", "#177245", "#2563eb", "#d97706", "#7c3aed", "#0f766e"];

const fundamentalMetricGuides = {
  "매출액": "회사가 일정 기간 동안 올린 전체 매출입니다. 외형 성장 속도를 볼 때 먼저 확인합니다.",
  "영업이익": "본업으로 벌어들인 이익입니다. 일회성보다 사업 체력 판단에 더 유용합니다.",
  "순이익": "영업외손익과 세금까지 반영한 최종 이익입니다. 주주에게 귀속되는 결과에 가깝습니다.",
  "ROE": "자기자본 대비 얼마나 이익을 냈는지 보여주는 수익성 지표입니다. 높을수록 자본 효율이 좋습니다.",
  "부채비율": "자기자본 대비 부채 규모입니다. 일반적으로 너무 높으면 재무 부담이 큰 편입니다.",
  "EPS": "주당순이익입니다. 순이익을 발행주식 수로 나눈 값으로, 주당 이익 수준을 보여줍니다.",
  "BPS": "주당순자산입니다. 회사의 순자산을 주식 수로 나눈 값으로, 자산가치 참고용입니다.",
  "PER": "주가를 주당순이익으로 나눈 값입니다. 이익 대비 현재 주가가 얼마나 비싼지 볼 때 씁니다.",
  "PBR": "주가를 주당순자산으로 나눈 값입니다. 자산가치 대비 현재 주가 수준을 볼 때 씁니다."
};
const fundamentalMetricDefinitions = [
  { key: "revenue", label: "매출액", digits: 0 },
  { key: "operatingIncome", label: "영업이익", digits: 0 },
  { key: "netIncome", label: "순이익", digits: 0 },
  { key: "roe", label: "ROE", digits: 2, suffix: "%" },
  { key: "debtRatio", label: "부채비율", digits: 2, suffix: "%" },
  { key: "eps", label: "EPS", digits: 0 },
  { key: "bps", label: "BPS", digits: 0 },
  { key: "per", label: "PER", digits: 2 },
  { key: "pbr", label: "PBR", digits: 2 }
];

const timeframes = ["daily", "weekly", "monthly"];
const timeframeLabels = {
  daily: "일봉",
  weekly: "주봉",
  monthly: "월봉"
};
const marketWatchTimeframes = ["daily", "weekly", "yearly"];
const marketWatchTimeframeLabels = {
  daily: "일봉",
  weekly: "주봉",
  yearly: "연봉"
};
const moversScoreGuideText = [
  "점수는 0~100점으로 계산됩니다.",
  "등락률: 7% / 12% / 20% 구간에서 가점",
  "거래량: 20일 평균 대비 2배 이상일 때 가점, 3배·6배 구간에서 추가 가점",
  "기술 신호: 20일·60일 고점 돌파 또는 저점 이탈 시 가점",
  "종가 위치: 급등주는 고가 부근, 급락주는 저가 부근 유지 시 가점",
  "거래대금: 300억 / 1000억 이상일 때 가점",
  "해석: 80점 이상 폭발, 60점 이상 강함, 그 미만 관찰"
].join("\n");
const swingScoreGuideText = [
  `스윙 엔진은 최근 ${SWING_LOOKBACK_DAYS}거래일을 기준으로 봅니다.`,
  "첫 단계는 기준봉입니다. 가격과 거래량이 함께 붙으면서 시세의 축이 세워져야 합니다.",
  "그 다음은 눌림입니다. 거래량이 줄고, 기준봉 저점이나 핵심 가격대를 크게 훼손하지 않는 조정이 나와야 합니다.",
  "눌림이 충분히 진행되면 분할매수 구간을 따로 잡습니다. 보통 돌파선 근처에서 버티는지와 이탈선이 명확한지가 핵심입니다.",
  "재돌파가 나와도 너무 멀리 달아나면 추격보다 확인 구간으로 둡니다.",
  "이탈은 기준봉 저점이나 눌림 저점을 훼손해 구조가 무너진 경우입니다.",
  "화면에는 점수 대신 현재 상태와 진입 구간, 이탈 기준을 중심으로 표시합니다."
].join("\n");
const defaultRecommendationBySymbol = new Map(defaultRecommendationCatalog.map((item) => [item.symbol, item]));
const persistedUiState = loadUiState();

let recommendationCatalog = loadCatalog();
let currentCategory = isValidCategory(persistedUiState?.currentCategory) ? persistedUiState.currentCategory : DEFAULT_CATEGORY;
let currentLongTermBucket = isValidLongTermBucket(persistedUiState?.currentLongTermBucket)
  ? persistedUiState.currentLongTermBucket
  : DEFAULT_LONG_TERM_BUCKET;
let currentSwingBucket = isValidSwingBucket(persistedUiState?.currentSwingBucket)
  ? persistedUiState.currentSwingBucket
  : DEFAULT_SWING_BUCKET;
let currentAnalysis = null;
let selectedKey = typeof persistedUiState?.selectedKey === "string" ? persistedUiState.selectedKey : getFilteredInitialKey();
let activeChart = null;
let resizeObserver = null;
let itemsPerPage = PAGE_SIZE_OPTIONS.has(Number(persistedUiState?.itemsPerPage)) ? Number(persistedUiState.itemsPerPage) : 5;
let currentPage = Number.isInteger(persistedUiState?.currentPage) && persistedUiState.currentPage > 0 ? persistedUiState.currentPage : 1;
let activeView = resolveInitialAppView(persistedUiState?.activeView);
let hasLoadedMovers = false;
let stockSearchQuery = "";
let selectedStockOption = null;
let stockSearchUniverse = [];
let stockUniverseLoaded = false;
let stockUniverseLoading = false;
let marketWatchItems = new Map();
let marketWatchLoaded = false;
let marketWatchLoading = false;
let marketWatchCharts = [];
let marketWatchTimeframeByKey = new Map(indexWatchSeed.map((item) => [item.key, "daily"]));
let activeMarketWatchKey = null;
let marketWatchRefreshTimer = null;
let previousMarketWatchPrices = new Map();
let stockModalPointerDownOnBackdrop = false;
let serverSwingPicksLoaded = false;
let swingPatternByKey = new Map();
let realtimeStockSnapshots = new Map();
let stockSnapshotRefreshTimer = null;
let stockSnapshotLoading = false;
let lastVisibleStockSnapshotSignature = "";
let activeAnalysisRefreshTimer = null;
let activeAnalysisRealtimeLoading = false;
let latestRiseMovers = [];
let latestFallMovers = [];

const appTabs = document.querySelector("#appTabs");
const newsView = document.querySelector("#newsView");
const indexView = document.querySelector("#indexView");
const analysisView = document.querySelector("#analysisView");
const moversView = document.querySelector("#moversView");
const stockSelector = document.querySelector("#stockSelector");
const results = document.querySelector("#results");
const summaryBar = document.querySelector("#summaryBar");
const errorBox = document.querySelector("#errorBox");
const statusBadge = document.querySelector("#statusBadge");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const pageStatus = document.querySelector("#pageStatus");
const prevPageBtn = document.querySelector("#prevPageBtn");
const nextPageBtn = document.querySelector("#nextPageBtn");
const openAddStockBtn = document.querySelector("#openAddStockBtn");
const stockModal = document.querySelector("#stockModal");
const closeStockModalBtn = document.querySelector("#closeStockModalBtn");
const cancelStockModalBtn = document.querySelector("#cancelStockModalBtn");
const indexChartModal = document.querySelector("#indexChartModal");
const closeIndexChartModalBtn = document.querySelector("#closeIndexChartModalBtn");
const indexChartModalTitle = document.querySelector("#indexChartModalTitle");
const indexChartModalMeta = document.querySelector("#indexChartModalMeta");
const indexChartModalPrice = document.querySelector("#indexChartModalPrice");
const indexChartModalChange = document.querySelector("#indexChartModalChange");
const indexChartModalToolbar = document.querySelector("#indexChartModalToolbar");
const indexChartModalLegend = document.querySelector("#indexChartModalLegend");
const indexChartModalContainer = document.querySelector("#indexChartModalContainer");
const indexChartModalTooltip = document.querySelector("#indexChartModalTooltip");
const indexChartModalStartDate = document.querySelector("#indexChartModalStartDate");
const indexChartModalEndDate = document.querySelector("#indexChartModalEndDate");
const swingScoreModal = document.querySelector("#swingScoreModal");
const closeSwingScoreModalBtn = document.querySelector("#closeSwingScoreModalBtn");
const swingScoreModalMeta = document.querySelector("#swingScoreModalMeta");
const swingScoreModalBody = document.querySelector("#swingScoreModalBody");
const stockForm = document.querySelector("#stockForm");
const stockSearchInput = document.querySelector("#stockSearchInput");
const stockSearchResults = document.querySelector("#stockSearchResults");
const selectedStockCard = document.querySelector("#selectedStockCard");
const indexWatchList = document.querySelector("#indexWatchList");
const moversRiseThemesList = document.querySelector("#moversRiseThemesList");
const moversFallThemesList = document.querySelector("#moversFallThemesList");
const stockNameInput = document.querySelector("#stockNameInput");
const stockSymbolInput = document.querySelector("#stockSymbolInput");
const stockPriceInput = document.querySelector("#stockPriceInput");
const stockDateInput = document.querySelector("#stockDateInput");
const stockCategoryTabs = document.querySelector("#stockCategoryTabs");
const longTermBucketTabs = document.querySelector("#longTermBucketTabs");
const swingBucketTabs = document.querySelector("#swingBucketTabs");
const stockCategorySelect = document.querySelector("#stockCategorySelect");
const longTermBucketField = document.querySelector("#longTermBucketField");
const longTermBucketSelect = document.querySelector("#longTermBucketSelect");
const stockNoteInput = document.querySelector("#stockNoteInput");
const moversStatusBadge = document.querySelector("#moversStatusBadge");
const moversSummaryBar = document.querySelector("#moversSummaryBar");
const moversErrorBox = document.querySelector("#moversErrorBox");
const moversMarketSelect = document.querySelector("#moversMarketSelect");
const moversLimitSelect = document.querySelector("#moversLimitSelect");
const moversMinChangeInput = document.querySelector("#moversMinChangeInput");
const moversMinVolumeInput = document.querySelector("#moversMinVolumeInput");
const moversMinScoreInput = document.querySelector("#moversMinScoreInput");
const refreshMoversBtn = document.querySelector("#refreshMoversBtn");
const riseMoversList = document.querySelector("#riseMoversList");
const fallMoversList = document.querySelector("#fallMoversList");
const riseCountLabel = document.querySelector("#riseCountLabel");
const fallCountLabel = document.querySelector("#fallCountLabel");
const scoreGuideIcons = document.querySelectorAll("[data-score-guide]");

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
    const key = deleteButton.dataset.deleteKey;
    if (key) {
      removeStock(key);
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

openAddStockBtn.addEventListener("click", () => {
  openStockModal();
});

closeStockModalBtn.addEventListener("click", closeStockModal);
cancelStockModalBtn.addEventListener("click", closeStockModal);
closeIndexChartModalBtn?.addEventListener("click", closeIndexChartModal);
closeSwingScoreModalBtn?.addEventListener("click", closeSwingScoreModal);

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
  if (
    selectedStockOption &&
    stockSearchInput.value.trim() !== `${selectedStockOption.name} (${selectedStockOption.code})`
  ) {
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
  await loadServerSwingPicks();
  await refreshSwingPatternSnapshots();
  restoreUiState();
  applyScoreGuideTooltips();
  renderAppTabs();
  renderCategoryTabs();
  renderLongTermBucketTabs();
  renderSwingBucketTabs();
  syncLongTermBucketField();
  renderIndexWatchList();
  renderMoversThemeLists();
  renderSelector();
  renderStockSearchResults();

  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
  }

  void loadStockUniverse();
  void loadMarketWatch();
  void loadMovers({ background: true, preserveMoversUi: true });
  void loadRealtimeStockSnapshots({ background: true });
  startMarketWatchAutoRefresh();
  startStockSnapshotAutoRefresh();
  startActiveAnalysisAutoRefresh();
}

function mergeRecommendations(baseItems, incomingItems) {
  const merged = new Map();

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

function syncServerSwingRecommendations(baseItems, incomingItems) {
  const preserved = baseItems.filter((item) => (item.category ?? DEFAULT_CATEGORY) !== "swing");
  const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
  return mergeRecommendations(preserved, normalizedIncoming);
}

async function loadServerSwingPicks() {
  if (serverSwingPicksLoaded) {
    return;
  }

  try {
    const response = await fetch("/analysis/server-swing-picks");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "서버 스윙 종목을 불러오지 못했습니다.");
    }

    const executionItems = Array.isArray(payload.executionItems) ? payload.executionItems : [];
    const watchItems = Array.isArray(payload.watchItems) ? payload.watchItems : [];
    const items =
      executionItems.length || watchItems.length
        ? [
            ...executionItems.map((item) => ({ ...item, bucket: "execution" })),
            ...watchItems.map((item) => ({ ...item, bucket: "watch" }))
          ]
        : Array.isArray(payload.items)
          ? payload.items
          : [];
    recommendationCatalog = syncServerSwingRecommendations(recommendationCatalog, items);
    saveCatalog();

    const visibleKeys = new Set(recommendationCatalog.map((item) => item.key));
    for (const key of [...swingPatternByKey.keys()]) {
      if (!visibleKeys.has(key)) {
        swingPatternByKey.delete(key);
      }
    }

    const filteredKeys = new Set(getFilteredCatalog().map((item) => item.key));
    if (!selectedKey || !visibleKeys.has(selectedKey) || (currentCategory === "swing" && !filteredKeys.has(selectedKey))) {
      selectedKey = getFilteredInitialKey();
    }
  } catch (error) {
    console.error(error);
  } finally {
    serverSwingPicksLoaded = true;
  }
}

async function refreshSwingPatternSnapshots() {
  const swingItems = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing");
  if (!swingItems.length) {
    swingPatternByKey = new Map();
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
      throw new Error(payload.error ?? "스윙 패턴 상태를 불러오지 못했습니다.");
    }

    const bySymbol = new Map(swingItems.map((item) => [item.symbol, item.key]));
    const next = new Map();
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
      { key: "fast", label: "5주선", period: 5, className: "fast-line", color: "#177245" },
      { key: "short", label: "20주선", period: 20, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "60주선", period: 60, className: "long-line", color: "#2563eb" }
    ];
  }

  if (timeframe === "yearly") {
    return [
      { key: "short", label: "3년선", period: 3, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "5년선", period: 5, className: "long-line", color: "#2563eb" }
    ];
  }

  return [
    { key: "fast", label: "5일선", period: 5, className: "fast-line", color: "#177245" },
    { key: "short", label: "20일선", period: 20, className: "short-line", color: "#d84c3f" },
    { key: "long", label: "60일선", period: 60, className: "long-line", color: "#2563eb" }
  ];
}

function renderIndexWatchList() {
  if (!indexWatchList) {
    return;
  }

  indexWatchList.innerHTML = indexWatchSeed
    .map((item) => {
      const snapshot = marketWatchItems.get(item.key);
      const previousPrice = previousMarketWatchPrices.get(item.key);
      const trendClass =
        snapshot?.changePercent > 0 ? "positive" : snapshot?.changePercent < 0 ? "negative" : "neutral";
      const priceDirectionClass =
        snapshot?.price != null && previousPrice != null
          ? snapshot.price > previousPrice
            ? "positive"
            : snapshot.price < previousPrice
              ? "negative"
          : "neutral"
          : "neutral";
      const priceDirectionValue =
        snapshot?.price != null && previousPrice != null
          ? snapshot.price - previousPrice
          : undefined;
      const categoryLabel = item.category;
      const pillLabel =
        item.status === "planned"
          ? "추가 예정"
          : marketWatchLoading && !snapshot
            ? "불러오는 중"
            : snapshot?.error
              ? "연동 실패"
              : snapshot?.changePercent != null
                ? "차트 보기"
                : "연동 준비";

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
            ${
              snapshot?.changePercent != null && snapshot?.price != null
                ? `
                  <div class="index-watch-card-body">
                    <div class="index-watch-card-price ${priceDirectionClass}">
                      <span class="index-watch-card-price-value">${formatDecimal(snapshot.price)}</span>
                      <span class="index-watch-card-price-state">${formatSignedPointDelta(priceDirectionValue)}</span>
                    </div>
                    <div class="index-watch-card-change ${trendClass}">${formatPercent(snapshot.changePercent)}</div>
                    <div class="index-watch-card-hint">카드를 누르면 차트가 열립니다.</div>
                  </div>
                `
                : `
                  <div class="index-watch-placeholder">
                    ${
                      snapshot?.error
                        ? escapeHtml(snapshot.error)
                        : marketWatchLoading
                          ? "지수 데이터를 불러오는 중입니다."
                          : "지수 데이터를 준비 중입니다."
                    }
                  </div>
                `
            }
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
    })
    .join("");
}

const macroThemeRules = [
  { label: "반도체/전자", keywords: ["반도체", "전자부품", "전자집적", "디스플레이", "광학", "센서"] },
  { label: "소프트웨어/플랫폼", keywords: ["소프트웨어", "정보서비스", "포털", "데이터베이스", "컴퓨터 프로그래밍"] },
  { label: "통신/네트워크장비", keywords: ["통신", "방송 장비", "네트워크", "무선", "유선"] },
  { label: "바이오/헬스케어", keywords: ["의약품", "의료", "제약", "바이오", "건강", "진단", "치과"] },
  { label: "2차전지/소재", keywords: ["전지", "배터리", "양극재", "음극재", "리튬", "소재"] },
  { label: "전력/인프라", keywords: ["전동기", "발전기", "전력", "케이블", "전기장비", "배전", "변압기"] },
  { label: "기계/로봇/자동화", keywords: ["특수목적용 기계", "일반목적용 기계", "기계장비", "로봇", "자동화", "금형"] },
  { label: "자동차/부품", keywords: ["자동차", "트레일러", "차체", "차량", "내장재"] },
  { label: "화학/소재", keywords: ["화학", "플라스틱", "고무", "합성수지", "도료", "비금속광물"] },
  { label: "철강/금속", keywords: ["1차 금속", "철강", "주조", "비철", "금속", "알루미늄"] },
  { label: "건설/부동산", keywords: ["건설", "토목", "부동산", "엔지니어링"] },
  { label: "유통/소비재", keywords: ["도매", "소매", "유통", "백화점", "생활용품"] },
  { label: "음식료/농식품", keywords: ["식료품", "음료", "농업", "수산", "사료", "축산"] },
  { label: "엔터/콘텐츠", keywords: ["영화", "비디오", "방송", "음악", "오락", "광고", "출판", "게임"] },
  { label: "물류/운송", keywords: ["운수", "창고", "육상", "항공", "해상", "물류"] },
  { label: "금융", keywords: ["은행", "보험", "금융", "증권", "여신"] },
  { label: "에너지/원자재", keywords: ["석유", "가스", "광업", "에너지", "석탄"] }
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
  const grouped = new Map();

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
      sectors: new Set()
    };
    existing.items.push(item);
    existing.sectors.add(sector);
    grouped.set(macroTheme, existing);
  }

  return [...grouped.values()]
    .map((group) => {
      const avgScore =
        group.items.reduce((sum, item) => sum + (item.alertScore ?? 0), 0) / Math.max(group.items.length, 1);
      const avgChangePercent =
        group.items.reduce((sum, item) => sum + Math.abs(item.changePercent ?? 0), 0) / Math.max(group.items.length, 1);
      const topItems = [...group.items]
        .sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0))
        .slice(0, 3)
        .map((item) => ({
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
    })
    .sort((left, right) => {
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
    })
    .slice(0, 5);
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
        <p>${direction === "rise" ? "급등" : "급락"} 테마를 계산하는 중입니다.</p>
      </div>
    `;
    return;
  }

  if (!themes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "강하게 묶이는 급등 업종이 아직 없습니다." : "강하게 묶이는 급락 업종이 아직 없습니다."}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = themes
    .map((theme, index) => {
      const trendClass = direction === "rise" ? "positive" : "negative";
      const countLabel = theme.sectorCount > 1 ? `업종 ${theme.sectorCount} · 종목 ${theme.count}` : `종목 ${theme.count}`;
      const representatives = theme.topItems
        .map(
          (item) =>
            `<span class="movers-theme-chip">${escapeHtml(item.name)} <strong class="${trendClass}">${formatPercent(
              item.changePercent
            )}</strong></span>`
        )
        .join("");
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
            <span class="movers-theme-label">평균 점수</span>
            <span class="movers-theme-value">${escapeHtml(String(Math.round(theme.avgScore)))}</span>
          </div>
          <div class="movers-theme-stat">
            <span class="movers-theme-label">평균 등락률</span>
            <span class="movers-theme-value ${trendClass}">${direction === "rise" ? "+" : "-"}${escapeHtml(
              theme.avgChangePercent.toFixed(2)
            )}%</span>
          </div>
          <div class="movers-theme-tail">
            <span class="movers-theme-count">${escapeHtml(countLabel)}</span>
          </div>
          <div class="movers-theme-representatives">${representatives}</div>
        </article>
      `;
    })
    .join("");
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
      throw new Error(payload.error ?? "지수 데이터를 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    previousMarketWatchPrices = new Map(
      [...marketWatchItems.entries()]
        .filter(([, item]) => typeof item?.price === "number")
        .map(([key, item]) => [key, item.price])
    );
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
  }, 5000);
}

function cleanupMarketWatchCharts() {
  for (const entry of marketWatchCharts) {
    entry.resizeObserver?.disconnect();
    entry.chart?.remove();
  }
  marketWatchCharts = [];
}

function buildIndexMovingAverage(points, period) {
  const result = [];

  for (let index = 0; index < points.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const window = points.slice(index - period + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.close, 0) / period;
    result.push({
      time: points[index].date,
      value: average
    });
  }

  return result;
}

function mountMarketWatchChart({ container, tooltip, snapshot, timeframe }) {
  if (!container) {
    return;
  }

  cleanupMarketWatchCharts();

  const chartWindow = snapshot?.chartSets?.[timeframe] ?? snapshot?.chartSets?.daily;
  const points = chartWindow?.points;
  if (!points?.length) {
    return;
  }

  const movingAverageConfig = getMarketWatchMovingAverageConfig(timeframe);

  const chart = createChart(container, {
    width: container.clientWidth || 640,
    height: 420,
    layout: {
      background: { type: ColorType.Solid, color: "#fffaf1" },
      textColor: "#695d4e",
      fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
    },
    grid: {
      vertLines: { color: "rgba(31,26,20,0.04)" },
      horzLines: { color: "rgba(31,26,20,0.06)" }
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(159,62,25,0.24)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: false
      },
      horzLine: {
        color: "rgba(159,62,25,0.2)",
        width: 1,
        style: LineStyle.Dashed
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

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#d84c3f",
    downColor: "#2f6ee5",
    borderUpColor: "#d84c3f",
    borderDownColor: "#2f6ee5",
    wickUpColor: "#d84c3f",
    wickDownColor: "#2f6ee5",
    priceLineVisible: false
  });

  const volumeSeries = chart.addSeries(HistogramSeries, {
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

  const movingAverageSeries = movingAverageConfig.map((line) =>
    chart.addSeries(LineSeries, {
      color: line.color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false
    })
  );

  candleSeries.setData(
    points.map((point) => ({
      time: point.date,
      open: point.open ?? point.close,
      high: point.high ?? point.close,
      low: point.low ?? point.close,
      close: point.close
    }))
  );
  volumeSeries.setData(
    points.map((point) => ({
      time: point.date,
      value: point.volume ?? 0,
      color:
        (point.close ?? 0) >= (point.open ?? point.close ?? 0) ? "rgba(216,76,63,0.34)" : "rgba(47,110,229,0.3)"
    }))
  );
  for (const [index, series] of movingAverageSeries.entries()) {
    series.setData(buildIndexMovingAverage(points, movingAverageConfig[index].period));
  }

  chart.subscribeCrosshairMove((param) => {
    if (!tooltip || !param.point || !param.time || !param.seriesData.size) {
      tooltip?.classList.add("hidden");
      return;
    }

    const candleData = param.seriesData.get(candleSeries);
    if (!candleData || !("open" in candleData)) {
      tooltip.classList.add("hidden");
      return;
    }

    const point = points.find((candidate) => candidate.date === String(param.time));
    if (!point) {
      tooltip.classList.add("hidden");
      return;
    }

    const left = Math.min(param.point.x + 16, container.clientWidth - 190);
    const top = Math.max(param.point.y - 16, 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove("hidden");
    tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
      <div>시가 ${formatDecimal(candleData.open)}</div>
      <div>고가 ${formatDecimal(candleData.high)}</div>
      <div>저가 ${formatDecimal(candleData.low)}</div>
      <div>종가 ${formatDecimal(candleData.close)}</div>
      <div>거래량 ${formatNumber(point.volume)}</div>
    `;
  });

  setDefaultMarketWatchVisibleRange(chart, points, timeframe);

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    chart.applyOptions({ width: entry.contentRect.width });
  });
  resizeObserver.observe(container);

  marketWatchCharts.push({ chart, resizeObserver });
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

  const label = button.dataset.scoreLabel ?? "상태";
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
    ${action ? `<div class="swing-pattern-copy"><strong>전략:</strong> ${escapeHtml(action)}</div>` : ""}
    ${
      entry || invalidation
        ? `
          <div class="swing-reason-list">
            ${entry ? `<span class="swing-reason-chip">진입 구간 ${escapeHtml(entry)}</span>` : ""}
            ${invalidation ? `<span class="swing-reason-chip">이탈 기준 ${escapeHtml(invalidation)}</span>` : ""}
          </div>
        `
        : ""
    }
    <div class="swing-pattern-copy">${escapeHtml(guide).replaceAll("\n", "<br>")}</div>
    <div class="swing-reason-list">
      ${(Array.isArray(reasons) ? reasons : [])
        .map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`)
        .join("")}
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
  const trendClass =
    snapshot.changePercent > 0 ? "positive" : snapshot.changePercent < 0 ? "negative" : "neutral";

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
    indexChartModalToolbar.innerHTML = marketWatchTimeframes
      .map(
        (option) => `
          <button
            class="timeframe-tab ${option === timeframe ? "active" : ""}"
            type="button"
            data-index-timeframe="${option}"
          >
            ${marketWatchTimeframeLabels[option]}
          </button>
        `
      )
      .join("");
  }
  if (indexChartModalLegend) {
    indexChartModalLegend.innerHTML = movingAverageConfig
      .map(
        (line) => `
          <span class="legend-item"><span class="legend-line ${line.className}"></span>${line.label}</span>
        `
      )
      .join("");
  }
  if (indexChartModalStartDate) {
    indexChartModalStartDate.textContent = chartWindow?.startDate ?? "-";
  }
  if (indexChartModalEndDate) {
    indexChartModalEndDate.textContent = chartWindow?.endDate ?? "-";
  }

  indexChartModalTooltip.classList.add("hidden");
  mountMarketWatchChart({
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
  return [...String(value)]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= HANGUL_BASE && code <= HANGUL_END) {
        return CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)] ?? char;
      }
      return char;
    })
    .join("");
}

function buildStockSearchUniverse() {
  const unique = new Map();

  for (const item of defaultRecommendationCatalog) {
    if (!unique.has(item.symbol)) {
      unique.set(item.symbol, {
        code: item.symbol,
        name: item.name,
        market: "WATCHLIST",
        sector: undefined,
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
  const merged = new Map();

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
      throw new Error(payload.error ?? "전체 종목 목록을 불러오지 못했습니다.");
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
    items
      .filter((item) => typeof item?.code === "string" && typeof item?.name === "string")
      .map((item) => [item.code, item.name])
  );
  const selectedSymbol = recommendationCatalog.find((item) => item.key === selectedKey)?.symbol ?? null;

  let changed = false;
  recommendationCatalog = recommendationCatalog.map((item) => {
    const repaired = repairRecommendationText(item, universeNameByCode.get(item.symbol));
    if (
      repaired.name !== item.name ||
      repaired.key !== item.key ||
      repaired.note !== item.note
    ) {
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

  const ranked = stockSearchUniverse
    .map((item) => {
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
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
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
    stockSearchResults.innerHTML = `<div class="stock-search-empty">전체 종목 목록을 불러오는 중입니다...</div>`;
    return;
  }

  const results = getStockSearchResults(stockSearchQuery);
  if (!results.length) {
    stockSearchResults.innerHTML = `<div class="stock-search-empty">검색 결과가 없습니다. 종목명, 종목코드, 초성으로 다시 찾아보세요.</div>`;
    return;
  }

  stockSearchResults.innerHTML = results
    .map((item) => {
      const selected = selectedStockOption?.code === item.code;
      return `
        <button class="stock-search-item ${selected ? "selected" : ""}" type="button" data-stock-code="${escapeHtml(item.code)}">
          <span class="stock-search-item-head">
            <span class="stock-search-name">${escapeHtml(item.name)}</span>
            <span class="stock-search-code">${escapeHtml(item.code)}</span>
          </span>
          <span class="stock-search-meta">${escapeHtml(item.market)} / 초성 ${escapeHtml(item.chosung)}</span>
        </button>
      `;
    })
    .join("");
}

function selectStockOption(item) {
  selectedStockOption = item;
  stockNameInput.value = item.name;
  stockSymbolInput.value = item.code;

  if (selectedStockCard) {
    selectedStockCard.classList.remove("hidden");
    selectedStockCard.innerHTML = `
      <span class="selected-stock-label">선택된 종목</span>
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
      riseCountLabel.textContent = `${risePayload.analyses.length}개`;
    }
    if (fallCountLabel) {
      fallCountLabel.textContent = `${fallPayload.analyses.length}개`;
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
      riseCountLabel.textContent = "0개";
    }
    if (fallCountLabel) {
      fallCountLabel.textContent = "0개";
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
    throw new Error(payload.error ?? "급등/급락 순위를 불러오지 못했습니다.");
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

  container.innerHTML = items
    .map((item, index) => {
      const changeClass = (item.changePercent ?? 0) >= 0 ? "positive" : "negative";
      const sector = getSectorLabel(item.symbol);
      const signalLabel =
        item.signal === "explosive" ? "\uD3ED\uBC1C" : item.signal === "strong" ? "\uAC15\uD568" : "\uAD00\uCC30";
      const edgeMetricLabel = direction === "rise" ? "\uACE0\uC810 \uB3CC\uD30C" : "\uC800\uC810 \uC774\uD0C8";
      const edgeMetricValue =
        direction === "rise"
          ? item.breakout60d
            ? "60\uC77C"
            : item.breakout20d
              ? "20\uC77C"
              : "-"
          : item.breakdown60d
            ? "60\uC77C"
            : item.breakdown20d
              ? "20\uC77C"
              : "-";

      return `
        <article class="mover-card ${direction}">
          <div class="mover-row">
            <div class="mover-title">
              <span class="mover-rank">${index + 1}</span>
              <div class="mover-copy">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="mover-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.market)}${sector ? ` / ${escapeHtml(sector)}` : ""} / \uC810\uC218 ${escapeHtml(String(item.alertScore))} ${renderInfoIcon(moversScoreGuideText, "점수 기준 안내")}</div>
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
              <span class="mover-metric-chip">${direction === "rise" ? "\uACE0\uAC00\uBD80\uADFC" : "\uC800\uAC00\uBD80\uADFC"} ${direction === "rise" ? (item.closedNearHigh ? "\uC720\uC9C0" : "-") : item.closedNearLow ? "\uC720\uC9C0" : "-"}</span>
            </div>
            <span class="signal-pill ${escapeHtml(item.signal)}">${signalLabel}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyScoreGuideTooltips() {
  for (const icon of scoreGuideIcons) {
    icon.setAttribute("data-tooltip", moversScoreGuideText);
  }
}

function renderInfoIcon(text, label = "안내") {
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

  stockSelector.innerHTML = pagedItems
    .map((item) => {
      const selected = item.key === selectedKey;
      const swingPattern = item.category === "swing" ? swingPatternByKey.get(item.key)?.pattern : null;
      const swingAssessment = item.category === "swing" ? getSwingAssessment(swingPattern) : null;
      const swingTradePlan = item.category === "swing" ? getSwingCardTradePlan(item.note, swingPattern) : null;
      const titleText = item.category === "swing" ? `${item.name} (${item.symbol})` : item.name;
      const metaText = item.category === "swing" ? "" : `${item.symbol} / ${item.anchorDate}`;
      const longTermBucketLabel = item.category === "swing" ? "" : getLongTermBucketLabel(item.longTermBucket);
      const swingBucketLabel = item.category === "swing" ? getSwingBucketLabel(item.swingBucket) : "";
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
              ${
                item.category === "swing" && swingTradePlan
                  ? `
                    <span class="stock-card-trade-grid">
                      <span class="stock-card-trade-item">
                        <span class="stock-card-trade-label">매수가</span>
                        <span class="stock-card-trade-value stock-card-trade-value-group">
                          ${
                            swingTradePlan.buyLevels.length
                              ? `
                                <span class="stock-card-trade-badges">
                                  ${swingTradePlan.buyLevels
                                    .map(
                                      (level) => `<span class="stock-card-trade-badge">${escapeHtml(level)}</span>`
                                    )
                                    .join("")}
                                </span>
                              `
                              : `<span class="stock-card-trade-summary">${escapeHtml(swingTradePlan.buySummary)}</span>`
                          }
                        </span>
                      </span>
                      <span class="stock-card-trade-item">
                        <span class="stock-card-trade-label">손절가</span>
                        <span class="stock-card-trade-value">${escapeHtml(swingTradePlan.stop)}</span>
                      </span>
                    </span>
                  `
                  : swingAssessment
                    ? `
                      <span class="stock-card-badges">
                        <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">상태: ${escapeHtml(swingAssessment.label)}</span>
                        <span class="stock-pattern-score">최근 ${SWING_LOOKBACK_DAYS}거래일 기준 / ${escapeHtml(swingAssessment.action)}</span>
                      </span>
                    `
                    : ""
              }
              ${item.category === "swing" ? "" : `<span class="stock-card-note">${escapeHtml(item.note ?? "")}</span>`}
            </button>
            <button class="stock-card-delete" type="button" data-delete-key="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.name)} 삭제">×</button>
          </span>
        </article>
      `;
    })
    .join("");

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
  return getPagedItems()
    .map((item) => getRealtimeSnapshotKey(item))
    .filter(Boolean)
    .join("|");
}

function getStockSnapshotRefreshInterval() {
  return currentCategory === "swing"
    ? SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS
    : LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS;
}

function renderStockRealtimeLine(item) {
  const snapshot = realtimeStockSnapshots.get(getRealtimeSnapshotKey(item));
  if (snapshot?.error) {
    return `<span class="stock-card-live-row muted">${escapeHtml(snapshot.error)}</span>`;
  }

  if (typeof snapshot?.latestClose !== "number") {
    return `<span class="stock-card-live-row muted">실시간 시세 대기</span>`;
  }

  const trendClass =
    snapshot.changePercent > 0 ? "positive" : snapshot.changePercent < 0 ? "negative" : "neutral";
  const changeText =
    snapshot.changePercent == null
      ? "-"
      : `${formatPercent(snapshot.changePercent)} / ${formatSignedDecimal(snapshot.changeAmount ?? 0)}`;
  const latestDateText = snapshot.latestDate ? `${escapeHtml(snapshot.latestDate)} 기준` : "실시간";

  return `
    <span class="stock-card-live-row ${trendClass}">
      <span class="stock-card-live-price">${formatNumber(snapshot.latestClose)}원</span>
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
    realtimeStockSnapshots = new Map();
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
      throw new Error(payload.error ?? "실시간 시세를 불러오지 못했습니다.");
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
      showError(error instanceof Error ? error.message : "실시간 시세를 불러오지 못했습니다.");
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
}

function renderLongTermBucketTabs() {
  if (!longTermBucketTabs) {
    return;
  }

  const isVisible = currentCategory === DEFAULT_CATEGORY;
  longTermBucketTabs.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    return;
  }

  const counts = getLongTermBucketCounts();
  for (const tab of longTermBucketTabs.querySelectorAll("[data-long-term-bucket]")) {
    const bucket = tab.dataset.longTermBucket;
    if (!isValidLongTermBucket(bucket)) {
      continue;
    }

    tab.classList.toggle("active", bucket === currentLongTermBucket);
    tab.textContent = `${getLongTermBucketLabel(bucket)} ${counts[bucket]}개`;
  }
}

function renderSwingBucketTabs() {
  if (!swingBucketTabs) {
    return;
  }

  const isVisible = currentCategory === "swing";
  swingBucketTabs.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    return;
  }

  const counts = getSwingBucketCounts();
  for (const tab of swingBucketTabs.querySelectorAll("[data-swing-bucket]")) {
    const bucket = tab.dataset.swingBucket;
    if (!isValidSwingBucket(bucket)) {
      continue;
    }

    tab.classList.toggle("active", bucket === currentSwingBucket);
    tab.textContent = `${getSwingBucketLabel(bucket)} ${counts[bucket]}개`;
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
    item &&
      typeof item.key === "string" &&
      typeof item.name === "string" &&
      typeof item.symbol === "string" &&
      typeof item.anchorDate === "string"
  );
}

function normalizeRecommendation(item) {
  const category = item?.category === "swing" ? "swing" : DEFAULT_CATEGORY;
  return {
    ...item,
    category,
    longTermBucket: category === "swing" ? undefined : resolveLongTermBucket(item),
    swingBucket: category === "swing" ? resolveSwingBucket(item) : undefined
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

  const watchKeywords = ["관찰", "돌파 여부", "삭제 전 목록", "as 글", "언급"];
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
  return bucket === "watch" ? "관심후보" : "실행후보";
}

function getLongTermBucketLabel(bucket) {
  return bucket === "watch" ? "관찰군" : "매수후보군";
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
  const repairedName =
    looksCorruptedText(next.name)
      ? source?.name ?? fallbackName ?? next.name
      : next.name;

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
    setStatus("idle", "대기 중");
    showSummary("");
    showError("");
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>등록된 종목이 없습니다. 종목을 추가해주세요.</p></div>`;
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
  const longTermBucket = category === "swing" ? undefined : isValidLongTermBucket(longTermBucketSelect?.value) ? longTermBucketSelect.value : DEFAULT_LONG_TERM_BUCKET;
  const swingBucket = category === "swing" ? currentSwingBucket : undefined;
  const recommendedPrice = Number(stockPriceInput.value);
  const extraNote = stockNoteInput.value.trim();

  if (!selectedStockOption || !name || !symbol || !anchorDate || !Number.isFinite(recommendedPrice) || recommendedPrice <= 0) {
    showError("먼저 검색 결과에서 종목을 선택하고 추천가와 기준일을 입력해주세요.");
    return null;
  }

  const key = createRecommendationKey(name, symbol);
  if (recommendationCatalog.some((item) => item.key === key || item.symbol === symbol)) {
    showError("이미 등록된 종목명 또는 종목코드입니다.");
    return null;
  }

  return {
    key,
    name,
    symbol,
    category,
    longTermBucket,
    swingBucket,
    anchorDate,
    note: [formatNumber(recommendedPrice) + "원 기준", extraNote].filter(Boolean).join(" / ")
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
  return recommendationCatalog
    .filter((item) => (item.category ?? DEFAULT_CATEGORY) === DEFAULT_CATEGORY)
    .reduce(
      (counts, item) => {
        const bucket = item.longTermBucket === "watch" ? "watch" : "buy";
        counts[bucket] += 1;
        return counts;
      },
      { buy: 0, watch: 0 }
    );
}

function getSwingBucketCounts() {
  return recommendationCatalog
    .filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing")
    .reduce(
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
    return currentSwingBucket === "watch"
      ? "관심후보 탭에는 아직 종목이 없습니다. 엔진 스캔 결과가 들어오면 여기에 표시됩니다."
      : "실행후보 탭에는 아직 종목이 없습니다. 엔진 스캔 결과가 들어오면 여기에 표시됩니다.";
  }

  return `${getLongTermBucketLabel(currentLongTermBucket)}에는 아직 등록된 종목이 없습니다. 종목 추가로 시작해보세요.`;
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

  setStatus("loading", "분석 중");
  showSummary("");
  showError("");
  results.classList.remove("empty");
  results.innerHTML = `<div class="empty-state"><p>${escapeHtml(item.name)}  데이터를 불러오는 중입니다...</p></div>`;

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
      throw new Error(payload.error ?? "분석 요청에 실패했습니다.");
    }

    const analysis = payload.analyses?.[0];
    if (!analysis) {
      throw new Error("분석 결과가 없습니다.");
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
          throw new Error(swingPayload.error ?? "스윙 패턴 결과를 불러오지 못했습니다.");
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
    results.classList.remove("empty");
    results.innerHTML = renderCard(currentAnalysis);
    mountInteractiveChart(
      currentAnalysis.chartSets[currentAnalysis.activeTimeframe],
      currentAnalysis.tradingAnchorDate,
      currentAnalysis.swingTradeOverlay
    );
    void refreshCurrentAnalysisRealtime({ background: true });
    setStatus("done", "완료");
    if (item.category === "swing" && currentAnalysis.swingAssessment) {
      showSummary(
        `${item.name} 분석이 완료되었습니다. 최근 ${SWING_LOOKBACK_DAYS}거래일 기준 ${currentAnalysis.swingAssessment.label} 상태입니다.`
      );
    } else if (item.category !== "swing" && currentAnalysis.longTermReview) {
      const assessment = getLongTermReviewAssessment(currentAnalysis.longTermReview);
      const passText = currentAnalysis.longTermReview.enginePass ? "엔진 통과" : "엔진 관찰/제외";
      showSummary(`${item.name} 분석이 완료되었습니다. 중장기 엔진 기준 ${assessment.groupLabel} / ${passText} 상태입니다.`);
    } else {
      showSummary(`${item.name} 분석이 완료되었습니다. 확대/축소, 드래그 이동, 툴팁을 지원합니다.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    setStatus("error", "오류");
    showError(message);
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>오류를 해결한 뒤 다시 선택해주세요.</p></div>`;
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
    return undefined;
  }

  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

function ratioNumber(value, base) {
  if (typeof value !== "number" || !Number.isFinite(value) || typeof base !== "number" || !Number.isFinite(base) || base === 0) {
    return undefined;
  }

  return value / base;
}

function formatRealtimeSyncLabel(value) {
  if (!value) {
    return "실시간 시세 동기화 대기";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "실시간 시세 갱신 완료";
  }

  return `실시간 갱신 ${date.toLocaleTimeString("ko-KR", {
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
  const highestPoint = referencePoints.reduce((best, point) => (point.close > best.close ? point : best), referencePoints[0]);
  const lowestPoint = referencePoints.reduce((best, point) => (point.close < best.close ? point : best), referencePoints[0]);
  const avgVolume20Latest = averageDefinedNumbers(dailyPoints.slice(-20).map((point) => point.volume));

  return {
    ...analysis,
    resolvedSymbol: detail.resolvedSymbol ?? analysis.resolvedSymbol,
    latestClose,
    latestDate: detail.latestDate ?? latestPoint.date,
    latestVolume: latestPoint.volume,
    latestVolumeVs20d: ratioNumber(latestPoint.volume, avgVolume20Latest),
    returnSinceAnchor: analysis.anchorClose ? ((latestClose - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.returnSinceAnchor,
    maxGainPercent: analysis.anchorClose ? ((highestPoint.close - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.maxGainPercent,
    maxDrawdownPercent: analysis.anchorClose ? ((lowestPoint.close - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.maxDrawdownPercent,
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
  const returnClass =
    analysis.returnSinceAnchor > 0 ? "positive" : analysis.returnSinceAnchor < 0 ? "negative" : "neutral";
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
    fundamentalsPriceReference.textContent = `가격 기준: ${formatNumber(analysis.latestClose)}원 (${analysis.latestDate} 종가)`;
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
      throw new Error(payload.error ?? "실시간 차트를 불러오지 못했습니다.");
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
      showError(error instanceof Error ? error.message : "실시간 차트를 불러오지 못했습니다.");
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
  const buckets = new Map();
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
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isNonTradingPoint(point) {
  return (
    (point.open ?? 0) === 0 &&
    (point.high ?? 0) === 0 &&
    (point.low ?? 0) === 0 &&
    (point.volume ?? 0) === 0
  );
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
  const day = new Date(`${dateText}T00:00:00Z`).getUTCDay();
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
  return group === "buy candidate" ? "매수 가능 후보군" : "관찰 후보군";
}

function formatLongTermLabel(label) {
  switch (label) {
    case "leader correction watch":
      return "대표주 조정 관찰";
    case "deep value review":
      return "깊은 조정 재검토";
    case "base-forming candidate":
      return "베이스 형성 후보";
    case "needs more stabilization":
      return "안정화 더 필요";
    default:
      return label ?? "-";
  }
}

function formatLongTermFundamentalTrend(trend) {
  switch (trend) {
    case "improving":
      return "개선";
    case "weakening":
      return "약화";
    case "cyclical_downturn":
      return "순환 둔화";
    default:
      return "-";
  }
}

function getLongTermReviewAssessment(review) {
  const candidate = review?.candidate;
  if (!candidate) {
    return {
      className: "broken",
      groupLabel: "관찰 제외",
      statusLabel: "엔진 대상 아님",
      action: "중장기 대표주 엔진 대상에서 제외",
      summary: review?.filterReasons?.[0] ?? "평가 가능한 중장기 엔진 결과가 없습니다."
    };
  }

  if (review.enginePass && candidate.candidateGroup === "buy candidate") {
    return {
      className: "ready",
      groupLabel: "매수 가능 후보군",
      statusLabel: formatLongTermLabel(candidate.label),
      action: "분할매수 검토 가능",
      summary: candidate.reasonSummary
    };
  }

  return {
    className: candidate.label === "deep value review" ? "caution" : "watch",
    groupLabel: formatLongTermGroupLabel(candidate.candidateGroup),
    statusLabel: formatLongTermLabel(candidate.label),
    action: review.enginePass ? "관찰 유지" : "엔진 조건 미충족",
    summary: candidate.reasonSummary
  };
}

function renderLongTermReviewPanel(review) {
  if (!review) {
    return "";
  }

  const assessment = getLongTermReviewAssessment(review);
  const candidate = review.candidate;
  const filterReasonChips = Array.isArray(review.filterReasons)
    ? review.filterReasons.map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`).join("")
    : "";
  const sourceLabel = review.seedSource === "curated" ? "엔진 시드" : "수동 추가 평가";

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>중장기 엔진 진단</h4>
          <div class="swing-pattern-copy">${escapeHtml(assessment.summary)}</div>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(assessment.className)}">${escapeHtml(assessment.groupLabel)}</span>
      </div>
      <div class="swing-pattern-copy">${escapeHtml(assessment.statusLabel)} / ${escapeHtml(assessment.action)} / ${escapeHtml(sourceLabel)}</div>
      ${
        candidate
          ? `
            <div class="metric-grid swing-metric-grid">
              <div class="metric">
                <span class="metric-label">후보군</span>
                <span class="metric-value">${escapeHtml(formatLongTermGroupLabel(candidate.candidateGroup))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">구조 라벨</span>
                <span class="metric-value">${escapeHtml(formatLongTermLabel(candidate.label))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">총점</span>
                <span class="metric-value">${candidate.scores.totalScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">고점 대비</span>
                <span class="metric-value">${formatPercent(candidate.drawdownPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA120 기울기</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma120Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA240 기울기</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma240Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">최근 저점 경과</span>
                <span class="metric-value">${formatNumber(candidate.baseStructure.daysSinceLastLowBreak)}일</span>
              </div>
              <div class="metric">
                <span class="metric-label">저점 대비 거리</span>
                <span class="metric-value">${formatPercent(candidate.baseStructure.distanceFromLowPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">대표성 점수</span>
                <span class="metric-value">${candidate.scores.leaderScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">조정 점수</span>
                <span class="metric-value">${candidate.scores.correctionScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">추세 점수</span>
                <span class="metric-value">${candidate.scores.trendScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">안정화 점수</span>
                <span class="metric-value">${candidate.scores.stabilizationScore}점</span>
                </div>
                <div class="metric">
                  <span class="metric-label">재무 점수</span>
                  <span class="metric-value">${candidate.scores?.financialScore ?? "-"}${candidate.scores?.financialScore != null ? "점" : ""}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">매출 추세</span>
                  <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.revenueTrend ?? candidate.fundamentals?.revenueTrend))}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">영업이익 추세</span>
                  <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.operatingProfitTrend ?? candidate.fundamentals?.operatingProfitTrend))}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">ROE / 부채비율</span>
                  <span class="metric-value">${(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe) != null ? `${formatSignedDecimal(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe)}%` : "-"} / ${(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio) != null ? `${formatDecimal(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio)}%` : "-"}</span>
                </div>
              </div>
            `
            : ""
        }
      ${
        filterReasonChips
          ? `
            <div class="swing-reason-list">
              ${filterReasonChips}
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderCard(item) {
  const returnClass =
    item.returnSinceAnchor > 0 ? "positive" : item.returnSinceAnchor < 0 ? "negative" : "neutral";
  const longTermAssessment =
    item.category !== "swing" && item.longTermReview ? getLongTermReviewAssessment(item.longTermReview) : null;

  return `
    <article class="result-card">
      <div class="card-head">
        <div class="title-wrap">
          <h3>${escapeHtml(item.name || item.shortName || item.symbol)}</h3>
          <div class="meta-line">
            ${escapeHtml(item.symbol)} / 기준일 ${escapeHtml(item.anchorDate)} / 실제 거래일 ${escapeHtml(item.tradingAnchorDate)}
          </div>
          <div class="meta-line" data-live-sync-line>실시간 시세 동기화 대기</div>
          ${
            item.swingAssessment
              ? `<div class="meta-line">스윙 판정 ${escapeHtml(item.swingAssessment.label)} / ${escapeHtml(item.swingAssessment.action)}</div>`
              : ""
          }
          ${
            item.category === "swing"
              ? `<div class="meta-line">스윙 버킷 ${escapeHtml(getSwingBucketLabel(item.swingBucket ?? DEFAULT_SWING_BUCKET))}</div>`
              : ""
          }
          ${
            longTermAssessment
              ? `<div class="meta-line">중장기 엔진 ${escapeHtml(longTermAssessment.groupLabel)} / ${escapeHtml(longTermAssessment.statusLabel)}</div>`
              : ""
          }
          ${item.note ? `<div class="meta-line">${escapeHtml(item.note)}</div>` : ""}
        </div>
        <div class="return-pill ${returnClass}" data-live-return-pill>
          ${formatPercent(item.returnSinceAnchor)}
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">기준일 종가</span>
          <span class="metric-value">${formatNumber(item.anchorClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">현재 종가</span>
          <span class="metric-value" data-live-current-price>${formatNumber(item.latestClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 상승</span>
          <span class="metric-value" data-live-max-gain>${formatPercent(item.maxGainPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 하락</span>
          <span class="metric-value" data-live-max-drawdown>${formatPercent(item.maxDrawdownPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최고 종가</span>
          <span class="metric-value" data-live-highest-close>${formatNumber(item.highestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최저 종가</span>
          <span class="metric-value" data-live-lowest-close>${formatNumber(item.lowestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">기준일 거래량 배수</span>
          <span class="metric-value">${formatMultiplier(item.anchorVolumeVs20dBefore)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최근 거래량 배수</span>
          <span class="metric-value" data-live-latest-volume-ratio>${formatMultiplier(item.latestVolumeVs20d)}</span>
        </div>
      </div>

      <div class="chart-wrap">
        <div class="chart-toolbar">
          ${timeframes
            .map(
              (timeframe) => `
                <button class="timeframe-tab ${timeframe === item.activeTimeframe ? "active" : ""}" type="button" data-timeframe="${timeframe}">
                  ${timeframeLabels[timeframe]}
                </button>
              `
            )
            .join("")}
        </div>
        <div class="chart-box interactive-chart-box">
          <div class="chart-hint">마우스 휠로 확대/축소, 드래그로 이동, 십자선 툴팁을 지원합니다.</div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-line ma5"></span>5일선</span>
            <span class="legend-item"><span class="legend-line ma20"></span>20일선</span>
            <span class="legend-item"><span class="legend-line ma60"></span>60일선</span>
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
  if (
    pattern.stage === "breakout" &&
    pattern.matched &&
    typeof pattern.referenceCloseVsBreakoutLevelPercent === "number" &&
    pattern.referenceCloseVsBreakoutLevelPercent > 8
  ) {
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
      label: "관찰 전",
      className: "watch",
      rank: 0,
      description: "기준봉과 눌림 구조가 아직 분할매수 관점에서 충분히 잡히지 않았습니다.",
      action: "구조 확인이 먼저"
    },
    pivot_formed: {
      label: "기준봉 형성",
      className: "watch",
      rank: 2,
      description: "거래량과 가격이 붙는 기준봉은 보였지만, 아직 눌림이 충분히 진행되지는 않았습니다.",
      action: "눌림 확인 대기"
    },
    pullback_early: {
      label: "눌림 초기",
      className: "watch",
      rank: 3,
      description: "기준봉 이후 조정이 시작됐지만, 시간이나 가격 소화가 아직 더 필요합니다.",
      action: "성급한 진입 금지"
    },
    pullback_ready: {
      label: "눌림 완성",
      className: "setup",
      rank: 4,
      description: "거래량이 식으면서 눌림 구조가 어느 정도 정리됐고, 이제 기준 가격대를 다시 확인할 수 있는 구간입니다.",
      action: "분할매수 준비"
    },
    buy_ready: {
      label: "1차 매수 가능",
      className: "setup",
      rank: 6,
      description: "눌림이 충분히 진행됐고 현재 가격이 분할매수 구간 근처에서 버티는 상태입니다.",
      action: "1차 분할매수 가능"
    },
    breakout_extended: {
      label: "추격 금지",
      className: "caution",
      rank: 2,
      description: "돌파 구조 자체는 살아 있지만 가격이 너무 멀리 달아나 신규 진입은 불리한 상태입니다.",
      action: "눌림 재형성 대기"
    },
    breakout_ready: {
      label: "재돌파 대기",
      className: "ready",
      rank: 5,
      description: "구조는 살아 있지만 바로 추격하기보다 돌파선 안착이나 재확인을 기다리는 편이 좋습니다.",
      action: "재돌파 확인 대기"
    },
    breakout_confirmed: {
      label: "재돌파 확인",
      className: "complete",
      rank: 7,
      description: "눌림 뒤 재돌파가 확인된 상태입니다. 추격보다 보유·눌림 재확인을 함께 봐야 합니다.",
      action: "추격보다 재확인"
    },
    broken: {
      label: "이탈",
      className: "broken",
      rank: 1,
      description: "기준봉 저점이나 눌림 저점이 훼손돼 구조가 무너진 상태입니다.",
      action: "관찰 종료"
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
    return "재돌파 확인 단계";
  }
  if (pattern.setupType === "time_correction") {
    return "시간 조정형";
  }
  if (pattern.setupType === "volatile_power_digestion") {
    return "변동성 소화형";
  }
  if (pattern.stage === "setup") {
    return "가격 눌림형";
  }
  return "구조 관찰";
}

function formatSwingPriceBand(low, high) {
  if (typeof low !== "number" && typeof high !== "number") {
    return "-";
  }
  if (typeof low === "number" && typeof high === "number") {
    return `${formatNumber(low)}원 ~ ${formatNumber(high)}원`;
  }
  const single = typeof high === "number" ? high : low;
  return single == null ? "-" : `${formatNumber(single)}원`;
}

function parseSwingPlanSegment(note, label) {
  if (typeof note !== "string" || !note.trim()) {
    return null;
  }

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = note.match(new RegExp(`${escapedLabel}\\s*([^|]+)`));
  return match?.[1]?.trim() ?? null;
}

function parsePriceNumbers(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const matches = [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)];
  return matches
    .filter((match) => isLikelyPriceMatch(text, match[0], match.index ?? 0))
    .map((match) => Number.parseFloat(match[0].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function isLikelyPriceMatch(text, rawValue, index) {
  const normalized = String(rawValue ?? "").replaceAll(",", "");
  if (!normalized) {
    return false;
  }

  const nextText = text.slice(index + String(rawValue).length, index + String(rawValue).length + 2);
  if (nextText.startsWith("원")) {
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
    const regex = new RegExp(escapedLabel, "g");
    for (const match of note.matchAll(regex)) {
      const labelIndex = match.index ?? 0;
      const labelEnd = labelIndex + label.length;
      const nearby = [];

      if (searchBefore) {
        const beforeMatches = numberMatches
          .filter((entry) => entry.end <= labelIndex && labelIndex - entry.end <= maxGapBefore)
          .sort((left, right) => right.end - left.end);
        nearby.push(...beforeMatches);
      }

      if (searchAfter) {
        const afterMatches = numberMatches
          .filter((entry) => entry.index >= labelEnd && entry.index - labelEnd <= maxGapAfter)
          .sort((left, right) => left.index - right.index);
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
  const buySegment =
    parseSwingPlanSegment(note, "매수가") ??
    parseSwingPlanSegment(note, "매수");
  const stopSegment =
    parseSwingPlanSegment(note, "손절가") ??
    parseSwingPlanSegment(note, "손절");
  const buyPricesFromSegment = parsePriceNumbers(buySegment);
  const stopPricesFromSegment = parsePriceNumbers(stopSegment);
  const buyPricesFromNearby =
    buyPricesFromSegment.length
      ? []
      : findPricesNearLabels(note, ["매수가", "매수"], {
          searchBefore: true,
          searchAfter: true,
          maxGapBefore: 12,
          maxGapAfter: 18,
          collectAll: true
        });
  const stopPricesFromNearby =
    stopPricesFromSegment.length
      ? []
      : findPricesNearLabels(note, ["손절가", "손절"], {
          searchBefore: true,
          searchAfter: true,
          maxGapBefore: 4,
          maxGapAfter: 12,
          collectAll: false
        });

  return {
    buyPrices: [...new Set([...buyPricesFromSegment, ...buyPricesFromNearby])],
    stopPrice: [...stopPricesFromSegment, ...stopPricesFromNearby][0]
  };
}

function sanitizeSwingTradeLevels(buyPrices, stopPrice) {
  const normalizedStopPrice =
    Number.isFinite(stopPrice) && stopPrice > 0
      ? Math.round(stopPrice * 100) / 100
      : undefined;
  const normalizedBuyPrices = [...new Set(
    (Array.isArray(buyPrices) ? buyPrices : [])
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value * 100) / 100)
  )]
    .filter((value) => normalizedStopPrice == null || value > normalizedStopPrice)
    .sort((left, right) => right - left);

  return {
    buyPrices: normalizedBuyPrices,
    stopPrice: normalizedStopPrice
  };
}

function getSwingTradeOverlay(note, pattern) {
  const notePlan = parseSwingPlanNumbersFromNote(note);
  const patternBuyPrices =
    pattern?.buyPlan
      ? [pattern.buyPlan.firstBuyPrice, pattern.buyPlan.secondBuyPrice, pattern.buyPlan.thirdBuyPrice]
      : pattern && (typeof pattern.entryZoneLow === "number" || typeof pattern.entryZoneHigh === "number")
        ? [pattern.entryZoneHigh, pattern.entryZoneLow]
        : [];
  const buyPrices = notePlan.buyPrices.length ? notePlan.buyPrices : patternBuyPrices;
  const stopPriceRaw = notePlan.stopPrice;
  const stopPriceFromNote =
    Number.isFinite(stopPriceRaw) && stopPriceRaw > 0
      ? Math.round(stopPriceRaw * 100) / 100
      : undefined;
  const stopPriceFromPattern =
    pattern && typeof pattern.buyPlan?.stopLossPrice === "number" && pattern.buyPlan.stopLossPrice > 0
      ? Math.round(pattern.buyPlan.stopLossPrice * 100) / 100
      : pattern && typeof pattern.invalidationPrice === "number" && pattern.invalidationPrice > 0
        ? Math.round(pattern.invalidationPrice * 100) / 100
        : undefined;
  const sanitized = sanitizeSwingTradeLevels(buyPrices, stopPriceFromNote ?? stopPriceFromPattern);

  return {
    buyPrices: sanitized.buyPrices,
    stopPrice: sanitized.stopPrice
  };
}

function getSwingCardTradePlan(note, pattern) {
  const overlay = getSwingTradeOverlay(note, pattern);
  const buyPlan = pattern?.buyPlan;
  const buyLevelsFromOverlay = overlay.buyPrices.map((price, index) => `${index + 1}차 ${formatNumber(price)}원`);
  const buyLevelsFromPlan = buyPlan
    ? [buyPlan.firstBuyPrice, buyPlan.secondBuyPrice, buyPlan.thirdBuyPrice]
      .filter((price) => Number.isFinite(price) && price > 0)
      .map((price, index) => `${index + 1}차 ${formatNumber(price)}원`)
    : [];
  const buyFromNote = parseSwingPlanSegment(note, "매수가") ?? parseSwingPlanSegment(note, "매수");
  const buyLevelsFromNote =
    !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && buyFromNote
      ? splitSwingTradeSegments(buyFromNote).map((segment, index) => formatSwingBuyLevel(segment, index))
      : [];
  const buySummaryFromPattern =
    !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && pattern
      ? `진입 구간 ${formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh)}`
      : null;
  const stopFromPattern =
    typeof overlay.stopPrice === "number" && overlay.stopPrice > 0
      ? `${formatNumber(overlay.stopPrice)}원`
      : null;
  const stopFromNote = parseSwingPlanSegment(note, "손절가") ?? parseSwingPlanSegment(note, "손절");
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

  return text
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function formatSwingBuyLevel(segment, index) {
  const trimmed = String(segment ?? "").trim();
  if (!trimmed) {
    return "";
  }

  if (/[1-9]차/.test(trimmed) || /^진입\s*구간/.test(trimmed)) {
    return trimmed;
  }

  return `${index + 1}차 ${trimmed}`;
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
    typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}원` : "-"
  );
  const priceLocation =
    pattern.referenceCloseVsBreakoutLevelPercent == null
      ? "-"
      : `돌파선 ${pattern.referenceCloseVsBreakoutLevelPercent.toFixed(1)}% / 피크 ${
          pattern.referenceCloseVsPeakPercent == null ? "-" : `${pattern.referenceCloseVsPeakPercent.toFixed(1)}%`
        }`;

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>스윙 패턴 판정</h4>
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
          <span class="metric-label">상태 설명</span>
          <span class="metric-value">${escapeHtml(swingAssessment.label)}</span>
          <span class="metric-hint">눌러서 전략 보기</span>
        </button>
        <div class="metric">
          <span class="metric-label">기준 윈도우</span>
          <span class="metric-value">${SWING_LOOKBACK_DAYS}거래일</span>
        </div>
        <div class="metric">
          <span class="metric-label">내부 구조</span>
          <span class="metric-value">${escapeHtml(getSwingStructureLabel(pattern))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">진입 구간</span>
          <span class="metric-value">${escapeHtml(formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">이탈 기준</span>
          <span class="metric-value">${typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}원` : "-"}</span>
        </div>
        <div class="metric">
          <span class="metric-label">선행 수급일</span>
          <span class="metric-value">${escapeHtml(pattern.leadInDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">급등 피크일</span>
          <span class="metric-value">${escapeHtml(pattern.surgePeakDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">급등 유지</span>
          <span class="metric-value">${
            pattern.surgeContinuationSessions == null
              ? "-"
              : `${escapeHtml(String(pattern.surgeContinuationSessions + 1))}거래일`
          }</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 구간</span>
          <span class="metric-value">${escapeHtml(pattern.pullbackStartDate ?? "-")} ~ ${escapeHtml(pattern.pullbackEndDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 범위</span>
          <span class="metric-value">${pattern.pullbackRangePercent == null ? "-" : `${escapeHtml(pattern.pullbackRangePercent.toFixed(1))}%`}</span>
        </div>
        <div class="metric">
          <span class="metric-label">돌파일</span>
          <span class="metric-value">${escapeHtml(pattern.breakoutDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">현재 가격 위치</span>
          <span class="metric-value">${escapeHtml(priceLocation)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">${pattern.stage === "breakout" ? "돌파 후 경과" : "피크 후 경과"}</span>
          <span class="metric-value">${
            pattern.stage === "breakout"
              ? pattern.sessionsSinceBreakout == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSinceBreakout))}거래일`
              : pattern.sessionsSincePeak == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSincePeak))}거래일`
          }</span>
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
  return points.map((point) =>
    point.isWhitespace
      ? {
          time: point.time
        }
      : {
          time: point.time,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close
        }
  );
}

function buildInteractiveVolumeSeriesData(points) {
  return points.map((point) =>
    point.isWhitespace
      ? {
          time: point.time
        }
      : {
          time: point.time,
          value: point.value,
          color: point.isHalted
            ? "rgba(120, 128, 140, 0.22)"
            : point.close >= point.open
              ? "rgba(216,76,63,0.35)"
              : "rgba(47,110,229,0.32)"
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

  const buyPrices = Array.isArray(swingTradeOverlay?.buyPrices)
    ? swingTradeOverlay.buyPrices.filter((price) => Number.isFinite(price) && price > 0)
    : [];
  const hasTradeOverlay = buyPrices.length > 0 || (typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0);
  const anchorPoint =
    points.find((point) => point.time === anchorDate && !point.isWhitespace) ??
    points.find((point) => !point.isWhitespace);

  if (!hasTradeOverlay && anchorPoint?.close != null) {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price: anchorPoint.close,
        color: "rgba(159,62,25,0.85)",
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: `기준일 ${anchorDate}`
      })
    );
  }

  buyPrices.forEach((price, index) => {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price,
        color: "rgba(202, 138, 4, 0.95)",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: buyPrices.length > 1 ? `${index + 1}차 매수` : "매수가"
      })
    );
  });

  if (typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0) {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price: swingTradeOverlay.stopPrice,
        color: "rgba(185, 28, 28, 0.95)",
        lineStyle: LineStyle.Dotted,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "손절가"
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
      background: { type: ColorType.Solid, color: "#fdfaf4" },
      textColor: "#695d4e",
      fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
    },
    grid: {
      vertLines: { color: "rgba(31,26,20,0.05)", style: LineStyle.Dashed },
      horzLines: { color: "rgba(31,26,20,0.08)", style: LineStyle.Dashed }
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(159,62,25,0.45)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: false
      },
      horzLine: { color: "rgba(159,62,25,0.25)", width: 1, style: LineStyle.Dashed }
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

  const priceChart = createChart(priceContainer, {
    ...commonChartOptions,
    height: 330
  });
  const volumeChart = createChart(volumeContainer, {
    ...commonChartOptions,
    height: 120
  });

  const candleSeries = priceChart.addSeries(CandlestickSeries, {
    upColor: "#d84c3f",
    downColor: "#2f6ee5",
    borderUpColor: "#d84c3f",
    borderDownColor: "#2f6ee5",
    wickUpColor: "#d84c3f",
    wickDownColor: "#2f6ee5",
    priceLineVisible: false
  });

  const volumeSeries = volumeChart.addSeries(HistogramSeries, {
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

  const ma5Series = priceChart.addSeries(LineSeries, {
    color: "#177245",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma20Series = priceChart.addSeries(LineSeries, {
    color: "#d84c3f",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma60Series = priceChart.addSeries(LineSeries, {
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
      const point = currentPoints.find((candidate) => candidate.time === String(param.time));
      if (!point?.isWhitespace) {
        tooltip.classList.add("hidden");
        return;
      }

      const left = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
      const top = Math.max(param.point.y - 18, 12);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.classList.remove("hidden");
      tooltip.innerHTML = `
        <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
        <div>${point?.isHalted ? "거래정지" : "거래 없음"}</div>
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
      ${point?.isHalted ? `<div>거래정지</div>` : ""}
      <div>시가 ${formatNumber(candleData.open)}</div>
      <div>고가 ${formatNumber(candleData.high)}</div>
      <div>저가 ${formatNumber(candleData.low)}</div>
      <div>종가 ${formatNumber(candleData.close)}</div>
      <div>거래량 ${formatNumber(point?.value)}</div>
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

    const window = tradingPoints.slice(index - period + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.close, 0) / period;
    result.push({
      time: tradingPoints[index].time,
      value: average
    });
  }
  return result;
}

function setDefaultVisibleTradingRange(priceChart, points, visibleSessions = DEFAULT_VISIBLE_TRADING_SESSIONS) {
  const tradingIndexes = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => !point.isWhitespace && typeof point.close === "number");

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
  const priceReference =
    priceContext?.latestClose != null
      ? `가격 기준: ${formatNumber(priceContext.latestClose)}원${priceContext?.latestDate ? ` (${priceContext.latestDate} 종가)` : ""}`
      : "";
  const businessProfileHtml = renderBusinessProfile(fundamentals, priceContext);
  const hasAnnualHistory = Array.isArray(fundamentals?.annualHistory) && fundamentals.annualHistory.length > 0;
  const hasQuarterlyHistory = Array.isArray(fundamentals?.quarterlyHistory) && fundamentals.quarterlyHistory.length > 0;
  const hasFinancials = Boolean(fundamentals?.annual || fundamentals?.quarterly || hasAnnualHistory || hasQuarterlyHistory);

  if (!hasFinancials && !businessProfileHtml) {
    return `
      <section class="fundamentals-panel empty-fundamentals">
        <div class="fundamentals-head">
          <h4>재무지표 ${renderInfoIcon(fundamentalsGuideText, "재무지표 안내")}</h4>
          ${priceReference ? `<span>${escapeHtml(priceReference)}</span>` : ""}
        </div>
        <p>이 종목은 재무 데이터를 찾지 못했거나 ETF여서 표시할 재무지표가 없습니다.</p>
      </section>
    `;
  }

  return `
      <section class="fundamentals-panel">
        <div class="fundamentals-head">
          <h4>재무지표 ${renderInfoIcon(fundamentalsGuideText, "재무지표 안내")}</h4>
          <span>${escapeHtml(fundamentals?.source || "데이터 없음")}</span>
        </div>
        ${priceReference ? `<div class="fundamentals-price-reference">${escapeHtml(priceReference)}</div>` : ""}
        ${businessProfileHtml}
        ${
          hasFinancials
            ? `
              ${renderQuarterlyHistoryTable(fundamentals)}
            `
            : `<div class="fundamental-empty">재무 수치는 아직 비어 있지만, 사업 포트폴리오 맵은 먼저 확인할 수 있습니다.</div>`
        }
      </section>
  `;
}

function renderBusinessProfile(fundamentals, priceContext) {
  const businessAreas = getBusinessAreasForRender(fundamentals, priceContext?.sectorLabel);
  const businessSummary = typeof fundamentals?.businessSummary === "string" ? fundamentals.businessSummary.trim() : "";
  if (!businessAreas.length && !businessSummary) {
    return "";
  }

  const profileSource =
    fundamentals?.businessAreasSource ||
    (priceContext?.sectorLabel ? `업종 기준 기본 맵 · ${priceContext.sectorLabel}` : "사업 개요 기반 추정");

  return `
    <section class="business-profile-panel">
      <div class="business-profile-head">
        <div>
          <h5>사업 포트폴리오 맵 ${renderInfoIcon(businessAreaGuideText, "사업 포트폴리오 안내")}</h5>
          <div class="business-profile-copy">한 종목이 가진 여러 사업 축을 원형 그래프로 빠르게 읽는 보드입니다.</div>
        </div>
        <span class="business-profile-source">${escapeHtml(profileSource)}</span>
      </div>

      <div class="business-profile-layout">
        <div class="business-profile-chart-wrap">
          <div class="business-profile-chart" style="background:${escapeHtml(buildBusinessAreaGradient(businessAreas))};">
            <div class="business-profile-chart-hole">
              <strong>${escapeHtml(priceContext?.stockName || "사업 구조")}</strong>
              <span>${escapeHtml(String(businessAreas.length || 1))}개 축</span>
            </div>
          </div>
        </div>

        <div class="business-profile-legend">
          ${businessAreas
            .map(
              (area, index) => `
                <div class="business-profile-item">
                  <span class="business-profile-swatch" style="background:${escapeHtml(getBusinessAreaColor(index))};"></span>
                  <div class="business-profile-item-copy">
                    <strong>${escapeHtml(area.label)}</strong>
                    <span>${escapeHtml(String(area.weight))}%</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>

      ${
        businessSummary
          ? `<div class="business-profile-summary">${escapeHtml(truncateText(businessSummary, 210))}</div>`
          : ""
      }
    </section>
  `;
}

function getBusinessAreasForRender(fundamentals, sectorLabel) {
  if (Array.isArray(fundamentals?.businessAreas) && fundamentals.businessAreas.length) {
    return fundamentals.businessAreas
      .filter((item) => item && typeof item.label === "string" && Number.isFinite(item.weight))
      .slice(0, 5);
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

function renderFundamentalBlock(title, period, description = "") {
  if (!period) {
    return `
      <div class="fundamental-block">
        <div class="fundamental-title">${title}</div>
        ${description ? `<div class="fundamental-copy">${escapeHtml(description)}</div>` : ""}
        <div class="fundamental-empty">데이터 없음</div>
      </div>
    `;
  }

  return `
    <div class="fundamental-block">
      <div class="fundamental-title">${title}</div>
      ${description ? `<div class="fundamental-copy">${escapeHtml(description)}</div>` : ""}
      <div class="fundamental-period">${escapeHtml(period.label)}</div>
      <dl class="fundamental-list">
        ${fundamentalMetricDefinitions.map((metric) => renderFundamentalItem(metric, period?.[metric.key])).join("")}
      </dl>
    </div>
  `;
}

function buildFundamentalsTablePeriods(history, fallback, limit = 8) {
  const items = Array.isArray(history) ? history.filter(Boolean) : [];
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    const key = item?.label;
    if (!key || seen.has(key)) {
      continue;
    }
    deduped.push(item);
    seen.add(key);
  }

  if ((!deduped.length || (fallback?.label && !seen.has(fallback.label))) && fallback?.label) {
    deduped.push(fallback);
  }

  return deduped.slice(-limit);
}

function renderQuarterlyHistoryTable(fundamentals) {
  const annualPeriods = buildFundamentalsTablePeriods(fundamentals?.annualHistory, fundamentals?.annual, 2);
  const actualQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyHistory, fundamentals?.quarterly, 8);
  const estimatedQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyEstimateHistory, undefined, 8);
  if (!annualPeriods.length && !actualQuarterlyPeriods.length && !estimatedQuarterlyPeriods.length) {
    return "";
  }

  const tableId = "fundamentalsQuarterlyHistory";
  const annualHeader = annualPeriods.length
    ? `<th colspan="${annualPeriods.length}" class="fundamentals-group annual">연간</th>`
    : "";
  const actualQuarterlyHeader = actualQuarterlyPeriods.length
    ? `<th colspan="${actualQuarterlyPeriods.length}" class="fundamentals-group quarterly">실제 분기</th>`
    : "";
  const estimatedQuarterlyHeader = estimatedQuarterlyPeriods.length
    ? `<th colspan="${estimatedQuarterlyPeriods.length}" class="fundamentals-group estimated">추정 분기 (E)</th>`
    : "";
  const annualCells = annualPeriods
    .map(
      (period, index) => {
        const needsSectionEnd = index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
        return `<th class="fundamentals-period-head annual ${needsSectionEnd ? "section-end" : ""}">${escapeHtml(period.label)}</th>`;
      }
    )
    .join("");
  const actualQuarterlyCells = actualQuarterlyPeriods
    .map(
      (period, index) =>
        `<th class="fundamentals-period-head quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${escapeHtml(period.label)}</th>`
    )
    .join("");
  const estimatedQuarterlyCells = estimatedQuarterlyPeriods
    .map(
      (period, index) =>
        `<th class="fundamentals-period-head estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${escapeHtml(period.label)}</th>`
    )
    .join("");
  return `
    <section class="fundamentals-history-section">
      <div class="fundamentals-history-head">
        <div>
          <h5>재무 흐름 표</h5>
          <p>최근 2개 연간, 실제 분기 최대 8개를 우선 보여주고 추정 분기(E)는 별도 구간으로 분리합니다.</p>
        </div>
        <div class="fundamentals-scroll-controls">
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="prev" data-fundamentals-target="${tableId}" aria-label="이전 재무 구간 보기">‹</button>
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="next" data-fundamentals-target="${tableId}" aria-label="다음 재무 구간 보기">›</button>
        </div>
      </div>
      <div id="${tableId}" class="fundamentals-table-scroll">
        <table class="fundamentals-table">
          <thead>
            <tr>
              <th rowspan="2" class="fundamentals-sticky-col">지표</th>
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
            ${fundamentalMetricDefinitions
              .map(
                (metric) => `
                  <tr>
                    <th class="fundamentals-sticky-col">${metric.label}${renderInfoIcon(fundamentalMetricGuides[metric.label], `${metric.label} 설명`)}</th>
                    ${annualPeriods
                      .map(
                        (period, index) => {
                          const needsSectionEnd =
                            index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
                          return `<td class="annual ${needsSectionEnd ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`;
                        }
                      )
                      .join("")}
                    ${actualQuarterlyPeriods
                      .map(
                        (period, index) =>
                          `<td class="quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
                      )
                      .join("")}
                    ${estimatedQuarterlyPeriods
                      .map(
                        (period, index) =>
                          `<td class="estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
                      )
                      .join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderFundamentalItem(metric, value) {
  const guide = fundamentalMetricGuides[metric.label];
  return `
    <div class="fundamental-item">
      <dt>${metric.label}${guide ? ` ${renderInfoIcon(guide, `${metric.label} 설명`)}` : ""}</dt>
      <dd>${formatFundamentalMetricValue(metric, value)}</dd>
    </div>
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

  return `${value.slice(0, maxLength - 1)}…`;
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
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value / 100000000)}\uC5B5`;
}

function formatKoreanChartDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00Z`);
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}







