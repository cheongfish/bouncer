---
type: bouncer.explain
title: retro-implementer-docs-advance-tokens explain
description: Explain for retro-implementer-docs-advance-tokens
resource: .bouncer/context/epics/drive-execution/blueprints/retro-implementer-docs-advance-tokens/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-31T19:06:57.075+09:00'
bouncer:
  id: EXPLAIN-retro-implementer-docs-advance-tokens
  epic_id: drive-execution
  blueprint_id: retro-implementer-docs-advance-tokens
  status: published
  comprehension:
    - range_from: 84fae254b47d5220eeb29d21c995fcafe97f864b
      range_to: 50ba33793ef28bad2c87cb48c89bec15d893010c
      diff_sha: 37b462d86e2e708169184c9cc461dc57b8e0a335d44c1fe03e59d5ac2ec79793
      recorded_at: '2026-10-31T19:07:55.572+09:00'
  task_commits:
    - task: drive-execution/retro-implementer-docs-advance-tokens/001
      sha: 2ecd8691
      intent_anchor: task-001
    - task: drive-execution/retro-implementer-docs-advance-tokens/002
      sha: 043bb3d5
      intent_anchor: task-002
    - task: drive-execution/retro-implementer-docs-advance-tokens/003
      sha: 0f1c701d
      intent_anchor: task-003
    - task: drive-execution/retro-implementer-docs-advance-tokens/005
      sha: 50ba3379
      intent_anchor: task-005
---
# Explain

## Background

앞선 드라이브(worker-tokens 중복 기록 거절)를 돌리면서 같은 종류의 마찰이 네 번 드러났다. 이 변경은 그중 문서로 막을 수 있는 셋과, 기계가 잡을 수 있는 하나를 함께 고친다.

- 구현자가 보고 `## Tests`에 "fails before the change" 같은 서술을 적으면 `fail`로 시작하는 낱말 때문에 `report-tests-invalid`로 거절되고, 같은 보고를 다시 써야 했다.
- 구현자 `worker-model` 기록의 `--model` 값이 코디네이터에 따라 `inherit`(구현자 파일 frontmatter)이거나 `subagent-model` 출력(`claude-haiku-5-5`)이어서 기록이 갈렸다.
- Claude Code에서 코디네이터의 최종 `<task-notification>`은 hand-back보다 늦게 오고, 먼저 오는 중간 알림의 `subagent_tokens`는 최종값보다 작다. 중간값으로 `metrics end`를 호출하면 세션이 작은 값으로 닫히고 되돌릴 수 없다.
- `coordinate advance`를 `--task` 없이 부르면 task 키의 `worker-tokens-missing` 검사를 건너뛰어, 구현자 토큰이 빠진 채 다음 단계로 넘어갈 수 있었다.

## Code

- `agents/bouncer-implementer.md`, `.codex/agents/bouncer-implementer.toml` — Guardrails에 한 항목이 더해졌다. `## Tests`에는 지정된 명령과 `12 pass, 0 fail (exit 0)` 같은 통과 줄만 적고, `fail`로 시작하는 다른 낱말, `error`/`errors`, `실패`, `오류`, 0이 아닌 `exit` 코드는 거절되니 실패 서술은 `## Red run`에 쓴다. Codex TOML은 `.md`에서 재생성한 것이며, `check:emit`이 스테이징된 생성본을 보므로 커밋 전에 스테이징해야 통과한다.
- `skills/bouncer-run/references/agent-dispatch.md` — 구현자 `worker-model` 기록의 `--model` 값은 dispatch에 쓴 `bouncer subagent-model --agent bouncer-implementer` 출력과 같아야 하며, 구현자 파일 frontmatter의 `inherit`가 아니다. 코드 검사(거절·경고)는 더하지 않고 문구만 고쳤다.
- `skills/bouncer-run/references/drive-metrics.md` — Claude Code 행에서 "중간 알림에는 없다"는 문구를 "hand-back에는 없다"로 고쳤고, 중간 `subagent_tokens`(121778)가 최종값(149495)보다 작으니 `metrics end`에 중간값을 쓰지 말라는 문단을 표 아래에 더했다.
- `packages/cli/src/coordinator-commands.ts` — `workerTokensGuard`의 범위 판정 `keep`이 `(task, role)`을 받는다. 범위는 task 없는 키, `--task`로 지정한 task의 키, 그리고 모든 task의 구현자 키다. 구현자 기록은 worker가 끝난 뒤에 남으므로 미충족이면 그 worker는 이미 끝난 것이라 병렬 wave 중이어도 안전하다. reviewer·debugger의 다른 task 키는 아직 실행 중일 수 있어 기존대로 보지 않는다. `rules/cli.md`가 같은 범위를 문서화한다.
- 알려진 한계: 구현자 `worker-model` 기록이 아예 없으면 `runs`가 0이라 이 guard가 잡지 못한다(범위 밖으로 명시). 문서 문구 테스트는 부분 문자열 일치라 문구를 바꾸면 테스트도 함께 바꿔야 한다. 마지막에 추가한 숫자 채움 회귀 테스트는 변경 전에도 green이라 결함을 잡는 red 근거는 없다.

