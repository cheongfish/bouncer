---
type: bouncer.tasks
title: usage text plus --help/-h/help dispatch and a listed subcommand set
description: Tasks for BP-001
resource: .bouncer/context/epics/EPIC-001-cli-usability/blueprints/BP-001-cli-help/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-07-27T02:39:49.182Z'
bouncer:
  id: TASKS-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: verified
  affected_paths:
    - scripts/lib/cli.js
    - test/cli-help.test.js
    - README.md
  graph:
    generated_at: '2026-07-27T02:39:49.182Z'
    command: manual
    suggested_paths:
      - scripts/lib/cli.js
    basis: graphify disabled in .bouncer/config.json; paths derived by reading the runCli dispatch switch in scripts/lib/cli.js
---
# Tasks

## Goal & intent

`bouncer` CLI가 스스로 사용법을 설명하게 한다. 팀 배포에서 첫 사용자가
`bouncer`를 그냥 쳐봤을 때 명령 목록을 얻어야 한다.

## Interface

- `bouncer` (인자 없음) → 사용법을 stdout에 출력, exit 0
- `bouncer --help` / `bouncer -h` / `bouncer help` → 동일, exit 0
- `bouncer <알 수 없는 명령>` → stderr에 오류 + 사용법, exit 2 (기존 동작 유지)
- 사용법에는 `validate`, `scaffold`, `finalize`, `verify`, `init`, `advise`가
  각각 한 줄 설명과 함께 나열된다.

## Touch

- `scripts/lib/cli.js` — `runCli` 디스패치에 도움말 분기 추가
- `test/cli-help.test.js` — 새 테스트 파일
- `README.md` — CLI 서브커맨드 절 추가

## Do not touch

- `scripts/vendor/` — 벤더링된 서드파티 코드
- `hooks/` — 이 blueprint와 무관
- `.claude-plugin/` — 배포 매니페스트

## Checklist

- [x] `bouncer` 인자 없이 실행하면 사용법 + exit 0 (실패 테스트 먼저)
- [x] `--help` / `-h` / `help` 동일 동작
- [x] 알 수 없는 명령은 사용법을 함께 내되 exit 2 유지
- [x] 6개 서브커맨드가 모두 사용법에 나열되는지 테스트로 고정
- [x] README에 CLI 절 추가
