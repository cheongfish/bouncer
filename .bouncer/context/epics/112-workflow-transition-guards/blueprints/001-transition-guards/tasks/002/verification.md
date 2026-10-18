---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:00:19.811+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js
    ran_at: '2026-10-18T15:05:40.298+09:00'
    exit_code: 0
    output_tail: |-
      ✔ worker-model-perspective-invalid hint → names every perspective the core accepts (1107.00725ms)
      ✔ worker-model on a promotion_stopped ledger → refuses with promotion-stopped and keeps the ledger bytes (220.775817ms)
      ✔ verification integrate when the runner rejects missing dependencies → records no failure and keeps evidence (146.253485ms)
      ✔ terminal failure with --resume-task of an integrated task → reassigns it without adding a task or changing scope and DAG (185.66597ms)
      ✔ resumed task is prepared → new lease generation on a worker cut from the current integration HEAD, terminal waits, old lease is stale (292.758874ms)
      ✔ --resume-task with an unsafe selection → rejects before any mutation and keeps the failure state (328.107995ms)
      ✔ --resume-task of a task that is not integrated yet → rejects as resume-task-invalid (187.853136ms)
      ✔ resume ledger write fails → task documents and ledger keep their previous bytes (185.207989ms)
      ✔ terminal failure records its evidence and source identity → disposition can bind to them (162.0373ms)
      ✔ --disposition outside_scope with the original evidence and an unowned path → records it and keeps failure and verifying (191.129659ms)
      ✔ --disposition outside_scope with weak or mismatched grounds → rejects and leaves the ledger untouched (742.991833ms)
      ℹ tests 291
      ℹ suites 0
      ℹ pass 291
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 57470.299717
    evidence_id: a00684931e2a0260d718b32f5e14c2ae6fb2a8fad7e6b45192cfabf2e91f4b5a
    identity:
      head: 70876f4c831859d60b4520bd641761b7d7e28611
      dirty_digest: ed4a282ca8035497d09b6d2398b16c7d5776f9f7bcc12940638fbfb47bbb5102
      command: node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: task
        key: EPIC-112/BP-001/TASK-002
    scope: *ref_0
    reused: false
    source_digest: b6669e0a7477cd87eade50d88a2798b14a77d2765cd0da5d19241e7d040d7057
---
# Verification

## Command
`node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js`

## Evidence
Ran at: 2026-10-18T15:05:40.298+09:00
Exit code: 0
