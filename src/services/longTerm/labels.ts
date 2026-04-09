import type { LongTermMetricSnapshot } from "./metrics.js";
import type {
  LongTermCandidateGroup,
  LongTermFinancialSnapshot,
  LongTermScanFilters,
  LongTermScanLabel,
  LongTermScoreBreakdown
} from "../../types.js";

function describeSlope(metrics: LongTermMetricSnapshot): string {
  const ma120Slope = metrics.structure.ma120Slope ?? 0;
  const ma240Slope = metrics.structure.ma240Slope ?? 0;

  if (ma240Slope < 0) {
    return ma120Slope >= 0 ? "MA120 turning up but MA240 still down" : "MA120 and MA240 still weak";
  }
  if (ma120Slope >= 1) {
    return "MA120 turning upward";
  }
  if (ma120Slope >= -0.5) {
    return "MA120 flattening";
  }
  return "MA120 still falling";
}

function describeStabilization(metrics: LongTermMetricSnapshot): string {
  if (metrics.baseStructure.isStabilizing) {
    return "higher lows forming";
  }
  if (metrics.baseStructure.daysSinceLastLowBreak <= 8) {
    return "recent low break still fresh";
  }
  if (metrics.baseStructure.higherLowCount >= 2) {
    return "base forming but still incomplete";
  }
  return "base not formed yet";
}

function describeFinancialState(financials?: LongTermFinancialSnapshot): string | undefined {
  if (!financials) {
    return undefined;
  }

  if (financials.earningsState === "persistent_loss") {
    return financials.financialMomentum === "stabilizing"
      ? "persistent losses but stabilizing"
      : "persistent losses still deteriorating";
  }

  if (financials.earningsState === "temporary_loss") {
    return financials.financialMomentum === "improving"
      ? "temporary loss improving"
      : financials.financialMomentum === "stabilizing"
        ? "temporary loss stabilizing"
        : "temporary loss still weak";
  }

  if (financials.operatingProfitTrend === "improving" || financials.netIncomeTrend === "improving") {
    return "profit trend improving";
  }

  if (financials.revenueTrend === "cyclical_downturn" || financials.operatingProfitTrend === "cyclical_downturn") {
    return financials.financialMomentum === "deteriorating"
      ? "cyclical downturn still weak"
      : "cyclical downturn stabilizing";
  }

  return "profitable and structurally intact";
}

export function classifyLongTermLabel(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  financials?: LongTermFinancialSnapshot
): LongTermScanLabel {
  if (scores.stabilizationScore < 40 || scores.trendScore < 30 || scores.financialScore < 35) {
    return "needs more stabilization";
  }

  if (
    scores.correctionScore >= 78 &&
    (scores.stabilizationScore < 55 || !metrics.baseStructure.isStabilizing || scores.financialScore < 55)
  ) {
    return "deep value review";
  }

  if (
    metrics.baseStructure.isStabilizing &&
    scores.stabilizationScore >= 65 &&
    scores.trendScore >= 50 &&
    scores.financialScore >= 55 &&
    financials?.financialMomentum !== "deteriorating"
  ) {
    return "base-forming candidate";
  }

  return "leader correction watch";
}

export function classifyLongTermCandidateGroup(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  label: LongTermScanLabel,
  filters: LongTermScanFilters,
  financials?: LongTermFinancialSnapshot
): LongTermCandidateGroup {
  const priceVsMa120Pct = metrics.structure.priceVsMA120Pct ?? 0;
  const ma120Slope = metrics.structure.ma120Slope ?? 0;
  const ma240Slope = metrics.structure.ma240Slope ?? 0;
  const inReviewRange = priceVsMa120Pct >= -8 && priceVsMa120Pct <= Math.min(10, filters.overextendedVsMa120Pct - 5);
  const noFreshLowBreak = metrics.baseStructure.daysSinceLastLowBreak > filters.lowBreakPenaltyDays;
  const hasConstructiveBase = metrics.baseStructure.higherLowCount >= 2;
  const constructiveTrend = scores.trendScore >= 55 && ma120Slope >= -0.5 && ma240Slope >= -0.5;
  const stableEnough = scores.stabilizationScore >= 55;
  const financiallyAcceptable =
    scores.financialScore >= 55 &&
    financials?.earningsState !== "persistent_loss" &&
    financials?.financialMomentum !== "deteriorating";
  const scoreQualified = scores.totalScore >= 70;

  if (
    label !== "deep value review" &&
    label !== "needs more stabilization" &&
    scoreQualified &&
    constructiveTrend &&
    stableEnough &&
    financiallyAcceptable &&
    hasConstructiveBase &&
    noFreshLowBreak &&
    inReviewRange
  ) {
    return "buy candidate";
  }

  return "watch candidate";
}

export function buildLongTermReasonSummary(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  financials?: LongTermFinancialSnapshot,
  correctionContext?: {
    drawdownPct?: number;
    reference: "52w" | "2y" | "5y";
    usesLongCycleSupplement: boolean;
  }
): string {
  const resolvedDrawdownPct = correctionContext?.drawdownPct ?? metrics.drawdownPct;
  const resolvedReference = correctionContext?.reference ?? "2y";
  const drawdownText =
    resolvedDrawdownPct == null
      ? "drawdown unavailable"
      : `${Math.abs(resolvedDrawdownPct).toFixed(0)}% below ${resolvedReference} high${correctionContext?.usesLongCycleSupplement ? " (5y supplement)" : ""}`;
  const financialText = describeFinancialState(financials);
  const slopeText = describeSlope(metrics);
  const stabilizationText = describeStabilization(metrics);
  const penalties: string[] = [];

  if ((metrics.drawdown52wPct ?? 0) > -10) {
    penalties.push("near 52w high");
  }
  if ((metrics.structure.priceVsMA120Pct ?? 0) > 15) {
    penalties.push("overextended above MA120");
  }
  if (scores.trendScore < 35) {
    penalties.push("trend still weak");
  }
  if ((financials?.structuralRiskFlags.length ?? 0) > 0) {
    penalties.push(financials!.structuralRiskFlags.slice(0, 2).join(", "));
  }

  return [drawdownText, financialText, slopeText, stabilizationText, penalties.length ? `penalty: ${penalties.join(", ")}` : undefined]
    .filter(Boolean)
    .join(", ");
}
