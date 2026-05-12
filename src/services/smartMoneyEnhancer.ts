import type {
  ChartPoint,
  SmartMoneyConditionCheck,
  SmartMoneyDebugInfo,
  SmartMoneyBuyPlan,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyPostEntryOutcome,
  SmartMoneyRiskFactor,
  SmartMoneyTradePlan
} from "../types.js";
import { type SmartMoneyPricingContext, normalizePriceByTick } from "./smartMoney/pricing.js";

type EnhanceSmartMoneyMatchInput = {
  match: SmartMoneyPatternMatch;
  points: ChartPoint[];
  referenceIndex: number;
  filters: SmartMoneyPatternFilters;
  pricingContext?: SmartMoneyPricingContext;
  rejectionReasons?: string[];
};

const DANGER_SCORE_SETTINGS = {
  upperWickMediumImpact: 10,
  upperWickHighImpact: 14,
  distributionImpact: 13,
  weakBounceImpact: 8,
  failedBreakoutMediumImpact: 10,
  failedBreakoutHighImpact: 14,
  supportPressureImpact: 7,
  supportBreakImpact: 16,
  unrecoveredSelloffImpact: 14,
  downtrendDigestImpact: 12,
  breakoutBaseRiskWeight: 0.28,
  breakoutBaseRiskCap: 26,
  setupValidityRiskWeight: 0.14,
  setupPeakDamageWeight: 0.6,
  setupBaseRiskCap: 22,
  applyPenaltyToRank: true,
  finalPenaltyWeight: 0.18,
  finalPenaltyCap: 18,
  actionableBlockThreshold: 60,
  rejectionAmplifierThreshold: 78
} as const;

const EXECUTION_GUARD_SETTINGS = {
  minimumRiskRewardRatio: 1.8
} as const;

