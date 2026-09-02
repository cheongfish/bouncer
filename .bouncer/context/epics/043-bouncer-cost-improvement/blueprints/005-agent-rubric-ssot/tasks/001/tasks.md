---
type: bouncer.tasks
title: implementation 역할 rubric을 named agent 정본으로 이동
description: implementation 스킬을 호출 계약과 주석 루브릭만 남기고 절차·guardrail을 bouncer-implementer로 모은다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:53:09.139+09:00'
bouncer:
  id: TASKS-001
  epic_id: '043'
  blueprint_id: '005'
  status: verified
  verify: npm run ci
  commit_intent:
    - 같은 구현 규율이 스킬과 named agent 문서에 두 벌로 있어 정상 경로에서도 컨트롤러가 상세 rubric을 먼저 읽었음
    - 역할 정본을 agent 하나로 모아 주입량과 규칙 드리프트를 함께 줄이려 함
  affected_paths:
    - skills/implementation/SKILL.md
    - agents/bouncer-implementer.md
    - test/skill-implementation.test.js
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

Blueprint: [005](../../index.md)

## Goal & intent
`skills/implementation/SKILL.md`를 읽어도 최소성 사다리·focused change·tests first·guardrail 전문이 더는 나오지 않고, 그 문장들은 `agents/bouncer-implementer.md` 한 곳에만 있다. 스킬에는 호출 계약 여섯 항목과, 이 스킬이 유일하게 소유한 주석 루브릭만 남는다. 주석 루브릭이 남는 것은 예외가 아니라 계약이다 — Distill Decision이 그 위치를 정본으로 지정했고, `test/agents.test.js`가 agent 쪽에 그 문장이 **없어야** 한다고 이미 단정한다.

## Interface
- 제공:
  - `skills/implementation/SKILL.md` — `## When this applies`, `## Steps`(브리프 권위와 반환 계약), `## Detailed comments`(기존 Step 4 본문을 그대로 승격), `## Guardrails`(호출 측 규율만), `## Return`. 이 스킬에는 디스패치 절차가 없다 — `/bouncer-execute`가 가진다.
  - `agents/bouncer-implementer.md` — `## Procedure`가 사다리 여섯 단, focused change, tests first를 스킬에서 옮겨받아 완전한 문장으로 보유. `## Guardrails`가 「불필요한 추상화 금지」·「never simplify away」 목록을 보유.
  - `test/agents.test.js` — 옮겨간 단언(사다리 각 단, tests-first 근거)을 agent 문서 대상으로 추가.
- 거부:
  - 주석 루브릭·docstring 4부 계약·`scripts/lib/validate.js` Bad/Good 예시를 `agents/`로 옮기는 것. `test/agents.test.js`의 `known ceilings`·`Prefer thoroughness` 부재 단언이 그것을 금지한다.
  - 각 규율의 의미 변경. 문장이 어디 있는지만 바꾼다.
  - 사다리 테스트 케이스를 이름만 남기고 비우는 것. 빈 테스트는 통과하므로 계약 소실을 감춘다.
  - `rules/skill-shape.md`가 요구하는 절 이름과 순서의 변경.

## Touch
- Modify `skills/implementation/SKILL.md` — `## Steps`를 호출 계약 여섯 항목으로 다시 쓰고, 현재 Step 4(Detailed comments) 본문을 `## Steps` 뒤의 도메인 H2 `## Detailed comments`로 승격한다. Steps 1·2·3·5·6과 중복 guardrail을 삭제한다.
- Modify `agents/bouncer-implementer.md` — `## Procedure`의 축약된 사다리를 스킬에서 옮겨온 여섯 단 전문으로 바꾸고, `## Guardrails`에 옮겨온 항목을 더한다. Procedure 3단계의 주석 규칙 포인터는 그대로 둔다.
- Modify `test/skill-implementation.test.js` — `test('implementation climbs a minimality ladder before writing code')` 케이스를 **케이스째로** 삭제한다(단언만 지우면 이름이 남은 빈 테스트가 통과해 계약이 사라진 것을 감춘다). 주석 루브릭을 다루는 두 케이스는 `const step = md.match(...)` 줄까지 포함해 통째로 남긴다. 스킬이 브리프 권위와 반환 계약만 남았음을 단정하는 케이스를 더한다.
- Modify `test/agents.test.js` — 삭제한 사다리 단언을 `agents/bouncer-implementer.md` 대상으로 옮겨 넣는다.

## Do not touch
- `skills/review` · `skills/debugging` · `skills/context-review` — 각각 task 002·003·004 소관이다.
- `agents/bouncer-reviewer.md` · `agents/bouncer-debugger.md` · `agents/bouncer-context-reviewer.md` — 같은 이유다.
- `CLAUDE.md` — hard rule 9의 정본 위치와 문구는 epic 054 Out of scope다.
- `rules/skill-shape.md` — 절 이름과 순서 계약은 epic 045가 못박았다.
- `scripts` — model 해석과 게이트 코드는 이 blueprint가 건드리지 않는다.

## Constraints
- 옮기는 문장은 **복사가 아니라 이동**이다. 옮긴 뒤 원본에 같은 문장이 남아 있으면 이 task는 실패다.
- 규율의 의미를 다듬지 않는다. 표현을 고쳐야 할 이유가 보이면 그것은 `/bouncer-plan` 에스컬레이션 신호다.
- `## Steps`라는 절 이름을 유지한다. 내용이 호출 계약이 되는 것이지 절이 사라지는 것이 아니다.
- agent 문서 본문 제목은 영어다. `test/agents.test.js`가 한글 제목을 거부한다.
- 스킬 본문 산문은 영어를 유지한다. 이 문서군은 한국어 대상(`.bouncer/context/epics/**`)이 아니다.

## Checklist
- [ ] `test/skill-implementation.test.js`에서 사다리 테스트 케이스를 통째로 지우고, 같은 이름의 케이스를 `test/agents.test.js`에 `agents/bouncer-implementer.md` 대상으로 만든다.
- [ ] `npm test`로 새 단언이 실패하는 것을 확인한다.
- [ ] `agents/bouncer-implementer.md`의 `## Procedure` 1단계를 스킬의 사다리 여섯 단 전문으로 바꾸고, `## Guardrails`에 「불필요한 추상화 금지」와 「never simplify away」 항목을 옮겨 넣는다.
- [ ] `skills/implementation/SKILL.md`의 Step 4 본문을 `## Detailed comments` H2로 승격하고, Steps 1·2·3·5·6을 호출 계약 여섯 항목으로 대체한다.
- [ ] `grep -n 'Already in this codebase\|Prefer thoroughness\|known ceilings' skills/implementation/SKILL.md agents/bouncer-implementer.md`로 사다리는 agent에만, 주석 문구는 스킬에만 있는지 확인한다.
- [ ] `wc -w skills/implementation/SKILL.md agents/bouncer-implementer.md`를 기록한다. 스킬 값이 baseline 1239보다 작아야 한다.
- [ ] 옮긴 문단이 두 파일에 동시에 있지 않은지 확인한다(수용 기준 2).
- [ ] `npm run ci`가 통과한다.
