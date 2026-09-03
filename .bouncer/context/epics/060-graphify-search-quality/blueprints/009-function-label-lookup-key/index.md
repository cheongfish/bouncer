---
type: bouncer.blueprint
title: 함수 label 조회 키 정규화
description: Normalizes trailing parenthesis function labels into a shared lookup key so graph-suggest seeds match Graphify code nodes.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/index.md
tags:
  - bouncer
  - blueprint
  - graphify
  - search
  - lookup-key
  - normalization
timestamp: '2026-09-04T08:22:09.462+09:00'
bouncer:
  id: '009'
  epic_id: '060'
  blueprint_id: '009'
  status: approved
  commit_type: fix
  scale: full
  supersedes: []
---
# 함수 label 조회 키 정규화

Epic: [060](../../index.md)

## Intent

- 문제: Graphify의 TypeScript 코드 노드는 함수 심볼을 `setupGraphify()`처럼 후행 괄호를 붙여 기록한다. `graph-suggest`의 질의 토크나이저는 괄호를 구분자로 분리해 `setupGraphify`만 남긴다. `byLabel` 색인과 조회가 모두 소문자화한 정확 일치라서 두 값은 서로 다른 키가 되고, 함수명을 seed로 준 질의는 그 심볼이 그래프에 있어도 구현 후보를 만들지 못한다.
- 완료 조건: 색인과 조회가 같은 정규화 함수를 거쳐 `setupGraphify`와 `setupGraphify()`가 한 키로 만나고, Graphify 원본 `label`과 결과 표시 문자열은 그대로 남는다.

이 blueprint는 조회 키 계산만 바꾸므로 흐름 변경이 아니며, Mermaid 차트를 넣지 않는다.

## Contract

- 인터페이스: `scripts/src/lib/graph-search.ts` 모듈 내부에 조회 전용 순수 함수 `lookupKey(value: unknown): string`을 둔다. 입력을 문자열화하고 소문자화 → 후행 `()` 한 번 제거 → `trim` 순으로 처리한 값을 돌려준다. 괄호 제거를 `trim`보다 먼저 해야 `foo ()`가 `foo`와 같은 키가 된다. 모듈 외부로 내보내지 않는다 — 이는 검색 내부의 키 계산이지 공개 계약이 아니다.
- 데이터·상태: `LoadedGraph.byLabel`의 키 공간만 바뀐다. `GraphNode.label`·`norm_label`·`source_file`, 그래프 파일, `graphSuggest` 결과의 `path`·`score`·`confidence`는 그대로다. 후행 괄호가 있는 label과 없는 label이 같은 키에 모이는 것은 의도된 병합이다.
- 데이터·상태(예외): `basis`는 값이 늘 수 있다. seed 집합에 `setupGraphify`와 `setupGraphify()`가 함께 들어오면 두 표기가 같은 노드로 풀려 `defines unique seed setupGraphify`와 `defines unique seed setupGraphify()`가 모두 쌓인다. `score`는 플래그 기반이라 움직이지 않는다. 이 중복은 허용하되 계약으로 적어 둔다.
- 적용 지점: `byLabel` 색인 생성, `labelFiles` 조회, `expandFromSeeds`의 seed 조회, context 노드의 `label`·`norm_label` seed 비교, `definedFromContext`가 `basis`의 `defines unique seed <seed>`를 `contextSeedLabels`와 대조하는 비교, test↔source 교차 관계에서의 구현 symbol label 비교. 이 여섯 곳이 전부다.
- 적용 지점(양쪽 정규화): 교차 관계 비교와 `definedFromContext`는 `implSpecificLabels`·`contextSeedLabels`에 **원본 label**이 담긴다. 비교의 한쪽만 정규화하면 키 공간이 어긋나므로 집합 원소 쪽도 함께 `lookupKey`를 거쳐야 한다.
- 수용 기준: source 그래프에 `setupGraphify()` 노드가 있을 때 seed `setupGraphify`가 그 노드의 `source_file`을 구현 후보로 만든다. 반대로 후행 괄호 없는 기존 label의 매칭은 하나도 사라지지 않는다.
- 검증 명령: `npm test` (전역 `config.verify`. `pretest`가 `npm run build`를 돌려 `scripts/lib/**` 생성물 동기화까지 함께 검증한다).
- 실패 모드·엣지 케이스:
  - 색인만 정규화하고 조회를 빠뜨리거나 그 반대면 두 키 공간이 어긋나 히트가 오히려 줄어든다. 색인과 조회가 같은 함수를 부르는 것이 이 계약의 핵심이다.
  - label이 `()`뿐이면 정규화 결과가 빈 문자열이다. 빈 키는 색인하지도 조회하지도 않는다 — 빈 키 버킷은 무관한 노드를 한데 묶는 거짓 히트가 된다.
  - `foo(a)`처럼 인자가 있는 표기는 후행 `()`가 아니므로 변하지 않는다. 인자 목록 제거는 이 blueprint가 하지 않는다.
  - `source_file` 경로 비교는 정확 경로·path segment 일치라서 후행 `()` 제거가 경로 의미를 깨뜨린다. 정규화 대상이 아니다.
  - `GENERIC_WORDS` 판정(`isGenericWord`)도 정규화하지 않는다. 다만 이 함수는 seed뿐 아니라 node label로도 호출되므로, `graph()` 같은 label은 일반 명사로 걸러지지 않은 채 `implSpecificLabels`에 들어가고 정규화 후 `graph`와 같은 키를 갖는다. 이는 알려진 잔여 위험이며, 일반 명사 차단 계약을 건드리지 않기 위해 이번에는 그대로 둔다.
  - `lookupKey`가 `trim`을 괄호 제거보다 먼저 하면 `foo ()`가 `foo `로 남아 `foo`와 다른 키가 된다. 순서가 계약이다.

## Out of scope

- Graphify 원본 `label`, `norm_label`, 그래프 파일 스키마의 변경.
- 인자 목록·제네릭·경로 표기 정규화, 의미 검색, relation 확장 범위 확대. 넓은 자연어 질의(`graphify search quality`)가 low-confidence로 남는 것은 이번에 고치지 않는다.
- `.bouncer/config.json`의 `source_dirs` 조정. graphify 스코프 정책은 별개 관심사이며 이 blueprint에 포함하지 않는다.
- `scripts/check-doc-shape.js`와 문서 구조 검사기 관련 파일. 해당 개선은 blueprint 061/004에서 이미 종료됐다.

## One-commit justification

- 정규화 함수 하나와 그것을 부르는 다섯 조회 지점, 그리고 그 동작을 고정하는 회귀 테스트가 서로를 필요로 한다. 색인만 또는 조회만 바꾼 중간 상태는 검색 히트를 되레 떨어뜨리므로 나눠 커밋할 수 없다. 생성물 `scripts/lib/graph-search.js`는 `npm run build` 산출이라 같은 커밋에 함께 들어가야 `check:emit`이 통과한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
