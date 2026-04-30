# Chart Investigation 2026-04-30

## Scope

This note captures the current investigation result for the recent chart-shape issue and the related question about `open = 0`.

## Current Conclusion

The current chart issue is **not explained by `open = 0` alone**.

In the codebase, a point is treated as a non-trading or halted point only when all of the following are effectively zero:

- `open`
- `high`
- `low`
- `volume`

Relevant checks exist in:

- [src/services/stockAnalysis.ts](/abs/path/C:/Users/user/Desktop/stockProject/src/services/stockAnalysis.ts:174)
- [public/app.js](/abs/path/C:/Users/user/Desktop/stockProject/public/app.js:6071)

## Actual Logic

The current non-trading detection condition is:

```ts
return (
  (point.open ?? 0) === 0 &&
  (point.high ?? 0) === 0 &&
  (point.low ?? 0) === 0 &&
  (point.volume ?? 0) === 0
);
```

This means:

- `open = 0` by itself does not classify the candle as halted or empty.
- A market-close state does not automatically break chart rendering.
- If the chart still looks wrong, the more likely causes are:
  - upstream source data quality
  - a zero-filled OHLCV row
  - chart rendering or layout side effects
  - tooltip or CSS overlay interaction

## Recent UI Changes Around Charts

Recent changes near chart rendering included:

- Market Flow chart hover tooltips
- moving-average values in chart tooltips
- character-style toast UI

These changes did not intentionally alter the candle data model, but they do increase the chance that a layout or overlay issue may be mistaken for a data issue.

## Practical Interpretation

At the current stage:

- `open = 0` alone should not be treated as the root cause
- a malformed full OHLCV row is a stronger candidate
- if the problem persists, the next step should be chart-specific inspection:
  - Market Flow chart
  - index popup chart
  - stock detail chart

## Next Debug Step

For the next pass, verify one affected chart by:

1. checking the raw point for the visible broken date
2. checking whether the point is being converted to whitespace or halted state
3. checking whether tooltip or overlay styling is visually distorting the chart container
