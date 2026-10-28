---
type: bouncer.explain
title: untrailered-worker-commit explain
description: Explain for untrailered-worker-commit
resource: .bouncer/context/epics/drive-execution/blueprints/untrailered-worker-commit/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-28T14:54:08.017+09:00'
bouncer:
  id: EXPLAIN-untrailered-worker-commit
  epic_id: drive-execution
  blueprint_id: untrailered-worker-commit
  status: published
  comprehension:
    - range_from: 1f3d391428144da517f0f1ca9cfbec278dc9a123
      range_to: 1ccb5ce809cf673a4222a049b1cfd45bc8858b66
      diff_sha: 16ca50e184b5974d00044e84782b12a50d36ee39412527a022db8ea1f505f165
      recorded_at: '2026-10-28T14:56:55.267+09:00'
  task_commits:
    - task: drive-execution/untrailered-worker-commit/001
      sha: 6ee51315
      intent_anchor: task-001
    - task: drive-execution/untrailered-worker-commit/002
      sha: 1ccb5ce8
      intent_anchor: task-002
    - task: drive-execution/untrailered-worker-commit/003
      sha: 62a6f842
      intent_anchor: task-003
---
# Explain

## Background

worker가 `Bouncer-Task` 트레일러 없이 직접 `git commit`을 하면 `bouncer commit`이 `commit_sha` stamp를 쓰지 못한다. `bouncer commit`은 빈 커밋을 만들지 않기 때문이다. 그런데 `coordinate next`는 stamp가 비어 있으면 무조건 `commit`을 안내했다. `coordinate advance`가 같은 행동을 `max-steps`까지 반복하며 멈추는 일이 생겼다.

이제 `next`는 이 상태를 `blocked`(`worker-commit-untrailered`)로 판정하고, 새 명령 `coordinate uncommit`으로 그 커밋을 되돌린 뒤 `bouncer commit`이 트레일러 커밋을 다시 만들게 한다. 정상 경로의 `commit`·`report` 판정과 report·record 거절 규칙은 그대로다.

## Code

- `packages/cli/src/coordinator-worker.ts`
  - `expectedTaskRef`는 task frontmatter에서 기대하는 `Bouncer-Task` ref를 만든다. 트레일러 값과 같은 `buildStableProvenance`를 쓴다. 식별자가 없는 옛 문서는 `null`이고, 이때는 트레일러 줄 유무만 본다.
  - `untraileredWorkerCommits`는 `integrationHead..HEAD`의 first-parent 커밋 중 트레일러가 없거나 ref가 다른 것을 오래된 순으로 돌려준다. `next`와 `uncommit`이 함께 쓰는 단일 판별 함수다. `integrationHead`가 없으면 `[]`다.
  - worker가 남긴 선택: `git log -z`와 `%H%x00%B`로 본문 줄바꿈과 커밋 경계가 섞이지 않게 했다.
- `packages/cli/src/coordinate-next.ts`: stamp가 비어 있고 무트레일러 커밋이 있으면 `commit` 대신 `blocked`와 uncommit 안내를 낸다. 안내 명령에는 ledger fence가 들어가고 lease 인자는 없다.
  - 한계: 안내 명령을 따옴표 없이 `join(' ')`로 만들어, 경로에 공백이 있으면 그대로 복사해 실행할 수 없다.
- `packages/cli/src/coordinator-commands.ts`
  - `coordinateUncommit`은 가장 오래된 무트레일러 커밋의 first parent로 `reset --soft`해서 변경을 staged로 남긴다. 그 위에 쌓인 커밋도 함께 되돌린다.
  - 거절은 Git·원장을 바꾸기 전에 끝난다. 활성 dispatch가 아니거나 이미 stamp가 있으면 `illegal-transition`, 되돌릴 커밋이 없으면 `uncommit-not-needed`다.
  - 원장 쓰기가 실패하면 `fromHead`로 복원한다. 복원마저 실패하면 `uncommit-rollback-failed`와 `fromHead`·`toHead`를 돌려준다.
  - `LEDGER_FENCED_COMMANDS`에는 넣지만 `LEASE_CHECKED_COMMANDS`에는 넣지 않는다. worker 할당·cwd 검사는 `guardWorkerDispatch`를 재사용한다.
  - 결정은 `kind: 'uncommit'`으로 원장에 남고 `drive-metrics`의 `EXCEPTION_KINDS`가 예외로 센다.
