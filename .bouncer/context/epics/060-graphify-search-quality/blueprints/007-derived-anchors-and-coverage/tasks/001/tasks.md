---
type: bouncer.tasks
title: 계층 앵커 파생과 파일 생성 조건 완화
description: Derive epic, blueprint, and task anchors from the document path and emit them as derived headings so a document with no whitelisted section still reaches the graph.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/007-derived-anchors-and-coverage/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - context-digest
  - search-anchor
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: TASKS-001
  epic_id: '060'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - 문서 경로에 이미 있는 계층 id가 파생 트리에 남지 않아 앵커 한 토큰으로 계층을 소환할 수 없음
    - 살릴 절이 없는 대상 문서가 파생 파일 없이 사라져 그래프에서 설명되지 않음
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - test/context-digest.test.js
    - test/session-graph.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T10:00:00.000+09:00'
    suggested_paths:
      - test/graph-search.test.js
    quality:
      status: ranked
      confidence: medium
      reasons:
        - 'context seeds: 0 labels, 0 paths — this task is what creates context anchors, so the context graph cannot seed itself yet'
        - 'test graph missing: graphify.test_dirs unset (Wave 3 scope)'
        - 'ranking is contains-only reach on generic heading words; the named implementation file was chosen from the audit, not from the graph'
    candidates:
      implementation:
        - path: test/graph-search.test.js
          score: 5
          confidence: medium
          basis:
            - defines unique seed anchors
            - implementation path
            - contains-only reach
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'context-digest buildContextDigest digestRulesFor extractSections anchors headings'
        result: '1 implementation candidate: test/graph-search.test.js (wave 1 anchor grammar test)'
      - graph: context
        status: reused
        query: 'context-digest buildContextDigest digestRulesFor extractSections anchors headings'
        result: '0 seeds — no ASCII anchors exist in the context graph yet'
      - graph: test
        status: missing
        query: 'context-digest anchors'
        result: 'graphify.test_dirs unset; no test scope graph'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`buildContextDigest`가 만드는 파생 파일이 본문 앞에 계층 앵커 헤딩을 담는다.
`epic-063`처럼 토큰 하나로 질의하면 그 epic의 `index.md` 파생 문서와 그 아래 모든
blueprint·task 파생 문서가 함께 label hit한다. 앵커는 문서 경로에서만 파생하므로
작성자가 본문에 아무것도 적지 않아도 된다.

동시에 파생 파일 생성 조건을 넓힌다. 지금은 화이트리스트 절 본문이 비면 파일을
만들지 않아 epic `001`·`002`·`003`·`005`와 BP `001-cli-usability/001-cli-help`,
`002-commit-artifacts/001-evidence-and-message`가 그래프에서 통째로 사라진다.
앵커만 있어도 파일을 쓰면 이 6건이 최소한 계층 좌표를 가진 노드로 남는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

## Interface
- 제공: `context-digest.ts`가 `anchorsFor(rel: string): string[]`를 추가로 내보낸다.
  가장 좁은 앵커부터 부모 순으로 돌려준다.
  ```
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md')
    -> ['task-063-001-002', 'bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/index.md')
    -> ['bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/explain.md')
    -> ['bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/index.md') -> ['epic-063']
  anchorsFor('.bouncer/Distill.md') -> []
  ```
  blueprint 디렉터리 바로 아래 문서(`explain.md`, `context-review.md`)는 blueprint
  문서와 같은 두 앵커를 얻는다.
  파생 파일 본문은 `<!-- source: <rel> -->` 다음 빈 줄, 그 다음 앵커마다 `## <anchor>`
  한 줄, 그 다음 빈 줄, 그 다음 기존 `extractSections()` 결과 순서가 된다.
- 거부: 규칙은 하나다 — 어떤 층의 id가 선행 세 자리 `\d{3}`(task 층은 `TASK_DIR_RE`)에
  맞지 않으면 그 층과 그 아래 층의 앵커를 만들지 않고, 유효한 상위 층의 앵커는 그대로
  남긴다. epic 층이 깨지면 결과는 빈 배열이고, task 층만 깨지면 `['bp-063-001',
  'epic-063']`이다. 없는 id를 지어내거나 하위 층 앵커를 상위 id로 대신 만들지 않는다.
  Distill과 shard는 계층 id 자체가 없으므로 빈 배열이며, 이는 오류가 아니다.

