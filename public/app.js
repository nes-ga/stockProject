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

const timeframes = ["daily", "weekly", "monthly"];
const timeframeLabels = {
  daily: "일봉",
  weekly: "주봉",
  monthly: "월봉"
};

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
const stockForm = document.querySelector("#stockForm");
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

initializeApp();

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

stockModal.addEventListener("click", (event) => {
  if (event.target === stockModal) {
    closeStockModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stockModal.classList.contains("hidden")) {
    closeStockModal();
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
  closeStockModal();
  renderCategoryTabs();
  renderSelector();
  await runAnalysisByKey(item.key);
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
  renderCategoryTabs();
  renderSelector();
  renderBandList();
  renderPostList();
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
}

function loadBandAccessToken() {
  try {
    return localStorage.getItem(BAND_ACCESS_TOKEN_KEY);
  } catch {
    return null;
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
  results.innerHTML = `<div class="empty-state"><p>BAND 寃뚯떆湲??遺꾩꽍?섎뒗 以묒엯?덈떎...</p></div>`;

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

function renderSelector() {
  const pagedItems = getPagedItems();

  stockSelector.innerHTML = pagedItems
    .map((item) => {
      const selected = item.key === selectedKey;
      return `
        <article class="stock-card ${selected ? "selected" : ""}">
          <span class="stock-card-head">
            <button class="stock-card-select" type="button" data-stock-key="${escapeHtml(item.key)}">
              <span class="stock-card-name">${escapeHtml(item.name)}</span>
              <span class="stock-card-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.anchorDate)}</span>
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

    return parsed.filter(isValidRecommendation).map(normalizeRecommendation);
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

function getFilteredInitialKey() {
  return recommendationCatalog.find((item) => (item.category ?? DEFAULT_CATEGORY) === currentCategory)?.key ?? null;
}

function getFilteredCatalog() {
  return recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === currentCategory);
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
  recommendationCatalog = recommendationCatalog.filter((item) => item.key !== key);
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
  if (selectedKey) {
    runAnalysisByKey(selectedKey);
  }
}

function openStockModal() {
  stockForm.reset();
  if (stockCategorySelect) {
    stockCategorySelect.value = currentCategory;
  }
  showError("");
  stockModal.classList.remove("hidden");
  stockNameInput.focus();
}

function closeStockModal() {
  stockModal.classList.add("hidden");
}

function buildStockFromForm() {
  const name = stockNameInput.value.trim();
  const symbol = stockSymbolInput.value.trim();
  const anchorDate = stockDateInput.value;
  const category = stockCategorySelect?.value === "swing" ? "swing" : DEFAULT_CATEGORY;
  const recommendedPrice = Number(stockPriceInput.value);
  const extraNote = stockNoteInput.value.trim();

  if (!name || !symbol || !anchorDate || !Number.isFinite(recommendedPrice) || recommendedPrice <= 0) {
    showError("종목명, 종목코드, 추천가, 추천 기준일을 모두 입력해주세요.");
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

    currentAnalysis = enrichAnalysis(analysis);
    results.classList.remove("empty");
    results.innerHTML = renderCard(currentAnalysis);
    mountInteractiveChart(currentAnalysis.chartSets[currentAnalysis.activeTimeframe], currentAnalysis.tradingAnchorDate);
    setStatus("done", "완료");
    showSummary(`${item.name} 분석이 완료되었습니다. 확대/축소, 드래그 이동, 툴팁을 지원합니다.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    setStatus("error", "오류");
    showError(message);
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>오류를 해결한 뒤 다시 선택해주세요.</p></div>`;
  }
}

function enrichAnalysis(analysis) {
  const daily = analysis.chartWindow.points;
  return {
    ...analysis,
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
          <div id="chartContainer" class="chart-canvas"></div>
          <div id="chartTooltip" class="chart-tooltip hidden"></div>
          <div class="chart-caption">
            <span class="timeframe-caption">${timeframeLabels[item.activeTimeframe]}</span>
            <span>${escapeHtml(item.chartWindow.startDate)}</span>
            <span>${escapeHtml(item.chartWindow.endDate)}</span>
          </div>
        </div>
      </div>

      <div class="fundamentals-wrap">
        ${renderFundamentals(item.fundamentals)}
      </div>
    </article>
  `;
}

function cleanupChart() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (activeChart) {
    activeChart.chart.remove();
    activeChart = null;
  }
}

function mountInteractiveChart(points, anchorDate) {
  const container = document.querySelector("#chartContainer");
  const tooltip = document.querySelector("#chartTooltip");
  if (!container || !tooltip) {
    return;
  }

  cleanupChart();

  const chart = createChart(container, {
    width: container.clientWidth || 840,
    height: 420,
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
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#177245",
    downColor: "#b13828",
    borderUpColor: "#177245",
    borderDownColor: "#b13828",
    wickUpColor: "#177245",
    wickDownColor: "#b13828",
    priceLineVisible: false
  });

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "",
    priceLineVisible: false
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0
    }
  });

  const ma5Series = chart.addSeries(LineSeries, {
    color: "#d97706",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma20Series = chart.addSeries(LineSeries, {
    color: "#2563eb",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  const ma60Series = chart.addSeries(LineSeries, {
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
      color: point.close >= point.open ? "rgba(23,114,69,0.35)" : "rgba(177,56,40,0.32)"
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

  chart.subscribeCrosshairMove((param) => {
    if (!param.point || !param.time || !param.seriesData.size) {
      tooltip.classList.add("hidden");
      return;
    }

    const candleData = param.seriesData.get(candleSeries);
    const volumeData = param.seriesData.get(volumeSeries);
    if (!candleData || !("open" in candleData)) {
      tooltip.classList.add("hidden");
      return;
    }

    const left = Math.min(param.point.x + 18, container.clientWidth - 180);
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
      <div>거래량 ${formatNumber(volumeData?.value)}</div>
    `;
  });

  chart.timeScale().fitContent();

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    chart.applyOptions({ width: entry.contentRect.width });
  });
  resizeObserver.observe(container);

  activeChart = { chart, container };
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

function renderFundamentals(fundamentals) {
  if (!fundamentals || (!fundamentals.annual && !fundamentals.quarterly)) {
    return `
      <section class="fundamentals-panel empty-fundamentals">
        <h4>재무지표</h4>
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

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatMultiplier(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}x`;
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







