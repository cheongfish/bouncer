---
type: bouncer.verification
title: 실제 worktree를 대상으로 한 회귀 테스트로 검증함
description: Verification for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/002-seed-plan-artifacts/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-03T05:30:59.813Z'
bouncer:
  id: VERIFY-001
  epic_id: '018'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-03T06:00:03.769Z'
    exit_code: 0
    output_tail: |-
      ✔ legacy root context blueprint is not a canonical validation target (0.193239ms)
      ✔ S11: a blueprint with no documents is reported as absent, not as a gate failure (0.323009ms)
      ✔ S11 does not mask a partially scaffolded blueprint (0.438259ms)
      ✔ runVerification records successful command evidence (6.799106ms)
      ✔ runVerification records failed command evidence (4.487988ms)
      ✔ runVerification rejects a missing configured command (0.694089ms)
      ✔ runVerification rejects a missing verification document (0.489117ms)
      ✔ runVerification rejects a non-canonical blueprint path before execution (0.384351ms)
      ✔ executeVerify accepts successful commands with over one megabyte of output (17.547808ms)
      ✔ a passing verification keeps no output block in the body (15.104145ms)
      ✔ a failing verification keeps the output where a reader will see it (14.421642ms)
      ℹ tests 261
      ℹ suites 0
      ℹ pass 261
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 366.457942
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-03T06:00:03.769Z
Exit code: 0
