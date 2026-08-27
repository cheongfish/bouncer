---
type: bouncer.tasks
title: finalize 조건부 절차 reference 분리
description: finalize의 Distill·explain·PR·정리 상세를 조건부 reference로 옮기고 finalize 게이트와 remainder commit 계약은 본문에 유지한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:53:09.173+09:00'
bouncer:
  id: TASKS-001
  epic_id: '054'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - finalize가 실행 경로와 무관한 상세 절차를 항상 읽는 비용을 줄임
    - 게이트와 remainder commit 계약은 진입 스킬 본문에 유지함
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-finalize/references/distill-promotion.md
    - skills/bouncer-finalize/references/explain-quiz.md
    - skills/bouncer-finalize/references/draft-pr.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
    - test/helpers/read-skill.js
    - test/skill-bouncer-finalize.test.js
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T12:17:06.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
      - test/helpers
      - .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body
      - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: bouncer finalize conditional reference Distill promotion explain quiz draft PR cleanup handoff gate remainder test
        result: 80개 node; 상위 경로 scripts/src/lib·test·test/helpers
      - graph: context
        status: updated
        query: bouncer finalize conditional reference Distill promotion explain quiz draft PR cleanup handoff gate remainder test
        result: 12개 node; finalize evidence·promotion PR explain·현재 BP task 경로
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer-finalize`의 Distill 승격, explain·quiz, draft PR, worktree 정리·다음 blueprint 인계 상세를 실행 조건이 붙은 reference로 분리한다. `validate --gate finalize`, remainder dry-run·`--yes`, commit scope와 검증 실패 처리 절차는 `SKILL.md` 본문에 남아야 한다.

## Interface
- 제공: `skills/bouncer-finalize/SKILL.md`의 각 단계가 필요한 시점에만 `references/distill-promotion.md`, `references/explain-quiz.md`, `references/draft-pr.md`, `references/cleanup-handoff.md`를 읽도록 라우팅한다. 각 reference 첫 문단은 같은 로딩 조건을 한 문장으로 선언한다.
- 거부: finalize gate, remainder commit, staged scope, `reason: 'verify'` 처리, remainder ACQ를 reference로 이동하거나 reference 전체를 preflight에서 무조건 읽게 하지 않는다.

## Touch
- Modify `skills/bouncer-finalize/SKILL.md` — 번호 절차와 게이트 핵심 절차를 유지하고 조건부 단계의 reference 라우팅을 남긴다.
- Create `skills/bouncer-finalize/references/distill-promotion.md` — full JSON audit, shard split, 승격 제안·동의 상세를 담는다.
- Create `skills/bouncer-finalize/references/explain-quiz.md` — explain scaffold·quiz·published 처리 상세를 담는다.
- Create `skills/bouncer-finalize/references/draft-pr.md` — remote·`gh` 조건, PR ACQ와 초안 작성 상세를 담는다.
- Create `skills/bouncer-finalize/references/cleanup-handoff.md` — 선택된 worktree 정리와 다음 blueprint 인계 상세를 담는다.
- Modify `test/helpers/read-skill.js` — 기존 skill reader에 `references/*.md`를 정렬해 합치는 workflow bundle reader를 추가한다.
- Modify `test/skill-bouncer-finalize.test.js` — 본문 라우팅·게이트 잔존과 reference별 계약을 각각 단언한다.
- Modify `test/master-rules.test.js` — 워크플로 본문과 references를 합친 계약 읽기 helper를 도입해 Distill 계약 위치 이동을 추적한다.

## Do not touch
- `scripts/` — finalize CLI, 게이트와 산출물 형상은 바꾸지 않는다.
- `skills/spec-authoring/SKILL.md` — Distill promotion 정본 계약은 이번 이동 대상이 아니다.
- `skills/explain-diff/SKILL.md` — explain·quiz 역할 계약은 그대로 둔다.
- `CLAUDE.md` — hard rule과 workflow 순서는 축약하지 않는다.

## Constraints
- `rules/skill-shape.md`의 번호 절차와 마지막 `## ACQ (AskUserQuestion) gates` 순서를 유지한다.
- reference는 supporting material이며 출력 template로 취급하지 않는다.
- 이동 전후의 ACQ 개수·선택지·단계 순서·중단 조건을 바꾸지 않는다.
- 본문에서 reference를 읽는 조건과 reference 첫 문단의 조건이 문구상 동일해야 한다.
- 최소화 근거: 서로 다른 네 로딩 조건은 네 reference로 유지하고, 테스트의 bundle 탐색은 기존 `test/helpers/read-skill.js`를 확장해 한 번만 구현한다.

## Checklist
- [ ] 계약 테스트를 먼저 바꿔 `SKILL.md`가 네 reference를 조건부로 가리키고, 상세 계약은 해당 reference에서만 통과하도록 단언한다. finalize gate·remainder 핵심 절차는 계속 `SKILL.md`만 읽어 단언한다.
- [ ] `node --test test/skill-bouncer-finalize.test.js test/master-rules.test.js`로 새 reference가 없거나 상세가 본문에 남은 상태에서 실패를 확인한다.
- [ ] 네 조건부 블록을 대응 reference로 옮기고 `SKILL.md`에는 단계 조건·입출력·중단 조건·게이트 핵심 절차를 남긴다.
- [ ] 이동한 문단의 고유 문구가 `SKILL.md`와 reference에 중복되지 않는지 검색한다. 단, 단계 라우팅과 게이트 핵심 절차의 필수 용어는 중복 판정에서 제외한다.
- [ ] `npm run ci`가 통과한다.
