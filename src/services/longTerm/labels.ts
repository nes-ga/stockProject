import type { LongTermMetricSnapshot } from "./metrics.js";
import type {
  LongTermCandidateGroup,
  LongTermCandidateType,
  LongTermFinancialSnapshot,
  LongTermScanFilters,
  LongTermScanLabel,
  LongTermScoreBreakdown,
  LongTermStageExplanation,
  LongTermWatchTag
} from "../../types.js";

type LongTermClassificationOptions = {
  allowBuy?: boolean;
  secondaryRecovery?: boolean;
  isCurated?: boolean;
  candidateType?: LongTermCandidateType;
  requiredCorrectionPct?: number;
};

export type LongTermBuyReadiness = {
  canBuy: boolean;
  canAccumulate: boolean;
  candidateGroup: LongTermCandidateGroup;
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
  const candidateType = options?.candidateType ?? "deep_value";
  const requiredCorrectionPct = options?.requiredCorrectionPct ?? filters.strongDrawdownPct;
  const absoluteDrawdown = Math.abs(metrics.drawdownPct ?? 0);
  const priceVsMa120Pct = metrics.structure.priceVsMA120Pct ?? 0;
  const ma120Slope = metrics.structure.ma120Slope ?? 0;
  const ma240Slope = metrics.structure.ma240Slope ?? 0;
  const higherLowQualityScore = metrics.baseStructure.higherLowQualityScore ?? 0;
  const baseDurationDays = metrics.baseStructure.baseDurationDays ?? metrics.baseDurationDays ?? 0;
  const inReviewRange = priceVsMa120Pct >= -8 && priceVsMa120Pct <= Math.min(10, filters.overextendedVsMa120Pct - 5);
  const noFreshLowBreak = metrics.baseStructure.daysSinceLastLowBreak > filters.lowBreakPenaltyDays;
  const hasConstructiveBase = metrics.baseStructure.higherLowCount >= 2;
  const constructiveTrend = scores.trendScore >= 55 && ma120Slope >= -0.5 && ma240Slope >= -0.5;
  const trendNotBroken = scores.trendScore >= 42 && ma240Slope > -3 && (metrics.structure.priceVsMA240Pct ?? 0) >= -filters.farBelowMa240Pct;
  const stableEnough = scores.stabilizationScore >= 55;
  const higherLowQualityReady = higherLowQualityScore >= filters.higherLowQualityBuyFloor;
  const baseEmerging =
    baseDurationDays >= filters.minimumBaseDays || metrics.baseStructure.higherLowCount >= 1 || higherLowQualityScore >= 45;
  const longBaseReady = baseDurationDays >= Math.max(filters.minimumBaseDays * 2, 30);
  const typeCorrectionReady = absoluteDrawdown >= requiredCorrectionPct;
  const strongCorrectionReady = absoluteDrawdown >= Math.max(requiredCorrectionPct, filters.strongDrawdownPct);
  const financiallyAcceptable =
    scores.financialScore >= 55 &&
    financials?.earningsState !== "persistent_loss" &&
    financials?.financialMomentum !== "deteriorating" &&
    financials?.debtState !== "dangerous";
  const accumulationFinancialFloor =
    scores.financialScore >= (candidateType === "turnaround" ? 48 : candidateType === "leader" ? 56 : 52) &&
    !(financials?.earningsState === "persistent_loss" && financials?.financialMomentum === "deteriorating") &&
    financials?.debtState !== "dangerous";
  const scoreQualified = scores.totalScore >= filters.buyScoreMin;
  const accumulateScoreQualified = scores.totalScore >= filters.accumulateScoreMin;
  const noImmediateLowBreak = metrics.baseStructure.daysSinceLastLowBreak > Math.floor(filters.lowBreakPenaltyDays / 2);
  const higherTimeframeSupport =
    (metrics.higherTimeframe?.score ?? 0) >= 10 ||
    ((metrics.higherTimeframe?.weeklyTrendScore ?? 0) >= 70 && (metrics.higherTimeframe?.monthlyCycleScore ?? 0) >= 65);
  const contrarianAccumulationBuy =
    options?.isCurated === true &&
    strongCorrectionReady &&
    scores.totalScore >= filters.buyScoreMin &&
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

  const buyCorrectionReady =
    candidateType === "leader"
      ? absoluteDrawdown >= Math.max(requiredCorrectionPct + 5, 25)
      : candidateType === "quality"
        ? absoluteDrawdown >= Math.max(requiredCorrectionPct + 5, 30)
        : absoluteDrawdown >= requiredCorrectionPct + 5;
  const standardBuy =
    scoreQualified &&
    buyCorrectionReady &&
    financiallyAcceptable &&
    constructiveTrend &&
    stableEnough &&
    higherLowQualityReady &&
    noFreshLowBreak &&
    (candidateType === "leader" ? baseDurationDays >= 20 : longBaseReady) &&
    (label === "base-forming candidate" || label === "leader correction watch");

  const accumulateCandidate =
    !options?.secondaryRecovery &&
    accumulateScoreQualified &&
    typeCorrectionReady &&
    accumulationFinancialFloor &&
    trendNotBroken &&
    noImmediateLowBreak &&
    baseEmerging &&
    priceVsMa120Pct <= filters.overextendedVsMa120Pct &&
    (candidateType === "leader" ||
      candidateType === "quality" ||
      scores.stabilizationScore >= 45 ||
      financials?.financialMomentum === "improving");

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

  if (!buyCorrectionReady) {
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
  const canBuy = (options?.allowBuy ?? true) && (standardBuy || isContrarianBuy);
  const canAccumulate = !canBuy && accumulateCandidate;
  return {
    canBuy,
    canAccumulate,
    candidateGroup: canBuy ? "buy candidate" : canAccumulate ? "accumulate candidate" : "watch candidate",
    failureReasons: canBuy ? [] : [...new Set(failureReasons)],
    tags: canBuy
      ? isContrarianBuy
        ? ["buy_contrarian_accumulation"]
        : []
      : canAccumulate
        ? ["accumulate_candidate", ...watchTags]
        : [...watchTags]
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
  return evaluateLongTermBuyReadiness(scores, metrics, label, filters, financials, options).candidateGroup;
}

function buildStageFactor(label: string, score: number | undefined, tone: "positive" | "caution" | "negative") {
  return { label, score, tone };
}

export function buildLongTermStageExplanation(
  scores: LongTermScoreBreakdown,
  metrics: LongTermMetricSnapshot,
  label: LongTermScanLabel,
  filters: LongTermScanFilters,
  financials: LongTermFinancialSnapshot | undefined,
  candidateGroup: LongTermCandidateGroup,
  options?: LongTermClassificationOptions
): LongTermStageExplanation {
  const requiredCorrectionPct = options?.requiredCorrectionPct ?? filters.strongDrawdownPct;
  const drawdown = Math.abs(metrics.drawdownPct ?? 0);
  const factors: LongTermStageExplanation["factors"] = [];

  factors.push(
    buildStageFactor(
      drawdown >= requiredCorrectionPct
        ? `${Math.round(drawdown)}% 조정으로 유형별 할인 기준 통과`
        : `낙폭 ${Math.round(drawdown)}%로 유형별 할인 기준(${requiredCorrectionPct}%) 미달`,
      scores.correctionScore,
      drawdown >= requiredCorrectionPct ? "positive" : "caution"
    )
  );

  factors.push(
    buildStageFactor(
      scores.trendScore >= 55
        ? "장기 추세가 회복 구간에 있음"
        : scores.trendScore >= 42
          ? "장기 추세는 훼손보다 관찰 가능한 수준"
          : "장기 추세 확인이 부족함",
      scores.trendScore,
      scores.trendScore >= 55 ? "positive" : scores.trendScore >= 42 ? "caution" : "negative"
    )
  );

  factors.push(
    buildStageFactor(
      metrics.baseStructure.isStabilizing
        ? "Base 안정화 확인"
        : metrics.baseStructure.higherLowCount >= 1
          ? "저점 높임은 보이나 Base 확인은 진행 중"
          : "Base 형성이 아직 부족함",
      scores.stabilizationScore,
      metrics.baseStructure.isStabilizing ? "positive" : metrics.baseStructure.higherLowCount >= 1 ? "caution" : "negative"
    )
  );

  factors.push(
    buildStageFactor(
      scores.financialScore >= 70
        ? "재무 품질 우수"
        : scores.financialScore >= 55
          ? "재무는 허용 범위"
          : "재무 회복 확인 필요",
      scores.financialScore,
      scores.financialScore >= 70 ? "positive" : scores.financialScore >= 55 ? "caution" : "negative"
    )
  );

  factors.push(
    buildStageFactor(
      scores.liquidityScore >= 60 ? "거래대금과 거래량 안정성 양호" : "유동성은 보수적으로 확인 필요",
      scores.liquidityScore,
      scores.liquidityScore >= 60 ? "positive" : "caution"
    )
  );

  if (scores.volumeProfileScore != null) {
    factors.push(
      buildStageFactor(
        scores.volumeProfileScore >= 10
          ? "장기 매물대가 보유 품질을 지지"
          : scores.volumeProfileScore < 0
            ? "장기 매물대 부담 존재"
            : "장기 매물대 영향은 중립",
        scores.volumeProfileScore,
        scores.volumeProfileScore >= 10 ? "positive" : scores.volumeProfileScore < 0 ? "negative" : "caution"
      )
    );
  }

  const stage =
    candidateGroup === "buy candidate" ? "buy" : candidateGroup === "accumulate candidate" ? "accumulate" : "watch";
  const summary =
    stage === "buy"
      ? "본격 매수 검토가 가능한 수준으로 할인, 재무, 추세, 안정화 조건이 함께 충족됐습니다."
      : stage === "accumulate"
        ? "분할매수 검토는 가능하지만 Base 또는 추세 확인이 아직 완전하지 않습니다."
        : label === "leader correction watch"
          ? "기업 품질은 볼 만하지만 할인 폭 또는 진입 안정화가 아직 부족합니다."
          : "장기 관찰 가치는 있으나 매수 전 확인해야 할 조건이 남아 있습니다.";

  return {
    stage,
    summary,
    factors
  };
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
