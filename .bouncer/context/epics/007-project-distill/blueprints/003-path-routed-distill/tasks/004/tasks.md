---
type: bouncer.tasks
title: Distill 샤드 graph와 finalize 통합
description: Tasks for 004
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.271+09:00'
bouncer:
  id: TASKS-004
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 샤드도 Project Distill 정본으로 그래프와 승격에 반영해야 함
    - 일반 실행 태스크의 수정 범위는 넓어지면 안 됨
  verify: npm test
  affected_paths:
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - scripts/src/lib/graph-scope.ts
    - scripts/lib/graph-scope.js
    - scripts/src/lib/scope.ts
    - scripts/lib/scope.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/layout.ts
    - scripts/lib/layout.js
    - test/context-digest.test.js
    - test/graphify.test.js
    - test/finalize.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.271+09:00'
    command: mcp:graphify
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 68 nodes; source graph advisory result recorded for blueprint task
      - graph: context
        status: updated
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 8 nodes; context graph advisory result recorded for blueprint task
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
context digest·freshness와 finalize remainder scope가 인덱스 등재 샤드를 Project Distill의 일부로 처리한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 모든 등재 샤드의 Decisions digest, shard 변경·추가·삭제 freshness, finalize의 등재 shard 허용.
- 거부: 미등재 shard와 일반 task의 affected paths 밖 shard 수정은 허용하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/context-digest.ts` — 인덱스에 등재된 shard Decisions를 digest와 map에 포함한다.
- Modify `scripts/lib/context-digest.js` — context digest TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/graph-scope.ts` — Distill 인덱스와 shard 디렉터리 변경을 freshness 입력으로 감시한다.
- Modify `scripts/lib/graph-scope.js` — graph scope TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/scope.ts` — finalize remainder에만 등재 shard를 특별 허용한다.
- Modify `scripts/lib/scope.js` — scope TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/finalize.ts` — finalize remainder scope에서 등록 shard 허용 helper를 실제 호출한다.
- Modify `scripts/lib/finalize.js` — finalize TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/layout.ts` — shard 경로 상수를 통합 소비에 제공한다.
- Modify `scripts/lib/layout.js` — layout TypeScript 변경의 CJS emit을 동기화한다.
- Modify `test/context-digest.test.js` — shard digest와 원본 map 경로를 검증한다.
- Modify `test/graphify.test.js` — shard 추가·수정·삭제 freshness와 등재·미등재 shard scope 경계를 검증한다.
- Modify `test/finalize.test.js` — finalize가 등록 shard만 허용하고 미등재 shard를 거부하는지 검증한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/cli-project-commands.ts` — CLI 표면은 task 002에서 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- context graph의 원본 경로는 실제 `.bouncer/distill/*.md`여야 하며 파생 경로를 노출하지 않는다.
- finalize 예외는 execute scope 권한으로 재사용하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] digest·freshness·scope 경계의 실패 테스트를 먼저 추가한다.
- [ ] 정본 shard 통합을 구현하고 허용 범위를 finalize로 한정한다.
- [ ] finalize caller를 finalize-only scope helper에 연결하고 통합 회귀 테스트를 추가한다.
- [ ] `npm run build`로 digest·freshness·scope·layout CJS emit을 동기화한다.
- [ ] finalize 변경의 CJS emit도 `npm run build`로 동기화한다.
- [ ] `npm test`를 실행한다.
