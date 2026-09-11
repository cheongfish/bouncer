---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/068-context-runtime-rearchitecture/blueprints/001-distill-removal-context-search-ci-recovery/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-11T09:04:08.977+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '068'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: bouncer/068-001-integration
      range_to: 1b3464aa2874d8cb227e7a26bb3f2d76cd476f7e
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: 4/4
      disposition: 사용자가 전체 통합 변경과 deferred 후속 조건을 이해함
      recorded_at: '2026-09-11T09:11:29+09:00'
  task_commits:
    - id: '001'
      sha: '85261196'
    - id: '002'
      sha: 6015dd75
    - id: '003'
      sha: 93e0e21e
    - id: '004'
      sha: 90b5c25f
    - id: '005'
      sha: 6101c9f9
    - id: '006'
      sha: 5b8fcb8d
    - id: '007'
      sha: b20db17d
    - id: '008'
      sha: f16a612b
  coordinator:
    base: f47f118675c961a37762a3a21dad6b7a57c3c590
    integration_head: 1b3464aa2874d8cb227e7a26bb3f2d76cd476f7e
    revision: r19
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/004
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/005
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/006
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/007
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/068/001/workers/008
    tasks:
      - id: '001'
        status: integrated
        sha: 8526119623745463581a524929b6d7f2761bcc21
        scope_revision: r1
        paths:
          - docs/distill-decommission-audit.md
          - test/distill-decommission-audit.test.js
          - docs/contributing.md
        actual_paths:
          - docs/contributing.md
          - docs/distill-decommission-audit.md
          - test/distill-decommission-audit.test.js
      - id: '002'
        status: integrated
        sha: 6015dd7572b08fd353e75fb84a82d2bd7af89012
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/lib/context-digest.js
          - scripts/lib/graph-search.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/context-digest.ts
          - scripts/src/lib/graph-search.ts
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - test/context-corpus-search.test.js
          - test/context-digest.test.js
          - test/fixtures/context-corpus-queries.json
          - test/graph-search.test.js
      - id: '003'
        status: integrated
        sha: 93e0e21ed4902fa355fa6981dbc37006e53c30c1
        scope_revision: null
        paths: []
        actual_paths:
          - package.json
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/lib/graphify.js
          - scripts/lib/init.js
          - scripts/lib/session-graph.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/graphify.ts
          - scripts/src/lib/init.ts
          - scripts/src/lib/session-graph.ts
          - test/cli-project-commands.test.js
          - test/distribution.test.js
          - test/graphify.test.js
          - test/init.test.js
          - test/session-graph.test.js
          - resources/graphify-compat.json
      - id: '004'
        status: integrated
        sha: 90b5c25f9a159354a0356e42075299fa4672ffe0
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/context-digest.js
          - scripts/lib/finalize.js
          - scripts/lib/graph-scope.js
          - scripts/lib/init.js
          - scripts/lib/paths.js
          - scripts/lib/scope.js
          - scripts/lib/seed-worktree.js
          - scripts/lib/session-graph.js
          - scripts/lib/tasks-docs.js
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/src/lib/context-digest.ts
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/graph-scope.ts
          - scripts/src/lib/init.ts
          - scripts/src/lib/paths.ts
          - scripts/src/lib/scope.ts
          - scripts/src/lib/seed-worktree.ts
          - scripts/src/lib/session-graph.ts
          - scripts/src/lib/tasks-docs.ts
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - test/commit-guard.test.js
          - test/commit-task.test.js
          - test/context-digest.test.js
          - test/finalize-pure.test.js
          - test/finalize.test.js
          - test/graphify.test.js
          - test/init.test.js
          - test/seed-worktree.test.js
          - test/session-graph.test.js
          - test/validate-gates.test.js
      - id: '005'
        status: integrated
        sha: 6101c9f928c88c3bc1f3ddfb3f994288b85b0c04
        scope_revision: r3
        paths:
          - scripts/src/lib/distill.ts
          - scripts/lib/distill.js
          - scripts/src/lib/layout.ts
          - scripts/lib/layout.js
          - scripts/src/lib/config.ts
          - scripts/lib/config.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate.ts
          - scripts/lib/validate.js
          - config.example.json
          - test/distill.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/validate-structural.test.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        actual_paths:
          - config.example.json
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/lib/commit.js
          - scripts/lib/config.js
          - scripts/lib/distill.js
          - scripts/lib/layout.js
          - scripts/lib/validate-structural.js
          - scripts/lib/validate.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/commit.ts
          - scripts/src/lib/config.ts
          - scripts/src/lib/distill.ts
          - scripts/src/lib/layout.ts
          - scripts/src/lib/validate-structural.ts
          - scripts/src/lib/validate.ts
          - test/cli-commit.test.js
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - test/distill.test.js
          - test/validate-structural.test.js
      - id: '006'
        status: integrated
        sha: 5b8fcb8d4bb99aaa5446708e7f45f56d32195c19
        scope_revision: r8
        paths:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
          - scripts/src/lib/finalize.ts
          - scripts/lib/finalize.js
          - test/finalize.test.js
        actual_paths:
          - references/spec-authoring/index.md
          - rules/governance.md
          - rules/okf.md
          - scripts/lib/cli-doc-commands.js
          - scripts/lib/commit-guard.js
          - scripts/lib/commit.js
          - scripts/lib/coordinator.js
          - scripts/lib/current.js
          - scripts/lib/finalize.js
          - scripts/lib/scaffold.js
          - scripts/lib/schema.js
          - scripts/lib/tasks-docs.js
          - scripts/lib/templates.js
          - scripts/lib/validate-docs.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-structural.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/src/lib/commit-guard.ts
          - scripts/src/lib/commit.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/current.ts
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/scaffold.ts
          - scripts/src/lib/schema.ts
          - scripts/src/lib/tasks-docs.ts
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-docs.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-structural.ts
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/commit-task.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/scaffold.test.js
          - test/schema.test.js
          - test/validate-gates.test.js
          - test/validate-structural.test.js
      - id: '007'
        status: integrated
        sha: b20db17d4e585c869440a8c3797fcce601316361
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - rules/governance.md
          - rules/output.md
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/current.js
          - scripts/lib/finalize.js
          - scripts/lib/runtime-state.js
          - scripts/lib/schema.js
          - scripts/lib/validate-gates.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/current.ts
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/schema.ts
          - scripts/src/lib/validate-gates.ts
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/finalize.test.js
          - test/runtime-state.test.js
          - test/schema.test.js
          - test/skill-bouncer-run.test.js
          - test/validate-gates.test.js
      - id: '008'
        status: integrated
        sha: f16a612b3db9db7b808e5fb40bc68d9568f13c9f
        scope_revision: r19
        paths:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - CLAUDE.md
          - README.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/compatibility.md
          - docs/configuration.md
          - docs/context-versioning.md
          - docs/contributing.md
          - docs/gates.md
          - docs/improvement-diagnosis.md
          - docs/troubleshooting.md
          - docs/workflow-contract.md
          - docs/workflow.md
          - package-lock.json
          - package.json
          - references/discovery/index.md
          - references/explain-diff/index.md
          - references/spec-authoring/index.md
          - references/stop-slop/index.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - scripts/lib/commit.js
          - scripts/lib/context-digest.js
          - scripts/lib/graph-scope.js
          - scripts/lib/graph-search.js
          - scripts/lib/init.js
          - scripts/lib/runtime-state.js
          - scripts/lib/scope.js
          - scripts/lib/seed-worktree.js
          - scripts/lib/session-graph.js
          - scripts/lib/validate-gates.js
          - scripts/src/lib/commit.ts
          - scripts/src/lib/context-digest.ts
          - scripts/src/lib/graph-scope.ts
          - scripts/src/lib/graph-search.ts
          - scripts/src/lib/init.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/scope.ts
          - scripts/src/lib/seed-worktree.ts
          - scripts/src/lib/session-graph.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/vendor/README.md
          - scripts/vendor/js-yaml.js
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-run/SKILL.md
          - test/ci-contract.test.js
          - test/cli-commit.test.js
          - test/context-corpus-search.test.js
          - test/distribution.test.js
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-minimality.test.js
          - test/skill-spec-authoring.test.js
          - test/trust-boundary.test.js
          - docs/context-search-benchmark.md
    decisions:
      - task: '001'
        kind: scope
        reason: F1 Distill lint:context-comments bullet is unmapped CI contract; Goal forbids obsolete; documenting it in contributing makes retain-context true without a migrate halt
        previous:
          - docs/distill-decommission-audit.md
          - test/distill-decommission-audit.test.js
        next:
          - docs/distill-decommission-audit.md
          - test/distill-decommission-audit.test.js
          - docs/contributing.md
        revision: r1
      - task: '001'
        decision: 'accepted TASKS-001 r1: docs/distill-decommission-audit.md, test/distill-decommission-audit.test.js, docs/contributing.md (F1 contributing lint:context-comments; F2/F4/F5 obsolete cites; F6 summary asserts; F3/F7/F8 accepted). worker SHA 8526119623745463581a524929b6d7f2761bcc21. implementer then reviewer then eslint-fix rework. migrate=0.'
      - task: '002'
        decision: 'accepted TASKS-002: scripts/src/lib/{context-digest,graph-search,cli-project-commands,cli}.ts + scripts/lib CJS + tests (corpus search, digest, graph-search, cli-project-commands, cli-help, fixtures). implementer then review r1-r3 then structural -5 per-doc rework. F-002-help-seed-repeat accepted. worker SHA 6015dd7572b08fd353e75fb84a82d2bd7af89012. migrate=0.'
      - task: '003'
        decision: 'accepted TASKS-003: resources/graphify-compat.json, package.json, scripts/src/lib/{graphify,init,session-graph,cli-project-commands,cli}.ts + CJS, five tests. implementer then review r1-r3. F003-6 accepted optional skill probe. worker SHA 93e0e21ed4902fa355fa6981dbc37006e53c30c1.'
      - task: '004'
        decision: 'accepted TASKS-004: init/finalize/digest/session-graph/graph-scope/scope/paths/seed-worktree/tasks-docs/templates/validate-gates ts+js + tests. F-004-1 accepted (skills/CLI Distill injection owned by 005/008). F-004-2/3 nits accepted. worker SHA 90b5c25f9a159354a0356e42075299fa4672ffe0.'
      - task: '005'
        kind: scope
        reason: TASKS-005 deletes tracked source and test files; bouncer commit --yes cannot stage allowed deletions because its pathspec staging rejects absent paths. Commit staging must accept tracked deletions for this task bundle.
        previous:
          - scripts/src/lib/distill.ts
          - scripts/lib/distill.js
          - scripts/src/lib/layout.ts
          - scripts/lib/layout.js
          - scripts/src/lib/config.ts
          - scripts/lib/config.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate.ts
          - scripts/lib/validate.js
          - config.example.json
          - test/distill.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/validate-structural.test.js
        next:
          - scripts/src/lib/distill.ts
          - scripts/lib/distill.js
          - scripts/src/lib/layout.ts
          - scripts/lib/layout.js
          - scripts/src/lib/config.ts
          - scripts/lib/config.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate.ts
          - scripts/lib/validate.js
          - config.example.json
          - test/distill.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/validate-structural.test.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
        revision: r2
      - task: '005'
        kind: scope
        reason: 'Review finding 005-R3-1: the new real commit deletion staging path needs an end-to-end regression test; existing commit test bypasses the git add -A branch.'
        previous:
          - scripts/src/lib/distill.ts
          - scripts/lib/distill.js
          - scripts/src/lib/layout.ts
          - scripts/lib/layout.js
          - scripts/src/lib/config.ts
          - scripts/lib/config.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate.ts
          - scripts/lib/validate.js
          - config.example.json
          - test/distill.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/validate-structural.test.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
        next:
          - scripts/src/lib/distill.ts
          - scripts/lib/distill.js
          - scripts/src/lib/layout.ts
          - scripts/lib/layout.js
          - scripts/src/lib/config.ts
          - scripts/lib/config.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli.ts
          - scripts/lib/cli.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate.ts
          - scripts/lib/validate.js
          - config.example.json
          - test/distill.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/validate-structural.test.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        revision: r3
      - task: '005'
        decision: 'accepted TASKS-005 r3: Distill public contract removal plus commit staging correction. Clean-index tracked deletion and mixed staged/unstaged file regressions pass; reviewer blocker fixed without reopening a review round. paths: scripts/lib/commit.js, scripts/src/lib/commit.ts, scripts/src/lib/validate-structural.ts, test/cli-commit.test.js; ancestry includes bb4cfaa7 deletion bundle.'
      - task: '005'
        kind: rerecord
        reason: Accidental two-commit TASKS-005 result was squashed onto integration HEAD; preserve the deletion-safe staging fix in one task commit.
        previousSha: d481e4960d777213dd931a14129eba72c8fe23eb
        nextSha: 6101c9f928c88c3bc1f3ddfb3f994288b85b0c04
        integrationHead: 6b6d8dbb795fd0cceedd8012e5252ebd27cf8d68
      - task: '006'
        kind: scope
        reason: 'Review round 2 findings TASKS-006-R2 and TASKS-006-R5: the promised verification scaffold must be reachable through the public scaffold CLI, and verification task bundles must represent the absent review leaf without aliasing verification.md.'
        previous:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
        next:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        revision: r4
      - task: '006'
        kind: scope
        reason: Final review round 3 confirms TASKS-006-R5 and TASKS-006-R6 remain current-task accuracy findings within r4 scope. Retain the same paths, stop without commit or integration at the review ceiling, and resume with a human decision on re-planning or an authorized recovery workflow.
        previous:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        next:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        revision: r5
      - task: '006'
        kind: scope
        reason: User explicitly authorized one fresh TASKS-006 recovery cycle for final-review findings R5 and R6. Retain the r5 scope unchanged; fix only synthetic review-leaf resolution and repository verify-policy scaffold validation, then run one authoritative verify and fresh review.
        previous:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        next:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        revision: r6
      - task: '006'
        kind: scope
        reason: 'User-authorized R5/R6 recovery resolved both findings, but fresh review found TASKS-006-R7: finalize dereferences the absent verification review leaf. Retain r6 scope unchanged and stop; fixing R7 requires finalize source and test paths outside the exact recovery authorization.'
        previous:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        next:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        revision: r7
      - task: '006'
        kind: scope
        reason: User explicitly authorized one focused TASKS-006 R7 recovery. Add exactly finalize.ts, emitted finalize.js, and test/finalize.test.js so transient cleanup handles verification nodes with no review leaf; then require complete verification, focused review, and execute-gate acceptance.
        previous:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
        next:
          - scripts/src/lib/schema.ts
          - scripts/lib/schema.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - scripts/src/lib/scaffold.ts
          - scripts/lib/scaffold.js
          - scripts/src/lib/validate-structural.ts
          - scripts/lib/validate-structural.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/tasks-docs.ts
          - scripts/lib/tasks-docs.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/current.ts
          - scripts/lib/current.js
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - scripts/src/lib/commit-guard.ts
          - scripts/lib/commit-guard.js
          - rules/governance.md
          - rules/okf.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/schema.test.js
          - test/scaffold.test.js
          - test/validate-structural.test.js
          - test/validate-gates.test.js
          - test/coordinator.test.js
          - test/current.test.js
          - test/commit-task.test.js
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/lib/cli-doc-commands.js
          - scripts/src/lib/validate-docs.ts
          - scripts/lib/validate-docs.js
          - scripts/src/lib/finalize.ts
          - scripts/lib/finalize.js
          - test/finalize.test.js
        revision: r8
      - task: '006'
        decision: 'accepted TASKS-006 r8 after user-authorized R5/R6/R7 recoveries: execution_kind verification lifecycle, public scaffold policy, absent review resolution, finalize optional-review handling, and commit-hook lint all passed. exact verify 289/289; review R1-R7 resolved. actual paths: references/spec-authoring/index.md, rules/governance.md, rules/okf.md, scripts/src/lib/{cli-doc-commands,commit-guard,commit,coordinator,current,finalize,scaffold,schema,tasks-docs,templates,validate-docs,validate-gates,validate-structural}.ts plus emitted scripts/lib JS, skills/bouncer-{plan,run}/SKILL.md, test/{commit-task,coordinator,current,finalize,scaffold,schema,validate-gates,validate-structural}.test.js. worker SHA 5b8fcb8d4bb99aaa5446708e7f45f56d32195c19.'
      - task: '007'
        decision: 'accepted TASKS-007: bounded two-wave repair, atomic rollback, strict evidence/scope validation, partial_closed preservation and three-way output, plus durable coordinate rerecord ported from read-only main provenance. exact verify 280/280; review F001-F005 resolved. actual paths: .codex/agents/bouncer-coordinator.toml, agents/bouncer-coordinator.md, rules/{governance,output}.md, scripts/src/lib/{cli-git-commands,coordinator,current,finalize,runtime-state,schema,validate-gates}.ts plus emitted JS, skills/bouncer-{finalize,run}/SKILL.md, and ten scoped tests. worker SHA b20db17d4e585c869440a8c3797fcce601316361.'
      - task: '008'
        kind: scope
        reason: Terminal npm audit fails on direct and vendored js-yaml 4.3.1 (GHSA-2883-xcg3-v3hh). Add the minimum atomic five-file security repair. Coordinator revisions cannot name .bouncer governance paths, so tracked Distill master/shard deletions remain finalize-owned remainder rather than source-scope entries; graphify-out and historical context stay excluded.
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - .bouncer/Distill.md
          - .bouncer/distill/build-ts.md
          - .bouncer/distill/context-layout.md
          - .bouncer/distill/core.md
          - .bouncer/distill/git-worktree.md
          - .bouncer/distill/graph.md
          - .bouncer/distill/plugin-skills.md
          - .bouncer/distill/validate-gates.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
        next:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
        revision: r9
      - task: '008'
        kind: scope
        reason: 'Review finding TASKS-008-R3: the active leftover gate must cover executable source, and nine TS/CJS pairs still contain stale runtime wording or legacy distill-kind compatibility branches. Add exactly those pairs for removal or explicit narrowly justified compatibility classification; tests remain in existing scope.'
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
        next:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        revision: r10
      - task: '008'
        kind: scope
        reason: 'Review round 2 resolves TASKS-008-R2/R3/R4 but TASKS-008-R1 remains major: live metrics use a hand-authored synthetic graph rather than the persisted or reproducibly generated Graphify 0.8.22 artifact named by benchmark metadata. The review ceiling forbids round 3 while a previous major remains; preserve r10 scope and stop without commit or integration for a human-authorized recovery.'
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        next:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        revision: r11
      - task: '008'
        kind: scope
        reason: 'G11 probe: reconcile affected_paths and Touch justification for inherited r11 paths'
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        next:
          - package.json
        revision: r12
      - task: '008'
        kind: scope
        reason: 'Coordinator correction: r12 probe replaced the preserved r11 scope while diagnosing G11. Restore the complete previously recorded TASKS-008 scope; add missing Touch justifications separately before executing the gate.'
        previous:
          - package.json
        next:
          - package.json
        revision: r13
      - task: '008'
        kind: scope
        reason: 'Coordinator correction: restore the exact r11 repository-source scope accidentally replaced by the r12 diagnostic probe; task governance paths remain excluded from scope.'
        previous:
          - package.json
        next:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        revision: r14
      - task: '008'
        kind: scope
        reason: 'User-directed decision for TASKS-008-R1: defer the unresolved Graphify benchmark provenance finding to a future task. It is not resolved. Recovery requires both retrieval methods to consume one persisted or reproducibly generated Graphify 0.8.22 graph whose bytes, SHA, and CLI version match benchmark metadata. Preserve the current source scope.'
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        next:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        revision: r15
      - task: '008'
        kind: scope
        reason: 'Focused commit-gate repair: exclude finalize-owned tracked Distill/context remainder candidates from TASKS-008 task scope judgment and staging while retaining hard failure for every source or non-finalize-owned out-of-scope path.'
        previous:
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        next:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        revision: r16
      - task: '008'
        kind: scope
        reason: 'Repair r16 accidental replacement: restore the pre-existing TASKS-008 source scope and add only focused commit-gate implementation plus regression paths; no governance paths are added.'
        previous:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        next:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        revision: r17
      - task: '008'
        kind: scope
        reason: 'Correct r16/r17 scope replacement: restore the complete r15 TASKS-008 repository-source scope plus the three focused commit-gate repair paths. Governance remains excluded.'
        previous:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        next:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        revision: r18
      - task: '008'
        kind: scope
        reason: 'Correct r16/r17 scope replacement: restore the complete r15 TASKS-008 repository-source scope plus the three focused commit-gate repair paths. Governance remains excluded.'
        previous:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
        next:
          - scripts/src/lib/commit.ts
          - scripts/lib/commit.js
          - test/cli-commit.test.js
          - test/fixtures/context-corpus-queries.json
          - test/fixtures/graph-search-quality.json
          - test/context-corpus-search.test.js
          - test/graph-search.test.js
          - docs/context-search-benchmark.md
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/configuration.md
          - docs/workflow.md
          - docs/workflow-contract.md
          - docs/gates.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/context-versioning.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - README.md
          - CLAUDE.md
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-debugger.md
          - rules/governance.md
          - rules/okf.md
          - rules/output.md
          - rules/plugin-root.md
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - references/graphify-runner/index.md
          - references/explain-diff/index.md
          - references/stop-slop/index.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-init/references/init-result.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/distill-preflight.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/distill-promotion.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - docs/compatibility.md
          - docs/contributing.md
          - docs/improvement-diagnosis.md
          - test/ci-contract.test.js
          - test/cli-validate.test.js
          - test/cli-current.test.js
          - test/cli-commit.test.js
          - test/migrate-task-layout.test.js
          - test/tasks-docs.test.js
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-stop-slop.test.js
          - test/skill-output-contract.test.js
          - test/trust-boundary.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-minimality.test.js
          - package.json
          - package-lock.json
          - scripts/vendor/js-yaml.js
          - scripts/vendor/README.md
          - test/distribution.test.js
          - scripts/src/lib/context-digest.ts
          - scripts/lib/context-digest.js
          - scripts/src/lib/graph-scope.ts
          - scripts/lib/graph-scope.js
          - scripts/src/lib/graph-search.ts
          - scripts/lib/graph-search.js
          - scripts/src/lib/init.ts
          - scripts/lib/init.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/scope.ts
          - scripts/lib/scope.js
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/session-graph.ts
          - scripts/lib/session-graph.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
        revision: r19
      - task: '008'
        decision: 'accepted TASKS-008 r19: focused task-commit boundary repair excludes only context workflow artifacts and tracked deleted finalize remainder from task safety/staging; source, modified/untracked legacy paths, and other out-of-scope files fail closed. Implementer recovery after check:emit and retired-token CI failures; reviewer rounds 1–3 resolved staged-index capture and exception-safe restoration. Full CI passed 1,235 tests; TASKS-008-R1 remains user-deferred, unresolved, and untouched. Actual committed paths are the task payload returned by bouncer commit; seven .bouncer/distill shard deletions remain finalize-owned remainder. Worker bouncer/068-001-task-008 SHA f16a612b3db9db7b808e5fb40bc68d9568f13c9f.'
