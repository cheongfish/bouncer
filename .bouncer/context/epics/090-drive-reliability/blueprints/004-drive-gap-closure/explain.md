---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/090-drive-reliability/blueprints/004-drive-gap-closure/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T20:40:55.528+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '090'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: 1b182cefd4c9c61b413bb02bd3f52ddf7b20b9a9
      range_to: ef15e399f82f058616c121c8d9846eeaaf30d80e
      diff_sha: b201a98b34432cda7201d5fad6fee8855228ffd98447d06eedec96172e68bfea
      recorded_at: '2026-10-10T20:41:43+09:00'
  task_commits:
    - task: EPIC-090/BP-004/TASK-001
      sha: 277ed47d
      intent_anchor: task-001
    - task: EPIC-090/BP-004/TASK-002
      sha: 01d8e957
      intent_anchor: task-002
    - task: EPIC-090/BP-004/TASK-003
      sha: 5947fe65
      intent_anchor: task-003
    - task: EPIC-090/BP-004/TASK-004
      sha: ef15e399
      intent_anchor: task-004
---
# Explain

## Background

드라이브가 돌면서 세 군데에서 조용히 막히거나 틀린 결과가 나왔다. task 문서의 `commit_summary`가 `[]`이면 커밋 단계가 오류로 멈췄다. implementer가 최종 보고를 내기 전에 먼저 반환하면 루트가 그 상황을 알아볼 방법이 없었다. 브랜치가 `package-lock.json`을 바꿔도 이전 `node_modules`가 남아 있으면 의존성을 다시 설치하지 않아 오래된 패키지로 검증했다. 이 변경은 세 공백을 닫는다.

## Intuition

빈 문장 목록은 "본문 없음"으로 읽고, 보고 파일은 "도착했는지"를 보는 우편함 깃발로 쓰며, `node_modules`에는 "어느 lockfile로 설치했는지" 적은 쪽지를 붙여 둔다. 쪽지와 지금 lockfile이 다르면 다시 설치한다.

## Code

- `scripts/src/lib/templates.ts` — `normalizeAuthoredLines`가 `[]`를 허용한다. `parseIntentBody`는 빈 Intent를 같은 메시지로 직접 거절한다.
- `scripts/src/lib/coordinator.ts` — `reportPathFor`, `observeReport`. dispatch 결과에 `report_path`, 활성 attempt 투영에 `report` 관측이 붙는다.
- `scripts/src/lib/seed-worktree.ts` — `prepareDependencies`가 lockfile sha256 stamp(`node_modules/.bouncer-lock-sha256`)를 비교하고 설치 성공 뒤 남긴다.
- `agents/bouncer-implementer.md`, `references/coordinator-cards/*`, `skills/bouncer-run/SKILL.md`, `rules/cli.md` — 보고 파일 계약과 재개 규칙 문서.
- 테스트: `test/seed-worktree.test.js`, `test/coordinator.test.js`, `test/finalize-pure.test.js`.

## Quiz

1. task의 `commit_summary: []`를 커밋 단계가 받으면 어떻게 되는가?
   - A) 오류로 거절한다
   - B) 본문 없음으로 취급한다
   - C) 기본 문장을 채운다
2. lockfile이 바뀌었는데 `node_modules/.package-lock.json`은 남아 있고 stamp가 현재 lockfile과 다르면?
   - A) marker가 있으니 설치를 건너뛴다
   - B) 오류를 내고 멈춘다
   - C) `npm ci`로 다시 설치하고 stamp를 갱신한다
3. stamp 파일을 읽다가 권한 오류가 나면?
   - A) stamp를 알 수 없는 것으로 보고 재설치한다
   - B) 의존성 준비 전체를 오류로 중단한다
   - C) 설치를 건너뛴다
4. implementer 보고 파일이 0바이트로 존재하면 status는 이를 어떻게 관측하는가?
   - A) present
   - B) status 전체가 오류가 된다
   - C) absent

## Tasks

### EPIC-090/BP-004/TASK-001 · `277ed47d`

#### Goal & intent

