---
type: bouncer.verification
title: 전체 계약 검증 실행함
description: Records full-suite verification for the run rule loading contract.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/002-run-rule-reload-elimination/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-03T13:39:01.745+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '061'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-03T14:18:26.930+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.090669
        type: 'test'
        ...
      # Subtest: isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
      ok 1018 - isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
        ---
        duration_ms: 0.138134
        type: 'test'
        ...
      1..1018
      # tests 1018
      # suites 0
      # pass 1018
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 1904.757813
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-03T14:18:26.930+09:00
Exit code: 0
