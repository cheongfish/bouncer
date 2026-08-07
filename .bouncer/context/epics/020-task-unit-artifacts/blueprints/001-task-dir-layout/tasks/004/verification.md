---
type: bouncer.verification
title: 004 verification
description: verification for 004
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-07T03:55:58.196Z'
bouncer:
  id: VERIFY-004
  epic_id: '020'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-07T13:23:16.315+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (18.818074ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.675021ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.621196ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.22867ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.192382ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.288788ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.40971ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.657588ms)
      ✔ readVerifyCommand narrows to the pointer task document (13.07183ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (7.427909ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.667643ms)
      ℹ tests 439
      ℹ suites 0
      ℹ pass 439
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 466.332431
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-07T13:23:16.315+09:00
Exit code: 0
