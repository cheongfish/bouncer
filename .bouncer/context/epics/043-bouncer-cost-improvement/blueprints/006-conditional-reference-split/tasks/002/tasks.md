---
type: bouncer.tasks
title: plan 조건부 절차 reference 분리
description: plan의 Distill 준비·Graphify 제안·full context review 상세를 조건부 reference로 옮기고 승인과 plan gate는 본문에 유지한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/006-conditional-reference-split/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T12:10:05.394+09:00'
bouncer:
  id: TASKS-002
  epic_id: '043'
  blueprint_id: '006'
  status: verified
  verify: npm run ci
  commit_intent:
    - plan의 경로별 보조 절차를 필요한 단계에서만 읽도록 분리함
    - 사용자 범위 확인과 plan gate 계약은 진입 스킬 본문에 유지함
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-plan/references/distill-preflight.md
    - skills/bouncer-plan/references/graphify-suggestions.md
    - skills/bouncer-plan/references/context-review.md
    - test/skill-bouncer-plan.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T12:17:06.000+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/006-conditional-reference-split/tasks/002
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/006-conditional-reference-split/tasks/003
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/006-conditional-reference-split/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: bouncer plan conditional reference Distill preflight graphify scope context review approval gate test
        result: 105개 node; 상위 경로 test·test/helpers
      - graph: context
        status: updated
        query: bouncer plan conditional reference Distill preflight graphify scope context review approval gate test
        result: 9개 node; 현재 BP task 002·003·004 경로
---
# Tasks

Blueprint: [006](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer-plan`의 Distill baseline·preflight, Graphify suggestion 생성, full-plan context review 디스패치 상세를 단계별 reference로 분리한다. 발견·ID 할당·scaffold·작성 흐름, `affected_paths` 사용자 확인, 명시적 승인, pointer와 plan gate는 `SKILL.md` 본문에 남아야 한다.

## Interface
- 제공: `references/distill-preflight.md`, `references/graphify-suggestions.md`, `references/context-review.md`가 각각 Distill 준비, graph suggestion, `scale: full` 판정 단계에서만 읽힌다. reference 첫 문단과 `SKILL.md` 호출 단계는 같은 로딩 조건을 쓴다.
- 거부: Discovery 확인, light/full 선택, `affected_paths` 확인·재-ground, approval, `current --set`, G1–G5·G10–G12·G18 판정을 reference로 이동하거나 Graphify 제안을 승인 범위로 자동 복사하지 않는다.

## Touch
- Modify `skills/bouncer-plan/SKILL.md` — 계획 본문, ACQ, 승인 범위와 plan gate를 유지하고 reference 라우팅을 남긴다.
- Create `skills/bouncer-plan/references/distill-preflight.md` — project-root, scratch baseline, preflight와 fallback 상세를 담는다.
- Create `skills/bouncer-plan/references/graphify-suggestions.md` — graph-sync, graceful fallback과 scope evidence 기록 상세를 담는다.
- Create `skills/bouncer-plan/references/context-review.md` — full-plan named reviewer 디스패치와 findings 기록 상세를 담는다.
- Modify `test/skill-bouncer-plan.test.js` — 본문 계약과 세 reference의 로딩·내용 계약을 분리해 단언한다.

## Do not touch
- `scripts/` — scaffold, graph-sync, current와 validate 구현은 바꾸지 않는다.
- `skills/{discovery,spec-authoring,graphify-runner,context-review}/SKILL.md` — 보조 스킬 정본은 이번 이동 대상이 아니다.
- `rules/governance.md` — light/full 계약을 재작성하지 않는다.
- `CLAUDE.md` — Distill과 gate hard rule을 축약하지 않는다.

## Constraints
- `rules/skill-shape.md`의 번호 절차와 마지막 ACQ 절을 유지한다.
- `--all` baseline은 scratch 파일이고 `--preflight`만 context에 주입한다는 계약을 보존한다.
- `scale: light`의 G10 축약과 G18 생략 외에는 scope gate가 같다는 계약을 본문에 유지한다.
- approval 전 status 전환과 `affected_paths` 자동 작성을 허용하지 않는다.
- 최소화 근거: Distill 준비·Graphify 제안·full context review는 로딩 조건이 달라 세 reference로만 나누고 공용 helper는 task 001의 기존 test helper를 재사용한다.

## Checklist
- [ ] 계약 테스트를 먼저 바꿔 세 reference의 경로·로딩 조건·상세 계약과 `SKILL.md`에 남는 ACQ·gate 계약을 분리해 단언한다.
- [ ] `node --test test/skill-bouncer-plan.test.js test/master-rules.test.js test/lightweight-cycle.test.js`로 reference 부재 상태의 실패를 확인한다.
- [ ] Distill 준비, Graphify suggestion, full-plan context review 상세를 각각 옮기고 계획 본문과 사용자 확인·gate 절차를 본문에 남긴다.
- [ ] 잔여 문구 검색으로 이동한 상세 문단이 본문에 중복되지 않고, light/full·Distill·scope 계약을 읽는 기존 테스트가 새 위치에서도 같은 계약을 보는지 확인한다.
- [ ] `npm run ci`가 통과한다.
