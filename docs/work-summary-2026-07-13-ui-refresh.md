# 2026-07-13 작업 요약 - UI Shell Refresh

- Status: Active
- Last verified: 2026-07-13
- Scope: UI shell, responsive layout, accessibility, Portfolio presentation, news loading/build
- Continuation: 사용자 피드백을 반영하며 계속 수정하는 작업이다.

## 1. 작업 목표

- 큰 hero와 반복 카드 때문에 실제 데이터가 늦게 보이는 문제를 줄인다.
- 분석, Portfolio, 시장, 뉴스, 급등락 화면을 반복 작업에 맞는 밀도로 정리한다.
- 캐릭터는 제거 대상이 아니라 StockMon의 브랜드 정체성으로 유지한다.
- 탭과 dialog를 키보드로 사용할 수 있게 하고 비동기 상태를 명확히 분리한다.
- 뉴스 화면이 필요하지 않을 때 React 번들을 받지 않도록 초기 로딩 비용을 줄인다.

## 2. 완료된 작업

### UI shell과 반응형 구조

- [x] 큰 hero를 compact sticky header로 축소
- [x] 상단 6개 화면 전환 탭을 `분석 -> 보유종목 -> 시장 -> 급등락 -> 뉴스 -> 히스토리` 순서로 정리
- [x] 분석 화면을 데스크톱에서 종목 목록과 상세 분석의 2열 작업공간으로 구성
- [x] 패널, 버튼, 반복 카드 반경을 주로 6~8px로 축소
- [x] 모바일에서 상단 탭을 한 줄 가로 스크롤, 본문을 단일 열로 전환
- [x] 시장과 급등락 반복 카드를 compact row 형태로 조정
- [x] 모바일 OCR 초안 표를 종목별 편집 카드 형태로 전환

### 캐릭터와 브랜드 표현

- [x] 초기 UI 정리에서 숨겼던 배경 mascot parade 복원
- [x] 브랜드 캐릭터와 상단 6개 탭별 캐릭터 복원
- [x] 탭 제목을 가리지 않도록 데스크톱/모바일 캐릭터 크기 조정
- [x] `pointer-events: none`과 `prefers-reduced-motion` 동작 유지

결정 사항:

- 캐릭터와 parade는 장식성 부채로 보지 않고 사용자 의도가 반영된 브랜드 자산으로 취급한다.
- 이후 UI 밀도 조정에서도 캐릭터를 일괄 숨기지 않는다.
- 큰 hero 문구는 되돌리지 않고 compact header 안에서 캐릭터를 유지한다.

### 접근성

- [x] 전역 화면 탭과 추천 하위 탭에 `tablist`, `tab`, `tabpanel` 역할 연결
- [x] `aria-selected`, `aria-controls`, roving `tabindex` 동기화
- [x] 방향키, Home, End 키 탭 이동
- [x] 8개 dialog의 초기 focus, focus trap, Escape 닫기, 이전 focus 복귀
- [x] dialog 표시 중 배경 `inert`와 body scroll lock
- [x] 오류에 `role="alert"`, 상태에 `role="status"`, 로딩 영역에 `aria-busy` 적용
- [x] 뉴스 펼침 버튼에 `aria-expanded`, `aria-controls` 연결

### 비동기 화면 상태

- [x] 분석, Portfolio, 급등락에서 로딩·오류·빈 결과가 동시에 보이지 않도록 분리
- [x] 뉴스 초기 실패 시 단일 오류 영역과 다시 시도 버튼 제공
- [x] 뉴스 백그라운드 갱신 실패 시 기존 데이터를 유지하고 stale 상태 표시
- [x] 뉴스 초기 로딩 통계는 잘못된 `0건` 대신 `-` 표시
- [x] 뉴스 버튼과 주요 화면 용어를 한국어로 통일

### Portfolio

- [x] `AI Portfolio Brief`를 `보유종목 브리핑`으로 변경
- [x] `AI Daily Comment` 성격의 문구를 `규칙 기반 코멘트`로 정정
- [x] 오늘 우선 대응과 규칙 기반 코멘트를 KPI보다 먼저 배치
- [x] `Market Mood`, `Recovery`, `Priority`를 `시장 분위기`, `복구 단계`, `우선순위` 중심으로 변경
- [x] 위험 행동을 `긴급 축소`, `반등 시 축소`, `회복 신호 대기`처럼 행동 중심으로 표시
- [x] 보유 데이터가 없을 때 JSON 직접 편집 대신 화면의 잔고 스크린샷 입력 흐름 안내

### 뉴스 번들 및 로딩

- [x] 뉴스 React root를 뉴스 탭 최초 진입 시 dynamic import
- [x] `process.env.NODE_ENV="production"` define 적용
- [x] esbuild minify, tree shaking, legal comment 제거 적용
- [x] 생성 번들 재빌드

번들 크기:

