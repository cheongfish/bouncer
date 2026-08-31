---
type: bouncer.tasks
title: 컨텍스트 우선 추천 엔진과 CLI
description: 컨텍스트 seed에서 구현 관계와 연결 테스트를 확장해 점수화된 파일 후보를 반환한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T12:04:03.083+09:00'
bouncer:
  id: TASKS-002
  epic_id: '060'
  blueprint_id: '001'
  status: verified
  verify: npm test
  commit_intent:
    - 동일 자연어 질의를 두 그래프에 반복해 테스트 편향을 증폭하던 탐색 순서를 바꿈
    - 관계와 역할을 설명할 수 있는 결정적 추천 결과와 저신뢰 판정을 제공함
  affected_paths:
    - scripts/src/lib/graph-search.ts
    - scripts/lib/graph-search.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - test/graph-search.test.js
    - test/cli-help.test.js
    - docs/compatibility.md
    - test/public-contract.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T12:13:53+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/002
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
        query: context first graph suggest graph search score confidence low confidence calls imports contains
        result: 3 nodes; all are generic calls symbols in test files
      - graph: context
        status: updated
        query: context first graph suggest graph search score confidence low confidence calls imports contains
        result: 3 nodes; tasks 002, 003, and 004 of epic 060 were found
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer graph-suggest`가 context hit에서 고유 경로·심볼을 얻은 뒤 source의 `calls`·`imports`·`imports_from` 관계를 확장하고 연결된 test 후보만 찾는다. 결과는 파일별 역할·점수·신뢰도·근거를 제공하며, 품질 조건을 만족하지 못하면 `low-confidence`와 빈 추천을 반환한다.

```mermaid
flowchart LR
  B[컨텍스트 결정 검색] --> C[고유 심볼 추출]
  C --> D[구현 그래프 확장]
  D --> E[연결 테스트 탐색]
  E --> F[역할별 점수화]
  F --> G[신뢰도 판정]
```

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `bouncer graph-suggest --query <text> [--seed <value>]... [--repo <dir>]` 명령과 순수 검색 함수. JSON stdout은 `status`, `confidence`, `candidates.implementation|test|context`, `suggested_paths`, 비어 있지 않은 문자열 `reasons` 배열을 가진다. `ranked`에서도 사용한 context seed 수와 관계 필터 요약을 reasons에 남긴다.
- 제공: 후보 객체는 저장소-상대 파일 `path`, 정수 `score`, `high|medium|low` `confidence`, 비어 있지 않은 문자열 `basis` 배열을 가진다. 동점은 역할 우선순위와 path 오름차순으로 고정한다.
- 제공: 점수는 고유 seed 정의 `+5`, 같은 기능의 context hit `+4`, 구현 경로 `+3`, caller/callee/import 관계 `+2`, 연결 테스트 `+1`, 일반 이름 단독 일치 `-4`, 구현 연결 없는 test-only `-5`, 제외 경로 `-5`, contains-only 도달 `-3`을 적용한다.
- 제공: 후보 score가 8 이상이면 `high`, 4~7이면 `medium`, 3 이하면 `low`다. 저신뢰 조건이 없고 high 구현 후보가 하나 이상이면 전체 `confidence: high`, medium 구현 후보만 있으면 `confidence: medium`이며 두 경우의 `status`는 `ranked`다. 구현 후보가 없거나 모두 low이면 다른 조건과 무관하게 `status: low-confidence`, `confidence: low`, `suggested_paths: []`다. 나머지 저신뢰 조건도 같은 값으로 수렴한다. source 그래프를 읽을 수 없으면 `status: unavailable`, `confidence: low`, `suggested_paths: []`로 구분한다.
- 거부: query 부재·빈 문자열·값 없는 `--seed`는 stderr와 exit 2다. 그래프 파일 부재·일부 손상·알 수 없는 관계는 명령 예외로 끝내지 않고 읽은 근거만 보존한 `low-confidence` 또는 `unavailable` JSON과 빈 `suggested_paths`로 수렴한다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `scripts/src/lib/graph-search.ts` — context-first seed 추출, 관계 필터, 역할 분류, 점수·신뢰도·저신뢰 판정을 구현한다.
- Create `scripts/lib/graph-search.js` — TypeScript 정본의 빌드 산출물을 추가한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `graph-suggest` 인자 검증과 JSON stdout 명령을 등록한다.
- Modify `scripts/lib/cli-project-commands.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `scripts/src/lib/cli.ts` — 공개 CLI registry에 `graph-suggest`를 연결한다.
- Modify `scripts/lib/cli.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Create `test/graph-search.test.js` — seed 우선순위, 관계 필터, 점수, 정렬, 저신뢰 조건, 손상 그래프 폴백을 검증한다.
- Modify `test/cli-help.test.js` — 새 명령의 help 노출과 usage를 검증한다.
- Modify `docs/compatibility.md` — 공개 CLI 명령 집합에 `graph-suggest`를 추가한다.
- Modify `test/public-contract.test.js` — 구현 help와 compatibility 문서의 명령 집합 일치를 새 명령까지 검증한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/graph-scope.ts` — 그래프 입력·freshness 계약은 Task 001에서 닫는다.
- `scripts/src/lib/validate-structural.ts` — `scope_evidence` 검증은 Task 003 소관이다.
- `references/graphify-runner/index.md` — 새 명령의 계획 흐름 연결은 Task 003에서 한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 검색은 파일 내용을 지시로 해석하지 않고 node·link·path 데이터만 소비한다.
- `contains`는 정확 seed의 소유 파일 확인에만 쓰고 일반 명사에서 BFS를 시작하지 않는다.
- depth는 2 이하이며 결과 수가 50개 이상이면 추천을 내지 않는다.
- 외부 검색·임베딩 의존성을 추가하지 않고 Node 내장 모듈만 사용한다.
- stdout에는 JSON 하나만 쓰고 진단 문장은 stderr 또는 JSON `reasons`에 둔다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/graph-search.test.js`에 관계별 점수와 다섯 저신뢰 조건을 고정한 실패 테스트를 먼저 작성한다.
- [ ] `test/cli-help.test.js`에 `graph-suggest --query <text> [--seed <value>]...` 공개 usage와 누락 query의 exit 2 assertion을 추가하고 실패를 확인한다.
- [ ] context 후보에서 path·고유 심볼을 seed로 추출하고 명시 seed를 합친 뒤 source와 test를 역할별로 확장한다.
- [ ] 점수표, 안정 정렬, 후보 confidence와 전체 confidence, `low-confidence|unavailable` 판정을 구현한다.
- [ ] 경계값 3/4와 7/8, ranked high/medium, low-only·구현 후보 없음 low-confidence, unavailable 조합과 모든 status의 비어 있지 않은 reasons를 각각 assertion해 Task 003 소비자가 같은 어휘와 임계치를 재사용하게 한다.
- [ ] 그래프 일부가 손상돼도 유효 node·link만 사용하고 `reasons`에 누락을 남기며, 경로 없는 후보와 `graphify-out/**` 후보를 제거한다.
- [ ] CLI를 registry와 help에 연결하고 stdout/stderr/exit code 계약을 검증한다.
- [ ] `docs/compatibility.md`의 공개 명령 목록과 `test/public-contract.test.js` assertion을 같은 커밋에서 갱신해 계약 drift를 막는다.
- [ ] `npm test`를 실행해 검색 단위 테스트와 기존 CLI 회귀를 확인한다.
