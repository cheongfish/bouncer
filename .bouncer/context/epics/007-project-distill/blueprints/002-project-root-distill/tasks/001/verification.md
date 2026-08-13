---
type: bouncer.verification
title: 프로젝트 루트 CLI와 Distill 경로 계약을 검증함
description: Verification for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/002-project-root-distill/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-13T15:07:32.982+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '007'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-13T15:25:09.154+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 7.978986
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 614 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 7.52756
        type: 'test'
        ...
      1..614
      # tests 614
      # suites 0
      # pass 614
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 614.135935
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-13T15:25:09.154+09:00
Exit code: 0
