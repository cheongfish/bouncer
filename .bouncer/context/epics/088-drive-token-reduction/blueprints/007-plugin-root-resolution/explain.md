---
type: bouncer.explain
title: 007 explain
description: Explain for 007
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/007-plugin-root-resolution/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-08T16:29:19.292+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '088'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: 924a742c6bdef3c0d72be94d815ac9aac6eb655e
      range_to: 67f4a5e97bc5e232c5804229ddd93cf3c53cfd86
      diff_sha: 76087c93c1382b62314d780fa7318276a576434dcba8798e28c8df8d1a503ec3
      recorded_at: '2026-10-08T16:30:49+09:00'
  task_commits:
    - task: EPIC-088/BP-007/TASK-001
      sha: de0af45d
      intent_anchor: task-001
    - task: EPIC-088/BP-007/TASK-002
      sha: ab5a2321
      intent_anchor: task-002
    - task: EPIC-088/BP-007/TASK-003
      sha: 4850b34d
      intent_anchor: task-003
    - task: EPIC-088/BP-007/TASK-004
      sha: eb15ecc8
      intent_anchor: task-004
    - task: EPIC-088/BP-007/TASK-005
      sha: 67f4a5e9
      intent_anchor: task-005
---
# Explain

## Background

워크플로·print worker가 `rules/acq.md`나 `references/context-review/index.md` 같은 플러그인 상대 경로를 열 때 루트를 몰라 워크스페이스를 glob·`ls`로 뒤졌다. 이 변경은 print prompt와 여섯 스킬 첫 줄이 플러그인 루트를 알려 주고, 문서 인용을 `${BOUNCER_ROOT}/…`로 맞추며, 벤치마크 하네스가 ACQ·quiz 밖 선택지 질문을 조용히 넘기지 않고 멈춘다.

## Intuition

주소를 받기 전에 지도를 찾아 헤매지 말고, 출발지에 우편번호를 적어 둔다.

## Code

- `scripts/src/lib/print-dispatch.ts` — 식별 줄 다음에 `Plugin root: <절대 경로>. Resolve plugin-relative paths…` 한 줄을 넣는다. 루트는 `agentsDir`의 부모다.
- 여섯 `skills/bouncer-*/SKILL.md` — 세션 시작에 `BOUNCER_ROOT="$(bouncer-root --auto)"`를 한 번 돌리고 `${BOUNCER_ROOT}/rules/plugin-root.md`를 연다.
- `rules/skill-shape.md`, `test/plugin-doc-cites.test.js` — `skills/**`·`rules/*.md`·`references/**`의 플러그인 문서 인용은 `${BOUNCER_ROOT}/…` 표기다. 스킬 로컬 `./references/…`와 Markdown 링크 href는 그대로다.
- `benchmarks/acp/responder.cjs`, `benchmarks/run-print-stage.cjs` — `unhandledQuestionMethod`가 `text/unread-question` 또는 `text/unrecognized-question`을 고르면 하네스가 `unanswered`에 남기고 단계를 멈춘다.

## Quiz

1. `bouncer dispatch print`가 쓰는 prompt에서 플러그인 루트 줄은 어디에 들어가나?
   - A) 역할 본문 맨 끝, 입력 앞
   - B) 식별 줄 바로 다음(빈 줄로 구분)
   - C) `--input` 파일 안 첫 줄

2. 여섯 워크플로 스킬이 세션 시작에 플러그인 루트를 잡는 방법은?
   - A) cwd에서 `rules/plugin-root.md`를 glob으로 찾는다
   - B) `PLUGIN_ROOT` 환경 변수만 읽는다
   - C) `BOUNCER_ROOT="$(bouncer-root --auto)"`를 한 번 실행한다

3. 플러그인 문서 인용 표기에 대한 설명으로 맞는 것은?
   - A) `skills/**`·`rules/*.md`·`references/**`의 `rules/…`·`references/…`·`agents/…`·`AGENTS.md`는 `${BOUNCER_ROOT}/…`로 쓴다
   - B) Markdown 링크 href(`../../rules/…`)도 모두 `${BOUNCER_ROOT}/…`로 바꾼다
   - C) 스킬 로컬 `./references/…`도 `${BOUNCER_ROOT}/references/…`로 통일한다

