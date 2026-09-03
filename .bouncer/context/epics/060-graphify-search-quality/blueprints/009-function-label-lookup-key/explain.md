---
type: bouncer.explain
title: 009 explain
description: Explain for 009
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T08:40:41.465+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '060'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9970ec262dd5f60776f2bb0e66e86f19647bcc97
      diff_sha: 87716397160e6b2b1f85be0c3c36c45cdf132040fb0bf68bd68a3ec545fdfb48
      quiz_score: 3/3
      disposition: 3/3 correct — lookupKey scope, trim order, empty-key skip all understood
      recorded_at: '2026-09-04T08:41:25+09:00'
  task_commits:
    - id: '001'
      sha: 9970ec26
---
# Explain

## Background

Graphify는 TypeScript 함수 심볼을 `setupGraphify()`처럼 후행 괄호가 붙은 label로 남긴다. `graph-suggest`의 `tokenize`는 괄호를 구분자로 보고 `setupGraphify`만 seed로 남긴다. 예전 `byLabel`은 소문자화한 문자열을 그대로 키로 썼기 때문에 두 표기가 다른 버킷에 들어가고, 함수명을 seed로 줘도 구현 후보가 비었다. 이 blueprint는 색인과 조회가 같은 `lookupKey`를 거치게 해서 두 표기를 한 키로 모은다. 원본 `label`·`norm_label`과 결과의 `path`·`score`·`confidence`는 그대로 둔다.

## Intuition

전화부에서는 `홍길동`과 `홍길동()`을 같은 사람 칸에 넣고, 명함 표기는 손대지 않는다.

## Code

- `scripts/src/lib/graph-search.ts` — 모듈 내부 `lookupKey` (소문자화 → 후행 `()` 제거 → `trim`). `byLabel` 색인, `labelFiles`, `expandFromSeeds`, context label 비교, `definedFromContext`, test↔source 교차 label 비교가 이 키를 쓴다. `isGenericWord`와 `source_file` 경로는 그대로 `toLowerCase`다.
- `scripts/lib/graph-search.js` — `npm run build` 산출물.
- `test/graph-search.test.js` — 후행 괄호 label ↔ 괄호 없는 seed, 빈 키 `'()'`, `setupGraphify ()` trim 순서.

## Quiz

1. `lookupKey`가 고치는 것은 무엇인가?
   - A) Graphify가 그래프 파일에 쓰는 원본 `label` 문자열
   - B) `byLabel` 색인·조회에 쓰는 키만
   - C) `graphSuggest` 결과의 `path`·`score`·`confidence`

2. `lookupKey`에서 후행 `()`를 깎은 뒤 `trim`하는 이유는?
   - A) `foo ()`와 `foo`를 같은 키로 모으기 위해
   - B) 인자 목록 `foo(a)`까지 지우기 위해
   - C) `isGenericWord`가 괄호 붙은 일반 명사를 걸러 내게 하기 위해

3. label이 `'()'`뿐인 노드를 색인·조회에서 빼는 이유는?
   - A) Graphify가 빈 심볼을 쓰지 않아서
   - B) 정규화 결과가 빈 문자열이면 label 매칭에서 빠지게 하기 위해
   - C) 테스트 그래프에만 있는 특수 규칙이라서

## 이해 상태

- 정답: 1-B, 2-A, 3-B
- 응답: 1-B, 2-A, 3-B
- 채점: 3/3 정답
- disposition: lookupKey 범위·trim 순서·빈 키 스킵을 모두 이해함
- range: develop..9970ec262dd5f60776f2bb0e66e86f19647bcc97
- diff_sha: 87716397160e6b2b1f85be0c3c36c45cdf132040fb0bf68bd68a3ec545fdfb48
