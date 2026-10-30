---
type: bouncer.explain
title: light-direct-run-unification explain
description: Explain for light-direct-run-unification
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/light-direct-run-unification/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-30T10:41:36.134+09:00'
bouncer:
  id: EXPLAIN-light-direct-run-unification
  epic_id: plugin-surface-slimming
  blueprint_id: light-direct-run-unification
  status: published
  comprehension:
    - range_from: 8d764c399da9978b3a3f4c6ef5e76e7db0759853
      range_to: 9586463bb01a6a52e94426d64ec6a0b483e03b4d
      diff_sha: 0d7429e18f1bf74d3008cc019a4e5c62df2e9df8b8ed70021ba6531491afa490
      recorded_at: '2026-10-30T10:42:36.230+09:00'
  task_commits:
    - task: plugin-surface-slimming/light-direct-run-unification/001
      sha: ed7a6c90
      intent_anchor: task-001
    - task: plugin-surface-slimming/light-direct-run-unification/002
      sha: e3799312
      intent_anchor: task-002
    - task: plugin-surface-slimming/light-direct-run-unification/003
      sha: eb5983a8
      intent_anchor: task-003
    - task: plugin-surface-slimming/light-direct-run-unification/004
      sha: db3b135b
      intent_anchor: task-004
    - task: plugin-surface-slimming/light-direct-run-unification/005
      sha: 225c077b
      intent_anchor: task-005
    - task: plugin-surface-slimming/light-direct-run-unification/006
      sha: 9586463b
      intent_anchor: task-006
---
# Explain

## Background

scale `light` blueprint도 직렬 full 직접 실행과 같은 실행 기계를 탄다. root는 `coordinate advance` 루프를 돌리고, 구현은 항상 worker subagent가 맡는다. 예전처럼 root 세션이 light를 inline으로 구현하던 경로는 제거한다.

`mode: light`는 정책 표식이다(범위 밖 차단, baseline 생략, single/combined 리뷰, promote-stop 자격). 실행 경로 자체는 full과 같다. 옛 inline light 원장·구버전 plugin 조합은 명시 거절 코드로 막고, light drive의 토큰·승격 사유·repair wave는 DriveRecord/`measure-drive-records`로 집계한다.

## Code

- `packages/cli/src/run-preflight.ts` — `direct_eligible`이 scale `light` 직렬 체인에도 열린다. 진행 중 옛 inline light 원장이 있으면 `reason: light-ledger-legacy`, `delegable: false`.
- `packages/cli/src/coordinator-ledger.ts` — `isLegacyLightLedger`: `mode === 'light'`이고 `light_runner !== 'subagent'`이며 integrated가 아닌 task가 남으면 legacy. `openLedgerFenced`가 fence보다 먼저 거절한다.
- `packages/cli/src/coordinator-prepare.ts` — light 자격은 직렬 사슬(`isLightEligible`). 비직렬이면 `light-requires-serial`(옛 `light-requires-single-task` 제거). 신규 light seed에 `light_runner: 'subagent'`를 단다. `--promote-light`·promote fingerprint는 worker worktree diff를 본다.
- `packages/cli/src/coordinator-commands.ts` / fan-in·next — light 원장에서 integration cwd의 task 범위 `dispatch`·`report`·`record`·`uncommit`은 `light-inline-removed`. `report --outcome accepted`는 같은 attempt의 implementer `worker-model` 기록이 있어야 하고, 없으면 `light-implementer-record-missing`(증명 장치 아님, tripwire).
- `packages/cli/src/drive-record.ts` · `scripts/measure-drive-records.js` — snapshot에 `mode`·`promotion`을 넣는다. 둘 다 없거나(옛 기록) 둘 다 있어야 한다.
- `skills/bouncer-run/references/light-run.md` 등 — light도 advance 루프·subagent worker 경로로 문서화. inline 구현 안내 삭제.

설계 한계: `light-implementer-record-missing`은 호환 tripwire일 뿐 실제 구현 주체를 증명하지 않는다. 옛 light fan-in의 “보고 파일 부재 허용” 분기는 호출부가 `light: false`로 고정되어 사실상 죽은 경로다.

## Quiz

1. `run preflight`에서 scale `light` blueprint가 `direct_eligible: true`가 되려면?
   - A) commit task가 정확히 1개이기만 하면 된다
   - B) delegable이고 drive_shape가 serial이며 commit_tasks가 설정 상한 이하여야 한다
   - C) `mode: light` 원장만 있으면 scale과 무관하게 true다

2. 진행 중 옛 inline light 원장으로 판정되는 조건은?
   - A) `mode === 'light'`이고 `light_runner`가 `'subagent'`가 아니며, integrated가 아닌 task가 남아 있다
   - B) `mode === 'light'`이면 표식과 무관하게 항상 legacy다
   - C) 모든 task가 integrated인 끝난 light 원장도 legacy로 막는다

3. light 원장에서 integration cwd로 task 범위 `dispatch`/`report`/`record`/`uncommit`을 호출하면?
   - A) full과 동일하게 lease만 검사한다
   - B) `light-review-required`로 거절한다
   - C) lease 검사보다 먼저 `light-inline-removed`로 거절한다

4. DriveRecord snapshot의 `mode`·`promotion` 키 규칙은?
   - A) `mode`만 있으면 되고 `promotion`은 선택이다
   - B) 둘 다 없거나(옛 snapshot) 둘 다 있어야 한다
   - C) light 원장에서만 `promotion`이 필수이고 full은 둘 다 없어도 된다

## Tasks

### plugin-surface-slimming/light-direct-run-unification/001 · `ed7a6c90`

#### Goal & intent

light blueprint도 직렬 직접 실행 대상으로 고르고, 옛 inline 원장을 시작 전에 가려낸다. 수용 기준은 다음 두 가지다.
- 직렬 light 계획에서 `run preflight`가 `direct_eligible: true`를 낸다.
- 표식 없는 `mode: 'light'` 원장이 있으면 `reason: 'light-ledger-legacy'`, `delegable: false`를 낸다.

검증 명령은 `node scripts/verify-light-preflight.js`다.

#### Current behavior

- `run-preflight.ts:449-453`의 `directEligible`은 `meta.scale === 'full'`일 때만 true다. 그래서 commit task가 하나뿐인 light 계획도 시작 ACQ에서 D를 받지 못한다.
- 원장 판독은 `run-preflight.ts:428-435`에서 `loadLedger` 뒤 `LEDGER_REASON`(`:238-243`)의 status만 본다. `mode`는 보지 않는다.
- 원장 타입 `Ledger`(`execution-contracts.ts:108-123`)에는 `mode?: 'light'`만 있다. 실행 방식을 구분하는 표식이 없다.
- `coordinator-ledger.ts:412` `ledgerModeOf`는 `light|full`만 돌려준다.
- 재현: `node --test test/run-preflight.test.js`. 이 파일의 `writeChain`(`:349`)은 full 직렬 사슬을 만든다. light 원장 fixture는 `:196`(`promotion_stopped`)과 `:460`(`writeLedger`)에 있다. 두 fixture에는 표식이 없다.
- I/O 관찰점: `run-preflight.ts:430` `loadLedger(paths.ledgerFile)` 파일 읽기(실패는 miss로 흡수)와 `:448` `readDirectMaxCommitTasks(repoRoot)` config 읽기다.

#### Target behavior

- 성공:
  - scale `light`이고 delegable이며 shape가 `serial`이고 `1 <= commit_tasks <= direct_max_commit_tasks`이면 `direct_eligible: true`다.
  - 표식(`light_runner: 'subagent'`)이 있는 light 원장은 지금처럼 status 표로 reason을 정한다.
- 실패:
  - 원장이 `mode: 'light'`이고 `light_runner`가 `'subagent'`가 아니며 `integrated`가 아닌 task가 하나라도 있으면(진행 중 또는 `promotion_stopped`인 옛 inline drive) `reason: 'light-ledger-legacy'`, `delegable: false`, `direct_eligible: false`다. 판정 순서는 이 검사 → 원장 status → 문서 status → `no-open-task`다.
- 경계(끝난 옛 원장):
  - 표식이 없어도 모든 task가 `integrated`인 light 원장은 옛 inline drive가 이미 끝나 finalize만 남은 상태다. legacy로 보지 않고 지금처럼 읽는다. preflight는 기존 판정(`no-open-task`·문서 status)을 내고, 폐기를 요구하지 않는다.
  - finalize 쪽 원장 판독(`finalize-*`, `drive-metrics.ts`)은 이 판정을 쓰지 않으므로 바뀌지 않는다.
