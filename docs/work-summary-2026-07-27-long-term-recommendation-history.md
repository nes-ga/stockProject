# 2026-07-27 중장기 추천 히스토리 작업 체크포인트

이 문서는 중장기 추천 히스토리 작업을 Git으로 분리하기 위한 체크포인트입니다. 이 시점까지 실제 중장기 전체 스캔은 실행하지 않았으며, 운영 `long-term-history.json`은 빈 초기 상태(`cases: 0`, `appliedScans: 0`, `asOfDate: null`)입니다.

## 구현된 범위

- 기존 `data/server-long-term-picks.json` 배열 형식과 기존 GET 응답을 유지했습니다.
- 기존 swing history v1 파일, reader, GET API, UI 계약을 변경하지 않았습니다.
- `data/recommendation-history/long-term-history.json` schema v2를 별도 파일로 추가했습니다.
- 전체 `LongTermScanCandidate`가 남아 있는 자동 스캔 경계에서만 중장기 history를 필수 저장합니다.
- 공식 케이스는 최초 `accumulate` 또는 직접 `buy`에서 시작하며 `watch`만 있는 신규 후보는 건너뜁니다.
- `current`, `stale`, `closed`를 분리했습니다. 전체 스캔에서 한 번 사라진 상태는 `stale`이며 자동 손절 또는 자동 종료가 아닙니다.
- 종료는 명시적 close만 허용하고, 종료 뒤 같은 종목이 다시 actionable이 되면 다음 `cycleNo`를 만듭니다.
- 최초 추천 가격과 최초 판단 snapshot은 불변으로 보존하고 최신 관찰 가격/snapshot은 별도로 갱신합니다.
- 매수 예산과 분할매수 정책은 아직 확정하지 않아 `policyStatus: "pending"`과 `null` 금액으로 저장합니다.
- 내용 digest, occurrence scan ID, `appliedScans` ledger로 직전 동일 스캔 재시도를 no-op 처리합니다.
- 같은 날 `A → 없음 → A`, 명시 종료 뒤 재등장, 동일 close ID의 상충 payload를 구분합니다.
- 실제 달력에 없는 날짜, 시간 역행 scan/close, 중복 symbol, 잘못된 candidate group/type/label, 비정상 숫자를 저장 전에 거부합니다.
- `scanCompleteness`와 current pick provenance를 scan identity에 포함했습니다.
- 새 history cycle이 시작되면 이전 current pick의 `anchorDate`와 `bucketEnteredDate`가 이어지지 않도록 새 기준일 override를 반환합니다.
- 중장기 엔진이 종목별 차트/재무 조회 실패 건수를 반환합니다.
- 자동 전체 스캔은 한 종목이라도 실패하거나 universe가 비어 있으면 fail-closed로 끝나며 current/history를 바꾸지 않습니다.
- history가 비어 있는 최초 commit도 기존 current 추천의 최신 기준일보다 과거면 거부합니다.
- 저장 순서는 `current lock → 최신 current 재조회 → history 필수 저장 → current atomic publish`입니다.
- 공용 JSON writer에 프로세스 내 queue, cross-process lock, heartbeat, 임시 파일 검증, atomic rename을 적용했습니다.
- 알림 상태는 preview 후 Discord 전송과 감사 로그가 성공해야 commit하며 category fingerprint CAS로 오래된 preview의 덮어쓰기를 막습니다.
- 손상돼 있던 ignored runtime 파일 `data/recommendation-universe-alert-state.json`은 유효 JSON으로 복구했지만 Git 대상에는 포함하지 않습니다.

## 추가된 검증

- `src/scripts/verifyLongTermRecommendationHistory.ts`
  - watch-only, accumulate→buy, stale/reobserve, 반복 stale
  - 동일 scan 재시도, 과거 scan/같은 날 시간 역행
  - `A → 없음 → A`
  - 주말 close 뒤 이전 거래일 기준 데이터 재등장
  - close ID payload 충돌
  - 종료 뒤 새 cycle과 날짜 reset
  - completeness/currentPicks identity 충돌
  - partial symbol scope와 incomplete full scan
  - invalid calendar date/candidate 및 저장 JSON semantic corruption
- `src/scripts/verifyLongTermRecommendationCommit.ts`
  - history 실패 시 current byte 보존
  - history 성공/current 실패 뒤 멱등 재시도
  - current read-modify-write 동시성
  - partial/빈 scan 차단
  - 최초 bootstrap 날짜 역행 차단과 동일 날짜 허용
- `src/scripts/verifyRecommendationUniverseAlerts.ts`
  - 전송 전 상태 무변경
  - 실패 재시도 diff 보존
  - category별 동시 commit 보존
  - 같은 category의 오래된 preview CAS 거부

체크포인트 직전 검증 결과:

