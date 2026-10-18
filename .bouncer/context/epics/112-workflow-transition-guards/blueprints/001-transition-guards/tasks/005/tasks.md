---
type: bouncer.tasks
title: 병합 뒤 실행 분리 명령 추가
description: Add a user-approved run detach command that preserves the ledger, removes one pointer key, and releases the main-worktree guard.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
  - detach
  - ledger
  - commit-guard
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: TASKS-005
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-003
    - TASKS-004
  parallel_safe: false
  dependency_gate: integrated
  verify: node --test test/coordinator.test.js test/run-detach.test.js test/cli-commit.test.js test/commit-guard.test.js test/run-preflight.test.js test/coordinate-next.test.js test/cli-help.test.js test/test-tiers.test.js
  review_risk:
    - public_interface
    - authorization
  affected_paths:
    - scripts/src/lib/run-detach.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/src/lib/scope.ts
    - scripts/src/lib/commit-hook.ts
    - scripts/src/lib/commit.ts
    - scripts/src/lib/coordinator.ts
    - scripts/src/lib/coordinate-next.ts
    - scripts/src/lib/run-preflight.ts
    - test/run-detach.test.js
    - test/tiers.json
    - test/cli-commit.test.js
    - test/commit-guard.test.js
    - test/run-preflight.test.js
    - test/coordinate-next.test.js
    - test/cli-help.test.js
    - rules/cli.md
    - rules/current-pointer.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
  commit_intent:
    - 구현을 develop에 병합한 뒤에도 활성 실행 상태가 남아 메인 문서 커밋이 main-worktree-source-write로 막히던 문제에 기록을 보존하는 분리 경로를 제공함.
  commit_summary:
    - 사용자가 승인한 run detach가 ledger에 detached를 남기고 해당 포인터 key만 지우며, commit guard와 coordinator 명령이 그 상태를 존중하게 함.
  commit_sha: 62aca0d7
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
Git 병합 뒤 사용자가 명시적으로 승인하면 `bouncer run detach --blueprint <dir> --yes`로 실행을 분리한다. 분리는 ledger와 worktree를 지우지 않고 `detached`를 append하며, 해당 blueprint의 포인터 key 하나만 지운다. 그 뒤 메인 커밋은 막히지 않고, detached ledger에 대한 coordinator mutation은 거절된다. detach는 검증 성공·finalize로 기록되지 않는다. 수용 기준은 epic Success criteria 8이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `cmdRun`(`scripts/src/lib/cli-project-commands.ts:238-260`)은 `preflight` 외 하위 명령을 exit 2로 거절한다(`:242-244`). help 등록은 `:486-490`이고 구현은 `scripts/src/lib/run-preflight.ts`다.
- `coordinatorContext`(`scripts/src/lib/scope.ts:505-563`)는 integration ledger 파일이 존재하고 cwd가 project root이면 `main-worktree-source-write`를 낸다(`:540`). ledger `status`는 읽지 않는다. `taskWriteBoundary`(`:572-590`)와 `assignedLedgerTask`(`:592-616`)도 status를 보지 않는다.
- commit hook(`scripts/src/lib/commit-hook.ts:388-436`)은 blueprint를 `readCurrent || mainRepoCurrent`와 lease에서 얻는다(`:397-406`). 둘 다 없으면 커밋을 허용한다(`:406`). 거절 메시지(`:428-430`)에는 `next`가 없다. CLI 경로는 `scripts/src/lib/commit.ts:376`, `:400-407`이고, `recoveryFor`(`:251-290`)는 이 코드를 일반 `report-and-stop`으로 처리한다.
- ledger:
  - 경로는 `coordinatorPathsFor`(`scripts/src/lib/runtime-state.ts:1022-1047`)가 만든다.
  - `validateCoordinatorLedger`(`:271-370`)는 status enum을 제한하지 않는다.
  - 상태 정지 선례는 promote-stop(`scripts/src/lib/coordinator.ts:3935-3975`)이다. status와 기록 필드를 바꾸고 `commitWrite` 뒤 `promotion-stopped`로 거절한다.
  - lock은 `withLedgerLock`(`scope.ts:298`)이다.
