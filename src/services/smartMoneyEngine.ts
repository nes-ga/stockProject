import type {
  ChartPoint,
  SmartMoneyCandidateSummary,
  SmartMoneyDebugMeta,
  SmartMoneyMarketContext,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyPullbackType,
  SmartMoneySetupType,
  SmartMoneyRejectReason
} from "../types.js";

type SmartMoneyStage = Exclude<SmartMoneyPatternMatch["stage"], "none">;

type CandidateEvaluation = {
  match: SmartMoneyPatternMatch;
  summary: SmartMoneyCandidateSummary;
  rejectReasons: SmartMoneyRejectReason[];
};

type MarketEvaluation = {
  regimeScore: number;
  marketContextScore: number;
  actionableAllowed: boolean;
  reasons: string[];
};

type PullbackAssessment = {
  valid: boolean;
  pullbackType?: SmartMoneyPullbackType;
  setupType?: SmartMoneySetupType;
  breakoutLevel: number;
  pullbackLow: number;
  pullbackVolumeRatioToLeadIn?: number;
  pullbackRangePercent: number;
  pullbackMaxDrawdownPercent: number;
  pullbackDownSessions: number;
  rejectReasons: string[];
};

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function averageNumberSeries(values: Array<number | undefined>): number | undefined {
  return average(values.filter((value): value is number => typeof value === "number"));
}

function ratio(value?: number, base?: number): number | undefined {
  if (value == null || base == null || base === 0) {
    return undefined;
  }
  return value / base;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function percentChange(current: number, previous?: number): number | undefined {
  if (!previous || previous === 0) {
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

function getTurnoverValue(point: ChartPoint): number | undefined {
  return point.volume != null ? point.close * point.volume : undefined;
}

function getAverageVolumeBefore(points: ChartPoint[], index: number, period = 20): number | undefined {
  return averageNumberSeries(points.slice(Math.max(0, index - period), index).map((point) => point.volume));
}

function getHighestCloseBefore(points: ChartPoint[], index: number, period: number): number | undefined {
  const closes = points.slice(Math.max(0, index - period), index).map((point) => point.close);
  return closes.length ? Math.max(...closes) : undefined;
}

function getStageRank(stage: SmartMoneyPatternMatch["stage"]): number {
  return stage === "breakout" ? 2 : stage === "setup" ? 1 : 0;
}

function toSignal(score: number): SmartMoneyPatternMatch["signal"] {
  if (score >= 85) {
    return "explosive";
  }
  if (score >= 65) {
    return "strong";
  }
  return "watch";
}

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.round(value)))].sort(
    (left, right) => left - right
  );
}

export function resolveSmartMoneyPatternFilters(overrides?: Partial<SmartMoneyPatternFilters>): SmartMoneyPatternFilters {
  const defaults: SmartMoneyPatternFilters = {
    lookbackTradingDays: 15,
    lookbackWindows: [10, 15, 20, 30],
    breakoutLookbackDays: 20,
    minLeadInPriceChangePercent: 10,
    minLeadInVolumeRatio: 2.5,
    minTurnoverValue: 1_500_000_000,
    minBreakoutTurnoverValue: 2_500_000_000,
    minBreakoutPriceChangePercent: 8,
    minBreakoutVolumeRatio: 3.5,
    minPullbackSessions: 1,
    maxPullbackSessions: 30,
    minSetupPullbackSessions: 3,
    minSetupDownSessions: 2,
    minTimeCorrectionSessions: 4,
    minPullbackDrawdownPercent: 1.5,
    maxPullbackDrawdownPercent: 6.5,
    maxPullbackRangePercent: 10,
    maxSetupPullbackDrawdownPercent: 35,
    maxSetupPullbackRangePercent: 35,
    maxTimeCorrectionDrawdownPercent: 4,
    maxTimeCorrectionRangePercent: 8,
    minTimeCorrectionTightClosePercent: -5,
    maxVolatileDigestionDrawdownPercent: 30,
    maxVolatileDigestionRangePercent: 55,
    maxVolatileDigestionAvgVolumeRatio: 0.18,
    minVolatileDigestionReferenceCloseVsLeadInPercent: -20,
    minVolatileDigestionBaseAdvancePercent: 35,
    volatileDigestionSetupScoreBoost: 14,
    maxPullbackAvgVolumeRatio: 0.65,
    minPatternScore: 60,
    minSetupPatternScore: 60,
    minBreakoutPatternScore: 68,
    minSetupSurgeAdvancePercent: 15,
    minSetupContinuationSessions: 1,
    minReferenceCloseVsBasePercent: 0,
    maxSetupCloseVsPeakPercent: -1,
    minReferenceCloseVsLeadInPercent: -4,
    closeNearHighRatio: 0.985,
    breakoutHoldTolerancePercent: 2,
    maxBreakoutFailurePercent: 3.5,
    maxBreakoutExtensionPercent: 8,
    maxSetupDistanceBelowBreakoutLevelPercent: 6,
    minActionableValidityScore: 55,
    minExecutionReadinessScore: 55,
    regimeScoreWeight: 0.18,
    minRegimeScoreForActionable: 40,
    blockActionableOnRiskOff: true,
    recentSignalSessions: 2,
    debugTopCandidateLimit: 5
  };

  const merged: SmartMoneyPatternFilters = {
    ...defaults,
    ...overrides,
    lookbackWindows: uniqueSortedNumbers(
      overrides?.lookbackWindows?.length
        ? overrides.lookbackWindows
        : [...defaults.lookbackWindows, overrides?.lookbackTradingDays ?? defaults.lookbackTradingDays]
    )
  };

  if (!merged.lookbackWindows.includes(merged.lookbackTradingDays)) {
    merged.lookbackWindows = uniqueSortedNumbers([...merged.lookbackWindows, merged.lookbackTradingDays]);
  }

  merged.minBreakoutTurnoverValue = overrides?.minBreakoutTurnoverValue ?? Math.max(merged.minTurnoverValue, merged.minBreakoutTurnoverValue);
  return merged;
}

