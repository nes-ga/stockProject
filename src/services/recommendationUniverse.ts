import { scanDividendUniverse } from "./dividendEngine.js";
import { scanLongTermUniverse } from "./longTermEngine.js";
import {
  updateLongTermRecommendationHistoryFromScan,
  type LongTermRecommendationHistoryUpdateResult
} from "./longTermRecommendationHistory.js";
import { writeServerDividendPicks } from "./serverDividendPicks.js";
import {
  withServerLongTermPicksMutation,
  type ServerLongTermPick
} from "./serverLongTermPicks.js";
import { readServerSwingPickPayload, writeServerSwingPicks, type ServerSwingPick } from "./serverSwingPicks.js";
import { analyzeSmartMoneyPattern } from "./stockAnalysis.js";
import { getStockUniverse } from "./stockUniverse.js";
import { getSwingProfileFilterOverrides, resolveSwingEngineProfile, type SwingEngineProfile } from "./swingProfiles.js";
import { getTradingHaltLookup } from "./tradingHalts.js";
import {
  buildSwingHistoryWinRateGuardModel,
  evaluateSwingHistoryWinRateGuard,
  readSwingCarryForwardCases,
  updateSwingRecommendationHistoryFromCurrentPicks,
  type SwingCarryForwardCase,
  type SwingHistoryWinRateGuardEvaluation,
  type SwingHistoryWinRateGuardModel
} from "./recommendationHistory.js";

const SWING_TARGET_MARKETS = new Set(["KOSPI", "KOSDAQ"]);
const SWING_CHUNK_SIZE = 8;
const SWING_MIN_REFERENCE_PRICE = 1000;

type RecommendationUniverseCategory = "longTerm" | "dividend" | "swing";
type RecommendationUniverseScanScope = RecommendationUniverseCategory | `swing:${SwingEngineProfile}`;
type UniverseItem = Awaited<ReturnType<typeof getStockUniverse>>["items"][number];
type SmartMoneyAnalysis = Awaited<ReturnType<typeof analyzeSmartMoneyPattern>>;
type DividendScanResult = Awaited<ReturnType<typeof scanDividendUniverse>>;
type DividendUniverseCandidate = DividendScanResult["candidates"][number];
type LongTermScanResult = Awaited<ReturnType<typeof scanLongTermUniverse>>;
type LongTermUniverseCandidate = LongTermScanResult["candidates"][number];
type SwingHistoryUpdate = Awaited<ReturnType<typeof updateSwingRecommendationHistoryFromCurrentPicks>>;

type SwingScanRankedItem = {
  item: UniverseItem;
  analysis: SmartMoneyAnalysis;
};

type RecommendationUniverseScanResult =
  | {
      category: "longTerm";
      count: number;
      buyCount: number;
      accumulateCount: number;
      watchCount: number;
      asOfDate: string;
      universeSize: number;
      items: ServerLongTermPick[];
      historyUpdated: boolean;
      historyUpdate?: LongTermRecommendationHistoryUpdateResult;
      historyUpdateError?: string;
    }
  | {
      category: "dividend";
      count: number;
      buyCount: number;
      watchCount: number;
      asOfDate: string;
      universeSize: number;
      items: Awaited<ReturnType<typeof writeServerDividendPicks>>;
    }
  | {
      category: "swing";
      count: number;
      executionCount: number;
      watchCount: number;
      universeSize: number;
      failureCount: number;
      items: Awaited<ReturnType<typeof writeServerSwingPicks>>["items"];
      executionItems: Awaited<ReturnType<typeof writeServerSwingPicks>>["executionItems"];
      watchItems: Awaited<ReturnType<typeof writeServerSwingPicks>>["watchItems"];
      historyUpdated: boolean;
      historyUpdate?: SwingHistoryUpdate;
      historyUpdateError?: string;
    };

const activeScanByCategory = new Map<RecommendationUniverseScanScope, Promise<RecommendationUniverseScanResult>>();

type LongTermCommitSafetyScan = Pick<
  LongTermScanResult,
  "asOfDate" | "scanCompleteness" | "attemptedCount" | "succeededCount" | "failedCount"
>;

export function assertLongTermUniverseCommitSafety(
  result: LongTermCommitSafetyScan,
  previousItems: ServerLongTermPick[] = []
) {
  if (
    result.attemptedCount <= 0 ||
    result.scanCompleteness !== "complete" ||
    result.failedCount !== 0 ||
    result.succeededCount !== result.attemptedCount
  ) {
    throw new Error(
      `Long-term universe scan is incomplete; refusing to publish current/history ` +
        `(attempted=${result.attemptedCount}, succeeded=${result.succeededCount}, failed=${result.failedCount}).`
    );
  }

  const latestPreviousDate = previousItems.reduce<string | null>((latest, item) => {
    const candidateDate = item.latestMentionDate ?? item.anchorDate;
    return latest == null || candidateDate > latest ? candidateDate : latest;
  }, null);

  if (latestPreviousDate != null && result.asOfDate < latestPreviousDate) {
    throw new Error(
      `Long-term universe scan asOfDate ${result.asOfDate} is older than current recommendations ${latestPreviousDate}.`
    );
  }
}

function formatLongTermNoteLabel(label: LongTermUniverseCandidate["label"]) {
  switch (label) {
    case "leader correction watch":
      return "대표주 조정 관찰";
    case "deep value review":
      return "깊은 조정 재검토";
    case "base-forming candidate":
      return "베이스 형성 후보";
    case "contrarian accumulation candidate":
      return "하락 누적 분할 후보";
    case "needs more stabilization":
      return "안정화 더 필요";
    default:
      return label;
  }
}

function formatDividendNoteLabel(label: DividendUniverseCandidate["label"]) {
  switch (label) {
    case "dividend_income_core":
      return "배당 코어";
    case "dividend_growth_candidate":
      return "배당 성장형";
    case "dividend_stable_payer":
      return "안정 배당";
    case "dividend_watch_payout_risk":
      return "배당성향 점검";
    case "dividend_watch_growth_slowing":
      return "배당 성장 둔화";
    case "dividend_watch_financial_repair":
      return "재무 보수 점검";
    case "dividend_trap_risk":
      return "배당 함정 주의";
    case "dividend_irregular_history":
      return "배당 이력 불규칙";
    default:
      return label;
  }
}

function pushLongTermHighlight(highlights: string[], label: string | undefined, max = 4) {
  if (!label || highlights.includes(label) || highlights.length >= max) {
    return;
  }

  highlights.push(label);
}