task frontmatter의 `commit_intent`·`commit_summary`가 `[]`일 때 task 커밋 메시지 생성이 실패하지 않고 해당 본문 줄을 생략한다. 에픽 수용 기준 11·12·13을 만족해야 한다. 최종 검증은 `npm run ci`이고 focused tests는 Checklist에 적는다.

#### Current behavior

- `scripts/src/lib/templates.ts:357-385` `normalizeAuthoredLines`는 `undefined`만 `[]`로 반환한다(:358). 문자열은 `<field> must be a YAML list of 1-2 Korean terminal sentences`(:361-363), 비배열·길이 0·길이 3 이상은 `<field> must contain 1-2 Korean terminal sentences`(:364-366), 비문자열 원소도 같은 오류(:368-370), 빈 줄·줄바꿈·한글 부재·종결형 부재는 `... (한국어 종결 문장)`(:378-381)으로 throw한다.
- `scripts/src/lib/templates.ts:388-404` `parseIntentBody`는 `## Intent` heading이 없으면 `blueprint Intent is missing or malformed`를 throw하고(:389-395), 빈 섹션은 `normalizeAuthoredLines([], 'blueprint Intent')`의 길이 검사(:403)에 기대어 throw한다.
- 호출자: `scripts/src/lib/finalize.ts:223-224` `buildCommitMessage`가 task의 두 필드를 넘기고 본문이 있을 때만 bullet을 붙인다. `finalize.ts:258` `buildFinalizeCommitMessage`는 `parseIntentBody`의 throw를 즉시 실패로 쓴다. `scripts/src/lib/finalize-digest.ts:598-605`는 throw를 잡아 `intent = []`로 둔다.
- 계획 쪽: `scripts/src/lib/schema.ts` `isValidAuthoredLineList`는 부재·길이 0–2·문자열 원소를 허용하고 `scripts/src/lib/validate-structural.ts:270-277` S32가 이를 쓴다. `scripts/src/lib/scaffold.ts:328-331`은 새 task에 `commit_intent: []`, `commit_summary: []`를 쓴다. `rules/document-schema.md:109-115`는 "Absent or `[]` keeps drafts and older tasks readable"이라고 적는다.
- 재현: 두 필드가 `[]`인 task로 `buildCommitMessage`를 호출하면 `commit_intent must contain 1-2 Korean terminal sentences`가 난다. `test/finalize-pure.test.js:812-828`은 `rejected` 목록(:817)에 `[]`를 넣어 이 거절을 고정한다.
- `scripts/lib/`는 `tsc` 생성 산출물이고 gitignore 대상이다. 테스트는 `../scripts/lib/templates`를 읽으므로 `npm run build`가 먼저 필요하다(`pretest`).

#### Target behavior

- 성공: `normalizeAuthoredLines([], field)`는 `[]`를 반환한다. 두 필드가 `[]`인 task의 커밋 메시지는 `<type>: <title>`·빈 줄·trailer만 가진다. 한 필드만 `[]`이면 다른 필드의 bullet만 남는다.
- 실패: 길이 3 이상, 스칼라 문자열, 비문자열 원소, 빈 문자열 원소, 한국어 종결형이 아닌 문장은 지금 메시지 그대로 throw한다. 빈 `## Intent` 섹션(주석만 있는 섹션 포함)은 `parseIntentBody`가 지금과 같은 `blueprint Intent must contain 1-2 Korean terminal sentences`로 계속 throw한다. heading이 없으면 지금처럼 `blueprint Intent is missing or malformed`다.
- 보존: `undefined` 처리, S32, scaffold 기본값, `finalize-digest`의 catch, `buildFinalizeCommitMessage`의 즉시 실패는 바뀌지 않는다.

#### Interface

