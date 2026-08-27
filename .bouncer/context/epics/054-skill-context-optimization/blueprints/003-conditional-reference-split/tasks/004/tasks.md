---
type: bouncer.tasks
title: run 중단·복구 절차 reference 분리
description: run의 실패 중단과 수동 복구 상세를 조건부 reference로 옮기고 루프 소유권과 task 경계 ACQ는 본문에 유지한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T12:10:05.467+09:00'
bouncer:
  id: TASKS-004
  epic_id: '054'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - 정상 run 경로가 실패 복구 상세를 미리 읽는 비용을 줄임
    - loop ownership과 task 경계 ACQ 계약은 진입 스킬 본문에 유지함
  affected_paths:
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-run/references/stop-recovery.md
    - test/skill-bouncer-run.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T12:17:06.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
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
        query: bouncer run conditional reference stop recovery verify review scope pointer worktree loop ACQ test
        result: 69개 node; 상위 경로 scripts/src/lib·test
      - graph: context
        status: updated
        query: bouncer run conditional reference stop recovery verify review scope pointer worktree loop ACQ test
        result: 9개 node; 현재 BP task 002·003·004 경로
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer-run`의 verify 재실패, review 상한, scope 위반과 사용자 중단 뒤 복구 상세를 실패 시에만 읽는 reference로 분리한다. 오케스트레이터 소유권, execute→commit 반복, autonomy 분기, 시작·task 경계 ACQ와 종료 조건은 `SKILL.md` 본문에 남아야 한다.

## Interface
- 제공: `references/stop-recovery.md`는 verify·review·scope·사용자 거절로 주행이 멈춘 경우에만 읽히며, pointer·worktree 보존과 수동 재개 절차를 담는다. reference 첫 문단과 중단 단계가 같은 로딩 조건을 선언한다.
- 거부: 루프 controller의 네 소유권, report routing, debugger·review 상한, `nextTask`, `current --set`, start·interactive ACQ, `/bouncer-finalize` 종료 안내를 reference로 이동하거나 run이 자동 재시도하게 만들지 않는다.

## Touch
- Modify `skills/bouncer-run/SKILL.md` — loop ownership, 반복 단위, 상한, ACQ와 종료 핵심 절차를 유지하고 중단 reference 라우팅을 남긴다.
- Create `skills/bouncer-run/references/stop-recovery.md` — 중단 원인별 pointer·worktree 보존과 수동 복구 상세를 담는다.
- Modify `test/skill-bouncer-run.test.js` — 본문의 반복 계약과 stop-recovery reference 계약을 분리해 단언한다.

## Do not touch
- `scripts/` — current, commit, validation과 autonomy 구현은 바꾸지 않는다.
- `skills/bouncer-{execute,commit,finalize}/SKILL.md` — 하위 workflow 절차와 종료 workflow는 이번 task에서 바꾸지 않는다.
- `agents/` — run이 소비하는 역할 report 계약은 그대로 둔다.
- `CLAUDE.md` — run의 workflow 위치와 controller 경계를 축약하지 않는다.

## Constraints
- `/bouncer-run`은 finalize를 호출하지 않고 열린 task 소진 뒤 안내만 한다.
- `auto`와 `interactive`의 commit ACQ 처리, interactive task 경계 ACQ를 바꾸지 않는다.
- verify 1회·review 2회 상한은 execute 소유값을 참조하며 별도 상한을 만들지 않는다.
- 중단 뒤 pointer와 execute worktree를 보존하고 자동 재시도하지 않는다.
- 최소화 근거: 네 중단 원인의 결과와 재개 절차가 같으므로 `stop-recovery.md` 하나로 묶고 task 001의 bundle helper를 재사용한다.

## Checklist
- [ ] 계약 테스트를 먼저 바꿔 본문의 loop·ACQ·상한 계약과 stop-recovery의 조건·복구 계약을 별도로 단언한다.
- [ ] `node --test test/skill-bouncer-run.test.js test/skill-debugging.test.js`로 reference 부재 상태의 실패를 확인한다.
- [ ] 중단·복구 상세를 reference로 옮기고 본문에는 실패 분류, reference 진입 조건, pointer·worktree 보존 결과와 자동 재시도 금지를 남긴다.
- [ ] 잔여 문구 검색으로 복구 절차 상세가 본문과 reference에 중복되지 않는지 확인하고, 정상 종료와 실패 중단 경로가 섞이지 않았는지 확인한다.
- [ ] `npm run ci`가 통과한다.
