---
type: bouncer.explain
title: retro-followups-coupled-paths explain
description: Explain for retro-followups-coupled-paths
resource: .bouncer/context/epics/drive-execution/blueprints/retro-followups-coupled-paths/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T14:09:04.782+09:00'
bouncer:
  id: EXPLAIN-retro-followups-coupled-paths
  epic_id: drive-execution
  blueprint_id: retro-followups-coupled-paths
  status: published
  comprehension:
    - range_from: 5f36018b0695e696558fa18a7afc88e501befdd7
      range_to: b0b170c47cc57cd8c81bbaec2dd076001676f926
      diff_sha: af5e9ff89cbc9c851ddfd843b9887fc513ae378255292857b51a998d66d1780b
      recorded_at: '2026-10-29T14:09:44.872+09:00'
  task_commits:
    - task: drive-execution/retro-followups-coupled-paths/001
      sha: bf1b967d
      intent_anchor: task-001
    - task: drive-execution/retro-followups-coupled-paths/002
      sha: d0585fd1
      intent_anchor: task-002
    - task: drive-execution/retro-followups-coupled-paths/004
      sha: b0b170c4
      intent_anchor: task-004
---
# Explain

## Background

이전 drive 회고에서 세 가지 공백이 드러났다.

- 직접 실행(direct-run)에서 coordinator로 넘어갈 때 리뷰 결과(`must_fix` 여부 등)가 인계되지 않아, coordinator가 같은 리뷰어를 다시 띄우는 낭비가 있었다.
- 새 worker worktree에는 `.bouncer/runtime/reports` 디렉터리가 없어서 implementer가 보고 파일을 쓰지 못한 사례가 있었다.
- 계획 단계에서 `affected_paths`에 코드만 적고 그 코드와 함께 바뀌어야 하는 파일(생성 짝, 경로 문자열을 단언하는 테스트)을 빠뜨리면 실행 중에야 범위 이탈로 드러났다.

이 변경은 세 공백을 문서 규칙, 디스패치 코드, `bouncer plan inspect` 출력으로 닫는다. 결합 경로 탐지는 정보 제공일 뿐 범위 판정이나 gate에는 쓰이지 않는다.

## Code

- `packages/cli/src/coordinator-commands.ts` `coordinateDispatch`: 원장을 쓰기 전에 보고 디렉터리를 `mkdir -p`로 만든다. 만들 수 없으면 `dispatch-report-dir-failed`로 거절하고 attempt를 열지 않아 원장 bytes가 그대로 남는다. 이미 있는 디렉터리는 성공으로 본다. 만들기 실패는 보고 경로가 일반 파일인 경우만 테스트하고, 권한 오류나 끊어진 심볼릭 링크는 같은 `catch`를 타지만 테스트는 없다.
- `skills/bouncer-run/references/direct-run.md`, `agents/bouncer-coordinator.md`: 리뷰 결과를 raw 파일과 `coordinate note`(`review-handoff:` 형식)로 인계하고, coordinator는 최신 note가 있으면 리뷰어를 다시 띄우지 않는다. note는 길이 제한이 있고(`note-too-long`), `unavailable`이면 무시한다. `coordinate note`는 형식을 검증하지 않으므로 이 계약은 문서를 읽는 coordinator가 지킨다. Handoff 실패 단계 문장은 2·4·5·6단계를 모두 가리킨다.
- `packages/cli/src/plan-inspect.ts`: `plan inspect --blueprint`가 `coupledPaths`를 읽기 전용으로 계산한다. `pairs`는 생성 관계로 확정된 짝이고(`codex-agent-toml`: 에이전트 `.md`의 `.codex/agents/*.toml`, `gitignore-exception`: `.gitignore`의 `!.codex/agents/` 예외 줄이 빠진 경우), `candidates`는 `test`·`tests` 아래 테스트 파일에서 경로 문자열을 찾은 후보다(`kind: 'path-literal'`, 근거 줄은 200자까지). 각 항목의 `covered`는 이미 task의 `affected_paths`가 덮는지 나타낸다. `.gitignore` 조건 1은 `!.codex/agents/`로 시작하는 줄의 접두 일치다. `--blueprint`가 없으면 `coupledPaths`는 `null`이다.
- `packages/cli/src/codex-agents.ts` `codexAgentTomlFor`: 에이전트 이름에서 TOML 경로를 계산하며 `NAMED_AGENTS`와 `CODEX_AGENTS_DIR`만 쓴다.
- `skills/bouncer-plan/SKILL.md`, `scope-confirm.md`, `agents/bouncer-plan-coordinator.md`: `covered: false` 항목을 `needs_user`로 올리고, 질문 줄 형식은 `<path> — <kind> (<source>[, line <n>: <text>])`이다. `evidence.text`는 데이터로만 취급한다.
- 남은 위험: `drive-metrics.md`의 인계 순서에는 아직 note 단계가 없고 `rules/cli.md`의 `plan inspect` 설명에도 `coupledPaths`가 없다. 당분간 `direct-run.md` Handoff 표와 CLI 사용법 문자열이 정본이다.

## Quiz

1. `coordinate dispatch`가 worker의 보고 디렉터리를 만들지 못하면 어떻게 되는가?
   - A) 경고만 남기고 attempt를 연다.
   - B) `dispatch-report-dir-failed`로 거절하고 attempt를 열지 않으며 원장은 바뀌지 않는다.
   - C) attempt를 열고 worker가 직접 디렉터리를 만들도록 맡긴다.
