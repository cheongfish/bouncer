---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/075-adaptive-review-dispatch/blueprints/001-adaptive-review-dispatch/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-21T11:57:57.909+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '075'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2c26586bd4f6e989dc6c62df79ec2158a097ba04
      diff_sha: 853947907708009a3b40a9006b19e5711c191676cf7cc95420c6336a02fd3ad0
      quiz_score: 0/3
      disposition: recorded — thresholds and perspectives-only fan-out missed; proceed to remainder
      recorded_at: '2026-09-21T12:08:40+09:00'
  task_commits:
    - task: EPIC-075/BP-001/TASK-001
      sha: 51055f27
      intent_anchor: task-001
    - task: EPIC-075/BP-001/TASK-002
      sha: 8981f357
      intent_anchor: task-002
    - task: EPIC-075/BP-001/TASK-003
      sha: 62b7918f
      intent_anchor: task-003
  coordinator:
    base: 742544528b87cb8d135d75633563c2a3ee8dd5b9
    integration_head: 2c26586bd4f6e989dc6c62df79ec2158a097ba04
    integration_branch: feat/075-001-adaptive-review-dispatch
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/075/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/075/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/075/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/075/001/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: 51055f27fc8e92a58339a7013c1908b3c9c6f987
        branch: bouncer/075-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - rules/cli.md
          - rules/gates.md
          - scripts/lib/cli-review-dispatch-command.js
          - scripts/lib/cli.js
          - scripts/lib/review-dispatch.js
          - scripts/lib/templates.js
          - scripts/lib/validate-sections.js
          - scripts/lib/validate-structural.js
          - scripts/src/lib/cli.ts
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-sections.ts
          - scripts/src/lib/validate-structural.ts
          - test/cli-help.test.js
          - test/scaffold.test.js
          - test/validate-gates.test.js
          - test/validate-structural.test.js
          - scripts/src/lib/cli-review-dispatch-command.ts
          - scripts/src/lib/review-dispatch.ts
          - test/review-dispatch.test.js
      - id: '002'
        status: integrated
        sha: 8981f357ae1ee8b338ebfb3169fd524a59e71657
        branch: bouncer/075-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - agents/bouncer-context-reviewer.md
          - references/context-review/index.md
          - references/spec-authoring/index.md
          - rules/okf.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/context-review.md
          - test/agents.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-context-review.test.js
          - test/skill-spec-authoring.test.js
      - id: '003'
        status: integrated
        sha: 62b7918ff8527ab8ad64438469800a8ab2049471
        branch: bouncer/075-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-reviewer.toml
          - agents/bouncer-coordinator.md
          - agents/bouncer-reviewer.md
          - references/review/assets/reviewer-prompt.md
          - references/review/index.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/review-round.md
          - test/agents.test.js
          - test/coordinator.test.js
          - test/skill-bouncer-execute.test.js
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: a4761e0302d5aa984d7cf7a49cfa067635cd0ceb9280b1a39f78493ecbc8550b
        base_head: 742544528b87cb8d135d75633563c2a3ee8dd5b9
        initial_worktree_state: |
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: a4761e0302d5aa984d7cf7a49cfa067635cd0ceb9280b1a39f78493ecbc8550b
        outcome: accepted
        summary: Implementer delivered review-dispatch classifier, CLI, S30 structural checks, adaptive perspectives, and focused tests within affected_paths; Brief revision matched attempt 1.
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        base_head: 742544528b87cb8d135d75633563c2a3ee8dd5b9
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M rules/cli.md
           M rules/gates.md
          A  scripts/lib/cli-review-dispatch-command.js
          M  scripts/lib/cli.js
          A  scripts/lib/review-dispatch.js
          M  scripts/lib/templates.js
          M  scripts/lib/validate-sections.js
          M  scripts/lib/validate-structural.js
           M scripts/src/lib/cli.ts
           M scripts/src/lib/templates.ts
           M scripts/src/lib/validate-sections.ts
           M scripts/src/lib/validate-structural.ts
           M test/cli-help.test.js
           M test/scaffold.test.js
           M test/validate-gates.test.js
           M test/validate-structural.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
          ?? scripts/src/lib/cli-review-dispatch-command.ts
          ?? scripts/src/lib/review-dispatch.ts
          ?? test/review-dispatch.test.js
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        outcome: accepted
        summary: Lint max-len wrap-only fix applied to review-dispatch.ts and templates.ts; eslint clean; emit rebuilt. Brief revision matched attempt 2.
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        base_head: 742544528b87cb8d135d75633563c2a3ee8dd5b9
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M rules/cli.md
           M rules/gates.md
          A  scripts/lib/cli-review-dispatch-command.js
          M  scripts/lib/cli.js
          A  scripts/lib/review-dispatch.js
          M  scripts/lib/templates.js
          M  scripts/lib/validate-sections.js
          M  scripts/lib/validate-structural.js
           M scripts/src/lib/cli.ts
           M scripts/src/lib/templates.ts
           M scripts/src/lib/validate-sections.ts
           M scripts/src/lib/validate-structural.ts
           M test/cli-help.test.js
           M test/scaffold.test.js
           M test/validate-gates.test.js
           M test/validate-structural.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
          ?? scripts/src/lib/cli-review-dispatch-command.ts
          ?? scripts/src/lib/review-dispatch.ts
          ?? test/review-dispatch.test.js
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        outcome: accepted
        summary: 'Rework: keep perspective enum spans contiguous for scaffold regex while satisfying max-len; emit rebuilt. Brief revision matched attempt 3.'
      - task: '001'
        kind: dispatch
        attempt: 4
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        base_head: 742544528b87cb8d135d75633563c2a3ee8dd5b9
        initial_worktree_state: |2
           M rules/cli.md
           M rules/gates.md
          A  scripts/lib/cli-review-dispatch-command.js
          M  scripts/lib/cli.js
          A  scripts/lib/review-dispatch.js
          M  scripts/lib/templates.js
          M  scripts/lib/validate-sections.js
          M  scripts/lib/validate-structural.js
           M scripts/src/lib/cli.ts
           M scripts/src/lib/templates.ts
           M scripts/src/lib/validate-sections.ts
           M scripts/src/lib/validate-structural.ts
           M test/cli-help.test.js
           M test/scaffold.test.js
           M test/validate-gates.test.js
           M test/validate-structural.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
          ?? scripts/src/lib/cli-review-dispatch-command.ts
          ?? scripts/src/lib/review-dispatch.ts
          ?? test/review-dispatch.test.js
      - task: '001'
        kind: report
        attempt: 4
        task_brief_hash: 600e586259932676d62698f3b42a73ce48cdda30ce3df64412a0071851cb40e2
        outcome: accepted
        summary: 'Review fix batch: Execute canonical blueprint guard (SEC-001) plus CT-001..004 regression tests; emit rebuilt. Brief revision matched attempt 4.'
      - task: '001'
        kind: dispatch
        attempt: 5
        task_brief_hash: 345c14fb520e2d9e378fde1fc5a7d23e309300d8bcf037fd01e5c0805229253d
        base_head: 51055f27fc8e92a58339a7013c1908b3c9c6f987
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '001'
        kind: report
        attempt: 5
        task_brief_hash: 345c14fb520e2d9e378fde1fc5a7d23e309300d8bcf037fd01e5c0805229253d
        outcome: accepted
        summary: 'Post-commit stamp reconciliation: worker HEAD 51055f27fc8e92a58339a7013c1908b3c9c6f987 already carries task 001; refresh accepted report to stamped brief hash for record.'
      - task: '001'
        decision: 'Integrated provenance for task 001: SHA 51055f27fc8e92a58339a7013c1908b3c9c6f987 on branch bouncer/075-001-001; paths rules/cli.md rules/gates.md scripts/{src/,}lib/{review-dispatch,cli-review-dispatch-command,cli,templates,validate-sections,validate-structural}.{ts,js} test/{review-dispatch,cli-help,scaffold,validate-gates,validate-structural}.test.js'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: fb0472c32af757564e6309fafca6f5e027cce3f2b0dd0cddd8ab398f83868183
        base_head: 75f3abfd81d24d0c051f708c2f4b942dabcdcad3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: fb0472c32af757564e6309fafca6f5e027cce3f2b0dd0cddd8ab398f83868183
        outcome: accepted
        summary: Plan workflow wired to review-dispatch CLI for single|clustered|skip; authoring/okf/agent/tests updated within affected_paths. Brief revision matched attempt 1.
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 720cfaedb5ec00ab30707a9db6524099a08beaeff3cab54c93c4149103125a6e
        base_head: 75f3abfd81d24d0c051f708c2f4b942dabcdcad3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  .codex/agents/bouncer-context-reviewer.toml
           M agents/bouncer-context-reviewer.md
           M references/context-review/index.md
           M references/spec-authoring/index.md
           M rules/okf.md
           M skills/bouncer-plan/SKILL.md
           M skills/bouncer-plan/references/context-review.md
           M test/agents.test.js
           M test/skill-bouncer-plan.test.js
           M test/skill-context-review.test.js
           M test/skill-spec-authoring.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 720cfaedb5ec00ab30707a9db6524099a08beaeff3cab54c93c4149103125a6e
        outcome: accepted
        summary: Reconcile after tasks→verified; implementation unchanged from attempt 1 acceptance.
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: 720cfaedb5ec00ab30707a9db6524099a08beaeff3cab54c93c4149103125a6e
        base_head: 75f3abfd81d24d0c051f708c2f4b942dabcdcad3
        initial_worktree_state: |2
           M .bouncer/context/index.md
          M  .codex/agents/bouncer-context-reviewer.toml
           M agents/bouncer-context-reviewer.md
           M references/context-review/index.md
           M references/spec-authoring/index.md
           M rules/okf.md
           M skills/bouncer-plan/SKILL.md
           M skills/bouncer-plan/references/context-review.md
           M test/agents.test.js
           M test/skill-bouncer-plan.test.js
           M test/skill-context-review.test.js
           M test/skill-spec-authoring.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: 720cfaedb5ec00ab30707a9db6524099a08beaeff3cab54c93c4149103125a6e
        outcome: accepted
        summary: CT-001 local-cluster document isolation tests added; Brief revision matched attempt 3.
      - task: '002'
        kind: dispatch
        attempt: 4
        task_brief_hash: a692cec0b0dd76e134c23460ff6489c21d56dea5e9c45c9098d628ed24325766
        base_head: 8981f357ae1ee8b338ebfb3169fd524a59e71657
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '002'
        kind: report
        attempt: 4
        task_brief_hash: a692cec0b0dd76e134c23460ff6489c21d56dea5e9c45c9098d628ed24325766
        outcome: accepted
        summary: Post-commit stamp reconciliation for task 002 SHA 8981f357ae1ee8b338ebfb3169fd524a59e71657
      - task: '002'
        decision: Task 002 recorded SHA 8981f357ae1ee8b338ebfb3169fd524a59e71657; Plan adaptive review-dispatch wiring.
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: 53193fef4735d7f2fcd1a9c939cb36ecaed91ee42567996b2d07f6f4d8a774f1
        base_head: b1a6996bea26c02417d30bffa5bbb86652e87f1b
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: 53193fef4735d7f2fcd1a9c939cb36ecaed91ee42567996b2d07f6f4d8a774f1
        outcome: accepted
        summary: Execute/coordinator review discovery wired to review-dispatch execute; combined/parallel/security contracts + tests. Brief revision matched attempt 1.
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: f3d9031f095c7d8428d5eee91333f3262e48e4cc92d9372bd34de94ce3ec0283
        base_head: b1a6996bea26c02417d30bffa5bbb86652e87f1b
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M .codex/agents/bouncer-coordinator.toml
           M .codex/agents/bouncer-reviewer.toml
           M agents/bouncer-coordinator.md
           M agents/bouncer-reviewer.md
           M references/review/assets/reviewer-prompt.md
           M references/review/index.md
           M skills/bouncer-execute/SKILL.md
           M skills/bouncer-execute/references/agent-dispatch.md
           M skills/bouncer-execute/references/review-round.md
           M test/agents.test.js
           M test/coordinator.test.js
           M test/skill-bouncer-execute.test.js
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: f3d9031f095c7d8428d5eee91333f3262e48e4cc92d9372bd34de94ce3ec0283
        outcome: accepted
        summary: 'Must-fix: walk-perspectives-only, combined+security test, risk_flags↔review_risk stop. Brief revision matched attempt 2.'
      - task: '003'
        kind: dispatch
        attempt: 3
        task_brief_hash: a6bf409e5a7c0b051e73358b23ddbbe35c9d480fe6f5363fd241091d7b7f0624
        base_head: 62b7918ff8527ab8ad64438469800a8ab2049471
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/075-adaptive-review-dispatch/
      - task: '003'
        kind: report
        attempt: 3
        task_brief_hash: a6bf409e5a7c0b051e73358b23ddbbe35c9d480fe6f5363fd241091d7b7f0624
        outcome: accepted
        summary: Post-commit stamp reconciliation task 003 62b7918ff8527ab8ad64438469800a8ab2049471
      - task: '003'
        decision: Task 003 recorded SHA 62b7918ff8527ab8ad64438469800a8ab2049471; Execute adaptive review-dispatch wiring.
