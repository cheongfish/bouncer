---
type: bouncer.tasks
title: 세 스코프 보고 계약 고정
description: Always report a test scope entry from planSessionGraph with an explicit skip-unconfigured action so graphify-runner can copy a real status instead of inventing one.
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - graph-scope
  - session-graph
  - graph-sync
  - test-dirs
timestamp: '2026-09-01T15:49:01.158+09:00'
bouncer:
  id: TASKS-001
  epic_id: '064'
  blueprint_id: '001'
  status: verified
  commit_intent: |
    `graph-sync`가 `graphify.test_dirs` 부재 시 test 항목을 통째로 빼서 runner가 근거 없는 basis 상태를 지어내야 했음
    빌드 대상도 missing도 아닌 `skip-unconfigured` 항목을 항상 보고해 보고와 지침을 한 사실에 맞춤
  affected_paths:
    - scripts/src/lib/graph-scope.ts
    - scripts/src/lib/session-graph.ts
    - scripts/lib/graph-scope.js
    - scripts/lib/session-graph.js
    - test/session-graph.test.js
    - references/graphify-runner/index.md
    - test/skill-graphify-runner.test.js
    - docs/configuration.md
    - hooks/session-graph.js
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
        - 'context seeds: 0 labels, 0 paths'
        - 'implementation candidates are all low confidence'
    candidates:
      implementation:
        - path: test/session-graph.test.js
          score: -4
          confidence: low
          basis:
            - generic name match for graph
            - implementation path
            - contains-only reach
        - path: test/graphify.test.js
          score: -4
          confidence: low
          basis:
            - generic name match for graph
            - implementation path
            - contains-only reach
      test: []
      context:
        - path: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/tasks.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
    basis:
      - graph: source
        status: reused
        query: 'session graph scope planning test_dirs report'
        result: 'no high-confidence hit; top rows are test/session-graph.test.js and test/graphify.test.js at score -4 — test files ranked as implementation because test is not a separate scope'
      - graph: test
        status: skip-disabled
        query: 'not run: graphify.test_dirs is unset so graphify-out/test was never built'
        result: 'no test scope exists; this absence is the reporting gap this task closes'
      - graph: context
        status: updated
        query: 'session graph scope planning test_dirs report'
        result: '1 hit at score 4 — this blueprint tasks/001/tasks.md'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer graph-sync`와 `planSessionGraph`의 결과 `graphs[]`가 config 상태와 무관하게 언제나 `source`·`test`·`context` 세 항목을 담게 한다. `graphify.test_dirs`가 없거나 무효라 test 그래프를 만들 수 없을 때 그 항목은 새 `action` 값 `skip-unconfigured`와 어느 경우인지 말하는 `reason`을 갖는다. 이 항목은 빌드 대상이 아니고 `missing`에도 들어가지 않으므로 `test_dirs`를 쓰지 않는 기존 프로젝트에 새 SessionStart 경고가 생기지 않는다. 그 결과 `references/graphify-runner/index.md`가 요구하는 `test` basis 항목을 에이전트가 추측 없이 보고값에서 옮겨 적을 수 있다.

## Interface
- 제공: `resolveGraphScopes`가 `testDirs`가 `null`일 때도 이름 `test`인 스코프를 반환하고, `planSessionGraph`/`syncSessionGraphs`/`bouncer graph-sync`의 `graphs[]`가 길이 3을 유지한다. 빌드 불가 test 항목은 `action: 'skip-unconfigured'`이며 `reason`이 `graphify.test_dirs` 미설정인지 무효 값인지 구분한다. `references/graphify-runner/index.md`의 outcome→status 표에 `skip-unconfigured` → `skip-disabled` 행이 생긴다.
- 거부: `skip-unconfigured` 항목은 존재하지 않는 입력을 실어 나르지 않는다 — `dirs: []`, `configured: []`, `outDir: 'graphify-out/test'`다. `test_dirs: []`(필드 존재, 빈 배열)는 `skip-unconfigured`가 아니라 기존 `skip-no-dirs`로 남는다. `skip-unconfigured` 항목은 `build` 목록·`missing` 목록·`graphSyncWarnings` 어느 쪽에도 들어가지 않는다. `NO_GRAPH_WORK` 종료(graphify disabled, PATH 부재, partial/legacy bootstrap)는 지금처럼 `graphs: []`를 유지하고 test 항목을 만들지 않는다 — 시도하지 않은 상태를 "설정 없음"으로 바꿔 말하지 않는다. 최상위 `decision.action` 요약 값의 의미는 바뀌지 않는다 — 특히 source·context 입력이 하나도 없는 저장소는 항상 실리는 test 항목 때문에 `skip-fresh`로 뒤집히지 않고 `skip-no-dirs`로 남아야 한다. 기존 action 문자열의 철자·의미도 바뀌지 않는다.

## Touch
- Modify `scripts/src/lib/graph-scope.ts` — `resolveGraphScopes`가 `testDirs`가 `null`이어도 test 스코프를 반환하고, 빌드 불가 사유를 실어 보낼 수 있게 한다.
- Modify `scripts/src/lib/session-graph.ts` — `planOneGraph`/`planSessionGraph`가 `skip-unconfigured`를 만들고, `syncSessionGraphs`의 `missing` 계산과 `graphSyncWarnings`가 그 항목을 건너뛰며, `skip-no-dirs` 요약 집계가 그 항목을 제외한 뒤 판정한다.
- Modify `scripts/lib/graph-scope.js` — `tsc` 산출물이 저장소에 추적되고 `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 포함한다. 손으로 고치지 않고 `npm run build`로 갱신한다.
- Modify `scripts/lib/session-graph.js` — 같은 이유로 `npm run build` 산출물을 함께 커밋한다.
- Modify `test/session-graph.test.js` — 두 스코프를 단언하던 기존 케이스를 세 항목 계약으로 고치고, `skip-unconfigured`가 build·missing·경고에 들어가지 않는다는 케이스와 무효 `test_dirs`에서 `skips`와 항목이 함께 남는다는 케이스를 추가한다.
- Modify `references/graphify-runner/index.md` — outcome→status 표에 `skip-unconfigured` 행을 넣고, "`test_dirs`가 없으면 항목을 남기고 이유를 설명하라"는 문장을 보고된 `action`을 옮겨 적으라는 지시로 바꾼다.
- Modify `test/skill-graphify-runner.test.js` — 그 표 행이 문서에서 사라지지 않도록 단언을 추가한다.
- Modify `docs/configuration.md` — "빌드되는 그래프 수"와 "보고되는 스코프 수"가 다르다는 사실을 진술한다.
- Modify `hooks/session-graph.js` — 헤더 주석의 `source + context` 서술을 세 스코프 현실에 맞춘다.

