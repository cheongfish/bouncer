---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/003-code-first-plan-cutover/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-16T10:32:32.544+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '071'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 7636322015506bafcd5b117893e148d0a4060e6b
      diff_sha: c2b043ac2d6a47999236e86287e6c0df6df329f77db74009d6fa9eed1b7b0caa
      quiz_score: 2/3
      disposition: Q3은 구동작을 고른 오답. type predicate 파일은 통째로 버리지 않고 skipType이 is를 건너뛴다.
      recorded_at: '2026-09-16T10:39:20+09:00'
  task_commits:
    - task: EPIC-071/BP-003/TASK-001
      sha: 2ecdd029
      intent_anchor: task-001
    - task: EPIC-071/BP-003/TASK-002
      sha: f36e812f
      intent_anchor: task-002
    - task: EPIC-071/BP-003/TASK-003
      sha: bb39f9bb
      intent_anchor: task-003
    - task: EPIC-071/BP-003/TASK-004
      sha: 4f0758b1
      intent_anchor: task-004
    - task: EPIC-071/BP-003/TASK-006
      sha: 069b3d7a
      intent_anchor: task-006
  coordinator:
    base: b3045e2aa9591e206f83dc1f2a71b79c62f812a7
    integration_head: 7636322015506bafcd5b117893e148d0a4060e6b
    integration_branch: feat/071-003-code-first-plan-cutover
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/workers/004
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/003/workers/006
    tasks:
      - id: '001'
        status: integrated
        sha: 2ecdd029e84ef393c4026757665c73d069a49094
        branch: bouncer/071-003-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/symbol-index.js
          - scripts/src/lib/symbol-index.ts
          - test/symbol-index.test.js
      - id: '002'
        status: integrated
        sha: f36e812f31eecfb867991d87d7e09b3327cc797c
        branch: bouncer/071-003-002
        scope_revision: null
        paths: []
        actual_paths:
          - docs/compatibility.md
          - docs/gates.md
          - docs/troubleshooting.md
          - scripts/lib/scaffold.js
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-structural.js
          - scripts/src/lib/scaffold.ts
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-structural.ts
          - test/scaffold.test.js
          - test/validate-gates.test.js
          - test/validate-structural.test.js
      - id: '003'
        status: integrated
        sha: bb39f9bbe895320988f724c42bb72b7907766dad
        branch: bouncer/071-003-003
        scope_revision: null
        paths: []
        actual_paths:
          - references/discovery/index.md
          - references/spec-authoring/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/graphify-suggestions.md
          - skills/bouncer-plan/references/scope-confirm.md
          - test/master-rules.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-discovery.test.js
          - test/skill-spec-authoring.test.js
      - id: '004'
        status: integrated
        sha: 4f0758b1ec472ca8ec88a2b195ab072eb93336ce
        branch: bouncer/071-003-004
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - agents/bouncer-context-reviewer.md
          - docs/ARCHITECTURE.md
          - docs/graphify-context-contribution.md
          - docs/workflow.md
          - references/graphify-runner/index.md
          - references/spec-authoring/tasks.md
          - rules/governance.md
          - rules/okf.md
          - skills/bouncer-execute/SKILL.md
          - test/agents.test.js
          - test/skill-graphify-runner.test.js
      - id: '005'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '006'
        status: integrated
        sha: 069b3d7ac25474f0b6b23cc878e615dc66dd0fed
        branch: bouncer/071-003-006
        scope_revision: r1
        paths:
          - docs/troubleshooting.md
        actual_paths:
          - docs/troubleshooting.md
    decisions:
      - task: '002'
        decision: 'accepted TASKS-002: G4/S9 cutover; changed docs/{compatibility,gates,troubleshooting}.md scripts/{src/,}lib/{scaffold,templates,validate-gates,validate-structural}.{ts,js} test/{scaffold,validate-gates,validate-structural}.test.js; refused package-lock.json drift (npm install side-effect reverted); review discovery empty; workers implementer+reviewerx3'
      - task: '001'
        decision: 'accepted TASKS-001: skipType type-predicate; paths scripts/{src/,}lib/symbol-index.{ts,js} test/symbol-index.test.js; review discovery empty; workers implementer+reviewerx3'
      - task: '003'
        decision: accepted TASKS-003 after discovery fix batch F1-F3 resolved; paths skills/bouncer-plan/{SKILL.md,references/{scope-confirm,graphify-suggestions}.md} references/{discovery,spec-authoring}/index.md test/{skill-bouncer-plan,skill-discovery,skill-spec-authoring,master-rules}.test.js; workers implementer+reviewerx3+implementer-fix+delta-reviewer
      - task: '004'
        decision: accepted TASKS-004; F1 resolved (agents.test orphan assert); CT-001/CT-002/F2 accepted advisory (preserve Step1 context G4 for BP004); paths references/graphify-runner/index.md test/skill-graphify-runner.test.js rules/{okf,governance}.md references/spec-authoring/tasks.md skills/bouncer-execute/SKILL.md agents/bouncer-context-reviewer.md .codex/agents/bouncer-context-reviewer.toml test/agents.test.js docs/{ARCHITECTURE,workflow,graphify-context-contribution}.md
      - task: '006'
        kind: repair
        wave: 1
        reason: 'Repair wave 1: CI failed from missing worktree deps, not blueprint source. npm ci already applied on integration and npm run ci exits 0. Add a short troubleshooting note that integration/verification worktrees need npm ci before npm run ci so the gap is documented; then re-run TASKS-005.'
        failure:
          task: '005'
          command: npm run ci
          summary: incomplete node_modules in integration worktree (ENOENT js-yaml package.json and typescript/bin/tsc); coverage and product tests were green; npm ci remediates
          paths:
            - docs/troubleshooting.md
          exitCode: 1
          repairWave: 0
        previousDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on: []
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '002'
          - id: '005'
            depends_on:
              - '001'
              - '002'
              - '003'
              - '004'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on: []
          - id: '003'
            depends_on:
              - '002'
          - id: '004'
            depends_on:
              - '002'
          - id: '005'
            depends_on:
              - '006'
          - id: '006'
            depends_on:
              - '001'
              - '003'
              - '004'
        previousScope: []
        nextScope:
          - docs/troubleshooting.md
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r1
      - task: '006'
        decision: 'accepted repair TASKS-006: docs/troubleshooting.md worktree npm ci note; F-SS-001 advisory accepted; workers implementer+reviewer'
