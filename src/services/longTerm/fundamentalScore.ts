import type {
  FundamentalsPeriod,
  FundamentalsSummary,
  LongTermBusinessClarity,
  LongTermDebtState,
  LongTermDebtTrend,
  LongTermEarningsState,
  LongTermFinancialMomentum,
  LongTermFinancialSnapshot,
  LongTermFinancialTrend,
  LongTermRoeState,
  LongTermRoeTrend
} from "../../types.js";
import { clamp } from "./utils.js";

export type LongTermFinancialEvaluation = {
  snapshot: LongTermFinancialSnapshot;
  financialScore: number;
  hardExcluded: boolean;
  hardExclusionReasons: string[];
};

type FinancialScoreContext = {
  isLeader: boolean;
  drawdownPct?: number;
  stabilizationScore: number;
  isStabilizing: boolean;
};

const MIN_SIGNIFICANT_CHANGE_RATIO = 0.05;
const LOSS_NARROWING_THRESHOLD = 0.15;
const STRONG_ROE_THRESHOLD = 12;
const NORMAL_ROE_THRESHOLD = 6;
const WEAK_ROE_THRESHOLD = 0;
const SAFE_DEBT_RATIO_THRESHOLD = 100;
const MANAGEABLE_DEBT_RATIO_THRESHOLD = 200;
const HIGH_DEBT_RATIO_THRESHOLD = 350;
const WEAKNESS_RELIEF_DRAWNDOWN_PCT = 35;
const DEEP_WEAKNESS_RELIEF_DRAWNDOWN_PCT = 45;
const STABILIZATION_RELIEF_SCORE = 55;
const DEEP_STABILIZATION_RELIEF_SCORE = 60;

function getLatestActualPeriod(periods?: FundamentalsPeriod[], fallback?: FundamentalsPeriod) {
  if (Array.isArray(periods) && periods.length > 0) {
    return periods.at(-1);
  }

  return fallback;
}

function getPreviousActualPeriod(periods?: FundamentalsPeriod[]) {
  if (!Array.isArray(periods) || periods.length < 2) {
    return undefined;
  }

  return periods.at(-2);
}

function getChangeRatio(latest?: number, previous?: number) {
  if (latest == null || previous == null) {
    return undefined;
  }

  if (previous === 0) {
    if (latest === 0) {
      return 0;
    }

    return latest > 0 ? 1 : -1;
  }

  return (latest - previous) / Math.abs(previous);
}

function isSignificantlyImproving(latest?: number, previous?: number) {
  const changeRatio = getChangeRatio(latest, previous);
  return changeRatio != null && changeRatio >= MIN_SIGNIFICANT_CHANGE_RATIO;
}

function isSignificantlyWeakening(latest?: number, previous?: number) {
  const changeRatio = getChangeRatio(latest, previous);
  return changeRatio != null && changeRatio <= -MIN_SIGNIFICANT_CHANGE_RATIO;
}

function classifyTopLineTrend(latest?: number, previous?: number, quarterlyLatest?: number, quarterlyPrevious?: number): LongTermFinancialTrend {
  if (isSignificantlyImproving(latest, previous) || isSignificantlyImproving(quarterlyLatest, quarterlyPrevious)) {
    return "improving";
  }

  if (isSignificantlyWeakening(latest, previous)) {
    if (!isSignificantlyWeakening(quarterlyLatest, quarterlyPrevious)) {
      return "cyclical_downturn";
    }

    return "weakening";
  }

  return "cyclical_downturn";
}

function classifyProfitTrend(latest?: number, previous?: number, quarterlyLatest?: number, quarterlyPrevious?: number): LongTermFinancialTrend {
  if ((latest ?? 0) > 0 && (previous ?? 0) > 0) {
    if (isSignificantlyImproving(latest, previous) || isSignificantlyImproving(quarterlyLatest, quarterlyPrevious)) {
      return "improving";
    }
    if (isSignificantlyWeakening(latest, previous) && isSignificantlyWeakening(quarterlyLatest, quarterlyPrevious)) {
      return "weakening";
    }
    if (isSignificantlyWeakening(latest, previous)) {
      return "cyclical_downturn";
    }
    return "cyclical_downturn";
  }

  if ((latest ?? 0) <= 0 && (previous ?? 0) <= 0) {
    if (quarterlyLatest != null && quarterlyPrevious != null && quarterlyLatest > quarterlyPrevious) {
      return "cyclical_downturn";
    }
    return "weakening";
  }

  if ((latest ?? 0) > 0 && (previous ?? 0) <= 0) {
    return "improving";
  }

  if ((latest ?? 0) <= 0 && (previous ?? 0) > 0) {
    return quarterlyLatest != null && quarterlyPrevious != null && quarterlyLatest > quarterlyPrevious
      ? "cyclical_downturn"
      : "weakening";
  }

  return "cyclical_downturn";
}

