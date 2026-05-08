# Smart Money 유지보수 가이드

기준일: 2026-05-08

## 핵심 원칙

스윙 엔진에서 가장 중요한 구분은 다음입니다.

- `matched`: 패턴 품질이 기준을 넘었다.
- `actionable`: 지금 실행 가능한 상태다.
- `execution_ready`: 실제 실행 후보에 가깝다.
- `execution_probe`: 진입권에 가까우나 품질 gate가 부족하다.
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
- `buy_ready`에 가까울 때만 첫 매수 검토 대상으로 봅니다.
- universe scan 결과는 `execution_ready`, `execution_probe`, `watch`로 분리합니다.
- `execution_probe`는 매수 후보가 아니라 확인 후보입니다.

## Bucket 기준

### execution_ready

- 엔진이 이미 실행 가능하다고 판단한 상태
- 시장 국면 gate 통과
- risk/reward와 유효기간 조건 통과
- 거래량, 캔들, 지지 안정성, 거래정지 패널티가 치명적이지 않음

### execution_probe

- SMA20 기반 진입 구간에 근접했지만 품질 gate가 부족한 상태
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
- `execution_probe`가 clean execution처럼 보이지 않는가
- `watchItems`가 너무 느슨해지지 않았는가
- 매물대 양수 점수만으로 BUY가 승격되지 않는가
- 위 매물/리테스트 실패가 제대로 감점되는가
- event halt는 보이되 penalty가 유지되는가

## 최근 반영

- 2026-04-14: `execution_ready`, `execution_probe`, `watch` bucket 구조 정리
- 2026-05-08: 스윙 매물대 분석 추가
- 2026-05-08: 매물대 양수 가산을 BUY 직접 승격에서 제외하고 ranking support로 보수화
