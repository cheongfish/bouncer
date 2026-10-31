---
type: bouncer.explain
title: worker-tokens-duplicate-guard explain
description: Explain for worker-tokens-duplicate-guard
resource: .bouncer/context/epics/drive-execution/blueprints/worker-tokens-duplicate-guard/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-31T17:47:47.464+09:00'
bouncer:
  id: EXPLAIN-worker-tokens-duplicate-guard
  epic_id: drive-execution
  blueprint_id: worker-tokens-duplicate-guard
  status: published
  comprehension:
    - range_from: 99567c1e015f511397979ba4f4bbde70c9c1dd23
      range_to: b6ea4b2ae01f904e7bb22e0d0bfc7b4e633d24b5
      diff_sha: f3bd76a67c3b8b81beee4d07b6d81fd1811a96992d2fb1fc28430cc45282f80d
      recorded_at: '2026-10-31T17:48:34.322+09:00'
  task_commits:
    - task: drive-execution/worker-tokens-duplicate-guard/001
      sha: 497f91c6
      intent_anchor: task-001
    - task: drive-execution/worker-tokens-duplicate-guard/002
      sha: dc4d7cd4
      intent_anchor: task-002
    - task: drive-execution/worker-tokens-duplicate-guard/003
      sha: e0d1702c
      intent_anchor: task-003
    - task: drive-execution/worker-tokens-duplicate-guard/005
      sha: b6ea4b2a
      intent_anchor: task-005
---
# Explain

## Background

`bouncer coordinate worker-tokens`는 worker 호출 하나의 토큰 사용량을 원장에 덧붙인다. 같은 키 `(task, role, perspective)`에 값을 두 번 넣어도 막는 곳이 없어서, 합계 집계가 조용히 어긋날 수 있었다. 이 변경은 이미 채워진 호출에 대한 두 번째 기록을 거절하고, 잘못 넣은 값은 `--replace`라는 한 경로로만 고치게 한다.

같은 변경에 문서 규칙 두 가지가 딸려 있다. coordinator가 worker 보고를 기다릴 수 없을 때 추측하지 않고 멈추는 종료 규칙, 그리고 계획 작성 규칙 문서의 Checklist 항목 규칙(분기 matrix 셀 단위 항목, 문서 문구 단언 방식)이다.

## Code

- `packages/cli/src/drive-metrics.ts` — `workerKeyState`가 한 키의 `runs`(worker-model 수), `filled`(숫자 tokens 또는 `unreported`가 달린 기록 수), `tokensRecords`, `latest`를 센다. 키 규칙은 기존 `pendingWorkerTokenKeys`와 같아서 중복 판정이 pending 판정과 갈라지지 않는다.
- `packages/cli/src/coordinator-commands.ts` — `coordinateWorkerRecord`가 형식 검사 뒤, 원장을 쓰기 전에 판정한다. `tokensRecords >= 1`이고 `runs <= filled`(비어 있는 호출 자리 없음)이면 `worker-tokens-duplicate`로 거절하고 `existing`에 가장 나중 기록을 돌려준다. 거절은 `commitWrite()` 앞에서 반환하므로 원장 bytes가 그대로다. `--replace`는 `removeLatestWorkerTokens`로 가장 나중 `worker-tokens` 기록 하나를 빼고 새 기록을 넣으며, 뺀 기록을 `replaced`로 돌려준다. 교체할 기록이 없으면 `worker-tokens-replace-target-missing`이다.
- `packages/cli/src/cli-git-commands.ts` — `--replace`는 `worker-tokens` 전용이다. `worker-model`에 쓰거나 값을 붙이면 usage(exit 2)다. 값을 붙인 형태는 뒤 토큰을 값으로 먹어 교체 의도를 잃기 때문이다.
- `--tokens unreported`도 `--replace`로 교체할 수 있고, 숫자 값과 상호 교체된다.
- `agents/bouncer-coordinator.md` — worker가 보고 없이 끝나면 `worker-report-missing`, 실제 host handle로 상태를 확정할 수 없으면 `worker-state-unknown`이다. 부분 출력으로 판단하지 않고 다른 worker도 띄우지 않으며, `coordinate note`를 남기고 `blocked`로 돌려준다.
- `references/spec-authoring/index.md` — Checklist 규칙 두 항목이 더해졌다. 새 규칙 문서 문구는 `scripts/verify-*.js` 래퍼와 테스트가 고정한다.
- 알려진 한계: 이번 범위는 중복 거절과 교체까지다. `metrics summary` 집계 규칙, 기존 원장의 중복 기록 자동 정리, `worker-model --tokens`의 교체 경로는 바뀌지 않았다. 새 "다른 task 키" 테스트는 fixture에 task 001만 있어 blueprint 범위 키로 대신했고, 구현이 이미 통과하는 회귀 방지 단언이다.

## Quiz

1. 한 키의 `worker-model` 기록마다 이미 토큰 또는 `unreported` 기록이 채워져 있다. 같은 키에 `worker-tokens`를 `--replace` 없이 다시 호출하면?
   - A) 두 번째 기록이 덧붙고 합계에 더해진다.
   - B) `worker-tokens-duplicate`로 거절되고 원장은 호출 전과 같다.
   - C) 기존 기록이 조용히 새 값으로 덮어써진다.
