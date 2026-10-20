---
type: bouncer.explain
title: repair-resume-integrity explain
description: Explain for repair-resume-integrity
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T08:29:10.783+09:00'
bouncer:
  id: EXPLAIN-repair-resume-integrity
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: published
  comprehension:
    - range_from: 9060dbfa897de3abf744e1fab07d81d7e77bf7e6
      range_to: e8d08390469b3510f0d2e8f1ffb227881371d8c3
      diff_sha: 31dd72ffe1401eb08d952ea84c2abd68b8cf736fdbe28d9584780c16b1ce2b59
      recorded_at: '2026-10-21T08:40:00+09:00'
  task_commits:
    - task: drive-execution/repair-resume-integrity/001
      sha: '34421637'
      intent_anchor: task-001
    - task: drive-execution/repair-resume-integrity/002
      sha: c40de9bd
      intent_anchor: task-002
    - task: drive-execution/repair-resume-integrity/003
      sha: e8d08390
      intent_anchor: task-003
    - task: drive-execution/repair-resume-integrity/004
      sha: 9ae260a4
      intent_anchor: task-004
---
# Explain

## Background

repair 중 resume(`coordinate repair --resume-task`)은 실패한 terminal 검증의 원인이 이미 통합된 task에 있을 때, 그 task만 다시 작업하게 하는 경로다. 이전 구현은 지정한 task의 하위 task까지 전부 `pending`으로 되돌려, 멀쩡히 통합된 작업을 다시 돌렸다. 같은 drive 안에서 세 가지 어긋남이 더 있었다.

- rework 재시도가 같은 기준(HEAD·porcelain)에서 끝나면 `next`가 보고서가 있는데도 implement를 반복했다.
- 승인된 scope에 `.bouncer/epics.json` 같은 경로가 있으면 scope 개정이 그 경로 때문에 매번 거절됐다.
- integration 직접 수정 거절 안내가 "worker task로 옮겨라"만 말해, 거버넌스 변경(epic 이관)을 어디서 커밋해야 하는지 알려주지 못했다.

## Code

