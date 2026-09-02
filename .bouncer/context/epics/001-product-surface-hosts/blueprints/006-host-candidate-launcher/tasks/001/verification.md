---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/006-host-candidate-launcher/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-24T15:31:47.607+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '001'
  blueprint_id: '006'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-24T15:53:18.076+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (25.724562ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (8.756954ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (8.286166ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.14013ms)
      ✔ readVerifyCommand rejects non-single executable commands (16.099321ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.108883ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.592627ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.13926ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.16596ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.795668ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.588201ms)
      ℹ tests 767
      ℹ suites 0
      ℹ pass 767
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 895.983048
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-24T15:53:18.076+09:00
Exit code: 0
