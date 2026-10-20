---
type: bouncer.tasks
title: context review restart 수정 전체 검증
description: Run the full CI once after both context review restart tasks integrate
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-fix-restart/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-10-20T21:02:18.625+09:00'
bouncer:
  id: TASKS-003
  epic_id: plan-workflow
  blueprint_id: context-review-fix-restart
  status: ready
  execution_kind: verification
  depends_on:
    - TASKS-001
    - TASKS-002
  parallel_safe: false
  dependency_gate: integrated
  verify: npm run ci
  affected_paths: []
---
# Tasks

Blueprint: [context-review-fix-restart](../../index.md)

## Goal & intent
TASKS-001(restart·route 판정)과 TASKS-002(skill 안내)가 통합된 뒤 `npm run ci` 전체가 통과해, 판정 변경이 다른 context review·plan gate 테스트와 문서 형태 검사를 깨지 않음을 증명한다.

## Interface
- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로 — verification task는 증적만 남기고 파일을 바꾸지 않는다.

## Checklist
- [ ] 통합 HEAD에서 `npm run ci`를 한 번 실행하고 종료 코드 0을 확인한다.
- [ ] 실패하면 실패 테스트 이름과 소유 태스크를 repair 기록에 남긴다.