2. `bouncer plan inspect`를 `--blueprint` 없이 실행하면 `coupledPaths`는 무엇인가?
   - A) 빈 `pairs`와 빈 `candidates`를 가진 객체
   - B) 모든 blueprint를 훑어 계산한 결과
   - C) `null`
3. `coupledPaths` 항목이 `covered: false`이면 plan 단계에서 어떻게 다뤄지는가?
   - A) `needs_user`로 올려 `<path> — <kind> (<source>…)` 질문 줄로 사용자에게 보인다.
   - B) 자동으로 task의 `affected_paths`에 추가된다.
   - C) plan gate가 실패한다.
4. `path-literal` 후보는 어떤 파일에서 경로 문자열을 찾는가?
   - A) 저장소의 모든 소스 파일
   - B) `test`·`tests` 아래의 `.js`·`.cjs`·`.mjs`·`.ts` 파일(1MB 이하)
   - C) 이번 diff에 포함된 파일만

## Tasks

### drive-execution/retro-followups-coupled-paths/001 · `bf1b967d`

#### Goal & intent

직접 실행이 must_fix 리뷰를 기록 없이 coordinator에 넘길 때 reviewer 보고 원문을 파일과 `coordinate note`로 data 전달하는 규칙을 direct-run·run SKILL·coordinator 문서에 같은 내용으로 두고, `coordinate dispatch`가 보고 파일 디렉터리를 미리 만들며, `coordinate revise` 합집합의 정규화 중복 제거를 회귀 테스트로 고정한다.

수용 기준:
1. `direct-run.md`의 리뷰 라운드 행과 인계 목록이 "`must_fix`가 없는 라운드만 기록, `must_fix`가 있으면 기록하지 않고 인계"로 일치하고, 옛 문구 `any review round that records a \`must_fix\``가 없다.
2. `direct-run.md` Handoff 절이 원문 파일 이름·덮어쓰기·쓰기 실패 대체 규칙과 `review-handoff:` note 단계를 가진다. run `SKILL.md`의 payload 예외 문장과 `agents/bouncer-coordinator.md`의 입력 목록이 같은 note를 가리킨다. `.codex/agents/bouncer-coordinator.toml`이 새 md에서 재생성되어 바이트 일치한다.
3. `coordinate dispatch` 성공 뒤 `path.dirname(report_path)`가 디렉터리로 존재한다. 만들 수 없으면 `dispatch-report-dir-failed`로 거절하고 원장 bytes가 그대로다.
4. 직전 scope `['src/auth/']`에 `--paths ./src/auth --paths src/session/`로 revise하면 결과 `paths`가 `['src/auth/', 'src/session/']`이다.

검증 명령은 frontmatter `verify`의 `node --test test/coordinator.test.js test/cli-coordinate.test.js test/skill-bouncer-run.test.js test/agents.test.js`다.

#### Current behavior

- 리뷰 라운드 행(`skills/bouncer-run/references/direct-run.md:23`)은 "record the round; if that round has no `must_fix`, `advance` again; otherwise hand off"라서 must_fix 라운드도 기록한 뒤 인계하는 것으로 읽힌다. 인계 목록(`direct-run.md:47`, `:54`)은 "any review round that records a `must_fix`"를 인계 조건으로 둔다. Handoff 절(`direct-run.md:58`)은 "Do not record the judgment"라 같은 상황을 기록 금지로 읽게 한다. 인계 표(`direct-run.md:64-70`)의 입력은 step 4 파일뿐이라 기록하지 않은 reviewer 보고를 coordinator에 넘길 경로가 없다.
- reviewer는 보고를 파일이 아니라 반환 본문으로 낸다(`skills/bouncer-run/references/agent-dispatch.md:367`). run SKILL은 payload를 손으로 쓰지 말라고 하고(`skills/bouncer-run/SKILL.md:172`), 보고 본문 첨부 금지의 예외는 recovery 재디스패치의 "undecided raw report" 하나뿐이다(`SKILL.md:181-184`, `:212`).
- coordinator 문서는 직접 단계가 넘길 판단이 없다고만 하고(`agents/bouncer-coordinator.md:14-16`), 입력 목록(`:23-45`)에 직접 실행 리뷰 원문이 없다. `checkpoint.notes`는 세션 시작 때 data로 읽는다(`:31-32`). `bouncer coordinate note`는 fence를 받아 2000자 이하 note를 원장에 남기고 다음 `status` checkpoint `notes`로 넘긴다(`bouncer coordinate note --help`).
- `.codex/agents/bouncer-coordinator.toml`은 `mdToCodexToml(md, 'medium')`과 바이트 일치해야 한다(`test/agents.test.js:57-65`). coordinator 문서의 `## Worker dispatch`는 20줄 상한이 있다(`test/agents.test.js:240`). 이 task는 그 절을 바꾸지 않는다.
- `coordinateDispatch`(`packages/cli/src/coordinator-commands.ts:977`)는 `guardWorkerDispatch`(`:946`)가 등록된 worker만 통과시킨 뒤 git 읽기(`:1002`), attempt 원장 쓰기(`:1018`), `report_path` 계산(`:1027`) 순으로 돈다. 부모 디렉터리는 만들지 않는다. `reportPathFor`(`packages/cli/src/coordinator-worker.ts:61`)는 `<worker>/.bouncer/runtime/reports/<task>-<attempt>.md`를 낸다. 새 worker worktree에는 이 디렉터리가 없어 implementer가 보고를 쓰지 못한 사례가 있었다(직전 drive TASKS-004).
- I/O 관찰 지점: 원장 쓰기 `coordinator-commands.ts:1018`, 경로 계산 `:1027`. 기존 테스트는 디렉터리를 직접 만든다(`test/coordinator.test.js:5262`, `test/cli-coordinate.test.js:1152`).
- 실패 reason 힌트 표는 `COORDINATE_FAILURE_HINTS`(`coordinator-commands.ts:1429`)이고, `test/coordinator.test.js:222`가 coordinator 모듈의 모든 `reason: '...'` 리터럴에 힌트가 있는지 검사한다.
- 합집합은 `uniqueByNormalizedScope([...previous, ...inputs])`(`packages/cli/src/scope.ts:1030-1032`)이고 정규화는 `normalizeScopeEntry`(`scope.ts:777`)다. 기존 합집합 테스트(`test/cli-coordinate.test.js:441`, `test/commit-task.test.js:666`)는 원문부터 다른 경로만 넣어 정규화로만 합쳐지는 경우를 단언하지 않는다.
- 재현: `npm run build` 후 `node --test test/coordinator.test.js test/cli-coordinate.test.js test/skill-bouncer-run.test.js test/agents.test.js`가 현재 통과한다.

