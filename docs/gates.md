# 게이트

게이트는 문서 상태와 본문을 결정적으로 검사하는 Node 스크립트입니다.

S13은 에픽 디렉터리와 번들 루트 목록의 경로·중복을 검사하는 동시에 각
색인 요약이 에픽 frontmatter `description`과 같은지 검사한다. 파싱 실패,
읽기 실패, 비문자열·빈 설명도 해당 에픽 파일의 원인과 함께 S13으로 보고한다.
통과하거나 실패 코드를 냅니다. 에이전트가 설득할 대상이 아닙니다.

```
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
```

| 게이트 | 검사 |
| --- | --- |
| **plan** | G1 epic `approved` · G2 blueprint `approved`(`finalize --yes`가 잠근 `closed` blueprint도 같은 G2 코드로 걸리지만 메시지는 미승인 `draft`와 다르게 마감 사유를 알린다) · G18 blueprint 루트 `context-review.md`가 `accepted`이고 `## Findings`와 findings 필드(`id`·`severity`·`status`, `accepted`에는 비지 않은 `note`)를 쓰되 status는 `resolved | accepted`만 허용하고 `deferred`는 거부한다(blueprint `bouncer.scale`이 `light`면 이 문서가 없으므로 G18을 적용하지 않는다) · G3–G5·G10–G12는 **발견된 각 task 묶음**(`tasks/<NNN>/tasks.md`)에 각각 적용 · G3 tasks `ready` · G4 `scope_evidence.suggested_paths` 존재 + `scope_evidence.basis`가 비어 있지 않은 엔트리 배열(`graph`/`status`/`query`/`result`; `graph`는 `source`\|`test`\|`context`)이며 새 `scope_evidence.producer`는 반드시 `graphify`임; 선택 필드 `quality`와 `candidates`는 둘 다 있거나 둘 다 없고, 있으면 짝·형식·`low-confidence`\|`unavailable`→빈 `suggested_paths` 불변식을 검사함(구 `graph`와 quality 없는 evidence는 읽기 호환만 함) · G5 `affected_paths` 비어있지 않음 · G10 tasks 섹션 작성됨(full 5개: Goal & intent·Interface·Touch·Do not touch·Checklist / light 3개: Goal & intent·Touch·Checklist) · G11 `affected_paths`가 Touch로 정당화됨 · G12 Do not touch와 `affected_paths`가 겹치지 않음 · G19 blueprint 안 모든 task의 `depends_on` 그래프 무결성: 같은 blueprint에 없는 `TASKS-NNN` 참조, 자기 참조, 한 문서 안 중복 edge, 방향 그래프 순환을 거절한다(부재는 빈 배열로 읽어 통과; 형식·enum은 S28) |
| **execute** | 활성 포인터가 가리키는 task 묶음만 판정: G6 `tasks` `verified` · G7 같은 디렉터리의 `verification` `passed` · G8 같은 디렉터리의 `review` `accepted`(또는 `required: false`) · G13 `verify` 명령 실제 실행 + 종료 코드 0 + `verification.md` 본문이 기록된 메타데이터와 일치 · G14 `review.md`의 `## Findings` 존재 + 각 finding의 severity/status 유효(`resolved | accepted | deferred`, `accepted`·`deferred`는 비지 않은 `note`). `rounds[]`에 `mode`가 있으면 finding 정체성(`category`·`brief_clause`·`file`·`symbol`·정규 `fingerprint`)·수정 필요도·origin·발견 round를 모두 요구하고 중복 fingerprint를 거부한다. round mode는 `discovery`, `discovery → delta`, `discovery → delta → critical_recovery → delta`만 허용하고 target/perspective 일치와 기존 집계를 검사하며, accepted review에는 열린 `must_fix`를 허용하지 않는다. mode 없는 기존 rounds는 종전 형식만 검사 |
| **commit** | 포인터 task의 G6 `tasks` `verified` · G7 `verification` `passed` · G8 `review` `accepted`(또는 `required: false`) 재확인 + G13 하네스 원장 대조(execute와 동일) + G17 스테이징 경로가 그 task `affected_paths` 안인지 (G9·G15는 결번) |
| **finalize** | G16 모든 task `verified` · explain `published` · 본문 5섹션 · `comprehension` 배열의 BP 단일 엔트리(`quiz_score` 필수) · 그 엔트리 `diff_sha`가 `range_from..HEAD`(`.bouncer/context/` 제외)와 일치 |

`S`로 시작하는 코드(S0–S28)는 게이트와 무관하게 항상 검사하는 구조/스키마 위반입니다.
S12는 `tasks.bouncer.verify`가 있을 때 셸 체이닝·리다이렉션·`cd` 접두 같은 비단일
실행 형식을 거절합니다. S13은 `.bouncer/context/epics/` 디렉터리와 번들 루트
`index.md`의 OKF §6 에픽 목록이 어긋나면 실패합니다(`bouncer scaffold epic`이
목록 줄을 추가함).

