# 프로젝트 연혁

이 문서는 주요 변경을 날짜 순서로 정리합니다.

## 2026-07-27 - Portfolio 데이터 원본 경계

- ignore되던 `data/portfolio-holdings.json`을 Git 추적 가능한 개발 전용 `data/development/portfolio` 원본으로 이동했습니다.
- holdings와 account 저장소가 하나의 공통 data source resolver를 사용하도록 통합했습니다.
- 비운영 개발 실행은 시작 명령과 관계없이 Git 개발 원본을 기본 선택하고, private 모드는 명시적으로 선택한 Git 제외 디렉터리 또는 저장소 밖 절대경로 하나만 사용합니다.
- 운영 환경에서 Git 개발 원본이나 저장소 내부 private 경로를 선택하면 시작 단계에서 차단합니다.
- Portfolio 화면과 API에 현재 데이터 원본, 논리 경로, Git 추적 여부, 자동 왕복 금지 정책을 표시합니다.
- 개발 원본과 private 원본의 자동 fallback·복사·병합·양방향 동기화를 금지하고 수동 1회 운영 이전 절차를 문서화했습니다.

관련 문서:

- [Portfolio 데이터 원본 경계](./portfolio-data-boundary.md)

## 2026-07-27 - Portfolio 금액 기준 Recovery Plan

- 관찰가를 현재가로 복사해 완료처럼 보이던 `복구 단계` 진행률을 제거했습니다.
- 실시간 시세를 먼저 보유 데이터에 반영한 뒤 행동 판단과 `PortfolioRecoveryPlan`을 같은 snapshot에서 계산합니다.
- 카드와 상세 화면에 현재 투입금, 평가금, 손실금, 손익분기 가격, 필요한 반등률을 표시합니다.
- `RECOVERY_READY`는 예시 추가금과 안전 상한, 새 평단, 1차 추가금 회수, 최종 +3% 목표를 제공합니다.
- `WAIT_SIGNAL`은 지금 추가금을 0원으로 고정하고 추가매수 가정 시뮬레이션을 만들지 않습니다. 목표 반등률까지 낮추는 데 필요한 금액은 실행안이 아닌 부담 설명으로만 안내합니다.
- `REDUCE_ONLY`는 추가매수를 차단하고 반등 시 비중 축소를 우선합니다.
- 매수 직후에는 평단만 낮아지고 절대손실은 거의 그대로라는 설명을 화면에 함께 표시합니다.
- 오래된 시세·계좌 금액으로 추가금이 제시되지 않도록 시세 4일, 계좌 96시간의 최신성 제한과 추정 총자산 필수 조건을 적용했습니다.
- 무효가는 직접 연결/현재 진행 중인 손절가와 보유 평단 70% 중 높은 고정 기준을 사용하며, 1차 회수 매도 후 잔여 수량 기준으로 최종 +3% 목표를 다시 계산합니다.
- 누적 매수원금과 평가금 중 큰 값을 기준으로 종목 노출이 추정 총자산의 15%를 넘지 않게 제한합니다.
- 입력 매수금액이 평균단가×수량과 2% 이상 다르면 원가 오입력으로 보고 보정합니다.
- 상단 카운터·우선 대응·카드 행동은 실제 금액 안전 조건을 통과한 `RECOVERY_READY` 기준으로 맞춰, 추가금 0원과 `추가매수 가능`이 동시에 보이지 않게 했습니다.
- 카드 상단 리커버리 영역에 관리 엔진 무효가와 현재가 대비 거리, 유효/이탈 상태, 산정 근거를 항상 표시합니다.
- 합성 Recovery 시나리오 검증 스크립트 `npm run verify:portfolio-recovery`를 추가했습니다.
- 구현 후 감사에서 실제 회복 신호 evidence, 추천 신호 유효기간, 계좌 캡처 시각, quote-only 시세 경로를 후속 실행 안전성 범위로 분리했습니다.
- 급등·급락 정확성 복구, 보유종목 위험 인박스, 판단 성과 검증까지 이어지는 [고도화 실행 계획](./project-enhancement-execution-plan-2026-07-27.md)을 작성했습니다.

