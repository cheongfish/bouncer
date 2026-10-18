---
type: bouncer.verification
title: 005 verification
description: Verification for 005
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:00:20.321+09:00'
bouncer:
  id: VERIFY-005
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: node --test test/coordinator.test.js test/run-detach.test.js test/cli-commit.test.js test/commit-guard.test.js test/run-preflight.test.js test/coordinate-next.test.js test/cli-help.test.js test/test-tiers.test.js
    ran_at: '2026-10-18T15:37:39.048+09:00'
    exit_code: 0
    output_tail: |-
      ✔ run preflight when review_scope is absent → ok:false legacy-review-scope with runnable migrate next (57.266781ms)
      ✔ run preflight when legacy blueprint is draft → legacy-review-scope wins over blueprint-draft (55.696383ms)
      ✔ run preflight when legacy blueprint uses flat task layout → next guides task-layout migration first (56.658915ms)
      ✔ run preflight when pointer targets another blueprint on a legacy tree → pointer-mismatch is kept (57.108135ms)
      ✔ run preflight on a scoped_terminal light plan → delegable with the policy, legacy when the marker is absent (72.856073ms)
      ✔ every test file → is assigned to a tier (1.903219ms)
      ✔ no test file → is in both tiers (0.303961ms)
      ✔ tier → lists name only existing files (0.40698ms)
      ✔ unit guard → rejects process spawning and lets pure tests pass (265.396621ms)
      ✔ runner → exits 2 with usage for an unknown tier (42.738082ms)
      ✔ runner → exits 1 naming a listed file that does not exist, before node --test (42.473404ms)
      ℹ tests 415
      ℹ suites 0
      ℹ pass 415
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 60041.149504
    evidence_id: c2908319025177660e01c4352c58981a6d43e59615048fcd048a03cb494bb2c0
    identity:
      head: 3b14f98d63a7dcfcca1d3dc863d63225159a607c
      dirty_digest: d20c4f6b1be301d9ae145c10ebc993e67af5088e8fc32d9935d3d641bf0d402d
      command: node --test test/coordinator.test.js test/run-detach.test.js test/cli-commit.test.js test/commit-guard.test.js test/run-preflight.test.js test/coordinate-next.test.js test/cli-help.test.js test/test-tiers.test.js
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: task
        key: EPIC-112/BP-001/TASK-005
    scope: *ref_0
    reused: false
    source_digest: 73e2b9020dd87d6a162c5bdb65cc6fbab55ada143497bd72996bffd8250e6d5e
---
# Verification

## Command
`node --test test/coordinator.test.js test/run-detach.test.js test/cli-commit.test.js test/commit-guard.test.js test/run-preflight.test.js test/coordinate-next.test.js test/cli-help.test.js test/test-tiers.test.js`

## Evidence
Ran at: 2026-10-18T15:37:39.048+09:00
Exit code: 0
