---
type: bouncer.explain
title: coordinate 출력 축소
description: coordinate CLI stdout에서 원장 사본을 빼고 한 줄 JSON으로 낸다
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/001-coordinate-output-compaction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T08:06:12.275+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '083'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 5d41dd7071455adf215deee536adb63d5fb25a37
      range_to: d6553b63104a5861c66896a709d15b8382ac9d58
      diff_sha: 9787da0da51bf20ba38afdaae94cb09383218f4fddebe4ec26b96721d3206043
      quiz_score: 3/4
      disposition: Q2는 prepare가 opened[]인데 checkpoint.tasks 전체를 골랐음.
      recorded_at: '2026-10-02T08:15:00.000+09:00'
  task_commits:
    - task: EPIC-083/BP-001/TASK-001
      sha: d6553b63
      intent_anchor: task-001
  coordinator:
    integration_branch: feat/083-001-coordinate-output-compaction
    tasks:
      - id: '001'
        branch: bouncer/083-001-001
        scope_revision: null
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - CHANGELOG.md
          - agents/bouncer-coordinator.md
          - rules/cli.md
          - scripts/src/lib/cli-git-commands.ts
          - test/cli-coordinate.test.js
          - test/native-profile-e2e.test.js
          - scripts/src/lib/coordinate-output.ts
          - test/coordinate-output.test.js
      - id: '002'
        branch: null
        scope_revision: null
        actual_paths: []
---
# Explain

## Background

`bouncer coordinate` 성공 stdout이 checkpoint와 함께 원장 전체 `tasks`·`decisions`를 실어, 드라이브 세션이 이미 가진 상태 사본을 한 번 더 먹었다. 이 블루프린트는 그 사본을 빼고, `coordinate prepare`는 lease가 필요한 task만 `opened[]`로 낸다. stdout은 성공·실패 모두 `JSON.stringify` 한 줄이다.

원장 파일 `.bouncer/runtime/coordinator.json`과 `scripts/src/lib/coordinator.ts`의 `coordinate()` 반환값은 그대로다. 축소는 CLI 투영뿐이다.

드라이브는 DAG를 바꾸지 않았다(`repairWaves` 없음, `scopeRevision` 없음). TASKS-001 worker는 `bouncer/083-001-001` @ `ab5071caafd868528c1100c39593bea2d0f437eb`이고, fan-in 뒤 integration HEAD는 `d6553b63104a5861c66896a709d15b8382ac9d58`이다. TASKS-002는 verification이라 worker·커밋이 없고 `npm run ci`만 통과했다.

## Intuition

원장은 디스크에 두고, CLI는 checkpoint와 지금 열어야 할 lease만 한 줄로 건넨다.

## Code

투영은 `scripts/src/lib/coordinate-output.ts`의 `compactCoordinateOutput`·`projectOpened`. CLI 연결은 `scripts/src/lib/cli-git-commands.ts`의 `cmdCoordinate`. 테스트는 `test/coordinate-output.test.js`, `test/cli-coordinate.test.js`, `test/native-profile-e2e.test.js`. 읽는 쪽 지침은 `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`, `rules/cli.md`. CHANGELOG는 `[Unreleased]` Changed.

`coordinator.ts`는 이 범위 밖이다.

## Quiz

1. `bouncer coordinate` 성공 stdout에서 이 블루프린트가 뺀 것은?
   - A) `coordinate()` 반환 객체와 원장 파일 쓰기
   - B) checkpoint와 함께 실리던 원장 전체 `tasks`·`decisions` 사본
   - C) `ok: false`의 `reason`·`cause`·`next`와 exit code

2. `coordinate prepare`가 기존 `tasks` 키 대신 내는 필드는?
   - A) `ready`만 (lease 메타 없음)
   - B) `checkpoint.tasks` 전체
   - C) `opened[]` (lease가 필요한 task만)

3. 이 드라이브의 repair wave와 TASKS-001 scope 개정은?
   - A) `repairWaves` 비어 있고 `scopeRevision`도 없다
   - B) repair 1회, TASKS-001 경로를 넓혔다
   - C) repair 2회 뒤 `partial_closed`

