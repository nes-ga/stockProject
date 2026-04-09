import type { LongTermMetricSnapshot } from "./metrics.js";
import type { LongTermScanFilters } from "../../types.js";
import { clamp } from "./utils.js";

export function calculateStabilizationScore(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): number {
  let score = 10;
  const higherLowCount = metrics.baseStructure.higherLowCount;
  const daysSinceLastLowBreak = metrics.baseStructure.daysSinceLastLowBreak;
  const distanceFromLowPct = metrics.baseStructure.distanceFromLowPct ?? 0;
  const recentVolumeRatio = metrics.recentVolumeRatio ?? 1;

  if (higherLowCount >= 3) {
    score += 30;
  } else if (higherLowCount === 2) {
    score += 24;
  } else if (higherLowCount === 1) {
    score += 10;
  }

  if (daysSinceLastLowBreak >= filters.minimumBaseDays * 2) {
    score += 24;
  } else if (daysSinceLastLowBreak >= filters.minimumBaseDays) {
    score += 18;
  } else if (daysSinceLastLowBreak >= Math.floor(filters.minimumBaseDays / 2)) {
    score += 8;
  }

  if (recentVolumeRatio <= filters.coolingVolumeRatioThreshold) {
    score += 18;
  } else if (recentVolumeRatio <= 1) {
    score += 10;
  }

  if (distanceFromLowPct >= 5 && distanceFromLowPct <= 20) {
    score += 18;
  } else if (distanceFromLowPct > 20 && distanceFromLowPct <= 35) {
    score += 10;
  } else if (distanceFromLowPct < 3) {
    score -= 10;
  }

  if (daysSinceLastLowBreak <= filters.lowBreakPenaltyDays) {
    score -= 24;
  }

  if (higherLowCount === 0 && daysSinceLastLowBreak < filters.minimumBaseDays) {
    score -= 16;
  }

  return clamp(Math.round(score), 0, 100);
}
