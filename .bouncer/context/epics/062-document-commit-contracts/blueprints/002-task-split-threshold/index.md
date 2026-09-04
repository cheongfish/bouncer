---
type: bouncer.blueprint
title: task 분해 임계치 경고
description: Adds a non-blocking plan warning when a task scope exceeds twenty affected paths.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/002-task-split-threshold/index.md
tags:
  - bouncer
  - blueprint
  - plan_validation
  - task_sizing
timestamp: '2026-09-04T12:47:18.891+09:00'
bouncer:
  id: '002'
  epic_id: '062'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 002 task 분해 임계치 경고

Epic: [062](../../index.md)

## Intent
- 문제: 계획 문서의 `affected_paths`가 과도하게 넓어도 작성자가 task를 나눌 시점을 알아차릴 보조 신호가 없음.
- 완료 조건: 20개를 초과한 `affected_paths`만 plan 결과의 구조화된 `warnings`에 기록하고, 게이트 성공 여부·종료 코드·stdout JSON 형식은 바꾸지 않음.

## Contract
- 인터페이스: plan gate를 거친 `validateBlueprint()` 결과는 기존 `ok`, `failures`에 선택적 `warnings` 배열을 추가한다. `affected_paths.length > 20`인 task마다 “한 커밋으로 리뷰할 수 없으면 task를 분리하라”는 권고를 담은 경고 항목 하나를 넣는다.
- 데이터·상태: 경고는 실패와 별도 배열로 수집한다. 경고만 있을 때 `ok: true`와 CLI 종료 코드 `0`을 유지하며, `warnings`가 없는 기존 결과도 소비 가능해야 한다.
- 수용 기준: 20개 이하는 경고가 없고, 21개 이상은 한-커밋 검토 가능 여부와 필요 시 task 분리를 권고하는 경고를 받는다. 경고는 G/S 코드가 아니며 stdout에는 JSON 객체 하나만 출력한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 빈 배열은 기존 G5 실패를 유지한다. 대량 이관·리네임처럼 정당한 넓은 task도 경고만 받고 차단되지 않는다. plan 외 gate와 gate 없는 구조 검증에는 이 경고를 섞지 않는다.

## Out of scope
- 20개 초과 task를 G/S 실패 또는 비영 종료 코드로 바꾸지 않는다.
- `rules/governance.md`의 한-커밋 리뷰 원칙을 정량 규칙으로 대체하지 않는다.
- 기존 task 문서의 `affected_paths`를 수정하거나 분할하지 않는다.

## One-commit justification
- 결과 형식, plan 경고 판정, 공개 CLI 출력, 규칙 설명과 회귀 테스트가 하나의 호환성 계약이므로 한 커밋에서 함께 검토한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
