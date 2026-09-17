---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/006-english-search-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T16:46:13.229+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9d64ee1d3944517b7a04718f48970c6eceb6d883
      diff_sha: 411f48b56709721770e62559ee21b8b56452fecf5237b86efaed11710dfc1a4c
      quiz_score: 3/3
      disposition: 세 문항 모두 정답으로 검색 언어·앵커·seed 계약을 이해함
      recorded_at: '2026-08-31T16:46:56+09:00'
---
# Explain

## Background

컨텍스트 문서는 한국어로 읽히지만 `graph-suggest`의 토크나이저와 완전 일치 검색은 영어 ASCII 토큰을 전제로 한다. 이 차이를 규칙으로 고정하지 않으면 작성자가 한국어 description·tags·query를 만들고도 seed가 전혀 생기지 않는 상태가 된다.

이번 blueprint는 구현 로직을 바꾸지 않고 세 경계를 계약으로 만들었다. 검색 메타데이터와 query는 영어 ASCII로, 사람이 읽는 본문과 `title`은 한국어로 유지한다. 이어서 다이제스트가 만들 앵커 문법과 runner의 영어 query·seed 지침을 테스트로 묶었다.

## Intuition

사람을 위한 한국어 설명 위에, 검색기가 정확히 집어낼 수 있는 영어 ASCII 라벨을 덧씌우는 방식임.

## Code

- `CLAUDE.md`, `rules/okf.md`, `references/spec-authoring/index.md`는 본문·title·description·tags·파생 앵커의 언어 책임을 나눠 적는다. 기존 corpus를 한꺼번에 번역하지 않는다는 경계도 함께 둔다.
- `rules/okf.md`는 `epic-<ddd>`, `bp-<ddd>-<ddd>`, `task-<ddd>-<ddd>-<ddd>`를 다이제스트가 생성하는 앵커로 정의한다. 하이픈은 토큰으로 남지만 콜론과 공백은 분리되므로 금지한다.
- `references/graphify-runner/index.md`는 runner가 영어 ASCII 명사 query를 만들고, 이미 ASCII인 경로·심볼·앵커를 seed로 우선 사용하게 한다. `basis[].query`에는 실제 사용한 query가 남는다.
- `test/master-rules.test.js`, `test/skill-spec-authoring.test.js`, `test/graph-search.test.js`, `test/skill-graphify-runner.test.js`가 문서 계약과 토큰 동작을 고정한다.

## Quiz

1. 검색용 `description`과 `tags`에 적용할 언어는 무엇인가?
   - A) 한국어 본문과 같은 한국어
   - B) 영어 ASCII
   - C) 언어 제한 없음

2. `epic:054` 대신 `epic-054`를 쓰는 핵심 이유는 무엇인가?
   - A) 하이픈 형식이 하나의 검색 토큰으로 유지되기 때문
   - B) 숫자를 한국어로 바꿀 수 있기 때문
   - C) 앵커를 사람이 본문에 직접 쓰기 때문

3. graphify-runner가 seed로 우선 사용해야 하는 값은 무엇인가?
   - A) 한국어 blueprint 문장
   - B) 이미 영어 ASCII인 경로·심볼·앵커
   - C) 임의로 번역한 전체 본문

## 이해 상태

정답: 1-B, 2-A, 3-B. 응답도 1-B, 2-A, 3-B이며 세 문항 모두 정답임. 검색 메타데이터의 영어 ASCII 규칙, 하이픈 앵커의 단일 토큰 보존, ASCII seed 우선순위를 이해한 것으로 기록함.

## Tasks

### Task 001

#### Goal & intent

`graph-suggest`의 토크나이저(`[A-Za-z0-9_./-]`)와 완전 일치 매칭 때문에 한국어 라벨·질의는 seed가 되지 않는다. 지금은 어느 문서도 이 사실을 규칙으로 적지 않아, 작성자가 검색 메타데이터를 한국어로 써도 막히지 않는다.

