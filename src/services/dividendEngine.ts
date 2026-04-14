import { createLogger } from "../lib/logger.js";
import type {
  DividendReviewAnalysis,
  DividendScanFilters,
  DividendScanResult,
  FundamentalsSummary,
  StockUniverseItem
} from "../types.js";
import { fetchFundamentals } from "./fundamentals.js";
import { resolveDividendScanFilters } from "./dividend/config.js";
import { buildDividendCandidate, resolveDividendFilterReasons, type DividendRankedEntry } from "./dividend/strategy.js";
import { evaluateLongTermFinancials } from "./longTerm/fundamentalScore.js";
import { fetchLongTermChart } from "./longTerm/marketData.js";
import { evaluateLongTermMetrics } from "./longTerm/metrics.js";
import { getStockUniverse } from "./stockUniverse.js";
import { enrichFundamentalsWithDividendYields } from "./sharedDividendData.js";

const logger = createLogger("dividendEngine");
const DIVIDEND_SCAN_CHUNK_SIZE = 8;

function rankDividendEntries(loaded: DividendRankedEntry[]) {
  return [...loaded].sort(
    (left, right) => (right.metrics.liquidity.avgTurnover60 ?? 0) - (left.metrics.liquidity.avgTurnover60 ?? 0)
  );
}

async function loadDividendEntry(options: {
  symbol: string;
  name: string;
  market?: StockUniverseItem["market"];
  sector?: string;
  filters: DividendScanFilters;
  fundamentals?: FundamentalsSummary;
  fetchFundamentals?: boolean;
}): Promise<DividendRankedEntry> {
  const points = await fetchLongTermChart(options.symbol, options.filters.historySessions);
  const metrics = evaluateLongTermMetrics(points, {
    historySessions: options.filters.historySessions,
    recentBaseWindow: 60,
    slopeLookbackSessions: 20,
    higherLowLookbackWindow: 80,
    higherLowPivotSpan: 3,
    majorLowLookbackWindow: 120,
    minimumBaseDays: 15,
    longBaseRewardStartDays: 60,
    longBaseRewardFullDays: 120,
    vShapePenaltyPeakDays: 35,
    minimumTradableTurnover20: options.filters.minimumTradableTurnover20,
    minimumTradableTurnover60: options.filters.minimumTradableTurnover60,
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
    higherLowQualityBuyFloor: 55,
    leaderWeight: 0.25,
    correctionWeight: 0.2,
    trendWeight: 0.15,
    liquidityWeight: 0.1,
    stabilizationWeight: 0.15,
    financialWeight: 0.15
  });
  const fundamentals =
    options.fetchFundamentals === false ? undefined : enrichFundamentalsWithDividendYields(options.fundamentals ?? (await fetchFundamentals(options.symbol)), points);
  const financialEvaluation = evaluateLongTermFinancials(fundamentals, {
    isLeader: false,
    drawdownPct: metrics.drawdownPct,
    stabilizationScore: 0,
    isStabilizing: false
  });

  return {
    symbol: options.symbol,
    name: options.name,
    market: options.market,
    sector: options.sector,
    chartPoints: points,
    metrics,
    fundamentals,
    financialSnapshot: financialEvaluation.snapshot,
    financialHardExcluded: financialEvaluation.hardExcluded,
    financialHardExclusionReasons: financialEvaluation.hardExclusionReasons
  };
}

async function enrichDividendEntriesWithFundamentals(
  entries: DividendRankedEntry[],
  filters: DividendScanFilters,
  chunkSize = 4
) {
  const enriched: DividendRankedEntry[] = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(async (entry) => {
        const chartPoints = entry.chartPoints ?? (await fetchLongTermChart(entry.symbol, filters.historySessions));
        const fundamentals = enrichFundamentalsWithDividendYields(await fetchFundamentals(entry.symbol), chartPoints);
        const financialEvaluation = evaluateLongTermFinancials(fundamentals, {
          isLeader: false,
          drawdownPct: entry.metrics.drawdownPct,
          stabilizationScore: 0,
          isStabilizing: false
        });

        return {
          ...entry,
          chartPoints,
          fundamentals,
          financialSnapshot: financialEvaluation.snapshot,
          financialHardExcluded: financialEvaluation.hardExcluded,
          financialHardExclusionReasons: financialEvaluation.hardExclusionReasons
        } satisfies DividendRankedEntry;
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        enriched.push(result.value);
      }
    }
  }

  return enriched;
}

