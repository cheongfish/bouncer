---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/098-drive-plan-cost-control/blueprints/003-plan-review-focus/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T09:26:05.878+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '098'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: f3195289d7161e918f7d3500658d345dafda1e12
      range_to: 1378cc1f4f03db05b702aff004495204898f0dec
      diff_sha: ee782fc796a5858a19074adede6a8d070dfda2cddd19333894db3480debe63eb
      recorded_at: '2026-10-14T09:40:00+09:00'
  task_commits:
    - task: EPIC-098/BP-003/TASK-001
      sha: 552a22d9
      intent_anchor: task-001
    - task: EPIC-098/BP-003/TASK-002
      sha: 9649f14b
      intent_anchor: task-002
    - task: EPIC-098/BP-003/TASK-003
      sha: df0cbbf1
      intent_anchor: task-003
    - task: EPIC-098/BP-003/TASK-004
      sha: e575ca65
      intent_anchor: task-004
    - task: EPIC-098/BP-003/TASK-005
      sha: 1378cc1f
      intent_anchor: task-005
---
# Explain

## Background

plan context review는 reviewer가 문서 정합성뿐 아니라 문장 품질과 경로 존재 같은 기계로 확인할 수 있는 항목까지 맡았다. 판단 관점이 네 개라 commit task가 2개만 되어도 local·global 호출로 갈라졌고, 작은 계획에도 reviewer 호출 비용이 컸다. 반대로 Contract 저장 위치와 상태 소유권 대조처럼 실제로 놓치기 쉬운 판단은 rubric에 없었다.

이 변경은 reviewer가 하는 판단을 줄이고 기계가 하는 판단을 plan gate로 옮긴다. 작은 계획은 한 번에 리뷰하고, 사람의 판단이 필요한 부분에 reviewer를 집중시킨다.

## Intuition

교정자에게 맞춤법 검사와 팩트 체크까지 시키던 것을 맞춤법은 검사기에, 팩트 체크는 교정자에게 나눠 준 것과 같다. 검사기가 잡을 수 있는 건 gate가 먼저 잡고, 리뷰어는 문서끼리 맞는지와 검증할 수 있는 계획인지만 본다.

## Code

- `scripts/src/lib/review-dispatch.ts` — `PLAN_SMALL_MAX_TASKS`가 1에서 3으로 올랐다. commit task가 3개 이하면 `classifyPlanReview`가 `single`을 내고, 모든 commit task의 Interface 키와 Touch 경로를 합친 cluster 하나(`c1`)를 만든다. 예전에는 첫 task만 담아 나머지 task가 reviewer 입력에서 빠졌다. 4개 이상이면 기존 `clustered`(local → global) 경로가 그대로다.
- `scripts/src/lib/templates.ts` — context-review 주석 안내의 category 값이 `combined | local | global`로 바뀌었다. 옛 값(`cross_document` 등)은 기록 읽기 호환용으로만 남는다. 이 안내문은 고정 목록 `LEGACY_SCAFFOLD_COMMENT_BODIES`에 있어서, 이 수정으로 옛 seed 주석은 legacy 주석 lint에 더는 걸리지 않는다(최종 리뷰에서 advisory로 남긴 한계).
- `scripts/src/lib/validate-gates.ts` — `checkTouchPathsExist`가 G25를 낸다. 실행 전 commit task의 Touch 표에서 Modify·Delete·Rename-old 경로가 저장소에도, 전이 `depends_on` 선행 task의 Create·Rename-new 경로에도 없으면 task당 실패 하나를 낸다. `fs.existsSync`만 쓰고 git index는 읽지 않는다. light 계획과 repoRoot가 없는 plan draft는 건너뛴다. 한계: 경로 일치만 보며 `..`로 repoRoot 밖으로 나가는 경로는 막지 않고, 디렉터리 Create가 그 하위 경로를 정당화하지 않는다.
- `scripts/src/lib/validate-gates.ts` — `isSecurityPath`와 `SECURITY_PATH_TOKENS`(auth, login, session, token, credential, secret, password, permission, acl, oauth, jwt)로 `review-risk-missing` 경고를 낸다. 토큰은 경로 segment와 `.`·`_`·`-`로 나눈 조각과의 완전 일치라 `tokenizer`·`sessions`는 걸리지 않고, `.bouncer/` 아래 계획 문서는 제외된다. 경고일 뿐 gate 결과를 바꾸지 않으며, 한계로 Touch의 심볼 열에 있는 같은 이름의 토큰도 후보가 되어 오탐할 수 있다.
- `scripts/src/lib/validate.ts` — G25 실패에 `next` 힌트(경로 오타 수정, `Create`로 변경, 선행 task를 `depends_on`에 추가)를 붙인다.
- `agents/bouncer-context-reviewer.md`, `.codex/agents/bouncer-context-reviewer.toml`, `references/context-review/index.md` — rubric이 네 관점에서 두 판단(정합성·범위, 검증 가능성)으로 줄었다. `single`이면 `combined` 한 번이 두 판단을 모두 보고, `clustered`면 `local`은 task 단위 정합성·Checklist 경로·`review_risk` 표시를, `global`은 epic→blueprint→tasks 정합성·Contract 저장 위치와 상태 소유권 대조·공유 경로·DAG·성공 기준 커버리지를 맡는다. 경로 존재는 G25가, 문장 품질은 stop-slop이 맡으므로 reviewer finding이 아니다. TOML은 md에서 생성한 파일이다.
- `benchmarks/plan-review/` — 결함을 심은 small·large fixture와 측정 절차다. 실제 측정은 merge 뒤 사용자가 실행하고 `benchmarks/drive-serial-4/results.md`에 기록한다. D1–D3은 reviewer 판단 대상이라 테스트로 고정하지 않았고, D4·D5는 G25와 gate가 판정한다.
- 검증은 `npm run ci` 통과(evidence: `evidence.verification[]`)이고, 최종 리뷰는 must_fix 없이 accepted(`evidence.review`)이다.

