# Portfolio Git 개발 데이터

이 디렉터리는 `npm run dev`로 실행한 Portfolio Manager가 읽고 저장하는 개발 전용 원본입니다.

- `portfolio-holdings.json`: 보유종목 원본
- `portfolio-account.json`: 계좌 요약 원본이며 처음 저장할 때 생성될 수 있음
- 이 디렉터리의 JSON은 Git 추적 대상이므로 clone/pull로 개발 환경에 전달됩니다.
- 개인 보유 정보가 포함될 수 있으므로 공개 저장소나 신뢰하지 않는 remote에는 올리지 않습니다.
- 한 번 commit/push한 데이터는 나중에 파일을 지우거나 `.gitignore`에 추가해도 Git 과거 기록에 남습니다.

운영 데이터는 이 디렉터리를 사용하지 않습니다. 운영 전환 규칙과 수동 이전 절차는
[`docs/portfolio-data-boundary.md`](../../../docs/portfolio-data-boundary.md)를 따릅니다.

