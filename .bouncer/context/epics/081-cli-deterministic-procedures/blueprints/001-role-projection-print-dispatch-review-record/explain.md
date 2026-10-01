---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/081-cli-deterministic-procedures/blueprints/001-role-projection-print-dispatch-review-record/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-01T14:31:38.886+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '081'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: d3566bf731e44c19fd6d197a5d644e6c2511daaf
      range_to: fde60545d72621f8add3cb0aa66fd1b2ddb3fdcc
      diff_sha: 5884be96b88a25610235739e8ab0ac6f6b1422ffa9a91621cd699aff4f5792bd
      quiz_score: 4/4
      disposition: 네 문항 모두 정답. repair가 종단 004 의존만 옮긴 점, 005가 integration 설치 공백을 메운 점, 002 r1 TOML 패리티, 004 verification-retry를 확인함.
      recorded_at: '2026-10-01T14:33:00+09:00'
  task_commits:
    - task: EPIC-081/BP-001/TASK-001
      sha: a5051e3d
      intent_anchor: task-001
    - task: EPIC-081/BP-001/TASK-002
      sha: 3ed679c0
      intent_anchor: task-002
    - task: EPIC-081/BP-001/TASK-003
      sha: bc716e0e
      intent_anchor: task-003
    - task: EPIC-081/BP-001/TASK-005
      sha: bfd2d8f5
      intent_anchor: task-005
    - task: EPIC-081/BP-001/TASK-006
      sha: fde60545
      intent_anchor: task-006
  coordinator:
    base: d3566bf731e44c19fd6d197a5d644e6c2511daaf
    integration_head: fde60545d72621f8add3cb0aa66fd1b2ddb3fdcc
    integration_branch: feat/081-001-role-projection-print-dispatch-review-record
    revision: r4
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/workers/003
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/workers/005
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/081/001/workers/006
    tasks:
      - id: '001'
        status: integrated
        sha: 20a4b26e8336ab7adfa769c24c330102f9404a4c
        branch: bouncer/081-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - references/review/assets/reviewer-prompt.md
          - references/review/index.md
          - rules/cli.md
          - scripts/src/lib/cli-intent-command.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/intent-bundle.ts
          - scripts/src/lib/intent-provenance.ts
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/review-round.md
          - skills/bouncer-execute/references/verification-recovery.md
          - test/cli-project-commands.test.js
          - test/intent-bundle.test.js
          - test/intent-provenance.test.js
          - test/skill-bouncer-execute.test.js
      - id: '002'
        status: integrated
        sha: 00d64f08cfe0272023557e0c0bbd158933d3ce5f
        branch: bouncer/081-001-002
        scope_revision: r1
        paths:
          - scripts/src/lib/print-dispatch.ts
          - scripts/src/lib/cli-dispatch-command.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/codex-agents.ts
          - test/print-dispatch.test.js
          - test/cli-help.test.js
          - rules/cursor-print-dispatch.md
          - rules/cli.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-run/SKILL.md
          - docs/configuration.md
          - test/master-rules.test.js
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - .codex/agents/bouncer-coordinator.toml
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/configuration.md
          - rules/cli.md
          - rules/cursor-print-dispatch.md
          - scripts/src/lib/cli.ts
          - scripts/src/lib/codex-agents.ts
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/cli-help.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-run.test.js
          - scripts/src/lib/cli-dispatch-command.ts
          - scripts/src/lib/print-dispatch.ts
          - test/print-dispatch.test.js
      - id: '003'
        status: integrated
        sha: e8814d28c22f6b3c845b718f35fefb445e0d83b2
        branch: bouncer/081-001-003
        scope_revision: r2
        paths:
          - scripts/src/lib/review-record.ts
          - scripts/src/lib/validate-sections.ts
          - scripts/src/lib/cli-review-command.ts
          - scripts/src/lib/cli.ts
          - test/review-record.test.js
          - test/cli-help.test.js
          - rules/cli.md
          - skills/bouncer-execute/references/review-round.md
          - references/review/index.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-execute/SKILL.md
          - test/skill-bouncer-execute.test.js
          - test/agents.test.js
          - .codex/agents/bouncer-coordinator.toml
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - references/review/index.md
          - rules/cli.md
          - scripts/src/lib/cli.ts
          - scripts/src/lib/validate-sections.ts
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/review-round.md
          - test/agents.test.js
          - test/cli-help.test.js
          - test/skill-bouncer-execute.test.js
          - scripts/src/lib/cli-review-command.ts
          - scripts/src/lib/review-record.ts
          - test/review-record.test.js
      - id: '004'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '005'
        status: integrated
        sha: c276873a9542c475ceb5c1e7aa922bca23ee4ad5
        branch: bouncer/081-001-005
        scope_revision: r3
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/coordinator.test.js
          - test/seed-worktree.test.js
        actual_paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/coordinator.test.js
          - test/seed-worktree.test.js
      - id: '006'
        status: integrated
        sha: b868ca53e3448901ce520dc3f73c710dab1a2a18
        branch: bouncer/081-001-006
        scope_revision: r4
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/print-dispatch.ts
        actual_paths:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/print-dispatch.ts
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: a3b984e1bfa12d8cf8f3704cf70731d4ae5aa8eb271120c96e689f8223a7578e
        base_head: d3566bf731e44c19fd6d197a5d644e6c2511daaf
        initial_worktree_state: |
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: a3b984e1bfa12d8cf8f3704cf70731d4ae5aa8eb271120c96e689f8223a7578e
        outcome: accepted
        summary: Implementer completed intent sections CLI, tests, and guidance; execute gate passed; committed 20a4b26e8336ab7adfa769c24c330102f9404a4c. Scope impact none.
      - task: '001'
        decision: 'Accepted TASKS-001: intent sections CLI, tests, and guidance. Worker SHA 20a4b26e8336ab7adfa769c24c330102f9404a4c. Paths: scripts/src/lib/intent-provenance.ts scripts/src/lib/intent-bundle.ts scripts/src/lib/cli-intent-command.ts scripts/src/lib/cli-project-commands.ts test/intent-provenance.test.js test/intent-bundle.test.js test/cli-project-commands.test.js rules/cli.md skills/bouncer-execute/SKILL.md skills/bouncer-execute/references/agent-dispatch.md skills/bouncer-execute/references/review-round.md skills/bouncer-execute/references/verification-recovery.md references/review/assets/reviewer-prompt.md references/review/index.md test/skill-bouncer-execute.test.js'
      - kind: fanin
        tasks:
          - '001'
        base_head: d3566bf731e44c19fd6d197a5d644e6c2511daaf
        candidate_head: a5051e3d1a6cb6280260e8cc79fd319e60175132
        evidence_id: ff197bb7605366f7102c5b6ac965441adc082403d8b974a54314acca1c615230
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 698b32411692993c6d399d1b30fc48136de5fd4cb6bf961e190555bb7d2d3150
        base_head: a5051e3d1a6cb6280260e8cc79fd319e60175132
        initial_worktree_state: |
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 698b32411692993c6d399d1b30fc48136de5fd4cb6bf961e190555bb7d2d3150
        outcome: scope_revision
        summary: Implementer changed .codex/agents/bouncer-coordinator.toml for TOML/md parity after agents/bouncer-coordinator.md; path is outside affected_paths. Revise scope to include it.
      - task: '002'
        kind: scope
        reason: Changing agents/bouncer-coordinator.md requires regenerating .codex/agents/bouncer-coordinator.toml so test/agents.test.js TOML/md parity stays exact.
        previous:
          - scripts/src/lib/print-dispatch.ts
          - scripts/src/lib/cli-dispatch-command.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/codex-agents.ts
          - test/print-dispatch.test.js
          - test/cli-help.test.js
          - rules/cursor-print-dispatch.md
          - rules/cli.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-run/SKILL.md
          - docs/configuration.md
          - test/master-rules.test.js
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
        next:
          - scripts/src/lib/print-dispatch.ts
          - scripts/src/lib/cli-dispatch-command.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/codex-agents.ts
          - test/print-dispatch.test.js
          - test/cli-help.test.js
          - rules/cursor-print-dispatch.md
          - rules/cli.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-run/SKILL.md
          - docs/configuration.md
          - test/master-rules.test.js
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - .codex/agents/bouncer-coordinator.toml
        revision: r1
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 38e73a36ae99d4f20707a0034bec6cdcc4539f88b9153e1bbc281160f54b3267
        base_head: a5051e3d1a6cb6280260e8cc79fd319e60175132
        initial_worktree_state: |2
           M .codex/agents/bouncer-coordinator.toml
           M agents/bouncer-coordinator.md
           M docs/configuration.md
           M rules/cli.md
           M rules/cursor-print-dispatch.md
           M scripts/src/lib/cli.ts
           M scripts/src/lib/codex-agents.ts
           M skills/bouncer-run/SKILL.md
           M test/agents.test.js
           M test/cli-help.test.js
           M test/master-rules.test.js
           M test/skill-bouncer-run.test.js
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
          ?? scripts/src/lib/cli-dispatch-command.ts
          ?? scripts/src/lib/print-dispatch.ts
          ?? test/print-dispatch.test.js
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 38e73a36ae99d4f20707a0034bec6cdcc4539f88b9153e1bbc281160f54b3267
        outcome: accepted
        summary: Print dispatch CLI, tests, guidance, and coordinator TOML parity complete under revised scope r1. Scope impact none.
      - task: '002'
        decision: 'Accepted TASKS-002 attempt 2: dispatch print CLI, tests, guidance, coordinator TOML. SHA 00d64f08cfe0272023557e0c0bbd158933d3ce5f.'
      - kind: fanin
        tasks:
          - '002'
        base_head: a5051e3d1a6cb6280260e8cc79fd319e60175132
        candidate_head: 3ed679c0c7f1acdfda88380e121fbb2cd236d689
        evidence_id: d2af6804058ec672ef4b6b64b5e43c5678c4667e100011224caf4c291e617344
      - task: '003'
        kind: scope
        reason: This task changes agents/bouncer-coordinator.md and test/agents.test.js, which require regenerating .codex/agents/bouncer-coordinator.toml for md/TOML byte parity.
        previous:
          - scripts/src/lib/review-record.ts
          - scripts/src/lib/validate-sections.ts
          - scripts/src/lib/cli-review-command.ts
          - scripts/src/lib/cli.ts
          - test/review-record.test.js
          - test/cli-help.test.js
          - rules/cli.md
          - skills/bouncer-execute/references/review-round.md
          - references/review/index.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-execute/SKILL.md
          - test/skill-bouncer-execute.test.js
          - test/agents.test.js
        next:
          - scripts/src/lib/review-record.ts
          - scripts/src/lib/validate-sections.ts
          - scripts/src/lib/cli-review-command.ts
          - scripts/src/lib/cli.ts
          - test/review-record.test.js
          - test/cli-help.test.js
          - rules/cli.md
          - skills/bouncer-execute/references/review-round.md
          - references/review/index.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-execute/SKILL.md
          - test/skill-bouncer-execute.test.js
          - test/agents.test.js
          - .codex/agents/bouncer-coordinator.toml
        revision: r2
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: afcf403ceddcf2572e4ebe29570357806cab591a38e732f4213a935fcbbe0573
        base_head: 3ed679c0c7f1acdfda88380e121fbb2cd236d689
        initial_worktree_state: |
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: afcf403ceddcf2572e4ebe29570357806cab591a38e732f4213a935fcbbe0573
        outcome: accepted
        summary: review record CLI, tests, guidance, and coordinator TOML complete. Scope impact none.
      - task: '003'
        decision: 'Accepted TASKS-003: review record CLI, tests, guidance, coordinator TOML. SHA e8814d28c22f6b3c845b718f35fefb445e0d83b2.'
      - kind: fanin
        tasks:
          - '003'
        base_head: 3ed679c0c7f1acdfda88380e121fbb2cd236d689
        candidate_head: bc716e0e4b7aa088f0745b825a4f1006cb340108
        evidence_id: 5fb4d11ab7ff2f0d1c3d354965f8460fa36f22ad8b420c331b7d69f927dd7fc3
      - task: '005'
        kind: repair
        wave: 1
        reason: Terminal CI failed because verification integrate does not prepareDependencies on the integration checkout; call prepareDependencies(integration.integrationPath) before runVerification so a fresh/incomplete integration tree cannot fail npm run ci the same way.
        failure:
          task: '004'
          command: npm run ci
          summary: npm run ci ENOENT node_modules/js-yaml and missing typescript/bin/tsc because integrateVerificationTask never prepareDependencies on the integration checkout
          paths:
            - scripts/src/lib/coordinator.ts
            - scripts/src/lib/seed-worktree.ts
            - test/coordinator.test.js
            - test/seed-worktree.test.js
          exitCode: 1
          repairWave: 0
        previousDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '003'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '005'
          - id: '005'
            depends_on:
              - '003'
        previousScope: []
        nextScope:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - test/coordinator.test.js
          - test/seed-worktree.test.js
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r3
      - task: '005'
        kind: dispatch
        attempt: 1
        task_brief_hash: 575284be3afbd531b92832c07f5bc8a17f1d63e786f8498ba952ff64e24e1396
        base_head: bc716e0e4b7aa088f0745b825a4f1006cb340108
        initial_worktree_state: |
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
      - task: '005'
        kind: report
        attempt: 1
        task_brief_hash: 575284be3afbd531b92832c07f5bc8a17f1d63e786f8498ba952ff64e24e1396
        outcome: accepted
        summary: 'Repair: integrateVerificationTask prepareDependencies on integrationPath before runVerification; export prepareDependencies; tests. Scope impact none.'
      - task: '005'
        decision: 'Accepted TASKS-005 repair: prepareDependencies on integrationPath before runVerification. SHA c276873a9542c475ceb5c1e7aa922bca23ee4ad5. Paths: scripts/src/lib/coordinator.ts scripts/src/lib/seed-worktree.ts test/coordinator.test.js test/seed-worktree.test.js'
      - kind: fanin
        tasks:
          - '005'
        base_head: bc716e0e4b7aa088f0745b825a4f1006cb340108
        candidate_head: bfd2d8f5059c04cacce2a96cb6409d9530874828
        evidence_id: 62832a2eedf75de10ff39ba513ac353d1e0709204edbd37abc1bb52068d98767
      - task: '006'
        kind: repair
        wave: 2
        reason: Terminal CI lint max-len failed after install repair; wrap the dependency-install-failed hint and print-dispatch JSDoc/identity lines to 120 so npm run ci lint passes. print-dispatch is this blueprint's 002 source, not a new product.
        failure:
          task: '004'
          command: npm run ci
          summary: 'npm run ci lint max-len: coordinator.ts:2636 (125) and print-dispatch.ts:67,69,161 (135/125) after tests and coverage passed'
          paths:
            - scripts/src/lib/coordinator.ts
            - scripts/src/lib/print-dispatch.ts
          exitCode: 1
          repairWave: 1
        previousDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '005'
          - id: '005'
            depends_on:
              - '003'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '006'
          - id: '005'
            depends_on:
              - '003'
          - id: '006'
            depends_on:
              - '005'
        previousScope: []
        nextScope:
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/print-dispatch.ts
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r4
      - task: '006'
        kind: dispatch
        attempt: 1
        task_brief_hash: bca8def56d311d66ec02abf549174d270bb3f8be8d04e79a6f7b271755e22264
        base_head: bfd2d8f5059c04cacce2a96cb6409d9530874828
        initial_worktree_state: |
          ?? .bouncer/context/epics/081-cli-deterministic-procedures/
      - task: '006'
        kind: report
        attempt: 1
        task_brief_hash: bca8def56d311d66ec02abf549174d270bb3f8be8d04e79a6f7b271755e22264
        outcome: accepted
        summary: Wrap max-len 120 on coordinator hint and print-dispatch identity/JSDoc. Scope impact none.
      - task: '006'
        decision: 'Accepted TASKS-006 repair: wrap eslint max-len on coordinator hint and print-dispatch. SHA b868ca53e3448901ce520dc3f73c710dab1a2a18. Paths: scripts/src/lib/coordinator.ts scripts/src/lib/print-dispatch.ts'
      - kind: fanin
        tasks:
          - '006'
        base_head: bfd2d8f5059c04cacce2a96cb6409d9530874828
        candidate_head: fde60545d72621f8add3cb0aa66fd1b2ddb3fdcc
        evidence_id: 553d22771c39f28fd81925859bcd04f5b8eadd0fe5fc7c7b98c73155dbf442c7
      - task: '004'
        kind: verification-retry
        reason: 'User-authorized recovery: leftover scaffold HTML comments removed from untracked plan docs (lint:context-comments now ok); clear terminalFailure so verifying 004 can re-run integrate without a source repair wave (.bouncer/ paths cannot be repaired).'
        previous:
          task: '004'
          command: npm run ci
          summary: exit code 1
          paths:
            - scripts/src/lib/coordinator.ts
            - scripts/src/lib/print-dispatch.ts
          exitCode: 1
          repairWave: 2
