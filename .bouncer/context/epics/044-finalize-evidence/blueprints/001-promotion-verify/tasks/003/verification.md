---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-22T14:16:25.888+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '044'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-22T15:39:43.211+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (21.86826ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.431987ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.611878ms)
      ✔ runVerification falls back to config.verify when the task document is absent (7.313749ms)
      ✔ readVerifyCommand rejects non-single executable commands (14.204264ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.576801ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.286602ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.084281ms)
      ✔ readVerifyCommand narrows to the pointer task document (13.464251ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (10.502261ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.031975ms)
      ℹ tests 742
      ℹ suites 0
      ℹ pass 742
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 818.162901
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-22T15:39:43.211+09:00
Exit code: 0
