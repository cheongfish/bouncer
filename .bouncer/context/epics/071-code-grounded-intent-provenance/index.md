---
type: bouncer.epic
title: 코드 기반 의도 provenance
description: Connects code changes to durable task intent through stable task identifiers and commit provenance.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/index.md
tags:
  - bouncer
  - epic
  - commit-provenance
  - stable-task-id
  - intent
timestamp: '2026-09-14T10:15:00.281+09:00'
bouncer:
  id: '071'
  epic_id: '071'
  status: approved
  supersedes: []
---
# 코드 기반 의도 provenance

## Intent

현재 Task 커밋과 Explain은 Blueprint 안의 세 자리 Task 번호와 8자리 SHA만 보존해 다른 Blueprint의 같은 번호를 구분할 수 없다. 코드 변경 커밋에 stable Task ID를 남기고 Explain이 같은 식별자를 보존해 이후 provenance 조회의 연결점을 만든다.

## Success criteria

1. 새 commit message에 `Bouncer-Task`와 `Bouncer-Intent` trailer가 각각 한 번 기록된다.
2. dry-run이 표시한 commit message와 실제 Git commit message가 같다.
3. Explain의 새 `task_commits` 행이 stable Task ID와 소문자 8자리 SHA를 보존한다.
4. 기존 `{ id, sha }` Explain 행과 기존 8자리 `commit_sha`를 계속 읽을 수 있다.
5. standalone과 coordinator worker commit이 같은 trailer 규칙을 사용한다.
6. `execution_kind: verification` Task는 commit provenance를 만들지 않는다.
7. coordinator가 worker commit을 cherry-pick한 뒤에도 Task trailer가 유지된다.

## Out of scope

- 함수 정의와 Git history를 역추적하는 intent resolver
- Plan의 code-first 전환과 `scope_evidence` gate 변경
- context graph 생성·질의·설정 제거
- 과거 Explain과 commit의 일괄 변환
- 8자리 SHA 계약을 full SHA로 바꾸는 작업

## Blueprints

* [001 Task commit provenance](blueprints/001-task-commit-provenance/index.md) - commit message와 Explain에 stable Task ID 기반 provenance를 기록한다.
