---
type: bouncer.verification
title: 001 문서 구조 검사 CLI 검증
description: Verification for 001
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-04T09:08:37.412+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '061'
  blueprint_id: '005'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-04T09:29:25.161+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.162264
        type: 'test'
        ...
      # Subtest: isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
      ok 1062 - isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
        ---
        duration_ms: 0.234052
        type: 'test'
        ...
      1..1062
      # tests 1062
      # suites 0
      # pass 1062
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 2202.33742
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-04T09:29:25.161+09:00
Exit code: 0
