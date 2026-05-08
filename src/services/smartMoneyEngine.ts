import type {
  SmartMoneyBuyPlan,
  SmartMoneyAppliedMarketContext,
  ChartPoint,
  SmartMoneyCandidateSummary,
  SmartMoneyClassificationTag,
  SmartMoneyDebugMeta,
  SmartMoneyEntryStrategy,
  SmartMoneyExecutionBucket,
  SmartMoneyMarketContext,
  SmartMoneyPenaltyFactor,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyPullbackType,
  SmartMoneyStopLossReferenceType,
  SmartMoneyTradePlan,
  SmartMoneySetupType,
  SmartMoneyRejectReason
} from "../types.js";
import { enhanceSmartMoneyMatch } from "./smartMoneyEnhancer.js";
import { MARKET_CONTEXT_SETTINGS, resolveSmartMoneyPatternFilters } from "./smartMoney/config.js";
import {
  average,
  averageNumberSeries,
  clamp,
  getAverageCloseThrough,
  getAverageVolumeBefore,
  getHighestCloseBefore,
  getPointHigh,
  getPointLow,
  getStageRank,
  getTurnoverValue,
  getWorkflowStatusRank,
  percentChange,
  ratio,
  resolveWorkflowStatus,
  toSignal
} from "./smartMoney/utils.js";
import { type SmartMoneyPricingContext, normalizePriceByTick, resolveSmartMoneyTickSize } from "./smartMoney/pricing.js";
import { analyzeSwingVolumeProfile } from "./volumeProfile.js";

export { resolveSmartMoneyPatternFilters } from "./smartMoney/config.js";

type SmartMoneyStage = Exclude<SmartMoneyPatternMatch["stage"], "none">;

type CandidateEvaluation = {
  match: SmartMoneyPatternMatch;
  summary: SmartMoneyCandidateSummary;
  rejectReasons: SmartMoneyRejectReason[];
};

type VolumeQuality = ReturnType<typeof scoreVolumeQuality>;

type QualifiedLeadIn = {
  accepted: boolean;
  seedAnchor: boolean;
  volume: VolumeQuality;
  confirmationPoint?: ChartPoint;
  confirmationVolume?: VolumeQuality;
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
  pullbackLowDate?: string;
  pullbackLowType?: SmartMoneyStopLossReferenceType;
  pullbackVolumeRatioToLeadIn?: number;
  pullbackRangePercent: number;
  closeRangePercent: number;
  pullbackMaxDrawdownPercent: number;
  pullbackDownSessions: number;
  rejectReasons: string[];
};

type StopLossReference = {
  price: number;
  date?: string;
  type: SmartMoneyStopLossReferenceType;
};