- 제공: `normalizeAuthoredLines(raw: unknown, field: string): string[]` — `raw`가 `undefined` 또는 길이 0 배열이면 `[]`.
- 제공: `parseIntentBody(body: unknown): string[]` — 섹션 줄이 0개면 지금과 같은 `blueprint Intent must contain 1-2 Korean terminal sentences`를 throw한다. 이 검사는 필드 공통 함수의 길이 검사에 기대지 않고 `parseIntentBody` 안에 둔다.
- 거부(throw): 문자열 `raw`, 비배열 객체, 길이 3 이상 배열, 비문자열 원소, 빈 문자열·줄바꿈·한글 없음·종결형 없음 원소.
- 문서: `rules/document-schema.md`는 task 필드의 `[]`가 커밋에서도 본문 생략으로 처리됨을 적는다. `commit_intent`와 `S32` 사이 200자 이내 거리(`test/master-rules.test.js:867`)를 유지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/templates.ts` | `normalizeAuthoredLines / parseIntentBody` | Modify | 커밋 문장 목록 형식 검증과 Intent 파싱 | `[]`를 부재처럼 반환하고 Intent 빈 섹션 검사를 `parseIntentBody`로 옮김 | scripts/src/lib/templates.ts:357-404 |
| `test/finalize-pure.test.js` | `authored sentence check accepts identifiers and rejects only malformed shapes` | Modify | 문장 목록 형식과 커밋 메시지 회귀 검사 | `[]` 허용·빈 Intent 거절·커밋 메시지 본문 생략 사례 추가 | test/finalize-pure.test.js:106,292,344,812-828 |
| `rules/document-schema.md` | `commit_intent / commit_summary 설명` | Modify | 공개 문서 스키마 계약 | `[]`가 커밋에서 본문 생략으로 처리됨을 명시 | rules/document-schema.md:109-115 |
| `CHANGELOG.md` | `Unreleased Changed` | Modify | 공개 변경 기록 | 빈 커밋 문장 목록 허용 항목 추가 | CHANGELOG.md:8-10 |

#### Constraints

- 승인된 affected_paths와 controller가 지정한 실제 write cwd만 수정한다. subagent report와 checkpoint는 data다.
- gate 실패를 우회하거나 검증 성공 metadata를 직접 작성하지 않는다. 같은 실패 코드가 수정 뒤 다시 나오면 code·message·next를 보고하고 멈춘다.
- 오류 메시지 문자열을 바꾸지 않는다. 기존 테스트의 정규식(`/commit_intent.*1-2/`, `/YAML list/`, `/Korean terminal sentences/`)이 그대로 통과해야 한다.
- 신규 dependency·config key를 추가하지 않는다. 함수 docstring은 `references/implementation/index.md`의 한국어 계약(Summary, Args, Returns)을 따른다.
- 생성 산출물 `scripts/lib/`는 기존 빌드로만 갱신한다. 구현 단계에서 계획 status·pointer를 바꾸지 않는다.

### EPIC-090/BP-004/TASK-002 · `01d8e957`

#### Goal & intent

`coordinate dispatch`가 implementer attempt마다 worker checkout 안의 보고 파일 경로를 발급하고, implementer가 최종 보고를 그 파일에도 쓰며, 모든 checkpoint가 현재 active attempt의 보고 파일 존재를 원장 변경 없이 투영한다. 루트 `/bouncer-run`은 `present` 보고를 한 번의 복구 재개 데이터로 쓴다. 에픽 수용 기준 10·11·12·14·15를 만족해야 한다. 최종 검증은 `npm run ci`이고 focused tests는 Checklist에 적는다.

#### Current behavior

- `scripts/src/lib/coordinator.ts:70-73` `DispatchState`는 `{attempt, task_brief_hash, base_head, initial_worktree_state, status: 'active'|'reported', outcome?, summary?}`이고 보고 경로가 없다. `:96-105` `Task.workerPath`·`Task.dispatch`가 원장에 저장된다.
- `coordinator.ts:173-177` `ActiveTaskProjection`, `:471-484` `projectActiveTask`(`:479` workerPath 복사, `:482` dispatch spread), `:497-542` `projectCheckpoint`가 non-integrated task 전체를 `active_tasks`로 투영한다. `:536-540` `executor_observation`은 상수 `{state:'unknown', source:'unavailable', reason:'executor-state-not-tracked'}`다.
- `projectCheckpoint`는 status 전용이 아니다. `:552-556` `withCheckpoint`(모든 성공 mutation), `scripts/src/lib/cli-git-commands.ts:802`(`revise`), `scripts/src/lib/coordinate-next.ts:471`(`next`/`advance`)도 이 함수를 쓴다. `:2926-2937` `status`는 잠금 없이 원장을 읽고 `{ok, command, checkpoint}`를 반환한다.
- `coordinator.ts:3329-3372` `dispatch`: attempt는 `(item.dispatch?.attempt || 0) + 1`(:3350)이고 active 중 재호출은 `dispatch-already-active`(:3330)로 거절한다. 반환은 `withCheckpoint({ok, command, metadata:{attempt, task_brief_hash, base_head, initial_worktree_state, previous_outcome?}, task, decisions})`(:3362-3371)이다. full mode는 `workerPath === coordinatorPathsFor(...).workerPath`(:3318-3322), light mode는 `workerPath === integrationPath`(:3309-3316)를 요구한다.
- `scripts/src/lib/coordinate-next.ts:720-740`이 `implement` payload `{attempt, task_brief_hash, base_head, initial_worktree_state}`(+ 직전 `report`·`previous_outcome`)를 원장 dispatch에서 만든다. `:726-729`는 worker HEAD·porcelain 비교로 implement 여부를 정한다. `.bouncer/runtime/`가 gitignore라서 보고 파일은 이 비교에 보이지 않는다(`.gitignore`, `scripts/src/lib/init.ts:189-192`).
- `scripts/src/lib/coordinator-input.ts:22-48`은 checkpoint를 `JSON.stringify`로 그대로 넣고 `scripts/src/lib/coordinate-output.ts:31-43`은 `tasks`·`decisions`만 지운다. 새 checkpoint 필드는 status stdout과 `--write-input` 파일에 자동으로 실린다. `scripts/src/lib/runtime-state.ts:387-445` `validateCoordinatorCheckpoint`는 active 항목의 `id`·`status`만 요구한다.
- 역할: `coordinate dispatch` attempt는 implementer에만 있다(`references/coordinator-cards/dispatch.md`, `references/coordinator-cards/implement.md:15,41,62,79`의 "five metadata fields"). `agents/bouncer-implementer.md:121`(Report 단계), `:147-168`(Output contract, `Brief revision`이 attempt·hash를 되돌림). 생성 TOML `.codex/agents/bouncer-implementer.toml`은 `scripts/src/lib/codex-agents.ts:43` `mdToCodexToml(md)`와 바이트 단위로 같아야 한다(`test/agents.test.js:650-666,706-716,738-749`).
- 루트: `skills/bouncer-run/SKILL.md:157-164` 판정표의 `| unknown | any | stop \`worker-state-unknown\` |` 행이 무조건 중단한다. `:133-137`은 "one undecided raw report of the recovery re-dispatch"만 데이터로 허용한다. `test/skill-bouncer-run.test.js:213-242`가 표 정규식(`/\| unknown \|/`, `worker-state-unknown`, `stop here\s+— except the table's single recovery re-dispatch`)을, `:186-190`이 step 4에 `coordinate dispatch`·`previous_outcome`·`base_head`·`initial_worktree_state`가 없음을 고정한다.
- 재현 기준: `test/coordinator.test.js:1417-1449`(dispatch metadata `deepStrictEqual`, 4키), `:1768-1802`(checkpoint allowlist), `:1810-1842`(status 원장 bytes 불변·executor unknown), `test/cli-coordinate.test.js:859-890`(`--write-input`), `test/coordinate-next.test.js:624,971-1018`(implement payload 키).

