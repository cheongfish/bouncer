---
type: bouncer.tasks
title: slug 경로 쓰기와 order 정렬 적용
description: Write slug-format epic and blueprint documents with frontmatter order and sort blueprints by order with gap tolerance
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - scaffold
  - order
  - plan-inspect
timestamp: '2026-10-20T17:07:45.173+09:00'
bouncer:
  id: TASKS-002
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-001
  parallel_safe: true
  dependency_gate: integrated
  review_risk:
    - public_interface
  verify: node --test test/scaffold.test.js test/plan-inspect.test.js test/current.test.js test/validate-structural.test.js test/validate-gates.test.js test/cli-help.test.js test/plan-approve.test.js test/import-history.test.js test/migrate-task-layout.test.js test/retention-migration.test.js
  affected_paths:
    - scripts/src/lib/layout.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/src/lib/cli-usage.ts
    - scripts/src/lib/plan-inspect.ts
    - scripts/src/lib/plan-approve.ts
    - scripts/src/lib/validate-structural.ts
    - scripts/src/lib/validate.ts
    - scripts/src/lib/validate-gates.ts
    - scripts/src/lib/current.ts
    - scripts/src/lib/import-git.ts
    - scripts/src/lib/import-history.ts
    - scripts/src/lib/epic-index.ts
    - scripts/src/lib/migrate-task-layout.ts
    - scripts/src/lib/retention-migration.ts
    - test/scaffold.test.js
    - test/plan-inspect.test.js
    - test/current.test.js
    - test/validate-structural.test.js
    - test/validate-gates.test.js
    - test/plan-approve.test.js
    - test/cli-help.test.js
    - test/import-history.test.js
    - test/migrate-task-layout.test.js
    - test/retention-migration.test.js
    - test/validate-hints.test.js
  commit_intent:
    - slug epic 아래에서도 blueprint를 만들고 순서를 정할 수 있어야 번호 없는 식별자로 전환할 수 있음.
  commit_summary:
    - scaffold가 slug epic에서 order와 slug frontmatter를 쓰고 plan inspect가 최대 order 다음 값을 제안함.
    - 다음 blueprint 선택이 epic 안에서는 order, epic 사이에서는 등록부 배열 순서를 따르게 함.
  scope_revision: r1
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
slug epic 디렉터리 아래에서 scaffold·plan inspect·plan approve·validate·current가 새 형식 문서를 만들고 읽게 한다. blueprint 순서는 frontmatter `order`로 정하고 값 사이에 간격이 있어도 동작한다. 구형 `ddd-slug` epic에서는 지금 동작을 그대로 유지한다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- `scripts/src/lib/layout.ts:10-12` `EPIC_DIR`·`BLUEPRINT_DIR`가 `\d{3}-` 접두만 정본으로 인정한다.
- `scripts/src/lib/scaffold.ts`:
  - `requireNumericId`(:52-56)가 `blueprintId`를 세 자리로 강제한다(:406).
  - `epicIdFromDir`(:59-66)가 epic leaf에서 `^(\d{3})-`를 뽑고 없으면 throw한다(:420).
  - blueprint 디렉터리는 `${epicDir}/blueprints/${blueprintId}-${name}`이다(:430).
  - frontmatter에 `id`/`epic_id`/`blueprint_id`를 쓴다(:206, :325, :333, :353, :363, :446-447, :482-483, :541-542, :577-578). `order`는 쓰지 않는다.
  - area 검사용 `AREA_SLUG_RE`(:128)가 따로 있다.
- CLI `scripts/src/lib/cli-doc-commands.ts:79,149`가 `--id`를 `blueprintId`로 넘기고, :99·:163에서 세 자리가 아니면 exit 2다.
- `scripts/src/lib/plan-inspect.ts`:
  - `ID_DIR_RE`(:22)와 `nextNumericId`(:124-131)가 디렉터리 이름의 최대 번호 + 1을 `nextBlueprintId`로 낸다(:63, :296).