---
# Explain

## Background
이 블루프린트는 `.bouncer/Distill.md`와 분할 shard를 런타임 정본으로 쓰던 구조를 제거하고, 버전이 고정된 Graphify와 컨텍스트 문서 검색으로 작업 근거를 찾도록 바꿨다. TASKS-001은 남겨야 할 계약을 감사 문서와 시험으로 고정했고, TASKS-002와 TASKS-003은 검색과 Graphify 호환성 확인을 CLI에 연결했다. TASKS-004부터 TASKS-006은 task bundle, coordinator, commit/finalize 경계를 새 문서 구조에 맞게 정비했다. TASKS-007은 커밋이 없는 종단 CI 노드를 검증했고, TASKS-008은 문서·검색 평가·CI 계약과 finalize-owned remainder의 분리를 마무리했다.

드라이브는 `f47f118`에서 시작해 `1b3464a`까지 여덟 task 결과를 통합했다. TASKS-001, 005, 006, 008은 리뷰나 경계 문제를 반영해 scope revision을 기록했다. TASKS-008의 R1은 Graphify 0.8.22 메타데이터와 실제 synthetic graph의 provenance가 아직 일치하지 않는다는 major finding이다. 사용자가 후속 task로 미뤘으며, 현재 task source scope와 커밋은 바꾸지 않았다.

