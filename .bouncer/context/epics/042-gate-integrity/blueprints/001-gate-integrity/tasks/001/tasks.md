---
type: bouncer.tasks
title: -a 커밋의 스코프 검사 대상 확장
description: -a/-am 커밋에서 추적 중 수정 파일까지 affected_paths와 대조
resource: .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T15:07:14.638+09:00'
bouncer:
  id: TASKS-001
  epic_id: '042'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:strict
  commit_intent:
    - '`-a` 커밋은 훅이 볼 때 인덱스가 비어 있어 범위 밖 파일이 그대로 통과함'
    - '검사 대상을 커밋이 실제로 담을 파일 집합으로 맞춤'
  affected_paths:
    - 'scripts/src/lib/commit-hook.ts'
    - 'scripts/lib/commit-hook.js'
    - 'test/commit-hook.test.js'
    - 'docs/security.md'
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T15:21:15.453+09:00'
    suggested_paths:
      - 'scripts/src/lib'
      - 'scripts/lib'
      - 'test'
      - 'hooks'
    basis:
      - graph: source
        status: reused
        query: 'evaluateCommit stagedFiles recordVerificationResult checkGate runtimePaths'
        result: '79 hits rolled up to scripts/src/lib (45), scripts/lib (34)'
      - graph: context
        status: updated
        query: 'commit scope gate verification evidence README security threat model'
        result: '8 hits, all under .bouncer/context/epics/040-scope-evidence and 009-subagent-model-config — no overlap with this blueprint'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
훅이 `git commit -a` / `-am` / `--all`을 만나면 이미 스테이징된 경로만이 아니라 그 커밋이 실제로 담게 될 추적 중 수정 파일까지 함께 `affected_paths`와 대조한다. 지금은 PreToolUse 시점에 인덱스가 비어 있어 범위 밖 파일이 그대로 커밋된다. 탐지는 이미 정상이므로 바꾸는 것은 검사 대상 파일 집합뿐이다.

## Interface
- 제공:
  - 커밋 탐지가 불린 대신 `{ commit: boolean, all: boolean }` 판정을 낼 수 있는 내부 함수를 두고, `isGitCommit(command, opts)`은 지금의 불린 계약을 그대로 유지한다.
  - `evaluateCommit({ command, repoRoot, deps })`의 검사 대상은 `staged ∪ (all ? trackedModified : [])`다.
  - `deps.trackedModified({ repoRoot })` 주입점. 기본 구현은 `git diff HEAD --name-only`의 줄 목록이다.
- 거부:
  - all-flag가 없는 명령은 지금과 같이 스테이징 목록만 검사한다. 워킹 트리에만 있는 범위 밖 수정으로는 막지 않는다.
  - `git diff HEAD`가 실패하면 예외를 그대로 전파한다. `realStagedFiles`와 같은 방식이고, 훅 어댑터가 그 throw를 fail-closed로 받아 exit 2를 낸다. `evaluateCommit` 안에서 삼켜 `block: true`로 바꾸면 `hooks/commit-safety.js`의 내부 오류 처리와 이유가 어긋난다.
  - 중첩 셸·확장·alias로 명령을 판단할 수 없어 이미 커밋으로 간주하는 경로는 all-flag도 있는 것으로 간주한다.
  - 롱 옵션은 이름 전체가 정확히 `--all`일 때만 all-flag다. `--amend` · `--author=…` · `--allow-empty`는 `-`로 시작하고 `a`를 포함하지만 all-flag가 아니다.
  - 따옴표로 감싼 토큰과 `-m` / `--message`의 값은 플래그로 읽지 않는다. `git commit -m "-a"`는 all-flag가 아니다.

## Touch
- Modify `scripts/src/lib/commit-hook.ts` — all-flag 탐지와 검사 집합 합집합, `trackedModified` 기본 구현과 주입점.
- Modify `scripts/lib/commit-hook.js` — 위 소스의 emit 산출물. `npm run build`로 재생성해 함께 커밋한다.
- Modify `test/commit-hook.test.js` — `-am` 우회 회귀 테스트와 플래그 파싱 경계 케이스.
- Modify `docs/security.md` — 탐지 표에 `-a` 계열 처리와 `git diff HEAD` 실패 시 차단을 적는다.

