---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/004-drive-document-flow/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-12T13:52:49.784+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '069'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: af8a692e1c380799c34b307f2f990d3de85fa3b5
      diff_sha: e066c4ff781b03b3d185110e63b8fb0138d8677efaf7c9ba890b3009c043f8e4
      quiz_score: 5/5
      disposition: 계획 문서 정본을 integration으로 옮긴 흐름과 원장 전용 manifest, 증적 반환 조건, release 보존 규칙, parser 완화 범위를 모두 이해함.
      recorded_at: '2026-09-12T13:59:30+09:00'
  task_commits:
    - id: '001'
      sha: 1a22b48c
    - id: '002'
      sha: 1820318e
    - id: '003'
      sha: 2389fb3b
    - id: '004'
      sha: 220423eb
    - id: '005'
      sha: 09a3524f
  coordinator:
    base: 337fc42b42e98d7448f902aa69e990a3563a473f
    integration_head: af8a692e1c380799c34b307f2f990d3de85fa3b5
    integration_branch: fix/069-004-drive-document-flow
    revision: r6
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/workers/004
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/004/workers/005
    tasks:
      - id: '001'
        status: integrated
        sha: 1a22b48c32c7448c5e2db3f7fc815076bdfbed0f
        branch: bouncer/069-004-001
        scope_revision: r1
        paths:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/runtime-state.test.js
          - docs/cli.md
        actual_paths:
          - docs/cli.md
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - scripts/src/lib/seed-worktree.ts
          - test/coordinator.test.js
          - test/runtime-state.test.js
          - test/seed-worktree.test.js
      - id: '002'
        status: integrated
        sha: 1820318e322dea156a0ddf039c7571d85f753743
        branch: bouncer/069-004-002
        scope_revision: r3
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - test/coordinator.test.js
          - docs/cli.md
          - skills/bouncer-run/SKILL.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/cli.md
          - scripts/lib/coordinator.js
          - scripts/src/lib/coordinator.ts
          - skills/bouncer-run/SKILL.md
          - test/coordinator.test.js
      - id: '003'
        status: integrated
        sha: 2389fb3b82d2a219cac8c13dba97b131ecd231ed
        branch: bouncer/069-004-003
        scope_revision: r4
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/finalize.ts
          - scripts/lib/finalize.js
          - test/coordinator.test.js
          - test/finalize.test.js
          - test/coordinator-e2e.test.js
          - test/native-profile-e2e.test.js
          - docs/cli.md
        actual_paths:
          - docs/cli.md
          - scripts/lib/coordinator.js
          - scripts/lib/finalize.js
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/finalize.ts
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/finalize.test.js
          - test/native-profile-e2e.test.js
      - id: '004'
        status: integrated
        sha: 220423eb74732c20dc71a182a0e1dcfba035f6e2
        branch: bouncer/069-004-004
        scope_revision: r6
        paths:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - docs/cli.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/skill-bouncer-finalize.test.js
        actual_paths:
          - docs/cli.md
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/seed-worktree.ts
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/seed-worktree.test.js
          - test/skill-bouncer-finalize.test.js
      - id: '005'
        status: integrated
        sha: 09a3524fda2d61f242267210aea79424ec975c74
        branch: bouncer/069-004-005
        scope_revision: r2
        paths:
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/finalize-pure.test.js
          - rules/okf.md
          - references/spec-authoring/index.md
          - .gitmessage
          - docs/contributing.md
          - docs/distill-decommission-audit.md
        actual_paths:
          - .gitmessage
          - docs/contributing.md
          - docs/distill-decommission-audit.md
          - references/spec-authoring/index.md
          - rules/okf.md
          - scripts/lib/templates.js
          - scripts/src/lib/templates.ts
          - test/finalize-pure.test.js
      - id: '006'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        kind: critical-recovery
        used: 1
        findings:
          - TASKS-001-correctness_tests-test-command-failure
        reason: Delta review found a task-created targeted-test failure that creates false-acceptance risk; correcting its newline expectation preserves the approved intent and public interface.
        outcome: null
      - task: '001'
        kind: critical-recovery
        used: 1
        findings:
          - TASKS-001-correctness_tests-test-command-failure
        reason: 'Delta certification resolved the recorded assertion failure but found a new missed-critical major: the documented bootstrap JSON payload promises seedManifest while the implementation omits it. The one critical-recovery dispatch is exhausted, so no second rework is permitted.'
        outcome: blocked
      - task: '001'
        kind: scope
        reason: 'User decision (session instruction, not a worker report): bootstrap seedManifest contract is ledger-only - seedManifest stays internal coordinator ledger state consumed by release and is NOT a bootstrap CLI response field, matching blueprint index.md Contract and the TASKS-001 Interface. No TS/JS or interface change. The user explicitly authorizes ONE additional rework dispatch for TASKS-001 limited to the single missed_critical major (docs/cli.md bootstrap row lists seedManifest in the response while coordinator.ts returns only integrationPath, integrationBranch, ready, tasks, decisions). This is a user-sanctioned plan amendment outside the automatic critical-recovery budget (already exhausted), not a second critical recovery. affected_paths unchanged. If the same finding remains or a new blocker/major appears, TASKS-001 is terminal blocked.'
        previous:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/runtime-state.test.js
          - docs/cli.md
        next:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/runtime-state.test.js
          - docs/cli.md
        revision: r1
      - task: '001'
        decision: 'accepted: TASKS-001 committed 1a22b48c32c7448c5e2db3f7fc815076bdfbed0f on bouncer/069-004-001 at scope r1. Changed paths: docs/cli.md, scripts/lib/coordinator.js, scripts/lib/runtime-state.js, scripts/lib/seed-worktree.js, scripts/src/lib/coordinator.ts, scripts/src/lib/runtime-state.ts, scripts/src/lib/seed-worktree.ts, test/coordinator.test.js, test/runtime-state.test.js, test/seed-worktree.test.js. Workers: bouncer-implementer (initial implementation and the user-authorized one-time r1 docs rework making seedManifest ledger-only), bouncer-reviewer (round 2: seedmanifest-docs major resolved, test-command-failure blocker stays resolved, new nit bootstrap-resume-docs accepted with note because the rework authorization was limited to one finding). Execute gate passed (npm run ci exit 0). Critical recovery outcome for the original finding stays blocked in the log; this acceptance rests on the user plan amendment recorded at scope r1.'
      - task: '005'
        kind: scope
        reason: 'Round-1 review TASKS-005-misunderstood-stale-audit-crossref (minor): after this task relaxes the authored-sentence rule, the resolution note in docs/distill-decommission-audit.md:37 says the two fields reject identifiers ''rules/okf.md Plan fields와 같다'', which is now false. The Goal requires the documented prohibition rule to move in the same direction, so the coordinator absorbs the fix. Widening adds only docs/distill-decommission-audit.md; only the resolution-note cell may change, and the verbatim quoted source text and the test snapshot stay unchanged. The same rework also fixes the major TASKS-005-constraint-breach-title-module-package-rule inside references/spec-authoring/index.md.'
        previous:
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/finalize-pure.test.js
          - rules/okf.md
          - references/spec-authoring/index.md
          - .gitmessage
          - docs/contributing.md
        next:
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/finalize-pure.test.js
          - rules/okf.md
          - references/spec-authoring/index.md
          - .gitmessage
          - docs/contributing.md
          - docs/distill-decommission-audit.md
        revision: r2
      - task: '005'
        decision: 'accepted: TASKS-005 committed 09a3524fda2d61f242267210aea79424ec975c74 on bouncer/069-004-005 at scope r2. Changed paths: .gitmessage, docs/contributing.md, docs/distill-decommission-audit.md, references/spec-authoring/index.md, rules/okf.md, scripts/lib/templates.js, scripts/src/lib/templates.ts, test/finalize-pure.test.js. Workers: bouncer-implementer (initial implementation; round-2 rework), bouncer-reviewer (round 1: major constraint-breach-title-module-package-rule and minor stale-audit-crossref; round 2 delta: both resolved, 0 new, 0 regressed). Scope r2 added docs/distill-decommission-audit.md (note cell only) to absorb the minor finding. Execute gate passed (npm run ci exit 0). Follow-up noted, not in this task: docs/contributing.md lines 33-39 carry pre-existing stale commit-assembly prose outside Touch.'
      - task: '002'
        kind: scope
        reason: 'Rework decision after TASKS-002 review round 1 (affected_paths unchanged). All six findings are inside scope and bear on current-task accuracy, so they are absorbed as one round-2 rework, not deferred: (1) correctness_tests-verification-bundle-no-main-contrast: keep tasks/002 in main for the rejection half and assert integration stays without it; (2) stale-verification-seed-comment (must_fix): rewrite the why-comment at coordinator.ts:483-485; (3) seed-failure-isolation-untested: add a forced worker-seed-failure test asserting main and the other worker copy are unchanged; (4) stale-test-name: rename the invalid-commit-type test and its comment; (5) verification-check-after-mutation: move the pure-read checkVerificationNode check into the pre-check phase before any worktree creation, per the Constraint ordering; (6) object-key-spacing at coordinator.ts:519,533.'
        previous:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - test/coordinator.test.js
          - docs/cli.md
          - skills/bouncer-run/SKILL.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
        next:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - test/coordinator.test.js
          - docs/cli.md
          - skills/bouncer-run/SKILL.md
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
        revision: r3
      - task: '002'
        decision: 'accepted: TASKS-002 committed 1820318e322dea156a0ddf039c7571d85f753743 on bouncer/069-004-002 at scope r3. Changed paths: .codex/agents/bouncer-coordinator.toml, agents/bouncer-coordinator.md, docs/cli.md, scripts/lib/coordinator.js, scripts/src/lib/coordinator.ts, skills/bouncer-run/SKILL.md, test/coordinator.test.js. Workers: bouncer-implementer (initial implementation; round-2 rework of six in-scope findings), bouncer-reviewer (round 1: 3 minor + 3 nit; round 2 delta: 6 resolved, 0 new, 0 regressed). Execute gate passed (npm run ci exit 0).'
      - task: '003'
        kind: scope
        reason: 'Rework decision after TASKS-003 review round 1 (affected_paths unchanged). All five advisory findings are in scope and bear on current-task accuracy or robustness, so they are absorbed as one round-2 rework: (1) quality-duplicated-evidence-reader: share one safe bouncer-frontmatter reader between coordinator.ts and finalize.ts inside affected_paths (no import cycle), and stop depending on the literal ''missing frontmatter block'' message; (2) tests-repair-task-evidence-uncovered: add a dynamic repair task integrate case for scaffold rejection and terminal copy; (3) quality-restore-leaves-created-dir: restore removes a task directory that the copy created; (4) tests-e2e-finalize-assertion-weak: pin the positive dry-run outcome; (5) docs-writePlanDoc-jsdoc-param: document the type parameter.'
        previous:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/finalize.ts
          - scripts/lib/finalize.js
          - test/coordinator.test.js
          - test/finalize.test.js
          - test/coordinator-e2e.test.js
          - test/native-profile-e2e.test.js
          - docs/cli.md
        next:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/finalize.ts
          - scripts/lib/finalize.js
          - test/coordinator.test.js
          - test/finalize.test.js
          - test/coordinator-e2e.test.js
          - test/native-profile-e2e.test.js
          - docs/cli.md
        revision: r4
      - task: '003'
        decision: 'accepted: TASKS-003 committed 2389fb3b82d2a219cac8c13dba97b131ecd231ed on bouncer/069-004-003 at scope r4. Changed paths: docs/cli.md, scripts/lib/coordinator.js, scripts/lib/finalize.js, scripts/src/lib/coordinator.ts, scripts/src/lib/finalize.ts, test/coordinator-e2e.test.js, test/coordinator.test.js, test/finalize.test.js, test/native-profile-e2e.test.js. Workers: bouncer-implementer (initial implementation; round-2 rework of five in-scope findings), bouncer-reviewer (round 1: 2 minor + 3 nit; round 2 delta: 5 resolved, 0 regressed, 2 new advisory introduced_by_revision). Coordinator judgment: the two new advisory findings (readBouncerBlock null-branch tests, fence regex duplicating the private parser regex) change neither contract nor verification outcome and fail safe, so they are deferred, not reworked in a third round; both are recorded with a follow-up owner in the blueprint index.md 이연 항목 section of the integration copy. Execute gate passed (npm run ci exit 0).'
      - task: '004'
        kind: scope
        reason: 'Rework decision after TASKS-004 review round 1 (affected_paths unchanged). All six findings are in scope; three bear on the release Constraint and Interface accuracy, three are cheap doc/test precision in the same files, so all are absorbed as one round-2 rework: (1) quality-prune-above-blueprint: release prunes empty dirs only inside the blueprint tree and never removes the parent blueprints/ dir or anything above, with a test; (2) spec-preserved-conflates-tampered-entries: keep preserved but reword cleanup-handoff so preserved also covers entries release did not judge; (3) quality-malformed-manifest-entry-throws: validate every manifest entry before any main write so a malformed entry cannot cause a partial write; (4) spec-repo-flag-optional: add --repo to the handoff command and state the cwd default; (5) spec-handoff-blueprint-placeholder: clarify the placeholder is the value used for finalize --yes; (6) tests-refusal-precedence: add one combined-refusal precedence case.'
        previous:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - docs/cli.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/skill-bouncer-finalize.test.js
        next:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - docs/cli.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/skill-bouncer-finalize.test.js
        revision: r5
      - task: '004'
        kind: scope
        reason: 'Round-3 rework decision after TASKS-004 review round 2 (affected_paths unchanged). Round 2 resolved all six round-1 findings with 0 regressions and found one new nit introduced by the revision: quality-preserved-mixes-paths-and-json-text. It is a current-task accuracy issue in the task''s own handoff text, so it is not deferred. Round-3 entry condition holds (no open blocker/major, latest verify passed, fix fits Goal/Interface/Constraints/affected_paths with no design or interface change). Fix: keep the preserved payload shape and state in cleanup-handoff.md (and keep docs/cli.md consistent) that a preserved item may be a malformed manifest entry shown as JSON text rather than a path. This is the final permitted round; any remaining actionable finding after round 3 stops the task for a coordinator decision.'
        previous:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - docs/cli.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/skill-bouncer-finalize.test.js
        next:
          - scripts/src/lib/seed-worktree.ts
          - scripts/lib/seed-worktree.js
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - docs/cli.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/seed-worktree.test.js
          - test/coordinator.test.js
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/skill-bouncer-finalize.test.js
        revision: r6
      - task: '004'
        decision: 'accepted: TASKS-004 committed 220423eb74732c20dc71a182a0e1dcfba035f6e2 on bouncer/069-004-004 at scope r6. Changed paths: docs/cli.md, scripts/lib/cli-git-commands.js, scripts/lib/coordinator.js, scripts/lib/seed-worktree.js, scripts/src/lib/cli-git-commands.ts, scripts/src/lib/coordinator.ts, scripts/src/lib/seed-worktree.ts, skills/bouncer-finalize/references/cleanup-handoff.md, test/cli-coordinate.test.js, test/coordinator-e2e.test.js, test/coordinator.test.js, test/seed-worktree.test.js, test/skill-bouncer-finalize.test.js. Workers: bouncer-implementer (initial; r5 rework; r6 wording rework), bouncer-reviewer (round 1: 3 minor + 3 nit; round 2 delta: 6 resolved, 1 new nit introduced_by_revision; round 3 delta under the entry condition: 1 resolved, 0 new, 0 regressed). Execute gate passed (npm run ci exit 0). Drive-level document decision recorded here because no task-free ledger surface exists: the integration copy of the epic index .bouncer/context/epics/069-workflow-improvement/index.md, seeded from main''s uncommitted working copy by bootstrap, carried the OKF section-6 scaffold guide comment that lint:context-comments rejects in changed context docs; the coordinator removed only that template comment so the TASKS-006 terminal npm run ci is not failed by a pre-existing plan-document artifact that no source repair wave could fix.'