2. 아직 `worker-tokens` 기록이 없는 키에 `worker-tokens --replace`를 호출하면?
   - A) 교체할 것이 없으므로 새 기록이 그냥 덧붙는다.
   - B) usage 오류(exit 2)로 거절된다.
   - C) `worker-tokens-replace-target-missing`으로 거절된다.
3. 한 키에 `worker-model`이 두 번 기록되고(재작업 호출) `worker-tokens`는 한 번만 기록돼 있다. 같은 키에 `worker-tokens`를 `--replace` 없이 한 번 더 호출하면?
   - A) 비어 있는 호출 자리가 하나 남아 있으므로 수용된다.
   - B) `worker-tokens-duplicate`로 거절된다.
   - C) `--replace`를 붙이라는 usage 오류가 난다.
4. coordinator가 worker를 띄웠는데 보고 없이 종료된 것을 확인했다. 새 종료 문단에 따르면 coordinator는?
   - A) 부분 출력을 읽고 결과를 판정해 통합을 이어 간다.
   - B) `coordinate note`를 남기고 `worker-report-missing`을 원인으로 `blocked`를 돌려준다.
   - C) 같은 task에 대체 worker를 한 번 더 dispatch한다.

## Tasks

### drive-execution/worker-tokens-duplicate-guard/001 · `497f91c6`

#### Goal & intent

`bouncer coordinate worker-tokens`가 같은 `(task, role, perspective)` 키에 이미 `worker-tokens` 기록이 있고 비어 있는 worker 호출 자리가 없으면 새 기록을 거절한다. 정정은 값 없는 `--replace`로 키의 가장 나중 기록 하나를 교체하는 경로뿐이다.

수용 기준:
1. 대응 `worker-model` 하나와 `worker-tokens` 하나가 있는 키에 두 번째 `worker-tokens`를 보내면 exit 1, `reason: 'worker-tokens-duplicate'`이고 원장 bytes가 그대로다.
2. 같은 호출에 `--replace`를 붙이면 exit 0이고 키의 `worker-tokens` 기록은 새 값 하나뿐이다(원장과 task `decisions` 모두). 응답에 `replaced`가 있다.
3. 다른 task·role·perspective 키와, 같은 키로 `worker-model`을 두 번 기록한 뒤의 `worker-tokens` 두 번은 거절되지 않는다. 세 번째는 거절된다.
4. `worker-tokens` 기록이 없는 키에 `--replace`를 주면 `worker-tokens-replace-target-missing`으로 거절된다.
5. `rules/cli.md`, usage 문자열, `agent-dispatch.md`가 이 계약을 말한다.
6. `worker-tokens-duplicate`·`worker-tokens-replace-target-missing`의 `cause`·`next`가 Interface literal과 같고, 중복 거절 `next`는 `--replace`가 같은 호출의 잘못 기록한 값을 고칠 때만 쓴다고 말한다.
7. `--tokens unreported --replace`는 허용되어 키의 가장 나중 기록을 교체한다.
8. task 검증 명령은 `node scripts/verify-worker-tokens-duplicate-guard.js`다.

#### Current behavior

- 입력: `coordinate worker-tokens --role R --tokens N [--task T] [--perspective P]`. 상태: `coordinateWorkerRecord`는 검증을 통과하면 무조건 `owner.decisions`와 `ledger.decisions`에 덧붙인다(`packages/cli/src/coordinator-commands.ts:943-944`). 출력: 같은 키의 두 번째 호출도 `ok: true`다.
- 집계: `sumWorkerDecisions`는 키 `JSON.stringify([task ?? '', role, perspective ?? ''])`마다 숫자 `tokens`를 모두 더하고(`packages/cli/src/drive-metrics.ts:530-553`), `reported`가 `runs`(worker-model 수)를 넘으면 누락 0이다. 그래서 `0` 뒤에 실값을 또 기록하면 합계는 맞아도 기록이 둘이고, 실값을 두 번 기록하면 합계가 두 배다. `pendingWorkerTokenKeys`는 같은 키로 `runs`와 `filled`(숫자 tokens 기록 + worker-tokens의 숫자·`unreported`)를 센다(`drive-metrics.ts:571-592`).
- `--replace`는 `revise`만 안다. `checkCommandFlags`의 값 붙은 `--replace` 검사는 `revise` 전용이고(`packages/cli/src/cli-git-commands.ts:694-704`), `checkWorkerFlags`는 `--replace`를 모른다(`:647-669`). `coordinateCall`은 `replace`를 core에 넘기지 않는다(`:844-`).
- 재현: preparedDrive에서 `worker-tokens --role reviewer --tokens 900 --task 001 --perspective security`를 두 번 실행하면 둘 다 exit 0이고 원장에 같은 키 기록이 둘이다. 확인한 기존 테스트: `test/cli-coordinate.test.js:1594-1634`(단일 기록), `test/coordinator.test.js:5620-5650`(core 단일 기록), `test/cli-metrics.test.js:445-512`(직접 구성한 원장 합산, CLI 비경유).
- I/O 관찰 지점: 원장 쓰기는 `commitWrite()`(`coordinator-commands.ts:945`) 하나다. 거절은 그 앞에서 반환해야 원장 bytes가 같다.

