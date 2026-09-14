---
type: bouncer.explain
title: Task commit provenance 설명
description: Records how this drive wired stable Task IDs into Git trailers and Explain rows while keeping the eight-character SHA contract.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/001-task-commit-provenance/explain.md
tags:
  - bouncer
  - explain
  - commit-provenance
  - stable-task-id
timestamp: '2026-09-14T11:39:18.125+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '071'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0c30d2d428e6f9efa21bdc9e5e4fbcdf458778ea
      diff_sha: eca91dc1a692daa4cd24ce531b7963bad7765ee8830635a43af5c984e5a67fdd
      quiz_score: 2/3
      disposition: 3문항 중 2정답. trailer 키를 Bouncer-Epic/Blueprint로 골랐고, Explain 행 필드와 소문자 8자리 SHA는 맞음.
      recorded_at: '2026-09-14T12:48:38+09:00'
  task_commits:
    - id: '001'
      sha: 03b62463
    - id: '002'
      sha: d24aa401
  coordinator:
    base: 58b5f42b8d4880dad034ebcc762839182b8634cd
    integration_head: 0c30d2d428e6f9efa21bdc9e5e4fbcdf458778ea
    integration_branch: feat/071-001-task-commit-provenance
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/001/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 03b624636c0b29cd3982a663af389bec11dfe1e0
        branch: bouncer/071-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - .gitmessage
          - docs/cli.md
          - scripts/lib/commit-sha.js
          - scripts/lib/finalize.js
          - scripts/src/lib/commit-sha.ts
          - scripts/src/lib/finalize.ts
          - test/cli-commit.test.js
          - test/commit-task.test.js
          - test/coordinator-e2e.test.js
          - test/finalize-pure.test.js
      - id: '002'
        status: integrated
        sha: d24aa4010063950e7149789ba910491b9914dbe9
        branch: bouncer/071-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - docs/context-retention-and-epic-lifecycle.md
          - rules/governance.md
          - rules/okf.md
          - scripts/lib/context-digest.js
          - scripts/lib/finalize.js
          - scripts/src/lib/context-digest.ts
          - scripts/src/lib/finalize.ts
          - skills/bouncer-commit/SKILL.md
          - test/context-digest.test.js
          - test/finalize.test.js
          - test/skill-bouncer-commit.test.js
    decisions:
      - task: '001'
        decision: 'Drive order 001 then 002. Accepted TASKS-001 worker SHA 03b624636c0b29cd3982a663af389bec11dfe1e0 on bouncer/071-001-001. Implementer bouncer-implementer (e93ed890) changed .gitmessage, docs/cli.md, scripts/lib/commit-sha.js, scripts/lib/finalize.js, scripts/src/lib/commit-sha.ts, scripts/src/lib/finalize.ts, test/cli-commit.test.js, test/commit-task.test.js, test/coordinator-e2e.test.js, test/finalize-pure.test.js. Scope impact none; no revise. Debugger (3b17650d) found missing worker npm ci; implementer recovery (804c3210) ran npm ci --include=dev in this worktree only. Refused seed-worktree.ts revise (outside task intent). Stripped leftover scaffold HTML comments from untracked plan docs so lint:context-comments could pass. Discovery review: SPEC-EXTRA-001, CT-001, CT-002, MM-001, MM-002, MM-003 all advisory accepted; no must_fix; no delta. Execute gate passed. actualPaths as committed.'
      - task: '002'
        decision: Drive order 001 then 002. Accepted TASKS-002 worker SHA d24aa4010063950e7149789ba910491b9914dbe9 on bouncer/071-001-002. Implementer (f05458c2) changed docs/context-retention-and-epic-lifecycle.md, rules/governance.md, rules/okf.md, scripts/lib/context-digest.js, scripts/lib/finalize.js, scripts/src/lib/context-digest.ts, scripts/src/lib/finalize.ts, skills/bouncer-commit/SKILL.md, test/context-digest.test.js, test/finalize.test.js, test/skill-bouncer-commit.test.js. Scope impact none; no revise. Discovery must_fix SS-002/CT-001/MM-003, CT-002, MM-001; one fix batch implementer (c30ec94f). Delta (5bd3861d) resolved those three; no introduced_by_revision or missed_critical. SS-001 and MM-002 advisory accepted. Execute gate passed. actualPaths as committed.
---
# Explain

## Background

Task 번호 `001`만으로는 Blueprint가 바뀌면 같은 커밋을 가리키지 못한다. 이 drive는 `EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`를 Git trailer와 Explain 행에 같이 써서 그 연결을 고정했다.

승인 DAG와 실행 DAG는 둘 다 `001 → 002`다. task나 간선을 더하거나 나누거나 순서를 바꾸지 않았다. 두 task 모두 `scope_revision`이 없고 커밋 `actualPaths`는 승인 `affected_paths`와 같다.

001은 implementer가 worker `bouncer/071-001-001` SHA `03b624636c0b29cd3982a663af389bec11dfe1e0`에 쓰고, integration `78ee3989a9997f01e2b27171c379b9cb490b0598`로 cherry-pick했다. debugger는 worker `npm ci` 누락을 찾았고, `seed-worktree.ts` 개정은 거절했다.

002는 implementer가 worker `bouncer/071-001-002` SHA `d24aa4010063950e7149789ba910491b9914dbe9`에 쓰고, integration `0c30d2d428e6f9efa21bdc9e5e4fbcdf458778ea`로 cherry-pick했다. discovery must_fix 3건(parent-ID fail-closed, writer skip tests, dead catch)을 한 번 고쳤고, delta는 `introduced_by_revision`과 `missed_critical`이 없다고 했다.

