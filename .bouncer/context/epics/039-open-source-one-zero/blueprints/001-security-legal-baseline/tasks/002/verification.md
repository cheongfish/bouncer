---
type: bouncer.verification
title: 공개 라이선스와 기여 정책을 검증함
description: Verification for 002
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-15T15:37:35.704+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '039'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-15T16:33:47.999+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (17.654709ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.787998ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.411089ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.579634ms)
      ✔ readVerifyCommand rejects non-single executable commands (7.298301ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.410862ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.949812ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.927481ms)
      ✔ readVerifyCommand narrows to the pointer task document (10.928565ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (7.767945ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.966668ms)
      ℹ tests 676
      ℹ suites 0
      ℹ pass 676
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 678.363849
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-15T16:33:47.999+09:00
Exit code: 0
