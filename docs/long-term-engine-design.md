# Long-Term Engine Design

## Goal

The long-term engine answers one question:

`Is this a representative stock that corrected enough and is now stabilizing with acceptable financial condition?`

It is not a breakout engine and it is not a buy-now timing engine.

## Scope

- v1 scans only the curated leader universe in [universe.ts](/C:/Users/user/Desktop/stockProject/src/services/longTerm/universe.ts)
- ETFs and ETNs are excluded
- low-liquidity and structurally broken names are excluded
- user-added names can still be reviewed one by one, but they do not get the same leader assumption as curated names

## Output Contract

Each candidate returns:

- identity: `symbol`, `name`, `sector`
- price context: `price`, `high52w`, `high2y`, `drawdownPct`
- score block:
  - `leaderScore`
  - `correctionScore`
  - `trendScore`
  - `liquidityScore`
  - `stabilizationScore`
  - `financialScore`
  - `totalScore`
- structure block:
  - `ma60`, `ma120`, `ma240`
  - `ma120Slope`, `ma240Slope`
  - `priceVsMA120Pct`, `priceVsMA240Pct`
- base block:
  - `recentLow`
  - `distanceFromLowPct`
  - `higherLowCount`
  - `daysSinceLastLowBreak`
  - `isStabilizing`
- liquidity block:
  - `avgTurnover20`
  - `avgTurnover60`
  - `volumeConsistency`
- financial block:
  - `revenueTrend`
  - `operatingProfitTrend`
  - `netIncomeTrend`
  - `earningsState`
  - `roeState`
  - `roeTrend`
  - `debtState`
  - `debtTrend`
  - `businessClarity`
  - `financialMomentum`
  - `structuralRiskFlags`
- review metadata:
  - `label`
  - `reasonSummary`

## Score Weights

- `leaderScore`: 25%
- `correctionScore`: 20%
- `trendScore`: 15%
- `liquidityScore`: 10%
- `stabilizationScore`: 15%
- `financialScore`: 15%

`totalScore` is a weighted blend of those six modules.

## Scoring Modules

### Leader score

- curated universe membership carries the largest weight
- curated tiers (`core`, `primary`, `secondary`) set the base
- turnover rank only adjusts the score, it does not define the engine

### Correction score

- drawdown magnitude is necessary but not sufficient
- deep drawdown near the recent low is weaker than deep drawdown with some recovery
- names near the 52-week high or too extended above MA120 are penalized
- the engine uses `2-year high` as the primary reference
- `5-year high` is a supplementary reference only
- because of that, the chart history load must cover at least 5 trading years
- practical rule:
  - pass normally on the 2-year drawdown
  - if the 2-year drawdown is still shallow but the 5-year drawdown is deep enough and the stock has started to recover from the recent low, the 5-year drawdown can support review eligibility
- this is designed for longer-cycle names such as game, battery, cosmetics, and other cyclical leaders

### Trend score

- uses MA120 and MA240 slope, not just price position
- falling MA240 is a real penalty
- flattening MA120 is neutral
- turning-up MA120 is constructive
- excessive extension above MA120 is penalized

### Stabilization score

- higher-low count matters
- fresh low breaks are penalized
- base duration matters
- volume cooling is rewarded

### Financial score

The financial layer is intentionally separated into three parts:

1. hard exclusion
2. weakness penalty
3. recovery / normalization bonus

This avoids treating weak financials as a simple linear penalty.

## Financial Classification

Financial output is categorical rather than raw-number-only:

- trend states:
  - `improving`
  - `weakening`
  - `cyclical_downturn`
- earnings states:
  - `profitable`
  - `temporary_loss`
  - `persistent_loss`
- ROE states:
  - `strong`
  - `normal`
  - `weak`
  - `negative`
- debt states:
  - `safe`
  - `manageable`
  - `high`
  - `dangerous`
- business clarity:
  - `clear_core_business`
  - `diversified`
  - `unclear`
- momentum:
  - `improving`
  - `stabilizing`
  - `deteriorating`

## Financial Hard Exclusion

The engine excludes names when the financial condition looks structurally broken, for example:

- persistent losses with worsening momentum
- dangerous debt structure with no stabilization
- multi-factor business breakdown flags

This filter is stronger than the normal financial penalty.

## Double-Penalty Protection

Price drawdown already reflects part of the business weakness.

Because of that, the engine reduces the financial weakness penalty when all of the following are true:

- the stock is a confirmed leader
- drawdown is already deep
- price action is stabilizing

Practical effect:

- `>35%` drawdown with stabilization reduces the financial penalty
- `>45%` drawdown with stronger stabilization reduces it further

This keeps the engine from rejecting every cyclical leader only because the earnings slowdown is already visible in price.

## Labels

Candidates are classified into:

- `leader correction watch`
- `deep value review`
- `base-forming candidate`
- `needs more stabilization`

These labels describe review posture, not execution timing.

## Candidate Groups

For review convenience, the engine also groups names into:

- `buy candidate`
- `watch candidate`

This is still not a real-time entry signal.

`buy candidate` means the stock is structurally good enough for staged long-term accumulation review.

## Single-Stock Review

Single-stock review stays supported for user-added recommendations.

- curated names receive full leader assumptions
- ad hoc names are still scored with the same framework
- ad hoc names can fail because representative status is too weak for the curated framework

## Important Files

- engine orchestration: [longTermEngine.ts](/C:/Users/user/Desktop/stockProject/src/services/longTermEngine.ts)
- scan defaults: [config.ts](/C:/Users/user/Desktop/stockProject/src/services/longTerm/config.ts)
- financial classification and scoring: [fundamentalScore.ts](/C:/Users/user/Desktop/stockProject/src/services/longTerm/fundamentalScore.ts)
- labels and summaries: [labels.ts](/C:/Users/user/Desktop/stockProject/src/services/longTerm/labels.ts)
- curated universe: [universe.ts](/C:/Users/user/Desktop/stockProject/src/services/longTerm/universe.ts)

## Maintenance Notes

- if the engine gets noisy, tighten the curated universe first
- if too many weak cyclicals survive, raise the financial hard-exclusion bar, not the drawdown requirement first
- if too few names survive, loosen stabilization slightly before weakening the leader filter
- do not convert this engine into a swing-entry engine
