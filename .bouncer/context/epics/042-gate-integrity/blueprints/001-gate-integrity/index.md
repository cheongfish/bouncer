---
type: bouncer.blueprint
title: 커밋 스코프와 검증 증적 게이트 강제
description: '-a 커밋 검사 집합 확장과 하네스 소유 verify 증적 대조'
resource: .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-21T15:07:14.638+09:00'
bouncer:
  id: '001'
  epic_id: '042'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
---
# 001 게이트 보증 복구

Epic: [042](../../index.md)

## Intent
- 문제: 커밋 훅은 `git diff --cached`만 읽어 `-a` 계열 커밋의 검사 대상을 놓치고, G13은 문서가 자기 자신과만 일관되면 통과한다. 두 게이트 모두 탐지는 정상이고 판단 재료가 틀렸다.
- 완료 조건: 훅이 `-a` 계열에서 추적 중 수정 파일까지 함께 검사하고, G13이 하네스가 남긴 실행 원장과 문서 메타데이터를 대조하며, README·docs가 그 수준만 보증한다.

## Contract
- 인터페이스:
  - `evaluateCommit({ command, repoRoot, deps })` — 검사 대상 파일 집합이 `staged ∪ (all-flag ? trackedModified : [])`가 된다. `deps.trackedModified({ repoRoot })` 주입점을 추가하고, 기본 구현은 `git diff HEAD --name-only`다.
  - 커밋 탐지 함수 — `commit` 서브커맨드와 함께 `-a` / `--all` / `-am` 같은 결합 단축 플래그 포함 여부를 함께 보고한다. 명령을 판단할 수 없는 기존 fail-closed 경로는 all-flag가 있는 것으로 취급한다.
  - `recordVerificationResult(...)` — `verification.md`를 쓸 때 하네스 소유 실행 원장을 Git common directory 아래에 함께 기록한다.
  - `checkGate({ gate: 'execute' | 'commit', deps })` — G13이 문서 프론트매터의 `command` / `ran_at` / `exit_code` / `output_tail`을 원장 레코드와 대조한다. commit 게이트도 같은 판정을 돌린다. 그러지 않으면 `/bouncer-commit`을 직접 불러 `status: passed`만 손으로 적은 문서로 커밋을 열 수 있다. `deps.readVerifyLedger`로 주입 가능하다.
- 데이터·상태: 원장은 `<git-common-dir>/bouncer/verify/` 아래 JSON 한 건이며 레코드는 `{ rel, command, ran_at, exit_code, output_sha }`다. 커밋 대상이 아니고 `current` 포인터와 같은 신뢰 수준의 런타임 상태다.
- 수용 기준: epic 성공 조건 1~5.
- 검증 명령: `npm run verify:strict`
- 실패 모드·엣지 케이스:
  - `git diff HEAD` 실패(비저장소·git 오류)는 통과가 아니라 차단이다. 훅의 기존 fail-closed와 같다.
  - `--all`, `-va`처럼 결합된 단축 플래그와 `-a` 뒤 pathspec 조합도 all-flag로 읽힌다.
  - `git diff HEAD --name-only`는 삭제된 파일 이름도 낸다. 이름만 스코프 검사에 쓰고 파일을 읽지 않는다.
  - linked worktree에서 실행돼도 원장은 common directory에 있어 primary와 같은 레코드를 본다.
  - 기존 저장소의 원장 없는 `verification.md`는 G13으로 실패한다. 하위 호환이 깨지므로 CHANGELOG에 적고 재실행(`bouncer verify`) 경로를 안내한다.
  - `-am`에서 커밋되는 파일이 모두 범위 안이면 그대로 통과한다. 정상 워크플로는 막지 않는다.
  - `git commit -am x -- <pathspec>`처럼 pathspec으로 좁힌 커밋은 합집합 검사가 범위 밖 수정까지 보므로 오탐으로 막힐 수 있다. fail-closed 방향의 대가이며 `docs/security.md`에 적는다.
  - commit 게이트 G17의 검사 대상은 그대로 스테이징 경로다. 명령 문자열을 받지 않으므로 `-a` 확장은 PreToolUse 가드에만 있다.

## Out of scope
- `-a`를 항상 거부하는 엄격 모드와 그 설정 키.
- `bouncer commit`의 스테이징 경로. 이미 `changedFiles` / `untrackedFiles`로 자체 스코프 검사를 한다.
- `.bouncer/` 배포 분리, 버전 표기 변경, 손익분기 측정.

## One-commit justification
task 셋으로 커밋을 나누되 리뷰·PR 단위는 하나다. 두 게이트 수정과 그 보증 문구는 함께 읽혀야 판단할 수 있다 — 문구만 먼저 고치면 거짓 보증이 남고, 코드만 고치면 README가 여전히 틀린 수준을 약속한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `-a` 계열 커밋의 검사 대상 확장
* [Tasks 002](tasks/002/tasks.md) - verify 증적 원장과 G13 대조
* [Tasks 003](tasks/003/tasks.md) - 게이트 보증 문구 정정
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
