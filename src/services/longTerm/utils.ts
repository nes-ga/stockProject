import type { ChartPoint } from "../../types.js";

export function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function percentChange(current: number, previous?: number): number | undefined {
  if (previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

export function averageDefined(values: Array<number | undefined>): number | undefined {
  return average(values.filter((value): value is number => typeof value === "number"));
}

export function getPointHigh(point: ChartPoint): number {
  return point.high ?? point.close;
}

export function getPointLow(point: ChartPoint): number {
  return point.low ?? point.close;
}

export function getMovingAverageAt(points: ChartPoint[], endIndex: number, period: number): number | undefined {
  if (endIndex < 0 || endIndex + 1 < period) {
    return undefined;
  }

  return average(points.slice(endIndex - period + 1, endIndex + 1).map((point) => point.close));
}

export function getAverageTurnover(points: ChartPoint[]): number | undefined {
  return averageDefined(points.map((point) => (point.volume != null ? point.close * point.volume : undefined)));
}

export function computeVolumeConsistency(points: ChartPoint[]): number | undefined {
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

export function roundMetric(value?: number, digits = 2): number | undefined {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sliceRecent(points: ChartPoint[], count: number): ChartPoint[] {
  return points.slice(Math.max(0, points.length - count));
}

export function findHighest(points: ChartPoint[]): number | undefined {
  return points.length ? Math.max(...points.map((point) => getPointHigh(point))) : undefined;
}

export function findLowest(points: ChartPoint[]): number | undefined {
  return points.length ? Math.min(...points.map((point) => getPointLow(point))) : undefined;
}
