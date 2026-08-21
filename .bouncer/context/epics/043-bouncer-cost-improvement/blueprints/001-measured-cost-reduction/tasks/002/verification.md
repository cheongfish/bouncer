---
type: bouncer.verification
title: scaffold 힌트와 빈 계획 거절을 검증함
description: 힌트 노출과 기존 gate 실패 계약의 유지 결과를 기록한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-21T20:32:39.457+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '043'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-21T21:54:52.179+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      ℹ   validate-gates.js       |  94.88 |    78.38 |  100.00 | 27-28 39-40 66-67 79-81 94-95 163-168 361-362 371-372
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  92.18 |    83.54 |   96.67 | 69-70 72-73 88-90 103-106 130-131 145-146 152-154 205-206 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  93.58 |    75.71 |  100.00 | 34 105-109 161-162 169-173 210-213
      ℹ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.20 |    82.42 |   96.24 | 
      ℹ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@1.0.0 lint
      > eslint .


      > bouncer@1.0.0 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-21T21:54:52.179+09:00
Exit code: 0
