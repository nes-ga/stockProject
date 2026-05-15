# 2026-05-15 Work Summary

오늘 작업은 스윙/소형 스윙 엔진의 매수 후보 판정 기준을 차트 구조 중심으로 다시 정리하고, 현재 후보 목록과 히스토리가 같은 기준을 쓰도록 맞춘 작업입니다.

## Swing Buy-Candidate Decision Flow

스윙 엔진이 종목을 매수 후보로 둘 때의 흐름은 다음 순서입니다.

1. 프로필을 결정한다.
   - 기본 스윙은 기본 필터를 사용한다.
   - 소형 스윙은 더 짧은 lookback 창과 더 강한 거래량 조건을 사용한다.
   - 소형 스윙 조건: `lookbackWindows = 20/30/45/60/75`, 선행 거래량 비율 2.5배 이상, 선행 거래량 50만주 이상, 급등 진행률 10% 이상.

2. 전체 종목에서 스캔 대상을 추린다.
   - KOSPI/KOSDAQ만 대상으로 한다.
   - 거래정지/상폐성 제외 종목은 제거한다.
   - 소형 스윙은 기본 스윙에 이미 잡힌 종목을 중복 제외한다.

3. 종목별 차트와 시장 데이터를 불러온다.
   - 기준일을 정한다.
   - 필요한 일봉 구간을 로드한다.
   - KOSPI/KOSDAQ 지수 컨텍스트를 같이 적용한다.
   - 거래정지 정보를 조회한다.

4. 스마트머니 패턴 엔진에 진입한다.
   - 기준일의 SMA20을 계산한다.
   - ENV20 상단/중심/하단을 계산한다.
   - 최근 저점 기반 손절 후보를 계산한다.
   - 시장 컨텍스트로 점수와 임계값을 보정한다.

5. 여러 lookback 창을 순회한다.
   - 프로필별 `lookbackWindows` 안에서 후보 구조를 탐색한다.
   - 각 창 안에서 선행수급 날짜 후보를 하나씩 훑는다.

6. 선행수급 후보를 검증한다.
   - 가격 변화율
   - 20일 평균 대비 거래량
   - 절대 거래량
   - 거래대금
   - 캔들 품질
   - 선행수급이 약하면 바로 탈락한다.

7. 급등 피크를 확인한다.
   - 선행수급 뒤 며칠 안에 충분한 상승이 나왔는지 확인한다.
   - 소형 스윙은 최소 급등 진행률 10% 이상을 사용한다.

8. 급등 후 눌림 구조를 확인한다.
   - 눌림 기간이 최소 조건 이상인지 본다.
   - 급등 대비 눌림 깊이가 적절한지 본다.
   - 박스 지지형인지, 피벗 재돌파형인지 판단한다.

9. 선행수급 전 박스 모양을 확인한다.
   - 수급이 들어오기 전 박스가 압축되어 있었는지 본다.
   - 기본 박스 변동폭 한도는 35%다.
   - 같은 구간의 KOSPI/KOSDAQ이 크게 흔들린 경우 시장 충격분만큼 한도를 완화한다.
   - 이 보정은 삼륭물산처럼 지수 쇼크 때문에 박스가 흔들린 케이스를 살리기 위한 것이며, 종목 자체가 무너진 박스는 계속 탈락한다.

10. 손절가와 매수가를 산정한다.
    - 최근 눌림 저점 또는 구조적 기준 저점으로 손절가를 잡는다.
    - 긴 눌림이면 손절가가 과도하게 아래로 꼬이지 않도록 구조 기준을 다시 비교한다.
    - SMA20 근처 기준으로 1/2/3차 매수가를 계산한다.

11. 품질 점수를 계산한다.
    - 거래량 감소
    - 지지 안정성
    - SMA20 기울기
    - 손익비
    - ENV20 위치
    - 시장 보정 점수
    - 최종 `finalRankScore`

12. 위험과 사후 체결 상태를 보강한다.
    - 위험 점수를 계산한다.
    - 과열/위험이면 actionable을 낮춘다.
    - 매수가 터치 여부로 `postEntryOutcome`을 계산한다.
    - 이미 목표수익을 준 종목은 매수 후보에서 제외한다.

13. 가장 좋은 패턴 하나를 선택한다.
    - 상태 좋은 것
    - actionable
    - matched
    - breakout over setup
    - `finalRankScore`
    - `patternScore`

14. 최종 후보 bucket을 분류한다.
    - `execution_ready`: 엔진 기준 매수 준비 완료 + 품질 양호
    - `execution_probe`: 품질 약점은 있지만 매수 후보로 볼 구조가 있음
    - `watch`: 관찰 후보

15. 현재 후보와 히스토리를 저장한다.
    - `execution_ready`와 `execution_probe`만 현재 매수 후보로 취급한다.
    - 기본 스윙은 `data/server-swing-picks.json`에 저장한다.
    - 소형 스윙은 `data/server-smallcap-swing-picks.json`에 저장한다.
    - 히스토리는 `executionItems`만 현재 후보로 반영한다.

## Engine Changes

### Pre-Lead Base Shape Filter

선행수급 전 박스가 압축된 형태인지 확인하는 필터를 추가했다.

