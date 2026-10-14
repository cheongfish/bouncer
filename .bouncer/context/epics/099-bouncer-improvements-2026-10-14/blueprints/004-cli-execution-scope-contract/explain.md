---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/099-bouncer-improvements-2026-10-14/blueprints/004-cli-execution-scope-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T15:12:43.961+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '099'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: 222862f85081f23775e27244bf3e42421ae339b8
      range_to: e13c35ef76d195a7510d3263fa9a24108aa42624
      diff_sha: 4d617517b047a2983afe9d9157c4abcc5a10e47755c2156c2e6283e31a8becfc
      recorded_at: '2026-10-14T15:20:00+09:00'
  task_commits:
    - task: EPIC-099/BP-004/TASK-001
      sha: 1199aaba
      intent_anchor: task-001
    - task: EPIC-099/BP-004/TASK-002
      sha: 2419a67a
      intent_anchor: task-002
    - task: EPIC-099/BP-004/TASK-003
      sha: 77b11b5a
      intent_anchor: task-003
    - task: EPIC-099/BP-004/TASK-004
      sha: 5d48c4f9
      intent_anchor: task-004
    - task: EPIC-099/BP-004/TASK-005
      sha: e13c35ef
      intent_anchor: task-005
---
# Explain

## Background

Bouncer CLI 몇 곳이 실패를 기계가 읽을 수 있는 형태로 돌려주지 못해 드라이브가 멈추거나 판정이 틀렸다.
빈 보고서가 성공으로 처리됐고, `commit`이 git hook에 거절되면 JSON 대신 stack이 출력됐다.
`revise`는 경로를 추가하려다 새 경로만 넘기면 범위가 조용히 줄었고,
한국어 이름처럼 C-quote되는 경로는 미커밋 변경 판정에서 허용 목록과 어긋났다.
저장소 밖을 가리키는 Touch 경로도 계획 게이트(G25)를 통과했다.
이 변경은 각 명령이 실패를 `reason`으로 돌려주게 하고, 기존 성공 경로와 결과 shape는 그대로 둔다.

## Intuition

문 앞 경비원이 "빈 상자도 통과", "사고가 나면 말없이 퇴장", "명단을 덮어써도 모른 척"하던 것을,
빈 상자는 돌려보내고, 사고는 보고서로 남기고, 명단이 줄면 알려 주는 쪽으로 바꾼 것이다.

## Code

- `scripts/src/lib/print-dispatch.ts` `runPrintDispatch`: transport가 성공해도 `report.trim()`이 비면 `report-missing`으로 실패한다. 성공 시 `report` 원문은 trim하지 않는다. `is_error` + 빈 결과는 기존 `result-error`가 먼저 잡는다. 문자열이 아닌 결과도 같은 실패다.
- `scripts/src/lib/commit.ts` `commitExceptionResult`와 `cli-git-commands.ts` `cmdCommit`: `commitTask`가 던진 예외를 `commit-exception` JSON 한 객체로 stdout에 낸다. `cause`는 message 첫 줄이고 stack은 싣지 않는다. 설계상 git 실패만이 아니라 모든 예외를 흡수한다.
- `scripts/src/lib/scope.ts` `reviseTaskScope`: `--paths`는 전체 교체다. 이전 범위에서 빠졌는데 새 집합이 덮지 못한 경로는 성공 결과의 `warnings`(`scope-paths-dropped`)로 알린다. 거절하지 않으므로 의도적 축소는 막지 않고, 경고가 없으면 키를 두지 않아 기존 결과와 같다.
- `scripts/src/lib/coordinator.ts` `disallowedDirtyPaths`: `git status --porcelain -z`로 NUL 구분 파싱한다. C-quote가 없어 한국어·따옴표·` -> `가 든 이름도 허용 목록과 원문 그대로 비교하고, rename·copy는 두 번째 토큰을 원래 경로로 읽는다.
- `scripts/src/lib/validate-gates.ts` `touchPathEscapesRepo`와 `checkTouchPathsExist`: 절대 경로(드라이브 문자 포함)이거나 정규화 결과가 `..`·`../…`인 Touch 경로는 존재 검사 없이 `Touch path escapes repository`로 task당 하나 실패한다. Create·Rename new 행에도 적용한다. `a/../b`처럼 안쪽으로 정규화되면 통과한다. 백슬래시 경로는 범위 밖이라 검사하지 않는다.
- 문서: coordinator의 commit 지시, revise 카드, spec-authoring, `rules/cli.md`가 새 reason을 반영한다.

## Quiz

