---
type: bouncer.tasks
title: 마감 시 일회성 계획 문서를 정리하고 축약 레이아웃을 검증함
description: Finalize removes transient planning documents only after the final gate and validation accepts closed compact layouts.
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/020-completed-context-retention/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T09:27:43.508+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '020'
  status: verified
  affected_paths:
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/validate-docs.ts
    - scripts/lib/validate-docs.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/finalize.test.js
    - test/validate-structural.test.js
    - test/fixtures/context-corpus-queries.json
  verify: npm test
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T09:27:43.508+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - graph: source
        status: reused
        query: finalize closed blueprint lifecycle cleanup task review context review validation
        result: graph-sync reused the current source graph; graph-suggest returned no ranked source candidates.
      - graph: test
        status: reused
        query: finalize closed blueprint lifecycle cleanup task review context review validation
        result: graph-sync reused the current test graph; graph-suggest returned no ranked test candidates.
      - graph: context
        status: reused
        query: finalize closed blueprint lifecycle cleanup task review context review validation
        result: graph-sync reused the current context graph; relation results exceeded the confidence limit.
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 4091 labels, 412 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'result explosion: 596 candidates (≥ 50)'
    candidates:
      implementation: []
      test: []
      context: []
  commit_intent:
    - 마감한 blueprint의 실행 절차가 현재 시스템 설명과 섞여 탐색 비용을 높임
    - G16 뒤에 일회성 문서만 정리해 완료 이력과 실행 증적을 함께 보존함
---
# Tasks

Blueprint: [020](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`finalize --yes`가 G16과 사전 검증을 통과한 뒤 task·review·context-review 문서만
삭제하고 Blueprint 상태를 `closed`로 전이한다. 검증은 열린 Blueprint에는 완전한
bundle을 요구하고, closed Blueprint에는 `index.md`·`explain.md`·각 task의
`verification.md`가 남은 축약 레이아웃을 허용한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: finalize 결과의 staged 목록은 삭제할 일회성 문서와 `index.md`를 함께
  포함하며, 성공 커밋 뒤 closed Blueprint에는 설명·검증 증적만 남는다. `stage()`나
  `commit()`이 throw하면 삭제 전 바이트와 `approved` 상태를 복구하고 실패를
  호출자에게 전파한다.
- 거부: G16 실패, verify 실패, out-of-scope 발견, 또는 dry-run에서는 삭제와
  status 전이를 수행하지 않는다. closed Blueprint를 재개하거나 새 task를 붙이지
  않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/finalize.ts` — G16 뒤의 삭제 목록을 계산하고, 검증 성공
  뒤에만 일회성 문서 삭제·closed 전이·stage를 원자적으로 수행한다.
- Modify `scripts/lib/finalize.js` — 배포되는 CommonJS 산출물을 TypeScript 구현과
  동기화한다.
- Modify `scripts/src/lib/validate-docs.ts` — closed Blueprint의 존재·로딩 규칙을
  축약 레이아웃과 구분한다.
- Modify `scripts/lib/validate-docs.js` — 배포되는 CommonJS 산출물을 TypeScript
  구현과 동기화한다.
- Modify `scripts/src/lib/validate.ts` — closed 상태에서 허용할 문서 집합과 열린
  Blueprint의 기존 구조 검사를 분리한다.
- Modify `scripts/lib/validate.js` — 배포되는 CommonJS 산출물을 TypeScript 구현과
  동기화한다.
- Modify `test/finalize.test.js` — 성공 삭제·stage 목록과 모든 실패 경로의 무변경을
  회귀 테스트한다.
- Modify `test/validate-structural.test.js` — 열린/full·light와 closed 축약
  레이아웃의 구조 판정을 고정한다.
- Modify `test/fixtures/context-corpus-queries.json` — BP-020 계획 문서(+11)를
  반영해 epic-018 `max_candidates`를 `144`에서 `155`로 올린다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/verification.ts` — task 검증 증적의 생성·보존 계약은 바꾸지 않는다.
- `scripts/src/lib/scaffold.ts` — closed Blueprint의 task scaffold 거절 계약은
  기존 동작으로 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 삭제 대상은 `tasks/<NNN>/tasks.md`, `tasks/<NNN>/review.md`, full Blueprint의
  `context-review.md`뿐이다. `verification.md`, `explain.md`, `index.md`와
  Distill은 삭제하지 않는다.
- `scripts/src`와 `scripts/lib`는 같은 동작을 유지한다. 새 상태·게이트 번호·새
  의존성을 추가하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/finalize.test.js`에 G16 실패·verify 실패·dry-run·성공 finalize의
  삭제 및 stage 순서를 먼저 단언한다.
- [ ] `test/finalize.test.js`에 stage·commit 예외를 주입하고, 각 실패 뒤
  `tasks.md`·`review.md`·`context-review.md`와 `index.md`의 `approved` 상태가
  복구되는지 단언한다.
- [ ] `test/validate-structural.test.js`에 draft/approved의 완전한 bundle 요구와
  closed의 축약 허용을 단언한다.
- [ ] 두 개 이상의 task bundle fixture에서 모든 `tasks.md`·`review.md`는
  삭제되고 각 `verification.md`·`explain.md`는 남으며, closed 상태의 재검증이
  통과하는지 단언한다.
- [ ] finalize와 validator 구현을 수정해 테스트를 통과시킨다.
- [ ] `test/fixtures/context-corpus-queries.json`의 epic-018 `max_candidates`를
  `144`에서 `155`로 올린다.
- [ ] `npm test`를 실행한다.
