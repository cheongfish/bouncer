---
type: bouncer.epic
title: context 그래프 섹션 다이제스트
description: context 그래프를 의사결정 섹션만 담은 파생 트리에서 빌드한다
resource: .bouncer/context/epics/026-context-graph-slim/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-11T14:56:45.069+09:00'
bouncer:
  id: '026'
  epic_id: '026'
  status: approved
---
# 026 context-graph-slim

## Intent
- 문제: context 그래프가 `.bouncer/context` 전체를 통째로 인덱싱한다. 실측하면 노드 2989개 중 `tasks.md` 1065 / `verification.md` 453 / `review.md` 372, 즉 63%가 체크리스트·증적 같은 기계 생성물이고 실제 의사결정이 담긴 `explain.md`는 189개뿐이다.
- 목표: 의사결정 섹션만 뽑은 파생 트리를 만들어 그것을 graphify에 넣는다. 쿼리 결과는 여전히 원본 저장소 경로를 가리킨다.

## Success criteria
1. context 그래프 빌드가 `graphify-out/context-src/`의 파생 트리를 스캔한다. 화이트리스트는 BP `explain.md`의 `## Background` / `## Intuition` / `## Code`, epic `index.md`의 `## Success criteria`, `.bouncer/Distill.md`의 `## Decisions` 세 종류다.
2. `graphify-out/context/graph.json`의 모든 `source_file`이 저장소-상대 원본 경로다. 파생 이름이나 `graphify-out/` 하위 경로를 가진 노드는 하나도 남지 않는다.
3. 매핑에 없는 노드는 파생 경로로 흘려보내지 않고 드롭한다. 드롭된 노드를 참조하는 link·hyperedge도 함께 사라진다.
4. `graphify-runner`가 롤업 전에 `graphify-out/` 하위 히트를 걸러내므로, 매핑이 깨져도 파생 경로가 `suggested_paths`에 실리지 않는다.
5. context 그래프 freshness가 `context_dirs`와 `.bouncer/Distill.md`의 mtime으로 판정된다. 파생 트리 자신의 mtime은 판정에 들어가지 않는다.
6. `npm test`가 통과하고, 이 저장소에서 실제로 재빌드한 context 그래프의 노드 수 감소율과 대표 쿼리 히트 유지 여부가 BP `explain.md`에 숫자로 남는다.

## Out of scope
- source 그래프의 입력과 빌드 경로
- `context_dirs` 설정 스키마 변경, 사용자별 화이트리스트 설정
- graphify CLI 자체의 필터 옵션에 의존하는 방식
- `graphify query` 호출 방식과 `suggested_paths` 롤업 규칙 (방어 필터 한 줄 제외)

## Blueprints
* [001 context-section-digest](blueprints/001-context-section-digest/index.md) - context 문서에서 화이트리스트 섹션만 뽑는 파생 트리를 신설하고 `scripts/src/lib/session-graph.ts` context scope의 스캔 대상과 경로 정규화를 그 트리 기준으로 바꾼다
