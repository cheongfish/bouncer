---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/002-coordinator-next-action/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-07T10:57:53.228+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '088'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 9cf98b6e4ff915352b3566708f588ca7e7cee8e6
      range_to: 0f491b08b0999baa32f1b9cc1ccb1b106ad538dd
      diff_sha: 4d398f2535d5fdfa9971f8547e7099103723284bfd27deebdaebb00401c84217
      recorded_at: '2026-10-07T11:07:42+09:00'
  task_commits:
    - task: EPIC-088/BP-002/TASK-001
      sha: 618db006
      intent_anchor: task-001
    - task: EPIC-088/BP-002/TASK-002
      sha: 0ae5ac31
      intent_anchor: task-002
    - task: EPIC-088/BP-002/TASK-003
      sha: 0f491b08
      intent_anchor: task-003
---
# Explain

## Background
coordinator는 원장과 worker 문서를 읽어 다음 `coordinate` mutation을 스스로 골랐다. 세션이 길수록 그 판정이 프롬프트에 다시 들어가고, `--help`를 보려면 소스를 열어야 했다. 이 변경은 읽기 전용 `bouncer coordinate next`가 그 한 행동을 고르고 fence·lease·attempt·hash를 채운 `argv`를 돌려주게 한다. coordinator는 `argv`를 실행하고 `judge`가 있는 항목만 판단한다. `coordinate status`와 같이 integration worktree에서 호출하고 fence 플래그를 받지 않는다. 원장 스키마와 기존 mutation 동작은 그대로다.

## Intuition
다음 한 걸음은 coordinator가 계산하지 않고 `next`가 `argv`로 내놓는다.

## Code
- `scripts/src/lib/coordinate-next.ts` — `coordinateNext`. blueprint 표는 `prepare`·`drive_tasks`·`integrate`·`verification_node`·`final_review`·`done`·`blocked`. task 표는 `dispatch`·`implement`·`verify`·`review`·`commit`·`report`·`record`·`revise`·`none`·`blocked`. `fenceArgs`/`leaseArgs`가 mutation argv를 채운다. verification `--task`는 `verification-task-uses-blueprint-next`.
- `scripts/src/lib/cli-git-commands.ts` — `COORDINATE_USAGE_BLOCKS.next`. `--help`는 플래그·action·응답 필드를 출력한다. 값 없는 `--task`는 usage(2)이고 blueprint next로 떨어지지 않는다.
- `scripts/src/lib/coordinator.ts` — `export =`에 `coordinateNext`·`NEXT_FAILURE_HINTS`를 더한다. 기존 함수 본문은 그대로다.
- `agents/bouncer-coordinator.md` — Procedure가 `coordinate next`를 호출하고 돌려받은 `argv`를 실행하는 루프다. Integrate는 fence·lease를 조립하지 않는다.

## Quiz
1. `bouncer coordinate next`의 fence 플래그 처리는?
   - A) `--ledger-path`와 `--ledger-hash`가 필수이고 없으면 exit 2
   - B) `coordinate status`처럼 fence를 받지 않고, 주어져도 원장을 잠그거나 쓰지 않는다
   - C) 성공하면 원장 `status`를 `next`로 갱신한다
2. `coordinate next --blueprint <dir> --task`처럼 값 없는 `--task`는?
   - A) usage와 exit 2이고 blueprint 범위 next로 떨어지지 않는다
   - B) `--task` 생략으로 보고 blueprint next를 실행한다
   - C) `ok: false`, reason `task-required`, exit 1
3. `--task`가 verification task id일 때 `next`의 응답은?
   - A) `action: verification_node`와 `integrate` argv
   - B) `action: none`, reason은 task status
   - C) `ok: false`, reason `verification-task-uses-blueprint-next` (blueprint 범위로 다시 호출)
4. dispatch가 `reported`이고 outcome이 `scope_revision`인데 현재 brief hash가 보고 때와 다르면?
   - A) `commit-evidence-mismatch`로 blocked
   - B) `action: dispatch`로 재디스패치한다
   - C) hash와 상관없이 `revise` argv를 돌려준다
5. coordinator가 `coordinate next`의 `argv`를 받은 뒤 하는 일은?
   - A) 그 `argv`를 응답 `cwd`에서 실행하고, `judge`가 있는 항목만 판단한다
   - B) 원장과 worker 문서를 다시 읽어 다음 mutation을 직접 고른다
   - C) Procedure Integrate에서 `--ledger-path`와 `--lease-id`를 조립한다
