---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/runtime-architecture/blueprints/transition-guard-followups/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-18T17:32:15.325+09:00'
bouncer:
  id: EXPLAIN-transition-guard-followups
  epic_id: runtime-architecture
  blueprint_id: transition-guard-followups
  status: published
  comprehension:
    - range_from: f0f93bc13c65e4692b119f9469e4bd85b9e31ea9
      range_to: 14a444d666ed8ebed544d981768414a747c6bbe6
      diff_sha: 5557ef3f0ca79c2f9b0c53ad4e53913891ab10b52f8e981484b6def8346d9131
      recorded_at: '2026-10-18T17:33:03+09:00'
  task_commits:
    - task: runtime-architecture/transition-guard-followups/001
      sha: 65cfb9ca
      intent_anchor: task-001
    - task: runtime-architecture/transition-guard-followups/002
      sha: c868b16c
      intent_anchor: task-002
    - task: runtime-architecture/transition-guard-followups/003
      sha: e5837e06
      intent_anchor: task-003
    - task: runtime-architecture/transition-guard-followups/004
      sha: 093f500c
      intent_anchor: task-004
    - task: runtime-architecture/transition-guard-followups/005
      sha: facf354b
      intent_anchor: task-005
    - task: runtime-architecture/transition-guard-followups/006
      sha: 2994ed5d
      intent_anchor: task-006
    - task: runtime-architecture/transition-guard-followups/007
      sha: b7fa510f
      intent_anchor: task-007
    - task: runtime-architecture/transition-guard-followups/009
      sha: 14a444d6
      intent_anchor: task-009
---
# Explain

## Background

전이 가드 001 blueprint의 최종 리뷰에서 이월된 결함을 고친다. 가장 큰 문제는 정상 완료된 drive에서도 `run detach`가 거절되던 것이다. 진행 중 worker의 기준이 잘못 잡혀 있었기 때문이다. 나머지는 거절 응답이 원인(`cause`)과 다음 행동(`next`)을 빠뜨리던 문제, revise 거절에서 필드가 사라지던 문제, 다음 행동 안내가 커밋 단계를 가리키지 못하던 문제, 그리고 pathspec magic으로 scope 사전 거절을 우회할 수 있던 문제다.

이번 변경에는 blocked 최종 리뷰를 실제로 없던 round 없이 닫는 경로도 들어 있다. 사용자가 finding을 위험 수용으로 승인하면 `review accept-risk` 명령으로 기록하고, 그 표식을 blueprint 상태가 인정한다.

## Code

- `scripts/src/lib/run-detach.ts`: `detachRun`이 진행 중 여부를 판정한다. integrated task는 진행 중으로 세지 않는다. 거절 응답은 `withHint`를 거쳐 `cause`와 `next`를 붙인다.
- `scripts/src/lib/coordinate-next.ts`: `taskNext`와 `decideNext`가 다음 행동을 고른다. worker 작업 트리가 더럽거나 커밋 stamp가 맞지 않으면 commit 단계를 가리킨다. 트리가 깨끗한데 stamp만 낡았으면 `worker-commit-stamp-mismatch`로 차단한다. `next`는 읽기 전용이다.
- `scripts/src/lib/coordinator.ts`: `COORDINATE_FAILURE_HINTS`와 `NEXT_FAILURE_HINTS`가 거절 hint를 한 곳에 모은다. 개별 거절 지점에 `cause`와 `next`를 흩어 쓰지 않는다. `workerScopeDirtyPaths`는 dirty 판정에 쓰인다.
- `scripts/src/lib/cli-git-commands.ts`: `cmdCoordinate`가 fenced 명령의 거절을 hint 표를 거쳐 내보낸다. fence 플래그가 빠진 경우도 모든 fenced 명령에 같은 경로로 적용된다.
- `scripts/src/lib/scope.ts`: `trackedScopeViolations`는 `git ls-files --literal-pathspecs`로 추적 파일을 조회한다. pathspec magic으로 scope 검사를 우회할 수 없다.
- `scripts/src/lib/review-record.ts`와 `scripts/src/lib/cli-review-command.ts`: `acceptReviewRisk`와 `parseAcceptRiskArgs`가 `review accept-risk`를 처리한다. `--yes`가 없으면 확인 거절로 끝나고, 사용법 오류와는 구분된다.
- `scripts/src/lib/validate-sections.ts`: `collectFindingFailures`가 `accepted_risk` 표식을 확인한다.
- `rules/cli.md`: 명령별 거절과 종료 코드의 공개 계약이다. run detach의 "원장·포인터 불변" 목록은 쓰기 뒤 잠금 해제 실패라는 예외를 따로 둔다.

설계상 선택 두 가지. 첫째, hint 표에 없는 reason은 `cause`를 reason 그대로 쓰는 폴백을 탄다. 둘째, 거절 응답의 종료 코드와 성공 출력은 바꾸지 않았다. 필드만 늘었다.

## Quiz

1. 모든 task가 통합된 뒤 기록된 dispatch가 남아 있는 drive에서 `run detach`를 실행하면 어떻게 되는가?
   - a) 거절 없이 진행된다
   - b) 진행 중 worker로 보고 `detach-worker-in-flight`로 거절한다
   - c) 검증이 통과한 뒤에만 포인터가 지워진다

2. `coordinate revise`가 거절될 때 응답은 어떻게 달라졌는가?
   - a) 거절 원인 한 줄만 나오고 종료 코드가 2로 바뀌었다
   - b) 거절 응답에 `cause`와 `next`가 붙고 종료 코드는 그대로다
   - c) 성공 출력에도 `cause`와 `next` 필드가 추가되었다

3. worker 작업 트리가 깨끗한데 커밋 stamp만 낡았다면 다음 행동 안내는 어떻게 되는가?
   - a) commit 단계를 안내한다
   - b) verify를 다시 실행하라고 안내한다
   - c) 차단하고 `worker-commit-stamp-mismatch`를 낸다

