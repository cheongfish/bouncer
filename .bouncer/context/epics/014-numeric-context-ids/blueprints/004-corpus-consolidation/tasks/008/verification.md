---
type: bouncer.verification
title: 008 verification
description: Verification for 008
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/008/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T21:18:40.347+09:00'
bouncer:
  id: VERIFY-008
  epic_id: '014'
  blueprint_id: '004'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-02T11:04:31.700+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 11.735859
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 983 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 9.970602
        type: 'test'
        ...
      1..983
      # tests 983
      # suites 0
      # pass 983
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 3202.470685
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-02T11:04:31.700+09:00
Exit code: 0
