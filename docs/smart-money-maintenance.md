# Smart Money 유지보수 가이드

기준일: 2026-05-08
최근 갱신: 2026-06-29

## 핵심 원칙

스윙 엔진에서 가장 중요한 구분은 다음입니다.

- `matched`: 패턴 품질이 기준을 넘었다.
- `actionable`: 지금 실행 가능한 상태다.
- `execution_ready`: 실제 실행 후보다. 사용자 화면의 `진입 가능`은 이 상태만 사용한다.
- `execution_probe`: 내부 caution/check-later 상태다. 사용자 화면과 payload 읽기에서는 관찰로 취급한다.
- `watch`: 관찰할 가치는 있으나 아직 실행 후보는 아니다.

이 구분을 흐리면 초기 watch setup이 실행 후보로 섞입니다.

## 주요 파일

- `src/services/smartMoneyEngine.ts`
  - setup/breakout 후보 생성
  - 점수, 상태, staged buy plan, stop-loss, risk/reward 산출
  - `swingVolumeProfile` 반영
- `src/services/smartMoney/config.ts`
  - threshold와 기본 필터
- `src/services/smartMoney/utils.ts`
  - 공통 계산 유틸
- `src/services/smartMoney/marketContext.ts`
  - 시장 context 생성
- `src/services/recommendationUniverse.ts`
  - universe scan 결과 bucket 분류와 저장
- `src/services/tradingHalts.ts`
  - 거래정지 사유 분류
- `src/services/volumeProfile.ts`
  - 스윙 매물대 분석

## 실행 가능 상태 기준

setup 후보는 SMA20 기반 1차 매수 구간이 활성화되어야 실제 실행 후보로 봅니다.

실무 해석:

- `matched=true`여도 너무 이르면 실행 후보가 아닙니다.
- `buy_ready`이고 현재가가 staged entry zone 안에 있을 때만 첫 매수 검토 대상으로 봅니다.
- universe scan 결과는 `execution_ready`, `execution_probe`, `watch`로 분리합니다.
- `execution_probe`는 매수 후보가 아니라 확인 후보입니다. 사용자 화면과 서버 payload 읽기에서는 관찰로 취급합니다.
- `entry_zone_pending`, `execution_gate_not_cleared`, `long_pullback_until_stop_probe`는 매수가 도달 신호가 아닙니다.

## Bucket 기준

### execution_ready

- 엔진이 이미 실행 가능하다고 판단한 상태
- `pattern.stage === "setup"`
- `pattern.status === "buy_ready"`
- `referenceClose`가 `entryZoneLow`와 `entryZoneHigh` 사이에 있음
- 시장 국면 gate 통과
- risk/reward와 유효기간 조건 통과
- 거래량, 캔들, 지지 안정성, 거래정지 패널티가 치명적이지 않음

### execution_probe

- 과거 호환용 중간 상태입니다. 신규 화면에서는 매수 후보가 아니라 관찰/확인 후보로 봅니다.
- 이미 `buy_ready`와 entry zone은 충족했지만 히스토리 승률 가드가 주의 신호를 낸 경우에만 내부적으로 남을 수 있습니다.
- entry zone에 아직 닿지 않은 probe는 반드시 `watch`로 내려야 합니다.
- 대표 사유:
  - `weak_volume_contraction`
  - `weak_candle_structure`
  - `sma20_slope_negative`
  - `unstable_support`
  - `risk_reward_thin`
  - `halt_penalty_active`

### watch

- 패턴은 보이나 실행 시점이 아니거나 품질이 낮은 상태
- 대표 tag:
  - `watch_extended_leader`
  - `watch_pullback_pending`
  - `watch_low_quality`
  - `watch_halt_event`
  - `watch_halt_structural`

## 진입 가능 오분류 방지 규칙

2026-06-29에 `execution_probe`가 `executionItems` 안에 저장되어 사용자 화면의 `진입 가능` 탭에 노출되는 문제가 확인됐습니다. 실제 reason은 `entry_zone_pending`이었으므로 매수가 상태가 아니라 관찰 상태였습니다.

재발 방지 규칙:

