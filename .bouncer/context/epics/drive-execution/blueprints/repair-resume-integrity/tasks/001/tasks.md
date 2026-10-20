---
type: bouncer.tasks
title: repair 재개 시 통합된 하위 task 상태 유지
description: Keep integrated downstream commit tasks when repair resumes one task
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - repair
  - ledger
timestamp: '2026-10-20T21:01:49.481+09:00'
bouncer:
  id: TASKS-001
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  affected_paths:
    - scripts/src/lib/coordinator-commands.ts
    - test/cli-coordinate.test.js
    - test/coordinator-e2e.test.js
  commit_intent:
    - terminal 실패를 기존 task로 재개하면 이미 통합된 하위 task까지 pending으로 돌아가 재실행되는 문제를 막음.
  commit_summary:
    - resume 대상 task와 하위 verification task만 되돌리고 통합된 commit task는 유지함.
  review_risk: []
  verify: node --test test/cli-coordinate.test.js test/coordinator-e2e.test.js test/coordinator.test.js
---
# Tasks

Blueprint: [repair-resume-integrity](../../index.md)

## Goal & intent
`coordinate repair --resume-task <id>`가 지정 task만 재배정하고 이미 `integrated`인 하위 commit task를 그대로 두게 한다. resume한 task가 재통합되면 terminal verification만 다시 열린다. 수용 기준은 blueprint Contract 1·2이고 검증 명령은 `node --test test/cli-coordinate.test.js test/coordinator-e2e.test.js test/coordinator.test.js`다.

## Current behavior
- 결정: `resolveTerminalFailure`(`scripts/src/lib/coordinator-commands.ts:966-1111`)가 `downstreamTasks`(`:1119-1133`, `depends_on` 전이 폐포, terminal 포함)로 `resetDownstream`을 구하고(`:1059`), `resetTasks = [target, ...비verification downstream]`(`:1071`) 각각을 `salvageRevokedWorker`로 salvage한다(`:1072-1085`). 결정 기록 `reset_downstream`은 downstream 전체 id다(`:1101`).
- 적용: `repair` 명령 분기(`:4479-4502`)가 `writeResumeDocuments`(`:1146`)에 downstream 전체를 넘겨 문서 status를 되돌리고, target과 비verification downstream마다 `revokeLease`·`resumed = true`·`dependency_gate = 'integrated'`를 쓴 뒤 downstream 전체와 terminal을 `status = 'pending'`으로 만든다. 원장 쓰기는 `commitWrite()`(`:4517`).
- I/O 관찰 지점: 원장 파일 쓰기 `:4517`, 증적 문서 쓰기 `writeResumeDocuments` `:1146`, salvage git 호출 `salvageRevokedWorker` `:2358`.
- 재현: epic 114·119 drive에서 `reset_downstream: [002..007]`, completed 3→0. 기존 테스트 `test/cli-coordinate.test.js:1416-1434`와 `test/coordinator-e2e.test.js:1600-1640`은 target+terminal 2-task fixture라 중간 downstream task를 덮지 않는다.
- ready 재계산: `readyWaveGated`(`:914-922`)가 `resumed` task가 미통합인 동안 pending verification을 숨긴다.

## Target behavior
- 성공: target만 salvage·lease 회수·`resumed`·`dependency_gate` 갱신·`pending` 전이한다. downstream 중 `execution_kind: verification` task만 `pending`으로 되돌리고 문서도 그 task만 되돌린다. downstream commit task는 `status`·`sha`·`lease`를 바꾸지 않는다. 출력·결정의 `reset_downstream`은 되돌린 verification id 목록이다.
- 실패: 대상 검증(`resume-task-invalid`, `task-outside-blueprint`, `repair-scope-out-of-bounds`, `repair-wave-limit`, `failure-evidence-mismatch`)은 지금 그대로다. terminal이 target의 downstream이 아니면 지금처럼 `failure-evidence-mismatch`다.
- 보존: 2-task fixture 결과(`[['001','pending'],['002','pending']]`, `reset_downstream: ['002']`, `owner_generation: 2`)는 그대로다. salvage 결정 기록 형식도 같다.