4. print-stage 하네스가 ACQ·quiz가 아닌 턴에서 선택지≥2인 질문을 보면?
   - A) 조용히 break하고 `unanswered`를 남기지 않는다
   - B) `unhandledQuestionMethod`가 고른 method를 `unanswered`에 남기고 멈춘다
   - C) 항상 `text/AskUserQuestion`으로 자동 응답한다

## Tasks

### EPIC-088/BP-007/TASK-001 · `de0af45d`

#### Goal & intent

`bouncer dispatch print`로 띄운 모든 역할(implementer, reviewer, debugger, context-reviewer, coordinator)이 prompt에서 플러그인 루트 절대 경로를 받아, `references/context-review/index.md`·`references/implementation/index.md` 같은 상대 경로를 탐색 없이 연다. 수용 기준은 epic Success criteria 27이고, 검증 명령은 `npm test`다.

#### Current behavior

- `assemblePrintPrompt`(`scripts/src/lib/print-dispatch.ts:89-101`)는 `{role, roleMarkdown, input}`만 받아 `${identityLine(role)}\n\n${roleBody}\n\n${input}`을 돌려준다. 루트 정보는 없다.
- `runPrintDispatch`는 `agentsDir = deps.agentsDir ?? pluginAgentsDir()`(`:213`)로 `bouncer-<role>.md`를 읽고(`:214-217`) `assemblePrintPrompt`를 부른다(`:231-235`). `pluginAgentsDir()`는 `path.join(__dirname,'..','..','agents')`다(`scripts/src/lib/codex-agents.ts:32-34`). CLI `cmdDispatch`(`scripts/src/lib/cli-dispatch-command.ts:145-152`)는 `deps`를 넘기지 않는다.
- `rules/cursor-print-dispatch.md:17-27` 3항은 prompt 첫 줄이 식별 줄이고, 그 뒤에 명령이 역할 본문과 controller 입력을 붙인다고 적는다. 루트 줄은 없다.
- v088006 측정에서 print context-reviewer는 `agents/bouncer-context-reviewer.md:13`의 `references/context-review/index.md`를 찾으려고 세션당 9~22건, implementer는 `references/implementation/index.md`를 찾으려고 두 run 합계 9건 플러그인을 뒤졌다.
- 재현: `node --test test/print-dispatch.test.js`가 통과한다. 테스트는 `makeTree()`(`test/print-dispatch.test.js:19-47`)로 임시 `root/agents`와 가짜 `agent`를 만들고 `deps: {agentBin, agentsDir}`를 넘긴다(`:95-109`).
- I/O 결합: 역할 문서·입력 `fs.readFileSync`(`print-dispatch.ts:217`, `:234`), prompt `fs.writeFileSync`(`:279`), `spawnSync(agentBin, …)`(`:253`, `:303`). `assemblePrintPrompt` 자체는 순수 함수다.

#### Target behavior

- 성공: prompt 파일은 `식별 줄\n\nPlugin root: <root>. Resolve plugin-relative paths (rules/..., references/..., agents/...) against it.\n\n역할 본문\n\n입력`이다. `<root>`는 `path.dirname(agentsDir)`의 절대 경로다. 프로덕션에서는 플러그인 설치 루트이고, 테스트 seam에서는 임시 root다. 다섯 역할 모두 같은 줄을 받는다.
- 보존: 식별 줄 바이트, 역할 본문, 입력이 끝에 그대로 붙는 성질, 실패 경로(`dispatch-input-invalid`, `print-dispatch-disabled`, `role-document-invalid`, `agent-unavailable` 등)와 그때 prompt를 쓰지 않는 동작, `argv` 형태.
- 실패: 새 실패 경로는 없다.

#### Interface

