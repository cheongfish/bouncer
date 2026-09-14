---
type: bouncer.blueprint
title: Task commit provenance 계약
description: Adds stable task identity trailers and durable Explain links while preserving the eight-character SHA contract.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/001-task-commit-provenance/index.md
tags:
  - bouncer
  - blueprint
  - commit-provenance
  - stable-task-id
  - explain
timestamp: '2026-09-14T10:15:00.371+09:00'
bouncer:
  id: '001'
  epic_id: '071'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Task commit provenance 계약

Epic: [071](../../index.md)

## Intent

Task commit과 Explain이 Blueprint 경계를 포함한 stable Task ID로 서로 연결되게 함. 기존 8자리 SHA와 legacy Explain 행을 유지하면서 standalone과 coordinator 경로에 같은 provenance 계약을 적용함.

## Contract

- 인터페이스: Task commit message의 마지막에 `Bouncer-Task: EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`와 `Bouncer-Intent: EPIC-<ddd>/BP-<ddd>` trailer를 추가한다. Explain의 새 `bouncer.task_commits` 행은 `{ task, sha, intent_anchor }`를 쓴다.
- 데이터·상태: `tasks.md`의 `bouncer.commit_sha`와 Explain의 `sha`는 기존 소문자 8자리 hex 계약을 유지한다. 새 Explain은 stable Task ID를 쓰고, 소비자는 기존 `{ id, sha }` 행도 읽는다.
- 수용 기준: Epic success criteria 1–7을 모두 만족한다.
- 검증 명령: 각 Task의 승인된 verify command와 Blueprint 완료 전 `npm run ci`가 통과해야 한다.
- 실패 모드·엣지 케이스: 세 자리 Epic·Blueprint·Task ID를 만들 수 없거나 기존 trailer와 충돌하면 commit message 생성을 거절한다. 중복 trailer, malformed SHA, legacy/new Explain 행 혼재, coordinator SHA 대조, verification node의 무커밋 경계를 회귀 테스트로 고정한다.

## Out of scope

- `bouncer intent` CLI와 함수 parser
- Plan, Graphify, G4/S9 계약 변경
- `context_dirs`와 context graph 제거
- 기존 commit message나 Explain의 소급 변환
- cross-blueprint terminal verification node

## One-commit justification

- TASKS-001은 commit message 생성과 Git commit 경로를 한 커밋으로 닫고, TASKS-002는 Explain 직렬화와 legacy 소비를 후속 커밋으로 닫는다. 두 Task는 `finalize` 공유 심볼 때문에 순차 실행한다.

## Documents
* [Task 001](tasks/001/tasks.md) - stable Task ID와 commit trailer
* [Task 002](tasks/002/tasks.md) - Explain provenance 행과 legacy 호환
* [Context review](context-review.md) - 계획 문서 정합성 판정
