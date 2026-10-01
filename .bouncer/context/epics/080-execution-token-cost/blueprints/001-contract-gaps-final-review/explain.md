---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/080-execution-token-cost/blueprints/001-contract-gaps-final-review/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-01T11:34:48.864+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '080'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 637375ccdf6faf8b439e0f343bef444b6e16e282
      range_to: ecc5bc9ecee0980c4c3ed44a1ebbbd371ef85eae
      diff_sha: 35d1133c557c11f90d7aaa7d028e2ed396c43f36cba9e07ee475745a48fbbc10
      quiz_score: 3/6
      disposition: Q3·Q5·Q6 오답. 008은 009에 의존하고 009는 007에 의존한다. CI repair의 --task는 계속 required다. 003이 넣은 gate는 G21이다.
      recorded_at: '2026-10-01T11:40:00+09:00'
  task_commits:
    - task: EPIC-080/BP-001/TASK-001
      sha: 8f72ec84
      intent_anchor: task-001
    - task: EPIC-080/BP-001/TASK-002
      sha: faf7d426
      intent_anchor: task-002
    - task: EPIC-080/BP-001/TASK-003
      sha: a6e2beb7
      intent_anchor: task-003
    - task: EPIC-080/BP-001/TASK-004
      sha: 061eea5f
      intent_anchor: task-004
    - task: EPIC-080/BP-001/TASK-005
      sha: 930df606
      intent_anchor: task-005
    - task: EPIC-080/BP-001/TASK-006
      sha: f5bcbfbd
      intent_anchor: task-006
    - task: EPIC-080/BP-001/TASK-007
      sha: 9b8034d9
      intent_anchor: task-007
    - task: EPIC-080/BP-001/TASK-009
      sha: ecc5bc9e
      intent_anchor: task-009
  coordinator:
    base: 637375ccdf6faf8b439e0f343bef444b6e16e282
    integration_head: ecc5bc9ecee0980c4c3ed44a1ebbbd371ef85eae
    integration_branch: feat/080-001-contract-gaps-final-review
    revision: r3
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/003
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/004
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/005
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/006
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/007
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/080/001/workers/009
    tasks:
      - id: '001'
        status: integrated
        sha: 60dce83d05841c6e78381f7656ce67fa2547dc58
        branch: bouncer/080-001-001
        scope_revision: r2
        paths:
          - scripts/src/lib/cli.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/codex-agents.ts
          - rules/subagent-model.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - references/review/index.md
          - rules/cli.md
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
          - scripts/src/lib/seed-worktree.ts
          - test/seed-worktree.test.js
        actual_paths:
          - references/review/index.md
          - rules/cli.md
          - rules/subagent-model.md
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/codex-agents.ts
          - scripts/src/lib/seed-worktree.ts
          - skills/bouncer-execute/references/agent-dispatch.md
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - test/master-rules.test.js
          - test/seed-worktree.test.js
          - test/skill-bouncer-execute.test.js
      - id: '002'
        status: integrated
        sha: 74e5488089a32f02ef74a2ac03f7d0776b8c7b14
        branch: bouncer/080-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - rules/cli.md
          - scripts/src/lib/coordinator.ts
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
      - id: '003'
        status: integrated
        sha: 5c38751508763aaab8636cb3fa2d6e24022ded64
        branch: bouncer/080-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - rules/gates.md
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/validate-docs.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-structural.ts
          - scripts/src/lib/validate.ts
          - test/cli-validate.test.js
          - test/coordinator.test.js
          - test/validate-gates.test.js
          - test/validate-structural.test.js
      - id: '004'
        status: integrated
        sha: 7cf20f608ba76f8eaf17227b9a6cbb975f413b79
        branch: bouncer/080-001-004
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/src/lib/cli-doc-commands.ts
          - scripts/src/lib/finalize-digest.ts
          - scripts/src/lib/finalize-pr.ts
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/scaffold.ts
          - scripts/src/lib/templates.ts
          - test/finalize-digest.test.js
          - test/finalize-pr.test.js
          - test/finalize.test.js
          - test/scaffold.test.js
      - id: '005'
        status: integrated
        sha: 7e2b8d7ffd67c206433730050263b0c3ca38d28d
        branch: bouncer/080-001-005
        scope_revision: null
        paths: []
        actual_paths:
          - rules/cli.md
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/cli-review-dispatch-command.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/review-dispatch.ts
          - scripts/src/lib/runtime-state.ts
          - test/cli-coordinate.test.js
          - test/cli-help.test.js
          - test/coordinator.test.js
          - test/review-dispatch.test.js
          - test/runtime-state.test.js
      - id: '006'
        status: integrated
        sha: bdc3f532fe3adf3e596bcf950c8fd9a07de30fd6
        branch: bouncer/080-001-006
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-reviewer.toml
          - agents/bouncer-coordinator.md
          - agents/bouncer-reviewer.md
          - docs/workflow.md
          - references/review/assets/reviewer-prompt.md
          - references/review/index.md
          - references/spec-authoring/blueprint.md
          - rules/document-schema.md
          - rules/planning.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/review-round.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/distill-decommission-audit.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-run.test.js
      - id: '007'
        status: integrated
        sha: 5a7a0ec6e8f1154790b30d1db9d86ed5b3163be7
        branch: bouncer/080-001-007
        scope_revision: null
        paths: []
        actual_paths:
          - references/spec-authoring/index.md
          - skills/bouncer-execute/references/review-round.md
          - test/skill-spec-authoring.test.js
          - references/spec-authoring/review-rounds.md
      - id: '008'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '009'
        status: integrated
        sha: 7c625075188fc51af09e63f0f4709ae4bc44fc41
        branch: bouncer/080-001-009
        scope_revision: r3
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/distill-decommission-audit.test.js
        actual_paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/distill-decommission-audit.test.js
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 36d84cb27a069a02f2aa6337726fd1c94b7bee061d615e6e519071cd57036e13
        base_head: 637375ccdf6faf8b439e0f343bef444b6e16e282
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 36d84cb27a069a02f2aa6337726fd1c94b7bee061d615e6e519071cd57036e13
        outcome: accepted
        summary: Implementer added subagent-model and codex-agents check CLI; tests-first; npm test passed; execute review discovery combined+security found none; execute gate passed.
      - task: '001'
        decision: 'Accepted TASKS-001 worker HEAD 6c30a166eaa692fb3af1d54dd483421d84bad12f. Paths: scripts/src/lib/cli.ts, scripts/src/lib/cli-project-commands.ts, scripts/src/lib/codex-agents.ts, rules/subagent-model.md, skills/bouncer-execute/references/agent-dispatch.md, references/review/index.md, rules/cli.md, test/cli-project-commands.test.js, test/cli-help.test.js, test/master-rules.test.js, test/skill-bouncer-execute.test.js. Worker branch bouncer/080-001-001.'
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: 546f9b7a1d8d433fa2c4fe8da167dff91576de61dcae903b1faca19000a9af5f
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: fb65de11098c57c8fce3aee72046b1f97da61bcc050939bbafb1960061ef41f8
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: e2a34a40f81589547190070cb811ef164b9cf4dcda9c824c2e9b5a5caaac6910
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: 1e34f5bfb746b6fee7a4be7bbb07a051ad209ce8ebd09544c70cfbfaabd8cd26
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: 96f409145b910f71d6664aa758135c9ee0c0e0e73279b239e49fe6be4c84f013
      - task: '001'
        kind: scope
        reason: fan-in candidate has no node_modules; seedCoordinatorWorker must npm ci before wave npm test
        previous:
          - scripts/src/lib/cli.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/codex-agents.ts
          - rules/subagent-model.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - references/review/index.md
          - rules/cli.md
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
        next:
          - scripts/src/lib/seed-worktree.ts
          - test/seed-worktree.test.js
        revision: r1
      - task: '001'
        kind: scope
        reason: r1 listed only the fan-in npm ci files; restore TASKS-001 CLI paths plus seed-worktree
        previous:
          - scripts/src/lib/seed-worktree.ts
          - test/seed-worktree.test.js
        next:
          - scripts/src/lib/cli.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/codex-agents.ts
          - rules/subagent-model.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - references/review/index.md
          - rules/cli.md
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
          - scripts/src/lib/seed-worktree.ts
          - test/seed-worktree.test.js
        revision: r2
      - task: '001'
        kind: rerecord
        reason: replace recorded SHA with fan-in npm ci seedCoordinatorWorker plus original CLI paths
        previousSha: 6c30a166eaa692fb3af1d54dd483421d84bad12f
        nextSha: 60dce83d05841c6e78381f7656ce67fa2547dc58
        integrationHead: 637375ccdf6faf8b439e0f343bef444b6e16e282
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: f9882bd3074d31f9cc8a3c77137714b34a77d239caf720ece5e73c15c52d22e0
      - kind: fanin-verification-failed
        tasks:
          - '001'
        command: npm test
        exitCode: 1
        evidence_id: 9e054e9de52b1194e964da3d25a6e89deb1701ce6a4e40bcb2183808f00b9b6d
      - kind: fanin
        tasks:
          - '001'
        base_head: 637375ccdf6faf8b439e0f343bef444b6e16e282
        candidate_head: 8f72ec8443d569fe59231eab494aff7d6bf5b627
        evidence_id: 8600b2b12bc4e81970d5ffb5c2f371ca42d8ca1c483bcbc37fa5b24b659b32b9
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: f2edc785b4814d57921488585cc0bd5dcddbedaeeb5e1c542d8c98c3165c6c7d
        base_head: 8f72ec8443d569fe59231eab494aff7d6bf5b627
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: f2edc785b4814d57921488585cc0bd5dcddbedaeeb5e1c542d8c98c3165c6c7d
        outcome: accepted
        summary: 'Implementer attached COORDINATE_FAILURE_HINTS at the coordinate return boundary; tests-first; npm test passed; execute review combined+security: F1/F2 advisory accepted; execute gate passed; committed 74e5488089a32f02ef74a2ac03f7d0776b8c7b14.'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 0996a155bf0a446c4bb60a4c2829e35f61dfb611fe6ef8bbe78595cd11402ec7
        base_head: 74e5488089a32f02ef74a2ac03f7d0776b8c7b14
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 0996a155bf0a446c4bb60a4c2829e35f61dfb611fe6ef8bbe78595cd11402ec7
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 1 (status ready->verified, commit_sha 74e54880 stamp); brief authority sections byte-identical; attempt 1 accepted result carried forward'
      - task: '002'
        decision: 'Accepted TASKS-002 worker HEAD 74e5488089a32f02ef74a2ac03f7d0776b8c7b14 after attempt-2 brief re-ack. Paths: scripts/src/lib/coordinator.ts, rules/cli.md, agents/bouncer-coordinator.md, .codex/agents/bouncer-coordinator.toml, test/coordinator.test.js, test/cli-coordinate.test.js, test/coordinator-e2e.test.js. Worker branch bouncer/080-001-002.'
      - kind: fanin-verification-failed
        tasks:
          - '002'
        command: npm test
        exitCode: 1
        evidence_id: a9c6ee8a3fe22538e86cf7e7250e077821f30bafbee8f0a354dd86d816df4f79
      - kind: fanin
        tasks:
          - '002'
        base_head: 8f72ec8443d569fe59231eab494aff7d6bf5b627
        candidate_head: faf7d426903d1c6e7b72a22468cac295be5bb28d
        evidence_id: 96cbd6486d5dc9d7fecf92559703928bc99d7742a808faa6e3864276042236bb
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: c6e583cb50b8aceb84c4a1b3b5432b0b5d6c764bcbf4b011fd496bf153cbf0e2
        base_head: faf7d426903d1c6e7b72a22468cac295be5bb28d
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: c6e583cb50b8aceb84c4a1b3b5432b0b5d6c764bcbf4b011fd496bf153cbf0e2
        outcome: rework
        summary: 'Review must_fix: F2 Korean docstring on copyEvidenceBundle/evidenceFiles/firstStderrLine; F-SEC-001 checkWorkerEvidence and copyEvidenceBundle must use integrationPath review_scope like writeRepairDocuments. F1 context index advisory. F3 and F-SEC-002 advisory.'
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: e228ee6ce9143942e9d589c99fe40051ca1c245b4d86b4ba9a284d9e4c9b5986
        base_head: faf7d426903d1c6e7b72a22468cac295be5bb28d
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M rules/gates.md
           M scripts/src/lib/coordinator.ts
           M scripts/src/lib/validate-docs.ts
           M scripts/src/lib/validate-gates.ts
           M scripts/src/lib/validate-structural.ts
           M scripts/src/lib/validate.ts
           M test/cli-validate.test.js
           M test/coordinator.test.js
           M test/validate-gates.test.js
           M test/validate-structural.test.js
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: e228ee6ce9143942e9d589c99fe40051ca1c245b4d86b4ba9a284d9e4c9b5986
        outcome: accepted
        summary: Fix implementer resolved F2 JSDoc and F-SEC-001 integrationPath review_scope; delta certified; execute gate passed; committed 5c38751508763aaab8636cb3fa2d6e24022ded64.
      - task: '003'
        kind: dispatch
        attempt: 3
        task_brief_hash: de7524f10e51e6be3f5ff2fbb0ab24dff073dddd156bfe5b7583843266c82246
        base_head: 5c38751508763aaab8636cb3fa2d6e24022ded64
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '003'
        kind: report
        attempt: 3
        task_brief_hash: de7524f10e51e6be3f5ff2fbb0ab24dff073dddd156bfe5b7583843266c82246
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report after commit_sha stamp; attempt 2 accepted result carried forward'
      - task: '003'
        decision: 'Accepted TASKS-003 worker HEAD 5c38751508763aaab8636cb3fa2d6e24022ded64 after brief re-ack. Paths: rules/gates.md, scripts/src/lib/coordinator.ts, scripts/src/lib/validate-docs.ts, scripts/src/lib/validate-gates.ts, scripts/src/lib/validate-structural.ts, scripts/src/lib/validate.ts, test/cli-validate.test.js, test/coordinator.test.js, test/validate-gates.test.js, test/validate-structural.test.js. Worker branch bouncer/080-001-003.'
      - kind: fanin
        tasks:
          - '003'
        base_head: faf7d426903d1c6e7b72a22468cac295be5bb28d
        candidate_head: a6e2beb786909db7f6e1de47d49ced3ed07f191a
        evidence_id: 83124828b214d73930fea154094f5cf73aa79a51a2c8c87aa1046f5e575a4dc0
      - task: '004'
        kind: dispatch
        attempt: 1
        task_brief_hash: 62654b065c9e83c7ea91046b996730304f03cdba107867b0103c58ad772a199a
        base_head: a6e2beb786909db7f6e1de47d49ced3ed07f191a
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '004'
        kind: report
        attempt: 1
        task_brief_hash: 62654b065c9e83c7ea91046b996730304f03cdba107867b0103c58ad772a199a
        outcome: accepted
        summary: Implementer scaffolded root review.md and review_scope; tests-first; npm test passed; review advisory F-EXTRA/F-TEST/F-DOC accepted; execute gate passed; committed 7cf20f608ba76f8eaf17227b9a6cbb975f413b79.
      - task: '004'
        kind: dispatch
        attempt: 2
        task_brief_hash: 1ffe51cedce11250476a7ea0b5e9de06677054ea6542c87cd0f02321e95a36a1
        base_head: 7cf20f608ba76f8eaf17227b9a6cbb975f413b79
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '004'
        kind: report
        attempt: 2
        task_brief_hash: 1ffe51cedce11250476a7ea0b5e9de06677054ea6542c87cd0f02321e95a36a1
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp stale-worker-report; attempt 1 accepted result carried forward'
      - task: '004'
        decision: 'Accepted TASKS-004 worker HEAD 7cf20f608ba76f8eaf17227b9a6cbb975f413b79 after brief re-ack. Paths: scripts/src/lib/cli-doc-commands.ts scripts/src/lib/finalize-digest.ts scripts/src/lib/finalize-pr.ts scripts/src/lib/finalize.ts scripts/src/lib/scaffold.ts scripts/src/lib/templates.ts test/finalize-digest.test.js test/finalize-pr.test.js test/finalize.test.js test/scaffold.test.js. Worker branch bouncer/080-001-004.'
      - kind: fanin
        tasks:
          - '004'
        base_head: a6e2beb786909db7f6e1de47d49ced3ed07f191a
        candidate_head: 061eea5f58bbca8194c12248802ad71cb1e36d7d
        evidence_id: 2710be3cfd04320ff8338a2b72e82b984ed28ec0d206c1e92af63512691edd07
      - task: '005'
        kind: dispatch
        attempt: 1
        task_brief_hash: caba12d53afeafd3b86fe849ae9d71a68a80eaa3b149afd2bd72713f85a93289
        base_head: 061eea5f58bbca8194c12248802ad71cb1e36d7d
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '005'
        kind: report
        attempt: 1
        task_brief_hash: caba12d53afeafd3b86fe849ae9d71a68a80eaa3b149afd2bd72713f85a93289
        outcome: rework
        summary: 'Review must_fix: F1 cli-help must assert coordinate repair --review-finding usage; F2 CI repair usage must keep --task required (do not optionalize like review-finding); F3 runtime-state test must accept non-empty findings array not only reject string. F4/F5 advisory.'
      - task: '005'
        kind: dispatch
        attempt: 2
        task_brief_hash: caba12d53afeafd3b86fe849ae9d71a68a80eaa3b149afd2bd72713f85a93289
        base_head: 061eea5f58bbca8194c12248802ad71cb1e36d7d
        initial_worktree_state: |2
           M rules/cli.md
           M scripts/src/lib/cli-git-commands.ts
           M scripts/src/lib/cli-review-dispatch-command.ts
           M scripts/src/lib/coordinator.ts
           M scripts/src/lib/review-dispatch.ts
           M scripts/src/lib/runtime-state.ts
           M test/cli-coordinate.test.js
           M test/cli-help.test.js
           M test/coordinator.test.js
           M test/review-dispatch.test.js
           M test/runtime-state.test.js
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '005'
        kind: report
        attempt: 2
        task_brief_hash: caba12d53afeafd3b86fe849ae9d71a68a80eaa3b149afd2bd72713f85a93289
        outcome: accepted
        summary: Rework fixed F1-F3; delta certified; execute gate passed; committed 7e2b8d7ffd67c206433730050263b0c3ca38d28d.
      - task: '005'
        kind: dispatch
        attempt: 3
        task_brief_hash: 4e7a63c1d8786b516415030c136b4e68d016f2bf923a4cc8a53806338e3b44f9
        base_head: 7e2b8d7ffd67c206433730050263b0c3ca38d28d
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '005'
        kind: report
        attempt: 3
        task_brief_hash: 4e7a63c1d8786b516415030c136b4e68d016f2bf923a4cc8a53806338e3b44f9
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp stale-worker-report; attempt 2 accepted result carried forward'
      - task: '005'
        decision: 'Accepted TASKS-005 worker HEAD 7e2b8d7ffd67c206433730050263b0c3ca38d28d after brief re-ack. Paths: rules/cli.md scripts/src/lib/cli-git-commands.ts scripts/src/lib/cli-review-dispatch-command.ts scripts/src/lib/coordinator.ts scripts/src/lib/review-dispatch.ts scripts/src/lib/runtime-state.ts test/cli-coordinate.test.js test/cli-help.test.js test/coordinator.test.js test/review-dispatch.test.js test/runtime-state.test.js. Worker branch bouncer/080-001-005.'
      - kind: fanin
        tasks:
          - '005'
        base_head: 061eea5f58bbca8194c12248802ad71cb1e36d7d
        candidate_head: 930df606628c6f871897d4e16e387dc365cc70ce
        evidence_id: ead02a7796a99bd0ec9f582553f77732cf90357e3da7ae535db5874f6fa0dbf9
      - task: '006'
        kind: dispatch
        attempt: 1
        task_brief_hash: c321fb584429909d97e804ae7265e2ab46c6f808090476488a3d72e9240af7e7
        base_head: 930df606628c6f871897d4e16e387dc365cc70ce
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '006'
        kind: report
        attempt: 1
        task_brief_hash: c321fb584429909d97e804ae7265e2ab46c6f808090476488a3d72e9240af7e7
        outcome: rework
        summary: 'Review must_fix: F-SS-001 execute SKILL Otherwise still enters review for skipped blueprint tasks; F-SS-002 fail-closed must compare risk_flags to union of commit-task review_risk; F-CT-001 step-5 test locks the wrong sentence; F-SS-003 standalone delta must be whole-worktree diff; F-SS-004 generic fallback payload must include task_brief_hashes and intent_bundles. F-MM-001 advisory. agent-dispatch.md out of scope.'
      - task: '006'
        kind: dispatch
        attempt: 2
        task_brief_hash: c321fb584429909d97e804ae7265e2ab46c6f808090476488a3d72e9240af7e7
        base_head: 930df606628c6f871897d4e16e387dc365cc70ce
        initial_worktree_state: |2
           M .codex/agents/bouncer-coordinator.toml
           M .codex/agents/bouncer-reviewer.toml
           M agents/bouncer-coordinator.md
           M agents/bouncer-reviewer.md
           M docs/workflow.md
           M references/review/assets/reviewer-prompt.md
           M references/review/index.md
           M references/spec-authoring/blueprint.md
           M rules/document-schema.md
           M rules/planning.md
           M skills/bouncer-execute/SKILL.md
           M skills/bouncer-execute/references/review-round.md
           M skills/bouncer-plan/SKILL.md
           M skills/bouncer-run/SKILL.md
           M test/agents.test.js
           M test/distill-decommission-audit.test.js
           M test/lightweight-cycle.test.js
           M test/master-rules.test.js
           M test/skill-bouncer-execute.test.js
           M test/skill-bouncer-plan.test.js
           M test/skill-bouncer-run.test.js
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '006'
        kind: report
        attempt: 2
        task_brief_hash: c321fb584429909d97e804ae7265e2ab46c6f808090476488a3d72e9240af7e7
        outcome: accepted
        summary: Rework fixed F-SS-001/002/003/004 and F-CT-001; delta certified; npm test 1727; execute gate passed; committed bdc3f532fe3adf3e596bcf950c8fd9a07de30fd6.
      - task: '006'
        kind: dispatch
        attempt: 3
        task_brief_hash: ee8acbf45d7bb9818c1635e7e9b9649f161b96cbdbc8e23e5b61fb966ce3a337
        base_head: bdc3f532fe3adf3e596bcf950c8fd9a07de30fd6
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '006'
        kind: report
        attempt: 3
        task_brief_hash: ee8acbf45d7bb9818c1635e7e9b9649f161b96cbdbc8e23e5b61fb966ce3a337
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp stale-worker-report; attempt 2 accepted result carried forward'
      - task: '006'
        decision: 'Accepted TASKS-006 worker HEAD bdc3f532fe3adf3e596bcf950c8fd9a07de30fd6 after brief re-ack. Paths: .codex/agents/bouncer-coordinator.toml .codex/agents/bouncer-reviewer.toml agents/bouncer-coordinator.md agents/bouncer-reviewer.md docs/workflow.md references/review/assets/reviewer-prompt.md references/review/index.md references/spec-authoring/blueprint.md rules/document-schema.md rules/planning.md skills/bouncer-execute/SKILL.md skills/bouncer-execute/references/review-round.md skills/bouncer-plan/SKILL.md skills/bouncer-run/SKILL.md test/agents.test.js test/distill-decommission-audit.test.js test/lightweight-cycle.test.js test/master-rules.test.js test/skill-bouncer-execute.test.js test/skill-bouncer-plan.test.js test/skill-bouncer-run.test.js. Worker branch bouncer/080-001-006.'
      - kind: fanin
        tasks:
          - '006'
        base_head: 930df606628c6f871897d4e16e387dc365cc70ce
        candidate_head: f5bcbfbd9c405730390bab721cbdb965170bd7be
        evidence_id: 6b53deff54e7c29b298d58c5f05c76ecf6af7f6577ff486150b84c375122dc37
      - task: '007'
        kind: dispatch
        attempt: 1
        task_brief_hash: 32c4f21c0d1db16805c39d19946654836d0f5f3b7653918b84f5fbea63c4207e
        base_head: f5bcbfbd9c405730390bab721cbdb965170bd7be
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '007'
        kind: report
        attempt: 1
        task_brief_hash: 32c4f21c0d1db16805c39d19946654836d0f5f3b7653918b84f5fbea63c4207e
        outcome: accepted
        summary: Implementer added review-rounds.md example; tests-first ENOENT then collectFindingFailures []; npm test 1728; combined review none; execute gate passed; committed 5a7a0ec6e8f1154790b30d1db9d86ed5b3163be7.
      - task: '007'
        kind: dispatch
        attempt: 2
        task_brief_hash: 0244453362f4723c8f989a2a56747b8741d045c80c16fb35f0bee1621bca0ffe
        base_head: 5a7a0ec6e8f1154790b30d1db9d86ed5b3163be7
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '007'
        kind: report
        attempt: 2
        task_brief_hash: 0244453362f4723c8f989a2a56747b8741d045c80c16fb35f0bee1621bca0ffe
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp stale-worker-report; attempt 1 accepted result carried forward'
      - task: '007'
        decision: 'Accepted TASKS-007 worker HEAD 5a7a0ec6e8f1154790b30d1db9d86ed5b3163be7 after brief re-ack. Paths: references/spec-authoring/index.md skills/bouncer-execute/references/review-round.md test/skill-spec-authoring.test.js references/spec-authoring/review-rounds.md. Worker branch bouncer/080-001-007.'
      - kind: fanin
        tasks:
          - '007'
        base_head: f5bcbfbd9c405730390bab721cbdb965170bd7be
        candidate_head: 9b8034d92a8dc5536817e58d306eee9dfddeff61
        evidence_id: 7f9ef2580f785213cd3f70626720f14ede222d7a3ddf36116b4126d2f63eb215
      - task: '009'
        kind: repair
        wave: 1
        reason: Terminal npm run ci lint failed on wrap/quote of files this drive already changed; wrap max-len and fix quotes so CI can pass without new product behavior.
        failure:
          task: '008'
          command: npm run ci
          summary: 'eslint max-len/quotes: coordinator.ts 9 lines, seed-worktree.ts:273, distill-decommission-audit.test.js:34'
          paths:
            - scripts/src/lib/coordinator.ts
            - scripts/src/lib/seed-worktree.ts
            - test/distill-decommission-audit.test.js
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
          - id: '007'
            depends_on:
              - '006'
          - id: '008'
            depends_on:
              - '007'
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
              - '005'
          - id: '007'
            depends_on:
              - '006'
          - id: '008'
            depends_on:
              - '009'
          - id: '009'
            depends_on:
              - '007'
        previousScope: []
        nextScope:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/distill-decommission-audit.test.js
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r3
      - task: '009'
        kind: dispatch
        attempt: 1
        task_brief_hash: 6d3aea78485c933aa415c184ae3d83f46c98bd02d375ec7f40e2c79ab947745c
        base_head: 9b8034d92a8dc5536817e58d306eee9dfddeff61
        initial_worktree_state: |
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '009'
        kind: report
        attempt: 1
        task_brief_hash: 6d3aea78485c933aa415c184ae3d83f46c98bd02d375ec7f40e2c79ab947745c
        outcome: accepted
        summary: Lint wrap max-len and singlequote; eslint clean; npm test 1728; combined review none; execute gate passed; committed 7c625075188fc51af09e63f0f4709ae4bc44fc41.
      - task: '009'
        kind: dispatch
        attempt: 2
        task_brief_hash: d78eb5f45c1986e5b72cc6014701cd203a4378ba779c993e7decea32697d8b5b
        base_head: 7c625075188fc51af09e63f0f4709ae4bc44fc41
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/080-execution-token-cost/
      - task: '009'
        kind: report
        attempt: 2
        task_brief_hash: d78eb5f45c1986e5b72cc6014701cd203a4378ba779c993e7decea32697d8b5b
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp stale-worker-report; attempt 1 accepted result carried forward'
      - task: '009'
        decision: 'Accepted TASKS-009 worker HEAD 7c625075188fc51af09e63f0f4709ae4bc44fc41 after brief re-ack. Paths: scripts/src/lib/coordinator.ts scripts/src/lib/seed-worktree.ts test/distill-decommission-audit.test.js. Worker branch bouncer/080-001-009.'
      - kind: fanin
        tasks:
          - '009'
        base_head: 9b8034d92a8dc5536817e58d306eee9dfddeff61
        candidate_head: ecc5bc9ecee0980c4c3ed44a1ebbbd371ef85eae
        evidence_id: fa01a715b77e487e15f80c026cec2d848587d95015f8e8970f9e7eba2f01e399