function countLossPeriods(periods: FundamentalsPeriod[] | undefined, key: "operatingIncome" | "netIncome") {
  if (!Array.isArray(periods) || periods.length === 0) {
    return 0;
  }

  return periods.reduce((count, period) => count + ((period[key] ?? 0) < 0 ? 1 : 0), 0);
}

function classifyEarningsState(
  annualLatest?: FundamentalsPeriod,
  annualPrevious?: FundamentalsPeriod,
  quarterlyPeriods?: FundamentalsPeriod[]
): LongTermEarningsState {
  const currentAnnualLoss = (annualLatest?.operatingIncome ?? 0) < 0 || (annualLatest?.netIncome ?? 0) < 0;
  const previousAnnualLoss = (annualPrevious?.operatingIncome ?? 0) < 0 || (annualPrevious?.netIncome ?? 0) < 0;
  const recentQuarterlyLosses = countLossPeriods(quarterlyPeriods?.slice(-4), "operatingIncome");
  const recentQuarterlyNetLosses = countLossPeriods(quarterlyPeriods?.slice(-4), "netIncome");

  if (!currentAnnualLoss && recentQuarterlyLosses <= 1 && recentQuarterlyNetLosses <= 1) {
    return "profitable";
  }

  if ((currentAnnualLoss && previousAnnualLoss) || recentQuarterlyLosses >= 3 || recentQuarterlyNetLosses >= 3) {
    return "persistent_loss";
  }

  return "temporary_loss";
}

function classifyRoeState(latestRoe?: number): LongTermRoeState {
  if (latestRoe == null) {
    return "normal";
  }
  if (latestRoe >= STRONG_ROE_THRESHOLD) {
    return "strong";
  }
  if (latestRoe >= NORMAL_ROE_THRESHOLD) {
    return "normal";
  }
  if (latestRoe >= WEAK_ROE_THRESHOLD) {
    return "weak";
  }
  return "negative";
}

function classifyRoeTrend(latestRoe?: number, previousRoe?: number): LongTermRoeTrend {
  const changeRatio = getChangeRatio(latestRoe, previousRoe);
  if (changeRatio == null) {
    return "stable";
  }
  if (changeRatio >= 0.1) {
    return "improving";
  }
  if (changeRatio <= -0.1) {
    return "deteriorating";
  }
  return "stable";
}

function classifyDebtState(latestDebtRatio?: number): LongTermDebtState {
  if (latestDebtRatio == null) {
    return "manageable";
  }
  if (latestDebtRatio <= SAFE_DEBT_RATIO_THRESHOLD) {
    return "safe";
  }
  if (latestDebtRatio <= MANAGEABLE_DEBT_RATIO_THRESHOLD) {
    return "manageable";
  }
  if (latestDebtRatio <= HIGH_DEBT_RATIO_THRESHOLD) {
    return "high";
  }
  return "dangerous";
}

function classifyDebtTrend(latestDebtRatio?: number, previousDebtRatio?: number): LongTermDebtTrend {
  const changeRatio = getChangeRatio(latestDebtRatio, previousDebtRatio);
  if (changeRatio == null) {
    return "stable";
  }
  if (changeRatio <= -0.08) {
    return "improving";
  }
  if (changeRatio >= 0.08) {
    return "worsening";
  }
  return "stable";
}

function classifyBusinessClarity(fundamentals?: FundamentalsSummary, isLeader = false): LongTermBusinessClarity {
  const summaryLength = fundamentals?.businessSummary?.trim().length ?? 0;
  const areaCount = fundamentals?.businessAreas?.length ?? 0;

  if (summaryLength >= 50 || areaCount >= 2) {
    return "clear_core_business";
  }

  if (summaryLength >= 20 || areaCount >= 1 || isLeader) {
    return "diversified";
  }

  return "unclear";
}