---
# Explain

## Background
컨트롤러는 역할별 `intent_sections`, Cursor `agent --print` 디스패치, 리뷰 `rounds[]` 원장을 매 drive마다 손으로 조립했다. 이 드라이브는 그 세 절차를 각각 `bouncer intent sections`, `bouncer dispatch print`, `bouncer review record` 한 명령으로 옮기고, 실행 지침이 그 명령을 가리키게 한다.

계획 DAG는 `001 → 002 → 003 → 004`였다. 종단 `npm run ci`가 두 번 실패하면서 repair wave가 노드를 끼워 넣었다. wave 1은 004의 의존을 005로 옮기고 005는 003에 의존한다. wave 2는 004의 의존을 006으로 옮기고 006은 005에 의존한다. 최종 그래프는 `001 → 002 → 003 → 005 → 006`, 그리고 004는 006을 기다린다.

002는 `agents/bouncer-coordinator.md`를 바꾼 뒤 TOML/md 바이트 패리티를 위해 `.codex/agents/bouncer-coordinator.toml`을 범위에 넣는 r1 개정이다. 003도 같은 이유로 r2다. 005(r3)는 verification integrate가 integration checkout에 `prepareDependencies`를 호출하지 않아 `npm run ci`가 빈 `node_modules`에서 죽은 것을 고친다. 006(r4)은 같은 CI의 eslint `max-len`을 줄 바꿈으로 맞춘다. `.bouncer/` 스캐폴드 HTML 주석은 repair 경로가 아니라 verification-retry로 지운 뒤 004가 통과했다. 최종 리뷰 F1은 사용자가 3차 repair와 새 계획 없이 수용했다.