4. `review accept-risk`를 `--yes` 없이 실행하면 어떻게 되는가?
   - a) 사용법 오류로 종료 코드 2를 낸다
   - b) 확인 거절로 종료 코드 1과 `review-accept-risk-confirmation-required`를 낸다
   - c) 위험 수용이 바로 기록된다

## Tasks

### runtime-architecture/transition-guard-followups/001 · `65cfb9ca`

#### Goal & intent

정상적으로 완료된 drive에서 `bouncer run detach --yes`가 성공하게 한다. 모든 detach 거절은 `{ ok: false, reason, cause, next }`로 응답하고, 잠금을 잃은 detach는 아무것도 쓰지 않는다. 수용 기준은 epic Success criteria 12·13·16이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- 진행 중 판정(`scripts/src/lib/run-detach.ts:117-121`): `dispatch.status`가 `active|reported`이거나 task `status`가 `prepared|recorded`이면 진행 중이다. task가 dispatch→report→integrated를 거치면 `dispatch.status: 'reported'`가 남는다. 그래서 모든 task가 integrated여도 `detach-worker-in-flight`(`tasks: [id]`)로 거절된다.
- ledger 타입은 `run-detach.ts:104-108`의 inline 타입(`status?: string`)으로 cast해 읽는다.
- 거절 shape:
  - `detach-confirmation-required`(`:87`), `detach-awaiting-confirmation`(`:115`), `detach-worker-in-flight`(`:123`)는 `{ ok:false, reason[, tasks] }`만 낸다.
  - `DetachFail` 타입(`:18-23`)에는 `cause`·`next`가 없다.
  - `no-ledger`·`unreadable-ledger`는 `readCoordinatorLedger`(`scope.ts:500`)의 결과를 그대로 넘긴다(`run-detach.ts:95`, `:103`).
  - `ledger-locked`·`ledger-lock-lost`는 `withLedgerLock`(`scope.ts:323`, `:345`)이 맨 `{ ok:false, reason }`으로 낸다.
- CLI: `cmdRun`(`scripts/src/lib/cli-project-commands.ts:240-279`)은 결과를 JSON으로 출력하고 `ok ? 0 : 1`을 돌려준다(`:260-262`). hint 표를 거치지 않는다.
- 잠금: `withLedgerLock<T>(ledgerFile, run: (owns: () => boolean) => T)`(`scope.ts:299-347`)는 callback에 `owns`를 넘긴다. 그런데 detach는 `() =>`로 받아서 무시하고(`run-detach.ts:100`), `:138`에서 소유 확인 없이 `writeLedgerFile`을 호출한다. 비교 패턴은 `scope.ts:833`의 `if (!owns()) return { ok: false, reason: 'ledger-lock-lost' }`다.
- 타입:
  - `Ledger.status` union(`scripts/src/lib/execution-contracts.ts:88`)은 `active|awaiting_confirmation|partial_closed|promotion_stopped`이고 `detached`가 없다.
  - `isDetached`(`scope.ts:358-367`)는 `as string | undefined` cast로 비교한다.
  - `writeLedgerFile` wrapper(`scope.ts:954-955`)는 `unknown`을 받아 `as Ledger`로 넘긴다. 유일한 사용처는 `run-detach.ts:5`, `:138`이다.
- I/O 결합:
  - `defaultGit`(`run-detach.ts:33-35`)은 관찰용 HEAD를 읽을 때만 쓰고 `deps.git`로 주입할 수 있다. 시계는 `deps.now`(`:83-84`)로 주입한다.
  - ledger 읽기·쓰기, lock 파일, 포인터 삭제(`removeNamespacePointer`)는 실제 파일 시스템을 쓴다.
- 테스트:
  - `test/run-detach.test.js`의 `drive()`(`:97-120`)는 실제 bootstrap 뒤 `patchLedger`(`:87-91`)로 task를 integrated로 바꾼다.
  - 거절 표 테스트(`:203-252`)는 reason과 바이트 불변만 단언하고 `cause`·`next`는 보지 않는다.
  - integrated+reported 케이스는 없다.
  - 재현: `node --test test/run-detach.test.js`(현재 green).

#### Target behavior

- 성공:
  - task `status`가 `integrated`이면 `dispatch` 상태와 관계없이 진행 중이 아니다.
  - 모든 task가 integrated이고 dispatch `reported`만 남은 ledger는 `{ ok: true, ledger, pointer_removed: true, next }`로 detach된다.
- 실패(ledger·포인터 바이트 불변, exit 1, `{ ok: false, reason, cause, next }`):
  - integrated가 아닌 task의 dispatch `active|reported`, 또는 task status `prepared|recorded` → `detach-worker-in-flight`. `tasks` 목록은 유지한다.
  - `detach-confirmation-required`, `detach-awaiting-confirmation`, `no-ledger`, `unreadable-ledger`, `ledger-locked`도 같은 shape로 낸다.
  - 잠금 안에서 ledger를 쓰기 직전에 `owns()`가 false이면 쓰지 않고 `ledger-lock-lost`를 낸다. 포인터도 지우지 않는다.
- 쓰기 뒤 잠금 해제 실패(바이트 불변 약속의 예외):
  - `withLedgerLock`은 `run()`이 끝난 뒤 `releaseLock`이 실패해도 `ledger-lock-lost`를 낸다(`scope.ts:345`). 이때 detach는 이미 ledger를 쓰고 포인터를 지웠다. 이 공유 잠금 의미는 바꾸지 않는다.
  - detach는 이 결과에 쓰기가 끝났을 수 있다는 `cause`와 "`bouncer run detach`를 다시 실행해 `already: true`를 확인한다"는 `next`를 붙인다. 재실행은 이미 detached인 ledger에서 no-op이다.
- 보존:
  - 이미 detached인 ledger는 `already: true`로 성공하고 아무것도 바꾸지 않는다.
  - decision append 형식, 포인터 key 하나만 지우는 규칙, `run-detached` 하류 거절은 그대로다.
  - ledger JSON 저장 형식은 바뀌지 않는다.

#### Interface

