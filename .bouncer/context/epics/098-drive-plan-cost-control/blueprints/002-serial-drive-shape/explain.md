---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/098-drive-plan-cost-control/blueprints/002-serial-drive-shape/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T07:59:25.605+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '098'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 6204600c302e2d332d1736974c38a5717b9e67c0
      range_to: 82968e7729d808fc5411ff6d7becd1b189fdfb07
      diff_sha: 4e670dc0c54245878120395ac9a1d69d809390912d3cad6f57679c97fd1ef88f
      recorded_at: '2026-10-14T08:20:00+09:00'
  task_commits:
    - task: EPIC-098/BP-002/TASK-001
      sha: adf2b26d
      intent_anchor: task-001
    - task: EPIC-098/BP-002/TASK-002
      sha: b3ca4698
      intent_anchor: task-002
    - task: EPIC-098/BP-002/TASK-003
      sha: 9efbf899
      intent_anchor: task-003
    - task: EPIC-098/BP-002/TASK-004
      sha: fabb6681
      intent_anchor: task-004
    - task: EPIC-098/BP-002/TASK-005
      sha: 4d5f3474
      intent_anchor: task-005
    - task: EPIC-098/BP-002/TASK-006
      sha: '82968e77'
      intent_anchor: task-006
---
# Explain

## Background

직렬로 이어진 task 체인에서도 coordinator가 wave마다 새로 기동되었다. 매번 컨텍스트를 다시 읽는 고정비가 쌓였고, task가 두세 개뿐인 짧은 직렬 체인에도 coordinator 계층이 붙었다. 계획 단계는 DAG가 직렬인지 병렬인지 알려 주지 않아 작성자가 실제로는 서로 겹치는 task를 병렬로 적어도 눈치채기 어려웠다. 이번 변경은 CLI가 DAG 모양과 세션 경계를 결정적으로 계산하게 해서, 직렬·무예외 wave는 한 세션에서 잇고, 짧은 직렬 체인은 root가 직접 실행할 수 있게 하며, 계획 gate가 모양 문제를 경고하게 한다.

## Intuition

계산대 줄이다. 줄이 한 줄이고 손님이 문제없이 이어지면 계산원을 바꾸지 않고 몇 명까지 계속 받는다. 상한에 닿거나 문제 손님이나 병렬 줄이 생기면 새 계산원이 맡는다. 손님이 몇 명 안 되면 점장이 직접 계산한다.

## Code

- `scripts/src/lib/dag-shape.ts` — `analyzeDriveShape`는 열린 commit task만으로 `readyWave` 시뮬레이션을 돌려 `serial`·`parallel`·`mixed`·`unknown`을 낸다. verification 노드와 그 노드를 향한 edge는 무시한다. `pathOverlapRatio`는 더 짧은 쪽 경로 수를 분모로 삼는다. 작은 task가 큰 task 안에 거의 들어가는 경우를 희석 없이 드러내려는 설계다. `normalizePath`는 coordinator의 비공개 정규화를 같은 규칙으로 복제한 것이다.
- `scripts/src/lib/run-preflight.ts` — preflight 결과에 `shape`(`drive_shape`, `max_wave_width`, `commit_tasks`, `review_risk`, `parallel_safe_tasks`, `direct_eligible`)를 싣는다.
- `scripts/src/lib/validate-gates.ts` — `checkTaskDagShape`가 `dag-serial-overlap`(중첩률 0.5 이상 edge로 이어진 긴 체인)과 `dag-disjoint-edge` 경고를 낸다. 경고는 권고라 실패를 만들지 않는다. 분기가 많은 DAG에서는 경로마다 경고가 하나씩 생길 수 있다는 한계가 있다.
- `scripts/src/lib/config.ts` — `coordinator.waves_per_session`(`"auto"`·부재는 4, 정수 1–8)과 `coordinator.direct_max_commit_tasks`(기본 3, 0이면 끔). 잘못된 `waves_per_session`은 prepare가 거절하고 읽기 전용 소비자는 상한 1로 접는다. 잘못된 `direct_max_commit_tasks`는 0으로 접는다.
- `scripts/src/lib/coordinate-next.ts` — `sessionYieldReason`이 `session-wave-cap`, `wave-exception`, `parallel-wave` 중 하나로 세션을 끊는다(`yield`). verification 노드만 남았거나 이번 세션에서 아직 wave를 돌리지 않았다면 끊지 않는다. `coordinate advance`는 yield 전까지 wave를 이어 간다. 저장만 하고 읽지 않는 `waves_cap`이 남아 있다.
- 문서 — `skills/bouncer-run/references/direct-run.md`와 `SKILL.md`에 직접 실행 모드(ACQ 옵션 D)가 추가되었다. 옵션 D는 `direct_eligible`일 때만 가능하지만 그 규칙은 본문에만 있다. 메트릭에는 `root-direct-session` 종류가 생겼다.
- `benchmarks/drive-serial-4/` — 직렬 4-task fixture와 결과 기록. 설치된 `BOUNCER_HOME`이 `shape` 없는 옛 빌드일 수 있어 `setup.cjs`가 이 저장소를 가리키게 한다.
- 검증은 `npm run ci` 통과(evidence: `evidence.verification[]`)이고, 최종 리뷰는 must_fix 없이 accepted(`evidence.review`)이다.

## Quiz

1. `waves_per_session`을 설정하지 않았을 때 한 coordinator 세션은 최대 몇 wave까지 이어 가나요? (A) 1 (B) 4 (C) 8
2. 이번 세션에서 wave를 하나 끝낸 뒤 다음 ready wave에 commit task가 2개 있으면 `coordinate next`는 어떻게 하나요? (A) `yield`(`parallel-wave`)로 세션을 끊는다 (B) 상한까지 계속 이어 간다 (C) 오류로 `blocked` 처리한다
3. 남은 task가 verification 노드뿐일 때 세션 wave 상한에 이미 닿았다면? (A) `session-wave-cap`으로 끊는다 (B) 끊지 않고 이어 간다 (C) 상한을 8로 올린다
4. `coordinator.direct_max_commit_tasks`가 `-1`이면 어떻게 되나요? (A) 기본값 3으로 돌아간다 (B) 무제한 직접 실행 (C) 0으로 접혀 직접 실행이 꺼진다
5. 서로 중첩률 0.5 이상인 task가 선행 순서대로 길게 이어져 있는데 계획 gate를 돌리면? (A) `dag-serial-overlap` 경고가 나오고 gate는 통과한다 (B) gate가 실패해 계획을 되돌린다 (C) 의존이 자동으로 제거되고 `parallel_safe`가 켜진다

## Tasks

### EPIC-098/BP-002/TASK-001 · `adf2b26d`

#### Goal & intent

