---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-24T16:33:08.643+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '078'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 9c4982cc0e31f9bff274a59d24bfa9f28404db31
      range_to: 94f4cdadde568986c971c0e98716c18fee15a1d2
      diff_sha: 055f28ca8ec7078a837812c3ad1e46ed71b4164413fb0463010f296ebbf7a4d3
      quiz_score: 4/5
      disposition: Q4만 오답 — links는 push된 GitHub head에서만 URL을 주고, Explain published만으로는 부족하다.
      recorded_at: '2026-09-24T16:34:42+09:00'
  task_commits:
    - task: EPIC-078/BP-002/TASK-001
      sha: 5407beac
      intent_anchor: task-001
    - task: EPIC-078/BP-002/TASK-002
      sha: fcd7655e
      intent_anchor: task-002
    - task: EPIC-078/BP-002/TASK-003
      sha: bdcf0947
      intent_anchor: task-003
    - task: EPIC-078/BP-002/TASK-004
      sha: 3b421787
      intent_anchor: task-004
    - task: EPIC-078/BP-002/TASK-006
      sha: 6b05c713
      intent_anchor: task-006
    - task: EPIC-078/BP-002/TASK-007
      sha: 94f4cdad
      intent_anchor: task-007
  coordinator:
    base: 9c4982cc0e31f9bff274a59d24bfa9f28404db31
    integration_head: 94f4cdadde568986c971c0e98716c18fee15a1d2
    integration_branch: feat/078-002-finalize-digest
    revision: r2
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/003
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/004
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/006
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/078/002/workers/007
    tasks:
      - id: '001'
        status: integrated
        sha: 2c53599604d738e0f7fd9e2a91b4259c7a1b83eb
        branch: bouncer/078-002-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/finalize-digest.js
          - scripts/lib/finalize.js
          - scripts/lib/task-commits.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/finalize.ts
          - test/cli-help.test.js
          - scripts/src/lib/finalize-digest.ts
          - scripts/src/lib/task-commits.ts
          - test/finalize-digest.test.js
      - id: '002'
        status: integrated
        sha: 2e472c662b500446dbab9945617e27f28151a68d
        branch: bouncer/078-002-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/finalize-digest.js
          - scripts/lib/finalize-pr.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/finalize-digest.ts
          - test/cli-help.test.js
          - test/finalize-digest.test.js
          - scripts/src/lib/finalize-pr.ts
          - test/finalize-pr.test.js
      - id: '003'
        status: integrated
        sha: 7431f64cb34177505c44add9189ed91d42fc69d2
        branch: bouncer/078-002-003
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/finalize.js
          - scripts/lib/intent-provenance.js
          - scripts/lib/templates.js
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/intent-provenance.ts
          - scripts/src/lib/templates.ts
          - test/finalize-pure.test.js
          - test/finalize.test.js
          - test/intent-provenance.test.js
          - test/retention-migration.test.js
      - id: '004'
        status: integrated
        sha: 7131f7e4d1fc66685cd4929883c5a8b64b5ee651
        branch: bouncer/078-002-004
        scope_revision: null
        paths: []
        actual_paths:
          - references/explain-diff/index.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/draft-pr.md
          - skills/bouncer-finalize/references/explain-quiz.md
          - test/skill-bouncer-finalize.test.js
          - test/skill-explain-diff.test.js
      - id: '005'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '006'
        status: integrated
        sha: 75e966cfa1a8e606d66092d9e18e36e89e2070ff
        branch: bouncer/078-002-006
        scope_revision: r1
        paths:
          - scripts/src/lib/finalize-digest.ts
          - scripts/lib/finalize-digest.js
          - test/finalize-digest.test.js
        actual_paths:
          - scripts/lib/finalize-digest.js
          - scripts/src/lib/finalize-digest.ts
          - test/finalize-digest.test.js
      - id: '007'
        status: integrated
        sha: 94f4cdadde568986c971c0e98716c18fee15a1d2
        branch: bouncer/078-002-007
        scope_revision: r2
        paths:
          - test/finalize-digest.test.js
          - test/finalize-pr.test.js
          - scripts/src/lib/finalize-digest.ts
          - scripts/lib/finalize-digest.js
        actual_paths:
          - test/finalize-digest.test.js
          - test/finalize-pr.test.js
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: d6bf2e6503874a38effe04d94450dddfdc2d83b13c063f37e97440c19b4469ae
        base_head: 9c4982cc0e31f9bff274a59d24bfa9f28404db31
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: d6bf2e6503874a38effe04d94450dddfdc2d83b13c063f37e97440c19b4469ae
        outcome: accepted
        summary: 'Implementer attempt 1: finalize prepare digest (task-commits, finalize-digest, CLI, tests); npm test 1537 pass; scope impact none'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: 0bff4973b804817084c4a3004cb7d487900ed4c76e1f673f9ddb9da96de06e18
        base_head: 9c4982cc0e31f9bff274a59d24bfa9f28404db31
        initial_worktree_state: |
          M  scripts/lib/cli-git-commands.js
          A  scripts/lib/finalize-digest.js
          M  scripts/lib/finalize.js
          A  scripts/lib/task-commits.js
           M scripts/src/lib/cli-git-commands.ts
           M scripts/src/lib/finalize.ts
           M test/cli-help.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
          ?? scripts/src/lib/finalize-digest.ts
          ?? scripts/src/lib/task-commits.ts
          ?? test/finalize-digest.test.js
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: 0bff4973b804817084c4a3004cb7d487900ed4c76e1f673f9ddb9da96de06e18
        outcome: accepted
        summary: 'Fix batch attempt 2: F-001..F-004 and F-SEC-001; npm test 1539 pass; scope none'
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: 10f83fd38f4cbc109a056855fdca2a661548b990219fba9122eea5b91a82ec3f
        base_head: 2c53599604d738e0f7fd9e2a91b4259c7a1b83eb
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: 10f83fd38f4cbc109a056855fdca2a661548b990219fba9122eea5b91a82ec3f
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 2 (status verified, commit_sha 2c535996 stamp); brief authority sections byte-identical; attempt 2 accepted result carried forward'
      - task: '001'
        decision: 'accepted TASKS-001 at 2c535996 (branch bouncer/078-002-001; implementer attempts 1-2 + re-baseline 3; reviewers combined+security discovery, delta; F-001..F-004 and F-SEC-001 resolved; F-005 and F-SEC-002 advisory accepted; verify npm test). changed paths: scripts/src/lib/finalize-digest.ts, scripts/lib/finalize-digest.js, scripts/src/lib/task-commits.ts, scripts/lib/task-commits.js, scripts/src/lib/finalize.ts, scripts/lib/finalize.js, scripts/src/lib/cli-git-commands.ts, scripts/lib/cli-git-commands.js, test/finalize-digest.test.js, test/cli-help.test.js'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: d5083abdf0f7ca2a7750712d23109bb6dd793a5b37e9b2b6087a29b862ca02a6
        base_head: 5407beaceba6672c2da628a991295f33c6f8034f
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: d5083abdf0f7ca2a7750712d23109bb6dd793a5b37e9b2b6087a29b862ca02a6
        outcome: accepted
        summary: 'Implementer attempt 1: finalize-pr draft+links, digest pr field, CLI links; npm test 1548 pass; scope none'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 028a2aca6ce2d7d7157d9cacc8a904c9a71eaa2f9c283b6bb4f63a4b034eae6d
        base_head: 5407beaceba6672c2da628a991295f33c6f8034f
        initial_worktree_state: |
          M  scripts/lib/cli-git-commands.js
          M  scripts/lib/finalize-digest.js
          A  scripts/lib/finalize-pr.js
           M scripts/src/lib/cli-git-commands.ts
           M scripts/src/lib/finalize-digest.ts
           M test/cli-help.test.js
           M test/finalize-digest.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
          ?? scripts/src/lib/finalize-pr.ts
          ?? test/finalize-pr.test.js
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 028a2aca6ce2d7d7157d9cacc8a904c9a71eaa2f9c283b6bb4f63a4b034eae6d
        outcome: accepted
        summary: 'Fix batch attempt 2: F1/F2 Epic-id leak, F-SEC-001..003 remote/blueprint/URL; npm test 1552; scope none'
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: ad1fc560430486c03a168a58e0fca2bad6bdd9c3f91a0e9e140085f77b479bac
        base_head: 2e472c662b500446dbab9945617e27f28151a68d
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: ad1fc560430486c03a168a58e0fca2bad6bdd9c3f91a0e9e140085f77b479bac
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: commit_sha stamp invalidated brief hash; attempt 2 accepted carried forward'
      - task: '002'
        decision: 'accepted TASKS-002 at 2e472c66 (branch bouncer/078-002-002; implementer 1-2 + re-baseline 3; reviewers combined+security+delta; F1/F2/F-SEC-001..003 resolved; F3/F4 advisory accepted). paths: scripts/src/lib/finalize-pr.ts,scripts/lib/finalize-pr.js,scripts/src/lib/finalize-digest.ts,scripts/lib/finalize-digest.js,scripts/src/lib/cli-git-commands.ts,scripts/lib/cli-git-commands.js,test/finalize-pr.test.js,test/finalize-digest.test.js,test/cli-help.test.js'
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: c5aededd21bf2c67718f9d903d5de5e21b680337584774153645d588e7f56552
        base_head: 5407beaceba6672c2da628a991295f33c6f8034f
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: c5aededd21bf2c67718f9d903d5de5e21b680337584774153645d588e7f56552
        outcome: accepted
        summary: 'Implementer attempt 1: stable ID Explain headings, trailer SHA task_commits, intent splitTaskChunks; npm test 1542; scope none'
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: 6ec23b555dd7db1f0f63d8ade25e2107978f49744026fa6ca86871ed6aebc3e5
        base_head: 7431f64cb34177505c44add9189ed91d42fc69d2
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: 6ec23b555dd7db1f0f63d8ade25e2107978f49744026fa6ca86871ed6aebc3e5
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp; attempt 1 accepted carried forward
      - task: '003'
        decision: 'accepted TASKS-003 at 7431f64c (branch bouncer/078-002-003; implementer attempt 1 + re-baseline 2; reviewer combined discovery no findings). paths: scripts/src/lib/finalize.ts,scripts/lib/finalize.js,scripts/src/lib/intent-provenance.ts,scripts/lib/intent-provenance.js,scripts/src/lib/templates.ts,scripts/lib/templates.js,test/finalize.test.js,test/finalize-pure.test.js,test/intent-provenance.test.js,test/retention-migration.test.js'
      - task: '004'
        kind: dispatch
        attempt: 1
        task_brief_hash: 7c682a07ffd1f08f7a55d973f9cfb6259b8c269208c2485fcd7ada49bc3b7ce1
        base_head: bdcf094761b40d29c1bcbbf074eef05ee12494a9
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '004'
        kind: report
        attempt: 1
        task_brief_hash: 7c682a07ffd1f08f7a55d973f9cfb6259b8c269208c2485fcd7ada49bc3b7ce1
        outcome: accepted
        summary: 'Implementer attempt 1: finalize skill/docs digest input; npm test 1557; scope none'
      - task: '004'
        kind: dispatch
        attempt: 2
        task_brief_hash: 9120ee579760bbc5f3b7b11fdde9f3e1d7949134cd5bb5c3af3b9a75121abb87
        base_head: 7131f7e4d1fc66685cd4929883c5a8b64b5ee651
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '004'
        kind: report
        attempt: 2
        task_brief_hash: 9120ee579760bbc5f3b7b11fdde9f3e1d7949134cd5bb5c3af3b9a75121abb87
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp; attempt 1 accepted carried forward
      - task: '004'
        decision: 'accepted TASKS-004 at 7131f7e4 (branch bouncer/078-002-004; implementer attempt 1 + re-baseline 2; reviewer combined; F003 advisory accepted). paths: skills/bouncer-finalize/,references/explain-diff/,test/skill-bouncer-finalize.test.js,test/skill-explain-diff.test.js'
      - task: '006'
        kind: repair
        wave: 1
        reason: Terminal CI fails on eslint in TASKS-001 finalize-digest sources (useless assignment, quotes, unused base); repair clears those lint defects so npm run ci can pass on the integrated head
        failure:
          task: '005'
          command: npm run ci
          summary: exit 127 then eslint no-useless-assignment/quotes/no-unused-vars in finalize-digest after tsc became available
          paths:
            - scripts/src/lib/finalize-digest.ts
            - scripts/lib/finalize-digest.js
            - test/finalize-digest.test.js
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
              - '001'
          - id: '004'
            depends_on:
              - '002'
              - '003'
          - id: '005'
            depends_on:
              - '004'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '001'
          - id: '004'
            depends_on:
              - '002'
              - '003'
          - id: '005'
            depends_on:
              - '006'
          - id: '006'
            depends_on:
              - '004'
        previousScope: []
        nextScope:
          - scripts/src/lib/finalize-digest.ts
          - scripts/lib/finalize-digest.js
          - test/finalize-digest.test.js
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r1
      - task: '006'
        kind: dispatch
        attempt: 1
        task_brief_hash: 53336b46d922d8615a339559e739f1702a2a528ac451be132a70f61eb9ca6ce4
        base_head: 3b42178735bd9707f4c3176c649451fe1eb0fc58
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '006'
        kind: report
        attempt: 1
        task_brief_hash: 53336b46d922d8615a339559e739f1702a2a528ac451be132a70f61eb9ca6ce4
        outcome: accepted
        summary: 'Repair attempt 1: eslint useless-assignment/quotes/unused-base in finalize-digest; lint+npm test green'
      - task: '006'
        kind: dispatch
        attempt: 2
        task_brief_hash: f8832fbeda42e6ac810c7b86d0d3a32d08969c8a607bf61e076ae0fb578fc88f
        base_head: 75e966cfa1a8e606d66092d9e18e36e89e2070ff
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '006'
        kind: report
        attempt: 2
        task_brief_hash: f8832fbeda42e6ac810c7b86d0d3a32d08969c8a607bf61e076ae0fb578fc88f
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp; repair attempt 1 carried forward
      - task: '006'
        decision: accepted TASKS-006 repair at 75e966cf; eslint fixes in finalize-digest
      - task: '007'
        kind: repair
        wave: 2
        reason: Terminal CI fails coverage threshold after digest/PR surface; add branch-covering tests (and minimal source if needed) for uncovered finalize-digest/finalize-pr branches so npm run ci meets 82% branch coverage
        failure:
          task: '005'
          command: npm run ci
          summary: 'exit 1: branch coverage 81.84% below threshold 82% after finalize-digest/PR changes'
          paths:
            - test/finalize-digest.test.js
            - test/finalize-pr.test.js
            - scripts/src/lib/finalize-digest.ts
            - scripts/lib/finalize-digest.js
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
              - '001'
          - id: '004'
            depends_on:
              - '002'
              - '003'
          - id: '005'
            depends_on:
              - '006'
          - id: '006'
            depends_on:
              - '004'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '001'
          - id: '004'
            depends_on:
              - '002'
              - '003'
          - id: '005'
            depends_on:
              - '007'
          - id: '006'
            depends_on:
              - '004'
          - id: '007'
            depends_on:
              - '006'
        previousScope: []
        nextScope:
          - test/finalize-digest.test.js
          - test/finalize-pr.test.js
          - scripts/src/lib/finalize-digest.ts
          - scripts/lib/finalize-digest.js
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r2
      - task: '007'
        kind: dispatch
        attempt: 1
        task_brief_hash: 5652f5662e1f7156dae4aa7230b34beee4a5f744e4201b85d2a28f49c557f1e8
        base_head: 6b05c7133df033d246e3f409f986e0ee66ff8666
        initial_worktree_state: |
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '007'
        kind: report
        attempt: 1
        task_brief_hash: 5652f5662e1f7156dae4aa7230b34beee4a5f744e4201b85d2a28f49c557f1e8
        outcome: accepted
        summary: 'Repair 2 attempt 1: branch coverage tests to 82.35%; npm test 1569; scope none'
      - task: '007'
        kind: dispatch
        attempt: 2
        task_brief_hash: a4df47cd8a4e5aa2f1f5b20772dac491594a9e4f9a59df2facf292e9fea37b5d
        base_head: 6b05c7133df033d246e3f409f986e0ee66ff8666
        initial_worktree_state: |2
           M test/finalize-digest.test.js
           M test/finalize-pr.test.js
          ?? .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/002-finalize-digest/
      - task: '007'
        kind: report
        attempt: 2
        task_brief_hash: a4df47cd8a4e5aa2f1f5b20772dac491594a9e4f9a59df2facf292e9fea37b5d
        outcome: accepted
        summary: coordinator re-baseline after commit_sha stamp; repair 2 attempt 1 carried forward
      - task: '007'
        decision: accepted TASKS-007 coverage repair at 6b05c713
      - task: '007'
        kind: rerecord
        reason: replace premature record of base HEAD with coverage-test commit after npm-install lockfile restored
        previousSha: 6b05c7133df033d246e3f409f986e0ee66ff8666
        nextSha: 94f4cdadde568986c971c0e98716c18fee15a1d2
        integrationHead: 6b05c7133df033d246e3f409f986e0ee66ff8666
      - task: '005'
        kind: manual-resume
        reason: 'User chose continue outside repair ceiling: remove scaffold HTML comment from tasks/005/tasks.md and clear terminalFailure so verification integrate can re-run without a third repair wave.'