function buildLongTermHighlights(candidate: LongTermUniverseCandidate) {
  const highlights: string[] = [];

  if (candidate.drawdownPct != null) {
    pushLongTermHighlight(highlights, `${Math.round(Math.abs(candidate.drawdownPct))}% 조정`);
  }

  if (
    candidate.financials?.financialMomentum === "improving" ||
    candidate.financials?.operatingProfitTrend === "improving" ||
    candidate.financials?.netIncomeTrend === "improving"
  ) {
    pushLongTermHighlight(highlights, "재무 우수");
  } else if (candidate.financials?.financialMomentum === "deteriorating") {
    pushLongTermHighlight(highlights, "재무 확인 필요");
  }

  if (candidate.baseStructure.isStabilizing) {
    pushLongTermHighlight(highlights, "바닥 안정");
  } else if (candidate.baseStructure.higherLowCount >= 2) {
    pushLongTermHighlight(highlights, "바닥 확인 중");
  } else {
    pushLongTermHighlight(highlights, "바닥 대기");
  }

  if ((candidate.structure.ma120Slope ?? 0) >= 1) {
    pushLongTermHighlight(highlights, "장기 추세 양호");
  } else if ((candidate.structure.ma120Slope ?? 0) >= -0.5) {
    pushLongTermHighlight(highlights, "장기 추세 보통");
  } else {
    pushLongTermHighlight(highlights, "추세 회복 대기");
  }

  return highlights.slice(0, 3);
}

function buildLongTermNote(candidate: LongTermUniverseCandidate) {
  const stageLabel =
    candidate.candidateGroup === "buy candidate"
      ? "본격매수"
      : candidate.candidateGroup === "accumulate candidate"
        ? "분할매수"
        : "관찰";
  const summary =
    candidate.candidateGroup === "buy candidate"
      ? "조건 충족"
      : candidate.candidateGroup === "accumulate candidate"
        ? "할인 충분 + 확인 필요"
        : "대기";

  return [stageLabel, summary, ...buildLongTermHighlights(candidate)].join(" | ");
}

function resolveLongTermBucket(candidate: LongTermUniverseCandidate): "buy" | "accumulate" | "watch" {
  if (candidate.candidateGroup === "buy candidate") {
    return "buy";
  }

  if (candidate.candidateGroup === "accumulate candidate") {
    return "accumulate";
  }

  return "watch";
}

function buildDividendNote(candidate: DividendUniverseCandidate) {
  const groupLabel = candidate.candidateGroup === "buy candidate" ? "배당 후보군" : "배당 관찰군";
  const highlights: string[] = [];
  pushLongTermHighlight(highlights, `총점 ${candidate.scores.totalScore}점`);
  if (candidate.dividendMetrics.latestDividendYield != null) {
    pushLongTermHighlight(highlights, `배당수익률 ${candidate.dividendMetrics.latestDividendYield.toFixed(1)}%`);
  }
  if (candidate.dividendMetrics.consecutiveDividendYears > 0) {
    pushLongTermHighlight(highlights, `연속배당 ${candidate.dividendMetrics.consecutiveDividendYears}년`);
  }
  if (candidate.dividendMetrics.payoutRatio != null) {
    pushLongTermHighlight(highlights, `배당성향 ${Math.round(candidate.dividendMetrics.payoutRatio)}%`);
  }
  if (candidate.tags.includes("dividend_trap_risk")) {
    pushLongTermHighlight(highlights, "배당 함정 주의");
  } else if (candidate.scores.dividendSafetyScore >= 70) {
    pushLongTermHighlight(highlights, "배당 안전성 양호");
  }

  return [groupLabel, formatDividendNoteLabel(candidate.label), ...highlights].join(" | ");
}

function buildSwingNote(
  pattern: SmartMoneyAnalysis["pattern"],
  classification?: Pick<SwingCandidateClassification, "bucket">
) {
  const isExecutionCandidate = classification != null && classification.bucket !== "watch";
  const stageLabel =
    pattern.status === "breakout_extended"
      ? "추격 금지"
      : pattern.stage === "breakout"
        ? "돌파 대기"
        : pattern.status === "buy_ready"
          ? "1차 매수 가능"
          : isExecutionCandidate
            ? "분할매수 준비"
            : "관찰";
  const resolvedStopPrice = pattern.buyPlan?.stopLossPrice ?? pattern.invalidationPrice;
  const derivedFirstBuyPrice =
    pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? Math.max(pattern.entryZoneLow, pattern.entryZoneHigh) : undefined;
  const derivedRiskBand =
    derivedFirstBuyPrice != null && resolvedStopPrice != null && resolvedStopPrice > 0 && derivedFirstBuyPrice > resolvedStopPrice
      ? derivedFirstBuyPrice - resolvedStopPrice
      : undefined;
  const buyPlanText = pattern.buyPlan
    ? `매수 ${Math.round(pattern.buyPlan.firstBuyPrice)}/${Math.round(pattern.buyPlan.secondBuyPrice)}/${Math.round(pattern.buyPlan.thirdBuyPrice)}`
    : derivedFirstBuyPrice != null && resolvedStopPrice != null && derivedRiskBand != null
      ? `매수 ${Math.round(derivedFirstBuyPrice)}/${Math.round(resolvedStopPrice + derivedRiskBand * 0.67)}/${Math.round(resolvedStopPrice + derivedRiskBand * 0.33)}`
      : `매수 ${pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneLow)}~${Math.round(pattern.entryZoneHigh)}` : "-"}`;
  const displayEntryZoneText =
    pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneHigh)}~${Math.round(pattern.entryZoneLow)}` : "-";
  const resolvedDisplayBuyPlanText = pattern.buyPlan
    ? buyPlanText
    : `${pattern.stage === "breakout" ? "관찰" : "구간"} ${displayEntryZoneText}`;
  const stopText = `손절 ${resolvedStopPrice != null && resolvedStopPrice > 0 ? Math.round(resolvedStopPrice) : "-"}`;
  const finalDisplayBuyPlanText = isExecutionCandidate ? buyPlanText : resolvedDisplayBuyPlanText;
  const actionText =
    pattern.status === "breakout_extended"
      ? "신규 추격매수 금지"
      : pattern.stage === "breakout"
        ? "돌파 안착 확인"
        : pattern.status === "buy_ready"
          ? "1차 진입 검토"
          : "눌림 확인 대기";

  return [
    stageLabel,
    actionText,
    finalDisplayBuyPlanText,
    stopText
  ].filter(Boolean).join(" | ");
}

type SwingCandidateClassification = {
  bucket: "execution_ready" | "execution_probe" | "watch";
  reasons: string[];
  tags: SmartMoneyAnalysis["pattern"]["tags"];
  penaltyFactors: SmartMoneyAnalysis["pattern"]["penaltyFactors"];
};

function toServerSwingPick(item: UniverseItem, analysis: SmartMoneyAnalysis, classification: SwingCandidateClassification): ServerSwingPick {
  return {
    key: `${item.name}-${item.code}`,
    name: item.name,
    symbol: item.code,
    anchorDate: analysis.tradingReferenceDate,
    latestMentionDate: analysis.tradingReferenceDate,
    note: buildSwingNote(analysis.pattern, classification),
    bucket: classification.bucket,
    tags: classification.tags,
    reasons: classification.reasons,
    penaltyFactors: classification.penaltyFactors,
    buyPlan: analysis.pattern.buyPlan,
    postEntryOutcome: analysis.pattern.postEntryOutcome,
    envelope: analysis.pattern.envelope,
    haltCategory: analysis.haltCategory,
    haltAction: analysis.haltAction,
    category: "swing" as const,
    source: "server-universe" as const
  };
}