---
# Explain

## Background
coordinator 드라이브는 메인 작업 트리에 커밋되지 않은 계획 문서에 기대고 있었다. 그래서 준비, 증적, 마감 단계마다 드라이브가 멈췄다.
- worker 준비가 메인 사본을 읽어서, 메인에 blueprint가 없으면 prepare가 실패했다.
- 검증·리뷰 증적이 worker 사본에만 남아 finalize의 G16이 열린 task로 판정했다.
- 마감 뒤 메인에 남은 계획 문서 사본이 integration 브랜치 병합과 충돌했다.
- 커밋 문장 parser가 영문 식별자를 담은 한국어 문장까지 거절했다.

이 blueprint는 integration 작업 트리를 드라이브의 계획 문서 정본으로 삼고, 네 문제를 시작·준비·통합·마감 순서로 한 커밋씩 닫았다. parser 완화는 독립 커밋으로 병렬 처리했다.

드라이브 기록:
- DAG는 승인 때와 같다: 001 → 002 → 003 → 004 → 006, 005 → 006. 추가·분할된 task와 repair wave는 없다.
- 모든 결과는 이름 붙은 `bouncer-implementer`가 만들고 `bouncer-reviewer`가 판정했다. 통합 head는 `af8a692`이고 TASKS-006이 그 위에서 `npm run ci`를 exit 0으로 통과했다.
- task별 scope revision과 이유:
  - TASKS-001 r1: 경로는 그대로다. 사용자가 `seedManifest`를 원장 전용 계약으로 정하고 문서 수정 한 건의 추가 rework를 승인한 기록이다.
  - TASKS-005 r2: `docs/distill-decommission-audit.md`를 더했다. 새 규칙과 어긋난 해소 메모 한 칸을 고치기 위해서다.
  - TASKS-002 r3, TASKS-003 r4, TASKS-004 r5·r6: 경로는 그대로다. 리뷰 finding을 한 번의 rework로 흡수한 판단 기록이다.
