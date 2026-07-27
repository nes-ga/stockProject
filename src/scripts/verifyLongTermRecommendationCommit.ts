import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  updateLongTermRecommendationHistoryFromScan,
  type LongTermHistoryUpdateInput
} from "../services/longTermRecommendationHistory.js";
import {
  assertLongTermUniverseCommitSafety,
} from "../services/recommendationUniverse.js";
import {
  readServerLongTermPicks,
  withServerLongTermPicksMutation,
  writeServerLongTermPicks,
  type ServerLongTermPick
} from "../services/serverLongTermPicks.js";
import type { LongTermScanCandidate } from "../types.js";

function candidate(symbol: string): LongTermScanCandidate {
  return {
    symbol,
    name: `테스트-${symbol}`,
    price: 100,
    scores: {
      baseScore: 70,
      bonusScore: 5,
      rawScore: 75,
      totalScore: 75,
      leaderScore: 75,
      correctionScore: 75,
      trendScore: 70,
      liquidityScore: 70,
      stabilizationScore: 70,
      financialScore: 70
    },
    structure: {},
    baseStructure: {
      higherLowCount: 2,
      daysSinceLastLowBreak: 20,
      baseDurationDays: 60,
      timeSinceLastMajorLow: 80,
      isStabilizing: true
    },
    liquidity: {},
    candidateType: "leader",
    candidateGroup: "accumulate candidate",
    label: "base-forming candidate",
    reasonSummary: "verification fixture",
    strengths: [],
    weaknesses: [],
    failureReasons: [],
    tags: []
  };
}

function pick(symbol: string, date = "2026-07-27"): ServerLongTermPick {
  return {
    key: `test-${symbol}`,
    name: `테스트-${symbol}`,
    symbol,
    anchorDate: date,
    latestMentionDate: date,
    bucketEnteredDate: date,
    category: "longTerm",
    longTermBucket: "accumulate",
    source: "verification"
  };
}

