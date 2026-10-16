---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/106-source-restructuring/blueprints/001-foundation-cleanup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-16T15:14:47.574+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '106'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: c94947e7737074e58ca882b59b9215c192051e6b
      range_to: ca5162d045b3ccd7af0ae036825c8ef2bae5a0f3
      diff_sha: 1904f5589f3fd22b58e9290d88d62263282642b0f561e3fa375d74a09f0d9133
      recorded_at: '2026-10-16T15:40:00+09:00'
  task_commits:
    - task: EPIC-106/BP-001/TASK-001
      sha: e6e02bbd
      intent_anchor: task-001
    - task: EPIC-106/BP-001/TASK-002
      sha: 347ba38c
      intent_anchor: task-002
    - task: EPIC-106/BP-001/TASK-003
      sha: d1acf084
      intent_anchor: task-003
    - task: EPIC-106/BP-001/TASK-004
      sha: c119ba5c
      intent_anchor: task-004
    - task: EPIC-106/BP-001/TASK-005
      sha: 7c05c859
      intent_anchor: task-005
    - task: EPIC-106/BP-001/TASK-006
      sha: ca5162d0
      intent_anchor: task-006
---
# Explain

## Background

리뷰 위험도 enum과 리뷰 관점 목록, Task·ledger 타입이 여러 파일에 사본으로 흩어져 있었다. 사본마다 "함께 고쳐라"는 주석만 있어서 한쪽만 고치면 S30 검증과 Execute 경로의 허용 목록이 어긋날 수 있었다.

`current`는 `readyWave` 하나를 쓰려고 `coordinator` 전체를 가져왔다. 그래서 `verification → current → coordinator → verification` 순환이 생겼다.

이 변경은 정본 모듈을 만들고 DAG·경로 규칙을 I/O 없는 하위 모듈로 내려 순환을 끊는다. 이후 소스 재구성 blueprint가 쓸 소비자·경계 inventory도 문서로 남긴다.

## Intuition

여러 장부에 복사해 두던 기준표를 한 곳에 두고, 규칙 계산기는 배선 없는 부품으로 분리했다. 읽기만 하는 모듈은 이제 계산기만 가져가고 coordinator 전체를 끌고 오지 않는다.

## Code

- `scripts/src/lib/review-policy.ts`: `REVIEW_RISK_ENUM`, `REVIEW_PERSPECTIVE` 정본. 값과 순서는 그대로이며 다른 lib을 가져오지 않는다.
- `scripts/src/lib/execution-contracts.ts`: Task·ledger 계열 타입 정본. `scope.ts`가 `coordinator`를 가져오지 못하는 제약 때문에 `Ledger`에 필요한 보조 타입도 여기에 둔다.
- `scripts/src/lib/execution-dag.ts`: `readyWave`, `tasksConflict`, `transition`, `normalizeOverlapPath`. `pathSetOf`는 coordinator의 scope 보충·감사 경로도 같은 충돌 판정 집합을 써야 해서 함께 export한다.
- `scripts/src/lib/path-overlap.ts`: `pathsOverlap` 정본. `validate-sections`는 같은 이름으로 재export한다.
- `current.ts`의 `coordinator` 간선이 사라져 `verification → current → coordinator` 순환이 없어졌다. `test/dependency-boundaries.test.js`와 `test/helpers/module-graph.js`가 이를 지킨다. 모듈 그래프는 정규식으로 파싱하고 빌드 상대 `../vendor` require는 건너뛰므로, 이 파서의 한계는 알려진 약점이다.
- 구현 배치에 고정돼 있던 테스트(`coordinator`, `tasks-docs`, `cli-project-commands`, `symbol-index`, `master-rules`, `ci-contract` 등)는 동작·순서 검사로 바뀌었다. 판정 근거는 `docs/architecture/source-boundaries.md`의 inventory 표다.
- `lease.ts`에는 별도 `Lease` 선언이 남아 있다. 이 변경 범위 밖이다.
- `master-rules`와 `symbol-index` 테스트는 프로세스를 띄우므로 `test/tiers.json`의 integration tier에 있다.

## Quiz

1. 순차 task(`parallel_safe`가 true가 아님)가 이미 in-flight일 때 `readyWave`는 무엇을 반환하는가?
   - A) 의존이 풀린 parallel-safe 후보 한 개
   - B) 빈 배열
   - C) 경로가 가장 적은 후보 한 개
2. 두 task의 경로가 `./src/`와 `src/a.ts`일 때 `tasksConflict`는?
   - A) 문자열이 달라 충돌 아님
   - B) 오류를 던진다
   - C) 정규화 뒤 조상 관계라 충돌
3. commit task에 `transition('prepared', 'integrated')`를 요청하면?
   - A) `illegal state transition: prepared -> integrated` 오류
   - B) `recorded`를 건너뛰고 `integrated` 반환
   - C) `prepared` 그대로 반환
4. `scope.paths`도 `affected_paths`도 없는 legacy task는 충돌 판정에서 어떻게 취급되는가?
   - A) 어떤 task와도 충돌하지 않는다
   - B) 모든 task와 충돌한다
   - C) 같은 id의 task하고만 충돌한다

## Tasks

### EPIC-106/BP-001/TASK-001 · `e6e02bbd`

#### Goal & intent

리뷰 위험도 enum, execute 리뷰 관점 목록, Task·ledger 핵심 타입의 정본을 각각 한 모듈에 둔다. 복제본은 정본을 가져오게 바꾸며 런타임 동작은 바꾸지 않는다. 완료 기준은 `npm test`가 통과하고, 복제된 선언 네 곳(`REVIEW_RISK_ENUM` 두 곳, 관점 목록 두 곳)이 사라지며, `scope.ts`·`coordinate-next.ts`의 Task 타입이 정본의 `Pick`에서 파생되는 것이다.

#### Current behavior