#### Target behavior

- 성공: 키에 `worker-tokens` 기록이 없으면 지금처럼 덧붙인다. 키에 기록이 있어도 `runs > filled`(비어 있는 호출 자리)이면 덧붙인다. `--replace`는 키의 가장 나중 `worker-tokens` 기록을 원장 `decisions`에서, `--task`가 있으면 그 task `decisions`에서도 빼고 새 기록을 각 배열 끝에 붙인다. 응답은 `{ok: true, command, decision, replaced}`다.
- 실패 (원장 불변): 기록이 있고 `runs <= filled`이면 `worker-tokens-duplicate`(응답에 `existing`: 키의 가장 나중 `worker-tokens` 기록). `--replace`인데 키에 `worker-tokens` 기록이 없으면 `worker-tokens-replace-target-missing`. 두 reason은 `COORDINATE_FAILURE_HINTS`에 cause·next를 가진다.
- usage(2): `worker-model`에 `--replace`, `worker-tokens --replace <값>`.
- `--tokens unreported --replace`는 허용된다. 키의 가장 나중 `worker-tokens` 기록(숫자든 `unreported`든)을 교체하고, 반대로 숫자 기록을 `unreported`로 교체하는 것도 허용된다. 교체 결과 기록은 `tokens`와 `unreported` 중 새 호출이 준 쪽 키 하나만 갖는다.
- 힌트 문구는 아래 Interface의 literal이 정본이다. `worker-tokens-duplicate`의 `next`는 `--replace`가 같은 호출의 잘못 기록한 값을 고칠 때만 쓴다고 말하고, rework 호출의 `worker-model` 기록이 빠졌으면 worker-model을 먼저 기록하라고 말한다.
- 보존: 합산·`pendingWorkerTokenKeys`·`worker-tokens-missing` 판정, `worker-tokens` decision 모양, 기존 형식 거절(`worker-model-role-invalid`, `worker-model-perspective-invalid`, `tokens-invalid`, `task-outside-blueprint`)의 사유와 순서는 그대로다. 새 거절은 이들 뒤에 온다.

#### Interface

- 제공:
  - 키 판정은 `(task, role, perspective)`이며 task·perspective 부재는 `''`다(예: `['001', 'reviewer', 'security']`, task 없는 blueprint 범위 키는 `['', 'reviewer', 'combined']`). `runs`는 키의 `worker-model` 수, `filled`는 숫자 `tokens`가 달린 기록(worker-model 포함) + `unreported` 기록 수다. 거절 조건은 `키의 worker-tokens 기록 수 >= 1 && runs <= filled`다.
  - `bouncer coordinate worker-tokens ... [--replace]`. `CoordinateArgs.replace?: boolean`(값 없는 `--replace`일 때만 `true`).
  - 성공 응답 `replaced`: 뺀 `worker-tokens` decision 객체. `--replace` 없는 성공 응답에는 `replaced` 키가 없다.
  - 신규 추출 지점: 키별 `runs`·`filled`·가장 나중 `worker-tokens` 기록을 한 번 계산하는 순수 함수. `pendingWorkerTokenKeys`와 키 규칙을 공유하려고 `drive-metrics.ts` 옆에 둔다. 내부 이름은 검색 힌트다.
- 문구 literal (영문, 아래 문장 그대로 쓴다. 문서 테스트는 각 문장 전체에 묶인다). 각 줄은 `이름: 문장`이고 문장은 줄 전체다. L1·L2는 `rules/cli.md`의 기존 `unreported` 서술 문장 뒤, `The worker-tokens-missing check covers these keys:` 앞에 둔다. L3는 `agent-dispatch.md`에서 `never estimated.` 바로 뒤에 둔다. usage 줄 둘은 기존 `unreported records that the host gave no value; metrics count it as missing.` 줄 뒤에 두고, registry 줄은 `[--perspective <name>]` 뒤에 ` [--replace]`만 더한다.
  ```text
  DUP_CAUSE: This worker key already has a worker-tokens record for every worker-model call recorded for it.
  DUP_NEXT: Use `--replace` only to correct the wrongly recorded value of the same call. For a rework call whose `bouncer coordinate worker-model` record is missing, record worker-model first, then worker-tokens.
  MISSING_CAUSE: No worker-tokens record exists for this key, so --replace has nothing to swap.
  MISSING_NEXT: Drop `--replace` and append the record with `bouncer coordinate worker-tokens`; `--replace` only corrects a record that already exists.
  L1: `worker-tokens` refuses a second record for a `(task, role, perspective)` key with `worker-tokens-duplicate` (exit 1, `existing` is the latest record, ledger unchanged) once every `worker-model` record of that key has a token or `unreported` record.
  L2: `worker-tokens --replace` (a flag with no value, `worker-tokens` only) swaps the latest `worker-tokens` record of the key and returns it as `replaced`; a key with no `worker-tokens` record is refused with `worker-tokens-replace-target-missing`, and `--replace` with a value or on `worker-model` is usage (exit 2).
  L3: To correct a recorded value, repeat the same `worker-tokens` call with `--replace`: it swaps the latest record of that key instead of appending another.
  USAGE1:   --replace (no value, worker-tokens only) swaps the latest worker-tokens record of the same key instead of appending.
  USAGE2:   A second record for a key whose worker-model calls are all filled is refused as worker-tokens-duplicate.
  ```
  `DUP_CAUSE`·`DUP_NEXT`는 `COORDINATE_FAILURE_HINTS['worker-tokens-duplicate']`의 `cause`·`next`, `MISSING_*`는 `['worker-tokens-replace-target-missing']`의 값이다. USAGE 줄 앞의 두 칸은 usage 본문 들여쓰기이며 이름 접두 뒤 공백 하나가 구분자다.