- `executionItems`에 들어갈 수 있는 것은 `execution` 또는 `execution_ready`뿐입니다.
- `execution_probe`는 저장 파일의 `executionItems` 배열에 있더라도 읽는 즉시 `watchItems`로 분리합니다.
- 프론트 `resolveSwingBucket()`도 `execution_probe`를 `execution`으로 해석하면 안 됩니다.
- `pattern.actionable` 단독으로 실행 후보를 만들면 안 됩니다. 반드시 `setup`, `buy_ready`, `withinEntryZone`을 함께 확인해야 합니다.
- `stop_valid_extended_pullback`, `long_pullback_until_stop_probe`, `wide_pullback_candidate`는 후보 visibility를 유지하는 이유이지 매수 승격 이유가 아닙니다.

확인된 사례:

- 기본 스윙: GS글로벌, 서울반도체
- 소형 스윙: GS건설, OCI

관련 코드:

- `src/services/recommendationUniverse.ts`: `classifySwingCandidate`
- `src/services/serverSwingPicks.ts`: `shouldTreatAsSwingExecution`, `toSwingWatchPick`, `buildServerSwingPickPayload`
- `public/app.js`: `resolveServerSwingBucket`, `resolveSwingBucket`

## 체결 케이스 유지 원칙

이미 매수가 터치되어 히스토리 체결 가정이 생긴 스윙 케이스는 새 universe scan에서 신선한 패턴으로 다시 잡히지 않았다는 이유만으로 종료하면 안 됩니다.

핵심 규칙:

- 체결된 기존 케이스는 손절가를 종가 기준으로 깨기 전까지 최소 `watchItems`에 유지합니다.
- `executionItems`에서 `watchItems`로 내려가는 것은 강등이지 종료가 아닙니다.
- 종료는 실제 종료 조건이 있을 때만 허용합니다.
- 실제 종료 조건은 손절가 이탈, 목표 수익률 도달, 완만 상승 종료, 명시적 수동 제거입니다. 근거 없는 보유 기간 만료는 사용하지 않습니다.
- 단, KOSPI/KOSDAQ 급락으로 시장 충격이 확인된 날의 손절가 이탈은 `market_shock_grace`로 1거래일 유예하고, 다음 확인에서도 회복하지 못하면 `market_shock_stop`으로 종료합니다.
- 새 스캔에서 `no_pattern`이 되거나 품질 gate를 통과하지 못해도, 손절가 위에 있고 목표 종료가 아니면 `history-carry-forward` watch 후보로 보존합니다.
- 보존 후보에는 `carry_forward_until_stop`, `above_stop` reason을 남깁니다.
- 현재 추천 상태 UI는 매수 후보만 보여야 하므로 `watchItems`를 숨길 수 있지만, 히스토리 생명주기 판단에서는 `watchItems`를 현재 케이스로 봐야 합니다.

대표 사례:

- `펄어비스`처럼 평균 매수가 이후 새 스캔에서 패턴이 사라졌더라도, 종가가 손절가보다 위이고 목표 수익률도 확정되지 않았다면 종료 케이스가 아니라 관찰 유지 케이스입니다.

수정 위치:

- `src/services/recommendationHistory.ts`: `readSwingCarryForwardCases`, `shouldCarryForwardSwingCase`
- `src/services/recommendationUniverse.ts`: `carryForwardWatchItems` 병합

## 스윙 최초 기준 고정 원칙

스윙 후보가 한 번 히스토리 체결 케이스가 되면 매수가, 손절가, 최초 판정 노트는 최초 유효 스윙 판단 기준으로 고정합니다. 이후 universe scan에서 SMA20, 전저점, envelope, 점수가 바뀌어도 기존 체결 케이스의 기준 가격을 새 스캔 값으로 덮어쓰면 안 됩니다.

핵심 규칙:

