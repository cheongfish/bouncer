---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/001-entry-skill-runtime-context/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-11T14:17:19.782+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '069'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 09663776f0ae16d215a608b11751a2b1bf77432b
      diff_sha: 7851d14ae7165e3694581b0c7522d0bb13f761e8a5f48916e2809b6d5ef6350e
      quiz_score: 1/4
      disposition: Q1만 정답 — Distill audit 파일은 맞혔고 commit nextAction·finalize absent ledger·init Master rules는 오답
      recorded_at: '2026-09-11T14:25:56.000+09:00'
  task_commits:
    - id: '001'
      sha: ea6a8278
    - id: '002'
      sha: 0a4fe339
    - id: '003'
      sha: aa67154e
    - id: '004'
      sha: b4649a45
    - id: '005'
      sha: 6b3bcccd
    - id: '006'
      sha: e0cb9af2
  coordinator:
    base: 6467142de1cbc99fecfd78fd83b7ee2b235c9872
    integration_head: 09663776f0ae16d215a608b11751a2b1bf77432b
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/004
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/005
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/001/workers/006
    tasks:
      - id: '001'
        status: integrated
        sha: ea6a8278f5019386f89725a4088fa773095e4ec2
        scope_revision: r1
        paths:
          - scripts/src/lib/execute-prepare.ts
          - scripts/lib/execute-prepare.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/review-round.md
          - test/execute-prepare.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-surface.test.js
          - test/lightweight-cycle.test.js
          - test/cli-help.test.js
          - test/ci-contract.test.js
          - docs/cli.md
          - test/distill-decommission-audit.test.js
        actual_paths:
          - docs/cli.md
          - scripts/lib/cli-git-commands.js
          - scripts/lib/cli.js
          - scripts/lib/execute-prepare.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/cli.ts
          - skills/bouncer-execute/SKILL.md
          - test/ci-contract.test.js
          - test/cli-help.test.js
          - test/distill-decommission-audit.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-surface.test.js
          - scripts/src/lib/execute-prepare.ts
          - skills/bouncer-execute/references/review-round.md
          - test/execute-prepare.test.js
      - id: '002'
        status: integrated
        sha: 0a4fe3391d32e5a461bb457065eb68870e38ae30
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - scripts/lib/cli-doc-commands.js
          - scripts/lib/cli.js
          - scripts/lib/plan-inspect.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/src/lib/cli.ts
          - skills/bouncer-plan/SKILL.md
          - test/ci-contract.test.js
          - test/cli-help.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-surface.test.js
          - scripts/src/lib/plan-inspect.ts
          - skills/bouncer-plan/references/scope-confirm.md
          - test/plan-inspect.test.js
      - id: '003'
        status: integrated
        sha: aa67154e34251c6ba4d49c658eb568b495304e0e
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - skills/bouncer-run/SKILL.md
          - test/cli-help.test.js
          - test/skill-bouncer-run.test.js
          - scripts/lib/run-preflight.js
          - scripts/src/lib/run-preflight.ts
          - test/run-preflight.test.js
      - id: '004'
        status: integrated
        sha: b4649a4546b2ecf97aa334305dadf8ea1e1591e0
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - scripts/lib/commit.js
          - scripts/src/lib/commit.ts
          - skills/bouncer-commit/SKILL.md
          - test/commit-task.test.js
          - test/skill-bouncer-commit.test.js
      - id: '005'
        status: integrated
        sha: 6b3bcccd75f00a6db9c9b266d201e22413f75e98
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - scripts/lib/finalize.js
          - scripts/src/lib/finalize.ts
          - skills/bouncer-finalize/SKILL.md
          - test/finalize.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - skills/bouncer-finalize/references/remainder.md
      - id: '006'
        status: integrated
        sha: e0cb9af277b16a0878f84c944f6d0bce60ee95ca
        scope_revision: null
        paths: []
        actual_paths:
          - docs/workflow-contract.md
          - skills/bouncer-init/SKILL.md
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
    decisions:
      - task: '001'
        kind: scope
        reason: npm test G13 fails on pre-existing Distill live-read after 068 removal; take distill-decommission-audit.test.js so execute-prepare verify can pass without restoring Distill on main
        previous:
          - scripts/src/lib/execute-prepare.ts
          - scripts/lib/execute-prepare.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/review-round.md
          - test/execute-prepare.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-surface.test.js
          - test/lightweight-cycle.test.js
          - test/cli-help.test.js
          - test/ci-contract.test.js
          - docs/cli.md
        next:
          - scripts/src/lib/execute-prepare.ts
          - scripts/lib/execute-prepare.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/review-round.md
          - test/execute-prepare.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-surface.test.js
          - test/lightweight-cycle.test.js
          - test/cli-help.test.js
          - test/ci-contract.test.js
          - docs/cli.md
          - test/distill-decommission-audit.test.js
        revision: r1
      - task: '001'
        decision: 'accepted TASKS-001: execute prepare CLI, skill shrink, Distill audit ENOENT fix (r1). implementer then debugger then implementer then reviewer r1/r2. paths: docs/cli.md, scripts/lib/cli-git-commands.js, scripts/lib/cli.js, scripts/lib/execute-prepare.js, scripts/src/lib/cli-git-commands.ts, scripts/src/lib/cli.ts, skills/bouncer-execute/SKILL.md, test/ci-contract.test.js, test/cli-help.test.js, test/distill-decommission-audit.test.js, test/skill-bouncer-execute.test.js, test/skill-bouncer-surface.test.js, scripts/src/lib/execute-prepare.ts, skills/bouncer-execute/references/review-round.md, test/execute-prepare.test.js'
      - task: '002'
        decision: 'accepted TASKS-002: plan inspect CLI and plan skill shrink. implementer then reviewer r1 F1 then implementer then reviewer r2. paths: docs/cli.md, scripts/lib/cli-doc-commands.js, scripts/lib/cli.js, scripts/lib/plan-inspect.js, scripts/src/lib/cli-doc-commands.ts, scripts/src/lib/cli.ts, skills/bouncer-plan/SKILL.md, test/ci-contract.test.js, test/cli-help.test.js, test/skill-bouncer-plan.test.js, test/skill-bouncer-surface.test.js, scripts/src/lib/plan-inspect.ts, skills/bouncer-plan/references/scope-confirm.md, test/plan-inspect.test.js'
      - task: '003'
        decision: 'accepted TASKS-003: run preflight CLI and run skill shrink. implementer then reviewer r1 no findings. paths: scripts/src/lib/run-preflight.ts, scripts/lib/run-preflight.js, scripts/src/lib/cli-project-commands.ts, scripts/lib/cli-project-commands.js, scripts/src/lib/cli.ts, scripts/lib/cli.js, skills/bouncer-run/SKILL.md, test/run-preflight.test.js, test/skill-bouncer-run.test.js, test/cli-help.test.js, docs/cli.md'
      - task: '003'
        kind: rerecord
        reason: commit succeeded after commit_summary Latin-identifier fix; previous recorded SHA was integration HEAD
        previousSha: 59ac6cf3a7e4e736ff127aad026b5d72233b56d2
        nextSha: aa67154e34251c6ba4d49c658eb568b495304e0e
        integrationHead: 59ac6cf3a7e4e736ff127aad026b5d72233b56d2
      - task: '004'
        decision: 'accepted TASKS-004: commit payload guidance fields and five-step skill. implementer, review r1 F1 rework then r2 F1 resolved F2/F3 accepted. paths: scripts/src/lib/commit.ts, scripts/lib/commit.js, skills/bouncer-commit/SKILL.md, test/commit-task.test.js, test/skill-bouncer-commit.test.js, docs/cli.md'
      - task: '005'
        decision: 'accepted TASKS-005: finalize integration field and remainder reference. implementer then reviewer r1 no findings. paths: scripts/src/lib/finalize.ts, scripts/lib/finalize.js, skills/bouncer-finalize/SKILL.md, skills/bouncer-finalize/references/remainder.md, test/finalize.test.js, test/skill-bouncer-finalize.test.js, test/skill-bouncer-surface.test.js, docs/cli.md'
      - task: '006'
        decision: 'accepted TASKS-006: init Master rules shrink and safety-canon tests. implementer, review r1 F1 rework then r2 F1 resolved F2 accepted. paths: skills/bouncer-init/SKILL.md, test/workflow-safety-canon.test.js, test/skill-bouncer-surface.test.js, test/skill-bouncer-init.test.js, docs/workflow-contract.md'
