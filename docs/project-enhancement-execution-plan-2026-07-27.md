# StockMon 고도화 실행 계획

- 기준일: 2026-07-27
- 상태: In progress (2026-08-21 갱신)
- 목적: 집 또는 다른 작업 세션에서 이 문서만 읽고도 순서대로 구현을 시작할 수 있는 실행 기준 제공
- 우선순위 기준: 데이터 신뢰성 → 판단 안전성 → 다음 행동 연결 → 성과 검증 → 운영 편의

> 이 문서는 [2026-07-13 프로젝트 개선 제안서](./project-improvement-proposal-2026-07-13.md)의 감사 근거를 유지하면서, 2026-07-27 현재 구현 상태에 맞춰 **다음 작업 순서와 완료 조건을 재정의한 실행용 기준 문서**다. 우선순위가 충돌하면 이 문서를 따르며, 이후 실행 상태 checkbox는 이 문서에서만 관리한다.

## 0. 2026-08-21 진행 메모

Phase 0의 일부 기반이 2026-08-19 커밋과 현재 작업 트리에 반영됐다.

- 완료: 중장기 보유종목용 `PortfolioTechnicalSetup` 계산. 최근 일봉으로 SMA20 기울기·이격, 20일 박스 폭, 저점 방어와 기술 무효가를 산출한다.
- 완료: 기술 상태를 Portfolio 규칙과 Recovery Plan에 전달하고 화면에 근거를 표시한다.
- 완료: 수익 종목용 3단계 분할매도 수량·목표가와 수익보호 가격을 제공한다.
- 완료: 로컬 OCR 파서 보강과 `npm run verify:portfolio-ocr` 회귀 검증을 추가했다.
- 작업 트리 반영: 과거 손실 이력보다 현재 실제 보유 손익을 우선해 수익 전환 스윙을 `SWING_RECOVERED`로 분리한다.
- 미완료: P0-A의 독립 `PortfolioExecutionSignal` DTO, history freshness/policy gate, Swing·Unknown 승인 정책.
- 미완료: P0-B의 실제 캡처 시각과 업로드 시각 분리. 현재 저장 route는 계좌 저장 시각을 `capturedAt`으로 기록한다.
- 미완료: P0-C quote-only provider, snapshot ID, view-aware polling, 공통 timeout/cache/concurrency.
- 미완료: P0-D 정책 객체·버전, 비용·세금·슬리피지 반영.

따라서 현재 기술 상태 `READY`는 Phase 0-A 전체 완료를 뜻하지 않는다. 최신 추천 이력, 독립 실행 신호, 시세와 계좌 근거가 모두 갖춰진 최종 execution safety gate는 계속 미완료로 본다.

## 1. 한 줄 결론

다음 큰 제품 기능은 **급변을 보유 위험과 스윙 관찰로 연결하는 `보유종목 위험 인박스 + 급변 레이더`**다.

단, 기능 연결 전에 아래 두 가지를 먼저 완료한다.

1. Portfolio Recovery가 실제 최신 신호와 가벼운 시세 경로만 사용하도록 `Portfolio Execution Safety`를 보강한다.
2. 급등·급락의 잘못된 OHLC 파싱과 필터 의미를 수정해 입력 데이터부터 신뢰할 수 있게 만든다.

권장 구현 순서:

```text
Phase 0  Portfolio Execution Safety와 quote-only 시세
  ↓
Phase 1  급등·급락 데이터 정확성 복구
  ↓
Phase 2  보유종목 위험 인박스 + 급변 레이더 v1
  ↓
Phase 3  판단 변화·후속 성과 검증실
  ↓
Phase 4  저장·테스트·보안·운영 UX 마감
```

## 2. 현재 완료 기준선

### 2.1 Portfolio Recovery v1

다음 범위는 구현 완료로 취급하며 다시 설계하지 않는다.

- 상세 설계와 기존 완료 범위는 [Portfolio Manager 작업 계획](./work-plan-2026-07-08-portfolio-manager.md)을 근거로 한다.
- 동일한 조회 시세 snapshot으로 보유금액, 손익, advice를 다시 계산
- `NOT_ELIGIBLE`, `WAIT_SIGNAL`, `RECOVERY_READY`, `REDUCE_ONLY` 상태 분리
- `RECOVERY_READY`에서만 예시 추가금과 새 평단 시뮬레이션 제공
- 저장 시세, 계좌 예산 부재, 무효가 이탈, 1주 미만, 과도한 손실에서는 추가금 0원
- 현재 투입금, 평가금, 손실금, 손익분기 가격, 필요 반등률 계산
- 1차 추가금 회수와 잔여 수량 기준 최종 원금+3% 목표 계산
- 주문가능금액의 50% 배분과 종목 노출 추정 총자산 15% 상한
- 카드와 상세 화면의 금액 흐름, 무효가, 차단 사유 표시