- 거부:
  - throw 입력 오류 목록(기존 그대로, 원장 불변): `worker-model-role-invalid`, `worker-model-perspective-invalid`, `tokens-invalid`, `task-outside-blueprint`.
  - 상태 거절 목록(새, 원장 불변, exit 1): `worker-tokens-duplicate`(`existing` 포함), `worker-tokens-replace-target-missing`.
  - usage(2): `worker-model --replace`(`coordinate worker-model: --replace is worker-tokens only`), `worker-tokens --replace x`(`coordinate worker-tokens: --replace takes no value`).
  - `worker-model --tokens N`으로 채워진 키에 `worker-tokens`가 없으면 거절하지 않는다(범위 밖). `--replace`는 `worker-model` 기록을 바꾸지 못한다.
- 테스트 seam: 새 주입 매개변수는 없다. CLI 테스트는 `coordinateCli(drive.integration, 'worker-tokens', [...])`와 `ledgerOf(drive)` 파일을 읽어 판정한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateWorkerRecord`, `COORDINATE_FAILURE_HINTS` | Modify | 검증 통과 후 무조건 덧붙임, 힌트 표 | 중복 거절, `--replace` 교체, 두 reason 힌트 | 상태 변경 진입점 `:882-960`, 쓰기 `:943-944`, 힌트 표 `:1604` |
| `packages/cli/src/coordinator-command-contracts.ts` | `CoordinateArgs` | Modify | worker 기록 인자 타입 | `replace?: boolean` 추가 | `strategy`·`reviewerTier`가 같은 방식으로 선언됨(`:14`) |
| `packages/cli/src/drive-metrics.ts` | 신규 추출 지점: 키별 runs·filled 계산 | Modify | `sumWorkerDecisions`·`pendingWorkerTokenKeys`가 키 규칙을 각자 가짐 | 중복 판정이 같은 키 규칙을 쓰는 순수 함수 추가 | 키 `:537`, `:580`. 중복 판정과 pending 판정이 갈라지지 않게 함 |
| `packages/cli/src/cli-git-commands.ts` | `checkWorkerFlags`, `checkCommandFlags`, `coordinateCall` | Modify | worker 플래그 검사, revise 전용 `--replace` 검사, core 인자 조립 | `--replace`를 worker-tokens에 허용, worker-model은 usage, 값 붙으면 usage, core에 전달 | `:647-669`, `:694-704`, `:844-880` |
| `packages/cli/src/cli-usage.ts` | `worker-tokens` usage, `coordinate` registry 줄 | Modify | usage 문자열 | `[--replace]`와 교체·중복 설명 추가 | `:17`, `:61`. `test/cli-help.test.js:507` |
| `rules/cli.md` | `worker-tokens` 서술 | Modify | 명령 계약 서술 | 중복 거절·`--replace`·새 reason 서술 | `rules/cli.md:325-345`. 기존 문장은 `test/coordinate-next.test.js:1857-1871`이 고정하므로 그대로 둔다 |
| `skills/bouncer-run/references/agent-dispatch.md` | 토큰 기록 문단 | Modify | 토큰 뒤늦은 기록 안내 | 정정은 `--replace`뿐이라는 한 줄 추가 | `:350-357`. 정본 정규식 `test/coordinate-next.test.js:1819-1832` |
| `test/cli-coordinate.test.js` | worker-tokens 중복·교체·usage 단언 | Modify | 단일 기록 단언 | 아래 Checklist 테스트 추가 | `:1594-1675` 인접 |
| `test/coordinator.test.js` | core 중복 판정 단언 | Modify | core 단일 기록 단언 | 키 규칙(runs·filled) 경계 단언 추가 | `:5615-5650` |
| `test/cli-help.test.js` | `worker-tokens --help` 단언 | Modify | 리뷰 플래그 부재 단언 | `--replace` 목록과 worker-model 부재 단언 추가 | `:507-512` |
| `test/coordinate-next.test.js` | 문서 계약 단언 | Modify | agent-dispatch·cli.md 문구 정규식 | 새 안내 문장 단언 추가 | `:1819-1871` |
| `test/doc-shape-cli.test.js` | `rules/cli.md`·`agent-dispatch.md` 표·문구 대조 | Modify (조건부) | 거절 표와 reason 대조 | 새 reason이나 서술 때문에 `npm run ci`가 깨질 때만 짝 단언을 맞춤 | `rules/cli.md:260`, `agent-dispatch.md:313`를 읽는 짝 테스트. 사용자 확정 짝 경로 |
| `test/reviewer-tier-docs.test.js` | `rules/cli.md` 문구 대조 | Modify (조건부) | cli.md 문구 단언 | 같은 조건에서만 짝 단언을 맞춤 | `rules/cli.md:11`을 읽는 짝 테스트. 사용자 확정 짝 경로 |
| `test/subagents.test.js` | `rules/cli.md` 문구 대조 | Modify (조건부) | cli.md 문구 단언 | 같은 조건에서만 짝 단언을 맞춤 | `rules/cli.md:562`를 읽는 짝 테스트. 사용자 확정 짝 경로 |
| `scripts/verify-worker-tokens-duplicate-guard.js` | task 검증 래퍼 | Create | 없음 | 빌드 → 테스트 → eslint → 문서 형식 → 테스트 이름 → typecheck → check:emit | 선례 `scripts/verify-coordinate-note-validation.js` |

Touch 근거(소비자 조사): `rg "worker-tokens" test skills agents references rules docs`가 가리킨 파일은 위 표의 테스트 4개와 `rules/cli.md`, `agent-dispatch.md`뿐이다. `test/cli-metrics.test.js`·`test/finalize-*.test.js`는 직접 구성한 원장만 쓰고 CLI 거절 경로를 거치지 않아 바꾸지 않는다. 짝 테스트 3개(`doc-shape-cli`·`reviewer-tier-docs`·`subagents`)는 `rules/cli.md`·`agent-dispatch.md` 문구를 읽으므로 사용자가 확정한 짝 경로이며, 기존 단언을 깨는 변경이 생길 때만 맞춘다.

#### Constraints

- 거절은 `commitWrite()` 호출 전에 반환한다. 거절 뒤 원장 bytes는 호출 전과 같아야 한다.
- 기존 reason과 검사 순서(role → perspective → strategy·tier → tokens → task)는 바꾸지 않고 새 거절은 `task-outside-blueprint` 뒤에 둔다.
- `drive-metrics.ts`에서는 새 순수 함수만 더한다. `sumWorkerDecisions`·`pendingWorkerTokenKeys`의 본문과 출력은 바꾸지 않는다(집계 규칙은 이번 범위 밖).
- 기존 단언은 바꾸지 않는다. 새 테스트만 더한다. 테스트 이름은 `<조건> → <결과>` 형식이다. 예외는 짝 테스트 3개뿐이다: `test/doc-shape-cli.test.js`의 `rules/cli.md rejection table …` 계열 3개(`:270`, `:286`, `:297`), `test/reviewer-tier-docs.test.js`의 `cli.md에 --tier 호출 형식이 없으면 → 실패한다`, `test/subagents.test.js`의 `model tier docs → item 1, cli.md, configuration.md state the tier/effort contract`. 이 문서들에는 새 문장만 더하고 기존 문장은 바꾸지 않으므로 세 테스트의 기대값은 그대로이며 통과해야 한다. 기존 문장을 바꿀 수밖에 없어 이 테스트가 깨질 때만 해당 테스트의 고정 문장·표 행을 새 문서 문구로 갱신할 수 있다(새 기대값 = 문서에 실제로 남은 새 문구). 새 단언은 그 파일들에 더하지 않는다.
- `--replace`는 `unreported`와 숫자 모두 교체한다. `--tokens unreported --replace`를 usage나 `tokens-invalid`로 거절하지 않는다.
- `rules/cli.md`의 기존 문장 중 `test/coordinate-next.test.js:1857-1871`이 고정하는 문장은 한 글자도 바꾸지 않는다.
- 문서 본문은 영어, `.js`·`.ts` 줄 길이는 120자 이내다.

### drive-execution/worker-tokens-duplicate-guard/002 · `dc4d7cd4`

#### Goal & intent

`agents/bouncer-coordinator.md`에 worker 최종 보고를 기다릴 수 없을 때의 출구 문단 하나를 더한다. 지금 문서는 "worker가 돌거나 보고가 남았으면 `blocked`·`continue`를 반환하지 않는다"만 말해, 기다릴 수 없는 경우 coordinator가 할 일이 문서에 없다.

수용 기준:
1. coordinator 문서에 아래 Checklist의 영어 문단이 그대로 있고, `## Worker dispatch` 본문은 20줄 이하를 유지한다.
2. 문단은 `worker-report-missing`과 `worker-state-unknown`을 모두 이름으로 말하고, 부분 출력으로 판정하지 않으며 `blocked`로 끝낸다고 말한다.
3. `.codex/agents/bouncer-coordinator.toml`이 새 md의 `mdToCodexToml(md, 'medium')`과 바이트 일치한다.
4. 새 테스트가 문단 전체에 묶인 패턴으로 문서를 검사하고, 문단을 지우면 실패한다.
5. task 검증 명령은 `node scripts/verify-coordinator-exit-doc.js`다.

