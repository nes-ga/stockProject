# StockMon 프로젝트 개선 제안서

- Status: Partially implemented - UI shell, Portfolio presentation, and news loading/build
- Last verified: 2026-07-13
- Scope: 구조, 정확성, 성능, 보안, 저장소, 문서, 주석, UI/UX
- Verification: Markdown 28개(root README 포함), 주요 서버/프론트 코드, 데스크톱 1440x1000, 모바일 390x844 렌더링

구현 메모:

- 완료: compact sticky navigation, hero 축소, 작업형 2열 분석 화면, Portfolio 행동 우선 배치
- 사용자 피드백 반영: 배경 parade와 상단 탭별 캐릭터는 브랜드 정체성으로 복원
- 완료: tabs/dialog/focus 접근성, 오류·로딩·빈 상태 분리, 뉴스 stale/retry 상태
- 완료: 뉴스 production/minified build와 뉴스 탭 최초 진입 시 lazy loading
- 미완료: 보안·저장소·서버 모듈 개선, 전체 view 단위 lazy loading, 모바일 분석 master-detail, Portfolio 수동 CRUD

## 1. 결론

현재 프로젝트는 기능 범위가 넓고 스윙, 중장기, 배당, 시장 흐름, 뉴스, 히스토리, Portfolio까지 실제로 연결되어 있다. 반면 기능 확장 속도에 비해 운영 경계, 데이터 안전성, 테스트, 프론트 모듈화, 기준 문서가 뒤따르지 못한 상태다.

React 전체 재작성이나 DB 전면 교체부터 시작하는 것은 권장하지 않는다. 다음 순서가 위험과 중복 작업을 가장 적게 만든다.

1. 로컬 노출과 비용 발생 API를 먼저 보호한다.
2. Portfolio 판단과 비동기 분석 결과의 정확성을 고친다.
3. JSON 저장, 알림 발송, 외부 HTTP 호출의 실패 경계를 만든다.
4. 핵심 금융 규칙에 회귀 테스트를 추가한다.
5. 현재 탭만 로드하도록 프론트 초기화와 번들을 최적화한다.
6. 그 다음 화면 구조와 대형 파일을 기능 단위로 분리한다.

## 2. 현재 구조 요약

```text
server.ts
  -> app.ts
     -> routes/{analysis, marketFlow, alert, portfolio}
        -> services/{swing, longTerm, dividend, market, portfolio, news}
           -> Naver/Yahoo/KRX/FRED/ECOS/Discord/OpenAI
           -> data/*.json, data/**/*.json, data/*.jsonl

public/index.html
  -> public/app.js                  약 533KB
  -> public/app.css                 약 178KB
  -> public/news-signal-dashboard.js 약 206KB, 뉴스 탭 진입 시 로드
```

현재 구조의 장점은 도메인별 서비스가 이미 어느 정도 분리되어 있고, TypeScript strict와 Zod를 사용하며, API와 정적 SPA가 하나의 실행 단위로 단순하게 배포된다는 점이다.

현재 구조의 핵심 한계는 다음과 같다.

- `public/app.js`, `public/app.css`, `analysisRoutes.ts`, `recommendationHistory.ts`, `smartMoneyEngine.ts`에 책임이 집중되어 있다.
- 런타임 데이터가 JSON 파일과 Git 추적 파일에 섞여 있다.
- 외부 API timeout, retry, concurrency, cache 정책이 서비스마다 다르다.
- 자동화 테스트가 없고 타입 검사와 수동 검증 스크립트에 의존한다.
- 5월 기준 대표 문서가 현재 문서처럼 노출되어 6월과 7월 구현을 설명하지 못한다.

## 3. 우선순위 요약

