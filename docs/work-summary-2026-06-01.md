# 2026-06-01 Work Summary

오늘 작업은 지수 급락장에서 스윙 손절을 바로 확정하지 않도록 시장충격 유예 장치를 추가하고, 삼륭물산이 히스토리 화면에서 누락되던 문제를 정리한 작업입니다.

## 배경

지수가 무너지는 날에는 개별 종목의 차트 실패가 아니라 시장 베타 때문에 스윙 종목들이 손절가를 동시에 이탈할 수 있습니다.

기존 구조는 종가가 손절가 이하이면 바로 `stop_broken`으로 닫았습니다. 이 방식은 정상장에서는 명확하지만, KOSDAQ 급락 같은 시장 충격일에는 가짜 손절 또는 과도한 종료가 생길 수 있습니다.

## 확정 정책

- 손절가를 영구 하향하지 않습니다.
- 시장충격일 손절가 이탈은 `market_shock_grace`로 1거래일 유예합니다.
- 다음 확인에서도 손절가를 회복하지 못하면 `market_shock_stop`으로 종료합니다.
- 일반 손절과 시장충격 손절은 히스토리 outcome에서 구분합니다.
- 유예는 현재 as-of date의 손절 이탈에만 적용하고, 과거 종료 케이스를 다시 살리지 않습니다.

시장충격 감지 기준:

- KOSPI 또는 KOSDAQ 1일 하락률이 -2% 이하
- KOSPI/KOSDAQ 동반 하락의 평균 1일 하락률이 -1.8% 이하
- KOSPI/KOSDAQ 평균 3일 하락률이 -3.5% 이하
- KOSPI/KOSDAQ이 20일선 아래이고 평균 5일 하락률이 -4% 이하

## 구현

`src/services/recommendationHistory.ts`:

- `market_shock_grace`, `market_shock_stop` outcome 추가
- KOSPI/KOSDAQ chart 기반 시장충격 context 계산 추가
- 손절가 이탈 케이스에 `marketStopGrace` 상태 저장
- `getEffectiveLifecycleStatus`에서 active grace 케이스는 `current`로 유지
- 손절 판정을 목표수익 판정보다 우선하도록 순서 보정
- `readSwingRecommendationHistory()`에서도 market grace를 재계산해 화면 API가 최신 상태를 반영하도록 보정
- 과거 손절 케이스가 새 유예 기준으로 재활성화되지 않도록 as-of date gate 추가

`public/app.js`:

- 히스토리 요약에 `시장충격 유예` 행 추가
- `market_shock_stop`을 손절/손실 그룹으로 분류
- 현재 후보 화면에서 `currentCandidates`와 active history case를 병합
- 현재 후보 JSON에는 없지만 히스토리에서 active로 유지되는 carry-forward/grace 케이스가 화면에서 빠지지 않도록 수정

문서:

- `docs/project-history.md`
- `docs/smart-money-maintenance.md`

## 삼륭물산 확인

문제:

- 삼륭물산 `014970`은 히스토리 데이터에는 있었지만 화면의 현재 히스토리에 보이지 않았습니다.
- 원인은 두 가지였습니다.
  - KOSDAQ -2.30% 하락이 기존 -2.5% 시장충격 기준에 걸리지 않았습니다.
  - UI가 `currentCandidates`가 있으면 `currentCases` fallback을 버려서 active history case를 누락했습니다.

수정 후 상태:

```json
{
  "symbol": "014970",
  "name": "삼륭물산",
  "status": "active",
  "latestClose": 5340,
  "stop": 5620,
  "outcome": "market_shock_grace",
  "grace": "active"
}
```

해석:

- 손절가 `5,620원`을 종가 `5,340원`으로 이탈했습니다.
- 다만 2026-06-01 KOSDAQ이 약 -2.30% 하락해 시장충격 유예로 분류했습니다.
- 다음 확인에서도 손절가를 회복하지 못하면 `market_shock_stop`으로 종료합니다.

## 검증

실행:

```bash
npm.cmd run check
node --check public\app.js
npm.cmd run build
```

결과:

- TypeScript check 통과
- `public/app.js` 문법 검사 통과
- 전체 build 통과

## 주의사항

- 시장충격 유예는 손절 회피가 아니라 1거래일 확인 장치입니다.
- 유예 상태의 종목은 손절가를 회복하지 못하면 다음 갱신에서 종료되어야 합니다.
- 현재 후보 JSON에 없는 active history case도 UI 현재 목록에 보여야 합니다.
