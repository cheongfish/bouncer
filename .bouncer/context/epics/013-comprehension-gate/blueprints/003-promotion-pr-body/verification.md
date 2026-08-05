---
type: bouncer.verification
title: 승격·PR 계약 테스트와 전체 검증을 맞춤
description: Verification for 003
resource: .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-05T10:28:55.939+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '013'
  blueprint_id: '003'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-05T10:49:41.531+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.803941
        type: 'test'
        ...
      # Subtest: readVerifyCommand(repoRoot) still returns config.verify
      ok 341 - readVerifyCommand(repoRoot) still returns config.verify
        ---
        duration_ms: 0.158181
        type: 'test'
        ...
      1..341
      # tests 341
      # suites 0
      # pass 341
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 415.423893
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-05T10:49:41.531+09:00
Exit code: 0
