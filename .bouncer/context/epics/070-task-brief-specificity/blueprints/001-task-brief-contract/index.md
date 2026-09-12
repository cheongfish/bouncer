---
type: bouncer.blueprint
title: task 브리프 본문 계약 강화
description: Adds current and target behavior sections and a symbol-level Touch table to the full task brief, and carries them into authoring guidance and implementer dispatch.
resource: .bouncer/context/epics/070-task-brief-specificity/blueprints/001-task-brief-contract/index.md
tags:
  - bouncer
  - blueprint
  - task-brief
  - plan-gate
  - spec-authoring
  - implementer
timestamp: '2026-09-12T20:40:51.481+09:00'
bouncer:
  id: '001'
  epic_id: '070'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 task-brief-contract

Epic: [070](../../index.md)

## Intent
- 문제: full task 브리프에는 현재 동작과 목표 동작을 적을 절이 없고 Touch는 경로와 이유만 받아서, 구현자가 변경 심볼과 완료 동작을 추론한다.
- 완료 조건: full 템플릿·파서·G10이 현재·목표 동작 절과 심볼 단위 Touch 표를 다루고, 작성 지침과 구현자 전달이 두 절을 싣는다.

## Contract
- 인터페이스:
  - task 절 키 `currentBehavior`(`## Current behavior` 또는 `## 현재 동작`)와 `targetBehavior`(`## Target behavior` 또는 `## 목표 동작`). full 템플릿 절 순서는 Goal & intent → Current behavior → Target behavior → Interface → Touch → Do not touch → Constraints → Checklist다.
  - Touch 표 열은 `경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거`이고 변경 값은 `Create | Modify | Delete | Rename`이다. 심볼 이름을 확정할 근거가 없으면 `신규 추출 지점: <책임>`으로 적는다.
  - G10은 두 절을 필수 목록에 넣지 않는다. 절이 있고 TODO 자리표시(`TODO_RE`)를 담으면 기존 placeholder 메시지 형식으로 거부한다.
  - 구현자 Authority와 execute named·fallback payload는 여덟 절(Goal & intent, Current behavior, Target behavior, Interface, Touch, Do not touch, Constraints, Checklist)을 다룬다. 두 절이 없는 task는 있는 절만 전달한다.
- 데이터·상태: frontmatter·schema 변경과 새 G 코드는 없다.
- 수용 기준: epic 성공 조건 1, 2, 3, 7.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `SECTION_DEFS`에 없는 `##` 제목은 앞 절에 흡수된다. 두 절을 등록하지 않으면 새 절의 placeholder가 Goal & intent 미작성으로 잘못 보고된다.
  - Touch 표 셀의 백틱 경로를 G11 정당화로 인정하고, 목록형 Touch도 계속 인정한다.
  - 두 절 없이 진행 중인 full task(067/002, 068/001 drive)는 `current --set`이 다시 돌리는 plan gate를 이전처럼 통과해야 한다.
  - Constraints의 placeholder 검사는 넓히지 않는다. 진행 중인 task를 새로 막지 않기 위해서다.
  - 동작 변화가 없는 문서·설정 task는 두 절에 산출물 검사나 schema·dry-run 명령을 판정 근거로 적는다.
  - light 템플릿은 바꾸지 않는다. 공개 인터페이스, 보호 경로, 오류 계약, 여러 모듈의 상태 변화가 필요하면 full로 전환한다.

## Out of scope
- reviewer·debugger 입력과 context-reviewer 판정 기준 변경. BP004 소관이다.
- graph-suggest의 심볼 반환(BP002)과 readiness 판정(BP003).
- 두 절을 G10 필수 목록에 넣는 강제. BP003의 판정 설계와 함께 정한다.
- finalize의 explain 복사 범위.

## One-commit justification
- TASKS-001이 템플릿·파서·G10을, TASKS-002가 작성 지침과 구현자 전달을 한 커밋씩 닫는다. 두 커밋이 합쳐 task 브리프 계약 한 PR이 된다.

## Documents
* [Task 001](tasks/001/tasks.md) - 템플릿과 절 파서, G10 placeholder 판정
* [Task 002](tasks/002/tasks.md) - 작성 지침과 구현자 전달 절 목록
* [Context review](context-review.md) - 계획 문서 정합성 판정