function getLowestPointReference(points: ChartPoint[], startIndex: number, endIndex: number): StopLossReference | undefined {
  if (startIndex > endIndex || endIndex < 0 || !points.length) {
    return undefined;
  }

  const slice = points.slice(Math.max(0, startIndex), endIndex + 1);
  const lowCandidates = slice
    .map((point) => ({
      date: point.date,
      value: getPointLow(point)
    }))
    .filter((item) => item.value > 0);

  if (lowCandidates.length) {
    const price = Math.min(...lowCandidates.map((item) => item.value));
    return {
      price,
      date: [...lowCandidates].reverse().find((item) => item.value === price)?.date,
      type: "session_low"
    };
  }

  const closeCandidates = slice
    .map((point) => ({
      date: point.date,
      value: point.close
    }))
    .filter((item) => item.value > 0);
  if (!closeCandidates.length) {
    return undefined;
  }

  const price = Math.min(...closeCandidates.map((item) => item.value));
  return {
    price,
    date: [...closeCandidates].reverse().find((item) => item.value === price)?.date,
    type: "close_fallback"
  };
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
    tags: [],
    penaltyFactors: [],
    classificationReasons: ["no_pattern"],
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
  referenceSma20?: number;
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

  const sma20PullbackReference =
    typeof params.referenceSma20 === "number" && Number.isFinite(params.referenceSma20) && params.referenceSma20 > 0
      ? Math.min(params.referenceSma20, params.breakoutLevel)
      : undefined;
  if (sma20PullbackReference != null && sma20PullbackReference > 0) {
    // Pullback entries should be staged after price comes into the 20-day line, not above it.
    // Bias the whole buy zone below SMA20 so the displayed first area does not chase the bounce.
    const proximityRatio = clamp(params.filters.firstBuySma20ProximityPercent / 100, 0.005, 0.08);
    const entryZoneHigh = sma20PullbackReference * (1 - proximityRatio);
    const entryZoneLow = sma20PullbackReference * (1 - proximityRatio * 2);
    if (entryZoneLow < entryZoneHigh) {
      return {
        entryZoneLow,
        entryZoneHigh
      };
    }
  }

  if (params.setupType === "support_holding_pullback") {
    return {
      entryZoneLow: scaleBetween(normalizedPullbackLow, params.breakoutLevel, 0.05),
      entryZoneHigh: scaleBetween(normalizedPullbackLow, params.breakoutLevel, 0.35)
    };
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

function roundPriceLevel(value: number, pricingContext?: SmartMoneyPricingContext, mode: "nearest" | "up" | "down" = "nearest"): number {
  return normalizePriceByTick(value, pricingContext, mode) ?? value;
}

function getAverageTurnoverBefore(points: ChartPoint[], index: number, period = 20): number | undefined {
  return averageNumberSeries(
    points.slice(Math.max(0, index - period), index).map((point) => getTurnoverValue(point))
  );
}

function getSma20SlopePercent(points: ChartPoint[], index: number, lookbackSessions = 5): number | undefined {
  const currentSma20 = getAverageCloseThrough(points, index, 20);
  const priorSma20 = getAverageCloseThrough(points, index - lookbackSessions, 20);
  return currentSma20 != null && priorSma20 != null ? percentChange(currentSma20, priorSma20) : undefined;
}

function getRiskRewardRatioFromCandidate(
  buyPlan: SmartMoneyBuyPlan | undefined,
  entryZoneLow: number | undefined,
  entryZoneHigh: number | undefined,
  invalidationPrice: number | undefined,
  breakoutLevel: number | undefined,
  referenceClose: number | undefined
) {
  const zoneLow = buyPlan?.thirdBuyPrice ?? entryZoneLow;
  const zoneHigh = buyPlan?.firstBuyPrice ?? entryZoneHigh;
  const stopLoss = buyPlan?.stopLossPrice ?? invalidationPrice;
  const entryPrice = zoneLow != null && zoneHigh != null ? (Math.min(zoneLow, zoneHigh) + Math.max(zoneLow, zoneHigh)) / 2 : undefined;
  const targetPrice =
    breakoutLevel != null && entryPrice != null && stopLoss != null
      ? Math.max(breakoutLevel, referenceClose ?? breakoutLevel) + (entryPrice - stopLoss) * 2
      : undefined;

  if (entryPrice == null || stopLoss == null || targetPrice == null || entryPrice <= stopLoss) {
    return undefined;
  }

  return Math.round(((targetPrice - entryPrice) / (entryPrice - stopLoss)) * 100) / 100;
}

function deriveActionableThresholds(
  stage: Exclude<SmartMoneyPatternMatch["stage"], "none">,
  market: MarketEvaluation,
  filters: SmartMoneyPatternFilters
) {
  let validityMin = stage === "breakout" ? filters.breakoutValidityMin : filters.setupValidityMin;
  let executionMin = stage === "breakout" ? filters.breakoutExecutionMin : filters.setupExecutionMin;

  if (market.appliedContext.resolvedTrend === "bullish" && stage === "breakout") {
    validityMin -= filters.bullBreakoutThresholdRelief;
    executionMin -= filters.bullBreakoutThresholdRelief;
  }

  if (market.appliedContext.resolvedTrend === "bearish" && stage === "setup") {
    validityMin += filters.bearSetupThresholdTightening;
    executionMin += filters.bearSetupThresholdTightening;
  }

  return {
    validityMin: clamp(Math.round(validityMin), 0, 100),
    executionMin: clamp(Math.round(executionMin), 0, 100)
  };
}

function createPenaltyFactor(
  code: string,
  label: string,
  impact: number,
  reason: string
): SmartMoneyPenaltyFactor {
  return {
    code,
    label,
    impact,
    reason
  };
}

function deriveSupportStabilityScore(params: {
  pullback: PullbackAssessment;
  referenceCloseVsBreakoutLevelPercent?: number;
  referenceClose: number;
  invalidationPrice?: number;
  setupType?: SmartMoneySetupType;
}) {
  const supportHoldingMode = params.setupType === "support_holding_pullback";
  let score = supportHoldingMode ? 96 : 88;

  if (params.pullback.closeRangePercent <= 6) {
    score += 4;
  } else if (params.pullback.closeRangePercent >= 12) {
    score -= 8;
  }

  if (params.pullback.pullbackMaxDrawdownPercent > 15) {
    score -= supportHoldingMode ? 12 : 28;
  } else if (params.pullback.pullbackMaxDrawdownPercent > 12) {
    score -= supportHoldingMode ? 8 : 20;
  } else if (params.pullback.pullbackMaxDrawdownPercent > 9) {
    score -= supportHoldingMode ? 4 : 12;
  } else if (params.pullback.pullbackMaxDrawdownPercent > 7) {
    score -= supportHoldingMode ? 2 : 6;
  }

  if (params.pullback.pullbackRangePercent > 20) {
    score -= supportHoldingMode ? 8 : 18;
  } else if (params.pullback.pullbackRangePercent > 15) {
    score -= supportHoldingMode ? 4 : 10;
  } else if (params.pullback.pullbackRangePercent > 10) {
    score -= supportHoldingMode ? 2 : 4;
  }

  if (params.pullback.pullbackDownSessions > 6) {
    score -= supportHoldingMode ? 6 : 12;
  } else if (params.pullback.pullbackDownSessions > 4) {
    score -= supportHoldingMode ? 3 : 6;
  }

  if (supportHoldingMode) {
    if ((params.referenceCloseVsBreakoutLevelPercent ?? 0) < -28) {
      score -= 8;
    } else if ((params.referenceCloseVsBreakoutLevelPercent ?? 0) < -20) {
      score -= 4;
    }
  } else if ((params.referenceCloseVsBreakoutLevelPercent ?? 0) < -8) {
    score -= 14;
  } else if ((params.referenceCloseVsBreakoutLevelPercent ?? 0) < -4) {
    score -= 8;
  }

  if (params.invalidationPrice != null) {
    if (params.referenceClose <= params.invalidationPrice * 1.02) {
      score -= 20;
    } else if (params.referenceClose <= params.invalidationPrice * 1.06) {
      score -= 10;
    }
  }

  return clamp(Math.round(score), 0, 100);
}

function deriveVolumeContractionScore(pullback: PullbackAssessment) {
  const ratioToLeadIn = pullback.pullbackVolumeRatioToLeadIn;
  if (ratioToLeadIn == null) {
    return 45;
  }

  if (ratioToLeadIn <= 0.18) {
    return 92;
  }

  if (ratioToLeadIn <= 0.3) {
    return 78;
  }

  if (ratioToLeadIn <= 0.45) {
    return 58;
  }

  return 34;
}

function isBaseReclaimWatchEligible(params: {
  pullback: PullbackAssessment;
  pullbackSessions: number;
  referenceCloseVsBasePercent?: number;
  referenceClose: number;
  invalidationPrice?: number;
  volumeContractionScore: number;
  riskRewardRatio?: number;
  filters: SmartMoneyPatternFilters;
}) {
  if (params.pullback.setupType !== "tight_price_pullback" && params.pullback.setupType !== "time_correction") {
    return false;
  }

  if (
    params.referenceCloseVsBasePercent == null ||
    params.referenceCloseVsBasePercent >= params.filters.minReferenceCloseVsBasePercent
  ) {
    return false;
  }

  if ((params.pullback.pullbackVolumeRatioToLeadIn ?? Infinity) > params.filters.maxPullbackAvgVolumeRatio) {
    return false;
  }

  if (params.pullback.pullbackDownSessions < params.filters.minSetupDownSessions) {
    return false;
  }

  if (params.pullback.pullbackLow == null || params.invalidationPrice == null) {
    return false;
  }

  if (params.pullback.pullbackLow >= params.referenceClose) {
    return false;
  }

  if ((params.pullback.pullbackVolumeRatioToLeadIn ?? Infinity) > 0.18) {
    return false;
  }

  if (params.pullbackSessions < params.filters.baseReclaimWatchMinPullbackSessions) {
    return false;
  }

  if (params.volumeContractionScore < params.filters.baseReclaimWatchMinVolumeContractionScore) {
    return false;
  }

  if ((params.riskRewardRatio ?? 0) < params.filters.baseReclaimWatchMinRiskRewardRatio) {
    return false;
  }

  if (params.referenceClose <= params.invalidationPrice * params.filters.baseReclaimWatchMinStopDistanceRatio) {
    return false;
  }

  return true;
}

function scoreCandleQuality(
  point: ChartPoint,
  previousClose: number | undefined,
  stage: "setup" | "breakout"
): {
  candleQualityScore: number;
  tags: SmartMoneyClassificationTag[];
  penaltyFactors: SmartMoneyPenaltyFactor[];
} {
  const open = point.open ?? previousClose ?? point.close;
  const high = getPointHigh(point);
  const low = getPointLow(point);
  const range = Math.max(high - low, Math.max(point.close * 0.001, 0.01));
  const body = Math.abs(point.close - open);
  const upperWick = Math.max(0, high - Math.max(open, point.close));
  const closePosition = (point.close - low) / range;
  const bodyRatio = body / range;
  const upperWickRatio = upperWick / range;
  const gapUpPercent = previousClose != null ? percentChange(open, previousClose) ?? 0 : 0;
  const gapRejected = gapUpPercent >= 3 && point.close < open && closePosition < 0.55;
  const tags: SmartMoneyClassificationTag[] = [];
  const penaltyFactors: SmartMoneyPenaltyFactor[] = [];
  let score = stage === "breakout" ? 84 : 78;

  if (upperWickRatio >= 0.32) {
    score -= 18;
    tags.push("tag_candle_rejection");
    penaltyFactors.push(
      createPenaltyFactor(
        "upper_wick_rejection",
        "Upper wick rejection",
        18,
        `Upper wick consumed ${(upperWickRatio * 100).toFixed(0)}% of the candle range.`
      )
    );
  }

  if (closePosition < 0.68) {
    score -= 10;
    tags.push("tag_candle_weak");
    penaltyFactors.push(
      createPenaltyFactor(
        "weak_close_position",
        "Weak close location",
        10,
        `Close finished only ${(closePosition * 100).toFixed(0)}% up the candle range.`
      )
    );
  }

  if (bodyRatio < 0.28) {
    score -= 8;
    penaltyFactors.push(
      createPenaltyFactor(
        "small_body",
        "Small real body",
        8,
        `Real body was only ${(bodyRatio * 100).toFixed(0)}% of the full range.`
      )
    );
  }

  if (gapRejected) {
    score -= 16;
    tags.push("tag_candle_rejection");
    penaltyFactors.push(
      createPenaltyFactor(
        "gap_rejection",
        "Gap rejection",
        16,
        `Gap extension of ${gapUpPercent.toFixed(1)}% was sold back intraday.`
      )
    );
  }

  return {
    candleQualityScore: clamp(Math.round(score), 0, 100),
    tags: [...new Set(tags)],
    penaltyFactors
  };
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
  market: MarketEvaluation,
  pricingContext?: SmartMoneyPricingContext
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
      entryZoneLow: roundPriceLevel(shiftedLow, pricingContext, "down"),
      entryZoneHigh: roundPriceLevel(Math.max(shiftedHigh, shiftedLow * 1.01), pricingContext, "down")
    };
  }

  const safeLow = Math.max(shiftedLow, stopLossPrice * 1.015);
  const safeHigh = Math.max(shiftedHigh, safeLow * 1.01, stopLossPrice * 1.04);
  return {
    entryZoneLow: roundPriceLevel(safeLow, pricingContext, "down"),
    entryZoneHigh: roundPriceLevel(safeHigh, pricingContext, "down")
  };
}

function buildBuyPlan(
  entryZoneLow?: number,
  entryZoneHigh?: number,
  stopLossPrice?: number,
  pricingContext?: SmartMoneyPricingContext
): SmartMoneyBuyPlan | undefined {
  if (entryZoneLow == null || entryZoneHigh == null) {
    return undefined;
  }

  const low = Math.min(entryZoneLow, entryZoneHigh);
  const high = Math.max(entryZoneLow, entryZoneHigh);
  const mid = (low + high) / 2;
  const normalizedStopLossPrice = stopLossPrice != null && stopLossPrice > 0 ? stopLossPrice : low;
  const minimumRiskTick = resolveSmartMoneyTickSize(Math.max(normalizedStopLossPrice, low, high), pricingContext);
  const firstBuyPrice = roundPriceLevel(high, pricingContext, "down");
  const secondBuyPrice = roundPriceLevel(mid, pricingContext, "down");
  const roundedStopLossPrice = roundPriceLevel(normalizedStopLossPrice, pricingContext, "down");
  const thirdBuyPrice = Math.max(
    roundPriceLevel(low, pricingContext, "down"),
    roundPriceLevel(roundedStopLossPrice + minimumRiskTick, pricingContext, "up")
  );

  if (roundedStopLossPrice >= firstBuyPrice) {
    return undefined;
  }
  if (thirdBuyPrice > firstBuyPrice) {
    return undefined;
  }

  return {
    firstBuyPrice,
    secondBuyPrice: Math.max(secondBuyPrice, thirdBuyPrice),
    thirdBuyPrice,
    stopLossPrice: roundedStopLossPrice
  };
}

