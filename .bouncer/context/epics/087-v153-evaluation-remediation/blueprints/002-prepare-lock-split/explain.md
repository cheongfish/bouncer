---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/087-v153-evaluation-remediation/blueprints/002-prepare-lock-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-06T16:48:28.895+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '087'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 56dbc93f8ab7e22952af342a66b7b0725192399b
      range_to: be0459ec48a4ec8ba47bc419fb644b3e9e924496
      diff_sha: 64d0bf8c2eb04e67badb5a5c524c949a9abb958a900b0723bad62a73d9453b2e
      recorded_at: '2026-10-06T16:55:00+09:00'
  task_commits:
    - task: EPIC-087/BP-002/TASK-001
      sha: be0459ec
      intent_anchor: task-001
---
# Explain

## Background

`coordinate prepare`는 worker worktree를 만들고 `npm ci`로 seed한다. seed가 `LOCK_STALE_MS`(30초)를 넘기면 다른 프로세스가 `.lock`을 회수한다. 잠금을 잡은 채 `git worktree add`와 seed를 돌리면 원장 bytes와 Git 등록이 어긋난다.

`prepareCoordinator`는 잠금을 세 구간으로 나눈다. ① 판정·revoke 정리만 하고 원장은 쓰지 않는다. ② 잠금 파일 없이 worktree 생성과 seed를 한다. ③ ①의 bytes hash가 그대로이고 계획 worker가 등록돼 있을 때만 `prepared`와 lease를 쓴다. 성공 출력 shape(`ready`, `tasks`, `decisions`)와 원장 스키마는 그대로다.

## Intuition

긴 설치는 복도에서 하고, 원장 문은 hash가 같을 때만 다시 연다.

## Code

- `scripts/src/lib/coordinator.ts` — `prepareCoordinator`, `removeUnreferencedCreatedWorkers`, `cleanupCreatedWorkersUnderNewLock`. `coordinate()`는 `prepare`를 공통 fenced 잠금보다 앞에서 이 경로로 보낸다.
- `test/coordinator.test.js` — seed가 잠금 밖에서 돌 때 다른 prepare가 대기하지 않는지, 실패·hash 불일치 때 이번 호출 `create` worker만 지우는지를 본다.
- `CHANGELOG.md` — 잠금 밖 생성·seed와 실패 롤백.

실패 시 `created`만 되돌린다. reuse 배정은 `created`에 넣지 않는다. hash가 바뀌면 `stale-ledger-checkpoint`이고, 정리 잠금을 못 잡으면 Git을 건드리지 않는다. 남은 등록은 다음 prepare가 reuse로 받는다. `dependency-install-failed` 힌트는 worker·integration 양쪽 `npm ci`를 가리킨다.

## Quiz

1. `coordinate prepare`가 worker seed(`npm ci`)를 원장 잠금 밖에서 돌리는 직접 이유는?
   - A) bootstrap이 integration worktree를 만들 때와 같은 순서를 맞추려고
   - B) seed가 `LOCK_STALE_MS`를 넘기면 다른 프로세스가 `.lock`을 회수하기 때문에
   - C) `integrate` fan-in이 cherry-pick 동안 원장을 못 읽게 막으려고

2. 잠금 밖 seed가 실패하면 `prepare`는 Git 쪽을 어떻게 되돌리나?
   - A) 원장에 적힌 모든 `workerPath` worktree를 지운다
   - B) reuse와 create를 가리지 않고 이번 wave worker를 모두 지운다
   - C) 이번 호출이 `git worktree add`에 성공한 `created` worker만, 지금 원장이 가리키지 않으면 지운다

3. ③에서 원장 bytes hash가 ①과 다르면 `prepare`는?
   - A) `created` worker를 지우고 `stale-ledger-checkpoint`로 실패한다
   - B) 메모리에 올린 전이를 그대로 쓰고 `ok: true`를 반환한다
   - C) 새 failure reason `prepare-lock-split`을 만들고 원장을 덮어쓴다

## Tasks

### EPIC-087/BP-002/TASK-001 · `be0459ec`

#### Goal & intent

