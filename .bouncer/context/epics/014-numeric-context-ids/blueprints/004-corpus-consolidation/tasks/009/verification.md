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
    ran_at: '2026-09-02T17:23:54.170+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (30.506927ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.883875ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.512596ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.114322ms)
      ✔ readVerifyCommand rejects non-single executable commands (14.193824ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.348118ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.158319ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.125507ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.747798ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.541755ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.271251ms)
      ℹ tests 983
      ℹ suites 0
      ℹ pass 983
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1926.867288
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-02T17:23:54.170+09:00
Exit code: 0
