---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/087-v153-evaluation-remediation/blueprints/001-commit-enforcement/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-06T14:53:52.351+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '087'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 5adf07690c0caaa6d0d237603c83abab0565ac1f
      range_to: 659d80b099a494974e41bec55493038d3b56c81e
      diff_sha: a17fd7e98bc1d102c4fdd7c65a6e481449360c1d25308bae1060ead6b15d647e
      recorded_at: '2026-10-06T14:56:00+09:00'
  task_commits:
    - task: EPIC-087/BP-001/TASK-001
      sha: 6d9aadad
      intent_anchor: task-001
    - task: EPIC-087/BP-001/TASK-002
      sha: d87c5079
      intent_anchor: task-002
    - task: EPIC-087/BP-001/TASK-003
      sha: 2a5abca2
      intent_anchor: task-003
    - task: EPIC-087/BP-001/TASK-004
      sha: e372cf6b
      intent_anchor: task-004
    - task: EPIC-087/BP-001/TASK-005
      sha: 659d80b0
      intent_anchor: task-005
---
# Explain

## Background

Bouncer 강제력은 실수(범위 밖 스테이징, 손기록 검증, verify 뒤 소스 변경, 실행 중 승인 범위 변경)를 게이트와 git hook으로 거절한다. 절대 경로 git, `--no-verify`, `core.hooksPath` 변경 같은 고의 우회는 막지 않는다. 이 블루프린트는 그 경계를 `docs/threat-model.md`에 적고, 세 가지 실수 경로를 코드로 닫는다.

## Intuition

검증이 끝난 저장소와 승인한 범위를 찍은 스냅샷이 있고, 그 이후에 손이 가면 커밋이 멈춘다.

## Code

- `scripts/src/lib/verification.ts`, `validate-gates.ts` — verify 원장에 `source_digest`를 남긴다. commit 게이트 **G23**은 이 값과 현재 checkout을 대조한다. 필드가 없는 구 원장은 건너뛴다.
- `scripts/src/lib/commit-hook.ts` — `evaluateStaged`는 `evaluateCommit({ command: 'git commit' })`과 같은 판정이다.
- `scripts/src/lib/pre-commit-hook.ts`, `cli-commit-guard-command.ts` — `bouncer init --pre-commit-hook`이 POSIX `sh` hook을 설치하고, hook은 `commit-guard --staged`를 호출한다. CLI를 못 찾으면 커밋을 허용한다. `pre-commit.bouncer-prev`가 이미 있으면 두 번째 설치는 덮어쓰지 않고 실패한다. `BOUNCER_INTERNAL_COMMIT=1`이면 hook이 검사를 건너뛴다.
- `scripts/src/lib/approval-snapshot.ts`, `cli-current-command.ts`, `validate-gates.ts` — 활성화 시점 승인 digest를 파일에 쓴다. execute·commit 게이트 **G24**는 파일이 있을 때만 현재 digest와 대조한다. 의도한 변경은 사용자 승인 뒤 `bouncer current --set --reapprove`로 스냅샷을 다시 쓴다. coordinator 원장이 있으면 G24 대신 `scope_revision`이 정본이다.
- `docs/threat-model.md` — 막는 것(G17, G13, G23, G24, pre-commit)과 막지 않는 우회를 나열한다.

## Quiz

1. `bouncer verify` 이후 소스를 고치고 `/bouncer-commit`을 돌리면?
   - A) 원장의 `source_digest`·`identity.head`가 현재 checkout과 다르면 **G23**이 거절한다
   - B) 테스트가 통과하면 **G13**만 보고 통과한다
   - C) `source_digest`가 없는 구 원장도 **G23**이 항상 거절한다

2. 설치한 pre-commit hook이 PATH에서 `bouncer`와 설치 시점 런처를 못 찾으면?
   - A) hook이 커밋을 거절한다
   - B) Git이 `--no-verify`로 재시도한다
   - C) hook이 커밋을 허용한다

3. 승인 파일이 없을 때 execute·commit 게이트의 **G24**는?
   - A) 게이트가 실패한다
   - B) 대조를 건너뛴다
   - C) coordinator 원장이 없어도 `--reapprove`가 필수다

4. 실행 중 task 승인 범위를 바꾼 뒤 게이트를 통과하려면?
   - A) 에이전트가 스스로 `bouncer current --set --reapprove`를 실행한다
   - B) 승인 파일을 지우면 **G24**가 통과한다
   - C) 사용자 승인 뒤 `bouncer current --set --reapprove`로 스냅샷을 다시 쓴다

5. `pre-commit.bouncer-prev`가 이미 있을 때 두 번째 `installPreCommitHook`은?
   - A) 기존 prev를 덮어쓰지 않고 실패한다
   - B) 현재 hook을 prev로 덮어쓰고 설치를 계속한다
   - C) `core.hooksPath`를 지우고 설치한다

## Tasks

### EPIC-087/BP-001/TASK-001 · `6d9aadad`

#### Goal & intent

`docs/threat-model.md`가 Bouncer 강제력이 막는 실수와 막지 않는 의도적 우회를 구분해 서술하고, README와 `docs/README.md`가 이 문서를 링크한다. CHANGELOG `[Unreleased]`에 TASKS-002~004의 변경을 기록한다. 서술하는 보증은 TASKS-002~004가 integrated된 상태의 코드와 일치해야 한다. 수용 기준은 epic Success criteria 1·7이고 검증 명령은 `npm test`다.

#### Current behavior

