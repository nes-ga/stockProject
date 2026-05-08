# 작업 요약 2026-04-14

## 범위

스마트머니/스윙 엔진의 threshold, bucket, 거래정지 처리, 설명 가능성 필드를 정리한 작업입니다.

## 스마트머니 엔진

추가/정리한 threshold:

- `setupValidityMin`
- `setupExecutionMin`
- `breakoutValidityMin`
- `breakoutExecutionMin`

시장 국면 반영:

- bull market에서는 breakout gate를 일부 완화할 수 있습니다.
- bear market에서는 setup gate를 보수화할 수 있습니다.

진입 anchor:

- SMA20을 setup entry의 primary anchor로 유지합니다.
- alternative anchor는 정보 tag로만 사용합니다.

대표 tag:

- `tag_alt_anchor_pivot_retest`
- `tag_alt_anchor_box_support`
- `tag_alt_anchor_shallow_pullback`

## 품질 보정

거래량:

- 절대 거래량과 거래대금 threshold 유지
- 최근 평균 대비 turnover 품질 반영
- 저가주 raw share count 과대평가 방지

캔들:

- 윗꼬리 rejection
- 종가 위치
- 몸통 비율
- gap rejection

## Bucket 분류

스윙 후보 bucket:

- `execution_ready`
- `execution_probe`
- `watch`

해석:

- `execution_ready`: 실제 실행 후보에 가까운 상태
- `execution_probe`: 진입권 근처지만 품질 gate가 부족한 상태
- `watch`: 관찰 대상

## 거래정지 처리

거래정지 사유를 단일 제외가 아니라 category/action으로 분리했습니다.

- `critical` -> `exclude`
- `structural` -> `exclude`
- `event` -> `allow_with_penalty`
- `technical` -> `watch_only`

## 설명 가능성

저장 후보에 다음 필드를 유지합니다.

- `reasons`
- `tags`
- `penaltyFactors`
- `haltCategory`
- `haltAction`

이 필드는 UI/debug 표면의 일부이므로 제거하면 안 됩니다.

## 검증

실행:

```bash
npm run build
node dist/scripts/scanUniverseSwingPicks.js
```

당시 live 결과:

- `execution_ready`: 0
- `execution_probe`: 1
- `watch`: 19

## 후속 영향

이 작업에서 정리한 bucket/설명 가능성 구조는 2026-05-08 매물대 분석 통합에서도 그대로 유지했습니다.
