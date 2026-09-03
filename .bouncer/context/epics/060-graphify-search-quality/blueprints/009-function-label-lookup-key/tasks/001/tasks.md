---
type: bouncer.tasks
title: 함수 label 조회 키를 색인과 조회에서 함께 정규화
description: Adds a shared lookupKey helper and applies it to every byLabel index and lookup site with a regression test.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - graphify
  - search
  - lookup-key
timestamp: '2026-09-04T08:22:09.462+09:00'
bouncer:
  id: TASKS-001
  epic_id: '060'
  blueprint_id: '009'
  status: verified
  commit_intent:
    - 'Graphify는 함수 심볼 label에 후행 괄호를 붙이지만 질의 토크나이저는 괄호를 분리해, 같은 함수의 색인 키와 조회 키가 어긋나 구현 후보를 잃고 있음'
    - '색인과 조회가 같은 정규화 함수를 거치게 해 두 표기를 한 키로 모으되, 원본 label과 결과 표시 문자열은 그대로 유지함'
  affected_paths:
    - scripts/src/lib/graph-search.ts
    - scripts/lib/graph-search.js
    - test/graph-search.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T08:30:00.000+09:00'
    suggested_paths:
      - scripts/src/lib/graph-search.ts
    quality:
      status: ranked
      confidence: high
      reasons:
        - 'three seeds (graphSuggest, labelFiles, expandFromSeeds) are all unique to one implementation file, giving score 14'
        - 'relation filter: calls, imports, imports_from (depth <= 2); contains ownership only'
        - 'source scope is scripts/src/lib only, so the generated mirror scripts/lib/graph-search.js cannot be ranked'
        - 'test scope ranks no graph-search test; test/graph-search.test.js was found by a manual importer search instead'
    candidates:
      implementation:
        - path: scripts/src/lib/graph-search.ts
          score: 14
          confidence: high
          basis:
            - defines unique seed graphSuggest
            - defines unique seed labelFiles
            - defines unique seed expandFromSeeds
            - calls relation
            - context hit for same feature
            - implementation path
        - path: scripts/src/lib/graph-scope.ts
          score: 5
          confidence: medium
          basis:
            - calls relation
            - implementation path
        - path: scripts/src/lib/session-graph.ts
          score: 5
          confidence: medium
          basis:
            - calls relation
            - implementation path
      test:
        - path: test/cursor-plugin.test.js
          score: -8
          confidence: low
          basis:
            - seed match label
            - test-only without implementation link
            - contains-only reach
        - path: test/graphify.test.js
          score: -12
          confidence: low
          basis:
            - test-only without implementation link
            - contains-only reach
      context:
        - path: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/index.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
        - path: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/tasks/001/tasks.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
    basis:
      - graph: source
        status: reused
        query: 'graph search label lookup key normalization'
        result: 'scripts/src/lib/graph-search.ts ranks alone at 14 (high); the next tier is 5 and unrelated to label lookup'
      - graph: test
        status: reused
        query: 'graph search label lookup key normalization'
        result: 'no graph-search test ranked; every test hit is negative, so test/graph-search.test.js came from a manual byLabel/labelFiles/expandFromSeeds importer search'
      - graph: context
        status: updated
        query: 'graph search label lookup key normalization'
        result: 'only this blueprint index.md and tasks/001/tasks.md hit at score 4 — no prior blueprint claims label normalization'
---
# Tasks

Blueprint: [009](../../index.md)

## Goal & intent

`graph-suggest`에 함수명을 seed로 주면 그 함수가 source 그래프에 있어도 구현 후보가 나오지 않는다. Graphify는 코드 노드 label을 `setupGraphify()`로 쓰고, `tokenize`는 괄호를 구분자로 분리해 `setupGraphify`만 남기며, `byLabel` 색인과 조회는 소문자화한 정확 일치이기 때문이다.

이 task를 끝내면 `scripts/src/lib/graph-search.ts` 안에서 label을 키로 쓰는 모든 지점이 하나의 정규화 함수를 거친다. `setupGraphify`와 `setupGraphify()`는 같은 조회 키 `setupgraphify`로 만나고, 후행 괄호가 없는 기존 label의 매칭은 그대로 유지된다. 원본 `label`·`norm_label`·`source_file`과 `graphSuggest` 결과의 `path`·`score`·`confidence`는 바뀌지 않는다.

한 가지 예외는 `basis`다. seed 집합에 두 표기가 함께 들어오면 `defines unique seed setupGraphify`와 `defines unique seed setupGraphify()`가 모두 쌓여 항목이 늘 수 있다. `score`는 플래그 기반이라 움직이지 않으므로 이 중복은 허용한다.

수용 기준은 blueprint Contract의 「수용 기준」과 아래 Checklist가 함께 정의하며, 검증 명령은 전역 `config.verify`인 `npm test`다(`pretest`가 `npm run build`를 돌린다).

