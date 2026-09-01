---
type: bouncer.tasks
title: Distill shard 세 절 색인과 그래프 재빌드 검산
description: Index Invariants, Gotchas, and Decisions from every Distill shard, keep the master Distill as the shard-list source, and measure the rebuilt digest against the target document count.
resource: .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - context-digest
  - distill
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: TASKS-004
  epic_id: '063'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - shard의 Invariants와 Gotchas가 다이제스트에서 드롭되어 프로젝트 불변식이 검색되지 않음
    - master Distill이 실제 헤딩과 어긋난 규칙 때문에 파생 산출이 0건이었음
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - test/context-digest.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T10:00:00.000+09:00'
    suggested_paths:
      - scripts/src/lib/distill.ts
      - scripts/src/lib/graph-exec.ts
      - scripts/src/lib/graph-scope.ts
    quality:
      status: ranked
      confidence: low
      reasons:
        - 'importer fan-out: 26 library files tie at score 5 on imports_from into cli.ts; the ranking does not discriminate the change site'
        - 'context seeds: 9 labels, 8 paths — the 8 shard Decisions documents are the only context hits, which is exactly the coverage hole this task closes'
        - 'test graph missing: graphify.test_dirs unset (Wave 3 scope)'
    candidates:
      implementation:
        - path: scripts/src/lib/distill.ts
          score: 5
          confidence: medium
          basis:
            - imports_from relation
            - implementation path
        - path: scripts/src/lib/graph-exec.ts
          score: 5
          confidence: medium
          basis:
            - imports_from relation
            - implementation path
        - path: scripts/src/lib/graph-scope.ts
          score: 5
          confidence: medium
          basis:
            - imports_from relation
            - implementation path
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'scripts/src/lib/context-digest.ts distill shards invariants gotchas decisions'
        result: '26 tied implementation candidates via importer fan-out'
      - graph: context
        status: reused
        query: 'scripts/src/lib/context-digest.ts distill shards invariants gotchas decisions'
        result: '9 labels / 8 paths — only the 8 shard Decisions sections are indexed today'
      - graph: test
        status: missing
        query: 'context-digest distill shards'
        result: 'graphify.test_dirs unset; no test scope graph'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
Distill 계층의 다이제스트 규칙을 실제 문서 모양에 맞춘다. shard 8건은 지금
`## Decisions`만 통과해 `## Invariants`와 `## Gotchas`가 통째로 드롭된다. 프로젝트
불변식과 함정이야말로 검색되어야 할 내용이므로 세 절을 모두 색인한다.

master `.bouncer/Distill.md`는 규칙이 `['## Decisions']`인데 실제 본문에는
`## Shards`뿐이라 파생 산출이 0건이다. master는 shard 목록과 freshness의 정본이므로
그 역할대로 `## Shards`를 색인해 watch 목록에 있으면서 산출이 없는 상태를 없앤다.

마지막으로 실제 저장소에서 다이제스트를 재빌드해 `map.json` 항목 수가 대상 문서 수와
일치하는지, 감사에서 누락으로 지목한 7건이 모두 등장하는지 실측해 `verification.md`에
증적으로 남긴다.

검증은 `npm test`이며, 아래 Checklist의 단언과 실측 항목이 모두 통과해야 한다.

## Interface
- 제공: `digestRulesFor`가 Distill 계층에 대해 아래를 돌려준다.
  ```
  digestRulesFor('.bouncer/Distill.md')      -> ['## Shards']
  digestRulesFor('.bouncer/distill/core.md') -> ['## Invariants', '## Gotchas', '## Decisions']
  ```
  반환 타입과 다른 계층의 반환값은 그대로다.
- 거부: shard에 세 절 중 일부만 있으면 있는 절만 남기고 문서는 유지한다(기존
  `extractSections` 동작). 셋 다 없고 앵커도 없으면 지금처럼 파생 파일을 만들지 않는다.
  `DISTILL_SHARD_DIR` 밖의 경로는 shard로 취급하지 않는다.

## Touch
- Modify `scripts/src/lib/context-digest.ts` — `digestRulesFor`의 master Distill·shard 분기 반환값 변경
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — 새 규칙 단언과 shard 파생 본문 세 절 단언으로 갱신

## Do not touch
- `.bouncer/Distill.md` — master 본문과 shard 인덱스는 정본이므로 이 task에서 고치지 않는다
- `.bouncer/distill/*.md` — shard 본문을 규칙에 맞추려고 고치지 않는다. 규칙이 문서를 따라간다
- `scripts/src/lib/distill.ts` — `readShards`의 인덱스 계약은 그대로 쓴다
- `.bouncer/config.json` — `distill.routing_enabled`와 `max_bytes`를 건드리지 않는다

