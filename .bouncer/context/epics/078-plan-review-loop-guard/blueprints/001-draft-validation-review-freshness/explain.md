---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/078-plan-review-loop-guard/blueprints/001-draft-validation-review-freshness/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-23T10:52:11.075+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '078'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: df6b87ac7b1aafc6ab7e22a8493df90ff3ef7ae1
      diff_sha: a45a1a111d2bc9002c49460fc3adcf8577d49c97565df228c0698255ede05df9
      quiz_score: 4/4
      disposition: all correct; proceed to remainder
      recorded_at: '2026-09-23T10:54:56+09:00'
  task_commits:
    - task: EPIC-078/BP-001/TASK-001
      sha: 9972fadb
      intent_anchor: task-001
    - task: EPIC-078/BP-001/TASK-002
      sha: 44ed142a
      intent_anchor: task-002
    - task: EPIC-078/BP-001/TASK-003
      sha: 0bd521aa
      intent_anchor: task-003
    - task: EPIC-078/BP-001/TASK-004
      sha: b9898a60
      intent_anchor: task-004
  coordinator:
    base: 45735ae1422e9acbf27b8a4ff71c007c04dfc487
    integration_head: df6b87ac7b1aafc6ab7e22a8493df90ff3ef7ae1
    integration_branch: feat/078-001-draft-validation-review-freshness
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/078/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/078/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/078/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/078/001/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/078/001/workers/004
    tasks:
      - id: '001'
        status: integrated
        sha: 9972fadbc020366ad5fc602805375ef39b9aa1cc
        branch: bouncer/078-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/scaffold.js
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/src/lib/scaffold.ts
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - test/scaffold.test.js
          - test/validate-gates.test.js
      - id: '002'
        status: integrated
        sha: 44ed142a0837397a669f1de2df7ae0e7b70ea968
        branch: bouncer/078-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/plan-snapshot.js
          - scripts/lib/review-dispatch.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate.js
          - scripts/src/lib/review-dispatch.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate.ts
          - test/cli-validate.test.js
          - test/review-dispatch.test.js
          - test/validate-gates.test.js
          - scripts/src/lib/plan-snapshot.ts
      - id: '003'
        status: integrated
        sha: 0bd521aac85fac51cbedc08e36fad259cda1c118
        branch: bouncer/078-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/validate-gates.js
          - scripts/src/lib/validate-gates.ts
          - test/cli-validate.test.js
          - test/validate-gates.test.js
      - id: '004'
        status: integrated
        sha: b9898a60960b46059e3d5324571c463698852411
        branch: bouncer/078-001-004
        scope_revision: null
        paths: []
        actual_paths:
          - references/context-review/index.md
          - references/spec-authoring/index.md
          - rules/cli.md
          - rules/gates.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/context-review.md
          - test/master-rules.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-context-review.test.js
          - test/skill-spec-authoring.test.js
      - id: '005'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 6a284157d7b4a231ec0c08ae93b78e70c213c94242523cb7df087f24984feb83
        base_head: 45735ae1422e9acbf27b8a4ff71c007c04dfc487
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 6a284157d7b4a231ec0c08ae93b78e70c213c94242523cb7df087f24984feb83
        outcome: accepted
        summary: 'bouncer-implementer attempt 1: verification-tasks.md template, scaffoldTask verification body selection, G20 Touch candidate message; npm test exit 0; combined review accepted (1 advisory nit F-001 accepted)'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: de12c9e42b6b9eb993b5830c24ce63da7dd3a15cf515317e1017793b6058043e
        base_head: 9972fadbc020366ad5fc602805375ef39b9aa1cc
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: de12c9e42b6b9eb993b5830c24ce63da7dd3a15cf515317e1017793b6058043e
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 1 (status ready->verified, commit_sha 9972fadb stamp); brief authority sections byte-identical; attempt 1 accepted result carried forward'
      - task: '001'
        decision: 'accepted TASKS-001 at 9972fadb (branch bouncer/078-001-001; implementer bouncer-implementer attempt 1; reviewer bouncer-reviewer combined discovery, F-001 nit advisory accepted; verify npm test exit 0 evidence 44914d06). changed paths: scripts/lib/scaffold.js, scripts/lib/templates.js, scripts/lib/validate-gates.js, scripts/src/lib/scaffold.ts, scripts/src/lib/templates.ts, scripts/src/lib/validate-gates.ts, test/scaffold.test.js, test/validate-gates.test.js. remediations: (1) seeded epic index.md and context index.md from integration copy into worker to clear execute-gate S8/S13, plan docs only, not committed; (2) attempt 2 re-baseline dispatch because controller frontmatter edits invalidated attempt-1 brief hash.'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 773c7311c723eed82b298954acb125dbde6321412c820534aede6bf871f5ec12
        base_head: 1cc426d764dc267c8adb411f0d671feeb5563bc7
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 773c7311c723eed82b298954acb125dbde6321412c820534aede6bf871f5ec12
        outcome: rework
        summary: 'rework: review round 1 must_fix RD-002-01 (minor correctness_tests) - no test asserts classifyPlanReview ''structural validation failed'' classification nor validateBlueprint planDraft skipping draft checks on structural failure. RD-002-02 nit advisory accepted. security: no findings. verify npm test exit 0.'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 773c7311c723eed82b298954acb125dbde6321412c820534aede6bf871f5ec12
        base_head: 1cc426d764dc267c8adb411f0d671feeb5563bc7
        initial_worktree_state: |2
           M .bouncer/context/index.md
          A  scripts/lib/plan-snapshot.js
          M  scripts/lib/review-dispatch.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/validate.js
           M scripts/src/lib/review-dispatch.ts
           M scripts/src/lib/validate-gates.ts
           M scripts/src/lib/validate.ts
           M test/cli-validate.test.js
           M test/review-dispatch.test.js
           M test/validate-gates.test.js
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
          ?? scripts/src/lib/plan-snapshot.ts
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 773c7311c723eed82b298954acb125dbde6321412c820534aede6bf871f5ec12
        outcome: accepted
        summary: 'bouncer-implementer attempt 2 fix batch: two regression tests for structural-vs-draft classification and planDraft skip; verify npm test exit 0 (577e87ed); delta certification resolved RD-002-01, no new findings; review accepted'
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: a111bd16c4a805166edf4a0f90dad4ef52347ff4c005e8e390f710e29d1d0525
        base_head: 44ed142a0837397a669f1de2df7ae0e7b70ea968
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: a111bd16c4a805166edf4a0f90dad4ef52347ff4c005e8e390f710e29d1d0525
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: controller-owned tasks.md frontmatter changed after attempt 2 (status ready->verified, commit_sha 44ed142a stamp); brief authority sections unchanged; attempt 2 accepted result carried forward'
      - task: '002'
        decision: 'accepted TASKS-002 at 44ed142a (branch bouncer/078-001-002; implementer bouncer-implementer attempts 1 and 2; reviewers bouncer-reviewer combined+security discovery, delta certification; RD-002-01 minor resolved, RD-002-02 nit advisory accepted; verify npm test exit 0 evidence 577e87ed). changed paths: scripts/lib/plan-snapshot.js, scripts/lib/review-dispatch.js, scripts/lib/validate-gates.js, scripts/lib/validate.js, scripts/src/lib/plan-snapshot.ts, scripts/src/lib/review-dispatch.ts, scripts/src/lib/validate-gates.ts, scripts/src/lib/validate.ts, test/cli-validate.test.js, test/review-dispatch.test.js, test/validate-gates.test.js. remediation: epic index.md/context index.md seeded into worker (plan docs, not committed); re-baseline dispatch attempt 3 after controller frontmatter edits.'
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: e130af2645682d70a17faf129d3b3d996309c7e57737583f584293a5e75b1a9a
        base_head: aa614b642c3b8e058849d028b731479358af194e
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: e130af2645682d70a17faf129d3b3d996309c7e57737583f584293a5e75b1a9a
        outcome: rework
        summary: 'rework: review round 1 must_fix F1 (major correctness_tests) - contextReviewFreshnessFailure skips comparison when the highest round has a non-string target.digest even if an earlier round has a string digest; brief Interface says the last round''s target.digest is the recorded value and skip only when no round has a string digest. F2 deferred (all-non-string truthy digest skip is brief-specified; root fix in Do-not-touch validate-sections.ts). F3 nit advisory accepted. verify npm test exit 0.'
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: e130af2645682d70a17faf129d3b3d996309c7e57737583f584293a5e75b1a9a
        base_head: aa614b642c3b8e058849d028b731479358af194e
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/validate-gates.js
           M scripts/src/lib/validate-gates.ts
           M test/cli-validate.test.js
           M test/validate-gates.test.js
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: e130af2645682d70a17faf129d3b3d996309c7e57737583f584293a5e75b1a9a
        outcome: accepted
        summary: 'bouncer-implementer attempt 2 fix batch: last-round digest compared whatever its type, skip only when no string digest; new unit test; verify npm test exit 0 (23afa7ad); delta resolved F1, F4 nit introduced_by_revision advisory accepted; F2 deferred; F3 accepted; review accepted'
      - task: '003'
        kind: dispatch
        attempt: 3
        task_brief_hash: a19a42730dac3520547443648f310b7ecf0efa718fc89ab31a4596ac3e61e6a1
        base_head: 0bd521aac85fac51cbedc08e36fad259cda1c118
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '003'
        kind: report
        attempt: 3
        task_brief_hash: a19a42730dac3520547443648f310b7ecf0efa718fc89ab31a4596ac3e61e6a1
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: controller-owned tasks.md frontmatter changed after attempt 2 (status ready->verified, commit_sha 0bd521aa stamp); brief authority sections unchanged; attempt 2 accepted result carried forward'
      - task: '003'
        decision: 'accepted TASKS-003 at 0bd521aa (branch bouncer/078-001-003; implementer bouncer-implementer attempts 1 and 2; reviewer bouncer-reviewer combined discovery + delta; F1 major resolved, F2 minor deferred to follow-up planning (all-non-string digest skip, root fix in validate-sections.ts), F3/F4 nits advisory accepted; verify npm test exit 0 evidence 23afa7ad). changed paths: scripts/lib/validate-gates.js, scripts/src/lib/validate-gates.ts, test/cli-validate.test.js, test/validate-gates.test.js. remediation: epic docs seeded into worker (not committed); re-baseline dispatch attempt 3.'
      - task: '004'
        kind: dispatch
        attempt: 1
        task_brief_hash: 6232f4500295b7b0650b249ce423e9eaf7f7159e6bd86b8159b0f7d081f314c0
        base_head: baf559257317c538ab197a52cc81198a38cbc61a
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '004'
        kind: report
        attempt: 1
        task_brief_hash: 6232f4500295b7b0650b249ce423e9eaf7f7159e6bd86b8159b0f7d081f314c0
        outcome: accepted
        summary: 'bouncer-implementer attempt 1: seven rule/reference docs and four doc tests updated; verify npm test exit 0 (cc45929f); combined review accepted (F-004-01 nit advisory accepted)'
      - task: '004'
        kind: dispatch
        attempt: 2
        task_brief_hash: b2df0b064991ea04fdafa6c880fcfe50a4bce3ab8a7cd1d85e37e352192ee555
        base_head: b9898a60960b46059e3d5324571c463698852411
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-plan-review-loop-guard/
      - task: '004'
        kind: report
        attempt: 2
        task_brief_hash: b2df0b064991ea04fdafa6c880fcfe50a4bce3ab8a7cd1d85e37e352192ee555
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: controller-owned tasks.md frontmatter changed after attempt 1 (status ready->verified, commit_sha b9898a60 stamp); brief authority sections unchanged; attempt 1 accepted result carried forward'
      - task: '004'
        decision: 'accepted TASKS-004 at b9898a60 (branch bouncer/078-001-004; implementer bouncer-implementer attempt 1; reviewer bouncer-reviewer combined discovery; F-004-01 nit advisory accepted; verify npm test exit 0 evidence cc45929f). changed paths: references/context-review/index.md, references/spec-authoring/index.md, rules/cli.md, rules/gates.md, skills/bouncer-plan/SKILL.md, skills/bouncer-plan/references/context-review.md, test/master-rules.test.js, test/skill-bouncer-plan.test.js, test/skill-context-review.test.js, test/skill-spec-authoring.test.js. remediation: epic docs seeded into worker (not committed); re-baseline dispatch attempt 2.'
