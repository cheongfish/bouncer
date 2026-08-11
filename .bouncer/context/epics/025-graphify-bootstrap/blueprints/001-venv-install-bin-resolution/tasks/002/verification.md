---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-11T13:29:26.090+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '025'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-11T14:17:41.748+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 7.476592
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 514 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 8.209713
        type: 'test'
        ...
      1..514
      # tests 514
      # suites 0
      # pass 514
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 508.845812
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-11T14:17:41.748+09:00
Exit code: 0