function isLossNarrowing(latest?: number, previous?: number) {
  if (latest == null || previous == null) {
    return false;
  }

  if (latest >= 0 || previous >= 0) {
    return false;
  }

  return Math.abs(latest) <= Math.abs(previous) * (1 - LOSS_NARROWING_THRESHOLD);
}

function classifyFinancialMomentum(params: {
  earningsState: LongTermEarningsState;
  revenueTrend: LongTermFinancialTrend;
  operatingProfitTrend: LongTermFinancialTrend;
  netIncomeTrend: LongTermFinancialTrend;
  quarterlyLatest?: FundamentalsPeriod;
  quarterlyPrevious?: FundamentalsPeriod;
  debtTrend: LongTermDebtTrend;
}): LongTermFinancialMomentum {
  const opLossNarrowing = isLossNarrowing(
    params.quarterlyLatest?.operatingIncome,
    params.quarterlyPrevious?.operatingIncome
  );
  const netLossNarrowing = isLossNarrowing(params.quarterlyLatest?.netIncome, params.quarterlyPrevious?.netIncome);

  if (
    params.earningsState === "profitable" &&
    (params.operatingProfitTrend === "improving" ||
      params.netIncomeTrend === "improving" ||
      params.revenueTrend === "improving")
  ) {
    return "improving";
  }

  if (
    params.earningsState !== "persistent_loss" &&
    params.debtTrend !== "worsening" &&
    (opLossNarrowing ||
      netLossNarrowing ||
      params.operatingProfitTrend === "cyclical_downturn" ||
      params.netIncomeTrend === "cyclical_downturn")
  ) {
    return "stabilizing";
  }

  return "deteriorating";
}

function buildStructuralRiskFlags(params: {
  earningsState: LongTermEarningsState;
  revenueTrend: LongTermFinancialTrend;
  operatingProfitTrend: LongTermFinancialTrend;
  netIncomeTrend: LongTermFinancialTrend;
  roeState: LongTermRoeState;
  debtState: LongTermDebtState;
  debtTrend: LongTermDebtTrend;
  businessClarity: LongTermBusinessClarity;
  annualLatest?: FundamentalsPeriod;
  annualPrevious?: FundamentalsPeriod;
  annualTwoBack?: FundamentalsPeriod;
  financialMomentum: LongTermFinancialMomentum;
  hasData: boolean;
}) {
  const flags: string[] = [];

  if (!params.hasData) {
    flags.push("limited_financial_data");
  }
  if (params.earningsState === "persistent_loss") {
    flags.push("persistent_losses");
  }
  if (params.roeState === "negative") {
    flags.push("negative_roe");
  }
  if (params.debtState === "dangerous") {
    flags.push("dangerous_debt");
  }
  if (params.debtTrend === "worsening") {
    flags.push("worsening_debt");
  }
  if (params.businessClarity === "unclear") {
    flags.push("unclear_business_model");
  }
  if (
    (params.annualLatest?.revenue ?? Number.NaN) < (params.annualPrevious?.revenue ?? Number.NaN) &&
    (params.annualPrevious?.revenue ?? Number.NaN) < (params.annualTwoBack?.revenue ?? Number.NaN)
  ) {
    flags.push("multi_year_revenue_decline");
  }
  if (
    params.revenueTrend === "weakening" &&
    params.operatingProfitTrend === "weakening" &&
    params.netIncomeTrend === "weakening"
  ) {
    flags.push("structural_business_breakdown");
  }
  if (params.financialMomentum === "deteriorating" && params.earningsState !== "profitable") {
    flags.push("deteriorating_financial_momentum");
  }

  return flags;
}

function buildFallbackSnapshot(isLeader: boolean): LongTermFinancialSnapshot {
  return {
    revenueTrend: "cyclical_downturn",
    operatingProfitTrend: "cyclical_downturn",
    netIncomeTrend: "cyclical_downturn",
    earningsState: "profitable",
    roeState: "normal",
    roeTrend: "stable",
    debtState: "manageable",
    debtTrend: "stable",
    businessClarity: isLeader ? "clear_core_business" : "diversified",
    financialMomentum: "stabilizing",
    structuralRiskFlags: ["limited_financial_data"]
  };
}

