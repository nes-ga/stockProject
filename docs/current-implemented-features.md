# 현재 구현된 기능 정리

이 문서는 `2026-04-10` 기준으로 현재 저장소에 실제 구현되어 있는 기능만 정리한 문서다.

## 1. 서버 / 기본 구조

- `Express + TypeScript` 서버 구성
- 정적 프론트엔드 서빙
  - `public/index.html`
  - `public/app.js`
  - `public/app.css`
- 공통 기능
  - `GET /health`
  - 요청별 `x-request-id` 발급
  - 요청 시작/종료/오류 로깅
  - 전역 예외 처리
- 앱 시작 시 뉴스 시그널 수집기 초기화

## 2. 현재 프론트엔드에서 보이는 기능

- 추천 종목 분석 화면
  - 추천 목록 관리
  - 장기/스윙 카테고리 구분
  - 분석 결과 카드 렌더링
  - 가격/거래량 차트 표시
  - 재무지표 및 사업 포트폴리오 맵 표시
- 시장 감시 화면
  - KOSPI / KOSDAQ / USDKRW / GOLD / WTI 스냅샷 카드
  - 시장 이벤트 캘린더 보드
  - 일봉 / 주봉 / 연봉 차트 팝업
  - 날짜 클릭 시 이벤트 상세 팝업
- 급등/급락 화면
  - 시장, 개수, 최소 등락률, 최소 거래량 배수, 최소 점수 필터
  - 상승/하락 종목 리스트
- 뉴스 시그널 화면
  - 뉴스 카드 및 섹터 요약 보드
  - 기사 원문 링크 이동

## 3. 추천 종목 분석 기능

### 3-1. 추천 배치 분석

- `POST /analysis/recommendations`
- 입력 항목
  - 종목명
  - 심볼
  - 기준일 `anchorDate`
  - 최근 언급일
  - 메모
  - 카테고리
- 출력 분석 항목
  - 기준일 이후 수익률
  - 기준일 이후 최대 상승률
  - 기준일 이후 최대 낙폭
  - 최고가/최저가 일자와 가격
  - 기준봉 거래량
  - 기준일 전/후 20일 평균 거래량
  - 최신 거래량과 20일 평균 거래량 대비 배수
  - 차트 윈도우
  - 재무 데이터
  - 장기 엔진 리뷰 결과

### 3-2. 재무 데이터 수집

국내 6자리 종목에 대해 네이버 금융에서 아래 기능이 구현되어 있다.

- 최근 연간 재무 지표 파싱
- 최근 분기 재무 지표 파싱
- 추정 분기(E) 데이터 분리
- 주요 항목
  - 매출액
  - 영업이익
  - 순이익
  - ROE
  - 부채비율
  - EPS
  - BPS
  - PER
  - PBR
- 기업개요 문장 추출
- 기업개요 키워드 기반 사업영역 비중 추정
- 프론트에서 사업 포트폴리오 맵 렌더링

## 4. 추천 패턴 엔진

### 4-1. 추천 전 모멘텀 패턴 분석

- `POST /analysis/recommendation-patterns`
- 추천일 직전 구간에서 강한 모멘텀 신호가 있었는지 점검하는 엔진

현재 체크하는 핵심 조건

- 지정 lookback 구간 내 강한 상승일 존재 여부
- 1일 가격 상승률
- 20일 평균 대비 거래량 배수
- 10일/20일 종가 돌파 여부
- 고가 부근 종가 마감 여부
- 점수화 후 신호 등급 부여
  - `watch`
  - `strong`
  - `explosive`

부가 기능

- Discord 메시지 생성/발송 지원
- `onlyMatched` 옵션 지원

## 5. 스마트 머니 엔진

### 5-1. API

- `POST /analysis/smart-money-patterns`
- `POST /alerts/smart-money-watchlist/scan`

### 5-2. 현재 엔진이 찾는 패턴

- 선행 수급일 탐지
  - 가격 급등
  - 거래량 급증
  - 거래대금 기준 충족
- 눌림 구간 평가
  - 눌림 일수
  - 눌림 최대 낙폭
  - 눌림 구간 변동폭
  - 거래량 수축
  - 하락 캔들 수
- 셋업 타입 구분
  - `tight_price_pullback`
  - `time_correction`
  - `volatile_power_digestion`
