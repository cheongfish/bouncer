---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-11T13:29:26.127+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '025'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-11T14:33:02.781+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 7.748757
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 515 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 8.483154
        type: 'test'
        ...
      1..515
      # tests 515
      # suites 0
      # pass 515
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 504.95284
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-11T14:33:02.781+09:00
Exit code: 0
