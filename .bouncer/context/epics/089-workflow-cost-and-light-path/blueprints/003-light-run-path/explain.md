---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/003-light-run-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T01:27:27.880+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '089'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: 169f1c915a79b81927c8ae24882d42b237657308
      range_to: 0efc55c144a9c1bb5a7ca73fcbc7fe974b3cf208
      diff_sha: 4dc7fea4b944dd2784572f2a0c2c383037ab705f184cef6ca79e2dec0c3cf73a
      recorded_at: '2026-10-10T01:28:30+09:00'
  task_commits:
    - task: EPIC-089/BP-003/TASK-001
      sha: 6d17ab2e
      intent_anchor: task-001
    - task: EPIC-089/BP-003/TASK-002
      sha: 3a90558a
      intent_anchor: task-002
    - task: EPIC-089/BP-003/TASK-003
      sha: 9f331193
      intent_anchor: task-003
    - task: EPIC-089/BP-003/TASK-004
      sha: 0efc55c1
      intent_anchor: task-004
---
# Explain

## Background

`scale: light` 블루프린트도 `/bouncer-run`이 full과 같이 coordinator·named worker 계층을 타면 비용이 크고, drive에서 light inline을 막는 규칙과 충돌한다. 이 변경은 light를 원장 `mode: light`로 구분하고, run 세션이 integration worktree에서 단일 commit task를 직접 구현·검증하며, 독립 reviewer 1세션만 검토하게 한다. 보안·범위 이탈·task 분할·Interface 의미 변경·reviewer 범위 확대 신호가 나오면 `coordinate promote-stop`으로 `promotion_stopped`를 남기고 위임을 거절한다. full → light 하향이나 승격 후 자동 재개는 없다.

## Intuition

가벼운 일은 한 책상(integration)에서 쓰고, 옆자리 reviewer 한 명만 본다. 위험하면 책상을 잠그고(`promotion_stopped`) 다시 계획한다.

## Code

- `scripts/src/lib/coordinator.ts` — `isLightEligible`, bootstrap 시 `mode: light`, light fan-in(cherry-pick 생략), `promote-stop` / `promotion_stopped` fence
- `scripts/src/lib/coordinate-next.ts` — light에서 `implement` + `inline: true`
- `scripts/src/lib/run-preflight.ts` — `promotion_stopped`이면 `delegable: false`, reason `promotion-stopped`
- `scripts/src/lib/review-dispatch.ts` — light execute review: `strategy: single`, `perspectives: ['combined']` (risk면 `security` 추가)
- `scripts/src/lib/cli-git-commands.ts` — `coordinate promote-stop` CLI
- `skills/bouncer-run/references/light-run.md` — light run 절차·금지·위험 정지
- `skills/bouncer-run/SKILL.md`, `skills/bouncer-execute/SKILL.md` — drive vs light inline 분기

## Quiz

1. light 원장(`mode: light`)은 언제 만들어지나?
   - A) `scale: light`이면 task 개수와 무관하게 bootstrap이 항상 light 원장을 만든다
   - B) `scale: light`이고 의존 없는 commit task가 정확히 1개일 때만 bootstrap이 light 원장을 만든다
   - C) `/bouncer-run` 시작 ACQ에서 사용자가 light를 고르면 기존 full 원장을 light로 바꾼다

2. light run에서 구현과 리뷰는 어떻게 갈리나?
   - A) run 세션이 integration에서 구현하고, 별도 named reviewer 1세션이 검토한다(구현 세션이 자기 diff를 승인하지 않음)
   - B) run 세션이 구현과 리뷰를 모두 인라인으로 끝낸다
   - C) light여도 항상 `bouncer-coordinator`가 named implementer·reviewer를 각각 띄운다

3. light execute review-dispatch의 기본 구성은?
   - A) full과 같이 `local` / `global` / `minimality` 세 perspective
   - B) `strategy: single`, `perspectives: ['combined']`이며, risk flag가 있으면 `security`를 붙인다
   - C) perspective 없이 `report --outcome accepted`만으로 끝난다

