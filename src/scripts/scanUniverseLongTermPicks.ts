import { scanLongTermUniverse } from "../services/longTermEngine.js";
import { writeServerLongTermPicks } from "../services/serverLongTermPicks.js";

function buildNote(candidate: Awaited<ReturnType<typeof scanLongTermUniverse>>["candidates"][number]) {
  const groupLabel = candidate.candidateGroup === "buy candidate" ? "중장기 매수 가능 후보군" : "중장기 관찰 후보군";

  return [
    groupLabel,
    candidate.label,
    `drawdown ${candidate.drawdownPct != null ? `${candidate.drawdownPct}%` : "-"}`,
    `total ${candidate.scores.totalScore}`,
    `leader ${candidate.scores.leaderScore}`,
    `correction ${candidate.scores.correctionScore}`,
    `trend ${candidate.scores.trendScore}`,
    `stabilization ${candidate.scores.stabilizationScore}`,
    `financial ${candidate.scores.financialScore}`,
    candidate.reasonSummary
  ].join(" | ");
}

async function main() {
  const result = await scanLongTermUniverse({
    forceRefreshUniverse: true
  });

  const items = result.candidates.map((candidate) => ({
    key: `${candidate.name}-${candidate.symbol}`,
    name: candidate.name,
    symbol: candidate.symbol,
    anchorDate: result.asOfDate,
    note: buildNote(candidate),
    category: "longTerm" as const
  }));

  await writeServerLongTermPicks(items);

  console.log(
    `Long-term universe v2 scan completed: ${items.length} candidates from ${result.universeSize} symbols as of ${result.asOfDate}`
  );
  console.log(`Buy candidates: ${result.groupedCandidates.buyCandidates.length}`);
  console.log(`Watch candidates: ${result.groupedCandidates.watchCandidates.length}`);

  for (const candidate of result.candidates.slice(0, 30)) {
    console.log(
      `- ${candidate.name} (${candidate.symbol}) | ${candidate.candidateGroup} | ${candidate.label} | total=${candidate.scores.totalScore} | ${candidate.reasonSummary}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
