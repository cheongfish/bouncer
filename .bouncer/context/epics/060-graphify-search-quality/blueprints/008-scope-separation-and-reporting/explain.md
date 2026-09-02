---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/008-scope-separation-and-reporting/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-01T20:57:56.117+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: dc00cab76facd50805dd9cc228025ad5236c7d79
      diff_sha: c4db3096d15fc701f45be350984ad082f4780d9cd6e2a4b8e5430edbdecffb7f
      quiz_score: '4/4'
      disposition: 네 문항 모두 정답. 세 스코프 보고·빈 배열·missing 제외·config cutover를 구분함.
      recorded_at: '2026-09-01T20:59:16+09:00'
---
# Explain

## Background
세 스코프를 만드는 코드는 이미 있었다. 그런데 이 저장소 config가 `test`를 `source_dirs`에 넣어 test 그래프가 안 생겼고, `test_dirs`가 없으면 `planSessionGraph`가 test 항목 자체를 빼서 runner가 basis 상태를 지어내야 했다. 삭제된 루트 `graphify-out/graph.json`을 픽스처가 아직 가리키고 있었다. 이 PR은 보고 계약을 세 항목으로 고정하고, config를 `graphify.test_dirs`로 옮기며, 죽은 경로 참조를 지운다.

## Intuition
빌드할 수 없어도 보고 칸은 남긴다. `skip-unconfigured`는 "없다"가 아니라 "설정이 없어서 안 만든다"를 graphs[]에 적는 자리표시다.

## Code
- `scripts/src/lib/graph-scope.ts` — `resolveGraphScopes`가 `testDirs` null이어도 test 스코프를 반환하고 `unconfiguredReason`을 싣는다.
- `scripts/src/lib/session-graph.ts` — `planOneGraph`/`planSessionGraph`가 `skip-unconfigured`를 만들고, missing·경고·`skip-no-dirs` 요약에서 그 항목을 뺀다.
- `.bouncer/config.json` — `source_dirs: ["scripts","hooks"]`, `graphify.test_dirs: ["test"]`.
- `references/graphify-runner/index.md` — outcome→status에 `skip-unconfigured` → `skip-disabled`.
- `test/finalize.test.js` · `validate-gates.test.js` · `commit-guard.test.js` — 픽스처를 `graphify-out/source/graph.json`으로 교체.
- `docs/configuration.md` · `docs/install.md` — 빌드 수와 보고 수 구분, sync 산출물에 test 포함.

## Quiz
1. `graphify.test_dirs`가 config에 없을 때 `planSessionGraph`의 `graphs[]`는?
   - A) source·context 두 항목만
   - B) source·test·context 세 항목이고 test는 `skip-unconfigured`
   - C) `graphs: []` (NO_GRAPH_WORK와 동일)

2. `test_dirs: []`(키는 있고 값은 빈 배열)일 때 test 항목의 action은?
   - A) `skip-no-dirs`
   - B) `skip-unconfigured`
   - C) `skip-fresh`

3. `skip-unconfigured` test 항목이 SessionStart `missing` 경고에 들어가는가?
   - A) 들어간다 — graph.json이 없으면 항상 missing
   - B) `skips`에만 들어가고 graphs에는 없다
   - C) 들어가지 않는다 — 빌드 시도가 아니므로 제외한다

4. 이 저장소 cutover 후 `source_dirs`와 `graphify.test_dirs`는?
   - A) `source_dirs: ["scripts","hooks"]`, `graphify.test_dirs: ["test"]`
   - B) `source_dirs: ["scripts","hooks","test"]`, `test_dirs` 없음
   - C) `source_dirs: ["scripts"]`, `graphify.test_dirs: ["hooks","test"]`

## 이해 상태
- 응답: 1B 2A 3C 4A
- 정답: 1B 2A 3C 4A
- 채점: 4/4 (전부 정답)
- disposition: 네 문항 모두 정답. 세 스코프 보고·빈 배열·missing 제외·config cutover를 구분함.
- range: develop..dc00cab76facd50805dd9cc228025ad5236c7d79
- diff_sha: c4db3096d15fc701f45be350984ad082f4780d9cd6e2a4b8e5430edbdecffb7f
