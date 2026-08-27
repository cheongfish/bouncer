---
type: bouncer.verification
title: run stop-recovery 라우팅 계약을 검증함
description: Verification for 004
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-27T12:10:05.467+09:00'
bouncer:
  id: VERIFY-004
  epic_id: '054'
  blueprint_id: '003'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-27T13:32:39.646+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  95.90 |    86.96 |  100.00 | 28-32 84-85 152
      ℹ   validate-gates.js       |  96.45 |    87.41 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.84 |    83.86 |   96.77 | 
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@1.2.0 lint
      > eslint .


      > bouncer@1.2.0 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-27T13:32:39.646+09:00
Exit code: 0
