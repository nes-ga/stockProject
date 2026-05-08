# 프로젝트 개요

최종 정리일: 2026-05-08

## 목적

StockMon Dashboard는 국내 주식 후보를 스윙, 중장기, 배당 관점으로 나누어 분석하고, 시장 흐름/뉴스/이벤트/알림을 함께 제공하는 로컬 대시보드입니다.

핵심 목표:

- 종목 후보를 저장하고 재분석한다.
- KOSPI/KOSDAQ universe를 스캔해 후보를 자동 분류한다.
- 스윙은 실행 가능성, 추격 위험, 눌림 품질을 본다.
- 중장기는 구조적 우위, 조정 후 안정화, 재무, 장기 매물대를 본다.
- 배당은 수익률보다 지속성과 함정 위험을 함께 본다.
- 시장 국면과 테마 흐름을 후보 해석에 보조로 사용한다.

## 실행 환경

- Node.js ESM
- Express 5
- TypeScript 5
- Zod
- Lightweight Charts
- React 19: 뉴스 시그널 대시보드 번들용
- tsx: 개발 서버와 스크립트 실행용

주요 명령:

```bash
npm run dev
npm run check
npm run build
npm run start
```

## 서버 구조

- `src/server.ts`: 서버 실행 진입점
- `src/app.ts`: Express app, middleware, static serving, route mount
- `src/routes/analysisRoutes.ts`: 분석/시장/후보 API
- `src/routes/alertRoutes.ts`: 알림/watchlist API
- `src/routes/marketFlowRoutes.ts`: 시장 흐름 API
- `src/config.ts`: 환경 변수와 기본 설정
- `src/lib/logger.ts`: 구조화 로깅
- `src/lib/http.ts`: fetch/readJson 유틸
- `src/lib/dates.ts`: 날짜/서울 시간 유틸

## 프론트엔드 구조

- `public/index.html`: 단일 페이지 shell
- `public/app.js`: 주요 대시보드 UI 로직
- `public/app.css`: 스타일
- `frontend/newsSignalDashboard.jsx`: 뉴스 시그널 React 원본
- `scripts/build-news-dashboard.mjs`: React 번들 생성

주요 UI:

- 추천 종목/카테고리 탭
- 스윙 패턴/매물대 패널
- 중장기 리뷰/매물대 패널
- 시장 감시 차트
- 시장 흐름/테마 로테이션
- 이벤트 캘린더
- 뉴스 시그널
- 급등/급락 리스트

## 엔진 지도

### 추천/공통 분석

- `src/services/stockAnalysis.ts`
  - 추천 종목 분석
  - 실시간 종목 상세
  - 스윙/중장기 분석 결과 JSON 조립
  - `volumeProfileAnalysis` summary 생성

### 스윙 스마트머니

- `src/services/smartMoneyEngine.ts`
  - setup/breakout 후보 평가
  - 실행 bucket과 점수 산출
  - 매물대 risk adjustment 반영
- `src/services/smartMoney/config.ts`
  - threshold와 기본 필터
- `src/services/smartMoney/marketContext.ts`
  - KOSPI/KOSDAQ, 환율, 금 가격 기반 시장 context
- `src/services/recommendationUniverse.ts`
  - universe scan과 bucket 저장

### 매물대 분석

- `src/services/volumeProfile.ts`
  - 공통 volume profile 계산
  - 스윙용 60/120일 해석
  - 중장기용 240/480/720일 해석
  - ATR bin, time decay, body distribution, distance weighting, retest, reward/risk, POC, Value Area, reliability

### 중장기

- `src/services/longTermEngine.ts`
- `src/services/longTerm/strategy.ts`
- `src/services/longTerm/config.ts`
- `src/services/longTerm/leaderScore.ts`
- `src/services/longTerm/correctionScore.ts`
- `src/services/longTerm/trendScore.ts`
- `src/services/longTerm/liquidityScore.ts`
- `src/services/longTerm/stabilizationScore.ts`
- `src/services/longTerm/fundamentalScore.ts`

### 배당

- `src/services/dividendEngine.ts`
- `src/services/dividend/strategy.ts`
- `src/services/dividend/config.ts`
- `src/services/dividendEtfService.ts`

### 시장/뉴스/이벤트

- `src/services/marketWatch.ts`
- `src/services/marketFlowEngine.ts`
- `src/services/marketFlowStorage.ts`
- `src/services/themeRotationEngine.ts`
- `src/services/marketEventCalendar.ts`
- `src/services/newsSignals.ts`
- `src/services/koreanMovers.ts`
- `src/services/realtimeStocks.ts`
- `src/services/realtimeAlerts.ts`

## API 그룹

분석:

- `POST /analysis/recommendations`
- `POST /analysis/recommendation-patterns`
- `POST /analysis/smart-money-patterns`
- `GET /analysis/korean-movers`
- `POST /analysis/korean-movers/discord`
- `GET /analysis/stock-universe`
- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`

후보 저장:

- `GET /analysis/server-swing-picks`
- `POST /analysis/server-swing-picks`
- `GET /analysis/server-long-term-picks`
- `POST /analysis/server-long-term-picks`
- `GET /analysis/server-dividend-picks`
- `POST /analysis/server-dividend-picks`

Universe scan:

- `POST /analysis/recommendation-universe-scan`
- `GET /analysis/recommendation-universe-scan/status`

시장:

- `GET /analysis/market-watch`
- `GET /analysis/market-flow`
- `GET /analysis/market-flow/latest`
- `GET /analysis/market-flow/history`
- `GET /analysis/market-flow/themes/history`
- `POST /analysis/market-flow/refresh`
- `GET /analysis/market-event-calendar`
- `POST /analysis/market-event-calendar/search`
- `GET /analysis/news-signals`

알림:

- `POST /alerts/price-spike`
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`
- `POST /alerts/smart-money-watchlist/scan`

## 데이터 파일

현재 저장소는 JSON 파일 중심입니다.

- 스윙 후보: `data/server-swing-picks.json`
- 소형주 스윙 후보: `data/server-smallcap-swing-picks.json`
- 중장기 후보: `data/server-long-term-picks.json`
- 배당 후보: `data/server-dividend-picks.json`
- watchlist: `data/smart-money-watchlist.json`
- 이벤트 캘린더: `data/market-event-calendar.json`
- universe alert 상태: `data/recommendation-universe-alert-state.json`
- 시장 흐름: `data/market-flow/*.json`

## 최근 구조적 변경

- 차트 공휴일/비거래일 공백을 줄이기 위해 임의 weekday whitespace 채우기를 제거했습니다.
- 매물대 분석 모듈을 독립화하고 스윙/중장기 엔진에 별도 해석으로 연결했습니다.
- 스윙 매물대는 BUY 승격이 아니라 추격 위험과 리스크 해석 중심으로 보수화했습니다.
- 중장기 매물대는 장기 바닥권 누적, 박스권 돌파, 보유 품질 판단에 사용합니다.
- `volumeProfileAnalysis`와 각 엔진별 상세 `advancedVolumeProfile` JSON을 추가했습니다.

## 알려진 한계

- 외부 데이터 수집은 Naver, KRX, Yahoo 응답 품질에 의존합니다.
- 뉴스 시그널은 기사 본문 전체를 저장하지 않고 검색 API 메타데이터 중심으로 동작합니다.
- 이벤트 캘린더는 아직 JSON 기반 seed/search 구조입니다.
- JSON 파일 저장소는 DB보다 동시성/배포 persistence가 약합니다.
- 매물대 분석은 일봉 OHLCV 기반 근사치이며 호가/분봉 체결 분포를 사용하지 않습니다.
