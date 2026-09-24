---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/001-pointer-independent-parallel-run/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-24T14:27:31.169+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '078'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 3e997186746b434d48649dffddfa67c9500be097
      diff_sha: 5aacc07b68f15c4b517aba583b67def62a501f424afb6630db120c4cab36ba1e
      quiz_score: 5/5
      disposition: 전 문항 정답. lease·readyWave·CAS fan-in·repair DAG를 이해한 상태로 마감.
      recorded_at: '2026-09-24T14:29:54+09:00'
  task_commits:
    - task: EPIC-078/BP-001/TASK-001
      sha: 68d8bb29
      intent_anchor: task-001
    - task: EPIC-078/BP-001/TASK-002
      sha: 75feab4c
      intent_anchor: task-002
    - task: EPIC-078/BP-001/TASK-003
      sha: ee585c3c
      intent_anchor: task-003
    - task: EPIC-078/BP-001/TASK-004
      sha: 3e1aa78e
      intent_anchor: task-004
    - task: EPIC-078/BP-001/TASK-005
      sha: a3338109
      intent_anchor: task-005
    - task: EPIC-078/BP-001/TASK-007
      sha: 508db17d
      intent_anchor: task-007
  coordinator:
    base: 45735ae1422e9acbf27b8a4ff71c007c04dfc487
    integration_head: 3e997186746b434d48649dffddfa67c9500be097
    integration_branch: feat/078-001-pointer-independent-parallel-run
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/003
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/004
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/005
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/001/workers/007
    tasks:
      - id: '001'
        status: integrated
        sha: 68d8bb29f8a361beecf9d5fcbcc4b5300a2e4b55
        branch: bouncer/078-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/commit.js
          - scripts/lib/config.js
          - scripts/lib/coordinator.js
          - scripts/lib/current.js
          - scripts/lib/run-preflight.js
          - scripts/lib/schema.js
          - scripts/lib/validate-structural.js
          - scripts/src/lib/commit.ts
          - scripts/src/lib/config.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/current.ts
          - scripts/src/lib/run-preflight.ts
          - scripts/src/lib/schema.ts
          - scripts/src/lib/validate-structural.ts
          - test/commit-task.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/validate-structural.test.js
      - id: '002'
        status: integrated
        sha: 75feab4ca62f73d648a4930855745417568bf57c
        branch: bouncer/078-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/lease.js
          - scripts/lib/runtime-state.js
          - scripts/lib/scope.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/lease.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/scope.ts
          - test/cli-commit.test.js
          - test/cli-coordinate.test.js
          - test/cli-current.test.js
          - test/cli-help.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/runtime-state.test.js
      - id: '003'
        status: integrated
        sha: ee585c3c2df792276f3b0774b4ff07a834721890
        branch: bouncer/078-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/commit-hook.js
          - scripts/lib/current.js
          - scripts/lib/execute-prepare.js
          - scripts/lib/validate-docs.js
          - scripts/lib/verification.js
          - scripts/src/lib/commit-hook.ts
          - scripts/src/lib/current.ts
          - scripts/src/lib/execute-prepare.ts
          - scripts/src/lib/validate-docs.ts
          - scripts/src/lib/verification.ts
          - test/cli-current.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/current.test.js
          - test/execute-prepare.test.js
          - test/verification-runner.test.js
      - id: '004'
        status: integrated
        sha: 3e1aa78ee1ca954a46cd6563dfe1e523fa8b68c7
        branch: bouncer/078-001-004
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/lib/verification.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/verification.ts
          - test/cli-coordinate.test.js
          - test/cli-help.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/native-profile-e2e.test.js
          - test/runtime-state.test.js
          - test/verification-runner.test.js
      - id: '005'
        status: integrated
        sha: a33381099c52d3507a884f94cce96f9be2de4f48
        branch: bouncer/078-001-005
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/configuration.md
          - references/spec-authoring/index.md
          - rules/current-pointer.md
          - rules/document-schema.md
          - rules/planning.md
          - skills/bouncer-commit/SKILL.md
          - test/agents.test.js
          - test/coordinator-e2e.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-commit.test.js
      - id: '006'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '007'
        status: integrated
        sha: 508db17d0d3cc5dd7f77494e0ba473760c286a0d
        branch: bouncer/078-001-007
        scope_revision: r1
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 7b4dc73828160ce3173307e1a1e73f3df45f4bfd56579b8c91e0f72b5188c167
        base_head: 45735ae1422e9acbf27b8a4ff71c007c04dfc487
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 7b4dc73828160ce3173307e1a1e73f3df45f4bfd56579b8c91e0f72b5188c167
        outcome: rework
        summary: 'rework: review round 1 must_fix RD-001 (major correctness_tests) - pathsOverlap on raw strings misses trailing-slash dirs (src/ vs src/a.ts) and ./ prefixes; Checklist ancestor case fails; test used slash-free src. RD-002..RD-005 advisory accepted. verify npm test exit 0 evidence 377ba9e1.'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: a95d40fafadcdbf08dffe35748a06ccbd766297c84dd62f4029ae6aabb4ddfa3
        base_head: 45735ae1422e9acbf27b8a4ff71c007c04dfc487
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/commit.js
          M  scripts/lib/config.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/current.js
          M  scripts/lib/run-preflight.js
          M  scripts/lib/schema.js
          M  scripts/lib/validate-structural.js
          M  scripts/src/lib/commit.ts
          M  scripts/src/lib/config.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/current.ts
          M  scripts/src/lib/run-preflight.ts
          M  scripts/src/lib/schema.ts
          M  scripts/src/lib/validate-structural.ts
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/validate-structural.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: a95d40fafadcdbf08dffe35748a06ccbd766297c84dd62f4029ae6aabb4ddfa3
        outcome: accepted
        summary: 'bouncer-implementer attempt 2 fix batch: normalizeOverlapPath before pathsOverlap for trailing-slash and ./ forms; Checklist ancestor + ./ regressions; verify npm test exit 0 evidence 5b0a067d; delta certification resolved RD-001, no new findings; review accepted (RD-002..005 advisory accepted).'
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: eb93a3d303ee8a67dc91fc0ca5b743651f5a59645655b240ec59240c2105cd28
        base_head: 68d8bb29f8a361beecf9d5fcbcc4b5300a2e4b55
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: eb93a3d303ee8a67dc91fc0ca5b743651f5a59645655b240ec59240c2105cd28
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 2 (status ready->verified, commit_sha 68d8bb29 stamp); brief authority sections byte-identical; attempt 2 accepted result carried forward'
      - task: '001'
        decision: 'accepted TASKS-001 at 68d8bb29 (branch bouncer/078-001-001; implementer bouncer-implementer attempts 1 and 2; reviewers bouncer-reviewer spec_scope+correctness_tests+minimality_maintainability+security discovery, delta certification; RD-001 major resolved, RD-002..RD-005 advisory accepted; verify npm test exit 0 evidence 5b0a067d). changed paths: scripts/lib/commit.js, scripts/lib/config.js, scripts/lib/coordinator.js, scripts/lib/current.js, scripts/lib/run-preflight.js, scripts/lib/schema.js, scripts/lib/validate-structural.js, scripts/src/lib/commit.ts, scripts/src/lib/config.ts, scripts/src/lib/coordinator.ts, scripts/src/lib/current.ts, scripts/src/lib/run-preflight.ts, scripts/src/lib/schema.ts, scripts/src/lib/validate-structural.ts, test/commit-task.test.js, test/coordinator-e2e.test.js, test/coordinator.test.js, test/current.test.js, test/validate-structural.test.js. remediations: (1) seeded epic index.md and context index.md from integration into worker for S8/S13; (2) attempt 3 re-baseline after controller frontmatter edits.'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: dd9015395fcd5662c30739995a563f1287336f86fea2be95dbdd78debc26fe93
        base_head: 2fd01600544e4e32c702b7c0a8248830f5d8aeda
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: dd9015395fcd5662c30739995a563f1287336f86fea2be95dbdd78debc26fe93
        outcome: rework
        summary: 'rework: review round 1 must_fix RD-001 legacy revoke requeue skips worktree rebuild; RD-002 lease-invalid missing on revise/bootstrap; RD-003 lease-required test missing; RD-004 integrate stale-lease test missing. RD-005/006 advisory accepted. verify npm test exit 0 evidence 41356b0e.'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 32f5751f06bee3b9aa4ebc1d58fe8864a5180405346836bdd301cf881b29e683
        base_head: 2fd01600544e4e32c702b7c0a8248830f5d8aeda
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          A  scripts/lib/lease.js
          M  scripts/lib/runtime-state.js
          M  scripts/lib/scope.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          A  scripts/src/lib/lease.ts
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/scope.ts
          M  test/cli-commit.test.js
          M  test/cli-coordinate.test.js
          M  test/cli-current.test.js
          M  test/cli-help.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/finalize.test.js
          M  test/runtime-state.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 32f5751f06bee3b9aa4ebc1d58fe8864a5180405346836bdd301cf881b29e683
        outcome: accepted
        summary: 'bouncer-implementer attempt 2 fix batch: legacy revoke requeue rebuild, lease-invalid on bootstrap/revise, lease-required+integrate stale-lease tests; verify npm test exit 0 evidence dde177db; delta resolved RD-001..004; review accepted.'
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: 32f93081b0809c5f1a3d9fc3573f460501bca8997fe3367b8564427e3430d0e4
        base_head: 75feab4ca62f73d648a4930855745417568bf57c
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: 32f93081b0809c5f1a3d9fc3573f460501bca8997fe3367b8564427e3430d0e4
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report after controller tasks.md frontmatter (verified + commit_sha 75feab4c); attempt 2 accepted result carried forward'
      - task: '002'
        decision: 'accepted TASKS-002 at 75feab4c (branch bouncer/078-001-002; implementer attempts 1-2; reviewers discovery+delta; RD-001..004 resolved, RD-005/006 advisory accepted; verify evidence dde177db). changed paths: scripts/lib/cli-git-commands.js, scripts/lib/coordinator.js, scripts/lib/lease.js, scripts/lib/runtime-state.js, scripts/lib/scope.js, scripts/src/lib/cli-git-commands.ts, scripts/src/lib/coordinator.ts, scripts/src/lib/lease.ts, scripts/src/lib/runtime-state.ts, scripts/src/lib/scope.ts, test/cli-commit.test.js, test/cli-coordinate.test.js, test/cli-current.test.js, test/cli-help.test.js, test/cli-validate.test.js, test/commit-hook.test.js, test/commit-task.test.js, test/coordinator-e2e.test.js, test/coordinator.test.js, test/current.test.js, test/finalize.test.js, test/runtime-state.test.js.'
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: c3d24c0992c4a9b0df0c70d0106c7bb47cf9c3f5f63f3bc680adfc2f17a26e8a
        base_head: 4d292500152a72babb6f1b6c1302ffbe0ecfbe27
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: c3d24c0992c4a9b0df0c70d0106c7bb47cf9c3f5f63f3bc680adfc2f17a26e8a
        outcome: rework
        summary: 'rework: RD-001 evaluateCommit early-return skips fail-closed without pointer; RD-002 weak cli-validate lease assertion. verify evidence 0d2b4aee.'
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: 05cf11389fed7aa3adcbfd7af8b2e356e1d05a4733a149135192470c9d624854
        base_head: 4d292500152a72babb6f1b6c1302ffbe0ecfbe27
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/commit-hook.js
          M  scripts/lib/current.js
          M  scripts/lib/execute-prepare.js
          M  scripts/lib/validate-docs.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/commit-hook.ts
          M  scripts/src/lib/current.ts
          M  scripts/src/lib/execute-prepare.ts
          M  scripts/src/lib/validate-docs.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-current.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/current.test.js
          M  test/execute-prepare.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: 05cf11389fed7aa3adcbfd7af8b2e356e1d05a4733a149135192470c9d624854
        outcome: accepted
        summary: 'attempt 2 fix: evaluateCommit lease-first without pointer; strengthened cli-validate lease assert; verify 9ba4b5dd; delta resolved RD-001/002; review accepted.'
      - task: '003'
        kind: dispatch
        attempt: 3
        task_brief_hash: c4ab80760dcb6b10d2c955f484297feceac336c583d5220a415faa29451b2262
        base_head: ee585c3c2df792276f3b0774b4ff07a834721890
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '003'
        kind: report
        attempt: 3
        task_brief_hash: c4ab80760dcb6b10d2c955f484297feceac336c583d5220a415faa29451b2262
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp; attempt 2 accepted carried forward
      - task: '003'
        decision: accepted TASKS-003 at ee585c3c (branch bouncer/078-001-003; implementer attempts 1-2; delta resolved RD-001/002; verify 9ba4b5dd). changed paths from commit staged set.
      - task: '004'
        kind: dispatch
        attempt: 1
        task_brief_hash: a8bf111b3f7329dfa31e6f011db47df1bf1641f1ece388e8d02512ef9299c288
        base_head: ee585c3c2df792276f3b0774b4ff07a834721890
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '004'
        kind: report
        attempt: 1
        task_brief_hash: a8bf111b3f7329dfa31e6f011db47df1bf1641f1ece388e8d02512ef9299c288
        outcome: rework
        summary: 'rework: RD-001 classify cherry-pick conflicts only for fanin-conflict revoke; RD-002 reject non-ddd taskId with VERIFY_IDENTITY_INVALID. RD-003..006 advisory accepted. verify d9526407.'
      - task: '004'
        kind: dispatch
        attempt: 2
        task_brief_hash: 21790b6da9822e58f2ce81202eab67b81fe9f84bd55cdd7e5ad3d0ba076ba2b6
        base_head: ee585c3c2df792276f3b0774b4ff07a834721890
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/runtime-state.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-coordinate.test.js
          M  test/cli-help.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/native-profile-e2e.test.js
          M  test/runtime-state.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '004'
        kind: report
        attempt: 2
        task_brief_hash: 21790b6da9822e58f2ce81202eab67b81fe9f84bd55cdd7e5ad3d0ba076ba2b6
        outcome: accepted
        summary: 'attempt 2: conflict-only fanin-conflict; taskId format reject; verify 477334dc08c4dff282c1fe5fefadbd270a25a0f8ed1eb2234f7d378836999e18; delta RD-001/002 resolved; review accepted.'
      - task: '004'
        kind: dispatch
        attempt: 3
        task_brief_hash: 7d3a6073043b36c59cce0a50998acc53ac9eddba88a61e938455c2b2f6890dd6
        base_head: 3e1aa78ee1ca954a46cd6563dfe1e523fa8b68c7
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '004'
        kind: report
        attempt: 3
        task_brief_hash: 7d3a6073043b36c59cce0a50998acc53ac9eddba88a61e938455c2b2f6890dd6
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp
      - task: '004'
        decision: accepted TASKS-004 at 3e1aa78e; fan-in candidate CAS; RD-001/002 resolved
      - task: '005'
        kind: dispatch
        attempt: 1
        task_brief_hash: 0caec123cfe930eb1d4a3db8812c46a2a292b0af0dc2fac3b40147a79b3a59dd
        base_head: a22d5f19913fa91f0bd6ee68188dabcd9b78ed49
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '005'
        kind: report
        attempt: 1
        task_brief_hash: 0caec123cfe930eb1d4a3db8812c46a2a292b0af0dc2fac3b40147a79b3a59dd
        outcome: accepted
        summary: 'attempt 1: docs lease parallel + parallel drive e2e; verify fd4c38d9; review accepted (RD-001 nit advisory).'
      - task: '005'
        kind: dispatch
        attempt: 2
        task_brief_hash: a0100c4ec9852ed263c00468d4230f3a329bd283bc50c4d77b1348ea0dfd7489
        base_head: a22d5f19913fa91f0bd6ee68188dabcd9b78ed49
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  .codex/agents/bouncer-coordinator.toml
          M  agents/bouncer-coordinator.md
          M  docs/configuration.md
           M package-lock.json
          M  references/spec-authoring/index.md
          M  rules/current-pointer.md
          M  rules/document-schema.md
          M  rules/planning.md
          M  skills/bouncer-commit/SKILL.md
          M  test/agents.test.js
          M  test/coordinator-e2e.test.js
          M  test/master-rules.test.js
          M  test/skill-bouncer-commit.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '005'
        kind: report
        attempt: 2
        task_brief_hash: a0100c4ec9852ed263c00468d4230f3a329bd283bc50c4d77b1348ea0dfd7489
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp
      - task: '005'
        decision: accepted TASKS-005 at a22d5f19; docs+e2e parallel drive
      - task: '005'
        kind: rerecord
        reason: rerecord after premature record of base HEAD; actual commit a3338109 now on worker (package-lock restored, commit succeeded)
        previousSha: a22d5f19913fa91f0bd6ee68188dabcd9b78ed49
        nextSha: a33381099c52d3507a884f94cce96f9be2de4f48
        integrationHead: a22d5f19913fa91f0bd6ee68188dabcd9b78ed49
      - task: '007'
        kind: repair
        wave: 1
        reason: 'Repair wave 1: fix eslint indent corruption and unused vars/max-len introduced by fan-in integrateCommitWave so npm run ci can pass; stays inside Blueprint lint quality gate, no product decision.'
        failure:
          task: '006'
          command: npm run ci
          summary: eslint indent/max-len/unused-vars in coordinator.ts and max-len in cli-git-commands.ts after TASKS-004 fan-in; 447 lint errors block terminal CI
          paths:
            - scripts/src/lib/coordinator.ts
            - scripts/lib/coordinator.js
            - scripts/src/lib/cli-git-commands.ts
            - scripts/lib/cli-git-commands.js
          exitCode: 1
          repairWave: 0
        previousDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '003'
          - id: '005'
            depends_on:
              - '004'
          - id: '006'
            depends_on:
              - '005'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '003'
          - id: '005'
            depends_on:
              - '004'
          - id: '006'
            depends_on:
              - '007'
          - id: '007'
            depends_on:
              - '005'
        previousScope: []
        nextScope:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r1
      - task: '007'
        kind: dispatch
        attempt: 1
        task_brief_hash: 6ed18672fdb4942f297d484c395129440a2fec10ddcc33f8d845e4342c9d5aa7
        base_head: 01f4613db9c57d7e1e6633a48778d3aa73651f20
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '007'
        kind: report
        attempt: 1
        task_brief_hash: 6ed18672fdb4942f297d484c395129440a2fec10ddcc33f8d845e4342c9d5aa7
        outcome: accepted
        summary: 'repair wave 1: eslint indent/unused/max-len fixed in coordinator.ts and cli-git-commands.ts; npm test green.'
      - task: '007'
        kind: dispatch
        attempt: 2
        task_brief_hash: 9cde94ce07b983cf28cbf6b180d8c6fc4d62d94d312678d5834272bd2fab9b35
        base_head: 508db17d0d3cc5dd7f77494e0ba473760c286a0d
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/
      - task: '007'
        kind: report
        attempt: 2
        task_brief_hash: 9cde94ce07b983cf28cbf6b180d8c6fc4d62d94d312678d5834272bd2fab9b35
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp
      - task: '007'
        decision: accepted TASKS-007 repair wave 1 at 508db17d; eslint indent/unused/max-len fixed