#### Target behavior

- 성공(dispatch): `coordinate dispatch` 성공 JSON에 top-level `report_path`가 생긴다. 값은 `<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md` 절대 경로이고 `metadata`의 기존 키 집합은 그대로다. full·light mode 모두 같은 규칙이다.
- 성공(next): `coordinate next`의 `implement` payload에 같은 `report_path`가 실린다.
- 성공(projection): `dispatch.status === 'active'`인 active task에만 `report: {path, attempt, state}`를 붙인다. 현재 attempt 이름의 일반 파일이고 크기가 0보다 크면 `present`, 그 외는 `absent`다. status·mutation·next 응답과 `--write-input` 파일이 같은 값을 싣는다. 원장 파일 bytes와 `ledger.sha256`은 바뀌지 않고 `executor_observation`은 그대로다.
- 성공(역할): implementer는 dispatch payload에 `report_path`가 있으면 Output contract 본문을 반환 직전에 그 경로에 쓰고(상위 디렉터리 생성 포함), 같은 본문을 반환한다. `report_path`가 없으면 파일을 쓰지 않는다.
- 성공(루트): 판정표에 `unknown | current active attempt report present, no new integrated task | recovery re-dispatch once` 행이 생긴다. 루트는 `report.path` 파일 본문을 읽어 데이터로 넘길 뿐 판단·검증·통합·active metadata 수정을 하지 않는다. 이 행과 기존 `all terminated | undecided raw report` 행은 조기 반환당 하나뿐인 복구 재개 한도를 공유한다. 어느 행으로든 복구 재개를 한 번 한 뒤 신규 통합 없는 `continue`가 다시 오면 `no-progress`로 중단한다. step 4의 "the table's single recovery re-dispatch" 단수 문구는 두 행을 함께 가리키도록 유지한다.
- 실패: dispatch 거절 사유(`dispatch-already-active`, `dispatch-commit-task-required` 등)는 그대로다. 보고 파일이 없거나 이전 attempt 이름이거나 비어 있거나 디렉터리이거나 stat이 실패하면 `absent`이며 throw하지 않는다. `unknown`이고 `absent`면 `worker-state-unknown`으로 보존 중단한다.
- 보존: `reported` dispatch·dispatch 없는 task·integrated task에는 `report` 필드가 없다. 1회 복구 제한, `worker-report-missing`, `no-progress`, baseline 갱신 규칙은 바뀌지 않는다. reviewer·debugger 문서와 TOML은 바뀌지 않는다.