관련 수정:

- `src/services/portfolio/recovery.ts`
- `src/services/portfolio/types.ts`
- `src/services/portfolio/rules.ts`
- `src/services/portfolio/portfolioManager.ts`
- `public/index.html`
- `public/app.js`
- `public/app.css`
- `docs/work-plan-2026-07-08-portfolio-manager.md`
- `docs/project-enhancement-execution-plan-2026-07-27.md`

## 2026-07-13 - UI Shell 1차 개편

- 대형 hero를 compact sticky header로 줄이고 분석 화면을 데스크톱 2열, 모바일 단일 열 작업 구조로 정리했습니다.
- 사용자 피드백에 따라 배경 mascot parade, 브랜드 캐릭터, 상단 6개 탭별 캐릭터를 복원했습니다.
- 전역/추천 탭의 키보드 이동과 ARIA 상태, 모달 focus trap·복귀·배경 inert·스크롤 잠금을 적용했습니다.
- Portfolio의 행동 우선 배치를 강화하고 `AI`처럼 실제 구현보다 강한 표현을 규칙 기반 한국어 용어로 바로잡았습니다.
- 뉴스 화면은 최초 진입 시에만 불러오며 production/minified build를 적용했습니다. 번들은 1,103,322 bytes에서 205,571 bytes로 줄었습니다.
- 뉴스 초기 오류와 재시도, 기존 데이터를 유지하는 갱신 지연 상태, 분석·Portfolio·급등락의 로딩/오류/빈 상태를 분리했습니다.
- `node --check public/app.js`, `npm.cmd run check`, `npm.cmd run build`를 통과했고 Chrome 1440x1000 및 390x844에서 주요 화면의 overflow와 콘솔 오류를 확인했습니다.
- 모바일 분석 master-detail, Portfolio 수동 CRUD, 뉴스 외 화면 lazy loading, 대형 `app.js`/`app.css` 분리는 후속 작업입니다.

관련 문서:

- [2026-07-13 UI Shell 작업 요약](./work-summary-2026-07-13-ui-refresh.md)
- [2026-07-13 프로젝트 개선 제안서](./project-improvement-proposal-2026-07-13.md)

## 2026-06-29

스윙 `execution_probe` 오분류를 보정했습니다.

- 사용자 화면의 `진입 가능`은 실제 매수가 도달 상태만 표시합니다.
- 실행 후보 승격 조건은 `stage=setup`, `status=buy_ready`, `referenceClose`가 staged entry zone 안에 있는 경우로 제한했습니다.
- `execution_probe`, `entry_zone_pending`, `long_pullback_until_stop_probe`는 관찰/확인 후보로 취급합니다.
- 저장 파일의 `executionItems` 안에 남아 있는 과거 `execution_probe` 레코드는 읽을 때 `watchItems`로 분리합니다.
- 프론트 bucket 해석에서도 `execution_probe`를 `execution` 탭으로 올리지 않습니다.
- 문서 기준을 `docs/smart-money-maintenance.md`, `docs/swing-pullback-policy-2026-05-11.md`에 반영했습니다.

관련 수정:

- `src/services/recommendationUniverse.ts`
- `src/services/serverSwingPicks.ts`
- `public/app.js`
- `docs/smart-money-maintenance.md`
- `docs/swing-pullback-policy-2026-05-11.md`

## 2026-06-23

스윙 히스토리의 현재 후보 표시와 분할매수 체결 추적을 보정했습니다.

