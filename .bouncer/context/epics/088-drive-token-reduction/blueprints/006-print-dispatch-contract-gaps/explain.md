---
type: bouncer.explain
title: print dispatch 계약 빈칸 설명
description: Explains why the context-reviewer print role, the coordinator input file writer, and the config help command were added.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/006-print-dispatch-contract-gaps/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-08T12:44:18.215+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '088'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: f405b301ec79a48e956984bb2438c378f1893281
      range_to: 5aeda5a67d54c12f2d44382b76302593431d9702
      diff_sha: 3d925be33f9cd61376a49fe2d7a3a790969f9132cf95234a07798e675aa00ed3
      recorded_at: '2026-10-08T12:45:03.695+09:00'
  task_commits:
    - task: EPIC-088/BP-006/TASK-001
      sha: 6f4d3cb1
      intent_anchor: task-001
    - task: EPIC-088/BP-006/TASK-002
      sha: 8ae63491
      intent_anchor: task-002
    - task: EPIC-088/BP-006/TASK-003
      sha: 5aeda5a6
      intent_anchor: task-003
---
# Explain

## Background
Cursor에서 `subagents.dispatch: "print"`를 켜면 모든 에이전트가 `agent --print` 프로세스로 뜬다. 그런데 `context-reviewer` role이 없고, coordinator 입력 파일 형식이 문서에 없고, `subagents` 설정 키는 배포물에 들어가지 않는 `docs/`에만 있었다. 그래서 plan·run·init 세션이 `scripts/`를 뒤졌고, plan은 자기 계획을 직접 검토했다. 이 변경은 그 세 곳을 CLI와 지침으로 메워 소스 탐색 없이 끝나게 한다.

## Intuition
세 갈래 모두 "찾아봐야 하는 것"을 "명령 하나가 알려 주는 것"으로 바꾼 일이다. role은 목록에 넣고, 입력 파일은 `status`가 대신 쓰고, 설정 키는 `--help`가 말한다.

## Code
- `scripts/src/lib/print-dispatch.ts`, `cli-dispatch-command.ts` — `context-reviewer` role 추가 (두 `PRINT_ROLES` 목록, usage, 오류 문구)
- `skills/bouncer-plan/references/context-review.md` — fallback 문단 앞의 print 명령 문단, 호출별 `--out`
- `scripts/src/lib/coordinator-input.ts`, `cli-git-commands.ts` — `coordinate status --write-input <file>`
- `scripts/src/lib/cli-config-command.ts`, `subagents.ts` — `bouncer config --help`, `SUBAGENT_PROVIDERS`
- `rules/cursor-print-dispatch.md`, `rules/cli.md`, `docs/configuration.md`, `skills/bouncer-run/SKILL.md`, `skills/bouncer-init/references/init-result.md` — 위 동작을 가리키는 문서

## Quiz
1. context review를 clustered로 돌릴 때 `--out`을 호출마다 다르게 쓰는 이유는?
   - A) 모델 슬러그가 호출마다 달라서
   - B) prompt·jsonl·log 파일 이름이 role마다 하나라 같은 `--out`이면 앞 호출 산출물을 덮어써서
   - C) `agent` CLI가 같은 디렉터리를 두 번 열지 못해서
2. print opt-in에서 plan이 context review를 inline으로 해도 되는 경우는?
   - A) `dispatch print`를 시도했지만 실패했을 때, 그 사실을 `## Findings`에 한 줄 남기고
   - B) named agent가 없다고 판단되면 언제든
   - C) 검토할 문서가 세 개 이하일 때
3. `bouncer coordinate status --write-input out.md`를 `ready` 서브커맨드에 붙이거나 값 없이 쓰면?
   - A) 값이 없으면 기본 경로에 쓰고 `ready`는 `status`처럼 처리한다
   - B) 둘 다 exit 2로 거절하고 파일을 쓰지 않는다
   - C) 경고만 하고 JSON 출력은 그대로 낸다