---
# Explain

## Background

드라이브는 `637375cc`에서 `ecc5bc9e`까지 `feat/080-001-contract-gaps-final-review`에 쌓였다. 목적은 coordinator가 플러그인 소스를 열어보지 않고 지침과 CLI만으로 가고, 리뷰를 task마다 열지 않고 마지막 검증에서 한 번만 여는 것이다.

001은 `bouncer subagent-model`과 `bouncer codex-agents check` CLI를 넣었다. fan-in에서 `node_modules`가 없어 `npm test`가 여러 번 실패했고, scope r1은 `seedCoordinatorWorker`가 `npm ci` 하도록 `scripts/src/lib/seed-worktree.ts`와 `test/seed-worktree.test.js`만 남겼다. r2는 CLI 경로를 되돌리고 seed 파일을 같이 두었고, SHA는 `60dce83d`로 rerecord했다. 워커 브랜치는 `bouncer/080-001-001`이다.

002는 `COORDINATE_FAILURE_HINTS`를 coordinate 반환 경계에 붙였다 (`74e54880`, `bouncer/080-001-002`). 003은 루트 리뷰 인식을 넣고 G21을 더했다 (`5c38751`, `bouncer/080-001-003`). 004는 scaffold가 루트 `review.md` 하나를 만들게 바꿨다 (`7cf20f60`, `bouncer/080-001-004`). 005는 분류기와 `coordinate repair --review-finding`을 맞췄다 (`7e2b8d7f`, `bouncer/080-001-005`). 006은 역할·스킬·규칙을 최종 리뷰 1회로 고쳤다 (`bdc3f532`, `bouncer/080-001-006`). 007은 `references/spec-authoring/review-rounds.md` 예제를 넣었다 (`5a7a0ec6`, `bouncer/080-001-007`).

