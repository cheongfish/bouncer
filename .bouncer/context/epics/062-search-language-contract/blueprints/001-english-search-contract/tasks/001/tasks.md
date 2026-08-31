---
type: bouncer.tasks
title: 컨텍스트 본문과 검색 어휘의 언어 분리
description: 본문은 한국어, description·tags·파생 앵커·검색 질의는 영어 ASCII라는 분리를 하드룰과 authoring 규칙에 적는다.
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T16:19:11.008+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 한국어 라벨은 `graph-suggest` 토크나이저를 통과하지 못해 검색 seed가 만들어지지 않음
    - 본문 언어 의무와 검색 어휘 언어를 분리해 두 규칙이 서로 어긋나지 않게 함
  affected_paths:
    - CLAUDE.md
    - rules/okf.md
    - references/spec-authoring/index.md
    - test/master-rules.test.js
    - test/skill-spec-authoring.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T16:40:00.000+09:00'
    suggested_paths:
      - test/init.test.js
    quality:
      status: ranked
      confidence: medium
      reasons:
        - 'source-only ranking: targets are Markdown rule documents outside config.source_dirs'
        - 'context seeds: 0 labels, 0 paths — context graph has no cross-file edges and no ASCII anchors yet'
        - 'test graph missing: graphify.test_dirs unset'
    candidates:
      implementation:
        - path: test/init.test.js
          score: 5
          confidence: medium
          basis:
            - label and path token match on okf
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'master rules okf frontmatter title description tags language spec-authoring'
        result: '1 implementation candidate: test/init.test.js'
      - graph: test
        status: missing
        query: 'no query ran - graphify.test_dirs is unset so no test scope is built'
        result: 'no test-role candidate is available for this task'
      - graph: context
        status: updated
        query: 'master rules okf frontmatter title description tags language spec-authoring'
        result: '0 label seeds, 0 path seeds'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`graph-suggest`의 토크나이저(`[A-Za-z0-9_./-]`)와 완전 일치 매칭 때문에 한국어 라벨·질의는 seed가 되지 않는다. 지금은 어느 문서도 이 사실을 규칙으로 적지 않아, 작성자가 검색 메타데이터를 한국어로 써도 막히지 않는다.

이 task가 끝나면 하드룰 8과 `references/spec-authoring/index.md`가 같은 분리를 진술한다 — 사람이 읽는 본문은 한국어, 검색에 쓰이는 `description`·`tags`·파생 앵커·질의는 영어 ASCII. `title`은 `.gitmessage` 한국어 명사형 커밋 제목의 원천이므로 명시적 예외로 남는다. `rules/okf.md`의 `title`·`description`·`tags` 항목이 이 예외를 그대로 반복한다.

기존 문서의 일괄 정리는 이 task가 하지 않는다. 규칙은 신규·수정 문서부터 적용되고, 한·영 혼재는 Wave 4까지 허용 상태다.

## Interface
- 제공: 하드룰 8이 "본문 한국어 / 검색 어휘 영어 ASCII"를 한 규칙으로 진술한다. `rules/okf.md`의 「Author-written discovery fields」가 `title`(한국어 유지, 커밋 제목 원천), `description`·`tags`(영어 ASCII) 각각의 언어를 못 박는다. `references/spec-authoring/index.md`의 「Language and prose」가 같은 분리와 적용 시점(신규·수정 문서부터)을 적는다.
- 거부: `title`을 영어로 바꾸라는 진술은 넣지 않는다. `tokenize()` 확장이나 한국어 검색 지원을 여지로 남기는 서술도 넣지 않는다 — 확정 방침은 토크나이저 불변이다.

## Touch
- Modify `CLAUDE.md` — 하드룰 8에 검색 어휘 영어 ASCII 절을 추가하고 본문 한국어 의무와의 경계를 적는다
- Modify `rules/okf.md` — 「Author-written discovery fields」의 `title`·`description`·`tags` 항목에 각 필드의 언어와 `title` 예외 근거를 적는다
- Modify `references/spec-authoring/index.md` — 「Language and prose」에 언어 분리와 신규·수정 문서부터의 적용 범위를 적는다
- Modify `test/master-rules.test.js` — 하드룰 8이 검색 어휘 영어 규칙과 `title` 예외를 담고 있음을 단언한다
- Modify `test/skill-spec-authoring.test.js` — 「Language and prose」의 언어 분리 진술을 단언한다

