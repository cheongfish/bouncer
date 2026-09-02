---
type: bouncer.tasks
title: explain.md 부재 시 행동을 단일 경로로 정리
description: explain-diff가 파일 부재 시 만들라는 문장과 멈추라는 문장을 함께 두는 모순을 없앤다
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T13:09:35.789+09:00'
bouncer:
  id: TASKS-003
  epic_id: '004'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - 'explain-diff가 `explain.md` 부재 시 만들라는 문장과 멈추라는 문장을 나란히 둬 행동이 갈림'
    - 'scaffold 책임이 `/bouncer-finalize` step 2에 있으므로 멈춤 경로만 남겨 한 가지로 읽히게 함'
  affected_paths:
    - skills/explain-diff/SKILL.md
    - test/skill-explain-diff.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T13:16:00+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '83 nodes; hits only under test/ (scaffold.test.js, skill-bouncer-surface.test.js, lightweight-cycle.test.js, helpers/read-skill.js). config.source_dirs is scripts/hooks/test, so skills/, rules/ and docs/ are not indexed and cannot appear.'
      - graph: context
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '9 nodes; hits are the newly authored task docs under tasks/003-005. No prior context doc matched, so no reuse candidate surfaced.'
---

# Tasks

Blueprint: [008](../../index.md)

## Goal & intent
`skills/explain-diff/SKILL.md` 8–10줄이 인접한 두 문장에서 서로 다른 행동을 지시한다. "Called only from `/bouncer-finalize` after `scaffold explain` **(create the file if missing)**" 다음 문장이 "This skill does **not** replace `scaffold explain` — if the file is missing, **stop** and tell the caller to scaffold first"다. `explain.md`가 없을 때 만들라는 것인지 멈추라는 것인지 한 문단에서 갈린다.

scaffold 책임은 `/bouncer-finalize` step 2가 `bouncer scaffold explain`으로 갖는다. 멈춤 경로만 남긴다.

## Interface
- 제공: `explain.md` 부재 시 `explain-diff`의 행동이 하나다 — 멈추고 호출자에게 scaffold를 알린다.
- 거부: 이 스킬이 `explain.md`를 직접 만드는 경로를 받지 않는다. `scaffold explain`을 대체하지 않는다는 기존 계약을 유지한다.

## Touch
- Modify `skills/explain-diff/SKILL.md` — 도입부의 "create the file if missing" 절을 제거한다
- Modify `test/skill-explain-diff.test.js` — 두 지시가 함께 있지 않음을 고정하는 회귀 테스트를 추가한다

## Do not touch
- `skills/bouncer-finalize/SKILL.md` — `scaffold explain` 호출은 이미 step 2에 있고 올바르다
- `scripts/lib/comprehension.js` — `computeDiffSha` 계약은 무관하다
- `scripts/lib/scaffold.js` — scaffold 동작은 바뀌지 않는다

## Constraints
- 퀴즈·`quiz_score`·단일 comprehension 엔트리·`## 이해 상태` 단일 블록 계약을 건드리지 않는다.
- 경량 1문항 규칙(`test/lightweight-cycle.test.js:66-72`)을 건드리지 않는다.
- `test/skill-explain-diff.test.js:43`의 `/scaffold explain|대체하지/` assert가 계속 통과해야 한다 — "대체하지 않는다" 문장은 남긴다.

## Checklist
- [ ] `test/skill-explain-diff.test.js`에 실패 테스트를 먼저 추가한다:
  이 파일은 `read()` 헬퍼가 없다. 파일 자신의 관용구(`fs.readFileSync` + `path.join(root, …)`)를 그대로 쓴다:
  ```js
  test('explain-diff gives one behavior when explain.md is missing', () => {
    const md = fs.readFileSync(path.join(root, 'skills', 'explain-diff', 'SKILL.md'), 'utf8');
    // 원문은 줄바꿈으로 갈려 있다 — 공백을 \s+로 받지 않으면 항상 통과하는 헛된 검사가 된다
    assert.doesNotMatch(md, /create\s+the\s+file\s+if\s+missing/i);
    // 이 줄은 이미 통과한다 — 남기되 신호는 위 doesNotMatch가 낸다
    assert.match(md, /stop\s+and\s+tell\s+the\s+caller\s+to\s+scaffold\s+first/i);
  });
  ```
- [ ] `node --test test/skill-explain-diff.test.js`로 실패와 그 사유를 확인한다. 통과해 버리면 정규식이 줄바꿈을 못 받는 것이니 `\s+`부터 고친다 — 이 검사는 통과가 아니라 실패로 시작해야 한다
- [ ] 도입부에서 `(create the file if missing)` 절을 제거한다. 뒤 문장의 멈춤 지시는 그대로 둔다
- [ ] `## When this applies` 절에 같은 취지의 잔존 문구가 없는지 확인한다
- [ ] `node --test test/skill-explain-diff.test.js` 통과 확인
- [ ] `npm test` 통과 확인
