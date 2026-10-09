---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/001-coordinator-auto-advance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-09T22:46:09.942+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '089'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: be6620c2936fd29abf75bf3988f823e6ee62230a
      range_to: 1c7cccec38a90f830cb74c6954c5daeb3bb4be57
      diff_sha: 6d551772b15b9b69242b71bc65ea4004624cb874cd70ac55743319f9b1f6a5d0
      recorded_at: '2026-10-09T22:46:00+09:00'
  task_commits:
    - task: EPIC-089/BP-001/TASK-001
      sha: ea08db5d
      intent_anchor: task-001
    - task: EPIC-089/BP-001/TASK-002
      sha: 796df3e8
      intent_anchor: task-002
    - task: EPIC-089/BP-001/TASK-003
      sha: 1c7cccec
      intent_anchor: task-003
---
# Explain

## Background

Coordinator 드라이브는 그동안 `coordinate next`로 다음 argv를 받고, prepare·commit·integrate처럼 판단이 필요 없는 단계도 모델 턴마다 다시 조회·실행했다. 정지 응답마다 카드 전문까지 넓게 실려 토큰 비용이 커졌다.

이 변경은 자동 실행 가능한 단계를 CLI `coordinate advance`가 이어 가고, 모델에는 worker 디스패치·판단·차단·종료처럼 사람이 골라야 하는 정지점만 남긴다. 판단 응답은 원장 전문이 아니라 `payload.report`와 해시가 맞는 `payload.evidence` 포인터만 본다.

## Intuition

자동 기어는 CLI가 돌리고, 핸들은 정지 신호에서만 잡는다.

## Code

