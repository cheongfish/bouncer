---
type: bouncer.tasks
title: Touch 경로 헤딩 승격
description: Promote each tokenizer-safe file path in a task brief's Touch section to a derived heading so a path query bridges context hits to source implementation candidates.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/007-derived-anchors-and-coverage/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - context-digest
  - path-seed
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: TASKS-002
  epic_id: '060'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - task 문서가 이미 선언한 파일 경로가 다이제스트에서 버려져 컨텍스트와 코드가 이어지지 않음
    - 경로 토큰은 토크나이저가 통째로 보존하므로 context와 source를 잇는 가장 확실한 seed임
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - test/context-digest.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T10:00:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'result explosion: 162 candidates (>= 50) — the query words touch, path, headings are generic across the corpus'
        - 'context seeds: 0 labels, 0 paths — Touch paths are exactly what this task adds to the graph'
        - 'test graph missing: graphify.test_dirs unset (Wave 3 scope)'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'scripts/src/lib/context-digest.ts touch path headings'
        result: 'low-confidence: 162 candidates, no ranked suggestion'
      - graph: context
        status: reused
        query: 'scripts/src/lib/context-digest.ts touch path headings'
        result: '0 seeds'
      - graph: test
        status: missing
        query: 'context-digest touch paths'
        result: 'graphify.test_dirs unset; no test scope graph'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`tasks/<NNN>/tasks.md`의 `## Touch`에 적힌 파일 경로가 파생 문서에서 헤딩 한 줄이 된다.
토크나이저가 `/` `.` `-` `_`를 보존하므로 `scripts/src/lib/context-digest.ts` 같은 경로는
질의에서 토큰 하나로 남고, 그 토큰이 context 노드 라벨과 source 그래프의 `source_file`
양쪽에 동시에 맞는다. 지금은 205쌍의 Touch가 통째로 버려져 이 통로가 없다.

Touch 줄은 `- Modify \`path\` — 이유` 형태라 동사·한국어 설명이 섞인다. 백틱 스팬만
후보로 보고 그중 토크나이저 문자 집합만으로 이뤄진 것을 남긴다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

## Interface
- 제공: `context-digest.ts`가 `touchPathHeadings(markdown: string): string[]`를 추가로
  내보낸다. 문서 전체를 받아 `## Touch` 절만 보고, 등장 순서대로 중복을 제거한 경로
  배열을 돌려준다.
  ```
  touchPathHeadings('## Touch\n- Modify `scripts/src/lib/a.ts` — 이유\n- Create `test/a.test.js` — 이유\n')
    -> ['scripts/src/lib/a.ts', 'test/a.test.js']
  ```
  `buildContextDigest`는 `tasks.md` 대상에서만 이 결과를 앵커 헤딩 뒤에 `## <path>` 줄로
  덧붙인다.
- 거부: `## Touch` 절이 없으면 빈 배열이다. 백틱 밖의 문자열은 후보가 아니다. 백틱
  안이라도 `/^[A-Za-z0-9_./-]+$/`에 맞지 않으면 버린다 — 꺾쇠·콜론이 들어간 스캐폴드 자리표시자,
  한국어가 섞인 값, 공백을 포함한 값이 여기서 걸린다. `tasks.md` 이외의 문서에는
  적용하지 않는다.

## Touch
- Modify `scripts/src/lib/context-digest.ts` — `touchPathHeadings` 추가, `tasks.md` 파생 본문에 경로 헤딩 삽입, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `touchPathHeadings` 단언과 파생 본문 통합 단언 추가

## Do not touch
- `scripts/src/lib/graph-search.ts` — 경로 토큰 규칙은 이미 존재하고 이 task는 그 규칙에 맞춰 라벨을 만들 뿐이다
- `scripts/src/lib/validate-structural.ts` — Touch와 `affected_paths`의 G11 대응은 이 task의 범위가 아니다
- `.bouncer/context/epics/**` — 기존 Touch 절 본문을 고치지 않는다

## Constraints
- 경로 문자열을 정규화하지 않는다. 문서에 적힌 그대로 헤딩으로 만든다.
- 절 경계 판정은 기존 `extractSections`와 같은 규칙(`^##\s`)을 쓰고 별도 파서를 만들지 않는다.
- `## Touch` 이외의 절에 있는 백틱 경로는 승격하지 않는다. `Do not touch`의 보호 경로가 검색 후보로 올라오면 안 된다.
- 앵커 헤딩(task 001)과 경로 헤딩의 순서를 앵커 먼저로 고정한다.

## Checklist
- [ ] `test/context-digest.test.js`에 실패하는 단언을 먼저 추가한다.
  ```js
  const md = [
    '## Touch',
    '- Modify `scripts/src/lib/a.ts` — 이유',
    '- Create `test/a.test.js` — 이유',
    '- Modify `<PLACEHOLDER: file>` — 자리표시자',
    '- Modify `한글 경로.md` — 비ASCII',
    '',
    '## Do not touch',
    '- `scripts/src/lib/secret.ts` — 보호',
  ].join('\n');
  assert.deepEqual(touchPathHeadings(md), ['scripts/src/lib/a.ts', 'test/a.test.js']);
  assert.deepEqual(touchPathHeadings('## Goal & intent\n- 없음\n'), []);
  ```
- [ ] `npm test`로 그 단언이 실패하는 것을 확인한다.
- [ ] `touchPathHeadings`를 구현하고 `module.exports`에 넣는다.
- [ ] `buildContextDigest`에서 `tasks.md` 대상일 때만 경로 헤딩을 앵커 뒤에 덧붙인다.
- [ ] 실제 `tasks.md` 픽스처로 파생 본문이 `## task-063-001-002` 다음에 `## scripts/src/lib/a.ts`를 담는지 단언한다.
- [ ] epic·blueprint `index.md` 픽스처에는 경로 헤딩이 생기지 않는지 단언한다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`를 갱신하고 `npm run check:emit`이 통과하는지 확인한다.
- [ ] `npm test`가 통과한다.
