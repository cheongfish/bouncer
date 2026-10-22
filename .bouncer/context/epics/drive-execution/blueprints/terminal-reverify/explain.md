---
type: bouncer.explain
title: terminal-reverify explain
description: Explain for terminal-reverify
resource: .bouncer/context/epics/drive-execution/blueprints/terminal-reverify/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T21:31:53.918+09:00'
bouncer:
  id: EXPLAIN-terminal-reverify
  epic_id: drive-execution
  blueprint_id: terminal-reverify
  status: published
  comprehension:
    - range_from: 565ba51b3f0082d5ffb689244545a1bc9ea47e52
      range_to: 4916ce1044cad27a866fa8f2d09d3f3c8cfab767
      diff_sha: 9b1c9ce5736307a0cb5445c89a727e07d6f1d39c5dbd891de0897c2a52212ee1
      recorded_at: '2026-10-22T21:45:00+09:00'
  task_commits:
    - task: drive-execution/terminal-reverify/001
      sha: 4560e311
      intent_anchor: task-001
    - task: drive-execution/terminal-reverify/002
      sha: 4916ce10
      intent_anchor: task-002
---
# Explain

## Background

terminal 검증이 환경 문제(예: 외부 도구 오류, 일시적 실패)로 실패하면 지금까지는 선택지가 둘뿐이었다. repair wave를 쓰거나, 원인이 범위 밖이라고 `outside_scope`로 분류하는 것이다. repair wave는 drive당 두 번뿐이라, 환경만 고치면 통과할 실패에도 그 한도가 소진된다.

`bouncer coordinate reverify --task <terminal>`은 실패한 terminal 검증만 같은 HEAD에서 다시 돌린다. repair wave를 쓰지 않으므로 한도가 줄지 않고, 통과하면 terminal이 `integrated`가 되어 drive가 이어진다. wave 한도로 `awaiting_confirmation`에 멈춘 drive도 통과하면 `active`로 돌아간다.

## Code

- `scripts/src/lib/coordinator-commands.ts`: `coordinateReverify`가 새 명령 진입점이다. 실제 실행은 기존 `integrateVerificationTask`의 `reverify` 옵션 모드가 맡고, 거절 조건은 `reverifyRejection`이 읽기 전용으로 검사한다. 거절 reason은 `terminal-failure-required`, `reverify-source-moved`, `reverify-worktree-dirty`이고 모두 `COORDINATE_FAILURE_HINTS`에 cause와 next가 있다.
- 거절은 상태를 바꾸지 않는다. 실패한 소스(`terminalFailure.source_digest`)와 현재 HEAD·ledger HEAD가 같아야 하고, 작업 트리는 허용 목록(seed된 계획 문서, 통합된 task의 증적, terminal 증적 문서) 밖으로 더럽혀져 있으면 안 된다. 허용 규칙은 fan-in의 `disallowedDirtyPaths`를 미러링한 것이라 원본이 바뀌면 어긋날 수 있다.
- 다시 돌린 검증이 또 실패해도 repair wave 한도 전이는 일어나지 않는다. 이미 `awaiting_confirmation`이면 그대로 둔다.
- `scripts/src/lib/cli-git-commands.ts`, `cli-usage.ts`: `reverify`를 `coordinate` 하위 명령으로 등록하고 `--task`가 없으면 usage 오류(exit 2)를 낸다. `reverify`는 ledger fence 대상 명령에 들어간다.
- `rules/cli.md`, `references/coordinator-cards/blocked.md`·`final_review.md`, `skills/bouncer-run/SKILL.md`, `light-run.md`, `CHANGELOG.md`: repair 전에 reverify를 먼저 고려하라는 복구 안내를 추가했다.
- 알려진 한계: 다시 돌릴 명령을 커밋되지 않은 terminal `tasks.md`나 `.bouncer/config.json`에서 읽는다. 그래서 명령을 고친 뒤 reverify하면 원래 실패한 명령 없이 통과할 수 있다. 기존 integrate 경로에도 같은 노출이 있으며, 실패 명령과 비교하는 거절은 후속 과제다.

