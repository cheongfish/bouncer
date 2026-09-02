---
type: bouncer.tasks
title: 루트 graph.json 참조 정리
description: Point the remaining runtime-artifact fixtures and install docs at the scope graphs so no reference to the deleted root graphify-out/graph.json survives.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/008-scope-separation-and-reporting/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - graph-sync
  - docs
  - fixtures
timestamp: '2026-09-01T15:49:12.636+09:00'
bouncer:
  id: TASKS-003
  epic_id: '060'
  blueprint_id: '008'
  status: verified
  commit_intent: |
    루트 `graphify-out/graph.json`은 이미 사라졌는데 테스트 픽스처 세 곳이 아직 그 경로를 런타임 산출물 예시로 쓰고 있었음
    픽스처를 실재하는 스코프 산출물로 옮기고 설치 문서의 두 스코프 서술을 셋으로 넓혀 저장소 진술을 산출물 지형과 맞춤
  affected_paths:
    - test/finalize.test.js
    - test/validate-gates.test.js
    - test/commit-guard.test.js
    - docs/install.md
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
        - 'context seeds: hits on 039/059 install and public-contract task briefs'
        - 'implementation candidates are all low confidence except one fixture file'
    candidates:
      implementation:
        - path: test/validate-gates.test.js
          score: -4
          confidence: low
          basis:
            - generic name match for docs
            - implementation path
            - contains-only reach
        - path: test/graph-search-quality.test.js
          score: 5
          confidence: medium
          basis:
            - defines unique seed fixture
            - implementation path
            - contains-only reach
      test: []
      context:
        - path: .bouncer/context/epics/060-graphify-search-quality/blueprints/008-scope-separation-and-reporting/tasks/003/tasks.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
        - path: .bouncer/context/epics/039-release-security/blueprints/002-public-contract-freeze/tasks/001/tasks.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
    basis:
      - graph: source
        status: reused
        query: 'runtime artifact graphify-out staged fixture install docs'
        result: 'test/validate-gates.test.js appears at -4 and test/graph-search-quality.test.js at 5; test/finalize.test.js and docs/install.md were not ranked'
      - graph: test
        status: skip-disabled
        query: 'not run: graphify.test_dirs is unset so graphify-out/test was never built'
        result: 'no test scope exists, so the fixture files under test/ can only surface as implementation'
      - graph: context
        status: updated
        query: 'runtime artifact graphify-out staged fixture install docs'
        result: '3 hits at score 4 including this blueprint tasks/003/tasks.md'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
이미 삭제된 루트 `graphify-out/graph.json`을 가리키는 마지막 참조를 저장소에서 없앤다. 세 테스트(`finalize`, `validate-gates`, `commit-guard`)가 이 경로를 "런타임 산출물이라 스테이징·위반 판정에서 제외된다"는 규칙의 예시로 쓰고 있는데, 그 경로는 더 이상 만들어지지 않으므로 예시가 실제 산출물 지형과 어긋난다. 함께 `docs/install.md`를 손본다 — 이 문서에는 루트 `graph.json` 참조가 없고, sync 이후 갱신되는 산출물을 source·context 둘로만 적어 test 스코프가 빠져 있다. 즉 앞의 셋은 죽은 경로 치환이고 install.md는 두 스코프 서술을 셋으로 넓히는 일이다.

## Interface
- 제공: `test/finalize.test.js`·`test/validate-gates.test.js`·`test/commit-guard.test.js`의 런타임 산출물 픽스처가 실재하는 스코프 경로(`graphify-out/source/graph.json`)를 쓰고, `docs/install.md`가 sync 후 갱신되는 산출물로 source·test·context 셋을 진술한다.
- 거부: `scripts/src/lib/scope.ts`의 `RUNTIME_ARTIFACTS` 접두사 목록(`graphify-out/`)은 바뀌지 않는다 — 이 task는 규칙이 아니라 그 규칙을 예시하는 데이터만 고친다. 두 테스트의 단언(스테이징 목록, 게이트 실패 없음)도 그대로 유지해 검사력이 줄지 않는다. `CHANGELOG.md`의 과거 기록은 소급 수정하지 않는다.

## Touch
- Modify `test/finalize.test.js` — 런타임 산출물 픽스처의 `graphify-out/graph.json`을 실재하는 스코프 산출물 경로로 바꾼다.
- Modify `test/validate-gates.test.js` — commit 게이트 픽스처에서 같은 경로를 같은 이유로 바꾼다.
- Modify `test/commit-guard.test.js` — 커밋 가드의 런타임 산출물 예시 배열에서 같은 치환을 한다.
- Modify `docs/install.md` — sync 이후 갱신되는 산출물 서술에 test 스코프를 포함한다.

## Do not touch
- `scripts/src/lib/scope.ts` — 런타임 산출물 접두사 규칙 자체는 바꾸지 않는다.
- `CHANGELOG.md` — 과거 릴리스 기록은 소급 수정 대상이 아니다.
- `docs/ARCHITECTURE.md` — 빌드 수와 보고 수의 구분은 `docs/configuration.md`가 담당하고(task 001), `:230`의 "`graphify.test_dirs`가 없는 기존 config는 source·context만 만든다"는 빌드에 대한 서술이라 이 변경 뒤에도 참이다.

## Constraints
- 픽스처 경로만 바꾸고 각 테스트의 단언 개수와 내용을 유지한다. 규칙 검사력이 줄면 이 task는 실패다.
- `docs/install.md`의 한국어 본문 문체와 주변 절 구조를 유지한다.
- 변경 후 `grep -rn "graphify-out/graph.json"`이 감사 문서와 `.benchmarks/` 스냅샷 밖에서는 아무것도 찾지 못해야 한다.

## Checklist
- [ ] `grep -rn "graphify-out/graph.json" --include=*.js --include=*.ts --include=*.md . | grep -v node_modules | grep -v .benchmarks`로 현재 참조 목록을 남긴다.
- [ ] `test/finalize.test.js`의 런타임 산출물 배열에서 `'graphify-out/graph.json'`을 `'graphify-out/source/graph.json'`으로 바꾼다.
- [ ] `test/validate-gates.test.js`의 commit 게이트 스테이징 목록과 `test/commit-guard.test.js:30`의 `files` 배열에서 같은 치환을 한다.
- [ ] `docs/install.md`에서 `graphify-out/source`와 `graphify-out/context`만 적힌 문장을 `graphify.test_dirs`가 설정된 경우 `graphify-out/test`도 갱신된다는 내용으로 넓힌다.
- [ ] 위 grep을 다시 돌려 `context-graph-audit.md`와 `.benchmarks/` 밖에 남은 참조가 없음을 확인한다.
- [ ] `npm test`가 통과한다.
