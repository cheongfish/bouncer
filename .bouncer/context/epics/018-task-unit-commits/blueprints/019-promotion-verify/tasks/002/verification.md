---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-22T14:16:25.856+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '018'
  blueprint_id: '019'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-22T15:34:48.804+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (21.724248ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.682077ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (6.950276ms)
      ✔ runVerification falls back to config.verify when the task document is absent (7.258808ms)
      ✔ readVerifyCommand rejects non-single executable commands (15.01634ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.449462ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.888816ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.313104ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.828443ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.621673ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.999883ms)
      ℹ tests 742
      ℹ suites 0
      ℹ pass 742
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 847.918892
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-22T15:34:48.804+09:00
Exit code: 0
