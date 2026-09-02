---
type: bouncer.tasks
title: 컨텍스트 다이제스트 화이트리스트에 blueprint·task 층위 추가
description: Tasks for blueprint 007.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T08:54:49.021+09:00'
bouncer:
  id: TASKS-001
  epic_id: '014'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - epic 047의 세 task가 남긴 context 그래프 fail-skip의 원인이 재빌드 누락이 아니라 화이트리스트에 blueprint와 task 층위가 없는 것이었음
    - 계약과 구현 의도가 담긴 섹션만 좁게 투영해 본문 통짜 인덱싱의 잡음 없이 검색 신호를 얻으려 함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - test/context-digest.test.js
    - test/session-graph.test.js
    - docs/configuration.md
    - docs/ARCHITECTURE.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T09:01:55.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest
      - .bouncer/context/epics/047-context-injection/blueprints/001-brief-injection-slim
      - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver
    basis:
      - graph: source
        status: reused
        query: context digest whitelist section extraction blueprint index tasks brief derived tree map.json
        result: 90 nodes, rolled up to test/ only — no scripts/ or docs/ hit; source_dirs are scripts/hooks/test so skills and docs never appear
      - graph: context
        status: updated
        query: context digest whitelist section extraction blueprint index tasks brief derived tree map.json
        result: 12 nodes across 3 explain.md — 026 context-section-digest, 047 brief-injection-slim, 018 tasks-doc-resolver; all source_file values are original repo paths
---
# Tasks

Blueprint: [007](../../index.md)

## Goal & intent
`digestRulesFor`가 blueprint `index.md`의 `## Intent` / `## Contract`와 task
`tasks/<NNN>/tasks.md`의 `## Goal & intent` / `## Interface`를 파생 트리로
뽑는다. 그 결과 재빌드한 context 그래프에서 계약 어휘와 구현 어휘가 조회되고,
모든 히트는 여전히 저장소-상대 원본 경로를 가리킨다. 026이 세운 나머지 계약
(빈 섹션 시 파일 미생성, `map.json` remap, 미매핑 노드 드롭)은 그대로다.

## Interface
- 제공: `digestRulesFor(rel)`이 blueprint `index.md` 경로에 대해
  `['## Intent', '## Contract']`를, `tasks/<NNN>/tasks.md` 경로에 대해
  `['## Goal & intent', '## Interface']`를 돌려준다. 기존 네 갈래(Distill 본체,
  Distill 샤드, epic `index.md`, `explain.md`)의 반환값은 바뀌지 않는다.
- 거부: 세 자리 숫자가 아닌 `tasks/` 하위 디렉터리(`tasks/1/tasks.md`), 구형 루트
  `tasks.md`와 `tasks-<NNN>.md`, blueprint 디렉터리 밖의 `index.md`는 계속
  `null`을 돌려준다. epic `index.md`는 `blueprints/` 분기에 걸리지 않는다.
- 거부: 요청한 헤딩이 없거나 본문이 비면 그 섹션을 빼고, 남는 섹션이 없으면
  `extractSections`가 `''`를 돌려 파생 파일을 만들지 않는다. 이 동작에 새 분기를
  넣지 않는다.

## Touch
- Modify `scripts/src/lib/context-digest.ts` — `digestRulesFor`에 blueprint
  `index.md`와 task `tasks.md` 두 갈래를 더한다.
- Modify `scripts/lib/context-digest.js` — 커밋되는 CJS emit. `npm run build`가
  다시 생성하고 `check:emit`이 드리프트를 잡는다.
- Modify `test/context-digest.test.js` — 화이트리스트 단언과 거부 경로 단언을
  새 갈래까지 넓힌다.
- Modify `test/session-graph.test.js` — `empty context digest skips graphify …`
  픽스처의 「화이트리스트 문서 없음」 주석이 거짓이 된다. 그 픽스처의
  `tasks.md`는 이제 화이트리스트 경로이고, `## Checklist`만 있어 섹션이 비기
  때문에 digest count가 0으로 남는 것이다. 단언은 그대로 두고 주석만 고친다.
