# 2026-05-12 Work Summary

오늘 작업은 스윙 추천 히스토리의 신뢰도를 높이고, 현재 추천 상태에서 바로 차트를 확인할 수 있게 만드는 데 집중했습니다.

## Recommendation History

### 수익률 표시 보강

- 현재 추천 후보 중 기존 히스토리 케이스와 매칭되지 않는 신규 후보도 수익률을 표시하도록 수정했습니다.
- `postEntryOutcome`에 `latestClose`, `latestDate`, `unrealizedReturnPct`를 추가했습니다.
- 히스토리 UI는 `historyCase.unrealizedReturnPct`가 없으면 live `postEntryOutcome.unrealizedReturnPct`를 사용합니다.

관련 파일:

- `src/services/smartMoneyEnhancer.ts`
- `src/types.ts`
- `public/app.js`

### 동전주 제외

- SGA솔루션즈 `184230`처럼 1000원 이하 종목이 히스토리에 남는 문제를 정리했습니다.
- 히스토리 읽기, 갱신, 시드 생성 단계에 모두 `<= 1000` 필터를 적용했습니다.
- `data/recommendation-history/swing-history.json`을 재계산했고, 1000원 이하 케이스는 0건으로 확인했습니다.

관련 파일:

- `src/services/recommendationHistory.ts`
- `src/scripts/seedSwingRecommendationHistory.ts`
- `data/recommendation-history/swing-history.json`

## Current Recommendation Chart Modal

현재 추천 상태 카드에서 종목 차트를 바로 열 수 있도록 팝업을 추가했습니다.

- 현재 추천 상태 카드 클릭, Enter, Space 입력 지원
- `/analysis/realtime-stock-detail`을 호출해 기존 종목 상세 차트 데이터를 재사용
- 캔들, 거래량, 5/20/60/120일선 표시
- 평균 매수가와 손절가 라인 표시
- 현재가, 평균 매수가, 수익률, 체결 단계를 요약 카드로 표시

관련 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`

## Swing History Outcome Rules

스윙 후보가 현재 추천에서 빠졌을 때 단순 종료가 아니라 결과 사유를 남기도록 기준을 추가했습니다.

종료 유형:

- `target_hit`: 슈팅 수익
- `drift_profit_exit`: 완만 상승 종료
- `entry_missed_upside`: 매수 전 제외
- `stop_broken`: 손절 종료
- `stale_timeout`: 시간 종료
- `closed_unknown`: 일반 종료

기본 기준:

- 슈팅 수익: 평균 매수가 대비 +10%, 3차 체결은 +8%
- 완만 상승 종료: 평균 매수가 대비 +5% 이상, 1차 매수가 대비 +7% 이상 위로 이탈
- 매수 전 제외: 체결 없이 후보에서 빠진 경우, 특히 1차 매수가 대비 +7% 이상 위로 이탈
- 손절 종료: 종가가 손절가 이하
- 시간 종료: 첫 체결 후 20거래일 이상 목표/손절 없이 후보 이탈

현재 재계산 결과:

- 전체 히스토리: 97건
- 체결 케이스: 67건
- 매수 전 케이스: 30건
- 시간 종료: 1건
- `historyOutcome` 누락: 0건

관련 파일:

- `src/services/recommendationHistory.ts`
- `public/app.js`
- `public/app.css`
- `data/recommendation-history/swing-history.json`

## Data Regeneration

오늘 재계산한 데이터:

- `data/recommendation-history/swing-history.json`

현재 히스토리 API 확인:

- `GET /analysis/recommendation-history/swing`: 200

## Verification

실행한 검증:

```bash
npm.cmd run check
node --check public\app.js
npm.cmd run build
```

추가 확인:

- 히스토리 API 응답 200
- 히스토리 내 `historyOutcome` 누락 0건
- 히스토리 내 1000원 이하 동전주 케이스 0건

## Main Changed Files

- `src/services/recommendationHistory.ts`
- `src/services/smartMoneyEnhancer.ts`
- `src/types.ts`
- `src/scripts/seedSwingRecommendationHistory.ts`
- `public/index.html`
- `public/app.js`
- `public/app.css`
- `data/recommendation-history/swing-history.json`
