# Naver Index Intraday Investigation - 2026-06-02

## 목적

KOSPI/KOSDAQ 지수의 급락/급등 후 안정화 판단을 위해 Naver 기반 분봉 또는 30분봉 데이터를 사용할 수 있는지 확인했습니다.

현재 프로젝트의 지수 일봉은 `src/services/marketWatch.ts`에서 Naver `fchart.stock.naver.com/sise.nhn`를 통해 가져옵니다.

## 현재 코드의 지수 일봉 경로

파일:

- `src/services/marketWatch.ts`

현재 KOSPI/KOSDAQ 정의:

- KOSPI: `source: "naver"`, `naverSymbol: "KOSPI"`
- KOSDAQ: `source: "naver"`, `naverSymbol: "KOSDAQ"`

현재 요청:

```text
https://fchart.stock.naver.com/sise.nhn?symbol=KOSPI&timeframe=day&count=5200&requestType=0
https://fchart.stock.naver.com/sise.nhn?symbol=KOSDAQ&timeframe=day&count=5200&requestType=0
```

해석:

- `count=5200` 일봉을 가져옵니다.
- 대략 20년치 일봉 수준입니다.
- 완전 전체 히스토리는 아닙니다.
- 화면의 지수 daily/weekly/yearly chart는 이 일봉을 기반으로 합니다.
- weekly/yearly는 코드에서 집계합니다.

## 확인한 Naver 경로

### 1. `fchart.stock.naver.com/sise.nhn`

일봉:

```text
https://fchart.stock.naver.com/sise.nhn?symbol=KOSPI&timeframe=day&count=3&requestType=0
https://fchart.stock.naver.com/sise.nhn?symbol=KOSDAQ&timeframe=day&count=3&requestType=0
```

결과:

- KOSPI/KOSDAQ 모두 정상 응답
- XML `<item data="YYYYMMDD|open|high|low|close|volume" />` 형태

분봉 시도:

```text
https://fchart.stock.naver.com/sise.nhn?symbol=KOSPI&timeframe=minute&count=3&requestType=0
https://fchart.stock.naver.com/sise.nhn?symbol=KOSDAQ&timeframe=minute&count=3&requestType=0
```

결과:

- 빈 `<protocol />` 응답

30분봉 시도:

```text
https://fchart.stock.naver.com/sise.nhn?symbol=KOSPI&timeframe=30&count=3&requestType=0
```

결과:

- `Validation Failed`

판단:

- 현재 프로젝트가 쓰는 `fchart.stock.naver.com/sise.nhn` 경로로는 KOSPI/KOSDAQ 지수 분봉을 바로 가져올 수 없었습니다.

### 2. `api.finance.naver.com/siseJson.naver`

일봉:

```text
https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=20260601&endTime=20260602&timeframe=day
https://api.finance.naver.com/siseJson.naver?symbol=KOSDAQ&requestType=1&startTime=20260601&endTime=20260602&timeframe=day
```

결과:

- KOSPI/KOSDAQ 지수 일봉 정상 응답

분봉:

```text
https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=20260601&endTime=20260602&timeframe=minute
https://api.finance.naver.com/siseJson.naver?symbol=KOSDAQ&requestType=1&startTime=20260601&endTime=20260602&timeframe=minute
```

결과:

- 헤더만 오고 데이터 row 없음

비교 확인:

```text
https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=1&startTime=20260601&endTime=20260602&timeframe=minute
```

결과:

- 삼성전자 같은 개별 종목은 minute 데이터 응답

판단:

- `siseJson.naver`는 개별 종목 분봉은 주지만, KOSPI/KOSDAQ 지수 분봉은 같은 방식으로 내려주지 않았습니다.

### 3. `api.stock.naver.com/chart/domestic`

일봉:

```text
https://api.stock.naver.com/chart/domestic/index/KOSPI?periodType=dayCandle
https://api.stock.naver.com/chart/domestic/index/KOSDAQ?periodType=dayCandle
```

결과:

- KOSPI/KOSDAQ 지수 일봉 정상 응답
- JSON `priceInfos` 배열 형태

분봉 시도:

```text
https://api.stock.naver.com/chart/domestic/index/KOSPI?periodType=minuteCandle
https://api.stock.naver.com/chart/domestic/index/KOSDAQ?periodType=minuteCandle
```

결과:

```json
{"code":"MethodArgumentTypeMismatch","message":"BAD REQUEST !!!"}
```

