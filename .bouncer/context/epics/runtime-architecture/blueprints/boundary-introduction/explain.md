---
type: bouncer.explain
title: BP-002 검증·finalize·CLI 경계
description: 검증 대상 선택, finalize 모듈 분리, CLI 지연 로딩의 설계
resource: .bouncer/context/epics/runtime-architecture/blueprints/boundary-introduction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-19T11:09:57.445+09:00'
bouncer:
  id: EXPLAIN-boundary-introduction
  epic_id: runtime-architecture
  blueprint_id: boundary-introduction
  status: published
  comprehension:
    - range_from: a3762772d2e6c13c3b74ecdde507054d72568aa9
      range_to: 2b1351768ed2c5f29b3b721153faf0b875cfbef0
      diff_sha: 6171fc750be634df216f6bfee6f9ca0d48e6d261179e8f566d439a70786be68b
      recorded_at: '2026-10-19T11:10:53+09:00'
  task_commits:
    - task: runtime-architecture/boundary-introduction/001
      sha: 95233e2f
      intent_anchor: task-001
    - task: runtime-architecture/boundary-introduction/002
      sha: bfef745a
      intent_anchor: task-002
    - task: runtime-architecture/boundary-introduction/003
      sha: 9f18bfac
      intent_anchor: task-003
    - task: runtime-architecture/boundary-introduction/004
      sha: 5cb910db
      intent_anchor: task-004
    - task: runtime-architecture/boundary-introduction/005
      sha: 7c184746
      intent_anchor: task-005
    - task: runtime-architecture/boundary-introduction/006
      sha: 2b135176
      intent_anchor: task-006
---
# Explain

## Background
CLI 진입점은 업무 모듈을 한꺼번에 불러왔고, 검증 실행부는 `current`를 직접 읽어 기본 대상을 골랐다. 커밋과 finalize도 Git·메시지 helper를 공유하면서 큰 모듈 경계에 묶여 있었다.

이 변경은 검증 대상을 실행 전에 정하고, 공통 Git 작업과 finalize 단계를 나누며, CLI가 요청된 명령의 handler만 불러오도록 경계를 정리한다. 명령의 결과와 검증 의미는 기존 계약을 유지한다.

## Intuition
안내 데스크는 먼저 요청을 읽고 담당 창구 하나만 연결한다. 담당 창구는 이미 정해진 대상만 처리한다.

## Code
`scripts/src/lib/verification-target.ts`가 기본 검증 대상을 선택하고 `execution-contracts.ts`가 `EffectiveTask` 타입을 제공한다. `verification.ts`는 전달받은 대상의 검증을 실행한다.

`git-ops.ts`와 `commit-message.ts`는 finalize가 함께 쓰는 기능을 분리한다. `finalize-collect.ts`, `finalize-checks.ts`, `finalize-explain.ts`는 수집·검사·설명 단계를 맡고 `finalize.ts`는 흐름을 연결한다. task 상태와 explain 구간 파싱은 새 의존성 순환을 만들지 않도록 각 경계 안에서 처리한다.

`cli-usage.ts`에는 정적 사용법을 두고 `cli.ts`는 명령별 handler를 지연 로딩한다. help와 알 수 없는 명령은 업무 handler를 적재하지 않는다.

검증 근거는 blueprint digest의 task evidence `ad0f79e61d0cf66c9c78777e33010675a5e3d17466919fbfb476eeac04ed9a52`, `e01eec99098b204ed053842c689e38f458cc3331a8a0f077d59580b2249ed4d9`, `e96ff880cd9a89ab31804f4004a43c4a1ec5f4c46ee8807756adf605ef46c1be`, `21ef9b41c19bdf853543bcc3862f2fb511479b70db06e4b1384f14458aa604e7`, `608871a6be1edeff058b9fe6f31d72e3628f143b3bec6981708185f50cf8bdfc`, `4d9ed965167d79d8001f67bc5d50b1f06c46720bd35cdd6042c3502d4f2cc10`에서 확인할 수 있다. blueprint review는 F1·F2를 해결로, F3를 자문 사항으로 기록했다.

## Quiz
기본 검증 대상을 명시하지 않았을 때, 검증 실행부는 어떻게 동작하는가?

- A) 실행부가 `current`를 직접 읽고 대상을 선택한다.
- B) 대상 선택 경계가 `EffectiveTask`를 만들고 실행부에 전달한다.
- C) 대상이 없으면 항상 첫 번째 task를 임의로 선택한다.

## Tasks

### runtime-architecture/boundary-introduction/001 · `95233e2f`

#### Goal & intent

검증 실행부(`verification.ts`)가 선택된 대상만 받고, `current`로 기본 대상을 고르는 편의 절차는 `verification-target.ts`가 맡는다. 완료 기준은 모듈 의존 그래프에서 `verification`이 `current`에 도달하지 않는 것과, 기존 기본 대상 선택 동작을 지키는 테스트가 새 경계로 통과하는 것이다. 검증 명령은 `npm test`.

#### Current behavior

