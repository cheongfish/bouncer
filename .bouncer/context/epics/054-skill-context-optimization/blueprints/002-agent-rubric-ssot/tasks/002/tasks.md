---
type: bouncer.tasks
title: review 역할 rubric을 named agent 정본으로 이동
description: review 스킬 Step 3의 루브릭 네 절을 bouncer-reviewer로 모으고 스킬에는 디스패치와 Findings 계약만 남긴다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T09:25:43.486+09:00'
bouncer:
  id: TASKS-002
  epic_id: '054'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 컨트롤러가 reviewer를 부르기 직전에 reviewer가 쓸 루브릭 전문을 먼저 읽고 있었음
    - 판정 기준을 agent 정본 하나로 모아 두 문서가 갈라질 여지를 없애려 함
  affected_paths:
    - skills/review/SKILL.md
    - agents/bouncer-reviewer.md
    - test/skill-review.test.js
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
`skills/review/SKILL.md` Step 3에 통째로 들어 있던 판정 루브릭 네 절(Spec compliance, Code quality, Over-engineering, Calibration)이 `agents/bouncer-reviewer.md`에만 남는다. 컨트롤러는 agent를 부르기만 하는데 agent가 쓸 기준 전문을 먼저 읽고 있었다. 네 서브스킬 중 디스패치 절차를 가진 것은 이 스킬 하나뿐이라, 호출 계약이 온전히 남는 유일한 자리이기도 하다. 스킬에는 `## Findings` 필드 계약, 디스패치 네 단계, 컨트롤러 소유권만 남는다. 셋 다 호출 계약 (b)·(c)·(f) 항목이다.

## Interface
- 제공:
  - `skills/review/SKILL.md` — `## Steps`가 Load(브리프와 diff 기준), Findings 필드 계약, `bouncer-reviewer` 디스패치 네 단계, Assert 넷으로만 구성된다. 루브릭 본문은 없고 `agents/bouncer-reviewer.md`를 가리킨다.
  - `agents/bouncer-reviewer.md` — 기존 `## Rubric —` 세 절과 `## Calibration`이 스킬에서 옮겨온 문장(Constraint breach의 Do not touch 대비 설명, 「rejects」 규정, 「Severity is a label, not a filter」)을 흡수해 완전한 정본이 된다.
  - `test/agents.test.js` — 옮겨간 루브릭 단언을 agent 문서 대상으로 추가.
- 거부:
  - `skills/review/assets/reviewer-prompt.md`의 이동·삭제. Distill이 그 경로를 못박았고, 호출 브리프 슬롯으로서 루브릭 요약을 계속 보유한다.
  - 디스패치 네 단계와 `resolveSubagentModel`·`inherit` fallback 문구의 삭제. 호출 계약 (a)·(e)이며 model 해석 자체의 재배치는 blueprint 004 소관이다.
  - `## Findings` 필드 계약(severity·status·accepted note)의 이동. G14 판정 계약이라 호출 측에 남는다.

## Touch
- Modify `skills/review/SKILL.md` — Step 3에서 `### Spec compliance`·`### Code quality`·`### Over-engineering`·`### Calibration` 네 소절을 삭제하고, 그 자리에 판정 기준이 `agents/bouncer-reviewer.md`에 있다는 한 줄을 넣는다. Load·Contract·디스패치 네 단계·Assert는 남긴다.
- Modify `agents/bouncer-reviewer.md` — 스킬에만 있던 문장을 대응 `## Rubric —` 절과 `## Calibration`에 흡수한다. 특히 Calibration 첫 문단(「label, not a filter」와 보고 누락 금지)을 옮긴다.
- Modify `test/skill-review.test.js` — 루브릭 단언 중 스킬 `md`를 대상으로 하는 것만 삭제한다. `reviewerPrompt` 대상 단언과 디스패치 단언은 그대로 둔다. **`test('review rubric flags behavior changes that ship without tests')`를 빠뜨리지 않는다** — 그 케이스는 `[md, reviewerPrompt, agent]`를 순회하며 「without a test」를 단정하고, 그 아래 `assert.match(md, /docs-only|…/)`를 따로 단정한다. 두 문장 모두 이 task가 지우는 블록에만 있으므로, 순회 목록에서 `md`를 빼고 `docs-only` 단언은 `agent` 대상으로 옮긴다.
- Modify `test/agents.test.js` — 삭제한 루브릭 단언을 `agents/bouncer-reviewer.md` 대상으로 옮겨 넣는다.

## Do not touch
- `skills/review/assets/reviewer-prompt.md` — Distill이 경로를 못박은 호출 브리프 슬롯이다.
- `skills/implementation` · `skills/debugging` · `skills/context-review` — 각각 task 001·003·004 소관이다.
- `agents/bouncer-implementer.md` · `agents/bouncer-debugger.md` · `agents/bouncer-context-reviewer.md` — 같은 이유다.
- `scripts` — `## Findings` 필드 계약을 읽는 G14 구현은 그대로다.
- `rules/skill-shape.md` — 절 이름과 순서 계약은 epic 045가 못박았다.

## Constraints
- 복사가 아니라 이동이다. 스킬에서 지운 문장이 agent에 그대로 있어야 하고, 양쪽에 동시에 있으면 안 된다.
- `test/skill-review.test.js`의 `reviewerPrompt` 대상 단언은 건드리지 않는다. 그 파일을 안 만지므로 단언도 그대로 통과해야 한다.
- 심각도 어휘(`blocker`/`major`/`minor`/`nit`)와 각 정의 문장을 다듬지 않는다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.

## Checklist
- [ ] `grep -n 'md' test/skill-review.test.js`로 스킬 본문을 대상으로 하는 단언을 **전부** 열거한 뒤 지운다. `ship without tests` 케이스의 순회 목록과 `docs-only` 단언이 그 목록에 포함되는지 눈으로 확인한다.
- [ ] 지운 단언을 `test/agents.test.js`에 `agents/bouncer-reviewer.md` 대상으로 더한다.
- [ ] `npm test`로 새 단언이 실패하는 것을 확인한다.
- [ ] `agents/bouncer-reviewer.md`의 `## Calibration`에 「Severity is a label, not a filter」 문단과 보고 누락 금지 문장을 옮겨 넣는다.
- [ ] `skills/review/SKILL.md` Step 3의 네 소절을 지우고 agent 정본을 가리키는 한 줄로 바꾼다.
- [ ] `grep -c 'Spec compliance\|Over-engineering' skills/review/SKILL.md agents/bouncer-reviewer.md skills/review/assets/reviewer-prompt.md`로 스킬 본문에는 없고 agent와 브리프 슬롯에는 있는지 확인한다.
- [ ] `wc -w skills/review/SKILL.md agents/bouncer-reviewer.md`를 기록한다. 스킬 값이 baseline 876보다 작아야 한다.
- [ ] 옮긴 문단이 두 파일에 동시에 있지 않은지 확인한다(수용 기준 2).
- [ ] `npm run ci`가 통과한다.