4. 입력 파일의 base SHA는 어디서 오는가?
   - A) 지금 main 체크아웃의 HEAD
   - B) 현재 pointer의 `base` 브랜치 이름
   - C) bootstrap 때 원장에 기록된 `base`
5. `bouncer config`에 `--help`·`-h` 말고 다른 인자(또는 인자 없음)를 주면?
   - A) exit 2와 usage를 stderr에 쓴다
   - B) 현재 `subagents` 설정 값을 출력한다
   - C) 도움말을 stdout에 쓰고 exit 0으로 끝난다

## Tasks

### EPIC-088/BP-006/TASK-001 · `6f4d3cb1`

#### Goal & intent

print opt-in plan 세션이 `bouncer dispatch print --role context-reviewer`로 독립 검토 프로세스를 띄우고, role 지원 여부를 시험하거나 `scripts/`를 읽지 않게 한다. 수용 기준은 epic Success criteria 23·24와 아래 Checklist의 테스트이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- role 목록이 두 곳에 있다. `scripts/src/lib/print-dispatch.ts:15` `PRINT_ROLES`와 `scripts/src/lib/cli-dispatch-command.ts:6`의 별도 사본이다. CLI 쪽 사본은 인자 검증이 끝난 뒤에만 `print-dispatch`를 lazy require하려고(`cli-dispatch-command.ts:143-145`) 따로 둔다.
- `cli-dispatch-command.ts:13` `USAGE_BLOCK`의 `--role <implementer|reviewer|debugger|coordinator>`, `:23` HELP의 `Roles: implementer, reviewer, debugger, coordinator.`, `:113` 오류 `--role must be implementer, reviewer, debugger, or coordinator`가 네 role만 적는다. `--role context-reviewer`는 `:112`에서 exit 2로 거절된다.
- 식별 줄(`print-dispatch.ts:65-77`)은 coordinator만 따로 두고 나머지는 `You are the dispatched bouncer-${role} itself. Do this role's work directly and never dispatch any Bouncer agent.`를 만든다. 역할 본문은 `agentsDir/bouncer-${role}.md`(`:213-214`), 모델은 `resolveSubagentModel({ agentName: 'bouncer-' + role })`(`:270-273`)라 role 목록만 열면 context-reviewer도 같은 경로를 탄다. 산출 파일 이름은 `bouncer-${role}.prompt.md|.jsonl|.log`(`:276-278`)라 같은 `--out`을 쓰는 호출끼리 덮어쓴다.
- print 경로는 role 문서 frontmatter `readonly: true`를 읽지 않는다. reviewer의 읽기 전용 보호도 식별 줄과 역할 본문 hard guard뿐이다.
- `rules/cursor-print-dispatch.md:21-22` 식별 줄 목록은 `worker or reviewer`와 coordinator만 적는다.
- `skills/bouncer-plan/references/context-review.md` 2단계(`:23-37`)와 5단계(`:51-63`)는 named dispatch만 적고 print 명령이 없다. `:74-83` fallback 문단은 named agent가 없을 때 generic subagent나 inline을 허용하고 print 실패 조건을 적지 않는다.
- I/O: `runPrintDispatch`는 `readConfig`(`:120`), 역할 문서·입력 `readFileSync`(`:217`, `:234`), `spawnSync(agentBin, ['status'])`(`:253`), prompt `writeFileSync`(`:279`), `spawnSync(agentBin, argv)`(`:303`)를 한다. 테스트 seam은 `deps.agentBin`·`deps.agentsDir`이다.
- 재현: `npm run build && node scripts/bouncer dispatch print --role context-reviewer --cwd . --input <file> --out <dir>` → exit 2, `--role must be implementer, reviewer, debugger, or coordinator`.

#### Target behavior