const POST_ENTRY_OUTCOME_SETTINGS = {
  firstBuyTargetReturnPct: 10,
  secondBuyTargetReturnPct: 10,
  thirdBuyTargetReturnPct: 8
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value?: number, pricingContext?: SmartMoneyPricingContext): number | undefined {
  return normalizePriceByTick(value, pricingContext);
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function getStagedBuyWeight(stage: number): number {
  if (stage >= 3) {
    return 4;
  }
  if (stage === 2) {
    return 2;
  }
  return 1;
}

function weightedAverageExecutedBuys(executedBuys: SmartMoneyPostEntryOutcome["executedBuys"]): number | undefined {
  const totalWeight = executedBuys.reduce((sum, buy) => sum + getStagedBuyWeight(buy.stage), 0);
  if (!totalWeight) {
    return undefined;
  }

  return executedBuys.reduce((sum, buy) => sum + buy.price * getStagedBuyWeight(buy.stage), 0) / totalWeight;
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

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function findIndexByDate(points: ChartPoint[], date?: string): number {
  return date ? points.findIndex((point) => point.date === date) : -1;
}

function getSlice(points: ChartPoint[], startDate?: string, endDate?: string): ChartPoint[] {
  const startIndex = findIndexByDate(points, startDate);
  const endIndex = findIndexByDate(points, endDate);

  if (startIndex === -1 && endIndex === -1) {
    return [];
  }

  const resolvedStart = startIndex === -1 ? 0 : startIndex;
  const resolvedEnd = endIndex === -1 ? points.length - 1 : endIndex;
  return points.slice(Math.min(resolvedStart, resolvedEnd), Math.max(resolvedStart, resolvedEnd) + 1);
}

function deriveBreakoutStatus(match: SmartMoneyPatternMatch): SmartMoneyDebugInfo["breakoutStatus"] {
  if (match.status === "broken") {
    return "failed";
  }
  if (match.status === "breakout_confirmed") {
    return "confirmed";
  }
  if (match.status === "breakout_extended") {
    return "watch";
  }
  if (match.status === "breakout_ready" || match.stage === "breakout") {
    return "ready";
  }
  if (match.stage === "setup") {
    return "watch";
  }
  return "none";
}

function deriveSupportStatus(match: SmartMoneyPatternMatch): SmartMoneyDebugInfo["supportStatus"] {
  if (match.invalidationPrice == null || match.referenceClose == null) {
    return "holding";
  }

  if (match.referenceClose < match.invalidationPrice) {
    return "broken";
  }

  if (match.referenceClose <= match.invalidationPrice * 1.03) {
    return "testing";
  }

  return "holding";
}

function buildTradePlan(match: SmartMoneyPatternMatch, pricingContext?: SmartMoneyPricingContext): SmartMoneyTradePlan | undefined {
  const zoneLow = normalizePriceByTick(match.buyPlan?.thirdBuyPrice ?? match.entryZoneLow, pricingContext, "down");
  const zoneHigh = normalizePriceByTick(match.buyPlan?.firstBuyPrice ?? match.entryZoneHigh, pricingContext, "down");
  const breakoutPrice = normalizePriceByTick(match.breakoutLevel ?? match.surgePeakHigh ?? match.referenceClose, pricingContext, "up");
  const invalidationPrice = normalizePriceByTick(match.invalidationPrice, pricingContext, "down");
  const stopLoss = normalizePriceByTick(match.buyPlan?.stopLossPrice ?? invalidationPrice, pricingContext, "down");
  const technicalEntry = zoneLow != null && zoneHigh != null ? (zoneLow + zoneHigh) / 2 : undefined;
  const riskPerShare =
    technicalEntry != null && stopLoss != null && technicalEntry > stopLoss ? technicalEntry - stopLoss : undefined;
  const targetPrice =
    breakoutPrice != null && riskPerShare != null && riskPerShare > 0
      ? normalizePriceByTick(
          (match.stage === "setup" ? Math.max(technicalEntry ?? breakoutPrice, breakoutPrice) : Math.max(match.referenceClose ?? breakoutPrice, breakoutPrice)) +
            riskPerShare * 2,
          pricingContext,
          "down"
        )
      : undefined;
  const riskRewardRatio =
    targetPrice != null && technicalEntry != null && stopLoss != null && technicalEntry > stopLoss
      ? Math.round(((targetPrice - technicalEntry) / (technicalEntry - stopLoss)) * 100) / 100
      : undefined;

  const notes = [
    match.entryStrategy === "no_chase"
      ? "Breakout structure exists, but price is already extended beyond the preferred chase threshold."
      : match.stage === "breakout"
      ? "Breakout price is the structural trigger; prefer entries that do not stretch far above it."
      : "Buy zone is derived from the pullback structure and existing staged-buy logic.",
    invalidationPrice != null
      ? "Invalidation is the technical line where the pullback structure is considered broken."
      : "Invalidation line could not be derived from the current structure."
  ];

  if (
    zoneLow == null &&
    zoneHigh == null &&
    breakoutPrice == null &&
    stopLoss == null &&
    invalidationPrice == null &&
    targetPrice == null
  ) {
    return undefined;
  }

  return {
    strategy: match.entryStrategy ?? "setup_watch",
    idealBuyZone:
      zoneLow != null && zoneHigh != null
        ? {
            low: Math.min(zoneLow, zoneHigh),
            high: Math.max(zoneLow, zoneHigh)
          }
        : undefined,
    breakoutPrice,
    stopLoss,
    invalidationPrice,
    targetPrice,
    riskRewardRatio,
    notes
  };
}

function resolveOutcomeBuyPlan(match: SmartMoneyPatternMatch, pricingContext?: SmartMoneyPricingContext): SmartMoneyBuyPlan | undefined {
  if (match.buyPlan) {
    return match.buyPlan;
  }

  const firstBuyPrice =
    match.entryZoneLow != null && match.entryZoneHigh != null ? Math.max(match.entryZoneLow, match.entryZoneHigh) : undefined;
  const stopLossPrice = match.tradePlan?.stopLoss ?? match.tradePlan?.invalidationPrice ?? match.invalidationPrice;
  if (firstBuyPrice == null || stopLossPrice == null || firstBuyPrice <= stopLossPrice) {
    return undefined;
  }

  const riskBand = firstBuyPrice - stopLossPrice;
  return {
    firstBuyPrice: normalizePriceByTick(firstBuyPrice, pricingContext, "down") ?? firstBuyPrice,
    secondBuyPrice: normalizePriceByTick(stopLossPrice + riskBand * 0.67, pricingContext, "down") ?? stopLossPrice + riskBand * 0.67,
    thirdBuyPrice: normalizePriceByTick(stopLossPrice + riskBand * 0.33, pricingContext, "down") ?? stopLossPrice + riskBand * 0.33,
    stopLossPrice: normalizePriceByTick(stopLossPrice, pricingContext, "down") ?? stopLossPrice
  };
}

function getTargetReturnPct(executedBuyCount: number): number | undefined {
  if (executedBuyCount >= 3) {
    return POST_ENTRY_OUTCOME_SETTINGS.thirdBuyTargetReturnPct;
  }
  if (executedBuyCount === 2) {
    return POST_ENTRY_OUTCOME_SETTINGS.secondBuyTargetReturnPct;
  }
  if (executedBuyCount === 1) {
    return POST_ENTRY_OUTCOME_SETTINGS.firstBuyTargetReturnPct;
  }
  return undefined;
}

function getTargetHitStatus(executedBuyCount: number): SmartMoneyPostEntryOutcome["status"] {
  if (executedBuyCount >= 3) {
    return "target_hit_after_third_buy";
  }
  if (executedBuyCount === 2) {
    return "target_hit_after_second_buy";
  }
  return "target_hit_after_first_buy";
}

function calculatePostEntryOutcome(
  match: SmartMoneyPatternMatch,
  points: ChartPoint[],
  referenceIndex: number,
  pricingContext?: SmartMoneyPricingContext
): SmartMoneyPostEntryOutcome | undefined {
  if (match.stage !== "setup" || !match.matched) {
    return undefined;
  }

  const buyPlan = resolveOutcomeBuyPlan(match, pricingContext);
  if (!buyPlan) {
    return undefined;
  }

  const startIndex = Math.max(
    0,
    findIndexByDate(points, match.pullbackStartDate) !== -1
      ? findIndexByDate(points, match.pullbackStartDate)
      : findIndexByDate(points, match.leadInDate) !== -1
        ? findIndexByDate(points, match.leadInDate)
        : findIndexByDate(points, match.windowStartDate) !== -1
          ? findIndexByDate(points, match.windowStartDate)
          : 0
  );
  const endIndex = Math.min(referenceIndex, points.length - 1);
  const stageDefinitions: Array<{ stage: 1 | 2 | 3; price: number }> = [
    { stage: 1, price: buyPlan.firstBuyPrice },
    { stage: 2, price: buyPlan.secondBuyPrice },
    { stage: 3, price: buyPlan.thirdBuyPrice }
  ];
  const executedBuys: SmartMoneyPostEntryOutcome["executedBuys"] = [];
  const executedStageSet = new Set<number>();
  let maxFavorablePrice: number | undefined;
  let maxFavorableDate: string | undefined;
  let maxFavorableReturnPct: number | undefined;
  let maxAdversePrice: number | undefined;
  let maxAdverseDate: string | undefined;
  let maxAdverseReturnPct: number | undefined;
  let targetHitStatus: SmartMoneyPostEntryOutcome["status"] | undefined;
  let targetHitStageCount = 0;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }

    const rawLow = getPointLow(point);
    const low = rawLow > 0 ? rawLow : point.close;
    let executedNewStage = false;
    for (const buy of stageDefinitions) {
      if (!executedStageSet.has(buy.stage) && low <= buy.price) {
        executedStageSet.add(buy.stage);
        executedNewStage = true;
        executedBuys.push({
          stage: buy.stage,
          price: buy.price,
          date: point.date
        });
      }
    }

    if (!executedBuys.length) {
      continue;
    }

    if (executedNewStage) {
      maxFavorablePrice = undefined;
      maxFavorableDate = undefined;
      maxFavorableReturnPct = undefined;
      maxAdversePrice = undefined;
      maxAdverseDate = undefined;
      maxAdverseReturnPct = undefined;
      targetHitStatus = undefined;
      targetHitStageCount = executedBuys.length;
    }

    const averageBuyPrice = weightedAverageExecutedBuys(executedBuys);
    if (averageBuyPrice == null) {
      continue;
    }

    const rawHigh = getPointHigh(point);
    const high = rawHigh > 0 ? rawHigh : point.close;
    const highReturnPct = percentChange(high, averageBuyPrice);
    if (highReturnPct != null && (maxFavorableReturnPct == null || highReturnPct > maxFavorableReturnPct)) {
      maxFavorablePrice = high;
      maxFavorableDate = point.date;
      maxFavorableReturnPct = highReturnPct;
    }

    const adverseLow = low;
    const adverseReturnPct = percentChange(adverseLow, averageBuyPrice);
    if (adverseReturnPct != null && (maxAdverseReturnPct == null || adverseReturnPct < maxAdverseReturnPct)) {
      maxAdversePrice = adverseLow;
      maxAdverseDate = point.date;
      maxAdverseReturnPct = adverseReturnPct;
    }

    const targetReturnPct = getTargetReturnPct(executedBuys.length);
    if (
      targetReturnPct != null &&
      maxFavorableReturnPct != null &&
      maxFavorableReturnPct >= targetReturnPct &&
      executedBuys.length >= targetHitStageCount
    ) {
      targetHitStageCount = executedBuys.length;
      targetHitStatus = getTargetHitStatus(executedBuys.length);
    }
  }

  if (!executedBuys.length) {
    const referencePoint = points[referenceIndex];
    return {
      status: "no_entry",
      executedBuyCount: 0,
      executedBuys: [],
      latestClose: referencePoint?.close == null ? undefined : roundPrice(referencePoint.close, pricingContext),
      latestDate: referencePoint?.date
    };
  }

  const averageBuyPrice = weightedAverageExecutedBuys(executedBuys);
  const targetReturnPct = getTargetReturnPct(executedBuys.length);
  const referencePoint = points[referenceIndex];
  const latestClose = referencePoint?.close;
  const unrealizedReturnPct =
    averageBuyPrice == null || latestClose == null ? undefined : percentChange(latestClose, averageBuyPrice);

  return {
    status: targetHitStatus ?? "active",
    executedBuyCount: executedBuys.length,
    executedBuys,
    averageBuyPrice: averageBuyPrice == null ? undefined : roundPrice(averageBuyPrice, pricingContext),
    latestClose: latestClose == null ? undefined : roundPrice(latestClose, pricingContext),
    latestDate: referencePoint?.date,
    unrealizedReturnPct: unrealizedReturnPct == null ? undefined : roundPercent(unrealizedReturnPct),
    maxFavorablePrice: roundPrice(maxFavorablePrice, pricingContext),
    maxFavorableDate,
    maxFavorableReturnPct: maxFavorableReturnPct == null ? undefined : roundPercent(maxFavorableReturnPct),
    maxAdversePrice: roundPrice(maxAdversePrice, pricingContext),
    maxAdverseDate,
    maxAdverseReturnPct: maxAdverseReturnPct == null ? undefined : roundPercent(maxAdverseReturnPct),
    targetReturnPct
  };
}

