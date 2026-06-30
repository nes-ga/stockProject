# 2026-06-30 Work Summary - Swing Recommendation History

오늘 작업은 스윙 추천 히스토리 화면을 “진행 중 추천 조회 + 종료된 거래 복기 + 미진입 제외 로그 확인” 구조로 재정리하고, 같은 종목의 반복 추천을 Cycle/Recovery 관점으로 해석할 수 있게 만드는 데 집중했다.

## 작업 배경

기존 스윙 추천 히스토리는 추천 후보, watch 전환, 종료 케이스, 미진입 케이스가 한 화면에서 섞여 보일 수 있었다. 이 때문에 사용자가 실제 매수가 발생한 거래 성과와 매수 없이 제외된 로그를 같은 성과 집합으로 오해할 가능성이 있었다.

또한 같은 종목이 손절 이후 다시 추천되는 경우가 있어도 화면에서는 독립 케이스처럼 보였기 때문에, 재추천 맥락과 복구 관찰 여부를 확인하기 어려웠다.

## 백엔드 변경

관련 파일:

- `src/services/recommendationHistory.ts`
- `src/routes/analysisRoutes.ts`
- `data/recommendation-history/swing-history.json`

주요 변경:

- `readSwingRecommendationHistory()` 응답 생성 단계에서 기존 JSON을 normalize한다.
- 각 history case에 `caseKind`, `displayGroup`, `returnStatsEligible`을 보강한다.
- 기존 JSON `schemaVersion: 1`은 유지하고 새 필드는 응답 DTO에서 optional로 다룬다.
- `updateSwingRecommendationHistoryFromCurrentPicks()` 저장 단계에서는 `cycleMeta`를 필수 저장하지 않는다.
- `summary`는 normalize된 cases 기준으로 재계산한다.

분류 기준:

- `executedBuyCount > 0`: `caseKind = "entered"`, `displayGroup = "거래 완료"`, `returnStatsEligible = true`
- `executedBuyCount === 0 && status === "closed"`: `caseKind = "no_entry"`, `displayGroup = "미진입 제외"`, `returnStatsEligible = false`
- `status === "active"`: `caseKind = "active"`, `displayGroup = "진행 중"`, `returnStatsEligible = false`

기존 `historyOutcome.includeInReturnStats`가 있으면 우선 존중하고, 없을 때만 위 기준으로 fallback 계산한다.

## Summary 구조

`summary`에 아래 값을 추가했다.

```js
{
  totalCases,
  activeCases,
  closedCases,
  enteredCases,
  noEntryCases,
  profitExitCases,
  stopBrokenCases,
  avgReturnPct,
  returnStatsBaseCount,
  cycleSummary
}
```

성과 통계 기준:

- 평균 수익률은 `returnStatsEligible === true`인 거래 완료 케이스 기준이다.
- 수익 종료/손절 통계는 실제 매수가 발생한 케이스 기준이다.
- 미진입 제외는 기본 성과 통계에서 제외한다.

## Cycle/Recovery 추가

`cycleNo`와 `cycleMeta`는 원본 JSON에 저장하지 않고, `readSwingRecommendationHistory()` 응답 DTO 생성 단계에서 계산한다.

Cycle 계산:

- `cycleKey = ${strategy}:${profile}:${symbol}`
- `cycleKey`별로 cases를 묶는다.
- 각 그룹을 `openedDate asc`, `id asc`로 정렬한다.
- 정렬 순서대로 `cycleNo = index + 1`을 부여한다.
- `no_entry`도 추천 시도였으므로 Cycle 번호에는 포함한다.

Recovery 판정:

- 현재 case가 `no_entry`이면 Recovery 표시 대상이 아니다.
- 현재 case가 `active`이거나 실제 매수가 발생한 거래 케이스일 때만 Recovery 대상이 될 수 있다.
- 현재 case보다 과거에 있는 가장 가까운 “거래 손실 종료 케이스”를 찾는다.
- `no_entry`는 Recovery 원인에서 제외한다.
- 손실 종료 케이스의 `closedDate` 기준 120일 이내면 Recovery로 본다.
- `closedDate`가 없으면 `openedDate`로 fallback한다.

손실 outcome 예:

- `stop_broken`
- `market_shock_stop`
- `deep_zone_timeout_exit`
- `closed_unknown` 중 음수 수익률
- `stop_loss`
- `loss_exit`
- `invalidated`
- `failed`
- `danger_exit`

성공 outcome 예:

- `target_hit`
- `deep_zone_rebound_exit`
- `drift_profit_exit`
- `profit_exit`
- `target_reached`
- `shooting_profit`
- `upside_exit`
- `take_profit`