## Interface

- 제공: 모듈 내부 순수 함수 `lookupKey(value: unknown): string`. 입력을 문자열화하고 소문자화 → 후행 `()` 한 번 제거 → `trim` 순으로 처리한 값을 반환한다. 괄호 제거 뒤에 `trim`해야 `foo ()`가 `foo`와 같은 키가 된다. `export = {}` 목록에 추가하지 않는다 — 조회 내부 계산이지 공개 계약이 아니다.
- 제공: `byLabel` 색인 키와 모든 label 조회 키가 `lookupKey`의 결과로 통일된다. 후행 괄호 유무가 다른 두 표기는 같은 버킷을 가리킨다.
- 거부: `lookupKey`의 결과가 빈 문자열이면 색인하지 않고 조회하지도 않는다. 해당 노드는 label 기반 매칭에서 빠지되 그래프 적재 자체는 실패하지 않는다.
- 거부: 인자를 가진 표기(`foo(a)`)와 중간 괄호는 후행 `()`가 아니므로 변형하지 않고 그대로 키에 남긴다.
- 거부: 원본 `GraphNode.label`·`norm_label`, 그래프 파일, `graphSuggest` 결과의 `path`·`score`·`confidence` 값은 바뀌지 않는다. 정규화는 키 계산에만 존재한다.
- 허용: `basis` 항목은 두 표기가 모두 seed로 들어올 때 중복이 생길 수 있다. 이는 거부 대상이 아니며, 이를 없애려고 `basis` 문자열을 정규화하지 않는다 — 표시 문자열은 원본 표기를 유지한다.

## Touch

- Modify `scripts/src/lib/graph-search.ts` — `lookupKey`를 추가하고, `loadGraphFile`의 `byLabel` 색인 키(현재 `label.toLowerCase()`), `labelFiles`의 조회, `expandFromSeeds`의 seed 조회, context 노드의 `label`·`norm_label` seed 비교, test↔source 교차 관계의 구현 symbol label 비교를 이 함수로 옮긴다. 이 파일이 정본이다.
- Modify `scripts/lib/graph-search.js` — `npm run build`가 만드는 생성물. 손으로 고치지 않고 빌드 결과를 그대로 커밋해 `check:emit` 계약을 지킨다.
- Modify `test/graph-search.test.js` — 후행 괄호 label과 괄호 없는 seed가 같은 구현 후보를 만든다는 회귀 테스트, 빈 키가 색인되지 않는다는 경계 테스트, 그리고 `foo ()`와 `foo`가 같은 키가 되는 `trim` 순서 테스트를 추가한다.

## Do not touch

- `scripts/src/lib/graphify.ts` — Graphify가 label을 만드는 쪽이다. 원본 표기를 고치면 그래프 데이터의 의미가 바뀌므로 검색 쪽에서만 흡수한다.
- `.bouncer/config.json` — `source_dirs` 조정은 별개 관심사이고 이 epic의 후속 blueprint 후보다.
- `scripts/check-doc-shape.js`, `test/master-rules.test.js`, `test/skill-bouncer-init.test.js` — 문서 구조 검사기 영역으로 blueprint 061/004에서 종료됐다.
- `test/graph-search-quality.test.js`, `test/context-digest.test.js` — 이 변경은 기존 label 매칭을 보존하므로 이 테스트들은 수정 없이 통과해야 한다. 통과시키려 이 파일을 고쳐야 한다면 회귀가 생긴 신호다.

## Constraints

- 이 task의 모든 명령은 `/bouncer-execute`가 만드는 실행 worktree(`.worktrees/060/009`) 안에서 돈다. 그 worktree는 base 브랜치에서 갈라지므로 `develop`에 남아 있는 `scripts/lib/graph-search.js` 수기 편집과 `.bouncer/config.json` 변경은 거기에 없다. 아래 Checklist의 되돌리기 단계는 worktree 안에서 확인만 하는 단계다.
- 생성물 `scripts/lib/graph-search.js`를 손으로 고치지 않는다. `npm run build` 산출만 커밋한다.
- `isGenericWord`의 `seed.toLowerCase()` 두 곳과 `source_file` 경로 소문자화에는 `lookupKey`를 적용하지 않는다. 경로 비교는 정확 경로·segment 일치라 괄호 제거가 의미를 깨뜨리고, 일반 명사 차단은 별개 계약이다. `isGenericWord`가 node label로도 호출되어 `graph()` 같은 label이 일반 명사로 걸러지지 않는 잔여 위험은 알고 있으며 이번 범위에서 다루지 않는다.
- 정규화는 후행 `()` 한 번 제거로 끝낸다. 인자 목록 제거, 공백 축약, 제네릭 처리 같은 추가 규칙을 넣지 않는다.
- 새 런타임 의존성이나 정규화 전용 모듈 파일을 만들지 않는다. 함수 하나를 같은 모듈에 둔다.
- 비자명한 의도는 한국어 주석으로 남긴다. 특히 "왜 조회 키에서만 정규화하고 원본 label은 그대로 두는가"를 `lookupKey` 위에 적는다.