function preserveSwingPickDates(
  nextPick: ReturnType<typeof toServerSwingPick>,
  existingPick: Awaited<ReturnType<typeof readServerSwingPickPayload>>["items"][number] | undefined
) {
  return {
    ...nextPick,
    anchorDate: existingPick?.anchorDate ?? nextPick.anchorDate,
    latestMentionDate: nextPick.latestMentionDate
  };
}

function formatHistoryBuyPlanText(buyPlan: SwingCarryForwardCase["buyPlan"]) {
  if (!buyPlan?.firstBuyPrice || !buyPlan.secondBuyPrice || !buyPlan.thirdBuyPrice) {
    return undefined;
  }

  return `매수 ${Math.round(buyPlan.firstBuyPrice)}/${Math.round(buyPlan.secondBuyPrice)}/${Math.round(buyPlan.thirdBuyPrice)}`;
}

function replaceSwingNoteBuyPlan(note: string | undefined, buyPlan: SwingCarryForwardCase["buyPlan"]) {
  const buyPlanText = formatHistoryBuyPlanText(buyPlan);
  if (!note || !buyPlanText) {
    return note;
  }

  if (/매수\s+[\d,]+\/[\d,]+\/[\d,]+/.test(note)) {
    return note.replace(/매수\s+[\d,]+\/[\d,]+\/[\d,]+/, buyPlanText);
  }

  if (/구간\s+[\d,]+~[\d,]+/.test(note)) {
    return note.replace(/구간\s+[\d,]+~[\d,]+/, buyPlanText);
  }

  return `${note} | ${buyPlanText}`;
}

function calculateSwingReturnPct(price: number | undefined, basis: number | undefined) {
  if (typeof price !== "number" || !Number.isFinite(price) || typeof basis !== "number" || !Number.isFinite(basis) || basis === 0) {
    return undefined;
  }

  return Math.round(((price - basis) / basis) * 10000) / 100;
}

function preserveEnteredHistoryPlan(
  nextPick: ReturnType<typeof toServerSwingPick>,
  historyCase: SwingCarryForwardCase | undefined
) {
  if (!historyCase?.buyPlan || historyCase.executedBuyCount <= 0) {
    return nextPick;
  }

  const latestDate = nextPick.postEntryOutcome?.latestDate ?? historyCase.dataDate ?? nextPick.latestMentionDate ?? nextPick.anchorDate;
  const executedBuys = (historyCase.executedBuys ?? [])
    .filter(
      (buy): buy is { stage: 1 | 2 | 3; price: number; date?: string } =>
        (buy.stage === 1 || buy.stage === 2 || buy.stage === 3) &&
        typeof buy.price === "number" &&
        Number.isFinite(buy.price)
    )
    .map((buy) => ({
      stage: buy.stage,
      price: buy.price,
      date: buy.date ?? latestDate
    }));
  const latestClose = nextPick.postEntryOutcome?.latestClose ?? historyCase.latestClose;
  const averageBuyPrice = historyCase.averageBuyPrice;

  return {
    ...nextPick,
    anchorDate: historyCase.initialSnapshot?.anchorDate ?? historyCase.openedDate ?? nextPick.anchorDate,
    note: replaceSwingNoteBuyPlan(historyCase.initialSnapshot?.note ?? nextPick.note, historyCase.buyPlan) ?? nextPick.note,
    buyPlan: historyCase.buyPlan,
    postEntryOutcome: {
      ...(nextPick.postEntryOutcome ?? {}),
      status: "active" as const,
      executedBuyCount: historyCase.executedBuyCount,
      executedBuys,
      averageBuyPrice,
      latestClose,
      latestDate,
      unrealizedReturnPct: calculateSwingReturnPct(latestClose, averageBuyPrice)
    },
    initialStopLossPrice: historyCase.initialStopLossPrice
  };
}

// 아직 종료 조건이 없는 체결 히스토리 케이스를 watch 후보로 되살립니다.
// 실행 후보로 승격하는 경로가 아니라, 손절/목표 종료 전까지
// 현재 후보 파일에서 사라지지 않게 하는 생명주기 보호 장치입니다.
function toCarryForwardSwingWatchPick(historyCase: SwingCarryForwardCase, profile: SwingEngineProfile): ServerSwingPick {
  const anchorDate = historyCase.openedDate ?? historyCase.initialSnapshot?.anchorDate ?? historyCase.dataDate ?? "";
  const latestMentionDate = historyCase.dataDate ?? historyCase.initialSnapshot?.latestMentionDate ?? anchorDate;
  const baseNote = historyCase.initialSnapshot?.note ?? "기존 체결 후보";
  const stopText = historyCase.buyPlan?.stopLossPrice ? `손절 ${Math.round(historyCase.buyPlan.stopLossPrice)}` : "손절 기준 유지";
  const executedBuys = (historyCase.executedBuys ?? [])
    .filter((buy): buy is { stage: 1 | 2 | 3; price: number; date?: string } =>
      (buy.stage === 1 || buy.stage === 2 || buy.stage === 3) &&
      typeof buy.price === "number" &&
      Number.isFinite(buy.price)
    )
    .map((buy) => ({
      stage: buy.stage,
      price: buy.price,
      date: buy.date ?? latestMentionDate
    }));

  return {
    key: `${historyCase.name}-${historyCase.symbol}`,
    name: historyCase.name,
    symbol: historyCase.symbol,
    anchorDate,
    latestMentionDate,
    note: `${baseNote} | 기존 체결 유지 | ${stopText}`,
    bucket: "watch",
    tags: [
      ...(historyCase.initialSnapshot?.tags ?? []),
      "tag_carry_forward_until_stop"
    ],
    reasons: [
      ...(historyCase.initialSnapshot?.reasons ?? []),
      "carry_forward_until_stop",
      "above_stop"
    ],
    buyPlan: historyCase.buyPlan,
    postEntryOutcome: {
      status: "active",
      executedBuyCount: historyCase.executedBuyCount,
      executedBuys,
      averageBuyPrice: historyCase.averageBuyPrice,
      latestClose: historyCase.latestClose,
      latestDate: historyCase.dataDate,
      unrealizedReturnPct: historyCase.unrealizedReturnPct
    },
    initialStopLossPrice: historyCase.initialStopLossPrice,
    category: "swing",
    swingProfile: profile,
    source: "history-carry-forward"
  };
}
function compareSwingAnalyses(left: SwingScanRankedItem, right: SwingScanRankedItem) {
  const leftRank = left.analysis.pattern.stage === "breakout" ? 2 : left.analysis.pattern.stage === "setup" ? 1 : 0;
  const rightRank = right.analysis.pattern.stage === "breakout" ? 2 : right.analysis.pattern.stage === "setup" ? 1 : 0;
  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  const leftScore = left.analysis.pattern.finalRankScore ?? left.analysis.pattern.patternScore;
  const rightScore = right.analysis.pattern.finalRankScore ?? right.analysis.pattern.patternScore;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  if (left.analysis.tradingReferenceDate !== right.analysis.tradingReferenceDate) {
    return right.analysis.tradingReferenceDate.localeCompare(left.analysis.tradingReferenceDate);
  }

  return left.item.name.localeCompare(right.item.name, "ko");
}

