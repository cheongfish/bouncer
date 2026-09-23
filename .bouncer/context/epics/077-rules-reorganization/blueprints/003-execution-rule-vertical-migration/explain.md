---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-23T09:35:00.000+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '077'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 3bb8f7e5a44ce6f7ae735495ce96325d739b1633
      diff_sha: c8a910948d67a2e464e747ed9e634065174555c0a7b87cff54d4c1973d492b4c
      quiz_score: 3/3
      disposition: 통과
      recorded_at: '2026-09-23T09:36:00+09:00'
  task_commits:
    - task: EPIC-077/BP-003/TASK-001
      sha: 63e8bb34
      intent_anchor: task-001
    - task: EPIC-077/BP-003/TASK-002
      sha: 69e740d3
      intent_anchor: task-002
    - task: EPIC-077/BP-003/TASK-003
      sha: 5e77b595
      intent_anchor: task-003
  coordinator:
    base: 0c2a0e82bb67e734d5214202a8d8af82f4d47c8b
    integration_head: 3bb8f7e5a44ce6f7ae735495ce96325d739b1633
    integration_branch: refactor/077-003-execution-rule-vertical-migration
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/003/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/003/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/003/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/003/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: 63e8bb34d9145539ea211ab4cf00cd175618a4c5
        branch: bouncer/077-003-001
        scope_revision: null
        paths: []
        actual_paths:
          - AGENTS.md
          - docs/architecture/rule-ownership.md
          - rules/commit-scope.md
          - rules/governance.md
          - rules/planning.md
          - skills/bouncer-commit/SKILL.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-finalize/SKILL.md
          - test/master-rules.test.js
          - test/rule-ownership.test.js
          - test/skill-bouncer-commit.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-finalize.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
      - id: '002'
        status: integrated
        sha: 69e740d308ab1e99161acb7e7bc457509b0c8428
        branch: bouncer/077-003-002
        scope_revision: r1
        paths:
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - skills/bouncer-run/SKILL.md
          - rules/governance.md
          - docs/architecture/rule-ownership.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - test/master-rules.test.js
          - test/workflow-safety-canon.test.js
          - test/rule-ownership.test.js
          - test/skill-output-contract.test.js
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/architecture/rule-ownership.md
          - rules/governance.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-run.test.js
          - test/workflow-safety-canon.test.js
      - id: '003'
        status: integrated
        sha: 5e77b595929539b809a8efafc29e5b6031049b1a
        branch: bouncer/077-003-003
        scope_revision: null
        paths: []
        actual_paths:
          - docs/architecture/rule-ownership.md
          - rules/governance.md
          - rules/planning.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-finalize/references/explain-quiz.md
          - test/lightweight-cycle.test.js
          - test/rule-ownership.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-finalize.test.js
          - test/workflow-safety-canon.test.js
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 9cf461dc657005b52f27904d41fc5e85f751705a2864cc9ec77a3c274da143df
        base_head: 0c2a0e82bb67e734d5214202a8d8af82f4d47c8b
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 9cf461dc657005b52f27904d41fc5e85f751705a2864cc9ec77a3c274da143df
        outcome: rework
        summary: 'discovery review(parallel, spec_scope·correctness_tests·minimality) 3건 must_fix: (1) governance ## Coordinator mode에 coordinator topology 문장이 commit-scope와 중복 잔존(SPEC-001/MM-001), (2) master-rules 특성화가 refusal polarity를 고정하지 않아 .bouncer/·absolute scope 허용과 main-worktree/stale-revision commit 승인 변형이 139/139 green으로 통과(CT-001), (3) rule-ownership.md의 planning locator 줄 범위 off-by-one과 참조 대조 표가 선언한 rg 입력보다 누락·오번호(SPEC-002/SPEC-003/MM-002). nit 3건(MM-004/005/006)과 CT-002 미고정 consumer 인용을 같은 fix batch에 포함한다. 범위 변경 없음 — 전부 affected_paths 안.'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: 9cf461dc657005b52f27904d41fc5e85f751705a2864cc9ec77a3c274da143df
        base_head: 0c2a0e82bb67e734d5214202a8d8af82f4d47c8b
        initial_worktree_state: |
          M  AGENTS.md
          M  docs/architecture/rule-ownership.md
          A  rules/commit-scope.md
          M  rules/governance.md
          M  rules/planning.md
          M  skills/bouncer-commit/SKILL.md
          M  skills/bouncer-execute/SKILL.md
          M  skills/bouncer-finalize/SKILL.md
          M  test/master-rules.test.js
          M  test/rule-ownership.test.js
          M  test/skill-bouncer-commit.test.js
          M  test/skill-bouncer-execute.test.js
          M  test/skill-bouncer-finalize.test.js
          M  test/skill-bouncer-surface.test.js
          M  test/workflow-safety-canon.test.js
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '001'
        kind: critical-recovery
        used: 1
        findings:
          - CT-003
        reason: 'delta certification의 major·missed_critical: brief Target behavior의 세 번째 실패 조건(G17을 coordinator authorization으로 서술하면 실패)이 어떤 테스트로도 고정되지 않았다. rules/commit-scope.md:65-67의 ''not as coordinator authorization''을 ''full coordinator authorization''으로 뒤집어도 focused 139/139, 전체 1458/1458 green이라 false acceptance 경로가 실증됐다. task intent 유지, 새 제품 결정·의존성·공개 인터페이스 없음, 수정 범위는 affected_paths 안의 test/master-rules.test.js 인접 assertion 추가 하나다.'
        outcome: null
      - task: '001'
        kind: critical-recovery
        used: 1
        findings:
          - CT-003
        reason: 'CT-003 검증: test/master-rules.test.js에 G17의 not as coordinator authorization 잠금 assertion을 추가하여 false acceptance 경로가 차단됨을 확인하고 전체 테스트 통과'
        outcome: resolved
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: 9cf461dc657005b52f27904d41fc5e85f751705a2864cc9ec77a3c274da143df
        outcome: accepted
        summary: CT-003 critical-recovery 완료 및 CI 전체 검증 통과(G17 not as coordinator authorization 잠금 확인)
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: fe6261dc49ee4da0d21ece623ba88c7ec94c4ab91790bdbcc419bcfbe8c44a20
        base_head: 63e8bb34d9145539ea211ab4cf00cd175618a4c5
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: fe6261dc49ee4da0d21ece623ba88c7ec94c4ab91790bdbcc419bcfbe8c44a20
        outcome: accepted
        summary: task 001 implemented, verified, reviewed, and committed on worker branch
      - task: '001'
        decision: 'task 001 committed: AGENTS.md, docs/architecture/rule-ownership.md, rules/commit-scope.md, rules/governance.md, rules/planning.md, skills/bouncer-commit/SKILL.md, skills/bouncer-execute/SKILL.md, skills/bouncer-finalize/SKILL.md, test/master-rules.test.js, test/rule-ownership.test.js, test/skill-bouncer-commit.test.js, test/skill-bouncer-execute.test.js, test/skill-bouncer-finalize.test.js, test/skill-bouncer-surface.test.js, test/workflow-safety-canon.test.js'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 7365d9eb1d686a203661348024b3baf7cb4fb98dfc6b8f538591ab8deb1668fb
        base_head: b107d62e8e7bec406a6bc9f5e74edc06d8ae70ba
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 7365d9eb1d686a203661348024b3baf7cb4fb98dfc6b8f538591ab8deb1668fb
        outcome: scope_revision
        summary: Include generated .codex/agents/bouncer-coordinator.toml matching agents/bouncer-coordinator.md
      - task: '002'
        kind: scope
        reason: Include generated .codex/agents/bouncer-coordinator.toml matching agents/bouncer-coordinator.md per test/agents.test.js requirement
        previous:
          - agents/bouncer-coordinator.md
          - skills/bouncer-run/SKILL.md
          - rules/governance.md
          - docs/architecture/rule-ownership.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - test/master-rules.test.js
          - test/workflow-safety-canon.test.js
          - test/rule-ownership.test.js
          - test/skill-output-contract.test.js
        next:
          - agents/bouncer-coordinator.md
          - .codex/agents/bouncer-coordinator.toml
          - skills/bouncer-run/SKILL.md
          - rules/governance.md
          - docs/architecture/rule-ownership.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - test/master-rules.test.js
          - test/workflow-safety-canon.test.js
          - test/rule-ownership.test.js
          - test/skill-output-contract.test.js
        revision: r1
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 8ffa0b1bbbe0fa1da3c0a6bd1a78d9ac1332396953b2ee098b75bdd2a5766d65
        base_head: b107d62e8e7bec406a6bc9f5e74edc06d8ae70ba
        initial_worktree_state: |2
           M .codex/agents/bouncer-coordinator.toml
           M agents/bouncer-coordinator.md
           M docs/architecture/rule-ownership.md
           M rules/governance.md
           M skills/bouncer-run/SKILL.md
           M test/agents.test.js
           M test/master-rules.test.js
           M test/skill-bouncer-run.test.js
           M test/workflow-safety-canon.test.js
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 8ffa0b1bbbe0fa1da3c0a6bd1a78d9ac1332396953b2ee098b75bdd2a5766d65
        outcome: accepted
        summary: task 002 implemented, verified, reviewed, and committed on worker branch
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: f899cae31452592761fe4449ff84d35928cf33c041217a1c97c7b800b4296ec0
        base_head: 69e740d308ab1e99161acb7e7bc457509b0c8428
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: f899cae31452592761fe4449ff84d35928cf33c041217a1c97c7b800b4296ec0
        outcome: accepted
        summary: task 002 implemented, verified, reviewed, and committed on worker branch
      - task: '002'
        decision: 'task 002 committed: .codex/agents/bouncer-coordinator.toml, agents/bouncer-coordinator.md, docs/architecture/rule-ownership.md, rules/governance.md, skills/bouncer-run/SKILL.md, test/agents.test.js, test/master-rules.test.js, test/skill-bouncer-run.test.js, test/workflow-safety-canon.test.js'
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: c4baacb900e4d074780b0db507f7b49dc5c7b5fab4c8c22dd4df55a83fcdf1c2
        base_head: d7ddada393085ea2835b23868caea5aa47e4c306
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: c4baacb900e4d074780b0db507f7b49dc5c7b5fab4c8c22dd4df55a83fcdf1c2
        outcome: accepted
        summary: Migrated lightweight execution rules to agent-dispatch and explain-quiz, preserving scale implementation notes in governance and updating BP3 ownership graph
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: 60d75b1f59b22b13499a10aa86b4e93c6d6060513e8d2a2f7023297e10997287
        base_head: 5e77b595929539b809a8efafc29e5b6031049b1a
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: 60d75b1f59b22b13499a10aa86b4e93c6d6060513e8d2a2f7023297e10997287
        outcome: accepted
        summary: task 003 implemented, verified, reviewed, and committed on worker branch
      - task: '003'
        decision: 'task 003 committed: docs/architecture/rule-ownership.md, rules/governance.md, rules/planning.md, skills/bouncer-execute/SKILL.md, skills/bouncer-execute/references/agent-dispatch.md, skills/bouncer-finalize/references/explain-quiz.md, test/lightweight-cycle.test.js, test/rule-ownership.test.js, test/skill-bouncer-execute.test.js, test/skill-bouncer-finalize.test.js, test/workflow-safety-canon.test.js'
