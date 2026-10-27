---
type: bouncer.explain
title: model-tiers-effort explain
description: Explain for model-tiers-effort
resource: .bouncer/context/epics/runtime-architecture/blueprints/model-tiers-effort/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-27T10:47:44.643+09:00'
bouncer:
  id: EXPLAIN-model-tiers-effort
  epic_id: runtime-architecture
  blueprint_id: model-tiers-effort
  status: published
  comprehension:
    - range_from: ec7f0fad4138ecafa443526e7ccc53ee8c55ca15
      range_to: 3059375a77eef9d7d713a1b90dcab174b3b5bc48
      diff_sha: a5ff61ce24acfa2f39c473e7edc66916879e1f0faa380a48842735cf7f365721
      recorded_at: '2026-10-27T10:49:07.305+09:00'
  task_commits:
    - task: runtime-architecture/model-tiers-effort/001
      sha: d976b201
      intent_anchor: task-001
    - task: runtime-architecture/model-tiers-effort/002
      sha: 05a02946
      intent_anchor: task-002
    - task: runtime-architecture/model-tiers-effort/003
      sha: 3059375a
      intent_anchor: task-003
---
# Explain

## Background

역할별 서브에이전트 모델은 provider마다 slug 하나로만 지정할 수 있었다. 같은 역할이 호스트를 바꾸면 slug를 전부 다시 적어야 했고, 추론 강도(effort)는 설정할 방법이 없었다.

이 변경은 역할이 `strong`·`standard`·`light` 등급과 `low`·`medium`·`high` effort를 가리키게 하고, provider 블록이 등급을 실제 모델로 매핑하게 한다. 매핑이 비어 있으면 다른 등급이나 부모 모델로 몰래 대체하지 않고 거절해서 사용자가 설정을 고치게 한다. 기존 `subagents.<provider>.<agent>` slug 설정은 그대로 최우선이다.

## Code

- `packages/cli/src/subagents.ts` — `resolveSubagentRole()`이 해석 본체다. 순서는 `roles` 검증 → slot slug → 등급 없음이면 inherit → `model_tiers.<provider>.<tier>` 매핑이다. 오류는 throw하지 않고 `tier-unmapped`·`role-config-invalid` 변형으로 돌려준다. `resolveSubagentModel()`은 이 결과를 `{ model, provider }`로 줄인 래퍼라 `agent_dispatch` 모양이 바뀌지 않는다. 설계상 한계: 오류 출력의 tier는 짧은 식별자 모양만 통과시키고 나머지는 `<invalid>`로 바꾼다.
- `packages/cli/src/cli-project-commands.ts` — `bouncer subagent-model --agent <name> [--json]`. 평문 출력은 slug 한 줄 또는 `inherit`, `--json`은 `{ provider, role, tier, model, effort, source }` 한 줄이다. 오류는 exit 1과 stderr 한 줄이다.
- `packages/cli/src/print-dispatch.ts` — Cursor print 디스패치가 같은 해석을 쓰고, 오류면 실행하지 않고 고칠 설정 키를 알려 준다.
- `hooks/subagent-model.js` — Claude 호출 훅이 `--json` 결과로 model과 effort를 보정한다. 옛 runtime의 단일 토큰 출력도 계속 받는다.
- `packages/cli/src/init.ts`, `docs/configuration.md`, `rules/subagent-model.md`, `rules/cli.md` — 새 config에만 `model_tiers`(전부 `inherit`)와 `roles`(전부 `standard`·`medium`) 예시를 넣고, 호스트별 effort 전달 방식을 문서화했다. 이미 init한 저장소 config는 다시 쓰지 않는다.

## Quiz

1. 역할에 `tier: standard`가 있고 `subagents.codex.<agent>` slot에 모델 slug가 있다. `model_tiers.codex.standard`는 다른 slug다. 어느 모델이 쓰이나?
   - A) `model_tiers`의 slug
   - B) `subagents` slot의 slug
   - C) 부모 세션 모델
2. 역할 tier가 `strong`인데 `model_tiers.<provider>.strong`이 비어 있고 slot도 없다. `bouncer subagent-model`은 어떻게 동작하나?
   - A) `standard` 등급 모델로 대체한다
   - B) 부모 모델을 상속하도록 `inherit`을 출력한다
   - C) `tier-unmapped`로 exit 1 하고 고칠 설정 키를 알린다
3. `roles.<agent>`에 tier가 없고 effort만 `high`다. `--json` 결과는?
   - A) tier는 null, model은 inherit이라 null, effort는 `high`
   - B) `standard`·`medium`으로 채워진다
   - C) effort도 tier가 없으므로 null
