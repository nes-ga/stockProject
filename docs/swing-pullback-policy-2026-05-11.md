# Swing Pullback Candidate Policy

Date: 2026-05-11

## Decision

Long pullbacks must not be excluded only because the pullback duration is long.

If a prior swing setup is still above its protective stop and pullback volume has cooled, keep it in the swing candidate universe. The engine should treat it as a mature pullback candidate, not as a fresh execution signal.

## Operational Rule

- Do not drop a setup solely because `pullbackSessions > maxPullbackSessions`.
- Keep the candidate while `referenceClose > stopLossReference.price`.
- Require volume contraction so stale noisy pullbacks do not stay alive by default.
- Mark this path with `stop_valid_extended_pullback`.
- Classify it as `pullback_deep` and keep it watch-only unless the staged entry zone is actually reached.
- Remove or downgrade it when the stop breaks, support quality collapses, volume expands badly, or risk/reward deteriorates.

## Reference Case

삼륭물산 `014970`:

- On 2026-05-11, the pullback had extended to 31 sessions.
- The stock was still above the protective stop.
- The intended behavior is to keep it as a swing pullback candidate instead of excluding it for age.
- The engine was updated so this path remains matched through `stop_valid_extended_pullback`.

## Code References

- `src/services/smartMoneyEngine.ts`
  - `stopValidExtendedPullback`
  - `stopValidPullback`
  - `stop_valid_extended_pullback`

## Maintenance Note

Before changing swing exclusion logic, check this policy. The exclusion trigger is not pullback age by itself. The exclusion trigger is stop invalidation or structural deterioration.

## 2026-05-11 Update

The swing engine now uses additional filters around this long-pullback policy.

### SMA20 Envelope

The engine calculates a fixed SMA20 envelope:

- basis: `SMA20`
- upper: `SMA20 * 1.10`
- lower: `SMA20 * 0.90`

A rough pullback can stay visible only when it is still inside the lower envelope zone or has reclaimed it. This path is marked with:

- `wide_pullback_candidate`
- `envelope_lower_hold`
- `execution_gate_overridden_by_envelope`

If price is below the SMA20 -10% envelope for 2 or more sessions, the setup remains watch-only and is marked with:

- `envelope_lower_break`

### Penny Stock Exclusion

Stocks with `referenceClose <= 1000` are excluded from both execution and watch recommendations.

This is a hard risk filter for swing recommendations.

### History Calculation

Recommendation-history statistics now exclude cases that have not reached the first-buy price.

- Entered cases: at least one staged buy was touched.
- Pending cases: recommended, but no first-buy execution assumption yet.
- Win-rate and return calculations should use entered cases only.

## 2026-05-15 Update

The long-pullback rule is now reflected in final candidate classification.

- A mature pullback can stay visible through `long_pullback_until_stop_probe`, but this is not an execution promotion.
- The candidate must still be above the invalidation/stop line.
- The candidate must not be overheated above the upper SMA20 envelope.
- Pullback age alone is still not an exclusion reason.
- Confirmed stop break, structural failure, or a failed post-spike shape can still remove or demote the candidate.

This keeps cases such as 제이오, 씨아이에스, SK오션플랜트, and 삼륭물산 aligned with the intended rule: after a valid swing candidate appears, a long pullback remains valid until the stop is broken.

## 2026-06-17 Update

The long-pullback rule is a visibility rule, not an execution-promotion rule.

`stop_valid_extended_pullback` and `long_pullback_until_stop_probe` may keep a mature pullback visible, but they must not override quality gates by themselves. In particular, a candidate should remain watch-only when the setup has low score, unstable support, or a confirmed SMA20 lower-envelope break.

Additional operating rules:

- Do not promote a low-score unstable-support setup to `execution_probe` only because it is still above stop.
- `envelope_lower_break` keeps the candidate watch-only until the lower envelope is reclaimed.
- `quality_not_ready` and `watch_low_quality` must not open a new entered recommendation-history case.
- A watch-only candidate can be visible in `watchItems`, but it is not a buy candidate and should not be counted as a live entered trade.
- If a candidate later becomes a true entered case, its buy plan and stop must be based on the first valid swing basis, not the latest scan.

Reference case:

와이어블 `065530`:

- First alert: 2026-06-01.
- Bucket: `watch`.
- Reasons included `envelope_lower_break` and `quality_not_ready`.
- The first alert note was `SMA20 1896 | 구간 1826~1779 | 손절 1504`.
- Later scans must not turn this into an active entered history case just because simulated lows touched staged prices.
- If it stays visible, it should remain a watch-only long-pullback candidate until it clears the quality/envelope gate.

Code references:

- `src/services/recommendationUniverse.ts`
  - `classifySwingCandidate`
  - `isEnvelopeWidePullbackCandidate`
  - `longPullbackUntilStopCandidate`
- `src/services/recommendationHistory.ts`
  - `shouldUpsertCurrentHistoryCase`
  - `readInitialSwingAlertSnapshots`

## 2026-06-29 Update

`execution_probe` must not be shown as a buy candidate.

Issue found:

- Some long-pullback candidates were stored under `executionItems` with `bucket: execution_probe`.
- Their reasons included `entry_zone_pending`, so they were not actually at the buy price.
- The frontend treated every `executionItems` record as the buy-candidate tab, so users saw non-entry candidates as `진입 가능`.

Correct behavior:

- `execution_ready`: buy candidate only when `stage=setup`, `status=buy_ready`, and `referenceClose` is inside `entryZoneLow~entryZoneHigh`.
- `execution_probe`: internal caution state only. It is not a buy candidate in user-facing UI.
- `entry_zone_pending`: always watch, not execution.
- Long-pullback reasons such as `stop_valid_extended_pullback` and `long_pullback_until_stop_probe` keep the candidate visible, but they do not promote it to buy.

Code guardrails:

- `classifySwingCandidate()` must require `withinEntryZone` for `readyByEngine`.
- The broad probe branch must return `watch`, not `execution_probe`, when the entry zone has not been reached.
- `serverSwingPicks` must reclassify persisted `execution_probe` records from `executionItems` into `watchItems` when reading payloads.
- The frontend must map `execution_probe` to the watch tab.

Regression check:

- Read `data/server-swing-picks.json` and `data/server-smallcap-swing-picks.json`.
- Confirm no item with `entry_zone_pending` appears in visible execution counts.
- After build, `readServerSwingPickPayload()` should report these persisted probe records under `watchItems`.