1. 코디네이터가 띄운 print dispatch가 성공 종료했지만 보고서가 공백뿐이면 어떻게 되나?
2. `revise --paths`에 새 경로 하나만 넘겨 이전 범위의 다른 경로가 빠지면?
3. Touch 표에 `a/../b`와 `../x`가 Modify로 있으면 G25는 각각 어떻게 판정하나?

## Tasks

### EPIC-099/BP-004/TASK-001 · `1199aaba`

#### Goal & intent

`runPrintDispatch`가 최종 result event의 `result`가 문자열이 아니거나 trim 후 빈 문자열이면 `{ ok: false, reason: 'report-missing' }`로 실패하게 한다. transport가 성공해도 보고서가 없으면 coordinator가 그것을 판정할 보고로 받지 않게 하는 것이 목적이다. 수용 기준은 epic 성공 기준 18이다.

#### Current behavior

- 입력은 가짜 agent의 stream-json stdout이다. `scripts/src/lib/print-dispatch.ts:341-348`은 result event가 없으면 `result-missing`을 반환한다. `:350`은 `result`가 문자열이 아니면 `''`로 바꾸고, `:351-358`은 `is_error === true`일 때 `result-error`를 반환한다. `:360-369`는 그 밖의 모든 경우에 `ok: true`와 그 `report`를 반환하므로 빈 문자열 보고도 성공이 된다.
- `fail(reason, cause, next, extra?)`(`print-dispatch.ts:113-120`)가 `{ ok: false, reason, cause, next, ...extra }`를 만든다. `PrintDispatchFail.reason`은 `string`이라 타입을 추가할 필요가 없다(`:36-45`).
- I/O 관찰 지점: 자식 프로세스 spawn과 stdout 파일 읽기는 `print-dispatch.ts:315-340`에 있다. CLI `scripts/src/lib/cli-dispatch-command.ts:153-154`는 결과 JSON을 출력하고 `ok`가 아니면 exit 1을 반환하므로 고칠 필요가 없다.
- 문서: `rules/cli.md:257-259`가 reason 목록을 적는다. `rules/cursor-print-dispatch.md:50`(item 6)은 "non-zero exit 또는 missing `result` event는 dispatch 실패"라고만 적는다.
- 재현: `test/print-dispatch.test.js`의 `writeFakeAgent`(`:72-80`)에 `stdoutLines: ['{"type":"result","is_error":false}']`를 넣고 `runPrint(tree)`를 호출하면 `{ ok: true, report: '' }`가 나온다. 기존 단언은 `:252`(result-missing)와 `:264`(result-error)에 있다.

#### Target behavior

- 성공: 비어 있지 않은 문자열 `result`와 `is_error`가 true가 아닌 경우는 지금처럼 `ok: true`와 원문 `report`(trim하지 않음)를 반환한다.
- 실패: `result` 필드가 없거나 문자열이 아니거나, trim 결과가 `''`이면 `{ ok: false, reason: 'report-missing', cause, next, stdout, stderr }`를 반환하고 CLI는 exit 1이다.
- 보존: 판정 순서는 `result-missing` → `result-error` → `report-missing`이다. `is_error: true`에 result가 비어 있으면 계속 `result-error`다. 다른 reason의 문자열과 필드는 바꾸지 않는다.

#### Interface

