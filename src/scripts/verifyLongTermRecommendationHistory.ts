import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  closeLongTermRecommendationHistoryCase,
  readLongTermRecommendationHistory,
  updateLongTermRecommendationHistoryFromScan
} from "../services/longTermRecommendationHistory.js";
import type { ServerLongTermPick } from "../services/serverLongTermPicks.js";
import type { LongTermCandidateGroup, LongTermScanCandidate } from "../types.js";

function createCandidate(
  symbol: string,
  price: number,
  candidateGroup: LongTermCandidateGroup
): LongTermScanCandidate {
  return {
    symbol,
    name: `테스트-${symbol}`,
    price,
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
    candidateGroup,
    label:
      candidateGroup === "buy candidate"
        ? "contrarian accumulation candidate"
        : candidateGroup === "accumulate candidate"
          ? "base-forming candidate"
          : "needs more stabilization",
    reasonSummary: "verification fixture",
    strengths: [],
    weaknesses: [],
    failureReasons: [],
    tags: []
  };
}

function fullScanInput(params: {
  asOfDate: string;
  capturedAt: string;
  candidates: LongTermScanCandidate[];
  scanId?: string;
}) {
  return {
    asOfDate: params.asOfDate,
    capturedAt: params.capturedAt,
    universeSize: 100,
    candidates: params.candidates,
    scanId: params.scanId,
    scanCompleteness: "complete" as const,
    scope: {
      mode: "full_universe" as const
    }
  };
}

function createCurrentPick(
  symbol: string,
  anchorDate: string,
  key = `테스트-${symbol}`
): ServerLongTermPick {
  return {
    key,
    name: `테스트-${symbol}`,
    symbol,
    anchorDate,
    latestMentionDate: anchorDate,
    bucketEnteredDate: anchorDate,
    category: "longTerm",
    longTermBucket: "accumulate",
    source: "verification"
  };
}