| 우선순위 | 항목 | 이유 |
| --- | --- | --- |
| P0 | 기본 loopback 바인딩, 인증, body/rate limit | Portfolio 데이터, OCR, Discord, 스캔 API가 네트워크에 노출될 수 있음 |
| P0 | 사용자 입력 webhook URL 제거 또는 allowlist | 서버가 임의 URL로 POST할 수 있어 SSRF와 오용 가능 |
| P0 | Portfolio 최신 시세 기반 판단 | 표시 가격은 최신인데 행동 판단은 저장 가격 기준일 수 있음 |
| P0 | 최신 요청만 화면 반영 | 빠른 종목 전환 시 오래된 분석 응답이 최신 화면을 덮을 수 있음 |
| P1 | atomic write, write queue, outbox | 동시 요청과 발송 실패 시 데이터 또는 알림 유실 가능 |
| P1 | 공통 HTTP client와 캐시 분리 | 폴링마다 장기 히스토리를 반복 조회하고 timeout 정책이 없음 |
| P1 | 핵심 규칙 테스트와 CI | 금융 판단 경계 변경을 타입 검사만으로 검출할 수 없음 |
| P1 | 뉴스 외 view lazy load, splitting, 정적 캐시 | 뉴스 production/minify와 최초 진입 lazy loading은 완료했지만 다른 view는 여전히 eager 초기화됨 |
| P2 | 도메인별 모듈 분리 | 큰 파일의 변경 영향과 리뷰 비용을 낮춰야 함 |
| P2 | 문서 체계와 런타임 데이터 정리 | 구현 상태와 운영 기준의 source of truth가 불명확함 |

## 4. P0 개선안

### 4.1 로컬 실행 경계와 API 보호

근거:

- `src/server.ts:7`은 host 없이 `app.listen(config.port)`를 호출한다.
- `src/app.ts:44`에서 모든 요청을 인증 전에 최대 20MB까지 파싱한다.
- `/portfolio`, 서버 추천 저장, 전체 스캔, OCR, Discord 발송, watchlist 변경 API 대부분이 무인증이다.
- `/alerts/price-spike`의 secret은 선택 사항이며 미설정 시 인증이 비활성화된다.

권장 수정:

1. `HOST` 기본값을 `127.0.0.1`로 둔다.
2. 외부 바인딩을 허용할 때는 `API_TOKEN`이 없으면 서버 시작을 실패시킨다.
3. 인증과 rate limit을 비용 발생 API 및 쓰기 API에 우선 적용한다.
4. 일반 JSON은 256KB 수준으로 낮추고 OCR 이미지 라우트만 별도 제한을 둔다.
5. OpenAI OCR, Tesseract OCR, universe scan, Discord 전송은 개별 concurrency와 rate limit을 둔다.
6. 내부 오류 메시지는 로그에만 남기고 클라이언트에는 표준 오류 코드와 request ID만 반환한다.

완료 기준:

- 기본 실행은 `127.0.0.1`에서만 접근된다.
- 인증 없는 외부 쓰기 요청은 `401` 또는 `403`이다.
- 과대 요청은 `413`, rate limit 초과는 `429`다.
- Zod 오류는 `400`, upstream timeout은 `504`, upstream 실패는 `502`로 구분된다.

### 4.2 Discord webhook 입력 제한

근거:

- `src/routes/analysisRoutes.ts`의 여러 schema는 webhook URL을 일반 URL로만 검증한다.
- `src/services/discord.ts:623`은 받은 URL을 그대로 `fetch`한다.

권장 수정:

- 가장 안전한 방법은 요청 body에서 webhook URL을 제거하고 서버 설정에 등록된 destination ID만 받는 것이다.
- URL을 유지해야 한다면 `https`, `discord.com`, `/api/webhooks/` path를 모두 검사하고 사설 IP, redirect, 다른 host를 차단한다.
- webhook secret이나 URL을 로그와 응답에 포함하지 않는다.

### 4.3 Portfolio 판단을 최신 시세와 일치시키기

근거:

- `src/services/portfolio/portfolioManager.ts:85`의 advice는 저장된 `currentPrice`, `profitRate`로 판단한다.
- 같은 파일의 quotes는 최신값을 별도 응답하지만 행동 규칙을 다시 실행하지 않는다.
- `public/app.js:3001` 이후 UI는 가격 숫자만 갱신하고 `aiAction`, priority, execution plan은 유지한다.
- `investedAmount`, `evaluationAmount`, `profitRate`가 입력값으로 남아 가격과 불일치할 수 있다.

권장 수정:

1. `PortfolioSnapshotService`가 holdings, latest quotes, linked history를 한 번에 조합한다.
2. 파생값은 `avgPrice`, `currentPrice`, `quantity`에서 항상 다시 계산한다.
3. 동일 snapshot으로 summary와 advice를 생성한다.
4. 응답에 `quoteAsOf`, `adviceAsOf`, `isStale`, `source`를 포함한다.
5. quote 실패 시 과거 판단을 최신 판단처럼 보이지 말고 `STALE` 상태로 표시한다.

권장 응답 경계:

```ts
type PortfolioSnapshotResponse = {
  quoteAsOf: string;
  adviceAsOf: string;
  isStale: boolean;
  summary: PortfolioAccountSummary;
  items: Array<PortfolioAdvice & { quote: PortfolioQuoteItem }>;
};
```

### 4.4 프론트 요청 경합 제거

근거:

- `public/app.js:10156`의 분석 요청에는 `AbortController`와 요청 ID 검증이 없다.
- 종목을 빠르게 선택하면 먼저 시작한 느린 응답이 나중 응답을 덮을 수 있다.

권장 수정:

- 공통 `RequestManager`를 두고 기능별로 이전 요청을 abort한다.
- 화면 상태를 바꾸기 직전에 request sequence가 최신인지 검사한다.
- timeout, JSON 오류, abort, retry 가능 오류를 하나의 오류 타입으로 표준화한다.
- 자동 새로고침은 사용자가 수행 중인 요청을 덮지 않도록 한다.

## 5. P1 개선안

### 5.1 JSON 저장소 안전성

현재 `writeFile` 직접 덮어쓰기와 read-modify-write가 여러 서비스에 흩어져 있다. 동시 요청에서는 lost update, 부분 파일, 세 파일 중 일부만 저장되는 문제가 발생할 수 있다.

단기 조치:

- 공통 `JsonRepository<T>`를 만든다.
- Zod schema로 읽기 시점에 검증한다.
- `temp file -> fsync -> rename` 순서의 atomic write를 사용한다.
- 자원별 write queue와 revision을 둔다.
- 손상 파일은 자동 덮어쓰지 않고 backup과 오류 상태를 남긴다.
- `DATA_DIR`을 config에서 한 번만 결정한다.

중기 조치:

- Portfolio, alert state, recommendation history, job state를 SQLite transaction으로 옮긴다.
- 대용량 시계열이나 캐시까지 한 번에 이전하지 말고, 동시성과 조회 조건이 필요한 데이터부터 옮긴다.

알림은 다음 순서를 사용한다.

```text
diff 계산 -> durable outbox 저장 -> 발송 -> sent/history/state commit
```

현재처럼 발송 전에 dedupe/state를 확정하면 발송 실패 후 알림이 영구 누락될 수 있다.

### 5.2 외부 HTTP와 캐시 정책 통합

공통 HTTP client가 제공해야 할 기능:

- provider별 timeout
- GET에 한정된 지수 backoff
- `429`와 `Retry-After` 처리
- provider별 concurrency 제한
- response size 제한
- stale-if-error
- request ID와 provider latency 기록
- 성공 cache와 negative cache의 TTL 분리

우선 최적화 대상:

