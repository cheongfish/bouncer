---
type: bouncer.epic
title: plan 문서 계층 머메이드
description: plan 작성 규칙이 머메이드를 에픽·블루프린트·태스크의 줌 수준에 맞춰 작성하게 한다
resource: .bouncer/context/epics/041-plan-mermaid-zoom/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-18T17:00:46.020+09:00'
bouncer:
  id: '041'
  epic_id: '041'
  status: approved
---
# 041 plan-mermaid-zoom

## Intent
- 문제: 비즈니스 흐름이 바뀌는 에픽인데, 에픽·블루프린트·태스크가 같은 흐름을 다른 배율로 그리지 않아 사람과 에이전트가 계층을 맞추기 어렵다.
- 목표: plan 작성 규칙이 머메이드를 에픽(전체 흐름) → 블루프린트(이번 PR 구간) → 태스크(구현 분기) 줌으로 쓰게 하고, 차트 원본은 그 문서 본문에 둔다.

## Success criteria
1. `skills/spec-authoring/SKILL.md`가 에픽·블루프린트·태스크 줌과 “상위 노드만 하위가 확대한다”를 적는다.
2. `skills/spec-authoring/references/{epic,blueprint,tasks}.md`가 흐름 변경이 아닌 예시에서 차트를 생략한 이유를 한 줄로 밝히고, SKILL 본문에 세 줌 예시 차트가 있다.
3. `skills/context-review/SKILL.md`가 차트가 있을 때 부모·자식 줌 모순을 교차 문서 판정에 넣고, 차트 부재는 실패로 치지 않는다.
4. `npm test`가 통과한다.

## Out of scope
- 머메이드 생성 CLI·라이브러리·`scripts/` 파서
- Distill에 차트 승격
- G1–G18에 차트 필수 검사
- 모든 에픽에 차트 강제
- `CLAUDE.md` 하드룰 추가

## Blueprints
* [머메이드 작성 규칙](blueprints/001-mermaid-authoring-convention/index.md) - spec-authoring·context-review·plan 스킬과 계약 테스트에 계층 줌을 넣는다
