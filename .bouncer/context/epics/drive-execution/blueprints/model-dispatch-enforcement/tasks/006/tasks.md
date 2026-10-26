---
type: bouncer.tasks
title: CI repair wave 006
description: Repairs terminal CI failure.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/006/tasks.md
tags:
  - bouncer
  - repair-wave
timestamp: '2026-10-26T06:21:57.600Z'
bouncer:
  id: TASKS-006
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  depends_on:
    - TASKS-004
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - test/coordinate-next.test.js
    - test/skill-context-review.test.js
  scope_revision: r2
  verify: node --test test/coordinate-next.test.js test/skill-context-review.test.js
  commit_sha: 5ad0fb66
---
# Tasks

## Goal & intent

기록된 terminal CI 실패를 복구한다.

## Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

## Touch

- Modify `test/coordinate-next.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/skill-context-review.test.js` — 기록된 CI 실패를 복구한다.

## Do not touch

- `.git/`과 `.bouncer/` governance tree

## Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

## Checklist

- [ ] 실패를 재현하고 관련 source와 regression test를 수정한다.
- [ ] 기록된 terminal CI command를 통과시킨다.