---
# Explain

## Background
context review는 계획 snapshot digest를 얼린 뒤 진행한다. 그런데 G19·G20·Touch 정합성 오류는 plan gate에서야 드러났고, 그 오류를 고치면 본문이 바뀌어 리뷰 결과가 낡은 상태로 남았다. G18은 `context-review.md`가 `accepted`인지만 봤기 때문에 낡은 리뷰도 통과했다. verification task scaffold가 commit task의 백틱 경로 표를 물려받아 G20 오탐을 내는 문제도 이 순환을 키웠다.

이 blueprint는 세 지점을 막는다. verification task는 경로 없는 Touch로 태어나고, `review-dispatch plan`은 reviewer를 부르기 전에 status와 무관한 plan 검사를 돌리며, G18은 마지막 round digest를 현재 계획 본문과 대조한다.

## Intuition
리뷰 도장에 문서 지문을 함께 찍어 두고, 문서가 바뀌면 도장이 무효가 되게 한다. 도장을 찍기 전에는 gate가 거절할 문서를 먼저 걸러 낸다.

## Code
- `scripts/src/lib/templates.ts`, `scripts/src/lib/scaffold.ts` — `verification-tasks.md` 템플릿. Touch는 `Source 변경 경로 없음.` 한 줄이다. `scaffoldTask`는 verification이면 이 템플릿을 고른다.
- `scripts/src/lib/validate-gates.ts`
  - `checkVerificationTaskGraph` — G20 Touch 메시지 끝에 추출 후보를 붙인다.
  - `checkTaskScope`·`checkPlanDraft` — G5·G10–G12를 task 단위 함수로 뽑았다. plan gate와 draft 검사가 이 함수를 같이 쓴다.
  - `contextReviewFreshnessFailure` — 모든 task가 `draft`·`ready`일 때 G18이 마지막 round `target.digest`를 현재 digest와 대조한다.