`summary.cycleSummary`:

```js
{
  cycledSymbols,
  multiCycleSymbols,
  totalCycles,
  recoveryCycles,
  recoverySuccessCases,
  recoverySuccessRate,
  avgDaysToRecovery
}
```

## 프론트 UI 변경

관련 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`

화면 역할을 아래처럼 분리했다.

- 좌측: 진행 중 추천 조회
- 우측: 종료 케이스 복기
- 미진입 제외: 기본 화면에서 과도하게 노출하지 않고 필터로 확인

상단 요약 카드:

- 추적 케이스
- 진행 중
- 거래 완료
- 평균 수익률
- 수익 종료
- 미진입 제외

종료 케이스 필터:

- 거래완료
- 수익
- 손절
- 미진입 제외
- 기타

기본 선택값은 `거래완료`다.

## 카드 렌더링 변경

진행 중 추천 카드:

- 현재가, 평균가, 1차/2차/3차 매수가, 미도달/체결 상태를 유지한다.
- “히스토리 화면에서 직접 관리한다”는 느낌을 줄이기 위해 스윙 관리 이동 CTA는 제거했다.
- 좌측 패널은 우측 종료 케이스 목록 높이에 맞춰 늘어나지 않도록 했다.

종료 케이스 카드:

- 거래완료 케이스는 수익률, 평균 매수가, 종료가, 보유기간, 매수차수를 표시한다.
- 미진입 제외 케이스는 수익률/실현수익처럼 보이는 표현 없이 간략 카드로 분리한다.
- 종료 카드의 매수가 영역은 한 줄로 표시한다.
- 매수가 칸은 `1차 12,345 06-30` 형태로 라벨, 가격, 날짜를 한 줄에 보여준다.

Cycle 표시:

- 진행 중 추천 카드: `Cycle 1 · 진행중`, `Cycle 3 · Recovery · 진행중`
- 종료 케이스 카드: `Cycle 1`, `Cycle 2 · Recovery`, `Cycle 4 · 미진입 제외`
- Recovery인 경우 “이전 손절 후 N일 만에 재추천” 문구를 표시한다.
- `no_entry`에는 Cycle 번호만 표시하고 Recovery 배지는 표시하지 않는다.

상세/차트 모달:

- 별도 API를 만들지 않고, frontend payload의 `cases`를 `cycleMeta.cycleKey` 기준으로 묶어 Cycle timeline을 표시한다.
- 예: `Cycle 1 | 2026-05-11 | 손절 | -7.2%`

## 레이아웃 조정

요약 카드:

- 상단 6개 카드가 한 줄에 들어가도록 크기를 줄였다.

종료 케이스 탭:

- 5개 필터 카드가 한 줄에 들어가도록 크기를 줄였다.

진행 중 추천 영역:

- 2단 layout은 유지한다.
- 좌측 진행 중 추천 패널은 `align-self: flex-start`와 `height: auto`로 콘텐츠 높이만 차지하게 했다.
- 우측 종료 케이스 목록만 `max-height / overflow-y: auto`로 독립 스크롤된다.
- 모바일/좁은 화면에서는 세로 배치되더라도 진행 중 카드가 과하게 늘어나지 않게 했다.

## 검증

실행한 검증:

```bash
node --check public\app.js
npm.cmd run check
npm.cmd run build
```

결과:

- `public/app.js` 문법 체크 통과
- TypeScript `tsc --noEmit` 통과
- 전체 build 통과

API DTO 확인:

- `readSwingRecommendationHistory()` 직접 호출로 `summary.cycleSummary`와 `cycleMeta` 계산 경로를 확인했다.
- 현재 실제 데이터 기준으로는 같은 `strategy/profile/symbol` 반복 케이스가 없어 `multiCycleSymbols`와 `recoveryCycles`는 0으로 확인됐다.

## 주의사항

- `cycleMeta`는 응답 DTO 전용 계산값이다. 원본 `swing-history.json`에는 저장하지 않는다.
- `no_entry`는 Cycle 번호에는 포함하지만 Recovery 원인/대상에서는 제외한다.
- 평균 수익률은 전체 추천 케이스 기준이 아니라 거래완료/returnStatsEligible 기준이다.
- watch 전환만으로 추천 히스토리에서 빠지면 안 된다. 손절가나 종료 조건을 만족하지 않은 케이스는 진행 중 추천으로 남아야 한다.
- 매수 없이 종료된 케이스는 성과 통계가 아니라 미진입 제외 로그로 다룬다.