## Quiz

1. commit task가 3개인 계획을 plan context review에 넘기면 reviewer 호출은 어떻게 구성되나요? (A) task마다 local 한 번씩 세 번과 global 한 번 (B) 첫 task만 담은 cluster로 `combined` 한 번 (C) 모든 task를 담은 cluster 하나로 `combined` 한 번
2. Touch 표의 Modify 행 경로가 저장소에 없고 선행 task도 그 경로를 만들지 않으면 plan gate는 어떻게 하나요? (A) G25 실패로 거절하고 task당 하나씩 보고한다 (B) `review-risk-missing` 경고만 내고 통과한다 (C) reviewer finding으로 넘긴다
3. Touch에 `src/auth/session.ts`가 있는 commit task의 `review_risk`가 비어 있으면 어떻게 되나요? (A) 아무 일도 없다 (B) G25로 gate가 실패한다 (C) `review-risk-missing` 경고가 나오고 gate는 통과한다
4. 개편된 reviewer 규칙에서 reviewer finding으로 다루지 않는 것은 무엇인가요? (A) Contract 저장 위치와 상태 소유권 불일치 (B) Touch 경로가 저장소에 존재하는지 확인 (C) epic 성공 기준이 task로 커버되는지
5. `src/lib/tokenizer.ts`만 Touch에 있는 commit task에서 `review_risk`가 비어 있으면 어떻게 되나요? (A) `token`이 부분 문자열로 들어 있어 경고가 난다 (B) 완전 일치가 아니라서 경고가 나지 않는다 (C) G25로 실패한다

## Tasks

### EPIC-098/BP-003/TASK-001 · `552a22d9`

#### Goal & intent

commit task 3개 이하인 full 계획의 discovery context review가 `combined` 호출 한 번으로 끝난다. 4개 이상은 기존 clustered 분담을 유지한다.

#### Current behavior

- `scripts/src/lib/review-dispatch.ts:33` `PLAN_SMALL_MAX_TASKS = 1`이다. `classifyPlanReview`는 `:629`에서 `taskCount <= PLAN_SMALL_MAX_TASKS`이면 `strategy: 'single'`·`perspectives: ['combined']`(`:643-648`)를, 아니면 `strategy: 'clustered'`·cluster별 `local` + `global`(`:660-665`)을 돌려준다. reasons 문자열은 `:648`, `:665`에서 상수를 보간한다.
- single 분기(`:630-638`)는 `const only = commitTasks.tasks[0]`로 첫 task 하나만 담은 `clusters: [{ id: 'c1', tasks: [only.id], interface_keys, touch_paths }]`를 만든다. 상수만 올리면 3-task single 결과의 `clusters`에서 TASKS-002·003이 빠진다.
- light blueprint는 `:567-571`에서 임계와 관계없이 `skip`이다. previous payload 검사(`:344`)와 `context-review-state.ts:267`은 `single|clustered` 모두 받으므로 round 사이 strategy가 바뀌어도 거절하지 않는다.
- `scripts/src/lib/templates.ts:298` context-review 템플릿의 finding category 안내가 `cross_document | scope | korean_quality | success_criteria`다. `:303` round perspectives 안내는 새 이름과 legacy 이름을 함께 나열한다.
- `test/review-dispatch.test.js:310`이 상수 1을 고정하고, `:560` 'plan follow_up with an added task'(2 task, `:575` `clustered`), `:631` 'plan with two overlapping tasks'(2 task, clustered·cluster 1개·`['local','global']`), `:640` 'plan with two non-overlapping tasks'(2 task, cluster 2개·`['local','local','global']`)가 2-task 계획을 clustered로 가정한다.

#### Target behavior

- commit task 1–3개 full 계획은 `single`/`['combined']`이고 reasons는 `commit task count N <= 3 — single combined reviewer`다. 4개 이상은 `clustered`이고 cluster 계산·perspectives 순서는 그대로다.
- single 결과의 `clusters`는 commit task가 1개 이상이면 cluster 하나 `{ id: 'c1', tasks: <모든 commit task id, id 오름차순>, interface_keys: <모든 task Interface key 합집합, 중복 제거·정렬>, touch_paths: <모든 task Touch 경로 합집합, 중복 제거·정렬> }`이고, commit task가 0개면 `[]`다. 1-task 결과는 지금과 같다.
- light는 그대로 `skip`이고, verification 노드는 task 수에 들어가지 않는다(기존 `loadCommitTaskSignals` 그대로).
- follow_up 판정(`partial`·`full`)과 previous payload 검사는 바뀌지 않는다. task가 추가되어 strategy가 그대로 single이어도 문서 집합이 바뀌면 `follow_up: full`이다.
- context-review 템플릿의 finding category 안내는 `combined | local | global`이고, legacy 이름은 기존 기록의 읽기 호환용이라고 적힌다. round perspectives 안내도 같은 구분을 적는다.

#### Interface

- 제공:
  - `PLAN_SMALL_MAX_TASKS = 3` (export 유지).
  - `classifyPlanReview` 반환 필드 집합은 그대로다. commit task 2·3개에서 `strategy`가 `single`로 바뀌고, single `clusters`는 모든 commit task를 담은 cluster 하나다(Target behavior).
  - context-review 템플릿의 finding category 안내 문자열(`combined | local | global`, legacy는 읽기 호환).
