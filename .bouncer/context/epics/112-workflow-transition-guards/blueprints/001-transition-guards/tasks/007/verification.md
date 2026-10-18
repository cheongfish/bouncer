---
type: bouncer.verification
title: 007 verification
description: Verification for 007
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/007/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:06:45.651+09:00'
bouncer:
  id: VERIFY-007
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm run ci
    ran_at: '2026-10-18T15:47:09.710+09:00'
    exit_code: 0
    output_tail: |-
      > bouncer@1.6.0 lint:docs
      > node scripts/check-doc-shape.js

      check-doc-shape: ok (32 files)

      > bouncer@1.6.0 lint:context-comments
      > node scripts/check-context-comments.js

      check-context-comments: ok (19 files)

      > bouncer@1.6.0 typecheck
      > tsc --noEmit


      > bouncer@1.6.0 lint:test-names
      > node scripts/check-test-names.js

      checked 110 files, 2408 names
      found 0 vulnerabilities
    evidence_id: 15b4eb3d8106603463aa89ed80667f094c28b21cafd019df84090a530bb515dc
    identity:
      head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
      dirty_digest: 72a75f01027645f8600b2a7bba9737c66185aa50cb573c9457ff15811066c534
      command: npm run ci
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: terminal
        key: EPIC-112/BP-001:96c1baba1961ebaddfc256ae1b5cfee03436b598
    scope: *ref_0
    reused: false
    source_digest: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-10-18T15:47:09.710+09:00
Exit code: 0