완료 기준선을 유지해야 하는 핵심 규칙:

- `ADD_WAIT`은 매수 신호가 아니며 현재 추가금은 항상 0원이다.
- `RECOVERY_READY`가 아니면 실행 가능한 추가매수 금액처럼 보이는 값을 표시하지 않는다.
- 새 평단이 낮아져도 추가매수 직후 절대 손실금은 줄지 않는다는 설명을 유지한다.
- `REDUCE_ONLY`는 추가매수를 차단하고 반등 축소를 우선한다.

### 2.2 추천 히스토리 기반

- 데이터 소유권과 schema 경계는 [추천 히스토리 JSON 설계](./recommendation-history-json-design.md)를 근거로 한다.
- 스윙 추천 히스토리와 별도로 중장기 history v2 저장 구조가 있다.
- 중장기 케이스는 최초/최신 판단 snapshot, bucket 변화, scan identity, policy version을 보존한다.
- 과거 값을 추측해 백필하지 않고 다음 정상 스캔부터 이력을 쌓는다.
- JSON atomic write와 mutation queue 공통 도구가 추가됐지만 모든 저장소에 적용된 것은 아니다.

### 2.3 현재 검증 기준

2026-07-27 확인 결과:

```bash
npm.cmd run check
npm.cmd run verify:portfolio-recovery
npm.cmd exec -- tsx src/scripts/verifyLongTermRecommendationHistory.ts
node --check public/app.js
```

위 명령은 모두 통과했다. 이후 각 Phase는 이 기준을 깨뜨리지 않아야 한다.

## 3. 반드시 지킬 제품 원칙

### 3.1 매수 신호와 관찰 신호를 섞지 않는다

- 급등 종목은 즉시 매수 후보가 아니라 스윙 관찰 입력으로만 사용한다.
- 급락 종목도 과매도라는 이유만으로 매수 후보가 되지 않는다.
- Recovery의 문구형 조건을 실제 계산된 회복 신호로 오인하지 않는다.
- 데이터가 오래됐거나 근거가 없으면 `WAIT`, `STALE`, `DEGRADED`로 낮춘다.

### 3.2 시간과 출처를 판단 데이터에 포함한다

가격이나 계좌금액만 저장하지 말고 최소한 아래를 함께 전달한다.

```ts
type DataEvidence = {
  asOf: string;
  fetchedAt: string;
  source: string;
  isStale: boolean;
  qualityStatus: "ok" | "degraded" | "unavailable";
};
```

- `asOf`: 실제 데이터가 의미하는 거래일 또는 캡처 시각
- `fetchedAt`: 시스템이 데이터를 가져온 시각
- 두 값을 서로 대신 사용하지 않는다.
- UI에는 “실시간”이라는 표현보다 `최근 확인 시세 · 기준일`을 우선한다.

### 3.3 실패를 정상 데이터처럼 보이지 않는다

- provider 실패를 정상 점수의 watch 후보로 조용히 변환하지 않는다.
- 부분 실패는 전체 화면을 지우지 말고 실패한 방향이나 종목만 degraded 처리한다.
- 오래된 성공 결과를 표시할 때는 stale 상태와 마지막 성공 시각을 함께 보여준다.

### 3.4 이력은 미래 관측부터 쌓는다

- 현재 파일만으로 알 수 없는 과거 점수, 추천 가격, 체결, MFE/MAE를 추측하지 않는다.
- migration은 source provenance와 변환 정책이 명확할 때만 수행한다.
- 실제 보유 Portfolio와 모델 추천/모의 체결 결과를 같은 성과로 합치지 않는다.

### 3.5 기존 작업을 보존한다

- 작업 시작 전 dirty worktree와 런타임 JSON 변경을 확인한다.
- 사용자 변경과 관련 없는 파일을 되돌리거나 정리하지 않는다.
- `data/*.json`, `data/**/*.json`, `data/*.jsonl`은 명시적 migration 없이 재작성하지 않는다.
- 한 Phase의 완료 조건이 통과하기 전 다음 Phase의 대형 UI 작업을 섞지 않는다.