`coordinate prepare`가 `git worktree add`와 `seedCoordinatorWorker`(그 안의 `npm ci`)를 원장 잠금 밖에서 실행하게 한다. seed가 30초(`LOCK_STALE_MS`)를 넘어도, seed 도중 원장이 바뀌어도, seed가 실패해도 끝난 뒤 원장의 `workerPath`와 Git에 등록된 worker worktree가 일치해야 한다. 수용 기준은 epic Success criteria 5·7이고, 완료 명령은 frontmatter `bouncer.verify`(없으면 `config.verify`)다.

#### Current behavior

- `coordinate()`는 fenced 명령 전체를 `withLedgerLock(integration.ledgerFile, …)` 하나로 감싼다(`scripts/src/lib/coordinator.ts:2008`). 2009-2019에서 원장 bytes를 읽고 `assertLedgerFence`로 호출자 `ledgerHash`와 대조한다(불일치 시 `stale-ledger-checkpoint`, 395).
- prepare 분기(2057-2181)는 잠금 안에서 차례로:
  1. 2067-2073 integration branch 판정, `ledger.integrationBranch` 메모리 backfill.
  2. 2081-2083 `readCoordinatorPolicy`, `readyWave`.
  3. 2086-2099 `missing-blueprint`, verification bundle 검사.
  4. 2105-2111 `removeRevokedWorker`(1086-1103) — `git worktree remove --force`, `git branch -D`를 실행하고 메모리의 `workerPath`·`branch`를 지운다. 오류는 삼킨다.
  5. 2115-2126 `plannedWorkers` 계산. `resolveWorktreeBranch`(`scripts/src/lib/runtime-state.ts:149-179`)가 등록 경로면 `reuse`, 아니면 `refs/heads/<branch>`가 있을 때 `branch-conflict`, 없으면 `create`.
  6. 2130-2143 legacy `prepared` task의 `item.branch` 메모리 backfill.
  7. 2149-2178 ready 루프: verification은 `ready` 전이, commit은 `create`면 `mkdirSync` + `git worktree add -b <branch> <worker> HEAD`(2156-2160), `registeredWorker` 확인(2161-2163), `seedCoordinatorWorker`를 deps 없이 호출(2168-2171), `ready → prepared`, `workerPath`·`branch`, `issueLease`(2172-2177).
  8. 2179 `writeOwnedLedger`(1141-1150)가 `owns()` 확인 뒤 원장을 쓴다.
- 이번 호출이 worktree를 만든 뒤의 조기 반환(2162 `unassigned-worker-worktree`, 2171 seed 실패, 2179 `ledger-lock-lost`, `worktree add` 예외)은 앞서 만든 worker를 지우지 않는다. 원장은 쓰이지 않고 Git 등록만 남는다.
- seed가 30초를 넘기면 다른 프로세스가 잠금을 회수할 수 있고(`scripts/src/lib/scope.ts:172`, 323-324), 2179에서 `ledger-lock-lost`로 끝난다.
- 같은 3단계 패턴의 선례: `integrateVerificationTask`(1224-1350)는 잠금 밖에서 `prepareDependencies`를 돌리고 재획득 뒤 `phase1CheckpointHash`와 대조해 `stale-ledger-checkpoint`를 반환한다(1301-1308). 이 선례의 1단계는 원장을 쓰지만 prepare 1단계는 쓰지 않으므로, 대조 기준은 1단계에서 읽은 bytes의 hash다.
- I/O 결합
  - `seedCoordinatorWorker` 호출(2168-2170)에 deps가 없어 npm은 `scripts/src/lib/seed-worktree.ts:5`의 모듈 `execFileSync`를 쓴다. `seedCoordinatorWorker(…, deps?)`는 이미 `{ execFileSync }`를 받아 `prepareDependencies`(44-63, npm 호출 54)로 넘긴다.
  - npm은 worker에 `package-lock.json`이 있고 `node_modules/.package-lock.json`이 없을 때만 실행된다(`seed-worktree.ts:48-49`).
  - `seedConfig`/`realGit`(`seed-worktree.ts:85-115`, 298)은 주입할 수 없다. 이번 작업에서 주입할 필요도 없다.
  - 잠금 파일은 `${ledgerFile}.lock`, 레코드는 `{ pid, token, at }`(`scope.ts:302-352`). 원장은 `<integration>/.bouncer/runtime/coordinator.json`.