- 제공:
  - `detachRun(...)`의 실패 결과 타입 `{ ok: false; reason: string; cause: string; next: string; tasks?: string[]; ledgerFile?: string }`.
  - `run-detach.ts` 모듈 상수 `DETACH_FAILURE_HINTS: Record<string, { cause: string; next: string }>`. 위 일곱 reason이 모두 키로 있다.
  - `Ledger.status`에 `'detached'`.
  - `scope.ts` export `writeLedgerFile(file: string, data: Ledger): void`. 이름은 유지하고 인자 타입만 좁힌다.
  - 테스트 seam `deps.withLock?: <T>(ledgerFile: string, run: (owns: () => boolean) => T) => T | { ok: false; reason: string }`. 기본값은 `withLedgerLock`이다. 테스트는 `run(() => false)`를 호출하는 함수를 주입해 임계 구역 안의 소유 상실을 만든다.
- 거부: 위 일곱 거절 코드. 사용법 exit 2(`--blueprint` 누락, 알 수 없는 `run` 하위 명령)는 그대로다.
- 용어:
  - "진행 중 worker"는 status가 `integrated`가 아닌 task 가운데 `dispatch.status`가 `active`·`reported`이거나 status가 `prepared`·`recorded`인 task다.
  - 예: `{ id: '001', status: 'integrated', dispatch: { status: 'reported' } }`는 진행 중이 아니고, `{ id: '002', status: 'prepared' }`는 진행 중이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/run-detach.ts` | `detachRun`, `DetachFail` | Modify | detach 판정·기록 | integrated 제외 판정, hint 표, `owns()` 확인, `Ledger` 타입 사용 | `:18-23`, `:87-143` |
| `scripts/src/lib/scope.ts` | `isDetached`, `writeLedgerFile` export | Modify | detached 판정, ledger 쓰기 wrapper | cast 제거, wrapper 인자를 `Ledger`로 | `:358-367`, `:954-955` |
| `scripts/src/lib/execution-contracts.ts` | `Ledger.status` | Modify | ledger 타입 정본 | union에 `detached` 추가 | `:88` |
| `test/run-detach.test.js` | detach 테스트 | Modify | detach 상태 전이 고정 | integrated+reported 성공, 거절 `cause`·`next`, lock-lost 테스트 | `:203-263` |

#### Constraints

- 쓰기 전에 나는 모든 실패에서 ledger 파일과 포인터 파일 바이트가 같아야 한다. 테스트는 전후 바이트를 비교한다. 쓰기 뒤 잠금 해제 실패는 Target behavior의 예외 규칙을 따른다.
- `--yes` 확인은 ledger를 읽기 전에 하는 지금 순서를 유지한다.
- coordinator 모듈을 새로 import하지 않는다(`test/dependency-boundaries.test.js`). 잠금 소유는 `owns()`로 직접 확인한다.
- hint 문구는 영어 한 문장이고 실행 가능한 다음 명령을 백틱으로 적는다(`COORDINATE_FAILURE_HINTS` 관례).

### runtime-architecture/transition-guard-followups/002 · `c868b16c`

#### Goal & intent

`bouncer coordinate revise`의 모든 거절이 다른 coordinate 명령처럼 stdout JSON `{ ok: false, reason, paths?, cause, next }`와 exit 1로 끝나게 한다. `CURRENT_WOULD_BE_AMBIGUOUS`에는 `cause`를 더한다. 수용 기준은 epic Success criteria 14이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- revise 분기(`scripts/src/lib/cli-git-commands.ts:913-962`):
  - `reviseTaskScope`가 거절하면 `io.err("coordinate revise: <reason>")`만 내고 stdout은 비운다(`:950-953`). 결과의 `paths`도 버린다.
  - ledger가 없으면 hint 없는 `{ ok:false, reason:'ledger-checkpoint-invalid' }`를 stdout에 낸다(`:930-933`).
  - fence 실패는 `JSON.stringify(fenced)`를 그대로 낸다(`:938-941`). 이때 reason은 `ledger-checkpoint-invalid`·`stale-ledger-checkpoint`·`run-detached` 중 하나다(`coordinator.ts:412-444`).
- fenced 명령 공통 검사: fence 플래그가 없으면 hint 없는 `{ ok:false, reason:'ledger-checkpoint-invalid' }`를 낸다(`cli-git-commands.ts:780-786`).
- 다른 하위 명령의 출력: export된 `coordinate`가 `coordinateWithHints`(`coordinator.ts:5458-5464`)이므로 hint가 붙는다. CLI는 `compactCoordinateOutput(command, result)`를 stdout에 내고, 실패면 exit 1이다(`cli-git-commands.ts:1065-1078`).
- hint 함수:
  - `withCoordinateFailureHints`(`coordinator.ts:5439-5450`)와 `FALLBACK_COORDINATE_NEXT`(`:4948`)는 export되지 않는다.
  - 표에 없는 reason에는 `cause: <reason>`과 fallback `next`가 붙는다.
- `reviseTaskScope` 거절 가운데 hint 표에 없는 것: `scope-paths-required`(`scope.ts:774`), `scope-path-glob`(`:777`), `scope-path-out-of-bounds`(`:781`), `task-document-missing`(`:801`, `:804`), `no-coordinator-paths`, `no-git`, `main-worktree-source-write`, `unassigned-worktree`(`:625-680`), `unreadable-ledger`(`:666`), `ledger-locked`(`:323`).
- `CURRENT_WOULD_BE_AMBIGUOUS`(`scripts/src/lib/cli-current-command.ts:140-151`)는 `{ ok, reason, candidates, next: string[] }`이고 `cause`가 없다.
- I/O 결합:
  - revise는 `process.cwd()`를 쓰기 경계로 쓴다(`cli-git-commands.ts:923`). 그래서 테스트는 `process.chdir`를 쓴다(`test/cli-coordinate.test.js:132-145`).
  - `CliIo`가 주입되므로 `runCli`로 프로세스 안에서 shape를 검사할 수 있다.
- 테스트:
  - `test/cli-coordinate.test.js:434-483`, `:1444-1450`은 revise 거절을 `buf.err`와 `buf.out === ''`로 단언한다.
  - `:866-897`, `:492-509`는 fence 거절의 `.reason`만 본다.
  - reason 완전성 테스트(`test/coordinator.test.js:166-218`)는 coordinator 모듈만 스캔한다.
  - `test/cli-current.test.js:508-537`은 AMBIGUOUS의 reason·candidates·next를 단언한다.

#### Target behavior

- 성공: revise 성공 출력(`{ ...result, checkpoint }`, exit 0)은 그대로다.
- 실패(exit 1, stdout 한 줄 JSON, ledger·task 문서 바이트 불변):
  - `reviseTaskScope`의 모든 거절, ledger 없음, fence 실패, fence 플래그 누락은 `{ ok: false, reason, cause, next }`를 낸다. 경로 거절은 `paths`도 낸다.
  - stderr에는 기존처럼 `coordinate revise: <reason>` 한 줄을 남긴다.
  - 위 hint 표 누락 reason 10종에는 fallback이 아닌 고유 `cause`·`next`가 붙는다.
- `CURRENT_WOULD_BE_AMBIGUOUS`는 `cause`(string)를 갖는다. `next`는 string 배열 그대로다.
- 보존:
  - 다른 coordinate 하위 명령의 출력과 reason 코드는 그대로다.
  - 사용법 오류는 exit 2다.
  - 같은 cwd 원장에 fence를 거는 규칙은 그대로다.

#### Interface

- 제공:
  - `coordinator.ts` export `withCoordinateFailureHints(result: unknown): unknown`.
  - revise 거절 stdout `{ ok: false, reason: string, cause: string, next: string, paths?: string[] }`.
  - `CURRENT_WOULD_BE_AMBIGUOUS` 출력에 `cause: string`.
- 거부: reason 코드 집합은 바뀌지 않는다. 출력 채널과 필드만 바뀐다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate` revise 분기, fence 누락 출력 | Modify | revise 인자 수집과 출력 | 모든 거절을 hint를 거친 stdout JSON으로 | `:780-786`, `:913-962` |
| `scripts/src/lib/coordinator.ts` | `COORDINATE_FAILURE_HINTS`, `withCoordinateFailureHints`, exports | Modify | coordinate hint 표 | 누락 scope reason 10종 등록, 함수 export | `:4953`, `:5439-5467` |
| `scripts/src/lib/cli-current-command.ts` | `CURRENT_WOULD_BE_AMBIGUOUS` 응답 | Modify | ambiguous 거절 출력 | `cause` 추가 | `:140-151` |
| `test/cli-coordinate.test.js` | revise 거절 테스트 | Modify | stderr-only 단언 | stdout JSON shape와 `paths` 단언 | `:434-483`, `:866-897`, `:1444-1450` |
| `test/coordinator.test.js` | reason 완전성 테스트 | Modify | coordinator reason 스캔 | revise 경로 reason이 fallback이 아닌지 단언 | `:166-218` |
| `test/cli-current.test.js` | AMBIGUOUS 테스트 | Modify | reason·next 단언 | `cause` 단언 | `:508-537` |