4. `coordinate promote-stop`이 기록하는 상태와 이후 동작은?
   - A) `partial_closed`로 바꾸고 worker worktree만 남긴다
   - B) `promotion_stopped`와 promotion 스냅샷을 남기고, light 변이·`run preflight` 위임을 거절한다(재개 명령 없음)
   - C) 원장을 지우고 pointer를 다음 블루프린트로 옮긴다

## Tasks

### EPIC-089/BP-003/TASK-001 · `6d17ab2e`

#### Goal & intent

`bouncer coordinate bootstrap`이 `bouncer.scale: light`이고 commit task가 정확히 1개이며 `depends_on`이 비어 있는 blueprint에서만 `mode: 'light'` 원장을 만든다. light 원장의 task는 `workerPath`가 integration 경로이고, `coordinate next`는 구현 행동을 `payload.inline: true`로 내서 run 세션이 직접 구현하게 한다. 수용 조건은 단일 task light가 prepare → implement(inline) → verify → review → report → record → commit → integrate → done까지 기존 fence·lease 규칙으로 진행되는 e2e 테스트 통과다.

#### Current behavior

- 구동 경로 어디도 `scale`을 읽지 않는다. light blueprint도 일반 blueprint처럼 worker worktree를 만든다. `coordinator.ts`·`coordinate-next.ts`에 `scale` 참조가 없다.
- 원장은 `coordinate bootstrap`만 만든다(`coordinator.ts:2222-2288`). 메인 체크아웃에서 `git worktree add -b`로 integration worktree를 만들고 `seedIntegration`한 뒤 `taskList()`로 원장을 쓴다. 이어받을 때는 `assertLeaseShape`만 돈다(`:2277`).
- 원장 `Ledger`는 `version, blueprint, base, integrationHead, integrationBranch, tasks[], seedManifest, decisions[], repairWaves, terminalFailure, status, userConfirmed, revision, leaseSeq, fanin`을 갖는다(`:85-100`). task는 `workerPath, branch, sha, dispatch, lease, verify_evidence_id, review_evidence_id` 등이다(`:70-80`).
- task 상태는 pending → ready → prepared → recorded → integrated다(`:319-325`). `prepareCoordinator`(`:1236-1450`)가 lease를 발급하고 worker worktree를 만든다. `dispatch`·`report`·`record`는 `checkLease`와 `item.workerPath` 등록 확인을 한다(`:2540-2552`, `:2588-2597`). `ensureIntegrationCwd`(`:1458-1463`)는 cwd가 integration 경로(task 없음) 또는 worker 경로(task 있음)여야 한다.
- `integrate`는 기록된 sha를 candidate fan-in worktree에 cherry-pick하고 검증한 뒤 CAS fast-forward 한다(`:1777-2190`).
- `coordinate next`의 task 행동은 모두 `item.workerPath`와 `dispatch.*`에 걸려 있고 `implement`는 별도 worker를 가정한다(`coordinate-next.ts:484-640`).
- 재현: `node --test test/coordinator-e2e.test.js`의 "a single task with no DAG frontmatter drives as one sequential wave"(`:411`), `test/coordinate-next.test.js`(40개), `test/run-preflight.test.js`.
- I/O 결합: `git()`이 `execFileSync`로 git을 부르고 `deps.execFileSync`로 주입된다. 원장은 `withLedgerLock`·`atomicWrite`로 쓴다. 모듈 전역 상태는 없다.

#### Target behavior