- `scripts/src/lib/coordinate-advance.ts` — `AUTO_ACTIONS`(prepare/integrate/verification_node/verify/commit)를 루프 실행하고, judge·worker·blocked·done·max-steps에서 정지
- `scripts/src/lib/cli-git-commands.ts`, `rules/cli.md` — `coordinate advance` 서브커맨드 등록
- `scripts/src/lib/coordinate-next.ts` — 판단 정지에 `payload.report` / `payload.evidence` 부착, 카드·증거 범위를 그 정지에 맞춤
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml` — Procedure를 `advance` 루프로 개정; 자동 argv를 손으로 다시 돌리지 않음
- `references/coordinator-cards/report.md` (및 record/review) — fence 회복·재시도 안내를 `advance`로 맞춤
- `scripts/src/lib/coordinator.ts` — repair 문서에 `bouncer.verify`를 심어 수리 task도 검증 증적을 남김

## Quiz

1. `coordinate advance`가 CLI 안에서 자동으로 이어 실행하는 행동 집합에 포함되는 것은?
   - A) `implement` worker 디스패치
   - B) `prepare`, `commit`, `integrate`
   - C) `report` outcome 선택

2. advance가 모델에게 다시 넘기는 정지 이유는?
   - A) `judge`, `worker`, `blocked`, `done`, `max-steps`
   - B) 매 `next` 호출마다 무조건
   - C) `verify` exit 0일 때만

3. coordinator가 워커 보고서를 판단할 때 읽어야 하는 입력은?
   - A) integration `.bouncer/runtime/coordinator.json` 원장 전문과 완료 task 본문
   - B) 이전 대화에 붙인 worker stdout 전체
   - C) 정지 `next`의 `payload.report`와, 경로·sha256이 맞는 `payload.evidence` 파일

4. stale ledger hash로 mutation이 거절된 뒤 coordinator가 해야 할 일은?
   - A) 응답에 있던 옛 `--ledger-hash`로 같은 argv를 다시 실행
   - B) `coordinate advance`를 다시 호출해 새 fence를 받는다
   - C) plugin 소스에서 hash 계산식을 찾아 손으로 채운다

## Tasks

### EPIC-089/BP-001/TASK-001 · `ea08db5d`

#### Goal & intent

`bouncer coordinate advance --blueprint <dir> [--task <NNN>] [--max-steps <n>]`을 추가한다. `coordinate next`가 `argv`를 주는 자동 행동(`prepare`, `integrate`, `verification_node`, `verify`, `commit`)을 CLI가 실행하고 다음 `next`를 다시 불러, `judge`·worker 위임·`blocked`·`done`·`none`·오류·반복 실패·결과 불명확·단계 한도에서 멈춘다. 수용 조건은 Interface에 한 번 나열한 정지 사유와 실패 reason이 각각 테스트로 고정되고, 정지 응답이 정지 시점의 `next` 전체를 담는 것이다.

#### Current behavior

- `coordinate next`는 읽기 전용이다. `cmdCoordinate`의 `next` 분기(`cli-git-commands.ts:735-760`)가 `coordinateNext(...)`를 부르고 `compactCoordinateOutput` 결과를 한 줄 JSON으로 낸다. 성공은 exit 0, 그 밖은 1이다.
- 응답의 `argv`는 `['bouncer','coordinate',sub,'--blueprint',bp,...fence,...]` 꼴이다(`coordinateArgv`, `coordinate-next.ts:194-213`). `cwd`는 task 범위에서 worker 경로, blueprint 범위에서 integration 경로다.
- `judge`가 없고 `argv`가 있는 행동은 blueprint 범위의 `prepare`·`integrate`·`verification_node`, task 범위의 `verify`(`bouncer validate --gate execute`)·`commit`(`bouncer commit --yes`)이다. `drive_tasks`는 `argv` 없이 `task_ids`만 준다. `dispatch`·`implement`·`review`·`report`·`record`·`revise`·`final_review`는 `judge`나 worker 위임이 필요하다(`coordinate-next.ts:372-644`).
- 반복 실패 코드를 세는 곳은 없다. stale 사유는 명령별로만 있다(`stale-ledger-checkpoint`, `stale-lease`, `stale-worker-report` 등, `coordinator.ts:2766-2990`).
- 재현: `node --test test/coordinate-next.test.js`는 행동마다 한 케이스와 fixture tour(`:832`, `:839`)를 갖는다. `test/cli-coordinate.test.js`의 `coordinateCli(cwd, command, extra)`(`:131-153`)가 `process.chdir` 후 `runCli(['coordinate', ...])`를 부른다.
- I/O 결합: `coordinate-next.ts:167` `git()`이 `execFileSync('git', ...)`를 직접 부르고 `deps.execFileSync`로 주입된다. `cli-git-commands.ts:746-751`은 `process.cwd()`를 직접 읽는다. `Exec` 타입은 `coordinate-next.ts:15`에 비공개로 선언돼 있다.

#### Target behavior

- 진행 규칙: 매 단계 `next`를 부른다. 다음 중 하나면 자동 행동으로 보고 실행한다: 응답에 `argv`가 있고 `judge`가 없으며 `action`이 `prepare`·`integrate`·`verification_node`·`verify`·`commit` 중 하나. 실행은 응답 `cwd`에서 `argv`로 하고 JSON 결과가 `ok: true`이면 `executed`에 기록한 뒤 다시 `next`를 부른다.
- 정지(`ok: true`, exit 0): `judge`가 있으면 `stop.reason: 'judge'`. `argv`가 없는 행동(`drive_tasks`, 구현 위임 `implement`로 light 원장의 `payload.inline: true` 포함)이나 worker 위임 행동은 `'worker'`. `blocked`·`done`·`none`은 같은 이름. 단계가 `--max-steps`(기본 20)에 닿으면 `'max-steps'`. 모든 정지 응답은 `stop.next`에 정지 시점의 `next` 응답을 담는다.
- 실패(`ok: false`, exit 1): 자동 행동의 `argv`가 `ok: false` 또는 검증 실패(`failures[].code`가 있는 출력)를 내면 그 응답을 그대로 돌려주고 멈춘다. 단 reason이 `stale-ledger-checkpoint` 또는 `stale-integration-head`이면 한 번만 `next`를 다시 불러 새 fence로 같은 행동을 다시 실행한다. 그 재실행이 같은 `action`에서 같은 reason으로 다시 실패하면 `reason: 'repeated-failure'`(`cause`에 실패 reason, `next`에 그 실패의 `next`)로 멈춘다. stdout이 JSON이 아니거나 종료 코드가 0·1 밖이면 `reason: 'unclear-result'`로 멈춘다. `next`가 준 `argv`의 첫 원소가 `bouncer`가 아니면 `advance-argv-invalid`.
- 보존: `commit`은 `next`가 `verify`·`review`를 마친 뒤에 `commit`을 줄 때만 실행되며 `advance`가 순서를 만들지 않는다. 기존 명령의 응답과 fence·lease 규칙, `coordinate next`의 읽기 전용 성질, `advance`와 무관한 `--help` 출력은 바뀌지 않는다.

#### Interface

- 제공:
  - `coordinate advance` 서브명령(`--blueprint` 필수, `--task`, `--max-steps`)과 `--help`/`-h`.
  - `advance({ repoRoot, blueprint, task?, maxSteps?, deps? })` — `deps.next(opts) → NextShape`, `deps.runArgv(argv: string[], cwd: string) → { stdout: string, status: number }`. `NextShape`는 `coordinate-advance.ts`가 필요한 필드(`ok, action, cwd, argv?, judge?, payload?, reason?, cause?, next?`)만 구조적으로 선언한다. `coordinate-next.ts`의 비공개 타입을 export하지 않는다.
  - 성공 응답(exit 0): `{ ok: true, executed: Array<{ action: string, task?: string, exit: number }>, stop: { reason: 'judge'|'worker'|'blocked'|'done'|'none'|'max-steps', next: object } }`.
  - 실패 응답(exit 1): `{ ok: false, reason, cause, next, executed }`. `reason`은 `repeated-failure`, `unclear-result`, `advance-argv-invalid` 또는 자동 행동이 낸 실패 reason 그대로다.
- 거부:
  - `--blueprint` 없음 → 기존 `coordinate` 사용법 오류(exit 2).
  - `--max-steps`가 양의 정수가 아님 → exit 2와 사용법.
- 정의: "같은 실패"는 같은 `action`에서 재실행한 `argv` 결과의 reason(검증 실패면 첫 `failures[].code`)이 문자열로 같은 경우다. 예: `stale-ledger-checkpoint`, `stale-ledger-checkpoint`. 재시도 대상 reason은 위 두 개뿐이다.
- 예외 대 정지: 잘못된 CLI 입력은 exit 2로 끝내고, 위 정지·실패는 모두 응답으로 돌려준다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-advance.ts` | 신규 추출 지점: advance 루프 | Create | 없음 | `deps.next`/`deps.runArgv` 주입 루프와 정지 사유 판정 | 테스트 가능성을 위한 순수 모듈 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, `COORDINATE_USAGE_BLOCKS`, `COORDINATE_REGISTRY_ORDER` | Modify | coordinate 서브명령 등록·도움말 | `advance` 분기와 도움말 블록 추가 | `next` 분기(`:735-760`)와 등록부가 같은 파일에 있음 |
| `rules/cli.md` | coordinate 명령 목록 | Modify | CLI 사용 계약 | `advance` 한 줄과 정지 사유 설명 | CLI 계약 문서 |
| `test/coordinate-advance.test.js` | 신규 | Create | 없음 | 정지 사유별 스크립트 시퀀스 테스트 | 주입 seam 검증 |
| `test/cli-coordinate.test.js` | usage 단언(`:464-578`) | Modify | 전역 usage 바이트 단언 | `advance` 항목 반영, CLI 경로 테스트 | 등록부 변경이 usage를 바꿈 |
| `test/cli-help.test.js` | `coordinate next --help` 테스트(`:299`) | Modify | coordinate 도움말 단언 | 전역 도움말 변경 반영 | 도움말 바이트 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- `advance`는 원장·pointer·문서를 직접 쓰지 않고 `next`가 준 `argv`만 실행한다. `argv`를 새로 조립하지 않는다.
- 단계마다 `next`를 새로 불러 fence를 갱신한다. 이전 응답의 fence를 재사용하지 않는다.
- 검증 실패 원인을 알려고 검증기 소스를 읽게 하는 안내를 응답에 넣지 않는다. `next`와 `cause`만 전달한다.
- 테스트는 `deps` 주입으로 실제 `bouncer` 프로세스를 띄우지 않는 케이스를 기본으로 한다. CLI 경로는 `coordinateCli` fixture로 한 케이스 이상 검증한다.
- 생성 산출물: 소스를 고친 뒤 `npm run build`로 `scripts/lib`를 만든다.

