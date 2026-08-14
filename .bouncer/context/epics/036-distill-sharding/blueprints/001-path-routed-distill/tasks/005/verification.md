---
type: bouncer.verification
title: 워크플로 소비 계약 검증함
description: Verification for 005
resource: .bouncer/context/epics/036-distill-sharding/blueprints/001-path-routed-distill/tasks/005/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T12:56:28.304+09:00'
bouncer:
  id: VERIFY-005
  epic_id: '036'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T14:40:07.761+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (17.48738ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (4.120181ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.966241ms)
      ✔ runVerification falls back to config.verify when the task document is absent (2.973719ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.331724ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.250031ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.549669ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.689241ms)
      ✔ readVerifyCommand narrows to the pointer task document (11.757931ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.469441ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.477119ms)
      ℹ tests 652
      ℹ suites 0
      ℹ pass 652
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 719.145371
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T14:40:07.761+09:00
Exit code: 0