---
# Explain

## Background
Plan과 Execute 리뷰는 문서·diff 규모와 관계없이 고정 관점 수를 호출했다. 작은 변경에도 3~4명의 reviewer가 뜨고, 공개 인터페이스·인증 같은 위험은 별도 신호 없이 같은 묶음에 섞였다. 이 blueprint는 구조화된 입력만으로 전략을 고르는 read-only CLI를 두고, Plan·Execute·coordinator가 그 결과를 같은 frozen target에 적용하게 했다.

## Intuition
리뷰어 수는 “항상 전부”가 아니라, 문서 묶음·diff 크기·승인된 위험 flag가 알려 주는 만큼만 부른다.

## Code
핵심 경로:
- `scripts/src/lib/review-dispatch.ts` — Plan cluster / Execute numstat·risk 분류 SSOT
- `scripts/src/lib/cli-review-dispatch-command.ts` — `bouncer review-dispatch plan|execute`
- `skills/bouncer-plan/**`, `references/context-review/**` — full Plan의 single·clustered 연결
- `skills/bouncer-execute/**`, `references/review/**`, `agents/bouncer-coordinator.md` — Execute combined·parallel·security와 walk-`perspectives`-only 디스패치

세 task 커밋(통합 HEAD `2c26586`):
1. TASK-001 `51055f27` — CLI·분류기·S30·adaptive perspective enum
2. TASK-002 `8981f357` — Plan workflow·authoring·context-reviewer 연결
3. TASK-003 `62b7918f` — Execute·coordinator discovery가 CLI `perspectives`만 순회