4. Cursor 호스트에서 역할 effort는 어떻게 다뤄지나?
   - A) 모델 slug에 이미 들어 있어 넘기지 않고, 적용되지 않았다고 사용자에게 알린다
   - B) Agent `effort` 인자로 넘긴다
   - C) `reasoning_effort`로 spawn에 넘긴다

## Tasks

### runtime-architecture/model-tiers-effort/001 · `d976b201`

#### Goal & intent

역할 모델 해석이 기존 `subagents.<provider>.<agent>` slug 다음으로 `roles.<agent>.tier`를 `model_tiers.<provider>`로 매핑하고 effort를 함께 돌려준다. 등급 매핑이 비면 오류 변형으로 거절하며, CLI는 exit 1, Cursor print dispatch는 `ok: false` 실패 결과를 낸다. 수용 기준은 epic Success criteria 15의 해석·CLI 부분이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `resolveSubagentModel()`(`packages/cli/src/subagents.ts:66-100`)은 `readConfig(repoRoot) ?? {}`(`:78`)로 config를 읽고, provider를 `resolveProvider()`(`:37-51`, `process.env` 네 개를 `:46-49`에서 읽음)로 정한다. slot 값이 문자열이면 `{model, provider}`, 그 밖에는 `{model: null, provider}`를 돌려주며 throw하지 않는다(`:58-61` 주석). 반환은 `{model, provider}`뿐이다(`:53-56`).
- `resolveSubagentDispatch()`(`:109-119`)는 `{agent, ...resolveSubagentModel()}`이다. 호출자 `review-dispatch.ts:707-709`, `:972`, `:986`과 `print-dispatch.ts:296-299`는 try/catch 없이 결과를 그대로 쓴다.
- `cmdSubagentModel()`(`packages/cli/src/cli-project-commands.ts:150-180`)는 `--agent`를 `requireNamedAgent()`(`:130-147`, 누락·미등록이면 exit 2)로 검사하고 `${model ?? 'inherit'}\n` 한 줄을 출력한다(`:178`). exit 1 경로는 없다. `:150-151` 주석은 provider를 dispatch 인자로 넘기는 경로를 막으려고 JSON을 내지 않는다고 적는다.
- `parseFlags()`(`packages/cli/src/cli-flags.ts:7-26`)는 값 없는 `--json`을 `true`로 둔다(`:18-19`). JSON 출력 관례는 `cli-project-commands.ts:56`이다.
- usage 문자열은 `packages/cli/src/cli-usage.ts:24`이다.
- 재현: `npm run build && node --test test/subagents.test.js test/cli-project-commands.test.js test/cli-help.test.js test/print-dispatch.test.js`는 현재 통과한다.

#### Target behavior

- 성공:
  - slot에 slug가 있으면 `source: "slot"`, `tier: null`, `model: <slug>`이다.
  - slot이 미설정이고 `roles.<agent>.tier`가 있으면 `model_tiers.<provider>.<tier>`를 읽어 `source: "tier"`, `model: <slug>`를 낸다. 값이 `inherit`이면 `model: null`이다.
  - 둘 다 없으면 `source: "inherit"`, `model: null`이다.
  - `roles.<agent>`에 `tier`가 없거나 `tier: null`이고 `effort`만 있으면 slot 또는 `inherit`으로 해석하고 `tier: null`, effort는 그 값이다.
  - `effort`는 `roles.<agent>.effort`이고, 부재·`null`이면 `null`이다. source와 무관하게 실린다.
  - provider가 `null`이면 slot·등급 매핑을 보지 않고 `source: "inherit"`, `model: null`이다. 이때도 effort는 실린다.
  - print dispatch 성공 결과에 `effort`(설정값 또는 `null`) 필드가 추가된다. 이 값은 `--model`에 넣지 않는다. controller가 Cursor 미적용 사실을 알릴 근거다.
- 실패:
  - 등급이 지정됐는데 매핑 값이 부재·빈 문자열·비문자열이거나, `model_tiers` 또는 `model_tiers.<provider>`가 부재·비객체이면 `tier-unmapped`이다.
  - `roles`가 일반 객체가 아니거나(부재는 정상, 배열·`null`은 오류), `roles.<agent>`가 일반 객체가 아니거나(부재는 정상, `null`·배열·문자열은 오류), `tier`가 세 값 밖이거나, `effort`가 `low|medium|high`·`null` 밖이면 `role-config-invalid`이다. 이 검증은 조회한 역할에만 하고, slot slug가 이기거나 provider가 `null`이어도 한다. 다른 역할 항목은 보지 않는다.
  - CLI는 두 경우 모두 exit 1이고 stdout은 비운다.
  - print dispatch는 `ok: false`, `reason`이 같은 code인 실패를 내고 prompt 파일을 쓰지 않는다.
