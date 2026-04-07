import type {
  SmartMoneyBuyPlan,
  SmartMoneyAppliedMarketContext,
  ChartPoint,
  SmartMoneyCandidateSummary,
  SmartMoneyDebugMeta,
  SmartMoneyEntryStrategy,
  SmartMoneyMarketContext,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyPullbackType,
  SmartMoneyTradePlan,
  SmartMoneySetupType,
  SmartMoneyRejectReason
} from "../types.js";
import { enhanceSmartMoneyMatch } from "./smartMoneyEnhancer.js";

type SmartMoneyStage = Exclude<SmartMoneyPatternMatch["stage"], "none">;

type CandidateEvaluation = {
  match: SmartMoneyPatternMatch;
  summary: SmartMoneyCandidateSummary;
  rejectReasons: SmartMoneyRejectReason[];
};

type MarketEvaluation = {
  regimeScore: number;
  marketContextScore: number;
  marketScoreAdjustment: number;
  setupThresholdAdjustment: number;
  breakoutThresholdAdjustment: number;
  actionableAllowed: boolean;
  reasons: string[];
  appliedContext: SmartMoneyAppliedMarketContext;
};

type PullbackAssessment = {
  valid: boolean;
  pullbackType?: SmartMoneyPullbackType;
  setupType?: SmartMoneySetupType;
  breakoutLevel: number;
  pullbackLow: number;
  pullbackVolumeRatioToLeadIn?: number;
  pullbackRangePercent: number;
  closeRangePercent: number;
  pullbackMaxDrawdownPercent: number;
  pullbackDownSessions: number;
  rejectReasons: string[];
};

const MARKET_CONTEXT_SETTINGS = {
  scoreAdjustmentWeight: 0.24,
  scoreAdjustmentCap: 8,
  entryAdjustmentCapPercent: 6,
  weakRegimeThreshold: 38,
  strongRegimeThreshold: 68,
  weakBreakoutThreshold: 42,
  weakBreadthThreshold: 40,
  weakMomentumThreshold: 38,
  strongMomentumThreshold: 65,
  setupPenalty: 1,
  breakoutPenalty: 2,
  breakoutRelief: -1,
  neutralScore: 50
} as const;

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

function getWorkflowStatusRank(status: SmartMoneyPatternMatch["status"]): number {
  switch (status) {
    case "breakout_confirmed":
      return 7;
    case "buy_ready":
      return 6;
    case "breakout_ready":
      return 5;
    case "pullback_ready":
      return 4;
    case "pullback_deep":
      return 3;
    case "pullback_early":
      return 2;
    case "pivot_formed":
      return 1;
    case "broken":
      return 0;
    default:
      return 0;
  }
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
    maxTimeCorrectionCloseRangePercent: 4.5,
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
    minPullbackBuyDrawdownPercent: 12,
    minPullbackBuyDistanceBelowBreakoutPercent: 12,
    minTightPullbackBuyLeadInPriceChangePercent: 20,
    pullbackBuyStartPercentFromPeak: 20,
    tightPullbackBuyZoneLowRetracementRatio: 0.18,
    tightPullbackBuyZoneHighRetracementRatio: 0.72,
    timeCorrectionBuyZoneLowRetracementRatio: 0.45,
    timeCorrectionBuyZoneHighRetracementRatio: 0.95,
    volatileDigestionBuyZoneLowRetracementRatio: 0.08,
    volatileDigestionBuyZoneHighRetracementRatio: 0.58,
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
    status: "none",
    signal: "watch",
    patternScore: 0,
    setupScore: 0,
    breakoutScore: 0,
    regimeAdjustedScore: 0,
    finalRankScore: 0,
    dangerScore: 0,
    regimeScore: 50,
    marketContextScore: 50,
    riskFactors: [],
    volumeQualityScore: 0,
    breakoutStrengthScore: 0,
    breakoutFailureRiskScore: 100,
    freshnessScore: 0,
    validityScore: 0,
    executionReadinessScore: 0,
    debugInfo: {
      pullbackDays: 0,
      breakoutStatus: "none",
      supportStatus: "holding",
      conditions: [],
      summary: ["No smart-money pattern was found, so only the baseline empty state is available."]
    },
    rejectionReasons: ["No smart-money entry pattern was found in the selected window."],
    marketContext: {
      regimeScore: 50,
      marketContextScore: 50,
      marketScoreAdjustment: 0,
      entryPriceAdjustmentPercent: 0,
      setupThresholdAdjustment: 0,
      breakoutThresholdAdjustment: 0,
      actionableAllowed: true,
      applied: false,
      notes: ["No market context was injected, so regime stayed neutral."]
    },
    tradePlan: undefined,
    referenceDate,
    windowStartDate: windowPoints[0]?.date,
    windowEndDate: windowPoints.at(-1)?.date,
    lookbackWindowDays,
    pullbackSessions: 0,
    breakout20d: false,
    closedNearHigh: false,
    setupType: undefined,
    entryStrategy: undefined,
    reasons: ["No smart-money entry pattern was found in the selected window."],
    summary: "No smart-money entry pattern was found in the selected window."
  };
}

