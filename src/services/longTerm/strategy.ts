import type {
  ChartPoint,
  LongTermCandidateType,
  LongTermScanCandidate,
  LongTermScanFilters,
  LongTermScoreBreakdown,
  LongTermUniverseSeed,
  StockUniverseItem
} from "../../types.js";
import { passesBaseLiquidityFloor } from "../sharedLiquidity.js";
import { analyzeLongTermVolumeProfile } from "../volumeProfile.js";
import { calculateCorrectionScore, resolveLongTermCorrectionContext } from "./correctionScore.js";
import { evaluateLongTermFinancials, type LongTermFinancialEvaluation } from "./fundamentalScore.js";
import {
  buildLongTermExplainability,
  buildLongTermReasonSummary,
  buildLongTermStageExplanation,
  classifyLongTermCandidateGroup,
  classifyLongTermLabel
} from "./labels.js";
import { calculateLeaderScore } from "./leaderScore.js";
import { calculateLiquidityScore } from "./liquidityScore.js";
import type { LongTermMetricSnapshot } from "./metrics.js";
import { calculateStabilizationScore } from "./stabilizationScore.js";
import { calculateTrendScore } from "./trendScore.js";
import { clamp } from "./utils.js";

export type LongTermRankedEntry = {
  seed: LongTermUniverseSeed;
  seedSource: "curated" | "ad_hoc";
  market?: StockUniverseItem["market"];
  sector?: string;
  chartPoints?: ChartPoint[];
  metrics: LongTermMetricSnapshot;
  turnoverRank?: number;
  sectorTurnoverRank?: number;
  sectorPeerCount?: number;
  financialEvaluation: LongTermFinancialEvaluation;
};

function calculateBaseScore(scores: Omit<LongTermScoreBreakdown, "totalScore" | "baseScore" | "bonusScore" | "rawScore">, filters: LongTermScanFilters) {
  return Math.round(
    scores.leaderScore * filters.leaderWeight +
      scores.correctionScore * filters.correctionWeight +
      scores.trendScore * filters.trendWeight +
      scores.liquidityScore * filters.liquidityWeight +
      scores.stabilizationScore * filters.stabilizationWeight +
      scores.financialScore * filters.financialWeight
  );
}

function calculateBonusScore(scores: Pick<LongTermScoreBreakdown, "volumeProfileScore" | "higherTimeframeScore">) {
  return (scores.volumeProfileScore ?? 0) + (scores.higherTimeframeScore ?? 0);
}

function normalizeLongTermScore(baseScore: number, bonusScore: number) {
  const compressedBonus = clamp(bonusScore, -30, 40) * 0.35;
  return clamp(Math.round(baseScore + compressedBonus), 0, 100);
}

function calculateScoreTotals(
  scores: Omit<LongTermScoreBreakdown, "totalScore" | "baseScore" | "bonusScore" | "rawScore">,
  filters: LongTermScanFilters
) {
  const baseScore = calculateBaseScore(scores, filters);
  const bonusScore = calculateBonusScore(scores);
  const rawScore = baseScore + bonusScore;

  return {
    baseScore,
    bonusScore,
    rawScore,
    totalScore: normalizeLongTermScore(baseScore, bonusScore)
  };
}

function isStructurallyBroken(metrics: LongTermMetricSnapshot, filters: LongTermScanFilters) {
  return (
    (metrics.structure.ma120Slope ?? 0) <= -4 &&
    (metrics.structure.ma240Slope ?? 0) <= -1.5 &&
    (metrics.structure.priceVsMA240Pct ?? 0) <= -filters.farBelowMa240Pct &&
    metrics.baseStructure.daysSinceLastLowBreak <= filters.lowBreakPenaltyDays
  );
}

function hasSufficientLongTermHistory(entry: LongTermRankedEntry, filters: LongTermScanFilters) {
  return (entry.chartPoints?.length ?? 0) >= filters.minimumHistorySessions;
}