- 보존:
  - full 원장(`mode` 부재)과 원장 부재의 판정은 바뀌지 않는다.
  - 설정 상한 `0`·비정수·음수는 지금처럼 꺼짐으로 접는다.
  - 다른 거절 reason과 순서도 그대로다.

#### Interface

- 제공:
  - `execution-contracts.ts` `Ledger`에 `light_runner?: 'subagent'`를 더한다. 주석은 "mode가 light일 때만 쓴다. 부재는 옛 inline 원장"이다.
  - `coordinator-ledger.ts`에 순수 판정 `isLegacyLightLedger(ledger: Ledger): boolean`을 export한다. `mode === 'light' && light_runner !== 'subagent'`이고 `status !== 'integrated'`인 task가 하나 이상이면 true다. 모든 task가 integrated인 끝난 옛 원장은 false다. 파일·git을 읽지 않는다. 002가 같은 함수로 명령을 거절한다.
  - `PreflightOk['reason']` union에 `'light-ledger-legacy'`를 더한다.
- 거부:
  - 표식 값이 `'subagent'`가 아닌 light 원장(문자열 오타 포함)은 legacy로 본다. 해석을 넓히지 않는다.
  - 원장 손상·부재는 지금처럼 miss다. legacy로 판정하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/execution-contracts.ts` | `Ledger` | Modify | 원장 타입 정본 | `light_runner` 선택 키 추가 | packages/cli/src/execution-contracts.ts:115-116 |
| `packages/cli/src/coordinator-ledger.ts` | `ledgerModeOf` 옆 `isLegacyLightLedger` | Modify | mode 해석 | legacy light 판정 순수 함수 추가·export | packages/cli/src/coordinator-ledger.ts:412-422 |
| `packages/cli/src/run-preflight.ts` | `runPreflight` · `PreflightOk` | Modify | 위임·직접 실행 자격 | light 직접 자격, legacy reason | packages/cli/src/run-preflight.ts:425-453; packages/cli/src/run-preflight.ts:73-79 |
| `test/run-preflight.test.js` | `writeChain` · `writeLedger` · 직접 자격 사례 | Modify | preflight 계약 고정 | light 자격·legacy 사례 추가, light 원장 fixture에 표식 추가 | test/run-preflight.test.js:196; test/run-preflight.test.js:347-400; test/run-preflight.test.js:460 |
| `scripts/verify-light-preflight.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | build → 이 테스트 → eslint → 테스트 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 단언 변경은 다음 세 곳으로 한정한다.
  - `test/run-preflight.test.js:420-427` 사례 `run preflight with a light blueprint → direct_eligible is false`: 이 task가 뒤집는 기존 단언이다. 이름을 `run preflight with a two-task serial light blueprint → direct_eligible is true`로 바꾸고 기대값을 `false`에서 `true`로 바꾼다. fixture(`writeChain(repo, 2)`과 scale 치환)는 그대로 둔다.
  - `:196`의 `promotion_stopped` light fixture와 `:460` `writeLedger`: 원장 fixture 객체에 `light_runner: 'subagent'`만 더하고 기대 reason(`promotion-stopped` 등)은 그대로 둔다. 두 fixture는 `tasks: []`라 표식이 없어도 legacy가 아니지만, 새 원장 모양과 맞추려고 표식을 단다.
- full `direct_eligible` 사례(`:363-400`)의 기대값은 바꾸지 않는다.
- 새 설정 키를 만들지 않는다. 상한은 `coordinator.direct_max_commit_tasks`(`config.ts:299`)를 그대로 읽는다.
- `isLegacyLightLedger`는 의존 없는 순수 함수로 둔다. `coordinator-ledger.ts`가 이미 import하는 모듈 밖의 import를 늘리지 않는다.
- 코드 주석은 한국어로 왜를 적는다.

### plugin-surface-slimming/light-direct-run-unification/002 · `e3799312`

#### Goal & intent

light blueprint의 구현을 run 세션 inline이 아니라 subagent worker가 맡도록 실행 경로를 full과 하나로 합친다. 옛 inline 원장과 inline 흐름은 원장을 쓰기 전에 명시적인 코드로 거절한다.

수용 기준은 blueprint 수용 기준 1·2다.
- 단일 commit light fixture가 표식 원장, worker prepare, 보고, commit, 통합, 종단, 루트 리뷰, `done` 순으로 간다.
- `light-ledger-legacy`, `light-inline-removed`, `light-implementer-record-missing`, `light-requires-serial`이 각각 원장 bytes를 바꾸지 않고 거절한다.
- 기존 full 테스트는 기대값을 바꾸지 않고 통과한다.

검증 명령은 `node scripts/verify-light-worker-path.js`다.

#### Current behavior

- bootstrap(`coordinator-prepare.ts:1141-1175`):
  - `isLightEligible`(`:141-158`)은 commit 1개, 또는 `scoped_terminal`이면 commit 1개와 종단 1개만 받는다. 그 밖의 light는 `light-requires-single-task`다.
  - seed 원장은 `mode: 'light'`만 갖는다.
  - 재개는 `ledgerModeOf`와 scale만 비교한다(`:1164-1167`).
- prepare: light면 worker 계획을 건너뛰고(`:830-840`) integration을 `workerPath`로 쓴다. baseline은 light에서 생략한다(`:802`).
- next(`coordinate-next.ts:1014`): light 원장의 `implement`에 `payload.inline = true`를 싣는다. 원장 판독(`:582-589`)은 lease shape와 detached만 거른다.
- fan-in(`coordinator-fanin.ts:585-591`): light면 `integrateLightCommitWave`(`:345-430`)로 빠진다. 이 경로는 cherry-pick 없이 verified를 남긴다. `lightWorkerAssigned`(`:75`)는 workerPath가 integration인지 본다.
- 명령(`coordinator-commands.ts`):
  - `guardWorkerDispatch`(`:1113`)와 `coordinateRecord`(`:1417`)는 light에서 integration cwd를 요구한다.
  - `report`는 light에서 보고 파일 검사를 건너뛴다(`:1240`). accepted에는 루트 review.md accepted를 요구한다(`light-review-required`, `:1231-1233`).
  - `session-open`(`:914`)과 `note`(`:948`)는 light를 `ledger-mode-mismatch`로 막는다.
- fence(`coordinator-ledger.ts:108-122` `openLedgerFenced`)는 mode를 보지 않는다.
- 재현: `npm run build && node --test test/coordinator.test.js test/coordinate-next.test.js test/coordinator-e2e.test.js test/cli-coordinate.test.js`.
  - light 계약을 고정한 사례는 다음과 같다.
    - `test/coordinator.test.js:4434,4504,4546,4617,4637,4686,1570,7142`
    - `test/coordinate-next.test.js:461,1920`
    - `test/coordinator-e2e.test.js:1334,1426,1437`
    - `test/cli-coordinate.test.js:1346,1638`
  - fixture 헬퍼는 `lightScaleRepo`·`lightPreparedDrive`(`test/coordinator.test.js:4750`)다.
- I/O 관찰점:
  - `coordinator-prepare.ts:1154` 원장 seed 쓰기
  - `coordinate-next.ts:582` `loadLedgerBytes` 읽기
  - `coordinator-fanin.ts:586` `loadLedger` peek
  - `coordinator-commands.ts:442` `lightReviewAccepted`의 루트 review.md 읽기

#### Target behavior

- 성공:
  - bootstrap 자격과 seed:
    - 새 seed light 원장은 `mode: 'light'`와 `light_runner: 'subagent'`를 갖는다.
    - 자격은 직렬 사슬이다. 첫 commit task는 의존이 없고, 이후 각 commit task는 바로 앞 commit task 하나에만 의존한다. `scoped_terminal`이면 모든 commit task에 의존하는 verification task가 정확히 하나 있다.
  - prepare:
    - light에서도 full과 같이 task별 worker worktree를 만든다. workerPath는 `workers/<task>`다.
    - baseline 생략은 유지한다.
  - next와 fan-in:
    - `implement` payload에 `inline` 키가 없다. cwd는 worker 경로다.
    - fan-in은 full 경로(candidate cherry-pick)를 쓴다. `scoped_terminal` light에서도 구현 wave fan-in은 전체 검증을 돌리지 않는다.
  - 명령:
    - `dispatch`·`report`·`record`는 full과 같은 worker 경계·보고 파일 검사(`checkReportFile`, `## Tests`)를 쓴다.
    - `session-open`과 `note`는 표식 있는 light 원장을 받는다.
  - 단일 commit light 사슬은 `coordinate advance` 루프에서 `worker`(implement) → `judge`(report-outcome) → integrate → verification_node → `final_review` → `done`으로 진행한다.
