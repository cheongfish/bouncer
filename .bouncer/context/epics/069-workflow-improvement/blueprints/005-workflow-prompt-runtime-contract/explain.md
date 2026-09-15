---
type: bouncer.explain
title: 워크플로 프롬프트 runtime contract 해설
description: Explains how the runtime contract, entry skills, and agent briefs were shortened and how fallback dispatch now carries the full role body.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/005-workflow-prompt-runtime-contract/explain.md
tags:
  - bouncer
  - explain
  - runtime-contract
  - fallback-dispatch
  - agent-brief
timestamp: '2026-09-15T16:02:25.967+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '069'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 16b4e342130b66c5468b0e63591b86f97206a6c7
      diff_sha: ce72c8a6f17bcf0fc8fe25a75a640b0ad0c90bdc39462e08051a775d747b3df7
      quiz_score: 6/6
      disposition: 여섯 문항을 모두 맞혀 공통 계약 축약, fallback payload 계약, r4 개정과 fan-in 처리를 이해한 것으로 기록함.
      recorded_at: '2026-09-15T16:07:14+09:00'
  task_commits:
    - task: EPIC-069/BP-005/TASK-001
      sha: 9f4966eb
      intent_anchor: task-001
    - task: EPIC-069/BP-005/TASK-002
      sha: 031a52b0
      intent_anchor: task-002
    - task: EPIC-069/BP-005/TASK-003
      sha: 5e217067
      intent_anchor: task-003
  coordinator:
    base: ed36109b18cb5ac871af518c321e9472ff9b5cd3
    integration_head: 16b4e342130b66c5468b0e63591b86f97206a6c7
    integration_branch: feat/069-005-workflow-prompt-runtime-contract
    revision: r4
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/005/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/005/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/005/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/005/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: 9f4966ebccc2c9a1864b0c18cace18f11652d92f
        branch: bouncer/069-005-001
        scope_revision: null
        paths: []
        actual_paths:
          - CLAUDE.md
          - docs/workflow-contract.md
          - rules/plugin-root.md
          - test/master-rules.test.js
      - id: '002'
        status: integrated
        sha: 031a52b0806d2ef51da94217554c30defc0708e7
        branch: bouncer/069-005-002
        scope_revision: r2
        paths:
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-commit.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
          - test/skill-debugging.test.js
        actual_paths:
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-debugging.test.js
      - id: '003'
        status: integrated
        sha: 5e2170678f404f3390923723bc72c462c8d502a6
        branch: bouncer/069-005-003
        scope_revision: r4
        paths:
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/verification-recovery.md
          - skills/bouncer-plan/references/context-review.md
          - rules/subagent-model.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/index.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - test/subagents.test.js
          - test/skill-debugging.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/assets/reviewer-prompt.md
          - references/review/index.md
          - rules/subagent-model.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/verification-recovery.md
          - skills/bouncer-plan/references/context-review.md
          - test/agents.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-debugging.test.js
          - test/subagents.test.js
    decisions:
      - task: '001'
        decision: 'accepted: implementer changed CLAUDE.md, rules/plugin-root.md, docs/workflow-contract.md, and test/master-rules.test.js within approved scope; reviewer found none; npm run ci passed; commit gate passed.'
      - task: '002'
        kind: scope
        reason: CI exposed an omitted regression test that directly asserts the bouncer-run recovery wording TASKS-002 intentionally removes; add the test so the canonical execute/debugging ownership remains covered without restoring duplicated run policy.
        previous:
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-commit.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
        next:
          - test/skill-debugging.test.js
        revision: r1
      - task: '002'
        kind: scope
        reason: 'Correct r1 scope representation: coordinate revise replaces the task scope, so preserve all original TASKS-002 paths while adding the debugger regression test diagnosed by CI.'
        previous:
          - test/skill-debugging.test.js
        next:
          - skills/bouncer-init/SKILL.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-run/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - test/skill-bouncer-init.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-commit.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
          - test/skill-debugging.test.js
        revision: r2
      - task: '002'
        decision: 'accepted r2: scope preserves all original TASKS-002 paths and adds test/skill-debugging.test.js; debugger identified obsolete duplicate-cap assertion, delta certification accepted its removal; npm run ci passed after dependencies installed and scaffold review guidance was cleared.'
      - task: '003'
        kind: scope
        reason: Review found required fallback-parity coverage and debugger recovery contract paths omitted from TASKS-003; retain all original scope while adding the test and verification-recovery reference so role authority/output parity is complete.
        previous:
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - skills/bouncer-execute/references/agent-dispatch.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/index.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - test/subagents.test.js
        next:
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/verification-recovery.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/index.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - test/subagents.test.js
          - test/skill-debugging.test.js
        revision: r3
      - task: '003'
        kind: critical-recovery
        used: 1
        findings:
          - TASKS-003-FALLBACK-PARITY
        reason: 'Delta certification proved a false acceptance risk: generic fallback paths for context-reviewer and reviewer do not demonstrate delivery of the complete role authority/guards/procedure/output contract. One scoped critical recovery will make dispatch references and regression coverage explicit without changing role interfaces.'
        outcome: null
      - task: '003'
        kind: critical-recovery
        used: 1
        findings:
          - TASKS-003-FALLBACK-PARITY
        reason: 'Critical recovery certification found TASKS-003-FALLBACK-PARITY still unresolved as a blocker: live generic/inline dispatcher payloads do not carry the complete role body. A second dispatch is prohibited after the task''s one critical recovery.'
        outcome: blocked
      - task: '003'
        kind: scope
        reason: 'User-directed r4 plan revision on 2026-09-15 after critical recovery for TASKS-003-FALLBACK-PARITY ended blocked. Root cause: the live fallback dispatcher instructions (skills/bouncer-plan/references/context-review.md ''same brief'', references/review/index.md step 3 ''same prompt'', skills/bouncer-execute/references/verification-recovery.md inline/generic debugger, rules/subagent-model.md item 4 ''same role brief'') never required the full agents/bouncer-<role>.md body plus controller inputs in the fallback payload, and self-declared ''Fallback parity'' sections inside agent docs do not prove payload delivery. r4 moves the fallback payload contract into the five live dispatcher sites and aligns test coverage (adds skills/bouncer-plan/references/context-review.md, rules/subagent-model.md, test/skill-bouncer-plan.test.js, test/skill-bouncer-execute.test.js) to the same five roles.'
        previous:
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/verification-recovery.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/index.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - test/subagents.test.js
          - test/skill-debugging.test.js
        next:
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/verification-recovery.md
          - skills/bouncer-plan/references/context-review.md
          - rules/subagent-model.md
          - references/context-review/index.md
          - references/debugging/index.md
          - references/review/index.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - test/subagents.test.js
          - test/skill-debugging.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-execute.test.js
        revision: r4
      - task: '003'
        decision: 'accepted TASKS-003 r4 (user override): on 2026-09-15 the user overrode the blocked critical-recovery outcome for TASKS-003-FALLBACK-PARITY by directing the r4 plan revision; r4 was driven as ordinary rework from the revised brief with a fresh review cycle (one discovery wave, one fix batch, one delta certification; terminal blocked if a blocker/major survived delta). Workers: bouncer-implementer (r4 implementation), 3x bouncer-reviewer discovery (spec_scope, correctness_tests, minimality_maintainability: 15 findings, 3 duplicates merged), bouncer-implementer fix batch (8 must_fix: R4-CT-001/002, R4-SS-1 major; R4-CT-003/004, R4-SS-3, R4-MM-01/02 minor), 1x bouncer-reviewer delta (8 resolved, 0 new, 0 regressed; 7 advisory accepted with notes). Fan-in decision: a read-only merge preflight showed the bf91ddb-based task would conflict with integrated TASKS-002 in test/skill-debugging.test.js (same cap-test sources array), so after discovery the coordinator fast-forwarded worker branch bouncer/069-005-003 from bf91ddb to integration head 39ef78f (ff-only, no worktree create/reset/delete) and resolved the test: cap sources = execute bundle + references/debugging/index.md, debugger brief must not carry the cap, run must not restate it; delta certified this against the brief. npm run ci exit 0 (1415/1415); execute gate passed; commit gate passed. Worker SHA 5e2170678f404f3390923723bc72c462c8d502a6 (parent 39ef78f). Actual paths: .codex/agents/bouncer-{context-reviewer,coordinator,debugger,implementer,reviewer}.toml, agents/bouncer-{context-reviewer,coordinator,debugger,implementer,reviewer}.md, references/context-review/index.md, references/debugging/index.md, references/review/assets/reviewer-prompt.md, references/review/index.md, rules/subagent-model.md, skills/bouncer-execute/references/agent-dispatch.md, skills/bouncer-execute/references/verification-recovery.md, skills/bouncer-plan/references/context-review.md, test/agents.test.js, test/skill-bouncer-execute.test.js, test/skill-bouncer-plan.test.js, test/skill-debugging.test.js, test/subagents.test.js.'
