---
type: bouncer.verification
title: 011 verification
description: Verification for 011
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/011/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T21:18:40.452+09:00'
bouncer:
  id: VERIFY-011
  epic_id: '014'
  blueprint_id: '004'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-02T17:17:44.457+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (24.065968ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (8.404859ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (8.002531ms)
      ✔ runVerification falls back to config.verify when the task document is absent (7.610569ms)
      ✔ readVerifyCommand rejects non-single executable commands (14.796581ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.650875ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (5.307572ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.582695ms)
      ✔ readVerifyCommand narrows to the pointer task document (13.472423ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.117667ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.811825ms)
      ℹ tests 983
      ℹ suites 0
      ℹ pass 983
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1910.366074
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-02T17:17:44.457+09:00
Exit code: 0