- 실패:
  - 옛 light 원장(001의 `isLegacyLightLedger`가 true. 표식이 없고 integrated가 아닌 task가 남음) → 원장을 쓰기 전에 `light-ledger-legacy`로 거절한다. 대상은 bootstrap 재개, `openLedgerFenced`를 쓰는 모든 fenced 명령(`note`·`promote-stop` 포함), `coordinate next`·`advance`, `prepare`다. 모든 task가 integrated인 끝난 옛 원장은 지금처럼 읽는다.
  - light 원장에서 task 범위 `dispatch`·`report`·`record`·`uncommit`을 integration cwd에서 부름 → `light-inline-removed`.
  - light `report --outcome accepted`인데 role `implementer`이고 같은 task인 `worker-model` 결정 수가 현재 `dispatch.attempt`보다 작음 → `light-implementer-record-missing`.
  - 직렬 사슬이 아닌 light 계획 → `light-requires-serial`. `light-requires-single-task`와 `light-review-required`는 코드와 hint 표에서 사라진다.
- 보존:
  - full 원장의 모든 판정과 reason은 그대로다.
  - light 원장의 commit 범위 판정(`scope.ts`의 light `out-of-scope`), baseline 생략, `promote-stop` 자격(light만), `promotion_stopped` 거절 순서는 그대로다.
  - 반대 mode로 재개하면 계속 `ledger-mode-mismatch`다.

#### Interface

- 제공:
  - 새 거절 reason 네 개를 `COORDINATE_FAILURE_HINTS`(`coordinator-commands.ts:1722`)에 `cause`·`next`와 함께 등록한다.
    - `light-ledger-legacy`: 안내는 아래 "legacy 안내"를 따른다.
    - `light-inline-removed`: 안내는 "plugin을 이 CLI와 같은 버전으로 맞추고 subagent worker로 구현"이다.
    - `light-implementer-record-missing`: 안내는 "이 attempt를 subagent implementer가 구현하지 않았다면 accepted로 보고하지 말고 rework로 보고한 뒤 implementer를 dispatch한다. `worker-model`은 실제로 dispatch한 implementer의 모델만 기록한다"이다. 기록만 채우고 다시 보고하라는 안내는 두지 않는다. 그런 안내는 구현 주체를 속이는 기록을 부추기기 때문이다.
    - `light-requires-serial`: 안내는 "직렬 사슬로 다시 계획하거나 scale full로 계획"이다.
  - legacy 판정은 001의 `isLegacyLightLedger`를 쓴다. `openLedgerFenced` 안에서 lease shape 검사 바로 뒤에 둔다. fence 불일치보다 먼저다.
- 거부(즉시 throw가 아니라 `ok:false` 결과):
  - 위 네 reason. 모두 원장·worktree·문서를 쓰기 전에 반환한다.
- 판정 순서:
  - `light-ledger-legacy`: `openLedgerFenced`에서 lease shape 검사 바로 뒤, fence 불일치보다 먼저다. `coordinateNext`에서는 `assertLeaseShape` 바로 뒤, detached 검사보다 먼저다.
  - `light-inline-removed`: task 명령 공통 경로(`coordinator-commands.ts:1700-1710`)에서 task 조회 뒤, `checkTaskLease`·`guardWorkerDispatch`·`unassigned-worker-worktree`보다 먼저다. 대상 명령은 `dispatch`·`report`·`record`·`uncommit`이다. `record`는 `guardWorkerDispatch`를 거치지 않으므로 이 공통 위치에서 검사해야 함께 걸린다. cwd 판정은 `realpath(cwd) === realpath(integrationPath)`이고, `ensureIntegrationCwd(..., task)`가 throw하기 전에 결과로 돌려준다.
  - `light-implementer-record-missing`: `report`에서 `checkReportFile` 검사 뒤, stale 비교 전이다. accepted에만 적용한다.
- `light-implementer-record-missing`의 성격:
  - 구 plugin의 inline 흐름을 잡는 호환 장치(tripwire)일 뿐이다. 누가 구현했는지는 증명하지 않는다(`worker-model`은 root가 넘긴 값의 기록이다). 이 한계는 수용한 위험이고, 리뷰·record의 기존 검사는 그대로 남는다.
  - attempt와 결정을 짝짓지 않는다. 같은 task의 implementer 결정 수를 중복 포함해 세고 `dispatch.attempt`와 비교한다.
- legacy 안내(`light-ledger-legacy`의 `next`)는 순서대로 적는다.
  1. integration worktree의 `git diff`·`git diff --staged`와 untracked 파일을 보존한다.
  2. 사용자에게 폐기를 묻는다. 폐기는 되돌릴 수 없으므로 사용자가 명시적으로 승인한 뒤에만 한다(AGENTS.md hard rule 3).
  3. integration worktree를 폐기한다.
  4. `/bouncer-plan`으로 다시 계획한 뒤 실행한다.
  - CLI는 이 안내를 문자열로만 준다. 폐기·삭제를 스스로 실행하지 않는다.
- miss(거절 아님):
  - 원장 부재는 지금처럼 `missing-ledger`·신규 seed다.
  - `worker-model` 결정의 `task` 필드가 없으면 그 결정은 implementer 기록 수에 넣지 않는다.