008 `npm run ci`가 eslint max-len/quotes로 실패했다 (`coordinator.ts` 9줄, `seed-worktree.ts:273`, `distill-decommission-audit.test.js:34`). repair wave 1이 009를 열고 DAG를 바꿨다. 이전에는 008이 007에만 의존했고, 다음에는 009가 007에 의존하고 008이 009에 의존한다. 009는 wrap/quote만 고쳤고 제품 동작은 넣지 않았다 (`7c625075`, `bouncer/080-001-009`, scope r3). 그다음 008이 integration에서 통과했다.

003·005·006은 must_fix rework 뒤 받아들여졌다. 여러 task에서 `commit_sha` 스탬프 때문에 `stale-worker-report`가 났고, 구현을 다시 돌리지 않고 brief re-ack으로 넘겼다.

## Intuition

지침이 내부 함수 이름을 가리키지 않게 CLI로 바꾸고, 리뷰는 종단 CI 앞에 한 번만 연다. CI 줄바꿈 실패는 009가 끼어들어 008의 의존을 옮긴다.

## Code

워커 SHA와 브랜치는 위와 같다. 001 최종 scope는 CLI·규칙·테스트에 `seed-worktree`가 더해진 r2다. 002 실제 경로는 `scripts/src/lib/coordinator.ts`, `rules/cli.md`, `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`과 테스트 셋이다. 003은 `validate-*.ts`, `rules/gates.md`, `coordinator.ts`다. 004는 `scaffold.ts`, `templates.ts`, `finalize*.ts`다. 005는 `review-dispatch.ts`, `cli-review-dispatch-command.ts`, `cli-git-commands.ts`, `runtime-state.ts`다. 006은 coordinator/reviewer 에이전트와 execute·plan·run 스킬, `rules/planning.md`, `rules/document-schema.md`다. 007은 `review-rounds.md`와 spec-authoring 인덱스다. 009는 `coordinator.ts`, `seed-worktree.ts`, `test/distill-decommission-audit.test.js`만이다.

