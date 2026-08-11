---
type: bouncer.tasks
title: 경량 선언을 읽어 execute 왕복과 퀴즈 규모를 줄임
description: Tasks for 002
resource: .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T10:44:40.063+09:00'
bouncer:
  id: TASKS-002
  epic_id: '024'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 경량 선언이 blueprint에 남아도 그것을 읽는 쪽이 없어 서브에이전트 왕복과 퀴즈 규모가 그대로임
    - execute가 implementer·reviewer를 인라인으로 돌리고 explain-diff가 질문을 1문항으로 고정하게 함
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - skills/explain-diff/SKILL.md
    - test/skill-bouncer-execute.test.js
    - test/skill-explain-diff.test.js
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
TASKS-001이 만든 `bouncer.scale: light` 선언을 읽는 쪽을 만든다.
`/bouncer-execute`는 그 선언이 있으면 `bouncer-implementer`와 `bouncer-reviewer`를
named 디스패치 대신 인라인으로 돌리고, `explain-diff`는 질문 수를 1로 고정한다.
`bouncer-debugger`는 축소 대상이 아니다. named agent 미지원 호스트를 위한 기존
fallback 문구는 그대로 남아야 한다 — 경량 분기가 그 문장을 대체하면 Codex에서
G8이 막힌다.

## Interface
- 제공
  - `/bouncer-execute` 3단계(Implement)와 5단계(Review)에 경량 분기: blueprint
    `index.md`의 `bouncer.scale`이 `light`면 named 디스패치 네 단계
    (`resolveSubagentModel` → named 호출 → slug 거절 시 `inherit` 재시도 →
    미지원 시 fallback)를 건너뛰고 `implementation` / `review` 스킬을 인라인으로
    실행한다.
  - `explain-diff` 3단계(Quiz)에 경량 분기: `scale: light`면 질문 수 1 고정.
- 거부
  - `bouncer-debugger`의 인라인화. verify 실패는 작업이 예상보다 작지 않았다는
    신호라 조사 품질을 깎을 자리가 아니다. 4단계 디스패치 문구는 그대로 둔다.
  - 기존 fallback 문구의 삭제·대체. 인라인은 *선언에 의한 선택*이고 fallback은
    *호스트 제약*이다. 두 문장이 공존해야 한다.
  - 컨트롤러 책임 이동. 인라인이어도 문서 status 전환과 Findings 기록은
    컨트롤러 몫이고, `review → accepted`는 모든 finding이 정리된 뒤에만 찍는다.
  - 질문 수 0. `explain-diff`의 최소값 1은 그대로다.

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — 3단계와 5단계에 `scale: light`
  인라인 분기를 넣고, 4단계 debugger 디스패치와 각 단계의 fallback 문구는
  그대로 둔다.
- Modify `skills/explain-diff/SKILL.md` — 3단계 질문 수 규칙에 `scale: light`면
  1 고정이라는 예외를 넣는다.
- Modify `test/skill-bouncer-execute.test.js` — 인라인 분기와 fallback 문구 존치,
  debugger 미축소를 고정하는 테스트를 추가한다.
- Modify `test/skill-explain-diff.test.js` — 1문항 고정 규칙을 고정하는 테스트를
  추가한다.

## Do not touch
- `scripts/` 전체. 특히 `scripts/src/lib/subagents.ts`와
  `scripts/src/lib/validate.ts` — 디스패치 형태는 산문 계약이고 게이트는
  분기하지 않는다.
- `agents/bouncer-implementer.md`, `agents/bouncer-reviewer.md`,
  `agents/bouncer-debugger.md` — 에이전트 페르소나와 가드는 그대로다.
  인라인은 호출 방식만 바꾼다.
- `skills/implementation/SKILL.md`, `skills/review/SKILL.md`,
  `skills/review/reviewer-prompt.md` — 인라인으로 실행되는 브리프의 내용은
  같다.
