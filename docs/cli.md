# CLI

스킬(`/bouncer-*`)이 내부에서 부르는 스크립트를 직접 쓸 수도 있습니다.
`bouncer` 또는 `bouncer --help`로 목록을 볼 수 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `bouncer validate --blueprint <dir> --gate <plan\|execute\|commit\|finalize>` | 구조 검사 + 게이트 하나. 실패 코드를 보고 |
| `bouncer verify --blueprint <dir>` | `tasks.bouncer.verify`(있으면) 또는 `config.verify`를 실행하고 증적을 기록 |
| `bouncer scaffold epic --id <ddd> --name <slug> --description <text>` | 비어 있지 않은 설명으로 epic을 만들고, 같은 epic을 다시 실행하면 문서는 보존한 채 파생 색인 행을 append/replace/no-op |
| `bouncer scaffold blueprint ... [--scale light\|full]` | 올바른 프론트매터로 blueprint와 첫 task 묶음 생성. `--scale`은 `blueprint`에만 쓰는 선택 인자 |
| `bouncer scaffold task --blueprint <dir> --id <NNN>` | `tasks/<NNN>/{tasks,verification,review}.md` task 묶음 생성. 대상 blueprint가 `closed`(마감)면 아무 문서도 만들지 않고 새 blueprint를 만들라는 안내와 함께 종료 코드 2로 거절 |
| `bouncer scaffold explain --blueprint <dir>` | BP `explain.md` 생성(`comprehension: []`). `/bouncer-finalize`가 호출 |
| `bouncer scaffold context-review --blueprint <dir>` | BP `context-review.md` 생성. 이미 있으면 덮어쓰지 않고 거절. `closed` blueprint도 거절 |
| `bouncer commit --blueprint <dir> [--yes]` | task 커밋 범위 확인, `--yes`면 그 task만 커밋. 포인터는 옮기지 않음. 성공 JSON에 `controller`(ledger 활성이면 `coordinator`, 아니면 `standalone`)·`nextAction`(dry-run은 `confirm-commit`, drive의 커밋·빈 staged는 `return-to-coordinator`, standalone은 `nextTask`가 있으면 `ask-next-task` 없으면 `finalize`)·`stampPath`(`commit_sha`를 쓴 tasks.md, 없으면 `null`)를 싣고, 실패 JSON에 `recovery: { action, detail }`를 싣음 |
| `bouncer finalize --blueprint <dir> [--yes]` | 마감 게이트(G16) + 남은 context 변경 범위 확인. `--yes`면 스테이징 전에 검증 명령을 실행하고, 통과하면 커밋 후 포인터 clear. 성공 JSON의 `branch`는 drive면 `coordinator.integrationBranch`, standalone이면 실행 checkout의 실제 branch(확인 불가면 `null`)다. `coordinator`에는 `integrationBranch`와 task별 `branch`도 싣는다. dry-run·`--yes` 성공 JSON과 `coordinator-ledger` 거절 JSON에 `integration`(`ledger`: `absent` \| `ok` \| `unreadable`, `required`, `complete`, `openTasks`, `headVerified`)을 싣음. 보고 전용이며 거절 reason을 바꾸지 않음. 원장을 읽을 수 있는 drive는 G16보다 먼저 원장에서 `integrated`인 task마다 integration 사본의 `tasks.md` 상태(commit task `verified`, verification task `integrated`)를 대조하고, 어긋나면 dry-run과 `--yes` 모두 `{ ok: false, reason: 'coordinator-evidence-mismatch', tasks }`(각 `id`, `expected`, `actual` — 문서를 못 읽으면 `actual: null`)로 멈춤. 문서와 커밋은 바꾸지 않음 |
| `bouncer coordinate <bootstrap\|prepare\|ready\|record\|rerecord\|integrate\|status\|revise\|repair\|partial-close\|critical-recovery\|release> --blueprint <dir> [--task <NNN>] [--sha <sha>] [--decision <text>] [--paths <p>]... [--findings <id>]... [--outcome <resolved\|blocked>] [--reason <text>]` | coordinator 원장과 격리 worktree 운용. 결과 JSON은 stdout에 냄 — `{ok:false}` 거절도 `{"ok": false, "reason": …}` JSON으로 stdout에 나오고(`revise`만 예외로 stderr) 종료 코드 1. assigned-worktree 불일치·Git 실패는 throw 경로라 stderr 한 줄. 자세한 것은 아래 [`bouncer coordinate`](#bouncer-coordinate) |
| `bouncer seed-worktree --blueprint <dir> --to <worktree>` | plan 컨텍스트 문서를 base 체크아웃에서 worktree로 이전하고 base를 원상복구. 옮길 것이 없으면 성공 |
| `bouncer execute prepare --blueprint <dir>` | standalone execute worktree를 만들거나 재사용하고 plan 문서를 seed한 뒤 JSON을 출력. 새 standalone branch는 helper의 `<commit_type>/<epic-id>-<blueprint-id>-<slug>`이고, 재사용 worktree는 실제 branch를 그대로 보고한다. coordinator 원장이 있으면 `drive: true`와 배정된 worker 경로만 내고 생성·seed는 하지 않음 |
| `bouncer plan inspect [--epic-dir <dir>]` | 다음 epic/blueprint id, `maintenance` epic, 저장소 루트 verify 신호, pointer 상태를 JSON으로 출력. 읽기 전용이며 `.bouncer/`가 없으면 `not-initialized`, `--epic-dir`가 정본 경로가 아니거나 없으면 `invalid-epic-dir` |
| `bouncer run preflight --blueprint <dir>` | pointer, blueprint 상태·scale, 열린 task의 `affected_paths`·DAG, ready wave, `autonomy`와 fallback 여부를 JSON으로 출력. 읽기 전용. pointer가 없으면 `no-current`, 모호하거나 충돌하면 `CURRENT_AMBIGUOUS`/`CURRENT_INVALID`이며 종료 코드 1 |
| `bouncer init` | `.bouncer/` 부트스트랩. 덮어쓰지 않음 |
| `bouncer project-root [--repo <dir>]` | 소비 저장소 main worktree 절대 경로 한 줄(stdout만). primary·linked worktree에서 같은 값. 비-Git이면 stderr + 종료 코드 1(빈 stdout·cwd 대체 없음) |
| `bouncer context-search --mode <decision\|implementation\|history> --query <text> [--max-candidates <1..8>]` | canonical context graph를 role별로 검색. query id·status·graph version과 최대 8개 후보를 JSON으로 출력 |
| `bouncer current [--set <dir> [--task <NNN\|TASKS-NNN>] [--replace]] [--clear]` | 위치별 활성 포인터 읽기 / 기록 / 지우기. 저장 경로는 Git common directory의 `pointers/<epic-id>/<blueprint-id>.json`이고 본문은 `{ blueprint, task?, base }`. `--task` 없이 `--set`하면 번호 오름차순 첫 `ready`/`in_progress` task를 고르고, 열린 후보가 없으면 task 없이 쓴다. 출력의 `task`는 `{path, id}`(미지정이면 `null`); `scale`은 호출 시점에 blueprint `index.md`의 `bouncer.scale`에서 파생한 문자열(없거나 읽을 수 없으면 `null`). 없으면 `ready` 후보. 기본 `--set`은 대상 namespace key를 추가·갱신하고 다른 key를 보존한다. `--replace`는 현재 위치에서 유일하게 선택된 key를 지운 뒤 대상을 쓰며, 성공 payload의 stdout JSON과 stderr `previous`에 `{ blueprint, base, task }`를 싣는다. 기준 checkout에 포인터가 둘 이상이면 읽기·`--replace` 모두 `CURRENT_AMBIGUOUS`와 정렬된 `candidates`로 종료 코드 1이며 어느 쪽도 추측하지 않는다. `--clear`는 현재 선택된 key만 지운다. `--replace`만 쓰거나 `--clear`와 함께 쓰면 사용법 오류다. |
| `bouncer migrate task-layout [--dry-run]` | 구형 루트 task 문서를 `tasks/<NNN>/` 묶음으로 이관합니다. 먼저 dry-run 결과를 확인하세요. |
| `bouncer import [--source merges\|commits] [--since <ref>] [--limit <n>] [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]` | git 히스토리를 `imported` epic/blueprint 문서로 전사. 기본은 dry-run(계획 JSON만 출력). `--yes --message`일 때만 파일을 쓰고 커밋 하나로 남김 |

신규 epic의 `--description`은 필수이며 공백·`Epic <id>`는 거절한다. 기존
canonical epic을 다시 실행하면 epic 파일은 덮어쓰지 않고 현재 frontmatter
description으로 색인 행만 동기화한다.

`scaffold blueprint --scale`은 계획 단계 문서 세트를 고른다. 생략하거나 `full`이면
기존 다섯 문서(blueprint `index.md`, `context-review.md`,
`tasks/001/{tasks,verification,review}.md`)를 그대로 만든다. `light`는
`context-review.md`를 만들지 않아 네 문서가 되고, 축약 본문으로 전체 100줄
이하가 된다. `light`/`full` 밖의 값은 파일을 하나도 만들기 전에 종료 코드 2로
거절한다. 값이 `index.md`의 `bouncer.scale`에 그대로 남으므로, 뒤에 붙이는
`scaffold task`도 같은 세트를 따른다. 두 경로의 게이트 차이는
[gates.md](gates.md)에 있다.

`current`는 cwd로 고른다. 중첩 execute worktree(`.worktrees/<epic-id>/<blueprint-id>`)와
유일하게 대응하는 레거시 평면 worktree(`.worktrees/<blueprint-id>`)에서는 그
blueprint의 namespace 포인터만 반환한다. 기준 checkout에서는 포인터가 하나일 때만
선택한다. 성공 표시는 `{ blueprint, base, task, scale }`이고, 모호성·충돌 payload의
`candidates`는 저장 본문과 같은 `{ blueprint, base, task }`(문자열 또는 `null`)이며
`scale`을 넣지 않는다.

레거시 파일 `<git-common-dir>/bouncer/current`는 계속 읽는다. 첫 `--set`은 충돌이
없을 때 대상 namespace로 옮기고 레거시를 지운다. 레거시와 namespace가 다른
blueprint를 가리키면 `CURRENT_INVALID`로 둘 다 보고하고 어느 쪽도 수정하지 않는다.
레거시 삭제만 실패한 `--set`은 namespace 사본을 남긴 채
`CURRENT_MIGRATION_INCOMPLETE`다.

모든 명령이 `--repo <dir>`로 다른 저장소를 대상으로 실행할 수 있습니다. 예외는
`coordinate revise` 하나입니다 — 쓰기 경계를 호출자가 고르면 main worktree·
미할당 worktree 거절이 무력해지므로 실제 cwd만 봅니다.

## `bouncer coordinate`

`/bouncer-run`이 위임한 `bouncer-coordinator`가 부르는 결정적 코어입니다.
branch·worktree·fan-in Git 작업은 전부 이 명령을 거치며, 손으로 worktree를
만들거나 지우지 않습니다. 성공은 종료 코드 0과 stdout JSON입니다. 거절은
종료 코드 1이며, 채널은 거절이 어떻게 나오느냐로 갈립니다. `{"ok": false,
"reason": …}` 반환 경로는 `revise`를 뺀 열한 서브커맨드에서 그 JSON을 그대로
**stdout**에 냅니다. `revise`만 stdout을 비우고 `coordinate revise: <reason>`
한 줄을 stderr에 냅니다. 반면 throw 경로 — 아래 assigned-worktree 불일치와
cherry-pick 등 Git 실패 — 는 `reason` JSON이 아니라 `coordinate: <메시지>`
한 줄을 **stderr**에 내고 stdout은 비웁니다. 사용법 오류는 종료 코드 2입니다.

**어디서 부르나가 계약의 일부입니다.** `bootstrap`·`release`는 main checkout에서,
`prepare`·`ready`·`status`·`integrate`·`repair`·`partial-close`·`critical-recovery`는
integration worktree에서, `record`·`rerecord`·`revise`는 그 task에 배정된 worker
worktree에서 부릅니다. `bootstrap`·`release`·`revise`를 뺀 아홉 — `prepare`·`ready`·`status`·
`integrate`·`repair`·`partial-close`·`critical-recovery`·`record`·`rerecord` — 은
cwd를 배정 경로와 대조해, 자리가 다르면 `coordinate command must run in its assigned worktree`로
끝납니다. 나머지 셋은 자리를 다르게 봅니다 — `bootstrap`은 cwd를 보지 않고
`--repo`(없으면 cwd)가 main checkout인지만 확인해 아니면
`bootstrap-requires-main-checkout`으로 거절하고, `release`는 `--repo`(없으면 cwd)와
실제 cwd가 둘 다 main checkout 루트인지 확인해 아니면 `release-requires-main-checkout`으로
거절합니다. `revise`는 cwd를 보되 거절 코드가 `main-worktree-source-write` / `unassigned-worktree`입니다.

| 서브커맨드 | 부르는 자리 | 하는 일 | 돌려주는 것 |
| --- | --- | --- | --- |
| `bootstrap` | main worktree | `.worktrees/<epic-id>/<bp-id>/integration`을 blueprint의 `commit_type/<epic-id>-<bp-id>-<slug>` branch로 등록합니다. 새 원장일 때 main의 blueprint 트리·상위 epic/context index와 config를 integration에 복사하고, 계획 문서의 경로별 sha256 `seedManifest`를 coordinator 원장에 남깁니다. `seedManifest`는 `release`가 쓰는 원장 내부 상태이고, 소비자가 읽거나 계약으로 삼는 CLI 응답 필드가 아닙니다. main source는 쓰지 않습니다 | `integrationPath`, `integrationBranch`, `ready`, `tasks`, `decisions` |
| `prepare` | integration worktree | 현재 ready wave를 열고 task마다 `workers/<NNN>`을 `bouncer/<epic-id>-<bp-id>-<task-id>` branch로 등록한 뒤, `--repo`와 관계없이 integration 사본의 blueprint 트리와 config를 worker마다 독립 사본으로 복사해 넣습니다. `commit_type`도 integration 사본의 blueprint `index.md`에서 읽습니다. main의 계획 문서는 읽지 않으므로 drive 동안 main은 base SHA 출처로만 남습니다. verification node는 복사 없이 integration에 그 bundle이 있는지만 확인하므로 `repair`가 integration에서 바꾼 terminal `tasks.md`가 그대로 남습니다. 각 commit task에 실제 `branch`를 기록하고 `prepared`로 옮깁니다 | `ready`, `tasks`(각 `workerPath`, `branch`), `decisions` |
| `ready` | integration worktree | `status`의 별칭입니다. 원장을 바꾸지 않습니다 | `ready`, `tasks`, `decisions` |
| `status` | integration worktree | 원장 전체 상태를 읽습니다 | `ready`, `tasks`, `decisions` |
| `record` | worker worktree | `--task`의 worker HEAD를 결과 SHA로 원장에 올리고 `recorded`로 옮깁니다. `--sha`를 주면 worker HEAD와 같아야 하고, `--decision <text>`는 그 판단을 결정 로그에 함께 남깁니다 | `task`(`sha`·`status`), `decisions` |
| `integrate` | integration worktree | commit task는 기존 가드(`not-recorded`·`sha-not-owned-by-worker`·`stale-integration-head`) 뒤에 worker의 `<blueprint>/tasks/<NNN>/{tasks,verification,review}.md`를 읽어, tasks `verified`·verification `passed`·review `accepted`이고 tasks `commit_sha`가 기록된 SHA의 앞 8자리일 때만 그 세 문서를 integration의 같은 경로로 복사합니다. 다른 task bundle·blueprint `index.md`·source는 복사하지 않습니다. 그 뒤 `recorded` task의 SHA를 integration branch로 cherry-pick하고 `integrated`로 옮기며 원장의 `integrationHead`를 갱신합니다. 동적 repair task도 같은 규칙입니다. verification task는 증적 복사 없이 `ready → verifying → integrated`로 검증만 돌립니다 | `task`, 다음 `ready`, `decisions` |
| `critical-recovery` | integration worktree | prepared task의 blocker/major recovery 시작을 `used: 1`, 반복 가능한 `findings`, `reason`, `outcome: null`로 기록합니다. `--outcome resolved\|blocked --reason <text>` 호출은 그 결과만 채웁니다 | `task`(`criticalRecovery`), `decision`, `decisions` |
| `release` | main worktree | finalize가 drive를 닫은 뒤, main에 남은 계획 사본을 원장의 `seedManifest`와 경로별로 대조합니다. main에 없거나 이미 `HEAD` blob과 같으면 `absent`, sha256이 같고 `HEAD`에 있으면 `git checkout HEAD -- <path>`로 되돌려 `restored`, sha256이 같고 `HEAD`에 없으면 staged면 unstage한 뒤 지우고 빈 디렉터리를 정리해 `released`, sha256이 다르면 건드리지 않고 `preserved`입니다. 빈 디렉터리 정리는 blueprint 트리 안에서만 합니다. 비워진 blueprint 디렉터리까지는 지우지만 상위 `blueprints/`·epic 디렉터리·`epics/`·`.bouncer/context/`는 지우지 않고, epic·context `index.md`를 지운 뒤에는 정리하지 않습니다. drive 도중 main에서 고친 문서는 `preserved`로 남습니다. manifest 밖 경로·source·integration·원장·worker worktree는 쓰지 않고, seed 집합 밖이거나 정규형이 아닌 manifest 항목도 판정 없이 `preserved`로 보고합니다. 객체가 아니거나 `path`가 문자열이 아닌 항목은 main에 쓰기 전에 가려내 항목의 JSON 텍스트(예: `null`)로 `preserved`에 넣으며, 거절하지 않습니다. 그래서 `preserved` 항목은 경로가 아니라 잘못된 manifest 항목의 JSON 텍스트일 수 있고, 소비자는 이를 파일 경로로 찾지 말고 그대로 보고합니다. 다시 실행하면 처리한 경로가 모두 `absent`가 되어 같은 상태로 수렴합니다. 이 명령 뒤에 main에서 integration branch를 병합하면 계획 문서 충돌 없이 끝납니다 | `released`, `restored`, `preserved`, `absent` |
| `revise` | worker worktree | 실행 중 발견한 경로로 그 task의 scope를 개정합니다. task 문서와 원장을 같은 `revision`으로 옮기고 결정 로그에 이전·다음 경로를 붙입니다. `--paths`는 반복할 수 있고 `--reason`은 필수입니다 | `revision`, `previous`, `paths` |

`revise`는 scope를 바꾸는 유일한 표면입니다. 저장소 source 경로만 받고, 절대
경로·저장소 밖 경로·트리 전체 표기(glob)·`.git/`·`.bouncer/` 거버넌스 트리는
거절합니다. 그 경계 안에서는 상한이 없습니다 — 넓힘을 감사 가능하게 만드는
것은 경로 제한이 아니라 append-only 결정 로그입니다.

### 거절 코드

아래 코드는 `revise`를 뺀 서브커맨드에서는 stdout JSON의 `reason` 필드로,
`revise`에서는 stderr의 `coordinate revise: <reason>` 한 줄로 나옵니다. 단
"코어 직접 호출"이라고 적힌 코드는 CLI 경로에서는 나오지 않습니다.

아래 `unassigned-integration-worktree`·`unassigned-worker-worktree`·
`unassigned-worktree`는 이름만 겹칠 뿐, 배정되지 않은 자리에서 불러 끝나는
`coordinate command must run in its assigned worktree`와는 다른 실패입니다(위
throw 경로 문단).

| `reason` | 내는 서브커맨드 | 뜻 |
| --- | --- | --- |
| `non-git-root` | `revise`를 뺀 전부 | `--repo`/cwd가 Git 저장소가 아닙니다 |
| `no-git` | `revise` | `revise` 경로에서 저장소 runtime 경로를 못 풀었습니다(Git 저장소가 아니거나 worktree 정보를 읽지 못함) |
| `no-coordinator-paths` | `revise` | `revise` 경로에서 blueprint 경로로부터 epic/blueprint id를 뽑지 못했습니다. coordinator 대상이 아닌 레거시 경로입니다 |
| `unknown-coordinate-command` | 코어 직접 호출 | 코어가 모르는 서브커맨드입니다. CLI 앞단은 열두 이름만 통과시키므로, 이 코드는 CLI를 거치지 않고 코어를 직접 부른 호출에서만 나옵니다 |
| `bootstrap-requires-main-checkout` | `bootstrap` | `bootstrap`을 main checkout이 아닌 자리에서 불렀습니다 |
| `release-requires-main-checkout` | `release` | `--repo` 또는 실제 cwd가 main checkout 루트가 아닙니다. 원장을 읽기 전에 거절하며 main 파일은 바뀌지 않습니다 |
| `missing-seed-manifest` | `release` | 원장에 `seedManifest`가 없습니다. 이 필드를 남기기 전의 bootstrap이 만든 원장입니다. main 파일은 바뀌지 않습니다 |
| `drive-not-closed` | `release` | 원장 `status`가 `awaiting_confirmation`·`partial_closed`이거나 `integrated`가 아닌 task가 있습니다. 멈춘 drive의 main 사본은 복구 상태이므로 바꾸지 않습니다 |
| `blueprint-not-closed` | `release` | integration 사본의 blueprint `index.md`가 `closed`가 아닙니다. finalize가 끝나기 전이며 main 파일은 바뀌지 않습니다 |
| `main-source-mutated` | `bootstrap` | integration 등록 도중 main worktree의 source 상태가 바뀌었습니다. 원장을 쓰지 않고 멈춥니다 |
| `missing-blueprint` / `seed-conflict` / `seed-failed` | `bootstrap` | integration용 계획 문서를 seed할 수 없습니다. 충돌 때는 `conflicts`, 모두 `targets`를 함께 반환하며 원장은 쓰지 않습니다 |
| `invalid-commit-type` | `bootstrap`·`prepare` | blueprint `commit_type`이 허용된 `.gitmessage` 종류가 아닙니다 |
| `invalid-branch-name` | `bootstrap`·`prepare` | 계산한 branch 이름이 Git ref 형식이 아닙니다 |
| `branch-conflict` | `bootstrap`·`prepare` | 계산한 branch가 예상 checkout이 아닌 다른 곳에 이미 있습니다. suffix를 붙이지 않고 멈춥니다 |
| `unassigned-integration-worktree` | `bootstrap`·`status`·`prepare`·`record`·`integrate`·`critical-recovery`·`release` | integration 경로가 등록된 worktree가 아니거나 symlink로 바뀌었습니다 |
| `unassigned-worker-worktree` | `prepare`·`record` | worker 경로가 등록된 worktree가 아니거나, 원장이 기억하는 경로와 다릅니다 |
| `missing-ledger` | `status`·`prepare`·`record`·`integrate`·`critical-recovery`·`release`·`revise` | integration worktree에 원장이 없습니다. 먼저 `bootstrap` |
| `task-required` / `task-outside-blueprint` | `record`·`integrate`·`critical-recovery`·`revise` | `--task`가 없거나 세 자리 형식이 아니거나, 그 blueprint의 task가 아닙니다 |
| `missing-blueprint` | `prepare` | integration worktree에 blueprint 디렉터리가 없습니다. worker worktree를 만들기 전 판정 단계에서 `blueprintDir`, `integrationPath`와 함께 거절하며, 원장과 Git worktree 등록은 바뀌지 않습니다 |
| `missing-verification-bundle` | `prepare` | ready wave의 verification node bundle(`tasks/<NNN>`)이 integration worktree에 없습니다. `missing-blueprint`와 같은 판정 단계에서, 같은 wave의 commit task worker worktree를 만들기 전에 거절합니다. main에서 되살리지 않고 원장과 Git worktree 등록도 바꾸지 않습니다 |
| `missing-worktree` / `copy-failed` | `prepare` | `prepare`가 worker에 integration의 계획 문서를 seed하다 실패했습니다. `seed-worktree` 코어가 내는 코드를 `prepare`가 그대로 표면화한 것입니다 — worker 경로가 디렉터리가 아니거나 복사가 실패했습니다. 실패는 main 문서와 다른 worker의 문서를 바꾸지 않습니다 |
| `illegal-transition` | `record`·`critical-recovery` | `record` 또는 recovery 시작 대상이 `prepared`가 아닙니다 |
| `critical-recovery-exhausted` | `critical-recovery` | 시작 기록이 이미 있는 task에 두 번째 recovery 시작을 시도했습니다 |
| `critical-recovery-not-started` | `critical-recovery` | 시작 기록 없이 `--outcome` 결과를 쓰려 했습니다 |
| `critical-recovery-closed` | `critical-recovery` | outcome이 이미 있는 recovery의 결과를 다시 쓰려 했습니다 |
| `critical-recovery-outcome-invalid` | `critical-recovery` | `--outcome` 값이 `resolved` 또는 `blocked`가 아닙니다 |
| `critical-recovery-invalid` | `critical-recovery` | 원장의 recovery가 `used: 1`과 필수 필드 형태를 지키지 않습니다. 원장은 쓰지 않습니다 |
| `findings-required` | `critical-recovery` | 시작 기록에 `--findings`가 없거나 값 없는 `--findings`만 있습니다 |
| `reason-required` | `critical-recovery` | 시작·결과 기록에 비어 있지 않은 `--reason`이 없습니다 |
| `sha-not-worker-head` | `record` | `--sha`가 그 worker의 HEAD가 아닙니다 |
| `not-recorded` | `integrate` | `integrate` 대상이 `recorded`가 아닙니다. 이미 `integrated`인 task를 다시 부른 경우도 여기 걸려 중복 cherry-pick을 막습니다 |
| `sha-not-owned-by-worker` | `integrate` | 기록된 SHA가 그 worker HEAD의 조상이 아닙니다 |
| `stale-integration-head` | `integrate` | integration worktree HEAD가 원장이 아는 값과 다릅니다. 원장은 그대로 남습니다 |
| `worker-evidence-not-terminal` | `integrate` | commit task의 worker bundle 문서 중 terminal 상태(tasks `verified`, verification `passed`, review `accepted`)가 아니거나 없거나 frontmatter를 읽을 수 없는 문서가 있습니다. 그 문서들을 `files`로 반환하며 복사·cherry-pick·원장 쓰기를 하지 않습니다 |
| `worker-evidence-sha-mismatch` | `integrate` | worker `tasks.md`의 `commit_sha`가 원장에 기록된 SHA의 앞 8자리와 다릅니다. 그 `tasks.md`를 `files`로 반환하며 복사·cherry-pick·원장 쓰기를 하지 않습니다 |
| `main-worktree-source-write` | `revise` | `revise`를 main checkout에서 불렀습니다 |
| `unassigned-worktree` | `revise` | `revise`를 그 task에 배정되지 않은 checkout에서 불렀습니다 |
| `decision-reason-required` / `scope-paths-required` | `revise` | `--reason`이 비었거나 유효한 `--paths` 값이 없습니다 |
| `scope-path-glob` / `scope-path-out-of-bounds` | `revise` | 개정 경로가 glob이거나 허용 경계 밖입니다. 어긴 경로가 `paths`에 실립니다 |
| `task-document-missing` | `revise` | task 문서를 읽을 수 없거나 `bouncer` 블록이 없습니다 |
| `ledger-locked` / `ledger-lock-lost` | `revise` | 다른 쓰기가 원장 잠금을 쥐고 있거나 임계 구역 중에 잠금을 잃었습니다. 다시 시도하세요 |
| `unreadable-ledger` | `revise` | 원장 JSON을 읽을 수 없습니다. `revise`는 위치(main checkout인지, 배정된 worker인지)를 먼저 보므로 위치가 틀리면 이 코드 대신 위치 코드가 나옵니다 |

`unreadable-ledger`를 `reason`으로 내는 서브커맨드는 `revise`뿐입니다.
`bootstrap`·`status`(별칭 `ready` 포함)·`prepare`·`record`·`integrate`·`critical-recovery`·`release`는 원장을 가드 없이
파싱하므로, 손상된 원장을 만나면 거절 코드가 아니라 파싱 예외가 stderr에
`coordinate: Unexpected token …` 한 줄로 나오고 종료 코드는 1입니다.
`bootstrap`의 `loadLedger(...) || {…}` 대체도 예외가 아닙니다 — 그 대체는
원장 파일이 **없을** 때만 새 원장을 세우고, 파일이 있으면 그대로 파싱하므로
손상된 파일은 덮지 못합니다. 손상 원장 위에서 `bootstrap`을 다시 돌려도
복구되지 않고 같은 파싱 예외가 납니다. stdout JSON의 `reason`만 보고 있으면
이 경우를 놓칩니다.

#### 커밋 가드에서만 나오는 코드

아래 둘은 `coordinate` 서브커맨드가 아니라 `bouncer commit`과 `commit-safety`
훅의 범위 판정이 냅니다. 두 자리는 같은 코드를 서로 다른 채널로 냅니다 —
`bouncer commit`은 stdout JSON의 `reason` 필드에 코드만 싣고, `commit blocked:
<reason>` 문자열을 만드는 쪽은 훅뿐입니다. 복구 절차는
[troubleshooting.md](troubleshooting.md)에 있습니다. 위 표의
`unreadable-ledger`는 `revise`와 커밋 가드 양쪽에서 나오는데, 커밋 가드 쪽은
`revise`와 달리 위치를 보기 전에 원장을 먼저 읽습니다. 읽을 수 없는 원장
하나가 main checkout 거절보다 먼저 걸리는 것은 파일 손상만으로 위치 판정이 풀리지 않게 하기
위해서입니다.

| `reason` | 뜻 |
| --- | --- |
| `stale-revision` | task 문서의 `scope_revision`과 원장의 `revision`이 다릅니다 |
| `missing-coordinator-ledger` | 배정된 worktree에 원장이 없습니다. 손상되거나 사라진 원장 하나가 모든 checkout의 커밋을 막습니다 |

fan-in 충돌은 `reason` 코드가 아니라 cherry-pick 실패입니다. Git stderr가
`coordinate: …`로 나오고 원장은 갱신되지 않습니다. cherry-pick 전에 복사한
task bundle 세 문서는 복사 전 바이트로 되돌리고, 복사 전에 없던 문서는 지웁니다. 복사 전에
`tasks/<NNN>/` 디렉터리가 없었다면 복사가 만든 그 디렉터리도 지웁니다 — 복구 절차는
[troubleshooting.md](troubleshooting.md)에 있습니다.

`context-search`는 exact anchor/path, domain tag, intent/evidence를 점수화하고
broad-query와 zero-hit을 빈 후보로 진단합니다. Graphify build/version이
호환되지 않으면 검색을 진행하지 않습니다.
종료 코드는 도움말 0, 게이트 실패 1, 사용법 오류 2입니다.