---
# Explain

## Background

여섯 진입 스킬이 CLI가 계산하는 경로·상태·기본값을 본문에 다시 적었고, 에이전트는 그 문장을 매 호출마다 절차로 읽었다. 코디네이터는 스킬마다 런타임 CLI를 붙이고, 본문은 payload 필드와 해당 단계에서만 여는 reference만 남기게 줄였다. 안전 경계 아홉 행은 스킬 문장에 흩어지지 않고 정본 파일과 cite로 남긴다.

계획 DAG와 최종 DAG는 같다. TASKS-001부터 005는 `depends_on`이 비어 있고 `parallel_safe: false`라 id 순으로 돌렸고, TASKS-006은 001–005가 `integrated`일 때 시작했다. 태스크나 엣지를 추가하거나 순서를 바꾸지 않았다.

## Intuition

스킬 본문은 CLI payload 필드를 읽고, 안전 규칙 위치는 `test/workflow-safety-canon.test.js`가 한 표로 잠근다.

## Code

실제 커밋 경로와 계획 `affected_paths`가 다른 곳은 TASKS-001뿐이다. Distill 제거 이후 `npm test`가 `test/distill-decommission-audit.test.js`의 live-read에서 깨져, scope r1로 그 파일을 넣었다. 나머지 태스크는 계획 범위 안에서 커밋했고, 계획에만 있던 파일 중 일부는 손대지 않았다.