## Quiz

1. 실패한 terminal 검증을 `reverify`로 다시 돌리려는데, 그 사이 integration HEAD에 새 커밋이 생겼다. 어떻게 되는가?
   - A) 새 HEAD에서 그대로 재검증하고 통과하면 `integrated`로 만든다.
   - B) `reverify-source-moved`로 거절되고 상태는 그대로이며, 코드가 바뀐 경우이므로 repair로 보내진다.
   - C) 거절되면서 repair wave 하나가 소모된다.
2. wave 한도(2회)를 다 쓰고 `awaiting_confirmation`에 멈춘 drive에서 환경을 고친 뒤 `reverify`가 통과하면?
   - A) ledger status가 `active`로 돌아가 drive가 이어진다.
   - B) `awaiting_confirmation`이 유지되어 사용자의 `partial-close`가 필요하다.
   - C) 이미 소진된 한도 때문에 통과해도 `integrated`가 되지 못한다.
3. `reverify`가 돌아가기 전 작업 트리 검사에서 어떤 변경은 허용되고 어떤 변경은 `reverify-worktree-dirty`로 거절되는가?
   - A) 커밋되지 않은 변경이 하나라도 있으면 모두 거절된다.
   - B) `.bouncer/` 아래 파일은 전부 허용되고 그 밖은 거절된다.
   - C) seed된 계획 문서와 통합된 task의 증적 문서는 허용되고, 그 밖의 소스 변경은 거절된다.

## Tasks

### drive-execution/terminal-reverify/001 · `4560e311`

#### Goal & intent

`coordinate({ command: 'reverify', task })`가 `terminalFailure`가 기록된 `verifying` terminal 검증만 같은 integration HEAD에서 다시 실행한다. `repairWaves`는 늘지 않는다. 수용 기준은 blueprint Contract 1–6이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- terminal 검증은 `coordinate integrate --task <terminal>`의 `integrateVerificationTask`(`scripts/src/lib/coordinator-commands.ts:357-481`)로만 실행된다.
  - phase 1(`withLedgerLock`, :371-393): `ready`→`verifying` 전이와 `writeVerificationTaskStatus`(:246-259) 기록. `verifying`이면서 `ledger.terminalFailure.task === task`이면 `not-ready`로 거절한다(:380-383).
  - 잠금 밖: `prepareVerificationDependencies`(npm ci, `coordinator-verification.ts:23-25`)와 `runTargetVerification`(:33-48). key head는 `ledger.integrationHead || git rev-parse HEAD`(:413-417).
  - phase 2: `recheckLedgerCheckpoint`(:429-433). 실패하면 `paths`·`repairWave`·`evidence_id`·`source_digest`로 새 `FailureEvidence`를 만들어 `terminalFailure`를 덮고(:442-452, disposition도 사라짐), `repairWaves.length >= 2`이면 `awaiting_confirmation`(:454-457)으로 바꾼 뒤 `verification-failed`를 반환한다. 성공하면 `integrated` 전이, `verify_evidence_id` 기록, `terminalFailure` 유지(:463-478).