## Quiz

1. 001이 지침 대신 에이전트에게 쓰게 한 표면은?
   - A) `bouncer subagent-model`과 `bouncer codex-agents check`
   - B) `scripts/src/lib/subagents.ts`를 직접 읽어 model을 해석
   - C) `mdToCodexToml` 결과를 손으로 맞춤

2. 001 scope r1이 CLI 경로를 빼고 seed 파일만 남긴 이유는?
   - A) 리뷰 finding이 CLI 경로를 Extra로 표시해서
   - B) G21이 seed-worktree만 인식해서
   - C) fan-in candidate에 `node_modules`가 없어 `seedCoordinatorWorker`가 `npm ci` 해야 해서

3. repair 009 이후 008의 `depends_on`은?
   - A) 007만 (009는 008과 병렬)
   - B) 009 (009는 007에 의존)
   - C) 008 삭제, 009가 종단 검증

4. 009가 고친 파일은?
   - A) `scripts/src/lib/coordinator.ts`, `scripts/src/lib/seed-worktree.ts`, `test/distill-decommission-audit.test.js`
   - B) `scripts/src/lib/subagents.ts`
   - C) `rules/gates.md`에 G22 추가

5. 005 must_fix F2가 지킨 CI repair 계약은?
   - A) `--task`를 `--review-finding`처럼 optional로 만든다
   - B) `--review-finding`을 제거한다
   - C) `--task`는 계속 required다

6. 003이 새로 넣은 gate는?
   - A) 폐기된 G4를 되살림
   - B) G21 (blueprint 루트 리뷰 문서)
   - C) 폐기된 G9를 되살림

## 이해 상태

`quiz_score` 3/6. 정답 A, C, B, A, C, B. 응답 A, C, C, A, A, A. Q1·Q2·Q4 정답. Q3 오답(008은 삭제되지 않고 009에 의존). Q5 오답(`--task`는 optional이 아님). Q6 오답(G4가 아니라 G21). 재시험 없음.

## Tasks

### EPIC-080/BP-001/TASK-001 · `8f72ec84`

#### Goal & intent

지침이 가리키는 model 조회와 Codex TOML 동기 확인을 `bouncer` 명령 두 개로 실행할 수 있게 한다.
규칙 문서에서 내부 함수 이름이 사라지고, 에이전트는 `rules/cli.md`의 명령만으로 두 절차를 끝낸다.

#### Current behavior

- `rules/subagent-model.md:12`는 `resolveSubagentModel`로 model을 정하라고 하고, `skills/bouncer-execute/references/agent-dispatch.md:42`는 `mdToCodexToml()` 결과를 `.codex/agents/bouncer-implementer.toml`과 바이트 비교하라고 한다. `references/review/index.md:11`도 `resolveSubagentModel` 호출을 언급한다.
- 두 함수는 `scripts/src/lib/subagents.ts:51`과 `scripts/src/lib/codex-agents.ts:37`에 있고, `scripts/src/lib/cli.ts`의 `COMMANDS`에는 대응 명령이 없다.
- `test/master-rules.test.js:569`는 규칙 문서에 `resolveSubagentModel`이 있을 것을, `test/skill-bouncer-execute.test.js:184`는 `mdToCodexToml()`이 있을 것을 단언한다.
- 재현: `node scripts/bouncer subagent-model --agent bouncer-reviewer`는 알 수 없는 명령으로 exit 2다.

#### Target behavior

- 성공
  - `bouncer subagent-model --agent bouncer-reviewer`는 설정된 slug가 있으면 그 slug 한 줄, 없거나 `inherit`이면 `inherit` 한 줄을 stdout에 쓰고 exit 0이다.
  - `bouncer codex-agents check --agent bouncer-implementer`는 로컬 TOML이 생성본과 바이트 일치하면 `{"ok":true,"agent":"bouncer-implementer","in_sync":true,"path":".codex/agents/bouncer-implementer.toml"}`을 쓰고 exit 0이다.
- 실패
  - TOML이 없거나, `# bouncer-generated`로 시작하지 않거나, 내용이 다르면 `{"ok":false,"agent":…,"in_sync":false,"reason":"missing"|"not-generated"|"mismatch","next":"bouncer init --seed-codex-agents","path":".codex/agents/<name>.toml"}`을 쓰고 exit 1이다.
  - `--agent`가 없거나 `NAMED_AGENTS`에 없는 이름이면 stderr에 허용 이름을 쓰고 exit 2다.
- 보존: `resolveSubagentModel`과 `mdToCodexToml`의 반환값, `bouncer init --seed-codex-agents`의 동작.

#### Interface

- 제공
  - `bouncer subagent-model --agent <name> [--provider <name>] [--repo <dir>]`
  - `bouncer codex-agents check --agent <name> [--repo <dir>]`. 읽기 전용이며 파일을 쓰지 않는다.
  - `codex-agents.ts`의 확인 함수: `checkCodexAgent({ repoRoot, agentName, agentsDir? }) → { ok: true, in_sync: true, path } | { ok: false, in_sync: false, reason, path }`.
- 거부
  - `codex-agents` 뒤에 `check` 외 하위 명령: exit 2.
  - `subagent-model`은 `{ model, provider }` 객체를 출력하지 않는다. provider 메타데이터는 stdout에 나오지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 명령 레지스트리와 usage 조립 | `subagent-model`, `codex-agents` 등록 | 레지스트리에 없으면 명령과 도움말이 생기지 않는다 |
| `scripts/src/lib/cli-project-commands.ts` | 신규 추출 지점: 두 명령 핸들러 | Modify | 프로젝트 계열 명령 핸들러와 usage | 두 핸들러와 usage 문자열 추가 | `init`·`project-root`와 같은 계열의 읽기 명령이다 |
| `scripts/src/lib/codex-agents.ts` | `checkCodexAgent`, `NAMED_AGENTS` | Modify | md→TOML 변환과 seed | 바이트 비교 함수 추가와 export | 비교 로직이 변환 함수 옆에 있어야 기준이 하나다 |
| `rules/subagent-model.md` | 1항 | Modify | model 해석 절차 | `resolveSubagentModel`을 `bouncer subagent-model` 호출로 교체, `inherit` 출력이면 model 인자 생략으로 서술 | 명령 목록에 없는 내부 함수 이름을 절차로 준다 |
| `skills/bouncer-execute/references/agent-dispatch.md` | `## Named implementer` | Modify | 구현자 디스패치 전 TOML 비교 | `mdToCodexToml()` 비교를 `bouncer codex-agents check` 결과로 교체 | 명령 목록에 없는 내부 함수 이름을 절차로 준다 |
| `references/review/index.md` | 11행 문장 | Modify | model 규칙 인용 | 함수 이름 대신 명령 이름으로 서술 | 같은 내부 이름이 남아 있다 |
| `rules/cli.md` | `## Read-only discovery and Graphify` | Modify | 명령 목록 | 두 명령 형식과 결과 해석 한 문단 추가 | 에이전트가 읽는 유일한 명령 목록 |
| `test/cli-project-commands.test.js` | 신규 테스트 | Modify | 프로젝트 명령 CLI 테스트 | 두 명령의 성공·실패·exit 코드 | 새 공개 명령의 계약 고정 |
| `test/cli-help.test.js` | usage 단언 | Modify | 도움말 조립 검사 | 새 명령 usage 반영 | 레지스트리 변경이 도움말 바이트를 바꾼다 |
| `test/master-rules.test.js` | `subagent model contract is centralized…` | Modify | 규칙 문구 고정 | `resolveSubagentModel`·`result.model` 단언을 `bouncer subagent-model`·`inherit` 단언으로 교체 | 문구를 고정한 테스트 |
| `test/skill-bouncer-execute.test.js` | `compacts only a synchronized fresh named implementer payload` | Modify | 디스패치 문구 고정 | `mdToCodexToml\(\)` 단언을 `bouncer codex-agents check` 단언으로 교체 | 문구를 고정한 테스트 |

#### Constraints

- 새 런타임 의존성을 추가하지 않는다.
- 변경하는 함수에는 `references/implementation/index.md`의 한국어 docstring 계약(Summary, Args, Returns)을 지킨다.
- `rules/subagent-model.md`의 2~7항과 "rejected slug → `inherit` 재시도" 의미는 바꾸지 않는다.
- `scripts/lib/`는 빌드 산출물이고 추적되지 않는다. 직접 고치지 않는다.

### EPIC-080/BP-001/TASK-002 · `faf7d426`

#### Goal & intent

`bouncer coordinate`가 실패할 때 JSON에 원인(`cause`)과 다음 행동(`next`)을 함께 돌려준다.
coordinator는 `next`만 따르면 되고 `coordinator.ts`를 읽지 않는다.

#### Current behavior