- 이연 항목 세 건(`readBouncerBlock` 방어 분기 테스트, frontmatter 정규식 중복, `docs/contributing.md` 옛 조립 설명)은 blueprint `index.md`에 후속 소유자와 함께 적었다.
- 드라이브 중 문서 판단 두 가지를 했다.
  - bootstrap이 메인에서 가져온 epic `index.md`에 남은 스캐폴드 주석을 지웠다. terminal CI의 `lint:context-comments`가 변경된 계획 문서를 검사하기 때문이다.
  - 설치된 1.4.3 CLI의 verification node 준비가 integration 자신에게 복사하려다 실패했다. 이 blueprint가 고친 결함이라, 그 prepare 한 번만 integration 빌드의 CLI로 실행했다.

## Intuition
integration 작업 트리가 계획 문서의 원본이고, 메인은 출발 SHA만 빌려준다. 시작할 때 문서를 integration에 복사하고, worker는 거기서 받고, 증적은 거기로 돌아온다. 끝나면 메인의 복사본을 해시로 확인해 돌려놓는다.

## Code
- `scripts/src/lib/seed-worktree.ts`
  - `seedIntegration`: bootstrap 때 계획 문서와 config를 integration에 복사하고 경로별 sha256 manifest를 만든다.
  - `releaseSeedManifest`: 마감 뒤 manifest와 바이트가 같은 메인 사본만 되돌린다.