- `scripts/src/lib/plan-snapshot.ts` — `computePlanSnapshot`을 review-dispatch에서 옮겼다. G18이 순환 import 없이 재사용한다.
- `scripts/src/lib/validate.ts`, `scripts/src/lib/review-dispatch.ts` — `validateBlueprint({ planDraft: true })`와 `plan draft validation failed` 실패 분기.
- `rules/gates.md`, `rules/cli.md`, `skills/bouncer-plan/SKILL.md`, `skills/bouncer-plan/references/context-review.md`, `references/context-review/index.md`, `references/spec-authoring/index.md` — draft 실패 복귀, G18 stale 복구, Touch 고정 문구, 재발 코드 규범.

drive 기록(coordinator ledger 기준):
- DAG는 계획 그대로다(001 → 002 → 003 → 004 → 005). drive 중 추가·분할·재정렬한 task나 edge는 없고, scope revision도 없다.
- 각 task의 실제 변경 경로는 승인된 `affected_paths`와 같다(002는 `affected_paths` 전체 11개 경로).
- provenance(모두 `bouncer-implementer` 구현, `bouncer-reviewer` 리뷰):
  - TASKS-001: worker `bouncer/078-001-001` `9972fadb` → integration `1cc426d7`
  - TASKS-002: `bouncer/078-001-002` `44ed142a` → `aa614b64`. discovery의 minor 테스트 공백 1건을 fix batch로 해소했다.
  - TASKS-003: `bouncer/078-001-003` `0bd521aa` → `baf55925`. 마지막 round 비문자열 digest 대조를 빠뜨린 major 1건을 fix batch로 해소했다. round 전체가 비문자열인 경우는 후속 planning 항목으로 미뤘다.
  - TASKS-004: `bouncer/078-001-004` `b9898a60` → `df6b87ac`
  - TASKS-005: integration `df6b87ac`에서 verification runner 성공 후 integrated

