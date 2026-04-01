# BAND Stock Analysis API

BAND 게시글을 가져와서 종목 코드를 추출하고, 간단한 차트 지표를 계산해 주는 TypeScript API입니다.

## 준비

1. `BAND Developers`에서 앱을 만들고 OAuth 정보를 준비합니다.
2. `.env.example`을 복사해 `.env`를 만듭니다.
3. 패키지를 설치합니다.

```bash
npm install
```

## 실행

```bash
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 브라우저에서 열면 추천일 기준 분석 화면이 보입니다.

## 주요 엔드포인트

### 1. BAND OAuth URL 만들기

```http
GET /auth/band/url
```

### 2. OAuth code를 access token으로 교환

```http
GET /auth/band/callback?code=...&state=...
```

### 3. 내가 접근 가능한 밴드 목록 조회

```http
GET /band/bands?accessToken=...
```

### 4. 밴드 게시글 목록 조회

```http
GET /band/posts?accessToken=...&bandKey=...&limit=10
```

### 5. 특정 게시글 기반 차트 분석

```http
POST /analysis/from-post
Content-Type: application/json

{
  "accessToken": "band access token",
  "bandKey": "band key",
  "postKey": "optional post key"
}
```

### 6. 추천일 기준 차트/거래량 분석

```http
POST /analysis/recommendations
Content-Type: application/json

{
  "items": [
    {
      "name": "엔씨소프트",
      "symbol": "036570",
      "anchorDate": "2024-03-22",
      "note": "215000원 이하 1차매수"
    },
    {
      "name": "포스코DX",
      "symbol": "022100",
      "anchorDate": "2024-03-02",
      "latestMentionDate": "2024-03-12",
      "note": "초기 추천일 기준"
    }
  ]
}
```

이 엔드포인트는 추천일 이후 기준으로 아래 데이터를 내려줍니다.

- 추천일 이후 실제 첫 거래일
- 추천일 종가와 현재 종가
- 추천일 대비 현재 수익률
- 추천 이후 최고 종가, 최저 종가, 최대 상승률, 최대 낙폭
- 추천일 거래량, 추천 전 20거래일 평균 거래량, 최신 거래량 배수
- 차트 렌더링용 일봉 배열

또는 게시글 텍스트를 바로 넘길 수도 있습니다.

```http
POST /analysis/from-post
Content-Type: application/json

{
  "postText": "오늘은 AAPL 과 TSLA 를 봅니다"
}
```

## 응답 예시

```json
{
  "post": {
    "postKey": "12345",
    "content": "오늘은 AAPL 과 TSLA 를 봅니다"
  },
  "symbols": ["AAPL", "TSLA"],
  "analyses": [
    {
      "symbol": "AAPL",
      "price": 201.12,
      "changePercent20d": 3.4,
      "sma5": 199.8,
      "sma20": 194.2,
      "rsi14": 58.2,
      "trend": "bullish",
      "summary": "단기 평균이 중기 평균보다 높고 RSI가 과열 구간은 아닙니다."
    }
  ]
}
```

## 참고

- 미국 티커는 그대로 사용합니다. 예: `AAPL`, `TSLA`
- 숫자 6자리 한국 종목 코드는 기본적으로 `.KS`를 붙여 시도합니다. 예: `005930 -> 005930.KS`
- 한국 종목이 코스닥인 경우 `.KQ`가 필요할 수 있어 추가 매핑 로직을 붙이는 것이 좋습니다.
