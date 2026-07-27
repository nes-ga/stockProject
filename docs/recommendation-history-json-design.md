# 추천 히스토리 JSON 경계와 스키마 초안

기준일: 2026-07-27

이 문서는 현재 저장 중인 추천 관련 JSON/JSONL 파일의 역할을 구분하고, 스윙과 중장기 추천 히스토리를 같은 화면과 공통 API에서 다루기 위한 저장 구조의 가닥을 정리합니다.

이번 단계에서는 기존 실데이터를 변환하지 않습니다. 특히 `swing-history.json`을 즉시 재작성하거나, 현재 파일만으로 과거 중장기 점수와 추천 가격을 확정적으로 복원하지 않습니다.

## 1차 구현 상태

2026-07-27에 아래 additive 구현을 시작했습니다.

- 기존 `server-long-term-picks.json` 배열 형식과 스윙 v1 파일/API는 유지
- `data/recommendation-history/long-term-history.json` schema v2 파일 추가
- 전체 `LongTermScanCandidate`가 남아 있는 스캔 경계에서 중장기 history updater 호출
- `GET /analysis/recommendation-history/long-term` 별도 API 추가
- 내용 해시, occurrence ID, `appliedScans` ledger로 직전 동일 스캔 재시도는 no-op 처리하되 `A → 없음 → A`와 종료 뒤 재추천은 새 상태 전이로 기록
- 과거 기준일, 오래된 capturedAt, 현재 추천보다 과거인 최초 bootstrap 스캔이 최신 상태를 덮지 못하도록 live writer에서 거부
- 종목별 차트·재무 조회 실패 또는 빈 universe를 불완전 스캔으로 보고 history/current 게시를 모두 중단
- history 필수 저장이 성공한 뒤에만 current 추천 JSON을 atomic publish
- 현재 미확정인 매수 예산 정책은 값을 추측하지 않고 `policyStatus: "pending"`, 금액 필드는 `null`로 시작
- 기존 current 후보는 가격·점수 원본이 없어 자동 백필하지 않으며, 다음 정상 스캔부터 live case를 시작
- 명시적 close는 scan 기준일 cursor와 분리해 기록하며, 같은 `closeId`의 다른 payload와 시간 역행을 거부
- 알림 상태 파일의 충돌 조각을 제거하고 read-modify-write 전체에 잠금과 atomic replace 적용
- 알림 diff는 preview만 한 뒤 Discord 전송/감사 로그 기록이 성공한 경우에 상태를 commit

## 결론

1. 현재 `swing-history.json`에는 `strategy: "swing"` 구분자가 있지만 내부 구조와 종료 규칙은 스윙 전용입니다.
2. `server-long-term-picks.json`은 현재 후보 스냅숏이며 성과 히스토리 원본으로는 정보가 부족합니다.
3. 스윙과 중장기 히스토리는 저장 파일을 분리하되, 공통 케이스 껍데기와 공통 API DTO를 공유합니다.
4. 전략 차이는 `strategy`를 구분자로 하는 discriminated union으로 표현합니다.
5. 중장기 공식 성과 케이스는 최초 `accumulate` 또는 직접 `buy` 진입 시 시작합니다. `watch`는 후보 관찰 기록이며 수익률 모수에서 제외합니다.
6. 추천 가격은 매 스캔마다 덮어쓰지 않습니다. 최초 가격, 관찰 가격, 매수 계획 수정, 체결 가격을 서로 다른 필드와 이벤트로 보존합니다.
7. 목록에서 한 번 사라진 것만으로 중장기 케이스를 종료하지 않습니다. 유효 스캔 여부와 종료 사유를 함께 확인합니다.

## 파일별 현재 역할