## Quiz
1. `review-dispatch plan`이 structural 검사는 통과했지만 G20이 나는 계획을 받으면 어떻게 되는가?
   - A) `ok: true`로 strategy를 반환하고 G20은 plan gate에서 처리한다
   - B) `ok: false`, `error: 'plan draft validation failed'`와 failures를 반환해 reviewer를 부르지 않는다
   - C) `ok: false`, `error: 'structural validation failed'`를 반환한다
2. context review가 끝난 뒤 task의 frontmatter `affected_paths`만 고치면 G18은?
   - A) 통과한다. digest는 frontmatter를 hash하지 않는다
   - B) stale로 실패한다. 문서 바이트가 바뀌었다
   - C) `freshness unavailable`로 실패한다
3. G18 digest 대조가 drive 중 repair가 task 문서를 추가해도 `current --set`을 막지 않는 이유는?
   - A) repair가 digest를 자동 갱신한다
   - B) coordinator가 plan gate를 건너뛴다
   - C) 대조는 모든 task가 `draft` 또는 `ready`일 때만 적용된다
4. `computePlanSnapshot`을 `plan-snapshot.ts`로 옮긴 이유는?
   - A) `validate-gates.ts`가 `review-dispatch.ts`를 import하면 순환이 생기기 때문이다
   - B) digest 알고리즘을 바꾸기 위해서다
   - C) CLI에 새 명령을 추가하기 위해서다

## 이해 상태
정답: 1B, 2A, 3C, 4A. 응답: 1B, 2A, 3C, 4A. 전부 맞음(4/4). disposition: all correct; proceed to remainder.

## Tasks

### Task 001

#### Goal & intent

`bouncer scaffold task --execution-kind verification`이 만든 `tasks.md`는 G10 필수 절을 모두 갖고, Touch가 고정 문구 `Source 변경 경로 없음.` 한 줄이어서 작성자가 Touch를 건드리지 않아도 G20이 나오지 않는다. 작성자가 Touch에 백틱 명령을 넣으면 G20 메시지가 경로로 잡힌 토큰을 보여 줘, validator 구현을 읽지 않고도 원인을 안다.

#### Current behavior

- `scaffoldTask`(`scripts/src/lib/scaffold.ts:197`)는 `executionKind`와 무관하게 `templateNameFor('tasks.md', scale)`로 commit 본문을 쓴다. 그 Touch 절은 백틱 경로 자리표시를 담은 6열 표다(`scripts/src/lib/templates.ts` `'tasks.md'`).
- `checkVerificationTaskGraph`(`scripts/src/lib/validate-gates.ts:273`)는 `extractPathCandidates(sections.touch)`가 비어 있지 않으면 `verification task Touch must not declare source changes`만 낸다. `extractPathCandidates`는 백틱 안 문자열을 모두 후보로 넣으므로 `` `npm run ci` ``가 후보 `npm run ci`가 된다.
- 재현: 임시 저장소에서 `scaffoldTask({ executionKind: 'verification', dependsOn: ['TASKS-001'], verify: 'node --test' })` 뒤 본문의 Touch 절에 백틱이 있음을 확인한다. `test/scaffold.test.js`의 `scaffoldTask explicitly creates a verification node without review or scope`가 현재 생성 경로를 덮는다.

#### Target behavior

- 성공: verification scaffold의 `tasks.md` 본문은 새 템플릿 `verification-tasks.md`에서 온다. 절은 `## Goal & intent`, `## Interface`, `## Touch`, `## Do not touch`, `## Checklist` 순서다. Touch·Interface·Do not touch는 TODO 자리표시 없이 고정 문구로 채워지고, Goal & intent와 Checklist만 TODO 자리표시를 둔다.
- 성공: Touch 절 본문(주석 제외)은 정확히 `Source 변경 경로 없음.`이다. 이 본문에 `extractPathCandidates`를 적용하면 `[]`다.
- 실패: verification Touch에서 후보가 나오면 G20 메시지는 `verification task Touch must not declare source changes: npm run ci`처럼 후보를 `, `로 이어 붙인다.
- 보존: commit task scaffold 본문, light commit 본문(`tasks-light.md`), `verification.md` 본문, G20의 `cannot precede commit task` 판정은 바이트 단위로 그대로다. light blueprint의 verification task도 같은 `verification-tasks.md`를 쓴다.

#### Interface