---
# Explain

## Background

공유 pointer를 task마다 옮기면 한 번에 하나의 task만 돌릴 수 있다. 이 Blueprint는 coordinator가 lease·generation으로 task를 식별하고, 경로·자원이 겹치지 않는 ready wave만 설정 한도 안에서 동시에 돌리게 한다. Fan-in은 임시 candidate에서 검증한 뒤 CAS·fast-forward로만 canonical integration에 반영한다.

Drive 기록(ledger): 계획 DAG는 `001→002→003→004→005→006`이었다. 실행 중 006의 `npm run ci`가 eslint로 실패해 repair wave 1이 `007`을 추가했고, 최종 DAG는 `001→…→005→007→006`이다(`006.depends_on = [007]`, revision `r1`). 001–005는 `parallel_safe: false`라 이번 drive는 직렬로 돌렸고, 병렬 기계(lease·readyWave·CAS fan-in)는 코드·문서·e2e로 들어갔다. Integration head는 `3e997186`.

## Intuition

공항 게이트 하나(공유 pointer) 대신 탑승권(lease)을 나눠 주고, 활주로(integration)에는 검사 통과한 편대(wave candidate)만 한 번에 붙인다.

## Code

핵심 경로:

- `scripts/src/lib/coordinator.ts` — `normalizeOverlapPath` / `readyWave` / `integrateCommitWave`
- `scripts/src/lib/lease.ts` — `issueLease` / `revokeLease` (generation)
- `scripts/src/lib/current.ts` — `resolveEffectiveTask` (worker lease → effective task)
- `scripts/src/lib/verification.ts` — candidate 검증·fan-in 연동
- `agents/bouncer-coordinator.md`, `rules/current-pointer.md` — lease 기반 병렬 dispatch 안내
- `test/coordinator-e2e.test.js`, `test/coordinator.test.js` — 병렬 drive·스케줄러 회귀

