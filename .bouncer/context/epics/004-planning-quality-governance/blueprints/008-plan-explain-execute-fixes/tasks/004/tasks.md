---
type: bouncer.tasks
title: 경량 경로의 리뷰를 named 디스패치로 환원
description: scale light에서도 리뷰는 named 에이전트가 맡게 해 자기 diff 자기 판정을 없앤다
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T13:09:35.824+09:00'
bouncer:
  id: TASKS-004
  epic_id: '004'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - '경량 경로가 같은 세션에 구현과 리뷰를 함께 맡겨 자기 diff를 자기가 판정함'
    - '리뷰만 named로 되돌려 구현과 판정의 분리를 회복함'
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - rules/governance.md
    - test/skill-bouncer-execute.test.js
    - test/lightweight-cycle.test.js
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
`skills/bouncer-execute/SKILL.md` step 5는 포인터 `scale`이 `light`면 named 디스패치를 건너뛰고 `review` 스킬을 인라인으로 돌린다. step 3의 구현도 인라인이므로, 경량 경로에서는 한 세션이 diff를 쓰고 같은 세션이 그 diff를 판정한다. `rules/governance.md:79`가 이 한계를 이미 "Limit of inline review: the same session judges **its own diff**"로 적어 두었고, 같은 문서 규칙 4는 `/bouncer-run` 주행에 대해서만 "must not become the implementer or review its own diff"를 근거로 named를 유지시킨다. 그 근거는 단독 `/bouncer-execute` 경량 실행에도 똑같이 성립한다.

리뷰만 named 디스패치로 되돌린다. 구현(step 3) 인라인과 퀴즈 1문항 등 나머지 경량 계약은 그대로 둔다.

## Interface
- 제공: `scale`과 무관하게 step 5는 `resolveSubagentModel` → named `bouncer-reviewer` 호출 → slug 거절 시 `inherit` 재시도 → named 미지원 호스트에서 fresh generic / 인라인 폴백의 네 단계를 탄다. `rules/governance.md` 규칙 4는 인라인 대상을 implementer로 한정한다.
- 거부: `scale: light`를 이유로 리뷰 디스패치를 건너뛰는 분기를 받지 않는다. 호스트가 named를 지원하지 않을 때의 폴백 문장은 별개로 남는다 — 경량 분기가 그 문장을 대체하면 안 된다(기존 계약).

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — step 5의 경량 인라인 리뷰 분기를 제거하고 named 순서를 단일 경로로 되돌린다
- Modify `rules/governance.md` — 규칙 4의 인라인 대상을 implementer로 좁히고, 인라인 리뷰 한계 문단을 새 정책에 맞춘다
- Modify `test/skill-bouncer-execute.test.js` — 인라인 리뷰를 요구하는 assert를 named 요구로 바꾼다
- Modify `test/lightweight-cycle.test.js` — 경량 사이클 계약에서 리뷰 인라인 진술을 갱신한다

## Do not touch
- `skills/bouncer-run/SKILL.md` — 주행 중 named 유지는 이미 참이고 이 변경으로 더 참이 된다. 문장을 건드리지 않는다
- `skills/review/SKILL.md` — 리뷰 스킬의 판정 계약 자체는 바뀌지 않는다
- `docs/compatibility.md` — 파기 계약 기록은 light **문서 세트**에 대한 것이지 리뷰 디스패치가 아니다
- `scripts/lib/subagents.js` — 모델 해석 동작은 그대로다

## Constraints
- step 3의 구현 인라인 분기와 `bouncer-debugger`의 named 유지는 건드리지 않는다. 이번에 바뀌는 것은 리뷰뿐이다.
- 호스트 `named agents are unavailable` 폴백 문장을 경량 분기와 합치지 않는다. `test/lightweight-cycle.test.js:59-64`가 그 분리를 assert한다.
- 경량 판정은 계속 step 1 포인터 응답의 `scale`만 읽는다. `test/skill-bouncer-execute.test.js:145`의 `doesNotMatch(/blueprint \`index.md\`의 \`bouncer.scale\`/)` 절만 그대로 지킨다 — 같은 테스트의 `matches.length` 값은 이번에 바뀌므로 보존 대상이 아니다.
- `rules/governance.md`를 다시 쓸 때 `test/lightweight-cycle.test.js:13-28`이 요구하는 세 문구 `inline`·`its own diff|self-review`·`named agents are unavailable`가 문서 어딘가에 남아야 한다. 인라인은 implementer에 대해, self-review 한계는 그 구현 인라인에 대해 다시 쓰면 세 문구 모두 자연스럽게 남는다.
- `docs/**`에서 리뷰 디스패치를 진술하는 문장이 leftover 검색에 걸리면, 범위를 넓히지 말고 계획으로 에스컬레이션한다.

## Checklist
- [ ] 잔존 문장을 훑는다. 아래 셋은 **양성으로 확인된 무해 히트**이므로 보고 대상이 아니다 — `skills/bouncer-run/SKILL.md:39,41`(주행 오케스트레이션, 이 변경으로 더 참이 됨), `docs/ARCHITECTURE.md:107`(context-review 호스트 폴백), `skills/bouncer-plan/SKILL.md:211`("lighter inline review" — context-review 이야기다). 그 밖의 히트만 진행 전에 보고한다:
  ```bash
  grep -rn "인라인\|inline" skills rules | grep -iv "graphify"
  ```
- [ ] `test/skill-bouncer-execute.test.js`의 `bouncer-execute inlines implementer and reviewer on the light path`를 구현만 인라인임을 요구하도록 고치고, 리뷰가 named를 타는 것을 assert하는 항목을 더한다:
  ```js
  // 이미 통과하는 검사는 신호가 없다. step 5에서 경량 인라인 분기가 사라진 것만 본다.
  assert.doesNotMatch(body, /`scale`이 `light`면[\s\S]{0,200}인라인 read-only/);
  ```
- [ ] `test/skill-bouncer-execute.test.js:141-146`의 `matches.length` 기대값을 **2에서 1로** 고친다. step 3의 경량 분기 한 곳만 남기 때문이다 — 이 항목을 빠뜨리면 `npm test`가 빨개진다
- [ ] `test/lightweight-cycle.test.js`의 `bouncer-execute inlines on scale light and keeps host fallback wording`을 같은 방향으로 고친다. 폴백 분리 assert(59–64)는 그대로 둔다
- [ ] `test/lightweight-cycle.test.js:13-28`의 governance 문구 assert 세 개가 여전히 통과하는지 확인한다
- [ ] `node --test test/skill-bouncer-execute.test.js test/lightweight-cycle.test.js`로 **실패**와 그 사유를 확인한다
- [ ] `skills/bouncer-execute/SKILL.md` step 5에서 경량 분기 문장을 제거하고 named 네 단계를 단일 경로로 되돌린다
- [ ] `rules/governance.md` 규칙 4에서 인라인 대상을 implementer로 한정하고, 주행 예외 문장이 리뷰에 대해 중복되지 않게 정리한다
- [ ] `rules/governance.md`의 `Limit of inline review` 문단을 구현 인라인의 한계로 다시 쓴다
- [ ] `node --test test/skill-bouncer-execute.test.js test/lightweight-cycle.test.js` 통과 확인
- [ ] `npm test` 통과 확인