---
# Explain

## Background
`/bouncer-finalize`가 Explain·Quiz·PR 입력을 `base..HEAD` diff, task 문서, verification 로그, 원장 decision log에서 매번 다시 모았다. drive에서는 worker SHA와 integration SHA가 달라 Explain에 적은 commit이 삭제된 worktree를 가리킬 수 있었다.

이 블루프린트는 읽기 전용 `bouncer finalize prepare` digest 하나로 그 입력을 고정한다. PR 제목 접두·결정적 본문 절과 push된 GitHub head의 Explain 링크 후보는 같은 증적에서 나오고, Explain task 제목은 stable Task ID와 trailer로 찾은 통합 SHA를 쓴다.

drive 실제 DAG는 계획의 001→(002‖003)→004→005에 repair 006·007이 끼어든 형태다. wave 1은 eslint 실패로 005 의존을 006으로 옮겼고, wave 2는 coverage 임계값 실패로 005 의존을 007로 옮겼다. 종단 `npm run ci`는 TASKS-005에서 통과했고 integration HEAD는 `94f4cdad`다.

## Intuition
마감 재료를 다시 줍지 말고, CLI가 한 번에 싸 준 digest만 읽는다.

## Code
- `scripts/src/lib/finalize-digest.ts` — `finalize prepare` 본문. task·verification·review·unverified·branch·out_of_scope를 JSON으로 묶는다.
- `scripts/src/lib/finalize-pr.ts` — digest `pr` 필드와 `finalize links` URL 후보.
- `scripts/src/lib/task-commits.ts` — `Bouncer-Task` trailer로 integration 이력에서 task SHA를 찾는다.
- `scripts/src/lib/finalize.ts` / `intent-provenance.ts` / `templates.ts` — Explain `## Tasks` 제목 `` ### EPIC-…/BP-…/TASK-… · `sha8` ``와 legacy `### Task NNN` 호환.
- `scripts/src/lib/cli-git-commands.ts` — `finalize prepare`·`finalize links` 배선.
- `skills/bouncer-finalize/SKILL.md`와 `references/explain-quiz.md`·`draft-pr.md`, `references/explain-diff/index.md` — agent가 digest만 사실 입력으로 쓰도록 전환.