#### Target behavior

- 성공 (문서):
  - root는 리뷰 라운드 카드의 reviewer report에 actionability hint `must_fix`인 finding이 하나도 없을 때만 라운드를 기록하고 `advance`한다. 하나라도 있으면 라운드를 기록하지 않고 인계한다. 이 판정은 controller 집계(severity·advisory 하향, `severity_changes`)보다 앞서며 root는 집계하지 않는다. 인계 목록(`direct-run.md:47`, `:54`)도 "reviewer report에 `must_fix`가 있는 리뷰 라운드는 기록하지 않고 인계"로 같은 조건을 쓴다.
  - Handoff 첫 문단의 "The ledger gains only the `session` decision"은 "`session` decision과, 리뷰 인계일 때 `review-handoff:` note 하나"로, 실패 단계 번호 문장은 새 표 번호(멈춤: `session-open`, note, `status --write-input`, coordinator dispatch / 보고만: 두 `metrics` 단계)로 고친다.
  - 원문 파일: root는 integration cwd의 `.bouncer/runtime/print/`를 만들고(`mkdir -p`), 그 안의 기존 `review-handoff-*.md`를 모두 지운 뒤, reviewer마다 반환 본문을 고치지 않고 `.bouncer/runtime/print/review-handoff-<mode>-<perspective>.md`에 쓰고 각 파일의 sha256을 계산한다. `<mode>`는 `review-dispatch` argv에 `--mode delta`가 있으면 `delta`, 없으면 `discovery`다. `<perspective>`는 그 reviewer에 배정한 `perspectives` 값이다(단일·delta 리뷰는 `combined`). 예: `.bouncer/runtime/print/review-handoff-discovery-spec_scope.md`.
  - note: Handoff 표에 `session-open` 뒤, `metrics start --kind coordinator-session` 뒤, `status --write-input` 앞의 단계를 추가한다. root는 `session-open` 뒤 `bouncer coordinate status`의 `checkpoint.ledger`(`path`, `sha256`)를 fence로 삼아 `bouncer coordinate note --text "review-handoff: mode=<mode>; base=<sha>; head=<sha>; snapshot_id=<id>; perspectives=<p1,p2,…>; files=<path>@<sha256>,…"`를 한 번 실행한다. base·head·snapshot_id는 `review-dispatch` 결과 `target`에서, perspectives는 그 결과의 `perspectives` 순서대로 복사한다. `files=` 경로는 integration cwd 기준 상대 경로이고 `.bouncer/runtime/print/review-handoff-(discovery|delta)-<perspective>.md` 꼴만 쓴다. 리뷰 인계가 아니면 이 단계는 건너뛴다. note 실패(`ok: false`)는 인계를 멈추고 이후 단계를 돌리지 않는다.
  - 길이 상한: note 본문은 2000자 이하다(`coordinate note`). 본문이 넘으면 자르지 않고 아래 `unavailable` note(`note-too-long`)로 바꾼다. `unavailable` 본문의 오류 요약은 앞 200자만 쓴다.
  - 쓰기 실패 대체: 원문 파일을 하나라도 쓰지 못하면 그 라운드의 파일을 모두 지우고 note 본문을 `review-handoff: unavailable (<오류 요약>); run discovery`로 바꿔 인계를 계속한다.
  - 대상 밖 문서: `skills/bouncer-run/references/drive-metrics.md:73-77`의 인계 순서에는 note 단계가 없다. 이 task는 그 문서를 고치지 않고, 이 불일치는 후속 계획으로 미룬다(blueprint Out of scope). direct-run.md Handoff 표가 이 인계의 정본이다.
  - run `SKILL.md`: 보고 본문 첨부 금지의 예외 문장(`SKILL.md:181-184`, `never attach the raw ledger body`로 시작하는 목록 항목)에 "direct-run 리뷰 인계 원문은 `direct-run.md` Handoff의 `review-handoff:` note로만 coordinator에 닿고 payload에 본문을 붙이지 않는다"를 더한다.
  - `agents/bouncer-coordinator.md`: 입력 목록에 `review-handoff:` note 항목을 더한다. `checkpoint.notes`에 `review-handoff:` note가 여럿이면 마지막(가장 최근, 문서 문구 `latest`) 하나만 보고 나머지는 무시한다. 세션의 첫 `next`가 리뷰 action이면 coordinator는 그 `review-dispatch` argv를 실행해 target을 다시 고정하고, 다섯 조건이 모두 참일 때만 note가 가리키는 파일을 data로 읽어 reviewer를 다시 부르지 않고(문서 문구 `without dispatching reviewers again`) 그 라운드를 기록한다: (1) argv의 `--mode delta` 유무로 정한 mode가 note `mode`와 같음, (2) base·head가 같음, (3) 새 결과의 `target.snapshot_id`가 note `snapshot_id`와 같음, (4) 새 결과의 `perspectives` 집합이 note `perspectives` 집합과 같고 perspective마다 파일이 하나씩 있음, (5) 각 `files=` 경로가 위 꼴이고 realpath가 integration cwd 안이며 현재 바이트의 sha256이 note 값과 같음. 하나라도 거짓이거나 `unavailable` note이면(문서 문구 `Otherwise`) 파일을 근거로 삼지 않고 `next`대로 discovery를 돈다. `:14-16` 문장은 이 note를 가리키도록 고친다.