export function isWithinSwingEntryZone(pattern: SmartMoneyAnalysis["pattern"]) {
  if (
    !pattern.matched ||
    pattern.stage !== "setup" ||
    typeof pattern.referenceClose !== "number" ||
    typeof pattern.entryZoneLow !== "number" ||
    typeof pattern.entryZoneHigh !== "number"
  ) {
    return false;
  }

  const low = Math.min(pattern.entryZoneLow, pattern.entryZoneHigh);
  const high = Math.max(pattern.entryZoneLow, pattern.entryZoneHigh);
  if (pattern.referenceClose < low || pattern.referenceClose > high) {
    return false;
  }

  return typeof pattern.invalidationPrice !== "number" || pattern.referenceClose > pattern.invalidationPrice;
}

function isBelowSwingEntryZone(pattern: SmartMoneyAnalysis["pattern"]) {
  if (
    !pattern.matched ||
    pattern.stage !== "setup" ||
    typeof pattern.referenceClose !== "number" ||
    typeof pattern.entryZoneLow !== "number" ||
    typeof pattern.entryZoneHigh !== "number"
  ) {
    return false;
  }

  const low = Math.min(pattern.entryZoneLow, pattern.entryZoneHigh);
  return pattern.referenceClose < low;
}

function isPennyStockRisk(pattern: SmartMoneyAnalysis["pattern"]) {
  return typeof pattern.referenceClose === "number" && pattern.referenceClose <= SWING_MIN_REFERENCE_PRICE;
}

function isInOrBelowRawSwingEntryZone(pattern: SmartMoneyAnalysis["pattern"]) {
  if (
    pattern.stage !== "setup" ||
    typeof pattern.referenceClose !== "number" ||
    typeof pattern.entryZoneLow !== "number" ||
    typeof pattern.entryZoneHigh !== "number"
  ) {
    return false;
  }

  const high = Math.max(pattern.entryZoneLow, pattern.entryZoneHigh);
  return pattern.referenceClose <= high;
}

function isSupportHoldingProbeEligible(pattern: SmartMoneyAnalysis["pattern"], riskRewardRatio: number) {
  if (
    pattern.setupType !== "support_holding_pullback" ||
    !pattern.matched ||
    pattern.stage !== "setup" ||
    pattern.status !== "pullback_deep" ||
    pattern.debugInfo.supportStatus !== "holding" ||
    typeof pattern.referenceClose !== "number" ||
    typeof pattern.invalidationPrice !== "number"
  ) {
    return false;
  }

  // Only mature deep pullbacks should bypass the normal entry-zone timing gate.
  if ((pattern.pullbackSessions ?? 0) < 5) {
    return false;
  }

  if (pattern.referenceClose <= pattern.invalidationPrice * 1.08) {
    return false;
  }

  return riskRewardRatio >= 1.2 && (isWithinSwingEntryZone(pattern) || isBelowSwingEntryZone(pattern));
}

function isDeepPullbackProbeEligible(pattern: SmartMoneyAnalysis["pattern"], riskRewardRatio: number) {
  if (
    pattern.stage !== "setup" ||
    pattern.debugInfo.supportStatus !== "holding" ||
    typeof pattern.referenceClose !== "number" ||
    typeof pattern.invalidationPrice !== "number"
  ) {
    return false;
  }

  if (pattern.referenceClose <= pattern.invalidationPrice) {
    return false;
  }

  const pullbackDepth = pattern.pullbackMaxDrawdownPercent ?? pattern.debugInfo.pullbackDepthPct ?? 0;
  if (pullbackDepth < 20 || (pattern.pullbackSessions ?? 0) < 5) {
    return false;
  }

  if (!isInOrBelowRawSwingEntryZone(pattern)) {
    return false;
  }

  if ((pattern.volumeContractionScore ?? 0) < 55 || (pattern.candleQualityScore ?? 100) < 55) {
    return false;
  }

  return riskRewardRatio >= 1.2;
}

function isAboveInvalidationLine(pattern: SmartMoneyAnalysis["pattern"]) {
  return (
    typeof pattern.referenceClose === "number" &&
    typeof pattern.invalidationPrice === "number" &&
    pattern.invalidationPrice > 0 &&
    pattern.referenceClose > pattern.invalidationPrice
  );
}

function isBroadSwingReviewEligible(pattern: SmartMoneyAnalysis["pattern"], riskRewardRatio: number) {
  if (
    pattern.stage !== "setup" ||
    pattern.status === "pullback_early" ||
    pattern.debugInfo.supportStatus !== "holding" ||
    !isAboveInvalidationLine(pattern)
  ) {
    return false;
  }

  const pullbackDepth = pattern.pullbackMaxDrawdownPercent ?? pattern.debugInfo.pullbackDepthPct ?? 0;
  const pullbackSessions = pattern.pullbackSessions ?? pattern.debugInfo.pullbackDays ?? 0;
  const hasMeaningfulPullback = pullbackDepth >= 12 && pullbackSessions >= 3;
  const hasDriedVolume =
    (pattern.volumeContractionScore ?? 0) >= 55 || (pattern.debugInfo.volumeDryingRatio ?? Number.POSITIVE_INFINITY) <= 0.3;

  return hasMeaningfulPullback && hasDriedVolume && isInOrBelowRawSwingEntryZone(pattern) && riskRewardRatio >= 1.2;
}

function isEnvelopeWidePullbackCandidate(pattern: SmartMoneyAnalysis["pattern"], riskRewardRatio: number) {
  if (!isBroadSwingReviewEligible(pattern, riskRewardRatio) || !pattern.envelope) {
    return false;
  }

  if (pattern.envelope.position === "below_lower" || pattern.envelope.position === "above_upper") {
    return false;
  }

  const pullbackDepth = pattern.pullbackMaxDrawdownPercent ?? pattern.debugInfo.pullbackDepthPct ?? 0;
  const strongVolumeDrying =
    (pattern.volumeContractionScore ?? 0) >= 78 || (pattern.debugInfo.volumeDryingRatio ?? Number.POSITIVE_INFINITY) <= 0.18;

  return (
    riskRewardRatio >= 1.8 &&
    pullbackDepth >= 12 &&
    strongVolumeDrying &&
    (pattern.envelope.position === "lower_band" || pattern.envelope.lowerReclaimed)
  );
}

function isLongPullbackUntilStopCandidate(pattern: SmartMoneyAnalysis["pattern"], riskRewardRatio: number) {
  if (!isBroadSwingReviewEligible(pattern, riskRewardRatio)) {
    return false;
  }

  const pullbackSessions = pattern.pullbackSessions ?? pattern.debugInfo.pullbackDays ?? 0;
  if (pullbackSessions < 8) {
    return false;
  }

  if (pattern.envelope?.position === "above_upper") {
    return false;
  }

  return isAboveInvalidationLine(pattern);
}

export function isFailedPostSpikePullbackShape(pattern: SmartMoneyAnalysis["pattern"]) {
  if (pattern.stage !== "setup" || pattern.setupType !== "support_holding_pullback") {
    return false;
  }

  const pullbackSessions = pattern.pullbackSessions ?? pattern.debugInfo.pullbackDays ?? 0;
  const pullbackDepth = pattern.pullbackMaxDrawdownPercent ?? pattern.debugInfo.pullbackDepthPct ?? 0;
  const closeVsBreakoutLevel = pattern.referenceCloseVsBreakoutLevelPercent ?? 0;
  const closeVsBase = pattern.referenceCloseVsBasePercent ?? 0;

  return pullbackSessions <= 8 && pullbackDepth >= 18 && closeVsBreakoutLevel <= -20 && closeVsBase <= -6;
}