- 문서: `rules/cli.md`, `agents/bouncer-coordinator.md`, `references/coordinator-cards/blocked.md`와 생성기로 만든 `.codex/agents/bouncer-coordinator.toml`에 복구 절차를 영어로 적었다.

## Quiz

아래 퀴즈를 사용자에게 한 번에 제시하고 응답을 받는다. 정답과 응답은 이 문서에 쓰지 않는다.

1. worker HEAD에 `Bouncer-Task` 트레일러가 없는 커밋이 있고 stamp가 비어 있을 때 `coordinate next`는 무엇을 하나?
   - A) `commit`을 안내한다
   - B) `blocked`(`worker-commit-untrailered`)와 uncommit 안내를 낸다
   - C) `report`를 안내한다
2. `coordinate uncommit`이 무트레일러 커밋을 되돌리는 방식은?
   - A) `reset --hard`로 변경까지 버린다
   - B) `revert` 커밋을 추가한다
   - C) `reset --soft`로 변경을 staged로 남긴다
3. 이미 `commit_sha` stamp가 있는 task에 `coordinate uncommit`을 실행하면?
   - A) `illegal-transition`으로 거절한다
   - B) 마지막 커밋을 되돌린다
   - C) `uncommit-not-needed`를 돌려준다

## Tasks

### drive-execution/untrailered-worker-commit/001 · `6ee51315`

#### Goal & intent