## 4. Phase 0 — Portfolio Execution Safety

목표: Recovery 수식을 더 복잡하게 만드는 것이 아니라, **실제 추가매수 가능 판정에 쓰는 신호·시세·계좌금액의 신뢰성을 보장**한다.

### P0-A. 실제 회복 신호 DTO와 판정

현재 문제:

- `거래량 회복`, `지지 확인`은 실행 계획의 안내 문구다.
- `RECOVERY_READY`는 실제 기술 신호 계산보다 저장된 중장기 `buy/accumulate` bucket에 크게 의존한다.
- Swing 또는 `UNKNOWN` 보유종목은 최신 회복 신호로 READY가 되는 명시적인 경로가 없다.

권장 구조:

```ts
type PortfolioExecutionSignal = {
  status: "READY" | "WAIT" | "BLOCKED" | "DATA_UNAVAILABLE" | "STALE";
  evaluatedAt: string;
  validUntil?: string;
  policyVersion: string;
  sourceStrategy: "swing" | "longTerm" | "portfolio";
  evidence: {
    supportHeld?: boolean;
    volumeRecoveryRatio?: number;
    trendRecovered?: boolean;
    invalidPriceHeld: boolean;
  };
  reasons: string[];
};
```

해야 할 일:

- [ ] 문구형 `conditions`와 실행 가능한 신호 evidence를 분리한다.
- [ ] 최신 스윙/중장기 엔진 결과를 Portfolio용 signal adapter에서 명시적으로 변환한다.
- [ ] 단순 저장 pick보다 중장기 history의 `status`, `lastObservedDate`, `tracking.observedInLastScan`, `dataQuality`, `policyVersion`, 최근 scan completeness를 authoritative freshness gate로 사용한다.
- [ ] 중장기 pick의 `asOfDate`, scan 시각, policy version 유효기간도 함께 검사한다.
- [ ] 지지 유지, 20일 평균 대비 거래량, SMA20 회복 여부는 완료된 일봉만으로 계산하고 장중 미완성 봉을 READY 근거로 사용하지 않는다.
- [ ] 신호가 오래됐거나 날짜가 없으면 `STALE` 또는 `WAIT`로 차단한다.
- [ ] 1차 구현의 execution signal은 기존 허용 상태를 `WAIT`로 내릴 수만 있고, 기존 `WAIT` 종목을 단독으로 READY로 승격하지 못하게 한다.
- [ ] Swing과 Unknown 보유종목은 별도 승인된 정책이 생기기 전까지 최신 기술 신호만으로 READY로 승격하지 않는다.
- [ ] Swing, Long-Term, Unknown 보유종목별 차단 조건을 테스트로 고정한다.
- [ ] Recovery 응답에 사용한 신호의 기준일과 정책 버전을 포함한다.

READY는 다음 교집합에서만 허용한다.

```text
전략상 추가 허용
AND 최신 판단 이력
AND PortfolioExecutionSignal=READY
AND 행동 가능한 최신 시세
AND 최신 계좌금액
AND 무효가 미훼손
```

완료 조건:

- 조건 문구만 존재하는 종목은 `RECOVERY_READY`가 되지 않는다.
- 오래된 `buy/accumulate` pick은 추가금 0원과 명확한 stale 사유를 반환한다.
- execution signal 하나만으로 기존 `WAIT` 종목이 READY로 올라가지 않는다.
- 동일 입력과 동일 policy version은 동일한 상태와 금액을 만든다.
- READY 근거를 API와 UI에서 사용자가 확인할 수 있다.

### P0-B. 계좌 캡처 시각 보존

현재 문제:

- 스크린샷을 저장할 때 실제 캡처 시각과 관계없이 저장 시각을 `capturedAt`으로 덮을 수 있다.
- 오래된 스크린샷을 오늘 올리면 최대 96시간 동안 최신 계좌금액으로 오인될 수 있다.

해야 할 일:

- [ ] `capturedAt`과 `uploadedAt`을 분리한다.
- [ ] OCR에서 캡처 시각을 확정할 수 없으면 사용자가 확인하거나 입력하도록 한다.
- [ ] 캡처 시각을 모르면 주문가능금액을 Recovery 예산에 사용하지 않는다.
- [ ] 화면에 계좌 기준 시각과 만료 여부를 표시한다.
- [ ] 96시간 상수는 정책 설정으로 옮기고 거래 후 변동 위험을 문서화한다.

