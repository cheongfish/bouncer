---
type: bouncer.tasks
title: context-review 역할 rubric을 named agent 정본으로 이동
description: context-review 스킬의 판정 네 scope를 bouncer-context-reviewer로 모으고 full-plan 게이트와 Findings 계약은 남긴다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T09:25:43.569+09:00'
bouncer:
  id: TASKS-004
  epic_id: '054'
  blueprint_id: '002'
  status: ready
  verify: npm run ci
  commit_intent:
    - 판정 네 scope와 심각도 기준이 스킬과 agent 문서에 두 벌로 있어 plan 디스패치 경로에서 함께 읽혔음
    - 판정 정본을 agent 하나로 모으되 G18에 직결되는 full-plan 게이트는 본문에 남기려 함
  affected_paths:
    - skills/context-review/SKILL.md
    - agents/bouncer-context-reviewer.md
    - test/skill-context-review.test.js
    - test/agents.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T09:30:00.000+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: updated
        query: 'named agent rubric reviewer implementer debugger contract test'
        result: '58 nodes; hits roll up to test/ only (skill-review.test.js, public-contract.test.js, helpers/read-skill.js). config.source_dirs is scripts/hooks/test so skills/ and agents/ cannot be suggested - added by hand. public-contract.test.js enumerates skills/bouncer-* directories only, so it is out of scope.'
      - graph: context
        status: updated
        query: 'named agent rubric ssot skill call contract'
        result: '3 nodes; self plus epic 009 named-agent-routing and epic 034 benchmark-skill Contract headings - adjacent-plan noise, no new scope.'
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
Cross-document contradiction·Scope review·Korean quality·Verifiability 네 판정 scope의 본문과 심각도 기준이 `agents/bouncer-context-reviewer.md`에만 남는다. `skills/context-review/SKILL.md`에는 호출 계약과, 이 스킬이 유일하게 소유한 `## When this applies` full-plan 게이트, 그리고 `## Findings` 필드 계약이 남는다. 게이트 문구를 남기는 근거는 `test/skill-context-review.test.js`가 `Full plans only`·`bouncer.scale`·`light`·`G18`·`no light variant`를 이 스킬 대상으로 단정한다는 것이다. `scale: light`에는 이 루브릭도 G18도 없다는 규정이라 G18 판정에 직결된다.

## Interface
- 제공:
  - `skills/context-review/SKILL.md` — `## When this applies`의 full-plan 게이트 전문이 그대로 남고, `## Steps`는 Load, `## Findings` 필드 계약, 네 scope 이름, 컨트롤러 소유권으로만 구성된다. 판정 본문은 agent를 가리킨다. 이 스킬에는 디스패치 절차도 fallback 분기도 없다 — 둘 다 `/bouncer-plan`이 가지며 blueprint 003 소관이다. 없는 항목을 이 task에서 새로 쓰지 않는다.
  - `agents/bouncer-context-reviewer.md` — `## Rubric — four scopes`가 스킬에서 옮겨온 각 scope의 판정 문장(Mermaid zoom 규정, `scope_evidence` 부재는 상태이지 실패가 아니라는 규정, 판정 제외 OKF 목록)을 흡수한다.
  - `test/agents.test.js` — 옮겨간 scope 단언을 agent 문서 대상으로 추가.
- 거부:
  - `## When this applies`의 full-plan 게이트 문구 이동. `test/skill-context-review.test.js`가 `Full plans only`·`bouncer.scale`·`light`·`G18`·`no light variant`를 스킬 대상으로 단정한다.
  - `## Findings` 필드 계약(id·severity·status·accepted note)의 이동. G18 판정 계약이라 호출 측에 남는다.
  - 「light에 대체 판정을 두지 않는다」 규정의 완화.

## Touch
- Modify `skills/context-review/SKILL.md` — Step 3의 `### Cross-document contradiction`·`### Scope review`·`### Korean quality`·`### Verifiability of success criteria` 본문과 심각도 매핑을 삭제하고 agent 정본 포인터로 바꾼다. `## When this applies`와 Step 2의 Findings 계약은 그대로 둔다.
- Modify `agents/bouncer-context-reviewer.md` — `## Rubric — four scopes`에 옮겨온 판정 문장을 흡수하고, 그 절 서두의 `Follow` + `skills/context-review/SKILL.md` 참조 문장을 지운다(정본이 이쪽으로 오면 순환 포인터가 된다 — task 003이 debugger에 하는 것과 같다). `## Calibration`은 이미 있는 정의를 유지한다.
- Modify `test/skill-context-review.test.js` — `test('context-review covers the four judgment scopes')` 케이스를 **케이스째로** 삭제하고(그 단언들이 케이스의 전부다), OKF 판정 제외와 Mermaid 단언도 함께 옮긴다. full-plan 게이트 케이스와 Findings 계약 케이스는 그대로 둔다.
- Modify `test/agents.test.js` — 삭제한 scope 단언을 `agents/bouncer-context-reviewer.md` 대상으로 옮겨 넣는다.

## Do not touch
- `skills/stop-slop` — Korean quality scope가 참조하는 대상 문서다. 참조만 하고 내용은 만지지 않는다.
- `skills/implementation` · `skills/review` · `skills/debugging` — 각각 task 001·002·003 소관이다.
- `agents/bouncer-implementer.md` · `agents/bouncer-reviewer.md` · `agents/bouncer-debugger.md` — 같은 이유다.
- `scripts` — G18 구현과 findings 필드 검사는 그대로다.
- `skills/bouncer-plan` — 디스패치 절차는 진입 스킬 소관이고 blueprint 003 대상이다.

## Constraints
- 복사가 아니라 이동이다.
- `## When this applies`의 full-plan 게이트는 한 문장도 줄이지 않는다. 이 절이 이 스킬의 고유 정본이다.
- 네 scope의 이름과 순서를 바꾸지 않는다. 다른 문서와 테스트가 그 이름으로 가리킨다.
- Mermaid 판정이 다섯 번째 scope가 아니라 Cross-document의 하위 항목이라는 규정을 유지한다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.

## Checklist
- [ ] `test/skill-context-review.test.js`에서 네 scope 테스트 케이스를 통째로 지우고, 같은 이름의 케이스를 `test/agents.test.js`에 `agents/bouncer-context-reviewer.md` 대상으로 만든다. OKF 판정 제외와 Mermaid 단언도 같이 옮긴다.
- [ ] `npm test`로 새 단언이 실패하는 것을 확인한다.
- [ ] `agents/bouncer-context-reviewer.md`의 `## Rubric — four scopes`에 각 scope의 판정 문장과 판정 제외 OKF 목록을 흡수하고, 서두의 스킬 참조 문장을 지운다.
- [ ] `skills/context-review/SKILL.md` Step 3의 네 소절 본문을 지우고 agent 정본 포인터로 바꾼다.
- [ ] `node --test test/skill-context-review.test.js`로 full-plan 게이트 단언이 여전히 통과하는지 확인한다.
- [ ] `wc -w skills/context-review/SKILL.md agents/bouncer-context-reviewer.md`를 기록한다. 스킬 값이 baseline 852보다 작아야 한다.
- [ ] 옮긴 문단이 두 파일에 동시에 있지 않은지 확인한다(수용 기준 2).
- [ ] `npm run ci`가 통과한다.