`bouncer run preflight`가 열린 commit task의 DAG 모양을 prepare와 같은 규칙으로 계산해 `shape`로 내고, 같은 모듈이 plan gate(TASKS-002)와 direct 판정(TASKS-005)이 쓸 경로 중첩률을 제공한다. 수용 기준은 아래 Checklist의 테스트와 `npm run ci`다.

#### Current behavior

- preflight 성공 payload는 `{ ok, blueprint{dir,status,scale}, base, openTasks[], readyWave[], autonomy, delegable, reason }`이다(`scripts/src/lib/run-preflight.ts:55-64`, `:290-299`). 파일을 쓰지 않는다.
- `collectTasks`(`run-preflight.ts:178-238`)는 모든 task 문서로 `waveTasks`를, ready·in_progress만으로 `openTasks`를 만든다. `ledgerStatus`는 ready·in_progress를 `pending`으로 바꾸고 나머지는 그대로 둔다(`:137-139`). `WaveTask`에는 `execution_kind`가 없어 verification 노드도 일반 task로 `readyWave`에 들어간다.
- `review_risk`는 preflight에서 읽지 않는다. 검증은 `validate-structural.ts:268-289`(S30), 소비는 `review-dispatch.ts:529`, `:674`다.
- `readyWave(tasks, { maxParallel })`(`scripts/src/lib/coordinator.ts:427-465`)는 순수 함수다. 진행 중 task가 있으면 그만큼 슬롯을 빼고, `parallel_safe: false` 후보는 혼자 연다. 경로 충돌은 `validate-sections.ts:183` `pathsOverlap`(같거나 조상)과 공유 `exclusive_resources`로 판정한다. 경로 정규화 `normalizeOverlapPath`(`coordinator.ts:382-388`)는 export되지 않는다.
- `maxParallel`은 `readCoordinatorPolicy(repoRoot)`에서 오고 invalid면 1로 접는다(`run-preflight.ts:284-286`).
- CLI 연결은 `scripts/src/lib/cli-project-commands.ts:315-343`이고 결과 JSON을 stdout에 그대로 쓴다. 문서는 `rules/cli.md:20`, `:121`이 preflight 출력을 설명한다.
- 재현: `npm run build` 뒤 `node --test test/run-preflight.test.js`. `makeRepo`(`test/run-preflight.test.js:73`), `writePlanTree`(`:36-72`, TASKS-001/002 두 개), `setPointer`(`:84`), `preflight`(`:88-105`)를 쓴다. `readyWave` 단위 테스트는 `test/coordinator.test.js:126-155`.

#### Target behavior

- 성공: preflight 성공 payload에 `shape`가 붙는다. 시뮬레이션 대상은 열린 commit task이고, 열려 있지 않은 task는 이미 `integrated`로 둔다. verification 노드는 제외하고, 그 노드로 가는 edge도 무시한다.
  - `drive_shape`: 모든 wave 폭이 1이면 `serial`, wave가 하나이고 폭이 2 이상이면 `parallel`, 그 밖은 `mixed`다. 열린 commit task가 없으면 `null`, 시뮬레이션이 남은 task를 열지 못하면 `unknown`이다.
  - `max_wave_width`·`commit_tasks`(열린 commit task 수)·`review_risk`(열린 commit task `review_risk`의 정렬된 합집합)·`parallel_safe_tasks`(열린 commit task 중 `parallel_safe: true` 수).
- 성공: `pathOverlapRatio(a, b)`는 a의 경로 중 b의 어떤 경로와 `pathsOverlap`인 것의 수를 `min(|a|, |b|)`로 나누고 1로 자른다. 어느 한쪽이 비면 0이다.
- 보존: 기존 payload 키와 `readyWave`·`delegable`·`reason` 값, 실패 payload는 그대로다. `max_parallel`이 invalid면 기존대로 1로 접어 시뮬레이션한다(그 경우 `serial`이 나올 수 있다).

#### Interface

- 제공:
  ```ts
  type DriveShape = 'serial' | 'parallel' | 'mixed' | 'unknown' | null;
  type ShapeTask = WaveTask & { execution_kind: 'commit' | 'verification'; review_risk: string[]; open: boolean };
  function analyzeDriveShape(tasks: ShapeTask[], opts: { maxParallel: number }): {
    drive_shape: DriveShape; max_wave_width: number; commit_tasks: number;
    review_risk: string[]; parallel_safe_tasks: number;
  };
  function pathOverlapRatio(a: string[], b: string[]): number; // 0..1
  ```
  - preflight `PreflightOk.shape`(위 반환 객체). `ok: false`에는 붙지 않는다.
