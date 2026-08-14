---
type: bouncer.verification
title: 샤드 구조 검사 검증함
description: Verification for 003
resource: .bouncer/context/epics/036-distill-sharding/blueprints/001-path-routed-distill/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T12:56:28.237+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '036'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T14:15:11.810+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (18.843708ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (4.039893ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.628649ms)
      ✔ runVerification falls back to config.verify when the task document is absent (2.978824ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.612085ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.24579ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.74757ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.734978ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.83671ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.318921ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.225391ms)
      ℹ tests 643
      ℹ suites 0
      ℹ pass 643
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 623.701129
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T14:15:11.810+09:00
Exit code: 0
