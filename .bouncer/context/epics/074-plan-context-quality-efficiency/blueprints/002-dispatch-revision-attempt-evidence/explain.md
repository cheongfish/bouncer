---
type: bouncer.explain
title: Dispatch revision과 attempt 증적 explain
description: Explain for blueprint 002 dispatch attempt evidence
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/002-dispatch-revision-attempt-evidence/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-21T09:10:53.980+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '074'
  blueprint_id: '002'
  status: published
  task_commits:
    - task: EPIC-074/BP-002/TASK-001
      sha: 612bf5a9
      intent_anchor: task-001
    - task: EPIC-074/BP-002/TASK-002
      sha: 13058c8a
      intent_anchor: task-002
  comprehension:
    - range_from: develop
      range_to: 1bb15899a91d45e966204da69be1427b602e6b32
      diff_sha: 0fc1baf538c2505770a6c05129e24a96d4d0a7779888ee6f8722d00f9b7ab54f
      quiz_score: 4/4
      disposition: all four answers matched the drive contract (accepted+hash, stale-report keep, Brief revision metadata, native-profile scope widen)
      recorded_at: '2026-09-21T09:14:16+09:00'
  coordinator:
    base: 3d5734d184b55ee6b305d0b7f0463f1b1bcb2b68
    integration_head: 1bb15899a91d45e966204da69be1427b602e6b32
    integration_branch: feat/074-002-dispatch-revision-attempt-evidence
    revision: r2
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/002/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/002/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/002/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 612bf5a9f77751e0c648448624aa35fee45ecd1d
        branch: bouncer/074-002-001
        scope_revision: r2
        paths:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
          - test/native-profile-e2e.test.js
        actual_paths:
          - scripts/lib/cli-git-commands.js
          - scripts/lib/coordinator.js
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/runtime-state.ts
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
          - test/coordinator.test.js
          - test/native-profile-e2e.test.js
          - test/runtime-state.test.js
      - id: '002'
        status: integrated
        sha: 13058c8a6510b3fe3a9a0d7940c43afb5c33226f
        branch: bouncer/074-002-002
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-implementer.toml
          - agents/bouncer-coordinator.md
          - agents/bouncer-implementer.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/review-round.md
          - skills/bouncer-execute/references/verification-recovery.md
          - test/agents.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-bouncer-run.test.js
    decisions:
      - task: '001'
        kind: scope
        reason: 'verify npm test fails: native-profile lifecycle fixture still calls coordinate record without dispatch+accepted report; must update fixture for accepted-report-required gate'
        previous:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
        next:
          - test/native-profile-e2e.test.js
        revision: r1
      - task: '001'
        kind: scope
        reason: restore full union after r1 replaced scope; keep original runtime/CLI/test paths plus native-profile fixture required by npm test
        previous:
          - test/native-profile-e2e.test.js
        next:
          - scripts/src/lib/coordinator.ts
          - scripts/lib/coordinator.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - scripts/src/lib/cli-git-commands.ts
          - scripts/lib/cli-git-commands.js
          - test/coordinator.test.js
          - test/coordinator-e2e.test.js
          - test/cli-coordinate.test.js
          - test/runtime-state.test.js
          - test/native-profile-e2e.test.js
        revision: r2
      - task: '001'
        decision: 'accepted: implementer delivered dispatch/report attempt evidence; scope r2 includes native-profile fixture; review CT-001/CT-002 resolved; verify npm test passed; paths: scripts/src/lib/coordinator.ts, scripts/lib/coordinator.js, scripts/src/lib/runtime-state.ts, scripts/lib/runtime-state.js, scripts/src/lib/cli-git-commands.ts, scripts/lib/cli-git-commands.js, test/coordinator.test.js, test/coordinator-e2e.test.js, test/cli-coordinate.test.js, test/runtime-state.test.js, test/native-profile-e2e.test.js'
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 5522a4b74e8a30c1d772843f86d5cdbfc595d7870c3f1cae39a1e97231526110
        base_head: f5433561bdec44164b37435bb649b3d6dc0a08e5
        initial_worktree_state: |
          ?? .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/002-dispatch-revision-attempt-evidence/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 5522a4b74e8a30c1d772843f86d5cdbfc595d7870c3f1cae39a1e97231526110
        outcome: accepted
        summary: implementer wired dispatch metadata through agents/skills/tests; Brief revision matches attempt 1; npm test 1397 pass; scope none
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 16d87ab68c02a9ad9c532ad04e72afc3464e9c1971b2fbb04077153809c36135
        base_head: 13058c8a6510b3fe3a9a0d7940c43afb5c33226f
        initial_worktree_state: |
          ?? .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/002-dispatch-revision-attempt-evidence/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 16d87ab68c02a9ad9c532ad04e72afc3464e9c1971b2fbb04077153809c36135
        outcome: accepted
        summary: redispatch after controller status flip invalidated attempt-1 brief hash; work already committed on worker; Brief revision matches attempt 2
      - task: '002'
        decision: 'accepted: task 002 commit 13058c8a6510b3fe3a9a0d7940c43afb5c33226f after redispatch attempt 2 (status flip invalidated prior hash); paths agents/, .codex/agents/, skills/bouncer-execute/, test/agents.test.js, test/skill-bouncer-execute.test.js, test/skill-bouncer-run.test.js'