### EPIC-089/BP-001/TASK-002 · `796df3e8`

#### Goal & intent

판단 지점(`judge` 또는 worker 위임)의 `coordinate next` 응답이 현재 task id, 해당 카드, 판단 대상 보고서(`payload.report`)와 원본 증거 포인터(`payload.evidence`)만 싣게 한다. 응답이 이미 완료 task 본문·원장 전체를 싣지 않으므로 이 항목은 새 필드 추가와 그 부재의 회귀 가드이며, 기존 `payload.previous_outcome`은 `payload.report`로 대체한다. coordinator 문서의 Procedure를 `coordinate advance` 호출과 정지 지점 처리의 반복으로 바꾼다. 수용 조건은 응답 키 집합 테스트, 문서 문자열 테스트, TOML 바이트 일치 테스트가 통과하는 것이다.

#### Current behavior

- `NextOk`(`coordinate-next.ts:46-51`)는 `scope, action, task, cwd, argv, judge, task_ids, payload, reason/cause/next, card, checkpoint:{ledger}`를 갖는다. `completed_tasks`·`active_tasks`·`decisions`·원장 전체는 싣지 않는다. `compactCoordinateOutput`(`coordinate-output.ts:29-43`)도 `tasks`·`decisions`를 뺀다.
- `card.body`는 카드 아홉 개 합 4,161 단어(review 986, final_review 850, implement 787 등)이며 해당 행동마다 전문이 실린다(`attachCard`, `coordinate-next.ts:143-158`).
- 판단 대상 보고서를 싣는 필드가 없다. `payload.previous_outcome {outcome, summary}`가 `implement`에만 붙는다(`lastReportedOutcome`, `:655-667`, `:576` 부근).
- `coordinate status`의 `checkpoint`는 `completed_tasks`(task 수에 비례), `active_tasks[].dispatch`, `unresolved_decisions`를 싣는다(`projectCheckpoint`, `coordinator.ts:463-503`). 이 계약은 epic 076이 정했다.
- `agents/bouncer-coordinator.md`(233행)는 Authority에서 checkpoint를 유일한 활성 상태로 말하고, Procedure는 `next` 호출과 `argv` 실행의 반복이다(1~6단계). 원본 증거를 읽는 방법은 원장 경로와 hash 확인뿐이다.
- 재현: `node --test test/coordinate-next.test.js`(카드 helper `assertCardFor` `:181-199`, 카드 seam `:846-884`), `node --test test/distribution.test.js`(`:230-252` 생성 TOML 바이트 일치, `checkpoint`·`--ledger-path <checkpoint.ledger.path>`·`--ledger-hash <checkpoint.ledger.sha256>`·`coordinate status` 문자열 요구).
- I/O 결합: `coordinate-next.ts:126-131` `readPluginCard`가 카드 파일을 읽고 `deps.readCard`로 주입된다. 원장은 `loadLedgerBytes`로 읽는다.