## Quiz

1. `coordinate advance`를 `--task` 없이 호출했는데, task 001 구현자의 `worker-model` 기록이 있고 토큰은 아직 채워지지 않았다. 어떻게 되나?
   - A) `--task`가 없으므로 task 키는 검사하지 않아 그대로 진행한다.
   - B) 구현자 키는 task와 무관하게 검사하므로 `worker-tokens-missing`으로 거절된다.
   - C) `--task`를 지정하라는 usage 오류(exit 2)가 난다.
2. 같은 호출에서 task 001의 reviewer 키에 토큰이 아직 없다면?
   - A) 병렬 wave에서 reviewer가 실행 중일 수 있어 검사 범위에 넣지 않으므로 거절되지 않는다.
   - B) 구현자와 똑같이 `worker-tokens-missing`으로 거절된다.
   - C) reviewer 기록이 있으면 `--task`를 지정해야 한다는 usage 오류가 난다.
3. `scoped_terminal` 보고의 `## Tests`에 다음 중 어느 내용이 들어 있어야 거절되지 않나?
   - A) 지정된 명령과 `12 pass, no failures`
   - B) 지정된 명령과 `12 pass; fails before the change, passes now`
   - C) 지정된 명령과 `12 pass, 0 fail (exit 0)`
4. 구현자를 dispatch한 뒤 `coordinate worker-model --role implementer`의 `--model` 값으로 써야 하는 것은?
   - A) 구현자 파일 frontmatter의 `inherit`
   - B) 그 dispatch에 쓴 `bouncer subagent-model --agent bouncer-implementer`의 출력
   - C) 코디네이터 자신의 모델
5. Claude Code에서 코디네이터가 hand-back을 보냈는데 "자체 백그라운드 작업을 기다리는 중"이라는 중간 `<task-notification>`이 먼저 와 `subagent_tokens`가 보였다. `metrics end`는 언제 호출하나?
   - A) 그 중간 알림의 값으로 즉시 호출한다.
   - B) hand-back 직후 토큰 없이 호출한다.
   - C) 같은 에이전트의 최종 `<task-notification>`이 도착했을 때 그 값으로 호출한다.

## Tasks

### drive-execution/retro-implementer-docs-advance-tokens/001 · `2ecd8691`

#### Goal & intent

`scoped_terminal` blueprint에서 implementer가 `## Tests`에 `fails before the change` 같은 서술을 적으면 `coordinate report`가 `report-tests-invalid`(`result-failed`)로 거절한다. PR #305 drive의 TASKS-002 보고가 낱말 `fails` 때문에 두 번 거절됐다. 거절 사유는 문서 세 곳에 있으나 낱말 제약을 미리 알려 주는 문장은 없다. 완료 뒤 implementer 문서 Guardrails가 이 제약과 대체 표기를 한 줄로 말하고, 테스트가 그 문장을 고정한다.

수용 기준:
- `agents/bouncer-implementer.md` Guardrails에 아래 Checklist의 문장이 그대로 있다.
- `.codex/agents/bouncer-implementer.toml`이 새 md에서 다시 만든 생성본과 바이트 일치한다.
- 문장을 지우면 `test/implementer-lint-step.test.js`의 새 테스트가 실패한다.
- 문장의 낱말 범위는 `coordinator-fanin.ts:105-111`의 정규식 `/\b(?:fail\w*|errors?)\b|실패|오류|exit(?:\s+code)?\s*[:=]?\s*[1-9]/i`와 같다(`error`는 낱말 `error`·`errors`만, 비0 exit도 거절).
- 검증 명령은 `node scripts/verify-implementer-tests-word-doc.js`다.

