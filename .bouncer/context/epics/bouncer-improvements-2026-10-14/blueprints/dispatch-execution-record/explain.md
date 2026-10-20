---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/bouncer-improvements-2026-10-14/blueprints/dispatch-execution-record/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T17:14:30.431+09:00'
bouncer:
  id: EXPLAIN-dispatch-execution-record
  epic_id: bouncer-improvements-2026-10-14
  blueprint_id: dispatch-execution-record
  status: published
  comprehension:
    - range_from: 462d8c38a0c59a340086fc0ddb14687eb188d39a
      range_to: 8bf4d6359404e5bf6754d72df70d54266de2fe99
      diff_sha: 1e10c6b771a92edf9d1e185ba2bcda769336f192c6783c6a31df29857584f8dc
      recorded_at: '2026-10-14T17:20:00+09:00'
  task_commits:
    - task: bouncer-improvements-2026-10-14/dispatch-execution-record/001
      sha: '92364957'
      intent_anchor: task-001
    - task: bouncer-improvements-2026-10-14/dispatch-execution-record/002
      sha: 2092efdd
      intent_anchor: task-002
    - task: bouncer-improvements-2026-10-14/dispatch-execution-record/003
      sha: 8bf4d635
      intent_anchor: task-003
---
# Explain

## Background

서브에이전트 디스패치가 "시작됨" 알림만 돌려줄 때도 metrics 세션이 닫히거나 완료로 취급되어, 토큰·시간 기록이 비는 일이 있었다. 또 워커에 어떤 모델을 넘겼는지는 설정과 실제 디스패치를 대조할 방법이 없었다. 이 변경은 완료 판정 규칙을 문서에 못박고, coordinator가 워커에 넘긴 모델을 원장에 남기게 한다.

## Intuition

택배 "접수 완료" 문자를 배송 완료로 치지 않고 수령 확인이 와야 닫는다. 그리고 송장에 어떤 차량(모델)으로 보냈는지 적어 두어, 나중에 계약(설정)과 맞춰 본다.

## Code

- `rules/subagent-model.md`, `skills/bouncer-run/SKILL.md`, `skills/bouncer-run/references/drive-metrics.md`, `skills/bouncer-plan/references/context-review.md`: 핸들·"started" 상태는 결과 보고가 아니며, 보고가 온 뒤에만 metrics를 닫는다. 모델 확인은 디스패치 전에 한다.
- `scripts/src/lib/coordinator.ts`, `scripts/src/lib/cli-git-commands.ts`: `coordinate worker-model` 서브커맨드. `--role`과 `--model`이 없거나 `--task`/`--perspective` 값이 비면 사용법 오류(exit 2)이며, 원장 펜스(`--ledger-path`/`--ledger-hash`)를 요구하는 명령이다. 검증을 모두 통과한 뒤에만 원장을 쓰고, 값은 trim해 저장한다. 리뷰어 perspective는 coordinator.ts 안의 상수 `WORKER_MODEL_REVIEW_PERSPECTIVES`로 검사하며, `validate-sections.ts`의 `REVIEW_PERSPECTIVE`와 어긋날 수 있다는 한계가 있다.
- `references/coordinator-cards/*.md`: 카드가 모델 기록 절차를 안내한다. implementer를 `inherit`로 재시도하면 `coordinate dispatch`가 `dispatch-already-active`로 거절되므로 원장에는 처음 넘긴 slug가 남고, 재시도는 `coordinate record` 결정 문구에 적는다.
- 검증: `npm run ci` 통과, 증적은 prepare digest의 `evidence` 참조.

## Quiz

아래 질문에 한 번에 답한다. 정답과 응답은 파일에 적지 않는다.

1. 서브에이전트가 "started" 상태와 task id만 돌려준 시점에서 metrics 세션은 어떻게 해야 하는가?
   - A) 바로 `metrics end`로 닫는다.
   - B) 결과 보고가 올 때까지 기다린 뒤 닫는다.
   - C) 토큰을 추정해 채워서 닫는다.
2. `coordinate worker-model`에 `--role`을 빼고 호출하면?
   - A) 사용법 오류로 exit 2, 원장은 쓰지 않는다.
   - B) 기본 역할로 기록하고 exit 0.
   - C) 원장에 `null` 모델로 기록한다.
3. implementer 디스패치를 `inherit`로 다시 시도했을 때 원장의 모델 기록은?
   - A) 새 slug로 덮어쓴다.
   - B) 두 slug를 모두 배열로 남긴다.
   - C) 처음 넘긴 slug가 남고, 재시도는 결정 문구에만 적는다.

