---
type: bouncer.verification
title: 004 verification
description: Verification for 004
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-25T12:35:04.162+09:00'
bouncer:
  id: VERIFY-004
  epic_id: '050'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-25T13:37:23.234+09:00'
    exit_code: 0
    output_tail: |-
      #   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      #   validate-gates.js       |  96.45 |    87.41 |  100.00 | 27-28 39-40 66-67 79-81 94-95 374-375 384-385
      #   validate-sections.js    |  98.64 |    84.62 |  100.00 | 124-125
      #   validate-structural.js  |  92.18 |    83.40 |   96.67 | 69-70 72-73 88-90 103-106 130-131 145-146 152-154 205-206 209-210 214-215 225-226 230-231 248-250 353-354 391-393 410-411
      #   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      #   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      # ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # all files                 |  94.29 |    83.27 |   96.49 | 
      # ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
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
Ran at: 2026-08-25T13:37:23.234+09:00
Exit code: 0