Drive 중 scope revision은 없었고, DAG는 001→002→003 그대로였다.

## Quiz
1. Execute 분류에서 changed file이 3개이고 additions+deletions가 200이면 기본 전략은?
   - A) `parallel`
   - B) `single`
   - C) `skip`
2. Plan에서 `scale: light`일 때 dispatch 전략은?
   - A) `single`
   - B) `clustered`
   - C) `skip`
3. Execute discovery reviewer를 열 때 컨트롤러가 따라야 할 fan-out 근거는?
   - A) `strategy`로 분기한 뒤 risk면 security를 따로 append
   - B) CLI가 반환한 `perspectives` 순서만 순회
   - C) 항상 세 관점 + security 네 명

## 이해 상태
- 정답: 1-B (`single`, files≤3·lines≤200), 2-C (`skip` on light), 3-B (`perspectives`만 순회)
- 응답: 1-A, 2-A, 3-A
- 채점: 틀림 / 틀림 / 틀림 → `quiz_score: 0/3`
- disposition: recorded — thresholds and perspectives-only fan-out missed; proceed to remainder

## Tasks

### Task 001

#### Goal & intent

Plan 문서와 Execute frozen diff를 읽는 `review-dispatch` CLI를 추가해 같은 입력에 같은 reviewer 호출 전략과 근거 JSON을 반환한다. `review_risk` 형식 오류나 입력 해석 실패 시 reviewer 목록 없이 거부하는 것이 수용 조건이다.