- 제공: `assemblePrintPrompt({ role, roleMarkdown, input, pluginRoot })`. `pluginRoot: string`은 루트 절대 경로다. `runPrintDispatch`는 `path.resolve(path.dirname(agentsDir))`를 넘긴다.
- 제공: `rules/cursor-print-dispatch.md` 3항이 식별 줄 다음 루트 줄과 그 문구를 적는다.
- 거부: 새 입력은 없다. 기존 `--role`·`--input`·`--cwd` 거절은 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/print-dispatch.ts` | `assemblePrintPrompt`, `runPrintDispatch` | Modify | prompt 조립·실행 | `pluginRoot` 인자와 루트 줄 추가, `agentsDir` 부모 전달 | prompt를 만드는 유일한 지점 |
| `scripts/lib/print-dispatch.js` | `assemblePrintPrompt` | Modify | 배포되는 emit 산출물 | `npm run build` 재생성 | `check:emit`이 소스와 일치를 확인 |
| `rules/cursor-print-dispatch.md` | 3항 Payload | Modify | prompt 구성 설명 | 루트 줄 위치·문구 추가 | 세션이 읽는 print 계약 |
| `test/print-dispatch.test.js` | happy path, coordinator, context-reviewer 테스트 | Modify | `${IDENTITY}\n\n# ` 접두 단언(`:128`, `:180`, `:370`) | 루트 줄을 포함한 접두로 갱신, 루트 줄 단언 추가 | 줄 삽입으로 깨지는 단언 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `Changed` 항목 추가 | epic Success criteria 6 |

#### Constraints

- 식별 줄은 `rules/cursor-print-dispatch.md` 3항과 바이트가 같아야 한다. 루트 줄은 식별 줄 뒤에 둔다. payload가 `---`로 시작해도 첫 줄이 옵션으로 읽히지 않아야 하기 때문이다.
- 루트 줄 문구는 코드와 규칙 문서에서 바이트가 같다. 규칙 문서 3항은 경로 자리에 `<absolute path>`를 넣은 루트 줄을 줄바꿈 없이 한 코드 span으로 싣고, 테스트가 `ROOT_LINE('<absolute path>')` 문자열이 규칙 원문에 그대로 있는지 본다.
- 셸을 만들지 않는다. prompt는 계속 `argv` 칸으로만 넘긴다.
- 새 함수·바뀐 함수의 한국어 docstring 계약(Summary, Args, Returns)을 지킨다.

### EPIC-088/BP-007/TASK-002 · `ab5a2321`

#### Goal & intent

워크플로 스킬 세션이 첫 줄에서 플러그인 루트를 얻어, 그 뒤 `${BOUNCER_ROOT}/AGENTS.md`와 `${BOUNCER_ROOT}/rules/plugin-root.md`를 탐색 없이 연다. 수용 기준은 epic Success criteria 28이고, 검증 명령은 `npm test`다.

#### Current behavior

- 여섯 `skills/bouncer-{init,plan,execute,commit,run,finalize}/SKILL.md` 7행은 모두 `**Plugin root.** See \`rules/plugin-root.md\` for the shared root-selection and rule-loading contract.`이다. 바로 아래 `**Master rules.**` 줄은 `${BOUNCER_ROOT}/AGENTS.md`를 읽으라고 한다.
- 루트를 얻는 명령 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`는 `rules/plugin-root.md:9-11` fenced 블록에만 있다. 세션은 루트를 모르는 채 그 규칙 파일을 찾아야 해서, v088006 plan·finalize 세션은 `**/AGENTS.md`, `**/plugin-root.md`, `**/acq.md` glob을 썼다.
- `rules/plugin-root.md:34-43`은 `## Master and product rules`의 마지막 문단(한 블록)이다. 그중 `:40-42` 문장 "The workflow skill keeps its `Plugin root` and `Master rules` labels so this loading point is visible, but does not restate this contract."가 스킬이 계약을 다시 쓰지 않는다고 적는다.
- 벤치마크 이미지는 `BOUNCER_HOME`을 설정하고 빌드 때 `bouncer-root --auto`를 확인한다(`benchmarks/docker/Dockerfile.cursor:32,51`). `bouncer` 런처도 같은 명령으로 루트를 고른다(`scripts/bouncer:16-44`).
- 고정 테스트: `test/master-rules.test.js:706-707`은 여섯 SKILL.md에 `rules/plugin-root.md`와 `AGENTS.md`가 있는지 본다(앵커 없는 정규식). `test/rule-ownership.test.js:171-186` `skillStartupBlocks`는 `**Plugin root.**` 문단을 다음 bold 헤더나 빈 줄에서 잘라 startup preload로 본다. `test/public-name-regression.test.js:11-14`는 `rules/plugin-root.md`의 `bouncer-root --auto` 블록을 고정한다.
- 재현: `node --test test/master-rules.test.js test/rule-ownership.test.js test/skill-bouncer-surface.test.js`가 통과한다.

#### Target behavior