- `scripts/src/lib/coordinator.ts`
  - bootstrap: seed가 성공한 뒤에만 원장에 `seedManifest`를 쓴다. 응답에는 넣지 않는다.
  - prepare: integration 사본만으로 worker를 준비하고, verification node는 읽기만 하는 사전 검사로 확인한다.
  - commit task integrate: worker 증적이 terminal이고 SHA가 맞을 때만 bundle을 가져온다.
  - `release`: 마감 뒤 메인에서 실행하는 새 명령이다.
- `scripts/src/lib/finalize.ts`: 원장과 integration 문서 상태가 어긋나면 G16 전에 `coordinator-evidence-mismatch`로 멈춘다.
- `scripts/src/lib/runtime-state.ts`: `seedManifest` 모양을 검증한다.
- `scripts/src/lib/templates.ts`: `normalizeAuthoredLines`가 줄 수, 한국어 포함, 한국어 종결형만 판정한다.
- `scripts/src/lib/cli-git-commands.ts`: coordinate 명령 목록에 `release`를 더한다.
- `skills/bouncer-finalize/references/cleanup-handoff.md`: worktree 제거 전에 release를 실행하고 `preserved`를 보고하는 단계를 적는다.
- `docs/cli.md`: bootstrap, prepare, integrate, finalize, release의 동작과 거절 reason을 적는다.
- 테스트: `test/coordinator.test.js`, `test/coordinator-e2e.test.js`, `test/seed-worktree.test.js`, `test/finalize.test.js`, `test/finalize-pure.test.js`.