---
# Explain

## Background
Coordinator는 worker HEAD만 기록하고, 그 HEAD가 어떤 task brief와 몇 번째 dispatch에서 나왔는지는 남기지 않았다. 늦게 도착한 보고나 brief 수정 뒤의 보고가 그대로 `coordinate record`에 들어가면 stale 작업이 승인된 것처럼 보일 수 있다. 이 blueprint는 implementer 호출 직전에 attempt·brief hash·시작 HEAD·working-tree 상태를 원장에 남기고, 보고가 그 값과 맞을 때만 accepted/record로 넘기도록 했다.

Drive에서 TASKS-001은 처음에 열었던 affected_paths로 시작하고, `npm test`가 `test/native-profile-e2e.test.js`에서 `accepted-report-required`로 깨져 scope를 r1→r2로 넓혔다(원장에 이유 기록). TASKS-002는 같은 runtime 계약을 agents·execute skill·generated TOML에 연결했다.

## Intuition
호출 전에 “몇 번째 시도·어떤 brief 바이트”를 봉인하고, 보고가 그 봉인을 되돌려줄 때만 문을 연다.

## Code
- Runtime/CLI: `scripts/src/lib/coordinator.ts`의 `coordinate dispatch` / `report` / `record` 사전조건, `scripts/src/lib/runtime-state.ts` ledger shape, `scripts/src/lib/cli-git-commands.ts` 공개 동사.
- 역할·workflow: `agents/bouncer-coordinator.md`, `agents/bouncer-implementer.md`, `skills/bouncer-execute/references/agent-dispatch.md` (및 review-round / verification-recovery), generated `.codex/agents/*.toml`.
- 회귀: `test/coordinator*.test.js`, `test/cli-coordinate.test.js`, `test/runtime-state.test.js`, `test/native-profile-e2e.test.js`, `test/agents.test.js`, `test/skill-bouncer-execute.test.js`, `test/skill-bouncer-run.test.js`.

통합 HEAD `1bb15899`에 worker `bouncer/074-002-001`@`612bf5a9`와 `bouncer/074-002-002`@`13058c8a`가 반영됐다. TASKS-001 actual_paths는 r2 scope와 같다.

## Quiz
1. `coordinate record`가 worker HEAD를 저장하려면 직전 report outcome과 brief hash가 각각 무엇을 만족해야 하는가?
   - A) outcome이 `accepted`이고, record 시점 task brief SHA-256이 dispatch 때 hash와 같다
   - B) outcome이 `rework`여도 되고, hash는 trim된 frontmatter만 비교한다
   - C) outcome 검사 없이 worker HEAD가 branch tip이면 통과한다

2. attempt/hash가 활성 dispatch와 다른 report가 오면 coordinator는 어떻게 하는가?
   - A) 활성 attempt를 닫고 task를 `recorded`로 올린다
   - B) `stale-report` 결정을 남기고 활성 attempt는 유지한다
   - C) 조용히 무시하고 ledger를 쓰지 않는다

3. Implementer Output의 `Brief revision`이 담아야 하는 값은?
   - A) 직전에 읽은 commit subject와 PR 번호
   - B) dispatch로 받은 `attempt`와 `task_brief_hash`
   - C) 전체 coordinator ledger JSON