- 성공: `--role context-reviewer`가 인자 검증을 통과하고, cursor·print opt-in이면 `<out>/bouncer-context-reviewer.prompt.md`를 쓴다. 첫 줄은 `You are the dispatched bouncer-context-reviewer itself. Do this role's work directly and never dispatch any Bouncer agent.`이고 빈 줄 뒤에 frontmatter를 뗀 `agents/bouncer-context-reviewer.md` 본문, 그 뒤에 입력이 온다. `subagents.cursor.bouncer-context-reviewer` 슬러그가 있으면 `--model`로 넘긴다.
- 성공: `context-review.md`는 `If named agents are unavailable` fallback 문단 **앞에** print 문단을 둔다. 그 문단은 print opt-in에서 2단계 각 호출과 5단계 delta 호출마다 실행할 명령을 적는다.
  - `--out`은 호출마다 다르다: discovery `combined`는 `.bouncer/runtime/print/context-review/r1-combined`, `local`은 `r1-local-<cluster id>`(예: `r1-local-c1`), `global`은 `r1-global`, delta는 `r2-delta`.
  - `--input`은 그 `--out` 디렉터리 안 `input.md`이고, controller가 dispatch 전에 그 호출의 controller input allowlist만 써 둔다.
  - plan 세션은 `PROJECT_ROOT`에서 명령을 실행하고 `--cwd "$PROJECT_ROOT"`를 준다. 상대 `--out`·`--input`은 `PROJECT_ROOT` 기준이다.
  - 같은 문단이 print opt-in에서는 뒤의 fallback 문단이 `dispatch print` 실패 뒤에만 적용된다고 적는다.
- 실패: print dispatch가 `ok: false`이면 그 호출만 inline으로 검토하고, `context-review.md` `## Findings`에 `- inline context review: dispatch print failed (<reason>)`를 남긴다. dispatch를 시도하지 않은 inline 검토는 print opt-in에서 허용하지 않는다.
- 실패: 목록에 없는 role은 지금처럼 exit 2이고, 메시지가 다섯 role을 적는다.
- 보존: 다른 네 role의 식별 줄·prompt·argv, opt-in이 아닐 때 `print-dispatch-disabled`, fallback 문단의 본문(print opt-in이 아닐 때는 지금처럼 적용), `fork_turns: "none"`과 입력 allowlist 문장.

#### Interface

- 제공
  - `bouncer dispatch print --role <implementer|reviewer|debugger|context-reviewer|coordinator> --cwd <dir> --input <file> --out <dir> [--repo <dir>]`
  - `runPrintDispatch({ role: 'context-reviewer', ... })` → `{ ok: true, role: 'context-reviewer', prompt: '<out>/bouncer-context-reviewer.prompt.md', ... }`
  - context-review reference의 inline 기록 줄: `- inline context review: dispatch print failed (<reason>)`. `<reason>`은 `dispatch print` 결과의 `reason` 값(예: `agent-unavailable`).