- 제공: `TEMPLATES['verification-tasks.md']` 본문과 그 주석이 `SCAFFOLD_COMMENT_BODIES`에 포함되는 것.
- 제공: G20 Touch 메시지 형식 `verification task Touch must not declare source changes: <candidate>[, <candidate>...]`.
- 거부: `scaffold task --execution-kind verification`에 새 CLI 플래그를 추가하지 않는다. 기존 입력 검증(`dependsOn` 비어 있음, verify argv 무효)은 이전과 같은 Error를 던진다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/templates.ts` | `TEMPLATES` | Modify | 문서 종류별 scaffold 본문 | `verification-tasks.md` 본문 추가 | verification 본문의 단일 출처 |
| `scripts/lib/templates.js` | `TEMPLATES` | Modify | 위 파일의 emit 산출물 | `npm run build` 재생성 | `check:emit`이 src와 대조 |
| `scripts/src/lib/scaffold.ts` | `scaffoldTask` | Modify | task 번들 생성 | verification이면 `verification-tasks.md`로 본문 선택 | 본문 선택 지점 |
| `scripts/lib/scaffold.js` | `scaffoldTask` | Modify | emit 산출물 | 재생성 | `check:emit` |
| `scripts/src/lib/validate-gates.ts` | `checkVerificationTaskGraph` | Modify | G20 판정 | Touch 메시지에 후보 목록 추가 | G20 메시지 생성 지점 |
| `scripts/lib/validate-gates.js` | `checkVerificationTaskGraph` | Modify | emit 산출물 | 재생성 | `check:emit` |
| `test/scaffold.test.js` | verification scaffold 테스트 | Modify | verification node 생성 검증 | 본문 절 순서·Touch 고정 문구·자리표시 위치·plan 검사 G20 부재·light 동일 본문 단언 추가 | 성공 경로 회귀 |
| `test/validate-gates.test.js` | G20 테스트 | Modify | G20 판정 검증 | 백틱 명령 Touch의 메시지 후보 단언 추가 | 실패 메시지 회귀 |

#### Constraints

- 새 템플릿 주석은 `SCAFFOLD_COMMENT_BODIES`가 자동으로 모으는 방식을 그대로 따른다(`lint:context-comments`가 scaffold 주석 잔존을 판정한다).
- 템플릿 본문과 G20 메시지의 고정 문구는 한국어·영어 표기를 위 Interface 그대로 쓴다.

### Task 002

#### Goal & intent

`bouncer review-dispatch plan`이 draft 상태 blueprint에서 plan gate의 status 무관 task 검사(G5·G10·G11·G12·G19·G20)를 돌리고, 하나라도 실패하면 `ok: false`로 reviewer 호출을 막는다. 작성자는 context review snapshot을 얼리기 전에 gate가 거절할 문서를 고친다. 같은 task에서 계획 snapshot digest 계산을 `plan-snapshot` 모듈로 옮겨 TASKS-003의 G18이 순환 import 없이 재사용하게 한다.

#### Current behavior

- `classifyPlanReview`(`scripts/src/lib/review-dispatch.ts:95`)는 `validateBlueprint({ repoRoot, blueprintDir })`를 gate 없이 호출해 structural(S) 검사만 본다. 실패면 `{ ok: false, error: 'structural validation failed', failures }`.
- G5·G10–G12는 `runCheckGate`(`scripts/src/lib/validate-gates.ts:537`)의 `gate === 'plan'` 분기 안 task 루프에 G3과 섞여 있고, G19·G20은 같은 분기 끝의 `checkTaskDependencyGraph`·`checkVerificationTaskGraph` 호출이다. G1·G2·G3은 `approved`/`ready` status를 요구하므로 draft 문서에 plan gate를 돌리면 항상 실패한다.
- `computePlanSnapshot`(`scripts/src/lib/review-dispatch.ts:316`)은 모듈 내부 함수다. `review-dispatch.ts`가 `validate.ts`를 import하므로 `validate-gates.ts`가 `review-dispatch.ts`를 import하면 순환이 생긴다.
- 재현: `test/review-dispatch.test.js`의 `writePlanTree` fixture에 Touch에 백틱 명령 `npm run ci` 한 줄을 둔 verification task를 추가해도 현재 `classifyPlanReview`는 `ok: true`와 strategy를 반환한다.

#### Target behavior

- 성공: draft 검사를 통과하면 `classifyPlanReview`의 반환값은 이전과 같다(`target`, `strategy`, `clusters`, `perspectives`, `reasons`).
- 실패: structural 실패가 있으면 기존대로 `error: 'structural validation failed'`. structural은 통과하고 draft 검사가 실패하면 `{ ok: false, error: 'plan draft validation failed', failures }`이고, failures는 plan gate와 같은 `{ code, message, file }` 항목이다. CLI는 기존 `ok: false` 처리 그대로 JSON과 exit code를 낸다.
- 성공: plan gate(`validate --gate plan`)의 판정 결과·순서·메시지는 분리 전과 같다.
- 보존: `classifyExecuteReview`, light blueprint의 `strategy: 'skip'` 경로, snapshot digest 값(같은 문서 → 같은 hex)은 그대로다. light blueprint도 draft 검사를 받되 G10 절은 light 세 절만 요구한다.

#### Interface

- 제공: `scripts/src/lib/plan-snapshot.ts` — `computePlanSnapshot({ repoRoot, blueprintDir }) → { ok: true, digest: string, documents: string[] } | { ok: false, error: string }`. 알고리즘은 현재 `review-dispatch.ts` 구현을 옮긴 것이다.
- 제공: `validate-gates.ts` 내부 함수(신규 추출 지점: task 하나의 status 무관 검사) — task 문서 하나에 G5·G10·G11·G12를 현재 순서대로 적용한다. plan gate 루프는 task마다 G3 다음에 이 함수를 호출해, 실패 순서가 분리 전과 같다(task1 G3 → task1 G5/G10/G11/G12 → task2 G3 → …). `tasksList`가 빈 경우 plan gate는 기존대로 G3·G5·G10을 넣고 반환한다.
- 제공: `validate-gates.ts`의 export `checkPlanDraft(docs, rels, failures, ctx)` — 같은 task 루프를 G3 없이 돌린 뒤 `checkTaskDependencyGraph`·`checkVerificationTaskGraph`(G19·G20)를 호출한다. 빈 `tasksList`면 G5·G10만 넣는다. G1·G2·G3·G18은 넣지 않는다. G10 절 목록은 plan gate와 같이 blueprint `scale`로 고른다.
- 제공: `validateBlueprint({ repoRoot, blueprintDir, planDraft: true })` — structural 검사와 S18 판정 결과에 실패가 있으면 draft 검사를 돌리지 않고 그 실패만 반환한다. 실패가 없을 때만 `checkPlanDraft`를 실행한다. `warnings`(task-split)는 plan gate와 같이 싣는다.
- 제공: `classifyPlanReview`는 `validateBlueprint({ planDraft: true })`를 한 번 호출한다. 실패가 있으면 failures에 `S`로 시작하는 code가 하나라도 있을 때 `error: 'structural validation failed'`, 아니면 `error: 'plan draft validation failed'`를 쓴다(위 규칙상 두 종류가 한 결과에 섞이지 않는다).
- 거부: `planDraft: true`와 `gate`를 함께 주면 `Error('planDraft cannot be combined with gate')`를 던진다. `bouncer validate --gate`의 허용 값은 늘리지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-snapshot.ts` | `computePlanSnapshot` | Create | 없음 | review-dispatch에서 옮긴 digest 계산 | G18이 순환 없이 재사용 |
| `scripts/lib/plan-snapshot.js` | `computePlanSnapshot` | Create | 없음 | emit 산출물 | `check:emit` |
| `scripts/src/lib/review-dispatch.ts` | `classifyPlanReview`, `computePlanSnapshot` | Modify | plan dispatch와 digest | `planDraft: true` 호출·실패 분기, snapshot은 새 모듈 import | draft 검증 진입점 |
| `scripts/lib/review-dispatch.js` | 같은 심볼 | Modify | emit 산출물 | 재생성 | `check:emit` |
| `scripts/src/lib/validate-gates.ts` | `runCheckGate`, `checkPlanDraft`, 신규 추출 지점: task 하나의 status 무관 검사 | Modify | plan gate 전체 판정 | task별 G5·G10–G12 함수 추출, `checkPlanDraft` export | 두 호출자가 한 구현 공유 |
| `scripts/lib/validate-gates.js` | 같은 심볼 | Modify | emit 산출물 | 재생성 | `check:emit` |
| `scripts/src/lib/validate.ts` | `validateBlueprint` | Modify | structural + gate 실행 | `planDraft` 선택 인자 | docs 로딩을 재사용할 유일한 입구 |
| `scripts/lib/validate.js` | `validateBlueprint` | Modify | emit 산출물 | 재생성 | `check:emit` |
| `test/review-dispatch.test.js` | `writeCommitTask`, `writeVerificationTask`, plan 테스트 | Modify | plan fixture | fixture Touch가 `affected_paths`를 정당화하고 verification 본문이 G10 절을 갖게 수정, draft 실패 테스트 추가 | 새 검사가 fixture를 판정 |
| `test/validate-gates.test.js` | `checkPlanDraft` 테스트 | Modify | plan gate 단위 검증 | draft 검사가 G1–G3·G18을 내지 않고 G19·G20을 내는지 단언 | 분리 경계 회귀 |
| `test/cli-validate.test.js` | `planDraft` 조합 테스트 | Modify | validate 진입 검증 | `planDraft`+`gate` Error 단언 | 거부 계약 |