- 거부:
  - `review_risk`가 배열이 아니면 그 task의 위험은 `[]`로 읽는다(형식 거절은 S30 소관).
  - 시뮬레이션은 `tasks.length + 1`회 안에 끝나지 않으면 `unknown`을 낸다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/dag-shape.ts` | `analyzeDriveShape`, `pathOverlapRatio` | Create | 없음 | `readyWave` 반복 시뮬레이션과 중첩률 계산. 경로 정규화는 이 모듈에 둔다 | 공유 계산 지점 |
| `scripts/src/lib/run-preflight.ts` | `collectTasks`, `runPreflight` | Modify | 열린 task·wave 입력 수집과 payload | `execution_kind`·`review_risk`·open 여부를 담아 `analyzeDriveShape` 결과를 `shape`로 붙임 | preflight 진입점 |
| `test/dag-shape.test.js` | 신규 추출 지점: 모양·중첩률 단위 테스트 | Create | 없음 | serial·parallel·mixed·unknown·null·verification 제외·`parallel_safe:false`·중첩률 경계 | 순수 함수 판정 |
| `test/run-preflight.test.js` | `writePlanTree`, preflight 케이스 | Modify | 두 task fixture로 payload 검증 | 세 task 이상 fixture와 `shape` 값 검증 | payload 계약 |
| `test/tiers.json` | unit 목록 | Modify | 테스트 tier 등록 | `dag-shape.test.js` 등록 | 새 테스트 실행 |
| `rules/cli.md` | preflight 설명 | Modify | preflight 출력 설명(`:20`, `:121`) | `shape` 필드 설명 추가 | 문서 계약 |

#### Constraints

- `analyzeDriveShape`는 파일·프로세스 I/O가 없는 순수 함수다. I/O는 `collectTasks`에 남긴다.
- `readyWave`의 충돌·슬롯 규칙을 다시 구현하지 않고 호출한다.
- 새 키는 snake_case(`shape.drive_shape` 등)로, 기존 camelCase 키는 바꾸지 않는다.
- 주석·docstring은 `references/coding-standards/index.md`의 한국어 계약을 따른다.

### EPIC-098/BP-002/TASK-002 · `b3ca4698`

#### Goal & intent

`bouncer validate --gate plan`과 plan draft 검사가 commit task DAG의 모양 경고 두 종류를 `warnings[]`에 싣고, `ok`와 `failures`는 바꾸지 않는다. spec-authoring reference는 그 경고를 받았을 때 검토할 휴리스틱을 담는다. 수용 기준은 Checklist의 테스트와 `npm run ci`다.

#### Current behavior

- 유일한 plan 경고는 `checkTaskScope`의 `task-split`이다(`scripts/src/lib/validate-gates.ts:1362-1371`). `affected_paths`가 20개를 넘으면 `{ code: 'task-split', message, file }`을 `ctx.warnings`에 넣는다. `next`는 없고 G/S 코드도 아니다.
- `GateContext.warnings`(`validate-gates.ts:149`)는 객체형 `checkGate`가 모으고 비면 키를 생략한다(`:821-840`). `validate.ts:376-398`이 plan draft(`checkPlanDraft(..., { warnings })`, `:381`)와 그 밖의 gate(`:390`)에 넘긴다. `withGateFailureHints`(`validate.ts:~107-120`)는 failures에만 `next`를 붙인다.
- G19 `checkTaskDependencyGraph(tasksList, failures)`(`validate-gates.ts:363-455`)는 `ctx`를 받지 않는다. plan gate(`:975-976`)와 `checkPlanDraft`(`:1439-1440`) 두 곳에서 호출된다. `execution_kind`는 `executionKindOf`로 읽는다(`:1355-1357`).
- 경고는 CLI가 결과 JSON에 그대로 직렬화한다. 별도 렌더러는 없다.
- `references/spec-authoring/index.md`의 절은 Steps `:22`, Guardrails `:330`, Return `:347`이다.
- 재현: `npm run build` 뒤 `node --test test/validate-gates.test.js`. task-split 케이스는 `test/validate-gates.test.js:1725-1750`, `mkRepo`·`writePlanBlueprintWithPaths`(`:~1700-1724`)가 임시 repo를 만든다. G19 케이스도 같은 파일에 있다.

#### Target behavior

- 성공(체인 경고): commit task만 대상으로, 인접 edge의 `pathOverlapRatio`(TASKS-001)가 0.5 이상인 edge만 이은 최대 경로가 task 3개 이상이면 그 경로마다 경고 하나를 낸다.
  - `{ code: 'dag-serial-overlap', message: 'serial chain TASKS-001 → TASKS-002 → TASKS-003 shares paths (min overlap 0.67); consider merging the tasks or splitting shared paths so they can run in parallel', file: <blueprint index rel> }`
- 성공(edge 경고): `pathOverlapRatio`가 0인 commit→commit `depends_on` edge가 하나 이상이면 blueprint당 경고 하나에 모든 edge를 나열한다.
  - `{ code: 'dag-disjoint-edge', message: 'serial edges with no shared paths: TASKS-002 → TASKS-003; if the dependency is not real, drop it or make the dependent task fixture-first so it can run in parallel', file: <blueprint index rel> }`
- 순서: 경고는 task-split 경고 뒤에, 체인은 첫 task id 순으로, edge 목록은 (선행, 후행) id 순으로 정렬한다.
- 보존: G19가 실패를 하나라도 낸 plan에서는 두 경고를 계산하지 않는다. verification 노드와 그 edge는 계산에서 빠진다. 경고는 `ok`·`failures`·exit code를 바꾸지 않는다. execute 등 다른 gate에는 경고가 나오지 않는다.

#### Interface

- 제공:
  - `warnings[]` 항목 코드 `dag-serial-overlap`, `dag-disjoint-edge`(위 shape).
  - 내부 진입점 `checkTaskDagShape(tasksList, ctx)`: plan gate와 `checkPlanDraft`의 G19 호출 뒤에서 부른다.
- 거부:
  - 경고에 `next` 키를 만들지 않는다. 권고 문구는 `message`에 둔다.
  - `affected_paths`가 비거나 배열이 아닌 task는 중첩률 0으로 센다(G5가 따로 실패시킨다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `checkTaskDependencyGraph` 호출부(`:975`, `:1439`), 신규 추출 지점: DAG 모양 경고 | Modify | G19 DAG 무결성, task-split 경고 | G19 실패가 없을 때 `checkTaskDagShape`로 두 경고를 `ctx.warnings`에 추가 | 경고 생성 지점 |
| `scripts/src/lib/validate.ts` | plan gate·draft의 warnings 전달(`:376-398`) | Modify | warnings 배열 전달 | 두 호출 경로 모두 새 경고가 전달되는지 맞춤(필요한 인자만) | 경고 전달 경로 |
| `test/validate-gates.test.js` | task-split 케이스 인근 | Modify | plan 경고 검증 | 체인·edge·G19 실패 시 생략·verification 제외·`ok: true` 유지 케이스 | 회귀 판정 |
| `references/spec-authoring/index.md` | Steps의 depends_on 항목 또는 Guardrails 인근 | Modify | task 작성 규칙 | 두 경고 코드의 뜻과 fixture 선행 분리·병합·`parallel_safe` 검토 휴리스틱과 예시 | 작성 지침 |

#### Constraints

- 경고는 권고다. 실제 의존을 없애거나 `parallel_safe`를 강제하는 실패를 만들지 않는다.
- 중첩률은 TASKS-001 `pathOverlapRatio` 하나로 계산하고 다시 구현하지 않는다.
- `warnings` 키는 빈 배열이면 생략하는 기존 규칙을 지킨다.
- `references/spec-authoring/index.md`는 `npm run lint:docs` 형태 계약을 지킨다.

### EPIC-098/BP-002/TASK-003 · `9efbf899`

#### Goal & intent

한 coordinator 세션이 직렬·무예외 wave를 이어서 처리하도록, 세션을 끊을 시점을 `coordinate next`가 원장의 `session`·`fanin` 결정으로 계산해 `yield`로 알린다. 세션 경계는 root가 디스패치 전에 실행하는 `coordinate session-open`이 기록한다. 수용 기준은 epic 기준 9의 CLI 부분과 Checklist의 테스트, `npm run ci`다.

#### Current behavior

- `blueprintNext`(`scripts/src/lib/coordinate-next.ts:520-640`)는 fanin 진행 → prepared → recorded → verification 노드 → `checkpoint.ready.length > 0`이면 `prepare`(`:591-595`) → final_review → done 순으로 고른다. verification 노드 분기(`:579-590`)가 prepare보다 앞이지만, pending verification 노드는 prepare 행이 연다(`:575-578` 주석).
- `checkpoint.ready`는 `readyWave(ledger.tasks, { maxParallel: maxParallelForRead(...) })`로 계산된다(`scripts/src/lib/coordinator.ts:673`, `:3228`).
- 원장에 wave id는 없다. 성공한 commit wave 통합은 `FaninDecision { kind: 'fanin', tasks, base_head, candidate_head, evidence_id }`(`coordinator.ts:150-152`)로 full(`:2526-2534`)·light(`:~3067-3075`) 경로에서 남는다. 실패는 `fanin-verification-failed`(`:153-155`)다. report 결정은 `{ task, kind: 'report', attempt, outcome, summary }`(`:80-84`).
- 예외 집합 `EXCEPTION_KINDS`(stale-report, stale-lease, repair, supplement, rerecord, critical-recovery, fanin-verification-failed, revoke)는 `scripts/src/lib/drive-metrics.ts:19-22`의 모듈 내부 상수이고 `isException`(`:151-155`)이 accepted가 아닌 report도 예외로 센다.
- 단순 append mutation 예는 `stale-lease`(`coordinator.ts:1696-1700`)다. 패턴은 `assertLedgerFence`(`:551`) → `withLedgerLock` 안에서 `ledger.decisions.push` → `owns()` 확인 → `writeLedger` → `withCheckpoint`(`:2534-2540`)다.
- `readCoordinatorPolicy`(`scripts/src/lib/config.ts:156-182`)는 `max_parallel`만 읽고, prepare는 invalid면 `coordinator-config-invalid`로 거절한다(`coordinator.ts:1911`, 힌트 `:3860`).
- `advance`(`scripts/src/lib/coordinate-advance.ts`)의 `StopReason`은 `'judge'|'worker'|'blocked'|'done'|'none'|'max-steps'`(`:31`)이다. `AUTO_ACTIONS`(`:54-56`)·`TERMINAL_ACTIONS`(`:58`) 밖이고 argv가 없는 action은 `worker` 정지가 된다(`:277-281`).
- coordinate 하위 명령 등록은 `scripts/src/lib/cli-git-commands.ts`의 `COORDINATE_COMMANDS`(`:298-300`), usage 맵(`:455` 인근), `COORDINATE_REGISTRY_ORDER`(`:530-531`), `fencedCommands`(`:653-655`), 오류 목록(`:~660`), 명령별 블록(revoke `:735-742`)이다.
- 설정 문서는 `docs/configuration.md:18`(`max_parallel`)이고 `config.example.json`에는 `coordinator` 정책 블록이 없다.
- 재현: `npm run build` 뒤 `node --test test/coordinate-next.test.js test/coordinate-advance.test.js test/cli-coordinate.test.js test/cli-metrics.test.js`. 헬퍼는 `test/coordinate-next.test.js`의 `__fence`(`:24`), `coordinate`(`:31`), `writeLedger`(`:53`), `loadLedger`(`:57`), `test/helpers/git-fixture`의 `createGitTemplate`다.

#### Target behavior

- 성공(설정): `coordinator.waves_per_session`은 `"auto"`(상한 4) 또는 정수 1–8이다. 부재는 `auto`다. 그 밖의 값이면 `coordinate prepare`가 worktree를 만들기 전에 `coordinator-config-invalid`로 거절하고, 읽기 전용 `next`는 상한 1로 접는다.
- 성공(세션 기록): `coordinate session-open`은 fence가 맞으면 `{ kind: 'session', opened_at, integration_head, waves_cap }`을 덧붙이고 다른 fenced mutation처럼 새 `checkpoint`를 돌려준다.
- 성공(yield): `blueprintNext`가 `prepare`를 돌려줄 자리에서 아래를 차례로 본다.
  - 이번 세션 wave 수 = 마지막 `session` 결정 뒤(없으면 원장 처음부터)의 `fanin` 결정 수.
  - `checkpoint.ready`에 commit task가 없으면(verification 노드뿐) 항상 `prepare`다.
  - wave 수가 0이면 `prepare`다.
  - wave 수 ≥ 상한이면 `{ action: 'yield', reason: 'session-wave-cap' }`.
  - 예외 창(이번 세션에서 마지막 `fanin` 바로 앞 `fanin` 또는 `session` 결정 뒤의 모든 결정)에 `isException`이 참인 결정이 있으면 `reason: 'wave-exception'`.
  - `checkpoint.ready`의 commit task가 2개 이상이면 `reason: 'parallel-wave'`.
  - 그 밖은 `prepare`다.
- 성공(advance): `next`가 `yield`면 실행 없이 `{ ok: true, executed, stop: { reason: 'yield', next } }`를 돌려준다.
- 보존: `waves_per_session: 1`이면 세션마다 wave 하나 뒤 yield한다(현재 continue 동작). fanin·prepared·recorded·verification·final_review·blocked 분기와 우선순위는 그대로다. `max_parallel` 읽기와 그 invalid 처리, BP 001 metrics 파일 shape, light 원장 흐름은 바뀌지 않는다.

#### Interface

- 제공:
  ```ts
  function readWavesPerSession(repoRoot: string): { ok: true; cap: number } | { ok: false; reason: 'invalid' };
  type SessionDecision = { kind: 'session'; opened_at: string; integration_head: string; waves_cap: number };
  // coordinate next (blueprint scope)
  { scope: 'blueprint'; action: 'yield'; reason: 'session-wave-cap' | 'wave-exception' | 'parallel-wave'; cwd: string }
  // coordinate advance
  type StopReason = 'judge' | 'worker' | 'blocked' | 'done' | 'none' | 'max-steps' | 'yield';
  ```
  - CLI: `bouncer coordinate session-open --blueprint <dir> --ledger-path <p> --ledger-hash <h>`. usage·`--help`에 나온다.
  - `drive-metrics.ts`가 `EXCEPTION_KINDS`와 `isException`을 export한다.
- 거부:
  - 즉시 실패: fence 불일치는 기존 `stale-ledger-checkpoint`, 원장 잠금 상실은 `ledger-lock-lost`, `--blueprint` 누락은 기존 usage 오류다.
  - 폴백: 설정 invalid는 `next`에서 상한 1이고, 거절은 prepare의 `coordinator-config-invalid`가 맡는다.
  - `session-open`은 원장을 바꾸지 않고 거절한다: light 원장은 기존 `ledger-mode-mismatch`, `promotion_stopped`는 기존 `promotion-stopped`, `partial_closed`·`awaiting_confirmation`은 새 reason `ledger-not-active`(실패 힌트 표에 cause·next 추가).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/config.ts` | 신규 추출 지점: `readWavesPerSession` | Modify | `readCoordinatorPolicy`·`metrics.pricing` 읽기 | `waves_per_session` 읽기와 검증 | 설정 진입점 |
