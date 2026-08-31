---
type: bouncer.verification
title: 컨텍스트 우선 추천 엔진과 CLI를 추가함
description: 추천 점수·관계 필터·저신뢰 CLI 계약의 실행 증거를 기록한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T12:04:03.083+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '060'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-31T13:01:47.850+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 10.846934
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 931 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 9.287615
        type: 'test'
        ...
      1..931
      # tests 931
      # suites 0
      # pass 931
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 1862.871165
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-31T13:01:47.850+09:00
Exit code: 0