6. 성공한 `next` JSON 최상위에 `tasks`·`decisions` 키가 없는 이유는?
   - A) 원장 `tasks` 배열을 최상위 `tasks`로 그대로 내보낸다
   - B) `decisions`만 최상위에 두고 `tasks`는 숨긴다
   - C) 기존 `compactCoordinateOutput`을 거치므로 그 두 키를 쓰지 않는다

## Tasks

### EPIC-088/BP-002/TASK-001 · `618db006`

#### Goal & intent

`bouncer coordinate next --blueprint <dir> [--task <NNN>]`를 추가한다. 원장 bytes와 worktree를 바꾸지 않고 blueprint Contract의 action 하나와 fence·lease를 채운 `argv`를 돌려준다. 완료 조건은 epic Success criteria 6~8과 아래 Checklist이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 원장 읽기:
  - `coordinate()`(`scripts/src/lib/coordinator.ts:2199`)는 모든 명령에서 `runtimePaths`(`:2218`), `git rev-parse HEAD`(`:2220`), `coordinatorPathsFor`(`:2221`)를 거친다.
  - bootstrap이 아니면 `registeredIntegration`(`:2286`)을 본다.
  - `status`(`:2290-2301`)는 잠금 없이 `loadLedgerBytes`(`:341`) → `assertLeaseShape`(`:1035`) → `ensureIntegrationCwd`(`:1458`, integration cwd가 아니면 throw) → `projectCheckpoint`(`:463`) 순서로 응답한다.
- checkpoint의 `active_tasks`(`projectActiveTask`, `:437`)에는 `lease`와 `execution_kind`가 없다. lease id·generation은 원장 원본에서만 얻는다.
- 공개 export(`:3067-3070`): readyWave, transition, coordinate(hint 래핑), loadLedger, loadLedgerBytes, readBouncerBlock, projectCheckpoint, assertLedgerFence, LEDGER_REL, COORDINATE_FAILURE_HINTS.
- `next`에 필요하지만 export되지 않은 함수: `registeredIntegration`(`:1012`), `registeredWorker`(`:997`), `ensureIntegrationCwd`(`:1458`), `assertLeaseShape`(`:1035`), `isBlueprintReviewModeAt`(`:855`), `initialWorktreeState`(`:548`), `taskBriefHashOf`(`:532`), `normalizeCommitSha`, `git`(`:519`).
- worker 문서 경로는 `path.join(workerPath, blueprint, 'tasks', taskId, name)`이다(`:938`, `:533-535`).
- 종단 증적(`:830-845`): `tasks.md`=`verified`, `verification.md`=`passed`, `review.md`=`accepted`. integration index가 `review_scope: blueprint`이면 `review.md`는 빠진다.
- `commit_sha`는 SHA 앞 8자와 비교한다(`:943-945`).
- `bouncer commit --yes`(`scripts/src/lib/commit.ts:287`):
  - commit 뒤 그 task `tasks.md`에 `bouncer.commit_sha`(8자)만 쓴다(`:452-470`). status는 바꾸지 않는다.
  - coordinator 활성 시 `recordActualPaths`로 원장도 쓴다(`:478-490`). 그래서 commit 직후 worker porcelain에는 `tasks.md`가 남고 원장 hash가 바뀐다.
  - drive에서 `nextAction`은 `return-to-coordinator`다(`:218-237`).
- verification node는 `coordinate integrate --task <NNN>`으로 실행된다(`integrateTask` `:1472` → `integrateVerificationTask` `:1530`).
  - 상태 전이: verification은 `pending → ready → verifying → integrated`, commit은 `pending → ready → prepared → recorded → integrated`다(`:320-322`).
  - 실패하면 `terminalFailure`(`:1624`)를 남긴다. repair가 2회이면 `status: awaiting_confirmation`과 `NEXT_PLAN.md`(`:1625-1632`)를 남긴다.
  - fan-in 진행 상태는 `ledger.fanin`(`:94-104`, 재개 `:1800-1830`)에 있다.
