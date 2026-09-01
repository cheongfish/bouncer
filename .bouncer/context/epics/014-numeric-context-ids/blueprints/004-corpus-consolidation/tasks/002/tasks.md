---
type: bouncer.tasks
title: context schema corpus를 014로 통합함
description: Moves context schema and corpus history into canonical epic 014.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.130+09:00'
bouncer:
  id: TASKS-002
  epic_id: '014'
  blueprint_id: '004'
  status: ready
  verify: npm test
  affected_paths:
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/context-review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/context-review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/context-review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/explain.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/index.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/explain.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/index.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/review.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/tasks.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/verification.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/review.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/tasks.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/verification.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/review.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/tasks.md
    - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/verification.md
    - .bouncer/context/epics/027-history-import/index.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/explain.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/index.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/review.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/tasks.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/verification.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/review.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/tasks.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/verification.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/review.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/tasks.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/verification.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/review.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/tasks.md
    - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/verification.md
    - .bouncer/context/epics/031-document-schema/index.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/context-review.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/explain.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/index.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/review.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/tasks.md
    - .bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/verification.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/context-review.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/explain.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/index.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/review.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/tasks.md
    - .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/verification.md
    - .bouncer/context/epics/049-context-searchability/index.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/context-review.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/explain.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/index.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/review.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/tasks.md
    - .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/verification.md
    - .bouncer/context/epics/061-epic-index-consistency/index.md
    - .bouncer/context/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.130+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - context graph query produced no safe file ranking for corpus migration
        - migration scope is confirmed from the explicit canonical mapping
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: canonical corpus migration task 002
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 002
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 002
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
027, 031, 049, 061의 BP를 기존 canonical root `014-numeric-context-ids` 아래 `005`부터 순차 통합한다. 현재 실행 blueprint `004-corpus-consolidation`은 이동하거나 재번호화하지 않는다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: context schema·history·index 결정을 하나의 parent hierarchy에서 찾는다.
- 거부: 기존 BP 내용을 새 계약으로 재해석하거나 digest 구현을 바꾸지 않는다.

## Touch
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/027-history-import/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/031-document-schema/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/001-context-digest-grain/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/049-context-searchability/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/061-epic-index-consistency/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/context-digest.ts` — 생성 계약은 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 이동은 bundle 단위이며 metadata `description`·tags는 영어 ASCII로 정규화한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 이동·참조 inventory를 고정한다.
- [ ] BP와 index를 이동·재번호화한다.
- [ ] structural validation과 `npm test`를 실행한다.