- 거부
  - 다섯 role 밖의 `--role`(예: `context_reviewer`, `bouncer-context-reviewer`) → exit 2, stderr `--role must be implementer, reviewer, debugger, context-reviewer, or coordinator`.
  - print opt-in에서 dispatch 시도 없는 inline 검토 → 문서상 금지(코드 검사 없음).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/print-dispatch.ts` | `PRINT_ROLES`, `identityLine` JSDoc | Modify | print role 목록과 prompt 조립 | 목록에 `context-reviewer` 추가, JSDoc role 목록 갱신 | role 판정 지점 |
| `scripts/src/lib/cli-dispatch-command.ts` | `PRINT_ROLES`, `USAGE_BLOCK`, HELP, `parseDispatchPrintArgs` 오류 | Modify | CLI 인자 검증과 usage | 사본 목록·usage·Roles 줄·오류 문구에 `context-reviewer` 추가 | exit 2 거절 지점 |
| `rules/cli.md` | `dispatch print` 사용 예 두 곳 | Modify | CLI 운영 계약 | role 목록에 `context-reviewer` 추가 | 대조 검색에서 옛 role 목록 발견(`:86`, `:145`) |
| `rules/cursor-print-dispatch.md` | 3항 식별 줄 목록 | Modify | print 식별 줄 계약 | `worker, reviewer, or context-reviewer`로 넓힘 | 문서와 코드 식별 줄 일치 |
| `skills/bouncer-plan/references/context-review.md` | 2·5단계, print 문단 | Modify | context review dispatch 절차 | fallback 문단 앞에 print 문단 추가: 호출별 명령·`--out`·`input.md`, fallback 우선순위, 실패 시 inline 기록 줄 | epic Success criteria 24 |
| `test/print-dispatch.test.js` | context-reviewer 테스트, argv 거절 테스트 | Modify | print dispatch 단위 테스트 | 식별 줄·본문·모델 테스트와 잘못된 role 거절 추가 | 수용 기준 |
| `test/cli-help.test.js` | `usage lists dispatch print form` | Modify | usage 문구 고정 | role 정규식에 `context-reviewer` 추가 | `USAGE_BLOCK` 변경의 영향 |
| `test/skill-bouncer-plan.test.js` | print 명령 테스트 | Modify | plan 스킬·reference 문구 고정 | print 명령·`--out`·inline 기록 줄 검사 추가 | 문서 계약 회귀 방지 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `### Added` 항목 추가 | epic Success criteria 6 |

#### Constraints

- CLI 사본 `PRINT_ROLES`는 유지한다. `print-dispatch`를 정적으로 import하면 `:143-145` lazy require가 깨진다. 두 목록은 같은 순서(`implementer, reviewer, debugger, context-reviewer, coordinator`)로 둔다.
- print 문단은 `If named agents are unavailable` 문단 바로 앞의 별도 문단(빈 줄로 분리)으로 두고, 그 문단 안에는 문장을 넣지 않는다. `test/subagents.test.js:452-533`과 `test/skill-bouncer-plan.test.js:231-259`가 그 문단을 빈 줄까지 잘라 검사한다. 2단계·5단계 안의 `fork_turns: "none"` 문장도 지운다거나 단계 밖으로 옮기지 않는다(`test/skill-bouncer-plan.test.js:261+`).
- `test/master-rules.test.js:593-603`이 고정한 `rules/cursor-print-dispatch.md` 문구(`itself. Do this role's work directly and never dispatch any Bouncer agent`, coordinator 식별 줄, `bouncer dispatch print --role`)는 남긴다.
- 플러그인 문서 문장은 영어, CHANGELOG는 기존 항목처럼 한국어로 쓴다.

### EPIC-088/BP-006/TASK-002 · `8ae63491`

#### Goal & intent

`/bouncer-run` 세션이 `bouncer coordinate status --write-input <file>` 한 번으로 coordinator print dispatch 입력 파일을 얻고, 형식을 찾으려고 `scripts/`나 `references/coordinator-cards/`를 읽지 않게 한다. 수용 기준은 epic Success criteria 25와 아래 Checklist의 테스트이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- CLI `cmdCoordinate`(`scripts/src/lib/cli-git-commands.ts:557-740`)는 `coordinate({ command: 'status', repoRoot: f.repo || process.cwd(), cwd: process.cwd(), ... })`(`:713-735`)를 부르고 `compactCoordinateOutput`(`coordinate-output.ts:29-42`)을 거친 JSON 한 줄을 쓴다(`:737`).
- lib status 분기(`coordinator.ts:2289-2301`)는 `{ ok, command, checkpoint }`만 돌려준다. `checkpoint`(`projectCheckpoint`, `coordinator.ts:463-504`)에는 `ledger: { path, sha256, revision }`가 있지만 `integrationPath`, base SHA, autonomy, main worktree는 없다.
- 값의 출처
  - main worktree: `runtimePaths({ repoRoot }).projectRoot`(`runtime-state.ts:464-512`, git common dir의 부모).
  - integration 경로: `coordinatorPathsFor({ repoRoot, blueprint }).integrationPath`(`runtime-state.ts:1035-1056`).
  - base SHA: 원장 `base`(`coordinator.ts:92`). bootstrap이 main HEAD로 정하고(`:2220`, `:2266`) 이후 바꾸지 않는다. `:2220`의 지역 `base`는 현재 main HEAD라 다를 수 있다.
  - autonomy: `readAutonomy(repoRoot)`(`run-preflight.ts:142-152`)가 `readConfig`로 읽고 기본값·잘못된 값을 `DEFAULT_AUTONOMY`로 접는다. export되지 않는다(`:285`는 `runPreflight`만). `.bouncer/config.json`은 gitignore라 main checkout에만 있다.