## Intuition

커밋 메시지 끝의 `Bouncer-Task` 값과 Explain `task` 필드가 같은 문자열이다. SHA는 소문자 8자리다.

## Code

- `scripts/src/lib/commit-sha.ts` — `buildStableProvenance()`가 Epic·Blueprint·`TASKS-NNN`을 검증하고 trailer 두 줄을 만든다.
- `scripts/src/lib/finalize.ts` — `buildCommitMessage()`가 trailer를 본문 뒤에 붙인다. `collectTaskCommits()` / `writeExplainTaskCommits()`는 `{ task, sha, intent_anchor }`만 쓴다. Explain 부모 ID를 못 읽거나 번호가 다르면 행을 만들지 않는다.
- `scripts/src/lib/context-digest.ts` — `taskCommitHeadings()`는 새 행을 먼저 읽고, 실패하면 legacy `{ id, sha }`로 떨어진다.
- 테스트: `test/finalize-pure.test.js`, `test/commit-task.test.js`, `test/cli-commit.test.js`, `test/coordinator-e2e.test.js`, `test/finalize.test.js`, `test/context-digest.test.js`.

## Quiz

1. commit-producing Task의 Git message 끝에 붙는 trailer 키는 무엇인가?
   - A) `Bouncer-Task`와 `Bouncer-Intent`
   - B) `Bouncer-Epic`과 `Bouncer-Blueprint`
   - C) `Signed-off-by`와 `Reviewed-by`

2. 새 Explain `bouncer.task_commits` 행이 쓰는 필드는 무엇인가?
   - A) `{ id, sha }`
   - B) `{ task, sha, intent_anchor }`
   - C) `{ epic, blueprint, commit }`

3. `commit_sha`와 Explain `sha`의 길이는 어떻게 되나?
   - A) 전체 Git SHA 40자
   - B) 대문자 8자리 hex
   - C) 소문자 8자리 hex

## 이해 상태

퀴즈 3문항, 응답 3문항, 정답 2문항 (`2/3`). 마감은 점수와 무관하다.

1. trailer 키 — 정답 A `Bouncer-Task`와 `Bouncer-Intent` / 응답 B / 오답
2. Explain `task_commits` 필드 — 정답 B `{ task, sha, intent_anchor }` / 응답 B / 정답
3. SHA 길이 — 정답 C 소문자 8자리 hex / 응답 C / 정답

disposition: trailer 키를 Bouncer-Epic/Blueprint로 골랐고, Explain 행 필드와 소문자 8자리 SHA는 맞음.

## Tasks

### Task 001

#### Goal & intent

Task frontmatter의 Epic·Blueprint·Task 번호에서 stable Task ID를 만들고, 모든 commit-producing 경로가 같은 `Bouncer-Task`와 `Bouncer-Intent` trailer를 사용하게 한다. dry-run payload와 실제 Git commit이 byte-identical message를 사용하고 verification Task에는 trailer나 commit이 생기지 않아야 한다.

#### Interface

- 제공: stable Task ID `EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`, stable Intent ID `EPIC-<ddd>/BP-<ddd>`, 그리고 Git trailer 두 줄을 반환하는 검증 helper 계약을 제공한다.
- 거부: `epic_id`, `blueprint_id`, `TASKS-NNN` 중 하나라도 정본 세 자리 형식이 아니거나 message 저작 필드에 `Bouncer-Task` 또는 `Bouncer-Intent` trailer가 있으면 commit 전에 오류를 반환한다.

#### Do not touch

- `scripts/src/lib/coordinator.ts` — coordinator가 commit message를 별도로 조립하지 않으므로 실행 코어를 중복 수정하지 않는다.
- `scripts/src/lib/commit.ts` — dry-run과 실제 경로가 이미 하나의 `commitMessage`를 공유하므로 별도 message 조립을 추가하지 않는다.
- `scripts/src/lib/context-digest.ts` — 새 Explain 행의 소비는 TASKS-002에서 담당한다.

### Task 002

#### Goal & intent

Finalize가 Task별 stable ID, 기존 8자리 SHA, `task-<ddd>` intent anchor를 새 `task_commits` 행으로 보존하게 한다. context digest와 문서 계약은 새 행을 우선 읽고 기존 `{ id, sha }` 행도 같은 task anchor와 SHA로 해석해야 한다.

#### Interface

- 제공: 새 Explain `bouncer.task_commits[]` 행에 `task`, `sha`, `intent_anchor`를 기록하고 legacy 행을 읽는 dual-read 계약을 제공한다.
- 거부: 새 형식과 legacy 형식 어느 쪽으로도 해석할 수 없는 행, 다른 Epic·Blueprint를 가리키는 stable ref, `task-<ddd>`가 아닌 anchor, 8자리로 정규화할 수 없는 SHA는 provenance heading에서 제외한다.

#### Do not touch

- `scripts/src/lib/commit.ts` — `commit_sha`의 8자리 기록 계약은 그대로 유지한다.
- `scripts/src/lib/coordinator.ts` — worker SHA 앞 8자리 대조와 cherry-pick 상태 전이는 변경하지 않는다.
- `scripts/src/lib/validate-gates.ts` — 이번 Blueprint는 gate 번호나 판정을 바꾸지 않는다.