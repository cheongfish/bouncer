---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/002-plan-roundtrip-reduction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T00:00:09.828+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '089'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 9585dd5dad7bd25aecfa93d8882ff3bd0ef72b05
      range_to: e83d1b133c36efde369d73dd6af910a753efed6c
      diff_sha: 50336116f3f1492b80aaf28b5c8523a66847286cecb59950a8f13dbb84a81c6b
      recorded_at: '2026-10-10T00:01:01+09:00'
  task_commits:
    - task: EPIC-089/BP-002/TASK-001
      sha: 91b7a850
      intent_anchor: task-001
    - task: EPIC-089/BP-002/TASK-002
      sha: c36616b3
      intent_anchor: task-002
    - task: EPIC-089/BP-002/TASK-003
      sha: 8c9ce898
      intent_anchor: task-003
    - task: EPIC-089/BP-002/TASK-004
      sha: e83d1b13
      intent_anchor: task-004
---
# Explain

## Background

`/bouncer-plan`은 독립된 확인 질문을 여러 턴으로 나누고, 단계마다 탐색 전사를 다시 넘기며, 보완 context review도 문서 전체를 다시 읽게 했다. light 선택은 사용자 선언만 있고, 근거를 보여 줄 CLI 신호가 없었다. 이 변경은 질문을 한 메시지에 묶고, 단계 사이에는 현재 계획·미결 결정·변경 요약만 넘기며, `plan inspect --blueprint`로 light/full 추천 근거를 내고, context review 후속 라운드가 변경분만 받을지 전체를 다시 돌릴지 CLI가 판정하게 한다.

## Intuition

확인은 한 번에 묻고, light 신호는 근거만 보여 주며, 재검토는 바뀐 페이지만 다시 읽는다.

## Code

- `skills/bouncer-plan/references/roundtrip.md` — 독립 질문 묶음, light 선언≠승인, 단계 핸드오프 제한
- `rules/planning.md` — `plan inspect` routing은 advisory; 선언은 작성 전, 승인은 작성 뒤
- `scripts/src/lib/plan-inspect.ts` — `--blueprint`일 때 `routing` (`recommendation`, `reasons`, `riskPaths` 등); 없으면 `null`
- `scripts/src/lib/review-dispatch.ts`, `plan-snapshot.ts` — `parts` / `scope_parts` / `follow_up` / `changed_documents`; `--previous` 비교
- `skills/bouncer-plan/references/context-review.md` — `follow_up: partial`이면 delta, `full`이면 discovery 재시작

## Quiz

1. `bouncer plan inspect --blueprint <dir>`가 `routing.recommendation: light-candidate`를 내면 워크플로는 무엇을 하나?
   - A) `bouncer.scale`을 자동으로 `light`로 바꾼다
   - B) 추천 근거로만 보여 주고, light는 사용자 선언이 있어야 한다
   - C) 최종 `plan.approval`을 생략한다

2. context review 보완 후 `review-dispatch plan --previous`가 `follow_up: full`이면?
   - A) mode `delta`로 변경 문서만 다시 판정한다
   - B) 세 번째 라운드를 연다
   - C) discovery를 처음부터 다시 시작한다

3. 독립된 비-ACQ 확인 질문(범위·리스크·verify 권고 등)은 어떻게 다루나?
   - A) 한 채팅 메시지에 묶어 한 번에 받는다
   - B) ACQ gate와 같은 화면에 합친다
   - C) `config.autonomy: auto`면 생략한다

## Tasks

### EPIC-089/BP-002/TASK-001 · `91b7a850`

#### Goal & intent