- 성공: 여섯 SKILL.md의 `**Plugin root.**` 문단은 한 문단으로 다음 내용을 담는다.
  ```markdown
  **Plugin root.** Run `BOUNCER_ROOT="$(bouncer-root --auto)"` once at session start and open every plugin document cited as `${BOUNCER_ROOT}/…` from that root; `${BOUNCER_ROOT}/rules/plugin-root.md` holds the shared root-selection and rule-loading contract.
  ```
  여섯 파일의 문단 바이트가 같다.
- 성공: `rules/plugin-root.md:40-42` 문장 하나만 다음으로 바꾼다. 같은 문단의 나머지(preload 계약, `AGENTS.md`·`rules/document-schema.md` 인용)는 이 task에서 바꾸지 않는다.
  ```markdown
  The workflow skill keeps its `Plugin root` and `Master rules` labels so this loading point is visible; its `Plugin root` line carries only the `bouncer-root --auto` command and does not restate the selection rules above.
  ```
- 보존: `**Master rules.**` 줄, startup preload가 product rule을 인용하지 않는 성질, `rules/plugin-root.md`의 shell 블록과 `--auto` 설명.
- 실패: 새 실패 경로는 없다. `bouncer-root --auto` 실패 시 동작은 `rules/plugin-root.md`가 이미 정한 대로다.

#### Interface

- 제공: SKILL.md `**Plugin root.**` 문단의 위 문구(여섯 파일 공통).
- 제공: `test/skill-bouncer-surface.test.js`의 새 테스트가 여섯 문단이 바이트까지 같고 `BOUNCER_ROOT="$(bouncer-root --auto)"`와 `${BOUNCER_ROOT}/rules/plugin-root.md`를 담는지, `rules/plugin-root.md`가 위 문장을 담는지 판정한다.
- 거부: 새 CLI 명령이나 플래그를 만들지 않는다. 문단 안에 fenced 코드 블록을 두지 않는다. 빈 줄이 생기면 startup 문단 판정이 잘린다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-init/SKILL.md` | `**Plugin root.**` | Modify | 루트 규칙 파일만 가리킴 | 루트 명령과 루트 기준 인용으로 교체 | 세션 첫 줄 |
| `skills/bouncer-plan/SKILL.md` | `**Plugin root.**` | Modify | 같음 | 같음 | 같음 |
| `skills/bouncer-execute/SKILL.md` | `**Plugin root.**` | Modify | 같음 | 같음 | 같음 |
| `skills/bouncer-commit/SKILL.md` | `**Plugin root.**` | Modify | 같음 | 같음 | 같음 |
| `skills/bouncer-run/SKILL.md` | `**Plugin root.**` | Modify | 같음 | 같음 | 같음 |
| `skills/bouncer-finalize/SKILL.md` | `**Plugin root.**` | Modify | 같음 | 같음 | 같음 |
| `rules/plugin-root.md` | `## Master and product rules` `:40-42` 문장 | Modify | 스킬이 계약을 다시 쓰지 않는다고 적음 | 스킬 줄이 루트 명령만 싣는다고 고침 | 문서와 스킬 문구 정합 |
| `test/skill-bouncer-surface.test.js` | 신규 추출 지점: Plugin root 문단 판정 | Modify | 스킬 표면 판정 | 여섯 문단 동일성·명령·인용 단언 추가 | Success criteria 28 판정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `Changed` 항목 추가 | epic Success criteria 6 |

#### Constraints

- 이 task는 `**Plugin root.**` 문단만 바꾼다. SKILL.md 본문의 다른 인용은 TASKS-003이 바꾼다.
- `test/master-rules.test.js:706`의 `rules/plugin-root.md` 인용 요구를 계속 만족한다.
- 문단은 product rule(`rules/acq.md`, `rules/output.md` 등)을 인용하지 않는다(`test/rule-ownership.test.js`).

### EPIC-088/BP-007/TASK-003 · `4850b34d`

#### Goal & intent

스킬·규칙·reference 문서가 플러그인 문서를 `${BOUNCER_ROOT}/…`로 인용해, 세션이 `rules/acq.md`, `rules/output.md`, `references/spec-authoring/index.md` 같은 경로를 루트 기준으로 바로 연다. 수용 기준은 epic Success criteria 29이고, 검증 명령은 `npm test`다.

#### Current behavior

