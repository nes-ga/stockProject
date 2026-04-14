# Work Summary 2026-04-14

## Scope

This update captures the latest smart-money and swing-engine refinement work.
The architecture was preserved and the changes were limited to scoring, classification, explainability, and halt handling.

## Smart-Money Engine

- Added separate threshold controls for setup and breakout execution:
  - `setupValidityMin`
  - `setupExecutionMin`
  - `breakoutValidityMin`
  - `breakoutExecutionMin`
- Added regime-aware threshold adjustment:
  - bull market can loosen breakout gates
  - bear market can tighten setup gates
- Kept SMA20 as the primary setup entry anchor.
- Added informational alternative-anchor tags without changing the execution rule:
  - `tag_alt_anchor_pivot_retest`
  - `tag_alt_anchor_box_support`
  - `tag_alt_anchor_shallow_pullback`

## Quality Refinements

- Volume quality still keeps absolute volume and turnover minimums.
- Added more weight to trading value and turnover quality.
- Added low-price liquidity penalties so raw share-count spikes do not overrate weak names.
- Added candle-quality scoring for:
  - upper wick rejection
  - close position in range
  - body size ratio
  - gap rejection

## Bucket Classification

- Swing names are now classified as:
  - `execution_ready`
  - `execution_probe`
  - `watch`
- `execution_ready` requires the engine to already treat the setup as actionable and still pass quality checks.
- `execution_probe` is used when price has entered the SMA20-based zone but quality is still incomplete.
- `watch` now carries more explicit internal tags:
  - `watch_extended_leader`
  - `watch_pullback_pending`
  - `watch_low_quality`
  - `watch_halt_event`
  - `watch_halt_structural`

## Trading Halt Handling

- Replaced blanket halt exclusion with reason-based handling.
- Added:
  - `haltCategory`
  - `haltAction`
- Current mapping:
  - `critical` -> `exclude`
  - `structural` -> `exclude`
  - `event` -> `allow_with_penalty`
  - `technical` -> `watch_only`

## Explainability

- Saved swing candidates now include:
  - `reasons`
  - `tags`
  - `penaltyFactors`
- This data is now part of the expected UI and debug output and should be preserved in future changes.

## Verification

- `npm run build`
- Full live rescan completed through `node dist/scripts/scanUniverseSwingPicks.js`

## Current Live Result

- `execution_ready`: `0`
- `execution_probe`: `1`
- `watch`: `19`

The current probe reference case is `HLB이노베이션 (024850)`, which remains visible because its halt is classified as an `event`, but it is still held back by the halt penalty and other quality gates.