## Do not touch
- `scripts/src/lib/graph-search.ts` — 역할 점수·매칭 규칙은 epic 060 소관이다.
- `scripts/src/lib/graph-exec.ts` — 실제 graphify 실행 경로는 이 보고 계약 밖이다.
- `scripts/src/lib/init.ts` — 기존 config에 `test_dirs`를 주입하지 않는다는 계약을 유지한다.
- `.bouncer/config.json` — 이 저장소의 전환은 task 002가 한다.

## Constraints
- 기존 `action` 문자열(`build`, `skip-fresh`, `skip-no-dirs`, `skip-graph-disabled`, `skip-no-graphify`, `skip-partial-bootstrap`, `skip-legacy-bootstrap`)의 철자와 의미를 바꾸지 않는다. 추가만 한다.
- 하위 호환 별칭이나 같은 사실을 담는 두 번째 필드를 남기지 않는다.
- 공개 진단·경고 문자열은 영어를 유지하고, 비자명한 의도는 한국어 코드 주석으로 적는다.
- `graph-sync` stdout은 JSON 하나로 유지한다. 새 진단은 stderr로 보낸다.
- `scripts/lib/`는 `scripts/src/`의 `tsc` 산출물이다. 손으로 편집하지 않고 `npm run build`로만 갱신하며, `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 스테이징한다.

## Checklist
- [ ] `test/session-graph.test.js`에 실패 테스트를 먼저 추가한다: `test_dirs`가 없는 config에서 `planSessionGraph` 결과의 `graphs`가 길이 3이고 이름이 `['source', 'test', 'context']`이며 test 항목이 `action: 'skip-unconfigured'`다.
- [ ] 같은 파일에 실패 테스트를 추가한다: 그 결정으로 `syncSessionGraphs`를 돌리면 `missing`에 `'test'`가 없고 `graphSyncWarnings(decision)`가 test에 대한 줄을 만들지 않는다.
- [ ] 같은 파일에 실패 테스트를 추가한다: `graphify: { test_dirs: ['/abs/test'] }`처럼 무효한 값이면 `skips`에 사유가 남고 test 항목은 `skip-unconfigured`이며 `reason`이 무효 사유를 가리킨다.
- [ ] 같은 파일에 회귀 테스트를 추가한다: `test_dirs: []`는 `skip-no-dirs`로 남고 `skip-unconfigured`가 아니다.
- [ ] 같은 파일에 회귀 테스트를 추가한다: `skip-graph-disabled` 등 `NO_GRAPH_WORK` 종료는 `graphs`가 빈 배열 그대로다.
- [ ] `test/session-graph.test.js`에 실패 테스트를 추가한다: `source_dirs`·`context_dirs`가 하나도 실재하지 않고 `test_dirs`가 없는 저장소에서 `planSessionGraph`의 최상위 `action`이 `skip-no-dirs`로 남는다(항상 실리는 test 항목 때문에 `skip-fresh`로 뒤집히지 않는다).
- [ ] `test/session-graph.test.js`에 실패 테스트를 추가한다: `graphify-out/test/graph.json`이 디스크에 남아 있어도 `test_dirs`가 없으면 test 항목은 `skip-unconfigured`이고 빌드 대상도 `skip-fresh`도 아니다.
- [ ] `test/session-graph.test.js`의 인덱스·길이 의존 단언 네 곳을 이름 기반으로 고친다: `:118~129`(`graphs.length === 2`, `map(name)` 딥이퀄, `every(action === 'build')`, `graphs[0]`/`graphs[1]`의 `outDir`), `:417`(`const [source, context] = resolveGraphScopes(...)`), `:509~518`(`legacy config without test_dirs keeps two-scope plan results` — 이름과 의도까지 세 항목 계약으로 바꾼다), `:585`(무효 `test_dirs`에서 `map(name)` 딥이퀄). `test/graphify.test.js`는 이미 `.find((scope) => scope.name === 'context')`를 쓰므로 건드리지 않는다.
- [ ] `npm test`로 위 테스트들이 실패하는 것을 확인한다.
- [ ] `resolveGraphScopes`와 `planOneGraph`/`planSessionGraph`를 고쳐 통과시킨다. `syncSessionGraphs`의 `missing` 계산과 `graphSyncWarnings`는 `graph.json` 존재 여부가 아니라 `action === 'skip-unconfigured'`를 키로 제외하고, `skip-no-dirs` 요약 집계도 그 항목을 뺀 뒤 판정한다(제외 후 남는 항목이 없으면 요약을 `skip-no-dirs`로 유지한다).
- [ ] `references/graphify-runner/index.md`의 outcome→status 표에 `skip-unconfigured`를 `skip-disabled`로 사상하는 행을 넣고, 그 아래 "test_dirs가 unset일 때" 문단을 보고된 `action`을 옮겨 적으라는 지시로 고친다.
- [ ] `test/skill-graphify-runner.test.js`에 그 행에 대한 단언을 추가한다.
- [ ] `docs/configuration.md`의 `test_dirs` 문단과 `hooks/session-graph.js` 헤더 주석을 세 스코프 보고 현실에 맞춘다.
- [ ] `npm run build`로 `scripts/lib/graph-scope.js`와 `scripts/lib/session-graph.js`를 갱신하고 `npm run check:emit`이 통과하는지 확인한다.
- [ ] `npm test`가 통과한다.
