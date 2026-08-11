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
    - task: '002'
      range_from: 09e0422d1f991d482fe3ac803e3f7a5bd681ef49
      range_to: 3a1bdb748a68d870412453e71390dfacb7b90301
      diff_sha: b3735152361f53846e78cb8ec73121d49f705ae0b99bc18910dda0633c0024f8
      quiz_score: '2/2'
      disposition: 퀴즈 2문항 전부 정답. scanDirs 다이제스트 스캔과 맵 미스 드롭을 확인함.
      recorded_at: '2026-08-11T15:42:50+09:00'
---
# Explain

## Background

context 그래프는 `.bouncer/context` 전체를 스캔했다. 실측 2989노드 중 tasks/verification/review가 약 63%라 의사결정 신호가 묻혔다. `context_dirs`는 디렉터리 단위라 섹션을 자를 수 없다.

화이트리스트 헤딩만 뽑아 `graphify-out/context-src/`에 파생 트리를 만들고, graphify는 그 트리를 스캔한다. 빌드 직후 `map.json`으로 `source_file`을 원본 경로로 되돌린다. 재빌드 결과 노드는 134개, `graphify-out/` 접두 누수는 0이다.

매핑이 새거나 파생 트리를 직접 쿼리하면 `graphify-out/` 경로가 히트에 남을 수 있다. `graphify-runner`는 롤업 전에 그 히트를 버리고, 스킬이 파생 이름을 번역하지 않는다. `configuration.md`의 `context_dirs` 행과 `ARCHITECTURE.md` §D-1에 파생 트리·화이트리스트·freshness 입력을 적어 두었다.

## Intuition

인덱싱 전에 문서를 잘라 두고, 그래프에 찍힌 주소만 원본으로 되감는다. 되감기에서 샌 `graphify-out/` 경로는 계획 문서의 `suggested_paths`에 올리지 않는다.

## Code

- `scripts/src/lib/context-digest.ts` — `digestRulesFor` / `extractSections` / `buildContextDigest`. 산출물은 `graphify-out/context-src/`와 `map.json`.
- `scripts/src/lib/session-graph.ts`
  - `resolveGraphScopes`의 context에 `scanDirs`·`watchFiles` 추가
  - `defaultExecGraphify`가 context 빌드 전에 다이제스트를 만들고 `normalizeGraphPaths(..., { map })`로 되돌림
  - freshness는 `dirs`+`watchFiles`(원본)만 본다. 파생 트리는 freshness 입력에 넣지 않는다
- `skills/graphify-runner/SKILL.md` 4단계 — 롤업 전 `graphify-out/` 히트 제외, 파생 이름 번역 금지(`map.json` 미독)
- `docs/configuration.md` `context_dirs` 행, `docs/ARCHITECTURE.md` §D-1
- 테스트: `test/context-digest.test.js`, `test/session-graph.test.js`, `test/skill-graphify-runner.test.js`
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

## 이해 상태

- task `001` · quiz `4/4`
- 정답: 1B, 2C, 3A, 4B
- 응답: 1B, 2C, 3A, 4B — 전부 맞음
- disposition: 퀴즈 4문항 전부 정답. 다이제스트 스캔·맵 드롭·Distill watch·빈 트리 스킵을 확인함.

- task `002` · quiz `2/2`
- 정답: 1B, 2C
- 응답: 1B, 2C — 전부 맞음
- disposition: 퀴즈 2문항 전부 정답. scanDirs 다이제스트 스캔과 맵 미스 드롭을 확인함.