async function main() {
  const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "stockmon-long-term-history-"));
  const filePath = path.join(temporaryDir, "long-term-history.json");
  const recurrenceFilePath = path.join(temporaryDir, "recurrence-history.json");
  const chronologyFilePath = path.join(temporaryDir, "chronology-history.json");
  const identityFilePath = path.join(temporaryDir, "identity-history.json");
  const partialScopeFilePath = path.join(temporaryDir, "partial-scope-history.json");

  try {
    const watchInput = fullScanInput({
      asOfDate: "2026-07-24",
      capturedAt: "2026-07-24T06:00:00.000Z",
      candidates: [createCandidate("000001", 100, "watch candidate")]
    });
    const watchOnly = await updateLongTermRecommendationHistoryFromScan(watchInput, { filePath });
    assert.equal(watchOnly.status, "applied");
    assert.equal(watchOnly.caseCount, 0);
    assert.equal(watchOnly.skippedWatchCount, 1);

    const watchRetry = await updateLongTermRecommendationHistoryFromScan(
      {
        ...watchInput,
        capturedAt: "2026-07-24T06:01:00.000Z"
      },
      { filePath }
    );
    assert.equal(watchRetry.status, "deduplicated");
    const afterWatchRetry = await readLongTermRecommendationHistory({ filePath });
    assert.equal(afterWatchRetry.appliedScans.length, 1);
    assert.equal(afterWatchRetry.generatedAt, "2026-07-24T06:00:00.000Z");

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-07-25",
        capturedAt: "2026-07-25T06:00:00.000Z",
        candidates: [createCandidate("000001", 100, "accumulate candidate")]
      }),
      { filePath }
    );
    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-07-26",
        capturedAt: "2026-07-26T06:00:00.000Z",
        candidates: [createCandidate("000001", 110, "buy candidate")]
      }),
      { filePath }
    );

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-07-27",
        capturedAt: "2026-07-27T06:00:00.000Z",
        candidates: []
      }),
      { filePath }
    );
    const firstStale = await readLongTermRecommendationHistory({ filePath });
    assert.equal(firstStale.cases[0]?.status, "stale");
    assert.equal(firstStale.cases[0]?.staleSinceDate, "2026-07-27");
    assert.equal(firstStale.cases[0]?.consecutiveMissCount, 1);
    assert.equal(firstStale.cases[0]?.events.at(-1)?.type, "stale_marked");
    const staleEventCount = firstStale.cases[0]?.events.length;

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-07-28",
        capturedAt: "2026-07-28T06:00:00.000Z",
        candidates: []
      }),
      { filePath }
    );
    const repeatedStale = await readLongTermRecommendationHistory({ filePath });
    assert.equal(repeatedStale.cases[0]?.status, "stale");
    assert.equal(repeatedStale.cases[0]?.consecutiveMissCount, 2);
    assert.equal(repeatedStale.cases[0]?.events.length, staleEventCount);

    const reobserveInput = fullScanInput({
      asOfDate: "2026-07-29",
      capturedAt: "2026-07-29T06:00:00.000Z",
      candidates: [createCandidate("000001", 105, "watch candidate")]
    });
    await updateLongTermRecommendationHistoryFromScan(reobserveInput, { filePath });
    const reobserved = await readLongTermRecommendationHistory({ filePath });
    assert.equal(reobserved.cases[0]?.status, "current");
    assert.equal(reobserved.cases[0]?.entryBucket, "accumulate");
    assert.equal(reobserved.cases[0]?.lastObservedBucket, "watch");
    assert.equal(reobserved.cases[0]?.initialReferencePrice, 100);
    assert.equal(reobserved.cases[0]?.lastObservedPrice, 105);
    assert.equal(reobserved.cases[0]?.returnMetrics.latestSignalReturnPct, 5);
    assert.equal(reobserved.cases[0]?.events.at(-1)?.type, "reobserved");
    assert.equal(reobserved.cases[0]?.modelPosition.availableNow, null);

    const eventCountBeforeRetry = reobserved.strategySummary.eventCount;
    const reobserveRetry = await updateLongTermRecommendationHistoryFromScan(
      {
        ...reobserveInput,
        capturedAt: "2026-07-29T06:01:00.000Z"
      },
      { filePath }
    );
    assert.equal(reobserveRetry.status, "deduplicated");
    assert.equal(
      (await readLongTermRecommendationHistory({ filePath })).strategySummary.eventCount,
      eventCountBeforeRetry
    );

    const rawBeforeStaleScan = await readFile(filePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        fullScanInput({
          asOfDate: "2026-07-28",
          capturedAt: "2026-07-29T07:00:00.000Z",
          candidates: [createCandidate("000001", 90, "accumulate candidate")]
        }),
        { filePath }
      ),
      /Stale long-term scan rejected/
    );
    assert.equal(await readFile(filePath, "utf8"), rawBeforeStaleScan);

    const firstCaseId = reobserved.cases[0]?.id;
    assert.ok(firstCaseId);
    const closeInput = {
      caseId: firstCaseId,
      closedDate: "2026-07-30",
      closedAt: "2026-07-30T06:00:00.000Z",
      closeId: "verify-close-1",
      outcomeType: "manual_close" as const,
      category: "neutral" as const,
      reason: "verification close",
      policyVersion: "verify-policy-v1",
      provenance: "manual" as const
    };
    const closeResult = await closeLongTermRecommendationHistoryCase(closeInput, { filePath });
    assert.equal(closeResult.status, "closed");
    const closeRetry = await closeLongTermRecommendationHistoryCase(closeInput, { filePath });
    assert.equal(closeRetry.status, "deduplicated");

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-07-31",
        capturedAt: "2026-07-31T06:00:00.000Z",
        candidates: [createCandidate("000001", 102, "accumulate candidate")]
      }),
      { filePath }
    );
    const newCycle = await readLongTermRecommendationHistory({ filePath });
    assert.deepEqual(
      newCycle.cases
        .filter((historyCase) => historyCase.symbol === "000001")
        .map((historyCase) => [historyCase.cycleNo, historyCase.status]),
      [
        [1, "closed"],
        [2, "current"]
      ]
    );
    assert.equal(newCycle.cases[0]?.initialReferencePrice, 100);
    assert.equal(newCycle.cases[1]?.initialReferencePrice, 102);

    const explicitScanId = "verify-conflict-scan";
    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-08-01",
        capturedAt: "2026-08-01T06:00:00.000Z",
        candidates: [createCandidate("000002", 200, "accumulate candidate")],
        scanId: explicitScanId
      }),
      { filePath }
    );
    const rawBeforeConflict = await readFile(filePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        fullScanInput({
          asOfDate: "2026-08-01",
          capturedAt: "2026-08-01T06:01:00.000Z",
          candidates: [createCandidate("000003", 300, "buy candidate")],
          scanId: explicitScanId
        }),
        { filePath }
      ),
      /scanId conflict/
    );
    assert.equal(await readFile(filePath, "utf8"), rawBeforeConflict);

    const finalPayload = await readLongTermRecommendationHistory({ filePath });
    assert.equal(finalPayload.commonSummary.caseCount, 3);
    assert.equal(finalPayload.commonSummary.openCaseCount, 2);
    assert.equal(finalPayload.commonSummary.closedCaseCount, 1);
    assert.doesNotThrow(() => JSON.parse(rawBeforeConflict));

    const rawBeforeSameDayRollback = await readFile(filePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        fullScanInput({
          asOfDate: "2026-08-01",
          capturedAt: "2026-08-01T05:59:00.000Z",
          candidates: [createCandidate("000004", 400, "accumulate candidate")]
        }),
        { filePath }
      ),
      /Out-of-order long-term scan rejected/
    );
    assert.equal(await readFile(filePath, "utf8"), rawBeforeSameDayRollback);

    const recurringCandidate = createCandidate("009999", 100, "accumulate candidate");
    const firstRecurringScan = await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-09-04",
        capturedAt: "2026-09-04T06:00:00.000Z",
        candidates: [recurringCandidate]
      }),
      { filePath: recurrenceFilePath }
    );
    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-09-04",
        capturedAt: "2026-09-04T07:00:00.000Z",
        candidates: []
      }),
      { filePath: recurrenceFilePath }
    );
    const recurringReturn = await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-09-04",
        capturedAt: "2026-09-04T08:00:00.000Z",
        candidates: [recurringCandidate]
      }),
      { filePath: recurrenceFilePath }
    );
    assert.equal(recurringReturn.status, "applied");
    assert.notEqual(recurringReturn.scanId, firstRecurringScan.scanId);
    const afterRecurringReturn = await readLongTermRecommendationHistory({
      filePath: recurrenceFilePath
    });
    assert.equal(afterRecurringReturn.cases[0]?.status, "current");
    assert.equal(afterRecurringReturn.cases[0]?.events.at(-1)?.type, "reobserved");

    const recurringCaseId = afterRecurringReturn.cases[0]?.id;
    assert.ok(recurringCaseId);
    const weekendClose = {
      caseId: recurringCaseId,
      closedDate: "2026-09-06",
      closedAt: "2026-09-06T06:00:00.000Z",
      closeId: "verify-weekend-close",
      outcomeType: "manual_close" as const,
      category: "neutral" as const,
      reason: "weekend review close",
      policyVersion: "verify-policy-v1",
      provenance: "manual" as const
    };
    await closeLongTermRecommendationHistoryCase(weekendClose, {
      filePath: recurrenceFilePath
    });
    const rawBeforeCloseConflict = await readFile(recurrenceFilePath, "utf8");
    await assert.rejects(
      closeLongTermRecommendationHistoryCase(
        {
          ...weekendClose,
          closedAt: "2026-09-06T07:00:00.000Z",
          outcomeType: "thesis_broken",
          category: "loss",
          reason: "conflicting close payload"
        },
        { filePath: recurrenceFilePath }
      ),
      /closeId conflict/
    );
    assert.equal(await readFile(recurrenceFilePath, "utf8"), rawBeforeCloseConflict);

    const reopenedFromFridayData = await updateLongTermRecommendationHistoryFromScan(
      {
        ...fullScanInput({
          asOfDate: "2026-09-04",
          capturedAt: "2026-09-07T06:00:00.000Z",
          candidates: [recurringCandidate]
        }),
        currentPicks: [createCurrentPick("009999", "2026-08-01")]
      },
      { filePath: recurrenceFilePath }
    );
    assert.equal(reopenedFromFridayData.status, "applied");
    const afterWeekendReopen = await readLongTermRecommendationHistory({
      filePath: recurrenceFilePath
    });
    assert.equal(afterWeekendReopen.asOfDate, "2026-09-04");
    assert.deepEqual(
      afterWeekendReopen.cases.map((historyCase) => [historyCase.cycleNo, historyCase.status]),
      [
        [1, "closed"],
        [2, "current"]
      ]
    );
    assert.equal(afterWeekendReopen.cases[1]?.candidateAnchorDate, "2026-09-04");
    assert.equal(afterWeekendReopen.cases[1]?.bucketEnteredDate, "2026-09-04");
    assert.deepEqual(reopenedFromFridayData.scanStartedCases, [
      {
        symbol: "009999",
        cycleNo: 2
      }
    ]);
    assert.deepEqual(reopenedFromFridayData.currentPickDateOverrides, [
      {
        symbol: "009999",
        anchorDate: "2026-09-04",
        bucketEnteredDate: "2026-09-04"
      }
    ]);
    const reopenedRetry = await updateLongTermRecommendationHistoryFromScan(
      {
        ...fullScanInput({
          asOfDate: "2026-09-04",
          capturedAt: "2026-09-07T07:00:00.000Z",
          candidates: [recurringCandidate]
        }),
        currentPicks: [createCurrentPick("009999", "2026-08-01")]
      },
      { filePath: recurrenceFilePath }
    );
    assert.equal(reopenedRetry.status, "deduplicated");
    assert.equal(reopenedRetry.scanId, reopenedFromFridayData.scanId);
    assert.deepEqual(reopenedRetry.scanStartedCases, reopenedFromFridayData.scanStartedCases);
    assert.deepEqual(
      reopenedRetry.currentPickDateOverrides,
      reopenedFromFridayData.currentPickDateOverrides
    );

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-10-01",
        capturedAt: "2026-10-01T10:00:00.000Z",
        candidates: [createCandidate("008888", 80, "accumulate candidate")]
      }),
      { filePath: chronologyFilePath }
    );
    const chronologyBeforeRejects = await readFile(chronologyFilePath, "utf8");
    const chronologyCase = await readLongTermRecommendationHistory({
      filePath: chronologyFilePath
    });
    assert.ok(chronologyCase.cases[0]);
    await assert.rejects(
      closeLongTermRecommendationHistoryCase(
        {
          caseId: chronologyCase.cases[0].id,
          closedDate: "2026-10-01",
          closedAt: "2026-10-01T09:00:00.000Z",
          closeId: "verify-out-of-order-close",
          outcomeType: "manual_close",
          category: "neutral",
          reason: "must be rejected",
          policyVersion: "verify-policy-v1",
          provenance: "manual"
        },
        { filePath: chronologyFilePath }
      ),
      /Out-of-order long-term close rejected/
    );
    assert.equal(await readFile(chronologyFilePath, "utf8"), chronologyBeforeRejects);
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        fullScanInput({
          asOfDate: "2026-99-99",
          capturedAt: "2026-10-01T11:00:00.000Z",
          candidates: []
        }),
        { filePath: chronologyFilePath }
      ),
      /Invalid long-term history asOfDate/
    );
    assert.equal(await readFile(chronologyFilePath, "utf8"), chronologyBeforeRejects);
    const invalidCandidate = {
      ...createCandidate("008889", 81, "watch candidate"),
      candidateGroup: "invalid candidate"
    } as unknown as LongTermScanCandidate;
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        fullScanInput({
          asOfDate: "2026-10-02",
          capturedAt: "2026-10-02T06:00:00.000Z",
          candidates: [invalidCandidate]
        }),
        { filePath: chronologyFilePath }
      ),
      /Invalid long-term scan candidate/
    );
    assert.equal(await readFile(chronologyFilePath, "utf8"), chronologyBeforeRejects);

    const identityCandidate = createCandidate("007777", 70, "accumulate candidate");
    const completenessIdentity = {
      asOfDate: "2026-11-01",
      capturedAt: "2026-11-01T06:00:00.000Z",
      universeSize: 1,
      candidates: [identityCandidate],
      scanId: "verify-completeness-identity",
      scanCompleteness: "partial" as const,
      scope: {
        mode: "symbols" as const,
        symbols: ["007777"]
      }
    };
    await updateLongTermRecommendationHistoryFromScan(completenessIdentity, {
      filePath: identityFilePath
    });
    const rawBeforeCompletenessConflict = await readFile(identityFilePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        {
          ...completenessIdentity,
          capturedAt: "2026-11-01T07:00:00.000Z",
          scanCompleteness: "complete"
        },
        { filePath: identityFilePath }
      ),
      /scanId conflict/
    );
    assert.equal(await readFile(identityFilePath, "utf8"), rawBeforeCompletenessConflict);

    const metadataIdentity = {
      asOfDate: "2026-11-02",
      capturedAt: "2026-11-02T06:00:00.000Z",
      universeSize: 1,
      candidates: [identityCandidate],
      currentPicks: [createCurrentPick("007777", "2026-11-02", "metadata-a")],
      scanId: "verify-current-pick-identity",
      scanCompleteness: "complete" as const,
      scope: {
        mode: "symbols" as const,
        symbols: ["007777"]
      }
    };
    await updateLongTermRecommendationHistoryFromScan(metadataIdentity, {
      filePath: identityFilePath
    });
    const rawBeforeMetadataConflict = await readFile(identityFilePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        {
          ...metadataIdentity,
          capturedAt: "2026-11-02T07:00:00.000Z",
          currentPicks: [createCurrentPick("007777", "2026-11-02", "metadata-b")]
        },
        { filePath: identityFilePath }
      ),
      /scanId conflict/
    );
    assert.equal(await readFile(identityFilePath, "utf8"), rawBeforeMetadataConflict);

    await updateLongTermRecommendationHistoryFromScan(
      fullScanInput({
        asOfDate: "2026-12-01",
        capturedAt: "2026-12-01T06:00:00.000Z",
        candidates: [createCandidate("006666", 60, "accumulate candidate")]
      }),
      { filePath: partialScopeFilePath }
    );
    await updateLongTermRecommendationHistoryFromScan(
      {
        asOfDate: "2026-12-02",
        capturedAt: "2026-12-02T06:00:00.000Z",
        universeSize: 1,
        candidates: [],
        scanCompleteness: "partial",
        scope: {
          mode: "symbols",
          symbols: ["006666"]
        }
      },
      { filePath: partialScopeFilePath }
    );
    const afterPartialScope = await readLongTermRecommendationHistory({
      filePath: partialScopeFilePath
    });
    assert.equal(afterPartialScope.cases[0]?.status, "current");
    assert.equal(afterPartialScope.strategySummary.lastScanCompleteness, "partial");
    const rawBeforeIncompleteFullScan = await readFile(partialScopeFilePath, "utf8");
    await assert.rejects(
      updateLongTermRecommendationHistoryFromScan(
        {
          asOfDate: "2026-12-03",
          capturedAt: "2026-12-03T06:00:00.000Z",
          universeSize: 100,
          candidates: [],
          scanCompleteness: "unknown",
          scope: {
            mode: "full_universe"
          }
        },
        { filePath: partialScopeFilePath }
      ),
      /Incomplete full-universe long-term scan rejected/
    );
    assert.equal(await readFile(partialScopeFilePath, "utf8"), rawBeforeIncompleteFullScan);

    const structurallyCorrupt = JSON.parse(rawBeforeSameDayRollback) as {
      cases: Array<{ returnMetrics: { latestSignalReturnPct: number } }>;
    };
    assert.ok(structurallyCorrupt.cases[0]);
    structurallyCorrupt.cases[0].returnMetrics.latestSignalReturnPct = 999;
    await writeFile(filePath, JSON.stringify(structurallyCorrupt), "utf8");
    await assert.rejects(
      readLongTermRecommendationHistory({ filePath }),
      /Return metric mismatch/
    );

    console.log(
      JSON.stringify({
        ok: true,
        caseCount: finalPayload.commonSummary.caseCount,
        eventCount: finalPayload.strategySummary.eventCount,
        appliedScanCount: finalPayload.appliedScans.length
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
