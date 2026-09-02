---
type: bouncer.verification
title: 009 verification
description: Verification for 009
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/009/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T21:18:40.380+09:00'
bouncer:
  id: VERIFY-009
  epic_id: '014'
  blueprint_id: '004'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-02T12:51:08.776+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (24.163503ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (8.136216ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.731683ms)
      ✔ runVerification falls back to config.verify when the task document is absent (9.094832ms)
      ✔ readVerifyCommand rejects non-single executable commands (16.767516ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.632822ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.112428ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.427682ms)
      ✔ readVerifyCommand narrows to the pointer task document (14.85185ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.965086ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.007856ms)
      ℹ tests 983
      ℹ suites 0
      ℹ pass 983
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1963.550998
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-02T12:51:08.776+09:00
Exit code: 0
