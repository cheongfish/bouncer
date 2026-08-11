---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T15:28:18.891+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '026'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 09e0422d1f991d482fe3ac803e3f7a5bd681ef49
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '4/4'
      disposition: 퀴즈 4문항 전부 정답. 다이제스트 스캔·맵 드롭·Distill watch·빈 트리 스킵을 확인함.
      recorded_at: '2026-08-11T15:32:26+09:00'
---
# Explain

## Background

context 그래프는 `.bouncer/context` 전체를 스캔했다. 실측 2989노드 중 tasks/verification/review가 약 63%라 의사결정 신호가 묻혔다. `context_dirs`는 디렉터리 단위라 섹션을 자를 수 없다.

이번 작업은 화이트리스트 헤딩만 뽑아 `graphify-out/context-src/`에 파생 트리를 만들고, graphify는 그 트리를 스캔한다. 빌드 직후 `map.json`으로 `source_file`을 원본 경로로 되돌린다. 재빌드 결과 노드는 134개, `graphify-out/` 접두 누수는 0이다.

## Intuition

인덱싱 전에 문서를 잘라 두고, 그래프에 찍힌 주소만 원본으로 되감는다.

## Code

- `scripts/src/lib/context-digest.ts` — `digestRulesFor` / `extractSections` / `buildContextDigest`. 산출물은 `graphify-out/context-src/`와 `map.json`.
- `scripts/src/lib/session-graph.ts`
  - `resolveGraphScopes`의 context에 `scanDirs`·`watchFiles` 추가
  - `defaultExecGraphify`가 context 빌드 전에 다이제스트를 만들고 `normalizeGraphPaths(..., { map })`로 되돌림
  - freshness는 `dirs`+`watchFiles`(원본)만 본다. 파생 트리는 freshness 입력에 넣지 않는다
- 테스트: `test/context-digest.test.js`, `test/session-graph.test.js`
- CJS emit: `scripts/lib/context-digest.js`, `scripts/lib/session-graph.js` (`npm run build`)

## Quiz

1. context scope가 graphify에 넘기는 스캔 대상은?
   - A) `.bouncer/context` (설정된 `context_dirs`)
   - B) `graphify-out/context-src` (`scanDirs`)
   - C) `.bouncer/Distill.md`만

2. `normalizeGraphPaths`에 `opts.map`이 있을 때, 매핑에 없는 `source_file` 노드는?
   - A) `${dir}/${파생이름}`으로 접두만 붙인다
   - B) 파생 이름을 그대로 둔다
   - C) 드롭하고, 그 id를 가리키는 link·hyperedge도 제거한다

3. Distill만 고쳤을 때 context 그래프가 stale로 남는 것을 막는 장치는?
   - A) `watchFiles`에 `.bouncer/Distill.md`를 넣고 freshness mtime에 포함
   - B) Distill을 `context_dirs`에 추가
   - C) 파생 트리 mtime을 freshness 입력에 포함

4. `buildContextDigest`가 `count === 0`이면?
   - A) 빈 `graph.json`으로 context 그래프를 덮어쓴다
   - B) graphify를 호출하지 않고 그 scope를 건너뛴다
   - C) 이전 `map.json`만 지우고 graphify는 돌린다

## 이해 상태

- task `001` · quiz `4/4`
- 정답: 1B, 2C, 3A, 4B
- 응답: 1B, 2C, 3A, 4B — 전부 맞음
- disposition: 퀴즈 4문항 전부 정답. 다이제스트 스캔·맵 드롭·Distill watch·빈 트리 스킵을 확인함.
