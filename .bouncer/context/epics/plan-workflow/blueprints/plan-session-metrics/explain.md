---
type: bouncer.explain
title: plan-session-metrics explain
description: Explain for plan-session-metrics
resource: .bouncer/context/epics/plan-workflow/blueprints/plan-session-metrics/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-28T09:46:41.073+09:00'
bouncer:
  id: EXPLAIN-plan-session-metrics
  epic_id: plan-workflow
  blueprint_id: plan-session-metrics
  status: published
  comprehension:
    - range_from: f053749e17b700b7ce330f18f85d74c643704bb5
      range_to: a3906764c4eccf87d68a10e852b0e39fa5840f84
      diff_sha: dd3b5e618e1c3d18c0cafe022a7179153a328df9107a0a536d265173ae9f2a66
      recorded_at: '2026-10-28T09:49:02.089+09:00'
  task_commits:
    - task: plan-workflow/plan-session-metrics/001
      sha: 8ebbd154
      intent_anchor: task-001
    - task: plan-workflow/plan-session-metrics/002
      sha: a3906764
      intent_anchor: task-002
    - task: plan-workflow/plan-session-metrics/003
      sha: e02c0154
      intent_anchor: task-003
---
# Explain

## Background

`drive-metrics.json`은 세션마다 모델만 남겼다. 등급(tier)과 effort가 없어서 plan coordinator 구조를 도입했을 때 비용이 어떻게 달라지는지 현재 기준선과 비교할 수 없었다. plan coordinator·planner 세션은 기록할 kind도 없었다. 이 변경은 모든 세션에 등급·effort를 남기고, plan 세션 kind를 더하고, 등급별 집계를 `metrics summary`에 넣는다.
`benchmarks/plan-review` fixture는 현행 CLI·gate 계약과 어긋나 실행되지 않았다. 이를 고치고 `npm run ci`에 포함해 다시 깨지면 CI에서 잡히게 했다.

## Code

- `packages/cli/src/drive-metrics.ts`
  - `SESSION_KINDS`에 `plan-coordinator-session`, `planner-session`을 추가했다.
  - plan kind는 blueprint가 아직 없을 때 시작하므로 `blueprint: null`로 열리고, `end --blueprint`에서 정확히 한 번 묶인다.
  - 묶이기 전에는 plan 세션을 끝낼 수 없고, 이미 묶인 세션이나 다른 kind에 `--blueprint`를 주면 거절한다.
  - `end`는 `--tier strong|standard|light`와 `--effort low|medium|high`를 받는다. 검증은 어떤 쓰기보다 먼저 끝나서 거절 시 파일 bytes가 변하지 않는다.
  - `summarize`는 kind마다 `by_tier`(strong·standard·light·unknown)를 만든다. tier 필드가 없거나 null인 이전 기록은 `unknown`으로 세고, 이미 계산된 tokens·cost만 더한다.
  - 한계: 잘못 묶인 plan 세션은 고칠 수 없다. 이 한계는 브리프가 받아들였다.
- `packages/cli/src/cli-metrics-command.ts`, `cli-usage.ts`, `rules/cli.md`: 새 kind와 플래그를 CLI와 문서에 반영했다.
- `skills/bouncer-run/references/drive-metrics.md`, `skills/bouncer-plan/references/context-review.md`: 세션 종료 시 tier·effort를 넘기라는 안내를 추가했다.
- `benchmarks/plan-review/*`, `test/plan-review-fixture.test.js`, `test/tiers.json`: fixture 기대값을 현행 gate 동작에 맞추고 CI 래퍼 테스트를 추가했다.

## Quiz

1. `metrics start --kind planner-session`을 `--blueprint` 없이 실행하면 어떻게 되는가?
   - A) `invalid-metrics-input`으로 거절한다.
   - B) `blueprint: null`인 세션이 열린다.
   - C) 현재 포인터의 blueprint가 자동으로 들어간다.
2. `blueprint: null`인 plan 세션을 `metrics end`로 끝낼 때 `--blueprint`를 주지 않으면?
   - A) blueprint 없이 끝나고 summary에서 `unknown`으로 센다.
   - B) 거절하고 세션은 열린 채로 남는다.
   - C) 가장 최근 blueprint에 자동으로 묶인다.
3. `by_tier`에서 tier 필드가 없는 이전 기록의 세션은 어디에 센다?
   - A) `light`
   - B) 집계에서 제외한다.
   - C) `unknown`

## Tasks

### plan-workflow/plan-session-metrics/001 · `8ebbd154`