완료 조건:

- 오래된 스크린샷을 다시 업로드해도 계좌 기준 시각이 최신으로 바뀌지 않는다.
- `capturedAt`이 없거나 만료된 계좌는 `ACCOUNT_BUDGET_UNAVAILABLE`로 차단된다.

### P0-C. quote-only provider 분리

현재 문제:

- Portfolio snapshot이 상세 분석 경로를 재사용해 국내 종목당 최대 2,200거래일 차트를 받을 수 있다.
- 화면의 5초 폴링과 서버의 5초 cache TTL이 맞물려 대용량 조회가 반복될 수 있다.
- 종목 요청은 제한 없는 병렬 처리이며 provider timeout과 거래시간 기준 freshness가 없다.
- `/portfolio/quotes`가 시세 외에 history linking과 advice 계산까지 반복한다.

권장 DTO:

```ts
type QuoteSnapshot = {
  symbol: string;
  price?: number;
  previousClose?: number;
  asOf?: string;
  fetchedAt: string;
  provider: string;
  marketSession: "pre" | "open" | "closed" | "holiday" | "unknown";
  isStale: boolean;
  qualityStatus: "ok" | "degraded" | "unavailable";
  error?: string;
};
```

해야 할 일:

- [ ] 차트가 없는 quote-only provider 함수를 별도로 만든다.
- [ ] Portfolio `/quotes`는 2,200일 차트를 호출하지 않는다.
- [ ] cache TTL, in-flight 공유, timeout, retry, concurrency를 공통 정책으로 적용한다.
- [ ] 초기 권장값은 timeout 3~5초, concurrency 4~6, quote cache 10~15초로 두되 설정 가능하게 만든다.
- [ ] 거래소 영업일과 장 상태를 고려해 `asOf`와 stale을 판정한다.
- [ ] quote refresh와 advice/history refresh 주기를 분리한다.
- [ ] snapshot ID를 부여해 quote와 advice가 같은 가격 집합을 사용했는지 확인할 수 있게 한다.
- [ ] Portfolio view가 아니거나 문서가 hidden 상태면 polling을 중지하고 복귀 시 한 번 즉시 갱신한다.
- [ ] 응답에 종목별 provider 실패와 마지막 정상값 여부를 포함한다.
- [ ] UI는 실제 source에 맞춰 `장중 시세`, `최신 종가`, `저장 시세`와 기준일을 구분한다.

완료 조건:

- `/portfolio/quotes` 호출 중 장기 차트 provider가 호출되지 않는다.
- cache 구간 내 반복 요청은 같은 upstream 요청을 공유한다.
- timeout 종목이 있어도 다른 보유종목 시세는 정상 반환된다.
- 가격, advice, Recovery가 동일 snapshot ID와 동일 `asOf`를 사용한다.
- 주말·휴장일의 마지막 종가는 실시간 장중가로 표시되지 않는다.

### P0-D. Recovery 정책 버전과 거래비용

해야 할 일:

- [ ] 최종 목표 +3%, 1차 회수 +5%, 목표 반등률, 최대 반등률, 종목 노출 15%를 설정 객체로 이동한다.
- [ ] 응답과 판단 snapshot에 `policyVersion` 또는 `configHash`를 남긴다.
- [ ] 수수료, 세금, 예상 슬리피지와 KRX 호가단위를 시뮬레이션에 반영한다.
- [ ] gross 목표와 비용 반영 net 목표를 구분한다.

완료 조건:

- 같은 정책 버전의 결과를 재현할 수 있다.
- 1차 회수와 최종 목표 금액이 예상 거래비용을 반영한다.
- 경계값 회귀 테스트가 있다.

### Phase 0 주요 수정 후보

- `src/services/portfolio/types.ts`
- `src/services/portfolio/rules.ts`
- `src/services/portfolio/recovery.ts`
- `src/services/portfolio/portfolioManager.ts`
- `src/services/portfolio/historyLinker.ts`
- `src/routes/portfolioRoutes.ts`
- `src/services/realtimeStocks.ts`
- `src/services/stockAnalysis.ts`
- `public/app.js`
- `src/scripts/verifyPortfolioRecovery.ts`

새 경계 후보:

- `src/services/quotes/quoteProvider.ts`
- `src/services/quotes/quoteCache.ts`
- `src/services/portfolio/recoverySignal.ts`
- `src/services/portfolio/recoveryPolicy.ts`

