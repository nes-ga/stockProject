# 프로젝트 문서 안내

`docs` 폴더는 현재 구현 상태 문서와 엔진 유지보수 문서를 분리해서 관리하는 공간입니다.

## 현재 상태 문서

- [현재 구현된 기능 정리](./current-implemented-features.md)
  - 현재 코드 기준으로 실제 들어와 있는 기능만 정리한 문서
  - 서버, 프론트, 엔진, 알림, 저장 방식까지 포함
- [작업 요약 2026-04-13](./work-summary-2026-04-13.md)
  - 추천 탭, 기준일 가격선, market-watch 날짜 처리, 스윙 저장 정책 보정 사항

## 엔진 문서

- [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
  - `matched` 와 `actionable` 차이
  - 스윙 후보 저장 정책
  - 어떤 값을 먼저 조절해야 하는지에 대한 운영 기준
- [장기 엔진 설계 문서](./long-term-engine-design.md)
  - 장기 엔진 목적
  - 평가 기준과 제외 조건
  - 결과 분류 방향

## 추천 읽기 순서

1. [현재 구현된 기능 정리](./current-implemented-features.md)
2. [작업 요약 2026-04-13](./work-summary-2026-04-13.md)
3. [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
4. [장기 엔진 설계 문서](./long-term-engine-design.md)

## 문서 관리 원칙

- `README.md`
  - 프로젝트 입구 문서
  - 빠른 시작, 주요 스크립트, API 개요 중심
- `docs/current-implemented-features.md`
  - 현재 구현 사실 정리
  - 기능 추가/삭제 시 함께 갱신
- `docs/work-summary-2026-04-13.md`
  - 최근 유지보수성 변경과 동작 보정 기록
- 엔진 문서
  - 설계 의도, 튜닝 포인트, 운영 주의사항 중심