#### Current behavior

- 거절 규칙은 `packages/cli/src/coordinator-fanin.ts:82-114` `testsReportProblem`(`noZero` 105, `result-failed` 111)이다. `## Tests` 본문에 통과 표지(`pass`·`ok`·`exit 0`·`통과`)가 있어야 하고, `0 fail`·`fail 0`·`no error`·`실패 0`을 지운 뒤에도 `fail*`·`error(s)`·`실패`·`오류`·`exit` 비0이 남으면 `result-failed`다. 서술문 안의 `fails`도 걸린다.
- `coordinate report --outcome accepted`는 이 판정을 `packages/cli/src/coordinator-commands.ts:1234`에서 `report-tests-invalid`로 돌려주고 원장을 쓰지 않는다.
- 문서 설명은 `agents/bouncer-implementer.md:154-156`(Tests에 명령과 결과를 쓴다, 없으면 `report-tests-invalid`), `references/coordinator-cards/report.md:18`, `rules/cli.md:409`, `skills/bouncer-run/SKILL.md:84`에 있다. 낱말 제약을 말하는 문장은 없다.
- Output contract 템플릿의 Tests 예시 `12 pass, 0 fail (exit 0)`(`agents/bouncer-implementer.md:211`)은 `0 fail`이 지워져 통과한다. `test/coordinator.test.js:2141` `filledImplementerReport`가 이 템플릿을 읽는다.
- 재현: `rg -n "fail" agents/bouncer-implementer.md`의 Guardrails 구간(154-173행)에 Tests 낱말 제약 문장이 없다. 이미 확인한 테스트: `node --test test/implementer-lint-step.test.js`는 현재 2개 모두 통과한다.

#### Target behavior

- 성공 경로: Guardrails에 새 문장이 있고, implementer가 Tests 절에 명령과 pass 줄만 적는다는 지시를 읽는다.
- 실패 경로: 문장이 빠지거나 Codex 생성본이 어긋나면 새 테스트와 `test/agents.test.js`의 TOML parity 테스트가 실패한다.
- 보존: 기존 Guardrails 문장(120자, eslint, verify 실행, `report-tests-invalid` 설명)과 Output contract 템플릿은 바뀌지 않는다. 런타임 판정 코드는 바뀌지 않는다.

#### Interface

- 제공: `agents/bouncer-implementer.md` `## Guardrails`의 불릿 하나. 기존 "Before you report, run the task `bouncer.verify` command ..." 불릿 바로 뒤에 둔다.
- 거부: Output contract 템플릿, 다른 role 문서, `references/coordinator-cards/report.md`, `rules/cli.md`에는 같은 문장을 복제하지 않는다. 새 CLI 코드·거절 사유를 만들지 않는다.
- 용어: 낱말 제약 대상은 `## Tests` 절 본문 전체다. 예: `fails before the change`는 거절되고 `12 pass, 0 fail (exit 0)`은 통과한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `## Guardrails` | Modify | 구현자 행동 규칙과 Tests 절 요구를 적는다 | 낱말 제약 불릿 하나 추가 | `agents/bouncer-implementer.md:154-156`, 거절 규칙 `coordinator-fanin.ts:105-111` |
| `.codex/agents/bouncer-implementer.toml` | 생성본 본문 | Modify | md의 Codex 생성본 | 새 md에서 다시 생성 | `test/agents.test.js:57-66` TOML parity, `.gitignore`가 이 사본만 추적 |
| `test/implementer-lint-step.test.js` | `guardrailsSection` 호출 테스트 | Modify | Guardrails 절 문장을 고정한다 | 새 문장 단언 테스트 하나 추가 | `test/implementer-lint-step.test.js:20-39`가 같은 절을 읽는다 |
| `scripts/verify-implementer-tests-word-doc.js` | `step`(신규) | Create | 없음 | 이 task 검증 래퍼 | `scripts/verify-coordinator-exit-doc.js`가 같은 모양의 역할 문서 task 래퍼 |

#### Constraints

- 새 문장은 영어이고 불릿 하나다. implementer 문서 제목 골격(`scripts/check-doc-shape.js`)을 바꾸지 않는다.
- Codex 생성본은 손으로 고치지 않고 아래 Checklist의 명령으로 만든다.
- 기존 단언은 바꾸지 않는다.

