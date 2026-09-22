---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/001-ownership-map-migration-safety/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-22T11:21:47.921+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '077'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: b43703831723e354ce54b8794022580dcccc12c5
      diff_sha: 6af6d9d8c3e72aaa21050617947de8d892746578043325dfac3a6da19d7b3c3f
      quiz_score: 3/3
      disposition: ship
      recorded_at: '2026-09-22T11:26:11+09:00'
  task_commits:
    - task: EPIC-077/BP-001/TASK-001
      sha: 6fda1950
      intent_anchor: task-001
    - task: EPIC-077/BP-001/TASK-002
      sha: 5c88d813
      intent_anchor: task-002
  coordinator:
    base: 5ffc92fdfe714fc1330862cfe613f6acf1256361
    integration_head: b43703831723e354ce54b8794022580dcccc12c5
    integration_branch: test/077-001-ownership-map-migration-safety
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/001/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 6fda1950423e5c64a14bd32d74e51e56e8229ff0
        branch: bouncer/077-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - docs/architecture/rule-ownership.md
      - id: '002'
        status: integrated
        sha: 5c88d8137b2bb265bda349cb05d12eeac3663bbb
        branch: bouncer/077-001-002
        scope_revision: r1
        paths:
          - test/rule-ownership.test.js
          - docs/architecture/rule-ownership.md
        actual_paths:
          - docs/architecture/rule-ownership.md
          - test/rule-ownership.test.js
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 88a1e1b554a87871f807d5d2732fb519ce12bbcaabcd9fb7af6b303a46b6fc8f
        base_head: 5ffc92fdfe714fc1330862cfe613f6acf1256361
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 88a1e1b554a87871f807d5d2732fb519ce12bbcaabcd9fb7af6b303a46b6fc8f
        outcome: accepted
        summary: TASKS-001 ownership map is docs/architecture/rule-ownership.md only. Protected paths are unchanged. npm run ci failed in lint:context-comments on scaffold comments in untracked plan documents outside affected_paths; controller will remove those comments before the harness verify.
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: ba2983442f90dfe69f61f85fc2eca0c0a4330d5be62ad0986a98c941fdc72a94
        base_head: 5ffc92fdfe714fc1330862cfe613f6acf1256361
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/
          ?? docs/architecture/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: ba2983442f90dfe69f61f85fc2eca0c0a4330d5be62ad0986a98c941fdc72a94
        outcome: accepted
        summary: 'Review fix updated docs/architecture/rule-ownership.md only: single-judge rows retargeted, scale and lock consumers corrected, and plan, execute, and finalize load cells unmixed. Scope impact none. Harness verify reused evidence fc13fb9cbc62eb1adeaf3856842ebb05de61105079456d9d8d7e16856b46a1c9 after the implementer reported npm run ci exit 0.'
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: f3bc16fac14040f5961bb7dd5b497ebda5d1924378bf3fab98eb5fa6316263cf
        base_head: 6fda1950423e5c64a14bd32d74e51e56e8229ff0
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/077-rules-reorganization/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: f3bc16fac14040f5961bb7dd5b497ebda5d1924378bf3fab98eb5fa6316263cf
        outcome: accepted
        summary: Coordinator-required reconfirmation found the committed ownership map remains within docs/architecture/rule-ownership.md; previous CI success remains applicable and no paths changed in this attempt.
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 942f0854846864b557826044f0a555d55668d476e302f4a4d5785f47fed16f83
        base_head: e6149d011441fbdc5a147a36a56e5203749dad64
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/077-rules-reorganization/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 942f0854846864b557826044f0a555d55668d476e302f4a4d5785f47fed16f83
        outcome: scope_revision
        summary: Focused and characterization tests pass, but npm run ci fails because the integrated TASKS-001 ownership map contains a public-name-regression violation. The smallest Blueprint-scoped recovery must permit correcting that document alongside the new test.
      - task: '002'
        kind: scope
        reason: Whole CI identifies a public-name regression in the integrated ownership map; add the map to TASKS-002 scope solely to make its characterization suite and required CI pass.
        previous:
          - test/rule-ownership.test.js
        next:
          - test/rule-ownership.test.js
          - docs/architecture/rule-ownership.md
        revision: r1
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 74c62e999aff20015ce76c0f8be1066f7889e5ff3b91860ad3d9e7f40f1f95bd
        base_head: e6149d011441fbdc5a147a36a56e5203749dad64
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/077-rules-reorganization/
          ?? test/rule-ownership.test.js
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 74c62e999aff20015ce76c0f8be1066f7889e5ff3b91860ad3d9e7f40f1f95bd
        outcome: accepted
        summary: The scope-r1 implementation adds ownership-map characterization coverage and a minimal public-name correction. Focused, characterization, full CI, and diff checks pass.
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: e78face9d46218860f76c5635fbd9aeecc79ff292a9f7c7264690c5b7f384a16
        base_head: e6149d011441fbdc5a147a36a56e5203749dad64
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M docs/architecture/rule-ownership.md
          ?? .bouncer/context/epics/077-rules-reorganization/
          ?? test/rule-ownership.test.js
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: e78face9d46218860f76c5635fbd9aeecc79ff292a9f7c7264690c5b7f384a16
        outcome: accepted
        summary: Review repair now validates each load-graph reference and prohibits execute failure-only references in startup. Focused tests, full CI, and diff checks pass.
      - task: '002'
        kind: critical-recovery
        used: 1
        findings:
          - tasks-002-load-graph-current-reference-and-failure-startup-coverage
        reason: 'Delta certification found a major introduced-by-revision false-acceptance risk: path presence alone does not preserve declared load phases.'
        outcome: null
      - task: '002'
        kind: critical-recovery
        used: 1
        findings:
          - tasks-002-load-graph-current-reference-and-failure-startup-coverage
        reason: Recorded recovery implementation was accepted at dispatch attempt 3; the restored integration brief preserves scope r1 and the reported phase-binding coverage resolves the single qualifying false-acceptance finding.
        outcome: resolved
      - task: '002'
        kind: dispatch
        attempt: 4
        task_brief_hash: e78face9d46218860f76c5635fbd9aeecc79ff292a9f7c7264690c5b7f384a16
        base_head: e6149d011441fbdc5a147a36a56e5203749dad64
        initial_worktree_state: |2
           M .bouncer/context/index.md
           M docs/architecture/rule-ownership.md
          ?? .bouncer/context/epics/077-rules-reorganization/
          ?? test/rule-ownership.test.js
      - task: '002'
        kind: report
        attempt: 4
        task_brief_hash: e78face9d46218860f76c5635fbd9aeecc79ff292a9f7c7264690c5b7f384a16
        outcome: blocked
        summary: Discovery review found five must-fix major characterization gaps in test/rule-ownership.test.js (unknown consumers, malformed rows, migratable current owners, hard-coded governance path, and phase-insensitive load references) plus an out-of-scope context-index diff. The sole critical recovery is already consumed and resolved; a new major finding is terminal under the recovery ceiling.
      - task: '002'
        kind: dispatch
        attempt: 5
        task_brief_hash: 5bd87d17cd53d78e68238564cfa954fd66b2cf3310c54bd77802d9f3e5896d13
        base_head: e6149d011441fbdc5a147a36a56e5203749dad64
        initial_worktree_state: |2
           M docs/architecture/rule-ownership.md
          ?? .bouncer/context/epics/077-rules-reorganization/
          ?? test/rule-ownership.test.js
      - task: '002'
        kind: report
        attempt: 5
        task_brief_hash: 5bd87d17cd53d78e68238564cfa954fd66b2cf3310c54bd77802d9f3e5896d13
        outcome: accepted
        summary: 'Ordinary rework after recovery-ceiling blocked: closed five characterization gaps (unknown consumers, malformed rows, migratable current owners, no hard-coded governance path, phase-scoped load references). Focused tests, baseline suite, and npm run ci pass. Context index left untouched.'
      - task: '002'
        kind: dispatch
        attempt: 6
        task_brief_hash: 5bd87d17cd53d78e68238564cfa954fd66b2cf3310c54bd77802d9f3e5896d13
        base_head: 466ff4fd23f77e63ed83c3d285a69ea62589aae6
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/
      - task: '002'
        kind: report
        attempt: 6
        task_brief_hash: 5bd87d17cd53d78e68238564cfa954fd66b2cf3310c54bd77802d9f3e5896d13
        outcome: accepted
        summary: 'Review fix batch: step excludes failure branch with working startup strip; G17 locks Coordinator-mode weaker-of-three sentence; contracts assert via ownership-row sections. Focused, baseline, and npm run ci pass.'
      - task: '002'
        decision: TASKS-002 commit 5c88d813 records characterization suite and public-name correction on scope r1 paths test/rule-ownership.test.js and docs/architecture/rule-ownership.md after discovery+delta review.