#### Goal & intent

`drive-metrics.json`의 모든 세션이 등급(`tier`)과 effort를 저장하고, plan coordinator·planner 세션을 blueprint 없이 시작해 끝날 때 묶을 수 있으며, `metrics summary`가 kind별로 등급 분포를 낸다. 수용 기준은 epic Success criteria 18이고 검증 명령은 `node --test test/cli-metrics.test.js`다.

#### Current behavior

- kind는 `SESSION_KINDS = ['coordinator-session','context-review','root-direct-session']`뿐이다(`packages/cli/src/drive-metrics.ts:16`). 세션 타입에 tier·effort 필드가 없고 `blueprint: string`이 필수다(`drive-metrics.ts:26-53`, `:29`).
- `startSession`은 빈 blueprint를 `invalid-metrics-input`으로 거절하고(`drive-metrics.ts:206-207`), `context-review`를 뺀 모든 kind가 run coordinator 원장 snapshot을 `start`에 읽는다(`:227-231`).
- `endSession` 옵션은 토큰·cache·`model`·`hostDurationMs`·`pricing`뿐이고 오류는 `metrics-session-not-found`·`metrics-session-ended`다(`drive-metrics.ts:270-282`). `coordinator-session`만 끝 원장을 `resolveLedger(session.blueprint)`로 읽는다(`:306-321`).
- `readMetrics`는 각 세션의 `id`·`kind`·`blueprint`가 문자열이 아니면 파일 전체를 `metrics-file-invalid`로 거절한다(`drive-metrics.ts:97-101`). 파일은 pid 임시 파일 + rename으로 쓴다(`:106-111`).
- `summarize`는 `SESSION_KINDS` 각각을 `KindSummary`(`drive-metrics.ts:337-345`)로 채우고, `s.blueprint !== blueprint`인 세션을 건너뛴다(`:408`). 열린 세션은 `open`에만 센다(`:411-414`).
- CLI: `KINDS` 문자열(`packages/cli/src/cli-metrics-command.ts:19`), `USAGE`(`:21-26`), 플래그 화이트리스트 `FLAGS`(`:29-37`, `end`에 tier·effort·blueprint 없음). 모르는 플래그는 usage + exit 2(`:67-70`). `start`는 `--blueprint`와 `ledgerFor`가 해석되지 않으면 `invalid-metrics-input`(`:115-123`). `ledgerFor`는 경로에서 epic/blueprint id를 못 얻으면 null(`:83-90`).
- 도움말 정본은 `packages/cli/src/cli-usage.ts:36` `'metrics'` 문자열이다.
- 재현: `npm run build && node --test test/cli-metrics.test.js`는 현재 통과한다. `bouncer metrics end --id m-x --tier strong`은 모르는 플래그라 exit 2다.

#### Target behavior

- 성공:
  - `metrics end --tier <strong|standard|light> --effort <low|medium|high>`가 해당 세션에 `tier`·`effort`를 저장한다. 생략한 값은 `null`이다. 모든 kind에 적용된다.
  - `metrics start --kind plan-coordinator-session|planner-session`은 `--blueprint`를 생략할 수 있고, 생략하면 `blueprint: null`로 저장한다. 두 kind는 원장 snapshot을 읽지 않는다(`start`/`end` 키 없음). `--blueprint`를 주면 그대로 정규화해 저장하고 `ledgerFor` 해석을 요구하지 않는다.
  - `blueprint: null`인 plan 세션은 `metrics end --blueprint <dir>`로 정확히 한 번 묶인다. `<dir>`는 `start`와 같은 `normalizeBlueprint`로 정규화해 저장하고(끝 슬래시·역슬래시 정리), 경로 존재나 `ledgerFor` 해석은 검사하지 않는다. 잘못 묶인 세션은 고칠 수 없으며 그 세션은 해당 `summary --blueprint`에만 잡힌다(수용한 한계).
  - `metrics summary --blueprint <dir>`의 `kinds`에 두 새 kind가 나오고, 모든 kind 합계에 `by_tier: { strong, standard, light, unknown }`가 붙는다. 각 칸은 `{ sessions, tokens_total, cost_total }`이며 끝난 세션만 센다. `tier`가 `null`이거나 키가 없는 세션은 `unknown`이다. `tokens_total`·`cost_total`은 숫자만 더하고 시작값 0이다.