- 도메인 용어 "직렬 사슬": commit task id를 위상 순서로 놓았을 때 `depends_on`이 `[]` 하나, 그 밖은 모두 직전 commit task id 하나뿐인 모양이다.
  - 예: `001: []`, `002: [TASKS-001]`, `003: [TASKS-002]`, 종단 `004: [TASKS-001, TASKS-002, TASKS-003]`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-prepare.ts` | `isLightEligible` · `coordinateBootstrap` · `prepareCoordinator` | Modify | light 자격·seed·prepare 생략 | 직렬 자격, 표식 seed, legacy 재개 거절, light worker 생성 | packages/cli/src/coordinator-prepare.ts:141; packages/cli/src/coordinator-prepare.ts:830; packages/cli/src/coordinator-prepare.ts:1146-1167 |
| `packages/cli/src/coordinate-next.ts` | `coordinateNext` · `taskNext` | Modify | 다음 행동 판정 | legacy 거절, inline 제거 | packages/cli/src/coordinate-next.ts:582-589; packages/cli/src/coordinate-next.ts:1014 |
| `packages/cli/src/coordinator-fanin.ts` | `integrateLightCommitWave` · `lightWorkerAssigned` · `integrateCommitWave` | Modify | light 전용 fan-in | light 분기와 두 함수 삭제, full fan-in 공용 | packages/cli/src/coordinator-fanin.ts:75; packages/cli/src/coordinator-fanin.ts:345-430; packages/cli/src/coordinator-fanin.ts:585-591 |
| `packages/cli/src/coordinator-commands.ts` | `guardWorkerDispatch` · `coordinateReport` · `coordinateRecord` · `coordinateSessionOpen` · `coordinateNote` · `lightReviewAccepted` · task 명령 공통 경로 · `COORDINATE_FAILURE_HINTS` | Modify | light 경계·리뷰 요구·hint | light 분기 제거, 새 두 거절, session-open·note 허용, hint 갱신 | packages/cli/src/coordinator-commands.ts:442; packages/cli/src/coordinator-commands.ts:1700-1710; packages/cli/src/coordinator-commands.ts:914; packages/cli/src/coordinator-commands.ts:948; packages/cli/src/coordinator-commands.ts:1113; packages/cli/src/coordinator-commands.ts:1231-1240; packages/cli/src/coordinator-commands.ts:1417; packages/cli/src/coordinator-commands.ts:1875-1905 |
| `packages/cli/src/coordinator-ledger.ts` | `openLedgerFenced` | Modify | fence 공용 판독 | legacy light 거절 삽입 | packages/cli/src/coordinator-ledger.ts:108-122 |
| `test/coordinator.test.js` | light 사례들 · `lightPreparedDrive` | Modify | light bootstrap·report·dispatch 계약 | 새 계약으로 재작성 | test/coordinator.test.js:1570; test/coordinator.test.js:4434-4700; test/coordinator.test.js:7142 |
| `test/coordinate-next.test.js` | light implement·종단 사례 | Modify | inline payload 고정 | inline 부재·worker cwd·legacy 거절 | test/coordinate-next.test.js:461; test/coordinate-next.test.js:1920-1966 |
| `test/coordinator-e2e.test.js` | light drive 사례 | Modify | inline drive 끝까지 | worker 경로 drive와 advance 순서 | test/coordinator-e2e.test.js:1334-1500 |
| `test/cli-coordinate.test.js` | session-open light 사례 · scoped_terminal light CLI 사례 | Modify | light 거절·prepare | 표식 light 허용, legacy 거절, worker prepare | test/cli-coordinate.test.js:1346; test/cli-coordinate.test.js:1638 |
| `packages/cli/src/coordinator-worker.ts` | `scopeDirtyPaths`·`workerCommitEvidence` JSDoc | Modify | worker 증적 판정 | "light는 integration" 주석 두 곳을 worker 경로로 고침(동작 불변) | packages/cli/src/coordinator-worker.ts:316; packages/cli/src/coordinator-worker.ts:337 |
| `packages/cli/src/cli-usage.ts` | `session-open` usage | Modify | 사용법 문구 | "light 원장 거절" 문구를 옛 light 원장 거절로 고침 | packages/cli/src/cli-usage.ts:59; test/cli-help.test.js:228 |
| `scripts/verify-light-worker-path.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | build → 네 테스트 → eslint → 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 단언은 아래 사례만 바꾼다. 나머지 full 사례의 기대값은 그대로 둔다.
  - `test/coordinator.test.js`
    - `:4434`: workerPath가 `workers/001`이고 worker worktree가 등록된다.
    - `:4504`·`:4546`·`:4590`: reason이 `light-requires-serial`이다. 두 commit 직렬 사슬은 이제 승인된다.
    - `:4617`: dispatch·report를 integration cwd가 아니라 prepare가 돌려준 worker cwd에서 부른다. 보고 파일이 없으면 `report-revision-missing`이다.
    - `:4637`: `light-implementer-record-missing` 사례로 바꾼다.
    - `:4686`: `light-inline-removed` 사례로 바꾼다.
    - `:1570` 뒤쪽 light 절반: 기대값을 같은 상태의 full 원장 결과와의 일치로 바꾼다. 같은 fixture를 scale full로 bootstrap하고 integration에 `extra.js`를 쓴 뒤 integrate한 결과의 `reason`과 light 결과의 `reason`이 같아야 한다. 앞쪽 verification node 절반은 바꾸지 않는다.
    - `:7142`: Tests 절이 없으면 `report-tests-invalid`다.
    - `:5827` note 사례: `l.mode = 'light'`만 바꾼 원장(표식 없음, 열린 task 있음)의 기대 reason은 `ledger-mode-mismatch`에서 `light-ledger-legacy`로 바뀐다. 표식 있는 light 원장의 note 성공 사례를 더한다.
  - `test/coordinate-next.test.js`
    - `:1920`: `'inline' in payload`가 `false`이고 cwd가 worker 경로다.
    - `:461`: fixture에 표식을 더한다. 행동 순서 기대값은 유지한다.
    - `:301` promotion_stopped 사례: `ledger.mode = 'light'` 옆에 `ledger.light_runner = 'subagent'`를 더한다. 기대값(`blocked`·`promotion-stopped`)은 유지한다.
  - `test/coordinator-e2e.test.js`
    - `:1334`: worker 경로로 바꾸고 runner 호출 수 기대값(구현 통합까지 0회, 종단 node에서 1회)은 유지한다.
    - `:1437`: runner 단언이 없는 사례다. `workerPath === integrationPath`·`workers` 부재·`payload.inline === true` 단언(`:1472-1489`)을 각각 다음으로 바꾼다. workerPath는 `workers/001`이다. workers 디렉터리가 있다. `'inline' in payload`는 `false`다. cwd는 worker 경로다.
    - `:1426`: `light-requires-serial`이다.
  - `test/cli-coordinate.test.js`
    - `:1346`: 표식 light는 성공, `promotion_stopped`·`partial_closed`는 계속 거절한다.
    - `:1638`: prepare가 worker 하나만 연다.
- light 원장 사례에서 integration cwd로 부르던 `dispatch`·`report`·`record`·`uncommit`은 모두 worker cwd로 옮긴다. integration cwd 호출은 `light-inline-removed`를 기대하는 사례에만 남긴다.
- promote-stop·`--promote-light` 사례(`test/coordinator.test.js:4766-5000`)는 이 task에서 기대값을 바꾸지 않는다. fixture가 표식 원장을 만들게 되는 변화만 허용한다. worker 기준 계산은 003의 몫이다.
- 새 reason은 `ok:false` 결과로만 낸다. 원장 version은 1로 유지한다.
- 다섯 promote-stop 사유와 `promotion_stopped` 거절 우선순위는 바꾸지 않는다.
- 코드 주석은 한국어로 왜를 적는다. 테스트 이름은 `<조건> → <결과>`다.

### plugin-surface-slimming/light-direct-run-unification/003 · `eb5983a8`

#### Goal & intent

light 구현이 worker worktree로 옮겨 간 뒤에도 승격 정지와 full 승격이 작업 내용을 잃지 않게 하고, light 원장의 범위 개정을 승격 정지로 잇는다.

수용 기준은 blueprint 수용 기준 4다.
- 다섯 사유가 그대로 기록된다.
- worker에서 커밋했거나 커밋하지 않은 변경이 `--promote-light` patch로 옮겨진다.
- full 원장 `promoted_from.reason`이 남는다.
- light 원장의 `coordinate revise`가 `light-scope-revision-requires-promotion`으로 거절된다.

검증 명령은 `node scripts/verify-light-promotion.js`다.

#### Current behavior

- `coordinatePromoteStop`(`coordinator-commands.ts:850-900`)은 `diff_sha`를 `worktreeDiffSha(exec, integration.integrationPath)`로 계산한다(`:886`). `worktreeDiffSha`(`coordinator-prepare.ts:168-174`)는 porcelain과 `git diff HEAD`만 해시한다. HEAD 이후 상태만 보므로 worker의 커밋을 못 본다.
- `promoteLightBootstrap`(`coordinator-prepare.ts:202-380`):
  - 드리프트 검사, patch(`git diff --binary HEAD`와 untracked), reset을 모두 integration에서 한다.
  - 002 뒤 light 작업은 `workers/<task>`에 있으므로 patch가 비고, 옛 light worker가 남아 full prepare와 겹친다.
- `coordinateRevise`(`cli-git-commands.ts:741-787`)는 fence만 확인하고 `scope.reviseTaskScope`에 넘긴다. 원장 mode를 보지 않는다.
- 보존 헬퍼 `salvageRevokedWorker`(`coordinator-prepare.ts:476`)는 worker 상태를 `.bouncer/runtime/salvage/`에 patch·ref·report로 남긴다.
- 재현: `npm run build && node --test test/coordinator.test.js test/cli-coordinate.test.js`.
  - promote 사례는 `test/coordinator.test.js:4737-5100`(헬퍼 `lightPreparedDrive` `:4750`)이다.
  - revise CLI 사례는 `test/cli-coordinate.test.js:429-500`이다.
- I/O 관찰점:
  - `coordinator-prepare.ts:168` git diff 실행
  - `:214` `fs.existsSync(archive)`
  - `:284-290` patch·원장 파일 쓰기
  - `cli-git-commands.ts:750` `loadLedgerBytes`

#### Target behavior

- 성공:
  - promote-stop:
    - `diff_sha`는 열린 task의 worker에서 계산한다. 기준 커밋은 `dispatch.base_head`이고, 없으면 원장 `integrationHead`다. 해시 대상은 그 기준 대비 diff와 porcelain이다.
    - worker가 아직 없으면(prepare 전) integration을 그 기준으로 계산한다.
  - `--promote-light`:
    - 같은 기준으로 드리프트를 검사한다.
    - worker의 기준 대비 변경을 patch로 쓴다. 계획 문서 경로는 지금처럼 제외한다.
    - 단계 순서: 드리프트 검사 → patch 계산 → worker를 `salvageRevokedWorker`로 보존 → patch 쓰기 → 원장 보관(archive) → 계획 seed → `git apply --check` → full 원장 쓰기 → 옛 light worker의 worktree와 branch 제거. 제거는 마지막 단계다.
    - `salvage`(보존 산출물 경로)는 `--promote-light` 성공 응답에만 싣는다. `promoted_from`과 `PromotionRecord`의 키는 바꾸지 않는다(`execution-contracts.ts`는 이 task에서 건드리지 않는다).
    - 이후 full prepare는 같은 task의 worker를 새로 만든다.
  - `coordinate revise`(`cli-git-commands.ts:741-787`)는 `openLedgerFenced`를 쓰지 않고 `loadLedgerBytes`와 `assertLedgerFence`를 직접 부른다. fence 통과 직후 원장을 쓰지 않고 다음을 순서대로 판정한다.
    1. 옛 light 원장(001의 `isLegacyLightLedger`)이면 `light-ledger-legacy`
    2. 표식 있는 light 원장이면 `light-scope-revision-requires-promotion`
