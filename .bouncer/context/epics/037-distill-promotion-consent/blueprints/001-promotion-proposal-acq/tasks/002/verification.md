---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T16:25:12.646+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '037'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T17:07:50.465+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (17.831196ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.660141ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.899264ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.216897ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.371926ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.275134ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.673802ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.702891ms)
      ✔ readVerifyCommand narrows to the pointer task document (11.823779ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (7.48125ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.772576ms)
      ℹ tests 663
      ℹ suites 0
      ℹ pass 663
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 709.092929
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T17:07:50.465+09:00
Exit code: 0