function buildDividendScanResult(
  rankedItems: DividendRankedEntry[],
  filters: DividendScanFilters,
  requestedUniverseSize: number
): DividendScanResult {
  const candidates = rankedItems
    .map((item) => {
      const candidate = buildDividendCandidate(item, filters);
      return {
        candidate,
        filterReasons: resolveDividendFilterReasons(item, filters, candidate)
      };
    })
    .filter((entry) => entry.filterReasons.length === 0)
    .map((entry) => entry.candidate)
    .sort((left, right) => right.scores.totalScore - left.scores.totalScore);

  const buyCandidates = candidates.filter((candidate) => candidate.candidateGroup === "buy candidate");
  const watchCandidates = candidates.filter((candidate) => candidate.candidateGroup === "watch candidate");

  logger.info("scan:finish", {
    universeSize: requestedUniverseSize,
    candidateCount: candidates.length,
    buyCandidateCount: buyCandidates.length,
    watchCandidateCount: watchCandidates.length
  });

  return {
    asOfDate: new Date().toISOString().slice(0, 10),
    universeSize: requestedUniverseSize,
    filters,
    candidates,
    groupedCandidates: {
      buyCandidates,
      watchCandidates
    }
  };
}

export async function scanDividendUniverse(options?: {
  symbols?: string[];
  filters?: Partial<DividendScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<DividendScanResult> {
  const filters = resolveDividendScanFilters(options?.filters);
  const allowedSymbols = options?.symbols?.length ? new Set(options.symbols) : null;
  const universe = await getStockUniverse({ forceRefresh: options?.forceRefreshUniverse });
  const targets = universe.items.filter((item) => {
    if (allowedSymbols && !allowedSymbols.has(item.code)) {
      return false;
    }

    return item.market === "KOSPI" || item.market === "KOSDAQ";
  });

  logger.info("scan:start", {
    scanLabel: "dividend",
    universeSize: targets.length
  });

  const loaded: DividendRankedEntry[] = [];
  for (let index = 0; index < targets.length; index += DIVIDEND_SCAN_CHUNK_SIZE) {
    const chunk = targets.slice(index, index + DIVIDEND_SCAN_CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((item) =>
        loadDividendEntry({
          symbol: item.code,
          name: item.name,
          market: item.market,
          sector: item.sector,
          filters,
          fetchFundamentals: false
        })
      )
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        loaded.push(result.value);
      }
    }
  }

  const prelimEntries = rankDividendEntries(loaded).filter((entry) => {
    const baseReasons = resolveDividendFilterReasons(entry, filters);
    if (baseReasons.some((reason) => reason.includes("turnover") || reason.includes("ETF/ETN"))) {
      return false;
    }
    if ((entry.metrics.structure.ma240Slope ?? 0) <= -3 && (entry.metrics.structure.priceVsMA240Pct ?? 0) <= -35) {
      return false;
    }
    return true;
  });

  const enrichedEntries = await enrichDividendEntriesWithFundamentals(prelimEntries, filters);
  return buildDividendScanResult(rankDividendEntries(enrichedEntries), filters, targets.length);
}

export async function analyzeDividendCandidate(options: {
  symbol: string;
  name?: string;
  fundamentals?: FundamentalsSummary;
  filters?: Partial<DividendScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<DividendReviewAnalysis> {
  const filters = resolveDividendScanFilters(options.filters);
  const universe = await getStockUniverse({ forceRefresh: options.forceRefreshUniverse });
  const universeItem = universe.items.find((item) => item.code === options.symbol);

  if (universeItem?.market === "ETF" || universeItem?.market === "ETN") {
    return {
      symbol: options.symbol,
      name: options.name ?? universeItem.name,
      market: universeItem.market,
      sector: universeItem.sector,
      enginePass: false,
      filterReasons: ["ETF/ETN is out of scope for the dividend engine."]
    };
  }

  const entry = await loadDividendEntry({
    symbol: options.symbol,
    name: options.name ?? universeItem?.name ?? options.symbol,
    market: universeItem?.market,
    sector: universeItem?.sector,
    filters,
    fundamentals: options.fundamentals
  });
  const candidate = buildDividendCandidate(entry, filters);
  const filterReasons = resolveDividendFilterReasons(entry, filters, candidate);

  return {
    symbol: options.symbol,
    name: options.name ?? candidate.name,
    market: universeItem?.market,
    sector: universeItem?.sector,
    enginePass: filterReasons.length === 0,
    filterReasons,
    candidate
  };
}