- 매수 시작은 최초 스윙 엔진 기준의 SMA20 부근 1차 매수가에서 시작합니다.
- 손절가는 최초 판정 당시 정한 전저점 또는 엔진 invalidation 기준으로 고정합니다.
- 2차/3차 매수가는 최초 노트에 `매수 a/b/c`가 있으면 그 값을 그대로 사용합니다.
- 최초 노트가 `구간 high~low`만 가진 경우에만 1차를 SMA20/구간 상단 근처로 두고, 손절가와의 risk band 안에서 2차/3차를 산출합니다.
- 이미 체결된 케이스는 이후 `pattern.buyPlan`, `pattern.invalidationPrice`, 최신 SMA20로 매수계획을 재계산하지 않습니다.
- 서버 픽, 히스토리, 화면 오버레이는 모두 히스토리의 `buyPlan`과 `initialStopLossPrice`를 우선합니다.
- 신규 히스토리 케이스 생성 시 현재 서버 픽보다 `data/discord-alert-history.jsonl`의 최초 스윙 알림을 먼저 기준으로 확인합니다.

주의할 사례:

- 레이 `228670`: 2026-04-09 계열의 최초 엔진 판단을 기준으로 1차 매수는 약 7,900원대 SMA20 부근이어야 합니다. 최신 하락 후 SMA20로 되돌리면 안 됩니다.
- 오픈베이스 `049480`: 레이와 같은 방식으로 최초 기준의 SMA20/손절가를 유지합니다.
- 삼륭물산 `014970`: 최초 스윙 판정 시 전저점 5,390원이 손절 기준이면 이후 유예/종료 표시는 이 가격을 기반으로 해야 합니다.

수정 위치:

- `src/services/recommendationHistory.ts`: `initialSnapshot`, `initialStopLossPrice`, `parseBuyPlan`, `readInitialSwingAlertSnapshots`
- `src/services/recommendationUniverse.ts`: `preserveEnteredHistoryPlan`, `replaceSwingNoteBuyPlan`
- `public/app.js`: 히스토리 노트의 매수계획을 화면 오버레이에서 우선 표시

## 히스토리 분할매수 추적 원칙

히스토리 케이스가 한 번 열렸다면 현재 스캔 bucket이 `execution`에서 `watch`로 내려가도 분할매수 체결 체크는 계속해야 합니다. `watch`는 실행 후보에서 관찰 후보로 내려간 상태일 뿐이고, 이미 열린 케이스의 1차/2차/3차 매수가 터치 여부를 중단하는 신호가 아닙니다.

핵심 규칙:

- 신규 `watch` 후보는 히스토리 케이스를 열지 않습니다.
- 이미 열린 히스토리 케이스는 미체결 상태여도 현재 후보 화면에 계속 보여야 합니다.
- 열린 케이스의 `buyPlan`은 최초 기준으로 고정하고, 이후 최신 일봉 경로를 고정 매수가와 대조해 `executedBuys`를 갱신합니다.
- 현재 서버 픽 payload에 `postEntryOutcome`이 없더라도, 히스토리 갱신 시 Naver 일봉 경로를 재생해 1차/2차/3차 터치 여부를 다시 계산합니다.
- 화면은 `watch`로 내려간 히스토리 케이스도 `closed` 전까지 현재 추적 목록에 표시해야 합니다.

대표 사례:

- 삼성에스디에스 `018260`: 2026-06-18에 열린 케이스가 2026-06-23 스캔에서 `watch`로 내려갔지만, 최초 고정 매수가 `242000/210500/177800` 기준 현재 일봉 경로는 2차 매수가까지 터치했습니다. 따라서 `executedBuyCount=2`, 평균 매수가 `221000`으로 유지해야 하며, `watch` 강등만으로 미체결/숨김 처리하면 안 됩니다.

수정 위치:

- `src/services/recommendationHistory.ts`: `inferExecutedBuysFromMarketPath`, `mergeExecutedBuysByStage`, `refreshCaseMarketPrice`, `buildCurrentHistoryCase`
- `public/app.js`: `shouldDisplayCurrentRecommendationCandidate`

## 히스토리 진단 필드

스윙 히스토리는 단순 승패 기록이 아니라 다음 검색 때 승률 조건을 조정할 수 있는 진단 로그로 유지합니다. 기존 `data/recommendation-history/swing-history.json` 케이스도 읽기/갱신 시 가능한 범위에서 아래 필드를 재구성합니다.

추가 필드:

- `decisionSnapshot`: 히스토리가 열린 당시 또는 현재 재계산 가능한 판단 근거입니다. `score`, `bucket`, `tags`, `reasons`, `penaltyFactors`, `envelope`, `referenceSma20`, `signalSummary`를 모아 이후 승률 분석의 조건 키로 씁니다.
- `stagedBuyDiagnostics`: 1차/2차/3차 분할매수 단계별 상태입니다. 각 단계의 계획가, 체결 여부, 체결일, 현재가 대비 위치, 손절가까지의 여유를 저장합니다. 3차 매수는 단순 저가 터치만으로 공격하지 않고 `confirmation_required` 상태로 별도 검증 대상으로 둡니다.
- `outcomeDiagnostics`: 현재까지의 결과 요약입니다. 평균 매수가, 현재가, 미실현 수익률, 최대 유리/불리 가격 경로, 현재 outcome을 같이 저장해 어떤 조건 조합이 수익/손실로 이어졌는지 집계할 수 있게 합니다.

복원 한계:

- 기존 케이스의 `score`, `sma20`, 매수가, 손절가처럼 노트/플랜에 남아 있는 값은 재구성합니다.
- 과거 알림에 `penaltyFactors`나 `envelope` 메타데이터가 없었던 케이스는 해당 필드를 비워 둡니다. 없는 값을 임의 추정하지 않습니다.
- 현재 검색 결과에 다시 잡힌 종목은 최신 후보의 `penaltyFactors`와 `envelope`을 보강해 저장합니다.

## 히스토리 승률 가드

스윙 검색 엔진은 검색 시작 시 `swing-history.json`의 종료 케이스를 읽어 조건별 승률 가드를 만듭니다. 이 가드는 후보를 새로 만드는 기준이 아니라, 이미 잡힌 후보의 실행 강도를 낮추는 보수 필터입니다.

반영 방식:

- `historyOutcome.category`가 `profit` 또는 `loss`인 종료 케이스만 표본에 넣습니다. 미체결 제외, 진행 중 케이스는 승패 통계에서 제외합니다.
- `decisionSnapshot`의 tag/reason/penalty/envelope, 점수 구간, 실제 도달한 분할매수 단계를 조건 키로 묶습니다.
- 표본 4건 이상, 손실률 65% 이상, 평균 수익률이 음수인 조건은 `history_loss_cluster`로 보고 실행 후보에서 `watch`로 낮춥니다.
- 표본 3건 이상, 손실률 55% 이상인 약한 조건은 `history_win_rate_caution`으로 보고 `execution_ready`를 `execution_probe`로 낮춥니다.
- 현재 히스토리 기준 대표 손실 우위 조건은 `envelope_lower_break`, `sma20_slope_negative`, `probe_demoted_low_score_unstable_support`, `quality_not_ready`입니다.

3차 매수 확인 정책:

- 1차/2차는 기존처럼 일봉 저가가 매수가를 터치하면 체결로 봅니다.
- 3차는 저가 터치만으로 체결하지 않습니다. 3차 가격 터치 후 종가가 3차 매수가를 회복하고, 양봉 또는 전일 대비 종가 회복이 있어야 합니다.
- 3차 확인 시점의 종가는 손절가 대비 최소 6% 이상 여유가 있어야 합니다.
- 3차 매수가와 손절가 사이에서 가격이 오가면 `thirdBuyMonitor.status=waiting_reclaim`으로 두고, 3차 비중 4는 평균 매수가에 넣지 않습니다.
- 손절가까지 밀리면 `thirdBuyMonitor.status=stop_zone`으로 두고, 3차 매수보다 손절/시장충격 유예 판단을 우선합니다.
- 현재가가 3차 매수가의 1% 이내 또는 그 아래에 있는데 확인이 부족하면 `third_buy_confirmation_required`, `third_buy_not_confirmed`, `execution_blocked_by_deep_entry_policy` reason을 남기고 watch로 낮춥니다.
- `waiting_reclaim` 또는 `confirmation_required` 상태에서 기간 중 고가가 2차 평균 매수가 기준 목표 수익률을 충족하면 `deep_zone_rebound_exit`로 종료합니다. 이때 3차는 미체결로 유지하고, 2차 평균 기준 슈팅 수익으로 통계에 넣습니다.
- `deep_zone_rebound_exit`는 손절 판정보다 먼저 적용합니다. 딥존에서 목표 슈팅이 나온 순간 수익 청산으로 케이스를 닫고, 이후 종가가 손절가 아래로 내려가도 손절 종료로 뒤집지 않습니다.
- 3차 터치 후 5거래일 이상 3차 가격을 회복하지 못하면 `deep_zone_timeout_exit`로 위험 종료합니다. 장기 체류 케이스를 계속 현재 후보로 끌고 가지 않기 위한 방어 규칙입니다.