Provenance (worker → integration):

| Task | Branch | Commit | Agent |
|------|--------|--------|-------|
| 001 | `bouncer/078-001-001` | `68d8bb29` | implementer (+ rework RD-001 path normalize) |
| 002 | `bouncer/078-001-002` | `75feab4c` | implementer (+ lease rework) |
| 003 | `bouncer/078-001-003` | `ee585c3c` | implementer |
| 004 | `bouncer/078-001-004` | `3e1aa78e` | implementer |
| 005 | `bouncer/078-001-005` | `a3338109` | implementer (`rerecord` after premature record) |
| 007 | `bouncer/078-001-007` | `508db17d` | repair wave 1 (eslint) |
| 006 | (verification) | evidence after CI pass | coordinator runner |

`007`만 `scope_revision: r1` (coordinator.ts / cli-git-commands.ts lint). 001–005는 plan `affected_paths` 안에서 rework했고 별도 scope 개정은 없다.

## Quiz

**Q1.** `readyWave`가 in-flight task와 새 후보를 겹친다고 판정할 때, trailing slash·`./` prefix를 어떻게 다루는가?

- A) `normalizeOverlapPath`로 정규화한 뒤 조상·경로 겹침을 본다
- B) raw 문자열 그대로 `===` 비교한다
- C) exclusive_resources만 보고 경로는 무시한다

**Q2.** revoke된 lease의 늦은 report가 현재 상태를 바꾸지 못하게 하는 장치는?

- A) 공유 pointer의 task id만 다시 읽는다
- B) lease id와 generation을 대조해 stale event를 거절한다
- C) 원장 파일을 삭제하고 bootstrap부터 다시 한다

**Q3.** worker worktree에서 verify·commit·hook이 “지금 이 task”를 고르는 기준은?

- A) 항상 Git common directory의 공유 pointer `current.task`
- B) integration branch의 최신 commit message
- C) worker cwd와 원장의 lease로 잡는 `resolveEffectiveTask`

**Q4.** `integrateCommitWave`가 canonical integration을 갱신하는 안전한 순서에 가장 가까운 것은?

- A) 임시 candidate에서 cherry-pick·검증 후 CAS 확인과 fast-forward만 한다
- B) worker 브랜치를 바로 integration에 merge한다
- C) main checkout에 직접 checkout해서 commit한다

**Q5.** 이번 drive에서 최종 DAG가 계획과 달라진 직접 이유는?

- A) 005가 parallel_safe라 006 앞에 끼어들었다
- B) pointer가 006을 건너뛰어 007만 남겼다
- C) 006 `npm run ci` 실패 → repair wave `007` 추가, `006`이 `007`에 의존
## 이해 상태

응답: A B C A C · 정답: A B C A C · 결과: 5/5 전부 정답.
disposition: 전 문항 정답. lease·readyWave·CAS fan-in·repair DAG를 이해한 상태로 마감.
`quiz_score: 5/5` · `range_from: develop` → `range_to: 3e997186…` · `diff_sha: 5aacc07b…`

## Tasks

### Task 001

#### Goal & intent

coordinator의 ready wave가 설정 한도(`coordinator.max_parallel`, 기본 2) 안에서, 이미 실행 중인 task와 경로·`exclusive_resources`가 겹치지 않는 `parallel_safe` task만 고르게 한다.
완료 조건: 준비 가능한 task가 세 개여도 in-flight task는 두 개를 넘지 않고, `src/`와 `src/a.ts`처럼 조상 관계 경로나 같은 자원을 가진 task는 같은 시점에 in-flight 상태가 되지 않는다.

#### Current behavior

- `scripts/src/lib/coordinator.ts:125` `readyWave(tasks)`는 `pending`이면서 선행 task가 모두 `integrated`인 task를 ID순으로 모은다. 그중 `parallel_safe === false`가 하나라도 있으면 그 하나만, 아니면 전부 반환한다. 동시 실행 상한도, 경로·자원 충돌 검사도, 이미 in-flight인 task(`prepared`·`recorded`·`ready`·`verifying`) 고려도 없다.
- `taskList`(`coordinator.ts:549`)는 bootstrap 때 task 문서에서 `depends_on`·`dependency_gate`·`parallel_safe`·`execution_kind`만 원장에 옮긴다. `affected_paths`와 `exclusive_resources`는 원장에 없다.
- `readyWave` 호출처: `coordinator.ts` 315·836·943·1346·1378행, `current.ts:512` `coordinatorSnapshot`, `commit.ts:140,177`, `run-preflight.ts:264`. 모두 인자 하나로 부른다.
- 설정: `config.ts`에는 `coordinator` 키를 읽는 함수가 없다.
- S28(`validate-structural.ts:210-223`)은 `depends_on`·`parallel_safe`·`dependency_gate` shape만 검사한다. `exclusive_resources`는 알 수 없는 필드로 무시된다.
- 재현: `node --test test/coordinator.test.js` — 59·68행 readyWave 테스트가 현재 동작을 고정한다.

#### Target behavior

- 성공 경로:
  - `readyWave(tasks, { maxParallel })`는 먼저 in-flight 집합 `F`(commit task의 `prepared`·`recorded`, verification task의 `ready`·`verifying`)를 구한다.
  - `F`에 `parallel_safe !== true` task가 있으면 `[]`를 반환한다.
  - 후보(`pending` + 선행 충족, ID순)에 `parallel_safe !== true` task가 있으면, `F`가 비었을 때만 그 첫 task 하나를 반환하고 아니면 `[]`를 반환한다.
  - 그 밖에는 ID순으로 `maxParallel - |F|`개까지, `F`와 이미 고른 task에 모두 충돌하지 않는 후보만 고른다.
