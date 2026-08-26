---
type: bouncer.verification
title: 스모크 실패 문서와 ci 통과를 확인함
description: Verification for 003
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-25T21:30:57.829+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '052'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-26T09:12:31.600+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 11.932881
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 808 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 8.624736
        type: 'test'
        ...
      1..808
      # tests 808
      # suites 0
      # pass 808
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 1373.78702
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-26T09:12:31.600+09:00
Exit code: 0