- 거부:
  - 새 거부 경로는 없다. 기존 `ok: false` 사유(빈 Interface, 잘못된 previous 등)는 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `PLAN_SMALL_MAX_TASKS`, `classifyPlanReview` single 분기 | Modify | plan single/clustered 경계 1, single cluster는 첫 task만 | 경계 3, single cluster에 모든 commit task | epic 성공 기준 13 |
| `scripts/src/lib/templates.ts` | context-review 템플릿 안내 문자열 | Modify | finding category에 legacy 네 관점 안내 | `combined | local | global` 안내, legacy는 읽기 호환 표시 | 새 기록이 legacy category를 쓰지 않게 함 |
| `test/review-dispatch.test.js` | `size constants`, `plan with two overlapping tasks`, `plan with two non-overlapping tasks`, `plan follow_up with an added task` | Modify | 2-task clustered 가정 | 상수 3, 3-task single(cluster 내용 포함)·4-task clustered 경계 테스트, clustered 테스트는 4 task로, 템플릿 category 안내 단언 | 경계값·템플릿 안내 고정 |

#### Constraints

- execute 쪽 상수(`EXECUTE_SMALL_MAX_FILES`, `EXECUTE_SMALL_MAX_LINES`)와 execute dispatch는 바꾸지 않는다.
- clustered 경로의 cluster 계산과 `local`→`global` 순서를 바꾸지 않는다.
- 테스트 이름은 `조건 → 결과` 형식을 따른다.

### EPIC-098/BP-003/TASK-002 · `9649f14b`

#### Goal & intent

경로 존재 확인이 reviewer 판단에서 plan gate로 옮겨진다. 없는 파일을 Modify·Delete·Rename하는 full 계획은 `bouncer validate --gate plan`에서 G25로 실패하고, 선행 task가 만드는 파일을 수정하는 정상 계획은 통과한다.

#### Current behavior

- plan gate 루프는 `scripts/src/lib/validate-gates.ts:1058-1084`다. `planTasksOf(docs)`(`:1366`)의 task마다 G3(`:1069-1072`)와 `checkTaskScope`(`:1450`, G5·G10·G11·G12)를 돌린 뒤, `const beforeG19 = failures.length; checkTaskDependencyGraph(...)`(`:1079-1080`)로 G19를 판정하고 G19가 실패를 더하지 않았을 때만 `checkTaskDagShape`(`:1082`)와 `checkVerificationTaskGraph`를 실행한다.
- `checkPlanDraft`(`:1526-1552`)는 G3 없이 같은 순서를 돌고, `scripts/src/lib/validate.ts:381`에서 `{ warnings }`만 받아 `repoRoot`가 없다. plan gate는 `validate.ts:389-390`에서 `ctx.repoRoot`를 받고, 기존 검사는 `repoRoot`가 문자열이 아니면 건너뛴다(`validate-gates.ts:338`, `:804`, `:890`, `:992`).
- 전이 `depends_on` closure helper는 없다. `checkTaskDagShape`(`:383-400`)가 task별 id·depends_on·`executionKindOf`를 모으는 방식을 보여 준다. status는 `statusOf(tasksDoc)`(`:19` import)로 읽고, `FRESHNESS_TASK_STATUSES = ['draft','ready']`(`:1374`)가 있다.
- Touch는 `parseTasksSections(body).touch`(`validate-sections.ts:20`)로 읽는다. G11의 `pathJustifiedByTouch`(`:187`)와 `extractPathCandidates`(`:164`)는 문자열·경로 후보만 모으고, 표의 `변경` 열을 읽거나 `→`를 다루는 행 parser는 없다.
- light 템플릿(`templates.ts:196-203`)의 Touch는 bullet 목록이고, full 템플릿(`:114-117`)만 표다. 대부분의 테스트 fixture도 bullet Touch이며, 표 Modify 행은 `test/validate-gates.test.js:370-389`(G11 테스트, repoRoot 없이 `checkGate` 호출)뿐이다.
- 실패 복구 안내 registry는 `validate.ts:63-83`이고 G20·G22·G23·G24 항목이 있다.
- `references/spec-authoring/index.md:144-150` Touch 규칙은 `변경` 값 네 가지만 정하고 Rename 표기법이 없다.

#### Target behavior

- plan gate는 `ctx.repoRoot`가 문자열이고, blueprint `scale`이 `light`가 아니며, G19가 실패를 더하지 않았을 때 G25를 판정한다. `checkPlanDraft`(repoRoot 없음)는 G25를 판정하지 않는다.
- 대상은 `execution_kind: commit`이고 status가 `draft`·`ready`인 task다.
- Touch 표 행 중 `변경` 칸이 `Modify`·`Delete`인 행의 경로, `Rename` 행의 첫 경로(`old`)가 검사 대상이다. `Rename` 행의 경로 칸은 `` `old` → `new` `` 형식이다.
- 검사 대상 경로는 `repoRoot` 기준으로 파일이나 디렉터리가 있으면 통과한다. 없더라도 그 task의 전이 `depends_on` 선행 commit task의 Touch 표에 `Create` 경로이거나 `Rename`의 `new` 경로로 나오면 통과한다.
- task 하나에 남은 경로가 있으면 실패 하나를 그 task 문서 경로로 낸다. 메시지는 `Touch path does not exist: <경로 목록>`이다.
- `validate.ts` 복구 안내 registry에 G25 항목을 둔다. 안내 내용은 경로 오타를 고치거나 `변경`을 `Create`로 바꾸거나, 생성하는 선행 task를 `depends_on`에 넣으라는 것이다.
- Touch 표가 없는 문서(bullet Touch)나 `변경`이 네 값 밖인 행은 G25가 건너뛴다. 기존 G10·G11 판정은 바뀌지 않는다.