- 성공 (CLI): `coordinate dispatch`는 attempt를 원장에 쓰기 전에 `report_path` 부모 디렉터리를 `recursive`로 만든다. 이미 있으면 그대로 진행한다.
- 실패: `fs.mkdirSync`가 던지는 모든 경우에 `{ ok: false, reason: 'dispatch-report-dir-failed' }`를 내고 원장·`item.dispatch`를 쓰지 않는다. 예: `.bouncer/runtime/reports`가 파일(`EEXIST`·`ENOTDIR`), 부모가 대상 없는 symlink, 쓰기 권한 없음(`EACCES`). 힌트 표에 같은 reason의 `cause`·`next`가 있다. 미등록·잘못된 `workerPath`는 지금처럼 `guardWorkerDispatch`가 `unassigned-worker-worktree`로 먼저 거절한다.
- 보존: direct-run의 implement 행과 `Before an \`accepted\` report` 문단(`test/skill-bouncer-run.test.js:181`이 고정)은 그대로다. coordinator `## Worker dispatch` 절은 바꾸지 않는다. dispatch 성공 응답의 키와 `report_path` 값, metadata 네 키는 그대로다. `reviseTaskScope`의 동작은 바꾸지 않는다.

#### Interface

- 제공:
  - `direct-run.md` 리뷰 라운드 규칙, Handoff의 원문 파일·note 단계·쓰기 실패 대체 규칙.
  - run `SKILL.md` payload 예외 문장, coordinator 입력 목록의 `review-handoff:` note 소비 규칙.
  - `coordinate dispatch` 거절 reason `dispatch-report-dir-failed`와 그 힌트.
- 거부 (즉시 거절): 부모 디렉터리 생성이 던지면 dispatch는 `dispatch-report-dir-failed`로 거절한다. 다른 거절 순서(`unassigned-worker-worktree`, `dispatch-commit-task-required`, `illegal-transition`, `model-invalid`, `dispatch-already-active`, `dispatch-git-read-failed`)는 그대로 앞선다.
- fallback: 원문 파일을 쓸 수 없으면 `unavailable` note로 인계를 계속하고, coordinator는 discovery를 다시 돈다.
- 도메인 용어: "`must_fix`를 담은 reviewer report"는 reviewer Output contract의 finding 중 actionability hint가 `must_fix`인 항목이 하나 이상 있는 반환 본문이다(`agents/bouncer-reviewer.md:233`). severity 필드는 `blocker | major | minor`(`agents/bouncer-reviewer.md:219`)이고 이 판정에 쓰지 않는다. reviewer는 `advisory`를 내지 않으므로 finding이 하나라도 있으면 해당한다. 판정은 controller 집계보다 앞선다. 예: `actionability: must_fix`, `severity: minor`인 finding 하나가 있는 보고.
- 도메인 용어: "`review-handoff:` note"는 `coordinate note`로 남긴 note 중 본문이 `review-handoff: `로 시작하는 것이다. 예: `review-handoff: mode=discovery; base=1a2b…; head=3c4d…; snapshot_id=9f…; perspectives=spec_scope,correctness_tests; files=.bouncer/runtime/print/review-handoff-discovery-spec_scope.md@ab12…,…`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/direct-run.md` | 리뷰 라운드 행, 인계 목록, `## Handoff` 표 | Modify | must_fix 라운드의 기록 여부가 행과 Handoff에서 엇갈리고 원문 전달 규칙이 없음 | 행·목록을 "must_fix 없음만 기록"으로 맞추고 Handoff에 원문 파일·note 단계·대체 규칙 추가 | `direct-run.md:23`, `:47`, `:54`, `:58`, `:64-70`; 소비자 조사: `test/skill-bouncer-run.test.js:181`, `test/skill-bouncer-surface.test.js:161`(파일 목록만), `skills/bouncer-run/references/drive-metrics.md:73-77`(인계 순서 서술, Do not touch로 두고 후속으로 미룸) |
| `skills/bouncer-run/SKILL.md` | step 4 coordinator payload 문단 | Modify | 보고 본문 첨부 예외가 recovery 하나뿐 | direct-run 리뷰 인계는 note로만 닿는다는 문장 추가 | `SKILL.md:172`, `:181-184`, `:212`; 소비자 조사: `test/skill-bouncer-run.test.js:17`, `:43`, `:123`(drive-metrics 링크·`task-notification` 부재) |
| `agents/bouncer-coordinator.md` | 첫 문단, decision inputs 목록 | Modify | 직접 실행 리뷰 원문을 입력으로 모름 | `review-handoff:` note 소비 규칙 추가, `:14-16` 문장 갱신 | `agents/bouncer-coordinator.md:14-16`, `:23-45`; 소비자 조사: `test/agents.test.js:57`, `:240`, `test/skill-bouncer-run.test.js:125`, `test/salvage-report-docs.test.js:13`, `test/cli-help.test.js:362`(다른 문구 고정, 변경 불필요) |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 본문 | Modify | coordinator md의 Codex 생성본 | 새 md에서 `mdToCodexToml`로 재생성 | parity `test/agents.test.js:57-65` |
| `packages/cli/src/coordinator-commands.ts` | `coordinateDispatch`, `COORDINATE_FAILURE_HINTS` | Modify | 원장 기록 뒤 경로만 계산 | `nextAttempt` 계산 직후 부모 디렉터리 생성, 실패 reason과 힌트 추가 | `coordinator-commands.ts:946`, `:977`, `:1002`, `:1018`, `:1027`, `:1429`; 소비자 조사: `coordinate-next.ts:1010`(같은 경로 재계산, 변경 불필요), `rules/cli.md:334`(경로 서술, 변경 불필요) |
| `test/coordinator.test.js` | dispatch 디렉터리 생성·거절 단언 | Modify | 테스트가 디렉터리를 직접 만듦 | 생성 성공과 거절·원장 불변 단언 추가 | `test/coordinator.test.js:5241`, `:222`(힌트 전수 검사가 새 reason을 요구) |
| `test/cli-coordinate.test.js` | revise 정규화 중복 제거 단언 | Modify | 원문이 다른 경로만 합집합 단언 | `./src/auth`·`src/session/` 입력의 결과 단언 추가 | `test/cli-coordinate.test.js:441`, `preparedDrive` `:83`; `scope.ts:1030-1032` |
| `test/skill-bouncer-run.test.js` | direct-run·run SKILL·coordinator 인계 단언 | Modify | implement 행과 accepted 문단만 고정 | 새 규칙 문구를 행·문단 단위로 단언 | `test/skill-bouncer-run.test.js:38`(`paragraphContaining`), `:181` |