- 보존:
  - 플래그 없는 출력은 `<slug>\n` 또는 `inherit\n`이다.
  - `resolveSubagentModel()`·`resolveSubagentDispatch()`는 throw하지 않고 반환 모양이 같다. 오류 변형일 때는 `model: null`이다.
  - `--agent` 사용법 오류는 exit 2이다.
  - Cursor print dispatch는 effort를 `--model`에 붙이지 않는다.

#### Interface

- 제공:
  ```ts
  type RoleResolution =
    | { ok: true; provider: string | null; role: string; tier: 'strong' | 'standard' | 'light' | null;
        model: string | null; effort: 'low' | 'medium' | 'high' | null; source: 'slot' | 'tier' | 'inherit' }
    | { ok: false; provider: string | null; role: string; tier: string | null;
        code: 'tier-unmapped' | 'role-config-invalid'; message: string; next: string };
  function resolveSubagentRole(opts: { repoRoot?: string; agentName?: string; provider?: string }): RoleResolution;
  ```
  - `bouncer subagent-model --agent <name> [--provider <name>] [--json]`
    - `--json` 성공 출력은 한 줄 `{"provider":…,"role":"bouncer-reviewer","tier":…,"model":"<slug>|inherit","effort":…,"source":…}`이다. `model`이 `null`이면 문자열 `inherit`으로 쓴다.
    - 실패 시 exit 1이고, stdout은 비고, stderr에 다음 한 줄을 쓴다. `--json` 여부와 무관하다.
      ```text
      subagent-model: <code>: provider=<provider|-> role=<agent> tier=<tier|-> <message> (fix: <config key>)
      ```
      예: `subagent-model: tier-unmapped: provider=codex role=bouncer-coordinator tier=standard no model mapped for this tier (fix: model_tiers.codex.standard)`
    - `tier=` 자리와 오류 변형의 `tier` 필드: 설정값이 `/^[A-Za-z0-9_-]{1,32}$/`에 맞는 문자열이면 그 값, 부재·`null`이면 `-`(필드는 `null`), 그 밖(숫자·객체·제어문자·개행 포함 문자열 등)은 `<invalid>`이다. 설정값 원문을 stderr에 그대로 옮기지 않는다.
- 거부 (throw가 아니라 반환되는 오류 변형):
  - `tier-unmapped`. 예: `roles.bouncer-coordinator.tier = "standard"`이고 `model_tiers.codex = { strong: "gpt-6.1-sol" }`이다.
  - `role-config-invalid`. 예: `roles.bouncer-reviewer = { tier: "high" }`이다.
