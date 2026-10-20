---
type: bouncer.tasks
title: legacy epic 병합 이관 전체 CI 검증
description: Run the full CI suite after all legacy epic merge tasks integrate.
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-10-20T21:02:18.048+09:00'
bouncer:
  id: TASKS-005
  epic_id: context-search
  blueprint_id: legacy-epic-merge
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

Blueprint: [legacy-epic-merge](../../index.md)

## Goal & intent
TASKS-001~004가 모두 통합된 통합 브랜치에서 `npm run ci` 전체가 통과함을 증명한다. 태스크별 `node --test` 범위 밖의 회귀(타입 검사, lint, 문서 모양, 테스트 이름, coverage 기준)를 여기서 잡는다. 수용 기준은 blueprint 수용 기준 5다.

## Interface
- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로 — verification task는 증적만 남기고 파일을 바꾸지 않는다.

## Checklist
- [ ] 통합 브랜치에서 `npm run build` 뒤 `npm run ci`가 exit 0으로 끝난다.
- [ ] 실패하면 실패 테스트와 소유 태스크를 증적에 남기고 repair 경로로 넘긴다. 이 task에서 파일을 고치지 않는다.