실제 경로(coordinator `actualPaths`): 001은 digest·task-commits·finalize·cli, 002는 finalize-pr·digest·cli, 003은 finalize·intent·templates, 004는 skill/docs, 006·007은 digest/pr 테스트(와 006의 finalize-digest 소스). 005는 verification이라 source 경로 없음.

## Quiz
1. `bouncer finalize prepare`가 거절하는 경우는?
   - A) remote가 없을 때
   - B) `finalize --yes` 뒤라 task 문서가 없을 때
   - C) Explain이 아직 draft일 때

2. drive에서 worker commit과 integration commit SHA가 다를 때 digest·Explain 제목이 가리켜야 하는 값은?
   - A) worker worktree HEAD
   - B) tasks.md에 적힌 최초 `commit_sha`
   - C) finalize checkout `base..HEAD`에서 trailer로 찾은 통합 SHA

3. 이 drive의 계획 DAG에 없던 동적 task와 그 이유는?
   - A) 006(eslint)·007(coverage) — 종단 CI repair wave
   - B) 008·009 — parallel lease 충돌 복구
   - C) 002b·003b — scope revision으로 쪼갠 commit task

4. `bouncer finalize links`가 branch URL·commit permalink를 주는 조건은?
   - A) 로컬에 Explain이 published이면 항상
   - B) GitHub remote에 push된 head일 때만
   - C) digest `pr.draft`가 true일 때만

