---
type: bouncer.explain
title: 검증 재사용과 coordinator checkpoint 설명
description: Explains evidence reuse, ledger-hash checkpoints, and workflow payload compaction from the completed drive.
resource: .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/blueprints/001-verification-reuse-checkpoint-compaction/explain.md
tags:
  - bouncer
  - explain
  - verification
  - coordinator
timestamp: '2026-09-21T15:11:17.039+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '076'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 7c76c5a6502649913ca0e748f0b9221f68a4e0c5
      diff_sha: fe0d65cb1daaff03935e164e67158c1f95bc3449e02702e74889e2f072d59c2a
      quiz_score: 3/3
      disposition: 세 문항 전부 정답. evidence identity·checkpoint 축소·stale hash 재시도 경로를 이해함.
      recorded_at: '2026-09-21T15:15:24+09:00'
  task_commits:
    - task: EPIC-076/BP-001/TASK-001
      sha: cc0fc52f
      intent_anchor: task-001
    - task: EPIC-076/BP-001/TASK-002
      sha: d0afa47a
      intent_anchor: task-002
    - task: EPIC-076/BP-001/TASK-003
      sha: 5c2e561e
      intent_anchor: task-003
  diff_sha: fe0d65cb1daaff03935e164e67158c1f95bc3449e02702e74889e2f072d59c2a
  coordinator:
    base: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
    integration_head: 7c76c5a6502649913ca0e748f0b9221f68a4e0c5
    integration_branch: feat/076-001-verification-reuse-checkpoint-compaction
    revision: r3
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/076/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/076/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/076/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/076/001/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: cc0fc52fbc7b9e187a053aeb23a198020005cf06
        branch: bouncer/076-001-001
        scope_revision: r2
        paths:
          - scripts/src/lib/verification.ts
          - scripts/lib/verification.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - test/verification-runner.test.js
          - test/cli-verify.test.js
          - test/validate-gates.test.js
          - test/runtime-state.test.js
          - test/native-profile-e2e.test.js
        actual_paths:
          - scripts/lib/runtime-state.js
          - scripts/lib/validate-gates.js
          - scripts/lib/verification.js
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/verification.ts
          - test/cli-verify.test.js
          - test/native-profile-e2e.test.js
          - test/runtime-state.test.js
          - test/validate-gates.test.js
          - test/verification-runner.test.js
      - id: '002'
        status: integrated
        sha: d0afa47a5f103d05094e0fadd6e3614da83baf08
        branch: bouncer/076-001-002
        scope_revision: r3
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
          - test/cli-commit.test.js
          - test/cli-current.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/native-profile-e2e.test.js
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - test/cli-commit.test.js
          - test/cli-coordinate.test.js
          - test/cli-current.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/native-profile-e2e.test.js
          - test/runtime-state.test.js
      - id: '003'
        status: integrated
        sha: 5c2e561e69d494b404274fae572e801be84cbeb5
        branch: bouncer/076-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - bouncer-roadmap.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/distribution.test.js
          - test/skill-bouncer-run.test.js
      - id: '004'
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
        task_brief_hash: ed421c876e5d76aaa05fedc5aae3c203eb445ae184d7d34c138bb256f93e1a0b
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: ed421c876e5d76aaa05fedc5aae3c203eb445ae184d7d34c138bb256f93e1a0b
        outcome: accepted
        summary: evidence v2 identity/reuse; focused 178 pass; emit staged; scope unchanged
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: f229b32cd310f06629660d7f9325254eb69290a0f648d7a688e8ee63f99ffb02
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/runtime-state.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/validate-gates.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-verify.test.js
          M  test/runtime-state.test.js
          M  test/validate-gates.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: f229b32cd310f06629660d7f9325254eb69290a0f648d7a688e8ee63f99ffb02
        outcome: scope_revision
        summary: resolveDefaultTaskScope path/legacy fallback fixed; native-profile-e2e still red because unborn HEAD fails identity before spawn — need fixture commit in test/native-profile-e2e.test.js
      - task: '001'
        kind: scope
        reason: legacy execute e2e fixture must commit HEAD so identity succeeds and configured command can rerun; identity fail-closed stays
        previous:
          - scripts/src/lib/verification.ts
          - scripts/lib/verification.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - test/verification-runner.test.js
          - test/cli-verify.test.js
          - test/validate-gates.test.js
          - test/runtime-state.test.js
        next:
          - test/native-profile-e2e.test.js
        revision: r1
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: dcd2b8a1e34e5e3af73f372ebe7b036d0038f4c8bbc79d124007143dad56cb7d
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/runtime-state.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/validate-gates.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-verify.test.js
          M  test/runtime-state.test.js
          M  test/validate-gates.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: dcd2b8a1e34e5e3af73f372ebe7b036d0038f4c8bbc79d124007143dad56cb7d
        outcome: scope_revision
        summary: revise --paths replaced full affected_paths with only native-profile-e2e; restore full set including prior paths
      - task: '001'
        kind: scope
        reason: restore full affected_paths after revise replaced list; keep native-profile-e2e fixture in scope
        previous:
          - test/native-profile-e2e.test.js
        next:
          - scripts/src/lib/verification.ts
          - scripts/lib/verification.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - test/verification-runner.test.js
          - test/cli-verify.test.js
          - test/validate-gates.test.js
          - test/runtime-state.test.js
          - test/native-profile-e2e.test.js
        revision: r2
      - task: '001'
        kind: dispatch
        attempt: 4
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/runtime-state.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/validate-gates.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-verify.test.js
          M  test/runtime-state.test.js
          M  test/validate-gates.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 4
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        outcome: accepted
        summary: native-profile-e2e fixture commits HEAD; focused suites green; scope unchanged
      - task: '001'
        kind: dispatch
        attempt: 5
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/runtime-state.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/validate-gates.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-verify.test.js
          M  test/native-profile-e2e.test.js
          M  test/runtime-state.test.js
          M  test/validate-gates.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 5
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        outcome: accepted
        summary: eslint-only fixes in verification.ts; lint clean; behavior unchanged
      - task: '001'
        kind: dispatch
        attempt: 6
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        base_head: e1764c2a3ce1f97e8db388f0edd995f1904dbc52
        initial_worktree_state: |
          M  scripts/lib/runtime-state.js
          M  scripts/lib/validate-gates.js
          M  scripts/lib/verification.js
          M  scripts/src/lib/runtime-state.ts
          M  scripts/src/lib/validate-gates.ts
          M  scripts/src/lib/verification.ts
          M  test/cli-verify.test.js
          M  test/native-profile-e2e.test.js
          M  test/runtime-state.test.js
          M  test/validate-gates.test.js
          M  test/verification-runner.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 6
        task_brief_hash: 801f2987293c14972349bcc6fede7345cc27b345dc1d5bd37ce0e916ab10b110
        outcome: accepted
        summary: 'review must_fix batch: SS-001 CT-001 CT-004 MM-001 SEC-001; focused 180 pass'
      - task: '001'
        kind: dispatch
        attempt: 7
        task_brief_hash: 0a52b990255abb37718f8f6af6b1c92f5cc18d96498b940f6a559e257ba6b352
        base_head: cc0fc52fbc7b9e187a053aeb23a198020005cf06
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '001'
        kind: report
        attempt: 7
        task_brief_hash: 0a52b990255abb37718f8f6af6b1c92f5cc18d96498b940f6a559e257ba6b352
        outcome: accepted
        summary: post-commit brief stamp re-ack for coordinate record; worker HEAD cc0fc52f; no code change
      - task: '001'
        decision: record task 001 worker SHA cc0fc52f; changed paths scripts/{src/,}lib/{verification,runtime-state,validate-gates}.{ts,js} test/{verification-runner,cli-verify,validate-gates,runtime-state,native-profile-e2e}.test.js; scope_revision r2
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 5e36e13e964ca4a5086a21ce6b576d765dbb0955d414a403d2c178a475e22cc6
        base_head: bd625083f65b8d86bd4aa201027e9c0338e3c4c3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 5e36e13e964ca4a5086a21ce6b576d765dbb0955d414a403d2c178a475e22cc6
        outcome: accepted
        summary: checkpoint projection + ledger hash fence; focused 309 pass; scope unchanged
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: a33c7d5518b420af7cd397dfd964bb0375c09477249130b6006f5eb583238f62
        base_head: bd625083f65b8d86bd4aa201027e9c0338e3c4c3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/runtime-state.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/runtime-state.ts
          M  test/cli-commit.test.js
          M  test/cli-coordinate.test.js
          M  test/cli-current.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/finalize.test.js
          M  test/runtime-state.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: a33c7d5518b420af7cd397dfd964bb0375c09477249130b6006f5eb583238f62
        outcome: scope_revision
        summary: native-profile-e2e CLI lifecycle needs ledger fence flags after hash fence landed; add test/native-profile-e2e.test.js to scope
      - task: '002'
        kind: scope
        reason: CLI e2e lifecycle must pass ledger-path/hash after fence; keep full prior affected_paths
        previous:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
          - test/cli-commit.test.js
          - test/cli-current.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/current.test.js
          - test/finalize.test.js
        next:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
          - test/cli-commit.test.js
          - test/cli-current.test.js
          - test/cli-validate.test.js
          - test/commit-hook.test.js
          - test/commit-task.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/native-profile-e2e.test.js
        revision: r3
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        base_head: bd625083f65b8d86bd4aa201027e9c0338e3c4c3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/runtime-state.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/runtime-state.ts
          M  test/cli-commit.test.js
          M  test/cli-coordinate.test.js
          M  test/cli-current.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/finalize.test.js
          M  test/runtime-state.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        outcome: rework
        summary: native-profile fenced; eslint still fails on coordinator.ts indent/max-len and unused loadLedger in cli-current.test.js
      - task: '002'
        kind: dispatch
        attempt: 4
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        base_head: bd625083f65b8d86bd4aa201027e9c0338e3c4c3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/runtime-state.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/runtime-state.ts
          M  test/cli-commit.test.js
          M  test/cli-coordinate.test.js
          M  test/cli-current.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/finalize.test.js
           M test/native-profile-e2e.test.js
          M  test/runtime-state.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 4
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        outcome: accepted
        summary: eslint clean; native-profile fenced; checkpoint feature complete
      - task: '002'
        kind: dispatch
        attempt: 5
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        base_head: bd625083f65b8d86bd4aa201027e9c0338e3c4c3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/coordinator.js
          M  scripts/lib/runtime-state.js
          M  scripts/src/lib/cli-git-commands.ts
          M  scripts/src/lib/coordinator.ts
          M  scripts/src/lib/runtime-state.ts
          M  test/cli-commit.test.js
          M  test/cli-coordinate.test.js
          M  test/cli-current.test.js
          M  test/cli-validate.test.js
          M  test/commit-hook.test.js
          M  test/commit-task.test.js
          M  test/coordinator-e2e.test.js
          M  test/coordinator.test.js
          M  test/current.test.js
          M  test/finalize.test.js
          M  test/native-profile-e2e.test.js
          M  test/runtime-state.test.js
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 5
        task_brief_hash: 30d9de325e442a0cf65350d139974b7a81f85c2a04fd05ff80a2f2a7acd4f0f7
        outcome: accepted
        summary: review must_fix batch SS-001/002 CT-001/002/003 MM-001 SEC-001/002; focused 310 pass
      - task: '002'
        kind: dispatch
        attempt: 6
        task_brief_hash: 19a03758ab686d57e00708ba4a078a892ba44a95b0a9c2d52a4f2259c224f733
        base_head: d0afa47a5f103d05094e0fadd6e3614da83baf08
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '002'
        kind: report
        attempt: 6
        task_brief_hash: 19a03758ab686d57e00708ba4a078a892ba44a95b0a9c2d52a4f2259c224f733
        outcome: accepted
        summary: post-commit stamp re-ack for record; worker d0afa47a5f103d05094e0fadd6e3614da83baf08
      - task: '002'
        decision: record task 002 checkpoint+fence; scope_revision r3; worker d0afa47a5f103d05094e0fadd6e3614da83baf08
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: facda4a22af01a1ad1e678b5b8c8396334e826f53775886276e17478dd59f8dd
        base_head: 11c71bce7add8f2ce30fa2c10f84e3c176560d52
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: facda4a22af01a1ad1e678b5b8c8396334e826f53775886276e17478dd59f8dd
        outcome: accepted
        summary: checkpoint-only coordinator/run contracts; focused 74 + ci green; scope unchanged
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: 4dce3b083f245c6343649a82a9f95ebb1e13c5d63b97a7bc91f63413bbd38c9c
        base_head: 5c2e561e69d494b404274fae572e801be84cbeb5
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: 4dce3b083f245c6343649a82a9f95ebb1e13c5d63b97a7bc91f63413bbd38c9c
        outcome: accepted
        summary: post-commit stamp re-ack; 5c2e561e69d494b404274fae572e801be84cbeb5
      - task: '003'
        decision: record task 003 workflow checkpoint contracts; worker 5c2e561e69d494b404274fae572e801be84cbeb5
