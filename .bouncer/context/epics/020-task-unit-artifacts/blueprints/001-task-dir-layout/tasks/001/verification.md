---
type: bouncer.verification
title: 003 verification
description: Verification for TASKS-003
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '020'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-07T12:40:01.993+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (19.478498ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (4.344632ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.765061ms)
      ✔ runVerification falls back to config.verify when tasks.md is absent (3.866571ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.248807ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.326898ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.641855ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.726498ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.563671ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.334207ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.876634ms)
      ℹ tests 432
      ℹ suites 0
      ℹ pass 432
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 463.167421
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-07T12:40:01.993+09:00
Exit code: 0
