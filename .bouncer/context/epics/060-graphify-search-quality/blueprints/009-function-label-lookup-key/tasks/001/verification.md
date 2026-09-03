---
type: bouncer.verification
title: 함수 label 조회 키 정규화 검증
description: Verification for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-04T08:22:09.462+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '060'
  blueprint_id: '009'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-04T08:39:42.509+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.152725
        type: 'test'
        ...
      # Subtest: isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
      ok 1056 - isValidVerifyCommand accepts win32 npm.cmd against the default allowlist
        ---
        duration_ms: 0.222918
        type: 'test'
        ...
      1..1056
      # tests 1056
      # suites 0
      # pass 1056
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 2426.46483
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-04T08:39:42.509+09:00
Exit code: 0