- `scripts/src/lib/coordinator-commands.ts`: `resolveTerminalFailure`가 resume 대상(`target`)과 downstream verification task만 `pending`으로 되돌린다. 통합된 하위 commit task는 lease·sha·status를 유지한다. `failure-evidence-mismatch` 판정은 전체 downstream 폐포(`downstreamTasks`)를 그대로 쓴다. `integration-source-mutated` 안내(`COORDINATE_FAILURE_HINTS`)는 거버넌스 변경을 main에서 먼저 커밋하라고 안내한다.
- `scripts/src/lib/coordinate-next.ts`: `currentAttemptReportExists`가 현재 attempt의 보고 파일이 있고 비어 있지 않으며 `attempt:` 줄이 일치할 때만 참이다. `taskNext`는 이 값이 참이면 기준이 같아도 implement로 돌려보내지 않는다. 읽기 오류는 "보고 없음"으로 접어 implement에 남기는 보수적 선택이며, 이 판정은 읽기 전용이다.
- `scripts/src/lib/scope.ts`: `outOfBoundsScopePaths(entries, approved)`는 직전 승인 scope와 정규화 후 정확히 같은 항목만 면제한다(`./`·뒤 `/` 제거). 하위 경로나 새 `.bouncer/`·`.git/` 경로는 열지 않는다. 검사는 lock 안으로 옮겨, 거절 시 원장·task 문서 바이트가 바뀌지 않는다.
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`: 거버넌스 변경은 drive 전에 main에서 커밋한다는 문장을 추가했다.
- 테스트: `test/cli-coordinate.test.js`, `test/coordinator-e2e.test.js`, `test/coordinator.test.js`, `test/coordinate-next.test.js`, `test/current.test.js`.

설계 선택과 한계: resume은 task 수·ID·DAG·scope 불변이라는 계약을 유지한다. 보고 판정은 파일 전체에서 `^attempt:` 첫 줄을 보며, 읽기 오류의 종류는 구분하지 않는다. scope 면제는 정확 일치로만 제한했다.

## Quiz

1. 통합된 task 002의 코드가 원인이라 `coordinate repair --task <terminal> --resume-task 002`를 실행했다. 002 아래에 통합된 commit task 004와 downstream verification task 005가 있다면 이후 상태는?
   - A) 004와 005 모두 `pending`
   - B) 004는 `integrated`로 유지, 005는 `pending`
   - C) 004는 `pending`, 005는 `integrated`로 유지
2. 승인된 scope에 `.bouncer/epics.json`이 들어 있는 task가 `coordinate scope`로 경로를 하나 추가하려 한다. 새 scope에도 `.bouncer/epics.json`이 그대로 있고, 새로 `.bouncer/runtime/x.json`을 추가했다면?
   - A) 둘 다 승인되어 개정이 성공한다
   - B) `.bouncer/epics.json`은 유지되지만 `.bouncer/runtime/x.json` 때문에 `scope-path-out-of-bounds`로 거절된다
   - C) 두 경로 모두 `.bouncer/` 아래라 항상 거절된다
3. rework 재시도 중 worker HEAD와 porcelain이 dispatch 기준과 같다. 현재 attempt의 보고 파일이 있으면 `next`는 어떻게 판정하나?
   - A) 기준이 같으므로 implement를 다시 지시한다
   - B) 보고 파일이 있으면 구현이 끝난 것으로 보고 다음 판정(verify 등)으로 내려간다
   - C) 보고 파일을 지우고 처음부터 다시 dispatch한다

## Tasks

### drive-execution/repair-resume-integrity/001 · `34421637`

#### Goal & intent

`coordinate repair --resume-task <id>`가 지정 task만 재배정하고 이미 `integrated`인 하위 commit task를 그대로 두게 한다. resume한 task가 재통합되면 terminal verification만 다시 열린다. 수용 기준은 blueprint Contract 1·2이고 검증 명령은 `node --test test/cli-coordinate.test.js test/coordinator-e2e.test.js test/coordinator.test.js`다.

#### Current behavior

- 결정: `resolveTerminalFailure`(`scripts/src/lib/coordinator-commands.ts:966-1111`)가 `downstreamTasks`(`:1119-1133`, `depends_on` 전이 폐포, terminal 포함)로 `resetDownstream`을 구하고(`:1059`), `resetTasks = [target, ...비verification downstream]`(`:1071`) 각각을 `salvageRevokedWorker`로 salvage한다(`:1072-1085`). 결정 기록 `reset_downstream`은 downstream 전체 id다(`:1101`).
- 적용: `repair` 명령 분기(`:4479-4502`)가 `writeResumeDocuments`(`:1146`)에 downstream 전체를 넘겨 문서 status를 되돌리고, target과 비verification downstream마다 `revokeLease`·`resumed = true`·`dependency_gate = 'integrated'`를 쓴 뒤 downstream 전체와 terminal을 `status = 'pending'`으로 만든다. 원장 쓰기는 `commitWrite()`(`:4517`).
- I/O 관찰 지점: 원장 파일 쓰기 `:4517`, 증적 문서 쓰기 `writeResumeDocuments` `:1146`, salvage git 호출 `salvageRevokedWorker` `:2358`.
- 재현: epic 114·119 drive에서 `reset_downstream: [002..007]`, completed 3→0. 기존 테스트 `test/cli-coordinate.test.js:1416-1434`와 `test/coordinator-e2e.test.js:1600-1640`은 target+terminal 2-task fixture라 중간 downstream task를 덮지 않는다.
- ready 재계산: `readyWaveGated`(`:914-922`)가 `resumed` task가 미통합인 동안 pending verification을 숨긴다.

#### Target behavior

- 성공: target만 salvage·lease 회수·`resumed`·`dependency_gate` 갱신·`pending` 전이한다. downstream 중 `execution_kind: verification` task만 `pending`으로 되돌리고 문서도 그 task만 되돌린다. downstream commit task는 `status`·`sha`·`lease`를 바꾸지 않는다. 출력·결정의 `reset_downstream`은 되돌린 verification id 목록이다.
- 실패: 대상 검증(`resume-task-invalid`, `task-outside-blueprint`, `repair-scope-out-of-bounds`, `repair-wave-limit`, `failure-evidence-mismatch`)은 지금 그대로다. terminal이 target의 downstream이 아니면 지금처럼 `failure-evidence-mismatch`다.
- 보존: 2-task fixture 결과(`[['001','pending'],['002','pending']]`, `reset_downstream: ['002']`, `owner_generation: 2`)는 그대로다. salvage 결정 기록 형식도 같다.

#### Interface

- 제공: `coordinate repair --resume-task` 성공 JSON의 `reset_downstream: string[]` = 상태를 되돌린 downstream verification task id. 원장 결정 `RepairDecision.reset_downstream`도 같은 값.
- 거부: 위 거절 사유는 바뀌지 않는다. 새 거절 사유를 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `resolveTerminalFailure`, `writeResumeDocuments`, `repair` 적용 분기 | Modify | downstream 전체를 salvage·revoke·pending으로 되돌림 | target과 downstream verification만 되돌리고 `reset_downstream`을 그 id로 기록 | 상태 변경 진입점(`:1059-1101`, `:4479-4502`) |
| `test/cli-coordinate.test.js` | `terminalFailedCliDrive` 계열 resume 테스트 | Modify | 2-task fixture만 단언 | 001 → 002 → terminal 3-task fixture로 002 유지 단언 추가 | 회귀 검증 지점(`:1416-1434`) |
| `test/coordinator-e2e.test.js` | resume e2e 흐름 | Modify | 2-task로 재작업 후 terminal 통합 확인 | 중간 integrated task가 재실행되지 않고 terminal만 ready가 되는지 단언 | 기대 동작 2 검증(`:1600-1640`) |

#### Constraints

- resume 계약(task 수·ID·DAG·scope 불변)을 유지한다. `depends_on` edge를 고치지 않는다.
- 원장 쓰기 실패 시 `rollbackDocuments`로 문서 바이트를 되돌리는 규칙을 유지한다.
- `failure-evidence-mismatch` 판정에는 downstream 계산(`downstreamTasks`)을 계속 쓴다.

### drive-execution/repair-resume-integrity/002 · `c40de9bd`

#### Goal & intent

`coordinate next`(그리고 같은 판정을 쓰는 `advance`)가 현재 attempt의 implementer 보고 파일이 이미 있으면 `implement`를 다시 돌려주지 않게 한다. 수용 기준은 blueprint Contract 3이고 검증 명령은 `node --test test/coordinate-next.test.js`다.

#### Current behavior

- `taskNext`(`scripts/src/lib/coordinate-next.ts:805` 시작)의 active dispatch 분기는 `workerHead === item.dispatch.base_head && porcelainText === item.dispatch.initial_worktree_state`면 보고 파일 존재와 관계없이 `implement`를 반환한다(`:899-918`).
- 기준값은 `dispatch` 명령이 attempt마다 다시 잡는다(`scripts/src/lib/coordinator-commands.ts:4783-4797`). porcelain은 dirty 경로 목록이라 내용 변화를 보지 못한다. attempt 1에서 모든 경로가 이미 dirty였으면 attempt 2 구현 뒤에도 기준과 같다.
- 보고 파일 경로는 `coordinator.reportPathFor(workerPath, task, attempt)`(`coordinator-commands.ts:209-211`, `.bouncer/runtime/reports/<task>-<attempt>.md`, gitignore)이고 `next`도 같은 경로를 payload에 싣는다(`coordinate-next.ts:912`). 보고 본문 `## Brief revision`에는 `attempt: <n>` 줄이 있다(`coordinator-commands.ts:226-240` `parseReportFile`, 비공개).
- I/O 관찰 지점: git 읽기 `coordinate-next.ts:899-900`. 보고 파일 읽기는 아직 없다.
- 재현: epic 114 drive TASKS-002 attempt 2에서 관찰. 기존 테스트 `test/coordinate-next.test.js:1264-1291`은 attempt 2 `implement`를 단언하지만 보고 파일을 쓰지 않는다.