| 파일 | 현재 역할 | source of truth 범위 | 히스토리 사용 가능 범위 | 주의점 |
|---|---|---|---|---|
| `data/server-swing-picks.json` | 기본 스윙 현재 후보 스냅숏 | 현재 execution/watch 후보 | 현재 케이스 대조, 일부 스윙 진단 | 과거 상태를 보존하지 않음 |
| `data/server-smallcap-swing-picks.json` | 소형 스윙 현재 후보 스냅숏 | 현재 소형주 execution/watch 후보 | profile별 현재 케이스 대조 | 과거 상태를 보존하지 않음 |
| `data/server-long-term-picks.json` | 중장기 현재 후보 스냅숏 | 현재 buy/accumulate/watch 후보 | 현재 버킷, 최초 노출일, 현 버킷 진입일 | 추천 당시 가격·점수·재무·구조를 저장하지 않음 |
| `data/server-dividend-picks.json` | 배당 현재 후보 스냅숏 | 현재 buy/watch 후보 | 현재 배당 후보 대조 | 이번 중장기 히스토리 범위 밖 |
| `data/recommendation-history/swing-history.json` | 스윙 성과 히스토리 | 스윙 케이스와 결과 판정 | 기존 스윙 성과/진단/사이클 | schema v1이며 스윙 전용 필드가 깊게 결합됨 |
| `data/recommendation-history/long-term-history.json` | 중장기 생명주기 히스토리 | 다음 정상 스캔부터 actionable 케이스와 관측 이벤트 | 중장기 최초/최신 판단, 버킷·가격 변화 | schema v2로 빈 파일부터 시작하며 추정 백필 없음 |
| `data/recommendation-universe-alert-state.json` | 알림 차이 계산용 직전 상태 | 마지막 비교 스냅숏 | 히스토리 원본으로 사용하지 않음 | 2026-07-27 손상 조각 제거 완료; 잠금/atomic replace 적용 |
| `data/discord-alert-history.jsonl` | 실제 Discord 발송 이력 | 무엇을 언제 실제 발송했는지 | 과거 added/moved/removed와 버킷 백필 | 추천 가격·전체 점수·미발송 이벤트는 알 수 없음 |
| `data/development/portfolio/portfolio-holdings.json` | 개발 환경의 실제 보유 포트폴리오 | 실제 평단·수량·투입금 | 실제 체결 성과 연결 | Git 개발 전용이며 모델 추천/모의 체결과 혼합하면 안 됨 |

시장 흐름, 이벤트 캘린더, 테마 회전 JSON은 추천 히스토리의 직접 저장소가 아닙니다. 필요하면 당시 시장 문맥을 보조 연결하는 참조 데이터로만 사용합니다.

## 현재 데이터에서 확인한 규모

- 스윙 히스토리 schemaVersion: `1`
- 스윙 히스토리 케이스: `160`
  - 현재 파일상 `closed`: `160`
  - 실제 진입 있음: `70`
  - 미진입 종료: `90`
  - 닫힌 케이스 중 원천 `outcomeStatus: "active"` 잔존: `127`
- 현재 기본 스윙 후보: `3`
- 현재 소형 스윙 후보: `5`
- 현재 중장기 후보: `31`
  - buy: `0`
  - accumulate: `11`
  - watch: `20`
- 현재 배당 후보: `215`
- Discord 추천 알림 이력:
  - swing: `450`
  - longTerm: `97`
  - dividend: `95`

위 수치는 설계 시점의 파일 내용이며 운영 중 달라질 수 있습니다.

데이터의 source of truth도 용도별로 분리합니다.

| 데이터 층 | source of truth | 의미 |
|---|---|---|
| 현재 추천 스냅숏 | `server-*-picks.json` | 지금 화면과 알림 비교에 쓰는 현재 후보 |
| 추천 생명주기 히스토리 | `recommendation-history/*.json` | 케이스 시작, 변경, 체결, 리뷰, 종료를 누적 보존 |
| Discord 전달 감사 로그 | `discord-alert-history.jsonl` | 실제 발송에 성공한 추천 변화 |
| 실제 포트폴리오 | 개발 `data/development/portfolio/portfolio-holdings.json`, 운영 private 원본 | 실제 보유 수량, 평단, 투입금 |

이 네 층은 서로 보완할 수 있지만 대신할 수는 없습니다.

## 현재 스윙 히스토리는 공통 스키마가 아니다

현재 스윙 케이스에는 공통으로 재사용할 수 있는 필드가 있습니다.

- `id`
- `strategy`
- `symbol`
- `name`
- `openedAt`
- `openedDate`
- `dataDate`
- `closedDate`
- `status`
- `executedBuys`
- `averageBuyPrice`
- `latestClose`
- `maxFavorablePrice`
- `maxAdversePrice`
- `historyOutcome`

그러나 아래 필드는 스윙 전용입니다.