function resolveBreakoutRetestZone(breakoutLevel: number, pullbackLow: number, maxDistancePercent: number) {
  const fallbackLow = breakoutLevel * (1 - maxDistancePercent / 100);
  const normalizedPullbackLow = pullbackLow > 0 ? pullbackLow : fallbackLow;
  return {
    entryZoneLow: Math.max(normalizedPullbackLow, fallbackLow),
    entryZoneHigh: breakoutLevel
  };
}

function clampRatio(value: number): number {
  return clamp(value, 0, 1);
}

function scaleBetween(low: number, high: number, ratioValue: number): number {
  return low + (high - low) * ratioValue;
}

function resolveSetupEntryZone(params: {
  breakoutLevel: number;
  pullbackLow: number;
  setupType?: SmartMoneySetupType;
  filters: SmartMoneyPatternFilters;
}) {
  const fallbackLow = params.breakoutLevel * (1 - params.filters.maxSetupDistanceBelowBreakoutLevelPercent / 100);
  const normalizedPullbackLow =
    params.pullbackLow > 0 && params.pullbackLow < params.breakoutLevel ? params.pullbackLow : fallbackLow;
  const baseRange = Math.max(0, params.breakoutLevel - normalizedPullbackLow);
  if (baseRange === 0) {
    return resolveBreakoutRetestZone(params.breakoutLevel, normalizedPullbackLow, params.filters.maxSetupDistanceBelowBreakoutLevelPercent);
  }

  let lowRatio = params.filters.tightPullbackBuyZoneLowRetracementRatio;
  let highRatio = params.filters.tightPullbackBuyZoneHighRetracementRatio;

  if (params.setupType === "time_correction") {
    lowRatio = params.filters.timeCorrectionBuyZoneLowRetracementRatio;
    highRatio = params.filters.timeCorrectionBuyZoneHighRetracementRatio;
  } else if (params.setupType === "volatile_power_digestion") {
    lowRatio = params.filters.volatileDigestionBuyZoneLowRetracementRatio;
    highRatio = params.filters.volatileDigestionBuyZoneHighRetracementRatio;
  }

  const normalizedLowRatio = clampRatio(Math.min(lowRatio, highRatio));
  const normalizedHighRatio = clampRatio(Math.max(lowRatio, highRatio));
  return {
    entryZoneLow: scaleBetween(normalizedPullbackLow, params.breakoutLevel, normalizedLowRatio),
    entryZoneHigh: scaleBetween(normalizedPullbackLow, params.breakoutLevel, normalizedHighRatio)
  };
}

function isWithinBand(value: number, low?: number, high?: number): boolean {
  return low != null && high != null && value >= low && value <= high;
}

