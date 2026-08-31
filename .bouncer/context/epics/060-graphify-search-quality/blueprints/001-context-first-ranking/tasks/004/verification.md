---
type: bouncer.verification
title: Graphify 검색 품질 고정 평가를 추가함
description: 고정 corpus의 precision·recall·오추천 임계치 실행 증거를 기록한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T12:04:03.162+09:00'
bouncer:
  id: VERIFY-004
  epic_id: '060'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-08-31T13:18:22.656+09:00'
    exit_code: 0
    output_tail: |-
      #   validate-docs.js        |  92.31 |    85.42 |  100.00 | 28-32 133-141 152
      #   validate-gates.js       |  96.51 |    87.76 |  100.00 | 27-28 39-40 66-67 79-81 94-95 381-382 391-392
      #   validate-sections.js    |  98.64 |    84.62 |  100.00 | 124-125
      #   validate-structural.js  |  94.34 |    82.56 |   97.22 | 131-132 134-135 194-197 221-222 236-237 243-245 300-301 305-306 316-317 321-322 339-341 444-445 482-484 501-502
      #   validate.js             |  90.32 |    89.06 |   66.67 | 14-16 30-34 94-99 119-120 153-154
      #   verification.js         |  95.47 |    78.26 |  100.00 | 34 161-162 169-173 210-213
      # --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # all files                 |  95.00 |    83.60 |   97.74 | 
      # --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      # end of coverage report

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
Ran at: 2026-08-31T13:18:22.656+09:00
Exit code: 0
