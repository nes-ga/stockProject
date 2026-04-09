import type { LongTermMetricSnapshot } from "./metrics.js";
import type { LongTermScanFilters } from "../../types.js";
import { clamp } from "./utils.js";

export function calculateTrendScore(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): number {
  let score = 50;
  const ma120Slope = metrics.structure.ma120Slope ?? 0;
  const ma240Slope = metrics.structure.ma240Slope ?? 0;
  const priceVsMA120Pct = metrics.structure.priceVsMA120Pct ?? -100;
  const priceVsMA240Pct = metrics.structure.priceVsMA240Pct ?? -100;

  if (ma240Slope <= -4) {
    score -= 34;
  } else if (ma240Slope <= -1.5) {
    score -= 24;
  } else if (ma240Slope < 0) {
    score -= 12;
  } else if (ma240Slope >= 1.5) {
    score += 10;
  }

  if (ma120Slope <= -4) {
    score -= 24;
  } else if (ma120Slope <= -1.5) {
    score -= 14;
  } else if (ma120Slope < 0) {
    score -= 6;
  } else if (ma120Slope >= 2) {
    score += 16;
  } else if (ma120Slope >= 0.5) {
    score += 8;
  }

  if (priceVsMA120Pct > filters.overextendedVsMa120Pct) {
    score -= 18;
  } else if (priceVsMA120Pct > 8) {
    score -= 6;
  } else if (priceVsMA120Pct >= -8) {
    score += 10;
  } else if (priceVsMA120Pct >= -18) {
    score += 4;
  } else if (priceVsMA120Pct < -30) {
    score -= 16;
  }

  if (priceVsMA240Pct < -filters.farBelowMa240Pct) {
    score -= 18;
  } else if (priceVsMA240Pct >= -5 && priceVsMA240Pct <= 15) {
    score += 6;
  }

  return clamp(Math.round(score), 0, 100);
}
