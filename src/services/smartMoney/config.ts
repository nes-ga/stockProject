import type { SmartMoneyPatternFilters } from "../../types.js";

export const MARKET_CONTEXT_SETTINGS = {
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
    firstBuySma20ProximityPercent: 2.5,
    pullbackBuySecondEntryRiskRatio: 0.45,
    pullbackBuyThirdEntryRiskRatio: 0.15,
    stopLossLookbackSessions: 45,
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

  merged.minBreakoutTurnoverValue =
    overrides?.minBreakoutTurnoverValue ?? Math.max(merged.minTurnoverValue, merged.minBreakoutTurnoverValue);

  merged.pullbackBuySecondEntryRiskRatio = Math.min(Math.max(merged.pullbackBuySecondEntryRiskRatio, 0.1), 0.9);
  merged.pullbackBuyThirdEntryRiskRatio = Math.min(
    Math.max(merged.pullbackBuyThirdEntryRiskRatio, 0.02),
    Math.max(0.02, merged.pullbackBuySecondEntryRiskRatio - 0.05)
  );

  return merged;
}