- `scripts/src/lib/verification.ts:22-23`이 `current`를 직접 가져와 `resolveEffectiveTask`를 세 곳에서 부른다.
  - `entriesForVerify` `:158`: 명시 `taskId`가 없을 때 effective task를 본다. `source === null`(lease를 확인하지 못한 worker)이면 `[]`, 같은 blueprint의 effective면 그 항목 하나, 그 밖에는 목록 전체를 돌려준다. 명시 `taskId`가 세 자리가 아니거나 목록에 없으면 `VERIFY_IDENTITY_INVALID`로 throw한다(`:135-151`).
  - `resolveDefaultTaskScope` `:453`: `source === null`이면 `VERIFY_IDENTITY_INVALID` `no active lease for worker worktree`. tasksRel은 effective path, `entries[0].tasks.rel`, 레거시 `${bp}/tasks.md` 순으로 고른다.
  - `maybeMarkCommitTaskVerified` `:1065`: effective가 null이 아니고 source가 null이 아니며, 같은 blueprint의 같은 `entryRel`일 때만 상태를 `verified`로 쓴다(`:1082` `fs.writeFileSync`). `deps`를 넘기는 곳은 여기뿐이다.
- `runVerification` `:1115`의 순서: `readVerifyCommand` → `resolveVerificationRel` → 문서 존재 → scope(입력 또는 기본) → identity·재사용 → 실행 → 기록 → 상태 승격. `readVerifyCommand`·`resolveVerificationRel`·`:1133` 선택이 각자 `entriesForVerify`를 다시 불러, 한 실행에서 effective 조회가 여러 번 일어난다.
- 호출자:
  - `taskId`·scope 없이 호출: `cli-doc-commands.ts:71` `cmdVerify`, `validate.ts:227`(`entriesForVerify`로 G13 파일), `validate.ts:231`(`runVerification`), `validate-docs.ts:213-216`(`resolveTaskUnit`이 `resolveEffectiveTask` 뒤 `entriesForVerify`).
  - 항상 `taskId`와 scope를 넘김: `coordinator.ts:881`, `:2199`, `:2632`. `deps.runVerification` 지연 require로 호출한다.
- `readVerifyCommand(repoRoot, blueprintDir?, taskId?)` `:179`도 `entriesForVerify`로 대상을 고른다. `taskId` 없이 부르는 곳은 `finalize.ts:1167`과 `test/verification-runner.test.js`(`:437`·`:1145-1146`·`:1747-1748` 등 lease·pointer 기대)이고, `taskId`를 넘기는 곳은 `runVerification` `:1142`와 `test/coordinator.test.js:3387`이다.
- `EffectiveTask` 타입은 `current.ts:94`에만 있다.
- I/O 관찰 지점:
  - `verification.ts:345` verify 명령 `spawnSync`(`exec` 주입 가능).
  - `:528` git `spawnSync`.
  - `:1000`·`:1041`·`:1082` 파일 쓰기.
  - `current.ts:636` `resolveEffectiveTask`는 pointer 파일·`git worktree` 판정(`deps.execFileSync`)·lease ledger를 읽는다.
- 재현: `node --test test/verification-runner.test.js test/cli-verify.test.js test/dependency-boundaries.test.js`. 현재 `dependency-boundaries`에는 verification→current 금지 단언이 없다.

#### Target behavior

- 성공:
  - `verification-target.resolveVerificationTarget`이 effective task를 한 번 조회해 `{ effectiveTask, entries }`를 돌려준다.
  - `runSelectedVerification`은 그 결과로 `runVerification`을 부른다.
  - `readVerifyCommand`는 같은 시그니처·결과로 `verification-target`이 내보낸다.
  - `cmdVerify`·`validate`·`validate-docs`·`finalize`는 이 모듈을 쓴다.
  - `verification.ts`는 `current`를 가져오지 않는다.
- 실패: 명시 `taskId`의 `VERIFY_IDENTITY_INVALID` 두 경우와 `no active lease for worker worktree`는 같은 code·메시지로 남는다. `runVerification`에 `taskId`와 `effectiveTask`가 모두 `undefined`면 `VERIFY_TARGET_REQUIRED`로 throw한다.
- 보존:
  - 기본 대상 선택 결과(lease 우선, pointer, 목록 폴백, 빈 목록)가 같다.
  - `markTaskVerified` 승격 조건이 같다.
  - coordinator 호출 경로와 CLI `verify`의 stdout JSON·exit code가 같다.
  - `runVerification`은 effective task를 직접 조회하지 않고 입력으로 받은 값만 쓴다. 이 성질은 `verification`이 `current`에 도달하지 않는다는 모듈 그래프 단언으로 판정한다.

#### Interface

- 제공:
  - `verification-target.ts`
    ```ts
    resolveVerificationTarget(opts: { repoRoot: string; blueprintDir: string; taskId?: string; deps?: VerificationDeps })
      → { effectiveTask: EffectiveTask | null; entries: TaskDocsEntry[] }
    runSelectedVerification(opts: { repoRoot: string; blueprintDir: string; markTaskVerified?: boolean; deps?: VerificationDeps })
      → ReturnType<typeof runVerification>
    readVerifyCommand(repoRoot: string, blueprintDir?: string, taskId?: string): string  // 이동, 동작 불변
    ```
  - `verification.ts`: `selectVerificationEntries(repoRoot, blueprintDir, { taskId?, effectiveTask })`, 선택된 항목으로 명령을 읽는 `readVerifyCommandFor(repoRoot, entries)`. `runVerification` 입력에 `effectiveTask?: EffectiveTask | null`을 더한다.
  - `execution-contracts.ts`: `EffectiveTask` 타입. `current.ts`는 이 정본을 가져다 쓴다.
  - `TaskDocsEntry`는 `tasks-docs.listTasksDocs`가 돌려주는 항목과 같은 모양이다(`{ rel, tasks?: { rel }, verification?: { rel } }`).
  - 도메인 용어 `effectiveTask`: `current.resolveEffectiveTask` 결과와 같은 모양. 예: `{ source: 'lease', blueprint: '.bouncer/context/epics/106-x/blueprints/002-y', path: '.../tasks/001/tasks.md', id: 'TASKS-001', lease_id: 'L1', generation: 1 }`. `null`은 pointer task가 없다는 뜻이다.