- `profile`: default/smallcap
- `buyPlan.firstBuyPrice`
- `buyPlan.secondBuyPrice`
- `buyPlan.thirdBuyPrice`
- `buyPlan.stopLossPrice`
- `initialStopLossPrice`
- `thirdBuyMonitor`
- `marketStopGrace`
- `stagedBuyDiagnostics`
- 8~10% 목표 수익 판정
- 짧은 business-day timeout
- `target_hit`, `stop_broken`, `market_shock_stop`, `deep_zone_timeout_exit` 등의 outcome type

따라서 기존 케이스의 `strategy` 값만 `longTerm`으로 바꾸는 방식은 사용할 수 없습니다.

또한 `historyOutcome.category`는 추천 전략 종류가 아니라 `active`, `profit`, `loss`, `excluded`, `neutral`과 같은 결과 대분류입니다. 추천 전략 구분에는 반드시 최상위 `strategy`를 사용합니다.

현재 스윙 v1을 읽을 때는 아래 의미 차이를 반드시 지켜야 합니다.

- 디스크에는 `status`만 저장됩니다. `lifecycleStatus`, `cycleMeta`, `currentRecommendation`은 API 응답을 만들 때 파생되며 현재 JSON 원본 필드가 아닙니다.
- `outcomeStatus`는 원천 스캔 상태입니다. 현재 닫힌 케이스에도 `"active"`가 남아 있으므로 케이스 생명주기 판정에 사용하지 않습니다.
- `historyOutcome`은 조회/갱신 시 다시 계산될 수 있는 평가 결과입니다. 불변 종료 이벤트로 간주하지 않습니다.
- 현재 파일에는 범용 `events` 배열이 없습니다. 체결, 단일 계획 조정, 현재 grace 상태 등 일부 정보만 별도 필드로 남습니다.
- `decisionSnapshot`에는 최신 후보 정보가 병합될 수 있습니다. 엄밀한 최초 판단은 `initialSnapshot` 계열을 우선합니다.
- 저장 병합 키가 사실상 `profile:symbol`이라 종료 후 같은 종목이 재추천되면 새 사이클 대신 기존 케이스가 다시 열리거나 덮어써질 수 있습니다.
- `target_hit`은 장중/경로상 최고 수익을 기준으로 할 수 있어 최신 평가 수익률이 음수인 케이스도 있습니다. `outcomeReturnPct`와 `latestMarkReturnPct`를 분리해야 합니다.

`summary`와 `closedMonths`도 현재는 스윙 판정 규칙에 의존합니다. 공통 payload에서는 공통 건수와 전략별 성과 집계를 나눠야 합니다.

## 저장 파일 경계

저장 파일은 전략별로 분리합니다.

```text
data/recommendation-history/
├─ swing-history.json
└─ long-term-history.json
```

분리 이유:

- 스윙과 중장기는 갱신 주기와 종료 규칙이 다릅니다.
- 중장기 재무/구조 스냅숏 때문에 케이스 크기가 커질 수 있습니다.
- 한 전략의 파일 손상이나 마이그레이션이 다른 전략에 전파되는 것을 줄일 수 있습니다.
- API/UI에서는 두 파일을 공통 DTO로 정규화해 합칠 수 있습니다.

알림 차이 계산용 상태 파일과 성과 히스토리 파일은 분리 상태를 유지합니다. 알림 상태 파일을 추천 히스토리처럼 확장하지 않습니다.

## 공통 타입 방향

TypeScript에서는 공통 베이스와 전략별 상세 타입을 합친 discriminated union을 사용합니다.

```ts
type RecommendationHistoryCase =
  | SwingRecommendationHistoryCase
  | LongTermRecommendationHistoryCase;

type RecommendationStrategy = "swing" | "longTerm";

type RecommendationHistoryCaseBase = {
  id: string;
  strategy: RecommendationStrategy;
  cycleNo: number;
  symbol: string;
  name: string;
  sourceKey?: string;
  openedAt: string;
  openedDate: string;
  dataDate: string;
  closedDate?: string;
  status: "current" | "stale" | "closed";
  entryBucket: string;
  lastObservedBucket: string;
  initialReferencePrice: number;
  lastObservedPrice?: number;
  events: RecommendationHistoryEvent[];
  modelPosition?: RecommendationModelPosition;
  returnMetrics?: RecommendationReturnMetrics;
  historyOutcome: RecommendationHistoryOutcome;
  dataQuality: RecommendationHistoryDataQuality;
};
```

