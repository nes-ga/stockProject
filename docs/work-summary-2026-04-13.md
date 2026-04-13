# Work Summary 2026-04-13

## Scope

This note captures follow-up maintenance after the earlier dashboard and engine expansion work.
It focuses on UI behavior, market-watch date handling, and smart-money/swing engine documentation alignment.

## Recommendation View

- The primary recommendation tabs were tightened so `중장기 / 배당 / 스윙` render on a single row.
- The interactive anchor price line now resolves against aggregated candles as well as daily candles.
- Weekly and monthly chart views now align the anchor line to the nearest aggregated bar on or before the anchor date.

## Market Watch

- The market-watch feed continues to serve `KOSPI`, `KOSDAQ`, `USD/KRW`, `GOLD`, `WTI`, and `BTC`.
- UI date display is normalized to the Seoul fetch date derived from `fetchedAt`.
- Source-session dates can still differ by asset because Yahoo and Naver use exchange-local trading sessions.
- `BTC` daily and weekly chart aggregation now keeps the latest live bar instead of trimming it away.

## Smart-Money / Swing Engine

- The universe scan persists two buckets in `data/server-swing-picks.json`:
  - `executionItems`: names with `pattern.actionable === true`
  - `watchItems`: matched watch candidates that are still worth surfacing
- Early low-quality pullback states should stay out of the saved watch bucket.
- On `2026-04-13`, `서전기전 (189860)` was verified again and is currently an `execution` candidate under the live engine and full universe scan.

## Verification Notes

- `npm run check`
- `npm run build`
- Full live swing-universe rescan completed and rewrote `data/server-swing-picks.json`

## Related Files

- `public/app.css`
- `public/app.js`
- `src/services/marketWatch.ts`
- `docs/current-implemented-features.md`
- `docs/smart-money-maintenance.md`