- 거부 (사용법 오류, exit 2): `--agent` 누락·미등록이다. 기존과 같다.
- print dispatch 결과 `PrintDispatchOk`에 `effort: 'low' | 'medium' | 'high' | null`를 추가한다. 실패 `reason`에 `tier-unmapped`·`role-config-invalid`를 추가한다. 문서 반영은 `TASKS-003`(`rules/cli.md`)이 맡는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/subagents.ts` | `resolveSubagentModel`, 신규 추출 지점: 등급·effort 해석 | Modify | slot slug만 해석, throw 없음 | `resolveSubagentRole` 추가, `resolveSubagentModel`을 그 위에 얹고 반환 모양 유지 | `subagents.ts:66-100`, `:109-119` |
| `packages/cli/src/cli-project-commands.ts` | `cmdSubagentModel` | Modify | 한 줄 출력, exit 0/2 | `--json` 분기와 오류 exit 1 추가, `:150-151` 주석을 새 계약으로 고침 | `cli-project-commands.ts:150-180` |
| `packages/cli/src/cli-usage.ts` | `COMMAND_USAGE['subagent-model']` | Modify | usage 한 줄 | `[--json]`과 JSON 필드 설명 추가 | `cli-usage.ts:24` |
| `packages/cli/src/print-dispatch.ts` | `runPrintDispatch` 모델 조회, `PrintDispatchOk` | Modify | `resolveSubagentModel`로 slug만 조회 | `resolveSubagentRole`로 조회해 오류면 `fail(<code>, message, next)`, 성공이면 기존대로 `--model`, 결과에 `effort` 추가 | `print-dispatch.ts:296-299`, `fail()` `:113-120`, 실패 결과 모양 `:36-45` |
| `test/subagents.test.js` | 해석기 테스트 | Modify | `{model, provider}` 매트릭스 | 등급·effort·오류 케이스 추가, 기존 단언 유지 | `test/subagents.test.js:18-32`, `:68-476` |
| `test/cli-project-commands.test.js` | `subagent-model` 테스트 | Modify | 한 줄 출력·exit 2 | `--json`·exit 1 케이스 추가 | `test/cli-project-commands.test.js:1385`, `:1402`, `:1438-1444` |
| `test/cli-help.test.js` | usage regex | Modify | `/subagent-model --agent <name> \[--provider <name>\]/` | `[--json]` 포함 regex로 바꿈 | `test/cli-help.test.js:88` |
| `test/print-dispatch.test.js` | print dispatch 테스트 | Modify | inherit·slug 케이스 | `tier-unmapped` 실패와 등급 slug 케이스 추가 | `test/print-dispatch.test.js:160-175` |

#### Constraints

- `resolveSubagentModel()`은 계속 throw하지 않는다. `review-dispatch`·`context-review-state` 테스트가 보는 `agent_dispatch {agent, provider, model}` 모양에 키를 더하지 않는다.
- 해석 우선순위는 Target behavior의 순서 그대로다. slot `inherit`은 미설정과 같다(사용자 결정).
- 오류 때 다른 등급·부모 모델로 대체하지 않는다. `tier-unmapped`는 CLI에서 `inherit`을 출력하지 않는다.
- 기존 단언은 다음 범위에서만 바꾼다. `test/cli-help.test.js`의 `usage → 명령별 형식 문구를 나열한다`(`:52`) 목록 중 `:88` regex를 `/subagent-model --agent <name> \[--provider <name>\] \[--json\]/`로 바꾼다. `test/subagents.test.js`·`test/cli-project-commands.test.js`·`test/print-dispatch.test.js`의 기존 단언은 바꾸지 않는다. `test/print-dispatch.test.js`는 결과 객체를 deepEqual하지 않고 argv slice만 본다(`:138`, `:174`, `:422`). 이 단언들은 그대로 통과해야 한다.
- effort 허용 값은 `low|medium|high`이고, 등급 이름은 `strong|standard|light`이다.

### runtime-architecture/model-tiers-effort/002 · `05a02946`

#### Goal & intent

Claude Code PreToolUse hook이 `subagent-model --json`을 읽어 Bouncer Agent 호출의 `model`(지금과 같음)과 `effort`(신규)를 설정값에 맞춘다. 등급 미매핑 등 조회가 실패하면 호출을 막는다. 수용 기준은 epic Success criteria 15의 hook 부분이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 등록: `hooks/hooks.json:10-14`의 PreToolUse `matcher: "Agent"` 항목이 `hooks/subagent-model.js`를 실행한다.
- `handle()`(`hooks/subagent-model.js:17-77`)의 흐름은 다음과 같다.
  - JSON을 파싱하고 Agent·역할을 판정한다(`:18-33`).
  - `runRuntime(['subagent-model','--agent',canonical,'--provider','claude','--repo',cwd])`를 호출한다(`:38-40`).
  - 찾기 실패·timeout·nonzero이면 `fail()` exit 2이다(`:41-48`).
  - stdout 끝의 LF/CRLF 하나를 떼고 `MODEL_TOKEN`(`:7`)으로 검사한다(`:49-54`).
  - `inherit`이면 명시된 `model`을 지우고, 아니면 다를 때 바꾼다(`:56-66`).
  - 바뀐 경우에만 stdout에 `{hookSpecificOutput:{updatedInput, additionalContext}}`를 쓴다(`:68-75`).
- `effort`는 읽지도 쓰지도 않는다.
- process spawn: `runRuntime`(`hooks/runtime-cli.js:218-239`)이 `spawnSync`를 쓰고 `BOUNCER_BIN`(`:186-191`)으로 CLI를 찾는다. hook은 stdout만 읽는다.
- 테스트 seam: `test/subagent-model-hook.test.js:26-32` `makeRuntime`이 `$MODEL_OUTPUT`을 출력하고 `$MODEL_EXIT`로 끝나는 sh stub을 만들어 `BOUNCER_BIN`에 넣는다. `runHook`(`:11-16`)이 stdin으로 payload를 넣는다.
- 단언 목록:
  - `:50`: 누락 model 채움, `/implementer.*누락.*claude-opus-5-5.*한국어/`
  - `:61`: 교체
  - `:76`: 같으면 빈 stdout
  - `:82`, `:91`: inherit
  - `:96`: 비대상 통과
  - `:110`, `:117`, `:146`, `:154`: 실패 문구
  - `:124`, `:133`, `:140`: 단일 토큰 검사
- 재현: `node --test test/subagent-model-hook.test.js`는 현재 통과한다.

#### Target behavior

- 성공:
  - hook은 `--json`을 붙여 CLI를 부른다. stdout(끝 LF/CRLF 하나 허용)을 JSON 객체로 파싱한다.
  - `model`은 기존 규칙대로 보정한다(`inherit`이면 제거, 아니면 교체).
  - `effort`가 `low|medium|high`이고 입력 `effort`와 다르면 `effort`를 그 값으로 바꾼다. `effort`가 `null`이면 입력 `effort`를 건드리지 않는다.
  - model·effort 중 하나라도 바뀌면 한 번만 출력한다. `additionalContext`는 기존 model 문구 뒤에 ` effort 이전값 <JSON|누락>, 보정값 <JSON>.`을 덧붙인다. effort가 바뀌지 않으면 덧붙이지 않는다.
- 옛 runtime 호환: stdout이 JSON이 아니고 기존 단일 토큰 규칙(`MODEL_TOKEN`, 끝 LF/CRLF 하나)에 맞으면 `--json`을 모르는 옛 runtime으로 본다.
  - 기존과 같이 model만 보정하고 effort는 건드리지 않는다.
  - `additionalContext`에 `runtime이 --json을 지원하지 않아 roles 등급 해석·빈 등급 거절·effort 보정을 적용하지 못했습니다. BOUNCER_BIN을 최신 runtime으로 설정하세요.`를 덧붙인다.
  - model이 같아 보정이 없어도 이 안내 한 건은 출력한다(`updatedInput`은 원래 입력과 같다).
- 실패 (모두 exit 2, stderr `fail()` 형식):
  - CLI nonzero. `tier-unmapped`·`role-config-invalid`의 exit 1을 포함한다.
  - stdout이 JSON 객체(배열·스칼라 제외)도, 옛 runtime 단일 토큰도 아니다. 여러 줄도 여기에 든다.
  - JSON의 `model`이 부재·비문자열이거나 `MODEL_TOKEN`에 맞지 않는다.
  - JSON에 `effort` 키가 없거나, 값이 `null`·`low|medium|high`가 아니다.
- 보존:
  - 비대상 payload 통과(`:96`), cwd·찾기·timeout 실패 문구(`:110`, `:117`, `:146`, `:154`)
  - model만 바뀌는 경우의 `additionalContext` 문구(`:50`, `:61`, `:82` regex)
  - 같은 값이면 빈 stdout(`:76`, `:91`)
  - `permissionDecision`을 쓰지 않음

#### Interface

- 제공: hook이 부르는 CLI argv는 `['subagent-model','--agent',canonical,'--provider','claude','--repo',cwd,'--json']`이다. `updatedInput.effort`는 CLI `effort` 값이다.
  - JSON 입력 모양: `{"provider":"claude","role":"bouncer-reviewer","tier":"standard","model":"claude-sonnet-5-5","effort":"medium","source":"tier"}`
- 거부 (exit 2): 옛 단일 토큰도 아닌 파싱 실패, 비객체 JSON, 여러 줄, `model` 부재·비문자열·토큰 불일치, `effort` 부재·허용 밖. stderr는 `모델 조회 결과가 JSON 객체도 단일 모델 토큰도 아닙니다`를 포함한다. 기존 `/단일 모델 토큰/` regex도 이 문구에 맞는다.
- 테스트 seam: 기존 `makeRuntime({ body })` stub을 그대로 쓴다. `MODEL_OUTPUT`에 JSON 문자열을 넣는다. argv는 `body`를 다음처럼 바꿔 받는다.
  ```sh
  printf '%s\n' "$@" > "$ARGV_OUT"; printf '%s' "$MODEL_OUTPUT"
  ```
  `ARGV_OUT`(임시 파일 경로)의 줄 목록이 `[..., '--repo', <cwd>, '--json']`로 끝나는지 deepEqual로 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `hooks/subagent-model.js` | `handle` | Modify | 한 줄 slug를 읽어 `model`만 보정 | `--json`을 읽어 `model`·`effort` 보정, 파싱 실패 차단 | `hooks/subagent-model.js:38-75` |
| `test/subagent-model-hook.test.js` | hook 테스트 | Modify | 한 줄 stub 출력 단언 | JSON stub 출력으로 바꾸고 effort·JSON 오류 케이스 추가 | `test/subagent-model-hook.test.js:26-32`, `:50-158` |

#### Constraints

- 역할 집합(`:6`, `:29-31`)과 비대상 통과 판정은 바꾸지 않는다.
- 기존 단언은 바꾸지 않는다. 옛 runtime 단일 토큰 경로가 남으므로 다음 테스트는 입력과 기대값을 그대로 두고 통과해야 한다.
  - `missing Bouncer model → public CLI value fills model and preserves input`(`:50`), `mismatched model → config model replaces it and reports previous value`(`:61`), `inherit with explicit model → removes model to restore inheritance`(`:82`)는 `additionalContext`에 옛 runtime 안내가 덧붙는다. 기존 regex는 부분 일치라 그대로 맞는다.
  - `same model → no input rewrite or context message`(`:76`), `inherit without explicit model → no rewrite`(`:91`)는 옛 runtime 안내 때문에 stdout이 비지 않는다. 이 두 테스트의 stub 출력만 JSON `{"provider":"claude","role":"bouncer-<role>","tier":null,"model":<기존 값>,"effort":null,"source":"slot"}`으로 바꾼다. 기대값(빈 stdout)은 그대로다.
  - `diagnostic line, padded token, control character, and multiple lines → exit 2`(`:124`), `single model token and one LF or CRLF terminator → accepted`(`:133`), `runtime output with trailing blank line → exit 2`(`:140`)는 입력·기대값을 그대로 둔다.
- 새 JSON 케이스 fixture는 effort를 명시한다. 보정 기대가 없는 케이스는 `"effort": null`로 둔다.
- hook은 CLI stderr를 읽지 않는다. 사용자 config 내용을 stderr에 옮기지 않는다.

### runtime-architecture/model-tiers-effort/003 · `3059375a`

#### Goal & intent

새로 init한 저장소의 config에 `model_tiers`·`roles` 예시가 생긴다. `bouncer config --help`, `docs/configuration.md`, `rules/subagent-model.md` 1항, `rules/cli.md`는 해석 순서, `--json`, 빈 등급 거절, host별 effort 전달을 안내한다. 수용 기준은 epic Success criteria 15의 안내 부분이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- init 기본 config:
  - `packages/cli/src/init.ts:164-191`이 provider 4개(claude, cursor, codex, antigravity) × 에이전트 5개를 모두 `'inherit'`로 만든다.
  - 새 저장소에만 `writeFile`(`:214-219`, config 쓰기는 `:631`)한다.
  - 이미 init된 저장소 경로(`:490-571`)는 `subagents`를 건드리지 않는다. `:160-161` 주석이 이 계약을 적는다.
- `bouncer config --help`: `packages/cli/src/cli-config-command.ts:23-36` HELP에는 `subagents.*` 세 키와 `metrics.pricing`만 있다.
- `rules/cli.md`:
  - `:409` 시놉시스가 `bouncer subagent-model --agent <name> [--provider <name>]`이다.
  - `:450-452`는 "prints one model slug, or `inherit` … Do not parse it as `{ model, provider }` JSON"이라 적는다.
  - `:514-516`은 `dispatch print`의 `reason` 닫힌 목록이다.
  - `test/doc-shape-cli.test.js`는 이 파일의 거부 표만 본다.
- `docs/configuration.md`: 필드 표 `:27-29`, `## subagents` 절 `:127-175`(예시 JSON `:136-147`, 기존 init 저장소 수동 추가 안내 `:172-174`).
- `rules/subagent-model.md` 1항(`:12-37`):
  - `:13`은 "It prints one slug line, or `inherit`"이라 적는다.
  - `:14`은 "Pass only that printed line"이라 적는다.
  - `:18-19`는 "`inherit`, `null`, and every non-string configured value have that inheritance meaning"이라 적는다.
  - effort 언급은 없다.
