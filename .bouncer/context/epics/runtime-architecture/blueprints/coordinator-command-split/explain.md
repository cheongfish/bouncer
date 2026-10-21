---
type: bouncer.explain
title: coordinator-command-split explain
description: Explain for coordinator-command-split
resource: .bouncer/context/epics/runtime-architecture/blueprints/coordinator-command-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T14:55:18.864+09:00'
bouncer:
  id: EXPLAIN-coordinator-command-split
  epic_id: runtime-architecture
  blueprint_id: coordinator-command-split
  status: published
  comprehension:
    - range_from: e953b55f96210ba2f21d03f36bc26f1981e0a309
      range_to: 174c44567bda9cb0d4b49461dfeb59df571d5277
      diff_sha: e5efa55f15932d797986255aa765207d4fc24ff33045b929a1ad13d42083c291
      recorded_at: '2026-10-21T15:00:00+09:00'
  task_commits:
    - task: runtime-architecture/coordinator-command-split/001
      sha: dc8126d2
      intent_anchor: task-001
    - task: runtime-architecture/coordinator-command-split/002
      sha: 4ce8acac
      intent_anchor: task-002
    - task: runtime-architecture/coordinator-command-split/003
      sha: b0911bb7
      intent_anchor: task-003
    - task: runtime-architecture/coordinator-command-split/004
      sha: 336f8fae
      intent_anchor: task-004
    - task: runtime-architecture/coordinator-command-split/005
      sha: 174c4456
      intent_anchor: task-005
---
# Explain

## Background

`coordinate` 명령은 원장(ledger) 잠금, fence, lease 규칙으로 drive 상태를 지키는 Bouncer의 핵심 경로다. 그런데 `coordinator` facade가 helper까지 22개를 내보내 소비자가 내부를 직접 조립했고, `coordinate()` 하나가 서브명령 19개를 `if (command === …)` 연쇄로 처리했다. 원장을 연 뒤 fence를 확인하는 순서도 일곱 곳에 따로 적혀 있었다. 순서를 한 곳만 바꿔도 거절 reason이 달라질 수 있는 구조였다.

이번 변경은 동작을 바꾸지 않는 분해다. 서브명령 이름·플래그·출력, 거절 reason, 잠금·fence·lease 계약은 그대로이고, 경계만 좁혔다.

## Code

- `scripts/src/lib/coordinator.ts`: facade. 공개 이름은 `coordinate`, `COORDINATE_FAILURE_HINTS`, `withCoordinateFailureHints` 셋뿐이다. 호환용 재export는 두지 않았다.
- `scripts/src/lib/coordinator-ledger.ts`, `coordinator-worker.ts`: 원장·lease 계열과 worker 계열 helper의 정본 모듈. 소비자는 여기서 직접 가져온다. 일부 helper(`readyWaveGated`, `maxParallelForRead`, `currentScopePaths`, `normalizeSupplementPath`, `porcelainPaths`)는 공유 때문에 export 범위가 설계 의도보다 넓다.
- `scripts/src/lib/coordinator-commands.ts`: `coordinate()`는 서브명령을 골라 handler 표로 넘기기만 한다. 원장을 연 뒤 순서는 `openLedgerFenced`(원장 읽기 → lease 형태 검사 → 호출자 validate → fence)로, 잠금을 풀었다 다시 잡은 뒤 재확인은 `recheckLedgerCheckpoint`로 모았다. 재확인은 hash 불일치에서만 `onStale` 정리 훅을 부르고 fence 거절에는 부르지 않는다.
- `scripts/src/lib/coordinator-repair.ts`: repair·partial-close·critical-recovery 계열 handler를 옮긴 모듈. 순환 import를 피하려고 공유 helper는 `RepairSupport`로 주입한다. salvage 타입이 두 모듈에 중복되어 있는 점은 알려진 약점이다.
- `scripts/src/lib/cli-git-commands.ts`: `cmdCoordinate`의 인자 조립을 서브명령 단위 함수로 나눴다. `lease-id`·`ledger-path`·`ledger-hash`와 boolean 플래그 일부는 아직 대응 표 밖에서 직접 매핑한다.
- `critical-recovery`의 1단계 사전 검사(`criticalRecoveryPrecheck`)는 dispatcher 쪽에 남아 있다.

## Quiz

(퀴즈 문항은 채팅에서 제시했다. 정답과 응답은 기록하지 않는다.)

## Tasks

### runtime-architecture/coordinator-command-split/001 · `dc8126d2`

#### Goal & intent

