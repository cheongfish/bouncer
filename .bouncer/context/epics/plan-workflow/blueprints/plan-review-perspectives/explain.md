---
type: bouncer.explain
title: plan-review-perspectives explain
description: Explain for plan-review-perspectives
resource: .bouncer/context/epics/plan-workflow/blueprints/plan-review-perspectives/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T07:17:03.954+09:00'
bouncer:
  id: EXPLAIN-plan-review-perspectives
  epic_id: plan-workflow
  blueprint_id: plan-review-perspectives
  status: published
  comprehension:
    - range_from: 764aba56d2cfc63e5676e9cd2784b5e4273d9709
      range_to: b6d91c90ad0f2fe23caf0787146427626980c947
      diff_sha: 7ed02af0054e4dfeca313085c8193af779c03771f5dd8925332a62bdcb438a65
      recorded_at: '2026-10-23T07:30:00+09:00'
  task_commits:
    - task: plan-workflow/plan-review-perspectives/001
      sha: 29364e6c
      intent_anchor: task-001
    - task: plan-workflow/plan-review-perspectives/002
      sha: 98da93e6
      intent_anchor: task-002
    - task: plan-workflow/plan-review-perspectives/004
      sha: b6d91c90
      intent_anchor: task-004
---
# Explain

## Background

plan 리뷰는 full blueprint마다 `combined` 관점 한 명이 문서 전체를 훑었다. 한 명이 정합·범위·검증 가능성·위험을 한꺼번에 보다 보니 관점마다 판정 범위가 겹치고, 테스트 단언의 느슨함 같은 검증 가능성 문제는 놓치기 쉬웠다. light blueprint는 plan 리뷰 자체를 건너뛰어 검증 가능성을 확인받을 곳이 없었다.

이번 변경은 `review_contract: brief` 표식이 붙은 blueprint에서 plan 리뷰를 겹치지 않는 4관점 병렬(full)과 `verifiability` 한 관점(light)으로 나눈다. 새 light scaffold도 표식과 `context-review.md`를 갖는다. 표식이 없는 blueprint와 이미 저장된 리뷰 기록은 기존 `single`·`skip` 동작을 유지한다.

## Code

- `scripts/src/lib/schema.ts` — `planReviewContractOf`가 plan 쪽 표식을 해석한다(light를 접지 않는다). `reviewContractOf`는 light에서 `'legacy'`를 돌려주므로 light의 run 최종 리뷰는 지금과 같다. 관점 이름 목록 `PLAN_FULL_PERSPECTIVES`·`PLAN_LIGHT_PERSPECTIVES`가 dispatch와 store의 공통 기준이다.
- `scripts/src/lib/review-dispatch.ts` — `classifyPlanReview`가 표식 full에 `strategy: 'perspectives'`와 `consistency`·`scope_minimality`·`verifiability`·`risk_security`를, 표식 light에 `['verifiability']`를 낸다. 값이 `brief`가 아니면 `review-contract-invalid`로 거절한다. `checkPreviousShape`는 previous에 `perspectives`를 받는다.
- `scripts/src/lib/context-review-store.ts`, `context-review-state.ts` — `loadDispatch`가 표식과 strategy 조합을 검사하고(표식 없는 `perspectives`, 표식 blueprint의 `single`·`clustered`는 거절), record가 discovery 관점 집합과 delta 관점을 dispatch와 맞춰 본다.
- `scripts/src/lib/plan-approve.ts`, `scaffold.ts`, `validate-structural.ts` — 표식 light도 `context-review.md` accepted를 요구하고, 새 light scaffold가 표식과 리뷰 문서를 만들며, S38은 light 동시 사용 거절을 빼고 값 검사만 한다.
- 문서(`agents/bouncer-context-reviewer.md`, `references/context-review/index.md`, `skills/bouncer-plan/*`, `rules/*`)는 관점별 판정 범위와 병렬 절차를 서술한다.
- 알려진 한계: light scaffold를 "문서 4개, `context-review.md` 없음"으로 설명하는 문서(`rules/planning.md`, `docs/workflow.md`, `SKILL.md`)가 남아 있다. `checkPreviousShape`의 거절 문구가 표식 없는 blueprint에서도 바뀌었다. `PERSPECTIVES_ONLY_NAMES`가 `PLAN_FULL_PERSPECTIVES`와 같은 값을 따로 들고 있고, `checkRoundPerspectives`는 delta 관점을 scale이 아니라 목록 길이로 추론한다.

