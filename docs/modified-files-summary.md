# 수정 파일 요약

기준일: 2026-05-08

이 문서는 최근 구조 변경이 어느 파일에 반영됐는지 빠르게 확인하기 위한 요약입니다.

## 1. 매물대 분석 고도화

새 파일:

- `src/services/volumeProfile.ts`
- `src/scripts/verifyVolumeProfile.ts`
- `src/scripts/checkVolumeProfileImpact.ts`

수정 파일:

- `src/types.ts`
- `src/services/smartMoneyEngine.ts`
- `src/services/longTerm/strategy.ts`
- `src/services/longTermEngine.ts`
- `src/services/stockAnalysis.ts`
- `public/app.js`

주요 변경:

- `VolumeProfileResult`, `SwingVolumeProfileAnalysis`, `LongTermVolumeProfileAnalysis`, `AdvancedVolumeProfile` 타입 추가
- 스윙 결과에 `swingVolumeProfile` 추가
- 중장기 후보에 `longTermVolumeProfile`과 `volumeProfileScore` 추가
- 최종 분석 JSON에 `volumeProfileAnalysis` 추가
- UI에 스윙/중장기 매물대 패널 추가

## 2. 스윙 엔진 보수화

수정 파일:

- `src/services/smartMoneyEngine.ts`
- `src/services/recommendationUniverse.ts`
- `src/services/smartMoney/config.ts`

주요 변경:

- `execution_ready`, `execution_probe`, `watch` bucket 유지
- 사용자 화면/서버 payload 읽기 기준에서 `execution_probe`는 관찰 후보로 취급하고, `execution_ready`만 진입 가능으로 표시
- 매물대 양수 점수는 `patternScore`를 직접 올리지 않음
- 매물대 음수 점수는 리스크 조정으로 반영
- `finalRankScore`에는 양수 매물대 보조 가산을 제한적으로만 반영

## 3. 중장기 엔진 확장

수정 파일:

- `src/services/longTermEngine.ts`
- `src/services/longTerm/strategy.ts`
- `src/services/longTerm/*Score.ts`
- `src/types.ts`

주요 변경:

- 장기 chart points를 candidate build 단계까지 전달
- 장기 매물대 구조를 `totalScore`에 보조 반영
- 장기 박스권 돌파와 보유 품질 설명 추가

## 4. 차트 공휴일/비거래일 보정

수정 파일:

- `public/app.js`

주요 변경:

- 누락된 평일을 강제로 whitespace point로 채우는 흐름 제거
- 실제 거래 데이터 중심으로 series 구성
- index chart modal 종료일 표시를 실제 chart window 기준으로 정리

## 5. 시장/뉴스/이벤트/저장 후보

주요 파일:

- `src/services/marketWatch.ts`
- `src/services/marketFlowEngine.ts`
- `src/services/marketEventCalendar.ts`
- `src/services/newsSignals.ts`
- `src/services/serverSwingPicks.ts`
- `src/services/serverLongTermPicks.ts`
- `src/services/serverDividendPicks.ts`

역할:

- 시장 지수/자산 snapshot
- 시장 흐름과 테마 로테이션
- 이벤트 캘린더 payload/search
- 뉴스 시그널 dashboard payload
- 저장 후보 read/write

## 6. 문서 정리

수정/추가 문서:

- `README.md`
- `docs/README.md`
- `docs/current-implemented-features.md`
- `docs/project-overview-2026-04-27.md`
- `docs/project-history.md`
- `docs/smart-money-maintenance.md`
- `docs/long-term-engine-design.md`
- `docs/chart-investigation-2026-04-30.md`
- `docs/work-summary-2026-04-10.md`
- `docs/work-summary-2026-04-13.md`
- `docs/work-summary-2026-04-14.md`
- `docs/modified-files-summary.md`

## 7. 검증 명령

```bash
npm run check
npm run build
node --check public/app.js
npx tsx src/scripts/verifyVolumeProfile.ts
```

실제 후보 영향 확인:

```bash
$env:VP_IMPACT_LIMIT='6'; npx tsx src/scripts/checkVolumeProfileImpact.ts
```
