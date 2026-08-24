---
type: bouncer.tasks
title: tasks.md의 5중 진술을 3중으로 줄이는 작성 규율을 추가함
description: description·commit_intent·Checklist의 역할 경계를 적어 같은 내용을 다시 쓰지 않게 한다
resource: .bouncer/context/epics/047-context-injection/blueprints/001-brief-injection-slim/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T13:32:35.001+09:00'
bouncer:
  id: TASKS-003
  epic_id: '047'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_type: docs
  commit_intent:
    - 같은 변경이 한 task 문서 안에서 다섯 번 진술되어 브리프가 부풀던 것을 줄임
    - Goal & intent를 서술 SSOT로 두고 나머지 셋의 역할을 좁힘
  affected_paths:
    - skills/spec-authoring/SKILL.md
    - skills/spec-authoring/references/tasks.md
    - test/skill-spec-authoring.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:45:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: fail-skip
        query: spec-authoring tasks description commit_intent Checklist duplication
        result: 0 usable hits — every returned node resolves to a deleted path (commands/sdd-*.md, .superpowers/, skills/sdd-minimality, skills/okf-authoring); graphify skill 0.9.41 vs package 0.8.22 skew
      - graph: context
        status: fail-skip
        query: spec-authoring tasks description commit_intent Checklist duplication
        result: 0 usable hits — context graph returns the same stale source nodes; paths seeded by hand instead
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`spec-authoring`에 역할 경계 세 줄을 넣어, 같은 변경이 한 `tasks.md` 안에서 다섯 번(`title`·`description`·`commit_intent`·`Goal & intent`·`Interface` 제공) 진술되는 것을 세 번으로 줄인다. `## Goal & intent`가 브리프 서술의 SSOT다.

`tasks.md`는 사후 서술이 아니라 사전 계약이고 게이트가 집행하므로 일정 수준의 재진술에는 방어적 가치가 있다. 전부 없애는 것이 아니라 다섯 겹을 세 겹으로 줄인다. 게이트가 검사하는 것은 섹션 존재와 `affected_paths`이지 진술 횟수가 아니므로 G10·G11 계약은 그대로다. task당 ≈100–150 단어가 준다.

## Interface
- 제공: `spec-authoring` tasks 절에 세 규칙이 생긴다 — (1) `description`은 `## Goal & intent` 첫 문장에서 유도하고 같은 내용을 두 번 작성하지 않는다, (2) `commit_intent`는 커밋 메시지 생성 전용이며 브리프 서술과 겹치면 `## Goal & intent`가 SSOT다, (3) `## Checklist`는 `## Touch`의 경로를 다시 열거하지 않고 절차만 담는다.
- 제공: `skills/spec-authoring/references/tasks.md` 예시가 그 규율대로 다시 쓰인다 — 특히 `description`이 Goal 첫 문장에서 유도되고 Checklist가 Touch 경로를 재열거하지 않는다.
- 거부: `description`을 비우거나 삭제하지 않는다. OKF 필수 필드이고 scaffold가 소유한다 — 규율은 "사람이 두 번 쓰지 않는다"이지 "값이 없어도 된다"가 아니다.
- 거부: `commit_intent`의 형식 계약(정확히 두 개의 한국어 `~함`/`~임` 줄, task 문서 전용)을 바꾸지 않는다.
- 거부: G10의 필수 섹션 목록(full 5개 / light 3개)을 바꾸지 않는다.

## Touch
- Modify `skills/spec-authoring/SKILL.md` — tasks 절 Section-specific rules에 역할 경계 세 규칙을 넣는다
- Modify `skills/spec-authoring/references/tasks.md` — 예시 문서를 그 규율대로 다시 쓴다
- Modify `test/skill-spec-authoring.test.js` — 세 규칙의 문구를 계약으로 고정한다

## Do not touch
- `scripts/src/lib/validate-gates.ts` — G10·G11 판정은 그대로다
- `scripts/src/lib/templates.ts` — scaffold 템플릿의 섹션 구성과 주석은 이번 변경 대상이 아니다
- `scripts/src/lib/schema.ts` — `commit_intent` 형식 계약은 그대로다
- `skills/bouncer-plan/SKILL.md` — plan step 4의 `title`·`commit_intent` 지시는 그대로다

## Constraints
- 규칙은 `spec-authoring` 한 곳에만 둔다. 마스터 규칙이나 `bouncer-plan`에 본문을 복제하지 않는다.
- 예시 문서(`references/tasks.md`)는 계속 유효한 full task여야 한다 — 여섯 섹션이 모두 남는다.
- 계약 테스트는 금지 문구 자체를 부재 단언으로 검사하지 않고, 규칙 문장을 긍정 매치로 고정한다.
- 공개 문자열은 한국어를 유지한다.

## Checklist
- [ ] `test/skill-spec-authoring.test.js`에 실패 테스트를 추가한다.
  ```js
  assert.match(body, /description[\s\S]{0,120}Goal & intent[\s\S]{0,80}(유도|첫 문장)/);
  assert.match(body, /commit_intent[\s\S]{0,160}(커밋 메시지 생성 전용|SSOT)/);
  assert.match(body, /Checklist[\s\S]{0,160}Touch[\s\S]{0,80}(다시 열거하지|재열거하지)/);
  ```
- [ ] `node --test test/skill-spec-authoring.test.js`로 실패를 확인한다.
- [ ] `skills/spec-authoring/SKILL.md`에 세 규칙을 넣는다.
- [ ] `skills/spec-authoring/references/tasks.md` 예시를 규율대로 다시 쓴다.
- [ ] `npm run ci`가 통과한다.
