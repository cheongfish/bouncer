---
type: bouncer.verification
title: 범위 판단 근거 계약 회귀를 검증함
description: Verification for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/005-scope-evidence-contract/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-18T08:58:48.535+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '060'
  blueprint_id: '005'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-18T09:40:51.275+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (18.837912ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (3.892263ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (3.929842ms)
      ✔ runVerification falls back to config.verify when the task document is absent (3.665768ms)
      ✔ readVerifyCommand rejects non-single executable commands (7.384632ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (0.242387ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (1.556193ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (1.685358ms)
      ✔ readVerifyCommand narrows to the pointer task document (12.59875ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (8.809776ms)
      ✔ runVerification rejects missing unit verification.md without creating it (7.861096ms)
      ℹ tests 692
      ℹ suites 0
      ℹ pass 692
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 739.196335
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-18T09:40:51.275+09:00
Exit code: 0