#### Current behavior

- `agents/bouncer-coordinator.md:220-223`(`## Worker dispatch`, `:205-224`): "A handle or "started" notice is not a report: wait for it … Never return `blocked` or `continue` while a worker is still running or a report is outstanding." 기다릴 수 없을 때의 출구 문장은 없다.
- 두 stop 이름은 이 문서에 없다. 루트 `skills/bouncer-run/SKILL.md:208-216`의 판정표가 `unknown` + 보고 없음은 `worker-state-unknown`, `terminated` + 보고 없음은 `worker-report-missing`으로 멈추고 원장·worktree·pointer를 보존한다고 말한다.
- 제약: `## Worker dispatch` 본문 상한은 20줄이고 지금 정확히 20줄이다(`test/agents.test.js:240-245`가 `worker.split('\n').length <= 20`을 단언한다). 이 절에는 한 줄도 더할 수 없다. 이 절은 `drive-metrics.md` 링크를 갖고 `task-notification`이 없어야 한다(`:249-254`, `test/skill-bouncer-run.test.js:121-134`).
- 생성본 parity: `.codex/agents/bouncer-coordinator.toml`은 `test/agents.test.js:57-65`(`all seven role briefs → keep TOML parity …`)와 `scripts/check-emit.js:111-124`(index에 staged된 TOML과 md 변환 비교)가 지킨다.
- 재현: `node --test test/agents.test.js`가 통과하고, coordinator 문서에서 `worker-report-missing`을 찾으면 hit이 없다(`rg worker-report-missing agents`).