- 이 문서를 단언하는 테스트(`TASKS-001` 뒤 줄 번호가 바뀌므로 이름으로 찾는다):
  - `test/subagents.test.js`의 `coordinator dispatch → shares the model contract and keeps its full fallback brief`, `Codex slug dispatch → item 1 requires fork_turns "none" with the model`, `dispatch history rule → item 1 isolates history independent of inherit`: 1항이 `1. Resolve`로 시작해 `2. ` 앞에서 끝나며 Codex·`fork_turns: "none"`·slug를 포함한다.
  - `rule 4 → defines the same role brief as the whole role document plus controller input`, `` `${site.role} fallback in ${site.rel} → …` ``: 4·5항 앵커
- 같은 출력을 서술하는 다른 문서(조사 결과, 이번에 바꾸지 않음):
  - `rules/cli.md:254-256`: `coordinate dispatch --model`이 `subagent-model` 출력(slug 또는 `inherit`)을 기록한다. 플래그 없는 한 줄 출력은 그대로라 유효하다.
  - `skills/bouncer-run/references/agent-dispatch.md:314-319`: implementer dispatch 전에 한 줄 출력을 `--model`로 붙인다. 한 줄 출력은 그대로이고, exit 1 처리는 이 문서가 따르는 `rules/subagent-model.md` 1항이 소유한다.
  - `rules/cursor-print-dispatch.md` 4항(`:38`): `result.model`이 `null`이 아닐 때만 `--model`. 바뀌지 않는다. Cursor effort 미적용 알림은 1항이 소유한다.
