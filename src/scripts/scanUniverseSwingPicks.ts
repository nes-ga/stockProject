import { writeServerSwingPicks } from "../services/serverSwingPicks.js";
import { analyzeSmartMoneyPattern } from "../services/stockAnalysis.js";
import { getStockUniverse } from "../services/stockUniverse.js";

const TARGET_MARKETS = new Set(["KOSPI", "KOSDAQ"]);
const CHUNK_SIZE = 8;

type UniverseItem = Awaited<ReturnType<typeof getStockUniverse>>["items"][number];

function buildNote(pattern: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>>["pattern"]) {
  const stageLabel =
    pattern.stage === "breakout" ? "\uC2A4\uC719 \uC644\uC131\uD615 \uAC10\uC9C0" : "\uC2A4\uC719 \uC18C\uD654\uD615 \uAC10\uC9C0";
  const buyPlanText = pattern.buyPlan
    ? `\uB9E4\uC218 ${Math.round(pattern.buyPlan.firstBuyPrice)}/${Math.round(pattern.buyPlan.secondBuyPrice)}/${Math.round(pattern.buyPlan.thirdBuyPrice)}`
    : `\uB9E4\uC218 ${pattern.entryZoneLow != null && pattern.entryZoneHigh != null ? `${Math.round(pattern.entryZoneLow)}~${Math.round(pattern.entryZoneHigh)}` : "-"}`;
  const resolvedStopPrice = pattern.buyPlan?.stopLossPrice ?? pattern.invalidationPrice;
  const stopText = `\uC190\uC808 ${resolvedStopPrice != null && resolvedStopPrice > 0 ? Math.round(resolvedStopPrice) : "-"}`;

  return [
    stageLabel,
    `\uC120\uD589 \uC218\uAE09 ${pattern.leadInDate ?? "-"}`,
    `\uAE09\uB4F1 \uD53C\uD06C ${pattern.surgePeakDate ?? pattern.breakoutDate ?? "-"}`,
    `\uB20C\uB9BC ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
    buyPlanText,
    stopText,
    `\uC810\uC218 ${pattern.finalRankScore ?? pattern.patternScore}`
  ].join(" | ");
}

function toServerSwingPick(item: UniverseItem, analysis: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>>) {
  return {
    key: `${item.name}-${item.code}`,
    name: item.name,
    symbol: item.code,
    anchorDate:
      analysis.pattern.stage === "breakout"
        ? analysis.pattern.breakoutDate ?? analysis.tradingReferenceDate
        : analysis.tradingReferenceDate,
    note: buildNote(analysis.pattern),
    category: "swing" as const
  };
}

function compareAnalyses(
  left: { item: UniverseItem; analysis: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>> },
  right: { item: UniverseItem; analysis: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>> }
) {
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

async function scanChunk(chunk: UniverseItem[]) {
  const settled = await Promise.allSettled(
    chunk.map(async (item) => ({
      item,
      analysis: await analyzeSmartMoneyPattern({
        symbol: item.code,
        name: item.name
      })
    }))
  );

  const matched: Array<{ item: UniverseItem; analysis: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>> }> = [];
  let failures = 0;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value.analysis.pattern.matched) {
        matched.push(result.value);
      }
    } else {
      failures += 1;
    }
  }

  return {
    matched,
    failures
  };
}

async function main() {
  const universe = await getStockUniverse({ forceRefresh: true });
  const targets = universe.items.filter((item) => TARGET_MARKETS.has(item.market));
  const matched: Array<{ item: UniverseItem; analysis: Awaited<ReturnType<typeof analyzeSmartMoneyPattern>> }> = [];
  let failures = 0;

  console.log(`Scanning ${targets.length} symbols across KOSPI/KOSDAQ with chunk size ${CHUNK_SIZE}...`);

  for (let index = 0; index < targets.length; index += CHUNK_SIZE) {
    const chunk = targets.slice(index, index + CHUNK_SIZE);
    const result = await scanChunk(chunk);
    matched.push(...result.matched);
    failures += result.failures;
    console.log(
      `Processed ${Math.min(index + chunk.length, targets.length)}/${targets.length} | matched ${matched.length} | failures ${failures}`
    );
  }

  matched.sort(compareAnalyses);

  const items = matched.map(({ item, analysis }) => toServerSwingPick(item, analysis));
  await writeServerSwingPicks(items);

  console.log(`Completed universe scan: ${items.length} matched / ${targets.length} scanned / ${failures} failed`);
  for (const item of items.slice(0, 30)) {
    console.log(`- ${item.name} (${item.symbol}) :: ${item.note}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