function resolveExecutionRiskRewardRatio(match: SmartMoneyPatternMatch): number | undefined {
  const idealBuyZone = match.tradePlan?.idealBuyZone;
  const stopLoss = match.tradePlan?.stopLoss ?? match.tradePlan?.invalidationPrice;
  if (!idealBuyZone || stopLoss == null) {
    return undefined;
  }

  const entryPrice = (idealBuyZone.low + idealBuyZone.high) / 2;
  if (entryPrice <= stopLoss) {
    return undefined;
  }

  const riskPerShare = entryPrice - stopLoss;
  const rewardReference =
    match.stage === "setup"
      ? match.tradePlan?.breakoutPrice
      : match.tradePlan?.breakoutPrice != null
        ? match.tradePlan.breakoutPrice + riskPerShare
        : match.tradePlan?.targetPrice;
  if (rewardReference == null || rewardReference <= entryPrice) {
    return undefined;
  }

  return Math.round(((rewardReference - entryPrice) / riskPerShare) * 100) / 100;
}

function addRiskFactor(
  riskFactors: SmartMoneyRiskFactor[],
  params: Omit<SmartMoneyRiskFactor, "metrics"> & { metrics?: SmartMoneyRiskFactor["metrics"] }
) {
  riskFactors.push({
    code: params.code,
    label: params.label,
    severity: params.severity,
    scoreImpact: params.scoreImpact,
    description: params.description,
    metrics: params.metrics
  });
}