- 테스트:
  - `test/init.test.js:135-191`이 새 config 전체를 deepStrictEqual한다.
  - `test/cli-help.test.js:418-432`가 config help의 키 포함을 확인한다.
- `lint:docs`에는 `rules/subagent-model.md`·`docs/configuration.md` 계약이 없다.
- 재현: `npm run build && node --test test/init.test.js test/cli-help.test.js test/subagents.test.js`는 현재 통과한다.

#### Target behavior

- 성공:
  - 새 init config에 다음 두 블록이 생긴다.
    ```json
    "model_tiers": { "<4 providers>": { "strong": "inherit", "standard": "inherit", "light": "inherit" } },
    "roles": { "<5 agents>": { "tier": "standard", "effort": "medium" } }
    ```
    `subagents` 블록은 그대로다. 모델은 계속 부모 상속이고, effort `medium`만 적용된다.
  - config help는 `model_tiers.<provider>.<tier>`, `roles.<agent>.tier`, `roles.<agent>.effort`의 허용값·기본값을 출력한다.
  - `docs/configuration.md`는 필드 표와 `## subagents` 절(또는 그 아래 새 절)에 다음을 적는다.
    - 해석 순서
    - 빈 등급의 `tier-unmapped` 거절
    - `--json` 필드
    - 기존 init 저장소는 두 블록을 직접 추가해야 한다는 안내
  - 규칙 1항은 다음을 적는다.
    - 한 줄 출력과 `--json`
    - exit 1이면 디스패치하지 않고 사용자에게 code·provider·역할·등급·고칠 키를 알린다
    - host별 effort 전달
      - Claude Code: Agent `effort` 인자. hook이 보정한다.
      - Codex: spawn `reasoning_effort`. custom agent TOML 필드명은 `model_reasoning_effort`다.
      - Cursor: effort가 모델 slug에 들어 있으므로 역할 effort를 넘기지 않고, 미적용 사실을 사용자에게 알린다.
  - 규칙 1항의 `:18-19` 상속 문장은 `subagents.<provider>.<agent>` slot 값으로 한정한다. `model_tiers` 값의 부재·빈 값·비문자열은 상속이 아니라 `tier-unmapped` 거절이라고 적는다.
  - 규칙 1항은 다음 다섯 문장을 그대로 담는다(테스트가 포함 여부를 본다).
    - `If the command exits 1, do not dispatch; report its code, provider, role, tier, and the config key to fix.`
    - `On Codex, pass the role effort as the spawn reasoning_effort.`
    - `On Cursor, do not pass the role effort; tell the user the configured effort was not applied because the model slug carries it.`
    - `On Claude Code, pass the role effort as the Agent effort argument; the hook corrects it.`
    - `Run bouncer subagent-model --agent <name> --json to read provider, role, tier, model, effort, and source.`
  - `rules/cli.md`:
    - `:409` 시놉시스에 `[--json]`을 더한다.
    - `:450-452`는 "플래그 없이 한 줄, `--json`이면 `{provider, role, tier, model, effort, source}` 한 줄, 오류면 exit 1"로 바꾼다.
    - `:514-516` reason 목록에 `tier-unmapped`·`role-config-invalid`를 더하고, 성공 결과의 `effort` 필드(미적용 설정값)를 적는다.
