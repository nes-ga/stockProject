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
- 상장/거래 연혁이 짧은 신생 성장주를 중장기 회복 후보로 별도 편입

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

이후 `volumeProfileScore`와 `higherTimeframeScore`를 보조 점수로 더합니다. 장기 매물대 점수는 -30 ~ +40으로 clamp합니다.

`higherTimeframeScore`는 주봉/월봉 보조축입니다. 일봉 저점 확인이 덜 됐더라도, 주봉/월봉에서 장기 조정 하단부와 추세 회복 여지가 확인되면 관찰 후보 유지에 도움을 줍니다. 단, 매수 후보 승격은 일봉 안정화 조건까지 함께 봅니다.

## 리더십 점수

- curated universe 여부가 가장 중요합니다.
- `core`, `primary`, `secondary` tier가 base를 결정합니다.
- 거래대금 ranking은 보조 조정입니다.
- ETF/ETN은 제외합니다.
- 전체 universe에서 올라오는 ad hoc 종목은 curated 종목보다 더 엄격하게 봅니다.
- ad hoc 종목은 충분한 거래 연혁, 60일 평균 거래대금, 전체/섹터 거래대금 순위, leaderScore 기준을 통과해야 합니다.
- 현재 stock universe 데이터에는 시가총액과 상장일이 없으므로, 거래대금과 차트 연혁을 대표성 proxy로 사용합니다.

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

## 주봉/월봉 보조축

중장기 엔진은 일봉 구조만으로 대형/curated 종목을 판단하지 않습니다.

주봉:

- 20주/40주 이동평균
- 20주/40주 기울기
- 현재가의 40주선 대비 위치
- 104주 고점 대비 조정률
- 최근 52주 저점 이후 경과 주수

월봉:

- 12개월/24개월 이동평균
- 12개월/24개월 기울기
- 현재가의 24개월선 대비 위치
- 60개월 고점 대비 조정률
- 최근 36개월 저점 이후 경과 개월 수

반영 원칙:

- 보조축 점수는 `higherTimeframeScore`로 `-15 ~ +18` 범위에서만 반영합니다.
- 주봉/월봉이 좋다고 바로 매수 후보가 되지는 않습니다.
- 일봉 저점 갱신 직후인 종목도 주봉/월봉 구조가 좋고 대표성/재무가 강하면 관찰 후보로 남길 수 있습니다.
- 주봉/월봉까지 약하면 일봉 구조가 일시적으로 좋아도 신뢰도를 낮춥니다.

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

매수 후보 추가 원칙:

- `buy candidate`는 단순히 구조/추세/재무 점수가 높다고 부여하지 않습니다.
- 최소한 `strongDrawdownPct = 35%` 수준의 강한 조정이 있어야 합니다.
- 조정률이 25~35% 수준이면 대표성/재무/주봉/월봉이 좋아도 원칙적으로 관찰 후보입니다.
- 월봉 장기 이격이 큰 종목은 주봉이 좋아도 추격 위험을 별도로 봅니다.

## 연혁과 대표성 필터

2026-05-18 기준으로 중장기 엔진은 신생 성장/회복 관찰 후보를 별도로 만들지 않습니다.

현재 정책:

- 최소 차트 연혁은 `minimumHistorySessions = 720`입니다.
- 차트 연혁이 부족한 종목은 중장기 후보에서 제외합니다.
- ad hoc 종목은 curated 대표주보다 더 높은 대표성 기준을 적용합니다.
- ad hoc 종목의 60일 평균 거래대금 기준은 `minimumAdHocTradableTurnover60 = 150억 원`입니다.
- ad hoc 종목은 전체 거래대금 순위 `80위 이내`이면서, 섹터 내 충분한 peer가 있는 상태에서 섹터 거래대금 `2위 이내`여야 합니다. 3위까지 완화하면 노이즈가 늘어나는 것으로 검증되어 2위에서 제한합니다.
- ad hoc 종목의 `leaderScore`는 최소 `64` 이상이어야 합니다.

해석:

- 구조가 좋아도 상장/거래 연혁이 짧으면 중장기 후보로 보지 않습니다.
- 신생 성장주는 별도 고위험 테마/성장 관찰 엔진이 생기기 전까지 중장기 엔진에서 제외합니다.
- 시가총액 데이터가 들어오기 전까지 거래대금은 임시 대표성 proxy입니다.

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

