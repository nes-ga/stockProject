import { scanDividendUniverse } from "./dividendEngine.js";
import { scanLongTermUniverse } from "./longTermEngine.js";
import { writeServerDividendPicks } from "./serverDividendPicks.js";
import { writeServerLongTermPicks } from "./serverLongTermPicks.js";
import { writeServerSwingPicks } from "./serverSwingPicks.js";
import { analyzeSmartMoneyPattern } from "./stockAnalysis.js";
import { getStockUniverse } from "./stockUniverse.js";
import { getTradingHaltLookup } from "./tradingHalts.js";

const SWING_TARGET_MARKETS = new Set(["KOSPI", "KOSDAQ"]);
const SWING_CHUNK_SIZE = 8;

type RecommendationUniverseCategory = "longTerm" | "dividend" | "swing";
type UniverseItem = Awaited<ReturnType<typeof getStockUniverse>>["items"][number];
type SmartMoneyAnalysis = Awaited<ReturnType<typeof analyzeSmartMoneyPattern>>;
type DividendScanResult = Awaited<ReturnType<typeof scanDividendUniverse>>;
type DividendUniverseCandidate = DividendScanResult["candidates"][number];
type LongTermScanResult = Awaited<ReturnType<typeof scanLongTermUniverse>>;
type LongTermUniverseCandidate = LongTermScanResult["candidates"][number];

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
    };

const activeScanByCategory = new Map<RecommendationUniverseCategory, Promise<RecommendationUniverseScanResult>>();

function formatLongTermNoteLabel(label: LongTermUniverseCandidate["label"]) {
  switch (label) {
    case "leader correction watch":
      return "대표주 조정 관찰";
    case "deep value review":
      return "깊은 조정 재검토";
    case "base-forming candidate":
      return "베이스 형성 후보";
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

function buildSwingNote(pattern: SmartMoneyAnalysis["pattern"]) {
  const stageLabel =
    pattern.status === "breakout_extended"
      ? "스윙 추격 금지 감지"
      : pattern.stage === "breakout"
        ? "스윙 완성형 감지"
        : pattern.status === "buy_ready"
          ? "스윙 1차매수 구간 감지"
          : "스윙 소화형 감지";
  const buyPlanText = pattern.buyPlan
    ? `매수 ${Math.round(pattern.buyPlan.firstBuyPrice)}/${Math.round(pattern.buyPlan.secondBuyPrice)}/${Math.round(pattern.buyPlan.thirdBuyPrice)}`
    : `매수 ${pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneLow)}~${Math.round(pattern.entryZoneHigh)}` : "-"}`;
  const displayEntryZoneText =
    pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneHigh)}~${Math.round(pattern.entryZoneLow)}` : "-";
  const displayBuyPlanText = pattern.buyPlan
    ? buyPlanText
    : `${pattern.stage === "breakout" ? "관찰" : "구간"} ${pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneLow)}~${Math.round(pattern.entryZoneHigh)}` : "-"}`;
  const resolvedDisplayBuyPlanText = pattern.buyPlan
    ? buyPlanText
    : `${pattern.stage === "breakout" ? "관찰" : "구간"} ${displayEntryZoneText}`;
  const resolvedStopPrice = pattern.buyPlan?.stopLossPrice ?? pattern.invalidationPrice;
  const stopText = `손절 ${resolvedStopPrice != null && resolvedStopPrice > 0 ? Math.round(resolvedStopPrice) : "-"}`;
  const stopRefText = `손절기준 ${pattern.stopLossReferenceDate ?? "-"} ${pattern.stopLossReferenceType === "close_fallback" ? "close" : "low"}`;

  return [
    stageLabel,
    `선행 수급 ${pattern.leadInDate ?? "-"}`,
    `급등 피크 ${pattern.surgePeakDate ?? pattern.breakoutDate ?? "-"}`,
    `눌림 ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
    `SMA20 ${pattern.referenceSma20 != null ? Math.round(pattern.referenceSma20) : "-"}`,
    resolvedDisplayBuyPlanText,
    stopText,
    stopRefText,
    `점수 ${pattern.finalRankScore ?? pattern.patternScore}`
  ].join(" | ");
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
    anchorDate:
      analysis.pattern.stage === "breakout"
        ? analysis.pattern.breakoutDate ?? analysis.tradingReferenceDate
        : analysis.tradingReferenceDate,
    note: buildSwingNote(analysis.pattern),
    bucket: classification.bucket,
    tags: classification.tags,
    reasons: classification.reasons,
    penaltyFactors: classification.penaltyFactors,
    haltCategory: analysis.haltCategory,
    haltAction: analysis.haltAction,
    category: "swing" as const,
    source: "server-universe" as const
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
  const withinEntryZone = isWithinSwingEntryZone(pattern);
  const weakVolumeContraction = pattern.stage === "setup" && (pattern.volumeContractionScore ?? 0) < 60;
  const poorCandleStructure = (pattern.candleQualityScore ?? 100) < 60;
  const negativeSma20Slope = (pattern.sma20SlopePercent ?? 0) < 0;
  const unstableSupport = (pattern.supportStabilityScore ?? 100) < 60 || pattern.debugInfo.supportStatus !== "holding";
  const weakRiskReward = riskRewardRatio > 0 && riskRewardRatio < 1.8;
  const haltWatchOnly = analysis.haltAction === "watch_only";
  const haltPenalty = analysis.haltAction === "allow_with_penalty";
  const lowQuality = weakVolumeContraction || poorCandleStructure || negativeSma20Slope || unstableSupport || weakRiskReward;
  const readyByEngine = pattern.actionable && !haltWatchOnly && !haltPenalty;
  const probeByLocation = pattern.matched && withinEntryZone && !haltWatchOnly;

  if (readyByEngine && !lowQuality) {
    return {
      bucket: "execution_ready",
      reasons: dedupeStrings([...(pattern.classificationReasons ?? []), "execution_ready", "actionable_gate_cleared"]),
      tags: dedupeStrings([...(pattern.tags ?? [])]),
      penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
    };
  }

  if (probeByLocation) {
    const probeReasons = dedupeStrings([
      ...(pattern.classificationReasons ?? []),
      "entryZone_hit",
      readyByEngine ? "execution_ready_blocked_by_quality" : "execution_gate_not_cleared",
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
      tags: dedupeStrings([...(pattern.tags ?? [])]),
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
      pattern.stage === "setup" && !withinEntryZone ? "pullback_pending" : "",
      lowQuality ? "quality_not_ready" : "",
      haltPenalty ? "halt_penalty_active" : "",
      haltWatchOnly ? "halt_watch_only" : ""
    ]),
    tags: dedupeStrings(watchTags),
    penaltyFactors: summarizePenaltyFactors(pattern.penaltyFactors)
  };
}