1. Portfolio quote는 차트 데이터 없이 현재가만 가져오는 quote-only provider로 분리한다.
2. Market Watch의 quote, intraday, daily history cache를 분리한다.
3. daily history는 6~24시간, intraday는 5~15초, quote는 시장 상태에 맞는 짧은 TTL을 사용한다.
4. 동일 요청의 in-flight Promise를 공유한다.
5. cache key에 provider, category, range, count를 포함하고 max-size LRU를 둔다.
6. recommendation history 갱신은 provider별 concurrency 4~8로 제한한다.

### 5.3 테스트 도입

전체 테스트 수를 늘리는 것보다 금융 판단 불변식부터 고정한다.

첫 번째 테스트 묶음:

- Portfolio 파생값과 행동 경계
- 최신 quote 반영 후 priority/action 재계산
- `execution_ready`, `execution_probe`, `watch` bucket 불변식
- history carry-forward, stop, target, time-close
- 알림 발송 실패와 재시도/idempotency
- JSON atomic write, 동시 쓰기, 손상 복구
- Naver/Yahoo/KRX/FRED/ECOS parser fixture
- route 입력 검증과 4xx/5xx taxonomy
- 분석 요청 응답 역전 방지

권장 도구:

- 단위/통합: Vitest
- HTTP: Supertest
- 화면 회귀: Playwright
- CI: `check -> test -> build -> smoke`

### 5.4 프론트 로딩과 번들 최적화

근거:

- `public/app.js:1496` 초기화가 서버 추천 데이터를 순차 대기한 뒤 UI를 복원한다.
- 이후 현재 탭과 무관한 market, movers, history, realtime 데이터를 모두 요청한다.
- 뉴스 번들의 production define/minify와 뉴스 탭 최초 진입 lazy loading은 2026-07-13에 반영했다.
- 번들 splitting, hashed filename, 정적 캐시는 아직 반영하지 않았다.
- 모든 정적 파일이 `no-store`, ETag off라 매번 다시 전송된다.

권장 수정:

1. shell, hash, 현재 탭을 먼저 렌더한다.
2. 현재 탭 데이터만 요청한다.
3. 다른 탭은 idle prefetch하거나 첫 진입 시 로드한다.
4. 완료: 뉴스 React root는 뉴스 탭 첫 진입 때만 mount한다.
5. 부분 완료: esbuild production define/minify는 적용했고 splitting과 hashed filename은 남아 있다.
6. `index.html`만 no-cache, hash asset은 `immutable` cache를 사용한다.
7. gzip 또는 Brotli를 적용한다.
8. `esbuild`를 직접 devDependency로 선언하고 Node engines를 지정한다.

## 6. 모듈 구조 개선안

전면 재작성 대신 다음 경계부터 점진적으로 분리한다.

```text
src/
  bootstrap/
    server.ts
    lifecycle.ts
  config/
    env.ts
  http/
    errors.ts
    auth.ts
    rateLimit.ts
    schemas/
  providers/
    naver/
    yahoo/
    krx/
    fred/
    ecos/
    discord/
    openai/
  features/
    swing/
    long-term/
    dividend/
    portfolio/
    market-flow/
    news/
  repositories/
    jsonRepository.ts
    portfolioRepository.ts
    historyRepository.ts
  jobs/
    universeScanJob.ts
    alertOutboxJob.ts
```

프론트는 다음 순서로 나눈다.

```text
public/modules/
  shell.js
  apiClient.js
  requestManager.js
  components/{tabs,dialog,asyncRegion,toast,dataTable,chartShell}.js
  views/{analysis,portfolio,market,movers,news,history}.js
```

먼저 공통 request와 dialog/tabs를 분리하고, 그 다음 view를 옮긴다. 모든 화면을 React로 바꾸는 작업은 이 단계의 선행 조건이 아니다.

## 7. 문서 수정안

### 7.1 즉시 바로잡을 내용

