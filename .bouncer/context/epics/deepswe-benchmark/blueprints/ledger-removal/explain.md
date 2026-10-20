---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/deepswe-benchmark/blueprints/ledger-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T22:58:58.477+09:00'
bouncer:
  id: EXPLAIN-ledger-removal
  epic_id: deepswe-benchmark
  blueprint_id: ledger-removal
  status: published
  comprehension:
    - range_from: 68bf487a284ab7e25f886ca278af46dbdb4c10a4
      range_to: 940506e172e5764782d28793b8f1541a1bfe1c14
      diff_sha: 449782aefadc70c9328d2d8c9ef54c9df5862c6f239a50785eccedb44c9e7ad3
      recorded_at: '2026-10-11T23:10:00+09:00'
  task_commits:
    - task: deepswe-benchmark/ledger-removal/001
      sha: '54216389'
      intent_anchor: task-001
    - task: deepswe-benchmark/ledger-removal/002
      sha: '940506e1'
      intent_anchor: task-002
---
# Explain

## Background

ledger 합성 과제는 vanilla 조건도 만점을 받아 조건 간 비교 가치가 없었다. 그런데 응답기 회귀 fixture와 실행기 기본값이 ledger 자산에 묶여 있어 과제를 지울 수 없었다.
이 변경은 응답기 테스트를 fastify-001 실행 녹취와 규칙 형식 합성 원문으로 옮기고, ledger 과제·정책·검증기·보고서와 그 참조를 모두 지웠다. 이제 벤치마크 하네스는 fastify-001만으로 동작한다.
실행기에는 기본 과제가 없다. `--task`를 빠뜨리면 조용히 다른 과제로 돌지 않고 바로 실패한다.

## Intuition

한 과제에만 맞춰 둔 시험장을 철거하고, 어떤 과제를 칠지 매번 이름표를 달아야 들어갈 수 있게 문을 바꾼 것이다.

## Code

- `benchmarks/acp/responder.cjs` — `run.start_drive` 게이트가 plan 게이트 증거 판정을 주입받을 수 있다(`deps.planGateEvidence`). 주입이 없으면 이전처럼 실제 plan 게이트 결과를 본다.
- `benchmarks/acp/responder.test.cjs`, `benchmarks/acp/fixtures/acq`, `benchmarks/acp/fixtures/stage-final` — fastify-001 녹취와 규칙 형식 합성 원문으로 교체됐고, 테스트는 `fastify-001-evaluator-policy.json`만 읽는다.
- `benchmarks/run-cursor.cjs`, `benchmarks/run-bouncer-full.cjs`, `benchmarks/stage-args.cjs` — `--task`가 필수 인자다. 검사는 다른 필수 인자 검사 바로 뒤, 파일 존재 검사 앞에 있다.
- `benchmarks/runner-args.test.cjs`, `benchmarks/task-card.test.cjs` — 필수 `--task` 동작과 과제 카드 로딩을 확인한다.
- `benchmarks/docker/compose.cursor.yaml` — 검증기 이미지 이름이 `bouncer-benchmark-verifier:local`로 바뀌었다.

## Quiz

1. `benchmarks/run-cursor.cjs`를 `--task` 없이 실행하면 어떻게 되는가?
   - A) 이전처럼 `ledger-001`로 조용히 실행된다.
   - B) `fastify-001`이 새 기본값으로 실행된다.
   - C) `--task is required` 오류로 바로 실패한다.
2. 응답기의 `run.start_drive` 게이트에서 `deps.planGateEvidence`를 주입하지 않으면 어떻게 동작하는가?
   - A) 실제 plan 게이트 결과를 증거로 쓴다.
   - B) 항상 증거가 있는 것으로 본다.
   - C) 게이트가 응답하지 않고 건너뛴다.
3. `--task`가 없을 때와 작업 디렉터리 파일이 없을 때 중 어느 오류가 먼저 나오는가?
   - A) 작업 디렉터리 파일 검사 오류가 먼저 나온다.
   - B) `--task` 검사가 파일 존재 검사보다 앞서므로 `--task` 오류가 먼저 나온다.
   - C) 둘 중 먼저 평가되는 쪽이 정해져 있지 않다.