---
# Explain

## Background

여섯 진입 skill과 다섯 agent brief는 CLI와 공통 규칙이 이미 판정하는 상태, 한도, 실패 code를 본문에서 되풀이했다. 진입할 때마다 `governance.md`와 `okf.md`까지 미리 읽어서 기본 context도 컸다. 이 blueprint는 공통 계약을 `CLAUDE.md` 한 곳에 모으고, 상세 규칙은 필요한 단계에서만 열게 바꿨다. 사용자 명령, gate, ACQ 위치, 상태 전이는 그대로 뒀다.

드라이브 중 TASKS-003이 한 번 막혔다. named agent를 쓸 수 없는 host에서 context-reviewer와 reviewer의 generic·inline fallback이 역할 문서 전체를 받는다는 보장이 없었다. 첫 수정은 각 agent 문서에 "Fallback parity" 절을 넣었다. 그러나 dispatcher가 문서를 보내지 않으면 그 절도 읽히지 않으므로 증명이 되지 못했고, 한 번뿐인 critical recovery 뒤에도 blocker로 남았다. 사용자 지시로 브리프를 r4로 개정해 payload 계약을 dispatcher 지시문 다섯 곳으로 옮겼고, 새 리뷰 한 사이클을 거쳐 통과했다.

## Intuition

