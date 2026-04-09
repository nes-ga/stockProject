import type { LongTermScanFilters } from "../../types.js";

export function resolveLongTermScanFilters(overrides?: Partial<LongTermScanFilters>): LongTermScanFilters {
  return {
    // 5-year supplementary drawdown needs more than ~1,260 trading sessions.
    historySessions: 1600,
    recentBaseWindow: 60,
    slopeLookbackSessions: 20,
    higherLowLookbackWindow: 80,
    higherLowPivotSpan: 3,
    minimumBaseDays: 15,
    minimumTradableTurnover20: 5_000_000_000,
    minimumTradableTurnover60: 4_000_000_000,
    minimumDrawdownPct: 25,
    strongDrawdownPct: 35,
    deepDrawdownPct: 45,
    longCycleSupplementDrawdownPct: 40,
    longCycleRecoveryThresholdPct: 5,
    nearHighPenaltyPct: 10,
    overextendedVsMa120Pct: 15,
    farBelowMa240Pct: 25,
    lowBreakPenaltyDays: 12,
    coolingVolumeRatioThreshold: 0.85,
    leaderWeight: 0.25,
    correctionWeight: 0.2,
    trendWeight: 0.15,
    liquidityWeight: 0.1,
    stabilizationWeight: 0.15,
    financialWeight: 0.15,
    ...overrides
  };
}
