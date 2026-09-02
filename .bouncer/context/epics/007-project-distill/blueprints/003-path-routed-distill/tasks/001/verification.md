---
type: bouncer.verification
title: 샤드 라우팅 계약 검증함
description: Verification for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T12:56:28.171+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '007'
  blueprint_id: '003'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T13:34:19.693+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (126.173681ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (28.707214ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (25.583668ms)
      ✔ runVerification falls back to config.verify when the task document is absent (24.356492ms)
      ✔ readVerifyCommand rejects non-single executable commands (51.525393ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (3.222914ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (12.544933ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (13.448656ms)
      ✔ readVerifyCommand narrows to the pointer task document (82.772804ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (57.041588ms)
      ✔ runVerification rejects missing unit verification.md without creating it (48.558047ms)
      ℹ tests 627
      ℹ suites 0
      ℹ pass 627
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 2781.534976
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T13:34:19.693+09:00
Exit code: 0
