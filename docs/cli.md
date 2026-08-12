# CLI

스킬(`/bouncer-*`)이 내부에서 부르는 스크립트를 직접 쓸 수도 있습니다.
`bouncer` 또는 `bouncer --help`로 목록을 볼 수 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `bouncer validate --blueprint <dir> --gate <plan\|execute\|commit\|finalize>` | 구조 검사 + 게이트 하나. 실패 코드를 보고 |
| `bouncer verify --blueprint <dir>` | `tasks.bouncer.verify`(있으면) 또는 `config.verify`를 실행하고 증적을 기록 |
| `bouncer scaffold epic\|blueprint ...` | 올바른 프론트매터로 epic / blueprint와 첫 task 묶음 생성 |
| `bouncer scaffold task --blueprint <dir> --id <NNN>` | `tasks/<NNN>/{tasks,verification,review}.md` task 묶음 생성. 대상 blueprint가 `closed`(마감)면 아무 문서도 만들지 않고 새 blueprint를 만들라는 안내와 함께 종료 코드 2로 거절 |
| `bouncer scaffold explain --blueprint <dir>` | BP `explain.md` 생성(`comprehension: []`). `/bouncer-finalize`가 호출 |
| `bouncer commit --blueprint <dir> [--yes]` | task 커밋 범위 확인, `--yes`면 그 task만 커밋. 포인터는 옮기지 않음 |
| `bouncer finalize --blueprint <dir> [--yes]` | 마감 게이트(G16) + 남은 변경(보통 Distill 승격) 범위 확인, `--yes`면 커밋 후 포인터 clear |
| `bouncer seed-worktree --blueprint <dir> --to <worktree>` | plan 컨텍스트 문서를 base 체크아웃에서 worktree로 이전하고 base를 원상복구. 옮길 것이 없으면 성공 |
| `bouncer init` | `.bouncer/` 부트스트랩. 덮어쓰지 않음 |
| `bouncer current [--set <dir> [--task <NNN\|TASKS-NNN>]] [--clear]` | 활성 포인터 읽기 / 기록 / 지우기. `--task` 없이 `--set`하면 번호 오름차순 첫 `ready`/`in_progress` task를 고르고, 열린 후보가 없으면 task 없이 쓴다. 출력의 `task`는 `{path, id}`(미지정이면 `null`); 포인터 파일은 path 문자열만 저장. 없으면 `ready` 후보 |
| `bouncer migrate ids [--dry-run]` | 구형 `EPIC-`/`BP-` context 디렉터리를 숫자 id로 이관(계획 또는 적용) |
| `bouncer migrate task-layout [--dry-run]` | 구형 루트 task 문서를 `tasks/<NNN>/` 묶음으로 이관합니다. 먼저 dry-run 결과를 확인하세요. |
| `bouncer import [--source merges\|commits] [--since <ref>] [--limit <n>] [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]` | git 히스토리를 `imported` epic/blueprint 문서로 전사. 기본은 dry-run(계획 JSON만 출력). `--yes --message`일 때만 파일을 쓰고 커밋 하나로 남김 |

모든 명령이 `--repo <dir>`로 다른 저장소를 대상으로 실행할 수 있습니다.
종료 코드는 도움말 0, 게이트 실패 1, 사용법 오류 2입니다.
