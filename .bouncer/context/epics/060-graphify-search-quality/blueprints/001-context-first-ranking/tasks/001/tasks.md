---
type: bouncer.tasks
title: 구현·테스트 그래프 입력 분리
description: 구현 그래프에서 테스트와 명시된 생성 경로를 분리하고 독립 테스트 그래프를 빌드한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T12:01:12.954+09:00'
bouncer:
  id: TASKS-001
  epic_id: '060'
  blueprint_id: '001'
  status: verified
  verify: npm test
  commit_intent:
    - 자연어 질의가 반복적인 테스트 심볼에서 시작해 구현 경로를 누락하는 편향을 줄임
    - 기존 source/context 경로와 선택적 Graphify 동작을 유지하며 역할별 입력을 분리함
  affected_paths:
    - config.example.json
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/graph-scope.ts
    - scripts/lib/graph-scope.js
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - scripts/src/lib/graph-exec.ts
    - scripts/lib/graph-exec.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - test/init.test.js
    - test/session-graph.test.js
    - test/graphify.test.js
    - test/cli-help.test.js
    - docs/configuration.md
    - docs/ARCHITECTURE.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T12:13:53+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/060-graphify-search-quality
      - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/004
      - .bouncer/distill
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: source_dirs test_dirs exclude_dirs graph scope graph sync generated JavaScript
        result: 45 nodes; top paths are concentrated in test/session-graph.test.js
      - graph: context
        status: updated
        query: source_dirs test_dirs exclude_dirs graph scope graph sync generated JavaScript
        result: 8 nodes; epic 060, task 004, and the graph Distill shard were found
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`source_dirs`로 만들던 구현 그래프에서 `graphify.test_dirs`와 `graphify.exclude_dirs`에 해당하는 노드를 제거하고 별도 test 그래프를 만든다. 기존 config는 계속 source/context 그래프를 만들며, 새 설정을 쓰는 저장소에서는 테스트 심볼과 생성 JavaScript가 구현 후보 seed가 되지 않아야 한다.

```mermaid
flowchart LR
  D[구현 그래프 확장] --> E[연결 테스트 탐색]
```

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `graphify.test_dirs` 배열을 `graphify-out/test/graph.json`의 입력으로 사용하고, `graphify.exclude_dirs` prefix 아래 node·link·hyperedge를 source 병합 결과에서 제거한다. 기존 `graphify-out/source/graph.json`과 `graphify-out/context/graph.json` 위치는 유지한다.
- 제공: `graph-sync` 결과의 `graphs`, `built`, `failed`, `missing`에 `test` scope를 같은 상태 어휘로 노출한다. 새 필드가 없는 config는 `test` scope를 만들지 않고 기존 두 scope 결과를 유지한다.
- 거부: `test_dirs`·`exclude_dirs`가 문자열 배열이 아니거나 절대 경로·`..` 탈출을 포함하면 해당 값을 적용하지 않고 진단 가능한 skip 사유를 반환한다. `exclude_dirs`가 비어 있으면 JavaScript 경로를 생성물로 추측해 제거하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `config.example.json` — 선택적인 `graphify.test_dirs`와 `graphify.exclude_dirs` 예시를 추가한다.
- Modify `scripts/src/lib/init.ts` — 새 저장소에서 실재하는 `test`·`tests`를 test 입력으로 분리하는 기본 config를 만든다.
- Modify `scripts/lib/init.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `scripts/src/lib/graph-scope.ts` — config를 읽어 source·test·context scope와 제외 prefix를 계획한다.
- Modify `scripts/lib/graph-scope.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `scripts/src/lib/session-graph.ts` — 세 scope의 freshness·build·missing·warning 결과를 처리한다.
- Modify `scripts/lib/session-graph.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `scripts/src/lib/graph-exec.ts` — 정규화된 source 그래프에서 제외 prefix 아래 node와 연결을 함께 제거한다.
- Modify `scripts/lib/graph-exec.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `graph-sync` help를 source·test·context 세 scope와 맞춘다.
- Modify `scripts/lib/cli-project-commands.js` — TypeScript 정본 변경의 빌드 산출물을 동기화한다.
- Modify `test/init.test.js` — 신규·기존 config의 test 입력 기본값과 비덮어쓰기 호환성을 검증한다.
- Modify `test/session-graph.test.js` — test scope의 build·freshness·missing·skip 결과를 검증한다.
- Modify `test/graphify.test.js` — 제외 경로의 node·link·hyperedge 제거와 정본 JavaScript 유지 조건을 검증한다.
- Modify `test/cli-help.test.js` — `graph-sync`의 세 scope help 문구를 고정한다.
- Modify `docs/configuration.md` — 새 Graphify 입력 필드, 기존 config 폴백, 생성물 제외의 명시성 규칙을 설명한다.
- Modify `docs/ARCHITECTURE.md` — source·test·context 세 그래프의 책임과 산출 경로를 기록한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/graph-search.ts` — 검색과 점수화는 Task 002 소관이다.
- `references/graphify-runner/index.md` — 계획 단계 소비 계약은 Task 003에서 바꾼다.
- `.bouncer/config.json` — 현재 checkout의 운영 설정을 계획 구현으로 마이그레이션하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `source_dirs`와 source/context 산출 경로는 하위 호환을 유지한다.
- 제외 필터는 node만 지우고 dangling link·hyperedge를 남겨서는 안 된다.
- `scripts/lib/**`는 직접 구현하지 않고 `npm run build` 산출물로 갱신한다.
- Graphify 부재·비활성은 계속 오류가 아닌 skip 상태다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/init.test.js`, `test/session-graph.test.js`, `test/graphify.test.js`, `test/cli-help.test.js`에 test scope, 제외 prefix, 기존 config 호환, 세-scope help 회귀 테스트를 먼저 추가한다.
- [ ] 새 테스트가 현재 두-scope 구현과 무필터 정규화 때문에 실패하는지 확인한다.
- [ ] `graph-scope`가 유효한 선택 필드만 받아 source·test·context 계획을 만들고, `session-graph`가 세 scope의 결과를 기존 상태 어휘로 집계하게 한다.
- [ ] `graph-exec`이 제외된 node id를 기준으로 link·hyperedge를 함께 제거하고, 빈 제외 목록에서는 결과를 바꾸지 않게 한다.
- [ ] init 기본값과 설정·아키텍처 문서를 새 역할 분리에 맞춘다.
- [ ] `graph-sync` help가 `source + test + context`를 말하도록 실제 scope 집합과 동기화한다.
- [ ] `npm test`를 실행하고 기존 두-scope config와 새 세-scope config가 모두 통과하는지 확인한다.