## Quiz

1. 표식이 있는 full blueprint의 plan 리뷰 dispatch는?
   - (1) `strategy: single`, 관점 `combined`
   - (2) `strategy: perspectives`, 관점 네 개
   - (3) `strategy: skip`, 관점 없음

2. 표식이 있는 light blueprint의 plan 리뷰는?
   - (1) 건너뛴다
   - (2) `verifiability` 한 관점으로 리뷰하고 `plan approve`가 accepted를 요구한다
   - (3) 네 관점을 모두 호출한다

3. 표식이 없는 blueprint가 `perspectives` payload를 받으면?
   - (1) target-invalid로 거절된다
   - (2) 네 관점으로 처리된다
   - (3) `single`로 자동 변환된다

4. 표식이 `brief`가 아닌 값(예: `other`)이면 `review-dispatch plan`은?
   - (1) legacy로 보고 진행한다
   - (2) `review-contract-invalid`로 거절한다
   - (3) full은 통과하고 light만 거절한다

## Tasks

### plan-workflow/plan-review-perspectives/001 · `29364e6c`

#### Goal & intent

`bouncer.review_contract: brief` blueprint의 plan 리뷰를 CLI가 4관점 병렬(full)과 `verifiability` 1관점(light)으로 디스패치하고 기록·승인 검사가 그 계약을 지키게 한다.
표식이 없는 blueprint의 `single`·`skip` 판정과 저장된 기록 읽기는 바뀌지 않는다.

#### Current behavior

- `scripts/src/lib/review-dispatch.ts:565-576` `classifyPlanReview`는 `scale === 'light'`면 parts·`follow_up` 없이 `strategy: 'skip'`, `perspectives: []`를 돌려주고, 이 분기는 `checkPreviousBinding`(`:582`)보다 앞에 있다.
- 같은 함수 `:645-660`은 full이면 task 수와 관계없이 `strategy: 'single'`, `perspectives: ['combined']`를 낸다. 타입 union(`:68-85`)에는 `'skip'`과 `'single'|'clustered'`만 있다.
- `review-dispatch.ts:345-347` `checkPreviousShape`는 previous strategy가 `single`/`clustered`가 아니면 `previous strategy must be single or clustered`로 거절한다.
- `scripts/src/lib/context-review-store.ts:224-226` `loadDispatch`는 `single`/`clustered` 밖의 strategy를, `:239`는 `scale === 'light'` blueprint를 target-invalid로 거절한다. start·record·restart·route가 모두 이 함수를 거친다(`context-review-state.ts:193`, `:345`, `:739`).
- `context-review-state.ts:350-368` record는 round 번호·mode·`target.digest`만 검사하고 round 관점을 dispatch `perspectives`와 비교하지 않는다.
- `scripts/src/lib/validate-sections.ts:69-77` `CONTEXT_REVIEW_PERSPECTIVE`는 `combined`·`local`·`global`과 legacy 네 이름이다. finding `category`(`:460-465`)와 round 관점 이름(`:589-597`)이 이 목록으로 검사된다.
- `scripts/src/lib/plan-approve.ts:187-208`은 `scale !== 'light'`일 때만 `context-review.md` `status: accepted`를 요구한다.
- `scripts/src/lib/scaffold.ts:536-541` `scaffoldBlueprint`는 light에서 `scaffoldContextReview`를 부르지 않는다.
- 표식은 아직 develop 코드에 없다. B(`final-review-brief-compliance`) 병합 뒤 상태(B TASKS-001 계획 기준, 구현 때 줄 번호를 다시 확인한다): `schema.ts` `reviewContractOf(bouncer)`가 `'brief' | 'legacy' | null`을 돌려주고 run 쪽 소비자(최종 리뷰 분류기·`review-record`·coordinator·G21)가 이를 쓴다. `scaffoldBlueprint`는 full에만 `review_contract: brief`를 쓴다. `validate-structural.ts` S38은 `brief`가 아닌 값과 `scale: light` 동시 사용을 거절한다(`S38 review_contract is not allowed on a light blueprint`).
- help·template 문구: `cli-review-dispatch-command.ts:122` "Plan fields (`single` only; …)", `templates.ts:303`·`:308` "category: combined | local | global".

