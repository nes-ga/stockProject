import type { LongTermMetricSnapshot } from "./metrics.js";
import type {
  LongTermCandidateGroup,
  LongTermFinancialSnapshot,
  LongTermScanFilters,
  LongTermScanLabel,
  LongTermScoreBreakdown,
  LongTermWatchTag
} from "../../types.js";

type LongTermClassificationOptions = {
  allowBuy?: boolean;
  secondaryRecovery?: boolean;
  isCurated?: boolean;
};

export type LongTermBuyReadiness = {
  canBuy: boolean;
  failureReasons: string[];
  tags: LongTermWatchTag[];
};

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
    return `base stabilizing over ${metrics.baseStructure.baseDurationDays} sessions`;
  }
  if ((metrics.baseStructure.daysSincePeak ?? 999) <= 35 && (metrics.baseStructure.distanceFromLowPct ?? 0) >= 10) {
    return "short V-shaped rebound still needs time";
  }
  if ((metrics.baseStructure.higherLowQualityScore ?? 0) >= 50) {
    return "higher lows forming but confirmation incomplete";
  }
  if (metrics.baseStructure.daysSinceLastLowBreak <= 8) {
    return "recent low break still fresh";
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

  if (financials.strongRevenueDecline) {
    return "revenue decline still strong";
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
  const higherLowQualityScore = metrics.baseStructure.higherLowQualityScore ?? 0;

  if (scores.stabilizationScore < 42 || scores.trendScore < 30 || scores.financialScore < 35) {
    return "needs more stabilization";
  }

  if (
    scores.correctionScore >= 78 &&
    (scores.stabilizationScore < 58 ||
      !metrics.baseStructure.isStabilizing ||
      higherLowQualityScore < 55 ||
      scores.financialScore < 55)
  ) {
    return "deep value review";
  }

  if (
    metrics.baseStructure.isStabilizing &&
    higherLowQualityScore >= 60 &&
    scores.stabilizationScore >= 65 &&
    scores.trendScore >= 50 &&
    scores.financialScore >= 55 &&
    financials?.financialMomentum !== "deteriorating"
  ) {
    return "base-forming candidate";
  }

  return "leader correction watch";
}

export function evaluateLongTermBuyReadiness(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  label: LongTermScanLabel,
  filters: LongTermScanFilters,
  financials?: LongTermFinancialSnapshot,
  options?: LongTermClassificationOptions
): LongTermBuyReadiness {
  const failureReasons: string[] = [];
  const watchTags = new Set<LongTermWatchTag>();
  const priceVsMa120Pct = metrics.structure.priceVsMA120Pct ?? 0;
  const ma120Slope = metrics.structure.ma120Slope ?? 0;
  const ma240Slope = metrics.structure.ma240Slope ?? 0;
  const higherLowQualityScore = metrics.baseStructure.higherLowQualityScore ?? 0;
  const baseDurationDays = metrics.baseStructure.baseDurationDays ?? metrics.baseDurationDays ?? 0;
  const inReviewRange = priceVsMa120Pct >= -8 && priceVsMa120Pct <= Math.min(10, filters.overextendedVsMa120Pct - 5);
  const noFreshLowBreak = metrics.baseStructure.daysSinceLastLowBreak > filters.lowBreakPenaltyDays;
  const hasConstructiveBase = metrics.baseStructure.higherLowCount >= 2;
  const constructiveTrend = scores.trendScore >= 55 && ma120Slope >= -0.5 && ma240Slope >= -0.5;
  const stableEnough = scores.stabilizationScore >= 55;
  const higherLowQualityReady = higherLowQualityScore >= filters.higherLowQualityBuyFloor;
  const longBaseReady = baseDurationDays >= Math.max(filters.minimumBaseDays * 2, 30);
  const strongCorrectionReady = Math.abs(metrics.drawdownPct ?? 0) >= filters.strongDrawdownPct;
  const financiallyAcceptable =
    scores.financialScore >= 55 &&
    financials?.earningsState !== "persistent_loss" &&
    financials?.financialMomentum !== "deteriorating" &&
    financials?.debtState !== "dangerous";
  const scoreQualified = scores.totalScore >= 70;
  const higherTimeframeSupport =
    (metrics.higherTimeframe?.score ?? 0) >= 10 ||
    ((metrics.higherTimeframe?.weeklyTrendScore ?? 0) >= 70 && (metrics.higherTimeframe?.monthlyCycleScore ?? 0) >= 65);
  const contrarianAccumulationBuy =
    options?.isCurated === true &&
    strongCorrectionReady &&
    scoreQualified &&
    scores.leaderScore >= 80 &&
    scores.financialScore >= 70 &&
    scores.liquidityScore >= 60 &&
    scores.trendScore >= 55 &&
    financiallyAcceptable &&
    higherTimeframeSupport &&
    hasConstructiveBase &&
    higherLowQualityReady &&
    longBaseReady &&
    priceVsMa120Pct >= -18 &&
    priceVsMa120Pct <= 8 &&
    (metrics.baseStructure.distanceFromLowPct ?? 100) <= 8;

  if (label === "deep value review") {
    failureReasons.push("label_deep_value_review");
    watchTags.add("watch_deep_value");
  } else if (label === "needs more stabilization") {
    failureReasons.push("label_needs_more_stabilization");
    watchTags.add("watch_needs_stabilization");
  } else if (label === "leader correction watch") {
    watchTags.add("watch_leader_correction");
  }

  if (!scoreQualified) {
    failureReasons.push("totalScore_low");
  }

  if (!strongCorrectionReady) {
    failureReasons.push("correction_not_deep_enough_for_buy");
    watchTags.add("watch_leader_correction");
  }

  if (!constructiveTrend) {
    failureReasons.push("trend_not_constructive");
    watchTags.add("watch_trend_not_confirmed");
  }

  if (!inReviewRange) {
    failureReasons.push("price_outside_review_range");
    watchTags.add("watch_trend_not_confirmed");
  }

  if (!noFreshLowBreak) {
    failureReasons.push("recent_low_break_fresh");
    watchTags.add("watch_needs_stabilization");
  }

  if (!hasConstructiveBase) {
    failureReasons.push("higher_low_count_insufficient");
    watchTags.add("watch_needs_stabilization");
  }

  if (!higherLowQualityReady) {
    failureReasons.push("higher_low_quality_low");
    watchTags.add("watch_needs_stabilization");
  }

  if (!longBaseReady) {
    failureReasons.push("base_duration_short");
    watchTags.add("watch_needs_stabilization");
  }

  if (!stableEnough) {
    failureReasons.push("stabilizationScore_low");
    watchTags.add("watch_needs_stabilization");
  }

  if (!financiallyAcceptable || financials?.businessClarity === "unclear" || financials?.strongRevenueDecline) {
    failureReasons.push("financial_repair_needed");
    watchTags.add("watch_financial_repair");
  }

  if (options?.secondaryRecovery) {
    failureReasons.push("secondary_recovery_watch_only");
    watchTags.add("watch_secondary_recovery");
  }

  const contrarianAllowedFailures = new Set([
    "label_needs_more_stabilization",
    "price_outside_review_range",
    "recent_low_break_fresh",
    "stabilizationScore_low"
  ]);
  const contrarianFailureOnly = failureReasons.every((reason) => contrarianAllowedFailures.has(reason));
  const isContrarianBuy = contrarianAccumulationBuy && contrarianFailureOnly;
  const canBuy = (options?.allowBuy ?? true) && (failureReasons.length === 0 || isContrarianBuy);
  return {
    canBuy,
    failureReasons: canBuy ? [] : [...new Set(failureReasons)],
    tags: canBuy ? (isContrarianBuy ? ["buy_contrarian_accumulation"] : []) : [...watchTags]
  };
}

export function classifyLongTermCandidateGroup(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  label: LongTermScanLabel,
  filters: LongTermScanFilters,
  financials?: LongTermFinancialSnapshot,
  options?: LongTermClassificationOptions
): LongTermCandidateGroup {
  return evaluateLongTermBuyReadiness(scores, metrics, label, filters, financials, options).canBuy
    ? "buy candidate"
    : "watch candidate";
}

export function buildLongTermExplainability(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  label: LongTermScanLabel,
  filters: LongTermScanFilters,
  financials?: LongTermFinancialSnapshot,
  options?: LongTermClassificationOptions
) {
  const readiness = evaluateLongTermBuyReadiness(scores, metrics, label, filters, financials, options);
  const strengths = new Set<string>();
  const weaknesses = new Set<string>();
  const isContrarianBuy = readiness.tags.includes("buy_contrarian_accumulation");

  if (scores.correctionScore >= 78 || Math.abs(metrics.drawdownPct ?? 0) >= filters.strongDrawdownPct) {
    strengths.add("deep_correction");
  }
  if ((metrics.baseStructure.baseDurationDays ?? 0) >= filters.longBaseRewardStartDays) {
    strengths.add("long_consolidation");
  }
  if ((metrics.baseStructure.higherLowQualityScore ?? 0) >= 60) {
    strengths.add("constructive_higher_lows");
  }
  if ((metrics.liquidity.accumulationSignal ?? 0) >= 60) {
    strengths.add("accumulation_support");
  }
  if ((metrics.structure.ma120Slope ?? 0) >= 0.5 || scores.trendScore >= 60) {
    strengths.add("trend_improving");
  }
  if ((metrics.higherTimeframe?.weeklyTrendScore ?? 0) >= 65 || (metrics.higherTimeframe?.monthlyCycleScore ?? 0) >= 65) {
    strengths.add("higher_timeframe_support");
  }
  if (isContrarianBuy) {
    strengths.add("contrarian_accumulation_buy");
  }
  if (
    scores.financialScore >= 60 &&
    financials?.financialMomentum !== "deteriorating" &&
    financials?.earningsState !== "persistent_loss"
  ) {
    strengths.add("financial_stable");
  }
  if (scores.leaderScore >= 74) {
    strengths.add("leader_quality");
  }

  if ((metrics.baseStructure.daysSincePeak ?? 999) <= filters.vShapePenaltyPeakDays && (metrics.baseStructure.baseDurationDays ?? 0) < filters.minimumBaseDays) {
    weaknesses.add("v_shaped_correction");
  }
  if ((metrics.baseStructure.baseDurationDays ?? 0) < Math.max(filters.minimumBaseDays * 2, 30)) {
    weaknesses.add("base_too_short");
  }
  if ((metrics.baseStructure.higherLowQualityScore ?? 0) < filters.higherLowQualityBuyFloor) {
    weaknesses.add("higher_low_quality_weak");
  }
  if (scores.trendScore < 55 || (metrics.structure.ma120Slope ?? 0) < -0.5 || (metrics.structure.ma240Slope ?? 0) < -0.5) {
    weaknesses.add("trend_not_confirmed");
  }
  if ((metrics.higherTimeframe?.score ?? 0) < -5) {
    weaknesses.add("higher_timeframe_weak");
  }
  if ((metrics.structure.priceVsMA120Pct ?? 0) > Math.min(10, filters.overextendedVsMa120Pct - 5)) {
    weaknesses.add("price_extended");
  }
  if (
    scores.financialScore < 55 ||
    financials?.financialMomentum === "deteriorating" ||
    financials?.earningsState === "persistent_loss" ||
    financials?.businessClarity === "unclear" ||
    financials?.strongRevenueDecline
  ) {
    weaknesses.add("financial_repair_needed");
  }
  if (options?.secondaryRecovery) {
    weaknesses.add("secondary_recovery_watch_only");
  }
  if (label === "deep value review") {
    weaknesses.add("deep_value_requires_more_confirmation");
  }
  if (label === "leader correction watch") {
    weaknesses.add("leader_correction_still_early");
  }

  return {
    strengths: [...strengths],
    weaknesses: [...weaknesses],
    failureReasons: readiness.failureReasons,
    tags: readiness.tags
  };
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
  if ((metrics.baseStructure.daysSincePeak ?? 999) <= 35 && (metrics.baseStructure.baseDurationDays ?? 0) < 20) {
    penalties.push("V-shape risk");
  }
  if ((metrics.baseStructure.higherLowQualityScore ?? 0) < 45) {
    penalties.push("higher-low quality weak");
  }
  if (scores.trendScore < 35) {
    penalties.push("trend still weak");
  }
  if ((financials?.structuralRiskFlags.length ?? 0) > 0) {
    penalties.push(financials!.structuralRiskFlags.slice(0, 2).join(", "));
  }

  const timeText = `base ${metrics.baseStructure.baseDurationDays}d / peak ${metrics.baseStructure.daysSincePeak ?? "-"}d / HLQ ${Math.round(
    metrics.baseStructure.higherLowQualityScore ?? 0
  )}`;
  const accumulationText =
    metrics.liquidity.accumulationSignal != null ? `accumulation ${Math.round(metrics.liquidity.accumulationSignal)}` : undefined;
  const higherTimeframeText = metrics.higherTimeframe
    ? `weekly ${metrics.higherTimeframe.weeklyTrendScore} / monthly ${metrics.higherTimeframe.monthlyCycleScore}`
    : undefined;

  return [
    drawdownText,
    financialText,
    slopeText,
    stabilizationText,
    timeText,
    accumulationText,
    higherTimeframeText,
    penalties.length ? `penalty: ${penalties.join(", ")}` : undefined
  ]
    .filter(Boolean)
    .join(", ");
}
