import type {
  ChartPoint,
  DividendMetricSnapshot,
  DividendScanCandidate,
  DividendScanFilters,
  DividendScanLabel,
  DividendScoreBreakdown,
  FundamentalsPeriod,
  FundamentalsSummary,
  LongTermFinancialSnapshot,
  LongTermLiquiditySnapshot,
  LongTermStructureSnapshot,
  StockUniverseItem
} from "../../types.js";
import { passesBaseLiquidityFloor } from "../sharedLiquidity.js";
import { enrichFundamentalsWithDividendYields, parseAnnualPeriodLabel } from "../sharedDividendData.js";
import type { LongTermMetricSnapshot } from "../longTerm/metrics.js";

export type DividendRankedEntry = {
  symbol: string;
  name: string;
  market?: StockUniverseItem["market"];
  sector?: string;
  chartPoints?: ChartPoint[];
  metrics: LongTermMetricSnapshot;
  fundamentals?: FundamentalsSummary;
  financialSnapshot?: LongTermFinancialSnapshot;
  financialHardExcluded?: boolean;
  financialHardExclusionReasons?: string[];
};

type DividendSeriesItem = {
  year: number;
  dividendPerShare?: number;
  dividendYield?: number;
  eps?: number;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function percentChange(current: number, previous?: number) {
  if (previous == null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function buildDividendSeries(fundamentals?: FundamentalsSummary): DividendSeriesItem[] {
  const annualHistory = Array.isArray(fundamentals?.annualHistory) ? fundamentals.annualHistory : [];
  const latestAnnual = fundamentals?.annual;
  const allPeriods = latestAnnual ? [...annualHistory, latestAnnual] : annualHistory;
  const deduped = new Map<number, DividendSeriesItem>();

  allPeriods.forEach((period) => {
    const parsed = parseAnnualPeriodLabel(period.label);
    if (!parsed?.year) {
      return;
    }

    const existing = deduped.get(parsed.year);
    if (!existing || (period.dividendPerShare ?? 0) >= (existing.dividendPerShare ?? 0)) {
      deduped.set(parsed.year, {
        year: parsed.year,
        dividendPerShare: period.dividendPerShare,
        dividendYield: period.dividendYield,
        eps: period.eps,
        revenue: period.revenue,
        operatingIncome: period.operatingIncome,
        netIncome: period.netIncome
      });
    }
  });

  return [...deduped.values()].sort((left, right) => left.year - right.year);
}

function countSkippedYears(series: DividendSeriesItem[]) {
  if (series.length < 2) {
    return 0;
  }

  let skipped = 0;
  for (let index = 1; index < series.length; index += 1) {
    skipped += Math.max(0, series[index].year - series[index - 1].year - 1);
  }
  return skipped;
}

function countRecentCuts(series: DividendSeriesItem[]) {
  let cuts = 0;
  const positiveSeries = series.filter((item) => (item.dividendPerShare ?? 0) > 0);
  const recent = positiveSeries.slice(-4);
  for (let index = 1; index < recent.length; index += 1) {
    if ((recent[index].dividendPerShare ?? 0) < (recent[index - 1].dividendPerShare ?? 0)) {
      cuts += 1;
    }
  }
  return cuts;
}

function calculateConsecutiveDividendYears(series: DividendSeriesItem[]) {
  const positiveSeries = series.filter((item) => (item.dividendPerShare ?? 0) > 0);
  if (!positiveSeries.length) {
    return 0;
  }

  let consecutive = 1;
  for (let index = positiveSeries.length - 1; index > 0; index -= 1) {
    const current = positiveSeries[index];
    const previous = positiveSeries[index - 1];
    if (current.year - previous.year === 1) {
      consecutive += 1;
      continue;
    }
    break;
  }

  return consecutive;
}

function calculateGrowthCagr(series: DividendSeriesItem[]) {
  const positiveSeries = series.filter((item) => (item.dividendPerShare ?? 0) > 0);
  if (positiveSeries.length < 3) {
    return undefined;
  }

  const first = positiveSeries[0];
  const last = positiveSeries[positiveSeries.length - 1];
  const years = last.year - first.year;
  if (years <= 0 || (first.dividendPerShare ?? 0) <= 0 || (last.dividendPerShare ?? 0) <= 0) {
    return undefined;
  }

  return (Math.pow((last.dividendPerShare ?? 0) / (first.dividendPerShare ?? 1), 1 / years) - 1) * 100;
}

function calculateGrowthConsistency(series: DividendSeriesItem[]) {
  const positiveSeries = series.filter((item) => (item.dividendPerShare ?? 0) > 0);
  if (positiveSeries.length < 3) {
    return undefined;
  }

  const yearChanges: number[] = [];
  let nonDecliningCount = 0;
  let erraticMoves = 0;

  for (let index = 1; index < positiveSeries.length; index += 1) {
    const previous = positiveSeries[index - 1].dividendPerShare ?? 0;
    const current = positiveSeries[index].dividendPerShare ?? 0;
    const change = percentChange(current, previous) ?? 0;
    yearChanges.push(change);
    if (current >= previous) {
      nonDecliningCount += 1;
    }
    if (Math.abs(change) >= 35) {
      erraticMoves += 1;
    }
  }

  const stableRatio = yearChanges.length ? (nonDecliningCount / yearChanges.length) * 100 : 0;
  return clamp(Math.round(stableRatio - erraticMoves * 12), 0, 100);
}

function resolveLatestDividendYield(fundamentals?: FundamentalsSummary, series?: DividendSeriesItem[]) {
  const latestSeriesYield = [...(series ?? [])].reverse().find((item) => (item.dividendYield ?? 0) > 0)?.dividendYield;
  return latestSeriesYield ?? fundamentals?.annual?.dividendYield;
}

function calculatePayoutRatio(latest?: DividendSeriesItem, fundamentals?: FundamentalsSummary) {
  const dividendPerShare = latest?.dividendPerShare ?? fundamentals?.annual?.dividendPerShare;
  const eps = latest?.eps ?? fundamentals?.annual?.eps;
  if (dividendPerShare == null || eps == null || !Number.isFinite(dividendPerShare) || !Number.isFinite(eps) || dividendPerShare <= 0) {
    return undefined;
  }

  if (eps <= 0) {
    return 999;
  }

  return (dividendPerShare / eps) * 100;
}

function calculateEarningsCoverage(latest?: DividendSeriesItem, fundamentals?: FundamentalsSummary) {
  const dividendPerShare = latest?.dividendPerShare ?? fundamentals?.annual?.dividendPerShare;
  const eps = latest?.eps ?? fundamentals?.annual?.eps;
  if (dividendPerShare == null || eps == null || dividendPerShare <= 0 || !Number.isFinite(dividendPerShare) || !Number.isFinite(eps)) {
    return undefined;
  }

  return eps / dividendPerShare;
}

function evaluateDividendTrapRisk(params: {
  latestYield?: number;
  payoutRatio?: number;
  consecutiveYears: number;
  recentCuts: number;
  financials?: LongTermFinancialSnapshot;
  priceMetrics: LongTermMetricSnapshot;
  safetyScore?: number;
  durabilityScore?: number;
}) {
  const reasons: string[] = [];
  const latestYield = params.latestYield ?? 0;
  const drawdown = Math.abs(params.priceMetrics.drawdownPct ?? 0);
  const financials = params.financials;

  if (latestYield >= 8 && drawdown >= 25) {
    reasons.push("high_yield_after_price_collapse");
  }
  if ((params.payoutRatio ?? 0) >= 100) {
    reasons.push("payout_ratio_dangerous");
  }
  if ((params.payoutRatio ?? 0) >= 85 && financials?.financialMomentum === "deteriorating") {
    reasons.push("payout_high_with_deteriorating_momentum");
  }
  if (financials?.operatingProfitTrend === "weakening" || financials?.netIncomeTrend === "weakening") {
    reasons.push("earnings_deteriorating");
  }
  if ((financials?.recentOperatingLossCount ?? 0) >= 2 || financials?.earningsState === "persistent_loss") {
    reasons.push("repeated_profit_weakness");
  }
  if (params.recentCuts > 0 || params.consecutiveYears < 3) {
    reasons.push("dividend_continuity_weak");
  }
  if ((params.safetyScore ?? 100) < 45 || (params.durabilityScore ?? 100) < 45) {
    reasons.push("dividend_support_weak");
  }

  return {
    trapRiskScore: clamp(reasons.length * 20 + (latestYield >= 8 ? 12 : latestYield >= 6 ? 6 : 0), 0, 100),
    trapRiskReasons: reasons
  };
}

export function computeDividendMetrics(
  fundamentals: FundamentalsSummary | undefined,
  priceMetrics: LongTermMetricSnapshot
): DividendMetricSnapshot {
  const enrichedFundamentals = enrichFundamentalsWithDividendYields(fundamentals, []);
  const series = buildDividendSeries(enrichedFundamentals);
  const paidYears = series.filter((item) => (item.dividendPerShare ?? 0) > 0);
  const latest = paidYears[paidYears.length - 1] ?? series[series.length - 1];
  const latestYield = resolveLatestDividendYield(enrichedFundamentals, paidYears);
  const averageYield = average(
    paidYears
      .slice(-5)
      .map((item) => item.dividendYield)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  );

  return {
    yearsPaidCount: paidYears.length,
    consecutiveDividendYears: calculateConsecutiveDividendYears(paidYears),
    skippedDividendYears: countSkippedYears(paidYears),
    recentDividendCutCount: countRecentCuts(paidYears),
    dividendGrowthCagr: calculateGrowthCagr(paidYears),
    dividendGrowthConsistency: calculateGrowthConsistency(paidYears),
    latestDividendPerShare: latest?.dividendPerShare,
    latestDividendYield: latestYield,
    averageDividendYield: averageYield,
    payoutRatio: calculatePayoutRatio(latest, enrichedFundamentals),
    earningsCoverageRatio: calculateEarningsCoverage(latest, enrichedFundamentals),
    dividendDataCoverage: clamp(Math.round((paidYears.length / Math.max(1, series.length || 1)) * 100), 0, 100),
    trapRiskScore: 0,
    trapRiskReasons: []
  };
}

function calculateDividendStabilityScore(metrics: DividendMetricSnapshot, filters: DividendScanFilters) {
  let score = 20;

  if (metrics.consecutiveDividendYears >= filters.targetDividendYears) {
    score += 42;
  } else if (metrics.consecutiveDividendYears >= 5) {
    score += 32;
  } else if (metrics.consecutiveDividendYears >= filters.minimumDividendYears) {
    score += 22;
  } else if (metrics.consecutiveDividendYears >= 1) {
    score += 10;
  }

  if (metrics.yearsPaidCount >= filters.targetDividendYears + 2) {
    score += 16;
  } else if (metrics.yearsPaidCount >= filters.targetDividendYears) {
    score += 10;
  }

  score -= metrics.skippedDividendYears * 10;
  score -= metrics.recentDividendCutCount * 18;

  if (metrics.dividendDataCoverage >= 80) {
    score += 10;
  } else if (metrics.dividendDataCoverage < 50) {
    score -= 12;
  }

  return clamp(Math.round(score), 0, 100);
}

function calculateDividendGrowthScore(metrics: DividendMetricSnapshot, filters: DividendScanFilters) {
  let score = 30;
  const cagr = metrics.dividendGrowthCagr ?? 0;
  const consistency = metrics.dividendGrowthConsistency ?? 0;

  if (cagr >= filters.stableGrowthTargetCagr + 3) {
    score += 28;
  } else if (cagr >= filters.stableGrowthTargetCagr) {
    score += 20;
  } else if (cagr >= 1) {
    score += 10;
  } else if (cagr < -2) {
    score -= 20;
  } else if (cagr < 0) {
    score -= 8;
  }

  if (consistency >= filters.stableGrowthTargetConsistency + 10) {
    score += 24;
  } else if (consistency >= filters.stableGrowthTargetConsistency) {
    score += 16;
  } else if (consistency >= 50) {
    score += 8;
  } else {
    score -= 12;
  }

  score -= metrics.recentDividendCutCount * 12;
  return clamp(Math.round(score), 0, 100);
}

function calculateDividendSafetyScore(
  metrics: DividendMetricSnapshot,
  financials: LongTermFinancialSnapshot | undefined,
  filters: DividendScanFilters
) {
  let score = 40;
  const payoutRatio = metrics.payoutRatio ?? 999;
  const coverage = metrics.earningsCoverageRatio ?? 0;
  const yieldValue = metrics.latestDividendYield ?? 0;

  if (payoutRatio <= 35) {
    score += 24;
  } else if (payoutRatio <= 55) {
    score += 18;
  } else if (payoutRatio <= filters.payoutRatioWatchThreshold) {
    score += 8;
  } else if (payoutRatio <= filters.payoutRatioDangerThreshold) {
    score -= 12;
  } else {
    score -= 28;
  }

  if (coverage >= 2) {
    score += 18;
  } else if (coverage >= filters.minimumEarningsCoverageRatio) {
    score += 10;
  } else if (coverage > 0) {
    score -= 10;
  } else {
    score -= 20;
  }

  if (yieldValue >= filters.minDividendYield && yieldValue <= filters.elevatedDividendYield) {
    score += 8;
  } else if (yieldValue > filters.dangerDividendYield) {
    score -= 10;
  }

  if (metrics.recentDividendCutCount > 0) {
    score -= metrics.recentDividendCutCount * 14;
  }
  if (financials?.financialMomentum === "deteriorating") {
    score -= 12;
  }
  if (financials?.earningsState === "persistent_loss") {
    score -= 18;
  }
  if ((financials?.recentOperatingLossCount ?? 0) >= 2) {
    score -= 10;
  }
  if (financials?.strongRevenueDecline) {
    score -= 8;
  }

  return clamp(Math.round(score), 0, 100);
}

function calculateFinancialDurabilityScore(
  financials: LongTermFinancialSnapshot | undefined,
  metrics: DividendMetricSnapshot
) {
  if (!financials) {
    return 35;
  }

  let score = 45;

  if (financials.revenueTrend === "improving") {
    score += 10;
  } else if (financials.revenueTrend === "weakening") {
    score -= 12;
  }

  if (financials.operatingProfitTrend === "improving") {
    score += 14;
  } else if (financials.operatingProfitTrend === "weakening") {
    score -= 16;
  }

  if (financials.netIncomeTrend === "improving") {
    score += 10;
  } else if (financials.netIncomeTrend === "weakening") {
    score -= 12;
  }

  if (financials.earningsState === "profitable") {
    score += 14;
  } else if (financials.earningsState === "temporary_loss") {
    score -= 16;
  } else {
    score -= 28;
  }

  if (financials.roeState === "strong") {
    score += 10;
  } else if (financials.roeState === "normal") {
    score += 6;
  } else if (financials.roeState === "negative") {
    score -= 14;
  }

  if (financials.debtState === "safe") {
    score += 10;
  } else if (financials.debtState === "manageable") {
    score += 6;
  } else if (financials.debtState === "high") {
    score -= 10;
  } else {
    score -= 18;
  }

  if (financials.businessClarity === "clear_core_business") {
    score += 8;
  } else if (financials.businessClarity === "unclear") {
    score -= 10;
  }

  if (financials.financialMomentum === "improving") {
    score += 10;
  } else if (financials.financialMomentum === "stabilizing") {
    score += 4;
  } else {
    score -= 14;
  }

  if ((financials.recentOperatingLossCount ?? 0) >= 2) {
    score -= 12;
  }
  if ((financials.recentNetLossCount ?? 0) >= 2) {
    score -= 8;
  }
  if (financials.strongRevenueDecline) {
    score -= 12;
  }
  if (metrics.payoutRatio != null && metrics.payoutRatio >= 100) {
    score -= 10;
  }

  return clamp(Math.round(score), 0, 100);
}

function calculatePriceSupportScore(structure: LongTermStructureSnapshot) {
  let score = 60;
  const ma120Slope = structure.ma120Slope ?? 0;
  const ma240Slope = structure.ma240Slope ?? 0;
  const priceVsMA120Pct = structure.priceVsMA120Pct ?? 0;
  const priceVsMA240Pct = structure.priceVsMA240Pct ?? 0;

  if (ma240Slope <= -2) {
    score -= 24;
  } else if (ma240Slope < -0.5) {
    score -= 10;
  } else if (ma240Slope >= 0.5) {
    score += 6;
  }

  if (ma120Slope <= -2) {
    score -= 18;
  } else if (ma120Slope < -0.5) {
    score -= 8;
  } else if (ma120Slope >= 0.5) {
    score += 8;
  }

  if (priceVsMA240Pct < -35) {
    score -= 18;
  } else if (priceVsMA240Pct < -20) {
    score -= 8;
  }

  if (priceVsMA120Pct > 20) {
    score -= 10;
  } else if (priceVsMA120Pct > 8) {
    score -= 4;
  }

  return clamp(Math.round(score), 0, 100);
}

export function computeDividendScores(params: {
  dividendMetrics: DividendMetricSnapshot;
  financials?: LongTermFinancialSnapshot;
  liquidity: LongTermLiquiditySnapshot;
  structure: LongTermStructureSnapshot;
  filters: DividendScanFilters;
}): DividendScoreBreakdown {
  const dividendStabilityScore = calculateDividendStabilityScore(params.dividendMetrics, params.filters);
  const dividendGrowthScore = calculateDividendGrowthScore(params.dividendMetrics, params.filters);
  const dividendSafetyScore = calculateDividendSafetyScore(params.dividendMetrics, params.financials, params.filters);
  const financialDurabilityScore = calculateFinancialDurabilityScore(params.financials, params.dividendMetrics);
  const liquidityScore = clamp(
    Math.round((((params.liquidity.avgTurnover20 ?? 0) >= params.filters.minimumTradableTurnover20 ? 55 : 25) +
      ((params.liquidity.avgTurnover60 ?? 0) >= params.filters.minimumTradableTurnover60 ? 25 : 10) +
      (((params.liquidity.volumeConsistency ?? 0) / 100) * 20))),
    0,
    100
  );
  const priceSupportScore = calculatePriceSupportScore(params.structure);

  return {
    dividendStabilityScore,
    dividendGrowthScore,
    dividendSafetyScore,
    financialDurabilityScore,
    liquidityScore,
    priceSupportScore,
    totalScore: Math.round(
      dividendStabilityScore * params.filters.stabilityWeight +
        dividendGrowthScore * params.filters.growthWeight +
        dividendSafetyScore * params.filters.safetyWeight +
        financialDurabilityScore * params.filters.durabilityWeight +
        liquidityScore * params.filters.liquidityWeight +
        priceSupportScore * params.filters.priceSupportWeight
    )
  };
}

function classifyDividendLabel(params: {
  metrics: DividendMetricSnapshot;
  scores: DividendScoreBreakdown;
  tags: string[];
  candidateGroup: DividendScanCandidate["candidateGroup"];
}): DividendScanLabel {
  if (params.tags.includes("dividend_trap_risk")) {
    return "dividend_trap_risk";
  }
  if (params.tags.includes("dividend_irregular_history")) {
    return "dividend_irregular_history";
  }
  if (params.candidateGroup === "buy candidate") {
    if (
      params.metrics.consecutiveDividendYears >= 7 &&
      params.scores.dividendStabilityScore >= 78 &&
      params.scores.dividendSafetyScore >= 72 &&
      params.scores.financialDurabilityScore >= 68
    ) {
      return "dividend_income_core";
    }
    if (params.scores.dividendGrowthScore >= 68 && params.metrics.dividendGrowthCagr != null && params.metrics.dividendGrowthCagr >= 4) {
      return "dividend_growth_candidate";
    }
    return "dividend_stable_payer";
  }
  if (params.tags.includes("dividend_watch_payout_risk")) {
    return "dividend_watch_payout_risk";
  }
  if (params.tags.includes("dividend_watch_growth_slowing")) {
    return "dividend_watch_growth_slowing";
  }
  return "dividend_watch_financial_repair";
}

function buildDividendExplainability(params: {
  entry: DividendRankedEntry;
  metrics: DividendMetricSnapshot;
  scores: DividendScoreBreakdown;
  filters: DividendScanFilters;
  trapRiskScore: number;
  trapRiskReasons: string[];
}) {
  const strengths = new Set<string>();
  const weaknesses = new Set<string>();
  const failureReasons: string[] = [];
  const tags = new Set<string>();

  if (params.metrics.consecutiveDividendYears >= params.filters.minimumDividendYears) {
    strengths.add("long_dividend_history");
  }
  if (params.scores.dividendStabilityScore >= 70) {
    strengths.add("dividend_stable");
  }
  if (params.scores.dividendGrowthScore >= 65) {
    strengths.add("dividend_growth_consistent");
  }
  if (params.scores.dividendSafetyScore >= 70) {
    strengths.add("dividend_safe");
  }
  if (params.scores.financialDurabilityScore >= 65) {
    strengths.add("financial_stable");
  }
  if (params.scores.liquidityScore >= 60) {
    strengths.add("tradable_liquidity");
  }

  if (params.metrics.yearsPaidCount < params.filters.minimumDividendYears) {
    failureReasons.push("dividend_history_short");
    weaknesses.add("dividend_history_short");
    tags.add("dividend_irregular_history");
  }
  if (params.metrics.recentDividendCutCount > params.filters.maxRecentDividendCutsForBuy) {
    failureReasons.push("recent_dividend_cut");
    weaknesses.add("recent_dividend_cut");
    tags.add("dividend_irregular_history");
  }
  if (params.scores.dividendSafetyScore < 60) {
    failureReasons.push("dividend_safety_weak");
    weaknesses.add("dividend_safety_weak");
    tags.add("dividend_watch_payout_risk");
  }
  if ((params.metrics.payoutRatio ?? 0) >= params.filters.payoutRatioWatchThreshold) {
    failureReasons.push("payout_ratio_elevated");
    weaknesses.add("payout_ratio_elevated");
    tags.add("dividend_watch_payout_risk");
  }
  if (params.scores.dividendGrowthScore < 55) {
    failureReasons.push("dividend_growth_slowing");
    weaknesses.add("dividend_growth_slowing");
    tags.add("dividend_watch_growth_slowing");
  }
  if (params.scores.financialDurabilityScore < 60) {
    failureReasons.push("financial_durability_weak");
    weaknesses.add("financial_durability_weak");
    tags.add("dividend_watch_financial_repair");
  }
  if (params.scores.priceSupportScore < 35) {
    failureReasons.push("price_support_broken");
    weaknesses.add("price_structure_weak");
  }
  if (params.metrics.dividendDataCoverage < 60) {
    failureReasons.push("dividend_data_limited");
    weaknesses.add("dividend_data_limited");
    tags.add("dividend_data_limited");
  }
  if (params.trapRiskScore >= 45) {
    failureReasons.push(...params.trapRiskReasons);
    weaknesses.add("dividend_trap_risk");
    tags.add("dividend_trap_risk");
  }

  return {
    strengths: [...strengths],
    weaknesses: [...weaknesses],
    failureReasons: [...new Set(failureReasons)],
    tags: [...tags]
  };
}

export function buildDividendCandidate(entry: DividendRankedEntry, filters: DividendScanFilters): DividendScanCandidate {
  const dividendMetricsBase = computeDividendMetrics(entry.fundamentals, entry.metrics);
  const scores = computeDividendScores({
    dividendMetrics: dividendMetricsBase,
    financials: entry.financialSnapshot,
    liquidity: entry.metrics.liquidity,
    structure: entry.metrics.structure,
    filters
  });
  const trapRisk = evaluateDividendTrapRisk({
    latestYield: dividendMetricsBase.latestDividendYield,
    payoutRatio: dividendMetricsBase.payoutRatio,
    consecutiveYears: dividendMetricsBase.consecutiveDividendYears,
    recentCuts: dividendMetricsBase.recentDividendCutCount,
    financials: entry.financialSnapshot,
    priceMetrics: entry.metrics,
    safetyScore: scores.dividendSafetyScore,
    durabilityScore: scores.financialDurabilityScore
  });
  const dividendMetrics: DividendMetricSnapshot = {
    ...dividendMetricsBase,
    trapRiskScore: trapRisk.trapRiskScore,
    trapRiskReasons: trapRisk.trapRiskReasons
  };
  const explainability = buildDividendExplainability({
    entry,
    metrics: dividendMetrics,
    scores,
    filters,
    trapRiskScore: trapRisk.trapRiskScore,
    trapRiskReasons: trapRisk.trapRiskReasons
  });
  const canBuy =
    dividendMetrics.yearsPaidCount >= filters.minimumDividendYears &&
    dividendMetrics.recentDividendCutCount <= filters.maxRecentDividendCutsForBuy &&
    (dividendMetrics.latestDividendYield ?? 0) >= filters.minDividendYield &&
    scores.dividendStabilityScore >= 68 &&
    scores.dividendSafetyScore >= 68 &&
    scores.financialDurabilityScore >= 60 &&
    scores.liquidityScore >= 55 &&
    scores.priceSupportScore >= 35 &&
    !explainability.tags.includes("dividend_trap_risk") &&
    !explainability.failureReasons.includes("dividend_data_limited");
  const candidateGroup = canBuy ? "buy candidate" : "watch candidate";
  const label = classifyDividendLabel({
    metrics: dividendMetrics,
    scores,
    tags: explainability.tags,
    candidateGroup
  });

  const summaryParts = [
    `${dividendMetrics.consecutiveDividendYears}y dividend streak`,
    dividendMetrics.latestDividendYield != null ? `yield ${dividendMetrics.latestDividendYield.toFixed(1)}%` : "yield n/a",
    dividendMetrics.payoutRatio != null ? `payout ${Math.round(dividendMetrics.payoutRatio)}%` : "payout n/a",
    dividendMetrics.dividendGrowthCagr != null ? `DPS CAGR ${dividendMetrics.dividendGrowthCagr.toFixed(1)}%` : "growth limited",
    explainability.failureReasons.length ? `watch: ${explainability.failureReasons.slice(0, 2).join(", ")}` : "dividend profile intact"
  ];

  return {
    symbol: entry.symbol,
    name: entry.name,
    sector: entry.sector,
    price: entry.metrics.price,
    dividendMetrics,
    scores,
    structure: entry.metrics.structure,
    liquidity: entry.metrics.liquidity,
    financials: entry.financialSnapshot,
    candidateGroup,
    label,
    reasonSummary: summaryParts.join(", "),
    strengths: explainability.strengths,
    weaknesses: explainability.weaknesses,
    failureReasons: explainability.failureReasons,
    tags: explainability.tags
  };
}

export function resolveDividendFilterReasons(
  entry: DividendRankedEntry,
  filters: DividendScanFilters,
  candidate?: DividendScanCandidate
) {
  const reasons: string[] = [];

  if (entry.market === "ETF" || entry.market === "ETN") {
    reasons.push("ETF/ETN is out of scope for the dividend engine.");
  }
  if (!passesBaseLiquidityFloor(entry.metrics.liquidity, filters)) {
    reasons.push("Average turnover is below the dividend review floor.");
  }
  if ((candidate?.dividendMetrics.yearsPaidCount ?? 0) === 0) {
    reasons.push("No confirmed dividend payment history.");
  }
  if ((candidate?.dividendMetrics.latestDividendYield ?? 0) < filters.minDividendYield) {
    reasons.push("Dividend yield is below the minimum income floor.");
  }
  if (entry.financialHardExcluded) {
    reasons.push(...(entry.financialHardExclusionReasons ?? []));
  }
  if ((candidate?.dividendMetrics.trapRiskScore ?? 0) >= 70) {
    reasons.push("Dividend trap risk is too high.");
  }
  if ((candidate?.scores.priceSupportScore ?? 100) < 20) {
    reasons.push("Price structure is too broken for a dividend review.");
  }

  return reasons;
}
