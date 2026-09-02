---
type: bouncer.tasks
title: 검색 앵커 문법 고정
description: 파생 앵커 문법을 epic-<ddd> / bp-<ddd>-<ddd> / task-<ddd>-<ddd>-<ddd>로 고정하고 단일 토큰 적중을 테스트로 묶는다.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/006-english-search-contract/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T16:19:11.045+09:00'
bouncer:
  id: TASKS-002
  epic_id: '060'
  blueprint_id: '006'
  status: verified
  commit_intent:
    - Wave 2가 생성할 앵커의 문법이 정해지지 않아 생성 구현이 형식을 임의로 고를 수 있었음
    - 앵커가 단일 토큰으로 유지되어야 완전 일치 매칭이 성립하므로 문법을 계약으로 못 박음
  affected_paths:
    - rules/okf.md
    - test/graph-search.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T16:40:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'result explosion: 442 candidates (>= 50) — token context matched 432 context paths'
        - 'context seeds: 479 labels, 432 paths but no ranked candidate survived'
        - 'test graph missing: graphify.test_dirs unset'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'okf anchor tokenize graph-search context digest label'
        result: 'explosion, no ranked candidate'
      - graph: test
        status: missing
        query: 'no query ran - graphify.test_dirs is unset so no test scope is built'
        result: 'no test-role candidate is available for this task'
      - graph: context
        status: updated
        query: 'okf anchor tokenize graph-search context digest label'
        result: '479 label seeds, 432 path seeds, no survivor'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
Wave 2는 `context-digest`가 frontmatter와 문서 경로에서 앵커 헤딩을 생성하게 만든다. 그 생성이 어떤 문자열을 찍어야 하는지는 아직 어디에도 없다. 형식을 잘못 고르면 — 콜론(`epic:054`)이나 공백을 쓰면 — 토크나이저가 여러 토큰으로 쪼개고 완전 일치가 실패해 앵커가 무용지물이 된다.

이 task가 끝나면 `rules/okf.md`에 앵커 문법 절이 생겨 `epic-<ddd>`, `bp-<ddd>-<ddd>`, `task-<ddd>-<ddd>-<ddd>` 세 종을 못 박고, 부모 앵커를 자식 문서에 반복하는 것이 계층 소환의 기제임을 적는다. 동시에 `test/graph-search.test.js`가 이 세 문자열이 `graph-suggest` 질의에서 각각 컨텍스트 라벨에 적중하고 콜론 형식은 적중하지 않음을 증명한다.

생성 구현은 여기서 하지 않는다. 이 task는 계약과 그 계약이 실제 검색 엔진에서 성립한다는 증거만 남긴다.

## Interface
- 제공: `rules/okf.md`에 앵커 문법 절. 세 종의 형식, 허용 문자(`[A-Za-z0-9_./-]`)만 쓴다는 근거, 콜론·공백·한국어 금지, 부모 앵커 반복 규칙을 담는다. `test/graph-search.test.js`에 세 앵커의 단일 토큰 적중과 콜론 형식 불일치를 검증하는 케이스.
- 거부: 앵커를 사람이 쓰는 본문에 직접 넣으라는 지시는 넣지 않는다 — 앵커는 파생 트리에만 존재한다. `tokenize()`의 시그니처와 동작은 바꾸지 않는다 — 이미 export된 함수를 그대로 호출해 검증한다.

## Touch
- Modify `rules/okf.md` — 앵커 문법 절을 추가한다
- Modify `test/graph-search.test.js` — 세 앵커의 단일 토큰 적중과 콜론 형식 불일치 케이스를 추가한다

## Do not touch
- `scripts/src/lib/graph-search.ts` — `tokenize()`와 매칭 로직, export 목록은 불변이다
- `scripts/src/lib/context-digest.ts` — 앵커 생성은 Wave 2다
- `scripts/src/lib/scaffold.ts` — 앵커는 scaffold가 찍는 값이 아니다

## Constraints
- 앵커 검증은 `scripts/lib/graph-search`가 이미 export하는 `tokenize`를 직접 호출해서 한다. 그래프 픽스처를 새로 만들 필요가 없고, `module.exports` 목록도 바꾸지 않는다.
- 문법에 zero-padded 세 자리 id 규칙(`\d{3}`)을 유지한다 — scaffold가 강제하는 형식과 같아야 한다.
- 규칙 문서는 앵커를 "다이제스트가 생성하는 파생 헤딩"으로 서술한다. 작성자 의무로 적지 않는다.
- 문법 진술과 토큰 동작을 같은 테스트 파일에서 고정한다. `rules/okf.md`를 읽는 다른 테스트(`test/init.test.js`)는 이 task의 범위가 아니다.

## Checklist
- [ ] `test/graph-search.test.js`에 실패 테스트를 추가한다: 세 앵커가 `tokenize()`에서 각각 길이 1의 토큰 배열로 남고, 콜론 형식은 두 토큰으로 쪼개짐을 단언한다.

  ```js
  const { tokenize } = require('../scripts/lib/graph-search');
  for (const anchor of ['epic-054', 'bp-054-003', 'task-054-003-002']) {
    assert.deepStrictEqual(tokenize(anchor), [anchor]);
  }
  assert.deepStrictEqual(tokenize('epic:054'), ['epic', '054']);
  ```
- [ ] 같은 파일에 `rules/okf.md`가 세 앵커 형식과 콜론 금지 근거를 담는지 단언하는 실패 테스트를 추가한다.

  ```js
  const okf = fs.readFileSync(path.join(__dirname, '..', 'rules/okf.md'), 'utf8');
  for (const form of ['epic-<ddd>', 'bp-<ddd>-<ddd>', 'task-<ddd>-<ddd>-<ddd>']) {
    assert.ok(okf.includes(form), `okf.md must state ${form}`);
  }
  ```
- [ ] `npm test`로 새 케이스가 실패하는 것을 확인한다.
- [ ] `rules/okf.md`에 앵커 문법 절을 추가한다 — 세 형식, 허용 문자 근거, 콜론·공백 금지, 부모 앵커 반복.

  ```
  epic-<ddd>
  bp-<ddd>-<ddd>
  task-<ddd>-<ddd>-<ddd>
  ```
- [ ] 규칙 문서가 앵커 생성 주체를 다이제스트로 지목하고, 구현이 Wave 2임을 적었는지 확인한다.
- [ ] `npm test`가 통과한다.