#### Interface

- 제공:
  - `validate-sections.ts`에서 export하는 `parseTouchRows(touchText: string): Array<{ change: 'Create' | 'Modify' | 'Delete' | 'Rename'; path: string; renameTo: string | null }>`. 표 머리행·구분행은 건너뛴다. 경로 칸의 backtick을 벗기고 `toPosix`와 선행 `./` 제거로 정규화한다. `Rename` 행은 경로 칸을 `→`로 나눠 `path`=old, `renameTo`=new로 둔다. `→`가 없는 Rename 행은 `renameTo: null`이다.
  - plan gate 실패 `{ code: 'G25', message: 'Touch path does not exist: a, b', file: <task 문서 rel> }`.
  - `validate.ts` hint registry 항목 `{ code: 'G25', match: /Touch path does not exist/, next: … }`.
- 거부:
  - Modify·Delete 경로, Rename old 경로가 저장소에도 선행 task 생성 경로에도 없으면 G25로 실패한다.
  - 선행 관계가 없는 task의 Create는 근거로 인정하지 않는다.
- 판정하지 않음(실패도 통과 근거도 아님):
  - `repoRoot` 없음, light blueprint, G19 실패, verification task, `in_progress`·`verified`·`verifying`·`integrated` task, Touch 표 없음, `변경`이 네 값 밖인 행.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `parseTouchRows` | Modify | Touch 절 분리·경로 후보 추출 | Touch 표 행 parser 추가·export | 표의 `변경` 열을 읽는 parser가 없음 |
| `scripts/src/lib/validate-gates.ts` | 신규 추출 지점: G25 Touch 경로 존재 검사, plan gate 루프 | Modify | G19 뒤 DAG 경고·verification graph 검사 | G19 통과 시 G25 검사 호출, 전이 선행 closure 계산 | plan gate가 G 코드를 소유 |
| `scripts/src/lib/validate.ts` | hint registry | Modify | G20–G24 복구 안내 | G25 안내 추가 | 실패 출력에 `next` 제공 |
| `references/spec-authoring/index.md` | Touch 규칙 | Modify | `변경` 네 값만 정의 | Rename 경로 칸 `` `old` → `new` `` 표기와 G25 판정 한 줄 | 작성자가 gate 형식을 알아야 함 |
| `test/validate-gates.test.js` | 신규 G25 테스트 | Modify | G19 accept/reject 테스트(`:2518`, `:2542`) | G25 통과·실패·건너뜀 테스트 | gate 계약 고정 |
| `test/cli-validate.test.js` | 신규 G25 CLI 테스트 | Modify | G19 CLI 경로 테스트(`:248`) | G25 실패 출력의 `next` 단언 | hint registry 계약 고정 |

#### Constraints

- G3·G5·G10·G11·G12·G19·G20의 기존 판정과 메시지를 바꾸지 않는다.
- 경로 존재 확인은 `fs.existsSync(path.join(repoRoot, p))` 수준의 읽기 전용 확인만 한다. Git index·HEAD를 읽지 않는다.
- 같은 task의 같은 경로는 한 번만 보고하고, 경로 목록은 정렬해 출력을 결정적으로 만든다.
- 테스트는 임시 디렉터리를 `repoRoot`로 넘긴다. 저장소 cwd에 기대지 않는다.
- 테스트 이름은 `조건 → 결과` 형식을 따른다.

### EPIC-098/BP-003/TASK-003 · `df0cbbf1`

#### Goal & intent

보안 관련 경로를 건드리는 task의 `review_risk`가 비어 있으면 plan gate가 실패 없이 `review-risk-missing` 경고를 낸다. 작성자는 승인 전에 security reviewer 누락 가능성을 볼 수 있다.

#### Current behavior

- plan 경고 shape는 `{ code, message, file }`(FailureEntry)이고 `GateContext.warnings?`는 `scripts/src/lib/validate-gates.ts:151`에 있다. task 단위 경고 `task-split`은 `checkTaskScope`(`:1450`) 안 `:1469-1478`에서 `Array.isArray(ctx.warnings)`일 때 task 문서 경로로 push된다. `dag-serial-overlap`·`dag-disjoint-edge`는 `checkTaskDagShape`(`:383-460`)가 blueprint index 경로로 낸다.
- `checkTaskScope`는 plan gate(`:1075`)와 `checkPlanDraft`(`:1545`) 양쪽에서 불린다. Touch 경로 판정(G11·G12)은 G10이 통과한 `else` 분기(`:1495-1510`)에서만 `sections.touch`와 `extractPathCandidates`를 쓴다. scale과 관계없이 실행되므로 light task에도 적용된다.
- `scripts/src/lib/validate.ts:376`이 warnings 배열을 만들고, 비어 있지 않을 때만 결과에 `warnings` 키를 싣는다(`:394-396`). `:154` JSDoc은 "task-split 경고가 있을 때만"이라고 적는다. CLI는 warnings가 있어도 exit 0이다(`test/cli-validate.test.js:200-207`).
- `review_risk` enum `REVIEW_RISK_ENUM`과 `readReviewRisk`는 `scripts/src/lib/review-dispatch.ts:39`, `:1072`에 있다. `review-dispatch.ts:8`이 `./validate`를 import하므로 validate-gates가 review-dispatch를 import하면 순환이 생긴다.
- 보안 경로 분류기는 저장소에 없다.