#### Target behavior

- 성공: `## Task round` 절의 마지막 문단으로 아래 Checklist 문단이 들어간다(`## Procedure` 바로 앞). 문단은 보고를 기다릴 수 없는 두 경우(`worker-report-missing`, `worker-state-unknown`)에서 coordinator가 기다리기·추측 판정·같은 task 재dispatch를 하지 않고 `coordinate note`를 남긴 뒤 보존 경로와 원인을 담은 `blocked`로 끝낸다고 말한다.
- 실패: 문단을 지우면 새 테스트가 실패한다. TOML을 다시 만들지 않으면 parity 테스트가 실패한다.
- 보존: `## Worker dispatch` 본문 줄 수, `## ` 제목 골격(`packages/cli/src/doc-shape-contracts.ts:88-93`), 기존 문장, `Output contract`의 Blocked 항목은 바뀌지 않는다.

#### Interface

- 제공: coordinator 문서의 문단 하나(영문). 이름이 붙은 stop 원인은 `worker-report-missing`(worker가 보고 없이 종료)과 `worker-state-unknown`(실제 host handle로 상태를 확정할 수 없음)이다. 두 이름은 루트 판정표의 이름을 그대로 쓴다.
- 거부: 문단은 새 outcome 값, 새 CLI 명령, 새 reason을 만들지 않는다. `outcome`은 기존 `blocked` 하나다. 문단은 부분 출력에서 보고를 만들어 판정하는 것, 같은 task의 worker를 coordinator가 다시 dispatch하는 것을 금지한다.
- 용어: `worker-report-missing`·`worker-state-unknown`은 루트 판정표의 stop 원인 이름이다(모양: 소문자 하이픈 토큰, 예: `worker-report-missing`). 이 문서에서는 `blocked` 보고에 적는 원인 문자열로만 쓴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `## Task round` 절 끝 | Modify | worker 보고를 모두 모을 때까지 반환하지 않는다고만 말함 | 기다릴 수 없을 때의 출구 문단 추가 | `:220-223`, 루트 판정표 `skills/bouncer-run/SKILL.md:208-216`. Worker dispatch 절은 20줄 상한이라 쓸 수 없음 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 본문 | Modify | coordinator md의 Codex 생성본 | 새 md에서 재생성 | parity `test/agents.test.js:57-65`, `scripts/check-emit.js:111-124` |
| `test/agents.test.js` | coordinator 문단 단언 | Modify | coordinator 문서 구조·문장 단언 | 새 문단 전체 단언과 삭제 시 실패 단언 추가 | 인접 단언 `:513-520`, `:531-545` |
| `test/salvage-report-docs.test.js` | coordinator 문서 문구 대조 | Modify (조건부) | `bouncer-coordinator.md:13` 문구 단언 | 새 문단 때문에 `npm run ci`가 깨질 때만 짝 단언을 맞춤 | 사용자 확정 짝 경로 |
| `test/skill-bouncer-run.test.js` | coordinator 문서 링크·문단 대조 | Modify (조건부) | `bouncer-coordinator.md:125` 등 단언 | 같은 조건에서만 짝 단언을 맞춤 | 사용자 확정 짝 경로 |
| `scripts/verify-coordinator-exit-doc.js` | task 검증 래퍼 | Create | 없음 | 빌드 → 테스트 → eslint → 문서 형식 → 테스트 이름 → check:emit | 선례 `scripts/verify-role-doc-rules.js` |

