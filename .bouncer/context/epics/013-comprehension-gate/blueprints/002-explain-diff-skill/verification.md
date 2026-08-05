---
type: bouncer.verification
title: explain-diff 스킬 계약과 finalize 배선 테스트를 통과시킴
description: npm test로 스킬·finalize·surface 계약을 검증
resource: .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-05T09:50:11.577+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '013'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-05T10:03:45.709+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 0.789573
        type: 'test'
        ...
      # Subtest: readVerifyCommand(repoRoot) still returns config.verify
      ok 339 - readVerifyCommand(repoRoot) still returns config.verify
        ---
        duration_ms: 0.170172
        type: 'test'
        ...
      1..339
      # tests 339
      # suites 0
      # pass 339
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 415.448195
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-05T10:03:45.709+09:00
Exit code: 0
