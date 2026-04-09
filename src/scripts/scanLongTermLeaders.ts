import { scanLongTermLeaders } from "../services/longTermEngine.js";

function printCandidateSection(title: string, candidates: Awaited<ReturnType<typeof scanLongTermLeaders>>["candidates"]) {
  console.log(`${title}: ${candidates.length}`);
  for (const candidate of candidates) {
    console.log(
      `- ${candidate.name} (${candidate.symbol}) | ${candidate.label} | total=${candidate.scores.totalScore} | drawdown=${candidate.drawdownPct ?? "-"}% | ${candidate.reasonSummary}`
    );
  }
}

async function main() {
  const result = await scanLongTermLeaders({
    forceRefreshUniverse: true
  });

  console.log(`Long-term leader scan completed: ${result.candidates.length} candidates from ${result.universeSize} seeds as of ${result.asOfDate}`);
  printCandidateSection("Buy candidates", result.groupedCandidates.buyCandidates);
  printCandidateSection("Watch candidates", result.groupedCandidates.watchCandidates);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