function evaluateRiskFactors(
  match: SmartMoneyPatternMatch,
  points: ChartPoint[],
  referenceIndex: number,
  pricingContext?: SmartMoneyPricingContext
): { dangerScore: number; dangerPenalty: number; riskFactors: SmartMoneyRiskFactor[] } {
  if (match.stage === "none") {
    return {
      dangerScore: 0,
      dangerPenalty: 0,
      riskFactors: []
    };
  }

  const riskFactors: SmartMoneyRiskFactor[] = [];
  const recentPoints = points.slice(Math.max(0, referenceIndex - 5), referenceIndex + 1);
  const pullbackPoints = getSlice(points, match.pullbackStartDate, match.pullbackEndDate || match.referenceDate);
  const supportPrice = match.invalidationPrice ?? match.entryZoneLow ?? match.breakoutLevel;
  const breakoutReference = match.tradePlan?.breakoutPrice ?? match.breakoutLevel ?? match.surgePeakHigh;

  const upperWickCount = recentPoints.reduce((count, point) => {
    const open = point.open ?? point.close;
    const high = getPointHigh(point);
    const low = getPointLow(point);
    const range = high - low;
    const upperWick = high - Math.max(open, point.close);
    const body = Math.abs(point.close - open);
    return count + (range > 0 && upperWick / range >= 0.35 && upperWick > body * 1.2 ? 1 : 0);
  }, 0);
  if (upperWickCount >= 2) {
    addRiskFactor(riskFactors, {
      code: "upper_wick_cluster",
      label: "Repeated upper-wick rejection",
      severity: upperWickCount >= 3 ? "high" : "medium",
      scoreImpact:
        upperWickCount >= 3
          ? DANGER_SCORE_SETTINGS.upperWickHighImpact
          : DANGER_SCORE_SETTINGS.upperWickMediumImpact,
      description: `Recent candles showed ${upperWickCount} repeated upper-wick rejections, which often means breakout attempts are being sold into.`,
      metrics: {
        upperWickCount
      }
    });
  }

  if (pullbackPoints.length >= 4) {
    const splitIndex = Math.max(1, pullbackPoints.length - Math.min(3, pullbackPoints.length));
    const priorPoints = pullbackPoints.slice(0, splitIndex);
    const recentPullback = pullbackPoints.slice(splitIndex);
    const priorAvgVolume = average(priorPoints.map((point) => point.volume).filter((value): value is number => value != null));
    const recentAvgVolume = average(recentPullback.map((point) => point.volume).filter((value): value is number => value != null));
    const negativeReturnCount = recentPullback.reduce((count, point, index) => {
      const previous = index === 0 ? priorPoints.at(-1) : recentPullback[index - 1];
      return count + ((percentChange(point.close, previous?.close) ?? 0) <= -1.5 ? 1 : 0);
    }, 0);
    if (
      priorAvgVolume != null &&
      recentAvgVolume != null &&
      recentAvgVolume > priorAvgVolume * 1.15 &&
      negativeReturnCount >= 2
    ) {
      addRiskFactor(riskFactors, {
        code: "distribution_during_digest",
        label: "Distribution during digestion",
        severity: "high",
        scoreImpact: DANGER_SCORE_SETTINGS.distributionImpact,
        description: "The latest digestion candles show heavier volume on meaningful down closes, which is closer to distribution than healthy cooling.",
        metrics: {
          priorAvgVolume: Math.round(priorAvgVolume),
          recentAvgVolume: Math.round(recentAvgVolume),
          negativeReturnCount
        }
      });
    }
  }

  if (supportPrice != null) {
    let weakBounceCount = 0;
    for (let index = Math.max(1, referenceIndex - 4); index <= referenceIndex; index += 1) {
      const point = points[index];
      const nextPoint = points[index + 1];
      const touchedSupport = getPointLow(point) <= supportPrice * 1.02 && getPointLow(point) >= supportPrice * 0.985;
      const reboundPercent = nextPoint ? percentChange(nextPoint.close, point.close) ?? 0 : 0;
      if (touchedSupport && reboundPercent < 1.5) {
        weakBounceCount += 1;
      }
    }

    if (weakBounceCount >= 2) {
      addRiskFactor(riskFactors, {
        code: "support_bounce_failure",
        label: "Weak rebound near support",
        severity: "medium",
        scoreImpact: DANGER_SCORE_SETTINGS.weakBounceImpact,
        description: "Price keeps revisiting the support area but rebounds are shallow, which can precede a breakdown if demand does not step in.",
        metrics: {
          supportPrice: roundPrice(supportPrice, pricingContext),
          weakBounceCount
        }
      });
    }
  }

  if (breakoutReference != null) {
    const failedAttemptCount = recentPoints.filter(
      (point) => getPointHigh(point) >= breakoutReference * 0.995 && point.close <= breakoutReference * 0.99
    ).length;
    if (failedAttemptCount >= 2) {
      addRiskFactor(riskFactors, {
        code: "failed_peak_breakout",
        label: "Repeated failed breakout attempts",
        severity: failedAttemptCount >= 3 ? "high" : "medium",
        scoreImpact:
          failedAttemptCount >= 3
            ? DANGER_SCORE_SETTINGS.failedBreakoutHighImpact
            : DANGER_SCORE_SETTINGS.failedBreakoutMediumImpact,
        description: "The stock keeps probing the peak/breakout area but cannot hold above it, which weakens the quality of the pattern.",
        metrics: {
          breakoutReference: roundPrice(breakoutReference, pricingContext),
          failedAttemptCount
        }
      });
    }
  }

  if (supportPrice != null) {
    const latestBreak = recentPoints.find((point) => getPointLow(point) < supportPrice * 0.995);
    if (latestBreak) {
      const closedBelowSupport = latestBreak.close < supportPrice;
      addRiskFactor(riskFactors, {
        code: "support_break_attempt",
        label: closedBelowSupport ? "Support break in progress" : "Support under pressure",
        severity: closedBelowSupport ? "high" : "medium",
        scoreImpact:
          closedBelowSupport
            ? DANGER_SCORE_SETTINGS.supportBreakImpact
            : DANGER_SCORE_SETTINGS.supportPressureImpact,
        description: closedBelowSupport
          ? "Price already closed below the lower support/invalidation area, so the structure is close to invalid."
          : "Intraday tests have started to undercut the lower box/support area, which raises failure risk.",
        metrics: {
          supportPrice: roundPrice(supportPrice, pricingContext),
          latestLow: roundPrice(getPointLow(latestBreak), pricingContext),
          latestClose: roundPrice(latestBreak.close, pricingContext)
        }
      });
    }
  }

  if ((match.referenceCloseVsPeakPercent ?? 0) <= -18 && (match.referenceCloseVsLeadInPercent ?? 0) <= -8) {
    addRiskFactor(riskFactors, {
      code: "unrecovered_selloff",
      label: "Sharp selloff without recovery",
      severity: "high",
      scoreImpact: DANGER_SCORE_SETTINGS.unrecoveredSelloffImpact,
      description: "The stock gave back a large part of the surge and has not recovered enough, so this is closer to a damaged structure than a controlled digestion.",
      metrics: {
        referenceCloseVsPeakPercent: match.referenceCloseVsPeakPercent,
        referenceCloseVsLeadInPercent: match.referenceCloseVsLeadInPercent
      }
    });
  }

  if (recentPoints.length >= 4) {
    const lowerHighs = recentPoints.slice(1).reduce((count, point, index) => count + (getPointHigh(point) < getPointHigh(recentPoints[index]) ? 1 : 0), 0);
    const lowerCloses = recentPoints.slice(1).reduce((count, point, index) => count + (point.close < recentPoints[index].close ? 1 : 0), 0);
    const volumeNotDrying = (match.pullbackVolumeRatioToLeadIn ?? 1) > 0.55;
    if (lowerHighs >= 3 && lowerCloses >= 3 && volumeNotDrying) {
      addRiskFactor(riskFactors, {
        code: "downtrend_instead_of_digest",
        label: "Downtrend-like digestion",
        severity: "high",
        scoreImpact: DANGER_SCORE_SETTINGS.downtrendDigestImpact,
        description: "Recent highs and closes keep stepping lower while volume is not drying enough, so the pattern is drifting toward a simple downtrend.",
        metrics: {
          lowerHighs,
          lowerCloses,
          pullbackVolumeRatioToLeadIn: match.pullbackVolumeRatioToLeadIn
        }
      });
    }
  }

  const baseRisk =
    match.stage === "breakout"
      ? clamp(
          Math.round((match.breakoutFailureRiskScore ?? 0) * DANGER_SCORE_SETTINGS.breakoutBaseRiskWeight),
          0,
          DANGER_SCORE_SETTINGS.breakoutBaseRiskCap
        )
      : clamp(
          Math.round(
            (100 - (match.validityScore ?? 70)) * DANGER_SCORE_SETTINGS.setupValidityRiskWeight +
              Math.max(0, -((match.referenceCloseVsPeakPercent ?? -8) + 8)) * DANGER_SCORE_SETTINGS.setupPeakDamageWeight
          ),
          0,
          DANGER_SCORE_SETTINGS.setupBaseRiskCap
        );
  const dangerScore = clamp(baseRisk + riskFactors.reduce((sum, factor) => sum + factor.scoreImpact, 0), 0, 100);
  const dangerPenalty = DANGER_SCORE_SETTINGS.applyPenaltyToRank
    ? clamp(
        Math.round(dangerScore * DANGER_SCORE_SETTINGS.finalPenaltyWeight),
        0,
        DANGER_SCORE_SETTINGS.finalPenaltyCap
      )
    : 0;

  return {
    dangerScore,
    dangerPenalty,
    riskFactors
  };
}