- 실패 뒤 실행 경로는 `repair`(새 task 또는 `--resume-task`, wave 소모)와 `--disposition outside_scope`(재실행 없음, `coordinator-repair.ts:1173-1179`에서 `awaiting_confirmation`→`active`)뿐이다.
- HEAD 대조 패턴: `coordinator-repair.ts:581-585`가 `ledger.integrationHead`와 실제 `git rev-parse HEAD`를 모두 `source_digest`와 비교한다. 작업 트리 확인은 `sourceStatus`(`coordinator-git.ts:30-34`, `.worktrees/` 제외 porcelain).
- 실패한 integrate는 terminal `tasks/<id>/tasks.md`(status `verifying`)를 커밋하지 않은 채 남기고(:392), runner가 해당 task `verification.md`를 쓴다(`verification.ts:278`, :290-297). 그래서 실패 직후 integration 작업 트리는 이미 dirty다.
- `coordinate next`: `awaiting_confirmation`이면 `blocked`/`repair-wave-limit`(`coordinate-next.ts:665-669`), 아니면 `blocked`/`terminal-verification-failed`(:670-684). 안내 문구는 `NEXT_FAILURE_HINTS`(:103-106)와 `COORDINATE_FAILURE_HINTS['repair-wave-limit']`(`coordinator-commands.ts:1600-1603`)에 있다. `hintFor`(:148)는 두 표에 같은 키를 두지 않는다.
- `coordinate advance`는 `AUTO_ACTIONS`만 실행하고 `blocked`에서 멈춘다(`coordinate-advance.ts:54-60`).
- 재현: `test/coordinator.test.js:5579-5612` `terminalFailedDrive` fixture가 실제 git repo에 `terminalFailure`(evidence `RESUME_EVIDENCE`, `source_digest = integrationHead`)를 만든다. integrate 통과·실패·wave 한도는 :490-636, disposition은 :5856-5883.
- I/O: git은 모두 `exec`(`deps.execFileSync`, :1137), runner는 `deps.runVerification`, 원장 쓰기는 `deps.writeLedger || atomicWrite`(:1142)로 주입된다. task 문서 쓰기는 직접 `fs.writeFileSync`다.

#### Target behavior

- 성공 경로: 조건을 통과한 terminal에서 npm ci와 terminal verify를 다시 실행하고, 통과하면 `integrated` 전이와 `verify_evidence_id`를 기록한다. `terminalFailure`는 그대로 둔다. 원장 `status`가 `awaiting_confirmation`이면 `active`로 바꾸고 응답에 `status_restored: 'active'`를 싣는다.
- 실패 경로(검증 실패): integrate와 같은 규칙으로 새 `FailureEvidence`(`command`·`summary`·`paths`·`exitCode`·`repairWave`·`evidence_id`·`source_digest`)를 만들어 `terminalFailure`를 덮는다(disposition 제거). `repairWave`는 현재 `repairWaves.length`다. `repairWaves`는 그대로이고, 원장 `status`도 바꾸지 않는다(이미 `awaiting_confirmation`이면 그대로 둔다). 반환은 `{ ok: false, reason: 'verification-failed', command: 'reverify', ... }`.
- 거절 경로: 아래 Interface 거부 목록. 거절 시 원장·task 문서·작업 트리를 바꾸지 않는다.
- 보존: `integrate`의 기존 동작(`terminalFailure`가 있는 terminal에 `not-ready`, wave 한도 처리)과 `repair` 경로는 그대로다. `advance`는 reverify를 실행하지 않는다.
- `coordinate next`: `terminal-verification-failed` 안내 `next`가 `bouncer coordinate reverify --task <terminal>`(환경 수정 뒤)과 `bouncer coordinate repair`를 함께 제시한다. `repair-wave-limit` 안내도 환경 수정 뒤 reverify를 먼저 제시하고, repair 재시도 금지는 유지한다.

#### Interface

- 제공:
  - `coordinate({ command: 'reverify', task, ledgerPath, ledgerHash, ... })`. PRE_LOCK handler로 등록하고 `LEDGER_FENCED_COMMANDS`에 넣는다.
  - 통과 응답: `withCheckpoint({ ok: true, command: 'reverify', task, verification, ready, decisions, status_restored? })`. `status_restored`는 `awaiting_confirmation`에서 되돌렸을 때만 `'active'`.
  - `COORDINATE_FAILURE_HINTS`에 새 reason 두 개의 `cause`·`next`.
