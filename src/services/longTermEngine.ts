import { createLogger } from "../lib/logger.js";
import type {
  FundamentalsSummary,
  LongTermReviewAnalysis,
  LongTermScanCandidate,
  LongTermScanFilters,
  LongTermScanResult,
  LongTermScoreBreakdown,
  LongTermUniverseSeed,
  StockUniverseItem
} from "../types.js";
import { fetchFundamentals } from "./fundamentals.js";
import {
  calculateCorrectionScore,
  hasMeaningfulCorrection,
  resolveLongTermCorrectionContext
} from "./longTerm/correctionScore.js";
import { resolveLongTermScanFilters } from "./longTerm/config.js";
import { evaluateLongTermFinancials, type LongTermFinancialEvaluation } from "./longTerm/fundamentalScore.js";
import {
  buildLongTermReasonSummary,
  classifyLongTermCandidateGroup,
  classifyLongTermLabel
} from "./longTerm/labels.js";
import { calculateLeaderScore } from "./longTerm/leaderScore.js";
import { calculateLiquidityScore } from "./longTerm/liquidityScore.js";
import { fetchLongTermChart } from "./longTerm/marketData.js";
import { evaluateLongTermMetrics, type LongTermMetricSnapshot } from "./longTerm/metrics.js";
import { calculateStabilizationScore } from "./longTerm/stabilizationScore.js";
import { calculateTrendScore } from "./longTerm/trendScore.js";
import { LONG_TERM_UNIVERSE } from "./longTerm/universe.js";
import { getStockUniverse } from "./stockUniverse.js";

const logger = createLogger("longTermEngine");
const UNIVERSE_SCAN_CHUNK_SIZE = 8;

type RankedMetric = {
  seed: LongTermUniverseSeed;
  seedSource: "curated" | "ad_hoc";
  market?: StockUniverseItem["market"];
  sector?: string;
  metrics: LongTermMetricSnapshot;
  turnoverRank?: number;
  sectorTurnoverRank?: number;
  sectorPeerCount?: number;
  financialEvaluation: LongTermFinancialEvaluation;
};

function passesUniverseLeaderProxy(entry: RankedMetric) {
  if (entry.seedSource === "curated") {
    return true;
  }

  if (!entry.sector) {
    return false;
  }

  if ((entry.metrics.liquidity.avgTurnover60 ?? 0) < 8_000_000_000) {
    return false;
  }

  if ((entry.turnoverRank ?? Number.POSITIVE_INFINITY) <= 120) {
    return true;
  }

  return (entry.sectorPeerCount ?? 0) >= 3 && (entry.sectorTurnoverRank ?? Number.POSITIVE_INFINITY) <= 2;
}

function calculateTotalScore(scores: Omit<LongTermScoreBreakdown, "totalScore">, filters: LongTermScanFilters) {
  return Math.round(
    scores.leaderScore * filters.leaderWeight +
      scores.correctionScore * filters.correctionWeight +
      scores.trendScore * filters.trendWeight +
      scores.liquidityScore * filters.liquidityWeight +
      scores.stabilizationScore * filters.stabilizationWeight +
      scores.financialScore * filters.financialWeight
  );
}

function isTradableEnough(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters) {
  return (
    (metrics.liquidity.avgTurnover20 ?? 0) >= filters.minimumTradableTurnover20 ||
    (metrics.liquidity.avgTurnover60 ?? 0) >= filters.minimumTradableTurnover60
  );
}

function isStructurallyBroken(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters) {
  return (
    (metrics.structure.ma120Slope ?? 0) <= -4 &&
    (metrics.structure.ma240Slope ?? 0) <= -1.5 &&
    (metrics.structure.priceVsMA240Pct ?? 0) <= -filters.farBelowMa240Pct &&
    metrics.baseStructure.daysSinceLastLowBreak <= filters.lowBreakPenaltyDays
  );
}

function resolveLongTermSeed(symbol: string, name?: string): {
  seed: LongTermUniverseSeed;
  seedSource: "curated" | "ad_hoc";
} {
  const curatedSeed = LONG_TERM_UNIVERSE.find((item) => item.symbol === symbol);
  if (curatedSeed) {
    return {
      seed: curatedSeed,
      seedSource: "curated"
    };
  }

  return {
    seed: {
      symbol,
      name: name ?? symbol,
      bucket: "secondary_candidate",
      tier: "secondary"
    },
    seedSource: "ad_hoc"
  };
}