- `scripts/src/lib/plan-approve.ts:162`가 `/^(\d{3})-/`로 epic id를 뽑아 등록부와 대조한다(:163).
- `scripts/src/lib/validate-structural.ts:147-155`(S5)가 frontmatter `epic_id`/`blueprint_id`를 경로에서 뽑은 번호와 비교한다. :134·:141은 `isNumericContextId`로 검사한다.
- `scripts/src/lib/validate-gates.ts:1111-1117`이 등록부를 읽고 `epics\/(\d{3})-([^/]+)`로 blueprint의 epic을 찾는다.
- `scripts/src/lib/current.ts`:
  - pointer 키 파싱(:119-122, :154-157)과 `replaceKey`(:435)는 `^(\d{3})\/(\d{3})$`만 받는다.
  - `nextBlueprint`(:1095)는 같은 epic을 먼저 보고(:1140-1157), epic 안에서는 epic 본문 `## Blueprints` 목록 순서(`parseEpicBlueprintOrder` :958, :1130-1138)를 쓴다. 목록에 없는 것은 경로 `localeCompare`로, epic 사이는 epic 이름 `localeCompare`로 정렬한다.
  - `listReadyBlueprints`(:887, :951)와 pending sibling(:1086)도 경로 `localeCompare`를 쓴다.
  - 호출부: `finalize.ts:347`, `finalize-release-main.ts:567`, `cli-current-command.ts:406`.
- `scripts/src/lib/import-git.ts:11` `EPIC_ID_PREFIX_RE`와 `import-history.ts:167`이 history import에서 epic 번호를 다룬다.
- `scripts/src/lib/epic-index.ts:27-29`가 `.bouncer/context/index.md`의 epic 링크와 디렉터리 이름을 `\d{3}-`(및 더 오래된 `EPIC-\d{3}-`) 형식으로만 읽는다.
- 기존 이관 도구 `migrate-task-layout.ts:63`(`/blueprints\/\d{3}-[^/]+$/`)과 `retention-migration.ts:63-64`(`EPIC_DIR_NAME_RE`·`BLUEPRINT_DIR_NAME_RE`)가 번호 디렉터리 정규식을 직접 갖는다.
- 재현: `npm run build && node --test test/scaffold.test.js test/plan-inspect.test.js test/current.test.js`가 현재 통과한다.

## Target behavior
- 성공 (slug epic `.bouncer/context/epics/plan-workflow`):
  - `scaffold blueprint --epic-dir .bouncer/context/epics/plan-workflow --order 3 --name registry-gates`가 `blueprints/registry-gates/`를 만든다. frontmatter는 `id: registry-gates`, `epic_id: plan-workflow`, `blueprint_id: registry-gates`, `order: 3`이다. task·verification·review 문서도 같은 `epic_id`/`blueprint_id`를 쓴다.
  - `scaffold epic`과 `epic add-domain`은 등록부 버전으로 형식을 정한다. v2면 `epics/<slug>/`에 `id: <slug>`로 만들고 `--name`만 받는다. v1이면 지금처럼 `--id <ddd>`로 번호 디렉터리를 만든다.
  - `plan inspect --epic-dir <slug epic>`의 `epic.nextBlueprintOrder`는 blueprint `order`의 최대값 + 1이다(1·2·5 → 6, 없음 → 1). 구형 epic은 기존 `nextBlueprintId`를 계속 내고 `nextBlueprintOrder`도 같은 값의 정수로 낸다.
  - `nextBlueprint`와 pending sibling 목록:
    - 후보는 지금처럼 디렉터리 목록에서 얻는다. resolver 유효성으로 후보를 거르지 않는다.
    - slug epic 안: frontmatter `order` 오름차순, 같으면 경로 `localeCompare`.
    - 번호 epic 안: 지금 규칙(epic 본문 `## Blueprints` 목록 순서, 목록에 없으면 경로 `localeCompare`)을 그대로 쓴다.
    - epic 사이: 현재 blueprint의 epic이 slug이고 등록부가 있으면 `epics.json` 배열 위치로 정렬하고, 등록부에 없는 epic은 뒤로 보내 이름순으로 둔다. 그 밖에는 지금처럼 epic 이름 `localeCompare`다.
  - validate S5는 형식별로 비교한다. slug 경로에서는 frontmatter `epic_id`/`blueprint_id`가 경로 slug와 같아야 한다.
  - 새 S37은 slug 형식 blueprint를 검사한다. 대상은 `order` 존재, 양의 정수, epic 안 유일성, slug 규칙, 같은 epic 안 slug 유일성, epic·blueprint 세그먼트 형식 일치다. 승인 뒤 slug 불변은 gate가 판정하지 않는다(blueprint Contract, 답변 A).
  - `current --set` / `--replace`가 slug pointer 키(`plan-workflow/registry-gates`)를 받는다.
  - history import는 대상 epic 형식을 경로로 판정해 그 형식으로 쓴다.
  - epic 색인(`epic-index.ts`)은 slug epic 링크(`epics/<slug>/index.md`)도 읽고 쓴다. `EPIC-\d{3}-` 구형 접두 판정은 `context-ids.ts` 함수로 옮긴다.
  - `migrate-task-layout.ts`·`retention-migration.ts`는 번호 정규식 대신 `parseContextPath(...)?.format === 'numeric'` 판정을 쓴다. 대상 범위와 출력은 바뀌지 않는다.
