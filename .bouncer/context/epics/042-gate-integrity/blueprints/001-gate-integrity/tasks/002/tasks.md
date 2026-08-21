---
type: bouncer.tasks
title: verify 증적의 하네스 원장 대조
description: G13이 문서 메타데이터를 .git 아래 하네스 소유 실행 기록과 대조
resource: .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T15:07:14.673+09:00'
bouncer:
  id: TASKS-002
  epic_id: '042'
  blueprint_id: '001'
  status: ready
  verify: npm run verify:strict
  commit_intent:
    - 'G13이 에이전트가 쓸 수 있는 문서만 읽어 위조된 증적을 통과시킴'
    - '하네스가 남긴 실행 기록과 대조해야 증적이 주장을 이김'
  affected_paths:
    - 'scripts/src/lib/runtime-state.ts'
    - 'scripts/lib/runtime-state.js'
    - 'scripts/src/lib/verification.ts'
    - 'scripts/lib/verification.js'
    - 'scripts/src/lib/validate-gates.ts'
    - 'scripts/lib/validate-gates.js'
    - 'test/runtime-state.test.js'
    - 'test/verification-runner.test.js'
    - 'test/validate-gates.test.js'
    - 'test/cli-verify.test.js'
    - 'test/native-profile-e2e.test.js'
    - 'test/validate-structural.test.js'
    - 'docs/gates.md'
    - 'docs/ARCHITECTURE.md'
    - 'docs/troubleshooting.md'
    - 'docs/compatibility.md'
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
G13이 문서가 자기 자신과 일관된지만 보지 않고, `bouncer verify`가 남긴 하네스 소유 실행 원장과 대조하게 만든다. 지금은 에이전트가 Write 툴로 `verification.md` 프론트매터에 `exit_code: 0`을 적으면 게이트가 통과한다. 원장은 커밋 대상이 아닌 런타임 상태로, `current` 포인터와 같은 Git common directory 아래에 둔다.

## Interface
- 제공:
  - `verifyLedgerPathFor({ repoRoot, verificationRel, deps })` — `<git-common-dir>/bouncer/verify/<sha256(verificationRel) 앞 16자>.json` 절대 경로. Git을 쓸 수 없으면 `runtimePaths`와 같은 `{ unavailable, reason }` 모양을 낸다.
  - `recordVerificationResult(...)`가 문서를 쓴 뒤 같은 실행의 원장 레코드를 기록한다. 레코드는 `{ rel, command, ran_at, exit_code, output_sha }`이고 `output_sha`는 문서를 다시 읽었을 때의 `output_tail` 문자열에 대한 sha256이다. 기록 시점에도 `renderDoc` → `readDoc` 왕복을 거친 값을 해싱해, YAML 왕복이 개행이나 후행 공백을 정규화해도 양쪽이 같은 문자열을 본다.
  - `checkGate({ gate: 'execute' | 'commit', deps })`의 `deps.readVerifyLedger({ repoRoot, verificationRel })` 주입점. commit 게이트도 같은 대조를 돌린다.
- 거부:
  - 원장 레코드가 없으면 G13 실패다. 프론트매터가 아무리 잘 갖춰져 있어도 통과하지 않는다.
  - `command` / `ran_at` / `exit_code`가 문서와 원장에서 다르면 G13 실패다.
  - 문서 `output_tail`의 sha256이 원장 `output_sha`와 다르면 G13 실패다.
  - Git common directory를 찾을 수 없으면 통과가 아니라 G13 실패다.
  - 원장에 `exit_code`가 0이 아닌 레코드만 있으면 실패다. 실패 실행 기록을 성공으로 읽지 않는다.
  - commit 게이트에서 `verification.status: passed`만 손으로 적힌 문서는 통과하지 않는다. G7의 status 확인만으로는 `/bouncer-commit` 직접 호출 경로가 그대로 열린다.

## Touch
- Modify `scripts/src/lib/runtime-state.ts` — 원장 경로 헬퍼 추가.
- Modify `scripts/lib/runtime-state.js` — emit 산출물.
- Modify `scripts/src/lib/verification.ts` — `recordVerificationResult`에서 원장 기록.
- Modify `scripts/lib/verification.js` — emit 산출물.
- Modify `scripts/src/lib/validate-gates.ts` — G13이 원장을 읽어 대조.
- Modify `scripts/lib/validate-gates.js` — emit 산출물.
- Modify `test/runtime-state.test.js` — `verifyLedgerPathFor`와 Git을 쓸 수 없는 `unavailable` 분기 커버리지.
- Modify `test/verification-runner.test.js` — 원장이 실제로 기록되는지, 실패 실행이 어떻게 남는지.
- Modify `test/validate-gates.test.js` — 원장 없음·불일치·정상 세 갈래의 G13 판정. 이 파일은 통과하는 `verification.md` 프론트매터를 직접 구성하므로 원장 fixture를 함께 넣어야 한다.
- Modify `test/cli-verify.test.js` — `bouncer verify` 경로가 만드는 원장 확인.
- Modify `test/native-profile-e2e.test.js` — e2e가 만드는 verify 증적이 새 대조를 통과하는지.
- Modify `test/validate-structural.test.js` — execute 게이트를 함께 도는 구조 테스트다. 새 G13 실패가 끼어들면 fixture를 맞춘다.
- Modify `docs/gates.md` — G13 설명을 원장 대조까지 포함하도록 고치고, commit 게이트 행에도 G13을 더한다.
- Modify `docs/ARCHITECTURE.md` — G13 계약 서술 갱신.
- Modify `docs/troubleshooting.md` — 원장 없음·불일치 실패 메시지와 복구 절차(`bouncer verify` 재실행) 추가.
- Modify `docs/compatibility.md` — G13 한 줄 요약 갱신.

