---
type: bouncer.tasks
title: 서브스킬 12개 본문 골격 정렬
description: Tasks for 002
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T10:16:15.850+09:00'
bouncer:
  id: TASKS-002
  epic_id: '045'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 서브스킬 열두 개의 절 이름이 갈려 있고 산출을 보고하는 절이 둘에만 있음
    - 네 골격 절을 열두 개에 공통으로 두고 도메인 고유 절은 그대로 남김
  affected_paths:
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/implementation/SKILL.md
    - skills/verification/SKILL.md
    - skills/review/SKILL.md
    - skills/minimality/SKILL.md
    - skills/debugging/SKILL.md
    - skills/stop-slop/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/migrate-ids/SKILL.md
    - skills/context-review/SKILL.md
    - test/skill-bouncer-surface.test.js
    - test/skill-discovery.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T10:16:15.850+09:00'
    suggested_paths:
      - skills/discovery/SKILL.md
      - skills/spec-authoring/SKILL.md
      - skills/implementation/SKILL.md
      - skills/verification/SKILL.md
      - skills/review/SKILL.md
      - skills/minimality/SKILL.md
      - skills/debugging/SKILL.md
      - skills/stop-slop/SKILL.md
      - skills/graphify-runner/SKILL.md
      - skills/explain-diff/SKILL.md
      - skills/migrate-ids/SKILL.md
      - skills/context-review/SKILL.md
      - test/skill-bouncer-surface.test.js
      - test/skill-discovery.test.js
    basis:
      - graph: source
        status: reused
        query: sub-skill SKILL.md heading assertion helper read-skill
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
      - graph: context
        status: reused
        query: 서브스킬 본문 절 이름 정렬
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
서브스킬 12개를 `rules/skill-shape.md`의 서브스킬 골격에 맞춘다. TASKS-001이 그 문서를
이미 만들어 두었으므로 이 task는 문서를 따르기만 한다.

골격 절은 넷이다 — `## When this applies`, `## Steps`, `## Guardrails`, `## Return`.
도메인 고유 H2는 그대로 둔다. 기존 절 중 역할이 같은 것은 새로 만들지 말고 이름만
바꾼다. `discovery`의 `## Handoff`가 곧 `## Return`이고, `graphify-runner`의
`## Notes`가 곧 `## Guardrails`이며, `spec-authoring`의
`## Ownership boundary (do not cross)`도 `## Guardrails`다. 없는 절만 새로 쓴다.

`minimality`와 `stop-slop`은 `## Steps` 면제다. 두 스킬은 절차 자체가 도메인 절
(`## Decision ladder`, `## Core rules`)로 되어 있고, `minimality`의 것은 계약 테스트가
헤딩째 잡고 있다.

## Interface
- 제공: 서브스킬 12개의 `SKILL.md`. 각각 `## When this applies` → `## Steps`(면제 2개
  제외) → (도메인 H2 자유) → `## Guardrails` → `## Return` 순서를 갖는 형태.
- 거부: 스킬 `name`, frontmatter 필드와 `description` 문구, 절차 단계의 순서와 지시
  내용, 리뷰어 루브릭 문구, 보조 파일의 경로는 바꾸지 않는다. 절 안의 문장은 이동만
  하고 다시 쓰지 않는다. 어느 스킬이 하는 일이 달라져야 한다고 판단되면 구현하지 말고
  `/bouncer-plan`으로 되돌린다.

## Touch
- Modify `skills/discovery/SKILL.md` — `## Flow`→`## Steps`, `## Handoff`→`## Return` 후 `## Guardrails` **뒤로 이동**, `## When this applies` 추가
- Modify `skills/spec-authoring/SKILL.md` — `## How to author`→`## Steps` 후 `## Ownership boundary (do not cross)`→`## Guardrails` **앞으로 이동**, `## When this applies` 추가 (`## Return`은 이미 마지막)
- Modify `skills/implementation/SKILL.md` — `## Flow`→`## Steps`, `## When this applies`·`## Return` 추가
- Modify `skills/verification/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/review/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/minimality/SKILL.md` — `## When to run`→`## When this applies` 후 상단 이동, `## Conflict handling`→`## Guardrails`, `## Return` 추가 (`## Steps` 면제)
- Modify `skills/debugging/SKILL.md` — `## Stages`→`## Steps`(하위 `###` 유지), `## When this applies`·`## Return` 추가
- Modify `skills/stop-slop/SKILL.md` — `## Scope`→`## When this applies`, `## Guardrails`를 마지막 절 `## Return` **바로 앞에** 추가 (`## Steps` 면제)
- Modify `skills/graphify-runner/SKILL.md` — `## Notes`→`## Guardrails`, `## When this applies`·`## Return` 추가
- Modify `skills/explain-diff/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/migrate-ids/SKILL.md` — `## Steps`를 `## Guardrails` 앞으로 이동, `## When this applies`·`## Return` 추가
- Modify `skills/context-review/SKILL.md` — `## When this rubric applies`→`## When this applies`, `## Return` 추가
- Modify `test/skill-bouncer-surface.test.js` — `SUB_PATHS`를 12개로 늘리고 서브스킬 골격 단정 추가
- Modify `test/skill-discovery.test.js` — `Handoff` 단정을 `Return`으로 갱신