function roundPriceLevel(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveEntryPriceAdjustmentPercent(market: MarketEvaluation): number {
  const regimeScore = market.regimeScore;
  const marketScore = market.marketContextScore;
  const riskOff = market.appliedContext.riskOff ?? false;
  const bearishTrend = market.appliedContext.resolvedTrend === "bearish";

  let adjustment = 0;
  if (regimeScore < 36 || marketScore < 38) {
    adjustment = 5.5;
  } else if (regimeScore < 42 || marketScore < 44) {
    adjustment = 4;
  } else if (regimeScore < 48 || marketScore < 48) {
    adjustment = 2.5;
  } else if (regimeScore < 54 || marketScore < 52) {
    adjustment = 1.2;
  }

  if (riskOff) {
    adjustment += 1;
  }
  if (bearishTrend && adjustment > 0) {
    adjustment += 0.5;
  }

  return clamp(Math.round(adjustment * 10) / 10, 0, MARKET_CONTEXT_SETTINGS.entryAdjustmentCapPercent);
}

function adjustEntryZoneForMarket(
  entryZoneLow: number | undefined,
  entryZoneHigh: number | undefined,
  stopLossPrice: number | undefined,
  market: MarketEvaluation
) {
  if (entryZoneLow == null || entryZoneHigh == null) {
    return {
      entryZoneLow,
      entryZoneHigh
    };
  }

  const adjustmentPercent = market.appliedContext.entryPriceAdjustmentPercent ?? 0;
  if (adjustmentPercent <= 0) {
    return {
      entryZoneLow,
      entryZoneHigh
    };
  }

  const low = Math.min(entryZoneLow, entryZoneHigh);
  const high = Math.max(entryZoneLow, entryZoneHigh);
  const adjustmentRatio = 1 - adjustmentPercent / 100;
  const shiftedLow = low * adjustmentRatio;
  const shiftedHigh = high * adjustmentRatio;

  if (stopLossPrice == null || stopLossPrice <= 0) {
    return {
      entryZoneLow: roundPriceLevel(shiftedLow),
      entryZoneHigh: roundPriceLevel(Math.max(shiftedHigh, shiftedLow * 1.01))
    };
  }

  const safeLow = Math.max(shiftedLow, stopLossPrice * 1.015);
  const safeHigh = Math.max(shiftedHigh, safeLow * 1.01, stopLossPrice * 1.04);
  return {
    entryZoneLow: roundPriceLevel(safeLow),
    entryZoneHigh: roundPriceLevel(safeHigh)
  };
}

function buildBuyPlan(entryZoneLow?: number, entryZoneHigh?: number, stopLossPrice?: number): SmartMoneyBuyPlan | undefined {
  if (entryZoneLow == null || entryZoneHigh == null) {
    return undefined;
  }

  const low = Math.min(entryZoneLow, entryZoneHigh);
  const high = Math.max(entryZoneLow, entryZoneHigh);
  const mid = (low + high) / 2;
  const normalizedStopLossPrice = stopLossPrice != null && stopLossPrice > 0 ? stopLossPrice : low;
  return {
    firstBuyPrice: roundPriceLevel(high),
    secondBuyPrice: roundPriceLevel(mid),
    thirdBuyPrice: roundPriceLevel(low),
    stopLossPrice: roundPriceLevel(normalizedStopLossPrice)
  };
}

function resolvePullbackBuyPlan(params: {
  breakoutLevel: number;
  invalidationPrice: number;
  filters: SmartMoneyPatternFilters;
}): SmartMoneyBuyPlan | undefined {
  const firstBuyPrice = params.breakoutLevel * (1 - params.filters.pullbackBuyStartPercentFromPeak / 100);
  if (firstBuyPrice <= 0) {
    return undefined;
  }

  const stopLossPrice =
    params.invalidationPrice > 0 && params.invalidationPrice < firstBuyPrice
      ? params.invalidationPrice
      : firstBuyPrice * (1 - params.filters.maxSetupDistanceBelowBreakoutLevelPercent / 100);
  if (stopLossPrice <= 0 || stopLossPrice >= firstBuyPrice) {
    return undefined;
  }

  const riskBand = firstBuyPrice - stopLossPrice;
  return {
    firstBuyPrice: roundPriceLevel(firstBuyPrice),
    secondBuyPrice: roundPriceLevel(stopLossPrice + riskBand * 0.58),
    thirdBuyPrice: roundPriceLevel(stopLossPrice + riskBand * 0.26),
    stopLossPrice: roundPriceLevel(stopLossPrice)
  };
}

function isPullbackBuySetup(params: {
  setupType?: SmartMoneySetupType;
  leadInPriceChangePercent: number;
  pullbackMaxDrawdownPercent: number;
  referenceCloseVsBreakoutLevelPercent?: number;
  filters: SmartMoneyPatternFilters;
}) {
  if (params.setupType === "volatile_power_digestion") {
    return true;
  }

  if (params.setupType !== "tight_price_pullback") {
    return false;
  }

  const distanceBelowBreakout = Math.abs(Math.min(params.referenceCloseVsBreakoutLevelPercent ?? 0, 0));
  return (
    params.leadInPriceChangePercent >= params.filters.minTightPullbackBuyLeadInPriceChangePercent &&
    params.pullbackMaxDrawdownPercent >= params.filters.minPullbackBuyDrawdownPercent &&
    distanceBelowBreakout >= params.filters.minPullbackBuyDistanceBelowBreakoutPercent
  );
}

function isPullbackBuyActionable(referenceClose: number, buyPlan: SmartMoneyBuyPlan | undefined, invalidationPrice?: number) {
  if (!buyPlan) {
    return false;
  }

  if (invalidationPrice != null && invalidationPrice > 0 && referenceClose <= invalidationPrice) {
    return false;
  }

  return referenceClose <= buyPlan.firstBuyPrice && referenceClose > buyPlan.stopLossPrice;
}

function deriveEntryStrategy(stage: SmartMoneyPatternMatch["stage"], status: SmartMoneyPatternMatch["status"]): SmartMoneyEntryStrategy | undefined {
  if (stage === "breakout") {
    return status === "breakout_confirmed" ? "breakout_confirmed" : "breakout_ready";
  }
  if (stage === "setup" && status === "buy_ready") {
    return "pullback_buy";
  }
  return undefined;
}

function resolveWorkflowStatus(params: {
  stage: SmartMoneyPatternMatch["stage"];
  matched: boolean;
  actionable: boolean;
  referenceClose: number;
  breakoutLevel?: number;
  invalidationPrice?: number;
  referenceCloseVsBreakoutLevelPercent?: number;
  pullbackSessions: number;
  sessionsSinceBreakout?: number;
  minSetupPullbackSessions: number;
  breakoutHoldTolerancePercent: number;
}) {
  const { breakoutLevel, invalidationPrice, referenceClose } = params;
  if (invalidationPrice != null && referenceClose < invalidationPrice) {
    return "broken" as const;
  }

  if (
    params.stage === "breakout" &&
    breakoutLevel != null &&
    referenceClose < breakoutLevel * (1 - params.breakoutHoldTolerancePercent / 100)
  ) {
    return "broken" as const;
  }

  if (params.stage === "breakout") {
    if (params.matched && params.actionable) {
      return "breakout_confirmed" as const;
    }
    return "breakout_ready" as const;
  }

  if (params.stage === "setup") {
    const distance = params.referenceCloseVsBreakoutLevelPercent ?? -100;
    if (!params.matched) {
      return "pivot_formed" as const;
    }
    if (params.pullbackSessions < params.minSetupPullbackSessions + 1) {
      return "pullback_early" as const;
    }
    if (params.actionable && distance <= 1.5) {
      return "buy_ready" as const;
    }
    if (distance > 1.5) {
      return "breakout_ready" as const;
    }
    if (distance >= -8) {
      return "pullback_ready" as const;
    }
    return "pullback_deep" as const;
  }

  return "none" as const;
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
    const appliedContext: SmartMoneyAppliedMarketContext = {
      regimeScore: MARKET_CONTEXT_SETTINGS.neutralScore,
      marketContextScore: MARKET_CONTEXT_SETTINGS.neutralScore,
      marketScoreAdjustment: 0,
      entryPriceAdjustmentPercent: 0,
      setupThresholdAdjustment: 0,
      breakoutThresholdAdjustment: 0,
      actionableAllowed: true,
      applied: false,
      notes: ["No market context was injected, so regime stayed neutral."]
    };
    return {
      regimeScore: MARKET_CONTEXT_SETTINGS.neutralScore,
      marketContextScore: MARKET_CONTEXT_SETTINGS.neutralScore,
      marketScoreAdjustment: 0,
      setupThresholdAdjustment: 0,
      breakoutThresholdAdjustment: 0,
      actionableAllowed: true,
      reasons: appliedContext.notes,
      appliedContext
    };
  }

  const resolvedTrend =
    marketContext.marketTrend ??
    marketContext.benchmark?.trend ??
    (marketContext.benchmark?.aboveSma20 == null
      ? undefined
      : marketContext.benchmark.aboveSma20
        ? "bullish"
        : marketContext.benchmark.aboveSma50
          ? "neutral"
          : "bearish");
  const resolvedTrendScore =
    resolvedTrend === "bullish" ? 72 : resolvedTrend === "bearish" ? 30 : resolvedTrend === "neutral" ? 50 : undefined;
  const breadthScore =
    marketContext.marketBreadth?.score ??
    (marketContext.marketBreadth?.advanceDeclineRatio != null
      ? clamp(50 + (marketContext.marketBreadth.advanceDeclineRatio - 1) * 22, 15, 85)
      : marketContext.marketBreadth?.advancingPercent != null
        ? clamp(20 + marketContext.marketBreadth.advancingPercent, 15, 85)
        : undefined);
  const momentumScore =
    marketContext.leaderPersistenceScore ??
    (marketContext.momentumCondition === "strong"
      ? 72
      : marketContext.momentumCondition === "weak"
        ? 30
        : marketContext.momentumCondition === "neutral"
          ? 50
          : undefined);
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
      resolvedTrendScore,
      breadthScore,
      momentumScore,
      benchmarkTrendScore,
      benchmarkChangeScore
    ].filter((value): value is number => typeof value === "number")
  ) ?? MARKET_CONTEXT_SETTINGS.neutralScore;
  const regimeScore = clamp(
    Math.round(
      average([marketContext.regimeScore, marketContext.trendScore, resolvedTrendScore, momentumScore, composite].filter((value): value is number => typeof value === "number")) ??
        composite
    ),
    0,
    100
  );
  const marketContextScore = clamp(
    Math.round(
      average([marketContext.marketContextScore, marketContext.sectorStrengthScore, breadthScore, benchmarkChangeScore, composite].filter((value): value is number => typeof value === "number")) ??
        composite
    ),
    0,
    100
  );
  const marketScoreAdjustment = clamp(
    Math.round(
      (((regimeScore + marketContextScore) / 2) - MARKET_CONTEXT_SETTINGS.neutralScore) *
        MARKET_CONTEXT_SETTINGS.scoreAdjustmentWeight
    ),
    -MARKET_CONTEXT_SETTINGS.scoreAdjustmentCap,
    MARKET_CONTEXT_SETTINGS.scoreAdjustmentCap
  );
  const setupThresholdAdjustment =
    regimeScore <= MARKET_CONTEXT_SETTINGS.weakRegimeThreshold
      ? MARKET_CONTEXT_SETTINGS.setupPenalty
      : regimeScore >= MARKET_CONTEXT_SETTINGS.strongRegimeThreshold
        ? -1
        : 0;
  const breakoutThresholdAdjustment =
    regimeScore <= MARKET_CONTEXT_SETTINGS.weakBreakoutThreshold ||
    (momentumScore ?? MARKET_CONTEXT_SETTINGS.neutralScore) <= MARKET_CONTEXT_SETTINGS.weakMomentumThreshold ||
    (breadthScore ?? MARKET_CONTEXT_SETTINGS.neutralScore) <= MARKET_CONTEXT_SETTINGS.weakBreadthThreshold
      ? MARKET_CONTEXT_SETTINGS.breakoutPenalty
      : regimeScore >= MARKET_CONTEXT_SETTINGS.strongRegimeThreshold &&
          (momentumScore ?? MARKET_CONTEXT_SETTINGS.neutralScore) >= MARKET_CONTEXT_SETTINGS.strongMomentumThreshold
        ? MARKET_CONTEXT_SETTINGS.breakoutRelief
        : 0;
  const actionableAllowed = !(filters.blockActionableOnRiskOff && marketContext.riskOff) && regimeScore >= filters.minRegimeScoreForActionable;
  const provisionalMarket: MarketEvaluation = {
    regimeScore,
    marketContextScore,
    marketScoreAdjustment,
    setupThresholdAdjustment,
    breakoutThresholdAdjustment,
    actionableAllowed,
    reasons: [],
    appliedContext: {
      ...marketContext,
      resolvedTrend,
      breadthScore,
      momentumScore,
      regimeScore,
      marketContextScore,
      marketScoreAdjustment,
      entryPriceAdjustmentPercent: 0,
      setupThresholdAdjustment,
      breakoutThresholdAdjustment,
      actionableAllowed,
      applied: true,
      notes: []
    }
  };
  const entryPriceAdjustmentPercent = resolveEntryPriceAdjustmentPercent(provisionalMarket);
  const reasons = [
    marketScoreAdjustment > 0
      ? `Market context added ${marketScoreAdjustment} points of confidence.`
      : marketScoreAdjustment < 0
        ? `Market context reduced confidence by ${Math.abs(marketScoreAdjustment)} points.`
        : "Market context stayed close to neutral.",
    breakoutThresholdAdjustment > 0
      ? `Breakout candidates require ${breakoutThresholdAdjustment} extra score points because breadth/momentum is weak.`
      : breakoutThresholdAdjustment < 0
        ? `Breakout candidates get a ${Math.abs(breakoutThresholdAdjustment)}-point threshold relief because breadth/momentum is supportive.`
        : "Breakout threshold stayed unchanged.",
    entryPriceAdjustmentPercent > 0
      ? `Buy prices were shifted down by ${entryPriceAdjustmentPercent}% to reflect weaker index conditions while keeping stop-loss fixed.`
      : "Entry prices stayed unchanged."
  ];
  const appliedContext: SmartMoneyAppliedMarketContext = {
    ...marketContext,
    resolvedTrend,
    breadthScore,
    momentumScore,
    regimeScore,
    marketContextScore,
    marketScoreAdjustment,
    entryPriceAdjustmentPercent,
    setupThresholdAdjustment,
    breakoutThresholdAdjustment,
    actionableAllowed,
    applied: true,
    notes: [...reasons, ...(marketContext.notes ?? []).slice(0, 2)]
  };

  return {
    regimeScore,
    marketContextScore,
    marketScoreAdjustment,
    setupThresholdAdjustment,
    breakoutThresholdAdjustment,
    actionableAllowed,
    reasons: appliedContext.notes,
    appliedContext
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
  const highestClose = Math.max(...pullbackPoints.map((point) => point.close));
  const normalizedPullbackLow = lowestLow > 0 ? lowestLow : lowestClose;
  const pullbackAvgVolume = averageNumberSeries(pullbackPoints.map((point) => point.volume));
  const pullbackVolumeRatioToLeadIn = ratio(pullbackAvgVolume, Math.max(leadInPoint.volume ?? 0, surgePeakPoint.volume ?? 0) || undefined);
  const pullbackMaxDrawdownPercent = Math.abs(percentChange(lowestClose, surgePeakPoint.close) ?? 0);
  const pullbackRangePercent = Math.abs(percentChange(highestHigh, lowestLow) ?? 0);
  const closeRangePercent = Math.abs(percentChange(highestClose, lowestClose) ?? 0);
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
    (pullbackRangePercent <= filters.maxTimeCorrectionRangePercent || closeRangePercent <= filters.maxTimeCorrectionCloseRangePercent) &&
    closeRangePercent <= filters.maxTimeCorrectionCloseRangePercent &&
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

  const setupType = timeCorrectionValid
    ? "time_correction"
    : pricePullbackValid
      ? "tight_price_pullback"
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
    pullbackLow: normalizedPullbackLow,
    pullbackVolumeRatioToLeadIn,
    pullbackRangePercent,
    closeRangePercent,
    pullbackMaxDrawdownPercent,
    pullbackDownSessions,
    rejectReasons
  };
}

