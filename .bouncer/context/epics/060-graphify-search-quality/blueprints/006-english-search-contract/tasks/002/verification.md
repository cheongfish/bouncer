---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/006-english-search-contract/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T16:19:11.045+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '060'
  blueprint_id: '006'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-31T16:42:21.524+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (21.32647ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.950874ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.289034ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.337088ms)
      ✔ readVerifyCommand rejects non-single executable commands (15.568666ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.800776ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.818875ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.691388ms)
      ✔ readVerifyCommand narrows to the pointer task document (15.590862ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.875582ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.182155ms)
      ℹ tests 962
      ℹ suites 0
      ℹ pass 962
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1853.977136
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-31T16:42:21.524+09:00
Exit code: 0