## Interface
- 제공: `coordinate repair --resume-task` 성공 JSON의 `reset_downstream: string[]` = 상태를 되돌린 downstream verification task id. 원장 결정 `RepairDecision.reset_downstream`도 같은 값.
- 거부: 위 거절 사유는 바뀌지 않는다. 새 거절 사유를 추가하지 않는다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `resolveTerminalFailure`, `writeResumeDocuments`, `repair` 적용 분기 | Modify | downstream 전체를 salvage·revoke·pending으로 되돌림 | target과 downstream verification만 되돌리고 `reset_downstream`을 그 id로 기록 | 상태 변경 진입점(`:1059-1101`, `:4479-4502`) |
| `test/cli-coordinate.test.js` | `terminalFailedCliDrive` 계열 resume 테스트 | Modify | 2-task fixture만 단언 | 001 → 002 → terminal 3-task fixture로 002 유지 단언 추가 | 회귀 검증 지점(`:1416-1434`) |
| `test/coordinator-e2e.test.js` | resume e2e 흐름 | Modify | 2-task로 재작업 후 terminal 통합 확인 | 중간 integrated task가 재실행되지 않고 terminal만 ready가 되는지 단언 | 기대 동작 2 검증(`:1600-1640`) |

## Do not touch
- `scripts/src/lib/coordinate-next.ts` — TASKS-002 범위
- `scripts/src/lib/scope.ts` — TASKS-003 범위
- `agents/bouncer-coordinator.md` — 문구가 이미 목표 동작("Unrelated tasks do not run again")과 같고 TASKS-004가 소유
- `scripts/src/lib/execution-contracts.ts` — 필드 이름·타입을 바꾸지 않음

## Constraints
- resume 계약(task 수·ID·DAG·scope 불변)을 유지한다. `depends_on` edge를 고치지 않는다.
- 원장 쓰기 실패 시 `rollbackDocuments`로 문서 바이트를 되돌리는 규칙을 유지한다.
- `failure-evidence-mismatch` 판정에는 downstream 계산(`downstreamTasks`)을 계속 쓴다.

## Checklist
- [ ] `test/cli-coordinate.test.js`에 3-task(001 → 002 → 003 terminal, 001·002 integrated) fixture 테스트를 추가한다. 기대 red: 002 상태가 `'pending'`이라 아래 단언이 실패한다.
  ```js
  assert.deepStrictEqual(ledger.tasks.map((t) => [t.id, t.status]),
    [['001', 'pending'], ['002', 'integrated'], ['003', 'pending']]);
  assert.strictEqual(ledger.tasks[1].sha, before002Sha);
  assert.deepStrictEqual(result.reset_downstream, ['003']);
  ```
- [ ] `test/coordinator-e2e.test.js`에 같은 모양으로 001 재통합 뒤 ready가 `['003']`이고 002가 다시 dispatch되지 않는 단언을 추가한다. 기대 red: repair 직후 002 상태가 `'pending'`이고 001 재통합 뒤 ready가 `['002']`라 아래 단언이 실패한다.
  ```js
  assert.strictEqual(ledgerAfterRepair.tasks.find((t) => t.id === '002').status, 'integrated');
  assert.deepStrictEqual(readyAfterReintegrate, ['003']);
  ```
- [ ] `npm run build` 후 `node --test test/cli-coordinate.test.js test/coordinator-e2e.test.js`로 두 파일의 red를 확인한다.
- [ ] `resolveTerminalFailure`의 salvage 대상과 `reset_downstream`, 적용 분기의 revoke·pending 루프, `writeResumeDocuments` 입력을 target + downstream verification으로 줄인다.
- [ ] 기존 2-task 단언(`reset_downstream: ['002']`)이 그대로 통과하는지 확인한다.
- [ ] `node --test test/cli-coordinate.test.js test/coordinator-e2e.test.js test/coordinator.test.js`가 통과한다.
