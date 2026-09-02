---
type: bouncer.verification
title: 003 검증
description: Verification record for the 039 release security task
resource: .bouncer/context/epics/039-release-security/blueprints/002-public-contract-freeze/tasks/003/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-15T18:45:30.133+09:00'
bouncer:
  id: VERIFY-003
  epic_id: '039'
  blueprint_id: '002'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-15T19:31:20.328+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  91.28 |    83.33 |  100.00 | 28-32 84-85 133-141 152
      ℹ   validate-gates.js       |  96.21 |    80.00 |  100.00 | 69-74 178-179 281 295-296 305-306
      ℹ   validate-sections.js    |  98.64 |    84.62 |  100.00 | 124-125
      ℹ   validate-structural.js  |  92.34 |    83.64 |   96.55 | 45-47 60-63 87-88 102-103 109-111 162-163 166-167 171-172 182-183 187-188 205-207 310-311 348-350 367-368
      ℹ   validate.js             |  90.11 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  94.56 |    79.10 |  100.00 | 32 103-107 159-160 167-171
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.16 |    82.35 |   96.17 | 
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@0.9.0 lint
      > eslint .


      > bouncer@0.9.0 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# 검증

## 명령
`npm run ci`

## 증거
Ran at: 2026-08-15T19:31:20.328+09:00
Exit code: 0