- `record`(`:2692-2724`)는 원장 `prepared`, `dispatch.status: reported`, outcome `accepted`, brief hash 일치를 요구하고 worker HEAD를 기록한다. CLI는 `--decision`을 decision으로 넘긴다(`scripts/src/lib/cli-git-commands.ts:682-683`).
- 실패 hint 표는 `COORDINATE_FAILURE_HINTS`(`:2766`), fallback 문구는 `:2761-2762`다. `withCoordinateFailureHints`(`:3044-3056`)가 붙인다.
- CLI(`scripts/src/lib/cli-git-commands.ts`):
  - `COORDINATE_COMMANDS`(`:301-304`)는 14개다.
  - 알 수 없는 명령 오류 문구(`:566-571`)는 `… partial-close, critical-recovery, or revoke`로 끝난다.
  - `COORDINATE_USAGE_BLOCKS`(`:334-477`)는 명령 목록으로 타입이 걸려 있다. `COORDINATE_REGISTRY_ORDER`는 `:480-483`이다.
  - fence 대상 집합(`:562-565`)이 따로 있다. 출력은 `compactCoordinateOutput`(`scripts/src/lib/coordinate-output.ts:30-42`)을 거치며, 성공 응답의 `tasks`·`decisions` 키를 지운다.
- I/O 결합 지점:
  - 프로세스: git은 주입된 `exec`(`deps.execFileSync`, `coordinator.ts:2215`)로 부른다.
  - 파일: `loadLedgerBytes`, `readBouncerBlock`(`:889`), `isBlueprintReviewModeAt`, `taskBriefHashOf`는 node `fs`를 직접 읽는다.
  - 모듈 상태: `coordinatorPathsFor`(`runtime-state.ts:1035-1040`)는 exec seam 없이 실제 git을 쓴다.
- 기존 테스트 도구:
  - `test/coordinator.test.js`: `__fence`·`coordinate`(`:19-42`), `acceptDispatchReport`(`:59-73`), `writeBundle`(`:1101-1115`), `recordedDrive`(`:1118`), `preparedCommitDrive`(`:1367`), `twoRecordedWave`(`:2238`), `passVerify`(`:2289`), `writeReviewScope`(`:2644`).
  - `test/coordinator-e2e.test.js`: `makeRepo`(`:110`), `commitInWorker`(`:151`), `writeTerminalEvidence`(`:169`).
  - `test/cli-coordinate.test.js`: `coordinateCli`(`:132-151`).
- 서브커맨드 추가로 깨지는 단언:
  - `test/cli-help.test.js:278-295`의 `COORDINATE_SUBCOMMANDS` 목록과 `:303-309`의 usage 일치.
  - `test/cli-coordinate.test.js:470-480`, `:~530`의 `/critical-recovery, or revoke/`.
  - `test/distribution.test.js:124-137`의 배포 export 목록.
- `test/coordinator.test.js:75-79`는 `coordinator.ts`의 `reason: '…'` 리터럴마다 hint가 있는지 본다.

#### Target behavior

- 성공 경로. 공통 규칙:
  - `next`는 `status`와 같은 순서로 원장을 읽는다. 잠금, 원장 쓰기, worktree 쓰기는 하지 않는다.
  - 응답 `checkpoint.ledger`와 `argv`의 `--ledger-path`·`--ledger-hash`는 그 읽기 bytes의 값이다.
  - 아래 표의 `argv`에서 `bouncer coordinate <sub>` 뒤에는 항상 `--blueprint <dir>`과 fence 쌍이 붙는다. task 대상 명령에는 `--task <NNN>`과 원장 `lease`의 `--lease-id`·`--generation`도 붙는다.
- blueprint 범위. 위에서부터 처음 맞는 행을 쓴다.

  | 조건 | action | argv / 필드 |
  | --- | --- | --- |
  | 원장 `status: partial_closed` | `blocked` | reason `partial-closed` |
  | 원장 `status: awaiting_confirmation` | `blocked` | reason `repair-wave-limit`과 그 hint |
  | `terminalFailure`가 있고 해당 verification task가 `verifying` | `blocked` | reason `terminal-verification-failed`, hint에 `coordinate repair` 안내 |
  | `fanin`이 null이 아님 | `integrate` | `bouncer coordinate integrate` |
  | `prepared` commit task가 하나라도 있음 | `drive_tasks` | `task_ids`: `prepared` task id들 |
  | `recorded` task가 있고 `prepared`가 없음 | `integrate` | `bouncer coordinate integrate` |
  | checkpoint `ready`에 verification task가 있음 | `verification_node` | `bouncer coordinate integrate --task <NNN>`, cwd integration |
  | checkpoint `ready`가 비어 있지 않음 | `prepare` | `bouncer coordinate prepare` |
  | 모든 task `integrated`, blueprint 리뷰 모드, 루트 `review.md`가 `accepted` 아님 | `final_review` | `bouncer review-dispatch execute --blueprint <dir> --base <원장 base> --head <integrationHead>`, judge `review-round` |
  | 모든 task `integrated` | `done` | 없음 |
  | 그 밖 | `blocked` | reason `no-ready-task` |