- 테스트 근거
  - `test/coordinator.test.js:19-36`의 `coordinate` 래퍼가 `prepare`에 현재 원장 fence를 자동으로 붙인다.
  - `test/coordinator.test.js:806` "a failed second worker seed leaves main plan, the first worker copy, and the ledger unchanged"는 이번 호출이 만든 worker1이 남는다고 단언한다.
  - 잠금 부재 확인 패턴: `test/coordinator.test.js:1861-1887`. npm 주입 패턴: 2273-2286. 잠금 선점 패턴: 1935-1949.
  - prepare와 `ledger-lock-lost`·`stale-ledger-checkpoint`·npm 실패를 함께 다루는 테스트는 없다.
  - 테스트는 `scripts/lib/*`(빌드 산출물)를 require한다. `npm test`의 `pretest`가 `tsc`를 실행한다.
  - 재현: `npx tsc && node --test --test-name-pattern "prepare" test/coordinator.test.js`.

#### Target behavior

- 성공 경로
  - ① 잠금 안: 기존 2009-2148의 판정과 `removeRevokedWorker`를 그대로 수행하고 원장은 쓰지 않는다. 메모리 원장 객체, `plannedWorkers`, `ready`, 1단계에서 읽은 bytes의 hash를 들고 잠금을 푼다.
  - ② 잠금 밖: ready의 commit task마다 `create`면 `mkdirSync` + `git worktree add`, 이어서 `registeredWorker` 확인, `seedCoordinatorWorker({ …, deps: { execFileSync: exec } })`.
  - ③ 잠금 재획득: 원장 bytes를 다시 읽어 hash가 ①과 같고, ready의 모든 commit worker가 여전히 `registeredWorker`이면 ①의 메모리 원장에 verification `ready` 전이, commit `ready → prepared`, `workerPath`·`branch`, `issueLease`를 적용하고 `writeOwnedLedger`로 쓴다. 성공 출력은 지금과 같다.
  - ② 동안 원장 `.lock` 파일은 없다.
- 실패 경로 (이번 호출은 원장을 쓰지 않는다)
  - ③의 hash가 다르면 `{ ok: false, reason: 'stale-ledger-checkpoint' }`.
  - ②의 seed 실패는 seed reason을 그대로 반환한다(`dependency-install-failed`, `copy-failed`, `missing-worktree`, `missing-blueprint`). `registeredWorker` 실패는 `unassigned-worker-worktree`, `worktree add` 예외는 정리 뒤 다시 던진다.
  - 위 실패마다 이번 호출이 `create`로 만든 worker를 정리한다. 정리는 항상 이 프로세스가 소유한 원장 잠금 안에서 하고, 그 시점 원장의 어떤 task도 `workerPath`로 참조하지 않는 경로만 지운다. 정리 순서는 `git worktree remove --force <worker>` → `fs.rmSync(worker, { recursive: true, force: true })` → `git branch -D <branch>`.
  - 정리 위치는 실패 지점마다 하나다.
    - ③에서 hash가 다름: 이미 쥔 ③ 잠금 안에서 정리하고 `stale-ledger-checkpoint`를 반환한다.
    - ③에서 계획한 worker 중 하나라도 Git 등록이 사라짐(겹친 다른 호출의 정리 등): 원장을 쓰지 않고, 같은 ③ 잠금 안에서 정리한 뒤 `unassigned-worker-worktree`(`workerPath` 포함)를 반환한다.
    - ② 실패: 정리 전용 `withLedgerLock`을 새로 잡아 정리하고 ②의 reason을 반환한다.
    - ③의 `owns()`가 거짓(`ledger-lock-lost`): ③ 안에서는 원장도 Git도 건드리지 않는다. ③이 끝난 뒤 정리 전용 `withLedgerLock`을 새로 잡아 정리하고 `ledger-lock-lost`를 반환한다.
  - ③ 잠금을 얻지 못하면 `ledger-locked`를 반환한다. 정리 전용 잠금을 얻지 못하면 정리하지 않고 원래 실패 reason을 반환한다. 어느 쪽이든 남은 등록 worktree는 다음 prepare가 `reuse`로 받는다.