#### Constraints

- `packages/cli/src/scope.ts`는 `affected_paths`에 없다. 정규화 회귀 테스트가 red이면 production을 고치지 말고 worker report의 Scope impact에 `packages/cli/src/scope.ts`와 실패 단언을 적어 coordinator 판단으로 넘긴다.
- 디렉터리 생성은 원장 쓰기(`commitWrite`)와 `item.dispatch` 대입보다 앞서야 한다. 거절 시 원장 bytes가 바뀌면 안 된다.
- 기존 단언은 바꾸지 않는다. `test/coordinator.test.js:5262`와 `test/cli-coordinate.test.js:1152`의 `fs.mkdirSync(..., { recursive: true })`는 이미 있는 디렉터리에도 성공하므로 그대로 둔다.
- Checklist 단언이 찾는 영어 문구를 문서에 그대로 쓴다: `actionability hint \`must_fix\``, `without recording`, `verbatim`, note 형식 문자열, `review-handoff: unavailable`, `note-too-long`, note 행 실패 열의 `stop and report`, coordinator 문단의 `latest`·`without dispatching reviewers again`·`Otherwise`.
- 문서 세 곳의 본문은 영어로 쓰고 `task-notification`을 쓰지 않는다(`test/skill-bouncer-run.test.js:123`). coordinator의 `## Worker dispatch` 절과 heading 골격(`npm run lint:docs`)은 바꾸지 않는다.
- TOML은 손으로 고치지 않고 아래 Checklist의 재생성 명령 출력으로만 쓴다.
- `.ts`·`.js` 줄 길이는 120자 이내(`eslint.config.js` `max-len`)다.

### drive-execution/retro-followups-coupled-paths/002 · `d0585fd1`

#### Goal & intent

`bouncer plan inspect --blueprint <dir>`가 commit task의 `affected_paths`에서 결합 경로를 계산해 `coupledPaths`로 낸다. 명시적 생성 관계(`agents/<name>.md` ↔ `.codex/agents/<name>.toml`, `.gitignore` 예외 줄)는 `pairs`로 확정 출력하고, 경로 문자열 검색으로 찾은 테스트 파일은 근거 줄과 함께 `candidates`로만 낸다. inspect는 어떤 파일도 쓰지 않는다. 계획 흐름에서는 planner 초안 뒤 plan coordinator가 이 출력을 계산하고, 덮이지 않은 항목이 있으면 root가 `plan.affected_paths` ACQ로 보여 사용자가 확정한 경로만 더한다.

수용 기준:
1. `agents/bouncer-planner.md`를 가진 task는 `pairs`에 `.codex/agents/bouncer-planner.toml`(`kind: 'codex-agent-toml'`)을 가진다. 같은 task가 그 TOML이나 조상 디렉터리를 가지면 `covered: true`, 아니면 `false`다.
2. 세 조건이 모두 참인 역할만 `.gitignore`(`kind: 'gitignore-exception'`) 짝을 하나 더 가진다: 루트 `.gitignore`에 `!.codex/agents/`로 시작하는 줄이 있음, `!.codex/agents/<name>.toml` 줄이 없음, `<repo>/.codex/agents/<name>.toml`이 없음.
3. `test/` 또는 `tests/` 아래 파일이 task의 파일 항목 문자열을 담으면 그 파일이 `candidates`에 `evidence: { line, text }`와 함께 나온다. 같은 task가 이미 덮는 파일, 디렉터리 항목, `node_modules` 아래 파일은 나오지 않는다.
4. `--blueprint` 없이 실행하면 `coupledPaths: null`이다. `--blueprint` 실행 전후 `git status --porcelain --untracked-files=all` 출력 문자열이 같다.
5. `skills/bouncer-plan/SKILL.md` step 4, `scope-confirm.md`, `agents/bouncer-plan-coordinator.md`가 같은 흐름(초안 뒤 plan coordinator가 inspect 실행 → `ask`·`needs_user` → root가 `plan.affected_paths` 재질문 → 확정 값만 기록)을 서술하고, `.codex/agents/bouncer-plan-coordinator.toml`이 새 md에서 재생성되어 바이트 일치한다.