- `scripts/src/lib/coordinator.ts`의 `coordinate`(1767행)는 실패를 `{ ok: false, reason: '<code>' }`로 돌려준다. 파일 안 `reason` 리터럴은 60여 종이다.
- 예: `record`는 report 뒤 task brief 바이트가 바뀌면 `coordinator.ts:2273`에서 `{ ok: false, reason: 'stale-worker-report' }`만 반환한다. 이 사유를 받은 coordinator는 복구 방법을 찾으려고 `coordinator.ts`를 읽게 된다.
- `rules/cli.md`의 `coordinate` 명령 목록에는 실제 하위 명령 `dispatch`, `report`, `revoke`가 없다(`scripts/src/lib/cli-git-commands.ts:258`의 허용 목록과 다르다).
- 재현: `test/coordinator.test.js:1252`가 `rejected.reason === 'stale-worker-report'`만 단언한다.
- `coordinate` 실패 객체 전체를 `deepStrictEqual`로 비교하는 단언이 11곳 있어 필드가 늘면 깨진다.
  - `reason`만 비교: `test/coordinator-e2e.test.js:366, 395`, `test/coordinator.test.js:990, 1035`, `test/cli-coordinate.test.js:471, 480`.
  - 부가 필드도 비교: `test/coordinator.test.js:618`(`integrationPath`), `:707-709`(`blueprintDir`, `integrationPath`), `:1013, 1051, 1070`(`workerPath`).
  - `test/coordinator.test.js:149`는 `readCoordinatorPolicy`의 반환값이라 `coordinate` 경계를 지나지 않는다. 바꾸지 않는다.
  - `test/cli-coordinate.test.js:563-565`의 `ledger-checkpoint-invalid`는 `coordinate`가 아니라 CLI 핸들러(`scripts/src/lib/cli-git-commands.ts:274`, `:338`)가 직접 쓴다. 힌트 대상이 아니어서 바꾸지 않는다.

#### Target behavior

- 성공: `coordinate` 함수가 반환하는 모든 `{ ok: false, reason }`에 `cause`(무엇이 어긋났는가, 영어 한 문장)와 `next`(바로 실행할 행동, 영어 한 문장)가 붙는다. 예:
  ```json
  {"ok":false,"reason":"stale-worker-report","cause":"The task brief changed after the accepted report, so the report no longer matches the brief.","next":"Open a new `bouncer coordinate dispatch` for this task and rerun the implementer; do not retry record."}
  ```
- 실패: 표에 없는 `reason`(다른 모듈에서 올라온 값)은 `cause`에 그 `reason`을 그대로 담고 `next`는 `Run \`bouncer coordinate status\` and continue from its checkpoint.`으로 채운다. throw는 하지 않는다.
- 보존: `reason` 문자열, `status`·`workerPath` 같은 기존 부가 필드, exit code, 성공 응답의 모양, `coordinate revise`의 stderr 형식.

#### Interface

- 제공
  - `COORDINATE_FAILURE_HINTS: Record<string, { cause: string; next: string }>`를 `coordinator.ts`에서 export한다.
  - 힌트는 `coordinate`의 반환 경계 한 곳에서 붙인다. 개별 `return { ok: false, … }` 지점은 고치지 않는다.
- 거부
  - `next`에 플러그인 소스 경로나 "read the implementation" 같은 소스 조회 지시를 쓰지 않는다.
  - 예외로 끝나는 경로(`coordinate: <message>` stderr, exit 1)와 CLI 핸들러가 `coordinate`를 부르기 전에 직접 쓰는 실패(`ledger-checkpoint-invalid` 등)는 이 task의 대상이 아니다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `coordinate`, `COORDINATE_FAILURE_HINTS` | Modify | drive 상태 전이와 실패 사유 반환 | 힌트 표와 반환 경계의 병합 추가 | 실패 사유가 모두 이 파일에서 나온다 |
| `rules/cli.md` | `## Pointer, worktree, and coordinator commands` | Modify | coordinator 명령 목록 | 목록에 `dispatch`·`report`·`revoke` 추가, 실패 시 `next`를 따른다는 문장 추가 | 실제 허용 목록과 어긋나 있다 |
| `agents/bouncer-coordinator.md` | `## Procedure` 3항 | Modify | drive 절차 | 실패 응답의 `next`를 실행하고 플러그인 소스를 읽지 않는다는 한 문장 추가 | coordinator가 읽는 역할 문서 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | 역할 문서의 Codex 사본 | `bouncer init --seed-codex-agents`로 재생성 | `test/agents.test.js:558`이 바이트 일치를 요구한다 |
| `test/coordinator.test.js` | 신규 테스트, 1252행 부근, 전체 비교 단언 7곳(149행 제외) | Modify | coordinator 코어 테스트 | 표 완전성 테스트, `stale-worker-report`의 `cause`·`next` 단언, 전체 비교 단언의 기대 객체에 `cause`·`next` 추가 | 누락 사유를 막는 고정점 |
| `test/cli-coordinate.test.js` | 실패 출력 단언(471, 480행 포함) | Modify | CLI 출력 테스트 | 실패 JSON에 두 필드가 있음을 단언, 전체 비교 단언 2곳(471, 480행)의 기대 객체에 `cause`·`next` 추가 | stdout 계약 고정 |
| `test/coordinator-e2e.test.js` | 366, 395행 단언 | Modify | drive e2e | 기대 객체에 `cause`·`next` 추가 | 실패 객체 모양을 단언한다 |

#### Constraints

- `reason` 값을 바꾸거나 합치지 않는다. `.reason`만 보는 기존 단언은 수정 없이 통과해야 한다.
- 전체 비교 단언 11곳은 기대 객체에 `cause: COORDINATE_FAILURE_HINTS[<reason>].cause`와 `next: COORDINATE_FAILURE_HINTS[<reason>].next`를 더하는 방식으로 고친다. 기존 기대 객체의 `reason`과 부가 필드(`integrationPath`, `blueprintDir`, `workerPath`)는 그대로 남긴다.
- 역할 문서를 고친 뒤 TOML은 손으로 고치지 않고 seed 명령으로 재생성한다.
- 변경하는 함수에는 한국어 docstring 계약(Summary, Args, Returns)을 지킨다.

### EPIC-080/BP-001/TASK-003 · `a6e2beb7`

#### Goal & intent

blueprint `index.md`에 `bouncer.review_scope: blueprint`가 있으면 validator·gate·coordinator fan-in이 task별 리뷰를 요구하지 않고, finalize gate가 그 루트 리뷰를 판정한다.
scaffold는 아직 바꾸지 않는다. 이 task 뒤에도 기존 blueprint의 판정은 그대로다.

#### Current behavior

- `scripts/src/lib/validate-docs.ts:125`의 `rels.review`는 `<bp>/review.md`를 이미 읽지만 `validate-structural.ts`의 type 매핑(55~77행)은 루트 `review.md`에 기대 type을 주지 않는다.
- 구형 루트 레이아웃 fixture가 이미 루트에 `review.md`를 쓴다(`test/native-profile-e2e.test.js:77`, `test/seed-worktree.test.js:344`, `test/validate-gates.test.js:82`). 그래서 파일 존재는 새 계약의 표시가 될 수 없다.
- blueprint frontmatter에 `review_scope` 필드는 없다.
- `requiredTaskLeaves`(`validate-docs.ts:271`)는 열린 blueprint의 commit task에 `review` leaf를 요구하고, 없으면 S17이다(`validate-docs.ts:182-193`).
- execute gate와 commit gate는 task `review.md`가 `accepted`이거나 `review.required === false`가 아니면 G8이다(`validate-gates.ts:697`, `:855`). execute gate는 G14도 본다(`:713`).
- finalize gate(`validate-gates.ts:732`)는 task 상태와 Explain만 본다.
- coordinator `integrate`는 worker 증적으로 `review.md`의 `accepted`를 요구하고(`coordinator.ts:805`의 `EVIDENCE_FILES`), `writeRepairDocuments`(`coordinator.ts:647-697`)는 repair task에 `review.md`를 쓴다.

#### Target behavior

용어: **blueprint 리뷰 모드**는 blueprint `index.md` frontmatter의 `bouncer.review_scope` 값이 `blueprint`인 상태다. 필드가 없으면 모드가 아니다. 예: `review_scope: blueprint`.

- 성공(모드일 때)
  - 루트 `review.md`는 type `bouncer.review`, id `REVIEW-<blueprint id>`(예: `REVIEW-001`)로 구조 검사를 통과한다.
  - commit task 묶음에 `review.md`가 없어도 S17이 나오지 않는다.
  - execute gate와 commit gate는 G8·G14를 내지 않는다.
  - coordinator `integrate`는 `tasks.md`(`verified`)와 `verification.md`(`passed`)만 증적으로 요구하고, `writeRepairDocuments`는 repair task에 `review.md`를 쓰지 않는다.
  - finalize gate는 루트 리뷰가 `accepted`이고 `rounds[]`가 한 개 이상이며 `collectFindingFailures`(execute 계약)가 0건이면 통과한다.
- 실패(모드일 때, 모두 코드 `G21`, 파일은 루트 `review.md`)
  - `blueprint review missing`: 루트 `review.md`가 없음.
  - `blueprint review not accepted`: status가 `accepted`가 아님. `review.required: false`여도 같다.
  - `blueprint review has no rounds`: `bouncer.review.rounds`가 없거나 빈 배열이거나 마지막 라운드에 `target.head`가 없음.
  - `collectFindingFailures`가 돌려준 메시지 각각.
  - `blueprint review is stale`: drive 판정(아래)이 참이고, 마지막 라운드의 `target.head`를 `H`라 할 때 `git merge-base --is-ancestor H HEAD`의 status가 1이거나 `git diff --name-only H HEAD` 출력에 `.bouncer/`로 시작하지 않는 경로가 있음.
  - `blueprint review stale check failed (<reason>)`: 위 git 호출의 status가 0·1이 아님(`merge-base`) 또는 0이 아님(`diff`). `<reason>`은 stderr 첫 줄이다.
- 실패(구조): `review_scope`가 있는데 값이 `blueprint`가 아니면 `S31` `review_scope must be blueprint`.
- 보존: `review_scope`가 없으면 루트 `review.md`의 유무와 관계없이 S17·G8·G14·`EVIDENCE_FILES`·repair 문서 생성이 지금과 같다. 모드에서도 verification task 판정은 그대로다.

drive 판정: gate를 실행한 checkout의 `.bouncer/runtime/coordinator.json`이 읽히고 그 원장의 blueprint가 판정 대상과 같으면 drive다. 원장이 없으면 stale 검사를 하지 않는다.

#### Interface