- 이미 열린 히스토리 케이스는 현재 스캔에서 `execution`에서 `watch`로 내려가도 현재 추적 목록에 계속 표시합니다.
- 열린 히스토리 케이스의 분할매수 체결 체크는 현재 bucket과 무관하게 계속 수행합니다.
- 최신 일봉 경로를 최초 고정 `buyPlan`과 대조해 1차/2차/3차 매수가 터치 여부를 다시 계산합니다.
- 서버 현재 픽 payload에 `postEntryOutcome`이 없어도, 히스토리 갱신 단계에서 Naver 일봉을 재생해 `executedBuys`, 평균 매수가, 수익률을 보정합니다.
- 기준 사례: 삼성에스디에스 `018260`은 2026-06-18 열린 케이스가 2026-06-23에 `watch`로 내려갔지만, 고정 매수가 `242000/210500/177800` 기준 2차까지 체결된 active case로 유지합니다.
- 기존 스윙 히스토리 케이스까지 `decisionSnapshot`, `stagedBuyDiagnostics`, `outcomeDiagnostics`를 붙여 승률 조건 분석용 JSON으로 확장했습니다. 과거 케이스에서 원본 메타데이터가 없는 `penaltyFactors`와 `envelope`은 임의 추정하지 않습니다.
- 스윙 검색 엔진에 히스토리 승률 가드를 연결했습니다. 손실률이 높은 조건 클러스터는 실행 후보를 `watch`로 낮추고, 약한 손실 우위 조건은 `execution_ready`를 `execution_probe`로 낮춥니다.
- 3차 매수권 후보는 지지, 캔들, 거래량, ENV20 확인이 없으면 `third_buy_confirmation_required`로 표시하고 실행 후보에서 제외합니다.
- 3차 매수 히스토리 실행 기준을 저가 터치에서 회복 확인 방식으로 바꿨습니다. 3차 가격과 손절가 사이의 애매한 구간은 `waiting_reclaim`으로 두고, 3차 비중을 평균 매수가에 넣지 않습니다.
- 3차 미확정 딥존에서 기간 중 고가가 2차 평균 기준 목표 수익률을 충족하면 `deep_zone_rebound_exit`로 종료하고, 3차 회복 없이 5거래일 이상 머물면 `deep_zone_timeout_exit` 위험 종료로 처리합니다.
- 딥존 목표 슈팅은 손절 판정보다 먼저 적용합니다. 수익 청산 가능 구간이 나온 뒤 손절가 아래로 밀려도 손절 종료로 뒤집지 않습니다.

관련 수정:

- `src/services/recommendationHistory.ts`
- `src/services/smartMoneyEnhancer.ts`
- `src/services/recommendationUniverse.ts`
- `src/types.ts`
- `scripts/refresh-server-swing-picks.ts`
- `public/app.js`
- `docs/smart-money-maintenance.md`

## 2026-06-02

Naver 기반 KOSPI/KOSDAQ 지수 분봉 사용 가능성을 조사했습니다.

- 현재 프로젝트의 지수 일봉은 `fchart.stock.naver.com/sise.nhn`에서 `timeframe=day`, `count=5200`으로 가져옵니다.
- 같은 `fchart` 경로에서 `timeframe=minute`은 지수에 대해 빈 `<protocol />`을 반환했고, `timeframe=30`은 validation 실패였습니다.
- `api.finance.naver.com/siseJson.naver`는 개별 종목 minute 데이터는 주지만, KOSPI/KOSDAQ 지수 minute 데이터는 row를 주지 않았습니다.
- `api.stock.naver.com/chart/domestic/index/...`는 `periodType=dayCandle` 지수 일봉은 주지만, `periodType=minuteCandle`은 실패했습니다.
- Naver 모바일 지수 페이지에는 `scriptChartTypes`에 `candleMinuteFive`가 확인되어, Naver 내부에 지수 분봉성 차트가 존재할 가능성은 높습니다.
- 남은 작업은 ChartIQ 번들에서 실제 분봉 데이터 endpoint와 parameter를 찾는 것입니다.

관련 문서:

- [2026-06-02 Naver 지수 분봉 조사](./naver-index-intraday-investigation-2026-06-02.md)

## 2026-06-01

스윙 히스토리에 시장 충격 손절 유예 장치를 추가했습니다.

- KOSPI/KOSDAQ 1일 급락, 3일 누적 급락, 20일선 동반 이탈 매도세를 시장 충격으로 감지합니다.
- 체결된 스윙 케이스가 시장 충격일에 손절가를 종가 기준 이탈하면 즉시 `stop_broken`으로 닫지 않고 `market_shock_grace`로 1거래일 유예합니다.
- 다음 확인에서도 손절가를 회복하지 못하면 `market_shock_stop`으로 종료합니다.
- 손절가를 영구 하향하지 않고, 지수 급락에 의한 가짜 손절 가능성만 제한적으로 분리합니다.
- 히스토리 요약과 종료 케이스 UI에서 시장충격 유예/손절을 구분할 수 있게 했습니다.