function dedupeStrings<T extends string>(values: T[]) {
  return [...new Set(values.filter(Boolean))];
}

function summarizePenaltyFactors(
  penaltyFactors: SmartMoneyAnalysis["pattern"]["penaltyFactors"]
): SmartMoneyAnalysis["pattern"]["penaltyFactors"] {
  return [...(penaltyFactors ?? [])]
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 6);
}

function buildHistoryGuardPenaltyFactors(
  guardEvaluation: SwingHistoryWinRateGuardEvaluation | undefined
): SmartMoneyAnalysis["pattern"]["penaltyFactors"] {
  return (guardEvaluation?.matchedSignals ?? []).slice(0, 2).map((signal) => ({
    code: signal.severity === "block" ? "history_loss_cluster" : "history_win_rate_caution",
    label: signal.severity === "block" ? "History loss cluster" : "History win-rate caution",
    impact: signal.severity === "block" ? 20 : 10,
    reason: signal.reason
  }));
}

function buildHistoryGuardReasons(guardEvaluation: SwingHistoryWinRateGuardEvaluation | undefined) {
  return (guardEvaluation?.matchedSignals ?? []).slice(0, 3).map((signal) =>
    signal.severity === "block"
      ? `history_loss_cluster:${signal.key}:${signal.winRatePct}%`
      : `history_win_rate_caution:${signal.key}:${signal.winRatePct}%`
  );
}

function buildSwingHistoryGuardEvaluation(
  analysis: SmartMoneyAnalysis,
  guardModel: SwingHistoryWinRateGuardModel | undefined,
  classificationReasons: string[]
) {
  const pattern = analysis.pattern;
  return evaluateSwingHistoryWinRateGuard(guardModel, {
    score: pattern.finalRankScore ?? pattern.patternScore,
    tags: pattern.tags,
    reasons: classificationReasons,
    penaltyFactors: pattern.penaltyFactors,
    envelope: pattern.envelope,
    buyPlan: pattern.buyPlan,
    referenceClose: pattern.referenceClose
  });
}

function isThirdBuyConfirmationBlocked(pattern: SmartMoneyAnalysis["pattern"]) {
  const buyPlan = pattern.buyPlan;
  if (
    !buyPlan ||
    typeof pattern.referenceClose !== "number" ||
    !Number.isFinite(pattern.referenceClose) ||
    typeof buyPlan.thirdBuyPrice !== "number" ||
    !Number.isFinite(buyPlan.thirdBuyPrice)
  ) {
    return false;
  }

  const inThirdBuyZone = pattern.referenceClose <= buyPlan.thirdBuyPrice * 1.01;
  if (!inThirdBuyZone) {
    return false;
  }

  const supportConfirmed =
    pattern.debugInfo.supportStatus === "holding" &&
    (pattern.supportStabilityScore ?? 0) >= 65 &&
    (pattern.candleQualityScore ?? 0) >= 60 &&
    (pattern.volumeContractionScore ?? 0) >= 60 &&
    pattern.envelope?.position !== "below_lower";

  return !supportConfirmed;
}

function buildThirdBuyConfirmationPenalty(): SmartMoneyAnalysis["pattern"]["penaltyFactors"][number] {
  return {
    code: "third_buy_confirmation_required",
    label: "Third buy confirmation required",
    impact: 24,
    reason:
      "Reference close is already near or below the third staged-buy price, so the engine requires support, candle, volume, and envelope confirmation before keeping it actionable."
  };
}