읽어야 할 파일:

- `scripts/src/lib/execute-prepare.ts` — execute 워커 worktree 준비
- `scripts/src/lib/plan-inspect.ts` — plan 점검 payload
- `scripts/src/lib/run-preflight.ts` — run 사전 점검
- `scripts/src/lib/commit.ts` — `controller` / `nextAction` / `stampPath` / `recovery`
- `scripts/src/lib/finalize.ts` — `integration` 보고 필드
- `skills/bouncer-init/SKILL.md` — Master rules에서 plan 전용 rule 제거
- `test/workflow-safety-canon.test.js` — 안전 경계 아홉 행과 init 행

결과 SHA:

| task | worker 브랜치 | worker SHA | integration cherry-pick |
| --- | --- | --- | --- |
| 001 | `bouncer/069-001-001` | `ea6a8278f5019386f89725a4088fa773095e4ec2` | `9be38898b575848c940811a60fbae212d8b5175c` |
| 002 | `bouncer/069-001-002` | `0a4fe3391d32e5a461bb457065eb68870e38ae30` | `59ac6cf3a7e4e736ff127aad026b5d72233b56d2` |
| 003 | `bouncer/069-001-003` | `aa67154e34251c6ba4d49c658eb568b495304e0e` | `8606e13387c69d5ca0ae61b0de74b12cb087a585` |
| 004 | `bouncer/069-001-004` | `b4649a4546b2ecf97aa334305dadf8ea1e1591e0` | `a916879c3cce08e5b855f3d004229c24e253a40a` |
| 005 | `bouncer/069-001-005` | `6b3bcccd75f00a6db9c9b266d201e22413f75e98` | `41ed0d7e34bdd30b7d248c7c399813a2c3bc6d73` |
| 006 | `bouncer/069-001-006` | `e0cb9af277b16a0878f84c944f6d0bce60ee95ca` | `09663776f0ae16d215a608b11751a2b1bf77432b` |

워커는 `bouncer-implementer`가 구현하고 `bouncer-reviewer`가 판정했다. TASKS-001만 `bouncer-debugger` 한 번 뒤에 implementer가 Distill live-read를 끊었다. TASKS-003은 Latin identifier 때문에 한 번 실패한 뒤 `coordinate rerecord`로 worker SHA를 `aa67154e`로 고쳤다.

통합 HEAD `09663776f0ae16d215a608b11751a2b1bf77432b`에서 `npm test` 1293 pass.

## Quiz