task 문서 레이아웃은 `tasks/<NNN>/{tasks,verification,review}.md` 하나뿐입니다.
S15는 blueprint 루트에 남은 `tasks.md`·`tasks-<NNN>.md`를 거절합니다
(`bouncer migrate task-layout`으로 옮기세요). S16은 세 자리 숫자가 아닌 `tasks/`
하위 디렉터리를, S17은 묶음에서 세 문서 중 빠진 것을 거절합니다. S14는 구·신
레이아웃 혼재를 막던 코드였고 하드컷과 함께 결번이 됐습니다. S18은 `imported`
status인 blueprint를 게이트 대상에서 빼는 코드입니다. S19는 문서 `type`이
파일 위치가 요구하는 종류와 다르면 실패합니다(예: `tasks.md` 자리에
`bouncer.review`). S20은 blueprint `bouncer.scale`이 있을 때 `light`/`full`
밖이면 실패합니다(부재는 허용). S27은 epic·blueprint `bouncer.supersedes`가
있을 때 비어 있지 않은 문서 경로 문자열 배열이 아니면 실패합니다(부재·빈 배열은
허용; 참조 무결성은 검사하지 않음). S28은 task DAG 필드의 형식·enum만 봅니다 —
`depends_on`은 `TASKS-NNN` 문자열 배열, `parallel_safe`는 boolean,
`dependency_gate`는 `integrated` 하나만 허용합니다.
세 필드 모두 부재는 허용이며, 참조 무결성과 순환은 S28이 아니라 G19가 봅니다.

S21–S26은 폐기된 결번입니다. 새 구조 검사는 이 번호를 재사용하지 않습니다.

섹션은 **헤딩만 있고 본문이 비면 미작성으로 판정**합니다. 갓 scaffold한 문서가
G10에 걸리는 것은 의도된 동작이며, light 템플릿도 `<TODO: …>`를 남겨 같은 방식으로
걸립니다.

**plan 게이트의 light 분기는 두 곳뿐입니다.** blueprint `index.md`의
`bouncer.scale`이 `light`면 G18을 적용하지 않고, G10 필수 절이 세 개로 줄어듭니다.
그 외에는 갈라지지 않습니다 — G1·G2·G3·G4·G5·G11·G12는 full과 같은 실패를 내고,
execute·commit·finalize 게이트(G6–G8·G13·G14·G16·G17)는 scale을 읽지 않습니다.
`scale`이 없거나 `full`이거나 알 수 없는 값이면 전부 full 계약입니다.

**G13은 verify 명령을 실행한 원장과 문서를 대조합니다.** execute·commit 게이트는
`verification.md` 프론트매터만 보지 않습니다. `bouncer verify`가 Git common
directory 아래(`<git-common-dir>/bouncer/verify/…json`)에 남긴 레코드의
`command`·`ran_at`·`exit_code`·`output_sha`가 문서와 같아야 통과합니다. 원장이
없거나 Git을 쓸 수 없으면 프론트매터가 완전해도 실패합니다. 에이전트가 손으로 쓴
"통과했습니다"만으로는 못 지나갑니다. 원장은 커밋되지 않으므로 새 클론·CI에서는
활성 task에 대해 `bouncer verify`를 다시 실행해야 합니다.

## coordinator mode에서 달라지는 것

게이트 코드와 판정식은 그대로입니다. `/bouncer-run`이 주행을 coordinator에
위임하면 아래 셋이 추가로 작동합니다.

**plan — task DAG 판정.** 계획이 `depends_on`·`parallel_safe`·
`dependency_gate`를 쓰면 승인 전에 G19가 그래프 무결성을, S28이 형식을
판정합니다. 실행 순서를 정하는 것은 task 번호가 아니라 이 세 필드이므로,
승인된 DAG가 coordinator ready wave의 최초 기준이 됩니다. 세 필드가 없는 기존
계획은 의존 없음·순차·`integrated`로 읽혀 그대로 통과하며, 한 번에 한
node짜리 wave로 실행됩니다.

**dynamic scope — 승인 범위는 초기 예상치입니다.** 주행 중 승인
`affected_paths`의 정본은 원장(`.bouncer/runtime/coordinator.json`)의 현재
scope와 그 `revision`입니다. `bouncer coordinate revise`가 task 문서와 원장을
같은 revision으로 옮기고 결정 로그에 이전·다음 경로를 붙입니다.

집행은 세 층이고 세기가 다릅니다.

| 층 | 판정 기준 | 무엇을 잡나 |
| --- | --- | --- |
| `commit-safety` 훅 | 원장의 현재 scope + worktree 경계 | 훅을 로드하는 호스트에서 커밋 명령 자체를 차단 |
| `bouncer commit` | 원장의 현재 scope + worktree 경계 | 훅이 없어도 staging·commit 전 거부. `--yes`도 우회하지 않음 |
| **G17** | task 문서의 `affected_paths`만 | 원장을 읽지 않음 — stale revision, main worktree 커밋, 미할당 worktree를 통과시킴 |

G17은 셋 중 가장 약한 층입니다. commit 게이트 통과를 coordinator 권한 확인으로
읽지 마세요. 문서 수준 검사일 뿐이고, 실제 경계는 CLI와 훅이 집행합니다.
원장이 없는 저장소에서는 위 세 층이 모두 승인 `affected_paths`를 그대로 써서
기존 판정과 같습니다.

**`dependency_gate`.** ready wave는 선행 task의 상태를 후속이 선언한
`dependency_gate`와 비교합니다. 받는 값의 계약은 위 S28 절을 보세요.

증상별 대처는 [troubleshooting.md](troubleshooting.md)를 보세요.
설계 배경은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.