- `docs/current-implemented-features.md`와 `docs/project-overview-2026-04-27.md`는 2026-05-08 snapshot임을 제목과 상단 상태에 표시한다.
- README의 시장 감시 대상을 NASDAQ100, SOX, VIX 포함 9개로 갱신한다.
- Portfolio API, recommendation history, online presence, market-operation Discord, `/api/market-flow` alias를 API 목록에 추가한다.
- `data/portfolio-*.json`, swing history, Discord JSONL, market-operation state를 데이터 목록에 추가한다.
- Naver intraday 조사 문서는 구현 완료 상태로 바꾸고 investigations로 이동한다.
- `PortfolioRecoveryPlan`은 아직 계획이며 구현 완료가 아님을 표시한다.
- 현재 UI의 Recovery 진행 표시는 실제 손익분기/회수 계산이 아니므로 구현 전에는 "회복 조건 확인"으로 표현한다.
- Portfolio 판단은 규칙 기반이므로 "AI Portfolio Brief", "AI Daily Comment"를 "Portfolio Brief", "규칙 기반 코멘트"로 바꾼다.
- "실시간 알림"은 내장 수집기가 아니라면 "웹훅 기반 급등 평가"로 정확히 표현한다.

### 7.2 권장 문서 구조

```text
docs/
  README.md
  architecture.md
  capabilities.md
  api.md
  configuration.md
  operations.md
  data-sources.md
  security-privacy.md
  testing.md
  glossary.md
  domains/
    swing.md
    long-term.md
    portfolio.md
    market-flow.md
    news-alerts.md
  adr/
  investigations/
  learning/
  archive/work-logs/
```

모든 기준 문서 상단에 다음 메타데이터를 둔다.

```text
Status: Draft | Active | Superseded | Archived
Last verified: YYYY-MM-DD
Owner: ...
Supersedes: ...
```

작업 요약과 과거 수치는 `archive/work-logs`로 옮기고 `Historical snapshot` 표시를 붙인다.

### 7.3 새로 필요한 문서

- `.env.example`과 `configuration.md`
- `security-privacy.md`: local binding, 인증, OCR 이미지 전송, rawText 보존, 로그 마스킹
- `data-sources.md`: source, freshness, fallback, quota, cache TTL
- `testing.md`: 현재 테스트 공백과 우선 fixture
- `glossary.md`: Swing Recovery Cycle과 Portfolio Recovery Plan 구분
- ADR-001 JSON runtime storage
- ADR-002 local-only와 Portfolio 개인정보
- ADR-003 Swing bucket invariant
- ADR-004 Portfolio와 추천 엔진의 경계

## 8. 주석 수정 원칙

현재 소스에는 `TODO/FIXME/HACK`가 거의 없지만, 주석과 코드의 실제 의미가 어긋난 부분이 있다.

수정 대상:

- `src/services/dividendEtfService.ts`의 fallback 표현은 live fallback이 아니라 정적 snapshot으로 바꾸고 기준일과 출처를 적는다.
- `src/services/marketWatch.ts`의 Yahoo/KOSPI 중심 설명은 source 중립적인 설명으로 바꾼다.
- `public/app.js:3328` 부근 history 조건은 뒤 조건이 사실상 도달 불가능하므로 주석 추가가 아니라 조건 정리와 테스트가 필요하다.
- 종목 사례 중심의 장문 주석은 회귀 fixture로 옮기고 코드에는 불변식만 남긴다.
- `execution_probe`가 사용자 실행 후보가 아니라 watch라는 주석은 유지하고 테스트로 고정한다.

권장 주석 기준:

- "무엇을 하는 코드인지"보다 "왜 이 제약이 필요한지"를 적는다.
- 외부 provider의 비정상 응답과 금융 판단 불변식만 주석으로 남긴다.
- 숫자 threshold는 출처, 기준일, 변경 이유를 config 또는 정책 문서에 연결한다.
- 과거 종목명과 일회성 디버깅 설명은 주석에 남기지 않는다.

## 9. UI/UX 개선안

### 9.1 수정 전 화면에서 확인한 문제