#### Target behavior

- `checkTaskScope`의 G10 통과 분기에서, `execution_kind`가 `commit`이고 `bouncer.review_risk`가 없거나 빈 배열인 task의 Touch 경로 후보(`extractPathCandidates(sections.touch)`)를 검사한다.
- 경로를 `/`로 나눈 segment와 basename을 다시 `.`·`_`·`-`로 나눈 조각 중 하나라도 `SECURITY_PATH_TOKENS`의 원소와 소문자 기준으로 정확히 같으면 그 경로가 일치한 것이다. 복수형·부분 문자열(`sessions`, `tokenizer`)은 일치하지 않는다. `.bouncer/`로 시작하는 경로는 계획 문서이므로 검사하지 않는다.
- 일치 경로가 있으면 task당 경고 하나를 같은 task의 `task-split` 뒤에 push한다. `{ code: 'review-risk-missing', message: 'Touch paths look security-sensitive but review_risk is empty: <정렬된 경로 목록>; record public_interface | authentication | authorization | credential if they apply', file: <task rel> }`.
- `review_risk`에 값이 하나라도 있으면, G10이 실패하면, verification task이면 경고하지 않는다. 경고는 `ok`와 실패 목록을 바꾸지 않는다. plan gate와 plan draft 둘 다 같은 경고를 낸다.

#### Interface

- 제공:
  - `validate-gates.ts` export 상수 `SECURITY_PATH_TOKENS: readonly string[]` = `['auth', 'login', 'session', 'token', 'credential', 'secret', 'password', 'permission', 'acl', 'oauth', 'jwt']`.
  - plan 경고 코드 `review-risk-missing`. shape는 기존 FailureEntry다.
- 거부:
  - 새 실패 코드는 없다. `review_risk` 값 검증은 기존 S30이 맡는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `checkTaskScope`, `SECURITY_PATH_TOKENS` | Modify | G5·G10·G11·G12와 `task-split` 경고 | G10 통과 분기에서 `review-risk-missing` 경고, 토큰 상수 export | task 단위 경고가 이미 이 함수에 있음 |
| `scripts/src/lib/validate.ts` | `validateBlueprint` JSDoc | Modify | warnings 키를 task-split 전용으로 설명 | 경고 코드가 여러 개임을 반영 | 문서와 동작 일치 |
| `test/validate-gates.test.js` | `shapeWarnings` 블록(`:3252-3346`), task-split 테스트(`:1748`) | Modify | 경고 순서·부재 단언 | `review-risk-missing` 경고 테스트 | 경고 계약 고정 |
| `test/cli-validate.test.js` | 신규 CLI 경고 테스트, task-split CLI 테스트(`:180-207`) | Modify | 경고만 있을 때 exit 0과 경고 1개 단언 | 보안 Touch·빈 `review_risk` 계획이 exit 0으로 `review-risk-missing`을 내는 테스트 | CLI 출력 계약 고정 |

#### Constraints

- 기존 테스트의 경고 순서 단언(`test/validate-gates.test.js:3327` `codes.indexOf('task-split') === 0`)과 빈 경고 단언(`:3299`, `:1755-1758`, `:1784`, `:1792`)이 계속 통과해야 한다. 기존 fixture의 Touch 경로가 토큰에 걸리면 그 테스트의 의도를 바꾸지 않는 범위에서 fixture에 `review_risk`를 넣는다.
- 경고는 실패가 아니다. `ok`·exit code를 바꾸지 않는다.
- 테스트 이름은 `조건 → 결과` 형식을 따른다.

### EPIC-098/BP-003/TASK-004 · `e575ca65`

#### Goal & intent

context reviewer는 문서 정합성·범위(`cross_document`)와 검증 가능성(`success_criteria`) 두 가지만 판단한다. 문서 정합성 판단에는 Contract 저장 위치·상태 소유권과 task 브리프의 대조, 보안 위험 표시 누락 확인이 들어간다. 문장 품질은 작성 단계 stop-slop(advisory)으로 옮기고, 경로 존재는 plan gate G25로 옮긴다.

#### Current behavior

- `agents/bouncer-context-reviewer.md`:
  - `:61` `combined`가 네 scope(`cross_document`, `scope`, `korean_quality`, `success_criteria`)를 판단한다.
  - `:64` `local`이 Scope review로 그 task들의 `affected_paths`·Checklist 수정 경로를 판단한다.
  - `:69` `global`이 공유 경로·DAG의 Scope review와 전체 Korean quality를 판단한다.
  - `:78-79` legacy 관점을 하나씩 배정할 수 있다고 적는다.
  - `:101` 제목 `## Rubric — four scopes`, `:104` "`combined` all four".
  - `:123` `### Scope review (\`scope\`)`는 `affected_paths` 존재와 Checklist 수정 경로 누락을 본다.
  - `:130` `### Korean quality (\`korean_quality\`)`는 stop-slop 기준 문장을 판단한다.
  - `:174` Output contract의 category 목록에 legacy 이름이 있다.