---
# Explain

## Background

검증이 같은 입력에서도 매번 process를 띄우고, coordinator status가 완료 task의 dispatch·decision 본문까지 계속 실어 context가 불필요하게 커지던 문제를 풀었다. Epic 076은 성공 검증만 내용 주소로 재사용하고, 상세 원장은 보존한 채 활성 응답을 checkpoint와 ledger hash fence로 줄인다.

## Intuition

성공한 검증 영수증이 완전히 같으면 다시 계산하지 않고 찍고, coordinator는 상세 장부 대신 요약 카드와 장부 도장을 넘긴다. 도장이 틀리면 어떤 상태 변경도 거절한다.

## Code

- `scripts/src/lib/verification.ts` — evidence v2 identity, scope, 성공 reuse와 G13 lineage
- `scripts/src/lib/coordinator.ts` / `runtime-state.ts` / `cli-git-commands.ts` — compact checkpoint, `--ledger-path`/`--ledger-hash` fence, 완료 task summary
- `agents/bouncer-coordinator.md`, `skills/bouncer-run/SKILL.md` — checkpoint-only Ground/Drive, mutation에 hash 전달, 완료 detail 비주입
- 통합 HEAD `7c76c5a6`에서 TASKS-004가 `npm run ci`로 종단 검증

Drive 실제 경로: 001→002→003→004 직렬. 001은 native-profile fixture와 Touch 정합을 위해 scope_revision r1/r2, 002는 native-profile CLI fence로 r3. Worker SHA는 001 `cc0fc52f`, 002 `d0afa47a`, 003 `5c2e561e`이며 integration head는 `7c76c5a6`.