`id`와 `cycleNo`는 재추천 사이클을 구분해야 합니다. `profile:symbol`만을 영구 식별자로 쓰지 않고, 같은 종목이 명시적으로 종료된 뒤 다시 시작되면 이전 케이스를 보존한 채 새 `id`와 다음 `cycleNo`를 부여합니다.

스윙 전용 필드는 `strategyData` 또는 스윙 타입 자체에 둡니다.

```ts
type SwingRecommendationHistoryCase = RecommendationHistoryCaseBase & {
  strategy: "swing";
  profile: "default" | "smallcap";
  strategyData: {
    buyPlan?: SwingBuyPlan;
    thirdBuyMonitor?: SwingThirdBuyMonitor;
    marketStopGrace?: MarketStopGraceState;
    stagedBuyDiagnostics?: SwingStagedBuyDiagnostics;
  };
};
```

중장기 전용 필드는 별도 구조로 둡니다.

```ts
type LongTermRecommendationHistoryCase = RecommendationHistoryCaseBase & {
  strategy: "longTerm";
  entryBucket: "accumulate" | "buy";
  lastObservedBucket: "watch" | "accumulate" | "buy";
  closeReview: LongTermCloseReview;
  strategyData: {
    candidateType: "leader" | "quality" | "deep_value" | "turnaround";
    initialSnapshot: LongTermDecisionSnapshot;
    latestSnapshot: LongTermDecisionSnapshot;
    allocationPlan: LongTermAllocationPlan;
    planRevisions: LongTermPlanRevision[];
    reviewSchedule: LongTermReviewSchedule;
    invalidation: LongTermInvalidationState;
    benchmark?: LongTermBenchmarkSnapshot;
  };
};
```

## 공통 payload 껍데기

향후 공통 스키마는 아래 형태를 목표로 합니다.

```json
{
  "schemaVersion": 2,
  "strategy": "longTerm",
  "generatedAt": "2026-07-27T00:00:00.000Z",
  "asOfDate": "2026-07-27",
  "scope": {
    "strategy": "longTerm",
    "sourceFiles": [
      "data/server-long-term-picks.json"
    ]
  },
  "commonSummary": {
    "caseCount": 0,
    "openCaseCount": 0,
    "currentCaseCount": 0,
    "staleCaseCount": 0,
    "closedCaseCount": 0
  },
  "strategySummary": {},
  "appliedScans": [],
  "cases": []
}
```

`schemaVersion: 2`는 공통 케이스 껍데기를 도입하는 다음 세대 스키마를 뜻합니다. 기존 스윙 파일은 당장 v2로 덮어쓰지 않고, v1 loader와 v2 normalizer를 함께 둔 뒤 명시적인 마이그레이션 단계에서 전환합니다.

`commonSummary`에는 전략과 무관한 건수만 둡니다. 스윙 월별 종료 통계와 같은 `closedMonths`는 swing `strategySummary` 또는 조회 시 파생 응답에 두고, 중장기에는 자체 리뷰/종료 통계를 둡니다.

## 중장기 최초 스냅숏에 필요한 필드

현재 중장기 엔진의 `LongTermScanCandidate`에는 아래 값이 이미 계산됩니다.

- 현재 가격
- 총점과 세부 점수
- 이동평균 및 장기 추세 구조
- 바닥 안정화 구조
- 주봉/월봉 구조
- 유동성
- 재무 상태
- 장기 매물대
- candidate type
- candidate group
- label
- 강점/약점
- failure reasons
- tags

그러나 `server-long-term-picks.json` 저장 시 대부분 제거됩니다. 중장기 히스토리 updater는 축약된 현재 파일을 다시 읽는 대신, 스캔 직후의 전체 `LongTermScanCandidate`를 직접 받아 최초/최신 스냅숏을 저장해야 합니다.

최소 `LongTermDecisionSnapshot`:

