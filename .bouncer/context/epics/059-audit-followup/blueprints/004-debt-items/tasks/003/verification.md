---
type: bouncer.verification
title: 파싱 진단 분리를 검증함
description: context-review 파싱 실패와 실제 부재의 진단 분기 실행 증적을 기록한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T10:42:21.253+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '059'
  blueprint_id: '004'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-31T11:19:45.924+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  96.92 |    89.13 |  100.00 | 28-32 152
      ℹ   validate-gates.js       |  96.51 |    87.76 |  100.00 | 27-28 39-40 66-67 79-81 94-95 381-382 391-392
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      ℹ   validate.js             |  90.32 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.96 |    84.17 |   96.83 | 
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@1.3.1 lint
      > eslint .


      > bouncer@1.3.1 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-31T11:19:45.924+09:00
Exit code: 0