export function isSwingExecutionEligible(pattern: SmartMoneyAnalysis["pattern"], analysis?: SmartMoneyAnalysis) {
  if (!analysis) {
    return pattern.actionable || isWithinSwingEntryZone(pattern);
  }

  return classifySwingCandidate(analysis).bucket !== "watch";
}

function isSwingWatchEligible(analysis: SmartMoneyAnalysis) {
  return analysis.pattern.matched && analysis.pattern.status !== "pullback_early" && classifySwingCandidate(analysis).bucket === "watch";
}

async function scanSwingChunk(chunk: UniverseItem[]) {
  const settled = await Promise.allSettled(
    chunk.map(async (item) => ({
      item,
      analysis: await analyzeSmartMoneyPattern({
        symbol: item.code,
        name: item.name
      })
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

      const classification = classifySwingCandidate(result.value.analysis);
      if (classification.bucket !== "watch") {
        actionable.push(result.value);
      } else if (isSwingWatchEligible(result.value.analysis)) {
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

async function scanAndSaveSwingUniverse(): Promise<RecommendationUniverseScanResult> {
  const universe = await getStockUniverse({ forceRefresh: true });
  const targets = universe.items.filter((item) => SWING_TARGET_MARKETS.has(item.market));
  const tradingHaltLookup = await getTradingHaltLookup({ forceRefresh: true });
  const activeTargets = targets.filter((item) => tradingHaltLookup.get(item.code)?.haltAction !== "exclude");
  const actionable: SwingScanRankedItem[] = [];
  const watch: SwingScanRankedItem[] = [];
  let failures = 0;

  for (let index = 0; index < activeTargets.length; index += SWING_CHUNK_SIZE) {
    const chunk = activeTargets.slice(index, index + SWING_CHUNK_SIZE);
    const result = await scanSwingChunk(chunk);
    actionable.push(...result.actionable);
    watch.push(...result.watch);
    failures += result.failures;
  }

  actionable.sort(compareSwingAnalyses);
  watch.sort(compareSwingAnalyses);

  const payload = await writeServerSwingPicks({
    executionItems: actionable.map(({ item, analysis }) => toServerSwingPick(item, analysis, classifySwingCandidate(analysis))),
    watchItems: watch.map(({ item, analysis }) => toServerSwingPick(item, analysis, classifySwingCandidate(analysis)))
  });

  return {
    category: "swing",
    count: payload.items.length,
    executionCount: payload.executionItems.length,
    watchCount: payload.watchItems.length,
    universeSize: targets.length,
    failureCount: failures,
    items: payload.items,
    executionItems: payload.executionItems,
    watchItems: payload.watchItems
  };
}

export async function scanRecommendationUniverse(category: RecommendationUniverseCategory): Promise<RecommendationUniverseScanResult> {
  const existing = activeScanByCategory.get(category);
  if (existing) {
    return existing;
  }

  const nextScan = (
    category === "longTerm"
      ? scanAndSaveLongTermUniverse()
      : category === "dividend"
        ? scanAndSaveDividendUniverse()
        : scanAndSaveSwingUniverse()
  ).finally(() => {
    activeScanByCategory.delete(category);
  });

  activeScanByCategory.set(category, nextScan);
  return nextScan;
}