function resolveWeaknessPenaltyMultiplier(
  snapshot: LongTermFinancialSnapshot,
  context: FinancialScoreContext
) {
  const absoluteDrawdown = Math.abs(context.drawdownPct ?? 0);
  const stabilizationReady = context.isStabilizing || context.stabilizationScore >= STABILIZATION_RELIEF_SCORE;
  const deepStabilizationReady =
    context.isStabilizing || context.stabilizationScore >= DEEP_STABILIZATION_RELIEF_SCORE;

  if (
    absoluteDrawdown >= DEEP_WEAKNESS_RELIEF_DRAWNDOWN_PCT &&
    deepStabilizationReady &&
    snapshot.financialMomentum !== "deteriorating"
  ) {
    return 0.5;
  }

  if (
    context.isLeader &&
    absoluteDrawdown >= WEAKNESS_RELIEF_DRAWNDOWN_PCT &&
    stabilizationReady &&
    snapshot.financialMomentum !== "deteriorating"
  ) {
    return 0.6;
  }

  return 1;
}

function calculateBaseScore(isLeader: boolean) {
  return isLeader ? 64 : 56;
}

function calculateImprovementBonus(snapshot: LongTermFinancialSnapshot) {
  let bonus = 0;

  if (snapshot.revenueTrend === "improving") {
    bonus += 8;
  }
  if (snapshot.operatingProfitTrend === "improving") {
    bonus += 14;
  }
  if (snapshot.netIncomeTrend === "improving") {
    bonus += 8;
  }
  if (snapshot.earningsState === "profitable") {
    bonus += 12;
  }
  if (snapshot.roeState === "strong") {
    bonus += 10;
  } else if (snapshot.roeState === "normal") {
    bonus += 5;
  }
  if (snapshot.roeTrend === "improving") {
    bonus += 4;
  }
  if (snapshot.debtState === "safe") {
    bonus += 8;
  } else if (snapshot.debtState === "manageable") {
    bonus += 4;
  }
  if (snapshot.debtTrend === "improving") {
    bonus += 4;
  }
  if (snapshot.businessClarity === "clear_core_business") {
    bonus += 8;
  } else if (snapshot.businessClarity === "diversified") {
    bonus += 3;
  }
  if (snapshot.financialMomentum === "improving") {
    bonus += 10;
  } else if (snapshot.financialMomentum === "stabilizing") {
    bonus += 5;
  }

  return bonus;
}

function calculateWeaknessPenalty(snapshot: LongTermFinancialSnapshot) {
  let penalty = 0;

  if (snapshot.revenueTrend === "weakening") {
    penalty += 8;
  }
  if (snapshot.operatingProfitTrend === "weakening") {
    penalty += 14;
  }
  if (snapshot.netIncomeTrend === "weakening") {
    penalty += 10;
  }
  if (snapshot.earningsState === "temporary_loss") {
    penalty += 10;
  } else if (snapshot.earningsState === "persistent_loss") {
    penalty += 20;
  }
  if (snapshot.roeState === "weak") {
    penalty += 6;
  } else if (snapshot.roeState === "negative") {
    penalty += 14;
  }
  if (snapshot.roeTrend === "deteriorating") {
    penalty += 6;
  }
  if (snapshot.debtState === "high") {
    penalty += 8;
  } else if (snapshot.debtState === "dangerous") {
    penalty += 16;
  }
  if (snapshot.debtTrend === "worsening") {
    penalty += 6;
  }
  if (snapshot.businessClarity === "unclear") {
    penalty += 8;
  }
  if (snapshot.financialMomentum === "deteriorating") {
    penalty += 10;
  }

  if (snapshot.structuralRiskFlags.includes("limited_financial_data")) {
    penalty += 6;
  }
  if (snapshot.structuralRiskFlags.includes("multi_year_revenue_decline")) {
    penalty += 6;
  }

  return penalty;
}

