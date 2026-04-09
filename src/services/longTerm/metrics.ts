import type {
  ChartPoint,
  LongTermBaseStructure,
  LongTermLiquiditySnapshot,
  LongTermScanFilters,
  LongTermStructureSnapshot
} from "../../types.js";
import {
  averageDefined,
  computeVolumeConsistency,
  findHighest,
  findLowest,
  getMovingAverageAt,
  getPointLow,
  percentChange,
  roundMetric,
  sliceRecent
} from "./utils.js";

export type LongTermMetricSnapshot = {
  price: number;
  latestDate: string;
  high52w?: number;
  high2y?: number;
  high5y?: number;
  drawdown52wPct?: number;
  drawdown2yPct?: number;
  drawdown5yPct?: number;
  drawdownPct?: number;
  structure: LongTermStructureSnapshot;
  baseStructure: LongTermBaseStructure;
  liquidity: LongTermLiquiditySnapshot;
  baseDurationDays: number;
  recentVolumeRatio?: number;
};

type PivotLow = {
  index: number;
  value: number;
};

function findPivotLows(points: ChartPoint[], span: number): PivotLow[] {
  const pivots: PivotLow[] = [];

  for (let index = span; index < points.length - span; index += 1) {
    const low = getPointLow(points[index]);
    let isPivotLow = true;

    for (let offset = 1; offset <= span; offset += 1) {
      if (low >= getPointLow(points[index - offset]) || low >= getPointLow(points[index + offset])) {
        isPivotLow = false;
        break;
      }
    }

    if (isPivotLow) {
      pivots.push({ index, value: low });
    }
  }

  return pivots;
}

function countConsecutiveHigherLows(points: ChartPoint[], filters: LongTermScanFilters): number {
  const recent = sliceRecent(points, filters.higherLowLookbackWindow);
  const pivots = findPivotLows(recent, filters.higherLowPivotSpan);
  if (pivots.length < 2) {
    return 0;
  }

  let count = 0;
  for (let index = pivots.length - 1; index > 0; index -= 1) {
    if (pivots[index].value > pivots[index - 1].value) {
      count += 1;
      continue;
    }
    break;
  }

  return count;
}

function resolveDaysSinceLastLowBreak(points: ChartPoint[], recentWindow: number): number {
  const recent = sliceRecent(points, recentWindow);
  if (!recent.length) {
    return 0;
  }

  let runningLow = Number.POSITIVE_INFINITY;
  let lastBreakIndex = 0;

  recent.forEach((point, index) => {
    const low = getPointLow(point);
    if (low <= runningLow) {
      runningLow = low;
      lastBreakIndex = index;
    }
  });

  return recent.length - 1 - lastBreakIndex;
}

export function evaluateLongTermMetrics(points: ChartPoint[], filters: LongTermScanFilters): LongTermMetricSnapshot {
  const latestPoint = points.at(-1);
  if (!latestPoint) {
    throw new Error("Long-term metrics require at least one chart point.");
  }

  const lastIndex = points.length - 1;
  const price = latestPoint.close;
  const points52w = sliceRecent(points, 252);
  const points2y = sliceRecent(points, 504);
  const points5y = sliceRecent(points, 1260);
  const high52w = findHighest(points52w);
  const high2y = findHighest(points2y);
  const high5y = findHighest(points5y);
  const ma60 = getMovingAverageAt(points, lastIndex, 60);
  const ma120 = getMovingAverageAt(points, lastIndex, 120);
  const ma240 = getMovingAverageAt(points, lastIndex, 240);
  const ma120Past = getMovingAverageAt(points, lastIndex - filters.slopeLookbackSessions, 120);
  const ma240Past = getMovingAverageAt(points, lastIndex - filters.slopeLookbackSessions, 240);
  const ma120Slope = ma120 != null && ma120Past != null ? percentChange(ma120, ma120Past) : undefined;
  const ma240Slope = ma240 != null && ma240Past != null ? percentChange(ma240, ma240Past) : undefined;
  const priceVsMA120Pct = ma120 != null ? percentChange(price, ma120) : undefined;
  const priceVsMA240Pct = ma240 != null ? percentChange(price, ma240) : undefined;

  const recentBasePoints = sliceRecent(points, filters.recentBaseWindow);
  const recentLow = findLowest(recentBasePoints);
  const distanceFromLowPct = recentLow != null ? percentChange(price, recentLow) : undefined;
  const daysSinceLastLowBreak = resolveDaysSinceLastLowBreak(points, filters.recentBaseWindow);
  const higherLowCount = countConsecutiveHigherLows(points, filters);
  const recentVolume20 = averageDefined(sliceRecent(points, 20).map((point) => point.volume));
  const recentVolume5 = averageDefined(sliceRecent(points, 5).map((point) => point.volume));
  const recentVolumeRatio =
    recentVolume5 != null && recentVolume20 != null && recentVolume20 > 0 ? recentVolume5 / recentVolume20 : undefined;
  const baseDurationDays = daysSinceLastLowBreak;
  const isStabilizing =
    higherLowCount >= 2 &&
    daysSinceLastLowBreak >= filters.minimumBaseDays &&
    (recentVolumeRatio == null || recentVolumeRatio <= filters.coolingVolumeRatioThreshold) &&
    (distanceFromLowPct ?? 0) >= 5;

  const avgTurnover20 = averageDefined(sliceRecent(points, 20).map((point) => (point.volume != null ? point.close * point.volume : undefined)));
  const avgTurnover60 = averageDefined(sliceRecent(points, 60).map((point) => (point.volume != null ? point.close * point.volume : undefined)));
  const volumeConsistency = computeVolumeConsistency(sliceRecent(points, 60));
  const drawdown52wPct = high52w != null ? percentChange(price, high52w) : undefined;
  const drawdown2yPct = high2y != null ? percentChange(price, high2y) : undefined;
  const drawdown5yPct = high5y != null ? percentChange(price, high5y) : undefined;

  return {
    price,
    latestDate: latestPoint.date,
    high52w: roundMetric(high52w, 2),
    high2y: roundMetric(high2y, 2),
    high5y: roundMetric(high5y, 2),
    drawdown52wPct: roundMetric(drawdown52wPct, 2),
    drawdown2yPct: roundMetric(drawdown2yPct, 2),
    drawdown5yPct: roundMetric(drawdown5yPct, 2),
    drawdownPct: roundMetric(drawdown2yPct ?? drawdown52wPct, 2),
    structure: {
      ma60: roundMetric(ma60, 2),
      ma120: roundMetric(ma120, 2),
      ma240: roundMetric(ma240, 2),
      ma120Slope: roundMetric(ma120Slope, 2),
      ma240Slope: roundMetric(ma240Slope, 2),
      priceVsMA120Pct: roundMetric(priceVsMA120Pct, 2),
      priceVsMA240Pct: roundMetric(priceVsMA240Pct, 2)
    },
    baseStructure: {
      recentLow: roundMetric(recentLow, 2),
      distanceFromLowPct: roundMetric(distanceFromLowPct, 2),
      higherLowCount,
      daysSinceLastLowBreak,
      isStabilizing
    },
    liquidity: {
      avgTurnover20: roundMetric(avgTurnover20, 0),
      avgTurnover60: roundMetric(avgTurnover60, 0),
      volumeConsistency: roundMetric(volumeConsistency, 2)
    },
    baseDurationDays,
    recentVolumeRatio: roundMetric(recentVolumeRatio, 2)
  };
}
