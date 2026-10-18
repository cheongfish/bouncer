---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '112'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: major
        status: resolved
        category: combined
        brief_clause: tasks/003 target behavior
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/tasks.md
        symbol: target-behavior
        fingerprint: context:combined:tasks/003 target behavior:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/tasks.md#target-behavior
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Blueprint Contract names the salvage artifact exception; TASKS-003 keeps the patch when ref creation fails.
      - id: CR-002
        severity: major
        status: resolved
        category: combined
        brief_clause: tasks/005 review_risk
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/tasks.md
        symbol: '-'
        fingerprint: context:combined:tasks/005 review_risk:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/tasks.md#-
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Added authorization to TASKS-005 review_risk.
      - id: CR-003
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/003 review_risk
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/tasks.md
        symbol: '-'
        fingerprint: context:combined:tasks/003 review_risk:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/tasks.md#-
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Added public_interface to TASKS-003 review_risk.
      - id: CR-004
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/001 target behavior
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/tasks.md
        symbol: target-behavior
        fingerprint: context:combined:tasks/001 target behavior:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/tasks.md#target-behavior
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: 'Legacy rule now reads: no --verify keeps the current decision; --verify gets only the single-argv check.'
      - id: CR-005
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/001 checklist
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/tasks.md
        symbol: checklist
        fingerprint: context:combined:tasks/001 checklist:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/tasks.md#checklist
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: TASKS-001 Checklist now has red steps for --new-path, parent-missing, revise untracked and legacy argv.
      - id: CR-006
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/002 checklist
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/002/tasks.md
        symbol: checklist
        fingerprint: context:combined:tasks/002 checklist:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/002/tasks.md#checklist
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: TASKS-002 fixes the record check order and the post-report recommit fixture.
      - id: CR-007
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/004 checklist
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/004/tasks.md
        symbol: checklist
        fingerprint: context:combined:tasks/004 checklist:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/004/tasks.md#checklist
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: TASKS-004 Checklist counts three documents.
      - id: CR-008
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/005 verify
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/tasks.md
        symbol: '-'
        fingerprint: context:combined:tasks/005 verify:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/005/tasks.md#-
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: TASKS-005 verify runs test/coordinator.test.js; the fenced-command table test lives in test/run-detach.test.js.
      - id: CR-009
        severity: minor
        status: resolved
        category: combined
        brief_clause: epic success criteria 11
        file: .bouncer/context/epics/112-workflow-transition-guards/index.md
        symbol: success-criteria
        fingerprint: context:combined:epic success criteria 11:.bouncer/context/epics/112-workflow-transition-guards/index.md#success-criteria
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Success criterion 11 is now decided by rg -F, usage tests and lint:docs; TASKS-005 checks it.
      - id: CR-010
        severity: minor
        status: accepted
        category: combined
        brief_clause: blueprint intent
        file: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/index.md
        symbol: intent
        fingerprint: context:combined:blueprint intent:.bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/index.md#intent
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Mermaid zoom is optional; the blueprint chart is kept as the PR flow reference and tasks carry no chart.
    rounds:
      - round: 1
        mode: discovery
        target:
          digest: ef67fb75c3a1656f4bdfb49c4866146620254fb62f0b51106ca4c7b6d778fd8c
        perspectives:
          - name: combined
            target_digest: ef67fb75c3a1656f4bdfb49c4866146620254fb62f0b51106ca4c7b6d778fd8c
        severity_changes: []
    closure_target_digest: 38b65b058c6613e50d2d3ec0dfa88ec8505e017e2d2c4dc6fa30aaef48be6823
---
# Context review

## Findings
- CR-001 (major, must_fix, resolved): tasks/003 target behavior — Blueprint Contract names the salvage artifact exception; TASKS-003 keeps the patch when ref creation fails.
- CR-002 (major, must_fix, resolved): tasks/005 review_risk — Added authorization to TASKS-005 review_risk.
- CR-003 (minor, must_fix, resolved): tasks/003 review_risk — Added public_interface to TASKS-003 review_risk.
- CR-004 (minor, must_fix, resolved): tasks/001 target behavior — Legacy rule now reads: no --verify keeps the current decision; --verify gets only the single-argv check.
- CR-005 (minor, must_fix, resolved): tasks/001 checklist — TASKS-001 Checklist now has red steps for --new-path, parent-missing, revise untracked and legacy argv.
- CR-006 (minor, must_fix, resolved): tasks/002 checklist — TASKS-002 fixes the record check order and the post-report recommit fixture.
- CR-007 (minor, must_fix, resolved): tasks/004 checklist — TASKS-004 Checklist counts three documents.
- CR-008 (minor, must_fix, resolved): tasks/005 verify — TASKS-005 verify runs test/coordinator.test.js; the fenced-command table test lives in test/run-detach.test.js.
- CR-009 (minor, must_fix, resolved): epic success criteria 11 — Success criterion 11 is now decided by rg -F, usage tests and lint:docs; TASKS-005 checks it.
- CR-010 (minor, advisory, accepted): blueprint intent — Mermaid zoom is optional; the blueprint chart is kept as the PR flow reference and tasks carry no chart.