#### Current behavior

- `scripts/src/lib/cli.ts:26-48`의 정적 registry에는 review dispatch 명령이 없고, controller가 skill 문장으로 관점 수를 정한다.
- `scripts/src/lib/validate-sections.ts:43-47`은 Execute 네 관점과 Plan 네 관점만 허용하므로 combined·local·global 기록을 거부한다.
- `references/context-review/index.md:55-60`은 full Plan마다 네 reviewer를 고정 호출하고, `skills/bouncer-execute/references/review-round.md:15-17`은 Execute마다 세 관점을 고정 호출한다.
- 재현 명령은 `node --test test/cli-help.test.js test/validate-structural.test.js`이며 현재 help에는 `review-dispatch`가 없고 `bouncer.tasks.bouncer.review_risk`의 enum·중복 검사가 없다.

#### Target behavior

- 성공: Plan subcommand는 light를 `skip`, 구현 task 1개를 `single`, 2개 이상을 `clustered`로 반환하고 Interface backtick 식별자·Touch 경로 중첩의 연결 요소와 global review 필요 여부를 함께 낸다.
- 성공: Execute subcommand는 Git numstat 기준 changed file 3개 이하이면서 additions+deletions 200 이하를 `single`, 나머지를 `parallel`로 반환하고 위험 flag가 있으면 `security`를 추가한다.
- 실패: structural validation 실패, unknown·duplicate 위험 flag, task/base/head 부재와 Git diff 실패는 exit 1의 `{ ok: false }`로 반환하며 reviewer 목록을 만들지 않는다. 잘못된 argv는 stderr와 exit 2다.
- 보존: 분류는 working tree와 문서를 쓰지 않으며 기존 perspective 이름, round mode 순서, finding fingerprint와 gate 의미를 유지한다.

#### Interface