- 재돌파 평가
  - 돌파일 상승률
  - 돌파일 거래량/거래대금
  - 신고가 돌파 여부
  - 고가 근처 마감 여부

### 5-3. 엔진 결과 상태

- `matched`
  - 패턴 점수가 기준 이상
- `actionable`
  - 현재 시점에 실제 매매 가능한 상태
- `stage`
  - `none`
  - `setup`
  - `breakout`
- `status`
  - 예: `buy_ready`, `breakout_ready`, `breakout_confirmed`, `breakout_extended`

### 5-4. 매매 계획 계산

- 진입 구간
- staged buy plan
  - 1차 매수
  - 2차 매수
  - 3차 매수
  - 손절가
- 손절 기준 가격 및 손절 기준 일자
- breakout 재진입 구간
- 추격 금지 상태 계산

### 5-5. 시장 컨텍스트 반영

자동 시장 컨텍스트를 붙일 수 있게 구현되어 있다.

- 시장 추세
- breadth
- momentum condition
- regime score
- benchmark 상태
- sector strength
- risk-off 여부

이 값으로 아래 항목이 조정된다.

- setup/breakout 최소 기준점
- actionable 허용 여부
- 진입가 보수 조정
- 최종 점수 보정

### 5-6. 백테스트 값 계산

- 5/10/20일 forward return
- 최대 run-up
- 최대 drawdown
- breakout 성공 여부
- stop-loss hit 여부

### 5-7. 디버그 모드

- 상위 후보군 목록
- reject reason 목록
- 평가 윈도우 수
- 후보 개수 / 탈락 개수
- 선택 정책 메타데이터

## 6. 스마트 머니 감시목록 기능

### 6-1. CRUD

- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`

### 6-2. 저장 방식

- 파일: `data/smart-money-watchlist.json`
- 저장 항목
  - symbol
  - name
  - note
  - enabled
  - createdAt
  - updatedAt
  - lastScannedAt
  - lastMatchedBreakoutDate

### 6-3. 스캔 기능

- `POST /alerts/smart-money-watchlist/scan`
- enabled 항목만 스캔
- 스캔 결과를 watchlist 파일에 반영
- Discord 발송 가능
- `onlyActionable` 옵션 지원

## 7. 서버 스윙 픽 기능

### 7-1. API

- `GET /analysis/server-swing-picks`
- `POST /analysis/server-swing-picks`

### 7-2. 저장 방식

- 파일: `data/server-swing-picks.json`
- 저장 항목
  - key
  - name
  - symbol
  - anchorDate
  - latestMentionDate
  - note
  - category=`swing`

### 7-3. 운영 스크립트

- `npm run refresh:swing-picks`
  - 기존 저장 종목을 다시 스마트 머니 엔진으로 재평가
- `npm run scan:swing-universe`
  - KOSPI/KOSDAQ 유니버스 전체를 스캔
  - `pattern.actionable === true` 인 종목은 `executionItems` 에 저장
  - `matched === true` 인 watch 후보는 `watchItems` 에 저장

## 8. 장기 엔진

### 8-1. 목적

장기 엔진은 대표주가 충분한 조정을 거친 뒤 다시 볼 가치가 있는지 평가하는 구조다.

### 8-2. 현재 구현 범위

- 엔진 파일: `src/services/longTermEngine.ts`
- 단일 종목 리뷰: `analyzeLongTermCandidate`
- 큐레이션 유니버스 스캔: `scanLongTermLeaders`
- 스크립트
  - `npm run scan:long-term`
  - `npm run scan:long-term-universe`

### 8-3. 현재 평가 방식

아래 점수를 계산한다.

- `leaderScore`
- `correctionScore`
- `trendScore`
- `liquidityScore`
- `stabilizationScore`
- `financialScore`

기본 가중치

- leader 25%
- correction 20%
- trend 15%
- liquidity 10%
- stabilization 15%
- financial 15%

보정 원칙

- 조정률은 `2년 고점` 기준이 기본이며, 필요할 때만 `5년 고점`을 보조 기준으로 사용
- 재무 평가는 `하드 제외`, `약점 페널티`, `회복/정상화 보너스`로 분리
- 대표주가 깊게 조정받았고 바닥 안정화가 보이면 재무 약점 페널티를 일부 완화

### 8-4. 필터 / 제외 조건

- ETF/ETN 제외
- 최근 20일 또는 60일 평균 거래대금 하한 체크
- 최소 조정률 체크
- 구조적으로 망가진 장기 하락 추세 제외
- 재무 하드 제외
  - 지속 적자 + 악화 흐름
  - 위험한 부채 구조 + 비안정 상태
  - 구조적 사업 훼손 플래그

### 8-5. 결과 분류

- label 분류
  - `leader correction watch`
  - `deep value review`
  - `base-forming candidate`
  - `needs more stabilization`
- candidate group 분류
  - `buy candidate`
  - `watch candidate`
- 각 후보는 `reasonSummary`와 재무/유동성/구조 메타데이터를 함께 반환한다.

## 9. 서버 장기 픽 기능

### 9-1. API

- `GET /analysis/server-long-term-picks`
- `POST /analysis/server-long-term-picks`

### 9-2. 저장 방식

- 파일: `data/server-long-term-picks.json`
- 장기 카테고리 종목 저장용 엔드포인트가 구현되어 있다.

## 10. 국내 급등 / 급락 엔진

### 10-1. API

- `GET /analysis/korean-movers`
- `POST /analysis/korean-movers/discord`

### 10-2. 데이터 수집

- 네이버 상승/하락 페이지 파싱
- KOSPI / KOSDAQ 선택 지원
- 상위 후보에 대해 개별 차트 재조회 후 점수화

### 10-3. 현재 계산 항목

- 등락률
- 거래량
- 20일 평균 거래량 대비 배수
- 20일/60일 고점 돌파 또는 저점 이탈
- 고가/저가 부근 마감 여부
- 추정 거래대금
- alert score
- signal 등급
  - `watch`
  - `strong`
  - `explosive`

## 11. 실시간 급등 알림 엔진

### 11-1. API

- `POST /alerts/price-spike`

### 11-2. 현재 구현된 기능

- `x-alert-secret` 검증 지원
- 입력 이벤트에서 자동 계산
  - changePercent
  - turnoverKrw
- 임계값 평가
  - 최소 상승률
  - 최소 거래량 배수
  - 최소 거래대금
  - 돌파 요구 여부
- 점수화 및 signal 등급 산정
  - `watch`
  - `strong`
  - `explosive`
- cooldown 기반 dedupe 처리
- Discord 발송 지원

## 12. 시장 감시 / 이벤트 캘린더 기능

### 12-1. API

- `GET /analysis/market-watch`
- `GET /analysis/market-event-calendar`

### 12-2. 현재 감시 대상

- KOSPI
- KOSDAQ
- USD/KRW
- GOLD
- WTI

### 12-3. 시장 감시 현재 제공 데이터

- 현재가
- 전일 종가
- 등락폭 / 등락률
- 최신 일자
- 차트 세트
  - daily
  - weekly
  - yearly

### 12-4. 이벤트 캘린더 현재 제공 데이터

- 월간 캘린더 뷰
- 해당 월 날짜만 표시하고 전달/익월 날짜는 비워진 셀로 처리
- 날짜별 요약 수치
  - earnings count
  - macro count
  - other count
- 고중요도 이벤트 존재 여부 표시
- 날짜 클릭 시 모달 팝업으로 상세 이벤트 목록 표시
- 상세 이벤트 필드
  - title
  - date
  - time
  - category
  - importance
  - ticker / companyName
  - description
- 데이터 원본
  - `data/market-event-calendar.json`
- 현재 단계
  - DB 없이 JSON 파일 원본을 읽어 프론트 보드에 제공하는 MVP 구조

## 13. 실시간 종목 기능

### 13-1. API

- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`

### 13-2. 현재 제공 데이터

- 실시간 스냅샷 묶음 조회
- 단일 종목 상세 차트 조회
- anchorDate 기준 상세 뷰 지원
- 장기/스윙 카테고리 정보 포함 가능

## 14. 종목 유니버스 기능

### 14-1. API

- `GET /analysis/stock-universe`

### 14-2. 현재 구현 내용

- KRX `corpList.do` 다운로드 파싱
- 시장 대상
  - KOSPI
  - KOSDAQ
  - KONEX
- code / name / market / sector 수집
- 중복 제거
- 12시간 메모리 캐시
- `forceRefresh` 지원