function buildConditionChecks(
  match: SmartMoneyPatternMatch,
  filters: SmartMoneyPatternFilters,
  supportStatus: SmartMoneyDebugInfo["supportStatus"],
  breakoutStatus: SmartMoneyDebugInfo["breakoutStatus"],
  dangerScore: number
): SmartMoneyConditionCheck[] {
  const scoreThreshold =
    match.stage === "breakout"
      ? Math.max(filters.minPatternScore, filters.minBreakoutPatternScore) + (match.marketContext?.breakoutThresholdAdjustment ?? 0)
      : Math.max(filters.minPatternScore, filters.minSetupPatternScore) + (match.marketContext?.setupThresholdAdjustment ?? 0);
  const pullbackVolumeThreshold =
    match.setupType === "volatile_power_digestion"
      ? Math.min(filters.maxPullbackAvgVolumeRatio, filters.maxVolatileDigestionAvgVolumeRatio)
      : filters.maxPullbackAvgVolumeRatio;
  const breakoutZoneThreshold =
    match.stage === "breakout" ? filters.breakoutHoldTolerancePercent : filters.maxSetupDistanceBelowBreakoutLevelPercent;

  return [
    {
      key: "lead_in_impulse",
      label: "Lead-in impulse",
      passed:
        (match.leadInPriceChangePercent ?? 0) >= filters.minLeadInPriceChangePercent &&
        (match.leadInVolumeRatio20d ?? 0) >= filters.minLeadInVolumeRatio &&
        (match.leadInVolume ?? 0) >= filters.minLeadInVolumeShares,
      actual: match.leadInPriceChangePercent,
      threshold: filters.minLeadInPriceChangePercent,
      comparator: ">=",
      details: `Lead-in day rose ${match.leadInPriceChangePercent?.toFixed(1) ?? "-"}% with ${match.leadInVolumeRatio20d?.toFixed(1) ?? "-"}x volume and ${Math.round(match.leadInVolume ?? 0).toLocaleString("ko-KR")} shares.`
    },
    {
      key: "surge_follow_through",
      label: "Surge follow-through",
      passed: (match.surgeAdvancePercent ?? 0) >= filters.minSetupSurgeAdvancePercent,
      actual: match.surgeAdvancePercent,
      threshold: filters.minSetupSurgeAdvancePercent,
      comparator: ">=",
      details: `Surge advance after the lead-in was ${match.surgeAdvancePercent?.toFixed(1) ?? "-"}%.`
    },
    {
      key: "volume_digestion",
      label: "Volume drying",
      passed: (match.pullbackVolumeRatioToLeadIn ?? Infinity) <= pullbackVolumeThreshold,
      actual: match.pullbackVolumeRatioToLeadIn,
      threshold: pullbackVolumeThreshold,
      comparator: "<=",
      details: `Pullback volume cooled to ${match.pullbackVolumeRatioToLeadIn != null ? (match.pullbackVolumeRatioToLeadIn * 100).toFixed(0) : "-"}% of the lead-in anchor.`
    },
    {
      key: "pullback_depth",
      label: "Pullback depth",
      passed:
        match.pullbackMaxDrawdownPercent != null &&
        (match.setupType === "time_correction"
          ? match.pullbackMaxDrawdownPercent <= filters.maxTimeCorrectionDrawdownPercent
          : match.pullbackMaxDrawdownPercent <= filters.maxSetupPullbackDrawdownPercent),
      actual: match.pullbackMaxDrawdownPercent,
      threshold:
        match.setupType === "time_correction" ? filters.maxTimeCorrectionDrawdownPercent : filters.maxSetupPullbackDrawdownPercent,
      comparator: "<=",
      details: `Max pullback depth was ${match.pullbackMaxDrawdownPercent?.toFixed(1) ?? "-"}% across ${match.pullbackSessions} sessions.`
    },
    {
      key: "support_hold",
      label: "Support hold",
      passed: supportStatus !== "broken",
      actual: supportStatus,
      threshold: "holding/testing",
      comparator: "equals",
      details:
        match.invalidationPrice != null && match.referenceClose != null
          ? `Reference close ${match.referenceClose.toFixed(2)} sits ${match.referenceClose > match.invalidationPrice ? "above" : "below"} the invalidation line ${match.invalidationPrice.toFixed(2)}.`
          : "Support or invalidation level was not available."
    },
    {
      key: "breakout_structure",
      label: "Breakout structure",
      passed:
        match.stage === "breakout"
          ? (match.referenceCloseVsBreakoutLevelPercent ?? -Infinity) >= -filters.breakoutHoldTolerancePercent
          : (match.referenceCloseVsBreakoutLevelPercent ?? -Infinity) >= -filters.maxSetupDistanceBelowBreakoutLevelPercent,
      actual: match.referenceCloseVsBreakoutLevelPercent,
      threshold: -breakoutZoneThreshold,
      comparator: ">=",
      details:
        match.stage === "breakout"
          ? `Reference price is ${match.referenceCloseVsBreakoutLevelPercent?.toFixed(1) ?? "-"}% from the breakout line and breakout status is ${breakoutStatus}.`
          : `Setup is ${match.referenceCloseVsBreakoutLevelPercent?.toFixed(1) ?? "-"}% from the breakout line and breakout status is ${breakoutStatus}.`
    },
    {
      key: "danger_score",
      label: "Danger score",
      passed: dangerScore < DANGER_SCORE_SETTINGS.actionableBlockThreshold,
      actual: dangerScore,
      threshold: DANGER_SCORE_SETTINGS.actionableBlockThreshold - 1,
      comparator: "<=",
      details: `Danger score ${dangerScore} is compared against the watch-only threshold ${DANGER_SCORE_SETTINGS.actionableBlockThreshold}.`
    },
    {
      key: "score_threshold",
      label: "Pattern score threshold",
      passed: match.patternScore >= scoreThreshold,
      actual: match.patternScore,
      threshold: scoreThreshold,
      comparator: ">=",
      details: `Pattern score ${match.patternScore} is compared against the active threshold ${scoreThreshold}.`
    },
    {
      key: "market_regime",
      label: "Market regime",
      passed: match.marketContext?.actionableAllowed ?? true,
      actual: match.marketContext?.marketScoreAdjustment ?? 0,
      threshold: 0,
      comparator: ">=",
      details: `Market adjustment is ${match.marketContext?.marketScoreAdjustment ?? 0} and actionable permission is ${match.marketContext?.actionableAllowed ? "on" : "off"}.`
    }
  ];
}

