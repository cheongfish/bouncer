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
| `bouncer commit --blueprint <dir> [--yes]` | task 커밋 범위 확인, `--yes`면 그 task만 커밋. 포인터는 옮기지 않음 |
| `bouncer finalize --blueprint <dir> [--yes]` | 마감 게이트(G16) + 남은 변경(보통 Distill 승격) 범위 확인. `--yes`면 스테이징 전에 검증 명령을 실행하고, 통과하면 커밋 후 포인터 clear |
| `bouncer seed-worktree --blueprint <dir> --to <worktree>` | plan 컨텍스트 문서를 base 체크아웃에서 worktree로 이전하고 base를 원상복구. 옮길 것이 없으면 성공 |
| `bouncer init` | `.bouncer/` 부트스트랩. 덮어쓰지 않음 |
| `bouncer project-root [--repo <dir>]` | 소비 저장소 main worktree 절대 경로 한 줄(stdout만). primary·linked worktree에서 같은 값. 비-Git이면 stderr + 종료 코드 1(빈 stdout·cwd 대체 없음) |
| `bouncer distill --for <path> [--json]` | 대상 경로에 맞는 Distill 본문을 출력. `--all`은 routing 설정과 무관하게 전량 본문을 출력하고, `--preflight`는 `always` 샤드 본문과 등록 인벤토리만, `--route <path>`는 선택 JSON, `--audit`는 전량 감사 JSON을 출력 |
| `bouncer current [--set <dir> [--task <NNN\|TASKS-NNN>]] [--clear]` | 활성 포인터 읽기 / 기록 / 지우기. `--task` 없이 `--set`하면 번호 오름차순 첫 `ready`/`in_progress` task를 고르고, 열린 후보가 없으면 task 없이 쓴다. 출력의 `task`는 `{path, id}`(미지정이면 `null`); `scale`은 호출 시점에 blueprint `index.md`의 `bouncer.scale`에서 파생한 문자열(없거나 읽을 수 없으면 `null`). 포인터 파일은 `{ blueprint, task?, base }`만 저장. 없으면 `ready` 후보 |
| `bouncer migrate ids [--dry-run]` | 구형 `EPIC-`/`BP-` context 디렉터리를 숫자 id로 이관(계획 또는 적용) |
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

모든 명령이 `--repo <dir>`로 다른 저장소를 대상으로 실행할 수 있습니다.

`distill`의 `--for`는 경로를 확정한 뒤 선택 라우팅을 수행하며, `--json`은 본문과
선택 메타데이터(`ids`, `full`, `reason`, `targetPaths`)를 JSON으로 감쌉니다.
라우팅이 비활성화되었거나 매칭·메타데이터가 불확실하면 전량을 사용하고 진단은
stderr로만 보냅니다. `--all`과 `--audit`는 항상 인덱스의 모든 샤드를 대상으로
합니다. `--preflight`는 경로 확정 전에 `always: true` 샤드 본문만 고르고,
`audit.shards`에는 등록 전체를 그대로 담습니다. `--route`와 `--audit`은
선택/감사 정보가 목적이므로 JSON을 출력합니다.
JSON의 `audit.shards`는 인덱스에 등록된 전체 샤드를 등록 순서대로 담으며, 각 항목은
`id`, `path`, `always`, `pathsKnown`, `pullsKnown`과 선언된 경우의 `paths`, `pulls`만
포함합니다. 본문·원문은 포함하지 않고, `--route`/`--for`에서 선택된 샤드로 줄어들지
않습니다. 단일 파일 fallback에서는 빈 배열입니다.
종료 코드는 도움말 0, 게이트 실패 1, 사용법 오류 2입니다.