5. finalize skill이 Explain·Quiz·PR 사실을 읽어야 하는 출처는?
   - A) 원장 decision log와 각 task `verification.md`
   - B) `bouncer finalize prepare` digest(와 PR 링크는 `finalize links`)
   - C) pointer `base..HEAD` diff를 agent가 직접 요약한 결과

## 이해 상태
- 정답: 1B, 2C, 3A, 4B, 5B
- 응답: 1B, 2C, 3A, 4A, 5B
- 채점: 4/5 (Q4 오답)
- disposition: Q4만 오답 — `finalize links`는 push된 GitHub head에서만 URL을 준다. Explain published만으로는 부족하다.
- range: `9c4982cc`..`94f4cdad` · diff_sha `055f28ca…`

## Tasks

### EPIC-078/BP-002/TASK-001 · `5407beac`

#### Goal & intent

`bouncer finalize prepare --blueprint <dir>`가 Explain·Quiz·PR 작성에 필요한 사실을 JSON 하나로 반환하게 한다. 대상은 blueprint intent, task별 stable ID·commit, 실제 changed paths·symbol, 검증·review 결과, 결정적 unverified 목록, 남은 제약, branch·base·diff range다. 명령은 문서·Git·원장을 쓰지 않는다.
완료 조건: 두 task(하나는 review 생략, 하나는 deferred finding)를 커밋한 임시 저장소에서 digest가 아래 Interface 필드를 모두 채운다. `--yes` 뒤에는 `task-documents-missing`으로 거절한다.

#### Current behavior

- `cli-git-commands.ts:50-66` `cmdFinalize`는 `--blueprint`·`--yes`만 받는다. 하위 명령이 없다(usage 348–352행).
- `finalize.ts:831` `finalize()` dry-run은 `staged`·`commitMessage`·`next`·`closed`·`coordinator`·`branch`·`worktrees`·`integration`만 반환한다. intent·검증·review·changed paths는 주지 않는다.
- 그래서 finalize agent는 `base..HEAD` diff, 각 task의 `tasks.md`·`verification.md`·`review.md`, 원장 decision log를 직접 읽는다(`skills/bouncer-finalize/references/explain-quiz.md:9-11`, `draft-pr.md:30-37`).
- 데이터 출처:
  - verification: `verification.md` frontmatter `bouncer.status`(passed/failed)와 `bouncer.verification = { command, exit_code, evidence_id, reused, ... }`(`verification.ts` `recordVerificationResult`).
  - review: `review.md` `bouncer.review.required`와 `findings[] = { id, severity, status: resolved|accepted|deferred, note }`.
  - constraints: `validate-sections.ts:149` `parseTasksSections`의 `constraints`, blueprint `## Out of scope`.
  - task commit: tasks.md `commit_sha`(8자리)가 있다. drive에서는 worker SHA이고, integration에는 cherry-pick된 다른 SHA가 같은 `Bouncer-Task:` trailer를 갖는다(`commit-sha.ts:85` `buildStableProvenance`).
  - branch: `finalize.ts:541` `resolveCheckoutBranch`(비공개), drive는 원장 `integrationBranch`.
  - base: pointer `base`, drive는 원장 `base`. `comprehension.ts:54` `computeDiffSha`.
- 재현: `node --test test/finalize.test.js`의 dry-run fixture가 현재 payload를 보여 준다.

#### Target behavior

- 성공 경로: finalize checkout(drive면 integration worktree)에서 digest를 계산한다.
  - 각 task의 commit은 `git log --format=%H%x00%B <base>..HEAD`에서 `Bouncer-Task: <stable id>` trailer가 있는 가장 최근 commit이다. 없으면 tasks.md `commit_sha`를 쓰고 `source: 'commit_sha'`로 표시한다. 둘 다 없으면 `null`이다.
  - `changed_paths`는 `git diff --name-only <base>..HEAD` 중 `.bouncer/context/`를 뺀 목록이다.
  - `symbols`는 `git diff -U0 <base>..HEAD`의 hunk header 문맥에서 `function`·`class`·`const|let|var <name> =` 식별자를 추출한다. 파일당 10개, 전체 60개로 자른다.
  - `unverified`는 아래 규칙으로만 만든다.
    - verification이 passed가 아닌 commit task → `verification-not-passed`
    - `review.required === false` → `review-skipped`
    - status가 `deferred`·`accepted`인 finding → `finding-deferred`·`finding-accepted`(note 포함)
    - `execution_kind: verification` task가 없거나 passed가 아님 → `terminal-missing`
    - 어떤 task의 `affected_paths`로도 정당화되지 않는 changed path → `path-outside-scope`
- 실패 경로:
  - blueprint 경로가 없으면 `blueprint-not-found`.
  - task 문서가 하나도 없으면(`--yes` 뒤) `task-documents-missing`.
  - 원장이 깨졌으면 기존 finalize와 같은 `{ ok: false, reason: 'coordinator-ledger', code: 'UNREADABLE_LEDGER' }`.
  - base를 해석할 수 없으면 `no-base`.
  - 실패는 모두 exit 1이고 stdout JSON이다.
- 보존: `bouncer finalize --blueprint`(dry-run)·`--yes` 동작과 payload는 바뀌지 않는다. 이 명령은 파일·index·원장·pointer를 바꾸지 않는다(실행 전후 `git status --porcelain`과 원장 바이트가 같다).

