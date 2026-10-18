---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:00:19.980+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: node --test test/coordinator.test.js
    ran_at: '2026-10-18T15:21:36.739+09:00'
    exit_code: 0
    output_tail: |-
      ✔ worker-model-perspective-invalid hint → names every perspective the core accepts (1172.199661ms)
      ✔ worker-model on a promotion_stopped ledger → refuses with promotion-stopped and keeps the ledger bytes (216.824149ms)
      ✔ verification integrate when the runner rejects missing dependencies → records no failure and keeps evidence (141.752761ms)
      ✔ terminal failure with --resume-task of an integrated task → reassigns it without adding a task or changing scope and DAG (186.826411ms)
      ✔ resumed task is prepared → new lease generation on a worker cut from the current integration HEAD, terminal waits, old lease is stale (304.593127ms)
      ✔ --resume-task with an unsafe selection → rejects before any mutation and keeps the failure state (321.664437ms)
      ✔ --resume-task of a task that is not integrated yet → rejects as resume-task-invalid (180.944767ms)
      ✔ resume ledger write fails → task documents and ledger keep their previous bytes (181.538702ms)
      ✔ terminal failure records its evidence and source identity → disposition can bind to them (158.31468ms)
      ✔ --disposition outside_scope with the original evidence and an unowned path → records it and keeps failure and verifying (187.970708ms)
      ✔ --disposition outside_scope with weak or mismatched grounds → rejects and leaves the ledger untouched (697.745869ms)
      ℹ tests 191
      ℹ suites 0
      ℹ pass 191
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 60846.762748
    evidence_id: eb3a858cc26402c0a6953450dc411543b15094577270f0335869f468333c862a
    identity:
      head: 5dfbe59a6735eaf67da186fa3207128b937f1f5d
      dirty_digest: eb459a504eba556618b11e4231541ec425227e96f1e62b62de76ed3242778468
      command: node --test test/coordinator.test.js
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: task
        key: EPIC-112/BP-001/TASK-003
    scope: *ref_0
    reused: false
    source_digest: b3dd49eeeb71c6b054de3abd822a102b15de012c9ef5ec815c858b763100805c
---
# Verification

## Command
`node --test test/coordinator.test.js`

## Evidence
Ran at: 2026-10-18T15:21:36.739+09:00
Exit code: 0