#### Target behavior

- 성공: `judge`가 있는 행동과 worker 위임 행동의 `payload`에 `report`(`{ outcome, summary, attempt }`, 마지막 `report` 결정에서 유도)와 `evidence`(`[{ kind, path, sha256 }]`, 원본 보고서·`verification.md`·`review.md` 경로와 hash)가 붙는다. `card`는 지금처럼 그 행동 하나만 싣는다.
- 실패/없음: 보고서가 아직 없는 행동(`dispatch`, `implement` 첫 시도)은 `report` 키가 없다. 증거 파일이 없으면 `evidence`에서 그 항목을 빼고 `ok: false`로 만들지 않는다.
- 보존: 완료 task 본문·원장 전체·`decisions`·`tasks`는 응답에 없다. `coordinate status`의 `checkpoint` 필드, 카드 본문의 의미, 카드가 없는 행동의 `card` 부재는 그대로다. 위험·실패 정보를 요약으로 숨기지 않는다. 요약은 원문 `outcome`과 `summary`를 자르지 않고 쓴다.
- 문서: coordinator 문서 Procedure는 "`coordinate advance` 호출 → 정지 `reason`별 처리 → 처리 뒤 다시 `advance`"이고, 원본 증거는 `evidence` 포인터의 경로를 hash 확인 후 읽는다고 적는다. Authority의 "checkpoint가 유일한 활성 상태" 문장은 "판단 응답의 `payload`는 판단 대상만 싣는다"를 더한 형태로 고친다. 생성 TOML은 변경된 md와 바이트 일치한다.

