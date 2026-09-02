---
type: bouncer.verification
title: YAML 인용 규칙 단언을 검증함
description: 계획 작성과 context-review 기록 규칙의 회귀 단언 실행 증적을 기록한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/009-debt-items/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T10:42:21.219+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '001'
  blueprint_id: '009'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-31T11:15:57.136+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      ℹ   validate-gates.js       |  96.45 |    80.13 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      ℹ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.82 |    83.62 |   96.82 | 
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
Ran at: 2026-08-31T11:15:57.136+09:00
Exit code: 0
