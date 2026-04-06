# BAND Stock Dashboard

TypeScript + Express 기반의 국내 주식 분석 대시보드입니다. 현재 구현은 단순 BAND 게시글 분석 API를 넘어서, 추천 종목 추적, 재무지표 조회, 급등/급락 랭킹, 스윙 패턴 분석, 실시간 알림, 스마트머니 워치리스트까지 포함합니다.

## 현재 구현 범위

### 1. 웹 대시보드

- `지수 및 관심 자산` 탭
  - KOSPI, KOSDAQ 차트
  - 환율/원자재 슬롯 UI
  - 라이트웨이트 차트 기반 인터랙티브 차트
- `BAND 종목 및 분석` 탭
  - 추천 종목 목록 관리
  - 중장기 / 스윙 카테고리 분리
  - 개별 종목 분석 결과 표시
  - 재무지표 패널 표시
  - 스윙 패턴 점수/사유 표시
- `급등 및 급락 순위` 탭
  - KOSPI / KOSDAQ / 전체 시장 필터
  - 상승/하락 종목 랭킹
  - 거래량 배수, 점수 기반 필터

### 2. BAND 연동

- BAND OAuth 설정 여부 확인
- BAND 로그인 URL 생성
- OAuth code -> access token 교환
- 내 BAND 목록 조회
- 특정 BAND 게시글 목록 조회
- 특정 게시글 본문 조회
- 게시글 본문에서 종목 심볼 추출 후 가격/추세 분석

### 3. 추천 종목 분석

- 기준일(anchor date) 이후 수익률 분석
- 최고가/최저가/최대 상승폭/최대 하락폭 계산
- 거래량 배수 계산
- 일봉 차트 데이터 조회
- 국내 6자리 종목 기준 네이버 재무지표 조회
  - 매출액
  - 영업이익
  - 순이익
  - ROE
  - 부채비율
  - EPS / BPS / PER / PBR

### 4. 스윙 / 스마트머니 패턴 분석

- 추천 종목용 기본 패턴 분석
- 스마트머니 패턴 분석 API
- 패턴 단계 분류
  - `watch`
  - `setup`
  - `breakout`
- actionable 판정
- 점수 기반 정렬 및 Discord 전송 옵션
- 서버 보관용 스윙 후보 목록 조회/저장
- 전체 종목 유니버스 스캔 스크립트
- 저장된 스윙 후보 재평가 스크립트

### 5. 급등/급락 탐지

- 한국 시장 급등주/급락주 스캔 API
- 거래량/등락률/점수 기준 필터
- Discord 전송 엔드포인트

### 6. 실시간 알림 / 워치리스트

- 실시간 급등 이벤트 평가 API
- 중복/쿨다운 처리
- Discord 웹훅 발송
- 스마트머니 워치리스트 CRUD
- 워치리스트 일괄 스캔
- 최근 스캔 시각 / 최근 매치 breakout 날짜 저장

## 기술 스택

- Node.js
- TypeScript
- Express
- Zod
- Lightweight Charts
- 파일 기반 저장소
  - `data/server-swing-picks.json`
  - `data/smart-money-watchlist.json`

## 실행 방법

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만들고 필요 값만 채워서 사용합니다.

```env
PORT=3000

# BAND OAuth
BAND_CLIENT_ID=
BAND_CLIENT_SECRET=
BAND_REDIRECT_URI=http://localhost:3000/auth/band/callback
BAND_STATE=band-stock-api-state

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

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 주소는 `http://localhost:3000` 입니다.

### 4. 프로덕션 빌드 / 실행

```bash
npm run build
npm run start
```

## 스크립트

### 개발/검증

```bash
npm run dev
npm run build
npm run check
```

### 스윙 후보 관리

```bash
npm run refresh:swing-picks
npm run scan:swing-universe
```

- `refresh:swing-picks`
  - 기존 저장된 서버 스윙 후보를 다시 분석해 유지/제거합니다.
- `scan:swing-universe`
  - 국내 유니버스를 다시 스캔해 스윙 후보를 생성합니다.

## 주요 API

### 기본

- `GET /health`
- `GET /`

### BAND 인증 / 조회

- `GET /auth/band/config`
- `GET /auth/band/url`
- `POST /auth/band/token`
- `GET /auth/band/callback`
- `GET /band/bands?accessToken=...`
- `GET /band/posts?accessToken=...&bandKey=...&limit=15`
- `GET /band/post?accessToken=...&bandKey=...&postKey=...`

### 분석

- `POST /analysis/from-post`
  - BAND 게시글 또는 임의 텍스트에서 종목 심볼을 추출해 분석
- `POST /analysis/recommendations`
  - 추천 종목 배치 분석
- `POST /analysis/recommendation-patterns`
  - 추천 종목용 기본 패턴 분석
- `POST /analysis/smart-money-patterns`
  - 스마트머니 패턴 분석
- `GET /analysis/korean-movers`
  - 급등/급락 랭킹 조회
- `POST /analysis/korean-movers/discord`
  - 급등/급락 결과 Discord 발송
- `GET /analysis/stock-universe`
  - 국내 종목 유니버스 조회/갱신
- `GET /analysis/market-watch`
  - 지수/시장 감시 데이터 조회
- `GET /analysis/server-swing-picks`
  - 저장된 서버 스윙 후보 조회
- `POST /analysis/server-swing-picks`
  - 서버 스윙 후보 저장

### 알림 / 워치리스트

- `POST /alerts/price-spike`
  - 실시간 급등 이벤트 평가 및 Discord 발송
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`
- `POST /alerts/smart-money-watchlist/scan`

## 요청 예시

### 추천 종목 분석

```http
POST /analysis/recommendations
Content-Type: application/json

{
  "items": [
    {
      "name": "엔씨소프트",
      "symbol": "036570",
      "anchorDate": "2026-03-22",
      "note": "215000원 이하 1차매수"
    },
    {
      "name": "포스코DX",
      "symbol": "022100",
      "anchorDate": "2026-03-12",
      "latestMentionDate": "2026-03-12",
      "note": "31550원 이하 1차매수"
    }
  ]
}
```

### 게시글 텍스트 분석

```http
POST /analysis/from-post
Content-Type: application/json

{
  "postText": "오늘은 엔씨소프트와 삼성전자를 체크합니다."
}
```

### 스마트머니 워치리스트 저장

```http
POST /alerts/smart-money-watchlist
Content-Type: application/json

{
  "items": [
    {
      "symbol": "036570",
      "name": "엔씨소프트",
      "note": "게임 섹터 체크"
    }
  ]
}
```

## 참고

- 국내 6자리 종목 코드는 네이버 금융/국내 데이터 소스를 우선 사용합니다.
- 해외 심볼은 Yahoo Finance 기반으로 가격/차트 분석을 수행합니다.
- BAND OAuth 관련 환경 변수가 없으면 BAND 기능은 설정 필요 상태로 동작합니다.
- 저장소는 현재 DB가 아니라 JSON 파일 기반입니다.