판단:

- `periodType=minuteCandle` 이름은 이 endpoint에서 허용되지 않았습니다.
- 분봉용 periodType 이름이 다르거나, 별도 endpoint일 가능성이 있습니다.

### 4. Naver 모바일 지수 페이지

확인 경로:

```text
https://m.stock.naver.com/domestic/index/KOSPI/total
```

확인된 점:

- 페이지의 서버 데이터에 `scriptChartTypes`가 포함되어 있습니다.
- KOSPI 페이지 데이터에서 다음 항목이 확인됐습니다.

```text
scriptChartTypes:
- candleMinuteFive
- candleDay
- candleWeek
- candleMonth
- day
- areaMonthThree
- areaYear
- areaYearThree
- areaYearTen
```

판단:

- Naver 모바일 지수 화면에는 적어도 `candleMinuteFive` 지수 차트 타입이 존재합니다.
- 즉 Naver 쪽에 지수 분봉성 차트가 존재할 가능성은 높습니다.
- 다만 현재까지 확인한 공개성 API 호출에서는 이 데이터를 직접 내려주는 최종 endpoint를 아직 찾지 못했습니다.

### 5. Naver 모바일 fchart 페이지

확인 경로:

```text
https://m.stock.naver.com/fchart/domestic/index/KOSPI
```

확인된 점:

- ChartIQ 페이지가 로드됩니다.
- 페이지는 다음 이벤트를 발생시켜 차트 번들에 지수 정보를 넘깁니다.

```text
symbol: KOSPI
chartNationType: domestic
chartInfoType: index
stockEndType: index
endUrl: https://m.stock.naver.com/domestic/index/KOSPI
```

- 실제 데이터 호출 로직은 외부 번들에 있습니다.

```text
https://financial-vn.pstatic.net/client-chart/mobile/live/20260521-ae37cee/js/chartiq.js
```

진행 상태:

- 번들 크기는 약 1.6MB입니다.
- `api.stock.naver.com`, `periodType`, `candleMinuteFive` 등 문자열 탐색을 시작했으나 시간이 부족해 최종 endpoint 확인 전 중단했습니다.

## 현재 결론

현재까지 확인한 바로는 다음과 같습니다.

- 기존 `fchart.stock.naver.com/sise.nhn` 경로는 KOSPI/KOSDAQ 일봉만 확인됐고, 지수 분봉은 빈 응답 또는 validation 실패입니다.
- `api.finance.naver.com/siseJson.naver`는 개별 종목 분봉은 주지만, KOSPI/KOSDAQ 지수 분봉은 데이터 row를 주지 않았습니다.
- `api.stock.naver.com/chart/domestic/index/...`는 지수 일봉은 주지만, `periodType=minuteCandle`은 실패했습니다.
- Naver 모바일 지수 페이지에는 `candleMinuteFive` 차트 타입이 있으므로, Naver 내부에는 지수 분봉성 차트가 존재합니다.
- 남은 작업은 ChartIQ 번들에서 실제 호출 endpoint와 period parameter를 찾는 것입니다.

## 다음 조사 TODO

1. `chartiq.js` 번들에서 API endpoint 문자열을 좁혀 찾습니다.
2. `candleMinuteFive`가 실제 어떤 request payload/URL로 변환되는지 확인합니다.
3. KOSPI와 KOSDAQ 모두 같은 endpoint로 응답하는지 확인합니다.
4. 응답이 5분봉이면 30분봉은 서버에서 직접 받기보다 5분봉 6개를 집계하는 방식이 현실적입니다.
5. Naver-only 정책을 유지한다면 Yahoo 등 외부 대안은 조사 대상에서 제외합니다.

## 구현 방향 메모

지수 안정화 판단에는 20년치 일봉보다 최근 장중 흐름이 중요합니다.

권장 분리:

- 장기/중기 시장 상태: Naver 일봉 `1200~5200개`
- 일봉 시장충격 판단: 최근 `20~60거래일`
- 급락/급등 후 안정화: Naver 지수 5분봉을 찾으면 30분봉으로 집계

30분봉 안정화에서 볼 수 있는 항목:

- 급락 후 저점 대비 회복률
- 30분봉 higher low 여부
- 30분봉 20봉 평균 회복 여부
- 급락봉 이후 변동폭 축소 여부
- KOSPI/KOSDAQ 동시 회복 여부
- 장중 반등이 종가 근처까지 유지되는지 여부