---
# Explain

## Background
기존 `rules/governance.md`에 결합되어 있던 커밋 격리, 실제 작업트리 경로, 코디네이터 구동, 경량 실행 인라인 분기 및 종결 규범들을 실제 소비 주체인 전용 규칙 파일과 스킬 참조 문서로 수직 이전했습니다. 이를 통해 불필요한 횡단 규칙 적재를 제거하고 `docs/architecture/rule-ownership.md`의 BP3 대상 행 마이그레이션을 완결했습니다.

## Intuition
실행 규칙의 소유권을 실제 실행 주체에게 직접 이전하여, 워크플로가 거대한 거버넌스 문서를 거치지 않고 자신의 정본 참조 문서만으로 완전하게 동작하도록 만들었습니다.

## Code
- `rules/commit-scope.md`: 커밋 격리, 실제 작업트리 경로 및 코디네이터 경계 정본
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`: 코디네이터 단일 컨트롤러 자율 실행 규범
- `skills/bouncer-run/SKILL.md`: `/bouncer-run`의 코디네이터 위임 경계
- `skills/bouncer-execute/references/agent-dispatch.md`: `scale: light` 인라인 구현 및 named dispatch 계약
- `skills/bouncer-finalize/references/explain-quiz.md`: canonical context 경계 및 퀴즈 위임
- `rules/governance.md`: 이전 완료된 문장을 제거하고 BP4 잔여 scale 구현 메모만 보존
- `docs/architecture/rule-ownership.md`: load graph에서 governance 참조 제거 및 정본 대조 표 갱신

## Quiz
1. 커밋 격리 및 실제 작업트리 경로를 통제하는 정본 규칙 문서는 무엇인가요?
   - A) `rules/planning.md`
   - B) `rules/commit-scope.md`
   - C) `rules/governance.md`

2. `/bouncer-run`과 `bouncer-coordinator` 사이의 권한 경계로 올바른 설명은 무엇인가요?
   - A) run이 코드 수정을 직접 수행하고 coordinator는 결과만 검증한다
   - B) coordinator는 매 태스크 경계마다 사용자 승인(ACQ)을 다시 열어야 한다
   - C) run은 최초 ACQ 승인 후 실행을 위임하며, coordinator가 블루프린트 완료까지 단일 컨트롤러로 판정과 재작업을 주도한다

3. `scale: light` 작업에서 implementer 디스패치 계약은 어떻게 변경되었나요?
   - A) named-agent 디스패치 대신 현재 세션에서 인라인으로 실행된다
   - B) implementer 실행을 완전히 건너뛰고 바로 reviewer를 디스패치한다
   - C) `rules/governance.md`를 필수로 사전 적재한 후 named-agent로 디스패치한다

## 이해 상태
- 문항 수: 3문항 (diff 변경 규모 반영)
- 정답: 1번 B, 2번 C, 3번 A
- 사용자 응답: 1번 B, 2번 C, 3번 A (3/3 정답)
- 결과: 통과 (disposition: 통과)

## Tasks

### Task 001

#### Goal & intent

task commit 단위, staging, 승인 scope와 coordinator ledger scope, G17·CLI·hook의 강제력 차이를 공유 실행 정본 하나로 옮긴다. `execute`, `commit`, `finalize`가 필요한 단계에서만 이 정본을 읽고 공개 명령과 상태 전이는 그대로인 것이 완료 조건이다.

#### Current behavior

- `rules/governance.md:3-25`가 verification node 실패 전이, task commit 단위, task/finalize staging과 explain stamp를 함께 소유한다.
- `rules/governance.md:65-126`가 approved scope를 initial estimate로 바꾸는 coordinator 경계, source path 제한, ledger scope audit, main checkout read-only, G17의 상대적 강도와 ledger 없는 흐름을 소유한다.
- `skills/bouncer-execute/SKILL.md:95-102`, `skills/bouncer-commit/SKILL.md:32-35`, `skills/bouncer-finalize/SKILL.md:42-51`는 worktree·scope 판단 하나 때문에 `rules/governance.md` 전체를 연다.
- `test/master-rules.test.js:728-768`과 `test/workflow-safety-canon.test.js:143-155`는 의미와 함께 옛 파일 위치를 직접 고정한다. 재현 명령은 다음과 같다.

```bash
node --test test/master-rules.test.js test/workflow-safety-canon.test.js test/skill-bouncer-commit.test.js test/skill-bouncer-execute.test.js test/skill-bouncer-finalize.test.js test/skill-bouncer-surface.test.js test/rule-ownership.test.js
```
- 이 task는 runtime function, process spawn과 module state를 바꾸지 않는다. 관측 대상 file I/O는 위 테스트의 `read(...)`가 정본 Markdown을 여는 지점이다.

#### Target behavior

- 성공: 새 공유 정본이 commit unit, candidate staging, explain stamp, approved/ledger scope, source-path boundary, assigned worktree와 G17/CLI/hook 계층을 한 문맥에서 정의한다. 세 workflow와 관련 characterization은 그 경로를 읽는다.
- 실패: absolute·escaping·whole-tree·`.git/`·`.bouncer/` scope를 허용하거나 ledger revision 불일치와 main-worktree commit을 승인하는 서술은 테스트가 거절한다. G17을 CLI·hook과 같은 coordinator authorization으로 서술해도 실패한다.
- 보존: ledger 없는 standalone 흐름은 승인 `affected_paths`를 그대로 사용한다. 공개 CLI argv, payload, gate code, staging 결과, commit stamp shape와 runtime 구현은 바뀌지 않는다.

#### Interface

- 제공: `rules/commit-scope.md`는 “승인 scope”를 plan에서 확정한 `affected_paths`, “ledger scope”를 coordinator가 현재 revision에 기록한 source path 집합으로 정의한다. task commit과 finalize remainder의 서로 다른 staging 책임, worker/integration/main checkout 경계, G17·`bouncer commit`·`commit-safety`의 판정 범위를 제공한다.
- 거부: 새 runtime 명령, schema, path ceiling, gate code 또는 자동 scope 확장을 계약에 추가하지 않는다. coordinator 전용 mutation 절차를 공유 정본에 복제하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | `Runtime rule index` | Modify | 조건부 제품 규칙 색인 | 새 commit-scope 정본을 추가하고 governance를 migration source·잔여 구현 설명으로 한정 | BP3 중간 상태와 BP4 직전 상태를 모두 정확히 설명해야 함 |
| `rules/commit-scope.md` | 신규 실행·commit scope 계약 | Create | 해당 없음 | commit unit, staging, approved/ledger scope와 enforcement 계층 소유 | 여러 실행 소비자가 같은 판단을 공유함 |
| `rules/governance.md` | `Blueprint sizing rule`, `Task DAG and approved scope`, `Coordinator mode` 일부 | Modify | BP3·BP4 실행 규범의 혼합 정본 | TASKS-001 소유 규범을 삭제하고 BP4 구현 설명과 후속 task 규범만 유지 | 중복 정본을 남기지 않기 위함 |
| `rules/planning.md` | verification failure·approved scope cross-reference | Modify | BP3 실행 규범의 옛 governance locator 인용 | 새 commit-scope 또는 coordinator owner를 인용 | 삭제한 locator를 다시 가리키지 않게 함 |
| `skills/bouncer-execute/SKILL.md` | `2. Prepare` | Modify | worktree 경계에서 governance 전체 적재 | 실제 판단 직전에 commit-scope 정본 적재 | execute의 write cwd 경계 소비자임 |
| `skills/bouncer-commit/SKILL.md` | `1. Current`, `5. Handoff` | Modify | controller/worktree·commit 규범 소비 | commit-scope와 CLI 결과의 책임을 분리해 참조 | commit scope의 직접 소비자임 |
| `skills/bouncer-finalize/SKILL.md` | `2. Remainder` | Modify | integration worktree·remainder staging 소비 | commit-scope 정본과 finalize 로컬 절차를 구분 | task commit과 remainder 경계를 함께 검증함 |
| `docs/architecture/rule-ownership.md` | BP3 ownership rows, load graph, digest | Modify | BP2 이후 owner와 locator | TASKS-001 이전분의 current owner·consumer·locator 갱신 | ownership 검사의 선언 입력임 |
| `test/master-rules.test.js` | coordinator scope canonical tests | Modify | governance 경로의 scope 의미 고정 | commit-scope 정본에서 같은 의미와 단일 소유권 검증 | G17·dynamic scope 회귀를 잡는 핵심 검사임 |
| `test/workflow-safety-canon.test.js` | row 4 actual cwd | Modify | governance와 네 workflow 인용 검사 | 새 정본과 실제 소비자 인용 검사 | main checkout read-only 경계를 보존함 |
| `test/skill-bouncer-commit.test.js` | governance citation assertions | Modify | commit의 옛 정본 참조 검사 | commit-scope·CLI 책임 분리 검사 | operational recovery 경로를 고정함 |
| `test/skill-bouncer-execute.test.js` | prepare boundary assertions | Modify | execute의 governance 참조 검사 | assigned worktree와 새 정본의 단계별 적재 검사 | execute actual cwd 경계를 고정함 |
| `test/skill-bouncer-finalize.test.js` | remainder boundary assertions | Modify | finalize의 governance 참조 검사 | integration scope와 새 정본 인용 검사 | finalize가 미완료 drive를 닫지 않게 함 |
| `test/rule-ownership.test.js` | owner locator characterization | Modify | BP3가 governance에 남는다는 전제 | 부분 이전 뒤 current owner를 행별로 검증 | 중간 commit에서도 ownership drift를 거절해야 함 |
| `test/skill-bouncer-surface.test.js` | numbered-step product-rule preload list | Modify | 기존 product rule의 preamble 부재 검사 | 새 commit-scope rule도 번호 단계에서만 적재되는지 검사 | 조건부 적재 원칙의 누락을 막음 |

#### Constraints

- “상한 없음”은 repository source path 경계 안에서만 성립하고 absolute, escaping, whole-tree, `.git/`, `.bouncer/` 금지는 유지한다.
- G17은 task document만 보는 약한 계층이고 CLI와 hook이 ledger/worktree/revision을 강제한다는 상대적 강도를 유지한다.
- 새 규칙은 coordinator mutation 명령 순서나 lock 알고리즘을 복제하지 않는다.
- 테스트는 새 파일명 자체보다 ownership row가 가리키는 current owner를 우선해 검증한다.

### Task 002

#### Goal & intent

coordinator 전용 scope revision, worker dispatch, critical recovery, repair와 partial-close 절차를 `agents/bouncer-coordinator.md`에 완결하고 `/bouncer-run`은 시작 승인 후 한 번 위임해 결과만 렌더링하도록 정본 경계를 바꾼다.

#### Current behavior

- `agents/bouncer-coordinator.md:7-221`가 실제 명령 순서와 출력 payload를 소유하지만 source-path 상한, scope audit, repair와 partial-close 일부 의미를 `rules/governance.md`에 의존한다.
- `skills/bouncer-run/SKILL.md:100-136`는 coordinator 역할 문서와 `rules/governance.md`를 함께 열고 coordinator authority를 조합한다.
- `rules/governance.md:70-139`에는 coordinator 전용 권한·복구와 CLI lock·revision 구현 설명이 섞여 있다. BP4 소유 `nextRevision`, lock ownership, one-write-unit 설명은 이번 task에서 이동하지 않는다.
- `test/agents.test.js:382-407`과 `test/skill-bouncer-run.test.js:64-77`은 역할 의미를 검사하면서 governance 경로도 요구한다. 재현 명령은 다음과 같다.

```bash
node --test test/agents.test.js test/skill-bouncer-run.test.js test/master-rules.test.js test/workflow-safety-canon.test.js test/rule-ownership.test.js test/skill-output-contract.test.js
```
- runtime coordinator의 ledger file I/O와 Git process spawn은 `scripts/src/lib/coordinator.ts:775-1382`에 있으나 이 task는 해당 코드를 바꾸지 않는다.

#### Target behavior

- 성공: coordinator 역할 문서만으로 권한, pointer 소유, scope revision 경계, fenced mutation, critical recovery, 두 repair와 partial-close 중단을 판정할 수 있다. `run`은 `rules/cli.md`, pointer, subagent model과 output 정본만 읽어 한 번 dispatch한다.
- 실패: root run이 worker 절차를 재구성하거나 scope를 고치고, coordinator가 main checkout을 쓰거나 다른 coordinator를 중첩하고, repair/partial-close 동의를 자동 처리하면 characterization이 실패한다.
- 보존: `bouncer coordinate`가 계산하는 DAG·ready wave·repair ceiling, checkpoint ledger hash fence, worker report payload와 terminal outcome 필드는 그대로다. BP4 소유 lock 알고리즘 설명은 `rules/governance.md`에 남는다.

#### Interface

- 제공: `agents/bouncer-coordinator.md`가 coordinator만의 authority, hard guards, worker dispatch, procedure와 output contract를 단일 역할 brief로 제공한다. `skills/bouncer-run/SKILL.md`는 start ACQ, integration bootstrap, 정확히 한 번의 dispatch와 `rules/output.md` 렌더링만 소유한다.
- 거부: `run`이 `coordinate revise`, worker review, pointer task loop를 직접 수행하거나 coordinator가 사용자 동의를 대신하는 계약을 두지 않는다. BP4의 lock·원자성 구현 설명을 역할 절차로 옮기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `Authority`, `Hard guards`, `Procedure`, `Output contract` | Modify | coordinator 역할과 일부 governance 참조 | BP3 coordinator 전용 판단을 자체 완결하고 공유 commit-scope·CLI 정본만 인용 | delegated role이 실제 판정 주체임 |
| `.codex/agents/bouncer-coordinator.toml` | generated agent toml | Modify | coordinator toml mirror | agents/bouncer-coordinator.md 변경에 따른 toml 동기화 | test/agents.test.js의 mdToCodexToml 일치 검증 통과 |
| `skills/bouncer-run/SKILL.md` | `4. Coordinator dispatch`, `5. Report` | Modify | coordinator+governance 조합과 결과 렌더링 | 역할·CLI·pointer·dispatch·output 소유권만 조합 | root run은 단일 dispatcher여야 함 |
| `rules/governance.md` | `Coordinator mode` | Modify | coordinator 전용 절차와 BP4 구현 설명 혼합 | TASKS-002 소유 규범을 제거하고 BP4 locator만 보존 | 역할 중복 정본을 없애기 위함 |
| `docs/architecture/rule-ownership.md` | coordinator BP3 rows, load graph, digest | Modify | governance current owner와 소비자 | 역할·commit-scope·기존 pointer/output 정본으로 locator 전환 | ownership migration의 판정 입력임 |
| `test/agents.test.js` | coordinator authority and drift tests | Modify | 역할 본문과 governance 분산 의미 검사 | 역할 자체 완결성과 금지 경계 검사 | coordinator 전용 계약의 직접 characterization임 |
| `test/skill-bouncer-run.test.js` | coordinator dispatch ownership test | Modify | run과 governance 동시 인용 요구 | run이 역할 절차를 복제하지 않고 새 정본만 조합하는지 검사 | root/coordinator 경계를 고정함 |
| `test/master-rules.test.js` | single-owner coordinator assertions | Modify | governance의 authority 정본 개수 검사 | 역할·commit-scope의 분리된 단일 소유권 검사 | 중복 권한 문장을 막음 |
| `test/workflow-safety-canon.test.js` | delegated drive boundary rows | Modify | governance section locator | coordinator 역할과 commit-scope locator로 전환 | main read-only·worker authority를 보존함 |
| `test/rule-ownership.test.js` | BP3 owner and load graph checks | Modify | BP3 governance 잔류 전제 | coordinator 행의 새 current owner와 소비자 검증 | 단계적 migration drift를 차단함 |
| `test/skill-output-contract.test.js` | coordinator terminal outcome assertions | Modify | shared output 필드 검사 | 역할 report와 output renderer의 경계가 유지되는지 검사 | partial-close를 성공으로 렌더링하지 않게 함 |

#### Constraints

- coordinator는 `bouncer coordinate` 반환값을 실행하고 DAG, ready wave, ceiling을 재계산하지 않는다.
- actual write cwd는 integration worktree와 할당 task worktree뿐이고 main checkout은 read-only provenance다.
- `partial_closed`는 명시적 사용자 확인 뒤에도 unresolved handoff이며 `completed`나 `closed`가 아니다.
- BP4 stable id의 current owner와 locator는 바꾸지 않는다.

### Task 003

#### Goal & intent

light inline implement와 drive named dispatch 예외, one-question quiz, canonical context와 inline self-review 한계를 직접 판단하는 execute/finalize reference로 옮긴다. BP3 ownership과 load graph가 최종 경로를 가리키고 `rules/governance.md`에는 BP4 구현 설명만 남는 것이 완료 조건이다.

#### Current behavior

- `rules/governance.md:28-56`은 planning에서 분리된 light 실행 규범과 scale read-site 구현 설명을 함께 둔다.
- `skills/bouncer-execute/SKILL.md:104-145`와 `skills/bouncer-execute/references/agent-dispatch.md`가 inline/named 실행을 판단하지만 self-review 한계 정본은 governance에 있다.
- `skills/bouncer-finalize/SKILL.md:35-87`, `skills/bouncer-finalize/references/explain-quiz.md`, `references/explain-diff/index.md`가 quiz와 finalize context를 실행하지만 one-question·canonical context 문장은 governance에 있다.
- `test/lightweight-cycle.test.js:29-46,132-148`과 `test/workflow-safety-canon.test.js:166-174`는 light 실행 의미와 옛 파일 위치를 함께 고정한다. 재현 명령은 다음과 같다.

```bash
node --test test/lightweight-cycle.test.js test/workflow-safety-canon.test.js test/skill-bouncer-execute.test.js test/skill-bouncer-finalize.test.js test/rule-ownership.test.js
```
- 이 task는 scaffold의 scale 판독 file I/O나 실행 module state를 바꾸지 않는다. `scripts/` read-site 설명은 BP4 owner로 governance에 남긴다.

#### Target behavior

- 성공: standalone light execute는 inline implement, drive는 named implement를 유지하고 host fallback과 혼동하지 않는다. `references/explain-diff/index.md`가 light quiz 한 문제를 계속 소유하며 finalize의 explain-quiz reference는 canonical context만 repository knowledge로 사용한다. 각 판단은 실행 직전 읽힌다.
- 실패: light 선언 없이 inline 경로를 택하거나 `/bouncer-run` coordinator가 implementer가 되고, fallback이 named 시도보다 먼저 실행되거나 quiz/context 계약이 사라지면 테스트가 실패한다.
- 보존: `bouncer.scale` 판독 위치, G10/G18, maintenance epic, review/debugger named dispatch, gate·CLI·schema 의미는 바뀌지 않는다. ownership map의 BP4 행은 governance current owner를 유지한다.

#### Interface

- 제공: execute agent-dispatch reference는 light standalone inline, drive named, unsupported-host fallback을 서로 배타적인 분기로 정의한다. 기존 `references/explain-diff/index.md`는 `scale: light` 한 문제를 소유하고 finalize explain/quiz reference는 canonical context 입력과 호출 절차를 소유한다.
- 거부: scale 추론, run의 inline implement, same-session review verdict, quiz 생략, Explain 외 repository memory 사용을 허용하지 않는다. BP4의 scale read-site 구현 설명은 실행 reference로 복제하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/governance.md` | `Lightweight cycle` | Modify | light 실행 규범과 BP4 구현 설명 혼합 | BP3 규범을 제거하고 scale read-site 설명만 유지 | BP3 중복 정본 제거 지점임 |
| `rules/planning.md` | light execution·quiz owner cross-reference | Modify | BP3 light 규범의 옛 governance locator 인용 | execute·finalize 직접 owner를 인용 | planning 정본에 stale 실행 참조를 남기지 않음 |
| `skills/bouncer-execute/SKILL.md` | `3. Implement` | Modify | light·drive 분기와 governance 참조 | agent-dispatch reference의 실행 정본을 판단 직전에 읽음 | inline/named 분기의 workflow 소유자임 |
| `skills/bouncer-execute/references/agent-dispatch.md` | light and fallback dispatch contract | Modify | named/fallback payload 계약 | light standalone·drive named·self-review 한계 통합 | implement dispatch 세부 판단의 기존 소유자임 |
| `skills/bouncer-finalize/SKILL.md` | `1. Explain + quiz`, `2. Remainder` | Modify | quiz·context 소비와 governance 참조 | explain-quiz와 commit-scope 정본만 단계별 적재 | finalize 판단 시점을 보존함 |
| `skills/bouncer-finalize/references/explain-quiz.md` | quiz sources and canonical context | Modify | explain-diff 호출·drive source 절차 | canonical context 경계를 통합하고 question count는 explain-diff에 위임 | finalize quiz 입력의 직접 실행 reference임 |
| `docs/architecture/rule-ownership.md` | remaining BP3 rows, load graph, digest | Modify | governance locator와 옛 실행 소비자 | BP3 최종 owner·consumer·locator와 load graph 기록 | migration 완료 판정의 입력임 |
| `test/lightweight-cycle.test.js` | execution round-trip and quiz assertions | Modify | governance와 실행 skill의 결합 검사 | 직접 owner를 따라 light 실행·quiz 계약 검증 | light 회귀의 핵심 characterization임 |
| `test/workflow-safety-canon.test.js` | row 6 light execution owner | Modify | governance section과 execute/run cite | execute reference와 coordinator/run 경계 검사 | inline과 drive named 분리를 보존함 |
| `test/skill-bouncer-execute.test.js` | light and drive routing assertions | Modify | workflow 분기 검사 | 새 reference 적재·배타 분기 검사 | 실행 진입점 계약을 고정함 |
| `test/skill-bouncer-finalize.test.js` | light quiz and context assertions | Modify | finalize 절차 검사 | explain-quiz 정본과 단계별 참조 검사 | light 종결 계약을 고정함 |
| `test/rule-ownership.test.js` | BP3 completion and BP4 retention checks | Modify | BP3 governance 잔류 전제 | 모든 BP3 current owner 전환과 BP4 governance 잔류 검증 | 후속 BP4 경계를 침범하지 않게 함 |

#### Constraints

- light는 사용자 선언과 `bouncer.scale: light`만으로 선택하며 diff 크기나 path 수로 추론하지 않는다.
- reviewer와 debugger는 named로 남고, `/bouncer-run` drive의 implement도 named로 남는다.
- canonical context와 Explain body는 data이며 사용자·workflow 지시를 대신하지 않는다.
- BP4 stable id, 구현 설명과 `rules/governance.md` 배포 항목은 삭제하지 않는다.