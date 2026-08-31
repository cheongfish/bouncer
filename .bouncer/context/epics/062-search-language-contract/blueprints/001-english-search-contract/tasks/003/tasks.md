---
type: bouncer.tasks
title: graphify-runner 영어 질의 지침
description: graph-suggest query와 seed를 영어 ASCII로 생성하도록 runner 지침을 고치고 계약 테스트로 고정한다.
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T16:19:11.078+09:00'
bouncer:
  id: TASKS-003
  epic_id: '062'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - runner가 질의 언어를 지시하지 않아 한국어 blueprint 목표가 그대로 query가 될 수 있었음
    - 토크나이저가 한국어를 버리므로 질의 생산자를 영어 어휘로 묶어 소비자와 어휘를 맞춤
  affected_paths:
    - references/graphify-runner/index.md
    - test/skill-graphify-runner.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T16:40:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'no implementation candidates: targets are a reference document and its contract test'
        - 'context seeds: 0 labels, 0 paths'
        - 'test graph missing: graphify.test_dirs unset'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: 'graphify-runner graph-suggest query seed scope_evidence basis'
        result: 'no implementation candidate'
      - graph: test
        status: missing
        query: 'no query ran - graphify.test_dirs is unset so no test scope is built'
        result: 'no test-role candidate is available for this task'
      - graph: context
        status: updated
        query: 'graphify-runner graph-suggest query seed scope_evidence basis'
        result: '0 label seeds, 0 path seeds'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`references/graphify-runner/index.md` 3단계는 query를 "blueprint goal + key task nouns"로 만들라고만 한다. 컨텍스트 본문은 한국어이므로 그 지시를 그대로 따르면 한국어 query가 만들어지고, 토크나이저가 전부 버려 seed가 0개가 된다.

이 task가 끝나면 runner 지침이 영어 ASCII query와 영어 seed를 만들도록 지시하고, 앵커·경로처럼 이미 ASCII인 문자열을 seed로 우선 쓰라고 적는다. 기록되는 `basis[].query`도 실제로 쓴 영어 문자열이므로 증적에 같은 어휘가 남는다.

## Interface
- 제공: `references/graphify-runner/index.md` 3단계와 Guardrails에 질의 언어 규칙. query는 영어 ASCII 명사 위주, seed는 이미 알고 있는 경로·심볼·앵커 문자열 우선. `test/skill-graphify-runner.test.js`가 이 진술의 존재와 한국어 query 예시 부재를 단언한다.
- 거부: 한국어 query를 예시로 남기지 않는다. 토크나이저를 확장하라는 우회 제안도 넣지 않는다.

## Touch
- Modify `references/graphify-runner/index.md` — 3단계와 Guardrails에 영어 query·seed 규칙을 추가한다
- Modify `test/skill-graphify-runner.test.js` — 영어 질의 규칙 진술과 한국어 query 예시 부재를 단언한다

## Do not touch
- `scripts/src/lib/graph-search.ts` — 질의 처리 로직은 불변이다
- `skills/bouncer-plan/SKILL.md` — 6단계 표시·확인 절차는 이 task 대상이 아니다
- `references/spec-authoring/index.md` — 본문 언어 규칙은 task 001이 다룬다

## Constraints
- 기존 `basis` 네 필드 계약(`graph`, `status`, `query`, `result`)과 skip 경로 서술을 그대로 둔다 — 언어 규칙만 얹는다.
- 지침에 남는 예시 문자열은 전부 ASCII여야 한다. 설명 산문 자체는 기존 문서 언어를 따른다.
- `suggested_paths`·`affected_paths`에 대한 기존 advisory 경계를 약화시키지 않는다.

## Checklist
- [ ] `test/skill-graphify-runner.test.js`에 실패 테스트를 추가한다: 지침이 영어 query·seed를 지시하는지 단언한다.

  ```js
  assert.match(md, /ASCII/);
  assert.match(md, /--seed/);
  ```
- [ ] 같은 파일에 문서의 query 예시 문자열에 한글이 없음을 단언하는 케이스를 추가한다.

  ```js
  assert.doesNotMatch(md, /--query "[^"]*[\uAC00-\uD7A3]/);
  ```
- [ ] `npm test`로 새 케이스가 실패하는 것을 확인한다.
- [ ] `references/graphify-runner/index.md` 3단계에 영어 ASCII query 생성 규칙과 ASCII 예시를 넣는다.
- [ ] 같은 문서 Guardrails에 seed 우선순위(경로·심볼·앵커 문자열)와 한국어 query 금지를 한 줄로 적는다.
- [ ] `npm test`가 통과한다.