1. TASKS-001 scope r1이 `affected_paths`에 넣은 파일은 무엇인가?
   - A) `hooks/commit-safety`
   - B) `test/distill-decommission-audit.test.js`
   - C) `scripts/src/lib/coordinator.ts`

2. `bouncer commit`의 `ok: true` payload에서 드라이브 커밋 뒤 `nextAction` 값은?
   - A) `return-to-coordinator`
   - B) `ask-next-task`
   - C) `confirm-commit`

3. finalize `integration.ledger`가 `absent`일 때 `complete`와 `required`는?
   - A) `complete: false`, `required: true`
   - B) `complete: true`, `required: false`
   - C) `complete: true`, `required: true`

4. init Master rules 블록에서 뺀 plan 전용 rule은?
   - A) `rules/plugin-root.md`와 `rules/acq.md`
   - B) `rules/output.md`와 `rules/current-pointer.md`
   - C) `rules/governance.md`와 `rules/okf.md`

## 이해 상태

정답: 1B (`test/distill-decommission-audit.test.js`), 2A (`return-to-coordinator`), 3B (`complete: true`, `required: false`), 4C (`rules/governance.md`와 `rules/okf.md`).
응답: 1B, 2C, 3A, 4A.
채점: 1 맞음 / 2·3·4 틀림. `quiz_score` 1/4. 낮은 점수는 기록만 하고 마감을 막지 않는다.

## Tasks

### Task 001

#### Goal & intent

Standalone `/bouncer-execute`가 직접 조합하던 worktree 경로 계산, branch 생성, 재사용 판정, seed를 `bouncer execute prepare` 한 명령으로 옮긴다. `skills/bouncer-execute/SKILL.md`는 `Preflight → Prepare → Implement → Verify/recover → Review → Gate` 여섯 번호 단계만 남기고, review round 절차는 review 단계에서만 읽는 skill-local `review-round.md`로 옮긴다.

수용 기준은 새 CLI 회귀 테스트와 갱신한 스킬 테스트가 통과하고 `npm run ci`가 성공하는 것이다.

#### Interface

- 제공: `bouncer execute prepare --blueprint <dir> [--repo <dir>]`. 성공 시 종료 코드 0과 stdout JSON을 낸다.
  ```json
  { "ok": true, "drive": false, "worktreePath": "<abs>", "branch": "feat/001-entry-skill-runtime-context",
    "created": true, "base": "<pointer.base>", "task": { "id": "TASKS-001", "path": "<blueprint>/tasks/001/tasks.md" },
    "scale": "full", "seed": { "moved": [], "restored": [], "config": "copied" } }
  ```
  - 경로는 `worktreePathFor()`가 고르고, branch는 현재 규칙 `<commit_type>/<blueprint-id>-<blueprint-slug>`를 그대로 쓴다(`commit_type` 부재 시 `feat`).
  - 예상 경로에 등록된 worktree가 있으면 `created: false`와 그 worktree의 실제 branch를 반환하고 seed만 다시 실행한다.
  - Coordinator ledger가 있으면 `{ "ok": true, "drive": true, "worktreePath": "<assigned worker path>", "created": false, "task": {…}, "scale": "…" }`를 반환하고 worktree 생성과 seed를 하지 않는다. Drive payload에는 `branch`, `base`, `seed`가 없다.
- 제공: `scripts/src/lib/cli.ts`의 `COMMANDS` 등록표에 `execute` 키를 추가한다.
- 제공: `skills/bouncer-execute/references/review-round.md` — 현재 round 진입 조건(`round <= 2` 또는 조건부 3), 중단 조건, finding status 규칙, `bouncer.review.rounds[]` 기록 항목. 의미는 바꾸지 않고 위치만 옮긴다.
- 거부:
  - pointer가 없으면 `{ "ok": false, "reason": "no-current" }`, 종료 코드 1.
  - pointer가 `--blueprint`와 다른 blueprint를 가리키면 `blueprint-mismatch`, 종료 코드 1.
  - pointer가 모호하거나 충돌하면 `CURRENT_AMBIGUOUS`·`CURRENT_INVALID` 코드를 그대로 싣고 종료 코드 1.
  - 예상 경로에 Git에 등록되지 않은 디렉터리가 있으면 `unregistered-worktree`, 종료 코드 1, 쓰기 없음.
  - `git worktree add`가 실패하면 `worktree-add-failed`와 stderr 요약, 종료 코드 1.
  - seed가 conflict를 보고하면 `seed-conflict`와 conflict 목록, 종료 코드 1. 이미 만든 worktree는 보존한다.