## Intuition
Distill 장부를 들고 다니는 대신, 고정된 Graphify 지도와 컨텍스트 검색 색인을 열어 필요한 근거로 바로 간다.

## Code
검색 흐름은 `scripts/src/lib/context-digest.ts`, `scripts/src/lib/graph-search.ts`, `scripts/src/lib/cli-project-commands.ts`와 대응 CJS emit에서 읽는다. Graphify 호환성과 초기화 경계는 `scripts/src/lib/graphify.ts`, `scripts/src/lib/init.ts`, `resources/graphify-compat.json`에 있다. task 문서와 coordinator 상태는 `scripts/src/lib/{schema,scaffold,coordinator,current,tasks-docs}.ts` 및 `rules/{governance,okf}.md`가 정한다. Distill public surface 제거와 tracked deletion staging은 `scripts/src/lib/{distill,layout,config,commit}.ts`, `scripts/src/lib/validate-structural.ts`, `test/cli-commit.test.js`에서 확인한다.

최종 통합 검증은 `npm run ci`다. recovery 뒤 이 명령은 1,235개 시험, emit 검사, lint, 문서·context comment 검사, typecheck와 audit를 통과했다. TASKS-008 review는 worker `bouncer/068-001-task-008`의 `f16a612` 결과와 같은 증적을 복원했으며 R1은 deferred, R2–R4는 resolved 상태다.

