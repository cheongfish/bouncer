---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/drive-execution/blueprints/record-guard-and-token-metrics/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-16T12:43:35.098+09:00'
bouncer:
  id: EXPLAIN-record-guard-and-token-metrics
  epic_id: drive-execution
  blueprint_id: record-guard-and-token-metrics
  status: published
  comprehension:
    - range_from: 63ba9fb2570a56491f8c4f673f166fee18baaeab
      range_to: 79c12f31fdbb10c5bdaa60161c5b0bc131401c1f
      diff_sha: cecd1a2aa0237da52e42a80667ed7d9a89b9a8a729a9b0e1d8902ce493876704
      recorded_at: '2026-10-16T12:44:19+09:00'
  task_commits:
    - task: drive-execution/record-guard-and-token-metrics/001
      sha: a5843d37
      intent_anchor: task-001
    - task: drive-execution/record-guard-and-token-metrics/002
      sha: '82053679'
      intent_anchor: task-002
    - task: drive-execution/record-guard-and-token-metrics/003
      sha: 79c12f31
      intent_anchor: task-003
---
# Explain

## Background

계획 문서를 검토하는 `context-review`는 reviewer가 낸 지적(finding)을 round 단위로 `record`하고 마지막에 `close`한다. 같은 fingerprint를 가진 finding이 한 round에 둘 이상 있으면 `close`가 거부하는데, `record`는 이를 받아 주었다. 그래서 중복을 닫는 시점에야 알게 되고, 같은 round는 다시 기록할 수 없어 남은 길이 reviewer를 한 번 더 부르는 `restart`뿐이었다.

비용 쪽에도 빈 곳이 있었다. 단계별 비용을 비교하려면 서브에이전트의 cache read·write 토큰과, coordinator가 띄운 implementer·reviewer·debugger의 토큰이 필요하다. 호스트는 이 값을 항상 주지는 않고, 기록할 필드도 없었다. 이 변경은 호스트가 알려 준 값만 기록하고 합산하며, 값이 없으면 추정하지 않고 비워 둔다.

## Intuition

접수 창구에서 서류를 받을 때 중복 번호를 바로 돌려보내는 것과 같다. 마지막 결재 단계에서 돌려보내면 접수부터 다시 해야 하지만, 창구에서 돌려보내면 접수 번호를 건드리지 않고 고쳐 다시 낼 수 있다. 토큰 기록은 영수증 칸을 만드는 일이다. 영수증이 없으면 빈칸으로 두고, 있는 영수증만 합산한다.

## Code

- `scripts/src/lib/context-review-state.ts` — `recordReport`는 이전 round와 합친 finding 목록(`merged`)에서 `duplicateFingerprints`로 중복을 찾고, 어떤 status에서도 쓰기 전에 거부한다. 같은 `id`로 이전 finding을 덮어쓰는 입력은 중복이 아니다. 중복 때문에 거부된 round는 state와 보고 파일을 남기지 않는다.
- `scripts/src/lib/drive-metrics.ts` — `endSession`이 `cache_read_tokens`·`cache_write_tokens`를 저장하고, 둘 다 없으면 `null`과 `cache_unavailable_reason: 'not-reported'`를 남긴다. `summarize`는 최상위 `cache`(read·write 각각 `total`, `missing`)와 `worker_tokens`를 낸다. `worker_tokens`는 `summarizeWorkerTokens`가 원장의 최상위 decision에서 (task, role, perspective) 키별로 계산하며 `coordinator-session`의 `tokens_total`에는 더하지 않는다.
- `scripts/src/lib/cli-metrics-command.ts` — `metrics end`의 새 플래그 두 개와 입력 거부(`invalid-metrics-input`).
- `scripts/src/lib/coordinator.ts`, `scripts/src/lib/cli-git-commands.ts` — `coordinate worker-model`이 `implementer` role과 `--tokens`를 받고, 새 `coordinate worker-tokens`가 늦게 온 토큰만 덧붙인다. 잘못된 토큰 값은 `tokens-invalid`다. 설계 선택: 기록에 id가 없어서 키별로 `runs`(worker-model 기록 수)와 `reported`(토큰이 달린 기록 수)를 세고 `missing`은 `max(0, runs − reported)`다. 같은 키에 `--tokens`가 붙은 worker-model과 이후 `worker-tokens`가 함께 있으면 둘 다 보고 한 건으로 세므로, 중복 보고를 걸러 내지는 못한다. 원장의 세 role 밖 값은 합산에서 빠진다.
- `rules/cli.md`, `references/coordinator-cards/*.md` — 명령 설명과 coordinator가 토큰을 남기는 절차.