#### Constraints

- hint는 `COORDINATE_FAILURE_HINTS` 한 표에만 등록한다. 개별 return에 `cause`·`next`를 흩어 쓰지 않는다(`coordinator.ts:4950-4952` 주석 규칙).
- revise는 `--repo` 원장이 아니라 실제 cwd 원장에 fence를 거는 기존 규칙을 유지한다.
- 성공 출력과 exit code는 바꾸지 않는다.

### runtime-architecture/transition-guard-followups/003 · `e5837e06`

#### Goal & intent

`worker-commit-stamp-mismatch`·`worker-scope-dirty` 거절의 `next`가 안내하는 commit 단계를 `coordinate next`가 실제로 고르게 한다. 커밋으로 풀리지 않는 상태는 원인 코드를 그대로 드러내는 `blocked`로 낸다. 수용 기준은 epic Success criteria 15·16이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- `taskNext`(`scripts/src/lib/coordinate-next.ts:760-948`)의 판정 순서:
  - tasks.md `commit_sha`가 비었으면 `commit`(`:913-918`). `action: 'commit'`이 나오는 유일한 곳이다.
  - stamp가 있으면 `workerCommitEvidence(...)`(`:925`)를 호출하는데 `.ok`만 본다. ok이고 tasks.md만 dirty면 `report`(`:922-943`)다.
  - 그 밖에는 모두 `blocked` + `commit-evidence-mismatch`(`:945-947`)다. 그래서 낡은 stamp(`worker-commit-stamp-mismatch`)와 scope dirty(`worker-scope-dirty`)가 원인 구분 없이 같은 blocked가 된다.
- `workerCommitEvidence(exec, workerPath, blueprint, task, ledger)`(`scripts/src/lib/coordinator.ts:2148-2189`, export `:5467`):
  - 반환은 `{ ok:false, reason, head, integration_head, stamp, dirty_paths }`다.
  - reason은 `worker-commit-missing`(`:2165-2175`) → `worker-commit-stamp-mismatch`(`:2177`) → `worker-scope-dirty`(`:2181-2187`, tasks.md 제외, dispatch baseline 미면제) 순으로 판정한다.
- `coordinate advance`는 `commit`을 자동 실행한다(`scripts/src/lib/coordinate-advance.ts:54-56`). worker cwd에서 `bouncer commit --blueprint <bp> --yes`를 실행한다(`:79-89`).
- `bouncer commit --yes`의 동작:
  - 후보 경로가 없으면 `committed:false`로 끝나고 stamp를 남기지 않는다(`scripts/src/lib/commit.ts:449-460`).
  - 커밋하면 HEAD 앞 8자를 tasks.md에 stamp한다(`:493-513`).