`scripts/src/lib/coordinator.ts` facade를 `coordinate`·`COORDINATE_FAILURE_HINTS`·`withCoordinateFailureHints` 세 개로 줄인다. 지금 facade로 helper를 가져가는 소비자(src 3곳, 테스트)는 helper의 정본 모듈에서 직접 가져온다. 아직 `coordinator-commands.ts`에만 있는 helper는 먼저 책임 모듈로 옮긴다. 수용 기준은 epic 성공 기준 5(facade 부분)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `coordinator.ts:5-27`이 22개를 `commands.*`에서 재export하고, `coordinator-commands.ts:5552-5558`도 같은 22개를 export한다. 정의 위치: `projectCheckpoint` `:438`(도우미 `summarizeCompletedTask` `:377`, `projectActiveTask` `:405`), `reportPathFor` `:209`, `taskBriefHashOf` `:528`, `isBlueprintReviewModeAt` `:1652`, `readBouncerBlock` `:2105`, `workerCommitEvidence` `:2144`, `workerScopeDirtyPaths` `:2194`, `assertLeaseShape` `:2294`, `ensureIntegrationCwd` `:2921`, `COORDINATE_FAILURE_HINTS` `:4983`, `withCoordinateFailureHints` `:5529`, `coordinate`=`coordinateWithHints` `:5548`. 재export만 하는 것: `readyWave`·`transition`(`execution-dag`, `:31`), `normalizeCommitSha`(`commit-sha`, `:21`), `loadLedger`·`loadLedgerBytes`·`assertLedgerFence`·`LEDGER_REL`(`coordinator-ledger`, `:55-57,64`), `registeredIntegration`·`registeredWorker`·`initialWorktreeState`(`coordinator-git`, `:58-60`).
- `coordinator-ledger.ts:84`는 `atomicWrite, loadLedgerBytes, loadLedger, ledgerBytesHash, assertLedgerFence, writeOwnedLedger, LEDGER_REL`을 export한다.
- src 소비자: `cli-git-commands.ts:408`(`loadLedgerBytes`), `:447`(`withCoordinateFailureHints` — `:510,659,667,682`), `:649`(`assertLedgerFence`·`projectCheckpoint`·`loadLedgerBytes`); `coordinate-next.ts:7`(`reportPathFor` `:337,800,939`, `workerCommitEvidence` `:997-998`, `workerScopeDirtyPaths` `:1019`, 그 밖에 `registeredIntegration`·`ensureIntegrationCwd`·`assertLeaseShape`·`isBlueprintReviewModeAt`·`initialWorktreeState`·`taskBriefHashOf`·`readBouncerBlock`·`COORDINATE_FAILURE_HINTS`); `run-preflight.ts:21-22`(`loadLedger`).
- 테스트 소비자: `coordinator.test.js:9`(`readyWave`·`transition`), `:38`(힌트 두 개), `coordinator-e2e.test.js:15`(`COORDINATE_FAILURE_HINTS`·`loadLedger`), `coordinate-next.test.js:333,337,352`(`COORDINATE_FAILURE_HINTS`), `runtime-state.test.js:783`(`LEDGER_REL`), `distribution.test.js:136-142`(12개 이름이 함수인지 확인 — 배포 런타임이 `node_modules` 없이 로드되는지 보는 표본). 나머지 테스트는 `.coordinate`만 쓴다.
- 경계 테스트: `dependency-boundaries.test.js:41-43`(`coordinator-ledger`·`coordinator-git`·`coordinator-verification`은 `coordinator`에 도달 금지), `:52-56`(execution 영역 밖은 `coordinator-commands` import 금지), `:16`(순환 금지).

#### Target behavior

- 성공: `Object.keys(require('./scripts/lib/coordinator')).sort()`가 `['COORDINATE_FAILURE_HINTS', 'coordinate', 'withCoordinateFailureHints']`다. `projectCheckpoint`(도우미 포함)·`assertLeaseShape`는 `coordinator-ledger`에서, `reportPathFor`·`taskBriefHashOf`·`isBlueprintReviewModeAt`·`readBouncerBlock`·`workerCommitEvidence`·`workerScopeDirtyPaths`·`ensureIntegrationCwd`는 신규 `coordinator-worker`에서 export되고, `coordinator-commands`는 이를 import해 쓴다. src·테스트 소비자는 위 정본 모듈에서 가져온다. `distribution.test.js`는 facade 3개와 이동한 모듈의 대표 함수가 로드되는지 확인한다.
- 실패: facade로 이동한 helper를 가져오면 `undefined`다(호환 wrapper를 두지 않는다).
- 보존: `coordinate` 동작·출력·reason은 바뀌지 않는다. helper 함수의 시그니처와 동작은 바뀌지 않는다.

