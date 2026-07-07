# 2026-07-08 Work Plan - Portfolio Manager

기준일: 2026-07-08

## 2026-07-07까지 정리된 상태

- Portfolio Manager는 추천 엔진이 아니라 보유 이후 의사결정 엔진으로 추가했다.
- Swing Engine, Long-Term Engine, Recommendation History는 직접 수정하지 않고 Portfolio Manager가 읽어서 재평가하는 구조다.
- `originalIntent`, `currentMode`, `suggestedIntent`, `aiAction`을 분리했다.
- `data/portfolio-holdings.json`에 국내주식잔고 스크린샷 기준 초기 보유 데이터를 입력했다.
- 로컬 OCR은 `tesseract.js` 기반으로 붙였고, GPT 판독은 보조 버튼으로 남겼다.
- 첨부 스크린샷 기준으로 표 전용 파서가 보이는 6개 종목과 요약값을 읽는다.
- 하단에 가려진 원티드랩은 자동 OCR 대상에서는 제외하고, 초기 데이터에는 총평가금액 기준 역산값을 메모와 함께 넣었다.
- `ADD_WAIT`의 가격대를 매수 권고처럼 보이지 않도록 `watchPriceZone`으로 분리했다.
- `ADD_ALLOWED`, `ROTATION_BUY`일 때만 `addPriceZone`을 실제 추가매수 검토 구간으로 사용한다.
- 제넥신처럼 `REDUCE_ON_REBOUND`인 종목은 추가매수 구간을 표시하지 않고 반등 시 비중 축소 우선으로 해석한다.

## 2026-07-08 핵심 작업

### 1. Recovery Plan을 진짜 회복 전략으로 재설계

현재 Recovery는 "훼손 종목 분류/경고"에 가깝다. 7월 8일에는 사용자가 말한 의미의 회복, 즉 손실을 줄이고 최종적으로 이득으로 마무리하기 위한 계산 구조를 추가한다.

추가할 DTO 초안:

```ts
type RecoveryPlanStatus =
  | "NOT_ELIGIBLE"
  | "WAIT_SIGNAL"
  | "RECOVERY_READY"
  | "REDUCE_ONLY";

type PortfolioRecoveryPlan = {
  status: RecoveryPlanStatus;
  currentLossAmount: number;
  breakEvenPrice: number;
  requiredReboundRate: number;
  maxAdditionalBuyAmount?: number;
  simulatedAvgPrice?: number;
  firstRecoveryTarget?: number;
  finalProfitTarget?: number;
  reducePlan?: string;
  invalidPrice?: number;
  summary: string;
  conditions: string[];
};
```

판단 원칙:

- `ADD_WAIT`은 매수 신호가 아니라 회복 신호 대기다.
- `REDUCE_ON_REBOUND`은 추가매수 금지, 반등 시 손실 축소 또는 비중 축소가 우선이다.
- `ADD_ALLOWED` 또는 `ROTATION_BUY`일 때만 추가매수 시뮬레이션을 계산한다.
- 추가매수는 평단 낮추기가 아니라 추가매수분 회수 계획이 있는 회복 플랜이어야 한다.
- 회복 플랜에는 최소한 손익분기 가격, 필요한 반등률, 1차 회수 목표, 최종 플러스 목표, 무효가가 있어야 한다.

### 2. Recovery 계산 로직 추가

규칙 기반으로 먼저 구현한다.

- 현재 손실금액: `evaluationAmount - investedAmount`
- 손익분기 가격: `investedAmount / quantity`
- 손익분기까지 필요한 반등률: `(breakEvenPrice - currentPrice) / currentPrice * 100`
- 추가매수 가능 시 새 평단 시뮬레이션
- 추가매수분 회수 목표가
- 최종 플러스 마감 목표가
- 무효가 이탈 시 추가매수 금지 또는 축소 우선 전환

종목별 예외 방향:

- 제넥신: 현재 판단이 비중 축소라면 Recovery Plan은 `REDUCE_ONLY`가 기본이다.
- 삼륭물산: 스윙 훼손이므로 `WAIT_SIGNAL` 또는 조건 충족 시 `RECOVERY_READY`로 전환 가능하다.
- CJ대한통운: 중장기 의도 유지 여부와 현재 가격 위치를 기준으로 회전매수 가능 여부를 별도로 판단한다.

### 3. PortfolioAdvice 타입 확장

`PortfolioAdvice`에 `recoveryPlan?: PortfolioRecoveryPlan`을 추가한다.

적용 파일 후보:

- `src/services/portfolio/types.ts`
- `src/services/portfolio/rules.ts`
- `src/services/portfolio/portfolioManager.ts`
- `public/app.js`
- `public/app.css`

### 4. UI 표현 정리

Recovery Plan이 있으면 카드에 별도 섹션으로 보여준다.

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