export function evaluateLongTermFinancials(
  fundamentals: FundamentalsSummary | undefined,
  context: FinancialScoreContext
): LongTermFinancialEvaluation {
  const annualLatest = getLatestActualPeriod(fundamentals?.annualHistory, fundamentals?.annual);
  const annualPrevious = getPreviousActualPeriod(fundamentals?.annualHistory);
  const annualTwoBack =
    Array.isArray(fundamentals?.annualHistory) && fundamentals.annualHistory.length >= 3
      ? fundamentals.annualHistory.at(-3)
      : undefined;
  const quarterlyLatest = getLatestActualPeriod(fundamentals?.quarterlyHistory, fundamentals?.quarterly);
  const quarterlyPrevious = getPreviousActualPeriod(fundamentals?.quarterlyHistory);
  const hasData = Boolean(annualLatest || quarterlyLatest || fundamentals?.businessSummary || fundamentals?.businessAreas?.length);

  const snapshot =
    hasData
      ? ({
          revenueTrend: classifyTopLineTrend(
            annualLatest?.revenue,
            annualPrevious?.revenue,
            quarterlyLatest?.revenue,
            quarterlyPrevious?.revenue
          ),
          operatingProfitTrend: classifyProfitTrend(
            annualLatest?.operatingIncome,
            annualPrevious?.operatingIncome,
            quarterlyLatest?.operatingIncome,
            quarterlyPrevious?.operatingIncome
          ),
          netIncomeTrend: classifyProfitTrend(
            annualLatest?.netIncome,
            annualPrevious?.netIncome,
            quarterlyLatest?.netIncome,
            quarterlyPrevious?.netIncome
          ),
          earningsState: classifyEarningsState(annualLatest, annualPrevious, fundamentals?.quarterlyHistory),
          roeState: classifyRoeState(annualLatest?.roe),
          roeTrend: classifyRoeTrend(annualLatest?.roe, annualPrevious?.roe),
          debtState: classifyDebtState(annualLatest?.debtRatio),
          debtTrend: classifyDebtTrend(annualLatest?.debtRatio, annualPrevious?.debtRatio),
          businessClarity: classifyBusinessClarity(fundamentals, context.isLeader),
          financialMomentum: "stabilizing",
          structuralRiskFlags: [],
          latestRoe: annualLatest?.roe,
          latestDebtRatio: annualLatest?.debtRatio,
          latestPer: annualLatest?.per,
          latestPbr: annualLatest?.pbr
        } satisfies LongTermFinancialSnapshot)
      : buildFallbackSnapshot(context.isLeader);

  snapshot.financialMomentum = classifyFinancialMomentum({
    earningsState: snapshot.earningsState,
    revenueTrend: snapshot.revenueTrend,
    operatingProfitTrend: snapshot.operatingProfitTrend,
    netIncomeTrend: snapshot.netIncomeTrend,
    quarterlyLatest,
    quarterlyPrevious,
    debtTrend: snapshot.debtTrend
  });

  snapshot.structuralRiskFlags = buildStructuralRiskFlags({
    earningsState: snapshot.earningsState,
    revenueTrend: snapshot.revenueTrend,
    operatingProfitTrend: snapshot.operatingProfitTrend,
    netIncomeTrend: snapshot.netIncomeTrend,
    roeState: snapshot.roeState,
    debtState: snapshot.debtState,
    debtTrend: snapshot.debtTrend,
    businessClarity: snapshot.businessClarity,
    annualLatest,
    annualPrevious,
    annualTwoBack,
    financialMomentum: snapshot.financialMomentum,
    hasData
  });

  const hardExclusionReasons: string[] = [];
  if (snapshot.earningsState === "persistent_loss" && snapshot.financialMomentum === "deteriorating") {
    hardExclusionReasons.push("persistent losses with worsening momentum");
  }
  if (snapshot.structuralRiskFlags.includes("dangerous_debt") && snapshot.financialMomentum === "deteriorating") {
    hardExclusionReasons.push("dangerous debt structure");
  }
  if (snapshot.structuralRiskFlags.includes("structural_business_breakdown")) {
    hardExclusionReasons.push("business deterioration looks structural");
  }

  const improvementBonus = calculateImprovementBonus(snapshot);
  const rawWeaknessPenalty = calculateWeaknessPenalty(snapshot);
  // Price drawdown already reflects a lot of the damage, so weaken the financial penalty
  // when a leader has corrected deeply and the base is starting to stabilize.
  const weaknessPenalty = rawWeaknessPenalty * resolveWeaknessPenaltyMultiplier(snapshot, context);
  const financialScore = clamp(Math.round(calculateBaseScore(context.isLeader) + improvementBonus - weaknessPenalty), 0, 100);

  return {
    snapshot,
    financialScore,
    hardExcluded: hardExclusionReasons.length > 0,
    hardExclusionReasons
  };
}
