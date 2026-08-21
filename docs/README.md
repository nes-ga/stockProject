# 문서 인덱스

이 디렉터리는 StockMon Dashboard의 현재 구조, 엔진 설계, 유지보수 기준, 작업 연혁을 정리합니다. 현재 구현 기준일은 2026-08-21입니다. 날짜별 작업 요약은 당시 snapshot을 보존하고, 계획·설계 문서는 상단 `Last updated`와 상태를 기준으로 계속 갱신합니다.

## 먼저 볼 문서

1. [현재 구현 기능](./current-implemented-features.md)
2. [2026-08-21 현재 구현 체크포인트](./work-summary-2026-08-21-current-state.md) — Portfolio, 스윙 엔진 보정, 스윙 UI 통합
3. [2026-07-27 고도화 실행 계획](./project-enhancement-execution-plan-2026-07-27.md)
4. [프로젝트 개선 제안서](./project-improvement-proposal-2026-07-13.md)
5. [프로젝트 개요](./project-overview-2026-04-27.md)
6. [프로젝트 연혁](./project-history.md)
7. [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
8. [중장기 엔진 설계](./long-term-engine-design.md)
9. [추천 히스토리 JSON 경계와 스키마 초안](./recommendation-history-json-design.md)
10. [Portfolio 데이터 원본 경계](./portfolio-data-boundary.md)

## 주제별 문서

- [현재 구현 기능](./current-implemented-features.md): API, UI, 엔진, 데이터 저장소, 검증 명령 요약
- [2026-08-21 현재 구현 체크포인트](./work-summary-2026-08-21-current-state.md): Portfolio 기술 상태·OCR과 스윙 seed 관찰 경로·통합 UI 작업 요약
- [2026-07-27 고도화 실행 계획](./project-enhancement-execution-plan-2026-07-27.md): Portfolio 실행 안전성, quote-only 시세, 급변 레이더, 위험 인박스, 성과 검증의 구현 순서와 완료 조건
- [프로젝트 개선 제안서](./project-improvement-proposal-2026-07-13.md): 구현 완료, 부분 완료, 후속 개선 범위와 우선순위
- [프로젝트 개요](./project-overview-2026-04-27.md): 전체 아키텍처와 주요 파일 지도
- [Portfolio Manager 작업 계획](./work-plan-2026-07-08-portfolio-manager.md): Portfolio 규칙, OCR, RecoveryPlan 계획과 진행 상태
- [Portfolio 데이터 원본 경계](./portfolio-data-boundary.md): 개발용 Git 원본, 운영용 private 원본, 자동 왕복 금지와 수동 이전 절차
- [스마트머니 유지보수 가이드](./smart-money-maintenance.md): 스윙 엔진, bucket, actionable 기준, 매물대 반영 원칙
- [스윙 눌림 후보 정책](./swing-pullback-policy-2026-05-11.md): long pullback visibility와 execution 승격 금지 기준
- [중장기 엔진 설계](./long-term-engine-design.md): 장기 후보 선정 철학과 점수 구조
- [추천 히스토리 JSON 경계와 스키마 초안](./recommendation-history-json-design.md): 추천 관련 JSON 역할, 공통/스윙/중장기 경계, 가격·금액·종료 이벤트와 마이그레이션 기준
- [차트 이슈 조사](./chart-investigation-2026-04-30.md): 비거래일/공휴일 공백과 `open=0` 해석
- [Naver 지수 분봉 조사](./naver-index-intraday-investigation-2026-06-02.md): KOSPI/KOSDAQ Naver 지수 분봉 endpoint 조사 기록
- [Discord 알림 히스토리 기준](./discord-alert-history-policy-2026-05-22.md): 실제 발송 알림의 JSONL 메타데이터 저장 기준
- [뉴스 시그널 대상 기준](./news-signal-policy-2026-05-22.md): 대표종목 + 현재 후보 기반 뉴스 감지 대상 확장 기준

## 작업 기록

- [2026-08-21 현재 구현 체크포인트](./work-summary-2026-08-21-current-state.md)
- [2026-07-27 중장기 추천 히스토리 체크포인트](./work-summary-2026-07-27-long-term-recommendation-history.md)
- [2026-07-13 UI 작업 요약](./work-summary-2026-07-13-ui-refresh.md)
- [2026-04-10 작업 요약](./work-summary-2026-04-10.md)
- [2026-04-13 작업 요약](./work-summary-2026-04-13.md)
- [2026-04-14 작업 요약](./work-summary-2026-04-14.md)
- [수정 파일 요약](./modified-files-summary.md)
- [프로젝트 연혁](./project-history.md)

## 문서 관리 원칙

- 코드와 다른 설명은 제거하고 현재 동작 기준으로 작성합니다.
- 사용자에게 보이는 용어는 UI/JSON 필드명과 최대한 맞춥니다.
- 엔진 점수는 “매수 신호”와 “보조 해석”을 구분해서 적습니다.
- 날짜별 변화는 `project-history.md`에 누적하고, 설계 원칙은 각 엔진 문서에 유지합니다.
- 문서는 UTF-8로 저장합니다.

## Recent Work

- [2026-08-21 Portfolio 기술 판독·매도 계획·OCR, 스윙 엔진 보정·통합 UI 체크포인트](./work-summary-2026-08-21-current-state.md)
- [2026-07-27 중장기 추천 히스토리 체크포인트](./work-summary-2026-07-27-long-term-recommendation-history.md)
- [2026-07-27 Portfolio Recovery 이후 고도화 실행 계획](./project-enhancement-execution-plan-2026-07-27.md)
- [2026-07-13 UI shell, 캐릭터, 접근성, Portfolio, 뉴스 번들 개선](./work-summary-2026-07-13-ui-refresh.md)
- [2026-06-30 스윙 추천 히스토리 Cycle/Recovery 구조 정리](./work-summary-2026-06-30-swing-history-cycle.md)
- [2026-06-29 스윙 `execution_probe` 오분류 보정](./smart-money-maintenance.md#진입-가능-오분류-방지-규칙)
- [2026-06-01 시장충격 손절 유예/삼륭물산 히스토리 보정](./work-summary-2026-06-01.md)
- [2026-06-02 Naver 지수 분봉 조사](./naver-index-intraday-investigation-2026-06-02.md)
- [2026-05-15 스윙 엔진/후보 정리](./work-summary-2026-05-15.md)
- [2026-05-22 Discord 알림 히스토리 기준](./discord-alert-history-policy-2026-05-22.md)
- [2026-05-22 뉴스 시그널 대상 기준](./news-signal-policy-2026-05-22.md)
- [2026-05-27 스윙 히스토리 carry-forward 정책](./work-summary-2026-05-27.md)
- [2026-05-27 스윙 히스토리 정리](./work-summary-2026-05-27-history-cleanup.md)