- 성공: 조건을 만족하는 light blueprint의 bootstrap은 `ledger.mode = 'light'`를 쓴다. `prepare`는 worker worktree를 만들지 않고 task의 `workerPath`를 integration 경로로 두며 lease를 그대로 발급한다. `dispatch`·`report`·`record`의 worker 등록 확인은 light 원장에서 `workerPath === integrationPath`를 허용한다. `integrate`는 cherry-pick 없이 integration HEAD를 `fanin: verified`로 기록한다. `coordinate next`의 `implement`는 `payload.inline: true`와 `cwd`가 integration 경로인 응답이다.
- 거부: `scale`이 light가 아니거나, blueprint에 task가 2개 이상(종류 무관)이거나, 그 task에 `depends_on`이 있거나, 그 task가 `execution_kind: verification`이면 `ok: false`, `reason: 'light-requires-single-task'`. 이미 `mode`가 있는 원장에 반대 모드로 bootstrap 하면 `ledger-mode-mismatch`. light 원장에서 `report --outcome accepted`는 blueprint 루트 `review.md`의 `bouncer.review.rounds[]`가 비어 있거나 문서 status가 `accepted`가 아니면 `light-review-required`. 라운드는 `bouncer review record`(`review-record.ts`)만 쓰므로 구현 세션이 손으로 쓰지 못하고, 형식은 `bouncer review record --help`가 정본이다.
- 보존: full blueprint의 bootstrap·prepare·integrate 동작과 응답, fence·lease·brief hash 규칙, `coordinate next` 읽기 전용 성질, 원장 필드의 기존 의미는 그대로다. `mode`가 없는 원장은 full로 읽는다.

#### Interface

- 제공:
  - `Ledger.mode?: 'light'`.
  - `coordinate bootstrap` 응답에 `mode: 'light'|'full'`.
  - `NextOk.payload.inline?: true` (task 범위 `implement` 행동, light 원장 한정).
  - 실패 reason: `light-requires-single-task`, `ledger-mode-mismatch`, `light-review-required`와 `COORDINATE_FAILURE_HINTS` 항목.
- 거부: 위 세 reason의 조건, 그리고 light 원장에서 worker worktree 경로가 integration 경로와 다른 `dispatch`/`record`.
- throw 대 miss: 잘못된 CLI 입력은 기존대로 사용법 오류, 위 reason은 모두 `ok: false` 응답(exit 1)이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `Ledger`, bootstrap(`:2222-2288`), `prepareCoordinator`, `ensureIntegrationCwd`, dispatch·report·record 등록 확인, `integrateCommitWave`, `COORDINATE_FAILURE_HINTS` | Modify | 원장 생성과 task 전이 | light 모드 분기와 거부 reason | 원장 소유 모듈 |
| `scripts/src/lib/coordinate-next.ts` | `taskNext`(`implement`) | Modify | 다음 행동 결정 | light에서 `payload.inline` | 행동 결정 소유 |
| `rules/cli.md` | coordinate 명령 절 | Modify | CLI 계약 | light 모드 한 단락 | CLI 문서 |
| `test/coordinator.test.js` | bootstrap·prepare 케이스 | Modify | 원장 단언 | light 생성·거부 | 계약 고정 |
| `test/coordinate-next.test.js` | `implement` 케이스 | Modify | next 단언 | `inline` 단언 | 계약 고정 |
| `test/coordinator-e2e.test.js` | 단일 task 시나리오(`:411`) | Modify | 종단 드라이브 | light 종단 시나리오 | 종단 확인 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- light 원장도 `assertLedgerFence`·`withLedgerLock`·`checkLease`를 건너뛰지 않는다. 모드는 worker 경로 확인과 cherry-pick만 바꾼다.
- 증거(verify·review)는 기존 `checkWorkerEvidence`가 integration 트리를 대상으로 쓴다. 증거를 손으로 쓰는 경로를 만들지 않는다.
- `mode`가 없는 기존 원장은 full로 읽는다(legacy 호환).
- `report accepted`의 라운드 확인은 CLI가 기록한 라운드 존재와 status로만 판정한다. 그 라운드를 독립 reviewer가 냈는지는 `skills/bouncer-run/references/light-run.md`의 절차 규칙이며 CLI가 검증하지 않는다.

### EPIC-089/BP-003/TASK-002 · `3a90558a`

#### Goal & intent

light 원장(`mode: light`)을 가진 blueprint를 `/bouncer-run`이 coordinator 없이 진행하도록 run·execute 규칙을 고친다. run 세션이 `payload.inline` 구현 행동을 직접 수행하고, 독립 named reviewer 한 세션이 사양·범위, 정확성, 회귀·테스트, 위험 변경 관점을 함께 검토한다. 수용 조건은 개정된 문서 문자열 테스트와 execute 단계 review dispatch 테스트 통과다.