#### Do not touch

- `scripts/src/lib/seed-worktree.ts` — seed 계약을 그대로 재사용한다
- `scripts/src/lib/runtime-state.ts` — 경로 규칙과 branch helper는 BP003 소관이다
- `scripts/src/lib/coordinator.ts` — drive worktree 할당은 `coordinate prepare`가 소유한다
- `references/review/` — review 판단 의미 변경은 BP002 소관이다
- `agents/` — 역할 계약은 이 task에서 바꾸지 않는다
- `rules/` — 공유 규칙 정본은 043/007 결과를 유지한다

### Task 002

#### Goal & intent

`/bouncer-plan`이 본문 절차로 수행하던 ID 검색, `maintenance` epic 판정, 저장소 루트 verify 신호 탐지, pointer 상태 해석을 `bouncer plan inspect`가 계산한다. `skills/bouncer-plan/SKILL.md`는 `Discover → Scaffold → Author → Scope confirm → Review → Approval → Activate → Gate` 여덟 번호 단계만 남긴다. Contract blast 검색, prose inventory 검색, verification node 예외, scope 확인 절차는 Scope confirm 단계에서만 읽는 `scope-confirm.md`로 옮긴다.

사용자가 결정하는 Request, Discover, ID, Light scope, Verify command, `affected_paths`, Approval ACQ는 모두 본문 번호 단계에 남긴다. 수용 기준은 새 CLI 테스트와 스킬 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `bouncer plan inspect [--epic-dir <dir>] [--repo <dir>]`. 읽기 전용이며 종료 코드 0과 stdout JSON을 낸다.
  ```json
  { "ok": true, "nextEpicId": "070",
    "epic": { "dir": ".bouncer/context/epics/069-workflow-improvement", "status": "approved", "nextBlueprintId": "004" },
    "maintenanceEpic": { "dir": ".bouncer/context/epics/063-maintenance", "id": "063", "status": "approved", "nextBlueprintId": "004" },
    "verifySignals": ["Makefile", "package.json#scripts"],
    "current": { "status": "selected", "blueprint": "<dir>", "task": "<path>", "base": "<ref>" } }
  ```
  - id는 `\d{3}-<slug>` 디렉터리만 세고 최댓값 + 1을 세 자리로 채운다. `EPIC-`·`BP-` 접두 디렉터리는 세지 않는다.
  - `epic`은 `--epic-dir`가 있을 때만 채우고 없으면 `null`이다. `maintenanceEpic`은 slug가 `maintenance`인 epic이 없으면 `null`이다.
  - `verifySignals`는 루트의 `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`, `Makefile`, `Taskfile.yml` 존재와 `package.json`의 `scripts` 키 존재만 본다.
  - `current.status`는 `scripts/src/lib/current.ts`의 값 `selected | empty | ambiguous | invalid`를 그대로 쓴다. `empty`면 `blueprint`·`task`·`base`는 `null`이다.
- 제공: `scripts/src/lib/cli.ts`의 `COMMANDS` 등록표에 `plan` 키를 추가한다.
- 제공: `skills/bouncer-plan/references/scope-confirm.md` — graph evidence 표시 순서, Contract blast 검색, prose inventory 검색, context re-ground, verification node 예외.
- 거부:
  - `.bouncer/`가 없으면 `{ "ok": false, "reason": "not-initialized" }`, 종료 코드 1.
  - `--epic-dir`가 `.bouncer/context/epics/<ddd>-<slug>` 형태가 아니거나 없으면 `invalid-epic-dir`, 종료 코드 1.
  - 어떤 입력에서도 파일을 쓰지 않는다.

#### Do not touch