- `detached` 비교는 `(ledger.status as string | undefined) === 'detached'` cast로 한다(`coordinate-next.ts:513`).
- I/O 결합: git 호출(rev-parse·porcelain `:854-855`, merge-base `:893`, `workerCommitEvidence` `:925`)은 모두 주입된 `ctx.exec`(`:494`, `deps.execFileSync`)를 거친다. 새 ctx 필드는 필요 없다.
- 테스트:
  - `test/coordinate-next.test.js`는 실제 git 임시 repo와 `preparedCommitDrive`(`:168`), `commitInWorker`(`:185`), `setDocStatus(... { commit_sha })`(`:194`), `commitAndStampWorker`(`:83`), `assertNoWrite`(`:214`)를 쓴다.
  - 기존 케이스: 빈 stamp → commit(`:807-823`), 일치 stamp → report(`:825-848`), tasks.md 밖 dirty → blocked(`:850-872`), baseline dirty → report(`:876-899`).
  - 낡은 stamp·scope dirty 케이스는 없다.

#### Target behavior

- 성공:
  - stamp가 있고 `workerCommitEvidence`가 `worker-scope-dirty`이면 `commit`을 고른다.
  - `worker-commit-stamp-mismatch`이고 "커밋할 scope 변경"이 있어도 `commit`을 고른다.
  - 카드·argv는 기존 commit 분기(`:913-918`)와 같다.
- 실패:
  - `worker-commit-stamp-mismatch`이고 커밋할 scope 변경이 없으면 `{ action: 'blocked', reason: 'worker-commit-stamp-mismatch' }`다. `NEXT_FAILURE_HINTS`에 `cause`·`next`를 등록한다.
  - `worker-commit-missing`과 scope 밖 dirty는 지금처럼 `blocked` + `commit-evidence-mismatch`다.
- 보존:
  - 빈 stamp → commit, 일치 stamp → report, baseline dirty → report, `reported+accepted → record`(`:810-815`) 분기는 그대로다.
  - next는 파일을 쓰지 않는다.
  - `detached` 판정은 TASKS-001의 union을 써서 cast 없이 비교하고, 결과는 같다.

#### Interface

- 제공:
  - `coordinator.ts` export `workerScopeDirtyPaths(exec, workerPath, blueprint, task): string[]`. `workerCommitEvidence` 3단계(`:2178-2186`)에서 추출한 함수로, 두 곳이 함께 쓴다.
  - `coordinate next`의 task 응답에서 위 상태일 때 `action: 'commit'`, 또는 `action: 'blocked', reason: 'worker-commit-stamp-mismatch'`.
- 거부: commit할 변경이 없는 상태에서는 `commit`을 고르지 않는다. advance가 같은 commit 단계를 반복하지 않게 하기 위해서다.
- 용어:
  - "커밋할 scope 변경"은 worker porcelain 경로 가운데 task 현재 scope(`currentScopePaths`) 안에 있고 tasks.md가 아닌 경로가 하나 이상 있는 상태다. `workerCommitEvidence`의 scope dirty 판정(`coordinator.ts:2178-2186`)과 같은 집합이고, dispatch baseline은 면제하지 않는다.
  - 예: scope `['src/']`, porcelain `['src/a.ts', '.bouncer/x.md']`이면 커밋할 변경이 있다. porcelain이 `['.bouncer/x.md']`뿐이면 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | `taskNext`, `NEXT_FAILURE_HINTS`, detached 판정 | Modify | task 다음 행동 판정 | evidence reason 기반 commit/blocked 분기, hint 등록, cast 제거 | `:85`, `:513`, `:913-947` |
| `scripts/src/lib/coordinator.ts` | `workerCommitEvidence`, exports | Modify | worker 커밋 증거 판정 | scope dirty 계산을 `workerScopeDirtyPaths`로 추출해 export. 판정 결과는 불변 | `:2148-2189`, `:5462-5467`; `porcelainPaths`(`:877`)·`currentScopePaths`(`:1707`)는 export되지 않음 |
| `test/coordinate-next.test.js` | commit 분기 테스트 | Modify | next 판정 고정 | 낡은 stamp+dirty → commit, scope dirty → commit, 낡은 stamp+clean → blocked | `:807-899` |

#### Constraints

- `workerCommitEvidence`의 reason 순서와 report·record 거절 결과는 바뀌지 않는다.
- next는 읽기 전용이다. `assertNoWrite`가 계속 통과해야 한다.
- git 호출은 `ctx.exec`만 쓴다.
- hint는 `NEXT_FAILURE_HINTS` 한 표에 등록한다.

### runtime-architecture/transition-guard-followups/004 · `093f500c`

#### Goal & intent

`coordinate revise`와 `coordinate repair`의 추적 경로 사전 검사가 입력 경로를 글자 그대로 비교하게 한다. 수용 기준은 epic Success criteria 17이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- `trackedScopeViolations(exec, integrationPath, paths, newPaths)`(`scripts/src/lib/scope.ts:729-744`):
  - 내부 `tracked(entry)`(`:735-737`)가 `exec('git', ['ls-files', '--', entry], { cwd, encoding, stdio })`를 실행하고, stdout이 비어 있지 않으면 추적 경로로 본다.
  - `newPaths`는 부모 디렉터리(`${parent}/`)를 같은 방식으로 검사한다(`:739-742`).
- 우회 경로:
  - `:!x`를 넘기면 exclude-only pathspec이 되어 다른 추적 파일 전부와 맞는다. 그래서 추적 경로로 판정된다. `:(icase)`, `:(glob)`, `:/`도 같다.
  - revise의 glob 검사(`scope.ts:449-461`)와 repair의 `sourceRepairPaths`(`coordinator.ts:670-681`)는 `:`·`(`·`!`를 막지 않는다.
- 선례: `review-snapshot.ts:30-33`이 같은 이유로 `--literal-pathspecs`를 쓴다.
- I/O 결합:
  - `exec`는 주입된다. 타입 `TrackedExec`(`scope.ts:707-710`)의 옵션에는 `env`가 없으므로, argv에 플래그를 넣는 방식이 가장 작다.
  - 호출자는 `reviseTaskScope`(`scope.ts:816-818`, 실제 `execFileSync`)와 `checkRepairIntake`(`coordinator.ts:710-723`, `deps.execFileSync`)다.