`/bouncer-plan`이 (a) ACQ가 아닌 독립 질문(범위·요구·위험, 가능한 verify 명령 추천 여부, `possibly-superseded` 유지 여부)을 한 메시지로 묻고, (b) light 선언은 scaffold 전에 받되 작성된 계획의 최종 승인(`plan.approval`)을 대신하지 않으며, (c) 단계 사이에 현재 계획·미결 결정·변경 요약만 넘기도록 규칙을 `skills/bouncer-plan/references/roundtrip.md`에 두고 SKILL.md와 discovery가 그 reference를 가리킨다. 수용 조건은 문서 문자열 테스트와 단어 수 baseline 테스트 통과다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md` step 1(`:68-73`)은 "ask the user every open decision in one chat message ... before the Discover ACQ"라고 쓴다. `references/discovery/index.md:39-46`도 같은 일괄 질문을 요구한다. 열린 결정은 이미 한 메시지다.
- ACQ는 `rules/acq.md:14-22`가 gate마다 별도 display를 요구하고, `:39`가 건너뛸 수 있는 ACQ와 반드시 받아야 할 동의를 합치지 말라고 한다.
- `plan.light_scope`는 step 2에서 `plan.id_allocation` 뒤, scaffold 전에 묻는다(`SKILL.md:96-103`). `plan.approval`은 step 6(`:230-238`)이다. 선언이 최종 승인을 대신하지 않는다는 문장은 없다.
- 단계 간 전달 규칙은 plan SKILL에 없다.
- 진입 SKILL 단어 합계는 7803, baseline 7897이라 여유가 약 94 단어다(`test/skill-bouncer-surface.test.js:134-151`).
- 재현: `node --test test/skill-bouncer-plan.test.js test/acq-gate-ids.test.js test/skill-discovery.test.js test/lightweight-cycle.test.js test/skill-bouncer-surface.test.js`.
- 고정된 문구: `test/skill-bouncer-plan.test.js:199-203`의 `ask the user every open decision ... before the Discover ACQ`, `:472-474`의 `**ACQ — Discover`·`**ACQ — Approval`·`**ACQ — affected_paths`, `test/acq-gate-ids.test.js:14-22`의 gate id 목록, `test/lightweight-cycle.test.js:46-62`의 light 문구.

#### Target behavior

- 성공: reference가 세 규칙을 담고, `SKILL.md`에는 step 1 끝에 reference를 가리키는 문장 하나만 늘어난다. `discovery/index.md`는 같은 reference를 가리키는 문장 하나를 더한다. `rules/planning.md` Lightweight cycle 절에 "선언은 작성 전, 최종 승인은 작성 뒤이며 선언은 승인이 아니다" 문장이 들어간다.
- 거부: reference는 ACQ gate 둘 이상을 한 display에 합치라고 하지 않고, 동의 항목을 묶음 질문에 넣지 않는다고 적는다.
- 보존: gate id 일곱 개와 순서, 기존 고정 문구, step 5의 light 생략 문구는 그대로다. SKILL 단어 합계는 baseline 미만이다.

#### Interface

- 제공: `skills/bouncer-plan/references/roundtrip.md`(신규 문서). 구성은 "묶는 질문", "묶지 않는 항목", "선언과 승인", "단계 간 전달"의 네 절이다.
- 거부: reference는 gate id를 새로 만들거나 이름을 바꾸지 않고, 사용자 동의를 추론하는 문구를 넣지 않는다.
- 정의: "묶는 질문"은 한 질문의 답이 다른 질문의 선택지를 바꾸지 않는 비-ACQ 질문이다. 예: 범위 확인과 위험 확인.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/references/roundtrip.md` | 신규 | Create | 없음 | 질문 묶음·선언/승인 순서·단계 간 전달 규칙 | SKILL 단어 수 여유가 작아 reference에 둠 |
| `skills/bouncer-plan/SKILL.md` | step 1 | Modify | plan 절차 | reference를 가리키는 한 문장 추가 | 진입점 |
| `references/discovery/index.md` | Open decisions 항, Guardrails | Modify | discovery 지침 | reference 포인터 한 문장 | 일괄 질문 정본 |
| `rules/planning.md` | `## Lightweight cycle` | Modify | light 계약 | 선언≠승인 문장 | light 규칙 정본 |
| `test/skill-bouncer-plan.test.js` | step 1·reference 단언 | Modify | plan 문구 핀 | reference 포인터와 세 규칙 단언 | 문구 고정 |
| `test/skill-bouncer-surface.test.js` | `ENTRY_WORD_BASELINE` | Modify | 단어 수 상한 | 합계 초과 시에만 plan 값 조정 | 상한 테스트 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | 프로젝트 규칙 |

#### Constraints

- SKILL.md 증가는 baseline 여유 안에서 한 문장(40 단어 이하)이다. 넘기면 baseline 숫자를 올리기 전에 문장을 줄인다.
- `ask the user every open decision ... before the Discover ACQ` 문구는 한 글자도 바꾸지 않는다.
- reference 본문은 영어 지침 문서의 기존 어조와 같은 언어(영어)로 쓴다. 경로·id는 그대로 둔다.
- `config.autonomy`가 질문을 건너뛰게 하지 않는다고 reference에 적는다.

### EPIC-089/BP-002/TASK-002 · `c36616b3`

#### Goal & intent

`bouncer plan inspect --blueprint <dir>`이 초안 task 문서에서 task 수, 의존 수, 접촉 모듈, 위험 경로를 읽어 `routing` 필드를 낸다. `--blueprint`가 없으면 `routing: null`이다. 신호는 추천 근거이고 light 선택·승인을 하지 않는다. 수용 조건은 신호별 테스트, 기존 payload 불변 테스트, 규칙 문서 정합이다.

