---
type: bouncer.verification
title: 범위 판단 근거 문서 전환을 검증함
description: Verification for 002
resource: .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-18T08:59:21.200+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '040'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-18T09:48:39.693+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (18.764997ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.870566ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.721931ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.203346ms)
      ✔ readVerifyCommand rejects non-single executable commands (6.560835ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.281053ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.372285ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.848896ms)
      ✔ readVerifyCommand narrows to the pointer task document (11.549029ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.878356ms)
      ✔ runVerification rejects missing unit verification.md without creating it (6.136538ms)
      ℹ tests 692
      ℹ suites 0
      ℹ pass 692
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 740.973633
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-18T09:48:39.693+09:00
Exit code: 0