- Cross-document rubric은 epic→blueprint→task 목표·범위 불일치와 Checklist·Interface 불일치는 보지만, Contract가 정한 상태 저장 위치와 task 브리프 문구를 대조하라는 항목이 없다. 096-001에서는 Contract가 cycle을 `context-review.md` `bouncer.context_review.cycle`에 둔다고 했는데, task 브리프는 "cycle-owned runtime"으로만 적었고 구현은 runtime `state.json`을 썼다. 이 불일치를 승인 전에 잡지 못했다.
- `.codex/agents/bouncer-context-reviewer.toml`은 같은 줄을 담는다. `test/agents.test.js:72-77`이 `mdToCodexToml(md)`(`scripts/src/lib/codex-agents.ts`)와 바이트 단위로 같은지 검사한다. 생성 npm script는 없다.
- `references/context-review/index.md:66-75`는 clustered가 "같은 네 rubric"을 손실 없이 나눈다고 적는다. local은 `affected_paths`·Checklist 수정 경로를, global은 공유 경로·DAG와 Korean quality 전체를 맡는다. `:92`는 역할 문서 제목 `## Rubric — four scopes`를 인용한다.
- `skills/bouncer-plan/references/context-review.md:34`는 "perspective `combined` (all four rubrics)"라고 적는다.
- `test/skill-context-review.test.js:12-28`은 세 문서의 fingerprint 예시 줄만 검사하고 rubric 문구는 검사하지 않는다. `scripts/check-doc-shape.js:784-789`가 역할 문서에 요구하는 제목은 Authority·guards·Review modes·Output contract뿐이다. `test/agents.test.js:61`은 영어 제목을 요구한다.

#### Target behavior

- 역할 문서 `## Rubric — two scopes` 아래 두 판단:
  - `### Cross-document consistency and scope (\`cross_document\`)`:
    - 기존 epic→blueprint→task 대조, Checklist·Interface 대조, Mermaid zoom 판단을 그대로 둔다.
    - 옛 Scope review의 의미 판단을 옮긴다. Checklist가 수정하는 파일이 `affected_paths`에 없는지, 승인된 범위·Out of scope와 어긋나는지를 본다.
    - 저장 위치·상태 소유권 대조를 추가한다. blueprint Contract `데이터·상태`가 정한 저장 위치(문서·필드·runtime 파일)와 소유자를, 각 task의 Interface·Touch·Checklist가 가리키는 위치와 대조한다. 위치를 적지 않은 모호한 문구("cycle-owned runtime")도 Contract가 위치를 정했으면 finding이다. 096-001 사례(Contract는 `context-review.md` `bouncer.context_review.cycle`, 구현은 runtime `state.json`)를 예시로 든다.
    - 보안 위험 표시 확인을 추가한다. Interface·Touch가 공개 API·인증·인가·자격 증명 변경을 말하는데 task `review_risk`가 비어 있거나 해당 값이 빠졌으면 finding이다. plan gate 경고 `review-risk-missing`은 입력 증거일 뿐 판단을 대신하지 않는다.
  - `### Verifiability of success criteria (\`success_criteria\`)`: 기존 문구를 유지한다.
- `### Out of judgment`에 다음을 더한다:
  - 경로 존재(Modify·Delete·Rename 원본)는 plan gate G25가 판정한다.
  - 문장 품질은 작성 단계 stop-slop(advisory)이 맡는다.
  - 둘 다 finding으로 내지 않는다.
- Review modes:
  - `combined`는 두 scope를 모두 판단한다.
  - `local`은 cluster 안 task의 Interface·Touch·Checklist 일관성, Checklist 수정 경로와 `affected_paths`, task 보안 위험 표시, red assertion을 판단한다.
  - `global`은 epic→blueprint→task와 cluster 사이 정합성, Contract 저장 위치·상태 소유권 대조, 공유 경로·DAG, epic 성공 기준 커버리지를 판단한다.
  - legacy 관점 하나씩 배정 절은 "기존 기록의 category로만 읽힌다. 새 호출에는 배정하지 않는다"로 바꾼다. Output contract category 목록은 `combined | local | global`이고 legacy 이름은 기존 기록 호환으로 표시한다.
- `.codex/agents/bouncer-context-reviewer.toml`은 `mdToCodexToml(agents/bouncer-context-reviewer.md)` 결과와 바이트 단위로 같다.
- `references/context-review/index.md`는 "두 rubric", 새 local·global 분담, 새 제목 인용(`## Rubric — two scopes`)을 적는다. 두 판단 밖의 일은 G25·stop-slop이 맡는다고 한 줄로 적는다.
- `skills/bouncer-plan/references/context-review.md:34`는 "(both rubrics)"이다.
- `test/skill-context-review.test.js`가 다음 문구를 고정한다:
  - 역할 문서에 `### Scope review`와 `### Korean quality` 제목이 없다.
  - Cross-document 절에 `storage location`, `state ownership`, `review_risk` 문구가 있다.
  - `### Out of judgment` 절에 `G25`와 `stop-slop` 문구가 있다.
  - `references/context-review/index.md`에 `four rubrics`가 없다.

#### Interface

- 제공:
  - 역할 문서 제목: `## Rubric — two scopes`, `### Cross-document consistency and scope (\`cross_document\`)`, `### Verifiability of success criteria (\`success_criteria\`)`, `### Out of judgment`.
  - 새 finding category: `combined | local | global`. fingerprint 형식 `context:<category>:<brief_clause>:<file>#<symbol>`은 그대로다.
- 거부:
  - 역할 문서는 reviewer가 경로 존재나 문장 품질만을 근거로 finding을 내지 않는다고 명시한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-context-reviewer.md` | `## Review modes`, `## Rubric — four scopes`, `## Output contract` | Modify | 네 scope rubric과 legacy 배정 | 두 scope rubric, 저장 위치·상태 소유권·`review_risk` 항목, Out of judgment 확장 | W09·W06·W13 판단 소유 |