- status 게이트:
  - `coordinate-next.ts:604-620`(partial_closed·promotion_stopped·awaiting_confirmation).
  - `run-preflight.ts:238-242` `LEDGER_REASON`.
  - fenced 명령(`coordinator.ts:2379`, `:3973`, `:3985`).
- 특정 key 삭제 API는 `removeNamespacePointer({repoRoot, key})`(`runtime-state.ts:948-967`)와 `pointerKeyFromBlueprint`(`:607`)이며 둘 다 export돼 있다. `clearCurrent`(`scripts/src/lib/current.ts:485`)는 선택된 key만 지우고 모호하면 throw한다.
- finalize:
  - `finalize-release-main.ts:353-364`는 모든 task가 `integrated`이고 status가 awaiting/partial이 아니어야 통과한다.
  - `finalize.ts:1154-1161`에는 status 게이트가 없다.
  - finalize는 포인터로 blueprint를 고른다.
- 관찰된 사례: 111/002를 develop에 fast-forward한 뒤에도 integration ledger가 남아 메인 문서 커밋이 `main-worktree-source-write`로 막혔다. 지금 포인터는 비어 있다(`bouncer plan inspect` `current.status: empty`).
- 테스트:
  - `test/commit-guard.test.js:81`·`:110`, `test/cli-commit.test.js:507`(live ledger 메인 커밋 거절), `test/run-preflight.test.js:279`(`/preflight/` 메시지), `:183`·`:547`·`:577`.
  - `test/cli-help.test.js:66`(모든 하위 명령 usage), `:144`.
  - `test/tiers.json`과 `test/test-tiers.test.js:30`(새 테스트 파일 tier 등록 필수).

## Target behavior
- 성공: `run detach --blueprint <dir> --yes [--reason <text>]`를 메인 checkout에서 실행하면 다음 순서로 처리한다.
  1. ledger lock을 잡는다.
  2. ledger `status`를 `detached`로 두고 `detached` decision(`at`, `reason`, `integration_head`, `main_head`, `previous_status`)을 append한다. 원자적으로 쓴다.
  3. `removeNamespacePointer(pointerKeyFromBlueprint(dir))`로 그 key만 지운다(없으면 건너뜀).
  4. `{ ok:true, ledger, pointer_removed, next }`를 출력한다. `next`는 "finalize하려면 `bouncer current --set <dir>` 뒤 `/bouncer-finalize`"다.
  
  ledger·worktree·branch·다른 key는 그대로다. 이미 `detached`이면 no-op 성공(`already: true`)이다.
- guard:
  - `coordinatorContext`는 `status: detached` ledger를 비활성(`inactiveContext('run-detached')`)으로 본다. 그래서 메인 커밋은 `main-worktree-source-write`로 막히지 않는다.
  - integration·worker cwd의 task write 경계(`taskWriteBoundary`, `assignedLedgerTask`)는 `run-detached`로 거절한다.
- coordinator:
  - `coordinate next`/`advance`와 fenced mutation(prepare·dispatch·report·record·integrate·repair·revise·supplement·session-open)은 detached ledger에서 `run-detached`(exit 1)를 낸다. next는 "실행이 분리됨, finalize 또는 새 계획".
  - `run preflight`는 `LEDGER_REASON`에 `detached → run-detached`를 추가한다.
- 실패(ledger·포인터 불변, exit 1):
  - `--yes` 없음 → `detach-confirmation-required`.
  - ledger 없음·읽기 실패 → 기존 `no-ledger`·`unreadable-ledger`.
  - dispatch `active|reported` task 또는 상태 `prepared|recorded` task가 있음 → `detach-worker-in-flight`(해당 task id 목록).
  - status `awaiting_confirmation` → `detach-awaiting-confirmation`(사용자 확인 흐름을 우회하지 않음).
- `main-worktree-source-write` 안내:
  - commit hook 메시지와 `recoveryFor`에 `next`를 추가한다.
  - ledger의 모든 commit task가 `integrated`이면 "Git 병합을 마쳤다면 사용자 승인 뒤 `bouncer run detach --blueprint <dir> --yes`, 아니면 `/bouncer-finalize`".
  - 그 밖에는 "실행 worktree에서 작업하거나 `/bouncer-run`을 이어간다".