- 거부(즉시 반환, 상태 불변):
  - `task-outside-blueprint`: 원장에 없는 task.
  - `terminal-failure-required`: `execution_kind`가 `verification`이 아니거나, status가 `verifying`이 아니거나, `ledger.terminalFailure?.task !== task`.
  - `reverify-source-moved`: `ledger.integrationHead` 또는 실제 `git rev-parse HEAD`가 `terminalFailure.source_digest`와 다름. `next`: 코드가 바뀌었으니 `bouncer coordinate repair`로 처리한다.
  - `reverify-worktree-dirty`: `sourceStatus` 결과에서 허용 경로를 뺀 변경이 남음. 허용 경로(도메인 용어 "terminal 증적 문서"): integrate 검증 경로가 스스로 쓰는 파일, 즉 `<blueprint>/tasks/<terminal>/tasks.md`, `<blueprint>/tasks/<terminal>/verification.md`, `<blueprint>/verification.md`. 예: `.bouncer/context/epics/e/blueprints/b/tasks/003/tasks.md`는 허용, `src/a.js`는 거절. `next`: 커밋되지 않은 source 변경을 되돌린 뒤 다시 실행하거나, 그 변경이 필요하면 `bouncer coordinate repair`로 처리한다.
  - fence 불일치(`ledger-checkpoint-invalid` 등)와 잠금 경합(`ledger-locked`·`ledger-lock-lost`)은 기존 reason을 그대로 쓴다.
- 실행 중 실패(거절이 아님): `dependency-install-failed`(상태 불변), phase 2 checkpoint 불일치(기존 reason, 결과 미기록), `verification-failed`(위 실패 경로).
- 테스트 seam(새 주입점 없음):
  - core: 기존 `deps.execFileSync(cmd, args, opts) → string|Buffer`, `deps.runVerification(opts) → { ok, exitCode, command, evidenceId? }`, `deps.writeLedger(file, data) → void`.
  - advance 부재 단언: `test/coordinate-advance.test.js`의 `scriptedDeps(nextQueue, runQueue)` → `{ deps: { next(), runArgv(argv, cwd) }, runCalls }`. `runQueue`를 비워 두면 예상 밖 `runArgv` 호출이 throw하고, `runCalls.length === 0`으로 reverify 미실행을 확인한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `integrateVerificationTask`, `PRE_LOCK_HANDLERS`, `LEDGER_FENCED_COMMANDS`, `COORDINATE_FAILURE_HINTS` | Modify | terminal 검증 2단계 실행·기록, 명령 등록, 실패 안내 | reverify 모드(phase 1 조건 검사, 실패 시 wave 한도 상태 전이 생략, 성공 시 status 복원)와 handler 등록, 새 reason 안내, `repair-wave-limit` 안내 갱신 | 실행 경로를 integrate와 공유해야 증거 형식이 같다(:357-481, :70-73, :1067-1071, :1600-1603) |
| `scripts/src/lib/coordinate-next.ts` | `NEXT_FAILURE_HINTS` | Modify | blocked reason별 안내 | `terminal-verification-failed`의 `next`에 reverify 선택지 추가 | :103-106 |
| `test/coordinator.test.js` | `terminalFailedDrive` | Modify | terminal 실패·repair·disposition 테스트 | reverify 통과·실패·거절 4종·status 복원·wave 불변 테스트 추가, 안내 완전성 검사(:162-205)를 새 reason으로 통과 | fixture :5579-5612, :490-636, :5856-5883 |
| `test/coordinate-next.test.js` | blocked 안내 assertion | Modify | blocked 응답·안내 검증 | 두 blocked 응답의 `next`에 `coordinate reverify`가 있는지 확인 | :252, :262, :321-372 |
| `test/coordinate-advance.test.js` | (c) blocked stops | Modify | blocked에서 멈춤 검증 | terminal blocked에서 reverify를 실행하지 않음을 확인 | :91-100 |
| `test/helpers/coordinator-fence.js` | `FENCED_COMMANDS` | Modify | 테스트 helper의 자동 fence 대상 | `reverify` 추가 | :13-17, 누락 시 fence 없는 호출로 거절됨 |

#### Constraints

