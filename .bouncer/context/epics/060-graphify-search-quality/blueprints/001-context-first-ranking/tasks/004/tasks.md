---
type: bouncer.tasks
title: Graphify 검색 품질 고정 평가
description: 대표 세 질의의 정답 경로와 그래프 fixture로 precision·recall·저신뢰 기준을 회귀 검증한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T12:04:03.162+09:00'
bouncer:
  id: TASKS-004
  epic_id: '060'
  blueprint_id: '001'
  status: ready
  verify: npm run ci
  commit_intent:
    - 검색 전략 변경이 실제 후보 품질을 높였는지 반복 가능한 근거가 없었음
    - 대표 실패 사례와 임계치를 고정해 이후 검색 변경의 효과와 퇴행을 측정함
  affected_paths:
    - test/fixtures/graph-search-quality.json
    - test/graph-search-quality.test.js
    - docs/benchmark/graphify-search-quality.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T12:13:53+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/060-graphify-search-quality
      - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/003
      - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: graph search evaluation precision recall test only generated low confidence benchmark
        result: 88 nodes; generic only, graph, and test symbols expanded across test files
      - graph: context
        status: updated
        query: graph search evaluation precision recall test only generated low confidence benchmark
        result: 10 nodes; epic 060 and tasks 003 and 004 were found
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
light-plan, verification-ledger, graphify-bootstrap 세 사례의 그래프 slice와 사람이 확정한 정답 경로를 고정 corpus로 만들고, `graph-suggest` 결과의 precision·recall·test-only·generated 비율과 저신뢰 판정을 CI에서 검증한다. 평가 문서는 기존 방식의 기준선과 새 방식의 결과, 재현 명령을 함께 남긴다.

```mermaid
flowchart LR
  K[고정 평가 corpus] --> F[역할별 점수화]
  F --> G[신뢰도 판정]
```

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `test/fixtures/graph-search-quality.json`은 사례별 query, seed, source·test·context graph slice, 현재 자연어+BFS+디렉터리 롤업 방식의 후보, 정답 implementation/test 경로를 가진다. 회귀 테스트는 같은 정답과 같은 상위 10개 절단을 사용해 기존 방식과 새 방식 양쪽의 precision·필수 구현 recall을 계산한다.
- 제공: 무연결 test-only 비율은 세 사례의 상위 10개 새 추천을 합친 집합에서 구현 관계가 없는 test 역할 경로 수를 전체 추천 경로 수로 나눈 값이다. 분모가 0이면 통과가 아니라 평가 실패다. generated 수는 같은 합친 집합에서 `exclude_dirs` 아래 경로 수다.
- 제공: `docs/benchmark/graphify-search-quality.md`는 corpus 출처, Graphify 버전, 기존·신규 precision/recall, 신규 test-only·generated 수치, 임계치와 `npm test -- test/graph-search-quality.test.js` 재현법을 기록한다.
- 거부: fixture의 정답 경로가 비거나 실제 후보 역할에 없는 경로를 정답으로 선언하면 테스트가 실패한다. 결과가 임계치를 넘지 못할 때 수치를 숨기거나 low-confidence 사례를 성공 추천으로 바꾸지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `test/fixtures/graph-search-quality.json` — 세 대표 질의의 최소 그래프 slice와 정답 경로를 저장한다.
- Create `test/graph-search-quality.test.js` — epic 성공 기준 1~4·6의 지표와 임계치를 회귀 검사한다.
- Create `docs/benchmark/graphify-search-quality.md` — 기준선·개선 결과·측정 환경·재현 절차를 기록한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `graphify-evaluation.md` — 사용자가 제공한 discovery 원문이며 평가 산출물의 편집 대상으로 삼지 않는다.
- `scripts/src/lib/graph-search.ts` — 임계치 미달을 감추기 위해 생산 검색 알고리즘을 평가 task에서 조정하지 않는다.
- `graphify-out/**` — 로컬 생성 산출물을 fixture 정본이나 커밋 대상으로 사용하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- fixture는 실제 평가에서 필요한 node·link·hyperedge만 최소화하고 원문 context 본문을 복제하지 않는다.
- 임계치는 상위 10개 관련 구현 7개 이상, 구현 recall 80% 이상, 무연결 test-only 10% 이하, generated 0개다.
- 한 사례가 저신뢰 조건을 의도적으로 검증할 때는 빈 추천과 비어 있지 않은 이유를 함께 assertion한다.
- 측정 실패를 문서 서술로 통과시키지 않고 테스트 실패로 남긴다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 세 질의의 source·test·context 그래프 slice, 현재 방식 후보, 정답 implementation/test 경로를 fixture에 고정한다.
- [ ] metric 계산과 임계치 assertion을 먼저 작성하고, 잘못된 후보를 주입했을 때 각각 실패하는지 확인한다.
- [ ] Task 002의 공개 검색 함수를 fixture에 실행해 사례별 상위 후보와 저신뢰 결과를 검증한다.
- [ ] 동일 corpus로 계산한 기존·신규 precision/recall을 나란히 기록하고, 기존 97·36·71 node 결과는 원 실험의 탐색량 보조 지표로만 덧붙인다.
- [ ] `npm test -- test/graph-search-quality.test.js`와 `npm run ci`를 실행해 고정 평가와 전체 회귀를 확인한다.
