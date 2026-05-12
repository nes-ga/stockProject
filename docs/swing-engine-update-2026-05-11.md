# Swing Engine Update - 2026-05-11

## Purpose

This update documents the current swing-engine rules after the 2026-05-11 review.

The engine should keep broad swing candidates visible, but it must separate:

- executable buy candidates
- broad/rough pullback candidates
- watch-only candidates
- closed or already-served candidates
- no-entry recommendations that should not enter win-rate statistics

## Current Rules

### 1. Penny Stock Exclusion

Stocks with `referenceClose <= 1000` are excluded from swing recommendations.

This applies to both:

- execution candidates
- watch candidates

Reason: stocks below 1000 KRW carry higher liquidity, tick, volatility, and manipulation risk. They should not be recommended by the swing engine.

Implementation:

- `src/services/recommendationUniverse.ts`
- constant: `SWING_MIN_REFERENCE_PRICE = 1000`
- helper: `isPennyStockRisk`

Latest scan after this rule:

- default swing: 43 total, 11 execution, 32 watch
- smallcap swing: 27 total, 3 execution, 24 watch

### 2. SMA20 Envelope Rule

The swing engine now adds an SMA20 envelope using a fixed 10% band.

Formula:

- basis: `SMA20`
- upper: `SMA20 * 1.10`
- lower: `SMA20 * 0.90`

Envelope positions:

- `above_upper`: overheated / chase-risk zone
- `upper_band`: strong but not pullback-buy focused
- `basis_zone`: near SMA20
- `lower_band`: rough pullback but still inside trend envelope
- `below_lower`: trend-envelope break

Confirmed lower-band break:

- `position === "below_lower"`
- and `lowerBreakSessions >= 2`

Implementation:

- `src/services/smartMoneyEngine.ts`
- helper: `deriveEnvelopeAnalysis`
- type: `SmartMoneyEnvelopeAnalysis`

### 3. Wide Pullback Candidate

Rough pullbacks can become execution-probe candidates only when the SMA20 envelope supports the setup.

The current wide-pullback promotion requires:

- above invalidation/stop line
- support status is `holding`
- meaningful pullback depth
- dried volume
- risk/reward is at least 1.8
- price is inside the SMA20 -10% envelope lower band or has reclaimed it
- not below the lower envelope for 2+ sessions

Resulting reason tags:

- `wide_pullback_candidate`
- `envelope_lower_hold`
- `execution_gate_overridden_by_envelope`

Implementation:

- `src/services/recommendationUniverse.ts`
- helper: `isEnvelopeWidePullbackCandidate`

### 4. Watch-Only Envelope Break

If the candidate is below the SMA20 -10% envelope for 2+ sessions, it remains watch-only.

Reason tags:

- `envelope_lower_break`
- `quality_not_ready`

This keeps the candidate visible but prevents it from being treated as a buy candidate.

### 5. Post-Entry Outcome Fix

The post-entry outcome logic now resets target-hit status when a later staged buy is newly executed.

Reason:

If a first-buy target had previously been hit, but a second buy later executed, the MFE must be recalculated from the new average price. Otherwise the case can be incorrectly closed as already successful.

Implementation:

- `src/services/smartMoneyEnhancer.ts`
- reset `targetHitStatus` when `executedNewStage` occurs

Reference case:

- `삼륭물산` previously showed `target_hit_after_first_buy` incorrectly.
- After the fix it is `active`, 2 buys executed, average price 7050, MFE -0.99%.

### 6. Recommendation History and Cross-Validation

Recommendations that have not touched the first-buy level are excluded from win-rate and return calculations.

Current split:

- `currentCandidates`: only candidates with at least one executed buy assumption
- `pendingEntryCandidates`: recommended but no-entry / before buy assumption
- `closedCases`: completed or no longer current historical cases

UI labels:

- current entered candidates: `현재 체결`
- excluded no-entry recommendations: `매수 전 제외`

Implementation:

- `src/services/recommendationHistory.ts`
- `public/app.js`

Latest history API check:

- current recommendations: 76
- current entered recommendations: 52
- pending entry candidates: 24
- closed cases: 10

## Reference Cases

### 제넥신 `095700`

Current interpretation:

- rough pullback
- still inside SMA20 -10% envelope
- promoted to execution-probe as wide pullback

Envelope:

- SMA20: 5671.5
- lower: 5104.35
- upper: 6238.65
- position: `lower_band`
- distance from lower: +4.81%

Result:

- bucket: `execution_probe`
- reasons include `wide_pullback_candidate`, `envelope_lower_hold`

### 삼륭물산 `014970`

Current interpretation:

- still above protective stop
- but below SMA20 -10% envelope for 4 sessions
- kept visible as watch-only

Envelope:

- SMA20: 7500
- lower: 6750
- upper: 8250
- position: `below_lower`
- lower break sessions: 4

Result:

- bucket: `watch`
- reasons include `envelope_lower_break`

## Current File Changes

Core engine:

- `src/services/smartMoneyEngine.ts`
- `src/services/recommendationUniverse.ts`
- `src/services/smartMoneyEnhancer.ts`
- `src/types.ts`

Persistence/API:

- `src/services/serverSwingPicks.ts`
- `src/routes/analysisRoutes.ts`

History/UI:

- `src/services/recommendationHistory.ts`
- `public/app.js`

Data regenerated by scans:

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`

## Verification

Executed:

```bash
npm.cmd run build
```

API checks:

- `POST /analysis/recommendation-universe-scan` for default swing
- `POST /analysis/recommendation-universe-scan` for smallcap swing
- `GET /analysis/recommendation-history/swing`

## 2026-05-12 Follow-up

Recommendation history was extended so that current and closed swing cases carry explicit outcome labels.

New outcome types:

- `target_hit`: fast shooting profit
- `drift_profit_exit`: slow profit exit after the stock rises out of the buy zone
- `entry_missed_upside`: no-entry case excluded from return statistics
- `stop_broken`: stop-loss exit
- `stale_timeout`: timeout after 20 business days from first execution
- `closed_unknown`: fallback closed case

History UI changes:

- Current recommendation cards now open a chart modal.
- The modal reuses `/analysis/realtime-stock-detail` chart data.
- The chart shows candles, volume, moving averages, average-buy line, and stop line when available.
- History cards and matrix show the outcome classification.

Data check after regeneration:

- history cases: 97
- entered cases: 67
- no-entry cases: 30
- missing `historyOutcome`: 0
- penny-stock history cases: 0

Verification:

```bash
npm.cmd run check
node --check public\app.js
npm.cmd run build
```

Additional validation:

- current recommendation files contain no stocks with `referenceClose <= 1000`
- `제넥신` is promoted to `execution_probe`
- `삼륭물산` remains `watch` due to confirmed lower envelope break
