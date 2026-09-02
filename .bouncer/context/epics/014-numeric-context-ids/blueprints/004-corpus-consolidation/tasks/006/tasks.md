---
type: bouncer.tasks
title: product surface·hosts epic을 001로 통합함
description: Moves product surface and host history into canonical epic 001.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.274+09:00'
bouncer:
  id: TASKS-006
  epic_id: '014'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - CLI 사용성·다중 에이전트·호스트 환경 관련 결정이 여러 epic에 분산되어 전체 호스트/진입점 역사를 한눈에 파악하기 어려움
    - 해당 history를 001 아래로 모아 product surface와 host 역사를 단일 hierarchy로 통합하고 검색 baseline을 맞춤
  affected_paths:
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/distill.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/index.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/distill.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/index.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/review.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/tasks.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/verification.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/distill.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/index.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/review.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/tasks.md
    - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/verification.md
    - .bouncer/context/epics/003-multi-agent-plugin/index.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/explain.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/index.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/review.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/tasks.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/verification.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/review.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/tasks.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/verification.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/review.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/tasks.md
    - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/verification.md
    - .bouncer/context/epics/025-graphify-bootstrap/index.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/explain.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/index.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/review.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/tasks.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/verification.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/review.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/tasks.md
    - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/verification.md
    - .bouncer/context/epics/028-antigravity-host/index.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/context-review.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/explain.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/index.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/review.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/tasks.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/verification.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/review.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/tasks.md
    - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/verification.md
    - .bouncer/context/epics/048-plugin-root-resolution/index.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/context-review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/explain.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/index.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/context-review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/explain.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/index.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/context-review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/explain.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/index.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/verification.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/review.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/tasks.md
    - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/verification.md
    - .bouncer/context/epics/059-audit-followup/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/distill.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/distill.md
    - .bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/distill.md
    - .bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/context-review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/context-review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/context-review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/context-review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/explain.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/index.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/verification.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/review.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/tasks.md
    - .bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/verification.md
    - .bouncer/context/epics/001-cli-usability/index.md
    - .bouncer/context/index.md
    - test/fixtures/context-corpus-queries.json
    - test/context-corpus-search.test.js
    - docs/benchmark/context-corpus-search.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/verification.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/review.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.274+09:00'
    suggested_paths: []
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
        query: canonical corpus migration task 006
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 006
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 006
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent
001,003,025,028,048,059의 BP를 `001-cli-usability`로 통합한다.

## Interface
- 제공: product surface와 host history가 하나의 hierarchy에 있다.
- 거부: 설치·host 동작은 변경하지 않는다.

## Touch
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/025-graphify-bootstrap/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/028-antigravity-host/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/048-plugin-root-resolution/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/059-audit-followup/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/002-cursor-codex-manifests/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/003-commands-to-skills/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/004-venv-install-bin-resolution/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/005-antigravity-plugin-surface/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/006-host-candidate-launcher/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/007-install-first-five-minutes/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/008-instruction-layers/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/blueprints/009-debt-items/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/001-cli-usability/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `test/fixtures/context-corpus-queries.json` — corpus baseline·task 번들 갱신.
- Modify `test/context-corpus-search.test.js` — corpus baseline·task 번들 갱신.
- Modify `docs/benchmark/context-corpus-search.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/tasks.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/verification.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/006/review.md` — corpus baseline·task 번들 갱신.

## Do not touch
- `scripts/lib/cli.js` — runtime은 변경하지 않는다.

## Constraints
- bundle 이동과 resource 갱신을 함께 한다.
- corpus fixture·benchmark 문서는 이 task의 canonical epic 통합 후 baseline(hit·후보 상한)을 갱신하는 데 쓴다.

## Checklist
- [ ] inventory를 고정하고 BP를 이동·재번호화한다.
- [ ] index·링크를 갱신하고 npm test를 실행한다.