export function classifySwingCandidate(
  analysis: SmartMoneyAnalysis,
  guardModel?: SwingHistoryWinRateGuardModel
): SwingCandidateClassification {
  const pattern = analysis.pattern;
  const riskRewardRatio = pattern.tradePlan?.riskRewardRatio ?? pattern.riskRewardRatio ?? 0;
  const failedPostSpikePullbackShape = isFailedPostSpikePullbackShape(pattern);
  const withinEntryZone = isWithinSwingEntryZone(pattern);
  const setupPullbackReady = pattern.stage !== "setup" || pattern.status === "buy_ready";
  const supportHoldingProbeEligible = isSupportHoldingProbeEligible(pattern, riskRewardRatio);
  const deepPullbackProbeEligible = isDeepPullbackProbeEligible(pattern, riskRewardRatio);
  const broadReviewEligible = isBroadSwingReviewEligible(pattern, riskRewardRatio);
  const envelopeWidePullbackCandidate = isEnvelopeWidePullbackCandidate(pattern, riskRewardRatio);
  const longPullbackUntilStopCandidate = isLongPullbackUntilStopCandidate(pattern, riskRewardRatio);
  const envelopeLowerBreak = pattern.envelope?.position === "below_lower" && pattern.envelope.lowerBreakSessions >= 2;
  const weakVolumeContraction = pattern.stage === "setup" && (pattern.volumeContractionScore ?? 0) < 60;
  const poorCandleStructure = (pattern.candleQualityScore ?? 100) < 60;
  const negativeSma20Slope = (pattern.sma20SlopePercent ?? 0) < 0;
  const unstableSupport = (pattern.supportStabilityScore ?? 100) < 60 || pattern.debugInfo.supportStatus !== "holding";
  const weakRiskReward = riskRewardRatio > 0 && riskRewardRatio < 1.8;
  const haltWatchOnly = analysis.haltAction === "watch_only";
  const haltPenalty = analysis.haltAction === "allow_with_penalty";
  const lowQuality = weakVolumeContraction || poorCandleStructure || negativeSma20Slope || unstableSupport || weakRiskReward;
  const rankScore = pattern.finalRankScore ?? pattern.patternScore;
  const hasUnstableSupportPenalty = (pattern.penaltyFactors ?? []).some((factor) => factor.code === "unstable_support");
  const lowScoreUnstableSupport = rankScore < 60 && hasUnstableSupportPenalty;
  const derivedHistoryGuardReasons = dedupeStrings([
    ...(pattern.classificationReasons ?? []),
    supportHoldingProbeEligible ? "support_holding_probe" : "",
    deepPullbackProbeEligible ? "deep_pullback_probe" : "",
    longPullbackUntilStopCandidate ? "long_pullback_until_stop_probe" : "",
    envelopeWidePullbackCandidate ? "wide_pullback_candidate" : "",
    envelopeWidePullbackCandidate ? "envelope_lower_hold" : "",
    envelopeLowerBreak ? "envelope_lower_break" : "",
    weakVolumeContraction ? "weak_volume_contraction" : "",
    poorCandleStructure ? "weak_candle_structure" : "",
    negativeSma20Slope ? "sma20_slope_negative" : "",
    unstableSupport ? "unstable_support" : "",
    weakRiskReward ? "risk_reward_thin" : "",
    lowScoreUnstableSupport ? "probe_demoted_low_score_unstable_support" : "",
    lowQuality ? "quality_not_ready" : ""
  ]);
  const historyGuardEvaluation = buildSwingHistoryGuardEvaluation(analysis, guardModel, derivedHistoryGuardReasons);
  const historyGuardPenaltyFactors = buildHistoryGuardPenaltyFactors(historyGuardEvaluation);
  const historyGuardReasons = buildHistoryGuardReasons(historyGuardEvaluation);
  const thirdBuyConfirmationBlocked = isThirdBuyConfirmationBlocked(pattern);
  const thirdBuyConfirmationPenalty = thirdBuyConfirmationBlocked ? [buildThirdBuyConfirmationPenalty()] : [];
  const targetHitOutcome =
    pattern.postEntryOutcome?.status === "target_hit_after_first_buy" ||
    pattern.postEntryOutcome?.status === "target_hit_after_second_buy" ||
    pattern.postEntryOutcome?.status === "target_hit_after_third_buy";
  // User-facing execution means "buy price reached now".
  // Do not promote actionable/probe/long-pullback visibility unless the setup is buy_ready
  // and the reference close is inside the staged entry zone.
  const readyByEngine =
    pattern.actionable &&
    pattern.stage === "setup" &&
    pattern.status === "buy_ready" &&
    withinEntryZone &&
    !haltWatchOnly &&
    !haltPenalty;
  // Setup names should stay on watch until the pullback has progressed to the engine's buy-ready state
  // and the reference close is actually inside the staged entry zone.
  const probeByLocation =
    pattern.matched &&
    !haltWatchOnly &&
    ((withinEntryZone && setupPullbackReady) || supportHoldingProbeEligible);
  const probeByDeepPullback = !haltWatchOnly && deepPullbackProbeEligible;

  if (targetHitOutcome) {
    return {
      bucket: "watch",
      reasons: dedupeStrings([
        ...(pattern.classificationReasons ?? []),
        pattern.postEntryOutcome?.status ?? "",
        "post_entry_target_hit",
        "profit_opportunity_already_given"
      ]),
      tags: dedupeStrings([...(pattern.tags ?? []), "watch_low_quality" as const]),
      penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
    };
  }

  if (failedPostSpikePullbackShape) {
    return {
      bucket: "watch",
      reasons: dedupeStrings([
        ...(pattern.classificationReasons ?? []),
        "failed_post_spike_pullback_shape",
        "not_base_compression_shape",
        "exclude_from_swing_candidates"
      ]),
      tags: dedupeStrings([...(pattern.tags ?? []), "watch_low_quality" as const]),
      penaltyFactors: summarizePenaltyFactors([
        ...(pattern.penaltyFactors ?? []),
        {
          code: "failed_post_spike_pullback_shape",
          label: "Failed post-spike pullback shape",
          impact: 22,
          reason: "Short-lived spike lost the prior box and fell too deeply to qualify as a base-compression swing shape."
        }
      ])
    };
  }

  if (thirdBuyConfirmationBlocked) {
    return {
      bucket: "watch",
      reasons: dedupeStrings([
        ...(pattern.classificationReasons ?? []),
        "third_buy_confirmation_required",
        "third_buy_not_confirmed",
        "execution_blocked_by_deep_entry_policy"
      ]),
      tags: dedupeStrings([
        ...(pattern.tags ?? []),
        "tag_third_buy_confirmation_required" as const,
        "watch_low_quality" as const
      ]),
      penaltyFactors: summarizePenaltyFactors([
        ...(pattern.penaltyFactors ?? []),
        ...thirdBuyConfirmationPenalty
      ])
    };
  }

  if (historyGuardEvaluation.shouldBlockExecution) {
    return {
      bucket: "watch",
      reasons: dedupeStrings([
        ...(pattern.classificationReasons ?? []),
        ...historyGuardReasons,
        "history_loss_cluster",
        "execution_blocked_by_history_win_rate"
      ]),
      tags: dedupeStrings([
        ...(pattern.tags ?? []),
        "tag_history_loss_cluster" as const,
        "watch_low_quality" as const
      ]),
      penaltyFactors: summarizePenaltyFactors([
        ...(pattern.penaltyFactors ?? []),
        ...historyGuardPenaltyFactors
      ])
    };
  }

  if (readyByEngine && !lowQuality) {
    if (historyGuardEvaluation.shouldCautionExecution) {
      return {
        bucket: "execution_probe",
        reasons: dedupeStrings([
          ...(pattern.classificationReasons ?? []),
          ...historyGuardReasons,
          "history_win_rate_caution",
          "execution_ready_downgraded_to_probe"
        ]),
        tags: dedupeStrings([
          ...(pattern.tags ?? []),
          "tag_history_win_rate_caution" as const
        ]),
        penaltyFactors: summarizePenaltyFactors([
          ...(pattern.penaltyFactors ?? []),
          ...historyGuardPenaltyFactors
        ])
      };
    }

    return {
      bucket: "execution_ready",
      reasons: dedupeStrings([...(pattern.classificationReasons ?? []), "execution_ready", "actionable_gate_cleared"]),
      tags: dedupeStrings([...(pattern.tags ?? [])]),
      penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
    };
  }

  if (
    (probeByLocation || probeByDeepPullback || longPullbackUntilStopCandidate) &&
    !envelopeLowerBreak &&
    // Long-pullback visibility is not an execution-promotion bypass.
    // Low-score unstable support must stay watch-only unless the SMA20 envelope has been reclaimed.
    (!lowScoreUnstableSupport || envelopeWidePullbackCandidate)
  ) {
    const probeReasons = dedupeStrings([
      ...(pattern.classificationReasons ?? []),
      probeByDeepPullback ? "deep_pullback_probe" : "",
      probeByDeepPullback ? "above_stop" : "",
      longPullbackUntilStopCandidate ? "long_pullback_until_stop_probe" : "",
      longPullbackUntilStopCandidate ? "above_stop" : "",
      isInOrBelowRawSwingEntryZone(pattern) ? "entry_zone_hit" : "",
      envelopeWidePullbackCandidate ? "wide_pullback_candidate" : "",
      envelopeWidePullbackCandidate ? "envelope_lower_hold" : "",
      ...historyGuardReasons,
      readyByEngine
        ? "execution_ready_blocked_by_quality"
        : envelopeWidePullbackCandidate
          ? "execution_gate_overridden_by_envelope"
          : "execution_gate_not_cleared",
      historyGuardEvaluation.shouldCautionExecution ? "history_win_rate_caution" : "",
      weakVolumeContraction ? "weak_volume_contraction" : "",
      poorCandleStructure ? "weak_candle_structure" : "",
      negativeSma20Slope ? "sma20_slope_negative" : "",
      unstableSupport ? "unstable_support" : "",
      weakRiskReward ? "risk_reward_thin" : "",
      haltPenalty ? "halt_penalty_active" : ""
    ]);

    return {
      // These are visible swing ideas, not buy candidates. In particular,
      // entry_zone_pending and long_pullback_until_stop_probe must stay out of executionItems.
      bucket: "watch",
      reasons: probeReasons,
      tags: dedupeStrings([
        ...(pattern.tags ?? []),
        "watch_pullback_pending" as const,
        ...(unstableSupport ? (["tag_support_unstable"] as const) : []),
        ...(envelopeWidePullbackCandidate ? (["tag_envelope_lower_hold"] as const) : []),
        ...(historyGuardEvaluation.shouldCautionExecution ? (["tag_history_win_rate_caution"] as const) : [])
      ]),
      penaltyFactors: summarizePenaltyFactors([
        ...(pattern.penaltyFactors ?? []),
        ...historyGuardPenaltyFactors
      ])
    };
  }

  const watchTags = [
    ...(pattern.tags ?? []),
    ...(analysis.haltCategory === "event" ? (["watch_halt_event"] as const) : []),
    ...(analysis.haltCategory === "structural" || analysis.haltCategory === "critical" ? (["watch_halt_structural"] as const) : []),
    ...(pattern.status === "breakout_extended" ? (["watch_extended_leader"] as const) : []),
    ...(pattern.stage === "setup" && !withinEntryZone ? (["watch_pullback_pending"] as const) : []),
    ...(lowQuality ? (["watch_low_quality"] as const) : []),
    ...(historyGuardEvaluation.shouldCautionExecution ? (["tag_history_win_rate_caution"] as const) : [])
  ];

  return {
    bucket: "watch",
    reasons: dedupeStrings([
      ...(pattern.classificationReasons ?? []),
      pattern.status === "breakout_extended" ? "extended_leader_watch" : "",
      pattern.stage === "setup" && (!withinEntryZone || pattern.status !== "buy_ready") ? "pullback_pending" : "",
      broadReviewEligible ? "broad_review_watch" : "",
      broadReviewEligible ? "above_stop" : "",
      ...historyGuardReasons,
      envelopeLowerBreak ? "envelope_lower_break" : "",
      lowScoreUnstableSupport ? "probe_demoted_low_score_unstable_support" : "",
      historyGuardEvaluation.shouldCautionExecution ? "history_win_rate_caution" : "",
      lowQuality ? "quality_not_ready" : "",
      haltPenalty ? "halt_penalty_active" : "",
      haltWatchOnly ? "halt_watch_only" : ""
    ]),
    tags: dedupeStrings(watchTags),
    penaltyFactors: summarizePenaltyFactors([
      ...(pattern.penaltyFactors ?? []),
      ...historyGuardPenaltyFactors
    ])
  };
}