- 실패(모두 `{ ok: false, reason: 'invalid-metrics-input' }`, exit 1, 파일 bytes 불변):
  - `--tier`·`--effort`가 허용 집합 밖이다(대소문자 구분, 빈 문자열 포함).
  - `end --blueprint ""`(빈 문자열).
  - plan kind가 아닌 세션에 `end --blueprint`.
  - 이미 blueprint가 있는 plan 세션에 `end --blueprint`.
  - `blueprint: null`인 plan 세션을 `--blueprint` 없이 `end`.
  - plan kind가 아닌 kind를 `--blueprint` 없이 `start`(기존 동작 유지).
- 보존:
  - `readMetrics`는 plan kind 세션의 `blueprint: null`만 받아들이고, 다른 kind의 비문자열 blueprint는 지금처럼 `metrics-file-invalid`다.
  - tier·effort 키가 없는 옛 세션 파일이 그대로 읽히고 집계된다.
  - `context-review`의 `--target-digest` 규칙, `coordinator-session`의 원장 snapshot, `listCoordinatorSessions` 출력 키, `worker_tokens`·`cache` 집계는 바뀌지 않는다.

#### Interface

- 제공:
  - CLI: `metrics start --kind <coordinator-session|context-review|root-direct-session|plan-coordinator-session|planner-session> [--blueprint <dir>] ...`, `metrics end --id <m-id> [--tier <t>] [--effort <e>] [--blueprint <dir>] ...`.
  - 세션 JSON 새 필드: `tier: 'strong'|'standard'|'light'|null`, `effort: 'low'|'medium'|'high'|null`(끝날 때 기록). plan kind의 `blueprint: string|null`. `end --blueprint <dir>`는 `start --blueprint`와 같은 정규화를 거친 문자열로 저장된다. 예: `plans/x/` → `plans/x`.
  - `summary` 출력: `kinds.<kind>.by_tier.<strong|standard|light|unknown> = { sessions: number, tokens_total: number, cost_total: number }`.