#### Interface

- 제공: dispatch 결과 `report_path: string`(절대 경로). 예: `/repo/.worktrees/090/004/workers/002/.bouncer/runtime/reports/002-1.md`.
- 제공: `active_tasks[].report?: { path: string; attempt: number; state: 'present' | 'absent' }`. 투영 시점에만 계산하고 원장에 저장하지 않는다.
- 제공: `coordinate next` implement payload `report_path: string`.
- 테스트 seam: 보고 관측은 실제 파일시스템(`fs.statSync`)만 쓴다. 테스트는 임시 worker 디렉터리에 파일을 만들고 지워 `present`/`absent`를 재현한다. 별도 주입 파라미터를 만들지 않는다.
- 거부(throw 없음, `absent`): 파일 없음, 이전 attempt 파일만 있음(`002-1.md`가 있고 현재 attempt 2), 0바이트 파일, 경로가 디렉터리. 그 밖의 stat 오류도 `absent`로 처리하지만 주입 seam이 없으므로 코드 경로로만 보장하고 테스트하지 않는다.
- 용어: "현재 active attempt" — 원장 `task.dispatch.status === 'active'`의 `dispatch.attempt` 값. 예: 재dispatch 뒤 attempt 2면 `002-2.md`만 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `ActiveTaskProjection / projectActiveTask / dispatch` | Modify | checkpoint 투영과 dispatch attempt 개설 | 보고 경로 계산·`report` 투영·dispatch `report_path` 반환 | scripts/src/lib/coordinator.ts:173-177,471-484,3329-3372 |
| `scripts/src/lib/coordinate-next.ts` | `implement payload` | Modify | 원장 dispatch에서 implement payload 생성 | payload에 `report_path` 추가 | scripts/src/lib/coordinate-next.ts:720-740 |
| `agents/bouncer-implementer.md` | `Report / Output contract` | Modify | implementer 최종 보고 형식 | `report_path`가 있으면 같은 본문을 파일로도 남김 | agents/bouncer-implementer.md:121,147-168 |
| `.codex/agents/bouncer-implementer.toml` | `mdToCodexToml 산출물` | Modify | implementer 역할의 Codex 미러 | Markdown 변경과 바이트 일치 재생성 | scripts/src/lib/codex-agents.ts:43 |
| `references/coordinator-cards/dispatch.md` | `dispatch card` | Modify | dispatch 직후 코디네이터 절차 | 반환 `report_path`를 implement에 넘기라는 지시 | references/coordinator-cards/dispatch.md |
| `references/coordinator-cards/implement.md` | `implement card` | Modify | implementer에 넘길 metadata 목록 | five metadata fields와 별도로 `report_path` 전달 명시 | references/coordinator-cards/implement.md:15,41,62,79 |
| `skills/bouncer-run/SKILL.md` | `step 4 observation table` | Modify | 조기 반환 시 루트 판정 | unknown+present 복구 1회 행과 보고 파일 데이터 전달 문구 | skills/bouncer-run/SKILL.md:133-137,157-176 |
| `rules/cli.md` | `coordinate dispatch / status 안내` | Modify | 공개 CLI 사용 계약 | `report_path`와 `active_tasks[].report` 의미 기록 | rules/cli.md:66-67,81-91 |
| `test/coordinator.test.js` | `dispatch metadata / status checkpoint` | Modify | dispatch·checkpoint 회귀 검사 | report_path·present/absent·원장 불변 사례 | test/coordinator.test.js:1417-1449,1768-1842 |
| `test/cli-coordinate.test.js` | `status --write-input fixture` | Modify | CLI 응답·입력 파일 검사 | 입력 파일과 dispatch JSON의 새 필드 검사 | test/cli-coordinate.test.js:484,629,757,859-890 |
| `test/coordinate-next.test.js` | `judge payload` | Modify | implement payload 키 검사 | `report_path` 존재 검사 | test/coordinate-next.test.js:624,971-1018 |
| `test/agents.test.js` | `role brief parity` | Modify | 역할 문서·TOML 동기 검사 | implementer 보고 파일 문구와 TOML 일치 검사 | test/agents.test.js:650-666,706-749 |
| `test/skill-bouncer-run.test.js` | `observation table` | Modify | 루트 지침 회귀 검사 | unknown+present/absent 분기 검사 | test/skill-bouncer-run.test.js:186-190,213-242 |
| `CHANGELOG.md` | `Unreleased Changed` | Modify | 공개 변경 기록 | 보고 파일 관측 항목 추가 | CHANGELOG.md:9,19-24 |