## Do not touch
- `.gitmessage` — 커밋 제목 규약은 이 wave의 대상이 아니다
- `scripts/src/lib/graph-search.ts` — 토크나이저와 매칭 로직은 불변이다
- `scripts/src/lib/context-digest.ts` — 앵커 생성은 Wave 2다
- `references/stop-slop/` — 산문 규칙이지 검색 메타데이터 규칙이 아니다

## Constraints
- 실행 코드와 게이트 번호는 바꾸지 않는다. 이 task는 규칙 문서와 그 계약 테스트만 건드린다.
- 하드룰 8의 기존 진술(본문 한국어, `stop-slop` 적용, Distill 영어)은 지우지 않고 유지한 채 확장한다.
- 새 규칙을 게이트로 만들지 않는다. 언어 규칙은 하드룰과 authoring 지침 수준이다.
- 세 문서의 진술이 서로 모순되지 않아야 한다 — 같은 필드에 다른 언어를 지시하면 안 된다.
- `CLAUDE.md`는 `test/master-rules.test.js`가 6135 UTF-8 바이트 상한으로 묶는다. 현재 5541바이트라 여유는 594바이트다. 초과하면 하드룰 8을 더 압축한다 — 상한 숫자를 올려 통과시키지 않는다.
- `references/spec-authoring/index.md`의 「Language and prose」에 `stop-slop`의 영어 개요 금지가 사람이 읽는 산문에만 걸리고 파생 앵커·검색 메타데이터에는 걸리지 않는다는 면제를 적는다. `references/stop-slop/` 자체는 고치지 않는다.

## Checklist
- [ ] `test/master-rules.test.js`에 실패 테스트를 먼저 추가한다: 하드룰 8 본문이 세 필드와 예외를 모두 이름으로 담는지 단언한다.

  ```js
  const rule8 = claude.match(/8\. \*\*Context language\*\*[\s\S]*?\n\d+\. /)[0];
  for (const token of ['ASCII', 'description', 'tags', 'title']) {
    assert.ok(rule8.includes(token), `hard rule 8 must name ${token}`);
  }
  ```
- [ ] `test/skill-spec-authoring.test.js`에 실패 테스트를 추가한다: 「Language and prose」 절이 같은 네 이름과 `stop-slop` 면제를 담는지 단언한다.

  ```js
  const section = md.match(/## Language and prose[\s\S]*?\n## /)[0];
  for (const token of ['ASCII', 'description', 'tags', 'title']) {
    assert.ok(section.includes(token), `Language and prose must name ${token}`);
  }
  ```
- [ ] `npm test`로 두 테스트가 실패하는 것을 확인한다.
- [ ] `CLAUDE.md` 하드룰 8을 확장한다 — 본문은 한국어, `description`·`tags`·파생 앵커·`graph-suggest` 질의는 영어 ASCII, `title`은 한국어 커밋 제목 원천이라 예외.
- [ ] `rules/okf.md`의 `title`·`description`·`tags` 항목에 각 필드 언어와 `title` 예외 근거(`.gitmessage` 명사형 제목)를 적는다.
- [ ] `references/spec-authoring/index.md` 「Language and prose」에 같은 분리와 "신규·수정 문서부터 적용, 기존 corpus 일괄 정리는 별도"를 적는다.
- [ ] 같은 절에 `stop-slop` 면제 한 문장을 적는다 — 영어 개요 금지는 사람이 읽는 산문 대상이고, 파생 앵커와 검색 메타데이터는 대상이 아니다.
- [ ] `CLAUDE.md` 바이트 수가 6135 이하인지 확인한다. 초과하면 하드룰 8을 압축하고, `test/master-rules.test.js`의 상한 숫자는 그대로 둔다.
- [ ] `npm test`가 통과한다.
