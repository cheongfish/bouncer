---
type: bouncer.tasks
title: workflow lifecycle epic을 018로 통합함
description: Moves workflow lifecycle blueprints into canonical epic 018 and removes the duplicate 024 hierarchy.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:27.347+09:00'
bouncer:
  id: TASKS-001
  epic_id: '014'
  blueprint_id: '004'
  status: verified
  verify: npm test
  commit_intent:
    - workflow lifecycle 결정이 002부터 024와 후속 epic에 분산되어 한 흐름으로 탐색되지 않음
    - 모든 lifecycle BP를 018 아래 순차 이동해 중복 024와 부모 경로를 함께 해소함
  affected_paths:
    - .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/distill.md
    - .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/index.md
    - .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/review.md
    - .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/tasks.md
    - .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/verification.md
    - .bouncer/context/epics/002-commit-artifacts/index.md
    - .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/distill.md
    - .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/index.md
    - .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/review.md
    - .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/tasks.md
    - .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/verification.md
    - .bouncer/context/epics/008-worktree-seed/index.md
    - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/distill.md
    - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/index.md
    - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/review.md
    - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/tasks.md
    - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/verification.md
    - .bouncer/context/epics/010-active-pointer-cli/index.md
    - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/distill.md
    - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/index.md
    - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/review.md
    - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/tasks.md
    - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/verification.md
    - .bouncer/context/epics/012-finalize-handoff/index.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/explain.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/index.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/review.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/tasks.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/verification.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/explain.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/index.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/review.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/tasks.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/verification.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/explain.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/index.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/review.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/tasks.md
    - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/verification.md
    - .bouncer/context/epics/013-comprehension-gate/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/distill.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/distill.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/distill.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/distill.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/context-review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/context-review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/context-review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/explain.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/index.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/verification.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/review.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/tasks.md
    - .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/verification.md
    - .bouncer/context/epics/018-task-unit-commits/index.md
    - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/explain.md
    - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/index.md
    - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/review.md
    - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/tasks.md
    - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/verification.md
    - .bouncer/context/epics/019-task-pointer/index.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/index.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/review.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/tasks.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/verification.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/review.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/tasks.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/verification.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/review.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/tasks.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/verification.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/review.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/tasks.md
    - .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/verification.md
    - .bouncer/context/epics/020-task-unit-artifacts/index.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/explain.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/index.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/review.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/tasks.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/verification.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/review.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/tasks.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/verification.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/review.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/tasks.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/verification.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/review.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/tasks.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/verification.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/review.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/tasks.md
    - .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/verification.md
    - .bouncer/context/epics/021-task-commit-stage/index.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/explain.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/index.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/review.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/tasks.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/verification.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/review.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/tasks.md
    - .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/verification.md
    - .bouncer/context/epics/022-blueprint-closure/index.md
    - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/explain.md
    - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/index.md
    - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/review.md
    - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/tasks.md
    - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/verification.md
    - .bouncer/context/epics/023-worktree-layout/index.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/explain.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/index.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/review.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/tasks.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/verification.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/review.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/tasks.md
    - .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/verification.md
    - .bouncer/context/epics/024-light-path/index.md
    - .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/explain.md
    - .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/index.md
    - .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/review.md
    - .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/tasks.md
    - .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/verification.md
    - .bouncer/context/epics/024-lightweight-cycle/index.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/explain.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/index.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/review.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/tasks.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/verification.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/review.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/tasks.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/verification.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/review.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/tasks.md
    - .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/verification.md
    - .bouncer/context/epics/030-gate-restructure/index.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/context-review.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/explain.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/index.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/review.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/tasks.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/verification.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/index.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/context-review.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/explain.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/index.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/review.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/tasks.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/verification.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/review.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/tasks.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/verification.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/review.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/tasks.md
    - .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/verification.md
    - .bouncer/context/epics/042-gate-integrity/index.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/context-review.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/explain.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/index.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/review.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/tasks.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/verification.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/review.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/tasks.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/verification.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/review.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/tasks.md
    - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/verification.md
    - .bouncer/context/epics/044-finalize-evidence/index.md
    - .bouncer/context/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:27.347+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - context graph query produced no safe file ranking for corpus migration
        - migration scope is confirmed from the explicit canonical mapping
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: canonical corpus migration task 001
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 001
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 001
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
002, 008, 010, 012, 013, 018–024, 030, 041, 042, 044의 BP를 `018-task-unit-commits` 아래 순차 이동한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: context index에는 canonical `018` 행 하나와 모든 이동 BP의 유효한 부모 링크가 남는다.
- 거부: `024-light-path`·`024-lightweight-cycle`을 별도 epic으로 보존하지 않는다.

## Touch
- Modify `.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/008-worktree-seed/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/013-comprehension-gate/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/003-current-command/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/004-next-blueprint-handoff/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/007-promotion-pr-body/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/015-lightweight-cycle-guidance/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/019-task-pointer/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/023-worktree-layout/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-light-path/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/024-lightweight-cycle/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/030-gate-restructure/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/042-gate-integrity/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/044-finalize-evidence/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/context-digest.ts` — 검색 파이프라인은 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- BP bundle은 통째로 이동하며 harness-owned ID·resource·상대 링크를 같은 commit에서 갱신한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] old path 검색으로 이동 대상과 참조의 닫힌 inventory를 만든다.
- [ ] BP를 순차 번호로 이동하고 024 중복 epic directory를 제거한다.
- [ ] structural validation과 `npm test`로 모든 parent/resource를 검증한다.

