# 2026-05-27 Work Summary

오늘 작업은 스윙 히스토리 종료 기준과 현재 후보 저장 정책을 다시 맞춘 작업입니다.

## 문제

기존 의도는 “체결된 스윙 케이스는 손절가를 깨기 전까지 종료하지 않는다”였습니다.

하지만 실제 저장 흐름에는 빈틈이 있었습니다.

- 스윙 universe scan은 새 엔진 결과의 `executionItems`와 `watchItems`만 저장했습니다.
- 기존 체결 케이스를 새 스캔 결과에 다시 병합하는 단계가 없었습니다.
- 그래서 새 스캔에서 신선한 패턴이 사라진 종목은 현재 후보 파일에서 완전히 빠질 수 있었습니다.
- 히스토리는 현재 후보 파일에 없는 종목을 종료로 보므로, 손절 전 케이스도 종료 케이스로 닫힐 수 있었습니다.

대표 사례:

- `펄어비스`는 평균 매수가 49,400원, 손절가 39,800원, 종료 기준가 47,200원이었습니다.
- 손절가를 깨지 않았고 목표 수익률도 확정되지 않았습니다.
- 따라서 새 스캔에서 패턴이 빠졌더라도 종료가 아니라 관찰 유지가 맞습니다.

## 확정 정책

체결된 기존 스윙 케이스는 다음 조건 중 하나가 발생하기 전까지 종료하지 않습니다.

- 종가가 저장된 손절가 이하로 내려옴
- 목표 수익률 도달
- 완만 상승 종료 조건 충족
- 첫 체결 후 시간 종료 기준 도달
- 사용자가 명시적으로 수동 제거

새 스캔에서 다음 일이 발생해도 종료 사유가 아닙니다.

- 신선한 setup/breakout 패턴이 더 이상 잡히지 않음
- 품질 gate를 통과하지 못함
- `executionItems`에서 빠짐
- 엔진 점수가 낮아짐

이 경우 손절가 위에 있고 목표/시간 종료가 아니면 `watchItems`로 carry-forward 해야 합니다.

## 구현

`src/services/recommendationHistory.ts`:

- `readSwingCarryForwardCases` 추가
- `shouldCarryForwardSwingCase` 추가
- 손절/목표/시간 종료가 아닌 기존 체결 케이스를 carry-forward 대상으로 반환

`src/services/recommendationUniverse.ts`:

- 새 스캔 결과 저장 전에 carry-forward 대상 케이스를 `watchItems`에 병합
- 병합된 항목에는 `source: history-carry-forward`를 부여
- `carry_forward_until_stop`, `above_stop` reason을 남김
- 새 스캔 결과에 이미 같은 종목이 있으면 중복 병합하지 않음

## UI 기준

현재 추천 상태 화면은 매수 후보 화면입니다.

- `executionItems`만 현재 추천 상태에 표시합니다.
- `watchItems`는 화면에서 숨길 수 있습니다.
- 하지만 히스토리 생명주기 판단에서는 `executionItems`와 `watchItems`를 모두 현재 후보로 봅니다.

이 구분을 다시 섞으면 안 됩니다.

## 재발 방지 체크리스트

스윙 universe 저장 로직을 수정할 때 반드시 확인합니다.

- 기존 체결 케이스가 새 스캔 누락만으로 파일에서 사라지지 않는가
- 손절가 위의 체결 케이스가 `watchItems`에 남는가
- 목표 수익률 도달 케이스는 carry-forward에서 제외되는가
- 시간 종료 케이스는 carry-forward에서 제외되는가
- 현재 추천 상태 UI가 `watchItems`를 매수 후보처럼 보여주지 않는가
- 히스토리 생명주기 판단은 `watchItems`를 current로 인정하는가

## 검증

실행:

```bash
npm.cmd run check
node --check public\app.js
```

추가 확인:

- `readSwingCarryForwardCases("default")`가 `펄어비스 263750`을 carry-forward 대상으로 반환
- 반환된 손절가가 39,800원인지 확인
