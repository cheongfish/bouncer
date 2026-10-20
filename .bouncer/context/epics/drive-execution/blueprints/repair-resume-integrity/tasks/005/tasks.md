---
type: bouncer.tasks
title: repair 재개·rework 수정 종단 검증
description: Run the full CI suite after all repair-resume-integrity tasks integrate
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
  - verification
  - ci
timestamp: '2026-10-20T21:02:18.431+09:00'
bouncer:
  id: TASKS-005
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: ready
  execution_kind: verification
  depends_on:
    - TASKS-001
    - TASKS-002
    - TASKS-003
    - TASKS-004
  parallel_safe: false
  dependency_gate: integrated
  verify: npm run ci
  affected_paths: []
---
# Tasks

Blueprint: [repair-resume-integrity](../../index.md)

## Goal & intent
TASKS-001~004가 모두 통합된 integration HEAD에서 `npm run ci`가 통과함을 증명한다. 수용 기준은 blueprint Contract 1~5 전체다.

## Interface
- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로 — verification task는 증적만 남기고 파일을 바꾸지 않는다.

## Checklist
- [ ] `npm run ci`가 통과한다.
