import { scanRecommendationUniverse } from "../services/recommendationUniverse.js";

async function main() {
  const result = await scanRecommendationUniverse("swing");
  if (result.category !== "swing") {
    throw new Error("Unexpected scan result category.");
  }

  console.log(
    `Completed universe scan: ${result.executionCount} actionable / ${result.watchCount} watch / ${result.universeSize} scanned / ${result.failureCount} failed`
  );

  for (const item of result.executionItems.slice(0, 30)) {
    console.log(`- ${item.name} (${item.symbol}) :: ${item.note}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
