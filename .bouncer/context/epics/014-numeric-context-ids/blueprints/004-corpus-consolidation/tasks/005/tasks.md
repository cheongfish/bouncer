---
type: bouncer.tasks
title: agent orchestration epic을 009로 통합함
description: Moves agent orchestration history into canonical epic 009.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.239+09:00'
bouncer:
  id: TASKS-005
  epic_id: '014'
  blueprint_id: '004'
  status: ready
  affected_paths:
    - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/distill.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/distill.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/context-review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/context-review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/context-review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/context-review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/verification.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/context-review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/explain.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/index.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/review.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/tasks.md
    - .bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/verification.md
    - .bouncer/context/epics/009-subagent-model-config/index.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/explain.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/index.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/review.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/tasks.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/verification.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/explain.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/index.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/review.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/tasks.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/verification.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/explain.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/index.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/review.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/tasks.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/verification.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/explain.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/index.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/review.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/tasks.md
    - .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/verification.md
    - .bouncer/context/epics/015-workflow-ergonomics/index.md
    - .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/explain.md
    - .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/index.md
    - .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/review.md
    - .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/tasks.md
    - .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/verification.md
    - .bouncer/context/epics/016-advisor-removal/index.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/explain.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/index.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/review.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/tasks.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/verification.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/review.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/tasks.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/verification.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/review.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/tasks.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/verification.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/review.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/tasks.md
    - .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/verification.md
    - .bouncer/context/epics/032-autonomous-run/index.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/context-review.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/explain.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/index.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/review.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/tasks.md
    - .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/verification.md
    - .bouncer/context/epics/046-review-loop-cap/index.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/context-review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/explain.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/index.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/context-review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/explain.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/index.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/context-review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/explain.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/index.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/verification.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/review.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/tasks.md
    - .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/verification.md
    - .bouncer/context/epics/050-cycle-friction/index.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/context-review.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/explain.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/index.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/review.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/tasks.md
    - .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/verification.md
    - .bouncer/context/epics/057-review-ready-pr/index.md
    - .bouncer/context/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.239+09:00'
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
        query: canonical corpus migration task 005
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 005
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 005
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
009,015,016,032,046,050,057의 BP를 `009-agent-orchestration`으로 통합한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: agent·automation·review flow의 history가 하나의 hierarchy에 있다.
- 거부: dispatch와 reviewer 동작은 바꾸지 않는다.

## Touch
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/003-adaptive-quiz/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/004-graph-basis-record/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/005-pr-single-confirm/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/006-debugger-agent/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/007-ponytail-advisor-removal/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/008-run-loop/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/009-execute-review-cap/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/010-finalize-pointer-scope/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/011-distill-read-scope/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/012-plugin-arm-benchmark/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/blueprints/013-structured-pr-body/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/009-subagent-model-config/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/015-workflow-ergonomics/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/016-advisor-removal/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/032-autonomous-run/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/046-review-loop-cap/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/050-cycle-friction/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/057-review-ready-pr/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/lib/agent-dispatch.js` — 실행 동작은 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- bundle 이동과 metadata ASCII 정규화를 함께 적용한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] inventory를 고정한다.
- [ ] BP를 이동·재번호화한다.
- [ ] structural validation과 npm test를 실행한다.


