---
type: bouncer.explain
title: 검증 정책 일관성
description: Aligns plan and runtime verification policy and copies project config into execute worktrees without overwriting destinations.
resource: .bouncer/context/epics/064-runtime-policy-pointer-safety/blueprints/001-verify-policy-consistency/explain.md
tags:
  - bouncer
  - explain
  - verification
  - allowlist
  - worktree
  - config
timestamp: '2026-09-05T21:53:37.731+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '064'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 349ceca2ca7cb6988cfbf57e524339e3d193d574
      diff_sha: bca14fa9628d9ade8d53d28cd7aadf6788af03162a1c7c708d68e0a486aadd76
      quiz_score: 3/3
      disposition: 세 문항 모두 정답으로 허용 목록 대체, 파손 설정 중단, HEAD 복사를 이해함
      recorded_at: '2026-09-05T21:55:43+09:00'
  task_commits:
    - id: '001'
      sha: 3afb502b
    - id: '002'
      sha: 349ceca2
---
# Explain

## Background

plan의 S12와 execute의 실제 실행이 서로 다른 allowlist와 config 오류 처리를 써서, 같은 `verify` 문자열이 한쪽에선 통과하고 한쪽에선 거절됐다. 파손된 config는 기본 목록으로 넓히면 안 되는데 runtime만 그렇게 폴백했다. execute worktree는 `.bouncer/config.json`을 받지 못해 base와 다른 정책으로 돌 수 있었고, 대상에 이미 파일이 있으면 덮어쓰면 이미 통과한 검증과 어긋난다.

## Intuition

한 번의 정책 판정이 plan과 실행을 묶고, worktree config는 옮기지 않고 복사한다.

## Code

`scripts/src/lib/config.ts`의 `readVerifyPolicy()`가 missing이면 기본 목록, present면 프로젝트 목록(명시 `[]`는 전면 차단), invalid면 목록 없이 실패한다. `scripts/src/lib/validate.ts`가 그 목록을 `checkStructural()`의 S12에 넘기고, `scripts/src/lib/verification.ts`의 `readVerifyCommand()`·`runVerification()`·`executeVerify()`가 같은 결과를 쓴다. invalid config는 프로세스를 시작하지 않는다.

`scripts/src/lib/seed-worktree.ts`의 `seedConfig()`는 plan 이동과 별도다. dest가 있으면 `preserved`, HEAD에 있으면 HEAD 바이트(`readHead` 실패는 `copy-failed`), untracked/ignored는 base 바이트, 양쪽 없으면 `missing`. `moved`에 `.bouncer/config.json`을 넣지 않는다. `skills/bouncer-execute/SKILL.md`는 `missing`일 때 기본 allowlist로 진행한다는 한 줄 경고를 요구한다.

회귀는 `test/verification-runner.test.js`, `test/validate-structural.test.js`, `test/seed-worktree.test.js`, `test/skill-bouncer-execute.test.js`다.

## Quiz

1. 프로젝트 `verify_allowlist`를 `['bun']`으로 두면 `npm test`는?
   - A) 기본 목록과 합쳐져 S12만 통과한다
   - B) plan S12와 runtime 모두 거절한다
   - C) runtime만 통과하고 S12는 기본 목록으로 통과한다

2. config JSON이 깨졌을 때 맞는 동작은?
   - A) 기본 allowlist로 폴백한다
   - B) 파일이 없는 것과 같이 missing으로 본다
   - C) plan은 S12, execute는 `VERIFY_CONFIG_INVALID`로 중단하고 프로세스를 시작하지 않는다

3. 대상 worktree에 config가 없고 HEAD에 추적 파일이 있으면 `seed-worktree`는?
   - A) HEAD 바이트를 복사하고 dirty base는 쓰지 않는다
   - B) dest와 내용이 달라도 덮어쓴다
   - C) `moved` 목록에 `.bouncer/config.json`을 넣는다

## 이해 상태

정답: 1-B, 2-C, 3-A. 응답: 1-B, 2-C, 3-A. 세 문항 모두 정답이며 허용 목록 대체, 파손 설정 중단, HEAD 복사를 이해함.