```json
{
  "capturedAt": "2026-07-27T00:00:00.000Z",
  "asOfDate": "2026-07-27",
  "referencePrice": 100000,
  "priceSource": "scan_close",
  "bucket": "accumulate",
  "candidateType": "leader",
  "candidateGroup": "accumulate candidate",
  "label": "base-forming candidate",
  "reasonSummary": "구조 설명용 예시",
  "scores": {
    "baseScore": 65,
    "bonusScore": 10,
    "rawScore": 75,
    "totalScore": 75,
    "leaderScore": 82,
    "correctionScore": 80,
    "trendScore": 50,
    "liquidityScore": 70,
    "stabilizationScore": 58,
    "financialScore": 76,
    "volumeProfileScore": 60,
    "higherTimeframeScore": 55
  },
  "structure": {},
  "baseStructure": {},
  "higherTimeframe": {},
  "liquidity": {},
  "financials": {},
  "longTermVolumeProfile": {},
  "stageExplanation": {},
  "strengths": [],
  "weaknesses": [],
  "failureReasons": [],
  "tags": [],
  "policyVersion": "long-term-v1"
}
```

예시 가격과 점수는 구조 설명용이며 실제 추천값이 아닙니다.

실제 구현에서는 이 예시 필드를 손으로 다시 선별하기보다, 당시 `LongTermScanCandidate` 전체를 버전이 붙은 저장 DTO로 검증·직렬화하는 편이 안전합니다. `sector`, 고점과 낙폭 기준, `fundamentals` 호환 필드 등 현재 후보 타입의 선택 필드도 값이 있으면 함께 보존합니다.

## 중장기 케이스 시작 기준

### watch

- 후보 관찰 단계입니다.
- 공식 성과 케이스와 매수 가능금액을 열지 않습니다.
- 수익률 승패 모수에 포함하지 않습니다.
- 최초 노출일과 버킷 변화는 Discord 알림 이력 또는 별도 candidate provenance로 보존할 수 있습니다.

### accumulate

- 최초 actionable 단계입니다.
- 공식 중장기 성과 케이스를 시작합니다.
- 최초 `referencePrice`, 점수, 재무, 구조, thesis를 불변 스냅숏으로 저장합니다.
- 종목별 최대예산 중 일부만 사용할 수 있도록 allocation cap을 엽니다.

### buy

- 기존 accumulate 케이스가 있으면 같은 케이스의 승격입니다.
- 새 케이스를 만들거나 최초 추천 가격을 덮어쓰지 않습니다.
- 추가 매수 한도를 열되 이미 체결된 금액을 중복 배정하지 않습니다.
- watch에서 직접 buy로 들어오면 해당 날짜에 공식 케이스를 시작합니다.

현재 데이터 기준으로 buy만 케이스 시작점으로 잡으면 accumulate 신호와 그 기간의 손익/위험이 통계에서 빠지는 생존편향이 발생합니다.

## 금액 모델

추천 엔진의 매수 가능금액과 실제 포트폴리오 투입금은 분리합니다.

```ts
type RecommendationModelPosition = {
  budgetMode: "normalized" | "account_linked";
  caseBudget: number;
  allocationCapPct: number;
  availableNow: number;
  filledAmount: number;
  modelAveragePrice?: number;
  tranches: RecommendationModelTranche[];
};
```

필드 의미:

- `caseBudget`: 한 케이스에 허용된 최대 모델 예산
- `allocationCapPct`: 현재 버킷에서 사용할 수 있는 누적 한도
- `availableNow`: 현재 추가로 사용할 수 있는 금액
- `filledAmount`: 이미 실제 또는 규칙 기반 모의 체결된 금액
- `tranches`: 각 회차별 계획/체결 가격과 금액

원 단위 계좌 예산 정책이 확정되기 전에는 `caseBudget = 100`인 normalized model로 저장할 수 있습니다.

초기 정책 예시:

- watch: 0%
- accumulate: 최대예산의 30%까지 개방
- buy: 누적 한도를 확대

30%는 확정 투자 규칙이 아니라 구현 가닥을 위한 기본 예시입니다. 실제 비율은 계좌 위험 한도와 백테스트를 거쳐 설정값으로 분리합니다.

공식 계산:

```text
availableNow = currentAllocationCapAmount - filledAmount
```

같은 buy 버킷이 반복됐다는 이유만으로 예산을 새로 부여하지 않습니다.

## 추천 가격 변경 원칙

중장기 가격은 매 스캔마다 달라질 수 있으므로 다음 네 가지를 분리합니다.

1. `initialReferencePrice`
   - 최초 actionable 스캔 가격
   - 모델 신호 성과의 불변 기준
2. `observation`
   - 매 스캔의 시장 가격과 점수
   - 가격이 바뀌었다는 이유만으로 새 케이스나 새 매수를 만들지 않음