| `scripts/src/lib/coordinator.ts` | 결정 타입 union, prepare 정책 검사(`:1911`), 신규 추출 지점: session-open mutation, 실패 힌트 표 | Modify | 원장 결정·fence·prepare | `SessionDecision` 타입, `session-open` mutation, prepare의 `waves_per_session` 검증 | 원장 소유 |
| `scripts/src/lib/coordinate-next.ts` | `blueprintNext`(`:591-595`) | Modify | 다음 action 결정 | prepare 자리의 yield 판정 | 세션 경계 결정 |
| `scripts/src/lib/coordinate-advance.ts` | `StopReason`, 루프(`:263-281`) | Modify | 자동 action 연쇄와 정지 | `yield` 정지 | worker 오분류 방지 |
| `scripts/src/lib/drive-metrics.ts` | `EXCEPTION_KINDS`, `isException` | Modify | 세션 예외 수 계산 | export해 공유 | 예외 정의 단일화 |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_COMMANDS`, usage 맵, `COORDINATE_REGISTRY_ORDER`, `fencedCommands` | Modify | coordinate 하위 명령 등록 | `session-open` 등록 | CLI 표면 |
| `docs/configuration.md` | coordinator 표(`:18`) | Modify | `max_parallel` 설명 | `waves_per_session` 행 | 설정 문서 |
| `config.example.json` | 최상위 키 | Modify | 설정 예시 | `"coordinator": { "max_parallel": 2, "waves_per_session": "auto" }` 블록 | 설정 예시 |
| `test/coordinate-next.test.js` | 신규 케이스 | Modify | next 판정 검증 | yield 세 reason·verification 예외·세션 없는 원장·상한 1 | 판정 회귀 |
| `test/coordinate-advance.test.js` | 신규 케이스 | Modify | advance 정지 검증 | `yield` 정지와 실행 없음 | 정지 분류 |
| `test/cli-coordinate.test.js` | usage·registry 케이스 | Modify | coordinate usage 바이트·등록 검증 | `session-open` 등록·fence 거절 | usage 바이트 변경 |
| `test/cli-help.test.js` | coordinate 하위 명령 목록(`:285`) | Modify | coordinate `--help` 대상 목록 | `session-open` 추가 | 하위 명령 목록 회귀 |
| `test/coordinator.test.js` | `readCoordinatorPolicy` 인근 | Modify | 정책 읽기·prepare 검증 | `readWavesPerSession`과 prepare 거절 | 설정 검증 |

#### Constraints

- yield는 판단을 건너뛰지 않는다. 정상 dispatch·review·report·record의 judge 정지는 그대로 나온다.
- 미해결 blocker·반복 gate 실패는 기존 `blocked`로 남고 yield 판정보다 먼저 처리된다.
- `session` 결정은 예외가 아니고 BP 001 metrics의 decision 수에는 그대로 포함된다.
- 모든 새 mutation은 기존 fence·잠금 규칙을 따른다. 원장 위치와 기존 결정 shape는 바꾸지 않는다.

### EPIC-098/BP-002/TASK-004 · `fabb6681`

#### Goal & intent

coordinator는 prepared wave가 통합된 뒤 바로 `continue`하지 않고 `advance`를 다시 호출해 CLI가 허용하는 다음 wave를 이어 처리하며, `yield` 정지에서만 `continue`를 돌려준다. root는 coordinator 디스패치마다 `coordinate session-open`을 먼저 실행한다. 수용 기준은 epic 기준 9의 문서 조항과 15의 TOML 일치·단어 수이며, 판정은 BP 최종 리뷰와 `npm run ci`다.

#### Current behavior

- `agents/bouncer-coordinator.md:232-243`(Procedure 4 Integrate)은 "If `active_tasks` is non-empty after the prepared wave is fully `integrated`, do not prepare again and return `continue`; do not prepare, dispatch, or integrate more when returning `continue`."라고 정한다. `continue` 조건(wave 전체 통합, 새 통합 task id 비어 있지 않음, 모든 worker 보고 수집)도 같은 단락이다.
- 같은 문서의 관련 줄: `:12`(continue 또는 terminal 반환), `:148-150`(보고 미수집 상태에서 continue 금지), `:202-206`(Prepare는 advance가 자동 실행), `:263`·`:266`(Output contract의 continue 조건 참조).
- `advance` 정지 사유 목록은 `rules/cli.md:123-127` 한 곳에만 있다(`judge`, `worker`, `blocked`, `done`, `none`, `max-steps`와 실패 사유).
- `skills/bouncer-run/references/drive-metrics.md`의 "Per coordinator session" 1단계가 디스패치 직전 `bouncer metrics start`를 지시한다. `skills/bouncer-run/SKILL.md:140`은 "Wrap every coordinator session in `metrics start`/`end` per drive-metrics.md"로 이 문서를 가리킨다.
- `.codex/agents/bouncer-coordinator.toml`은 `scripts/src/lib/codex-agents.ts` `mdToCodexToml`의 생성물이다. npm 재생성 스크립트는 없고, `test/agents.test.js:44-59`·`:~70-76`, `test/distribution.test.js:232-255`가 바이트 일치와 필수 문구(`checkpoint`, `--ledger-path <checkpoint.ledger.path>`, `coordinate status`, `coordinate advance`, `payload.evidence`, `payload.report` 등)를 검사한다. `test/agents.test.js:160-165`는 Worker dispatch 절을 20줄 이하로 제한한다. 현재 다섯 TOML은 모두 일치한다.
- 진입 skill 단어 수는 `test/skill-bouncer-surface.test.js:108-129`가 일곱 `SKILL.md`의 합계 < 8665를 검사한다. 현재 합계 8655다.
- `references/coordinator-cards/*.md`에는 continue·wave 경계 문구가 없다.

#### Target behavior

- 성공: coordinator Procedure 4는 wave 통합 뒤 `advance`를 다시 호출한다고 정한다. advance가 다음 wave를 자동 prepare하면 같은 세션에서 Drive를 계속하고, `yield` 정지면 기존 `continue` 조건을 모두 만족할 때 `continue`를 돌려준다. verification 노드는 yield하지 않으므로 같은 세션에서 처리한다.
- 성공: `rules/cli.md`의 advance 정지 사유에 `yield`가 있고, `coordinate session-open` 설명(누가·언제·결정 shape)과 `waves_per_session` 설정을 가리키는 문장이 있다.
- 성공: `drive-metrics.md` 1단계 바로 앞에 root가 `bouncer coordinate session-open --blueprint <dir> --ledger-path <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>`을 integration cwd에서 실행하고, 그 결과 checkpoint로 `coordinate status --write-input`을 다시 쓴다고 적는다. `ok: false`면 디스패치하지 않고 reason을 보고한다.
- 보존: `continue`의 세 조건, no-progress·worker 상태 표, `completed_tasks.length` 기준 재디스패치, 미해결 blocker 중단, 나머지 Hard guards는 그대로다. `skills/bouncer-run/SKILL.md`는 바꾸지 않는다.

#### Interface

- 제공: 역할 문서·`rules/cli.md`·`drive-metrics.md`의 절차 문구. 실행 표면은 TASKS-003이 제공한다.
- 거부: coordinator가 `yield` 없이 `continue`를 돌려주는 절차, root가 원장을 직접 편집하는 절차, `session-open`을 coordinator가 실행하는 절차는 문서에 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | Procedure 4 Integrate(`:232-243`), Output contract(`:263-266`) | Modify | 세션당 prepared wave 하나 | yield 정지 기준의 continue, 같은 세션의 다음 wave·verification | 역할 절차 |
| `.codex/agents/bouncer-coordinator.toml` | 생성물 전체 | Modify | Codex 역할 정의 | `mdToCodexToml` 재생성 | 바이트 일치 테스트 |
| `rules/cli.md` | coordinate synopsis(`:67`), advance 설명(`:123-127`) | Modify | coordinate 하위 명령 목록과 advance 정지 사유 | synopsis에 `session-open`, `yield` 사유, `session-open` 설명 | 명령·정지 사유 단일 출처 |
| `skills/bouncer-run/references/drive-metrics.md` | Per coordinator session | Modify | 세션 계측 절차 | 디스패치 전 `session-open` 단계 | root 절차 위치 |

#### Constraints

- 역할 문서는 `npm run lint:docs`의 heading 골격(Authority, Hard guards, Procedure, Output contract)과 `test/distribution.test.js`의 필수 문구를 지킨다.
- `.codex/agents/bouncer-coordinator.toml`은 손으로 고치지 않고 생성 결과로 덮는다.
- 새 문구는 기존 Procedure 단락 길이를 크게 늘리지 않는다. 같은 규칙을 두 곳에 반복하지 않는다.

### EPIC-098/BP-002/TASK-005 · `4d5f3474`

#### Goal & intent

`drive_shape: serial`이고 열린 commit task가 설정 상한 이하인 full 드라이브에서, 사용자가 시작 ACQ에서 고르면 root가 coordinator 없이 `coordinate advance` 루프를 돌린다. root는 정상 판단을 카드대로 기록하고 worker는 subagent로 띄우며, accepted가 아닌 판단이나 그 밖의 정지에서는 그 판단을 원장에 기록하지 않고 coordinator에 넘긴다. 수용 기준은 epic 기준 11과 15이며, Checklist의 테스트, `npm run ci`, BP 최종 리뷰로 판정한다.

#### Current behavior

- `skills/bouncer-run/SKILL.md:28-34`는 "For a **full** ledger the drive has one controller, and after the start ACQ it is the coordinator, not this session"이라고 정한다. `:35-41`은 worker dispatch를 coordinator 문서에 넘기고, `:44-49`는 블로커 판단을 coordinator에 둔다.
- 시작 ACQ(`SKILL.md:87-104`)는 ``(`:93`)와 A) Start drive / B) Revise / C) Cancel이고 "Stop unless A."다. bootstrap(`:106-112`)은 A 뒤에만 실행한다. 진입 skill 단어 수 여유는 9단어다(`test/skill-bouncer-surface.test.js:108-129`, 현재 합계 8655 < 8665).
- `skills/bouncer-run/references/light-run.md`는 light 원장 전용 절차(inline 구현, 독립 reviewer, `promote-stop`)이고 `:47-48`에서 "Do not invent a separate execution-mode opt-in string. Light vs full is ledger / pointer `scale` only."라고 정한다. reference 목록은 `test/skill-bouncer-surface.test.js:285` `'bouncer-run': ['light-run.md']`가 고정한다.
- `agents/bouncer-coordinator.md:10-14`는 "You are the drive's only controller"라고 정한다.
- `rules/cursor-print-dispatch.md` 1항(`:8-13`)은 coordinator가 dispatch하는 worker를 print 프로세스로 정하고, 신원 줄(`:21-24`)은 coordinator만 worker를 dispatch한다고 가정한다. `rules/subagent-model.md`는 dispatch 주체를 제한하지 않는다.
- `SESSION_KINDS`는 `['coordinator-session', 'context-review']`(`scripts/src/lib/drive-metrics.ts:16`)이고 `startSession`(`:179`)이 그 밖의 kind를 `invalid-metrics-input`으로 거절한다. `target-digest`는 context-review만 받는다(`:182-184`). `summarize`는 kind별로 합산한다(`:308`). `scripts/src/lib/cli-metrics-command.ts:17`, `:26` usage가 kind 목록을 하드코딩한다.
- preflight는 TASKS-001 뒤 `shape`를 내지만 direct 적격 판정은 없다. `blueprint.scale`은 읽는다(`scripts/src/lib/run-preflight.ts:164-174`).
- 재현: `npm run build` 뒤 `node --test test/run-preflight.test.js test/cli-metrics.test.js test/skill-bouncer-surface.test.js test/skill-bouncer-run.test.js`.

#### Target behavior

- 성공(설정): `coordinator.direct_max_commit_tasks`는 정수 0 이상, 부재면 3이다. 0이면 직접 실행을 끈다. 정수가 아니거나 음수면 preflight는 0으로 접는다.
- 성공(preflight): `direct_eligible`은 `delegable`이 true이고, `blueprint.scale`이 `full`이고, `shape.drive_shape === 'serial'`이고, `1 ≤ shape.commit_tasks ≤ 상한`일 때만 true다. 그 밖은 false다.
- 성공(ACQ): `run.start_drive`는 `direct_eligible`일 때만 "D) 직접 실행(coordinator 없음)"을 보이고 권장은 A에 둔다. bootstrap은 A 또는 D 뒤에 실행한다.
- 성공(direct-run.md): root는 다음을 따른다.
  - `bouncer metrics start --kind root-direct-session`으로 계측을 열고, `coordinate advance`를 반복한다.
  - `worker` 정지의 implement·review는 `rules/subagent-model.md`(Cursor print면 `rules/cursor-print-dispatch.md`)대로 named implementer·reviewer를 띄운다. implementer에는 coding-standards 읽기를 요구한다.
  - `judge` 정지는 해당 card대로 판단하고, 결과가 accepted(정상 dispatch·review 통과·report accepted·record)일 때만 그 argv를 실행한다.
  - `yield` 정지는 `coordinate session-open` 뒤 `advance`를 다시 호출한다.
  - `done` 정지면 SKILL step 5로 간다.
  - 인계(기본 규칙): 위 네 경우(`worker`의 implement·review, accepted로 끝나는 `judge`, `yield`, `done`) 밖의 모든 결과에서 root는 판단을 기록하지 않고 인계한다. 여기에는 accepted가 아닌 판단(rework·scope_revision·task_change·blocked 등), `revise`·`critical-recovery`·`supplement`·`final_review`의 `must_fix`, `blocked`·`none`·`max-steps` 정지, implement·review가 아닌 `worker` 정지, `ok: false` 결과(`repeated-failure`·`unclear-result`·`advance-argv-invalid`와 자동 action 실패)가 모두 포함된다.
  - 인계 절차: `metrics end`로 root-direct 세션을 닫고 SKILL step 4대로 `coordinate session-open` → `coordinate status --write-input` → coordinator 디스패치를 실행한다. 원장에는 `session` 결정만 더해진다. 이후 드라이브는 coordinator가 끝까지 맡는다.
- 보존: root는 코드를 읽고 고치거나 구현·리뷰·디버깅을 직접 하지 않는다. light 원장, `light-run.md`, `promote-stop`, A 경로의 coordinator 드라이브와 재디스패치 규칙은 바뀌지 않는다.

#### Interface

- 제공:
  ```ts
  function readDirectMaxCommitTasks(repoRoot: string): number; // invalid·음수는 0
  // PreflightOk에 추가
  direct_eligible: boolean;
  // drive-metrics
  SESSION_KINDS = ['coordinator-session', 'context-review', 'root-direct-session'];
  ```
  - `skills/bouncer-run/references/direct-run.md`, ACQ 선택지 D.
- 거부:
  - `--kind root-direct-session`에 `--target-digest`를 주면 기존 `invalid-metrics-input`이다.
  - 폴백: 설정 invalid는 직접 실행 꺼짐(`direct_eligible: false`)이며 preflight를 실패시키지 않는다.
  - `direct_eligible: false`인데 D를 고를 수 있는 ACQ 문구, root가 accepted가 아닌 판단을 기록하는 절차, 목록에 없는 정지에서 root가 스스로 복구하는 절차, root 직접 구현은 문서에 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/config.ts` | 신규 추출 지점: `readDirectMaxCommitTasks` | Modify | coordinator·metrics 설정 읽기 | `direct_max_commit_tasks` 읽기 | 설정 진입점 |
| `scripts/src/lib/run-preflight.ts` | `runPreflight`, `PreflightOk` | Modify | preflight payload | `direct_eligible` 계산 | 적격 판정 |
| `scripts/src/lib/drive-metrics.ts` | `SESSION_KINDS` | Modify | 세션 kind 검증·합산 | `root-direct-session` 추가 | direct 계측 |
| `scripts/src/lib/cli-metrics-command.ts` | `USAGE_BLOCK`, `USAGE` | Modify | metrics usage | kind 목록 갱신 | CLI 표면 |
| `skills/bouncer-run/SKILL.md` | Role — delegation, step 2·3 | Modify | full 드라이브 단일 controller, 시작 ACQ | direct 예외 한 문장과 D 선택지, A/D 뒤 bootstrap. 늘어난 단어만큼 기존 문장을 줄인다 | 진입 skill |
| `skills/bouncer-run/references/direct-run.md` | 신규 추출 지점: direct 절차 | Create | 없음 | 루프·판단·인계·금지·계측 절차 | 절차 분리 |
| `skills/bouncer-run/references/drive-metrics.md` | Per coordinator session | Modify | 세션 계측 | root-direct 세션 계측 문장 | 계측 절차 |
| `agents/bouncer-coordinator.md` | 도입부(`:10-14`) | Modify | 유일한 controller 선언 | direct 인계로 시작한 세션도 같은 권한임을 명시 | 역할 경계 |
| `.codex/agents/bouncer-coordinator.toml` | 생성물 전체 | Modify | Codex 역할 정의 | 재생성 | 바이트 일치 |
| `rules/cursor-print-dispatch.md` | 1항, 신원 줄 설명 | Modify | coordinator의 worker print dispatch | direct 모드 root의 worker dispatch도 print 프로세스임을 명시 | print 경로 |
| `rules/cli.md` | preflight·metrics 설명 | Modify | CLI 계약 설명 | `direct_eligible`, `root-direct-session` | 문서 계약 |
| `docs/configuration.md` | coordinator 표, 드라이브 설명(`:29-44`) | Modify | 설정·드라이브 설명 | `direct_max_commit_tasks` 행과 direct 모드 한 단락 | 설정 문서 |
| `config.example.json` | `coordinator` 블록 | Modify | 설정 예시 | `"direct_max_commit_tasks": 3` | 설정 예시 |
| `test/run-preflight.test.js` | 신규 케이스 | Modify | preflight 검증 | `direct_eligible` 경계 | 판정 회귀 |
| `test/cli-metrics.test.js` | 신규 케이스 | Modify | metrics CLI 검증 | 새 kind 시작·종료·합산 | kind 계약 |
| `test/skill-bouncer-surface.test.js` | reference 목록(`:285`) | Modify | skill reference 목록 | `direct-run.md` 등록 | surface 계약 |
| `test/skill-bouncer-run.test.js` | ACQ 문구 케이스 | Modify | run skill 문구 검증 | D 선택지·direct-run 참조 | 문구 회귀 |

#### Constraints

- 일곱 진입 `SKILL.md` 단어 수 합계는 8665 미만을 유지한다. 절차 본문은 `direct-run.md`에 둔다.
- 기존 ACQ 형식(``, Re-ground / Recommend-why / Options)을 지키고 권장은 A로 둔다.
- direct 모드도 시작 ACQ 한 번 뒤에는 per-task ACQ를 열지 않는다.
- 역할 문서·TOML은 `test/agents.test.js`, `test/distribution.test.js`, `npm run lint:docs` 계약을 지킨다.

### EPIC-098/BP-002/TASK-006 · `82968e77`

#### Goal & intent

사용자가 같은 직렬 4-task 계획을 기준선(`waves_per_session: 1`)·다중 wave(`auto`)·직접 실행 세 방식으로 실행하고 `bouncer metrics summary`를 기록할 수 있도록, fixture 생성 스크립트·테스트·절차·결과 기록 문서를 `benchmarks/drive-serial-4/`에 둔다. BP 002 변경은 CHANGELOG에 기록한다. 수용 기준은 epic 기준 12·15이며, 생성 스크립트 테스트와 `npm run ci`, BP 최종 리뷰로 판정한다.

#### Current behavior

- `benchmarks/README.md:1-30`은 한국어 설명과 파일 트리(`text` 코드 블록)로 시작한다. 하위 README는 upstream·verifiers·configs·runs·aggregate에 있다. `benchmarks/fixtures/README.md`는 생성 후 gitignore되는 묶음만 다룬다.
- `.gitignore`는 `benchmarks/runs/*`, `benchmarks/fixtures/upstream/`, `benchmarks/fixtures/deepswe/`, `.bouncer/config.json`(저장소 루트), `.bouncer/runtime/`, `scripts/lib/`를 숨긴다. `benchmarks/drive-serial-4/`는 숨기지 않는다.
- `npm test`·`test:coverage`는 bare `node --test`라 `benchmarks/**/*.test.cjs`를 실행한다. `test:unit`·`test:integration`은 `test/tiers.json`만 읽고 그 목록에 benchmarks는 없다. `lint:test-names`는 `test/*.test.js`만, eslint는 `benchmarks/**`를 제외한다(`eslint.config.js:9`, `:25`). `lint:docs`는 docs·benchmarks를 검사하지 않는다(`scripts/check-doc-shape.js:1003-1018`).
- 기존 스크립트 패턴: `benchmarks/prepare-deepswe-task.cjs:4-6`, `:110`, `:139`, `:154`(spawnSync 래퍼, `deps.tmpDir` 주입), `benchmarks/build-upstream-task.cjs:21`, `:31`, `:76`(`run` 래퍼, `git init --quiet`), `benchmarks/run-bouncer-full.cjs:240`, `:279`(`process.execPath`로 `scripts/bouncer` 호출). 테스트 패턴은 `benchmarks/archive.test.cjs:5-51`(mkdtemp·rmSync).
- 승인된 bouncer 계획을 통째로 만드는 helper는 없다. 최소 frontmatter 예는 `test/coordinator.test.js:223`, `:263`이다.
- `docs/README.md`는 사람용 문서를 다섯 개로 제한하므로 측정 기록은 docs가 아니라 benchmarks 아래에 둔다.
- `CHANGELOG.md:8-38`은 `## [Unreleased]` → `### Changed`와 `- **제목 (EPIC 098 BP 001)** — 설명` 형식이다.

#### Target behavior

- 성공(생성): `node benchmarks/drive-serial-4/setup.cjs <빈 디렉터리> --mode <baseline|auto|direct>`가 그 디렉터리에 다음을 만든다.
  - git 저장소와 첫 커밋.
  - `package.json`(`"test": "node --test"`).
  - `.bouncer/config.json`. `baseline`이면 `{"coordinator":{"waves_per_session":1}}`, `auto`면 `"auto"`, `direct`면 `"auto"`에 `"direct_max_commit_tasks":4`를 더한다.
  - approved epic 하나, `scale: full`·`review_scope: blueprint` approved blueprint 하나. commit task 4개(TASKS-001→002→003→004, 각자 `src/stepN.js`·`test/stepN.test.js`, `verify: npm test`, `review_risk: []`)는 ready이고, verification 노드 TASKS-005(`depends_on: [TASKS-004]`)가 있다.
  - 그 blueprint를 가리키는 `bouncer current --set` 포인터. epic 경로는 `.bouncer/context/epics/001-drive-serial`, blueprint 경로는 그 아래 `blueprints/001-serial-four`로 고정한다.
- 성공(테스트): `benchmarks/drive-serial-4/setup.test.cjs`가 임시 디렉터리에 세 모드를 생성하고, 그 임시 디렉터리를 cwd로 `node <repo>/scripts/bouncer run preflight --blueprint <blueprintDir>`를 실행해 다음을 단언한다.
  - `delegable === true`.
  - `shape.drive_shape === 'serial'`, `shape.commit_tasks === 4`.
  - `direct_eligible`은 `direct` 모드에서만 true다.
- 성공(문서):
  - `README.md`: 세 모드의 실행 절차(`/bouncer-run`, 시작 ACQ 선택, `bouncer metrics summary --blueprint <dir>` 수집)와 기록 방법.
  - `results.md`: 결과 표(총 토큰, coordinator 기동 수, root-direct 세션 수, 벽시계 시간, root 컨텍스트 증가, 판단 결과 동일성). 모든 칸은 `미측정`이고, `waves_per_session` 상한 4와 `direct_max_commit_tasks` 3은 "잠정값"으로 표시한다. BP 003 plan context review 전후 표(호출 수·토큰·유효 finding·놓친 blocker/major)도 `미측정`으로 두고, 미확인 사항 절을 둔다.
  - `benchmarks/README.md` 트리에 새 디렉터리를 추가한다.
  - CHANGELOG `Unreleased`에 BP 002 항목을 적는다(다중 wave 세션, DAG 모양 경고와 preflight `shape`, 직접 실행 모드, 측정 fixture).
- 실패: 대상 디렉터리가 없거나 비어 있지 않거나 `--mode`가 세 값 밖이면, 아무것도 쓰지 않고 exit 2와 stderr 사유로 끝난다.
- 보존: 저장소 루트의 `.bouncer/`·config와 기존 benchmarks 스크립트는 바뀌지 않는다.

#### Interface

- 제공: `setup.cjs` CLI(`<dir> --mode <baseline|auto|direct>`)와 `module.exports = { setupDriveSerial4(dir, { mode, bouncerBin }) }`. 함수는 `{ blueprintDir: '.bouncer/context/epics/001-drive-serial/blueprints/001-serial-four' }`를 돌려준다. CLI는 성공 시 그 객체를 JSON 한 줄로 stdout에 쓴다. `bouncerBin`의 기본값은 이 저장소의 `scripts/bouncer`다.
- 거부:
  - 즉시 실패(exit 2): 존재하지 않는 경로, 비어 있지 않은 디렉터리, 모르는 `--mode`. 함수는 같은 경우에 아무것도 쓰기 전에 `code`가 `invalid-target` 또는 `invalid-mode`인 `Error`를 던지고, CLI가 이를 exit 2로 바꾼다.
  - git·`bouncer current --set`이 실패하면 그 stderr를 그대로 내고 exit 1로 끝난다. 이미 만든 파일은 지우지 않는다(사용자 디렉터리이므로).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/drive-serial-4/setup.cjs` | `setupDriveSerial4` | Create | 없음 | fixture 생성 | 측정 입력 |
| `benchmarks/drive-serial-4/setup.test.cjs` | 신규 추출 지점: 생성·preflight 테스트 | Create | 없음 | 세 모드 생성과 preflight 단언, 거절 케이스 | 생성 회귀 |
| `benchmarks/drive-serial-4/README.md` | 측정 절차 | Create | 없음 | 실행·수집 절차 | 사용자 실행 |
| `benchmarks/drive-serial-4/results.md` | 결과 기록 | Create | 없음 | `미측정` 표·잠정값·BP 003 표·미확인 사항 | epic 기준 12 |
| `benchmarks/README.md` | 파일 트리 | Modify | benchmarks 구조 설명 | 새 디렉터리 항목 | 탐색성 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 변경 이력 | BP 002 항목 | epic 기준 15 |

#### Constraints

- 생성 스크립트는 CommonJS `.cjs`이고 외부 의존성을 추가하지 않는다. spawn은 `spawnSync` 래퍼 하나로 모은다.
- 테스트는 실행 전에 빌드가 최신이어야 한다(stale-build). Checklist의 `npm run build`를 먼저 실행한다.
- `results.md`에 측정하지 않은 수치를 쓰지 않는다. 모든 결과 칸은 `미측정`이다.
- 측정 실행 자체는 이 task 범위가 아니다.

### EPIC-098/BP-002/TASK-007

#### Goal & intent

TASKS-001~006이 모두 integration에 통합된 상태에서 `npm run ci`가 통과해, DAG 모양·plan gate 경고·세션 yield·직접 실행·측정 fixture 변경이 함께 빌드·테스트·lint·typecheck·TOML 일치·진입 skill 단어 수 검사를 통과함을 증명한다(epic 기준 15).

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