- task 범위. 원장 `prepared` commit task에 위에서부터 처음 맞는 행을 쓴다. cwd는 그 task의 worker다.

  | 조건 | action | argv / 필드 |
  | --- | --- | --- |
  | `criticalRecovery.outcome === null` | `blocked` | reason `critical-recovery-open` |
  | dispatch 없음 | `dispatch` | `bouncer coordinate dispatch`, judge `intent-symbols` |
  | dispatch `reported`, outcome `accepted` | `record` | `bouncer coordinate record`, judge `record-decision`(`--decision`) |
  | dispatch `reported`, outcome `scope_revision`이고 brief hash가 보고 때와 같음 | `revise` | `bouncer coordinate revise`, judge `scope-revision`(`--paths`, `--reason`) |
  | dispatch `reported`, outcome `blocked` | `blocked` | reason `task-reported-blocked` |
  | dispatch `reported`, 그 밖 outcome | `dispatch` | `bouncer coordinate dispatch`, judge `intent-symbols` |
  | dispatch `active`, worker HEAD = `base_head`, porcelain = `initial_worktree_state` | `implement` | argv 없음. `payload`: attempt, task_brief_hash, base_head, initial_worktree_state, 있으면 previous_outcome |
  | dispatch `active`, `tasks.md`가 `verified` 아님 또는 `verification.md`가 `passed` 아님 | `verify` | `bouncer validate --blueprint <dir> --gate execute` |
  | per-task 리뷰 모드, `review.md`가 `accepted` 아님 | `review` | `bouncer review-dispatch execute --blueprint <dir> --task <NNN> --base <merge-base> --head <worker HEAD>`, judge `review-round` |
  | `commit_sha` 없음 | `commit` | `bouncer commit --blueprint <dir> --yes` |
  | `commit_sha` = worker HEAD 앞 8자, 그 task `tasks.md` 밖이 clean | `report` | `bouncer coordinate report --attempt <n> --task-brief-hash <h>`, judge `report-outcome`(`--outcome`, `--summary`, allowed `accepted|rework|scope_revision|task_change|blocked`) |
  | 그 밖 | `blocked` | reason `commit-evidence-mismatch` |

  원장 `recorded`·`integrated`·`pending`·`ready`인 task는 `none`과 그 상태를 돌려준다.
- 실패 경로:
  - integration worktree가 아님, 원장 없음, lease shape 손상: `status`와 같은 reason으로 `ok: false`, exit 1.
  - `--task` 형식 오류나 blueprint 밖 task: `task-required`·`task-outside-blueprint`, exit 1.
  - verification task를 `--task`로 부름: `verification-task-uses-blueprint-next`, exit 1.
  - `--blueprint` 없음: usage, exit 2.
  - 모든 `ok: false`와 `blocked`에는 `cause`·`next`가 붙는다.
- 보존: 기존 14개 서브커맨드의 동작, reason, 출력 JSON, fence 대상 집합은 바뀌지 않는다. 전역 `bouncer --help`의 coordinate 줄에는 `next` 한 줄만 늘어난다.

#### Interface

- 제공:
  - `scripts/src/lib/coordinate-next.ts`의 `coordinateNext(opts)`:
    - opts는 `{ repoRoot: string; blueprint: string; cwd: string; task?: string; deps?: { execFileSync?: Exec } }`다.
    - 돌려주는 값은 blueprint Contract의 `NextResult`이거나 `{ ok: false; reason; cause; next }`다.
  - `NEXT_FAILURE_HINTS: Record<string, { cause: string; next: string }>`: `next`가 새로 내는 reason별 문구다. `partial-closed`, `terminal-verification-failed`, `no-ready-task`, `critical-recovery-open`, `task-reported-blocked`, `commit-evidence-mismatch`, `verification-task-uses-blueprint-next`를 담는다. 기존 reason은 `COORDINATE_FAILURE_HINTS`를 쓴다.
  - `bouncer coordinate next --blueprint <dir> [--task <NNN>] [--repo <dir>]`와 `coordinate next --help`.
  - `coordinator.ts` export 추가: `registeredIntegration`, `registeredWorker`, `ensureIntegrationCwd`, `assertLeaseShape`, `isBlueprintReviewModeAt`, `initialWorktreeState`, `taskBriefHashOf`, `normalizeCommitSha`. 함수 본문은 바꾸지 않는다.