- 거부 (throw):
  - `taskId`가 `^\d{3}$`가 아니거나 목록에 없으면 `VERIFY_IDENTITY_INVALID`.
  - `effectiveTask.source === null`이고 호출자가 `scope`를 넘기지 않아 기본 scope를 계산해야 하면 `VERIFY_IDENTITY_INVALID` `no active lease for worker worktree`.
  - `taskId`가 `undefined`이고 `effectiveTask`도 `undefined`(키 부재)면 `VERIFY_TARGET_REQUIRED`. `effectiveTask: null`은 throw하지 않는다.
- 폴백 (throw 아님):
  - `effectiveTask === null`이거나 다른 blueprint를 가리키면 목록 전체.
  - `source === null`이면 목록 선택은 빈 목록이다. `scope`가 주어진 실행은 지금처럼 빈 목록 기준으로 명령·문서를 고른다.
  - 목록이 mixed면 빈 목록.
- 제거: `verification`의 `entriesForVerify`·`readVerifyCommand` export. 저장소 안 소비자는 모두 새 경계로 옮긴다.
- 테스트 seam: `deps`(`VerificationDeps`)는 `resolveVerificationTarget`이 `resolveEffectiveTask`에 넘긴다. 상태 승격 판정은 `runVerification`이 받은 `effectiveTask`만 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/verification-target.ts` | `resolveVerificationTarget`, `runSelectedVerification` | Create | 없음 | effective 조회와 기본 대상 실행 편의 절차 | 대상 선택 경계의 새 위치 |
| `scripts/src/lib/verification.ts` | `entriesForVerify`, `resolveDefaultTaskScope`, `maybeMarkCommitTaskVerified`, `runVerification` | Modify | `current`로 effective를 직접 조회 | `effectiveTask` 입력만 사용, `current` import 제거, `selectVerificationEntries`로 export 교체 | explain(runVerification): 호출 18 / 파일 4 |
| `scripts/src/lib/execution-contracts.ts` | `EffectiveTask` | Modify | Task·ledger 타입 정본 | `EffectiveTask` 타입 추가 | verification이 current 없이 타입을 쓰는 지점 |
| `scripts/src/lib/current.ts` | `EffectiveTask`, `resolveEffectiveTask` | Modify | 타입 선언과 조회 | 지역 타입을 정본 import로 교체(동작 불변) | 타입 정본 단일화 |
| `scripts/src/lib/cli-doc-commands.ts` | `cmdVerify` | Modify | `runVerification` 직접 호출 | `runSelectedVerification` 호출 | taskId 없는 호출자 |
| `scripts/src/lib/validate.ts` | execute gate G13 블록 | Modify | `entriesForVerify`·`runVerification` 직접 호출 | `resolveVerificationTarget`·`runSelectedVerification` 사용 | explain(entriesForVerify) 호출자 |
| `scripts/src/lib/finalize.ts` | import 블록(`readVerifyCommand`) | Modify | `verification`에서 `readVerifyCommand` | `verification-target`에서 가져옴(import 한 줄만) | `taskId` 없는 `readVerifyCommand` 소비자 |
| `scripts/src/lib/validate-docs.ts` | `resolveTaskUnit` | Modify | `resolveEffectiveTask` 뒤 `entriesForVerify` | `resolveVerificationTarget` 결과 사용 | explain(entriesForVerify) 호출자 |
| `test/verification-runner.test.js` | 기본 대상·lease·markTaskVerified 묶음 | Modify | `entriesForVerify`·`readVerifyCommand`·taskId 없는 `runVerification` 사용 | 새 경계 함수로 호출을 옮기고 `VERIFY_TARGET_REQUIRED` 단언 추가 | 옛 export 제거 대상 소비자 |
| `test/coordinator.test.js` | `readVerifyCommand` require | Modify | `verification`에서 가져옴 | `verification-target`에서 가져옴 | 옛 export 제거 대상 소비자 |
| `test/dependency-boundaries.test.js` | 모듈 그래프 단언 | Modify | 저층 모듈 금지 도달만 검사 | `verification`이 `current`에 도달하지 않는 단언과 가짜 그래프 유효성 단언 추가 | 경계 회귀 검사 |

#### Constraints

- 오류 code·메시지 문자열과 CLI `verify` 출력 JSON 키는 바꾸지 않는다.
- `verification-target.ts`는 `cli-*`·`validate*`·`finalize`·`coordinator`를 가져오지 않는다.
- `EffectiveTask`는 `execution-contracts.ts`의 타입 전용 정본에서 가져오며, 컴파일 결과에 `current` require가 생기지 않아야 한다.
- 모듈 값 경계는 기존처럼 `export =` / `import = require()`만 쓴다.
- coverage 임계값(94/82/96)을 유지한다.

### runtime-architecture/boundary-introduction/002 · `bfef745a`

#### Goal & intent

`commit`·`finalize-digest`·`finalize-pr`·`retention-migration`이 `finalize`를 가져오지 않고, 공통 Git·커밋 메시지 모듈과 finalize 단계 모듈을 쓴다. `finalize.ts`는 `finalize()` 조정과 그 전용 helper만 남긴다. 완료 기준은 모듈 의존 그래프에서 네 모듈이 `finalize`를 직접 가져오지 않는 것과, 기존 finalize·commit 테스트가 결과 값 변경 없이 통과하는 것이다. 검증 명령은 `npm test`.

#### Current behavior

- `scripts/src/lib/finalize.ts`(1,326줄)의 `export =` `:1317`이 12개를 내보낸다. 기능별 묶음과 내부 의존은 다음과 같다.
  - 공통 Git·커밋 메시지:
    - `realGit` `:405`: `execFileSync` git `:406`·`:415`, `pre-commit-hook.internalCommitEnv`. `GitApi` 타입은 `:44`.
    - `buildCommitMessage` `:210`: `asRecord` `:190`, `authoredContainsBouncerTrailer` `:204`, `templates.normalizeAuthoredLines`, `commit-sha.buildStableProvenance`.
    - `buildFinalizeCommitMessage` `:254`: `asRecord`, `templates.parseIntentBody`.
    - `resolveCheckoutBranch` `:683`: `execFileSync` git symbolic-ref `:686`.
  - 수집:
    - `collectTaskCommits` `:471`: `explainParentIds` `:434`, `STABLE_TASK_RE` `:58`.
    - `collectCoordinatorProvenance` `:793`: `provenanceFromLedgerRead` `:761`, `buildCoordinatorProvenance` `:716`, `stringOrNull` `:671`, `scope.readCoordinatorLedger`.
    - `collectTransientRels` `:323`: `isBlueprintReviewScopeAt` `:363`.
  - 검사: `buildIntegration` `:832`, `coordinatorEvidenceMismatches` `:888`, `threeDigitTaskId` `:815`, `readTaskStatus` `:917`. export하지 않고 `finalize()` `:1028`·`:1060`만 쓴다.
  - explain 쓰기: `writeExplainTaskCommits` `:546`(`STABLE_TASK_RE`), `buildTaskContext` `:592`(`stableIdFromTaskData` `:67`), `writeExplainTaskContext` `:649`(`replaceTaskContext` `:639`).
  - `finalize()` 전용: `finalize` `:991`, `stableIdFromTaskData`(`:1247`에서도 사용), `resolveFinalizeTrailerBase` `:101`, `codedErrorCode`, `adaptInjectedVerifyExec`, 잠금 helper `:268-300`, `prepareFinalizeDependencies` `:946`.
- 소비자:
  - `commit.ts:15-16`(`realGit` `:323`, `buildCommitMessage` `:417`).
  - `finalize-digest.ts:24-25`(`resolveCheckoutBranch` `:933`, `buildCoordinatorProvenance` `:726`).
  - `finalize-pr.ts:10-11`(`resolveCheckoutBranch` `:403`).
  - `retention-migration.ts:15-19`(`collectTransientRels`·`buildTaskContext`·`writeExplainTaskContext`, `:314`·`:350`·`:572`·`:584`).
  - `cli-git-commands.ts:7-8`(`finalize`).
  - 테스트: `test/finalize-pure.test.js:5-9`·`:893`, `test/finalize.test.js:11`. `finalize`만 가져오는 테스트는 `test/coordinator-e2e.test.js:43`, `test/intent-fence-guard.test.js:12`.
- `finalize-release-main.ts`는 `finalize`를 가져오지 않고 자체 `execFileSync`와 `seed-worktree`를 쓴다. `seed-worktree.ts:256`의 `realGit`은 별도 구현이다.
- I/O 관찰 지점:
  - 위 git 호출 외에 `finalize` `:1242` git rev-parse.
  - 파일 쓰기: `writeClosedLock` `:297`, `writeExplainTaskCommits` `:553`·`:574`, `writeExplainTaskContext` `:657`·`:660`, 스냅샷 복원 `:1218-1228`·`:1271-1289`.
  - 주입 seam: `finalize`의 `git`·`verifyExec`·`dependencyExec`·`next`.
- TASKS-001 뒤 `finalize.ts`는 `readVerifyCommand`를 `verification-target`에서 가져온다. 이 import는 유지한다.
- 재현: `node --test test/finalize-pure.test.js test/finalize.test.js test/cli-commit.test.js`. finalize.ts 크기·구조를 고정한 테스트는 없다.

#### Target behavior

- 성공:
  - `git-ops.ts`는 `realGit`·`resolveCheckoutBranch`·`GitApi`를 갖는다.
  - `commit-message.ts`는 `buildCommitMessage`·`buildFinalizeCommitMessage`를 갖는다.
  - `finalize-collect.ts`는 수집 묶음과 `STABLE_TASK_RE`·`stableIdFromTaskData`를 갖는다.
  - `finalize-checks.ts`는 검사 묶음, `finalize-explain.ts`는 explain 쓰기 묶음을 갖는다.
  - `finalize.ts`는 이들을 가져와 `finalize()`를 조정하고 `{ finalize }`만 내보낸다.
  - 소비자는 해당 새 모듈을 직접 가져온다.
- 실패: 새 모듈이 `finalize`를 가져오면 경계 테스트가 실패한다. 함수가 반환하는 오류·값은 이동 전과 같다.
- 보존: 커밋 메시지 바이트(제목·본문·`Bouncer-Task` trailer), explain 문서 바이트, finalize JSON 출력·exit code, 잠금·스냅샷 복원 순서가 같다.

#### Interface

- 제공:
  - `git-ops.ts`: `realGit(repoRoot): GitApi`, `resolveCheckoutBranch(worktreePath: string | null): string | null`, `type GitApi`.
  - `commit-message.ts`: `buildCommitMessage(docs, taskUnit)`, `buildFinalizeCommitMessage(docs)`.
  - `finalize-collect.ts`: `collectTaskCommits`, `collectCoordinatorProvenance`, `buildCoordinatorProvenance`, `collectTransientRels`, `stableIdFromTaskData`, `STABLE_TASK_RE`.
  - `finalize-checks.ts`: `buildIntegration`, `coordinatorEvidenceMismatches`.
  - `finalize-explain.ts`: `writeExplainTaskCommits`, `buildTaskContext`, `writeExplainTaskContext`.
  - `finalize.ts`: `{ finalize }`.
  - 시그니처·반환 모양은 현재 정의 그대로다.
- 거부: 새 시그니처나 오류 code는 없다. 기존 함수의 거절 동작(예: `buildCommitMessage`의 malformed `commit_intent` 거절)을 그대로 옮긴다.
- 제거: `finalize`의 나머지 11개 export. 저장소 안 소비자는 모두 새 모듈로 옮긴다.
- 영역 경계: `retention-migration`은 closed blueprint의 explain·transient 정리를 맡는 delivery 영역 모듈이다. delivery 영역 안의 모듈은 단계 모듈(`finalize-collect`·`finalize-explain`)을 직접 가져올 수 있고, 영역 밖 소비자는 `finalize`·`git-ops`·`commit-message`만 쓴다.
- 의존 방향: 새 다섯 모듈은 `finalize`·`cli-*`·`coordinator`를 가져오지 않는다. `finalize-explain`은 `finalize-collect`의 `STABLE_TASK_RE`·`stableIdFromTaskData`를 가져올 수 있다. `asRecord` 같은 한 줄 타입 단언은 기존 `finalize-digest.ts:155`·`finalize-pr.ts:63`처럼 모듈마다 둔다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/git-ops.ts` | `realGit`, `resolveCheckoutBranch`, `GitApi` | Create | 없음 | finalize에서 이동 | 공통 Git 기능 경계 |
| `scripts/src/lib/commit-message.ts` | `buildCommitMessage`, `buildFinalizeCommitMessage` | Create | 없음 | finalize에서 이동 | explain(buildCommitMessage): commit 소비자 |
| `scripts/src/lib/finalize-collect.ts` | `collectTaskCommits`, `collectCoordinatorProvenance`, `buildCoordinatorProvenance`, `collectTransientRels`, `stableIdFromTaskData`, `STABLE_TASK_RE` | Create | 없음 | finalize에서 이동 | 수집 단계 |
| `scripts/src/lib/finalize-checks.ts` | `buildIntegration`, `coordinatorEvidenceMismatches` | Create | 없음 | finalize에서 이동 | 검사 단계 |
| `scripts/src/lib/finalize-explain.ts` | `writeExplainTaskCommits`, `buildTaskContext`, `writeExplainTaskContext` | Create | 없음 | finalize에서 이동 | 표현 단계 |
| `scripts/src/lib/finalize.ts` | `finalize`, `export =` | Modify | 모든 단계와 공통 helper 보유 | 단계 모듈 import, `{ finalize }`만 export | explain(finalize): 호출 21 / 파일 2 |
| `scripts/src/lib/commit.ts` | import 블록 | Modify | `finalize`에서 `realGit`·`buildCommitMessage` | `git-ops`·`commit-message`에서 가져옴 | commit이 finalize를 기반으로 쓰는 지점 |
| `scripts/src/lib/finalize-digest.ts` | import 블록 | Modify | `finalize`에서 `buildCoordinatorProvenance`·`resolveCheckoutBranch` | `finalize-collect`·`git-ops`에서 가져옴 | explain(resolveCheckoutBranch) 소비자 |
| `scripts/src/lib/finalize-pr.ts` | import 블록 | Modify | `finalize`에서 `resolveCheckoutBranch` | `git-ops`에서 가져옴 | explain(resolveCheckoutBranch) 소비자 |
| `scripts/src/lib/retention-migration.ts` | import 블록 | Modify | `finalize`에서 helper 3개 | `finalize-collect`·`finalize-explain`에서 가져옴 | `rg collectTransientRels` 소비자 |
| `test/finalize-pure.test.js` | require 블록, 경계 단언 | Modify | `finalize`에서 4개 helper | 새 모듈에서 가져오고, 네 소비자가 `finalize`를 직접 가져오지 않는 모듈 그래프 단언 추가 | 옛 export 소비자·경계 검사 |
| `test/finalize.test.js` | require 블록 | Modify | `finalize`에서 `collectTaskCommits`·`writeExplainTaskCommits` | 새 모듈에서 가져옴 | 옛 export 소비자 |

