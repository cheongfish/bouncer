---
type: bouncer.tasks
title: plan 저작·범위 단계를 다중 task 묶음으로 일반화
description: plan 절차문이 tasks/001만 저작하도록 시키는 것을 task 묶음 순회로 바꾼다
resource: .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T13:09:29.899+09:00'
bouncer:
  id: TASKS-001
  epic_id: '053'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 'plan 게이트는 발견된 각 task 묶음에 G4·G5·G10–G12를 적용하는데 절차문은 `tasks/001`만 저작하라고 시켜 다중 task blueprint가 게이트에서 막힘'
    - '저작·그래프·범위 단계를 순회 형태로 바꿔 절차문과 게이트가 같은 것을 말하게 함'
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - test/skill-bouncer-plan.test.js
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

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-plan`의 step 4(Author)·5(Graph suggestions)·6(affected_paths)이 `tasks/001/tasks.md` 한 문서만 지목한다. `scripts/lib/validate-gates.js`는 task 묶음을 순회하며 G4·G5·G10–G12를 각 문서에 적용하고, `docs/gates.md:12`도 "G3–G5·G10–G12는 **발견된 각 task 묶음**(`tasks/<NNN>/tasks.md`)에 각각 적용"이라고 이미 적어 두었다. 절차문만 뒤처져 있어, task 002 이상을 가진 blueprint는 절차대로 해도 plan 게이트에서 실패하고 복구 방법이 문서에 없다.

세 단계가 blueprint 아래 모든 task 묶음을 대상으로 읽히게 만들고, 그 일반화를 고정하는 회귀 테스트를 새로 둔다. task가 하나뿐인 경량 blueprint도 같은 문장으로 성립해야 한다.

## Interface
- 제공: `/bouncer-plan` step 4·5·6이 blueprint 아래 존재하는 모든 `tasks/<NNN>/tasks.md`를 저작·주입·확정 대상으로 지시한다. step 3이 이미 안내하는 `bouncer scaffold task --blueprint <dir> --id <NNN>`과 이어진다.
- 거부: 특정 번호를 절차의 기본값으로 삼는 서술을 받지 않는다. `tasks/001`을 대표 예시로 남기더라도 "그 문서만" 저작하라는 지시로 읽히면 안 된다. 게이트 코드·번호·문서 스키마는 바꾸지 않는다.

## Touch
- Modify `skills/bouncer-plan/SKILL.md` — step 4·5·6의 `tasks/001/tasks.md` 지목을 task 묶음 순회로 고친다
- Modify `test/skill-bouncer-plan.test.js` — 순회 지시를 고정하는 회귀 테스트를 추가한다

## Do not touch
- `scripts/lib/validate-gates.js` — 게이트는 이미 순회한다. 문서를 게이트에 맞추는 작업이지 그 반대가 아니다
- `docs/gates.md` — 순회 사실을 이미 정확히 진술하고 있다
- `skills/spec-authoring/references/blueprint.md` — task 하나짜리 **완성 예시** 문서다. 절차 기본값이 아니라 예시이므로 `tasks/001`이 남아 있는 것이 맞다
- `skills/spec-authoring/references/tasks.md` — 같은 이유의 완성 예시

## Constraints
- 게이트 코드(G4·G5·G10–G12·G18)의 번호와 의미를 바꾸지 않는다.
- 경량 경로 서술(`--scale light`, G10 세 절)을 건드리지 않는다. task가 하나인 blueprint에서도 새 문장이 그대로 성립해야 한다.
- 기존 assert는 느슨한 regex라 그대로 통과해야 한다. 통과하던 assert를 지우지 않는다.
- `## Documents` 목록이나 scaffold 템플릿은 이번 범위가 아니다. Distill `plugin-skills`가 "`scripts/src/lib/templates.ts` blueprint Documents link `tasks/001/…`, so keep `templates.ts` (and assertions like `test/init.test.js`) in Touch when changing scaffold task layout names"라고 적어 두었다 — 이 task는 scaffold 레이아웃 **이름**을 바꾸지 않으므로 그 두 파일을 열지 않는다. 열어야 할 이유가 생기면 범위를 넓히지 말고 계획으로 에스컬레이션한다.
- task 002가 같은 파일 step 5를 함께 고친다. 그쪽 금지 리터럴(`graphify.enabled: true`, `pip install graphifyy`)을 이 task의 새 산문에 들이지 않는다 — 순서와 무관하게 서로의 guard를 빨갛게 만들지 않기 위함이다.
- `doesNotMatch` assert를 쓰면 새로 쓰는 산문이 금지 리터럴을 다시 적는 순간 자기 테스트를 깨뜨린다(Distill `plugin-skills`의 같은 계열 경고). 절차문에 `tasks/001/tasks.md`를 예시로도 남기지 않거나, assert 범위를 step 4–6 구간으로 좁힌다.

## Checklist
- [ ] `test/skill-bouncer-plan.test.js`에 실패 테스트를 먼저 추가한다. 최소 두 가지를 assert한다 — step 4·5·6 영역에 `tasks/001/tasks.md` 리터럴이 없을 것, 그리고 task 묶음 순회를 지시하는 표현이 있을 것:
  이 파일은 `read()` 헬퍼가 없다. 모듈 수준 `md` 상수와 `parseFrontmatter(md).body`를 쓰는 기존 관용구를 따른다:
  ```js
  test('bouncer-plan authors every task bundle, not only 001', () => {
    const { body } = parseFrontmatter(md);
    assert.doesNotMatch(body, /tasks\/001\/tasks\.md/);
    assert.match(body, /tasks\/<NNN>\/tasks\.md/);
  });
  ```
- [ ] `node --test test/skill-bouncer-plan.test.js`로 이 테스트가 **실패**하는 것과 실패 사유가 `tasks/001` 잔존임을 확인한다
- [ ] step 4 Author의 "Fill every implementation-ready section in `tasks/001/tasks.md`"를 blueprint 아래 각 `tasks/<NNN>/tasks.md`를 채우라는 지시로 고친다
- [ ] step 5 Graph suggestions의 `suggested_paths` 기록 대상을 각 task 묶음으로 고친다
- [ ] step 6 affected_paths의 제안·확정 대상을 각 task 묶음으로 고치고, 확정 뒤 `distill --for` 재접지가 task별로 돈다는 점을 유지한다
- [ ] step 4의 `bouncer.verify` 기록 위치도 해당 task 문서로 읽히게 맞춘다
- [ ] `node --test test/skill-bouncer-plan.test.js` 통과 확인
- [ ] `npm test` 통과 확인