#### Interface

- 제공:
  - CLI `bouncer finalize prepare --blueprint <dir>`. usage에 추가한다.
  - `finalize-digest.ts` `prepareFinalizeDigest({ repoRoot, blueprintDir, exec? }): FinalizeDigest | { ok: false; reason: string }`.
  - `task-commits.ts` `resolveTaskCommits({ repoRoot, base, head, stableIds, exec? }): Map<string, { sha: string; sha8: string }>`. trailer scan만 하고 문서를 읽지 않는다. BP 002 TASKS-003이 재사용한다.
  ```ts
  type FinalizeDigest = { ok: true; version: 1;
    blueprint: { dir; stable_id; title; intent: string[]; commit_type; scale };
    range: { base; head; diff_sha: string | null };
    git: { branch: string | null; pr_base: string };
    tasks: Array<{ stable_id; id; title; execution_kind; status;
      commit: { sha: string; sha8: string; source: 'trailer' | 'commit_sha' } | null;
      affected_paths: string[]; actual_paths: string[] | null;
      verification: { status; command; exit_code; evidence_id; reused } | null;
      review: { required: boolean; findings: Array<{ id; severity; status; note? }> } | null;
      constraints: string | null }>;
    changed_paths: string[]; symbols: Array<{ path: string; names: string[] }>;
    commits: Array<{ sha8: string; subject: string }>;
    unverified: Array<{ kind; task?: string; path?: string; detail?: string }>;
    out_of_scope: string[];
    coordinator: CoordinatorProvenance | null };
  ```
  - `pr_base`는 config `pr.base` → `base_branch` → `main` 순서로 정한다. `actual_paths`는 원장 task `actualPaths`이고 standalone이면 `null`이다.
  - `commits`는 `git log --format=%h%x00%s <base>..HEAD`의 최신순 목록이며 50개로 자른다. PR 제목 type 계산(TASKS-002)의 유일한 입력이다.
  - `coordinator`는 `finalize.ts` `buildCoordinatorProvenance`가 이미 만드는 객체를 그대로 싣는다(`finalize()` dry-run의 `coordinator`와 같은 값). 필드: `base`, `integrationHead`, `integrationBranch`, `revision`, `tasks[] = { id, status, sha(worker SHA), branch, scopeRevision, paths, actualPaths, decisions }`, `decisions`, `repairWaves`(각 wave의 `previousDag`·`nextDag` 포함), `terminalFailure`, `lifecycleStatus`. 원장이 없으면 `null`이다. Explain drive 서술은 이 필드만 쓴다.
  - `finalize.ts`에서 `resolveCheckoutBranch`를 export한다.
- 거부(즉시 반환): 위 실패 경로 네 코드.
- test seam: `exec?: (args: string[]) => { status: number; stdout: string }`(`git` 뒤 argv). 쓰기 부재는 실행 전후 porcelain·원장 바이트 비교로 검사한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest` | Create | 없음 | digest 수집 | 마감 입력의 단일 출처 |
| `scripts/lib/finalize-digest.js` | 생성물 | Create | 없음 | build 결과 | `check:emit` |
| `scripts/src/lib/task-commits.ts` | `resolveTaskCommits` | Create | 없음 | trailer 기반 task→commit 해석 | digest와 Explain 제목이 같은 SHA를 쓴다 |
| `scripts/lib/task-commits.js` | 생성물 | Create | 없음 | build 결과 | `check:emit` |
| `scripts/src/lib/finalize.ts` | `resolveCheckoutBranch` export | Modify | finalize 실행 | branch helper 공개 | digest가 같은 branch 판정을 쓴다 |
| `scripts/lib/finalize.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/cli-git-commands.ts` | `cmdFinalize`, finalize usage | Modify | finalize 인자 처리 | `prepare` 하위 명령 | 공개 CLI 표면 |
| `scripts/lib/cli-git-commands.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/finalize-digest.test.js` | 신규 추출 지점: digest 테스트 | Create | 없음 | 필드·unverified·거절·무쓰기 테스트 | 기대 red 위치 |
| `test/cli-help.test.js` | usage 고정 | Modify | help 문자열 | `finalize prepare` 반영 | usage 변경 |

#### Constraints

- digest는 원문 로그, reviewer 대화, 전체 diff 본문, task 문서 전문을 싣지 않는다. 절 본문은 `constraints` 하나뿐이다.
- `finalize()`의 기존 거절 순서와 reason 코드를 바꾸지 않는다.
- `symbol-index`·`intent-provenance` 모듈을 require하지 않는다(P1.2 lazy boundary 유지).
- 새 gate code를 만들지 않는다.

### EPIC-078/BP-002/TASK-002 · `fcd7655e`

#### Goal & intent

PR 제목 접두·base·head와, 증적에서 결정적으로 채울 수 있는 PR 본문 절을 CLI가 digest의 `pr` 필드로 만든다. Explain URL은 push된 head에서 열리는 후보만 `bouncer finalize links`로 반환한다.
완료 조건: digest `pr`에 제목 접두·`확인 방법`·`리뷰 포인트` 사실 목록이 채워진다. GitHub remote에 push된 head에서만 `links`가 branch URL과 commit permalink를 반환한다. 그 밖의 경우에는 URL 없이 이유 코드만 반환한다.

#### Current behavior

- `skills/bouncer-finalize/references/draft-pr.md`가 agent에게 다음을 손으로 하게 한다.
  - 제목 `[YYMMDD] (→ MergeTarget) [Type/Type] summary` 조립(16행)
  - 본문 절별 출처 해석(30–37행)
  - Explain 링크 URL 구성(52–58행)
- `templates.ts:11-37` `PR_TEMPLATE`에는 `Explain: [<explain path>](<explain url>)` 자리표시가 있다.
- src 어디에도 `git remote get-url`, GitHub URL 파싱, permalink 생성이 없다. 설정은 `config.example.json:30-35`의 `base_branch`, `pr.draft`, `pr.base`다.
- `finalize --yes`가 task 문서를 지우므로, PR 단계(push 뒤)에서는 task 증적을 다시 읽을 수 없다.
- 재현: `grep -rn "remote get-url\|github.com" scripts/src` 결과가 비어 있다.

#### Target behavior

- 성공 경로 — `prepareFinalizeDigest`가 `pr`를 채운다:
  - `title_prefix`: KST 날짜 `YYMMDD`, `→ ` 뒤 첫 글자를 대문자로 바꾼 digest `git.pr_base`, digest `commits[].subject`에서 `^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?:`로 뽑은 type 집합을 첫 등장 순서로 대문자 첫 글자화해 `/`로 연결한 값. 예: `[260924] (→ Develop) [Feat/Fix]`. type이 없으면 blueprint `commit_type`을 쓴다.
  - `base`(= digest `git.pr_base`), `head`(= digest `git.branch`), `draft`(config `pr.draft`, 기본 `true`). `buildPrDraft`는 config에서 `pr.draft`만 읽는다.
  - `sections.verification`: task 번호순 `command — passed|failed` 행, 같은 명령은 task별 결과를 유지한다.
  - `sections.review_points`: blueprint `out_of_scope`, `accepted`·`deferred` finding note, `unverified` 항목.
  - `sections.related`: 빈 배열. Explain 링크는 push 뒤 `links` 결과로 skill이 채운다.
  - `sections.background`·`sections.changes`·`sections.flow`: `null`. Explain에서 agent가 작성한다.
- 성공 경로 — `links`: CLI는 digest를 쓰지 않고 branch를 스스로 정한다. 원장이 읽히면 원장 `integrationBranch`, 없으면 `resolveCheckoutBranch(repoRoot)`이다. task 문서 존재 여부와 무관하게 동작한다.
  - `origin` URL이 `git@github.com:o/r(.git)`, `https://github.com/o/r(.git)`, `ssh://git@github.com/o/r(.git)` 가운데 하나여야 한다.
  - `refs/remotes/origin/<branch>`가 있고 HEAD가 그 ref의 조상이거나 같아야 한다.
  - 그때 `[{ kind: 'branch', url: https://github.com/o/r/blob/<branch>/<explainRel> }, { kind: 'commit', url: https://github.com/o/r/blob/<HEAD sha>/<explainRel> }]`를 반환한다.