#### Current behavior

- `InspectOk`(`plan-inspect.ts:39-46`)는 `ok, nextEpicId, epic, maintenanceEpic, verifySignals, current`다. 반환은 `:228-236`이다. `planInspect({repoRoot, epicDir})`만 export한다(`:188`, `:239`).
- `verifySignals`는 저장소 루트 파일 존재와 `package.json#scripts` 키만 본다(`collectVerifySignals`, `:150-172`). 계획을 읽지 않는다.
- `--epic-dir`는 `epic` 정보만 채우고 task를 읽지 않는다(`:200-218`). CLI는 `cmdPlan`(`cli-doc-commands.ts:213-236`)이 `epic-dir`·`repo`만 읽고, 도움말은 `:268`, 문서는 `rules/cli.md:13`이다.
- 초안 task 데이터는 `listTasksDocs({repoRoot, blueprintDir})`(`tasks-docs.ts:144`)와 `readDoc`로 얻는다. `affected_paths`는 `approval-snapshot.ts:76-88`이 이미 읽는다. 위험 경로 분류기는 없다(`review_risk` frontmatter만 있다).
- `rules/planning.md:32-39`는 "no automatic sizing from diff size, path count, or file count"라고 쓴다.
- 재현: `node --test test/plan-inspect.test.js`. `verifySignals`는 `:93`에서만 단언하고, 임시 git 저장소는 `:23-45`가 만든다.
- I/O 결합: `plan-inspect.ts`는 `fs.existsSync/statSync/readdirSync/readFileSync`와 `readDoc`, `resolveCurrent`를 직접 쓴다. 분류 로직을 `string[]`을 받는 순수 함수로 두면 I/O 없이 테스트된다.

#### Target behavior

- 성공: `--blueprint <dir>`가 유효하면 `routing = { advisory: true, tasks, dependencies, modules, riskPaths, recommendation, reasons }`. `tasks`는 `execution_kind: commit` task 수, `dependencies`는 `depends_on` 항목 합, `modules`는 모든 `affected_paths`의 첫 경로 조각을 정렬·중복 제거한 목록이며 `test`, `tests`, `docs`와 루트 파일(`CHANGELOG.md` 등)은 세지 않는다. `riskPaths`는 경로 규칙에 걸린 `{path, kind}`다.
- `recommendation`: `tasks >= 2`, `dependencies > 0`, `modules.length >= 3`, `riskPaths` 비어 있지 않음 중 하나라도 있으면 `full-candidate`, 아니면 `light-candidate`다. `reasons`는 해당 조건 이름 목록이다.
- 실패: 존재하지 않거나 canonical이 아닌 blueprint 경로는 `ok: false`, `reason: 'invalid-blueprint-dir'`다. `affected_paths`가 비어 있으면 `modules: []`이고 이유에 `affected-paths-empty`를 더한다.
- 보존: `--blueprint`를 주지 않으면 기존 응답에 `routing: null`만 늘고 다른 필드는 같다. `scale`·pointer·문서를 바꾸지 않는다. 삭제·이름 변경은 신호에서 제외한다.

#### Interface

- 제공:
  - `planInspect({ repoRoot, epicDir, blueprintDir })`, `classifyRoutingPaths(paths: string[]) → Array<{ path, kind }>`, `summarizeRouting(tasks: Array<{ paths: string[], dependsOn: string[] }>) → Routing`.
  - CLI `plan inspect [--epic-dir <dir>] [--blueprint <dir>]`.