---
# Explain

## Background
plan 게이트가 Graphify `scope_evidence`를 승인 범위의 필수 증적으로 요구하던 계약을 끊었다. 승인 범위는 사용자가 확정한 `affected_paths`와 Touch에만 남기고, Plan은 오래된 context 문서 대신 현재 checkout의 함수 정의와 `bouncer intent` Explain을 읽도록 바꿨다. 같은 컷오버에서 type predicate 반환 타입 때문에 symbol index가 파일을 통째로 버리던 결함도 고쳤다. drive 중 terminal CI가 integration worktree의 불완전한 `node_modules`로 한 번 실패해 repair wave 1(TASKS-006)로 troubleshooting 안내를 보강한 뒤 `npm run ci`를 다시 통과시켰다.

## Intuition
조언용 그래프 후보는 보여 주기만 하고, 승인 도장과 Plan의 근거는 사람 확정 경로와 함수 의도 조회로 옮긴다.

## Code
- `scripts/src/lib/symbol-index.ts` — `skipType`이 `is` 술어를 타입으로 건너뛰어 predicate 파일도 색인한다 (TASKS-001, worker `bouncer/071-003-001` @ `2ecdd029`).
- `scripts/src/lib/validate-structural.ts` / `validate-gates.ts` / `scaffold.ts` / `templates.ts` — G4·S9와 `scope_evidence` 기본값 제거 (TASKS-002 @ `f36e812f`).
- `skills/bouncer-plan/SKILL.md` + discovery/spec-authoring — Discover가 코드 검색 → `bouncer intent` → non-historical Explain만 전달 (TASKS-003 @ `bb39f9bb`).
- `references/graphify-runner/index.md`, `rules/okf.md`, `rules/governance.md`, execute/context-reviewer — frontmatter 작성 절차와 G4 현재검사 서술 삭제 (TASKS-004 @ `4f0758b1`).
- integration HEAD `7636322` — TASKS-005 `npm run ci` exit 0; repair TASKS-006이 `docs/troubleshooting.md`에 worktree `npm ci` 안내를 추가 (@ `069b3d7a`).

DAG: 계획 시 001∥002 → 003·004(←002) → 005(←001..004). drive에서 CI 실패 후 005 depends_on이 006으로 바뀌고 006이 001·003·004에 의존하는 repair edge가 추가됐다. scope revision은 006의 `r1`(troubleshooting)뿐이고 001–004 `actual_paths`는 초기 `affected_paths`와 일치했다.