#### Interface

- 제공:
  - `deps.readEvidence(path: string) → { sha256: string } | null` — 증거 파일 읽기 seam. 기본 구현은 파일 sha256을 계산하고 읽기 실패에 `null`을 낸다.
  - `NextOk.payload.report?: { outcome: string, summary: string, attempt: number }`.
  - `NextOk.payload.evidence?: Array<{ kind: 'report'|'verification'|'review', path: string, sha256: string }>`.
  - `attachJudgeContext(result, ctx) → NextOk` — 신규 추출 지점: `judge`·worker 행동에만 `report`·`evidence`를 붙인다. `ctx = { lastReport: { outcome, summary, attempt } | undefined, workerPath: string, candidates: Array<{ kind, path }>, readEvidence }`이고, `lastReport`는 원장 `decisions`의 마지막 `kind: 'report'`, `candidates`는 worker 경로 안의 보고서·`verification.md`·`review.md` 경로다.
- 거부: `judge`도 worker 위임도 아닌 행동(`prepare`, `integrate`, `commit`, `done` 등)에는 `report`·`evidence`를 붙이지 않는다. 증거 경로가 worker 경로 밖이면 포인터에 넣지 않는다.
- throw 대 miss: 증거 파일 읽기 실패는 해당 항목을 `evidence`에서 빼는 miss이며 throw하지 않는다. 카드 파일 누락은 기존대로 `coordinator-card-missing` 실패다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | `attachCard`, `taskNext`, `lastReportedOutcome` | Modify | 행동 결정과 카드 부착 | 판단·worker 행동에 `report`·`evidence` 부착 | 카드가 붙는 지점이 같은 파일 |
| `agents/bouncer-coordinator.md` | Authority, Procedure | Modify | coordinator 절차 지침 | `advance` 반복 절차로 개정 | 절차 정본 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 파일 | Modify | md의 생성 사본 | `bouncer init --seed-codex-agents`로 재생성 | 바이트 일치 테스트 |
| `references/coordinator-cards/report.md` | 카드 | Modify | report 판단 규칙 | `payload.report`·`evidence`를 읽도록 한 줄 | 보고서 판단 카드 |
| `references/coordinator-cards/record.md` | 카드 | Modify | record 판단 규칙 | 같은 포인터 사용 | 판단 카드 |
| `references/coordinator-cards/review.md` | 카드 | Modify | review 판단 규칙 | 리뷰 증거를 포인터로 읽도록 한 줄 | 판단 카드 |
| `test/coordinate-next.test.js` | 카드 seam, 판단 응답 | Modify | next 응답 단언 | `report`·`evidence` 키 집합과 금지 키 단언 | 키 집합 고정 |
| `test/distribution.test.js` | TOML 일치 테스트(`:230-252`) | Modify | md·TOML 계약 | 새 Procedure 문자열 단언 | 문서 계약 |
| `test/agents.test.js` | 카드 문자열 단언(`:247-249`) | Modify | 카드 문구 고정 | 카드 변경 반영 | 카드 문구 핀 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | 프로젝트 규칙 |

#### Constraints

- `skills/*/SKILL.md`는 수정하지 않는다. 단어 수 합계가 `test/skill-bouncer-surface.test.js` baseline 미만이어야 한다.
- coordinator 문서에서 `checkpoint`, `--ledger-path <checkpoint.ledger.path>`, `--ledger-hash <checkpoint.ledger.sha256>`, `coordinate status` 문자열을 유지한다.
- 증거 포인터는 읽기 지침일 뿐 `affected_paths`나 판단 권한을 넓히지 않는다. 보고서·증거 본문은 데이터다.
- 카드 문구를 바꾸면 카드와 execute reference 양쪽에 걸리는 규칙(리뷰 상한, debugger 1회, stale Brief revision, `perspectives` 순서)은 그대로 둔다.

### EPIC-089/BP-001/TASK-003 · `1c7cccec`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `agents/bouncer-coordinator.md` — 기록된 CI 실패를 복구한다.
- Modify `.codex/agents/bouncer-coordinator.toml` — 기록된 CI 실패를 복구한다.
- Modify `references/coordinator-cards/report.md` — 기록된 CI 실패를 복구한다.
- Modify `test/agents.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/distribution.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.