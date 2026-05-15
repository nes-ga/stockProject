import { createLogger, toErrorContext } from "../../lib/logger.js";
import type { ChartPoint, MarketWatchSnapshot, SmartMoneyMarketContext } from "../../types.js";
import { getMarketWatchSnapshots } from "../marketWatch.js";
import { average, clamp, percentChange } from "./utils.js";

const logger = createLogger("smartMoneyMarketContext");
const AUTO_MARKET_CONTEXT_TTL_MS = 60 * 1000;

let cachedAutoMarketContext:
  | {
      expiresAt: number;
      value?: SmartMoneyMarketContext;
    }
  | null = null;
let autoMarketContextPromise: Promise<SmartMoneyMarketContext | undefined> | null = null;

function getMovingAverage(points: ChartPoint[], period: number): number | undefined {
  if (points.length < period) {
    return undefined;
  }

  return average(points.slice(-period).map((point) => point.close));
}

function getPriorClose(points: ChartPoint[], sessionsAgo: number): number | undefined {
  const index = points.length - 1 - sessionsAgo;
  return index >= 0 ? points[index]?.close : undefined;
}

function deriveSnapshotTrend(snapshot?: MarketWatchSnapshot) {
  if (!snapshot) {
    return null;
  }

  const points = snapshot.chartSets?.daily?.points ?? [];
  const latestPoint = points.at(-1);
  if (!latestPoint) {
    return null;
  }

  const sma20 = getMovingAverage(points, 20);
  const sma50 = getMovingAverage(points, 50);
  const change20d = percentChange(latestPoint.close, getPriorClose(points, 20));
  const aboveSma20 = sma20 == null ? undefined : latestPoint.close >= sma20;
  const aboveSma50 = sma50 == null ? undefined : latestPoint.close >= sma50;
  const strengthScore = clamp(
    50 +
      (aboveSma20 == null ? 0 : aboveSma20 ? 12 : -12) +
      (aboveSma50 == null ? 0 : aboveSma50 ? 10 : -10) +
      (change20d == null ? 0 : change20d >= 6 ? 12 : change20d >= 0 ? 6 : change20d >= -5 ? -8 : -16),
    10,
    90
  );

  return {
    snapshot,
    latestDate: latestPoint.date,
    price: latestPoint.close,
    change20d,
    sma20,
    sma50,
    aboveSma20,
    aboveSma50,
    strengthScore,
    trend: strengthScore >= 62 ? "bullish" : strengthScore <= 38 ? "bearish" : "neutral"
  } as const;
}

function buildBenchmarkSeries(snapshot?: MarketWatchSnapshot) {
  const points = snapshot?.chartSets?.daily?.points ?? [];
  return points.slice(-260).map((point) => ({
    date: point.date,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close
  }));
}

function buildAutoSmartMoneyMarketContext(items: MarketWatchSnapshot[]): SmartMoneyMarketContext | undefined {
  const kospiSnapshot = items.find((item) => item.key === "KOSPI");
  const kosdaqSnapshot = items.find((item) => item.key === "KOSDAQ");
  const kospi = deriveSnapshotTrend(kospiSnapshot);
  const kosdaq = deriveSnapshotTrend(kosdaqSnapshot);
  const usdkrw = deriveSnapshotTrend(items.find((item) => item.key === "USDKRW"));
  const gold = deriveSnapshotTrend(items.find((item) => item.key === "GOLD"));
  const indexHealth = [kospi, kosdaq].filter((item): item is NonNullable<typeof kospi> => Boolean(item));

  if (!indexHealth.length) {
    return undefined;
  }

  const averageStrength = average(indexHealth.map((item) => item.strengthScore)) ?? 50;
  const advancingCount = indexHealth.filter((item) => item.aboveSma20).length;
  const decliningCount = Math.max(1, indexHealth.length - advancingCount);
  const advancingPercent = (advancingCount / indexHealth.length) * 100;
  const breadthScore = clamp(Math.round(averageStrength * 0.55 + advancingPercent * 0.45), 15, 85);
  const averageChange20d =
    average(indexHealth.map((item) => item.change20d).filter((value): value is number => value != null)) ?? 0;
  const momentumCondition = averageChange20d >= 4 ? "strong" : averageChange20d <= -3 ? "weak" : "neutral";
  const marketTrend = averageStrength >= 62 ? "bullish" : averageStrength <= 40 ? "bearish" : "neutral";
  const usdkrwChange20d = usdkrw?.change20d;
  const goldChange20d = gold?.change20d;
  const riskOff =
    (indexHealth.every((item) => item.aboveSma20 === false) && averageChange20d < 0) ||
    averageChange20d <= -4 ||
    ((usdkrwChange20d ?? 0) >= 2.5 && averageStrength < 52) ||
    ((goldChange20d ?? 0) >= 5 && averageStrength < 50);
  const asOfDate = [kospi?.latestDate, kosdaq?.latestDate, usdkrw?.latestDate, gold?.latestDate].find(Boolean);

  return {
    asOfDate,
    marketTrend,
    marketBreadth: {
      score: breadthScore,
      advanceDeclineRatio: advancingCount / decliningCount,
      advancingPercent
    },
    momentumCondition,
    leaderPersistenceScore: Math.round(averageStrength),
    regimeScore: Math.round(clamp(averageStrength + (riskOff ? -6 : 0), 0, 100)),
    marketContextScore: breadthScore,
    riskScore: Math.round(clamp((riskOff ? 34 : 62) + averageChange20d * 1.6, 10, 90)),
    riskOff,
    benchmark: {
      symbol: kospi?.snapshot.symbol ?? "^KS11",
      trend: kospi?.trend ?? marketTrend,
      changePercent20d: kospi?.change20d,
      aboveSma20: kospi?.aboveSma20,
      aboveSma50: kospi?.aboveSma50
    },
    benchmarkSeries: {
      KOSPI: buildBenchmarkSeries(kospiSnapshot),
      KOSDAQ: buildBenchmarkSeries(kosdaqSnapshot)
    },
    notes: [
      `Auto market context from KOSPI/KOSDAQ as of ${asOfDate ?? "-"}.`,
      `Average 20-session index change is ${averageChange20d.toFixed(1)}%.`,
      usdkrwChange20d != null ? `USD/KRW 20-session change ${usdkrwChange20d.toFixed(1)}%.` : "USD/KRW context unavailable."
    ]
  };
}

export async function getAutoSmartMoneyMarketContext() {
  // A short TTL avoids refetching index data for every symbol in a batch scan.
  if (cachedAutoMarketContext && cachedAutoMarketContext.expiresAt > Date.now()) {
    return cachedAutoMarketContext.value;
  }

  if (autoMarketContextPromise) {
    return autoMarketContextPromise;
  }

  autoMarketContextPromise = (async () => {
    try {
      const snapshots = await getMarketWatchSnapshots();
      const value = buildAutoSmartMoneyMarketContext(snapshots.items);
      cachedAutoMarketContext = {
        expiresAt: Date.now() + AUTO_MARKET_CONTEXT_TTL_MS,
        value
      };
      logger.info("auto:ready", {
        applied: Boolean(value),
        asOfDate: value?.asOfDate,
        marketTrend: value?.marketTrend,
        regimeScore: value?.regimeScore,
        riskOff: value?.riskOff
      });
      return value;
    } catch (error) {
      logger.error("auto:failed", toErrorContext(error));
      cachedAutoMarketContext = {
        expiresAt: Date.now() + 10 * 1000,
        value: undefined
      };
      return undefined;
    } finally {
      autoMarketContextPromise = null;
    }
  })();

  return autoMarketContextPromise;
}
