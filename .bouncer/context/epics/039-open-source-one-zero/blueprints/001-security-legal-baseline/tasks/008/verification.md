---
type: bouncer.verification
title: 공통 CI 품질 계약을 통과함
description: Verification for 008
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-15T15:42:17.672+09:00'
bouncer:
  id: VERIFY-008
  epic_id: '039'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-15T18:14:14.396+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      ℹ   validate-gates.js       |  98.54 |    92.04 |  100.00 | 281 295-296 305-306
      ℹ   validate-sections.js    | 100.00 |    89.80 |  100.00 | 
      ℹ   validate-structural.js  |  92.34 |    83.64 |   96.55 | 45-47 60-63 87-88 102-103 109-111 162-163 166-167 171-172 182-183 187-188 205-207 310-311 348-350 367-368
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  94.56 |    79.10 |  100.00 | 32 103-107 159-160 167-171
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.29 |    83.09 |   96.17 | 
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@0.8.4 lint
      > eslint .


      > bouncer@0.8.4 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-15T18:14:14.396+09:00
Exit code: 0
