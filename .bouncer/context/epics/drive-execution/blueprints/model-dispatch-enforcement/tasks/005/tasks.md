---
type: bouncer.tasks
title: 모델 디스패치 변경의 종단 검증
description: Verify all integrated model dispatch changes with the repository CI command.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
  - subagent
  - model
  - verification
timestamp: '2026-10-26T14:23:38.463+09:00'
bouncer:
  id: TASKS-005
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  execution_kind: verification
  depends_on:
    - TASKS-006
  parallel_safe: false
  dependency_gate: integrated
  verify: npm run ci
  affected_paths: []
  exclusive_resources: []
  review_risk: []
---
# 모델 디스패치 변경의 종단 검증

Blueprint: [model-dispatch-enforcement](../../index.md)

## Goal & intent
네 commit task가 모두 통합된 뒤 공개 payload·Claude 훅·워크플로 문서·plugin 호환 범위가 프로젝트 전체 CI를 통과하는지 확인한다. 실행 명령은 frontmatter verify를 정본으로 삼는다.

## Current behavior
구현 작업의 전용 검증은 각 작업 경계만 검사한다. 이 node는 네 작업이 integrated 상태가 된 뒤 열린다.

## Target behavior
검증 성공 시 CLI가 verification 증적과 통합 상태를 기록한다. 실패 시 원문 실패와 원인을 보고하며 source를 직접 고치거나 성공을 기록하지 않는다.

## Interface
- 제공: 전체 구현 통합 후 종단 검증 증적.
- 거부: source 변경, task review 문서, task commit, 검증 실패의 임의 성공 처리.

## Touch
Source 변경 경로 없음.

## Do not touch
- 모든 source 경로

## Constraints
전용 검증을 전체 CI 증적으로 대체하지 않는다. runtime 0.1.14와 plugin 0.1.12 metadata 및 미커밋 사용자 변경을 보존한다. 실패 복구는 coordinator의 기존 repair·reverify 계약을 따른다.

## Checklist
- [ ] 네 선행 commit task가 모두 integrated 상태인지 확인한다.
- [ ] frontmatter verify 명령을 실행하고 실제 출력과 종료 코드를 기존 verification 경로로 기록한다.
- [ ] 실패 시 원인을 보고하고 기존 복구 경로로 넘긴다. 성공 시 다음 최종 리뷰 단계로 진행한다.