공통 헌법은 한 장으로 줄이고 세부 조례는 해당 절차에서만 펼친다. 대리인을 보낼 때는 "같은 사람처럼 하라"는 쪽지 대신 직무 기술서 원본을 통째로 쥐여 보낸다.

## Code

- `CLAUDE.md` — hard rule 3(명시적 사용자 승인)과 4(실제 write cwd)를 추가했다. 기본 runtime 계약은 이 파일 하나다.
- `rules/plugin-root.md` — product rule을 미리 읽지 않고, 그 규칙이 필요한 번호 단계에서 연다.
- `skills/bouncer-*/SKILL.md` — Master rules 적재를 `CLAUDE.md`로 줄이고 CLI payload가 이미 가진 상태·한도 재서술을 뺐다. 번호 단계와 ACQ는 같다.
- `agents/bouncer-*.md`, `.codex/agents/bouncer-*.toml` — Authority → Hard guards → 절차·rubric → Output contract로 줄였다. TOML은 `mdToCodexToml()` 결과와 바이트 단위로 같다. debugger TOML이 새로 생겼다.
- `rules/subagent-model.md` 4·5항 — "same role brief"를 역할 문서 본문 전체와 그 호출의 controller 입력(실제 cwd 포함)으로 정의한다. 역할 이름이나 요약만 담은 payload는 fallback이 아니다.
- fallback dispatcher 다섯 곳 — `skills/bouncer-plan/references/context-review.md`, `references/review/index.md` step 3, `skills/bouncer-execute/references/verification-recovery.md`, `skills/bouncer-execute/references/agent-dispatch.md`(implementer·reviewer), `rules/subagent-model.md` 5항(coordinator).
- `test/subagents.test.js`, `test/skill-bouncer-plan.test.js`, `test/skill-bouncer-execute.test.js`, `test/skill-debugging.test.js` — 다섯 역할의 dispatcher 지시문이 역할 문서 전체와 역할별 입력을 명시하는지 검사한다.