## 15. 뉴스 시그널 기능

### 15-1. API

- `GET /analysis/news-signals`

### 15-2. 현재 구현 상태

- 네이버 Search API 뉴스 검색 결과를 기준으로 최근 기사 메타데이터를 수집한다.
- 서버 시작 시 1회 즉시 수집하고 이후 5분 주기로 갱신한다.
- 회사 사전 기반 종목 매칭
- 회사 alias / query 기반 검색 지원
- 제목 키워드 기반 이벤트 분류
  - `CONTRACT`
  - `EARNINGS`
  - `M&A`
  - `POLICY`
  - `CAPEX`
  - `SHAREHOLDER`
  - `RISK`
- 긍정/부정 sentiment 분류
- 최근 36시간 기사만 반영
- 링크 / 발행시각 기준 dedupe 처리
- 실패 시 마지막 메모리 캐시를 fallback 으로 사용
- 1시간 이내 동일 종목/이벤트 그룹핑
- 기사 수 / 출처 수 기반 score 보정
- 섹터별 요약 생성
- 기사 본문 전체를 저장하는 구조는 아니고 검색 API 메타데이터 + 원문 링크 중심 구조다.

## 16. Discord 연동

현재 아래 기능들이 Discord 발송을 지원한다.

- 추천 패턴 결과
- 스마트 머니 결과
- 스마트 머니 watchlist 스캔 결과
- 급등/급락 결과
- 실시간 급등 알림

## 17. 현재 저장 방식

현재 프로젝트는 DB가 아니라 파일 저장 방식이 중심이다.

- `data/server-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/smart-money-watchlist.json`
- `data/market-event-calendar.json`

## 18. 현재 구현 한계 / 주의 사항

- 뉴스 시그널은 네이버 Search API 메타데이터 기반이며 기사 본문 전체 스크랩/저장은 하지 않는다.
- 네이버 Search API 자격 증명이 없으면 뉴스 시그널 결과는 비어 있을 수 있다.
- 시장 이벤트 캘린더는 현재 자동 수집기가 아니라 JSON 파일 기반 샘플/수동 관리 구조다.
- 장기 엔진은 전 시장 완전 자동 저장형이 아니라 리뷰/선별 성격이 강하다.
- 스마트 머니 스캔 결과는 `matched`와 `actionable`을 분리해서 저장한다.
- 재무 데이터는 국내 6자리 종목 기준 네이버 금융 파싱 의존도가 높다.
- 저장소는 DB가 아니라 JSON 파일 기반이다.
- 시세는 네이버/Yahoo 외부 소스 응답에 영향을 받는다.

## 19. 현재 구현 요약

## 18-A. 2026-04-13 유지보수 반영

- 추천 종목 상단 카테고리 탭은 `중장기 / 배당 / 스윙` 3개가 한 줄에 보이도록 정리되었다.
- 추천 종목 차트의 기준일 가격선은 일봉뿐 아니라 주봉, 월봉에서도 기준일이 속한 가장 가까운 집계 봉에 맞춰 표시된다.
- `GET /analysis/market-watch` 감시 대상에는 `BTC` 가 포함된다.
- 시장 감시 화면의 표시 날짜는 서울 기준 서버 갱신 시각(`fetchedAt`)을 기준으로 통일해서 보여준다.
- 원본 시세 소스의 실제 거래일은 자산별 거래소 시간대 차이로 하루 늦을 수 있다. 예를 들어 `Gold`, `WTI` 는 미국 세션 기준 날짜가 내려올 수 있다.
- crypto(`BTC`)는 현재 진행 중 봉이 잘려 보이지 않도록 최신 일봉/주봉 집계를 유지한다.
- 서버 스윙 픽 파일 `data/server-swing-picks.json` 은 `executionItems` 와 `watchItems` 를 함께 저장하며, UI도 이 두 버킷을 같이 사용한다.

현재 저장소는 아래 기능이 실제 동작 가능한 수준으로 묶여 있다.

- 추천 분석
- 스마트머니 / 스윙 실행 엔진
- 장기 검토 엔진
- 시장 감시 보드
- 실시간 종목 보드
- 급등/급락 탐지
- 실시간 알림
- 뉴스 시그널 보드
- Discord 연동
