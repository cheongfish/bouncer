---
type: bouncer.blueprint
title: 문서와 커밋 수명주기 계약
description: Unifies task-context preservation, transient-document staging, and authored commit-message contracts.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/005-explain-task-context/index.md
tags:
  - bouncer
  - blueprint
  - lifecycle
  - commit_contract
timestamp: '2026-09-04T13:25:50.664+09:00'
bouncer:
  id: '005'
  epic_id: '062'
  blueprint_id: '005'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 005 문서와 커밋 수명주기 계약

Epic: [062](../../index.md)

## Intent
- 문제: task의 설계 맥락, 임시 문서 수명주기, 커밋 메시지의 저작자 정보가 서로 다른 단계에서 어긋날 수 있음.
- 완료 조건: 세 계약을 순서대로 적용해 explain의 맥락을 보존하고, task 산출물만 커밋하며, 저작 필드로 커밋 메시지를 만듦.

## Contract
- 인터페이스: `explain.md`는 선택적 `## Tasks`에 task별 설계 맥락을 남긴다. task 커밋은 임시 context 문서를 스테이징하지 않으며, task와 finalize 메시지는 저작된 필드와 blueprint Intent에서 생성한다.
- 데이터·상태: task 스냅샷과 `commit_sha`는 finalize까지 유지한다. `## Tasks`는 G16의 필수 섹션이 아니며, 새 commit-message 필드는 기존 문서에서 선택적으로 읽는다.
- 수용 기준: 기존 explain 호환성, 임시 문서 cleanup, 메시지 줄 수·종결 규칙을 포함한 `npm test`가 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 빈 task 값과 기존 explain을 유지하고, 없는 미추적 경로를 스테이징하지 않으며, 형식이 틀린 저작 필드나 파싱 불가 Intent는 메시지 생성을 실패시킨다.

## Out of scope
- 새로운 의존성, 커밋 trailer, G16 필수 섹션 변경, 범위 권한 완화는 포함하지 않는다.

## Task sequence
- Task 001은 finalize 전에 설계 맥락을 `explain.md`로 이관한다.
- Task 002는 이관된 task 문서의 task-commit 스테이징과 finalize cleanup 경계를 정한다.
- Task 003은 task와 finalize가 사용할 저작 커밋 메시지 계약을 정한다.

## Documents
* [Task 001](tasks/001/tasks.md) - explain task 맥락 이관
* [Task 002](tasks/002/tasks.md) - task 커밋 임시 문서 제외
* [Task 003](tasks/003/tasks.md) - 저작 커밋 메시지 필드 도입
* [Context review](context-review.md) - 계획 문서 정합성 판정
