# Smart Money Maintenance Guide

## Purpose

This document explains the parts of the smart-money engine that are easiest to misread during maintenance.
The most important rule is:

- `matched` means the pattern quality cleared a score threshold.
- `actionable` means the setup is actually tradable now.
- The server swing scan now classifies matched setups into `execution_ready`, `execution_probe`, or `watch`.
- `execution_ready` is the only bucket that should be treated like a clean live-entry state.
- `execution_probe` means price is near the SMA20-based entry zone, but one or more quality gates are still missing.

That distinction exists so early watch setups do not leak into the executable swing list.

## Files To Know

- `src/services/smartMoneyEngine.ts`
  - Main pattern evaluation pipeline.
  - Builds setup and breakout candidates.
  - Decides `matched`, `actionable`, `status`, score ranking, explainability fields, and final selected candidate.

- `src/services/smartMoney/config.ts`
  - Default smart-money filter values.
  - Use this file first when you want to tighten or loosen thresholds.

- `src/services/smartMoney/utils.ts`
  - Shared math and workflow helpers.
  - Use this file for reusable engine calculations instead of re-adding helpers into large files.

- `src/services/smartMoney/marketContext.ts`
  - Builds the auto market context from KOSPI/KOSDAQ, USD/KRW, and gold snapshots.
  - Cached briefly during batch scans to avoid repeated network loads.

- `src/services/recommendationUniverse.ts`
  - Final swing bucket classification layer.
  - Converts engine output into `execution_ready`, `execution_probe`, or `watch`.
  - Applies reason-based trading halt behavior before save.

- `src/services/tradingHalts.ts`
  - Loads the current KIND halt list.
  - Maps raw halt reasons into `haltCategory` and `haltAction`.
  - `critical` and `structural` halts are excluded.
  - `event` halts are allowed with penalty.
  - `technical` halts are kept as watch-only.

- `src/scripts/scanUniverseSwingPicks.ts`
  - Universe scan entrypoint.
  - Writes `data/server-swing-picks.json`.
  - Server output still preserves `executionItems` and `watchItems` for compatibility.
  - Execution-side saved names may now be `execution_ready` or `execution_probe`.

## Actionable Rule

For setup candidates, the engine should only behave like a first-buy signal when the staged-buy logic says the SMA20-based first-buy area is active.

Practical meaning:

- A setup may be `matched=true` and still be too early.
- A setup should only be treated like a real entry when it becomes `buy_ready`.
- Universe scan output is split into execution-side and watch-side buckets.
- `execution_ready` should stay close to names you would actually trade.
- `execution_probe` may be near entry, but should still carry caution.
- `watch` may contain matched setups that are not yet near entry or are still missing quality.

If you loosen this carelessly, low-quality early pullback names can leak into execution-side output.

## Current Bucket Rules

- `execution_ready`
  - Engine already says `pattern.actionable === true`.
  - Regime gate is already cleared inside the engine.
  - Risk/reward, validity, and execution thresholds are stage-aware in `smartMoneyEngine.ts`.
  - Classification should still reject names with weak contraction, weak candles, negative SMA20 slope, unstable support, or halt penalties.

- `execution_probe`
  - Primary use case is a setup that has entered the SMA20-based entry zone.
  - Probe names are not full executions.
  - Typical reasons:
    - `weak_volume_contraction`
    - `weak_candle_structure`
    - `sma20_slope_negative`
    - `unstable_support`
    - `risk_reward_thin`
    - `halt_penalty_active`

- `watch`
  - Matched but not close enough to entry, or still too low quality.
  - Watch names now expose UI/debug tags such as:
    - `watch_extended_leader`
    - `watch_pullback_pending`
    - `watch_low_quality`
    - `watch_halt_event`
    - `watch_halt_structural`

## Explainability Fields

Every saved swing candidate should carry explainability data:

- `reasons`
  - Machine-readable explanation tags for why a name landed in its current bucket.
  - Examples: `entryZone_hit`, `execution_gate_not_cleared`, `halt_penalty_active`.

- `tags`
  - Structural or informational tags.
  - Examples: `tag_sma20_primary`, `tag_alt_anchor_pivot_retest`, `tag_alt_anchor_box_support`, `tag_alt_anchor_shallow_pullback`.

