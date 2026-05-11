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
- Classify it as `pullback_deep` and usually `execution_probe` or watch, not `execution_ready`.
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

A rough pullback can be promoted to `execution_probe` only when it is still inside the lower envelope zone or has reclaimed it. This path is marked with:

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