- 거부: `--blueprint`가 canonical blueprint 디렉터리가 아님 → `invalid-blueprint-dir`(exit 1). `--blueprint`만 주고 값이 없음 → exit 2.
- 경로 규칙(정의): `security` = 경로 조각(`/`로 나눈 한 조각, 확장자 제외)이 `auth`, `credential(s)`, `secret(s)`, `token(s)`, `permission(s)`와 정확히 같음; `manifest` = `package.json`, `package-lock.json`, `bun.lock`, `yarn.lock`, `pnpm-lock.yaml`, `requirements*.txt`, `go.mod`; `build` = `Dockerfile*`, `.github/workflows/`, `Makefile`, `tsconfig*.json`; `migration` = `migrations/`, `schema` 조각. 예: `src/auth/session.ts` → `security`, `src/tokenizer.ts`·`docs/author.md` → 해당 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-inspect.ts` | `planInspect`, `InspectOk` | Modify | 선택 id·pointer·verify 신호 | `blueprintDir` 입력과 `routing` 계산 | 신호 소유 모듈 |
| `scripts/src/lib/cli-doc-commands.ts` | `cmdPlan`, usage 문자열 | Modify | `plan inspect` CLI | `--blueprint` 플래그와 도움말 | 플래그 파싱 위치 |
| `rules/cli.md` | plan inspect 줄(`:13`) | Modify | CLI 계약 | 플래그와 `routing` 설명 | CLI 문서 |
| `rules/planning.md` | `## Lightweight cycle` | Modify | light 계약 | "자동 선택 없음, 추천 신호는 근거로만" 문구 | 기존 "no automatic sizing" 문장과 정합 |
| `skills/bouncer-plan/references/roundtrip.md` | 선언 절 | Modify | task 001이 만드는 reference | 초안 작성 뒤 `plan inspect --blueprint`로 신호를 보여 주는 한 줄 | 신호 사용 시점 |
| `test/plan-inspect.test.js` | 신규 케이스 | Modify | inspect 단언 | 신호별·불변·거부 테스트 | 계약 고정 |
| `test/lightweight-cycle.test.js` | planning 문구 단언 | Modify | light 문구 핀 | 새 문장 단언 | 문구 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- `routing`은 읽기 전용이다. 어떤 파일도 쓰지 않는다(기존 `:188` 읽기 전용 테스트가 유지된다).
- 경로 규칙은 코드 상수 하나로 두고 설정 파일로 열지 않는다.
- `skills/bouncer-plan/references/roundtrip.md`는 task 001이 만든 파일이다. 이 task는 그 파일의 선언 절에 한 줄만 더하고 다른 절은 바꾸지 않는다.

### EPIC-089/BP-002/TASK-003 · `8c9ce898`

#### Goal & intent

`bouncer review-dispatch plan --blueprint <dir> [--previous <file>]`이 현재 문서별 본문 digest(`parts`)와 범위 digest(`scope_parts`)를 내고, `--previous`로 받은 이전 payload와 비교해 `follow_up: 'partial'|'full'`과 `changed_documents`를 돌려준다. `full` 조건은 문서 집합 변화(task 추가·삭제), 에픽 또는 blueprint `index.md` 본문 변화, 어느 task의 `scope_parts` 변화(`affected_paths`·`depends_on`·`## Interface`·`## Touch` 절 본문)다. `partial`은 그 밖의 `tasks.md` 본문만 바뀐 경우다. 수용 조건은 조건별 테스트, 집계 digest 불변, G18 판정 불변이다.

#### Current behavior

- `classifyPlanReview`(`review-dispatch.ts:105-195`)는 `validateBlueprint(planDraft:true)` 뒤 scale이 light면 `skip`, task 1개 이하면 `single`/`combined`, 그 밖은 `clustered`(local per cluster + global)를 낸다. payload `PlanDispatchOk`(`:50-60`)는 `target{digest, documents}, strategy, task_count, clusters, perspectives, reasons`이고 mode·round·문서별 digest가 없다.
- 집계 digest는 `computePlanSnapshot`(`plan-snapshot.ts:30-58`)이 에픽·blueprint index·각 tasks.md의 frontmatter를 뺀 본문을 순서대로 sha256 한 번으로 만든다. 루프는 이미 문서 단위다(`:46-56`). `plan-snapshot.ts`는 validate·review-dispatch를 require하면 안 된다(`:15-18`).
- frontmatter의 `affected_paths`·`depends_on` 변경은 digest에 보이지 않는다.
- G18(`validate-gates.ts:933-985`)은 `context-review.md`가 accepted일 때 가장 높은 `round`의 digest가 현재 digest와 같은지만 본다. 불일치는 `context review is stale: ...`다.
- stale 복구는 `skills/bouncer-plan/references/context-review.md`에서 항상 round 1 discovery 재시작이고, delta는 한 review 안에서 한 번이다(`references/context-review/index.md:78-80`). 보완용 부분 규칙이 없다.
- 재현: `node --test test/review-dispatch.test.js`(`:287` light→skip, `:300` single, `:315` clustered, `:671` CLI JSON, `:797` help 예시가 G18 통과), `test/validate-gates.test.js:780-861`, `test/skill-bouncer-plan.test.js:258-317`·`:565-568`·`:604`.

#### Target behavior

