---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/114-consumer-epic-registry/blueprints/002-plan-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-20T14:54:56.497+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '114'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 24e60cf0d9989c5315bd7276c13494254b091e70
      range_to: d2bf41bbd7cf4e788c157bc6d81687204828b1a1
      diff_sha: f257da9fbf832d84a8b63d37947eb9b91138883721e31f8e04a37dc95581755c
      recorded_at: '2026-10-20T15:05:00+09:00'
  task_commits:
    - task: EPIC-114/BP-002/TASK-001
      sha: fe3097ef
      intent_anchor: task-001
    - task: EPIC-114/BP-002/TASK-002
      sha: d2bf41bb
      intent_anchor: task-002
---
# Explain

## Background

계획 작성 경로가 작업 목적마다 새 epic을 만들거나 공유 `maintenance` epic에 쌓는 방식이어서 epic 수가 늘고 귀속 기준이 흩어졌다. BP 001이 `.bouncer/epics.json` 등록부를 도입했으므로, 이번 변경은 계획 단계가 그 등록부를 읽고 등록부 epic에 blueprint를 붙이도록 기본 경로를 바꾼다. `plan inspect`는 귀속을 판단하지 않고 후보 사실만 내고, 귀속 판단은 `rules/planning.md`의 규칙을 따라 `/bouncer-plan`이 한다.

## Code

- `scripts/src/lib/plan-inspect.ts` — `summarizeRegistry`가 `readEpicRegistry`를 한 번 읽어 `registry`를 만든다.
  - `status: ok`이면 활성 epic 목록(common/domain, 디렉터리 유무, include/exclude), `legacy`, `areas`를 낸다. 비활성 epic은 제외한다.
  - `missing`이면 `bouncer init` 안내, `invalid`이면 `S35` 코드와 메시지를 낸다. 형식 위반이 inspect를 실패(`ok: false`)로 만들지는 않는다.
  - `nextEpicId`는 이제 디렉터리 최댓값+1이 아니라 "승인됐으나 디렉터리가 없는 활성 도메인 epic 중 가장 작은 id"이고, 없거나 등록부가 불량이면 `null`이다. `maintenanceEpic` 필드는 사라졌다.
  - 설계 선택: 디렉터리가 없는 legacy 항목은 `registry.legacy`에서 뺀다(계약상 `dir`가 문자열). blueprint id 제안은 계속 `nextNumericId`를 쓴다.
- `rules/planning.md` — `## Epic attribution` 절을 문서 끝에 추가했다. 일곱 규칙을 순서대로 적용하고 첫 일치에서 멈춘다. 도메인 기능 동작 중심이면 공통 계층 파일을 고쳐도 도메인 epic(없으면 `features` + `area`)에 귀속한다. 맞는 epic이 없으면 epic을 만들지 않고 사용자에게 보고한다. 줄 범위 색인 행이 바뀌지 않도록 끝에 붙였다.
- 경량 계획도 같은 귀속을 따르며 공유 `maintenance` epic 안내는 제거했다. `skills/bouncer-plan/SKILL.md`와 `skills/bouncer-finalize/SKILL.md`의 후속 작업 안내가 이 규칙을 가리키고, `CHANGELOG.md`와 `docs/architecture/rule-ownership.md`가 맞춰졌다.
- 검증은 `test/plan-inspect.test.js`가 맡는다. 도메인 epic이 둘 이상 대기할 때 가장 작은 id 선택과 `missing` 경로의 `bouncer init` 안내는 아직 assert하지 않는 후속 과제다.

## Quiz

1. `.bouncer/epics.json`의 형식이 잘못됐을 때 `plan inspect`는 어떻게 동작하는가?
   - A) `ok: false`로 실패하고 계획을 중단시킨다.
   - B) `registry.status: "invalid"`와 `S35` 안내를 내고 나머지 결과는 그대로 낸다.
   - C) 등록부가 없는 것(`missing`)과 같게 취급한다.
2. 새 `nextEpicId`는 어떤 값인가?
   - A) epics 디렉터리의 최대 번호 + 1.
   - B) 등록부에서 마지막 항목의 id + 1.
   - C) 승인됐으나 디렉터리가 없는 활성 도메인 epic 중 가장 작은 id(없으면 `null`).
3. 인수 조건이 한 도메인 기능의 동작을 중심으로 하는데 공통 계층 파일도 수정한다면 어디에 귀속하는가?
   - A) 그 도메인 epic(없으면 `features` + `area`).
   - B) `core`.
   - C) `foundation`.