`coordinate next --task`가 stamp(`commit_sha`)가 빈 task에서 worker의 무트레일러 커밋을 감지하면 `commit` 대신 `blocked`/`worker-commit-untrailered`를 낸다. 이렇게 해서 `advance`의 `max-steps` 반복(#285·#287 재현)을 끊는다. 판별 함수는 TASKS-002의 `coordinate uncommit`도 함께 쓴다. 수용 기준은 아래 Checklist의 새 테스트 5개 통과와 기존 `test/coordinate-next.test.js` 단언 유지이고, 검증 명령은 `node --test test/coordinate-next.test.js`다.

#### Current behavior

- `packages/cli/src/coordinate-next.ts:1050-1055`: verify·review가 끝난 prepared task에서 `tasks.md`의 `commit_sha`가 비어 있으면 무조건 `{ action: 'commit', argv: ['bouncer','commit','--blueprint',bp,'--yes'] }`를 낸다.
- worker가 `git commit`을 직접 하면 scope 변경은 이미 커밋돼 있다. `bouncer commit`은 빈 커밋 금지 규칙(`packages/cli/src/commit.ts:500-505`)에 따라 `committed:false`로 끝나고 stamp를 쓰지 않는다. 그래서 next는 다시 `commit`을 내고, `advance`는 `max-steps`까지 같은 행동을 반복한다.
- `packages/cli/src/coordinator-worker.ts:345-381` `workerCommitEvidence`는 `integrationHead`와 HEAD의 조상 관계(`git merge-base --is-ancestor`, :365)와 stamp만 본다. 트레일러는 보지 않는다.
- 트레일러 형식은 `Bouncer-Task: <ref>`이고(`packages/cli/src/commit-sha.ts:112-114`), 같은 키 정규식은 `packages/cli/src/task-commits.ts:14` `TRAILER_RE`에 있다.
- I/O 관찰 지점: git 호출은 모두 `packages/cli/src/coordinator-git.ts:12` `git(exec, cwd, args)`를 거친다. next는 원장을 쓰지 않는다(테스트는 `assertNoWrite`로 확인).
- 재현: `test/coordinate-next.test.js:168-175` `commitInWorker`가 트레일러 없이 `git commit -m`을 한다. `:915-931` "commit_sha 없음 → commit" 테스트가 바로 그 상태(트레일러 없는 worker 커밋 + 빈 stamp)에서 `commit`을 기대한다. 같은 helper를 `:1125-1131` `simulateWorker`의 implement 단계와 `:1522-1528`도 쓴다.

#### Target behavior

- 성공(차단): stamp가 비어 있고 판별 함수가 1개 이상의 SHA를 돌려주면 next는 `{ scope: 'task', action: 'blocked', reason: 'worker-commit-untrailered', cwd, cause, next, card }`를 낸다. 이때 scope dirty 경로가 있어도 같은 blocked를 낸다.
- 보존: stamp가 비어 있고 무트레일러 커밋이 없으면(worker 미커밋, 또는 모든 커밋에 `Bouncer-Task` 트레일러 있음) 기존 `commit`을 낸다. stamp가 있는 분기(`report`, `worker-commit-stamp-mismatch`, `commit-evidence-mismatch`)와 그 앞 분기(dispatch·implement·verify·review)는 바뀌지 않는다.
- 보존: `ledger.integrationHead`가 문자열이 아니면 판별 함수는 `[]`를 돌려주고, next는 기존 동작을 유지한다.
- `NEXT_FAILURE_HINTS['worker-commit-untrailered']`:
  - cause: worker HEAD에 `Bouncer-Task` 트레일러가 없는 커밋이 있어 `bouncer commit`으로는 stamp를 쓸 수 없다는 사실.
  - next: `bouncer coordinate uncommit --blueprint <dir> --task <ddd>`(fence 포함)를 실행한 뒤 `coordinate advance`로 `commit`을 다시 돌리라는 안내. `commit`을 그냥 재실행하지 말라는 말도 넣는다.

#### Interface

- 제공:
  - `expectedTaskRef(block: Record<string, unknown> | null): string | null`
    - `coordinator-worker.ts`에서 export한다.
    - task frontmatter bouncer 블록의 `epic_id`·`blueprint_id`·`id`로 `buildStableProvenance(...).task`(`packages/cli/src/commit-sha.ts:99-117`)를 만든다. 블록이 없거나 `buildStableProvenance`가 throw하면 `null`을 돌려준다.
    - 예: `{ epic_id: 'drive-execution', blueprint_id: 'untrailered-worker-commit', id: 'TASKS-001' }` → `'drive-execution/untrailered-worker-commit/001'` 형식의 값.
  - `untraileredWorkerCommits(exec: Exec, workerPath: string, ledger: { integrationHead?: unknown }, taskRef: string | null): string[]`
    - `coordinator-worker.ts`에서 export한다.
    - `git log --first-parent --reverse --format=%H%x00%B <integrationHead>..HEAD`를 읽는다. 무트레일러 커밋의 40자 SHA를 오래된 순서로 돌려준다.
    - 무트레일러 커밋의 기준: `taskRef`가 문자열이면 값이 정확히 `taskRef`인 `Bouncer-Task:` 줄(줄 앞 키, `^Bouncer-Task\s*:\s*(.*?)\s*$`)이 없는 커밋이다. `taskRef`가 `null`이면 `Bouncer-Task:` 줄이 아예 없는 커밋이다. merge 커밋도 같은 기준으로 판정한다.
    - 예: worker가 `feat: a`(트레일러 없음)를 하나 커밋했다면 `['<sha40>']`. `Bouncer-Task: other/bp/999`만 있는 커밋도 `taskRef`가 다르면 포함된다.
  - next blocked reason `worker-commit-untrailered`와 그 hint. next는 이미 읽은 `tasksBlock`으로 `expectedTaskRef`를 만들어 넘긴다.
- 거부:
  - 즉시 throw: git 호출이 실패하면(object 없음 등) 오류를 그대로 올린다. 추측한 빈 목록으로 바꾸지 않는다. next의 다른 `git(exec, …)` 호출이 실패할 때와 같은 동작이다.
  - 빈 목록 반환(판별 생략): `integrationHead`가 원장에 없을 때.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-worker.ts` | `신규 추출 지점: 무트레일러 커밋 판별`, `신규 추출 지점: task 기대 ref`, `export =` | Modify | worker 커밋 증거 판정(읽기 전용) | `untraileredWorkerCommits`·`expectedTaskRef` 추가와 export(`commit-sha.ts`의 `buildStableProvenance` import) | `coordinator-worker.ts:345-381` 같은 성격의 읽기 전용 판정이 있고, `:390-396` export 블록에 추가한다. TASKS-002가 재사용한다 |
| `packages/cli/src/coordinate-next.ts` | `taskNext` 내부 stamp 빈 분기, `NEXT_FAILURE_HINTS` | Modify | stamp가 비면 무조건 commit | 판별이 비어 있지 않으면 blocked, hint 추가 | `coordinate-next.ts:1050-1055`, `:94-147` |
| `test/coordinate-next.test.js` | `commitInWorker`, hint 키 목록 테스트, 신규 테스트 3개 | Modify | next 판정 테스트 | helper가 트레일러를 붙이게 하고 무트레일러 fixture·테스트 추가 | `:168-175` helper, `:252-264` NEXT_FAILURE_HINTS 키 단언, `:915-931`·`:1125-1131`·`:1522-1528`이 helper를 쓴다 |

#### Constraints

- `workerCommitEvidence`의 검사 순서와 reason은 바꾸지 않는다(report·record 거절 규칙은 Out of scope).
- 기존 단언 변경 범위:
  - `test/coordinate-next.test.js`의 `commitInWorker`는 `git commit`에 두 번째 `-m 'Bouncer-Task: fixture'`만 추가한다. 이 helper를 쓰는 기존 테스트의 단언 값은 바꾸지 않는다.
  - `:252-264` "new next reasons를 NEXT_FAILURE_HINTS와 대조함" 테스트의 `keys` 배열에는 `'worker-commit-untrailered'`만 추가한다.
  - 그 밖의 기존 테스트 이름·단언은 수정하지 않는다.
- 새 테스트 이름은 `<subject> → <expectation>` 형식이다(`npm run lint:test-names`). 새 테스트 파일은 만들지 않는다(`test/tiers.json` 변경 불필요).
- ts·js 줄은 120자 이내다. 판별 함수는 next와 TASKS-002가 함께 쓰는 단일 정본이므로 next 안에 정규식을 복제하지 않는다.

### drive-execution/untrailered-worker-commit/002 · `1ccb5ce8`

#### Goal & intent

TASKS-001이 `worker-commit-untrailered`를 낸 뒤 coordinator는 fenced 명령 `bouncer coordinate uncommit`을 실행한다. 이 명령은 worker HEAD를 가장 오래된 무트레일러 커밋의 부모로 soft reset하고, 원장에 `uncommit` decision을 남긴다. 그 뒤 `coordinate next`는 다시 `commit`을 내고 `bouncer commit`이 트레일러 커밋을 만든다. 수용 기준은 Checklist의 성공·거절 테스트 통과이고, 검증 명령은 `node --test test/coordinator.test.js test/cli-coordinate.test.js test/cli-help.test.js`다.

#### Current behavior

- 명령 목록:
  - core: `packages/cli/src/coordinator-commands.ts:72-74` `COMMANDS`, task 단위 handler는 `:1240-1246` `TASK_HANDLERS`.
  - CLI: `packages/cli/src/cli-git-commands.ts:447-450` `COORDINATE_COMMANDS`, fenced 목록은 `:570-573` `checkFenceFlags`, 필수 플래그 검사는 `:699-702`(revoke 예).
  - usage: `packages/cli/src/cli-usage.ts:17` coordinate 요약, `:49` revoke 명령별 usage.
- 디스패치 흐름(`coordinator-commands.ts:1320-1357`): `openLedgerFenced`로 path/hash fence를 검사하고 lock을 잡는다. 이어서 task 조회, `LEASE_CHECKED_COMMANDS`, `guardWorkerDispatch`(dispatch·report만, `:1351`), `TASK_HANDLERS` 순서로 진행한다. 원장 쓰기는 `commitWrite()`(lock 상실이면 결과 객체 반환)이고, 응답은 `withCheckpoint`로 만든다.
- worker 할당 검사: `guardWorkerDispatch`(`:941-964`)는 light면 `lightWorkerAssigned` + integration cwd를, full이면 `coordinatorPathsFor`/`registeredWorker` + `ensureIntegrationCwd(..., task)`를 검사하고, 상태가 `prepared`가 아니면 `illegal-transition`을 낸다.
- git과 원장을 함께 다루는 가장 가까운 선례는 `coordinateRerecord`(`:1180-1205`)다. decision 타입은 `:89-148`에 지역 union으로 있다(`RerecordDecision` `:137-140`).
- 실패 힌트 `COORDINATE_FAILURE_HINTS`(`:1365`~)에는 `illegal-transition`이 이미 있다(`:1443`). `test/coordinator.test.js:221-225`가 소스의 reason 리터럴이 모두 이 표에 있는지 검사한다.
- `packages/cli/src/drive-metrics.ts:28-31` `EXCEPTION_KINDS`에 `revoke`·`rerecord` 등 예외 판단 kind가 있다.
- I/O 관찰 지점: Git 변경은 worker worktree의 HEAD·index(`git(exec, cwd, ['reset','--soft',…])`)이고, 원장 쓰기는 `commitWrite()` → `writeOwnedLedger`다.

#### Target behavior

- 성공:
  - 사전 조건을 모두 통과하면 `taskRef = expectedTaskRef(tasksBlock)`, `commits = untraileredWorkerCommits(exec, cwd, ledger, taskRef)`(TASKS-001)를 구한다. `commits[0]`을 c1이라 하면 `toHead = git rev-parse c1^1`(first parent), `fromHead = HEAD`를 구하고 `git reset --soft toHead`를 실행한다.
  - decision `{ task, kind: 'uncommit', attempt: item.dispatch.attempt, fromHead, toHead, commits }`를 `item.decisions`와 `ledger.decisions`에 추가한다. `commitWrite()` 뒤 `withCheckpoint({ ok: true, command: 'uncommit', task: item, decision }, …)`를 반환한다.
  - 이후 worker 범위에 무트레일러 커밋이 없으므로 `coordinate next --task`는 `commit`을 낸다. 되돌린 변경은 index에 staged로 남는다.
- 사전 조건 거절(Git·원장 불변, 검사 순서대로):
  - worker 할당이 틀리면 `unassigned-worker-worktree`(`guardWorkerDispatch`). fence가 낡았으면 기존 fence 거절.
  - 상태가 `prepared`가 아니거나, `item.dispatch?.status !== 'active'`이거나, worker `tasks.md`의 `commit_sha`가 비어 있지 않으면 `illegal-transition`. stamp된 커밋은 reset 대상이 아니다.
  - `commits`가 비어 있으면(원장에 `integrationHead`가 없을 때 포함) `uncommit-not-needed`.
- reset 뒤 실패(되돌림):
  - `commitWrite()`가 `{ ok: false, reason: 'ledger-lock-lost' }`를 돌려주면 `git reset --soft fromHead`를 실행한 뒤 그 결과를 반환한다.
  - `commitWrite()` 안의 `writeLedger`가 throw하면 `git reset --soft fromHead`를 실행한 뒤 같은 오류를 다시 throw한다.
  - 되돌림 reset 자체가 실패하면 `{ ok: false, reason: 'uncommit-rollback-failed', fromHead, toHead }`를 반환한다. hint의 next는 "HEAD가 toHead에 남아 있으니 사용자에게 보고하고 `git reset --soft <fromHead>` 복구 여부를 묻는다"이다.
- 보존:
  - reset으로 staged가 된 경로 가운데 scope 밖 경로는 다음 `bouncer commit`의 기존 scope 검사가 `out-of-scope`로 거절한다. uncommit은 scope를 넓히거나 경로를 고르지 않는다.
  - 다른 coordinate 명령의 동작·출력, `workerCommitEvidence`, unknown 명령 오류 문구(`cli-git-commands.ts:893-897`)는 바꾸지 않는다. `note`도 이 문구에 없으며, `test/cli-coordinate.test.js:551,556`이 이 문구를 고정한다.
- `drive-metrics`의 `EXCEPTION_KINDS`에 `'uncommit'`을 추가한다. 그러면 `isException({ kind: 'uncommit' }) === true`가 된다.

#### Interface

- 제공:
  - CLI: `bouncer coordinate uncommit --blueprint <dir> --task <ddd> --ledger-path <path> --ledger-hash <sha256> [--repo <dir>]`. 할당된 worker cwd(light는 integration cwd)에서 실행한다.
  - usage 한 줄 설명: `Soft-reset worker commits that lack this task's Bouncer-Task trailer so commit can redo them.`
  - 성공 JSON: `{ ok: true, command: 'uncommit', task, decision: { task, kind: 'uncommit', attempt, fromHead, toHead, commits }, checkpoint }`.
  - `COORDINATE_FAILURE_HINTS`
    - `uncommit-not-needed`: cause는 worker HEAD에 무트레일러 커밋이 없다는 사실, next는 `coordinate next`로 다시 판정하라는 안내.
    - `uncommit-rollback-failed`: Target behavior의 문구.
  - 테스트 seam: 기존 `coordinate({ ..., deps: { writeLedger(file, ledger) } })`를 쓴다(`coordinator-commands.ts`의 `deps.writeLedger || atomicWrite`). 선례는 `test/coordinator.test.js:571-575`. 새 seam은 만들지 않는다.
- 거부:
  - usage(exit 2): `--task` 없음 또는 빈 값이면 `coordinate uncommit: --task is required`. fence 플래그가 없으면 기존 fenced 거절.
  - core(exit 1, 불변): `uncommit-not-needed`, `illegal-transition`, `unassigned-worker-worktree`, `task-required`, `task-outside-blueprint`, fence 계열.
  - core(exit 1, Git 되돌림 뒤): `ledger-lock-lost`. 복구 실패면 `uncommit-rollback-failed`.
- 용어 "무트레일러 커밋": TASKS-001 Interface 정의를 따른다. `integrationHead..HEAD` first-parent 범위에서 이 task의 기대 ref와 같은 `Bouncer-Task:` 줄이 없는 커밋이다. 예: `git commit -m 'feat: raw'`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `COMMANDS`, `TASK_HANDLERS`, `신규 추출 지점: uncommit handler`, decision 타입 union, worker 할당 guard 호출 조건, `COORDINATE_FAILURE_HINTS` | Modify | coordinate core 명령 실행 | uncommit handler·decision 타입·hint 추가, guard 적용 | `:72-74`, `:137-140`, `:941-964`, `:1240-1246`, `:1351`, `:1365`; 판별은 TASKS-001 `untraileredWorkerCommits` |
| `packages/cli/src/cli-git-commands.ts` | `COORDINATE_COMMANDS`, `checkFenceFlags`, 명령별 필수 플래그 검사 | Modify | coordinate CLI 파싱 | `uncommit`을 명령·fenced 목록에 넣고 `--task` 필수 검사 | `:447-450`, `:570-573`, `:699-702` |
| `packages/cli/src/cli-usage.ts` | coordinate 요약, `uncommit` usage | Modify | help 출력 | 요약 줄과 명령별 usage 추가 | `:17`, `:49`; `test/cli-help.test.js:225-240`이 서브커맨드마다 usage 접두를 검사 |
| `packages/cli/src/drive-metrics.ts` | `EXCEPTION_KINDS` | Modify | 예외 판단 kind 집합 | `'uncommit'` 추가 | `:28-31`; `isException` export `:822-823`을 성공 테스트가 단언한다 |
| `test/coordinator.test.js` | 신규 uncommit 테스트 | Modify | coordinator core 테스트 | 성공·누적 커밋·거절 3종·writeLedger throw 되돌림 테스트 추가 | 거절 테스트 선례 `:2195-2227`, hint 커버리지 `:221-225`, writeLedger 주입 선례 `:571-575` |
| `test/cli-coordinate.test.js` | fenced 집합, 신규 CLI 테스트 | Modify | CLI 파싱 테스트 | fenced 집합에 `uncommit` 추가, `--task` 누락 usage 테스트 | `:130-134`, revoke 선례 `:679-704` |
| `test/cli-help.test.js` | `COORDINATE_SUBCOMMANDS` | Modify | help 테스트 | `'uncommit'` 추가 | `:225-229` |

#### Constraints

- uncommit은 `LEASE_CHECKED_COMMANDS`에 넣지 않는다(coordinator가 lease 플래그 없이 부른다. `critical-recovery`·`rerecord`와 같다).
- worker 할당·cwd 검사는 `guardWorkerDispatch`를 재사용한다. light와 full의 차이를 복제하지 않는다.
- 거절은 Git과 원장을 바꾸기 전에 끝낸다. reset 뒤 실패는 `fromHead` 복원 하나뿐이다.
- 기존 단언 변경 범위:
  - `test/cli-help.test.js:225-229` 상수 `COORDINATE_SUBCOMMANDS`에 `'uncommit'`만 추가한다. 이 상수를 쓰는 테스트는 `coordinate <sub> --help와 -h → 그 subcommand usage를 stdout에 출력한다`(`:231-243`)이고, 그 단언 값은 바꾸지 않는다.
  - `test/cli-coordinate.test.js:130-134`의 helper `coordinateCli` 안 `fenced` 집합에 `'uncommit'`만 추가한다. 이 집합은 테스트 단언이 아니라 helper가 fence 플래그를 자동으로 붙일지 정하는 데 쓴다. 이를 쓰는 기존 테스트의 단언은 바꾸지 않는다.
  - `test/cli-coordinate.test.js:551,556` 정규식은 바꾸지 않는다.
  - 그 밖의 기존 테스트 이름·단언은 수정하지 않는다.
- 새 테스트 파일은 만들지 않는다. 테스트 이름은 `<subject> → <expectation>` 형식이고 ts·js 줄은 120자 이내다.

### drive-execution/untrailered-worker-commit/003 · `62a6f842`

#### Goal & intent

coordinator가 `blocked`/`worker-commit-untrailered`를 받으면 `bouncer coordinate uncommit`을 실행하고 이어서 `coordinate advance`를 실행하도록 문서가 안내한다. "worktree를 손으로 reset하지 않는다" guard와 이 절차가 충돌하지 않게 문구를 맞춘다. 수용 기준은 새 문서 단언 테스트와 TOML parity 통과이고, 검증 명령은 `node --test test/agents.test.js test/doc-shape-cli.test.js`다.

#### Current behavior

- `rules/cli.md:259`: `bouncer coordinate <bootstrap|…|note>` 명령 목록 줄에 `uncommit`이 없다.
- `rules/cli.md:430-432`: "`coordinate next` returns `commit` … `worker-commit-stamp-mismatch` instead."만 있고 무트레일러 커밋 경우는 설명하지 않는다.
- `agents/bouncer-coordinator.md:63-64` (Hard guards): "Perform branch, worktree and fan-in Git work through `bouncer coordinate` only. Do not create, reset or delete worktrees by hand."
- `agents/bouncer-coordinator.md:256-261` (Procedure 3 Drive): report·record 거절 세 가지와 "call `advance` so `commit` runs, then retry"만 있다.
- `references/coordinator-cards/blocked.md:1-15`: coordinator Procedure step 5와 Hard guards에서 복사한 일반 Judge 규칙만 있고, reason별 안내는 없다.
- `.codex/agents/bouncer-coordinator.toml`은 `agents/bouncer-coordinator.md`에서 `mdToCodexToml`(`packages/cli/src/codex-agents.ts:46`)로 생성된다. `test/agents.test.js:56-62`가 바이트 일치를 검사한다.
- 크기 계약: `test/agents.test.js:110-115`가 coordinator `## Worker dispatch` 절(`:182`~)을 20줄 이하로 고정한다. 이번 변경은 그 절을 건드리지 않는다. `test/doc-shape-cli.test.js:260-270`은 `rules/cli.md`의 거절 표 reason을 검사한다. `:430` 문단은 표가 아니다.

#### Target behavior

- `rules/cli.md`
  - `:259` 목록에 `uncommit`을 넣는다.
  - `:430-432` 문단 뒤에 문장을 더한다. 내용: stamp가 비어 있고 worker에 `Bouncer-Task` 트레일러 없는 커밋이 있으면 scope dirty와 무관하게 `blocked`/`worker-commit-untrailered`를 낸다. `coordinate uncommit --task <ddd>`(fence 포함, worker cwd)는 가장 오래된 무트레일러 커밋의 부모로 soft reset하고 `uncommit` decision을 남긴다. 무트레일러 커밋이 없으면 `uncommit-not-needed`로 거절한다.
- `agents/bouncer-coordinator.md`
  - Hard guards `:63-64`: `bouncer coordinate uncommit`이 worker의 무트레일러 커밋을 되돌리는 유일한 reset 경로라는 문장을 같은 bullet에 덧붙인다. "손으로 reset하지 않는다" 규칙은 유지한다.
  - Procedure 3 Drive(`:256-261` 부근): "`advance` stops `blocked` with `worker-commit-untrailered` → run `bouncer coordinate uncommit` for that task, then `advance` again; do not rerun `commit` by hand." 한 문장을 추가한다.
- `references/coordinator-cards/blocked.md`: 위 Procedure 문장과 같은 뜻의 bullet 하나를 추가한다(카드는 Procedure를 복사한 것이다).
- `.codex/agents/bouncer-coordinator.toml`: 재생성해서 parity를 유지한다.
- 보존: 다른 reason 안내, `## Worker dispatch` 절, report·record 거절 문구(`skills/bouncer-run/references/agent-dispatch.md:26-27`, `references/coordinator-cards/report.md:20-25`, `record.md:14-15`)는 바꾸지 않는다. report·record 규칙 자체가 바뀌지 않기 때문이다.

#### Interface

- 제공: 문서 계약.
  - coordinator 역할 문서와 blocked 카드는 모두 `worker-commit-untrailered`와 `coordinate uncommit`을 함께 언급한다.
  - `rules/cli.md`는 `uncommit` 명령과 `uncommit-not-needed` 거절을 언급한다.
- 거부: 문서에 `git reset`을 손으로 실행하라는 안내는 넣지 않는다. 새 테스트가 coordinator 문서에 `git reset --soft` 직접 실행 안내가 없음을 단언한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | coordinator 명령 목록, `coordinate next` commit 문단 | Modify | CLI 계약 문서 | `uncommit` 목록 추가와 무트레일러 판정·uncommit 문장 추가 | `rules/cli.md:259`, `:430-432` |
| `agents/bouncer-coordinator.md` | Hard guards, Procedure 3 Drive | Modify | coordinator 역할 규칙 | uncommit 예외 문장과 복구 절차 문장 추가 | `:63-64`, `:256-261` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | Codex 역할 TOML | 재생성 | `test/agents.test.js:56-62` parity, 생성기 `packages/cli/src/codex-agents.ts:46` |
| `references/coordinator-cards/blocked.md` | Judge bullet 목록 | Modify | blocked action 카드 | uncommit 복구 bullet 추가 | `blocked.md:1-15` |
| `test/agents.test.js` | 신규 문서 단언 테스트 | Modify | 역할 문서 테스트 | 새 reason·명령 언급 단언 추가 | 같은 파일 `:110-115`가 coordinator 문서 단언 선례 |

#### Constraints

- 문서 본문은 영어이다(기존 문서 언어를 따른다). 식별자는 코드와 같은 철자를 쓴다: `worker-commit-untrailered`, `uncommit-not-needed`, `coordinate uncommit`.
- `## Worker dispatch` 절 줄 수(20줄 이하)를 바꾸지 않는다.
- `.codex/agents/bouncer-coordinator.toml`은 손으로 고치지 않고 생성기 출력으로만 쓴다.
- 기존 테스트 이름·단언은 수정하지 않는다. 새 테스트 파일은 만들지 않는다. 테스트 이름은 `<subject> → <expectation>` 형식이고 js 줄은 120자 이내다.

### drive-execution/untrailered-worker-commit/004

#### Goal & intent

TASKS-001~003이 통합된 integration HEAD에서 `npm run ci`가 통과하는지 확인한다. emit, 버전, 커버리지, unit tier, eslint, 문서 형태, 타입, 테스트 이름 검사를 모두 포함한다(epic Success criteria 8·13).

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.