## Quiz

질문 수: 3 (full-scale 직렬 3 commit + terminal verify).

1. 성공 검증 재사용(hit)이 되려면?
   - A) command만 같고 exit가 0이면 충분하다
   - B) HEAD·dirty·command·cwd·environment·scope가 같은 성공 evidence가 있어야 한다
   - C) 같은 blueprint면 scope가 달라도 재사용한다

2. `coordinate status`의 compact checkpoint가 숨기는 것은?
   - A) ready wave와 integration head
   - B) 완료 task의 full dispatch/decision 본문
   - C) ledger path와 sha256 참조

3. mutation의 ledger hash가 stale이면?
   - A) 로컬에서 hash를 재계산해 같은 요청을 다시 보낸다
   - B) status를 다시 조회해 새 path/hash로 재시도한다
   - C) hash 검사 전에 원장을 먼저 쓴다

## 이해 상태

- 정답: 1B, 2B, 3B
- 응답: 1B, 2B, 3B
- 채점: 3/3 전부 정답
- disposition: evidence identity·checkpoint 축소·stale hash 재시도 경로를 이해함
- recorded_at: 2026-09-21T15:15:24+09:00
- range: develop..7c76c5a6502649913ca0e748f0b9221f68a4e0c5
- diff_sha: fe0d65cb1daaff03935e164e67158c1f95bc3449e02702e74889e2f072d59c2a