#### Current behavior

- `skills/bouncer-run/SKILL.md:22-31`은 run 세션이 coordinator만 디스패치하고 구현·리뷰·디버깅을 inline으로 하지 않으며 "Even when the blueprint was declared light, do not use execute's inline branch during a drive"라고 쓴다. `:33-41`은 root 세션이 inline 구현을 하지 않는다고 쓴다.
- `skills/bouncer-execute/SKILL.md:115-118`이 같은 drive 예외를 적고, light 분기는 `:108-114`다. `references/agent-dispatch.md:22-31`은 light에서 implementer만 inline이고 reviewer·`bouncer-debugger`는 named로 유지한다. `:93`은 "/bouncer-run always retains the named orchestration boundary"다.
- `rules/subagent-model.md:61-62`, `rules/planning.md:65-66`, `:82-85`가 이 규칙을 가리킨다.
- `review-dispatch.ts` execute phase(`:285-330`)는 diff가 작으면(`EXECUTE_SMALL_MAX_FILES/LINES`) `single`/`combined`, 크면 `parallel`(`spec_scope`, `correctness_tests`, `minimality_maintainability`, 위험이면 `security`)이다. blueprint scale을 보지 않는다. `combined`는 `agents/bouncer-reviewer.md:58-71`에 정의되며 회귀·위험을 별도 관점 이름으로 갖지 않는다. `.codex/agents/bouncer-reviewer.toml`은 같은 내용의 생성 사본이다.
- 고정하는 테스트: `test/lightweight-cycle.test.js:132`, `:136-147`(run `named \`bouncer-coordinator\``, drive 예외 정규식, `/bouncer-run\` always retains the named orchestration boundary`, `execution_mode` 금지), `:125-133`(`When the pointer ... \`scale\` is \`light\`` 유지), `test/skill-bouncer-execute.test.js:173-177`·`:518-528`·`:607-612`, `test/rule-ownership.test.js:454-455`(`named agents are unavailable` 유지, planning "100 lines or fewer"), `test/skill-bouncer-surface.test.js:130-151`(합계 baseline).
- 재현: `node --test test/lightweight-cycle.test.js test/skill-bouncer-execute.test.js test/rule-ownership.test.js test/review-dispatch.test.js test/skill-bouncer-surface.test.js test/agents.test.js test/subagents.test.js`.

#### Target behavior

- 성공: light 원장이면 run이 coordinator를 부르지 않고 `skills/bouncer-run/references/light-run.md`의 절차를 따른다. 절차: `coordinate next`의 `implement`(`inline: true`)를 run 세션이 구현 → `verify` → named `bouncer-reviewer` 한 세션을 `review-dispatch execute`가 준 구성으로 호출 → 범위 내 finding은 run 세션이 수정하고 같은 reviewer 역할로 delta review → `report`/`record`/`commit`/`integrate`. run 세션은 `report --outcome accepted`의 승인자가 되지 않고 reviewer 라운드 기록을 근거로 한다.
- 단일 reviewer: `review-dispatch execute`는 선택 플래그 `--blueprint <dir>`를 받고, 그 blueprint `index.md`의 `bouncer.scale`이 light면 diff 크기와 관계없이 `strategy: 'single'`, `perspectives: ['combined']`를 내고, `combined` 정의는 사양·범위, 정확성, 회귀·테스트, 위험 변경을 명시한다. 위험 플래그가 있으면 기존대로 `security`를 접어 넣는다. reviewer는 읽기 전용이다.
- 보존: full blueprint는 coordinator와 named worker를 쓰고 drive 예외 문구도 full 경로에서 유지된다. `named agents are unavailable` 폴백, `bouncer-debugger` named 유지, 리뷰 상한(discovery·fix·delta 각 1회)은 그대로다.
- 거부: reference는 구현 세션이 reviewer 역할을 겸하거나 자기 diff를 승인하는 것을 금지한다. reference는 위험 신호(보안 위험, 범위 밖 변경, task 분할, 인터페이스 의미 변경, reviewer의 범위 확대 요구)가 나오면 run을 멈추고 사용자에게 보고하라고 적는다. 상태를 원장에 남기는 명령은 다음 task가 추가한다.

