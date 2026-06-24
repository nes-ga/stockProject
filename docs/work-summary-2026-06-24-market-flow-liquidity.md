# 2026-06-24 Work Summary

오늘 작업은 시장 흐름 대시보드의 지수 감시 항목과 유동성 비교 UI를 정리하고, 한국/미국 M2와 코스닥을 같은 월 기준으로 비교할 수 있게 만드는 데 집중했다.

## 작업 배경

기존 시장 흐름 대시보드는 글로벌/국내 유동성을 보여주기는 했지만, 국내 유동성은 최신값 중심이라 YoY 변화율을 제대로 비교하기 어려웠다. 사용자가 확인하고 싶었던 핵심은 다음이었다.

- 국내 유동성 기준은 M2여야 한다.
- 미국은 FRED `M2SL`을 사용한다.
- 한국은 한국은행 ECOS API의 월별 M2를 사용한다.
- 두 국가의 M2 YoY를 같은 기간으로 정렬하고 코스닥 흐름과 비교한다.
- UI에서는 차트가 무엇을 의미하는지 축/값/월 기준이 명확해야 한다.

## 지수 감시 항목

시장 감시 지수에 기존 국내 지수와 원자재/환율 외에 아래 항목을 추가했다.

- `NASDAQ100`: 네이버 해외지수 `NAS@NDX`
- `SOX`: 네이버 해외지수 `NAS@SOX`
- `VIX`: Yahoo `^VIX`

관련 파일:

- `src/services/marketWatch.ts`
- `src/types.ts`
- `public/app.js`

## 유동성 데이터 기준

### 미국 M2

- 데이터 소스: FRED `M2SL`
- URL: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL`
- 단위: 십억 달러
- 계산:
  - 3개월 변화율
  - 6개월 변화율
  - 전년동월 대비 YoY

### 한국 M2

한국은행 ECOS 최신 통화/유동성 신지표 기준을 확인했다.

- 통계코드: `161Y006`
- 항목코드: `BBHA00`
- 주기: `M`
- 명칭: `M2 상품별 구성내역(평잔, 원계열)` / `M2(평잔, 원계열)`
- 제공 시작: `2003-10`
- 확인된 최신 월: `2026-04`
- 단위: 십억원

`.env`에 `ECOS_API_KEY`가 없을 때도 화면 검증이 가능하도록 ECOS `sample` API를 10건씩 페이지 처리해서 전체 월별 데이터를 수집하게 했다. 운영에서는 `ECOS_API_KEY`를 넣으면 같은 경로가 정식 API 호출로 동작한다.

관련 설정:

- `ECOS_API_KEY`
- `ECOS_KOREA_M2_STAT_CODE`
- `ECOS_KOREA_M2_ITEM_CODE`
- `ECOS_KOREA_M2_CYCLE`

기본값은 코드 내부에서 다음을 사용한다.

```text
ECOS_KOREA_M2_STAT_CODE=161Y006
ECOS_KOREA_M2_ITEM_CODE=BBHA00
ECOS_KOREA_M2_CYCLE=M
```

## 코스닥 비교

코스닥은 M2와 장기 비교가 필요하므로 Yahoo 월봉 `^KQ11`을 우선 사용하도록 했다.

- 우선 소스: Yahoo chart `^KQ11`, `interval=1mo`, `range=max`
- fallback: 네이버 `fchart.stock.naver.com` 일봉을 월말 종가로 집계
- 계산: 월말 종가 기준 YoY

네이버 일봉만 사용하면 실제 확보 기간이 짧아져 비교 시작점이 2015년대로 밀렸다. Yahoo 월봉을 우선 사용하면서 공통 비교 기간이 `2004-10`부터 확보됐다.

## 정렬 방식

미국 M2, 한국 M2, 코스닥을 모두 월 단위로 정렬한 뒤, 세 데이터가 모두 존재하는 월만 비교에 사용한다.

최종 검증 결과:

- 비교 가능 기간: `2004-10` ~ `2026-04`
- 비교 포인트: `259개월`
- 최신 공통월: `2026-04`

최신 공통월 기준:

```text
미국 M2 YoY: +4.72%
한국 M2 YoY: +5.72%
코스닥 YoY: +46.36%
미국-한국 M2 YoY 격차: -1.00%p
```

각 지표 최신월 기준:

```text
미국 M2 최신월: 2026-05
미국 M2 YoY: +5.58%
미국 M2 3개월: +1.88%
미국 M2 6개월: +3.48%