---
# Explain

## Background
`rules/governance.md`에 Blueprint sizing·light/full·DAG·coordinator 규범이 한 파일로
모여 있어, 후속 Blueprint가 정본을 옮길 때 누락과 의미 변화를 기계적으로 잡기 어렵다.
이 Blueprint는 현재·목표 소유권 표와 workflow 적재(load graph) 기준선을 문서화하고,
그 표를 검사하는 characterization 테스트를 추가한다. runtime·CLI·기존 rule 본문은
바꾸지 않는다.

Drive에서 TASKS-001은 ownership 문서를 커밋했고, TASKS-002는 그 문서를 입력으로
구조·digest·current-owner 계약·phase-bound 참조를 검사하는 테스트를 커밋했다.
TASKS-002 scope는 CI 공개명칭 회귀를 고치려고 `docs/architecture/rule-ownership.md`를
r1에서 포함했다. critical recovery 1회는 load-graph phase 결합을 보강하는 데 썼고,
이후 discovery 갭은 brief를 조인 뒤 ordinary rework로 닫았다.

## Intuition
이사 전에 방 배치도와 짐 목록을 적어 두고, 옮긴 뒤 목록과 배치가 맞는지 자동으로
대조하는 안전망이다.

## Code
- `docs/architecture/rule-ownership.md` — ownership 표, load graph, source digest
- `test/rule-ownership.test.js` — 표 파싱, unknown/malformed 거부, owner locator,
  phase-scoped 참조, sizing/light/DAG/coordinator 계약