#### Interface

- 제공: `coordinator` = `{ coordinate, COORDINATE_FAILURE_HINTS, withCoordinateFailureHints }`. `coordinator-ledger`에 `projectCheckpoint`, `assertLeaseShape` 추가. 신규 `coordinator-worker` = `{ reportPathFor, taskBriefHashOf, isBlueprintReviewModeAt, readBouncerBlock, workerCommitEvidence, workerScopeDirtyPaths, ensureIntegrationCwd }`.
- 거부: `coordinator-ledger`·`coordinator-worker`는 `coordinator`·`coordinator-commands`를 import하지 않는다. facade에 호환용 재export를 남기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | facade `export =` | Modify | 22개 재export | 명령 API 3개만 | 공개 경계 |
| `scripts/src/lib/coordinator-commands.ts` | 이동 helper, `export =` | Modify | helper 정의와 22개 export | helper를 import로 바꾸고 export를 명령 API로 축소 | 정의 위치 |
| `scripts/src/lib/coordinator-ledger.ts` | `projectCheckpoint`, `assertLeaseShape` | Modify | 원장 읽기·fence | checkpoint projection·lease shape 추가 | 원장 정본 |
| `scripts/src/lib/coordinator-worker.ts` | 신규 추출 지점: worker·dispatch 조회 | Create | 없음 | worker 조회 helper 7개 | coordinate-next 소비 |
| `scripts/src/lib/coordinate-next.ts` | helper import | Modify | facade로 helper 조회 | 정본 모듈 import | 소비자 |
| `scripts/src/lib/cli-git-commands.ts` | `loadLedgerBytes`·`assertLedgerFence`·`projectCheckpoint` import | Modify | facade로 원장 helper 조회 | `coordinator-ledger` import | 소비자 |
| `scripts/src/lib/run-preflight.ts` | `loadLedger` import | Modify | facade로 조회 | `coordinator-ledger` import | 소비자 |
| `test/coordinator.test.js` | `readyWave`·`transition` import | Modify | facade 조회 | `execution-dag` import | 소비자 |
| `test/coordinator-e2e.test.js` | `loadLedger` import | Modify | facade 조회 | `coordinator-ledger` import | 소비자 |
| `test/runtime-state.test.js` | `LEDGER_REL` import | Modify | facade 조회 | `coordinator-ledger` import | 소비자 |
| `test/distribution.test.js` | coordinator 로드 표본 | Modify | facade 12개 이름 확인 | facade 3개와 이동 모듈 표본 확인 | 배포 로드 검사 |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS.execution` | Modify | coordinator 계열 6개 | `coordinator-worker` 추가 | 영역 판정 |

#### Constraints

- `scripts/src/lib` 의존 순환 0을 유지한다(`test/dependency-boundaries.test.js:16`).
- 이동하는 helper가 `coordinator-commands` 내부 함수에 의존하면 그 함수도 같은 정본 모듈로 옮기거나 인자로 받는다. 정본 모듈에서 `coordinator-commands`를 import하지 않는다.
- reason 리터럴을 가진 helper를 옮기면 그 모듈 이름이 `coordinator-`로 시작하고 `coordinator.ts`에서 require 체인으로 도달해야 한다(`test/coordinator.test.js:174-190`).

### runtime-architecture/coordinator-command-split/002 · `4ce8acac`

#### Goal & intent

`scripts/src/lib/coordinator-commands.ts`에서 잠금 안 원장을 여는 반복 순서를 helper 두 개로 묶는다. (1) 처음 여는 경로: 원장 읽기 → 없으면 `missing-ledger` → `assertLeaseShape` → 선택 사전 검사(`validateCoordinatorLedger`) → `assertLedgerFence`. (2) 재확인 경로: 원장 읽기 → 없으면 `missing-ledger` → phase1 hash가 있으면 그 hash와 다를 때 `stale-ledger-checkpoint`, phase1 hash가 없으면(`finishFaninAfterFf`의 첫 진입) 호출자가 넘긴 fence로 `assertLedgerFence`. 거절 reason과 그 순서는 바뀌지 않는다. 수용 기준은 epic 성공 기준 4(잠금 안 원장 열기·fence 확인 순서)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 계획 시점 HEAD `d2af6719` 기준 `withLedgerLock` 호출 18곳 중 처음 여는 경로가 일곱 곳이다: `supplementDone` phase1 `:828`(fence 뒤 `promotion_stopped`), `prepareCoordinator` phase1 `:2634`(fence 뒤 `promotion-stopped`), `integrateVerificationTask` phase1 `:3015`(fence 뒤 task 조회), `integrateLightCommitWave` `:3267`, `integrateCommitWave` recovery `:3511`·phase1 `:3576`(셋 다 lease 뒤 `validateCoordinatorLedger`, 그 뒤 fence), `coordinate` 본체 `:4206`. 재확인 경로는 `supplementDone` phase2 `:887`, `prepareCoordinator` phase3 `:2857`, `integrateVerificationTask` phase2 `:3077`, `finishFaninAfterFf` `:3900`(phase1 hash가 없으면 fence, 있으면 hash 대조)이다. 나머지(`:1777`, `:2600`, `:3692-3834`)는 원장 부재와 `owns`만 보며 이 task 대상이 아니다. 줄 번호는 `TASKS-001` 이동 뒤 달라지므로 함수 이름으로 찾는다.
- 정의: `withLedgerLock` `scope.ts:299`, `loadLedgerBytes` `coordinator-ledger.ts:23`(파일 없으면 `null`), `assertLedgerFence` `coordinator-ledger.ts:45`(자체 순서 `ledger-checkpoint-invalid` → `stale-ledger-checkpoint` → `run-detached`), `assertLeaseShape`(`TASKS-001` 뒤 `coordinator-ledger`).
- I/O 관찰 지점: lock은 `${ledgerFile}.lock`을 `wx`로 만들고(`scope.ts:311`), `owns()`가 lock 기록을 다시 읽는다(`:334`). 원장 쓰기는 `writeOwnedLedger`(`coordinator-ledger.ts:76`)가 `owns`를 확인한다.
- 테스트: 개별 reason은 `cli-coordinate.test.js:652,929,951`(`ledger-checkpoint-invalid`), `coordinator.test.js:2619-2642`(fence 8가지), `:3095-3111`(`lease-invalid`), `current.test.js:1397`, `runtime-state.test.js:841-848`이 고정한다. 원장 부재·lease 손상·stale fence가 겹칠 때의 우선순위를 직접 고정한 테스트는 없다.

#### Target behavior

- 성공: 위 일곱 곳은 처음 여는 helper를, 네 곳은 재확인 helper를 호출한다. helper는 `{ ok: true, ledger, bytes }` 또는 기존과 같은 `{ ok: false, reason }`을 돌려준다. 명령별 후속 검사(`promotion_stopped`, task 조회)는 호출부에 남는다.
- 실패: 손상 lease와 stale fence가 함께 있으면 `lease-invalid`, 원장이 없으면 fence 값과 무관하게 `missing-ledger`, `validateCoordinatorLedger`가 거절하면 fence 검사 전에 그 reason을 낸다.
- 보존: 검증 실행은 잠금 밖에 남는다. `owns`를 쓰는 곳은 helper가 `owns`를 숨기지 않고 호출부가 계속 받는다. lock·원장 파일 I/O 순서는 바뀌지 않는다.

#### Interface

- 제공(모듈 내부): `신규 추출 지점: 잠금 안 원장 열기·fence 확인` — 입력 `{ ledgerFile, ledgerPath, ledgerHash, validate?: (ledger) => Fail | null }`, 출력 `{ ok: true, ledger, bytes } | Fail`. `신규 추출 지점: phase checkpoint 재확인` — 입력 `{ ledgerFile, expectedHash: string | null, fence?: { ledgerPath, ledgerHash } }`. `expectedHash`가 문자열이면 hash 대조, `null`이면 `fence`로 `assertLedgerFence`를 부른다(`fence`가 없으면 `ledger-checkpoint-invalid`). 출력 같은 모양.
- 거부: helper는 lock을 잡지 않는다(호출부의 `withLedgerLock` 콜백 안에서만 부른다). helper를 `export`에 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `supplementDone`, `prepareCoordinator`, `integrateVerificationTask`, `integrateLightCommitWave`, `integrateCommitWave`, `finishFaninAfterFf`, `coordinate` | Modify | 각자 원장 열기·fence 반복 | helper 두 개로 대체 | 반복 지점 |
| `test/coordinator.test.js` | reason 우선순위 테스트 | Modify | 개별 reason만 고정 | 겹친 실패의 우선순위 단언 추가 | 보존 계약 |

#### Constraints

- 잠금 밖 검증·잠금 안 재확인 순서를 보존한다. helper 도입으로 검증 실행 위치가 바뀌면 안 된다.
- reason 문자열을 새로 만들지 않는다(`COORDINATE_FAILURE_HINTS` 완전성 검사 대상).

### runtime-architecture/coordinator-command-split/003 · `b0911bb7`

#### Goal & intent

`coordinate()`(계획 시점 `coordinator-commands.ts:4031-4976`)를 서브명령 handler 표로 바꾼다. 본체는 공통 준비(인자·경로·lock·원장 열기)를 하고 표에서 handler를 골라 문맥 객체와 함께 위임한다. 서브명령 판정 순서·거절 reason·출력은 바뀌지 않는다. 이 task는 handler를 같은 파일 안 함수로 만들고, repair 계열의 모듈 분리는 `TASKS-004`가 한다. 수용 기준은 epic 성공 기준 5(`coordinate()` 본체 위임·150줄 이하)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 계획 시점 HEAD 기준 구조(`TASKS-001·002` 뒤 줄 번호는 달라진다):
  - 공통 준비 `:4052-4058`(`exec`, `writeLedger`, `makeLeaseId`, 비 git 루트 거절, `base`, `paths`).
  - lock 전 분기: `bootstrap` `:4059-4150`(유일하게 `paths`·`base` 사용, 자체 원장 쓰기), 두 번째 준비 `:4151-4154`(`integration` 경로, `registeredIntegration` 가드), `status` `:4156-4175`, `integrate` `:4178-4184`(내부 lock), `prepare` `:4187-4191`(내부 lock), fence 명령 집합 가드 `:4193`(`LEDGER_FENCED_COMMANDS` `:70-73`), `repair --kind supplement --done` `:4198-4204`(`supplementDone`, 자체 2단계 lock).
  - 공통 lock `:4206-4975`: `:4207-4221`이 `ledger`·`ledgerBytes`·lease·fence·`commitWrite`(`owns` 확인 쓰기)를 준비한다.
  - lock 안, task 조회 전: `promote-stop` `:4226`, `session-open` `:4280`, `worker-model|worker-tokens` `:4307`, `critical-recovery` 1단계(검증만, 통과 시 아래로 진행) `:4352`, `partial-close` `:4357`, `revoke` `:4412`, `repair` `:4433-4686`.
  - 공통 task 조회 `:4687-4689`(`item`), `dispatch|report|record` lease 검사 `:4692-4705`, `critical-recovery` 2단계(변경) `:4706-4739`, `dispatch|report` 공통 가드 `:4740-4763`, `dispatch` `:4764`, `report` `:4817`, `record` `:4891`, `rerecord` `:4944`, 그 밖 `unknown-coordinate-command` `:4974`.
- 공개 경로: `coordinateWithHints`(`:5548`)가 `coordinate`를 감싸 실패 힌트를 붙인다.
- `coordinate`는 provenance가 없다(`bouncer intent` 결과 unresolved).
- 테스트: `coordinator.test.js`(명령별 대표 `:149,155,382,386,456,527,555,631,888,2493,2678,4556,5253,5368`), `coordinator-e2e.test.js:210-932`, `cli-coordinate.test.js:109-1189`(`session-open` `:1189`), `coordinate-next.test.js:108,652,1448`.

#### Target behavior

- 성공: `coordinate()` 본체는 공통 준비, handler 표 조회, 위임만 하며 TypeScript AST로 잰 함수 선언 줄 수가 150 이하다. 단계와 handler는 아래 표대로 실행한다(위에서 아래 순서).

  | 단계 | 대상 명령 | 내용 |
  | --- | --- | --- |
  | lock 전 | `bootstrap`·`status`·`integrate`·`prepare` | 각 handler가 끝까지 처리(내부 lock은 기존 함수가 잡음) |
  | fence 가드 | `LEDGER_FENCED_COMMANDS` | 지금과 같은 위치에서 검사 |
  | lock 전·fence 가드 뒤 | `repair --kind supplement --done` | `supplementDone`이 자체 2단계 lock으로 처리 |
  | lock 안·task 조회 전 | `promote-stop`·`session-open`·`worker-model`·`worker-tokens`·`partial-close`·`revoke`·`repair` | 각 handler가 끝까지 처리 |
  | lock 안·task 조회 전 | `critical-recovery` | 1단계 검증만, 통과하면 다음 단계로 진행 |
  | task 조회 | 나머지 전부 | `item` 조회 |
  | lease 검사 | `dispatch`·`report`·`record`만 | `rejectLeaseMismatch` |
  | 공통 가드 | `dispatch`·`report`만 | worker·light·verification 가드 |
  | task 조회 뒤 handler | `critical-recovery`(2단계)·`dispatch`·`report`·`record`·`rerecord` | 각 handler가 끝까지 처리 |

  `critical-recovery` 2단계와 `rerecord`는 lease 검사를 받지 않고, `record`·`rerecord`·`critical-recovery`는 공통 가드를 받지 않는다(현재 동작 그대로).
- 실패: 표에 없는 명령은 지금처럼 `unknown-coordinate-command`를 돌려준다. fence 명령 집합 가드는 handler 조회 전에 그대로 실행된다.
- 보존: `critical-recovery`는 1단계 검증(task 조회 전)과 2단계 변경(task 조회 뒤, lease 검사 제외)의 순서를 유지한다. 모든 서브명령의 reason·출력 JSON·원장 쓰기 순서가 바뀌지 않는다.

#### Interface

- 제공(모듈 내부): `신규 추출 지점: lock 안 handler 문맥` — 최소 `{ args, deps, exec, main, integration, ledger, ledgerBytes, commitWrite }`, task 조회 뒤 handler는 `item`을 더 받는다. handler 시그니처는 `(ctx) => CoordinateResult`.
- 거부: handler 표를 export하지 않는다. handler가 lock을 다시 잡지 않는다(lock 전 handler 중 내부 lock을 가진 기존 함수 `prepareCoordinator`·`integrateTask`·`supplementDone`은 그대로 호출).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `coordinate`, 신규 handler 함수들 | Modify | 946줄 if 연쇄 | handler 표와 서브명령별 함수 | 진입점 |

#### Constraints

- 동작 보존 리팩터다. 테스트 단언을 바꾸지 않는다.
- `LEDGER_FENCED_COMMANDS`와 handler 표의 명령 집합이 어긋나면 안 된다(fence 명령은 모두 표에 있다).

### runtime-architecture/coordinator-command-split/004 · `336f8fae`

#### Goal & intent

`TASKS-003`이 만든 handler 중 실패 복구 계열(`repair`·supplement 완료·`partial-close`·`critical-recovery`)과 그 helper를 신규 `scripts/src/lib/coordinator-repair.ts`로 옮긴다. `coordinator-commands`는 handler 표에서 이 모듈의 handler를 가져온다. 동작·reason·출력은 바뀌지 않는다. 수용 기준은 epic 성공 기준 5·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 계획 시점 HEAD 기준 복구 계열 최상위 함수(`coordinator-commands.ts`): `sourceRepairPaths` `:536`, `checkRepairIntake` `:576`, supplement 계열 `normalizeSupplementPath` `:621`·`isSupplementTestPath` `:633`·`coveredByPaths` `:647`·`latestSupplementDecision` `:661`·`rootReviewHasDelta` `:680`·`finalReviewDiscoveryStored` `:707`·`integrationChangedPaths` `:730`·`porcelainPaths` `:743`·`checkSupplementIntake` `:778`·`supplementDone` `:820-913`, terminal failure·문서 계열 `resolveTerminalFailure` `:966-1122`·`downstreamTasks` `:1123`·`writeResumeDocuments` `:1150`·`dagSnapshot` `:1192`·`nextLedgerRevision` `:1196`·`integratedLeaves` `:1201`·`resolveRepairVerify` `:1219`·`readReviewFindingLines` `:1287`·`formatReviewFindingLine` `:1320`·`writeRepairDocuments` `:1350-1479`, partial-close 계열 `writePartialCloseBlueprint` `:1480`·`appendMainHandoff` `:1499-1540`. `readyWaveGated` `:914`는 이 구간에 있지만 `bootstrap`이 쓰는 정상 경로 helper라 옮기지 않는다.
- 호출은 모두 `coordinate()` 안이다(`:4200,4390,4395,4445,4467,4485,4548,4550,4608,4636,4638,4673`). `sourceRepairPaths`는 내부에서도 쓰인다(`:580,788,995`).
- I/O 관찰 지점: `porcelainPaths`의 `git status`(`:744`), `supplementDone` 검증 실행(`:870`, 잠금 밖)과 phase2 lock(`:887`), `resolveTerminalFailure`의 git(`:1012,1068`), 문서 쓰기 `writeResumeDocuments`(`:1161,1166`)·`writeRepairDocuments`(`:1459-1476`, rmSync 롤백)·`writePartialCloseBlueprint`(`:1486-1487`), main checkout 쓰기 `appendMainHandoff`(`:1515-1532`, `wx` 임시 파일 + rename + 롤백, `deps.appendHandoff`로 주입 가능).
- `rules/planning.md:20-24`는 terminal verification node를 설명하며 "실패한 실행의 상태 전이는 `scripts/src/lib/coordinator-commands.ts`가 소유한다"고 적는다.
- 규칙 소유 문서: `docs/architecture/rule-ownership.md:63` `GOV-COORD-REPAIR-WRITE`가 `function writeRepairDocuments` / `한 write 단위` locator의 owner를 `scripts/src/lib/coordinator-commands.ts`로 적고, `test/rule-ownership.test.js:313-333`이 owner 파일에 locator가 있는지 검사한다. 같은 문서 `:27` `GOV-SIZING-VERIFY-RUN`은 `function writeVerificationTaskStatus`(`coordinator-commands.ts:1609`)를 가리킨다.
- 경계 테스트: `test/coordinator.test.js:174-190`은 `coordinator.ts`에서 require로 도달하는 `coordinator-*` 모듈의 `reason: '…'`을 모두 훑어 `COORDINATE_FAILURE_HINTS`에 힌트가 있는지 본다. `test/dependency-boundaries.test.js:16`은 순환을 금지한다.
- 테스트: `coordinator.test.js:456,555,631,4907,4937,5562,5581`, `coordinator-e2e.test.js:710`, `cli-coordinate.test.js:379`, `coordinate-next.test.js:652`.

#### Target behavior

- 성공: 위 복구 계열 함수와 handler가 `coordinator-repair`에 있고, `coordinator-commands`는 이를 import한다. `coordinator-repair`는 `coordinator-commands`·`coordinator`를 import하지 않는다. reason 완전성 검사가 `coordinator-repair`의 reason을 포함해 통과한다.
- 실패: 복구 계열이 정상 경로 helper(`git`, 경로 계산 등)를 필요로 하면 그 helper는 하위 모듈(`coordinator-git`·`runtime-state` 등)에서 가져오거나 인자로 받는다. 순환이 생기면 거절한다.
- 보존: supplement 완료의 잠금 밖 검증·잠금 안 재확인, `appendMainHandoff`의 롤백, repair 문서 쓰기 롤백 순서가 바뀌지 않는다.

#### Interface

- 제공: `coordinator-repair` — 복구 handler와 `supplementDone`. 그 밖의 helper는 모듈 내부다.
- 문맥·결과 타입: `coordinator-repair`는 자기가 읽는 필드만 가진 문맥 타입(`args`·`deps`·`exec`·`main`·`integration`·`ledger`·`ledgerBytes`·`commitWrite` 중 필요한 것)과 결과 타입(`{ ok: boolean; reason?: string } & Record<string, unknown>`)을 스스로 선언한다. `coordinator-commands`의 `TASKS-003` 문맥 객체가 구조적으로 그 타입을 만족해 그대로 넘긴다. 공유 타입을 위해 `coordinator-commands`나 새 계약 모듈을 import하지 않는다.
- 거부: `coordinator-repair`를 facade에 노출하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | 복구 계열 함수와 handler | Modify | 정의와 호출 | 정의 이동, import로 위임 | 이동 원점 |
| `scripts/src/lib/coordinator-repair.ts` | 신규 추출 지점: 실패 복구 handler | Create | 없음 | 복구 계열 정의 | 이동 대상 |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS.execution` | Modify | coordinator 계열 목록 | `coordinator-repair` 추가 | 영역 판정 |
| `docs/architecture/rule-ownership.md` | `GOV-COORD-REPAIR-WRITE` 행 | Modify | owner `scripts/src/lib/coordinator-commands.ts`, consumers `scripts/lib/coordinator-commands.js` | owner·consumers를 `coordinator-repair`로 변경 | `test/rule-ownership.test.js:313-333`이 owner 파일의 locator를 검사 |
| `rules/planning.md` | terminal verification 절의 소유 문장 | Modify | 실패한 실행의 상태 전이 소유를 `coordinator-commands.ts` 하나로 적음 | verification task 상태 쓰기는 `coordinator-commands.ts`, terminal failure 복구는 `coordinator-repair.ts`로 나눠 적음 | 규칙 문서의 소유 경로 |

