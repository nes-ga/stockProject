import type { LongTermMetricSnapshot } from "./metrics.js";
import type { LongTermScanFilters } from "../../types.js";
import { clamp } from "./utils.js";

export type LongTermCorrectionContext = {
  drawdownPct?: number;
  reference: "52w" | "2y" | "5y";
  usesLongCycleSupplement: boolean;
};

function resolveDrawdownMagnitudeScore(drawdownPct: number | undefined, filters: LongTermScanFilters): number {
  const absoluteDrawdown = Math.abs(drawdownPct ?? 0);
  if (absoluteDrawdown >= filters.deepDrawdownPct + 15) {
    return 88;
  }
  if (absoluteDrawdown >= filters.deepDrawdownPct) {
    return 80;
  }
  if (absoluteDrawdown >= filters.strongDrawdownPct) {
    return 70;
  }
  if (absoluteDrawdown >= filters.minimumDrawdownPct) {
    return 56;
  }
  if (absoluteDrawdown >= 15) {
    return 34;
  }
  return 16;
}

function resolvePrimaryCorrectionContext(metrics: LongTermMetricSnapshot): LongTermCorrectionContext {
  if (metrics.drawdown2yPct != null) {
    return {
      drawdownPct: metrics.drawdown2yPct,
      reference: "2y",
      usesLongCycleSupplement: false
    };
  }

  return {
    drawdownPct: metrics.drawdown52wPct,
    reference: "52w",
    usesLongCycleSupplement: false
  };
}

export function resolveLongTermCorrectionContext(
  metrics: LongTermMetricSnapshot,
  filters: LongTermScanFilters
): LongTermCorrectionContext {
  const primary = resolvePrimaryCorrectionContext(metrics);
  const primaryMagnitude = Math.abs(primary.drawdownPct ?? 0);
  const longCycleMagnitude = Math.abs(metrics.drawdown5yPct ?? 0);
  const recoveredEnough = (metrics.baseStructure.distanceFromLowPct ?? 0) >= filters.longCycleRecoveryThresholdPct;
  const baseNotFresh = metrics.baseStructure.daysSinceLastLowBreak > Math.floor(filters.lowBreakPenaltyDays / 2);

  if (primaryMagnitude >= filters.minimumDrawdownPct) {
    return primary;
  }

  if (
    longCycleMagnitude >= filters.longCycleSupplementDrawdownPct &&
    recoveredEnough &&
    baseNotFresh
  ) {
    return {
      drawdownPct: metrics.drawdown5yPct,
      reference: "5y",
      usesLongCycleSupplement: true
    };
  }

  return primary;
}

export function hasMeaningfulCorrection(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): boolean {
  const context = resolveLongTermCorrectionContext(metrics, filters);
  return Math.abs(context.drawdownPct ?? 0) >= filters.minimumDrawdownPct;
}

export function calculateCorrectionScore(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters): number {
  const context = resolveLongTermCorrectionContext(metrics, filters);
  const magnitudeScore = resolveDrawdownMagnitudeScore(context.drawdownPct, filters);
  let reboundAdjustment = 0;

  if ((metrics.baseStructure.distanceFromLowPct ?? 0) < 3) {
    reboundAdjustment -= 18;
  } else if ((metrics.baseStructure.distanceFromLowPct ?? 0) < 8) {
    reboundAdjustment -= 6;
  } else if ((metrics.baseStructure.distanceFromLowPct ?? 0) <= 25) {
    reboundAdjustment += 12;
  } else if ((metrics.baseStructure.distanceFromLowPct ?? 0) <= 45) {
    reboundAdjustment += 6;
  } else {
    reboundAdjustment -= 6;
  }

  if ((metrics.drawdown52wPct ?? 0) > -filters.nearHighPenaltyPct) {
    reboundAdjustment -= 18;
  }

  if ((metrics.structure.priceVsMA120Pct ?? 0) > filters.overextendedVsMa120Pct) {
    reboundAdjustment -= 10;
  }

  if (context.usesLongCycleSupplement) {
    // 5-year drawdown is only a supporting lens, so keep a small discount versus a clean 2-year correction.
    reboundAdjustment -= 4;
  }

  return clamp(Math.round(magnitudeScore + reboundAdjustment), 0, 100);
}
