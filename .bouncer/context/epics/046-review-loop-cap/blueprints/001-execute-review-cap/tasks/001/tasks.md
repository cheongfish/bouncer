---
type: bouncer.tasks
title: execute 리뷰 재검 왕복 2회 상한 추가
description: execute step 5에 리뷰 왕복 상한과 에스컬레이션을 넣고 run은 그 숫자를 참조만 하게 한다
resource: .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T12:58:35.184+09:00'
bouncer:
  id: TASKS-001
  epic_id: '046'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - 리뷰 재검 루프에 종료 조건이 없어 fix 왕복이 무한히 이어질 수 있었음
    - 상한 숫자가 주행 루프에만 있어 단일 execute 호출에는 상한이 걸리지 않았음
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-run/SKILL.md
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-run.test.js
    - docs/workflow.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:24:00.000+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/046-review-loop-cap
      - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop
      - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard
    basis:
      - graph: source
        status: reused
        query: execute review loop cap re-review round trip escalation bouncer-run skill contract test
        result: 81 nodes; top hits test/skill-bouncer-surface.test.js, test/helpers/read-skill.js, test/skill-agentic-code-benchmark.test.js — 롤업 후 test, test/helpers
      - graph: context
        status: updated
        query: execute review loop cap re-review round trip escalation bouncer-run skill contract test
        result: 10 nodes; 046 epic index와 032-autonomous-run·033-quality-security explain.md
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-execute` step 5의 리뷰 fix 루프에 왕복 상한 2회와 상한 도달 시 `/bouncer-plan` 에스컬레이션을 명시한다. 지금 그 자리에는 "fix within scope and re-review"만 있고, 숫자는 `/bouncer-run` step 4에만 있다. 이 task 이후 상한의 소유권은 execute에 있고 run은 verify 상한과 같은 형태로 그 숫자를 참조한다. 수용 기준은 에픽 Success criteria 1~6, 검증 명령은 `npm run ci`다.

## Interface
- 제공: `skills/bouncer-execute/SKILL.md` step 5에 리뷰 왕복 상한 문장 — 왕복 2회, 상한 도달 시 `/bouncer-plan` 에스컬레이션, 상한을 이유로 남은 finding을 `accepted`로 바꾸지 않는다는 금지. 그 파일은 영문 본문이므로 step 4의 `at most **1** time`과 같은 형태의 영어로 쓴다. `skills/bouncer-run/SKILL.md` step 4의 리뷰 문장은 execute 소유임을 밝히고 루프가 별도 상한을 씌우지 않는다고 적되, 한국어 `2회` 리터럴과 기존 `/bouncer-plan`·`accepted` 문장은 남는다.
- 거부: 상한 도달을 `review → accepted`로 처리하는 서술은 쓰지 않는다. run 본문에 execute의 named 디스패치 절차나 상한 판단 근거를 복사하지 않는다 — run 계약 테스트가 `resolveSubagentModel`과 `scale: light` 리터럴을 거부한다. 게이트 번호·판정 로직·review frontmatter 계약을 바꾸는 서술도 쓰지 않는다.

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — step 5 (4)에 리뷰 왕복 상한·에스컬레이션·`accepted` 금지 문장을 넣는다
- Modify `skills/bouncer-run/SKILL.md` — step 4의 리뷰 상한 문장을 verify 문장과 같은 형태의 execute 참조로 바꾼다
- Modify `test/skill-bouncer-execute.test.js` — 새 상한 계약을 고정하는 테스트를 추가한다
- Modify `test/skill-bouncer-run.test.js` — 리뷰 상한 테스트가 소유권 문구까지 확인하도록 넓힌다
- Modify `docs/workflow.md` — 「알아둘 것」에 리뷰 재검 상한이 execute 단독 호출에도 걸린다는 항목을 더한다

## Do not touch
- `skills/review/SKILL.md` — 리뷰 산출물·severity 계약은 이 상한과 별개다
- `agents/bouncer-reviewer.md` — 리뷰어 페르소나·출력 계약을 바꾸지 않는다
- `skills/review/assets/reviewer-prompt.md` — 호출 브리프 슬롯은 상한과 무관하다
- `scripts/src/lib/validate-gates.ts` — G8·G14 판정은 그대로 둔다

## Constraints
- 스킬 본문 골격을 유지한다: 마지막 섹션은 `## ACQ (AskUserQuestion) gates`이고 이 변경은 ACQ를 추가하지 않는다.
- 기존 verify 상한 서술을 바꾸지 않는다 — execute의 `redispatch the debugger at most **1** time`(step 4)과 run의 `**1회**`(step 4) 둘 다 그대로 둔다.
- 각 스킬 본문의 현행 언어를 따른다: `bouncer-execute`는 영문 절차 문장에 한국어 분기가 섞여 있고, `bouncer-run`은 한국어다. `##`/`###` 제목은 영문이어야 한다 (`test/skill-bouncer-surface.test.js`가 한글 제목을 거부한다).
- 상한은 프로즈 계약이다. `scripts/`에 카운터나 새 게이트를 만들지 않는다.