- `REVIEW_RISK_ENUM`이 `review-dispatch.ts:41-46`과 `validate-structural.ts:26-31`에 같은 값·순서로 따로 선언돼 있다. 앞쪽은 `review-dispatch.ts:1146`의 `export =` 객체로 내보내지만 `scripts/src/lib` 안에 그 export를 가져오는 곳은 없다. 사용처는 `review-dispatch.ts:1114`와 `validate-structural.ts:284`(S30)이다.
- 리뷰 관점 목록이 `validate-sections.ts:59-65`의 `REVIEW_PERSPECTIVE`(export 안 됨, 사용 `:103`)와 `coordinator.ts:87-89`의 `WORKER_MODEL_REVIEW_PERSPECTIVES`에 같은 다섯 값으로 있다. 뒤쪽 주석(`coordinator.ts:84-86`)이 "두 곳을 함께 고쳐야 한다"고 적는다. 사용처는 `coordinator.ts:3591`(소속 검사)과 `:4435`(`next` 문구).
- `validate-sections.ts:68`의 `CONTEXT_REVIEW_PERSPECTIVE`는 다른 목록(`combined`, `local`, `global` 등)이며 `:590`에서 export된다.
- Task 타입이 세 곳에 따로 있다. `coordinator.ts:140-149`가 가장 넓고(`execution_kind: 'commit'|'verification'`, `branch`, `dynamic`, `exclusive_resources`, `criticalRecovery`, `dispatch`, `lease`, 증적 id), `scope.ts:120-126` `LedgerTask`는 `actualPaths`와 인라인 `lease { id, generation, seq, status }`가 coordinator에 없고, `coordinate-next.ts:27-33` `LedgerTask`는 `execution_kind: string`과 `decisions`를 더 넓게 선언한다. `DispatchState`는 `coordinator.ts:71`(`model?`, 유니온 status)과 `coordinate-next.ts:23`(string status, `model` 없음)에 있고 `LedgerRef`는 `coordinator.ts:231`과 `coordinate-next.ts:53`에 같은 모양으로 있다. `Lease`는 `coordinator.ts:136`과 `coordinate-next.ts:22`(`{ id, generation, status? }`)에 따로 있고 `scope.ts:125`는 `lease`를 `seq`가 있는 인라인 객체로 적는다. `Ledger`는 `coordinator.ts:150`(전체 필드), `scope.ts:127`(전 필드 선택, `version?`), `coordinate-next.ts:44`(`status`·`base`가 string, `revision: string | null`)에 있고 `scope.ts:113`의 `LedgerScope`는 `Task.scope`와 같은 모양이다. 모두 파일 내부 `type`이며 export되지 않는다.
- 재현·확인한 명령: `rg -n "REVIEW_RISK_ENUM|REVIEW_PERSPECTIVE|WORKER_MODEL_REVIEW_PERSPECTIVES" scripts/src/lib`. 관련 테스트는 `test/review-dispatch.test.js`(분류기 출력의 `perspectives`와 `reviewRisk: public_interface`, `:780` 부근), `test/validate-structural.test.js`(S30 거절), `test/coordinator.test.js`·`test/cli-coordinate.test.js`(worker-model 관점 검사와 `next` 문구)다. 상수 이름을 직접 가리키는 테스트는 없다.
- I/O 결합: 선언부는 모두 순수 상수·타입이다. `review-dispatch.ts:6`이 `execFileSync`를 가져오지만 `ExecFileSyncFn` 매개변수로 주입돼 선언부와 무관하다.

#### Target behavior

- 성공: `review-policy.ts`가 `REVIEW_RISK_ENUM`과 `REVIEW_PERSPECTIVE`를 소유하고, `review-dispatch.ts`·`validate-structural.ts`·`validate-sections.ts`·`coordinator.ts`는 이를 가져다 쓴다. `WORKER_MODEL_REVIEW_PERSPECTIVES`는 사라지고 소속 검사와 `next` 문구는 `REVIEW_PERSPECTIVE`에서 만든다. `execution-contracts.ts`가 `Task`·`Ledger`·`DispatchState`·`Lease`·`LedgerRef`를 소유하고 `coordinator.ts`가 이를 쓴다. `scope.ts`와 `coordinate-next.ts`의 `LedgerTask`·`LedgerRef`·`DispatchState`는 `Pick`/`Omit`으로 정본에서 파생된다.
- 실패(거절)는 바뀌지 않는다: 위험도 enum 밖의 값은 S30으로 거절되고 Execute 경로에서도 같은 목록으로 막힌다. 목록 밖 관점은 같은 `next` 문구로 거절된다.
- 보존: 다섯 관점·네 위험도 값과 순서, `review-dispatch` export 객체의 `REVIEW_RISK_ENUM` 키(정본 값을 다시 내보냄), `CONTEXT_REVIEW_PERSPECTIVE`, 모든 `coordinate` 응답의 JSON 필드.

#### Interface

- 제공:
  - `review-policy.ts`: `export =` 객체 `{ REVIEW_RISK_ENUM: readonly ['public_interface','authentication','authorization','credential'], REVIEW_PERSPECTIVE: readonly string[] }`. 정의 예: `REVIEW_PERSPECTIVE = ['combined', 'spec_scope', 'correctness_tests', 'minimality_maintainability', 'security']`.
  - `execution-contracts.ts`: `export type Task`, `Ledger`, `DispatchState`, `Lease`, `LedgerRef`. 소비자는 `import type { Task } from './execution-contracts'`로 가져온다. 컴파일 결과 `scripts/lib/execution-contracts.js`에는 `require`가 없다.
  - `Lease`·`Ledger`의 정본은 `coordinator.ts:136`·`:150`의 선언을 옮긴 것이고, `scope.ts`·`coordinate-next.ts`의 `Ledger`/`Lease`는 `Pick`/`Omit`으로 파생된다.
  - 이름 충돌: 파생 읽기 타입이 정본과 같은 이름(`Ledger`, `Lease` 등)을 쓰려면 정본을 `import type { Ledger as CanonicalLedger } from './execution-contracts'`처럼 별칭으로 가져온다.
  - 파생 규칙: 읽기 타입은 `Pick<Task, ...>`를 쓴다. 정본보다 넓게 두어야 하는 필드(`coordinate-next`의 `execution_kind: string`, `decisions`)만 `Omit<Pick<Task, ...>, K> & { K: 넓은 타입 }`로 재선언하고 줄 주석에 이유를 쓴다. `actualPaths`·`lease.seq`처럼 한 소비자만 필요한 필드는 정본에 선택(optional) 필드로 올린다.
