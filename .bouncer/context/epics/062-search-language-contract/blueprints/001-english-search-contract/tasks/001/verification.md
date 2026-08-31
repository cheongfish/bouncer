---
type: bouncer.verification
title: 001 verification
description: Verification for 001
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-08-31T16:19:11.008+09:00'
bouncer:
  id: VERIFY-001
  epic_id: '062'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-08-31T16:39:47.399+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (26.920606ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.837436ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.676325ms)
      ✔ runVerification falls back to config.verify when the task document is absent (8.561662ms)
      ✔ readVerifyCommand rejects non-single executable commands (16.880654ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.248049ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (3.517439ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (3.826456ms)
      ✔ readVerifyCommand narrows to the pointer task document (14.784884ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.222138ms)
      ✔ runVerification rejects missing unit verification.md without creating it (8.811338ms)
      ℹ tests 961
      ℹ suites 0
      ℹ pass 961
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1868.7782
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-08-31T16:39:47.399+09:00
Exit code: 0
