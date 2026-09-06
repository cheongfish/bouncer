---
type: bouncer.blueprint
title: 워크플로 계약 후속 검증
description: Verifies generated role parity, measures workflow skill duplication, and evaluates context ranking contribution.
resource: .bouncer/context/epics/066-workflow-contract-followup/blueprints/001-contract-maintenance-evaluation/index.md
tags:
  - bouncer
  - blueprint
  - workflow
  - dispatch
  - graphify
  - measurement
timestamp: '2026-09-06T13:46:05.213+09:00'
bouncer:
  id: '001'
  epic_id: '066'
  blueprint_id: '001'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 워크플로 계약 후속 검증

Epic: [066](../../index.md)

## Intent
- 역할 사본 정합성, 진입 문서 비용, 컨텍스트 검색 기여도를 각각 재현 가능한 증거로 고정한다.
- 측정으로 입증된 범위만 정비하고 순위 정책 변경은 별도 계획으로 남긴다.

## Contract
- 인터페이스: implementer 역할 사본의 exact-match 검사, 여섯 workflow skill의 공통 측정 기준, Graphify context 기여도 보고서를 제공한다. 기존 CLI와 사용자 workflow 인터페이스는 바꾸지 않는다.
- 데이터·상태: 추적되는 implementer TOML과 기존 JSON fixture 형식을 유지한다. 측정 결과는 `docs/workflow-contract.md`와 `docs/graphify-context-contribution.md`에 기록한다.
- 수용 기준: epic 성공 기준 1–7을 task별 focused test와 전체 검증으로 판정한다.
- 검증 명령: task별 focused test를 먼저 실행하고 blueprint 전체는 `npm run ci`로 검증한다.
- 실패 모드·엣지 케이스: implementer 사본이 이미 일치하면 재생성은 no-op으로 두고 회귀 단언만 추가한다. `.codex/` ignore 예외는 그 TOML만 재포함하고 커밋 CLI는 바꾸지 않는다. workflow 정비 근거가 없으면 해당 skill을 수정하지 않는다. context 결과가 기준선보다 오추천을 늘리거나 pre-scaffold self-hit 기준을 어기면 정책 변경 없이 별도 계획을 권고한다.

## Out of scope
- 다른 agent TOML 불일치 수정
- CLI, validator, pointer, gate code와 공개 JSON shape 변경
- Graphify ranking 가중치·필터·confidence 계산 변경
- 새 benchmark runner, dependency, fixture corpus 추가

## One-commit justification
- blueprint는 하나의 후속 검증 PR이며, 역할 사본 정합성·workflow 측정 정비·context 기여도 재평가를 서로 독립된 task 커밋 3개로 분리한다.

## Documents
* [Task 001](tasks/001/tasks.md) - implementer 역할 사본 정합성 고정
* [Task 002](tasks/002/tasks.md) - 여섯 workflow skill 측정과 근거 기반 정비
* [Task 003](tasks/003/tasks.md) - Graphify context 기여도 재평가
* [Context review](context-review.md) - 계획 문서 정합성 판정
