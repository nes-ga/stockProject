# stockMon Dashboard

TypeScript + Express 기반 국내 주식 분석 대시보드다. 추천 후보 관리, 스마트머니 스윙 패턴 분석, 중장기/배당 유니버스 검색, 시장 감시, 뉴스 시그널, Market Event Calendar, 실시간 알림 기능을 제공한다.

## 문서

- [프로젝트 문서 인덱스](./docs/README.md)
- [프로젝트 현황 문서 - 2026-04-27](./docs/project-overview-2026-04-27.md)
- [현재 구현 기능 정리](./docs/current-implemented-features.md)
- [스마트머니 유지보수 가이드](./docs/smart-money-maintenance.md)
- [중장기 엔진 설계 문서](./docs/long-term-engine-design.md)

## 빠른 시작

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`이다.

## 주요 명령어

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

현재 로컬 상태에서는 `npm run check`가 통과한다. `npm run build`는 React 의존성이 `node_modules`에 없으면 뉴스 대시보드 번들 단계에서 실패할 수 있다.

## 주요 API

- `GET /health`
- `POST /analysis/recommendations`
- `POST /analysis/recommendation-patterns`
- `POST /analysis/smart-money-patterns`
- `GET /analysis/korean-movers`
- `GET /analysis/stock-universe`
- `POST /analysis/recommendation-universe-scan`
- `GET /analysis/market-watch`
- `GET /analysis/market-event-calendar`
- `POST /analysis/market-event-calendar/search`
- `POST /analysis/realtime-stocks`
- `POST /analysis/realtime-stock-detail`
- `GET /analysis/news-signals`
- `POST /alerts/price-spike`
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist/scan`

## 저장 방식

현재는 DB 없이 `data/*.json` 파일을 사용한다. 대표 파일은 다음과 같다.

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/server-dividend-picks.json`
- `data/market-event-calendar.json`
- `data/recommendation-universe-alert-state.json`

자세한 구조와 현재 리스크는 [프로젝트 현황 문서](./docs/project-overview-2026-04-27.md)를 기준으로 확인한다.
