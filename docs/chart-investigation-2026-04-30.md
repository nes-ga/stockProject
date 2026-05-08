# 차트 이슈 조사 기록

기준일: 2026-05-08

## 조사 배경

일부 차트에서 공휴일/비거래일이 포함되면서 캔들 사이가 비어 보이는 문제가 있었습니다. 별도로 `open = 0` 데이터가 차트 문제의 원인인지도 확인했습니다.

## 결론

`open = 0` 하나만으로는 비거래/거래정지 candle로 보지 않습니다.

비거래 또는 거래정지 형태로 보는 조건은 다음 값이 모두 0에 가까운 경우입니다.

```ts
return (
  (point.open ?? 0) === 0 &&
  (point.high ?? 0) === 0 &&
  (point.low ?? 0) === 0 &&
  (point.volume ?? 0) === 0
);
```

즉:

- `open = 0` 단독으로는 차트 공백 원인이 아닙니다.
- OHLCV 전체가 비정상적인 행이면 별도 처리 대상입니다.
- 데이터 source가 공휴일을 zero row로 내려주는 경우는 제거/whitespace 처리가 필요합니다.

## 실제 보정

프론트 차트 변환에서 누락된 평일을 임의 whitespace point로 채우던 흐름을 제거했습니다.

변경 방향:

- 실제 거래 데이터만 `toChartPoints`에서 반환
- 공휴일/휴장일을 강제로 채우지 않음
- index chart와 종목 chart 모두 빈 candle로 기간을 늘리지 않도록 정리

관련 파일:

- `public/app.js`
- `src/services/stockAnalysis.ts`

## 현재 차트 해석 원칙

- 거래일 데이터가 없으면 차트에 억지 candle을 넣지 않습니다.
- source가 zero-filled OHLCV를 주면 비거래/거래정지 point로 판단합니다.
- 시장별 거래일 차이는 source session 차이로 볼 수 있습니다.
- BTC처럼 24/7에 가까운 자산은 최신 live bar가 유지되어야 합니다.

## 추가 확인 포인트

차트가 다시 비정상적으로 보이면 다음 순서로 확인합니다.

1. 해당 날짜 raw point의 `open`, `high`, `low`, `close`, `volume`
2. `toChartPoints` 변환 결과
3. `isNonTradingPoint` 판정 여부
4. Lightweight Charts에 전달된 series data
5. tooltip, overlay, CSS가 chart container를 덮는지 여부

## 관련 연혁

- 2026-04-30: `open = 0` 단독 원인 가능성 조사
- 2026-05-08: 공휴일/비거래일 강제 whitespace 채움 제거