- status는 등록된 integration worktree와 cwd 일치를 요구한다(`ensureIntegrationCwd`, `coordinator.ts:1458-1464`). 어긋나면 throw → CLI가 `coordinate: <msg>`, exit 1. ledger fence를 요구하지 않는다(`cli-git-commands.ts:574-577`).
- `parseFlags`(`cli-flags.ts:7-27`)는 값 없는 `--write-input`을 `true`로 만든다.
- status 도움말은 `COORDINATE_USAGE_BLOCKS.status.help`(`cli-git-commands.ts:402-407`), 개요는 `:315-318`이다.
- `dispatch print` usage(`cli-dispatch-command.ts:17-22`)는 `--input`이 JSON이 아닌 UTF-8 텍스트이고 역할 본문 뒤에 붙는다고 적지만, `rules/cursor-print-dispatch.md` 3항(`:17-26`)에는 그 문장이 없다.
- `skills/bouncer-run/SKILL.md` 4단계(`:109-140`)는 payload 항목을 손으로 나열하고(`:116-129`) 파일 형식은 적지 않는다.
- I/O: status는 `git rev-parse`, `git worktree list`, 원장 `readFileSync`, `realpathSync`를 한다. 파일 쓰기는 없다. 테스트 seam은 `test/cli-coordinate.test.js`의 `coordinateCli(cwd, command, extra)`(`:132-154`), `preparedDrive()`(`:91`), `planCommittedRepo()`(`:58`)와 `test/print-dispatch.test.js`의 `makeTree`·`writeFakeAgent`·`runPrint`다.

#### Target behavior

- 성공: integration worktree에서 `bouncer coordinate status --blueprint <dir> --write-input <file>`는 기존 status 검사를 모두 통과한 뒤 `<file>`의 부모 디렉터리를 만들고 아래 텍스트를 쓴다. 상대 경로는 cwd 기준이다. stdout JSON은 기존 필드에 `input_file: <절대 경로>`를 더한다.
  ```text
  Coordinator dispatch input
  write cwd: <integrationPath>
  blueprint: <blueprint dir>
  base SHA: <ledger.base>
  checkpoint.ledger.path: <path>
  checkpoint.ledger.sha256: <sha256>
  checkpoint.ledger.revision: <n>
  checkpoint: <checkpoint 한 줄 JSON>
  autonomy: <auto|interactive> (reporting cadence only; open no per-task ACQ)
  read-only provenance: <main worktree> (base SHA provenance only; never a write cwd)
  ```
- 성공: 그 파일을 `dispatch print --role coordinator --input <file>`에 넘기면 prompt 파일이 coordinator 식별 줄, 역할 본문, 파일 내용 그대로의 순서로 생긴다.
- 성공: `SKILL.md` 4단계는 payload를 손으로 쓰지 말고 `coordinate status --write-input .bouncer/runtime/print/coordinator.input.md`로 만든 파일을 넘기라고 적는다. Task·named dispatch에서도 같은 파일 내용을 payload로 쓴다.
- 실패: `--write-input` 값이 없으면 exit 2와 usage, 파일을 쓰지 않는다. status가 `ok: false`이거나 throw하면 파일을 쓰지 않는다.
- 보존: `--write-input` 없는 status의 stdout·종료 코드, lib `coordinate()` 반환값, 원장 bytes, 다른 서브커맨드.