- 실패:
  - worker 보존 실패 → `worker-salvage-failed`. 원장, worker, patch 어느 것도 바꾸지 않는다.
  - 보존 뒤, full 원장 쓰기 전 단계가 실패하면 지금처럼 원장·계획 파일·index를 되돌리고 `promote-light-incomplete`를 낸다. worker는 아직 지우지 않았으므로 그대로 남는다. 되돌린 뒤 worker 기준 드리프트 지문이 원래 `promotion.diff_sha`와 같아야 `restored: true`다. 그래서 같은 명령의 재시도가 `promotion-diff-drift` 없이 다시 진행된다. 이번 실패의 salvage 산출물은 지우지 않고 응답에 싣는다.
  - full 원장을 쓴 뒤 worker 제거가 실패 → `promote-light-worker-remains`(`ok: false`). 이때 승격(full 원장, patch, salvage)은 끝난 상태이고 되돌리지 않는다. 응답에 worker 경로와 salvage 경로를 싣는다. `next`는 "사용자 승인 뒤 `git worktree remove --force <path>`와 branch 삭제를 하고 `coordinate next`로 이어 간다"이다.
  - 드리프트 → 계속 `promotion-diff-drift`.
  - 표식 없는 옛 light 원장에 `--promote-light` → `light-ledger-legacy`. 이 검사는 `promote-light-requires-stopped`·scale 검사보다 먼저 한다.
- 보존:
  - 다섯 사유 enum, 멱등 재실행, `promotion-already-stopped`, `promote-stop-requires-light`, `promote-light-*` 거절 코드, full 원장의 revise 동작은 그대로다.

#### Interface

- 제공:
  - `worktreeDiffSha(exec, cwd, base?: string)`. `base`를 생략하면 지금처럼 `HEAD`다. promote-stop과 promote-light는 같은 함수와 같은 기준을 쓴다.
  - 새 reason `light-scope-revision-requires-promotion`을 `COORDINATE_FAILURE_HINTS`에 등록한다. 안내는 "`coordinate promote-stop --reason out-of-scope`(또는 task-split)로 멈춘 뒤 full로 다시 계획"이다. 004의 리뷰 repair 거절도 같은 reason을 쓴다.
  - `--promote-light` 성공 응답에 `salvage`(보존 산출물 경로)를 더한다. 응답에만 붙는 키이고 `promoted_from`·`PromotionRecord`는 그대로다.
  - 새 reason `promote-light-worker-remains`를 hint 표에 등록한다.
- 거부:
  - 옛 light 원장의 `coordinate revise`·`--promote-light` → `light-ledger-legacy`
  - 표식 있는 light 원장의 `coordinate revise`(모든 플래그 조합) → `light-scope-revision-requires-promotion`
  - 보존 실패 → `worker-salvage-failed`
  - 열린 task의 원장 `workerPath`가 기록돼 있는데 Git에 등록된 worker가 아님 → promote-stop과 `--promote-light` 모두 `unassigned-worker-worktree`(`workerPath` 포함)로 거절한다. 빈 patch로 조용히 내려가지 않는다.
- 테스트 seam(새로 만들지 않고 기존 주입점을 쓴다):
  - `coordinate({ ..., exec })`의 Git 실행기 `exec(cmd: string, args: string[], opts) → string | Buffer`. worker 제거 실패는 `args[0] === 'worktree' && args[1] === 'remove'`일 때 던지는 래퍼로 주입한다.
  - `writeLedger(file, data)`. full 원장 쓰기 실패는 새 원장(`promoted_from` 포함) 쓰기에서 던지는 래퍼로 주입한다(`test/coordinator.test.js:4986`과 같은 방식).
  - 보존 실패는 `.bouncer/runtime/salvage` 자리에 일반 파일을 두어 디렉터리 생성이 실패하게 만든다.
- miss:
  - 열린 task에 `workerPath`가 없음(prepare 전) → integration을 원장 `integrationHead` 기준으로 계산한다. 거절하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinatePromoteStop` · `COORDINATE_FAILURE_HINTS` | Modify | 승격 정지 기록·hint | worker 기준 diff_sha, 새 hint | packages/cli/src/coordinator-commands.ts:850-900; packages/cli/src/coordinator-commands.ts:1976-2010 |
| `packages/cli/src/coordinator-prepare.ts` | `worktreeDiffSha` · `promoteLightBootstrap` · `salvageRevokedWorker` | Modify | integration 기준 승격 | worker 기준 patch, 보존·제거 | packages/cli/src/coordinator-prepare.ts:168-174; packages/cli/src/coordinator-prepare.ts:202-380; packages/cli/src/coordinator-prepare.ts:476 |
| `packages/cli/src/cli-git-commands.ts` | `coordinateRevise` | Modify | revise fence·위임 | light 원장 거절 | packages/cli/src/cli-git-commands.ts:741-787 |
| `test/coordinator.test.js` | promote-stop·promote-light 사례 · `lightPreparedDrive` | Modify | integration 기준 승격 고정 | worker 변경 기준으로 재작성, 보존 실패 사례 추가 | test/coordinator.test.js:4750; test/coordinator.test.js:4766-5100 |
| `test/cli-coordinate.test.js` | revise·promote-light CLI 사례 | Modify | revise 동작·promote CLI | light revise 거절 사례 추가 | test/cli-coordinate.test.js:429; test/cli-coordinate.test.js:988 |
| `scripts/verify-light-promotion.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | build → 두 테스트 → eslint → 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 단언 변경 범위:
  - `test/coordinator.test.js:4905`·`:4986`·`:5051`·`:5082`: dirty 파일을 integration이 아니라 `lightPreparedDrive`가 만든 worker 경로에 쓰도록 fixture만 옮긴다. 기대 reason과 `promoted_from` 키, rollback 결과(`restored`)는 유지한다.
  - `:4766-4877`은 기대값을 바꾸지 않는다.
- `PromotionRecord` 모양(`execution-contracts.ts:30-37`)과 `promoted_from` 키는 바꾸지 않는다.
- 이미 통합된 앞 commit task의 커밋은 integration branch에 그대로 둔다. patch는 열린 task 하나의 변경만 담는다. 2개 이상인 light의 승격 이월은 후속 BP2의 몫이다.
- 승격은 사용자가 full 재계획을 승인한 뒤에만 부르는 기존 전제를 유지한다. CLI는 승인 증거를 새로 검사하지 않는다.
- 코드 주석은 한국어로 왜를 적는다.
- 테스트 seam 실제 주입점: Interface의 `exec`·`writeLedger`는 `coordinate({ ..., deps: { execFileSync, writeLedger } })`로 넘기며, 코드에서는 `deps.execFileSync(cmd, args, opts)`(`packages/cli/src/coordinator-commands.ts:1650`)와 `deps.writeLedger(file, data)`(`packages/cli/src/coordinator-commands.ts:1655`)로 받는다. `writeLedger` 주입의 참고 사례는 `test/coordinator.test.js:5019-5020`이다.

### plugin-surface-slimming/light-direct-run-unification/004 · `db3b135b`

#### Goal & intent

light 리뷰가 통합 뒤 루트 리뷰 1회로 옮겨 가도 discovery 뒤 수정 한 번의 기회가 남게 한다. 이 BP의 light 리뷰 상한은 discovery 1회와 리뷰 원인 repair 1회다. 앞서 정한 "delta 1회"(q6/q9)는 이 BP에서 열지 않고 후속 BP로 미룬다(q11).

