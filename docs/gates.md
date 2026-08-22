# 게이트

게이트는 문서 상태와 본문을 결정적으로 검사하는 Node 스크립트입니다.
통과하거나 실패 코드를 냅니다. 에이전트가 설득할 대상이 아닙니다.

```
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
```

| 게이트 | 검사 |
| --- | --- |
| **plan** | G1 epic `approved` · G2 blueprint `approved`(`finalize --yes`가 잠근 `closed` blueprint도 같은 G2 코드로 걸리지만 메시지는 미승인 `draft`와 다르게 마감 사유를 알린다) · G18 blueprint 루트 `context-review.md`가 `accepted`이고 `## Findings`와 findings 필드(`id`·`severity`·`status`, `accepted`에는 비지 않은 `note`)가 G14와 같은 계약(blueprint `bouncer.scale`이 `light`면 이 문서가 없으므로 G18을 적용하지 않는다) · G3–G5·G10–G12는 **발견된 각 task 묶음**(`tasks/<NNN>/tasks.md`)에 각각 적용 · G3 tasks `ready` · G4 `scope_evidence.suggested_paths` 존재 + `scope_evidence.basis`가 비어 있지 않은 엔트리 배열(`graph`/`status`/`query`/`result`)이며 새 `scope_evidence.producer`는 반드시 `graphify`임(구 `graph`는 읽기 호환만 함) · G5 `affected_paths` 비어있지 않음 · G10 tasks 섹션 작성됨(full 5개: Goal & intent·Interface·Touch·Do not touch·Checklist / light 3개: Goal & intent·Touch·Checklist) · G11 `affected_paths`가 Touch로 정당화됨 · G12 Do not touch와 `affected_paths`가 겹치지 않음 |
| **execute** | 활성 포인터가 가리키는 task 묶음만 판정: G6 `tasks` `verified` · G7 같은 디렉터리의 `verification` `passed` · G8 같은 디렉터리의 `review` `accepted`(또는 `required: false`) · G13 `verify` 명령 실제 실행 + 종료 코드 0 + `verification.md` 본문이 기록된 메타데이터와 일치 · G14 `review.md`의 `## Findings` 존재 + 각 finding의 severity/status 유효 |
| **commit** | 포인터 task의 G6 `tasks` `verified` · G7 `verification` `passed` · G8 `review` `accepted`(또는 `required: false`) 재확인 + G13 하네스 원장 대조(execute와 동일) + G17 스테이징 경로가 그 task `affected_paths` 안인지 (G9·G15는 결번; project `.bouncer/Distill.md`는 skill + `makeAllowed`, 본문 게이트 아님) |
| **finalize** | G16 모든 task `verified` · explain `published` · 본문 5섹션 · `comprehension` 배열의 BP 단일 엔트리(`quiz_score` 필수) · 그 엔트리 `diff_sha`가 `range_from..HEAD`(`.bouncer/context/` 제외)와 일치 |

`S`로 시작하는 코드(S0–S26)는 게이트와 무관하게 항상 검사하는 구조/스키마 위반입니다.
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
밖이면 실패합니다(부재는 허용).

S21–S26은 Project Distill 구조 검사입니다. S21은 등록되지 않은 orphan shard, S22는
비-`always` shard의 routing 경로 누락, S23은 잘못된 `pulls`, S24는 `pulls`
순환, S25는 `source_dirs` routing 공백, S26은 `distill.max_bytes` 초과 shard를
뜻합니다. routing이 활성화되면 이 경고가 구조 실패가 됩니다. 전체 공개 계약은
[compatibility.md](compatibility.md)를 보세요.

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

증상별 대처는 [troubleshooting.md](troubleshooting.md)를 보세요.
설계 배경은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.