- 위협 모델 문서가 없다. `docs/`에는 `README.md`, `install.md`, `workflow.md`, `configuration.md`, `architecture/rule-ownership.md`만 있다.
- `docs/README.md:3`은 "사람용 문서는 아래 네 개만 유지합니다."라고 쓰고, 표(:5-10)에 install, workflow, configuration, Changelog를 둔다.
- README.md에는 보증 수준을 다룬 문장이 두 곳 있다.
  - :80-82: "PreToolUse 커밋 가드는 실수 방지용이며 악의적 우회를 막지 않습니다. 신뢰 경계는 [`AGENTS.md`](AGENTS.md) hard rule 1이 정본입니다."
  - :74: 목차 링크 `docs/README.md`.
- 같은 면책 문장이 `docs/workflow.md:155`에도 있다.
- 코드 주석 `scripts/src/lib/commit-hook.ts:51`: "guard는 실수를 막습니다. 의도적 우회에 대한 방어는 아닙니다".
- 문서 검사와 테스트
  - `scripts/check-doc-shape.js`(`npm run lint:docs`)는 `skills/`, `agents/`, `references/`만 검사하고 `docs/`와 README는 보지 않는다.
  - `test/master-rules.test.js:868`은 README.md, docs/README.md, docs/configuration.md, docs/workflow.md가 `rules/gates.md`를 언급하지 않는지 본다.
  - `test/distribution.test.js:96`은 `docs/`를 npm 패키지 제외 대상으로 단언한다.
- CHANGELOG.md는 Keep a Changelog 형식이고 `## [Unreleased]`가 비어 있다.

#### Target behavior

- 성공: `docs/threat-model.md`에 `## 막는 것`, `## 막지 않는 것`, `## 전제 조건` 세 절이 있다.
  - 막는 것: 범위 밖 파일 커밋, 실행하지 않은 검증 주장, verify 뒤 소스 수정(G23), execute·commit 게이트에서의 실행 중 승인 범위 변경(G24), hook을 설치한 저장소에서 PreToolUse 훅 없는 호스트의 커밋(`commit-guard` pre-commit hook).
  - 막지 않는 것: `/usr/bin/git`·서브셸·인터프리터 경유 커밋의 PreToolUse 탐지, `git commit --no-verify`, `core.hooksPath` 변경, `BOUNCER_INTERNAL_COMMIT=1` 직접 설정, 게이트를 거치지 않는 raw `git commit`의 승인 범위 대조(G24는 게이트에서만 판정), 서명 없는 원장 JSON 위조, 승인 파일·verify 원장을 직접 고쳐 게이트를 속이는 조작.
  - 전제 조건: 증거에 `source_digest`가 있을 것, 승인 파일이 있을 것, 사용자가 `--pre-commit-hook`에 동의했고 `core.hooksPath`가 없으며 hook이 CLI를 찾을 것, coordinator 경로는 `scope_revision`이 정본이라는 점.
- 성공: README.md :80-82 문단 끝에 `docs/threat-model.md` 링크가 있다. `docs/README.md` 표에 행이 추가되고 :3 문장이 개수와 맞게 바뀐다.
- 성공: CHANGELOG `[Unreleased]`의 `### Added`에 G23, G24와 `current --set --reapprove`, `commit-guard`와 init pre-commit hook, 위협 모델 문서 항목이 있다.
- 보존: 기존 문서의 다른 절과 링크는 바뀌지 않는다. 새 문서는 `rules/gates.md`를 언급하지 않는다. `docs/`는 계속 npm 패키지에서 빠진다.

#### Interface

- 제공: 사람용 문서 `docs/threat-model.md`와 README·목차 링크. 런타임 동작 변경은 없다.
- 거부: 코드가 강제하지 않는 보증을 "막는 것"에 넣지 않는다. 각 항목은 G 코드, CLI, hook 중 하나를 근거로 가리킨다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/threat-model.md` | 문서 전체 | Create | 없음 | 막는 것·막지 않는 것·전제 조건 세 절 | 위협 모델 정본 |
| `docs/README.md` | 문서 목차 표, :3 문장 | Modify | 네 문서만 나열 | 위협 모델 행 추가와 개수 문장 수정 | 사람용 문서 목차 |
| `README.md` | `## Documentation` :80-82 | Modify | 면책 한 문장만 있음 | 위협 모델 링크 추가 | 사용자가 보증 수준을 처음 읽는 곳 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 비어 있음 | blueprint 변경 항목 추가 | 프로젝트 릴리스 기록 규칙 |

#### Constraints

- 문서 본문은 한국어로 쓰고, G 코드·CLI·경로는 원문 그대로 둔다.
- "막는 것"의 각 항목은 integrated된 코드에서 실제 G 코드·명령 이름과 일치해야 한다. 구현 결과와 다른 이름이 나오면 문서를 코드에 맞춘다.
- 검증 외 절차 서술은 `docs/workflow.md`에 두고 이 문서에서 반복하지 않는다.

### EPIC-087/BP-001/TASK-002 · `d87c5079`

#### Goal & intent

verify가 통과한 뒤 `.bouncer/` 밖 파일이 바뀌거나 HEAD가 움직이면 commit 게이트가 `G23`으로 실패한다. verify 뒤 `verification.md`, task·review status처럼 `.bouncer/` 문서만 바뀐 정상 흐름은 통과한다. 수용 기준은 epic Success criteria 2이고 검증 명령은 `npm test`다.

#### Current behavior

