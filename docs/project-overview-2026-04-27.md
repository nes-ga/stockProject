# 프로젝트 현황 문서 - 2026-04-27

이 문서는 현재 코드 기준으로 `bandProject`의 구조, 실행 방법, 주요 기능, API, 데이터 저장 방식을 다시 정리한 문서다. 기존 일부 문서는 한글 인코딩이 깨져 있어, 이 파일을 최신 진입 문서로 사용한다.

## 1. 프로젝트 개요

`stockmon-api`는 TypeScript + Express 기반의 국내 주식 분석 대시보드다. 서버는 분석 API와 정적 프론트엔드를 함께 제공하고, 프론트는 `public/index.html`, `public/app.js`, `public/app.css` 중심의 단일 페이지 앱으로 구성되어 있다.

주요 목적은 다음과 같다.

- 중장기, 배당, 스윙 관점의 추천 후보 관리
- KOSPI/KOSDAQ 전체 유니버스 검색과 후보 자동 분류
- 스마트머니 패턴, 눌림, 돌파, 실행 가능성 점수 분석
- 시장 지수, 환율, 원자재, 비트코인 감시
- 급등락 순위, 실시간 종목 스냅샷, 관심 종목 상세 차트 조회
- 뉴스 시그널, 시장 이벤트 캘린더, Discord 알림 연동

## 2. 실행 환경

핵심 런타임과 라이브러리:

- Node.js ESM 프로젝트 (`"type": "module"`)
- Express 5
- TypeScript 5
- Zod
- Lightweight Charts
- React / React DOM: 뉴스 시그널 대시보드 번들용
- tsx: 개발 서버와 일부 스크립트 실행용

주요 명령어:

```bash
npm install
npm run dev
npm run check
npm run build
npm run start
```

현재 확인한 점:

- `npm run check`는 통과한다.
- `npm run build`는 TypeScript 컴파일 뒤 `scripts/build-news-dashboard.mjs` 단계에서 `react`, `react-dom`, `react/jsx-runtime` 해석 실패가 날 수 있다. 현재 로컬 `node_modules`에 `react`, `react-dom` 폴더가 없는 상태로 확인됐다. `package.json`에는 의존성이 선언되어 있으므로 `npm install`로 의존성을 복구해야 한다.

## 3. 환경 변수

`src/config.ts` 기준으로 사용하는 환경 변수:

```env
PORT=3000

DISCORD_WEBHOOK_URL=

ALERT_WEBHOOK_SECRET=
ALERT_COOLDOWN_MS=600000
ALERT_MIN_CHANGE_PERCENT=7
ALERT_MIN_VOLUME_RATIO=3
ALERT_MIN_TURNOVER_KRW=3000000000
ALERT_REQUIRE_BREAKOUT=false

YAHOO_DEFAULT_MARKET_SUFFIX=.KS

NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

`NAVER_SEARCH_CLIENT_ID`와 `NAVER_SEARCH_CLIENT_SECRET`이 없으면 뉴스 시그널 수집은 외부 검색 호출 없이 동작 제한 또는 실패 상태가 될 수 있다.

## 4. 서버 구조

진입점:

- `src/server.ts`: Express 앱 실행
- `src/app.ts`: 미들웨어, 정적 파일, 라우트, 에러 핸들러 등록

서버 동작:

- `/health` 헬스체크 제공
- `/`에서 `public/index.html` 제공
- `/public` 정적 파일은 UTF-8 헤더로 서빙
- `/vendor/lightweight-charts`로 차트 라이브러리 dist 서빙
- 요청마다 `x-request-id`를 부여하고 로그를 남김
- 앱 시작 시 `initializeNewsSignalCollector()`를 비동기로 실행

라우트:

- `src/routes/analysisRoutes.ts`: 분석, 추천, 시장 데이터, 캘린더, 저장 후보 API
- `src/routes/alertRoutes.ts`: 실시간 급등 알림, 스마트머니 watchlist API

## 5. 프론트엔드 화면

프론트 SPA는 `public/index.html`과 `public/app.js`가 중심이다.

주요 화면:

- `newsView`: 뉴스 시그널 대시보드
- `indexView`: 지수 및 관심 자산, Market Event Calendar
- `analysisView`: 중장기, 배당, 스윙 추천 후보 관리
- `moversView`: 국내 급등락 순위

주요 UI 흐름:

- 추천 후보 탭 전환: 중장기, 배당, 스윙
- 추천 후보 직접 추가 및 서버 저장
- 종목 검색 모달: KRX 유니버스 기반 종목명, 종목코드, 초성 검색
- 추천 검색 버튼: 선택한 카테고리의 전체 유니버스 스캔 실행
- 지수 카드 클릭: 차트 모달 표시
- Market Event Calendar 날짜 클릭: 해당 날짜 이벤트 모달 표시
- `일정 검색` 버튼: 서버의 시장 이벤트 검색 API 호출 후 캘린더 갱신
- 토스트 알림: 저장, 검색 완료, 실패 상태 표시

## 6. 주요 API

기본:

- `GET /health`
- `GET /`

분석:

- `POST /analysis/recommendations`
- `POST /analysis/recommendation-patterns`
- `POST /analysis/smart-money-patterns`
- `GET /analysis/korean-movers`
- `POST /analysis/korean-movers/discord`
- `GET /analysis/stock-universe`
- `POST /analysis/recommendation-universe-scan`

서버 저장 후보:

- `GET /analysis/server-swing-picks`
- `POST /analysis/server-swing-picks`
- `GET /analysis/server-long-term-picks`
- `POST /analysis/server-long-term-picks`
- `GET /analysis/server-dividend-picks`
- `POST /analysis/server-dividend-picks`

시장 데이터:

- `GET /analysis/market-watch`
- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`
- `GET /analysis/news-signals`
- `GET /analysis/market-event-calendar`
- `POST /analysis/market-event-calendar/search`