function buildEmptyMatch(referenceDate: string, windowPoints: ChartPoint[], lookbackWindowDays?: number): SmartMoneyPatternMatch {
  return {
    matched: false,
    actionable: false,
    stage: "none",
    signal: "watch",
    patternScore: 0,
    setupScore: 0,
    breakoutScore: 0,
    regimeAdjustedScore: 0,
    finalRankScore: 0,
    regimeScore: 50,
    marketContextScore: 50,
    volumeQualityScore: 0,
    breakoutStrengthScore: 0,
    breakoutFailureRiskScore: 100,
    freshnessScore: 0,
    validityScore: 0,
    executionReadinessScore: 0,
    referenceDate,
    windowStartDate: windowPoints[0]?.date,
    windowEndDate: windowPoints.at(-1)?.date,
    lookbackWindowDays,
    pullbackSessions: 0,
    breakout20d: false,
    closedNearHigh: false,
    setupType: undefined,
    reasons: ["No smart-money entry pattern was found in the selected window."],
    summary: "No smart-money entry pattern was found in the selected window."
  };
}

function scoreVolumeQuality(point: ChartPoint, averageVolume20: number | undefined, minVolumeRatio: number, minTurnoverValue: number) {
  const volumeRatio20d = ratio(point.volume, averageVolume20);
  const turnoverValue = getTurnoverValue(point);
  const relativeScore =
    volumeRatio20d == null ? 0 : volumeRatio20d >= minVolumeRatio + 2 ? 95 : volumeRatio20d >= minVolumeRatio ? 70 : volumeRatio20d >= minVolumeRatio * 0.75 ? 45 : 20;
  const absoluteScore =
    turnoverValue == null ? 0 : turnoverValue >= minTurnoverValue * 3 ? 95 : turnoverValue >= minTurnoverValue ? 68 : turnoverValue >= minTurnoverValue * 0.7 ? 42 : 15;
  return {
    volumeRatio20d,
    turnoverValue,
    volumeQualityScore: clamp(Math.round(relativeScore * 0.55 + absoluteScore * 0.45), 0, 100),
    passed: volumeRatio20d != null && volumeRatio20d >= minVolumeRatio && turnoverValue != null && turnoverValue >= minTurnoverValue
  };
}