## Quiz
1. 이 blueprint 이후 plan gate가 승인 범위를 무엇으로 판정하는가?
   - A) `bouncer.scope_evidence.basis`가 비어 있지 않은지
   - B) 사용자가 확정한 `affected_paths`와 Touch(G5·G11·G12)
   - C) context-search decision 모드의 canonical 문서 목록
2. Discover 단계에서 `bouncer intent` 결과를 frontmatter나 `affected_paths`에 어떻게 다루는가?
   - A) `scope_evidence`로 저장한 뒤 G4에 제출한다
   - B) 조언으로만 쓰고 frontmatter에 쓰지 않으며 `affected_paths`를 넓히지 않는다
   - C) `graph-suggest` 후보와 합쳐 suggested_paths에 기록한다
3. type predicate 반환 타입(`v is T` 등)이 있던 파일에서 symbol index는 무엇을 하는가?
   - A) 해당 파일 전체를 `[]`로 버린다
   - B) `skipType`이 `is`를 먹고 타입을 더 건너뛰어 뒤따르는 정의도 색인한다
   - C) `typescript` 패키지 parser로 파일을 재파싱한다

## 이해 상태
quiz_score 2/3. Q1 정답 B / 응답 B · 맞음. Q2 정답 B / 응답 B · 맞음. Q3 정답 B / 응답 A · 틀림(구동작; 지금은 skipType이 `is`를 건너뛰어 뒤 정의를 색인). disposition: Q3만 구동작 혼동.

## Tasks

### Task 001

#### Goal & intent

`bouncer intent`의 symbol index가 반환 타입 자리의 type predicate(`v is T`, `asserts v is T`, `asserts v`, `this is T`)를 타입으로 건너뛰게 한다. 지금은 이 구문이 있는 파일을 통째로 버린다. 그래서 이 저장소 `scripts/src/lib/*.ts` 55개 중 15개에서 source 정의 대신 generated 후보만 나온다. 완료 후 `node scripts/bouncer intent --symbol isNumericContextId`가 `status: resolved`이고 `symbol_ref.path`가 `scripts/src/lib/paths.ts`다. 검증 명령은 `npm test`.

#### Interface

- 제공: `resolveSymbol({ repoRoot, symbol, candidateRef })`와 `bouncer intent` 출력 형태는 바뀌지 않는다. type predicate 반환 타입을 쓴 파일의 정의가 후보 목록에 포함된다.
- 거부: 새 CLI 옵션, 새 status, 새 kind를 추가하지 않는다. overload 서명, decorator, `satisfies` 같은 다른 TypeScript 구문은 이 task에서 지원하지 않는다.

#### Do not touch

- `scripts/src/lib/intent-provenance.ts` — blame·trailer·freshness 계약은 BP 002 그대로다.
- `scripts/src/lib/cli-project-commands.ts` — `intent` 인자와 출력 계약을 바꾸지 않는다.
- `skills/bouncer-plan/SKILL.md` — TASKS-003 소유.

### Task 002

#### Goal & intent

plan gate(G4)와 구조 검사(S9)가 `bouncer.scope_evidence`와 구 `bouncer.graph`를 요구하거나 검사하지 않게 하고, scaffold가 이 필드를 만들지 않게 한다. 승인 범위는 G5·G11·G12가 계속 판정한다. G4·S9는 결번으로 문서화한다. 검증 명령은 `npm test`.

#### Interface

- 제공: validate 결과에 G4·S9가 없다. `validate-structural` export에서 `normalizeScopeEvidence`, `isValidGraphBasis`, `GRAPH_BASIS_STATUS`, `GRAPH_BASIS_GRAPH`가 사라진다. `docs/gates.md`와 `docs/compatibility.md`가 G4·S9를 결번으로 기록한다.
- 거부: G4·S9 번호를 다른 검사에 쓰지 않는다. 호환 alias, deprecation 경고, legacy 필드 자동 삭제나 재작성을 두지 않는다.

#### Do not touch

- `scripts/src/lib/symbol-index.ts` — TASKS-001 소유.
- `skills/bouncer-plan/SKILL.md` — TASKS-003 소유.
- `references/graphify-runner/index.md` — TASKS-004 소유.
- `rules/governance.md` — TASKS-004 소유.
- `scripts/src/lib/graph-search.ts` — `graph-suggest` 출력은 BP 004가 바꾼다.
- `.bouncer/context/` — 기존 계획 문서의 legacy 필드는 그대로 둔다.