integration HEAD는 `fde60545d72621f8add3cb0aa66fd1b2ddb3fdcc` (`feat/081-001-role-projection-print-dispatch-review-record`). 워커 브랜치와 SHA는 001 `bouncer/081-001-001` `20a4b26e8336ab7adfa769c24c330102f9404a4c`, 002 `bouncer/081-001-002` `00d64f08cfe0272023557e0c0bbd158933d3ce5f`, 003 `bouncer/081-001-003` `e8814d28c22f6b3c845b718f35fefb445e0d83b2`, 005 `bouncer/081-001-005` `c276873a9542c475ceb5c1e7aa922bca23ee4ad5`, 006 `bouncer/081-001-006` `b868ca53e3448901ce520dc3f73c710dab1a2a18`이다. 004는 커밋 워커가 없다.

## Intuition
손조립 세 단계를 CLI 세 명령으로 바꾸고, fan-in과 종단 CI가 같은 설치 계약을 타게 한 뒤 줄 길이만 맞춘 드라이브다.

## Code
- `scripts/src/lib/cli-intent-command.ts`, `intent-bundle.ts`, `intent-provenance.ts` — `intent sections`
- `scripts/src/lib/print-dispatch.ts`, `cli-dispatch-command.ts` — `dispatch print`
- `scripts/src/lib/review-record.ts`, `cli-review-command.ts` — `review record`
- `scripts/src/lib/coordinator.ts`, `seed-worktree.ts` — verification integrate 앞 `prepareDependencies`
- `rules/cli.md`, `rules/cursor-print-dispatch.md`, `skills/bouncer-execute/references/agent-dispatch.md`, `skills/bouncer-execute/references/review-round.md`, `agents/bouncer-coordinator.md`

## Quiz
1. 계획 DAG에 대해 드라이브가 실제로 한 변경은?
   - A) 001과 002를 병렬로 바꿨다
   - B) 004가 005 다음 006을 기다리도록 종단 노드 의존만 옮겼다
   - C) 004를 삭제하고 검증을 003에 합쳤다