function resolveFilterReasons(
  entry: RankedMetric,
  filters: LongTermScanFilters,
  candidate?: LongTermScanCandidate
): string[] {
  const reasons: string[] = [];

  if (entry.market === "ETF" || entry.market === "ETN") {
    reasons.push("ETF/ETN is out of scope for the long-term leader engine.");
  }

  if (!hasMeaningfulCorrection(entry.metrics, filters)) {
    reasons.push("Price has not corrected enough from the prior high.");
  }

  if (!isTradableEnough(entry.metrics, filters)) {
    reasons.push("Average turnover is below the long-term review floor.");
  }

  if (isStructurallyBroken(entry.metrics, filters)) {
    reasons.push("Long-term moving-average structure still looks broken.");
  }

  if (entry.financialEvaluation.hardExcluded) {
    reasons.push(...entry.financialEvaluation.hardExclusionReasons);
  }

  if (candidate && entry.seedSource === "ad_hoc" && candidate.scores.leaderScore < 55) {
    reasons.push("Representative status is too weak for the curated long-term framework.");
  }

  return reasons;
}

function buildCandidate(entry: RankedMetric, filters: LongTermScanFilters): LongTermScanCandidate {
  const correctionContext = resolveLongTermCorrectionContext(entry.metrics, filters);
  const leaderScore = calculateLeaderScore({
    seed: entry.seed,
    turnoverRank: entry.turnoverRank,
    sectorTurnoverRank: entry.sectorTurnoverRank,
    sectorPeerCount: entry.sectorPeerCount,
    isCurated: entry.seedSource === "curated"
  });
  const correctionScore = calculateCorrectionScore(entry.metrics, filters);
  const trendScore = calculateTrendScore(entry.metrics, filters);
  const liquidityScore = calculateLiquidityScore(entry.metrics, filters);
  const stabilizationScore = calculateStabilizationScore(entry.metrics, filters);
  const financialScore = entry.financialEvaluation.financialScore;

  const partialScores = {
    leaderScore,
    correctionScore,
    trendScore,
    liquidityScore,
    stabilizationScore,
    financialScore,
    durabilityScore: financialScore
  };

  const scores: LongTermScoreBreakdown = {
    totalScore: calculateTotalScore(partialScores, filters),
    ...partialScores
  };

  const label = classifyLongTermLabel(scores, entry.metrics, entry.financialEvaluation.snapshot);
  const candidateGroup = classifyLongTermCandidateGroup(
    scores,
    entry.metrics,
    label,
    filters,
    entry.financialEvaluation.snapshot
  );
  return {
    symbol: entry.seed.symbol,
    name: entry.seed.name,
    sector: entry.sector,
    price: entry.metrics.price,
    high52w: entry.metrics.high52w,
    high2y: entry.metrics.high2y,
    high5y: entry.metrics.high5y,
    drawdownPct: correctionContext.drawdownPct ?? entry.metrics.drawdownPct,
    drawdown5yPct: entry.metrics.drawdown5yPct,
    drawdownReference: correctionContext.reference,
    scores,
    structure: entry.metrics.structure,
    baseStructure: entry.metrics.baseStructure,
    liquidity: entry.metrics.liquidity,
    financials: entry.financialEvaluation.snapshot,
    fundamentals: entry.financialEvaluation.snapshot,
    candidateGroup,
    label,
    reasonSummary: buildLongTermReasonSummary(
      scores,
      entry.metrics,
      entry.financialEvaluation.snapshot,
      correctionContext
    )
  };
}

function rankMetrics(loaded: RankedMetric[]): RankedMetric[] {
  const sectorBuckets = new Map<string, RankedMetric[]>();

  for (const item of loaded) {
    if (!item.sector) {
      continue;
    }
    const bucket = sectorBuckets.get(item.sector) ?? [];
    bucket.push(item);
    sectorBuckets.set(item.sector, bucket);
  }

  const overallRanked = [...loaded].sort(
    (left, right) => (right.metrics.liquidity.avgTurnover60 ?? 0) - (left.metrics.liquidity.avgTurnover60 ?? 0)
  );

  const sectorRankBySymbol = new Map<string, { rank: number; peerCount: number }>();
  for (const [, items] of sectorBuckets) {
    const ranked = [...items].sort(
      (left, right) => (right.metrics.liquidity.avgTurnover60 ?? 0) - (left.metrics.liquidity.avgTurnover60 ?? 0)
    );
    ranked.forEach((item, index) => {
      sectorRankBySymbol.set(item.seed.symbol, {
        rank: index + 1,
        peerCount: ranked.length
      });
    });
  }

  return overallRanked.map((item, index) => {
    const sectorRank = sectorRankBySymbol.get(item.seed.symbol);
    return {
      ...item,
      turnoverRank: index + 1,
      sectorTurnoverRank: sectorRank?.rank,
      sectorPeerCount: sectorRank?.peerCount
    };
  });
}

