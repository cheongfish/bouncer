---
type: bouncer.verification
title: 010 verification
description: Verification for 010
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/010/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T21:18:40.416+09:00'
bouncer:
  id: VERIFY-010
  epic_id: '014'
  blueprint_id: '004'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-02T13:37:01.609+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (25.958989ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.845092ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.885759ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.635731ms)
      ✔ readVerifyCommand rejects non-single executable commands (17.061316ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.206583ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.594171ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.655196ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.814843ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.278006ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.405706ms)
      ℹ tests 983
      ℹ suites 0
      ℹ pass 983
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1908.200791
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-02T13:37:01.609+09:00
Exit code: 0