- 테스트:
  - 직접 단위 테스트는 없다.
  - 실제 git으로 검사하는 테스트: repair intake(`test/coordinator.test.js:3910-3946`, `:3966-3980`), revise(`test/commit-task.test.js:611-660`, fixture `:45-75`).
  - magic 입력 회귀 테스트는 없다.

#### Target behavior

- 실패:
  - `paths`에 `:!x`, `:(icase)src/auth/login.ts`, `:/`처럼 그 이름의 파일이 추적되지 않은 경로가 오면 `scope-path-untracked`(`paths`에 그 입력 포함)를 낸다. ledger·문서 바이트는 바뀌지 않는다.
  - `newPaths`의 부모에 magic이 섞인 경우(`:(icase)src/new.ts`)도 `scope-new-path-parent-missing`이다.
- 보존:
  - 추적 파일, 추적 파일이 있는 디렉터리, 추적 디렉터리 아래 새 경로의 판정은 지금과 같다.
  - 다른 `ls-files` 호출과 glob 검사 규칙은 바꾸지 않는다.

#### Interface

- 제공: `trackedScopeViolations`가 실행하는 argv `['--literal-pathspecs', 'ls-files', '--', entry]`. 함수 시그니처는 그대로다.
- 거부: pathspec magic 입력은 위 기존 코드로 거절한다. 새 reason은 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scope.ts` | `trackedScopeViolations` | Modify | 추적 경로 사전 검사 | `git --literal-pathspecs ls-files` 사용 | `:729-744` |
| `test/commit-task.test.js` | revise 추적 경로 테스트 | Modify | revise scope 고정 | magic 입력 → `scope-path-untracked` 회귀 | `:611-660` |
| `test/coordinator.test.js` | repair intake 테스트 | Modify | repair 경로 고정 | magic 입력 → `scope-path-untracked` 회귀 | `:3910-3946` |

#### Constraints

- 주입 seam `TrackedExec`의 타입은 넓히지 않는다.
- 추적 판정 결과의 정상 경로 동작을 기존 테스트로 보존한다.

### runtime-architecture/transition-guard-followups/005 · `facf354b`

#### Goal & intent

`salvageRevokedWorker`와 `cmdCurrent`의 중복 계산을 없앤다. 관찰 가능한 동작은 바꾸지 않는다. 수용 기준은 epic Success criteria 18이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- F7 (`scripts/src/lib/coordinator.ts`):
  - head를 두 번 읽는다. `salvageRevokedWorker`(`:2378`)가 `:2384`에서 `rev-parse HEAD`를 읽고, 호출자가 `:2743`에서 다시 읽는다. `SalvageResult`에 `head`가 없기 때문이다.
  - generation도 `:2386`과 호출자 `:2740-2741`에서 같은 식으로 두 번 계산한다.
  - liveHead 즉시 계산(`:2726`, `:3319`)과 porcelain 파싱 중복(`:2390-2419`)은 이 task 범위 밖이다. 앞의 것은 바꾸면 실패 경로가 달라지고, 뒤의 것은 `porcelainPaths`(`:877-893`)와 의미가 다르다.
  - 호출자는 prepare 단계 loop(`:2731`) 하나뿐이다. loop 뒤에 `removeRevokedWorker`(`:2746`)가 실행된다.
- F8 (`scripts/src/lib/cli-current-command.ts`):
  - `baseNamespaceKeys`(`:259`)는 `listNamespacePointers`를 호출한다(`current.ts:343`).
  - `:261-262`가 같은 목록을 다시 읽고, `:338-339`가 `pointerExisted` 판정을 위해 또 읽는다.
  - 두 읽기 사이(`:276-336`)에는 포인터를 바꾸는 코드가 없다. 첫 쓰기는 `writeCurrent`(`:347`)다.
  - `baseKeys`는 `--replace`이거나 base checkout이 아니면 null이다(`:259`, `current.ts:342`).
- I/O 결합:
  - salvage의 git spawn(rev-parse, status, diff, rev-list, update-ref)과 patch 파일 쓰기(`:2448-2449`)는 `exec`로 주입된다.
  - 포인터 읽기는 실제 파일 시스템을 쓴다.
- 테스트:
  - salvage: `test/coordinator.test.js`의 `salvageFixture`(`:2799`)와 dirty patch·commit ref·clean·ref 실패·같은 ref·충돌 ref·g0/g1 이름 케이스(`:2700-2925`).
  - current: `test/cli-current.test.js:521-565`, `:670`, `:930-942`와 `test/current.test.js`.

#### Target behavior

- 보존(판정 기준): 위 테스트들이 수정 없이 통과한다. salvage 산출물 이름·내용·ledger decision, `current --set` 출력과 포인터 파일 바이트가 같다.
- 변경:
  - `SalvageResult`가 `head`와 `generation`을 담고, 호출자는 다시 계산하지 않는다.
  - `cmdCurrent`는 `baseKeys`가 non-null이면 `pointerExisted = baseKeys.includes(targetKey)`로 판정한다. null일 때만 지금처럼 다시 읽는다.
- 동작 변경 없음: 산출물 확인 기준은 `rg -n "rev-parse', 'HEAD'" scripts/src/lib/coordinator.ts`에서 salvage 호출자(`:2743`) 행이 사라지는 것이다.

#### Interface

- 제공: 내부 타입 `SalvageResult`에 `head: string`, `generation: number`. 공개 CLI·export 변경은 없다.
- 거부: 해당 없음. 거절 코드와 입력 처리는 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `salvageRevokedWorker`, prepare 호출자 | Modify | revoke worker 보존 | 결과에 head·generation 포함, 호출자 재계산 제거 | `:2378-2470`, `:2731-2746` |
| `scripts/src/lib/cli-current-command.ts` | `cmdCurrent` | Modify | 포인터 설정 | `baseKeys` 재사용 | `:259-262`, `:337-339` |

#### Constraints

- epic 064/002의 namespace 포인터 규칙과 `--replace`·`--keep-others` 동작을 바꾸지 않는다.
- liveHead 지연 계산과 porcelain 파싱 통합은 하지 않는다(blueprint Out of scope).
- 리팩터 전후로 같은 테스트 명령이 green이어야 한다.

### runtime-architecture/transition-guard-followups/006 · `2994ed5d`

#### Goal & intent

사용자가 승인한 위험 수용을 `bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes`로 기록한다. 이 명령은 blueprint 최종 리뷰의 open finding을 round 추가 없이 닫고, 그 결과 문서는 G21을 통과한다. 수용 기준은 epic Success criteria 19이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- 최종 리뷰 흐름:
  - blocked finding은 `status: open`, 문서는 `requested`로 남는다. `next`는 `final-review-blocked`를 내고 사용자 결정을 기다린다(`scripts/src/lib/coordinate-next.ts:696-711`, `references/coordinator-cards/final_review.md:59-66`).
  - `final-review-blocked`의 `next` 문구는 이미 "accepted-risk consent"를 언급한다(`coordinate-next.ts:98-102`).
  - 문서가 `accepted`가 되면 그 분기를 건너뛰고 `action: 'done'`이다(`:731-733`).
- 기록 경로의 제약(`scripts/src/lib/review-record.ts`):
  - `recordReview`만 있다. blueprint scope의 delta round는 `final-review-single-round`로 거절한다(`:301-307`).
  - round 번호는 기존 개수+1이어야 한다(`:330-337`).
  - 그래서 위험 수용만 기록하는 경로가 없다.
- 공통 요소(`review-record.ts`):
  - `fail(reason, cause, next)`(`:50-52`)
  - `isBlueprintReviewScopeAt`(`:67-79`)
  - 대상 경로·`review-target-missing`(`:311-327`)
  - `collectFindingFailures(...)` 사전 검증 → `review-ledger-invalid`(`:363-384`)
  - temp+rename 쓰기(`:386-401`)
  - export는 `{ recordReview }`(`:417`)뿐이다.
- G21 판정(`scripts/src/lib/validate-sections.ts`):
  - status enum `['resolved','accepted','deferred','open']`(`:48`). `accepted`·`deferred`는 note가 필요하다(`:50`, `:481-487`). accepted 문서에 open finding이 있으면 실패한다(`:492-494`).
  - `accepted_risk: true`는 context namespace에서만 인정한다(`:531-540`). blueprint 예외는 `deferred`뿐이다(`:543`).
  - 그래서 blueprint `must_fix`를 `accepted`로 두면 "accepted with open must_fix"(`:544-547`)로 실패한다.
- CLI(`scripts/src/lib/cli-review-command.ts`):
  - `parseReviewRecordArgs`는 `rest[0] !== 'record'`를 거절한다(`:157-201`, `:165`). 사용법 오류는 exit 2다.
  - `cmdReview`(`:211-234`)는 결과 JSON을 stdout에 내고 exit 0/1을 돌려준다.
  - `USAGE_BLOCK`(`:15-17`)은 최상위 help에 실린다(`cli.ts:89`).
- 선례: context review의 명시적 `--accept-risk <id>`(`scripts/src/lib/context-review-state.ts:896-925`).
- I/O 결합: blueprint-root `review.md` 한 파일만 읽고 쓴다. ledger와 git은 쓰지 않는다. 시계 주입은 필요 없다.
- 테스트:
  - `test/review-record.test.js`의 `makeFixture`(`:72-144`), `recordCli`(`:146-152`), `assertRejectedUntouched`(`:154-162`). blueprint deferred·open 케이스는 `:209-243`에 있다.
  - `test/validate-gates.test.js:601-621`(G18 accepted_risk 통과, G14 accepted_risk 거절)
  - `test/cli-help.test.js:204-231`(review usage)
  - `test/coordinator.test.js:1810-1823`(`final_review.md` 문구 regex)

#### Target behavior

- 성공(exit 0, stdout `{ ok: true, path, finding, status, open_remaining }`):
  - 대상 finding이 `status: accepted`, `accepted_risk: true`, `note: <text>`가 된다.
  - `bouncer.review.rounds`와 다른 finding은 바이트 단위로 같다.
  - 남은 open finding이 0이면 문서 `bouncer.status`가 `accepted`가 된다. 1개 이상이면 기존 status를 유지한다.
- 실패(exit 1, `{ ok: false, reason, cause, next }`, `review.md` 바이트 불변, `.tmp` 잔여 없음):
  - `--yes` 없음 → `review-accept-risk-confirmation-required`. 파일을 읽기 전에 거절한다.
  - blueprint `review_scope`가 아님 → `review-accept-risk-task-scope`.
  - `review.md` 없음 → `review-target-missing`.
  - finding id 없음 → `review-finding-missing`.
  - finding status가 `open`이 아님 → `review-finding-not-open`.
  - `--note`가 공백뿐 → `review-note-required`.
  - 결과가 G21 사전 검증에 실패 → `review-ledger-invalid`.
- 사용법 exit 2: `accept-risk`·`record` 외 동사, `--blueprint`·`--finding`·`--note` 누락이나 중복, `--task` 지정.
- G21 변경: `roundScope === 'blueprint'`이고 `status === 'accepted'`, `accepted_risk === true`, note가 비어 있지 않은 `must_fix`는 닫힌 finding으로 본다.
- 보존:
  - task 리뷰(G14)는 `accepted_risk`를 계속 인정하지 않는다(`test/validate-gates.test.js:616-621` 유지).
  - `review record` 동작과 `final-review-single-round` 규칙은 그대로다.
- 문서: `final_review.md`·`review-round.md`의 blocked 경로에 "사용자가 명시적으로 위험 수용을 승인한 뒤에만 `bouncer review accept-risk ... --yes`"를 적는다.

#### Interface

- 제공:
  - CLI `bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes`
  - `review-record.ts` export `acceptReviewRisk({ repoRoot, blueprintDir, finding, note, yes }) → { ok: true, path, finding, status, open_remaining } | { ok: false, reason, cause, next }`
- 거부: 위 일곱 거절 코드와 사용법 exit 2.
- 용어:
  - "open finding"은 `bouncer.review.findings[]`에서 `status === 'open'`인 항목이다.
  - 예: `{ id: 'F1', actionability: 'must_fix', status: 'open' }`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-record.ts` | `acceptReviewRisk`(신규), exports | Modify | review round 기록 | 위험 수용 기록 함수 추가, 기존 parse·검증·쓰기 helper 재사용 | `:50-79`, `:311-417` |