## 2026-05-27

스윙 히스토리와 현재 후보 저장 정책을 보정했습니다.

- 체결된 기존 스윙 케이스는 새 universe scan에서 신선한 패턴으로 다시 잡히지 않아도 바로 종료하지 않습니다.
- 손절가 이탈, 목표 수익률 도달, 완만 상승 종료, 시간 종료, 명시적 수동 제거가 없으면 `watchItems`로 carry-forward 합니다.
- `src/services/recommendationHistory.ts`에 carry-forward 대상 판정 helper를 추가했습니다.
- `src/services/recommendationUniverse.ts`에서 새 스캔 결과 저장 전 기존 체결 케이스를 `watchItems`에 병합합니다.
- 현재 추천 상태 UI는 매수 후보만 보여주되, 히스토리 생명주기 판단은 `executionItems`와 `watchItems`를 모두 현재 케이스로 봅니다.
- 기준 사례: `펄어비스`는 손절가 위에 있고 목표 수익률도 확정되지 않았으므로 새 스캔 누락만으로 종료하면 안 됩니다.
- 후속으로 히스토리 UI와 생명주기 판정을 보정했습니다.
  - 신규 `watchItems`는 히스토리 케이스를 새로 열지 않습니다.
  - 기존 히스토리 케이스가 `watch`로 내려간 경우만 현재 케이스로 유지합니다.
  - 손절가 이탈은 현재 후보 매칭보다 우선해서 `stop_broken`으로 닫습니다.
  - 미체결 후보는 평균 매수가 대신 1차 매수가를 표시합니다.
  - 기준 사례: `삼륭물산`은 기존 3차 체결 watch 케이스로 유지, `극동유화`는 신규 watch 히스토리에서 제거, `흥구석유` default는 손절 종료 처리.

관련 문서:

- [2026-05-27 스윙 히스토리 carry-forward 정책](./work-summary-2026-05-27.md)
- [2026-05-27 스윙 히스토리 정리](./work-summary-2026-05-27-history-cleanup.md)
## 2026-05-22

Swing recommendation history policy was adjusted so that a candidate is not closed merely because it moved from `executionItems` to `watchItems`.

- `watchItems` are now included when deciding whether an existing swing history case is still current.
- Existing or entered watch cases stay `active` until a real close condition occurs, such as stop break, target/exit classification, timeout, or complete removal from the swing universe.
- New watch-only names are not opened as history cases unless they already have an entry assumption or an existing history case.
- Active entered cases refresh `latestClose`, `dataDate`, and return from the latest Naver daily candle before writing history, so stale pick payload prices do not overwrite history.
- Example: `삼륭물산` moved from execution candidate to watch because of lower-envelope/support quality deterioration, but it remains an active history case because it did not break the stop.

## 2026-05-15

스윙/소형 스윙 매수 후보 엔진을 차트 구조 중심으로 재정리했습니다.

- 선행수급 전 박스 압축 필터 추가
- KOSPI/KOSDAQ 지수 충격 구간에서는 pre-lead box 한도를 제한적으로 완화
- 짧은 급등 후 붕괴형은 `failed_post_spike_pullback_shape`로 매수 후보에서 제외
- 손절가 전 긴 눌림은 `long_pullback_until_stop_probe`로 visibility를 유지하되 현재 정책에서는 매수 승격 사유가 아님
- 히스토리 생명주기 판단은 이후 보정으로 기존/체결 케이스에 한해 `watchItems`도 current로 반영
- 차트 실시간 갱신은 chart-only/update 방식으로 깜빡임 완화
- 당시 현재 실행 후보: 기본 스윙 9개, 소형 스윙 3개, 총 12개. 현재 정책에서는 `execution_probe`가 사용자 화면의 매수 후보가 아님.

관련 문서:

- [2026-05-15 스윙 엔진/후보 정리](./work-summary-2026-05-15.md)

