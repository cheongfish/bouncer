---
type: bouncer.tasks
title: graph search epic을 060으로 통합함
description: Moves graph and search history into canonical epic 060 and records retrieval regression evidence.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.167+09:00'
bouncer:
  id: TASKS-003
  epic_id: '014'
  blueprint_id: '004'
  status: ready
  verify: npm test
  affected_paths:
    - .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/distill.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/index.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/review.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/tasks.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/verification.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/distill.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/index.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/review.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/tasks.md
    - .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/verification.md
    - .bouncer/context/epics/011-graphify-signal/index.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/explain.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/index.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/review.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/tasks.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/verification.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/review.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/tasks.md
    - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/verification.md
    - .bouncer/context/epics/026-context-graph-slim/index.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/context-review.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/explain.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/index.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/review.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/tasks.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/verification.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/review.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/tasks.md
    - .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/verification.md
    - .bouncer/context/epics/040-scope-evidence/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/distill.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/distill.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/explain.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/context-review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/explain.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/context-review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/explain.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/context-review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/explain.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/context-review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/explain.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/index.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/review.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/tasks.md
    - .bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/verification.md
    - .bouncer/context/epics/060-graphify-search-quality/index.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/context-review.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/explain.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/index.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/review.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/tasks.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/verification.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/review.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/tasks.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/verification.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/review.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/tasks.md
    - .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/verification.md
    - .bouncer/context/epics/062-search-language-contract/index.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/context-review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/explain.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/index.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/tasks.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/verification.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/tasks.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/verification.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/tasks.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/verification.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/tasks.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/verification.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/review.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/tasks.md
    - .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/verification.md
    - .bouncer/context/epics/063-context-digest-search-index/index.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/context-review.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/explain.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/index.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/review.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/tasks.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/verification.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/review.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/tasks.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/verification.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/review.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/tasks.md
    - .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/verification.md
    - .bouncer/context/epics/064-scope-graph-convergence/index.md
    - .bouncer/context/index.md
    - docs/benchmark/context-corpus-search.md
    - test/context-corpus-search.test.js
    - test/fixtures/context-corpus-queries.json
    - test/graph-search.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.167+09:00'
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
        query: canonical corpus migration task 003
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 003
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 003
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
011, 026, 040, 062, 063, 064의 BP를 `060-graph-search`로 이동하고 고정 query 회귀 증적을 남긴다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: graph/search 결정은 060 hierarchy와 고정 query fixture에서 검증된다.
- 거부: tokenizer·ranking·graphify 형식은 바꾸지 않는다.

## Touch
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/011-graphify-signal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/026-context-graph-slim/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/040-scope-evidence/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/001-silent-skip-signal/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/002-graph-path-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/003-context-section-digest/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/004-scope-evidence-contract/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/005-english-search-contract/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/006-derived-anchors-and-coverage/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/blueprints/007-scope-separation-and-reporting/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/060-graphify-search-quality/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/062-search-language-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/063-context-digest-search-index/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/064-scope-graph-convergence/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `docs/benchmark/context-corpus-search.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `test/context-corpus-search.test.js` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `test/fixtures/context-corpus-queries.json` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `test/graph-search.test.js` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/graph-search.ts` — 측정 대상 구현을 바꾸지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- query·seed·frontmatter 검색 메타데이터는 영어 ASCII만 쓴다.
- fixture는 `epic-018`, `epic-007`, `epic-060` query를 고정하고, 각각 최종 canonical epic index를 필수 context hit로 요구한다. 후보 수는 각 query의 압축 전 기준선보다 늘어나면 실패한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `epic-018`, `epic-007`, `epic-060`의 압축 전 context hit·후보 수를 fixture 기준선으로 고정한다.
- [ ] BP를 이동하고 index·resource를 수렴한다.
- [ ] fixed query recall·후보 상한과 `npm test`를 확인한다.