- 입력: execute 게이트가 verify를 실행하고 `computeEvidenceIdentity`(`scripts/src/lib/verification.ts:832-853`)로 `{head, dirty_digest, command, cwd, environment_hash, scope}`를 만든다. 원장과 `verification.md`에는 이 identity와 `evidence_id`만 남는다.
- `dirty_digest`(`computeDirtyDigest`, `verification.ts:763-785`)는 `git status --porcelain=v1 -z`의 XY 열과 파일 내용을 해시한다. `.bouncer/` 파일도 포함하고, 새 디렉터리는 상수 `'dir'` 하나로 해시한다. 원장에는 해시만 있어 나중에 경로를 빼고 다시 계산할 수 없다.
- 상태: commit 게이트(`validate-gates.ts:1023-1097`)는 `checkG13`(`validate-gates.ts:589-686`)으로 문서·원장 일치와 `evidence_id == sha256Canonical(identity)`만 본다. 현재 HEAD와 작업 트리로 다시 계산하지 않는다.
- 출력: verify 뒤 `scripts/` 아래 파일을 고친 다음 `bouncer validate --gate commit`을 돌려도 통과한다.
- 순서: verify 실행 → `recordVerificationResult`(`verification.ts:901`)가 `verification.md`를 `passed`로 씀 → controller가 task·review status를 바꿈 → commit이 파일을 stage한 뒤 commit 게이트를 돌린다(`commit.ts:315-331`). 그래서 기존 `dirty_digest`를 그대로 다시 계산해 비교하면 정상 흐름도 항상 실패한다.
- verify와 commit은 같은 checkout에서 돈다. 일반 execute는 `--repo || cwd`(`cli-doc-commands.ts:42,65`)이고, coordinator worker도 배정된 task worktree에서 두 단계를 실행한다. 원장은 git common dir에 있다(`defaultReadVerifyLedger`, `validate-gates.ts:502`).
- I/O 관찰 지점: `runGit`(`verification.ts:641-665`)이 `spawnSync('git')`을 부르거나 `deps.git(args) => string`을 쓴다. `dirtyEntryDigest`(`verification.ts:699-754`)는 `fs.realpathSync`·`lstatSync`·`readlinkSync`를 직접 부른다. 게이트 쪽 git 실행은 `gitExec`(`validate-gates.ts:213`)와 `GateDeps.exec`다.
- 재현 경로: `test/verification-runner.test.js`의 mkdtemp 저장소 fixture, `test/validate-gates.test.js`의 `ledgerDeps`·`matchingLedger`(:894-947)와 commit 게이트 `commitCtx`(:2252-2287).

#### Target behavior

- 성공
  - verify 성공을 기록할 때 원장 레코드와 `verification.md` 메타에 `source_digest`를 함께 쓴다. 재사용 hit로 다시 기록할 때도 그 시점 값을 쓴다.
  - commit 게이트는 G13이 통과한 뒤 원장 레코드의 `source_digest`와 `identity.head`를 현재 checkout 값과 비교한다. 둘 다 같으면 G23을 내지 않는다.
- 실패
  - 현재 HEAD가 `identity.head`와 다르면 `G23 verification evidence is stale: HEAD moved after verify`.
  - 현재 `source_digest`가 다르면 `G23 verification evidence is stale: sources changed after verify`.
  - 두 메시지 모두 `GATE_FAILURE_HINTS`의 G23 `next`를 받는다.
- 보존
  - `identity`, `evidence_id`, `isReuseHit`, G13 판정과 메시지는 바뀌지 않는다.
  - execute 게이트는 G23을 내지 않는다.
  - `source_digest`가 없는 원장 레코드(이 변경 전 증거)와 `repoRoot`가 문자열이 아닌 호출은 G23 대조를 건너뛴다.
  - environment 차이(Node 버전, `.bouncer/config.json`)는 G23 판정에 쓰지 않는다.

#### Interface

- 제공
  - `computeSourceDigest(repoRoot: string, deps?: VerificationDeps): string` — `git status --porcelain=v1 -z -uall` 항목에서 제외 경로를 빼고, 남은 경로마다 `{path, content}`를 경로순으로 `sha256Canonical`한다.
    - `content`는 파일 내용 sha256 hex, 삭제된 경로는 `'deleted'`, symlink는 `'link:' + target`.
    - XY 열은 넣지 않는다. 같은 내용을 stage만 해도 값이 같다.
  - 제외 경로(domain term): `.bouncer/` 아래 전체와 `scope.ts`의 `RUNTIME_ARTIFACTS`(`node_modules/`, `graphify-out/`, `.worktrees/`, `.bouncer/.venv/`, `.bouncer/runtime/`). 예: `.bouncer/context/epics/087-x/blueprints/001-y/tasks/002/verification.md`는 제외되고 `scripts/src/lib/verification.ts`는 포함된다.
  - 원장 레코드·`verification.md` 메타 필드 `source_digest: string`(64자 hex).
  - 게이트 코드 `G23`과 hint: `{ code: 'G23', match: /verification evidence is stale/, next: 'Rerun this checkout\'s active-task \`bouncer verify --blueprint <dir>\`, then rerun the commit gate.' }`.
  - test seam: `GateDeps.sourceDigest?(repoRoot: string) => string`, `GateDeps.exec?(args: string[]) => { status: number, stdout: string, stderr: string }`(기존 shape, `rev-parse HEAD`에 사용).
- 거부 (throw·실패)
  - `computeSourceDigest`의 git 실행 실패와 저장소 밖으로 나가는 경로는 기존 `VERIFY_IDENTITY_INVALID` 오류로 throw한다.
  - 게이트에서 현재 HEAD나 `source_digest` 계산이 실패하면 `G23 verification freshness check failed (<원인 첫 줄>)`로 실패한다. 이 메시지는 원인을 직접 담으므로 hint `next`를 붙이지 않는다.