## Quiz

1. 같은 fingerprint를 가진 finding 둘(서로 다른 `id`)이 든 round를 `context-review record --status requested`로 기록하면 어떻게 되는가?
   - A) 기록되고, 중복은 `close`에서 거부된다.
   - B) `context-review-input-invalid`로 거부되고 state와 보고 파일이 바뀌지 않는다.
   - C) 두 finding이 자동으로 하나로 합쳐져 기록된다.
2. `metrics end`를 cache 플래그 없이 호출해 닫은 세션의 `cache_read_tokens`는 무엇인가?
   - A) `0`
   - B) `tokens` 값에서 추정한 수
   - C) `null`이고 `cache_unavailable_reason`이 `not-reported`다.
3. 같은 (task, role, perspective) 키에 `worker-model` 기록이 3건 있고, 그중 1건은 `--tokens`가 붙었다. 이후 같은 키로 `worker-tokens`를 한 번 덧붙였다. `worker_tokens`의 `missing`은 얼마인가?
   - A) `1`
   - B) `0`
   - C) `2`
4. `metrics summary`에서 `worker_tokens`의 합계는 `coordinator-session`의 `tokens_total`과 어떤 관계인가?
   - A) `tokens_total`에 더해진다.
   - B) 호스트가 coordinator 총량에 포함됐다고 알린 때만 더해진다.
   - C) 더해지지 않고 `worker_tokens`로만 따로 나온다.

## Tasks

### drive-execution/record-guard-and-token-metrics/001 · `a5843d37`

#### Goal & intent

`context-review record`가 같은 fingerprint를 가진 finding이 둘 이상 있는 round를 `requested`·`addressed`·`accepted` 어느 status에서도 쓰기 전에 거부한다. 거부된 round는 state와 보고 파일을 바꾸지 않아, 합친 입력을 같은 round 번호로 다시 기록할 수 있다.
수용 기준은 에픽 성공 기준 1·2와 7 중 `context-review record` 부분이고, 검증 명령은 `npm test`다.

#### Current behavior

- `recordReport`(`scripts/src/lib/context-review-state.ts:876`)는 입력을 `readReportInput`(`:797`)으로 읽는다. 이 함수는 finding의 `id`·`severity`·`status`·`actionability`만 검사하고 `fingerprint`는 보지 않는다.
- 이전 보고와 합친 `merged`는 `:955-962`에서 만들어진다(`foldReports` 결과에 새 finding을 id별로 덮어쓴다).
- 중복 fingerprint 검사는 `status === 'accepted'`일 때만 `prepareClosureDoc`(`:688`)이 `collectFindingFailures`(`validate-sections.ts:436`)로 수행한다. `requested`·`addressed` record는 이 검사를 건너뛴다.
- 쓰기는 `:983` 이후의 `guardWrites`(dispatch 사본 → 보고 파일 `writeImmutable` → `saveState`) 순서다. 그 앞에서 실패하면 아무것도 남지 않는다.
- `closeCycle`(`:1035`)은 `prepareClosureDoc`을 거쳐 같은 사유로 거부하므로, 중복이 `record`를 통과하면 `close`에서야 막힌다. 같은 round는 다시 기록할 수 없고 남은 길은 `restart`뿐이다.
- 같은 transition key 재요청은 `:914-928`에서 no-op으로 돌아온다(`loadDispatch` 앞).
- 재현: `test/context-review-state.test.js`의 `roundFile`(`:85`)로 같은 fingerprint를 가진 finding 둘(서로 다른 `id`)을 `record`에 넘기면 exit 0으로 통과한다. `close`에서 `duplicate fingerprint`로 거부된다.
- 입출력: `readReportInput`의 `fs.readFileSync`(`:801`), 락(`withLock` `:904`)과 `writeImmutable`·`saveState`가 파일 I/O이고, 자식 프로세스 호출은 없다. 테스트는 빌드 산출물 `scripts/lib`를 `runCli`(`:13`)로 부른다.
- 중복 fingerprint를 한 round에 쓰는 기존 record 테스트는 없다. 확인된 fixture는 `MUST_FIX`(`:22`)와 `ADVISORY`(`:35`)가 서로 다른 symbol을 가져 fingerprint가 다르다.