## Do not touch
- `scripts/src/lib/current.ts` — 포인터 읽기/쓰기 계약은 그대로다. 원장은 같은 디렉터리를 쓰되 포인터 파일과 무관하다.
- `scripts/src/lib/commit-hook.ts` — task 001 소관이다.
- `scripts/src/lib/scaffold.ts` — `verification.md` 스캐폴드 기본값은 바꾸지 않는다.
- `.bouncer/config.json` — 새 설정 키를 만들지 않는다.

## Constraints
- 원장은 저장소에 커밋되지 않는다. `.git` 아래이므로 `affected_paths`나 커밋 스코프에 절대 들어가지 않는다.
- 게이트 번호 G13과 기존 실패 메시지의 앞부분(`verification.md missing successful harness verification metadata`)은 유지한다. 새 실패는 별도 메시지로 추가한다. `docs/compatibility.md`가 게이트 코드를 공개 계약으로 고정한다.
- 하위 호환을 깨는 변경이다. 원장은 `.git` 아래에 있어 복제되지 않으므로 새 클론·CI 러너·다른 개발자 머신에서는 과거 task의 게이트가 다시 통과하지 못한다. 복구 경로는 활성 task에 대한 `bouncer verify` 재실행 하나뿐이다. 일회성 마이그레이션으로 읽히지 않게 `docs/troubleshooting.md`에 이 범위를 그대로 적는다. CHANGELOG 기록은 task 003이 맡는다.
- 해시는 `node:crypto`로만 만든다. 새 의존성을 넣지 않는다.
- linked worktree에서 실행해도 같은 레코드를 봐야 한다. 경로 기준은 항상 common directory다.
- 비자명한 의도는 한국어 주석으로 남긴다.
- 새로 만든 함수는 테스트로 덮는다. 커버리지 바닥(lines 94 / branches 82 / functions 96)은 `npm run ci`에만 있고 task `verify`인 `npm run verify:strict`에는 없다. 게이트가 통과해도 원격 CI가 떨어질 수 있다.
- 커밋 전 `npm run build`로 `scripts/lib/*.js`를 소스와 맞춘다. `check:emit`은 `.githooks/pre-commit`과 `npm run ci`에서 돌고 task `verify`에는 없다.

## Checklist
- [ ] `test/validate-gates.test.js`에 실패 테스트를 먼저 추가한다.
  ```js
  // 프론트매터만 손으로 채운 verification.md — 원장 없음
  const result = checkGate({ gate: 'execute', /* … */ deps: { readVerifyLedger: () => null } });
  assert.ok(result.failures.some((f) => f.code === 'G13'));
  ```
- [ ] `node --test test/validate-gates.test.js`로 실패를 확인한다.
- [ ] `runtime-state.ts`에 `verifyLedgerPathFor`를 추가한다. `currentFile`과 같은 방식으로 `commonGitDir`에서 파생한다.
- [ ] `recordVerificationResult`에서 문서 기록 직후 원장을 쓴다.
  ```js
  const record = {
    rel: toPosix(rel),
    command,
    ran_at: ranAt,
    exit_code: exitCode,
    // 문서를 다시 읽었을 때의 값으로 해싱한다. YAML 왕복 정규화가 끼면
    // 게이트가 보는 문자열과 달라진다.
    output_sha: createHash('sha256').update(readBackOutputTail).digest('hex'),
  };
  ```
- [ ] `validate-gates.ts`의 G13에서 원장을 읽어 대조한다. 순서는 기존 프론트매터 검사 → 원장 존재 → 필드 일치 → `output_sha` 일치다.
- [ ] execute·commit 두 게이트에서 세 갈래 테스트를 채운다: 원장 없음, `ran_at` 불일치, 정상 통과.
- [ ] `output_tail`에 후행 공백과 CRLF가 섞인 출력으로 왕복 테스트를 넣는다. 기록 → 문서 재파싱 → 해시 대조가 같은 값이어야 한다.
- [ ] `test/runtime-state.test.js`에 `verifyLedgerPathFor`의 정상 경로와 비-Git 디렉터리 `unavailable` 분기를 넣는다.
- [ ] `test/verification-runner.test.js`에 원장 기록 테스트를 추가한다. 실패 실행(`exit_code != 0`)도 레코드가 남고 G13은 통과하지 않는지 확인한다.
- [ ] `test/cli-verify.test.js`와 `test/native-profile-e2e.test.js`의 verify 증적 fixture를 새 대조에 맞춘다.
- [ ] `docs/gates.md` · `docs/ARCHITECTURE.md` · `docs/troubleshooting.md` · `docs/compatibility.md`의 G13 서술을 고친다.
- [ ] `npm run build` 후 `npm run verify:strict`가 통과하는지 확인한다.
