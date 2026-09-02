---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '018'
  blueprint_id: '019'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-22T14:57:27.962+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (25.376416ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (8.234969ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (6.105016ms)
      ✔ runVerification falls back to config.verify when the task document is absent (7.494575ms)
      ✔ readVerifyCommand rejects non-single executable commands (16.17693ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (1.636276ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.919345ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.937115ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.634989ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (10.527335ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.825158ms)
      ℹ tests 738
      ℹ suites 0
      ℹ pass 738
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 712.741217
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-22T14:57:27.962+09:00
Exit code: 0