4. TASKS-002가 한 일은?
   - A) `bouncer/083-001-002`에 소스 커밋을 남겼다
   - B) worker 없이 integration에서 `npm run ci`를 돌리고 `integrated`가 됐다
   - C) `npm test`만 다시 돌리고 review.md를 `accepted`로 썼다

## 이해 상태

퀴즈 4문항, 응답 4, 정답 3 → `3/4`.
정답: 1B, 2C, 3A, 4B. 응답: 1B, 2B, 3A, 4B.
Q2만 오답 — `opened[]`인데 `checkpoint.tasks` 전체를 골랐음. 마감은 막지 않음.

## Tasks

### EPIC-083/BP-001/TASK-001 · `d6553b63`

#### Goal & intent

`bouncer coordinate` CLI가 stdout에 쓰기 직전에 결과를 투영해 원장 전체 `tasks`·`decisions` 사본을 빼고, prepare는 coordinator가 lease를 받아야 하는 task만 `opened[]`로 내며, 모든 `coordinate` stdout을 한 줄 JSON으로 출력하게 한다.
coordinator가 mutation마다 받던 원장 사본이 문맥에 쌓이지 않게 하는 것이 목적이다. 수용 기준은 epic Success criteria 1·2이고 검증 명령은 `npm test`다.

#### Current behavior

- 출력 지점: `scripts/src/lib/cli-git-commands.ts` `cmdCoordinate`가 `coordinate()` 결과를 `JSON.stringify(result, null, 2)`로 쓴다(:424). 호출 전 거절도 같은 형식이다 — fence 누락·잘못된 fence(:301, :365 `ledger-checkpoint-invalid`), revise fence 실패(:372), revise 성공 payload(:392).
- 원장 사본을 싣는 성공 결과(`scripts/src/lib/coordinator.ts`, 모두 `withCheckpoint`로 `checkpoint`가 붙는다):
  - bootstrap(:1960-1964): `integrationPath`, `ready`, `tasks: ledger.tasks`, `decisions: ledger.decisions`, `integrationBranch`
  - prepare(:2194): `ready`, `tasks: ledger.tasks`, `decisions: ledger.decisions`
  - integrate(:1342-1346): `task`, `verification`, `ready`, `decisions`
  - critical-recovery(:2395, :2410), dispatch(:2467), report(:2512-2515), record(:2549), rerecord(:2578-2580): `task`(+`decision`/`metadata`/`attempt`)와 `decisions: ledger.decisions`
- `status`(:1980-1990)는 이미 `{ ok, command, checkpoint }`뿐이다.
- 재개 prepare: prepare는 `ready`가 빈 경우에도 성공한다. 이전 원장에서 이미 `prepared`인 task는 `ready`에 없고(`coordinator.ts` ~:2141 주석 "이전 원장의 prepared task는 ready wave에 없어서"), 그 lease는 지금 `tasks[]` 항목에서만 나온다. checkpoint의 `projectActiveTask`(:433-446)는 `lease`를 담지 않는다. lease 형식은 `{ id, generation, seq, status: 'active' | 'revoked' }`(:74)다.
- 지침이 이 결과에서 읽는 값: `agents/bouncer-coordinator.md` 2단계 Prepare(:206-210)는 prepare가 "per-task `lease`"를 돌려준다고 적고, 3단계 Drive는 그 `lease`와 worker cwd를 쓴다. 현재 그 값은 `tasks[]` 항목의 `lease`·`workerPath`·`branch`에서 나온다. `skills/bouncer-run/SKILL.md:104`는 bootstrap의 `integrationPath`만 읽는다. top-level `decisions`를 읽는 지침은 없다.
- 테스트: `test/cli-coordinate.test.js`는 `runCli`로 CLI를 부르는 `coordinateCli`(:124)와 lib `coordinate()`를 부르는 `coordinate`(:28)를 함께 쓴다. `preparedDrive`(:59-97)는 lib로 bootstrap·prepare를 부른다. :494는 release 성공 키 집합을 고정한다. `test/native-profile-e2e.test.js`는 `runCli`로 CLI를 부르며 :162에서 prepare stdout의 `prepared.tasks[0].workerPath`를 읽는다. `test/coordinator.test.js`·`test/coordinator-e2e.test.js`는 lib `coordinate()` 반환의 `tasks`를 읽는다. `benchmarks/`·`scripts/*.js`에는 coordinate stdout을 파싱하는 코드가 없다.
- 재현: 저장소 루트에서 `npm run build && node --test test/cli-coordinate.test.js`가 통과한다.

