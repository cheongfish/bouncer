---
type: bouncer.blueprint
title: 검증 대상 선택·finalize 분리와 CLI 지연 로딩
description: Separate verification target selection, split finalize and its shared git and commit-message helpers, and load only the selected CLI command's feature modules
resource: .bouncer/context/epics/runtime-architecture/blueprints/boundary-introduction/index.md
tags:
  - bouncer
  - blueprint
  - refactor
  - cli
  - lazy-load
  - finalize
  - verification
timestamp: '2026-10-16T15:34:17.285+09:00'
bouncer:
  id: boundary-introduction
  epic_id: runtime-architecture
  blueprint_id: boundary-introduction
  status: closed
  order: 32
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 검증 대상 선택·finalize 분리와 CLI 지연 로딩

Epic: [106](../../../source-restructuring/index.md)

## Intent
- 문제: `require('./scripts/lib/cli')` 하나로 모듈 80개가 적재되고, 검증 실행부가 `current`로 기본 대상을 직접 고르며, `commit`·`finalize-digest`·`finalize-pr`가 Git·커밋 메시지 helper 때문에 `finalize` 전체를 가져온다.
- 완료 조건: 검증 실행부는 선택된 대상만 받고, 공통 Git·커밋 메시지와 finalize의 수집·검사·표현이 별도 모듈로 나뉘며, help와 unknown-command는 업무 기능 모듈을 적재하지 않는다.

## Contract
- 인터페이스:
  - `scripts/src/lib/verification-target.ts`: `resolveVerificationTarget({ repoRoot, blueprintDir, taskId?, deps? })`, `runSelectedVerification({ repoRoot, blueprintDir, markTaskVerified?, deps? })`, 이동한 `readVerifyCommand`. 기본 대상 선택(`current.resolveEffectiveTask`)은 이 모듈만 한다.
  - `scripts/src/lib/verification.ts`: `runVerification`은 `taskId` 또는 `effectiveTask`로 대상을 받고, 둘 다 `undefined`면 `VERIFY_TARGET_REQUIRED`로 거절한다. `current`를 직접·전이적으로 참조하지 않는다. `entriesForVerify`·`readVerifyCommand` export는 제거하고 목록 선택은 `selectVerificationEntries`로 내보낸다.
  - `scripts/src/lib/execution-contracts.ts`: `EffectiveTask` 타입 정본을 더한다.
  - `scripts/src/lib/git-ops.ts`: `realGit`, `resolveCheckoutBranch`, `GitApi`.
  - `scripts/src/lib/commit-message.ts`: `buildCommitMessage`, `buildFinalizeCommitMessage`.
  - `scripts/src/lib/finalize-collect.ts`·`finalize-checks.ts`·`finalize-explain.ts`: finalize의 수집·검사·표현 helper. `finalize.ts`는 `finalize()` 조정만 남기고 `{ finalize }`만 내보낸다.
  - `scripts/src/lib/cli-usage.ts`: 명령별 정적 usage 문자열. `cli.ts`는 이 모듈과 `cli-flags`만 최상위에서 가져오고, 명령 모듈은 선택 뒤 적재한다.
- 데이터·상태: 저장 형식, ledger·evidence 필드, CLI usage 바이트·exit code·JSON 출력은 바뀌지 않는다.
- 수용 기준: 에픽 성공 기준 5·6·7·8. TASKS-001이 7(verification 경계), TASKS-002가 5·7(delivery 경계), TASKS-003이 6을 맡고, 순서는 001 → 002 → 003 → 004다. 8은 각 task의 Do not touch에 적은 외부 계약 테스트가 수정 없이 통과하는 것으로 판정한다. 9·10은 이 blueprint에서 판정하지 않는다. TASKS-004는 경계 inventory와 CLI 적재 범위의 중간 기록만 남기고, 전후 비교 표는 BP 003이 채운다. 에픽 성공 기준 11의 `npm run ci`는 PR의 CI가 판정한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `taskId`가 세 자리가 아니거나 목록에 없으면 지금처럼 `VERIFY_IDENTITY_INVALID`다. lease를 확인할 수 없는 worker에서는 대상 목록이 비고, 기본 scope 해석은 `no active lease for worker worktree`로 거절한다.
  - `markTaskVerified`는 effective task가 같은 blueprint의 같은 tasks.md를 가리킬 때만 상태를 쓴다. 목록 폴백으로 고른 task 하나는 승격하지 않는다.
  - `coordinate <sub> --help`, `help`·`--help`·`-h`, unknown-command 출력은 바이트 그대로다.
  - 옛 export 제거는 저장소 안 소비자를 모두 옮긴 뒤 한다. 저장소 밖 사용은 배제할 수 없으므로 영향은 inventory에 기록한다.
  - `runVerification`에 `taskId`와 `effectiveTask`가 모두 `undefined`면 `VERIFY_TARGET_REQUIRED`다. `effectiveTask: null`은 pointer task가 없다는 유효한 입력이다.
  - 새 모듈이 `finalize`·`current`·`cli`를 다시 가져오면 경계 검사가 실패해야 한다. TASKS-001은 `verification`·`verification-target`, TASKS-002는 delivery 새 모듈과 소비자, TASKS-003은 `cli-usage`를 모듈 그래프나 자식 프로세스 적재로 검사한다.

## Out of scope
- `coordinator`의 원장 저장·명령 처리 분리, execution 영역 공개 경계, 중복 fixture 정리(BP 003).
- `finalize-digest`의 `prepareFinalizeDigest` 내부 분해.
- planning 영역 공개 경계.
- `seed-worktree`의 별도 `realGit`과 `finalize-release-main`의 Git 호출 통합.
- CLI 명령 추가·삭제와 usage 문구 변경.

## One-commit justification
- 세 경계(verification·delivery·CLI)는 "기능 간 소비자는 공개 경계만 쓴다"는 같은 불변 조건을 공유한다. CLI 지연 로더(003)는 001·002가 만든 경계 모듈을 적재 단위로 쓰므로, 001·002 없이 003만 병합하면 기능 영역 표의 경계가 증명되지 않는다. 002는 001이 옮긴 `readVerifyCommand` import를 가진 `finalize.ts`를 다시 나누므로 001 뒤에 온다.

## Documents
* [Tasks](tasks/001/tasks.md) - 검증 대상 선택 경계 분리
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Tasks 002](tasks/002/tasks.md) - 공통 Git·커밋 메시지 모듈과 finalize 분리
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Tasks 003](tasks/003/tasks.md) - CLI 정적 usage와 명령별 지연 로딩
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Tasks 004](tasks/004/tasks.md) - 영역 배치 inventory 갱신
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