검증 명령은 frontmatter `verify`의 `node --test test/plan-inspect.test.js test/agents.test.js test/skill-bouncer-surface.test.js`다.

#### Current behavior

- `planInspect`(`packages/cli/src/plan-inspect.ts:602`)는 `--blueprint`가 있으면 `loadRoutingTasks`(`:560`)로 commit task의 `affected_paths`·`depends_on`만 읽어 `summarizeRouting`(`:510`)에 넘기고, 성공 JSON(`InspectOk`, `:106-114`)에는 `routing`까지만 있다. task id는 `loadRoutingTasks`가 버린다(`listTasksDocs` entry의 `tasks.id`, `packages/cli/src/tasks-docs.ts:92`, `:96`). 모듈 export는 `planInspect`, `classifyRoutingPaths`, `summarizeRouting`(`plan-inspect.ts:667`)이다.
- I/O 관찰 지점: 파일 읽기는 `readDoc`(`plan-inspect.ts:568`)와 `fs.statSync`(`:630`)뿐이고 쓰기는 없다. CLI는 결과를 그대로 JSON으로 출력한다(`packages/cli/src/cli-doc-commands.ts:333-339`).
- 생성 관계의 정본은 `codex-agents.ts`의 `NAMED_AGENTS`(`packages/cli/src/codex-agents.ts:15`)와 `CODEX_AGENTS_DIR`(`packages/cli/src/layout.ts:14`, `.codex/agents`), TOML 경로 규칙 `${CODEX_AGENTS_DIR}/${agentName}.toml`(`codex-agents.ts:207`, `:305`)이다. 경로 짝을 돌려주는 export는 없다(`codex-agents.ts:320`).
- 이 저장소의 `.gitignore`는 `.codex/agents/*`를 ignore하고 다섯 역할만 `!.codex/agents/<name>.toml`로 다시 포함한다(`.gitignore:11-18`). `bouncer-debugger`·`bouncer-coordinator` TOML은 예외 줄 없이 추적되고 디스크에 있다(`git ls-files .codex/agents`).
- `test/agents.test.js:57-65`가 일곱 역할 TOML과 md의 바이트 일치를 검사한다. 사용법 문자열은 `packages/cli/src/cli-usage.ts:15`이며 고정하는 테스트는 없다(`rg "pointer state" test` 0건).
- 계획 흐름: `skills/bouncer-plan/SKILL.md:294`는 작성 전에 후보를 만들고, step 4(`:296-298`)는 `affected_paths`를 사용자 확인 뒤에만 쓰며 "never from Graphify query results, candidate lists, or inspect output"이라 하고, 확인 집합 밖 경로는 `needs_user`로 `plan.affected_paths`를 다시 묻는다. `scope-confirm.md:3-13`은 root가 후보를 `<path> — <evidence>` 줄로 보이고 ACQ를 한 번 연다고 한다. `agents/bouncer-plan-coordinator.md:62-65`(step 5)는 planner 디스패치 뒤 바로 리뷰로 간다. 어느 문서도 결합 경로 계산 도구를 가리키지 않는다.
- 문서 고정 테스트: `test/skill-bouncer-surface.test.js:264-281`이 plan SKILL step 4 문장(`a path outside it returns \`needs_user\` and the root asks \`plan.affected_paths\` again`)을 고정한다. `test/plan-release-docs-rule.test.js:31`은 `scope-confirm.md`의 Release-time 포인터만 본다.
- 재현: `npm run build` 후 `node --test test/plan-inspect.test.js test/agents.test.js test/skill-bouncer-surface.test.js`가 현재 통과한다. `plan inspect --blueprint`의 기존 단언은 `test/plan-inspect.test.js:456`, `--blueprint` 없는 단언은 `:497`이다.

#### Target behavior

- 성공 (CLI):
  - `--blueprint`가 있으면 `coupledPaths: { advisory: true, pairs, candidates }`를 낸다. commit task만 보고, task 순서는 `listTasksDocs` 순서, task 안에서는 `affected_paths` 순서, 후보 파일은 경로 사전순이다.
  - 항목 정규화: 앞 `./`를 모두 떼고 끝 `/`를 하나 뗀다. 결과가 빈 문자열·`.`이거나, 절대 경로, `..` 조각을 가진 경로, glob 문자(`*`, `?`, `[`)를 가진 값이면 그 항목은 짝·후보를 만들지 않는다.
  - `pairs`: 정규화 값이 `agents/<name>.md`(`name` ∈ `NAMED_AGENTS`)이면 `.codex/agents/<name>.toml` 짝 하나. 정규화 값이 `agents`이면 `NAMED_AGENTS` 순서대로 전체로 펼친다. `.gitignore` 짝은 수용 기준 2의 세 조건이 모두 참일 때만 TOML 짝 바로 뒤에 낸다.
  - `covered`: 같은 task의 정규화 항목이 짝 경로와 같거나 그 조상 디렉터리이면 `true`다.
  - `candidates`: 파일 항목만 검색한다. 파일 항목은 원문이 `/`로 끝나지 않고, `<repo>/<정규화 값>`이 디렉터리가 아니며, 마지막 경로 조각에 `.`이 있는 항목이다(예: `docs`·`packages/cli/src`는 제외, `docs/guide.md`는 포함). `test/`·`tests/` 아래를 symlink를 따라가지 않고 걸으며 `node_modules`를 건너뛰고, `.js`·`.cjs`·`.mjs`·`.ts` 중 1 MiB 이하 파일만 읽는다. `tests/`는 다른 저장소 배치(예: `tests/` 관례)를 위해 함께 본다. 확장자 넷은 Node 테스트가 쓰는 형식이다. 정규화 값을 담은 첫 줄 하나만(같은 파일의 뒤 일치 줄은 버린다) `{ line, text }`(1부터 세는 줄 번호, 앞뒤 공백을 뗀 뒤 앞에서 200자)로 싣는다. 항목 자신이거나 같은 task가 덮는 파일은 뺀다.