3. `plan_revised`
   - 미체결 진입 구간, 향후 tranche, 무효화 조건이 실질적으로 변경된 경우
   - old/new와 변경 사유를 모두 저장
4. `tranche_filled`
   - 실제 또는 규칙 기반 모의 체결
   - 이미 체결된 가격과 금액은 이후 계획 수정으로 변경하지 않음

성과 기준도 분리합니다.

- `signalReturn`: 최초 reference price 기준 모델 신호 성과
- `modelPositionReturn`: 모의 tranche 가중평균가 기준 모델 성과
- `actualPortfolioReturn`: 실제 포트폴리오 평단/수량 기준 성과

## 공통 이벤트

```ts
type RecommendationHistoryEventType =
  | "recommendation_started"
  | "bucket_changed"
  | "observation"
  | "stale_marked"
  | "reobserved"
  | "plan_revised"
  | "tranche_filled"
  | "review_due"
  | "reviewed"
  | "extended"
  | "closed"
  | "data_quality_warning";
```

공통 이벤트 예시:

```json
{
  "id": "evt-2026-07-27-028260-1",
  "type": "bucket_changed",
  "occurredAt": "2026-07-27T00:00:00.000Z",
  "asOfDate": "2026-07-27",
  "fromBucket": "watch",
  "toBucket": "accumulate",
  "referencePrice": 100000,
  "reason": "actionable_stage_promoted",
  "source": "long-term-universe-scan"
}
```

이벤트에는 `policyVersion`과 `scanId`를 추가해 어떤 규칙과 스캔이 판단을 만들었는지 추적할 수 있어야 합니다.

## 중장기 종료 상태

추천 종료와 실제 보유 종료는 분리합니다.

중장기 케이스 상태:

- `current`: 최신 적용 스캔의 후보 출력에서 관측됨
- `stale`: 케이스는 열려 있지만 최신 적용 스캔에서 관측되지 않음. 추천 실패나 thesis 훼손을 뜻하지 않음
- `closed`: 명시적인 종료 이벤트와 근거가 확정됨

종료 검토는 lifecycle과 분리한 `closeReview.status`로 표현합니다. 정책 미확정 상태에서는 자동 `closed` 전환을 금지하고, 명시적 close 명령이 있어야 종료됩니다. 닫힌 종목이 다시 `accumulate` 또는 `buy`로 등장할 때만 다음 `cycleNo`로 새 케이스를 만듭니다.

중장기 outcome type 초안:

- `unresolved`
- `edge_realized`
- `thesis_broken`
- `time_expired`
- `administrative_close`
- `manual_close`
- `data_unavailable`

공통 결과 대분류는 기존 스윙과 맞출 수 있습니다.

- active
- profit
- loss
- neutral
- excluded

단, 가격이 한 번 하락했거나 현재 후보 목록에서 한 번 빠진 사실만으로 `thesis_broken`을 만들지 않습니다.

종료 판정에 필요한 데이터:

- 스캔이 전체적으로 유효했는지
- 종목별 가격/재무 데이터가 정상 로드됐는지
- 구조 훼손과 재무 hard-exclusion 여부
- 서로 다른 유효 기준일에서 상태가 반복됐는지
- 정기 리뷰/연장 여부
- 명시적 종료 사유

## 데이터 품질 필드

파일 손상이나 외부 데이터 실패를 투자 결과로 오인하지 않기 위해 케이스와 이벤트에 데이터 품질을 저장합니다.

```ts
type RecommendationHistoryDataQuality = {
  scanId?: string;
  scanCompleteness: "unknown" | "complete" | "partial";
  priceLoaded: boolean;
  financialsLoaded: boolean;
  benchmarkLoaded?: boolean;
  reconstructed: boolean;
  reconstructionSources?: string[];
  warnings: string[];
};
```

현재 중장기 엔진은 종목별 전체 실패 수를 외부로 노출하지 않으므로 1차 구현은 `scanCompleteness: "unknown"`으로 저장합니다. 이 상태에서도 관측된 후보의 시작/갱신은 기록합니다. 목록에서 사라진 열린 케이스는 `stale`로 표시하되 손절·실패·종료로 판정하지 않습니다.

불완전 스캔에서는 다음을 금지합니다.

- 기존 열린 케이스 일괄 종료
- 추천 가격 덮어쓰기
- thesis_broken 자동 확정
- 빈 결과로 히스토리 current set 교체

## 백필 가능 범위

