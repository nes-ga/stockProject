# 프로젝트 연혁

이 문서는 주요 변경을 날짜 순서로 정리합니다.

## 2026-04-10

뉴스/이벤트/인코딩 기반 정리.

- Naver Search API 기반 뉴스 시그널 수집 구조 추가
- 뉴스 시그널 React 대시보드 번들 구조 정리
- 이벤트 캘린더 JSON payload와 `GET /analysis/market-event-calendar` 추가
- 이벤트 캘린더 UI와 상세 modal 추가
- Naver Finance HTML decoding 경로 점검
- `npm run check`, `npm run build` 검증

관련 문서:

- [2026-04-10 작업 요약](./work-summary-2026-04-10.md)

## 2026-04-13

추천 화면, 시장 감시, 스윙 저장 구조 정리.

- 추천 카테고리를 `중장기`, `배당`, `스윙` 중심으로 정리
- 주봉/월봉 anchor line 정렬 개선
- 시장 감시 대상에 BTC 포함
- 서울 기준 fetch date 표시 정리
- 스윙 universe 저장 payload를 `executionItems`, `watchItems`, `items`로 정리
- `matched`와 `actionable` 의미 분리

관련 문서:

- [2026-04-13 작업 요약](./work-summary-2026-04-13.md)

## 2026-04-14

스윙 스마트머니 엔진 유지보수성 강화.

- setup/breakout threshold 분리
- 시장 국면 기반 threshold 조정
- `execution_ready`, `execution_probe`, `watch` bucket 정리
- 거래정지 사유별 처리 추가
- `reasons`, `tags`, `penaltyFactors` 설명 가능성 필드 정리

관련 문서:

- [2026-04-14 작업 요약](./work-summary-2026-04-14.md)
- [스마트머니 유지보수 가이드](./smart-money-maintenance.md)

## 2026-04-27

프로젝트 전체 구조 문서화.

- 서버/API/프론트/엔진 구조를 한 문서로 정리
- 스윙, 중장기, 배당, 시장 감시, 뉴스, 이벤트 캘린더 역할 구분
- JSON 저장소 한계와 외부 데이터 의존성 정리

관련 문서:

- [프로젝트 개요](./project-overview-2026-04-27.md)

## 2026-04-30

차트 공백/비거래일 이슈 조사.

- `open=0` 단독으로는 비거래 candle로 보지 않는다는 점 확인
- OHLCV 전체 zero row만 비거래/거래정지 point로 판단
- 공휴일/비거래일을 억지로 채우는 방식이 차트 형태를 왜곡할 수 있음을 문서화

관련 문서:

- [차트 이슈 조사](./chart-investigation-2026-04-30.md)

## 2026-05-08

매물대 분석 엔진 고도화와 문서 재정리.

### 매물대 공통 모듈

- `src/services/volumeProfile.ts` 추가
- 일봉 OHLCV 기반 volume profile 계산
- ATR(14) 기반 동적 binSize
- 시간감쇠 가중치
- 몸통 중심 거래량 배분
- gap vacuum zone 기록과 배분 보정
- 거리감쇠 위/아래 매물 계산
- POC와 Value Area High/Low
- 리테스트 성공/실패
- 다음 지지/저항과 reward/risk
- profileReliability와 warning 제공

### 스윙 엔진 통합

- `swingVolumeProfile` 추가
- 60일/120일 매물대 분리
- 추격 위험, 돌파 신뢰도, 눌림 지지 품질 산출
- 매물대 양수 가산은 BUY 직접 승격에서 제외
- 매물대 음수 점수는 리스크 감점으로 반영

### 중장기 엔진 통합

- `longTermVolumeProfile` 추가
- 240일/480일/720일 매물대 분리
- 장기 바닥권 누적, 박스권 돌파, 장기 위 매물 부담, 고점권 정체, 보유 품질 평가
- `volumeProfileScore`를 중장기 totalScore에 보조 반영
- `structuralBreakoutReliability` 추가

### UI/JSON 확장

- `volumeProfileAnalysis` 추가
- `advancedVolumeProfile` 추가
- 스윙/중장기 카드에 매물대 패널 추가
- 장기 후보 표에 매물대 보조점수 추가

### 차트 보정

- 공휴일/비거래일을 강제로 whitespace point로 채우던 흐름 제거
- 실제 거래 데이터 중심으로 chart series 구성

### 검증

실행 완료:

```bash
npm run check
npm run build
node --check public/app.js
npx tsx src/scripts/verifyVolumeProfile.ts
npx tsx src/scripts/checkVolumeProfileImpact.ts
```

실제 후보 영향 샘플:

- 스윙 `시공테크`: 위 매물/리테스트 실패로 `volumeProfileScore -20`
- 스윙 `레이`: 매물대 구조는 좋지만 BUY 직접 승격 없이 ranking support로 제한
- 중장기 `퍼스텍`: 장기 박스권 돌파와 구조 신뢰도로 강한 보조 점수
- 중장기 `기업은행`: 장기 바닥권 누적과 보유 품질 양호
- 중장기 `엔씨소프트`: 장기 박스권 돌파 실패 리스크 반영

## 현재 방향

- 스윙은 “진입 타이밍과 리스크 관리” 중심
- 중장기는 “구조적 우위와 보유 품질” 중심
- 매물대는 단독 매수 신호가 아니라 보조 판단 지표
- BUY 후보를 공격적으로 늘리기보다 리스크 해석을 강화