#### Constraints

- 함수 본문은 옮기기만 하고 동작을 바꾸지 않는다. 테스트의 기대 값(커밋 메시지·explain 바이트)은 수정하지 않는다.
- 여러 기능을 모은 `utils` 파일을 만들지 않는다.
- `finalize.ts` 상단 주석의 "validate↔finalize 순환 회피" 제약을 새 모듈도 지킨다. 새 모듈은 `validate`를 가져오지 않는다.
- 모듈 값 경계는 `export =` / `import = require()`만 쓴다.
- coverage 임계값(94/82/96)을 유지한다.

### runtime-architecture/boundary-introduction/003 · `9f18bfac`

#### Goal & intent

`help`·`--help`·`-h`·인자 없음·unknown-command는 업무 기능 모듈을 적재하지 않고 끝난다. 명령을 고르면 그 명령의 핸들러와 필요한 기능만 적재한다. usage·stdout·stderr·exit code는 바이트 그대로다. 완료 기준은 기능 영역 표로 판정하는 적재 경계 테스트와, 기존 CLI 테스트가 수정 없이 통과하는 것이다. 검증 명령은 `npm test`.

#### Current behavior

- `scripts/src/lib/cli.ts:3-16`이 명령 모듈 13개를 최상위에서 가져온다.
  - `COMMANDS` `:34-77`은 이름→`{ run, usage }` 표이고, help 순서는 키 선언 순서다.
  - `USAGE` `:88`은 적재 시점에 조립된다.
  - unknown-command는 `:104`에서 stderr로 쓰고 exit 2다. 조회는 `Object.hasOwn` `:106`이다.