#### Target behavior

- 성공 경로: fingerprint가 모두 다른 round는 지금과 같이 기록된다. 같은 `id`로 이전 round의 finding을 덮어쓰는 입력은 중복이 아니다.
- 실패 경로: `merged`에 같은 fingerprint가 둘 이상(서로 다른 `id`)이면 `{ ok: false, reason: 'context-review-input-invalid' }`로 거부한다. 사유 문구는 `context-review duplicate fingerprint <fp>`이고, 둘 이상이면 모두 담는다. 이 검사는 `status`와 무관하게 `merged` 생성 직후, 어떤 쓰기보다 앞에서 돈다.
- 거부 뒤 state와 보고 파일은 바뀌지 않는다. 합친 입력(중복 제거)으로 같은 round 번호를 다시 기록하면 성공한다.
- 보존: transition key no-op 응답(`warnings` 키 없음), 기존 `finding-merge-candidate` 경고, `accepted` 경로의 다른 거절 사유, `closeCycle`의 동작은 그대로다.
- 한 round의 입력에 fingerprint 필드가 없는 finding은 중복 판정에서 빼고, 형식 오류는 기존 검사(`close` 시점)가 맡는다.

#### Interface

- 제공: `recordReport`의 새 거절. 응답 형식은 기존 `fail('context-review-input-invalid', messages, next)`와 같고 `next`는 "중복 fingerprint finding을 하나로 합쳐 같은 round로 다시 기록"을 안내한다.
- 거부: `merged`에 fingerprint가 같은 finding이 서로 다른 `id`로 둘 이상 있는 입력. 용어 정의: fingerprint는 finding의 `fingerprint` 필드 문자열이다(예: `context:combined:tasks/002 interface:<file>#<symbol>`).
- 새 플래그·새 exit code는 없다. 거부는 기존 exit 1(거절된 전이)이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `recordReport` | Modify | 보고를 dispatch와 함께 기록하고 closure를 투영 | `merged` 생성 직후 쓰기 전에 fingerprint 중복을 검사해 거부 | explain(recordReport): 호출 1 / 파일 1, `:955-983` 직접 확인 |
| `scripts/src/lib/cli-context-review-command.ts` | `USAGE` help 텍스트 | Modify | `record` 성공 경고와 실패 사유 설명 | record가 중복 fingerprint round를 거부한다는 한 줄 추가 | `:126-142` 직접 확인 |
| `skills/bouncer-plan/references/context-review.md` | Merge 단계 문단 | Modify | 같은 fingerprint를 하나로 합치라는 지시 | record가 거부한다는 사실과 합쳐 재기록하라는 절차 추가 | `:55-60` 직접 확인 |
| `rules/cli.md` | `context-review record` 문단 | Modify | record 옵션·경고 설명 | record가 중복 fingerprint round를 거부하고 상태를 남기지 않는다는 문장 추가 | `:268-272` 직접 확인 |
| `test/context-review-state.test.js` | record 테스트 구역 | Modify | record·close·restart 시나리오 | 중복 거부·상태 불변·재기록 성공·no-op 보존 테스트 추가 | 기존 `roundFile`·`record` 헬퍼 재사용 |

#### Constraints

- 사유 문구는 `context-review duplicate fingerprint <fp>`와 글자까지 같아야 한다(`close`와 같은 사유).
- `collectFindingFailures`를 비-accepted 입력에 통째로 부르지 않는다. round·본문 검사의 다른 메시지가 섞이므로 fingerprint 중복만 세는 작은 함수를 쓴다.
- 같은 `id`의 덮어쓰기는 중복이 아니다. 중복 판정은 `merged`(이전 round와 합친 결과)를 대상으로 한다.
- 새 검사는 transition key 비교(no-op 경로) 뒤에 두어 이미 적용된 전이의 재요청 응답이 바뀌지 않게 한다.
- 포함할 문서 문구는 `skill-context-review.test.js`의 fingerprint 예시 형식 단언을 깨지 않는다.
- 변경 후 `npm run lint`, `npm run lint:test-names`, `npm run lint:docs`, `npm run typecheck`가 통과해야 한다. 테스트 이름은 `check-test-names.js` 규칙을 따른다.
- CLI 동작은 gitignore된 `scripts/lib` 빌드가 실행하므로, 수동 확인 전 `npm run build`를 실행한다.

