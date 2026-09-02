---
type: bouncer.tasks
title: context 섹션 다이제스트 추출기와 그래프 빌드 배선
description: Tasks for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/004-context-section-digest/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T14:56:45.103+09:00'
bouncer:
  id: TASKS-001
  epic_id: '060'
  blueprint_id: '004'
  status: verified
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - test/context-digest.test.js
    - test/session-graph.test.js
  graph:
    generated_at: '2026-08-11T15:05:22+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/graphify-runner
      - docs
    basis:
    - graph: source
      status: reused
      query: >-
        context graph section digest derived tree session-graph
        normalizeGraphPaths resolveGraphScopes graphify runner suggested paths
      result: >-
        66 nodes / 10 files. scripts/src/lib/session-graph.ts,
        scripts/src/lib/graphify.ts, scripts/src/lib/init.ts, scripts/src/lib/cli.ts
        (+ scripts/lib CJS emit). test/ and skills/ did not surface — added manually.
    - graph: context
      status: updated
      query: >-
        context graph section digest derived tree session-graph
        normalizeGraphPaths resolveGraphScopes graphify runner suggested paths
      result: >-
        3 files. epics/011-graphify-signal/blueprints/002-graph-path-contract
        (기존 그래프 경로 계약), epics/026-context-graph-slim BP·tasks 자신.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`.bouncer/context` 전체를 graphify에 넣던 context 그래프가, 화이트리스트 섹션만 뽑아낸 파생 트리 `graphify-out/context-src/`를 대신 스캔한다. graphify가 파생 파일명을 `source_file`에 기록하므로, 빌드 직후 정규화 단계에서 `map.json`을 참조해 원본 저장소 경로로 되돌린다. 그 결과 `graphify-out/context/graph.json`을 읽는 쪽은 파생 트리의 존재를 알 필요가 없다.

## Interface
- 제공:
  - 새 모듈 `scripts/src/lib/context-digest.ts`
    - `CONTEXT_DIGEST_OUT = 'graphify-out/context-src'`
    - `DIGEST_MAP_REL = 'graphify-out/context-src/map.json'`
    - `DIGEST_WATCH_FILES = ['.bouncer/Distill.md']`
    - `digestRulesFor(rel)` → 유지할 헤딩 배열 또는 `null`
    - `extractSections(markdown, headings)` → 추출된 마크다운 문자열 (없으면 `''`)
    - `buildContextDigest({ repoRoot, contextDirs })` → `{ dir, files, map, count }`
  - `resolveGraphScopes`의 context scope에 `scanDirs`와 `watchFiles` 필드가 붙고, `planOneGraph`가 그 두 값을 결정 객체에 그대로 실어 보낸다.
  - `normalizeGraphPaths(repoRoot, partOut, dir, opts)`가 `opts.map`을 받는다.
- 거부:
  - `digestRulesFor`가 `null`을 주는 문서(`tasks.md`, `verification.md`, `review.md`, blueprint `index.md` 등)는 파생 파일을 만들지 않는다.
  - 추출 결과가 빈 문자열인 문서도 파생 파일을 만들지 않는다. 헤딩만 있고 본문이 없는 경우가 여기 해당한다.
  - `buildContextDigest`가 `count === 0`을 주면 graphify를 실행하지 않고 그 scope를 건너뛴다. 기존 `graph.json`을 지우거나 빈 그래프로 덮어쓰지 않는다.
  - `opts.map`이 있을 때 매핑에 없는 `source_file`을 가진 노드는 드롭한다. 파생 이름을 그대로 남기는 폴백은 두지 않는다. 드롭된 노드 id를 참조하는 link와 hyperedge도 함께 제거한다.
  - `opts.map`이 없으면 기존 `${dir}/${f}` 접두 동작을 그대로 유지한다. source scope 동작은 바뀌지 않는다.

## Touch
- Create `scripts/src/lib/context-digest.ts` — 화이트리스트 규칙, 섹션 추출, 파생 트리·`map.json` 생성
- Create `scripts/lib/context-digest.js` — 위 모듈의 CJS emit (소비자는 Node만 씀)
- Modify `scripts/src/lib/session-graph.ts` — context scope에 `scanDirs`/`watchFiles` 추가, `defaultExecGraphify`의 다이제스트 선행 생성, `normalizeGraphPaths` map 지원, `realNewestMtime`의 파일 mtime 처리
- Modify `scripts/lib/session-graph.js` — 위 변경의 CJS emit
- Create `test/context-digest.test.js` — `digestRulesFor` / `extractSections` / `buildContextDigest` 단위 테스트
- Modify `test/session-graph.test.js` — scope 필드, freshness 입력, map 기반 정규화·드롭 테스트 추가

## Do not touch
- `skills/graphify-runner/SKILL.md` — 소비 측 방어 필터는 task 002 몫이다
- `docs/configuration.md` — 문서 갱신은 task 002 몫이다
- `docs/ARCHITECTURE.md` — 문서 갱신은 task 002 몫이다
- `scripts/src/lib/graphify.ts` — 실행 파일 해석기는 이번 변경과 무관하다
- `.bouncer/config.json` — 화이트리스트를 설정 키로 만들지 않는다

