---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/review.md
tags:
  - bouncer
  - review
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '112'
  blueprint_id: '001'
  status: requested
  review:
    required: true
    rounds:
      - round: 1
        mode: discovery
        target:
          base: 37b7801ec863a0982acf3504f64e95e6e94d32ab
          head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
          snapshot_id: 1b5d25b8904b937b9533616dcbffe05f57f7dea2d940990ba1cefe0596d2f8e1
        perspectives:
          - name: spec_scope
            target_head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
          - name: correctness_tests
            target_head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
          - name: minimality_maintainability
            target_head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
          - name: security
            target_head: 96c1baba1961ebaddfc256ae1b5cfee03436b598
        task_brief_hashes:
          TASKS-001: 5932e8bb13bff9927dfdeedcbef8465ab04a723e0b967d09aada1f71a027acfc
          TASKS-002: 191a22c61e5af6f4b7c2bae845fc538ce1bb7a3f5da7150002627c99ca25cd66
          TASKS-003: d40bd93c310402e8c5790ef8fe52026d0dbbfad7ab34c1543f5a8d675b1d03c9
          TASKS-004: 2209b962f51604be0718d3d4c7b76ab96104f1c9eda8601a038405f161f0409b
          TASKS-005: f7e2017aab99b3344a47aa43b9dae32269ebb693df4121cdb707af2c6c0d1a79
          TASKS-006: 5b6b917506d183307cea8ef677656026cb0a687ad8023031ee8215dff8d2094d
        intent_bundles:
          TASKS-001:
            id: dc5e684c577c6696a23b8a85375e8a277bb07788d880c614785fa21b7551e656
            revision: 2
          TASKS-002:
            id: b1156775b22b8b49a324377b6c69990fbcc3095e610c02a98bc91dd972674184
            revision: 3
          TASKS-003:
            id: f76faddb4b7870398e71983cf17cc2a99873785b539515d600b50d3a0196dc6a
            revision: 2
          TASKS-004:
            id: ba20419348f5b7be192234baa65e5f41c159d4354f2f04fe06da97d2a5f97257
            revision: 3
          TASKS-005:
            id: 5eea63edc3e30df1e1bd64827ef1d013cfaab9fa1be73ed6bb27f42a3a0f3c0d
            revision: 2
          TASKS-006:
            id: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
            revision: 1
        previous_finding_ids: []
        new: 9
        resolved: 0
        regressed: 0
    findings:
      - id: F1
        severity: blocker
        status: open
        category: correctness_tests
        brief_clause: tasks/005 target behavior
        file: scripts/src/lib/run-detach.ts
        symbol: detachRun
        fingerprint: correctness_tests:tasks/005 target behavior:scripts/src/lib/run-detach.ts#detachRun
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
      - id: F2
        severity: major
        status: deferred
        category: spec_scope
        brief_clause: blueprint contract
        file: scripts/src/lib/run-detach.ts
        symbol: detachRunRefusalShape
        fingerprint: spec_scope:blueprint contract:scripts/src/lib/run-detach.ts#detachRunRefusalShape
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: detach-confirmation-required/-awaiting-confirmation/-worker-in-flight lack cause/next and hint entries (merged spec_scope F-SPEC-001 + correctness_tests CT-F2); in TASKS-005 scope, carried forward because the single final-review round allows no fix round
      - id: F3
        severity: major
        status: deferred
        category: correctness_tests
        brief_clause: tasks/001 target behavior
        file: scripts/src/lib/cli-git-commands.ts
        symbol: cmdCoordinate
        fingerprint: correctness_tests:tasks/001 target behavior:scripts/src/lib/cli-git-commands.ts#cmdCoordinate
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: coordinate revise refusals drop paths/cause/next and run-detached fence prints raw JSON (merged CT-F3 + F-SPEC-002; F-SPEC-002 also notes CURRENT_WOULD_BE_AMBIGUOUS lacks cause per brief vs Contract); in TASKS-001 scope, carried forward
      - id: F4
        severity: minor
        status: deferred
        category: correctness_tests
        brief_clause: tasks/002 target behavior
        file: scripts/src/lib/coordinate-next.ts
        symbol: taskNext
        fingerprint: correctness_tests:tasks/002 target behavior:scripts/src/lib/coordinate-next.ts#taskNext
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: worker-commit-stamp-mismatch/worker-scope-dirty next points to advance commit that taskNext never offers when a stamp exists; selection changed for baseline-dirty redispatch (merged CT-F4 + F-SPEC-003); brief wording ambiguity, follow-up
      - id: F5
        severity: minor
        status: deferred
        category: correctness_tests
        brief_clause: tasks/005 target behavior
        file: scripts/src/lib/run-detach.ts
        symbol: detachRunLock
        fingerprint: correctness_tests:tasks/005 target behavior:scripts/src/lib/run-detach.ts#detachRunLock
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: detach writes ledger without checking lock ownership (writeOwnedLedger/ledger-lock-lost pattern); follow-up
      - id: F6
        severity: minor
        status: deferred
        category: minimality_maintainability
        brief_clause: blueprint contract
        file: scripts/src/lib/scope.ts
        symbol: isDetached
        fingerprint: minimality_maintainability:blueprint contract:scripts/src/lib/scope.ts#isDetached
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: Ledger.status union in scripts/src/lib/execution-contracts.ts lacks 'detached'; casts and writeLedgerFile wrapper work around it (merged MM-001 + F-SPEC-004); file outside every task affected_paths, follow-up plan
      - id: F7
        severity: minor
        status: deferred
        category: minimality_maintainability
        brief_clause: tasks/003 interface
        file: scripts/src/lib/coordinator.ts
        symbol: salvageRevokedWorker
        fingerprint: minimality_maintainability:tasks/003 interface:scripts/src/lib/coordinator.ts#salvageRevokedWorker
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: duplicate head/generation computation, eager liveHead, duplicated porcelain parsing; follow-up cleanup
      - id: F8
        severity: minor
        status: deferred
        category: minimality_maintainability
        brief_clause: tasks/004 touch
        file: scripts/src/lib/cli-current-command.ts
        symbol: cmdCurrent
        fingerprint: minimality_maintainability:tasks/004 touch:scripts/src/lib/cli-current-command.ts#cmdCurrent
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: pre-check reads pointer directory twice (baseNamespaceKeys + listNamespacePointers); follow-up cleanup
      - id: F9
        severity: minor
        status: deferred
        category: security
        brief_clause: tasks/001 interface
        file: scripts/src/lib/scope.ts
        symbol: trackedScopeViolations
        fingerprint: security:tasks/001 interface:scripts/src/lib/scope.ts#trackedScopeViolations
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
        note: 'git ls-files pathspec magic ('':!x'', '':(icase)'') bypasses scope-path-untracked pre-check; no privilege widening since scope enforcement compares literally; follow-up: --literal-pathspecs or reject '':'' prefix'
---
# Review

## Findings
- <finding>
