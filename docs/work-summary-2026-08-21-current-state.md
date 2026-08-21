# 2026-08-21 현재 구현 체크포인트

- 기준일: 2026-08-21
- 범위: 2026-08-19 커밋 이후 Portfolio 구현, 스윙 엔진 보정, 스윙 UI 통합과 현재 작업 트리
- 목적: 7월 문서 이후 실제 코드에 추가된 동작과 아직 남은 경계를 구분한다.

## 현재 구현

### Portfolio 기술 상태

`src/services/portfolio/technicalSetup.ts`가 중장기 보유종목의 최근 일봉을 다음 기준으로 판독한다.

- 최소 40거래일 데이터
- SMA20의 5일 기울기
- 현재가의 SMA20 이격
- 최근 20일 박스 폭
- 최근 10일 저점의 이전 10일 저점 방어 여부

네 조건을 모두 통과하면 `READY`, 두 개 이상이면 `FORMING`, 그보다 적으면 `WAIT`, 데이터가 부족하면 `UNAVAILABLE`다. 이 상태는 규칙 평가와 Recovery Plan에 전달되며, 20일 저점 아래 2% 수준의 기술 무효가도 함께 제공한다.

중요한 경계:

- 현재 기술 판독 대상은 `LONG_TERM` 보유종목이다.
- 기술 `READY`는 독립된 최종 매수 신호가 아니다.
- 최신 추천 이력, 계좌 예산, 행동 가능한 시세, 고정 무효가 등 기존 Recovery 안전 조건을 계속 통과해야 한다.

### 수익 종목 관리

수익 구간의 보유종목에는 다음 매도 계획을 계산한다.

- 현재가와 평단을 함께 고려한 3단계 목표가
- 전체 보유수량을 세 단계로 나눈 매도 수량
- 평단과 현재가를 기준으로 한 수익보호 가격

현재 작업 트리에서는 과거 스윙 손실 종료 이력이 있어도 실제 보유 손익이 수익으로 전환된 경우 `SWING_RECOVERED`로 분리한다. 이 상태는 Recovery 추가매수 대상이 아니라 수익 보호와 급등 지속 여부를 관찰하는 `EXIT_MANAGEMENT` 경로다.

### OCR

- 로컬 Tesseract 기반 잔고 스크린샷 파서를 보강했다.
- 종목 행과 계좌 요약을 초안으로 반환하고 사용자가 병합 또는 교체 저장 전에 검토한다.
- `npm run verify:portfolio-ocr`로 대표 OCR fixture의 종목·수량·평단·평가금액·계좌 합계를 검증한다.
- 로컬 parser version은 route 기준 `2026-08-19.5`다.

### 스윙 엔진 관찰 범위 보정

기존 lead-in 종가/고가 94% 기준은 그대로 유지했다. 기존 기준을 전체적으로 낮추지 않고, 91~94%의 경계 구간에만 제한적인 seed 관찰 경로를 추가했다.

- 경계 구간은 후속 1~5거래일 안에 추가 상승이 확인되어야 한다.
- 후속 거래량과 거래대금이 정상 유동성 기준을 다시 충족해야 한다.
- 확인된 종목에는 `seed_anchor_confirmed` setup을 부여한다.
- 이 setup은 `watchItems` 가시성만 보장하며 낮은 점수, 품질 감점, 위험·보상 기준을 우회하지 않는다.
- 따라서 관찰 종목이 늘 수는 있지만 `execution_ready`가 자동으로 느슨해지지는 않는다.

한국화장품제조(`003350`)를 현재 데이터로 다시 확인한 결과 기본 기준과 확장 탐색 양쪽에서 관찰 후보로 포착되며, 실행 후보로는 분류되지 않았다. 대략적인 현재 점수는 기본 기준 28점, 확장 탐색 34점 수준이었다. 이번 보정의 목적은 이런 경계 패턴을 놓치지 않고 관찰하는 것이며 즉시 매수 추천으로 승격하는 것이 아니다.

### 두 스윙 엔진과 통합 UI

