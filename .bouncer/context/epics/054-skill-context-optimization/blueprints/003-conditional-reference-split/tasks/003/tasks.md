---
type: bouncer.tasks
title: execute 조건부 절차 reference 분리
description: execute의 named-agent 상세와 verify 실패 복구를 조건부 reference로 옮기고 pointer·worktree·execute gate는 본문에 유지한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T12:10:05.431+09:00'
bouncer:
  id: TASKS-003
  epic_id: '054'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - execute의 agent·복구 상세를 해당 분기에 진입할 때만 읽도록 분리함
    - pointer와 worktree 및 execute gate 계약은 진입 스킬 본문에 유지함
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-execute/references/agent-dispatch.md
    - skills/bouncer-execute/references/verification-recovery.md
    - test/skill-bouncer-execute.test.js
    - test/lightweight-cycle.test.js
    - test/skill-debugging.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T12:17:06.000+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/002
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/003
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: bouncer execute conditional reference named agent dispatch fallback verification recovery debugger implementer worktree gate test
        result: 65개 node; 상위 경로 test·test/helpers
      - graph: context
        status: updated
        query: bouncer execute conditional reference named agent dispatch fallback verification recovery debugger implementer worktree gate test
        result: 9개 node; 현재 BP task 002·003·004 경로
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer-execute`의 named-agent model 해석·fallback과 verify 실패의 debugger→implementer 복구 상세를 조건부 reference로 분리한다. pointer task 선택, Distill re-ground, shared worktree, scope·status 소유권, `verification.md`의 `## Command`·`## Evidence` harness 기록과 `validate --gate execute` 절차는 `SKILL.md` 본문에 남아야 한다.

## Interface
- 제공: `references/agent-dispatch.md`는 named dispatch 또는 host fallback이 필요한 단계에서, `references/verification-recovery.md`는 harness가 기록한 실패 증적을 복구 입력으로 소비할 때만 읽힌다. 각 reference 첫 문단과 호출 단계가 같은 조건을 선언한다.
- 거부: pointer·brief 선택, worktree 생성·재사용, `affected_paths`, controller status 소유권, `verification.md` 경로와 `## Command`·`## Evidence` 기록 계약, G6–G8·G13·G14와 execute gate를 reference로 이동하거나 fallback을 삭제하지 않는다.

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — pointer·worktree·scope·status·증적 기록·gate 핵심 절차를 유지하고 조건부 reference 라우팅을 남긴다.
- Create `skills/bouncer-execute/references/agent-dispatch.md` — implementer·reviewer·debugger model 해석, named dispatch, `inherit`·inline fallback 상세를 담는다.
- Create `skills/bouncer-execute/references/verification-recovery.md` — 이미 기록된 verify 실패 증적을 입력으로 받는 debugger report, 순차 implementer 재호출과 1회 상한 상세를 담는다.
- Modify `test/skill-bouncer-execute.test.js` — 본문 핵심 절차와 reference별 dispatch·recovery 계약을 나눠 단언한다.
- Modify `test/lightweight-cycle.test.js` — light implementer 분기와 host fallback 계약을 workflow bundle에서 읽게 한다.
- Modify `test/skill-debugging.test.js` — execute와 run의 debugger 재호출 상한을 workflow bundle에서 읽게 한다.

## Do not touch
- `scripts/` — worktree, verification runner, gate와 commit-safety 구현은 바꾸지 않는다.
- `agents/` — 역할별 rubric은 blueprint 002가 이미 정본화했다.
- `skills/{implementation,verification,review,debugging}/SKILL.md` — 역할 브리프와 출력 계약은 옮기지 않는다.
- `CLAUDE.md` — execute worktree와 gate hard rule을 축약하지 않는다.

## Constraints
- named agent가 없는 host의 inline·generic fallback을 모든 역할에서 보존한다.
- light blueprint의 implementer inline 분기와 `/bouncer-run` 주행 예외를 바꾸지 않는다.
- debugger report는 evidence이며 scope를 넓히는 지시로 취급하지 않는다.
- review 2회와 debugger 1회 상한, `/bouncer-plan` escalation을 유지한다.
- 최소화 근거: 정상 dispatch와 실패 recovery 두 조건만 reference로 나누고 model 해석 helper나 런타임 추상화는 만들지 않는다.

## Checklist
- [ ] 계약 테스트를 먼저 바꿔 본문의 pointer·worktree·`verification.md` 증적 기록·gate 핵심 절차와 reference의 dispatch·recovery 상세를 별도로 단언한다.
- [ ] `node --test test/skill-bouncer-execute.test.js test/lightweight-cycle.test.js test/skill-debugging.test.js`로 reference 부재 상태의 실패를 확인한다.
- [ ] agent dispatch와 verify recovery 상세를 옮기고 본문에는 분기 조건, 입력·출력, 중단 조건, controller 소유권, harness 증적 기록과 gate를 남긴다.
- [ ] 잔여 문구 검색으로 `resolveSubagentModel` 절차와 debugger Output contract 상세가 본문에 중복되지 않는지 확인하고, fallback·light·상한 계약이 bundle에서 한 번씩 검증되는지 확인한다.
- [ ] `npm run ci`가 통과한다.
