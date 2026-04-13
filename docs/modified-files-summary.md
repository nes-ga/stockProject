# 수정 사항 정리

기준 시점: `2026-04-09` 현재 워킹트리

## 전체 요약

- `git diff --stat` 기준으로 추적 중인 파일 `24개`가 변경되었고, `3,794`줄 추가 / `2,252`줄 삭제가 발생했다.
- 이번 변경의 중심은 다음 4가지다.
  - 프런트 대시보드를 단일 추천 종목 화면에서 멀티 뷰 구조로 확장
  - 장기 투자 후보를 위한 `long-term engine` 신규 도입
  - `smart money` 스윙 엔진의 실행 가능성 판단 로직 강화
  - 기존 `BAND` 연동 기능 제거 및 문서/빌드 체계 재정리

## 1. 프런트엔드 / 대시보드 변경

주요 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`
- `frontend/newsSignalDashboard.jsx`
- `public/news-signal-dashboard.js`

정리:

- 메인 화면이 탭 기반 멀티 뷰 구조로 확장되었다.
  - 뉴스 시그널 뷰
  - 지수/자산 감시 뷰
  - 추천 종목/분석 뷰
  - 급등/급락 뷰
- 추천 종목 화면에 카테고리/버킷 분리 UI가 추가되었다.
  - 장기: `buy`, `watch`
  - 스윙: `execution`, `watch`
- 페이지네이션, 종목 추가 모달, 지수 차트 모달, 스윙 점수 안내 모달 등 세부 UI가 확장되었다.
- 실시간 종목 스냅샷과 종목 상세 차트 조회를 화면에서 직접 사용할 수 있도록 연결되었다.
- 급등/급락 화면이 단순 리스트가 아니라 점수, 테마, 대표 종목까지 보여주는 구조로 강화되었다.
- 뉴스 시그널 대시보드는 React 기반 별도 엔트리로 분리되었고, 빌드 결과물이 `public/news-signal-dashboard.js`로 생성되도록 구성되었다.

## 2. 빌드 / 패키지 구성 변경

주요 파일:

- `package.json`
- `package-lock.json`
- `scripts/build-news-dashboard.mjs`

정리:

- 패키지명이 `band-stock-api`에서 `stock-project-api`로 변경되었다.
- `build` 스크립트가 TypeScript 컴파일 이후 뉴스 대시보드 번들까지 생성하도록 확장되었다.
- 신규 스크립트가 추가되었다.
  - `build:news-dashboard`
  - `scan:long-term`
  - `scan:long-term-universe`
- `react`, `react-dom` 의존성이 추가되었다.

## 3. 분석 / 조회 API 확장

주요 파일:

- `src/routes/analysisRoutes.ts`
- `src/app.ts`
- `src/types.ts`
- `src/services/realtimeStocks.ts`
- `src/services/serverLongTermPicks.ts`
- `src/services/newsSignals.ts`

정리:

- 분석 라우트에 신규 API가 추가되었다.
  - `GET /analysis/market-watch`
  - `POST /analysis/realtime-stocks`
  - `POST /analysis/realtime-stock-detail`
  - `GET /analysis/server-long-term-picks`
  - `POST /analysis/server-long-term-picks`
  - `GET /analysis/news-signals`
- 기존 `server-swing-picks`는 단일 리스트가 아니라 `executionItems`와 `watchItems`를 함께 다루는 구조로 바뀌었다.
- 앱 시작 시 뉴스 시그널 수집기를 초기화하도록 변경되었다.
- 타입 정의가 크게 확장되어 실시간 시세, 장기 후보 분석, 뉴스 시그널, 스마트머니 세부 메타데이터를 포함하게 되었다.

## 4. 장기 투자 후보 엔진 신규 추가

주요 파일:

- `src/services/longTermEngine.ts`
- `src/services/longTerm/config.ts`
- `src/services/longTerm/correctionScore.ts`
- `src/services/longTerm/fundamentalScore.ts`
- `src/services/longTerm/labels.ts`
- `src/services/longTerm/leaderScore.ts`
- `src/services/longTerm/liquidityScore.ts`
- `src/services/longTerm/marketData.ts`
- `src/services/longTerm/metrics.ts`
- `src/services/longTerm/stabilizationScore.ts`
- `src/services/longTerm/trendScore.ts`
- `src/services/longTerm/universe.ts`
- `src/scripts/scanLongTermLeaders.ts`
- `src/scripts/scanUniverseLongTermPicks.ts`

정리:

- 장기 투자 관점의 별도 엔진이 새로 추가되었다.
- 평가 축이 분리되었다.
  - leader score
  - correction score
  - trend score
  - liquidity score
  - stabilization score
  - financial score
- 큐레이션된 리더 유니버스 스캔과 전체 유니버스 스캔을 각각 지원한다.
- ETF/ETN 제외, 유동성 하한, 구조적 하락 추세 제외, 재무 하드 익스클루전 등 필터가 반영되었다.
- 결과는 `buy candidate`, `watch candidate` 그룹과 라벨 기반으로 분류된다.
- 서버 장기 종목 저장 파일 `data/server-long-term-picks.json`을 읽고 쓰는 서비스가 추가되었다.

## 5. 스마트머니 / 스윙 엔진 고도화

주요 파일:

- `src/services/smartMoneyEngine.ts`
- `src/services/smartMoneyEnhancer.ts`
- `src/services/smartMoney/config.ts`
- `src/services/smartMoney/marketContext.ts`
- `src/services/smartMoney/pricing.ts`
- `src/services/smartMoney/utils.ts`
- `src/scripts/scanUniverseSwingPicks.ts`
- `src/services/serverSwingPicks.ts`
- `src/services/discord.ts`

정리:

- 스마트머니 엔진이 대형 파일 하나에서 일부 설정/계산 로직이 분리되었다.
  - 필터/기본값
  - 시장 컨텍스트 계산
  - 가격 호가 단위 처리
  - 공통 유틸 함수
- `matched`와 `actionable` 구분이 더 명확해졌다.
  - 패턴 품질 통과 여부
  - 실제 실행 가능한 진입 상태
- 손절 기준 날짜와 기준 종류(`session_low`, `close_fallback`)를 다루도록 확장되었다.
- `breakout_extended`, `no_chase` 같은 추격 금지 상태를 별도 처리한다.
- 스윙 유니버스 스캔 결과를 `execution` 버킷과 `watch` 버킷으로 분리 저장한다.
- Discord 메시지 포맷도 상태, 진입 방식, SMA20, 매수 플랜, 손절 기준을 더 자세히 보여주도록 바뀌었다.

## 6. 추천 분석 / 실시간 시세 / 시장 감시 개선

주요 파일:

- `src/services/stockAnalysis.ts`
- `src/services/marketWatch.ts`
- `src/lib/dates.ts`
- `src/services/fundamentals.ts`
- `src/config.ts`
- `src/lib/logger.ts`

정리:

- 추천 종목 분석 결과에 `category`와 `longTermReview` 정보가 포함되도록 변경되었다.
- 실시간 종목 상세 조회 로더가 추가되어 앵커 날짜 기준 차트와 최신 가격을 함께 반환할 수 있게 되었다.
- `marketWatch`는 지수/환율/금 시세를 더 정교하게 계산하도록 확장되었다.
  - intraday
  - daily
  - weekly
  - yearly
- 날짜와 로그 타임스탬프를 `Asia/Seoul` 기준으로 다루는 유틸이 추가되었다.
- 재무 데이터 조회에 캐시가 추가되었다.
- 실시간 종목 조회에도 짧은 TTL 캐시가 추가되었다.

## 7. 알림 / 감시 기능 변경

주요 파일:

- `src/routes/alertRoutes.ts`

정리:

- `smart-money-watchlist/scan` 입력 스키마가 크게 확장되었다.
  - `referenceDate`
  - `marketContext`
  - `debug`
  - 세부 `filters`
  - Discord 전송 시 `onlyActionable`
- 실시간 급등 알림 포맷과 응답 정보도 정리되었다.

## 8. 제거된 기능

주요 파일:

- `src/routes/authRoutes.ts`
- `src/routes/bandRoutes.ts`
- `src/services/bandClient.ts`
- `src/config.ts`

정리:

- `BAND` OAuth 및 게시글 조회 관련 기능이 제거되었다.
- 이에 따라 앱 라우트에서 `/auth`, `/band` 마운트가 삭제되었다.
- 환경변수 설정에서도 `BAND_CLIENT_ID`, `BAND_CLIENT_SECRET`, `BAND_REDIRECT_URI`, `BAND_STATE` 관련 코드가 제거되었다.
- 심볼 추출기의 stop word 목록에서도 `BAND`가 제거되었다.

## 9. 문서 추가 / 정리

주요 파일:

- `README.md`
- `docs/README.md`
- `docs/current-implemented-features.md`
- `docs/long-term-engine-design.md`
- `docs/smart-money-maintenance.md`

정리:

- 루트 `README.md`가 현재 프로젝트 방향에 맞게 다시 정리되었다.
- `docs` 아래에 현재 구현 범위, 장기 엔진 설계, 스마트머니 유지보수 가이드 문서가 추가되었다.
- 기능 변경을 코드뿐 아니라 운영/유지보수 문서로 같이 정리하려는 방향이 보인다.

## 10. 기타 신규 파일

주요 파일:

- `request-smart-money.json`
- `tmp/swing-watch-universe.json`
- `tmp/universe-scan.log`

정리:

- 스마트머니 요청 예시 및 스캔 결과/로그 성격의 보조 파일이 추가되어 있다.
- `tmp` 디렉터리 파일은 실험/중간 결과물일 가능성이 높다.

## 11. 2026-04-13 후속 보정

정리:

- 추천 종목 화면의 1차 카테고리 탭은 `중장기 / 배당 / 스윙` 3개가 한 줄에 고정되도록 정리되었다.
- 추천 종목 인터랙티브 차트의 기준일 가격선은 일봉뿐 아니라 주봉, 월봉 집계 봉에도 맞춰 표시되도록 보정되었다.
- `marketWatch` 는 `BTC` 를 포함한 6개 자산을 계속 제공하며, 화면 표시 날짜는 서울 기준 `fetchedAt` 으로 통일한다.
- 다만 원본 시장 데이터의 실제 거래일은 자산별 거래소 시간대에 따라 다를 수 있으므로 `Gold`, `WTI` 는 소스 기준 날짜가 하루 늦을 수 있다.
- crypto 최신 봉을 잘라내던 처리 로직이 정리되어 `BTC` 의 최신 일봉/주봉 집계가 현재 기준일과 어긋나지 않도록 수정되었다.
- 스마트머니 유지보수 문서는 현재 저장 정책에 맞게 갱신되었다.
  - `executionItems`: actionable
  - `watchItems`: matched watch candidates

## 결론

이번 변경은 단순 버그 수정이 아니라 프로젝트 구조 자체를 넓히는 성격의 대규모 개편이다.

- 프런트는 멀티 뷰 대시보드로 확장되었고
- 백엔드는 장기 엔진, 뉴스 시그널, 실시간 조회 API가 추가되었으며
- 스윙 엔진은 실행 가능성 중심으로 로직이 더 정교해졌고
- 기존 BAND 연동은 완전히 제거되었다.

즉, 현재 변경분은 `추천 종목 분석 도구`에서 `장기/스윙/뉴스/시장 감시를 묶은 종합 주식 대시보드` 방향으로 이동한 것으로 볼 수 있다.