function resolvePullbackBuyPlan(params: {
  referenceSma20?: number;
  invalidationPrice: number;
  firstBuySma20ProximityPercent: number;
  secondEntryRiskRatio: number;
  thirdEntryRiskRatio: number;
  pricingContext?: SmartMoneyPricingContext;
}): SmartMoneyBuyPlan | undefined {
  const referenceSma20 = params.referenceSma20;
  if (referenceSma20 == null || referenceSma20 <= 0) {
    return undefined;
  }

  // Pullback buys should wait for price to come into the 20-day line from above.
  // Keep the first staged bid below SMA20 instead of placing it directly on the moving average.
  const firstBuyPrice = referenceSma20 * (1 - clamp(params.firstBuySma20ProximityPercent / 100, 0.005, 0.08));
  const stopLossPrice =
    params.invalidationPrice > 0 && params.invalidationPrice < firstBuyPrice
      ? params.invalidationPrice
      : undefined;
  if (stopLossPrice == null || stopLossPrice <= 0 || stopLossPrice >= firstBuyPrice) {
    return undefined;
  }

  const riskBand = firstBuyPrice - stopLossPrice;
  const minimumRiskTick = resolveSmartMoneyTickSize(firstBuyPrice, params.pricingContext);
  const roundedFirstBuyPrice = roundPriceLevel(firstBuyPrice, params.pricingContext, "down");
  const secondBuyByRiskBand = stopLossPrice + riskBand * params.secondEntryRiskRatio;
  // Show the full 3-step plan by spacing 2nd and 3rd bids inside the 1st-buy/stop band.
  // The ratios keep scale consistent whether the stop is shallow or deep.
  const roundedSecondBuyPrice = roundPriceLevel(
    Math.min(secondBuyByRiskBand, firstBuyPrice - minimumRiskTick),
    params.pricingContext,
    "down"
  );
  const roundedStopLossPrice = roundPriceLevel(stopLossPrice, params.pricingContext, "down");
  const roundedThirdBuyPrice = Math.max(
    roundPriceLevel(stopLossPrice + riskBand * params.thirdEntryRiskRatio, params.pricingContext, "down"),
    roundPriceLevel(roundedStopLossPrice + minimumRiskTick, params.pricingContext, "up")
  );

  if (roundedStopLossPrice >= roundedFirstBuyPrice) {
    return undefined;
  }
  if (roundedThirdBuyPrice > roundedFirstBuyPrice) {
    return undefined;
  }

  return {
    firstBuyPrice: roundedFirstBuyPrice,
    secondBuyPrice: Math.max(roundedSecondBuyPrice, roundedThirdBuyPrice),
    thirdBuyPrice: roundedThirdBuyPrice,
    stopLossPrice: roundedStopLossPrice
  };
}

function isPullbackBuySetup(params: {
  setupType?: SmartMoneySetupType;
  leadInPriceChangePercent: number;
  pullbackMaxDrawdownPercent: number;
  referenceCloseVsBreakoutLevelPercent?: number;
  filters: SmartMoneyPatternFilters;
}) {
  if (params.pullbackMaxDrawdownPercent < params.filters.pullbackBuyStartPercentFromPeak) {
    return false;
  }

  if (params.setupType === "volatile_power_digestion") {
    return true;
  }

  if (params.setupType !== "tight_price_pullback") {
    return false;
  }

  const distanceBelowBreakout = Math.abs(Math.min(params.referenceCloseVsBreakoutLevelPercent ?? 0, 0));
  return (
    params.leadInPriceChangePercent >= params.filters.minTightPullbackBuyLeadInPriceChangePercent &&
    params.pullbackMaxDrawdownPercent >= Math.max(params.filters.minPullbackBuyDrawdownPercent, params.filters.pullbackBuyStartPercentFromPeak) &&
    distanceBelowBreakout >= params.filters.minPullbackBuyDistanceBelowBreakoutPercent
  );
}

function hasReachedSma20BuyZone(referenceClose: number, buyPlan: SmartMoneyBuyPlan | undefined, proximityPercent: number) {
  if (!buyPlan) {
    return false;
  }

  const upperBound = buyPlan.firstBuyPrice * (1 + proximityPercent / 100);
  const lowerBound = buyPlan.firstBuyPrice * (1 - proximityPercent / 100);
  return referenceClose <= upperBound && referenceClose >= lowerBound;
}

function isPullbackBuyActionable(
  referenceClose: number,
  buyPlan: SmartMoneyBuyPlan | undefined,
  invalidationPrice: number | undefined,
  proximityPercent: number
) {
  if (!buyPlan) {
    return false;
  }

  if (invalidationPrice != null && invalidationPrice > 0 && referenceClose <= invalidationPrice) {
    return false;
  }

  return hasReachedSma20BuyZone(referenceClose, buyPlan, proximityPercent) && referenceClose > buyPlan.stopLossPrice;
}

function deriveEntryStrategy(stage: SmartMoneyPatternMatch["stage"], status: SmartMoneyPatternMatch["status"]): SmartMoneyEntryStrategy | undefined {
  if (stage === "breakout") {
    if (status === "breakout_extended") {
      return "no_chase";
    }
    return status === "breakout_confirmed" ? "breakout_confirmed" : "breakout_ready";
  }
  if (stage === "setup" && status === "breakout_extended") {
    return "no_chase";
  }
  if (stage === "setup" && status === "buy_ready") {
    return "pullback_buy";
  }
  return undefined;
}

function scoreVolumeQuality(
  point: ChartPoint,
  averageVolume20: number | undefined,
  averageTurnover20: number | undefined,
  minVolumeRatio: number,
  minVolumeShares: number,
  minTurnoverValue: number
) {
  const volumeRatio20d = ratio(point.volume, averageVolume20);
  const absoluteVolume = point.volume;
  const turnoverValue = getTurnoverValue(point);
  const turnoverProxy20d = ratio(turnoverValue, averageTurnover20);
  const relativeScore =
    volumeRatio20d == null ? 0 : volumeRatio20d >= minVolumeRatio + 2 ? 95 : volumeRatio20d >= minVolumeRatio ? 70 : volumeRatio20d >= minVolumeRatio * 0.75 ? 45 : 20;
  const absoluteVolumeScore =
    absoluteVolume == null ? 0 : absoluteVolume >= minVolumeShares * 3 ? 95 : absoluteVolume >= minVolumeShares ? 68 : absoluteVolume >= minVolumeShares * 0.7 ? 42 : 15;
  const turnoverScore =
    turnoverValue == null ? 0 : turnoverValue >= minTurnoverValue * 3 ? 95 : turnoverValue >= minTurnoverValue ? 68 : turnoverValue >= minTurnoverValue * 0.7 ? 42 : 15;
  const turnoverProxyScore =
    turnoverProxy20d == null ? 0 : turnoverProxy20d >= minVolumeRatio * 0.9 ? 92 : turnoverProxy20d >= minVolumeRatio * 0.7 ? 70 : turnoverProxy20d >= minVolumeRatio * 0.5 ? 45 : 18;
  const lowPricePenalty = point.close < 1500 ? 10 : point.close < 5000 ? 5 : 0;
  const weakValuePenalty = turnoverValue != null && turnoverValue < minTurnoverValue * 0.85 ? 6 : 0;
  const penaltyFactors: SmartMoneyPenaltyFactor[] = [];
  const tags: SmartMoneyClassificationTag[] = [];

  if (lowPricePenalty > 0) {
    penaltyFactors.push(
      createPenaltyFactor(
        "low_price_liquidity",
        "Low price liquidity drag",
        lowPricePenalty,
        `Reference price ${point.close.toFixed(0)} is low enough that raw share count can overstate true liquidity.`
      )
    );
  }

  if (weakValuePenalty > 0) {
    penaltyFactors.push(
      createPenaltyFactor(
        "weak_turnover_value",
        "Weak trading value",
        weakValuePenalty,
        `Trading value ${Math.round(turnoverValue ?? 0).toLocaleString("en-US")} is still below the preferred turnover quality band.`
      )
    );
    tags.push("tag_volume_weak");
  } else if (turnoverProxy20d != null && turnoverProxy20d >= minVolumeRatio) {
    tags.push("tag_volume_turnover_strong");
  }

  return {
    absoluteVolume,
    volumeRatio20d,
    turnoverValue,
    turnoverProxy20d,
    penaltyFactors,
    tags,
    volumeQualityScore: clamp(
      Math.round(relativeScore * 0.35 + absoluteVolumeScore * 0.15 + turnoverScore * 0.35 + turnoverProxyScore * 0.15 - lowPricePenalty - weakValuePenalty),
      0,
      100
    ),
    passed:
      volumeRatio20d != null &&
      volumeRatio20d >= minVolumeRatio &&
      absoluteVolume != null &&
      absoluteVolume >= minVolumeShares &&
      turnoverValue != null &&
      turnoverValue >= minTurnoverValue
  };
}

