---
type: bouncer.tasks
title: 종단 전체 검증
description: Run the full CI once after every transition-guard commit task is integrated.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/007/tasks.md
tags:
  - bouncer
  - tasks
  - verification
  - ci
timestamp: '2026-10-18T14:06:45.651+09:00'
bouncer:
  id: TASKS-007
  epic_id: '112'
  blueprint_id: '001'
  status: integrated
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
TASKS-001~006을 모두 통합한 integration HEAD에서 `npm run ci`가 exit 0으로 끝남을 증명한다. 이 실행은 build·emit 검사, coverage, unit tier, lint, doc shape, context comment, typecheck, test name, audit를 포함한다. epic Success criteria 9–10의 종단 증거이고, Success criteria 11 중 `npm run lint:docs`의 종단 증거다. 문구 일치(`rg -F`)는 TASKS-005 Checklist가 확인한다.

## Interface
- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로 — verification task는 증적만 남기고 파일을 바꾸지 않는다.

## Checklist
- [ ] 모든 commit task가 `integrated`인지 확인한다.
- [ ] integration worktree에서 `npm run ci`를 한 번 실행하고, execute gate가 증적을 기록하게 한다.
- [ ] 실패하면 debugger 보고의 실패 원인 파일과 task 전용 `--verify`로 `coordinate repair`를 연다(TASKS-001 규칙).