function evaluateMarketContext(marketContext: SmartMoneyMarketContext | undefined, filters: SmartMoneyPatternFilters): MarketEvaluation {
  if (!marketContext) {
    return {
      regimeScore: 50,
      marketContextScore: 50,
      actionableAllowed: true,
      reasons: ["No market context was injected, so regime stayed neutral."]
    };
  }

  const benchmarkTrendScore =
    marketContext.benchmark?.aboveSma20 == null
      ? undefined
      : (marketContext.benchmark.aboveSma20 ? 65 : 35) + (marketContext.benchmark.aboveSma50 ? 10 : -10);
  const benchmarkChangeScore =
    marketContext.benchmark?.changePercent20d == null
      ? undefined
      : marketContext.benchmark.changePercent20d >= 8
        ? 80
        : marketContext.benchmark.changePercent20d >= 0
          ? 60
          : marketContext.benchmark.changePercent20d >= -5
            ? 40
            : 20;
  const composite = average(
    [
      marketContext.regimeScore,
      marketContext.marketContextScore,
      marketContext.trendScore,
      marketContext.riskScore,
      marketContext.sectorStrengthScore,
      marketContext.sector?.strengthScore,
      benchmarkTrendScore,
      benchmarkChangeScore
    ].filter((value): value is number => typeof value === "number")
  ) ?? 50;
  const regimeScore = clamp(Math.round(average([marketContext.regimeScore, marketContext.trendScore, composite].filter((value): value is number => typeof value === "number")) ?? composite), 0, 100);
  const marketContextScore = clamp(Math.round(average([marketContext.marketContextScore, marketContext.sectorStrengthScore, composite].filter((value): value is number => typeof value === "number")) ?? composite), 0, 100);

  return {
    regimeScore,
    marketContextScore,
    actionableAllowed: !(filters.blockActionableOnRiskOff && marketContext.riskOff) && regimeScore >= filters.minRegimeScoreForActionable,
    reasons: marketContext.notes?.slice(0, 2) ?? []
  };
}

function classifyPullback(
  leadInPoint: ChartPoint,
  surgePeakPoint: ChartPoint,
  pullbackPoints: ChartPoint[],
  referencePoint: ChartPoint,
  filters: SmartMoneyPatternFilters,
  baseClose: number
): PullbackAssessment {
  const highestHigh = Math.max(...pullbackPoints.map((point) => getPointHigh(point)));
  const lowestLow = Math.min(...pullbackPoints.map((point) => getPointLow(point)));
  const lowestClose = Math.min(...pullbackPoints.map((point) => point.close));
  const pullbackAvgVolume = averageNumberSeries(pullbackPoints.map((point) => point.volume));
  const pullbackVolumeRatioToLeadIn = ratio(pullbackAvgVolume, Math.max(leadInPoint.volume ?? 0, surgePeakPoint.volume ?? 0) || undefined);
  const pullbackMaxDrawdownPercent = Math.abs(percentChange(lowestClose, surgePeakPoint.close) ?? 0);
  const pullbackRangePercent = Math.abs(percentChange(highestHigh, lowestLow) ?? 0);
  const pullbackDownSessions = pullbackPoints.reduce((count, point, index) => count + (point.close < (index === 0 ? surgePeakPoint.close : pullbackPoints[index - 1].close) ? 1 : 0), 0);
  const referenceCloseVsPeakPercent = percentChange(referencePoint.close, surgePeakPoint.close) ?? -100;
  const referenceCloseVsLeadInPercent = percentChange(referencePoint.close, leadInPoint.close) ?? -100;
  const totalImpulseFromBasePercent = percentChange(surgePeakPoint.close, baseClose) ?? 0;
  const pricePullbackValid =
    pullbackMaxDrawdownPercent >= filters.minPullbackDrawdownPercent &&
    pullbackMaxDrawdownPercent <= filters.maxSetupPullbackDrawdownPercent &&
    pullbackRangePercent <= filters.maxSetupPullbackRangePercent &&
    pullbackDownSessions >= filters.minSetupDownSessions;
  const timeCorrectionValid =
    pullbackPoints.length >= filters.minTimeCorrectionSessions &&
    pullbackMaxDrawdownPercent <= filters.maxTimeCorrectionDrawdownPercent &&
    pullbackRangePercent <= filters.maxTimeCorrectionRangePercent &&
    referenceCloseVsPeakPercent >= filters.minTimeCorrectionTightClosePercent;
  const volatilePowerDigestionValid =
    pullbackPoints.length >= filters.minSetupPullbackSessions &&
    (pullbackVolumeRatioToLeadIn ?? Infinity) <= filters.maxVolatileDigestionAvgVolumeRatio &&
    pullbackMaxDrawdownPercent <= filters.maxVolatileDigestionDrawdownPercent &&
    pullbackRangePercent <= filters.maxVolatileDigestionRangePercent &&
    referenceCloseVsLeadInPercent >= filters.minVolatileDigestionReferenceCloseVsLeadInPercent &&
    totalImpulseFromBasePercent >= filters.minVolatileDigestionBaseAdvancePercent;
  const rejectReasons: string[] = [];
  const volumeContractionThreshold = volatilePowerDigestionValid
    ? Math.min(filters.maxPullbackAvgVolumeRatio, filters.maxVolatileDigestionAvgVolumeRatio)
    : filters.maxPullbackAvgVolumeRatio;
  if (pullbackVolumeRatioToLeadIn == null || pullbackVolumeRatioToLeadIn > volumeContractionThreshold) {
    rejectReasons.push("Pullback volume did not contract enough.");
  }
  if (!pricePullbackValid && !timeCorrectionValid && !volatilePowerDigestionValid) {
    rejectReasons.push("Consolidation was neither a clean price pullback, a tight time correction, nor a volatile power digestion.");
  }

  const setupType = pricePullbackValid
    ? "tight_price_pullback"
    : timeCorrectionValid
      ? "time_correction"
      : volatilePowerDigestionValid
        ? "volatile_power_digestion"
        : undefined;

  return {
    valid: rejectReasons.length === 0,
    pullbackType:
      setupType === "time_correction"
        ? "time_correction"
        : setupType === "volatile_power_digestion" || setupType === "tight_price_pullback"
          ? "price_pullback"
          : undefined,
    setupType,
    breakoutLevel: Math.max(getPointHigh(surgePeakPoint), highestHigh),
    pullbackLow: lowestLow,
    pullbackVolumeRatioToLeadIn,
    pullbackRangePercent,
    pullbackMaxDrawdownPercent,
    pullbackDownSessions,
    rejectReasons
  };
}

