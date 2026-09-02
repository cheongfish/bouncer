---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-08T13:17:10.238+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '018'
  blueprint_id: '012'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-08T14:24:20.206+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (18.347053ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.170798ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.545995ms)
      ✔ runVerification falls back to config.verify when the task document is absent (2.930451ms)
      ✔ readVerifyCommand rejects non-single executable commands (7.307978ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.271261ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.69721ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.730609ms)
      ✔ readVerifyCommand narrows to the pointer task document (11.199882ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (7.97566ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.323014ms)
      ℹ tests 482
      ℹ suites 0
      ℹ pass 482
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 730.783061
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-08T14:24:20.206+09:00
Exit code: 0
