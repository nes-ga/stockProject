import { scanRecommendationUniverse } from "../services/recommendationUniverse.js";

async function main() {
  const result = await scanRecommendationUniverse("longTerm");
  if (result.category !== "longTerm") {
    throw new Error("Unexpected scan result category.");
  }

  console.log(
    `Long-term universe v2 scan completed: ${result.count} candidates from ${result.universeSize} symbols as of ${result.asOfDate}`
  );
  console.log(`Buy candidates: ${result.buyCount}`);
  console.log(`Accumulate candidates: ${result.accumulateCount}`);
  console.log(`Watch candidates: ${result.watchCount}`);
  if (result.historyUpdated) {
    console.log(
      `Long-term history updated: ${result.historyUpdate?.caseCount ?? 0} cases (${result.historyUpdate?.startedCaseCount ?? 0} started)`
    );
  } else {
    console.warn(`Long-term history update skipped or failed: ${result.historyUpdateError ?? "unknown reason"}`);
  }

  for (const item of result.items.slice(0, 30)) {
    console.log(
      `- ${item.name} (${item.symbol}) | ${
        item.longTermBucket === "watch"
          ? "watch candidate"
          : item.longTermBucket === "accumulate"
            ? "accumulate candidate"
            : "buy candidate"
      } | ${item.note ?? ""}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
