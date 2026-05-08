# 작업 요약 2026-04-10

## 범위

뉴스 시그널, 이벤트 캘린더, 인코딩, 프론트 UI 구조를 정리한 작업입니다.

## 뉴스 시그널

초기 확인:

- 기존 뉴스 시그널은 실제 수집 구조가 아니라 mock seed 기반에 가까웠습니다.
- 기사 URL과 업데이트 시간이 실제 기사 메타데이터와 분리되어 있었습니다.

변경:

- Naver Search API 기반 뉴스 메타데이터 수집으로 전환
- 회사별 query/alias 기반 매칭
- 최근 기사 필터와 dedupe 추가
- 뉴스 link를 실제 `http/https` URL 기준으로 처리
- API 실패 시 캐시/fallback 구조 유지

관련 파일:

- `src/services/newsSignals.ts`
- `src/config.ts`
- `frontend/newsSignalDashboard.jsx`
- `src/routes/analysisRoutes.ts`

## 이벤트 캘린더

추가 타입:

- `MarketEventCategory`
- `MarketEventImportance`
- `MarketEventCalendarEvent`
- `MarketEventDailySummary`
- `MarketEventCalendarPayload`

구현:

- JSON 기반 이벤트 캘린더 서비스 추가
- 날짜별 요약 생성
- 중요도와 카테고리 count 제공
- `GET /analysis/market-event-calendar` 추가

관련 파일:

- `src/types.ts`
- `src/services/marketEventCalendar.ts`
- `src/routes/analysisRoutes.ts`
- `data/market-event-calendar.json`

## 프론트 이벤트 캘린더

변경:

- 메인 시장 감시 화면에 캘린더 보드 추가
- 날짜별 earnings/macro/other count 표시
- 날짜 클릭 시 상세 이벤트 modal 표시
- 하단 상세 패널 방식에서 popup modal 방식으로 전환

관련 파일:

- `public/index.html`
- `public/app.js`
- `public/app.css`

## 인코딩 점검

확인:

- 정적 파일과 JSON API는 UTF-8 응답을 사용합니다.
- Naver Finance HTML 계열은 EUC-KR decoding이 필요할 수 있습니다.

변경:

- `src/services/fundamentals.ts`의 Naver Finance HTML 읽기 경로에서 `TextDecoder("euc-kr")` 기반 decoding을 사용하도록 정리했습니다.

## 검증

실행:

```bash
npm.cmd run check
npm.cmd run build
```

결과:

- 타입 체크 통과
- 빌드 통과

## 남은 과제

- 뉴스 수집을 stock/macro/scheduler/state/dedupe 단위로 더 분리
- 이벤트 캘린더를 seed JSON에서 실제 공급원 연동으로 확장
- 깨진 과거 문서의 UTF-8 재작성