수용 기준은 blueprint 수용 기준 3이며 세부는 다음과 같다.
- commit task가 1개든 2개든 light drive는 task 범위 `review`를 내지 않는다. 모든 task가 통합된 뒤 루트 `final_review`(single/combined)를 discovery로 정확히 한 번 낸다.
- discovery가 accepted가 아니고 리뷰 repair 결정이 없으면 `coordinate repair --review-finding`을 한 번 접수한다.
- repair가 재통합된 뒤에는 delta `final_review`를 내지 않고 `final-review-blocked`로 멈춘다. 남은 finding의 처리(deferred 기록 또는 `review accept-risk`)는 사용자 결정이다.

검증 명령은 `node scripts/verify-light-final-review.js`다.

#### Current behavior

- `blueprintNext`(`coordinate-next.ts:776-839`)는 blueprint 모드에서 루트 review가 accepted가 아니면 discovery `final_review`를 낸다.
  - discovery가 저장되면 `contract !== 'brief'`일 때 바로 `final-review-blocked`다(`:790-794`).
  - brief만 리뷰 repair 뒤 delta를 연다(`:797-809`).
- light blueprint의 계약은 `legacy`로 읽힌다. 새 scaffold가 `review_contract: brief`를 써도 `schema.reviewContractOf`(`schema.ts:149-153`)가 `scale: light`를 언제나 `legacy`로 바꾸고, `reviewContractAt`(`coordinator-worker.ts:118-132`)이 그 결과를 쓴다. 그래서 002 뒤 light는 discovery 한 번으로 끝나고 수정 기회가 없다.
  - 002 이전 light-run 절차(`skills/bouncer-run/references/light-run.md` step 4)는 run 세션이 범위 안에서 고친 뒤 delta를 돌리게 했다.
- `finalReviewGate`(`coordinator-repair.ts:290-320`)도 `contract !== 'brief'`이면 리뷰 원인 repair를 `final-review-single-round`로 거절한다(`:298`).
  - brief의 `--new-path`는 Do not touch 합집합으로 판정한다(`:303-316`). light task에는 Do not touch 절이 없어 합집합이 비므로 그대로 쓰면 어떤 새 경로든 접수된다.
- delta를 light에 열려면 delta 라운드의 dispatch·기록 경로까지 바꿔야 한다. 그 경로는 이 BP의 후보 경로 밖이라 이 task에서 다루지 않는다.
- 재현: `npm run build && node --test test/coordinate-next.test.js test/coordinator-e2e.test.js`. 최종 리뷰 사례는 `test/coordinate-next.test.js`의 `final_review`·`final-review-blocked` 단언들이다.
- I/O 관찰점:
  - `coordinate-next.ts:777` 루트 review.md status 읽기
  - `coordinator-repair.ts:270` `finalReviewDiscoveryStored`의 review.md 읽기

#### Target behavior

- 성공(원장 `mode: 'light'`, review_scope blueprint):
  - discovery 저장 뒤 not accepted이고 리뷰 repair 결정이 없으면 `final-review-blocked`이다. `next`는 "범위 안 must_fix를 `coordinate repair --review-finding`으로 한 번 고친다. 아니면 사용자 결정(deferred 기록 또는 accept-risk)을 기다린다"이다.
  - 그 상태에서 `coordinate repair --review-finding`(새 경로 없음)이 접수된다.
  - repair가 재통합되면(모든 task integrated) `final-review-blocked`이다. 이때 `cause`는 "light 리뷰는 discovery와 repair 한 번을 썼고 이 BP에서 delta는 열지 않는다"이고, `next`는 "남은 finding을 사용자에게 보이고 결정을 기다린다"이다. delta `final_review`는 내지 않는다.
- 실패:
  - light 리뷰 repair에 `--new-path`가 있음 → `light-scope-revision-requires-promotion`(hint는 003이 등록).
  - 두 번째 리뷰 repair → `final-review-single-round`.
  - supplement → 계속 `final-review-single-round`.
- 보존:
  - full 원장(legacy·brief 계약)의 판정과 cause·next 문구는 바뀌지 않는다. brief의 repair 뒤 delta도 그대로다.
  - review-dispatch가 light에 single/combined를 고르는 동작(`review-dispatch.ts:983-985`)은 바뀌지 않는다.
  - 1 task light에서 별도 최종 리뷰를 더하지 않는다. 루트 리뷰가 그 task 리뷰다.

#### Interface

- 제공:
  - 원장 `mode`가 light이면 최종 리뷰 상한 판정에서 discovery 뒤 리뷰 원인 repair 1회를 허용한다. delta는 허용하지 않는다. 판정 입력은 원장 `mode`이고 blueprint 문서 표식은 바꾸지 않는다.
- 거부:
  - light 리뷰 repair의 새 경로 → `{ ok: false, reason: 'light-scope-revision-requires-promotion' }`. 원장·문서를 쓰기 전에 낸다.
  - light의 두 번째 리뷰 repair와 supplement → `final-review-single-round`(기존 reason).
- miss: 루트 review.md가 없거나 판독할 수 없으면 지금처럼 discovery 전 상태로 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinate-next.ts` | `blueprintNext` | Modify | 최종 리뷰 단계 판정 | light 원장의 repair 안내와 repair 뒤 blocked 분기 | packages/cli/src/coordinate-next.ts:776-839 |
| `packages/cli/src/coordinator-repair.ts` | `finalReviewGate` · `FINAL_REVIEW_REJECTION_REASONS` | Modify | 리뷰 원인 repair 접수 | light repair 1회 허용, light 새 경로 거절, reason 목록 추가 | packages/cli/src/coordinator-repair.ts:290-320; packages/cli/src/coordinator-repair.ts:1487 |
| `test/coordinate-next.test.js` | 최종 리뷰 사례 | Modify | final_review·blocked 고정 | light discovery → repair → blocked 사례 추가 | test/coordinate-next.test.js:461 |
| `test/coordinator-e2e.test.js` | light drive 사례 | Modify | light drive 끝까지 | 두 commit 직렬 light fixture로 최종 리뷰 1회와 repair 상한 사례 추가 | test/coordinator-e2e.test.js:1334 |
| `rules/cli.md` | 최종 리뷰 거절 표 | Modify | `FINAL_REVIEW_REJECTION_REASONS`와 대조되는 문서 표 | 새 reason 행 하나와 light 허용 한 문장 추가 | rules/cli.md:712-716; test/doc-shape-cli.test.js:260 |
| `scripts/verify-light-final-review.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | build → 테스트 → eslint → 문서 표 검사 → 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 단언은 바꾸지 않는다. full·brief 최종 리뷰 사례의 reason과 cause·next 문구 기대값은 그대로 둔다. 이 task는 새 사례만 더한다.
- light의 delta 라운드는 열지 않는다. delta dispatch·기록 경로(`review-dispatch.ts`, `review-record.ts`, `cli-review-dispatch-command.ts`)는 후속 BP의 몫이다.
- 두 commit light fixture는 plan gate를 거치지 않고 테스트 저장소에 직접 쓴다. plan gate의 light 단일 task 제약은 후속 BP2의 몫이다.
- 새 reason 문자열은 003과 같은 `light-scope-revision-requires-promotion`을 쓴다. hint는 003이 등록하므로 이 task는 003 뒤에 돈다. `test/coordinator.test.js:245`(모든 coordinator reason 리터럴에 hint가 있어야 함)는 통합 뒤에도 통과해야 한다. hint 표(`coordinator-commands.ts`)는 이 task가 고치지 않는다.
- `finalReviewGate`의 새 reason은 `FINAL_REVIEW_REJECTION_REASONS`(`coordinator-repair.ts:1487`)에도 넣는다. 문서 lint가 `rules/cli.md` 거절 표와 대조하므로 같은 commit에서 그 표에 행 하나를 더한다. `rules/cli.md`의 나머지 light 서술은 006의 몫이다.
- 코드 주석은 한국어로 왜를 적는다.

### plugin-surface-slimming/light-direct-run-unification/005 · `225c077b`

#### Goal & intent

light와 full drive의 토큰·repair wave·승격 사유를 같은 기록에서 나눠 잰다. 수용 기준은 blueprint 수용 기준 5다.
- `summarizeDriveRecord`가 `mode`와 `promotion`을 낸다.
- `node scripts/measure-drive-records.js`가 `by_mode`(light·full·unknown)와 `promotions`를 낸다.
- `mode` 키가 없는 옛 snapshot도 계속 유효하다. 이런 snapshot은 `unknown`으로 센다.

검증 명령은 `node scripts/verify-light-drive-metrics.js`다.

#### Current behavior