- 충돌 정의: 두 task의 경로 집합(`scope.paths`가 있으면 그것, 없으면 `affected_paths`) 중 한 쌍이라도 `pathsOverlap`이 참이거나, `exclusive_resources`에 공통 항목이 있으면 충돌이다. 두 경로 필드가 모두 없는 legacy 원장 task는 모든 task와 충돌한다.
- `coordinate prepare`·`status`·`integrate`·`bootstrap` 응답의 `ready`와 `bouncer current`의 `coordinator.ready`, `commit` 안내, `run preflight`의 `readyWave`가 같은 정책(integration checkout의 config)으로 계산된다.
- 실패 경로: `coordinator.max_parallel`이 정수가 아니거나 1보다 작으면 `coordinate prepare`가 worktree를 만들기 전에 `{ ok: false, reason: 'coordinator-config-invalid' }`를 반환한다. 읽기 전용 소비자(`status`·`integrate`·`bootstrap` 응답의 `ready`, `bouncer current`, commit 안내, run preflight)는 거절하지 않고 `maxParallel: 1`로 계산한다. 잘못된 설정에서 병렬 폭을 넓히지 않기 위해서다. S28은 잘못된 `exclusive_resources`를 `exclusive_resources must be an array of unique resource ids`로 거절한다.
- 보존: 선행 조건 판정(dependency gate), task 상태 전이, verification node의 단독 실행, 기존 원장 파일 호환은 바뀌지 않는다.

#### Interface

- 제공:
  - `readyWave(tasks: Task[], options?: { maxParallel?: number }): string[]` — `options` 부재 시 `maxParallel = 2`.
  - `config.ts` `readCoordinatorPolicy(repoRoot: string): { ok: true; maxParallel: number } | { ok: false; reason: 'invalid' }`와 상수 `DEFAULT_MAX_PARALLEL = 2`. config 부재·`coordinator` 키 부재는 `{ ok: true, maxParallel: 2 }`이다.
  - task frontmatter `bouncer.exclusive_resources?: string[]` — 항목 shape `^[a-z0-9][a-z0-9._-]*$`(예: `database-schema`), 중복 금지, 부재는 `[]`.
  - 원장 task 필드 `affected_paths: string[]`, `exclusive_resources: string[]` — bootstrap(`taskList`)이 문서에서 스냅샷한다.
- 거부:
  - `max_parallel`: `0`, `-1`, `1.5`, `"2"`, `null` → `readCoordinatorPolicy`가 `invalid`, prepare가 `coordinator-config-invalid`를 반환한다.
  - `exclusive_resources`: 배열이 아닌 값, 빈 문자열, 대문자·공백 포함 항목, 중복 항목 → S28.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `readyWave`, `taskList`, `Task`, `coordinate`(prepare·status·bootstrap·integrate 분기) | Modify | ready wave 계산과 bootstrap 스냅샷 | 한도·충돌 기반 선택, 스냅샷 필드 추가, 호출처에 정책 전달, prepare의 config 거절 | scheduler의 정본 |
| `scripts/lib/coordinator.js` | 생성물 | Modify | 배포 CommonJS | `npm run build` 결과 | `check:emit` 동기화 |
| `scripts/src/lib/config.ts` | `readCoordinatorPolicy`, `DEFAULT_MAX_PARALLEL` | Modify | config 단일 파서 | coordinator 정책 reader 추가 | 설정 해석을 한곳에 둔다 |
| `scripts/lib/config.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/schema.ts` | 신규 추출 지점: exclusive_resources 검증기 | Modify | DAG 필드 기본값·검증기 | `exclusive_resources` 기본값과 shape 검증기 | S28과 coordinator가 같은 규칙을 쓴다 |
| `scripts/lib/schema.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/validate-structural.ts` | S28 분기 | Modify | DAG shape 검사 | `exclusive_resources` shape 검사 추가 | 계획 시점 거절 |
| `scripts/lib/validate-structural.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/current.ts` | `coordinatorSnapshot` | Modify | `bouncer current`의 coordinator 요약 | integration config 정책으로 `ready` 계산 | ready 표시 일치 |
| `scripts/lib/current.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/commit.ts` | `nextReadyTask`, `coordinatorProvenance` | Modify | commit 뒤 다음 task 안내 | 같은 정책으로 `readyWave` 호출 | 안내와 prepare 결과 일치 |
| `scripts/lib/commit.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/run-preflight.ts` | `collectTasks`, `runPreflight` | Modify | 문서 기반 ready wave 미리보기 | `affected_paths`·`exclusive_resources`를 읽고 정책으로 계산 | 시작 ACQ 미리보기 일치 |
| `scripts/lib/run-preflight.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/coordinator.test.js` | readyWave·prepare 테스트 | Modify | readyWave 동작 고정 | 한도·충돌·legacy·config 거절 테스트 | 기대 red 위치 |
| `test/validate-structural.test.js` | S28 테스트 | Modify | DAG shape 고정 | `exclusive_resources` 거절 테스트 | S28 계약 |
| `test/run-preflight.test.js` | readyWave 미리보기 | Modify | preflight 고정 | 한도 반영 기대값 | 호출처 계약 변경 |
| `test/current.test.js` | coordinator snapshot | Modify | `bouncer current` 고정 | 한도 반영 기대값 | 호출처 계약 변경 |
| `test/commit-task.test.js` | 다음 task 안내 | Modify | commit 안내 고정 | 한도 반영 기대값 | 호출처 계약 변경 |
| `test/cli-coordinate.test.js` | `ready` 배열 기대값 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-current.test.js` | `ready` 배열 기대값 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-commit.test.js` | `ready` 배열 기대값 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/coordinator-e2e.test.js` | `ready` 배열 기대값 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/commit-hook.test.js` | `ready` 배열 기대값 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- 충돌 판정은 `validate-sections.ts`의 `pathsOverlap`을 재사용하고 새 경로 비교 규칙을 만들지 않는다.
- `parallel_safe`는 명시 `true`만 병렬 허용이다. 기존 원장·문서 호환 규칙을 바꾸지 않는다.
- 새 gate code를 추가하지 않는다. shape 오류는 기존 S28에 싣는다.
- `.bouncer/config.json`·`config.example.json`을 수정하지 않는다. 기본값은 코드 상수다.

### Task 002

#### Goal & intent

coordinator 원장이 task 배정마다 `lease`(`id`, `generation`, 발급 순번 `seq`)를 발급하고, revoke된 이전 generation의 늦은 event를 상태 변경 없이 거절하게 한다.
완료 조건: revoke 뒤 이전 `lease_id`·`generation`으로 온 `dispatch`·`report`·`record`·`integrate --task`는 `stale-lease`로 끝난다. scope revision이 다른 active lease와 겹치면 늦게 발급된 lease의 task만 `pending`으로 돌아간다. 모든 원장 mutation은 잠금 안에서 fence 확인과 쓰기를 한 번에 한다.

#### Current behavior

- `coordinator.ts` `prepare`(921–1030행)는 ready task마다 worker worktree를 만들고 status를 `prepared`로 올린다. 배정 식별자는 `workerPath`·`branch`뿐이다.
- `dispatch`(1081행)는 `attempt`와 `task_brief_hash`를 봉인하고, `report`(1125행)는 이 둘이 다르면 `stale-report` decision을 남기고 거절한다. 배정 자체를 무효화하는 revoke나 generation은 없다.
- 원장 쓰기는 `atomicWrite`(154행, tmp+rename)만 쓰고 잠금이 없다. `scope.ts`의 `withLedgerLock`(296행, 비공개)은 `reviseTaskScope`·`recordActualPaths`만 감싼다. 그래서 worker의 actual paths 기록과 coordinator mutation이 겹치면 한쪽 쓰기가 사라질 수 있다.
- `reviseTaskScope`(`scope.ts:646`)는 다른 task의 scope와 겹치는지 보지 않는다.
- `runtime-state.ts:249` `validateCoordinatorLedger`는 `dispatch` shape만 검사하고 lease 필드를 모른다.
- CLI `cmdCoordinate`(`cli-git-commands.ts:206`)는 `--lease-id`·`--generation`·`revoke`를 파싱하지 않는다.
- 재현: `node --test test/coordinator.test.js test/cli-coordinate.test.js`.

#### Target behavior