#### Target behavior

- plan 쪽 표식 판정은 새 `schema.planReviewContractOf(bouncer)` 하나만 본다. 크기·task 수로 추론하지 않는다. 값은 `'brief' | 'legacy' | null`이고 light를 접지 않는다. `null`이면 `classifyPlanReview`가 `ok:false`, error `review-contract-invalid: review_contract must be brief`로 거절한다.
- `reviewContractOf`는 `scale: light`면 키 값과 관계없이 `'legacy'`를 돌려준다(잘못된 값의 거절은 S38이 맡는다). 그래서 표식 light의 run 최종 리뷰는 지금 light와 같다.
- `scaffoldBlueprint`는 light에도 `verification_policy` 뒤에 `review_contract: brief`를 쓰고 `context-review.md`를 만든다.
- S38에서 light 동시 사용 거절을 뺀다. 값 검사는 그대로다.
- 표식 full: `classifyPlanReview`가 지금과 같은 cluster·reviewFields에 `strategy: 'perspectives'`, `perspectives: ['consistency','scope_minimality','verifiability','risk_security']`를 싣는다.
- 표식 light: skip 분기를 타지 않고 `checkPreviousBinding`·reviewFields를 거쳐 `strategy: 'perspectives'`, `perspectives: ['verifiability']`를 낸다.
- 표식 없음: full `single`/`combined`, light `skip`, reasons 문구 모두 지금과 같다.
- `checkPreviousShape`와 `loadDispatch`는 `perspectives`를 받는다. 단 `loadDispatch`는 표식 없는 blueprint의 `perspectives` payload와 표식 blueprint의 `single`/`clustered` payload를 target-invalid로 거절하고, light 거절은 표식 없는 light에만 남긴다.
- record는 dispatch strategy가 `perspectives`일 때 discovery round 관점 이름 집합이 dispatch `perspectives`와 같고, delta round 관점이 full `combined` / light `verifiability` 하나인지 검사해 어긋나면 기록 없이 거절한다. dispatch가 `single`/`clustered`인 cycle에 새 관점 이름이 오면 거절한다.
- `CONTEXT_REVIEW_PERSPECTIVE`에 새 네 이름을 더한다. 기존 이름의 읽기는 그대로다.
- `plan approve`는 표식 light에도 accepted를 요구하고, 실패 reason·next는 full과 같다.
- help·template 문구가 `perspectives` 전략과 새 category 이름을 나열한다.

#### Interface

- 제공:
  - `review-dispatch plan` payload `strategy: 'perspectives'`와 그 `perspectives` 배열(위 Target behavior 값).
  - plan finding `category`·round 관점 이름 `consistency | scope_minimality | verifiability | risk_security`.
  - 표식 light에서 `context-review start|record|restart|route|close` 허용과 `plan approve`의 accepted 요구.
  - `schema.planReviewContractOf(bouncer: unknown): 'brief' | 'legacy' | null` export. `reviewContractOf`는 light에서 `'legacy'`.
  - 새 light scaffold의 `review_contract: brief`와 light 표식을 받는 S38.
