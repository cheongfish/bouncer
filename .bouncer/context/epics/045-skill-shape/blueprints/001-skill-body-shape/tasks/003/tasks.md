---
type: bouncer.tasks
title: 에이전트 문서 4개 본문 골격 정렬
description: Tasks for 003
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T10:25:13.438+09:00'
bouncer:
  id: TASKS-003
  epic_id: '045'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 에이전트 문서 넷의 권한 절과 절차 절 이름이 갈리고 출력 계약이 마지막이 아닌 문서가 있음
    - 권한·가드·절차·출력 계약 순서를 넷에 공통으로 두고 출력 계약을 마지막으로 옮김
  affected_paths:
    - agents/bouncer-implementer.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-debugger.md
    - agents/bouncer-context-reviewer.md
    - test/agents.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T10:25:13.438+09:00'
    suggested_paths:
      - agents/bouncer-implementer.md
      - agents/bouncer-reviewer.md
      - agents/bouncer-debugger.md
      - agents/bouncer-context-reviewer.md
      - test/agents.test.js
    basis:
      - graph: source
        status: reused
        query: named agent output contract authority section
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
      - graph: context
        status: reused
        query: 에이전트 문서 출력 계약 권한 절
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`agents/` 문서 4개를 `rules/skill-shape.md`의 에이전트 골격에 맞춘다. TASKS-001이 그
문서를 이미 만들어 두었으므로 이 task는 문서를 따르기만 한다.

네 문서는 이미 절반쯤 같은 형태다 — 넷 다 권한 절로 시작하고 넷 다
`## Output contract`를 갖는다. 어긋난 곳은 `bouncer-implementer`에 몰려 있다. 그
파일의 현재 절 순서는 `## Authority (task brief only)` → `## Scope` →
`## What you must not do` → `## Flow` → `## Output contract` → `## Guardrails` →
`## Verify-failure re-dispatch`다. 골격과 어긋나는 것이 넷이다 — 권한 절에 괄호
부기가 붙어 있고, 도메인 절 `## Scope`가 가드 절보다 위에 있고, 절차 절 이름이
`## Flow`이며, 출력 계약이 마지막이 아니다.

`bouncer-debugger`는 절차 절이 `## Procedure (4 stages)`로 갈렸다. 읽기 전용 셋은
이미 `## Hard guards (read-only)`이고 순서도 맞다.

셋째 것은 이름만 `## Hard guards`로 맞추고 `(read-only)` 부기는 읽기 전용 셋에만
남긴다. `bouncer-implementer`는 파일을 쓰는 에이전트라 같은 부기를 붙이면 구현자가
자기를 읽기 전용으로 읽는다.

## Interface
- 제공: `agents/` 문서 4개. 각각 `## Authority` → `## Hard guards` → (도메인 H2 자유)
  → `## Procedure`(절차가 있는 경우) → `## Output contract` 순서를 갖고,
  `## Output contract`가 마지막 절인 형태.
- 거부: 에이전트 `name`·`description`·`model`·`readonly` frontmatter, 루브릭 문구,
  심각도 보정 기준, 출력 계약의 항목 이름은 바꾸지 않는다. 절 안의 문장은 이동만 하고
  다시 쓰지 않는다. 어느 에이전트의 권한이나 판정 기준이 달라져야 한다고 판단되면
  구현하지 말고 `/bouncer-plan`으로 되돌린다.

## Touch
- Modify `agents/bouncer-implementer.md` — `## Authority (task brief only)`→`## Authority`, `## Scope`를 가드 절 **뒤로 이동**, `## What you must not do`→`## Hard guards`, `## Flow`→`## Procedure`, `## Output contract`를 마지막으로 이동
- Modify `agents/bouncer-debugger.md` — `## Procedure (4 stages)`→`## Procedure`
- Modify `agents/bouncer-reviewer.md` — `## Hard guards (read-only)` 유지 확인, 절 순서 정렬
- Modify `agents/bouncer-context-reviewer.md` — 같은 이유로 절 순서 정렬
- Modify `test/agents.test.js` — 에이전트 골격 단정 추가

## Do not touch
- `skills/**` — TASKS-001과 TASKS-002가 맡았다. 특히
  `skills/implementation/SKILL.md`는 BP-002도 만진다.
- `rules/skill-shape.md` — TASKS-001의 산출물이다. 골격이 틀렸다고 판단되면 고치지
  말고 보고한다.
- `scripts/`, `hooks/`, `docs/`, `CLAUDE.md`.