이 task가 끝나면 하드룰 8과 `references/spec-authoring/index.md`가 같은 분리를 진술한다 — 사람이 읽는 본문은 한국어, 검색에 쓰이는 `description`·`tags`·파생 앵커·질의는 영어 ASCII. `title`은 `.gitmessage` 한국어 명사형 커밋 제목의 원천이므로 명시적 예외로 남는다. `rules/okf.md`의 `title`·`description`·`tags` 항목이 이 예외를 그대로 반복한다.

기존 문서의 일괄 정리는 이 task가 하지 않는다. 규칙은 신규·수정 문서부터 적용되고, 한·영 혼재는 Wave 4까지 허용 상태다.

#### Interface

- 제공: 하드룰 8이 "본문 한국어 / 검색 어휘 영어 ASCII"를 한 규칙으로 진술한다. `rules/okf.md`의 「Author-written discovery fields」가 `title`(한국어 유지, 커밋 제목 원천), `description`·`tags`(영어 ASCII) 각각의 언어를 못 박는다. `references/spec-authoring/index.md`의 「Language and prose」가 같은 분리와 적용 시점(신규·수정 문서부터)을 적는다.
- 거부: `title`을 영어로 바꾸라는 진술은 넣지 않는다. `tokenize()` 확장이나 한국어 검색 지원을 여지로 남기는 서술도 넣지 않는다 — 확정 방침은 토크나이저 불변이다.

#### Touch

- Modify `CLAUDE.md` — 하드룰 8에 검색 어휘 영어 ASCII 절을 추가하고 본문 한국어 의무와의 경계를 적는다
- Modify `rules/okf.md` — 「Author-written discovery fields」의 `title`·`description`·`tags` 항목에 각 필드의 언어와 `title` 예외 근거를 적는다
- Modify `references/spec-authoring/index.md` — 「Language and prose」에 언어 분리와 신규·수정 문서부터의 적용 범위를 적는다
- Modify `test/master-rules.test.js` — 하드룰 8이 검색 어휘 영어 규칙과 `title` 예외를 담고 있음을 단언한다
- Modify `test/skill-spec-authoring.test.js` — 「Language and prose」의 언어 분리 진술을 단언한다

#### Constraints

- 실행 코드와 게이트 번호는 바꾸지 않는다. 이 task는 규칙 문서와 그 계약 테스트만 건드린다.
- 하드룰 8의 기존 진술(본문 한국어, `stop-slop` 적용, Distill 영어)은 지우지 않고 유지한 채 확장한다.
- 새 규칙을 게이트로 만들지 않는다. 언어 규칙은 하드룰과 authoring 지침 수준이다.
- 세 문서의 진술이 서로 모순되지 않아야 한다 — 같은 필드에 다른 언어를 지시하면 안 된다.
- `CLAUDE.md`는 `test/master-rules.test.js`가 6135 UTF-8 바이트 상한으로 묶는다. 현재 5541바이트라 여유는 594바이트다. 초과하면 하드룰 8을 더 압축한다 — 상한 숫자를 올려 통과시키지 않는다.
- `references/spec-authoring/index.md`의 「Language and prose」에 `stop-slop`의 영어 개요 금지가 사람이 읽는 산문에만 걸리고 파생 앵커·검색 메타데이터에는 걸리지 않는다는 면제를 적는다. `references/stop-slop/` 자체는 고치지 않는다.

### Task 002

#### Goal & intent

Wave 2는 `context-digest`가 frontmatter와 문서 경로에서 앵커 헤딩을 생성하게 만든다. 그 생성이 어떤 문자열을 찍어야 하는지는 아직 어디에도 없다. 형식을 잘못 고르면 — 콜론(`epic:054`)이나 공백을 쓰면 — 토크나이저가 여러 토큰으로 쪼개고 완전 일치가 실패해 앵커가 무용지물이 된다.

이 task가 끝나면 `rules/okf.md`에 앵커 문법 절이 생겨 `epic-<ddd>`, `bp-<ddd>-<ddd>`, `task-<ddd>-<ddd>-<ddd>` 세 종을 못 박고, 부모 앵커를 자식 문서에 반복하는 것이 계층 소환의 기제임을 적는다. 동시에 `test/graph-search.test.js`가 이 세 문자열이 `graph-suggest` 질의에서 각각 컨텍스트 라벨에 적중하고 콜론 형식은 적중하지 않음을 증명한다.