## Tasks

### bouncer-improvements-2026-10-14/dispatch-execution-record/001 · `92364957`

#### Goal & intent

dispatcher(root·coordinator)가 결과 본문 없는 `completed`·대기 알림을 outcome으로 보지 않는다. `metrics end`는 hand-back 보고가 온 뒤 그 최종 알림 값으로 닫는다. `/bouncer-run` step 4는 coordinator dispatch 직전에 모델을 확인해 사용자에게 보고한다. 지연 로드 툴은 스키마를 먼저 로드한 뒤 호출한다.
수용 기준은 epic 성공 기준 23–25이고, 최종 검증 명령은 `npm run ci`다.

#### Current behavior

- `rules/subagent-model.md:53-58` item 6은 background handle·"started"·"running"·task id가 보고가 아니라고만 적는다. 결과 본문 없는 `completed` 알림과 `metrics end` 시점은 다루지 않는다. 지연 로드 툴·`ToolSearch` 안내는 배포 문서 어디에도 없다.
- `skills/bouncer-run/SKILL.md` step 4(약 114행)는 "per `rules/subagent-model.md`"로 규칙을 가리키기만 한다. `bouncer subagent-model --agent bouncer-coordinator` 실행·보고 단계가 없어 098/003 drive에서는 디스패치 뒤 사용자가 물은 다음에야 실행되었다.
- `skills/bouncer-run/references/drive-metrics.md:26-35` step 3은 "Immediately after the coordinator returns, pass what the host's task notification gave you"라고만 적는다. R2에서는 중간 알림의 값(92,430 토큰)으로, R3에서는 토큰 플래그 없이 세션을 닫았다. 099/003 retro는 agent 보고가 task-notification보다 먼저 와서 `metrics end` 순서가 어긋났다고 기록했다.
- `skills/bouncer-plan/references/context-review.md:48-53` **Metrics.** 문단은 "from the host's task notification right after it returns"로 같은 시점 규칙을 쓰고 drive-metrics.md를 가리킨다.
- 테스트 결합: `test/subagents.test.js`가 rule 항목을 번호 앵커로 자른다. 대상은 item 1(`/\n1\. Resolve[\s\S]*?(?=\n2\. )/`, 480–488행), item 4(`'4. When named agents are unavailable'`~`'\n5. '`, 620행), item 5(`'5. \`/bouncer-run\` resolves'`~`'\n\n'`, 588–596행, 467–475행)다. context-review.md는 fallback 문단('If named agents are unavailable'~`'\n\n'`, 537–547행)만 자른다. item 6 문구·step 4 문구·drive-metrics.md 문구를 고정하는 테스트는 없다.

#### Target behavior

- 성공:
  - item 6에 두 문장이 추가된다. 하나는 결과 본문 없는 `completed`·대기 알림이 outcome이 아니라는 것이고, 다른 하나는 `metrics end`와 다음 단계를 hand-back 보고가 올 때까지 미루고 최종 알림의 사용량 값으로 닫는다는 것이다.
  - 새 item 8은 지연 로드 툴의 스키마 로드 순서를 host 중립으로 적는다(예: Claude Code `ToolSearch` `select:<name>`).
  - step 4는 dispatch 직전 `bouncer subagent-model --agent bouncer-coordinator` 실행과 출력 보고를 한 단계로 갖는다.
  - drive-metrics.md step 3과 context-review.md **Metrics.**는 item 6의 최종값 기준을 따른다고 적는다.
- 실패: hand-back 보고 없이 알림만 왔을 때는 대기를 계속한다. 그 알림 값으로 `metrics end`를 호출하지 않는다.
- 보존: item 1–5·7의 번호와 문단 경계, item 7 opt-in 참조, "알림이 없으면 토큰 플래그 없이 닫는다"는 기존 규칙, 추정 금지 규칙은 그대로 둔다.

#### Interface

- 제공:
  - `rules/subagent-model.md` item 6의 완료 판정·최종 metrics 문장과 item 8 지연 로드 툴 규칙.
  - run step 4의 사전 모델 확인 단계. 출력 한 줄(slug 또는 `inherit`)을 사용자에게 그대로 보고한다.
  - drive-metrics.md·context-review.md의 최종값 참조.
