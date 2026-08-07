# 게이트

게이트는 문서 상태와 본문을 결정적으로 검사하는 Node 스크립트입니다.
통과하거나 실패 코드를 냅니다. 에이전트가 설득할 대상이 아닙니다.

```
bouncer validate --blueprint <dir> --gate <plan|execute|finalize>
```

| 게이트 | 검사 |
| --- | --- |
| **plan** | G1 epic `approved` · G2 blueprint `approved` · G3–G5·G10–G12는 **발견된 각 task 묶음**(`tasks/<NNN>/tasks.md`, 또는 레거시 루트 task 문서)에 각각 적용 · G3 tasks `ready` · G4 `graph.suggested_paths` 존재 + `graph.basis`가 비어 있지 않은 레거시 문자열 또는 비어 있지 않은 엔트리 배열(`graph`/`status`/`query`/`result`) · G5 `affected_paths` 비어있지 않음 · G10 tasks 5개 섹션 작성됨 · G11 `affected_paths`가 Touch로 정당화됨 · G12 Do not touch와 `affected_paths`가 겹치지 않음 |
| **execute** | 활성 포인터가 가리키는 task 묶음만 판정: G6 `tasks` `verified` · G7 같은 디렉터리의 `verification` `passed` · G8 같은 디렉터리의 `review` `accepted`(또는 `required: false`) · G13 `verify` 명령 실제 실행 + 종료 코드 0 + `verification.md` 본문이 기록된 메타데이터와 일치 · G14 `review.md`의 `## Findings` 존재 + 각 finding의 severity/status 유효 |
| **finalize** | G15 explain 본문 5섹션 작성 · `bouncer.comprehension` 기록 존재 · `diff_sha`가 `base..HEAD`(`.bouncer/context/` 제외)와 일치 (G9는 결번; project `.bouncer/Distill.md`는 skill + `makeAllowed`, 본문 게이트 아님) |

`S`로 시작하는 코드(S0–S14)는 게이트와 무관하게 항상 검사하는 구조/스키마 위반입니다.
S12는 `tasks.bouncer.verify`가 있을 때 셸 체이닝·리다이렉션·`cd` 접두 같은 비단일
실행 형식을 거절합니다. S13은 `.bouncer/context/epics/` 디렉터리와 번들 루트
`index.md`의 OKF §6 에픽 목록이 어긋나면 실패합니다(`bouncer scaffold epic`이
목록 줄을 추가함). 구 레이아웃은 마이그레이션 대상이며, 하드컷 전까지는
새 `tasks/<NNN>/` 묶음과의 거절 규칙을 여기서 새로 정의하지 않습니다.

섹션은 **헤딩만 있고 본문이 비면 미작성으로 판정**합니다. 갓 scaffold한 문서가
G10에 걸리는 것은 의도된 동작입니다.

**G13은 verify 명령을 실행합니다.** execute 게이트는 `config.json`의 `verify`
명령을 하네스가 직접 돌린 메타데이터가 있어야 통과합니다. 에이전트가 손으로 쓴
"통과했습니다"만으로는 못 지나갑니다.

증상별 대처는 [troubleshooting.md](troubleshooting.md)를 보세요.
설계 배경은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.
