---
type: bouncer.tasks
title: 벤치마크 계층 통합
description: Consolidates benchmark history under the canonical evaluation epic and removes legacy hierarchy references.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/009/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.380+09:00'
bouncer:
  id: TASKS-009
  epic_id: '014'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - '벤치마크 기록이 여러 계층에 흩어져 검색과 계보 확인이 어려웠음'
    - '관련 기록을 주제별 계층으로 모아 일관된 탐색 기준을 마련함'
  affected_paths:
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/context-review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/explain.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/index.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/context-review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/explain.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/index.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/context-review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/explain.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/index.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/context-review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/explain.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/index.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/review.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/tasks.md
    - .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/verification.md
    - .bouncer/context/epics/034-evaluation-benchmarking/index.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/context-review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/explain.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/index.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/context-review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/explain.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/index.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/context-review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/explain.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/index.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/context-review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/explain.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/index.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/review.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/tasks.md
    - .bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/verification.md
    - .bouncer/context/epics/034-agentic-benchmark/index.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/context-review.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/explain.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/index.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/review.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/tasks.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/verification.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/review.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/tasks.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/verification.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/review.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/tasks.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/verification.md
    - .bouncer/context/epics/051-deepswe-original-benchmark/index.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/context-review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/explain.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/index.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/context-review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/explain.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/index.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/review.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/tasks.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/verification.md
    - .bouncer/context/epics/052-deepswe-arm-comparison/index.md
    - .bouncer/context/index.md
    - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/001/tasks.md
    - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/003/tasks.md
    - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/004/tasks.md
    - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/005/tasks.md
    - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/002/tasks.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.380+09:00'
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
        query: canonical corpus migration task 009
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 009
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 009
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
034, 051, 052의 BP를 실제 canonical epic인 `034-evaluation-benchmarking` 아래에 통합하고 legacy source 경로를 제거한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: benchmark history가 `034-evaluation-benchmarking` 하나의 hierarchy에 있다.
- 거부: benchmark runner와 benchmark 내용은 변경하지 않는다.

## Touch
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/002-deepswe-run-path/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/003-deepswe-run-plumbing/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/blueprints/004-checkout-arms-comparison/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/034-agentic-benchmark/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/051-deepswe-original-benchmark/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/052-deepswe-arm-comparison/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/context-review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/explain.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/index.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/tasks/001/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/context-review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/explain.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/index.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/001/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/context-review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/explain.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/index.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/001/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/context-review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/explain.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/index.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/002/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/review.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/tasks.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/003/verification.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.
- Modify `.bouncer/context/epics/034-evaluation-benchmarking/index.md` — canonical epic migration의 destination 문서를 생성하고 source·resource·링크를 갱신한다.

- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/001/tasks.md` — 034-evaluation-benchmarking으로 이동한 경로에 맞춰 stale 참조를 갱신한다.
- Modify `.bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/003/tasks.md` — 034-evaluation-benchmarking으로 이동한 경로에 맞춰 stale 참조를 갱신한다.
- Modify `.bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/004/tasks.md` — 034-evaluation-benchmarking으로 이동한 경로에 맞춰 stale 참조를 갱신한다.
- Modify `.bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/005/tasks.md` — 034-evaluation-benchmarking으로 이동한 경로에 맞춰 stale 참조를 갱신한다.
- Modify `.bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/002/tasks.md` — 034-evaluation-benchmarking으로 이동한 경로에 맞춰 stale 참조를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `skills/agentic-code-benchmark/scripts/` — runner는 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- source가 작업 트리에서 삭제된 상태여도 HEAD의 source를 기준으로 동일한 bundle 구조를 destination에 보존한다.
- destination blueprint 번호는 기존 `001`~`004`를 유지하고 중복 bundle을 만들지 않는다.
- bundle 이동과 resource·부모 링크 갱신을 함께 한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] source와 destination inventory를 고정하고 034, 051, 052의 bundle을 destination에 대조한다.
- [ ] destination의 `resource`, 부모 경로, 내부 링크와 context index를 갱신하고 legacy source 참조가 없는지 확인한다.
- [ ] `npm test`를 실행해 fixed query 회귀와 후보 상한을 확인한다.