- 거부:
  - 결과 본문 없는 `completed` 알림을 coordinator outcome 또는 reviewer 결과로 다루는 해석.
  - 중간 알림 값으로 닫은 `metrics end`.
  - item 1–7 번호 변경, item 5 안의 빈 줄.
- 용어 — **hand-back 보고**: dispatcher가 받은 하위 에이전트의 최종 결과 본문이다. 예: coordinator의 `completed`/`blocked`/`continue` outcome 보고, reviewer의 Findings.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/subagent-model.md` | `item 6`, `item 8` | Modify | named dispatch 모델·foreground 대기 공통 계약 | item 6에 완료 판정·최종 metrics 두 문장 추가, item 8로 지연 로드 툴 규칙 추가 | B-05·B-14가 모든 dispatcher에 적용되는 공통 규칙이고, item 7 뒤라 번호 앵커 테스트가 깨지지 않음 |
| `skills/bouncer-run/SKILL.md` | `4. **Coordinator dispatch.**` | Modify | coordinator dispatch 절차 | dispatch 직전 `subagent-model` 실행·보고 단계 추가 | B-07: 규칙을 가리키기만 해서 사후에 실행됨 |
| `skills/bouncer-run/references/drive-metrics.md` | `## Per coordinator session` step 3 | Modify | coordinator 세션 metrics 기록 절차 | hand-back 보고 뒤 최종 알림 값으로 닫는다는 기준과 item 6 참조 추가 | R2·R3에서 중간값·빈값으로 닫힘 |
| `skills/bouncer-plan/references/context-review.md` | `**Metrics.**` 문단 | Modify | context-review reviewer 호출 metrics 기록 | "right after it returns"를 hand-back 보고 뒤 최종값 기준으로 바꿈 | 사용자 결정: run과 context-review에 함께 적용 |
| `test/subagents.test.js` | 신규 추출 지점: item 6·8 문장 검사 | Modify | subagent-model 규칙 번호·문단 계약 테스트 | item 6의 `completed`·`metrics end` 문장, item 8의 지연 로드 문장 존재 검사 추가 | 공통 규칙 회귀 방지, 기존 파일이라 tier 등록 불필요 |
| `test/skill-bouncer-run.test.js` | 신규 추출 지점: step 4 모델 확인 검사 | Modify | run 스킬 기계 계약 테스트 | step 4 구간에 `bouncer subagent-model --agent bouncer-coordinator` 명령이 있는지 검사 추가 | 명령 문자열은 기계 계약이라 문장 고정 금지 원칙과 충돌하지 않음 |

#### Constraints

- item 1–7의 번호, 각 항목의 시작 문구(`1. Resolve`, `4. When named agents are unavailable`, `5. \`/bouncer-run\` resolves`), item 5의 단일 문단을 유지한다. item 5에는 'start selection', 'autonomy', 'base SHA'를 넣지 않는다.
- context-review.md의 **Metrics.** 문단을 fallback 문단('If named agents are unavailable')과 합치지 않는다.
- `rules/subagent-model.md`를 어떤 workflow의 **Master rules** 블록에도 추가하지 않는다(test/skill-bouncer-surface.test.js).
- 토큰·시간 값을 추정하지 않는다는 drive-metrics.md 규칙과 "알림이 없으면 플래그 없이 닫는다" 규칙을 유지한다.
- 규칙 문서는 영어로 쓰는 기존 관례를 따른다. 테스트 이름은 `입력 → 결과` 화살표 형식을 지킨다(`scripts/check-test-names`).

### bouncer-improvements-2026-10-14/dispatch-execution-record/002 · `2092efdd`

#### Goal & intent

coordinator가 implementer·reviewer·debugger를 dispatch할 때 넘긴 모델 인자(`bouncer subagent-model --agent <name>` 출력 한 줄)가 coordinator 원장에 남는다. 사후에 `config.json` 설정과 대조할 수 있다.
수용 기준은 epic 성공 기준 26–28이고, 최종 검증 명령은 `npm run ci`다.

#### Current behavior