## 추가하면 좋을 사항

- KRX/FnGuide 등에서 시가총액과 상장일을 가져와 `StockUniverseItem` 또는 별도 fundamentals snapshot에 저장합니다.
- 중장기 buy 후보에는 시가총액 하한을 직접 적용합니다.
- ad hoc watch 후보에도 시가총액/상장연혁 하한을 적용합니다.
- 시가총액 데이터가 들어오면 현재 거래대금 proxy 기준을 보조 지표로 낮춥니다.

## 2026-05-18 튜닝 기록

오늘 조정의 핵심은 중장기 엔진을 “신생 성장 회복 관찰”이 아니라 “대표성이 있는 종목의 장기 조정/회복 구조”에 더 맞추는 것입니다.

결정 사항:

- 신생 성장/회복 관찰 후보는 아직 중장기 엔진에 넣지 않습니다.
- 상장/거래 연혁이 짧은 종목은 구조가 좋아도 중장기 후보에서 제외합니다.
- `minimumHistorySessions = 720`을 적용해 최소 거래 연혁을 요구합니다.
- ad hoc 종목은 60일 평균 거래대금 `150억 원` 이상, 전체 거래대금 순위 `80위 이내`, 섹터 peer `5개 이상`, 섹터 거래대금 `2위 이내`, leaderScore `64` 이상을 요구합니다.
- 섹터 거래대금 조건은 기존 `1위`에서 `2위 이내`로 완화했습니다. 검증상 3위까지 풀면 노이즈가 늘어나는 것으로 판단해 2위에서 제한합니다.
- 현재 데이터에는 시가총액/상장일이 없으므로 거래대금과 차트 연혁을 임시 대표성 proxy로 사용합니다.

대표성 관련 판단:

- `슈어소프트테크`처럼 연혁이 짧고 대표성 proxy가 약한 종목은 중장기 후보에서 제외합니다.
- `파이버프로`처럼 대표주 기준이 약한 종목은 중장기 프레임과 맞지 않아 제외합니다.
- `LG화학`은 기존 섹터 1위 조건에서는 빠졌지만, 섹터 2위 완화 후 관찰후보로 편입됩니다. 단, 재무 회복 확인이 부족하므로 매수후보가 아니라 관찰후보입니다.

주봉/월봉 보조축:

- 대형주와 curated 성격의 종목은 일봉만 보지 않고 주봉/월봉 구조를 보조축으로 봅니다.
- `higherTimeframeScore`를 추가해 주봉/월봉 구조를 `-15 ~ +18` 범위에서 반영합니다.
- 주봉/월봉 구조가 좋으면 일봉 저점 확인이 덜 된 종목도 관찰후보로 유지할 수 있습니다.
- 다만 주봉/월봉이 좋다는 이유만으로 매수후보가 되지는 않습니다.

매수후보 기준:

- 매수후보는 “많이 오른 대표주가 조금 빠진 것”보다 “대표성이 있고 장기 낙폭이 충분한 종목”을 우선합니다.
- `strongDrawdownPct = 35%` 미만이면 구조가 좋아도 원칙적으로 관찰후보입니다.
- `현대로템`은 대표성/추세/실적 점수는 좋지만 낙폭이 약 `29%` 수준이라 매수후보가 아니라 관찰후보로 둡니다.
- `아모레퍼시픽`, `CJ대한통운`처럼 장기 낙폭이 크고 대표성/재무/주봉월봉 보조축이 받쳐주는 curated 종목은 `하락 누적 분할 후보`로 매수후보 승격을 허용합니다.
- 이 contrarian buy 경로는 curated 종목에만 적용합니다. ad hoc 종목이 같은 점수를 받아도 바로 매수후보로 올리지 않습니다.

검증 결과:

- 섹터 2위 완화 전: 후보 `16개`, 매수 `2개`, 관찰 `14개`
- 섹터 2위 완화 후: 후보 `20개`, 매수 `2개`, 관찰 `18개`
- 새로 들어온 주요 관찰후보: `한화시스템`, `한화오션`, `SK증권`, `LG화학`
- 매수후보는 `아모레퍼시픽`, `CJ대한통운` 2개로 유지됩니다.
- `LG화학`은 총점 `68`, 낙폭 `61%`, 상태 `안정화 더 필요`로 관찰후보에 편입됩니다.

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