기존 `default`와 `smallcap` 프로필은 계속 공존한다. 다만 `smallcap`은 실제 시가총액 분류가 아니라 더 짧은 lookback과 다른 거래량·급등 임계값을 사용하는 탐색 프로필이므로 사용자 화면에서는 `확장 탐색`으로 표시한다.

- 기본 기준과 확장 탐색은 각자의 스캔 scope를 유지한다.
- `data/server-swing-picks.json`과 `data/server-smallcap-swing-picks.json` 저장 경계를 유지한다.
- 추천 히스토리의 profile 식별자와 기존 `smallcap` 데이터 호환성을 유지한다.
- 확장 탐색 결과에서 기본 기준과 중복되는 종목을 제외하는 기존 정책을 유지한다.
- 화면에서는 프로필 탭을 제거하고 두 결과를 하나의 스윙 목록과 통합 버킷 카운트로 표시한다.
- 스윙 추천 검색 버튼 한 번으로 두 프로필을 함께 실행한다.
- 카드의 `기본 기준` 또는 `확장 탐색` 배지로 내부 포착 경로를 확인한다.
- 화면에 드러나지 않는 과거 프로필 선택값이 수동 추가에 영향을 주지 않도록 수동 스윙 종목은 기본 프로필로 저장한다.

이 구조는 엔진별 성능 비교와 원복 가능성을 보존하면서 사용자가 동일한 후보 화면을 두 번 확인해야 하는 불편을 없앤다. 후보가 과도하게 늘면 UI를 다시 분리할 필요 없이 확장 탐색 임계값이나 seed 관찰 경로만 조정할 수 있다.

## API와 저장 경계

- Portfolio API는 보유종목 CRUD, advice, quotes, AI 이미지 판독, 로컬 OCR을 제공한다.
- 개발 실행은 `data/development/portfolio`를 Git 추적 원본으로 사용한다.
- 운영은 저장소 밖 `PORTFOLIO_DATA_DIR`만 사용하며 개발 원본과 자동 동기화하지 않는다.
- 추천, 시장 흐름, 알림, Portfolio는 여전히 JSON/JSONL 저장소 중심이다.

## 아직 완료되지 않은 핵심 범위

- 화면에서 직접 보유종목을 추가·수정·삭제하는 CRUD UI
- `capturedAt`과 `uploadedAt` 분리 및 사용자의 실제 계좌 캡처 시각 확인
- 차트 조회를 사용하지 않는 Portfolio quote-only provider
- quote snapshot ID, 거래 세션 기반 stale 판정, 공통 timeout/cache/concurrency
- 독립 `PortfolioExecutionSignal`과 추천 history freshness/policy gate
- Recovery 정책 버전, 거래비용·세금·슬리피지 반영
- Swing·Unknown 보유종목을 최신 기술 신호로 READY 승격하는 승인 정책
- 급등·급락 OHLC 파싱 정확성 복구와 이후 위험 인박스·급변 레이더

## 검증 명령

```bash
npm run check
npm run build
npm run verify:portfolio-recovery
npm run verify:portfolio-ocr
node --check public/app.js
git diff --check
```

2026-08-21 스윙 변경 후 `node --check public/app.js`, `npm run check`, `npm run build`, `git diff --check`를 통과했다. 빌드된 로컬 서버에서도 기존 스윙 프로필 탭이 제공되지 않고 통합 검색 코드와 `확장 탐색` 배지가 제공되는 것을 확인했다. 당시 자동 브라우저 런타임은 사용할 수 없어 클릭 기반 시각 검증은 수행하지 않았다.

## 작업 트리 주의

2026-08-21 확인 시 런타임 JSON/JSONL과 Portfolio 소스가 함께 수정된 dirty worktree다. 문서 작업이나 후속 커밋에서 다음 원칙을 지킨다.

- 런타임 데이터 변경을 문서 변경과 함께 정리하거나 되돌리지 않는다.
- `public/app.js`, `src/services/portfolio/rules.ts`, `src/services/portfolio/types.ts`, `src/scripts/verifyPortfolioRecovery.ts`의 현재 사용자 변경을 보존한다.
- 커밋 전에는 파일 전체 stage보다 diff와 hunk를 확인한다.