- 거부: 위 Target behavior 실패 목록. 값 없는 `--tier`·`--effort`·`--blueprint`는 기존 규칙대로 `invalid-metrics-input`(exit 1), 모르는 플래그는 usage + exit 2다.
- 용어 "plan kind": `plan-coordinator-session` 또는 `planner-session`. 예: `{ kind: 'planner-session', blueprint: null }`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/drive-metrics.ts` | `SESSION_KINDS`, `MetricsSession`, `readMetrics`, `startSession`, `endSession`, `KindSummary`, `summarize` | Modify | 세션 기록·검증·집계 | 새 kind, tier·effort 필드, nullable blueprint 검증, end 바인딩, `by_tier` 집계 | `drive-metrics.ts:16`, `:26-53`, `:97-101`, `:199-235`, `:270-324`, `:337-345`, `:385-438` |
| `packages/cli/src/cli-metrics-command.ts` | `KINDS`, `USAGE`, `FLAGS`, `cmdMetrics` | Modify | 플래그 화이트리스트·인자 전달 | `end`에 `tier`·`effort`·`blueprint` 허용, plan kind `start`의 ledger 해석 생략 | `cli-metrics-command.ts:19-37`, `:115-143` |
| `packages/cli/src/cli-usage.ts` | `COMMAND_USAGE['metrics']` | Modify | 도움말 정본 | 새 kind·플래그 반영 | `cli-usage.ts:36`; 도움말 단언 `test/cli-help.test.js:474-478` |
| `rules/cli.md` | `metrics` 단락 | Modify | CLI 계약 문서 | kind 목록·end 플래그·`by_tier`·거절 규칙 서술 | `rules/cli.md:154-168`, `:281-284`, `:358-359` |
| `test/cli-metrics.test.js` | 신규 추출 지점: tier·effort·plan kind 테스트 | Modify | metrics CLI 단언 | 성공·실패·보존 케이스 추가 | 기존 fixture `test/cli-metrics.test.js:10-35`, `:526-531`; 플래그 테스트 `:260`, `:346-398` |

#### Constraints

- 기존 단언은 바꾸지 않는다. `test/cli-metrics.test.js:256`의 `listCoordinatorSessions` 키 목록 deepEqual은 그대로 통과해야 한다. 요약 단언은 필드별 접근이라(`:233-240`, `:426-427` 등) `by_tier` 추가로 깨지지 않아야 하고, 깨지면 브리프 이탈로 보고한다.
- 거절은 `readMetrics` 이후, 어떤 쓰기보다 먼저 일어나 파일 bytes를 바꾸지 않는다.
- `by_tier`는 비용 계산(`computeCost`) 규칙을 바꾸지 않고 이미 계산된 `cost`만 더한다.
- `test/cli-metrics.test.js`는 dist를 쓰므로(`:7-8`) 테스트 전에 `npm run build`.

### plan-workflow/plan-session-metrics/002 · `a3906764`

#### Goal & intent

run coordinator 세션과 plan context-review 호출을 닫는 안내가 `bouncer subagent-model --agent <name> --json`의 `tier`·`effort`를 `metrics end --tier/--effort`로 넘기게 해, TASKS-001의 필드가 실제 세션에 채워지게 한다. 수용 기준은 epic Success criteria 18의 기록 경로이고 검증 명령은 `node --test test/skill-bouncer-run.test.js test/reviewer-tier-docs.test.js`다.

#### Current behavior

- coordinator 세션: `skills/bouncer-run/references/drive-metrics.md:21` `metrics start --kind coordinator-session ...`, `:41` `metrics end --id <id> --tokens <subagent_tokens> --host-duration-ms <duration_ms>`, `:44-49` 선택 플래그(`--input-tokens`, `--output-tokens`, `--model`, cache)와 "Omit any flag the host did not give". tier·effort 언급 없음.
- root-direct 세션: `drive-metrics.md:55-69`는 토큰 플래그 없이 닫는다(측정 불가). dispatch 대상 agent가 없다.
- coordinator 모델 해석은 `skills/bouncer-run/SKILL.md:155-156`의 `--json` 없는 `bouncer subagent-model --agent bouncer-coordinator` 한 줄 출력뿐이라 tier·effort를 모른다.
- plan context-review: `skills/bouncer-plan/references/context-review.md:34-46`에서 `bouncer-context-reviewer`를 `--json` 없이 해석하고 `reviewer_tier_applied`면 `rules/subagent-model.md` item 1대로 `--tier`로 재해석한다. `:64-67`의 `metrics end`는 `--tokens`·`--host-duration-ms`만 넘긴다.
- `rules/subagent-model.md:17`은 `--json`이 provider·role·tier·model·effort·source를 낸다고만 적고, `:31-34`에서 Cursor는 effort를 적용하지 않는다고 적는다.
- 문서 단언: `test/skill-bouncer-run.test.js:91-119`(host 표 행), `:121-133`(진입 문서가 `drive-metrics.md`를 링크하고 `task-notification`을 반복하지 않음), `test/reviewer-tier-docs.test.js:17-34`(`reviewer_tier`·`rules/subagent-model.md` 참조), `test/subagents.test.js:721-732`(item 6의 `metrics end`), `packages/cli/src/doc-shape-contracts.ts:75,122-127`(`drive-metrics.md` H2 `Per coordinator session`·`Per root-direct session`·`Closing report` 순서).
- 재현: `node --test test/skill-bouncer-run.test.js test/reviewer-tier-docs.test.js`는 현재 통과한다.

#### Target behavior

- 성공:
  - `drive-metrics.md` coordinator 단계 3이 `metrics end` 직전에 dispatch와 같은 agent(·같은 `--tier`)로 `bouncer subagent-model --agent <name> --json`을 읽어 다음 규칙으로 플래그를 붙이라고 적는다.
    - `--tier <tier>`: `tier`가 문자열이고 `model`도 `null`이 아닐 때만 붙인다. `model`이 `null`(등급이 `inherit`로 매핑되어 부모 모델을 상속)이면 `tier`가 문자열이어도 생략한다.
    - `--effort <effort>`: `effort`가 문자열일 때만 붙인다. Cursor에서는 `effort`가 문자열이어도 생략한다(effort가 slug에 들어 있어 적용되지 않았으므로).
  - 같은 단락의 `metrics end` 예시 코드 블록에 `[--tier <tier>] [--effort <effort>]`가 나타난다.
  - `drive-metrics.md` root-direct 단락이 등급·effort 플래그도 생략한다고 적는다(dispatch한 agent가 없음).
  - `context-review.md` Metrics 문단이 각 관점 호출의 `metrics end`에 그 호출을 해석한 `--json` 결과의 tier·effort를 위 coordinator와 같은 규칙(`model`이 `null`이면 `--tier` 생략, Cursor면 `--effort` 생략)으로 넘기고, `reviewer_tier_applied: true`면 `--tier <reviewer_tier>`로 재해석한 결과(상향된 등급)를 기록한다고 적는다. 병렬 관점 호출은 같은 해석 값을 각자 기록한다. 규칙 본문은 `drive-metrics.md`에 두고 이 문단은 그 규칙을 따른다고 링크한다.
- 보존: 기존 host 표 행 문구, `drive-metrics.md` H2 세 개와 순서, `task-notification`을 진입 문서에 반복하지 않는 규칙, `reviewer_tier`·`rules/subagent-model.md` 참조가 그대로 남는다. 모델 해석·dispatch 절차(기존 plain 호출)는 바꾸지 않고 `--json` 호출은 기록용으로만 추가한다.

#### Interface

- 제공: 두 문서의 안내 문장. 새 CLI 표면은 없다(TASKS-001의 `metrics end --tier/--effort` 사용).
- 거부: 두 문서의 안내는 `null` 값, `model`이 `null`인 해석의 tier, Cursor effort, root-direct 세션에 대해 플래그를 만들어 넣지 말라고 적는다(`context-review.md`는 `drive-metrics.md` 규칙 링크로 같은 거부를 따른다). 등급을 추측해 채우는 문장을 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/drive-metrics.md` | `## Per coordinator session` 단계 3, `## Per root-direct session` | Modify | run 세션 기록 절차 | `--json` tier·effort 전달 문장과 예시, root-direct 생략 문장 | `drive-metrics.md:21`, `:41-49`, `:55-69`; 모양 계약 `doc-shape-contracts.ts:122-127` |
| `skills/bouncer-plan/references/context-review.md` | Metrics 문단 | Modify | plan 리뷰 호출 기록 절차 | 관점 호출별 tier·effort 전달, 상향 등급 기록 | `context-review.md:34-46`, `:64-67`; 단언 `test/reviewer-tier-docs.test.js:17-34` |
| `test/skill-bouncer-run.test.js` | 신규 추출 지점: drive-metrics tier·effort 문서 단언 | Modify | run 문서 단언 | 새 문장 존재 단언 추가 | 기존 단언 `test/skill-bouncer-run.test.js:91-133` |
| `test/reviewer-tier-docs.test.js` | 신규 추출 지점: context-review metrics tier 단언 | Modify | 등급 문서 단언 | context-review Metrics 문단의 `--tier`·`--effort` 단언 추가 | `test/reviewer-tier-docs.test.js:10-34` |

