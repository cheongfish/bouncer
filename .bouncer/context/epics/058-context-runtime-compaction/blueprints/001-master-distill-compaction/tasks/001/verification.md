---
type: bouncer.verification
title: 마스터 규칙 계약과 바이트 예산을 검증함
description: 마스터 규칙의 안전 계약 보존과 30% 압축 여부를 게이트가 기록한다
resource: .bouncer/context/epics/058-context-runtime-compaction/blueprints/001-master-distill-compaction/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-28T13:44:23.892+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '058'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-28T14:00:50.506+09:00'
    exit_code: 0
    output_tail: |-
      #   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      #   validate-gates.js       |  96.45 |    87.41 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      #   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      #   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      #   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      #   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      # ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # all files                 |  94.73 |    83.80 |   96.77 | 
      # ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # end of coverage report

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
Ran at: 2026-08-28T14:00:50.506+09:00
Exit code: 0