- 거부: `review-policy.ts`와 `execution-contracts.ts`는 `validate*`·`coordinator`·`scope`·`current`·`verification`을 가져오지 않는다(`import type` 포함 정본→소비자 방향 간선 금지). 정본에 없는 위험도 값과 관점은 기존처럼 S30·관점 거절을 받는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-policy.ts` | `REVIEW_RISK_ENUM`, `REVIEW_PERSPECTIVE` | Create | 없음 | 위험도 enum·execute 관점 목록의 정본 | `rg REVIEW_RISK_ENUM` 사본 두 곳, 관점 사본 두 곳 |
| `scripts/src/lib/execution-contracts.ts` | `Task`, `Ledger`, `DispatchState`, `Lease`, `LedgerRef` | Create | 없음 | 타입 전용 정본 | 세 파일의 Task 선언이 필드가 다름(`coordinator.ts:140`, `scope.ts:120`, `coordinate-next.ts:27`) |
| `scripts/src/lib/review-dispatch.ts` | `REVIEW_RISK_ENUM` | Modify | 위험도 enum 사본 보유(`:41-46`), export(`:1146`) | 정본을 가져오고 기존 export 키 유지 | 같은 값 두 사본 |
| `scripts/src/lib/validate-structural.ts` | `REVIEW_RISK_ENUM` | Modify | S30용 사본(`:26-31`) | 정본을 가져옴 | 같은 값 두 사본 |
| `scripts/src/lib/validate-sections.ts` | `REVIEW_PERSPECTIVE` | Modify | execute 관점 목록 보유(`:59-65`) | 정본을 가져옴. `CONTEXT_REVIEW_PERSPECTIVE`는 유지 | `coordinator.ts:84` 주석이 사본임을 명시 |
| `scripts/src/lib/coordinator.ts` | `WORKER_MODEL_REVIEW_PERSPECTIVES`, `Task`, `Ledger`, `Lease`, `DispatchState`, `LedgerRef` | Modify | 관점 사본(`:87`)과 타입 선언(`:71`, `:136`, `:140`, `:150`, `:231`) 보유 | 사본 제거, 선언을 `execution-contracts`로 옮기고 정본 사용 | `explain(coordinate)` 연결 52개로 변경 영향이 크므로 선언부만 수정 |
| `scripts/src/lib/scope.ts` | `LedgerTask`, `Ledger`, `LedgerScope`, 인라인 `lease` | Modify | 읽기용 Task·Ledger 타입 독립 선언(`:113`, `:120`, `:127`) | `Pick` 파생으로 교체, 인라인 `lease`는 정본 `Lease`를 쓰되 `seq`는 정본의 선택 필드로 둠 | 정본과 필드가 어긋나도 컴파일러가 못 잡음 |
| `scripts/src/lib/coordinate-next.ts` | `LedgerTask`, `Ledger`, `Lease`, `DispatchState`, `LedgerRef` | Modify | 읽기용 타입 독립 선언(`:22`, `:23`, `:27`, `:44`, `:53`) | 파생으로 교체, 넓은 필드만 `Omit` 재선언 | `LedgerRef`는 coordinator와 동일 모양 |
| `test/review-policy.test.js` | 신규 테스트 | Create | 없음 | 정본 값·순서, 소비자가 같은 참조를 쓰는지, S30 거절 유지 검사 | 상수 이름을 직접 가리키는 테스트가 없음 |
| `test/tiers.json` | 테스트 등록 | Modify | 테스트 계층 목록 | 신규 테스트 등록 | `scripts/test-tier.js`가 이 목록을 읽음 |

#### Constraints

- 기존 `import x = require()` / `export =` 관례를 따른다. 타입 전용 모듈만 `export type`을 쓰고 소비자는 `import type`을 쓴다.
- 새 모듈이 만드는 런타임 간선은 없어야 한다. 특히 `scope.ts`가 `coordinator`를 가져오지 않는다는 기존 제약(`scope.ts:150` 주석)을 지킨다.
- 위험도·관점 값과 순서, 오류 코드(S30), `next` 문구를 바꾸지 않는다. `CONTEXT_REVIEW_PERSPECTIVE`와 병합하지 않는다.
- `coordinator.ts`는 선언부만 고친다. 로직과 export 객체의 키는 그대로다.
- coverage 임계값(lines 94, branches 82, functions 96)을 낮추지 않는다.

### EPIC-106/BP-001/TASK-002 · `347ba38c`

#### Goal & intent

`readyWave`·`tasksConflict`·`transition`과 경로 겹침 판정을 I/O 없는 하위 모듈로 옮겨 `current → coordinator` 간선을 끊고 `verification → current → coordinator → verification` 순환을 없앤다. 완료 기준은 `npm test`가 통과하고, 새 의존성 경계 테스트가 모듈 그래프 전체에 순환이 없고 하위 모듈이 상위 계층을 전이적으로 참조하지 않음을 검사하는 것이다.

#### Current behavior

- 줄 번호는 HEAD `c94947e7` 기준이다. TASKS-001이 같은 파일의 선언부를 먼저 고치므로 execute 시점에는 어긋날 수 있고, 심볼 이름으로 찾는다.
- 순환은 정확히 한 묶음 `{coordinator, current, verification}`이다. 간선은 `verification.ts:22 → current`, `current.ts:18 → coordinator`, `coordinator.ts:1075, 2393, 2826`의 지연 `require('./verification')`다. 지연 `require`를 포함한 전체 그래프에서 다른 순환은 없다(Tarjan SCC로 확인).
- `current.ts`가 `coordinator`에서 가져오는 것은 `readyWave` 하나(`current.ts:18-19`, 사용 `:612`)다.
- `readyWave`(`coordinator.ts:473`), `tasksConflict`(`:446`), `transition`(`:543`), `normalizeOverlapPath`(`:428`)는 export되지 않는 내부 함수이고, 이 함수들이 쓰는 `isInFlight`(`:398`)·`pathSetOf`(`:414`)와 `DEFAULT_MAX_PARALLEL`(`config.ts`)도 순수하다. `coordinator`의 export 객체(`:4518`)가 `readyWave`와 `transition`만 내보낸다. 파일 안 호출처는 `readyWave` `:719, 2048, 2455, 2680, 3270, 3417`, `transition` `:2223, 2226, 2227, 2372, 2443, 2660, 3249, 4071`, `normalizeOverlapPath` `:869`다.
- 외부 `readyWave` 소비자: `current.ts:18`, `commit.ts:23-24`(사용 `:147, 188`), `run-preflight.ts:21-22`(`:432`), `dag-shape.ts:3-4`(`:121`). `transition`은 `scripts/src/lib` 안의 다른 모듈이 쓰지 않는다.
- `pathsOverlap`은 `validate-sections.ts:247`에 있고 `:605`에서 export된다. 소비자는 `scope.ts:17`(`:753`), `dag-shape.ts:6`(`:64`), `finalize-digest.ts:13`, `review-dispatch.ts:20`, `validate-gates.ts:29`, `coordinator.ts:28`이다.
- `dag-shape.ts:42-47`에 `normalizePath`가 따로 있다. `./` 접두를 반복 제거하고 길이가 1보다 클 때 trailing `/`를 제거하며, `coordinator.ts:428-437`의 `normalizeOverlapPath`와 같은 규칙이다.
- 기존 검사: `test/coordinator.test.js:9`가 `readyWave`·`transition`을 `coordinator`에서 가져오고 `:126-190`에서 정규화·`maxParallel`·자원 충돌·legacy 쌍을 검사한다. `test/distribution.test.js:130-143`이 `coordinator`의 `readyWave`·`transition` export를 함수로 고정한다. 순환·의존성을 검사하는 테스트는 없다.
- 재현: 위 간선은 `rg -n "require\('\./verification'\)|coordinatorCore|coordinator\b" scripts/src/lib/current.ts scripts/src/lib/coordinator.ts`로 확인한다. `scripts/lib`는 빌드 산출물이므로 테스트 전 `npm run build`가 필요하다.

#### Target behavior

- 성공: `execution-dag.ts`가 `readyWave`·`tasksConflict`·`transition`·`normalizeOverlapPath`(와 내부 `isInFlight`·`pathSetOf`)를 소유하고, `path-overlap.ts`가 `pathsOverlap`을 소유한다. `current.ts`·`commit.ts`·`run-preflight.ts`·`dag-shape.ts`는 `execution-dag`에서 `readyWave`를 가져오고, `dag-shape.ts`의 사본 `normalizePath`는 공유 `normalizeOverlapPath`를 쓴다. `coordinator`는 기존 `readyWave`·`transition` export를 유지하고 내부에서 `execution-dag`를 쓴다. `validate-sections.ts`는 `pathsOverlap`을 `path-overlap`에서 받아 기존 이름으로 다시 내보낸다. `scope.ts`는 `path-overlap`에서 직접 가져온다.
- 새 의존성 경계 테스트가 통과한다: 모듈 그래프 전체에 순환이 없고, `execution-dag`·`path-overlap`·`review-policy`·`execution-contracts`의 전이 도달 집합에 `cli*`, `validate*`, `coordinator`, `current`, `verification`, `finalize*`가 없다.
- 실패 경로: `transition`의 허용되지 않는 전이는 이전과 같은 오류 메시지로 throw한다. 그래프 helper는 해석할 수 없는 상대 `require`를 만나면 오류를 낸다(경계 테스트가 조용히 비지 않게 한다).
- 보존: `readyWave`의 정규화(`./src/`, `src/`)·`maxParallel`·`exclusive_resources` 충돌·legacy(경로 없는 task) 동작, `pathsOverlap` 결과, `coordinator` export 키, 모든 CLI 출력.

#### Interface

- 제공:
  - `execution-dag.ts` (`export =`): `readyWave(tasks: Task[], options?: { maxParallel?: number }): string[]`, `tasksConflict(left: Task, right: Task): boolean`, `transition(from: string, to: string, executionKind?: 'commit' | 'verification'): string`, `normalizeOverlapPath(raw: string): string`. `Task`는 `execution-contracts`의 정본을 `import type`으로 쓴다.
  - `path-overlap.ts` (`export =`): `pathsOverlap(a: string, b: string): boolean`. 구현은 현재 `validate-sections.ts:247`의 본문을 그대로 옮긴다.
  - `test/helpers/module-graph.js`: `loadModuleGraph(dir: string): Map<string, Set<string>>`(상대 `import x = require('./y')`와 지연 `require('./y')`를 모두 간선으로 읽음), `findCycles(graph): string[][]`, `reachable(graph, from: string): Set<string>`(`from`이 그래프에 없으면 `module not in graph: <from>`으로 throw한다. 그래서 대상 모듈이 아직 없을 때 빈 집합으로 조용히 통과하지 않는다).
- 거부:
  - `execution-dag.ts`·`path-overlap.ts`는 `cli*`·`validate*`·`coordinator`·`current`·`verification`을 가져오지 않는다. `execution-dag`가 가져올 수 있는 런타임 모듈은 `config`(`DEFAULT_MAX_PARALLEL`)와 `path-overlap`뿐이다.
  - `module-graph.js`는 파싱한 상대 경로가 `scripts/src/lib` 안의 파일로 해석되지 않으면 throw한다. 던지는 경우(즉시 오류)와 순환 없음(정상 빈 결과)은 다른 반환이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/execution-dag.ts` | `readyWave`, `tasksConflict`, `transition`, `normalizeOverlapPath` | Create | 없음 | I/O 없는 DAG·상태 전이 규칙 | `coordinator.ts:398-560`의 순수 함수 |
