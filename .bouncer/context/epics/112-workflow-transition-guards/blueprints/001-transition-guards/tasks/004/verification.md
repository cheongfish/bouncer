---
type: bouncer.verification
title: 004 verification
description: Verification for 004
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/004/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-18T14:00:20.151+09:00'
bouncer:
  id: VERIFY-004
  epic_id: '112'
  blueprint_id: '001'
  status: passed
  verification:
    command: node --test test/cli-current.test.js test/current.test.js test/cli-help.test.js
    ran_at: '2026-10-18T15:44:50.666+09:00'
    exit_code: 0
    output_tail: |-
      ✔ legacy delete failure → is CURRENT_MIGRATION_INCOMPLETE and the next same write finishes (44.935974ms)
      ✔ clearCurrent on a nested worktree → removes only that namespace key (81.751169ms)
      ✔ blueprint path without three-digit ids → writeCurrent rejects it (12.761977ms)
      ✔ no coordinator ledger → presentCurrent keeps the sequential pointer shape (69.735389ms)
      ✔ coordinator ledger present → presentCurrent exposes the ready wave and graph revision (283.34241ms)
      ✔ invalid coordinator config → presentCurrent falls back to maxParallel 1 (172.706502ms)
      ✔ explicit and legacy-default tasks → listTasksDocs attaches normalized executionKind (5.152609ms)
      ✔ worker lease and shared pointer → resolveEffectiveTask prefers the worker lease (324.279935ms)
      ✔ later lease with path overlap → reviseTaskScope revokes it (286.520888ms)
      ✔ ledger with malformed lease → reviseTaskScope refuses it (217.032721ms)
      ✔ base 위치와 nested worktree → baseNamespaceKeys는 base에서만 namespace key 목록을 낸다 (80.317689ms)
      ℹ tests 133
      ℹ suites 0
      ℹ pass 133
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 2568.082817
    evidence_id: ee9c1006c50a188d0c5991f7369d152664236f09b31b8790912ae3e15f1fb8db
    identity:
      head: f6f93a363ee77de11bc5605e4022a5de9310d57d
      dirty_digest: 2b8c04c6cf482ef470a69518515b6aae324669786f559d063ac118e88c18d06b
      command: node --test test/cli-current.test.js test/current.test.js test/cli-help.test.js
      cwd: .
      environment_hash: 4651abc126b8dd8681d987addf119b8de4674fbe878e2f829544e1e1ed53a74e
      scope: &ref_0
        kind: task
        key: EPIC-112/BP-001/TASK-004
    scope: *ref_0
    reused: false
    source_digest: b4a72381a949e748fbaf9f9bf3207b892036622a45b85e16a15755c431b79d63
---
# Verification

## Command
`node --test test/cli-current.test.js test/current.test.js test/cli-help.test.js`

## Evidence
Ran at: 2026-10-18T15:44:50.666+09:00
Exit code: 0