- 거부:
  - `--ledger-path`·`--ledger-hash`를 요구하지 않는다. 주어지면 무시한다.
  - 판정할 수 없는 근거 조합에는 추측한 action 대신 `blocked`를 돌려준다.
  - 즉시 오류(`ok: false`)와 `blocked` 결정은 구분한다. 앞의 것은 exit 1, 뒤의 것은 `ok: true`와 exit 0이다.
- 테스트 seam: git 조회는 `deps.execFileSync(file, args, opts) → string | Buffer`로 주입한다. 쓰기 부재 단언은 원장 파일 bytes 비교와 `git status --porcelain` 비교로 한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | 신규 추출 지점: 행동 판정 | Create | 없음 | `coordinateNext`, `NEXT_FAILURE_HINTS` | Interface |
| `scripts/src/lib/coordinator.ts` | `export =` | Modify | 공개 helper 목록 | 판정에 필요한 helper 8개 export 추가 | `next`가 같은 규칙을 다시 쓰지 않게 함 |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_COMMANDS`, `COORDINATE_USAGE_BLOCKS`, `COORDINATE_REGISTRY_ORDER`, `cmdCoordinate` | Modify | coordinate 서브커맨드 해석 | `next` 등록, 도움말, fence 없이 `coordinateNext` 호출, 오류 문구에 `next` 추가 | 서브커맨드 진입점 |
| `test/coordinate-next.test.js` | 신규 | Create | 없음 | 표의 행별 단위 테스트, 쓰기 부재, fixture 주행 두 개 | Success criteria 7·8 |
| `test/cli-help.test.js` | `COORDINATE_SUBCOMMANDS` | Modify | 서브커맨드 도움말 단언 | `next` 추가 | 목록 단언 |
| `test/cli-coordinate.test.js` | 알 수 없는 명령 단언(`:470-480`, `:~530`) | Modify | 오류 문구 고정 | 바뀐 문구로 갱신, `next` CLI exit code 단언 추가 | 오류 문구 변경 |
| `test/distribution.test.js` | coordinator export 단언(`:124-137`) | Modify | 배포 export 고정 | 추가 export 반영 | export 변경 |
| `CHANGELOG.md` | `[Unreleased]` `### Added` | Modify | 미출시 변경 목록 | `coordinate next` 항목 | epic Success criteria 6 |

#### Constraints

- `coordinator.ts`에서는 `export =` 목록만 바꾼다. 기존 함수 본문, reason 문자열, `COORDINATE_FAILURE_HINTS`는 그대로 둔다.
- 판정 규칙은 기존 함수를 재사용한다: 증적 상태는 `readBouncerBlock`, 리뷰 모드는 `isBlueprintReviewModeAt`, SHA 비교는 `normalizeCommitSha`, brief hash는 `taskBriefHashOf`, porcelain은 `initialWorktreeState`.
- 응답 최상위에 `tasks`·`decisions` 키를 두지 않는다.
- 새 함수에는 저장소 규칙대로 한국어 docstring(Summary, Args, Returns)을 단다(`references/implementation/index.md`).
- `scripts/lib`는 빌드 산출물이라 커밋하지 않는다(`npm run check:emit`).

### EPIC-088/BP-002/TASK-002 · `0ae5ac31`

#### Goal & intent