- 정본은 여전히 `rules/governance.md` (이 BP에서 수정하지 않음)

통합 HEAD: `b43703831723e354ce54b8794022580dcccc12c5`
- TASKS-001 worker/통합: `6fda1950423e5c64a14bd32d74e51e56e8229ff0`
- TASKS-002 worker: `5c88d8137b2bb265bda349cb05d12eeac3663bbb` (branch `bouncer/077-001-002`)

## Quiz
1. 이 Blueprint가 `rules/governance.md`에 하는 일은?
   - A) 현행 정본으로 두고 ownership·load graph 기준선과 검사만 추가한다
   - B) 규범 문장을 skill/agent로 옮긴다
   - C) governance를 삭제하고 AGENTS.md로 대체한다

2. TASKS-002 테스트가 current owner를 검사할 때 하지 말아야 할 것은?
   - A) owner 파일에 locator가 있는지 확인한다
   - B) 후속 BP가 owner 열만 갱신할 수 있게 경로 존재·locator만 본다
   - C) 모든 행의 current owner를 단일 `source_path` 문자열과 강제 일치시킨다

3. load graph 참조 존재 검사는 어디에 한정해야 하는가?
   - A) consumer 원문 파일 전체
   - B) 선언된 startup/step/failure phase 구간
   - C) `node_modules`와 test fixture만

## 이해 상태
- 정답: 1A, 2C, 3B
- 응답: 1A, 2C, 3B
- 채점: 3/3 전부 정답
- disposition: ship
- range: develop..b43703831723e354ce54b8794022580dcccc12c5
- quiz_score: 3/3

## Tasks

### Task 001

#### Goal & intent

`rules/governance.md`의 모든 규범 단위를 stable id로 식별해 현재 소유자, 목표 소유자, 소비자와 이전 Blueprint를 한 표에서 판정할 수 있게 하고 workflow별 rule load graph를 같은 문서에 기록한다.

