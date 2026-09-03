---
type: bouncer.tasks
title: 컨텍스트 보존 정책과 완료 후 후속 작업 기준을 문서화함
description: Public documentation distinguishes durable closed-blueprint evidence from transient execution records.
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/020-completed-context-retention/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T09:28:55.106+09:00'
bouncer:
  id: TASKS-003
  epic_id: '018'
  blueprint_id: '020'
  status: verified
  affected_paths:
    - .bouncer/context/epics/018-task-unit-commits/index.md
    - docs/context-retention-and-epic-lifecycle.md
    - docs/context-versioning.md
    - docs/workflow.md
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/validate-docs.ts
    - scripts/lib/validate-docs.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - skills/bouncer-finalize/SKILL.md
    - test/finalize.test.js
    - test/validate-structural.test.js
  verify: npm test
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T09:28:55.106+09:00'
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
        query: context retention epic lifecycle documentation closed blueprint finalize verification
        result: graph-sync reused the current source graph; graph-suggest returned no ranked source candidates.
      - graph: test
        status: reused
        query: context retention epic lifecycle documentation closed blueprint finalize verification
        result: graph-sync reused the current test graph; graph-suggest returned no ranked test candidates.
      - graph: context
        status: reused
        query: context retention epic lifecycle documentation closed blueprint finalize verification
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
    - 완료 문서와 일회성 실행 기록의 보존 기준이 흩어져 종료 뒤 탐색 범위가 불명확함
    - verification까지 finalize 삭제 대상에 포함해 보존 표와 구현·스킬을 맞춤
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
사용자는 closed Blueprint에서 `explain.md`로 장기 판단과 검증 요지를 찾고,
task·verification·review·context-review 문서는 finalize가 정리한다. 문서는
새 요구가 기존 Epic에 속하는지, sibling Blueprint가 필요한지, 새 Epic이 필요한지를
일관되게 안내한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 보존 기준은 문서 종류별 처리, finalize 시점, closed Blueprint의 축약
  레이아웃, 후속 Blueprint와 Epic의 선택 기준을 제공한다.
- 거부: 문서는 Git diff의 복제본, task별 실행 일지, archive 시스템의 운영 절차를
  보관 기준으로 만들지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `.bouncer/context/epics/018-task-unit-commits/index.md` — `020` Blueprint의
  링크와 완료 컨텍스트 보존 요약을 Epic 인벤토리에 추가한다.
- Modify `docs/context-retention-and-epic-lifecycle.md` — 보존 표, finalize 정리,
  closed Blueprint 축약 레이아웃, Epic·sibling Blueprint 기준을 정본으로 둔다.
- Modify `docs/context-versioning.md` — context를 커밋한다는 원칙에 완료 뒤
  일회성 문서 정리와 장기 증적 보존의 예외를 연결한다.
- Modify `docs/workflow.md` — finalize 흐름과 완료 Blueprint의 잠금 설명에
  컨텍스트 정리·후속 계획 경계를 반영한다.
- Modify `scripts/src/lib/finalize.ts` — closed 전이 시 `verification.md`도
  일회성 삭제 목록에 포함한다.
- Modify `scripts/lib/finalize.js` — TypeScript 구현과 배포 CJS 산출물을 동기화한다.
- Modify `scripts/src/lib/validate-docs.ts` — closed 축약 레이아웃이 task leaf를
  요구하지 않도록 한다.
- Modify `scripts/lib/validate-docs.js` — TypeScript 구현과 배포 CJS 산출물을
  동기화한다.
- Modify `scripts/src/lib/validate.ts` — closed 축약 검사 주석·판정을 맞춘다.
- Modify `scripts/lib/validate.js` — TypeScript 구현과 배포 CJS 산출물을 동기화한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 삭제·보존 경계에 verification 삭제를
  반영한다.
- Modify `test/finalize.test.js` — verification 삭제·복구·stage 기대를 고정한다.
- Modify `test/validate-structural.test.js` — closed 축약 레이아웃이 verification
  없이도 통과함을 고정한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `docs/compatibility.md` — 공개 CLI·상태·게이트 표의 열거값은 바꾸지 않는다.
- `docs/ARCHITECTURE.md` — Graphify와 내부 구조 설명은 이 정책 문서화 범위에서
  바꾸지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 사용자 문서는 한국어로 쓰며, 구현되지 않은 archive·재개 명령을 제공하는 듯한
  표현을 피한다.
- `tasks.md`라는 구형 표기 대신 현재 task bundle 경로 `tasks/<NNN>/tasks.md`를
  사용한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] Epic 인벤토리에 `020` 링크와 보존 수명주기 요약을 추가한다.
- [ ] 세 문서에서 완료 뒤 남는 문서와 삭제되는 문서를 같은 목록으로 맞춘다.
- [ ] 기존 문서의 closed Blueprint 재개 안내를 sibling Blueprint 원칙과 맞춘다.
- [ ] `rg -n "reopen|다시 열|tasks\.md|context-review" docs skills`로 남은
  상충 표현을 확인한다.
- [ ] `npm test`를 실행한다.
