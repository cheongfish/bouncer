---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/007-derived-anchors-and-coverage/explain.md
tags:
  - bouncer
  - explain
  - context-digest
  - graph-suggest
timestamp: '2026-09-01T15:34:26.849+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: d50b06a99aeb00e1f1027c3107753fda5abe2157
      diff_sha: 1458eee2351139bd866287d7fdbea585229e43076cf7910c28eb861ec9b651f1
      quiz_score: '4/4'
      disposition: 'emit·Touch·tags·Distill 규칙 네 축을 모두 맞춤. Distill graph shard 문구 갱신은 후속.'
      recorded_at: '2026-09-01T15:35:54+09:00'
---
# Explain

## Background
`buildContextDigest`는 화이트리스트 절 본문이 비면 파생 파일을 만들지 않았다. epic·blueprint 인덱스처럼 살릴 절이 없는 문서는 그래프에서 통째로 빠졌고, 경로·`## Touch`·`tags`에 이미 있는 ASCII 검색 값도 버렸다. 이 PR은 파생 본문 앞에 계층 앵커·Touch 경로·도메인 태그 헤딩을 넣고, Distill master는 `## Shards`·shard는 Invariants/Gotchas/Decisions를 색인하도록 `digestRulesFor`를 맞춘다. 작성 규칙은 `rules/okf.md`와 `references/spec-authoring/index.md`에 tags가 검색 어휘임을 적는다.

## Intuition
문서가 이미 들고 있는 경로 id·Touch 경로·태그를 헤딩으로 올려, 질의 토큰이 context 라벨과 source_file에 동시에 걸리게 한다.

## Code
- `scripts/src/lib/context-digest.ts` — `anchorsFor`, `touchPathHeadings`, `tagLabels`, 헤딩 조립(앵커 → Touch → 태그 → 절), emit 조건, Distill 규칙
- `scripts/lib/context-digest.js` — 동일 CJS emit
- `test/context-digest.test.js` — 세 함수·파생 본문·Distill 픽스처
- `test/session-graph.test.js` — empty digest 스킵 픽스처를 Distill(앵커 없음)으로 조정
- `rules/okf.md`, `references/spec-authoring/index.md`, `test/skill-spec-authoring.test.js` — tags 검색 어휘 계약
- Distill 후속: `.bouncer/distill/graph.md`의 "whitelist headings only"는 이 PR 이후 사실과 어긋남 — 승격 시 갱신 대상

## Quiz
1. 파생 파일이 만들어지는 최소 조건은?
   - A) 화이트리스트 절 본문이 비어 있지 않을 때만
   - B) 계층 앵커가 있거나 절 본문이 있을 때
   - C) frontmatter `tags`가 2개 이상일 때만

2. `touchPathHeadings`가 경로를 승격하는 대상은?
   - A) epic·blueprint·task 문서의 모든 백틱 경로
   - B) `## Do not touch`에 적힌 경로만
   - C) `tasks.md`의 `## Touch` 절 백틱 경로만 (토큰 문자 집합 통과분)

3. `tagLabels`가 승격에서 빼는 구조 태그는?
   - A) `bouncer`와 문서 `type: bouncer.<kind>`에서 역산한 kind 태그
   - B) 고정 목록 `epic`·`blueprint`·`tasks`·`explain`·`verification`·`review`
   - C) `description`과 `title`의 모든 토큰

4. master Distill과 shard의 `digestRulesFor` 반환은?
   - A) master `['## Shards']`, shard `['## Invariants','## Gotchas','## Decisions']`
   - B) 둘 다 `['## Decisions']`
   - C) master `['## Decisions']`, shard `['## Shards']`

## 이해 상태
- 정답: 1B, 2C, 3A, 4A
- 응답: 1B, 2C, 3A, 4A
- 채점: 4/4 전부 정답
- disposition: emit·Touch·tags·Distill 규칙 네 축을 모두 맞춤. Distill graph shard 문구 갱신은 후속.
- quiz_score: 4/4 · range develop..d50b06a · diff_sha 1458eee2…
