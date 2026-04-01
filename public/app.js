import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart
} from "/vendor/lightweight-charts/lightweight-charts.standalone.production.mjs";

const STORAGE_KEY = "band-stock-recommendations-v1";
const PAGE_SIZE_ALL = 999;

const defaultRecommendationCatalog = [
  {
    key: "엔씨소프트",
    name: "엔씨소프트",
    symbol: "036570",
    anchorDate: "2024-03-22",
    note: "215000원 이하 1차매수"
  },
  {
    key: "TIGER 미국30년국채커버드콜액티브(H)",
    name: "TIGER 미국30년국채커버드콜액티브(H)",
    symbol: "476550",
    anchorDate: "2024-03-12",
    note: "7445원 1차매수"
  },
  {
    key: "포스코DX",
    name: "포스코DX",
    symbol: "022100",
    anchorDate: "2024-03-02",
    latestMentionDate: "2024-03-12",
    note: "초기 추천일 기준"
  },
  {
    key: "CJ대한통운",
    name: "CJ대한통운",
    symbol: "000120",
    anchorDate: "2024-03-05",
    note: "112800원 이하 1차매수"
  },
  {
    key: "제우스",
    name: "제우스",
    symbol: "079370",
    anchorDate: "2024-03-02",
    latestMentionDate: "2024-03-05",
    note: "17600원 아래 분할매수"
  },
  {
    key: "나무가",
    name: "나무가",
    symbol: "190510",
    anchorDate: "2024-02-27",
    latestMentionDate: "2024-03-05",
    note: "22500원 이하 1차매수"
  },
  {
    key: "OCI",
    name: "OCI",
    symbol: "456040",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록"
  },
  {
    key: "아모레퍼시픽",
    name: "아모레퍼시픽",
    symbol: "090430",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록"
  },
  {
    key: "KODEX 2차전지산업레버리지",
    name: "KODEX 2차전지산업레버리지",
    symbol: "462330",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록"
  },
  {
    key: "셀트리온제약",
    name: "셀트리온제약",
    symbol: "068760",
    anchorDate: "2025-07-24",
    note: "53700원 이하 또는 다음날 시가 이하"
  },
  {
    key: "엘앤에프",
    name: "엘앤에프",
    symbol: "066970",
    anchorDate: "2025-07-25",
    note: "64500원 이하 1차매수"
  },
  {
    key: "에코프로비엠",
    name: "에코프로비엠",
    symbol: "247540",
    anchorDate: "2025-07-24",
    note: "112000원 이하 1차매수"
  },
  {
    key: "네오위즈",
    name: "네오위즈",
    symbol: "095660",
    anchorDate: "2025-07-14",
    note: "최근추천 이후 AS 글 언급"
  },
  {
    key: "BGF리테일",
    name: "BGF리테일",
    symbol: "282330",
    anchorDate: "2025-07-28",
    note: "112500원 이하 1차매수"
  },
  {
    key: "LG생활건강",
    name: "LG생활건강",
    symbol: "051900",
    anchorDate: "2025-07-11",
    note: "330000원 이하부터 손절가 구간까지"
  },
  {
    key: "삼성전자",
    name: "삼성전자",
    symbol: "005930",
    anchorDate: "2024-10-31",
    note: "59000원 이하 중기 1차매수"
  },
  {
    key: "오리온홀딩스",
    name: "오리온홀딩스",
    symbol: "001800",
    anchorDate: "2025-05-29",
    note: "박스권 저항대 돌파 여부 관찰"
  },
  {
    key: "컴투스",
    name: "컴투스",
    symbol: "078340",
    anchorDate: "2024-08-29",
    note: "40050원 이하부터 손절가 구간 분할매수"
  }
];

const timeframes = ["daily", "weekly", "monthly"];
const timeframeLabels = {
  daily: "일봉",
  weekly: "주봉",
  monthly: "월봉"
};

let recommendationCatalog = loadCatalog();
let currentAnalysis = null;
let selectedKey = recommendationCatalog[0]?.key ?? null;
let activeChart = null;
let resizeObserver = null;
let itemsPerPage = 10;
let currentPage = 1;

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
const stockNoteInput = document.querySelector("#stockNoteInput");

renderSelector();
if (selectedKey) {
  runAnalysisByKey(selectedKey);
}

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
  selectedKey = item.key;
  currentPage = getTotalPagesForCount(recommendationCatalog.length);
  saveCatalog();
  closeStockModal();
  renderSelector();
  await runAnalysisByKey(item.key);
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
    stockSelector.innerHTML = `<div class="empty-state"><p>등록된 종목이 없습니다. 종목 추가로 시작해보세요.</p></div>`;
  }

  updatePaginationUi();
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...defaultRecommendationCatalog];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return [...defaultRecommendationCatalog];
    }

    return parsed.filter(isValidRecommendation);
  } catch {
    return [...defaultRecommendationCatalog];
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

function getPagedItems() {
  if (itemsPerPage === PAGE_SIZE_ALL) {
    return recommendationCatalog;
  }

  const start = (currentPage - 1) * itemsPerPage;
  return recommendationCatalog.slice(start, start + itemsPerPage);
}

function getTotalPages() {
  return getTotalPagesForCount(recommendationCatalog.length);
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
    selectedKey = recommendationCatalog[0].key;
  }

  currentPage = Math.min(currentPage, getTotalPagesForCount(recommendationCatalog.length));
  saveCatalog();
  renderSelector();
  runAnalysisByKey(selectedKey);
}

function openStockModal() {
  stockForm.reset();
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
  results.innerHTML = `<div class="empty-state"><p>${escapeHtml(item.name)} 데이터를 불러오는 중입니다...</p></div>`;

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
    showSummary(`${item.name} 분석이 완료되었습니다. 휠 확대/축소, 드래그 이동, 툴팁이 지원됩니다.`);
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
          <span class="metric-label">최대 낙폭</span>
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
          <span class="metric-label">최신 거래량 배수</span>
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
          <div class="chart-hint">마우스 휠 확대/축소, 드래그 이동, 십자선 툴팁</div>
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
      vertLine: { color: "rgba(159,62,25,0.45)", width: 1, style: LineStyle.Dashed },
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
      <div class="tooltip-date">${escapeHtml(String(param.time))}</div>
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
        <p>이 종목은 재무 데이터를 찾지 못했거나 ETF라서 표시할 재무제표가 없습니다.</p>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
