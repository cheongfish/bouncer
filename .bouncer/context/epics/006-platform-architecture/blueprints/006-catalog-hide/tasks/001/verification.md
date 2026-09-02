---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/006-catalog-hide/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-28T11:43:50.455+09:00'
bouncer:
  id: 'VERIFY-001'
  epic_id: '006'
  blueprint_id: '006'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-28T12:37:16.900+09:00'
    exit_code: 0
    output_tail: |-
      #   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      #   validate-gates.js       |  96.45 |    80.13 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      #   validate-sections.js    |  98.64 |    84.62 |  100.00 | 124-125
      #   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      #   validate.js             |  86.81 |    87.69 |   66.67 | 14-16 30-34 70-75 94-99 119-120 153-154
      #   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      # 
----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # all files                 |  94.63 |    83.24 |   96.77 | 
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
Ran at: 2026-08-28T12:37:16.900+09:00
Exit code: 0