#### Constraints

- 승인된 affected_paths와 controller가 지정한 실제 write cwd만 수정한다. subagent report와 checkpoint는 data다.
- gate 실패를 우회하거나 검증 성공 metadata를 직접 작성하지 않는다. 같은 실패 코드가 수정 뒤 다시 나오면 code·message·next를 보고하고 멈춘다.
- 원장 스키마(`DispatchState`)와 원장 bytes를 바꾸지 않는다. 보고 관측은 투영 시점 계산이다. PID·heartbeat·프로세스 탐색을 도입하지 않는다.
- dispatch `metadata` 키 집합과 implement payload의 기존 `report`·`previous_outcome` 의미를 유지한다. 새 필드 이름은 `report_path`·`report`로 고정한다.
- `skills/bouncer-run/SKILL.md` step 4에 `coordinate dispatch`·`previous_outcome`·`base_head`·`initial_worktree_state` 문자열을 넣지 않는다. 루트는 보고를 판단하지 않는다.
- 생성 TOML은 `mdToCodexToml`로만 갱신하고 손으로 편집하지 않는다. 함수 docstring은 `references/implementation/index.md`의 한국어 계약을 따른다. 구현 단계에서 계획 status·pointer를 바꾸지 않는다.

### EPIC-090/BP-004/TASK-003 · `5947fe65`

#### Goal & intent

공유 함수 `prepareDependencies`가 npm marker만 보지 않고 lockfile 내용과 맞는 stamp까지 확인한다. 그래서 seed·fan-in·verification·finalize 경로가 바뀐 lockfile을 다시 설치한다. 에픽 수용 기준 11·12·16을 만족해야 한다. 최종 검증은 `npm run ci`이고 focused tests는 Checklist에 적는다.

