---
type: bouncer.verification
title: 색인 재생성·불일치 차단 검증을 수행함
description: Verification for blueprint 009.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T13:35:31.411+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '014'
  blueprint_id: '009'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-31T14:29:03.516+09:00'
    exit_code: 0
    output_tail: |-
      ℹ   validate-docs.js        |  92.31 |    85.42 |  100.00 | 28-32 133-141 152
      ℹ   validate-gates.js       |  96.51 |    80.63 |  100.00 | 27-28 39-40 66-67 79-81 94-95 381-382 391-392
      ℹ   validate-sections.js    |  98.64 |    84.62 |  100.00 | 124-125
      ℹ   validate-structural.js  |  94.34 |    82.56 |   97.22 | 131-132 134-135 194-197 221-222 236-237 243-245 300-301 305-306 316-317 321-322 339-341 444-445 482-484 501-502
      ℹ   validate.js             |  90.32 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      ℹ   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ all files                 |  94.89 |    83.10 |   97.58 | 
      ℹ --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      ℹ end of coverage report

      > bouncer@1.3.2 lint
      > eslint .


      > bouncer@1.3.2 typecheck
      > tsc --noEmit

      found 0 vulnerabilities
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-08-31T14:29:03.516+09:00
Exit code: 0
