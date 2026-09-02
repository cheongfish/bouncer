---
type: bouncer.tasks
title: 워크플로 서술을 자동 주행까지 확장
description: Tasks for 003
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/008-run-loop/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T18:02:00.160+09:00'
bouncer:
  id: TASKS-003
  epic_id: '009'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - 커맨드가 늘었는데 워크플로를 설명하는 문서들은 다섯 단계만 말하고 있어 새 경로가 보이지 않음
    - 수동 순서를 그대로 둔 채 자동 주행을 대체 경로로 덧붙이고, 선행 스킬 테스트 allowlist 누락을 함께 고침
  affected_paths:
    - CLAUDE.md
    - docs/workflow.md
    - docs/ARCHITECTURE.md
    - docs/governance.md
    - README.md
    - test/master-rules.test.js
    - test/public-name-regression.test.js
  graph:
    generated_at: '2026-08-12T18:20:00+09:00'
    command: graphify query "autonomous run loop skill autonomy config schema init default workflow command execute commit pointer" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - docs
      - test
    basis:
      - graph: source
        status: reused
        query: autonomous run loop skill autonomy config schema init default workflow command execute commit pointer
        result: 67 nodes; test/master-rules.test.js 계열이 워크플로 순서 단언을 들고 있음. docs/·CLAUDE.md·README.md는 source_dirs 밖이라 손으로 더함
      - graph: context
        status: updated
        query: autonomous run loop skill autonomy config schema init default workflow command execute commit pointer
        result: 6 nodes; epic index.md Success criteria만 잡힘 — 문서 서술 대상은 컨텍스트 그래프 범위 밖
---
# Tasks

Blueprint: [008](../../index.md)

## Goal & intent
워크플로를 설명하는 문서가 `/bouncer-run`을 알게 된다. 수동 다섯 단계는 그대로
정본으로 남고, 자동 주행은 execute→commit 구간을 대신 도는 **대체 경로**로
덧붙는다. 이 task는 문서와 그 문서를 보는 테스트만 건드린다.

## Interface
- 제공:
  - `CLAUDE.md` — 하드룰 5의 다섯 단계 화살표 문장은 그대로 두고, 그 아래에
    `/bouncer-run`이 execute→commit 구간을 반복하는 대체 경로라는 문장을 더한다.
    「When to invoke」 표에 행 하나를 추가한다.
    ```markdown
    | Run one blueprint to task exhaustion | `/bouncer-run` |
    ```
  - `docs/workflow.md` — 「자동 주행」 절 신설. 시작 ACQ 하나, 종료 조건(task
    소진), 중단 지점 셋(verify 1회, review 2회, 범위 위반), 중단 시 포인터·
    worktree 유지와 `/bouncer-execute` 재개, `autonomy` 두 값의 차이를 적는다.
    「How it works」 블록에 자동 주행 줄을 더한다.
  - `docs/ARCHITECTURE.md` §2 — 다섯 단계 목록 아래에 `/bouncer-run`이 같은
    단계를 부르는 드라이버이며 단계 계약을 새로 만들지 않는다는 문장을 더한다.
  - `docs/governance.md` — `/bouncer-commit`이 task 하나를 닫는다는 문단에,
    `/bouncer-run`이 그 커밋 단위를 바꾸지 않고 반복만 한다는 문장을 더한다.
  - `README.md` 커맨드 목록에 한 줄을 더한다.
    ```
    /bouncer-run       # execute→commit 반복 주행 (task 소진까지)
    ```
  - `test/master-rules.test.js` — `workflow skills instruct reading CLAUDE.md
    before steps`의 스킬 목록에 `'bouncer-run'`을 넣고, 「When to invoke」 표에
    `/bouncer-run` 행이 있는지 단언을 더한다.
  - `test/public-name-regression.test.js` — `SUPERPOWERS_NEGATIVE_TESTS`에
    `'test/skill-bouncer-run.test.js'`를 넣는다(TASKS-002 네거티브 단언 allowlist
    누락).
- 거부:
  - 하드룰 5의 다섯 단계 화살표 순서를 고치지 않는다. 수동 경로가 정본이고,
    `test/master-rules.test.js`의 순서 정규식이 그대로 통과해야 한다.
  - 자동 주행을 기본 경로로 서술하지 않는다. 두 경로가 공존한다.
  - 상한·중단 규칙의 정본을 문서로 옮기지 않는다. 정본은 `/bouncer-run`
    SKILL.md이며 문서는 요약만 한다.

## Touch
- Modify `CLAUDE.md` — 하드룰 5 보충 문장과 「When to invoke」 행 추가
- Modify `docs/workflow.md` — 「자동 주행」 절과 「How it works」 줄 추가
- Modify `docs/ARCHITECTURE.md` — §2에 드라이버 문장 추가
- Modify `docs/governance.md` — 커밋 단위가 그대로임을 명시
- Modify `README.md` — 커맨드 목록 한 줄 추가
- Modify `test/master-rules.test.js` — 스킬 목록에 `bouncer-run` 추가, 표 행 단언 추가
- Modify `test/public-name-regression.test.js` — `skill-bouncer-run`을 Superpowers 네거티브 allowlist에 추가

## Do not touch
- `skills/` 전체 — 스킬 본문은 TASKS-002가 확정했다
- `scripts/` 전체 — 하네스 코드는 건드리지 않는다
- `docs/PILOT.md` · `docs/troubleshooting.md` · `docs/contributing.md` — 수동 경로를 설명하는 문서이며 그 서술이 계속 맞다
- `docs/cli.md` — 새 CLI 명령이 없다
- `CHANGELOG.md` — 릴리스 문서는 별도 흐름이다

## Constraints
- 한국어 본문에 `stop-slop`을 적용한다. "원활하게" "효율적으로" 같은 채움말과
  같은 말 반복을 넣지 않는다.
- 문서마다 같은 규칙을 길게 되풀이하지 않는다. 각 문서는 자기 층위에서 한 번만
  말하고 자세한 것은 `/bouncer-run`으로 넘긴다.
- 본문은 문서·계약 테스트 위주다. `CLAUDE.md` 표 행은
  `test/master-rules.test.js` 단언으로 고정하고, TASKS-002 allowlist 누락만
  `public-name-regression`에 한 줄로 고친다.

## Checklist
- [x] `test/master-rules.test.js`에 실패하는 단언을 먼저 넣고 실패를 확인한다.
      ```js
      assert.match(claude, /\|\s*Run one blueprint to task exhaustion\s*\|\s*`\/bouncer-run`\s*\|/);
      ```
      같은 파일의 워크플로 스킬 목록에 `'bouncer-run'`을 더한다.
- [x] `CLAUDE.md` 하드룰 5에 대체 경로 문장을 더하고 「When to invoke」 표에
      행을 추가한다. 다섯 단계 화살표는 건드리지 않는다.
- [x] `docs/workflow.md`에 「자동 주행」 절과 「How it works」 줄을 더한다.
- [x] `docs/ARCHITECTURE.md` §2와 `docs/governance.md`에 각각 한 문장을 더한다.
- [x] `README.md` 커맨드 목록에 한 줄을 더한다.
- [x] `test/public-name-regression.test.js`의 `SUPERPOWERS_NEGATIVE_TESTS`에
      `'test/skill-bouncer-run.test.js'`를 넣는다.
- [x] `npm test`가 통과한다(순서 정규식·표 단언·allowlist가 함께 통과하는지 확인).