#### Constraints

- 동작 보존 리팩터다. 테스트 단언을 바꾸지 않는다.
- 모듈 이름은 `coordinator-`로 시작해야 reason 완전성 검사에 들어간다.
- `writeVerificationTaskStatus`는 정상 검증 경로 함수라 옮기지 않는다(`rule-ownership.md:27` owner 유지).
- `writeRepairDocuments`의 함수 주석(`한 write 단위` 구절)은 함수와 함께 옮긴다.

### runtime-architecture/coordinator-command-split/005 · `174c4456`

#### Goal & intent

`scripts/src/lib/cli-git-commands.ts`의 `cmdCoordinate()`(계획 시점 `:441-811`)를 갈래별 함수와 플래그→필드 대응 표로 나눈다. 원장 helper import는 `TASKS-001`이 이미 `coordinator-ledger`로 옮겨 두었으므로 이 task는 import를 바꾸지 않고, revise·`status --write-input`의 원장 읽기 순서를 그대로 갈래 함수로 옮긴다. CLI 인자·출력 JSON·exit code는 바뀌지 않는다. 수용 기준은 epic 성공 기준 5(`cmdCoordinate()` 본체 위임·150줄 이하)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `cmdCoordinate` 구간: 지연 require `:443-452`, help `:453-463`(`argvRequestsHelp` → `coordinateUsage`/`coordinateRegistryUsage`, exit 0), 허용 명령·`--blueprint` 검사 `:474-484`(usage exit 2), `--write-input`은 status 전용 `:485-493`, fence 명령 집합 `:469-473`과 fence 누락 처리 `:498-514`(`worker-model`·`worker-tokens`는 usage 2, 나머지는 JSON `ledger-checkpoint-invalid` exit 1), 서브명령별 플래그 검사 `:516-639`, `revise` `:640-693`, `next` `:694-719`(`coordinateNext`), `advance` `:720-753`(`--max-steps` 검사 `:728-738`), 공통 `coordinate()` 호출 `:754-810`(인자 객체 조립 `:759-796`, `compactCoordinateOutput` → `writeCoordinatorInput` → 출력 → `ok ? 0 : 1`).
- 계획 시점 HEAD 기준이다. `TASKS-001` 통합 뒤에는 아래 원장 helper가 facade가 아니라 `coordinator-ledger`에서 import돼 있다.
- 원장 직접 읽기: `writeCoordinatorInput`(`:402-429`)이 `loadLedgerBytes`(`:412`)로 `ledger.base`를 읽고 파일을 쓴다(`:426-427`). `revise`(`:649-691`)는 `revise`가 `coordinate()`가 아니라 `scope.reviseTaskScope`로 처리되므로 CLI가 `process.cwd()` 원장에 대해 fence를 직접 확인하고(`:657-663`), 수정 뒤 원장을 다시 읽어 `projectCheckpoint`를 붙인다(`:687-689`). 이유는 주석 `:641-647,655-656`.
- I/O 관찰 지점: `io.out` `:458,460,511,660,667,682,691,713,747,808`, `io.err` `:683,716,750,810`, `process.cwd()` `:425,650,708,710,742,761,763,803`, 파일 쓰기 `:426-427`. 자체 spawn은 없다.
- 테스트: `cli-coordinate.test.js:140,154,556`(revise), `:958,971,979`(next), `:994,1005-1008`(advance), `:1019-1056`(`--write-input`), `:1109-1117`(report checkpoint projection); `cli-help.test.js:316-517`(coordinate help).

