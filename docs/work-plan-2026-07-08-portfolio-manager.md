# 2026-07-08 Work Plan - Portfolio Manager

기준일: 2026-07-08

- Status: Active - Recovery v1 implemented, execution-safety and manual CRUD follow-up pending
- Last updated: 2026-07-27

진행 메모:

- 2026-07-27 `PortfolioRecoveryPlan` DTO와 최신 조회 시세 snapshot 기준 손익분기/추가금/새 평단/회수 목표 계산을 구현했다.
- 기존의 관찰가 기반 `복구 단계` 진행률은 실제 진척도가 아니어서 제거하고 금액 흐름 카드로 교체했다.
- `ADD_WAIT`은 현재 추가금 0원을 유지하고 추가매수 시뮬레이션을 만들지 않는다. 손실이 깊을 때 표시하는 목표 반등률용 필요금은 실행안이 아니라 현재 부담을 설명하는 값이다.
- 최신 시세와 96시간 이내 주문가능금액이 모두 확인될 때만 `RECOVERY_READY`가 될 수 있다.
- 구현 후 감사에서 실제 회복 signal evidence, 추천 신호 유효기간, 계좌 실제 캡처 시각, quote-only 시세 경로를 다음 안전성 보강 범위로 확인했다.
- 서버의 기존 보유종목 API와 별개로, 사용자가 화면에서 수행하는 수동 보유종목 추가/수정/삭제 UI는 아직 계획 상태다.

