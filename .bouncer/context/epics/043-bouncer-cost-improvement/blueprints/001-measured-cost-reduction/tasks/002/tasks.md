---
type: bouncer.tasks
title: scaffold 스키마 힌트 보강
description: task와 review 템플릿에 유효한 basis 및 severity 모양을 주석으로 제시한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.457+09:00'
bouncer:
  id: TASKS-002
  epic_id: '043'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - scaffold가 게이트 입력 모양을 숨겨 에이전트가 실패 왕복으로 계약을 배웠음
    - 검증 값은 비워 둔 채 소비 위치에 유효한 스키마 주석을 제공함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/templates.ts
    - scripts/lib/scaffold.js
    - scripts/lib/templates.js
    - test/scaffold.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context/epics/015-workflow-ergonomics
      - .bouncer/context/epics/033-quality-security
    basis:
      - graph: source
        status: reused
        query: scaffold scope_evidence basis review context-review severity templates
        result: '3 hits; scripts/src/lib/templates.ts, scripts/lib/templates.js, test/session-graph.test.js'
      - graph: context
        status: updated
        query: scaffold scope_evidence basis review context-review severity templates
        result: '3 hits; epic 015 graph-basis-record, epic 033 context-review-guard'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
새 task와 review 문서를 받은 에이전트가 S9/G4 및 G18/G14의 입력 모양과 허용값을 gate 실패 없이 알 수 있게 한다. scaffold 값은 계속 미완성 상태여서 빈 계획은 승인되지 않는다.

## Interface
- 제공: `tasks.md` 주석은 `basis` 엔트리의 네 필드와 `source | context`, `updated | reused | fail-skip | skip-disabled | missing`을 보여준다. `review.md`와 `context-review.md` 주석은 finding의 `id`, `severity`, `status`, accepted `note` 계약과 severity 허용값을 보여준다.
- 거부: 주석 예시를 실제 `basis`나 finding 값으로 파싱하지 않는다. scaffold 직후 S9/G4와 G18은 기존처럼 실패하며 `affected_paths`도 비어 있다.

## Touch
- Modify `scripts/src/lib/scaffold.ts` — 빈 `basis` 의도 옆에 유효 엔트리 모양을 보여주는 YAML 주석을 생성한다.
- Modify `scripts/src/lib/templates.ts` — task와 review/context-review 본문에 허용값 주석을 넣는다.
- Modify `scripts/lib/scaffold.js` — TypeScript 변경의 배포 CJS 산출물을 갱신한다.
- Modify `scripts/lib/templates.js` — 템플릿 변경의 배포 CJS 산출물을 갱신한다.
- Modify `test/scaffold.test.js` — 주석 힌트와 빈 검증 값 유지 계약을 단언한다.

## Do not touch
- `scripts/src/lib/validate-structural.ts` — `scope_evidence` 스키마와 S9를 바꾸지 않는다.
- `scripts/src/lib/validate-sections.ts` — finding 열거값과 본문 파서를 바꾸지 않는다.
- `scripts/src/lib/validate-gates.ts` — G4·G14·G18 판정을 완화하지 않는다.
- `.bouncer/config.json` — 설정 변경이 아니다.

## Constraints
- 실제 `scope_evidence.basis` 기본값은 `[]`, context-review status는 `pending`, findings는 `[]`를 유지한다.
- 힌트는 YAML/Markdown 주석이라 OKF frontmatter 파싱 결과에 들어가지 않아야 한다.
- 기존 상수의 허용값을 복사해 설명하되 새 상수·helper·의존성을 만들지 않는다.

## Checklist
- [ ] `test/scaffold.test.js`에 scaffold 본문이 네 basis 필드와 severity 허용값을 포함한다는 실패 테스트를 추가한다.
- [ ] 같은 테스트에서 parsed `basis: []`, `findings: []`, `status: pending`이 유지됨을 단언한다.
- [ ] 테스트 실패를 확인한 뒤 `scaffold.ts`와 `templates.ts`의 주석만 수정한다.
- [ ] `npm run build`로 `scripts/lib/{scaffold,templates}.js`를 갱신한다.
- [ ] `npm run ci`가 통과한다.