- 실패:
  - slug epic에서 `--id`를 주면 exit 2와 `--order <n>`을 쓰라는 안내를 낸다.
  - 구형 epic에서 `--order`를 주면 exit 2와 `--id <ddd>`를 쓰라는 안내를 낸다.
  - `--order`가 0 이하이거나 정수가 아니거나 이미 쓰인 값이면 exit 2다.
  - `--name`이 `validateSlug`를 통과하지 못하면 exit 2다.
- 보존:
  - 구형 epic의 scaffold 출력, `nextBlueprintId`, S5, 기존 테스트 기대값은 그대로다.
  - 번호 epic의 `nextBlueprint`·sibling 순서와 `test/current.test.js`의 기존 fixture(`E-1`, `A-other` 같은 비정규 epic 이름) 결과는 바뀌지 않는다.

## Interface
- 제공 CLI: `bouncer scaffold blueprint --epic-dir <slug-epic> --order <n> --name <slug> [--attribution …] [--area …] [--scale …]`.
- 제공 CLI: `bouncer scaffold epic --name <slug> --description <text>`(v2 등록부). v1 등록부에서는 기존 `--id <ddd> --name <slug>`를 유지한다. `epic add-domain`도 같은 버전 규칙을 따른다.
- 제공 JSON: `plan inspect` 출력의 `epic.nextBlueprintOrder: number`.
- 제공 frontmatter: blueprint `bouncer.order: number`. 새 형식에서는 `bouncer.id`·`epic_id`·`blueprint_id`가 slug 문자열이다.
- 제공 코드: S37(`validate.ts` 코드 목록에 추가). 메시지에 위반 종류(`order-missing`, `order-invalid`, `order-duplicate`, `slug-invalid`, `slug-duplicate`, `format-mixed`)를 담는다.
- 거부(exit 2, 파일 미생성): 형식과 맞지 않는 `--id`/`--order`, 잘못된 `--order`, 잘못된 slug, v2 등록부에서 `scaffold epic --id`, v1 등록부에서 `--id` 없는 `scaffold epic`.
- 거부(plan gate 실패): S37 위반. 형식이 섞인 경로(epic은 slug인데 blueprint 디렉터리는 `ddd-` 접두, 또는 그 반대)는 S37 `format-mixed`다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/layout.ts` | `EPIC_DIR`, `BLUEPRINT_DIR`, `isCanonicalEpicDir` | Modify | 번호 디렉터리만 정본 | `parseContextPath` 기반 판정 | `layout.ts:10-12` |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint`, `requireNumericId`, `epicIdFromDir`, `AREA_SLUG_RE` | Modify | 번호 scaffold | 형식별 디렉터리·frontmatter·`order` | `scaffold.ts:52-66,389-430` |
| `scripts/src/lib/cli-doc-commands.ts` | scaffold 인자 처리 | Modify | `--id` 세 자리 검사 | `--order`·형식별 거절 | `cli-doc-commands.ts:79,99,149,163` |
| `scripts/src/lib/cli-usage.ts` | scaffold 사용법 | Modify | `--id <ddd>` 안내 | `--order <n>` 안내 추가 | `cli-help.test.js`가 사용법을 확인 |
| `scripts/src/lib/plan-inspect.ts` | `nextNumericId`, `ID_DIR_RE` | Modify | 번호 최대값+1 | `nextBlueprintOrder` 추가 | `plan-inspect.ts:22,124-131,296` |
| `scripts/src/lib/plan-approve.ts` | epic id 추출 | Modify | 번호로 등록부 대조 | resolver로 epic 키·slug 대조 | `plan-approve.ts:162-163` |
| `scripts/src/lib/validate-structural.ts` | S5, S37 신규 | Modify | 번호 id 일치 검사 | 형식별 S5, S37 | `validate-structural.ts:134-155` |
| `scripts/src/lib/validate.ts` | 코드 목록 | Modify | S1–S36 정의 | S37 정의 | `validate.ts:141-145` |
| `scripts/src/lib/validate-gates.ts` | 등록부 epic 대조 | Modify | `epics\/(\d{3})-` 정규식 | resolver로 epic 판정 | `validate-gates.ts:1111-1117` |
| `scripts/src/lib/current.ts` | `nextBlueprint`, `listReadyBlueprints`, `parseEpicBlueprintOrder`, pointer 키 파싱 | Modify | 번호 키·목록 순서 | slug 키, `order`·등록부 순서 | `current.ts:119-157,435,887-1157` |
| `scripts/src/lib/import-git.ts` | `EPIC_ID_PREFIX_RE` | Modify | 번호 epic 접두 파싱 | resolver 사용 | `import-git.ts:11` |
| `scripts/src/lib/import-history.ts` | epic id 검사 | Modify | 세 자리 epic 검사 | 형식별 검사 | `import-history.ts:167` |
| `scripts/src/lib/epic-index.ts` | `EPIC_LINK_RE`, `LEGACY_EPIC_LINK_RE`, `EPIC_DIR_NAME_RE`, `LEGACY_EPIC_DIR_NAME_RE` | Modify | 번호 epic 색인 파싱 | slug 링크 지원, 판정은 resolver | `epic-index.ts:27-29` |
| `scripts/src/lib/migrate-task-layout.ts` | blueprint 경로 판정 | Modify | 번호 정규식 | resolver 판정(동작 동일) | `migrate-task-layout.ts:63`, 정적 검사 대상 |
| `scripts/src/lib/retention-migration.ts` | `EPIC_DIR_NAME_RE`, `BLUEPRINT_DIR_NAME_RE` | Modify | 번호 정규식 | resolver 판정(동작 동일) | `retention-migration.ts:63-64`, 정적 검사 대상 |
| `test/migrate-task-layout.test.js` | — | Modify | 이관 테스트 | 기존 기대값 유지 확인(수정 없으면 Touch만) | 정규식 교체 회귀 |
| `test/retention-migration.test.js` | — | Modify | 이관 테스트 | 기존 기대값 유지 확인(수정 없으면 Touch만) | 정규식 교체 회귀 |
| `test/scaffold.test.js` | — | Modify | scaffold 테스트 | slug epic·`--order` 사례 | 계약 변경 |
| `test/plan-inspect.test.js` | — | Modify | inspect 테스트 | `nextBlueprintOrder`·간격 사례 | 수용 기준 5 |
| `test/current.test.js` | — | Modify | current 테스트 | order·등록부 순서·slug 키 사례 | 수용 기준 5 |
| `test/validate-structural.test.js` | — | Modify | 구조 검사 테스트 | S5 slug·S37·S13 slug epic 색인 사례 | 새 코드, `epic-index.ts` 변경 |
| `test/validate-gates.test.js` | — | Modify | gate 테스트 | slug epic 등록부 대조 사례 | `validate-gates.ts:1117` 변경 |
| `test/plan-approve.test.js` | — | Modify | approve 테스트 | slug epic 승인 사례 | `plan-approve.ts:162` 변경 |
| `test/cli-help.test.js` | — | Modify | 사용법 테스트 | `--order` 문구 | `cli-usage.ts` 변경 |
| `test/import-history.test.js` | — | Modify | import 테스트 | slug epic import 사례 | `import-history.ts` 변경 |