- `scripts/src/lib/scaffold.ts` — id 형식 검증과 문서 생성 계약을 유지한다
- `scripts/src/lib/current.ts` — pointer 해석은 재사용만 한다
- `references/spec-authoring/index.md` — 작성 규칙 정본은 이 task에서 바꾸지 않는다
- `references/graphify-runner/index.md` — graph 절차 정본은 유지한다
- `rules/` — 공유 규칙 정본은 043/007 결과를 유지한다

### Task 003

#### Goal & intent

`/bouncer-run` 본문을 runtime preflight, 시작 ACQ, integration bootstrap, `bouncer-coordinator` 1회 dispatch, 결과 렌더링 다섯 번호 단계로 줄인다. Pointer, blueprint 상태, 열린 task, DAG, `affected_paths`, `autonomy` 정규화는 `bouncer run preflight`가 반환한다. Task별 execute·commit 절차, scope revision 판단, worker dispatch 규칙, coordinator 출력 필드는 `agents/bouncer-coordinator.md`와 `rules/governance.md`가 이미 소유하므로 run 본문에서 반복하지 않는다.

수용 기준은 새 CLI 테스트와 run 스킬 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `bouncer run preflight --blueprint <dir> [--repo <dir>]`. 읽기 전용이며 종료 코드 0과 stdout JSON을 낸다.
  ```json
  { "ok": true, "blueprint": { "dir": "<dir>", "status": "approved", "scale": "full" }, "base": "<ref>",
    "openTasks": [ { "id": "001", "taskId": "TASKS-001", "path": "<dir>/tasks/001/tasks.md", "status": "ready",
      "execution_kind": "commit", "affected_paths": ["a.ts"], "depends_on": [], "parallel_safe": false,
      "dependency_gate": "integrated" } ],
    "readyWave": ["001"], "autonomy": { "value": "auto", "fallback": false, "reason": null },
    "delegable": true, "reason": null }
  ```
  - `openTasks[].id`와 `readyWave`는 coordinator ledger와 같은 세 자리 번호다. `taskId`는 frontmatter id(`TASKS-NNN`)이고 `depends_on`은 문서 값(`TASKS-NNN`)을 그대로 싣는다.
  - `openTasks`는 status가 `ready`·`in_progress`인 task이며 DAG 필드 부재는 governance 기본값(`[]`, `false`, `integrated`)으로 채운다.
  - `readyWave`는 `scripts/src/lib/coordinator.ts`의 `readyWave`를 문서 상태에 적용한 결과다.
  - `autonomy`가 없으면 `{ "value": "auto", "fallback": true, "reason": "missing" }`, `AUTONOMY_ENUM` 밖이면 `reason: "invalid"`이다.
  - blueprint가 `closed`면 `delegable: false, reason: "blueprint-closed"`, 열린 task가 없으면 `reason: "no-open-task"`이다.
- 제공: `scripts/src/lib/cli.ts`의 `COMMANDS` 등록표에 `run` 키를 추가한다.
- 거부:
  - pointer가 없으면 `{ "ok": false, "reason": "no-current" }`, 종료 코드 1.
  - pointer가 모호하거나 충돌하면 `CURRENT_AMBIGUOUS`·`CURRENT_INVALID` 코드를 그대로 싣고 종료 코드 1.
  - 파일을 쓰지 않는다.

#### Do not touch

- `agents/bouncer-coordinator.md` — coordinator 계약 정본이다. 이 task는 run 쪽 반복만 지운다
- `scripts/src/lib/coordinator.ts` — `readyWave` export를 재사용만 한다
- `scripts/src/lib/schema.ts` — `AUTONOMY_ENUM`을 재사용만 한다
- `rules/` — 공유 규칙 정본은 유지한다

### Task 004

#### Goal & intent

`/bouncer-commit` 본문을 `Current → Dry-run → 결과 확인 → Commit → Handoff` 다섯 번호 단계로 줄인다. `bouncer commit` payload가 controller mode, 다음 행동, stamp 경로, 복구 행동을 반환하고, pointer 후보는 기존 `nextTask`를 그대로 쓴다. 본문은 CLI 동작을 다시 설명하지 않는다. Standalone next-task ACQ와 drive에서 coordinator에게 결과를 돌려주는 분기는 본문에 남긴다.

