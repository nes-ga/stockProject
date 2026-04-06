import { analyzeSmartMoneyPatterns } from "../src/services/stockAnalysis.js";
import { readServerSwingPicks, writeServerSwingPicks } from "../src/services/serverSwingPicks.js";

type Pattern = Awaited<ReturnType<typeof analyzeSmartMoneyPatterns>>[number]["pattern"];

function buildNote(name: string, pattern: Pattern) {
  if (pattern.stage === "breakout") {
    return [
      "\uC2A4\uC719 \uC644\uC131\uD615 \uAC10\uC9C0",
      `\uC120\uD589 \uC218\uAE09 ${pattern.leadInDate ?? "-"}`,
      `\uB20C\uB9BC ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
      `\uB3CC\uD30C ${pattern.breakoutDate ?? "-"}`,
      `\uC810\uC218 ${pattern.patternScore}`
    ].join(" | ");
  }

  if (pattern.stage === "setup") {
    return [
      "\uC2A4\uC719 \uC18C\uD654\uD615 \uAC10\uC9C0",
      `\uC120\uD589 \uC218\uAE09 ${pattern.leadInDate ?? "-"}`,
      `\uAE09\uB4F1 \uD53C\uD06C ${pattern.surgePeakDate ?? "-"}`,
      `\uB20C\uB9BC ${pattern.pullbackStartDate ?? "-"}~${pattern.pullbackEndDate ?? "-"}`,
      `\uD604\uC7AC ${pattern.referenceDate}`,
      `\uC810\uC218 ${pattern.patternScore}`
    ].join(" | ");
  }

  return `${name} \uC2A4\uC719 \uD328\uD134 \uBBF8\uCDA9\uC871`;
}

async function main() {
  const current = await readServerSwingPicks();
  if (!current.length) {
    console.log("No existing server swing picks to refresh.");
    return;
  }

  const analyses = await analyzeSmartMoneyPatterns(
    current.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      note: item.note
    }))
  );

  const filtered = analyses
    .filter((analysis) => analysis.pattern.matched)
    .sort((left, right) => {
      const leftRank = left.pattern.stage === "breakout" ? 2 : left.pattern.stage === "setup" ? 1 : 0;
      const rightRank = right.pattern.stage === "breakout" ? 2 : right.pattern.stage === "setup" ? 1 : 0;
      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }
      if (left.pattern.patternScore !== right.pattern.patternScore) {
        return right.pattern.patternScore - left.pattern.patternScore;
      }
      return right.tradingReferenceDate.localeCompare(left.tradingReferenceDate);
    })
    .map((analysis) => ({
      key: `${analysis.name ?? analysis.symbol}-${analysis.symbol}`,
      name: analysis.name ?? analysis.symbol,
      symbol: analysis.symbol,
      anchorDate:
        analysis.pattern.stage === "breakout"
          ? analysis.pattern.breakoutDate ?? analysis.tradingReferenceDate
          : analysis.tradingReferenceDate,
      note: buildNote(analysis.name ?? analysis.symbol, analysis.pattern),
      category: "swing" as const
    }));

  await writeServerSwingPicks(filtered);

  console.log(`Refreshed server swing picks: ${filtered.length} matched / ${current.length} scanned`);
  for (const item of filtered) {
    console.log(`- ${item.name} (${item.symbol}) :: ${item.note}`);
  }

  const removed = current.filter((item) => !filtered.some((next) => next.symbol === item.symbol));
  if (removed.length) {
    console.log("Removed from batch:");
    for (const item of removed) {
      console.log(`- ${item.name} (${item.symbol})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
