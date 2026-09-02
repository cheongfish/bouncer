---
type: bouncer.verification
title: 003 verification
description: Verification for 003
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/008-instruction-layers/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T08:39:18.988+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '001'
  blueprint_id: '008'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-31T09:41:12.803+09:00'
    exit_code: 0
    output_tail: |-
      #   validate-docs.js        |  95.90 |    86.96 |  100.00 | 28-32 84-85 152
      #   validate-gates.js       |  96.45 |    87.41 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      #   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      #   validate-structural.js  |  93.29 |    84.03 |   96.67 | 69-70 72-73 103-106 130-131 145-146 152-154 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      #   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      #   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      # ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # all files                 |  94.89 |    84.05 |   96.81 | 
      # ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # end of coverage report

      > bouncer@1.3.0 lint
      > eslint .


      > bouncer@1.3.0 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-31T09:41:12.803+09:00
Exit code: 0