4. TASKS-001 drive에서 scope가 r2로 넓어진 직접 이유는?
   - A) `test/native-profile-e2e.test.js`가 dispatch+accepted report 없이 record를 호출해 `npm test`가 실패했다
   - B) plugin CLI에 dispatch 동사가 없어 plan을 다시 썼다
   - C) TOML byte equality가 깨져 agents를 전부 열었다

## 이해 상태
- 응답: 1A, 2B, 3B, 4A · 정답: 1A, 2B, 3B, 4A · 결과: 4/4 정답
- disposition: accepted+matching hash, stale-report 유지, Brief revision=attempt+hash, native-profile fixture로 scope r2 — 전부 일치
- range: develop..1bb15899 · quiz_score: 4/4

## Tasks

### Task 001

#### Goal & intent

Coordinator CLI가 implementer를 부르기 직전 task별 dispatch attempt를 열고 시작 HEAD·working-tree 상태·현재 brief hash를 한 원장 revision에 기록한다. 보고의 attempt/hash가 활성 dispatch와 다르면 stale 결정을 남기며, 일치하고 coordinator가 `accepted`로 판정한 보고만 `coordinate record`에 도달한다.

#### Current behavior

- `scripts/src/lib/coordinator.ts:500-946`의 `coordinate()`는 `prepare`에서 worker worktree와 `prepared` 상태를 만들고 `record`에서 현재 worker HEAD만 확인한다. 어떤 brief와 몇 번째 dispatch가 그 HEAD를 만들었는지는 ledger에 없다.
- `scripts/src/lib/intent-bundle.ts:276-341`의 `loadExecutionTask()`는 canonical `tasks.md` bytes를 SHA-256으로 계산하며 `bouncer intent bundle`이 `task_brief_hash`로 반환한다. coordinator record는 이 값을 받거나 다시 확인하지 않는다.
- `scripts/src/lib/cli-git-commands.ts:206-310`의 `cmdCoordinate()`는 `dispatch`와 `report` 동사를 제공하지 않는다.
- 현재 회귀는 다음 명령으로 확인한다. 이 명령에는 dispatch attempt, stale report, accepted-report-before-record 사례가 없다.

```bash
node --test test/coordinator.test.js test/cli-coordinate.test.js test/runtime-state.test.js
```

#### Target behavior

- 성공: `coordinate dispatch`는 `prepared` commit task의 할당 worker에서 attempt를 1 증가시키고 task 문서 bytes의 SHA-256, worker HEAD, `git status --porcelain=v1` 출력을 저장·반환한다. 이전 reported attempt가 있으면 그 outcome과 summary를 `previous_outcome`으로 반환한다.
- 성공: `coordinate report`는 활성 attempt와 같은 양의 정수 `attempt`, 64자리 소문자 hex `task_brief_hash`를 받은 뒤 outcome과 non-empty summary를 기록하고 상태를 `reported`로 바꾼다.
- 성공: `coordinate record`는 최신 report outcome이 `accepted`이고 record 시점의 task brief hash가 dispatch hash와 같을 때만 기존 worker HEAD 검사를 수행한다.
- 실패: 중복 dispatch, 활성 attempt가 없는 report, 잘못된 metadata shape를 거부한다. attempt/hash mismatch는 `stale-report` 결정을 append하되 활성 dispatch를 유지한다.
- 실패: accepted report 뒤 task brief가 바뀌면 record를 `stale-worker-report`로 거부한다.
- 보존: 기존 worktree 경계, worker HEAD 소유권 검사, task 전이 `prepared → recorded`, repair/critical-recovery/partial-close 계약은 그대로 둔다.

#### Interface

- 제공:

```text
bouncer coordinate dispatch --blueprint <dir> --task <ddd> [--repo <main>]
bouncer coordinate report --blueprint <dir> --task <ddd> --attempt <n>
  --task-brief-hash <sha256>
  --outcome <accepted|rework|scope_revision|task_change|blocked>
  --summary <text> [--repo <main>]
```

  `dispatch` 출력의 metadata shape는 `{ attempt: number, task_brief_hash: string, base_head: string, initial_worktree_state: string, previous_outcome?: { outcome: string, summary: string } }`다. `initial_worktree_state`는 dispatch 직전 `git status --porcelain=v1` stdout 원문이며 clean worktree는 빈 문자열이다. `report` 성공은 저장한 attempt와 report 결정을 반환한다.