- 제공
  - `validate-docs.ts`: `isBlueprintReviewMode(blueprintIndex: DocLeaf | undefined) → boolean`, `requiredTaskLeaves(status, executionKind, reviewMode?)`.
  - gate 코드 `G21`. G16의 "open tasks remain" 판정 뒤, Explain 판정 앞에서 본다.
  - 구조 코드 `S31`.
  - stale 검사의 테스트 seam
    - `deps.exec(args: string[]) → { status: number; stdout: string; stderr: string }`. 기존 `GateDeps.exec`(`validate-gates.ts:82`)이고 `args`는 `git` 뒤의 인자다.
    - `deps.readCoordinatorLedger({ repoRoot }) → { blueprint: string } | null`. 새로 더하는 `GateDeps` 필드다.
- 거부
  - 모드에서 task 묶음에 `review.md`가 남아 있어도 읽지 않는다. 판정 근거는 루트 문서 하나다.
  - 모드 판정에 파일 존재, scale, 경로 수를 쓰지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-docs.ts` | `requiredTaskLeaves`, `loadBlueprintDocs`, `isBlueprintReviewMode` | Modify | 문서 로드와 S17 | `review_scope` 기반 모드 판정 추가, 모드에서 `review` leaf 요구 제거 | S17과 로더가 여기 있다 |
| `scripts/src/lib/validate-structural.ts` | 기대 type 매핑 함수(55~77행), blueprint 필드 검사 | Modify | 경로→문서 type 매핑과 S 코드 | 모드의 루트 `review.md` → `bouncer.review`, `review_scope` 값 검사 `S31` | 구조 코드의 소유 파일 |
| `scripts/src/lib/validate-gates.ts` | execute·commit·finalize 분기, `GateDeps` | Modify | gate 판정 | 모드에서 G8·G14 생략, finalize에 G21 추가 | gate 코드의 소유 파일 |
| `scripts/src/lib/validate.ts` | S17 순회, gate ctx 조립 | Modify | 구조 검사 순회와 gate 호출 | 모드 값을 `requiredTaskLeaves`와 gate ctx에 전달 | 두 호출부가 여기 있다 |
| `scripts/src/lib/coordinator.ts` | `EVIDENCE_FILES`, `writeRepairDocuments` | Modify | fan-in 증적과 repair 문서 생성 | 모드에서 `review.md`를 증적·생성 대상에서 제외 | 모드의 worker에는 task 리뷰가 없다 |
| `rules/gates.md` | Phase checks 표, Execution rules, Structural constraints의 `S15`–`S17` 항목 | Modify | gate 코드 설명 | G21·S31과 모드별 G8·G14 적용 범위 서술, `S15`–`S17` 항목의 `tasks/<NNN>/{tasks,verification,review}.md`를 모드별 묶음 서술로 교체 | gate 코드는 이 문서가 설명한다 |
| `test/validate-gates.test.js` | 신규 테스트 | Modify | gate 단위 테스트 | 모드 on/off의 G8·G14·G21, stale 세 경우 | 새 코드의 고정점 |
| `test/validate-structural.test.js` | 신규 테스트 | Modify | 구조 검사 테스트 | 루트 리뷰의 type·id | S5·S19 경계 |
| `test/cli-validate.test.js` | 신규 테스트 | Modify | validate CLI 테스트 | 모드 fixture의 S17 부재 | S17은 로더 경유로만 드러난다 |
| `test/coordinator.test.js` | integrate·repair 테스트 | Modify | coordinator 코어 테스트 | 모드 fixture의 증적·repair 문서 | `EVIDENCE_FILES` 분기 |

#### Constraints

- 폐기된 코드(G4, G9, G15)를 재사용하지 않는다. 새 코드는 G21 하나다.
- 기존 테스트 fixture(`review_scope` 없음, 일부는 루트 `review.md` 있음)는 수정 없이 통과해야 한다.
- 폐기되지 않은 마지막 구조 코드는 S30이다. 새 코드는 S31 하나다.
- task 002가 넣은 `COORDINATE_FAILURE_HINTS` 완전성 테스트가 계속 통과해야 한다.
- 변경하는 함수에는 한국어 docstring 계약을 지킨다.

### EPIC-080/BP-001/TASK-004 · `061eea5f`

#### Goal & intent

`bouncer scaffold blueprint`가 full·light 모두 `index.md`에 `bouncer.review_scope: blueprint`를 쓰고 루트 `review.md` 하나를 만들며, task 묶음은 `tasks.md`와 `verification.md`만 갖게 한다.
finalize는 마감 때 루트 리뷰를 지우고, 그 finding을 digest와 PR 본문에 싣는다.

#### Current behavior

- `scaffoldBlueprint`(`scripts/src/lib/scaffold.ts:336`)는 `tasks/001/{tasks,verification,review}.md`를 만들고 full이면 `context-review.md`를 더한다. `scaffoldTask`(`:214`)는 commit task마다 `review.md`를 쓴다(`:323-330`).
- blueprint 템플릿의 Documents 절은 `[Review](tasks/001/review.md)`를 가리킨다(`scripts/src/lib/templates.ts:103`).
- `collectTransientRels`(`scripts/src/lib/finalize.ts:306`)는 task leaf와 `context-review.md`만 지운다.
- `finalize-digest.ts`는 task별 `review`만 읽고(`:583-586`) `required: false`면 `review-skipped`를 낸다(`:673`). `finalize-pr.ts:217`의 `buildReviewPoints`도 task 항목의 `review.findings`만 읽는다.
- 재현: `node scripts/bouncer scaffold blueprint --epic-dir <epic> --id 001 --name x --scale light`의 `created`에 `tasks/001/review.md`가 있다.

#### Target behavior

- 성공
  - full scaffold의 `created`: `index.md`, `context-review.md`, `review.md`, `tasks/001/tasks.md`, `tasks/001/verification.md`.
  - light scaffold의 `created`: `index.md`, `review.md`, `tasks/001/tasks.md`, `tasks/001/verification.md`. 네 문서 합계 100줄 이하.
  - blueprint `index.md` frontmatter에 `review_scope: blueprint`가 있다.
  - 루트 `review.md` frontmatter: type `bouncer.review`, `bouncer.id: REVIEW-<blueprint id>`, `status: pending`, `review: { required: true }`.
  - `bouncer scaffold task`는 blueprint가 blueprint 리뷰 모드(blueprint `index.md`의 `bouncer.review_scope`가 `blueprint`인 상태)이면 `tasks.md`·`verification.md`만 만든다.
  - blueprint 리뷰 모드이면 finalize는 closed 전이 때 루트 `review.md`를 지운다.
  - blueprint 리뷰 모드이면 digest는 루트 리뷰의 finding을 `blueprint_review: { findings }`로 담고, `deferred`·`accepted` finding을 `unverified`에 `task: null`로 싣는다. `buildReviewPoints`는 이 finding도 PR 리뷰 포인트에 넣는다.
- 실패: 알 수 없는 `--scale`은 지금처럼 파일을 쓰기 전에 exit 2다.
- 보존
  - `review_scope`가 없는 기존 blueprint에 `scaffold task`를 하면 지금처럼 `review.md`를 포함한 세 문서를 만든다.
  - verification task scaffold(두 문서), `scaffold context-review`, 템플릿의 finding 허용값 주석.
  - `review_scope`가 없는 blueprint에서는 루트에 `review.md`가 있어도 finalize가 지우지 않고 digest의 `blueprint_review`는 `null`이다.

#### Interface

- 제공
  - `scaffoldBlueprint`·`scaffoldTask`의 반환 경로 목록이 위 문서 세트를 따른다.
  - blueprint 템플릿 Documents 절의 리뷰 링크는 `[Review](review.md)`다.
  - `TaskDigest`와 같은 층에 `blueprint_review: { findings: Finding[] } | null`.
- 거부
  - 루트 `review.md`가 이미 있는 blueprint에 다시 만들지 않는다(기존 문서를 덮어쓰지 않는다).
  - blueprint 리뷰 모드에서는 `review-skipped`를 내지 않는다. 이 모드의 task에는 리뷰 leaf가 원래 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint`, `scaffoldTask` | Modify | 문서 세트 생성 | `review_scope` 기록과 루트 리뷰 생성, blueprint 리뷰 모드에서 task 리뷰 생략 | 문서 세트의 소유 함수 |
| `scripts/src/lib/templates.ts` | `index.md`·`index-light.md` 템플릿, `review.md` 템플릿 주석 | Modify | 문서 본문 템플릿 | Documents 링크와 `review.md` 주석의 target 설명을 blueprint 범위로 | 링크와 주석이 task 경로를 가리킨다 |
| `scripts/src/lib/cli-doc-commands.ts` | `scaffold` usage | Modify | scaffold 명령과 도움말 | 생성 문서 설명 갱신 | usage가 문서 세트를 설명한다 |
| `scripts/src/lib/finalize.ts` | `collectTransientRels` | Modify | 마감 때 지울 문서 수집 | blueprint 리뷰 모드일 때만 루트 `review.md` 추가 | 일회성 증적은 closed 뒤 남기지 않는다 |
| `scripts/src/lib/finalize-digest.ts` | `readReview`, digest 조립(583~690행) | Modify | 마감 digest | `blueprint_review` 추가, blueprint 리뷰 모드에서 `review-skipped` 생략 | finding이 PR 본문으로 가는 경로 |
| `scripts/src/lib/finalize-pr.ts` | `buildReviewPoints` | Modify | PR 리뷰 포인트 | `blueprint_review.findings` 포함 | digest 소비자 |
| `test/scaffold.test.js` | 문서 세트·줄 수 단언 | Modify | scaffold 테스트 | 새 문서 세트, light 100줄, 기존 blueprint의 세 문서 유지 | 계약의 고정점 |
| `test/finalize.test.js` | 정리 대상 단언 | Modify | finalize 테스트 | 루트 리뷰 삭제 | `collectTransientRels` 변경 |
| `test/finalize-digest.test.js` | 신규 테스트 | Modify | digest 테스트 | `blueprint_review`와 `unverified` | 새 필드 |
| `test/finalize-pr.test.js` | 신규 테스트 | Modify | PR 본문 테스트 | 루트 finding의 리뷰 포인트 | 새 입력 |

#### Constraints

- light 계획 문서 4개·100줄 이하 계약을 지킨다(`rules/planning.md` `## Lightweight cycle`).
- 이미 있는 blueprint 문서를 scaffold가 고치거나 옮기지 않는다.
- scaffold를 호출하면서 리뷰 문서를 단언하는 테스트는 `test/scaffold.test.js`뿐이다(`rg -l "scaffold" test`로 확인). 다른 테스트가 실패하면 그 파일을 고치기 전에 Scope impact로 보고한다.
- 변경하는 함수에는 한국어 docstring 계약을 지킨다.