#### Constraints

- plan gate의 기존 실패 코드·메시지·file 값과 순서를 바꾸지 않는다. 기존 `test/validate-gates.test.js` plan 테스트는 수정 없이 통과해야 한다.
- digest 알고리즘(문서 집합·순서·body만 hash)은 바꾸지 않는다. `test/review-dispatch.test.js`의 digest 기대값 계산 헬퍼가 그대로 통과해야 한다.
- `plan-snapshot.ts`는 `validate.ts`·`validate-gates.ts`·`review-dispatch.ts`를 import하지 않는다.

### Task 003

#### Goal & intent

plan gate G18이 마지막 context review round의 `target.digest`를 현재 계획 snapshot digest와 대조한다. 리뷰 뒤 epic·blueprint·tasks 본문이 바뀌었으면 G18 stale 실패로 재리뷰를 요구한다. 대조는 실행 전 blueprint(모든 task가 `draft` 또는 `ready`)에만 적용해, drive 중 repair가 task 문서를 추가해도 `current --set`이 막히지 않는다.

#### Current behavior

- G18(`scripts/src/lib/validate-gates.ts:590` 부근)은 `context-review.md`의 status가 `accepted`인지와 `collectFindingFailures`의 findings·rounds 형식만 본다. round의 `target.digest`는 비어 있지 않은지, perspective별 `target_digest`가 같은지만 검사한다(`scripts/src/lib/validate-sections.ts:382`).
- 현재 계획 문서 digest는 TASKS-002 이후 `scripts/src/lib/plan-snapshot.ts`의 `computePlanSnapshot`이 계산한다. frontmatter는 hash하지 않는다.
- plan gate는 `bouncer validate --gate plan`과 `bouncer current --set`(`scripts/src/lib/cli-current-command.ts:185`)이 호출한다. coordinator는 drive 중에도 `current --set`을 호출하고, repair(`scripts/src/lib/coordinator.ts:453` 부근)는 새 `tasks/<NNN>/tasks.md`를 만들어 snapshot 문서 집합을 바꾼다.
- 재현: rounds `target.digest`에 실제 snapshot digest를 적은 accepted context-review가 있는 fixture에서 tasks 본문 한 줄을 바꿔도 `validateBlueprint({ gate: 'plan' })`는 G18 없이 통과한다.

#### Target behavior