- 거부: 두 명령은 할당된 worker worktree 밖에서 실행할 수 없다. `dispatch`는 commit task의 `prepared` 상태와 비활성 최신 attempt만 받는다. `report`는 활성 attempt, 양의 정수 attempt, 64자리 소문자 hex hash, 열거된 outcome, non-empty summary만 받는다. report mismatch는 `stale-report` reason과 expected/received를 반환하고 활성 attempt를 닫지 않는다. Accepted report 뒤 record 시점의 brief hash가 바뀐 경우에만 `stale-worker-report`를 반환한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `Task`, `coordinate`, dispatch/report decision types | Modify | coordinator 상태 전이와 ledger 쓰기를 담당한다. | dispatch metadata 생성, report 판정, stale decision, record 사전조건을 추가한다. | worker worktree·ledger·record 경계를 함께 소유하는 정본이다. |
| `scripts/lib/coordinator.js` | generated coordinator runtime | Modify | TypeScript 정본의 실행 산출물이다. | `npm run build`로 dispatch/report runtime을 반영한다. | CLI가 실제로 불러오는 CommonJS와 정본을 일치시켜야 한다. |
| `scripts/src/lib/runtime-state.ts` | `validateCoordinatorLedger` | Modify | coordinator ledger의 지속 상태 shape를 검증한다. | 최신 dispatch attempt와 outcome shape를 검증한다. | 손상 ledger가 재개 기준이 되는 것을 막는 검증점이다. |
| `scripts/lib/runtime-state.js` | generated ledger validation | Modify | TypeScript 정본의 실행 산출물이다. | `npm run build`로 dispatch ledger 검증을 반영한다. | runtime CLI가 사용하는 CommonJS 검증과 정본을 맞춘다. |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, coordinate usage | Modify | coordinate 동사와 argv를 runtime core에 전달한다. | `dispatch`·`report` 동사와 report metadata flags를 파싱한다. | 공개 CLI 계약과 usage 거절을 소유한다. |
| `scripts/lib/cli-git-commands.js` | generated coordinate CLI | Modify | TypeScript 정본의 실행 산출물이다. | `npm run build`로 새 동사와 flag 전달을 반영한다. | 사용자가 실행하는 CommonJS CLI와 정본을 맞춘다. |
| `test/coordinator.test.js` | dispatch/report/record state tests | Modify | coordinator core의 전이와 Git 경계를 검증한다. | 최초·재시도 metadata, stale 보고, brief 변경 뒤 record 거부를 검증한다. | runtime 불변조건을 함수 단위로 고정한다. |
| `test/coordinator-e2e.test.js` | coordinator drive record fixtures | Modify | bootstrap부터 record·integrate까지 실제 Git drive를 검증한다. | 기존 record 경로가 dispatch와 accepted report를 먼저 거치도록 fixture를 갱신한다. | 새 record 사전조건이 실제 drive 순서에서도 지켜지는지 검증한다. |
| `test/cli-coordinate.test.js` | coordinate CLI contract tests | Modify | coordinate 공개 argv와 exit code를 검증한다. | 필수 flag, outcome enum, stale reason, worker cwd 경계를 검증한다. | CLI가 core 계약을 누락하거나 다른 값으로 전달하는 회귀를 막는다. |
| `test/runtime-state.test.js` | `validateCoordinatorLedger` fixtures | Modify | 유효·손상 coordinator ledger fixture를 검증한다. | dispatch attempt shape와 invalid state 사례를 추가한다. | 재개 시 손상 metadata를 정상으로 읽는 회귀를 막는다. |
| `test/native-profile-e2e.test.js` | native-profile lifecycle fixture | Modify | 실제 CLI lifecycle에서 coordinate record를 호출한다. | dispatch와 accepted report 뒤에만 record하도록 fixture를 갱신한다. | npm test가 accepted-report-required로 실패하지 않게 한다. |

#### Constraints

