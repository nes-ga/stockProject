import { scanDividendUniverse } from "./dividendEngine.js";
import { scanLongTermUniverse } from "./longTermEngine.js";
import { writeServerDividendPicks } from "./serverDividendPicks.js";
import { writeServerLongTermPicks } from "./serverLongTermPicks.js";
import { readServerSwingPickPayload, writeServerSwingPicks, type ServerSwingPick } from "./serverSwingPicks.js";
import { analyzeSmartMoneyPattern } from "./stockAnalysis.js";
import { getStockUniverse } from "./stockUniverse.js";
import { getSwingProfileFilterOverrides, resolveSwingEngineProfile, type SwingEngineProfile } from "./swingProfiles.js";
import { getTradingHaltLookup } from "./tradingHalts.js";
import { readSwingCarryForwardCases, updateSwingRecommendationHistoryFromCurrentPicks, type SwingCarryForwardCase } from "./recommendationHistory.js";

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
      watchCount: number;
      asOfDate: string;
      universeSize: number;
      items: Awaited<ReturnType<typeof writeServerLongTermPicks>>;
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

  pushLongTermHighlight(highlights, `총점 ${candidate.scores.totalScore}점`);

  if (candidate.drawdownPct != null) {
    pushLongTermHighlight(highlights, `낙폭 ${Math.round(Math.abs(candidate.drawdownPct))}%`);
  }

  if (
    candidate.financials?.financialMomentum === "improving" ||
    candidate.financials?.operatingProfitTrend === "improving" ||
    candidate.financials?.netIncomeTrend === "improving"
  ) {
    pushLongTermHighlight(highlights, "실적 개선");
  } else if (candidate.financials?.financialMomentum === "deteriorating") {
    pushLongTermHighlight(highlights, "실적 둔화");
  }

  if (candidate.baseStructure.isStabilizing) {
    pushLongTermHighlight(highlights, "바닥 안정화");
  } else if (candidate.baseStructure.higherLowCount >= 2) {
    pushLongTermHighlight(highlights, "바닥 형성 중");
  } else {
    pushLongTermHighlight(highlights, "바닥 미완성");
  }

  if ((candidate.structure.ma120Slope ?? 0) >= 1) {
    pushLongTermHighlight(highlights, "MA120 상향");
  } else if ((candidate.structure.ma120Slope ?? 0) >= -0.5) {
    pushLongTermHighlight(highlights, "MA120 평탄");
  } else {
    pushLongTermHighlight(highlights, "MA120 하락");
  }

  return highlights;
}

function buildLongTermNote(candidate: LongTermUniverseCandidate) {
  const groupLabel = candidate.candidateGroup === "buy candidate" ? "중장기 매수 가능 후보군" : "중장기 관찰 후보군";

  return [groupLabel, formatLongTermNoteLabel(candidate.label), ...buildLongTermHighlights(candidate)].join(" | ");
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
      ? "스윙 추격 금지 감지"
      : pattern.stage === "breakout"
        ? "스윙 완성형 감지"
        : pattern.status === "buy_ready"
          ? "스윙 1차매수 구간 감지"
          : "스윙 소화형 감지";
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
  const displayBuyPlanText = pattern.buyPlan
    ? buyPlanText
    : `${pattern.stage === "breakout" ? "관찰" : "구간"} ${pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneLow)}~${Math.round(pattern.entryZoneHigh)}` : "-"}`;
  const resolvedDisplayBuyPlanText = pattern.buyPlan
    ? buyPlanText
    : `${pattern.stage === "breakout" ? "관찰" : "구간"} ${displayEntryZoneText}`;
  const stopText = `손절 ${resolvedStopPrice != null && resolvedStopPrice > 0 ? Math.round(resolvedStopPrice) : "-"}`;
  const stopRefText = `손절기준 ${pattern.stopLossReferenceDate ?? "-"} ${pattern.stopLossReferenceType === "close_fallback" ? "close" : "low"}`;
  const envelopeText = pattern.envelope
    ? `ENV20 ${pattern.envelope.position} ${Math.round(pattern.envelope.lower)}/${Math.round(pattern.envelope.basis)}/${Math.round(pattern.envelope.upper)}`
    : undefined;

  const finalDisplayBuyPlanText = isExecutionCandidate ? buyPlanText : resolvedDisplayBuyPlanText;

  return [
    stageLabel,
    `선행 수급 ${pattern.leadInDate ?? "-"}`,
    `급등 피크 ${pattern.surgePeakDate ?? pattern.breakoutDate ?? "-"}`,
    `눌림 ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
    `SMA20 ${pattern.referenceSma20 != null ? Math.round(pattern.referenceSma20) : "-"}`,
    finalDisplayBuyPlanText,
    envelopeText,
    stopText,
    stopRefText,
    `점수 ${pattern.finalRankScore ?? pattern.patternScore}`
  ].filter(Boolean).join(" | ");
}

