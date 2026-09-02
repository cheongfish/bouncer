---
type: bouncer.tasks
title: debugging 역할 절차를 named agent 정본으로 이동
description: debugging 스킬의 4단계 본문을 bouncer-debugger로 모으고 스킬에는 호출 계약과 재호출 상한만 남긴다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T09:25:43.529+09:00'
bouncer:
  id: TASKS-003
  epic_id: '043'
  blueprint_id: '005'
  status: verified
  verify: npm run ci
  commit_intent:
    - 조사 4단계와 각 Gate가 스킬과 agent 문서에 두 벌로 있어 verify 실패 경로에서 양쪽이 함께 읽혔음
    - 조사 절차 정본을 agent 하나로 모으되 네 문서가 공유하는 재호출 상한 표기는 유지하려 함
  affected_paths:
    - skills/debugging/SKILL.md
    - agents/bouncer-debugger.md
    - test/skill-debugging.test.js
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
Root cause → Pattern → Hypothesis → Implementation 네 단계의 Output과 Gate 본문이 `agents/bouncer-debugger.md`에만 남는다. `skills/debugging/SKILL.md`에는 호출 계약과 재호출 상한만 남는다. 상한 문장은 옮기지 않는다 — 호출 계약 (d)항목이고, `test/skill-debugging.test.js`의 동기화 테스트가 `skills/bouncer-execute`·`skills/debugging`·`agents/bouncer-debugger`·`skills/bouncer-run` 네 문서 모두에 `**1**` 표기를 요구한다.

## Interface
- 제공:
  - `skills/debugging/SKILL.md` — `## Steps`가 4단계 이름, 읽을 필드(debugger Output contract 다섯 항목의 이름), 컨트롤러가 implementer를 재호출한다는 규칙으로만 구성되고, `## Guardrails`에 재호출 상한 `**1**`이 남는다. 각 단계의 Output·Gate 본문은 없다. 이 스킬에는 디스패치 절차도 fallback 분기도 없다 — 둘 다 `/bouncer-execute`가 가지며 blueprint 003 소관이다. 없는 항목을 이 task에서 새로 쓰지 않는다.
  - `agents/bouncer-debugger.md` — `## Procedure`가 스킬에서 옮겨온 각 단계의 Output과 Gate 문장(특히 「Do not propose fixes before root-cause investigation」과 단일 가설 강제)을 흡수한다.
  - `test/agents.test.js` — 옮겨간 Gate 단언을 agent 문서 대상으로 추가.
- 거부:
  - 재호출 상한 `**1**` 표기의 삭제. 네 문서 동기화 테스트가 깨진다.
  - `agents/bouncer-debugger.md`의 `## Procedure` 서두에 있는 `skills/debugging/SKILL.md` 참조를 남겨 두는 것. 정본이 agent로 오면 그 포인터는 순환이 되므로 지운다.
  - 상한 숫자의 변경. epic 046이 정한 값이다.

## Touch
- Modify `skills/debugging/SKILL.md` — `## Steps`의 네 소절에서 `**Output:**`·`**Gate:**` 본문을 삭제하고 단계 이름과 agent 정본 포인터만 남긴다. `## Guardrails`에서 agent로 옮긴 항목을 지우고 재호출 상한 항목은 남긴다.
- Modify `agents/bouncer-debugger.md` — `## Procedure` 네 단계에 스킬의 Output·Gate 문장을 흡수하고, 서두의 `skills/debugging/SKILL.md` 참조 문장을 지운다.
- Modify `test/skill-debugging.test.js` — `test('debugging forbids proposing fixes before root-cause investigation')` 케이스를 **케이스째로** 삭제한다(그 단언 하나가 케이스의 전부라, 단언만 지우면 빈 테스트가 남는다). 4단계 이름 단언과 상한 동기화 테스트는 그대로 둔다.
- Modify `test/agents.test.js` — 삭제한 Gate 단언을 `agents/bouncer-debugger.md` 대상으로 옮겨 넣는다.

## Do not touch
- `skills/bouncer-execute` · `skills/bouncer-run` — 상한 동기화 테스트가 읽지만 이 task는 그 문서를 고치지 않는다. 진입 스킬 본문은 blueprint 003 소관이다.
- `skills/implementation` · `skills/review` · `skills/context-review` — 각각 task 001·002·004 소관이다.
- `agents/bouncer-implementer.md` · `agents/bouncer-reviewer.md` · `agents/bouncer-context-reviewer.md` — 같은 이유다.
- `rules/skill-shape.md` — 절 이름과 순서 계약은 epic 045가 못박았다.

## Constraints
- 복사가 아니라 이동이다.
- 재호출 상한 문장은 `skills/debugging/SKILL.md`에 남긴다. 이 task가 그 문장을 지우면 `test/skill-debugging.test.js`의 네 문서 동기화 테스트가 즉시 실패한다.
- 4단계의 이름과 순서를 바꾸지 않는다. 다른 문서들이 그 이름으로 이 절차를 가리킨다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.

## Checklist
- [ ] `test/skill-debugging.test.js`에서 root-cause Gate 테스트 케이스를 통째로 지우고, 같은 이름의 케이스를 `test/agents.test.js`에 `agents/bouncer-debugger.md` 대상으로 만든다.
- [ ] `npm test`로 새 단언이 실패하는 것을 확인한다.
- [ ] `agents/bouncer-debugger.md`의 `## Procedure` 각 단계에 스킬의 Output·Gate 문장을 흡수하고, 서두의 스킬 참조를 지운다.
- [ ] `skills/debugging/SKILL.md`의 `## Steps`를 위 Interface가 열거한 항목으로 줄인다. 재호출 상한 항목은 `## Guardrails`에 남긴다. 디스패치나 fallback 문장을 새로 쓰지 않는다.
- [ ] `node --test test/skill-debugging.test.js`로 네 문서 상한 동기화 테스트가 여전히 통과하는지 먼저 확인한다.
- [ ] `wc -w skills/debugging/SKILL.md agents/bouncer-debugger.md`를 기록한다. 스킬 값이 baseline 449보다 작아야 한다.
- [ ] 옮긴 문단이 두 파일에 동시에 있지 않은지 확인한다(수용 기준 2).
- [ ] `npm run ci`가 통과한다.