#### Current behavior

- `scripts/src/lib/seed-worktree.ts:44-62` `prepareDependencies(worktreePath, deps)`:
  - `:48-49`: `package-lock.json`이 없거나 `node_modules/.package-lock.json`이 있으면 `{ok:true}`를 반환한다.
  - `:54-57`: 그 밖에는 `(deps.execFileSync || execFileSync)('npm', ['ci','--include=dev','--ignore-scripts','--no-audit','--no-fund'], {cwd: worktreePath, stdio:'inherit'})`를 호출한다.
  - `:58-60`: throw는 `{ok:false, reason:'dependency-install-failed', message}`가 된다.
  - `:33-43` JSDoc이 marker만 보는 규칙을 적는다. `:26` `SeedDeps = { execFileSync?: typeof execFileSync }`가 유일한 seam이고, `fs`는 직접 쓴다(`:3`). `createHash`는 이미 import돼 있다(`:6`).
- 호출자:
  - `seed-worktree.ts:197`(`seedWorktree`), `:302`(`seedCoordinatorWorker`)
  - `scripts/src/lib/coordinator.ts:855`(supplement verify), `:2080`(integrate)
  - `scripts/src/lib/finalize.ts:946-966` `prepareFinalizeDependencies`: cwd·stdio capture wrapper. `:930` `FINALIZE_INSTALL_COMMAND`, `:935-938` JSDoc이 "lockfile 존재·marker 부재"를 적는다.
  - 운영 코드에서 "marker가 있으면 exec 호출이 없다"에 기대는 곳은 없다. 테스트만 기댄다.
- 테스트의 mock `execFileSync`는 파일을 만들지 않는다. lockfile만 있는 fixture에서는 `node_modules` 디렉터리가 없다.
- 지금 규칙(marker만 있으면 exec 0회)을 고정하는 fixture:
  - `test/seed-worktree.test.js:270-286`(재사용 worktree), `:643-664`(`seedCoordinatorWorker` skip), `:685-698`(`prepareDependencies` skip)
  - `test/finalize.test.js:1856-1871`의 `'marker'` 사례. `writeLockfile({marker:true})`(:1784-1790)는 stamp를 쓰지 않는다.
- 설치 경로 fixture: `test/seed-worktree.test.js:241-268,615-641,666-683`, `test/coordinator.test.js:2585-2626`(설치), `:2628-2660`(설치 실패), `test/finalize.test.js:1828` 이후.
- 문서: `rules/cli.md:33-35`("when `package-lock.json` exists and `node_modules/.package-lock.json` does not"), `CHANGELOG.md:12-14`("lockfile이 있고 설치 marker가 없을 때만").
- `.bouncer-lock-sha256`이라는 이름은 저장소 어디에서도 쓰지 않는다. `scripts/lib/`는 `tsc` 생성 산출물이고 gitignore 대상이다.

#### Target behavior

- 성공(skip): lockfile이 없으면 지금처럼 건너뛴다. lockfile·marker·stamp가 모두 있고 stamp 내용(앞뒤 공백 제거)이 lockfile 원본 바이트의 sha256 hex와 같으면 exec 없이 `{ok:true}`.
- 성공(install): marker나 stamp가 없거나, stamp를 읽을 수 없거나, 값이 다르면 기존 argv·options로 `npm ci`를 한 번 실행한다. 성공하면 `node_modules` 디렉터리를 만들고(`recursive`) `node_modules/.bouncer-lock-sha256`에 현재 hash와 줄바꿈을 쓴 뒤 `{ok:true}`.
- 실패: exec throw는 지금처럼 `{ok:false, reason:'dependency-install-failed', message}`이고 stamp를 쓰지 않는다. 설치 성공 뒤 stamp 쓰기만 실패하면 `{ok:true}`를 반환한다. 다음 호출은 stamp가 없으므로 재설치한다.
- 보존: npm argv·`stdio:'inherit'` 기본값, finalize의 cwd·stdio capture와 `FINALIZE_INSTALL_COMMAND`, 반환 타입, 호출자의 실패 매핑은 바뀌지 않는다.