- 거부:
  - 표식 없는 blueprint의 `perspectives` payload → `context-review-target-invalid`.
  - record 거절은 모두 `context-review-input-invalid`이고 round·cycle 상태를 바꾸지 않는다. cause 문구:
    - discovery 관점 집합 불일치 → `round 1 perspectives <받은 이름들> != dispatch perspectives <기대 이름들>`
    - delta 관점이 지정값이 아님 → `round 2 delta perspective must be <combined|verifiability>`
    - `single`/`clustered` cycle에 새 관점 이름 → `perspective <이름> requires a perspectives dispatch`
  - 표식 light의 context review가 accepted가 아닐 때 → `plan-approve-context-review`.
  - 표식 blueprint에 `single`/`clustered` dispatch → `start`·`record`·`restart`·`route`가 `context-review-target-invalid`, cause `review_contract brief requires a perspectives dispatch`.
  - `planReviewContractOf`가 `null`(값이 `brief`가 아님)일 때 `review-dispatch plan` → `ok:false`, error `review-contract-invalid: review_contract must be brief`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `classifyPlanReview`, `checkPreviousShape`, `PlanDispatchReview` | Modify | full `single`·light `skip` 판정과 previous 모양 검사 | 표식이면 `perspectives` 전략과 관점 배열, 표식 light는 reviewFields 경로, previous에 `perspectives` 허용 | `review-dispatch.ts:345`, `:565`, `:645` |
