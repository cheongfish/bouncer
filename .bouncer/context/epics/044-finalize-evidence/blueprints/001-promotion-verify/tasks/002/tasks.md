---
type: bouncer.tasks
title: finalize가 스테이징 전에 검증 명령을 실행함
description: 승격 커밋 직전에 config.verify를 실행하고 실패하면 아무것도 커밋하지 않는다
resource: .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: TASKS-002
  epic_id: '044'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - Distill 승격 커밋이 검증을 한 번도 거치지 않고 저장소에 들어감
    - finalize가 스테이징 전에 검증 명령을 실행해 실패하면 커밋을 막게 함
  affected_paths:
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - test/finalize.test.js
    - skills/bouncer-finalize/SKILL.md
    - test/skill-bouncer-finalize.test.js
    - docs/cli.md
    - docs/troubleshooting.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-22T15:05:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/037-distill-promotion-consent
      - .bouncer/context/epics/044-finalize-evidence
    basis:
      - graph: source
        status: reused
        query: finalize verify command before staging distill promotion bullet audit test
        result: 3 hits — test/finalize.test.js, test/cli-project-commands.test.js, test/seed-worktree.test.js
      - graph: context
        status: updated
        query: finalize verify distill promotion benchmark protocol
        result: 3 hits under .bouncer/context/epics/037-distill-promotion-consent and 044-finalize-evidence
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer finalize --yes`가 커밋할 것이 있을 때 해석된 검증 명령을 먼저 실행하고,
실패하면 `closed` 잠금도 쓰지 않고 아무 경로도 스테이징하지 않은 채
`{ ok: false, reason: 'verify' }`로 끝난다. 지금은 execute 게이트만 검증을 돌리고
finalize는 문서 상태와 `diff_sha`만 보므로 Distill 승격이 항상 미검증으로 커밋된다.

검증은 승격 직전 사전 점검이지 task 증적이 아니다. 따라서 `verification.md`와 verify
원장에는 아무것도 쓰지 않는다 — 하드 규칙 3이 말하는 증적은 execute 게이트가 쓰는 것
하나뿐이고, 여기서 문서를 쓰면 어느 실행이 증적인지 구분되지 않는다.

## Interface
- 제공:
  - `finalize({ ..., verifyExec })` — 선택 주입 지점. 기본값은 `verification.ts`의
    `executeVerify` 실제 실행. 테스트는 이 인자로 종료 코드를 정한다.
  - 실패 반환은 한 형태다: `{ ok: false, reason: 'verify', code, command, exitCode }`.
    검증 실행이 0이 아닌 코드로 끝나면 `code: 'VERIFY_FAILED'`이고 `command`/`exitCode`가
    실제 값이다. 명령을 해석하지 못하면 `command`/`exitCode`는 `null`이고 `code`가
    해석 오류 코드다.
  - 명령 해석은 `readVerifyCommand(repoRoot, blueprintDir)` 하나만 쓴다.
- 거부:
  - `--yes` 없는 dry-run에서는 실행하지 않는다. 읽기 전용 보고가 전체 테스트를
    끌고 오면 안 된다.
  - 스테이징 대상도 `closed` 잠금도 없어 커밋을 건너뛰는 경로에서는 실행하지 않는다.
  - `bouncer.verify`가 형식상 무효면 `config.verify`로 폴백하지 않는다. 폴백하면
    plan `S12` 누락을 숨긴다. 대신 `code: 'VERIFY_COMMAND_INVALID'` 실패로 끝낸다.
  - `config.verify`가 없거나 무효인 경우도 같은 형태의 실패다
    (`VERIFY_CONFIG_MISSING` / `VERIFY_CONFIG_INVALID`).
  - 세 해석 오류 중 어느 것도 예외로 새지 않는다. `cmdFinalize`에는 try/catch가 없고
    `runCli`에도 최상위 처리기가 없어, 던지면 결과 JSON 대신 스택 트레이스가 나오고
    종료 코드 계약(0/1)도 깨진다. 코드를 결과에 실으므로 조용한 폴백도 아니다.

## Touch
- Modify `scripts/src/lib/finalize.ts` — out-of-scope 검사 통과 후, 잠금 기록·스테이징
  전에 검증을 실행하는 분기를 넣고 `verifyExec` 주입 인자를 받는다.
- Modify `scripts/lib/finalize.js` — 위 변경의 `tsc` 산출. `check:emit`이 소스와
  대조하므로 함께 커밋한다.
- Modify `test/finalize.test.js` — 검증 성공·실패·건너뜀 경로의 케이스를 추가한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 3단계에 `--yes`가 검증을 실행한다는
  사실과 `reason: 'verify'` 실패 시 처리(고치고 재실행, 우회 없음)를 적는다.
- Modify `test/skill-bouncer-finalize.test.js` — 위 스킬 문장을 계약으로 고정한다.
- Modify `docs/cli.md` — `bouncer finalize` 행에 `--yes`가 검증을 실행한다는 설명을 넣는다.
- Modify `docs/troubleshooting.md` — finalize `out-of-scope` 행 옆에 `reason: 'verify'`
  행을 넣는다. 사용자가 가장 자주 만날 새 중단 지점이다.

## Do not touch
- `scripts/src/lib/verification.ts` — `readVerifyCommand`·`executeVerify`를 그대로
  재사용한다. 여기에 finalize 전용 분기를 만들면 명령 해석 규칙이 둘로 갈린다.
- `scripts/src/lib/validate-gates.ts` — G16 판정 항목은 바뀌지 않는다. 이 변경은
  게이트가 아니라 커밋 직전 실행이다.
- `scripts/src/lib/cli-git-commands.ts` — `cmdFinalize`는 이미 결과 JSON을 출력하고
  `ok`로 종료 코드를 정하므로 새 분기가 필요 없다.
- `.bouncer/config.json` — `verify` 값은 이 task의 입력이다.
- `.githooks/pre-commit`, `.github/` — 훅과 CI는 이 epic의 Out of scope다.

## Constraints
- 검증 실행 위치는 out-of-scope 검사 **뒤**, `writeClosedLock`·`stage` **앞**이다.
  잠금이 먼저 쓰이면 검증 실패 시 blueprint가 닫힌 채 커밋만 없는 상태가 남는다.
- 현재 코드는 `writeClosedLock`이 `mergeLocked`로 `staged`를 계산하기 전에 실행된다.
  「커밋할 것이 있을 때만 검증」과 「잠금 전에 검증」을 동시에 지키려면
  `writeClosedLock` 호출을 `staged` 계산 뒤로 옮겨야 한다. 이 재배치가 이 task에서
  유일하게 자명하지 않은 편집이다.
- 잠금만으로 커밋이 생기는 경우(승격분 없이 blueprint를 닫기만 하는 실행)도 검증을
  돌린다. 그 커밋도 저장소 파일을 바꾸고, 예외를 두면 「승격이면 검증」이라는 규칙이
  「어떤 finalize 커밋은 검증되지 않는다」로 돌아간다.
- 실패 반환에 `violations`·`staged`를 섞지 않는다. 실패 이유는 `reason` 하나로 읽힌다.
- 테스트는 실제 명령을 실행하지 않는다. `verifyExec` 주입으로만 종료 코드를 만든다.
- 기존 반환 형태(`dryRun`, `committed`, `staged`, `commitMessage`, `pointerCleared`,
  `next`, `closed`)의 필드 이름과 의미를 바꾸지 않는다.
- 비자명한 순서 결정(잠금 전에 검증하는 이유)은 한국어 주석으로 코드에 남긴다.
- 소스는 `scripts/src/**`에서 고치고 `npm run build`로 emit을 갱신한다. `scripts/lib/**`를
  직접 편집하지 않는다.

## Checklist
- [ ] `test/finalize.test.js`에 실패 케이스를 먼저 추가하고 실패를 확인한다:
      ```js
      const res = finalize({
        repoRoot, blueprintDir, yes: true, git: fakeGit,
        verifyExec: () => ({ ok: false, exitCode: 1, output: 'boom' }),
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, 'verify');
      assert.strictEqual(res.code, 'VERIFY_FAILED');
      assert.strictEqual(res.exitCode, 1);
      assert.deepStrictEqual(fakeGit.staged, []);
      assert.deepStrictEqual(fakeGit.commits, []);
      ```
- [ ] 같은 실패 케이스에서 `closed` 잠금이 기록되지 않았음을 단언한다(blueprint
      `index.md`의 `status`가 여전히 `approved`).
- [ ] `scripts/src/lib/finalize.ts`에 `verifyExec` 인자와 검증 분기를 구현한다.
      명령은 `readVerifyCommand(repoRoot, blueprintDir)`, 실행은
      `executeVerify(command, { cwd: repoRoot, exec: verifyExec })`.
- [ ] 성공 케이스: `verifyExec`가 종료 코드 0이면 기존과 같이 스테이징·커밋하고
      `committed: true`를 낸다.
- [ ] 건너뜀 케이스 두 개를 단언한다 — dry-run(`yes: false`)과 스테이징 대상이 없는
      실행에서 `verifyExec`가 호출되지 않는다(호출 횟수 0).
- [ ] `bouncer.verify`가 무효 문자열(`npm test && npm run lint`)인 픽스처에서
      `--yes`가 throw 하지 않고
      `{ ok: false, reason: 'verify', code: 'VERIFY_COMMAND_INVALID', command: null, exitCode: null }`
      을 내는지 단언한다.
- [ ] `.bouncer/config.json`이 없는 픽스처에서 같은 형태에 `code:
      'VERIFY_CONFIG_MISSING'`이 나오는지 단언한다.
- [ ] `test/finalize.test.js`의 `fullBlueprint` 픽스처가 `.bouncer/config.json`을
      쓰게 한다(`{"verify": "true"}` 정도면 된다). 이 픽스처는 지금 config를 전혀
      쓰지 않아서, 스텁을 넣어도 `readVerifyCommand`가 실행 **전에**
      `VERIFY_CONFIG_MISSING`으로 끝난다.
- [ ] 기존 `yes: true` 케이스 전부에 `verifyExec` 스텁을 넣는다. 넣지 않으면 픽스처
      저장소에서 실제 검증 명령이 돌아 이 task와 무관한 케이스가 깨진다.
- [ ] `writeClosedLock` 호출을 `staged` 계산 뒤로 옮기고, 잠금만 있는 케이스
      (`lockOnly` 픽스처)에서도 검증이 실행되는지 단언한다.
- [ ] `skills/bouncer-finalize/SKILL.md` 3단계에 문장을 넣는다: `--yes`는 스테이징
      전에 검증 명령을 실행하고, `reason: 'verify'` 실패는 원인을 고쳐 다시
      실행하는 것 외의 우회 경로가 없다.
- [ ] `test/skill-bouncer-finalize.test.js`에 그 문장을 고정하는 단언을 추가한다.
- [ ] `docs/cli.md`의 `bouncer finalize` 행을 갱신한다.
- [ ] `docs/troubleshooting.md`에 `reason: 'verify'` 중단과 복구(원인 수정 후 재실행)
      행을 추가한다.
- [ ] `npm run build` 후 `npm run check:emit`이 통과한다.
- [ ] `npm test`가 통과한다.