## Constraints
- `test/agents.test.js`가 찾는 문자열을 유지한다: `Verify-failure re-dispatch`,
  `Minimum fix proposal`, `Required regression test`, `Needs planning`,
  `Detailed comments`, `하드룰 9` 또는 `Hard rule 9`, `context-review.md`,
  `tasks/<NNN>/tasks.md`.
- `agents/bouncer-implementer.md`에 `known ceilings`와 `Prefer thoroughness`를 넣지
  않는다. `test/agents.test.js:70-71`이 그 부재를 단정한다 — 상세 주석 지침은
  `skills/implementation/SKILL.md`에 살고 에이전트 문서는 포인터만 갖는다.
- `## Hard guards (read-only)`의 `(read-only)` 부기는 `readonly: true`인 셋
  (`bouncer-reviewer`, `bouncer-debugger`, `bouncer-context-reviewer`)에만 붙인다.
- `## Output contract`가 네 문서 모두에서 마지막 H2여야 한다.
- 에이전트 본문 H2는 영어로 쓴다.
- `bouncer-reviewer`·`bouncer-debugger`·`bouncer-context-reviewer` 셋은 이미
  `## Authority` → `## Hard guards (read-only)` 순서다. 확인만 하고 옮기지 않는다.
  실제로 절을 재배치하는 것은 `bouncer-implementer` 하나다.
- 루브릭 본문·심각도 보정 기준은 문장을 고치지 않는다. Distill이 리뷰어 루브릭과
  호출 브리프와 execute 디스패치를 한 커밋 단위로 묶는데, 이 task에서 함께 움직이는
  것은 절 이름과 순서뿐이고 판정 내용이 아니다.
- 절 안의 문장은 옮기기만 하고 다시 쓰지 않는다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] `rules/skill-shape.md`를 읽고 에이전트 골격을 확인한다.
- [ ] `agents/bouncer-implementer.md`를 다음 순서로 만든다:
      ```
      ## Authority                    ← (task brief only) 부기 제거
      ## Hard guards                  ← What you must not do 리네임, (read-only) 없음
      ## Scope                        ← 가드 절 뒤로 이동 (도메인 절)
      ## Procedure                    ← Flow 리네임
      ## Guardrails
      ## Verify-failure re-dispatch
      ## Output contract              ← 마지막으로 이동
      ```
      절 안의 문장은 옮기기만 한다. 권한 절의 「task brief only」 취지는 절 본문이
      이미 담고 있으므로 부기를 떼도 내용이 줄지 않는지 확인하고, 줄어든다면 그
      취지를 본문 첫 문장으로 남긴다.
- [ ] `agents/bouncer-debugger.md`의 `## Procedure (4 stages)`를 `## Procedure`로
      바꾼다. 「4 stages」가 절 본문에 남아 있는지 확인하고, 없으면 첫 줄에 남긴다.
      `## Redispatch limit`은 도메인 절이므로 `## Output contract` 앞에 둔다.
- [ ] `agents/bouncer-reviewer.md`와 `agents/bouncer-context-reviewer.md`가
      `## Authority` → `## Hard guards (read-only)` → (Rubric·Calibration) →
      `## Output contract` 순서인지 확인하고, 아니면 옮긴다.
- [ ] `test/agents.test.js`에 골격 단정을 추가한다:
      ```js
      const READONLY = ['bouncer-reviewer', 'bouncer-debugger', 'bouncer-context-reviewer'];

      test('agent docs share the body skeleton and end with the output contract', () => {
        for (const name of AGENTS) {
          const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
          const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
          assert.strictEqual(heads[0], '## Authority', name);
          // 가드 절은 권한 바로 뒤. 도메인 절(Scope, Rubric 등)은 그 아래로 간다.
          const guard = READONLY.includes(name) ? '## Hard guards (read-only)' : '## Hard guards';
          assert.strictEqual(heads[1], guard, name);
          assert.ok(heads.includes('## Procedure') || READONLY.includes(name), name);
          assert.strictEqual(heads[heads.length - 1], '## Output contract', name);
        }
      });

      test('agent doc bodies use English headings', () => {
        for (const name of AGENTS) {
          const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
          const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
          assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
        }
      });
      ```
      `AGENTS` 상수가 없으면 파일 상단 14행의 이름 배열을 상수로 올려 재사용한다.
- [ ] 네 문서의 마지막 H2를 눈으로 확인한다:
      ```
      for f in agents/*.md; do echo "$f $(grep -E '^## ' $f | tail -1)"; done
      ```
- [ ] `npm test` 통과를 확인한다. 특히 `test/agents.test.js`가 green이어야 한다.