드라이브 기록:

- TASKS-003 scope는 r1–r3를 거쳐 r4(23개 경로)가 됐다. r4는 사용자 지시에 따른 개정이며 사유는 ledger에 있다.
- 003 worker branch는 002를 포함하지 않은 bf91ddb에서 출발했다. 두 task가 `test/skill-debugging.test.js`의 같은 배열을 반대 의미로 고쳐, coordinator가 branch를 integration head `39ef78f`로 수동 fast-forward하고 충돌을 풀었다. 이 조치는 `bouncer coordinate` 밖에서 이뤄졌고 결정 로그에 남아 있다.
- 커밋: 001 `bf91ddb`, 002 `39ef78f`, 003 `16b4e34`(worker `5e217067`). integration head `16b4e34`에서 `npm run ci` 1415/1415가 통과했다.

## Quiz

1. 이번 변경 뒤 진입 workflow가 번호 단계 전에 기본으로 읽는 규칙은?
   - A) `CLAUDE.md`, `rules/governance.md`, `rules/okf.md` 셋 모두
   - B) `CLAUDE.md` 하나이고 product rule은 필요한 단계에서 연다
   - C) `rules/plugin-root.md`가 모든 rule을 미리 읽어 둔다
2. `CLAUDE.md`에 새로 들어간 hard rule 두 개는?
   - A) 명시적 사용자 승인, 실제 write cwd
   - B) 토큰 예산 상한, 병렬 dispatch 수 제한
   - C) PR 자동 생성 금지, pointer 자동 이동 금지
3. named agent를 쓸 수 없을 때 generic fallback payload에 반드시 들어가야 하는 것은?
   - A) 역할 이름과 "same brief" 표기
   - B) 역할 요약과 task brief
   - C) `agents/bouncer-<role>.md` 본문 전체와 그 호출의 controller 입력·실제 cwd
4. named dispatch에서는 역할 문서 본문을 payload에 싣는가?
   - A) 싣는다. fallback과 똑같다
   - B) 싣지 않는다. named agent가 역할 파일을 이미 읽으므로 호출 입력만 넘긴다
   - C) Codex host에서만 싣는다
5. TASKS-003의 critical recovery가 blocked로 끝난 근본 원인과 r4의 해결은?
   - A) agent 문서의 자기 선언 절은 dispatcher가 문서를 보내야만 읽힌다. 그래서 payload 계약을 dispatcher 지시문으로 옮기고 테스트도 그 지시문을 검사한다
   - B) TOML 변환기 버그라서 `codex-agents.ts`를 고쳤다
   - C) reviewer가 read-only를 어겨서 reviewer 권한을 줄였다
6. 002와 003이 `test/skill-debugging.test.js`에서 부딪친 fan-in은 어떻게 풀렸나?
   - A) `coordinate integrate`가 3-way merge로 자동 해소했다
   - B) coordinator가 003 worker branch를 integration head로 fast-forward하고 테스트를 해소한 뒤 cherry-pick이 깨끗이 적용됐다
   - C) 002 커밋을 되돌렸다

## 이해 상태

정답은 1B, 2A, 3C, 4B, 5A, 6B다. 응답은 1B, 2A, 3C, 4B, 5A, 6B로 여섯 문항 모두 맞았다(`quiz_score` 6/6). 2번 응답은 `1a`로 적혀 있어 순서에 따라 2번 답으로 읽었다. 공통 계약 축약, fallback payload 계약, r4 개정과 fan-in 처리를 이해한 것으로 기록한다.

## Tasks

### Task 001

#### Goal & intent

`CLAUDE.md`와 plugin-root 계약이 trust boundary, gate 우선, 사용자 승인, 실제 write cwd만 기본 runtime authority로 제공하게 한다. 이 task의 구조 테스트는 네 경계와 plugin-root 적재 원칙만 판정하며, 여섯 entry skill의 적용 여부는 TASKS-002가 검증한다.