- `task_brief_hash`는 canonical task 문서의 전체 bytes에 대한 SHA-256이다. trim, frontmatter 재직렬화, 선택 절 hash로 바꾸지 않는다.
- coordinator가 `dispatch`와 `report` 결정을 append할 때 기존 decisions 순서와 재개 가능성을 유지한다.
- `initial_worktree_state` 수집은 read-only Git argv 호출이어야 하며 shell 문자열이나 자동 baseline 검사를 추가하지 않는다.
- stale 보고는 활성 attempt를 종료하거나 task 상태를 `recorded`로 바꾸지 않는다.
- TypeScript를 먼저 수정하고 `npm run build`로 CommonJS를 생성한 뒤 `git add`로 생성물을 staging하고 `npm run check:emit`을 실행한다.

### Task 002

#### Goal & intent

Coordinator와 execute workflow가 TASKS-001의 dispatch metadata를 named implementer와 generic fallback에 같은 shape로 전달한다. Implementer는 `attempt`와 `task_brief_hash`를 `Brief revision`으로 반환하며, coordinator는 보고를 판정해 `coordinate report`를 기록하기 전까지 task brief를 수정하지 않는다.

#### Current behavior

- `agents/bouncer-coordinator.md:91-127`은 current brief와 worker cwd를 전달하고 결과 SHA를 record하라고 하지만 attempt 생성, 실행 중 brief 동결, stale report 판정을 정의하지 않는다.
- `agents/bouncer-implementer.md:14-31,136-153`은 `task_brief_hash`를 advisory input으로 받을 수 있으나 Output contract에서 그 값을 돌려주지 않는다.
- `skills/bouncer-execute/references/agent-dispatch.md:3-56`은 named/fallback에 같은 bundle identifiers를 전달하지만 `attempt`, `base_head`, `initial_worktree_state`, `previous_outcome`을 전달하지 않는다.
- `.codex/agents/bouncer-{coordinator,implementer}.toml`은 Markdown 역할 문서의 `mdToCodexToml()` 산출물이며 `test/agents.test.js`가 byte equality를 검사한다.
- 현재 계약 테스트는 다음 명령으로 재현하며 새 dispatch/report 필드를 요구하지 않는다.

```bash
node --test test/agents.test.js test/skill-bouncer-execute.test.js test/skill-bouncer-run.test.js
```

#### Target behavior

- 성공: coordinator는 implementer 호출 직전에 `coordinate dispatch`를 실행하고 반환된 다섯 metadata field만 current brief와 함께 전달한다. 최초 attempt에는 `previous_outcome`이 없다.
- 성공: implementer는 Output contract의 `Brief revision`에 받은 `attempt`와 `task_brief_hash`를 그대로 반환한다. coordinator는 보고를 판정한 뒤 같은 값, outcome, summary로 `coordinate report`를 호출한다.
- 성공: coordinator가 `rework`, `scope_revision`, `task_change`를 기록한 뒤 재디스패치하면 runtime이 증가한 attempt와 `previous_outcome`을 제공한다.
- 실패: 보고에 revision 값이 없거나 dispatch 값과 다르면 coordinator는 accepted/record를 호출하지 않고 stale 결과로 기록한다.
- 보존: named implementer compact payload는 generated TOML byte match를 전제로 하며 fallback은 역할 본문 전체를 받는다. 두 경로 모두 같은 metadata를 받고 다른 task·ledger·과거 대화는 받지 않는다.
- 보존: debugger/reviewer bundle identifiers, implementer의 scope·commit·status 금지, named-agent fallback 경계는 유지한다.

#### Interface

