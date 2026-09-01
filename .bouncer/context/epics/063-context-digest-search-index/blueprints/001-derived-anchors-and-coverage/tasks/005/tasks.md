---
type: bouncer.tasks
title: 태그 검색 어휘 작성 규칙
description: State in okf and spec-authoring that frontmatter tags are the domain search vocabulary consumed by context-digest, with a single-token ASCII shape, and pin both statements with assertions.
resource: .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
  - search-vocabulary
  - authoring-rule
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: TASKS-005
  epic_id: '063'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 도메인 태그를 가진 epic이 62건 중 6건뿐이라 태그 라벨 소비 코드가 대부분의 문서에서 빈손이 됨
    - tags가 검색 어휘라는 사실과 토큰 모양 제약을 작성 규칙에 적어 생산자를 만듦
  affected_paths:
    - rules/okf.md
    - references/spec-authoring/index.md
    - test/skill-spec-authoring.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T10:00:00.000+09:00'
    suggested_paths:
      - test/init.test.js
    quality:
      status: ranked
      confidence: low
      reasons:
        - 'the targets are Markdown rule documents outside config.source_dirs, so source ranking cannot reach them'
        - 'context seeds: 0 labels, 0 paths — rules/ and references/ are not in config.context_dirs'
        - 'test graph missing: graphify.test_dirs unset (Wave 3 scope)'
    candidates:
      implementation:
        - path: test/init.test.js
          score: 5
          confidence: low
          basis:
            - label and path token match on okf
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'rules/okf.md references/spec-authoring/index.md tags domain vocabulary search label'
        result: '1 low-confidence candidate: test/init.test.js (reads okf.md for unrelated wording)'
      - graph: context
        status: reused
        query: 'rules/okf.md references/spec-authoring/index.md tags domain vocabulary search label'
        result: '0 seeds — rule documents are outside context_dirs'
      - graph: test
        status: missing
        query: 'okf tags authoring rule'
        result: 'graphify.test_dirs unset; no test scope graph'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
task 003이 `tags`를 검색 라벨로 승격시키지만, 지금 도메인 태그를 가진 epic은 62건 중
6건뿐이고 나머지는 scaffold 기본 태그 두 개뿐이다. 작성 규칙이 tags를 "작은 안정적
어휘"라고만 말하고 그것이 검색 라벨이 된다는 사실도, 단일 토큰이어야 한다는 제약도
적지 않기 때문이다.

`rules/okf.md`의 `tags` 항목과 `references/spec-authoring/index.md`의
「Language and prose」가 이 두 가지를 진술하게 만든다. 그러면 이후 계획하는 문서는
스스로 검색 가능한 도메인 어휘를 갖는다. 기존 435개 문서의 tags 일괄 정리는 하지
않는다 — Wave 4가 맡는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

## Interface
- 제공: `rules/okf.md`의 `tags` 항목이 세 가지를 진술한다. ① tags는
  `context-digest`가 파생 헤딩으로 승격하는 `graph-suggest` 검색 어휘다 ② 각 항목은
  `[A-Za-z0-9_./-]`만으로 이뤄진 영어 ASCII 단일 토큰이다 ③ `bouncer`와 그 문서
  자신의 종류 태그는 승격되지 않으므로 도메인 태그를 2~5개 더 적는다.
- 제공: `references/spec-authoring/index.md`「Language and prose」가 같은 의무를
  작성 시점의 지침으로 진술하고, 무엇이 도메인 태그인지 예를 든다.
- 거부: 기존 언어 계약 문장(영어 ASCII 의무, 한국어 `title` 예외, 코퍼스 일괄 재작성
  금지)을 지우거나 약화하지 않는다. tags 진술만 확장한다. 새 게이트 코드나 검증
  규칙을 추가하지 않는다 — 이 규칙은 작성 지침이지 게이트가 아니다.