- Modify `docs/configuration.md` — 「컨텍스트 그래프」 절의 화이트리스트 목록을
  다섯 종류로 고친다.
- Modify `docs/ARCHITECTURE.md` — §D-1의 같은 서술을 고친다.

## Do not touch
- `scripts/src/lib/graph-scope.ts` — freshness 판정 입력은 이미 `context_dirs`
  전체라 새 화이트리스트 항목이 추가돼도 바뀔 것이 없다.
- `scripts/src/lib/graph-exec.ts` — `normalizeGraphPaths` remap 경로는 026의
  계약이고 이번 변경의 대상이 아니다.
- `scripts/src/lib/distill.ts` — Distill 샤드 분기는 그대로 둔다.
- `skills/graphify-runner/` — 롤업과 `graphify-out/` 히트 드롭 규칙은 그대로다.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 승격은 `/bouncer-finalize` 소관이다.

## Constraints
- `digestRulesFor`의 반환 계약(헤딩 배열 또는 `null`)을 유지한다. 새 반환 형태나
  옵션 인자를 만들지 않는다.
- task 경로 판정에 `tasks.md` 문자열과 `\d{3}` 규칙을 하드코딩하지 않는다.
  Distill `context-layout` 불변식이 그 판정을 `tasks-docs.ts` 한 곳으로 묶어
  두었으므로 `TASK_DIR_RE`와 `TASK_UNIT_BASENAMES[0]`을 import해 쓴다.
  두 상수는 이미 export돼 있으므로 `tasks-docs.ts` 자체는 수정하지 않는다.
  `context-digest.ts`는 이미 `./distill`과 `./layout`을 require하므로 emit
  상대 경로 계약에 새로 걸리는 것은 없다.
- 사람용 문서의 화이트리스트 서술은 코드와 같은 순서·같은 헤딩 이름을 쓴다.
  "셋입니다" 같은 개수 표현이 남지 않게 한다.
- 공개 문자열과 주석은 한국어를 유지한다.

## Checklist
- [ ] `test/context-digest.test.js`의 `digestRulesFor whitelists …` 테스트에
      blueprint `index.md`와 task `tasks.md` 기대값을 추가해 먼저 실패시킨다.
      ```js
      assert.deepStrictEqual(
        digestRulesFor('.bouncer/context/epics/049-x/blueprints/001-y/index.md'),
        ['## Intent', '## Contract'],
      );
      assert.deepStrictEqual(
        digestRulesFor('.bouncer/context/epics/049-x/blueprints/001-y/tasks/001/tasks.md'),
        ['## Goal & intent', '## Interface'],
      );
      ```
- [ ] 같은 테스트에 거부 경로 단언을 추가해 함께 실패시킨다.
      ```js
      assert.strictEqual(digestRulesFor('.bouncer/context/epics/049-x/blueprints/001-y/tasks/1/tasks.md'), null);
      assert.strictEqual(digestRulesFor('.bouncer/context/epics/049-x/blueprints/001-y/tasks.md'), null);
      assert.strictEqual(digestRulesFor('.bouncer/context/epics/049-x/blueprints/001-y/tasks-001.md'), null);
      assert.deepStrictEqual(
        digestRulesFor('.bouncer/context/epics/049-x/index.md'),
        ['## Success criteria'],
      );
      ```
      마지막 단언은 epic `index.md`가 새 blueprint 분기에 걸리지 않는지 보는
      회귀 방지용이다.
- [ ] 같은 테스트 파일에서 새 갈래와 모순되는 기존 단언을 고친다. 이 셋은
      구현과 동시에 반드시 실패한다.
      ```js
      // test/context-digest.test.js:22-23 — null 기대를 헤딩 배열 기대로 바꾼다
      assert.equal(digestRulesFor('…/blueprints/001-y/index.md'), null);
      assert.equal(digestRulesFor('…/blueprints/001-y/tasks/001/tasks.md'), null);
      // test/context-digest.test.js:88 — 픽스처 `${bp}/index.md`가 '## Intent'를
      // 가지므로 이제 파생 파일이 생긴다. 제외 단언을 포함 단언으로 뒤집는다
      assert.ok(!originals.some((p) => p.endsWith('/blueprints/001-y/index.md')));
      ```
      `:87`의 `!originals.some((p) => p.endsWith('/tasks.md'))`는 그 픽스처
      `tasks.md`에 `## Checklist`만 있어 그대로 통과한다. 다음 항목에서 픽스처를
      바꾸면 그때 함께 뒤집는다.