## Quiz
1. Distill 런타임 소비자를 대체한 주된 검색 경로는 무엇인가?
   - A) Graphify 호환성 고정과 컨텍스트 문서 검색
   - B) 새로운 Distill shard 생성
   - C) Git commit message 검색

2. TASKS-008-R1의 현재 상태와 필요한 후속 조치는 무엇인가?
   - A) resolved이며 별도 조치가 없다
   - B) deferred이며 Graphify 0.8.22 graph의 bytes, SHA, CLI version을 benchmark metadata와 맞춘다
   - C) accepted이며 Distill shard를 다시 만든다

3. task source 변경과 finalization remainder를 안전하게 분리한 경계는 무엇인가?
   - A) context workflow artifact와 tracked deleted finalize remainder만 task staging에서 제외하고 다른 out-of-scope 경로는 fail closed 한다
   - B) 모든 `.bouncer` 경로를 task scope에 넣는다
   - C) CI가 끝난 뒤 task scope 검사를 끈다

4. 이 통합 checkout에서 recovery 뒤 실행한 전체 검증 명령은 무엇인가?
   - A) `npm audit --fix`
   - B) `bouncer distill --all --json`
   - C) `npm run ci`

## 이해 상태
정답은 A, B, A, C이고 사용자 응답도 A, B, A, C였다. 네 문항 모두 정답이며,
`quiz_score`는 4/4다. 사용자는 R1이 deferred 상태이고 동일한 Graphify 0.8.22
artifact의 bytes, SHA, CLI version을 benchmark metadata와 맞추는 후속 task가 남았음을 이해했다.