| `scripts/src/lib/context-review-store.ts` | `loadDispatch` | Modify | `single`/`clustered`·non-light만 받음 | `perspectives`와 표식 light 허용, 표식 없는 `perspectives` 거절 | `context-review-store.ts:224`, `:239` |
| `scripts/src/lib/context-review-state.ts` | record 전이 | Modify | round 번호·mode·digest 검사 | `perspectives` cycle의 discovery·delta 관점 검사와 `single`/`clustered` cycle의 새 이름 거절 | `context-review-state.ts:350-368` |
| `scripts/src/lib/validate-sections.ts` | `CONTEXT_REVIEW_PERSPECTIVE` | Modify | plan 관점·category 허용 목록 | 새 네 이름 추가 | `validate-sections.ts:69` |
| `scripts/src/lib/plan-approve.ts` | context review accepted 검사 | Modify | full만 accepted 요구 | 표식 light도 요구 | `plan-approve.ts:187-208` |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint` | Modify | light에서 context-review 생략, 표식은 full만(B) | light에도 표식과 `context-review.md` 생성 | `scaffold.ts:536-541`, B TASKS-001 |
| `scripts/src/lib/schema.ts` | `reviewContractOf`, `planReviewContractOf` | Modify | 표식 해석(B) | light는 `'legacy'`, plan용 해석기 추가 | B TASKS-001 Interface |
| `scripts/src/lib/validate-structural.ts` | S38 | Modify | 값 검사와 light 거절(B) | light 거절 제거 | B TASKS-001 Target |
| `scripts/src/lib/templates.ts` | context-review 템플릿 안내 | Modify | category 목록 `combined`·`local`·`global` | 새 이름 추가 | `templates.ts:303`, `:308` |
| `scripts/src/lib/cli-review-dispatch-command.ts` | plan help 문구 | Modify | "Plan fields (`single` only…)" | `perspectives` 포함 | `cli-review-dispatch-command.ts:122` |
| `scripts/src/lib/cli-context-review-command.ts` | help 예시 | Modify | `combined` 예시 | `perspectives` 예시 한 줄 | `cli-context-review-command.ts:79`, `:121` |
| `test/review-dispatch.test.js` | plan 분류 테스트 | Modify | skip·single 고정(`:378`, `:396`, `:717`) | 표식 full·light·previous 케이스 추가, template 문구 단언 갱신 | 같은 파일 |
| `test/context-review-state.test.js` | start·record 테스트 | Modify | single fixture(`:158`), skip 거절(`:767`) | `perspectives`·표식 light·관점 불일치 거절 케이스 추가 | 같은 파일 |
| `test/plan-approve.test.js` | approve 테스트 | Modify | light 부재 성공(`:96`) | 표식 light 미accepted 거절 추가 | 같은 파일 |
| `test/scaffold.test.js` | light 문서 세트 | Modify | light에 context-review 없음(`:663`), 100줄 합(`:687`) | 표식 light는 context-review 생성, 예산 합에서 제외 | 같은 파일 |
| `test/cli-help.test.js` | help 문구 | Modify | plan help 단언 | `perspectives` 문구 단언 | `cli-help.test.js:470` 부근 |
| `test/schema.test.js` | `reviewContractOf` 테스트(B) | Modify | 해석기 단언 | light `'legacy'`와 `planReviewContractOf` 단언 | B TASKS-001 Checklist |
| `test/validate-structural.test.js` | S38 테스트(B) | Modify | light 표식 거절 단언 | light 표식 통과, 잘못된 값 거절 유지 | B TASKS-001 Checklist |

#### Constraints

- 표식이 없는 blueprint에서 지금 받는 입력과 지금 거절하는 입력의 dispatch payload·reasons·거절 문구는 바이트 단위로 지금과 같아야 하고(예외: `single`/`clustered` cycle에 새 관점 이름을 기록하는 입력은 Interface의 새 cause로 거절한다), 그 기대값은 바꾸지 않는다. 기존 테스트의 fixture 조정은 다음 항목대로 허용한다. 모든 blueprint가 공유하는 help·template 안내 문구의 단언(`test/cli-help.test.js`, `test/review-dispatch.test.js:717`)만 새 문구에 맞춘다.
- `single`·`clustered` 저장 payload와 legacy 관점 이름 round는 표식 없는 blueprint에서 계속 읽힌다.
- B 병합 뒤 scaffold 기반 full fixture는 표식을 갖는다. `single` 기대값을 단언하는 기존 테스트(`test/review-dispatch.test.js`, `test/context-review-state.test.js` `makeRepo` 등)는 fixture에서 `review_contract`를 지워 표식 없는 blueprint로 만들고 기대값은 그대로 둔다. 표식 경로는 새 테스트로만 단언한다.
- round 순서 계약(`CONTEXT_ROUND_CONTRACT` `discovery`, `discovery,delta`)과 `RESTART_LIMIT`은 바꾸지 않는다.
- 새 strategy 이름은 `perspectives` 하나만 쓴다. light용 별도 이름을 만들지 않는다.

### plan-workflow/plan-review-perspectives/002 · `98da93e6`

#### Goal & intent

controller가 표식 blueprint에서 4관점(full) 또는 `verifiability`(light) reviewer를 병렬로 호출하고, reviewer가 자기 관점의 판정 범위만 보도록 skill·reference·rubric·agent 문서를 TASKS-001의 CLI 계약에 맞춘다.
표식 없는 blueprint의 `single`·light skip 안내는 legacy 경로로 남긴다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:259-266` 5단계는 light면 단계 전체를 건너뛰라고 하고(`strategy: skip`), `:268`은 "its strategy is always `single`"이다. `:138-141`은 light가 `context-review.md` 없이 100줄 이하라고 적는다.
- `skills/bouncer-plan/references/context-review.md:1`은 `scale: full`만 대상으로 하고, `:20-21`은 `single` 결과에 관점을 더하지 말라, `:33-37`은 "Every full initial plan review is `strategy: single`"이다. print 호출 이름은 `r1-combined | r2-delta`뿐이다(`:166`, `:172`).
- `references/context-review/index.md:16-27`은 "Full plans only", light 변형 rubric이 없다고 적고, `:72-80`은 `single`/`combined`만 안내한다.
- `agents/bouncer-context-reviewer.md:23-24`는 "A new plan review is always one `combined` call", `:53-75` Discovery 매핑은 `combined|local|global`, `:96-99`는 "Rubric — two scopes", `:176-178` Output contract category 목록도 같은 세 이름이다. 정규식 단언 같은 단언 정밀도와 경계 입력 판정은 rubric에 없다.
- `.codex/agents/bouncer-context-reviewer.toml`은 agent md에서 `mdToCodexToml`로 생성되며 `test/agents.test.js:71`이 바이트 일치를 검사한다.
- `rules/planning.md:69-72`·`:104-110`과 `docs/workflow.md:149-150`은 light에 context review가 없다고 적는다.
- `test/skill-context-review.test.js:12`는 세 문서의 첫 `fingerprint:` 예시가 기존 일곱 이름 중 하나인지 정규식으로 검사하고, `:33`은 `## Rubric — two scopes` 제목과 `storage location`·`state ownership`·`review_risk` 문구, index.md의 `four rubrics` 금지를 검사한다.