export function isSwingExecutionEligible(pattern: SmartMoneyAnalysis["pattern"], analysis?: SmartMoneyAnalysis) {
  if (isPennyStockRisk(pattern)) {
    return false;
  }

  if (!analysis) {
    return pattern.actionable || isWithinSwingEntryZone(pattern);
  }

  return classifySwingCandidate(analysis).bucket !== "watch";
}

function isSwingWatchEligible(analysis: SmartMoneyAnalysis, classification?: SwingCandidateClassification) {
  if (isPennyStockRisk(analysis.pattern)) {
    return false;
  }

  if (isFailedPostSpikePullbackShape(analysis.pattern)) {
    return false;
  }

  const resolvedClassification = classification ?? classifySwingCandidate(analysis);
  if (resolvedClassification.bucket !== "watch") {
    return false;
  }

  const outcomeStatus = analysis.pattern.postEntryOutcome?.status;
  if (
    outcomeStatus === "target_hit_after_first_buy" ||
    outcomeStatus === "target_hit_after_second_buy" ||
    outcomeStatus === "target_hit_after_third_buy"
  ) {
    return false;
  }

  if (analysis.pattern.classificationReasons?.includes("base_reclaim_watch")) {
    return true;
  }

  // A relaxed-close lead-in is only created after a later surge session
  // confirms both continuation and full liquidity. Preserve that validated
  // setup in watchItems even when quality penalties keep matched=false.
  if (
    analysis.pattern.stage === 'setup' &&
    analysis.pattern.classificationReasons?.includes('seed_anchor_confirmed')
  ) {
    return true;
  }

  const riskRewardRatio = analysis.pattern.tradePlan?.riskRewardRatio ?? analysis.pattern.riskRewardRatio ?? 0;
  return (
    (analysis.pattern.matched && analysis.pattern.status !== "pullback_early") ||
    isBroadSwingReviewEligible(analysis.pattern, riskRewardRatio)
  );
}

async function scanSwingChunk(
  chunk: UniverseItem[],
  profile: SwingEngineProfile,
  guardModel: SwingHistoryWinRateGuardModel | undefined
) {
  const settled = await Promise.allSettled(
    chunk.map(async (item) => ({
      item,
      analysis: await analyzeSmartMoneyPattern({
        symbol: item.code,
        name: item.name
      }, getSwingProfileFilterOverrides(profile))
    }))
  );

  const actionable: SwingScanRankedItem[] = [];
  const watch: SwingScanRankedItem[] = [];
  let failures = 0;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value.analysis.tradingHalted && result.value.analysis.haltAction === "exclude") {
        continue;
      }

      if (isPennyStockRisk(result.value.analysis.pattern)) {
        continue;
      }

      const classification = classifySwingCandidate(result.value.analysis, guardModel);
      if (classification.bucket !== "watch") {
        actionable.push(result.value);
      } else if (isSwingWatchEligible(result.value.analysis, classification)) {
        watch.push(result.value);
      }
      continue;
    }

    failures += 1;
  }

  return {
    actionable,
    watch,
    failures
  };
}

async function scanAndSaveLongTermUniverse(): Promise<RecommendationUniverseScanResult> {
  const result = await scanLongTermUniverse({
    forceRefreshUniverse: true
  });
  assertLongTermUniverseCommitSafety(result);
  const capturedAt = new Date().toISOString();
  const committed = await withServerLongTermPicksMutation(async (previousItems) => {
    assertLongTermUniverseCommitSafety(result, previousItems);
    const previousPicksBySymbol = new Map(previousItems.map((item) => [item.symbol, item]));
    const nextItems: ServerLongTermPick[] = result.candidates.map((candidate) => {
      const longTermBucket = resolveLongTermBucket(candidate);
      const previousPick = previousPicksBySymbol.get(candidate.symbol);
      const bucketEnteredDate =
        previousPick?.longTermBucket === longTermBucket
          ? previousPick.bucketEnteredDate ?? previousPick.anchorDate
          : result.asOfDate;

      return {
        key: `${candidate.name}-${candidate.symbol}`,
        name: candidate.name,
        symbol: candidate.symbol,
        anchorDate: previousPick?.anchorDate ?? result.asOfDate,
        latestMentionDate: result.asOfDate,
        bucketEnteredDate,
        note: buildLongTermNote(candidate),
        category: "longTerm",
        longTermBucket,
        source: "server-universe"
      };
    });
    const historyUpdate = await updateLongTermRecommendationHistoryFromScan({
      asOfDate: result.asOfDate,
      universeSize: result.universeSize,
      candidates: result.candidates,
      currentPicks: nextItems,
      capturedAt,
      scanCompleteness: "complete",
      scope: {
        mode: "full_universe"
      }
    });
    const dateOverrideBySymbol = new Map(
      historyUpdate.currentPickDateOverrides.map((override) => [override.symbol, override] as const)
    );
    const publishedItems = nextItems.map((item) => {
      const override = dateOverrideBySymbol.get(item.symbol);
      return override
        ? {
            ...item,
            anchorDate: override.anchorDate,
            bucketEnteredDate: override.bucketEnteredDate
          }
        : item;
    });

    return {
      nextItems: publishedItems,
      result: historyUpdate
    };
  });
  const items = committed.items;
  const historyUpdate = committed.result;

  return {
    category: "longTerm",
    count: items.length,
    buyCount: result.groupedCandidates.buyCandidates.length,
    accumulateCount: result.groupedCandidates.accumulateCandidates.length,
    watchCount: result.groupedCandidates.watchCandidates.length,
    asOfDate: result.asOfDate,
    universeSize: result.universeSize,
    items,
    historyUpdated: true,
    historyUpdate,
    historyUpdateError: undefined
  };
}

