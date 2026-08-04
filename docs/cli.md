# CLI

스킬(`/bouncer-*`)이 내부에서 부르는 스크립트를 직접 쓸 수도 있습니다.
`bouncer` 또는 `bouncer --help`로 목록을 볼 수 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `bouncer validate --blueprint <dir> --gate <plan\|execute\|finalize>` | 구조 검사 + 게이트 하나. 실패 코드를 보고 |
| `bouncer verify --blueprint <dir>` | `tasks.bouncer.verify`(있으면) 또는 `config.verify`를 실행하고 증적을 기록 |
| `bouncer scaffold epic\|blueprint ...` | 올바른 프론트매터로 문서 세트 생성 |
| `bouncer finalize --blueprint <dir> [--yes]` | 커밋 범위 확인, `--yes`면 커밋까지 |
| `bouncer seed-worktree --blueprint <dir> --to <worktree>` | plan 컨텍스트 문서를 base 체크아웃에서 새 worktree로 이전하고 base를 원상복구 |
| `bouncer init` | `.bouncer/` 부트스트랩. 덮어쓰지 않음 |
| `bouncer advise` | 현재 단계에 권장되는 Ponytail 모드 출력 |
| `bouncer current [--set <dir>] [--clear]` | 활성 포인터 읽기 / 기록 / 지우기. 없으면 `ready` 후보 |

모든 명령이 `--repo <dir>`로 다른 저장소를 대상으로 실행할 수 있습니다.
종료 코드는 도움말 0, 게이트 실패 1, 사용법 오류 2입니다.