| `scripts/src/lib/path-overlap.ts` | `pathsOverlap` | Create | 없음 | 경로 겹침 규칙 | `validate-sections.ts:247` 소비자 6개 |
| `scripts/src/lib/coordinator.ts` | `readyWave`, `tasksConflict`, `transition`, `normalizeOverlapPath` | Modify | DAG 규칙과 명령 처리를 함께 보유 | 규칙 정의 제거, `execution-dag` 사용, export 유지 | `explain(readyWave)`: 호출 6 / 파일 4 (내부 호출 `:719`~`:3417`) |
| `scripts/src/lib/current.ts` | `coordinatorCore` | Modify | `readyWave`만 위해 `coordinator` import(`:18`) | `execution-dag`로 교체 | 순환의 간선 |
| `scripts/src/lib/commit.ts` | `readyWave` import | Modify | `coordinator`에서 `readyWave`(`:23`) | `execution-dag`로 교체 | 외부 소비자 |
| `scripts/src/lib/run-preflight.ts` | `readyWave` import | Modify | `coordinator`에서 `readyWave`(`:21`) | `execution-dag`로 교체 | 외부 소비자 |
| `scripts/src/lib/dag-shape.ts` | `normalizePath`, `readyWave` import | Modify | 사본 정규화(`:42`)와 `coordinator` import(`:3`) | 공유 함수 사용, `coordinator` import 제거 | 계획용 분석이 실행 조정을 가져옴 |
| `scripts/src/lib/validate-sections.ts` | `pathsOverlap` | Modify | 경로 규칙을 문서 검증 모듈이 보유(`:247`) | `path-overlap`에서 받아 같은 이름으로 재export | 소비자 5개는 import 불변 |
| `scripts/src/lib/scope.ts` | `pathsOverlap` import | Modify | `validate-sections`에서 가져옴(`:17`) | `path-overlap` 직접 사용 | 문서 검증 의존 제거 |
| `test/helpers/module-graph.js` | `loadModuleGraph`, `findCycles`, `reachable` | Create | 없음 | 정적 `require` 그래프 helper | 순환 검사 테스트가 없음 |
| `test/dependency-boundaries.test.js` | 신규 테스트 | Create | 없음 | 순환 없음·하위 모듈 도달 집합 검사 | 완료 기준 1·2 |
| `test/execution-dag.test.js` | 신규 테스트 | Create | 없음 | `readyWave`·`transition`·`normalizeOverlapPath` 직접 단위 검사 | 새 모듈의 직접 계약 |
| `test/dag-shape.test.js` | 정규화 단언 | Modify | `dag-shape` 겹침 비율 검사 | 공유 정규화 사용 후에도 같은 결과임을 고정 | 사본 제거의 동등성 |
| `test/tiers.json` | 테스트 등록 | Modify | 테스트 계층 목록 | 신규 테스트 두 개 등록 | `scripts/test-tier.js` |

#### Constraints

- 함수 본문은 옮기기만 하고 알고리즘·오류 메시지를 바꾸지 않는다. 정규화 loop(`./` 반복 제거)는 한 곳으로 합치되 결과가 같아야 한다.
- `coordinator`의 `deps.runVerification || require('./verification')` 지연 `require`는 이 task에서 유지한다. 순환 제거는 `current → coordinator` 간선 제거로 달성한다.
- `execution-dag`는 `Task` 타입을 TASKS-001의 `execution-contracts`에서만 가져온다.
- 새 모듈은 `scripts/lib`로 빌드돼 함께 배포된다(`package.json`의 `files`가 `scripts/lib/` 전체를 포함). `test/distribution.test.js`의 개발용 소스 비포함 규칙을 어기지 않는다.
- coverage 임계값을 낮추지 않는다.

### EPIC-106/BP-001/TASK-003 · `d1acf084`

#### Goal & intent

구현 위치·파일명에 고정된 테스트 네 건을 보호하던 실패 모드는 유지한 채 동작·의존성 검사로 바꾼다. 대상은 coordinator reason 완전성 검사, `tasks-docs` 단독 로드 검사, CLI 지연 로딩 검사, `symbol-index` 배포 의존성 검사다. 완료 기준은 `npm test`가 통과하고 네 검사가 내부 파일 배치를 바꿔도 같은 이유로만 실패하는 것이다.

#### Current behavior