Touch 근거(소비자 조사): `rg "bouncer-coordinator.md" test`가 가리키는 `test/skill-bouncer-run.test.js:125,244`, `test/cli-help.test.js:363`, `test/distribution.test.js:276`, `test/salvage-report-docs.test.js:13`은 링크·특정 문단·존재만 읽어 새 문단과 충돌하지 않는다. 경로 계약 표(`doc-shape-contracts.ts:88`)는 제목 골격만 본다.

#### Constraints

- 문서 본문은 영어로 쓰고, 문단을 `## Worker dispatch` 절에 넣지 않는다. `task-notification` 문자열을 쓰지 않는다.
- TOML은 손으로 고치지 않고 아래 재생성 명령의 출력으로만 쓴다. `check:emit`이 staged 생성본을 보므로 `git add .codex/agents/bouncer-coordinator.toml`은 허용한다. commit·push·branch는 하지 않는다.
- 기존 `test/agents.test.js` 단언은 바꾸지 않는다. 새 테스트만 더한다. 테스트 이름은 `<조건> → <결과>` 형식이고 `.js` 줄 길이는 120자 이내다.
- 짝 테스트 `test/salvage-report-docs.test.js`(`coordinator 문서에 보존 report 설명이 없으면 → 파일 이름과 함께 실패한다`, 패턴 `salvage[\s\S]{0,300}\.report\.md`)와 `test/skill-bouncer-run.test.js`(coordinator 문서 링크 `:125`, `review-handoff:` 문단 `:244`를 읽는 테스트)는 새 문단이 기존 문장을 건드리지 않으므로 기대값이 그대로이며 통과해야 한다. 새 문단 때문에 둘 중 하나가 깨질 때만 해당 테스트의 고정 문장을 새 문서 문구로 갱신할 수 있다(새 기대값 = 문서에 실제로 남은 문구이며 새 단언은 더하지 않는다). `test/agents.test.js`의 기존 단언은 이 예외에 들지 않는다.
- 문단은 줄바꿈 없이 한 줄로 쓰지 않아도 된다. 새 테스트는 문서를 `flat = (t) => t.replace(/\s+/g, ' ')`로 접은 뒤 문단 패턴을 맞춘다.

### drive-execution/worker-tokens-duplicate-guard/003 · `e0d1702c`

#### Goal & intent

`references/spec-authoring/index.md`의 Checklist 작성 규칙에 두 항목을 더한다. 하나는 Interface가 분기 matrix를 제공하면 셀마다 Checklist 한 행을 쓰라는 규칙이고, 다른 하나는 문서·help 문구 단언을 피하되 문구가 계약이면 새 문장 전체를 묶고 문장을 지우면 실패하게 하라는 규칙이다.

수용 기준:
1. `index.md`의 Checklist 규칙 목록에 `(branch matrix)`와 `(doc wording)` 두 항목이 아래 Checklist의 문장 그대로 있다.
2. 새 테스트가 두 항목 각각의 전체 문장에 묶인 단언을 하고, 한 항목을 지운 문서에서는 실패한다.
3. 기존 `index.md` 문장과 `test/skill-bouncer-surface.test.js`의 plan 문서 단언(light 어휘 부재 등)이 계속 통과한다.
4. task 검증 명령은 `node scripts/verify-checklist-authoring-rules.js`다.

#### Current behavior

- `references/spec-authoring/index.md:203-234`가 Checklist 규칙을 `- **Checklist** (…)` 항목으로 나열한다(expected red, reachable red, generated artifacts, focused vs verify, verify vs paths, behavior assertions). 분기 matrix를 셀마다 확인하라는 규칙과 문서 문구 단언 규칙은 없다.
- `references/spec-authoring/tasks.md`(75줄)는 규칙 목록이 아니라 완성 예시이고 `test/build-release.test.js:200-201`이 배포 파일로 확인한다. 규칙을 더하는 곳이 아니다.
- 고정점: `test/skill-spec-authoring.test.js`가 `readSkill('spec-authoring')`(= `references/spec-authoring/index.md`, `test/helpers/read-skill.js`)로 index.md를 읽는다. `test/skill-bouncer-surface.test.js:461-515`는 이 파일을 포함한 PLAN_DOCS에서 `plan.light_scope|--scale light|Lightweight cycle|light plan`과 `scale: light|\blight`(대소문자 무시)의 부재를 단언한다. 새 문장에 `light`로 시작하는 낱말을 쓰면 실패한다.
- 선례: `test/cli-help.test.js:510-515`의 주석이 이미 같은 문제를 말한다. 기존 문장(`--perspective is reviewer-only.`)과 겹치는 정규식은 새 설명이 사라져도 통과하므로 새 문장을 직접 묶었다.
- 재현: `node --test test/skill-spec-authoring.test.js`가 통과하고, `rg "branch matrix|doc wording" references/spec-authoring/index.md`는 hit이 없다.

#### Target behavior

- 성공: `index.md`의 `- **Checklist** (behavior assertions): …` 항목 바로 뒤에 두 항목이 아래 문장 그대로 들어간다.
- 실패: 새 테스트는 두 문장 중 하나라도 문서에서 빠지거나 문구가 바뀌면 실패한다.
- 보존: 기존 규칙 문장, 번호 단계, `## Language and prose` 이후 절, 한국어 본문·영어 식별자 규칙은 바뀌지 않는다. `light` 계열 낱말을 쓰지 않는다.

