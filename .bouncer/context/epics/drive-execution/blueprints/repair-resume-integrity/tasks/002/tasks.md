---
type: bouncer.tasks
title: rework 보고 뒤 next가 implement를 반복하지 않도록 수정
description: Stop coordinate next from repeating implement once the current attempt report exists
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - rework
  - next
timestamp: '2026-10-20T21:02:18.149+09:00'
bouncer:
  id: TASKS-002
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  affected_paths:
    - scripts/src/lib/coordinate-next.ts
    - test/coordinate-next.test.js
  commit_intent:
    - rework 재시도에서 worktree가 dispatch 기준과 같으면 advance가 implement 단계에 계속 머무는 문제를 막음.
  commit_summary:
    - 현재 attempt 보고 파일이 있으면 implement 대신 다음 판정 단계로 넘어가게 함.
  review_risk: []
  verify: node --test test/coordinate-next.test.js
---
# Tasks

Blueprint: [repair-resume-integrity](../../index.md)

## Goal & intent
`coordinate next`(그리고 같은 판정을 쓰는 `advance`)가 현재 attempt의 implementer 보고 파일이 이미 있으면 `implement`를 다시 돌려주지 않게 한다. 수용 기준은 blueprint Contract 3이고 검증 명령은 `node --test test/coordinate-next.test.js`다.

## Current behavior
- `taskNext`(`scripts/src/lib/coordinate-next.ts:805` 시작)의 active dispatch 분기는 `workerHead === item.dispatch.base_head && porcelainText === item.dispatch.initial_worktree_state`면 보고 파일 존재와 관계없이 `implement`를 반환한다(`:899-918`).
- 기준값은 `dispatch` 명령이 attempt마다 다시 잡는다(`scripts/src/lib/coordinator-commands.ts:4783-4797`). porcelain은 dirty 경로 목록이라 내용 변화를 보지 못한다. attempt 1에서 모든 경로가 이미 dirty였으면 attempt 2 구현 뒤에도 기준과 같다.
- 보고 파일 경로는 `coordinator.reportPathFor(workerPath, task, attempt)`(`coordinator-commands.ts:209-211`, `.bouncer/runtime/reports/<task>-<attempt>.md`, gitignore)이고 `next`도 같은 경로를 payload에 싣는다(`coordinate-next.ts:912`). 보고 본문 `## Brief revision`에는 `attempt: <n>` 줄이 있다(`coordinator-commands.ts:226-240` `parseReportFile`, 비공개).
- I/O 관찰 지점: git 읽기 `coordinate-next.ts:899-900`. 보고 파일 읽기는 아직 없다.
- 재현: epic 114 drive TASKS-002 attempt 2에서 관찰. 기존 테스트 `test/coordinate-next.test.js:1264-1291`은 attempt 2 `implement`를 단언하지만 보고 파일을 쓰지 않는다.

## Target behavior
- 성공: active dispatch에서 `reportPathFor(item.workerPath || cwd, task, attempt)` 파일이 존재하고 비어 있지 않으며 본문에 `attempt: <현재 attempt>` 줄이 있으면, 기준 동일 여부와 관계없이 `implement` 분기를 건너뛰고 아래 기존 판정(`verify`→`review`→`commit`→`report`)으로 내려간다.
- 실패/보존: 파일이 없거나, 비었거나, 읽기 오류가 나거나, `attempt:` 값이 다르면 지금처럼 `implement`를 반환한다. 보고 파일이 없는 첫 implement 응답(payload에 `report` 키 없음, `:1296-1310`)과 rework 뒤 `implement` payload(`:1264-1291`)는 그대로다.

## Interface
- 제공: `next` 결과 `action`이 위 조건에서 `implement`가 아닌 기존 다음 단계가 된다. 새 action·필드는 없다.
- 거부: 새 거절 사유 없음. 판정 실패는 `implement`로 접는다(보수적 fallback).
- 신규 추출 지점: 현재 attempt 보고 존재 판정 — `coordinate-next.ts` 안 지역 함수. `parseReportFile`·`observeReport`가 비공개이고 `coordinator-commands.ts`는 TASKS-001·004가 고치므로, `/^attempt:\s*(\d+)\s*$/m` 한 줄 판정을 이 모듈에 둔다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | `taskNext` implement 분기, 신규 추출 지점: 현재 attempt 보고 판정 | Modify | 기준 동일이면 무조건 implement | 현재 attempt 보고가 있으면 implement를 건너뜀 | 판정 진입점(`:899-918`), advance도 같은 `decideNext` 사용 |
| `test/coordinate-next.test.js` | rework·implement 테스트 | Modify | 보고 없는 attempt 2 implement만 단언 | 보고 파일을 쓴 attempt 2에서 `implement`가 아님, attempt 불일치 보고는 `implement` 단언 | 검증 지점(`:1264-1310`) |

## Do not touch
- `scripts/src/lib/coordinator-commands.ts` — TASKS-001·004 범위
- `scripts/src/lib/coordinate-advance.ts` — `decideNext`를 공유하므로 수정 불필요

## Constraints
- `next`는 쓰기 없는 판정이다. 보고 파일은 읽기만 한다(기존 `assertNoWrite` 단언 유지).
- light/inline 모드도 같은 경로 계산(`item.workerPath || cwd`)을 쓴다.

## Checklist
- [ ] `test/coordinate-next.test.js`에 rework 뒤 재dispatch → `writeWorkerReport(drive.worker, '001', 2, hash)` → `nextOf` 테스트를 추가한다. 기대 red: `out.action`이 `'implement'`라 아래 단언이 실패한다.
  ```js
  assert.notStrictEqual(out.action, 'implement');
  assert.strictEqual(out.action, 'verify');
  ```
- [ ] attempt 1 번호로 쓴 보고(`<task>-2.md`에 `attempt: 1`)는 `implement`를 유지하는 테스트를 추가한다.
- [ ] `npm run build` 후 `node --test test/coordinate-next.test.js`로 red를 확인한다.
- [ ] implement 분기 조건에 현재 attempt 보고 판정을 더한다.
- [ ] `node --test test/coordinate-next.test.js`가 통과한다.
