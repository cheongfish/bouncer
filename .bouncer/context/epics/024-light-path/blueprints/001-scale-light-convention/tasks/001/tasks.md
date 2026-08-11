---
type: bouncer.tasks
title: 경량 경로 선언을 blueprint에 남기고 plan이 공용 epic을 재사용하게 함
description: Tasks for 001
resource: .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T10:44:40.063+09:00'
bouncer:
  id: TASKS-001
  epic_id: '024'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 경량 여부는 사용자만 판정할 수 있는데 그 선언이 plan 이후 단계까지 남을 자리가 없음
    - blueprint frontmatter `bouncer.scale`을 선언 자리로 정하고 plan이 그것을 묻고 쓰게 함
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - docs/workflow.md
    - test/skill-bouncer-plan.test.js
  graph:
    generated_at: '2026-08-11T11:05:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - skills/bouncer-plan
      - skills/bouncer-execute
      - skills/explain-diff
      - docs
      - test
      - test/helpers
    basis:
      - graph: source
        status: reused
        query: light path scale declaration skill prose plan execute explain-diff quiz subagent dispatch inline
        result: 49 nodes, BFS depth=2 — test/skill-bouncer-surface.test.js, test/session-graph.test.js, test/helpers/read-skill.js. source_dirs가 scripts/hooks/test라 skills/ 경로는 나오지 않아 수동 추가함
      - graph: context
        status: updated
        query: blueprint frontmatter scale light maintenance epic quiz count inline reviewer implementer
        result: 21 nodes — 015-workflow-ergonomics/001-adaptive-quiz, EPIC-013-comprehension-gate/BP-003, EPIC-014 explain.md 섹션. 퀴즈 규칙 선례 확인용이며 affected_paths 후보는 아님
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-plan`이 경량 경로 여부를 사용자에게 묻고, 선언을 받으면 blueprint
`index.md`에 `bouncer.scale: light`를 쓰고 epic 신설 대신 slug `maintenance` epic을
재사용하도록 산문을 고친다. `docs/workflow.md`에 그 경로가 무엇을 줄이고 무엇은
줄이지 않는지 남긴다. 코드는 건드리지 않는다 — 이 커밋이 끝나도 `scripts/` 아래
동작은 한 바이트도 달라지지 않으며 `scale` 키는 아무도 읽지 않는 상태다(읽는 쪽은
TASKS-002).

## Interface
- 제공
  - blueprint `index.md` frontmatter의 선택 필드 `bouncer.scale`. 의미 있는 값은
    `light` 하나. 미등록 필드이므로 `schema.ts` 변경 없이 `bouncer validate`를
    통과한다.
  - `/bouncer-plan` 산문의 두 지점: (1) ID 할당 단계에서 경량 여부 질문과 공용
    `maintenance` epic 재사용 지시, (2) Author 단계에서 `bouncer.scale: light`
    기록 지시.
  - `docs/workflow.md`의 경량 경로 절.
- 거부
  - 자동 판정. plan 시점에는 diff가 없어 범위가 좁은지 판단할 근거가 없다.
    산문은 반드시 사용자에게 묻는 형태여야 하고, 묻지 않고 쓰면 안 된다.
  - `light` 외 값에 대한 검증·거부. 값이 다르면 조용히 일반 경로다.
  - `scripts/` 어느 파일이든 수정. 규약을 읽는 코드를 만들지 않는다.

## Touch
- Modify `skills/bouncer-plan/SKILL.md` — 2단계(ID 할당)에 경량 선언 질문과
  `maintenance` epic 재사용 규칙을 넣고, 4단계(Author)에 `bouncer.scale: light`
  기록 지시를 `commit_type` / `commit_intent` 문단 옆에 넣는다.
- Modify `docs/workflow.md` — 경량 경로 절을 추가한다. 줄이는 셋(epic 신설,
  서브에이전트 왕복, 퀴즈 규모)과 줄이지 않는 것(문서 수, 게이트)을 함께 적는다.
- Modify `test/skill-bouncer-plan.test.js` — 위 산문 계약을 고정하는 테스트를
  추가한다.

## Do not touch
- `scripts/` 전체 — 이 task는 코드를 바꾸지 않는다. 특히
  `scripts/src/lib/schema.ts`(필드 등록 금지),
  `scripts/src/lib/templates.ts`(스캐폴드 기본값은 "키 없음"이라 쓸 것이 없다),
  `scripts/src/lib/validate.ts`(게이트 분기 금지).
- `skills/bouncer-execute/SKILL.md`, `skills/explain-diff/SKILL.md` —
  읽는 쪽은 TASKS-002다.
- `.bouncer/Distill.md` — 승격은 `/bouncer-finalize` 몫이다.
- 기존 epic 001–023의 blueprint `index.md` — `scale` 키를 소급 추가하지 않는다.

## Constraints
- 산문은 한국어를 유지한다. 식별자(`bouncer.scale`, `light`, `maintenance`),
  경로, 코드 펜스는 원문 그대로 둔다.
- `light`가 아닌 값을 거부하거나 경고하는 문장을 쓰지 않는다. "그 외에는
  일반 경로"라는 긍정 서술로만 적는다.
- 공용 epic은 slug만 `maintenance`로 고정하고 id는 그때 비어 있는 `\d{3}`이라고
  적는다. `024-maintenance` 같은 특정 번호를 산문에 박지 않는다.
- 공용 epic을 `closed`로 만들지 말라는 이유(epic 022 잠금 이후 blueprint를
  더 붙일 수 없게 됨)를 산문에 남긴다.
- 이탈 경로(작업이 커지면 `scale` 줄을 지우고 일반 경로로 복귀)를 산문에 남긴다.
- 기존 테스트의 부재 단언을 깨지 않는다. `test/skill-bouncer-plan.test.js`는
  `superpowers|profile-aware|…`가 산문에 없어야 한다고 단언하고,
  `test/init.test.js`는 `docs/workflow.md`에 `superpowers|profile-aware|methodology`가
  없어야 한다고 단언한다. 특히 **`methodology`는 `docs/workflow.md`에 쓸 수 없다** —
  "운용 지침"을 영어로 옮기고 싶은 자리에서 걸린다. 두 파일 모두 Touch 대상이
  아니므로 산문 쪽에서 피한다.
- 새 게이트 코드(G-)나 구조 코드(S-)를 만들지 않는다.

## Checklist
- [ ] `test/skill-bouncer-plan.test.js`에 실패하는 테스트를 먼저 추가한다.
      최소 다음 단언을 포함한다:
      ```js
      test('bouncer-plan asks for the light path and reuses the shared maintenance epic', () => {
        const { body } = parseFrontmatter(md);
        assert.match(body, /bouncer\.scale/);
        assert.match(body, /light/);
        assert.match(body, /maintenance/);
        // 사용자에게 묻는다 — 자동 판정 금지를 긍정 문구로 단언한다.
        assert.match(body, /묻|물어|ask/i);
        assert.match(body, /자동 판정하지 않|선언/);
      });
      ```
- [ ] `npm test`로 그 테스트가 실패하는 것을 확인한다.
- [ ] `skills/bouncer-plan/SKILL.md` 2단계(ID allocation)에 다음을 넣는다:
      경량 여부를 사용자에게 묻는다(자동 판정하지 않는다) / 선언을 받으면 epic을
      새로 만들지 않고 slug `maintenance` epic 아래 blueprint id만 할당한다 /
      그 epic이 없을 때만 한 번 만든다 / 그 epic은 `closed`로 만들지 않는다.
- [ ] `skills/bouncer-plan/SKILL.md` 4단계(Author)에 `bouncer.scale: light`를
      blueprint `index.md`에 쓰라는 지시와, 선언이 없으면 키 자체를 넣지 않는다는
      지시를 넣는다. `schema.ts`에 등록하지 않는 미등록 필드임을 함께 적는다.
- [ ] `docs/workflow.md`에 경량 경로 절을 추가한다. 줄이는 셋과 줄이지 않는 것,
      `bouncer.scale: light` 선언 위치, 이탈 경로를 적는다.
- [ ] `npm test`가 통과한다.
