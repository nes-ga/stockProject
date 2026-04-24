# stockMon Dashboard

TypeScript + Express 기반의 국내 주식 분석 대시보드입니다.
현재 저장소는 추천 종목 추적, 스마트머니/스윙 엔진, 장기 엔진, 급등/급락 탐지, 시장 감시, 실시간 알림 기능을 중심으로 구성되어 있습니다.

## 문서 안내

- [문서 인덱스](./docs/README.md)
- [현재 구현된 기능 정리](./docs/current-implemented-features.md)
- [작업 요약 2026-04-13](./docs/work-summary-2026-04-13.md)
- [스마트머니 유지보수 가이드](./docs/smart-money-maintenance.md)
- [장기 엔진 설계 문서](./docs/long-term-engine-design.md)

## 핵심 기능

- 추천 종목 기준일 이후 성과 분석
- 네이버 금융 기반 재무지표 및 사업 포트폴리오 추정
- 스마트머니 셋업/돌파 분석
- 실행형 서버 스윙 픽 저장 및 재평가
- 장기 대표주 리뷰 및 스캔
- 국내 급등/급락 스캔
- 실시간 급등 알림 및 Discord 발송
- 시장 감시 보드
- 실시간 종목 스냅샷/상세 조회
- 스마트머니 워치리스트 CRUD 및 일괄 스캔

## 빠른 시작

### 설치

```bash
npm install
```

### 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 필요한 값만 채워서 사용합니다.

```env
PORT=3000

# Discord
DISCORD_WEBHOOK_URL=

# Alert
ALERT_WEBHOOK_SECRET=
ALERT_COOLDOWN_MS=600000
ALERT_MIN_CHANGE_PERCENT=7
ALERT_MIN_VOLUME_RATIO=3
ALERT_MIN_TURNOVER_KRW=3000000000
ALERT_REQUIRE_BREAKOUT=false

# Market symbol default
YAHOO_DEFAULT_MARKET_SUFFIX=.KS
```

### 개발 실행

```bash
npm run dev
```

기본 주소는 `http://localhost:3000` 입니다.

### 빌드 / 실행

```bash
npm run build
npm run start
```

## 주요 스크립트

```bash
npm run dev
npm run build
npm run check
npm run refresh:swing-picks
npm run scan:swing-universe
npm run scan:long-term
npm run scan:long-term-universe
```

- `refresh:swing-picks`: 저장된 서버 스윙 후보를 다시 평가하고 `matched` 결과를 `execution/watch` 버킷 구조로 다시 저장합니다.
- `scan:swing-universe`: KOSPI/KOSDAQ 전체를 다시 스캔하고 `actionable`은 `executionItems`, watch 후보는 `watchItems`로 저장합니다.
- `scan:long-term`: 장기 엔진 기준으로 큐레이션 대표주를 평가합니다.
- `scan:long-term-universe`: 장기 엔진 기준으로 유니버스 스캔 결과를 생성합니다.

## 주요 API

### 기본

- `GET /health`
- `GET /`

### 분석

- `POST /analysis/recommendations`
- `POST /analysis/recommendation-patterns`
- `POST /analysis/smart-money-patterns`
- `GET /analysis/korean-movers`
- `POST /analysis/korean-movers/discord`
- `GET /analysis/stock-universe`
- `GET /analysis/market-watch`
- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`
- `GET /analysis/server-swing-picks`
- `POST /analysis/server-swing-picks`
- `GET /analysis/server-long-term-picks`
- `POST /analysis/server-long-term-picks`
- `GET /analysis/news-signals`

### 알림 / 워치리스트

- `POST /alerts/price-spike`
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`
- `POST /alerts/smart-money-watchlist/scan`

## 저장 방식

현재 저장소는 DB가 아니라 JSON 파일 기반입니다.

- `data/server-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/smart-money-watchlist.json`

`data/server-swing-picks.json` 는 단일 배열이 아니라 `executionItems` 와 `watchItems` 를 함께 저장하는 구조입니다.

## 참고

- 국내 6자리 종목 코드는 네이버 금융/국내 데이터 소스를 우선 사용합니다.
- 해외 심볼은 Yahoo Finance 기반으로 가격/차트 분석을 수행합니다.
- 뉴스 시그널은 현재 mock seed 기반으로 동작합니다.
