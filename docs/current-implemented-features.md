# 현재 구현 기능

기준일: 2026-07-13

이 문서는 현재 코드에 실제로 구현된 기능만 정리합니다.

## 1. 서버와 프론트엔드

- Express 5 + TypeScript ESM 서버
- 정적 SPA:
  - `public/index.html`
  - `public/app.js`
  - `public/app.css`
- 뉴스 시그널 React 번들:
  - 원본: `frontend/newsSignalDashboard.jsx`
  - 빌드 결과: `public/news-signal-dashboard.js`
  - production define과 minify를 적용해 `1,103,322` bytes에서 `205,571` bytes로 축소(약 `81.4%`)
  - 초기 HTML에서 직접 로드하지 않고 뉴스 탭 최초 진입 시 동적으로 로드
- 공통 서버 동작:
  - `GET /health`
  - 요청별 `x-request-id`
  - 요청 시작/종료/오류 로깅
  - JSON API 오류 처리
  - 정적 파일 UTF-8 응답

## 2. 주요 화면

- 뉴스 시그널 대시보드
- 시장 감시/시장 흐름/이벤트 캘린더
- 추천 종목 분석 화면
- Portfolio 보유종목 관리 화면
- 스윙/중장기/배당 후보 관리
- 국내 급등/급락 종목 화면
- 실시간 종목 상세 차트

현재 UI shell:

- compact sticky navigation을 사용하고 상단 탭별 캐릭터와 배경 parade를 유지
- 데스크톱 분석 화면은 좌측 종목 선택과 우측 분석 결과의 2열 작업공간
- Portfolio는 `오늘 우선 대응`과 `규칙 기반 코멘트`를 KPI보다 먼저 배치
- app/category tabs에 키보드 방향키 이동과 ARIA tab 상태를 제공
- dialog에 focus trap, 초기 focus, 닫은 후 focus 복귀, 배경 inert, scroll lock을 적용
- `prefers-reduced-motion`에서 캐릭터와 배경 애니메이션을 중지

차트는 공휴일/비거래일을 임의 whitespace candle로 채우지 않고, 실제 거래 데이터 중심으로 렌더링합니다.

## 3. 분석 API

- `POST /analysis/recommendations`: 저장 또는 입력된 추천 종목을 분석
- `POST /analysis/recommendation-patterns`: 추천 전후 모멘텀 패턴 평가
- `POST /analysis/smart-money-patterns`: 스윙 스마트머니 패턴 평가
- `GET /analysis/korean-movers`: 국내 급등/급락 종목 분석
- `POST /analysis/korean-movers/discord`: 급등/급락 결과 Discord 전송
- `GET /analysis/stock-universe`: KRX 기반 종목 universe 조회
- `POST /analysis/recommendation-universe-scan`: 스윙/중장기/배당 universe scan
- `GET /analysis/recommendation-universe-scan/status`: scan job 상태 조회
- `POST /analysis/realtime-stocks`: 복수 종목 실시간 스냅샷 조회
- `POST /analysis/realtime-stock-detail`: 단일 종목 상세 차트/스냅샷 조회
- `GET /analysis/news-signals`: 뉴스 시그널 대시보드 payload 조회
- `GET /analysis/online-presence`: 접속자 상태 조회
- `POST /analysis/online-presence/heartbeat`: 접속자 heartbeat

## 4. 저장 후보 API

- `GET /analysis/server-swing-picks`
- `POST /analysis/server-swing-picks`
- `GET /analysis/server-long-term-picks`
- `POST /analysis/server-long-term-picks`
- `GET /analysis/server-dividend-picks`
- `POST /analysis/server-dividend-picks`

스윙 후보는 일반 스윙과 소형주 프로필을 분리할 수 있고, 저장 payload는 `executionItems`, `watchItems`, `items`를 함께 제공합니다.

## 5. Portfolio

API:

- `GET /portfolio/holdings`
- `POST /portfolio/holdings`
- `PUT /portfolio/holdings/:id`
- `DELETE /portfolio/holdings/:id`
- `GET /portfolio/advice`
- `GET /portfolio/quotes`
- `POST /portfolio/screenshot/parse`
- `POST /portfolio/screenshot/ocr-local`

현재 UI:

