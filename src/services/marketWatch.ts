import { readJson } from "../lib/http.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type { ChartPoint, MarketWatchChartWindow, MarketWatchSnapshot } from "../types.js";

type ChartResponse = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
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

type SupportedMarketWatchKey = "KOSPI" | "KOSDAQ" | "USDKRW" | "GOLD";

type MarketWatchDefinition = {
  key: SupportedMarketWatchKey;
  name: string;
  symbol: string;
  category: "index" | "fx" | "commodity";
};

const requestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/"
};

const cacheTtlMs = 2 * 1000;
const logger = createLogger("marketWatch");
const marketWatchDefinitions: MarketWatchDefinition[] = [
  { key: "KOSPI", name: "KOSPI", symbol: "^KS11", category: "index" },
  { key: "KOSDAQ", name: "KOSDAQ", symbol: "^KQ11", category: "index" },
  { key: "USDKRW", name: "USD/KRW", symbol: "KRW=X", category: "fx" },
  { key: "GOLD", name: "Gold", symbol: "GC=F", category: "commodity" }
];

let cachedPayload:
  | {
      fetchedAt: string;
      expiresAt: number;
      items: MarketWatchSnapshot[];
    }
  | null = null;

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildChartPoints(chartPayload: ChartResponse): ChartPoint[] {
  const result = chartPayload.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  const timestamps = result?.timestamp ?? [];
  const points: ChartPoint[] = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const close = quote?.close?.[index];
    if (close == null) {
      continue;
    }

    points.push({
      date: toIsoDate(new Date(timestamp * 1000)),
      open: quote?.open?.[index] ?? undefined,
      high: quote?.high?.[index] ?? undefined,
      low: quote?.low?.[index] ?? undefined,
      close,
      volume: quote?.volume?.[index] ?? undefined
    });
  }

  return points;
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

function aggregateYearlyPoints(points: ChartPoint[]): ChartPoint[] {
  const yearlyMap = new Map<string, ChartPoint>();

  for (const point of points) {
    const year = point.date.slice(0, 4);
    const existing = yearlyMap.get(year);
    if (!existing) {
      yearlyMap.set(year, {
        date: `${year}-12-31`,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close,
        volume: point.volume ?? 0
      });
      continue;
    }

    existing.high = Math.max(existing.high ?? existing.close, point.high ?? point.close);
    existing.low = Math.min(existing.low ?? existing.close, point.low ?? point.close);
    existing.close = point.close;
    existing.volume = (existing.volume ?? 0) + (point.volume ?? 0);
  }

  return [...yearlyMap.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchChartPoints(symbol: string, interval: string, range: string) {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  chartUrl.searchParams.set("interval", interval);
  chartUrl.searchParams.set("range", range);

  const chartPayload = await fetch(chartUrl, { headers: requestHeaders }).then((response) => readJson<ChartResponse>(response));

  return {
    meta: chartPayload.chart.result?.[0]?.meta,
    points: buildChartPoints(chartPayload)
  };
}

async function fetchMarketWatchItem(definition: MarketWatchDefinition): Promise<MarketWatchSnapshot> {
  logger.info("item:load:start", {
    key: definition.key,
    symbol: definition.symbol,
    name: definition.name
  });

  const [dailyPayload, weeklyPayload, monthlyPayload] = await Promise.all([
    fetchChartPoints(definition.symbol, "1d", "1y"),
    fetchChartPoints(definition.symbol, "1wk", "5y"),
    fetchChartPoints(definition.symbol, "1mo", "20y")
  ]);

  const dailyPoints = dailyPayload.points;
  const weeklyPoints = weeklyPayload.points;
  const yearlyPoints = aggregateYearlyPoints(monthlyPayload.points);
  const price = dailyPayload.meta?.regularMarketPrice ?? dailyPoints.at(-1)?.close;
  const previousClose = dailyPayload.meta?.previousClose ?? dailyPoints.at(-2)?.close;
  const latestDate = dailyPoints.at(-1)?.date;

  if (price == null || !dailyPoints.length) {
    throw new Error(`${definition.name} chart data is unavailable.`);
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
      daily: buildChartWindow(dailyPoints),
      weekly: buildChartWindow(weeklyPoints),
      yearly: buildChartWindow(yearlyPoints)
    }
  } satisfies MarketWatchSnapshot;

  logger.info("item:load:success", {
    key: definition.key,
    latestDate,
    price,
    changePercent: snapshot.changePercent
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
      items: cachedPayload.items
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

  const fetchedAt = new Date().toISOString();
  cachedPayload = {
    fetchedAt,
    expiresAt: Date.now() + cacheTtlMs,
    items
  };

  logger.info("snapshot:ready", {
    count: items.length,
    errors: items.filter((item) => item.error).length,
    fetchedAt
  });

  return {
    fetchedAt,
    count: items.length,
    items
  };
}
