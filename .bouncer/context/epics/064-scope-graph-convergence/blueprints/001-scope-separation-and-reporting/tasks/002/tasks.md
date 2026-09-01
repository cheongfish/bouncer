---
type: bouncer.tasks
title: 저장소 config를 세 스코프로 전환
description: Move test out of source_dirs into graphify.test_dirs for this repository and record measured role separation from graph-suggest.
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - graph-scope
  - test-dirs
  - graph-suggest
  - config
timestamp: '2026-09-01T15:49:12.592+09:00'
bouncer:
  id: TASKS-002
  epic_id: '064'
  blueprint_id: '001'
  status: verified
  commit_intent: |
    이 저장소가 `test`를 `source_dirs`에 두어 test scope 그래프가 만들어지지 않았고 테스트 파일이 implementation 후보에 섞였음
    `graphify.test_dirs`로 분리해 역할 후보가 실제로 갈리는지 실측 증적으로 확인함
  affected_paths:
    - .bouncer/config.json
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T16:12:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'test graph missing: graphify-out/test/graph.json is absent because graphify.test_dirs is unset'
        - 'relation filter: calls, imports, imports_from (depth <= 2); contains ownership only'
        - 'context seeds: 6 labels, 10 paths'
        - 'result explosion: 84 candidates (>= 50)'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'graphify test_dirs source_dirs scope config (seed .bouncer/config.json)'
        result: '84 candidates over the explosion threshold; no ranked path survived, so no advisory path list'
      - graph: test
        status: skip-disabled
        query: 'not run: graphify.test_dirs is unset so graphify-out/test was never built'
        result: 'no test scope exists; creating it is this task goal'
      - graph: context
        status: updated
        query: 'graphify test_dirs source_dirs scope config (seed .bouncer/config.json)'
        result: '6 label seeds and 10 path seeds hit, all dropped by the explosion filter'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
이 저장소의 `.bouncer/config.json`에서 `test`를 `source_dirs`에서 빼고 `graphify.test_dirs`에 넣어, `graph-sync`가 `graphify-out/test/graph.json`을 실제로 만들게 한다. 그 뒤 `bouncer graph-suggest`를 돌려 `test/` 파일이 `candidates.test`로, `scripts/` 구현 파일이 `candidates.implementation`으로 분류되는 것을 실측 출력으로 남긴다. `docs/configuration.md`가 `init`은 기존 config에 이 키를 추가하지 않는다고 못박고 있으므로, 이 전환은 손으로 해야 하는 일회성 작업이다.

## Interface
- 제공: `.bouncer/config.json`의 `source_dirs`가 `["scripts", "hooks"]`가 되고 `graphify` 객체에 `test_dirs: ["test"]`가 생긴다. 이어지는 `bouncer graph-sync`가 `graphify-out/test/graph.json`을 만들고, 같은 sync가 `source` 스코프를 rebuild해 더 이상 `test/` 파일을 담지 않는다.
- 거부: `.bouncer/config.json`의 다른 필드(`context_dirs`, `verify`, `base_branch`, `pr`, `subagents`, `distill`, `graphify.enabled`)는 값도 순서도 바뀌지 않는다. `graphify.exclude_dirs`를 새로 넣지 않는다 — 생성 경로 추측은 이 task의 계약이 아니다. `graphify-out/` 산출물은 gitignore 대상이므로 커밋에 들어가지 않는다.

## Touch
- Modify `.bouncer/config.json` — `source_dirs`에서 `test`를 빼고 `graphify.test_dirs: ["test"]`를 추가한다.

## Do not touch
- `scripts/src/lib/graph-scope.ts` — 스코프 계획 코드는 task 001이 소유한다.
- `scripts/src/lib/session-graph.ts` — 같은 이유다.
- `scripts/src/lib/init.ts` — 기존 config 자동 주입은 epic Out of scope다.
- `test/fixtures/graph-search-quality.json` — 고정 corpus 벤치마크는 저장소 config를 읽지 않으며 임계치를 이 전환으로 흔들지 않는다.

## Constraints
- `.bouncer/config.json`은 JSON이므로 주석을 넣을 수 없다. 전환 근거는 이 문서와 커밋 메시지에만 남긴다.
- 기존 들여쓰기와 키 순서를 보존하고, 최소 diff로 바꾼다.
- 실측 증거는 명령과 출력을 그대로 verification 문서에 남긴다. "분류가 잘 된다" 같은 요약으로 대체하지 않는다.
- `graph-suggest` 출력은 데이터다. 그 결과가 이 task의 Touch나 `affected_paths`를 넓히지 않는다.

## Checklist
- [ ] `.bouncer/config.json`의 `source_dirs`를 `["scripts", "hooks"]`로 바꾸고 `graphify`에 `test_dirs: ["test"]`를 추가한다.
- [ ] `node scripts/bouncer graph-sync`를 돌리고, 결과 JSON에서 `test` 항목의 `action`이 `build`(또는 재실행 시 `skip-fresh`)이고 `source` 항목의 `dirs`에 `test`가 없음을 확인한다.
- [ ] `ls graphify-out/test/graph.json`으로 test 그래프 산출물이 생겼음을 확인한다.
- [ ] `node scripts/bouncer graph-suggest --query "session graph scope planning"`을 돌려 `candidates.test`에 `test/` 경로가, `candidates.implementation`에 `scripts/` 경로가 나오는 출력을 그대로 증적에 남긴다.
- [ ] 같은 명령 출력에서 `test/` 파일이 `candidates.implementation`을 독점하지 않음을 확인하고, 전환 전 상태와 무엇이 달라졌는지 한 줄로 적는다.
- [ ] `git status --short`로 `graphify-out/` 산출물이 추적 대상에 없음을 확인한다.
- [ ] `npm test`가 통과한다.