### drive-execution/retro-implementer-docs-advance-tokens/002 · `043bb3d5`

#### Goal & intent

PR #305 drive에서 두 가지 마찰이 났다. (a) 첫 coordinator는 구현자 dispatch를 `inherit`로 기록했고 둘째는 `bouncer subagent-model --agent bouncer-implementer` 출력(`claude-haiku-5-5`)을 썼다. 규칙 정본은 이미 `rules/subagent-model.md` item 1과 agent-dispatch 구현자 항목에 있으나, 완료 뒤에 남기는 `worker-model` 기록 문장은 `--model <value>`의 값을 따로 정의하지 않는다. 구현자 에이전트 파일의 frontmatter가 `model: inherit`(`agents/bouncer-implementer.md:4`)라 거기서 값을 가져오기 쉽다. (b) Claude Code에서 coordinator 인계 뒤 최종 `<task-notification>`이 중간 알림보다 늦게 오고 중간 `subagent_tokens`는 최종보다 작다(121778 대 149495). 완료 뒤 두 문서가 각각 한 문장으로 이를 막고 테스트가 두 문장 전체를 고정한다. 코드는 바꾸지 않는다.

수용 기준:
- agent-dispatch 구현자 항목에 아래 Checklist의 문장 (A)가 그대로 있다.
- drive-metrics에 문장 (B)가 있고, Claude Code 행이 "중간 알림은 토큰을 싣지 않는다"는 낡은 주장을 하지 않는다.
- 두 문장을 지우면 `test/skill-bouncer-run.test.js`의 새 테스트가 각각 실패한다.
- Claude Code 행의 "and intermediate notifications" 구절 수정은 문장 (B)와 같은 한 문장 문서 범위에 든다(행의 낡은 주장과 (B)가 서로 모순하지 않게 함께 고친다). 이 수정도 새 테스트가 고정한다.
- 검증 명령은 `node scripts/verify-run-docs-model-usage.js`다.

#### Current behavior

- `skills/bouncer-run/references/agent-dispatch.md:307-329` 구현자 항목은 `coordinate dispatch --model`에 출력 한 줄을 붙이라고 쓰고(314-320), 이어서 "The implementer's worker record is `bouncer coordinate worker-model ... --model <value> ... --tokens <n>`, written when the host reports the worker's tokens"(325-327)라고만 쓴다. 이 `<value>`가 무엇인지는 311-312행 문단 첫머리의 "Each record uses the value ... printed for that dispatch"에만 의존한다.
- `references/coordinator-cards/dispatch.md:16-20`과 `skills/bouncer-run/SKILL.md:156-157`은 dispatch 쪽 `--model`을 같은 출력으로 정의한다. 세 문장은 `test/skill-bouncer-run.test.js:272-292` 테스트가 고정한다. `worker-model` 기록 값을 고정한 문장은 없다.
- `rules/cli.md:310-312`는 `coordinate dispatch --model`이 "`bouncer subagent-model --agent <name>` output, a slug or `inherit`"라고 쓰고 `worker-model --model`의 값은 따로 쓰지 않는다. 이 task는 `rules/cli.md`를 바꾸지 않는다.
- `skills/bouncer-run/references/drive-metrics.md:35` Claude Code 행은 "The hand-back message and intermediate notifications carry none."이라고 쓴다. 행 구성은 `test/skill-bouncer-run.test.js:67-119`가 `<task-notification>`·`subagent_tokens` 일치로 고정한다. 중간 알림 토큰에 관한 문장은 없다.
- 재현: `rg -n "inherit" skills/bouncer-run/references/agent-dispatch.md`와 `rg -n "intermediate" skills/bouncer-run/references/drive-metrics.md`. 이미 확인한 테스트: `node --test test/skill-bouncer-run.test.js`가 현재 통과한다.

#### Target behavior

- 성공 경로: 구현자 항목이 `worker-model --model`의 값을 dispatch와 같은 `subagent-model` 출력 한 줄로 못박는다. drive-metrics가 최종 알림 시점과 중간 값 금지를 말한다.
- 실패 경로: 두 문장 중 하나가 빠지거나 바뀌면 새 테스트가 실패한다.
- 보존: 기존 세 정본 문장(`test/skill-bouncer-run.test.js:272-292`)과 호스트 usage 표의 행 구성, Codex·Cursor 행은 바뀌지 않는다. 다섯 진입점 문서가 `task-notification`을 다시 쓰지 않는 규칙(`test/skill-bouncer-run.test.js:121-135`)도 유지한다.