- integrate의 기존 응답·reason·상태 전이를 바꾸지 않는다. reverify 분기는 옵션으로만 갈라진다.
- npm ci와 verify는 잠금 밖에서 실행하고 phase 2에서 checkpoint를 다시 확인하는 기존 2단계 패턴을 유지한다.
- `NEXT_FAILURE_HINTS`와 `COORDINATE_FAILURE_HINTS`에 같은 키를 두지 않는다(`hintFor` 규칙).
- 새 reason 문자열은 모두 `COORDINATE_FAILURE_HINTS`에 `cause`·`next`를 갖는다.

### drive-execution/terminal-reverify/002 · `4916ce10`

#### Goal & intent

`bouncer coordinate reverify --task <terminal>`을 CLI에서 fence 명령으로 호출할 수 있게 하고, help·`rules/cli.md`·coordinator 카드·run skill·CHANGELOG에 terminal 실패 복구 선택지로 적는다. 수용 기준은 blueprint Contract 6–7이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- 서브커맨드 목록 `COORDINATE_COMMANDS`(`scripts/src/lib/cli-git-commands.ts:335-339`)가 `--help` 라우팅(:751)과 usage 실패(:373)를 결정한다. `--task`는 `COORDINATE_STRING_FLAG_FIELDS`(:422-436)에 이미 있어 `coordinateCall`(:676-723)이 그대로 넘긴다.
- fence 검사 `checkFenceFlags`의 `fenced` 목록(:455-459)에 없는 명령은 fence 없이 통과한다. 목록에 있으면 누락 시 `ledger-checkpoint-invalid`(exit 1, :466-473).
- `checkCommandFlags`(:552-582)는 `revoke` 등 일부 명령의 필수 `--task`를 usage(exit 2)로 거절한다(:566-568). `integrate`는 `--task` 검사가 없다.
- 알 수 없는 명령 오류 문자열(:759-764)이 모든 서브커맨드를 나열하고, `test/cli-coordinate.test.js:551,556` regex가 그 꼬리 `..., worker-model, or worker-tokens`를 확인한다.
- help: `COMMAND_USAGE.coordinate`(`scripts/src/lib/cli-usage.ts:17`), 서브커맨드별 `COORDINATE_USAGE`(:38-63, `revoke` 항목 :47).
- 문서: `rules/cli.md:182`(서브커맨드 synopsis), :67-70(detached 원장에서 거절되는 fence 명령), :188-200(repair 형태), :477-506(terminal 실패 복구 문단). `references/coordinator-cards/blocked.md:30-55`("Terminal CI repair"), `references/coordinator-cards/final_review.md:74-80`, `skills/bouncer-run/SKILL.md:71-75`, `skills/bouncer-run/references/light-run.md:56-62`. `CHANGELOG.md:8-35` `[Unreleased]`에 `### Added`가 두 곳(:10, :30) 있다.
- I/O: CLI 테스트는 `runCli`를 같은 프로세스에서 호출한다(`test/cli-help.test.js:36-43` `capture`, `test/cli-coordinate.test.js:124-146` `coordinateCli`가 `process.chdir`하고 자체 `fenced` Set(:130-134)에 있으면 fence 플래그를 붙인다). 둘 다 `scripts/lib` 빌드를 읽는다.
- 문서 크기 계약: `rules/cli.md`·`blocked.md`에는 shape 계약이 없다. `bouncer-run/SKILL.md`는 필수 heading 계약(`scripts/check-doc-shape.js`)만 있고 크기 제한은 없다. `final_review.md`는 agent-dispatch 링크를 유지해야 한다(`test/doc-shape-cli.test.js:229-262`). `test/coordinate-next.test.js:225`는 카드 본문을 런타임에 읽어 비교한다.

#### Target behavior