## Do not touch
- `scripts/src/lib/runtime-state.ts` — pointer 파일 경로·브랜치·worktree는 TASKS-003 소관이다.
- `scripts/src/lib/coordinator-commands.ts` — TASKS-003 소관이다.
- `scripts/src/lib/commit-sha.ts`, `scripts/src/lib/intent-provenance.ts`, `scripts/src/lib/finalize-digest.ts` — 추적은 TASKS-004 소관이다.
- `scripts/src/lib/context-ids.ts` — TASKS-001이 만든 계약을 소비만 한다.
- `.bouncer/context/epics/` — 이관하지 않는다.

## Constraints
- 형식은 경로로 판정한다. 경로가 없는 새 epic만 등록부 버전으로 판정한다. 플래그·환경 변수로 새 형식 쓰기를 켜지 않는다.
- 구형 epic의 관찰 가능한 출력과 기존 테스트 기대값은 바꾸지 않는다. `nextBlueprintOrder` 필드 추가만 허용한다.
- 숫자 정규식은 새로 쓰지 않고 `context-ids.ts` 함수만 쓴다. 단 `tasks/(\d{3})`·`TASKS-(\d{3})` task 번호 정규식은 그대로 둔다.
- `order`는 decision 5대로 닫힌 blueprint에서도 바꿀 수 있다. S37은 값 모양과 유일성만 본다.

