---
type: bouncer.tasks
title: CLI 커맨드 레지스트리 분해
description: cli.ts의 13개 핸들러를 커맨드 모듈로 나누고 USAGE를 레지스트리에서 파생한다
resource: .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T09:53:11.293+09:00'
bouncer:
  id: TASKS-002
  epic_id: '035'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 명령 하나를 고치려면 한 파일 전체를 읽어야 했고, 사용법 문자열과 실제 분기가 따로 놀아 어긋나도 드러나지 않았음
    - 명령마다 실행과 사용법을 한 자리에 묶고 도움말을 그 목록에서 만들어 냄
  affected_paths:
    - scripts/src/lib/cli.ts
    - scripts/src/lib/cli-flags.ts
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/src/lib/cli-git-commands.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/src/lib/cli-current-command.ts
    - scripts/lib/cli.js
    - scripts/lib/cli-flags.js
    - scripts/lib/cli-doc-commands.js
    - scripts/lib/cli-git-commands.js
    - scripts/lib/cli-project-commands.js
    - scripts/lib/cli-current-command.js
  graph:
    generated_at: '2026-08-14T10:05:38.205+09:00'
    command: graphify query "validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig
        result: 46 nodes; cmdValidate/cmdScaffold/cmdCurrent 등 cli.ts 핸들러가 통째로 회수됨. 이미 제거된 cmdAdvise 노드도 있어 그래프가 최신이 아님.
      - graph: context
        status: updated
        query: scripts 코어 모듈 분해 리팩토링 TypeScript 구조
        result: 4 nodes; epic 006-scripts-typescript와 이번 035 인덱스만. 코드 경로 힌트 없음.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`cli.ts` 495줄이 명령군별 모듈로 나뉘고, `USAGE` 문자열이 명령 목록에서
파생된다. 지금은 `USAGE` 상수와 `switch` 분기가 서로를 모른 채 나열되어 있어,
명령을 추가하거나 지울 때 한쪽만 고쳐도 아무것도 막지 않는다. 각 명령이
「실행 함수 + 자기 사용법 블록」을 한 자리에 갖게 하면 그 어긋남이 구조적으로
불가능해진다.

출력은 바이트 단위로 동일해야 한다. `bouncer`, `bouncer help`, `bouncer --help`,
`bouncer -h`가 내는 문자열과 알 수 없는 명령의 stderr 동작이 전과 같다.

## Interface
- 제공: `cli.ts`가 명령 레지스트리를 갖는다. 항목 하나는
  `{ run(rest, io): number, usage: string }` 형태이고, 키가 명령 이름이다.
  `USAGE`는 헤더 + 각 항목의 `usage` 블록 + 꼬리말을 이어 붙여 만든다.
  디스패치는 `switch`가 아니라 레지스트리 조회다.
- 거부: 레지스트리에 없는 명령은 지금과 같은 stderr 메시지와 종료 코드로
  거부한다. 명령 이름·플래그·별칭을 추가하거나 바꾸지 않는다.
- 제공: `module.exports = { runCli, parseFlags }` — 키 집합 그대로.

## Touch
- Create `scripts/src/lib/cli-flags.ts` — `parseFlags`를 옮긴다.
- Create `scripts/src/lib/cli-doc-commands.ts` — `cmdValidate`, `cmdVerify`,
  `cmdScaffold`.
- Create `scripts/src/lib/cli-git-commands.ts` — `cmdCommit`, `cmdFinalize`,
  `cmdSeedWorktree`, `cmdImport`.
- Create `scripts/src/lib/cli-project-commands.ts` — `cmdInit`, `cmdGraphSync`,
  `cmdGraphifyBin`, `cmdProjectRoot`, `cmdMigrate`.
- Create `scripts/src/lib/cli-current-command.ts` — `cmdCurrent`(99줄)를 옮긴다.
- Modify `scripts/src/lib/cli.ts` — 레지스트리, `USAGE` 조립, `runCli`,
  `module.exports`만 남긴다.
- Create `scripts/lib/cli-flags.js` — emit.
- Create `scripts/lib/cli-doc-commands.js` — emit.
- Create `scripts/lib/cli-git-commands.js` — emit.
- Create `scripts/lib/cli-project-commands.js` — emit.
- Create `scripts/lib/cli-current-command.js` — emit.
- Modify `scripts/lib/cli.js` — emit.