- 실패: 대조 조건을 모두 만족하고 마지막 round의 `target.digest`가 현재 digest와 다르면 G18 `context review is stale: last round digest <기록값> != current <현재값>; rerun context review`, file은 `context-review.md` 경로.
- 실패: 대조 조건을 만족하는데 snapshot 계산이 `ok: false`면 G18 `context review freshness unavailable: <error>`.
- 성공: digest가 같으면 G18 추가 실패가 없다. frontmatter만 바뀐 경우(status 전이, `affected_paths`, `scope_revision`)도 digest가 같으므로 통과한다.
- 보존(대조 생략): light blueprint, context-review가 없거나 accepted가 아닌 경우의 기존 G18 메시지, `rounds`가 없거나 빈 배열인 문서, task 하나라도 status가 `draft`·`ready` 밖인 blueprint, `target.digest`가 문자열인 round가 하나도 없는 문서(형식 오류는 기존 메시지가 이미 보고).
- 보존: `ctx.repoRoot`·`ctx.blueprintDir`가 없고 `deps.planSnapshot`도 없는 직접 `checkGate` 호출은 대조를 생략한다. `validateBlueprint`는 두 값을 항상 넘긴다.

#### Interface

- 제공: `GateDeps.planSnapshot?: (opts: { repoRoot?: string, blueprintDir?: string }) => { ok: true, digest: string, documents: string[] } | { ok: false, error: string }`. G18은 `ctx.repoRoot`·`ctx.blueprintDir`를 있는 그대로(없으면 `undefined`) 넘긴다. 주입이 없으면 기본 구현이 쓰이며, 이때는 두 값이 모두 문자열일 때만 `computePlanSnapshot`을 호출하고 아니면 대조를 생략한다. 주입된 함수는 ctx 값 유무와 상관없이 호출된다.
- 제공: 마지막 round = `round`가 양의 정수인 항목 중 최댓값. 그 항목의 `target.digest`를 기록값으로 쓴다.
- 거부: 기록 digest와 현재 digest가 다르면 plan gate는 `ok: false`다. 이 task는 digest 자동 갱신이나 round 추가를 하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `runCheckGate` G18 분기, `GateDeps` | Modify | context-review 형식 판정 | digest 대조와 `planSnapshot` 주입 지점 | G18 판정 소유 |
| `scripts/lib/validate-gates.js` | 같은 심볼 | Modify | emit 산출물 | 재생성 | `check:emit` |
| `test/validate-gates.test.js` | G18 테스트 | Modify | G18 단위 검증 | `deps.planSnapshot` 주입으로 stale·일치·생략 조건·계산 실패 단언 | 판정 분기 회귀 |
| `test/cli-validate.test.js` | plan gate 통합 테스트 | Modify | 실제 문서 트리 판정 | 실제 digest를 기록한 fixture에서 본문 변경 시 G18, frontmatter 변경 시 통과 단언 | digest 입력이 실제 파일인 경로 |

#### Constraints

- 기존 G18 메시지와 판정은 순서까지 유지하고, digest 실패는 그 뒤에 덧붙인다.
- `status` 조건 집합은 정확히 `draft`, `ready`다.

### Task 004

#### Goal & intent

TASKS-001–003이 바꾼 계약을 에이전트가 읽는 규칙·참조 문서에 반영한다. plan controller는 `review-dispatch plan`이 `plan draft validation failed`를 내면 reviewer를 부르지 않고 `/bouncer-plan` step 3 **Author**로 돌아간다. plan gate가 G18 stale을 내면 context review를 새 digest의 round 1로 다시 시작하고 재승인을 받는다. 같은 G/S 코드가 수정 뒤 재발하면 다음 수정 전에 validator 구현과 회귀 테스트를 확인한다.

#### Current behavior

- `rules/gates.md` `## Plan rules`는 G18을 "accepted `context-review.md` 필요", G20을 "Touch에 source 변경 금지"로만 적는다. 재발 코드 대응 규범과 stale 복구 절차는 없다.
- `rules/cli.md` `## Read-only discovery and Graphify`는 `review-dispatch` 실패를 "structural or input failure"로만 설명한다.
- `skills/bouncer-plan/references/context-review.md` step 2 Discovery는 `ok: false`면 멈추라고만 하고 어디로 돌아가는지 말하지 않는다. 이 문서의 step 3은 **Merge**이고, step 6 **Close**는 "no third round"라고 적는다.
- `skills/bouncer-plan/SKILL.md` step 8 **Gate**는 "Fix every reported failure and re-run until it passes"만 적는다. 본문을 고치면 digest가 바뀌어 G18 stale이 나지만 그 뒤 절차가 없다.
- `references/context-review/index.md` step 2 Contract의 rounds 설명은 G18이 digest를 현재 문서와 대조한다는 사실을 적지 않는다.
- `references/spec-authoring/index.md`의 `execution_kind` 항목(한국어, 75행 부근)은 verification Touch 고정 문구를 언급하지 않는다.
- 문서 테스트: `test/skill-context-review.test.js`는 `readSkill('context-review')`(`references/context-review/index.md`)와 `planContextReviewPath`(`skills/bouncer-plan/references/context-review.md`)를 읽는다. `/authoring/`는 두 문서 모두에서 이미 매칭된다. `test/skill-bouncer-plan.test.js`는 SKILL.md step 5 구간을 자른다. `test/master-rules.test.js`의 `read(rel)` 헬퍼로 rules 문서를 읽을 수 있고, 지금 `rules/gates.md`·`rules/cli.md` 문구를 단언하는 테스트는 없다.

#### Target behavior

