import type {
  ChartPoint,
  SmartMoneyConditionCheck,
  SmartMoneyDebugInfo,
  SmartMoneyPatternFilters,
  SmartMoneyPatternMatch,
  SmartMoneyRiskFactor,
  SmartMoneyTradePlan
} from "../types.js";

type EnhanceSmartMoneyMatchInput = {
  match: SmartMoneyPatternMatch;
  points: ChartPoint[];
  referenceIndex: number;
  filters: SmartMoneyPatternFilters;
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
  applyPenaltyToRank: false,
  finalPenaltyWeight: 0.12,
  finalPenaltyCap: 12,
  rejectionAmplifierThreshold: 78
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value?: number): number | undefined {
  return value == null || !Number.isFinite(value) ? undefined : Math.round(value * 100) / 100;
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
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

function buildTradePlan(match: SmartMoneyPatternMatch): SmartMoneyTradePlan | undefined {
  const zoneLow = roundPrice(match.buyPlan?.thirdBuyPrice ?? match.entryZoneLow);
  const zoneHigh = roundPrice(match.buyPlan?.firstBuyPrice ?? match.entryZoneHigh);
  const breakoutPrice = roundPrice(match.breakoutLevel ?? match.surgePeakHigh ?? match.referenceClose);
  const invalidationPrice = roundPrice(match.invalidationPrice);
  const stopLoss = roundPrice(match.buyPlan?.stopLossPrice ?? invalidationPrice);
  const technicalEntry = zoneLow != null && zoneHigh != null ? (zoneLow + zoneHigh) / 2 : match.referenceClose;
  const riskPerShare =
    technicalEntry != null && stopLoss != null && technicalEntry > stopLoss ? technicalEntry - stopLoss : undefined;
  const targetPrice =
    breakoutPrice != null && riskPerShare != null && riskPerShare > 0
      ? roundPrice(
          (match.stage === "setup" ? Math.max(technicalEntry ?? breakoutPrice, breakoutPrice) : Math.max(match.referenceClose ?? breakoutPrice, breakoutPrice)) +
            riskPerShare * 2
        )
      : undefined;
  const riskRewardRatio =
    targetPrice != null && technicalEntry != null && stopLoss != null && technicalEntry > stopLoss
      ? Math.round(((targetPrice - technicalEntry) / (technicalEntry - stopLoss)) * 100) / 100
      : undefined;

  const notes = [
    match.stage === "breakout"
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
  referenceIndex: number
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
          supportPrice: roundPrice(supportPrice),
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
          breakoutReference: roundPrice(breakoutReference),
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
          supportPrice: roundPrice(supportPrice),
          latestLow: roundPrice(getPointLow(latestBreak)),
          latestClose: roundPrice(latestBreak.close)
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
  breakoutStatus: SmartMoneyDebugInfo["breakoutStatus"]
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
        (match.leadInVolumeRatio20d ?? 0) >= filters.minLeadInVolumeRatio,
      actual: match.leadInPriceChangePercent,
      threshold: filters.minLeadInPriceChangePercent,
      comparator: ">=",
      details: `Lead-in day rose ${match.leadInPriceChangePercent?.toFixed(1) ?? "-"}% with ${match.leadInVolumeRatio20d?.toFixed(1) ?? "-"}x volume.`
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
  const tradePlan = buildTradePlan(input.match);
  const workingMatch: SmartMoneyPatternMatch = {
    ...input.match,
    tradePlan
  };
  const { dangerScore, dangerPenalty, riskFactors } = evaluateRiskFactors(workingMatch, input.points, input.referenceIndex);
  const conditions = buildConditionChecks(workingMatch, input.filters, deriveSupportStatus(workingMatch), deriveBreakoutStatus(workingMatch));
  const rejectionReasons = deriveRejectionReasons(
    {
      ...workingMatch,
      dangerScore
    },
    conditions,
    riskFactors,
    input.rejectionReasons ?? []
  );
  const debugInfo = buildDebugInfo(
    {
      ...workingMatch,
      dangerScore,
      riskFactors,
      rejectionReasons
    },
    conditions,
    dangerPenalty
  );

  return {
    ...workingMatch,
    dangerScore,
    riskFactors,
    rejectionReasons: workingMatch.matched && workingMatch.actionable ? [] : rejectionReasons,
    debugInfo,
    finalRankScore:
      workingMatch.finalRankScore == null ? undefined : clamp(Math.round(workingMatch.finalRankScore - dangerPenalty), 0, 100)
  };
}
