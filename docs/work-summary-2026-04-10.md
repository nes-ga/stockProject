# 2026-04-10 작업 정리

이 문서는 `2026-04-10`에 진행한 작업만 별도로 정리한 문서다.

## 1. 뉴스 시그널 수집 구조 점검

초기 확인 결과:

- 기존 뉴스 시그널은 실제 스크랩 구조가 아니라 `mockNewsSeed` 기반 정적 데이터였다.
- `lastUpdatedAt`은 실제 기사 수집 시각이 아니라 payload 생성 시각이었다.
- 기사 URL도 `news.example.com` 더미 링크였다.

확인 대상 파일:

- `src/services/newsSignals.ts`
- `frontend/newsSignalDashboard.jsx`
- `src/routes/analysisRoutes.ts`
- `src/app.ts`

정리:

- 뉴스 시그널 화면에 보이는 “마지막 업데이트”와 실제 기사 시간 기준이 분리되어 있지 않은 상태를 확인했다.
- 실제 외부 수집이 없다는 점을 코드 기준으로 점검했다.

## 2. 네이버 뉴스 검색 API 기반 실제 뉴스 수집으로 변경

수정 파일:

- `src/services/newsSignals.ts`
- `src/config.ts`
- `.env`
- `frontend/newsSignalDashboard.jsx`

주요 변경:

- 정적 `mockNewsSeed` 기반 뉴스 소스를 제거했다.
- 네이버 뉴스 검색 API를 사용해 회사별 최근 뉴스 메타데이터를 수집하도록 변경했다.
- 회사별 검색어, alias 매칭, 최근 36시간 필터, 기사 중복 제거를 추가했다.
- 수집 결과를 기존 뉴스 시그널 카드 생성 로직과 연결했다.
- 수집 실패 시 서버가 죽지 않도록 캐시/빈 payload fallback 흐름을 유지했다.
- `.env`에 아래 설정을 추가했다.
  - `NAVER_SEARCH_CLIENT_ID`
  - `NAVER_SEARCH_CLIENT_SECRET`
- 뉴스 링크 판정도 더미 도메인 기준이 아니라 실제 `http/https` URL 기준으로 바꿨다.

운영상 확인한 점:

- 현재 구조는 “기사 본문 저장”이 아니라 제목/출처/발행시각/원문 링크만 다룬다.
- API 키가 없거나 결과가 0건이면 화면이 비는 구조라는 점도 함께 확인했다.

## 3. 시장 이벤트 캘린더 데이터 구조 추가

수정 파일:

- `src/types.ts`
- `src/services/marketEventCalendar.ts`
- `src/routes/analysisRoutes.ts`
- `data/market-event-calendar.json`

추가한 타입:

- `MarketEventCategory`
- `MarketEventImportance`
- `MarketEventCalendarEvent`
- `MarketEventDailySummary`
- `MarketEventCalendarPayload`

구현 내용:

- 파일 기반 JSON을 읽는 `market event calendar` 서비스 추가
- 일자별 이벤트 요약 생성
- 카테고리별 count 계산
- 중요도 우선순위 기반 highlight 결정
- 신규 API 추가
  - `GET /analysis/market-event-calendar`

샘플 이벤트 데이터:

- 삼성전자 실적
- SK하이닉스 실적
- LG에너지솔루션 실적
- 한국 CPI
- 미국 PPI / GDP / 고용지표
- 한국은행 금통위
- FOMC 금리 결정
- 옵션 만기일
- 정책 브리핑 등

## 4. 메인 대시보드에 Market Event Calendar 보드 추가