```text
npm.cmd run check
PASS

tsx src/scripts/verifyLongTermRecommendationHistory.ts
{"ok":true,"caseCount":3,"eventCount":8,"appliedScanCount":8}

tsx src/scripts/verifyLongTermRecommendationCommit.ts
{"ok":true,"historyFailurePreservedCurrent":true,"retryDeduplicatedHistory":true,"concurrentCurrentCount":2,"partialScanPreservedCurrentAndHistory":true,"staleInitialCommitPreservedCurrentAndHistory":true,"sameDateCommitAllowed":true}

tsx src/scripts/verifyRecommendationUniverseAlerts.ts
{"ok":true,"retryPreservedDiff":1,"finalLongTermCount":1}
```

## 아직 남은 범위

1. `LongTermScanCandidate`에는 개별 후보 가격의 실제 거래일 `priceDate`가 없습니다. 현재 scan `asOfDate`도 유동성 순위 첫 종목의 최신일을 사용하므로, 종목별 최신 거래일이 다르면 snapshot의 공통 기준일과 실제 가격 기준일이 어긋날 수 있습니다. 이 항목은 다음 작업에서 먼저 보강해야 합니다.
2. `closeLongTermRecommendationHistoryCase`는 service와 검증에만 있고 운영 route/job에는 아직 연결하지 않았습니다. 따라서 현재 운영 자동 흐름만으로는 case가 자연 종료되지 않습니다.
3. 구조/재무 thesis 종료 조건, 정기 review, time expiry, 연장 횟수는 정책 미확정입니다.
4. 총 매수 예산, accumulate/buy allocation cap, tranche 계획과 실제 체결 writer는 아직 없습니다.
5. 기존 `POST /analysis/server-long-term-picks`는 full decision snapshot이 없어 current만 쓰고 history를 건너뜁니다. 완전한 history 원장이 필요한 운영에서는 자동 전체 스캔만 사용해야 합니다.
6. history 저장 뒤 current publish 전에 프로세스가 종료되면 history가 current보다 앞설 수 있습니다. 동일 스캔 재시도로 복구할 수 있지만 journal 기반 자동 reconciliation은 아직 없습니다.
7. Discord 전달은 at-least-once입니다. 일부 메시지 전송 뒤 후속 단계가 실패하면 재시도에서 중복 전달될 수 있습니다.

## Git으로 분리할 파일

중장기 history 작업에 해당하는 파일은 아래와 같습니다.

```text
.gitignore
data/recommendation-history/long-term-history.json
docs/README.md
docs/recommendation-history-json-design.md
docs/work-summary-2026-07-27-long-term-recommendation-history.md
src/lib/jsonFile.ts
src/routes/analysisRoutes.ts
src/scripts/scanUniverseLongTermPicks.ts
src/scripts/verifyLongTermRecommendationCommit.ts
src/scripts/verifyLongTermRecommendationHistory.ts
src/scripts/verifyRecommendationUniverseAlerts.ts
src/services/longTermEngine.ts
src/services/longTermRecommendationHistory.ts
src/services/recommendationUniverse.ts
src/services/recommendationUniverseAlerts.ts
src/services/serverLongTermPicks.ts
src/types.ts
```

현재 worktree에는 Portfolio, UI, runtime JSON 등 다른 작업도 섞여 있습니다. 특히 `src/types.ts`, `src/routes/analysisRoutes.ts`, `docs/README.md`처럼 같은 파일에 다른 작업이 있을 수 있으므로 통파일 stage보다 `git add -p`로 hunk를 확인해야 합니다.

아래 runtime/user 데이터는 이 작업 commit에 포함하지 않습니다.

```text
data/recommendation-history/swing-history.json
data/server-long-term-picks.json
data/server-swing-picks.json
data/server-smallcap-swing-picks.json
data/discord-alert-history.jsonl
data/market-flow/*
public/*
src/services/portfolio/*
```

권장 분리 순서:

```powershell
git switch -c feat/long-term-recommendation-history
git add -- .gitignore data/recommendation-history/long-term-history.json docs/recommendation-history-json-design.md docs/work-summary-2026-07-27-long-term-recommendation-history.md src/lib/jsonFile.ts src/scripts/scanUniverseLongTermPicks.ts src/scripts/verifyLongTermRecommendationCommit.ts src/scripts/verifyLongTermRecommendationHistory.ts src/scripts/verifyRecommendationUniverseAlerts.ts src/services/longTermEngine.ts src/services/longTermRecommendationHistory.ts src/services/recommendationUniverse.ts src/services/recommendationUniverseAlerts.ts src/services/serverLongTermPicks.ts
git add -p -- docs/README.md src/routes/analysisRoutes.ts src/types.ts
git diff --cached --check
git diff --cached
git commit -m "feat: add safe long-term recommendation history"
```

위 명령은 참고용이며 이 체크포인트에서는 branch 생성, stage, commit을 실행하지 않았습니다.
