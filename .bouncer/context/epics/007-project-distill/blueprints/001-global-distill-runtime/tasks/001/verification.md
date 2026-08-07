---
type: bouncer.verification
title: init·finalize·스킬이 전역 Distill을 읽고 승격함
description: Verification for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/001-global-distill-runtime/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-03T04:59:09.997Z'
bouncer:
  id: VERIFY-001
  epic_id: '007'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-03T05:06:54.362Z'
    exit_code: 0
    output_tail: |-
      ---
        duration_ms: 15.705922
        type: 'test'
        ...
      # Subtest: a failing verification keeps the output where a reader will see it
      ok 248 - a failing verification keeps the output where a reader will see it
        ---
        duration_ms: 14.67563
        type: 'test'
        ...
      1..248
      # tests 248
      # suites 0
      # pass 248
      # fail 0
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 195.0074
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-03T05:06:54.362Z
Exit code: 0
