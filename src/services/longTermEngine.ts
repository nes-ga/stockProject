import { createLogger } from "../lib/logger.js";
import type {
  FundamentalsSummary,
  LongTermReviewAnalysis,
  LongTermScanFilters,
  LongTermScanResult,
  LongTermUniverseSeed,
  StockUniverseItem
} from "../types.js";
import { fetchFundamentals } from "./fundamentals.js";
import { resolveLongTermScanFilters } from "./longTerm/config.js";
import { evaluateLongTermFinancials, type LongTermFinancialEvaluation } from "./longTerm/fundamentalScore.js";
import { fetchLongTermChart } from "./longTerm/marketData.js";
import { evaluateLongTermMetrics, type LongTermMetricSnapshot } from "./longTerm/metrics.js";
import { calculateStabilizationScore } from "./longTerm/stabilizationScore.js";
import {
  buildLongTermCandidate,
  resolveLongTermFilterReasons,
  type LongTermRankedEntry
} from "./longTerm/strategy.js";
import { LONG_TERM_UNIVERSE } from "./longTerm/universe.js";
import { getStockUniverse } from "./stockUniverse.js";

const logger = createLogger("longTermEngine");
const UNIVERSE_SCAN_CHUNK_SIZE = 8;

function passesUniverseLeaderProxy(entry: LongTermRankedEntry) {
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

function rankMetrics(loaded: LongTermRankedEntry[]): LongTermRankedEntry[] {
  const sectorBuckets = new Map<string, LongTermRankedEntry[]>();

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
}): Promise<LongTermRankedEntry> {
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
    chartPoints: points,
    metrics,
    financialEvaluation
  };
}

async function enrichRankedMetricsWithFundamentals(
  entries: LongTermRankedEntry[],
  filters: LongTermScanFilters,
  chunkSize = 4
): Promise<LongTermRankedEntry[]> {
  const enriched: LongTermRankedEntry[] = [];

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
        } satisfies LongTermRankedEntry;
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
  rankedItems: LongTermRankedEntry[],
  filters: LongTermScanFilters,
  requestedUniverseSize: number
): LongTermScanResult {
  const candidates = rankedItems
    .map((item) => {
      const candidate = buildLongTermCandidate(item, filters);
      return {
        candidate,
        filterReasons: resolveLongTermFilterReasons(item, filters, candidate)
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

  const loaded: LongTermRankedEntry[] = [];
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

  const loaded: LongTermRankedEntry[] = [];

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
    const candidate = buildLongTermCandidate(item, filters);
    const filterReasons = resolveLongTermFilterReasons(item, filters, candidate);
    const secondaryRecovery = candidate.tags.includes("watch_secondary_recovery");

    if (filterReasons.length > 0) {
      return false;
    }

    if (!passesUniverseLeaderProxy(item) && !secondaryRecovery) {
      return false;
    }

    if (candidate.scores.leaderScore < 58 && !secondaryRecovery) {
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
      candidate: buildLongTermCandidate(item, filters)
    }))
    .filter(({ item, candidate }) => {
      const filterReasons = resolveLongTermFilterReasons(item, filters, candidate);
      const secondaryRecovery = candidate.tags.includes("watch_secondary_recovery");
      if (filterReasons.length > 0) {
        return false;
      }

      if (!passesUniverseLeaderProxy(item) && !secondaryRecovery) {
        return false;
      }

      if (candidate.scores.leaderScore < 58 && !secondaryRecovery) {
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
  const candidate = buildLongTermCandidate(entry, filters);
  const filterReasons = resolveLongTermFilterReasons(entry, filters, candidate);

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