function resolveQualifiedLeadIn(params: {
  points: ChartPoint[];
  leadInIndex: number;
  surgePeakIndex?: number;
  filters: SmartMoneyPatternFilters;
}): QualifiedLeadIn {
  const { points, leadInIndex, surgePeakIndex, filters } = params;
  const leadInPoint = points[leadInIndex];
  const leadInPrevious = points[leadInIndex - 1];
  const leadInPriceChangePercent = leadInPoint && leadInPrevious ? percentChange(leadInPoint.close, leadInPrevious.close) : undefined;
  const leadInVolume = scoreVolumeQuality(
    leadInPoint,
    getAverageVolumeBefore(points, leadInIndex, 20),
    getAverageTurnoverBefore(points, leadInIndex, 20),
    filters.minLeadInVolumeRatio,
    filters.minLeadInVolumeShares,
    filters.minTurnoverValue
  );
  const leadInReferenceOpen = leadInPoint.open ?? leadInPrevious?.close;
  const leadInBullishBody = leadInReferenceOpen != null && leadInPoint.close > leadInReferenceOpen;
  const leadInClosedStrong = leadInPoint.close >= getPointHigh(leadInPoint) * 0.94;
  const priceAndCandleAccepted =
    leadInPriceChangePercent != null &&
    leadInPriceChangePercent >= filters.minLeadInPriceChangePercent &&
    leadInBullishBody &&
    leadInClosedStrong;

  if (priceAndCandleAccepted && leadInVolume.passed) {
    return {
      accepted: true,
      seedAnchor: false,
      volume: leadInVolume
    };
  }

  const seedAnchor =
    priceAndCandleAccepted &&
    (leadInVolume.volumeRatio20d ?? 0) >= filters.minLeadInVolumeRatio &&
    (leadInVolume.turnoverValue ?? 0) >= filters.minTurnoverValue &&
    (leadInVolume.absoluteVolume ?? 0) >= filters.minLeadInVolumeShares * 0.1;

  if (!seedAnchor || surgePeakIndex == null) {
    return {
      accepted: false,
      seedAnchor,
      volume: leadInVolume
    };
  }

  const confirmationPoint = points[surgePeakIndex];
  const confirmationVolume = scoreVolumeQuality(
    confirmationPoint,
    getAverageVolumeBefore(points, surgePeakIndex, 20),
    getAverageTurnoverBefore(points, surgePeakIndex, 20),
    filters.minLeadInVolumeRatio,
    filters.minLeadInVolumeShares,
    filters.minTurnoverValue
  );
  const confirmationWithinWindow = surgePeakIndex > leadInIndex && surgePeakIndex <= leadInIndex + 5;

  return {
    accepted: confirmationWithinWindow && confirmationVolume.passed,
    seedAnchor: true,
    volume: confirmationWithinWindow && confirmationVolume.passed ? confirmationVolume : leadInVolume,
    confirmationPoint: confirmationWithinWindow ? confirmationPoint : undefined,
    confirmationVolume: confirmationWithinWindow ? confirmationVolume : undefined
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
  const lowCandidates = pullbackPoints
    .map((point) => ({
      date: point.date,
      value: getPointLow(point)
    }))
    .filter((item) => item.value > 0);
  const closeCandidates = pullbackPoints.map((point) => ({
    date: point.date,
    value: point.close
  }));
  const lowestLow = lowCandidates.length ? Math.min(...lowCandidates.map((item) => item.value)) : undefined;
  const lowestClose = Math.min(...pullbackPoints.map((point) => point.close));
  const highestClose = Math.max(...pullbackPoints.map((point) => point.close));
  const stopLossReferenceType: SmartMoneyStopLossReferenceType = lowestLow != null ? "session_low" : "close_fallback";
  const stopLossReferencePrice = lowestLow ?? lowestClose;
  const stopLossReferenceDate =
    stopLossReferenceType === "session_low"
      ? [...lowCandidates].reverse().find((item) => item.value === lowestLow)?.date
      : [...closeCandidates].reverse().find((item) => item.value === lowestClose)?.date;
  const pullbackAvgVolume = averageNumberSeries(pullbackPoints.map((point) => point.volume));
  const pullbackVolumeRatioToLeadIn = ratio(pullbackAvgVolume, Math.max(leadInPoint.volume ?? 0, surgePeakPoint.volume ?? 0) || undefined);
  const pullbackMaxDrawdownPercent = Math.abs(percentChange(lowestClose, surgePeakPoint.close) ?? 0);
  const pullbackRangePercent = Math.abs(percentChange(highestHigh, stopLossReferencePrice) ?? 0);
  const closeRangePercent = Math.abs(percentChange(highestClose, lowestClose) ?? 0);
  const pullbackDownSessions = pullbackPoints.reduce((count, point, index) => count + (point.close < (index === 0 ? surgePeakPoint.close : pullbackPoints[index - 1].close) ? 1 : 0), 0);
  const referenceCloseVsPeakPercent = percentChange(referencePoint.close, surgePeakPoint.close) ?? -100;
  const referenceCloseVsLeadInPercent = percentChange(referencePoint.close, leadInPoint.close) ?? -100;
  const supportHoldingRangePercent = Math.abs(percentChange(stopLossReferencePrice, getPointHigh(surgePeakPoint)) ?? 0);
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
  const supportHoldingValid =
    pullbackPoints.length >= filters.minSetupPullbackSessions &&
    pullbackDownSessions >= filters.minSetupDownSessions &&
    pullbackMaxDrawdownPercent >= Math.max(filters.minPullbackDrawdownPercent, filters.pullbackBuyStartPercentFromPeak) &&
    pullbackMaxDrawdownPercent <= filters.maxSetupPullbackDrawdownPercent &&
    supportHoldingRangePercent <= filters.maxSetupPullbackRangePercent &&
    referencePoint.close > stopLossReferencePrice &&
    referenceCloseVsLeadInPercent >= Math.max(filters.minVolatileDigestionReferenceCloseVsLeadInPercent, -15);
  const rejectReasons: string[] = [];
  const volumeContractionThreshold = volatilePowerDigestionValid
    ? Math.min(filters.maxPullbackAvgVolumeRatio, filters.maxVolatileDigestionAvgVolumeRatio)
    : filters.maxPullbackAvgVolumeRatio;
  if (pullbackVolumeRatioToLeadIn == null || pullbackVolumeRatioToLeadIn > volumeContractionThreshold) {
    rejectReasons.push("Pullback volume did not contract enough.");
  }
  if (!pricePullbackValid && !timeCorrectionValid && !volatilePowerDigestionValid && !supportHoldingValid) {
    rejectReasons.push("Consolidation was neither a clean price pullback, a tight time correction, nor a volatile power digestion.");
  }

  const setupType = timeCorrectionValid
    ? "time_correction"
    : supportHoldingValid
      ? "support_holding_pullback"
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
        : setupType === "volatile_power_digestion" || setupType === "tight_price_pullback" || setupType === "support_holding_pullback"
          ? "price_pullback"
          : undefined,
    setupType,
    breakoutLevel: Math.max(getPointHigh(surgePeakPoint), highestHigh),
    pullbackLow: stopLossReferencePrice,
    pullbackLowDate: stopLossReferenceDate,
    pullbackLowType: stopLossReferenceType,
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
    executionBucket: match.executionBucket,
    buyPlan: match.buyPlan,
    referenceSma20: match.referenceSma20,
    stopLossReferenceDate: match.stopLossReferenceDate,
    stopLossReferenceType: match.stopLossReferenceType,
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
    candleQualityScore: match.candleQualityScore,
    volumeContractionScore: match.volumeContractionScore,
    supportStabilityScore: match.supportStabilityScore,
    sma20SlopePercent: match.sma20SlopePercent,
    riskRewardRatio: match.riskRewardRatio,
    tags: match.tags,
    penaltyFactors: match.penaltyFactors,
    reasons: match.reasons,
    rejectReasons
  };
}