## 2026-05-12

스윙 추천 히스토리 품질과 현재 추천 상태 UX를 정리했습니다.

- 현재 추천 상태에서 신규 후보도 수익률이 보이도록 `postEntryOutcome` 수익률 필드를 보강
- 히스토리 읽기/갱신/시드 생성 단계에서 1000원 이하 동전주 제외
- 현재 추천 상태 카드를 누르면 기존 종목 상세 차트 데이터를 사용하는 차트 팝업 표시
- 스윙 히스토리 종료 사유를 `슈팅 수익`, `완만 상승 종료`, `매수 전 제외`, `손절 종료`, `시간 종료`로 분류
- `data/recommendation-history/swing-history.json` 재계산
- `npm.cmd run check`, `node --check public\app.js`, `npm.cmd run build` 검증

관련 문서:

- [2026-05-12 작업 요약](./work-summary-2026-05-12.md)

## 2026-04-10

뉴스/이벤트/인코딩 기반 정리.

- Naver Search API 기반 뉴스 시그널 수집 구조 추가
- 뉴스 시그널 React 대시보드 번들 구조 정리
- 이벤트 캘린더 JSON payload와 `GET /analysis/market-event-calendar` 추가
- 이벤트 캘린더 UI와 상세 modal 추가
- Naver Finance HTML decoding 경로 점검
- `npm run check`, `npm run build` 검증

관련 문서:

- [2026-04-10 작업 요약](./work-summary-2026-04-10.md)

## 2026-04-13

추천 화면, 시장 감시, 스윙 저장 구조 정리.

- 추천 카테고리를 `중장기`, `배당`, `스윙` 중심으로 정리
- 주봉/월봉 anchor line 정렬 개선
- 시장 감시 대상에 BTC 포함
- 서울 기준 fetch date 표시 정리
- 스윙 universe 저장 payload를 `executionItems`, `watchItems`, `items`로 정리
- `matched`와 `actionable` 의미 분리

관련 문서:

- [2026-04-13 작업 요약](./work-summary-2026-04-13.md)

## 2026-04-14

스윙 스마트머니 엔진 유지보수성 강화.

- setup/breakout threshold 분리
- 시장 국면 기반 threshold 조정
- `execution_ready`, `execution_probe`, `watch` bucket 정리
- 거래정지 사유별 처리 추가
- `reasons`, `tags`, `penaltyFactors` 설명 가능성 필드 정리

관련 문서:

- [2026-04-14 작업 요약](./work-summary-2026-04-14.md)
- [스마트머니 유지보수 가이드](./smart-money-maintenance.md)

## 2026-04-27

프로젝트 전체 구조 문서화.

- 서버/API/프론트/엔진 구조를 한 문서로 정리
- 스윙, 중장기, 배당, 시장 감시, 뉴스, 이벤트 캘린더 역할 구분
- JSON 저장소 한계와 외부 데이터 의존성 정리

관련 문서:

- [프로젝트 개요](./project-overview-2026-04-27.md)

## 2026-04-30

차트 공백/비거래일 이슈 조사.

- `open=0` 단독으로는 비거래 candle로 보지 않는다는 점 확인
- OHLCV 전체 zero row만 비거래/거래정지 point로 판단
- 공휴일/비거래일을 억지로 채우는 방식이 차트 형태를 왜곡할 수 있음을 문서화

관련 문서:

- [차트 이슈 조사](./chart-investigation-2026-04-30.md)

## 2026-05-08

매물대 분석 엔진 고도화와 문서 재정리.

### 매물대 공통 모듈

- `src/services/volumeProfile.ts` 추가
- 일봉 OHLCV 기반 volume profile 계산
- ATR(14) 기반 동적 binSize
- 시간감쇠 가중치
- 몸통 중심 거래량 배분
- gap vacuum zone 기록과 배분 보정
- 거리감쇠 위/아래 매물 계산
- POC와 Value Area High/Low
- 리테스트 성공/실패
- 다음 지지/저항과 reward/risk
- profileReliability와 warning 제공

### 스윙 엔진 통합