## Tasks

### Task 001

#### Goal & intent

현재 Distill master와 일곱 shard의 모든 `Invariants`·`Gotchas`·`Decisions` bullet을 canonical context 원문에 연결한다. 매핑이 없거나 의미가 충돌한 문장은 삭제 대상으로 넘기지 않는다.

#### Interface

- 제공: `docs/distill-decommission-audit.md`는 `source`, 원문 bullet, `canonical_path`, section, `disposition`(`retain-context`·`migrate`·`obsolete`)을 한 행에 기록하고 source별 개수와 미해결 수를 요약한다.
- 거부: canonical 경로·section·폐기 근거가 비었거나 한 bullet이 두 disposition을 가지면 감사 검사가 실패한다. `migrate` 항목이 하나라도 나오면 검증은 대상 경로와 bullet을 보고하고 실패하며, `/bouncer-plan`으로 돌아가 해당 canonical 문서 변경 task의 범위를 승인받기 전에는 후속 제거를 시작하지 않는다.

#### Do not touch

- `.bouncer/Distill.md` — 감사 입력은 이 task에서 바꾸거나 삭제하지 않는다.
- `.bouncer/distill/` — shard 원문은 감사가 승인되기 전까지 유지한다.
- `.bouncer/context/epics/007-project-distill/` — 폐기되는 결정을 포함한 선행 기록을 보존한다.
- `.bouncer/context/epics/060-graphify-search-quality/` — 검색 선행 기록을 보존한다.
- `.bouncer/context/epics/067-task-dag-coordinator/` — coordinator 선행 기록을 보존한다.