## Tasks

### Task 001

#### Goal & intent

검증 입력과 범위를 내용 주소화하고, 완전히 같은 성공 evidence가 있을 때만 process spawn을 생략한다. 신규 실행과 재사용 모두 현재 `verification.md`와 하네스 원장을 갱신해 G13이 같은 신뢰 경계를 적용하게 한다.

#### Current behavior

- `scripts/src/lib/verification.ts:508`의 `runVerification`은 호출마다 `executeVerify`를 실행하고 `{ ok, command, exitCode }`만 반환한다. `test/verification-runner.test.js`에서 주입한 `exec` call count로 재현할 수 있다.
- `scripts/src/lib/verification.ts:471,495`는 verification 문서와 path-keyed 단일 JSON 원장을 직접 쓴다. 레코드는 command, ran_at, exit_code, output_sha만 가져 실행 입력이나 scope를 판별하지 못한다.
- `scripts/src/lib/runtime-state.ts:729`의 `verifyLedgerPathFor`는 verification 문서 상대경로만 해시하므로 같은 문서의 이전 실행을 덮어쓴다.
- `scripts/src/lib/validate-gates.ts:336`의 `checkG13`은 문서와 원장의 command, ran_at, exit_code, output hash만 비교한다.
- 기준 명령은 `node --test test/verification-runner.test.js test/validate-gates.test.js test/runtime-state.test.js`이며 현재 reuse hit 개념과 scope 구분 assertion은 없다.

#### Target behavior

- 성공: 같은 identity와 scope의 `exit_code: 0` 레코드는 `exec`를 호출하지 않고 원본 output hash·실행 시각을 참조하는 재사용 증적을 기록한다.
- 실패: HEAD, dirty content, command, cwd, environment hash, scope kind/key 중 하나라도 다르거나 레코드가 손상·실패·중단 상태면 cache miss로 실행한다. identity 계산 자체가 실패하면 검증을 실행해 우회하지 않고 전용 오류로 중단한다.
- 보존: 기존 단일 argv·allowlist·출력 상한·실패 본문 노출과 non-Git fail-closed 동작을 유지한다. 기존 v1 원장은 읽을 수 있어도 reuse hit로 인정하지 않는다.

#### Interface

