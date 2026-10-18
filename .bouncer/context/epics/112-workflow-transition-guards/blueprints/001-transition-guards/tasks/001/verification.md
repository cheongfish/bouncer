---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js test/commit-task.test.js
    ran_at: '2026-10-18T14:39:35.215+09:00'
    exit_code: 0
    output_tail: |-
      ✔ worker-model-perspective-invalid hint → names every perspective the core accepts (1050.672781ms)
      ✔ worker-model on a promotion_stopped ledger → refuses with promotion-stopped and keeps the ledger bytes (208.888463ms)
      ✔ verification integrate when the runner rejects missing dependencies → records no failure and keeps evidence (135.921151ms)
      ✔ terminal failure with --resume-task of an integrated task → reassigns it without adding a task or changing scope and DAG (180.048747ms)
      ✔ resumed task is prepared → new lease generation on a worker cut from the current integration HEAD, terminal waits, old lease is stale (284.004327ms)
      ✔ --resume-task with an unsafe selection → rejects before any mutation and keeps the failure state (318.487719ms)
      ✔ --resume-task of a task that is not integrated yet → rejects as resume-task-invalid (179.469008ms)
      ✔ resume ledger write fails → task documents and ledger keep their previous bytes (179.818123ms)
      ✔ terminal failure records its evidence and source identity → disposition can bind to them (155.314127ms)
      ✔ --disposition outside_scope with the original evidence and an unowned path → records it and keeps failure and verifying (183.115856ms)
      ✔ --disposition outside_scope with weak or mismatched grounds → rejects and leaves the ledger untouched (684.835602ms)
      ℹ tests 312
      ℹ suites 0
      ℹ pass 312
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 52466.453421
    evidence_id: cc7231320afa68f1d4cd2db7a1c271d34f5abb215d5d96267f46cfd567c4b0b1
    identity:
      head: 37b7801ec863a0982acf3504f64e95e6e94d32ab
      dirty_digest: ea2363df45687cb1e8eff56393375dc97f945766c10a3bed25173580b761997b
      command: node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js test/commit-task.test.js
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: task
        key: EPIC-112/BP-001/TASK-001
    scope: *ref_0
    reused: false
    source_digest: 2755f91214fd512f8e00ea2808565f38e7a6299b8f67528a6dbcaaa073a15228
---
# Verification

## Command
`node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js test/commit-task.test.js`

## Evidence
Ran at: 2026-10-18T14:39:35.215+09:00
Exit code: 0
