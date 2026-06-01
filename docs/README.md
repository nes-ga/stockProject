# 문서 인덱스

이 디렉터리는 StockMon Dashboard의 현재 구조, 엔진 설계, 유지보수 기준, 작업 연혁을 정리합니다. 기존 문서 중 깨진 한글 문서는 2026-05-08 기준 코드 상태에 맞춰 UTF-8 문서로 다시 정리했습니다.

## 먼저 볼 문서

1. [현재 구현 기능](./current-implemented-features.md)
2. [프로젝트 개요](./project-overview-2026-04-27.md)
3. [프로젝트 연혁](./project-history.md)
4. [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
5. [중장기 엔진 설계](./long-term-engine-design.md)

## 주제별 문서

- [현재 구현 기능](./current-implemented-features.md): API, UI, 엔진, 데이터 저장소, 검증 명령 요약
- [프로젝트 개요](./project-overview-2026-04-27.md): 전체 아키텍처와 주요 파일 지도
- [스마트머니 유지보수 가이드](./smart-money-maintenance.md): 스윙 엔진, bucket, actionable 기준, 매물대 반영 원칙
- [중장기 엔진 설계](./long-term-engine-design.md): 장기 후보 선정 철학과 점수 구조
- [차트 이슈 조사](./chart-investigation-2026-04-30.md): 비거래일/공휴일 공백과 `open=0` 해석
- [Discord 알림 히스토리 기준](./discord-alert-history-policy-2026-05-22.md): 실제 발송 알림의 JSONL 메타데이터 저장 기준
- [뉴스 시그널 대상 기준](./news-signal-policy-2026-05-22.md): 대표종목 + 현재 후보 기반 뉴스 감지 대상 확장 기준

## 작업 기록

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

- [2026-06-01 시장충격 손절 유예/삼륭물산 히스토리 보정](./work-summary-2026-06-01.md)
- [2026-05-15 스윙 엔진/후보 정리](./work-summary-2026-05-15.md)
- [2026-05-22 Discord 알림 히스토리 기준](./discord-alert-history-policy-2026-05-22.md)
- [2026-05-22 뉴스 시그널 대상 기준](./news-signal-policy-2026-05-22.md)`r`n- [2026-05-27 스윙 히스토리 carry-forward 정책](./work-summary-2026-05-27.md)
- [2026-05-27 스윙 히스토리 정리](./work-summary-2026-05-27-history-cleanup.md)