#### Interface

- 제공: 문서 항목 두 개(한국어 본문, 식별자는 원문).
  - `branch matrix`: 두 축 이상의 분기 표를 Interface에 둔 task는 표의 셀 수만큼 Checklist 행을 쓴다. 용어 `분기 matrix`는 Interface가 입력 조합(축 값의 곱)마다 서로 다른 결과를 정의한 표이며, 예는 perspective 5종 × tier 2종의 10셀이다.
  - `doc wording`: 문서·help 문구를 단언하지 않는 것이 기본이다. 문구가 계약인 예외에서는 패턴이 새 문장 처음부터 끝까지를 묶고, 그 문장을 삭제하면 실패해야 한다.
- 거부: 두 항목은 새 gate, 새 G/S 코드, 새 CLI 검사를 만들지 않는다. 기존 문장의 의미를 바꾸거나 `tasks.md` 예시를 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | Checklist 규칙 목록 | Modify | Checklist 작성 규칙 정본 | `(branch matrix)`·`(doc wording)` 항목 두 개 추가 | `:203-234`. 규칙이 사는 곳 |
| `test/skill-spec-authoring.test.js` | 새 규칙 문장 단언 | Modify | 신원·예제·Mermaid·rounds 예제 단언 | 두 문장 전체 단언과 삭제 시 실패 단언 추가 | `readSkill('spec-authoring')` 사용 `:11`, `:28` |
| `test/skill-bouncer-surface.test.js` | PLAN_DOCS 단언 | Modify (조건부) | `spec-authoring/index.md:461` 어휘 부재 단언 | 새 문장 때문에 `npm run ci`가 깨질 때만 짝 단언을 맞춤 | 사용자 확정 짝 경로 |
| `scripts/verify-checklist-authoring-rules.js` | task 검증 래퍼 | Create | 없음 | 빌드 → 테스트 → eslint → 문서 형식 → 테스트 이름 | 선례 `scripts/verify-handoff-order-docs.js` |

Touch 근거(소비자 조사): `rg "spec-authoring/index.md" test`는 `test/skill-bouncer-surface.test.js:461`(PLAN_DOCS)과 `test/build-release.test.js`(배포 파일 목록)만 가리킨다. 배포 목록은 파일 존재만 보고, PLAN_DOCS 단언은 위 Current behavior의 어휘 금지만 본다. 경로 계약 표(`doc-shape-contracts.ts`)에는 이 파일이 없다.

#### Constraints

- `light`로 시작하는 낱말(대소문자 무시)을 새 문장에 쓰지 않는다. 항목은 기존 항목과 같은 들여쓰기(`     - **Checklist** (…): …`)와 줄바꿈 폭(80~100자)을 따른다.
- 새 문장에 Epic·Blueprint 식별자를 쓰지 않는다. 문장은 한국어 본문에 식별자·코드는 원문이다.
- 기존 `test/skill-spec-authoring.test.js` 단언은 바꾸지 않는다. 새 테스트만 더한다. 테스트 이름은 `<조건> → <결과>` 형식이고 `.js` 줄 길이는 120자 이내다.
- 짝 테스트 `test/skill-bouncer-surface.test.js`는 `plan docs → omit retired light-scope vocabulary`(금지 패턴 `plan.light_scope|--scale light|Lightweight cycle|light plan`)와 `plan docs except closed-record readers → omit scale: light and the word light`(금지 패턴 `scale: light|\blight`, 대소문자 무시)가 `references/spec-authoring/index.md`를 PLAN_DOCS로 읽는다. 새 문장에 `light`로 시작하는 낱말이 없으면 기대값은 그대로 "금지 패턴이 없다"이며 이 테스트는 수정하지 않는다. 새 문장이 이 테스트를 깨뜨리면 테스트를 고치지 않고 문장에서 해당 낱말을 뺀다. 즉 이 파일의 편집은 예상하지 않으며, 예외는 문서 문구를 바꿔도 풀 수 없는 깨짐이 생겼을 때 그 고정 문장을 새 문구로 갱신하는 것으로 한정한다.

### drive-execution/worker-tokens-duplicate-guard/004

#### Goal & intent

세 구현 task(worker-tokens 중복 거절, coordinator 종료 문단, Checklist 작성 규칙)가 모두 통합된 뒤 전체 검증 `npm run ci`가 한 번 통과함을 증적으로 남긴다.

수용 기준: `npm run ci`가 exit 0이고 execute gate가 그 증적을 기록한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/worker-tokens-duplicate-guard/005 · `b6ea4b2a`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-CT-001 (minor, correctness_tests, must_fix) — test/cli-coordinate.test.js#worker-tokens on other keys and two worker-model calls → first records pass and only the third is refused — tasks/001 Checklist
- SS-001 (minor, spec_scope, must_fix) — test/cli-coordinate.test.js#worker-tokens duplicate/replace tests — tasks/001 Constraints

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/cli-coordinate.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.