#### Interface

- 제공: `skills/bouncer-run/references/light-run.md`(신규), `review-dispatch execute`의 light 분기, `agents/bouncer-reviewer.md` `combined` 정의 보강과 생성 TOML.
- 거부: light가 아닌 원장에 reference의 inline 절차를 적용하라는 문구 없음. `execution_mode` 문자열을 도입하지 않는다.
- 정의: "독립 reviewer"는 구현을 하지 않은 별도 named 세션이다. 예: `bouncer-reviewer`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/light-run.md` | 신규 | Create | 없음 | light 실행 절차 | SKILL 단어 수 여유가 작아 reference에 둠 |
| `skills/bouncer-run/SKILL.md` | Role — delegation(`:22-41`) | Modify | drive 위임 규칙 | light 원장은 reference를 따른다는 문장으로 교체, full 규칙 유지 | 진입점 |
| `skills/bouncer-execute/SKILL.md` | Drive 예외(`:115-118`) | Modify | execute inline 예외 | light 원장 drive는 run reference 절차라는 문구 | 정본 일치 |
| `skills/bouncer-execute/references/agent-dispatch.md` | `:22-31`, `:93` | Modify | 디스패치 규칙 | named 유지 조건을 full로 한정 | 규칙 정본 |
| `rules/subagent-model.md` | `:61-62` | Modify | 예외 포인터 | 포인터 문구 정합 | 정합 |
| `rules/planning.md` | `## Lightweight cycle`(`:65-66`, `:82-85`) | Modify | light 계약 | run 경로 문구 정합 | 정합 |
| `scripts/src/lib/review-dispatch.ts` | execute phase 분류(`:285-330`) | Modify | 리뷰 구성 | `--blueprint`의 scale이 light면 single/combined | 구성 소유 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | execute 플래그 파싱, help | Modify | review-dispatch CLI | `--blueprint` 플래그 | 플래그 소유 |
| `rules/cli.md` | `review-dispatch execute` 줄 | Modify | CLI 계약 | 플래그 설명 | CLI 문서 |
| `test/rule-ownership.test.js` | planning·dispatch 핀(`:454-455`) | Modify | 규칙 소유 핀 | 정합(깨질 때만) | 문구 고정 |
| `test/agents.test.js`, `test/subagents.test.js` | reviewer 문서·TOML 단언 | Modify | 역할 문서 핀 | 정합(깨질 때만) | 문구 고정 |
| `agents/bouncer-reviewer.md` | `combined`(`:58-71`) | Modify | 리뷰어 행동 | 네 관점 명시 | 정본 |
| `.codex/agents/bouncer-reviewer.toml` | 생성 파일 | Modify | md 생성 사본 | `bouncer init --seed-codex-agents`로 재생성 | 바이트 일치 |
| `test/lightweight-cycle.test.js` | `:132`, `:136-147` | Modify | 옛 규칙 고정 | 새 규칙으로 재작성 | 문구 고정 |
| `test/skill-bouncer-execute.test.js` | `:173-177`, `:518-528` | Modify | execute 문구 핀 | 정합 | 문구 고정 |
| `test/review-dispatch.test.js` | execute 케이스 | Modify | 구성 단언 | light 단일 구성 | 계약 고정 |
| `test/skill-bouncer-surface.test.js` | `ENTRY_WORD_BASELINE` | Modify | 단어 수 상한 | 필요 시에만 조정 | 상한 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | 프로젝트 규칙 |

#### Constraints

- `skills/*/SKILL.md`의 단어 수 합계는 baseline 미만이다. 교체한 문단이 더 짧아야 하고, 상세는 reference에 둔다.
- `When the pointer (\`bouncer current\`) \`scale\` is \`light\``, `named agents are unavailable` 등 유지되는 고정 문구를 바꾸지 않는다.
- reviewer는 읽기 전용이다. reviewer가 파일을 쓰는 경로를 만들지 않는다.
- 변경된 `agents/*.md`는 TOML이 생성 결과와 바이트 일치해야 한다.

