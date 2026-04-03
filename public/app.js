import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart
} from "/vendor/lightweight-charts/lightweight-charts.standalone.production.mjs";

const STORAGE_KEY = "band-stock-recommendations-v2";
const BAND_ACCESS_TOKEN_KEY = "band-access-token-v1";
const PAGE_SIZE_ALL = 999;
const DEFAULT_CATEGORY = "longTerm";
const SWING_LOOKBACK_DAYS = 35;
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
  "축적형: 거래량이 터진 기준봉 뒤에 거래량 감소 눌림이 유지되면 55점 이상에서 인정합니다.",
  "완성형: 축적 뒤 재돌파까지 확인되면 68점 이상에서 인정합니다.",
  "즉 같은 60점이어도 축적형에서는 강한 편일 수 있지만, 완성형에서는 아직 부족할 수 있습니다."
].join("\n");
const defaultRecommendationBySymbol = new Map(defaultRecommendationCatalog.map((item) => [item.symbol, item]));

let recommendationCatalog = loadCatalog();
let currentCategory = DEFAULT_CATEGORY;
let currentAnalysis = null;
let selectedKey = getFilteredInitialKey();
let activeChart = null;
let resizeObserver = null;
let itemsPerPage = 5;
let currentPage = 1;
let bandConfig = null;
let bandAccessToken = loadBandAccessToken();
let bandItems = [];
let postItems = [];
let selectedBandKey = null;
let activeView = "index";
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

const appTabs = document.querySelector("#appTabs");
const indexView = document.querySelector("#indexView");
const bandView = document.querySelector("#bandView");
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
const stockForm = document.querySelector("#stockForm");
const stockSearchInput = document.querySelector("#stockSearchInput");
const stockSearchResults = document.querySelector("#stockSearchResults");
const selectedStockCard = document.querySelector("#selectedStockCard");
const indexWatchList = document.querySelector("#indexWatchList");
const stockNameInput = document.querySelector("#stockNameInput");
const stockSymbolInput = document.querySelector("#stockSymbolInput");
const stockPriceInput = document.querySelector("#stockPriceInput");
const stockDateInput = document.querySelector("#stockDateInput");
const stockCategoryTabs = document.querySelector("#stockCategoryTabs");
const stockCategorySelect = document.querySelector("#stockCategorySelect");
const stockNoteInput = document.querySelector("#stockNoteInput");
const bandConnectionStatus = document.querySelector("#bandConnectionStatus");
const bandSetupNotice = document.querySelector("#bandSetupNotice");
const bandLoginBtn = document.querySelector("#bandLoginBtn");
const bandRefreshBandsBtn = document.querySelector("#bandRefreshBandsBtn");
const bandLogoutBtn = document.querySelector("#bandLogoutBtn");
const bandList = document.querySelector("#bandList");
const postList = document.querySelector("#postList");
const bandCountLabel = document.querySelector("#bandCountLabel");
const postCountLabel = document.querySelector("#postCountLabel");
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
  renderCategoryTabs();
  renderSelector();
  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
    return;
  }

  currentAnalysis = null;
  cleanupChart();
  showSummary("");
  showError("");
  results.classList.add("empty");
  results.innerHTML = `<div class="empty-state"><p>${category === "swing" ? "스윙" : "중장기"} 탭에 종목을 추가하면 결과가 여기에 표시됩니다.</p></div>`;
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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stockModal.classList.contains("hidden")) {
    closeStockModal();
    return;
  }

  if (event.key === "Escape" && indexChartModal && !indexChartModal.classList.contains("hidden")) {
    closeIndexChartModal();
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
  selectedKey = item.key;
  currentPage = getTotalPagesForCount(recommendationCatalog.length);
  saveCatalog();
  if (item.category === "swing") {
    await refreshSwingPatternSnapshots();
  }
  closeStockModal();
  renderCategoryTabs();
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

bandLoginBtn?.addEventListener("click", async () => {
  await startBandLogin();
});

bandRefreshBandsBtn?.addEventListener("click", async () => {
  await refreshBandsAndPosts();
});

bandLogoutBtn?.addEventListener("click", () => {
  disconnectBand();
});

refreshMoversBtn?.addEventListener("click", async () => {
  await loadMovers();
});

bandList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-band-key]");
  if (!button) {
    return;
  }

  const bandKey = button.dataset.bandKey;
  if (!bandKey || bandKey === selectedBandKey) {
    return;
  }

  selectedBandKey = bandKey;
  renderBandList();
  await loadPostsForSelectedBand();
});

postList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-post-key]");
  if (!button) {
    return;
  }

  const postKey = button.dataset.postKey;
  if (!postKey) {
    return;
  }

  await runBandPostAnalysis(postKey);
});

