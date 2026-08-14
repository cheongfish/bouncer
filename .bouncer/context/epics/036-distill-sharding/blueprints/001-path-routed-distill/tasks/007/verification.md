---
type: bouncer.verification
title: 선택 라우팅 활성화 검증함
description: Verification for 007
resource: .bouncer/context/epics/036-distill-sharding/blueprints/001-path-routed-distill/tasks/007/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-14T12:56:28.372+09:00'
bouncer:
  id: VERIFY-007
  epic_id: '036'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-14T15:11:17.715+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (17.961855ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (4.029759ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.906809ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.035673ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.45049ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.281409ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.663183ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.726158ms)
      ✔ readVerifyCommand narrows to the pointer task document (11.443613ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.160609ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.921713ms)
      ℹ tests 656
      ℹ suites 0
      ℹ pass 656
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 730.677017
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-14T15:11:17.715+09:00
Exit code: 0