### EPIC-089/BP-003/TASK-003 · `9f331193`

#### Goal & intent

light 원장에서 `bouncer coordinate promote-stop --blueprint <dir> --reason <enum> --summary <text>`가 현재 task·diff·검증·review 상태와 사유를 `promotion`에 기록하고 `status: 'promotion_stopped'`로 바꾼다. 이후 `prepare`·`dispatch`·`report`·`record`·`integrate`는 거부되고 `run preflight`는 `delegable: false`, `reason: 'promotion-stopped'`를 낸다. 수용 조건은 다섯 reason 기록, 거부, 재개 불가, preflight 보고 테스트 통과다.

#### Current behavior

- 기존 정지는 검증 실패 후 `terminalFailure`와 `awaiting_confirmation`(`coordinator.ts:1605-1630`), 사용자 확인이 필요한 `partial-close`(`:2345-2371`), 보고서 `blocked` outcome이다. `coordinate-next.ts:377-395`가 `partial_closed`·`awaiting_confirmation`·`terminal-verification-failed`를 `blocked` 행동으로 돌려주고, 힌트는 `NEXT_FAILURE_HINTS`(`:54-99`)와 `COORDINATE_FAILURE_HINTS`(`coordinator.ts:2766-2930`)에 있다.
- `Ledger.status`는 `'active'|'awaiting_confirmation'|'partial_closed'`이고 `runtime-state.ts:260-368`에 partial-close 불변식이 있다. `finalize.ts:951-954`가 blueprint status `partial_closed`를 본다.
- `runPreflight`(`run-preflight.ts:249-291`)는 원장을 읽지 않고 `blueprint.status`와 `scale`만 에코한다. `delegable`은 `blueprint-closed`/`no-open-task` 이유만 판정한다(`PreflightOk.reason` 타입 `:59`).
- 승격 사유(보안 위험, 범위 밖 변경, task 분할, 인터페이스 의미 변경, reviewer 범위 확대)를 기록하는 곳은 없다. 보고서 outcome `scope_revision`·`task_change`·`blocked`(`coordinator.ts:52`)가 근접하지만 blocked만 task를 멈춘다.
- 승인 snapshot은 `scale`을 포함하지 않아 scale만 바꿔도 G24가 걸리지 않고, 원장이 있으면 G24를 건너뛴다(`approval-snapshot.ts:99-125`, `validate-gates.ts:810-840`, `:821`). full 전환 뒤에는 G10이 다섯 섹션을 요구하고 G18이 context review를 요구한다.
- 재현: `node --test test/coordinate-next.test.js test/run-preflight.test.js test/coordinator.test.js`. 정지 상태 preflight 케이스는 없다(`test/run-preflight.test.js:166-231`).
- I/O 결합: 원장 쓰기는 `withLedgerLock`·`writeLedger`(`owns()` 확인), preflight는 index.md를 잠금 없이 읽는다.

#### Target behavior

- 성공: `promote-stop`은 light 원장에서 열린 task의 `diff_sha`(integration HEAD 대비 작업 트리 diff), `verify_evidence_id`, `review_evidence_id`(있으면)와 `reason`·`summary`를 `ledger.promotion`에 쓰고 `status`를 `promotion_stopped`로 바꾼다. 응답은 `{ ok: true, status: 'promotion_stopped', promotion }`이다. worktree와 커밋되지 않은 변경은 그대로 보존하고, `fanin`과 `terminalFailure`는 건드리지 않는다(정지는 별도 `promotion`으로만 기록한다).
- 거부: full 원장(`mode` 없음)이면 `promote-stop-requires-light`. `reason`이 다섯 값 밖이면 `promote-reason-invalid`. 이미 정지면 같은 `reason`과 같은 `summary`의 재실행은 `ok: true`(멱등), `reason` 또는 `summary`가 다르면 `promotion-already-stopped`. 정지 뒤 변경 명령은 `promotion-stopped`로 거부된다.
- 보고: `coordinate next`는 `blocked`, reason `promotion-stopped`와 hint를 낸다. `run preflight`는 원장이 `promotion_stopped`이면 `delegable: false`, `reason: 'promotion-stopped'`를 낸다. 원장이 없으면 기존 동작이다.
- 보존: full 경로, 기존 `partial_closed`·`awaiting_confirmation` 의미, 기존 preflight 이유는 그대로다. 정지 상태를 해제하는 명령은 만들지 않는다. full 재계획 뒤에는 새 `bootstrap`/`current --set`이 필요하다고 hint에 적는다.