## Quiz
문항 수는 5개다. 다섯 커밋이 31개 파일에 걸쳐 시작·준비·통합·마감과 parser를 각각 바꿨으므로 커밋마다 한 문항씩 둔다.

1. bootstrap이 기록하는 경로별 sha256 `seedManifest`는 어디에 있고 무엇이 읽는가?
   - A) bootstrap 응답 JSON의 필드로 돌아오고 호출자가 보관한다.
   - B) coordinator 원장에만 기록되고 마감 뒤 `release`가 읽는다.
   - C) 메인 checkout의 `.bouncer/config.json`에 기록되고 prepare가 읽는다.
2. `coordinate prepare`가 worker에 계획 문서와 config를 복사할 때 출처는 어디인가?
   - A) integration 작업 트리의 사본
   - B) 메인 working tree의 사본
   - C) worker 브랜치 HEAD의 blob
3. commit task의 `coordinate integrate`가 worker bundle을 integration으로 가져오기 전에 확인하는 조건은 무엇인가?
   - A) worker에 `review.md`가 있는지만 확인한다.
   - B) `verification.md`가 `passed`인지만 확인한다.
   - C) tasks `verified`, verification `passed`, review `accepted`이고 `commit_sha`가 원장 SHA 앞 8자리와 같은지 확인한다.