- 제공: `runPrintDispatch`의 실패 reason에 `report-missing`을 추가한다. `cause`는 최종 result에 보고서 문자열이 없다는 사실을 적고, `next`는 stdout 파일을 확인하고 dispatch를 다시 실행하라고 안내한다.
- 거부: 보고서 문자열이 없거나 공백뿐인 최종 result는 성공으로 받지 않는다.
- 용어: "보고서 문자열"은 최종 result event의 `result` 값 중 `typeof === 'string'`이고 `trim().length > 0`인 것이다. 예: `{"type":"result","result":"  \n","is_error":false}`는 보고서 문자열이 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/print-dispatch.ts` | `runPrintDispatch` | Modify | result event의 `result`가 비어도 `ok: true`를 반환함 | `result-error` 판정 다음에 `report-missing` 실패를 추가함 | 실패 판정 진입점 |
| `test/print-dispatch.test.js` | 가짜 agent 결과 테스트 | Modify | 빈 보고서 단언이 없음 | 필드 없음·빈 문자열·공백·`is_error`+빈 result 단언을 추가함 | 검증 지점, unit tier에 이미 등록됨 |
| `rules/cli.md` | `dispatch print` reason 목록 | Modify | reason 7개를 나열함 | `report-missing`을 추가함 | 공개 reason 계약 문서 |
| `rules/cursor-print-dispatch.md` | item 6 Report | Modify | 실패 조건을 non-zero exit와 result 부재로만 적음 | 빈 보고서도 dispatch 실패라고 적음 | Cursor print 경로 규칙 |

#### Constraints

- 성공 시 `report`는 원문 그대로 둔다. trim은 판정에만 쓴다.
- 기존 reason 문자열, 결과 필드 이름, exit code 규칙을 바꾸지 않는다.
- 새 테스트 파일을 만들지 않는다. `test/tiers.json`은 고치지 않는다.
- TS 변경은 `npm run build` 뒤 `npm run check:emit`로 생성물 일치를 확인한다.

### EPIC-099/BP-004/TASK-002 · `2419a67a`

#### Goal & intent

`bouncer commit`이 `commitTask` 예외(git commit의 hook 거절 포함)를 만나도 stdout에 JSON 객체 하나를 내고 exit 1로 끝나게 한다. 그러면 `coordinate advance`의 자동 commit 실패가 `unclear-result`가 아니라 `commit-exception` reason으로 전달된다. 같은 task에서 coordinator 역할 문서의 commit 지시 모순(B-08)을 "`advance`가 commit을 실행한다" 쪽으로 정리한다. 수용 기준은 epic 성공 기준 19다.

#### Current behavior

- `cmdCommit`(`scripts/src/lib/cli-git-commands.ts:35-53`)은 `commitTask`를 try 없이 호출하고 결과를 `io.out(JSON.stringify(result, null, 2))`로 출력한다. 예외가 나면 출력 전에 빠져나간다. `runCli`(`scripts/src/lib/cli.ts:92-111`)와 launcher(`scripts/bouncer:95`)에도 catch가 없다. 그래서 Node가 stack을 stderr에 쓰고 exit 1로 끝나며 stdout은 비어 있다.
- `commitTask`(`scripts/src/lib/commit.ts:287-`)의 정책은 주석 `:296`에 있다. 게이트·범위 실패는 반환값으로 돌려주고 git I/O 예외는 그대로 던진다.
- 예외 지점:
  - `:442`의 `execFileSync('git', ['commit', '--only', ...])`는 try가 없어서 프로젝트 pre-commit hook이 거절하면 throw한다. 이때 `:425-435`에서 stage한 경로는 그대로 남는다.
  - `:323-334`의 gate 실행과 finally 복원도 throw할 수 있다.
  - `buildCommitMessage`(`scripts/src/lib/finalize.ts:210`, `normalizeAuthoredLines` `scripts/src/lib/templates.ts:384-410`)는 commit gate S32가 먼저 막지만, 판정이 갈리면 `:391`에서 throw한다.
- `recoveryFor`(`commit.ts:251-285`)는 알 수 없는 reason에 `{ action: 'report-and-stop', detail: 'Stop and report <reason>. Do not stage, commit, or move the pointer.' }`를 준다. `skills/bouncer-commit/SKILL.md:57-60`은 `ok: false`이면 `recovery.action`을 따르고 멈춘다.
- advance 쪽은 고칠 필요가 없다. `classifyRun`(`scripts/src/lib/coordinate-advance.ts:151-175`)은 stdout이 JSON 객체가 아니면 `unclear`이고, `ok: false` 본문이면 `reason`을 보존하는 `failure`다. `failFromBody`(`:189-203`)가 본문 필드를 유지한다.
- 문서 모순: `agents/bouncer-coordinator.md:163-164`는 "After the execute gate and before report or record, from the worker cwd run `bouncer commit --blueprint <dir> --yes`."이고, `:216-218`은 "`advance` already runs `commit` … do not re-run that commit argv by hand"다. `.codex/agents/bouncer-coordinator.toml`은 `mdToCodexToml`(`scripts/src/lib/codex-agents.ts:41`) 생성본이며, `test/agents.test.js:44-57`과 `:71-78`이 바이트 일치를 검사한다. 재생성 npm script는 없다.
- 재현: 임시 저장소에 `core.hooksPath`로 `exit 1` pre-commit hook을 걸고 `runCli(['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io)`를 호출하면 throw가 나고 `buf.out`이 비어 있다. 관련 테스트는 `test/cli-commit.test.js:157`(validate 실패 JSON)과 `test/coordinate-advance.test.js:197`(unclear-result)에 있다.

#### Target behavior

- 성공: 예외가 없으면 `cmdCommit`의 출력과 exit code는 지금과 같다.
- 실패: `commitTask`가 throw하면 `cmdCommit`은 stdout에 `{ ok: false, reason: 'commit-exception', cause: <error message 첫 줄>, recovery: { action: 'report-and-stop', detail } }`를 출력하고 1을 반환한다. stack은 stdout에 쓰지 않는다. stderr에는 한 줄 진단 `commit: <error message 첫 줄>`을 쓴다.
- advance: 자동 commit argv가 위 JSON과 status 1을 내면 `advance`의 실패 reason은 `commit-exception`이고 `recovery`가 보존된다.
- 보존:
  - `commitTask` 함수는 계속 throw한다. `test/cli-commit.test.js:394`의 `assert.throws`는 그대로 통과한다.
  - git commit 실패 뒤의 index 상태는 바꾸지 않는다.
  - `--blueprint` 누락은 계속 stderr와 exit 2다.
- 문서: coordinator 역할 문서의 `## Task round`는 commit을 `advance`가 실행한다고만 적는다. 직접 `bouncer commit`을 실행하라는 문장은 남기지 않는다.

#### Interface

- 제공: `commit.ts`에 `commitExceptionResult(error: unknown): { ok: false; reason: 'commit-exception'; cause: string; recovery: { action: RecoveryAction; detail: string } }`를 추가해 export한다. `recovery`는 `recoveryFor('commit-exception', false)`로 만든다. `cmdCommit`이 이 함수로 예외를 결과로 바꾼다.
- 거부: 플래그 오류(`--blueprint` 누락)는 이 경로를 타지 않고 지금처럼 exit 2다.
- 용어: "error message 첫 줄"은 `error instanceof Error ? error.message : String(error)`를 `\n`으로 나눈 첫 줄이다. 예: execFileSync의 `Command failed: git commit --only -m …`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/commit.ts` | `recoveryFor`, `신규 추출 지점: commit 예외 결과 생성` | Modify | 실패 reason별 recovery를 만들고 `commitTask`만 export함 | 예외를 `commit-exception` 결과로 바꾸는 함수를 추가해 export함 | 실패 결과 shape의 소유 모듈 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCommit` | Modify | 예외를 잡지 않음 | `commitTask` 호출을 try/catch로 감싸 JSON 실패와 exit 1을 반환함 | CLI 출력 경계 |
| `test/cli-commit.test.js` | hook 거절 commit 테스트 | Modify | commit 예외 경로 단언이 없음 | 실패 hook 저장소에서 stdout JSON 하나와 exit 1을 단언함 | 검증 지점 |
| `test/coordinate-advance.test.js` | 자동 commit 실패 전달 테스트 | Modify | commit 실패 본문 전달 단언이 없음 | `commit-exception` 본문이 reason과 recovery로 전달됨을 단언함 | advance 계약 회귀 방지 |
| `agents/bouncer-coordinator.md` | `## Task round` | Modify | 직접 commit 실행을 지시함 | `advance`가 commit을 실행한다고 고침 | B-08 문서 모순 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | md와 같은 모순 본문 | `mdToCodexToml`로 다시 생성함 | `test/agents.test.js` 패리티 |

#### Constraints

- stdout에는 JSON 객체 하나만 쓴다. 진단은 stderr로 보낸다.
- `commitTask`의 반환·throw 계약과 기존 reason(`validate`, `out-of-scope`, `verification-task-no-commit` 등)은 바꾸지 않는다.
- 실패 hook 테스트는 실제 git 저장소와 `core.hooksPath`를 쓴다. 테스트가 사용자 전역 git 설정을 바꾸면 안 된다.
- 새 테스트 파일을 만들지 않고 `test/tiers.json`을 고치지 않는다.
- coordinator md를 고친 뒤 TOML을 생성기로 다시 만든다. 손으로 편집하지 않는다.
- TS 변경은 `npm run build` 뒤 `npm run check:emit`로 확인한다.

### EPIC-099/BP-004/TASK-003 · `77b11b5a`

#### Goal & intent

`coordinate revise --paths`는 지금처럼 범위를 전달한 집합 전체로 교체한다. 다만 이전 범위의 경로가 새 집합에 덮이지 않으면 성공 결과에 `warnings: [{ code: 'scope-paths-dropped', paths }]`를 붙인다. coordinator 역할 문서, revise 카드, CLI 도움말에는 "전달한 경로 집합 전체로 교체한다"를 적는다. 목적은 경로 추가로 착각해 범위가 줄어드는 일(R1 후보 3, R3 후보 2에서 3회 반복)을 호출 직후 알아차리게 하는 것이다. 수용 기준은 epic 성공 기준 20이다.

#### Current behavior

- `reviseTaskScope`(`scripts/src/lib/scope.ts:660-778`):
  - `:700-704`에서 이전 범위 `previous`를 원장 `entry.scope.paths`, 없으면 문서 `affected_paths`로 정한다.
  - `:715-717`에서 문서 `affected_paths`를 `next`로 덮어쓴다.
  - `:775-777`에서 `{ ok: true, revision, previous, paths: next }`를 반환하고, revoke가 있을 때만 `revoked`를 붙인다.
  - JSDoc `@returns`는 `:658`에 있다.
  - 같은 함수 안의 `normalize`(`:735-739`)는 앞의 `./`와 끝의 `/`를 지운다. 파일 앞부분의 `isUnder(file, entry)`(`:21-27`)는 같은 경로이거나 디렉터리 하위인지 판정한다.
- CLI 래퍼(`scripts/src/lib/cli-git-commands.ts:795-812`)는 결과를 `{ ok; reason?; paths? }`로 캐스트하고 `{ ...result, checkpoint }`를 한 줄 JSON으로 stdout에 낸다. 따라서 결과에 붙인 키는 그대로 출력된다. 거절은 stderr와 exit 1이다.
- `warnings`의 기존 관례는 `scripts/src/lib/coordinator.ts:2985-2987`에 있다. 성공이고 경고가 하나 이상일 때만 키를 둔다.
- 문서:
  - `agents/bouncer-coordinator.md:75-87`과 `references/coordinator-cards/revise.md:6-13`의 revise 설명에 교체 의미가 없다.
  - 도움말 `cli-git-commands.ts:407-420`에도 없다.
  - `.codex/agents/bouncer-coordinator.toml`은 md 생성본이고 `test/agents.test.js`가 바이트 일치를 검사한다.
  - 카드 본문은 `test/coordinate-next.test.js:210-218`이 파일 내용 그대로 전달되는지만 본다.
- 재현: `test/commit-task.test.js:606` 테스트는 r1에서 `['src/auth/', 'src/session/']`로 넓힌 뒤 r2에서 `['src/auth/']`로 줄인다. r2 결과 `again`에는 경고가 없다.

#### Target behavior

- 성공:
  - 이전 범위의 각 경로 p에 대해, 새 집합에 normalize 후 p와 같거나 `isUnder(p, n)`인 n이 없으면 p를 dropped로 본다.
  - dropped가 하나 이상이면 결과에 `warnings: [{ code: 'scope-paths-dropped', paths: <dropped, 이전 범위 순서> }]`를 붙인다.
  - 예: 이전 `['src/auth/', 'src/session/']`, 새 `['src/auth/']`이면 `paths: ['src/session/']`이다.
- 경고 없음: 새 집합이 이전 경로를 모두 덮으면 `warnings` 키를 두지 않는다. 같은 경로, 넓히기, 상위 디렉터리로 바꾸기가 여기에 해당한다. 이전 범위가 비어 있을 때도 마찬가지다.
- 실패: 기존 거절 reason과 판정 순서는 그대로다.
- 보존:
  - 교체 의미, 문서·원장 쓰기, decision 기록(`previous`·`next`), lease revoke, `revoked` 키는 바꾸지 않는다.
  - 거절은 계속 stderr와 exit 1이다.
- 문서: coordinator md의 revise 단락과 revise 카드에 "`--paths` replaces the task scope with exactly the given set; pass every path the task still needs, not only new ones." 취지의 문장을 넣는다. 도움말의 registry 줄과 help 블록에도 교체 의미를 한 줄로 적는다.

#### Interface

- 제공: `reviseTaskScope` 성공 결과의 선택 키 `warnings?: Array<{ code: 'scope-paths-dropped'; paths: string[] }>`. CLI stdout 한 줄 JSON에 같은 키가 나온다.
- 거부: 경고 때문에 revise를 거절하거나 원장·문서 쓰기를 건너뛰지 않는다.
- 용어: "덮는다"는 normalize한 두 경로가 같거나, 새 경로가 이전 경로의 상위 디렉터리(`isUnder(prev, next)`)인 관계다. 예: `src/`는 `src/a.ts`를 덮는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scope.ts` | `reviseTaskScope` | Modify | 범위를 교체하고 previous·paths·revoked를 반환함 | dropped 경로를 계산해 `warnings`를 붙이고 JSDoc을 고침 | 범위 교체 진입점 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate` revise 분기, `COORDINATE_USAGE_BLOCKS.revise` | Modify | 결과를 그대로 출력하고 도움말에 교체 의미가 없음 | 캐스트 타입에 `warnings`를 넣고 도움말에 교체 의미를 적음 | CLI 출력·도움말 |
| `test/commit-task.test.js` | `reviseTaskScope` 테스트 | Modify | 축소 경고 단언이 없음 | 축소·넓히기·상위 디렉터리 교체의 경고 유무를 단언함 | 검증 지점 |
| `test/cli-coordinate.test.js` | revise stdout 테스트 | Modify | stdout 한 줄 JSON만 단언함 | CLI 축소 revise에서 stdout `warnings`를 단언함 | CLI 경계 검증 |
| `agents/bouncer-coordinator.md` | Hard guards revise 단락 | Modify | 교체 의미가 없음 | 전체 교체 문장을 넣음 | B-02 안내 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | md 생성본 | `mdToCodexToml`로 다시 생성함 | `test/agents.test.js` 패리티 |
| `references/coordinator-cards/revise.md` | revise 카드 | Modify | Hard guards 사본에 교체 의미가 없음 | 같은 문장을 넣음 | `advance` 정지 카드로 coordinator에 전달됨 |

#### Constraints

- `--add-path` 같은 새 플래그와 축소 거절 모드는 만들지 않는다.
- 경고가 없을 때는 `warnings` 키를 두지 않는다. 기존 성공 결과 단언과 바이트를 유지한다.
- 경고 계산은 ledger 잠금 안에서 쓰는 `previous`를 그대로 쓴다. 다른 읽기를 추가하지 않는다.
- 새 테스트 파일을 만들지 않고 `test/tiers.json`을 고치지 않는다.
- md를 고친 뒤 TOML을 생성기로 다시 만든다.

### EPIC-099/BP-004/TASK-004 · `5d48c4f9`

#### Goal & intent

`disallowedDirtyPaths`가 `git status --porcelain -z --untracked-files=all` 출력을 NUL 단위로 읽어 원래 경로 문자열로 허용 목록과 비교하게 한다. 한국어·따옴표가 든 경로처럼 Git이 C-quote하는 이름이나 ` -> `가 든 이름이 허용 증적과 어긋나 `integration-source-mutated`로 오판되는 일을 없앤다. 수용 기준은 epic 성공 기준 21이다.

#### Current behavior

- `disallowedDirtyPaths`(`scripts/src/lib/coordinator.ts:2576-2605`)는 다음 순서로 동작한다.
  1. `exec('git', ['status', '--porcelain', '--untracked-files=all'], …)`를 실행한다.
  2. 출력을 `\n`으로 나누고, 4자 미만 줄은 건너뛴다.
  3. 각 줄의 `line.slice(3).split(' -> ')`에서 제외 경로를 거른다. 제외 대상은 `.worktrees/`, `.bouncer/runtime/`, `.bouncer/config.json`이다.
  4. 남은 경로에서 바깥 따옴표만 `replace(/^"|"$/g, '')`로 지운다.
- 이 방식의 결함:
  - `core.quotePath` 기본값에서 비ASCII 바이트, `"`, `\`가 들어간 경로는 `"…\354\225…"`처럼 escape되어 나온다. 허용 목록 `allowed`(seed manifest 경로와 `${blueprint}/tasks/${id}/<evidence>`)는 원래 문자열이라 서로 맞지 않는다.
  - 이름에 ` -> `가 들어간 경로는 잘못 나뉜다.
  - 제외 검사가 따옴표를 지우기 전에 일어난다.
- 호출부는 `coordinator.ts:2809` integrate 하나다. 결과가 비어 있지 않으면 `{ ok: false, reason: 'integration-source-mutated', paths }`다. `Exec` seam 타입은 `:162`에 있다.
- 같은 파일의 `integrationChangedPaths`(`:910-926`)가 이미 `-z` 파싱을 한다. 토큰을 `\0`으로 나누고, status `slice(0, 2)`에 R·C가 있으면 다음 토큰이 원래 경로다. 다만 `.bouncer/` 전체를 빼는 다른 정책이라 함수를 그대로 재사용하지 않는다.
- seed 쪽 한계: `scripts/src/lib/seed-worktree.ts:189`도 `ls-files`를 `-z` 없이 읽는다. 그래서 한국어 blueprint 경로는 bootstrap seed 단계에서 먼저 escape된다. 이 task는 그 경로를 고치지 않으므로 한국어 blueprint 전체 드라이브를 테스트로 쓰지 않는다.
- 재현: `test/coordinator.test.js`의 `integrableDrive`(`:1216`)로 만든 ASCII blueprint drive의 integration checkout에 `src/한글 파일.js`나 `src/a -> b.js`를 쓰고 `integrateOne`을 호출한다. `paths`에 `"src/\355…"` escape 문자열이 담기거나, ` -> ` 이름이 둘로 나뉜다. 기존 단언은 `:1226`(허용 밖 `src/extra.js` 거절)과 `:1247`(dynamic task 비증적 파일만 거절)에 있다. fixture는 실제 git 저장소다.

#### Target behavior

- 성공: 허용 목록 비교는 escape 없는 원래 문자열로 한다. 허용 목록에 있는 경로는 이름에 한국어, 공백, 따옴표, ` -> `가 있어도 dirty 위반이 아니다.
- 실패: 허용 밖 경로는 계속 `integration-source-mutated`이고, `paths`에는 escape 없는 원래 문자열이 정렬·중복 제거되어 담긴다. 예: `src/한글 파일.js`.
- 보존:
  - rename·copy는 새 경로와 원래 경로를 모두 검사한다.
  - 제외 경로 세 가지와 허용 목록 구성, reason 문자열, 결과 shape는 그대로다.
  - `sourceStatus`, `initialWorktreeState`, `integrationChangedPaths`는 바꾸지 않는다.

#### Interface

- 제공: `disallowedDirtyPaths(exec, integrationPath, blueprint, ledger): string[]`의 시그니처는 같다. 반환 경로는 Git이 escape하지 않은 repo 상대 경로다.
- 거부: escape된 표기(`"…\NNN…"`)를 경로로 반환하지 않는다.
- 용어: "C-quote"는 Git이 porcelain v1 비`-z` 출력에서 특수 문자가 든 경로를 큰따옴표로 감싸고 바이트를 `\NNN`으로 escape하는 표기다. 예: `"\355\225\234.md"`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `disallowedDirtyPaths` | Modify | 줄 단위 porcelain에서 따옴표만 지워 비교함 | `-z` 토큰 파싱으로 바꾸고 rename·copy의 원래 경로 토큰을 함께 검사함 | integrate 범위 판정 진입점 |
| `test/coordinator.test.js` | integrate dirty 경로 테스트 | Modify | ASCII 경로만 단언함 | 한국어·` -> ` 이름 위반 경로가 원래 문자열로 보고됨을 단언함 | 검증 지점, integration tier에 이미 등록됨 |

#### Constraints

- 제외 경로 세 가지는 이름과 의미를 바꾸지 않는다. 비교는 `-z` 원문 경로로 한다.
- `exec` 출력 원문을 쓴다. trim하는 `git()` 헬퍼를 쓰지 않는다.
- 새 테스트 파일을 만들지 않고 `test/tiers.json`을 고치지 않는다.
- TS 변경은 `npm run build` 뒤 `npm run check:emit`로 확인한다.

### EPIC-099/BP-004/TASK-005 · `e13c35ef`

#### Goal & intent

plan gate G25가 Touch 표의 모든 행에서 절대 경로이거나 POSIX 정규화 결과가 repoRoot 밖인 경로를 `Touch path escapes repository: …` 실패로 보고하게 한다. 대상 행은 Create, Modify, Delete, Rename old, Rename new다. 저장소 밖 파일이 있다는 이유로 계획이 통과하지 않게 하는 것이 목적이다. 저장소에도 선행 task에도 없는 Rename old 경로가 G25로 실패하는 기존 동작도 테스트로 고정한다(C-06). 수용 기준은 epic 성공 기준 22다.

#### Current behavior

- `checkTouchPathsExist`(`scripts/src/lib/validate-gates.ts:1377-1430`, JSDoc `:1367-1376`)는 commit task의 Touch 행을 읽는다.
  - Create 행은 건너뛴다.
  - 나머지 행은 `fs.existsSync(path.join(repoRoot, row.path)) || made.has(row.path)`로 판정한다. `made`는 전이 `depends_on` 선행 task의 Create와 Rename new 경로다.
  - Rename new(`renameTo`)는 검사하지 않는다.
  - 없는 경로는 task당 하나의 실패 `{ code: 'G25', message: 'Touch path does not exist: <정렬된 경로 목록>', file }`로 모은다.
  - 절대 경로나 `..` 검사가 없다. `path.join`이 `../x`를 저장소 밖으로 풀기 때문에, 그 위치에 파일이 있으면 통과한다.
- 호출 조건(`validate-gates.ts:1084-1088`): plan gate이고, G19가 새 실패를 내지 않았고, light blueprint가 아니고, `ctx.repoRoot`가 문자열이어야 한다. 검사 대상 task는 `FRESHNESS_TASK_STATUSES` 상태로 한정한다.
- `parseTouchRows`(`scripts/src/lib/validate-sections.ts:200`, 타입 `:183`)는 `{ change, path, renameTo }`를 만든다. 백틱 제거, `toPosix`, 앞의 `./` 제거까지만 하고 `..`는 풀지 않는다. 소비자는 G25 하나이고, `test/validate-gates.test.js`의 `parseTouchRows … → returns normalized rows` 테스트가 출력 그대로를 고정한다.
- 힌트(`scripts/src/lib/validate.ts:84-89`)는 `code: 'G25'`, `match: /Touch path does not exist/`이고, `next`는 경로 오타·Create 전환·선행 task 추가를 안내한다. `test/validate-hints.test.js:28-31`이 힌트 code 목록을 고정한다.
- `scripts/src/lib/scope.ts:419`의 `outOfBoundsScopePaths`는 `..` 세그먼트를 모두 거절해서 `a/../b`도 막는다. 이 task의 판정과 다르므로 쓰지 않는다.
- 재현: `test/validate-gates.test.js:3472-` 헬퍼로 `g25Run([g25Task('001', [['Create', '`../outside.js`']])])`를 돌리면 G25가 없다. Modify `/etc/hosts`는 파일이 있어 통과한다. 기존 테스트는 `:3500` 이후에 있다(Modify 누락, Create·선행 Rename new 허용, Delete 누락, 게이트 제외 조건). Rename old 누락 테스트는 없다.

#### Target behavior

- 실패(escape):
  - 같은 호출 조건의 task에서 모든 행의 `path`와 `renameTo`(있을 때)에 escape 판정을 한다.
  - 경로가 절대 경로이거나(`path.posix.isAbsolute`, Windows 드라이브 문자 `/^[A-Za-z]:/` 포함), `path.posix.normalize` 결과가 `..`이거나 `../`로 시작하면 escape다.
  - task당 하나의 실패 `{ code: 'G25', message: 'Touch path escapes repository: <정렬·중복 제거된 경로>', file }`를 낸다.
  - escape 경로에는 존재 검사를 하지 않는다.
- 실패(기존): escape가 아닌 Modify·Delete·Rename old가 저장소에도 선행 task에도 없으면 지금처럼 `Touch path does not exist: …`다. 한 task에 두 종류가 있으면 실패 두 개를 낸다.
- 성공: `a/../b`처럼 정규화 뒤에도 저장소 안이면 escape가 아니다. 존재 검사는 원래 `row.path`로 지금처럼 한다.
- 힌트: G25 힌트의 `match`가 두 메시지를 모두 받는다. `next`에 `repository-relative` 경로로 고치라는 영어 안내를 더한다(기존 `next`가 영어다).
- 보존: 호출 조건(light 제외, freshness 상태, G19 선행, repoRoot 필요), `parseTouchRows` 출력, 기존 메시지 문자열, 힌트 code 목록은 바꾸지 않는다.

#### Interface

- 제공: G25 실패 메시지 `Touch path escapes repository: <paths>`.
- 거부: 절대 경로와 저장소 밖으로 정규화되는 상대 경로는 변경 종류와 관계없이 plan gate를 통과하지 못한다.
- 용어: "저장소 밖으로 정규화"는 `path.posix.normalize(p)`가 `..` 또는 `../…`인 경우다. 예: `src/../../x.js` → `../x.js`(escape), `src/../x.js` → `x.js`(통과).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `checkTouchPathsExist` | Modify | Create 외 행의 존재만 검사함 | 모든 행의 path·renameTo에 escape 판정을 하고 별도 G25 실패를 냄 | plan gate 판정 진입점 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` G25 항목 | Modify | 존재 실패 메시지만 match함 | 두 메시지를 match하고 `next`에 저장소 상대 경로 안내를 더함 | 실패 복구 안내 |
| `test/validate-gates.test.js` | G25 테스트 | Modify | escape·Rename old 누락 단언이 없음 | escape 행 종류별 실패, `a/../b` 통과, Rename old 누락 실패를 단언함 | 검증 지점, unit tier에 이미 등록됨 |
| `references/spec-authoring/index.md` | Touch 규칙의 G25 설명 | Modify | 존재 검사만 설명함 | 저장소 밖·절대 경로 실패를 한 문장 더함 | 계획 작성자가 읽는 규칙 |

#### Constraints

- `.bouncer/`·`.git/` 대상 Touch 경로를 새로 거절하지 않는다.
- 기존 `Touch path does not exist: …` 메시지와 task당 하나라는 집계 규칙을 유지한다.
- 파일시스템 쓰기와 git 호출을 추가하지 않는다. 판정은 문자열 정규화와 기존 `existsSync`만 쓴다.
- 새 테스트 파일을 만들지 않고 `test/tiers.json`을 고치지 않는다.
- TS 변경은 `npm run build` 뒤 `npm run check:emit`로 확인한다.