- 건너뜀 (miss)
  - 원장 레코드에 `source_digest`가 없거나 문자열이 아님.
  - `ctx.repoRoot`가 문자열이 아님.
  - G13이 이미 실패함.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/verification.ts` | `computeSourceDigest`, `recordVerificationResult`, `runVerification` | Modify | identity와 `dirty_digest`만 기록 | `computeSourceDigest`를 추가하고 성공·재사용 기록에 `source_digest`를 넣음 | 증거 기록의 상태 변경 지점 |
| `scripts/src/lib/validate-gates.ts` | 신규 추출 지점: commit 게이트 G23 판정, `GateDeps` | Modify | commit 게이트는 G13 문서·원장 대조만 수행 | G13 통과 뒤 HEAD·`source_digest` 대조를 추가하고 `GateDeps.sourceDigest`를 둠 | 게이트 판정 진입점 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` | Modify | G13·G18·G20·G22 hint만 있음 | G23 hint 추가 | 실패 복구 경로 |
| `test/verification-runner.test.js` | `source_digest` 기록·제외 경로·XY 무시 단언 | Modify | `source_digest` 단언 없음 | 기록, 제외 경로, stage만 한 경우 값 동일, `-uall` 새 디렉터리 단언 추가 | 기록 지점 검증 |
| `test/validate-gates.test.js` | commit 게이트 G23 단언 | Modify | G23 없음 | 소스 변경·HEAD 이동·`.bouncer/`만 변경·레코드에 필드 없음 네 경우 단언 | 게이트 판정 검증 |
| `test/validate-hints.test.js` | hint 코드 목록 | Modify | `['G13','G18','G20','G22']` 고정 | G23 추가 | hint 표 계약 테스트가 목록을 고정함 |
| `test/cli-commit.test.js` | 실제 저장소 commit 흐름 | Modify | verify 기록 뒤 review.md만 씀 | verify 뒤 소스 수정 시 commit 거절 단언 추가 | 실제 git 저장소 end-to-end 경로 |

#### Constraints

- `identity` 필드 집합과 `evidence_id` 계산식을 바꾸지 않는다. 바꾸면 기존 원장과 재사용 hit가 모두 깨진다.
- G13의 기존 메시지 문자열과 순서를 바꾸지 않는다.
- 제외 경로 목록은 `scope.ts`의 `RUNTIME_ARTIFACTS`를 import해서 쓰고, 목록을 새로 복제하지 않는다.
- 소스는 `scripts/src/lib/*.ts`만 고치고 `scripts/lib`는 `npm run build`로 만든다.

### EPIC-087/BP-001/TASK-003 · `2a5abca2`

#### Goal & intent

사용자가 동의해 `bouncer init --pre-commit-hook`으로 hook을 설치한 저장소에서는, PreToolUse 훅이 없어도 범위 밖 staged 파일 커밋이 git pre-commit 단계에서 차단된다. 판정은 PreToolUse 훅과 같은 함수를 쓴다. Bouncer 자신의 커밋은 이미 게이트를 거치므로 hook 검사를 건너뛴다. 수용 기준은 epic Success criteria 3이고 검증 명령은 `npm test`다.

#### Current behavior

- 커밋 가드는 Claude·Cursor의 PreToolUse 훅뿐이다(`hooks/hooks.json`, `hooks/cursor-hooks.json`). `.codex-plugin/plugin.json`에는 `hooks` 키가 없다.
- `evaluateCommit({command, repoRoot, deps})`(`scripts/src/lib/commit-hook.ts:341`)는 먼저 `detect(command)`로 명령을 판정하고, 커밋이 아니면 `{block:false}`를 반환한다(:358).
  - 그 뒤 순서: `resolveEffectiveTask` → `readCurrent || mainRepoCurrent` → `readAffectedPaths` → `coordinatorContext` → `checkCommitSafety`(`commit-guard.ts:29`).
  - staged 목록은 `git diff --cached --name-only`(:303)이다.
  - 명령 문자열 없이 staged 파일만 판정하는 export는 없다. `deps` seam(:23-39)은 `readCurrent`, `readAffectedPaths`, `stagedFiles`, `trackedModified`, `coordinatorContext`, `mainRepoCurrent`다.
- `init()`(`scripts/src/lib/init.ts:287`)
  - legacy·partial 상태는 :313·:316에서 아무것도 쓰지 않고 반환한다. `test/init.test.js:391`이 partial 반환 shape 전체를 단언한다.
  - ready 재실행은 :344-429, fresh는 :488에서 `reason:'initialized'`를 반환한다.
  - `.gitignore`는 `writeGitignore` 옵션이 있을 때만 쓴다(:218, :334-337). CLI는 `cmdInit`(`cli-project-commands.ts:33-60`)이 플래그를 옵션으로 넘긴다.
  - `/bouncer-init` 스킬은 `.gitignore` 쓰기를 ACQ 동의 뒤에만 한다(`skills/bouncer-init/SKILL.md` Step 2, gate 목록 :61). 결과 렌더링은 `references/init-result.md`가 맡는다.
  - hook 설치, `core.hooksPath` 조회, chmod 코드는 없다.
- CLI 레지스트리 `COMMANDS`(`scripts/src/lib/cli.ts:29-60`)에 staged 검사 명령이 없다. 모르는 명령은 exit 2다. `test/cli-help.test.js:7`의 `SUBCOMMANDS`가 도움말 목록을 고정한다.
- Bouncer 내부 커밋은 node가 git을 직접 spawn하므로 PreToolUse 훅을 거치지 않는다. 대상은 세 곳이다.
  - `commit.ts:440`: `git commit --only`. commit 게이트(G17)를 먼저 통과한다.
  - `finalize.ts:407`: `git commit -m`.
  - `import-history.ts:385`: `git commit -m`.
