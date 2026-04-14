import type {
  ChartPoint,
  LongTermBaseStructure,
  LongTermLiquiditySnapshot,
  LongTermScanFilters,
  LongTermStructureSnapshot
} from "../types.js";

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function averageDefined(values: Array<number | undefined>): number | undefined {
  return average(values.filter((value): value is number => typeof value === "number"));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentChange(current: number, previous?: number): number | undefined {
  if (previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function getPointHigh(point: ChartPoint): number {
  return point.high ?? point.close;
}

function getPointLow(point: ChartPoint): number {
  return point.low ?? point.close;
}

function getMovingAverageAt(points: ChartPoint[], endIndex: number, period: number): number | undefined {
  if (endIndex < 0 || endIndex + 1 < period) {
    return undefined;
  }

  return average(points.slice(endIndex - period + 1, endIndex + 1).map((point) => point.close));
}

function computeVolumeConsistency(points: ChartPoint[]): number | undefined {
  const volumes = points.map((point) => point.volume).filter((value): value is number => typeof value === "number" && value > 0);
  if (volumes.length < 5) {
    return undefined;
  }

  const mean = average(volumes);
  if (mean == null || mean <= 0) {
    return undefined;
  }

  const variance = average(volumes.map((value) => (value - mean) ** 2)) ?? 0;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = standardDeviation / mean;
  return clamp(Math.round((1 - Math.min(coefficientOfVariation, 1.2) / 1.2) * 100), 0, 100);
}

function roundMetric(value?: number, digits = 2): number | undefined {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sliceRecent(points: ChartPoint[], count: number): ChartPoint[] {
  return points.slice(Math.max(0, points.length - count));
}

function findHighest(points: ChartPoint[]): number | undefined {
  return points.length ? Math.max(...points.map((point) => getPointHigh(point))) : undefined;
}

function findLowest(points: ChartPoint[]): number | undefined {
  return points.length ? Math.min(...points.map((point) => getPointLow(point))) : undefined;
}

type PivotLow = {
  index: number;
  value: number;
};

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

function findHighestIndex(points: ChartPoint[]): number | undefined {
  if (!points.length) {
    return undefined;
  }

  let highestIndex = 0;
  let highestValue = getPointHigh(points[0]);
  for (let index = 1; index < points.length; index += 1) {
    const nextValue = getPointHigh(points[index]);
    if (nextValue >= highestValue) {
      highestValue = nextValue;
      highestIndex = index;
    }
  }

  return highestIndex;
}

function findLowestIndex(points: ChartPoint[]): number | undefined {
  if (!points.length) {
    return undefined;
  }

  let lowestIndex = 0;
  let lowestValue = getPointLow(points[0]);
  for (let index = 1; index < points.length; index += 1) {
    const nextValue = getPointLow(points[index]);
    if (nextValue <= lowestValue) {
      lowestValue = nextValue;
      lowestIndex = index;
    }
  }

  return lowestIndex;
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

function resolveHigherLowSequence(pivots: PivotLow[]): PivotLow[] {
  if (!pivots.length) {
    return [];
  }

  const sequence = [pivots[pivots.length - 1]];
  for (let index = pivots.length - 2; index >= 0; index -= 1) {
    if (sequence[0].value > pivots[index].value) {
      sequence.unshift(pivots[index]);
      continue;
    }
    break;
  }

  return sequence;
}

function scoreSpacing(avgSpacing: number | undefined): number {
  if (avgSpacing == null) {
    return 0;
  }
  if (avgSpacing >= 10 && avgSpacing <= 35) {
    return 28;
  }
  if (avgSpacing >= 6 && avgSpacing <= 45) {
    return 20;
  }
  if (avgSpacing >= 4) {
    return 10;
  }
  return 2;
}

function scoreSlope(avgSlopePct: number | undefined): number {
  if (avgSlopePct == null || avgSlopePct <= 0) {
    return 0;
  }
  if (avgSlopePct >= 3 && avgSlopePct <= 18) {
    return 26;
  }
  if (avgSlopePct >= 1.5 && avgSlopePct <= 24) {
    return 20;
  }
  if (avgSlopePct < 1.5) {
    return 10;
  }
  return 12;
}

function scoreRebound(avgReboundPct: number | undefined): number {
  if (avgReboundPct == null) {
    return 0;
  }
  if (avgReboundPct >= 6 && avgReboundPct <= 25) {
    return 26;
  }
  if (avgReboundPct >= 3) {
    return 18;
  }
  if (avgReboundPct > 0) {
    return 8;
  }
  return 0;
}

function evaluateHigherLowQuality(points: ChartPoint[], filters: LongTermScanFilters) {
  const recent = sliceRecent(points, filters.higherLowLookbackWindow);
  const pivots = findPivotLows(recent, filters.higherLowPivotSpan);
  const sequence = resolveHigherLowSequence(pivots);

  if (sequence.length < 2) {
    return {
      higherLowQualityScore: 0,
      baseStartIndex: undefined as number | undefined
    };
  }

  const spacingValues: number[] = [];
  const slopeValues: number[] = [];
  const reboundValues: number[] = [];

  for (let index = 1; index < sequence.length; index += 1) {
    const previous = sequence[index - 1];
    const current = sequence[index];
    spacingValues.push(current.index - previous.index);
    slopeValues.push(percentChange(current.value, previous.value) ?? 0);
    const reboundHigh = findHighest(recent.slice(previous.index, current.index + 1));
    reboundValues.push(percentChange(reboundHigh ?? previous.value, previous.value) ?? 0);
  }

  const lastPivot = sequence[sequence.length - 1];
  const trailingHigh = findHighest(recent.slice(lastPivot.index));
  reboundValues.push(percentChange(trailingHigh ?? lastPivot.value, lastPivot.value) ?? 0);

  const countComponent = Math.min(24, (sequence.length - 1) * 10);
  const spacingComponent = scoreSpacing(average(spacingValues));
  const slopeComponent = scoreSlope(average(slopeValues));
  const reboundComponent = scoreRebound(average(reboundValues));

  return {
    higherLowQualityScore: clamp(Math.round(countComponent + spacingComponent + slopeComponent + reboundComponent), 0, 100),
    baseStartIndex: sequence[0]?.index
  };
}

function calculateAccumulationSignal(points: ChartPoint[], majorLowIndex: number | undefined) {
  const startIndex = majorLowIndex == null ? Math.max(0, points.length - 20) : Math.max(0, majorLowIndex);
  const postBasePoints = points.slice(startIndex);
  if (postBasePoints.length < 5) {
    return undefined;
  }

  const preBaseStartIndex = Math.max(0, startIndex - 20);
  const preBasePoints = points.slice(preBaseStartIndex, startIndex);
  const postTurnover = averageDefined(postBasePoints.map((point) => (point.volume != null ? point.close * point.volume : undefined)));
  const preTurnover = averageDefined(preBasePoints.map((point) => (point.volume != null ? point.close * point.volume : undefined)));

  let upTurnover = 0;
  let downTurnover = 0;
  let upDays = 0;
  let downDays = 0;

  for (let index = 1; index < postBasePoints.length; index += 1) {
    const point = postBasePoints[index];
    const previous = postBasePoints[index - 1];
    const turnover = point.volume != null ? point.close * point.volume : 0;
    if (point.close >= previous.close) {
      upTurnover += turnover;
      upDays += 1;
    } else {
      downTurnover += turnover;
      downDays += 1;
    }
  }

  let score = 50;
  const upAverage = upDays > 0 ? upTurnover / upDays : 0;
  const downAverage = downDays > 0 ? downTurnover / downDays : 0;

  if (upAverage > downAverage * 1.15) {
    score += 18;
  } else if (upAverage > downAverage) {
    score += 10;
  } else if (downAverage > upAverage * 1.2) {
    score -= 16;
  }

  if (postTurnover != null && preTurnover != null) {
    if (postTurnover >= preTurnover * 1.15) {
      score += 16;
    } else if (postTurnover >= preTurnover) {
      score += 8;
    } else if (postTurnover <= preTurnover * 0.8) {
      score -= 8;
    }
  }

  const returnFromStart = percentChange(postBasePoints[postBasePoints.length - 1].close, postBasePoints[0]?.close);
  if ((returnFromStart ?? 0) >= 8) {
    score += 10;
  } else if ((returnFromStart ?? 0) <= -5) {
    score -= 12;
  }

  return clamp(Math.round(score), 0, 100);
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
  const higherLowWindowPoints = sliceRecent(points, filters.higherLowLookbackWindow);
  const recentLow = findLowest(recentBasePoints);
  const distanceFromLowPct = recentLow != null ? percentChange(price, recentLow) : undefined;
  const daysSinceLastLowBreak = resolveDaysSinceLastLowBreak(points, filters.recentBaseWindow);
  const higherLowCount = countConsecutiveHigherLows(points, filters);
  const higherLowQuality = evaluateHigherLowQuality(points, filters);
  const recentVolume20 = averageDefined(sliceRecent(points, 20).map((point) => point.volume));
  const recentVolume5 = averageDefined(sliceRecent(points, 5).map((point) => point.volume));
  const recentVolumeRatio =
    recentVolume5 != null && recentVolume20 != null && recentVolume20 > 0 ? recentVolume5 / recentVolume20 : undefined;
  const majorLowWindow = sliceRecent(points, filters.majorLowLookbackWindow);
  const majorLowIndexInWindow = findLowestIndex(majorLowWindow);
  const timeSinceLastMajorLow =
    majorLowIndexInWindow == null ? daysSinceLastLowBreak : majorLowWindow.length - 1 - majorLowIndexInWindow;
  const baseDurationDays =
    higherLowQuality.baseStartIndex != null
      ? higherLowWindowPoints.length - 1 - higherLowQuality.baseStartIndex
      : timeSinceLastMajorLow;
  const peakWindow = points2y.length >= 120 ? points2y : points52w;
  const peakIndex = findHighestIndex(peakWindow);
  const daysSincePeak = peakIndex == null ? undefined : peakWindow.length - 1 - peakIndex;
  const isStabilizing =
    higherLowCount >= 2 &&
    (higherLowQuality.higherLowQualityScore ?? 0) >= 55 &&
    daysSinceLastLowBreak >= filters.minimumBaseDays &&
    baseDurationDays >= filters.minimumBaseDays &&
    (recentVolumeRatio == null || recentVolumeRatio <= filters.coolingVolumeRatioThreshold) &&
    (distanceFromLowPct ?? 0) >= 5;

  const avgTurnover20 = averageDefined(sliceRecent(points, 20).map((point) => (point.volume != null ? point.close * point.volume : undefined)));
  const avgTurnover60 = averageDefined(sliceRecent(points, 60).map((point) => (point.volume != null ? point.close * point.volume : undefined)));
  const volumeConsistency = computeVolumeConsistency(sliceRecent(points, 60));
  const accumulationSignal = calculateAccumulationSignal(points, majorLowIndexInWindow == null ? undefined : points.length - majorLowWindow.length + majorLowIndexInWindow);
  const drawdown52wPct = percentChange(price, findHighest(points52w));
  const drawdown2yPct = percentChange(price, findHighest(points2y));
  const drawdown5yPct = percentChange(price, findHighest(points5y));

  return {
    price,
    latestDate: latestPoint.date,
    high52w: roundMetric(findHighest(points52w), 2),
    high2y: roundMetric(findHighest(points2y), 2),
    high5y: roundMetric(findHighest(points5y), 2),
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
      higherLowQualityScore: roundMetric(higherLowQuality.higherLowQualityScore, 0),
      daysSinceLastLowBreak,
      daysSincePeak,
      baseDurationDays,
      timeSinceLastMajorLow,
      isStabilizing
    },
    liquidity: {
      avgTurnover20: roundMetric(avgTurnover20, 0),
      avgTurnover60: roundMetric(avgTurnover60, 0),
      volumeConsistency: roundMetric(volumeConsistency, 2),
      liquidityStability: roundMetric(volumeConsistency, 0),
      accumulationSignal: roundMetric(accumulationSignal, 0)
    },
    baseDurationDays,
    recentVolumeRatio: roundMetric(recentVolumeRatio, 2)
  };
}