수정 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`

구현 방향:

- 기존 `indexView` 안의 `Index and Watch Assets` 보드 옆에 새 보드를 추가했다.
- 데스크톱에서는 좌우 2열 배치, 좁은 화면에서는 세로 스택으로 정리했다.
- 달력 셀에는 상세 목록을 넣지 않고 요약만 표시하도록 설계했다.

달력 셀 표시 요소:

- `E` : earnings count
- `M` : macro count
- `O` : policy / market / 기타 count
- `!` : high importance 존재 여부
- 중요한 일정만 짧은 highlight 한 줄 표시

상세 동작:

- 날짜 클릭 시 해당 날짜를 선택한다.
- 선택된 날짜의 상세 이벤트는 팝업에서 확인하도록 변경했다.

## 5. 이벤트 상세 패널을 팝업 방식으로 변경

수정 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`

정리:

- 초기 구현에서는 보드 하단에 선택 날짜 상세 패널이 있었다.
- 이후 요구사항에 맞춰 날짜 클릭 시 팝업 모달로 상세를 띄우는 방식으로 변경했다.
- 모달에는 다음 동작을 연결했다.
  - 날짜별 상세 이벤트 표시
  - 카테고리 그룹 렌더링
  - `+N more` 확장
  - 배경 클릭 닫기
  - `Esc` 닫기

모달 그룹:

- Earnings
- Macro
- Policy / Regulation
- Market
- Other

## 6. 이벤트 캘린더 UI 정리

추가 변경:

- 하단 `선택 날짜 보기` 보조 버튼은 중복 기능이라 제거했다.
- 달력은 해당 월 날짜만 보이도록 정리했다.
  - 전달 날짜 숫자 제거
  - 익월 날짜 숫자 제거
  - 정렬용 빈 칸만 유지

의도:

- 월 단위 보기를 더 깔끔하게 유지
- 이벤트가 많은 달에도 셀 밀도가 과도하게 높아지지 않게 유지

## 7. 인코딩 점검 및 보완

점검 대상:

- 소스 파일 저장 인코딩
- 정적 파일 응답 헤더
- JSON API 응답
- 외부 HTML 수집 경로

확인 내용:

- `.editorconfig` 기준 프로젝트 파일은 `utf-8-bom`으로 통일되어 있었다.
- `src/app.ts`에서 정적 파일에 `charset=utf-8` 헤더를 명시하고 있었다.
- Express `response.json(...)` 경로는 JSON 응답 기준 UTF-8로 출력된다.
- `public/index.html`, `public/app.js`, `frontend/newsSignalDashboard.jsx`, `src/services/newsSignals.ts`, `data/market-event-calendar.json`은 UTF-8로 읽을 때 정상 한글이었다.

실제 수정:

- `src/services/fundamentals.ts`의 네이버 금융 HTML 읽기 방식을 `response.text()`에서 `TextDecoder("euc-kr")` 기반 디코딩으로 바꿨다.

이유:

- 같은 네이버 HTML 계열을 읽는 다른 서비스는 이미 `euc-kr`를 명시 디코딩하고 있었다.
- 재무/기업개요 파싱 경로에서 인코딩 깨짐 가능성을 줄이기 위한 정리다.

## 8. 오늘 기준 주요 수정 파일 목록

- `.env`
- `data/market-event-calendar.json`
- `docs/work-summary-2026-04-10.md`
- `frontend/newsSignalDashboard.jsx`
- `public/app.css`
- `public/app.js`
- `public/index.html`
- `src/config.ts`
- `src/routes/analysisRoutes.ts`
- `src/services/fundamentals.ts`
- `src/services/marketEventCalendar.ts`
- `src/services/newsSignals.ts`
- `src/types.ts`

## 9. 검증

실행한 검증:

- `npm.cmd run check`
- `npm.cmd run build`

결과:

- 타입 체크 통과
- 빌드 통과

## 10. 현재 남아 있는 후속 과제

- 뉴스 시그널 수집기에서 “빈 결과가 와도 직전 성공 결과 유지” 정책 보강
- 뉴스 수집 구조를 stock / macro / scheduler / state / dedupe 단위로 분리
- 시장 이벤트 캘린더를 현재 JSON 샘플에서 실제 파일/수집 파이프라인으로 확장
- 모달/캘린더 관련 문자열 중 과거 깨진 흔적이 있었던 부분 추가 점검
