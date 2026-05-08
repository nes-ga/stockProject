# 중장기 엔진 설계

기준일: 2026-05-08

## 목표

중장기 엔진은 “지금 당장 매수 타이밍인가”보다 “대표성이 있는 종목이 충분히 조정받고, 구조적으로 다시 보유 검토가 가능한가”를 평가합니다.

핵심 질문:

> 이 종목은 장기 관점에서 누적/회복/안정화 구조를 갖췄는가?

## 하지 않는 것

- 단기 돌파 추격 신호 생성
- 스윙 진입 타이밍 판단
- 매물대 점수만으로 BUY 승격
- 재무가 무너진 종목을 낙폭만 보고 통과

## 주요 파일

- `src/services/longTermEngine.ts`: 스캔/단일 리뷰 orchestration
- `src/services/longTerm/strategy.ts`: 후보 생성과 최종 점수
- `src/services/longTerm/config.ts`: 필터와 가중치
- `src/services/longTerm/leaderScore.ts`: 리더십
- `src/services/longTerm/correctionScore.ts`: 조정률
- `src/services/longTerm/trendScore.ts`: 추세
- `src/services/longTerm/liquidityScore.ts`: 유동성
- `src/services/longTerm/stabilizationScore.ts`: 바닥 안정화
- `src/services/longTerm/fundamentalScore.ts`: 재무/사업 구조
- `src/services/volumeProfile.ts`: 장기 매물대 구조

## 출력 구조

후보는 다음 정보를 포함합니다.

- 기본 정보: `symbol`, `name`, `sector`
- 가격 구조: `price`, `high52w`, `high2y`, `drawdownPct`
- 점수:
  - `leaderScore`
  - `correctionScore`
  - `trendScore`
  - `liquidityScore`
  - `stabilizationScore`
  - `financialScore`
  - `volumeProfileScore`
  - `totalScore`
- 이동평균/구조:
  - `ma60`, `ma120`, `ma240`
  - `ma120Slope`, `ma240Slope`
  - `priceVsMA120Pct`, `priceVsMA240Pct`
- 바닥권:
  - `recentLow`
  - `distanceFromLowPct`
  - `higherLowCount`
  - `daysSinceLastLowBreak`
  - `isStabilizing`
- 유동성:
  - `avgTurnover20`
  - `avgTurnover60`
  - `volumeConsistency`
- 재무:
  - `revenueTrend`
  - `operatingProfitTrend`
  - `netIncomeTrend`
  - `earningsState`
  - `roeState`
  - `debtState`
  - `businessClarity`
  - `financialMomentum`
  - `structuralRiskFlags`
- 장기 매물대:
  - `longTermVolumeProfile`
  - `volumeProfileAnalysis.longTerm`

## 기본 점수 구조

기본 weighted score:

- `leaderScore`: 25%
- `correctionScore`: 20%
- `trendScore`: 15%
- `liquidityScore`: 10%
- `stabilizationScore`: 15%
- `financialScore`: 15%

이후 `volumeProfileScore`를 보조 점수로 더합니다. 장기 매물대 점수는 -30 ~ +40으로 clamp합니다.

## 리더십 점수

- curated universe 여부가 가장 중요합니다.
- `core`, `primary`, `secondary` tier가 base를 결정합니다.
- 거래대금 ranking은 보조 조정입니다.
- ETF/ETN은 제외합니다.

## 조정률 점수

- 2년 고점 대비 조정을 기본으로 봅니다.
- 5년 고점은 보조 reference입니다.
- 깊은 조정 자체보다 “조정 후 회복/안정화”가 중요합니다.
- 최근 저점 부근에서 계속 무너지는 종목은 낮게 평가합니다.

## 추세 점수

- MA120/MA240 slope를 봅니다.
- MA240 하락은 명확한 penalty입니다.
- MA120 flattening은 중립입니다.
- MA120 turn-up은 구조 개선 신호입니다.
- MA120 위로 과도하게 이격되면 추격 위험으로 봅니다.

## 안정화 점수

- higher low count
- recent low break 여부
- base duration
- volume cooling
- 변동성 축소

## 재무 점수

재무는 단순 선형 penalty가 아니라 세 층으로 봅니다.

1. hard exclusion
2. weakness penalty
3. recovery/normalization bonus

hard exclusion 예:

- 지속 적자 + 악화 momentum
- 위험한 부채 구조 + 안정화 부재
- 사업 구조 붕괴 flag 다수

조정률이 이미 큰 leader는 일부 재무 약점 penalty를 이중 반영하지 않도록 완화합니다.

## 장기 매물대 점수

중장기 매물대는 스윙처럼 진입 타이밍을 잡는 용도가 아닙니다.

평가 목적:

- 장기 바닥권에서 거래량이 누적됐는가
- 현재가가 장기 주요 매물대 위에 있는가
- 장기 박스권 상단을 돌파하고 유지했는가
- 현재가 위 장기 매물 부담이 낮은가
- 고점권 대량거래 후 가격 정체 위험이 있는가

세부 점수:

- `accumulationBaseScore`: 장기 바닥권 누적
- `longBoxBreakoutScore`: 장기 박스권 돌파와 안착
- `longOverheadSupplyRisk`: 장기 위 매물 부담
- `highVolumeStallRisk`: 고점권 대량거래 정체
- `holdingQualityBySupply`: 매물대 기반 보유 품질
- `structuralBreakoutReliability`: 장기 박스 돌파 + 거래량 + 추세 동시 확인

대표 기간:

- 720일 데이터가 충분하면 `threeYear`
- 부족하면 `twoYear`
- 그마저 부족하면 `oneYear`

## 후보 분류

label:

- `leader correction watch`
- `deep value review`
- `base-forming candidate`
- `needs more stabilization`

candidate group:

- `buy candidate`
- `watch candidate`

`buy candidate`는 장기 분할 매수 검토가 가능하다는 뜻이지, 단기 진입 신호가 아닙니다.

## 단일 종목 리뷰

사용자가 직접 추가한 종목도 리뷰할 수 있습니다.

- curated 종목은 leader assumption을 더 강하게 받습니다.
- ad hoc 종목은 같은 framework로 평가하지만 대표성 점수가 낮을 수 있습니다.
- 장기 매물대 구조가 좋아도 재무/추세/유동성이 낮으면 최종 신뢰도를 과도하게 올리지 않습니다.

## 튜닝 원칙

- 후보가 너무 느슨하면 curated universe를 먼저 조정합니다.
- 재무가 약한 경기민감주가 너무 많이 통과하면 hard exclusion을 강화합니다.
- 후보가 너무 적으면 leader filter보다 stabilization 조건을 먼저 완화합니다.
- 스윙 엔진처럼 단기 실행 후보를 만들지 않습니다.

## 검증

```bash
npm run check
npm run build
npx tsx src/scripts/verifyVolumeProfile.ts
```

중장기 universe 검증:

```bash
npm run scan:long-term-universe
```