- 데스크톱에서 브랜드 hero와 6개 기능 카드가 약 260px 이상을 차지해 업무 영역을 아래로 민다.
- 모바일 390x844에서는 브랜드와 기능 카드가 첫 화면 대부분을 차지하고 실제 분석/Portfolio 내용은 아래 스크롤 후 나타난다.
- Portfolio 화면은 brief, KPI 6개, chip, priority card, comment card, 종목 card가 연속 중첩되어 핵심 행동보다 컨테이너가 더 많이 보인다.
- mint/sky 배경과 둥근 카드가 거의 모든 영역에 적용되어 위험, 성공, 일반 정보의 시각적 우선순위가 약하다.
- 실제 일시 오류에서 raw English `Failed to fetch`와 빈 데이터 상태가 함께 노출됐다. 오류, 빈 결과, 로딩을 서로 다른 상태로 렌더해야 한다.
- `AI Portfolio Brief`는 실제 규칙 기반 판단을 AI 생성 결과처럼 보이게 한다.
- Portfolio API에는 CRUD가 있지만 UI에는 수동 추가/수정/삭제 흐름이 부족하다.

### 9.2 2026-07-13 완료된 UI 개선

- compact sticky navigation과 축소된 hero를 적용했다.
- 데스크톱 분석 화면을 좌측 종목 목록과 우측 상세의 2열 작업 구조로 정리했다.
- Portfolio는 장식성 요약보다 오늘의 행동과 우선 대응이 먼저 보이도록 배치를 조정했다.
- `AI Portfolio Brief`처럼 실제 구현보다 과장된 용어를 규칙 기반 표현으로 정리했다.
- 배경 parade와 탭별 캐릭터는 브랜드 정체성으로 유지하되 업무 영역을 덜 밀어내도록 조정했다.
- 모바일 OCR 초안 편집은 가로 표 대신 종목별 편집 카드로 전환했다.
- 오류, 로딩, 빈 결과를 분리하고 뉴스에는 stale 상태와 재시도 동작을 추가했다.
- tabs와 dialog의 ARIA 상태, 방향키 이동, focus trap/복귀, 전역 focus 표시를 보강했다.
- 뉴스 펼침 토글에 `aria-expanded`와 `aria-controls`를 연결했다.
- 뉴스 번들은 production/minified build로 전환하고 뉴스 탭 최초 진입 시에만 mount/load하도록 변경했다.

### 9.3 후속 화면 개선

분석:

- 모바일은 목록과 상세를 같은 긴 페이지에 두지 말고 종목 선택 후 상세 화면으로 전환한다.
- 선택 직후 상세로 이동하고 명확한 "목록으로" 동작을 제공한다.
- recommendation primary tabs의 잔여 grid 규칙을 정리한다.

Portfolio:

- `우선순위`, `손익률`, `비중`, `행동` 필터와 정렬을 추가한다.
- 수동 보유종목 추가/수정/삭제 UI를 제공한다.
- OCR은 `로컬 OCR`과 `AI 판독`을 mode 선택으로 분리하고 AI 선택 전에 외부 전송 범위를 알린다.
- `교체 저장`은 기존 N개와 신규 M개 diff 확인, 명시적 확인, undo를 거친다.

시장/뉴스/히스토리:

- 카드 수를 더 줄이고 비교가 필요한 값은 표, compact row, sparkline으로 표현한다.
- 중첩 스크롤을 제거하고 페이지 흐름과 `더 보기`를 사용한다.
- 차트에는 현재가, 고저, 거래량 요약과 데이터 표 대안을 제공한다.

### 9.4 후속 시각 체계

- 기본 배경을 중립적인 white/gray로 낮추고 mint/sky는 brand accent로 제한한다.
- 상승/성공은 green, 손실/위험은 red, 관찰은 amber, 정보는 blue로 의미를 고정한다.
- 페이지 section은 unframed layout을 우선하고 개별 반복 항목에만 card를 사용한다.
- card radius는 6~8px 중심으로 줄이고 card 안의 card를 제거한다.
- 핵심 숫자는 18~24px, 본문 14px, 보조 정보는 최소 12px로 정리한다.
- 아이콘 버튼은 44x44px 터치 영역과 tooltip을 제공한다.

