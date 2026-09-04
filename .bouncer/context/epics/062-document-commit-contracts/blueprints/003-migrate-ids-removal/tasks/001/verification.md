---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-04T13:25:50.478+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '062'
  blueprint_id: '003'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-04T14:02:43.735+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.180392
        type: 'test'
        ...
      # Subtest: isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
      ok 1053 - isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
        ---
        duration_ms: 0.230903
        type: 'test'
        ...
      1..1053
      # tests 1053
      # suites 0
      # pass 1053
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 2197.552779
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-04T14:02:43.735+09:00
Exit code: 0