## Tasks

### deepswe-benchmark/ledger-removal/001 · `54216389`

#### Goal & intent

`benchmarks/acp/responder.test.cjs`와 그 fixture가 ledger 정책·녹취 없이 같은 응답기 계약(판독 블록 응답, 엄격 제목 응답, 계약 위반 멈춤, finalize 증거 없을 때 무응답, 최종 보고 `none`)을 검사하게 한다.
완료 조건은 `git grep -il -E 'ledger-00|ledger-cli|ledger-v2|v088' -- benchmarks/acp`가 아무것도 출력하지 않고 `npm run ci`가 통과하는 것이다. 이 검사는 ledger 벤치마크 참조만 본다. fastify 녹취 원문에 남는 coordinator 원장 표현("coordinator ledger", "ledger sha256")은 그대로 복사하는 녹취 내용이라 대상이 아니다.

#### Current behavior

- 재생 루프 `benchmarks/acp/responder.test.cjs:155-180`이 `fixtures/acq/cases.json` 21개 항목(`violation` 20, `answer` 1)을 읽는다. `source`는 ledger run id(`1790646534668-bouncer-full/02-plan`, `v088004-ledger-004-bouncer-full-1 04-finalize` 등)이고 fixture 디렉터리에 `.md` 26개가 있다. 이 중 19개 파일 본문에 ledger 단어가 있다.
- 인라인 `policy`(`:12-18`)가 ledger 사실(`product_paths`의 `src/ledger.js`, ledger `discovery_terms`, `reusable_draft` `001-monthly-summary`)을 갖는다. `:184` `prdFacts`, `:305-306`, `:321-323`이 ledger 경로를 단언한다.
- `require('../configs/ledger-001-evaluator-policy.json')`이 `:52`, `:465`에 있고, `POLICY_NAMES`(`:662`)와 `realPolicy('ledger-001')`(`:674`, `:682`, `:689`, `:696`)가 ledger 정책을 읽는다. `:450`, `:467-471`은 테스트 이름·`task_id`에 ledger를 쓴다. `:392` 주석이 `v088006-ledger-004`를 가리킨다.
- `stage-final` 테스트(`:643-652`)가 `fixtures/stage-final/*.txt`가 정확히 8개(ledger v088005·v088006의 01~04 단계)라고 단언한다. `fixtures/v088-plan-open-decision.txt`(`:618`)와 `fixtures/acq/finalize-remainder-en.md`(`:182`)도 ledger 실행 녹취다.
- `responder.cjs:401` 주석이 `ledger-003`를 언급한다.
- 대체 녹취(gitignore된 로컬 데이터, main checkout 읽기 전용): `/home/cheongwoon/workspace/bouncer/benchmarks/runs/up1-fastify-001-bouncer-full-{1r3,2r3,3r3}/`
  - `01-init`: `init.gitignore`, `init.pre_commit_hook`.
  - `02-plan`: `plan.discovery`, `plan.id_allocation`, `plan.light_scope`, `plan.affected_paths`, `plan.verify_command`, `plan.approval`, open decisions.
  - `03-run`: `run.start_drive`.
  - 질문 원문은 각 단계 `cursor-turns/*.jsonl`의 assistant 텍스트, 응답 결과는 `decisions.json`, 최종 보고는 `final-answer.txt`(단계마다 1개)다.
  - finalize 단계와 `plan.activate_pointer` 녹취는 없다.
- 재현: `node --test benchmarks/acp/responder.test.cjs`가 현재 통과한다.

#### Target behavior