- 성공 경로:
  - prepare가 commit task를 `prepared`로 올릴 때 `ledger.leaseSeq`를 1 올리고 `task.lease = { id: randomUUID(), generation: (이전 lease generation ?? 0) + 1, seq: ledger.leaseSeq, status: 'active' }`를 기록한다. 응답의 task 항목에 `lease`가 실린다.
  - `dispatch`·`report`·`record`·`integrate --task`(commit task)에 `--lease-id`·`--generation`이 주어지면 활성 lease와 같을 때만 기존 로직을 수행한다. 두 플래그는 함께 주거나 함께 생략한다. 생략하면 lease 검사 없이 기존 attempt·brief hash·상태 검사만 한다. revoke가 dispatch를 비우고 status를 `pending`으로 돌리므로, revoke 뒤 늦은 호출은 플래그가 없어도 `no-active-dispatch`·`illegal-transition`으로 거절된다.
  - `coordinate revoke --task <NNN> --reason <r>`은 `prepared`·`recorded` task의 lease를 `revoked`로 바꾸고(`lease` 필드가 없는 legacy task는 lease를 새로 만들지 않고 상태만 되돌리며, decision의 `lease_id`·`generation`은 `null`이다), `dispatch`·`sha`를 비운 채 status를 `pending`으로 되돌린다. decision `{ task, kind: 'revoke', lease_id, generation, reason, previous_status, previous_head }`를 남긴다.
  - revoke된 task를 다음 prepare가 다시 고르면, 등록된 worker worktree와 branch를 `git worktree remove --force` / `git branch -D`로 지운 뒤 현재 integration HEAD에서 새로 만들고 generation을 1 올린다.
  - `reviseTaskScope`의 새 경로가 `prepared`·`recorded` 상태인 다른 task의 active lease 경로와 `pathsOverlap`이면, 두 lease 중 `seq`가 큰 쪽을 같은 잠금 안에서 revoke한다(reason `scope-conflict`). 그 revision 기록은 유지한다. 응답에 `revoked: ['NNN']`을 싣는다.
  - fence 대상 명령(`LEDGER_FENCED_COMMANDS`와 `revoke`)은 `withLedgerLock` 안에서 원장 로드 → fence 확인 → 쓰기를 수행한다. 쓰기 직전에 `owns()`가 거짓이면 `ledger-lock-lost`를 반환한다.
  - 예외: verification node의 `integrate --task`는 두 번 잠근다. 첫 잠금에서 `verifying` 전이를 쓰고 푼 뒤 잠금 밖에서 `runVerification`을 실행한다. 두 번째 잠금에서 원장 hash가 첫 쓰기 직후 값과 같을 때만 결과(`integrated` 또는 `terminalFailure`)를 쓴다. 다르면 `stale-ledger-checkpoint`를 반환하고 task는 `verifying`으로 남는다. `terminalFailure`가 기록되지 않은 `verifying` verification node는 `integrate --task`를 다시 받아 전이 없이 검증부터 재실행한다(repair wave를 소모하지 않는다). `terminalFailure`가 있는 `verifying` node는 기존처럼 repair만 받는다.
- 실패 경로:
  - 두 플래그 중 하나만 주면 `lease-required`.
  - 값이 다르거나 lease가 `revoked`면 decision `{ task, kind: 'stale-lease', expected, received }`만 추가하고 `{ ok: false, reason: 'stale-lease', expected, received }`를 반환한다. task status·dispatch는 그대로다.
  - revoke 대상이 `prepared`·`recorded`가 아니면 `illegal-transition`, reason이 비면 `decision-reason-required`.
  - 잠금 대기 초과는 `ledger-locked`.
- 보존: `lease` 필드가 없는 legacy 원장 task는 lease 검사 없이 기존 attempt·brief hash 검사만 받는다. `stale-report`, `accepted-report-required`, ledger hash fence 응답 형식은 바뀌지 않는다.

#### Interface

- 제공:
  - 신규 `scripts/src/lib/lease.ts`(순수 함수, Git·fs 없음):
    - `issueLease(ledger, task, makeId: () => string): Lease`
    - `revokeLease(ledger, task, { reason, previousHead }): RevokeDecision`
    - `checkLease(task, received: { lease_id?: string; generation?: number }): { ok: true } | { ok: false; reason: 'lease-required' | 'stale-lease'; expected; received }` — 둘 다 없으면 `{ ok: true }`
    - 타입 `Lease = { id: string; generation: number; seq: number; status: 'active' | 'revoked' }`
  - `coordinate({ ..., leaseId?: string, generation?: number, reason?: string })`와 명령 `revoke`. revoke 성공 응답은 `{ ok: true, command: 'revoke', task: Task, decision: RevokeDecision, checkpoint }`다.
  - CLI 플래그 `--lease-id <id>`, `--generation <n>`(양의 정수), 명령 `coordinate revoke`. usage 문자열에 추가한다.
  - `scope.ts`에서 `withLedgerLock`을 export한다. `reviseTaskScope` 응답에 선택 필드 `revoked: string[]`를 싣는다.
  - `validateCoordinatorLedger`가 `lease`(위 shape)와 `leaseSeq`(0 이상 정수)를 검사한다. 위반은 `lease-invalid`.
- 거부(즉시 반환): `--generation abc`·`0`은 CLI가 exit 2로 거절한다. 형식이 틀린 원장 lease는 모든 명령에서 `lease-invalid`로 거절한다.
- test seam: `coordinate`의 `deps.makeLeaseId?: () => string`으로 lease id를 고정한다. 기본값은 `crypto.randomUUID`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/lease.ts` | 신규 추출 지점: lease 발급·revoke·검사 | Create | 없음 | 순수 lease 함수 | coordinator와 scope가 순환 require 없이 공유한다 |
| `scripts/lib/lease.js` | 생성물 | Create | 없음 | build 결과 | `check:emit` |
| `scripts/src/lib/coordinator.ts` | `coordinate`(prepare·dispatch·report·record·integrate·revoke), `Task`, `Ledger` | Modify | 배정·보고·기록 | lease 발급·검사·revoke와 잠금 안 mutation | 배정 원장의 정본 |
| `scripts/lib/coordinator.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/scope.ts` | `withLedgerLock`, `reviseTaskScope`, `LedgerTask` | Modify | revision 잠금 쓰기 | 잠금 export, scope 충돌 시 후발 lease revoke | scope revision 충돌 규칙 |
| `scripts/lib/scope.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/runtime-state.ts` | `validateCoordinatorLedger` | Modify | 원장 shape 검증 | lease·leaseSeq 검증 | 손상 lease가 재개 기준이 되지 않게 한다 |
| `scripts/lib/runtime-state.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, coordinate usage | Modify | coordinate 인자 파싱 | `--lease-id`·`--generation`·`revoke` | 공개 CLI 표면 |
| `scripts/lib/cli-git-commands.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/coordinator.test.js` | lease 테스트 | Modify | coordinator 동작 고정 | 발급·stale·revoke·requeue 테스트 | 기대 red 위치 |
| `test/cli-coordinate.test.js` | CLI 테스트, `__fence` helper | Modify | CLI 계약 고정 | 플래그·revoke·잠금 테스트 | 계약 변경 |
| `test/runtime-state.test.js` | 원장 검증 테스트 | Modify | shape 검증 고정 | `lease-invalid` 테스트 | 검증 계약 |
| `test/current.test.js` | revise 테스트 | Modify | revise 동작 고정 | scope 충돌 revoke 테스트 | revise 계약 변경 |
| `test/cli-help.test.js` | usage 고정 | Modify | help 문자열 | revoke·lease 플래그 반영 | usage 변경 |
| `test/coordinator-e2e.test.js` | `__FENCED`, drive 흐름 | Modify | 실제 Git drive 고정 | fenced 집합에 `revoke`, prepare 응답의 `lease` 기대값 | 전체 `npm test` green에 필요 |
| `test/commit-task.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-commit.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/commit-hook.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-current.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-validate.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/finalize.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/execute-prepare.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/native-profile-e2e.test.js` | prepare 응답 task 객체 비교 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- lease 검사는 attempt·brief hash 검사를 대체하지 않고 그 앞에 둔다. 두 검사가 모두 통과해야 한다.
- stale event는 decision만 남기고 task status·dispatch·sha를 바꾸지 않는다.
- `lease.ts`는 fs·Git·다른 lib 모듈을 require하지 않는다.
- 잠금은 원장 read-modify-write 구간에만 잡는다. 검증 명령 실행처럼 30초를 넘을 수 있는 구간을 잠금 안에 두지 않는다. verification node는 이 task가 두 단계로 나누고, commit task fan-in의 검증 구간은 TASKS-004가 나눈다.
- 새 gate code를 만들지 않는다. 거절은 기존처럼 `reason` 문자열로 한다.

### Task 003

#### Goal & intent

worker worktree에서 실행한 current·verify·validate·commit·commit hook이 공유 pointer의 task가 아니라, 그 worktree에 원장 lease로 배정된 task를 대상으로 판정하게 한다.
완료 조건: pointer가 TASKS-001을 가리켜도 `workers/002` cwd에서는 모든 소비자가 TASKS-002를 쓴다. active lease가 없는 worker cwd는 fail-closed로 거절한다. 원장이 없는 standalone checkout은 기존 pointer task를 그대로 쓴다.

