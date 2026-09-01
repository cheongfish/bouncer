---
type: bouncer.epic
title: 컨텍스트 다이제스트 검색 인덱스
description: Generate derived search anchors, Touch path headings, and minimal fallback digests in context-digest so every context document reaches the graph with a searchable ASCII label.
resource: .bouncer/context/epics/063-context-digest-search-index/index.md
tags:
  - bouncer
  - epic
  - context-digest
  - search-anchor
  - graph-suggest
timestamp: '2026-08-31T17:00:02.716+09:00'
bouncer:
  id: '063'
  epic_id: '063'
  status: approved
  supersedes: []
---
# 063 context-digest-search-index

## Intent
- 문제: `context-digest`가 화이트리스트 절만 남기고 frontmatter·경로·`## Touch`를 전부 버려서, context 그래프에 남는 헤딩 라벨이 9종뿐이다. epic 4건·BP 2건·master Distill은 살릴 절이 하나도 없어 파생 문서 자체가 만들어지지 않고, shard는 `Invariants`·`Gotchas`가 통째로 드롭된다.
- 목표: epic 062가 고정한 앵커 문법을 `context-digest`가 실제로 생성하게 만들어, 계층 앵커 한 토큰으로 epic·BP·task가 함께 hit되고 `## Touch` 경로가 source 그래프로 이어지며 어떤 대상 문서도 조용히 사라지지 않게 한다.

## Success criteria
1. `buildContextDigest`가 epic·blueprint·task 파생 문서 머리에 `## epic-<ddd>` / `## bp-<ddd>-<ddd>` / `## task-<ddd>-<ddd>-<ddd>` 앵커를 문서 경로에서 파생해 찍고, 자식 문서가 부모 앵커를 함께 담는다.
2. `tasks.md`의 `## Touch`에서 토크나이저 문자 집합을 만족하는 각 백틱 경로가 파생 문서에서 헤딩 한 줄(`## scripts/src/lib/context-digest.ts`)이 되고, 동사·설명이 섞인 줄에서 경로만 뽑힌다.
3. 화이트리스트 절이 하나도 없거나 본문이 빈 대상 문서도 앵커·경로만 담은 최소 파생 문서를 얻는다. 현재 누락 중인 epic 4건(`001`·`002`·`003`·`005`), BP 2건(`001-cli-usability/001-cli-help`, `002-commit-artifacts/001-evidence-and-message`), master `.bouncer/Distill.md`가 모두 `map.json`에 등장한다.
4. Distill shard 파생 문서가 `## Invariants`·`## Gotchas`·`## Decisions` 셋을 모두 담고, master `.bouncer/Distill.md`는 shard 목록·freshness 정본 역할만 유지한다.
5. frontmatter `tags` 중 구조 태그를 뺀 영어 ASCII 단일 토큰만 검색 라벨 헤딩으로 승격되고, `rules/okf.md`와 `references/spec-authoring/index.md`가 tags를 도메인 검색 어휘로 진술한다.
6. `npm test`가 통과하고, 실제 저장소에서 다이제스트를 재빌드했을 때 `digestRulesFor`가 `null`이 아닌 모든 문서가 `map.json`에 등장한다. 빠진 항목이 있다면 그것은 화이트리스트 절도 앵커도 없는 문서로만 설명되며, 그 차집합을 명령 출력으로 남긴다.

## Out of scope
- `tokenize()` 확장이나 한국어 질의 지원 — 확정 방침은 토크나이저를 건드리지 않는 것이다.
- 기존 컨텍스트 문서 435개의 frontmatter 한국어 값 일괄 정리와 epic 압축 — Wave 4가 맡는다.
- `graphify.test_dirs` 분리, 루트 `graphify-out/graph.json` 참조 제거, 스코프 소비자 수렴 — Wave 3이 맡는다.
- cross-file 엣지 주입, 구조 순회, `path A B`, community 재계산 — 보류 lane이다.
- `graph-search.ts`의 매칭·점수 규칙 변경. 이 에픽은 검색 대상 라벨을 만드는 생산자 쪽만 바꾼다.
- `title`·`description`의 헤딩 승격. 라벨 비교가 완전 일치라 문장형 값은 자연어 질의로 도달할 수 없으므로 노드만 늘린다.
- tags 규칙을 S 코드나 게이트로 강제하는 것. 작성 지침으로 둔다.
- 사람이 쓰는 컨텍스트 문서 본문에 앵커를 수기로 적게 하는 authoring 의무 추가.

## Blueprints
* [파생 앵커와 다이제스트 커버리지](blueprints/001-derived-anchors-and-coverage/index.md) - context-digest에 계층 앵커·Touch 경로 헤딩·최소 파생 fallback·shard 3종 색인을 넣어 검색 라벨 생산을 완결한다