- [ ] 테스트 이름 `'digestRulesFor whitelists Distill, explain, and epic index only'`
      (`test/context-digest.test.js:15`)를 다섯 종류를 담는 이름으로 고친다.
- [ ] `node --test test/context-digest.test.js`로 실패를 확인한다.
- [ ] `scripts/src/lib/context-digest.ts`의 `digestRulesFor`에 두 갈래를 더한다.
      기존 `explain.md` 분기보다 뒤에 두고, 세 자리 규칙과 basename 판정은
      `tasks-docs.ts`가 export한 상수에 맡긴다. 그 파일은 수정하지 않는다.
      ```ts
      const { TASK_DIR_RE, TASK_UNIT_BASENAMES } = require('./tasks-docs');

      if (/^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/index\.md$/.test(norm)) {
        return ['## Intent', '## Contract'];
      }
      const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/
        .exec(norm);
      if (unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]) {
        return ['## Goal & intent', '## Interface'];
      }
      ```
- [ ] `buildContextDigest` 테스트에 blueprint와 task 픽스처를 넣어 파생 파일과
      `map.json` 항목이 원본 경로로 생기는지 단언한다.
- [ ] `scripts/src/lib/context-digest.ts:23-24`의 주석
      「그 외(tasks/verification/review, blueprint index 등)는 null」에서 이제
      화이트리스트에 들어간 두 종류를 뺀다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`를 다시 생성한다.
- [ ] `docs/configuration.md`와 `docs/ARCHITECTURE.md`의 화이트리스트 서술을
      다섯 종류로 고치고, 개수를 못 박은 표현을 없앤다.
- [ ] `grep -rn "화이트리스트" docs/ scripts/src/ test/`로 남은 서술이 없는지
      확인한다. `test/session-graph.test.js`의 픽스처 주석이 여기서 잡힌다.
- [ ] `npm run ci`가 통과한다.
- [ ] epic 성공 조건 1·2·3의 증적을 만든다. `verify`가 판정하지 않는 부분이므로
      구현 보고에 숫자를 그대로 싣는다. `/bouncer-finalize`의 `explain.md`가
      이 숫자를 받는다.
      ```bash
      BOUNCER_ROOT="$(bouncer-root --auto)"
      node "${BOUNCER_ROOT}/scripts/bouncer" graph-sync
      ls graphify-out/context-src/*.md | wc -l
      cat graphify-out/context-src/*.md | wc -c
      node -e "const g=require('./graphify-out/context/graph.json');
        const bad=(g.nodes||[]).filter(n=>String(n.source_file||'').startsWith('graphify-out/'));
        console.log('nodes',(g.nodes||[]).length,'derived-leak',bad.length)"
      ```
      `derived-leak`은 0이어야 한다(성공 조건 1).
- [ ] epic 047의 세 task가 `fail-skip`을 남긴 질의어로 context 그래프를 조회해
      usable hit 수를 기록한다(성공 조건 2).
      ```bash
      GRAPHIFY_BIN="$(node "${BOUNCER_ROOT}/scripts/bouncer" graphify-bin)"
      "$GRAPHIFY_BIN" query "presentCurrent pointer payload scale" \
        --graph graphify-out/context/graph.json
      "$GRAPHIFY_BIN" query "execute task brief scope_evidence injection" \
        --graph graphify-out/context/graph.json
      ```
      히트의 `src=` 값이 blueprint `index.md` 또는 `tasks/<NNN>/tasks.md`를
      포함하는지 함께 본다.