#### Current behavior

- `rules/governance.md:3`부터 `rules/governance.md:204`까지 Blueprint sizing, light/full, DAG·scope, coordinator scope·worktree·commit과 repair 계약이 한 파일에 있다.
- `skills/bouncer-plan/SKILL.md:144`, `skills/bouncer-run/SKILL.md:103`, `skills/bouncer-execute/SKILL.md:101`, `skills/bouncer-commit/SKILL.md:34`, `skills/bouncer-finalize/SKILL.md:49`와 `agents/bouncer-coordinator.md:74`가 서로 다른 판단을 위해 같은 파일을 참조한다.
- `test/master-rules.test.js:680`, `test/workflow-safety-canon.test.js:144`, `test/lightweight-cycle.test.js:15`와 `test/agents.test.js:383`은 현재 규칙 의미와 함께 `governance.md` 위치도 직접 검사한다.
- 재현 명령은 `rg -n 'rules/governance\\.md' skills agents references test docs AGENTS.md`이며 현재 ownership inventory나 소비자별 load graph 산출물은 없다.

#### Target behavior

- 성공: 각 규범 단위가 정확히 하나의 현재 소유자와 목표 소유자, 하나 이상의 소비자, BP 2·3·4 중 이전 단계를 갖고 source digest로 현행 본문과 연결된다.
- 성공: `init`, `plan`, `run`, `execute`, `commit`, `finalize`, coordinator의 load graph가 startup, numbered step, failure branch를 구분한다.
- 실패: 소유자가 복수이거나 비어 있는 항목, 소비자가 없는 항목, 분류되지 않은 규범 단위와 조건부 reference의 무조건 적재를 문서 계약상 허용하지 않는다.
- 보존: `rules/governance.md`, 기존 skill·agent·test, CLI 동작과 배포 surface는 변경하지 않는다.

#### Interface

