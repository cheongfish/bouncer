---
type: bouncer.verification
title: 숫자 id 하네스 계약 회귀를 npm test로 확인함
description: Verification for BP-001
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-001-id-contract/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-05T16:54:53.735+09:00'
bouncer:
  id: VERIFY-BP-001
  epic_id: EPIC-014
  blueprint_id: BP-001
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-05T17:38:55.267+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.795277
        type: 'test'
        ...
      # Subtest: readVerifyCommand(repoRoot) still returns config.verify
      ok 359 - readVerifyCommand(repoRoot) still returns config.verify
        ---
        duration_ms: 0.155357
        type: 'test'
        ...
      1..359
      # tests 359
      # suites 0
      # pass 359
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 408.193284
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-05T17:38:55.267+09:00
Exit code: 0