| `scripts/src/lib/cli-review-command.ts` | `parseReviewRecordArgs`, `cmdReview`, `USAGE_BLOCK` | Modify | review argv·출력 | `accept-risk` 동사 파싱·usage | `:15-17`, `:157-234` |
| `scripts/src/lib/validate-sections.ts` | must_fix accepted 판정 | Modify | G14·G18·G21 finding 검사 | blueprint scope `accepted_risk` 예외 | `:531-547` |
| `references/coordinator-cards/final_review.md` | blocked 경로·status 표 | Modify | 최종 리뷰 card | accept-risk 사용 조건 추가 | `:59-66`, `:103-115` |
| `skills/bouncer-run/references/review-round.md` | final review blocked 절 | Modify | 리뷰 round 규칙 | accept-risk 경로 추가 | `:68-77` |
| `test/review-record.test.js` | accept-risk 테스트 | Modify | review record 고정 | 성공·거절 7종·round 불변 | `:72-243` |
| `test/validate-gates.test.js` | G21 accepted_risk 테스트 | Modify | gate finding 판정 | blueprint G21 통과, G14 거절 유지 | `:601-621` |
| `test/cli-help.test.js` | review usage | Modify | help 고정 | `review accept-risk` usage와 exit 2 | `:204-231` |

#### Constraints