function applySwingVolumeProfileScore(match: SmartMoneyPatternMatch, points: ChartPoint[]): SmartMoneyPatternMatch {
  const swingVolumeProfile = analyzeSwingVolumeProfile(points, {
    trendScore: match.regimeScore,
    volumeScore: Math.max(match.volumeQualityScore ?? 0, match.breakoutStrengthScore ?? 0),
    themeScore: match.marketContextScore,
    pullbackScore: Math.max(match.supportStabilityScore ?? 0, match.executionReadinessScore ?? 0),
    riskScore: match.dangerScore
  });
  const riskAdjustment = Math.min(0, swingVolumeProfile.score);
  const rankingSupportAdjustment = Math.min(8, Math.max(0, swingVolumeProfile.score));

  return {
    ...match,
    swingVolumeProfile,
    patternScore: clamp(Math.round(match.patternScore + riskAdjustment), 0, 100),
    regimeAdjustedScore:
      match.regimeAdjustedScore == null ? undefined : clamp(Math.round(match.regimeAdjustedScore + riskAdjustment), 0, 100),
    finalRankScore:
      match.finalRankScore == null ? undefined : clamp(Math.round(match.finalRankScore + riskAdjustment + rankingSupportAdjustment), 0, 100),
    reasons: [
      ...match.reasons,
      `${swingVolumeProfile.summary} 매물대 점수는 보조 지표이며 단독 매수 신호로 사용하지 않습니다.`
    ],
    summary: `${match.summary} ${swingVolumeProfile.summary}`
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
  candleQualityScore?: number;
  breakoutStrengthScore: number;
  breakoutFailureRiskScore: number;
  freshnessScore: number;
  validityScore: number;
  executionReadinessScore: number;
  volumeContractionScore?: number;
  supportStabilityScore?: number;
  sma20SlopePercent?: number;
  riskRewardRatio?: number;
  pullback: PullbackAssessment;
  leadInPriceChangePercent: number;
  surgeAdvancePercent?: number;
  surgeDurationDays?: number;
  displayLeadInVolume?: number;
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
  tags?: SmartMoneyClassificationTag[];
  penaltyFactors?: SmartMoneyPenaltyFactor[];
  classificationReasons?: string[];
  reasons: string[];
  entryZoneLow?: number;
  entryZoneHigh?: number;
  invalidationPrice?: number;
  buyPlan?: SmartMoneyBuyPlan;
  buyPlanEligible?: boolean;
  referenceSma20?: number;
  stopLossReference?: StopLossReference;
  minSetupPullbackSessions: number;
  breakoutHoldTolerancePercent: number;
  maxBreakoutExtensionPercent: number;
  regimeScoreWeight: number;
  pricingContext?: SmartMoneyPricingContext;
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
    breakoutHoldTolerancePercent: params.breakoutHoldTolerancePercent,
    maxBreakoutExtensionPercent: params.maxBreakoutExtensionPercent
  });
  const entryStrategy = deriveEntryStrategy(params.stage, status);
  const buyPlan =
    params.buyPlan ??
    (params.buyPlanEligible
      ? buildBuyPlan(params.entryZoneLow, params.entryZoneHigh, params.invalidationPrice, params.pricingContext)
      : undefined);
  return {
    matched: params.matched,
    actionable: params.actionable,
    stage: params.stage,
    status,
    entryStrategy,
    buyPlan,
    referenceSma20: params.referenceSma20,
    stopLossReferenceDate: params.stopLossReference?.date,
    stopLossReferenceType: params.stopLossReference?.type,
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
    candleQualityScore: params.candleQualityScore,
    breakoutStrengthScore: params.breakoutStrengthScore,
    breakoutFailureRiskScore: params.breakoutFailureRiskScore,
    freshnessScore: params.freshnessScore,
    validityScore: params.validityScore,
    executionReadinessScore: params.executionReadinessScore,
    volumeContractionScore: params.volumeContractionScore,
    supportStabilityScore: params.supportStabilityScore,
    sma20SlopePercent: params.sma20SlopePercent,
    riskRewardRatio: params.riskRewardRatio,
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
    tags: [...new Set(params.tags ?? [])],
    penaltyFactors: params.penaltyFactors ?? [],
    classificationReasons: [...new Set(params.classificationReasons ?? [])],
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
    leadInVolume: params.displayLeadInVolume ?? params.leadInPoint.volume,
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
  options?: { marketContext?: SmartMoneyMarketContext; debug?: boolean; pricingContext?: SmartMoneyPricingContext }
): SmartMoneyPatternMatch {
  const filters = resolveSmartMoneyPatternFilters(filtersInput);
  const referencePoint = points[referenceIndex];
  const referenceDate = referencePoint?.date ?? "";
  const referenceSma20 = getAverageCloseThrough(points, referenceIndex, 20);
  const visibleStopLossReference = getLowestPointReference(
    points,
    Math.max(0, referenceIndex - filters.stopLossLookbackSessions + 1),
    referenceIndex
  );
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
      const leadInVolume = scoreVolumeQuality(
        leadInPoint,
        getAverageVolumeBefore(points, leadInIndex, 20),
        getAverageTurnoverBefore(points, leadInIndex, 20),
        filters.minLeadInVolumeRatio,
        filters.minLeadInVolumeShares,
        filters.minTurnoverValue
      );
      const leadInCandleQuality = scoreCandleQuality(leadInPoint, leadInPrevious.close, "setup");
      const baseLeadInQualification = resolveQualifiedLeadIn({
        points,
        leadInIndex,
        filters
      });
      if (!baseLeadInQualification.accepted && !baseLeadInQualification.seedAnchor) {
        rejected.push(
          createRejectReason("setup", lookbackWindowDays, "Lead-in impulse failed price, relative volume, absolute volume, or turnover filters.", leadInPoint.date)
        );
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
        const qualifiedLeadIn = baseLeadInQualification.accepted
          ? baseLeadInQualification
          : resolveQualifiedLeadIn({
              points,
              leadInIndex,
              surgePeakIndex,
              filters
            });
        if (!qualifiedLeadIn.accepted) {
          rejected.push(
            createRejectReason(
              "setup",
              lookbackWindowDays,
              "Seed lead-in price impulse did not get enough follow-through liquidity confirmation.",
              leadInPoint.date,
              surgePeakPoint.date
            )
          );
          continue;
        }
        const effectiveLeadInVolume = qualifiedLeadIn.volume;
        const qualifiedLeadInPriceChangePercent = leadInPriceChangePercent ?? 0;

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
        if (referenceCloseVsBasePercent == null || referenceCloseVsPeakPercent == null || referenceCloseVsPeakPercent > filters.maxSetupCloseVsPeakPercent) {
          continue;
        }

        const setupDistancePercent = percentChange(referencePoint.close, setupPullback.breakoutLevel) ?? -100;
        const setupEntryZone = resolveSetupEntryZone({
          breakoutLevel: setupPullback.breakoutLevel,
          pullbackLow: setupPullback.pullbackLow,
          referenceSma20,
          setupType: setupPullback.setupType,
          filters
        });
        const pullbackBuyEligible = isPullbackBuySetup({
          setupType: setupPullback.setupType,
          leadInPriceChangePercent: qualifiedLeadInPriceChangePercent,
          pullbackMaxDrawdownPercent: setupPullback.pullbackMaxDrawdownPercent,
          referenceCloseVsBreakoutLevelPercent: setupDistancePercent,
          filters
        });
        const stopLossReference =
          visibleStopLossReference && visibleStopLossReference.price > 0
            ? visibleStopLossReference
            : {
                price: setupPullback.pullbackLow,
                date: setupPullback.pullbackLowDate,
                type: setupPullback.pullbackLowType ?? "close_fallback"
              };
        const pullbackBuyPlan =
          pullbackBuyEligible
            ? resolvePullbackBuyPlan({
                referenceSma20,
                invalidationPrice: stopLossReference.price,
                firstBuySma20ProximityPercent: filters.firstBuySma20ProximityPercent,
                secondEntryRiskRatio: filters.pullbackBuySecondEntryRiskRatio,
                thirdEntryRiskRatio: filters.pullbackBuyThirdEntryRiskRatio,
                pricingContext: options?.pricingContext
              })
            : undefined;
        const adjustedSetupEntryZone = pullbackBuyPlan
          ? {
              entryZoneLow: pullbackBuyPlan.thirdBuyPrice,
              entryZoneHigh: pullbackBuyPlan.firstBuyPrice
            }
          : adjustEntryZoneForMarket(
              setupEntryZone.entryZoneLow,
              setupEntryZone.entryZoneHigh,
              setupPullback.pullbackLow,
              market,
              options?.pricingContext
            );
        const effectiveEntryZoneLow = adjustedSetupEntryZone.entryZoneLow;
        const effectiveEntryZoneHigh = adjustedSetupEntryZone.entryZoneHigh;
        const withinSetupEntryZone =
          pullbackBuyEligible && isWithinBand(referencePoint.close, effectiveEntryZoneLow, effectiveEntryZoneHigh);
        const belowSetupEntryZone =
          pullbackBuyEligible && effectiveEntryZoneLow != null && referencePoint.close < effectiveEntryZoneLow;
        const pullbackBuyActionable = isPullbackBuyActionable(
          referencePoint.close,
          pullbackBuyPlan,
          stopLossReference.price,
          filters.firstBuySma20ProximityPercent
        );
        const pullbackBuyStarted = hasReachedSma20BuyZone(
          referencePoint.close,
          pullbackBuyPlan,
          filters.firstBuySma20ProximityPercent
        );
        const pullbackBuyStillValid =
          pullbackBuyPlan != null && referencePoint.close > pullbackBuyPlan.stopLossPrice;
        const volumeContractionScore = deriveVolumeContractionScore(setupPullback);
        const supportStabilityScore = deriveSupportStabilityScore({
          pullback: setupPullback,
          referenceClose: referencePoint.close,
          referenceCloseVsBreakoutLevelPercent: setupDistancePercent,
          invalidationPrice: stopLossReference.price,
          setupType: setupPullback.setupType
        });
        const sma20SlopePercent = getSma20SlopePercent(points, referenceIndex);
        const sma20SlopeScore =
          sma20SlopePercent == null ? 58 : sma20SlopePercent >= 1 ? 90 : sma20SlopePercent >= 0 ? 74 : sma20SlopePercent >= -1 ? 46 : 24;
        const riskRewardRatio = getRiskRewardRatioFromCandidate(
          pullbackBuyPlan,
          effectiveEntryZoneLow,
          effectiveEntryZoneHigh,
          stopLossReference.price,
          setupPullback.breakoutLevel,
          referencePoint.close
        );
        const riskRewardScore =
          riskRewardRatio == null
            ? 42
            : riskRewardRatio >= filters.executionReadyRiskRewardMin
              ? 90
              : riskRewardRatio >= filters.executionProbeRiskRewardMin
                ? 66
                : 28;
        const baseFilterPassed = referenceCloseVsBasePercent >= filters.minReferenceCloseVsBasePercent;
        const baseReclaimWatchEligible = isBaseReclaimWatchEligible({
          pullback: setupPullback,
          pullbackSessions: setupPullbackPoints.length,
          referenceCloseVsBasePercent,
          referenceClose: referencePoint.close,
          invalidationPrice: stopLossReference.price,
          volumeContractionScore,
          riskRewardRatio,
          filters
        });
        if (!baseFilterPassed && !baseReclaimWatchEligible) {
          continue;
        }
        const baseValidityScore =
          pullbackBuyEligible && pullbackBuyPlan
            ? !pullbackBuyStillValid
              ? 10
              : pullbackBuyStarted
                ? 84
                : 68
            : referencePoint.close < setupPullback.pullbackLow
              ? 10
              : referencePoint.close < stopLossReference.price
              ? 10
              : withinSetupEntryZone
                ? 88
                : belowSetupEntryZone
                  ? 42
                  : setupDistancePercent <= filters.maxBreakoutExtensionPercent
                    ? 72
                    : 38;
        const baseExecutionReadinessScore =
          pullbackBuyEligible && pullbackBuyPlan
            ? !pullbackBuyStillValid
              ? 8
              : pullbackBuyStarted
                ? 82
                : 48
            : referencePoint.close < setupPullback.pullbackLow
              ? 8
              : referencePoint.close < stopLossReference.price
              ? 8
              : withinSetupEntryZone
                ? 90
                : belowSetupEntryZone
                  ? 36
                  : setupDistancePercent <= 2
                    ? 74
                    : 34;
        const validityScore = clamp(
          Math.round(baseValidityScore * 0.55 + volumeContractionScore * 0.15 + supportStabilityScore * 0.2 + sma20SlopeScore * 0.1),
          0,
          100
        );
        const executionReadinessScore = clamp(
          Math.round(baseExecutionReadinessScore * 0.5 + supportStabilityScore * 0.15 + sma20SlopeScore * 0.1 + leadInCandleQuality.candleQualityScore * 0.1 + riskRewardScore * 0.15),
          0,
          100
        );
        const setupActionableThresholds = deriveActionableThresholds("setup", market, filters);
        const setupTags: SmartMoneyClassificationTag[] = [
          "tag_sma20_primary",
          ...(Math.abs(setupDistancePercent) <= 2 ? (["tag_alt_anchor_pivot_retest"] as const) : []),
          ...(setupPullback.setupType === "support_holding_pullback" ? (["tag_alt_anchor_box_support"] as const) : []),
          ...(setupPullback.pullbackType === "time_correction" || setupPullback.pullbackMaxDrawdownPercent <= 4 ? (["tag_alt_anchor_shallow_pullback"] as const) : []),
          ...(qualifiedLeadIn.seedAnchor ? (["tag_seed_anchor_confirmed"] as const) : []),
          ...effectiveLeadInVolume.tags,
          ...leadInCandleQuality.tags,
          ...(volumeContractionScore < 55 ? (["tag_volume_weak"] as const) : []),
          ...(sma20SlopePercent != null && sma20SlopePercent < 0 ? (["tag_sma20_slope_negative"] as const) : []),
          ...(supportStabilityScore < 55 ? (["tag_support_unstable"] as const) : [])
        ];
        const setupPenaltyFactors: SmartMoneyPenaltyFactor[] = [
          ...effectiveLeadInVolume.penaltyFactors,
          ...leadInCandleQuality.penaltyFactors,
          ...(volumeContractionScore < 55
            ? [
                createPenaltyFactor(
                  "weak_volume_contraction",
                  "Weak volume contraction",
                  12,
                  `Pullback volume stayed at ${((setupPullback.pullbackVolumeRatioToLeadIn ?? 0) * 100).toFixed(0)}% of the surge anchor.`
                )
              ]
            : []),
          ...(sma20SlopePercent != null && sma20SlopePercent < 0
            ? [
                createPenaltyFactor(
                  "negative_sma20_slope",
                  "Negative SMA20 slope",
                  14,
                  `SMA20 slope is ${sma20SlopePercent.toFixed(2)}% over the recent lookback.`
                )
              ]
            : []),
          ...(supportStabilityScore < 55
            ? [
                createPenaltyFactor(
                  "unstable_support",
                  "Unstable support",
                  16,
                  `Support stability score dropped to ${supportStabilityScore}.`
                )
              ]
            : []),
          ...(baseReclaimWatchEligible
            ? [
                createPenaltyFactor(
                  "base_reclaim_pending",
                  "Base reclaim pending",
                  12,
                  `Current close is ${Math.abs(referenceCloseVsBasePercent).toFixed(1)}% below the pre-lead base at ${preLeadBaseClose.toFixed(0)}.`
                )
              ]
            : [])
        ];
        const rangePenaltyMultiplier = setupPullback.setupType === "support_holding_pullback" ? 1.6 : 5;
        const drawdownPenaltyMultiplier = setupPullback.setupType === "support_holding_pullback" ? 1.2 : 2.5;
        const setupBaseScore = clamp(
          Math.round(
            effectiveLeadInVolume.volumeQualityScore * 0.12 +
              leadInCandleQuality.candleQualityScore * 0.08 +
              Math.min(100, (qualifiedLeadInPriceChangePercent / filters.minLeadInPriceChangePercent) * 40) * 0.22 +
              Math.min(100, (surgeAdvancePercent / filters.minSetupSurgeAdvancePercent) * 35) * 0.18 +
              clamp(100 - setupPullback.pullbackRangePercent * rangePenaltyMultiplier, 0, 100) * 0.2 +
              clamp(100 - setupPullback.pullbackMaxDrawdownPercent * drawdownPenaltyMultiplier, 0, 100) * 0.2
          ),
          0,
          100
        );
        const setupScore = clamp(
          Math.round(
            setupBaseScore +
              (setupPullback.setupType === "volatile_power_digestion"
                ? filters.volatileDigestionSetupScoreBoost
                : setupPullback.setupType === "support_holding_pullback"
                  ? 8
                  : 0)
          ),
          0,
          100
        );
        const matched = !baseReclaimWatchEligible && setupScore >= setupThresholdScore;
        const setupClassificationReasons = [
          matched ? "matched_setup" : "setup_watch_only",
          ...(qualifiedLeadIn.seedAnchor ? (["seed_anchor_confirmed"] as const) : []),
          pullbackBuyStarted ? "entry_sma20_hit" : withinSetupEntryZone ? "entry_zone_hit" : "entry_zone_pending",
          volumeContractionScore < 55 ? "weak_volume_contraction" : "volume_contraction_ok",
          leadInCandleQuality.candleQualityScore < 60 ? "weak_candle_structure" : "candle_structure_ok",
          sma20SlopePercent != null && sma20SlopePercent < 0 ? "sma20_slope_negative" : "sma20_slope_ok",
          supportStabilityScore < 55 ? "unstable_support" : "support_holding",
          riskRewardRatio != null && riskRewardRatio < filters.executionReadyRiskRewardMin ? "risk_reward_thin" : "risk_reward_ok",
          ...(baseReclaimWatchEligible ? (["base_reclaim_watch"] as const) : [])
        ];
        // A setup is not executable just because it "matched".
        // It only becomes actionable after the staged-buy logic says the first SMA20 buy area is live.
        const actionable =
          matched &&
          pullbackBuyEligible &&
          pullbackBuyActionable &&
          validityScore >= setupActionableThresholds.validityMin &&
          executionReadinessScore >= setupActionableThresholds.executionMin &&
          (riskRewardRatio ?? 0) >= filters.executionReadyRiskRewardMin &&
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
          volumeQualityScore: effectiveLeadInVolume.volumeQualityScore,
          candleQualityScore: leadInCandleQuality.candleQualityScore,
          breakoutStrengthScore: 0,
          breakoutFailureRiskScore: 0,
          freshnessScore: clamp(92 - (referenceIndex - surgePeakIndex) * 6, 35, 95),
          validityScore,
          executionReadinessScore,
          volumeContractionScore,
          supportStabilityScore,
          sma20SlopePercent,
          riskRewardRatio,
          pullback: setupPullback,
          leadInPriceChangePercent: qualifiedLeadInPriceChangePercent,
          surgeAdvancePercent,
          surgeDurationDays: surgePeakIndex - leadInIndex,
          displayLeadInVolume: effectiveLeadInVolume.absoluteVolume ?? 0,
          leadInVolumeRatio20d: effectiveLeadInVolume.volumeRatio20d,
          leadInTurnoverValue: effectiveLeadInVolume.turnoverValue,
          breakout20d: false,
          closedNearHigh: false,
          referenceCloseVsBasePercent,
          referenceCloseVsPeakPercent,
          referenceCloseVsLeadInPercent: percentChange(referencePoint.close, leadInPoint.close),
          referenceCloseVsLeadInHighPercent: percentChange(referencePoint.close, getPointHigh(leadInPoint)),
          referenceCloseVsBreakoutLevelPercent: setupDistancePercent,
          matched,
          actionable,
          tags: setupTags,
          penaltyFactors: setupPenaltyFactors,
          classificationReasons: setupClassificationReasons,
          entryZoneLow: effectiveEntryZoneLow,
          entryZoneHigh: effectiveEntryZoneHigh,
          invalidationPrice: stopLossReference.price,
          buyPlan: pullbackBuyPlan,
          buyPlanEligible: pullbackBuyEligible,
          referenceSma20,
          stopLossReference,
          minSetupPullbackSessions: filters.minSetupPullbackSessions,
          breakoutHoldTolerancePercent: filters.breakoutHoldTolerancePercent,
          maxBreakoutExtensionPercent: filters.maxBreakoutExtensionPercent,
          regimeScoreWeight: filters.regimeScoreWeight,
          pricingContext: options?.pricingContext,
          reasons: [
            qualifiedLeadIn.seedAnchor && qualifiedLeadIn.confirmationPoint
              ? `Seed lead-in on ${leadInPoint.date} printed ${qualifiedLeadInPriceChangePercent.toFixed(1)}%, then liquidity confirmed on ${qualifiedLeadIn.confirmationPoint.date}.`
              : `Lead-in on ${leadInPoint.date} printed ${qualifiedLeadInPriceChangePercent.toFixed(1)}% with solid turnover support.`,
            `The stock formed a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile power digestion" : setupPullback.setupType === "support_holding_pullback" ? "support-holding pullback" : setupPullback.pullbackType === "time_correction" ? "time correction" : "tight price pullback"} with volume cooling to ${((setupPullback.pullbackVolumeRatioToLeadIn ?? 0) * 100).toFixed(0)}% of the surge anchor and close compression of ${setupPullback.closeRangePercent.toFixed(1)}%.`,
            ...(baseReclaimWatchEligible
              ? [
                  `Current close is ${Math.abs(referenceCloseVsBasePercent).toFixed(1)}% below the pre-lead base at ${preLeadBaseClose.toFixed(0)}, so the setup stays on watch until that box is reclaimed.`
                ]
              : []),
            !pullbackBuyEligible
              ? `Current structure is a ${setupPullback.setupType === "time_correction" ? "re-breakout watch" : setupPullback.setupType === "support_holding_pullback" ? "support-holding watch" : "setup watch"} rather than a pullback-buy zone because the drawdown, distance, or funded-peak damage do not fit the staged-buy archetype.`
              : pullbackBuyActionable
                ? `Current price has approached the 20-day moving average (${referenceSma20?.toFixed(0) ?? "-"}) after a ${filters.pullbackBuyStartPercentFromPeak}%+ drawdown from the funded peak, so 1st-buy conditions are active with stop anchored to the visible ${filters.stopLossLookbackSessions}-session low on ${stopLossReference.date ?? "the prior low"} (${stopLossReference.price.toFixed(0)}).`
                : pullbackBuyStarted
                  ? `Current price has touched the SMA20-based 1st-buy area but is now too close to the protective stop at ${stopLossReference.price.toFixed(0)} from visible-window low ${stopLossReference.date ?? "the prior low"}, so the setup stays under caution.`
                  : `Pullback-buy observation started after a ${filters.pullbackBuyStartPercentFromPeak}%+ drawdown from the funded peak, but 1st buy still waits for price to come within ${filters.firstBuySma20ProximityPercent}% of the 20-day moving average (${referenceSma20?.toFixed(0) ?? "-"}) while staying above the visible ${filters.stopLossLookbackSessions}-session low (${stopLossReference.price.toFixed(0)}).`
          ]
        });
        const enhancedSetupMatch = enhanceSmartMoneyMatch({
          match: setupMatch,
          points,
          referenceIndex,
          filters,
          pricingContext: options?.pricingContext,
          rejectionReasons: !matched
            ? [`Setup score ${setupScore} was below the active threshold ${setupThresholdScore}.`]
            : actionable
              ? []
              : [
                  `Setup is not actionable because validity/readiness/risk-reward did not clear the active gate (${setupActionableThresholds.validityMin}/${setupActionableThresholds.executionMin}/${filters.executionReadyRiskRewardMin.toFixed(1)}).`
                ]
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
          const breakoutVolume = scoreVolumeQuality(
            breakoutPoint,
            getAverageVolumeBefore(points, breakoutIndex, 20),
            getAverageTurnoverBefore(points, breakoutIndex, 20),
            filters.minBreakoutVolumeRatio,
            filters.minBreakoutVolumeShares,
            filters.minBreakoutTurnoverValue
          );
          const breakoutCandleQuality = scoreCandleQuality(breakoutPoint, breakoutPrevious.close, "breakout");
          const breakout20d = (getHighestCloseBefore(points, breakoutIndex, filters.breakoutLookbackDays) ?? -Infinity) <= breakoutPoint.close;
          const closedNearHigh = breakoutPoint.high != null ? breakoutPoint.close >= breakoutPoint.high * filters.closeNearHighRatio : false;
          if (breakoutPriceChangePercent == null || breakoutPriceChangePercent < filters.minBreakoutPriceChangePercent || !breakoutVolume.passed || !breakout20d || !closedNearHigh || breakoutPoint.close < setupPullback.breakoutLevel) {
            continue;
          }

          const sessionsSinceBreakout = referenceIndex - breakoutIndex;
          const extensionPercent = percentChange(referencePoint.close, setupPullback.breakoutLevel) ?? 0;
          const supportStabilityScore = deriveSupportStabilityScore({
            pullback: setupPullback,
            referenceClose: referencePoint.close,
            referenceCloseVsBreakoutLevelPercent: extensionPercent,
            invalidationPrice: stopLossReference.price,
            setupType: setupPullback.setupType
          });
          const sma20SlopePercent = getSma20SlopePercent(points, referenceIndex);
          const sma20SlopeScore =
            sma20SlopePercent == null ? 58 : sma20SlopePercent >= 1 ? 90 : sma20SlopePercent >= 0 ? 74 : sma20SlopePercent >= -1 ? 46 : 24;
          const baseValidityBreakoutScore = referencePoint.close < setupPullback.breakoutLevel * (1 - filters.breakoutHoldTolerancePercent / 100) ? 35 : 88;
          const breakoutEntryZone = resolveBreakoutRetestZone(
            setupPullback.breakoutLevel,
            setupPullback.pullbackLow,
            filters.maxSetupDistanceBelowBreakoutLevelPercent
          );
          const adjustedBreakoutEntryZone = adjustEntryZoneForMarket(
            breakoutEntryZone.entryZoneLow,
            breakoutEntryZone.entryZoneHigh,
            setupPullback.pullbackLow,
            market,
            options?.pricingContext
          );
          const riskRewardRatio = getRiskRewardRatioFromCandidate(
            undefined,
            adjustedBreakoutEntryZone.entryZoneLow,
            adjustedBreakoutEntryZone.entryZoneHigh,
            stopLossReference.price,
            setupPullback.breakoutLevel,
            referencePoint.close
          );
          const riskRewardScore =
            riskRewardRatio == null
              ? 42
              : riskRewardRatio >= filters.executionReadyRiskRewardMin
                ? 90
                : riskRewardRatio >= filters.executionProbeRiskRewardMin
                  ? 66
                  : 28;
          const baseExecutionBreakoutScore = extensionPercent > filters.maxBreakoutExtensionPercent ? 35 : clamp(92 - Math.max(0, extensionPercent) * 7, 20, 95);
          const validityBreakoutScore = clamp(
            Math.round(baseValidityBreakoutScore * 0.55 + supportStabilityScore * 0.2 + breakoutCandleQuality.candleQualityScore * 0.15 + sma20SlopeScore * 0.1),
            0,
            100
          );
          const executionBreakoutScore = clamp(
            Math.round(baseExecutionBreakoutScore * 0.45 + breakoutCandleQuality.candleQualityScore * 0.2 + breakoutVolume.volumeQualityScore * 0.15 + sma20SlopeScore * 0.05 + riskRewardScore * 0.15),
            0,
            100
          );
          const breakoutFailureRiskScore = referencePoint.close < setupPullback.breakoutLevel ? 65 : extensionPercent > filters.maxBreakoutExtensionPercent ? 48 : 18;
          const breakoutStrengthScore = clamp(
            Math.round(
              Math.min(100, (breakoutPriceChangePercent / filters.minBreakoutPriceChangePercent) * 45) * 0.25 +
                breakoutVolume.volumeQualityScore * 0.3 +
                breakoutCandleQuality.candleQualityScore * 0.2 +
                (closedNearHigh ? 92 : 60) * 0.1 +
                clamp((percentChange(breakoutPoint.close, setupPullback.breakoutLevel) ?? 0) * 10 + 60, 0, 100) * 0.15
            ),
            0,
            100
          );
          const breakoutScore = clamp(Math.round(setupScore * 0.35 + breakoutStrengthScore * 0.45 + (100 - breakoutFailureRiskScore) * 0.2), 0, 100);
          const matchedBreakout = breakoutScore >= breakoutThresholdScore;
          const breakoutActionableThresholds = deriveActionableThresholds("breakout", market, filters);
          const breakoutTags: SmartMoneyClassificationTag[] = [
            "tag_sma20_primary",
            "tag_alt_anchor_pivot_retest",
            ...(qualifiedLeadIn.seedAnchor ? (["tag_seed_anchor_confirmed"] as const) : []),
            ...breakoutVolume.tags,
            ...breakoutCandleQuality.tags,
            ...(sma20SlopePercent != null && sma20SlopePercent < 0 ? (["tag_sma20_slope_negative"] as const) : []),
            ...(supportStabilityScore < 55 ? (["tag_support_unstable"] as const) : [])
          ];
          const breakoutPenaltyFactors: SmartMoneyPenaltyFactor[] = [
            ...breakoutVolume.penaltyFactors,
            ...breakoutCandleQuality.penaltyFactors,
            ...(sma20SlopePercent != null && sma20SlopePercent < 0
              ? [
                  createPenaltyFactor(
                    "negative_sma20_slope",
                    "Negative SMA20 slope",
                    12,
                    `SMA20 slope is ${sma20SlopePercent.toFixed(2)}% over the recent lookback.`
                  )
                ]
              : []),
            ...(supportStabilityScore < 55
              ? [
                  createPenaltyFactor(
                    "unstable_support",
                    "Unstable support",
                    14,
                    `Support stability score dropped to ${supportStabilityScore}.`
                  )
                ]
              : [])
          ];
          const breakoutClassificationReasons = [
            "matched_breakout",
            ...(qualifiedLeadIn.seedAnchor ? (["seed_anchor_confirmed"] as const) : []),
            sessionsSinceBreakout <= filters.recentSignalSessions + 2 ? "breakout_recent" : "breakout_stale",
            breakoutCandleQuality.candleQualityScore < 60 ? "weak_candle_structure" : "candle_structure_ok",
            sma20SlopePercent != null && sma20SlopePercent < 0 ? "sma20_slope_negative" : "sma20_slope_ok",
            supportStabilityScore < 55 ? "unstable_support" : "support_holding",
            riskRewardRatio != null && riskRewardRatio < filters.executionReadyRiskRewardMin ? "risk_reward_thin" : "risk_reward_ok"
          ];
          const actionableBreakout =
            matchedBreakout &&
            sessionsSinceBreakout <= filters.recentSignalSessions + 2 &&
            validityBreakoutScore >= breakoutActionableThresholds.validityMin &&
            executionBreakoutScore >= breakoutActionableThresholds.executionMin &&
            (riskRewardRatio ?? 0) >= filters.executionReadyRiskRewardMin &&
            market.actionableAllowed;
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
            candleQualityScore: breakoutCandleQuality.candleQualityScore,
            breakoutStrengthScore,
            breakoutFailureRiskScore,
            freshnessScore: clamp(95 - sessionsSinceBreakout * 12, 30, 95),
            validityScore: validityBreakoutScore,
            executionReadinessScore: executionBreakoutScore,
            supportStabilityScore,
            sma20SlopePercent,
            riskRewardRatio,
            pullback: setupPullback,
            leadInPriceChangePercent: qualifiedLeadInPriceChangePercent,
            surgeAdvancePercent,
            surgeDurationDays: surgePeakIndex - leadInIndex,
            displayLeadInVolume: effectiveLeadInVolume.absoluteVolume ?? 0,
            leadInVolumeRatio20d: effectiveLeadInVolume.volumeRatio20d,
            leadInTurnoverValue: effectiveLeadInVolume.turnoverValue,
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
            tags: breakoutTags,
            penaltyFactors: breakoutPenaltyFactors,
            classificationReasons: breakoutClassificationReasons,
            entryZoneLow: adjustedBreakoutEntryZone.entryZoneLow,
            entryZoneHigh: adjustedBreakoutEntryZone.entryZoneHigh,
            invalidationPrice: stopLossReference.price,
            referenceSma20,
            stopLossReference,
            minSetupPullbackSessions: filters.minSetupPullbackSessions,
            breakoutHoldTolerancePercent: filters.breakoutHoldTolerancePercent,
            maxBreakoutExtensionPercent: filters.maxBreakoutExtensionPercent,
            regimeScoreWeight: filters.regimeScoreWeight,
            pricingContext: options?.pricingContext,
            reasons: [
              `Setup from ${leadInPoint.date} to ${surgePeakPoint.date} provided the base for a ${setupPullback.setupType === "volatile_power_digestion" ? "volatile-power-digestion" : setupPullback.setupType === "support_holding_pullback" ? "support-holding-pullback" : setupPullback.pullbackType === "time_correction" ? "time-correction" : "price-pullback"} breakout.`,
              `Breakout on ${breakoutPoint.date} cleared ${setupPullback.breakoutLevel.toFixed(2)} with ${breakoutPriceChangePercent.toFixed(1)}% price expansion and ${breakoutVolume.volumeQualityScore} volume-quality points.`,
              `Reference price is ${extensionPercent.toFixed(1)}% from the breakout level and failure risk is ${breakoutFailureRiskScore}.`
            ]
          });
          const enhancedBreakoutMatch = enhanceSmartMoneyMatch({
            match: breakoutMatch,
            points,
            referenceIndex,
            filters,
            pricingContext: options?.pricingContext,
          rejectionReasons: !matchedBreakout
              ? [`Breakout score ${breakoutScore} was below the active threshold ${breakoutThresholdScore}.`]
              : actionableBreakout
                ? []
                : [
                    `Breakout is not actionable because freshness/validity/readiness/risk-reward did not clear the active gate (${breakoutActionableThresholds.validityMin}/${breakoutActionableThresholds.executionMin}/${filters.executionReadyRiskRewardMin.toFixed(1)}).`
                  ]
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
      pricingContext: options?.pricingContext,
      rejectionReasons:
        rejected.slice(0, 5).map((item) => item.reason).filter(Boolean).length > 0
          ? rejected.slice(0, 5).map((item) => item.reason)
          : fallbackMatch.rejectionReasons
    });
  const scoredBestMatch = applySwingVolumeProfileScore(bestMatch, points.slice(0, referenceIndex + 1));
  if (!options?.debug) {
    return scoredBestMatch;
  }

  const topCandidates = [...allCandidates].sort((left, right) => compareMatches(left.match, right.match)).slice(0, filters.debugTopCandidateLimit).map((candidate, index) => ({ ...candidate.summary, selected: index === 0 }));
  const debugMeta: SmartMoneyDebugMeta = {
    evaluatedLookbackWindows: filters.lookbackWindows,
    evaluatedCandidateCount: allCandidates.length,
    rejectedCandidateCount: rejected.length,
    marketContextApplied: Boolean(options.marketContext),
    selectionPolicy: "status > actionable > matched > breakout over setup > danger-adjusted finalRankScore > patternScore"
  };

  return {
    ...scoredBestMatch,
    topCandidates,
    rejectReasons: rejected.slice(0, filters.debugTopCandidateLimit * 5),
    debugMeta
  };
}