## Checklist

- [ ] 실행 worktree 안에서 `git status --short`로 시작 상태를 확인한다. `scripts/lib/graph-search.js`가 수정 상태로 보이면 `git checkout -- scripts/lib/graph-search.js`로 되돌린다. 깨끗하면 그대로 진행한다.
- [ ] `test/graph-search.test.js`에 실패 회귀 테스트를 먼저 추가한다. 기존 `tmpRepo()` 픽스처 패턴을 그대로 쓰고, source 그래프에 후행 괄호 label 노드를 둔다.

  ```js
  { id: 'src::sym', label: 'setupGraphify()', source_file: 'src/lib/graphify.ts' }
  ```

  그리고 괄호 없는 seed가 그 파일을 구현 후보로 만드는지 단언한다.

  ```js
  const result = graphSuggest({ repoRoot: repo, query: 'graphify', seeds: ['setupGraphify'] });
  assert.ok(result.candidates.implementation.some((c) => c.path === 'src/lib/graphify.ts'));
  ```

- [ ] 같은 파일에 빈 키 경계 테스트를 추가한다. label이 `'()'`인 노드가 서로 다른 두 파일에 있을 때 seed `'()'`로 두 파일이 함께 후보가 되지 않아야 한다.
- [ ] 같은 파일에 `trim` 순서 테스트를 추가한다. source label `'setupGraphify ()'`와 seed `'setupGraphify'`가 같은 구현 후보를 만들어야 한다.
- [ ] `npm test`를 돌려 새 테스트 세 건이 **실패**하는 것을 먼저 확인한다.
- [ ] `scripts/src/lib/graph-search.ts`에 `lookupKey`를 추가한다. 괄호 제거를 `trim`보다 먼저 하는 이유와, 원본 label을 그대로 두고 조회 키에서만 정규화하는 이유를 한국어 주석으로 남긴다.

  ```ts
  function lookupKey(value: unknown): string {
    return String(value || '').toLowerCase().replace(/\(\)$/, '').trim();
  }
  ```

- [ ] (1/6) `loadGraphFile`의 `byLabel` 색인을 `lookupKey(label)`로 바꾸고, 결과가 빈 문자열이면 색인하지 않는다.
- [ ] (2/6) `labelFiles`의 `graph.byLabel.get(label.toLowerCase())`를 `graph.byLabel.get(lookupKey(label))`로 바꾼다.
- [ ] (3/6) `expandFromSeeds`의 `graph.byLabel.get(seed.toLowerCase())`를 `graph.byLabel.get(lookupKey(seed))`로 바꾼다.
- [ ] (4/6) context seed 비교에서 `seed`, `node.label`, `node.norm_label`을 각각 `lookupKey`로 비교한다. 같은 블록의 `source_file` 경로 비교는 `toLowerCase()`를 유지한다.
- [ ] (5/6) `definedFromContext`에서 `basis`의 `defines unique seed <seed>`로 뽑아낸 값과 `contextSeedLabels`의 원소를 양쪽 다 `lookupKey`로 비교한다. `contextSeedLabels`에는 원본 label이 들어 있으므로 `Set.has`를 그대로 두면 매칭되지 않는다.
- [ ] (6/6) test↔source 교차 관계에서 `link.target`, `link.source`, `tgt.label`뿐 아니라 **`implSpecificLabels`의 원소 `l` 자체도** `lookupKey`로 정규화해 비교한다. `implSpecificLabels`는 원본 label(`setupGraphify()`)을 담으므로 한쪽만 정규화하면 두 키 공간이 어긋나 오히려 매칭이 사라진다. `some` 콜백 두 곳 모두 해당한다.
- [ ] `isGenericWord`의 두 `seed.toLowerCase()`가 그대로인지 확인한다. 이 지점은 바뀌면 안 된다.
- [ ] `npm test`가 통과하는지 확인한다. `pretest`가 `npm run build`를 돌려 `scripts/lib/graph-search.js`를 다시 만든다.
- [ ] `git add scripts/src/lib/graph-search.ts scripts/lib/graph-search.js test/graph-search.test.js`로 세 파일을 스테이징한 뒤 `npm run check:emit`을 돌린다. 이 검사는 `git diff --exit-code -- scripts/lib`로 **unstaged** 변경만 보므로, 빌드 산출물을 스테이징하기 전에 돌리면 정상 구현에서도 반드시 실패한다.
- [ ] `git status --short`가 Touch에 적힌 세 파일만 보여주는지 확인한다. `/bouncer-commit`이 `affected_paths` 밖의 경로를 막으므로 그 외 파일이 남아 있으면 안 된다.