coordinator Procedure의 각 단계가 `bouncer coordinate next`를 부르고, 돌려받은 `argv`를 실행하고, `judge` 항목만 판단하게 한다. 지금 Procedure에 없는 commit 단계(`bouncer commit --blueprint <dir> --yes`, worker cwd)를 report·record 앞에 명시한다. 완료 조건은 epic Success criteria 9와 아래 Checklist이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `agents/bouncer-coordinator.md`는 328줄이다. H2 순서는 Authority(16), Hard guards(44), Worker dispatch(118), Task round(196), Procedure(226), Output contract(310)다.
- Procedure 1 Ground(228-241)는 `coordinate status`의 checkpoint를 유일한 상태로 삼는다. fence 값을 들고 다니며 성공 응답마다 hash를 바꿔 끼우라고 지시한다.
- 2 Prepare(242-247), 3 Drive(248-280), 4 Integrate(281-294)는 coordinator가 `opened[]`, lease, attempt, hash를 직접 옮겨 각 `coordinate` 명령을 조립하게 한다.
- 3 Drive는 execute reference 3개(260-262)와 `## Task round`를 따르라고 한다. Task round(196-224)에는 intent bundle, 재검증, verify·execute gate 단계가 있고 commit 단계는 없다. commit은 `skills/bouncer-commit/SKILL.md`의 `return-to-coordinator` 분기와 `docs/workflow.md:26-35`에만 나온다.
- 본문을 쓰는 곳:
  - `scripts/src/lib/print-dispatch.ts:85-99`가 본문을 그대로 prompt에 넣는다.
  - `.codex/agents/bouncer-coordinator.toml`은 `mdToCodexToml`(`scripts/src/lib/codex-agents.ts:43-72`)로 만든 bytes와 같아야 한다(`test/agents.test.js:257`, `:591`, `:634`, `test/distribution.test.js:230`).
  - 저장소 TOML을 쓰는 CLI는 없다.
- Procedure 문구를 고정하는 테스트:
  - 규칙을 담은 테스트:
    - `test/agents.test.js:547`: `1. **Ground**` 구간에 `coordinate status`·checkpoint를 요구한다. 문서 전체에는 `--ledger-path <checkpoint.ledger.path>`, `--ledger-hash <checkpoint.ledger.sha256>`, hash 교체, 원장·과거 보고 로드 금지를 요구한다.
    - `:763`: dispatch metadata 다섯 개, stale Brief revision의 report, record 금지를 요구한다.
    - `:495`: `4. **Integrate**`~`5. **Judge**` 구간의 부분 wave 규칙과 `continue`·Close 조건을 본다.
    - `:476`: `6. **Close**`의 `completed`와 finalize 미실행을 본다.
    - `:461`: `--lease-id`, `--generation`, `coordinate revoke`, `bouncer coordinate integrate --ledger-path`, pointer 미이동, `effectiveTask`를 요구한다.
    - `:489`: provenance inside the decision 문구를 요구한다.
    - `:834`: `## Task round` 구간에 intent bundle·sections·`--gate execute`·hand-write 금지·revise 뒤 재번들을 요구한다.
    - `test/distribution.test.js:227`: md와 TOML에 같은 fence 문자열을 요구한다.
  - 문구·위치만 고정하는 테스트:
    - `test/agents.test.js:849`: `3. **Drive**` 구간이 reference 3개 경로와 `## Task round`를 가리킨다.
    - `test/cli-help.test.js:363`: `--help\`; do not read plugin sources for them`.
    - `test/skill-bouncer-run.test.js:88`, `:179`.
  - `scripts/check-doc-shape.js:726-734`(`npm run lint:docs`)는 Authority → Hard guards → … → Output contract(마지막) 순서만 본다. 줄 수 제한은 없다.

#### Target behavior

- 성공:
  - Procedure는 1 Ground, 2 Prepare, 3 Drive, 4 Integrate, 5 Judge, 6 Close 번호와 표지를 유지한다.
  - 1 Ground는 `bouncer coordinate next --blueprint <dir>`를 부른다. 응답의 `checkpoint.ledger`는 `coordinate status` checkpoint와 같은 fence이고, 열린 task 판단에는 `coordinate status` checkpoint의 `active_tasks`·`completed_tasks` 요약을 계속 쓴다. 2·4는 `prepare`·`integrate`·`verification_node` action의 `argv`를 실행한다.
  - 3 Drive는 `drive_tasks`의 task마다 `coordinate next --task <NNN>`을 반복한다. `implement`·`review`는 Worker dispatch 절차로 worker를 띄운다. `commit`은 worker cwd에서 `bouncer commit --blueprint <dir> --yes`를 실행한다. `report`·`record`·`revise`·`dispatch`는 `judge.fields`를 채운 `argv`를 실행한다.
  - 5 Judge는 `judge`·`blocked` 응답을 기존 판정 다섯 가지 중 하나로 바꾼다.
  - 6 Close는 `final_review`이면 그 `argv`(`review-dispatch execute`)로 Worker dispatch의 blueprint final review 절차를 한 번 실행하고 `judge` `review-round`에 따라 round를 기록한 뒤 `next`를 다시 부른다. `done`이면 `completed`를 돌려준다.
  - Procedure는 `next`가 준 값 외의 fence·lease·attempt·hash를 조립하지 말라고 지시한다. `ok: false`나 fence 거절 뒤에는 `next`를 다시 부르라고 지시한다.