## Tasks

### Task 001

#### Goal & intent

프로젝트 config의 `verify_allowlist`와 오류 상태를 한 번 판정해 S12, task별 command 선택, 실제 실행이 같은 결과를 사용하게 한다. 기본 목록 밖이지만 프로젝트가 허용한 명령은 plan·execute에서 모두 통과하고, 파손된 config는 어느 단계에서도 기본 목록으로 폴백하지 않는다.

#### Interface

- 제공: config 모듈은 `repoRoot`에서 검증 정책을 읽어 명시적 allowlist 또는 기본 allowlist와 `missing`·`invalid` 구분을 제공한다.
- 제공: `validateBlueprint()`는 그 allowlist를 `checkStructural()`의 S12 판정에 전달하고, `readVerifyCommand()`·`runVerification()`은 같은 정책을 사용한다. `runVerification()`은 판정한 allowlist를 `executeVerify()`에 명시적으로 전달한다.
- 제공: `executeVerify()`를 직접 부르는 기존 소비자는 `{ ok, exitCode, output }` 비예외 반환 계약을 유지한다. config가 invalid이면 `ok: false`와 오류 출력을 반환한다.
- 거부: 깨진 JSON과 `EACCES` 같은 읽기 오류는 plan에서 S12, `readVerifyCommand()`·`runVerification()`에서 `VERIFY_CONFIG_INVALID`, 직접 `executeVerify()` 호출에서 비예외 실패 결과로 중단하며 프로세스를 시작하지 않는다.
- 거부: 셸 연산자, 미종료 인용, allowlist 밖 argv0는 config 상태와 관계없이 기존 `VERIFY_COMMAND_INVALID` 또는 S12로 거절한다.

#### Do not touch

- `scripts/src/lib/runtime-state.ts` — verify 원장과 포인터 상태는 이 task의 정책 입력이 아니다.
- `scripts/src/lib/seed-worktree.ts` — config 전달은 Task 002에서 별도 커밋으로 구현한다.
- `scripts/src/lib/finalize.ts` — `executeVerify()`의 기존 비예외 결과를 이미 처리하므로 소비 계약을 바꾸지 않는다.
- `scripts/lib/finalize.js` — TypeScript 소비자가 바뀌지 않으므로 emit도 건드리지 않는다.
- `test/finalize.test.js` — finalize의 입력·출력 계약은 변경하지 않고 verification 단위 테스트에서 직접 호출 호환성을 검증한다.
- `.bouncer/config.json` — 계획 중 프로젝트 설정값 자체를 바꾸지 않는다.

### Task 002

#### Goal & intent

`seed-worktree`가 `.bouncer/config.json`을 plan 문서 이동과 분리된 복사 단계로 전달한다. 추적 config는 HEAD 정책을, 추적되지 않은 config는 base 바이트를 사용하며, 기존 worktree config와 base config를 보존한다. config가 없으면 정상 진행하되 execute가 한 줄 경고를 표시할 수 있는 상태를 반환한다.

#### Interface

- 제공: `seedWorktree()` 반환값은 기존 `moved`·`restored`와 별도로 `config: copied | preserved | missing`을 제공한다.
- 제공: 대상 config가 없고 base config가 HEAD에 없으면 base 바이트를 복사한다. HEAD에 있는 파일이면 dirty base 사본 대신 HEAD 바이트를 사용한다.
- 제공: execute 절차는 `config: missing`일 때 기본 allowlist로 진행한다는 경고를 한 줄 표시한다.
- 거부: 대상 worktree에 config가 있으면 내용이 달라도 덮어쓰지 않고 `preserved`로 보고한다.
- 거부: base에 config가 없으면 파일을 만들지 않으며, 어떤 경우에도 base config를 restore·unstage·삭제하지 않는다.

#### Do not touch

- `scripts/src/lib/verification.ts` — allowlist와 config 오류 정책은 Task 001에서 완료한다.
- `scripts/src/lib/runtime-state.ts` — 포인터와 verify 원장 namespace는 후속 blueprint 범위다.
- `.bouncer/Distill.md` — worktree seed 대상에 포함하지 않는다.