- 제공: implementer dispatch payload에 `attempt`, `task_brief_hash`, `base_head`, `initial_worktree_state`, 조건부 `previous_outcome`을 넣는다. `previous_outcome` shape는 `{ outcome, summary }`이며 TASKS-001 `coordinate dispatch` 출력 그대로 사용한다. Implementer Output contract는 `**Brief revision**: attempt와 task_brief_hash` 한 항목을 추가한다.
- 거부: coordinator는 report의 두 revision 값이 dispatch metadata와 다르거나 빠졌을 때 `coordinate report --outcome accepted`와 `coordinate record`를 호출하지 않는다. Implementer 실행 중에는 해당 task brief를 수정하거나 `coordinate revise`를 호출하지 않는다. 수정이 필요하면 보고를 받은 뒤 `scope_revision` outcome을 기록하고 revise한 다음 새 dispatch를 연다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `Worker dispatch`, `Procedure` | Modify | coordinator의 worker 입력, 판정, record 순서를 정한다. | dispatch/report 호출, 실행 중 brief 동결, stale 결과 처리와 재디스패치 순서를 명시한다. | drive에서 metadata를 생성하고 결과를 disposition하는 주체다. |
| `agents/bouncer-implementer.md` | `Authority`, `Output contract` | Modify | implementer 입력 권한과 반환 shape를 정한다. | dispatch metadata를 advisory evidence로 받고 `Brief revision`을 반환하게 한다. | coordinator가 diff 재독 없이 stale 여부를 판정하려면 보고 필드가 필요하다. |
| `.codex/agents/bouncer-coordinator.toml` | generated role prompt | Modify | Codex named coordinator 역할을 제공한다. | Markdown 변경을 `mdToCodexToml()`로 재생성한다. | named agent가 정본 역할과 같은 계약을 받아야 한다. |
| `.codex/agents/bouncer-implementer.toml` | generated role prompt | Modify | Codex named implementer 역할을 제공한다. | Markdown 변경을 `mdToCodexToml()`로 재생성한다. | compact named payload는 byte-identical generated role을 전제로 한다. |
| `skills/bouncer-execute/SKILL.md` | intent bundle preflight, implementer dispatch, scope revision flow | Modify | execute 역할별 payload와 재작업 순서를 조정한다. | dispatch metadata 전달, report 판정, brief 수정 뒤 새 attempt 순서를 연결한다. | 단일-task execute와 coordinator drive가 같은 revision 계약을 사용해야 한다. |
| `skills/bouncer-execute/references/agent-dispatch.md` | `Named implementer`, `Implementer fallback` | Modify | named/fallback implementer payload의 동일성 계약을 정한다. | 다섯 dispatch metadata field와 `Brief revision` 반환을 양쪽 경로에 추가한다. | payload 최소화와 fallback 동등성을 함께 판정하는 정본이다. |
| `skills/bouncer-execute/references/review-round.md` | fix implementer dispatch | Modify | review fix batch의 implementer 재디스패치 순서를 정한다. | report outcome 뒤 새 attempt를 열고 이전 outcome을 전달하는 순서를 명시한다. | review fix도 최초 dispatch와 같은 attempt 계약을 사용해야 한다. |
| `skills/bouncer-execute/references/verification-recovery.md` | debugger 뒤 implementer re-dispatch | Modify | verify 실패 뒤 debugger와 implementer의 순차 복구를 정한다. | debugger evidence를 받은 재디스패치도 report→dispatch metadata 경계를 거치게 한다. | verify 복구가 attempt를 우회하면 stale 결과를 구분할 수 없다. |
| `test/agents.test.js` | coordinator/implementer role 및 TOML 동등성 tests | Modify | 역할 경계와 generated TOML byte equality를 검증한다. | metadata 전달·반환, brief 동결, stale 거부, 재디스패치 순서를 단언한다. | 역할 문구나 생성물 한쪽이 빠지는 회귀를 잡는다. |
| `test/skill-bouncer-execute.test.js` | dispatch/revision contract tests | Modify | execute skill과 agent-dispatch reference의 필수 계약을 검증한다. | named/fallback 동일 metadata와 report→revise→dispatch 순서를 단언한다. | workflow가 runtime CLI를 건너뛰는 회귀를 막는다. |
| `test/skill-bouncer-run.test.js` | coordinator delegation contract tests | Modify | run이 coordinator 하나에게 drive를 위임하는 계약을 검증한다. | root run이 attempt metadata를 자체 생성하지 않고 coordinator 소유로 남기는지 단언한다. | controller 경계가 중복되지 않게 한다. |

#### Constraints

- dispatch metadata는 실행 증적이며 Goal & intent부터 Checklist까지 여덟 brief 절의 결정 권한을 바꾸거나 scope를 넓히지 않는다.
- named/fallback payload에 전체 coordinator ledger, 다른 task brief, 이전 worker 보고 원문, 과거 대화·commit 제목을 넣지 않는다.
- `previous_outcome`은 runtime이 반환한 직전 `{ outcome, summary }`만 전달한다. coordinator가 과거 보고를 다시 요약해 새 요구사항으로 만들지 않는다.
- implementer는 commit, push, branch, pointer 이동, document status 변경을 계속 금지한다.
- agent Markdown을 수정한 뒤 `mdToCodexToml()`로 두 TOML을 재생성하고 staging한 다음 `npm run check:emit`을 실행한다.