- `test/coordinator.test.js:120-124`: `scripts/src/lib/coordinator.ts` 한 파일을 `fs.readFileSync`로 읽어 `/reason: '([a-z-]+)'/g`로 약 198개의 리터럴을 뽑고, 각각이 `COORDINATE_FAILURE_HINTS`(`coordinator.ts:4119`, 테스트 `:38`에서 가져옴)의 키인지 확인한다. 보호하는 실패 모드는 힌트 없는 reason이 `coordinator.ts:4498`의 일반 힌트로 떨어지는 것이다. 코드를 다른 파일로 옮기면 검색 대상이 줄어도 통과한다. 동작 테스트는 `:313-358`(`critical-recovery` 계열, `:353`이 `illegal-transition`을 구동), `:669-690`(`unassigned-integration-worktree`), `:769-787`(`missing-blueprint`), `:1080`(`stale-ledger-checkpoint`)이 개별 reason을 구동한다. 공개 `coordinate`는 실패 결과에 `withCoordinateFailureHints`(`coordinator.ts:4494-4504`)로 `cause`·`next`를 붙이고, 힌트가 없으면 `cause`를 `reason` 문자열 그대로, `next`를 `FALLBACK_COORDINATE_NEXT`로 채운다. 테스트 helper는 `:18-35`의 `__fence`/`coordinate` 래퍼가 원장 해시를 자동 주입하고 `coordinateRaw`(`:36`)가 우회한다.
- `test/tasks-docs.test.js:119-126`: `require.cache`에서 `/scripts/lib/` 키를 전부 지운 뒤 `tasks-docs`를 다시 불러와 `paths.js`가 캐시에 없는지 본다. 공유 테스트 프로세스의 캐시를 지우므로 같은 워커의 다른 테스트에 영향을 준다. 이 파일의 나머지 테스트(`:55-117`)는 `listTasksDocs`·`expectedTaskDocIds` 동작을 본다.
- `test/cli-project-commands.test.js:329-356`: 자식 프로세스 `probeIntentCache`(`:21-30`, 필터 `:32-37`)가 `require('./scripts/lib/cli')`, help, `graphify-bin` 실행 후 캐시 키 basename `intent-bundle.js`·`intent-provenance.js`·`symbol-index.js`가 없는지 확인한다. 다음 테스트(`:358`)가 의도 명령 실행 시 해당 모듈이 정확히 한 번 적재됨을 확인한다.
- `test/symbol-index.test.js:237-241`: 생성본 `scripts/lib/symbol-index.js` 원문에 `require('typescript')`·`from 'typescript'` 문자열이 없는지 본다. 같은 파일 `:225-235`는 `resolveSymbol`의 동작(깨진 파일과 정상 파일)을 본다. `test/distribution.test.js:61-65`는 `package.json`에 런타임 `dependencies`가 없는지만 본다. 단일 생성본이 `typescript` 패키지 없이 실제로 동작하는지는 어디서도 확인하지 않는다.
- 제약 확인: `scripts/check-test-names.js`는 테스트 제목에 ` → `를 요구한다(`조건 → 결과`). `npm run test:coverage`는 `scripts/lib/**`에 lines 94, branches 82, functions 96을 요구하므로 자식 프로세스 probe로만 바꾸면 in-process 커버가 줄 수 있다.
- 재현: `node --test test/coordinator.test.js test/tasks-docs.test.js test/cli-project-commands.test.js test/symbol-index.test.js`. 생성본을 읽는 검사는 `npm run build`가 선행돼야 한다.

#### Target behavior

- 성공:
  - coordinator reason 검사: 검색 대상 파일 집합을 `coordinator.ts`와 그 파일이 정적으로 `require`하는 `coordinator-*` 모듈로 명시하고(`module-graph` helper 사용), 집합에 `coordinator.ts`가 반드시 들어 있음을 먼저 단언한다. 기존 reason→힌트 단언은 이 집합 전체에 적용한다. 추가로 이미 구동되는 거절 경로 최소 다섯 개(`critical-recovery-exhausted`, `missing-blueprint`, `unassigned-integration-worktree`, `illegal-transition`, `stale-ledger-checkpoint`)에서 실제 응답의 `reason`이 `COORDINATE_FAILURE_HINTS`의 키이고 응답의 `cause !== reason`(폴백이면 `cause`가 `reason`과 같다)임을 단언한다.
  - `tasks-docs` 검사: 캐시 삭제를 없애고, `module-graph` helper로 `tasks-docs`의 전이 도달 집합에 `cli*`, `coordinator`, `current`, `verification`, `finalize*`, `validate*`가 없음을 단언한다. `paths`라는 파일 이름 자체는 금지하지 않는다(기존 단언이 보호하려던 것은 상위 계층 참조다).
  - 지연 로딩 검사: 기능 영역을 `test/helpers/feature-areas.js`의 표(`intent: [intent-bundle, intent-provenance, symbol-index, cli-intent-command]`)로 정의하고, 자식 프로세스 probe가 영역 단위로 "적재되지 않음"을 단언한다. 검사 대상 명령(require, help, `graphify-bin`)과 의도 명령 적재 단언(`:358`)은 유지한다.
  - `symbol-index` 검사: 문자열 검사를 지우고 자식 프로세스에서 `--require` 스텁으로 `typescript` 해석이 throw하도록 막은 뒤 `resolveSymbol`이 `.ts` 픽스처에서 `status: 'resolved'`를 돌려주는지 확인한다. 같은 probe를 `typescript`가 필요하도록 고친 임시 사본에서 실행하면 실패하는 것으로 probe가 유효함을 한 번 확인한다.
- 실패 경로: reason 힌트 누락, `tasks-docs`가 상위 계층을 가져옴, 의도 모듈이 일반 명령에서 적재됨, `symbol-index`가 `typescript`를 요구함은 각각 이전과 같은 이유로 실패한다.
- 보존: 기존 `listTasksDocs` 동작 테스트, 의도 명령 적재 테스트, `resolveSymbol` in-process 테스트, `distribution.test.js`의 런타임 dependency 검사.

#### Interface

- 제공:
  - `test/helpers/feature-areas.js`: `FEATURE_AREAS: { intent: string[] }`(모듈 basename 목록)와 `loadedAreas(cacheKeys: string[]): string[]`(적재된 영역 이름 목록. 캐시 키의 basename에서 확장자를 뗀 값이 영역 표의 모듈 이름과 정확히 같을 때 그 영역으로 센다). 영역 이름이 `FEATURE_AREAS`에 없는지는 `assertAreaKnown(name: string): void`가 throw로 막는다.
  - `coordinator.test.js` 내부 함수(export하지 않음): `reasonLiteralsOf(files: string[]): string[]`(파일 목록을 받아 `reason: '...'` 리터럴을 모음), `missingHints(reasons: string[], hints: Record<string, unknown>): string[]`(힌트 없는 reason 목록). 가짜 reason 주입 검사는 `missingHints(['fake-x'], COORDINATE_FAILURE_HINTS)`가 `['fake-x']`를 돌려주는지로 확인한다.
  - `tasks-docs.test.js` 내부 함수: `forbiddenReach(graph: Map<string, Set<string>>, from: string, forbidden: string[]): string[]`(도달한 금지 모듈 목록. 노드 이름은 `scripts/src/lib`의 `.ts` 기준 확장자 없는 basename이고, `forbidden` 항목은 정확한 이름이거나 끝이 `*`이면 접두 일치다). 가짜 그래프를 직접 넘겨 검사한다. 그래프는 TASKS-002의 `loadModuleGraph(dir)`(`Map<string, Set<string>>`)와 `reachable(graph, from)`을 쓴다.
  - `symbol-index.test.js` 내부 함수: `probeResolve(libDir: string): { status: string }`(주어진 `lib` 디렉터리의 `symbol-index.js`를 자식 프로세스에서 차단 스텁과 함께 실행). 유효성 확인은 임시 복사 디렉터리를 `libDir`로 넘겨 수행한다.
  - 변경된 테스트 네 파일의 단언(제목은 모두 ` → `를 포함한다).
