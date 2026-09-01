---
type: bouncer.tasks
title: 도메인 태그 라벨 승격
description: Promote non-structural ASCII tags to derived headings so a document's domain vocabulary becomes an exact-match search label.
resource: .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - context-digest
  - search-vocabulary
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: TASKS-003
  epic_id: '063'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 검색 라벨을 완전 일치로 비교하므로 문장형 description은 자연어 질의로 도달할 수 없음
    - 단일 토큰인 tags만이 자연어 질의로 도달 가능한 도메인 어휘 자리임
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - test/context-digest.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T10:00:00.000+09:00'
    suggested_paths:
      - scripts/src/lib/frontmatter.ts
      - scripts/src/lib/graph-exec.ts
      - scripts/src/lib/scaffold.ts
    quality:
      status: ranked
      confidence: low
      reasons:
        - 'importer fan-out: every ranked candidate scored 5 on imports_from into cli.ts, so 26 library files tie and the ranking does not discriminate'
        - 'context seeds: 0 labels, 0 paths — tags are not in the context graph yet, which is what this task changes'
        - 'test graph missing: graphify.test_dirs unset (Wave 3 scope)'
    candidates:
      implementation:
        - path: scripts/src/lib/frontmatter.ts
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
        - path: scripts/src/lib/scaffold.ts
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
        query: 'scripts/src/lib/context-digest.ts tags frontmatter labels rules/okf.md references/spec-authoring/index.md'
        result: '26 tied implementation candidates via importer fan-out; none is the change site'
      - graph: context
        status: reused
        query: 'scripts/src/lib/context-digest.ts tags frontmatter labels rules/okf.md references/spec-authoring/index.md'
        result: '0 seeds'
      - graph: test
        status: missing
        query: 'context-digest tags labels'
        result: 'graphify.test_dirs unset; no test scope graph'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
frontmatter `tags`가 문서의 도메인 검색 어휘가 되고, 다이제스트가 그 값을 헤딩으로
승격한다. `graph-search`는 라벨을 완전 일치로 비교하므로 문장형 `description`은
자연어 질의로 도달할 수 없다. 반면 `context-digest`, `worktree` 같은 단일 토큰 태그는
그대로 맞는다. 따라서 라벨 원천을 `tags` 하나로 고정한다.

scaffold가 모든 문서에 찍는 구조 태그는 승격하면 god label이 된다 — `explain` 75건,
`verification`·`review`·`tasks` 각 213건이다. 제외 대상을 고정 목록으로 두면 scaffold가
종류를 늘릴 때 조용히 어긋나고, `distill`처럼 kind 태그이면서 동시에 도메인 개념인
값을 영영 막는다. 그래서 문서 자신의 `type: bouncer.<kind>`에서 역산한 태그와
`bouncer` 둘만 제외한다. `.bouncer/distill/*.md`처럼 `bouncer.<kind>` 타입이 없는
문서는 `bouncer`만 제외한다.

이 task는 소비 쪽만 넣는다. 작성자가 도메인 태그를 적게 만드는 생산자 규칙은
task 005가 `rules/okf.md`와 `references/spec-authoring/index.md`에 넣는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

## Interface
- 제공: `context-digest.ts`가 `tagLabels(markdown: string): string[]`를 추가로 내보낸다.
  문서의 YAML frontmatter `tags` 목록에서 구조 태그를 뺀 뒤, 토크나이저 문자 집합만으로
  이뤄진 값을 등장 순서대로 중복 제거해 돌려준다.
  ```
  tagLabels('---\ntype: bouncer.epic\ntags:\n  - bouncer\n  - epic\n  - context-digest\n  - distill\n---\n')
    -> ['context-digest', 'distill']
  tagLabels('---\ntype: bouncer.explain\ntags:\n  - bouncer\n  - explain\n  - worktree\n---\n')
    -> ['worktree']
  ```
  제외 규칙은 `bouncer` 하나와 `type` 값에서 `bouncer.` 접두어를 뗀 문자열 하나뿐이다.
  `buildContextDigest`는 결과를 앵커·Touch 경로 헤딩 뒤에 `## <tag>` 줄로 덧붙인다.
- 거부: `tags`가 없거나 배열이 아니면 빈 배열이다. 공백·콜론·한글이 섞인 값, `bouncer`,
  그 문서 자신의 kind 태그, `description`과 `title`은 승격하지 않는다. frontmatter가
  없으면 빈 배열이고, `type`이 없으면 `bouncer`만 제외한 나머지를 승격한다.

## Touch
- Modify `scripts/src/lib/context-digest.ts` — `tagLabels` 추가, 파생 본문에 태그 헤딩 삽입, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `tagLabels` 단언과 파생 본문 통합 단언 추가

## Do not touch
- `scripts/src/lib/scaffold.ts` — scaffold가 찍는 기본 tags는 그대로 두고 소비 쪽에서 거른다
- `rules/okf.md`·`references/spec-authoring/index.md` — 작성 규칙은 task 005가 고친다
- `CLAUDE.md` — 하드룰 8의 언어 분리는 epic 062가 이미 고정했고 이 task는 그것을 좁히지 않는다
- `.bouncer/context/epics/**` — 기존 435개 문서의 tags 값 일괄 정리는 Wave 4다
- `scripts/src/lib/graph-search.ts` — 라벨 매칭 규칙을 바꾸지 않는다

## Constraints
- frontmatter 파싱은 이 파일 안의 최소 구현으로 끝낸다. `tags:` 블록의 `  - value` 줄만 읽고 일반 YAML 파서를 새로 들이지 않는다.
- 제외 대상은 문서의 `type` 값에서 역산한다. 종류 목록을 상수로 복제하지 않는다 — scaffold가 종류를 늘려도 규칙이 따라간다. `bouncer.context_review` → `context_review`처럼 접두어만 떼고 표기를 바꾸지 않는다.
- 승격 판정에 대소문자 변환을 넣지 않는다. `graph-search`가 비교 시점에 소문자화하므로 여기서 값을 바꾸면 원본과 어긋난다.
- 헤딩 순서는 앵커 → Touch 경로 → 태그로 고정한다.

## Checklist
- [ ] `test/context-digest.test.js`에 실패하는 단언을 먼저 추가한다.
  ```js
  const fm = [
    '---', 'type: bouncer.epic', 'tags:',
    '  - bouncer', '  - epic', '  - context-digest', '  - distill',
    '  - 검색', '  - two words', '---', '', '## Success criteria', '1. x', '',
  ].join('\n');
  assert.deepEqual(tagLabels(fm), ['context-digest', 'distill']);
  // 같은 distill 값도 shard 문서에서는 kind 태그가 아니므로 남고, explain 문서에서는
  // explain 이 kind 태그라 걸린다
  const ex = ['---', 'type: bouncer.explain', 'tags:',
    '  - bouncer', '  - explain', '  - worktree', '---', ''].join('\n');
  assert.deepEqual(tagLabels(ex), ['worktree']);
  assert.deepEqual(tagLabels('# no frontmatter\n'), []);
  ```
- [ ] `npm test`로 그 단언이 실패하는 것을 확인한다.
- [ ] `tagLabels`를 구현하고 `module.exports`에 넣는다.
- [ ] `buildContextDigest`가 태그 헤딩을 앵커·경로 헤딩 뒤에 붙이는지 픽스처로 단언한다.
- [ ] `npm run build`로 `scripts/lib/context-digest.js`를 갱신하고 `npm run check:emit`이 통과하는지 확인한다.
- [ ] `npm test`가 통과한다.