#### Target behavior

- 성공 경로
  - `ok: true`인 coordinate 결과에서 top-level `tasks`·`decisions` 키를 뺀다. 다른 키는 값 그대로 둔다.
  - `command === 'prepare'`이면 `tasks`를 빼기 전에 `opened`를 만든다: 결과 `tasks`를 원장 순서로 돌며 id가 `ready`에 있거나, `status !== 'integrated'`이면서 `lease?.status === 'active'`인 항목에서 `id`, `status`와 값이 있는 `workerPath`, `branch`, `lease`만 옮긴다.
  - `coordinate`의 모든 stdout 쓰기(:301, :365, :372, :392, :424)는 `` `${JSON.stringify(payload)}\n` ``다.
- 실패 경로
  - `ok: false` 결과는 키를 빼지 않고 한 줄로만 바꾼다. exit code는 그대로다.
  - revise 거절의 stderr 한 줄(:384)은 바꾸지 않는다.
- 보존
  - lib `coordinate()`·`projectCheckpoint`·`withCheckpoint` 반환값과 원장 파일 내용.
  - `checkpoint` 키 집합과 값, release 성공 키 집합(:494의 `absent, checkpoint, command, ok, preserved, released, restored`).
  - `coordinate` 밖 명령의 stdout 형식.

#### Interface

- 제공
  - 신규 모듈 `scripts/src/lib/coordinate-output.ts`의 순수 함수 `compactCoordinateOutput(command: string, result: Record<string, unknown>) → Record<string, unknown>`(export). `cmdCoordinate`가 이 함수를 불러 stdout에 쓴다. 파일 I/O·원장 접근이 없어 테스트는 리터럴 객체로 포함 규칙을 고정한다. `ok !== true`이면 `result`를 그대로 돌려준다. `ok === true`이면 `tasks`·`decisions`를 뺀 얕은 사본을 돌려주고, `command === 'prepare'`이면 `opened`를 더한다. 입력 객체를 변경하지 않는다.
  - `opened` 포함 규칙: `ready.includes(task.id) || (task.status !== 'integrated' && task.lease?.status === 'active')`. integrate는 lease를 revoke하지 않으므로(`revokeLease` 호출은 fan-in 충돌 :1673, `revoke` :2210, scope revision `scope.ts:765`뿐) 상태 조건이 없으면 앞 wave의 완료 task가 계속 들어온다. verification task는 lease가 없으므로 `ready`에 있을 때만 들어가며 `id`·`status`만 갖는다.
  - `opened` 항목 shape: `{ id: string, status: string, workerPath?: string, branch?: string, lease?: { id, generation, status, ... } }`. 예: `{ "id": "001", "status": "prepared", "workerPath": "/r/.worktrees/001/001/001", "branch": "bouncer/001-001-001", "lease": { ... } }`.
  - `agents/bouncer-coordinator.md`
    - 2. Prepare: prepare 응답의 `opened[]`에서 task별 `lease`와 `workerPath`를 받는다고 적는다.
    - 3. Drive: "For every ready task from prepare"를 `opened[]`의 commit task 기준으로 바꾼다. `prepared`인 항목은 dispatch하고, 재개로 들어온 그 뒤 상태 항목(dispatch·report·record 진행 중)은 원장에 기록된 다음 행동부터 잇는다. 동시 dispatch 상한(`checkpoint.ready` 수·`coordinator.max_parallel`) 문구는 그대로 둔다.
  - `rules/cli.md` 코디네이터 명령 절: `coordinate` stdout은 한 줄 JSON이고 성공 응답은 원장 사본 대신 `checkpoint`(prepare는 `opened[]` 추가)를 싣는다는 한 문장.