## Do not touch
- `test/**` — 특히 `test/cli-help.test.js`가 USAGE 출력을 고정한다. 이 테스트가
  깨지면 파생이 틀린 것이지 테스트가 틀린 것이 아니다.
- `scripts/bouncer` — 진입점은 `require('./lib/cli')`를 그대로 쓴다.
- `scripts/src/lib/validate.ts`, `scripts/src/lib/session-graph.ts`,
  `scripts/src/lib/import-history.ts` — task 003·004의 대상이다. 이 task에서는
  호출만 하고 열지 않는다.
- `hooks/**`, `scripts/vendor/**`.

## Constraints
- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 명령 핸들러는
  플래그 검증 순서와 종료 코드 선택 근거를 특히 남긴다. 파일이 나뉘면서 원래
  문맥에서 떨어지는 코드일수록 이 주석이 그 문맥을 대신한다.
- `USAGE` 출력이 문자 단위로 같아야 한다. 레지스트리 선언 순서가 현재 USAGE
  나열 순서이고, 디스패치는 키 조회라 순서에 의존하지 않는다.
- 명령 모듈은 `cli.ts`를 require하지 않는다(순환 금지). 공통 유틸이 필요하면
  `cli-flags.ts`에 둔다.
- 새 모듈은 상대 경로와 `node:` 내장만 require한다
  (`test/distribution.test.js`).
- 명령 핸들러 시그니처 `(rest, io) => number`를 유지한다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.

## Checklist
- [ ] 코드를 건드리기 전에 USAGE 기준선을 뜬다:
      `node scripts/bouncer --help > /tmp/usage-before.txt`.
- [ ] `parseFlags`를 `cli-flags.ts`로 옮기고 `cli.ts`가 그것을 재수출하는지
      확인한다 — `require('../scripts/lib/cli').parseFlags`를 쓰는 테스트가 있다.
- [ ] `cmd*` 함수를 위 네 모듈로 옮긴다. 본문은 손대지 않고 이동만 한다.
- [ ] 각 명령의 USAGE 블록을 해당 모듈의 항목으로 옮겨 실행 함수와 같은 자리에
      둔다.
- [ ] `cli.ts`에 레지스트리를 만든다. 선언 순서는 현재 USAGE 나열 순서와
      같게: `validate, verify, scaffold, commit, finalize, seed-worktree, init,
      graph-sync, graphify-bin, project-root, current, migrate, import`.
- [ ] `USAGE`를 레지스트리에서 조립한다. 헤더(`usage: bouncer <command>
      [options]`)와 꼬리말(`Every command accepts --repo <dir> ...`)은 `cli.ts`에
      남긴다.
- [ ] `runCli`의 디스패치를 `switch`에서 레지스트리 조회로 바꾼다.
      `undefined | 'help' | '--help' | '-h'`가 USAGE를 내고 `0`을 반환하는
      경로와, 알 수 없는 명령의 stderr 경로를 그대로 둔다.
- [ ] 출력이 동일한지 diff로 확인한다. 기준선은 **코드를 건드리기 전 첫
      단계에서** 떠 둔다 — `git stash`는 미추적 파일을 치우지 않아 새 `cli-*.js`
      emit이 그대로 남고, `stash pop`이 `scripts/lib/cli.js`에서 충돌할 수 있다.
      ```bash
      # 작업 시작 전
      node scripts/bouncer --help > /tmp/usage-before.txt
      # 작업 후
      npm run build && node scripts/bouncer --help > /tmp/usage-after.txt
      diff /tmp/usage-before.txt /tmp/usage-after.txt
      ```
- [ ] `cli.ts`와 새 모듈이 각각 400줄 이하인지 확인한다.
- [ ] `npm test`가 `test/**` 수정 없이 통과한다 (`cli-help`, `cli-validate`,
      `cli-current`, `cli-init`, `cli-verify`, `cli-commit`, `cli-project-root`).
- [ ] `npm run lint`가 통과하고 `git diff --exit-code -- scripts/lib`가 빌드 후
      깨끗하다.
