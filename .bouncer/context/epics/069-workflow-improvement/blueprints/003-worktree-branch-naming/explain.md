---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/003-worktree-branch-naming/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-11T22:05:02.341+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '069'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9b02697a5b4eeffea4e76afc132ed40394d1714f
      diff_sha: 27af9d3d86b5103f71458a8ed9d0f4f0b2dfea626b2cd7c2fb65ffe6ad06db53
      quiz_score: 3/3
      disposition: 브랜치 이름 계약과 충돌·PR 처리 조건을 모두 이해함.
      recorded_at: '2026-09-11T22:10:30+09:00'
  task_commits:
    - id: '001'
      sha: e2754120
    - id: '002'
      sha: 3ef7288f
  coordinator:
    base: 8f87d6a491239fd1c9b5394192f8c898f3c099c7
    integration_head: 9b02697a5b4eeffea4e76afc132ed40394d1714f
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/003/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/003/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/003/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: e2754120c597bf0b856d593c1c2159c20bf5f09d
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/lib/schema.js
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/schema.ts
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/runtime-state.test.js
      - id: '002'
        status: integrated
        sha: 3ef7288f1b2cda04b3f84a66badbd8a8988b82d2
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/context-versioning.md
          - docs/contributing.md
          - docs/troubleshooting.md
          - references/spec-authoring/index.md
          - scripts/lib/execute-prepare.js
          - scripts/lib/finalize.js
          - scripts/src/lib/execute-prepare.ts
          - scripts/src/lib/finalize.ts
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-plan/SKILL.md
          - test/execute-prepare.test.js
          - test/finalize-pure.test.js
          - test/finalize.test.js
          - test/skill-bouncer-finalize.test.js
    decisions:
      - task: '001'
        decision: accepted after three review rounds; R001-R005 resolved; execute gate passed; commit-message terminal-form formatting corrected without changing approved source scope; changed docs/cli.md, runtime-state, schema, coordinator, and task tests
      - task: '002'
        decision: accepted after two review rounds; R001-R002 resolved; execute gate passed after restoring ignored lockfile dependencies in the assigned worker; changed execute-prepare, finalize, finalize/plan/coordinator documentation, and branch-consumer tests
---
# Explain

## Background

drive와 standalone execute가 서로 다른 브랜치 이름을 만들고 있었다. 이 변경은 blueprint의 commit type, epic id, blueprint id, 디렉터리 slug를 한 helper에서 읽어 integration과 standalone에 같은 이름을 준다. worker는 task id를 포함한 별도 이름을 사용한다.

coordinator는 bootstrap과 prepare에서 실제로 사용한 브랜치를 ledger에 남긴다. finalize와 draft PR은 그 값을 소비하므로 이름을 다시 조합하지 않는다.

## Intuition

브랜치 이름을 주소처럼 한 번 발급하고, 이후 단계는 그 주소를 전달한다.

## Code

`scripts/src/lib/runtime-state.ts`의 `branchNamesFor`와 `resolveWorktreeBranch`가 이름 계산, 형식 검증, 기존 worktree 재사용, 충돌 거절을 맡는다. `scripts/src/lib/coordinator.ts`는 integration과 worker 브랜치를 ledger 및 payload에 기록한다.

`scripts/src/lib/execute-prepare.ts`는 standalone worktree에 같은 helper를 사용한다. `scripts/src/lib/finalize.ts`는 ledger의 integration branch와 worker branch를 payload와 explain metadata에 넣는다. `skills/bouncer-finalize/references/draft-pr.md`는 payload branch가 없으면 push를 중단하도록 안내한다.

## Quiz

1. integration과 standalone execute가 새 worktree를 만들 때 쓰는 브랜치 이름은 어느 값으로 정해지나요?
   - A. task id와 현재 시간
   - B. commit type, epic id, blueprint id, blueprint 디렉터리 slug
   - C. blueprint title의 영문 번역

2. 계산한 브랜치가 이미 존재하지만 예상 worktree에 연결되지 않았다면 어떻게 처리하나요?
   - A. 숫자 suffix를 붙여 새 브랜치를 만든다
   - B. 기존 브랜치를 rename한다
   - C. `branch-conflict`로 중단한다

3. finalize payload의 top-level branch가 `null`이면 draft PR 단계는 어떻게 해야 하나요?
   - A. push와 PR 생성을 건너뛰고 이유를 보고한다
   - B. blueprint slug로 브랜치를 다시 계산한다
   - C. 기본 브랜치로 push한다

## 이해 상태

정답은 1-B, 2-C, 3-A이며 응답은 1-B, 2-C, 3-A입니다. 세 문항 모두 정답(3/3)으로, 브랜치 이름을 helper에서 발급하고 충돌을 거절하며 branch가 없을 때 PR push를 건너뛰는 계약을 이해한 것으로 기록했습니다.

## Tasks

### Task 001

#### Goal & intent

Integration·standalone·worker branch 이름을 `scripts/src/lib/runtime-state.ts`의 helper 한 곳에서 계산하고 검증한다. `coordinate bootstrap`과 `coordinate prepare`는 이 helper의 결과로 `git worktree add -b`를 실행하고, 실제 branch를 ledger와 payload에 기록한다.

수용 기준은 helper 단위 테스트와 실제 Git fixture 회귀가 통과하고 `npm run ci`가 성공하는 것이다.