#### Interface

- 제공: `prepareDependencies(worktreePath: string, deps: SeedDeps): { ok: true } | { ok: false; reason: string; message: unknown }`. 시그니처는 그대로다.
- 제공: stamp 파일 `node_modules/.bouncer-lock-sha256`. 내용은 `sha256(readFileSync('package-lock.json'))` hex 한 줄이다. 예: `3f2a…9c\n`.
- 테스트 seam: 기존 `deps.execFileSync(file: string, argv: string[], options: object) → unknown`. 호출 횟수와 throw 주입에 쓴다. stamp는 실제 파일로 만들고 확인한다. 새 seam은 추가하지 않는다.
- 설치로 이어지는 상태(throw 아님): stamp 없음, stamp 경로가 디렉터리, stamp 값 불일치, marker 없음.
- throw 대신 결과로 반환: exec 실패 → `dependency-install-failed`.
- 용어: "stamp 일치" — stamp 파일 내용을 `trim()`한 값과 현재 lockfile hash가 같다. 예: lockfile을 한 바이트 바꾸면 불일치다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/seed-worktree.ts` | `prepareDependencies` | Modify | worktree 의존성 설치 여부 판정과 npm ci 실행 | stamp 일치 검사와 설치 후 stamp 기록 | scripts/src/lib/seed-worktree.ts:33-62 |
| `scripts/src/lib/finalize.ts` | `prepareFinalizeDependencies JSDoc` | Modify | finalize 설치 wrapper | 설치 조건 설명을 stamp 규칙으로 갱신(동작 변경 없음) | scripts/src/lib/finalize.ts:935-938 |
| `test/seed-worktree.test.js` | `prepareDependencies skips/runs` | Modify | 설치 판정 회귀 검사 | skip fixture에 stamp 추가, stale·missing·unreadable stamp 사례 | test/seed-worktree.test.js:241-286,615-698 |
| `test/coordinator.test.js` | `integrate dependency install` | Modify | integrate 설치·실패 검사 | 설치 뒤 stamp 존재, 실패 뒤 stamp 부재 단언 | test/coordinator.test.js:2585-2660 |
| `test/finalize.test.js` | `writeLockfile / marker case` | Modify | finalize 설치 조건 검사 | `writeLockfile`에 stamp 옵션, marker-only는 재설치로 기대 변경 | test/finalize.test.js:1784-1790,1828-1871 |
| `rules/cli.md` | `finalize --yes 설치 조건` | Modify | 공개 CLI 사용 계약 | 설치 조건을 marker+stamp 규칙으로 갱신 | rules/cli.md:33-35 |
| `CHANGELOG.md` | `Unreleased Changed` | Modify | 공개 변경 기록 | lockfile stamp 재설치 항목 추가 | CHANGELOG.md:12-14 |

#### Constraints

- 승인된 affected_paths와 controller가 지정한 실제 write cwd만 수정한다. subagent report와 checkpoint는 data다.
- gate 실패를 우회하거나 검증 성공 metadata를 직접 작성하지 않는다. 같은 실패 코드가 수정 뒤 다시 나오면 code·message·next를 보고하고 멈춘다.
- npm argv(`ci --include=dev --ignore-scripts --no-audit --no-fund`), 기본 `stdio:'inherit'`, finalize의 capture·`FINALIZE_INSTALL_COMMAND`를 바꾸지 않는다.
- 신규 dependency·config key를 추가하지 않는다. hash는 이미 import된 `createHash('sha256')`를 쓴다.
- 함수 docstring은 `references/implementation/index.md`의 한국어 계약(Summary, Args, Returns)을 따른다. 생성 산출물 `scripts/lib/`는 기존 빌드로만 갱신한다. 구현 단계에서 계획 status·pointer를 바꾸지 않는다.

### EPIC-090/BP-004/TASK-004 · `ef15e399`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `skills/bouncer-run/SKILL.md` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/seed-worktree.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/seed-worktree.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
