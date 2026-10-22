---
type: bouncer.explain
title: release-main-outside-scope explain
description: Explain for release-main-outside-scope
resource: .bouncer/context/epics/finalize-closeout/blueprints/release-main-outside-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T22:08:13.942+09:00'
bouncer:
  id: EXPLAIN-release-main-outside-scope
  epic_id: finalize-closeout
  blueprint_id: release-main-outside-scope
  status: published
  comprehension:
    - range_from: 2c8ea1072f0358edafe19d01074042beb84d66d0
      range_to: 1ccfbee704af54e01d87fc47bd5a8b10c76ab207
      diff_sha: 842253920661477759b5412f4dfc3bd0efcdacb74055fac87c6ef4a8e92b39cb
      recorded_at: '2026-10-22T22:10:00+09:00'
  task_commits:
    - task: finalize-closeout/release-main-outside-scope/001
      sha: 1ccfbee7
      intent_anchor: task-001
---
# Explain

## Background

`finalize --yes`는 terminal 검증 실패가 `outside_scope`로 입증되면 그 실패를 남겨 둔 채 drive를 완료로 보고 blueprint를 닫는다. 그런데 이어서 메인 checkout에서 돌리는 `finalize release-main`은 같은 drive를 `drive-not-closed`로 거절했다. 그래서 메인 사본 정리, worktree 제거, 다음 blueprint 인계가 모두 끊겼다. 거절 응답에는 이유도 다음 행동도 없어 사용자가 원인을 짐작해야 했다.

## Code

- `scripts/src/lib/finalize-release-main.ts`
  - `unintegratedTaskIds`는 통합되지 않은 task 중 `validOutsideScope`가 인정한 terminal을 뺀 id 목록을 정렬해 돌려준다. `partial_closed` 조기 반환과 닫힘 판정이 이 helper 하나를 공유한다.
  - `driveNotClosed`는 상황별 `cause`·`next`와 `tasks`를 담은 거절 응답을 만든다. 우선순위는 `partial_closed`, `awaiting_confirmation`, 미통합 task 순이다.
  - `releaseMain`은 분류된 terminal이 있으면 성공 payload에 `outside_scope: { task, evidence_id, reason }`를 싣고, 없으면 그 키를 싣지 않는다.
  - 설계상 한계: 분류 terminal을 닫힘 판정과 payload 구성에서 각각 계산한다. 결과는 같지만 두 곳이 어긋나지 않게 유지해야 한다. terminal은 하나뿐이라 `outside_scope`는 미통합 첫 task에서 채운다.
- `test/finalize-release-main.test.js`: 성공, `integrationHead` 불일치, 추가 거절 세 경우, 기존 거절 단언 보강. 기대 `tasks`는 `tasksOf` helper가 case 소스를 보고 고른다.
- `skills/bouncer-finalize/references/cleanup-handoff.md`, `rules/cli.md`, `CHANGELOG.md`: 새 동작과 거절 응답 필드를 설명한다.

## Quiz

1. `outside_scope`로 분류된 terminal 하나만 남고 `integrationHead`가 `source_digest`와 같은 drive에 `release-main`을 실행하면 결과는? (A) `drive-not-closed` (B) `ok: true`에 `outside_scope` 포함 (C) `ok: true`지만 `outside_scope` 키 없음
2. 원장 `status`가 `awaiting_confirmation`이고 유효한 `outside_scope` 분류가 있으면? (A) `drive-not-closed`, `tasks`는 `[]` (B) `ok: true` (C) `blueprint-not-closed`
3. commit task 하나가 `verifying`으로 남은 drive의 `drive-not-closed` 응답에서 `tasks`와 `next`는? (A) `tasks`는 `[]`, `next`는 partial merge 안내 (B) `tasks`는 그 task id, `next`에 `coordinate next` 안내 (C) `tasks`와 `next` 모두 없음

## Tasks

### finalize-closeout/release-main-outside-scope/001 · `1ccfbee7`

#### Goal & intent

`finalize --yes`가 `outside_scope` terminal을 완료로 보고 닫은 drive를 `finalize release-main`도 정리하게 한다. 그 밖의 미완료 drive는 계속 거절하되, 거절 응답만으로 이유와 다음 행동을 알 수 있게 한다.
수용 기준은 blueprint Contract 1~5이고, 완료 명령은 `bouncer.verify`(`node --test test/finalize-release-main.test.js`)다.