- 기본 박스 변동폭 한도: 35%
- 하락 추세가 너무 강하면 탈락
- 변동성 큰 세션이 많으면 탈락
- 오이솔루션, 대명에너지처럼 급등 전 바닥 횡보 구조가 아닌 종목을 후보에서 걸러내기 위한 기준

### Market-Index Adjustment

선행수급 전 박스가 흔들린 이유가 종목 자체가 아니라 지수 충격인지 확인하도록 KOSPI/KOSDAQ 일봉을 시장 컨텍스트에 추가했다.

- 같은 기간 KOSPI/KOSDAQ 변동폭이 20% 이상이면 시장 충격으로 본다.
- 일간 급변동이 8% 이상이어도 시장 충격으로 본다.
- 박스 변동폭 한도는 최대 8%p까지 완화한다.
- 삼륭물산은 2026-03-04 전후 지수 급락/반등 구간과 겹쳐 이 보정으로 `execution_probe`에 복귀했다.

### Failed Post-Spike Pullback Exclusion

짧은 급등 뒤 바로 무너진 구조는 매수 후보에서 제외하도록 했다.

제외 조건:

- setup이 `support_holding_pullback`
- 눌림 기간이 8세션 이하
- 눌림 깊이가 18% 이상
- 현재가가 breakout level 대비 -20% 이하
- 현재가가 선행 박스 대비 -6% 이하

이 경로는 `failed_post_spike_pullback_shape`, `not_base_compression_shape`, `exclude_from_swing_candidates` reason으로 남긴다.

### Long Pullback Until Stop Policy

기존 원칙인 “매수 후보 이후 손절가 전까지 긴 눌림은 후보로 유지”를 분류 단계에도 반영했다.

- broad review eligible
- 눌림 8세션 이상
- ENV20 상단 과열이 아님
- 현재가가 손절/무효화선 위

위 조건이면 `long_pullback_until_stop_probe` reason으로 `execution_probe`에 올릴 수 있다.

### Stop-Loss Reference Fix

긴 눌림에서 손절가가 너무 아래로 꼬이는 문제를 줄였다.

- 일반 눌림 저점 손절 기준과 선행 박스 구조 기준을 비교한다.
- 긴 눌림이면 더 높은 구조적 손절 기준을 우선 사용할 수 있다.
- 아이티아이즈처럼 1월 수급 기준이면 손절가가 4000원대였어야 하는 케이스를 교정하기 위한 방향이다.

## Candidate List Impact

현재 저장된 실행 후보는 총 12개다.

기본 스윙 실행 후보 9개:

- SK증권 `001510`
- 경보제약 `214390`
- 라닉스 `317120`
- 시공테크 `020710`
- 태림포장 `011280`
- 제이오 `418550`
- SK오션플랜트 `100090`
- 흥국화재 `000540`
- 삼륭물산 `014970`

소형 스윙 실행 후보 3개:

- HC보광산업 `225530`
- 필에너지 `378340`
- 씨아이에스 `222080`

주요 판정 변화:

- 삼륭물산: 지수 충격 보정 후 `execution_probe` 복귀
- 흥국화재: 같은 보정과 긴 눌림 기준으로 `execution_probe` 복귀
- 제이오: 손절가 전 긴 눌림 원칙으로 `execution_probe` 유지
- 씨아이에스/SK오션플랜트: 긴 눌림 후보 유지
- 대명에너지: 차트 모양 문제로 종료/제외
- 오이솔루션: 매수 후보 차트 축에서 제외
- 아이즈비전: 현재 엔진 기준 `no_pattern`/pre-lead range 과다로 탈락 유지
- 시공테크/필에너지: 히스토리 현재 후보 누락 문제 수정 후 유지

## History and UI Changes

### Recommendation History

히스토리는 현재 매수 후보를 `executionItems` 기준으로만 읽도록 정리했다.

- watch 후보는 현재 매수 후보 히스토리로 넣지 않는다.
- 기존 히스토리 케이스는 보존한다.
- 대명에너지는 현재 후보/히스토리 현재 케이스에서 제거됐다.
- 시공테크와 필에너지는 현재 후보 히스토리에 다시 반영됐다.

현재 히스토리 요약:

- 현재 실행 후보: 12개
- 현재 체결 가정 후보: 12개

### Chart Refresh

차트 깜빡임을 줄이기 위해 전체 화면 갱신 대신 차트 중심으로 갱신하도록 조정했다.

- 실시간 갱신은 `chartOnly` 모드 사용
- 차트 데이터 signature가 같으면 재설정하지 않음
- 마지막 봉만 바뀌는 경우 `series.update()` 사용
- 종목 selector 전체 재렌더 대신 가격 라인만 갱신

## Files Changed

Core engine:

- `src/services/smartMoneyEngine.ts`
- `src/services/recommendationUniverse.ts`
- `src/services/smartMoney/marketContext.ts`
- `src/types.ts`

History:

- `src/services/recommendationHistory.ts`
- `data/recommendation-history/swing-history.json`

UI:

- `public/app.js`

Current data:

- `data/server-swing-picks.json`
- `data/server-smallcap-swing-picks.json`
- `data/recommendation-universe-alert-state.json`

## Verification

Executed:

```bash
npm.cmd run check
node --check public/app.js
```

Result:

- TypeScript check passed.
- `public/app.js` syntax check passed.
- Current default swing execution count: 9
- Current smallcap swing execution count: 3
- Current total execution candidates: 12