- CLI 위치: `init.ts`가 빌드되면 `scripts/lib/init.js`가 되고, launcher는 `scripts/bouncer`다. 이 저장소는 `core.hooksPath .githooks`를 쓴다.
- 재현: 범위 밖 파일을 stage하고 터미널에서 `git commit`을 하면 아무 검사 없이 커밋된다. fixture는 `test/init.test.js`(mkdtemp + `git()` helper), `test/commit-hook.test.js`(실제 `git init`·`git worktree add`), `test/commit-task.test.js:89`(실제 저장소 commitTask)다.

#### Target behavior

- 성공
  - `bouncer commit-guard --staged [--repo <dir>]`는 `--repo`(없으면 cwd) 저장소의 staged 파일을 `evaluateStaged`로 판정한다. 허용이면 exit 0이고 stdout에 아무것도 쓰지 않는다.
  - `bouncer init --pre-commit-hook`(fresh·ready)은 git common dir의 `hooks/pre-commit`에 marker를 가진 Bouncer hook을 쓰고 `0o755` 권한을 준다. 결과 JSON에 `preCommitHook`을 넣는다.
  - 기존 hook이 있고 marker가 없으면 `pre-commit.bouncer-prev`로 옮기고 `chained`를 반환한다. 새 hook은 이전 hook을 먼저 실행하고, 이전 hook이 non-zero면 hook 자신도 그 exit code로 끝낸다. git은 non-zero hook을 받으면 `git commit`을 실패시킨다.
  - marker가 있는 hook이 이미 있으면 최신 내용으로 다시 쓰고 `already-installed`를 반환한다.
  - hook은 PATH의 `bouncer`를 먼저 쓰고, 없으면 hook 본문에 기록된 launcher 절대 경로를 쓴다.
  - `/bouncer-init` 스킬은 새 ACQ `init.pre_commit_hook`으로 동의를 받은 뒤에만 `--pre-commit-hook`을 붙여 다시 실행한다.
  - Bouncer 내부 커밋 세 곳은 env `BOUNCER_INTERNAL_COMMIT=1`을 넣어 git을 실행하고, hook은 이 값이 있으면 검사 없이 exit 0으로 끝낸다(이전 hook은 그대로 실행).
- 실패
  - 범위 밖 staged 파일이 있으면 `commit-guard`가 exit 1을 내고, stderr에 PreToolUse 훅과 같은 사유 문자열을 쓴다.
  - 판정 중 예외가 나면 exit 1과 `commit-guard: internal error, blocking commit: <message>`를 낸다.
- 보존
  - `--pre-commit-hook`이 없으면 init은 hook을 쓰지 않고 결과에 `preCommitHook`을 넣지 않는다. 기존 init 결과와 테스트는 그대로 유지된다.
  - `core.hooksPath`가 설정돼 있으면 hook을 쓰지 않고 `preCommitHook: 'skipped-hooks-path'`와 `preCommitHookWarning` 문자열을 반환한다.
  - git 저장소가 아니면 `skipped-no-git`을 반환한다. legacy·partial 상태는 지금처럼 아무것도 쓰지 않고 반환값도 바꾸지 않는다.
  - hook이 두 경로 모두에서 CLI를 찾지 못하면 stderr에 경고를 쓰고 exit 0으로 커밋을 허용한다.
  - active pointer와 lease가 없으면 `commit-guard`는 허용한다(`evaluateCommit`의 기존 계약).
  - PreToolUse 훅 어댑터(`hooks/`)의 동작은 바뀌지 않는다.

#### Interface

- 제공
  - `evaluateStaged({ repoRoot, deps }) => { block: false } | { block: true, reason: string }` — `evaluateCommit`의 명령 탐지 뒤 판정부와 같다. `-a`가 없는 커밋과 같은 staged 목록을 쓴다. `deps`는 `evaluateCommit`과 같은 `CommitHookDeps`다. `evaluateCommit`은 명령 탐지 뒤 이 함수를 재사용한다.
  - `runCommitGuard({ argv: string[], cwd: string, evaluate?: typeof evaluateStaged, stderr?: (s: string) => void }) => number` — CLI 핸들러의 test seam. `evaluate`가 throw하면 1을 반환한다.
  - CLI `bouncer commit-guard --staged [--repo <dir>]`: exit 0 허용, exit 1 차단 또는 내부 오류, `--staged` 없음은 exit 2.
  - `installPreCommitHook({ repoRoot: string, launcherPath: string, deps?: { execFileSync?, fs? } }) => { preCommitHook: PreCommitHookState, warning?: string }` — `deps.execFileSync(cmd, args, opts) => string`, `deps.fs`는 `existsSync`, `readFileSync`, `writeFileSync`, `renameSync`, `chmodSync`, `mkdirSync`.
  - `PreCommitHookState`(domain term): `installed` | `chained` | `already-installed` | `skipped-hooks-path` | `skipped-no-git`. 예: `{ preCommitHook: 'chained' }`.
  - `init` 옵션 `preCommitHook?: boolean`(기본 false)과 `launcherPath?: string`. `launcherPath` 기본값은 빌드된 `init.js` 기준 `path.resolve(__dirname, '..', 'bouncer')`다. 설치하면 init 결과에 `preCommitHook`과, 있으면 `preCommitHookWarning`을 넣는다.
  - CLI 플래그 `bouncer init --pre-commit-hook` → `init({ preCommitHook: true })`.
  - hook marker(domain term): hook 파일 둘째 줄 `# bouncer-pre-commit v1`. 예: `#!/bin/sh` 다음 줄에 이 marker가 있으면 Bouncer hook이다.
  - 내부 커밋 env(domain term): `BOUNCER_INTERNAL_COMMIT=1`. `pre-commit-hook.ts`가 `internalCommitEnv(base = process.env) => NodeJS.ProcessEnv`를 export하고 세 커밋 지점이 이를 쓴다.
  - ACQ `init.pre_commit_hook`: 설치(권장) / 설치 안 함. 설치를 고르면 스킬이 `bouncer init --pre-commit-hook`을 실행한다.
