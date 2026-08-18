---
type: bouncer.tasks
title: plan 문서 계층 머메이드 작성 규칙을 추가함
description: Tasks for 001
resource: .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-18T17:00:46.075+09:00'
bouncer:
  id: TASKS-001
  epic_id: '041'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 흐름 변경 에픽에서 사람과 에이전트가 같은 차트를 계층 줌으로 읽게 함
    - 작성 규칙과 리뷰 판정만 고치고 게이트·생성기는 두지 않음
  affected_paths:
    - skills/spec-authoring/SKILL.md
    - skills/spec-authoring/references/epic.md
    - skills/spec-authoring/references/blueprint.md
    - skills/spec-authoring/references/tasks.md
    - skills/context-review/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - agents/bouncer-context-reviewer.md
    - test/skill-spec-authoring.test.js
    - test/skill-context-review.test.js
    - test/skill-bouncer-plan.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-18T17:02:00.000+09:00'
    suggested_paths:
      - test
      - skills/spec-authoring
      - skills/context-review
      - skills/bouncer-plan
      - agents
    basis:
      - graph: source
        status: reused
        query: spec-authoring mermaid zoom context-review bouncer-plan SKILL.md references epic blueprint tasks
        result: 82 hits, mostly test/session-graph·skill-bouncer-surface·master-rules. config.source_dirs excludes skills/ so those paths were seeded by hand.
      - graph: context
        status: updated
        query: spec-authoring mermaid zoom context-review bouncer-plan SKILL.md references epic blueprint tasks
        result: 10 hits, 041 epic index plus unrelated explain.md neighbors. No skill markdown in context graph.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
흐름이 에픽 본문일 때 plan 에이전트가 머메이드를 에픽·블루프린트·태스크에 다른 배율로 쓰게 한다. 차트 원본은 그 문서 본문이다. 이 작업 자체는 작성 규칙이라 041 문서에 차트를 두지 않는다. 검증 명령은 `npm test`.

## Interface
- 제공: spec-authoring이 줌 규칙과 세 배율 예시 차트를 적는다. references의 timeout 예시는 설정 키라 차트를 생략하고 그 이유를 한 줄로 적는다. context-review 교차 문서 판정이 차트 줌 모순을 짚는다. 차트 부재는 발견이 아니다. bouncer-plan Author 단계가 spec-authoring 줌을 한 줄로 위임한다. 계약 테스트가 위 문구를 단언한다.
- 거부: 머메이드 생성 CLI. Distill·verification.md·review.md에 차트. 게이트가 차트 유무로 실패. `CLAUDE.md` 하드룰. 모든 에픽에 차트 강제. `classDef`·색·긴 노드 id.

## Touch
- Modify `skills/spec-authoring/SKILL.md` — How to author에 문서 종류별 줌과 예시 차트, 금지 위치
- Modify `skills/spec-authoring/references/epic.md` — 이 예시는 흐름 변경이 아니라 차트를 생략한다는 한 줄
- Modify `skills/spec-authoring/references/blueprint.md` — 같은 생략 한 줄
- Modify `skills/spec-authoring/references/tasks.md` — 같은 생략 한 줄
- Modify `skills/context-review/SKILL.md` — Cross-document에 줌 모순 판정(차트 부재는 실패 아님)
- Modify `skills/bouncer-plan/SKILL.md` — Author 단계에서 spec-authoring 줌 위임 한 줄
- Modify `agents/bouncer-context-reviewer.md` — Cross-document 루브릭에 차트 줌
- Modify `test/skill-spec-authoring.test.js` — 줌 규칙·예시 차트·금지 위치 단언
- Modify `test/skill-context-review.test.js` — 차트 모순 판정과 부재 비실패 단언
- Modify `test/skill-bouncer-plan.test.js` — Author가 머메이드 줌을 spec-authoring에 위임한다는 단언

## Do not touch
- `CLAUDE.md` — 하드룰에 차트 강제를 넣지 않는다
- `AGENTS.md` — 마스터 룰 재작성 아님
- `scripts/` — 파서·게이트·생성기 없음
- `.bouncer/Distill.md` — Distill에 차트 승격 없음
- `skills/spec-authoring/references/review.md` — 리뷰 문서에 차트 없음
- `docs/` — 사람용 아키텍처 개요는 이번 계약이 아님

## Constraints
- context-review 네 판정 범위 이름은 유지한다. 머메이드는 Cross-document의 세부다. 다섯 번째 범위를 만들지 않는다.
- 기존 게이트 번호와 G18 계약은 그대로다.
- 예시 차트는 노드를 짧게, 한국어 라벨, 스타일 없음.
- 상위 차트에 없는 박스를 하위 예시에 새로 만들지 않는다.

## Checklist
- [ ] `test/skill-spec-authoring.test.js`에 실패 단언을 넣는다.
  ```js
  assert.match(md, /mermaid/i);
  assert.match(md, /줌|zoom/i);
  assert.doesNotMatch(md, /classDef/);
  assert.match(md, /Distill|verification|review/);
  ```
- [ ] `test/skill-context-review.test.js`에 실패 단언을 넣는다.
  ```js
  assert.match(md, /mermaid/i);
  assert.match(md, /부재|없|optional|not a fail/i);
  ```
- [ ] `test/skill-bouncer-plan.test.js`에 실패 단언을 넣는다.
  ```js
  assert.match(body, /mermaid|줌/);
  assert.match(body, /spec-authoring/);
  ```
- [ ] `node --test test/skill-spec-authoring.test.js test/skill-context-review.test.js test/skill-bouncer-plan.test.js`로 실패를 확인한다.
- [ ] spec-authoring How to author·references 한 줄·context-review Cross-document·bouncer-plan Author 한 줄·context-reviewer 루브릭을 맞춘다.
- [ ] `npm test`가 통과한다.
