import { formatDateInTimeZone, formatDateTimeInTimeZone, getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { readJson } from "../lib/http.js";
import { createLogger } from "../lib/logger.js";
import type {
  ChartPoint,
  GlobalState,
  LocalState,
  MarketFlowDashboardPayload,
  MarketFlowLatest,
  MarketFlowMode,
  MarketFlowSnapshot,
  ThemeBenchmark,
  ThemeCycle,
  ThemeGroup,
  ThemeRotationSnapshot
} from "../types.js";
import { fetchQuoteAndChart } from "./stockAnalysis.js";
import {
  upsertMarketFlowSnapshots,
  upsertThemeRotationSnapshots,
  writeMarketFlowLatest
} from "./marketFlowStorage.js";
import { themeGroups } from "./themeGroups.js";

const logger = createLogger("marketFlowHistory");

const THEME_FETCH_CHUNK_SIZE = 8;
const BACKFILL_BUFFER_DAYS = 80;
const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/"
};

type YahooChartResponse = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        exchangeTimezoneName?: string;
      };
      indicators: {
        quote: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type IndexedHistory = {
  points: ChartPoint[];
  indexByDate: Map<string, number>;
};

type ThemeTickerDailySummary = {
  change1d?: number;
  change5d?: number;
  change20d?: number;
  currentTurnover?: number;
  averageTurnover20?: number;
};

export type MarketFlowBackfillResult = {
  marketSnapshotCount: number;
  themeSnapshotCount: number;
  skippedDateCount: number;
  startDate: string;
  endDate: string;
};

function average(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function scaleScore(score: number, maxScore: number, targetMaxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return roundNumber((score / maxScore) * targetMaxScore, 2);
}

function buildIndexedHistory(points: ChartPoint[]) {
  return {
    points,
    indexByDate: new Map(points.map((point, index) => [point.date, index] as const))
  } satisfies IndexedHistory;
}

function getRangeStartDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getAverageCloseAt(points: ChartPoint[], index: number, period: number) {
  if (index < 0) {
    return undefined;
  }

  const startIndex = Math.max(0, index - period + 1);
  const slice = points.slice(startIndex, index + 1).map((point) => point.close);
  if (slice.length < period) {
    return undefined;
  }

  return average(slice);
}

function isAboveSmaAt(points: ChartPoint[], index: number, period: number) {
  const close = points[index]?.close;
  const sma = getAverageCloseAt(points, index, period);
  if (close == null || sma == null) {
    return undefined;
  }

  return close > sma;
}

function getChangeAt(points: ChartPoint[], index: number, sessionsAgo: number) {
  if (index < 0 || index - sessionsAgo < 0) {
    return undefined;
  }

  return percentChange(points[index]?.close, points[index - sessionsAgo]?.close);
}

function getTurnover(point?: ChartPoint) {
  if (!point || point.volume == null) {
    return undefined;
  }

  return point.close * point.volume;
}

function getAverageTurnoverAt(points: ChartPoint[], index: number, period: number) {
  if (index <= 0) {
    return undefined;
  }

  const startIndex = Math.max(0, index - period);
  const values = points
    .slice(startIndex, index)
    .map(getTurnover)
    .filter((value): value is number => typeof value === "number");
  return average(values);
}

function scoreRelativeStrength(relativeReturn20d?: number) {
  if (relativeReturn20d == null) {
    return 50;
  }

  return clamp(Math.round(50 + relativeReturn20d * 3.2), 0, 100);
}

function scoreVolumeRatio(volumeRatio?: number) {
  if (volumeRatio == null) {
    return 45;
  }
  if (volumeRatio >= 1.8) {
    return 94;
  }
  if (volumeRatio >= 1.45) {
    return 82;
  }
  if (volumeRatio >= 1.1) {
    return 68;
  }
  if (volumeRatio >= 0.9) {
    return 54;
  }
  if (volumeRatio >= 0.75) {
    return 40;
  }
  return 24;
}

function scoreMomentum(change20d?: number) {
  if (change20d == null) {
    return 45;
  }

  return clamp(Math.round(50 + change20d * 2.4), 0, 100);
}

function classifyThemeCycle(params: {
  change5d?: number;
  change20d?: number;
  relativeReturn20d?: number;
  volumeRatio?: number;
}): ThemeCycle {
  const change5d = params.change5d ?? 0;
  const change20d = params.change20d ?? 0;
  const relativeReturn20d = params.relativeReturn20d ?? 0;
  const volumeRatio = params.volumeRatio ?? 0;

  if ((change5d >= 12 || change20d >= 25) && volumeRatio >= 1.8) {
    return "OVERHEAT";
  }
  if (change20d >= 6 && relativeReturn20d >= 2 && volumeRatio >= 1) {
    return "MARKUP";
  }
  if (Math.abs(change20d) < 6 && volumeRatio >= 1.08) {
    return "ACCUMULATION";
  }
  if (change20d > -5 && change20d < 4 && volumeRatio < 0.9) {
    return "DISTRIBUTION";
  }
  return "DECLINE";
}

function resolveGlobalState(normalizedScore: number): GlobalState {
  if (normalizedScore >= 3) {
    return "RISK_ON";
  }
  if (normalizedScore >= 1) {
    return "NEUTRAL";
  }
  return "RISK_OFF";
}

function resolveLocalState(normalizedScore: number): LocalState {
  if (normalizedScore >= 5) {
    return "STRONG";
  }
  if (normalizedScore >= 3) {
    return "SELECTIVE";
  }
  if (normalizedScore >= 1) {
    return "WEAK";
  }
  return "DEFENSIVE";
}

function resolveMarketMode(globalState: GlobalState, localState: LocalState): MarketFlowMode {
  if (globalState === "RISK_ON" && localState === "STRONG") {
    return "AGGRESSIVE";
  }
  if (localState === "SELECTIVE") {
    return "SELECTIVE";
  }
  if (globalState === "RISK_OFF" || localState === "DEFENSIVE") {
    return "DEFENSIVE";
  }
  return "NEUTRAL";
}

function findIndexOnOrBeforeDate(points: ChartPoint[], date: string) {
  let left = 0;
  let right = points.length - 1;
  let candidate = -1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const middleDate = points[middle]?.date;
    if (!middleDate) {
      break;
    }

    if (middleDate <= date) {
      candidate = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return candidate;
}

function buildChartPoints(payload: YahooChartResponse) {
  const result = payload.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  const timestamps = result?.timestamp ?? [];
  const exchangeTimeZone = result?.meta?.exchangeTimezoneName;
  const points: ChartPoint[] = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const close = quote?.close?.[index];
    if (close == null) {
      continue;
    }

    points.push({
      date: formatDateInTimeZone(new Date(timestamp * 1000), exchangeTimeZone),
      open: quote?.open?.[index] ?? undefined,
      high: quote?.high?.[index] ?? undefined,
      low: quote?.low?.[index] ?? undefined,
      close,
      volume: quote?.volume?.[index] ?? undefined
    });
  }

  return points;
}

async function fetchYahooHistory(symbol: string, startDate: string) {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  chartUrl.searchParams.set("interval", "1d");
  chartUrl.searchParams.set("period1", String(Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1000)));
  chartUrl.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
  const payload = await fetch(chartUrl, {
    headers: YAHOO_HEADERS
  }).then((response) => readJson<YahooChartResponse>(response));
  return buildChartPoints(payload);
}

async function loadTickerHistories(days: number) {
  const uniqueTickers = [...new Set(themeGroups.flatMap((group) => group.tickers))];
  const sessions = Math.max(520, Math.ceil(days * 0.75) + BACKFILL_BUFFER_DAYS);
  const historyByTicker = new Map<string, IndexedHistory>();

  for (let index = 0; index < uniqueTickers.length; index += THEME_FETCH_CHUNK_SIZE) {
    const chunk = uniqueTickers.slice(index, index + THEME_FETCH_CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(async (symbol) => {
        const result = await fetchQuoteAndChart(symbol, {
          naverCount: sessions
        });
        return [symbol, buildIndexedHistory(result.points)] as const;
      })
    );

    settled.forEach((result, offset) => {
      const symbol = chunk[offset];
      if (result.status === "fulfilled") {
        historyByTicker.set(result.value[0], result.value[1]);
        return;
      }

      logger.warn("backfill:theme-ticker-load-failed", {
        symbol,
        message: result.reason instanceof Error ? result.reason.message : "Unknown theme ticker load failure."
      });
    });
  }

  return historyByTicker;
}

function buildThemeTickerDailySummary(history: IndexedHistory, date: string): ThemeTickerDailySummary | null {
  const index = history.indexByDate.get(date);
  if (index == null) {
    return null;
  }

  const point = history.points[index];
  return {
    change1d: getChangeAt(history.points, index, 1),
    change5d: getChangeAt(history.points, index, 5),
    change20d: getChangeAt(history.points, index, 20),
    currentTurnover: getTurnover(point),
    averageTurnover20: getAverageTurnoverAt(history.points, index, 20)
  };
}

function buildThemeSnapshotsForDate(params: {
  date: string;
  groups: ThemeGroup[];
  tickerHistories: Map<string, IndexedHistory>;
  benchmarkHistories: Map<ThemeBenchmark, IndexedHistory>;
}) {
  const snapshots: ThemeRotationSnapshot[] = [];

  for (const group of params.groups) {
    const summaries = group.tickers
      .map((ticker) => params.tickerHistories.get(ticker))
      .filter((history): history is IndexedHistory => Boolean(history))
      .map((history) => buildThemeTickerDailySummary(history, params.date))
      .filter((item): item is ThemeTickerDailySummary => Boolean(item));

    if (!summaries.length) {
      continue;
    }

    const benchmarkKey = group.benchmark ?? "KOSPI";
    const benchmarkHistory = params.benchmarkHistories.get(benchmarkKey);
    const benchmarkIndex = benchmarkHistory?.indexByDate.get(params.date);
    const benchmarkReturn20d =
      benchmarkHistory && benchmarkIndex != null ? getChangeAt(benchmarkHistory.points, benchmarkIndex, 20) ?? 0 : 0;
    const change1d = average(summaries.map((item) => item.change1d).filter((value): value is number => typeof value === "number"));
    const change5d = average(summaries.map((item) => item.change5d).filter((value): value is number => typeof value === "number"));
    const change20d = average(summaries.map((item) => item.change20d).filter((value): value is number => typeof value === "number"));
    const currentTurnover = summaries.reduce((sum, item) => sum + (item.currentTurnover ?? 0), 0);
    const averageTurnover20 = summaries.reduce((sum, item) => sum + (item.averageTurnover20 ?? 0), 0);
    const volumeRatio = averageTurnover20 > 0 ? currentTurnover / averageTurnover20 : undefined;
    const relativeReturn20d = change20d != null ? change20d - benchmarkReturn20d : undefined;
    const relativeStrength = scoreRelativeStrength(relativeReturn20d);
    const volumeScore = scoreVolumeRatio(volumeRatio);
    const momentumScore = scoreMomentum(change20d);
    const score = clamp(Math.round(relativeStrength * 0.5 + volumeScore * 0.3 + momentumScore * 0.2), 0, 100);

    snapshots.push({
      date: params.date,
      theme: group.name,
      label: group.label,
      category: group.category,
      score,
      relativeStrength,
      volumeScore,
      momentumScore,
      cycle: classifyThemeCycle({
        change5d,
        change20d,
        relativeReturn20d,
        volumeRatio
      }),
      change1d: change1d != null ? roundNumber(change1d) : undefined,
      change5d: change5d != null ? roundNumber(change5d) : undefined,
      change20d: change20d != null ? roundNumber(change20d) : undefined
    });
  }

  return snapshots.sort((left, right) => right.score - left.score || left.theme.localeCompare(right.theme));
}

function buildProxyMetricsForDate(date: string, tickerHistories: Map<string, IndexedHistory>) {
  const uniqueTickers = [...tickerHistories.keys()];
  const summaries = uniqueTickers
    .map((ticker) => tickerHistories.get(ticker))
    .filter((history): history is IndexedHistory => Boolean(history))
    .map((history) => buildThemeTickerDailySummary(history, date))
    .filter((item): item is ThemeTickerDailySummary => Boolean(item));

  const advancingCount = summaries.filter((item) => (item.change1d ?? 0) > 0).length;
  const decliningCount = summaries.filter((item) => (item.change1d ?? 0) < 0).length;
  const totalCount = advancingCount + decliningCount;
  const current = summaries.reduce((sum, item) => sum + (item.currentTurnover ?? 0), 0);
  const average20 = summaries.reduce((sum, item) => sum + (item.averageTurnover20 ?? 0), 0);

  return {
    breadthPercent: totalCount > 0 ? (advancingCount / totalCount) * 100 : undefined,
    turnoverRatio: average20 > 0 ? current / average20 : undefined
  };
}

function buildGlobalSnapshotForDate(params: {
  date: string;
  sp500: IndexedHistory;
  nasdaq: IndexedHistory;
  us10y: IndexedHistory;
  usdkrw: IndexedHistory;
}): MarketFlowSnapshot | null {
  const sp500Index = findIndexOnOrBeforeDate(params.sp500.points, params.date);
  const nasdaqIndex = findIndexOnOrBeforeDate(params.nasdaq.points, params.date);
  const us10yIndex = findIndexOnOrBeforeDate(params.us10y.points, params.date);
  const usdkrwIndex = findIndexOnOrBeforeDate(params.usdkrw.points, params.date);

  const signals = [
    isAboveSmaAt(params.sp500.points, sp500Index, 60),
    isAboveSmaAt(params.nasdaq.points, nasdaqIndex, 60),
    (() => {
      if (us10yIndex < 0) {
        return undefined;
      }
      const latest = params.us10y.points[us10yIndex]?.close;
      const sma20 = getAverageCloseAt(params.us10y.points, us10yIndex, 20);
      const change20d = getChangeAt(params.us10y.points, us10yIndex, 20);
      if (latest == null || sma20 == null || change20d == null) {
        return undefined;
      }
      return latest < sma20 || change20d < 0;
    })(),
    (() => {
      if (usdkrwIndex < 0) {
        return undefined;
      }
      const latest = params.usdkrw.points[usdkrwIndex]?.close;
      const sma20 = getAverageCloseAt(params.usdkrw.points, usdkrwIndex, 20);
      const change20d = getChangeAt(params.usdkrw.points, usdkrwIndex, 20);
      if (latest == null || sma20 == null || change20d == null) {
        return undefined;
      }
      return latest < sma20 || change20d < 0;
    })()
  ].filter((item): item is boolean => typeof item === "boolean");

  if (!signals.length) {
    return null;
  }

  const score = signals.filter(Boolean).length;
  const normalizedScore = scaleScore(score, signals.length, 4);
  return {
    date: params.date,
    globalScore: normalizedScore,
    globalState: resolveGlobalState(normalizedScore),
    localScore: 0,
    localState: "WEAK",
    themeRotationScore: 0,
    marketMode: "NEUTRAL"
  };
}

function buildLocalScoreForDate(params: {
  date: string;
  kospi: IndexedHistory;
  kosdaq: IndexedHistory;
  breadthPercent?: number;
  turnoverRatio?: number;
}) {
  const kospiIndex = params.kospi.indexByDate.get(params.date);
  const kosdaqIndex = params.kosdaq.indexByDate.get(params.date);
  if (kospiIndex == null || kosdaqIndex == null) {
    return null;
  }

  const signals = [
    isAboveSmaAt(params.kospi.points, kospiIndex, 60),
    isAboveSmaAt(params.kosdaq.points, kosdaqIndex, 60),
    params.turnoverRatio != null ? params.turnoverRatio >= 1 : undefined,
    params.breadthPercent != null ? params.breadthPercent >= 55 : undefined
  ].filter((item): item is boolean => typeof item === "boolean");

  if (!signals.length) {
    return null;
  }

  const score = signals.filter(Boolean).length;
  const normalizedScore = scaleScore(score, signals.length, 6);
  return {
    score: normalizedScore,
    state: resolveLocalState(normalizedScore)
  };
}

function toLatestPayload(payload: MarketFlowDashboardPayload): MarketFlowLatest {
  return {
    date: payload.local.date || payload.global.date || getCurrentIsoDate(SEOUL_TIME_ZONE),
    global: {
      score: payload.global.normalizedScore,
      state: payload.global.state
    },
    local: {
      score: payload.local.normalizedScore,
      state: payload.local.state
    },
    themeRotationScore: payload.themeRotation.score,
    marketMode: payload.marketMode,
    topThemes: payload.themeRotation.topThemes.map((item) => item.label),
    bottomThemes: payload.themeRotation.bottomThemes.map((item) => item.label),
    updatedAt: payload.generatedAt
  };
}

function toMarketFlowSnapshot(payload: MarketFlowDashboardPayload): MarketFlowSnapshot {
  return {
    date: payload.local.date || payload.global.date || getCurrentIsoDate(SEOUL_TIME_ZONE),
    globalScore: payload.global.normalizedScore,
    globalState: payload.global.state,
    localScore: payload.local.normalizedScore,
    localState: payload.local.state,
    themeRotationScore: payload.themeRotation.score,
    marketMode: payload.marketMode
  };
}

function toThemeRotationHistorySnapshots(payload: MarketFlowDashboardPayload): ThemeRotationSnapshot[] {
  return payload.themeRotation.snapshots.map((item) => ({
    date: item.date,
    theme: item.theme,
    label: item.label,
    category: item.category,
    score: item.score,
    relativeStrength: item.relativeStrength,
    volumeScore: item.volumeScore,
    momentumScore: item.momentumScore,
    cycle: item.cycle,
    change1d: item.change1d,
    change5d: item.change5d,
    change20d: item.change20d
  }));
}

export async function persistMarketFlowPayload(payload: MarketFlowDashboardPayload) {
  const latest = toLatestPayload(payload);
  const marketSnapshot = toMarketFlowSnapshot(payload);
  const themeSnapshots = toThemeRotationHistorySnapshots(payload);

  await Promise.all([
    writeMarketFlowLatest(latest),
    upsertMarketFlowSnapshots([marketSnapshot]),
    upsertThemeRotationSnapshots(themeSnapshots)
  ]);

  return {
    latest,
    marketSnapshot,
    themeSnapshots
  };
}

export async function backfillMarketFlowHistory(days = 730): Promise<MarketFlowBackfillResult> {
  const startDate = getRangeStartDate(days);
  const endDate = getCurrentIsoDate(SEOUL_TIME_ZONE);

  logger.info("market-flow-backfill:start", {
    days,
    startDate,
    endDate
  });

  const [sp500Points, nasdaqPoints, us10yPoints, usdkrwPoints, kospiPoints, kosdaqPoints, tickerHistories] = await Promise.all([
    fetchYahooHistory("^GSPC", startDate),
    fetchYahooHistory("^IXIC", startDate),
    fetchYahooHistory("^TNX", startDate),
    fetchYahooHistory("KRW=X", startDate),
    fetchYahooHistory("^KS11", startDate),
    fetchYahooHistory("^KQ11", startDate),
    loadTickerHistories(days)
  ]);

  const globalHistories = {
    sp500: buildIndexedHistory(sp500Points),
    nasdaq: buildIndexedHistory(nasdaqPoints),
    us10y: buildIndexedHistory(us10yPoints),
    usdkrw: buildIndexedHistory(usdkrwPoints)
  };
  const benchmarkHistories = new Map<ThemeBenchmark, IndexedHistory>([
    ["KOSPI", buildIndexedHistory(kospiPoints)],
    ["KOSDAQ", buildIndexedHistory(kosdaqPoints)]
  ]);

  const dateCandidates = kospiPoints
    .map((point) => point.date)
    .filter((date) => date >= startDate && benchmarkHistories.get("KOSDAQ")?.indexByDate.has(date));

  const marketSnapshots: MarketFlowSnapshot[] = [];
  const themeSnapshots: ThemeRotationSnapshot[] = [];
  let skippedDateCount = 0;

  for (const date of dateCandidates) {
    const datedThemeSnapshots = buildThemeSnapshotsForDate({
      date,
      groups: themeGroups,
      tickerHistories,
      benchmarkHistories
    });

    if (!datedThemeSnapshots.length) {
      skippedDateCount += 1;
      continue;
    }

    themeSnapshots.push(...datedThemeSnapshots);

    const globalPartial = buildGlobalSnapshotForDate({
      date,
      ...globalHistories
    });
    const proxyMetrics = buildProxyMetricsForDate(date, tickerHistories);
    const localScore = buildLocalScoreForDate({
      date,
      kospi: benchmarkHistories.get("KOSPI") as IndexedHistory,
      kosdaq: benchmarkHistories.get("KOSDAQ") as IndexedHistory,
      breadthPercent: proxyMetrics.breadthPercent,
      turnoverRatio: proxyMetrics.turnoverRatio
    });

    if (!globalPartial || !localScore) {
      skippedDateCount += 1;
      continue;
    }

    const themeRotationScore = roundNumber(average(datedThemeSnapshots.map((item) => item.score)) ?? 0);
    const marketMode = resolveMarketMode(globalPartial.globalState, localScore.state);

    marketSnapshots.push({
      date,
      globalScore: globalPartial.globalScore,
      globalState: globalPartial.globalState,
      localScore: localScore.score,
      localState: localScore.state,
      themeRotationScore,
      marketMode
    });
  }

  await Promise.all([
    upsertMarketFlowSnapshots(marketSnapshots),
    upsertThemeRotationSnapshots(themeSnapshots)
  ]);

  const latestMarket = marketSnapshots.at(-1);
  if (latestMarket) {
    const topThemes = themeSnapshots
      .filter((item) => item.date === latestMarket.date)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((item) => item.label);
    const bottomThemes = themeSnapshots
      .filter((item) => item.date === latestMarket.date)
      .sort((left, right) => left.score - right.score)
      .slice(0, 3)
      .map((item) => item.label);

    await writeMarketFlowLatest({
      date: latestMarket.date,
      global: {
        score: latestMarket.globalScore,
        state: latestMarket.globalState
      },
      local: {
        score: latestMarket.localScore,
        state: latestMarket.localState
      },
      themeRotationScore: latestMarket.themeRotationScore,
      marketMode: latestMarket.marketMode,
      topThemes,
      bottomThemes,
      updatedAt: formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE)
    });
  }

  logger.info("market-flow-backfill:complete", {
    marketSnapshotCount: marketSnapshots.length,
    themeSnapshotCount: themeSnapshots.length,
    skippedDateCount,
    startDate,
    endDate
  });

  return {
    marketSnapshotCount: marketSnapshots.length,
    themeSnapshotCount: themeSnapshots.length,
    skippedDateCount,
    startDate,
    endDate
  };
}