- 명령 모듈의 최상위 import와 usage 출처:
  - `cli-doc-commands.ts:3-25`: validate·scaffold·verification·plan-inspect·plan-approve 등을 가져온다. usage는 리터럴이다(`:275`·`:281`·`:287`·`:302`).
  - `cli-git-commands.ts:3-27`: finalize·finalize-digest·finalize-pr·commit·seed-worktree·import-history·coordinator·scope·execute-prepare·coordinate-output·finalize-release-main을 가져온다.
    - `coordinate.usage`는 지역 상수(`COORDINATE_USAGE_OVERVIEW` `:325`, `COORDINATE_USAGE_MUTATIONS` `:330`, `COORDINATE_FENCE_NOTE` `:338`, `COORDINATE_USAGE_BLOCKS` `:344-590`)로 `coordinateRegistryUsage()` `:599-603`이 만든다. 호출은 `:1041`에서 적재 시점에 한다.
    - subcommand help는 `:636-637`(stderr)와 `:696-701`(stdout)에서 출력한다.
  - `cli-project-commands.ts:3-25`: init·graphify·session-graph·migrate-task-layout·retention-migration·run-preflight·subagents·codex-agents를 가져온다. `intent`만 `:80`에서 지연 require한다.
  - 나머지 단일 명령 모듈(`cli-current-command`, `cli-review-dispatch-command`, `cli-review-command`, `cli-context-review-command`, `cli-dispatch-command`, `cli-commit-guard-command`, `cli-config-command`, `cli-retro-command`, `cli-metrics-command`)은 최상위 usage가 리터럴이거나 지역 상수다. 외부 enum이 필요한 것은 subcommand HELP뿐이다.