수용 기준은 commit payload 테스트와 스킬 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `commitTask`의 모든 `ok: true` payload에 다음 필드를 추가한다. 기존 필드(`nextTask` 포함)는 그대로다.
  - `controller`: coordinator ledger가 활성이면 `"coordinator"`, 아니면 `"standalone"`.
  - `nextAction`: dry-run이면 `"confirm-commit"`; drive에서 커밋 뒤나 빈 staged 뒤에는 `"return-to-coordinator"`; standalone에서 `nextTask`가 있으면 `"ask-next-task"`, 없으면 `"finalize"`.
  - `stampPath`: 커밋을 만들었으면 `commit_sha`를 기록한 `<blueprint>/tasks/<NNN>/tasks.md`, 아니면 `null`.
- 제공: 모든 `ok: false` payload에 `recovery: { "action": <string>, "detail": <string> }`를 추가한다.
  ```text
  out-of-scope + standalone → action 'return-to-plan'
  out-of-scope + coordinator → action 'coordinator-revise'
  validate                  → action 'fix-gate-failures'
  verification-task-no-commit → action 'run-verification-node'
  그 밖의 reason              → action 'report-and-stop'
  ```
- 거부: 기존 `reason` 값, 종료 코드, `nextTask`의 의미를 바꾸지 않는다. CLI는 여전히 pointer를 옮기지 않는다.

#### Do not touch

- `scripts/src/lib/scope.ts` — scope 판정과 ledger 읽기는 재사용만 한다
- `scripts/src/lib/commit-guard.ts` — hook 판정 계약을 유지한다
- `hooks/` — commit-safety hook 동작을 바꾸지 않는다
- `scripts/src/lib/coordinator.ts` — fan-in은 coordinator 소관이다

### Task 005

#### Goal & intent

`/bouncer-finalize`의 `Explain/Quiz → Remainder → PR → Cleanup → Handoff` 다섯 번호 단계와 각 동의 단계를 유지하면서 본문을 줄인다. 현재 step 6 Report는 Handoff 단계에 합친다. Integration 완료 여부와 ledger 가독성은 `bouncer finalize` payload의 `integration` 필드로 읽는다. Remainder 단계의 validate·dry-run·scope 실패 처리 절차는 그 단계에서만 읽는 `remainder.md`로 옮긴다.

수용 기준은 finalize payload 테스트와 스킬 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `bouncer finalize --blueprint <dir>`의 dry-run payload, `--yes` payload, `coordinator-ledger` 거절 payload에 `integration`을 추가한다.
  ```json
  { "integration": { "ledger": "ok", "required": true, "complete": false,
                     "openTasks": ["003"], "headVerified": null } }
  ```
  - `ledger`: `absent | ok | unreadable`. `absent`면 `required: false, complete: true, openTasks: [], headVerified: null`. `unreadable`이면 `required: true, complete: false, openTasks: [], headVerified: null`이며 기존 `reason: 'coordinator-ledger'` 거절 payload에 실린다.
  - `complete`: ledger의 모든 task가 `integrated`이면 `true`.
  - `openTasks`: `integrated`가 아닌 task의 세 자리 id 목록(오름차순).
  - `headVerified`: `execution_kind: verification` task가 있으면 그 task가 모두 `integrated`일 때 `true`, 아니면 `false`. 그런 task가 없으면 `null`.
  - 기존 `staged`, `worktrees`, `coordinator` 필드는 그대로 둔다.
- 제공: `skills/bouncer-finalize/references/remainder.md` — finalize gate 실행, dry-run 결과 표시, scope 실패 처리, `reason: 'verify'` 처리.
- 거부: `integration`은 보고 전용이다. 새 거절 reason을 만들지 않고, 기존 `coordinator-ledger` 거절의 조건과 종료 코드를 바꾸지 않는다.

#### Do not touch

- `skills/bouncer-finalize/references/explain-quiz.md` — explain·quiz 절차 정본을 유지한다
- `skills/bouncer-finalize/references/draft-pr.md` — PR 절차는 BP003이 branch 소비만 바꾼다
- `skills/bouncer-finalize/references/cleanup-handoff.md` — cleanup 절차를 유지한다
- `scripts/src/lib/scope.ts` — ledger 읽기를 재사용만 한다