- 성공:
  - `cases.json`의 모든 항목은 `source`가 `up1-fastify-001-bouncer-full-<n>r3/<stage>` 또는 `synthetic:rules/acq.md`다.
  - fastify 녹취는 위 게이트마다 판독 블록이 있는 질문 원문 하나 이상을 담고, fastify-001 정책으로 기대 `reply`·`gates`에 답하는 `answer` 사례다.
  - 합성 원문은 네 가지다. ① `finalize.remainder` 질문(`finalizeEvidence` 주입 시 answer) ② 블록 `options`와 본문 선택지가 다른 위반 ③ 블록 없는 옛 표시 위반 ④ 판독 블록 없이 제목에 카탈로그 게이트 id와 `- X)` 선택지 둘 이상을 가진 엄격 제목 질문(answer, `readStrictQuestions` 경로). ②·③은 `violation`이다.
  - 게이트 커버리지: `init.gitignore`, `init.pre_commit_hook`, `plan.discovery`, `plan.id_allocation`, `plan.light_scope`, `plan.affected_paths`, `plan.verify_command`, `plan.approval`, `run.start_drive` 각각에 `expect: answer` 항목이 하나 이상 있다. 녹취 원문이 없거나 fastify 정책으로 답하지 못하는 게이트는 `rules/acq.md` 형식의 합성 원문(`source: synthetic:rules/acq.md`)으로 채운다.
  - `finalize-remainder-en.md`는 지우고 같은 내용의 합성 원문 `synthetic-finalize-remainder.md`를 만들며, `:181-184` 무응답 테스트의 경로를 그 파일로 바꾼다.
  - `plan.activate_pointer` 사례는 지운다.
  - `stage-final`은 `up1-fastify-001-bouncer-full-1r3`의 `01-init`·`02-plan`·`03-run` 최종 보고 3개로 바꾸고, 개수 단언을 3으로 바꾼다.
  - `v088-plan-open-decision.txt`는 블록 없는 open decisions 합성 원문으로 바꾼다.
- 실패: 녹취 원문 중 응답기가 fastify 정책으로 답하지 못하는 항목은 fixture로 넣지 않고, 그 게이트는 위 커버리지 규칙대로 합성 원문으로 채운다. 넣지 않은 녹취와 이유는 커밋 전 보고에 적는다(응답기 동작은 바꾸지 않는다).
- 성공(검사): 재생 루프는 각 항목의 `gates` id가 `rules/acq-gates.json` 카탈로그 안에 있는지, `source`가 `^up1-fastify-001-bouncer-full-[123]r3/0[1-3]-(init|plan|run)$` 또는 `synthetic:rules/acq.md`인지 단언한다.
- 보존: 응답기(`responder.cjs`) 동작, `IMPLEMENTED_ANSWERS`, `loadPolicy` 검증 규칙, 재생 루프의 응답·위반 판정 구조.

#### Interface

