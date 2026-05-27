# 2026-05-27 History Cleanup Summary

오늘 추가 작업은 스윙 히스토리와 현재 후보 표시가 섞이면서 생긴 중복, 신규 watch 편입, stale carry-forward 문제를 정리한 작업입니다.

## 문제

히스토리 화면과 데이터 파일에서 다음 문제가 확인됐습니다.

- `watchItems`를 화면에서 전부 숨기면 삼륭물산처럼 기존 체결 케이스가 `watch`로 내려갔을 때 히스토리 현재 목록에서 보이지 않았습니다.
- 반대로 `watchItems`를 넓게 허용하면 극동유화처럼 신규 관찰 후보가 히스토리 케이스로 새로 열렸습니다.
- `recommendationHistory.ts`가 현재 후보 파일을 직접 읽어서, 소형 스윙의 기본 스윙 중복 제거 로직을 우회했습니다.
- 흥구석유는 손절가를 종가 기준으로 이탈했는데도 stale `history-carry-forward` 항목이 현재 후보에 남았습니다.
- 미체결 현재 후보는 최신 현재가가 갱신되지 않아 화면에서 현재가가 비었습니다.
- 미체결 후보에는 평균 매수가가 없는데, UI가 평균 매수가만 표시하려 해서 가격 의미가 섞였습니다.

## 확정 기준

스윙 히스토리 기준은 다음으로 고정합니다.

- 신규 `watchItems`는 히스토리 케이스를 새로 열지 않습니다.
- 기존 히스토리 케이스가 `watchItems`로 내려간 경우는 종료가 아니라 강등으로 보고 유지할 수 있습니다.
- 다만 손절가 이탈, 목표 수익 도달, 시간 종료 같은 실제 종료 조건은 현재 후보 매칭보다 우선합니다.
- `history-carry-forward`는 최신 종가를 확인한 뒤 손절가 위에 있을 때만 허용합니다.
- 현재 히스토리 UI에서는 신규 watch는 숨기고, 기존 히스토리와 체결 가정이 있는 watch만 표시합니다.
- 미체결 후보는 평균 매수가가 아니라 1차 매수가를 표시합니다.

## 구현

`src/services/recommendationHistory.ts`:

- 현재 스윙 후보 읽기를 raw JSON 직접 읽기에서 `readServerSwingPickPayload()` 경유로 변경했습니다.
- 신규 watch 후보가 `postEntryOutcome.executedBuyCount`만으로 히스토리 케이스를 열지 않도록 `shouldUpsertCurrentHistoryCase`를 보정했습니다.
- `isStopBrokenHistoryCase`와 `getEffectiveLifecycleStatus`를 추가해 손절 이탈을 current 매칭보다 우선 처리했습니다.
- active no-entry 케이스도 `buyPlan`이 있으면 최신 시장가를 refresh하도록 했습니다.
- carry-forward 대상 판정 전에 최신 시장가를 refresh해 stale 가격으로 손절 이탈 케이스를 살리지 않도록 했습니다.
- 체결된 watch 케이스가 손절 이탈하면 `관찰 종료`가 아니라 `손절 종료`로 분류되도록 했습니다.

`public/app.js`:

- 현재 히스토리 목록에서 신규 watch는 숨기되, 기존 히스토리 케이스와 체결 가정이 있는 watch는 표시하도록 조건을 좁혔습니다.
- 손절 종료된 watch 히스토리 케이스는 현재 목록에 표시되지 않도록 했습니다.
- 평균 매수가가 없는 미체결 후보는 `1차` 매수가를 표시하도록 했습니다.
- 차트 모달 요약도 평균 매수가 또는 1차 매수가를 구분해 표시하도록 했습니다.

데이터 정리:

- 잘못 생성된 2026-05-27 신규 watch 히스토리 5건을 제거했습니다.
- 흥구석유 default의 stale `history-carry-forward` 현재 후보 항목을 제거했습니다.
- 히스토리 파일을 새 기준으로 재계산했습니다.

## 확인 사례

삼륭물산 `014970`:

- 기존 히스토리 케이스입니다.
- 현재 `watch`로 내려갔지만 3차 체결 가정이 있으므로 현재 히스토리 목록에 남습니다.
- 상태: `current`, `active_entered`, `executedBuyCount: 3`

극동유화 `014530`:

- 신규 watch 후보가 default/smallcap 양쪽에서 히스토리로 열리던 문제가 있었습니다.
- 현재는 히스토리 케이스에서 제거됐고, 신규 watch로만 남습니다.
- 히스토리 현재 목록에는 표시하지 않습니다.

흥구석유 `024060`:

- default 케이스는 최신 종가 `13,160원`, 손절가 `14,060원`으로 손절 이탈입니다.
- 상태: `closed`, `stop_broken`, 평균 매수가 `14,948.86원`, 수익률 `-11.97%`
- smallcap 쪽은 별도 watch이고 미체결 상태라 매수 히스토리로 보지 않습니다.

현재가 누락 케이스:

- 삼영 `003720`
- 희림 `037440`
- 슈프리마에이치큐 `094840`
- 아이티센씨티에스 `031820`

위 4개는 미체결 실행 후보였고, 수정 후 현재가 누락은 0건입니다. 평균 매수가가 없는 경우에는 1차 매수가를 표시합니다.

## 검증

실행:

```bash
npm.cmd run check
node --check public\app.js
```

결과:

- TypeScript check 통과
- `public/app.js` 문법 검사 통과
- 현재가 누락 0건
- 평균 또는 1차 매수가 누락 0건