- 측정(빌드 후 `node -e`):
  - `require('./scripts/lib/cli')`만으로 `scripts/lib` 모듈 80개가 적재되고, `runCli(['--help'])` 뒤에도 80개다. 기준선 `c94947e7`은 77이었다.
  - 이미 지연 적재되는 모듈: intent-bundle, intent-provenance, symbol-index, cli-intent-command, review-dispatch, review-record, context-review-state, print-dispatch.
- I/O 관찰 지점: cli-* 모듈은 최상위에서 프로세스를 실행하거나 파일을 읽지 않는다. 적재 시점 계산은 `cli.ts:88` `USAGE`와 `cli-git-commands.ts:1041`뿐이다.
- 기존 검사:
  - `test/cli-project-commands.test.js:332-370`이 자식 프로세스(`spawnSync` `node -e`, `:23-30`)에서 `loadedAreas`로 intent 미적재를 검사한다.
  - `test/helpers/feature-areas.js`의 `FEATURE_AREAS`에는 `intent`만 있다.
  - `test/cli-help.test.js`는 명령별 usage 부분 문자열, `help`·`--help`·`-h`의 동일 출력(`:79`), unknown의 stderr·exit 2(`:92`)를 검사한다. help 전체 바이트를 고정한 단언은 없다.
- 직접 require하는 소비자:
  - `test/cli-current.test.js:572` `{ current }`.
  - `test/cli-commit-guard.test.js:93`·`:108` `{ runCommitGuard }`.
  - `test/retro-read.test.js:12`, `test/retro-sources.test.js:14` (cli-retro-command).
  - 다수 테스트의 `{ runCli, parseFlags }`.

#### Target behavior

- 성공:
  - `cli.ts`는 최상위에서 `cli-flags`와 `cli-usage`만 가져온다.
  - 레지스트리 항목은 `{ usage, load }`이고, help는 `cli-usage`로 조립한다.
  - 명령 dispatch 때 `load()`가 명령 모듈을 require한다.
  - 여러 명령을 담은 모듈(`cli-doc-commands`, `cli-git-commands`, `cli-project-commands`)은 기능 모듈 import를 각 핸들러 안 지연 require로 옮긴다. `commit`을 고르면 delivery 영역은 적재되고 execution 영역은 적재되지 않는다(TASKS-002 뒤 `commit`은 coordinator에 도달하지 않는다).
- 실패: 오타 명령·prototype 키(`toString`)는 지금처럼 unknown-command, stderr, exit 2다. 지연 require 대상 모듈이 없으면 Node의 module-not-found가 그대로 던져진다(삼키지 않는다).
- 보존:
  - `help`·unknown·`<command> --help`·`coordinate <sub> --help`의 stdout·stderr 바이트와 exit code.
  - 명령 모듈의 기존 export 모양(`{ run, usage }`, `{ current }`, `{ runCommitGuard }` 등).
  - `cli`의 `{ runCli, parseFlags }`.