### Task 002

#### Goal & intent

context graph의 raw node traversal을 `decision`·`implementation`·`history` 목적별 문서 후보로 바꾼다. 정상 검색은 3–8개 후보를 반환하고, 넓거나 비어 있는 검색은 원인을 구분한 낮은 신뢰도로 끝난다.

#### Interface

- 제공: `bouncer context-search --mode <decision|implementation|history> --query <text> [--seed <value>] [--max-candidates <1..8>]`가 JSON으로 query id, 정규화 terms, seed, raw node 수, eligible 문서 수, 후보와 상태를 반환한다.
- 제공: `decision`은 epic/blueprint index와 `closed`·`partial_closed` explain, `implementation`은 task와 source/test 관계, `history`는 closed task와 explain을 검색한다. 후보는 원본 경로, 역할, tag·anchor, score, basis를 가진다.
- 거부: mode·상한이 잘못되면 종료 코드 2다. 일반어만 남은 입력과 8개를 넘는 동점군은 `low-confidence: broad-query`, 재시도 뒤에도 시작점이 없으면 `zero-hit`을 반환한다.

#### Do not touch

- `scripts/src/lib/graph-exec.ts` — Graphify process 실행 계약은 이 task에서 바꾸지 않는다.
- `scripts/src/lib/graphify.ts` — package 설치와 version 호환성은 TASKS-003이 맡는다.
- `.bouncer/context/epics/` — 검색 corpus 원문을 결과에 맞춰 소급 수정하지 않는다.