## Checklist
- [ ] 각 테스트 파일에 slug 사례를 먼저 추가하고 `npm run build && node --test <파일>`로 실패를 확인한다. 기대 red 예시: `scaffold.test.js`의 slug 사례가 `Error: blueprintId must be a three-digit id`로 실패한다. `plan-inspect.test.js`의 간격 사례가 `nextBlueprintOrder === undefined`로 실패한다.
- [ ] `layout.ts`·`scaffold.ts`·`cli-doc-commands.ts`·`cli-usage.ts`를 고친다.
- [ ] `plan-inspect.ts`에 `nextBlueprintOrder`를 추가한다.
  ```js
  assert.equal(inspect(epicWithOrders([1, 2, 5])).epic.nextBlueprintOrder, 6);
  ```
- [ ] `plan-approve.ts`·`validate-structural.ts`·`validate.ts`(S37)·`validate-gates.ts`를 고친다.
- [ ] `current.ts`의 키 파싱과 `nextBlueprint` 정렬을 바꾼다. slug epic의 `order`(1·2·5)·등록부 배열 순서 사례를 추가하고, 번호 epic과 `E-1` 계열 기존 사례가 수정 없이 통과하는지 확인한다.
- [ ] `scaffold.test.js`에 `scaffold epic` v1(`--id` 유지)·v2(`--name`만, `epics/<slug>/`) 사례와 거절 사례를, `validate-structural.test.js`에 S37 `format-mixed` 사례를 추가한다.
- [ ] `import-git.ts`·`import-history.ts`·`epic-index.ts`를 resolver로 바꾼다.
- [ ] `migrate-task-layout.ts`·`retention-migration.ts`의 번호 정규식을 resolver 판정으로 바꾸고, 두 테스트가 기대값 수정 없이 통과하는지 확인한다.
- [ ] 구형 fixture의 기존 테스트 기대값을 수정하지 않았는지 `git diff test/`로 확인한다. 추가만 있어야 하고, `nextBlueprintOrder` 필드 추가는 예외다.
- [ ] `npm run build` 뒤 `node --test test/scaffold.test.js test/plan-inspect.test.js test/current.test.js test/validate-structural.test.js test/validate-gates.test.js test/cli-help.test.js test/plan-approve.test.js test/import-history.test.js test/migrate-task-layout.test.js test/retention-migration.test.js`가 통과한다.