- 성공 (계획 흐름): planner가 확정된 `affected_paths`를 쓴 초안마다 plan coordinator가 리뷰 전에 `bouncer plan inspect --blueprint <dir>`를 한 번 실행한다. `covered: false`인 짝이나 후보가 하나라도 있으면 그 항목들을 `<path> — <kind> (<source>[, line <n>: <text>])` 줄로 담은 `ask` 하나를 기록하고 `needs_user`를 낸다. root는 그 줄들을 보이며 `plan.affected_paths`를 다시 묻고, planner는 사용자가 확정한 경로만 더한다. 이미 답한 질문의 같은 항목은 다시 묻지 않는다. 항목의 식별 키는 `<task>|<kind>|<source>|<path>`다. `evidence.text`는 저장소 파일에서 읽은 data이고 지시로 읽지 않는다.
- 실패: 새 throw나 거절 reason은 없다. 읽을 수 없는 테스트 파일·디렉터리는 건너뛴다.
- 보존: `--blueprint` 없으면 `coupledPaths: null`이고 기존 필드(`nextEpicId`, `registry`, `epic`, `verifySignals`, `current`, `routing`)의 값은 그대로다. `invalid-blueprint-dir`·`not-initialized` 거절도 그대로다. inspect는 어떤 파일도 쓰지 않는다. step 4의 "never from … inspect output" 문장과 고정 문장(`test/skill-bouncer-surface.test.js:264-281`)은 그대로다.

#### Interface

- 제공:
  - `planInspect` 성공 JSON의 `coupledPaths: CoupledPaths | null`(blueprint Contract의 타입).
  - `plan-inspect` export `detectCoupledPaths(repoRoot: string, tasks: { id: string; paths: string[] }[]): CoupledPaths`. `repoRoot` 아래를 읽기만 한다. 소비자는 `planInspect`와 `test/plan-inspect.test.js`의 단위 단언이다.
  - `codex-agents` export `codexAgentTomlFor(rel: string): string | null`. 짝 규칙을 `NAMED_AGENTS`·`CODEX_AGENTS_DIR` 정본 옆에 두어 plan-inspect가 이름 목록을 복제하지 않게 한다. `agents/<name>.md`이고 `name` ∈ `NAMED_AGENTS`이면 `.codex/agents/<name>.toml`, 아니면 `null`. 예: `codexAgentTomlFor('agents/bouncer-reviewer.md') === '.codex/agents/bouncer-reviewer.toml'`, `codexAgentTomlFor('agents/custom.md') === null`.
  - `bouncer plan inspect` 사용법 문자열이 `coupledPaths`를 언급한다.
  - plan SKILL step 4, `scope-confirm.md`, plan coordinator step 5의 결합 경로 확인 규칙.
