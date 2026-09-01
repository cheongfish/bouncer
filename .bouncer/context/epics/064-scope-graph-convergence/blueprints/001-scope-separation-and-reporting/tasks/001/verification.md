---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T15:49:01.158+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '064'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-01T20:38:52.145+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (21.190985ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.101291ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.580797ms)
      ✔ runVerification falls back to config.verify when the task document is absent (7.723216ms)
      ✔ readVerifyCommand rejects non-single executable commands (17.074297ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.296731ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.466609ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.668873ms)
      ✔ readVerifyCommand narrows to the pointer task document (13.165542ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (10.826439ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.246348ms)
      ℹ tests 976
      ℹ suites 0
      ℹ pass 976
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1828.466953
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-01T20:38:52.145+09:00
Exit code: 0