| `.codex/agents/bouncer-context-reviewer.toml` | 생성 산출물 | Modify | 역할 문서 사본 | `mdToCodexToml` 재생성 | epic 성공 기준 15 TOML 일치 |
| `references/context-review/index.md` | Step 3 Judge | Modify | 네 rubric·옛 분담·옛 제목 인용 | 두 rubric·새 분담·새 제목 | 역할 문서와 일치 |
| `skills/bouncer-plan/references/context-review.md` | discovery dispatch 설명 | Modify | "all four rubrics" | "both rubrics" | 역할 문서와 일치 |
| `test/skill-context-review.test.js` | 신규 rubric 문구 테스트 | Modify | fingerprint 예시만 검사 | 두 scope·저장 위치·`review_risk`·G25 문구 단언 | 회귀 고정 |

#### Constraints

- 역할 문서의 `## Authority`, guard, `## Review modes`, `## Output contract` 제목과 순서(`scripts/check-doc-shape.js:784-789`)를 유지하고 제목은 영어로 쓴다.
- Delta 모드 계약(origin 규칙, `revision_diff`·`related_documents` 입력), Calibration severity, fingerprint 정규화 문구는 바꾸지 않는다.
- 세 문서의 fingerprint 예시 줄은 `test/skill-context-review.test.js` 정규식을 계속 통과해야 한다. 예시 category를 `scope`에서 새 이름으로 바꿔도 된다.
- TOML은 손으로 고치지 않는다. `npm run build` 뒤 `node -e`로 `require('./scripts/lib/codex-agents').mdToCodexToml`를 호출해 생성한다.
- 테스트 이름은 `조건 → 결과` 형식을 따른다.

### EPIC-098/BP-003/TASK-005 · `1378cc1f`

#### Goal & intent

알려진 결함 다섯 가지를 심은 small(commit task 2개)·large(commit task 4개) 계획을 한 명령으로 만들 수 있다. 사용자는 README 절차대로 변경 전후 context review의 호출 수·토큰·유효 finding·놓친 blocker/major를 `benchmarks/drive-serial-4/results.md` BP 003 표에 기록한다. 기계 판정 결함(G25, `review-risk-missing`)은 fixture 테스트가 고정한다.

#### Current behavior

- `benchmarks/drive-serial-4/setup.cjs`(305줄):
  - `run()`(`:248`, `BOUNCER_HOME` 고정 `:246`)으로 `bouncer scaffold epic`만 실행하고, 나머지 문서는 `write(dir, rel, content)`(`:59`)·`doc(frontmatter, body)`(`:65`)·`commonMeta`(`:69`)로 직접 쓴다.
  - git init·commit(`:264-266`) 뒤 `bouncer current --set`(`:269`)을 실행한다.
  - 비어 있지 않은 디렉터리는 `invalid-target`으로 쓰기 전에 거절한다. CLI는 거절 시 exit 2, 명령 실패 시 exit 1, 성공 시 JSON 한 줄이다(`:279-300`).
  - helper는 export되지 않고 `setupDriveSerial4`만 export한다(`:305`).
  - epic description이 scaffold 요약과 다르면 S13이 난다(`:16-17`).
- `benchmarks/drive-serial-4/setup.test.cjs`(105줄)는 `mkdtempSync` 임시 디렉터리에서 `BOUNCER_HOME=REPO_ROOT`로 CLI를 실행해 결과를 단언하고 `finally`에서 정리한다. 테스트 이름은 `조건 → 결과` 형식이다.
- `benchmarks/drive-serial-4/results.md:23-30`에 `## plan context review 변경 전후 (BP 003)` 표(호출 수·토큰·유효 finding·놓친 blocker/major, 모두 `미측정`)가 있다. 측정 절차와 입력 계획은 없다.
- `benchmarks/README.md:30-40`은 fixture 파일 목록과 `drive-serial-4` 안내 문단을 둔다.
- `benchmarks/**`는 eslint ignore이고 coverage 대상이 아니다. `npm test`(`node --test`) 기본 glob이 `benchmarks/**/*.test.cjs`를 실행한다.
- `CHANGELOG.md:8-17` `## [Unreleased]` `### Changed` 첫 항목이 BP 002다. 형식은 `- **제목 (EPIC 098 BP 002)** — …`이고 약 100열에서 줄을 바꾼다.

#### Target behavior

- `node benchmarks/plan-review/setup.cjs <빈 디렉터리>`가 git 저장소 하나를 만든다. epic 하나 아래 blueprint 두 개(`001-small`: commit task 2개 + verification 1개, `002-large`: commit task 4개 + verification 1개)를 두고, epic·blueprint는 `approved`, commit task는 `ready`이고, 각 blueprint의 `context-review.md`는 `pending`이다. 성공하면 JSON 한 줄(`{ ok: true, dir, blueprints: { small, large }, defects: [...] }`)을 출력하고 exit 0이다. 비어 있지 않은 디렉터리는 쓰기 전에 exit 2로 거절한다.
- 심는 결함과 잡아야 할 주체:

  | id | 결함 | 위치 | 잡는 주체 |
  | --- | --- | --- | --- |
  | D1 | Contract는 상태를 `context-review.md` frontmatter에 둔다고 하는데 task 브리프는 runtime `state.json`에 저장한다고 적음 | small·large | reviewer `cross_document` |
  | D2 | Checklist가 수정하는 파일이 `affected_paths`에 없음 | small·large | reviewer — 변경 전 `scope`, 변경 후 `cross_document` |
  | D3 | epic 성공 기준이 "리뷰 품질을 개선한다"처럼 판정할 수 없음 | epic | reviewer `success_criteria` |
  | D4 | Touch에 `src/auth/session.ts`가 있는데 `review_risk: []` | small·large | plan gate `review-risk-missing` + reviewer |
  | D5 | Touch Modify 경로 `src/missing.ts`가 저장소에 없음 | small·large | plan gate G25 |