4. 경량(light) 계획의 epic 귀속은 어떻게 바뀌었는가?
   - A) 계속 공유 `maintenance` epic에 쌓는다.
   - B) 등록부 epic 귀속 규칙을 따르고, 맞는 epic이 없으면 만들지 않고 보고한다.
   - C) 경량 계획마다 새 epic을 연다.

## Tasks

### EPIC-114/BP-002/TASK-001 · `fe3097ef`

#### Goal & intent

`bouncer plan inspect`가 `.bouncer/epics.json` 등록부를 읽어 활성 epic(포함·제외 규칙 포함), `area` 목록, `legacy` epic을 `registry`로 출력한다. `maintenanceEpic`은 사라지고, `nextEpicId`는 승인된 도메인 epic의 디렉터리가 아직 없을 때만 그 ID를 낸다. 검증 명령은 `node --test test/plan-inspect.test.js`다.

#### Current behavior

- 출력 타입 `InspectOk`(`scripts/src/lib/plan-inspect.ts:86-94`)는 `nextEpicId: string`, `maintenanceEpic`을 갖는다.
- `MAINTENANCE_DIR_RE = /^\d{3}-maintenance$/`(`:21`)로 `maintenanceEpic`을 `:488-489`에서 찾아 `:500`에서 낸다. `nextEpicId`는 `:498`에서 `nextNumericId(epicNames)`(`:108-116`, 최대 번호+1)다.
- epic 디렉터리는 `listDirNames(path.join(repoRoot, EPICS_REL))`(`:487`, `:125`)로 읽는다. 문서는 `frontmatter.ts` `readDoc`(`:11-12` import)으로 읽는다. inspect는 파일을 쓰지 않는다(`:430` docstring).
- CLI는 `cli-doc-commands.ts:224-276`에서 payload 모양과 무관하게 JSON을 출력한다. help는 `cli-usage.ts:15` "Print next ids, maintenance epic, …"이다.
- 소비처: `skills/bouncer-plan/SKILL.md:96`, `:106`, `:108`(TASKS-002 범위). `benchmarks/acp/responder.test.cjs:261`과 `benchmarks/acp/fixtures/acq/plan-id-light-en*.md:7`은 응답 텍스트 fixture라 payload를 읽지 않는다.
- 테스트: `test/plan-inspect.test.js`는 `makeRepo()`(`:37`), `writeDoc`(`:27`), `mkdirp`(`:33`)로 fixture를 만든다. `nextEpicId` `'004'` 기대(`:90`, `:160`, `:402`), `maintenanceEpic` `null` 기대(`:92`, `:404`), maintenance 테스트(`:166-185`)가 이 변경으로 바뀐다.

#### Target behavior

- 성공(등록부 `ok`): `registry = { status: 'ok', profile, epics, legacy, areas }`. `epics`는 `active: true`이고 `kind !== 'legacy'`인 항목을 등록부 순서로 담고, 공통 epic은 `COMMON_EPICS`의 `description`·`include`·`exclude`를, 도메인 epic은 `description: null`, `approval.reason`을 `include`로, `exclude`는 빈 문자열로 담는다. `dir`는 `.bouncer/context/epics/<id>-<slug>`가 있으면 그 경로, 없으면 `null`이다.
- 성공: `nextEpicId`는 `kind: 'domain'`, `active: true`이고 `dir === null`인 항목이 있으면 그 중 가장 작은 ID, 없으면 `null`이다.
- 성공(등록부 없음): `registry = { status: 'missing', next: 'Run `bouncer init` to create .bouncer/epics.json.' }`, `nextEpicId: null`.
- 성공(등록부 형식 위반): `ok: true`를 유지하고 `registry = { status: 'invalid', code: 'S35', message, next }`, `nextEpicId: null`.
- 보존: `epic`, `verifySignals`, `current`, `routing` 필드와 `--epic-dir`·`--blueprint` 동작은 그대로다. `maintenanceEpic` 키는 출력에서 사라진다.

#### Interface