### Task 003

#### Goal & intent

plugin이 검증한 Graphify package·CLI·graph schema·Python 버전을 한 manifest에 고정하고 소비 저장소는 실제 설치·검증 결과만 lock에 기록한다. 검색과 graph sync는 호환성만 검사하며 설치 상태를 바꾸지 않는다.

#### Interface

- 제공: `resources/graphify-compat.json`은 `schema_version: 1`, package, exact `install_spec`, expected CLI version, graph schema version, minimum Python을 제공한다. 기준 설치값은 `graphifyy==0.9.56`이다.
- 제공: `.bouncer/graphify.lock.json`은 package·CLI·Bouncer·graph schema 버전, 설치 시각과 선택 executable을 기록한다. `bouncer init --upgrade-graphify`만 shared Git common-dir venv를 manifest 값으로 바꾸고 source·test·context graph를 재생성한다.
- 거부: lock·manifest·실행 결과가 다르면 `version-incompatible`을 반환한다. 일반 init, `context-search`, `graph-sync`, SessionStart는 pip·network·venv 쓰기를 하지 않는다.

#### Do not touch

- `scripts/vendor/` — Graphify package를 vendoring하지 않는다.
- `package-lock.json` — Python package version을 Node dependency lock에 넣지 않는다.
- `graphify-out/` — plan authoring 중 graph 산출물을 source로 커밋하지 않는다.

### Task 004

#### Goal & intent

init, plan·execute 입력 준비, commit scope, context graph freshness와 finalize가 Distill 없이 동작하게 한다. 필요한 과거 근거는 context-search가 선택한 원본 context 문서에서만 읽는다.

#### Interface

- 제공: init은 context bundle과 Graphify 상태만 만든다. plan·execute·run은 mode에 맞는 context-search 후보와 선택 원문을 전달하고 finalize는 explain·comprehension·PR·cleanup만 수행한다.
- 제공: context graph freshness는 `.bouncer/context/**` 원본과 검색 metadata만 비교한다. finalize remainder는 blueprint 문서와 필요한 비-Distill 산출물만 처리한다.
- 거부: Distill audit·promotion proposal·승격 ACQ·`distill --for` payload가 workflow나 runtime state에 남으면 contract test가 실패한다. 선택되지 않은 raw graph node dump도 agent 입력으로 넘기지 않는다.

#### Do not touch

- `scripts/src/lib/distill.ts` — public CLI·config 제거는 TASKS-005가 맡는다.
- `.bouncer/Distill.md` — 현재 self-hosted workflow가 task 실행 중 읽을 수 있으므로 TASKS-008 전까지 보존한다.
- `.bouncer/distill/` — current shard 입력은 TASKS-008 전까지 보존한다.
- `.bouncer/context/epics/` — 완료된 context history를 검색 전환에 맞춰 다시 쓰지 않는다.

### Task 005

#### Goal & intent

모든 consumer가 context-search를 사용하는 상태에서 Distill CLI, layout·config와 structural validation을 제거한다. 완료된 context 역사는 남기고 active workflow prose의 일괄 전환은 TASKS-008에서 leftover 검사와 함께 닫는다.

#### Interface

- 제공: 공개 CLI는 `context-search`와 graph compatibility만 제공하고 config·layout·structural validator에는 Distill field나 shard 경로가 없다.
- 거부: `bouncer distill`, `distill.max_bytes`, `distill.routing_enabled`, `PROJECT_DISTILL`과 shard metadata가 active source에 남으면 국소 검사가 실패한다.

#### Do not touch