2. 005가 고친 실패 원인은?
   - A) fan-in candidate만 `prepareDependencies`/`npm ci` 되고 integration 경로는 그대로라 종단 CI가 빈 설치 트리에서 돌았다
   - B) `package-lock.json`이 없어서 `npm install`을 강제했다
   - C) coverage 기준이 94%에서 98%로 올랐다
3. 002 r1 개정의 이유는?
   - A) `scripts/src/lib/cli.ts`가 범위 밖이라서
   - B) `agents/bouncer-coordinator.md`를 바꾼 뒤 `test/agents.test.js` TOML/md 패리티를 위해 `.codex/agents/bouncer-coordinator.toml`을 범위에 넣었다
   - C) print dispatch를 002에서 빼고 003으로 옮겼다
4. 004가 두 repair 뒤에 다시 통과한 경로는?
   - A) 세 번째 `coordinate repair` wave
   - B) 사용자가 승인한 verification-retry로 `.bouncer/` 스캐폴드 HTML 주석을 지운 뒤 `integrate --task 004`
   - C) main checkout에서 `npm ci`만 돌렸다

## 이해 상태
정답: 1B, 2A, 3B, 4B. 사용자 응답: 1B, 2A, 3B, 4B. 전부 맞음. `quiz_score` 4/4. disposition: 네 문항 모두 정답. repair가 종단 004 의존만 옮긴 점, 005가 integration 설치 공백을 메운 점, 002 r1 TOML 패리티, 004 verification-retry를 확인함.

## Tasks

### EPIC-081/BP-001/TASK-001 · `a5051e3d`

#### Goal & intent

`bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger>`가 캐시된 intent bundle에서 역할별 Explain 절 본문을 JSON으로 낸다. controller는 이 출력을 그대로 역할 payload의 `intent_sections`로 넘긴다.
수용 기준은 epic Success criteria 1·2와, `rules/cli.md`·execute 지침이 이 명령을 가리키는 것(6의 해당 부분)이다.

#### Current behavior

- 지침은 "role-specific `intent_sections` projection"을 넘기라고만 한다(`skills/bouncer-execute/SKILL.md:72`, `skills/bouncer-execute/references/agent-dispatch.md:7`, `skills/bouncer-execute/references/review-round.md:15`). 역할마다 어떤 절이 들어가는지는 어디에도 정의돼 있지 않다.
- bundle record에는 함수별 `provenance.sections`가 `{ name, hash }`로만 있고 본문은 없다(`scripts/src/lib/intent-bundle.ts:63`의 `ProvenanceFields`). 본문을 꺼내는 명령이 없어서 감사 표본의 coordinator는 `intent-bundle.js`와 `cli-intent-command.js`를 읽어 직접 구성했다.
- 절 선택 allowlist는 `scripts/src/lib/intent-provenance.ts:737`의 `selectSections`와 `:813`의 `parseTaskDesign`이 정한다. Explain 수준의 Background·Intuition·Code와 task 수준의 Goal & intent·Current behavior·Target behavior·Interface·Touch·Constraints가 대상이다. hash projection은 `:770`의 `projectExplainSectionHashes`이고, 모듈 export는 `:955`에 있다.
- cache 위치는 task 경로 digest 하나로 정해진다(`scripts/src/lib/runtime-state.ts:915`의 `intentBundlePathFor`). record 읽기는 `scripts/src/lib/intent-bundle.ts:414`의 `readValidBundleRecord`, brief hash 계산은 `:276`의 `loadExecutionTask`, 저장 hash 대조는 `:576`의 `sectionHashesMatch`가 맡는다. export는 `resolveTaskIntentBundle` 하나뿐이다(`:877`).
- CLI 분기는 `scripts/src/lib/cli-intent-command.ts:49`의 `parseIntentArgs`가 한다. 첫 positional이 `bundle`이면 bundle이고 나머지는 query다. usage 문자열은 `scripts/src/lib/cli-project-commands.ts:469`의 `intent` 항목에 있다.
- `rules/cli.md`의 Read-only discovery 블록에는 `bouncer intent --symbol`만 있고 `intent bundle`은 없다.
- 재현: `node --test test/intent-bundle.test.js test/cli-project-commands.test.js`가 지금 통과한다. `bouncer intent sections`는 `sections`를 query 인자로 읽어 exit 2로 끝난다.

#### Target behavior

- 성공: 현재 task brief hash가 record의 `task_brief_hash`와 같고 resolved 함수의 절 hash가 저장값과 같으면 exit 0과 다음 JSON을 낸다.
  ```json
  { "ok": true, "role": "reviewer", "bundle_id": "…", "revision": 1, "task_brief_hash": "…",
    "functions": [{ "symbol": "f", "function_ref": "…", "explain": "…/explain.md", "freshness": "current",
      "sections": [{ "name": "Goal & intent", "body": "…" }] }] }
  ```
  `functions`에는 `status: resolved`이고 `provenance.freshness`가 `historical`이 아닌 함수만 bundle 순서대로 들어간다. `sections`는 역할 집합에 속한 task 절만 `selectSections` 순서대로 담는다. 역할 집합에 해당하는 절이 하나도 없는 함수는 `sections: []`로 남는다.
- 실패: 아래 경우 stdout에 `{ ok: false, reason, cause, next }`를 내고 exit 1로 끝난다. cache를 쓰지 않는다.
  - `reason: "intent-bundle-missing"`: cache 파일이 없거나 형식이 깨졌다. `next`는 `bouncer intent bundle --task <path> --symbol <name>...`.
  - `reason: "intent-bundle-stale"`: 현재 brief hash가 record와 다르다. `next`는 위와 같다.
  - `reason: "intent-sections-drift"`: resolved 함수 하나라도 Explain 절 hash가 저장값과 다르거나 Explain을 읽을 수 없다. `next`는 위와 같다.
- 보존: `intent --symbol` query 출력과 `intent bundle`의 생성·재사용 판정, record 형식, cache 경로는 바이트 단위로 같다.

#### Interface

- 제공
  - CLI `bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger> [--repo <dir>]`.
  - 역할 집합 상수: implementer = `Goal & intent`, `Current behavior`, `Target behavior`, `Interface`, `Touch`, `Constraints`. reviewer·debugger = `Goal & intent`, `Interface`, `Touch`, `Constraints`.
  - `scripts/src/lib/intent-provenance.ts` 새 export: 절 본문을 돌려주는 projection. `projectExplainSectionHashes`와 같은 경로 검사와 `selectSections` allowlist를 쓰고, 결과는 `SelectedSection[] | null`(`{ name, body }`)이다.
  - `scripts/src/lib/intent-bundle.ts` 새 export: `{ repoRoot, taskFile, role, deps? }`를 받아 위 성공 JSON 객체를 돌려주거나 `reason`이 담긴 Error를 throw한다. `deps`는 `resolveTaskIntentBundle`의 `BundleDeps`(`execFileSync`, `fs`, `platform`)와 같은 shape이다.