- `summarizeDriveRecord`(`drive-record.ts:47-90`)는 tasks·decision_kinds·scope·unexpected·overlaps·conflicts·repair_waves·reviewer·baseline·review만 낸다. 원장 `mode`·`promotion`·`promoted_from`(`execution-contracts.ts:115-120`)은 읽지 않는다.
- `isDriveRecord`(`:132-145`)는 위 키만 검사한다.
- 소비자 두 곳이 같은 함수를 부른다.
  - snapshot: `drive-metrics.ts:813` `drive_record: summarizeDriveRecord(...)`
  - finalize digest: `finalize-digest.ts:189`
  - `test/finalize-digest.test.js:1376`이 두 값의 동일성을 고정한다.
- `scripts/measure-drive-records.js`:
  - `isDriveRecord` 복제(`:47-62`)로 모양을 거른다.
  - `aggregate`(`:166-200`)는 totals에 worker_tokens·session_tokens·repair wave를 합산만 하고 mode로 나누지 않는다.
  - 세션은 blueprint 이름으로 snapshot과 짝짓는다(`:168-170`). `root-direct-session`도 같은 세션 파일에 있다.
- 재현: `npm run build && node --test test/drive-record.test.js test/measure-drive-records.test.js test/cli-metrics.test.js`.
  - `test/drive-record.test.js:8`의 `ZERO`가 전체 모양을 `deepStrictEqual`로 고정한다.
  - `test/cli-metrics.test.js:1166`이 snapshot의 `drive_record`를 `summarizeDriveRecord(ledger, null)`과 비교한다.
- I/O 관찰점:
  - `scripts/measure-drive-records.js`의 `expand`(입력 디렉터리 읽기)와 `--sessions` 파일 읽기
  - `drive-record.ts`는 I/O가 없다.

#### Target behavior

- 성공:
  - `summarizeDriveRecord(ledger, review)`가 항상 다음 두 키를 낸다.
    - `mode`: 원장 `mode === 'light'`면 `'light'`, 아니면 `'full'`
    - `promotion`: 원장 `promotion`이 있으면 `{ reason, task }`. 없고 `promoted_from`이 있으면 그 `{ reason, task }`. 둘 다 없으면 `null`
  - 원장이 null이면 `mode: 'full'`, `promotion: null`이다.
  - 집계 출력에 두 키가 생긴다.
    - `by_mode: { light, full, unknown }`. 각 항목은 `{ drives, tasks, worker_tokens, session_tokens, ci_repair_waves, review_repair_waves }`다. 세션 토큰은 짝지은 snapshot의 mode로 나눈다.
    - `promotions: { <reason>: count }`. 키는 사전순이다.
  - 기존 `totals`·`threshold_effects` 값은 그대로다.
- 실패:
  - `mode`가 `light|full` 밖이거나, `promotion`이 null도 `{reason: string, task: string}`도 아님 → `isDriveRecord` false.
    - snapshot 판독은 `metrics-snapshot-invalid`로, 스크립트는 `skipped[].reason: 'not-snapshot'`으로 처리한다.
- 보존:
  - 키가 없는 옛 `drive_record`는 유효하다. 스크립트에서 `by_mode.unknown`으로 센다.
  - snapshot·digest의 `version`은 1로 둔다.
  - 같은 입력이면 출력 바이트가 같다.

#### Interface

- 제공:
  - `DriveRecord += mode?: 'light' | 'full'; promotion?: { reason: string; task: string } | null`. 새 계산은 항상 두 키를 채우고, 타입이 선택인 것은 옛 snapshot 판독 때문이다.
  - 집계 출력 `by_mode`·`promotions`. 출력 `version`은 1로 둔다.
- 거부: 위 실패 항목의 모양 불일치
- miss: 키 부재는 거절이 아니라 `unknown`이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/drive-record.ts` | `DriveRecord` · `summarizeDriveRecord` · `isDriveRecord` | Modify | 실행 기록 순수 계산 | mode·promotion 계산과 선택 키 검사 | packages/cli/src/drive-record.ts:15-22; packages/cli/src/drive-record.ts:47-90; packages/cli/src/drive-record.ts:132-145 |
| `scripts/measure-drive-records.js` | `isDriveRecord` · `aggregate` | Modify | 기록 집계 | 복제 검사 갱신, by_mode·promotions | scripts/measure-drive-records.js:47-62; scripts/measure-drive-records.js:166-200 |
| `test/drive-record.test.js` | `ZERO` · 계산 사례 | Modify | 모양 고정 | 두 키 추가, mode·promotion 사례 | test/drive-record.test.js:8-12 |
| `test/measure-drive-records.test.js` | 집계 사례 | Modify | 집계 고정 | light·full·옛 snapshot 혼합 사례 | test/measure-drive-records.test.js:79 |
| `test/cli-metrics.test.js` | snapshot drive_record 사례 | Modify | snapshot 보존 고정 | 승격된 원장의 snapshot에 promotion이 실리는 사례 | test/cli-metrics.test.js:1166-1200 |
| `scripts/verify-light-drive-metrics.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | build → 네 테스트 → eslint → 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 단언 변경은 `test/drive-record.test.js:8`의 `ZERO`에 `mode: 'full', promotion: null` 두 키를 더하는 것 하나뿐이다.
- `test/measure-drive-records.test.js`의 기존 `totals`·`thresholds`·`sweep` 기대값은 바꾸지 않는다.
- 스크립트는 `packages/cli/dist`를 require하지 않는 규칙(`scripts/measure-drive-records.js:11`)을 지킨다. 검사 규칙은 복제하되 두 곳을 같이 고친다.
- `test/finalize-digest.test.js:1376`(digest와 snapshot 동일)은 고치지 않고 그대로 통과해야 한다. 검증 래퍼가 이 테스트도 실행한다.
- 원장에서는 `mode`·`promotion`·`promoted_from` 필드만 읽는다. 원장 쓰기 쪽(001~003)과 경로가 겹치지 않는다.
- digest와 snapshot의 값 일치는 같은 함수를 공유한다는 구조와 `test/finalize-digest.test.js:1376`으로 보장한다. 그 파일은 후보 경로 밖이라 light·승격 원장 사례를 새로 더하지 않는다.
- benchmark·ablation 문서(`benchmarks/**`)의 측정 절차 갱신은 후보 경로 밖이라 후속 작업으로 남긴다.
- 코드 주석은 한국어로 왜를 적는다.

### plugin-surface-slimming/light-direct-run-unification/006 · `9586463b`

#### Goal & intent

run 세션이 light와 직렬 full을 같은 시작 ACQ와 같은 직접 실행 절차로 다루게 한다. light만의 차이는 승격 신호와 구버전 CLI 감지로 좁힌다.

수용 기준은 다음과 같다.
- `skills/bouncer-run` 아래 어느 문서에도 run 세션이 직접 구현하라는 light 지시(`payload.inline: true`이면 구현)가 없다.
- `light-run.md`가 승격 신호 → promote-stop 사유 표, 승격 절차, `inline`을 받으면 멈춤 규칙을 담는다.
- 기존 문서 계약 테스트가 모두 통과한다.

검증 명령은 `node scripts/verify-light-run-docs.js`다.

#### Current behavior

- `skills/bouncer-run/SKILL.md`
  - `## Role — delegation` 첫 문단은 light 원장이면 `payload.inline`으로 구현하고 coordinator를 쓰지 말라고 한다.
  - step 3 끝은 light면 `light-run.md`를 따르고 step 4를 건너뛰라고 한다.
  - 시작 ACQ의 D 설명은 "short, serial commit-task chain"이고, D는 full만 받는다는 전제다.
- `light-run.md`(93줄): 1 Implement(inline), 3 Review(직접 `{{RED_RUN}}` 작성), 5 Close, Risk stop(promote-stop 다섯 사유, `--promote-light`)으로 되어 있다.
- `direct-run.md` 첫 문단은 "short serial **full** drive"이고, handoff는 항상 coordinator다.
- `agent-dispatch.md:31-50` `## Lightweight and implement dispatch`는 light inline 구현과 그 한계를 서술한다. `:144`는 light inline 예외를 말한다.
- `drive-metrics.md`의 root-direct 절은 full 직접 실행만 가정한다.
- `docs/configuration.md`
  - `:23` `direct_max_commit_tasks`는 "직렬 full 드라이브"라고 적는다.
  - `:14` baseline "light 원장에는 적용하지 않는다"는 사실과 맞으므로 유지한다.