- 사용자 승인 경계: `--yes`가 없으면 파일을 읽지도 쓰지도 않는다. 문서는 이 명령을 사용자의 명시적 승인 뒤에만 실행하라고 적는다(AGENTS.md hard rule 3).
- round를 추가하거나 바꾸지 않는다.
- 쓰기는 `recordReview`와 같은 temp+rename이고, `collectFindingFailures` 검증을 통과한 뒤에만 한다.
- `final_review.md` 문구를 바꿔도 `test/coordinator.test.js:1810-1823` regex가 계속 맞아야 한다.

### runtime-architecture/transition-guard-followups/007 · `b7fa510f`

#### Goal & intent

`rules/cli.md`와 `CHANGELOG.md`를 TASKS-001–006이 통합한 동작에 맞춘다. 수용 기준은 epic Success criteria 20이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- `run detach` 절(`rules/cli.md:46-66`):
  - 진행 중 정의를 "dispatch `active`/`reported` 또는 status `prepared`/`recorded`"로 적는다(`:57-58`).
  - 거절 목록에 `cause`·`next` 언급이 없고, `ledger-locked`·`ledger-lock-lost`가 없다.
- `coordinate revise` 절(`:137`, `:257-275`)에는 거절 출력 채널이 적혀 있지 않다. 코드는 stderr로 낸다.
- `CURRENT_WOULD_BE_AMBIGUOUS` 설명(`:196`)에는 `cause`가 없다.
- `review record` 절(`:376-391`)이 review 하위 명령의 전부다. `accept-risk`가 없다.
- `CHANGELOG.md`의 `## [Unreleased]`(`:8`)는 비어 있다. 기존 항목 형식은 굵은 제목 `(EPIC <id> BP <id>)` + 한국어 서술이다(`:12-18`).
- 재현: `rg -nF "accept-risk" rules/cli.md`가 0줄이다.

#### Target behavior

- `rules/cli.md`:
  - detach 진행 중 정의가 "status `integrated`가 아닌 task"로 한정된다.
  - detach 거절은 `cause`·`next`를 갖고 `ledger-locked`·`ledger-lock-lost`가 목록에 있다.
  - revise 거절은 stdout JSON `{ ok:false, reason, paths?, cause, next }`, exit 1이다.
  - `CURRENT_WOULD_BE_AMBIGUOUS`는 `cause`를 갖는다.
  - `coordinate next`는 커밋할 scope 변경이 있으면 `commit`을, 깨끗한 tree의 낡은 stamp면 `worker-commit-stamp-mismatch` blocked를 낸다.
  - revise·repair의 추적 경로 검사는 literal pathspec이다.
  - `review accept-risk`의 사용법, 성공 shape, 거절 코드 7종, 사용자 승인 전제, round 불변을 적는다.
- `CHANGELOG.md` `[Unreleased]`에 `### Fixed`(detach·revise·next·pathspec)와 `### Added`(`review accept-risk`) 항목을 `(EPIC 112 BP 002)` 형식으로 적는다.
- 판정: `npm run lint:docs` 통과. 새 코드는 `rg -F` 확인 대상이다: `review-accept-risk-confirmation-required`, `review-finding-missing`, `review-finding-not-open`, `review-note-required`, `review-accept-risk-task-scope`, `ledger-lock-lost`.

#### Interface

- 제공: 문서 계약만 바뀐다. 코드 인터페이스는 TASKS-001–006이 정한다.
- 거부: 해당 없음. 문서 task다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | run detach·coordinate revise·current·next·review 절 | Modify | CLI 계약 정본 | 위 계약 반영 | `:46-66`, `:137`, `:196`, `:257-275`, `:376-391` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Fixed·Added 항목 | `:8-18` |

#### Constraints

- 문서 문구는 통합된 코드의 reason 문자열과 정확히 같아야 한다. integration HEAD의 `scripts/src/lib/`에서 `rg`로 확인한 뒤 적는다.
- CHANGELOG는 Keep a Changelog 형식과 기존 한국어 서술 관례를 따른다.

### runtime-architecture/transition-guard-followups/008

#### Goal & intent

TASKS-001–007이 모두 integrated된 integration HEAD에서 `npm run ci`가 exit 0으로 끝나는지 증명한다. 수용 기준은 epic Success criteria 20이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### runtime-architecture/transition-guard-followups/009 · `14a444d6`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/cli-git-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/coordinate-next.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/review-record.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/run-detach.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/scope.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.