- 보유종목 요약, 행동 우선순위, 실행 계획과 종목별 상세 제공
- 규칙 기반 판단을 AI 생성 결과처럼 보이지 않도록 `오늘 우선 대응`, `규칙 기반 코멘트`로 표시
- 로컬 OCR과 AI 판독 결과를 저장 전 초안으로 검토하고 병합 또는 교체 저장
- 현재 `복구 단계`는 조건 충족 상태를 보여주는 보조 표시이며 손익분기/회수 금액을 계산하는 `PortfolioRecoveryPlan`은 아님

Portfolio CRUD API는 구현되어 있지만 화면에서 직접 보유종목을 추가, 수정, 삭제하는 UI는 아직 없습니다. 계산형 `PortfolioRecoveryPlan`도 후속 범위입니다.

## 6. 시장 감시와 시장 흐름

시장 감시:

- `GET /analysis/market-watch`
- 감시 대상: `KOSPI`, `KOSDAQ`, `NASDAQ100`, `SOX`, `VIX`, `USDKRW`, `GOLD`, `WTI`, `BTC`
- 일봉/주봉/연봉 chart window 제공

시장 흐름:

- `GET /analysis/market-flow`
- `GET /analysis/market-flow/latest`
- `GET /analysis/market-flow/history`
- `GET /analysis/market-flow/themes/history`
- `POST /analysis/market-flow/refresh`
- 글로벌 위험 선호, 국내 수급 상태, 시장 모드, 테마 로테이션 제공

## 7. 이벤트 캘린더와 뉴스 시그널

이벤트 캘린더:

- `GET /analysis/market-event-calendar`
- `POST /analysis/market-event-calendar/search`
- 데이터 파일: `data/market-event-calendar.json`
- 실적, 매크로, 정책, 시장, 뉴스 이벤트를 날짜별 summary로 제공

뉴스 시그널:

- Naver Search API 기반 뉴스 메타데이터 수집
- 회사 alias/query 기반 종목 매칭
- 이벤트 유형 분류: `CONTRACT`, `EARNINGS`, `M&A`, `POLICY`, `CAPEX`, `SHAREHOLDER`, `RISK`
- sentiment와 섹터 요약 제공
- 실패 시 최근 메모리 캐시 fallback 사용
- 최초 로딩 실패 시 오류와 빈 결과를 분리하고 `다시 시도` 제공
- 백그라운드 갱신 실패 시 기존 데이터를 유지하고 stale 상태와 재시도 동작 표시
- 최초 로딩 중 통계는 `0건` 대신 `-`로 표시
- 뉴스 펼침 토글에 `aria-expanded`, `aria-controls`를 제공하고 화면 문구를 한국어로 통일

## 8. 스윙 스마트머니 엔진

핵심 파일:

- `src/services/smartMoneyEngine.ts`
- `src/services/smartMoney/config.ts`
- `src/services/smartMoney/marketContext.ts`
- `src/services/recommendationUniverse.ts`

주요 기능:

- setup/breakout 후보 평가
- `matched`와 `actionable` 분리
- `execution_ready`, `execution_probe`, `watch` bucket 분류
- 사용자 화면의 `진입 가능`은 `execution_ready`만 사용하며, `execution_probe`는 관찰/확인 후보로 취급
- `entry_zone_pending`이 붙은 후보는 매수가 도달 상태가 아니므로 `watchItems`에 둠
- 체결된 기존 스윙 케이스는 새 스캔에서 패턴이 사라져도 손절/목표/시간 종료 전까지 `watchItems`로 보존
- SMA20 기반 눌림 진입 구간
- breakout 추격 금지 상태
- staged buy plan, stop-loss reference, risk/reward 계산
- 시장 국면 기반 threshold 조정
- 거래정지 사유별 처리:
  - `critical`: 제외
  - `structural`: 제외
  - `event`: 패널티 후 허용
  - `technical`: watch-only

## 9. 매물대 분석 엔진

핵심 파일:

- `src/services/volumeProfile.ts`
- `src/scripts/verifyVolumeProfile.ts`
- `src/scripts/checkVolumeProfileImpact.ts`

공통 계산:

- 일봉 OHLCV만 사용
- ATR(14) 기반 동적 binSize
- 시간감쇠 가중치
- 몸통 중심 거래량 배분
- gap vacuum zone 기록과 배분 제외
- 거리감쇠 기반 위/아래 매물 계산
- POC, Value Area High/Low
- 주요 매물대, 지지/저항 zone
- 리테스트 성공/실패
- 다음 저항/지지까지 기대 여력과 reward/risk
- profileReliability와 warning 제공