- 성공: `bouncer coordinate reverify --blueprint <dir> --task 003 --ledger-path <p> --ledger-hash <h>`가 core `coordinate({ command: 'reverify', task })` 결과를 JSON으로 출력한다. `bouncer coordinate reverify --help`는 `usage: bouncer coordinate reverify`로 시작한다.
- 실패: `--task` 누락이나 값 없는 `--task`는 `coordinate reverify: --task is required` usage(exit 2). fence 누락은 `ledger-checkpoint-invalid`(exit 1). detached 원장에서는 다른 fence 명령처럼 거절된다.
- 보존: 기존 서브커맨드의 파싱·출력·오류 문자열 순서. `reverify`는 오류 문자열과 목록에서 `repair` 바로 뒤에 넣어 `worker-tokens` 꼬리를 유지한다.
- 문서: terminal 실패 복구 안내가 "환경만 고쳤다면 `coordinate reverify`, 코드가 바뀌어야 하면 `repair`" 순서로 두 경로를 구분한다. reverify가 repair wave를 쓰지 않는다는 점과 거절 reason(`reverify-source-moved`, `reverify-worktree-dirty`)을 적는다.

#### Interface

- 제공: CLI `bouncer coordinate reverify --blueprint <dir> --task <terminal id> --ledger-path <path> --ledger-hash <hash> [--repo <root>]`. `COORDINATE_USAGE.reverify` help 항목.
- 거부:
  - `--task` 누락·값 없음 → usage, exit 2, core 호출 없음.
  - fence 플래그 누락 → `ledger-checkpoint-invalid`, exit 1, core 호출 없음.
- core 거절 reason은 TASKS-001이 정한 것을 그대로 출력한다(새 reason 없음). CLI 테스트는 core에 닿기 전 거절만 다루므로 TASKS-001과 병렬로 실행할 수 있다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_COMMANDS`, `checkFenceFlags`, `checkCommandFlags`, `cmdCoordinate` | Modify | coordinate 서브커맨드 파싱·fence·필수 플래그·오류 문자열 | `reverify` 등록, fence 목록 추가, 필수 `--task` 검사, 오류 문자열에 `repair` 뒤로 추가 | :335-339, :455-459, :552-582, :759-764 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.coordinate`, `COORDINATE_USAGE` | Modify | help 문구 | reverify synopsis와 서브커맨드 help 추가 | :17, :38-63 |
| `test/cli-help.test.js` | `COORDINATE_SUBCOMMANDS` | Modify | 서브커맨드 help 시작 문구 검사 | `reverify` 추가 | :311-315 |
| `test/cli-coordinate.test.js` | `coordinateCli` | Modify | CLI coordinate 동작 검사 | helper `fenced` Set에 추가, `--task` 누락 exit 2·fence 누락 exit 1 테스트 추가 | :124-146, :551, :556 |
| `rules/cli.md` | coordinate 절 | Modify | CLI 계약 문서 | synopsis·detached 거절 목록·repair 형태·terminal 실패 복구 문단에 reverify 추가 | :67-70, :182, :188-200, :477-506 |
| `references/coordinator-cards/blocked.md` | Terminal CI repair | Modify | blocked 카드 복구 절차 | 환경 수정 뒤 reverify 단계를 repair 앞에 추가 | :30-55 |
| `references/coordinator-cards/final_review.md` | CI repair 항목 | Modify | final review 카드 | outside_scope·repair 항목 옆에 reverify 한 줄 | :74-80 |
| `skills/bouncer-run/SKILL.md` | step 6 | Modify | run 절차 | terminal 실패 시 reverify 선택지 한 줄 | :71-75 |
| `skills/bouncer-run/references/light-run.md` | terminal 실패 문단 | Modify | light run 안내 | 같은 선택지 한 줄(한국어) | :56-62 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 첫 `### Added`(:10)에 항목 추가 | 프로젝트 규칙 |

#### Constraints

- `rules/cli.md:182` synopsis에 이미 빠진 `worker-tokens`는 고치지 않는다(범위 밖).
- 문서는 사용자 대면 문서의 기존 언어를 따른다(`rules/`·카드·SKILL.md는 영어, `light-run.md`·CHANGELOG는 한국어).
- `final_review.md`의 agent-dispatch 링크와 `bouncer-run/SKILL.md` 필수 heading을 유지한다.

### drive-execution/terminal-reverify/003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 integration에서 `npm run ci`가 통과해 blueprint 수용 기준 7을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.