알림:

- `POST /alerts/price-spike`
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`
- `POST /alerts/smart-money-watchlist/scan`

## 7. 분석 엔진과 서비스

### 추천/패턴 분석

- `src/services/stockAnalysis.ts`: 추천 종목 분석, 추천 패턴 분석, 스마트머니 패턴 분석
- `src/services/smartMoneyEngine.ts`: 급등 후 눌림, 돌파, 소화 구간, 매수 구간, 손절 기준 등 스윙 패턴 핵심 로직
- `src/services/smartMoneyEnhancer.ts`: 스마트머니 결과 보강
- `src/services/smartMoneyBacktest.ts`: 스마트머니 관련 검증/백테스트 보조
- `src/services/swingProfiles.ts`: 스윙 프로필 해석, 기본 프로필과 소형주 프로필 구분

### 유니버스 스캔

- `src/services/stockUniverse.ts`: KRX KIND 회사 목록 기반 KOSPI/KOSDAQ/KONEX 종목 유니버스 생성, 12시간 메모리 캐시 사용
- `src/services/recommendationUniverse.ts`: 중장기, 배당, 스윙 전체 유니버스 검색, 활성 스캔 중복 실행 방지
- `src/services/recommendationUniverseAlerts.ts`: 유니버스 검색 결과 변화 감지 및 알림 기준 저장

### 중장기 엔진

위치: `src/services/longTerm/*`, `src/services/longTermEngine.ts`

주요 평가 축:

- 유동성
- 리더십
- 펀더멘털
- 조정 폭
- 안정화
- 추세
- 시장 데이터 기반 구조

결과는 매수 후보와 관찰 후보로 분류되어 `data/server-long-term-picks.json`에 저장된다.

### 배당 엔진

위치: `src/services/dividend/*`, `src/services/dividendEngine.ts`, `src/services/dividendEtfService.ts`

주요 평가 축:

- 배당 수익률
- 배당 지속성
- 배당 안정성
- 성장성
- 재무 훼손 위험
- 배당 함정 위험

결과는 `data/server-dividend-picks.json`에 저장되는 구조다. 단, `.gitignore`의 `data/*.json` 규칙 때문에 새 데이터 파일은 기본적으로 Git 추적 대상이 아니다.

### 시장 감시

- `src/services/marketWatch.ts`: KOSPI, KOSDAQ, USD/KRW, Gold, WTI, Bitcoin 스냅샷 제공
- `src/services/koreanMovers.ts`: 국내 급등락 순위 조회
- `src/services/realtimeStocks.ts`: 단일/복수 종목 실시간 스냅샷 및 상세 차트 조회
- `src/services/realtimeAlerts.ts`: 급등 조건 평가, 점수화, cooldown 처리

### 뉴스 시그널

- `src/services/newsSignals.ts`: Naver News Search API 기반 뉴스 수집, 회사 사전과 키워드 룰 기반 시그널 산출
- `frontend/newsSignalDashboard.jsx`: 뉴스 시그널 React 화면 원본
- `public/news-signal-dashboard.js`: esbuild 번들 결과물

### Market Event Calendar

- `src/services/marketEventCalendar.ts`: `data/market-event-calendar.json`을 읽어 이벤트와 일별 요약 제공
- `GET /analysis/market-event-calendar`: 현재 파일 기반 캘린더 반환
- `POST /analysis/market-event-calendar/search`: 현재 날짜 기준 기본 시장 이벤트 묶음을 생성/병합하고 JSON 파일에 저장

현재 `일정 검색` 버튼은 프론트에서 `POST /analysis/market-event-calendar/search`를 호출하고, 응답을 즉시 캘린더에 반영한다.

## 8. 데이터 파일

현재 데이터 저장은 DB가 아니라 JSON 파일 중심이다.

주요 파일:

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/server-dividend-picks.json`
- `data/recommendation-universe-alert-state.json`
- `data/market-event-calendar.json`
- `data/smart-money-watchlist.json`

주의:

- `.gitignore`에 `data/*.json`이 포함되어 있어 데이터 파일은 기본적으로 Git에 올라가지 않는다.
- `server-swing-picks.json`은 단순 배열이 아니라 `executionItems`, `watchItems`, `items`를 다루는 payload 구조를 사용한다.
- `market-event-calendar.json`은 `generatedAt`, `timezone`, `events`, `summaries` 구조다.

## 9. 스크립트

`package.json` 기준:

- `npm run dev`: `tsx watch src/server.ts`
- `npm run check`: TypeScript no emit 체크
- `npm run build`: TypeScript 빌드 후 뉴스 대시보드 번들
- `npm run start`: `dist/server.js` 실행
- `npm run refresh:swing-picks`: 저장된 스윙 후보 재분석 및 bucket 갱신
- `npm run scan:swing-universe`: KOSPI/KOSDAQ 전체 스윙 유니버스 스캔
- `npm run scan:dividend-universe`: 배당 유니버스 스캔
- `npm run scan:long-term`: 중장기 리더 스캔
- `npm run scan:long-term-universe`: 중장기 전체 유니버스 스캔

주의:

- `scan:*` 스크립트는 `npm.cmd run build` 후 `dist/scripts/*`를 실행한다.
- 현재 로컬 의존성 상태에서 `npm run build`가 실패하면 `scan:*`도 함께 실패한다.

## 10. 최근 반영 사항

2026-04-27 기준 최근 반영된 Market Event Calendar 변경:

- 달력 상단에 `일정 검색` 버튼 추가
- 버튼 클릭 시 `POST /analysis/market-event-calendar/search` 호출
- 서버에서 캘린더 이벤트를 생성/병합하고 `data/market-event-calendar.json` 저장
- 검색 성공/실패 토스트 표시
- 검색 중 버튼 disabled 및 `검색 중...` 표시

변경 파일:

- `public/app.js`
- `public/app.css`
- `src/routes/analysisRoutes.ts`
- `src/services/marketEventCalendar.ts`

## 11. 현재 리스크와 정리 필요 지점

- 일부 기존 문서와 일부 소스 문자열에 한글 인코딩 깨짐이 있다. 사용자에게 보이는 문구가 깨지는 구간은 별도 정리 대상이다.
- `npm run build`가 React 의존성 해석 실패로 멈출 수 있다. `node_modules` 복구가 먼저 필요하다.
- 데이터 저장소가 JSON 파일 기반이라 동시 쓰기, 장기 이력 관리, 배포 환경 persistence는 약하다.
- Market Event Calendar의 `search`는 현재 외부 공식 캘린더 API 연동이 아니라 내부 seed 이벤트 생성/병합 방식이다.
- Naver/KRX/Yahoo 기반 fetch는 외부 사이트 변경, 인코딩, rate limit, 네트워크 실패에 영향을 받는다.

## 12. 다음 작업 후보

- 깨진 한글 문자열 정리 및 UTF-8 기준 재저장
- React 의존성 복구 후 `npm run build` 정상화
- Market Event Calendar 외부 데이터 공급원 연동
- JSON 저장소를 SQLite나 다른 영속 저장소로 이전
- API별 요청/응답 예시 문서화
- 프론트 화면별 사용 흐름 스크린샷 문서 추가