#### Current behavior

- 입력: 메인 checkout에서 `bouncer finalize release-main --blueprint <dir>` → `releaseMain({ repoRoot, cwd, blueprintDir, allowPartialMerge, confirmPartialMerge })` (`scripts/src/lib/cli-git-commands.ts:93`). 결과 JSON을 그대로 출력하고 `ok`가 false면 exit 1이다(`cli-git-commands.ts:100-101`).
- 원장 읽기: `d.readCoordinatorLedger` (`scripts/src/lib/finalize-release-main.ts:355`, 파일 I/O). `LedgerRead` 타입은 `status`·`tasks[].status`·`seedManifest`만 선언한다(`finalize-release-main.ts:39-42`).
- 닫힘 판정: `partial_closed`는 플래그 없으면 `drive-not-closed`(`:364`). 그 밖에 `ledger.status === 'awaiting_confirmation'`이거나 `tasks.some(status !== 'integrated')`이면 `{ ok: false, reason: 'drive-not-closed' }`(`:403-406`). cause·next·tasks가 없다.
- 반면 finalize 쪽 `finalize-checks.ts:104-110`은 `validOutsideScope(read.ledger, id)`가 null이 아닌 task를 미완료에서 뺀다. `validOutsideScope`는 `scripts/src/lib/execution-contracts.ts:147`에 export되어 있다(검사: verification·`verifying`·terminalFailure.task 일치·disposition 필드·evidence/source_digest 일치·`integrationHead === source_digest`).
- 성공 payload는 `successPayload`(`finalize-release-main.ts:559-580`)가 만들며 `ReleaseMainOk`(`:22-29`)에 `outside_scope`가 없다.
- 재현: terminal-reverify drive 마감에서 `finalize --yes`가 `integration.outsideScope`와 함께 닫힌 뒤 `release-main`이 `{"ok": false, "reason": "drive-not-closed"}`를 돌려줬다.
- 기존 테스트: `test/finalize-release-main.test.js:169` "rejection reasons → leave the main tree and porcelain unchanged"가 `drive-not-closed` 세 경우(`verifying` task, `awaiting_confirmation`, `partial_closed`)와 메인 트리 불변을 단언한다. `:233` partial merge 테스트도 `ordinary.reason === 'drive-not-closed'`를 단언한다. fixture `writeLedger`(`:72`)는 patch를 얕게 합친다.
- 문서: `skills/bouncer-finalize/references/cleanup-handoff.md:18`은 "integration head is unverified"면 전체 보존이라 적고, `rules/cli.md:125-126`은 release-main을 한 문장으로만 설명한다.

#### Target behavior

- 성공 경로: 원장 `status`가 `awaiting_confirmation`·`partial_closed`가 아니고, `integrated`가 아닌 task가 모두 `validOutsideScope(ledger, task.id)`가 null이 아닌 task(실제로는 terminal 하나)이면 닫힘으로 본다. 이후 기존 정리 단계를 그대로 밟고, 성공 payload에 `outside_scope: { task, evidence_id, reason }`를 싣는다. 분류된 task가 없으면 `outside_scope` 키를 싣지 않는다.
- 실패 경로: 그 밖에는 `drive-not-closed`이며 응답은 `{ ok: false, reason: 'drive-not-closed', cause, next, tasks }`다. `tasks`는 원장 `status`와 무관하게(`partial_closed` 조기 반환 분기 포함) 분류되지 않은 미통합 task id를 정렬한 배열이다. 같은 계산을 쓰는 helper 하나로 두 분기가 공유한다. cause·next는 상황별로 고른다(우선순위: `partial_closed` → `awaiting_confirmation` → 미통합 task).
  - 미통합 task: cause `A coordinator task is not integrated, so the drive is not closed.` / next `From the integration worktree, finish the listed tasks with \`bouncer coordinate next\` (or classify a proven out-of-scope terminal failure with \`bouncer coordinate repair --disposition outside_scope\`), then rerun \`bouncer finalize release-main --blueprint <dir>\`.`
  - `awaiting_confirmation`: cause `The ledger is waiting for a user decision after the repair wave limit.` / next `Resolve it with \`bouncer coordinate next\` (reverify, partial-close, or outside_scope), then rerun \`bouncer finalize release-main --blueprint <dir>\`.`
  - `partial_closed`(플래그 없음): cause `The drive was partially closed and needs an explicit partial merge.` / next `After the user approves, rerun with \`--allow-partial-merge --confirm-partial-merge\`.`