### drive-execution/record-guard-and-token-metrics/002 · `82053679`

#### Goal & intent

`metrics end`가 호스트가 알려 준 cache read·write 토큰을 선택 플래그로 받아 세션에 저장하고, `metrics summary`가 `kinds`와 같은 수준의 최상위 `cache` 키에 cache read·write 합계와 누락 수를 낸다. 호스트가 값을 주지 않으면 `null`과 사유를 남기고 추정하지 않는다. 기록 파일 `version`은 1 그대로이고, cache 필드가 없는 기존 세션은 누락으로 읽힌다.
수용 기준은 에픽 성공 기준 3·4·7이고, 검증 명령은 `npm test`다.

#### Current behavior

- `endSession`(`scripts/src/lib/drive-metrics.ts:248`)은 `host_duration_ms`(`:263`), `model`(`:264`), `input_tokens`(`:265`), `output_tokens`(`:266`), `tokens`(`:268-270`)를 쓴다. `tokens`가 없으면 `tokens_unavailable_reason: 'not-reported'`(`:272`)를 남기고 비용은 `computeCost`(`:273`)가 입력·출력 토큰 단가로만 계산한다.
- `MetricsSession` 타입(`:27-48`)은 cache 필드가 없고, 파일은 `{ version: 1, sessions }`(`:51`)다. `readMetrics`(`:77-96`)는 `version === 1`, `sessions` 배열, 세션의 문자열 `id`·`kind`·`blueprint`만 검사하고 알 수 없는 선택 필드는 거부하지 않는다.
- `summarize`(`:309-340`)는 끝난 세션의 `tokens`가 숫자면 `tokens_total`에 더하고 아니면 `tokens_missing`을 올린다(`:330-331`). 열린 세션은 건너뛴다(`:326`). 결과 모양은 `{ ok, blueprint, kinds }`다.
- `cmdMetrics`(`scripts/src/lib/cli-metrics-command.ts:61`)는 `parseCount`(`:47-51`, `/^\d+$/` + 안전 정수, 아니면 NaN)로 `counts`(`:111-116`)를 만들고 NaN이면 `invalid-metrics-input`(exit 1)으로 거부한다. 허용 플래그 목록 `FLAGS.end`(`:37`)에 없는 플래그는 usage와 exit 2다. 값 없는 플래그는 `hasBare`(`:90-91`)로 거부된다. help는 `USAGE_BLOCK`(`:19-26`)과 `USAGE`(`:28-33`) 두 곳에 있다.
- `summary` 출력은 `summarize` 결과를 그대로 낸다(`:99-101`). `tokens_missing`·`tokens_total`의 소비자는 `drive-metrics.ts`와 `test/cli-metrics.test.js`(`:235-236`, `:287`, `:306`)뿐이다.
- `listCoordinatorSessions`(`:348-366`)는 명시적 키 일곱 개만 내고(테스트가 `Object.keys`를 `deepStrictEqual`로 단언, `test/cli-metrics.test.js:243-259`), 이 task에서는 바꾸지 않는다.
- 기존 테스트: 플래그 없는 end가 `tokens === null`과 `not-reported`를 남긴다(`test/cli-metrics.test.js:70-82`). 음수·소수·비숫자 `--tokens`는 exit 1 `invalid-metrics-input`이다(`:268-290`). 이 파일은 실제 임시 디렉터리와 `git init`을 쓴다(`:271`).
- 문서: `skills/bouncer-run/references/drive-metrics.md:29-35`가 `--tokens`·`--input-tokens`·`--output-tokens`·`--model`을 "호스트가 줄 때만" 쓰라고 안내한다. `rules/cli.md`에는 `metrics end` 플래그 목록이 없다(`:181` 근처에 `metrics start`만 언급).

#### Target behavior