#### Current behavior

- pointer는 blueprint마다 하나다(`<git-common-dir>/bouncer/pointers/<epic>/<bp>.json`, `{ blueprint, base, task? }`). `current.ts:100` `selectionLocation`은 integration과 모든 `workers/NNN`을 같은 키로 해석한다.
- 활성 task를 `pointer.task`에서 직접 읽는 소비자:
  - `verification.ts:202` `entriesForVerify`, `verification.ts:531` `resolveDefaultTaskScope` — verify 명령과 evidence scope key.
  - `validate-docs.ts:202` `resolveTaskUnit` — `entriesForVerify`를 거친다. execute·commit gate(G6–G8, G17)와 `commit.ts:290` `commitTask`가 이 결과를 쓴다.
  - `commit-hook.ts:264` `readAffectedPaths`, `commit-hook.ts:326` `evaluateCommit` — `coordinatorContext({ task: current.task })`.
  - `execute-prepare.ts` `pointerTask`·`assignedWorkerPath`(160행) — drive payload의 worker 경로.
- `presentCurrent`(`current.ts:535`)는 pointer task만 보고하고 `effectiveTask`가 없다.
- 그래서 coordinator가 task마다 `bouncer current --set`으로 pointer를 옮겨야 하고, 두 worker를 동시에 판정할 수 없다(`agents/bouncer-coordinator.md:57-64`).
- 재현: `node --test test/current.test.js test/verification-runner.test.js test/commit-hook.test.js test/commit-task.test.js`.

#### Target behavior

- 성공 경로:
  - `resolveEffectiveTask`는 cwd realpath가 `.worktrees/<epic>/<bp>/workers/<NNN>`인지 본다.
  - worker이면 원장 task `NNN`의 `workerPath` realpath가 cwd와 같고 `lease.status === 'active'`일 때 `{ source: 'lease', ... }`를 반환한다. legacy task(`lease` 부재)는 status가 `prepared`·`recorded`일 때 같다.
  - worker가 아니면 `pointer.task` 기반 `{ source: 'pointer', ... }`를, pointer task가 없으면 `null`을 반환한다.
  - 위 다섯 소비자가 `pointer.task` 대신 `resolveEffectiveTask`의 `path`를 쓴다. `bouncer current` payload에는 `effectiveTask`가 추가된다.
- 실패 경로: lease를 확인하지 못한 worker cwd에서는 결과가 `{ source: null, reason: 'no-active-lease' | 'unreadable-ledger' }`다. 소비자는 다음처럼 거절한다.
  - `resolveDefaultTaskScope`는 `VERIFY_IDENTITY_INVALID`(메시지 `no active lease for worker worktree`)를 던진다.
  - `resolveTaskUnit`는 `null`을 반환해 gate가 task 문서 부재로 실패한다.
  - `evaluateCommit`은 `block: true`와 code(결과의 `reason`: `no-active-lease` 또는 `unreadable-ledger`)를 반환한다.
  - `executePrepare`는 `{ ok: false, reason }`(같은 두 값)를 반환한다.
- 보존: cwd가 worker 경로(`.worktrees/<epic>/<bp>/workers/<NNN>`)가 아니면(standalone execute worktree, integration, main checkout) 원장 유무와 관계없이 모든 소비자의 결과가 현재와 같다. worker 경로에서는 원장이 없어도 pointer로 떨어지지 않고 위 실패 경로를 따른다. `readCurrent`의 `CURRENT_AMBIGUOUS`·`CURRENT_INVALID` throw는 그대로 전파된다. pointer 파일 형식과 `current --set` 동작은 바뀌지 않는다.

#### Interface

- 제공: `current.ts`
  ```ts
  type EffectiveTask =
    | { source: 'lease'; blueprint: string; path: string; id: string; lease_id: string | null; generation: number | null }
    | { source: 'pointer'; blueprint: string; path: string; id: string | null }
    | { source: null; blueprint: string; reason: 'no-active-lease' | 'unreadable-ledger'; path: null; id: null };
  function resolveEffectiveTask(opts: { repoRoot: string; deps?: RuntimeDeps }): EffectiveTask | null;
  ```
  - `path` 예: `.bouncer/context/epics/078-x/blueprints/001-y/tasks/002/tasks.md`, `id` 예: `TASKS-002`.
  - `presentCurrent` 반환에 `effectiveTask: EffectiveTask | null`을 추가한다. 기존 키는 유지한다.
- 거부: cwd가 worker 경로이면 pointer 분기로 떨어지지 않는다. 원장이 없거나 task·lease를 확인하지 못하면 `reason: 'no-active-lease'`, 원장을 읽을 수 없으면 `reason: 'unreadable-ledger'`인 `source: null` 결과다. 두 reason 모두 소비자가 Target behavior 실패 경로와 같이 거절한다(commit hook·execute prepare의 code는 각 reason 문자열).
- test seam: `resolveEffectiveTask`의 `deps`는 기존 `RuntimeDeps`(fs·platform)를 그대로 쓴다. 테스트는 임시 Git 저장소에 실제 worktree·원장 파일을 만든다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/current.ts` | `resolveEffectiveTask`(신규), `presentCurrent` | Modify | pointer 해석과 출력 | lease 우선 resolver와 `effectiveTask` 출력 | 모든 소비자가 쓰는 단일 resolver |
| `scripts/lib/current.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/verification.ts` | `entriesForVerify`, `resolveDefaultTaskScope` | Modify | verify 대상 task 선택 | effective task 사용, no-active-lease 거절 | verify·evidence key 소비자 |
| `scripts/lib/verification.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/validate-docs.ts` | `resolveTaskUnit` | Modify | gate 대상 task 묶음 | no-active-lease에서 `null` | gate 소비자 |
| `scripts/lib/validate-docs.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/commit-hook.ts` | `readAffectedPaths`, `evaluateCommit` | Modify | hook scope 판정 | effective task 사용, `no-active-lease` 차단 | commit guard 소비자 |
| `scripts/lib/commit-hook.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/execute-prepare.ts` | `pointerTask`, `assignedWorkerPath`, `executePrepare` | Modify | drive worker 경로 보고 | effective task 사용 | execute 소비자 |
| `scripts/lib/execute-prepare.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/current.test.js` | effective task 테스트 | Modify | current 계약 고정 | lease·pointer·no-active-lease 테스트 | 기대 red 위치 |
| `test/verification-runner.test.js` | verify 대상 테스트 | Modify | verify scope 고정 | worker cwd lease 테스트 | 소비자 계약 |
| `test/commit-hook.test.js` | hook 테스트 | Modify | hook 판정 고정 | worker cwd lease·차단 테스트 | 소비자 계약 |
| `test/commit-task.test.js` | commit task 테스트 | Modify | commit 대상 고정 | worker cwd에서 lease task commit 테스트 | 소비자 계약 |
| `test/execute-prepare.test.js` | drive worker 경로 테스트 | Modify | execute prepare 고정 | lease task의 workerPath 보고 테스트 | 소비자 계약 |
| `test/cli-commit.test.js` | worker cwd pointer 판정 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-validate.test.js` | worker cwd gate 테스트 | Modify | validate CLI 고정 | worker cwd에서 `bouncer validate --gate execute`가 lease task(TASKS-002)를 판정하고, lease가 없으면 task 문서 부재로 실패하는 테스트 추가 | `resolveTaskUnit` 소비자 계약 |
| `test/cli-current.test.js` | worker cwd pointer 판정 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- `resolveEffectiveTask`는 원장을 쓰지 않는다. 읽기만 한다.
- lease가 pointer보다 우선하는 것은 worker cwd에서만이다. integration·main cwd에서 원장 lease로 pointer를 덮지 않는다.
- `bouncer current` payload의 기존 키 이름·타입을 바꾸지 않는다.
- 새 gate code를 만들지 않는다.

### Task 004

#### Goal & intent

fan-in이 canonical integration branch에 바로 cherry-pick하지 않게 한다. 임시 candidate worktree에서 wave의 recorded task를 dependency·ID 순서로 쌓고, 검증을 통과한 뒤에만 CAS 확인과 fast-forward로 반영한다.
완료 조건:
- cherry-pick 충돌이나 wave 검증 실패 뒤에도 canonical HEAD와 원장 `integrationHead`가 그대로이고, wave의 어떤 task도 `integrated`가 되지 않는다.
- fast-forward 뒤 원장 기록 전에 중단돼도, 재실행이 같은 commit을 다시 cherry-pick하지 않고 원장을 완결한다.

#### Current behavior

- `coordinator.ts:1291` `integrate`(commit task)는 `--task` 하나를 받아 다음 순서로 동작한다.
  1. `workerOwnsSha`·`integrationHead` 일치·`checkWorkerEvidence`를 확인한다.
  2. `copyEvidenceBundle`로 문서를 integration에 복사한다.
  3. integration checkout에서 `git cherry-pick <sha>`를 실행한다(1367행).
  4. `integrationHead`를 갱신한다.
