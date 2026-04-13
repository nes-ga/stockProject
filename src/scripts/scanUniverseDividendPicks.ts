import { scanRecommendationUniverse } from "../services/recommendationUniverse.js";

async function main() {
  const result = await scanRecommendationUniverse("dividend");
  if (result.category !== "dividend") {
    throw new Error("Unexpected scan result category.");
  }

  console.log(
    `Dividend universe scan completed: ${result.count} candidates from ${result.universeSize} symbols as of ${result.asOfDate}`
  );
  console.log(`Dividend candidates: ${result.buyCount}`);
  console.log(`Watch candidates: ${result.watchCount}`);

  for (const item of result.items.slice(0, 30)) {
    console.log(`- ${item.name} (${item.symbol}) | ${item.longTermBucket === "watch" ? "watch" : "buy"} | ${item.note ?? ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