- `rules/cli.md:405-416`은 `light-requires-single-task`, integration `workerPath`, `payload.inline`, `light-review-required`를 서술한다. `:453-455`는 `direct_eligible`이 `full`이라고 적는다.
- 문서 계약 테스트:
  - `test/skill-bouncer-run.test.js:15`: ACQ 블록 두 개. D/A 권장, 선택지 `D,A,B,C`/`A,B,C`.
  - `test/skill-bouncer-run.test.js:184-245`: direct-run Handoff 표와 문장.
  - `test/subagents.test.js:667-700`: agent-dispatch의 fallback 문장 세 곳(`If named agents are unavailable`, `When named agents are unavailable`, `If the TOML is missing`).
  - `test/salvage-report-docs.test.js:22-43`
  - `test/doc-shape-cli.test.js:229-330`: agent-dispatch Intent bundle 제목, rules/cli.md 거절 표, drive-metrics.
  - `test/skill-bouncer-surface.test.js:161`: `light-run.md`·`direct-run.md` 존재.
- 재현: `npm run build && node --test test/skill-bouncer-surface.test.js test/skill-bouncer-run.test.js test/subagents.test.js test/salvage-report-docs.test.js test/doc-shape-cli.test.js && npm run lint:docs`.

#### Target behavior

- 성공:
  - SKILL.md:
    - light와 full이 같은 Role 설명을 쓴다. coordinator 경로이거나 D면 `direct-run.md`다.
    - step 3은 mode로 분기하지 않는다. light 원장이면 `light-run.md`의 정책 차이를 함께 적용한다는 한 문장만 둔다.
    - D 설명은 serial 사슬이 light든 full이든 쓸 수 있다고 적는다. ACQ 블록 두 개의 JSON은 그대로다.
  - `direct-run.md`: 대상을 "직렬 drive(full 또는 light)"로 쓴다. light 원장이면 `light-run.md`의 승격 표가 handoff보다 먼저 적용된다는 한 줄을 둔다.
  - `light-run.md`가 담는 것:
    - (a) mode light의 정책 차이: single/combined 루트 리뷰 1회(discovery 1회와 리뷰 원인 repair 1회. 이 BP에서 delta는 없다), commit 범위 `out-of-scope`, baseline 생략
    - (b) 승격 신호 → `promote-stop --reason` 표. 범위 밖 변경·`light-scope-revision-requires-promotion`은 `out-of-scope`, task 분할 필요는 `task-split`, Interface 의미 변경은 `interface-semantics`, 보안 위험은 `security-risk`, reviewer의 범위 확장 요구는 `reviewer-wider-scope`
    - (c) `--promote-light` 절차. worker 보존·patch·`promoted_from`
    - (d) 호환:
      - `light-ledger-legacy`를 받으면 멈추고 사용자에게 `next`를 보인다. worktree 폐기는 사용자가 명시적으로 승인한 뒤에만 한다.
      - `light-inline-removed`를 받으면 멈추고 plugin과 CLI 버전 불일치를 보고한다.
      - `light-implementer-record-missing`을 받으면 그 attempt를 accepted로 다시 보고하지 않는다. subagent implementer가 구현하지 않았으면 `rework`로 보고하고 named implementer를 dispatch한다. `worker-model`은 실제 dispatch한 implementer의 모델만 기록한다(002 Interface의 hint와 같다).
      - inline 멈춤 규칙은 정확히 이 영어 문장으로 쓴다: "If the `implement` payload carries an `inline` key, do not implement; stop and report a CLI version mismatch." 금지 문구 `payload.inline: true`를 쓰지 않는다.
  - `agent-dispatch.md`: `## Lightweight and implement dispatch`를 light도 named implementer를 쓴다는 짧은 절로 바꾼다. `:144`의 light inline 예외 문장을 지운다.
  - `drive-metrics.md`: root-direct 절이 light 직접 실행에도 같은 `metrics start --kind root-direct-session`을 쓴다고 적는다. 결과는 `measure-drive-records.js`의 `by_mode`로 나뉜다.
  - `docs/configuration.md:23`: "직렬 드라이브(full·light)"로 고친다.
  - `rules/cli.md`: 001~005의 동작으로 고친다. 대상은 자격·코드·worker 경로·legacy 거절·revise 거절·promote 기준·`direct_eligible`·`drive_record` 키다.
- 실패: 위 문서 계약 테스트 중 하나라도 깨지면 이 task는 완료가 아니다.
- 보존:
  - ACQ 블록 JSON, direct-run Handoff 표 6행과 그 문장
  - agent-dispatch의 세 fallback 문장. 그중 `If the TOML is missing` 문단의 "Or run `implementation` inline" 호스트 fallback은 light 분기가 아니므로 그대로 둔다.
  - drive-metrics 호스트 usage 표

#### Interface

- 제공: 위 문서 서술. 공개 CLI·설정 키는 바꾸지 않는다.
- 거부: 문서에 새 opt-in 문자열이나 새 설정 키를 만들지 않는다. light 원장에서 run 세션이 구현·리뷰·디버깅을 직접 하라는 서술은 남기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/SKILL.md` | `## Role — delegation` · step 2·3 | Modify | 실행 경로 분기 | light·full 공통 경로, D 설명 | skills/bouncer-run/SKILL.md:20-24; test/skill-bouncer-run.test.js:15 |
| `skills/bouncer-run/references/light-run.md` | 전체 | Modify | inline light 절차 | 정책 차이·승격 표·호환 규칙 | skills/bouncer-run/references/light-run.md:1-93; test/skill-bouncer-surface.test.js:161 |
| `skills/bouncer-run/references/direct-run.md` | 첫 문단 · Handoff 앞 | Modify | 직렬 full 직접 실행 | 대상 확장, light 승격 우선 한 줄 | skills/bouncer-run/references/direct-run.md:1-8; test/skill-bouncer-run.test.js:184-245 |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Lightweight and implement dispatch` | Modify | light inline 구현 서술 | named implementer 공통 | skills/bouncer-run/references/agent-dispatch.md:31-50; skills/bouncer-run/references/agent-dispatch.md:144; test/subagents.test.js:667-700 |
| `skills/bouncer-run/references/drive-metrics.md` | root-direct 절 | Modify | 직접 실행 세션 기록 | light 포함과 by_mode 집계 안내 | test/skill-bouncer-run.test.js:164-182; test/doc-shape-cli.test.js:329 |
| `docs/configuration.md` | `coordinator.direct_max_commit_tasks` 행 | Modify | 상한 설명 | 직렬 full·light | docs/configuration.md:23; docs/configuration.md:52 |
| `rules/cli.md` | light 원장·promote·direct_eligible 문단 | Modify | CLI 계약 서술 | 새 코드·경로·키 반영 | rules/cli.md:405-416; rules/cli.md:453-455; test/doc-shape-cli.test.js:260 |
| `test/skill-bouncer-surface.test.js` | run reference 사례 | Modify | reference 존재 고정 | run 문서 전체의 inline 구현 지시 부재, 승격 표 행, inline 멈춤 규칙, 호환 코드 단언 | test/skill-bouncer-surface.test.js:161 |
| `scripts/verify-light-run-docs.js` | `신규 추출 지점: task 전용 검증 래퍼` | Create | 없음 | 문서 계약 테스트 → 문서 lint → eslint → 이름 검사 | scripts/verify-drive-records.js 관례 |

#### Constraints

- 기존 테스트 단언은 바꾸지 않는다. `test/skill-bouncer-surface.test.js`에는 새 사례만 더한다.
- 문서가 적는 reason·키 이름은 001~005 구현과 정확히 같아야 한다. `rg -n "light-ledger-legacy|light-inline-removed|light-implementer-record-missing|light-requires-serial|light-scope-revision-requires-promotion" packages/cli/src`로 대조한다.
- `rules/planning.md` 항목 4와 `rules/subagent-model.md:124-127`은 `light-run.md`·`agent-dispatch.md`를 가리키는 포인터라 고치지 않아도 유효하다. 문구 정리는 후속 BP2의 몫이다.
- 사용자 대면 메시지 규칙(AGENTS.md hard rule 5)은 바꾸지 않는다. 문서 본문 언어는 각 파일의 기존 언어를 따른다.

### plugin-surface-slimming/light-direct-run-unification/007

#### Goal & intent

001~006이 모두 통합된 integration HEAD에서 `npm run ci`가 한 번 통과한다. 이로써 light와 full 실행 경로, 측정 스크립트, 문서 계약이 함께 깨지지 않음을 증명한다(blueprint 수용 기준 1~5의 종단 확인).

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.