#### Interface

- 제공: `branchNamesFor({ repoRoot, blueprint, task?, deps? })`.
  ```text
  integration = standalone = '<commit_type>/<epic-id>-<blueprint-id>-<blueprint-slug>'
  worker      = 'bouncer/<epic-id>-<blueprint-id>-<task-id>'   (task가 있을 때만)
  예: blueprint .bouncer/context/epics/068-x/blueprints/001-distill-removal-context-search-ci-recovery, commit_type feat
      integration 'feat/068-001-distill-removal-context-search-ci-recovery', worker(005) 'bouncer/068-001-005'
  ```
  - `commit_type`은 blueprint `index.md`의 `bouncer.commit_type`이다. 필드가 없거나, `index.md`가 없거나, frontmatter를 읽을 수 없으면 `DEFAULT_COMMIT_TYPE`을 쓴다. 기존 fixture 다수가 `index.md` 없이 bootstrap하므로 이 fallback은 거절이 아니다.
  - slug는 디렉터리 이름에서 `<blueprint-id>-` 접두사를 뗀 값이다.
- 제공: `resolveWorktreeBranch({ repoRoot, worktreePath, branch, execFileSync? })`.
  ```text
  worktreePath가 등록된 worktree → { action: 'reuse', branch: <그 worktree의 실제 branch> }
  branch 미존재                 → { action: 'create', branch }
  ```
- 제공: `coordinate bootstrap` 성공 payload와 ledger의 `integrationBranch`, `coordinate prepare`의 task 항목 `branch`. Branch 필드가 없는 기존 ledger로 재개하면 worktree의 실제 branch를 읽어 채운다. Verification task는 worker가 없으므로 `branch`를 두지 않는다.
- 제공: `scripts/src/lib/schema.ts`에 `.gitmessage` 7종 `COMMIT_TYPE_ENUM`을 추가하고, "값 검사는 TASKS-002" 주석을 새 위치로 고친다.
- 거부(모든 판정은 `git worktree add`와 source 변경 전에 끝난다):
  ```text
  invalid-commit-type   commit_type 값이 있고 feat·fix·docs·style·refactor·test·chore 밖
  invalid-branch-name   git check-ref-format --branch 실패
  branch-conflict       branch가 존재하지만 예상 worktree에 연결되지 않음(suffix를 붙이지 않음)
  ```
  Standalone과 integration은 이름이 같으므로, standalone execute worktree가 이미 그 branch를 쓰는 blueprint에서 bootstrap하면 `branch-conflict`로 멈춘다.

#### Do not touch

- `scripts/src/lib/execute-prepare.ts` — standalone 소비는 TASKS-002 소관이다
- `scripts/src/lib/finalize.ts` — finalize 소비는 TASKS-002 소관이다
- `scripts/src/lib/seed-worktree.ts` — seed 계약은 바뀌지 않는다
- `skills/` — 스킬 문서 소비는 TASKS-002 소관이다

### Task 002

#### Goal & intent

Standalone `bouncer execute prepare`, finalize payload, explain의 coordinator frontmatter, draft PR push, cleanup·troubleshooting·설계 문서가 TASKS-001의 branch helper와 기록된 실제 branch를 쓰게 한다. PR과 cleanup 단계는 branch 이름을 다시 조합하지 않는다.

수용 기준은 execute prepare·finalize 회귀 테스트와 draft PR 문구 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: `bouncer execute prepare`는 `branchNamesFor().standalone`과 `resolveWorktreeBranch`로 branch를 정한다. Payload의 `branch`는 새로 만든 branch 또는 재사용한 worktree의 실제 branch다. Drive payload에는 여전히 `branch`가 없다.
- 제공: `bouncer finalize` payload 필드.
  - top-level `branch`: drive면 ledger의 `integrationBranch`, standalone이면 finalize를 실행한 checkout의 실제 branch. 둘 다 얻지 못하면 `null`.
  - `coordinator.integrationBranch`: ledger 값. 없으면 `integrationPath`의 실제 branch, 그것도 없으면 `null`.
  - `coordinator.tasks[].branch`: ledger 값. 없으면 `workerPath`의 실제 branch, 그것도 없으면 `null`(verification task 포함).
- 제공: explain frontmatter `bouncer.coordinator.integration_branch`와 `bouncer.coordinator.tasks[].branch`(snake_case 정본, 값은 위 payload와 같음).
- 제공: `draft-pr.md` push 명령은 finalize payload의 top-level `branch`를 쓴다. Drive에서 이 값은 `coordinator.integrationBranch`와 같다.
  ```bash
  git push -u origin <finalize payload branch>
  ```
- 거부: execute prepare는 TASKS-001의 `invalid-commit-type`, `invalid-branch-name`, `branch-conflict`를 그대로 반환하고 worktree를 만들지 않는다. Finalize는 branch를 얻지 못해도 거절하지 않는다. Draft PR은 `branch`가 `null`이면 push하지 않고 이유를 보고한다.

#### Do not touch

- `scripts/src/lib/runtime-state.ts` — helper 계약은 TASKS-001이 확정했다
- `scripts/src/lib/coordinator.ts` — coordinator 기록은 TASKS-001이 확정했다
- `skills/bouncer-finalize/references/explain-quiz.md` — explain 작성 절차는 바뀌지 않는다