- 제공:
  - `classifyPlanReview({ repoRoot, blueprintDir }) -> PlanDispatchResult`
  - `classifyExecuteReview({ repoRoot, blueprintDir, taskId, base, head, exec }) -> ExecuteDispatchResult`
  - `bouncer review-dispatch plan --blueprint <dir>`
  - `bouncer review-dispatch execute --blueprint <dir> --task <ddd> --base <sha> --head <sha>`
  - Plan JSON은 `phase`, `target: { digest, documents }`, `strategy`, `task_count`, `clusters[{ id, tasks, interface_keys, touch_paths }]`, `perspectives`, `reasons`를 갖는다.
  - Execute JSON은 `phase`, `target: { base, head, task }`, `strategy`, `changed_files`, `changed_lines`, `risk_flags`, `perspectives`, `reasons`를 갖는다.
- 거부:
  - `review_risk`가 배열이 아니면 `S30 review_risk must be an array`로 거부한다. 허용 목록 밖의 값은 `S30 review_risk value invalid`, 중복값은 `S30 review_risk duplicate`로 각각 거부한다.
  - Plan의 비어 있거나 파싱되지 않는 Interface·Touch, Execute의 unknown task, non-commit task, 잘못된 Git ref는 `ok: false`이며 full/single 결과로 가장하지 않는다.
  - diff binary 행은 changed file에는 포함하고 changed line 합계에는 더하지 않는다. binary 여부만으로 전략을 `parallel`로 올리지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | 신규 추출 지점: Plan·Execute 리뷰 전략 분류 | Create | 분류 정본 없음 | 문서 cluster와 diff 규모·위험을 순수 결과로 계산 | CLI와 workflow가 같은 경계값을 쓰는 정본 |
| `scripts/lib/review-dispatch.js` | generated CommonJS | Create | 배포 산출물 없음 | TypeScript 분류기의 byte-matched emit 제공 | 배포 package는 생성 JS를 실행함 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `run` | Create | 공개 handler 없음 | 두 subcommand argv 검증과 JSON/exit contract 제공 | 분류 모듈과 CLI I/O 경계 분리 |
| `scripts/lib/cli-review-dispatch-command.js` | generated CommonJS | Create | 배포 산출물 없음 | TypeScript handler의 emit 제공 | 공개 CLI runtime 경로 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 공개 명령 registry·help 조립 | `review-dispatch` handler 등록 | 모든 공개 명령의 단일 registry |
| `scripts/lib/cli.js` | `COMMANDS` emit | Modify | 생성 CLI runtime | 새 handler require·등록 반영 | package 실행 산출물 |
| `scripts/src/lib/validate-sections.ts` | `REVIEW_PERSPECTIVE`, `CONTEXT_REVIEW_PERSPECTIVE` | Modify | round 관점 enum 검사 | combined·local·global과 legacy 이름을 구분해 허용 | 새 dispatch 기록을 G14·G18이 읽어야 함 |
| `scripts/lib/validate-sections.js` | perspective enum emit | Modify | 생성 validator runtime | TypeScript enum 변경 반영 | gate 실행 산출물 |
| `scripts/src/lib/validate-structural.ts` | 신규 추출 지점: `review_risk` 검사 | Modify | task frontmatter 구조 검사 | enum 배열·중복을 structural failure로 거부 | dispatch 전에 malformed 위험 입력 차단 |
| `scripts/lib/validate-structural.js` | `review_risk` 검사 emit | Modify | 생성 structural runtime | TypeScript 검사 반영 | CLI가 실제로 읽는 산출물 |
| `scripts/src/lib/templates.ts` | review·context-review template enum | Modify | scaffold 설명의 legacy perspective 목록 | adaptive perspective와 legacy 호환 범위 반영 | 새 round 작성자가 허용값을 보게 함 |
| `scripts/lib/templates.js` | template enum emit | Modify | 생성 scaffold runtime | TypeScript template 변경 반영 | 배포 CLI 산출물 |
| `test/review-dispatch.test.js` | Plan·Execute 분류 fixtures | Create | 분류 회귀 없음 | 경계값, cluster, risk, 실패와 read-only 성질 검증 | 핵심 observable contract |
| `test/cli-help.test.js` | public command assertions | Modify | 명령 목록 고정 | 새 help·usage·argv exit contract 고정 | 공개 CLI 누락 방지 |
| `test/validate-structural.test.js` | `review_risk` cases | Modify | 새 필드 shape 미검사 | valid enum과 invalid shape·unknown·duplicate 고정 | malformed 입력 회귀 방지 |
| `test/validate-gates.test.js` | adaptive perspective cases | Modify | legacy perspective·target 판정 | 새 perspective 허용과 namespace·target 거부 유지 | G14·G18 false rejection 방지 |
| `test/scaffold.test.js` | review template enum assertions | Modify | round template 존재만 검사 | scaffold 안내가 validator enum과 일치하는지 검사 | template·gate drift 방지 |
| `rules/cli.md` | read-only review dispatch command | Modify | 명령 정본에 surface 없음 | 두 호출형과 결과 처리 경계 기록 | workflow가 참조할 공개 명령 정본 |
| `rules/gates.md` | `S30` recovery contract | Modify | `S29`까지 구조 code 설명 | malformed `review_risk`의 원인·복구 경로 추가 | 새 structural failure를 운영자가 해석해야 함 |