- 거부 (짝·후보를 만들지 않는 입력): `NAMED_AGENTS`에 없는 `agents/*.md`, 정규화 뒤 빈 문자열·`.`, 절대 경로·`..`·glob 문자를 가진 항목, 디렉터리 항목과 마지막 조각에 `.`이 없는 항목의 문자열 검색, verification task, 빈 `affected_paths`.
- fallback: `.gitignore`가 없거나 `test/`·`tests/`가 없으면 그 짝·후보만 비고 나머지 출력은 그대로다.
- 도메인 용어: "경로 문자열 검색"은 정규식이 아닌 `String.prototype.includes`로 한 줄에서 정확한 부분 문자열을 찾는 것이다. 예: `skills/bouncer-run/references/direct-run.md`는 `test/skill-bouncer-run.test.js:183`의 `read('skills/bouncer-run/references/direct-run.md')` 줄과 일치한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/plan-inspect.ts` | `planInspect`, `loadRoutingTasks`, `InspectOk`, 신규 추출 지점: 결합 경로 계산 | Modify | routing까지만 계산 | task id를 함께 읽고 `coupledPaths` 계산·출력, `detectCoupledPaths` export | `plan-inspect.ts:106-114`, `:560`, `:602`, `:645-664`, `:667` |
| `packages/cli/src/codex-agents.ts` | 신규 추출 지점: md→TOML 경로 짝 | Modify | 이름 목록과 TOML 경로 규칙이 함수 안에 흩어짐 | `codexAgentTomlFor` 추가·export, 기존 함수 동작 불변 | `codex-agents.ts:15`, `:207`, `:305`, `:320` |
| `packages/cli/src/cli-usage.ts` | `COMMAND_USAGE.plan` | Modify | routing까지만 설명 | `coupledPaths` 한 줄 설명 추가 | `cli-usage.ts:15`, export `:78`; 소비자 조사: 고정 테스트 없음, 출력 서술 문서 `rules/cli.md:103`(Do not touch, 후속으로 미룸), `rules/planning.md:56`(routing만 서술, 변경 불필요) |
| `skills/bouncer-plan/SKILL.md` | step 4 Scope confirm | Modify | 결합 경로 확인 단계가 없음 | 초안 뒤 inspect·`needs_user`·재질문 문장 추가 | `SKILL.md:294`, `:296-298`; 소비자 조사: `test/skill-bouncer-surface.test.js:264-281`, `test/validate-gates.test.js:2303`(경로 목록만) |
| `skills/bouncer-plan/references/scope-confirm.md` | 결합 경로 확인 문단 | Modify | 생성 짝 근거를 손으로 찾게 둠 | step 4와 같은 흐름의 문단 추가 | `scope-confirm.md:3-13`; 소비자 조사: `test/plan-release-docs-rule.test.js:31`, `test/skill-bouncer-surface.test.js:93`, `:151`(파일 목록), `packages/cli/src/doc-shape-contracts.ts:185`(링크만) |
| `agents/bouncer-plan-coordinator.md` | Procedure step 5 | Modify | 초안 뒤 바로 리뷰 | 리뷰 전 inspect·`ask`·`needs_user` 단계 추가 | `agents/bouncer-plan-coordinator.md:62-65`; 소비자 조사: `test/agents.test.js:57-65`(parity) |
| `.codex/agents/bouncer-plan-coordinator.toml` | 생성본 본문 | Modify | plan coordinator md의 Codex 생성본 | 새 md에서 `mdToCodexToml`로 재생성 | parity `test/agents.test.js:57-65` |
| `test/plan-inspect.test.js` | `coupledPaths` 단언 | Modify | routing 단언만 있음 | 짝·`covered`·`.gitignore` 짝·후보·제외 규칙·읽기 전용·null·사용법 단언 추가 | `test/plan-inspect.test.js:420`(`writeRoutingBlueprint`), `:456`, `:497` |
| `test/agents.test.js` | `codexAgentTomlFor` 단언 | Modify | TOML 바이트 일치만 검사 | 일곱 역할의 짝이 실제 TOML 경로와 같고 목록 밖 이름은 `null`인지 단언 | `test/agents.test.js:57-65` |
| `test/skill-bouncer-surface.test.js` | 결합 경로 흐름 문서 단언 | Modify | step 4 기존 문장만 고정 | SKILL step 4·`scope-confirm.md`·plan coordinator 문단 단언 추가 | `test/skill-bouncer-surface.test.js:264-281` |

#### Constraints

- inspect는 읽기 전용이다. `fs.writeFileSync`·`mkdirSync`·git 실행을 추가하지 않는다.
- `coupledPaths`는 `routing`·`affected_paths`·gate 판정에 쓰이지 않는다. `summarizeRouting`의 입력·출력은 그대로이고 `test/plan-inspect.test.js:456`의 routing 단언은 바뀌지 않은 채 통과해야 한다.
- 기존 단언 하나만 넓힌다: `test/plan-inspect.test.js:497` 테스트(`plan inspect without --blueprint → keeps prior fields and sets routing null`)에 `assert.strictEqual(payload.coupledPaths, null)`을 더한다. 다른 기존 단언은 바꾸지 않는다.
- `codexAgentTomlFor`는 `NAMED_AGENTS`와 `CODEX_AGENTS_DIR`만 쓴다. 경로 문자열을 따로 하드코딩하지 않는다.
- 문서 세 곳은 영어로 쓴다. plan SKILL step 4의 기존 문장과 `test/skill-bouncer-surface.test.js:264-281`이 고정한 문장, `scope-confirm.md` 첫 줄과 Release-time 포인터는 그대로 둔다. root만 ACQ를 열고 plan coordinator는 `ask`·`needs_user`만 쓴다는 경계를 지킨다.
- Checklist 단언이 찾는 문구를 문서에 그대로 쓴다: plan SKILL step 4의 `plan inspect --blueprint`·`coupledPaths`·`covered: false`·`needs_user`·`plan.affected_paths`, ask 줄 형식 `<path> — <kind> (<source>[, line <n>: <text>])`, 식별 키 `<task>|<kind>|<source>|<path>`, `scope-confirm.md`의 `evidence.text`가 data라는 문장.
- TOML은 손으로 고치지 않고 Checklist의 재생성 명령 출력으로만 쓴다.
- `.ts`·`.js` 줄 길이는 120자 이내다.

### drive-execution/retro-followups-coupled-paths/003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 integration HEAD에서 `npm run ci`가 한 번 통과함을 증명한다. 이 스크립트는 emit·버전 검사, coverage 포함 전체 테스트, unit 계층, eslint, 문서 모양·주석·테스트 이름 lint, typecheck, `npm audit`을 돈다. 이것이 통과해야 epic Success criteria 8의 종단 CI 조건과 18·19의 종단 조건이 참이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/retro-followups-coupled-paths/004 · `b0b170c4`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F1 (major, spec_scope, must_fix) — packages/cli/src/plan-inspect.ts#detectCoupledPaths — Contract interface: CoupledCandidate kind — note: merged spec_scope SS-001 and correctness_tests CT-001: candidates lack kind 'path-literal'
- F2 (major, spec_scope, must_fix) — packages/cli/src/plan-inspect.ts#gitignoreExceptionMissing — tasks/002 Checklist gitignore prefix — note: merged SS-002 and CT-002: condition 1 must be prefix match; fixtures must follow Checklist
- F3 (minor, spec_scope, must_fix) — skills/bouncer-run/references/direct-run.md#Handoff — tasks/001 Target behavior handoff failure steps — note: SS-003: failure-step sentence omits step 6 coordinator dispatch

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `packages/cli/src/plan-inspect.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/plan-inspect.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `skills/bouncer-run/references/direct-run.md` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.