function compareMatches(left: SmartMoneyPatternMatch, right: SmartMoneyPatternMatch): number {
  if (left.actionable !== right.actionable) {
    return left.actionable ? -1 : 1;
  }
  if (left.matched !== right.matched) {
    return left.matched ? -1 : 1;
  }
  const stageDiff = getStageRank(right.stage) - getStageRank(left.stage);
  if (stageDiff !== 0) {
    return stageDiff;
  }
  const rankDiff = (right.finalRankScore ?? right.patternScore) - (left.finalRankScore ?? left.patternScore);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return right.patternScore - left.patternScore;
}

function toSummary(match: SmartMoneyPatternMatch, rejectReasons: string[]): SmartMoneyCandidateSummary {
  return {
    stage: match.stage === "none" ? "setup" : match.stage,
    lookbackWindowDays: match.lookbackWindowDays ?? 0,
    matched: match.matched,
    actionable: match.actionable,
    pullbackType: match.pullbackType,
    setupType: match.setupType,
    leadInDate: match.leadInDate,
    surgePeakDate: match.surgePeakDate,
    breakoutDate: match.breakoutDate,
    breakoutLevel: match.breakoutLevel,
    setupScore: match.setupScore ?? 0,
    breakoutScore: match.breakoutScore ?? 0,
    regimeAdjustedScore: match.regimeAdjustedScore ?? 0,
    finalRankScore: match.finalRankScore ?? 0,
    regimeScore: match.regimeScore ?? 50,
    marketContextScore: match.marketContextScore ?? 50,
    volumeQualityScore: match.volumeQualityScore ?? 0,
    breakoutStrengthScore: match.breakoutStrengthScore ?? 0,
    breakoutFailureRiskScore: match.breakoutFailureRiskScore ?? 100,
    freshnessScore: match.freshnessScore ?? 0,
    validityScore: match.validityScore ?? 0,
    executionReadinessScore: match.executionReadinessScore ?? 0,
    reasons: match.reasons,
    rejectReasons
  };
}

function createRejectReason(stage: SmartMoneyStage, lookbackWindowDays: number, reason: string, leadInDate?: string, candidateDate?: string): SmartMoneyRejectReason {
  return { stage, lookbackWindowDays, reason, leadInDate, candidateDate };
}

