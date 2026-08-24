---
type: bouncer.tasks
title: execute 브리프 읽기에서 scope_evidence를 주입 제외로 명시함
description: scope_evidence는 계획 근거 감사용이므로 execute 읽기 경로에서 뺀다
resource: .bouncer/context/epics/047-context-injection/blueprints/001-brief-injection-slim/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T13:32:35.001+09:00'
bouncer:
  id: TASKS-002
  epic_id: '047'
  blueprint_id: '001'
  status: ready
  verify: npm run ci
  commit_type: docs
  commit_intent:
    - scope_evidence가 구현자의 행동을 바꾸지 않는데 브리프마다 함께 읽히는 것을 막음
    - 문서에는 그대로 남겨 G4 입력과 계획 근거 감사 기록을 유지함
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - test/skill-bouncer-execute.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:45:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: fail-skip
        query: execute task brief read scope_evidence injection exclusion
        result: 0 usable hits — every returned node resolves to a deleted path (commands/sdd-*.md, .superpowers/, skills/sdd-minimality, skills/okf-authoring); graphify skill 0.9.41 vs package 0.8.22 skew
      - graph: context
        status: fail-skip
        query: execute task brief read scope_evidence injection exclusion
        result: 0 usable hits — context graph returns the same stale source nodes; paths seeded by hand instead
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-execute` step 1이 task 브리프를 읽을 때 `bouncer.scope_evidence`를 주입 대상에서 제외한다고 `skills/bouncer-execute/SKILL.md`에 명시한다. 이 값의 용도는 계획 근거 감사이고 소비자는 `graphify-runner`(작성), G4(`validate-gates`), `context-review`(대조) 셋뿐이다 — execute 경로에는 소비자가 없다.

문서에서 지우지 않는다. `affected_paths`가 권한의 SSOT이고 `suggested_paths`는 그 근거일 뿐이므로, 브리프를 읽는 쪽에서만 뺀다. task당 ≈60 단어다.

step 3·4의 named 디스패치는 이미 「only these task-brief sections … Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist」로 프론트매터를 제외하고 있다. 빠져 있는 것은 컨트롤러 자신의 step 1 읽기다.

## Interface
- 제공: step 1의 **Task brief** 문단에 `bouncer.scope_evidence`를 읽기·주입 대상에서 제외한다는 문장이 생기고, 제외 이유(계획 근거 감사 전용, G4 입력으로 문서에는 남음)를 함께 적는다.
- 거부: `scope_evidence`를 문서에서 삭제하거나 G4 판정을 바꾸지 않는다.
- 거부: `affected_paths`·`verify`·`commit_intent` 등 다른 프론트매터 필드를 제외 목록에 넣지 않는다 — 이번 제외는 `scope_evidence` 하나다.

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — step 1 Task brief 문단에 `scope_evidence` 주입 제외 문장을 넣는다
- Modify `test/skill-bouncer-execute.test.js` — 그 제외 문구를 계약으로 고정한다

## Do not touch
- `scripts/src/lib/validate-gates.ts` — G4 판정은 그대로다
- `skills/graphify-runner/SKILL.md` — `scope_evidence` 작성 계약은 그대로다
- `skills/context-review/SKILL.md` — `suggested_paths`와 `affected_paths` 대조는 plan 단계이고 계속 필요하다
- `.bouncer/context/epics/**` — 기존 task 문서의 `scope_evidence` 값을 지우지 않는다

## Constraints
- 문장 추가만 한다. step 1의 기존 브리프 해석 규칙(`current.task.path` 우선, `task`가 `null`이면 리졸버의 첫/단일 문서)은 바뀌지 않는다.
- 계약 테스트는 문구를 정규식으로 고정하되, 금지 문구 자체를 부재 단언으로 검사하지 않는다.
- 공개 문자열은 한국어를 유지한다.

## Checklist
- [ ] `test/skill-bouncer-execute.test.js`에 실패 테스트를 추가한다.
  ```js
  assert.match(body, /scope_evidence[\s\S]{0,200}(주입|읽기)[\s\S]{0,40}제외/);
  ```
- [ ] `node --test test/skill-bouncer-execute.test.js`로 실패를 확인한다.
- [ ] `skills/bouncer-execute/SKILL.md` step 1에 제외 문장과 이유를 넣는다.
- [ ] `npm run ci`가 통과한다.