type SwingCandidateClassification = {
  bucket: "execution_ready" | "execution_probe" | "watch";
  reasons: string[];
  tags: SmartMoneyAnalysis["pattern"]["tags"];
  penaltyFactors: SmartMoneyAnalysis["pattern"]["penaltyFactors"];
};

function toServerSwingPick(item: UniverseItem, analysis: SmartMoneyAnalysis, classification: SwingCandidateClassification) {
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

// 아직 종료 조건이 없는 체결 히스토리 케이스를 watch 후보로 되살립니다.
// 실행 후보로 승격하는 경로가 아니라, 손절/목표/시간 종료 전까지
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
    postEntryOutcome: {
      status: "active",
      executedBuyCount: historyCase.executedBuyCount,
      executedBuys,
      averageBuyPrice: historyCase.averageBuyPrice,
      latestClose: historyCase.latestClose,
      latestDate: historyCase.dataDate,
      unrealizedReturnPct: historyCase.unrealizedReturnPct
    },
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

export function classifySwingCandidate(analysis: SmartMoneyAnalysis): SwingCandidateClassification {
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
  const targetHitOutcome =
    pattern.postEntryOutcome?.status === "target_hit_after_first_buy" ||
    pattern.postEntryOutcome?.status === "target_hit_after_second_buy" ||
    pattern.postEntryOutcome?.status === "target_hit_after_third_buy";
  const readyByEngine = pattern.actionable && !haltWatchOnly && !haltPenalty;
  // Setup names should stay on watch until the pullback has progressed to the engine's buy-ready state.
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

  if (readyByEngine && !lowQuality) {
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
    (!lowScoreUnstableSupport || envelopeWidePullbackCandidate || longPullbackUntilStopCandidate)
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
      readyByEngine
        ? "execution_ready_blocked_by_quality"
        : envelopeWidePullbackCandidate
          ? "execution_gate_overridden_by_envelope"
          : "execution_gate_not_cleared",
      weakVolumeContraction ? "weak_volume_contraction" : "",
      poorCandleStructure ? "weak_candle_structure" : "",
      negativeSma20Slope ? "sma20_slope_negative" : "",
      unstableSupport ? "unstable_support" : "",
      weakRiskReward ? "risk_reward_thin" : "",
      haltPenalty ? "halt_penalty_active" : ""
    ]);

    return {
      bucket: "execution_probe",
      reasons: probeReasons,
      tags: dedupeStrings([
        ...(pattern.tags ?? []),
        ...(unstableSupport ? (["tag_support_unstable"] as const) : []),
        ...(envelopeWidePullbackCandidate ? (["tag_envelope_lower_hold"] as const) : [])
      ]),
      penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
    };
  }

  const watchTags = [
    ...(pattern.tags ?? []),
    ...(analysis.haltCategory === "event" ? (["watch_halt_event"] as const) : []),
    ...(analysis.haltCategory === "structural" || analysis.haltCategory === "critical" ? (["watch_halt_structural"] as const) : []),
    ...(pattern.status === "breakout_extended" ? (["watch_extended_leader"] as const) : []),
    ...(pattern.stage === "setup" && !withinEntryZone ? (["watch_pullback_pending"] as const) : []),
    ...(lowQuality ? (["watch_low_quality"] as const) : [])
  ];

  return {
    bucket: "watch",
    reasons: dedupeStrings([
      ...(pattern.classificationReasons ?? []),
      pattern.status === "breakout_extended" ? "extended_leader_watch" : "",
      pattern.stage === "setup" && (!withinEntryZone || pattern.status !== "buy_ready") ? "pullback_pending" : "",
      broadReviewEligible ? "broad_review_watch" : "",
      broadReviewEligible ? "above_stop" : "",
      envelopeLowerBreak ? "envelope_lower_break" : "",
      lowScoreUnstableSupport ? "probe_demoted_low_score_unstable_support" : "",
      lowQuality ? "quality_not_ready" : "",
      haltPenalty ? "halt_penalty_active" : "",
      haltWatchOnly ? "halt_watch_only" : ""
    ]),
    tags: dedupeStrings(watchTags),
    penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
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

  const riskRewardRatio = analysis.pattern.tradePlan?.riskRewardRatio ?? analysis.pattern.riskRewardRatio ?? 0;
  return (
    (analysis.pattern.matched && analysis.pattern.status !== "pullback_early") ||
    isBroadSwingReviewEligible(analysis.pattern, riskRewardRatio)
  );
}