function buildCandidateMatch(params: {
  stage: SmartMoneyStage;
  referenceDate: string;
  windowPoints: ChartPoint[];
  lookbackWindowDays: number;
  leadInPoint: ChartPoint;
  surgePeakPoint?: ChartPoint;
  pullbackPoints: ChartPoint[];
  referencePoint: ChartPoint;
  breakoutPoint?: ChartPoint;
  market: MarketEvaluation;
  setupScore: number;
  breakoutScore: number;
  volumeQualityScore: number;
  breakoutStrengthScore: number;
  breakoutFailureRiskScore: number;
  freshnessScore: number;
  validityScore: number;
  executionReadinessScore: number;
  pullback: PullbackAssessment;
  leadInPriceChangePercent: number;
  leadInVolumeRatio20d?: number;
  leadInTurnoverValue?: number;
  breakoutVolumeRatio20d?: number;
  breakoutTurnoverValue?: number;
  breakoutPriceChangePercent?: number;
  breakout20d: boolean;
  closedNearHigh: boolean;
  referenceCloseVsBasePercent?: number;
  referenceCloseVsPeakPercent?: number;
  referenceCloseVsLeadInPercent?: number;
  referenceCloseVsLeadInHighPercent?: number;
  breakoutCloseVsLeadInPercent?: number;
  matched: boolean;
  actionable: boolean;
  reasons: string[];
}): SmartMoneyPatternMatch {
  const rawScore = params.stage === "breakout" ? params.breakoutScore : params.setupScore;
  const regimeAdjustedScore = clamp(Math.round(rawScore * 0.82 + params.market.regimeScore * 0.18), 0, 100);
  const finalRankScore = clamp(Math.round(regimeAdjustedScore * 0.7 + params.validityScore * 0.15 + params.executionReadinessScore * 0.15), 0, 100);
  return {
    matched: params.matched,
    actionable: params.actionable,
    stage: params.stage,
    signal: toSignal(rawScore),
    patternScore: rawScore,
    setupScore: params.setupScore,
    breakoutScore: params.breakoutScore,
    regimeAdjustedScore,
    finalRankScore,
    regimeScore: params.market.regimeScore,
    marketContextScore: params.market.marketContextScore,
    volumeQualityScore: params.volumeQualityScore,
    breakoutStrengthScore: params.breakoutStrengthScore,
    breakoutFailureRiskScore: params.breakoutFailureRiskScore,
    freshnessScore: params.freshnessScore,
    validityScore: params.validityScore,
    executionReadinessScore: params.executionReadinessScore,
    referenceDate: params.referenceDate,
    windowStartDate: params.windowPoints[0]?.date,
    windowEndDate: params.windowPoints.at(-1)?.date,
    lookbackWindowDays: params.lookbackWindowDays,
    leadInDate: params.leadInPoint.date,
    surgePeakDate: params.surgePeakPoint?.date,
    leadInPriceChangePercent: params.leadInPriceChangePercent,
    pullbackType: params.pullback.pullbackType,
    setupType: params.pullback.setupType,
    pullbackStartDate: params.pullbackPoints[0]?.date,
    pullbackEndDate: params.pullbackPoints.at(-1)?.date,
    breakoutDate: params.breakoutPoint?.date,
    breakoutLevel: params.pullback.breakoutLevel,
    sessionsSinceBreakout: params.breakoutPoint ? params.windowPoints.at(-1) ? params.windowPoints.findIndex((point) => point.date === params.windowPoints.at(-1)?.date) - params.windowPoints.findIndex((point) => point.date === params.breakoutPoint?.date) : undefined : undefined,
    leadInClose: params.leadInPoint.close,
    leadInHigh: params.leadInPoint.high,
    leadInVolume: params.leadInPoint.volume,
    leadInTurnoverValue: params.leadInTurnoverValue,
    leadInVolumeRatio20d: params.leadInVolumeRatio20d,
    surgePeakClose: params.surgePeakPoint?.close,
    surgePeakHigh: params.surgePeakPoint?.high,
    pullbackVolumeRatioToLeadIn: params.pullback.pullbackVolumeRatioToLeadIn,
    pullbackRangePercent: params.pullback.pullbackRangePercent,
    breakoutClose: params.breakoutPoint?.close,
    breakoutPriceChangePercent: params.breakoutPriceChangePercent,
    breakoutVolume: params.breakoutPoint?.volume,
    breakoutTurnoverValue: params.breakoutTurnoverValue,
    breakoutVolumeRatio20d: params.breakoutVolumeRatio20d,
    breakoutCloseVsLeadInPercent: params.breakoutCloseVsLeadInPercent,
    referenceClose: params.referencePoint.close,
    referenceCloseVsBasePercent: params.referenceCloseVsBasePercent,
    referenceCloseVsPeakPercent: params.referenceCloseVsPeakPercent,
    referenceCloseVsLeadInPercent: params.referenceCloseVsLeadInPercent,
    referenceCloseVsLeadInHighPercent: params.referenceCloseVsLeadInHighPercent,
    pullbackSessions: params.pullbackPoints.length,
    pullbackMaxDrawdownPercent: params.pullback.pullbackMaxDrawdownPercent,
    breakout20d: params.breakout20d,
    closedNearHigh: params.closedNearHigh,
    reasons: params.reasons,
    summary: params.reasons.join(" ")
  };
}