4. `coordinate release`가 메인 계획 문서의 sha256이 manifest와 다르다고 판정하면 어떻게 하는가?
   - A) 건드리지 않고 `preserved`로 보고한다.
   - B) `HEAD` 버전으로 복원한다.
   - C) untracked라면 삭제한다.
5. 완화된 커밋 문장 검사가 여전히 거절하는 문장은 무엇인가?
   - A) `scripts/lib/finalize.js의 검사를 완화함.`처럼 경로를 담은 한국어 종결 문장
   - B) `branch 이름 계산`처럼 한국어 종결형이 없는 문장
   - C) `` `bouncer finalize`가 기록된 값을 읽음. ``처럼 backtick 인용을 담은 한국어 종결 문장

## 이해 상태
정답은 1-B, 2-A, 3-C, 4-A, 5-B이며 응답도 1-B, 2-A, 3-C, 4-A, 5-B입니다. 다섯 문항 모두 정답(5/5)입니다. `seedManifest`가 원장 전용이고 `release`만 읽는다는 점, worker 준비 출처가 integration 사본이라는 점, bundle 반환 전 세 상태와 SHA 앞 8자리 대조, 바이트가 달라진 메인 사본의 보존, 종결형 없는 문장만 거절하는 parser 완화를 이해한 것으로 기록했습니다.

## Tasks

### Task 001

#### Goal & intent

`coordinate bootstrap`이 integration worktree를 준비한 직후 메인 working tree의 계획 문서 집합(blueprint 트리, 상위 epic `index.md`, context `index.md`)과 `.bouncer/config.json`을 integration으로 복사한다. 계획 문서마다 경로와 sha256을 ledger `seedManifest`에 남긴다. 메인에 커밋되지 않은 blueprint만 있어도 drive가 시작되고, 이후 prepare·finalize·release는 integration 사본과 manifest를 기준으로 동작한다. 검증 명령은 `npm run ci`.

#### Interface

- 제공:
  - `seedIntegration({ repoRoot, blueprintDir, integrationPath })` → `{ ok: true, seeded, manifest, config }`. 복사만 하고 메인 문서를 복원하거나 삭제하지 않는다.
  - `coordinate bootstrap`은 ledger가 없을 때만 seed를 실행하고, 성공한 뒤에 `seedManifest`를 담은 ledger를 쓴다. `taskList`는 integration 사본을 읽는다.
  - `validateCoordinatorLedger`는 `seedManifest`가 있으면 `{ path: 비지 않은 저장소 상대 경로, sha256: 64자리 소문자 hex }` 배열인지 검사한다.
- 거부:
  - 메인에 blueprint 디렉터리가 없으면 `missing-blueprint`.
  - integration 사본이 메인 바이트와도 `HEAD` blob과도 다르면 `seed-conflict`와 `conflicts`.
  - 복사 중 오류는 `seed-failed`와 `message`.
  - 위 세 경우 모두 `targets`를 함께 반환하고, ledger 파일을 만들지 않으며 메인 파일을 바꾸지 않는다.
  - 모양이 틀린 `seedManifest`는 `invalid-seed-manifest`.

#### Do not touch

- `scripts/src/lib/finalize.ts` — 증적 대조는 TASKS-003 몫
- `scripts/src/lib/templates.ts` — parser 변경은 TASKS-005 몫
- `scripts/src/lib/execute-prepare.ts` — 단독 execute의 이동 seed는 범위 밖
- `skills/bouncer-finalize/references/cleanup-handoff.md` — 메인 문서 반환은 TASKS-004 몫

### Task 002

#### Goal & intent

`coordinate prepare`는 integration을 계획 문서 정본으로 쓴다. 각 worker는 integration의 blueprint 트리와 config를 받으므로 메인에 계획 문서가 없어도 준비된다. drive 동안 메인은 base SHA 출처로만 남는다. 검증 명령은 `npm run ci`.

