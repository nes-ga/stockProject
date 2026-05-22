# News Signal Target Policy

Date: 2026-05-22

## Purpose

News signals should not be limited to a small set of representative large-cap names. The dashboard should also catch news on stocks that are currently being managed as actionable ideas or long-term watch ideas.

## Current Target Universe

The news collector now builds its target dictionary dynamically from these sources:

1. Representative base names kept from the original dictionary
   - 삼성전자
   - SK하이닉스
   - 한화오션
   - LG에너지솔루션
   - 셀트리온
   - 카카오
   - HMM

2. Swing execution candidates
   - `data/server-swing-picks.json` `executionItems`
   - `data/server-smallcap-swing-picks.json` `executionItems`

3. Long-term candidates
   - `data/server-long-term-picks.json`
   - both `buy` and `watch` buckets

Swing `watchItems` are intentionally excluded for now. They are useful for chart monitoring, but too broad and noisy as Naver Search API targets.

## Limits

- Maximum dynamic company references: `50`
- Naver Search API display count per query: `10`
- Recent-news lookback: `36` hours
- Refresh interval: `5` minutes
- Fetch concurrency: `1`
- Delay between target requests: `350ms`

The conservative concurrency is intentional. Expanding the target universe can trigger Naver API `429 Too Many Requests` responses if requests are fired in parallel.

## Matching Rule

Each target uses:

- company name
- explicit aliases from `corporateAliases.ts`
- aliases already present on universe items when available

A news item must still match the company alias in the title after search. This is a second gate after the query itself.

## Event Classification Adjustments

To reduce false positives:

- `공급` alone is no longer treated as a contract keyword.
- `잠정` alone is no longer treated as an earnings keyword.
- Contract matching still accepts `수주`, `공급계약`, `계약 체결`, `납품`, `수주 계약`.
- Earnings matching still accepts `실적`, `영업이익`, `매출`, `잠정실적`, `순이익`, `적자`, `실적 발표`.

Reason:

- 카카오뱅크 대출 공급 articles were being classified as contract news for 카카오.
- 삼성전자 노조 잠정합의안 articles were being classified as earnings news.

## Maintenance Notes

If news coverage is still too narrow, consider adding one more target source at a time:

- swing `watchItems` with strict cap
- dividend buy/watch candidates
- selected theme leaders

If news noise is too high, tighten in this order:

1. event keyword rules
2. alias matching
3. target universe limits
4. source-specific exclusions