### EPIC-080/BP-001/TASK-005 · `930df606`

#### Goal & intent

`review-dispatch execute`가 `--task` 없이 blueprint 전체 diff로 리뷰 전략을 고르고, `coordinate repair`가 최종 리뷰의 must_fix를 원인으로 repair task를 열 수 있게 한다.

#### Current behavior

- `classifyExecuteReview`(`scripts/src/lib/review-dispatch.ts:206`)는 `taskId`가 필수이고 그 task의 `review_risk`만 읽는다. 반환 `target`은 `{ base, head, task }`다(`:307`).
- CLI는 `--task`가 없으면 usage 오류(exit 2)다(`scripts/src/lib/cli-review-dispatch-command.ts`의 `parseReviewDispatchArgs`).
- `coordinate repair`(`scripts/src/lib/coordinator.ts:2318`)는 대상이 `verifying` 상태의 verification task가 아니면 `terminal-failure-required`, `--failure-command`·`--summary`가 없으면 `failure-evidence-required`다.
- 원장 검증은 repair 결정의 `failure` 모양을 검사한다(`scripts/src/lib/runtime-state.ts:233-244`).

#### Target behavior

- 성공
  - `bouncer review-dispatch execute --blueprint <dir> --base <sha> --head <sha>`(`--task` 없음)는 base..head 전체 numstat으로 `strategy`를 고르고, 모든 commit task의 `review_risk` 합집합을 `risk_flags`로 돌려준다. `target`은 `{ base, head, task: null }`이다. `risk_flags`가 비어 있지 않으면 `perspectives` 끝에 `security`가 있다.
  - `bouncer coordinate repair --blueprint <dir> [--task <종단 verification task>] --review-finding <id> [--review-finding <id>…] --summary <text> --paths <p> --decision <reason>`은 repair commit task 하나를 연다. 원장에는 `failure: { task, command: 'review', summary, paths, exitCode: 1, repairWave, findings: [<id>…] }`와 `necessity: 'final review finding requires a Blueprint-scoped source repair'`가 남는다. `failure.task`는 `--task` 값이고, `--task`를 생략하면 새 repair task의 id다(원장 검증이 비어 있지 않은 `failure.task`를 요구한다).
  - `--task`로 준 종단 verification task는 `integrated`에서 `pending`으로 돌아가고 repair에 의존한다. 그래서 repair 통합 뒤 종단 검증이 다시 실행된다.
  - 종단 verification task가 없는 blueprint는 `--task`를 생략한다. repair는 통합된 leaf에 의존한다.
- 실패
  - `--review-finding`과 `--failure-command`를 함께 주면 `{ ok: false, reason: 'repair-cause-ambiguous' }`.
  - `--review-finding` 원인인데 `integrated`가 아닌 task가 남아 있으면 `{ ok: false, reason: 'review-repair-requires-integrated' }`.
  - repair wave가 이미 2회면 지금처럼 `repair-wave-limit`(원인 종류와 무관하게 합산).
  - `--task`가 있는 분류에서 task가 commit task가 아니면 지금처럼 `ok: false`.
- 보존: `--task`를 준 `review-dispatch execute`의 결과, `--failure-command` 원인 repair의 동작과 원장 모양, partial-close 증적 판정.

#### Interface

- 제공
  - `classifyExecuteReview({ repoRoot, blueprintDir, taskId?, base, head, exec? })`: `taskId`가 없으면 blueprint 범위.
  - `coordinate({ command: 'repair', reviewFindings?: string[], … })`와 CLI의 반복 플래그 `--review-finding`.
  - 새 실패 사유 `repair-cause-ambiguous`, `review-repair-requires-integrated`. 둘 다 `COORDINATE_FAILURE_HINTS`에 `cause`·`next`를 갖는다.
- 거부
  - blueprint 범위 분류에서 commit task의 `review_risk`가 S30 위반이면 `ok: false`이고 `perspectives`를 돌려주지 않는다.
  - `--review-finding` 값이 빈 문자열이면 `failure-evidence-required`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `classifyExecuteReview`, `readReviewRisk` | Modify | execute 리뷰 전략 분류 | `taskId` 선택화와 위험 합집합 | 분류기의 소유 파일 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `parseReviewDispatchArgs`, `USAGE` | Modify | argv 파싱과 usage | `--task` 선택화, usage 갱신 | CLI 표면 |
| `scripts/src/lib/coordinator.ts` | `repair` 분기, `FailureEvidence`, `COORDINATE_FAILURE_HINTS` | Modify | repair task 생성 | 리뷰 원인 분기와 새 사유·힌트 | repair의 소유 코드 |
| `scripts/src/lib/cli-git-commands.ts` | `coordinate` 핸들러, usage | Modify | coordinate argv 파싱 | `--review-finding` 수집(`--paths`와 같은 반복 플래그 방식)과 usage | CLI 표면 |
| `scripts/src/lib/runtime-state.ts` | repair 결정 검증(233~244행) | Modify | 원장 모양 검증 | `failure.findings`가 있으면 비어 있지 않은 문자열 배열인지 검사 | 새 필드의 모양을 원장이 보증해야 한다 |
| `rules/cli.md` | `review-dispatch`, `coordinate` 절 | Modify | 명령 목록 | 두 명령의 새 형식 | 에이전트가 읽는 명령 목록 |
| `test/review-dispatch.test.js` | 신규 테스트 | Modify | 분류기 테스트 | blueprint 범위의 strategy·risk 합집합·target | 새 분기 |
| `test/coordinator.test.js` | repair 테스트 | Modify | coordinator 코어 테스트 | 리뷰 원인 repair, 두 새 사유, wave 합산 | 새 분기 |
| `test/cli-coordinate.test.js` | 신규 테스트 | Modify | CLI 테스트 | `--review-finding` 반복 수집 | argv 계약 |
| `test/runtime-state.test.js` | 원장 검증 테스트 | Modify | 원장 검증 테스트 | `findings` 허용과 잘못된 모양 거절 | 검증 변경 |
| `test/cli-help.test.js` | usage 단언 | Modify | 도움말 검사 | 두 usage 갱신 반영 | usage 바이트가 바뀐다 |

#### Constraints

- repair wave 상한(2회)과 critical recovery 상한(task당 1회)을 바꾸지 않는다.
- 리뷰 원인 repair는 새 제품 결정, 의존성, 공개 인터페이스를 요구하는 finding에 쓰지 않는다. 이 제한은 지침(task 006)이 서술하고, CLI는 경로 경계(`repair-scope-out-of-bounds`)만 강제한다.
- task 002의 표 완전성 테스트가 통과해야 한다.
- 변경하는 함수에는 한국어 docstring 계약을 지킨다.

### EPIC-080/BP-001/TASK-006 · `f5bcbfbd`

#### Goal & intent

역할 문서·스킬·규칙이 `review_scope: blueprint`인 blueprint에서 리뷰를 한 번만 열도록 지시한다.
task 003~005가 만든 gate·scaffold·CLI를 실제 절차로 연결한다.

#### Current behavior

- `agents/bouncer-coordinator.md`의 Worker dispatch는 task마다 `review-dispatch execute --task <NNN>`으로 발견 라운드를 연다.
- `skills/bouncer-execute/SKILL.md` 5단계는 task마다 `<pointer task directory>/review.md`로 리뷰한다. `skills/bouncer-execute/references/review-round.md`의 Round ledger contract와 `references/review/index.md`의 Load 단계도 task 리뷰 문서를 전제한다.
- `rules/planning.md`, `rules/document-schema.md`, `skills/bouncer-plan/SKILL.md`, `docs/workflow.md`는 task 묶음을 `tasks/<NNN>/{tasks,verification,review}.md`로 서술한다.
- `rules/planning.md`의 verification node 설명은 "`review.md`와 review 단계를 만들지 않는다"고만 한다.

#### Target behavior

용어: **blueprint 리뷰 모드**는 blueprint `index.md`의 `bouncer.review_scope`가 `blueprint`인 상태다(task 003이 정의).

- 성공(blueprint 리뷰 모드)
  - coordinator 절차: 모든 commit task가 통합되고 종단 verification task(있을 때)가 `integrated`가 된 뒤, Close 앞에서 최종 리뷰를 한 번 연다. base는 drive dispatch payload의 base SHA, head는 integration HEAD로 고정하고 `bouncer review-dispatch execute --blueprint <dir> --base <sha> --head <sha>`의 `perspectives`를 순서대로 돈다.
  - must_fix가 있으면 `bouncer coordinate repair … --review-finding <id>`로 repair task 하나를 열어 모든 must_fix를 한 번에 고치고, 종단 검증 재실행 뒤 delta 인증을 한 번 한다. delta 라운드는 base를 그대로 두고 head를 repair 통합 뒤의 integration HEAD로 새로 고정해 `review-dispatch`를 다시 부른다. fail-closed 비교는 그 라운드가 고정한 값과 한다. 발견 라운드는 다시 열지 않는다.
  - repair가 `repair-wave-limit`으로 거절되면 coordinator는 열린 must_fix를 Blocked 보고에 담아 `blocked`로 끝낸다. 리뷰를 `accepted`로 기록하지 않는다.
  - 단독 `/bouncer-execute`: 포인터 task 외의 commit task가 모두 `verified`이면(마지막 commit task) verify 통과 뒤 최종 리뷰를 한다. base는 `bouncer current`가 돌려주는 `base` 브랜치와 HEAD의 merge-base(`git merge-base <base> HEAD`), head는 HEAD이고, 리뷰 대상 diff는 `git diff <base>`에 미추적 파일을 더한 worktree 전체다. 그 외 task는 리뷰 단계를 건너뛴다.
  - 단독 실행의 must_fix 수정은 구현자 디스패치 1회, 재검증, delta 1회다. delta 라운드의 head는 수정 뒤의 HEAD이고 대상 diff는 수정이 반영된 worktree 전체다. 수정은 포인터 task의 `affected_paths` 안에서만 한다. 그 밖의 파일이 필요한 must_fix는 열린 채로 사용자에게 보고하고 `/bouncer-plan`으로 돌린다.
  - 리뷰 기록은 루트 `review.md`의 `bouncer.review.findings[]`·`rounds[]`에 쓴다. 라운드는 `target`(`base`, `head`), `task_brief_hashes`(commit task id → brief hash), `intent_bundles`(commit task id → `{ id, revision }`), 관점별 `target_head`를 기록한다.
  - reviewer에게는 모든 commit task의 brief(Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist)와 blueprint Contract를 준다.
  - 문서 세트 서술: commit task 묶음은 `tasks/<NNN>/{tasks,verification}.md`, 리뷰는 blueprint 루트 `review.md`.