#### Interface

- 제공:
  - `cli-usage.ts`: 명령 이름→usage 문자열 표와 `coordinate` subcommand help 블록. 업무 기능 모듈을 가져오지 않는다.
    ```ts
    // 신규 추출 지점: 정적 usage 정본
    COMMAND_USAGE: Record<string, string>  // 키 순서 = help 나열 순서
    coordinateUsage(sub?: string): string
    ```
  - `cli.ts` 레지스트리 항목: `{ usage: string; load: () => CliHandler }`.
  - `test/helpers/feature-areas.js`의 `FEATURE_AREAS`에 영역 4개를 더한다.
    - `execution`: `coordinator`, `coordinate-next`, `coordinate-advance`, `execute-prepare`, `coordinate-output`
    - `verification`: `verification`, `verification-target`
    - `delivery`: `finalize`, `finalize-digest`, `finalize-pr`, `finalize-release-main`, `finalize-collect`, `finalize-checks`, `finalize-explain`, `commit`, `import-history`, `retention-migration`
    - `graph`: `graphify`, `session-graph`, `graph-exec`, `graph-scope`
- 거부: 등록되지 않은 명령과 own key가 아닌 이름은 unknown-command(exit 2)다.
- 테스트 seam: 적재 검사는 기존처럼 자식 프로세스의 `Object.keys(require.cache)`를 `loadedAreas`로 판정한다. 새 주입 파라미터는 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-usage.ts` | 신규 추출 지점: 정적 usage 정본 | Create | 없음 | 명령별 usage와 coordinate usage 상수 보유 | help가 업무 모듈 없이 조립되는 지점 |
| `scripts/src/lib/cli.ts` | `COMMANDS`, `USAGE`, `runCli` | Modify | 13개 모듈 즉시 import | `{ usage, load }` 레지스트리와 지연 dispatch | explain(runCli), query(COMMANDS) |
| `scripts/src/lib/cli-git-commands.ts` | `coordinateRegistryUsage`, `COORDINATE_USAGE_*`, 핸들러 import | Modify | 기능 모듈 11개 즉시 import, coordinate usage 보유 | usage 상수를 `cli-usage`로 옮기고 기능 import를 핸들러 안으로 | 중간 집합 분해 |
| `scripts/src/lib/cli-doc-commands.ts` | 핸들러 import | Modify | validate·verification 등 즉시 import | 핸들러 안 지연 require, usage는 `cli-usage` 참조 | 중간 집합 분해 |
| `scripts/src/lib/cli-project-commands.ts` | 핸들러 import | Modify | init·graphify 등 즉시 import | 핸들러 안 지연 require, usage는 `cli-usage` 참조 | 중간 집합 분해 |
| `scripts/src/lib/cli-current-command.ts` | `usage` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `usage` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-review-command.ts` | `USAGE_BLOCK` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-context-review-command.ts` | `USAGE_BLOCK` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-dispatch-command.ts` | `USAGE_BLOCK` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-commit-guard-command.ts` | `usage` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-config-command.ts` | `USAGE_BLOCK` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-retro-command.ts` | `USAGE_BLOCK` | Modify | 리터럴 usage | `cli-usage` 참조 | usage 정본 단일화 |
| `scripts/src/lib/cli-metrics-command.ts` | `USAGE_BLOCK`, `KINDS` | Modify | 지역 `KINDS`로 usage 조립 | 조립 결과를 `cli-usage`로 옮김 | usage 정본 단일화 |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS` | Modify | `intent`만 | 영역 4개 추가 | 적재 경계 판정 표 |
| `test/cli-project-commands.test.js` | lazy 적재 테스트 | Modify | intent 미적재만 검사 | help·unknown·`project-root`·`graphify-bin`·`commit` 영역 단언과 `cli-usage` 단독 적재 단언 추가 | 성공 기준 6 |

#### Constraints

- usage 문자열은 바이트 그대로 옮긴다. help 조립 규칙(`join('')`, 꼬리말 앞 빈 줄 한 번)을 유지한다.
- `cli-usage.ts`는 `cli-*`와 업무 기능 모듈을 가져오지 않는다.
- 지연 require는 기존 `require('./x') as typeof import('./x')` 관례를 따른다. 범용 로더·DI 컨테이너를 만들지 않는다.
- 적재 수를 목표값으로 고정하지 않는다. 영역 단위로만 단언한다.
- 모듈 값 경계는 `export =` / `import = require()`만 쓴다.
- coverage 임계값(94/82/96)을 유지한다.

### runtime-architecture/boundary-introduction/004 · `5cb910db`

#### Goal & intent

`docs/architecture/source-boundaries.md`에 이 blueprint가 정한 verification·delivery·CLI 영역의 모듈 배치, 공개 경계 함수, 제거한 export와 호환 영향, CLI 적재 범위 측정 결과를 기록한다. 완료 기준은 `:59`의 "영역별 모듈 배치 표는 미분류" 문장이 표로 바뀌고, 문서에 적은 현재 export는 빌드된 모듈의 export 키에 있으며 제거했다고 적은 export는 옛 모듈의 키에 없는 것이다. `:42`의 모듈별 소비자 전수 표는 이번에도 미분류로 둔다. 검증 명령은 `npm test`.

#### Current behavior