- 통합 전 검증이 없다. cherry-pick이 실패하면 문서만 되돌리고 예외를 다시 던지므로, cherry-pick이 진행 중인 상태가 integration checkout에 남을 수 있다.
- git 명령과 원장 쓰기 사이에 중단되면 원장 `integrationHead`와 실제 HEAD가 어긋나 다음 호출이 `stale-integration-head`로 막힌다. 복구 경로가 없다.
- verification node(`integrate --task <terminal>`, 1293–1348행)는 integration에서 `runVerification`(scope `terminal`)을 실행하고 repair 한도 2를 관리한다.
- `runtime-state.ts:796` `coordinatorPathsFor`는 `integrationPath`·`ledgerFile`·`workerPath`만 계산한다.
- 재현: `node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js`.

#### Target behavior

- 성공 경로(`integrate`에 `--task`가 없거나, commit task 하나를 지정한 경우):
  1. 잠금 안에서 대상 목록을 확정한다. 대상은 `recorded`이면서 lease가 active이거나 `lease` 필드가 없는(legacy) commit task다(`--task`면 그 하나). `--task`에 `--lease-id`·`--generation`이 주어지면 TASKS-002 `checkLease`를 대상 확정 전에 적용하고 불일치면 `stale-lease`로 끝낸다. task 생략(wave) 형태에 `--lease-id`·`--generation`이 오면 `lease-flags-require-task`로 거절하고, 플래그 없이 revoked lease task를 대상에서 뺀다. task 사이 `depends_on`을 먼저, 그다음 ID순으로 정렬한다. 각 task의 worker 소유 SHA·증적을 검사한다. canonical HEAD가 `ledger.integrationHead`와 같은지 확인한다. 그 뒤 `ledger.fanin = { base_head, candidate_head: null, tasks, status: 'building' }`를 기록하고 잠금을 푼다.
  2. 잠금 밖에서 `<root>/fanin`에 `git worktree add --detach <fanin> <base_head>`로 candidate를 만든다(이전 candidate가 있으면 먼저 `git worktree remove --force`). `seedCoordinatorWorker`로 계획 문서와 config를 seed하고 각 SHA를 cherry-pick한다. 이어 `runVerification({ repoRoot: fanin, blueprintDir, taskId: <wave의 마지막 task>, scope: { kind: 'wave', key: 'EPIC-<e>/BP-<b>:wave:<candidate_head>' } })`를 실행한다. 검증 문서 기록은 candidate 사본에만 남고 candidate와 함께 지워지며, 원장에는 `evidence_id`만 남는다.
  3. 잠금을 다시 잡는다. 원장 hash가 1단계에서 쓴 직후 값과 다르면 candidate를 지우고 `fanin`을 `building`으로 둔 채 `stale-ledger-checkpoint`를 반환한다(재실행은 HEAD가 `base_head`이므로 1단계부터 다시 한다). 같으면 canonical HEAD가 `base_head`인지 확인한다(CAS). 같을 때만 `fanin.status = 'verified'`와 `candidate_head`를 원장 파일에 먼저 쓴다(ff 전 첫 쓰기). 그다음 순서대로 수행하고 마지막에 원장을 한 번 더 쓴다(ff 후 둘째 쓰기).
     - integration에서 `git merge --ff-only <candidate_head>`를 실행한다.
     - 각 task의 증적 bundle을 `copyEvidenceBundle`로 복사한다.
     - task들을 `integrated`로 올리고, `integrationHead = candidate_head`로 갱신한 뒤 `fanin = null`로 비운다.
     - decision `{ kind: 'fanin', tasks, base_head, candidate_head, evidence_id }`를 남긴다.
     - candidate worktree를 지운다.
- 재시작 복구: `integrate` 시작 시 `ledger.fanin`이 있으면 다음처럼 처리한다.
  - `status: 'verified'`이고 canonical HEAD가 `candidate_head`이면 cherry-pick 없이 3단계의 bundle 복사부터 완결한다.
  - canonical HEAD가 `base_head`이면(`building`이거나 ff 전 중단) candidate를 지우고 1단계부터 다시 한다.
  - 둘 다 아니면 candidate를 지우고 `fanin = null`로 비운 뒤 `stale-integration-head`를 반환한다.
- 실패 경로:
  - cherry-pick 충돌: candidate에서 `git cherry-pick --abort`를 실행하고 candidate를 지운다. 충돌한 task는 TASKS-002 revoke 규칙으로 되돌린다(reason `fanin-conflict`; legacy task는 lease 없이 `pending`으로 돌아가고 decision의 `lease_id`·`generation`은 `null`). `fanin = null`로 비우고 `{ ok: false, reason: 'fanin-conflict', task }`를 반환한다. 나머지 task는 `recorded`로 남는다.
  - 검증 실패: candidate를 지우고 `fanin = null`로 비운다. decision `{ kind: 'fanin-verification-failed', tasks, command, exitCode, evidence_id }`를 남기고 `{ ok: false, reason: 'wave-verification-failed', tasks, verification }`를 반환한다. task는 모두 `recorded`로 남는다.
  - CAS 불일치: ff를 하지 않는다. candidate를 지우고 `fanin = null`로 비운 뒤 `stale-integration-head`를 반환한다.
  - 대상이 없으면 `nothing-to-integrate`.
- 명시 task 검증: pointer를 옮기지 않으므로 `runVerification`에 선택 인자 `taskId?: string`(세 자리)을 추가한다. 주어지면 `readVerifyCommand`·`resolveVerificationRel`이 effective task 대신 그 task 묶음의 `verify`와 `verification.md`를 쓴다. verification node의 `integrate --task`는 자기 task id를 넘겨 `npm run ci`를 실행하고, wave는 위처럼 마지막 task id를 넘긴다.
- 보존: verification node의 terminal scope key, repair 한도 2, partial-close, `rerecord`는 바뀌지 않는다. `taskId`가 없는 기존 `runVerification` 호출은 effective task 해석을 그대로 쓴다. 한 task만 지정한 `integrate --task`도 같은 candidate 경로를 탄다.

#### Interface

- 제공:
  - `coordinatorPathsFor` 반환에 `faninPath: <worktreeRoot>/<epic>/<bp>/fanin`을 추가한다.
  - 원장 `fanin: { base_head: string; candidate_head: string | null; tasks: string[]; status: 'building' | 'verified' } | null`. `validateCoordinatorLedger`는 shape가 틀리면 `fanin-invalid`로 거절한다.
  - `coordinate integrate`에서 `task`는 선택이다. 응답은 `{ ok: true, command, integrated: string[], integrationHead, verification, ready, checkpoint }`다.
  - decision 종류 `fanin`, `fanin-verification-failed`.