#### Constraints

- CommonJS `export =` / `import = require()` 배포 계약과 TypeScript source/emit 일치를 유지한다.
- 분류기는 문서·Git을 읽기만 하며 cache, review document, pointer와 ledger를 쓰지 않는다.
- 크기 상수는 `PLAN_SMALL_MAX_TASKS = 1`, `EXECUTE_SMALL_MAX_FILES = 3`, `EXECUTE_SMALL_MAX_LINES = 200`으로 한 모듈에서 export한다.
- 위험은 승인된 `review_risk`만 사용하고 path명·diff 본문의 키워드로 추측하지 않는다.
- `review_risk` 부재는 legacy 호환을 위해 `[]`로 읽고, 새 문서의 malformed 값만 `S30`으로 거부한다.
- 기존 관점 이름이 기록된 review 문서는 계속 validator를 통과한다.

### Task 002

#### Goal & intent

`/bouncer-plan`이 affected_paths 확인 뒤 frozen snapshot에 `bouncer review-dispatch plan`을 실행하고, 반환된 `single | clustered` 전략만 context reviewer 호출 권한으로 사용하게 한다. light Plan의 `skip`은 기존 G18 면제와 문서 부재를 그대로 유지한다.

#### Current behavior

- `skills/bouncer-plan/references/context-review.md:10-21`은 full Plan마다 네 perspective를 병렬 호출하며 규모 입력을 읽지 않는다.
- `references/context-review/index.md:55-66`과 `agents/bouncer-context-reviewer.md:48-57`은 네 관점 이름을 호출 단위와 rubric 단위로 1:1 고정한다.
- `references/spec-authoring/index.md`는 task author가 공개 interface·인증·권한·credential 위험을 구조화해 기록하는 필드를 설명하지 않는다.
- `node --test test/skill-context-review.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js test/agents.test.js`는 현재 네 호출 고정을 기대한다.

#### Target behavior

- 성공: full Plan의 frozen digest 뒤 CLI 전략이 `single`이면 한 reviewer가 cross-document·scope·Korean quality·success criteria를 모두 판단한다.
- 성공: `clustered`이면 각 local reviewer가 배정 cluster의 task-local Interface·Touch·Checklist, `affected_paths`와 red assertion을 판단한다. 한 global reviewer는 epic→blueprint→tasks 계약, DAG·cluster 간 공유 경로, Korean quality와 epic 성공 조건의 전체 task coverage를 판단한다.
- 실패: CLI가 `ok: false`를 반환하거나 snapshot digest와 document set이 달라지면 reviewer를 호출하거나 context review를 accepted로 바꾸지 않는다.
- 보존: local reviewer끼리, local과 global reviewer끼리 finding을 공유하지 않으며 한 fix batch와 단일 delta certification만 수행한다. light는 reviewer를 호출하지 않는다.

#### Interface

- 제공:
  - Plan authoring은 각 commit task에 선택적 `bouncer.review_risk`를 쓰며, Interface·Touch가 공개 API, authentication, authorization, credential 변경을 명시할 때 해당 enum을 빠짐없이 기록한다. 해당 위험이 없으면 `[]`를 명시한다.
  - `single` perspective는 `combined`, `clustered`의 발견 perspective는 cluster별 `local`과 하나의 `global`이다. round 기록은 CLI의 cluster id와 동일한 dispatch 순서를 남긴다.
  - `combined`는 기존 네 rubric 전체를 판단한다. `local`은 배정 cluster 안에서 cross-document의 task 내부 절 정합성, scope의 `affected_paths`·Checklist 편집 경로, success criteria의 red assertion을 판단한다. `global`은 cross-document의 epic·blueprint·cluster 간 정합성, scope의 공유 경로·DAG, Korean quality 전체, success criteria의 epic coverage를 판단한다.