- 성공 경로: `metrics end --id <id> --cache-read-tokens 120 --cache-write-tokens 30`이 세션에 `cache_read_tokens: 120`, `cache_write_tokens: 30`을 저장한다. 두 플래그는 서로 독립이고 하나만 줘도 된다. 주지 않은 쪽은 `null`이다.
- 값이 하나도 없으면 두 필드는 `null`이고 `cache_unavailable_reason: 'not-reported'`를 남긴다. 하나라도 있으면 이유 키는 쓰지 않는다.
- cache 토큰은 `tokens`·`input_tokens`·`output_tokens`와 독립이며 `tokens` 총합에 더하지 않고 `computeCost` 입력으로도 쓰지 않는다.
- `metrics summary`는 `kinds`와 같은 수준에 `cache: { read: { total, missing }, write: { total, missing } }`를 더한다. 끝난 세션의 숫자 값만 합산하고 `null`·필드 부재는 합이 아니라 `missing`으로 센다. 열린 세션은 건너뛴다. `0`은 값으로 합산한다.
- 실패 경로: 음수·소수·비숫자·값 없는 cache 플래그는 `--tokens`와 같이 exit 1 `invalid-metrics-input`이다. 알 수 없는 플래그는 기존대로 exit 2다.
- 보존: 기존 `kinds[*]`의 키와 값, `listCoordinatorSessions` 출력, 기록 파일 `version: 1`, cache 필드 없는 기존 세션의 읽기, 비용 계산.

#### Interface

- 제공:
  - `metrics end ... [--cache-read-tokens <n>] [--cache-write-tokens <n>]`. `<n>`은 `/^\d+$/`이고 안전 정수다. 예: `--cache-read-tokens 120`.
  - `endSession` 옵션 `cacheReadTokens?: number`, `cacheWriteTokens?: number`.
  - 세션 필드 `cache_read_tokens?: number | null`, `cache_write_tokens?: number | null`, `cache_unavailable_reason?: string`.
  - `summarize` 결과의 `cache: { read: { total: number, missing: number }, write: { total: number, missing: number } }`. 예: 세션 둘 중 하나만 값이 있으면 `read: { total: 120, missing: 1 }`.