- 거부: probe 자식 프로세스가 비정상 종료하면 테스트가 stderr를 포함해 실패한다. `assertAreaKnown`이 `FEATURE_AREAS`에 없는 영역 이름을 받으면 throw한다. 이 검사들은 제품 코드의 export를 새로 요구하지 않는다.
- 테스트 seam: `symbol-index` probe는 `node --require <stub> -e "..."` 형태이고 stub은 `Module._resolveFilename`을 감싸 `typescript` 요청에만 throw한다. 그 외 모듈 해석은 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/coordinator.test.js` | reason 완전성 테스트(`:120-124`) | Modify | 단일 파일 정규식 검사 | 검색 파일 집합 명시와 구동 경로 단언 추가 | 코드 이동 시 검사 범위가 조용히 줄어듦 |
| `test/tasks-docs.test.js` | 단독 로드 테스트(`:119-126`) | Modify | 캐시 삭제 후 `paths.js` 부재 확인 | 전이 도달 집합 단언으로 교체 | 공유 캐시를 지움 |
| `test/cli-project-commands.test.js` | `probeIntentCache` 필터(`:21-37`), 지연 로딩 테스트(`:329-356`) | Modify | basename 직접 나열 | 영역 표 기반으로 교체 | 파일 이름이 바뀌면 거짓 실패 |
| `test/symbol-index.test.js` | 배포 의존성 테스트(`:237-241`) | Modify | 생성본 문자열 검사 | `typescript` 차단 probe로 교체 | 간접 의존은 문자열로 못 잡음 |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS`, `loadedAreas` | Create | 없음 | 기능 영역 표와 판정 | 영역 기준 로드 검사 |
| `test/helpers/typescript-blocker.js` | `--require` 스텁 | Create | 없음 | `typescript` 해석 차단 | `symbol-index` probe |

#### Constraints

- 테스트 제목은 `조건 → 결과` 형식을 지킨다. 새로 만든 helper를 공유 프로세스의 `require.cache` 조작에 쓰지 않는다.
- 전환한 검사가 in-process 커버를 줄이지 않도록 `resolveSymbol`·`listTasksDocs`의 in-process 테스트는 그대로 둔다. coverage 임계값을 낮추지 않는다.
- 스텁은 `typescript` 이외의 해석에 영향을 주지 않는다.
- reason 레지스트리 도입은 하지 않는다. 설계 결정은 coordinator 분해 blueprint로 미룬다.

### EPIC-106/BP-001/TASK-004 · `c119ba5c`

#### Goal & intent

후속 blueprint가 기대는 기준선·소비자·테스트 inventory를 `docs/architecture/source-boundaries.md`에 남긴다. 문서는 변경 전 수치, 외부 진입점과 내부 helper의 구분, 기능별 공개 경계의 초안, 구현 고정 테스트의 전환 판단 표를 담는다. 완료 기준은 문서가 존재하고 아래 수치와 표가 재현 가능한 명령과 함께 적혀 있으며 `npm test`가 통과하는 것이다.

#### Current behavior

- `docs/architecture/`에는 `rule-ownership.md` 하나가 있고 `test/rule-ownership.test.js:8`이 그 파일만 읽는다. `scripts/check-doc-shape.js`(`npm run lint:docs`)의 기본 검사 대상은 `skills/`·`agents/`·`references/` 트리와 `PATH_CONTRACTS` 키뿐이라 `docs/`는 검사하지 않는다(`:1000-1010`). `eslint.config.js:26`이 `docs/**`를 무시한다. `package.json`의 `files`에는 `docs/`가 없다.
- 기준선(HEAD `c94947e7`, 보고서 측정): `scripts/src/lib/*.ts` 92개 모듈, 합계 41,956줄. `test/*.test.js` 103개 파일, 합계 54,583줄. 그중 82개 파일이 `../scripts/lib/*`를 직접 require하고 대상 모듈은 70종이다. `require('./scripts/lib/cli')`는 모듈 77개를 적재하고 help 실행 후에도 77개다. export 키 수는 `coordinator` 19, `scope` 13, `finalize` 12, `verification` 11, `validate` 10이다.
- 외부 진입점: `scripts/bouncer:81`(`require('./lib/cli')`), `scripts/bouncer-root:27`(`./lib/bouncer-root`), `hooks/commit-safety.js:6`·`hooks/cursor-commit-safety.js:9`(`lib/commit-hook`), `hooks/session-graph.js:8`(`lib/session-graph`). `plugin.json`과 호스트 매니페스트에는 `scripts/lib` 참조가 없다. 훅은 상대 `require`를 쓰고 stale-build 검사는 두 bin 래퍼만 한다.
- 저장소 밖에서 `scripts/lib/*`를 `require`하는지는 저장소 안에서 알 수 없다. `package.json`이 `scripts/lib/`를 배포하므로 기술적으로는 가능하다.
- 기준선은 작업 트리가 아니라 고정 커밋 `c94947e7`에서 잰다. 모듈 수·줄 수·테스트 수는 `git ls-tree -r --name-only c94947e7 scripts/src/lib test`로 목록을 얻고 `git show c94947e7:<경로>`로 줄 수를 센다. 적재 수는 `git worktree add --detach <임시경로> c94947e7`로 만든 임시 작업 트리에서 `npm ci && npm run build` 뒤 측정하고 작업이 끝나면 `git worktree remove`로 지운다.
- `package.json`의 `bin`은 `bouncer`→`scripts/bouncer`, `bouncer-root`→`scripts/bouncer-root`다(`package.json` 약 38-41줄).
- 빠른 확인용(작업 트리 기준이라 기준선 값으로는 쓰지 않는다): 모듈 수·줄 수는 `ls scripts/src/lib/*.ts | wc -l`, `cat scripts/src/lib/*.ts | wc -l`, 테스트는 `ls test/*.test.js | wc -l`, 적재 수는 `node -e "require('./scripts/lib/cli'); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"`(빌드된 상태)로 확인한다.

#### Target behavior

- 성공: 문서가 다음 네 절을 가진다. 첫째, 위 기준선을 측정 명령과 함께 적은 표. 둘째, 외부 진입점(래퍼·훅·매니페스트·`package.json` bin)과 내부 helper export를 나눈 소비자 inventory, 저장소 밖 사용을 확인할 수 없다는 한계. 셋째, planning·execution·verification·delivery 영역별 공개 경계 초안(함수 이름은 후속 blueprint가 확정한다고 명시). 넷째, 구현 고정 테스트 inventory 표(열: 파일, 현재 고정 대상, 보호 동작, 판단, 담당 task/blueprint).
- inventory 표는 최소한 아홉 건을 담는다: `coordinator.test.js` reason 검사, `tasks-docs.test.js` 단독 로드, `master-rules.test.js` init 검사, `ci-contract.test.js` emit·CI 순서 검사, `public-name-regression.test.js` 허용 목록, `typescript-module-contract.test.js` 정상 경계 fixture, `cli-project-commands.test.js` 지연 로딩, `symbol-index.test.js` 배포 의존성, `skill-bouncer-run.test.js` 단계 제목 구간. 이 blueprint에서 전환하는 여덟 건은 담당 task를 TASKS-003 또는 TASKS-005로 적고, `public-name-regression` 허용 목록은 "후속(내용 표식 필요)"으로 적는다.
- 절을 채우지 못한 항목(예: 나머지 94개 테스트 파일의 분류)은 "미분류 — 해당 영역을 수정하는 blueprint에서 채운다"로 명시하고 비워 두지 않는다.
- 기준선 표에는 위 수치 외에 coverage(`npm run test:coverage` 결과의 lines/branches/functions 비율)와 `npm test`의 소요 시간(환경 의존이므로 참고값으로 표기)을 넣는다. 전후 비교의 "후" 열은 이 blueprint가 채우지 않고 `미측정(후속 blueprint가 채움)`으로 둔다. 전후 비교는 마지막 blueprint가 같은 표에 값을 채워 닫는다.
- 실패 경로는 없다(문서만 추가). 보존: `docs/architecture/rule-ownership.md`와 그 검사, 모든 코드와 테스트.