async function scanAndSaveDividendUniverse(): Promise<RecommendationUniverseScanResult> {
  const result = await scanDividendUniverse({
    forceRefreshUniverse: true
  });

  const items = await writeServerDividendPicks(
    result.candidates.map((candidate) => ({
      key: `${candidate.name}-${candidate.symbol}-dividend`,
      name: candidate.name,
      symbol: candidate.symbol,
      anchorDate: result.asOfDate,
      latestDividendAmount: candidate.dividendMetrics.latestDividendPerShare,
      note: buildDividendNote(candidate),
      category: "dividend" as const,
      longTermBucket: candidate.candidateGroup === "watch candidate" ? ("watch" as const) : ("buy" as const),
      source: "server-universe" as const
    }))
  );

  return {
    category: "dividend",
    count: items.length,
    buyCount: result.groupedCandidates.buyCandidates.length,
    watchCount: result.groupedCandidates.watchCandidates.length,
    asOfDate: result.asOfDate,
    universeSize: result.universeSize,
    items
  };
}

async function scanAndSaveSwingUniverse(profileInput?: SwingEngineProfile): Promise<RecommendationUniverseScanResult> {
  const profile = resolveSwingEngineProfile(profileInput);
  const universe = await getStockUniverse({ forceRefresh: true });
  const targets = universe.items.filter((item) => SWING_TARGET_MARKETS.has(item.market));
  const tradingHaltLookup = await getTradingHaltLookup({ forceRefresh: true });
  const activeTargets = targets.filter((item) => tradingHaltLookup.get(item.code)?.haltAction !== "exclude");
  const historyGuardModel = await buildSwingHistoryWinRateGuardModel();
  const actionable: SwingScanRankedItem[] = [];
  const watch: SwingScanRankedItem[] = [];
  let failures = 0;

  for (let index = 0; index < activeTargets.length; index += SWING_CHUNK_SIZE) {
    const chunk = activeTargets.slice(index, index + SWING_CHUNK_SIZE);
    const result = await scanSwingChunk(chunk, profile, historyGuardModel);
    actionable.push(...result.actionable);
    watch.push(...result.watch);
    failures += result.failures;
  }

  actionable.sort(compareSwingAnalyses);
  watch.sort(compareSwingAnalyses);

  const defaultSwingSymbols =
    profile === "smallcap"
      ? new Set((await readServerSwingPickPayload("default")).items.map((item) => item.symbol))
      : null;
  const filteredActionable =
    defaultSwingSymbols == null ? actionable : actionable.filter(({ item }) => !defaultSwingSymbols.has(item.code));
  const filteredWatch = defaultSwingSymbols == null ? watch : watch.filter(({ item }) => !defaultSwingSymbols.has(item.code));
  const existingPayload = await readServerSwingPickPayload(profile);
  const existingPickBySymbol = new Map(existingPayload.items.map((item) => [item.symbol, item] as const));
  const carryForwardCases = await readSwingCarryForwardCases(profile);
  const carryForwardCaseBySymbol = new Map(carryForwardCases.map((historyCase) => [historyCase.symbol, historyCase] as const));

  const executionItems = filteredActionable.map(({ item, analysis }) => ({
    ...preserveSwingPickDates(
      preserveEnteredHistoryPlan(
        toServerSwingPick(item, analysis, classifySwingCandidate(analysis, historyGuardModel)),
        carryForwardCaseBySymbol.get(item.code)
      ),
      existingPickBySymbol.get(item.code)
    ),
    swingProfile: profile
  }));
  const engineWatchItems = filteredWatch.map(({ item, analysis }) => ({
    ...preserveSwingPickDates(
      preserveEnteredHistoryPlan(
        toServerSwingPick(item, analysis, classifySwingCandidate(analysis, historyGuardModel)),
        carryForwardCaseBySymbol.get(item.code)
      ),
      existingPickBySymbol.get(item.code)
    ),
    swingProfile: profile
  }));
  const nextSymbols = new Set([...executionItems, ...engineWatchItems].map((item) => item.symbol));
  // 새 스캔에서 fresh setup이 안 잡혔다는 이유만으로 체결 케이스를
  // 덮어써서 없애면 안 됩니다. 실제 종료 조건 전까지 watchItems에 병합합니다.
  const carryForwardWatchItems = carryForwardCases
    .filter((historyCase) => !nextSymbols.has(historyCase.symbol))
    .filter((historyCase) => defaultSwingSymbols == null || !defaultSwingSymbols.has(historyCase.symbol))
    .map((historyCase) => toCarryForwardSwingWatchPick(historyCase, profile));

  const payload = await writeServerSwingPicks(
    {
      executionItems,
      watchItems: [...engineWatchItems, ...carryForwardWatchItems]
    },
    {
      profile
    }
  );
  let historyUpdate: SwingHistoryUpdate | undefined;
  let historyUpdateError: string | undefined;

  try {
    historyUpdate = await updateSwingRecommendationHistoryFromCurrentPicks();
  } catch (error) {
    historyUpdateError = error instanceof Error ? error.message : String(error);
  }

  return {
    category: "swing",
    count: payload.items.length,
    executionCount: payload.executionItems.length,
    watchCount: payload.watchItems.length,
    universeSize: targets.length,
    failureCount: failures,
    items: payload.items,
    executionItems: payload.executionItems,
    watchItems: payload.watchItems,
    historyUpdated: Boolean(historyUpdate),
    historyUpdate,
    historyUpdateError
  };
}

export async function scanRecommendationUniverse(
  category: RecommendationUniverseCategory,
  options?: { swingProfile?: SwingEngineProfile }
): Promise<RecommendationUniverseScanResult> {
  const swingProfile = resolveSwingEngineProfile(options?.swingProfile);
  const scopeKey: RecommendationUniverseScanScope =
    category === "swing" ? (`swing:${swingProfile}` as const) : category;
  const existing = activeScanByCategory.get(scopeKey);
  if (existing) {
    return existing;
  }

  const nextScan = (
    category === "longTerm"
      ? scanAndSaveLongTermUniverse()
      : category === "dividend"
        ? scanAndSaveDividendUniverse()
        : scanAndSaveSwingUniverse(swingProfile)
  ).finally(() => {
    activeScanByCategory.delete(scopeKey);
  });

  activeScanByCategory.set(scopeKey, nextScan);
  return nextScan;
}