## 5. Phase 1 — 급등·급락 데이터 정확성 복구

목표: 읽기 전용 기능을 확장하기 전에 현재 순위와 점수를 신뢰할 수 있게 만든다.

문제 조사 근거는 [개선 제안서 4.5](./project-improvement-proposal-2026-07-13.md#45-급등급락-데이터와-점수-정확성-복구)를 참고한다.

현재 문제:

- 네이버 순위표 셀 6~8을 `open`, `high`, `low`로 읽지만 실제로는 호가·잔량 컬럼일 수 있다.
- 잘못된 값이 `closedNearHigh`, `closedNearLow` 점수에 반영된다.
- ETF, ETN, 레버리지, 인버스, 우선주, SPAC이 보통주와 섞인다.
- `minVolumeRatio`는 필터처럼 보이지만 실제로는 점수 가점 기준이다.
- `현재가 × 누적 거래량`을 실제 거래대금처럼 오해할 수 있다.
- 차트 보강 실패가 정상 watch 결과와 구분되지 않는다.

해야 할 일:

- [ ] 실제 상승·하락 순위 HTML을 마스킹한 fixture로 저장한다.
- [ ] 고정 셀 위치 대신 헤더 이름 기반 파싱 또는 명시적 provider DTO를 사용한다.
- [ ] 순위표에서 신뢰할 수 없는 OHLC 필드를 제거한다.
- [ ] OHLC는 검증된 차트/quote provider에서 가져온다.
- [ ] `low <= min(open, price) <= max(open, price) <= high` 불변식을 검사한다.
- [ ] `closedNearHigh`와 `closedNearLow` 동시 참을 차단한다.
- [ ] 보통주, 우선주, ETF, ETN, SPAC을 분류하고 기본값은 보통주 중심으로 둔다.
- [ ] `minVolumeRatio`는 실제 최소 필터로 만들고, 점수 가점 기준이 필요하면 `volumeScoreThreshold` 같은 별도 필드로 분리한다.
- [ ] 추정 거래대금이면 DTO와 UI 모두 `estimatedTurnover`로 명시한다.
- [ ] 응답에 `fetchedAt`, `source`, `qualityStatus`, `isDelayed`를 추가한다.
- [ ] 상승과 하락 요청의 실패 상태를 분리한다.

완료 조건:

- provider fixture의 컬럼 순서가 바뀌면 테스트가 실패한다.
- 호가·잔량 값이 OHLC 또는 near-high/near-low 점수에 들어가지 않는다.
- instrument type 필터와 UI 표시가 일치한다.
- 데이터 보강 실패 종목은 정상 종목과 다른 quality 상태를 가진다.
- 화면 필터 문구와 실제 서버 필터 동작이 일치한다.

주요 수정 후보:

- `src/services/koreanMovers.ts`
- `src/routes/analysisRoutes.ts`
- `src/types.ts`
- `public/index.html`
- `public/app.js`

테스트 후보:

- `src/services/__fixtures__/korean-movers-up.html`
- `src/services/__fixtures__/korean-movers-down.html`
- `src/scripts/verifyKoreanMovers.ts`

## 6. Phase 2 — 보유종목 위험 인박스 + 급변 레이더 v1

목표: 급등·급락 순위를 읽고 끝내지 않고 사용자의 다음 행동으로 연결한다.

제품 한계와 초기 TODO 근거는 [개선 제안서 5.5](./project-improvement-proposal-2026-07-13.md#55-급등급락-급변-레이더-고도화)를 참고한다.

### 6.1 제품 흐름

```text
급등 감지
  -> 과열/수급 유입 상태 분류
  -> 추격 금지
  -> 스윙 watch 등록
  -> 눌림 형성 후 기존 스윙 엔진 재평가

급락 감지
  -> 실제 Portfolio/저장 후보 교차
  -> 보유 위험을 최상단 배치
  -> 무효가·뉴스·거래정지·시장 동반 하락 확인
  -> 축소/대기/관찰 행동으로 연결
```

### 6.2 권장 이벤트 DTO

```ts
type MarketMovementEvent = {
  id: string;
  symbol: string;
  direction: "surge" | "drop";
  status:
    | "new"
    | "strengthening"
    | "cooling"
    | "resolved";
  classification:
    | "inflow"
    | "overheated"
    | "no_chase"
    | "pullback_watch"
    | "holding_risk"
    | "structure_break"
    | "panic_watch"
    | "market_shock";
  detectedAt: string;
  asOf: string;
  priority: number;
  isHolding: boolean;
  isSavedCandidate: boolean;
  qualityStatus: "ok" | "degraded";
  reasons: string[];
  availableActions: Array<
    "open_chart" |
    "open_analysis" |
    "open_news" |
    "add_swing_watch" |
    "open_portfolio" |
    "create_alert"
  >;
};
```

### 6.3 서버 작업

- [ ] 급변 종목을 Portfolio holdings와 교차한다.
- [ ] 실제 보유 급락 종목을 일반 시장 순위보다 우선한다.
- [ ] 저장된 스윙·중장기 후보와 교차한다.
- [ ] 뉴스 대상 dictionary에 실제 holdings를 포함하고 일반 후보 cap을 적용하기 전에 우선 할당한다.
- [ ] 일반 mover의 거래량 필터와 보유종목 위험 감시를 분리해, 거래량 정보가 부족해도 보유 급락을 숨기지 않는다.
- [ ] 뉴스·공시·거래정지·시장 이벤트 근거를 연결한다.
- [ ] 급등 종목은 자동 BUY가 아니라 swing watch 입력만 허용한다.
- [ ] 급등/급락 snapshot과 event delta를 저장한다.
- [ ] `new`, `strengthening`, `cooling`, `resolved` 상태 변화를 계산한다.
- [ ] 동일 이벤트 중복 알림을 막는 dedupe key를 정의한다.

### 6.4 UI 작업

- [ ] 기본안은 독립 탭보다 시장 화면의 `오늘의 급변 레이더`로 배치한다.
- [ ] Portfolio에는 보유종목 관련 위험만 요약한 인박스를 제공한다.
- [ ] 카드에 차트, 분석, 뉴스, 관찰 등록, Portfolio 이동, 알림 동작을 제공한다.
- [ ] 급등과 급락에 같은 강도 문구를 재사용하지 않는다.
- [ ] 보유 여부, 데이터 기준일, 품질 상태, 원인을 카드에서 바로 확인할 수 있게 한다.
- [ ] 한쪽 provider 실패가 반대 방향 결과를 지우지 않게 한다.
- [ ] 현재 view 최초 진입 시에만 데이터와 UI를 로드한다.

완료 조건:

- 급락한 실제 보유종목이 일반 순위보다 먼저 보인다.
- 급등 종목을 직접 매수 후보로 승격하는 동작이 없다.
- 모든 카드에서 최소 하나 이상의 실제 다음 행동을 수행할 수 있다.
- 뉴스가 없는 경우에도 “원인 확인 안 됨”과 데이터 실패가 구분된다.
- 신규/강화/해소된 이벤트만 중복 없이 구분된다.

주요 수정 후보:

- `src/services/koreanMovers.ts`
- `src/services/newsSignals.ts`
- `src/services/portfolio/portfolioManager.ts`
- `src/services/smartMoneyWatchlist.ts`
- `src/routes/analysisRoutes.ts`
- `src/routes/portfolioRoutes.ts`
- `public/index.html`
- `public/app.js`
- `public/app.css`

새 경계 후보:

- `src/services/movementRadar.ts`
- `src/services/movementHistory.ts`
- `src/services/holdingRiskInbox.ts`

## 7. Phase 3 — 판단 변화와 성과 검증실

목표: 추천 규칙을 더 추가하기 전에 현재 엔진의 실제 품질을 측정한다.

history schema를 변경할 때는 [추천 히스토리 JSON 설계](./recommendation-history-json-design.md)의 실제 Portfolio와 모델 추천 분리 원칙을 유지한다.

해야 할 일:

- [ ] 중장기 history API와 스윙 history를 공통 조회 화면에 연결한다.
- [ ] 최초 판단과 최신 판단의 bucket, 점수, 가격, 이유 변화를 보여준다.
- [ ] Portfolio advice와 Recovery signal snapshot을 별도 이력으로 남긴다.
- [ ] 정책 버전별 결과를 분리한다.
- [ ] 급변 이벤트 이후 1/3/5/10거래일 수익률을 기록한다.
- [ ] MFE, MAE, 목표 도달, 무효가 이탈, 해소까지 걸린 기간을 계산한다.
- [ ] 시장 국면과 표본 수를 함께 보여준다.
- [ ] 표본이 적으면 승률이나 평균 수익률을 확정적 품질 지표처럼 표현하지 않는다.
- [ ] 실제 Portfolio 성과와 모델 추천 성과를 분리한다.

권장 화면 질문:

- 어떤 판단이 바뀌었는가?
- 왜 바뀌었는가?
- 그 판단은 이후 어떻게 됐는가?
- 어느 정책 버전과 시장 국면에서 유효했는가?

완료 조건:

- 각 결과를 최초 snapshot과 policy version까지 추적할 수 있다.
- fake backfill 없이 실제 관측 데이터만 집계한다.
- 수익률만이 아니라 MFE/MAE와 표본 수도 함께 표시한다.
- 실제 보유 성과와 추천 모델 성과가 혼합되지 않는다.

## 8. Phase 4 — 운영 기준선과 UX 마감

### 8.1 테스트와 CI

- [ ] Vitest 기반 핵심 규칙 단위 테스트
- [ ] Supertest 기반 Portfolio·급변 레이더 route 테스트
- [ ] provider timeout·부분 실패·동시성·cache 테스트
- [ ] Playwright 기반 핵심 화면 smoke test
- [ ] CI에 `check`, `test`, `build`, `smoke` 연결
- [ ] 수수료·세금·호가단위·예산 경계값 회귀 테스트

### 8.2 JSON 저장 안전성

- [ ] Portfolio holdings/account 저장에 atomic write와 mutation queue 적용
- [ ] 급변 snapshot과 event history에 동일 저장 경계 적용
- [ ] 알림에 durable outbox와 idempotency 적용
- [ ] 실패한 발송과 성공한 발송 이력을 분리
- [ ] runtime data retention과 archive 기준 정의

### 8.3 계좌 전체 위험

- [ ] 섹터 집중도와 동일 테마/상관 위험 계산
- [ ] 여러 종목이 동시에 Recovery READY일 때 계좌 전체 예산 시뮬레이션
- [ ] 예약 주문과 이미 배정한 현금을 반영
- [ ] Recovery 예산 사용 후 남는 현금과 최대 손실 시나리오 표시

### 8.4 Portfolio 운영 UX

- [ ] 보유종목 수동 추가·수정·삭제 UI
- [ ] 주문가능금액·예수금·실제 캡처 시각 편집
- [ ] OCR 저장 전 diff, 병합, 취소, 되돌리기
- [ ] 계좌번호와 개인정보 raw text 저장/로그 최소화
- [ ] 마스킹된 OCR fixture 추가

### 8.5 프론트와 보안

- [ ] 뉴스 외 view 단위 lazy loading
- [ ] 대형 `public/app.js`, `public/app.css` 기능별 분리
- [ ] latest-response-wins와 request abort 적용
- [ ] 모바일 분석 master-detail
- [ ] 외부 네트워크 공개 시 loopback 기본값, 인증, body/rate limit 적용
- [ ] 사용자 입력 webhook URL 제거 또는 allowlist 적용

보안 우선순위 예외:

- 로컬 전용이면 위 보안 항목은 Phase 4에서 진행할 수 있다.
- 외부 바인딩 또는 다른 사람과 공유할 계획이면 인증·rate limit·webhook 제한을 Phase 0보다 먼저 적용한다.

## 9. 작업 패키지와 의존성

| 순서 | 작업 패키지 | 선행 조건 | 결과 |
| --- | --- | --- | --- |
| 0-C1 | quote DTO/provider 정책 | 없음 | timeout·cache·in-flight·concurrency가 있는 가벼운 시세 |
| 0-C2 | Portfolio quote-only 연결 | 0-C1 | snapshot ID가 있는 Portfolio 시세와 view-aware polling |
| 0-B | account capturedAt·history freshness | 없음, 0-C와 병렬 가능 | 오래된 계좌와 추천 근거 차단 |
| 0-A | Recovery execution signal gate | 0-B, 0-C2 권장 | 문구가 아닌 실제 차단 evidence |
| 0-D | policy version·거래비용 | 0-A, 0-C2 | 재현 가능한 net Recovery 목표 |
| 1 | 급등락 parser·quality 복구 | quote/provider 정책 재사용 권장 | 신뢰 가능한 급변 입력 |
| 2-A | movement event·history | Phase 1 | 신규/강화/해소 delta |
| 2-B | holdings/news/watch 교차 | 2-A | 위험 인박스 서버 |
| 2-C | Radar·Inbox UI | 2-B | 행동 가능한 제품 화면 |
| 3 | 성과 검증실 | history와 event snapshot | 정책별 실제 품질 측정 |
| 4 | 운영·UX 마감 | 각 기능 안정화 | 회귀·저장·배포 안전성 |

병렬 진행 가능:

- 0-C1과 0-B는 병렬 가능하다.
- 0-A의 DTO·fixture 준비는 병렬 가능하지만 실제 연결은 0-B와 0-C2 이후가 안전하다.
- Phase 1 fixture와 parser 테스트는 Phase 0 UI와 병렬 가능하다.

병렬 진행 금지:

- 잘못된 parser를 그대로 둔 채 Radar UI부터 만들지 않는다.
- snapshot schema가 정해지기 전에 성과 대시보드 집계를 만들지 않는다.
- Recovery signal evidence 없이 추가매수 UI를 더 공격적으로 강조하지 않는다.

## 10. Phase별 검증 명령

모든 Phase 공통:

```bash
npm.cmd run check
npm.cmd run verify:portfolio-recovery
npm.cmd exec -- tsx src/scripts/verifyLongTermRecommendationHistory.ts
node --check public/app.js
npm.cmd run build
```

추가할 권장 명령:

```bash
npm.cmd run verify:portfolio-execution
npm.cmd run verify:portfolio-quotes
npm.cmd run verify:korean-movers
npm.cmd run verify:risk-inbox
npm.cmd test
```

각 구현 Phase에서 해당 검증 스크립트와 `package.json` 명령을 함께 추가하며, 문서에만 존재하는 명령으로 남기지 않는다.

필수 회귀 검증은 fake provider와 마스킹 fixture를 사용한다. 실제 Naver/Yahoo 호출은 네트워크와 외부 상태에 영향을 받는 선택적 smoke 검사로 분리한다.

수동 smoke 시나리오:

1. 최신 시세 + 최신 계좌 + 최신 READY 신호
2. 최신 시세 + 오래된 계좌
3. 오래된 시세 + 최신 계좌
4. 최신 시세 + 오래된 추천 신호
5. 일부 종목 provider timeout
6. 오래된 스크린샷 재업로드
7. 급락한 실제 보유종목
8. 급등한 비보유 종목의 watch 등록
9. 상승 provider 실패 + 하락 provider 성공
10. 동일 급변 이벤트 반복 수집과 dedupe

## 11. 각 작업 종료 시 문서 갱신

Phase 또는 패키지를 완료할 때 아래를 함께 갱신한다.

- `docs/current-implemented-features.md`: 실제 구현된 기능만 반영
- 이 문서: 완료한 checkbox와 검증 결과
- `docs/project-history.md`: 날짜별 변경 요약
- 정책 변경 시 관련 엔진 문서와 policy version
- 새 API/JSON 추가 시 데이터 소유권과 retention

문서에 구현 완료라고 쓰기 전에 코드, 전용 검증, 일반 타입 검사를 모두 확인한다.

## 12. 집에서 작업을 시작할 때 사용할 지시문

아래 내용을 새 작업 세션에 그대로 전달할 수 있다.

```text
docs/project-enhancement-execution-plan-2026-07-27.md를 현재 고도화 작업의 기준 문서로 사용해라.
먼저 현재 코드와 dirty worktree를 확인하고 사용자 변경과 data JSON을 보존해라.
작업은 문서의 Phase 0부터 시작하며, 한 번에 하나의 작업 패키지만 구현해라.
각 패키지의 현재 문제를 코드로 다시 검증하고, 완료 조건을 자동 검증으로 고정한 뒤 구현해라.
Portfolio Recovery v1의 WAIT_SIGNAL=0원, RECOVERY_READY에서만 시뮬레이션, REDUCE_ONLY 추가매수 금지 규칙은 깨뜨리지 마라.
과거 추천 가격·점수·성과를 추측해서 백필하지 마라.
완료 후 공통 검증과 해당 Phase 전용 검증을 실행하고 문서 checkbox와 current-implemented-features를 실제 상태에 맞게 갱신해라.
```

첫 실행 권장 범위:

```text
Phase 0-C quote-only provider와 Phase 0-B capturedAt 분리를 우선 구현한다.
그 다음 Phase 0-A 실제 Portfolio execution signal evidence를 연결한다.
Phase 0 완료 조건이 통과하기 전 급변 레이더 UI 구현을 시작하지 않는다.
```