export function qualifiesLongTermSecondaryRecovery(
  entry: LongTermRankedEntry,
  filters: LongTermScanFilters,
  scores: Omit<LongTermScoreBreakdown, "totalScore" | "baseScore" | "bonusScore" | "rawScore"> & Partial<Pick<LongTermScoreBreakdown, "totalScore">>
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

export function resolveLongTermRequiredCorrectionPct(candidateType: LongTermCandidateType, filters: LongTermScanFilters) {
  switch (candidateType) {
    case "leader":
      return filters.leaderCorrectionMinPct;
    case "quality":
      return filters.qualityCorrectionMinPct;
    case "turnaround":
      return filters.turnaroundCorrectionMinPct;
    case "deep_value":
    default:
      return filters.deepValueCorrectionMinPct;
  }
}

function classifyLongTermCandidateType(
  entry: LongTermRankedEntry,
  scores: Omit<LongTermScoreBreakdown, "totalScore" | "baseScore" | "bonusScore" | "rawScore">
): LongTermCandidateType {
  const snapshot = entry.financialEvaluation.snapshot;
  const curatedLeader =
    entry.seedSource === "curated" &&
    scores.leaderScore >= 82 &&
    scores.financialScore >= 58 &&
    scores.liquidityScore >= 55 &&
    snapshot.earningsState !== "persistent_loss" &&
    snapshot.debtState !== "dangerous";

  if (curatedLeader) {
    return "leader";
  }

  const qualityBusiness =
    scores.financialScore >= 72 &&
    scores.liquidityScore >= 60 &&
    scores.trendScore >= 48 &&
    snapshot.financialMomentum !== "deteriorating" &&
    snapshot.earningsState !== "persistent_loss" &&
    snapshot.debtState !== "dangerous" &&
    snapshot.businessClarity !== "unclear";

  if (qualityBusiness) {
    return "quality";
  }

  const turnaround =
    snapshot.financialMomentum !== "deteriorating" &&
    (snapshot.earningsState !== "profitable" ||
      snapshot.operatingProfitTrend === "improving" ||
      snapshot.netIncomeTrend === "improving") &&
    scores.financialScore >= 45;

  return turnaround ? "turnaround" : "deep_value";
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
  const longTermVolumeProfile = entry.chartPoints?.length
    ? analyzeLongTermVolumeProfile(entry.chartPoints, {
        trendScore,
        financialScore,
        liquidityScore
      })
    : undefined;
  const volumeProfileScore = longTermVolumeProfile?.score ?? 0;
  const higherTimeframeScore = entry.metrics.higherTimeframe?.score ?? 0;

  const partialScores = {
    leaderScore,
    correctionScore,
    trendScore,
    liquidityScore,
    stabilizationScore,
    financialScore,
    volumeProfileScore,
    higherTimeframeScore
  };

  const candidateType = classifyLongTermCandidateType(entry, partialScores);
  const requiredCorrectionPct = resolveLongTermRequiredCorrectionPct(candidateType, filters);
  const scores: LongTermScoreBreakdown = {
    ...calculateScoreTotals(partialScores, filters),
    ...partialScores
  };

  const secondaryRecovery = qualifiesLongTermSecondaryRecovery(entry, filters, scores);
  const classificationOptions = {
    allowBuy: !secondaryRecovery,
    secondaryRecovery,
    isCurated: entry.seedSource === "curated",
    candidateType,
    requiredCorrectionPct
  };
  const baseLabel = classifyLongTermLabel(scores, entry.metrics, entry.financialEvaluation.snapshot);
  const candidateGroup = classifyLongTermCandidateGroup(
    scores,
    entry.metrics,
    baseLabel,
    filters,
    entry.financialEvaluation.snapshot,
    classificationOptions
  );
  const explainability = buildLongTermExplainability(
    scores,
    entry.metrics,
    baseLabel,
    filters,
    entry.financialEvaluation.snapshot,
    classificationOptions
  );
  const stageExplanation = buildLongTermStageExplanation(
    scores,
    entry.metrics,
    baseLabel,
    filters,
    entry.financialEvaluation.snapshot,
    candidateGroup,
    classificationOptions
  );
  const label = explainability.tags.includes("buy_contrarian_accumulation")
    ? "contrarian accumulation candidate"
    : baseLabel;

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
    higherTimeframe: entry.metrics.higherTimeframe,
    liquidity: entry.metrics.liquidity,
    financials: entry.financialEvaluation.snapshot,
    fundamentals: entry.financialEvaluation.snapshot,
    longTermVolumeProfile,
    candidateType,
    candidateGroup,
    label,
    reasonSummary: buildLongTermReasonSummary(
      scores,
      entry.metrics,
      entry.financialEvaluation.snapshot,
      correctionContext
    ),
    stageExplanation,
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

  if (entry.market === "ETF" || entry.market === "ETN") {
    reasons.push("ETF/ETN is out of scope for the long-term leader engine.");
  }

  if (!hasSufficientLongTermHistory(entry, filters)) {
    reasons.push(
      `Trading history is too short for the long-term engine (${entry.chartPoints?.length ?? 0}/${filters.minimumHistorySessions} sessions).`
    );
  }

  const correctionContext = resolveLongTermCorrectionContext(entry.metrics, filters);
  const requiredCorrectionPct = candidate
    ? resolveLongTermRequiredCorrectionPct(candidate.candidateType, filters)
    : filters.minimumDrawdownPct;
  if (Math.abs(correctionContext.drawdownPct ?? 0) < requiredCorrectionPct) {
    reasons.push(`Price has not corrected enough from the prior high (${requiredCorrectionPct}% required for this type).`);
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

  if (candidate && entry.seedSource === "ad_hoc" && candidate.scores.leaderScore < filters.minimumAdHocLeaderScore) {
    reasons.push("Representative status is too weak for the curated long-term framework.");
  }

  return reasons;
}