- 제공: fixture 파일 이름은 녹취가 `<gate>-<lang>.md`(예: `plan-approval-ko.md`), 합성이 `synthetic-<kind>.md`(예: `synthetic-options-mismatch.md`)다. `cases.json` 항목 형식은 기존과 같다.
- 거부: 카탈로그(`rules/acq-gates.json`)에 없는 게이트 id를 `gates`에 쓰는 항목, `source`가 위 두 형식이 아닌 항목. 재생 테스트가 실패한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.test.cjs` | `policy`, `prdFacts`, `POLICY_NAMES`, `realPolicy` | Modify | ledger 사실·정책으로 응답기 계약 검사 | fastify-001 `task_facts`와 정책으로 바꾸고, 재생 루프에 `source` 형식 단언을 더하고, 개수 단언·fixture 경로를 갱신 | `:12-18`, `:52`, `:155-180`, `:184`, `:305-323`, `:392`, `:450-471`, `:618`, `:643-652`, `:662-698` |
| `benchmarks/acp/responder.cjs` | 주석 `:401` | Modify | ledger-003 예시 주석 | 과제 일반 표현으로 고침 | 성공 기준 1 rg |
| `benchmarks/acp/fixtures/acq/` | `cases.json`, `*.md` | Modify | ledger 녹취 재생 데이터 | ledger 원문 삭제, fastify 녹취·합성 원문 추가 | 재생 루프 `:155-180` 입력 |
| `benchmarks/acp/fixtures/stage-final/` | `*.txt` | Modify | ledger 최종 보고 8개 | fastify 최종 보고 3개 | `:643-652` |
| `benchmarks/acp/fixtures/v088-plan-open-decision.txt` | 파일 | Delete | ledger open decisions 녹취 | 합성 원문 새 파일로 대체 | `:618` |
| `benchmarks/acp/fixtures/synthetic-open-decisions-unmarked.txt` | 파일 | Create | 없음 | 블록 없는 open decisions 합성 원문 | `:618` 테스트 입력 |

#### Constraints

- 녹취 원문은 바꾸지 않고 그대로 복사한다. 줄 끝 공백도 유지한다. 합성 원문은 `rules/acq.md`의 표시 골격(제목 줄, 판독 블록, Re-ground/Recommend-why/Options)을 따른다.
- 테스트 이름은 "<조건> → <결과>" 형식이고 반환값만 단언한다.
- 정책을 읽는 테스트는 `fastify-001-evaluator-policy.json`(approved)만 쓴다. 변형은 임시 파일로 만든다(`policyFile`).

### deepswe-benchmark/ledger-removal/002 · `940506e1`

#### Goal & intent

저장소에서 ledger 벤치마크 자산과 그 참조를 지우고, 하네스·테스트·문서가 fastify-001만으로 동작하게 한다.
완료 조건은 `git grep -il -E 'ledger-00|ledger-cli|ledger-v2' -- benchmarks test ':!benchmarks/configs/fastify-001-evaluator-policy.json'`이 빈 출력이고 `npm run ci`가 통과하는 것이다.

#### Current behavior

- 삭제 대상으로 추적 중인 파일은 64개다.
  - `benchmarks/tasks/ledger-00{1..4}.{yaml,prd.md}`, `benchmarks/tasks/ledger-v2-pilot.md`
  - `benchmarks/rubrics/ledger-00{1..4}.md`와 `benchmarks/rubrics/ledger-00{1..4}/` 데이터
  - `benchmarks/verifiers/ledger-00{1..4}.cjs`, `ledger-00{2,3,4}.test.cjs`, `benchmarks/verifiers/testdata/ledger-00{2,4}/`
  - `benchmarks/configs/ledger-00{1..4}-evaluator-policy.json`
  - `benchmarks/fixtures/ledger-cli.bundle`, `ledger-cli-v2.bundle`, `ledger-003.wip.patch`, `ledger-003.test-report.txt`
  - `benchmarks/reports/` 12개(2026-10-08·10-09 ledger-004 보고서와 하위 디렉터리)
- `benchmarks/verifiers/lib.cjs`는 `upstream-tests.cjs:14`가 `checkoutWithPatch`로 쓰므로 남는다. `:3-4` 머리 주석만 ledger를 언급한다.
- `--task`가 없을 때 `ledger-001`로 기본 설정하는 곳이 세 군데다.
  - `benchmarks/run-cursor.cjs:43`
  - `benchmarks/stage-args.cjs:32`
  - `benchmarks/run-bouncer-full.cjs:45`
  - 기본값 대신 `loadCard`(`task-card.cjs:113-117`)가 파일 없음으로 실패한다.
- `benchmarks/task-card.test.cjs`가 ledger 카드에 의존하는 곳은 다음과 같다.
  - `:24`: ledger id 포함 단언.
  - `:35-50`: ledger-002 카드로 sha·필드 거부 검사.
  - `:59-65`: ledger-003 verifier argv.
  - `:67-72`: ledger bundle.
  - `:74-86`: ledger-003 WIP 적용.
  - `:88-91`: 경로 문자열.
  - fastify-001 bundle은 gitignore(`.gitignore:26-27`)되어 CI에 없다.
- 그 밖의 참조는 다음과 같다.
  - `test/acq-gate-ids.test.js:51` `POLICY_NAMES`
  - `test/coordinate-next.test.js:731` 주석(`v088 ledger-004`)
  - `benchmarks/docker/Dockerfile.cursor:61` 기본 ENTRYPOINT `verifiers/ledger-001.cjs`
  - `benchmarks/docker/compose.cursor.yaml:47` 이미지 이름 `bouncer-benchmark-ledger-verifier:local`. 저장소에서 이 이름을 쓰는 곳은 여기뿐이다.
- ledger를 언급하는 문서는 다음과 같다.
  - `benchmarks/README.md:7,12-26`
  - `benchmarks/configs/README.md:14,16,18,21`
  - `benchmarks/verifiers/README.md:1-9,27-44`
  - `benchmarks/docker/README.md:26,38,114`
  - `benchmarks/upstream/README.md:3`
  - `benchmarks/fixtures/README.md` 대부분
  - `benchmarks/tasks/fastify-001-pilot.md:150`
- `npm run ci`의 `test:coverage`는 인자 없는 `node --test`라 `benchmarks/**/*.test.cjs`를 모두 돈다. `package.json`, `test/tiers.json`, `.gitignore`에는 ledger 항목이 없다.

#### Target behavior

- 성공: 위 64개 파일이 지워진다. 세 실행기는 `--task`가 없으면 `--task is required` 오류로 끝난다. `task-card.test.cjs`는 fastify-001 카드와 임시 git 저장소·임시 카드로 같은 계약을 검사한다. 문서는 fastify-001과 상류 커밋 과제 기준으로 고쳐지고 끊어진 링크가 없다.
- 실패: `--task` 없이 실행하면 카드 로드·docker 호출 전에 끝난다.
- 보존: fastify-001 카드·정책·빌더·검증기(`upstream-tests.cjs`, `lib.cjs`), 실행기의 나머지 인자 규칙과 기록 필드, verifier 컨테이너 설정(네트워크 없음, 읽기 전용).

#### Interface

- 제공:
  - `run-cursor.cjs --task <id>`, `run-bouncer-full.cjs --task <id>`, `stage-args.cjs`의 `--task`가 필수 인자다.
  - 테스트 seam: `run-cursor.cjs`는 인자 파서 `options(argv)`를 내보내고 `main()`을 `require.main === module`일 때만 실행한다. `run-bouncer-full.cjs`는 `configOf(argv)`를 기존 `module.exports`에 더한다. `stage-args.cjs`는 기존 `argsOf`를 쓴다. 세 파서는 docker를 부르지 않는다.
  - verifier 이미지 이름은 `bouncer-benchmark-verifier:local`, 기본 ENTRYPOINT는 `["node", "/benchmark/verifiers/upstream-tests.cjs"]`다.
- 거부: `--task` 누락은 오류 메시지 `--task is required`와 0이 아닌 종료 코드다(`run-cursor.cjs`는 기존 `fail()` 경로를 쓴다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/tasks/ledger-001.yaml` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-001.prd.md` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-002.yaml` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-002.prd.md` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-003.yaml` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-003.prd.md` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-004.yaml` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-004.prd.md` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/tasks/ledger-v2-pilot.md` | 파일 | Delete | ledger 과제 정의 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-001.md` | 파일 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-001` | 디렉터리 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-002.md` | 파일 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-002` | 디렉터리 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-003.md` | 파일 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-003` | 디렉터리 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-004.md` | 파일 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/rubrics/ledger-004` | 디렉터리 | Delete | ledger 루브릭 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-001.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-002.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-003.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-004.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-002.test.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-003.test.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/ledger-004.test.cjs` | 파일 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/testdata/ledger-002` | 디렉터리 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/testdata/ledger-004` | 디렉터리 | Delete | ledger 채점 | 삭제 | 성공 기준 1 |
| `benchmarks/configs/ledger-001-evaluator-policy.json` | 파일 | Delete | ledger 평가자 정책 | 삭제 | 성공 기준 1 |
| `benchmarks/configs/ledger-002-evaluator-policy.json` | 파일 | Delete | ledger 평가자 정책 | 삭제 | 성공 기준 1 |
| `benchmarks/configs/ledger-003-evaluator-policy.json` | 파일 | Delete | ledger 평가자 정책 | 삭제 | 성공 기준 1 |
| `benchmarks/configs/ledger-004-evaluator-policy.json` | 파일 | Delete | ledger 평가자 정책 | 삭제 | 성공 기준 1 |
| `benchmarks/fixtures/ledger-cli.bundle` | 파일 | Delete | ledger 작업 공간 원본 | 삭제 | 성공 기준 1 |
| `benchmarks/fixtures/ledger-cli-v2.bundle` | 파일 | Delete | ledger 작업 공간 원본 | 삭제 | 성공 기준 1 |
| `benchmarks/fixtures/ledger-003.wip.patch` | 파일 | Delete | ledger 작업 공간 원본 | 삭제 | 성공 기준 1 |
| `benchmarks/fixtures/ledger-003.test-report.txt` | 파일 | Delete | ledger 작업 공간 원본 | 삭제 | 성공 기준 1 |
| `benchmarks/verifiers/lib.cjs` | 머리 주석 | Modify | 공용 checkout 도우미 | 주석을 upstream 검증기 기준으로 고침 | `:3-4` |
| `benchmarks/reports/` | ledger 보고서 12개 | Delete | ledger 비교 결과 | 삭제 | 사용자 결정 |
| `benchmarks/run-cursor.cjs` | `options` `:22-43`, `main` 호출 `:256` | Modify | `--task` 기본값 ledger-001, 로드 시 `main()` 실행 | 필수 인자, `options` export와 `require.main` 가드 | 성공 기준 3 |
| `benchmarks/stage-args.cjs` | `:32` | Modify | 같음 | 필수 인자 | 성공 기준 3 |
| `benchmarks/run-bouncer-full.cjs` | `configOf` `:27-45`, `module.exports` `:395` | Modify | 같음 | 필수 인자와 `configOf` export | 성공 기준 3 |
| `benchmarks/runner-args.test.cjs` | 테스트 | Create | 없음 | 세 실행기의 `--task` 필수 검사 | 성공 기준 3 |
| `benchmarks/task-card.test.cjs` | 테스트 6개 | Modify | ledger 카드로 카드 계약 검사 | fastify-001 카드와 임시 저장소·카드로 교체 | `:24-91` |
| `benchmarks/docker/Dockerfile.cursor` | `verifier` 단계 ENTRYPOINT | Modify | ledger-001 기본 진입점 | `upstream-tests.cjs` | `:61` |
| `benchmarks/docker/compose.cursor.yaml` | `verifier.image` | Modify | ledger 이미지 이름 | `bouncer-benchmark-verifier:local` | `:47` |
| `test/acq-gate-ids.test.js` | `POLICY_NAMES` | Modify | 다섯 정책 커버리지 | `['fastify-001']` | `:51` |
| `test/coordinate-next.test.js` | 주석 `:731` | Modify | ledger 실행 사례 언급 | 일반 표현 | 성공 기준 1 rg |
| `benchmarks/README.md` | 본문 | Modify | ledger 중심 구조 설명 | fastify-001·상류 과제 기준 | `:7,12-26` |
| `benchmarks/configs/README.md` | 본문 | Modify | ledger 정책 설명 | fastify-001 정책 기준 | `:14-21` |
| `benchmarks/verifiers/README.md` | 본문 | Modify | ledger 검증기 설명 | `upstream-tests.cjs` 설명 | `:1-44` |
| `benchmarks/docker/README.md` | 본문 | Modify | ledger 예시 명령 | fastify-001 예시 | `:26,38,114` |
| `benchmarks/upstream/README.md` | 본문 | Modify | ledger 비교 문장 | 일반 표현 | `:3` |
| `benchmarks/fixtures/README.md` | 본문 | Modify | ledger bundle 설명 | 상류 bundle 생성물 설명 | 대부분 ledger |
| `benchmarks/tasks/fastify-001-pilot.md` | 본문 | Modify | ledger 비용 비교 문장 | 일반 표현 | `:150` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 이력 | BP 001 항목 추가(과거 항목 유지) | 성공 기준 10 |

#### Constraints

- 실행기의 다른 인자 검증 순서와 메시지는 바꾸지 않는다. `--task` 검사는 각 파서의 필수 인자 검사 바로 뒤, 파일 존재 검사(`work directory missing`, 키 파일) 전에 둔다.
- 임시 카드·저장소는 `mkdtempSync` 아래에 만들고 `t.after`로 지운다. 테스트는 gitignore된 `fixtures/upstream/`에 기대지 않는다.
- CHANGELOG 과거 항목의 ledger 언급은 그대로 둔다.