#### Interface

- 제공
  - `bouncer coordinate status --blueprint <dir> [--repo <dir>] [--write-input <file>]`
  - `buildCoordinatorInput(fields: { integrationPath: string, blueprint: string, base: string, checkpoint: Checkpoint, autonomy: string, projectRoot: string }) → string` — 위 텍스트를 만드는 순수 함수(신규 추출 지점: coordinator 입력 텍스트 조립).
  - `readAutonomy` export(`run-preflight.ts`).
- 거부(즉시 exit 2, 파일 없음): 값 없는 `--write-input`(`true`), `--write-input`을 `status` 외 서브커맨드에 줌. `status`의 별칭인 `ready`도 거절한다.
- 실패(exit 1, 파일 없음): integration worktree 미등록, cwd 불일치, 원장 없음, 파일 쓰기 오류(`coordinate: <msg>`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-input.ts` | `buildCoordinatorInput` | Create | — | 입력 텍스트 조립 | 순수 함수로 테스트 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, `COORDINATE_USAGE_BLOCKS.status` | Modify | status 실행·출력·도움말 | 성공 뒤 값 수집·파일 쓰기·`input_file`, 플래그 검증, 도움말 줄 | 파일 쓰기를 CLI 계층에 둠 |
| `scripts/src/lib/run-preflight.ts` | `readAutonomy` | Modify | preflight autonomy 해석 | export 추가 | 같은 기본값 규칙 재사용 |
| `rules/cli.md` | coordinator 명령 블록 | Modify | CLI 운영 계약 | `bouncer coordinate status --blueprint <dir> --write-input <file>` 줄 추가 | 명령 목록이 새 플래그를 보여 줌 |
| `rules/cursor-print-dispatch.md` | 3항 | Modify | print payload 계약 | `--input`은 자유 텍스트이고 그대로 붙는다는 문장, coordinator 입력은 `coordinate status --write-input`이 쓴다는 문장 | epic Success criteria 25 |
| `skills/bouncer-run/SKILL.md` | 4단계 | Modify | coordinator payload 나열 | 명령과 권장 경로로 교체, 테스트가 고정한 문구 유지 | epic Success criteria 25 |
| `test/cli-coordinate.test.js` | status `--write-input` 테스트 | Modify | coordinate CLI 테스트 | 파일 내용·`input_file`·거절·exit 1 무파일·기존 출력 보존·생성 파일의 `dispatch print` 연결 | 수용 기준 |
| `test/print-dispatch.test.js` | 생성 입력 prompt 테스트 | Modify | print dispatch 테스트 | `buildCoordinatorInput` 출력으로 coordinator prompt 생성 확인 | 수용 기준 |
| `test/cli-help.test.js` | coordinate status help | Modify | 도움말 고정 | `--write-input` 포함 단언 | 도움말 변경 |
| `test/skill-bouncer-run.test.js` | 4단계 테스트 | Modify | run 스킬 문구 고정 | `coordinate status --write-input` 단언 추가 | 문서 계약 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `### Added` 항목 추가 | epic Success criteria 6 |

#### Constraints

- `test/skill-bouncer-run.test.js`가 4단계에서 찾는 문구는 남긴다: `write cwd`, `read-only provenance`, main worktree를 write cwd로 넘기지 말라는 문장(`:60-67`), `reporting cadence`와 `` `interactive` returns a progress line ``(`:115-118`), `coordinate status`·`checkpoint.ledger.(path|sha256)`와 원장 본문·완료 문서·이전 보고·과거 대화를 넘기지 말라는 문장(`:134-143`), `continue` 뒤 `coordinate status`(`:34`), print dispatch 문장(`:206`).
- `test/subagents.test.js:503-513`가 요구하는 `skills/bouncer-run/SKILL.md` step 4 지시는 유효해야 한다.
- `test/master-rules.test.js:593-600`이 고정한 3항 문구(`always carries the item 4 fallback payload`, 식별 줄)는 남긴다.
- base SHA는 원장 `base`이고, autonomy는 main worktree 설정에서 `readAutonomy`로 읽는다.
- `continue` 재dispatch도 `coordinate status --write-input`을 다시 실행해 새 checkpoint로 파일을 덮어쓴다.

### EPIC-088/BP-006/TASK-003 · `5aeda5a6`

#### Goal & intent

플러그인 배포물만 있는 환경에서 `bouncer config --help`로 `subagents` 키 이름·허용값·기본값을 얻게 해, init 세션이 `scripts/`를 읽지 않게 한다. CLI 출력이 원본이고 `docs/configuration.md` 표는 테스트로 맞춘다. 수용 기준은 epic Success criteria 26과 아래 Checklist의 테스트이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- 명령 레지스트리 `COMMANDS`(`scripts/src/lib/cli.ts:30-65`)에 `config`가 없다. 최상위 도움말은 `HEADER + Object.values(COMMANDS).map(c => c.usage).join('') + FOOTER`(`:76-79`)이고, 모르는 명령은 stderr와 exit 2(`:95-99`)다. 재현: `npm run build && node scripts/bouncer config --help` → exit 2.
- 서브커맨드 도움말 패턴은 `cli-dispatch-command.ts`의 `argvRequestsHelp`(`:35-45`)와 HELP 출력 후 exit 0(`:132-137`), `{ run, usage }` export(`:157-160`)다.
- 에이전트 목록은 `NAMED_AGENTS`(`codex-agents.ts:9-15`, export `:194`) 다섯이다. provider 목록 상수는 없다. 이름은 `init.ts:124-153` 기본 블록 리터럴, `print-dispatch.ts:122`의 `'cursor'`, `subagents.ts:10-23` 주석에만 있다. `plugin-root.ts:18` `HOSTS`는 cursor가 없는 호스트 목록이라 쓰지 않는다.
- 기본값 동작: provider는 설정 pin → `CLAUDE_PLUGIN_ROOT`면 claude → `PLUGIN_ROOT`면 codex → 없음(`subagents.ts:24-36`). dispatch는 `provider === 'cursor' && dispatch === 'print'`일 때만 켜진다(`print-dispatch.ts:119-123`). 에이전트 슬롯은 `inherit`, 빈 값, 문자열 아닌 값이 모두 부모 모델 상속이다(`subagents.ts:79-84`). 값 검증 게이트는 없다.
- `docs/configuration.md:23-25` 표 행과 `:27-28` 에이전트 목록은 위 값과 맞는다. `docs/`는 `package.json` `files`(`:6-23`)와 `Dockerfile.cursor` COPY 목록에 없다.
- `skills/bouncer-init/references/init-result.md`는 설정 키를 언급하지 않는다. `test/skill-bouncer-init.test.js:8-24`가 이 문서의 Graphify·gitignore 문구를 정규식으로 고정한다.
- 순수 문자열 생성이라 프로세스 spawn·파일 I/O가 없다. `test/cli-help.test.js`의 `capture`·`runCli` 패턴(`:375-388`)으로 시험한다.

#### Target behavior

- 성공: `bouncer config --help`와 `bouncer config -h`는 exit 0, stderr 없이 아래 형태를 stdout에 쓴다. provider·agent 이름은 상수에서 채운다.
  ```text
  usage: bouncer config --help

  Keys under "subagents" in .bouncer/config.json (read-only help; this command writes nothing):
    subagents.provider            claude | cursor | codex | antigravity
                                  default: unset — CLAUDE_PLUGIN_ROOT selects claude, PLUGIN_ROOT selects codex; cursor and antigravity must be set
    subagents.dispatch            print | absent
                                  default: absent (host Task subagents); read only when provider is cursor
    subagents.<provider>.<agent>  inherit | <host model slug>
                                  default: inherit (parent session model; missing, empty, or non-string also inherit)
    <agent>: bouncer-reviewer, bouncer-implementer, bouncer-debugger, bouncer-context-reviewer, bouncer-coordinator
  ```
- 성공: 최상위 `bouncer --help`에 `config` 블록이 나온다.
- 성공: 테스트가 `docs/configuration.md`의 `subagents.*` 행과 에이전트 목록에서 키·provider·dispatch 값·에이전트 집합을 뽑아 CLI 출력과 같은지 확인한다.
- 성공: `init-result.md`가 `subagents` 키를 바꿀 때 `bouncer config --help`를 보라고 적는다.
- 실패: `bouncer config`(인자 없음)나 `--help`·`-h` 외 인자는 exit 2이고 stderr에 usage를 쓴다.
- 보존: `bouncer init` 출력과 기본 config 형태, 모델 해석, print opt-in 판정, 기존 명령 도움말.

#### Interface

- 제공
  - `bouncer config --help` / `bouncer config -h` → exit 0, 위 텍스트.
  - `SUBAGENT_PROVIDERS = ['claude', 'cursor', 'codex', 'antigravity'] as const` (`subagents.ts` export).
  - `SUBAGENT_DISPATCH_VALUES = ['print'] as const` (`subagents.ts` export).
- 거부(exit 2, stderr usage): 인자 없음, `--help`·`-h` 외 토큰(예: `config set`, `config --provider cursor`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-config-command.ts` | `run`, `usage`, HELP | Create | — | `config --help` 처리와 텍스트 조립 | dispatch 명령 모듈 패턴 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 명령 레지스트리·최상위 도움말 | `config` 키 등록 | 명령 진입점 |
| `scripts/src/lib/subagents.ts` | `SUBAGENT_PROVIDERS`, `SUBAGENT_DISPATCH_VALUES` | Modify | provider 판별·모델 해석 | 상수 추가·export | 도움말 값의 원본 |
| `rules/cli.md` | Read-only discovery 블록 | Modify | CLI 운영 계약 | `bouncer config --help` 줄 추가 | 배포물 안 명령 목록 |
| `docs/configuration.md` | `subagents` 절 | Modify | 사용자 설정 문서 | `bouncer config --help`가 원본이라는 한 줄 | 원본 명시 |
| `skills/bouncer-init/references/init-result.md` | 설정 안내 | Modify | init 결과 렌더링 | `bouncer config --help` 안내 한 문장 | epic Success criteria 26 |
| `test/cli-help.test.js` | `SUBCOMMANDS`, config help 테스트 | Modify | CLI 도움말 고정 | `'config'` 추가, `--help`·`-h`·거절 테스트 | 수용 기준 |
| `test/config-help.test.js` | 문서 일치 테스트 | Create | — | docs 표와 CLI 출력 집합 비교 | 원본 일치 |
| `test/skill-bouncer-init.test.js` | init-result 테스트 | Modify | init 문서 문구 고정 | `bouncer config --help` 단언 | 안내 회귀 방지 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `### Added` 항목 추가 | epic Success criteria 6 |

#### Constraints

- 도움말은 상수에서 조립하고 provider·agent 이름을 문자열로 다시 적지 않는다.
- `config`는 읽기 전용이다. 파일을 읽거나 쓰지 않는다.
- `init-result.md`의 기존 문구(`graphifyPromotion`, `--promote-graphify`, `--write-gitignore`, `write nothing|untouched`, `failure, Graphify remains disabled`)는 남긴다.
- `docs/configuration.md`는 한국어 문서이고 표 행 형식(``| `subagents.provider` | ...``)을 유지해 일치 테스트가 같은 행을 읽게 한다.