- 거부 (차단)
  - `commit-guard` 판정 예외 → exit 1.
  - `--staged` 없는 `commit-guard` 호출 → exit 2.
- fallback (차단하지 않음)
  - hook이 CLI를 못 찾음 → 경고 후 exit 0.
  - `BOUNCER_INTERNAL_COMMIT=1` → 검사 없이 exit 0.
  - `core.hooksPath` 설정, git 아님 → 설치 생략.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/commit-hook.ts` | `evaluateCommit`, `evaluateStaged` | Modify | 명령 탐지 뒤 staged 판정 | 판정부를 `evaluateStaged`로 추출하고 export | hook과 PreToolUse가 같은 판정을 쓰는 진입점 |
| `scripts/src/lib/pre-commit-hook.ts` | `installPreCommitHook`, `internalCommitEnv` | Create | 없음 | hook 본문 생성, 기존 hook 이동, `core.hooksPath` 확인, 권한 설정, 내부 커밋 env | 설치 I/O seam과 env 이름의 단일 정의 |
| `scripts/src/lib/init.ts` | `init` | Modify | hook 설치 없음 | `preCommitHook` 옵션일 때 fresh·ready 끝에서 설치하고 결과 필드 추가 | init 결과 계약의 진입점 |
| `scripts/src/lib/cli-project-commands.ts` | `cmdInit` | Modify | `--pre-commit-hook` 없음 | 플래그를 `init` 옵션으로 넘기고 usage에 추가 | CLI 플래그 진입점 |
| `scripts/src/lib/cli-commit-guard-command.ts` | `runCommitGuard` | Create | 없음 | `--staged`·`--repo` 파싱, exit code 매핑 | 새 CLI 표면과 test seam |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | `commit-guard` 없음 | 레지스트리에 등록 | CLI dispatch 진입점 |
| `scripts/src/lib/commit.ts` | `commitTask` git commit 호출(:440) | Modify | 기본 env로 커밋 | `internalCommitEnv()` 전달 | 내부 커밋 지점 |
| `scripts/src/lib/finalize.ts` | `realGit().commit`(:407) | Modify | 기본 env로 커밋 | `internalCommitEnv()` 전달 | 내부 커밋 지점 |
| `scripts/src/lib/import-history.ts` | git commit 호출(:385) | Modify | 기본 env로 커밋 | `internalCommitEnv()` 전달 | 내부 커밋 지점 |
| `skills/bouncer-init/SKILL.md` | Step 2, ACQ gate 목록 | Modify | gitignore·promotion·branch ACQ만 있음 | `init.pre_commit_hook` gate 추가 | 동의 후 설치 절차의 정본 |
| `skills/bouncer-init/references/init-result.md` | 결과 필드 처리 | Modify | `preCommitHook` 없음 | 값별 안내, `skipped-hooks-path` 경고, ACQ 분기 | init 결과 렌더링 정본 |
| `test/commit-hook.test.js` | `evaluateStaged` 단언 | Modify | `evaluateCommit`만 단언 | 같은 fixture에서 두 함수 판정 일치 | 판정 동일성 검증 |
| `test/pre-commit-hook.test.js` | 설치·chaining·hooksPath·env·CLI 부재 | Create | 없음 | 실제 git 저장소에서 설치 결과와 hook 실행 단언 | 새 모듈 검증 |
| `test/init.test.js` | `preCommitHook` 옵션 단언 | Modify | 필드 없음 | 옵션 없음이면 필드 없음, 옵션 있음이면 `installed` | init 계약 검증 |
| `test/cli-init.test.js` | `--pre-commit-hook` 단언 | Modify | 플래그 없음 | 플래그가 hook 파일과 결과 필드를 만드는지 단언 | CLI 플래그 검증 |
| `test/cli-commit-guard.test.js` | exit code 단언 | Create | 없음 | 허용 0, 범위 밖 1, 내부 오류 1, `--staged` 없음 2, `--repo` 단언 | CLI 표면 검증 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | `commit-guard` 없음 | 목록에 추가 | 도움말 목록 계약 테스트가 목록을 고정함 |
| `test/commit-task.test.js` | hook 설치 저장소의 commitTask | Modify | hook 없는 저장소만 다룸 | hook 설치 뒤 commitTask가 성공하는지 단언 | 내부 커밋 env 경로 검증 |
| `test/acq-gate-ids.test.js` | `bouncer-init` gate 목록(:14) | Modify | `init.graphify_promotion`, `init.gitignore`, `init.base_branch` 고정 | `init.pre_commit_hook` 추가 | ACQ gate 목록 계약 테스트가 목록을 고정함 |

#### Constraints

- 새 판정 규칙을 만들지 않는다. 같은 저장소 상태에서 `evaluateStaged`의 결과는 `evaluateCommit({command:'git commit'})`과 같아야 한다.
- hook 본문은 POSIX `sh`로 쓰고 Bash 전용 문법을 쓰지 않는다.
- 사용자의 기존 hook을 지우거나 덮어쓰지 않는다. 옮긴 뒤 반드시 먼저 실행한다.
- 사용자 동의 없이 hook을 설치하지 않는다(`AGENTS.md` hard rule 3). 스킬은 ACQ 응답 없이 `--pre-commit-hook`을 붙이지 않는다.
- `.bouncer/config.json`과 `.gitignore`는 이 task에서 쓰지 않는다.
- 소스는 `scripts/src/lib/*.ts`만 고치고 `scripts/lib`는 `npm run build`로 만든다.

### EPIC-087/BP-001/TASK-004 · `e372cf6b`

#### Goal & intent

일반 execute 경로에서 blueprint를 처음 활성화한 뒤 task의 `affected_paths`·`verify`나 저장소 `verify_allowlist`가 바뀌면 execute·commit 게이트가 `G24`로 실패한다. 의도한 변경은 사용자가 승인한 뒤 `bouncer current --set <bp> --reapprove`로 다시 기록한다. 수용 기준은 epic Success criteria 4이고 검증 명령은 `npm test`다.

#### Current behavior

- `current --set`은 `scripts/src/lib/cli-current-command.ts:167-272`에 있다. 처리 순서:
  - `resolveCurrent`(171) → `--replace` 처리(175-183) → plan 게이트(184-194, 실패하면 아무것도 쓰지 않음)
  - → `--task` 해석(202-216) → base 결정(218-240) → `writeCurrent`(247) → `{blueprint, base, task}` 출력(262-266)
- pointer 저장
  - `writeRuntimeCurrent`(`runtime-state.ts:720-762`)가 `{blueprint, base, task?}`만 `<git-common-dir>/bouncer/pointers/<epic>/<bp>.json`(경로 490-505)에 원자적으로 쓴다(tmp → `renameSync`, 745-761).
  - `parsePointerBody`(631-641)와 `storedPointer`(`current.ts:67-73`)는 모르는 키를 버린다.
- 같은 blueprint에 `--set`을 다시 실행하면 거절 없이 덮어쓴다(`test/cli-current.test.js:543`). `/bouncer-commit`이 task를 넘길 때 이 경로를 쓴다(`skills/bouncer-commit/SKILL.md:94`). 그래서 `--set`마다 스냅샷을 다시 기록하면 task를 넘길 때마다 자동으로 재승인된다.
- 게이트
  - execute 분기(`validate-gates.ts:856-915`)와 commit 분기(`validate-gates.ts:1023-1097`)는 pointer를 직접 읽지 않고 `resolveTaskUnit`으로 task를 받는다.
  - G17은 `taskData.bouncer.affected_paths`를 현재 문서에서 읽는다(1079-1083).
  - 승인 시점 값과 대조하는 코드는 없다.
- verify와 allowlist를 읽는 곳
  - `readVerifyCommand`(`verification.ts:264`)는 task frontmatter `bouncer.verify`를 읽고, 없으면 `config.verify`를 쓴다.
  - `readVerifyPolicy`(`config.ts:140`)는 allowlist 키가 없거나 배열이 아니면 기본 목록을 쓰고, 명시한 `[]`는 빈 목록으로 둔다(65-75).
- coordinator와 기존 digest
  - 범위 갱신은 `reviseTaskScope`(`scope.ts` ~680-730)가 task 문서 `affected_paths`와 `scope_revision`을 함께 바꾸는 방식이다.
  - `readCoordinatorLedger({repoRoot, blueprint})`(`scope.ts:451`)가 common dir 원장을 읽는다.
  - G18 `computePlanSnapshot`(`plan-snapshot.ts`)은 frontmatter를 빼고 본문만 해시하므로 이 대조에 쓸 수 없다.
- test seam: `GateDeps`(`validate-gates.ts:83-110`), `RuntimeDeps`(`runtime-state.ts:24-43`).
- 재현: 활성화 뒤 task 문서 `verify`를 `node -e 0`으로 바꾸고 `bouncer validate --gate execute`를 돌리면 통과한다. fixture는 `test/current.test.js`(tmp 저장소, `writeNsFile` 705-720), `test/cli-current.test.js`(`writePlanPassingBlueprint`), `test/validate-gates.test.js`다.

#### Target behavior

- 성공
  - `current --set <bp>`가 그 blueprint의 namespace pointer를 새로 만들 때(쓰기 전에 pointer 파일 없음) 승인 파일을 쓴다. 출력 JSON에 `approval: 'recorded'`를 넣는다.
  - 이미 pointer가 있는 blueprint에 `--set`(task 전진 포함)을 실행하면 승인 파일을 바꾸지 않고 `approval: 'unchanged'`를 출력한다.
  - `--reapprove`를 주면 pointer 유무와 관계없이 승인 파일을 다시 쓰고 `approval: 'recorded'`를 출력한다.
  - execute·commit 게이트는 승인 파일의 digest와 현재 digest가 같으면 G24를 내지 않는다.
- 실패
  - digest가 다르면 `G24 approved scope changed after activation: <바뀐 항목 목록>`을 낸다. 항목은 `TASKS-NNN.affected_paths`, `TASKS-NNN.verify`, `verify_allowlist`이며 task 추가·삭제는 `tasks`로 표시한다.
  - G24 hint는 사용자 승인 뒤 `--reapprove`를 실행하라고 안내한다.
- 보존
  - 승인 파일이 없는 blueprint(이 변경 전에 활성화됨)는 G24 대조를 건너뛴다.
  - coordinator 원장이 그 blueprint에 있으면(`readCoordinatorLedger`가 원장을 반환) G24 대조를 건너뛴다.
  - `--clear`·`--replace`는 승인 파일을 지우지 않는다. 다시 활성화할 때 pointer가 새로 생기므로 새 값으로 덮어쓴다.
  - pointer 파일 shape와 파서, `migrate task-layout`은 바뀌지 않는다.

#### Interface

- 제공
  - 승인 파일(domain term): `<git-common-dir>/bouncer/approvals/<epic>/<bp>.json`.
    - shape `{ version: 1, blueprint: string, digest: string, parts: Record<string, string>, recorded_at: string }`. `parts`는 항목 이름(`TASKS-001.affected_paths`, `TASKS-001.verify`, `verify_allowlist`, `tasks`)별 digest다.
    - 예: `{ "version": 1, "blueprint": ".bouncer/context/epics/087-x/blueprints/001-y", "digest": "ab12…", "parts": { "TASKS-001.verify": "cd34…" }, "recorded_at": "2026-10-06T12:00:00.000+09:00" }`.
  - 승인 digest(domain term): `sha256Canonical({ tasks, verify_allowlist })`.
    - `tasks`는 blueprint의 모든 task를 id순으로 담은 `{ id, affected_paths, verify }` 배열이다. `affected_paths`는 frontmatter 원본 배열, `verify`는 frontmatter 원본 문자열이며 없으면 `null`이다.
    - `verify_allowlist`는 `readVerifyPolicy`의 실효 목록이고, config가 invalid면 `null`이다.
  - `computeApprovalDigest({ repoRoot, blueprintDir }) => { digest: string, parts: Record<string, string> }` — 게이트는 승인 파일의 `parts`와 현재 `parts`를 비교해 G24 메시지의 바뀐 항목 목록을 만든다. `tasks` 항목은 task id 목록의 digest다.
  - `readApprovalSnapshot` / `writeApprovalSnapshot`은 `runtime-state.ts`의 경로 helper와 원자적 쓰기를 쓴다.
  - CLI 플래그 `current --set <bp> --reapprove`, 출력 필드 `approval: 'recorded' | 'unchanged'`.
  - 게이트 코드 `G24`와 hint: `{ code: 'G24', match: /approved scope changed after activation/, next: 'If the change is intended, get the user\'s explicit approval, then run \`bouncer current --set <dir> --reapprove\` and rerun the gate.' }`.
  - test seam: `GateDeps.readApprovalSnapshot?({ repoRoot, blueprintDir }) => ApprovalRead`. `ApprovalRead`는 `{ ok: true, snapshot: { digest, parts } }` | `{ ok: false, path: string }`(깨진 JSON·version 불일치) | `null`(파일 없음), `GateDeps.coordinatorLedgerFor?({ repoRoot, blueprint }) => object | null` — G21이 쓰는 checkout 원장 seam `readCoordinatorLedger`와 별개로, `scope.ts`의 common dir 원장 조회를 감싼다.
- 거부 (throw·실패)
  - 승인 파일 JSON이 깨졌거나 `version`이 1이 아니면 `G24 approval snapshot is unreadable (<path>)`로 실패한다.
  - `--reapprove`를 `--set` 없이 쓰면 usage 오류 exit 2.
- 건너뜀 (miss)
  - 승인 파일 없음, coordinator 원장 있음, `repoRoot`가 문자열이 아님.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/approval-snapshot.ts` | 신규 추출 지점: 승인 digest 계산과 항목별 비교 | Create | 없음 | `computeApprovalDigest`, 항목 diff | 게이트와 CLI가 같은 digest를 쓰는 단일 구현 |
| `scripts/src/lib/runtime-state.ts` | 신규 추출 지점: approvals 경로·읽기·쓰기 | Modify | pointers 경로와 원자적 쓰기만 있음 | `approvals/<epic>/<bp>.json` 경로 helper와 read/write 추가 | common dir 상태 파일의 정본 위치 |
| `scripts/src/lib/cli-current-command.ts` | `--set` 처리, `--reapprove` | Modify | pointer만 씀 | 쓰기 전 pointer 존재 확인, 승인 파일 기록, `approval` 출력 | 최초 활성화·재승인 진입점 |
| `scripts/src/lib/validate-gates.ts` | 신규 추출 지점: execute·commit G24 판정, `GateDeps` | Modify | 승인 시점 대조 없음 | 두 분기에 G24 대조와 seam 추가 | 게이트 판정 진입점 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` | Modify | G24 hint 없음 | G24 hint 추가 | 실패 복구 경로 |
| `test/approval-snapshot.test.js` | digest·항목 diff 단언 | Create | 없음 | 경로·verify·allowlist·task 추가 각각 digest 변화 단언 | 새 모듈 검증 |
| `test/cli-current.test.js` | `approval` 출력·`--reapprove` 단언 | Modify | 승인 출력 없음 | 최초 recorded, task 전진 unchanged, reapprove recorded 단언 | CLI 계약 검증 |
| `test/validate-gates.test.js` | execute·commit G24 단언 | Modify | G24 없음 | 변경 감지, unreadable, 승인 파일 없음 skip, coordinator skip 단언 | 게이트 판정 검증 |
| `test/validate-hints.test.js` | hint 코드 목록 | Modify | G24 없음 | G24 추가 | hint 표 계약 테스트가 목록을 고정함 |

#### Constraints

- `--reapprove`는 사용자가 명시적으로 승인한 뒤에만 실행하는 동작이다(`AGENTS.md` hard rule 3). hint와 오류 문구가 에이전트 스스로의 재승인을 권하지 않게 쓴다.
- 기존 `current --set` 출력의 `blueprint`, `base`, `task` 필드와 exit code는 바꾸지 않는다.
- digest는 frontmatter 원본 값으로 계산하고, `readVerifyCommand`처럼 fallback을 해석하지 않는다. allowlist만 실효 목록을 쓴다.
- 소스는 `scripts/src/lib/*.ts`만 고치고 `scripts/lib`는 `npm run build`로 만든다.

### EPIC-087/BP-001/TASK-005 · `659d80b0`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/pre-commit-hook.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/pre-commit-hook.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.