#### Target behavior

- SKILL 5단계: 표식 없는 light만 건너뛴다. 표식 blueprint는 `review-dispatch plan`이 낸 `perspectives`대로 reviewer를 관점당 1명씩 한 메시지에서 병렬 호출하고, 표식 없는 full은 `single` 그대로라고 쓴다. light scaffold 문단은 표식 light에 `context-review.md`가 생기며 100줄 예산에서 빠진다고 쓴다.
- reference: discovery는 payload `perspectives` 수만큼 호출하고 결과를 round 1 하나에 관점별로 기록, 같은 fingerprint 병합, 수정 1회, delta 1회(full `combined`, light `verifiability`)를 쓴다. print 호출 이름은 `r1-<perspective>`와 `r2-delta`다. metrics `--label`은 관점 이름이다. `single` 경로 문장은 표식 없는 blueprint 설명으로 남긴다.
- rubric(index.md)·agent: 네 관점의 판정 범위를 겹치지 않게 적는다.
  - `consistency` — epic→blueprint→tasks 정합, DAG와 `depends_on`, Interface↔Touch↔Checklist, Contract의 저장 위치·상태 소유. 성공 기준 커버리지는 보지 않는다(`verifiability` 소관).
  - `scope_minimality` — `affected_paths` 적정성, Do not touch, 불필요한 추상화·의존성·파일, 비목표.
  - `verifiability` — Checklist의 red 단언, task `verify` 명령, 성공 기준 커버리지(어느 task도 열지 않는 성공 기준 포함), 테스트 단언 정밀도(정규식 단언 같은 느슨함).
  - `risk_security` — `review_risk` 표기 적정성, 공개 인터페이스, 실패 모드·엣지 케이스, 경계 입력.
  - 기존 두 scope는 `combined`·`local`·`global`과 delta(full)가 쓰는 본문으로 남긴다. 관점 밖 finding은 보고하지 않는다는 규칙은 새 관점에도 적용된다.
- Output contract category 목록에 새 네 이름을 더하고 `.codex` TOML을 다시 생성한다.
- `rules/planning.md`·`docs/workflow.md` light 문단은 표식 light가 `verifiability` 리뷰를 받고 run 최종 리뷰는 지금 light와 같다고 쓴다. `rules/document-schema.md`는 light 표식과 S38·해석기 분리를 쓴다.
- `test/skill-context-review.test.js` fingerprint 정규식에 새 네 이름을 더하고, agent 문서에 `### consistency`·`### scope_minimality`·`### verifiability`·`### risk_security` 제목이 각각 정확히 하나 있음을 단언한다.
- CHANGELOG `[Unreleased]` `### Changed`에 한 항목을 더한다.

#### Interface

