---
type: bouncer.tasks
title: 007 tasks
description: Tasks for 007
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/007/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-10-20T17:07:45.684+09:00'
bouncer:
  id: TASKS-007
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: verification
  depends_on:
    - TASKS-001
    - TASKS-002
    - TASKS-003
    - TASKS-004
    - TASKS-005
    - TASKS-006
  parallel_safe: false
  dependency_gate: integrated
  verify: npm run ci
  affected_paths: []
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
TASKS-001~006을 통합한 뒤 `npm run ci`가 통과함을 증명한다. CI는 emit 검사, coverage 기준, unit tier, lint, 문서 lint, 주석 lint, typecheck, 테스트 이름 검사, audit을 포함한다. blueprint 수용 기준 8이다.

## Interface
- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로 — verification task는 증적만 남기고 파일을 바꾸지 않는다.

## Checklist
- [ ] 통합 worktree에서 `npm run ci`를 실행하고 execute gate가 증적을 기록하게 한다. 실패하면 원인이 된 commit task로 돌려보낸다.