## Do not touch
- `skills/bouncer-init/`, `skills/bouncer-plan/`, `skills/bouncer-execute/`,
  `skills/bouncer-commit/`, `skills/bouncer-finalize/`, `skills/bouncer-run/` —
  TASKS-001이 맡았다.
- `skills/agentic-code-benchmark/` — 에픽 Out of scope.
- `skills/review/assets/reviewer-prompt.md` — Distill이 이 경로를 못박고 있고, 루브릭
  문구는 `agents/bouncer-reviewer.md`·execute 디스패치와 한 커밋 단위다. 이 task는
  `SKILL.md`의 절 이름만 만진다.
- `skills/spec-authoring/references/`, `skills/stop-slop/references/`,
  `skills/stop-slop/LICENSE` — 이미 골격을 따르는 배치다.
- `rules/skill-shape.md` — TASKS-001의 산출물이다. 이 task는 따르기만 한다. 골격이
  틀렸다고 판단되면 고치지 말고 보고한다.
- `agents/` — TASKS-003이 맡는다.
- `scripts/`, `hooks/`, `CLAUDE.md`, `docs/`.

## Constraints
- 절 안의 문장은 옮기기만 하고 다시 쓰지 않는다. 계약 테스트가 본문 토큰을 찾는다:
  `distill --all`(discovery), `scope_evidence`(graphify-runner), `## Findings`
  (review·context-review), `## Command`·`## Evidence`(verification),
  `이해 상태`·`Quiz`(explain-diff), `Hard rule 9`·`파싱하지 않아야`·`Prefer thoroughness`
  (implementation — 이 파일에 `하드룰 9`는 없다. 영어 형태로만 있으므로 한국어로
  「복원」하지 않는다).
- `## Decision ladder (in order)` 헤딩을 지우거나 `###`로 강등하지 않는다.
  `test/skill-minimality.test.js:40`의 정규식은 `## Decision ladder`로 시작해 다음
  `\n## `까지를 구간으로 잡는다. 그 lookahead 때문에 이 절 **뒤에 H2가 하나 이상
  더 있어야** 한다 — 마지막 절이 되면 구간을 못 잡고 실패한다. `minimality`는
  `## Return`이 마지막이므로 골격을 따르면 자연히 충족된다.
- `skills/explain-diff/SKILL.md`의 `description`에서 `/bouncer-commit` 문자열을
  유지한다 (`test/skill-explain-diff.test.js:16`).
- `## Return`에 적는 것은 이 스킬이 호출자에게 무엇을 보고하는가다. 게이트 결과나
  검증 성공을 지어내지 않는다.
- 스킬 본문 H2는 영어로 쓴다. 절 안의 한국어 예시와 인용문은 그대로 둔다.
- 새 절을 채울 내용이 없으면 그 스킬이 무엇을 반환하는지 다시 보라. 「없음」으로 채우는
  절이 생기면 구현을 멈추고 보고한다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] `rules/skill-shape.md`를 읽고 서브스킬 골격을 확인한다.
- [ ] 12개 각각에 대해 Touch에 적힌 리네임·이동·추가를 적용한다. 이름만 바꾸는
      항목에서 절 본문을 다시 쓰지 않는다.
- [ ] `test/skill-discovery.test.js:35`의 `assert.match(md, /Handoff/i)`를
      `/Return/`로 바꾼다.
- [ ] `test/skill-bouncer-surface.test.js`의 `SUB_PATHS`에 `context-review`와
      `migrate-ids`를 넣어 12개로 만들고, 골격 단정을 추가한다:
      ```js
      const STEPS_EXEMPT = new Set(['minimality', 'stop-slop']);

      test('sub-skills carry the shared body skeleton in order', () => {
        for (const name of SUB_PATHS) {
          const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
          const want = ['## When this applies'];
          if (!STEPS_EXEMPT.has(name)) want.push('## Steps');
          want.push('## Guardrails', '## Return');
          let at = -1;
          for (const h of want) {
            const i = md.indexOf(`\n${h}\n`);
            assert.ok(i > at, `${name} missing or misordered ${h}`);
            at = i;
          }
        }
      });

      test('sub-skill bodies use English headings', () => {
        for (const name of SUB_PATHS) {
          const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
          const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
          assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
        }
      });
      ```
- [ ] `## Return`이 마지막 H2인지 서브스킬 12개에서만 확인한다. `skills/*`를 그대로
      돌면 워크플로 6개(마지막이 `## ACQ …`)와 범위 밖 `agentic-code-benchmark`까지
      섞여 합불을 읽을 수 없다:
      ```
      for n in discovery spec-authoring implementation verification review \
               minimality debugging stop-slop graphify-runner explain-diff \
               migrate-ids context-review; do
        last=$(grep -E '^## ' "skills/$n/SKILL.md" | tail -1)
        [ "$last" = '## Return' ] || echo "FAIL $n -> $last"
      done
      ```
      출력이 없어야 한다.
- [ ] `npm test` 통과를 확인한다. 특히 `test/skill-*.test.js` 전부가 green이어야 한다.