#### Interface

- 제공:
  - prepare는 `seedCoordinatorWorker({ repoRoot: integrationPath, blueprintDir, worktreePath })`를 항상 호출한다. `item.dynamic`에 따른 출처 분기를 없앤다.
  - prepare가 `branchNamesFor`로 읽는 `commit_type`도 integration 사본의 blueprint `index.md`에서 읽는다.
  - verification node 준비(`seedVerificationNode`)는 메인에서 bundle과 config를 복사하지 않는다. integration 사본에 해당 bundle이 있는지만 확인한다. 그래서 `coordinate repair`가 integration에서 바꾼 terminal `tasks.md`가 다시 덮이지 않는다.
- 거부:
  - integration에 verification bundle이 없으면 `missing-verification-bundle`로 거절하고 ledger를 바꾸지 않는다.
  - integration에 blueprint 디렉터리가 없으면 worker worktree를 만들기 전에 `{ ok: false, reason: 'missing-blueprint', blueprintDir, integrationPath }`로 거절하고 ledger와 Git 등록을 바꾸지 않는다.
  - worker seed 실패는 메인 문서와 다른 worker의 문서를 바꾸지 않는다.

#### Do not touch

- `scripts/src/lib/seed-worktree.ts` — seed 함수 자체는 TASKS-001이 확정함
- `scripts/src/lib/finalize.ts` — 증적 대조는 TASKS-003 몫
- `scripts/src/lib/templates.ts` — parser 변경은 TASKS-005 몫

### Task 003

#### Goal & intent

commit task의 `coordinate integrate`가 worker의 terminal 증적을 확인한 뒤 그 task bundle을 integration의 같은 경로로 가져온다. drive finalize는 ledger와 integration 문서 상태가 어긋나면 G16 판정 전에 이름 붙은 오류로 멈춘다. 모든 commit task가 통합된 drive는 수동 문서 편집 없이 G16의 열린 task 판정을 통과한다. 검증 명령은 `npm run ci`.

#### Interface

- 제공:
  - `coordinate integrate --task <NNN>`(commit task)은 cherry-pick 전에 worker의 `<blueprint>/tasks/<NNN>/{tasks,verification,review}.md`를 읽는다. tasks `verified`, verification `passed`, review `accepted`이고 tasks `bouncer.commit_sha`가 ledger `sha`의 앞 8자리와 같을 때만 세 문서를 integration의 같은 경로로 복사하고 cherry-pick한 뒤 ledger를 갱신한다.
  - drive finalize(ledger `ok`)는 ledger에서 `integrated`인 task마다 integration `tasks.md` 상태가 commit task는 `verified`, verification task는 `integrated`인지 대조한다. dry-run과 `--yes`가 같은 판정을 쓴다.
- 거부:
  - 상태가 terminal이 아니면 `worker-evidence-not-terminal`, SHA가 다르면 `worker-evidence-sha-mismatch`와 해당 `files`를 반환한다. cherry-pick, 복사, ledger 쓰기를 하지 않는다.
  - cherry-pick이 실패하면 복사한 세 문서를 이전 바이트로 되돌리고 기존 throw 경로를 유지한다.
  - finalize 대조가 어긋나면 `{ ok: false, reason: 'coordinator-evidence-mismatch', tasks }`로 멈추고 문서와 커밋을 바꾸지 않는다.

#### Do not touch

- `scripts/src/lib/validate-gates.ts` — G16 코드와 메시지는 그대로 둠
- `scripts/src/lib/templates.ts` — parser 변경은 TASKS-005 몫
- `skills/bouncer-finalize/references/cleanup-handoff.md` — 메인 문서 반환은 TASKS-004 몫

### Task 004

#### Goal & intent

drive는 계획 문서를 integration으로 복사만 하므로, finalize가 integration 브랜치에 `explain.md`와 blueprint `index.md`를 커밋하고 나면 메인에 같은 경로의 사본이 남는다. 이 사본 때문에 메인에서 integration 브랜치를 병합하면 Git이 멈춘다. 새 `coordinate release`가 finalize 뒤 메인에서 bootstrap manifest와 바이트가 같은 사본만 되돌린다. 병합은 계획 문서 충돌 없이 끝나고, drive 도중 고친 문서는 보존된다. 검증 명령은 `npm run ci`.