## Constraints
- `scripts/lib/*.js`는 손으로 고치지 않는다. `scripts/src`를 고치고 `npm run build`(또는 `pretest`)로 emit을 갱신한 뒤 그 결과를 커밋한다.
- `resolveGraphScopes`의 source scope는 `scanDirs`/`watchFiles` 없이 두고, 소비 측은 `scanDirs || dirs` / `watchFiles || []`로 읽는다. source 경로에 새 분기를 만들지 않는다.
- context 그래프의 freshness는 `dirs`(설정된 `context_dirs`)와 `watchFiles`의 mtime으로만 판정한다. 파생 트리 경로를 freshness 입력에 넣지 않는다.
- `graphSyncWarnings`가 만들어내는 문구는 바꾸지 않는다. `configured`에 파생 경로나 `watchFiles`를 섞지 않는다.
- 새 예외를 던지지 않는다. 파생 트리 생성 실패는 기존 `syncSessionGraphs`의 `failed` 경로로 흘러가면 된다.
- 코드 주석은 한국어로, 왜 그렇게 했는지가 자명하지 않은 지점에만 단다.

## Checklist
- [ ] `test/context-digest.test.js`를 먼저 쓴다. 최소한 다음을 단언한다.
  ```js
  assert.deepEqual(digestRulesFor('.bouncer/Distill.md'), ['## Decisions']);
  assert.deepEqual(
    digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/explain.md'),
    ['## Background', '## Intuition', '## Code'],
  );
  assert.deepEqual(digestRulesFor('.bouncer/context/epics/026-x/index.md'), ['## Success criteria']);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/index.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/tasks.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/verification.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/review.md'), null);
  ```
- [ ] 같은 파일에 `extractSections` 단언을 추가한다. 프론트매터가 제거되고, 요청한 헤딩의 본문만 다음 `##` 직전까지 남고, 헤딩이 없으면 `''`가 나온다.
- [ ] 같은 파일에 `buildContextDigest` 단언을 추가한다. 임시 저장소 트리에서 화이트리스트 문서만 평탄 파일로 나오고, `map.json`이 평탄 파일명 → 원본 경로를 담고, 재실행 시 이전 산출물이 남지 않고, 슬러그가 충돌하는 두 경로가 서로 다른 파일명을 받는다.
- [ ] `node --test test/context-digest.test.js`가 모듈 부재로 실패하는 것을 확인한다.
- [ ] `scripts/src/lib/context-digest.ts`를 구현한다. 평탄 이름은 저장소-상대 경로를 `[^a-zA-Z0-9]+` → `-`로 접고 앞뒤 `-`를 떼어 만들며, 이미 쓰인 이름이면 `-2`, `-3`을 붙인다. 파생 파일 본문은 원본 경로를 밝히는 한 줄 헤더로 시작한다.
- [ ] `test/session-graph.test.js`에 실패 테스트를 추가한다.
  ```js
  // context scope는 파생 트리를 스캔하고, freshness는 원본을 본다
  const [source, context] = resolveGraphScopes({ sourceDirs: ['scripts'], contextDirs: ['.bouncer/context'] });
  assert.equal(source.scanDirs, undefined);
  assert.deepEqual(context.dirs, ['.bouncer/context']);
  assert.deepEqual(context.scanDirs, ['graphify-out/context-src']);
  assert.deepEqual(context.watchFiles, ['.bouncer/Distill.md']);
  ```
- [ ] 같은 파일에 정규화 테스트를 추가한다. `map`을 넘겼을 때 매핑된 노드의 `source_file`이 원본 경로가 되고, 매핑에 없는 노드는 사라지며, 그 노드를 가리키던 link도 사라진다. `map` 없이 호출하면 기존 `${dir}/${f}` 동작이 그대로다.
- [ ] 같은 파일에 freshness 테스트를 추가한다. `.bouncer/Distill.md`만 최신일 때 context scope의 action이 `build`가 된다.
- [ ] `node --test test/session-graph.test.js`가 실패하는 것을 확인한다.
- [ ] `scripts/src/lib/session-graph.ts`를 구현한다. `resolveGraphScopes`에 필드를 붙이고, `planOneGraph`가 `newestMtime(present, watchFiles)`로 부르도록 바꾸고, `realNewestMtime`이 디렉터리가 아닌 경로는 `statSync`로 직접 재게 한다.
- [ ] `defaultExecGraphify`에서 `graph.name === 'context'`일 때 `buildContextDigest`를 먼저 부르고, `count === 0`이면 그대로 반환하며, 아니면 `graph.scanDirs`를 스캔한 뒤 `normalizeGraphPaths(..., { map })`로 정규화한다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`와 `scripts/lib/session-graph.js`를 갱신한다.
- [ ] `npm test`가 통과한다.
- [ ] `rm -rf graphify-out/context graphify-out/context-src` 후 `node scripts/bouncer graph-sync`를 돌려 실제로 재빌드하고, 새 노드 수와 `graphify-out/context/graph.json`에 파생 경로가 하나도 없다는 것을 확인한다. 숫자는 `/bouncer-commit` 때 explain에 남긴다.
  ```bash
  node -e "const g=require('./graphify-out/context/graph.json');
  console.log('nodes',g.nodes.length);
  console.log('leaked',g.nodes.filter(n=>String(n.source_file||'').startsWith('graphify-out/')).length);"
  ```