#### Interface

- 제공: 모든 workflow가 한 번 읽는 runtime contract와 상세 rule을 필요 분기에서만 여는 적재 규칙을 제공한다.
- 거부: product schema, enum, 실패 code와 단계별 복구 절차를 runtime contract에 복사하거나 기존 상세 rule을 삭제하지 않는다.

#### Do not touch

- `rules/governance.md` — coordinator, lightweight cycle과 task DAG 상세 의미는 유지한다.
- `rules/okf.md` — 문서 schema와 authoring 의미는 후속 workflow가 필요할 때 읽는다.
- `rules/current-pointer.md` — pointer confirm-then-set 계약을 바꾸지 않는다.
- `rules/output.md` — compact/debug 렌더링 계약을 바꾸지 않는다.

### Task 002

#### Goal & intent

여섯 entry `SKILL.md`에서 공통 runtime contract와 CLI payload가 이미 소유하는 상태·enum·기본값·한도·실패 code의 재서술을 제거한다. 기존 번호 단계, ACQ 위치, gate 호출, scope 확인과 compact 결과는 구조 테스트가 같은 순서로 관측해야 한다.

#### Interface

- 제공: `/bouncer-init`, `/bouncer-plan`, `/bouncer-execute`, `/bouncer-commit`, `/bouncer-run`, `/bouncer-finalize`의 기존 공개 절차와 결과를 더 짧은 entry 문서로 제공한다.
- 거부: CLI payload를 agent가 재계산하거나, 알려지지 않은 상태를 임의 fallback으로 바꾸거나, 조건부 reference를 번호 단계 앞에서 읽지 않는다.

#### Do not touch

- `scripts/` — 현재 CLI payload와 validator 동작을 바꾸지 않는다.
- `rules/governance.md` — 상세 product 계약은 삭제하거나 축약하지 않는다.
- `rules/okf.md` — 문서 schema와 gate 입력 의미를 유지한다.
- `agents/` — agent brief 축약은 TASKS-003이 소유한다.

### Task 003

#### Goal & intent

`bouncer-context-reviewer`, coordinator, debugger, implementer, reviewer brief를 역할, authority input, write boundary, procedure와 output schema 중심으로 줄인다. Markdown 정본, generated Codex TOML, named dispatch와 fallback이 같은 권한과 금지 경계를 전달해야 한다. 특히 named agent를 쓸 수 없을 때 실제로 실행되는 generic·inline fallback 지시문이 역할 문서 전체와 controller 입력을 payload로 넘기게 해, 축약된 역할로 판정이 통과하는 false acceptance를 막는다.

#### Interface

- 제공: 다섯 역할마다 `Authority → Hard guards → role procedure/rubric → Output contract`의 짧은 실행 brief와 byte-for-byte generated TOML, 그리고 다섯 live fallback 지시문이 역할 문서 전체와 역할별 controller 입력을 전달하는 dispatch 계약을 제공한다.
- 거부: worker가 status, scope, pointer나 coordinator ledger를 임의 변경하거나, main checkout을 write cwd로 사용하거나, 다른 역할의 판정을 대신하지 못하게 한다. 역할 이름·"same brief"·"same prompt" 같은 요약만으로 fallback payload를 구성하는 것을 거부한다.

#### Do not touch

- `scripts/src/lib/codex-agents.ts` — 기존 Markdown→TOML 변환 방식을 그대로 사용한다.
- `scripts/src/lib/coordinator.ts` — DAG, retry, repair와 terminal outcome 계산을 바꾸지 않는다.
- `scripts/src/lib/validate-gates.ts` — review와 context-review gate 판정을 바꾸지 않는다.
- `rules/governance.md` — coordinator와 lightweight 상세 계약을 유지한다.
- `skills/bouncer-run/SKILL.md` — TASKS-002가 integrated한 coordinator fallback 문구를 유지한다. coordinator fallback의 정본은 subagent-model 규칙 5항이다.