- 보존:
  - finalize와 release-main은 바꾸지 않는다. detached ledger도 모든 task가 integrated이면 지금 규칙대로 finalize할 수 있다.
  - detach는 verification·review 문서와 task status를 바꾸지 않는다. 사용자 승인(`--yes`) 없이는 아무것도 바꾸지 않는다.

## Interface
- 제공:
  - `bouncer run detach --blueprint <dir> --yes [--reason <text>]`.
  - ledger status 값 `detached`, decision kind `detached`.
  - reason `run-detached`, `detach-worker-in-flight`, `detach-awaiting-confirmation`, `detach-confirmation-required`.
  - commit guard 거절 출력의 `next`.
  - `신규 추출 지점: detachRun({ repoRoot, blueprint, reason, yes, deps }) → result`(git·clock 주입).
- 거부: 위 네 코드. 사용법 exit 2: `--blueprint` 누락, 알 수 없는 `run` 하위 명령(메시지에 `preflight|detach`).
- 용어:
  - "진행 중 worker"는 ledger task의 `dispatch.status`가 `active`·`reported`이거나 task `status`가 `prepared`·`recorded`인 경우다. 예: `{ id: '003', status: 'prepared' }`.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/run-detach.ts` | `detachRun` | Create | 없음 | detach 구현 | 신규 추출 지점: run detach |
| `scripts/src/lib/cli-project-commands.ts` | `cmdRun`, help 표 | Modify | run 하위 명령 분기 | `detach` 분기, usage | `:238-260`, `:486-490` |
| `scripts/src/lib/scope.ts` | `coordinatorContext`, `taskWriteBoundary`, `assignedLedgerTask` | Modify | 활성 실행 판정 | detached 처리 | `:505-616` |
| `scripts/src/lib/commit-hook.ts` | `evaluateIndex` 거절 메시지 | Modify | hook 거절 | `next` 문구 | `:428-430` |
| `scripts/src/lib/commit.ts` | `recoveryFor` | Modify | CLI commit 복구 안내 | `main-worktree-source-write` 전용 안내 | `:251-290` |
| `scripts/src/lib/coordinator.ts` | fenced 명령 status 검사, hint 표 | Modify | ledger 상태 게이트 | `run-detached` 거절과 hint | `:2379`, `:3973`, `:3985`, `:4609` |
| `scripts/src/lib/coordinate-next.ts` | status 게이트 | Modify | next 정지 사유 | `detached` → `run-detached` | `:604-620` |
| `scripts/src/lib/run-preflight.ts` | `LEDGER_REASON` | Modify | preflight 사유 | `detached` 추가 | `:238-242` |
| `test/run-detach.test.js` | detach 테스트 | Create | 없음 | 상태 전이 테스트 | 신규 |
| `test/tiers.json` | tier 목록 | Modify | 테스트 tier 등록 | `run-detach.test.js` 등록 | `test/test-tiers.test.js:30` |
| `test/cli-commit.test.js` | 메인 commit 거절 | Modify | live ledger 거절 | `next` 단언, detached 뒤 허용 | `:507` |
| `test/commit-guard.test.js` | 경계 코드 | Modify | guard 판정 | detached 비활성 | `:81`, `:110` |
| `test/run-preflight.test.js` | ledger 사유 | Modify | preflight 사유 | `run-detached` | `:183`, `:279`, `:547` |
| `test/coordinate-next.test.js` | status 게이트 | Modify | next 정지 | `run-detached` | `:604-620` 대응 테스트 |
| `test/cli-help.test.js` | run usage | Modify | help 고정 | `run detach` | `:66`, `:144` |
| `rules/cli.md` | run·current 항목, ledger 사유 | Modify | CLI 계약 | detach 명령·코드, TASKS-004의 `--keep-others`·`CURRENT_WOULD_BE_AMBIGUOUS` | `:21`, `:38-39`, `:103`, `:190` |
| `rules/current-pointer.md` | Moves and clears | Modify | 포인터 삭제 소유 | detach가 자기 key 하나만 지운다는 예외 | `:52-54` |
| `skills/bouncer-run/SKILL.md` | 정지·보존 단락 | Modify | run 종료 안내 | 병합 뒤 detach는 사용자 승인 필요, finalize 아님 | `:204-219` |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | 보존 단락 | Modify | 정리 안내 | detached ledger 처리 | `:12-16` |

## Do not touch
- `scripts/src/lib/finalize.ts` — finalize 동작은 그대로다.
- `scripts/src/lib/finalize-release-main.ts` — release 판정은 그대로다.
- `scripts/src/lib/runtime-state.ts` — 기존 export(`removeNamespacePointer`)를 쓰기만 한다.
- `scripts/src/lib/current.ts` — TASKS-004 결과를 그대로 쓴다.
- `test/commit-hook.test.js` — TASKS-006 범위.
- `.worktrees/` — blueprint 111 실행 증적. detach를 실제로 실행하지 않는다.

## Constraints
- detach는 ledger 파일·integration worktree·worker worktree·branch를 삭제하지 않는다. 기존 decision을 수정하지 않고 append만 한다.
- detach는 verification evidence, review 상태, task status, 포인터의 다른 key를 바꾸지 않는다.
- Git 병합 여부를 detach의 성공 조건이나 검증 증거로 쓰지 않는다. `main_head`는 관찰값으로만 기록한다.
- 사용자 승인 없는 실행 경로를 만들지 않는다. 스킬 문서는 detach 전에 사용자 확인을 요구한다.
- 새 reason은 hint 표에 등록한다. 새 테스트 파일은 `test/tiers.json`에 등록한다.

## Checklist
- [ ] `npm run build`.
- [ ] 실패 테스트 작성(`test/run-detach.test.js`):
  - 모든 commit task가 integrated인 ledger와 포인터 key가 있는 fixture를 둔다. 메인 checkout에서 문서 파일을 staged하면 commit guard가 `main-worktree-source-write`를 낸다(현 상태 재현).
  - `run detach --blueprint <dir> --yes` 뒤에는 같은 commit 판정이 허용된다. ledger 파일이 남고 `status: 'detached'`가 되며 decision이 하나 늘어난다. 그 key만 사라지고 다른 key는 남는다.
- [ ] 위 테스트가 하위 명령 exit 2로 실패하는지 확인한다.
- [ ] `detachRun`과 CLI 분기를 구현하고 guard·coordinator·next·preflight에 detached 처리를 넣는다.
- [ ] 거절 테스트(ledger·포인터 바이트 불변):
  - `--yes` 없음 → `detach-confirmation-required`.
  - `prepared` task → `detach-worker-in-flight`.
  - `awaiting_confirmation` → `detach-awaiting-confirmation`.
- [ ] detached ledger에서 `coordinate next`와 fenced mutation 전부(prepare·dispatch·report·record·integrate·repair·revise·supplement·session-open)가 `run-detached`를 내고 ledger 바이트가 같은지 확인하는 표 기반 테스트(`test/run-detach.test.js`). `test/coordinator.test.js`는 수정하지 않고 verify에서 실행만 한다. reason 완전성 테스트(`:130-169`)가 새 hint 등록을 확인한다. 두 번째 detach no-op 테스트.
- [ ] 문구 일치 확인: TASKS-001~005의 새 거절 코드와 새 플래그(`--verify`, `--new-path`, `--keep-others`, `run detach`)마다 `rg -F '<문자열>' rules/cli.md`가 1건 이상인지 확인한다.
- [ ] `main-worktree-source-write` 출력의 `next`가 integrated ledger에서는 `run detach`를, 진행 중 ledger에서는 run 안내를 담는 테스트.
- [ ] `test/tiers.json`에 등록하고 문서 4개(`rules/cli.md`에는 TASKS-004의 current 플래그·코드 포함)를 반영한 뒤 `npm run lint:docs`.
- [ ] 완료 명령: `node --test test/coordinator.test.js test/run-detach.test.js test/cli-commit.test.js test/commit-guard.test.js test/run-preflight.test.js test/coordinate-next.test.js test/cli-help.test.js test/test-tiers.test.js`.