### Task 003

#### Goal & intent

`/bouncer-plan`이 scaffold 전에 `context-search`나 context graph를 쓰지 않게 한다. 대신 현재 checkout에서 진입점과 함수 정의를 찾고, 관련 함수마다 `bouncer intent`를 호출해 resolver가 고른 Explain 절만 discovery와 spec-authoring 입력으로 쓴다. `graph-suggest`는 source graph가 있을 때 `affected_paths` 확정 전에 조언으로 보여 주기만 하고 frontmatter에 쓰지 않는다. 검증 명령은 `npm test`.

#### Interface

- 제공: Plan이 부르는 명령은 `bouncer plan inspect`, `bouncer project-root`, `bouncer intent`, `bouncer scaffold`, `bouncer graph-suggest`(source graph가 있을 때), `bouncer current`, `bouncer validate`다. spec-authoring은 `intent evidence` 항목으로 resolver가 고른 절만 입력으로 받는다.
- 거부: `context-search` 호출, `graphify-out/context/graph.json` 직접 질의, `scope_evidence` 작성, intent 결과의 frontmatter 저장, Explain·intent·Graphify 후보로 `affected_paths`를 채우거나 넓히는 것.

#### Do not touch

- `skills/bouncer-run/SKILL.md` — context retrieval 삭제는 BP 004의 TASKS-001 소유.
- `skills/bouncer-execute/SKILL.md` — TASKS-004와 BP 004의 TASKS-001 소유.
- `references/graphify-runner/index.md` — TASKS-004와 BP 004의 TASKS-004 소유.
- `rules/okf.md` — TASKS-004 소유.
- `scripts/src/lib/cli-project-commands.ts` — `context-search` CLI는 BP 004까지 남는다.
- `test/ci-contract.test.js` — `distill` 출현 수를 그대로 두어 이 파일을 고치지 않는다.

### Task 004

#### Goal & intent

graphify-runner, `rules/okf.md`, `rules/governance.md`, spec-authoring 예시, execute skill, context-reviewer agent, 구조 문서에서 `bouncer.scope_evidence` 작성 절차와 G4를 현재 검사로 쓰는 서술을 지운다. 그러면 남은 안내가 TASKS-002 뒤의 validator 계약(G4·S9 없음)과 맞는다. graphify-runner는 `graph-suggest`가 낸 후보·quality·그래프별 basis를 `/bouncer-plan`에 돌려주기만 하고 task frontmatter에 쓰지 않는다. graphify-runner의 context 서술은 BP 004의 TASKS-004가 지우므로 이 task는 그 문구를 바꾸지 않는다. 검증 명령은 `npm test`.

#### Interface

- 제공: graphify-runner의 반환 계약(후보·quality·basis를 호출자에게 반환). okf의 legacy 필드 무시 규칙. execute skill의 legacy 필드 제외 규칙.
- 거부: task frontmatter에 Graphify 결과를 쓰는 절차, `scope_evidence` 작성 예시, G4를 현재 검사로 서술하는 문장.

#### Do not touch

- `skills/bouncer-plan/SKILL.md` — TASKS-003 소유.
- `references/implementation/index.md` — 주석 작성 예시일 뿐 현재 계약 서술이 아니다.
- `docs/distill-decommission-audit.md` — 과거 감사 기록.
- `scripts/src/lib/validate-structural.ts` — TASKS-002 소유.
- `test/lightweight-cycle.test.js` — governance가 `G3–G5` 표기를 유지하므로 고치지 않는다.

### Task 005

#### Goal & intent

TASKS-001부터 TASKS-004까지 `integrated` 상태가 된 뒤 integration checkout에서 `npm run ci`를 한 번 실행하고 `verification.md`에 증적을 남긴다. 이 node는 source를 바꾸지 않고 commit도 만들지 않는다.

#### Interface

- 제공: `verification.md`의 `npm run ci` 실행 증적.
- 거부: source diff, reviewable commit, `review.md`, `affected_paths`를 만들지 않는다.

#### Do not touch

- `scripts/src/lib/` — verification node는 source를 바꾸지 않는다.
- `test/` — 실패는 repair task가 고친다.

### Task 006

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Do not touch

- `.git/`과 `.bouncer/` governance tree