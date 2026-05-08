# 작업 요약 2026-04-13

## 범위

추천 화면 UI, 시장 감시 날짜 처리, 스윙 universe 저장 구조, 스마트머니 문서 정렬 작업입니다.

## 추천 화면

- 추천 종목 탭을 `중장기`, `배당`, `스윙` 3개 1차 카테고리로 정리했습니다.
- anchor price line이 일봉뿐 아니라 주봉/월봉 집계 candle에서도 가까운 기준 bar에 맞도록 조정했습니다.
- 주봉/월봉에서는 anchor date 이전 또는 같은 날짜의 집계 bar를 기준으로 표시합니다.

## 시장 감시

- 감시 대상:
  - `KOSPI`
  - `KOSDAQ`
  - `USD/KRW`
  - `GOLD`
  - `WTI`
  - `BTC`
- UI 날짜 표시를 서울 기준 fetch 시각에 맞춰 정리했습니다.
- 자산별 source session 차이로 latest date가 다를 수 있음을 코드/문서에 반영했습니다.
- BTC는 최신 live bar가 잘리지 않도록 일봉/주봉 aggregation을 조정했습니다.

## 스마트머니 / 스윙 엔진

- universe scan 저장 payload를 bucket 구조로 정리했습니다.
- `data/server-swing-picks.json`는 다음 구조를 보존합니다.
  - `executionItems`
  - `watchItems`
  - `items`
- `matched`와 `actionable`의 의미를 문서에서 분리했습니다.
- 초기 저품질 눌림 후보가 실행 bucket으로 들어가지 않도록 classification 기준을 강화했습니다.

## 검증

실행:

```bash
npm run check
npm run build
npm run scan:swing-universe
```

## 관련 파일

- `public/app.css`
- `public/app.js`
- `src/services/marketWatch.ts`
- `src/services/recommendationUniverse.ts`
- `docs/current-implemented-features.md`
- `docs/smart-money-maintenance.md`
