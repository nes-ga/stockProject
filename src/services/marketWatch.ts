import { formatDateInTimeZone, formatDateTimeInTimeZone, getCurrentIsoDate, SEOUL_TIME_ZONE } from "../lib/dates.js";
import { readJson } from "../lib/http.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type { ChartPoint, MarketOperationEvent, MarketWatchChartWindow, MarketWatchSnapshot } from "../types.js";
import { getMarketOperationEvents } from "./marketOperationEvents.js";

type ChartResponse = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        exchangeTimezoneName?: string;
        previousClose?: number;
        regularMarketPrice?: number;
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

type SupportedMarketWatchKey = "KOSPI" | "KOSDAQ" | "USDKRW" | "GOLD" | "WTI" | "BTC";

type MarketWatchDefinition = {
  key: SupportedMarketWatchKey;
  name: string;
  symbol: string;
  category: "index" | "fx" | "commodity" | "crypto";
  source?: "naver" | "yahoo";
  naverSymbol?: string;
};

type NaverIntradayChartRecord = {
  localDateTime?: string;
  currentPrice?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  accumulatedTradingVolume?: number;
};

type NaverIndexIntradayTimeframe = "minute1" | "minute5" | "minute30" | "minute60";

type NaverIndexIntradayInterval = {
  timeframe: NaverIndexIntradayTimeframe;
  interval: "minute" | "minute5" | "minute30" | "minute60";
};

const requestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/"
};
const naverRequestHeaders = {
  "User-Agent": "Mozilla/5.0",
  "Referer": "https://finance.naver.com/"
};

const cacheTtlMs = 2 * 1000;
const NAVER_INDEX_INTRADAY_LOOKBACK_DAYS = 10;
const naverIndexIntradayIntervals = [
  { timeframe: "minute1", interval: "minute" },
  { timeframe: "minute5", interval: "minute5" },
  { timeframe: "minute30", interval: "minute30" },
  { timeframe: "minute60", interval: "minute60" }
] satisfies NaverIndexIntradayInterval[];
const logger = createLogger("marketWatch");
const marketWatchDefinitions: MarketWatchDefinition[] = [
  { key: "KOSPI", name: "KOSPI", symbol: "^KS11", category: "index", source: "naver", naverSymbol: "KOSPI" },
  { key: "KOSDAQ", name: "KOSDAQ", symbol: "^KQ11", category: "index", source: "naver", naverSymbol: "KOSDAQ" },
  { key: "USDKRW", name: "USD/KRW", symbol: "KRW=X", category: "fx" },
  { key: "GOLD", name: "Gold", symbol: "GC=F", category: "commodity" },
  { key: "WTI", name: "WTI", symbol: "CL=F", category: "commodity" },
  { key: "BTC", name: "Bitcoin", symbol: "BTC-USD", category: "crypto" }
];

let cachedPayload:
  | {
      fetchedAt: string;
      expiresAt: number;
      items: MarketWatchSnapshot[];
      events: MarketOperationEvent[];
    }
  | null = null;

function getLatestPoint(points: ChartPoint[]) {
  return points.at(-1);
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveLatestDate(dailyPoints: ChartPoint[], intradayPoints: ChartPoint[]) {
  const dailyLatestDate = getLatestPoint(dailyPoints)?.date;
  const intradayLatestDate = getLatestPoint(intradayPoints)?.date;

  if (!dailyLatestDate) {
    return intradayLatestDate;
  }

  if (!intradayLatestDate) {
    return dailyLatestDate;
  }

  return intradayLatestDate > dailyLatestDate ? intradayLatestDate : dailyLatestDate;
}

function resolveLatestDateWithCandidate(dailyPoints: ChartPoint[], intradayPoints: ChartPoint[], latestDateCandidate?: string) {
  const fallback = resolveLatestDate(dailyPoints, intradayPoints);
  if (!latestDateCandidate) {
    return fallback;
  }
  if (!fallback) {
    return latestDateCandidate;
  }
  return latestDateCandidate > fallback ? latestDateCandidate : fallback;
}

function resolvePreviousClose(params: {
  definition: MarketWatchDefinition;
  latestDate?: string;
  intradayPreviousClose?: number;
  dailyPreviousClose?: number;
  previousDailyClose?: number;
}) {
  const { definition, latestDate, intradayPreviousClose, dailyPreviousClose, previousDailyClose } = params;
  const today = getCurrentIsoDate(SEOUL_TIME_ZONE);
  const usingTodaySnapshot = latestDate === today;

  // Yahoo's 1d chart meta has lagged for KOSPI/KOSDAQ, so prefer intraday meta when available.
  if (isFiniteNumber(intradayPreviousClose)) {
    return {
      previousClose: intradayPreviousClose,
      source: "intraday-chart-meta" as const
    };
  }

  if (isFiniteNumber(dailyPreviousClose) && (!usingTodaySnapshot || definition.category !== "index")) {
    return {
      previousClose: dailyPreviousClose,
      source: "daily-chart-meta" as const
    };
  }

  if (isFiniteNumber(previousDailyClose)) {
    return {
      previousClose: previousDailyClose,
      source: "daily-chart-series" as const
    };
  }

  return {
    previousClose: undefined,
    source: "unavailable" as const
  };
}

function buildChartPoints(chartPayload: ChartResponse): ChartPoint[] {
  const result = chartPayload.chart.result?.[0];
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

function parseNaverChartXml(xml: string): ChartPoint[] {
  const itemRegex = /<item[^>]+data="([^"]+)"/g;
  const points: ChartPoint[] = [];

  for (const match of xml.matchAll(itemRegex)) {
    const raw = match[1];
    const [date, open, high, low, close, volume] = raw.split("|");
    if (!date || !close) {
      continue;
    }

    points.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume ? Number(volume) : undefined
    });
  }

  return points;
}