## Watch 후보와 히스토리 승격 금지

`watch`는 관찰군이지 체결 통계 대상이 아닙니다. watch 후보에 `postEntryOutcome`이 있더라도, 그것만으로 신규 히스토리 체결 케이스를 열면 안 됩니다.

히스토리 체결로 열 수 없는 대표 조건:

- `bucket === "watch"`이고 기존 히스토리 케이스가 없음
- `watch_low_quality` 태그가 있음
- `quality_not_ready` reason이 있음
- `envelope_lower_break` reason이 있음
- 저점이 시뮬레이션 매수가를 터치했더라도 최초부터 watch-only였음

대표 사례:

- 와이어블 `065530`: 2026-06-01 최초 알림부터 `watch`, `envelope_lower_break`, `quality_not_ready`였습니다. 이 종목은 실행 후보나 체결 히스토리로 승격하지 않고 관찰 후보로만 유지해야 합니다.

수정 위치:

- `src/services/recommendationUniverse.ts`: 낮은 점수와 불안정 지지를 가진 긴 눌림이 `long_pullback_until_stop`만으로 `execution_probe`로 승격되지 않게 분류
- `src/services/recommendationHistory.ts`: 기존 케이스 없는 watch 후보는 히스토리를 새로 열지 않음

## 매물대 반영 원칙

스윙 매물대는 BUY를 공격적으로 늘리는 지표가 아닙니다.

반영 방식:

- 위 매물 부담, 리테스트 실패, 제한적 reward/risk는 강하게 감점합니다.
- 돌파 안착, 눌림 지지 품질은 보조적으로만 가산합니다.
- 양수 매물대 점수는 `patternScore`를 직접 올리지 않습니다.
- 양수 매물대 점수는 `finalRankScore`에 최대 +8 수준의 ranking support로만 반영합니다.
- 음수 매물대 점수는 `patternScore`, `regimeAdjustedScore`, `finalRankScore`에 리스크 조정으로 반영합니다.

중요 필드:

- `pattern.swingVolumeProfile`
- `volumeProfileAnalysis.swing`
- `advancedVolumeProfile.dynamicBinSize`
- `advancedVolumeProfile.rewardRiskRatio`
- `advancedVolumeProfile.profileReliability`
- `advancedVolumeProfile.retestSuccessScore`
- `advancedVolumeProfile.retestFailureRisk`

## 매물대 해석 체크리스트

- 현재가 바로 위 2~5% 구간에 두꺼운 매물이 있으면 추격 위험을 높입니다.
- 주요 매물대를 돌파했더라도 리테스트 실패가 있으면 감점합니다.
- 아래 3~8% 구간에 지지 매물이 있고 pullbackScore가 좋으면 눌림 품질을 보조 가산합니다.
- `profileReliability`가 낮으면 모든 가산 해석을 축소합니다.
- 시장 국면이 약하면 매물대 구조가 좋아도 신뢰도를 낮춥니다.

## 거래정지 처리

거래정지는 blanket exclusion이 아닙니다.

- `critical`: 제외
- `structural`: 제외
- `event`: 패널티 후 허용
- `technical`: watch-only
- `other`: 기본 보수 처리

## 설명 가능성 필드

저장 후보는 다음 필드를 유지해야 합니다.

- `reasons`
- `tags`
- `penaltyFactors`
- `debugMeta`
- `swingVolumeProfile`

이 필드는 UI와 디버깅 표면의 일부입니다.

## 튜닝 위치