- 실패 경로(`links`는 ok:true로 URL 없이 `reason`만 준다):
  - `no-remote`
  - `unsupported-host`
  - `head-not-pushed`
  - `branch-unresolved`(위 규칙으로 branch가 `null`)
  - `explain-missing`(HEAD에 `explain.md`가 추적되지 않음)
- 보존: `PR_TEMPLATE` 절 순서와 `.github`·`.gitlab` 템플릿, `--label` 금지, Quiz·`## 이해 상태`를 PR에 넣지 않는 규칙을 유지한다. 명령은 네트워크를 쓰지 않는다(`ls-remote`·`fetch` 금지).

#### Interface

- 제공:
  - `finalize-pr.ts`:
    - `buildPrDraft(digest, { now: Date, config: unknown }): PrDraft`
    - `resolveExplainLinks({ repoRoot, blueprintDir, exec? }): { ok: true; branch: string | null; links: Array<{ kind: 'branch' | 'commit'; url: string }>; reason: string | null }`
    - `parseGithubRemote(url: string): { owner: string; repo: string } | null`
  - `PrDraft = { title_prefix; base; head; draft: boolean; sections: { related: string[]; background: null; changes: null; flow: null; review_points: string[]; verification: string[] } }`
  - digest에 `pr: PrDraft`를 추가한다. `prepareFinalizeDigest`에 선택 인자 `now?: Date`(기본 `new Date()`)를 추가해 `buildPrDraft`에 넘긴다.
  - CLI `bouncer finalize links --blueprint <dir>`. usage에 추가한다.
- 거부:
  - `parseGithubRemote`는 `https://gitlab.com/o/r`, `git@github.com:o`(repo 없음), 빈 문자열에 `null`을 반환한다.
  - `links`는 위 이유 코드 외에 URL을 추측하지 않는다.
- test seam: `buildPrDraft`와 `prepareFinalizeDigest`의 `now` 주입으로 날짜를 고정한다. `exec?: (args: string[]) => { status: number; stdout: string }`로 remote·ref 조회를 주입한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-pr.ts` | `buildPrDraft`, `resolveExplainLinks`, `parseGithubRemote` | Create | 없음 | PR 초안·링크 계산 | agent의 손 조립을 CLI로 옮긴다 |
| `scripts/lib/finalize-pr.js` | 생성물 | Create | 없음 | build 결과 | `check:emit` |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest` | Modify | digest 수집 | `pr` 필드 추가 | PR 입력도 같은 digest |
| `scripts/lib/finalize-digest.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/cli-git-commands.ts` | `cmdFinalize`, finalize usage | Modify | finalize·prepare 처리 | `links` 하위 명령 | 공개 CLI 표면 |
| `scripts/lib/cli-git-commands.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/finalize-pr.test.js` | 신규 추출 지점: PR 초안·링크 테스트 | Create | 없음 | 제목·절·remote 파싱·링크 이유 코드 테스트 | 기대 red 위치 |
| `test/finalize-digest.test.js` | digest `pr` 필드 | Modify | digest 고정 | `pr` 필드 기대값 | digest 계약 변경 |
| `test/cli-help.test.js` | usage 고정 | Modify | help 문자열 | `finalize links` 반영 | usage 변경 |

#### Constraints

- CLI는 push·`gh`·네트워크 호출을 하지 않는다. 사용자 동의 뒤 push·PR 생성은 skill이 수행한다.
- PR 본문 초안에 Epic/Blueprint id, Quiz, comprehension 점수, 원문 로그를 넣지 않는다.
- GitHub 외 host는 URL을 만들지 않는다.

### EPIC-078/BP-002/TASK-003 · `bdcf0947`

#### Goal & intent

새 finalize가 Explain `## Tasks`의 task 제목을 `` ### EPIC-xxx/BP-xxx/TASK-xxx · `sha8` ``로 쓰고, `task_commits`와 제목의 SHA가 finalize checkout 이력에 있는 통합 commit을 가리키게 한다. `bouncer intent`는 새 제목과 기존 `### Task NNN` 제목을 모두 해석한다.
완료 조건:
- drive fixture에서 Explain 제목과 `task_commits[].sha`가 worker SHA가 아니라 integration의 trailer commit SHA 앞 8자리다.
- 새 제목과 기존 제목 Explain 모두에서 `bouncer intent`가 같은 task 설계 절을 반환한다.

#### Current behavior

