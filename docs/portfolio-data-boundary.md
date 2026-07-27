# Portfolio 데이터 원본 경계

기준일: 2026-07-27

Portfolio의 보유종목과 계좌 요약은 반드시 같은 디렉터리를 하나의 원본으로 사용합니다. 두 파일을 서로 다른 위치에서 읽거나, 개발 원본과 운영 원본을 동시에 합치지 않습니다.

## 현재 개발 원본

`npm run dev`는 아래 Git 개발 디렉터리만 읽고 저장합니다.

```text
data/development/portfolio/
├─ portfolio-holdings.json
└─ portfolio-account.json
```

화면에는 실제 설정에서 받은 다음 정보가 표시됩니다.

```text
포트폴리오 데이터 원본
Git 개발 데이터
data/development/portfolio
Git 추적 · 개발 전용
```

이 JSON은 개발 편의를 위해 의도적으로 Git 추적 대상입니다. 개인 보유 정보가 들어가므로 비공개 저장소에서만 사용해야 합니다. 한 번 commit/push하면 이후 파일 삭제나 `.gitignore` 추가만으로 Git 과거 기록에서 없어지지 않습니다.

## 원본 선택 규칙

| 모드 | 원본 | Git | 용도 |
|---|---|---|---|
| `repository-development` | `data/development/portfolio` 고정 | 추적 | 현재 개발 |
| `private-local` | `data/private/portfolio` 또는 저장소 밖 `PORTFOLIO_DATA_DIR` | 제외 | 로컬 비공개·운영 |

- `NODE_ENV=production`이 아닌 개발 실행은 시작 명령과 관계없이 `repository-development`를 기본 선택합니다.
- 로컬에서 private 원본을 시험하려면 `PORTFOLIO_DATA_MODE=private-local`을 명시합니다.
- 운영 환경(`NODE_ENV=production`)은 저장소 밖 절대경로 `PORTFOLIO_DATA_DIR`이 없으면 시작하지 않습니다.
- 운영 환경은 `repository-development` 모드로 시작할 수 없습니다.
- 폐기된 `PORTFOLIO_HOLDINGS_PATH`는 account와 경로가 갈라지는 것을 막기 위해 허용하지 않습니다.

운영 설정 예:

```env
NODE_ENV=production
PORTFOLIO_DATA_MODE=private-local
PORTFOLIO_DATA_DIR=D:\stockmon-private\portfolio
```

화면과 API에는 운영 서버의 실제 절대경로를 노출하지 않고 `저장소 외부 비공개 경로`라고만 표시합니다.

## 자동 왕복 금지

다음 규칙은 유지해야 합니다.

1. 한 번에 하나의 원본만 활성화한다.
2. 모든 GET·POST·PUT·DELETE는 현재 선택된 동일 원본만 읽고 쓴다.
3. 파일이 없거나 읽기에 실패해도 다른 원본으로 자동 fallback하지 않는다.
4. Git 개발 원본과 private 원본을 자동 복사, 병합, 미러링, 양방향 동기화하지 않는다.
5. private 원본의 변경을 Git 개발 원본으로 역기록하지 않는다.
6. seed/bootstrap이 필요해도 명시적인 수동 1회 이전으로만 수행한다.

보유종목 파일이 없으면 빈 보유 목록, 계좌 파일이 없으면 계좌 정보 없음으로 처리합니다. 이는 다른 경로를 찾는 fallback이 아닙니다.

## 운영으로 옮길 때

자동 전환 코드를 만들지 않고 아래 순서를 수동으로 진행합니다.

1. 서버를 중지한다.
2. 저장소 밖 private 디렉터리를 만든다.
3. 개발 원본의 holdings와 account를 한 번만 복사한다.
4. 원본과 복사본의 파일 수, 크기, 체크섬이 같은지 확인한다.
5. `PORTFOLIO_DATA_MODE=private-local`과 저장소 밖 절대경로를 설정한다.
6. 서버를 다시 시작하고 화면의 `비공개 로컬 데이터 · Git 제외` 표시를 확인한다.
7. private 원본에서 읽기와 저장이 정상인지 확인한 뒤 현재 revision의 Git 개발 JSON을 제거한다.
8. 이미 remote에 push했다면 Git 과거 기록 정리는 별도 보안 작업으로 판단한다.

계좌 스크린샷 원본, 증권사 인증정보, API 키, 세션 값은 개발 JSON 디렉터리에 저장하거나 Git에 올리지 않습니다.