- 거부
  - 투영은 원장 파일을 읽거나 쓰지 않는다. `opened`를 `checkpoint`나 원장에서 다시 계산하지 않고 결과 `tasks`에서만 옮긴다.
  - lease가 `revoked`이고 `ready`에 없는 task, `integrated` task는 `opened`에 넣지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-output.ts` | `compactCoordinateOutput` | Create | 없음 | coordinate 성공 결과 투영(원장 사본 제거, prepare `opened`) 순수 함수 | 포함 규칙을 픽스처 없이 리터럴 입력으로 단위 테스트하려고 분리한다 |
| `test/coordinate-output.test.js` | 신규 test | Create | 없음 | 투영 함수 단위 테스트 | 빈 ready·verification·revoked·integrated·재개 분기를 원장 픽스처 없이 고정한다 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate` | Modify | coordinate argv 해석과 결과 2칸 JSON 출력 | 투영 함수 호출, coordinate stdout 다섯 곳을 한 줄 JSON으로 | 모든 coordinate stdout이 이 함수에서 나간다 |
| `test/cli-coordinate.test.js` | 신규 test, `coordinateCli` | Modify | coordinate CLI 계약 테스트 | bootstrap·prepare·실패 출력의 키와 한 줄 형식 테스트 추가 | 축소된 stdout 계약을 고정할 CLI 테스트 파일 |
| `test/native-profile-e2e.test.js` | native lifecycle test(:162) | Modify | CLI로 drive 한 주기를 돈다 | `prepared.tasks[0].workerPath`를 `prepared.opened[0].workerPath`로 | CLI prepare stdout의 옛 shape를 읽는 유일한 다른 테스트 |
| `agents/bouncer-coordinator.md` | `## Procedure` 2. Prepare, 3. Drive 첫 문장 | Modify | prepare가 per-task `lease`를 주고 Drive는 ready task만 dispatch한다고 서술 | `opened[]`에서 `lease`·`workerPath`를 받고 Drive가 `opened[]` commit task를 잇는다고 서술 | `tasks`가 빠지면 coordinator가 lease를 찾을 곳이 바뀐다 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 파일 | Modify | coordinator 문서의 Codex 사본 | `mdToCodexToml`로 재생성 | `test/agents.test.js`가 바이트 일치를 검사한다 |
| `rules/cli.md` | `## Pointer, worktree, and coordinator commands` | Modify | coordinate 명령 형식과 `ok: false` 처리 | stdout 형식과 성공 응답 내용 한 문장 추가 | 명령 계약의 정본 목록 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 목록 | `### Changed`에 coordinate 출력 축소 항목 | 저장소 관례: 변경마다 Unreleased 항목 |

#### Constraints

- `ok: false` 결과의 키와 값, exit code, stderr 메시지는 바꾸지 않는다.
- 한 줄 JSON은 `coordinate` 하위 명령에만 적용한다. 같은 파일의 `execute prepare`(:262) 등 다른 명령 출력은 그대로 둔다.
- 하위 호환 별칭(`tasks`를 옵션으로 되살리는 플래그 등)을 만들지 않는다.
- `agents/bouncer-coordinator.md`·`rules/cli.md` 문장은 기존처럼 영어, `CHANGELOG.md` 항목은 기존 `[1.5.3]` 항목처럼 한국어 굵은 머리 bullet(`- **제목** — 설명`)이다. `[Unreleased]` 아래에 `### Changed` 절이 없으면 만든다. 코드 주석은 주변처럼 한국어로 쓴다.

### EPIC-083/BP-001/TASK-002

#### Goal & intent

task 001이 통합된 integration worktree에서 전체 CI가 통과해, coordinate stdout 투영이 lint·typecheck·coverage 기준과 다른 명령 계약을 깨지 않았음을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.