- 보존
  - `reuse` worker는 어떤 실패에서도 지우지 않는다.
  - ① 단계의 기존 거절(`coordinator-config-invalid`, `missing-blueprint`, `unassigned-worker-worktree`, `branch-conflict`, `ledger-locked`, fence 거절)은 worktree를 만들기 전에 같은 reason으로 반환한다.
  - verification-only wave는 ②에서 할 일이 없어도 같은 ③ 경로로 원장을 쓴다.
  - `COORDINATE_FAILURE_HINTS['dependency-install-failed']`는 prepare 재시도도 안내한다.

#### Interface

- 제공
  - `coordinate({ command: 'prepare', … })` 입력·성공 출력은 변경 없음.
  - prepare가 `deps.execFileSync`를 `seedCoordinatorWorker`의 `deps.execFileSync`로 넘긴다. 테스트 seam의 shape: `deps.execFileSync(command: string, args: string[], options: object) → string | Buffer`. `command === 'npm'`이면 seed의 의존성 설치 호출이다.
  - 신규 추출 지점: 이번 호출이 만든 worker를 원장 잠금 안에서, 현재 원장이 참조하지 않을 때만 worktree·디렉터리·branch 순으로 지우는 정리 헬퍼.
  - `COORDINATE_FAILURE_HINTS['dependency-install-failed']`의 `cause`를 integration·worker 공통 설치 실패로, `next`에 `bouncer coordinate prepare` 재시도 문구를 추가.
- 거부
  - ③ hash 불일치: `stale-ledger-checkpoint`. 원장 쓰기 없음.
  - ③ 시점 계획 worker의 Git 등록 소실: `unassigned-worker-worktree`. 원장 쓰기 없음.
  - seed 실패: seed가 준 reason. 원장 쓰기 없음.
  - 정리 중 `git worktree remove`·`git branch -D` 실패: 예외를 그대로 던진다(삼키지 않음). 단, worktree가 이미 없는 경우는 실패로 보지 않는다.
- 용어
  - "이번 호출이 만든 worker": `plannedWorkers`에서 `action === 'create'`이고 이번 ②에서 `git worktree add`가 성공한 경로. 예: ready `['001','002']` 중 001만 `create`였으면 001 worker만 대상이다.
  - "원장이 참조": 다시 읽은 원장 `tasks[]` 중 `workerPath`가 같은 경로인 항목이 있음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `coordinate`(prepare 분기), `COORDINATE_FAILURE_HINTS`, 신규 추출 지점: 생성 worker 정리 | Modify | 잠금 하나 안에서 판정·worktree 생성·seed·원장 쓰기 | prepare를 fenced 공통 잠금 앞에서 분기해 ①②③으로 나누고, seed에 `exec` 주입, 실패 정리, 힌트 문구 | 2008·2057-2181이 잠금 안 장기 I/O의 원천이고, 1224-1350이 같은 패턴의 선례 |
| `test/coordinator.test.js` | 806 seed 실패 테스트, 신규 prepare 회귀 테스트 | Modify | 이번 호출 worker1 잔존을 단언 | 806을 worker1·branch 제거로 바꾸고, 잠금 부재·seed 중 원장 변경·npm 실패·오래된 잠금·중단 뒤 재사용·겹친 prepare 테스트 추가 | 기존 단언이 새 계약과 충돌하고, prepare 장애 경로 테스트가 없음 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 미출시 변경 기록 | `### Fixed`에 prepare 잠금 구간 항목 추가 | epic 성공 기준 7 |

#### Constraints

- 원장 스키마와 prepare 성공 출력 shape를 바꾸지 않는다. `coordinate-output.ts`가 `ready`·`tasks`·`decisions`에 의존한다.
- bootstrap, fan-in(`integrateCommitWave`), verification integrate 경로의 동작은 그대로 둔다.
- Git 호출은 기존처럼 argv 배열과 `git(exec, …)`만 쓴다.
- 새 failure reason을 만들지 않는다.
- 주석은 주변 코드처럼 한국어로, 왜 그 순서인지를 적는다.