#### Interface

- 제공: agent-dispatch 구현자 항목의 문장 하나, drive-metrics 표 아래 문단 하나와 Claude Code 행의 한 구절 수정.
- 거부: `rules/subagent-model.md`, `rules/cli.md`, coordinator 카드, 진입점 문서에는 같은 문장을 복제하지 않는다. `worker-model` 기록의 모델 값 거절·경고 코드를 만들지 않는다(Out of scope).
- 용어: "중간 알림"은 coordinator가 인계하기 전 도착하는 `<task-notification>`, "최종 알림"은 인계 뒤 마지막에 도착하는 같은 에이전트의 `<task-notification>`이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Worker model and token records` 구현자 항목 | Modify | worker 모델·토큰 기록 규칙 정본 | `worker-model --model` 값 문장 (A) 추가 | `agent-dispatch.md:311-312`, `:325-327`, `rules/subagent-model.md:12-16` |
| `skills/bouncer-run/references/drive-metrics.md` | host usage 표 Claude Code 행과 표 아래 | Modify | 호스트별 최종 usage 출처·종료 시점 정본 | 행의 낡은 구절 수정, 문단 (B) 추가 | `drive-metrics.md:33-35`, 표 파싱 `test/skill-bouncer-run.test.js:70-88` |
| `test/skill-bouncer-run.test.js` | 신규 테스트 두 개 | Modify | 실행 문서 문구·구조를 고정한다 | 문장 (A)·(B) 전체를 단언하는 테스트 추가 | `test/skill-bouncer-run.test.js:272-292`가 같은 방식의 선례 |
| `scripts/verify-run-docs-model-usage.js` | `step`(신규) | Create | 없음 | 이 task 검증 래퍼 | `scripts/verify-coordinator-exit-doc.js`가 같은 모양의 문서 task 래퍼 |

#### Constraints

- 두 문장은 영어이고 기존 문단 흐름에 맞춰 한 문장씩만 더한다. 다섯 진입점 문서(`SKILL.md`, `rules/subagent-model.md`, `agents/bouncer-coordinator.md`, `rules/cursor-print-dispatch.md`, `agent-dispatch.md`)에 `task-notification`이 새로 들어가면 `test/skill-bouncer-run.test.js:121-135`가 깨지므로 (A)에는 그 낱말을 쓰지 않는다.
- 기존 단언은 바꾸지 않는다. Claude Code 행에서 고치는 것은 "and intermediate notifications" 구절 하나다.

### drive-execution/retro-implementer-docs-advance-tokens/003 · `0f1c701d`

#### Goal & intent

PR #305 drive에서 TASKS-005 implementer의 토큰 96315가 `worker-tokens`로 기록되지 않았는데도 `coordinate advance`가 `worker-tokens-missing`을 내지 않았다. 원인은 검사 범위다. `workerTokensGuard`는 task 없는 키와 `--task`가 가리키는 task의 키만 보는데(`packages/cli/src/coordinator-commands.ts:1340`), coordinator가 직렬 drive에서 `--task` 없이 `advance`를 부르면 task 범위 키(implementer 포함)가 검사에서 빠진다. 이 범위는 BP `retro-dispatch-model-tokens-deferred`가 병렬 wave에서 실행 중인 다른 task의 reviewer를 거절하지 않으려고 의도한 것이다. 그 이유는 구현자에게 해당하지 않는다. 구현자의 `worker-model` 기록은 worker가 끝난 뒤에 남으므로(`agent-dispatch.md:325-327`), 구현자 키가 미충족이면 그 worker는 이미 끝난 것이다. 완료 뒤 `advance`는 어느 형태로 불러도 모든 task의 구현자 키를 검사한다.

수용 기준:
- `--task` 없는 `advance`가 토큰 기록 없는 task 범위 구현자 키를 `worker-tokens-missing`(exit 1, `executed` 없음, `pending`에 키)으로 거절하고 원장 bytes가 그대로다.
- 같은 입력의 reviewer·debugger task 범위 키는 기존처럼 무시된다(`test/cli-coordinate.test.js` 기존 테스트 유지).
- 구현자 키가 숫자·`unreported`로 채워지면 거절하지 않는다.
- `rules/cli.md`의 검사 범위 문장이 새 동작을 말하고 테스트가 그 문장 전체를 고정한다.
- 검증 명령은 `node scripts/verify-advance-implementer-tokens.js`다.

#### Current behavior

- 검사 범위: `packages/cli/src/coordinator-commands.ts:1340` `workerTokensGuard`는 `pendingWorkerTokensIn(decisions, (t) => t === null || (task !== undefined && t === task))`를 부른다. `--task` 없이 부르면 task 있는 키는 모두 제외된다. `pendingWorkerTokensIn`(`:1277-1289`)의 `keep`은 task 하나만 받는다.
- 호출 경로: `packages/cli/src/coordinate-advance.ts:261-263`이 `advance` 시작 시 한 번 `workerTokensGuard({ repoRoot, blueprint, task: opts.task })`를 부른다. 이 경로는 원장을 쓰지 않는다.
- 키 규칙: `packages/cli/src/drive-metrics.ts:571-590` `pendingWorkerTokenKeys`는 키 `(task, role, perspective)`마다 `runs`(worker-model 수)가 `filled`(숫자 tokens 또는 `unreported`)보다 크면 미충족으로 낸다. 구현자 키는 `perspective: null`이다.
- 문서화된 현재 동작: `rules/cli.md:344-347`이 "`coordinate advance` without `--task` checks only the keys with no task"라고 쓰고, `test/coordinate-next.test.js:1864-1866`이 그 문장을 고정한다. `test/cli-coordinate.test.js:1128-1140`의 `CLI coordinate advance without --task ignores a tokenless task-scoped key → stops at worker`는 reviewer 키로 이 범위를 고정한다.
- 재현(구현자): `npm run build` 뒤 `test/cli-coordinate.test.js`의 `preparedDrive()`로 만든 drive에서 `worker-model --role implementer --model inherit --task 001`을 기록하고 `advance`(`--task` 없음)를 부르면 exit 0, `stop.reason: 'worker'`가 나온다. 목표는 exit 1 `worker-tokens-missing`이다.
- 이미 확인한 테스트: `node --test test/cli-coordinate.test.js test/coordinator.test.js test/coordinate-next.test.js` 통과 상태.
- 이 변경이 잡지 못하는 경우: 구현자 `worker-model` 기록이 아예 없으면 `runs`가 0이라 키가 나오지 않는다. 범위 밖이다.
- I/O 결합: `workerTokensGuard`가 원장을 읽는 file I/O는 `coordinator-commands.ts:1325`(`coordinatorLedger.loadLedger`)이고 모듈 상태는 없다. 테스트는 실제 임시 git 저장소 fixture를 쓴다.

#### Target behavior

- 성공 경로: `workerTokensGuard`가 task 없는 키, `task`가 같은 키, 그리고 role이 `implementer`인 모든 task의 키 중 미충족인 것을 모아 `worker-tokens-missing`으로 거절한다. `pending` 항목은 기존 모양 `{task, role, perspective}`이다.
- 실패(거절) 경로: 위 범위에 미충족이 있으면 `advance`가 `executed` 없이 exit 1로 거절하고 원장 bytes는 그대로다.
- 보존: reviewer·debugger의 task 범위 키는 task가 다르면 검사하지 않는다. `coordinate record --task <T>`의 범위(`coordinator-commands.ts:1384`)는 그대로다. 판정 불가(원장 부재·JSON 오류·decisions 비배열·경로 해석 실패)는 계속 `ok: true`다. `pendingWorkerTokenKeys`·`workerKeyState`·`metrics summary` 집계는 바뀌지 않는다.

#### Interface

- 제공: `workerTokensGuard(opts: { repoRoot: string; blueprint: string; task?: string })` 시그니처 불변. 반환 모양 `{ ok: true } | { ok: false; reason: 'worker-tokens-missing'; pending; cause; next }` 불변. 바뀌는 것은 어느 키를 미충족 후보로 보는가이다. `pendingWorkerTokensIn`의 범위 판정이 task뿐 아니라 role도 받는다(내부 함수, 이름은 구현자가 정한다).
- 거부: `coordinate record`의 범위를 넓히지 않는다. reviewer·debugger task 키를 새로 거절하지 않는다. 새 reason·CLI 플래그·원장 필드를 만들지 않는다.
- 용어: "구현자 키"는 `role: 'implementer'`인 `(task, role, perspective)` 키다. 형태 `{ task: '001', role: 'implementer', perspective: null }`, 예: `worker-model --role implementer --task 001 --model inherit`만 기록된 키.
- throw와 miss: guard는 던지지 않는다. 원장 읽기 오류(권한 등)만 기존처럼 던진다(`coordinator-commands.ts:1326-1331`, 변경 없음). 판정 불가 상태는 모두 `ok: true`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `workerTokensGuard`, `pendingWorkerTokensIn` | Modify | 미충족 worker 키를 task 범위로 걸러 `worker-tokens-missing`을 낸다 | 범위 판정에 role을 더해 구현자 키는 모든 task에서 포함 | `coordinator-commands.ts:1277-1289`, `:1340`, `coordinate-advance.ts:261-263`, `rg -n "workerTokensGuard" packages/cli/src test`로 호출처 확인 |
| `rules/cli.md` | worker-tokens 문단 | Modify | `worker-tokens-missing` 검사 범위 서술 | "only the keys with no task"를 고치고 구현자 키 문장 추가 | `rules/cli.md:344-347`, 핀 `test/coordinate-next.test.js:1864-1866` |
| `test/cli-coordinate.test.js` | 신규 CLI 테스트 | Modify | advance의 worker-tokens-missing CLI 계약 | 구현자 키 거절·채움 통과 테스트 추가 | 선례 `test/cli-coordinate.test.js:1067-1175` |
| `test/coordinator.test.js` | 신규 `workerTokensGuard` 테스트 | Modify | guard 범위 단위 테스트 | role×scope 셀별 테스트 추가 | 선례 `test/coordinator.test.js:2320-2329` |
| `test/coordinate-next.test.js` | `cli rules → name worker-tokens-missing` | Modify | rules/cli.md 문장 고정 | 세 번째 문장 기대값 교체 | `test/coordinate-next.test.js:1857-1872` |
| `scripts/verify-advance-implementer-tokens.js` | `step`(신규) | Create | 없음 | 이 task 검증 래퍼 | `scripts/verify-worker-tokens-duplicate-guard.js`가 같은 모양의 코드 task 래퍼 |

#### Constraints

- 기존 단언 변경은 하나뿐이다. `test/coordinate-next.test.js`의 테스트 `cli rules → name worker-tokens-missing`에서 세 번째 문장 기대값을 아래 Checklist의 새 문장으로 바꾼다. 다른 기존 단언(특히 reviewer 키 무시 테스트)은 바꾸지 않는다.
- 새 reason을 만들거나 `COORDINATE_FAILURE_HINTS`의 `worker-tokens-missing` 문구를 바꾸지 않는다(`test/cli-coordinate.test.js:1068-1073` 고정).
- 모든 ts 줄은 120자 이내이고 `eslint-disable`을 쓰지 않는다. 새·고친 함수는 한국어 docstring 계약(`references/coding-standards/index.md`)을 따른다.
- 병렬 wave 안전: 구현자 키를 넓혀도 실행 중 worker 때문에 거절되지 않는다는 근거는 구현자 기록이 완료 뒤에 남는다는 점(`agent-dispatch.md:325-327`, `agents/bouncer-coordinator.md`의 worker 보고 대기 규칙)이다. 이 task는 그 순서를 바꾸지 않는다.

### drive-execution/retro-implementer-docs-advance-tokens/004

#### Goal & intent

세 구현 task(001 implementer 문서, 002 run 문서 두 문장, 003 advance 구현자 토큰 검사)가 모두 통합된 상태에서 전체 CI가 통과함을 증명한다. 수용 기준은 epic Success criteria 8·13이다: 새 변경이 역할 TOML 생성본 동기화, `scripts/lib` 비추적, 한국어 브리프·커밋 규약을 지키고 종단 `npm run ci`를 통과한다. 검증 명령은 frontmatter `verify`의 `npm run ci`다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/retro-implementer-docs-advance-tokens/005 · `50ba3379`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- SS-001 (minor, spec_scope, must_fix) — test/coordinator.test.js#workerTokensGuard with a task-001 implementer key filled by numeric worker-tokens and no task → is ok — tasks/003 Checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/coordinator.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.