---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T16:25:12.612+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '037'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T16:45:47.107+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (19.605325ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (4.2913ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.683911ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.140082ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.562564ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.243332ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.699888ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.591351ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.75178ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (9.149145ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.650276ms)
      ℹ tests 658
      ℹ suites 0
      ℹ pass 658
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 711.303426
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T16:45:47.107+09:00
Exit code: 0