- `skills/bouncer-plan/SKILL.md`, `docs/workflow.md` — TASKS-001이 이미 썼다.
- `.bouncer/Distill.md` — 승격은 `/bouncer-finalize` 몫이다.

## Constraints
- 산문은 한국어를 유지한다. 식별자와 경로, 코드 펜스는 그대로 둔다.
- `bouncer-debugger`를 축소하지 않는 이유를 산문에 한 줄로 남긴다. 이유 없이
  빼두면 다음 개정에서 "일관성"을 명분으로 지워진다.
- 인라인과 fallback을 같은 문장에 섞지 않는다. 각각 별도 문장으로 적어
  `assert.match`가 둘을 따로 확인할 수 있게 한다.
- 인라인 경로에서도 "한 implementer" 규칙과 컨트롤러의 status 소유는 그대로다.
- 기존 테스트의 `assert.doesNotMatch` 단언을 깨지 않는다 —
  `test/skill-bouncer-execute.test.js`는 `ensureWorktreeRoot`,
  `.bouncer/worktrees`, `already gitignored` 부재를 단언한다.
- 새 게이트 코드나 구조 코드를 만들지 않는다.

## Checklist
- [ ] `test/skill-bouncer-execute.test.js`에 실패하는 테스트를 먼저 추가한다.
      최소 다음 단언을 포함한다:
      ```js
      test('bouncer-execute inlines implementer and reviewer on the light path', () => {
        const { body } = parseFrontmatter(md);
        assert.match(body, /bouncer\.scale|scale:\s*light/);
        assert.match(body, /인라인/);
        // fallback 문구는 남아야 한다 — 경량 분기가 그것을 대체하면 G8이 막힌다.
        assert.match(body, /named agents are unavailable|미지원/i);
        // debugger는 축소 대상이 아니다.
        assert.match(body, /bouncer-debugger/);
      });
      ```
- [ ] `test/skill-explain-diff.test.js`에 실패하는 테스트를 먼저 추가한다:
      ```js
      test('explain-diff fixes the light path at one question', () => {
        const md = fs.readFileSync(path.join(root, 'skills/explain-diff/SKILL.md'), 'utf8');
        assert.match(md, /scale/);
        assert.match(md, /light/);
        assert.match(md, /1문항|질문 수(를)? 1/);
        // 일반 경로의 1–10 판단은 유지된다.
        assert.match(md, /1–10|1-10/);
      });
      ```
- [ ] `npm test`로 두 테스트가 실패하는 것을 확인한다.
- [ ] `skills/bouncer-execute/SKILL.md` 3단계에 경량 분기를 넣는다: blueprint
      `index.md`의 `bouncer.scale`이 `light`면 `implementation` 스킬을 인라인으로
      실행하고 named 디스패치 네 단계를 건너뛴다. 그 외에는 지금 순서 그대로.
      "한 implementer" 규칙과 컨트롤러의 status·커밋 소유는 인라인에서도 같다.
- [ ] `skills/bouncer-execute/SKILL.md` 5단계에 같은 분기를 넣는다: `scale: light`면
      `reviewer-prompt.md`를 채우고 `review` 스킬을 인라인 read-only로 실행한다.
      Findings 기록과 `review → accepted`는 컨트롤러 몫으로 그대로 둔다.
- [ ] `skills/bouncer-execute/SKILL.md` 4단계에 `bouncer-debugger`는 경량 경로에서도
      디스패치한다는 한 줄과 그 이유를 넣는다.
- [ ] 각 단계의 기존 fallback 문구(named agents 미지원 호스트)가 그대로 남아
      있는지 확인한다.
- [ ] `skills/explain-diff/SKILL.md` 3-1(질문 수)에 `scale: light`면 1 고정이라는
      예외를 넣는다. 그 외에는 기존 1–10 판단을 유지하고, `quiz_score`가 `N/1`이
      된다는 점을 적는다.
- [ ] `npm test`가 통과한다.