- 원장 타입: `scripts/src/lib/coordinator.ts:70-73` `DispatchState`와 :74-77 `DispatchDecision`에 `model`이 없다. `Task.decisions`·`Ledger.decisions`는 `unknown[]`이다(:101, :109). decision kind 열거나 kind 검증은 없다. `runtime-state.ts:214-228` `validDispatch`는 알려진 키만 검사하므로 추가 키를 받아들인다.
- dispatch: `coordinator.ts:3697-3745`가 attempt를 연다. :3719-3722에서 `item.dispatch`를 쓰고 :3723-3726에서 `DispatchDecision`을 만든다. 응답 `metadata`(:3729-3740)는 attempt·hash·base_head·initial_worktree_state·previous_outcome뿐이다. `test/coordinator.test.js:1652`가 이 `metadata`를 deepStrictEqual로 고정한다. `projectActiveTask`(:631)는 `{...task.dispatch}`를 복사하므로 dispatch 상태의 새 키가 checkpoint `active_tasks[].dispatch`에 그대로 나온다.
- fence 명령 목록이 두 곳에 있다. core `LEDGER_FENCED_COMMANDS`(:47-50)에 없으면 `unknown-coordinate-command`(:3296-3298)다. CLI `fencedCommands`(`cli-git-commands.ts:680-683`)는 path·hash가 없으면 `ledger-checkpoint-invalid`로 exit 1이다. `promotion_stopped` 원장은 promote-stop 외 변경을 거절한다(:3388).
- CLI: `parseFlags`(`cli-flags.ts:7-27`)는 값 없는 플래그를 `true`로 둔다. `cmdCoordinate`가 `--lease-id`·`--generation`·`--summary`를 읽고(:715-725), 필수 플래그 누락은 `failCoordinateUsage`로 exit 2다. core 호출은 :896-922다. 함께 바꿀 목록은 `COORDINATE_COMMANDS`(:310-314), 명령 열거 오류 문자열(:687-689), `COORDINATE_USAGE_BLOCKS`(`Record<CoordinateCommand,…>`, dispatch 블록 :363-372), `COORDINATE_REGISTRY_ORDER`(:560-564), `COORDINATE_USAGE_OVERVIEW`(:325-328)다. `--kind`는 repair 전용이다(:745-761).
- 기록만 하는 fenced 명령의 기존 예: critical-recovery·session-open 분기다. decision을 task와 원장에 추가하고 `commitWrite()` 뒤 `withCheckpoint(...)`(:708-712)로 응답한다. revoke·critical-recovery는 `ensureIntegrationCwd`로 integration cwd만 받는다.
- 이유 문자열마다 `COORDINATE_FAILURE_HINTS`(약 :3895) 항목이 있어야 한다(`test/coordinator.test.js:120-124`).
- 관찰자: `projectCheckpoint`(:667-672)는 string `task`를 가진 미통합 task decision을 `unresolved_decisions`에 넣는다. `drive-metrics.ts:20-22` `EXCEPTION_KINDS`, `finalize-digest.ts:527-532`(accepted report만), `coordinate-next.ts:908-920`(report만)은 kind를 걸러 읽으므로 새 kind의 영향을 받지 않는다.
- 값의 출처: `subagent-model`(`cli-project-commands.ts:232-251`)은 `result.model ?? 'inherit'` 한 줄을 출력한다. slug 형식 검증기는 없다. reviewer 관점 열거는 `validate-sections.ts:50-56` `REVIEW_PERSPECTIVE`다(combined, spec_scope, correctness_tests, minimality_maintainability, security).
- 카드: `coordinate next`는 dispatch argv를 미리 만들되(`coordinate-next.ts:771`, :809) blueprint·fence·lease 인자만 넣는다. dispatch는 `AUTO_ACTIONS`가 아니라 coordinator가 실행한다. `references/coordinator-cards/implement.md:6`·`review.md:7`·`verify.md:14`는 "through `rules/subagent-model.md`"로 dispatch만 지시한다. `final_review.md`는 blueprint 단위 최종 리뷰라 task가 없다. `review.md`는 ```json 펜스가 정확히 2개여야 한다(`test/review-record.test.js:353-367`).
- 재현: 현재 `bouncer coordinate dispatch --help`에 `--model`이 없다. `bouncer coordinate worker-model --help`는 알 수 없는 명령으로 실패한다.

#### Target behavior

- 성공:
  - `coordinate dispatch ... --model <값>`은 `item.dispatch.model`과 dispatch decision의 `model`에 값을 쓴다. 응답 `metadata`·`report_path` shape는 그대로다.
  - `coordinate worker-model`은 fence와 integration cwd가 맞으면 decision `{ kind: 'worker-model', role, model, task?, perspective? }`를 원장 `decisions`에 추가한다. `--task`가 있으면 그 task의 `decisions`에도 추가한다. 응답은 `{ ok: true, command: 'worker-model', decision, checkpoint }`다.
  - 카드는 implementer·reviewer·debugger dispatch 직전에 `bouncer subagent-model --agent <name>`을 실행하라고 적는다. 그 출력을 implementer는 `coordinate dispatch --model`로, reviewer·debugger는 `coordinate worker-model`로 기록한다. slug 거절로 `inherit` 재시도(`rules/subagent-model.md` item 3)를 했다면 재시도 값을 다시 기록한다.
- 실패:
  - 플래그 누락과 빈 값은 다르게 다룬다.
    - **누락**은 CLI에 플래그 자체가 없는 경우다. worker-model의 `--role`·`--model`·fence 플래그 누락은 core 호출 전 exit 2 usage 오류다. dispatch의 `--model` 누락은 오류가 아니며 기록하지 않는다.
    - **빈 값**은 플래그가 있는데 값이 없어 `parseFlags`가 `true`로 둔 경우, 또는 trim 후 빈 문자열인 경우다. dispatch와 worker-model 모두 core가 `model-invalid`(exit 1)로 거절한다. dispatch는 attempt를 열지 않는다.
  - worker-model 거절 reason:
    - role 오류 → `worker-model-role-invalid`
    - model 빈 값 → `model-invalid`
    - perspective가 reviewer 외 role에 붙거나 `REVIEW_PERSPECTIVE` 밖 → `worker-model-perspective-invalid`
    - fence 불일치 → 기존 stale reason
    - integration cwd 밖 → 기존 cwd reason
    - 원장 밖 task → `task-outside-blueprint`
    - `promotion_stopped` → 기존 거절
  - 모든 거절은 원장을 바꾸지 않는다.
- 보존:
  - `--model` 없는 dispatch는 `model` 키 없이 지금과 같은 원장·응답을 낸다.
  - `model` 키 없는 기존 원장도 그대로 읽힌다.
  - worker-model은 dispatch·lease·status·attempt를 바꾸지 않는다.
  - finalize digest와 metrics 예외 계산 결과는 바뀌지 않는다.
  - `projectCheckpoint`는 바꾸지 않는다. `--task`를 준 worker-model decision은 미통합 task의 `dispatch`·`report` decision과 같이 checkpoint `unresolved_decisions`에 나타난다. 이 목록은 미판정 결정이 아니라 미통합 task의 모든 decision을 담는 관찰값이다. coordinator 판단은 `coordinate next`의 action과 `lastReportedOutcome`(report만 읽음)이 정하므로 새 kind가 판단을 바꾸지 않는다. `--task` 없는 decision은 이 목록에 나타나지 않는다.

#### Interface

- 제공:
  ```text
  bouncer coordinate dispatch --blueprint <dir> --task <ddd> --ledger-path <p> --ledger-hash <h>
      [--repo <main>] [--lease-id <id> --generation <n>] [--model <value>]
  bouncer coordinate worker-model --blueprint <dir> --role <reviewer|debugger> --model <value>
      --ledger-path <p> --ledger-hash <h> [--task <ddd>] [--perspective <name>]
  ```
  ```ts
  type DispatchState = { /* 기존 필드 */ model?: string };
  type DispatchDecision = { /* 기존 필드 */ model?: string };
  type WorkerModelDecision = {
    kind: 'worker-model'; role: 'reviewer' | 'debugger'; model: string;
    task?: string; perspective?: string;
  };
  ```
- 거부:
  - 즉시 실패, 원장 불변(exit 1): `model-invalid`(빈 값), `worker-model-role-invalid`, `worker-model-perspective-invalid`, 기존 fence·cwd·task·`promotion_stopped` reason. 새 reason마다 `COORDINATE_FAILURE_HINTS` 항목을 둔다.
  - usage 오류(exit 2, core 미호출): worker-model의 `--role`·`--model`·fence 플래그 누락.
- 용어 — **모델 인자**: `bouncer subagent-model --agent <name>` 출력 한 줄. slug(예: `claude-sonnet-5-5`) 또는 `inherit`이다. coordinator가 dispatch에 넘긴 값일 뿐 host가 그 모델로 실행했다는 증명은 아니다. CLI는 slug 형식을 검증하지 않고 trim 후 비어 있지 않은지만 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `DispatchState`, `DispatchDecision`, `LEDGER_FENCED_COMMANDS`, `coordinate`, `COORDINATE_FAILURE_HINTS` | Modify | coordinator 원장 변경·fence·reason 힌트 | dispatch에 `model` 기록, `worker-model` 분기·decision 타입·새 reason 힌트 추가 | 원장 기록의 단일 소유 모듈 |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_COMMANDS`, `fencedCommands`, `COORDINATE_USAGE_BLOCKS`, `COORDINATE_REGISTRY_ORDER`, `COORDINATE_USAGE_OVERVIEW`, `cmdCoordinate` | Modify | coordinate CLI 파싱·usage·fence 플래그 검사 | `--model`·`--role`·`--perspective` 파싱, `worker-model` 명령·usage 등록 | 세 명령 목록과 usage registry가 같이 바뀌어야 함 |
| `rules/cli.md` | coordinate 동사 목록·dispatch 절 | Modify | CLI 명령 계약 문서 | 동사 목록에 `worker-model`, dispatch `--model`과 worker-model 절 추가 | 문서화된 CLI 계약과 구현 일치 |
| `references/coordinator-cards/dispatch.md` | `coordinate dispatch` 항목 | Modify | dispatch action 카드 | dispatch argv에 `--model <subagent-model 출력>`을 붙이라는 지시 추가 | dispatch argv에 `--model`이 미리 들어가지 않음 |
| `references/coordinator-cards/implement.md` | `Dispatch named bouncer-implementer` 항목 | Modify | implementer dispatch 카드 | 모델 확인과 `--model` 기록 연결 지시 추가 | implementer 모델 기록 지점 |
| `references/coordinator-cards/review.md` | `Dispatch named bouncer-reviewer` 항목 | Modify | per-task review 카드 | 관점별 reviewer dispatch마다 `worker-model --role reviewer --perspective` 기록 지시 추가 | reviewer 모델 기록 지점(json 펜스 추가 금지) |
| `references/coordinator-cards/final_review.md` | reviewer dispatch 항목 | Modify | blueprint 최종 리뷰 카드 | `--task` 없는 `worker-model --role reviewer` 기록 지시 추가 | 신규 blueprint 기본 `review_scope: blueprint`에서 reviewer가 도는 곳 |
| `references/coordinator-cards/verify.md` | `Dispatch named bouncer-debugger` 항목 | Modify | verify 실패 debugger 카드 | `worker-model --role debugger --task` 기록 지시 추가 | debugger 모델 기록 지점 |
| `test/coordinator.test.js` | 신규 추출 지점: dispatch model·worker-model core 테스트 | Modify | coordinator core 계약·hint 커버리지 | `model` 기록·생략, worker-model 성공·거절·불변 테스트 추가 | core 계약 회귀 방지, tier 등록 완료 파일 |
| `test/cli-coordinate.test.js` | 신규 추출 지점: CLI 플래그·usage 테스트 | Modify | coordinate CLI 통합 테스트 | `--model` 파싱, worker-model fence·usage exit 2·usage 목록 테스트 추가 | session-open 테스트(:1022-1076)를 틀로 씀 |
| `test/cli-help.test.js` | `COORDINATE_SUBCOMMANDS` | Modify | coordinate 하위 명령 help 테스트 | `worker-model` 추가 | 하위 명령 help 접두어 계약 |

