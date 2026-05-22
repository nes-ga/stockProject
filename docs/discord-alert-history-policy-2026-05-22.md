# Discord Alert History Policy

Date: 2026-05-22

## Purpose

Discord alerts are now treated as their own historical event stream.

The alert log is separate from current recommendation files and swing recommendation history. This is necessary because a stock can be sent to Discord as an alert, then later move to watch, close, disappear from current candidates, or be recalculated under newer rules.

## Storage

Alert send metadata is appended to:

```text
data/discord-alert-history.jsonl
```

The file uses JSON Lines. Each line is one alert event record.

Only successful Discord sends are recorded. Failed sends are not recorded as sent alerts.

## Current Rule From 2026-05-22

From this date onward, every successful Discord alert send should append metadata records.

Tracked alert types:

- `recommendation-universe`
- `smart-money-pattern`
- `smart-money-watchlist`
- `recommendation-pattern`
- `korean-movers`
- `price-spike`

## Record Shape

Common fields:

- `schemaVersion`
- `id`
- `channel`
- `sentAt`
- `sentDate`
- `alertType`
- `source`
- `username`
- `messageCount`
- `messageIndex`
- `category`
- `profile`
- `symbol`
- `name`
- `bucket`
- `previousBucket`
- `changeType`
- `anchorDate`
- `latestMentionDate`
- `referenceDate`
- `metadata`

## Interpretation

`data/discord-alert-history.jsonl` is the source of truth for “what was actually alerted to Discord.”

`data/server-swing-picks.json` and `data/server-smallcap-swing-picks.json` are current state snapshots.

`data/recommendation-history/swing-history.json` is a recommendation outcome history, currently biased toward execution candidates and entered cases.

For later performance statistics, use the Discord alert log as the entry universe, then join to price history and recommendation history.

## Do Not Backfill Without Evidence

Older Discord alerts should not be invented from current state files. If past Discord messages are manually exported later, they can be imported as historical records with a separate `source`, but reconstructed records should be marked clearly in metadata.