- 제공: 표식 blueprint의 controller 절차(관점별 병렬 discovery, 수정 1회, delta 1회)와 reviewer의 관점별 판정 범위 문서. print 호출 이름 `r1-<perspective>`.
- 거부: 표식 없는 blueprint에 4관점을 호출하는 안내, `perspectives` payload의 관점을 controller가 합치거나 나누는 안내, light delta에 관점을 늘리는 안내.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | 2단계 Light scaffold, 5단계 Review | Modify | light는 리뷰 없음, plan 리뷰는 항상 `single` | 표식 분기와 `perspectives` 안내 | `SKILL.md:138-141`, `:259-268` |
| `skills/bouncer-plan/references/context-review.md` | 1–6단계, print 호출 | Modify | `single`/`combined` 절차 | 관점별 병렬 discovery·delta 관점·호출 이름 | `context-review.md:1`, `:20-37`, `:166-172` |
| `references/context-review/index.md` | When this applies, Steps | Modify | Full plans only, `single`만 | 표식 light 포함, 네 관점 안내 | `index.md:16-27`, `:72-80` |
| `agents/bouncer-context-reviewer.md` | Authority, Discovery, Rubric, Output contract | Modify | `combined` 한 명과 두 scope | 네 관점 매핑·판정 범위·category | `bouncer-context-reviewer.md:23`, `:53-99`, `:176` |
| `.codex/agents/bouncer-context-reviewer.toml` | 생성본 | Modify | agent md 생성본 | 재생성 | `test/agents.test.js:71` |
| `rules/planning.md` | Lightweight cycle | Modify | light에 context review 없음 | 표식 light 리뷰 | `planning.md:69-72`, `:104-110` |
| `docs/workflow.md` | light 설명 | Modify | 계획 문서 판정 없음 | 표식 light 검증 가능성 리뷰 | `workflow.md:149-150` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 미기재 | `### Changed` 항목 | `CHANGELOG.md:33` |
| `rules/document-schema.md` | `review_contract` 절(B) | Modify | 표식은 full만, S38이 light 거절 | light에도 표식, S38은 값 검사만, light run은 legacy 해석 | B TASKS-001 Touch |
| `test/skill-context-review.test.js` | fingerprint·rubric 테스트 | Modify | 일곱 이름 정규식, 두 scope | 새 이름 허용, 네 관점 제목 단언 | `skill-context-review.test.js:12`, `:33` |

#### Constraints

- reference의 named agent 불가 fallback 문단("If named agents are unavailable"로 시작)은 `test/subagents.test.js:556-566`이 고정한 문구(전체 본문 전달, Authority through Output contract, 입력 목록)를 그대로 둔다.
- 사용자 문서 본문은 기존 언어를 따른다(skill·reference·agent·rules는 영어, `docs/workflow.md`·CHANGELOG는 한국어). agent 문서에 한국어 제목을 쓰지 않는다(`test/agents.test.js:60`).
- `scripts/check-doc-shape.js`의 구조 규칙을 지킨다: SKILL 1–8단계 순서와 ACQ 위치, 5단계의 `./references/context-review.md` 링크, agent 제목 순서(Authority → guards → Review modes → Output contract), `Lightweight cycle` 제목.
- index.md에 `four rubrics` 문구를 쓰지 않는다(`skill-context-review.test.js:33`이 금지).
- 문서가 서술하는 관점 이름·strategy 이름·거절 조건은 TASKS-001 Interface와 글자 그대로 같아야 한다.

### plan-workflow/plan-review-perspectives/003

#### Goal & intent

TASKS-001의 CLI 계약과 TASKS-002의 문서가 통합된 상태에서 전체 CI(`npm run ci`)가 통과함을 한 번 증명한다. 문서 형태 검사·커버리지 임계값·타입 검사가 함께 돈다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### plan-workflow/plan-review-perspectives/004 · `b6d91c90`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/migrate-context-slugs.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.