- `rules/skill-shape.md:18-31` 표기 표는 SKILL.md 안의 `references/…`만 `${BOUNCER_ROOT}/references/…` 또는 `./references/…`로 쓰게 한다. `rules/`, `agents/`, `AGENTS.md` 인용과 `skills/*/references/`, `rules/`, `references/**` 문서는 규칙 밖이다.
- 접두 없는 인용 수(근사): SKILL.md 약 46, `skills/*/references/*.md` 약 25, `rules/*.md` 약 25, `references/**` 약 40. 예: `Use \`rules/acq.md\` for the shared ACQ display`(여섯 SKILL.md 끝), `**Plugin-root shell contract.** See \`rules/plugin-root.md\``(`references/graphify-runner/index.md:8`, `references/review/index.md:8`, `references/explain-diff/index.md:8` 등).
- v088006 plan·finalize 세션은 이 인용을 열려고 `**/acq.md`(4회), `**/output.md`, `explain-diff/**`, `discovery`, `spec-authoring` glob을 썼다.
- 바꾸지 않을 곳:
  - `rules/cursor-print-dispatch.md` coordinator 식별 줄 안의 `rules/cursor-print-dispatch.md`: `scripts/src/lib/print-dispatch.ts:70`과 `test/print-dispatch.test.js:14`가 바이트를 고정한다.
  - `references/discovery/index.md:25`의 `AGENTS.md`·`CLAUDE.md`: 소비 프로젝트 파일을 뜻한다.
  - `rules/output.md:19`: 출력 예시의 변경 파일 목록이다.
  - Markdown 링크 href(`](../../rules/subagent-model.md)`, `](../../../rules/…)`): `skills/bouncer-execute/SKILL.md:121,178`, `skills/bouncer-execute/references/agent-dispatch.md:2`, `verification-recovery.md:2`, `skills/bouncer-plan/references/context-review.md:4`, `references/review/index.md:9`.
- 현재 표기 판정은 `test/skill-bouncer-surface.test.js:277-340` `bareReferenceCites`가 SKILL.md의 `references/`만 본다.
- 문구 고정 테스트(인용 바로 앞 백틱을 포함해 깨지는 것): `test/subagents.test.js:519,525,538`(FALLBACK_SITES `:455-506`), `test/skill-bouncer-plan.test.js:245,247`, `test/skill-debugging.test.js:52,54`, `test/master-rules.test.js:587,805`, `test/skill-bouncer-run.test.js:206`, 그리고 백틱 인용을 단언하는 `test/skill-bouncer-commit.test.js`, `test/skill-bouncer-execute.test.js`, `test/trust-boundary.test.js`, `test/distill-decommission-audit.test.js`.
- 재현: 아래 명령이 대상 문서 35개를 나열한다.
  ```bash
  rg -l '(^|[^/{.\w])(rules|references|agents)/[A-Za-z0-9._<>*-]+(/[A-Za-z0-9._<>*-]+)*\.md|`AGENTS\.md`' skills rules references
  ```

#### Target behavior

- 성공: 대상 문서의 플러그인 문서 인용은 `${BOUNCER_ROOT}/rules/…`, `${BOUNCER_ROOT}/references/…`, `${BOUNCER_ROOT}/agents/…`, `${BOUNCER_ROOT}/AGENTS.md`다. 자리표시자·glob 형태(`references/<name>/index.md`, `agents/bouncer-<role>.md`, `agents/*.md`)도 접두를 붙인다. 예: `rules/skill-shape.md:55` 제목은 `## Subskills (\`${BOUNCER_ROOT}/references/<name>/index.md\`, not host catalog)`, `references/coordinator-cards/review.md:49`는 "Do not read `${BOUNCER_ROOT}/agents/*.md`"가 된다. 스킬 로컬 인용은 `./references/…`로 남는다. Markdown 링크는 href를 그대로 두고 보이는 글자만 바꾼다.
- 성공: `rules/skill-shape.md` 표기 표가 `rules/`·`agents/`·`AGENTS.md`를 루트 접두 대상에 넣고, 적용 범위를 `skills/**`, `rules/*.md`, `references/**`로 적는다.
- 성공: 새 `test/plugin-doc-cites.test.js`가 그 세 범위의 모든 `.md`에서 접두 없는 인용을 찾아 빈 목록을 단언한다. 예외는 위 "바꾸지 않을 곳"을 `{ file, text }`로 적은 목록뿐이다.
- 보존: 문서의 의미와 문장 순서, 스킬 로컬 `./references/…` 규칙(`test/skill-bouncer-surface.test.js:277-340`), `agents/*.md` 내용.
- 실패: 새 런타임 실패 경로는 없다. 예외 목록 밖의 접두 없는 인용이 남으면 새 테스트가 파일과 인용을 실패 메시지에 적는다.