function applyDangerControls(match: SmartMoneyPatternMatch, dangerScore: number) {
  const dangerManaged = dangerScore >= DANGER_SCORE_SETTINGS.actionableBlockThreshold;
  if (!dangerManaged) {
    return {
      actionable: match.actionable,
      status: match.status,
      entryStrategy: match.entryStrategy,
      reason: undefined
    };
  }

  let status = match.status;
  let entryStrategy = match.entryStrategy;

  if (status === "buy_ready") {
    status = "pullback_ready";
    entryStrategy = undefined;
  } else if (status === "breakout_confirmed") {
    status = "breakout_ready";
    entryStrategy = "breakout_ready";
  }

  return {
    actionable: false,
    status,
    entryStrategy,
    reason: `Danger score ${dangerScore} exceeded ${DANGER_SCORE_SETTINGS.actionableBlockThreshold}, so the setup was downgraded to watch-only.`
  };
}

function applyExecutionGuards(match: SmartMoneyPatternMatch): {
  match: SmartMoneyPatternMatch;
  reasons: string[];
} {
  const stopLoss = match.buyPlan?.stopLossPrice ?? match.tradePlan?.stopLoss ?? match.tradePlan?.invalidationPrice ?? match.invalidationPrice;
  const reasons: string[] = [];
  let buyPlan = match.buyPlan;
  let entryZoneLow = match.entryZoneLow;
  let entryZoneHigh = match.entryZoneHigh;

  if (buyPlan && stopLoss != null) {
    const buyPrices = [buyPlan.firstBuyPrice, buyPlan.secondBuyPrice, buyPlan.thirdBuyPrice].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );
    if (buyPrices.some((value) => value <= stopLoss)) {
      reasons.push(`Buy plan is invalid because at least one staged buy price is not above the stop-loss line ${stopLoss.toFixed(2)}.`);
      buyPlan = undefined;
    }
  }

  const effectiveEntryZoneLow = buyPlan?.thirdBuyPrice ?? match.tradePlan?.idealBuyZone?.low ?? entryZoneLow;
  const effectiveEntryZoneHigh = buyPlan?.firstBuyPrice ?? match.tradePlan?.idealBuyZone?.high ?? entryZoneHigh;
  if (
    stopLoss != null &&
    effectiveEntryZoneLow != null &&
    effectiveEntryZoneHigh != null &&
    (effectiveEntryZoneLow <= stopLoss || effectiveEntryZoneHigh <= stopLoss)
  ) {
    reasons.push(`Entry zone is invalid because it overlaps or falls below the stop-loss line ${stopLoss.toFixed(2)}.`);
    entryZoneLow = undefined;
    entryZoneHigh = undefined;
  }

  const executionRiskRewardRatio = resolveExecutionRiskRewardRatio(match);
  if (executionRiskRewardRatio == null || executionRiskRewardRatio < EXECUTION_GUARD_SETTINGS.minimumRiskRewardRatio) {
    reasons.push(
      `Execution risk-reward ratio ${executionRiskRewardRatio?.toFixed(2) ?? "-"} is below the minimum actionable threshold ${EXECUTION_GUARD_SETTINGS.minimumRiskRewardRatio.toFixed(1)}.`
    );
  }

  if (!reasons.length) {
    return {
      match,
      reasons
    };
  }

  let status = match.status;
  let entryStrategy = match.entryStrategy;
  if (match.actionable) {
    if (status === "buy_ready") {
      status = "pullback_ready";
      entryStrategy = undefined;
    } else if (status === "breakout_confirmed") {
      status = "breakout_ready";
      entryStrategy = "breakout_ready";
    }
  }

  return {
    match: {
      ...match,
      actionable: false,
      status,
      entryStrategy,
      buyPlan,
      entryZoneLow,
      entryZoneHigh
    },
    reasons
  };
}

