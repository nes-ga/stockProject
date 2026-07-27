import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  previewLongTermUniverseAlerts,
  previewSwingUniverseAlerts,
  rememberRecommendationUniverseAlertPreview
} from "../services/recommendationUniverseAlerts.js";
import type { ServerLongTermPick } from "../services/serverLongTermPicks.js";
import type { ServerSwingPick } from "../services/serverSwingPicks.js";

function longTermPick(symbol: string, bucket: "watch" | "accumulate" | "buy"): ServerLongTermPick {
  return {
    key: `test-${symbol}`,
    name: `테스트-${symbol}`,
    symbol,
    anchorDate: "2026-07-27",
    category: "longTerm",
    longTermBucket: bucket,
    source: "verification"
  };
}

function swingPick(symbol: string): ServerSwingPick {
  return {
    key: `swing-${symbol}`,
    name: `스윙-${symbol}`,
    symbol,
    anchorDate: "2026-07-27",
    category: "swing",
    bucket: "watch"
  };
}

async function main() {
  const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "stockmon-alert-state-"));
  const filePath = path.join(temporaryDir, "recommendation-universe-alert-state.json");
  const options = { filePath };

  try {
    const firstPreview = await previewLongTermUniverseAlerts(
      [longTermPick("000001", "accumulate")],
      options
    );
    assert.equal(firstPreview.diff.changes.length, 1);
    assert.equal(firstPreview.diff.changes[0]?.type, "added");
    await assert.rejects(readFile(filePath, "utf8"), /ENOENT/);

    const retryBeforeCommit = await previewLongTermUniverseAlerts(
      [longTermPick("000001", "accumulate")],
      options
    );
    assert.deepEqual(retryBeforeCommit.diff, firstPreview.diff);

    const firstCommit = await rememberRecommendationUniverseAlertPreview(firstPreview, options);
    assert.equal(firstCommit.status, "applied");
    const noChangePreview = await previewLongTermUniverseAlerts(
      [longTermPick("000001", "accumulate")],
      options
    );
    assert.equal(noChangePreview.diff.changes.length, 0);
    assert.equal(
      (await rememberRecommendationUniverseAlertPreview(noChangePreview, options)).status,
      "deduplicated"
    );

    const swingPreview = await previewSwingUniverseAlerts(
      {
        executionItems: [],
        watchItems: [swingPick("000100")]
      },
      options
    );
    const nextLongTermPreview = await previewLongTermUniverseAlerts(
      [
        longTermPick("000001", "buy"),
        longTermPick("000002", "watch")
      ],
      options
    );
    await Promise.all([
      rememberRecommendationUniverseAlertPreview(swingPreview, options),
      rememberRecommendationUniverseAlertPreview(nextLongTermPreview, options)
    ]);

    const stateAfterDifferentCategories = JSON.parse(await readFile(filePath, "utf8")) as {
      swing?: { items?: unknown[] };
      longTerm?: { items?: unknown[] };
    };
    assert.equal(stateAfterDifferentCategories.swing?.items?.length, 1);
    assert.equal(stateAfterDifferentCategories.longTerm?.items?.length, 2);

    const competingPreviewA = await previewLongTermUniverseAlerts(
      [longTermPick("000003", "accumulate")],
      options
    );
    const competingPreviewB = await previewLongTermUniverseAlerts(
      [longTermPick("000004", "buy")],
      options
    );
    await rememberRecommendationUniverseAlertPreview(competingPreviewA, options);
    await assert.rejects(
      rememberRecommendationUniverseAlertPreview(competingPreviewB, options),
      /state changed before commit/
    );

    const finalState = JSON.parse(await readFile(filePath, "utf8")) as {
      longTerm?: { items?: Array<{ symbol?: string }> };
    };
    assert.deepEqual(finalState.longTerm?.items?.map((item) => item.symbol), ["000003"]);

    console.log(
      JSON.stringify({
        ok: true,
        retryPreservedDiff: retryBeforeCommit.diff.changes.length,
        finalLongTermCount: finalState.longTerm?.items?.length ?? 0
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