### 9.5 접근성 상태

완료:

- 전역 `:focus-visible` 표시를 추가했다.
- tabs에 `tablist`, `tab`, `aria-selected`, `aria-controls`, 방향키 이동을 구현했다.
- dialog에 focus trap, 초기 focus, 닫은 후 focus 복귀, 배경 `inert`, scroll lock을 구현했다.
- 비동기 오류와 상태 영역에 `role="alert"`, `role="status"`, `aria-busy`를 적용했다.

후속:

- 클릭 가능한 table row를 행 안의 명시적인 상세 버튼으로 일관되게 바꾼다.
- `prefers-reduced-motion` 적용 범위를 hero, glow, background animation 전체로 점검한다.

## 10. 권장 실행 순서와 완료 기준

### 단계 A: 외부 노출과 정확성

- HOST, 인증, route limit, webhook allowlist
- Portfolio snapshot 통합과 파생값 재계산
- 프론트 request abort/latest-response-wins
- 규칙 기반/AI/Recovery 문구 정정

완료 기준: 보안 route smoke test와 Portfolio action 경계 테스트가 통과한다.

### 단계 B: 저장과 외부 호출

- JsonRepository, atomic write, write queue
- alert outbox와 idempotency
- 공통 HTTP client, provider concurrency, quote/history cache 분리
- 런타임 데이터 경로와 retention 정리

완료 기준: 동시 쓰기, 발송 실패 재시도, upstream timeout 테스트가 통과한다.

### 단계 C: 테스트와 빌드

- Vitest/Supertest 핵심 회귀 테스트
- esbuild 직접 의존성, production/minified build
- 현재 탭 lazy loading
- CI `check/test/build/smoke`

완료 기준: 깨끗한 설치에서 CI와 build가 재현되고 뉴스 탭 미진입 시 React 번들을 받지 않는다.

### 단계 D: UI shell

상태: Partially implemented. 2026-07-13에 1차 UI shell과 표현 정리를 적용했고 후속 작업이 남아 있다.

- [x] compact sticky navigation
- [x] hero 축소
- [x] 데스크톱 분석 2열 작업 구조
- [x] Portfolio 행동 우선 레이아웃과 용어 정리
- [x] 오류/빈 결과/로딩 분리
- [x] tabs/dialog/focus 접근성
- [x] 뉴스 production/minified build와 최초 진입 lazy loading
- [ ] 뉴스 외 view 단위 lazy loading
- [ ] 모바일 분석 master-detail
- [ ] Portfolio 수동 추가/수정/삭제 UI

검증 기록: 데스크톱 1440x1000과 모바일 390x844에서 겹침과 가로 넘침을 확인했다. 다른 viewport와 키보드 전체 흐름은 후속 검증 범위다.

### 단계 E: 모듈과 문서 정리

- API client, shared UI components, view modules
- providers/features/repositories/jobs 경계 분리
- canonical docs와 ADR 작성
- 과거 작업 로그 archive

완료 기준: 기준 문서에서 현재 API, 데이터, 정책, 보안 모드, 테스트 방법을 한 번에 찾을 수 있다.

## 11. 이번 감사에서 바로 수정하지 않은 항목

이 문서 작성과 함께 compact navigation/hero, 데스크톱 분석 작업 구조, Portfolio presentation·용어·배치, 접근성, 뉴스 loading/build를 포함한 1차 UI 재설계를 수행했다. 인증, 저장소 전환, 서버 모듈 분리, 뉴스 외 view lazy loading, 모바일 분석 master-detail, Portfolio 수동 CRUD는 아직 수행하지 않았다. 기존 런타임 JSON/JSONL 수정 상태도 보존했다.
