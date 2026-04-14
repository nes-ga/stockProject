import type { DividendScanFilters } from "../../types.js";

export function resolveDividendScanFilters(overrides?: Partial<DividendScanFilters>): DividendScanFilters {
  return {
    historySessions: 2200,
    minimumTradableTurnover20: 5_000_000_000,
    minimumTradableTurnover60: 4_000_000_000,
    minimumDividendYears: 3,
    targetDividendYears: 8,
    maxRecentDividendCutsForBuy: 0,
    minDividendYield: 1.2,
    elevatedDividendYield: 5.5,
    dangerDividendYield: 8,
    payoutRatioWatchThreshold: 75,
    payoutRatioDangerThreshold: 100,
    minimumEarningsCoverageRatio: 1.1,
    stableGrowthTargetCagr: 4,
    stableGrowthTargetConsistency: 70,
    stabilityWeight: 0.25,
    growthWeight: 0.15,
    safetyWeight: 0.25,
    durabilityWeight: 0.2,
    liquidityWeight: 0.1,
    priceSupportWeight: 0.05,
    ...overrides
  };
}