느슨한 후보가 너무 많으면 먼저 `src/services/smartMoney/config.ts`를 봅니다.

우선 확인할 값:

- `minSetupPullbackSessions`
- `maxSetupPullbackDrawdownPercent`
- `maxSetupPullbackRangePercent`
- `pullbackBuyStartPercentFromPeak`
- `firstBuySma20ProximityPercent`
- `setupValidityMin`
- `setupExecutionMin`
- `breakoutValidityMin`
- `breakoutExecutionMin`
- `executionReadyRiskRewardMin`
- `executionProbeRiskRewardMin`

ranking은 맞는데 포함/제외가 문제라면 threshold를 보고, 포함/제외는 맞는데 순위만 이상하면 `finalRankScore`와 penalty weighting을 봅니다.

## 안전 수정 체크리스트

변경 후 실행:

```bash
npm run check
npm run build
npx tsx src/scripts/verifyVolumeProfile.ts
```

스윙 universe를 건드렸다면:

```bash
npm run scan:swing-universe
```

확인 항목:

- `execution_ready`에 실행 가능한 setup만 남는가
- `execution_probe`가 clean execution 또는 `진입 가능`처럼 보이지 않는가
- `watchItems`가 너무 느슨해지지 않았는가
- 매물대 양수 점수만으로 BUY가 승격되지 않는가
- 위 매물/리테스트 실패가 제대로 감점되는가
- event halt는 보이되 penalty가 유지되는가
- 시장 충격일 손절 이탈은 1거래일만 유예되고, 회복 실패 시 `market_shock_stop`으로 닫히는가

## 최근 반영

- 2026-04-14: `execution_ready`, `execution_probe`, `watch` bucket 구조 정리
- 2026-05-08: 스윙 매물대 분석 추가
- 2026-05-08: 매물대 양수 가산을 BUY 직접 승격에서 제외하고 ranking support로 보수화
- 2026-06-01: 시장 충격 손절 유예와 `market_shock_grace`/`market_shock_stop` outcome 추가
- 2026-06-17: 스윙 최초 기준 고정, watch 후보의 체결 히스토리 승격 금지, 와이어블 watch-only 기준 명문화
- 2026-06-23: 열린 히스토리 케이스는 `watch` 강등 후에도 현재 목록에 표시하고, 고정 `buyPlan` 기준 분할매수 체결을 계속 재계산하도록 보정
- 2026-06-29: `execution_probe`를 사용자 화면과 payload 읽기에서 관찰로 취급하도록 보정

## 3차 조정 매수 정책

- 3차 매수가는 무조건 고정 대기하지 않습니다. 원래 3차 매수가와 손절가 사이에서 가격이 오래 머물 때, 지수 안정성과 종목 바닥 다짐이 확인되면 `adjustedThirdBuyPrice`를 산출해 3차 매수가를 현재 확인된 바닥 가격으로 낮춥니다.
- 실시간 검색 엔진 기준: `riskOff !== true`, `marketContextScore >= 50`, `regimeScore >= 45`, 시장 모멘텀이 `weak`가 아니어야 합니다.
- 종목 바닥 다짐 기준: `supportStabilityScore >= 65`, `volumeContractionScore >= 55`, `candleQualityScore >= 55`, 엔벨로프가 `below_lower`가 아니어야 합니다.
- 가격 안전 기준: 조정 3차가는 손절가보다 높고 2차 매수가보다 낮아야 하며, 현재 종가 기준 손절가까지 최소 6% 이상 여유가 있어야 합니다.
- 히스토리 재생 기준: 원래 3차가 아래로 내려온 뒤 최근 3거래일 저점이 손절가 위에서 유지되고, 양봉 또는 전일 대비 종가 회복이 나오면 해당 일자의 종가를 `adjustedThirdBuyPrice`로 기록합니다.
- JSON에는 원래 3차가를 `originalThirdBuyPrice`, 조정 3차가를 `adjustedThirdBuyPrice`, 조정 근거를 `thirdBuyAdjustment`와 `thirdBuyMonitor.adjustmentReason`에 남깁니다. 이후 3차 체결, 평균 매수가, 슈팅/손절 종결은 조정 3차가 기준으로 계산합니다.