한국 M2 최신월: 2026-04
한국 M2 YoY: +5.72%
한국 M2 3개월: +1.35%
한국 M2 6개월: +2.56%
```

## UI 변경

시장 흐름 대시보드에 유동성 비교 패널을 추가/정리했다.

현재 유동성 비교 UI 구성:

- 현재 판정 카드
- 미국/한국 M2 비교 표
- `3개월 -> 6개월 -> YoY` 순서의 비교 바
- 같은 월 기준 `M2 YoY · 코스닥 YoY` 비교 스트립
- 최근 12개월 월별 값 표시

표시 순서는 사용자가 요청한 대로 다음 순서로 맞췄다.

```text
3개월 -> 6개월 -> YoY
```

월별 스트립은 각 칸에 월과 값을 직접 표시한다. 예를 들어 `26.04 +5.72%`처럼 보이게 해서 축을 따로 해석하지 않아도 어떤 값인지 알 수 있게 했다.

관련 파일:

- `src/services/liquidityIndicators.ts`
- `src/types.ts`
- `public/app.js`
- `public/app.css`

## 시장 흐름 요약 섹션

하단 `시장 흐름 요약` 섹션은 상단 지표와 내용이 중복되어 화면에서 숨겼다.

처리 방식:

- 데이터 계산은 유지
- 화면 렌더링 블록만 제거
- HTML 주석으로 숨김 이유를 남김

관련 파일:

- `public/app.js`

## 구현 메모

`src/services/liquidityIndicators.ts`에 추가/정리된 주요 로직:

- FRED M2 CSV 파싱
- ECOS M2 월별 데이터 페이지 수집
- ECOS `sample` API fallback
- Yahoo 코스닥 월봉 수집
- 네이버 코스닥 일봉 fallback
- 월별 YoY map 생성
- 미국 M2 / 한국 M2 / 코스닥 YoY 공통월 정렬
- 3개월/6개월/YoY 변화율 계산

`src/types.ts`에 추가된 주요 타입:

- `change6mPct`
- `LiquidityComparisonPoint`
- `MarketLiquiditySnapshot.comparison`

`public/app.js`에 추가/정리된 주요 렌더링:

- `renderLiquidityAlignedComparison`
- `renderLiquidityAlignedMetric`
- `renderLiquidityYoyStripRow`
- 유동성 비교 표/바의 순서 정렬

## 검증

실행한 검증:

```bash
node --check public\app.js
npm.cmd run check
npm.cmd run build
```

결과:

- `public/app.js` 문법 검사 통과
- TypeScript `tsc --noEmit` 통과
- 전체 build 통과

실제 데이터 호출 검증:

```text
liquidity:ready indicators=2 comparisonPoints=259 errors=0
```

## 주의사항

- 한국 M2 신지표 원계열은 `2003-10`부터 제공되므로, YoY 비교는 `2004-10`부터 가능하다.
- `.env`에 `ECOS_API_KEY`가 없으면 ECOS `sample` API를 페이지 단위로 호출한다. 테스트에는 충분하지만 운영 안정성은 정식 키를 넣는 편이 낫다.
- 미국 M2 최신월과 한국 M2 최신월이 항상 같지는 않다. 공통 비교 패널은 세 데이터가 모두 있는 최신 공통월을 기준으로 보여준다.
- 코스닥 비교는 월말 종가 YoY이므로 일중 흐름이나 단기 급등락과는 다르게 해석해야 한다.