function formatNaverDateTime(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

function parseNaverIntradayChartRecords(records: NaverIntradayChartRecord[]): ChartPoint[] {
  return records
    .filter((record) => record.localDateTime && typeof record.currentPrice === "number")
    .map((record) => ({
      date: formatNaverDateTime(record.localDateTime ?? ""),
      open: record.openPrice,
      high: record.highPrice,
      low: record.lowPrice,
      close: record.currentPrice ?? 0,
      volume: record.accumulatedTradingVolume
    }));
}

function buildChartWindow(points: ChartPoint[]): MarketWatchChartWindow | undefined {
  if (!points.length) {
    return undefined;
  }

  return {
    startDate: points[0].date,
    endDate: points.at(-1)?.date ?? points[0].date,
    points
  };
}

function percentChange(current?: number, previous?: number): number | undefined {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function buildLatestSessionPointFromIntraday(
  points: ChartPoint[],
  latestPrice?: number,
  latestDateOverride?: string
): ChartPoint | undefined {
  const latestDate = getLatestPoint(points)?.date;
  if (!latestDate) {
    return undefined;
  }

  const sessionPoints = points.filter((point) => point.date === latestDate);
  if (!sessionPoints.length) {
    return undefined;
  }

  const firstPoint = sessionPoints[0];
  const lastPoint = sessionPoints.at(-1) ?? firstPoint;
  let high = firstPoint.high ?? firstPoint.close;
  let low = firstPoint.low ?? firstPoint.close;
  let volume = 0;

  for (const point of sessionPoints) {
    high = Math.max(high, point.high ?? point.close);
    low = Math.min(low, point.low ?? point.close);
    volume += point.volume ?? 0;
  }

  return {
    date: latestDateOverride || latestDate,
    open: firstPoint.open ?? firstPoint.close,
    high,
    low,
    close: isFiniteNumber(latestPrice) ? latestPrice : lastPoint.close,
    volume
  };
}

function upsertLatestDailyPoint(dailyPoints: ChartPoint[], latestSessionPoint?: ChartPoint): ChartPoint[] {
  if (!latestSessionPoint) {
    return dailyPoints;
  }

  if (!dailyPoints.length) {
    return [latestSessionPoint];
  }

  const nextPoints = [...dailyPoints];
  const lastDailyPoint = nextPoints.at(-1);
  if (!lastDailyPoint) {
    return [latestSessionPoint];
  }

  if (lastDailyPoint.date === latestSessionPoint.date) {
    nextPoints[nextPoints.length - 1] = latestSessionPoint;
    return nextPoints;
  }

  if (lastDailyPoint.date < latestSessionPoint.date) {
    nextPoints.push(latestSessionPoint);
  }

  return nextPoints;
}

function aggregateYearlyPoints(points: ChartPoint[]): ChartPoint[] {
  const yearlyMap = new Map<string, ChartPoint>();

  for (const point of points) {
    const year = point.date.slice(0, 4);
    const existing = yearlyMap.get(year);
    if (!existing) {
      yearlyMap.set(year, {
        date: point.date,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close,
        volume: point.volume ?? 0
      });
      continue;
    }

    existing.date = point.date;
    existing.high = Math.max(existing.high ?? existing.close, point.high ?? point.close);
    existing.low = Math.min(existing.low ?? existing.close, point.low ?? point.close);
    existing.close = point.close;
    existing.volume = (existing.volume ?? 0) + (point.volume ?? 0);
  }

  return [...yearlyMap.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function getWeekKey(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function aggregateWeeklyPoints(points: ChartPoint[]): ChartPoint[] {
  const weeklyMap = new Map<string, ChartPoint>();

  for (const point of points) {
    const key = getWeekKey(point.date);
    const existing = weeklyMap.get(key);
    if (!existing) {
      weeklyMap.set(key, {
        date: point.date,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close,
        volume: point.volume ?? 0
      });
      continue;
    }

    existing.date = point.date;
    existing.high = Math.max(existing.high ?? existing.close, point.high ?? point.close);
    existing.low = Math.min(existing.low ?? existing.close, point.low ?? point.close);
    existing.close = point.close;
    existing.volume = (existing.volume ?? 0) + (point.volume ?? 0);
  }

  return [...weeklyMap.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchChartPoints(symbol: string, interval: string, range: string) {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  chartUrl.searchParams.set("interval", interval);
  chartUrl.searchParams.set("range", range);

  const chartPayload = await fetch(chartUrl, { headers: requestHeaders }).then((response) => readJson<ChartResponse>(response));

  return {
    meta: chartPayload.chart.result?.[0]?.meta,
    points: buildChartPoints(chartPayload),
    latestTimestamp: chartPayload.chart.result?.[0]?.timestamp?.at(-1)
  };
}

async function fetchNaverChartPoints(symbol: string, count: number) {
  const url = new URL("https://fchart.stock.naver.com/sise.nhn");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(count));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, { headers: naverRequestHeaders });
  if (!response.ok) {
    throw new Error(`Naver chart request failed with status ${response.status} for ${symbol}`);
  }

  const xml = await response.text();
  return parseNaverChartXml(xml);
}

async function fetchNaverIndexIntradayPoints(symbol: string, interval: NaverIndexIntradayInterval["interval"]) {
  const now = new Date();
  const start = new Date(now.getTime() - NAVER_INDEX_INTRADAY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const startDate = formatDateInTimeZone(start, SEOUL_TIME_ZONE).replaceAll("-", "");
  const endDate = formatDateInTimeZone(now, SEOUL_TIME_ZONE).replaceAll("-", "");
  const url = new URL(`https://api.stock.naver.com/chart/domestic/index/${symbol}/${interval}`);
  url.searchParams.set("startDateTime", `${startDate}0900`);
  url.searchParams.set("endDateTime", `${endDate}1600`);

  const response = await fetch(url, {
    headers: {
      ...naverRequestHeaders,
      "Referer": `https://m.stock.naver.com/fchart/domestic/index/${symbol}`
    }
  });
  if (!response.ok) {
    throw new Error(`Naver intraday chart request failed with status ${response.status} for ${symbol}`);
  }

  return parseNaverIntradayChartRecords((await readJson<NaverIntradayChartRecord[]>(response)) ?? []);
}

async function fetchNaverIndexIntradayChartSets(symbol: string): Promise<Partial<Record<NaverIndexIntradayTimeframe, MarketWatchChartWindow>>> {
  const entries = await Promise.all(
    naverIndexIntradayIntervals.map(async (definition) => {
      const points = await fetchNaverIndexIntradayPoints(symbol, definition.interval);
      return [definition.timeframe, buildChartWindow(points)] as const;
    })
  );

  return Object.fromEntries(entries.filter(([, window]) => window != null));
}

async function fetchNaverIndexMarketWatchItem(definition: MarketWatchDefinition): Promise<MarketWatchSnapshot> {
  const naverSymbol = definition.naverSymbol;
  if (!naverSymbol) {
    throw new Error(`Missing Naver symbol for ${definition.key}`);
  }

  const [dailyPoints, intradayChartSets] = await Promise.all([
    fetchNaverChartPoints(naverSymbol, 5200),
    fetchNaverIndexIntradayChartSets(naverSymbol).catch((error) => {
      logger.warn("item:intraday-load:failed", {
        key: definition.key,
        symbol: naverSymbol,
        ...toErrorContext(error)
      });
      return {} as Partial<Record<NaverIndexIntradayTimeframe, MarketWatchChartWindow>>;
    })
  ]);
  if (!dailyPoints.length) {
    throw new Error(`${definition.name} chart data is unavailable.`);
  }

  const latestPoint = getLatestPoint(dailyPoints);
  const latestIntradayPoint =
    getLatestPoint(intradayChartSets.minute1?.points ?? []) ??
    getLatestPoint(intradayChartSets.minute5?.points ?? []) ??
    getLatestPoint(intradayChartSets.minute30?.points ?? []) ??
    getLatestPoint(intradayChartSets.minute60?.points ?? []);
  const previousPoint = dailyPoints.at(-2);
  const weeklyPoints = aggregateWeeklyPoints(dailyPoints);
  const yearlyPoints = aggregateYearlyPoints(dailyPoints);
  const hasFreshIntradayPoint =
    latestIntradayPoint != null && latestPoint?.date != null && latestIntradayPoint.date.slice(0, 10) >= latestPoint.date;
  const displayPoint = hasFreshIntradayPoint ? latestIntradayPoint : latestPoint;

  const snapshot = {
    key: definition.key,
    name: definition.name,
    symbol: definition.symbol,
    category: definition.category,
    price: displayPoint?.close,
    previousClose: previousPoint?.close,
    changeAmount: displayPoint && previousPoint ? displayPoint.close - previousPoint.close : undefined,
    changePercent: displayPoint && previousPoint ? percentChange(displayPoint.close, previousPoint.close) : undefined,
    latestDate: displayPoint?.date,
    chartSets: {
      ...intradayChartSets,
      daily: buildChartWindow(dailyPoints),
      weekly: buildChartWindow(weeklyPoints),
      yearly: buildChartWindow(yearlyPoints)
    }
  } satisfies MarketWatchSnapshot;

  logger.info("item:load:success", {
    key: definition.key,
    symbol: definition.symbol,
    source: "naver",
    latestDate: snapshot.latestDate,
    price: snapshot.price,
    changePercent: snapshot.changePercent,
    previousClose: snapshot.previousClose
  });

  return snapshot;
}

async function fetchMarketWatchItem(definition: MarketWatchDefinition): Promise<MarketWatchSnapshot> {
  logger.info("item:load:start", {
    key: definition.key,
    symbol: definition.symbol,
    name: definition.name
  });

  if (definition.source === "naver") {
    return fetchNaverIndexMarketWatchItem(definition);
  }

  const [intradayPayload, dailyPayload, weeklyPayload, monthlyPayload] = await Promise.all([
    fetchChartPoints(definition.symbol, "1m", "5d"),
    fetchChartPoints(definition.symbol, "1d", "1y"),
    fetchChartPoints(definition.symbol, "1wk", "5y"),
    fetchChartPoints(definition.symbol, "1mo", "20y")
  ]);

  const exchangeTimeZone =
    intradayPayload.meta?.exchangeTimezoneName ??
    dailyPayload.meta?.exchangeTimezoneName ??
    weeklyPayload.meta?.exchangeTimezoneName ??
    monthlyPayload.meta?.exchangeTimezoneName;
  const intradayPoints = intradayPayload.points;
  const rawDailyPoints = dailyPayload.points;
  const rawWeeklyPoints = weeklyPayload.points;
  const rawMonthlyPoints = monthlyPayload.points;
  const latestIntradaySeoulDate =
    typeof intradayPayload.latestTimestamp === "number"
      ? formatDateInTimeZone(new Date(intradayPayload.latestTimestamp * 1000), SEOUL_TIME_ZONE)
      : undefined;
  const resolvedLatestPrice =
    intradayPayload.meta?.regularMarketPrice ?? dailyPayload.meta?.regularMarketPrice ?? getLatestPoint(rawDailyPoints)?.close;
  const latestIntradaySessionPoint = buildLatestSessionPointFromIntraday(
    intradayPoints,
    resolvedLatestPrice,
    definition.category === "index" ? undefined : latestIntradaySeoulDate
  );
  const mergedDailyPoints = upsertLatestDailyPoint(rawDailyPoints, latestIntradaySessionPoint);
  const chartDailyPoints = mergedDailyPoints;
  const chartWeeklyPoints = definition.category === "crypto" ? aggregateWeeklyPoints(chartDailyPoints) : rawWeeklyPoints;
  const chartMonthlyPoints = rawMonthlyPoints;
  const chartYearlyPoints = aggregateYearlyPoints(chartMonthlyPoints);
  const latestDisplayPoint = getLatestPoint(chartDailyPoints);
  const previousDisplayPoint = chartDailyPoints.at(-2);
  const latestDailyPoint = getLatestPoint(rawDailyPoints);
  const previousDailyPoint = rawDailyPoints.at(-2);
  const price = latestDisplayPoint?.close ?? resolvedLatestPrice;
  const latestDate = resolveLatestDateWithCandidate(
    rawDailyPoints,
    intradayPoints,
    definition.category === "index" ? undefined : latestIntradaySeoulDate
  );
  const intradayPreviousClose = intradayPayload.meta?.previousClose;
  const dailyMetaPreviousClose = dailyPayload.meta?.previousClose;
  const previousCloseResolution = resolvePreviousClose({
    definition,
    latestDate,
    intradayPreviousClose,
    dailyPreviousClose: dailyMetaPreviousClose,
    previousDailyClose: previousDailyPoint?.close
  });
  const previousClose = previousCloseResolution.previousClose;
  const today = getCurrentIsoDate(SEOUL_TIME_ZONE);
  const dailyLatestDate = latestDailyPoint?.date;
  const intradayLatestDate = getLatestPoint(intradayPoints)?.date;
  const isDailySeriesLagging = definition.category === "index" && dailyLatestDate != null && dailyLatestDate < today;

  if (price == null || !rawDailyPoints.length) {
    throw new Error(`${definition.name} chart data is unavailable.`);
  }
  if (
    isFiniteNumber(intradayPreviousClose) &&
    isFiniteNumber(previousDisplayPoint?.close) &&
    Math.abs(intradayPreviousClose - previousDisplayPoint.close) >= 0.01
  ) {
    logger.warn("item:previous-close:mismatch", {
      key: definition.key,
      latestDate,
      intradayPreviousClose,
      dailyPreviousClose: dailyMetaPreviousClose,
      previousDailyClose: previousDailyPoint?.close,
      previousDisplayClose: previousDisplayPoint.close
    });
  }

  const snapshot = {
    key: definition.key,
    name: definition.name,
    symbol: definition.symbol,
    category: definition.category,
    price,
    previousClose,
    changeAmount: previousClose != null ? price - previousClose : undefined,
    changePercent: percentChange(price, previousClose),
    latestDate,
    chartSets: {
      daily: buildChartWindow(chartDailyPoints),
      weekly: buildChartWindow(chartWeeklyPoints),
      yearly: buildChartWindow(chartYearlyPoints)
    }
  } satisfies MarketWatchSnapshot;

  logger.info("item:load:success", {
    key: definition.key,
    latestDate,
    price,
    changePercent: snapshot.changePercent,
    previousClose,
    previousCloseSource: previousCloseResolution.source,
    laggingDailySeries: isDailySeriesLagging,
    dailyLatestDate,
    intradayLatestDate
  });

  return snapshot;
}

export async function getMarketWatchSnapshots() {
  if (cachedPayload && cachedPayload.expiresAt > Date.now()) {
    logger.info("snapshot:cache-hit", {
      count: cachedPayload.items.length,
      fetchedAt: cachedPayload.fetchedAt
    });
    return {
      fetchedAt: cachedPayload.fetchedAt,
      count: cachedPayload.items.length,
      items: cachedPayload.items,
      events: cachedPayload.events
    };
  }

  logger.info("snapshot:cache-miss", {
    symbols: marketWatchDefinitions.map((definition) => definition.symbol).join(",")
  });
  const settled = await Promise.allSettled(marketWatchDefinitions.map((definition) => fetchMarketWatchItem(definition)));

  const items = settled.map((result, index) => {
    const definition = marketWatchDefinitions[index];
    if (result.status === "fulfilled") {
      return result.value;
    }

    logger.error("item:load:failed", {
      key: definition.key,
      symbol: definition.symbol,
      ...toErrorContext(result.reason)
    });

    return {
      key: definition.key,
      name: definition.name,
      symbol: definition.symbol,
      category: definition.category,
      error: result.reason instanceof Error ? result.reason.message : "Failed to load market watch data."
    } satisfies MarketWatchSnapshot;
  });

  const marketOperationEvents = await getMarketOperationEvents();
  const fetchedAt = formatDateTimeInTimeZone(new Date(), SEOUL_TIME_ZONE);
  cachedPayload = {
    fetchedAt,
    expiresAt: Date.now() + cacheTtlMs,
    items,
    events: marketOperationEvents.events
  };

  logger.info("snapshot:ready", {
    count: items.length,
    eventCount: marketOperationEvents.events.length,
    errors: items.filter((item) => item.error).length,
    fetchedAt
  });

  return {
    fetchedAt,
    count: items.length,
    items,
    events: marketOperationEvents.events
  };
}
