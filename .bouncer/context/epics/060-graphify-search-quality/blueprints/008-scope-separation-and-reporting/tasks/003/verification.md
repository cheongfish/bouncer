---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/008-scope-separation-and-reporting/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T15:49:12.636+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '060'
  blueprint_id: '008'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-01T20:56:48.492+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (22.728288ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (8.865111ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.290034ms)
      ✔ runVerification falls back to config.verify when the task document is absent (10.779282ms)
      ✔ readVerifyCommand rejects non-single executable commands (15.07309ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.514416ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.834201ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.538909ms)
      ✔ readVerifyCommand narrows to the pointer task document (14.606867ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (10.265444ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.510331ms)
      ℹ tests 976
      ℹ suites 0
      ℹ pass 976
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1923.507606
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-01T20:56:48.492+09:00
Exit code: 0