- `swingVolumeProfile` 추가
- 60일/120일 매물대 분리
- 추격 위험, 돌파 신뢰도, 눌림 지지 품질 산출
- 매물대 양수 가산은 BUY 직접 승격에서 제외
- 매물대 음수 점수는 리스크 감점으로 반영

### 중장기 엔진 통합

- `longTermVolumeProfile` 추가
- 240일/480일/720일 매물대 분리
- 장기 바닥권 누적, 박스권 돌파, 장기 위 매물 부담, 고점권 정체, 보유 품질 평가
- `volumeProfileScore`를 중장기 totalScore에 보조 반영
- `structuralBreakoutReliability` 추가

### UI/JSON 확장

- `volumeProfileAnalysis` 추가
- `advancedVolumeProfile` 추가
- 스윙/중장기 카드에 매물대 패널 추가
- 장기 후보 표에 매물대 보조점수 추가

### 차트 보정

- 공휴일/비거래일을 강제로 whitespace point로 채우던 흐름 제거
- 실제 거래 데이터 중심으로 chart series 구성

### 검증

실행 완료:

```bash
npm run check
npm run build
node --check public/app.js
npx tsx src/scripts/verifyVolumeProfile.ts
npx tsx src/scripts/checkVolumeProfileImpact.ts
```

실제 후보 영향 샘플:

- 스윙 `시공테크`: 위 매물/리테스트 실패로 `volumeProfileScore -20`
- 스윙 `레이`: 매물대 구조는 좋지만 BUY 직접 승격 없이 ranking support로 제한
- 중장기 `퍼스텍`: 장기 박스권 돌파와 구조 신뢰도로 강한 보조 점수
- 중장기 `기업은행`: 장기 바닥권 누적과 보유 품질 양호
- 중장기 `엔씨소프트`: 장기 박스권 돌파 실패 리스크 반영

## 현재 방향

- 스윙은 “진입 타이밍과 리스크 관리” 중심
- 중장기는 “구조적 우위와 보유 품질” 중심
- 매물대는 단독 매수 신호가 아니라 보조 판단 지표
- BUY 후보를 공격적으로 늘리기보다 리스크 해석을 강화
## 2026-06-23 - 3차 조정 매수 정책

- 원래 3차 매수가와 손절가 사이에서 가격이 오래 머물 때, 지수 안정성과 종목 바닥 다짐이 확인되면 `adjustedThirdBuyPrice`를 산출해 3차 매수가를 조정합니다.
- 조정 3차가는 손절가 대비 최소 6% 여유, 2차 매수가보다 낮은 가격, 지수 risk-off 아님, 종목 지지 안정/거래량 수축/캔들 회복 조건을 통과해야 합니다.
- JSON에는 `originalThirdBuyPrice`, `adjustedThirdBuyPrice`, `thirdBuyAdjustment`, `thirdBuyMonitor.adjustmentReason`을 남기고, 이후 3차 체결/평단/슈팅/손절 판정은 조정가 기준으로 계산합니다.

## 2026-06-30 - 스윙 추천 히스토리 Cycle/Recovery 정리

- 스윙 추천 히스토리 화면을 `진행 중 추천`, `거래 완료`, `미진입 제외` 기준으로 분리했다.
- 평균 수익률과 수익/손절 통계는 실제 매수가 발생한 거래완료 케이스 기준으로 계산하도록 정리했다.
- 같은 `strategy/profile/symbol` 반복 추천을 Cycle 1, Cycle 2처럼 응답 DTO에서 계산한다.
- 손실 종료 이후 120일 이내 재추천된 active/entered 케이스는 Recovery Cycle로 표시한다.
- `no_entry`는 Cycle 번호에는 포함하지만 Recovery 원인/대상에서는 제외한다.
- 종료 케이스 필터 기본값을 `거래완료`로 바꾸고, `미진입 제외`는 별도 필터에서 확인하도록 했다.
- 종료 카드 매수가 영역은 `1차 12,345 06-30` 형태의 한 줄 표시로 정리했다.

관련 문서:

- [2026-06-30 스윙 추천 히스토리 Cycle/Recovery 작업 요약](./work-summary-2026-06-30-swing-history-cycle.md)
