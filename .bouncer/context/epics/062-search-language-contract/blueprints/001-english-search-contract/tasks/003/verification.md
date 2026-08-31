---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T16:19:11.078+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '062'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-31T16:45:06.146+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (26.345998ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.482701ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.604412ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.296041ms)
      ✔ readVerifyCommand rejects non-single executable commands (15.199874ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (3.059291ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.479794ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.882761ms)
      ✔ readVerifyCommand narrows to the pointer task document (14.053246ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.867485ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.501053ms)
      ℹ tests 963
      ℹ suites 0
      ℹ pass 963
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1906.326984
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-31T16:45:06.146+09:00
Exit code: 0