스윙 해석:

- `swingVolumeProfile.shortTerm`: 60일
- `swingVolumeProfile.baseTerm`: 120일
- 추격 위험, 돌파 신뢰도, 눌림 지지 품질 중심
- 양수 가산은 BUY 승격에 직접 쓰지 않고, 감점은 더 강하게 반영

중장기 해석:

- `longTermVolumeProfile.oneYear`: 240일
- `longTermVolumeProfile.twoYear`: 480일
- `longTermVolumeProfile.threeYear`: 720일
- 장기 바닥권 누적, 장기 박스권 돌파, 장기 위 매물 부담, 고점권 정체, 보유 품질 중심

## 10. 중장기 엔진

핵심 파일:

- `src/services/longTermEngine.ts`
- `src/services/longTerm/strategy.ts`
- `src/services/longTerm/*Score.ts`

평가 축:

- `leaderScore`
- `correctionScore`
- `trendScore`
- `liquidityScore`
- `stabilizationScore`
- `financialScore`
- `volumeProfileScore`

결과:

- `buy candidate`
- `watch candidate`
- `leader correction watch`
- `deep value review`
- `base-forming candidate`
- `needs more stabilization`

## 11. 배당 엔진

핵심 파일:

- `src/services/dividendEngine.ts`
- `src/services/dividend/strategy.ts`
- `src/services/dividendEtfService.ts`

평가 항목:

- 배당 수익률
- 배당 지속성
- 배당 안정성
- 성장성
- 재무 리스크
- 배당 함정 위험
- 배당 ETF 추천

## 12. 알림

- `POST /alerts/price-spike`: 요청으로 전달된 급등 이벤트 평가와 Discord 전송
- `GET /alerts/smart-money-watchlist`
- `POST /alerts/smart-money-watchlist`
- `DELETE /alerts/smart-money-watchlist/:symbol`
- `POST /alerts/smart-money-watchlist/scan`

## 13. 데이터 저장

현재는 DB가 아니라 JSON 파일 중심입니다.

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`
- `data/server-long-term-picks.json`
- `data/server-dividend-picks.json`
- `data/smart-money-watchlist.json`
- `data/market-event-calendar.json`
- `data/recommendation-universe-alert-state.json`
- `data/market-flow/market-flow-latest.json`
- `data/market-flow/market-flow-history.json`
- `data/market-flow/theme-rotation-history.json`
- `data/portfolio-holdings.json`
- `data/portfolio-account.json`

## 14. 검증

일반 검증:

```bash
npm run check
npm run build
node --check public/app.js
```

매물대 검증:

```bash
npx tsx src/scripts/verifyVolumeProfile.ts
npx tsx src/scripts/checkVolumeProfileImpact.ts
```

2026-07-13 UI 검증:

- Chrome `1440x1000`, `390x844`에서 분석, Portfolio, 시장, 뉴스, 급등락 화면 확인
- 두 viewport에서 문서 가로 넘침과 콘솔 오류가 없음을 확인
- 뉴스 탭 진입 전 `public/news-signal-dashboard.js`가 요청되지 않고, 진입 후 로드되는 것을 확인
- 뉴스 번들 `1,103,322 -> 205,571` bytes, 약 `81.4%` 축소 확인

## 15. 현재 주의사항

- 매물대 점수는 단독 매수 신호가 아닙니다.
- 체결된 스윙 히스토리 케이스는 손절가 이탈 전까지 새 스캔 누락만으로 종료하지 않습니다.
- 스윙 매물대는 리스크 해석 중심이고, BUY 승격용 직접 가산으로 쓰지 않습니다.
- 중장기 매물대는 진입 타이밍보다 구조와 보유 품질을 확인합니다.
- 외부 데이터는 Naver, KRX, Yahoo 응답 품질과 rate limit의 영향을 받습니다.
- JSON 저장소는 동시 쓰기/배포 persistence 측면에서 DB보다 약합니다.
- Portfolio `RecoveryPlan` 계산과 수동 CRUD 화면은 아직 구현되지 않았습니다.
- 뉴스 외 view의 데이터와 UI 모듈은 아직 view 단위 lazy loading이 아닙니다.