export function evaluateSmartMoneyPattern(
  points: ChartPoint[],
  referenceIndex: number,
  filtersInput: SmartMoneyPatternFilters,
  options?: { marketContext?: SmartMoneyMarketContext; debug?: boolean }
): SmartMoneyPatternMatch {
  const filters = resolveSmartMoneyPatternFilters(filtersInput);
  const referencePoint = points[referenceIndex];
  const referenceDate = referencePoint?.date ?? "";
  const allCandidates: CandidateEvaluation[] = [];
  const rejected: SmartMoneyRejectReason[] = [];

  for (const lookbackWindowDays of filters.lookbackWindows) {
    const windowStartIndex = Math.max(1, referenceIndex - lookbackWindowDays + 1);
    const windowPoints = points.slice(windowStartIndex, referenceIndex + 1);
    if (!windowPoints.length || !referencePoint) {
      continue;
    }
    const market = evaluateMarketContext(options?.marketContext, filters);

    for (let leadInIndex = windowStartIndex; leadInIndex <= referenceIndex - filters.minPullbackSessions; leadInIndex += 1) {
      const leadInPoint = points[leadInIndex];
      const leadInPrevious = points[leadInIndex - 1];
      if (!leadInPoint || !leadInPrevious) {
        continue;
      }

      const leadInPriceChangePercent = percentChange(leadInPoint.close, leadInPrevious.close);
      const leadInVolume = scoreVolumeQuality(leadInPoint, getAverageVolumeBefore(points, leadInIndex, 20), filters.minLeadInVolumeRatio, filters.minTurnoverValue);
      if (leadInPriceChangePercent == null || leadInPriceChangePercent < filters.minLeadInPriceChangePercent || !leadInVolume.passed) {
        rejected.push(createRejectReason("setup", lookbackWindowDays, "Lead-in impulse failed price, relative volume, or turnover filters.", leadInPoint.date));
        continue;
      }

      const preLeadBaseClose = getHighestCloseBefore(points, leadInIndex, filters.breakoutLookbackDays) ?? leadInPrevious.close;
      const surgePeakUpperBound = Math.min(referenceIndex - filters.minPullbackSessions, leadInIndex + 5);

      for (let surgePeakIndex = leadInIndex + filters.minSetupContinuationSessions; surgePeakIndex <= surgePeakUpperBound; surgePeakIndex += 1) {
        const surgePeakPoint = points[surgePeakIndex];
        if (!surgePeakPoint) {
          continue;
        }
        const surgeAdvancePercent = percentChange(surgePeakPoint.close, leadInPoint.close);
        if (surgeAdvancePercent == null || surgeAdvancePercent < filters.minSetupSurgeAdvancePercent) {
          continue;
        }

        const setupPullbackPoints = points.slice(surgePeakIndex + 1, referenceIndex + 1);
        if (setupPullbackPoints.length < Math.max(filters.minPullbackSessions, filters.minSetupPullbackSessions) || setupPullbackPoints.length > filters.maxPullbackSessions) {
          continue;
        }
        const setupPullback = classifyPullback(leadInPoint, surgePeakPoint, setupPullbackPoints, referencePoint, filters, preLeadBaseClose);
        if (!setupPullback.valid) {
          rejected.push(...setupPullback.rejectReasons.map((reason) => createRejectReason("setup", lookbackWindowDays, reason, leadInPoint.date, surgePeakPoint.date)));
          continue;
        }

        const referenceCloseVsBasePercent = percentChange(referencePoint.close, preLeadBaseClose);
        const referenceCloseVsPeakPercent = percentChange(referencePoint.close, surgePeakPoint.close);
        if (referenceCloseVsBasePercent == null || referenceCloseVsBasePercent < filters.minReferenceCloseVsBasePercent || referenceCloseVsPeakPercent == null || referenceCloseVsPeakPercent > filters.maxSetupCloseVsPeakPercent) {
          continue;
        }

        const setupDistancePercent = percentChange(referencePoint.close, setupPullback.breakoutLevel) ?? -100;
        const validityScore = setupDistancePercent < -filters.maxSetupDistanceBelowBreakoutLevelPercent ? 45 : 85;
        const executionReadinessScore = setupDistancePercent > 3 ? 35 : clamp(92 - Math.abs(setupDistancePercent) * 8, 20, 95);
        const setupBaseScore = clamp(
          Math.round(
            leadInVolume.volumeQualityScore * 0.15 +
              Math.min(100, (leadInPriceChangePercent / filters.minLeadInPriceChangePercent) * 40) * 0.25 +
              Math.min(100, (surgeAdvancePercent / filters.minSetupSurgeAdvancePercent) * 35) * 0.2 +
              clamp(100 - setupPullback.pullbackRangePercent * 5, 0, 100) * 0.2 +
              clamp(100 - setupPullback.pullbackMaxDrawdownPercent * 2.5, 0, 100) * 0.2
          ),
          0,
          100
        );
        const setupScore = clamp(
          Math.round(
            setupBaseScore +
              (setupPullback.setupType === "volatile_power_digestion" ? filters.volatileDigestionSetupScoreBoost : 0)
          ),
          0,
          100
        );
        const matched = setupScore >= Math.max(filters.minPatternScore, filters.minSetupPatternScore);
        const actionable = matched && validityScore >= filters.minActionableValidityScore && executionReadinessScore >= filters.minExecutionReadinessScore && market.actionableAllowed;
        const setupMatch = buildCandidateMatch({
          stage: "setup",
          referenceDate,
          windowPoints,
          lookbackWindowDays,
          leadInPoint,
          surgePeakPoint,
          pullbackPoints: setupPullbackPoints,
          referencePoint,
          market,
          setupScore,
          breakoutScore: 0,
          volumeQualityScore: leadInVolume.volumeQualityScore,
          breakoutStrengthScore: 0,
          breakoutFailureRiskScore: 0,
          freshnessScore: clamp(92 - (referenceIndex - surgePeakIndex) * 6, 35, 95),
          validityScore,
          executionReadinessScore,
          pullback: setupPullback,
          leadInPriceChangePercent,
          leadInVolumeRatio20d: leadInVolume.volumeRatio20d,
          leadInTurnoverValue: leadInVolume.turnoverValue,
          breakout20d: false,
          closedNearHigh: false,
          referenceCloseVsBasePercent,
          referenceCloseVsPeakPercent,
          referenceCloseVsLeadInPercent: percentChange(referencePoint.close, leadInPoint.close),
          referenceCloseVsLeadInHighPercent: percentChange(referencePoint.close, getPointHigh(leadInPoint)),
          matched,
          actionable,
          reasons: [
            `Lead-in on ${leadInPoint.date} printed ${leadInPriceChangePercent.toFixed(1)}% with solid turnover support.`,
            `The stock formed a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile power digestion" : setupPullback.pullbackType === "time_correction" ? "time correction" : "tight price pullback"} with volume cooling to ${((setupPullback.pullbackVolumeRatioToLeadIn ?? 0) * 100).toFixed(0)}% of the surge anchor.`,
            `Current price sits ${setupDistancePercent.toFixed(1)}% from the structural breakout level while regime scored ${market.regimeScore}.`
          ]
        });
        allCandidates.push({ match: setupMatch, summary: toSummary(setupMatch, actionable ? [] : ["Setup is not actionable because validity, readiness, or regime is weak."]), rejectReasons: [] });

        for (let breakoutIndex = surgePeakIndex + filters.minPullbackSessions + 1; breakoutIndex <= referenceIndex; breakoutIndex += 1) {
          const breakoutPoint = points[breakoutIndex];
          const breakoutPrevious = points[breakoutIndex - 1];
          if (!breakoutPoint || !breakoutPrevious) {
            continue;
          }

          const breakoutPriceChangePercent = percentChange(breakoutPoint.close, breakoutPrevious.close);
          const breakoutVolume = scoreVolumeQuality(breakoutPoint, getAverageVolumeBefore(points, breakoutIndex, 20), filters.minBreakoutVolumeRatio, filters.minBreakoutTurnoverValue);
          const breakout20d = (getHighestCloseBefore(points, breakoutIndex, filters.breakoutLookbackDays) ?? -Infinity) <= breakoutPoint.close;
          const closedNearHigh = breakoutPoint.high != null ? breakoutPoint.close >= breakoutPoint.high * filters.closeNearHighRatio : false;
          if (breakoutPriceChangePercent == null || breakoutPriceChangePercent < filters.minBreakoutPriceChangePercent || !breakoutVolume.passed || !breakout20d || !closedNearHigh || breakoutPoint.close < setupPullback.breakoutLevel) {
            continue;
          }

          const sessionsSinceBreakout = referenceIndex - breakoutIndex;
          const extensionPercent = percentChange(referencePoint.close, setupPullback.breakoutLevel) ?? 0;
          const validityBreakoutScore = referencePoint.close < setupPullback.breakoutLevel * (1 - filters.breakoutHoldTolerancePercent / 100) ? 35 : 88;
          const executionBreakoutScore = extensionPercent > filters.maxBreakoutExtensionPercent ? 35 : clamp(92 - Math.max(0, extensionPercent) * 7, 20, 95);
          const breakoutFailureRiskScore = referencePoint.close < setupPullback.breakoutLevel ? 65 : extensionPercent > filters.maxBreakoutExtensionPercent ? 48 : 18;
          const breakoutStrengthScore = clamp(Math.round(Math.min(100, (breakoutPriceChangePercent / filters.minBreakoutPriceChangePercent) * 45) * 0.35 + breakoutVolume.volumeQualityScore * 0.35 + (closedNearHigh ? 92 : 60) * 0.15 + clamp((percentChange(breakoutPoint.close, setupPullback.breakoutLevel) ?? 0) * 10 + 60, 0, 100) * 0.15), 0, 100);
          const breakoutScore = clamp(Math.round(setupScore * 0.35 + breakoutStrengthScore * 0.45 + (100 - breakoutFailureRiskScore) * 0.2), 0, 100);
          const matchedBreakout = breakoutScore >= Math.max(filters.minPatternScore, filters.minBreakoutPatternScore);
          const actionableBreakout = matchedBreakout && sessionsSinceBreakout <= filters.recentSignalSessions + 2 && validityBreakoutScore >= filters.minActionableValidityScore && executionBreakoutScore >= filters.minExecutionReadinessScore && market.actionableAllowed;
          const breakoutMatch = buildCandidateMatch({
            stage: "breakout",
            referenceDate,
            windowPoints,
            lookbackWindowDays,
            leadInPoint,
            surgePeakPoint,
            pullbackPoints: points.slice(surgePeakIndex + 1, breakoutIndex),
            referencePoint,
            breakoutPoint,
            market,
            setupScore,
            breakoutScore,
            volumeQualityScore: breakoutVolume.volumeQualityScore,
            breakoutStrengthScore,
            breakoutFailureRiskScore,
            freshnessScore: clamp(95 - sessionsSinceBreakout * 12, 30, 95),
            validityScore: validityBreakoutScore,
            executionReadinessScore: executionBreakoutScore,
            pullback: setupPullback,
            leadInPriceChangePercent,
            leadInVolumeRatio20d: leadInVolume.volumeRatio20d,
            leadInTurnoverValue: leadInVolume.turnoverValue,
            breakoutVolumeRatio20d: breakoutVolume.volumeRatio20d,
            breakoutTurnoverValue: breakoutVolume.turnoverValue,
            breakoutPriceChangePercent,
            breakout20d,
            closedNearHigh,
            referenceCloseVsBasePercent,
            referenceCloseVsPeakPercent: percentChange(referencePoint.close, breakoutPoint.close),
            referenceCloseVsLeadInPercent: percentChange(referencePoint.close, leadInPoint.close),
            referenceCloseVsLeadInHighPercent: percentChange(referencePoint.close, getPointHigh(leadInPoint)),
            breakoutCloseVsLeadInPercent: percentChange(breakoutPoint.close, leadInPoint.close),
              matched: matchedBreakout,
              actionable: actionableBreakout,
              reasons: [
              `Setup from ${leadInPoint.date} to ${surgePeakPoint.date} provided the base for a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile-power-digestion" : setupPullback.pullbackType === "time_correction" ? "time-correction" : "price-pullback"} breakout.`,
              `Breakout on ${breakoutPoint.date} cleared ${setupPullback.breakoutLevel.toFixed(2)} with ${breakoutPriceChangePercent.toFixed(1)}% price expansion and ${breakoutVolume.volumeQualityScore} volume-quality points.`,
              `Reference price is ${extensionPercent.toFixed(1)}% from the breakout level and failure risk is ${breakoutFailureRiskScore}.`
            ]
          });
          allCandidates.push({ match: breakoutMatch, summary: toSummary(breakoutMatch, actionableBreakout ? [] : ["Breakout is not actionable because it is stale, weakly held, too extended, or regime is poor."]), rejectReasons: [] });
        }
      }
    }
  }

  const bestMatch = [...allCandidates].map((candidate) => candidate.match).sort(compareMatches)[0] ?? buildEmptyMatch(referenceDate, points.slice(Math.max(0, referenceIndex - filters.lookbackTradingDays + 1), referenceIndex + 1), filters.lookbackTradingDays);
  if (!options?.debug) {
    return bestMatch;
  }

  const topCandidates = [...allCandidates].sort((left, right) => compareMatches(left.match, right.match)).slice(0, filters.debugTopCandidateLimit).map((candidate, index) => ({ ...candidate.summary, selected: index === 0 }));
  const debugMeta: SmartMoneyDebugMeta = {
    evaluatedLookbackWindows: filters.lookbackWindows,
    evaluatedCandidateCount: allCandidates.length,
    rejectedCandidateCount: rejected.length,
    marketContextApplied: Boolean(options.marketContext),
    selectionPolicy: "actionable > matched > breakout over setup > finalRankScore > patternScore"
  };

  return {
    ...bestMatch,
    topCandidates,
    rejectReasons: rejected.slice(0, filters.debugTopCandidateLimit * 5),
    debugMeta
  };
}