#### Target behavior

- 성공: active dispatch에서 `reportPathFor(item.workerPath || cwd, task, attempt)` 파일이 존재하고 비어 있지 않으며 본문에 `attempt: <현재 attempt>` 줄이 있으면, 기준 동일 여부와 관계없이 `implement` 분기를 건너뛰고 아래 기존 판정(`verify`→`review`→`commit`→`report`)으로 내려간다.
- 실패/보존: 파일이 없거나, 비었거나, 읽기 오류가 나거나, `attempt:` 값이 다르면 지금처럼 `implement`를 반환한다. 보고 파일이 없는 첫 implement 응답(payload에 `report` 키 없음, `:1296-1310`)과 rework 뒤 `implement` payload(`:1264-1291`)는 그대로다.

#### Interface

- 제공: `next` 결과 `action`이 위 조건에서 `implement`가 아닌 기존 다음 단계가 된다. 새 action·필드는 없다.
- 거부: 새 거절 사유 없음. 판정 실패는 `implement`로 접는다(보수적 fallback).
- 신규 추출 지점: 현재 attempt 보고 존재 판정 — `coordinate-next.ts` 안 지역 함수. `parseReportFile`·`observeReport`가 비공개이고 `coordinator-commands.ts`는 TASKS-001·004가 고치므로, `/^attempt:\s*(\d+)\s*$/m` 한 줄 판정을 이 모듈에 둔다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | `taskNext` implement 분기, 신규 추출 지점: 현재 attempt 보고 판정 | Modify | 기준 동일이면 무조건 implement | 현재 attempt 보고가 있으면 implement를 건너뜀 | 판정 진입점(`:899-918`), advance도 같은 `decideNext` 사용 |
| `test/coordinate-next.test.js` | rework·implement 테스트 | Modify | 보고 없는 attempt 2 implement만 단언 | 보고 파일을 쓴 attempt 2에서 `implement`가 아님, attempt 불일치 보고는 `implement` 단언 | 검증 지점(`:1264-1310`) |