- `benchmarks/plan-review/setup.test.cjs`가 다음을 단언한다:
  - `bouncer review-dispatch plan`이 small에서 `strategy: 'single'`, large에서 `clustered`다.
  - `bouncer validate --gate plan`이 두 blueprint 모두 `G25` 실패와 `review-risk-missing` 경고를 낸다.
  - 출력 `defects` id가 D1–D5다.
  - 비어 있지 않은 대상은 파일을 쓰지 않고 거절한다.
- `benchmarks/plan-review/README.md`는 측정 절차를 적는다:
  - fixture 만들기.
  - 변경 전(BP 003 merge 전 base의 plugin)과 변경 후 각각 `/bouncer-plan` step 5를 실행하고, 호출마다 `bouncer metrics start --kind context-review`·`metrics end`로 기록한다.
  - `bouncer metrics summary`로 호출 수·토큰·시간을 확인한다.
  - finding을 D1–D5와 대조해 유효 finding과 놓친 blocker/major를 세는 법. 대조는 결함 id 기준이며, 같은 결함을 변경 전에는 legacy `scope`나 `korean_quality` 관점이, 변경 후에는 `combined`·`local`·`global` 호출이 잡아도 같은 결함으로 센다.
  - 결과는 `../drive-serial-4/results.md` BP 003 표에 적는다.
- `benchmarks/drive-serial-4/results.md` BP 003 절에 입력이 `../plan-review/` fixture라는 한 줄을 더한다. 표 값은 `미측정`으로 둔다.
- `benchmarks/README.md` 파일 목록과 안내 문단에 `plan-review/`를 더한다.
- `CHANGELOG.md` `## [Unreleased]` `### Changed` 맨 위에 `(EPIC 098 BP 003)` 항목이 있다. 이 항목은 다음을 적는다: 필수 판단 두 가지, commit task 3개 이하 `combined`, G25, `review-risk-missing`, 저장 위치·상태 소유권 대조, legacy 관점 읽기 호환, seeded fixture.

#### Interface

- 제공:
  - CLI `node benchmarks/plan-review/setup.cjs <dir>`. 성공 시 stdout JSON 한 줄을 내고 exit 0이다.
  - export `setupPlanReview(dir: string): { ok: true, dir: string, blueprints: { small: string, large: string }, defects: string[] }`.
- 거부:
  - 대상이 비어 있지 않거나 없는 상위 경로면 `codedError('invalid-target')`를 던지고, CLI는 파일을 쓰지 않은 채 exit 2다.
  - `bouncer` 명령이 실패하면 `command-failed`를 던지고, CLI는 exit 1이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/plan-review/setup.cjs` | `setupPlanReview` | Create | 없음 | 결함 심은 small·large 계획 생성 | 회귀 입력 |
| `benchmarks/plan-review/setup.test.cjs` | 신규 테스트 | Create | 없음 | dispatch strategy·G25·경고·거절 단언 | 기계 판정 결함 고정 |
| `benchmarks/plan-review/README.md` | 측정 절차 | Create | 없음 | 변경 전후 측정·결함 대조 절차 | 측정 재현 |
| `benchmarks/drive-serial-4/results.md` | BP 003 절 | Modify | `미측정` 표 | 입력 fixture 안내 한 줄 | 기록 위치 유지 |
| `benchmarks/README.md` | 파일 목록, 안내 문단 | Modify | drive-serial-4 안내 | plan-review 항목 추가 | 색인 일치 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | BP 002 항목 | BP 003 항목 추가 | epic 성공 기준 15 |

#### Constraints

- fixture 생성은 `BOUNCER_HOME`을 이 저장소로 고정하고, `bouncer scaffold`·`bouncer init` 결과를 덮어쓸 때 S13(epic description)·OKF 필드를 맞춘다.
- 결함 D1–D3은 reviewer 판단 대상이므로 setup 테스트에서 단언하지 않는다. D4·D5만 기계 단언한다.
- small·large의 결함 외 문서는 G10·G11·G12·G19·G20을 통과하도록 쓴다. 테스트는 실패 코드 집합이 `G25`와 `G18`(pending context-review)뿐임을 단언해 의도하지 않은 결함을 막는다.
- 테스트는 임시 디렉터리만 쓰고 `finally`에서 정리한다. 이름은 `조건 → 결과` 형식을 따른다.
- 측정은 실행하지 않는다. 결과 표 값은 `미측정`으로 둔다.

### EPIC-098/BP-003/TASK-006

#### Goal & intent

TASKS-001–005가 모두 integration checkout에 통합된 상태에서 `npm run ci`가 통과한다는 종단 증적을 남긴다. epic 성공 기준 13·14·15의 CI 판정 부분을 한 번에 확인한다.

#### Current behavior

각 commit task는 자기 범위의 테스트를 통과했지만, dispatch 기준·G25·경고·rubric 문서·TOML·fixture가 함께 통합된 상태의 전체 CI는 아직 실행되지 않았다.

#### Target behavior

통합 상태에서 `npm run ci`가 성공하고 verification 증적이 기록된다. 실패하면 이 노드는 닫히지 않고 기존 repair 경로를 따른다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.