async function main() {
  const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "stockmon-long-term-commit-"));
  const currentPath = path.join(temporaryDir, "server-long-term-picks.json");
  const invalidHistoryPath = path.join(temporaryDir, "invalid-history.json");
  const historyPath = path.join(temporaryDir, "long-term-history.json");
  const partialCurrentPath = path.join(temporaryDir, "partial-current.json");
  const partialHistoryPath = path.join(temporaryDir, "partial-history.json");
  const staleCurrentPath = path.join(temporaryDir, "stale-current.json");
  const staleHistoryPath = path.join(temporaryDir, "stale-history.json");
  const currentOptions = { filePath: currentPath };

  try {
    await writeServerLongTermPicks([pick("000000")], currentOptions);
    const currentBeforeFailure = await readFile(currentPath, "utf8");
    await writeFile(invalidHistoryPath, JSON.stringify({ schemaVersion: 999 }), "utf8");

    const scanInput: LongTermHistoryUpdateInput = {
      asOfDate: "2026-07-27",
      capturedAt: "2026-07-27T06:00:00.000Z",
      universeSize: 100,
      scanCompleteness: "complete",
      candidates: [candidate("000001")],
      currentPicks: [pick("000001")],
      scope: {
        mode: "full_universe"
      }
    };

    await assert.rejects(
      withServerLongTermPicksMutation(
        async () => {
          await updateLongTermRecommendationHistoryFromScan(scanInput, {
            filePath: invalidHistoryPath
          });
          return {
            nextItems: [pick("000001")],
            result: undefined
          };
        },
        currentOptions
      ),
      /Invalid long-term recommendation history/
    );
    assert.equal(await readFile(currentPath, "utf8"), currentBeforeFailure);

    const firstHistoryCommit = await updateLongTermRecommendationHistoryFromScan(scanInput, {
      filePath: historyPath
    });
    assert.equal(firstHistoryCommit.status, "applied");
    assert.deepEqual((await readServerLongTermPicks(currentOptions)).map((item) => item.symbol), ["000000"]);

    const retryCommit = await withServerLongTermPicksMutation(
      async () => {
        const historyRetry = await updateLongTermRecommendationHistoryFromScan(
          {
            ...scanInput,
            capturedAt: "2026-07-27T06:01:00.000Z"
          },
          { filePath: historyPath }
        );
        assert.equal(historyRetry.status, "deduplicated");
        return {
          nextItems: [pick("000001")],
          result: historyRetry
        };
      },
      currentOptions
    );
    assert.equal(retryCommit.result.status, "deduplicated");
    assert.deepEqual((await readServerLongTermPicks(currentOptions)).map((item) => item.symbol), ["000001"]);

    await writeServerLongTermPicks([], currentOptions);
    await Promise.all([
      withServerLongTermPicksMutation(
        async (previousItems) => {
          await delay(30);
          return {
            nextItems: [...previousItems, pick("000010")],
            result: undefined
          };
        },
        currentOptions
      ),
      withServerLongTermPicksMutation(
        async (previousItems) => ({
          nextItems: [...previousItems, pick("000020")],
          result: undefined
        }),
        currentOptions
      )
    ]);
    assert.deepEqual(
      (await readServerLongTermPicks(currentOptions)).map((item) => item.symbol),
      ["000010", "000020"]
    );

    const partialCurrentOptions = { filePath: partialCurrentPath };
    await writeServerLongTermPicks([pick("000030")], partialCurrentOptions);
    const partialCurrentBefore = await readFile(partialCurrentPath, "utf8");
    await assert.rejects(
      withServerLongTermPicksMutation(
        async (previousItems) => {
          assertLongTermUniverseCommitSafety(
            {
              asOfDate: "2026-07-27",
              scanCompleteness: "partial",
              attemptedCount: 100,
              succeededCount: 99,
              failedCount: 1
            },
            previousItems
          );
          await updateLongTermRecommendationHistoryFromScan(scanInput, {
            filePath: partialHistoryPath
          });
          return {
            nextItems: [pick("000031")],
            result: undefined
          };
        },
        partialCurrentOptions
      ),
      /scan is incomplete/
    );
    assert.equal(await readFile(partialCurrentPath, "utf8"), partialCurrentBefore);
    await assert.rejects(readFile(partialHistoryPath, "utf8"), { code: "ENOENT" });

    const staleCurrentOptions = { filePath: staleCurrentPath };
    await writeServerLongTermPicks([pick("000040", "2026-07-28")], staleCurrentOptions);
    const staleCurrentBefore = await readFile(staleCurrentPath, "utf8");
    await assert.rejects(
      withServerLongTermPicksMutation(
        async (previousItems) => {
          assertLongTermUniverseCommitSafety(
            {
              asOfDate: "2026-07-27",
              scanCompleteness: "complete",
              attemptedCount: 100,
              succeededCount: 100,
              failedCount: 0
            },
            previousItems
          );
          await updateLongTermRecommendationHistoryFromScan(scanInput, {
            filePath: staleHistoryPath
          });
          return {
            nextItems: [pick("000041")],
            result: undefined
          };
        },
        staleCurrentOptions
      ),
      /older than current recommendations/
    );
    assert.equal(await readFile(staleCurrentPath, "utf8"), staleCurrentBefore);
    await assert.rejects(readFile(staleHistoryPath, "utf8"), { code: "ENOENT" });
    assert.doesNotThrow(() =>
      assertLongTermUniverseCommitSafety(
        {
          asOfDate: "2026-07-28",
          scanCompleteness: "complete",
          attemptedCount: 100,
          succeededCount: 100,
          failedCount: 0
        },
        [pick("000042", "2026-07-28")]
      )
    );
    assert.throws(
      () =>
        assertLongTermUniverseCommitSafety({
          asOfDate: "2026-07-28",
          scanCompleteness: "complete",
          attemptedCount: 0,
          succeededCount: 0,
          failedCount: 0
        }),
      /scan is incomplete/
    );

    console.log(
      JSON.stringify({
        ok: true,
        historyFailurePreservedCurrent: true,
        retryDeduplicatedHistory: true,
        concurrentCurrentCount: 2,
        partialScanPreservedCurrentAndHistory: true,
        staleInitialCommitPreservedCurrentAndHistory: true,
        sameDateCommitAllowed: true
      })
    );
  } finally {
    await rm(temporaryDir, {
      recursive: true,
      force: true
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
