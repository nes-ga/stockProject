# Smart Money Maintenance Guide

## Purpose

This document explains the parts of the smart-money engine that are easiest to misread during maintenance.
The most important rule is:

- `matched` means the pattern quality cleared a score threshold.
- `actionable` means the setup is actually tradable now.
- The server swing scan now saves only `actionable` entries.

That distinction exists so early watch setups do not leak into the executable swing list.

## Files To Know

- `src/services/smartMoneyEngine.ts`
  - Main pattern evaluation pipeline.
  - Builds setup/breakout candidates.
  - Decides `matched`, `actionable`, `status`, score ranking, and final selected candidate.

- `src/services/smartMoney/config.ts`
  - Default smart-money filter values.
  - Use this file first when you want to tighten or loosen thresholds.

- `src/services/smartMoney/utils.ts`
  - Shared math and workflow helpers.
  - Use this file for reusable engine calculations instead of re-adding helpers into large files.

- `src/services/smartMoney/marketContext.ts`
  - Builds the auto market context from KOSPI/KOSDAQ, USD/KRW, and gold snapshots.
  - Cached briefly during batch scans to avoid repeated network loads.

- `src/scripts/scanUniverseSwingPicks.ts`
  - Universe scan entrypoint.
  - Writes `data/server-swing-picks.json`.
  - Important: only `pattern.actionable` entries are persisted.

## Actionable Rule

For setup candidates, the engine should only behave like a 1st-buy signal when the staged-buy logic says the SMA20-based first-buy area is active.

Practical meaning:

- A setup may be `matched=true` and still be too early.
- A setup should only be treated like a real entry when it becomes `buy_ready`.
- Universe scan output is intentionally closer to an execution list than a watchlist.

If you loosen this carelessly, names like early pullback watches can reappear in `server-swing-picks.json`.

## Where To Change Behavior

If too many loose setup names are appearing:

1. Check `src/services/smartMoney/config.ts`
2. Review these filters first:
   - `minSetupPullbackSessions`
   - `maxSetupPullbackDrawdownPercent`
   - `maxSetupPullbackRangePercent`
   - `pullbackBuyStartPercentFromPeak`
   - `firstBuySma20ProximityPercent`
   - `minActionableValidityScore`
   - `minExecutionReadinessScore`
3. Re-run the universe scan and inspect the saved file again

If the ranking feels wrong but the inclusion/exclusion is correct:

1. Review `finalRankScore` weighting in `smartMoneyEngine.ts`
2. Review `dangerPenalty` adjustments in `smartMoneyEnhancer.ts`

## Safe Edit Checklist

Whenever smart-money logic changes, run:

```bash
npm run build
npm run scan:swing-universe
```

Then verify:

1. `data/server-swing-picks.json` only contains names you would accept as executable setups or valid breakouts.
2. A known early-watch setup does not reappear just because it is `matched`.
3. A known valid 20-day moving-average first-buy setup still appears.

## Notes On Monitoring

I can keep checking changes while we are actively working in this session, but I cannot watch the repository autonomously after the session ends.
For any future engine change, use the checklist above and then ask me to review the updated result set.