#### Interface

- 제공:
  - `bouncer coordinate release --blueprint <dir> --repo <main>`을 메인 checkout에서 실행한다. manifest의 각 경로를 판정한다.
    - 메인에 없거나 이미 `HEAD` blob과 같음 → `absent`
    - sha256 일치 + `HEAD`에 있음 → `git checkout HEAD -- <path>` → `restored`
    - sha256 일치 + `HEAD`에 없음 → staged면 unstage, 삭제, 빈 디렉터리 정리 → `released`
    - sha256 불일치 → 건드리지 않음 → `preserved`
  - payload는 `{ ok: true, command: 'release', released, restored, preserved, absent }`이다. 다시 실행해도 같은 상태로 수렴한다.
  - `cleanup-handoff.md`: finalize payload의 `integration.ledger`가 `ok`이면 worktree 제거·유지 선택과 무관하게 worktree 제거 전에 release를 메인에서 실행하고 `preserved`를 사용자에게 보고한다.
- 거부(모두 메인 파일 불변):
  - repoRoot나 cwd가 메인 checkout이 아니면 `release-requires-main-checkout`
  - ledger가 없으면 `missing-ledger`, `seedManifest`가 없으면 `missing-seed-manifest`
  - ledger status가 `awaiting_confirmation`/`partial_closed`이거나 `integrated`가 아닌 task가 있으면 `drive-not-closed`
  - integration의 blueprint `index.md`가 `closed`가 아니면 `blueprint-not-closed`

#### Do not touch

- `skills/bouncer-finalize/SKILL.md` — 진입 스킬 단어 예산을 늘리지 않고 reference가 단계를 소유함
- `scripts/src/lib/finalize.ts` — finalize payload 계약은 그대로 둠
- `scripts/src/lib/templates.ts` — parser 변경은 TASKS-005 몫
- `scripts/src/lib/execute-prepare.ts` — 단독 execute는 이미 계획 문서를 이동함

### Task 005

#### Goal & intent

`normalizeAuthoredLines`가 한국어 종결 문장 안의 영문 식별자, 경로, 패키지 이름, backtick 인용을 받아들이게 한다. blueprint `## Intent`, task `commit_intent`, `commit_summary`에 같은 규칙을 적용한다. 줄바꿈, 빈 문장, 3문장 이상, 한국어 부재, 한국어 종결형 부재는 계속 거절한다. 문서의 "파일·모듈·패키지 이름을 쓰지 않는다" 규칙도 같은 방향으로 고친다. 검증 명령은 `npm run ci`.

#### Interface

- 제공: 다음 줄이 blueprint Intent와 두 task 필드에서 모두 통과한다.
  ```text
  branch 이름을 CLI helper 한 곳에서 계산함.
  integrationBranch 값을 재계산 없이 사용함.
  scripts/lib/finalize.js의 검사를 완화함.
  `bouncer finalize`가 기록된 값을 읽음.
  ```
- 거부(기존 오류 문구 `must contain 1-2 Korean terminal sentences` 유지):
  - 배열이 아니거나 항목이 0개 또는 3개 이상
  - 문자열이 아닌 항목, 빈 문자열, 줄바꿈이 든 문자열
  - 한글이 없는 문장(`update branch name.`)
  - 한국어 종결형이 없는 문장(`branch 이름 계산`)

#### Do not touch

- `scripts/src/lib/finalize.ts` — 호출부와 메시지 조립 순서는 그대로 둠
- `scripts/src/lib/coordinator.ts` — drive 문서 흐름은 TASKS-001–004 몫
- `docs/cli.md` — 병렬 wave의 TASKS-001이 수정하는 파일

### Task 006

#### Goal & intent

TASKS-001–005가 모두 통합된 integration head에서 `npm run ci`를 한 번 실행하고 결과를 `verification.md`에 남긴다. 성공하면 epic 성공 기준 11이 이 blueprint에서 참이 된다.

#### Interface

- 제공: 통합 head의 전체 CI 실행 증적과 `ready → verifying → integrated` 전이.
- 거부: 실패한 실행은 `integrated`로 올리지 않는다. terminal CI 실패는 coordinator repair 절차(최대 두 wave)로 넘긴다.

#### Do not touch

- `scripts/` — verification node는 source diff를 만들지 않음
- `test/` — 검증만 실행하고 테스트를 고치지 않음