#### Interface

- 제공: `coordinate promote-stop` 서브명령(`--blueprint`, `--reason`, `--summary` 필수, fence 플래그), `Ledger.promotion`, `PreflightOk.reason`에 `'promotion-stopped'`, 실패 reason 네 개와 힌트.
- 거부: 위 reason 조건. `--summary`가 비어 있으면 사용법 오류(exit 2).
- throw 대 miss: 입력 형식 오류는 사용법 오류, 상태 불일치는 `ok: false` 응답이다. 원장 부재 시 preflight는 정지를 알 수 없으므로 기존 이유를 유지한다(miss).
- 정의: `reason`은 `security-risk`, `out-of-scope`, `task-split`, `interface-semantics`, `reviewer-wider-scope`. 예: `--reason task-split`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `Ledger`, 명령 분기, `COORDINATE_FAILURE_HINTS`, `LEDGER_FENCED_COMMANDS` | Modify | 원장 변경 명령 | `promote-stop` 명령과 정지 후 거부 | 원장 소유 |
| `scripts/src/lib/coordinate-next.ts` | `blueprintNext`(`:377-395`), `NEXT_FAILURE_HINTS` | Modify | blocked 판정 | `promotion-stopped` blocked | 정지 보고 |
| `scripts/src/lib/run-preflight.ts` | `runPreflight`, `PreflightOk` | Modify | 위임 가능 판정 | 원장 상태를 읽어 `promotion-stopped` | 위임 판정 소유 |
| `scripts/src/lib/cli-git-commands.ts` | coordinate 명령 목록·usage | Modify | coordinate CLI | `promote-stop` 등록·도움말 | 등록부 |
| `skills/bouncer-run/references/light-run.md` | 정지 절 | Modify | task 002가 만든 reference | 위험 신호 시 `promote-stop` 호출과 full 재계획 안내 | 절차 정본 |
| `rules/cli.md` | coordinate 목록 | Modify | CLI 계약 | 명령과 reason | CLI 문서 |
| `test/coordinator.test.js` | 신규 케이스 | Modify | 명령 단언 | 정지·거부·멱등 | 계약 고정 |
| `test/coordinate-next.test.js` | blocked 케이스 | Modify | next 단언 | `promotion-stopped` | 계약 고정 |
| `test/run-preflight.test.js` | 신규 케이스 | Modify | preflight 단언 | 정지 보고 | 계약 고정 |
| `test/cli-coordinate.test.js` | usage 단언 | Modify | usage 바이트 | 등록 반영 | 등록부 변경 |
| `test/cli-help.test.js` | 전역 도움말 | Modify | 도움말 단언 | 등록 반영 | 도움말 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- 정지는 사용자 동의나 상태 해제를 대신하지 않는다. 승격 구현(worker 이전)과 full → light 하향은 만들지 않는다.
- `promotion_stopped`는 fence 대상 명령으로 기록하며 stale fence는 기존 reason으로 거부한다.
- 정지 기록에 쓸 증거는 기존 증거 id만 참조하고 새 증거를 만들지 않는다.
- `PreflightOk.reason` 타입 확장은 기존 값의 의미를 바꾸지 않는다.

### EPIC-089/BP-003/TASK-004 · `0efc55c1`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/coordinator-e2e.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/review-dispatch.test.js` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/cli-coordinate.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.