- 거부(exit 2, stderr usage): `--task` 또는 `--role` 누락이나 중복, 위 세 값 밖의 `--role`, `--symbol`·`--candidate`·`--limit` 같은 다른 형식의 옵션, 남는 positional.
- 거부(exit 1, `ok: false`): Target behavior의 세 `reason`. canonical이 아닌 task 경로는 `loadExecutionTask`가 이미 throw하는 메시지를 `cause`에 담아 `reason: "intent-task-invalid"`로 낸다.
- 출력하지 않는 것: Explain의 Background·Intuition·Code, historical·unlinked·unresolved·ambiguous 함수, 전체 Explain 본문.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/intent-provenance.ts` | `selectSections`, `projectExplainSectionHashes`, `신규 추출 지점: 절 본문 projection` | Modify | 절 allowlist 선택과 hash projection | 같은 경로 검사로 본문을 돌려주는 projection을 추가하고 export | 본문과 hash가 같은 allowlist에서 나와야 drift 판정이 의미를 가진다 |
| `scripts/src/lib/intent-bundle.ts` | `readValidBundleRecord`, `loadExecutionTask`, `sectionHashesMatch`, `신규 추출 지점: 역할 projection` | Modify | bundle 생성·재사용 | record를 읽어 brief hash·절 hash를 대조하고 역할 집합으로 거르는 함수 추가 | cache 경계 검사(`assertIntentPathInCommonDir`)와 record 검증을 재사용한다 |
| `scripts/src/lib/cli-intent-command.ts` | `parseIntentArgs`, `신규 추출 지점: sections 인자 파싱·실행` | Modify | query·bundle argv 분기 | `sections` 하위 명령의 인자 검증과 실행·JSON 출력 추가 | `intent` 명령의 유일한 argv 진입점이다 |
| `scripts/src/lib/cli-project-commands.ts` | `intent` usage | Modify | intent 도움말 문자열 | `intent sections` 줄 추가 | help가 레지스트리 usage로 조립된다 |
| `test/intent-provenance.test.js` | 본문 projection 테스트 | Modify | provenance 검사 | 본문 projection이 hash projection과 같은 이름·순서를 내는지 고정 | 새 export의 계약 |
| `test/intent-bundle.test.js` | 역할 projection 테스트 | Modify | bundle 재사용 검사 | 역할별 절 집합, historical 제외, missing·stale·drift 실패 고정 | Success criteria 1·2 |
| `test/cli-project-commands.test.js` | `intent help`, sections CLI 테스트 | Modify | intent CLI 검사 | help 줄과 sections argv 거절(exit 2)·성공 JSON 고정 | CLI 계약 |
| `rules/cli.md` | Read-only discovery 블록 | Modify | CLI 명령 목록 | `intent bundle`, `intent sections` 형식과 결과 처리 한 문단 추가 | Success criteria 6 |
| `skills/bouncer-execute/SKILL.md` | step 1 Intent bundle 문단 | Modify | bundle 1회 resolve 지시 | 역할 payload마다 `bouncer intent sections --role <r>` 출력을 넣으라고 지시 | projection 손조립 제거 |
| `skills/bouncer-execute/references/agent-dispatch.md` | 첫 문단, Named implementer, 리뷰 문단 | Modify | 역할 payload 구성 | `intent_sections`의 출처를 `intent sections --role`로 명시 | 같은 지시의 세 위치 |
| `skills/bouncer-execute/references/review-round.md` | `1 freeze`, Round ledger contract | Modify | 리뷰 라운드 고정값 | reviewer `intent_sections`의 출처를 명령으로 명시 | reviewer projection |
| `skills/bouncer-execute/references/verification-recovery.md` | debugger payload 문단 | Modify | debugger 디스패치 입력 | debugger `intent_sections`의 출처를 명령으로 명시 | debugger projection |
| `references/review/assets/reviewer-prompt.md` | `{{INTENT_SECTIONS}}` 설명 | Modify | reviewer prompt 채움 규칙 | 값의 출처를 `intent sections --role reviewer` 출력으로 명시 | controller가 채우는 자리 |
| `references/review/index.md` | Payload 문단(`intent_sections` projection 전달 지시) | Modify | reviewer payload 구성 지시 | 전달할 값이 `intent sections --role reviewer` 출력임을 명시 | controller에게 projection 전달을 지시하는 위치 |
| `test/skill-bouncer-execute.test.js` | intent bundle 지시 테스트 | Modify | execute 지침 문구 고정 | `intent sections --role` 문구 assertion 추가 | 지침 계약 회귀 방지 |

#### Constraints

- `intent sections`는 cache를 쓰지 않고 Git provenance resolver를 부르지 않는다. 판정은 record, 현재 brief 바이트, 현재 Explain 파일만으로 한다.
- 본문 projection은 `projectExplainSectionHashes`와 같은 canonical 경로 검사와 symlink 경계 검사를 거친다. 두 함수의 allowlist가 갈라지지 않게 공통 선택 경로를 쓴다.
- `bundle` 경로가 늦게 적재(lazy require)하는 구조를 유지한다. `sections` 경로도 유효한 argv를 확인한 뒤에만 `intent-bundle`을 적재한다.
- 새 주석은 한국어로 쓰고 `npm run lint:context-comments` 규칙을 따른다. 소스는 `scripts/src/lib/*.ts`만 고치고, `scripts/lib/*.js`는 `npm run build` 산출물로만 바꾼다.
- 지침 문서는 `intent_sections`가 advisory data이고 brief 권한을 바꾸지 않는다는 기존 문장을 유지한다.

### EPIC-081/BP-001/TASK-002 · `3ed679c0`

#### Goal & intent

`bouncer dispatch print --role <role> --cwd <dir> --input <file> --out <dir>` 한 번으로 Cursor print 디스패치를 끝낸다. 명령 하나가 prompt 파일 조립, model 선택, `agent --print` foreground 실행, 마지막 `result` 이벤트 추출을 맡는다. controller는 역할 본문과 명령 템플릿을 문맥에 싣지 않고 controller 입력 파일만 만든다.
수용 기준은 epic Success criteria 3·4와, `rules/cursor-print-dispatch.md`·`rules/cli.md`·coordinator·run 지침이 이 명령을 가리키는 것(6의 해당 부분)이다.

#### Current behavior

- `rules/cursor-print-dispatch.md` 3~6항이 손조립 절차를 정한다. 식별 줄 두 종류, `agent --print --force --trust --output-format stream-json --workspace <cwd> [--model <slug>] -- "$(cat <prompt-file>)" </dev/null >"<out>.jsonl" 2>"<err>.log"`, foreground 대기, 마지막 `result` 이벤트가 report라는 규칙이 여기 있다. `rules/subagent-model.md` 4·5항은 fallback payload가 역할 문서 본문 전체라고 정한다.
- 감사 표본(`token-cost-audit.md` 3.4)에서는 리뷰어 디스패치 명령 하나에 payload 18.6K자가 인라인으로 들어갔다.
- 역할 문서는 `agents/bouncer-<role>.md`이고 frontmatter 분리는 `scripts/src/lib/frontmatter.ts:20`의 `parseFrontmatter`가 한다. 플러그인 `agents/` 경로 계산은 `scripts/src/lib/codex-agents.ts:26`의 `pluginAgentsDir`인데 export되지 않는다(`:187` export 목록).
- model은 `scripts/src/lib/subagents.ts:51`의 `resolveSubagentModel({ repoRoot, agentName })`이 `{ model: string | null }`로 준다. 설정은 `scripts/src/lib/config.ts:124`의 `readConfig(repoRoot)`가 읽는다(부재·손상은 `null`).
- 이 동작을 하는 명령은 없다. `scripts/src/lib/cli.ts:27`의 `COMMANDS` 레지스트리에 `dispatch` 키가 없고, `test/cli-help.test.js:7`의 `SUBCOMMANDS`가 help 목록을 고정한다.
- 지침 문구 회귀 테스트: `test/master-rules.test.js:593` 이후(cursor 규칙 문자열), `test/agents.test.js:369`(coordinator), `test/skill-bouncer-run.test.js:178`(run).

#### Target behavior

- 성공: 설정이 `subagents.provider: "cursor"`이고 `subagents.dispatch: "print"`이며, `agent status`가 exit 0이고 stdout·stderr에 대소문자 무시 `not logged in`이 없으며, 실행이 exit 0이고, stdout의 마지막 `result` 이벤트가 `is_error`가 아니면 다음 JSON과 exit 0을 낸다.
  ```json
  { "ok": true, "role": "reviewer", "model": "slug-or-null", "exit_code": 0,
    "report": "<result.result 문자열>", "prompt": "<out>/bouncer-reviewer.prompt.md",
    "stdout": "<out>/bouncer-reviewer.jsonl", "stderr": "<out>/bouncer-reviewer.log" }
  ```
- prompt 파일은 순서대로 다음을 담는다.
  1. 식별 줄 한 줄. worker·reviewer는 `You are the dispatched bouncer-<role> itself. Do this role's work directly and never dispatch any Bouncer agent.`이고, coordinator는 `You are the dispatched bouncer-coordinator itself. Dispatch only your workers, each under rules/cursor-print-dispatch.md.`이다.
  2. 빈 줄 뒤 frontmatter를 뺀 역할 문서 본문 전체.
  3. 빈 줄 뒤 `--input` 파일 내용 그대로.
- 실행 argv는 `agent --print --force --trust --output-format stream-json --workspace <cwd> [--model <slug>] -- <prompt 내용>`이다. `--model`은 `resolveSubagentModel`의 `model`이 `null`이 아닐 때만 넣는다. stdin은 `/dev/null`과 같은 빈 입력이고, stdout·stderr는 파이프를 거치지 않고 파일 descriptor로 직접 받는다. 실행은 `cwd: <cwd>`이고 끝날 때까지 기다린다.
- 실패(stdout `{ ok: false, reason, cause, next }`, exit 1):
  - `print-dispatch-disabled`: 실행 전 설정이 cursor·print가 아니다. `next`는 `rules/subagent-model.md` items 2-4로 디스패치하라는 안내다.
  - `agent-unavailable`: `agent`가 PATH에 없거나, `agent status`가 0이 아닌 exit로 끝났거나, 그 출력에 대소문자 무시 `not logged in`이 있다. `next`는 `agent login` 뒤 재시도다.
  - `agent-exit-nonzero`: 실행 exit가 0이 아니다. 출력에 `exit_code`, `stdout`, `stderr` 경로를 함께 담는다.
  - `result-missing`: stdout에 `type: "result"` 이벤트가 없다.
  - `result-error`: 마지막 `result`의 `is_error`가 true다. `report`에 그 `result` 문자열을 담는다.
- 보존: 이 명령은 Task subagent로 fallback하지 않는다. 같은 `--out`에 같은 역할을 다시 실행하면 세 파일을 덮어쓴다. 여러 역할을 한 wave에서 돌릴 때는 호출자가 각 명령을 background로 띄운 뒤 `wait`한다(규칙 5항 유지).

#### Interface

- 제공
  - CLI `bouncer dispatch print --role <implementer|reviewer|debugger|coordinator> --cwd <dir> --input <file> --out <dir> [--repo <dir>]`. 설정과 역할 model은 `--repo`(없으면 process cwd)의 `.bouncer/config.json`에서 읽는다.
  - 새 모듈 `scripts/src/lib/print-dispatch.ts`. 조립 함수는 `{ role, roleMarkdown, input } → string`(prompt 본문)이다. 실행 함수는 `{ repoRoot, role, cwd, inputFile, outDir, deps? }`를 받아 위 성공·실패 객체를 돌려준다.
  - 테스트 seam: `deps.agentBin?: string`(기본 `agent`)과 `deps.agentsDir?: string`(기본 플러그인 `agents/`). 테스트는 임시 디렉터리의 실행 파일을 `agentBin`으로 넘기고, 그 실행 파일이 받은 argv를 파일로 남겨 assertion한다.
- 거부(exit 2, stderr usage): `print` 밖의 하위 명령, `--role`·`--cwd`·`--input`·`--out` 누락이나 중복, 네 역할 밖의 `--role`.
- 거부(exit 1, `ok: false`, 실행 전): `--input` 파일이나 `--cwd` 디렉터리가 없을 때(`reason: "dispatch-input-invalid"`), 역할 문서가 없거나 frontmatter가 깨졌을 때(`reason: "role-document-invalid"`).
- 도메인 용어: "역할 본문"은 `parseFrontmatter(markdown).body`에서 앞뒤 빈 줄을 뗀 문자열이다. 예: `agents/bouncer-reviewer.md`의 `# Bouncer reviewer`부터 Output contract 끝까지.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/print-dispatch.ts` | `신규 추출 지점: prompt 조립`, `신규 추출 지점: print 실행·result 추출` | Create | 없음 | 조립·설정 검사·`agent status`·실행·stream-json 파싱 | 결정적 절차를 한 모듈에 둔다 |
| `scripts/src/lib/cli-dispatch-command.ts` | `신규 추출 지점: dispatch argv 파싱·실행` | Create | 없음 | argv 검증, exit 0/1/2 매핑, JSON 출력 | `cli-review-dispatch-command.ts`와 같은 명령 모듈 구조 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 명령 레지스트리와 help 조립 | `dispatch` 키 등록 | 미등록 명령은 unknown command다 |
| `scripts/src/lib/codex-agents.ts` | `pluginAgentsDir`, export 목록 | Modify | 플러그인 `agents/` 경로 계산 | `pluginAgentsDir` export 추가 | 역할 문서 경로를 같은 기준으로 찾는다 |
| `test/print-dispatch.test.js` | 조립·실행 테스트 | Create | 없음 | prompt 순서, argv, 성공·실패 reason 고정 | Success criteria 3·4 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | help 목록 고정 | `dispatch` 추가 | 레지스트리 계약 |
| `rules/cursor-print-dispatch.md` | 3~6항 | Modify | 손조립 payload·명령·대기·report 규칙 | 3~6항을 `bouncer dispatch print` 호출과 결과 처리로 바꾸고, 식별 줄·argv 규칙은 명령이 보장한다고 적는다 | Success criteria 6 |
| `rules/cli.md` | 새 dispatch 블록 | Modify | CLI 명령 목록 | `dispatch print` 형식과 `reason` 처리 추가 | Success criteria 6 |
| `agents/bouncer-coordinator.md` | worker dispatch 문단(print opt-in) | Modify | print worker 디스패치 지시 | worker마다 `bouncer dispatch print`를 쓰라고 지시 | coordinator가 주 소비자 |
| `skills/bouncer-run/SKILL.md` | coordinator dispatch 단계 | Modify | coordinator print 디스패치 지시 | `bouncer dispatch print --role coordinator`를 쓰라고 지시 | run이 coordinator를 띄운다 |
| `docs/configuration.md` | `subagents.dispatch` 설명 | Modify | print opt-in 사용자 설명 | 명령이 디스패치를 맡는다는 한 문장 추가 | 사용자 문서 정합 |
| `test/master-rules.test.js` | cursor 규칙 assertion | Modify | 손조립 문구 고정 | 명령 기반 문구로 바꾸고 `--`·`tee`·`result` 규칙은 명령 계약 문구로 고정 | 지침 회귀 방지 |
| `test/agents.test.js` | coordinator print 문구 assertion | Modify | coordinator 문구 고정 | `bouncer dispatch print` 문구 assertion으로 조정 | 지침 회귀 방지 |
| `test/skill-bouncer-run.test.js` | run print 문구 assertion | Modify | run 문구 고정 | `bouncer dispatch print --role coordinator` 문구로 조정 | 지침 회귀 방지 |

#### Constraints

- 실행은 `child_process.spawnSync`처럼 shell 없는 argv 실행만 쓴다. `$(cat …)`이나 shell 문자열을 만들지 않는다. stdout·stderr는 `fs.openSync`로 연 fd를 `stdio`에 넘기고 `tee`나 pipe reader를 두지 않는다.
- 시간 제한을 두지 않는다. 대기 예산은 호출자 몫이다(`rules/cursor-print-dispatch.md` 5항).
- 설정이 cursor·print가 아니면 prompt 파일도 만들지 않고 끝낸다.
- 식별 줄 문자열은 현재 `rules/cursor-print-dispatch.md` 3항과 바이트 단위로 같게 유지한다.
- 새 주석은 한국어로 쓰고 `npm run lint:context-comments` 규칙을 따른다. 소스는 `scripts/src/lib/*.ts`만 고친다.

### EPIC-081/BP-001/TASK-003 · `bc716e0e`

#### Goal & intent

`bouncer review record --blueprint <dir> [--task <ddd>] --round <json> [--status <s>]`가 리뷰 라운드 하나와 finding 갱신을 `review.md` frontmatter에 기록한다. 쓰기 전에 G21·G14와 같은 `collectFindingFailures` 검사를 적용해, 통과할 때만 파일을 바꾼다. controller는 YAML을 직접 편집하지 않고 validator 소스를 읽지 않는다.
수용 기준은 epic Success criteria 5와, `rules/cli.md`·리뷰 지침이 이 명령을 가리키는 것(6의 해당 부분)이다.

#### Current behavior

- `skills/bouncer-execute/references/review-round.md`의 Round ledger contract는 controller가 `bouncer.review.rounds[]`와 `findings[]`를 `review.md`에 기록하라고 한다. 완결 예제는 `references/spec-authoring/review-rounds.md`다. 기록 명령은 없어서 frontmatter를 손으로 편집한다.
- 형식 검사는 `scripts/src/lib/validate-sections.ts:247`의 `collectFindingFailures`가 한다. 라운드 검사는 `:344`의 `collectRoundFailures`, fingerprint 정규화는 `:206`의 `findingFingerprint`이고, 허용 status는 `:38`의 `EXECUTE_REVIEW_STATUS`(`resolved`, `accepted`, `deferred`)다. mode 순서는 `:87`에서 `discovery`, `discovery,delta`, `discovery,delta,critical_recovery,delta`만 완결로 인정한다. 그래서 `discovery,delta,critical_recovery`처럼 진행 중인 원장도 `rounds sequence invalid`가 된다.
- gate 호출부: blueprint 리뷰 모드는 `scripts/src/lib/validate-gates.ts:264`의 `checkG21`, task 리뷰는 `:887` 부근 G14다. 둘 다 `allowedStatuses: EXECUTE_REVIEW_STATUS`와 `reviewStatus: statusOf(reviewDoc)`를 넘긴다.
- 문서 status enum은 `scripts/src/lib/schema.ts:36`의 `'bouncer.review': ['pending', 'requested', 'addressed', 'accepted']`다.
- 리뷰 모드 판정은 blueprint `index.md`의 `bouncer.review_scope === 'blueprint'`다(`scripts/src/lib/scaffold.ts:106`의 `isBlueprintReviewScope`, `scripts/src/lib/finalize.ts:357`의 `isBlueprintReviewScopeAt`). 문서 읽기는 `scripts/src/lib/frontmatter.ts:20`의 `parseFrontmatter`, 쓰기는 `scripts/src/lib/render.ts:8`의 `renderDoc`다.
- 재현: scaffold된 blueprint의 루트 `review.md`(본문에 `## Findings`, frontmatter `review.required: true`, status `pending`)에 손으로 rounds를 쓰고 `bouncer validate --gate finalize`를 돌려야 형식 오류를 알 수 있다.

#### Target behavior

- 입력 JSON(`--round` 파일)은 다음 shape이다.
  ```json
  { "round": { "round": 1, "mode": "discovery", "target": { "base": "…", "head": "…" },
      "perspectives": [{ "name": "combined", "target_head": "…" }], "previous_finding_ids": [],
      "new": 1, "resolved": 0, "regressed": 0 },
    "findings": [{ "id": "F1", "severity": "major", "status": "resolved", "category": "correctness",
      "brief_clause": "tasks/001 Interface", "file": "scripts/lib/x.js", "symbol": "f",
      "actionability": "must_fix", "origin": "discovery", "first_seen_round": 1, "last_seen_round": 1 }] }
  ```
  `round` 객체의 나머지 키(`task_brief_hashes`, `intent_bundles`, `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, `intent_sections`, verify 결과 등)는 그대로 보존해 기록한다.
- 성공: 다음 순서로 처리하고, stdout `{ ok: true, path, round, status, findings }`와 exit 0을 낸다.
  1. `round.round`가 기존 rounds 길이 + 1이면 rounds 끝에 붙인다.
  2. findings는 `id`가 같은 기존 항목을 통째로 바꾸고, 새 `id`는 끝에 붙인다.
  3. `fingerprint`가 없는 finding에는 `findingFingerprint`로 계산한 값을 채운다.
  4. `--status`가 있으면 문서 `bouncer.status`를 그 값으로 바꾼다.
  5. 합친 결과에 `collectFindingFailures`를 G21·G14와 같은 인자로 돌린다.
  6. 실패 메시지가 0건이면 같은 디렉터리의 임시 파일에 쓰고 rename한다.
  `findings` 출력은 기록 뒤 finding 수다.
- 진행 중 원장 예외: 실패 메시지가 `review rounds sequence invalid` 하나뿐이고, 기록 뒤 mode 순서가 허용 순서 중 하나의 앞부분이며, 기록 뒤 status가 `accepted`가 아니면 통과로 본다.
- 실패(stdout `{ ok: false, reason, cause, next }`, exit 1, 파일 바이트 불변):
  - `review-target-missing`: 대상 `review.md`가 없다.
  - `review-task-required`: `review_scope`가 `blueprint`가 아닌데 `--task`가 없다.
  - `review-task-not-allowed`: `review_scope`가 `blueprint`인데 `--task`가 있다.
  - `review-input-invalid`: `--round` JSON 파싱 실패, `round` 객체 없음, `findings`가 배열이 아님.
  - `review-round-out-of-sequence`: `round.round`가 기존 rounds 길이 + 1이 아니다.
  - `review-ledger-invalid`: 진행 중 원장 예외로도 통과하지 못한 `collectFindingFailures` 메시지가 남았다. `cause`에 메시지 배열을 담는다. 예를 들어 열린 must_fix가 남은 채 `--status accepted`이면 `review accepted with open must_fix F1`이 담긴다.
- 보존: 본문, `review.required`, 기타 frontmatter 키는 그대로 둔다. finding status enum과 gate 판정은 바뀌지 않는다. 명령 없이 손으로 쓴 기존 `review.md`도 그대로 gate를 통과하거나 실패한다.

#### Interface

- 제공
  - CLI `bouncer review record --blueprint <dir> [--task <ddd>] --round <json-file> [--status <requested|addressed|accepted>] [--repo <dir>]`.
  - 새 모듈 `scripts/src/lib/review-record.ts`. 함수 하나가 `{ repoRoot, blueprintDir, task, roundFile, status }`를 받아 위 성공 객체를 돌려주거나 `reason`·`cause`가 담긴 실패 객체를 돌려준다. 파일 I/O는 `node:fs` 직접 호출이다(테스트는 임시 디렉터리 fixture를 쓴다).
- 거부(exit 2, stderr usage): `record` 밖의 하위 명령, `--blueprint`·`--round` 누락, 옵션 중복, 세 자리 숫자가 아닌 `--task`, 허용 밖의 `--status`(`pending` 포함).
- 거부(exit 1): Target behavior의 여섯 `reason`.
- 도메인 용어: "허용 순서의 앞부분"은 `EXECUTE_ROUND_CONTRACT.sequences`의 한 원소를 `,`로 나눈 배열의 길이 n 앞부분이다. 예: `discovery,delta,critical_recovery`는 `discovery,delta,critical_recovery,delta`의 앞부분이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-record.ts` | `신규 추출 지점: round·finding 병합과 검증 후 기록` | Create | 없음 | 대상 결정, 병합, fingerprint 채움, 검증, 원자적 쓰기 | 기록 절차를 한 모듈에 둔다 |
| `scripts/src/lib/validate-sections.ts` | `EXECUTE_ROUND_CONTRACT`, export 목록 | Modify | round 계약 상수(모듈 내부) | export 목록에 `EXECUTE_ROUND_CONTRACT` 추가 | 진행 중 원장 판정이 같은 순서 목록을 읽어야 규칙을 복제하지 않는다 |
| `scripts/src/lib/cli-review-command.ts` | `신규 추출 지점: review argv 파싱·실행` | Create | 없음 | argv 검증, exit 0/1/2 매핑, JSON 출력 | 명령 모듈 구조 유지 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 명령 레지스트리와 help 조립 | `review` 키 등록 | 미등록 명령은 unknown command다 |
| `test/review-record.test.js` | 기록 테스트 | Create | 없음 | 성공·진행 중 원장·여섯 실패와 파일 불변 고정 | Success criteria 5 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | help 목록 고정 | `review` 추가 | 레지스트리 계약 |
| `rules/cli.md` | 새 review 블록 | Modify | CLI 명령 목록 | `review record` 형식과 `reason` 처리 추가 | Success criteria 6 |
| `skills/bouncer-execute/references/review-round.md` | Round ledger contract | Modify | 원장 기록 지시 | 각 상태 전이를 `bouncer review record`로 기록하라고 지시하고 직접 YAML 편집을 금지 | 손기록 제거 |
| `references/review/index.md` | controller 기록 문단 | Modify | review 기록 책임 | 기록 수단을 `review record`로 명시 | 같은 지시의 다른 위치 |
| `agents/bouncer-coordinator.md` | blueprint 리뷰 기록 문단 | Modify | 루트 `review.md` rounds 기록 지시 | `bouncer review record`로 기록하라고 지시 | coordinator가 주 소비자 |
| `skills/bouncer-execute/SKILL.md` | review·accept 단계 | Modify | 리뷰 status 전환 지시 | status 전환을 `review record --status`로 하라고 지시 | 단독 실행 경로 |
| `test/skill-bouncer-execute.test.js` | 리뷰 기록 문구 테스트 | Modify | execute 지침 문구 고정 | `bouncer review record` assertion 추가 | 지침 회귀 방지 |
| `test/agents.test.js` | coordinator 리뷰 기록 assertion | Modify | coordinator 문구 고정 | `bouncer review record` assertion 추가 | 지침 회귀 방지 |

#### Constraints

- `scripts/src/lib/validate-sections.ts`에서는 export 목록에 `EXECUTE_ROUND_CONTRACT`를 더하는 것만 허용한다. 상수 값과 검사 함수는 바꾸지 않는다.
- 판정은 `collectFindingFailures`를 그대로 호출해 얻는다. 검사 규칙을 이 모듈에 복제하지 않는다. 유일한 예외는 Target behavior의 진행 중 원장 규칙이다.
- 실패하면 대상 파일과 임시 파일을 남기지 않는다. 성공 쓰기는 같은 디렉터리 임시 파일 + `renameSync`다.
- YAML 직렬화는 `renderDoc`을 쓴다. 기존 frontmatter 키 순서를 유지하고, 새 키(`rounds`, `findings`)만 `bouncer.review` 아래에 더한다.
- 이 명령은 status를 `--status`로 받은 값으로만 바꾼다. finding 내용으로 status를 추론하지 않는다.
- 새 주석은 한국어로 쓰고 `npm run lint:context-comments` 규칙을 따른다. 소스는 `scripts/src/lib/*.ts`만 고친다.

### EPIC-081/BP-001/TASK-004

#### Goal & intent

TASKS-001~003이 모두 통합된 integration checkout에서 전체 CI가 통과함을 증명한다(epic Success criteria 7). 산출물 동기화(`check:emit`), 커버리지 기준, lint, 지침 주석 규칙, typecheck가 대상이다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-081/BP-001/TASK-005 · `bfd2d8f5`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/seed-worktree.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/coordinator.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/seed-worktree.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### EPIC-081/BP-001/TASK-006 · `fde60545`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/print-dispatch.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.