- 보존: `partial-merge-confirmation-required`·`partial-merge-failed`·partial merge 성공, `blueprint-not-closed`, `coordinator-ledger`, `release-main-requires-main-checkout`, `invalid-blueprint-path`의 응답과 판정 순서는 그대로다. 모든 거절은 메인 트리·porcelain을 바꾸지 않는다.

#### Interface

- 제공:
  - `ReleaseMainOk.outside_scope?: { task: string; evidence_id: string; reason: string }` — 분류된 terminal이 있을 때만.
  - `drive-not-closed` 응답의 `cause: string`, `next: string`, `tasks: string[]`.
  - CLI 출력은 `releaseMain` 결과 JSON 그대로다(CLI 코드 변경 없음).
- 거부:
  - `validOutsideScope`가 null인 `verifying` terminal(무효 분류) → `drive-not-closed`, `tasks`에 포함.
  - commit task 미통합 → `drive-not-closed`, `tasks`에 포함.
  - `awaiting_confirmation`·`partial_closed`(플래그 없음) → `drive-not-closed`, 분류 여부와 무관.
- 용어: "분류된 terminal" = `validOutsideScope(ledger, id)`가 객체를 돌려주는 task. 예: `{ id: '003', execution_kind: 'verification', status: 'verifying' }` + `terminalFailure.disposition.kind === 'outside_scope'` + `integrationHead === source_digest`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-release-main.ts` | `releaseMain`, `successPayload`, `ReleaseMainOk`, `LedgerRead` | Modify | 메인 checkout 정리 전 drive 닫힘 판정과 성공 payload | `validOutsideScope` import로 분류 terminal을 미완료에서 제외, `outside_scope` 필드, `drive-not-closed`에 cause·next·tasks | 거절 지점 `:364`, `:403-406`; 성공 `:559` |
| `test/finalize-release-main.test.js` | `writeLedger`, rejection reasons 테스트 | Modify | release-main 판정·정리 회귀 | 분류 terminal 성공·무효 분류 거절·cause/next/tasks 단언 추가 | `:169`, `:233` 기존 drive-not-closed 단언 |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | Drive inventory 문단 | Modify | 보존·정리 기준 안내 | `outside_scope` 분류 terminal은 정리 대상이고 `release-main` payload의 `outside_scope`를 보고에 남긴다고 명시; `drive-not-closed`면 `cause`·`next`를 보고 | `:18` 보존 문장이 새 동작과 어긋남 |
| `rules/cli.md` | release-main 설명 | Modify | CLI 동작 요약 | 분류 terminal 허용과 `drive-not-closed`의 `cause`·`next`·`tasks` 한두 문장 추가 | `:125-126` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 이력 | `### Fixed`에 항목 1개 | 프로젝트 관례 |

#### Constraints

- 판정 순서를 지킨다: 메인 checkout 확인 → 경로 → 원장 읽기(`coordinator-ledger`) → `partial_closed` 분기 → 닫힘 판정 → `blueprint-not-closed` → 정리. 분류 terminal 제외는 닫힘 판정 한 곳에서만 한다.
- 거절은 메인 파일을 쓰기 전에 끝난다(기존 "판정을 먼저 모은 뒤에만 메인 쓰기" 원칙).
- 새 주석·docstring은 한국어(`references/coding-standards/index.md`). 함수 docstring의 `@returns`를 새 필드에 맞춘다.
- 문서는 기존 언어를 따른다(`cleanup-handoff.md`·`rules/cli.md`는 영어, CHANGELOG는 한국어).
- `cleanup-handoff.md`는 `test/skill-bouncer-surface.test.js`가 존재를 확인하므로 파일명을 바꾸지 않는다.

### finalize-closeout/release-main-outside-scope/002

#### Goal & intent

TASKS-001이 통합된 integration HEAD에서 `npm run ci`(build·lint·typecheck·전체 테스트)가 통과함을 증명한다. blueprint Contract 수용 기준 5의 종단 조건이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.