- 실패: 해당 없음. 문서·기본값 변경이다. 판정은 테스트 단언으로 한다.
- 보존:
  - 이미 init된 저장소 config를 다시 쓰지 않는다.
  - 1항의 `fork_turns: "none"`·Codex·slug 문구와 항목 번호 앵커(`1. Resolve`, `2. `, `4. When named agents are unavailable`, ``5. `/bouncer-run` resolves``)를 유지한다.
  - 3항 "자동 재시도·fallback 없이 멈춤"은 그대로다.

#### Interface

- 제공: init 기본 config의 `model_tiers`·`roles` 키, config help의 세 줄, 규칙 1항의 effort 전달 문구.
- 거부: 해당 없음. 새 입력 검증은 `TASKS-001` 소관이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/init.ts` | 기본 config 생성부 | Modify | `subagents` inherit 슬롯 | `model_tiers`·`roles` 예시 추가, 주석 갱신 | `init.ts:153-191`, 재작성 금지 `:490-571` |
| `packages/cli/src/cli-config-command.ts` | `HELP` | Modify | `subagents.*`·`metrics` 키 안내 | `model_tiers`·`roles` 키와 허용값·기본값 안내 추가 | `cli-config-command.ts:23-36` |
| `docs/configuration.md` | 필드 표, `## subagents` | Modify | slot 키와 inherit만 설명 | 두 키·해석 순서·거절·`--json`·수동 추가 안내 | `docs/configuration.md:27-29`, `:127-175` |
| `rules/subagent-model.md` | 1항 | Modify | 한 줄 slug 계약 | `--json`·exit 1·host별 effort 전달 추가, 상속 문장을 slot으로 한정 | `rules/subagent-model.md:12-37`, `:18-19` |
| `rules/cli.md` | `subagent-model` 시놉시스·출력 문단, `dispatch print` reason 목록 | Modify | 한 줄 출력만, JSON 파싱 금지, reason 8개 | `--json`·exit 1·새 reason 2개·`effort` 결과 필드 | `rules/cli.md:409`, `:450-452`, `:514-516`; 형태 테스트 `test/doc-shape-cli.test.js` |
| `test/init.test.js` | 새 config deepStrictEqual | Modify | `subagents`만 기대 | `model_tiers`·`roles` 기대값 추가 | `test/init.test.js:135-191` |
| `test/cli-help.test.js` | config help 테스트 | Modify | `subagents.*` 포함 확인 | `model_tiers.<provider>.<tier>`, `roles.<agent>.tier`, `roles.<agent>.effort`, `strong | standard | light`, `low | medium | high` 포함 확인 추가 | `test/cli-help.test.js:418-432` |
| `test/subagents.test.js` | 규칙 문서 단언 | Modify | 1항 Codex·`fork_turns`·slug | 1항에 다섯 고정 문장 포함·옛 상속 문장 부재 단언 추가, `rules/cli.md`·`docs/configuration.md` 문구 단언 추가 | `test/subagents.test.js`의 `Codex slug dispatch → item 1 requires fork_turns "none" with the model` |

