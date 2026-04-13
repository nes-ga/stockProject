import { scanDividendUniverse } from "./dividendEngine.js";
import { scanLongTermUniverse } from "./longTermEngine.js";
import { writeServerDividendPicks } from "./serverDividendPicks.js";
import { writeServerLongTermPicks } from "./serverLongTermPicks.js";
import { writeServerSwingPicks } from "./serverSwingPicks.js";
import { analyzeSmartMoneyPattern } from "./stockAnalysis.js";
import { getStockUniverse } from "./stockUniverse.js";

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

  return [groupLabel, formatLongTermNoteLabel(candidate.label), ...buildLongTermHighlights(candidate)].join(" | ");
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
  const resolvedStopPrice = pattern.buyPlan?.stopLossPrice ?? pattern.invalidationPrice;
  const stopText = `손절 ${resolvedStopPrice != null && resolvedStopPrice > 0 ? Math.round(resolvedStopPrice) : "-"}`;
  const stopRefText = `손절기준 ${pattern.stopLossReferenceDate ?? "-"} ${pattern.stopLossReferenceType === "close_fallback" ? "close" : "low"}`;

  return [
    stageLabel,
    `선행 수급 ${pattern.leadInDate ?? "-"}`,
    `급등 피크 ${pattern.surgePeakDate ?? pattern.breakoutDate ?? "-"}`,
    `눌림 ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
    `SMA20 ${pattern.referenceSma20 != null ? Math.round(pattern.referenceSma20) : "-"}`,
    buyPlanText,
    stopText,
    stopRefText,
    `점수 ${pattern.finalRankScore ?? pattern.patternScore}`
  ].join(" | ");
}

function toServerSwingPick(item: UniverseItem, analysis: SmartMoneyAnalysis) {
  return {
    key: `${item.name}-${item.code}`,
    name: item.name,
    symbol: item.code,
    anchorDate:
      analysis.pattern.stage === "breakout"
        ? analysis.pattern.breakoutDate ?? analysis.tradingReferenceDate
        : analysis.tradingReferenceDate,
    note: buildSwingNote(analysis.pattern),
    bucket: analysis.pattern.actionable ? ("execution" as const) : ("watch" as const),
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

function isSwingWatchEligible(pattern: SmartMoneyAnalysis["pattern"]) {
  return pattern.matched && pattern.status !== "pullback_early";
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
      if (result.value.analysis.pattern.actionable) {
        actionable.push(result.value);
      } else if (isSwingWatchEligible(result.value.analysis.pattern)) {
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
  const actionable: SwingScanRankedItem[] = [];
  const watch: SwingScanRankedItem[] = [];
  let failures = 0;

  for (let index = 0; index < targets.length; index += SWING_CHUNK_SIZE) {
    const chunk = targets.slice(index, index + SWING_CHUNK_SIZE);
    const result = await scanSwingChunk(chunk);
    actionable.push(...result.actionable);
    watch.push(...result.watch);
    failures += result.failures;
  }

  actionable.sort(compareSwingAnalyses);
  watch.sort(compareSwingAnalyses);

  const payload = await writeServerSwingPicks({
    executionItems: actionable.map(({ item, analysis }) => toServerSwingPick(item, analysis)),
    watchItems: watch.map(({ item, analysis }) => toServerSwingPick(item, analysis))
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