#### Constraints

- 기존 단언 문자열(`subagent_tokens`, `no token flags`, `missing`, `reviewer_tier`, `rules/subagent-model.md`)을 지우거나 바꾸지 않는다. 바꿔야 통과한다면 브리프 이탈로 보고한다.
- 새 문장은 영어로 쓴다(두 문서 본문 언어).

### plan-workflow/plan-session-metrics/003 · `e02c0154`

#### Goal & intent

`benchmarks/plan-review` fixture가 현재 CLI로 만들어지고, 그 단언이 현행 plan gate 계약(G18·G25 삭제)과 일치하며, `npm run ci`가 이 테스트를 실행한다. 수용 기준은 epic Success criteria 19이고 검증 명령은 `node --test test/plan-review-fixture.test.js`다.

#### Current behavior

- `benchmarks/plan-review/setup.cjs:13`, `setup.test.cjs:13`의 `BOUNCER_BIN`이 `scripts/bouncer`를 가리킨다. 이 파일은 d77681aa(2026-10-23)에서 삭제되었고 CLI는 `packages/cli/bin/bouncer`다.
- `node --test benchmarks/plan-review/setup.test.cjs` → 3개 중 2개 실패(`Cannot find module .../scripts/bouncer`, `setup.cjs:59`).
- 경로만 고쳐 fixture를 만들면 small·large 모두 `validate --gate plan`이 `ok: true`, failures `[]`, warnings `review-risk-missing`·`dag-disjoint-edge`다. `review-dispatch plan` strategy는 둘 다 `single`(`setup.test.cjs:35-36` 단언은 맞음). 그런데 `setup.test.cjs:41`은 failures `['G18','G25']`를 기대한다.
- 원인: plan gate의 G18·G25는 `doc-quality-gate-removal`이 의도적으로 지웠다(`.bouncer/context/epics/gates-review/blueprints/doc-quality-gate-removal/index.md:37`, `:50`, PR #255). `test/validate-gates.test.js:3331-3354`, `:3408-3415`가 "존재하지 않는 Touch Modify 경로·accepted가 아닌 context-review → 해당 코드 없음"을 고정한다. fixture(1378cc1f)가 그보다 먼저 만들어져 갱신되지 않았다.
- README 낡은 서술: `benchmarks/plan-review/README.md:24`(D5 주체 G25), `:26`(실패 코드 G25·G18), `:41`(D4·D5는 gate가 잡아도), `:33`(BP 003 merge 전 base 기준).
- I/O: `setup.cjs:71-80` `run()` spawnSync 래퍼로 `node <BOUNCER_BIN> scaffold epic ...`(env `BOUNCER_HOME=REPO_ROOT`, `:289-290`)과 `git init/add/commit`(`:302-304`)을 실행한다. `setup.test.cjs:20-25`는 `os.tmpdir()` mkdtemp에서 `review-dispatch`·`validate`를 spawn한다.
- CI: `npm run ci`의 테스트는 `test:coverage`(`node --test test/*.test.js`)와 `test:unit`뿐이라 `benchmarks/**`를 잡지 않는다(`package.json` `ci`). `test/test-tiers.test.js:27-59`는 `test/*.test.js`마다 `test/tiers.json`의 한 tier 등록을 요구하고, spawn하는 테스트는 `integration`이다(`:38`).

#### Target behavior

- 성공:
  - `setup.cjs`·`setup.test.cjs`의 `BOUNCER_BIN`이 `packages/cli/bin/bouncer`다.
  - fixture 단언: 두 blueprint 모두 plan gate `ok: true`, failures `[]`, warnings에 `review-risk-missing` 포함, strategy `single`.
  - D5(`src/missing.ts`)는 fixture에 그대로 남고 README는 D5를 reviewer 측정 대상으로 적는다(gate가 잡지 않는다).
  - `test/plan-review-fixture.test.js`가 `benchmarks/plan-review/setup.test.cjs`를 불러와 그 테스트를 실행하고, `test/tiers.json` `integration`에 등록된다. `npm run ci`의 `test:coverage` glob이 이 파일을 실행한다.
- 실패: 비어 있지 않거나 없는 대상 디렉터리 → `invalid-target` / exit 2, 파일 쓰기 없음(기존 `setup.test.cjs:49-82` 그대로).
- 보존: 결함 D1–D5 내용·위치, 출력 JSON `{ ok, dir, blueprints, defects }` 모양, `benchmarks/**` lint 제외(`eslint.config.js:27`).

#### Interface

- 제공: 새 테스트 진입 파일 `test/plan-review-fixture.test.js`(래퍼, 자체 테스트 없음). fixture CLI 표면은 바뀌지 않는다.
- 거부: fixture 단언에 G18·G25를 다시 기대하지 않는다. gate 코드를 되살리지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/plan-review/setup.cjs` | `BOUNCER_BIN` | Modify | fixture 생성 | CLI 경로 교체 | `setup.cjs:13`, `:59` |
| `benchmarks/plan-review/setup.test.cjs` | `BOUNCER_BIN`, gate 단언 | Modify | fixture 단언 | 경로 교체, failures `[]` 단언 | `setup.test.cjs:13`, `:27-47` |
| `benchmarks/plan-review/README.md` | 결함 표·측정 절차 | Modify | 측정 안내 | D5 주체 reviewer, G18·G25 서술 정정, 기준 시점 문장 정리 | `README.md:24`, `:26`, `:33`, `:41` |
| `test/plan-review-fixture.test.js` | 신규 추출 지점: fixture 테스트 래퍼 | Create | 없음 | `require('../benchmarks/plan-review/setup.test.cjs')` | CI glob `package.json` `test:coverage`; tier 계약 `test/test-tiers.test.js:27-59` |
| `test/tiers.json` | `integration` | Modify | tier 등록 | 래퍼 파일명 추가 | `test/test-tiers.test.js:30-38` |

#### Constraints

- 래퍼는 `test/*.test.js` 명명과 `scripts/check-test-names.js`를 통과해야 한다(래퍼 자신은 테스트 이름을 정의하지 않는다).
- `setup.test.cjs`의 기존 테스트 이름(`' → '` 구분)과 `invalid-target` 단언(`:49-82`)은 유지한다. 바뀌는 단언은 `:41` failures 기대값 하나(`['G18','G25']` → `[]`)이고 `:27` 테스트 이름의 "fail G25" 문구를 현행 동작으로 고친다.
- fixture 결함 문서 본문은 바꾸지 않는다.

### plan-workflow/plan-session-metrics/004

#### Goal & intent

TASKS-001·002·003이 통합된 상태에서 `npm run ci`가 통과해, 세션 등급 기록·호출 안내·fixture 복구가 기존 계약을 깨지 않음을 증명한다(epic Success criteria 18·19).

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.