### 높은 신뢰도로 가능한 것

`discord-alert-history.jsonl`의 longTerm 레코드에서:

- 실제 알림 발송일
- symbol/name
- added/moved/removed
- 현재/이전 버킷
- anchorDate/latestMentionDate가 기록된 경우 해당 날짜
- 당시 note

단, 이 파일은 Discord 발송 성공 뒤 추가되는 전달 감사 로그입니다. 변화가 없었던 스캔, webhook 비활성, 전송 실패는 남지 않으며 재시도 중복 가능성도 있으므로 `scanId` 또는 내용 기반 멱등 키로 정규화해야 합니다.

### reconstructed 표시가 필요한 것

- 당시 기준일의 시장 종가
- 벤치마크 종가
- 현재 JSON에 남은 anchorDate/bucketEnteredDate를 이용한 일부 시작일

현재 중장기 스냅숏의 `anchorDate`와 `bucketEnteredDate`는 종목이 연속해서 목록에 남아 있을 때만 이어집니다. 이탈 후 재진입하면 리셋될 수 있으므로 전체 과거 사이클의 확정 날짜로 사용하지 않습니다.

복원 가격은 다음처럼 출처를 명시합니다.

```json
{
  "referencePrice": 100000,
  "priceSource": "historical_close_reconstructed",
  "reconstructed": true
}
```

### 정확히 복원할 수 없는 것

- 당시 전체 score breakdown
- 당시 재무 snapshot
- 당시 장기 구조 snapshot
- 당시 추천 엔진 policy version
- 발송되지 않은 후보 변화
- 당시 매수 가능금액과 계획 revision

복원할 수 없는 값은 현재 값으로 채워 과거 사실처럼 저장하지 않습니다.

현재 포트폴리오 7건은 `openedDate`와 `sourceRecommendationId`가 없어 추천 케이스와 확정적으로 연결할 수 없습니다. 평단·수량·현재 투입금 참고는 가능하지만 과거 매수 시점과 분할 체결은 복원하지 않습니다.

## 기존 파일 마이그레이션 원칙

1. `swing-history.json` v1은 먼저 읽기 전용 호환을 유지합니다.
2. v1 케이스를 공통 API DTO로 변환하는 normalizer를 추가합니다.
3. `long-term-history.json`은 공통 케이스 껍데기를 적용해 새로 시작합니다.
4. 중장기 히스토리가 안정된 뒤 swing v2 writer를 별도 작업으로 진행합니다.
5. swing v1을 v2로 변환할 때 원본 백업과 케이스 수/성과 합계 대조가 필수입니다.
6. 마이그레이션은 원본 파일을 직접 덮어쓰기 전에 새 파일로 생성하고 검증합니다.
7. v1의 `opened`, `executedBuys`, 계획 조정, `closed`를 이벤트로 복원할 때는 `provenance: "migrated"`와 `inferred: true`를 붙입니다.
8. 종료 결과는 설명 문구가 아니라 구조화된 `historyOutcome.type`을 기준으로 옮기고, 경로상 성과와 최신 평가 성과를 별도 필드로 보존합니다.
9. 기존 API 사용자를 위해 v2를 기존 flattened 응답으로 바꾸는 호환 adapter를 전환 기간 동안 유지합니다.
10. `strategy` 누락을 `"swing"`으로 보정하는 것은 legacy reader에서만 허용하고, v2 writer에서는 필수 필드로 검증합니다.

## 저장 안전성

추천 히스토리 쓰기는 다음 조건을 만족해야 합니다.

- 동일 파일 read-modify-write 직렬화
- 프로세스 내 write queue 또는 mutex
- 임시 파일에 완전한 JSON 작성
- 작성된 임시 파일을 다시 `JSON.parse`해 검증
- 최종 파일로 atomic rename
- 실패 시 기존 정상 파일 유지
- 필요하면 날짜별 백업 또는 최근 정상본 보존

atomic rename만으로는 동시에 서로 다른 상태를 읽고 쓰는 lost update를 막지 못합니다. 직렬화와 atomic replace가 모두 필요합니다.

중장기 스캔 commit은 `current-picks lock → 최신 current 재읽기 → 멱등 history 필수 저장 → current atomic publish` 순서로 고정합니다. history 저장이 실패하면 current JSON은 변경하지 않습니다. history 성공 뒤 current publish가 실패해도 동일 내용의 재시도는 같은 `scanId`로 deduplicate한 뒤 current만 다시 게시할 수 있습니다.