- 거부: 음수·소수·비숫자·값 없는 cache 플래그(`invalid-metrics-input`), `metrics end` 외 명령에서의 cache 플래그(usage, exit 2). 즉시 오류(throw 성격)는 위 입력 오류뿐이고, 값 누락은 오류가 아니라 `null`과 사유로 남는 상태다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/drive-metrics.ts` | `MetricsSession`, `endSession`, `summarize` | Modify | 세션 기록과 kind별 합산 | cache 필드 저장, `cache` 합계 추가 | `:27-48`, `:248-290`, `:309-340` 직접 확인 |
| `scripts/src/lib/cli-metrics-command.ts` | `FLAGS`, `cmdMetrics`, `USAGE_BLOCK`, `USAGE` | Modify | 플래그 허용·파싱·help | `end` 플래그와 파싱, help 두 곳 갱신 | `:19-40`, `:111-122` 직접 확인 |
| `skills/bouncer-run/references/drive-metrics.md` | end 안내 문단 | Modify | 호스트가 줄 때만 쓰는 플래그 안내 | cache 플래그 추가 안내(호스트가 줄 때만) | `:29-35` 직접 확인 |
| `test/cli-metrics.test.js` | metrics end·summary 테스트 | Modify | 토큰·요약·입력 거부 단언 | cache 저장·누락·거부·기존 파일 읽기 테스트 추가 | `:70-82`, `:200-241`, `:268-290` |

#### Constraints

- 호스트가 주지 않은 값은 만들어 채우지 않는다. `null`과 사유만 남긴다.
- 기록 파일 `version`은 1이고 새 필드는 모두 선택이다. 쓰기는 기존 임시 파일 + rename을 쓴다.
- `parseCount`와 `invalid-metrics-input` 경로를 재사용하고 새 오류 코드를 만들지 않는다.
- 기존 `tokens_unavailable_reason`·`cost_unavailable_reason` 의미를 바꾸지 않는다.
- 변경 후 `npm run lint`, `npm run lint:test-names`, `npm run lint:docs`, `npm run typecheck`가 통과해야 한다. CLI 확인 전 `npm run build`를 실행한다.

### drive-execution/record-guard-and-token-metrics/003 · `79c12f31`

#### Goal & intent

coordinator가 띄운 implementer·reviewer·debugger의 토큰을 원장 decision에 남기고, `metrics summary`가 이를 `coordinator-session` 총량과 겹치지 않는 `worker_tokens`로 합산한다. 완료 알림이 hand-back 뒤에 와도 토큰만 담은 `worker-tokens` decision을 덧붙일 수 있다. 호스트가 값을 주지 않으면 추정하지 않고 누락으로 센다.
수용 기준은 에픽 성공 기준 5·6·7이고, 검증 명령은 `npm test`다.

#### Current behavior

- `coordinate worker-model`의 처리(`scripts/src/lib/coordinator.ts:3550-3578`)는 role이 `reviewer`·`debugger`가 아니면 `worker-model-role-invalid`(`:3553`)로 거절하고, `model`이 비면 `model-invalid`(`:3556`)로 거절한다. `--perspective`는 reviewer 전용이며 `WORKER_MODEL_REVIEW_PERSPECTIVES`(`:86-88`) 안이어야 한다(`:3558-3562`). `--task`가 있으면 해당 task의 `decisions`(`:3573`)에, 항상 `ledger.decisions`(`:3574`)에 `WorkerModelDecision`(`:90-93`: `kind`, `role`, `model`, `task?`, `perspective?`)을 덧붙인다. 거절 문구는 `:4383-4390`이고 "reviewer or debugger"라 적혀 있다.
- implementer의 모델은 `coordinate dispatch --model`이 task의 `dispatch.model`과 dispatch decision(`:75-86`)에 남긴다(`rules/cli.md:126-129`). implementer role은 `worker-model`로 기록되지 않는다.
- CLI: 명령 목록은 `COORDINATE_COMMANDS`(`scripts/src/lib/cli-git-commands.ts:310`), 같은 이름의 사본이 `:574`와 오류 문구 목록 `:698-705`에 있고 `worker-model` help는 `:543-557`이다. 인자 검사(`:787-806`)는 `--role`·`--model` 누락과 값 없는 `--task`·`--perspective`를 usage(exit 2)로 막고, 옵션 매핑(`:959-963`)은 `model`·`role`·`perspective`를 넘긴다. `tokens` 매핑은 없다. 원장 쓰기 명령 집합 `LEDGER_FENCED_COMMANDS`는 `coordinator.ts:47-50`에 있다.
- `validateCoordinatorLedger`(`scripts/src/lib/runtime-state.ts:271`)는 `decisions` 배열의 kind·필드를 열거해 검사하지 않으므로 새 kind와 새 필드가 통과한다.
- checkpoint의 `unresolved_decisions`(`coordinator.ts:682-688`)는 통합되지 않은 task id를 가진 모든 decision을 싣는다. `worker-model`이 이미 여기에 나타난다(`test/coordinator.test.js:4258`).
- 계측: `readLedgerSnapshot`(`scripts/src/lib/drive-metrics.ts:120-147`)은 `{ ok, snapshot | null, decisions }`를 내고 원장이 없으면 `decisions: []`, 깨졌으면 `metrics-ledger-invalid`다. `summarize`(`:309`)는 원장 경로를 받지 않고 `cli-metrics-command.ts:85`가 파일과 blueprint만 넘긴다. 원장 경로 해석은 같은 파일의 `ledgerFor`(`:89-96`)가 `coordinatorPathsFor`로 한다. TASKS-002 이후 `summarize` 결과에는 `cache` 키가 더해져 있다.
- coordinator 카드: `references/coordinator-cards/review.md:13-17`, `final_review.md:11-16`이 reviewer, `verify.md:17`이 debugger의 `worker-model` 기록을 지시한다. implementer 호출은 `dispatch.md:33-40`이 다루고 `worker-model` 기록 지시는 없다.
- 기존 테스트: `test/coordinator.test.js:4188-4310`(`workerModelCall` `:4192`)이 worker-model 성공·거절을 단언하고, `{ role: 'implementer', model: 'inherit' }`가 `worker-model-role-invalid`를 기대하는 케이스(`:4274`)가 있다. `test/cli-coordinate.test.js:1101-1175`가 CLI 형태(성공 decision `deepEqual` `:1111`)를, 명령 목록 열거는 `coordinator.test.js:18`, `cli-coordinate.test.js:19`·`:149`·`:515`·`:520`, `cli-help.test.js:260`이 단언한다.
- 재현: `bouncer coordinate worker-model --blueprint <dir> --role implementer --model inherit ...`이 `worker-model-role-invalid`로 거절된다. 호스트의 완료 알림이 주는 `subagent_tokens`를 남길 필드·명령은 없다.

#### Target behavior

- `worker-model`
  - 성공: role이 `implementer`·`reviewer`·`debugger`면 기록한다. `--tokens <n>`이 있으면 decision에 `tokens: n`을 담고, 없으면 `tokens` 키를 쓰지 않는다. `--perspective`는 reviewer에만 허용된다.
  - 실패: 그 밖의 role은 `worker-model-role-invalid`, implementer·debugger에 `--perspective`를 준 경우는 `worker-model-perspective-invalid`, 음수·소수·비숫자 `--tokens`는 `tokens-invalid`다. 어느 거절도 원장을 쓰지 않는다.
- `worker-tokens`(새)
  - 성공: `coordinate worker-tokens --blueprint <dir> --role <implementer|reviewer|debugger> --tokens <n> [--task <ddd>] [--perspective <name>] --ledger-path <p> --ledger-hash <h>`가 `{ kind: 'worker-tokens', role, tokens, task?, perspective? }`를 `ledger.decisions`에, `--task`가 있으면 그 task의 `decisions`에도 덧붙인다. dispatch·lease·status·attempt는 바꾸지 않는다.
  - 실패: `worker-model`과 같은 role·perspective·task 거절과 `tokens-invalid`. `--tokens`가 없으면 usage(exit 2).
- 합산: `metrics summary`는 `worker_tokens: { total, missing, by_role: { implementer, reviewer, debugger } }`를 낸다. 각 항목은 `{ total, missing }`이다. 키 `(task ?? '', role, perspective ?? '')`마다 `runs`는 `worker-model` 기록 수, `reported`는 `tokens`가 숫자인 `worker-model` 기록과 `worker-tokens` 기록의 합이다. `total`은 숫자 토큰의 합이고 `missing`은 키별 `max(0, runs − reported)`의 합이다. 원장이 없거나 기록이 없으면 `total: 0, missing: 0`이다. `0` 토큰은 값으로 합산하고 `kinds['coordinator-session'].tokens_total`에는 더하지 않는다.
- 보존: 기존 `worker-model` 성공·거절의 응답 형태, `unresolved_decisions` 동작(새 decision도 같은 규칙으로 나타남), `kinds`·`cache` 요약, `dispatch` 기록, 원장 검증.

#### Interface

- 제공:
  - `coordinate worker-model`: `--role implementer` 허용, `--tokens <n>`(`/^\d+$/`, 안전 정수) 추가. 예: `--role implementer --model inherit --tokens 48200`.
  - `coordinate worker-tokens`: 위 형태의 새 하위 명령. 명령 이름은 `COORDINATE_COMMANDS`, `LEDGER_FENCED_COMMANDS`, 두 사본 목록, 오류 문구 목록, help에 등록한다.
  - decision `WorkerTokensDecision = { kind: 'worker-tokens'; role: 'implementer' | 'reviewer' | 'debugger'; tokens: number; task?: string; perspective?: string }`, `WorkerModelDecision`의 선택 필드 `tokens?: number`.
  - `summarize` 옵션 `resolveLedger?: (blueprint: string) => string | null`(주입 매개변수, `endSession`과 같은 형태)와 결과 키 `worker_tokens`.
- 거부(즉시 오류): `worker-model-role-invalid`(문구를 "implementer, reviewer or debugger"로 갱신), `worker-model-perspective-invalid`, `tokens-invalid`, `task-outside-blueprint`, 인자 누락·값 없는 `--tokens`·`--task`·`--perspective`(usage, exit 2). 상태로 남는 경우(오류 아님): 호스트가 토큰을 주지 않아 `tokens` 키 없이 기록된 worker-model은 누락으로 세고, 원장이 없으면 `worker_tokens`는 0이다.
- 용어: `runs`는 같은 키의 `worker-model` 기록 수, `reported`는 숫자 토큰이 달린 기록 수다. 키 예: task `002`, role `reviewer`, perspective `security` → `('002', 'reviewer', 'security')`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `WorkerModelDecision`, `worker-model` 처리, 거절 문구, `LEDGER_FENCED_COMMANDS` | Modify | reviewer·debugger 모델 기록 | implementer·`tokens` 허용, `worker-tokens` 처리·타입·거절 문구 추가 | `:47-50`, `:86-93`, `:3550-3578`, `:4383-4390` 직접 확인 |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_COMMANDS`, 인자 검사, 옵션 매핑, help | Modify | coordinate 명령 등록·검사·help | 새 명령 등록, `--tokens` 검사·매핑, help 갱신 | `:310`, `:543-557`, `:574`, `:698-705`, `:787-806`, `:959-963` 직접 확인 |
| `scripts/src/lib/drive-metrics.ts` | `summarize` | Modify | kind별 세션 합산 | 원장 decision에서 `worker_tokens` 합산 | `:309-340`, `readLedgerSnapshot` `:120-147` |
| `scripts/src/lib/cli-metrics-command.ts` | `summary` 분기 | Modify | `summarize` 호출 | `ledgerFor`를 `resolveLedger`로 넘김 | `:85`, `:89-96` 직접 확인 |
| `rules/cli.md` | coordinate worker-model 절 | Modify | 명령·거절 문서 | implementer·`--tokens`·`worker-tokens`·거절 코드·`worker_tokens` 설명 | `:126-138` 직접 확인 |
| `references/coordinator-cards/dispatch.md` | implementer 호출 지시 | Modify | dispatch 직전 절차 | implementer 완료 알림의 토큰 기록 지시 추가 | `:33-40` |
| `references/coordinator-cards/review.md` | reviewer 기록 지시 | Modify | worker-model 기록 | `--tokens`와 늦은 값의 `worker-tokens` 절차 추가 | `:13-17` |
| `references/coordinator-cards/final_review.md` | 최종 리뷰 reviewer 기록 | Modify | worker-model 기록 | 같은 지시 추가 | `:11-16` |
| `references/coordinator-cards/verify.md` | debugger 기록 | Modify | worker-model 기록 | 같은 지시 추가 | `:17` |
| `test/coordinator.test.js` | worker-model 테스트, 명령 열거 | Modify | 기록·거절·목록 단언 | implementer 허용, `tokens`, `worker-tokens`, 열거 갱신 | `:18`, `:4188-4310`(`:4274` 변경) |
| `test/cli-coordinate.test.js` | worker-model CLI·열거·오류 문구 | Modify | CLI 형태 단언 | `--tokens`·`worker-tokens` CLI, 열거·정규식 갱신 | `:19`, `:149`, `:515`, `:520`, `:1101-1175` |
| `test/cli-help.test.js` | coordinate 명령 목록 | Modify | help 열거 단언 | 새 명령 포함 | `:260` |
| `test/cli-metrics.test.js` | summary 테스트 | Modify | 요약 단언 | `worker_tokens` 합산·누락·원장 없음 테스트 | `:233-308` |

#### Constraints

- 호스트가 주지 않은 토큰은 만들지 않는다. `tokens` 키가 없는 기록은 누락이다.
- 하위 에이전트 토큰은 `coordinator-session`의 `tokens_total`에 더하지 않는다. coordinator 총량에 포함됐는지는 확인할 수 없으므로 `worker_tokens`를 별도 키로만 낸다.
- 새 decision은 `dispatch`·`lease`·`status`·`attempt`를 바꾸지 않고, 검증을 모두 통과한 뒤에만 `commitWrite()`를 부른다(`worker-model`과 같은 기록 전용 규칙).
- `worker-model` 기존 응답의 필드와 거절 코드 의미를 바꾸지 않는다. `tokens`는 값이 있을 때만 키를 쓴다.
- 카드·help·`rules/cli.md` 문구를 바꾸기 전에 문구를 단언하는 테스트(`doc-shape-cli.test.js`, `skill-bouncer-surface.test.js`, `coordinate-next.test.js`, `review-record.test.js`)를 먼저 확인한다.
- 변경 후 `npm run lint`, `npm run lint:test-names`, `npm run lint:docs`, `npm run typecheck`가 통과해야 한다. CLI 확인 전 `npm run build`를 실행한다.