각 항목은 추가할 의미를 적은 것이다. 문구는 그 문서의 기존 언어로 쓴다(`rules/*`·`skills/**`·`references/context-review` 영어, `references/spec-authoring`의 `execution_kind` 항목 한국어).
- `rules/gates.md`:
  - G18 항목에 두 가지를 덧붙인다. 하나는 실행 전 blueprint에서 마지막 round digest가 현재 계획 snapshot과 다르면 `context review is stale`로 실패한다는 것이다. 다른 하나는 복구 절차다: `rounds[]`·`findings[]`를 새 digest의 round 1 discovery로 교체하고 status를 `pending`으로 되돌린 뒤 `/bouncer-plan` step 5와 step 6 재승인을 다시 거친다.
  - G20 항목에 scaffold가 쓴 verification Touch 고정 문구 `Source 변경 경로 없음.`을 유지하고, 명령은 frontmatter `verify`에만 둔다는 것을 덧붙인다.
  - 문서 머리 gate protocol 단락 뒤에 `## Recurring failure codes` 절을 두고, 같은 G/S 코드가 수정 뒤 다시 나오면 다음 수정 전에 그 코드를 내는 validator 구현과 회귀 테스트를 읽는다는 규범을 적는다.
- `rules/cli.md`: plan dispatch가 structural 실패 외에 `plan draft validation failed`(G5·G10–G12·G19·G20)로 `{ ok: false }`를 낼 수 있다고 적는다.
- `skills/bouncer-plan/references/context-review.md`:
  - step 2 Discovery: `plan draft validation failed`면 failures를 사용자에게 보이고 `/bouncer-plan` step 3 **Author**로 돌아가며, 고친 뒤 step 1 freeze부터 다시 한다.
  - step 6 뒤: G18 stale 복구는 세 번째 round가 아니라 새 round 1 discovery로 기록을 교체하는 것이라고 적는다.
- `skills/bouncer-plan/SKILL.md` step 8 **Gate**: G18 `context review is stale`이면 이 루프에서 고치지 말고 step 5로 돌아가 reference의 stale 복구를 따르고, step 6 재승인 뒤 step 7·8을 다시 실행한다.
- `references/context-review/index.md` step 2 Contract: plan gate G18이 실행 전 blueprint에서 마지막 round `target.digest`를 현재 snapshot과 대조한다고 적는다.
- `references/spec-authoring/index.md` `execution_kind` 항목: scaffold가 쓴 Touch 고정 문구 `Source 변경 경로 없음.`을 바꾸지 않고, 검증 명령은 frontmatter `verify`에만 둔다.
- 보존: 기존 문서 테스트가 단언하는 문구(snapshot 순서, `review-dispatch plan`, perspective 이름, step 5 구간)는 그대로 남는다. `npm run lint:docs`가 통과한다.

#### Interface

- 제공: 위 일곱 문서의 문구. 새 명령·플래그·gate 값은 없다.
- 거부: G18 stale이나 draft 실패를 우회하는 절차(digest 수동 수정, 이전 round 복사, 세 번째 round 추가)를 문서에 넣지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/gates.md` | `## Plan rules`, 신규 `## Recurring failure codes` | Modify | gate 판정 안내 | G18 신선도·복구, G20 문구, 재발 코드 규범 | gate 규칙 소유 문서 |
| `rules/cli.md` | `review-dispatch` 결과 단락 | Modify | CLI 결과 처리 안내 | draft 실패 결과 추가 | CLI 결과 소유 문서 |
| `skills/bouncer-plan/references/context-review.md` | step 2 Discovery, step 6 Close | Modify | plan context review 절차 | draft 실패 복귀, stale 복구 | 실패 후 행동 지점 |
| `skills/bouncer-plan/SKILL.md` | step 8 Gate | Modify | plan gate 실행·수정 루프 | G18 stale 분기 | stale이 처음 보고되는 지점 |
| `references/context-review/index.md` | step 2 Contract | Modify | context review 행동 계약 | G18 digest 대조 서술 | round 기록 계약 소유 |
| `references/spec-authoring/index.md` | `execution_kind` 항목 | Modify | tasks 작성 규칙 | Touch 고정 문구 유지 | 작성 단계 예방 |
| `test/skill-context-review.test.js` | 문서 테스트 | Modify | 절차 문구 단언 | draft 실패 복귀·stale 복구·digest 대조 단언 | 문서 계약 회귀 |
| `test/skill-bouncer-plan.test.js` | 문서 테스트 | Modify | SKILL.md 단계 단언 | step 8 stale 분기 단언 | 문서 계약 회귀 |
| `test/skill-spec-authoring.test.js` | 문서 테스트 | Modify | 작성 규칙 단언 | Touch 고정 문구 단언 | 문서 계약 회귀 |
| `test/master-rules.test.js` | 신규 rules 문구 테스트 | Modify | master/product rule 단언 | `rules/gates.md`·`rules/cli.md` 문구 단언 | rules 문서를 읽는 기존 헬퍼 |

#### Constraints

- 각 문서는 현재 언어를 유지한다. Target behavior의 서술은 의미이고 붙여 넣을 문구가 아니다. 바이트 단위 인용은 `Source 변경 경로 없음.`, `plan draft validation failed`, `context review is stale` 세 문자열에만 적용한다.
- 각 문서에 추가하는 분량은 해당 절의 기존 항목 길이 수준(1–4줄)으로 둔다. `## Recurring failure codes` 절도 4줄 이내다.

### Task 005

#### Goal & intent

TASKS-001–004가 통합된 HEAD에서 frontmatter `verify` 명령으로 전체 CI 증적을 남긴다. 이 node는 source를 바꾸지 않고 commit·review를 만들지 않는다.

#### Interface

- 제공: 통합 HEAD의 종단 CI evidence.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