- `finalize.ts:453` `buildTaskContext(taskUnits)`는 `### Task ${number}`와 `#### <절>`을 렌더한다(477행). 제목에 stable ID·SHA가 없다.
- `finalize.ts:342` `collectTaskCommits`는 tasks.md `commit_sha`로 `{ task, sha, intent_anchor }`를 만든다. drive에서는 `commit_sha`가 worker SHA다. integration에는 cherry-pick된 다른 SHA가 남으므로, worker worktree가 지워지면 Explain SHA가 도달 불가 commit을 가리킨다.
- `finalize()` `--yes`(1050–1054행)가 두 함수를 부르고, `retention-migration.ts:350,572`도 `buildTaskContext`를 부른다.
- `intent-provenance.ts:821` `splitTaskChunks`는 `/^###\s+Task\s+(\d{3})\s*$/i`만 인식한다. 새 제목이면 task 설계 절이 intent 결과에서 조용히 빠진다.
- `templates.ts:238-239` Explain `## Tasks` 주석은 "Goal & intent, Interface, Do not touch를 보존"이라고 적는다. 실제 코드는 Goal·Current·Target·Interface·Touch·Constraints를 보존하고 Do not touch를 뺀다(drift).
- 고정 테스트: `test/finalize.test.js:960`, `test/finalize-pure.test.js:567-647`, `test/intent-provenance.test.js:307,341`, `test/retention-migration.test.js`.

#### Target behavior

- 성공 경로:
  - `buildTaskContext(taskUnits, commits?)`는 task별 stable ID를 frontmatter(`epic_id`·`blueprint_id`·`id`)로 만든다.
    - `commits`에 그 ID가 있으면 `` ### <stable id> · `<sha8>` ``를 렌더한다.
    - 없으면 `### <stable id>`를 렌더한다.
    - stable ID를 만들 수 없으면 기존 `### Task NNN`을 렌더한다.
  - `finalize --yes`는 base(원장 `base`, 없으면 pointer `base`)와 `HEAD`로 `resolveTaskCommits`를 한 번 호출한다. 그 결과를 `collectTaskCommits`와 `buildTaskContext`에 함께 넘긴다.
  - `collectTaskCommits`는 trailer로 찾은 SHA를 우선하고, 없을 때만 `commit_sha`를 쓴다. 행 형식은 그대로다.
  - `splitTaskChunks`는 `### Task NNN`과 `` ### EPIC-\d{3}/BP-\d{3}/TASK-(\d{3})( · `[0-9a-f]{8}`)? ``를 모두 같은 `NNN` 키로 나눈다.
  - `templates.ts` Explain 주석이 실제 보존 절 목록과 새 제목 형식을 적는다.
- 실패 경로: base를 해석할 수 없거나 `git log`가 실패하면 trailer 해석을 건너뛰고 `commit_sha` 경로로 진행한다. finalize를 실패시키지 않는다.
- 보존: `task_commits` 행 형식(`{ task, sha(8), intent_anchor }`), 보존 절 allowlist, `retention-migration`의 감사·적용 결과 분류, G16과 `## Tasks` 선택 절 규칙은 바뀌지 않는다.

#### Interface

- 제공:
  - `buildTaskContext(taskUnits, commits?: Map<string, { sha8: string }>): string` — 두 번째 인자는 선택이다.
  - `collectTaskCommits({ repoRoot, blueprintDir, commits? })` — `commits`가 있으면 trailer SHA를 우선한다.
  - `splitTaskChunks`가 새·기존 제목을 모두 인식한다. 테스트가 직접 호출하도록 `intent-provenance.ts` `export =`에 `splitTaskChunks`를 추가한다.
- 거부: `### EPIC-078/BP-002/TASK-1`처럼 세 자리가 아니거나, `` · `ABCDEF12` ``처럼 대문자이거나, `` · `1234567` ``처럼 8자리가 아닌 SHA 제목은 task chunk로 인식하지 않는다.
- test seam: `resolveTaskCommits`의 `exec` 주입(BP 002 TASKS-001 Interface)을 그대로 쓴다. `finalize()`는 기존 `git` 주입(`GitApi`)을 유지하고, trailer 조회는 `realGit`과 같은 `repoRoot`의 `git log`를 쓴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `buildTaskContext`, `collectTaskCommits`, `finalize` | Modify | Explain Tasks·task_commits 기록 | stable ID·SHA 제목, trailer SHA 우선 | 제목과 provenance의 정본 |
| `scripts/lib/finalize.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/intent-provenance.ts` | `splitTaskChunks` | Modify | Explain task chunk 분리 | 새·기존 제목 인식 | intent 호환 |
| `scripts/lib/intent-provenance.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `scripts/src/lib/templates.ts` | `TEMPLATES['explain.md']` `## Tasks` 주석 | Modify | Explain 작성 안내 | 보존 절 drift 수정과 새 제목 형식 | 문서·코드 일치 |
| `scripts/lib/templates.js` | 생성물 | Modify | 배포 CommonJS | build 결과 | `check:emit` |
| `test/finalize.test.js` | Tasks 제목·task_commits 테스트 | Modify | 기존 제목 고정 | 새 제목·drive 통합 SHA 테스트 | 기대 red 위치 |
| `test/finalize-pure.test.js` | `buildTaskContext` 테스트 | Modify | 기존 제목 고정 | 새 제목·fallback 테스트 | 계약 변경 |
| `test/intent-provenance.test.js` | task chunk 테스트 | Modify | 기존 제목 해석 고정 | 새 제목 해석과 기존 제목 유지 | 호환 계약 |
| `test/retention-migration.test.js` | migration 출력 | Modify | 기존 제목 출력 고정 | 새 제목 출력 기대값 | `buildTaskContext` 공유 |
| `test/scaffold.test.js` | explain 템플릿 | Modify | 템플릿 고정 | 주석 변경 반영(실패할 때만) | 템플릿 바이트 |
| `test/validate-gates.test.js` | `### Task` Explain fixture | Modify | 기존 동작 고정 | 기대값이 바뀔 때만 갱신 | 전체 `npm test` green에 필요한 blast radius |

#### Constraints

- 과거 Explain을 소급 수정하지 않는다. 호환은 읽기 쪽에서만 한다.
- SHA 표기는 소문자 8자리(`COMMIT_SHA_LEN`)를 따른다.
- `Do not touch` 절을 보존 목록에 다시 넣지 않는다.

### EPIC-078/BP-002/TASK-004 · `3b421787`

#### Goal & intent

`/bouncer-finalize`가 Explain·Quiz·PR 입력을 `bouncer finalize prepare` digest 하나에서 읽게 한다. PR의 Explain 링크는 push 뒤 `bouncer finalize links`가 돌려준 URL만 쓰게 한다.
완료 조건: finalize skill과 reference가 원장 decision log, task 원문, verification 로그를 직접 읽으라는 지시를 포함하지 않는다. Quiz 필수·`## 이해 상태`·`bouncer.comprehension`·G16 문구는 유지된다. 이 계약을 문서 테스트가 고정한다.

#### Current behavior