## Do not touch
- `scripts/src/lib/commit-guard.ts` — 스코프 판정 계약은 그대로 두고 입력만 바꾼다.
- `scripts/src/lib/scope.ts` — `makeAllowed` / `isRuntimeArtifact` 규칙은 이번 변경과 무관하다.
- `hooks/commit-safety.js` — 어댑터는 `evaluateCommit` 결과만 옮기므로 바뀔 이유가 없다.
- `scripts/src/lib/validate-gates.ts` — commit 게이트 G17은 명령을 받지 않는다. 이번 수정 대상이 아니다.
- `scripts/src/lib/commit.ts` — `bouncer commit`은 자체 스코프 검사를 이미 한다.

## Constraints
- `isGitCommit`의 이름과 불린 반환을 유지한다. 공개 이름 회귀 테스트와 `docs/security.md`가 이 계약을 참조한다.
- fail-closed 방향을 뒤집지 않는다. 판단 불가는 항상 검사 쪽으로 기운다.
- 새 의존성을 넣지 않는다. git 호출은 기존과 같이 `execFileSync` argv 배열로 한다.
- `git diff HEAD --name-only`의 출력은 이름만 쓴다. 삭제된 경로가 섞이므로 파일을 읽지 않는다.
- 비자명한 의도는 한국어 주석으로 남긴다.
- 새로 만든 함수는 테스트로 덮는다. 커버리지 바닥(lines 94 / branches 82 / functions 96)은 `npm run ci`에만 있고 task `verify`인 `npm run verify:strict`에는 없다. 게이트가 통과해도 원격 CI가 떨어질 수 있다.
- 커밋 전 `npm run build`를 돌려 `scripts/lib/commit-hook.js`를 소스와 맞춘다. `check:emit`은 `.githooks/pre-commit`과 `npm run ci`에서 돌고 task `verify`에는 없다.

## Checklist
- [ ] `test/commit-hook.test.js`에 실패 테스트를 먼저 추가한다.
  ```js
  const result = evaluateCommit({
    command: 'git commit -am x',
    repoRoot,
    deps: {
      readCurrent: () => ({ blueprint: blueprintDir }),
      readAffectedPaths: () => ['src/a.js'],
      stagedFiles: () => [],
      trackedModified: () => ['other/b.js'],
    },
  });
  assert.equal(result.block, true);
  ```
- [ ] `node --test test/commit-hook.test.js`로 이 테스트가 실패하는 것을 확인한다.
- [ ] `segmentIsGitCommit` 계열 탐지를 확장해 `commit` 이후 argv에서 all-flag를 찾는다. 롱 옵션(`--`로 시작)은 `--all`과 정확히 같을 때만, 단축 플래그(`-`로 시작하고 `--`가 아닌 것)는 문자 묶음에 `a`가 있을 때만 해당한다. `-m` / `--message`의 값과 따옴표 토큰은 건너뛴다.
- [ ] `evaluateCommit`에서 `files`를 합집합으로 만든다.
  ```js
  const files = all
    ? [...new Set([...d.stagedFiles({ repoRoot }), ...d.trackedModified({ repoRoot })])]
    : d.stagedFiles({ repoRoot });
  ```
- [ ] `realTrackedModified({ repoRoot })`를 `git diff HEAD --name-only`로 구현하고 `module.exports`에 추가한다.
- [ ] git 실패가 전파되는 것을 테스트로 고정한다. 훅은 이 throw를 받아 차단한다.
  ```js
  assert.throws(() => evaluateCommit({
    command: 'git commit -am x',
    repoRoot,
    deps: { /* … */ trackedModified: () => { throw new Error('git failed'); } },
  }), /git failed/);
  ```
- [ ] 회귀 방지 테스트를 추가한다: `git commit -m x` · `git commit --amend` · `git commit --author=a` 는 `trackedModified`를 호출하지 않고, `git commit -m "-a"`도 all-flag로 읽지 않는다.
- [ ] `docs/security.md` 탐지 표에 `git commit -am x` 행과 `git diff HEAD` 실패 시 차단을 적고, 오탐 문단에 pathspec으로 좁힌 `-a` 커밋이 막힐 수 있다는 것을 더한다.
- [ ] (보조) `npm run build` 후 `bash repro-g17.sh <worktree 경로>`의 B 단계가 `BLOCKED`로 바뀌는지 확인한다. 스크립트는 인자로 받은 경로의 `scripts/lib/commit-hook.js`를 읽으므로 빌드 전이거나 저장소 루트를 가리키면 옛 코드를 판정한다. 이 스크립트는 저장소에 들어오지 않는다 — 판정 근거는 위 회귀 테스트다.
- [ ] `npm run build` 후 `npm run verify:strict`가 통과하는지 확인한다.