- 제공: 개발자용 Markdown 문서는 ownership 행 `id | source | current owner | target owner | consumers | migration BP`와 load 행 `consumer | startup | step | failure`를 제공한다. `source`는 현재 정본의 heading과 규범 단위를 식별하고 문서 머리말의 SHA-256 digest가 원본 byte 변경을 드러낸다.
- 거부: 빈 owner·consumer, 중복 id, 둘 이상의 target owner, BP 2·3·4 밖의 migration BP와 startup/step/failure가 섞인 load 행은 유효한 기준선으로 취급하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/rule-ownership.md` | `신규 추출 지점: governance 규범 inventory와 workflow load graph` | Create | 해당 산출물이 없음 | 규범 단위 ownership, source digest와 소비자별 적재 단계를 기록 | 후속 BP 2·3·4가 공유할 이동 기준선이 필요함 |

#### Constraints

- 규범 단위는 단순 줄 번호가 아니라 heading과 문장 또는 list item의 의미 경계로 식별하되 원본 전체 digest도 기록한다.
- 목표 소유자는 `AGENTS.md`, shared rule, agent, skill, docs/code 중 하나로 단일화한다.
- shared rule은 둘 이상의 소비자가 같은 판단을 수행할 때만 선택하고 역할 전용 절차는 agent가 소유한다.
- 과거 `possibly-superseded` Explain 제약은 승계하지 않고 현재 checkout을 기준으로 기록한다.

### Task 002

#### Goal & intent

TASKS-001의 ownership map과 load graph를 기계적으로 검사하고, 현재 planning·execution 핵심 계약을 파일 이동 전 characterization으로 고정한다.

#### Current behavior

- `test/master-rules.test.js:680-768`은 DAG, coordinator dynamic scope와 단일 정본을 검사하지만 `governance.md` 경로를 직접 읽는다.
- `test/workflow-safety-canon.test.js:144-176`은 actual cwd와 light dispatch 정본을 현재 section 위치에 결합해 검사한다.
- `test/lightweight-cycle.test.js:15-150`은 light/full 동작을 폭넓게 보존하지만 ownership map과 소비자 load graph의 완전성은 검사하지 않는다.
- `test/helpers/read-skill.js:53-64`의 `readWorkflowBundle`은 workflow와 조건부 reference를 합쳐 계약 테스트가 읽게 하지만 intent provenance는 unresolved 상태다.
- 현재 기준선은 `node --test test/master-rules.test.js test/workflow-safety-canon.test.js test/lightweight-cycle.test.js test/agents.test.js`로 재현되며 ownership 전용 테스트는 없다.

#### Target behavior

- 성공: 테스트가 ownership 행의 unique id, non-empty current/target owner와 consumers, 단일 target owner, 허용 migration BP를 검사한다.
- 성공: 테스트가 문서에 선언된 current owner 경로를 따라 규범을 찾아 새 테스트 코드에 `rules/governance.md`를 정본 경로로 다시 고정하지 않는다. conditional/step governance 적재 검사는 ownership map 또는 load-graph 선언에서 읽은 경로로만 판단한다.
- 성공: 여섯 workflow와 coordinator가 load graph에 정확히 한 번 나타나고 startup, step, failure 구분과 현재 참조가 일치한다. 참조 존재 검사는 consumer 원문의 해당 phase 구간만 보고, phase를 무시하고 파일 전체에서 찾으면 실패로 취급한다.
- 성공: current owner는 선언된 경로 파일이 존재하고 그 안의 locator를 담는지만 검사하며, 모든 행이 단일 `source_path`와 문자 일치한다고 강제하지 않는다(후속 BP가 owner 열만 갱신해 이관할 수 있게 한다).
- 성공: Blueprint sizing, light/full, DAG·approved scope, coordinator revision·worktree·commit scope·repair의 관측 가능한 계약을 characterization assertion으로 고정한다.
- 실패: source digest drift, 누락·중복 ownership, 알 수 없는 소비자 또는 migration BP, malformed row(행 번호 포함), 기본 preload로 잘못 분류된 conditional reference를 명시적인 assertion 메시지로 거부한다. unknown consumer와 malformed ownership/load-graph 입력에 대한 부정 검사가 있어야 한다.
- 보존: 기존 테스트 파일, runtime 코드, rule·skill·agent 본문과 CLI 출력은 바꾸지 않는다. `.bouncer/context/index.md` 등 affected_paths 밖 파일은 수정·스테이징하지 않는다.

#### Interface

- 제공: Node test는 ownership Markdown을 읽어 표 행과 source digest를 파싱하고 현재 owner 문서에서 규범 식별자를 확인한다. 새 테스트 내부 helper는 `parseOwnership(markdown: string)`과 `parseLoadGraph(markdown: string)` 형태의 순수 변환으로 두 표를 분리한다.
- 거부: 표 header 불일치, 빈 필드, duplicate id, 쉼표 등으로 둘 이상의 target owner를 표현한 행, 허용 목록 밖 consumer·phase·migration BP, digest 불일치는 assertion failure로 처리한다. 파일 부재와 읽기 실패는 fallback 없이 해당 경로를 포함한 failure로 처리한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/rule-ownership.test.js` | `신규 추출 지점: ownership table parser와 migration characterization assertions` | Create | 해당 검사가 없음 | ownership/load graph 구조, source digest와 현재 핵심 동작을 검사 | 후속 정본 이동에서 누락과 의미 회귀를 자동 탐지해야 함 |
| `docs/architecture/rule-ownership.md` | `public-name regression recovery` | Correct | TASKS-001 ownership baseline | CI를 막는 폐기된 외부 profile 명칭만 일반화 | scope revision r1에서 발견된 전체 CI 차단을 Blueprint 안에서 해소해야 함 |

#### Constraints

- Node 내장 모듈과 현재 test runner만 사용하고 새 dependency를 추가하지 않는다.
- 테스트는 문서에 선언된 current owner를 따라가며 목표 파일이 아직 존재한다고 가정하지 않는다.
- characterization은 현재 의미를 잠그되 BP 2·3에서 owner 열과 source locator를 갱신해 정본 이동할 수 있게 한다.
- runtime 구현 세부 lock 알고리즘이 아니라 에이전트가 판단하는 외부 계약만 assertion한다.