자동 전체 스캔은 시도·성공·실패 건수가 완전해야만 commit합니다. 한 종목이라도 조회가 실패하거나 universe가 비어 있으면 기존 current/history를 그대로 두고 실패 처리합니다. 최초 history가 비어 있어도 기존 current의 최신 기준일보다 과거인 결과는 거부합니다.

기존 `POST /analysis/server-long-term-picks`는 전체 판단 snapshot이 없는 current 전용 관리 경로라 history를 만들 수 없습니다. 응답의 `historyUpdated: false`가 이 경계를 표시하며, 완전한 history 원장이 필요한 운영에서는 자동 전체 스캔 경로만 사용해야 합니다.

알림 상태는 Discord 전송 전에 갱신하지 않습니다. preview의 category fingerprint와 commit 시점의 최신 fingerprint를 비교해 같은 category의 오래된 preview가 새 상태를 덮지 못하게 합니다.

현재 Discord 전달 보장은 at-least-once입니다. 여러 메시지 중 일부만 성공했거나 전송 성공 뒤 감사 로그 또는 상태 commit이 실패하면 다음 재시도에서 이미 보낸 메시지가 중복될 수 있습니다. exact-once가 필요하면 영속적인 delivery ID와 전달 단계별 멱등 기록을 별도로 도입해야 합니다.

`recommendation-universe-alert-state.json`은 2026-07-27 손상 조각을 제거했고 공유 JSON 쓰기를 직렬화했습니다. 복구 후에도 이 파일은 직전 알림 비교용 파생 캐시이므로 백필 원본으로 사용하지 않습니다.

## 구현 순서

### 1단계: 타입과 저장 경계

- 공통 history base type 작성
- swing v1 normalizer 작성
- longTerm history type 작성
- `long-term-history.json` reader/writer 작성
- 안전한 JSON write queue/atomic replace 공통화

### 2단계: 중장기 스캔 연결

- 축약 저장 전 전체 `LongTermScanCandidate`를 history updater에 전달
- accumulate/direct buy에서 케이스 시작
- bucket_changed/observation 이벤트 저장
- scan completeness와 데이터 품질 저장

### 3단계: 가격과 금액

- initialReferencePrice 불변 저장
- model budget/allocation cap 저장
- plan revision과 tranche 체결 분리
- signal/model/actual 성과 분리

### 4단계: 종료와 연장

- `closeReview.pending` 도입
- thesis/구조/재무 종료 판정
- 정기 리뷰와 time expiry/extension 저장
- 한 번의 누락으로 종료되지 않는 보호 규칙 추가

### 5단계: API와 UI

- `GET /analysis/recommendation-history/long-term`
- 공통 history DTO
- 스윙/중장기 탭 또는 필터
- 모델 성과와 실제 포트폴리오 성과 구분 표시

### 6단계: 선택적 백필

- Discord longTerm 이벤트 기반 케이스 prelude 생성
- historical close 재조회
- reconstructed 표시
- 정확한 score/fundamental 과거값은 비워 둠

## 구현 전에 확정할 정책

다음 값은 코드에 넣기 전에 별도 결정 또는 설정값이 필요합니다.

1. accumulate allocation cap 기본값
2. buy 승격 시 누적 allocation cap
3. 직접 buy 진입 시 tranche 규칙
4. 중장기 기본 benchmark
5. 정기 리뷰 간격
6. time expiry와 최대 연장 기간
7. 구조/재무 종료 조건의 연속 유효 스캔 횟수
8. 과거 longTerm 알림의 백필 시작일과 허용 범위

## 완료 기준

- 기존 swing v1 파일을 훼손하지 않는다.
- 중장기 최초 actionable 가격과 판단 snapshot이 보존된다.
- 가격 업데이트가 최초 추천 가격과 기존 체결을 덮어쓰지 않는다.
- accumulate→buy가 같은 케이스의 승격으로 기록된다.
- 같은 버킷 반복 스캔으로 매수 가능금액이 중복 증가하지 않는다.
- 불완전 스캔이나 JSON 손상으로 current 케이스가 종료되지 않는다.
- 모델 신호, 모델 체결, 실제 포트폴리오 성과가 구분된다.
- 각 종료 결과에 명시적인 근거와 데이터 품질 상태가 남는다.