async function loadRankedMetric(options: {
  seed: LongTermUniverseSeed;
  seedSource: "curated" | "ad_hoc";
  market?: StockUniverseItem["market"];
  sector?: string;
  filters: LongTermScanFilters;
  fundamentals?: FundamentalsSummary;
  fetchFinancials?: boolean;
}): Promise<RankedMetric> {
  const points = await fetchLongTermChart(options.seed.symbol, options.filters.historySessions);
  const metrics = evaluateLongTermMetrics(points, options.filters);
  const stabilizationScore = calculateStabilizationScore(metrics, options.filters);
  const fundamentals =
    options.fetchFinancials === false ? undefined : options.fundamentals ?? (await fetchFundamentals(options.seed.symbol));
  const financialEvaluation = evaluateLongTermFinancials(fundamentals, {
    isLeader: options.seedSource === "curated",
    drawdownPct: metrics.drawdownPct,
    stabilizationScore,
    isStabilizing: metrics.baseStructure.isStabilizing
  });

  return {
    seed: options.seed,
    seedSource: options.seedSource,
    market: options.market,
    sector: options.sector,
    metrics,
    financialEvaluation
  };
}

async function enrichRankedMetricsWithFundamentals(
  entries: RankedMetric[],
  filters: LongTermScanFilters,
  chunkSize = 4
): Promise<RankedMetric[]> {
  const enriched: RankedMetric[] = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(async (entry) => {
        const fundamentals = await fetchFundamentals(entry.seed.symbol);
        const stabilizationScore = calculateStabilizationScore(entry.metrics, filters);
        return {
          ...entry,
          financialEvaluation: evaluateLongTermFinancials(fundamentals, {
            isLeader: entry.seedSource === "curated",
            drawdownPct: entry.metrics.drawdownPct,
            stabilizationScore,
            isStabilizing: entry.metrics.baseStructure.isStabilizing
          })
        } satisfies RankedMetric;
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

function buildScanResult(
  rankedItems: RankedMetric[],
  filters: LongTermScanFilters,
  requestedUniverseSize: number
): LongTermScanResult {
  const candidates = rankedItems
    .map((item) => {
      const candidate = buildCandidate(item, filters);
      return {
        candidate,
        filterReasons: resolveFilterReasons(item, filters, candidate)
      };
    })
    .filter((entry) => entry.filterReasons.length === 0)
    .map((entry) => entry.candidate)
    .sort((left, right) => right.scores.totalScore - left.scores.totalScore);

  const buyCandidates = candidates.filter((candidate) => candidate.candidateGroup === "buy candidate");
  const watchCandidates = candidates.filter((candidate) => candidate.candidateGroup === "watch candidate");

  logger.info("scan:finish", {
    universeSize: requestedUniverseSize,
    loadedCount: rankedItems.length,
    candidateCount: candidates.length,
    buyCandidateCount: buyCandidates.length,
    watchCandidateCount: watchCandidates.length
  });

  return {
    asOfDate: rankedItems[0]?.metrics.latestDate ?? new Date().toISOString().slice(0, 10),
    universeSize: requestedUniverseSize,
    filters,
    candidates,
    groupedCandidates: {
      buyCandidates,
      watchCandidates
    }
  };
}

export async function scanLongTermLeaders(options?: {
  symbols?: string[];
  filters?: Partial<LongTermScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<LongTermScanResult> {
  const filters = resolveLongTermScanFilters(options?.filters);
  const allowedSymbols = options?.symbols?.length ? new Set(options.symbols) : null;
  const seeds = LONG_TERM_UNIVERSE.filter((seed) => (allowedSymbols ? allowedSymbols.has(seed.symbol) : true));
  const universe = await getStockUniverse({ forceRefresh: options?.forceRefreshUniverse });
  const universeByCode = new Map(universe.items.map((item) => [item.code, item]));
  const targetSeeds = seeds.filter((seed) => {
    const item = universeByCode.get(seed.symbol);
    return item != null && item.market !== "ETF" && item.market !== "ETN";
  });

  logger.info("scan:start", {
    scanLabel: "curated",
    universeSize: targetSeeds.length
  });

  const settled = await Promise.allSettled(
    targetSeeds.map((seed) =>
      loadRankedMetric({
        seed,
        seedSource: "curated",
        market: universeByCode.get(seed.symbol)?.market,
        sector: universeByCode.get(seed.symbol)?.sector,
        filters
      })
    )
  );

  const loaded: RankedMetric[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      loaded.push(result.value);
    }
  }

  return buildScanResult(rankMetrics(loaded), filters, targetSeeds.length);
}

export async function scanLongTermUniverse(options?: {
  symbols?: string[];
  filters?: Partial<LongTermScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<LongTermScanResult> {
  const filters = resolveLongTermScanFilters(options?.filters);
  const allowedSymbols = options?.symbols?.length ? new Set(options.symbols) : null;
  const universe = await getStockUniverse({ forceRefresh: options?.forceRefreshUniverse });
  const targets = universe.items.filter((item) => {
    if (allowedSymbols && !allowedSymbols.has(item.code)) {
      return false;
    }

    return item.market === "KOSPI" || item.market === "KOSDAQ";
  });

  logger.info("scan:start", {
    scanLabel: "universe-v2",
    universeSize: targets.length
  });

  const loaded: RankedMetric[] = [];

  for (let index = 0; index < targets.length; index += UNIVERSE_SCAN_CHUNK_SIZE) {
    const chunk = targets.slice(index, index + UNIVERSE_SCAN_CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((item) => {
        const { seed, seedSource } = resolveLongTermSeed(item.code, item.name);
        return loadRankedMetric({
          seed,
          seedSource,
          market: item.market,
          sector: item.sector,
          filters,
          fetchFinancials: false
        });
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        loaded.push(result.value);
      }
    }

    logger.info("scan:progress", {
      scanLabel: "universe-v2",
      processed: Math.min(index + chunk.length, targets.length),
      universeSize: targets.length,
      loadedCount: loaded.length
    });
  }

  const ranked = rankMetrics(loaded);
  const prelimEntries = ranked.filter((item) => {
    const candidate = buildCandidate(item, filters);
    const filterReasons = resolveFilterReasons(item, filters, candidate);

    if (filterReasons.length > 0) {
      return false;
    }

    if (!passesUniverseLeaderProxy(item)) {
      return false;
    }

    if (candidate.scores.leaderScore < 58) {
      return false;
    }

    if (candidate.scores.totalScore < 66) {
      return false;
    }

    return true;
  });

  const enrichedEntries = await enrichRankedMetricsWithFundamentals(prelimEntries, filters);
  const candidates = enrichedEntries
    .map((item) => ({
      item,
      candidate: buildCandidate(item, filters)
    }))
    .filter(({ item, candidate }) => {
      const filterReasons = resolveFilterReasons(item, filters, candidate);
      if (filterReasons.length > 0) {
        return false;
      }

      if (!passesUniverseLeaderProxy(item)) {
        return false;
      }

      if (candidate.scores.leaderScore < 58) {
        return false;
      }

      if (candidate.scores.totalScore < 66) {
        return false;
      }

      return true;
    })
    .map(({ candidate }) => candidate)
    .sort((left, right) => right.scores.totalScore - left.scores.totalScore);

  const buyCandidates = candidates.filter((candidate) => candidate.candidateGroup === "buy candidate");
  const watchCandidates = candidates.filter((candidate) => candidate.candidateGroup === "watch candidate");

  logger.info("scan:finish", {
    scanLabel: "universe-v2",
    universeSize: targets.length,
    loadedCount: loaded.length,
    prelimCount: prelimEntries.length,
    candidateCount: candidates.length,
    buyCandidateCount: buyCandidates.length,
    watchCandidateCount: watchCandidates.length
  });

  return {
    asOfDate: ranked[0]?.metrics.latestDate ?? new Date().toISOString().slice(0, 10),
    universeSize: targets.length,
    filters,
    candidates,
    groupedCandidates: {
      buyCandidates,
      watchCandidates
    }
  };
}

export async function analyzeLongTermCandidate(options: {
  symbol: string;
  name?: string;
  fundamentals?: FundamentalsSummary;
  filters?: Partial<LongTermScanFilters>;
  forceRefreshUniverse?: boolean;
}): Promise<LongTermReviewAnalysis> {
  const filters = resolveLongTermScanFilters(options.filters);
  const universe = await getStockUniverse({ forceRefresh: options.forceRefreshUniverse });
  const universeItem = universe.items.find((item) => item.code === options.symbol);
  const { seed, seedSource } = resolveLongTermSeed(options.symbol, options.name ?? universeItem?.name);

  if (universeItem?.market === "ETF" || universeItem?.market === "ETN") {
    return {
      symbol: options.symbol,
      name: options.name ?? universeItem.name,
      market: universeItem.market,
      sector: universeItem.sector,
      seedSource,
      enginePass: false,
      filterReasons: ["ETF/ETN is out of scope for the long-term leader engine."]
    };
  }

  const entry = await loadRankedMetric({
    seed,
    seedSource,
    market: universeItem?.market,
    sector: universeItem?.sector,
    filters,
    fundamentals: options.fundamentals
  });
  const candidate = buildCandidate(entry, filters);
  const filterReasons = resolveFilterReasons(entry, filters, candidate);

  return {
    symbol: options.symbol,
    name: options.name ?? candidate.name,
    market: universeItem?.market,
    sector: universeItem?.sector,
    seedSource,
    enginePass: filterReasons.length === 0,
    filterReasons,
    candidate
  };
}
