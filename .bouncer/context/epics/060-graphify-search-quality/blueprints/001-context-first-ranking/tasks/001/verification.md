---
type: bouncer.verification
title: 구현·테스트 그래프 입력을 분리함
description: 역할별 그래프 빌드와 기존 config 호환성의 실행 증거를 기록한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T12:01:12.954+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '060'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-31T12:44:53.961+09:00'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 11.871781
        type: 'test'
        ...
      # Subtest: runVerification rejects missing unit verification.md without creating it
      ok 908 - runVerification rejects missing unit verification.md without creating it
        ---
        duration_ms: 9.105376
        type: 'test'
        ...
      1..908
      # tests 908
      # suites 0
      # pass 908
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 3326.647943
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-31T12:44:53.961+09:00
Exit code: 0