생성 구현은 여기서 하지 않는다. 이 task는 계약과 그 계약이 실제 검색 엔진에서 성립한다는 증거만 남긴다.

#### Interface

- 제공: `rules/okf.md`에 앵커 문법 절. 세 종의 형식, 허용 문자(`[A-Za-z0-9_./-]`)만 쓴다는 근거, 콜론·공백·한국어 금지, 부모 앵커 반복 규칙을 담는다. `test/graph-search.test.js`에 세 앵커의 단일 토큰 적중과 콜론 형식 불일치를 검증하는 케이스.
- 거부: 앵커를 사람이 쓰는 본문에 직접 넣으라는 지시는 넣지 않는다 — 앵커는 파생 트리에만 존재한다. `tokenize()`의 시그니처와 동작은 바꾸지 않는다 — 이미 export된 함수를 그대로 호출해 검증한다.

#### Touch

- Modify `rules/okf.md` — 앵커 문법 절을 추가한다
- Modify `test/graph-search.test.js` — 세 앵커의 단일 토큰 적중과 콜론 형식 불일치 케이스를 추가한다

#### Constraints

- 앵커 검증은 `scripts/lib/graph-search`가 이미 export하는 `tokenize`를 직접 호출해서 한다. 그래프 픽스처를 새로 만들 필요가 없고, `module.exports` 목록도 바꾸지 않는다.
- 문법에 zero-padded 세 자리 id 규칙(`\d{3}`)을 유지한다 — scaffold가 강제하는 형식과 같아야 한다.
- 규칙 문서는 앵커를 "다이제스트가 생성하는 파생 헤딩"으로 서술한다. 작성자 의무로 적지 않는다.
- 문법 진술과 토큰 동작을 같은 테스트 파일에서 고정한다. `rules/okf.md`를 읽는 다른 테스트(`test/init.test.js`)는 이 task의 범위가 아니다.

### Task 003

#### Goal & intent

`references/graphify-runner/index.md` 3단계는 query를 "blueprint goal + key task nouns"로 만들라고만 한다. 컨텍스트 본문은 한국어이므로 그 지시를 그대로 따르면 한국어 query가 만들어지고, 토크나이저가 전부 버려 seed가 0개가 된다.

이 task가 끝나면 runner 지침이 영어 ASCII query와 영어 seed를 만들도록 지시하고, 앵커·경로처럼 이미 ASCII인 문자열을 seed로 우선 쓰라고 적는다. 기록되는 `basis[].query`도 실제로 쓴 영어 문자열이므로 증적에 같은 어휘가 남는다.

#### Interface

- 제공: `references/graphify-runner/index.md` 3단계와 Guardrails에 질의 언어 규칙. query는 영어 ASCII 명사 위주, seed는 이미 알고 있는 경로·심볼·앵커 문자열 우선. `test/skill-graphify-runner.test.js`가 이 진술의 존재와 한국어 query 예시 부재를 단언한다.
- 거부: 한국어 query를 예시로 남기지 않는다. 토크나이저를 확장하라는 우회 제안도 넣지 않는다.

#### Touch

- Modify `references/graphify-runner/index.md` — 3단계와 Guardrails에 영어 query·seed 규칙을 추가한다
- Modify `test/skill-graphify-runner.test.js` — 영어 질의 규칙 진술과 한국어 query 예시 부재를 단언한다

#### Constraints

- 기존 `basis` 네 필드 계약(`graph`, `status`, `query`, `result`)과 skip 경로 서술을 그대로 둔다 — 언어 규칙만 얹는다.
- 지침에 남는 예시 문자열은 전부 ASCII여야 한다. 설명 산문 자체는 기존 문서 언어를 따른다.
- `suggested_paths`·`affected_paths`에 대한 기존 advisory 경계를 약화시키지 않는다.