- 제공: blueprint Contract의 `InspectRegistry`와 `nextEpicId: string | null`. 비활성 공통 epic은 `epics`와 `legacy` 어디에도 나오지 않는다.
- 거부: inspect는 귀속을 판단하지 않는다. 요청 텍스트·경로 입력을 받지 않으며 후보 순위를 매기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-inspect.ts` | `planInspect`, `InspectOk`, `MAINTENANCE_DIR_RE` | Modify | id 제안·maintenance epic·routing | `registry` 추가, `maintenanceEpic` 삭제, `nextEpicId` 규칙 변경 | REQ-03·04·09 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.plan` | Modify | inspect help(`:15`) | "maintenance epic" 문구를 registry 후보로 교체 | help 일치 |
| `test/plan-inspect.test.js` | 기존·신규 테스트 | Modify | inspect 테스트 | `:90`, `:92`, `:160`, `:166-185`, `:402`, `:404` 기대 갱신, registry 케이스 추가 | 수용 기준 |

#### Constraints

- inspect는 계속 읽기 전용이다. 등록부 읽기는 `readEpicRegistry` 한 번이다.
- 등록부 형식 위반이 inspect 자체를 실패(`ok: false`)로 만들지 않는다.
- `area` 승격 제안(`promotions`)은 BP003 범위이므로 이 task는 넣지 않는다.

### EPIC-114/BP-002/TASK-002 · `d2bf41bb`

#### Goal & intent

`skills/bouncer-plan/SKILL.md`와 `rules/planning.md`가 등록부 epic에 blueprint를 추가하는 경로를 기본으로 안내한다. 귀속 규칙(요구사항 1~7 순서)을 `rules/planning.md`에 두고, 경량 선언도 같은 규칙을 따른다. 공유 `maintenance` epic과 epic 잠금 문구는 지운다. 검증 명령은 `node --test test/skill-bouncer-surface.test.js test/skill-bouncer-plan.test.js test/acq-gate-ids.test.js test/rule-ownership.test.js`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:11`은 "create a new epic, or add a blueprint to an existing epic"이다.
- Step 2(`:95-99`)는 `nextEpicId`에서 epic ID를 추천한다. `:101-111` light 경로는 `maintenanceEpic`을 쓰고 없으면 만들며 "a locked epic (after epic 022) takes no more blueprints"라고 쓴다. `:113-119`는 `scaffold epic`을 항상 실행하는 명령 예시다.
- `rules/planning.md:81-84` light 규칙 3 "Epic allocation"이 공유 maintenance epic을 지시한다.
- `skills/bouncer-finalize/SKILL.md:97`은 후속 작업을 "a sibling Blueprint in the same Epic or a new Epic"으로 안내한다.
- 문서 모양 계약: `docs/architecture/rule-ownership.md:38` 행 `GOV-LIGHT-MAINTENANCE-EPIC`이 `rules/planning.md` `## Lightweight cycle`의 locator `maintenance epic`을 고정하고, `test/rule-ownership.test.js:298-330`은 locator가 선언한 owner 절에 있어야, `:415-446`은 다른 `.md` owner에 없어야 통과한다. `scripts/check-doc-shape.js:827`은 `rules/planning.md`의 `Lightweight cycle` 제목을, `:857-870`은 bouncer-plan의 단계 1~8 순서, ACQ 위치(1, 2, 3, 4, 6단계), `evidence-dispatch.md`·`scope-confirm.md` 링크를 요구한다. `test/skill-bouncer-surface.test.js:124-130`은 단계 수(bouncer-plan 8, bouncer-finalize 5)를 고정한다. `test/acq-gate-ids.test.js:24-40`은 ACQ 색인과 `rules/acq-gates.json`이 같아야 한다고 본다. maintenance·022 문구를 고정하는 테스트는 없다.

#### Target behavior