- 실패: `review-dispatch`가 `ok: false`이거나 `target`이 고정한 base·head와 다르면 라운드를 열지 않고 리뷰를 `accepted`로 기록하지 않는다(기존 fail-closed 유지).
- 보존: `review_scope`가 없는 blueprint의 task별 리뷰 절차 전체. 각 문서에 "`review_scope`가 없으면 기존 절차"라는 분기를 한 번 명시한다. 상한(발견 1회, 수정 1회, delta 1회, drive의 critical recovery 1회)은 그대로다.

#### Interface

- 제공: 위 절차를 서술한 역할 문서·스킬·규칙 본문. 새 CLI나 gate는 없다.
- 거부
  - blueprint 리뷰 모드에서 task별 리뷰어 디스패치를 지시하는 문장을 남기지 않는다.
  - 최종 리뷰 repair를 새 제품 결정·의존성·공개 인터페이스가 필요한 finding에 쓰라고 하지 않는다. 그런 finding은 `blocked`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | Worker dispatch의 review 항목, Procedure | Modify | drive 절차 | 최종 리뷰 단계와 리뷰 원인 repair | drive의 리뷰 주체 |
| `agents/bouncer-reviewer.md` | 입력·target 서술 | Modify | reviewer 역할 | blueprint 범위 target과 여러 task brief 입력 | reviewer가 받는 입력이 바뀐다 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | Codex 사본 | seed 명령으로 재생성 | 바이트 일치 테스트 |
| `.codex/agents/bouncer-reviewer.toml` | 생성본 | Modify | Codex 사본 | seed 명령으로 재생성 | 바이트 일치 테스트 |
| `skills/bouncer-execute/SKILL.md` | 5단계 Review | Modify | 단독 실행 절차 | blueprint 리뷰 모드에서 마지막 commit task만 리뷰 | 단독 경로의 리뷰 주체 |
| `skills/bouncer-execute/references/review-round.md` | freeze·Round ledger contract | Modify | 라운드 절차 | blueprint target, `task_brief_hashes`, `intent_bundles` | 라운드 기록 계약 |
| `references/review/index.md` | Load, Review 단계 | Modify | 리뷰 산출물 계약 | 루트 `review.md`와 blueprint diff 기준 | 리뷰 스킬 본문 |
| `references/review/assets/reviewer-prompt.md` | 호출 슬롯 | Modify | reviewer 호출 틀 | 여러 task brief 슬롯 | reviewer payload |
| `skills/bouncer-run/SKILL.md` | Role 절 | Modify | drive 위임 서술 | 최종 리뷰가 coordinator 소유임을 한 문장으로 | verification node 예외 서술과 맞춘다 |
| `skills/bouncer-plan/SKILL.md` | 2·5단계의 문서 세트 서술 | Modify | 계획 절차 | 새 문서 세트(light 네 문서 포함) | scaffold 결과 서술 |
| `rules/planning.md` | Blueprint sizing rule(verification node 문단 포함), Lightweight cycle | Modify | 계획 계약 | 묶음 정의, light 네 문서 목록, verification node 문단에 blueprint 리뷰 모드의 최종 리뷰가 이 node 뒤에 열린다는 문장 | 문서 세트 정본 서술 |
| `rules/document-schema.md` | Task bundle and commit records | Modify | 문서 스키마 | 묶음 정의와 루트 리뷰 문서 | 스키마 정본 서술 |
| `references/spec-authoring/blueprint.md` | Documents 절 예시 | Modify | blueprint 본문 예시 | 리뷰 링크를 `review.md`로 | 예시가 `tasks/001/review.md`를 가리킨다 |
| `docs/workflow.md` | 묶음 서술 | Modify | 사용자용 흐름 설명 | 새 문서 세트와 최종 리뷰 시점 | 같은 문자열이 남아 있다 |
| `test/agents.test.js` | 역할 문구 단언 | Modify | 역할 문서 테스트 | 새 절차 문구 | 문구 고정 테스트 |
| `test/skill-bouncer-execute.test.js` | 5단계 단언 | Modify | 스킬 문구 테스트 | blueprint 리뷰 모드 분기 문구 | 문구 고정 테스트 |
| `test/skill-bouncer-plan.test.js` | 문서 세트 단언 | Modify | 스킬 문구 테스트 | 새 문서 세트 | 문구 고정 테스트 |
| `test/skill-bouncer-run.test.js` | Role 단언 | Modify | 스킬 문구 테스트 | 추가 문장 | 문구 고정 테스트 |
| `test/master-rules.test.js` | 규칙 문구 단언 | Modify | 규칙 문구 테스트 | 묶음 정의 | 문구 고정 테스트 |
| `test/lightweight-cycle.test.js` | light 계약 단언 | Modify | light 계약 테스트 | light 문서 목록 | 문구 고정 테스트 |
| `test/distill-decommission-audit.test.js` | 묶음 문자열 단언 | Modify | 감사 테스트 | 새 묶음 문자열 | `{tasks,verification,review}` 문자열을 단언한다 |

#### Constraints

- 역할 문서를 고친 뒤 TOML은 `node scripts/bouncer init --seed-codex-agents`로만 재생성한다.
- `npm run lint:docs`(문서 모양 검사)와 스킬 description 예산 테스트를 통과하는 범위에서 쓴다. 절차를 SKILL 본문에 길게 넣지 말고 `review-round.md`에 둔다.
- 영어 지침 문서는 영어로, 한국어 절(`rules/planning.md`의 verification node 문단)은 한국어로 유지한다.
- 위 테스트 밖의 문구 고정 테스트가 실패하면 그 파일을 고치기 전에 Scope impact로 보고한다.

### EPIC-080/BP-001/TASK-007 · `9b8034d9`

#### Goal & intent

`rounds[]`, `target`, brief hash, bundle 식별자, fingerprint가 모두 들어간 완결된 리뷰 기록 예제를 둔다.
예제가 현재 validator를 통과함을 테스트로 고정해, 스키마가 바뀌면 예제가 먼저 깨지게 한다.

#### Current behavior

- `references/spec-authoring/review.md`는 문서 전체가 예제 하나이고 `bouncer.review.findings`만 있다. `rounds[]`가 없다.
- `rounds[]`의 필수 필드는 `scripts/src/lib/templates.ts:210-219`의 주석과 `scripts/src/lib/validate-sections.ts`(`collectFindingFailures`, 247행)에만 있다.
- `skills/bouncer-execute/references/review-round.md`의 Round ledger contract는 필드를 나열하지만 예제를 가리키지 않는다. 형식을 알려면 validator 소스를 읽어야 한다.

#### Target behavior

- 성공
  - `references/spec-authoring/review-rounds.md`는 blueprint 루트 리뷰 한 건의 완결 예제다. `discovery` 라운드 1과 `delta` 라운드 2, must_fix finding 하나(`resolved`)와 advisory finding 하나(`accepted`, note 있음)를 담는다.
  - 각 라운드는 `round`, `mode`, `target`(`base`, `head`), `perspectives`(각 항목의 `target_head`가 `target.head`와 같음), `task_brief_hashes`(commit task id → brief hash), `intent_bundles`(commit task id → `{ id, revision }`), `previous_finding_ids`, `new`·`resolved`·`regressed`를 갖는다.
  - 각 finding은 `category`, `brief_clause`, `file`, `symbol`, `fingerprint`(`<category>:<brief_clause>:<file>#<symbol>`), `actionability`, `origin`, `first_seen_round`, `last_seen_round`를 갖는다.
  - 테스트가 이 파일의 frontmatter와 본문을 `collectFindingFailures`(execute 계약, `reviewStatus: 'accepted'`)에 넣어 반환 배열이 `[]`임을 단언한다.
  - `review-round.md`의 Round ledger contract와 `references/spec-authoring/index.md`의 예시 목록이 이 파일을 가리킨다.
- 실패: 없음(런타임 동작을 바꾸지 않는다). 판정 근거는 위 테스트다.
- 보존: `references/spec-authoring/review.md`의 기존 `findings`만 있는 예제. `review_scope`가 없는 blueprint의 task 리뷰는 `rounds` 없이도 유효하다. 루트 리뷰는 `rounds[]`가 필수다(task 003의 G21).

#### Interface

- 제공: 예제 문서 `references/spec-authoring/review-rounds.md`. 릴리스 산출물에는 `references/` 디렉터리 규칙으로 포함된다(`package.json` `files`).
- 거부: 예제에 실제 epic·blueprint의 식별자나 커밋 SHA를 쓰지 않는다. SHA는 40자 16진 더미 값으로 쓴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/review-rounds.md` | 문서 전체 | Create | 없음 | `rounds[]` 완결 예제 | 한 파일이 frontmatter 하나만 가질 수 있어 기존 예제 파일에 두 번째 frontmatter를 둘 수 없다 |
| `references/spec-authoring/index.md` | 2단계의 예시 목록 | Modify | 종류별 예시 안내 | `review-rounds.md` 추가 | 예시 목록이 여기 있다 |
| `skills/bouncer-execute/references/review-round.md` | Round ledger contract | Modify | 라운드 기록 계약 | 예제 경로를 가리키는 한 문장 | 기록하는 시점에 읽는 문서 |
| `test/skill-spec-authoring.test.js` | 신규 테스트 | Modify | spec-authoring 문서 테스트 | 예제를 validator에 통과시키는 테스트 | 예제와 스키마의 고정점 |

#### Constraints

- 예제 본문은 한국어, 식별자와 enum 값은 원문 그대로 쓴다.
- 예제 frontmatter의 `resource`는 예시 경로이고 실제 파일을 가리키지 않아도 된다(기존 `review.md` 예제와 같다).
- `review-round.md`가 서술하는 필드 이름은 task 006이 확정한 이름(`task_brief_hashes`, `intent_bundles`)과 같아야 한다.

### EPIC-080/BP-001/TASK-008

#### Goal & intent

task 001~007이 모두 통합된 상태에서 저장소의 병합 전 명령이 통과함을 증명한다(epic Success criteria 8).

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-080/BP-001/TASK-009 · `ecc5bc9e`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/seed-worktree.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/distill-decommission-audit.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