#### Constraints

- `next`는 쓰기 없는 판정이다. 보고 파일은 읽기만 한다(기존 `assertNoWrite` 단언 유지).
- light/inline 모드도 같은 경로 계산(`item.workerPath || cwd`)을 쓴다.

### drive-execution/repair-resume-integrity/003 · `e8d08390`

#### Goal & intent

`coordinate revise`가 직전 승인 scope에 이미 있던 경로를 bounds 검사에서 면제해, `.bouncer/epics.json`처럼 plan에서 승인된 경로를 가진 task도 scope를 개정할 수 있게 한다. 수용 기준은 blueprint Contract 4이고 검증 명령은 `node --test test/current.test.js`다.

#### Current behavior

- `reviseTaskScope`(`scripts/src/lib/scope.ts:762`)는 lock 전에 `outOfBoundsScopePaths(next)`(`:452-460`: 빈 값·트리 전체·절대·`~`·`..`·`.bouncer`·`.git`)로 거절한다(`:782-785`). 이 시점에는 원장·문서를 읽지 않아 승인 scope를 모른다.
- 승인 scope는 lock 안에서 `previous = entry.scope ? entry.scope.paths : declared`(`:811`, declared = task 문서 `affected_paths`)로 읽는다. 추적 검사 `trackedScopeViolations`(`:816-827`)도 쓰기 전에 거절한다.
- plan gate G5는 `affected_paths` 비어 있음만 보므로 `.bouncer/epics.json`을 승인할 수 있다.
- 기존 테스트: `test/cli-coordinate.test.js:472`(새 `.bouncer/context/` 경로 거절), `test/current.test.js:1243-1284`(revise 직접 호출). 승인 경로 유지 사례는 없다.

#### Target behavior

- 성공: `next` 중 정규화 값(앞 `./` 제거, 뒤 `/` 제거, POSIX 구분자)이 `previous`의 정규화 값과 정확히 같은 경로는 bounds 검사에서 면제한다. 예: 승인 `['.bouncer/epics.json', 'src/a.js']` → revise `['.bouncer/epics.json', 'src/a.js', 'src/b.js']` 성공.
- 실패: 면제되지 않은 경로가 `outOfBoundsScopePaths`에 걸리면 `scope-path-out-of-bounds`와 그 `paths`로 거절하고 원장·문서 바이트를 바꾸지 않는다. 승인 경로의 하위 경로(`.bouncer/context/x` 아래 등)와 새 `.bouncer/`·`.git/` 경로는 면제하지 않는다.
- 판정 순서: 옮긴 bounds 검사는 lock 안에서 `previous` 계산 직후, `trackedScopeViolations`보다 앞에서 실행한다. 그래서 새 범위 밖 경로는 `scope-path-untracked`가 아니라 `scope-path-out-of-bounds`로 거절된다.
- 보존: glob 거절(`scope-path-glob`)과 빈 집합 거절은 lock 전 그대로. `test/cli-coordinate.test.js:472` 결과도 같다.

#### Interface