- 성공: SKILL.md 도입문과 Step 2는 다음 순서를 지시한다. inspect `registry.status`가 `missing`이면 멈추고 `bouncer init`을 안내한다. `invalid`이면 멈추고 `code`·`message`·`next`를 보여 준다. `ok`이면 `registry.epics`의 포함·제외 규칙과 `rules/planning.md` 귀속 규칙으로 epic 하나를 고르고, 근거를 Discover 확인에 보여 준다. `features`이면 `registry.areas`에서 `area`를 고른다. 맞는 epic이 없으면 새 epic을 만들지 않고 사용자에게 보고한다. 맞는 `area`가 없으면 새 `area` 등록을 제안만 한다.
- 성공: `scaffold epic`은 두 경우에만 실행한다. (1) 고른 등록부 epic의 `dir`가 `null`이면 `--id <id> --name <slug> --description <description>`(공통 epic) 또는 discovery에서 확정한 ASCII 문장(도메인 epic)으로 만든다. (2) inspect `nextEpicId`가 있으면(승인된 미생성 도메인 epic) 그 ID로 만든다. 그 뒤 `plan inspect --epic-dir <dir>`의 `nextBlueprintId`를 쓴다.
- 성공: 경량 선언은 같은 귀속으로 대상 epic을 정한다. `maintenance`, `maintenanceEpic`, `locked epic`, `022` 문구가 SKILL.md와 `rules/planning.md`에 남지 않는다.
- 성공: `rules/planning.md`에 `## Epic attribution` 절을 두고 다음 규칙을 영어로 옮겨 쓴다. light 규칙 3은 이 절을 가리킨다.
  1. 수용 기준의 중심이 특정 도메인 기능의 동작이면 그 도메인 epic이 있으면 그곳, 없으면 `features` + `area`다. 공통 계층 파일을 수정해도 같다.
  2. 인증·인가·계정 체계 자체를 바꾸면 `identity-access`다.
  3. 사용자 접점의 공통 골격·디자인 시스템·다국어·접근성을 바꾸면 `interface`다.
  4. 둘 이상의 기능이 공유하는 데이터 기반이면 `data`, 외부 경계면 `integration`, 공통 모듈·아키텍처 경계면 `core`다.
  5. 제품 동작은 같고 빌드·배포·환경만 바꾸면 `foundation`이다.
  6. 테스트·관측·운영 도구 자체를 바꾸면 `quality-ops`다.
  7. 어디에도 해당하지 않으면 새 epic을 만들지 않고 사용자에게 보고한다.
  - 여러 epic을 건드리면 수용 기준의 중심인 epic 하나를 주 epic으로 정한다. 보안·성능·버그 수정·리팩터링은 대상 기능을 기준으로 귀속한다. 비활성 epic과 `legacy` epic은 후보가 아니다.
- 성공: `skills/bouncer-finalize/SKILL.md:97`은 후속 작업을 "같은 epic의 sibling blueprint 또는 귀속 규칙이 정한 등록부 epic"으로 안내한다.
- 성공: `docs/architecture/rule-ownership.md`의 해당 행은 id `GOV-LIGHT-EPIC-ATTRIBUTION`, source `` `## Lightweight cycle` / `registry epic by attribution` ``으로 바뀌고, 그 locator 문구는 `rules/planning.md` light 규칙 3에만 있다.
- 보존: 단계 수 8, ACQ 색인과 위치, `Lightweight cycle` 제목, 기존 링크는 그대로다. 새 ACQ gate를 추가하지 않는다.

#### Interface

- 제공: `rules/planning.md` `## Epic attribution` 절(규칙 1~7). SKILL.md가 inspect `registry`·`nextEpicId`를 읽는 방법.
- 거부: 스킬이 등록부에 없는 epic을 만들거나 고르는 경로, `maintenance` epic을 경량 기본값으로 쓰는 경로.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | 도입문, Step 2 | Modify | epic 생성·maintenance light 경로 안내 | 등록부 epic 선택·귀속 근거·init 안내로 교체 | REQ-03·09 |
| `rules/planning.md` | `Lightweight cycle` 규칙 3, 신규 `Epic attribution` | Modify | maintenance epic 배정 규칙 | 귀속 규칙 절 추가, 규칙 3 교체 | REQ-08·09 |
| `skills/bouncer-finalize/SKILL.md` | 후속 작업 안내(`:97`) | Modify | 새 epic 계획 허용 문구 | 등록부 epic 안내로 교체 | REQ-03 |
| `docs/architecture/rule-ownership.md` | `GOV-LIGHT-MAINTENANCE-EPIC` 행 | Modify | 규칙 소유권 색인 | 행 id·locator를 귀속 규칙으로 교체 | `test/rule-ownership.test.js` locator 계약 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | BP002 Changed 항목 | 프로젝트 규칙 |

#### Constraints

- `scripts/check-doc-shape.js:857-870`과 `test/skill-bouncer-surface.test.js:124-130` 계약을 지킨다.
- 스킬 본문은 영어, `rules/planning.md` 본문도 기존 언어(영어)를 따른다.
- 이 저장소도 BP001 뒤 `domain-only` 등록부를 가지므로, 활성 epic이 없을 때 "맞는 epic이 없으면 보고" 경로가 그대로 적용됨을 문서가 막지 않아야 한다.

### EPIC-114/BP-002/TASK-003

#### Goal & intent

BP002의 두 commit task(inspect 출력, 스킬·규칙 문서)가 통합된 상태에서 `npm run ci`가 통과함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.