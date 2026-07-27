---
type: bouncer.blueprint
title: print usage when bouncer runs without a command
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-001-cli-usability/blueprints/BP-001-cli-help/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-07-27T02:39:49.182Z'
bouncer:
  id: BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: approved
---
# BP-001 cli-help

`bouncer`를 인자 없이 실행하거나 `--help`를 주면 사용법을 출력한다.

현재는 셋 다 `unknown command: undefined` 또는 `unknown command: --help`를
stderr로 내고 종료 코드 2로 끝난다. 사용 가능한 명령이 무엇인지 알 방법이 CLI
안에 없다.

한 커밋에 들어가는 이유: 변경 지점이 `runCli`의 디스패치 한 곳이고, 계약은
"도움말은 exit 0, 오류는 exit 2"로 닫힌다.