후속 구현 순서와 완료 조건은 [2026-07-27 고도화 실행 계획](./project-enhancement-execution-plan-2026-07-27.md#4-phase-0--portfolio-execution-safety)을 따른다.

## 2026-07-07까지 정리된 상태

- Portfolio Manager는 추천 엔진이 아니라 보유 이후 의사결정 엔진으로 추가했다.
- Swing Engine, Long-Term Engine, Recommendation History는 직접 수정하지 않고 Portfolio Manager가 읽어서 재평가하는 구조다.
- `originalIntent`, `currentMode`, `suggestedIntent`, `aiAction`을 분리했다.
- 당시 `data/portfolio-holdings.json`에 입력한 초기 보유 데이터는 현재 Git 개발 원본 `data/development/portfolio/portfolio-holdings.json`으로 이동했다.
- 로컬 OCR은 `tesseract.js` 기반으로 붙였고, GPT 판독은 보조 버튼으로 남겼다.
- 첨부 스크린샷 기준으로 표 전용 파서가 보이는 6개 종목과 요약값을 읽는다.
- 하단에 가려진 원티드랩은 자동 OCR 대상에서는 제외하고, 초기 데이터에는 총평가금액 기준 역산값을 메모와 함께 넣었다.
- `ADD_WAIT`의 가격대를 매수 권고처럼 보이지 않도록 `watchPriceZone`으로 분리했다.
- `ADD_ALLOWED`, `ROTATION_BUY`일 때만 `addPriceZone`을 실제 추가매수 검토 구간으로 사용한다.
- 제넥신처럼 `REDUCE_ON_REBOUND`인 종목은 추가매수 구간을 표시하지 않고 반등 시 비중 축소 우선으로 해석한다.

## 2026-07-08 핵심 작업 계획

> 진행 상태: 아래 1~4의 Recovery DTO/계산/금액 중심 UI는 2026-07-27 구현했다. 5의 OCR/보유 데이터 보강과 수동 CRUD UI는 후속 계획이다.

### 1. Recovery Plan을 진짜 회복 전략으로 재설계

Recovery를 "훼손 종목 분류/경고"에서 실제 보유금액과 회수 목표를 설명하는 계산 구조로 확장했다.

구현된 핵심 DTO 구조:

```ts
type RecoveryPlanStatus =
  | "NOT_ELIGIBLE"
  | "WAIT_SIGNAL"
  | "RECOVERY_READY"
  | "REDUCE_ONLY";

type PortfolioRecoveryPlan = {
  status: RecoveryPlanStatus;
  currentInvestedAmount: number;
  currentEvaluationAmount: number;
  currentLossAmount: number;
  breakEvenPrice: number;
  requiredReboundRate: number;
  suggestedAdditionalBuyAmount?: number;
  maxAdditionalBuyAmount?: number;
  requiredAdditionalBuyAmountForTarget?: number;
  simulation?: PortfolioRecoverySimulation;
  invalidPrice?: number;
  summary: string;
  conditions: string[];
};
```

판단 원칙:

- `ADD_WAIT`은 매수 신호가 아니라 회복 신호 대기다.
- `REDUCE_ON_REBOUND`은 추가매수 금지, 반등 시 손실 축소 또는 비중 축소가 우선이다.
- `ADD_ALLOWED` 또는 `ROTATION_BUY`일 때만 현재 실행 가능한 예시 추가금을 합계에 포함한다.
- `ADD_WAIT`은 예시 추가금과 새 평단을 표시하지 않고 `지금 추가금 0원`과 신호 후 재계산 원칙만 보여준다.
- 추가매수는 평단 낮추기가 아니라 추가매수분 회수 계획이 있는 회복 플랜이어야 한다.
- 회복 플랜에는 최소한 손익분기 가격, 필요한 반등률, 1차 회수 목표, 최종 플러스 목표, 무효가가 있어야 한다.
- 무효가는 매 시세의 일정 비율로 따라 내려가지 않는다. 직접 연결되었거나 현재 진행 중인 스윙 손절가와 보유 평단 70% 중 높은 값을 쓰고, 종목명만 같은 종료 이력은 안전선 근거로 사용하지 않는다.

### 2. Recovery 계산 로직 추가

규칙 기반으로 구현했다.

- 현재 손실금액: `evaluationAmount - investedAmount`
- 손익분기 가격: `investedAmount / quantity`
- 손익분기까지 필요한 반등률: `(breakEvenPrice - currentPrice) / currentPrice * 100`
- 추가매수 가능 시 새 평단 시뮬레이션
- 추가매수분 회수 목표가
- 1차 추가금 회수 매도 후 남은 수량을 반영해 다시 계산한 최종 플러스 마감 목표가
- 무효가 이탈 시 추가매수 금지 또는 축소 우선 전환
- 입력 매수금액이 `평균단가×수량`과 2% 이상 다르면 원가 입력 오류로 보고 보정
- 최근 4일 이내 시세와 96시간 이내 계좌 주문가능금액·추정 총자산이 없으면 추가금 0원으로 차단
- 추가 후 누적 매수원금과 평가금 중 큰 값이 추정 총자산의 15%를 넘지 않도록 종목 상한 적용

종목별 예외 방향:

- 제넥신: 현재 판단이 비중 축소라면 Recovery Plan은 `REDUCE_ONLY`가 기본이다.
- 삼륭물산: 스윙 훼손이므로 `WAIT_SIGNAL` 또는 조건 충족 시 `RECOVERY_READY`로 전환 가능하다.
- CJ대한통운: 중장기 의도 유지 여부와 현재 가격 위치를 기준으로 회전매수 가능 여부를 별도로 판단한다.

### 3. PortfolioAdvice 타입 확장

`PortfolioAdvice`에 `recoveryPlan?: PortfolioRecoveryPlan`을 추가했다.

적용 파일:

- `src/services/portfolio/types.ts`
- `src/services/portfolio/rules.ts`
- `src/services/portfolio/portfolioManager.ts`
- `public/app.js`
- `public/app.css`

### 4. UI 표현 정리

카드와 상세 모달에 금액 기준 Recovery Plan을 별도 섹션으로 표시한다. 동일한 최신 조회 시세 snapshot으로 advice를 함께 재계산해 현재가와 행동/Recovery 숫자가 어긋나지 않게 했다.

표시 항목:

- 현재 손실금액
- 손익분기 가격
- 손익분기까지 필요한 반등률
- 추가매수 가능 여부
- 추가매수 시뮬레이션 평단
- 1차 회수 목표
- 최종 플러스 목표
- 반등 시 축소 구간
- 무효 조건

문구 기준:

- "관찰 구간": 매수 권고 아님
- "추가매수 가능 구간": `ADD_ALLOWED` 또는 `ROTATION_BUY`일 때만 표시
- "비중 축소 구간": `REDUCE_ON_REBOUND`일 때 강조
- "회복 신호 대기": 거래량, 지지, 이동평균 회복 전까지 추가매수 금지

### 5. OCR/보유 데이터 흐름 보강

현재 표 전용 OCR 파서는 첨부 스크린샷에는 맞지만, 다른 증권앱까지 안정적으로 보장하지는 않는다.

보완할 것:

- OCR 결과에 `parserType`, `visibleRowCount`, `warnings`를 더 명확히 표시
- 하단 메뉴에 가려진 행은 자동 저장하지 않고 "가려진 행 가능성" 경고 표시
- 기존 보유 종목이 새 스크린샷에 안 보인다고 바로 삭제하지 않기
- 실제 계좌번호/개인정보는 rawText 저장 또는 로그 노출을 최소화
- 테스트용으로 실제 스크린샷 대신 마스킹된 OCR 텍스트 fixture를 만들기

### 6. 검증

작업 후 실행할 명령:

```bash
node --check public\app.js
npm.cmd run check
npm.cmd run verify:portfolio-recovery
npm.cmd run build
```

확인할 API:

```bash
GET /portfolio/holdings
GET /portfolio/advice
POST /portfolio/screenshot/ocr-local
```

검증 기준:

- 제넥신은 추가매수 구간이 표시되지 않아야 한다.
- `REDUCE_ON_REBOUND` 종목은 회복 플랜이 `REDUCE_ONLY` 또는 그에 준하는 상태로 보여야 한다.
- `ADD_WAIT` 종목은 `watchPriceZone`만 표시되어야 한다.
- `ADD_ALLOWED`, `ROTATION_BUY`일 때만 `addPriceZone`과 추가매수 시뮬레이션이 표시되어야 한다.
- Recovery Plan은 손실 축소와 최종 플러스 마감 목표를 숫자로 설명해야 한다.