#### Interface

- 제공: `docs/architecture/source-boundaries.md`(한국어 본문, H1 제목, `##` 절, Markdown 표). 코드·테스트 인터페이스는 없다.
- 거부: 이 문서는 소스 규칙의 정본이 아니다. 후속 blueprint의 `Touch`·`affected_paths`를 대신하지 않으며 기능 경계 함수명을 확정하지 않는다. 폐기한 제품 이름 문자열(`test/public-name-regression.test.js`의 검사 대상)을 쓰지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/source-boundaries.md` | 기준선·inventory 문서 | Create | 없음 | 소비자·경계·테스트 inventory 문서 | `docs/architecture/`는 lint 대상이 아니고 `rule-ownership.md`만 검사됨 |

#### Constraints

- 수치는 문서에 적은 측정 명령으로 다시 얻을 수 있어야 한다. 측정은 고정 커밋 `c94947e7` 기준이며 같은 blueprint의 다른 task 결과를 포함하지 않는다. 문서에 기준 커밋 해시와 측정 방법(커밋에서 직접 측정)을 적는다.
- 실행 시간 "절감" 수치는 쓰지 않는다(비교 대상이 아직 없다). 값이 없는 칸은 추측하지 않고 "미측정"으로 적는다.
- 정확한 로드 개수를 목표값으로 고정하지 않는다. 허용 의존성과 기준선 대비 결과를 기록하는 방식으로 쓴다.
- 문서는 `rule-ownership.md`처럼 정본 문장을 복제하지 않고 경로·heading으로 가리킨다.

### EPIC-106/BP-001/TASK-005 · `7c05c859`

#### Goal & intent

문자열·단계 제목에 고정된 테스트 네 건을 보호하던 실패 모드는 유지한 채 동작·순서 검사로 바꾼다. 대상은 `master-rules`의 init 검사, `ci-contract`의 emit·CI 순서 검사, `typescript-module-contract`의 정상 경계 fixture, `skill-bouncer-run`의 단계 구간 검사다. 완료 기준은 `npm test`가 통과하고 init 구현·`check-emit` 인자·bouncer-run 단계 번호를 바꿔도 같은 이유로만 실패하는 것이다.

#### Current behavior

- `test/master-rules.test.js:436-439`: 생성본 `scripts/lib/init.js` 원문에 `CLAUDE.md`·`AGENTS.md` 문자열이 없는지 `doesNotMatch`로 본다. 보호하는 실패 모드는 init이 플러그인 마스터 규칙을 프로젝트에 설치하는 것이다. `:432`의 "플러그인에 `CLAUDE.md`를 싣지 않는다" 검사는 파일 존재 계약이라 유지한다. init 동작 테스트는 `test/init.test.js`·`test/cli-init.test.js`에 있다.
- `test/ci-contract.test.js:79-111`: `npm run test:coverage && npm run test:unit && ...` 정확한 문자열(`:103`)과 단계별 index 순서, coverage 임계값(lines 94 / branches 82 / functions 96)을 고정한다. `:113-119`은 GitHub와 GitLab CI가 `npm ci` 뒤 `npm run ci`를 쓰는지 본다.
- `test/ci-contract.test.js:121-128`: `scripts/check-emit.js` 원문에 `ls-files`, `--others`, `--exclude-standard`가 있고 `status --porcelain`·`shell: true`가 없는지 본다. 동작 테스트가 `:130-163`에 이미 있다(`makeEmitRepo` `:49-72`, 무시된 깨끗한 트리 exit 0 `:130`, 강제 추적 exit 1 `:136`, 무시되지 않음 exit 1 `:147`, 빌드 실패 코드 전달 `:154`).
- `test/typescript-module-contract.test.js:21-35`는 불일치 fixture(`test/fixtures/typescript-module-contract-mismatch.ts`)가 `tsc --noEmit`에서 `Type 'string' is not assignable to type 'number'`로 실패함을 본다(유지할 계약). `:37-77`은 인라인 fixture를 임시 디렉터리에 쓰고 `scripts/src/lib/intent-bundle`·`cli-intent-command`를 `import()` 타입으로 직접 가리키며 `resolveTaskIntentBundle`·`run`을 호출한다.
- `test/skill-bouncer-run.test.js:30-42`: 두 테스트가 `SKILL.md`를 `/4\. \*\*Coordinator dispatch\.\*\*[\s\S]*?(?=\n5\. \*\*Report\.\*\*)/`로 잘라 `bouncer subagent-model --agent bouncer-coordinator`, `metrics end`, `task-notification`, `subagent_tokens`, `not right after the hand-back`를 찾는다. 제목이나 번호가 바뀌면 구간이 비어 오해를 부르는 메시지로 실패한다. `:8-28`의 ACQ 블록·폐기 참조 테스트는 유지한다.
- I/O: `master-rules`가 생성본을 읽는다(빌드 선행 필요, `pretest`가 처리). `ci-contract`가 `git`과 `node scripts/check-emit.js`를 spawn하고 임시 저장소를 만든다. `typescript-module-contract`가 `node_modules/typescript/bin/tsc`를 spawn한다.
- 제약: 테스트 제목은 ` → ` 형식(`scripts/check-test-names.js`). coverage 임계값은 그대로.
- 재현: `node --test test/master-rules.test.js test/ci-contract.test.js test/typescript-module-contract.test.js test/skill-bouncer-run.test.js`.

#### Target behavior

- 성공:
  - init 검사: 임시 git 저장소에서 `init`을 실행(`test/helpers/git-fixture.js`의 `createGitTemplate`로 저장소를 만들고 `scripts/lib/init.js`의 `init`을 호출하는 작은 함수를 `master-rules.test.js` 안에 둔다)해 프로젝트 루트에 `AGENTS.md`·`CLAUDE.md`가 생기지 않음을 확인하고, 미리 둔 프로젝트 `AGENTS.md`가 바이트 단위로 같음을 확인한다. 원문 문자열 검사는 지운다.
  - CI 순서 검사: `ci` 스크립트를 `&&`로 나눠 토큰 배열을 만들고 필수 단계(`check:emit`, `test:coverage`, `test:unit`, `lint`, `lint:docs`, `lint:context-comments`, `typecheck`, `lint:test-names`, `npm audit`)가 모두 있고 순서쌍(`check:emit` < `test:coverage` < `test:unit` < `lint` < `lint:docs` < `lint:context-comments` < `typecheck` < `lint:test-names` < `npm audit`)이 증가함을 확인한다. 전체 문자열 일치는 지운다. coverage 임계값 단언과 `:113-119` 검사는 유지한다.
  - emit 검사: `ls-files`/`--others`/`--exclude-standard`/`status --porcelain` 문자열 검사를 지우고, 관련 없는 변경 파일이 있지만 emit은 깨끗한 fixture(`status --porcelain`을 쓰면 잘못 실패함)를 동작 테스트로 추가한다. 무시되지도 추적되지도 않는 생성물의 거절은 기존 `:147` 테스트가 이미 보호하므로 같은 fixture를 새로 만들지 않는다. `shell: true` 부재는 구조 검사 하나로 남긴다. `scripts/check-emit.js` 원문에 `/shell\s*:\s*true/`가 없다는 `doesNotMatch` 단언 한 개이며, 이 단언은 의도적으로 소스 텍스트를 본다(`shell` 사용은 동작 fixture로 관측하기 어려운 실행 경계 속성이기 때문이다). `ls-files` 등 Git 인자 문자열 검사와는 별개다.
  - 정상 경계 fixture: 두 모듈 이름 직접 참조를 없애고 `scripts/src/lib/*.ts` 중 `export =`를 가진 모든 모듈을 디렉터리 스캔으로 찾아 `typeof import('<경로>')` 타입 별칭을 만든 fixture 하나를 `tsc --noEmit`으로 검사한다. 불일치 fixture 테스트(`:21-35`)는 그대로 둔다.
  - 단계 구간 검사: 단계 번호·제목 구간 자르기를 없애고 `SKILL.md` 전체에서 (a) `bouncer subagent-model --agent bouncer-coordinator`를 포함한 문단(`paragraphContaining`)이 존재하고 그 문단 안에서 이 명령의 위치가 같은 문단의 `Dispatch named` 문구보다 앞이며(현재 `SKILL.md`의 해당 문단은 "Just before dispatch, run …"으로 시작해 "Dispatch named …"가 뒤따른다), (b) `metrics end`를 포함한 문단(빈 줄로 나눈 블록)에 `task-notification`, `subagent_tokens`, `not right after the hand-back`이 모두 있음을 확인한다. 문단을 못 찾으면 "metrics end 문단 없음"이라는 명확한 메시지로 실패한다.
- 실패 경로: init이 마스터 규칙을 쓰면 init 테스트가 실패한다. `ci` 순서가 뒤바뀌거나 단계가 빠지면 순서 테스트가 실패한다. 생성물이 추적/미무시되면 emit 동작 테스트가 실패한다. 모듈 `export =` 타입이 어긋나면 fixture가 실패한다. 문서 문장이 사라지면 단계 구간 테스트가 실패한다.
- 보존: `:432` 플러그인 파일 존재 검사, coverage 임계값 단언, CI 공통 명령 검사, 불일치 fixture 계약, ACQ 블록·폐기 참조 테스트.

#### Interface

- 제공: 변경된 네 테스트 파일의 단언(제목은 모두 ` → `를 포함한다). 새 helper 파일 없이 각 파일 안의 작은 함수만 추가한다.
  - `master-rules.test.js`: `runInitIn(repoDir: string, initFn?: (repoDir: string) => unknown): unknown`. `initFn`을 생략하면 실제 `init`을 호출한다. 유효성 확인은 `AGENTS.md`를 쓰는 가짜 `initFn`을 넘겨 단언이 실패하는지로 한다.
  - `ci-contract.test.js`: `parseCiSteps(script: string): string[]`(`ci` 스크립트를 ` && `로 나눈 토큰, 앞뒤 공백 제거)와 `stepIndex(steps: string[], name: string): number`. 매칭 규칙은 토큰에서 `npm run ` 접두를 뗀 값이 `name`과 정확히 같을 때이며(`lint`와 `lint:docs`가 섞이지 않음), `npm audit`은 토큰이 `npm audit`으로 시작하면 일치한다. 없으면 `-1`을 돌려주고 호출한 단언이 실패한다.
  - `skill-bouncer-run.test.js`: `paragraphContaining(markdown: string, needle: string): string | null`(빈 줄로 나눈 블록 중 `needle`을 가진 첫 블록). 가짜 문자열을 직접 넘겨 단언 실패를 확인한다.
- 거부: 이 task는 제품 코드·문서·CI 설정을 바꾸지 않는다. `ci` 스크립트에 `&&`로 나눌 수 없는 항목이 있으면 파서가 그 항목 그대로를 토큰으로 두고 순서 단언이 그 토큰을 못 찾으면 실패한다.
- 즉시 오류(throw)와 정상 상태는 다르다: `SKILL.md`를 읽을 수 없으면 throw하고, 문단이 없으면 단언 실패 메시지를 낸다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/master-rules.test.js` | init 검사(`:436-439`) | Modify | `init.js` 원문 문자열 검사 | init 동작 검사로 교체 | 주석·상수 이동에도 깨짐 |
| `test/ci-contract.test.js` | `ci` 순서 검사(`:79-111`), emit 검사(`:121-128`) | Modify | 정확 문자열·소스 문자열 고정 | 순서 토큰 검사와 emit 동작 fixture | 동작 테스트(`:130-163`)가 이미 일부 보호 |
| `test/typescript-module-contract.test.js` | 정상 경계 fixture(`:37-77`) | Modify | 두 모듈 이름 고정 | `export =` 모듈 스캔 | 이름 변경 시 거짓 실패 |
| `test/skill-bouncer-run.test.js` | 단계 구간 테스트(`:30-42`) | Modify | 단계 제목으로 구간 자름 | 전체 문서 기준 명령·문단 검사 | 번호 변경 시 오해 소지 메시지 |

#### Constraints

- 테스트 제목은 `조건 → 결과` 형식이다. 의미 없는 단언(`assert.ok(true)`)과 조건을 숨기는 helper를 쓰지 않는다.
- 검증한 실패 모드마다 그 모드를 되살리는 작은 mutant fixture로 단언이 실제로 실패함을 한 번 확인한다.
- coverage 임계값을 낮추지 않는다. `skill-bouncer-run`에서 문구 자체가 동작 계약인 명령 줄(`bouncer subagent-model --agent bouncer-coordinator`)은 그대로 고정한다.

### EPIC-106/BP-001/TASK-006 · `ca5162d0`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-SS-1 (major, spec_scope, must_fix) — docs/architecture/source-boundaries.md#구현 고정 테스트 inventory — tasks/004 goal & intent
- F-CT-1 (blocker, correctness_tests, must_fix) — test/tiers.json#unit tier spawn — blueprint contract
- F-CT-2 (blocker, correctness_tests, must_fix) — scripts/src/lib/coordinator.ts#execution-contracts type imports — tasks/001 constraints
- F-SS-4 (minor, spec_scope, must_fix) — scripts/src/lib/scope.ts#LedgerScope — tasks/001 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `docs/architecture/source-boundaries.md` — 기록된 리뷰 finding을 수정한다.
- Modify `test/tiers.json` — 기록된 리뷰 finding을 수정한다.
- Modify `scripts/src/lib/coordinator.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `scripts/src/lib/scope.ts` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.