#### Constraints

- init은 새 저장소에만 새 키를 쓴다. 기존 config 재작성 경로를 추가하지 않는다.
- init 예시의 모든 등급 값은 `"inherit"`이다(모델 고정 금지, `init.ts:153-155` 계약). 예시 `roles`는 다섯 에이전트 모두 `{ tier: "standard", effort: "medium" }`이다(사용자 결정: 모든 에이전트 effort medium).
- `test/init.test.js`의 `init → writes the exact config.json shape`(`:125`)는 기존 `subagents` 기대값을 그대로 두고 `model_tiers`·`roles` 두 키만 더한다. `test/cli-help.test.js`의 `config --help/-h → subagents 키를 stdout에 출력하고 다른 argv는 거부한다`(`:418`)와 `test/subagents.test.js`의 기존 단언은 바꾸지 않고 추가만 한다.
- `rules/subagent-model.md`의 4항(fallback payload)·5항(coordinator)은 바꾸지 않는다.
- `cli-config-command.ts:21-22` 주석은 이번 범위에서 고치지 않는다.
- `rules/cli.md:254-256`, `skills/bouncer-run/references/agent-dispatch.md`, `rules/cursor-print-dispatch.md`는 바꾸지 않는다. 플래그 없는 한 줄 출력과 `result.model`이 그대로이고, exit 1·effort 알림은 `rules/subagent-model.md` 1항이 단일 소유한다.

### runtime-architecture/model-tiers-effort/004

#### Goal & intent

세 구현 task가 통합된 integration worktree에서 `npm run ci`(check:emit·lint·lint:docs·typecheck·coverage·전체 테스트)가 통과함을 증명한다. epic Success criteria 7·15의 종단 판정이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.