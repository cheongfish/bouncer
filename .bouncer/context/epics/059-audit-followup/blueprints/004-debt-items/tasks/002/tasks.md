---
type: bouncer.tasks
title: YAML 프론트매터 인용 규칙 명시
description: 계획 작성자와 context-review 기록자가 YAML 예약 지시자로 시작하는 문자열을 안전하게 인용하도록 고정한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T10:42:21.219+09:00'
bouncer:
  id: TASKS-002
  epic_id: '059'
  blueprint_id: '004'
  status: ready
  verify: npm run ci
  commit_intent:
    - 계획 문서 관습을 따르면 frontmatter 전체가 깨지는 B16 재현을 막음
    - task와 context-review 기록 경로가 같은 YAML 인용 규칙을 따르게 함
  affected_paths:
    - references/spec-authoring/index.md
    - skills/bouncer-plan/references/context-review.md
    - test/skill-spec-authoring.test.js
    - test/skill-context-review.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T10:55:16+09:00'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: YAML frontmatter quoting reserved leading characters spec authoring context review
        result: 68 hits; top paths scripts/src/lib, scripts/lib, and test
      - graph: context
        status: reused
        query: YAML frontmatter quoting spec authoring context review audit debt
        result: 9 hits; prior spec-authoring blueprint and current BP004 task brief matched
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
계획 작성자와 context-review controller가 백틱 등 YAML 예약 지시자로 시작하는 문자열을 평문 scalar로 쓰지 않도록 정본 규칙을 추가한다. `commit_intent`와 finding `note`를 포함한 author-written frontmatter에 적용하고 `npm run ci`로 문서 계약을 검증한다.

## Interface
- 제공: `spec-authoring`은 YAML 예약 지시자로 시작하는 author-written 문자열을 작은따옴표 또는 block scalar로 기록하도록 요구한다. plan context-review controller도 finding `note`를 쓸 때 같은 규칙을 적용한다.
- 거부: 첫 문자가 백틱인 값을 `- ` 뒤에 평문으로 쓰지 않는다. 문자열 중간의 백틱이나 Markdown 본문의 백틱까지 불필요하게 인용 대상으로 넓히지 않는다.

## Touch
- Modify `references/spec-authoring/index.md` — author-written frontmatter의 YAML 선두 문자 인용 규칙과 안전한 예시를 정본으로 추가한다.
- Modify `skills/bouncer-plan/references/context-review.md` — controller가 findings를 기록할 때 같은 인용 규칙을 적용하도록 연결한다.
- Modify `test/skill-spec-authoring.test.js` — 백틱 선두 scalar와 안전한 인용 형식을 식별자 중심으로 단언한다.
- Modify `test/skill-context-review.test.js` — context-review 기록 경로가 인용 규칙을 보유하는지 단언한다.

## Do not touch
- `scripts/src/lib/frontmatter.ts` — YAML 파서의 허용 문법을 바꾸는 작업이 아니다.
- `scripts/src/lib/validate-gates.ts` — 파싱 실패 진단은 task 003 소관이다.
- `scripts/src/templates/` — scaffold 기본값에는 백틱으로 시작하는 실제 scalar가 없다.

## Constraints
- harness-owned frontmatter와 status 소유권 규칙은 바꾸지 않는다.
- 문구 전체를 바이트 단위로 고정하지 않고 위험 입력과 안전 형식의 식별자만 테스트한다.
- 작은따옴표 안의 작은따옴표는 YAML 규칙에 따라 두 번 써야 함을 예시에 포함한다.

## Checklist
- [ ] 두 skill 테스트에 위험 입력과 안전한 인용 규칙의 존재 단언을 먼저 추가한다.
  ```yaml
  commit_intent:
    - '`git add`가 범위를 벗어나지 않게 함'
  note: >-
    `context-review.md`가 존재하지만 파싱되지 않음.
  ```
- [ ] `node --test test/skill-spec-authoring.test.js test/skill-context-review.test.js`로 새 단언의 실패를 확인한다.
- [ ] spec-authoring의 frontmatter 작성 절과 plan context-review controller 절에 같은 규칙을 쓴다.
- [ ] 규칙이 Markdown 본문이나 문자열 중간의 백틱을 금지하지 않는지 확인한다.
- [ ] `npm run ci`가 통과한다.