function buildDebugInfo(
  match: SmartMoneyPatternMatch,
  conditions: SmartMoneyConditionCheck[],
  dangerPenalty: number
): SmartMoneyDebugInfo {
  const closeRetentionPct =
    match.referenceClose != null && match.surgePeakClose != null ? (match.referenceClose / match.surgePeakClose) * 100 : undefined;
  const supportStatus = deriveSupportStatus(match);
  const breakoutStatus = deriveBreakoutStatus(match);

  const summary = [
    match.surgeAdvancePercent != null
      ? `Surge advanced ${match.surgeAdvancePercent.toFixed(1)}% over ${match.surgeDurationDays ?? 0} sessions.`
      : "Surge follow-through could not be quantified from the current structure.",
    match.pullbackMaxDrawdownPercent != null
      ? `Pullback depth reached ${match.pullbackMaxDrawdownPercent.toFixed(1)}% across ${match.pullbackSessions} sessions while volume dried to ${match.pullbackVolumeRatioToLeadIn != null ? (match.pullbackVolumeRatioToLeadIn * 100).toFixed(0) : "-"}%.`
      : "Pullback structure metrics were not fully available.",
    match.referenceCloseVsBreakoutLevelPercent != null
      ? `Reference price is ${match.referenceCloseVsBreakoutLevelPercent.toFixed(1)}% from the breakout line and support is currently ${supportStatus}.`
      : `Support is currently ${supportStatus}.`
  ];

  return {
    surgePct: match.surgeAdvancePercent,
    surgeDurationDays: match.surgeDurationDays,
    surgeVolumeRatio: match.leadInVolumeRatio20d,
    peakPrice: match.surgePeakHigh ?? match.breakoutLevel,
    basePrice: match.basePrice,
    breakoutLevel: match.breakoutLevel,
    pullbackDays: match.pullbackSessions,
    pullbackDepthPct: match.pullbackMaxDrawdownPercent,
    pullbackRangePct: match.pullbackRangePercent,
    closeRetentionPct,
    volumeDryingRatio: match.pullbackVolumeRatioToLeadIn,
    breakoutStatus,
    supportStatus,
    marketScoreAdjustment: match.marketContext?.marketScoreAdjustment,
    dangerPenalty,
    conditions,
    summary
  };
}