function compareMatches(left: SmartMoneyPatternMatch, right: SmartMoneyPatternMatch): number {
  const statusDiff = getWorkflowStatusRank(right.status) - getWorkflowStatusRank(left.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }
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
    status: match.status,
    entryStrategy: match.entryStrategy,
    buyPlan: match.buyPlan,
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
    dangerScore: match.dangerScore,
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
  basePrice?: number;
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
  surgeAdvancePercent?: number;
  surgeDurationDays?: number;
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
  referenceCloseVsBreakoutLevelPercent?: number;
  matched: boolean;
  actionable: boolean;
  reasons: string[];
  entryZoneLow?: number;
  entryZoneHigh?: number;
  invalidationPrice?: number;
  buyPlanEligible?: boolean;
  minSetupPullbackSessions: number;
  breakoutHoldTolerancePercent: number;
  regimeScoreWeight: number;
}): SmartMoneyPatternMatch {
  const rawScore = params.stage === "breakout" ? params.breakoutScore : params.setupScore;
  const regimeAdjustedScore = clamp(
    Math.round(
      rawScore * (1 - params.regimeScoreWeight) +
        (params.market.regimeScore + params.market.marketScoreAdjustment) * params.regimeScoreWeight
    ),
    0,
    100
  );
  const finalRankScore = clamp(Math.round(regimeAdjustedScore * 0.7 + params.validityScore * 0.15 + params.executionReadinessScore * 0.15), 0, 100);
  const status = resolveWorkflowStatus({
    stage: params.stage,
    matched: params.matched,
    actionable: params.actionable,
    referenceClose: params.referencePoint.close,
    breakoutLevel: params.pullback.breakoutLevel,
    invalidationPrice: params.invalidationPrice,
    referenceCloseVsBreakoutLevelPercent: params.referenceCloseVsBreakoutLevelPercent,
    pullbackSessions: params.pullbackPoints.length,
    sessionsSinceBreakout: params.breakoutPoint ? params.windowPoints.length - 1 - params.windowPoints.findIndex((point) => point.date === params.breakoutPoint?.date) : undefined,
    minSetupPullbackSessions: params.minSetupPullbackSessions,
    breakoutHoldTolerancePercent: params.breakoutHoldTolerancePercent
  });
  const entryStrategy = deriveEntryStrategy(params.stage, status);
  const buyPlan = params.buyPlanEligible ? buildBuyPlan(params.entryZoneLow, params.entryZoneHigh, params.invalidationPrice) : undefined;
  return {
    matched: params.matched,
    actionable: params.actionable,
    stage: params.stage,
    status,
    entryStrategy,
    buyPlan,
    signal: toSignal(rawScore),
    patternScore: rawScore,
    setupScore: params.setupScore,
    breakoutScore: params.breakoutScore,
    regimeAdjustedScore,
    finalRankScore,
    dangerScore: 0,
    regimeScore: params.market.regimeScore,
    marketContextScore: params.market.marketContextScore,
    marketContext: params.market.appliedContext,
    riskFactors: [],
    volumeQualityScore: params.volumeQualityScore,
    breakoutStrengthScore: params.breakoutStrengthScore,
    breakoutFailureRiskScore: params.breakoutFailureRiskScore,
    freshnessScore: params.freshnessScore,
    validityScore: params.validityScore,
    executionReadinessScore: params.executionReadinessScore,
    debugInfo: {
      pullbackDays: params.pullbackPoints.length,
      breakoutStatus: params.stage === "breakout" ? "ready" : "watch",
      supportStatus: "holding",
      marketScoreAdjustment: params.market.marketScoreAdjustment,
      conditions: [],
      summary: []
    },
    rejectionReasons: [],
    tradePlan: undefined,
    referenceDate: params.referenceDate,
    windowStartDate: params.windowPoints[0]?.date,
    windowEndDate: params.windowPoints.at(-1)?.date,
    lookbackWindowDays: params.lookbackWindowDays,
    leadInDate: params.leadInPoint.date,
    surgePeakDate: params.surgePeakPoint?.date,
    basePrice: params.basePrice,
    surgeAdvancePercent: params.surgeAdvancePercent,
    surgeDurationDays: params.surgeDurationDays,
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
    referenceCloseVsBreakoutLevelPercent: params.referenceCloseVsBreakoutLevelPercent,
    referenceCloseVsPeakPercent: params.referenceCloseVsPeakPercent,
    referenceCloseVsLeadInPercent: params.referenceCloseVsLeadInPercent,
    referenceCloseVsLeadInHighPercent: params.referenceCloseVsLeadInHighPercent,
    pullbackSessions: params.pullbackPoints.length,
    pullbackMaxDrawdownPercent: params.pullback.pullbackMaxDrawdownPercent,
    breakout20d: params.breakout20d,
    closedNearHigh: params.closedNearHigh,
    entryZoneLow: params.entryZoneLow,
    entryZoneHigh: params.entryZoneHigh,
    invalidationPrice: params.invalidationPrice,
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
  const market = evaluateMarketContext(options?.marketContext, filters);
  const setupThresholdScore = clamp(
    Math.max(filters.minPatternScore, filters.minSetupPatternScore) + market.setupThresholdAdjustment,
    0,
    100
  );
  const breakoutThresholdScore = clamp(
    Math.max(filters.minPatternScore, filters.minBreakoutPatternScore) + market.breakoutThresholdAdjustment,
    0,
    100
  );

  for (const lookbackWindowDays of filters.lookbackWindows) {
    const windowStartIndex = Math.max(1, referenceIndex - lookbackWindowDays + 1);
    const windowPoints = points.slice(windowStartIndex, referenceIndex + 1);
    if (!windowPoints.length || !referencePoint) {
      continue;
    }

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
        const setupEntryZone = resolveSetupEntryZone({
          breakoutLevel: setupPullback.breakoutLevel,
          pullbackLow: setupPullback.pullbackLow,
          setupType: setupPullback.setupType,
          filters
        });
        const pullbackBuyEligible = isPullbackBuySetup({
          setupType: setupPullback.setupType,
          leadInPriceChangePercent,
          pullbackMaxDrawdownPercent: setupPullback.pullbackMaxDrawdownPercent,
          referenceCloseVsBreakoutLevelPercent: setupDistancePercent,
          filters
        });
        const pullbackBuyPlan =
          pullbackBuyEligible
            ? resolvePullbackBuyPlan({
                breakoutLevel: setupPullback.breakoutLevel,
                invalidationPrice: setupPullback.pullbackLow,
                filters
              })
            : undefined;
        const adjustedSetupEntryZone = adjustEntryZoneForMarket(
          pullbackBuyPlan?.thirdBuyPrice ?? setupEntryZone.entryZoneLow,
          pullbackBuyPlan?.firstBuyPrice ?? setupEntryZone.entryZoneHigh,
          setupPullback.pullbackLow,
          market
        );
        const effectiveEntryZoneLow = adjustedSetupEntryZone.entryZoneLow;
        const effectiveEntryZoneHigh = adjustedSetupEntryZone.entryZoneHigh;
        const withinSetupEntryZone =
          pullbackBuyEligible && isWithinBand(referencePoint.close, effectiveEntryZoneLow, effectiveEntryZoneHigh);
        const belowSetupEntryZone =
          pullbackBuyEligible && effectiveEntryZoneLow != null && referencePoint.close < effectiveEntryZoneLow;
        const pullbackBuyActionable = isPullbackBuyActionable(referencePoint.close, pullbackBuyPlan, setupPullback.pullbackLow);
        const pullbackBuyStarted =
          pullbackBuyPlan != null && referencePoint.close <= pullbackBuyPlan.firstBuyPrice;
        const pullbackBuyStillValid =
          pullbackBuyPlan != null && referencePoint.close > pullbackBuyPlan.stopLossPrice;
        const validityScore =
          pullbackBuyEligible && pullbackBuyPlan
            ? !pullbackBuyStillValid
              ? 10
              : pullbackBuyStarted
                ? 84
                : 68
            : referencePoint.close < setupPullback.pullbackLow
              ? 10
              : withinSetupEntryZone
                ? 88
                : belowSetupEntryZone
                  ? 42
                  : setupDistancePercent <= filters.maxBreakoutExtensionPercent
                    ? 72
                    : 38;
        const executionReadinessScore =
          pullbackBuyEligible && pullbackBuyPlan
            ? !pullbackBuyStillValid
              ? 8
              : pullbackBuyStarted
                ? 82
                : 48
            : referencePoint.close < setupPullback.pullbackLow
              ? 8
              : withinSetupEntryZone
                ? 90
                : belowSetupEntryZone
                  ? 36
                  : setupDistancePercent <= 2
                    ? 74
                    : 34;
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
        const matched = setupScore >= setupThresholdScore;
        const actionable =
          matched &&
          pullbackBuyEligible &&
          pullbackBuyActionable &&
          validityScore >= filters.minActionableValidityScore &&
          executionReadinessScore >= filters.minExecutionReadinessScore &&
          market.actionableAllowed;
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
          basePrice: preLeadBaseClose,
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
          surgeAdvancePercent,
          surgeDurationDays: surgePeakIndex - leadInIndex,
          leadInVolumeRatio20d: leadInVolume.volumeRatio20d,
          leadInTurnoverValue: leadInVolume.turnoverValue,
          breakout20d: false,
          closedNearHigh: false,
          referenceCloseVsBasePercent,
          referenceCloseVsPeakPercent,
          referenceCloseVsLeadInPercent: percentChange(referencePoint.close, leadInPoint.close),
          referenceCloseVsLeadInHighPercent: percentChange(referencePoint.close, getPointHigh(leadInPoint)),
          referenceCloseVsBreakoutLevelPercent: setupDistancePercent,
          matched,
          actionable,
          entryZoneLow: effectiveEntryZoneLow,
          entryZoneHigh: effectiveEntryZoneHigh,
          invalidationPrice: setupPullback.pullbackLow,
          buyPlanEligible: pullbackBuyEligible,
          minSetupPullbackSessions: filters.minSetupPullbackSessions,
          breakoutHoldTolerancePercent: filters.breakoutHoldTolerancePercent,
          regimeScoreWeight: filters.regimeScoreWeight,
          reasons: [
            `Lead-in on ${leadInPoint.date} printed ${leadInPriceChangePercent.toFixed(1)}% with solid turnover support.`,
            `The stock formed a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile power digestion" : setupPullback.pullbackType === "time_correction" ? "time correction" : "tight price pullback"} with volume cooling to ${((setupPullback.pullbackVolumeRatioToLeadIn ?? 0) * 100).toFixed(0)}% of the surge anchor and close compression of ${setupPullback.closeRangePercent.toFixed(1)}%.`,
            !pullbackBuyEligible
              ? `Current structure is a ${setupPullback.setupType === "time_correction" ? "re-breakout watch" : "setup watch"} rather than a pullback-buy zone because the drawdown and distance profile do not fit the staged-buy archetype.`
              : pullbackBuyActionable
                ? `Current price is inside the staged pullback-buy zone (${effectiveEntryZoneLow?.toFixed(0)}-${effectiveEntryZoneHigh?.toFixed(0)}) that starts after a ${filters.pullbackBuyStartPercentFromPeak}% drawdown from the funded peak.`
                : pullbackBuyStarted
                  ? `Current price is below the 1st buy trigger but too close to or below the protective stop zone (${setupPullback.pullbackLow.toFixed(0)}), so the setup stays under caution.`
                  : `Current price is ${setupDistancePercent.toFixed(1)}% from the structural breakout level; pullback buy only starts once the stock trades at least ${filters.pullbackBuyStartPercentFromPeak}% below the funded peak and above the stop zone (${setupPullback.pullbackLow.toFixed(0)}).`
          ]
        });
        const enhancedSetupMatch = enhanceSmartMoneyMatch({
          match: setupMatch,
          points,
          referenceIndex,
          filters,
          rejectionReasons: !matched
            ? [`Setup score ${setupScore} was below the active threshold ${setupThresholdScore}.`]
            : actionable
              ? []
              : ["Setup is not actionable because validity, readiness, buy-zone location, or regime is weak."]
        });
        allCandidates.push({
          match: enhancedSetupMatch,
          summary: toSummary(enhancedSetupMatch, enhancedSetupMatch.rejectionReasons),
          rejectReasons: []
        });

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
          const breakoutEntryZone = resolveBreakoutRetestZone(
            setupPullback.breakoutLevel,
            setupPullback.pullbackLow,
            filters.maxSetupDistanceBelowBreakoutLevelPercent
          );
          const adjustedBreakoutEntryZone = adjustEntryZoneForMarket(
            breakoutEntryZone.entryZoneLow,
            breakoutEntryZone.entryZoneHigh,
            setupPullback.pullbackLow,
            market
          );
          const breakoutStrengthScore = clamp(Math.round(Math.min(100, (breakoutPriceChangePercent / filters.minBreakoutPriceChangePercent) * 45) * 0.35 + breakoutVolume.volumeQualityScore * 0.35 + (closedNearHigh ? 92 : 60) * 0.15 + clamp((percentChange(breakoutPoint.close, setupPullback.breakoutLevel) ?? 0) * 10 + 60, 0, 100) * 0.15), 0, 100);
          const breakoutScore = clamp(Math.round(setupScore * 0.35 + breakoutStrengthScore * 0.45 + (100 - breakoutFailureRiskScore) * 0.2), 0, 100);
          const matchedBreakout = breakoutScore >= breakoutThresholdScore;
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
            basePrice: preLeadBaseClose,
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
            surgeAdvancePercent,
            surgeDurationDays: surgePeakIndex - leadInIndex,
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
            referenceCloseVsBreakoutLevelPercent: extensionPercent,
            matched: matchedBreakout,
            actionable: actionableBreakout,
            entryZoneLow: adjustedBreakoutEntryZone.entryZoneLow,
            entryZoneHigh: adjustedBreakoutEntryZone.entryZoneHigh,
            invalidationPrice: setupPullback.pullbackLow,
            minSetupPullbackSessions: filters.minSetupPullbackSessions,
            breakoutHoldTolerancePercent: filters.breakoutHoldTolerancePercent,
            regimeScoreWeight: filters.regimeScoreWeight,
            reasons: [
              `Setup from ${leadInPoint.date} to ${surgePeakPoint.date} provided the base for a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile-power-digestion" : setupPullback.pullbackType === "time_correction" ? "time-correction" : "price-pullback"} breakout.`,
              `Breakout on ${breakoutPoint.date} cleared ${setupPullback.breakoutLevel.toFixed(2)} with ${breakoutPriceChangePercent.toFixed(1)}% price expansion and ${breakoutVolume.volumeQualityScore} volume-quality points.`,
              `Reference price is ${extensionPercent.toFixed(1)}% from the breakout level and failure risk is ${breakoutFailureRiskScore}.`
            ]
          });
          const enhancedBreakoutMatch = enhanceSmartMoneyMatch({
            match: breakoutMatch,
            points,
            referenceIndex,
            filters,
            rejectionReasons: !matchedBreakout
              ? [`Breakout score ${breakoutScore} was below the active threshold ${breakoutThresholdScore}.`]
              : actionableBreakout
                ? []
                : ["Breakout is not actionable because it is stale, weakly held, too extended, or regime is poor."]
          });
          allCandidates.push({
            match: enhancedBreakoutMatch,
            summary: toSummary(enhancedBreakoutMatch, enhancedBreakoutMatch.rejectionReasons),
            rejectReasons: []
          });
        }
      }
    }
  }

  const fallbackMatch = buildEmptyMatch(
    referenceDate,
    points.slice(Math.max(0, referenceIndex - filters.lookbackTradingDays + 1), referenceIndex + 1),
    filters.lookbackTradingDays
  );
  const bestMatch =
    [...allCandidates].map((candidate) => candidate.match).sort(compareMatches)[0] ??
    enhanceSmartMoneyMatch({
      match: {
        ...fallbackMatch,
        marketContext: market.appliedContext
      },
      points,
      referenceIndex,
      filters,
      rejectionReasons:
        rejected.slice(0, 5).map((item) => item.reason).filter(Boolean).length > 0
          ? rejected.slice(0, 5).map((item) => item.reason)
          : fallbackMatch.rejectionReasons
    });
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