## Touch
- Modify `rules/okf.md` — `tags` 항목을 검색 어휘 계약으로 다시 쓰고, 「Derived context-digest anchors」의 미래 시제 문장을 현재 시제로 바꾼다
- Modify `references/spec-authoring/index.md` — 「Language and prose」에 도메인 태그 작성 지침을 넣는다
- Modify `test/skill-spec-authoring.test.js` — 두 문서의 tags 진술을 단언으로 고정한다

## Do not touch
- `CLAUDE.md` — 하드룰 8의 언어 분리는 epic 062가 고정했고 이 task는 그것을 좁히지 않는다
- `scripts/src/lib/validate-structural.ts` — tags 규칙을 S 코드로 강제하지 않는다
- `scripts/src/lib/scaffold.ts` — 기본 tags 생성은 그대로 둔다
- `.bouncer/context/epics/**` — 기존 문서의 tags 값을 고치지 않는다

## Constraints
- `test/skill-spec-authoring.test.js:71`의 기존 단언 `/tags[\s\S]{0,120}English ASCII/i`가 계속 통과해야 한다. 문장 사이에 120자를 넘는 삽입을 넣지 않는다.
- `test/init.test.js:432`가 `rules/okf.md`에서 금지 어휘를 검사하므로 `superpowers`·`methodology.profile`·`profile-aware`를 새 문장에 쓰지 않는다.
- 두 문서의 진술은 같은 필드 목록과 같은 문자 집합을 말해야 한다. 한쪽만 고치면 계약이 갈라진다.
- 예로 드는 태그는 승격 필터를 통과하는 값이어야 한다. 현재 `rules/okf.md`가 드는 `verification`은 213개 문서의 종류 태그라 그 문서들에서 라벨이 되지 않으므로 예시에서 뺀다. `worktree`, `context-digest`, `graph-suggest`를 쓴다.
- `rules/okf.md:86`의 "Wave 2 context-digest **will** generate…"는 이 blueprint가 Wave 2이므로 현재 시제로 바꾼다. 앵커 문법 자체는 건드리지 않는다.

## Checklist
- [ ] `test/skill-spec-authoring.test.js`에 실패하는 단언을 먼저 추가한다.
  `language`는 기존 테스트(`test/skill-spec-authoring.test.js:66-75`)가
  `md.match(/^## Language and prose\n[\s\S]*?(?=^## )/m)[0]`로 만든 지역 변수다.
  spec-authoring 단언은 그 테스트 본문에 이어 붙이고, `rules/okf.md` 단언은 okf를
  직접 읽는 새 테스트로 추가한다.
  ```js
  // 기존 'Language and prose' 테스트 안에 이어 붙인다
  assert.match(language, /tags[\s\S]{0,300}domain/i);

  // 새 테스트
  test('okf states tags are the domain search vocabulary', () => {
    const okf = fs.readFileSync(path.join(root, 'rules/okf.md'), 'utf8');
    assert.match(okf, /tags[\s\S]{0,300}(search label|search vocabulary|graph-suggest)/i);
    assert.match(okf, /\[A-Za-z0-9_\.\/-\]/);
    assert.doesNotMatch(okf, /Wave 2 context-digest will generate/);
  });
  ```
- [ ] `npm test`로 그 단언이 실패하는 것을 확인한다.
- [ ] `rules/okf.md`의 `tags` 항목을 Interface의 세 진술로 고쳐 쓰고, 예시 태그에서 `verification`을 뺀다.
- [ ] `rules/okf.md`「Derived context-digest anchors」의 미래 시제 문장을 현재 시제로 바꾼다.
- [ ] `references/spec-authoring/index.md`「Language and prose」에 도메인 태그 지침 항목을 넣는다.
- [ ] 기존 단언이 여전히 통과하는지 확인한다.
  ```bash
  node --test test/skill-spec-authoring.test.js test/master-rules.test.js test/init.test.js
  ```
- [ ] `npm test`가 통과한다.