- `.bouncer/Distill.md` — self-hosted 현재 cycle의 마지막 read가 끝나는 TASKS-008에서 삭제한다.
- `.bouncer/distill/` — 현재 cycle shard는 TASKS-008에서 삭제한다.
- `.bouncer/context/epics/` — 완료된 문서의 역사적 Distill 언급은 active contract가 아니다.
- `scripts/vendor/` — 외부 배포물은 이 계약과 무관하다.

### Task 006

#### Goal & intent

향후 plan이 모든 구현 leaf를 fan-in하는 verification-only node를 만들 수 있게 한다. 이 node는 전체 CI 증적만 남기고 source diff·reviewable commit·`affected_paths`를 만들지 않는다.

#### Interface

- 제공: task frontmatter `bouncer.execution_kind`는 `commit` 또는 `verification`이며 부재는 `commit`이다. `verification` node는 non-empty `depends_on`, `parallel_safe: false`, `dependency_gate: integrated`, executable `verify`를 요구한다.
- 제공: verification node는 ready → verifying → integrated 상태로 이동하고 `verification.md`에 command·exit·hash를 기록한다. commit·review·cherry-pick 단계는 만들지 않는다.
- 거부: verification node의 `affected_paths`가 비어 있지 않거나 Touch가 source 변경을 선언하거나 predecessor가 없거나 다른 verification node가 아닌 successor를 만들면 plan gate가 거절한다. 일반 commit task의 G3–G5·G10–G12는 그대로다.

#### Do not touch

- `scripts/src/lib/verification.ts` — 기존 command 실행·증적 writer를 재사용한다.
- `.gitmessage` — 일반 task commit 형식은 바꾸지 않는다.
- `hooks/commit-safety.js` — verification node는 commit 경로에 들어가지 않는다.

### Task 007

#### Goal & intent

종단 CI 실패를 coordinator가 최대 두 repair wave에서 복구하고 모든 task·edge·scope 변경을 ledger에 남긴다. 두 번째 wave 뒤에도 실패하면 자동 실행을 멈추고 사용자가 승인한 경우에만 `partial_closed`와 후속 계획 파일을 남긴다.

#### Interface

- 제공: coordinator decision은 실패 command·요약, 이전/다음 task DAG, 변경 scope, Blueprint 계약 안에서 필요한 이유를 기록한다. repair task는 당시 integrated leaf를 의존하고 terminal CI node가 새 repair task를 의존한다.
- 제공: partial-close gate는 두 wave 기록, 마지막 CI 실패 증적, untracked integration-root `NEXT_PLAN.md`, 사용자 확인을 모두 요구한다. 성공 결과는 `NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.`를 표시한다.
- 거부: 세 번째 자동 wave, 실패 증적 없는 partial close, 사용자 확인 없는 `partial_closed`, main worktree 복사·commit, 일반 `closed` 표시는 거절한다.

#### Do not touch

- `.git/` — coordinator는 repository metadata를 삭제하거나 범위로 추가하지 않는다.
- `.bouncer/context/` — runtime repair가 governance tree를 source scope로 추가하지 않는다.
- `hooks/commit-safety.js` — 기존 ledger scope enforcement를 약화하지 않는다.
- `agents/bouncer-implementer.md` — repair task의 scope·DAG 결정권은 coordinator에만 둔다.

### Task 008

#### Goal & intent

Q1–Q6과 기존 direct BFS를 같은 context graph에서 비교하고 검색 품질·주입 token·계획 시간을 기록한다. 현재 cycle이 legacy Distill을 마지막으로 읽은 뒤 tracked master·shard를 삭제하고 active leftover와 전체 CI를 검산한다.

#### Interface

- 제공: 평가 결과는 질의별 expected rank, Recall@8, MRR, broad-query false-positive rate, zero-hit diagnosis rate, 후보 중앙값과 planning retrieval tokens를 기계 판독 가능한 JSON과 읽기용 문서에 기록한다.
- 제공: tracked `.bouncer/Distill.md`와 `.bouncer/distill/*.md`는 self-hosted final legacy read가 끝난 뒤 삭제된다. 역사 context의 Distill 표현은 allowlist에 남는다.
- 거부: Q4·Q5에 임의 정답 후보를 넣거나 서로 다른 graph build·version으로 baseline을 비교하거나 active code·skills·docs에 Distill runtime token이 남으면 완료하지 않는다.

#### Do not touch

- `.bouncer/context/epics/` — 역사 문서의 Distill 언급과 완료 상태를 보존한다.
- `distill-removal-and-graphify-query-plan.md` — 사용자 제공 입력 문서는 구현 산출물이 아니다.
- `benchmark-plan.md` — 별도 사용자 작업을 덮어쓰지 않는다.
- `graphify-out/` — 생성 graph는 측정 입력이며 commit 대상이 아니다.
- `.codex/agents/bouncer-context-reviewer.toml` — 소비 저장소가 생성하는 ignored 사본이며 plugin 배포 정본은 같은 이름의 agent Markdown이다.
- `.codex/agents/bouncer-debugger.toml` — 소비 저장소가 생성하는 ignored 사본이며 plugin 배포 정본은 같은 이름의 agent Markdown이다.