## Checklist
- [ ] `test/skill-bouncer-execute.test.js`에 실패하는 계약 테스트를 먼저 추가한다. `accepted`·`/bouncer-plan`은 본문에 이미 있어 단독 `assert.match`로는 초록이 되므로, 새 문장에만 걸리는 형태로 쓴다:
      ```js
      test('bouncer-execute caps review round-trips at 2 and escalates', () => {
        const { body } = parseFrontmatter(md);
        assert.match(body, /at most \*\*2\*\* review round-trips/);
        assert.match(body, /round-trips[\s\S]{0,200}\/bouncer-plan/);
        // 상한을 accepted 전환으로 빠져나가면 G8이 헛통과함.
        assert.match(body, /never flip[\s\S]{0,80}accepted/);
      });
      ```
- [ ] `node --test test/skill-bouncer-execute.test.js`로 그 테스트가 실패하는 것을 확인한다.
- [ ] `skills/bouncer-execute/SKILL.md` step 5의 (4)를 상한 문장으로 고친다. step 4의 verify 상한과 같은 영문 형태로 쓰고 세 가지를 모두 담는다:
      ```md
      (4) if any actionable finding remains unresolved, fix within scope and
      re-review — at most **2** review round-trips on the same task. On reaching
      that ceiling, escalate to `/bouncer-plan` instead of fixing again, and
      never flip a remaining finding to `accepted` to clear it;
      ```
- [ ] `skills/bouncer-run/SKILL.md` step 4의 리뷰 문장을 verify 문장과 같은 형태로 바꾼다. 현재 「왕복은 **2회**까지다」를 소유권을 밝힌 형태로 고치고, 루프가 별도 상한을 씌우지 않는다는 문장을 더한다. `accepted` 금지 문장은 그대로 둔다:
      ```md
      리뷰 finding이 남아 implementer에게 되돌리는 왕복은 `/bouncer-execute`가
      정한 대로 **2회**까지다. 루프가 이 숫자 위에 별도 상한을 씌우지 않는다.
      상한에 닿으면 `/bouncer-plan`으로 에스컬레이션한다. 루프가 finding을
      `accepted`로 바꾸지 않는다.
      ```
- [ ] `test/skill-bouncer-run.test.js`의 리뷰 상한 테스트에 소유권 확인을 더한다. `/bouncer-execute`는 run 본문에 이미 열 번 나오므로 단독 assert는 무의미하다 — 왕복·소유권·숫자를 한 정규식으로 묶는다:
      ```js
      assert.match(body, /왕복은[\s\S]{0,40}\/bouncer-execute[\s\S]{0,20}2회/);
      ```
- [ ] `docs/workflow.md`의 「알아둘 것」에 항목을 하나 더한다. 기존 「주행이 멈추는 경우는 셋입니다」 항목은 그대로 두고, 새 항목은 그 목록을 되풀이하지 말고 차이만 적는다 — 리뷰 재검 왕복 상한 2회는 `/bouncer-run` 주행뿐 아니라 `/bouncer-execute`를 단독으로 부를 때도 같은 숫자로 걸리고, 상한에 닿으면 `/bouncer-plan`으로 간다.
- [ ] `npm run ci`를 실행해 통과를 확인한다.
