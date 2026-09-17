---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/017-mermaid-authoring-convention/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-18T17:53:10.141+09:00'
bouncer:
  id: EXPLAIN-017
  epic_id: '018'
  blueprint_id: '017'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5bbce0163d408bff4d275e2b047735fd9d22ce50
      diff_sha: 5d9801b13736dc6b3263204fd851aa758f82d20ed4ce5ee844b5a0e3d1e60810
      quiz_score: 2/2
      disposition: 두 계층 줌 계약과 Cross-document 판정 범위를 이해함.
      recorded_at: '2026-08-18T17:54:45+09:00'
---
# Explain

## Background
흐름을 바꾸는 계획 문서에서 머메이드 차트의 위치와 상세도가 정해져 있지 않아,
에픽·블루프린트·태스크가 같은 흐름을 서로 다른 수준으로 설명하지 못했다.
spec-authoring에 계층 줌 규칙과 예시를 넣고, context-review가 상하위 차트의
모순만 찾도록 계약을 고정했다. 차트 자체의 부재는 실패가 아니다.

## Intuition
에픽은 지도, 블루프린트는 구간 안내, 태스크는 그 구간의 갈림길이다.

## Code
`skills/spec-authoring/SKILL.md`가 세 계층의 줌과 차트 금지 위치를 정의한다.
`references/epic.md`, `references/blueprint.md`, `references/tasks.md`는
설정 키 예시에서 차트를 생략하는 이유를 남긴다. `skills/context-review/SKILL.md`와
`agents/bouncer-context-reviewer.md`는 Cross-document 안에서 줌 모순을 판정한다.
`skills/bouncer-plan/SKILL.md`는 Author 단계에서 이 규칙을 spec-authoring에
위임한다. 세 계약 테스트는 규칙, 부재 비실패, 위임 문구를 고정한다.

## Quiz
1. 하위 Tasks 차트가 상위 Blueprint 차트와 맺어야 하는 관계는?
   - A) 구현 설명을 위해 새 노드를 자유롭게 추가한다.
   - B) 상위 차트에 있는 흐름을 더 좁은 범위로 보여 준다.
   - C) 노드 수를 항상 두 개로 제한한다.

2. context-review가 머메이드 차트에 대해 발견으로 기록해야 하는 경우는?
   - A) 흐름 변경이 아닌 문서에 차트가 없다.
   - B) 차트에 색이나 `classDef`가 없다.
   - C) 상하위 문서의 차트 줌이 서로 모순된다.

## 이해 상태
정답은 1-B, 2-C이며 응답도 1-B, 2-C였다. 두 문항 모두 맞춰 2/2로 기록한다.

## Tasks

### Task 001

#### Goal & intent

흐름이 에픽 본문일 때 plan 에이전트가 머메이드를 에픽·블루프린트·태스크에 다른 배율로 쓰게 한다. 차트 원본은 그 문서 본문이다. 이 작업 자체는 작성 규칙이라 041 문서에 차트를 두지 않는다. 검증 명령은 `npm test`.

#### Interface

- 제공: spec-authoring이 줌 규칙과 세 배율 예시 차트를 적는다. references의 timeout 예시는 설정 키라 차트를 생략하고 그 이유를 한 줄로 적는다. context-review 교차 문서 판정이 차트 줌 모순을 짚는다. 차트 부재는 발견이 아니다. bouncer-plan Author 단계가 spec-authoring 줌을 한 줄로 위임한다. 계약 테스트가 위 문구를 단언한다.
- 거부: 머메이드 생성 CLI. Distill·verification.md·review.md에 차트. 게이트가 차트 유무로 실패. `CLAUDE.md` 하드룰. 모든 에픽에 차트 강제. `classDef`·색·긴 노드 id.

#### Touch

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

#### Constraints

- context-review 네 판정 범위 이름은 유지한다. 머메이드는 Cross-document의 세부다. 다섯 번째 범위를 만들지 않는다.
- 기존 게이트 번호와 G18 계약은 그대로다.
- 예시 차트는 노드를 짧게, 한국어 라벨, 스타일 없음.
- 상위 차트에 없는 박스를 하위 예시에 새로 만들지 않는다.