results.addEventListener("click", (event) => {
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
  applyScoreGuideTooltips();
  renderAppTabs();
  renderCategoryTabs();
  renderIndexWatchList();
  renderSelector();
  renderBandList();
  renderPostList();
  renderStockSearchResults();
  renderBandSetupNotice(
    "info",
    '먼저 <code>.env</code>에 BAND 앱 정보를 넣고, 서버를 다시 시작한 뒤 <code>BAND 로그인</code> 버튼을 누르세요.'
  );
  setBandConnectionBadge("idle", "준비 중");

  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
  }

  await loadBandConfig();
  await handleBandOAuthRedirect();

  if (bandAccessToken) {
    await refreshBandsAndPosts();
  } else {
    renderBandSetupState();
  }

  void loadStockUniverse();
  void loadMarketWatch();
  startMarketWatchAutoRefresh();
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

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length) {
      recommendationCatalog = mergeRecommendations(recommendationCatalog, items);
      saveCatalog();
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

  indexView?.classList.toggle("hidden", activeView !== "index");
  bandView?.classList.toggle("hidden", activeView !== "band");
  moversView?.classList.toggle("hidden", activeView !== "movers");
}

function getMarketWatchMovingAverageConfig(timeframe) {
  if (timeframe === "weekly") {
    return [
      { key: "fast", label: "5주선", period: 5, className: "fast-line", color: "#7c3aed" },
      { key: "short", label: "20주선", period: 20, className: "short-line", color: "#d97706" },
      { key: "long", label: "60주선", period: 60, className: "long-line", color: "#2563eb" }
    ];
  }

  if (timeframe === "yearly") {
    return [
      { key: "short", label: "3년선", period: 3, className: "short-line", color: "#d97706" },
      { key: "long", label: "5년선", period: 5, className: "long-line", color: "#2563eb" }
    ];
  }

  return [
    { key: "fast", label: "5일선", period: 5, className: "fast-line", color: "#7c3aed" },
    { key: "short", label: "20일선", period: 20, className: "short-line", color: "#d97706" },
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

function switchAppView(view) {
  activeView = ["index", "band", "movers"].includes(view) ? view : "band";
  renderAppTabs();

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
  }
}

function startMarketWatchAutoRefresh() {
  if (marketWatchRefreshTimer) {
    clearInterval(marketWatchRefreshTimer);
  }

  marketWatchRefreshTimer = window.setInterval(() => {
    const modalOpen = indexChartModal && !indexChartModal.classList.contains("hidden");
    if (modalOpen) {
      return;
    }

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

  chart.timeScale().fitContent();

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

function openIndexChartModal(key) {
  activeMarketWatchKey = key;
  indexChartModal?.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    renderIndexChartModal();
  });
}

function closeIndexChartModal() {
  activeMarketWatchKey = null;
  cleanupMarketWatchCharts();
  indexChartModal?.classList.add("hidden");
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

function loadBandAccessToken() {
  try {
    return localStorage.getItem(BAND_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
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

function saveBandAccessToken(token) {
  bandAccessToken = token;
  localStorage.setItem(BAND_ACCESS_TOKEN_KEY, token);
}

function clearBandAccessToken() {
  bandAccessToken = null;
  localStorage.removeItem(BAND_ACCESS_TOKEN_KEY);
}

async function loadBandConfig() {
  try {
    const response = await fetch("/auth/band/config");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "BAND 설정 정보를 불러오지 못했습니다.");
    }

    bandConfig = payload;
  } catch (error) {
    bandConfig = {
      isConfigured: false,
      redirectUri: null
    };
    renderBandSetupNotice(
      "error",
      error instanceof Error ? error.message : "BAND 설정 상태를 확인하지 못했습니다."
    );
  }

  renderBandSetupState();
}

function renderBandSetupState() {
  if (!bandConfig?.isConfigured) {
    setBandConnectionBadge("error", "설정 필요");
    renderBandSetupNotice(
      "error",
      '프로젝트 루트의 <code>.env</code> 파일에 <code>BAND_CLIENT_ID</code>, <code>BAND_CLIENT_SECRET</code>, <code>BAND_REDIRECT_URI</code>를 채워주세요. 기본 Redirect URI는 <code>http://localhost:3000/auth/band/callback</code> 입니다.'
    );
    return;
  }

  if (bandAccessToken) {
    setBandConnectionBadge("done", "연결됨");
    renderBandSetupNotice(
      "success",
      "BAND 계정 연결이 준비되었습니다. 밴드 목록을 읽고 원하는 게시글을 눌러 바로 분석할 수 있습니다."
    );
    return;
  }

  setBandConnectionBadge("idle", "로그인 대기");
  renderBandSetupNotice(
    "info",
    `이제 <code>BAND 로그인</code> 버튼을 누르세요.${bandConfig.redirectUri ? ` Redirect URI: <code>${escapeHtml(bandConfig.redirectUri)}</code>` : ""}`
  );
}

function setBandConnectionBadge(kind, text) {
  if (!bandConnectionStatus) {
    return;
  }

  bandConnectionStatus.className = `status-badge ${kind}`;
  bandConnectionStatus.textContent = text;
}

function renderBandSetupNotice(kind, html) {
  if (!bandSetupNotice) {
    return;
  }

  bandSetupNotice.className = `setup-notice ${kind}`;
  bandSetupNotice.innerHTML = html;
}

async function startBandLogin() {
  if (!bandConfig?.isConfigured) {
    renderBandSetupState();
    return;
  }

  setBandConnectionBadge("loading", "로그인 이동 중");
  renderBandSetupNotice(
    "info",
    "잠시 후 BAND 로그인 화면으로 이동합니다. 로그인과 권한 동의를 마치면 다시 이 화면으로 돌아옵니다."
  );

  try {
    const response = await fetch("/auth/band/url");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "BAND 로그인 URL을 만들지 못했습니다.");
    }

    window.location.href = payload.authorizeUrl;
  } catch (error) {
    setBandConnectionBadge("error", "로그인 실패");
    renderBandSetupNotice(
      "error",
      error instanceof Error ? error.message : "BAND 로그인 URL을 만들지 못했습니다."
    );
  }
}

async function handleBandOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("band_code");
  if (!code) {
    return;
  }

  setBandConnectionBadge("loading", "토큰 교환 중");
  renderBandSetupNotice("info", "BAND 로그인은 완료되었습니다. 접근 토큰을 발급받는 중입니다.");

  try {
    const response = await fetch("/auth/band/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "BAND 토큰 발급에 실패했습니다.");
    }

    saveBandAccessToken(payload.access_token);
    params.delete("band_code");
    params.delete("state");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    renderBandSetupState();
  } catch (error) {
    clearBandAccessToken();
    setBandConnectionBadge("error", "토큰 실패");
    renderBandSetupNotice(
      "error",
      error instanceof Error ? error.message : "BAND 토큰 발급에 실패했습니다."
    );
  }
}

async function refreshBandsAndPosts() {
  if (!bandAccessToken) {
    renderBandSetupState();
    return;
  }

  setBandConnectionBadge("loading", "밴드 조회 중");
  renderBandSetupNotice("info", "내 BAND 목록을 불러오는 중입니다.");

  try {
    const response = await fetch(`/band/bands?accessToken=${encodeURIComponent(bandAccessToken)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "밴드 목록을 불러오지 못했습니다.");
    }

    bandItems = Array.isArray(payload.items) ? payload.items : [];
    if (!bandItems.length) {
      selectedBandKey = null;
      postItems = [];
      renderBandList();
      renderPostList();
      setBandConnectionBadge("done", "연결됨");
      renderBandSetupNotice("info", "접근 가능한 밴드는 읽었지만 목록이 비어 있습니다.");
      return;
    }

    if (!bandItems.some((item) => item.band_key === selectedBandKey)) {
      selectedBandKey = bandItems[0].band_key;
    }

    renderBandList();
    await loadPostsForSelectedBand();
  } catch (error) {
    setBandConnectionBadge("error", "조회 실패");
    renderBandSetupNotice(
      "error",
      error instanceof Error ? error.message : "밴드 목록을 불러오지 못했습니다."
    );
  }
}

async function loadPostsForSelectedBand() {
  if (!bandAccessToken || !selectedBandKey) {
    postItems = [];
    renderPostList();
    return;
  }

  setBandConnectionBadge("loading", "게시글 조회 중");
  renderBandSetupNotice("info", "선택한 밴드의 게시글을 불러오는 중입니다.");

  try {
    const response = await fetch(
      `/band/posts?accessToken=${encodeURIComponent(bandAccessToken)}&bandKey=${encodeURIComponent(selectedBandKey)}&limit=15`
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "게시글 목록을 불러오지 못했습니다.");
    }

    postItems = Array.isArray(payload.items) ? payload.items : [];
    renderPostList();
    setBandConnectionBadge("done", "연결됨");
    renderBandSetupNotice("success", "밴드와 게시글을 읽었습니다. 분석할 게시글을 눌러주세요.");
  } catch (error) {
    postItems = [];
    renderPostList();
    setBandConnectionBadge("error", "게시글 실패");
    renderBandSetupNotice(
      "error",
      error instanceof Error ? error.message : "게시글 목록을 불러오지 못했습니다."
    );
  }
}

function disconnectBand() {
  clearBandAccessToken();
  bandItems = [];
  postItems = [];
  selectedBandKey = null;
  renderBandList();
  renderPostList();
  renderBandSetupState();
}

function renderBandList() {
  if (!bandList || !bandCountLabel) {
    return;
  }

  bandCountLabel.textContent = `${bandItems.length}개`;
  if (!bandItems.length) {
    bandList.innerHTML = `<div class="empty-state"><p>로그인 후 밴드 목록을 불러오면 여기에 표시됩니다.</p></div>`;
    return;
  }

  bandList.innerHTML = bandItems
    .map((item) => {
      const selected = item.band_key === selectedBandKey;
      return `
        <button class="band-item ${selected ? "selected" : ""}" type="button" data-band-key="${escapeHtml(item.band_key)}">
          <span class="band-item-name">${escapeHtml(item.name ?? item.band_key)}</span>
          <span class="band-item-meta">band_key: ${escapeHtml(item.band_key)}</span>
          <span class="band-item-meta">멤버 ${formatNumber(item.member_count)}명</span>
        </button>
      `;
    })
    .join("");
}

function renderPostList() {
  if (!postList || !postCountLabel) {
    return;
  }

  postCountLabel.textContent = `${postItems.length}개`;
  if (!postItems.length) {
    postList.innerHTML = `<div class="empty-state"><p>밴드를 선택하면 최근 게시글을 여기에 보여드립니다.</p></div>`;
    return;
  }

  postList.innerHTML = postItems
    .map((item) => `
      <button class="post-item" type="button" data-post-key="${escapeHtml(item.postKey ?? "")}">
        <span class="post-item-title">${escapeHtml(item.author || "작성자 미상")}</span>
        <span class="post-item-meta">${escapeHtml(formatBandPostDate(item.createdAt))}</span>
        <span class="post-item-preview">${escapeHtml(buildPostPreview(item.content))}</span>
      </button>
    `)
    .join("");
}

function buildPostPreview(content) {
  if (!content) {
    return "내용이 없는 게시글입니다.";
  }

  return content.length > 140 ? `${content.slice(0, 140)}...` : content;
}

function formatBandPostDate(value) {
  if (!value) {
    return "작성 시각 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

async function runBandPostAnalysis(postKey) {
  if (!bandAccessToken || !selectedBandKey) {
    renderBandSetupState();
    return;
  }

  setStatus("loading", "게시글 분석 중");
  showSummary("");
  showError("");
  results.classList.remove("empty");
  results.innerHTML = `<div class="empty-state"><p>BAND 게시글을 분석하는 중입니다...</p></div>`;

  try {
    const response = await fetch("/analysis/from-post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: bandAccessToken,
        bandKey: selectedBandKey,
        postKey
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "게시글 분석에 실패했습니다.");
    }

    currentAnalysis = null;
    cleanupChart();
    results.innerHTML = renderBandPostAnalysis(payload);
    showSummary(`게시글에서 종목 ${payload.symbols?.length ?? 0}개를 추출해 분석했습니다.`);
    setStatus("done", "분석 완료");
  } catch (error) {
    const message = error instanceof Error ? error.message : "게시글 분석 중 오류가 발생했습니다.";
    setStatus("error", "분석 실패");
    showError(message);
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>게시글 분석에 실패했습니다. 다시 시도해주세요.</p></div>`;
  }
}

function renderBandPostAnalysis(payload) {
  const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
  const analyses = Array.isArray(payload.analyses) ? payload.analyses : [];
  const post = payload.post ?? {};

  return `
    <article class="result-card">
      <div class="post-analysis-header">
        <h3>BAND 게시글 분석</h3>
        <div class="meta-line">${escapeHtml(post.author || "작성자 미상")} / ${escapeHtml(formatBandPostDate(post.createdAt))}</div>
      </div>
      <div class="post-analysis-body">
        <div class="post-content-box">${escapeHtml(post.content || "게시글 본문이 없습니다.")}</div>
        <div class="symbol-chip-row">
          ${symbols.length ? symbols.map((symbol) => `<span class="symbol-chip">${escapeHtml(symbol)}</span>`).join("") : '<span class="symbol-chip">추출된 종목 없음</span>'}
        </div>
        <div class="symbol-analysis-list">
          ${analyses.map((analysis) => renderSymbolAnalysisCard(analysis)).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderSymbolAnalysisCard(analysis) {
  const trendClass =
    analysis.trend === "bullish" ? "positive" : analysis.trend === "bearish" ? "negative" : "neutral";

  return `
    <article class="symbol-analysis-card">
      <div class="symbol-analysis-head">
        <div>
          <h4>${escapeHtml(analysis.shortName || analysis.symbol)}</h4>
          <div class="symbol-analysis-meta">${escapeHtml(analysis.symbol)} / ${escapeHtml(analysis.exchangeName || analysis.resolvedSymbol || "-")}</div>
        </div>
        <div class="return-pill ${trendClass}">${escapeHtml(analysis.trend)}</div>
      </div>
      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">현재가</span>
          <span class="metric-value">${formatNumber(analysis.price)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">1일 변동</span>
          <span class="metric-value">${formatPercent(analysis.changePercent1d)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">20일 변동</span>
          <span class="metric-value">${formatPercent(analysis.changePercent20d)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">RSI 14</span>
          <span class="metric-value">${analysis.rsi14 == null ? "-" : analysis.rsi14.toFixed(1)}</span>
        </div>
      </div>
      <div class="symbol-analysis-summary">${escapeHtml(analysis.summary || "")}</div>
    </article>
  `;
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

async function loadMovers() {
  const filters = getMoversFilters();
  setMoversStatus("loading", "\uC21C\uC704 \uC870\uD68C \uC911");
  showMoversSummary("");
  showMoversError("");

  if (riseMoversList) {
    riseMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB4F1\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
  }
  if (fallMoversList) {
    fallMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB77D\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
  }

  try {
    const [risePayload, fallPayload] = await Promise.all([
      fetchMoversByDirection("rise", filters),
      fetchMoversByDirection("fall", filters)
    ]);

    hasLoadedMovers = true;
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
          <div class="mover-card-head">
            <div class="mover-title">
              <span class="mover-rank">${index + 1}</span>
              <div>
                <h3>${escapeHtml(item.name)}</h3>
                <div class="mover-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.market)} / \uC810\uC218 ${escapeHtml(String(item.alertScore))} ${renderInfoIcon(moversScoreGuideText, "점수 기준 안내")}</div>
              </div>
            </div>
            <span class="signal-pill ${escapeHtml(item.signal)}">${signalLabel}</span>
          </div>

          <div class="mover-price-line">
            <span class="mover-price">${formatNumber(item.price)}\uC6D0</span>
            <span class="mover-change ${changeClass}">${formatPercent(item.changePercent)}</span>
          </div>

          <div class="mover-metrics">
            <div class="mover-metric">
              <span class="mover-metric-label">\uAC70\uB798\uB7C9 \uBC30\uC218</span>
              <span class="mover-metric-value">${formatMultiplier(item.volumeRatio20d)}</span>
            </div>
            <div class="mover-metric">
              <span class="mover-metric-label">\uAC70\uB798\uB300\uAE08</span>
              <span class="mover-metric-value">${formatKoreanEok(item.estimatedTurnover)}</span>
            </div>
            <div class="mover-metric">
              <span class="mover-metric-label">${edgeMetricLabel}</span>
              <span class="mover-metric-value">${edgeMetricValue}</span>
            </div>
            <div class="mover-metric">
              <span class="mover-metric-label">${direction === "rise" ? "\uACE0\uAC00 \uBD80\uADFC" : "\uC800\uAC00 \uBD80\uADFC"}</span>
              <span class="mover-metric-value">${direction === "rise" ? (item.closedNearHigh ? "\uC720\uC9C0" : "-") : item.closedNearLow ? "\uC720\uC9C0" : "-"}</span>
            </div>
          </div>

          <div class="mover-reasons">
            ${(item.reasons?.length ? item.reasons : ["\uCD94\uAC00 \uC2E0\uD638 \uC5C6\uC74C"])
              .slice(0, 3)
              .map((reason) => `<span class="mover-reason">${escapeHtml(reason)}</span>`)
              .join("")}
          </div>

          <div class="mover-summary">${escapeHtml(item.summary || "")}</div>
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

function renderSelector() {
  const pagedItems = getPagedItems();

  stockSelector.innerHTML = pagedItems
    .map((item) => {
      const selected = item.key === selectedKey;
      const swingAssessment = item.category === "swing" ? getSwingAssessment(swingPatternByKey.get(item.key)?.pattern) : null;
      return `
        <article class="stock-card ${selected ? "selected" : ""}">
          <span class="stock-card-head">
            <button class="stock-card-select" type="button" data-stock-key="${escapeHtml(item.key)}">
              <span class="stock-card-name">${escapeHtml(item.name)}</span>
              <span class="stock-card-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.anchorDate)}</span>
              ${
                swingAssessment
                  ? `
                    <span class="stock-card-badges">
                      <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">${escapeHtml(swingAssessment.label)}</span>
                      <span class="stock-pattern-score">15거래일 / 점수 ${escapeHtml(String(swingAssessment.score ?? "-"))}</span>
                    </span>
                  `
                  : ""
              }
              <span class="stock-card-note">${escapeHtml(item.note ?? "")}</span>
            </button>
            <button class="stock-card-delete" type="button" data-delete-key="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.name)} 삭제">×</button>
          </span>
        </article>
      `;
    })
    .join("");

  if (!pagedItems.length) {
    const categoryLabel = currentCategory === "swing" ? "스윙" : "중장기";
    stockSelector.innerHTML = `<div class="empty-state"><p>${categoryLabel}  탭에는 아직 등록된 종목이 없습니다. 종목 추가로 시작해보세요.</p></div>`;
  }

  updatePaginationUi();
}

function renderCategoryTabs() {
  if (!stockCategoryTabs) {
    return;
  }

  for (const tab of stockCategoryTabs.querySelectorAll("[data-category]")) {
    tab.classList.toggle("active", tab.dataset.category === currentCategory);
  }
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultRecommendationCatalog.map(normalizeRecommendation);
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultRecommendationCatalog.map(normalizeRecommendation);
    }

    const normalized = parsed.filter(isValidRecommendation).map(normalizeRecommendation).map(repairRecommendationText);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
  return {
    ...item,
    category: item?.category === "swing" ? "swing" : DEFAULT_CATEGORY
  };
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
  return recommendationCatalog.find((item) => (item.category ?? DEFAULT_CATEGORY) === currentCategory)?.key ?? null;
}

function getFilteredCatalog() {
  const filtered = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === currentCategory);
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
  renderSelector();
  if (removedItem?.category === "swing") {
    void refreshSwingPatternSnapshots().then(() => {
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
    anchorDate,
    note: [formatNumber(recommendedPrice) + "원 기준", extraNote].filter(Boolean).join(" / ")
  };
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
    mountInteractiveChart(currentAnalysis.chartSets[currentAnalysis.activeTimeframe], currentAnalysis.tradingAnchorDate);
    setStatus("done", "완료");
    if (item.category === "swing" && currentAnalysis.swingAssessment) {
      showSummary(
        `${item.name} 분석이 완료되었습니다. 최근 ${SWING_LOOKBACK_DAYS}거래일 기준 ${currentAnalysis.swingAssessment.label}로 분류했습니다.`
      );
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
  return {
    ...analysis,
    category: item.category ?? DEFAULT_CATEGORY,
    swingPatternAnalysis,
    swingAssessment: swingPatternAnalysis ? getSwingAssessment(swingPatternAnalysis.pattern) : null,
    chartSets: {
      daily: toChartPoints(daily),
      weekly: aggregateCandles(daily, "weekly"),
      monthly: aggregateCandles(daily, "monthly")
    },
    activeTimeframe: "daily"
  };
}

function toChartPoints(points) {
  return points.map((point) => ({
    time: point.date,
    open: point.open ?? point.close,
    high: point.high ?? point.close,
    low: point.low ?? point.close,
    close: point.close,
    value: point.volume ?? 0
  }));
}

function aggregateCandles(points, timeframe) {
  const buckets = new Map();

  for (const point of points) {
    const key = timeframe === "weekly" ? getWeekKey(point.date) : point.date.slice(0, 7);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        time: point.date,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close,
        value: point.volume ?? 0
      });
      continue;
    }

    existing.high = Math.max(existing.high, point.high ?? point.close);
    existing.low = Math.min(existing.low, point.low ?? point.close);
    existing.close = point.close;
    existing.value += point.volume ?? 0;
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

function renderCard(item) {
  const returnClass =
    item.returnSinceAnchor > 0 ? "positive" : item.returnSinceAnchor < 0 ? "negative" : "neutral";

  return `
    <article class="result-card">
      <div class="card-head">
        <div class="title-wrap">
          <h3>${escapeHtml(item.name || item.shortName || item.symbol)}</h3>
          <div class="meta-line">
            ${escapeHtml(item.symbol)} / 기준일 ${escapeHtml(item.anchorDate)} / 실제 거래일 ${escapeHtml(item.tradingAnchorDate)}
          </div>
          ${
            item.swingAssessment
              ? `<div class="meta-line">스윙 판정 ${escapeHtml(item.swingAssessment.label)} / 최근 ${SWING_LOOKBACK_DAYS}거래일 기준</div>`
              : ""
          }
          ${item.note ? `<div class="meta-line">${escapeHtml(item.note)}</div>` : ""}
        </div>
        <div class="return-pill ${returnClass}">
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
          <span class="metric-value">${formatNumber(item.latestClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 상승</span>
          <span class="metric-value">${formatPercent(item.maxGainPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 하락</span>
          <span class="metric-value">${formatPercent(item.maxDrawdownPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최고 종가</span>
          <span class="metric-value">${formatNumber(item.highestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최저 종가</span>
          <span class="metric-value">${formatNumber(item.lowestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">기준일 거래량 배수</span>
          <span class="metric-value">${formatMultiplier(item.anchorVolumeVs20dBefore)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최근 거래량 배수</span>
          <span class="metric-value">${formatMultiplier(item.latestVolumeVs20d)}</span>
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
            <span>${escapeHtml(item.chartWindow.startDate)}</span>
            <span>${escapeHtml(item.chartWindow.endDate)}</span>
          </div>
        </div>
      </div>

      ${renderSwingPatternPanel(item.swingPatternAnalysis, item.swingAssessment)}

      <div class="fundamentals-wrap">
        ${renderFundamentals(item.fundamentals, {
          latestClose: item.latestClose,
          latestDate: item.latestDate
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

  const leftScore = leftAssessment?.score ?? -1;
  const rightScore = rightAssessment?.score ?? -1;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return right.anchorDate.localeCompare(left.anchorDate);
}

function getSwingAssessment(pattern) {
  if (!pattern) {
    return null;
  }

  const isComplete = Boolean(pattern.stage === "breakout" && pattern.matched && pattern.actionable);
  const isSetup = Boolean(pattern.stage === "setup" && pattern.matched);
  return {
    label: isComplete ? "완성형" : isSetup ? "축적형" : "관찰형",
    className: isComplete ? "complete" : isSetup ? "setup" : "watch",
    rank: isComplete ? 3 : isSetup ? 2 : 1,
    score: pattern.patternScore,
    description: isComplete
      ? `최근 ${SWING_LOOKBACK_DAYS}거래일 안에서 기준봉, 눌림, 재돌파까지 확인된 완성형 패턴입니다.`
      : isSetup
        ? `최근 ${SWING_LOOKBACK_DAYS}거래일 안에서 거래량이 터진 기준봉 이후 거래량이 줄며 눌림을 만드는 축적형 패턴입니다.`
        : `최근 ${SWING_LOOKBACK_DAYS}거래일 안에서 기준봉 이후 눌림 구조를 추적 중이지만 아직 강도나 형태가 더 필요합니다.`
  };
}

function renderSwingPatternPanel(swingPatternAnalysis, swingAssessment) {
  if (!swingPatternAnalysis || !swingPatternAnalysis.pattern || !swingAssessment) {
    return "";
  }

  const pattern = swingPatternAnalysis.pattern;
  const stageLabel =
    pattern.stage === "breakout" ? "완성형 돌파" : pattern.stage === "setup" ? "축적 진행형" : "관찰";
  const swingGuideHtml = escapeHtml(swingScoreGuideText).replaceAll("\n", "<br>");
  const reasonItems = (pattern.reasons?.length ? pattern.reasons : [pattern.summary])
    .slice(0, 4)
    .map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`)
    .join("");

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>스윙 패턴 판정</h4>
          <div class="swing-pattern-copy">${escapeHtml(swingAssessment.description)}</div>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">${escapeHtml(swingAssessment.label)}</span>
      </div>

      <div class="metric-grid swing-metric-grid">
        <div class="metric">
          <span class="metric-label">패턴 점수</span>
          <span class="metric-value">${escapeHtml(String(pattern.patternScore))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">기준 윈도우</span>
          <span class="metric-value">${SWING_LOOKBACK_DAYS}거래일</span>
        </div>
        <div class="metric">
          <span class="metric-label">현재 단계</span>
          <span class="metric-value">${escapeHtml(stageLabel)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">판정 기준</span>
          <span class="metric-value">${escapeHtml(pattern.stage === "breakout" ? "68점 이상" : pattern.stage === "setup" ? "55점 이상" : "구조 관찰")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">선행 수급일</span>
          <span class="metric-value">${escapeHtml(pattern.leadInDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 구간</span>
          <span class="metric-value">${escapeHtml(pattern.pullbackStartDate ?? "-")} ~ ${escapeHtml(pattern.pullbackEndDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">돌파일</span>
          <span class="metric-value">${escapeHtml(pattern.breakoutDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">${pattern.stage === "breakout" ? "돌파 후 경과" : "기준봉 후 경과"}</span>
          <span class="metric-value">${
            pattern.stage === "breakout"
              ? pattern.sessionsSinceBreakout == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSinceBreakout))}거래일`
              : pattern.sessionsSinceLeadIn == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSinceLeadIn))}거래일`
          }</span>
        </div>
      </div>

      <div class="swing-pattern-summary">${escapeHtml(pattern.summary)}</div>
      <div class="swing-pattern-copy">${swingGuideHtml}</div>
      <div class="swing-reason-list">${reasonItems}</div>
    </section>
  `;
}

function cleanupChart() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (activeChart) {
    activeChart.priceChart.remove();
    activeChart.volumeChart.remove();
    activeChart = null;
  }
}

function mountInteractiveChart(points, anchorDate) {
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
    color: "#d97706",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma20Series = priceChart.addSeries(LineSeries, {
    color: "#2563eb",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma60Series = priceChart.addSeries(LineSeries, {
    color: "#7c3aed",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });

  candleSeries.setData(
    points.map((point) => ({
      time: point.time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close
    }))
  );

  volumeSeries.setData(
    points.map((point) => ({
      time: point.time,
      value: point.value,
      color: point.close >= point.open ? "rgba(216,76,63,0.35)" : "rgba(47,110,229,0.32)"
    }))
  );

  ma5Series.setData(buildMovingAverage(points, 5));
  ma20Series.setData(buildMovingAverage(points, 20));
  ma60Series.setData(buildMovingAverage(points, 60));

  const anchorPoint = points.find((point) => point.time === anchorDate) ?? points[0];
  if (anchorPoint) {
    candleSeries.createPriceLine({
      price: anchorPoint.close,
      color: "rgba(159,62,25,0.85)",
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: true,
      title: `기준일 ${anchorDate}`
    });
  }

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

    const candleData = param.seriesData.get(candleSeries);
    if (!candleData || !("open" in candleData)) {
      tooltip.classList.add("hidden");
      return;
    }

    const point = points.find((candidate) => candidate.time === String(param.time));

    const left = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
    const top = Math.max(param.point.y - 18, 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove("hidden");
    tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
      <div>시가 ${formatNumber(candleData.open)}</div>
      <div>고가 ${formatNumber(candleData.high)}</div>
      <div>저가 ${formatNumber(candleData.low)}</div>
      <div>종가 ${formatNumber(candleData.close)}</div>
      <div>거래량 ${formatNumber(point?.value)}</div>
    `;
  });

  priceChart.timeScale().fitContent();

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

  activeChart = { priceChart, volumeChart, priceContainer, volumeContainer };
}

function buildMovingAverage(points, period) {
  const result = [];
  for (let index = 0; index < points.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const window = points.slice(index - period + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.close, 0) / period;
    result.push({
      time: points[index].time,
      value: average
    });
  }
  return result;
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

  mountInteractiveChart(currentAnalysis.chartSets[timeframe], currentAnalysis.tradingAnchorDate);
}

function renderFundamentals(fundamentals, priceContext) {
  const priceReference =
    priceContext?.latestClose != null
      ? `가격 기준: ${formatNumber(priceContext.latestClose)}원${priceContext?.latestDate ? ` (${priceContext.latestDate} 종가)` : ""}`
      : "";

  if (!fundamentals || (!fundamentals.annual && !fundamentals.quarterly)) {
    return `
      <section class="fundamentals-panel empty-fundamentals">
        <div class="fundamentals-head">
          <h4>재무지표</h4>
          ${priceReference ? `<span>${escapeHtml(priceReference)}</span>` : ""}
        </div>
        <p>이 종목은 재무 데이터를 찾지 못했거나 ETF여서 표시할 재무지표가 없습니다.</p>
      </section>
    `;
  }

  return `
      <section class="fundamentals-panel">
        <div class="fundamentals-head">
          <h4>재무지표</h4>
          <span>${escapeHtml(fundamentals.source)}</span>
        </div>
        ${priceReference ? `<div class="fundamentals-price-reference">${escapeHtml(priceReference)}</div>` : ""}
        <div class="fundamentals-grid">
          ${renderFundamentalBlock("최근 연간", fundamentals.annual)}
          ${renderFundamentalBlock("최근 분기", fundamentals.quarterly)}
        </div>
      </section>
  `;
}

function renderFundamentalBlock(title, period) {
  if (!period) {
    return `
      <div class="fundamental-block">
        <div class="fundamental-title">${title}</div>
        <div class="fundamental-empty">데이터 없음</div>
      </div>
    `;
  }

  return `
    <div class="fundamental-block">
      <div class="fundamental-title">${title}</div>
      <div class="fundamental-period">${escapeHtml(period.label)}</div>
      <dl class="fundamental-list">
        ${renderFundamentalItem("매출액", period.revenue)}
        ${renderFundamentalItem("영업이익", period.operatingIncome)}
        ${renderFundamentalItem("순이익", period.netIncome)}
        ${renderFundamentalItem("ROE", period.roe, "%")}
        ${renderFundamentalItem("부채비율", period.debtRatio, "%")}
        ${renderFundamentalItem("EPS", period.eps)}
        ${renderFundamentalItem("BPS", period.bps)}
        ${renderFundamentalItem("PER", period.per)}
        ${renderFundamentalItem("PBR", period.pbr)}
      </dl>
    </div>
  `;
}

function renderFundamentalItem(label, value, suffix = "") {
  return `
    <div class="fundamental-item">
      <dt>${label}</dt>
      <dd>${value == null ? "-" : `${formatNumber(value)}${suffix}`}</dd>
    </div>
  `;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
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