- 거부:
  - controller는 CLI cluster를 합치거나 나누지 않고, `single` 결과에 임의 관점을 추가하지 않는다.
  - local call은 다른 cluster 문서와 다른 reviewer finding을 받지 않으며 global call도 local finding을 받지 않는다.
  - `skip`을 inline review나 빈 accepted `context-review.md`로 대체하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | task frontmatter authoring rules | Modify | task brief 작성 규칙 | `review_risk` enum·근거·빈 배열 작성 규칙 추가 | 위험 입력은 Plan author가 승인 범위에서 확정해야 함 |
| `rules/okf.md` | Plan fields `review_risk` | Modify | task frontmatter 소유권·의미 | enum, legacy default와 authoring authority 기록 | 새 serialized field의 제품 정본 |
| `skills/bouncer-plan/SKILL.md` | Step 5 Review | Modify | full/light review 분기 | frozen snapshot 뒤 CLI 결과를 유일한 dispatch 선택으로 사용 | entry workflow 호출 순서 소유 |
| `skills/bouncer-plan/references/context-review.md` | Discovery dispatch | Modify | 네 관점 고정 호출 | single 또는 cluster-local+global 호출·record 절차 | controller dispatch 정본 |
| `references/context-review/index.md` | Step 3 Judge | Modify | 네 perspective 판단 계약 | combined·local·global의 입력과 delta 보존 규칙 | context review behavioral brief |
| `agents/bouncer-context-reviewer.md` | Review modes, rubric routing | Modify | 네 관점별 read-only 판단 | 세 adaptive perspective가 기존 rubric을 손실 없이 나눠 판단 | named/fallback 판단 정본 |
| `.codex/agents/bouncer-context-reviewer.toml` | generated agent body | Modify | 이전 역할 본문 변환물 | agent Markdown 변경을 byte-identical 반영 | compact named dispatch 안전 경계 |
| `test/skill-context-review.test.js` | adaptive dispatch assertions | Modify | 네 관점 병렬 호출 고정 | single·clustered·delta·light 경계 검증 | behavioral contract 회귀 |
| `test/skill-bouncer-plan.test.js` | Step 5 CLI selection assertions | Modify | context reviewer 호출 형태 고정 | CLI 실패·전략 준수·no override 검증 | entry skill 계약 고정 |
| `test/skill-spec-authoring.test.js` | `review_risk` authoring assertions | Modify | 새 위험 필드 규칙 없음 | enum·근거·빈 배열 규칙 고정 | malformed/누락 입력 예방 |
| `test/agents.test.js` | context reviewer perspective/TOML assertions | Modify | 네 관점과 TOML 일치 검사 | combined·local·global scope 및 변환 일치 검사 | role 경계와 generated artifact 회귀 |

#### Constraints

- context reviewer는 계속 read-only이며 Findings만 반환하고 controller만 문서·status를 쓴다.
- frozen digest와 cluster document list는 모든 discovery call에서 동일한 CLI 결과 revision을 사용한다.
- delta는 전략과 cluster 수에 관계없이 이전 finding과 실제 수정 문서만 받는 한 번의 certification이다.
- legacy `cross_document | scope | korean_quality | success_criteria` round 기록은 계속 유효하다.
- `review_risk`는 reviewer 수를 늘리는 입력일 뿐 `affected_paths`, status, gate 통과를 자동 승인하지 않는다.

### Task 003

#### Goal & intent

Execute와 coordinator가 frozen base/head 뒤 `bouncer review-dispatch execute` 결과로 discovery reviewer 구성을 선택하게 한다. 작은 diff는 combined reviewer 하나가 spec·correctness·maintainability를 판단하고, 위험 flag가 있으면 규모와 무관하게 별도 security reviewer를 추가한다.

#### Current behavior

- `skills/bouncer-execute/references/review-round.md:15-17`은 모든 diff에 세 관점을 병렬 호출하고 security 관련성은 controller의 판단에 맡긴다.
- `skills/bouncer-execute/references/agent-dispatch.md:75-93`은 named·fallback review 모두 세 관점을 고정하지만 규모·위험 payload가 없다.
- `agents/bouncer-reviewer.md:49-66`은 한 discovery call이 정확히 한 기존 perspective만 판단하게 하므로 combined 결과를 받을 수 없다.
- `agents/bouncer-coordinator.md:91-116`의 worker dispatch는 review strategy를 CLI에서 받아야 한다는 계약이 없다.
- 재현 명령은 `node --test test/skill-bouncer-execute.test.js test/agents.test.js test/coordinator.test.js`이며 현재 작은 diff의 단일 reviewer와 명시적 위험 flag를 단언하지 않는다.

#### Target behavior

