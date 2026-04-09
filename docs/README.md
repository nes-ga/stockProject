# 프로젝트 문서 안내

`docs` 폴더는 현재 구현 문서와 엔진 문서를 분리해서 관리하기 위한 공간입니다.

## 현재 상태 문서

- [현재 구현된 기능 정리](./current-implemented-features.md)
  - 현재 코드 기준으로 실제 살아 있는 기능만 정리한 문서
  - 서버, 프론트, 엔진, 알림, 저장 방식까지 포함

## 엔진 문서

- [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
  - `matched`와 `actionable` 차이
  - 스윙 후보 저장 정책
  - 튜닝 시 먼저 봐야 할 필터
  - 안전 점검 체크리스트

- [장기 엔진 설계 문서](./long-term-engine-design.md)
  - 장기 엔진의 목적
  - 어떤 종목을 보고 어떤 종목을 제외할지
  - 점수 체계와 결과 분류 방향

## 추천 읽기 순서

1. [현재 구현된 기능 정리](./current-implemented-features.md)
2. [스마트머니 유지보수 가이드](./smart-money-maintenance.md)
3. [장기 엔진 설계 문서](./long-term-engine-design.md)

## 문서 관리 원칙

- 루트 `README.md`
  - 프로젝트 입구 문서
  - 빠른 시작, 주요 스크립트, API 개요만 유지

- `docs/current-implemented-features.md`
  - 현재 구현 기준 사실 정리
  - 기능 추가/삭제 시 같이 갱신

- 엔진 문서
  - 설계 의도, 튜닝 포인트, 운영 주의사항 중심으로 유지