- `penaltyFactors`
  - Ranked penalty details with `code`, `label`, `impact`, and `reason`.
  - These explain why a probe or watch name was held back.

Do not remove these fields when adjusting output schemas. They are now part of the expected debugging surface.

## Threshold Notes

The engine no longer relies on a single global `55/55` gate.

- Setup thresholds
  - `setupValidityMin`
  - `setupExecutionMin`

- Breakout thresholds
  - `breakoutValidityMin`
  - `breakoutExecutionMin`

- Risk/reward thresholds
  - `executionReadyRiskRewardMin`
  - `executionProbeRiskRewardMin`

- Regime adjustments
  - Bull market can loosen breakout thresholds.
  - Bear market can tighten setup thresholds.

When tuning, change these in `src/services/smartMoney/config.ts` before changing hard logic.

## Volume And Candle Interpretation

The engine still keeps the hard filters:

- absolute volume thresholds
- relative volume thresholds
- turnover thresholds

It now adds more interpretation on top:

- trading value matters more than raw share count
- low-price names receive a liquidity drag penalty
- turnover proxy versus recent average is included
- candle structure now scores upper wick, close position, body ratio, and gap rejection

These refinements are intended to reduce false executions without relaxing the original strict filters.

## Trading Halt Handling

Trading halts are no longer handled as a single blanket exclusion.

- `critical`
  - Always exclude.
  - Examples: delisting risk, audit refusal, fraud-like governance failures.

- `structural`
  - Exclude, but still track separately in halt metadata.
  - Examples: delayed filings, disclosure violations.

- `event`
  - Do not exclude automatically.
  - Keep visible with `allow_with_penalty`.
  - Examples: merger, split, rights offering, tender offer.

- `technical`
  - Do not exclude automatically.
  - Keep as `watch_only`.
  - Examples: volatility or warning-driven halts.

## Where To Change Behavior

If too many loose setup names are appearing:

1. Check `src/services/smartMoney/config.ts`
2. Review these filters first:
   - `minSetupPullbackSessions`
   - `maxSetupPullbackDrawdownPercent`
   - `maxSetupPullbackRangePercent`
   - `pullbackBuyStartPercentFromPeak`
   - `firstBuySma20ProximityPercent`
   - `setupValidityMin`
   - `setupExecutionMin`
   - `breakoutValidityMin`
   - `breakoutExecutionMin`
   - `executionReadyRiskRewardMin`
   - `executionProbeRiskRewardMin`
3. Re-run the universe scan and inspect the saved file again.

If the ranking feels wrong but the inclusion or exclusion is correct:

1. Review `finalRankScore` weighting in `smartMoneyEngine.ts`.
2. Review `dangerPenalty` adjustments in `smartMoneyEnhancer.ts`.

## Safe Edit Checklist

Whenever smart-money logic changes, run:

```bash
npm run build
npm run scan:swing-universe
```

Then verify:

1. `execution_ready` only contains names you would accept as executable setups or valid breakouts.
2. `execution_probe` contains near-entry names that still need caution, not clean executions.
3. `watchItems` only contains matched watch setups you still want surfaced to the UI.
4. A known early-watch setup does not reappear as ready just because it entered the entry zone.
5. A known valid 20-day moving-average first-buy setup still appears.
6. Event-driven halt names remain visible only with penalty, while structural or critical halts stay excluded.

## Latest Notes

- As of `2026-04-14`, the live scan is running with three swing buckets: `execution_ready`, `execution_probe`, and `watch`.
- As of `2026-04-14`, the saved live scan currently has `1` probe name and `19` watch names, with no `execution_ready` names.
- `HLB이노베이션 (024850)` is currently a useful reference example for `event` halt handling because it is not excluded, but it still carries a halt penalty and remains below ready status.
- If a name looks missing in the UI while the engine says `matched=true` and `actionable=true`, verify the saved `data/server-swing-picks.json` file after running `npm run scan:swing-universe` before changing thresholds.

## Notes On Monitoring

I can keep checking changes while we are actively working in this session, but I cannot watch the repository autonomously after the session ends.
For any future engine change, use the checklist above and then ask me to review the updated result set.
