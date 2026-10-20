---
type: bouncer.context_review
title: legacy-epic-merge context review
description: Context review for legacy-epic-merge
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-10-20T21:01:49.382+09:00'
bouncer:
  id: CTXREVIEW-legacy-epic-merge
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: major
        status: resolved
        category: combined
        brief_clause: epic out of scope
        file: .bouncer/context/epics/context-search/index.md
        symbol: out-of-scope
        fingerprint: context:combined:epic out of scope:.bouncer/context/epics/context-search/index.md#out-of-scope
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
        summary: epic Out of scope and success criterion 2 still forbid physical migration that this blueprint delivers
        note: 계획 문서에 반영함
      - id: CR-2
        severity: major
        status: resolved
        category: combined
        brief_clause: tasks/003 constraints
        file: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md
        symbol: constraints
        fingerprint: context:combined:tasks/003 constraints:.bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md#constraints
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
        summary: mapping parser accepts only comma lists; real tables use ranges, number+slug cells, and free-text rows
        note: 계획 문서에 반영함
      - id: CR-3
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/003 interface
        file: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md
        symbol: interface
        fingerprint: context:combined:tasks/003 interface:.bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md#interface
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
        summary: planLegacyEpicMerge return shape differs between Target behavior and Interface
        note: 계획 문서에 반영함
      - id: CR-4
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/003 checklist
        file: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md
        symbol: checklist
        fingerprint: context:combined:tasks/003 checklist:.bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md#checklist
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
        summary: red assertion paths lack .bouncer/context prefix while comment says prefixed
        note: 계획 문서에 반영함
      - id: CR-5
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/002 checklist
        file: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/002/tasks.md
        symbol: checklist
        fingerprint: context:combined:tasks/002 checklist:.bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/002/tasks.md#checklist
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
        summary: no red case for moved_to on a v1 registry entry
        note: 계획 문서에 반영함
      - id: CR-6
        severity: minor
        status: resolved
        category: combined
        brief_clause: tasks/003 range grammar
        file: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md
        symbol: constraints
        fingerprint: context:combined:tasks/003 range grammar:.bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md#constraints
        actionability: advisory
        origin: introduced_by_revision
        first_seen_round: 2
        last_seen_round: 2
        summary: range NNN~MMM does not say whether an inner number without an alias is skipped or rejected
        note: 계획 문서에 반영함
    rounds:
      - round: 1
        mode: discovery
        target:
          digest: bedb298bba4a20ae77d7d8292d9ef5119e8d061dd428382ba7a92e8316dfbdf1
        perspectives:
          - name: combined
            target_digest: bedb298bba4a20ae77d7d8292d9ef5119e8d061dd428382ba7a92e8316dfbdf1
        severity_changes: []
      - round: 2
        mode: delta
        target:
          digest: 693eda81ef278dc724692302d33e542b0b4df10dd2ec38ae62a7cf8516828183
        perspectives:
          - name: combined
            target_digest: 693eda81ef278dc724692302d33e542b0b4df10dd2ec38ae62a7cf8516828183
        severity_changes: []
    closure_target_digest: 2c656cc4b907c13db0ddcc7c8c7d7de406ae39ab90ef792bf2c8f89984383263
---
# Context review

## Findings
- CR-1 (major, must_fix, resolved): epic out of scope — 계획 문서에 반영함
- CR-2 (major, must_fix, resolved): tasks/003 constraints — 계획 문서에 반영함
- CR-3 (minor, must_fix, resolved): tasks/003 interface — 계획 문서에 반영함
- CR-4 (minor, must_fix, resolved): tasks/003 checklist — 계획 문서에 반영함
- CR-5 (minor, advisory, resolved): tasks/002 checklist — 계획 문서에 반영함
- CR-6 (minor, advisory, resolved): tasks/003 range grammar — 계획 문서에 반영함