## Constraints
- `test/context-digest.test.js`에서 Distill을 다루는 자리는 넷이다: `:16`의 master 단언, `:37` 부근의 shard 단언, `:131` 테스트 안의 master 픽스처, 같은 테스트의 `.bouncer/distill/core.md` 픽스처. 넷을 모두 새 계약으로 옮기며, 단언은 교체하는 것이지 삭제하는 것이 아니다.
- master 픽스처가 `## Decisions`만 담은 채로 남으면 새 규칙에서 추출 결과가 비고 앵커도 없어 파생 파일이 생기지 않아 `originals.includes('.bouncer/Distill.md')`가 실패한다. 픽스처를 실제 문서처럼 `## Shards`를 담도록 바꾼다.
- 절 이름 문자열은 문서에 있는 그대로 쓴다. 정규화하거나 별칭을 만들지 않는다.
- 세 절의 순서를 `Invariants` → `Gotchas` → `Decisions`로 고정한다. shard 문서의 작성 순서와 같다.
- 실측은 저장소 기본 브랜치 상태에서 수행하고, `targets`·`emitted`·`missing` 세 값을 `verification.md`의 Evidence에 명령 출력 그대로 붙인다. 수치를 요약해 옮겨 적지 않는다.

## Checklist
- [ ] `test/context-digest.test.js`의 Distill 단언을 새 계약으로 바꾼다.
  ```js
  assert.deepEqual(digestRulesFor('.bouncer/Distill.md'), ['## Shards']);
  assert.deepEqual(
    digestRulesFor('.bouncer/distill/core.md'),
    ['## Invariants', '## Gotchas', '## Decisions'],
  );
  ```
- [ ] 같은 파일의 `buildContextDigest includes Decisions from registered shards…` 테스트에서 master 픽스처를 `## Shards` 본문으로, `core.md` 픽스처를 세 절 모두 담도록 바꾼다.
  ```js
  // master 픽스처
  '---', 'distill:', '  version: 1', '---', '## Shards', '', '- core', '',
  // core.md 픽스처
  '## Invariants', '', 'inv', '', '## Gotchas', '', 'got', '', '## Decisions', '', 'shard decision', '',
  ```
- [ ] `npm test`로 그 단언이 실패하는 것을 확인한다.
- [ ] `digestRulesFor`의 두 분기 반환값을 바꾼다.
- [ ] shard 픽스처의 파생 본문이 `## Invariants`·`## Gotchas`·`## Decisions` 셋을 그 순서로 담는지 단언한다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`를 갱신하고 `npm run check:emit`이 통과하는지 확인한다.
- [ ] `npm test`가 통과한다.
- [ ] 실제 저장소에서 다이제스트를 재빌드하고, `digestRulesFor`가 `null`이 아닌 문서 수와 산출 수를 함께 출력해 차집합을 확인한다.
  ```bash
  node -e "
  const {buildContextDigest,digestRulesFor}=require('./scripts/lib/context-digest');
  const fs=require('fs'),path=require('path');
  const walk=(d,a=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);
    if(e.isDirectory())walk(f,a);else if(e.name.endsWith('.md'))a.push(path.relative(process.cwd(),f));}return a;};
  const targets=[...walk('.bouncer/context'),'.bouncer/Distill.md',...walk('.bouncer/distill')].filter(digestRulesFor);
  const r=buildContextDigest({repoRoot:process.cwd(),contextDirs:['.bouncer/context']});
  const got=new Set(Object.values(r.map));
  console.log('targets',targets.length,'emitted',r.count);
  console.log('missing',targets.filter(t=>!got.has(t)));
  "
  ```
- [ ] `missing`이 빈 배열이거나, 남은 항목이 화이트리스트 절도 앵커도 없는 문서임을 확인한다.
- [ ] 감사에서 누락으로 지목한 7건이 `map.json`에 등장하는지 확인한다.
  ```bash
  node -e "const m=require('./graphify-out/context-src/map.json');const want=['.bouncer/context/epics/001-cli-usability/index.md','.bouncer/context/epics/002-commit-artifacts/index.md','.bouncer/context/epics/003-multi-agent-plugin/index.md','.bouncer/context/epics/005-review-depth/index.md','.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/index.md','.bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/index.md','.bouncer/Distill.md'];const have=new Set(Object.values(m));for(const w of want)console.log(have.has(w)?'OK':'MISSING',w)"
  ```
- [ ] 위 두 명령의 출력을 `verification.md`의 Evidence에 그대로 남긴다.
- [ ] `npm run check:emit`과 `npm test`를 마지막으로 한 번 더 통과시킨다.