- 실패:
  - `next`가 `blocked`를 돌려주면 그 `reason`·`cause`·`next`를 Judge 입력으로 쓴다. 판단 없이 같은 `argv`를 반복하지 않는다.
- 보존:
  - Authority, Hard guards, Worker dispatch, Output contract 본문은 바뀌지 않는다.
  - `## Task round` 제목과 위치는 유지한다. 위 규칙 테스트가 요구하는 문구도 유지한다.
  - 3 Drive가 가리키는 execute reference 3개는 유지한다. reference 대체는 계약 카드 blueprint의 일이다.

#### Interface

- 제공:
  - `agents/bouncer-coordinator.md` `## Procedure`의 `coordinate next` 루프와 commit 단계.
  - 같은 본문의 `.codex/agents/bouncer-coordinator.toml`.
  - `docs/workflow.md` 코디네이터 흐름 설명에 `coordinate next` 한 줄.
- 거부:
  - Procedure가 coordinator에게 fence·lease 값을 `next` 응답이나 성공 응답 밖에서 만들게 하는 문구.
  - `/bouncer-finalize`나 그 일부를 실행하게 하는 문구.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `## Procedure`, `## Task round` | Modify | 단계별로 coordinator가 명령을 조립 | 각 단계를 `next` 호출·`argv` 실행·`judge` 판단으로 바꾸고 commit 단계 추가 | Goal |
| `.codex/agents/bouncer-coordinator.toml` | `developer_instructions` | Modify | md 본문의 생성 사본 | `mdToCodexToml` 출력으로 다시 생성 | `test/agents.test.js:257` byte 비교 |
| `test/agents.test.js` | coordinator Procedure 테스트(`:476`, `:495`, `:547`, `:763`, `:834`, `:849`) | Modify | 현재 Procedure 문구 고정 | 규칙 단언은 유지하고 `next` 루프·commit 단계 단언 추가, 바뀐 문구 단언만 갱신 | 문서 변경의 파급 |
| `docs/workflow.md` | 코디네이터 흐름 설명(26-35) | Modify | prepare → execute/commit → record → integrate 설명 | coordinator가 단계마다 `coordinate next`로 다음 행동을 받는다는 한 줄 추가 | 사용자 문서 정합 |
| `CHANGELOG.md` | `[Unreleased]` `### Changed` | Modify | 미출시 변경 목록 | coordinator 지침 `next` 루프 항목 추가 | epic Success criteria 6 |

#### Constraints

- `agents/bouncer-coordinator.md`의 H2 순서는 Authority, Hard guards, Worker dispatch, Task round, Procedure, Output contract로 유지한다(`npm run lint:docs`, `test/agents.test.js:603-647`).
- 규칙 테스트가 쓰는 단계 표지 `1. **Ground**`, `3. **Drive**`, `4. **Integrate**`, `5. **Judge**`, `6. **Close**`는 그대로 둔다.
- TOML은 손으로 고치지 않는다. `npm run build` 뒤 `scripts/lib/codex-agents.js`의 `mdToCodexToml`로 만든 bytes를 쓴다.
- `docs/workflow.md:114`의 `bouncer current --set` 서술 불일치는 이 task에서 고치지 않는다.
- `affected_paths` 밖 테스트가 고정한 문자열을 본문에 남긴다. `coordinate status`, `checkpoint`, `--ledger-path <checkpoint.ledger.path>`, `--ledger-hash <checkpoint.ledger.sha256>`(`test/distribution.test.js:227-240`), ``--help`; do not read plugin sources for them``(`test/cli-help.test.js:363`), `coordinate dispatch`·`attempt`·`previous_outcome`·`bouncer-implementer`(`test/skill-bouncer-run.test.js:88`, `:179`)이다. 이 테스트들은 고치지 않는다.

### EPIC-088/BP-002/TASK-003 · `0f491b08`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinate-next.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `agents/bouncer-coordinator.md` — 기록된 CI 실패를 복구한다.
- Modify `.codex/agents/bouncer-coordinator.toml` — 기록된 CI 실패를 복구한다.
- Modify `test/coordinate-next.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/cli-coordinate.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/agents.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.