#### Interface

- 제공: 인용 표기 `${BOUNCER_ROOT}/<rules|references|agents>/<path>.md`와 `${BOUNCER_ROOT}/AGENTS.md`.
- 제공: 접두 없는 인용 판정. 정의는 Checklist의 `BARE` 정규식 하나다. 바로 앞 글자가 영숫자·`_`·`.`·`/`·`}`·`-`가 아닌 `(rules|references|agents)/<경로>.md` 또는 백틱 `AGENTS.md`다. 예: `` `rules/acq.md` ``는 접두 없음, `` `${BOUNCER_ROOT}/rules/acq.md` ``(앞 글자 `/`)와 `](../../rules/acq.md)`(앞 글자 `/`)는 아님. 재현 `rg` 명령은 후보 파일을 찾는 용도이고 판정 기준이 아니다.
- 거부: 예외 목록은 위치(파일)와 정확한 문자열을 함께 적는다. 파일 단위 전체 제외는 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/context-review/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/coordinator-cards/final_review.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/coordinator-cards/implement.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/coordinator-cards/review.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/coordinator-cards/revise.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/coordinator-cards/verify.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/debugging/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/discovery/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/explain-diff/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/graphify-runner/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/implementation/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/review/assets/reviewer-prompt.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/review/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `references/spec-authoring/index.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/commit-scope.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/cursor-print-dispatch.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/output.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/planning.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/plugin-root.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `rules/skill-shape.md` | `### Explicit reference bases` | Modify | SKILL.md `references/` 표기 규칙 | 루트 접두 대상과 적용 범위 확장, 본문 인용 접두 | 표기 계약의 원본 |
| `rules/subagent-model.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-commit/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-execute/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-execute/references/agent-dispatch.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-execute/references/review-round.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-execute/references/verification-recovery.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-finalize/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-finalize/references/draft-pr.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-finalize/references/explain-quiz.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-init/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-plan/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-plan/references/context-review.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-plan/references/evidence-dispatch.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `skills/bouncer-run/SKILL.md` | 플러그인 문서 인용 | Modify | 접두 없는 플러그인 문서 인용을 담음 | `${BOUNCER_ROOT}/` 접두 | 재현 명령 결과 |
| `test/plugin-doc-cites.test.js` | 신규 추출 지점: 접두 없는 인용 판정 | Create | 없음 | 세 범위 전체 판정과 예외 목록 | Success criteria 29 판정 |
| `test/subagents.test.js` | FALLBACK_SITES 문구 | Modify | `` `agents/bouncer-<role>.md` `` 문구 고정 | 접두 문구로 갱신 | 인용 바로 앞 백틱 단언 |
| `test/skill-bouncer-plan.test.js` | context-reviewer fallback 문구 | Modify | 같은 형태 고정 | 같음 | 같음 |
| `test/skill-debugging.test.js` | debugger fallback 문구 | Modify | 같은 형태 고정 | 같음 | 같음 |
| `test/master-rules.test.js` | `:587`, `:805` 단언 | Modify | `` `rules/…` `` 문구 고정 | 같음 | 같음 |
| `test/skill-bouncer-run.test.js` | `:206` 단언 | Modify | `` `rules/cursor-print-dispatch.md` `` 문구 고정 | 같음 | 같음 |
| `test/skill-bouncer-commit.test.js` | 백틱 인용 단언 | Modify | 인용 문구 고정 | 접두가 깨는 단언만 갱신 | 백틱 인용 grep 결과 |
| `test/skill-bouncer-execute.test.js` | 백틱 인용 단언 | Modify | 같음 | 같음 | 같음 |
| `test/trust-boundary.test.js` | 백틱 `AGENTS.md` 단언 | Modify | 같음 | 같음 | 같음 |
| `test/distill-decommission-audit.test.js` | 백틱 인용 단언 | Modify | 같음 | 같음 | 같음 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `Changed` 항목 추가 | epic Success criteria 6 |

#### Constraints

- 문장은 경로 접두 말고 바꾸지 않는다. 문구를 다듬거나 재배치하지 않는다.
- TASKS-002가 고친 `**Plugin root.**` 문단은 다시 바꾸지 않는다.
- 문구 고정 테스트는 단언 대상 경로에 접두만 반영한다. 단언을 지우거나 약하게 바꾸지 않는다.
- 대상 문서 밖에서 테스트가 깨지면 `scope_revision`으로 보고하고 범위 밖 파일을 고치지 않는다.

### EPIC-088/BP-007/TASK-004 · `eb15ecc8`

#### Goal & intent

벤치마크 단계의 마지막 메시지가 선택지와 답 요청을 담은 질문인데 응답기가 답하지 않았으면, 하네스가 `unanswered`에 `text/unrecognized-question`을 남기고 단계를 `awaiting_user_decision`으로 끝낸다. 정상 완료 보고는 질문으로 읽지 않는다. 수용 기준은 epic Success criteria 30이고, 검증 명령은 `npm test`다.

#### Current behavior

- `benchmarks/run-print-stage.cjs:115-158` 턴 루프 순서는 다음과 같다.
  1. `delegateOpenDecisions`가 응답을 만들면 다음 턴으로 간다(`:133-139`).
  2. `acq = acqMarkers(text).length > 0`(`:140`), `quiz`는 finalize 단계에서만 판정한다(`:141`).
  3. `!acq && !quiz && unreadQuestion(text)`이면 `text/unread-question`을 남기고 멈춘다(`:142-145`).
  4. `!acq && !quiz`이면 아무 기록 없이 멈춘다(`:146`). 이 경로에서 `status`는 `stage_returned`다(`:163-166`).
- `unreadQuestion`(`benchmarks/acp/responder.cjs:534-536`)은 `AskUserQuestion` 글자가 있을 때만 true다.
- `delegateOpenDecisions`(`responder.cjs:548-579`)의 판정 재료:
  - 선택지 줄 판정: 지역 클로저 `optionCount`(`:553-554`), 정규식 `/^\s*(?:[-*]\s*)?(?:\*\*)?(?:\d*[A-Z]|\d+)\)(?:\*\*)?\s*\S/`.
  - 구역 경계: `[0, ...matchAll(/^\s*-{3,}\s*$/gm).index, text.length]`(`:558`).
  - 질문 범위: cue와 선택지 2개 이상이 있는 마지막 구역부터 끝까지(`:560-563`).
- `-1` 사고 fixture는 `benchmarks/acp/fixtures/v088006-plan-open-decisions-trailing-framing.txt`다.
  - 5행과 21행에 `---`가 있다.
  - 6~20행에 선택지 줄 4개(`- A) …`, `- B) …`)가 있다.
  - 마지막 구역(21행~)은 선택지가 없는 framing 초안 표이고, 23행에 "답변 반영 후"가 있다.
  - 현재 테스트(`benchmarks/acp/responder.test.cjs:699-708`)는 위임 정책일 때만 본다.
- 정상 단계 마지막 메시지에는 선택지 줄이 없다. 다만 `선택됨`, `선택:`, `응답`, `답변` 같은 단어는 있다(v088005-1 `02-plan/07`, `04-finalize/03`, v088006-1 `01-init/02`).
- 조사 결과: "선택지 2개 이상인 마지막 구역부터 끝까지 요청 문구" 규칙을 v088005-{1,2}, v088006-{1,2,3}의 18개 단계 마지막 턴에 적용했다. `-1` fixture와 v088006-3 `04-finalize/02`(ACQ 경로가 이미 처리)만 true였다.
- `benchmarks/runs/`는 gitignore 대상이라 worker worktree에 없다(`.gitignore:23`). 정상 메시지 원본은 main checkout의 다음 파일이다. 텍스트는 `run-print-stage.cjs:51-63` `parseStream`처럼 `type: "result"` 이벤트의 `result` 문자열이다.
  - `benchmarks/runs/v088005-ledger-004-bouncer-full-1/{01-init/cursor-turns/02,02-plan/cursor-turns/07,03-run/cursor-turns/02,04-finalize/cursor-turns/03}.jsonl`
  - `benchmarks/runs/v088006-ledger-004-bouncer-full-2/{01-init/cursor-turns/02,02-plan/cursor-turns/07,03-run/cursor-turns/02,04-finalize/cursor-turns/03}.jsonl`
- I/O 결합: `run-print-stage.cjs`는 docker spawn(`:23`, `:32-48`, `:96`, `:112`)과 파일 쓰기로 묶여 있고 export가 없다. 판정은 `responder.cjs`의 순수 함수로 둘 수 있다.
- `npm test`(`node --test`)는 `benchmarks/**/*.test.cjs`를 함께 돈다.

#### Target behavior

- 성공: `unrecognizedQuestion(text)`는 아래 두 조건이 모두 맞으면 true다.
  - 선택지 줄이 2개 이상인 마지막 `---` 구역이 있다.
  - 그 구역 시작부터 텍스트 끝까지 요청 문구 `/답|골라|선택|알려|reply|choose|pick/i`가 있다.
- 성공: `responder.cjs`의 순수 함수 `unhandledQuestionMethod(text)`가 ACQ·quiz가 처리하지 않은 턴의 미응답 method를 정한다. `unreadQuestion(text)`이면 `'text/unread-question'`, 아니고 `unrecognizedQuestion(text)`이면 `'text/unrecognized-question'`, 둘 다 아니면 `null`이다. `run-print-stage.cjs`는 기존 3단계(`:142-145`) 자리에서 `!acq && !quiz`일 때 이 함수를 부르고, 값이 있으면 `unanswered.push({ at, method, text })` 후 멈춘다. `status`는 기존 규칙(`:166`)대로 `awaiting_user_decision`이 된다.
- 성공: 위임 정책 없는 `-1` fixture는 true이고, 정상 단계 fixture 8개는 false다.
- 보존: 위임 정책이 있으면 위임 분기가 먼저 이긴다. `text/unread-question` 분기와 그 method 값, ACQ·quiz 처리, `delegateOpenDecisions`의 결과는 그대로다.
- 실패: 선택지 줄이 없거나 하나뿐이면 요청 문구가 있어도 false다. 선택지가 있어도 요청 문구가 없으면 false다.

#### Interface

- 제공: `responder.cjs` export `unrecognizedQuestion(text: string) → boolean`과 `unhandledQuestionMethod(text: string) → 'text/unread-question' | 'text/unrecognized-question' | null`.
- 제공: `delegateOpenDecisions`와 공유하는 모듈 수준 선택지 줄 정규식과 구역 경계 함수. 이름은 구현이 정한다.
- 제공: `unanswered` 항목 method 값 `text/unrecognized-question`.
- 거부: 판정은 정책·단계 인자를 받지 않는다. 단계별 예외를 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.cjs` | `unrecognizedQuestion`, `unhandledQuestionMethod`, `delegateOpenDecisions` | Modify | ACQ·위임 판정 | 새 판정 함수 둘 export, 선택지 정규식·구역 경계를 모듈 수준으로 올림 | 판정과 method 순서를 순수 함수로 테스트 |
| `benchmarks/run-print-stage.cjs` | 턴 루프 | Modify | 단계 실행과 `unanswered` 기록 | `:142-145` 분기를 `unhandledQuestionMethod` 호출로 교체 | 조용한 종료 지점(`:146`) |
| `benchmarks/acp/responder.test.cjs` | 신규 추출 지점: unrecognizedQuestion 테스트 | Modify | 응답기 테스트 | `-1` fixture true, 정상 fixture false, 경계 사례 | Success criteria 30 판정 |
| `benchmarks/acp/fixtures/stage-final/` | 정상 단계 마지막 메시지 8개 | Create | 없음 | main checkout run에서 옮긴 텍스트 | gitignore된 원본을 회귀 fixture로 고정 |

#### Constraints

- 정상 fixture 파일 이름은 `<run 접두>-<단계 디렉터리>.txt`다(예: `v088005-1-02-plan.txt`, `v088006-2-04-finalize.txt`). 내용은 원본 `result` 문자열 그대로다. 다듬지 않는다.
- 원본 run 디렉터리는 읽기만 한다. worker worktree에 없으면 controller가 알려 준 main checkout 경로에서 읽는다.
- 기존 응답기 테스트는 모두 그대로 통과해야 한다.
- `.cjs` 파일의 기존 주석 밀도와 영어 주석 관례를 따른다.

### EPIC-088/BP-007/TASK-005 · `67f4a5e9`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `rules/skill-shape.md` — 기록된 CI 실패를 복구한다.
- Modify `rules/cursor-print-dispatch.md` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.