- 거부(즉시 반환): `fanin-conflict`, `wave-verification-failed`, `stale-integration-head`, `stale-ledger-checkpoint`, `stale-lease`, `lease-flags-require-task`, `nothing-to-integrate`, `fanin-invalid`. `runVerification`의 `taskId`가 목록에 없으면 `VERIFY_IDENTITY_INVALID`를 던진다.
- test seam: 기존 `deps.execFileSync`와 `deps.runVerification`을 쓴다. 검증 실패는 `runVerification: () => ({ ok: false, command: 'npm test', exitCode: 1 })`로 주입한다. 중단 복구는 원장에 `fanin.status: 'verified'`를 직접 기록하고 integration을 `candidate_head`로 ff한 fixture로 재현한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `coordinate`(integrate 분기), `copyEvidenceBundle`, `Ledger` | Modify | 직접 cherry-pick fan-in | candidate·검증·CAS ff·재시작 복구 | fan-in 정본 |
| `scripts/lib/coordinator.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/runtime-state.ts` | `coordinatorPathsFor`, `validateCoordinatorLedger` | Modify | coordinator 경로·원장 검증 | `faninPath`, `fanin` 검증 | candidate 위치와 원장 shape |
| `scripts/lib/runtime-state.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, coordinate usage | Modify | integrate에 `--task` 필수 | `--task` 선택화, usage 갱신 | 공개 CLI 표면 |
| `scripts/lib/cli-git-commands.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/coordinator.test.js` | integrate 테스트 | Modify | fan-in 고정 | wave·충돌·검증 실패·CAS·복구 테스트 | 기대 red 위치 |
| `test/cli-coordinate.test.js` | integrate CLI 테스트 | Modify | CLI 계약 고정 | `--task` 생략 테스트 | CLI 계약 |
| `test/runtime-state.test.js` | 경로·원장 검증 테스트 | Modify | 경로·shape 고정 | `faninPath`, `fanin-invalid` | 계약 변경 |
| `scripts/src/lib/verification.ts` | `runVerification`, `readVerifyCommand`, `resolveVerificationRel` | Modify | effective task 기준 검증 | 선택 `taskId`로 명시 task 검증 | pointer 없는 wave·terminal 검증 |
| `scripts/lib/verification.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/verification-runner.test.js` | 명시 task 검증 테스트 | Modify | runner 고정 | `taskId` 지정 시 그 task의 verify·문서 사용, 목록 밖 id 거절 | runner 계약 변경 |
| `test/cli-help.test.js` | usage 고정 | Modify | help 문자열 | integrate usage 반영 | usage 변경 |
| `test/coordinator-e2e.test.js` | drive 흐름 | Modify | 실제 Git drive 고정 | candidate 경유 integrate 기대값 | 전체 `npm test` green에 필요 |
| `test/cli-validate.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-commit.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/commit-hook.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/commit-task.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/current.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/cli-current.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/finalize.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/native-profile-e2e.test.js` | `coordinate integrate` 호출 fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- canonical integration checkout에서는 `git merge --ff-only`만 쓴다. `reset`·`cherry-pick`·`rebase`를 쓰지 않는다.
- 검증 명령 실행 구간에서는 원장 잠금을 잡지 않는다. 반영 단계의 hash 재확인으로 끼어든 쓰기를 감지한다.
- wave 검증 evidence는 `wave` scope만 쓴다. `task`·`terminal` evidence와 재사용 키를 섞지 않는다.
- `--task`로 지정한 commit task도 candidate 경로를 거친다. 검증 없는 직접 cherry-pick 경로를 남기지 않는다.

### Task 005

#### Goal & intent

coordinator·commit·pointer 문서를 병렬 dispatch 계약으로 바꾼다. 로드맵 P3.5 회귀 전체를 실제 Git 저장소 e2e로 고정한다.
완료 조건:
- 문서가 "pointer를 task마다 `--set`하고 하나씩 몬다"는 규칙 대신 lease·effective task·wave fan-in·revoke 절차를 지시한다.
- 실제 Git 저장소 e2e가 동시 lease 2개, 경로·자원 분리, stale event 거절, 후발 revoke, 재시작 중복 commit 방지, wave 검증 실패 격리, standalone pointer 유지를 모두 확인한다.

#### Current behavior

- `agents/bouncer-coordinator.md:57-64`는 pointer가 저장소에 하나라서 ready wave의 task를 "drive them one at a time"하라고 지시한다. Procedure 3단계(177행)는 task마다 `bouncer current --set <blueprint> --task <NNN>`을 실행하게 한다.
- `.codex/agents/bouncer-coordinator.toml`은 같은 md에서 생성된 사본이다. `test/agents.test.js:238`이 `mdToCodexToml(md)`와 바이트 일치를 검사한다.
- `test/agents.test.js:366-371`, `437-442`는 `current --set`, `drive them one at a time`, `each \`--set\` replaces the previous` 문구를 고정한다.
- `rules/current-pointer.md:61-67`은 coordinator가 task마다 `--set`한다고 적는다. `skills/bouncer-commit/SKILL.md:77-82`는 coordinator가 "moves the pointer with `bouncer current --set` — one pointer serves the whole repository"라고 적는다.
- `rules/document-schema.md:70-90`, `references/spec-authoring/index.md:68-77`, `rules/planning.md` `## Task DAG and approved scope`는 `exclusive_resources`를 모른다. `docs/configuration.md`에는 `coordinator.max_parallel`이 없다.
- `test/coordinator-e2e.test.js`는 순차 drive 한 번만 검증한다.

#### Target behavior

- 성공 경로:
  - coordinator 문서 Procedure는 다음 순서를 지시한다.
    1. `prepare` 응답의 task별 `lease`를 받는다.
    2. ready task마다 task runner를 동시에 dispatch한다(최대 `checkpoint.ready` 수, 설정 한도 안).
    3. 각 runner는 자기 worker cwd에서 effective task로 execute·commit을 수행한다. coordinator는 task마다 pointer를 옮기지 않는다.
    4. `dispatch`·`report`·`record`에 `--lease-id`·`--generation`을 넘긴다.
    5. recorded task가 모이면 `integrate`(task 생략)로 wave fan-in을 한다.
    6. `fanin-conflict`·`wave-verification-failed`·scope 충돌 `revoked`는 revoke·requeue 또는 task별 `integrate --task`로 판정한다.
  - pointer는 blueprint 선택과 standalone task 식별에만 쓴다고 명시한다.
  - codex TOML이 md와 일치한다.
  - schema·planning·spec-authoring 문서에 `exclusive_resources`(shape·부재 의미·충돌 규칙)가 있고, configuration 문서에 `coordinator.max_parallel`(기본 2, 정수 1 이상)이 있다.
  - e2e는 epic Success criteria 1–7과 standalone pointer 유지를 한 파일에서 확인한다.
- 실패 경로: e2e가 canonical HEAD 변경, 중복 cherry-pick, 이전 generation event 수락 가운데 하나라도 관측하면 실패한다.
- 보존: 한 coordinator만 drive한다는 규칙, main worktree read-only, ledger hash fence, critical recovery, partial-close 절차 문구는 유지한다.

#### Interface

- 제공:
  - 문서 계약. 다음 문구가 존재한다.
    - coordinator md: `bouncer coordinate integrate`의 task 생략 형태, `--lease-id`, `--generation`, `coordinate revoke`, `effectiveTask`.
    - `rules/current-pointer.md`와 coordinator md: "coordinator does not move the pointer per task".
  - e2e 테스트 이름 prefix는 `parallel drive:`다.
- 거부: coordinator md에 "drive them one at a time"·"each `--set` replaces the previous"가 남으면 `test/agents.test.js`가, `rules/current-pointer.md`에 "runs `--set` itself before driving each task"가 남으면 `test/master-rules.test.js`가, commit skill에 "moves the pointer with `bouncer current --set`"이 남으면 `test/skill-bouncer-commit.test.js`가 실패한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | Worker boundaries 절, `## Procedure` 2–4단계 | Modify | 순차 pointer drive 지시 | lease 병렬 dispatch·wave integrate·revoke 절차 | coordinator 역할 정본 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 사본 | Modify | codex 역할 사본 | md에서 재생성 | `agents.test.js` 바이트 일치 |
| `rules/current-pointer.md` | coordinator 예외 문단(61–67행) | Modify | coordinator의 task별 `--set` | pointer는 blueprint 선택·standalone 전용, worker는 effective task | pointer 규칙 정본 |
| `skills/bouncer-commit/SKILL.md` | `return-to-coordinator` 문단 | Modify | coordinator가 pointer를 옮긴다는 서술 | lease 기록과 wave integrate 서술 | commit workflow 안내 일치 |
| `rules/document-schema.md` | DAG 필드 목록 | Modify | DAG frontmatter schema | `exclusive_resources` 추가 | schema 정본 |
| `rules/planning.md` | `## Task DAG and approved scope` | Modify | DAG 계획 규칙 | 경로·자원 충돌 시 같은 wave 불가 규칙 | 계획 규칙 정본 |
| `references/spec-authoring/index.md` | depends_on·parallel_safe 항목 | Modify | DAG 작성 안내 | `exclusive_resources` 작성 안내 | 작성자 안내 |
| `docs/configuration.md` | 설정 키 목록 | Modify | config 키 설명 | `coordinator.max_parallel` | 공개 설정 문서 |
| `docs/architecture/rule-ownership.md` | locator 행 | Modify | 규칙 소유 기준선 | 바뀐 구절을 가리키는 locator·digest 갱신(검사가 실패할 때만) | `test/rule-ownership.test.js` green |
| `test/agents.test.js` | 366–371행, 437–442행 테스트 | Modify | 순차 pointer 문구 고정 | lease·병렬 dispatch 문구 고정, 금지 문구 부재 검사 | 문서 계약 |
| `test/coordinator-e2e.test.js` | `parallel drive:` 테스트 | Modify | 순차 drive e2e | P3.5 회귀 e2e 추가 | 종단 회귀 |
| `test/skill-bouncer-commit.test.js` | pointer·commit 문서 문구 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/master-rules.test.js` | pointer·commit 문서 문구 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |
| `test/workflow-safety-canon.test.js` | pointer·commit 문서 문구 | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- Epic 077의 규칙 소유 경계를 따른다. coordinator 절차는 역할 문서에만 쓰고 run skill에 다시 쓰지 않는다.
- 문서는 CLI가 반환하는 값(`checkpoint.ready`, `lease`, reason 코드)을 가리키기만 하고, ready 판정·충돌 규칙을 다시 계산하게 하지 않는다.
- e2e는 네트워크·PR·credential을 쓰지 않고 `runVerification`은 주입한다.

### Task 006

#### Goal & intent

TASKS-001~005가 모두 integration branch에 통합된 상태에서 `check:emit`, coverage 임계값, lint, doc lint, typecheck, audit을 포함한 전체 CI가 통과함을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### Task 007

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/lib/coordinator.js` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/lib/cli-git-commands.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