## Touch
- Modify `scripts/src/lib/context-digest.ts` — `anchorsFor` 추가, 파생 본문 조립에 앵커 헤딩 삽입, 파일 생성 조건을 `앵커 또는 절 본문`으로 완화, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 저장소에 추적되고 `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `anchorsFor` 단언과 파생 본문 형식·생성 조건 단언 추가
- Modify `test/session-graph.test.js` — 앵커만으로도 digest가 생기는 새 emit 규칙에 맞게 empty-digest 스킵 단언·픽스처를 조정

## Do not touch
- `scripts/src/lib/graph-search.ts` — 검색 소비자 규칙은 이 에픽의 Out of scope다
- `scripts/src/lib/scaffold.ts` — 앵커는 파생 트리에만 존재하고 작성 문서에는 넣지 않는다
- `.bouncer/context/epics/**` — 기존 컨텍스트 문서 본문을 이 task에서 고치지 않는다
- `rules/okf.md` — 앵커 문법은 epic 062가 이미 고정했고 이 task는 그것을 구현만 한다

## Constraints
- 앵커 문자열은 `rules/okf.md`「Derived context-digest anchors」의 문법을 그대로 따른다. 콜론·공백·한글을 넣지 않는다.
- id는 zero-padded 세 자리를 그대로 쓴다. 파싱해서 숫자로 바꾸고 다시 채우지 않는다.
- `map.json`의 키·값 형식과 `flattenSlug`·`uniqueFlatName` 동작은 바꾸지 않는다.
- 비ASCII 슬러그가 섞인 디렉터리에서도 앵커는 id 부분만 쓰므로 항상 ASCII다.
- 새 함수는 순수 함수로 두고 파일 시스템에 접근하지 않는다.

## Checklist
- [ ] `test/context-digest.test.js`에 실패하는 단언을 먼저 추가한다.
  ```js
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md'),
    ['task-063-001-002', 'bp-063-001', 'epic-063'],
  );
  assert.deepEqual(anchorsFor('.bouncer/context/epics/063-x/index.md'), ['epic-063']);
  assert.deepEqual(anchorsFor('.bouncer/Distill.md'), []);
  assert.deepEqual(anchorsFor('.bouncer/context/epics/abc-x/index.md'), []);
  // 상위는 유효하고 task 층만 깨진 혼합 경우
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/2/tasks.md'),
    ['bp-063-001', 'epic-063'],
  );
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/explain.md'),
    ['bp-063-001', 'epic-063'],
  );
  ```
- [ ] `npm test`로 그 단언이 실패하는 것을 확인한다.
- [ ] `context-digest.ts`에 `anchorsFor`를 구현하고 `module.exports`에 넣는다.
- [ ] 파생 본문 조립을 앵커 헤딩 → 기존 `extracted` 순서로 바꾼다.
- [ ] 파일 생성 조건을 `if (!extracted) continue;`에서 앵커 헤딩과 `extracted`가 모두 비었을 때만 건너뛰도록 바꾼다.
- [ ] 앵커가 wave 1 문법과 어긋나지 않도록 `graph-search`의 `tokenize`로 단언한다.
  ```js
  const { tokenize } = require('../scripts/lib/graph-search');
  for (const a of anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md')) {
    assert.deepEqual(tokenize(a), [a]);
  }
  ```
- [ ] 절 본문이 전혀 없는 epic `index.md` 픽스처가 파생 파일을 얻고 그 본문이 `## epic-063`을 담는지 단언한다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`를 갱신하고 `npm run check:emit`이 통과하는지 확인한다.
- [ ] `test/session-graph.test.js`의 empty-digest 스킵 케이스를 새 emit 규칙(앵커만 있어도 digest count > 0)에 맞게 고친다. 계층 경로가 있는 화이트리스트 픽스처는 더 이상 “empty skip” 전제가 성립하지 않는다.
- [ ] `npm test`가 통과한다.
