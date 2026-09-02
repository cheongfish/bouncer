---
type: bouncer.verification
title: 재접지 지시 다섯 곳을 단일 호출로 바꾸고 반복 문구 재발을 테스트로 잠금
description: Verification for 재접지 단일 호출 전환
resource: .bouncer/context/epics/007-project-distill/blueprints/008-for-union-single-call/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-27T10:50:00.378+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '007'
  blueprint_id: '008'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-27T11:21:57.795+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  95.90 |    86.96 |  100.00 | 28-32 84-85 152
      ℹ   validate-gates.js       |  96.45 |    87.41 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.79 |    83.83 |   96.77 | 
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
Ran at: 2026-08-27T11:21:57.795+09:00
Exit code: 0