- 성공: changed file 3개 이하·changed line 200 이하·위험 없음은 `combined` reviewer 한 명을 호출한다.
- 성공: 경계값을 넘는 diff는 기존 세 reviewer를 병렬 호출하고, 위험 flag가 있으면 `security` reviewer를 추가한다. 작은 위험 diff는 `combined + security` 두 호출이다.
- 실패: CLI 실패, 반환 target과 frozen base/head 불일치, 현재 task의 위험 flag와 payload 불일치 시 review round를 열거나 accepted로 기록하지 않는다.
- 보존: reviewer들은 같은 task brief hash·intent bundle revision·verify result를 받고 서로의 finding을 보지 않는다. aggregate, 한 fix batch, verify, 한 delta와 drive-only critical recovery 순서는 그대로다.

#### Interface

- 제공:
  - `combined` perspective는 `spec_scope`, `correctness_tests`, `minimality_maintainability` rubric을 한 pass에서 모두 적용하고 각 finding의 `category`에는 실제 하위 rubric 이름을 기록한다.
  - `parallel`은 기존 세 perspective 이름을 유지한다. `security`는 `review_risk`가 non-empty일 때만 별도 call로 추가한다.
  - named agent, generic fallback, inline pass와 coordinator drive는 CLI JSON의 `perspectives` 순서를 그대로 사용한다.
- 거부:
  - reviewer는 배정받지 않은 `security` rubric을 combined 판단에 섞지 않는다.
  - controller와 coordinator는 file/line 통계를 다시 계산하거나 path명·diff 본문에서 위험을 추측해 전략을 덮어쓰지 않는다.
  - delta call은 discovery perspective를 받지 않고 이전 finding·resolution·revision diff만 판단한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-execute/SKILL.md` | review step | Modify | Execute 단계 순서·조건 | frozen target 뒤 CLI 전략 조회와 실패 중단 연결 | entry workflow 소유 |
| `skills/bouncer-execute/references/review-round.md` | discover step, round ledger | Modify | 세 관점 고정 discovery | combined·parallel·security 선택과 delta 보존 | review 수렴 절차 정본 |
| `skills/bouncer-execute/references/agent-dispatch.md` | reviewer dispatch | Modify | named/fallback payload 구성 | CLI perspective 순서와 위험 flag를 동일하게 전달 | 모든 dispatch 경로 동등성 |
| `references/review/index.md` | discovery dispatch step | Modify | 세 관점 고정 review 절차 | CLI-selected combined·parallel·security 절차로 전환 | Execute가 직접 읽는 review behavioral brief |
| `references/review/assets/reviewer-prompt.md` | `PERSPECTIVE`, discovery rules | Modify | 네 기존 perspective prompt | combined scope와 risk_flags·strategy placeholder 추가 | per-call 입력 정본 |
| `agents/bouncer-reviewer.md` | Discovery, rubric routing | Modify | 한 기존 관점 판단 | combined가 세 비보안 rubric을 함께 판단하도록 허용 | named/fallback role 정본 |
| `agents/bouncer-coordinator.md` | Worker dispatch, review judgment | Modify | reviewer 호출·보고 판정 | CLI 전략 조회와 exact target/perspective 준수 | drive controller 계약 |
| `.codex/agents/bouncer-reviewer.toml` | generated reviewer body | Modify | 이전 역할 변환물 | reviewer Markdown 변경 반영 | compact named dispatch 경계 |
| `.codex/agents/bouncer-coordinator.toml` | generated coordinator body | Modify | 이전 coordinator 변환물 | coordinator Markdown 변경 반영 | named drive 역할 일치 |
| `test/skill-bouncer-execute.test.js` | adaptive review workflow assertions | Modify | 세 관점 고정 계약 | threshold·CLI 실패·delta 보존 검증 | entry/references 회귀 |
| `test/agents.test.js` | reviewer·coordinator·TOML assertions | Modify | 기존 perspective와 역할 byte 검사 | combined/security routing과 exact CLI result 준수 검증 | role 권한·payload 회귀 |
| `test/coordinator.test.js` | review dispatch contract assertions | Modify | coordinator state 전이 검증 | strategy 실패·target mismatch에서 미기록 확인 | drive false acceptance 방지 |

#### Constraints

- frozen base/head, task brief hash, intent bundle id/revision, intent sections와 latest verify는 모든 discovery call에서 동일하다.
- combined는 세 비보안 rubric의 finding을 누락하거나 severity로 필터링하지 않는다.
- security는 위험 flag가 있을 때 항상 별도 read-only call이며 다른 reviewer finding을 받지 않는다.
- discovery fan-out만 줄이고 한 aggregate·fix batch·delta certification·critical recovery 한도는 유지한다.
- legacy round의 기존 네 perspective 이름과 review document는 계속 유효하다.