function deriveRejectionReasons(
  match: SmartMoneyPatternMatch,
  conditions: SmartMoneyConditionCheck[],
  riskFactors: SmartMoneyRiskFactor[],
  explicitReasons: string[]
) {
  const reasons = [...explicitReasons];

  for (const condition of conditions) {
    if (!condition.passed) {
      reasons.push(condition.details);
    }
  }

  if (match.status === "broken") {
    reasons.push("The current structure is technically broken.");
  }

  if (match.dangerScore >= DANGER_SCORE_SETTINGS.rejectionAmplifierThreshold) {
    reasons.push(...riskFactors.slice(0, 2).map((factor) => factor.description));
  }

  return [...new Set(reasons.filter(Boolean))].slice(0, 6);
}

export function enhanceSmartMoneyMatch(input: EnhanceSmartMoneyMatchInput): SmartMoneyPatternMatch {
  const initialTradePlan = buildTradePlan(input.match, input.pricingContext);
  const scoringMatch: SmartMoneyPatternMatch = {
    ...input.match,
    tradePlan: initialTradePlan
  };
  const { dangerScore, dangerPenalty, riskFactors } = evaluateRiskFactors(
    scoringMatch,
    input.points,
    input.referenceIndex,
    input.pricingContext
  );
  const managed = applyDangerControls(scoringMatch, dangerScore);
  const workingMatch: SmartMoneyPatternMatch = {
    ...scoringMatch,
    actionable: managed.actionable,
    status: managed.status,
    entryStrategy: managed.entryStrategy
  };
  const tradePlan = buildTradePlan(
    {
      ...workingMatch,
      dangerScore
    },
    input.pricingContext
  );
  const executionManaged = applyExecutionGuards({
    ...workingMatch,
    tradePlan
  });
  const finalizedTradePlan = buildTradePlan(executionManaged.match, input.pricingContext);
  const finalizedMatch: SmartMoneyPatternMatch = {
    ...executionManaged.match,
    tradePlan: finalizedTradePlan
  };
  const postEntryOutcome = calculatePostEntryOutcome(finalizedMatch, input.points, input.referenceIndex, input.pricingContext);
  const conditions = buildConditionChecks(
    finalizedMatch,
    input.filters,
    deriveSupportStatus(finalizedMatch),
    deriveBreakoutStatus(finalizedMatch),
    dangerScore
  );
  const rejectionReasons = deriveRejectionReasons(
    {
      ...finalizedMatch,
      dangerScore
    },
    conditions,
    riskFactors,
    [...(input.rejectionReasons ?? []), ...(managed.reason ? [managed.reason] : []), ...executionManaged.reasons]
  );
  const debugInfo = buildDebugInfo(
    {
      ...finalizedMatch,
      dangerScore,
      riskFactors,
      rejectionReasons
    },
    conditions,
    dangerPenalty
  );

  return {
    ...finalizedMatch,
    postEntryOutcome,
    dangerScore,
    riskFactors,
    rejectionReasons: finalizedMatch.matched && finalizedMatch.actionable ? [] : rejectionReasons,
    debugInfo,
    finalRankScore:
      finalizedMatch.finalRankScore == null ? undefined : clamp(Math.round(finalizedMatch.finalRankScore - dangerPenalty), 0, 100)
  };
}