- 성공: `strategy`가 `single`·`clustered`인 payload에 `parts: Record<path, sha256>`와 `scope_parts: Record<tasksPath, sha256>`가 추가된다. 키는 `target.documents`와 같은 저장소 상대 POSIX 경로이고, `parts`는 에픽 `index.md`, blueprint `index.md`, 각 `tasks.md` 본문 sha256을 모두 담는다. `scope_parts`는 각 `tasks.md`의 `affected_paths`(정렬), `depends_on`(정렬), `## Interface` 절 본문, `## Touch` 절 본문을 이어 붙인 문자열의 sha256이다. `--previous` 없으면 `follow_up: 'full'`, `changed_documents: []`다. `skip` 응답과 실패 응답에는 이 필드가 없다.
- 판정: `--previous`가 있으면 문서 집합이 다르거나 에픽·blueprint `index.md` 본문 digest가 다르거나 어느 `scope_parts`가 다르면 `follow_up: 'full'`이다. 그 밖이고 일부 `tasks.md` 본문만 다르면 `follow_up: 'partial'`과 그 저장소 상대 경로의 `changed_documents`다. 아무것도 다르지 않으면 `partial`과 빈 목록이다.
- 실패: `--previous`가 없는 파일이거나 JSON이 아니거나 `parts`가 없으면 `ok: false`, `reason: 'previous-payload-invalid'`다. 기존 실패 경로는 그대로다.
- 보존: 집계 `target.digest` 값, `strategy`·`perspectives`·`clusters`, G18 형식과 판정, 라운드 mode enum은 바뀌지 않는다. 문서 규칙: `partial`이어도 일반 delta 허용 입력(새 digest, 이전 findings, `changed_documents`, read-only cwd)만 쓰고, `full`이면 round 1 discovery를 다시 시작한다.

#### Interface

- 제공:
  - `classifyPlanReview(opts)`의 `single`·`clustered` 반환에 `parts`, `scope_parts`, `follow_up`, `changed_documents`.
  - CLI `review-dispatch plan --blueprint <dir> [--previous <file>]`, `--help` 예시에 필드 설명.
  - `plan-snapshot.ts`가 `computePlanParts({repoRoot, blueprintDir}) → { parts, scope_parts }`를 export한다. `computePlanSnapshot`의 반환 형태 `{ ok, digest, documents }`와 digest 값은 바뀌지 않는다. `review-dispatch.ts`가 `computePlanParts`를 호출한다.
- 거부: `--previous`가 payload가 아닌 JSON → `previous-payload-invalid`(exit 1). `--previous`만 있고 경로 값 없음 → exit 2.
- 정의: "범위 digest"는 문자열 `affected_paths 정렬 JSON + '\n' + depends_on 정렬 JSON + '\n' + Interface 절 본문 + '\n' + Touch 절 본문`의 sha256 hex다. 예: `["a.ts"]\n["TASKS-001"]\n<Interface>\n<Touch>`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `classifyPlanReview`, `PlanDispatchOk` | Modify | plan 리뷰 dispatch 분류 | 문서별 digest·`follow_up` 판정 추가 | payload 소유 모듈 |
| `scripts/src/lib/plan-snapshot.ts` | `computePlanSnapshot`, `computePlanParts` | Modify | 집계 digest | `computePlanParts` 추가(집계 값·반환 형태 불변) | 문서 순회와 `readDoc`가 이미 여기 있음 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `--previous` 파싱, help | Modify | review-dispatch CLI | 플래그와 help 예시 | CLI 진입 |
| `rules/cli.md` | `review-dispatch plan` 줄(`:86`)과 payload 설명(`:113`) | Modify | CLI 계약 | `--previous`와 새 필드 | CLI 문서와 구현 일치 |
| `skills/bouncer-plan/references/context-review.md` | stale 복구 단락 | Modify | stale 복구 절차 | `follow_up` 분기 규칙 | 복구 규칙 정본 |
| `references/context-review/index.md` | delta 규칙 | Modify | 리뷰어 행동 지침 | `partial`/`full` 입력 문구 | 행동 지침 |
| `test/review-dispatch.test.js` | 신규 케이스 | Modify | dispatch 단언 | 판정 조건별 테스트 | 계약 고정 |
| `test/skill-bouncer-plan.test.js` | `:258-317`, `:565-568` | Modify | stale/delta 문구 핀 | 새 분기 문구 단언 | 문구 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- `plan-snapshot.ts`는 `validate`·`validate-gates`·`review-dispatch`를 require하지 않는다.
- 집계 digest 계산 순서와 입력을 바꾸지 않는다. 기존 `cli-validate` 종단 테스트가 그대로 통과해야 한다.
- 새 mode, 새 라운드 형식, 세 번째 라운드를 만들지 않는다. CLI payload가 유일한 dispatch 권한이라는 기존 규칙을 유지한다.
- `skills/bouncer-plan/SKILL.md`는 수정하지 않는다(단어 수 baseline).

### EPIC-089/BP-002/TASK-004 · `e83d1b13`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/review-dispatch.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.