- 제공: `runVerification({ repoRoot, blueprintDir, scope?, exec?, now?, deps? })`의 `scope`는 `{ kind: 'task' | 'wave' | 'terminal', key: string }`이고 반환값은 `{ ok, command, exitCode, evidenceId, reused, reusedFrom? }`이다. 생략 시 active pointer의 stable Task ID로 task scope를 만든다. `deps`는 call-count와 오류 회귀를 위해 `git(args)`, `readFile(path)`, `platform`, `arch`, `nodeVersion`을 주입한다.
- 제공: evidence v2는 `evidence_id`, `identity`, `scope`, `reused`, 선택적 `reused_from`, `ran_at`, `exit_code`, `output_sha`를 가진다. dirty digest는 `git status --porcelain=v1 -z` 항목과 각 dirty path의 type·content SHA-256을 정렬한 canonical JSON hash다.
- 제공: environment hash는 `{ platform, arch, node_version, verify_config_hash }`의 canonical JSON hash이며 config 부재는 고정 sentinel로 구분한다. cwd는 repo root 기준 POSIX 상대경로이며 현재 runner에서는 `.`이다.
- 즉시 거부: scope shape 오류, 빈 key, Git 조회 실패, dirty path가 저장소 밖을 가리킴, config/dirty 파일 읽기 실패는 evidence identity 오류다.
- cache miss: 원장 부재, v1 레코드, 실패 exit code, 필드 누락, identity 불일치, scope 불일치는 정상 miss이며 실제 명령을 한 번 실행한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/verification.ts` | `runVerification`, `recordVerificationResult` | Modify | 검증 명령 실행과 문서·원장 기록 | identity 계산, 성공 hit 판정, reuse 반환·기록 | process spawn과 증적 쓰기를 함께 소유하는 진입점임 |
| `scripts/lib/verification.js` | generated verification runtime | Modify | 배포 CommonJS | TypeScript 변경을 byte-identical emit으로 반영 | 설치본이 직접 실행하는 산출물임 |
| `scripts/src/lib/runtime-state.ts` | `verifyLedgerPathFor` | Modify | Git common dir의 verify 원장 경로 계산 | v2 evidence 조회·기록 경로와 legacy miss 경계를 제공 | linked worktree가 공유하는 런타임 경로 정본임 |
| `scripts/lib/runtime-state.js` | generated runtime-state | Modify | 배포 CommonJS | TypeScript 변경을 emit으로 반영 | 배포 경로의 동작 일치를 보장함 |
| `scripts/src/lib/validate-gates.ts` | `defaultReadVerifyLedger`, `checkG13` | Modify | G13 문서·원장 대조 | v2 identity, scope, reuse lineage와 output hash를 대조 | 손기록 증적으로 gate를 우회하지 못하게 하는 판정점임 |
| `scripts/lib/validate-gates.js` | generated gate runtime | Modify | 배포 CommonJS | TypeScript 변경을 emit으로 반영 | CLI gate가 로드하는 산출물임 |
| `test/verification-runner.test.js` | verification runner cases | Modify | 실행·기록 회귀 | hit/miss, scope 격리, identity 오류와 exec call count를 검증 | reuse의 주 행동 회귀임 |
| `test/cli-verify.test.js` | verify CLI cases | Modify | 공개 verify 명령 회귀 | pointer에서 task scope를 유도하고 v2 evidence를 출력·기록하는지 검증 | 사용자 진입점의 default scope를 고정함 |
| `test/validate-gates.test.js` | G13 cases | Modify | gate 증적 회귀 | 신규 실행·재사용·lineage 변조 판정을 검증 | gate 신뢰 경계를 고정함 |
| `test/runtime-state.test.js` | verify ledger path cases | Modify | common-dir 경로 회귀 | legacy와 v2 evidence 경로·linked worktree 동작을 검증 | 런타임 저장 경계 회귀임 |
| `test/native-profile-e2e.test.js` | execute validation fixture | Modify | legacy execute e2e | unborn HEAD fixture commits so identity can succeed and configured command reruns | scope_revision r2 for identity fail-closed vs e2e |

#### Constraints

- 재사용은 성공 결과에만 적용하며 failure output이나 signal 종료를 성공으로 승격하지 않는다.
- `verification.md`는 계속 하네스만 쓰고 G13 번호와 기존 body heading을 유지한다.
- canonical JSON은 key 정렬과 UTF-8 SHA-256을 사용하며 절대 worktree 경로를 identity에 넣지 않는다.
- TypeScript가 정본이고 생성 CommonJS는 `npm run build` 결과와 일치해야 한다.

### Task 002

#### Goal & intent

`coordinate status`가 완료 task와 활성 task를 구분한 bounded checkpoint만 반환하게 한다. 상세 원장은 그대로 보존하고 status가 반환한 byte hash를 모든 후속 mutation의 fencing token으로 사용한다.

#### Current behavior

- `scripts/src/lib/coordinator.ts:628`은 매 명령마다 전체 `.bouncer/runtime/coordinator.json`을 읽고, `status`는 `tasks`와 `decisions` 전체를 그대로 반환한다(`:651-653`). 완료 task의 dispatch summary와 과거 decision도 계속 응답에 남는다.
- 같은 모듈의 mutation 경로는 원장 내용을 읽은 뒤 `atomicWrite`하지만 caller가 어떤 revision을 읽었는지 증명하는 hash를 받지 않는다.
- `scripts/src/lib/runtime-state.ts:249`의 `validateCoordinatorLedger`는 repair, partial-close, dispatch shape를 검사하지만 compact checkpoint shape나 ledger reference를 검사하지 않는다.
- `test/coordinator.test.js`와 `test/cli-coordinate.test.js`에서 현재 full status payload와 mutation 동작을 재현할 수 있다.

#### Target behavior

- 성공: status는 ready wave, open task 상태, unresolved decision, 최근 failure, integration head/revision과 완료 task summary만 반환하며 상세 원장 `{ path, sha256, revision }`을 함께 제공한다.
- 성공: status에서 받은 `ledger_hash`를 전달한 mutation만 현재 원장 hash가 같을 때 실행된다. mutation 후 새 hash와 checkpoint를 반환해 다음 호출의 token이 된다.
- 실패: hash 누락·형식 오류·불일치, integration worktree 밖 ledger ref, 요약 필수값 누락은 쓰기 전에 거절한다.
- 보존: coordinator.json의 full tasks, decisions, repairWaves, terminalFailure와 dispatch 기록은 삭제·축약하지 않는다. `bootstrap`, read-only `status`, `release`의 기존 cwd 경계와 legacy ledger 읽기는 유지한다.

#### Interface

- 제공: `coordinate status` 결과의 `checkpoint`는 `{ ready, active_tasks, completed_tasks, unresolved_decisions, recent_failure, integration_head, revision, ledger: { path, sha256, revision } }`다.
- 제공: 완료 task summary는 `{ id, status, attempt, commit_sha, changed_paths, scope_revision, verify_evidence_id, review_evidence_id, advisory }`이며 없는 선택 값은 생략한다. active task는 다음 dispatch/fan-in에 필요한 current scope, dependency, branch/worktree, dispatch metadata만 가진다.
- 제공: CLI mutation(`prepare`, `dispatch`, `report`, `record`, `rerecord`, `revise`, `critical-recovery`, `repair`, `integrate`, `partial-close`, `release`)은 `--ledger-path <integration-relative-path>`와 `--ledger-hash <64-hex>`를 한 쌍으로 받고 core의 `ledgerPath`·`ledgerHash`로 전달한다. 각 성공 결과는 갱신된 checkpoint와 다음 path/hash를 반환한다.
- 즉시 거부: mutation의 path/hash 부재, 절대·escaping path, 비 64-hex hash, path가 해당 integration worktree의 `.bouncer/runtime/coordinator.json`과 다름, 현재 원장 byte hash 불일치는 `stale-ledger-checkpoint` 또는 `ledger-checkpoint-invalid`다.
- 보존 예외: `bootstrap`은 원장을 만들기 전이므로 path/hash가 없고, `status`는 read-only라 입력을 요구하지 않는다. main plan 사본을 변경하는 `release`는 예외가 아니다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `coordinate`, 신규 추출 지점: checkpoint projection | Modify | DAG 상태 전이와 원장 쓰기 | compact status, 완료 summary, mutation hash fence와 다음 checkpoint 반환 | full payload와 모든 mutation이 만나는 core임 |
| `scripts/lib/coordinator.js` | generated coordinator runtime | Modify | 배포 CommonJS | TypeScript 변경을 emit으로 반영 | 공개 CLI가 직접 로드함 |
| `scripts/src/lib/runtime-state.ts` | `validateCoordinatorLedger`, 신규 추출 지점: checkpoint validation | Modify | coordinator 원장 불변조건 | checkpoint/ref shape와 완료 summary 불변조건 검사 | 재개가 신뢰하는 런타임 상태 판정점임 |
| `scripts/lib/runtime-state.js` | generated runtime-state | Modify | 배포 CommonJS | TypeScript 변경을 emit으로 반영 | 배포 경로의 shape 판정을 맞춤 |
| `scripts/src/lib/cli-git-commands.ts` | coordinate flag parser/usage | Modify | coordinate CLI 인자와 JSON 출력 | `--ledger-path`·`--ledger-hash` 쌍을 mutation에 강제하고 checkpoint를 출력 | public CLI 경계임 |
| `scripts/lib/cli-git-commands.js` | generated CLI runtime | Modify | 배포 CommonJS | TypeScript 변경을 emit으로 반영 | 설치본 CLI가 실행함 |
| `test/coordinator.test.js` | coordinate state cases | Modify | core 상태 전이 회귀 | projection, summary, hash mismatch, 무쓰기 판정을 검증 | checkpoint core의 주 회귀임 |
| `test/coordinator-e2e.test.js` | resume/fan-in cases | Modify | worktree 종단 회귀 | checkpoint만으로 resume와 다음 fan-in이 가능한지 검증 | 실제 원장·Git 경계를 확인함 |
| `test/cli-coordinate.test.js` | coordinate CLI cases | Modify | 공개 명령 회귀 | hash flag 필수·전달·새 hash 출력과 usage를 검증 | 사용자 표면을 고정함 |
| `test/runtime-state.test.js` | ledger validation cases | Modify | runtime shape 회귀 | 완료 summary와 잘못된 ref/hash를 거절 | fail-closed schema 회귀임 |
| `test/cli-commit.test.js` | coordinator commit fixture | Modify | worker record 뒤 commit 회귀 | status hash를 mutation 호출에 전달 | 공유 coordinate 호출 shape를 구성함 |
| `test/cli-current.test.js` | coordinator pointer fixture | Modify | worker pointer 회귀 | checkpoint hash를 사용해 준비 상태를 만듦 | 공유 coordinate 호출 shape를 구성함 |
| `test/cli-validate.test.js` | coordinator validation fixture | Modify | coordinator execute gate 회귀 | mutation hash를 전달해 기존 판정을 유지 | 공유 coordinate 호출 shape를 구성함 |
| `test/commit-hook.test.js` | coordinator hook fixture | Modify | worker commit-safety 회귀 | hash-fenced 준비·record 호출로 fixture를 갱신 | 공유 coordinate 호출 shape를 구성함 |
| `test/commit-task.test.js` | coordinator task commit fixture | Modify | task commit 회귀 | 최신 checkpoint hash를 mutation마다 전달 | 공유 coordinate 호출 shape를 구성함 |
| `test/current.test.js` | coordinator current fixture | Modify | effective task 회귀 | hash-fenced prepare 결과를 사용 | 공유 coordinate 호출 shape를 구성함 |
| `test/finalize.test.js` | coordinator finalize fixture | Modify | integration finalize 회귀 | checkpoint hash를 거쳐 terminal 상태를 구성 | 공유 coordinate 호출 shape를 구성함 |
| `test/native-profile-e2e.test.js` | coordinator CLI lifecycle | Modify | native coordinate e2e | pass ledger fence flags after status | scope_revision after hash fence |

#### Constraints

- detailed ledger는 계속 감사 정본이며 checkpoint 생성 때문에 기존 기록을 삭제하거나 rewrite하지 않는다.
- unresolved decision, 최신 terminal failure, repair/partial-close 증적은 완료 summary로 숨기지 않는다.
- hash 비교와 모든 거절은 Git/worktree/file mutation보다 먼저 일어나야 한다.
- TypeScript 정본과 generated CommonJS를 같은 task에서 동기화한다.

### Task 003

#### Goal & intent

Coordinator 역할과 `/bouncer-run`이 compact status 결과만 활성 판단 입력으로 사용하게 한다. 상세 ledger는 감사·복구 시 경로와 hash로 확인하되 완료 task brief, report 본문과 과거 대화를 worker 또는 coordinator payload에 다시 싣지 않는다.

#### Current behavior

- `agents/bouncer-coordinator.md:121`은 Ground 단계에서 blueprint, open task brief와 `coordinate status`를 읽게 하지만 status 자체가 full tasks/decisions를 반환한다. 문서는 mutation마다 fencing hash를 전달하는 계약이 없다.
- `skills/bouncer-run/SKILL.md:113`은 ledger 경로를 coordinator payload에 넘기며 compact checkpoint나 ledger hash 소비 규칙을 명시하지 않는다.
- `.codex/agents/bouncer-coordinator.toml`은 agent Markdown의 배포 사본이므로 원본만 고치면 native profile이 이전 계약을 실행한다.
- `test/agents.test.js`, `test/skill-bouncer-run.test.js`, `test/distribution.test.js`가 역할·workflow·배포 동기화를 검사한다.

#### Target behavior

- 성공: coordinator는 Ground에서 status checkpoint를 받고 open task만 읽으며, 반환된 ledger hash를 다음 mutation에 전달하고 성공 응답의 새 hash로 교체한다.
- 성공: 완료 task는 checkpoint summary만 활성 context에 남고 상세 결정이 필요할 때만 hash가 일치하는 ledger 경로의 해당 record를 좁혀 읽는다.
- 실패: status/ref hash 불일치, mutation의 stale hash, summary로 해결할 수 없는 missing detail은 임의 재구성하지 않고 CLI 거절 사유와 복구 행동을 보고한다.
- 보존: worker dispatch에는 여전히 현재 task brief와 다섯 metadata만 전달한다. 다른 task brief, 과거 report 본문, 전체 ledger, 과거 대화는 전달하지 않는다.

#### Interface

- 제공: coordinator Ground/Drive 절은 `{ checkpoint: { ..., ledger: { path, sha256, revision } } }`를 활성 상태 입력으로 명명하고, 모든 mutation 예시에 `--ledger-path <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>`를 포함한다.
- 제공: 완료 task detail을 다시 열 수 있는 경우는 partial-close/final report의 감사 필드가 checkpoint에 없을 때뿐이며, path가 integration worktree의 `.bouncer/runtime/coordinator.json`인지와 byte hash가 같은지 먼저 확인한다.
- 거부: raw ledger 전체, 완료 task 문서, prior worker report body, past conversation을 coordinator/worker dispatch payload에 추가하지 않는다. hash mismatch는 재시도용 추측이나 hash 재계산으로 덮지 않고 status 재조회부터 시작한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | Decision inputs, Procedure, Output contract | Modify | coordinator 역할 계약 | checkpoint-only grounding, hash 전달과 bounded detail read를 명시 | 실제 역할 행동의 정본임 |
| `.codex/agents/bouncer-coordinator.toml` | generated developer prompt | Modify | Codex native agent 배포 | Markdown 역할 계약과 동기화 | Codex가 직접 소비하는 산출물임 |
| `skills/bouncer-run/SKILL.md` | Coordinator dispatch/report | Modify | root run의 위임 payload | 초기 checkpoint/ref 전달과 완료 detail 비주입을 고정 | coordinator 진입 경계임 |
| `bouncer-roadmap.md` | P2.3/P2.4 contract | Modify | 제품 순서와 확정 결정 | 구현된 계약·검증 증거를 완료 시점에 정확히 반영 | 이 작업의 출발점과 후속 경계를 유지함 |
| `test/agents.test.js` | coordinator prompt assertions | Modify | 역할 계약 회귀 | checkpoint/hash 및 금지 payload 문구를 고정 | source agent drift를 막음 |
| `test/skill-bouncer-run.test.js` | run skill assertions | Modify | workflow 계약 회귀 | compact payload와 detail 비주입을 검사 | entry skill drift를 막음 |
| `test/distribution.test.js` | agent distribution parity | Modify | Markdown/TOML 동기화 회귀 | 생성 profile이 새 계약과 같은지 검사 | host별 배포 차이를 막음 |

#### Constraints

- ledger와 worker report는 계속 trust-boundary의 data이며 status나 hash가 승인·gate 결정을 대신하지 않는다.
- prompt가 runtime enum, summary projection 알고리즘 또는 hash 계산 절차를 중복 소유하지 않는다. CLI가 반환한 필드 이름과 전달 순서만 적는다.
- 로드맵 완료 표기는 실제 focused test와 최종 CI가 통과한 뒤에만 작성한다.

### Task 004

#### Goal & intent

세 구현 task가 integration branch에 반영된 동일 HEAD에서 `npm run ci`를 한 번 실행해 generated emit, coverage, lint, typecheck와 audit을 함께 판정한다. 이 node는 source diff나 commit을 만들지 않고 하네스 verification evidence만 남긴다.

#### Current behavior

- 계획 승인 시점에는 P2.3/P2.4 구현이 없으므로 통합 HEAD에서 신규 계약을 증명한 CI evidence도 없다.
- coordinator의 verification node는 `ready → verifying → integrated`로 전이하며 `runVerification` 결과가 nonzero이면 integrated로 올리지 않는다.

#### Target behavior

- 성공: TASKS-001부터 TASKS-003까지 integrated된 HEAD에서 `npm run ci`가 exit code `0`으로 끝나고 하네스 소유 `verification.md`와 verify ledger에 증적이 남는다.
- 실패: nonzero, signal 종료, evidence identity 오류 또는 ledger 기록 실패는 node를 integrated로 만들지 않으며 기존 terminal repair 경로에 실패 정보를 넘긴다.
- 보존: source, test, agent, skill과 roadmap 파일을 이 node에서 수정하지 않는다.

#### Interface

- 제공: `bouncer.execution_kind: verification`, `depends_on: [TASKS-003]`, `verify: npm run ci`인 종단 fan-in node다.
- 거부: source 변경, review document, task commit SHA와 빈 dependency를 허용하지 않는다.

#### Touch

Source 변경 경로가 없다. 이 node는 integration HEAD를 검증하고 하네스 evidence만 기록한다.

#### Constraints

- 실행 cwd는 coordinator integration worktree의 repository root다.
- 실패 시 command, exit code와 bounded output을 기존 terminal recovery 계약대로 보존한다.
- 이 node의 `affected_paths`는 계속 빈 배열이어야 한다.