- 제공: `reviseTaskScope` 성공 조건 확장(직전 승인 경로 정확 일치 면제). 반환 모양은 같다.
- 거부: `scope-path-out-of-bounds` — 면제되지 않은 범위 밖 경로. 판정 위치가 lock 안(쓰기 전)으로 옮겨진다.
- 용어: "직전 승인 scope" = `entry.scope.paths`, 없으면 task 문서 `affected_paths`. 예: `['.bouncer/epics.json']`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scope.ts` | `reviseTaskScope`, `outOfBoundsScopePaths` 주석 | Modify | lock 전 범위 밖 경로 일괄 거절 | lock 안에서 직전 승인 경로를 뺀 나머지만 거절, 주석·JSDoc 갱신 | 상태 변경 진입점(`:438-460`, `:752`, `:782-811`) |
| `test/current.test.js` | revise 직접 호출 테스트 | Modify | 승인 경로 유지 사례 없음 | 승인 `.bouncer/epics.json` 유지 성공·새 `.bouncer/` 경로 거절·하위 경로 거절 단언 추가 | 검증 지점(`:1243-1284`) |

#### Constraints

- 거절된 revise는 원장·task 문서 바이트를 바꾸지 않는다.
- 면제는 정확 일치만 허용한다. `isUnder` 접두 비교로 넓히지 않는다.

### drive-execution/repair-resume-integrity/004 · `9ae260a4`

#### Goal & intent

guard는 그대로 두고 `integration-source-mutated`의 `cause`/`next`와 coordinator 문서가 "governance 변경은 drive 전에 main에 커밋하고, drive 중에는 worker task나 `bouncer coordinate repair`로 옮기며, integration checkout을 직접 고치지 않는다"를 말하게 한다. 수용 기준은 blueprint Contract 5이고 검증 명령은 `node --test test/coordinator.test.js test/agents.test.js`다.

#### Current behavior

- guard: `disallowedDirtyPaths`(`scripts/src/lib/coordinator-commands.ts:3378`)가 seed manifest와 integrated/dynamic task 증적 밖 dirty 경로를 찾으면 integrate가 `integration-source-mutated`로 거절한다(`:3638-3639`).
- 힌트: `COORDINATE_FAILURE_HINTS['integration-source-mutated']`(`:5398-5403`) `next`는 "Move the change into a worker task or `bouncer coordinate repair`, revert the direct edits ..."이고 governance·main 선커밋을 말하지 않는다.
- 문서: `agents/bouncer-coordinator.md:144-148`은 "revert them and move the change to a worker task"만 적는다. 이 문서는 `.codex/agents/bouncer-coordinator.toml`과 바이트 일치해야 한다(`test/agents.test.js:44-58`).
- 테스트: `test/coordinator.test.js:222-229`(모든 reason에 힌트), `:214-215`(`cause !== reason`). 힌트 문구 단언은 없다.

#### Target behavior

- 성공: 힌트 `cause`는 integration checkout의 미커밋 변경이 seed·증적 밖이라는 사실과 root/coordinator 직접 수정이 원인임을 말한다. `next`는 (1) drive 전 governance 변경(epic 이관, `.bouncer/epics.json`)은 main에 커밋하고 drive를 다시 준비, (2) drive 중 소스 변경은 worker task 또는 `bouncer coordinate repair`, (3) 직접 수정은 되돌린 뒤 integrate 재시도를 담는다.
- 보존: guard 동작·허용 경로·거절 사유 문자열은 그대로다. coordinator 문서 제목 골격(`scripts/check-doc-shape.js:784-789`)과 Worker dispatch 20줄 상한은 그대로다.

#### Interface

- 제공: `withCoordinateFailureHints({ok:false, reason:'integration-source-mutated'})`의 `next`에 `main`과 ```bouncer coordinate repair```가 들어간다.
- 거부: guard 완화 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `COORDINATE_FAILURE_HINTS['integration-source-mutated']` | Modify | worker task·repair만 안내 | main 선커밋 안내 추가 | 사용자 노출 문구(`:5398-5403`) |
| `agents/bouncer-coordinator.md` | Procedure의 integrate 거절 문단 | Modify | revert 후 worker task로 옮기라고만 함 | governance 변경 main 선커밋 문장 추가 | 역할 문서(`:144-148`) |
| `.codex/agents/bouncer-coordinator.toml` | 생성 산출물 | Modify | md와 바이트 일치 | md 변경 후 `mdToCodexToml`로 재생성 | `test/agents.test.js:44-58` |
| `test/coordinator.test.js` | 힌트 단언 | Modify | 힌트 존재만 단언 | `next`에 `main`과 `bouncer coordinate repair` 포함 단언 추가 | 검증 지점(`:214-229`) |

#### Constraints

- `disallowedDirtyPaths`와 integrate guard 로직은 바꾸지 않는다.
- `.codex/agents/bouncer-coordinator.toml`은 손으로 쓰지 않고 생성 함수로 만든다.

### drive-execution/repair-resume-integrity/005

#### Goal & intent

TASKS-001~004가 모두 통합된 integration HEAD에서 `npm run ci`가 통과함을 증명한다. 수용 기준은 blueprint Contract 1~5 전체다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.