- `docs/architecture/source-boundaries.md`(77줄)의 구조:
  - 절: `## 기준선` `:5`, `## 소비자 inventory` `:25`(하위 `### 외부 진입점` `:27`, `### 내부 helper export` `:40`, `### 한계` `:44`), `## 기능별 공개 경계 초안` `:48`, `## 구현 고정 테스트 inventory` `:61`.
  - 기준선 표 `:9-21`의 "후" 열은 모두 `미측정(후속 blueprint가 채움)`이다. 이 열은 마지막 blueprint(003)가 채운다.
  - CLI 적재 행 `:16`은 기준선 77이다.
  - 경계 초안 표 `:52-57`의 verification `:56`·delivery `:57` 행은 함수 이름이 "후속 blueprint가 확정"으로 남아 있다. CLI 행은 없다.
  - `:59`는 "영역별 모듈 배치 표는 미분류"다. `:42`는 모듈별 소비자 전수 표가 미분류라고 적는다.
  - `### 한계` `:44-46`은 `package.json` `files`가 `scripts/lib/`를 배포하므로 저장소 밖 사용을 배제할 수 없다고 적는다.
- `docs/architecture/rule-ownership.md`의 코드 앵커(`:19`)는 coordinator·scaffold 함수다. 이번 blueprint에서 옮기는 함수는 없다.
- 이 문서를 검사하는 스크립트·테스트는 없다. `scripts/check-doc-shape.js`의 `classifyDocPath`는 `docs/architecture/`를 분류하지 않는다.

#### Target behavior

- 성공:
  - `## 기능별 공개 경계 초안`의 verification·delivery 행이 확정 함수 이름을 갖는다.
    - verification: `verification-target.resolveVerificationTarget`·`runSelectedVerification`·`readVerifyCommand`, `verification.runVerification`.
    - delivery: `git-ops.realGit`·`resolveCheckoutBranch`, `commit-message.buildCommitMessage`·`buildFinalizeCommitMessage`, `finalize.finalize`. `retention-migration`은 delivery 영역 안의 소비자라 단계 모듈을 직접 쓴다고 적는다.
  - CLI 행이 더해진다.
  - `:59`의 미분류 문장이 영역별 모듈 배치 표로 바뀐다.
    - 표 열: `영역 | 모듈 | 책임 | 공개 경계 여부`.
    - 대상: TASKS-001~003이 만들거나 바꾼 모듈.
  - `### 한계` 아래에 제거한 export 목록과 대체 위치가 더해진다.
    - `verification.entriesForVerify` → `verification.selectVerificationEntries`·`verification-target.resolveVerificationTarget`.
    - `verification.readVerifyCommand` → `verification-target.readVerifyCommand`.
    - `finalize.buildCommitMessage`·`buildFinalizeCommitMessage` → `commit-message`.
    - `finalize.realGit`·`resolveCheckoutBranch` → `git-ops`.
    - `finalize.collectTransientRels`·`collectTaskCommits`·`buildCoordinatorProvenance`·`collectCoordinatorProvenance` → `finalize-collect`.
    - `finalize.buildTaskContext`·`writeExplainTaskCommits`·`writeExplainTaskContext` → `finalize-explain`.
    - 저장소 밖 소비자는 대체 모듈로 옮겨야 한다는 호환 영향 한 문장.
  - CLI 적재 범위 결과는 표 옆 문단에 적는다: 변경 후 `require` 직후 수와 `--help` 뒤 수, 기준선 77과 영역별 미적재 판정.
- 보존: 기준선 표의 "후" 열, 구현 고정 테스트 inventory, planning·execution 행은 바꾸지 않는다.
- 판정 근거(빌드 후): 현재 export로 적은 이름은 `node -e "console.log(Object.keys(require('./scripts/lib/<모듈>')).includes('<이름>'))"`가 `true`, 제거했다고 적은 이름은 옛 모듈에서 `false`다. 이 문서를 검사하는 테스트가 없으므로 이 확인 결과가 `npm test`와 함께 완료 증거다.

#### Interface

- 제공: `docs/architecture/source-boundaries.md`의 확정 경계 행, 영역별 모듈 배치 표, 제거 export·호환 영향 목록, CLI 적재 범위 문단.
- 거부: 측정하지 않은 값을 쓰지 않는다. 적재 수는 이 task가 통합 결과에서 직접 측정한다.
  ```bash
  npm run build
  node -e "require('./scripts/lib/cli'); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"
  node -e "require('./scripts/lib/cli').runCli(['--help'],{out(){},err(){}}); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"
  ```

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/source-boundaries.md` | `## 기능별 공개 경계 초안`, `### 한계` | Modify | 기준선·경계 초안·미분류 표기 | 확정 경계·배치 표·제거 export·적재 범위 기록 | 에픽 성공 기준 9·10의 추적 문서 |

#### Constraints

- 기준선 표의 "후" 열은 채우지 않는다(BP 003 담당).
- 문서는 규칙의 정본이 아니라는 첫 문단의 성격을 유지한다.
- 측정값은 명령과 함께 적는다.

### runtime-architecture/boundary-introduction/005 · `7c184746`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F1 (major, spec_scope, must_fix) — scripts/src/lib/cli.ts#COMMANDS — tasks/003 constraints
- F2 (major, correctness_tests, must_fix) — test/verification-runner.test.js#runVerification — tasks/001 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/cli.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/verification-runner.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### runtime-architecture/boundary-introduction/006 · `2b135176`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F2 (major, correctness_tests, must_fix) — test/verification-runner.test.js#runVerification — tasks/001 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/verification-runner.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
