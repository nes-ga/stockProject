# StockMon Dashboard

국내 주식 분석용 TypeScript + Express 대시보드입니다. 스윙, 중장기, 배당, 시장 자금 흐름, 뉴스 시그널, 이벤트 캘린더, 실시간 알림을 한 화면에서 다루는 구조입니다.

## 빠른 시작

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 주요 명령

```bash
npm run check
npm run build
npm run start
npm run refresh:swing-picks
npm run scan:swing-universe
npm run scan:dividend-universe
npm run scan:long-term
npm run scan:long-term-universe
```

검증 기준:

- `npm run check`: TypeScript 타입 검사
- `npm run build`: TypeScript 빌드 + 뉴스 시그널 production/minified 번들
- `npx tsx src/scripts/verifyVolumeProfile.ts`: 매물대 분석 샘플 시나리오 검증
- `npx tsx src/scripts/checkVolumeProfileImpact.ts`: 저장된 후보에 대한 매물대 영향 샘플 점검

## 주요 기능

- 스윙 엔진: 스마트머니 패턴, 눌림/돌파 상태, 실행 가능성, 거래정지/시장 국면 반영
- 중장기 엔진: 리더십, 조정률, 추세, 유동성, 안정화, 재무, 장기 매물대 구조 평가
- 매물대 분석: ATR 동적 bin, 시간감쇠, 몸통 중심 배분, 거리감쇠, 리테스트, POC/Value Area, profile 신뢰도
- 배당 엔진: 배당 수익률, 안정성, 성장성, 재무 리스크, 배당 ETF 추천
- Portfolio: 보유종목 요약, 오늘 우선 대응, 규칙 기반 코멘트, OCR 초안 병합/교체
- 시장 감시: KOSPI, KOSDAQ, NASDAQ100, SOX, VIX, USDKRW, GOLD, WTI, BTC
- 시장 흐름: 글로벌/국내 위험 선호, 테마 로테이션, 히스토리 차트
- 뉴스 시그널: Naver Search API 기반 종목/이벤트/섹터 요약
- 이벤트 캘린더: 실적, 매크로, 정책, 시장 이벤트 JSON 기반 관리
- 웹훅 기반 알림: 급등 조건 평가와 Discord 전송

## 현재 UI

- compact sticky navigation과 데스크톱 2열 분석 작업공간
- 상단 탭별 캐릭터와 배경 parade를 유지한 반응형 화면
- tabs/dialog 키보드 이동, focus trap/복귀, 상태·오류 ARIA 처리
- Portfolio의 `오늘 우선 대응` 우선 배치와 규칙 기반 한국어 문구
- 뉴스 초기 실패 재시도, 기존 데이터 stale 유지, 뉴스 탭 최초 진입 lazy loading
- 뉴스 번들: `1,103,322` bytes에서 `205,571` bytes로 축소(약 `81.4%`)

아직 구현하지 않은 범위는 Portfolio `RecoveryPlan` 계산, 보유종목 수동 추가/수정/삭제 UI, 뉴스 외 view 단위 lazy loading입니다.

## 주요 API

- `GET /health`
- `POST /analysis/recommendations`
- `POST /analysis/recommendation-patterns`
- `POST /analysis/smart-money-patterns`
- `GET /analysis/korean-movers`
- `GET /analysis/stock-universe`
- `POST /analysis/recommendation-universe-scan`
- `GET /analysis/recommendation-universe-scan/status`
- `GET /analysis/server-swing-picks`
- `GET /analysis/server-long-term-picks`
- `GET /analysis/server-dividend-picks`
- `GET /analysis/market-watch`
- `GET /analysis/market-flow`
- `GET /analysis/market-event-calendar`
- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`
- `GET /analysis/news-signals`
- `GET /portfolio/holdings`
- `POST /portfolio/holdings`
- `PUT /portfolio/holdings/:id`
- `DELETE /portfolio/holdings/:id`
- `GET /portfolio/advice`
- `GET /portfolio/quotes`
- `POST /portfolio/screenshot/parse`
- `POST /portfolio/screenshot/ocr-local`
- `POST /alerts/price-spike`
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist/scan`

## 데이터 저장

현재는 DB 없이 JSON 파일을 주 저장소로 사용합니다.

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/server-dividend-picks.json`
- `data/market-event-calendar.json`
- `data/recommendation-universe-alert-state.json`
- `data/market-flow/*.json`
- `data/portfolio-holdings.json`
- `data/portfolio-account.json`

## 문서

- [문서 인덱스](./docs/README.md)
- [현재 구현 기능](./docs/current-implemented-features.md)
- [프로젝트 개요](./docs/project-overview-2026-04-27.md)
- [프로젝트 개선 제안서](./docs/project-improvement-proposal-2026-07-13.md)
- [2026-07-13 UI 작업 요약](./docs/work-summary-2026-07-13-ui-refresh.md)
- [프로젝트 연혁](./docs/project-history.md)
- [스마트머니 유지보수 가이드](./docs/smart-money-maintenance.md)
- [중장기 엔진 설계](./docs/long-term-engine-design.md)
- [차트 이슈 조사](./docs/chart-investigation-2026-04-30.md)
