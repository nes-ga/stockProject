import type {
  LongTermScanCandidate,
  LongTermScanFilters,
  LongTermScoreBreakdown,
  LongTermUniverseSeed,
  StockUniverseItem
} from "../../types.js";
import { passesBaseLiquidityFloor } from "../sharedLiquidity.js";
import { calculateCorrectionScore, hasMeaningfulCorrection, resolveLongTermCorrectionContext } from "./correctionScore.js";
import { evaluateLongTermFinancials, type LongTermFinancialEvaluation } from "./fundamentalScore.js";
import {
  buildLongTermExplainability,
  buildLongTermReasonSummary,
  classifyLongTermCandidateGroup,
  classifyLongTermLabel
} from "./labels.js";
import { calculateLeaderScore } from "./leaderScore.js";
import { calculateLiquidityScore } from "./liquidityScore.js";
import type { LongTermMetricSnapshot } from "./metrics.js";
import { calculateStabilizationScore } from "./stabilizationScore.js";
import { calculateTrendScore } from "./trendScore.js";

export type LongTermRankedEntry = {
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

function isStructurallyBroken(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters) {
  return (
    (metrics.structure.ma120Slope ?? 0) <= -4 &&
    (metrics.structure.ma240Slope ?? 0) <= -1.5 &&
    (metrics.structure.priceVsMA240Pct ?? 0) <= -filters.farBelowMa240Pct &&
    metrics.baseStructure.daysSinceLastLowBreak <= filters.lowBreakPenaltyDays
  );
}

export function qualifiesLongTermSecondaryRecovery(
  entry: LongTermRankedEntry,
  filters: LongTermScanFilters,
  scores: Omit<LongTermScoreBreakdown, "totalScore"> & { totalScore?: number }
) {
  if (entry.seedSource !== "ad_hoc") {
    return false;
  }

  const snapshot = entry.financialEvaluation.snapshot;
  return (
    scores.correctionScore >= 78 &&
    scores.stabilizationScore >= 62 &&
    (entry.metrics.baseStructure.higherLowQualityScore ?? 0) >= 58 &&
    scores.trendScore >= 52 &&
    (entry.metrics.structure.ma120Slope ?? 0) >= 0 &&
    snapshot.earningsState !== "persistent_loss" &&
    snapshot.financialMomentum !== "deteriorating" &&
    snapshot.debtState !== "dangerous" &&
    !snapshot.strongRevenueDecline &&
    !isStructurallyBroken(entry.metrics, filters)
  );
}

export function buildLongTermCandidate(entry: LongTermRankedEntry, filters: LongTermScanFilters): LongTermScanCandidate {
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

  const secondaryRecovery = qualifiesLongTermSecondaryRecovery(entry, filters, scores);
  const classificationOptions = {
    allowBuy: !secondaryRecovery,
    secondaryRecovery
  };
  const label = classifyLongTermLabel(scores, entry.metrics, entry.financialEvaluation.snapshot);
  const candidateGroup = classifyLongTermCandidateGroup(
    scores,
    entry.metrics,
    label,
    filters,
    entry.financialEvaluation.snapshot,
    classificationOptions
  );
  const explainability = buildLongTermExplainability(
    scores,
    entry.metrics,
    label,
    filters,
    entry.financialEvaluation.snapshot,
    classificationOptions
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
    ),
    strengths: explainability.strengths,
    weaknesses: explainability.weaknesses,
    failureReasons: explainability.failureReasons,
    tags: explainability.tags
  };
}

export function resolveLongTermFilterReasons(
  entry: LongTermRankedEntry,
  filters: LongTermScanFilters,
  candidate?: LongTermScanCandidate
): string[] {
  const reasons: string[] = [];
  const isSecondaryRecovery = candidate?.tags.includes("watch_secondary_recovery") ?? false;

  if (entry.market === "ETF" || entry.market === "ETN") {
    reasons.push("ETF/ETN is out of scope for the long-term leader engine.");
  }

  if (!hasMeaningfulCorrection(entry.metrics, filters)) {
    reasons.push("Price has not corrected enough from the prior high.");
  }

  if (!passesBaseLiquidityFloor(entry.metrics.liquidity, filters)) {
    reasons.push("Average turnover is below the long-term review floor.");
  }

  if (isStructurallyBroken(entry.metrics, filters)) {
    reasons.push("Long-term moving-average structure still looks broken.");
  }

  if (entry.financialEvaluation.hardExcluded) {
    reasons.push(...entry.financialEvaluation.hardExclusionReasons);
  }

  if (candidate && entry.seedSource === "ad_hoc" && candidate.scores.leaderScore < 55 && !isSecondaryRecovery) {
    reasons.push("Representative status is too weak for the curated long-term framework.");
  }

  return reasons;
}