### Task 006

#### Goal & intent

`/bouncer-init`이 사용하지 않는 plan 전용 product rule(`rules/governance.md`, `rules/okf.md`)을 Master rules 블록에서 적재하지 않게 하고, 본문을 `Init → 조건부 결과 처리 → bootstrap commit 안내 → Plan handoff` 네 단계로 맞춘다. BP001 Contract의 안전 경계 아홉 행에 대해 정본 파일과 그 정본을 참조해야 하는 진입 스킬을 `test/workflow-safety-canon.test.js`로 고정한다. 진입 스킬 단어 수 baseline을 BP001 착수 시점 값으로 갱신하고, 스킬별 번호 단계 수를 테스트로 고정한다.

TASKS-001부터 TASKS-005까지 끝난 뒤의 최종 배치를 검증하는 task다. 수용 기준은 새 정본 테스트와 갱신한 surface 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `test/workflow-safety-canon.test.js`의 정본 표. 각 행은 정본 파일 한 곳의 존재 패턴과 참조 스킬의 cite 패턴을 함께 검사한다.
  ```text
  행  경계                          → 정본(한 곳)                                         / 참조 스킬
  1   ACQ 시점과 동의 범위          → 각 ACQ를 여는 스킬의 번호 단계                        / 해당 스킬(`rules/acq.md` cite)
  2   affected_paths 사용자 확인    → skills/bouncer-plan/SKILL.md Scope confirm 단계        / plan
  3   pointer confirm-then-set      → rules/current-pointer.md                              / plan, commit, finalize
  4   실제 cwd·drive main 읽기 전용  → rules/governance.md ## Coordinator mode               / execute, commit, finalize, run
  5   worker report 신뢰 경계        → CLAUDE.md hard rule 1                                 / execute, run
  6   light inline·drive named 예외  → rules/governance.md ## Lightweight cycle              / execute, run
  7   debugger 복구 상한             → skills/bouncer-execute/references/verification-recovery.md / execute
  8   review round 상한              → skills/bouncer-execute/references/review-round.md     / execute
  9   quiz 미응답 중단·사용자 동의    → skills/bouncer-finalize/SKILL.md                      / finalize, run
  init  plan 전용 rule 미적재        → skills/bouncer-init/SKILL.md `**Master rules.**` 블록 / init
  ```
  init 행은 Master rules 블록 안에서만 `rules/governance.md`·`rules/okf.md`가 없음을 검사한다. 블록 밖의 설치 안내 문장은 검사하지 않는다.
- 제공: `test/skill-bouncer-surface.test.js`의 단어 수 baseline을 BP001 착수 시점 값으로 바꾸고 번호 단계 수 검사를 추가한다.
  ```text
  baseline: init 411, plan 2331, execute 2001, commit 926, run 1141, finalize 985 (합계 7795)
  번호 단계 수: init 4, plan 8, execute 6, commit 5, run 5, finalize 5
  ```
- 제공: `docs/workflow-contract.md`의 스킬별 조건부 reference 목록에 `review-round.md`, `scope-confirm.md`, `remainder.md`를 추가한다. 과거 측정 표는 기록으로 두고 고치지 않는다.
- 거부: 정본 파일에서 경계 문구가 사라지거나 참조 스킬에서 정본 cite가 사라지면 테스트가 실패한다. 선행 task 결과가 이 표와 다르면 표를 고치지 않고 `/bouncer-plan`으로 돌아간다.

#### Do not touch

- `rules/` — 정본 본문을 바꾸지 않고 위치만 검사한다
- `CLAUDE.md` — hard rule 본문을 유지한다
- `skills/bouncer-plan/SKILL.md` — TASKS-002가 확정한 본문을 유지한다
- `skills/bouncer-execute/SKILL.md` — TASKS-001이 확정한 본문을 유지한다
- `skills/bouncer-run/SKILL.md` — TASKS-003이 확정한 본문을 유지한다
- `skills/bouncer-commit/SKILL.md` — TASKS-004가 확정한 본문을 유지한다
- `skills/bouncer-finalize/SKILL.md` — TASKS-005가 확정한 본문을 유지한다