| 항목 | 변경 전 | 변경 후 | 감소율 |
| --- | ---: | ---: | ---: |
| `public/news-signal-dashboard.js` | 1,103,322 bytes | 205,571 bytes | 81.4% |

## 3. 변경 파일

애플리케이션:

- `public/index.html`
- `public/app.js`
- `public/app.css`
- `frontend/newsSignalDashboard.jsx`
- `scripts/build-news-dashboard.mjs`
- `public/news-signal-dashboard.js`

문서:

- `README.md`
- `docs/README.md`
- `docs/current-implemented-features.md`
- `docs/project-history.md`
- `docs/project-improvement-proposal-2026-07-13.md`
- `docs/work-plan-2026-07-08-portfolio-manager.md`
- `docs/project-overview-2026-04-27.md` (역사 스냅샷 상태 및 현재 문서 링크 추가)
- `docs/modified-files-summary.md` (역사 스냅샷 상태 및 현재 문서 링크 추가)
- 이 문서

런타임 데이터:

- 실행 중 변경된 `data/*.json`, `data/*.jsonl`은 UI 구현 파일이 아니다.
- 커밋 전에 소스 변경과 분리해서 검토하며, 문서 갱신 과정에서 되돌리지 않는다.

## 4. 검증 결과

실행 완료:

```bash
node --check public/app.js
npm.cmd run check
npm.cmd run build
```

추가 확인:

- esbuild를 이용한 `public/app.css` parse 성공
- `git diff --check` 성공
- Chrome `1440x1000`, `390x844` 렌더링 확인
- 분석, Portfolio, 시장, 뉴스, 급등락 화면의 문서 가로 overflow 없음
- 위 화면의 콘솔 오류 없음
- 뉴스 외 화면에서 뉴스 번들이 요청되지 않음
- 뉴스 화면 진입 시에만 뉴스 번들이 요청됨
- 상단 탭 캐릭터와 배경 parade가 데스크톱/모바일에서 복원됨

상호작용 확인:

- 종목 추가 dialog 초기 focus가 검색 입력으로 이동
- 마지막 focus 요소에서 Tab 입력 시 dialog 첫 요소로 순환
- Escape 후 원래 `종목 추가` 버튼으로 focus 복귀
- dialog 종료 후 배경 `inert`와 scroll lock 해제
- 상단 탭에서 ArrowRight 입력 시 다음 탭과 연결 panel이 함께 전환

## 5. 다음 작업

### UI 후속

- [ ] 사용자 피드백에 맞춰 캐릭터 크기, 탭 밀도, 색상과 여백 계속 조정
- [ ] 모바일 분석을 목록과 상세가 전환되는 master-detail 구조로 변경
- [ ] Portfolio 수동 등록·수정·삭제 UI 추가
- [ ] Portfolio 우선순위·수익률·비중·행동 필터 추가
- [ ] 360x800, 768x1024, 1280x800, 1600x900 회귀 화면 검증
- [ ] Playwright 기반 화면 전환, overflow, 키보드 접근성 smoke test 추가

### 로딩과 구조 후속

- [ ] 뉴스 외 화면도 현재 view 기준으로 초기화와 데이터 요청 분리
- [ ] `public/app.js`를 shell, 공통 API, view 모듈로 분리
- [ ] `public/app.css`의 기존 규칙과 override를 기능 단위 stylesheet로 정리
- [ ] esbuild를 직접 devDependency로 선언
- [ ] hashed asset, splitting, gzip/Brotli, 정적 캐시 정책 적용

### 별도 개선 제안 범위

- [ ] 외부 노출 차단, 인증, body/rate limit, webhook allowlist
- [ ] Portfolio 최신 시세 기반 재평가와 파생값 불변식 수정
- [ ] JSON atomic write와 동시 쓰기 제어
- [ ] 공통 HTTP timeout/retry/concurrency 정책
- [ ] 핵심 금융 규칙 회귀 테스트와 CI

## 6. 현재 제한 사항

- 모바일 분석 master-detail과 Portfolio 수동 CRUD는 아직 구현되지 않았다.
- 뉴스 화면만 lazy loading이며 다른 화면 데이터는 초기 로딩 비용이 남아 있다.
- `public/app.js`와 `public/app.css`는 여전히 큰 단일 파일이고 CSS override 중복이 있다.
- 브라우저 검증은 현재 `1440x1000`, `390x844` 중심이며 자동 회귀 테스트가 없다.
- 개선 제안서의 보안, 저장 안전성, 공통 HTTP, 서버 모듈화 항목은 이번 UI 작업 범위가 아니다.

## 7. 관련 문서

- [프로젝트 개선 제안서](./project-improvement-proposal-2026-07-13.md)
- [현재 구현 기능](./current-implemented-features.md)
- [Portfolio Manager 작업 계획](./work-plan-2026-07-08-portfolio-manager.md)
- [프로젝트 연혁](./project-history.md)