- `skills/bouncer-finalize/SKILL.md`: 1단계에서 explain-quiz로 Explain·Quiz를 작성하고, 2단계에서 dry-run·`--yes`, 3단계에서 draft-pr를 수행한다. digest 단계가 없다.
- `references/explain-quiz.md:9-11`은 pointer `base..HEAD` diff와, drive면 원장 decision log를 직접 감사하라고 지시한다.
- `references/draft-pr.md`는 다음을 agent에게 맡긴다.
  - 제목 조립(16행)
  - `확인 방법`에 모든 task `verification.md` 읽기(37행)
  - drive 차이는 explain `bouncer.coordinator`에서 읽기(39–50행)
  - Explain URL 직접 구성(52–58행)
- `references/explain-diff/index.md`:
  - `range_from`은 pointer `base`(42–44행)다.
  - "Preserved task context"(110–118행)는 `### Task NNN`과 Goal·Interface·Do not touch 보존이라고 적는다(코드와 drift).
  - Guardrail 122행은 "No new CLI"다.
- 고정 테스트: `test/skill-bouncer-finalize.test.js`(PR 절 순서, push·`gh pr create` 블록, Explain 링크), `test/skill-explain-diff.test.js`.

#### Target behavior

- 성공 경로:
  - SKILL 1단계 앞(또는 1단계 첫 줄)에서 `bouncer finalize prepare --blueprint <pointer.blueprint>`를 한 번 실행한다. 그 payload를 Explain·Quiz·PR의 유일한 사실 입력으로 쓴다.
  - Quiz 범위는 digest `range.base..range.head`, `diff_sha`는 digest 값을 쓴다.
  - explain-quiz의 Drive sources와 draft-pr의 Plan versus execution은 digest `coordinator` 필드(TASKS-001 Interface 목록)만 출처로 삼는다. 계획 대비 DAG 변화는 `repairWaves[].previousDag`·`nextDag`, scope 변화는 `tasks[].scopeRevision`·`paths`·`actualPaths`와 `decisions`, 통합 head는 `integrationHead`에서 읽는다. 원장에 없는 agent 이름은 decision 본문에 기록된 경우에만 쓴다.
  - `--yes`가 task 문서를 지우므로 payload는 PR 단계까지 유지한다.
  - PR 단계: push 성공 뒤 `bouncer finalize links --blueprint <dir>`를 실행해 `links[0]`(branch)을 Explain 링크로 쓴다. `reason`이 있으면 링크를 생략한다.
  - 제목은 `pr.title_prefix + ' ' + 한국어 요약`이다. `확인 방법`·`리뷰 포인트`는 `pr.sections`와 finalize `--yes` 검증 결과를 쓴다.
  - explain-diff의 `range_from`, Preserved task context, Guardrail 문구를 digest·새 제목 형식·실제 보존 절(Goal·Current·Target·Interface·Touch·Constraints)과 맞춘다.
- 실패 경로: `prepare`가 `ok: false`이면 reason을 보고하고 멈춘다. `coordinator-ledger`는 기존 remainder 규칙대로 처리한다. `--yes` 뒤라 `task-documents-missing`이면 이미 닫힌 blueprint로 보고한다.
- 보존: Quiz 필수·미응답 중단, 단일 `bouncer.comprehension`, G16, 두 ACQ(remainder·draft PR)의 위치와 선택지, `git push -u origin <branch>` / `gh pr create --draft` 블록, `--label` 금지, partial_closed 보존 규칙은 바뀌지 않는다.

#### Interface

- 제공(문서 계약): finalize skill·reference에 다음이 존재한다.
  - `bouncer finalize prepare --blueprint`
  - `bouncer finalize links --blueprint`
  - `pr.title_prefix`, `range.base`
  - explain-quiz에 정확한 문장 `Do not re-read the coordinator ledger, task documents, or verification logs.`
- 거부: 다음 문구가 남으면 `test/skill-bouncer-finalize.test.js`·`test/skill-explain-diff.test.js`가 실패한다.
  - explain-quiz의 "Audit those against the ledger's decision log"
  - draft-pr의 "Every task `verification.md` evidence"
  - explain-diff의 "copies only the authored `Goal & intent`, `Interface`, and `Do not touch`"
  - explain-diff의 "No new CLI"

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-finalize/SKILL.md` | Preflight·1–3단계 | Modify | finalize 단계 순서 | digest 실행 단계 추가와 입력 출처 전환 | workflow 정본 |
| `skills/bouncer-finalize/references/explain-quiz.md` | Drive sources 문단 | Modify | Explain 입력 출처 | digest 필드로 전환, 원장 직접 감사 제거 | 입력 축소 |
| `skills/bouncer-finalize/references/draft-pr.md` | Title·Body sections·Explain link | Modify | PR 수동 조립 | `pr` 초안·`finalize links` 사용 | 입력 축소 |
| `references/explain-diff/index.md` | 2단계 `range_from`, Preserved task context, Guardrails | Modify | Explain·Quiz 규칙 | digest range, 새 제목·보존 절, CLI 허용 | drift 수정 |
| `test/skill-bouncer-finalize.test.js` | 문서 계약 테스트 | Modify | PR·링크 문구 고정 | digest·links 문구와 금지 문구 검사 | 기대 red 위치 |
| `test/skill-explain-diff.test.js` | 문서 계약 테스트 | Modify | explain-diff 문구 고정 | 새 문구·금지 문구 검사 | 문서 계약 |
| `docs/architecture/rule-ownership.md` | quiz sizing 등 locator 행 | Modify | 규칙 소유 기준선 | 바뀐 구절 locator 갱신(검사가 실패할 때만) | `test/rule-ownership.test.js` green |

#### Constraints

- skill은 CLI payload 값을 가리키기만 하고, digest가 계산한 unverified·제목 접두를 다시 계산하라고 지시하지 않는다.
- Epic 077 소유 경계를 따른다. quiz 크기 규칙은 explain-diff에만 둔다.
- 영어 skill 본문 문체와 ACQ 표시 규칙(`rules/acq.md`)을 유지한다.

### EPIC-078/BP-002/TASK-005

#### Goal & intent

TASKS-001~004가 모두 integration branch에 통합된 상태에서 `check:emit`, coverage 임계값, lint, doc lint, typecheck, audit을 포함한 전체 CI가 통과함을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-078/BP-002/TASK-006 · `6b05c713`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/finalize-digest.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/lib/finalize-digest.js` — 기록된 CI 실패를 복구한다.
- Modify `test/finalize-digest.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### EPIC-078/BP-002/TASK-007 · `94f4cdad`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/finalize-digest.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/finalize-pr.test.js` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/finalize-digest.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/lib/finalize-digest.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.