---
type: bouncer.verification
title: 004 verification
description: verification for 004
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-07T03:55:58.196Z'
bouncer:
  id: VERIFY-004
  epic_id: '018'
  blueprint_id: '010'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-07T13:30:06.519+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (17.803021ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.606114ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.549727ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.344283ms)
      ✔ readVerifyCommand rejects non-single executable commands (5.920158ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.219693ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.585951ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.703782ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.0164ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.439444ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.612337ms)
      ℹ tests 439
      ℹ suites 0
      ℹ pass 439
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 454.361374
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-07T13:30:06.519+09:00
Exit code: 0