#### Constraints

- 기존 dispatch 응답 `metadata`·`report_path` shape와 `test/coordinator.test.js:1652` deepStrictEqual 결과를 유지한다.
- `worker-model`은 core `LEDGER_FENCED_COMMANDS`와 CLI `fencedCommands`에 모두 넣는다. `COORDINATE_USAGE_BLOCKS`에 블록을 둔다(타입 오류 방지).
- 새 reason 문자열마다 `COORDINATE_FAILURE_HINTS` 항목을 둔다.
- 카드 `review.md`에 ```json 펜스를 추가하지 않는다. `## Finding status` 절과 문구는 유지한다.
- 실패한 명령은 원장을 쓰지 않는다. `commitWrite()`는 검증을 모두 통과한 뒤에만 호출한다.
- 주석·docstring은 `references/coding-standards/index.md`의 한국어 계약을 따르고, 테스트 이름은 `입력 → 결과` 형식을 지킨다.
- TS 변경 뒤 `npm run build`를 실행한다. `scripts/lib/`는 stage하지 않는다.

### bouncer-improvements-2026-10-14/dispatch-execution-record/003 · `8bf4d635`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/coordinator.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `references/coordinator-cards/dispatch.md` — 기록된 CI 실패를 복구한다.
- Modify `references/coordinator-cards/implement.md` — 기록된 CI 실패를 복구한다.
- Modify `test/coordinator.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/cli-coordinate.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.