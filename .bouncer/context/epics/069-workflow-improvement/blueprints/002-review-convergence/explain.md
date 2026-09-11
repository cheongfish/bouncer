---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/002-review-convergence/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-11T17:23:53.462+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '069'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 3a5497b46f3fad177b73a5e9bf7c7ac484637fb6
      diff_sha: 736e502d9c40df3f33f23d245223d90d8ba50ec29400bd593c0f2962d427b575
      quiz_score: 3/5
      disposition: coordinator 복구 한도, context namespace, TASKS-004 정지 원인은 이해함. delta round 채택 범위와 finding 정체성(fingerprint) 판정 기준은 다시 볼 것.
      recorded_at: '2026-09-11T17:58:27.000+09:00'
  task_commits:
    - id: '001'
      sha: c2f3703f
    - id: '002'
      sha: f3e92ede
    - id: '003'
      sha: a84f98c7
    - id: '004'
      sha: 519e2829
    - id: '005'
      sha: 41e06a4b
  coordinator:
    base: 8f87d6a491239fd1c9b5394192f8c898f3c099c7
    integration_head: 3a5497b46f3fad177b73a5e9bf7c7ac484637fb6
    revision: r6
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/workers/004
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/069/002/workers/005
    tasks:
      - id: '001'
        status: integrated
        sha: c2f3703f8be3cdfbe295cdd5abd0026aa1eb2837
        scope_revision: r3
        paths:
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - docs/ARCHITECTURE.md
          - skills/bouncer-run/SKILL.md
        actual_paths:
          - docs/ARCHITECTURE.md
          - docs/gates.md
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-sections.js
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-sections.ts
          - skills/bouncer-run/SKILL.md
          - test/scaffold.test.js
          - test/validate-gates.test.js
      - id: '002'
        status: integrated
        sha: f3e92ede6a86c22837a57835aba34313eb46412a
        scope_revision: r5
        paths:
          - references/review/assets/reviewer-prompt.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-reviewer.toml
          - test/agents.test.js
          - .gitignore
        actual_paths:
          - .gitignore
          - agents/bouncer-reviewer.md
          - references/review/assets/reviewer-prompt.md
          - test/agents.test.js
          - .codex/agents/bouncer-reviewer.toml
      - id: '003'
        status: integrated
        sha: a84f98c73d8ffb334f44bfb9665cc62bd9b553b7
        scope_revision: null
        paths: []
        actual_paths:
          - docs/workflow-contract.md
          - references/review/index.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/review-round.md
          - skills/bouncer-run/SKILL.md
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
          - test/workflow-safety-canon.test.js
      - id: '004'
        status: integrated
        sha: 519e28297f2bb765d1a5d820e311e9ab2dde6723
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - docs/cli.md
          - rules/governance.md
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - test/cli-coordinate.test.js
          - test/coordinator.test.js
      - id: '005'
        status: integrated
        sha: 41e06a4b14366f4ce5438d362f3e49ba46f5b864
        scope_revision: r6
        paths:
          - agents/bouncer-context-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - references/context-review/index.md
          - skills/bouncer-plan/references/context-review.md
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/agents.test.js
          - test/skill-context-review.test.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - .gitignore
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - .gitignore
          - agents/bouncer-context-reviewer.md
          - docs/gates.md
          - references/context-review/index.md
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-sections.js
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-sections.ts
          - skills/bouncer-plan/references/context-review.md
          - test/agents.test.js
          - test/scaffold.test.js
          - test/skill-context-review.test.js
          - test/validate-gates.test.js
    decisions:
      - task: '001'
        kind: scope
        reason: 사용자 승인 자율 재개 정책을 실행하기 위해 coordinator blocker 의사결정 권한을 명문화하고, 현재 TASKS-001 commit_intent 차단을 in-blueprint 메타데이터 조정으로 복구한다.
        previous:
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - docs/ARCHITECTURE.md
        next:
          - skills/bouncer-run/SKILL.md
        revision: r1
      - task: '001'
        kind: scope
        reason: r1이 affected_paths를 교체하는 CLI 의미였으므로 기존 TASKS-001 범위를 복원하고, 사용자 승인 자율 blocker remediation 경로를 함께 기록한다.
        previous:
          - skills/bouncer-run/SKILL.md
        next:
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - docs/ARCHITECTURE.md
          - skills/bouncer-run/SKILL.md
        revision: r2
      - task: '001'
        kind: scope
        reason: 사용자 승인 자율 정책에 따라 TASKS-001 commit_intent의 영문 fixed term을 동등한 한국어 메타데이터로 교정한다. 기능 범위와 acceptance criteria는 변경하지 않는다.
        previous:
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - docs/ARCHITECTURE.md
          - skills/bouncer-run/SKILL.md
        next:
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - docs/ARCHITECTURE.md
          - skills/bouncer-run/SKILL.md
        revision: r3
      - task: '002'
        kind: scope
        reason: 리뷰 blocker를 해결하려면 생성된 reviewer TOML이 일반 stage 경로에서 추적되어야 한다. 기존 ignore 규칙에 reviewer 예외을 추가하는 변경은 TASKS-002의 생성·동일성 수용 기준을 커밋 가능한 상태로 만들며 다른 task의 소관이 아니다.
        previous:
          - references/review/assets/reviewer-prompt.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-reviewer.toml
          - test/agents.test.js
        next:
          - references/review/assets/reviewer-prompt.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-reviewer.toml
          - test/agents.test.js
          - .gitignore
        revision: r4
      - task: '002'
        kind: scope
        reason: ledger r4에서 승인한 reviewer TOML 추적 예외(.gitignore)를 task brief에도 동기화해 G11과 coordinator commit-safety scope를 일치시킨다.
        previous:
          - references/review/assets/reviewer-prompt.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-reviewer.toml
          - test/agents.test.js
          - .gitignore
        next:
          - references/review/assets/reviewer-prompt.md
          - agents/bouncer-reviewer.md
          - .codex/agents/bouncer-reviewer.toml
          - test/agents.test.js
          - .gitignore
        revision: r5
      - task: '002'
        decision: 'TASKS-002 reviewer acceptance: all five r5 scope paths changed; execute gate and npm run ci passed; independent reviewer found no findings.'
      - task: '003'
        decision: 'TASKS-003 accepted after one reviewer-directed rework: execute step 5 now delegates detailed procedure to canonical references and critical_recovery convergence is recorded; full npm run ci and execute/commit gates passed.'
      - task: '004'
        decision: 'TASKS-004 accepted (재개 드라이브). 원인 판정: 이전 blocked(G6/G8)는 worker 004의 tasks/004/tasks.md 사본에 정본(main·integration)의 bouncer.verify: npm run ci가 빠져 config.verify(npm test)로 검증된 탓이다. 조치: worker 사본에 verify 필드만 정본과 같은 위치로 동기화(integration 사본과 byte 동일, affected_paths 불변 — task 번들은 staged되지 않으므로 scope 변경 아님, revise 불요). 이전 npm test 증적과 verification-command blocker의 blocked 판단은 무효 처리. harness npm run ci 1차 실패(eslint 3건: cli-git-commands.ts:306, coordinator.ts:513 max-len, test/coordinator.test.js:62 unused) → bouncer-debugger 1회 → bouncer-implementer 최소 수정 → npm run ci exit 0. bouncer-reviewer round 2 delta: verification-command resolved, docs/cli.md minor 2건(cli-doc-subcommand-count, cli-doc-cwd-check-list) → bouncer-implementer 수정 → npm run ci exit 0 → bouncer-reviewer round 3: 전부 resolved, regressed 0. execute gate 통과, commit gate 통과. worker: bouncer-implementer(구현·lint·docs), bouncer-debugger(lint 원인), bouncer-reviewer(round 2·3). 변경 경로: .codex/agents/bouncer-coordinator.toml, agents/bouncer-coordinator.md, docs/cli.md, rules/governance.md, scripts/lib/cli-git-commands.js, scripts/lib/coordinator.js, scripts/lib/runtime-state.js, scripts/src/lib/cli-git-commands.ts, scripts/src/lib/coordinator.ts, scripts/src/lib/runtime-state.ts, test/cli-coordinate.test.js, test/coordinator.test.js. commit 519e282 (branch bouncer/069-002-004).'
      - task: '005'
        kind: scope
        reason: TASKS-005는 .codex/agents/bouncer-context-reviewer.toml을 mdToCodexToml 생성 결과와 같게 추적해야 하는데, .gitignore가 .codex/agents/*를 무시하고 implementer·reviewer TOML만 예외로 둔다. context-reviewer TOML 예외 한 줄을 추가해야 일반 stage 경로에서 추적·재생성 변경이 보인다. TASKS-002 r4의 reviewer TOML 예외와 같은 판단이며 다른 task 소관이 아니다. 기존 15개 경로는 그대로 유지한다.
        previous:
          - agents/bouncer-context-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - references/context-review/index.md
          - skills/bouncer-plan/references/context-review.md
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/agents.test.js
          - test/skill-context-review.test.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
        next:
          - agents/bouncer-context-reviewer.md
          - .codex/agents/bouncer-context-reviewer.toml
          - references/context-review/index.md
          - skills/bouncer-plan/references/context-review.md
          - scripts/src/lib/validate-sections.ts
          - scripts/lib/validate-sections.js
          - scripts/src/lib/validate-gates.ts
          - scripts/lib/validate-gates.js
          - scripts/src/lib/templates.ts
          - scripts/lib/templates.js
          - test/agents.test.js
          - test/skill-context-review.test.js
          - test/validate-gates.test.js
          - test/scaffold.test.js
          - docs/gates.md
          - .gitignore
        revision: r6
      - task: '005'
        decision: 'TASKS-005 accepted. 판단: (1) 수용 기준이 npm run ci인데 main·integration·worker 사본 모두 bouncer.verify가 없어 config.verify(npm test)로 떨어지므로, TASKS-004 차단과 같은 증적 불일치를 막으려고 worker·integration 사본에 verify: npm run ci를 추가했다(main은 read-only, task 번들은 staged되지 않아 scope 변경 아님). (2) scope r6: 새 .codex/agents/bouncer-context-reviewer.toml 추적을 위해 .gitignore 예외 한 줄 추가(TASKS-002 r4와 같은 판단), brief Touch에 동기화, plan gate 통과. (3) worker·integration worktree에 node_modules가 없어 npm ci로 환경을 맞췄다(추적 파일 변화 없음). 흐름: bouncer-implementer 구현(tests-first) → .gitignore 후속 → harness npm run ci exit 0 → bouncer-reviewer round 1 discovery: blocker·major 없음, minor 3건(F-005-01 category enum 검사 누락, F-005-02 mode 없는 context rounds 문서화, F-005-03 G18 테스트 두 건) → bouncer-implementer 단일 fix batch → npm run ci exit 0(1306/1306) → bouncer-reviewer round 2 delta: 셋 모두 resolved, 신규·regression 없음. execute gate·commit gate 통과. 변경 경로: .codex/agents/bouncer-context-reviewer.toml, .gitignore, agents/bouncer-context-reviewer.md, docs/gates.md, references/context-review/index.md, scripts/lib/templates.js, scripts/lib/validate-gates.js, scripts/lib/validate-sections.js, scripts/src/lib/templates.ts, scripts/src/lib/validate-gates.ts, scripts/src/lib/validate-sections.ts, skills/bouncer-plan/references/context-review.md, test/agents.test.js, test/scaffold.test.js, test/skill-context-review.test.js, test/validate-gates.test.js. commit 41e06a4b14366f4ce5438d362f3e49ba46f5b864 (branch bouncer/069-002-005).'
---
# Explain

## Background
Execute 리뷰는 round마다 전체 diff를 처음부터 다시 판단했다. 그래서 고치지 않은 코드에서도 새 finding이 계속 붙었고, round 상한은 무한 실행만 막을 뿐 리뷰를 끝내지 못했다.

이 blueprint는 리뷰를 수렴하는 구조로 바꾼다. 고정한 target을 관점별로 병렬 판단하고(discovery), controller가 finding을 모아 한 번 고친 뒤, 다음 round는 이전 finding의 해결 여부와 수정분의 regression만 인증한다(delta). Gate는 finding 정체성과 round 순서를 검사하고, coordinator ledger는 드라이브 중 치명 결함 복구를 task당 한 번으로 묶는다. Plan context review도 같은 구조를 따른다.

드라이브는 계획한 DAG(001 → 002 → 003 → 004, 005는 001·002 뒤)를 바꾸지 않고 다섯 task를 차례로 통합했다. 실행 중 기록한 판단은 다음과 같다.
- TASKS-001: scope r1~r3. commit_intent 문구를 한국어 메타데이터로 교정하고 `skills/bouncer-run/SKILL.md`를 범위에 더했다.
- TASKS-002: scope r4~r5. 생성된 reviewer TOML을 추적하려고 `.gitignore` 예외 한 줄을 범위에 더하고 brief Touch에 동기화했다.
- TASKS-004: 첫 드라이브가 G6/G8로 멈췄다. worker 사본 brief에 `verify: npm run ci`가 빠져 `npm test` 증적만 남은 탓이다. 재개 드라이브에서 필드를 정본과 동기화하고, harness `npm run ci`가 찾아낸 lint 3건을 debugger·implementer 1회 복구로 고친 뒤, 리뷰 round 3에서 docs/cli.md 서술 2건까지 닫았다.
- TASKS-005: scope r6. 새 context-reviewer TOML을 추적하려고 `.gitignore` 예외를 더했다. 수용 기준과 맞추려고 brief에 `verify: npm run ci`를 적었다.

## Intuition
시험 채점을 매번 처음부터 다시 하지 않고, 틀린 문항 목록을 들고 고친 답만 다시 보는 방식이다. 문항마다 고유 번호(fingerprint)가 있어서 같은 지적이 다른 이름으로 되살아나지 않는다.

## Code
- `scripts/src/lib/validate-sections.ts` — finding fingerprint 정규형 `<category>:<brief_clause>:<file>#<symbol>`, execute round 검사(G14), `context:` namespace와 context round 검사(G18). `validate-gates.ts`는 G18에 `rounds`와 namespace를 넘긴다.
- `scripts/src/lib/templates.ts` — review·context-review 템플릿 주석에 새 필드 안내.
- `agents/bouncer-reviewer.md`, `references/review/assets/reviewer-prompt.md` — 관점 네 개(`spec_scope`, `correctness_tests`, `minimality_maintainability`, `security`)와 discovery·delta 호출 모드.
- `skills/bouncer-execute/references/review-round.md`, `skills/bouncer-run/SKILL.md` — round 전이와 상한, critical recovery 수렴 기록.
- `scripts/src/lib/coordinator.ts`, `runtime-state.ts`, `cli-git-commands.ts` — `bouncer coordinate critical-recovery` 시작·결과 기록과 거절 코드(`critical-recovery-exhausted` 등), ledger 검증의 `criticalRecovery.used ≤ 1`.
- `agents/bouncer-context-reviewer.md`, `skills/bouncer-plan/references/context-review.md`, `references/context-review/index.md` — 계획 리뷰 관점 네 개(`cross_document`, `scope`, `korean_quality`, `success_criteria`), 본문 digest 고정, delta 인증.
- 생성물 `scripts/lib/*.js`, `.codex/agents/*.toml`은 소스와 같아야 하고 `npm run ci`의 check:emit과 테스트가 이를 확인한다.

## Quiz
1. Delta round에서 reviewer가 새 finding으로 채택할 수 있는 것은?
   - A) 이번 수정과 무관한 코드에서 새로 찾은 `minor`
   - B) 수정이 만든 finding(심각도 무관)과 놓친 `blocker`·`major`
   - C) 전체 diff를 처음부터 다시 판단해 나온 모든 finding
2. 두 round의 finding이 같은 지적인지 판정하는 기준은?
   - A) `<category>:<brief_clause>:<file>#<symbol>` 형태의 정규화된 fingerprint
   - B) reviewer가 붙인 finding id 문자열
   - C) 지적한 파일과 줄 번호
3. 이미 critical recovery를 한 번 시작한 task에 다시 시작 기록을 하면?
   - A) coordinator가 사용자에게 새 ACQ를 연다
   - B) `critical-recovery-exhausted`로 거절하고 ledger를 쓰지 않는다
   - C) 이전 기록을 새 findings로 덮어쓴다
4. Plan context review finding은 execute review finding과 어떻게 구분되는가?
   - A) 두 리뷰가 같은 fingerprint namespace를 쓴다
   - B) severity 값의 범위가 다르다
   - C) G18은 `context:` 접두를 요구하고 G14는 그 접두를 거부한다
5. 이번 드라이브에서 TASKS-004가 처음 멈춘 원인은?
   - A) integration branch로 cherry-pick할 때 충돌이 났다
   - B) worker가 `affected_paths` 밖의 파일을 고쳤다
   - C) worker 사본 brief에 `verify: npm run ci`가 빠져 `npm test` 증적만 기록됐다

## 이해 상태
점수 3/5 (범위 `develop..3a5497b`).

| 문항 | 정답 | 응답 | 결과 |
| --- | --- | --- | --- |
| 1 | B | A | 오답 |
| 2 | A | B | 오답 |
| 3 | B | B | 정답 |
| 4 | C | C | 정답 |
| 5 | C | C | 정답 |

처리: coordinator 복구 한도, context namespace, TASKS-004 정지 원인은 이해했다. 다시 볼 곳은 두 가지다. delta round는 수정이 만든 finding과 놓친 `blocker`·`major`만 새로 채택하고, 수정과 무관한 `minor`는 받지 않는다. 같은 지적인지는 reviewer가 붙인 id가 아니라 정규화된 fingerprint `<category>:<brief_clause>:<file>#<symbol>`로 가린다(`scripts/src/lib/validate-sections.ts`).

## Tasks

### Task 001

#### Goal & intent

Execute review 문서의 `bouncer.review.findings[]`와 `rounds[]`에 finding 정체성(fingerprint), 수정 필요 여부(actionability), 발견 경로(origin), review target, round mode를 기록하게 한다. Execute gate의 G14는 이 수렴 계약을 어긴 문서를 거부한다. `mode`가 없는 기존 review 문서는 현재 판정을 그대로 받는다.

수용 기준은 G14 회귀 테스트 통과와 `npm run ci` 성공이다.

#### Interface

- 제공: finding 필드 `category`, `brief_clause`, `file`, `symbol`, `fingerprint`, `actionability`(`must_fix | advisory`), `origin`(`discovery | introduced_by_revision | missed_critical`), `first_seen_round`, `last_seen_round`.
- 제공: round 필드.
  ```yaml
  rounds:
    - round: 1
      mode: discovery            # discovery | delta | critical_recovery
      target: { base: <sha>, head: <sha>, brief_revision: <string>, verify: passed }
      perspectives:
        - { name: spec_scope, target_head: <sha> }   # spec_scope | correctness_tests | minimality_maintainability | security
      severity_changes:
        - { fingerprint: <fp>, from: minor, to: major, reason: <text> }
      previous_finding_ids: []   # 기존 필드 유지
      new: 0
      resolved: 0
      regressed: 0
  ```
- 제공: fingerprint 정규형 `<category>:<brief_clause>:<file>#<symbol>`. 각 구성요소의 앞뒤 공백을 지우고 `category`·`brief_clause`는 소문자, `file`은 앞의 `./`를 뗀 POSIX 상대 경로로 정규화한다. 계산은 `validate-sections.ts`의 export 함수 `findingFingerprint({ category, brief_clause, file, symbol }, namespace?)`가 소유한다. `namespace`는 TASKS-005가 쓴다.
- 제공: `rounds[]`에 `mode`가 하나라도 있으면 새 계약이 전부 적용된다.
  - 모든 finding에 위 아홉 필드가 필수이고, 모든 round에 `mode`·`target.base`·`target.head`와 기존 `previous_finding_ids`·`new`·`resolved`·`regressed`가 필수다.
  - round mode 순서는 `discovery`, `discovery → delta`, `discovery → delta → critical_recovery → delta` 가운데 하나다.
  - Delta round에서 처음 본 finding은 `introduced_by_revision`(심각도 무관) 또는 `missed_critical`(`blocker`·`major`만)이어야 한다.
  - Review target의 실제 Git 일치는 controller가 증언하고, gate는 기록된 값들이 서로 일치하는지만 검사한다.
- 거부(G14 메시지, 새 G 번호 없음):
  ```text
  review finding <id> <field> missing             mode 계약의 필수 필드 누락
  review finding <id> fingerprint mismatch        fingerprint가 구성요소의 정규형과 다름
  review duplicate fingerprint <fp>               두 finding이 같은 fingerprint
  review finding <id> fingerprint namespace invalid   execute finding에 'context:' 접두
  review finding <id> actionability invalid       enum 밖
  review finding <id> origin invalid              enum 밖
  review round <n> target invalid                 target.base·head 누락
  review round <n> perspective invalid <name>     perspectives 이름이 enum 밖
  review round <n> target mismatch <name>         perspectives[].target_head ≠ target.head
  review rounds sequence invalid                  mode 순서가 허용 순서가 아님
  review finding <id> delta origin not allowed    delta 신규 finding이 discovery origin이거나 missed_critical인데 blocker·major가 아님
  review accepted with open must_fix <id>         review status accepted인데 must_fix가 resolved가 아님
  ```

#### Do not touch

- `references/review/` — reviewer 호출 계약은 TASKS-002·003 소관이다
- `agents/bouncer-reviewer.md` — reviewer 출력 계약은 TASKS-002 소관이다
- `scripts/src/lib/validate-structural.ts` — S 코드 판정 범위를 바꾸지 않는다

### Task 002

#### Goal & intent

Reviewer 호출 계약을 `discovery`와 `delta` 두 모드로 나눈다. Discovery reviewer는 고정 target에서 배정된 관점 하나만 판단하고 다른 reviewer의 finding을 받지 않는다. Delta reviewer는 이전 finding의 해결 여부와 revision diff가 만든 regression만 판단한다. 모든 finding은 TASKS-001의 fingerprint 구성요소와 origin을 함께 보고한다.

수용 기준은 agent 계약 테스트 통과와 `npm run ci` 성공이다.

#### Interface

- 제공: `references/review/assets/reviewer-prompt.md`에 새 placeholder `{{MODE}}`, `{{PERSPECTIVE}}`, `{{TARGET}}`(base, head, brief revision, latest verify)를 둔다. `{{PREVIOUS_FINDINGS}}`, `{{RESOLUTION}}`, `{{REVISION_DIFF}}`는 delta 모드에서만 채운다.
- 제공: 관점별 판단 범위.
  ```text
  spec_scope                  Missing / Extra / Misunderstood / Constraint breach
  correctness_tests           로직 결함, 계약·테스트 파손, 오류 처리, 동작 변경 테스트 누락
  minimality_maintainability  과잉 설계, 비자명 로직의 설명 주석, 구조
  security                    공개 입력 검증, 인증·권한 우회, credential·민감 데이터 노출·기록,
                              shell·경로 주입. controller가 해당 변경이 있을 때만 배정
  ```
- 제공: finding 출력 필드 `id`, `relation`, `severity`, `category`, `brief_clause`, `file`, `symbol`, summary, evidence, `origin`, actionability hint(`must_fix | advisory`, advisory only).
- 제공: delta 모드 규칙.
  - 변경하지 않은 코드에서 새 `minor`·`nit`를 보고하지 않는다.
  - 신규 finding은 revision diff에 근거가 있는 `introduced_by_revision`(심각도 무관), 또는 false acceptance를 만들 수 있는 `missed_critical` `blocker`·`major`만 보고한다.
  - 각 신규 finding에 origin 근거(revision diff 위치 또는 false acceptance 경로)를 붙인다.
- 거부: discovery reviewer가 배정 관점 밖의 finding을 보고하는 것, delta reviewer가 origin과 근거 없이 신규 finding을 보고하는 것은 계약 위반이다. Reviewer는 status를 바꾸거나 `review.md`를 편집하지 않는다.

#### Do not touch

- `agents/bouncer-context-reviewer.md` — plan context review는 TASKS-005 소관이다
- `references/review/index.md` — controller 절차는 TASKS-003 소관이다
- `skills/` — execute 전이는 TASKS-003 소관이다
- `scripts/` — gate 판정은 TASKS-001 소관이다

### Task 003

#### Goal & intent

Execute review를 `freeze target → parallel discovery → aggregate and disposition → single fix batch → verify → delta certification → accepted | critical recovery | blocked` 상태 전이로 실행한다. 이 절차는 BP001이 만든 `skills/bouncer-execute/references/review-round.md`와 `references/review/index.md`가 소유한다. Execute 본문 step 5와 run 본문에는 진입 조건과 상한 요약만 남긴다.

수용 기준은 execute·run 스킬 테스트와 정본 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: controller 절차.
  ```text
  1 freeze    base·HEAD·task brief revision·latest verify를 target으로 고정. discovery가 끝날 때까지 구현 수정 금지
  2 discover  spec_scope, correctness_tests, minimality_maintainability를 병렬 dispatch(security는 조건부)
  3 aggregate 증거 검증 → fingerprint 병합 → severity_changes 기록 → actionability 결정(must_fix | advisory)
  4 fix       must_fix 전체를 담은 repair brief로 implementer 1회 dispatch
  5 verify    latest verify 재실행
  6 certify   delta reviewer 1회 dispatch(이전 finding + revision diff)
  7 outcome   must_fix 모두 resolved + verify 통과 → accepted
              신규 blocker·major(허용 origin) → drive: critical recovery / standalone: 열린 finding을 사용자에게 보고하고 /bouncer-plan으로 안내
              revision이 만든 minor·nit → controller가 advisory로 기록하거나, 정확성에 영향이 있으면 must_fix로 두고 blocked
              finding 간 충돌, 새 설계·dependency·public Interface 필요 → blocked
  ```
- 제공: `advisory` finding은 한 번 기록하고(`accepted` 또는 `deferred`와 note) 수정 dispatch를 추가하지 않는다.
- 제공: controller는 reviewer의 actionability hint를 그대로 채택하지 않고 brief, 증거, 변경 범위로 결정한다. Finding 수나 reviewer 다수결로 채택하지 않는다.
- 거부: 현재 task 정확성에 영향을 주는 finding을 `advisory`로 낮추지 않는다. Discovery reviewer에게 다른 reviewer의 finding을 넘기지 않는다. Finding마다 implementer를 따로 dispatch하지 않는다. Delta certification 뒤 전체 discovery를 다시 실행하지 않는다.

#### Do not touch

- `agents/bouncer-reviewer.md` — TASKS-002가 확정한 reviewer 계약을 유지한다
- `scripts/` — gate와 ledger는 TASKS-001·004 소관이다
- `agents/bouncer-coordinator.md` — drive recovery 한도는 TASKS-004 소관이다

### Task 004

#### Goal & intent

Drive에서 delta certification이 새 `blocker`·`major`를 확인하면 coordinator가 critical recovery를 task당 한 번만 기록하고 dispatch한다. `/bouncer-run`의 start-drive 승인이 이 한 번을 포함하므로 추가 ACQ는 없다. 두 번째 시도는 CLI가 거절하고, 결과는 ledger 결정 로그에 남는다.

수용 기준은 coordinator core·CLI 회귀 테스트 통과와 `npm run ci` 성공이다.

#### Interface

- 제공: 시작 기록.
  ```bash
  bouncer coordinate critical-recovery --blueprint <dir> --task <ddd> \
    --findings <id> [--findings <id>]... --reason <text>
  ```
  integration worktree cwd에서 실행하고 task 항목에 `criticalRecovery: { used: 1, findings, reason, outcome: null }`을 쓰며 같은 내용을 `decisions`에 append한다.
- 제공: 결과 기록.
  ```bash
  bouncer coordinate critical-recovery --blueprint <dir> --task <ddd> --outcome <resolved|blocked> --reason <text>
  ```
  `criticalRecovery.outcome`을 채우고 결정 로그에 append한다.
- 제공: `validateCoordinatorLedger`는 `status` 조기 반환보다 앞에서 모든 task의 `criticalRecovery.used ≤ 1`과 필드 형태를 검사한다. `critical-recovery` 명령은 ledger를 읽은 직후 이 검증을 호출하고, 실패하면 쓰지 않고 그 reason을 반환한다.
- 거부:
  ```text
  critical-recovery-exhausted    이미 used 1인 task에 시작 기록
  critical-recovery-not-started  시작 기록 없이 결과 기록
  critical-recovery-closed       outcome이 이미 있는 task에 결과 기록
  illegal-transition             task status가 prepared가 아님
  findings-required              --findings 누락 또는 값 없는 --findings
  reason-required                --reason 누락
  ```
  모든 거절은 ledger와 task 문서를 쓰지 않는다.

#### Do not touch

- `skills/bouncer-execute/references/review-round.md` — 전이 절차는 TASKS-003이 확정했다
- `skills/bouncer-run/SKILL.md` — run 상한 문구는 TASKS-003이 확정했다
- `scripts/src/lib/validate-gates.ts` — gate 판정은 TASKS-001이 끝냈다
- `scripts/src/lib/commit.ts` — commit 계약은 바뀌지 않는다

### Task 005

#### Goal & intent

Plan context review도 execute와 같은 수렴 구조로 바꾼다. 같은 계획 snapshot을 네 관점에서 병렬 판단하고, controller가 finding을 합쳐 계획 문서를 한 번 수정한 뒤, 수정한 문서와 이전 finding만 delta로 인증한다. Context review finding은 execute review와 다른 fingerprint namespace를 쓰며 G18이 같은 정체성 규칙을 검사한다.

수용 기준은 context review 계약 테스트와 G18 회귀 테스트 통과, `npm run ci` 성공이다.

#### Interface

- 제공: 관점 `cross_document`, `scope`, `korean_quality`, `success_criteria`. 기존 네 판단 범위를 관점 단위 dispatch로 나눈다.
- 제공: context finding 필드와 값 매핑.
  ```text
  category       관점 이름(cross_document | scope | korean_quality | success_criteria)
  brief_clause   finding이 걸린 문서 절, 예 'tasks/002 Interface', 'epic Success criteria 4'
  file           계획 문서의 저장소 상대 경로
  symbol         절 제목 slug. 절이 없으면 '-'
  fingerprint    'context:' + <category>:<brief_clause>:<file>#<symbol> (findingFingerprint의 namespace 인자)
  actionability  must_fix | advisory
  origin         discovery | introduced_by_revision | missed_critical
  first_seen_round, last_seen_round
  ```
- 제공: `bouncer.context_review.rounds[]`의 `round`, `mode`(`discovery | delta`), `target: { digest }`, `perspectives: [{ name, target_digest }]`, `severity_changes`. `digest`는 controller가 계산하는 sha256이다. 입력은 epic `index.md`, blueprint `index.md`, `tasks/<NNN>/tasks.md`(번호 오름차순)의 frontmatter를 뺀 본문을 그 순서로 이은 값이다. Gate는 기록된 값들의 일치만 검사한다.
- 제공: `rounds`에 `mode`가 있으면 위 finding 필드가 필수이고, mode 순서는 `discovery` 또는 `discovery → delta`다. Delta 신규 finding의 origin 규칙은 TASKS-001과 같다.
- 거부(G18 메시지, 새 G 번호 없음):
  ```text
  context-review finding <id> <field> missing
  context-review finding <id> fingerprint mismatch / namespace invalid
  context-review duplicate fingerprint <fp>
  context-review round <n> perspective invalid <name> / target mismatch <name>
  context-review rounds sequence invalid
  context-review finding <id> delta origin not allowed
  ```
  G18은 `context:` 접두가 없는 fingerprint를 거부한다(TASKS-001의 G14는 접두 있는 fingerprint를 거부한다).

#### Do not touch

- `agents/bouncer-reviewer.md` — execute reviewer 계약은 TASKS-002가 확정했다
- `skills/bouncer-plan/SKILL.md` — plan 본문 구조는 BP001이 확정했다
- `scripts/src/lib/coordinator.ts` — plan review는 ledger를 쓰지 않는다
