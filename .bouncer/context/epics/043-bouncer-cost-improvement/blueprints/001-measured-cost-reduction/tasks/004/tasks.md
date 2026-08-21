---
type: bouncer.tasks
title: 병렬 측정 공유 상태 제약 문서화
description: 포인터와 verify 원장이 Git common directory를 공유하는 제약을 benchmark 및 보안 문서에 고정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.526+09:00'
bouncer:
  id: TASKS-004
  epic_id: '043'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - linked worktree의 포인터와 verify 원장 공유가 병렬 측정을 오염시켰음
    - 독립 clone 요구와 충돌 범위를 공개 문서에서 찾을 수 있게 함
  verify: npm run ci
  affected_paths:
    - skills/agentic-code-benchmark/references/task-suite.md
    - docs/benchmark/protocol.md
    - docs/security.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
      - .bouncer/distill
      - .bouncer/context/epics/034-agentic-benchmark
    basis:
      - graph: source
        status: reused
        query: git common directory current pointer verify ledger benchmark protocol security
        result: '92 hits; top paths runtime-state.ts, current.ts, verification.ts and related tests'
      - graph: context
        status: updated
        query: git common directory current pointer verify ledger benchmark protocol security
        result: '8 hits; git-worktree Distill and epic 034 benchmark context'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
활성 포인터와 verify 원장이 Git common directory 아래에 있어 linked worktree가 공유한다는 제약을 측정 프로토콜·benchmark 사용법·위협 모델에서 같은 문장으로 설명한다. 병렬 Bouncer cycle은 독립 clone만 사용한다.

## Interface
- 제공: benchmark task suite는 Bouncer on arm마다 독립 clone을 요구한다. 보안 문서는 포인터 충돌 범위와 같은 blueprint 경로의 verify 원장 덮어쓰기 범위를 구분한다.
- 거부: linked worktree 격리를 보장한다고 쓰거나, 서로 다른 blueprint의 verify 원장이 항상 충돌한다고 과장하지 않는다. 이번 task에서 런타임 상태 위치를 바꾸지 않는다.

## Touch
- Modify `skills/agentic-code-benchmark/references/task-suite.md` — Bouncer on arm의 독립 clone 규칙과 일반 코드 벤치마크의 worktree 허용을 구분한다.
- Modify `docs/benchmark/protocol.md` — 재측정 전제와 포인터·verify 원장 공유 상태를 현재 계약으로 정리한다.
- Modify `docs/security.md` — Git common directory 런타임 상태의 충돌 범위와 운영 완화를 알려진 한계로 추가한다.

## Do not touch
- `scripts/src/lib/runtime-state.ts` — 포인터 위치를 바꾸지 않는다.
- `scripts/src/lib/verification.ts` — verify 원장 경로·digest를 바꾸지 않는다.
- `skills/agentic-code-benchmark/scripts/` — 측정기 변경은 Task 003 소관이다.

## Constraints
- 포인터는 모든 linked worktree가 하나를 공유하고, verify 원장은 verification 상대경로 digest별로 공유한다는 차이를 보존한다.
- 독립 clone은 운영 완화이지 런타임 격리 해결책이라고 표현하지 않는다.
- 문서 세 곳이 서로 다른 실행 지침을 주지 않게 한다.

## Checklist
- [ ] 세 문서에서 `worktree`, `git-common-dir`, `current`, `verify` 관련 기존 문구를 먼저 검색한다.
- [ ] task suite에 Bouncer on arm은 독립 clone, 포인터를 쓰지 않는 일반 arm은 worktree 가능이라는 경계를 적는다.
- [ ] protocol에 기존 재현 경고를 포인터와 verify 원장 두 상태의 현재 설명으로 갱신한다.
- [ ] security에 충돌 조건·영향·독립 clone 완화를 추가한다.
- [ ] `npm run ci`가 통과한다.
