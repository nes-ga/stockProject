import type { LongTermMetricSnapshot } from "./metrics.js";
import type { LongTermScanFilters } from "../../types.js";
import { clamp } from "./utils.js";

export function calculateStabilizationScore(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): number {
  let score = 10;
  const higherLowCount = metrics.baseStructure.higherLowCount;
  const higherLowQualityScore = metrics.baseStructure.higherLowQualityScore ?? 0;
  const daysSinceLastLowBreak = metrics.baseStructure.daysSinceLastLowBreak;
  const baseDurationDays = metrics.baseStructure.baseDurationDays ?? metrics.baseDurationDays ?? 0;
  const timeSinceLastMajorLow = metrics.baseStructure.timeSinceLastMajorLow ?? 0;
  const daysSincePeak = metrics.baseStructure.daysSincePeak ?? filters.longBaseRewardFullDays;
  const distanceFromLowPct = metrics.baseStructure.distanceFromLowPct ?? 0;
  const recentVolumeRatio = metrics.recentVolumeRatio ?? 1;
  const accumulationSignal = metrics.liquidity.accumulationSignal ?? 50;
  const absoluteDrawdown = Math.abs(metrics.drawdownPct ?? 0);

  if (higherLowCount >= 3) {
    score += 20;
  } else if (higherLowCount === 2) {
    score += 14;
  } else if (higherLowCount === 1) {
    score += 6;
  }

  score += Math.round((higherLowQualityScore / 100) * 24);

  if (daysSinceLastLowBreak >= filters.minimumBaseDays * 2) {
    score += 16;
  } else if (daysSinceLastLowBreak >= filters.minimumBaseDays) {
    score += 12;
  } else if (daysSinceLastLowBreak >= Math.floor(filters.minimumBaseDays / 2)) {
    score += 6;
  }

  if (baseDurationDays >= filters.longBaseRewardFullDays) {
    score += 20;
  } else if (baseDurationDays >= filters.longBaseRewardStartDays) {
    score += 14;
  } else if (baseDurationDays >= filters.minimumBaseDays * 2) {
    score += 8;
  }

  if (recentVolumeRatio <= filters.coolingVolumeRatioThreshold) {
    score += 12;
  } else if (recentVolumeRatio <= 1) {
    score += 6;
  }

  if (accumulationSignal >= 70) {
    score += 12;
  } else if (accumulationSignal >= 58) {
    score += 6;
  } else if (accumulationSignal <= 40) {
    score -= 8;
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

  if (timeSinceLastMajorLow >= filters.longBaseRewardStartDays && absoluteDrawdown >= filters.strongDrawdownPct) {
    score += 8;
  }

  if (
    daysSincePeak <= filters.vShapePenaltyPeakDays &&
    baseDurationDays < filters.minimumBaseDays &&
    distanceFromLowPct >= 10
  ) {
    score -= 14;
  }

  if (higherLowQualityScore < 35 && higherLowCount >= 2) {
    score -= 10;
  }

  if (higherLowCount === 0 && baseDurationDays < filters.minimumBaseDays) {
    score -= 16;
  }

  return clamp(Math.round(score), 0, 100);
}
