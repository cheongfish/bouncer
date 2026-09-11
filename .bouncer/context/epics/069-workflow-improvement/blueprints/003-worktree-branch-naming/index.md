---
type: bouncer.blueprint
title: worktree branch 이름 표준화
description: One CLI helper derives integration, standalone, and worker branch names, validates them before any mutation, and records the actual branch for later steps.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/003-worktree-branch-naming/index.md
tags:
  - bouncer
  - blueprint
  - worktree
  - branch
  - coordinator
timestamp: '2026-09-11T10:25:27.588+09:00'
bouncer:
  id: '003'
  epic_id: '069'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 003 worktree-branch-naming

Epic: [069](../../index.md)

## Intent
코디네이터와 단독 실행이 서로 다른 브랜치 이름 체계를 사용하던 문제를 해소함.
통합·단독·작업 브랜치는 명령행 도우미가 계산·검증하고, 기록된 실제 브랜치를 마감과 풀 리퀘스트 단계가 재계산 없이 사용함.

## Contract
- 인터페이스:
  - `branchNamesFor({ repoRoot, blueprint, task? })` → `{ integration, standalone, worker? }`. Integration과 standalone은 `<commit_type>/<epic-id>-<blueprint-id>-<blueprint-slug>`, worker는 `bouncer/<epic-id>-<blueprint-id>-<task-id>`이다.
  - `resolveWorktreeBranch({ repoRoot, worktreePath, branch })` → `{ action: 'reuse' | 'create', branch }` 또는 충돌 거절. 판정은 worktree·source 변경 전에 끝난다.
  - `coordinate bootstrap` payload와 ledger에 `integrationBranch`, `coordinate prepare`의 task 항목에 `branch`를 추가한다. Verification task에는 `branch`가 없다.
  - `bouncer execute prepare` standalone payload의 `branch`는 helper 결과 또는 재사용한 worktree의 실제 branch다. Drive payload에는 `branch`가 없다.
  - `bouncer finalize` payload의 top-level `branch`(drive면 ledger `integrationBranch`, standalone이면 실행 checkout의 실제 branch, 얻지 못하면 `null`), `coordinator.integrationBranch`, `coordinator.tasks[].branch`. Ledger에 값이 없으면 worktree의 실제 branch, 그것도 없으면 `null`이다.
  - Explain frontmatter의 `coordinator.integration_branch`와 `coordinator.tasks[].branch`.
  - Draft PR push는 finalize payload의 top-level `branch`를 쓰고, `null`이면 push하지 않는다.
- 데이터·상태: `commit_type`은 blueprint frontmatter의 `bouncer.commit_type`이다. 필드나 `index.md`가 없거나 읽을 수 없으면 `DEFAULT_COMMIT_TYPE`을 쓴다. `blueprint-slug`는 canonical blueprint 디렉터리 이름에서 `<blueprint-id>-` 접두사를 뗀 값이며 `title`에서 만들지 않는다. 새 ledger 필드는 선택이라 기존 ledger도 계속 읽힌다.
- 수용 기준: epic 성공 조건 8, 9, 10, 11.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `commit_type` 값이 `.gitmessage` 7종 밖이면 이름을 만들지 않고 `invalid-commit-type`으로 거절한다.
  - `git check-ref-format --branch`가 거부하는 이름은 worktree를 만들기 전에 `invalid-branch-name`으로 거절한다.
  - 예상 경로에 등록된 worktree가 있으면 그 worktree의 실제 branch를 재사용하고 rename하지 않는다.
  - 계산한 branch가 존재하지만 예상 worktree에 연결되어 있지 않으면 `-2` 같은 suffix 없이 `branch-conflict`로 중단한다.
  - Standalone과 integration은 이름이 같다. Standalone execute로 시작한 blueprint에서 나중에 drive를 시작하면 bootstrap이 `branch-conflict`로 멈춘다. 사람이 기존 branch를 옮기거나 지운 뒤 다시 실행하며, 복구 절차는 `docs/troubleshooting.md`가 안내한다.
  - Branch 필드가 없는 기존 ledger로 재개하면 worktree의 실제 branch를 읽어 기록하고 이름을 바꾸지 않는다.

## Out of scope
- 기존 branch를 새 규칙으로 바꾸는 migration과 rename.
- Worktree 경로 규칙(`worktreePathFor`, `coordinatorPathsFor`의 디렉터리 배치).
- PR 본문의 Explain 링크 규칙(결정 4).
- 원격 branch 삭제와 cleanup 뒤 branch 정리 정책.

## One-commit justification
- TASKS-001이 helper와 coordinator 생성·기록을, TASKS-002가 standalone execute, finalize, PR, 문서 소비자를 한 커밋씩 닫는다. 두 커밋이 합쳐 branch 이름 계약 한 PR이 된다.

## Documents
* [Task 001](tasks/001/tasks.md) - branch 이름 helper와 coordinator 적용
* [Task 002](tasks/002/tasks.md) - execute·finalize·PR의 branch 소비 전환
* [Context review](context-review.md) - 계획 문서 정합성 판정
