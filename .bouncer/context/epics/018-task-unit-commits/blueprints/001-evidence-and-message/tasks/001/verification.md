---
type: bouncer.verification
title: npm test 199개 통과, 종료 코드 0
description: Verification for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-07-27T04:53:44.163Z'
bouncer:
  id: VERIFY-001
  epic_id: '018'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-07-27T05:04:58.458Z'
    exit_code: 0
    output_tail: |-
      ✔ legacy root context blueprint is not a canonical validation target (0.200624ms)
      ✔ S11: a blueprint with no documents is reported as absent, not as a gate failure (0.318768ms)
      ✔ S11 does not mask a partially scaffolded blueprint (0.4414ms)
      ✔ runVerification records successful command evidence (4.605723ms)
      ✔ runVerification records failed command evidence (1.017098ms)
      ✔ runVerification rejects a missing configured command (0.504003ms)
      ✔ runVerification rejects a missing verification document (0.309112ms)
      ✔ runVerification rejects a non-canonical blueprint path before execution (0.233591ms)
      ✔ executeVerify accepts successful commands with over one megabyte of output (19.66186ms)
      ✔ a passing verification keeps no output block in the body (14.770053ms)
      ✔ a failing verification keeps the output where a reader will see it (16.151072ms)
      ℹ tests 199
      ℹ suites 0
      ℹ pass 199
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 193.965565
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-07-27T05:04:58.458Z
Exit code: 0