async function scanSwingChunk(chunk: UniverseItem[], profile: SwingEngineProfile) {
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

      const classification = classifySwingCandidate(result.value.analysis);
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

  const items = await writeServerLongTermPicks(
    result.candidates.map((candidate) => ({
      key: `${candidate.name}-${candidate.symbol}`,
      name: candidate.name,
      symbol: candidate.symbol,
      anchorDate: result.asOfDate,
      note: buildLongTermNote(candidate),
      category: "longTerm" as const,
      longTermBucket: candidate.candidateGroup === "watch candidate" ? ("watch" as const) : ("buy" as const),
      source: "server-universe" as const
    }))
  );

  return {
    category: "longTerm",
    count: items.length,
    buyCount: result.groupedCandidates.buyCandidates.length,
    watchCount: result.groupedCandidates.watchCandidates.length,
    asOfDate: result.asOfDate,
    universeSize: result.universeSize,
    items
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
  const actionable: SwingScanRankedItem[] = [];
  const watch: SwingScanRankedItem[] = [];
  let failures = 0;

  for (let index = 0; index < activeTargets.length; index += SWING_CHUNK_SIZE) {
    const chunk = activeTargets.slice(index, index + SWING_CHUNK_SIZE);
    const result = await scanSwingChunk(chunk, profile);
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

  const executionItems = filteredActionable.map(({ item, analysis }) => ({
    ...preserveSwingPickDates(
      toServerSwingPick(item, analysis, classifySwingCandidate(analysis)),
      existingPickBySymbol.get(item.code)
    ),
    swingProfile: profile
  }));
  const engineWatchItems = filteredWatch.map(({ item, analysis }) => ({
    ...preserveSwingPickDates(
      toServerSwingPick(item, analysis, classifySwingCandidate(analysis)),
      existingPickBySymbol.get(item.code)
    ),
    swingProfile: profile
  }));
  const nextSymbols = new Set([...executionItems, ...engineWatchItems].map((item) => item.symbol));
  // 새 스캔에서 fresh setup이 안 잡혔다는 이유만으로 체결 케이스를
  // 덮어써서 없애면 안 됩니다. 실제 종료 조건 전까지 watchItems에 병합합니다.
  const carryForwardWatchItems = (await readSwingCarryForwardCases(profile))
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
