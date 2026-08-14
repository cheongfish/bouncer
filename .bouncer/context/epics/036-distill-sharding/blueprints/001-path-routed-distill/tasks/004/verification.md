---
type: bouncer.verification
title: graph와 범위 통합 검증함
description: Verification for 004
resource: .bouncer/context/epics/036-distill-sharding/blueprints/001-path-routed-distill/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T12:56:28.271+09:00'
bouncer:
  id: VERIFY-004
  epic_id: '036'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T14:27:20.155+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (20.917099ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.917691ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (4.337852ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.355992ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.61854ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.258408ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.366895ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.745467ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.256604ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.27571ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.649829ms)
      ℹ tests 648
      ℹ suites 0
      ℹ pass 648
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 724.465998
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T14:27:20.155+09:00
Exit code: 0
