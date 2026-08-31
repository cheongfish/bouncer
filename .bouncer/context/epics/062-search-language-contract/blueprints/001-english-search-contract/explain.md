---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T16:46:13.229+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '062'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9d64ee1d3944517b7a04718f48970c6eceb6d883
      diff_sha: 411f48b56709721770e62559ee21b8b56452fecf5237b86efaed11710dfc1a4c
      quiz_score: '3/3'
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