#### Target behavior

- 성공: `cmdCoordinate`는 help·공통 검사·fence 확인 뒤 갈래 함수(`revise`·`next`·`advance`·공통 호출) 중 하나에 위임하고, TypeScript AST로 잰 함수 선언 줄 수가 150 이하다. 플래그→`coordinate` 인자 필드 대응은 표 하나에서 읽는다.
- 실패: 기존 usage 오류(exit 2)·JSON 거절(exit 1) 메시지와 순서가 바뀌지 않는다.
- 보존: revise의 fence는 계속 `process.cwd()` 원장 한 snapshot에 묶인다. `--write-input` 파일 내용과 위치가 바뀌지 않는다.

#### Interface

- 제공(모듈 내부): `신규 추출 지점: coordinate 플래그→필드 대응 표`, 갈래 함수 `(rest, flags, io) => number`.
- 거부: 새 CLI 플래그를 받지 않는다. 표에 없는 플래그 처리는 지금과 같다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, `writeCoordinatorInput` | Modify | 371줄 단일 함수(`TASKS-001` 뒤 원장 helper는 `coordinator-ledger` import) | 갈래 함수·대응 표로 분리 | 진입점 |

#### Constraints

- 동작 보존 리팩터다. 테스트 단언을 바꾸지 않는다.
- `cli-git-commands`의 기능 모듈 require는 계속 함수 안 지연 require로 둔다(CLI 지연 로딩 계약).

### runtime-architecture/coordinator-command-split/006

#### Goal & intent

다섯 commit task가 모두 통합된 결과에서 `npm run ci`가 한 번에 통과함을 증명한다. emit 검사·coverage 임계값·unit tier·lint·문서 검사·typecheck·테스트 이름 검사·audit가 모두 통과해야 하며, 이것이 epic 성공 기준 7의 이 blueprint 몫이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.