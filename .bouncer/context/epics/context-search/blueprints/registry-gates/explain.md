---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/context-search/blueprints/registry-gates/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-20T15:37:03.169+09:00'
bouncer:
  id: EXPLAIN-registry-gates
  epic_id: context-search
  blueprint_id: registry-gates
  status: published
  comprehension:
    - range_from: 921f6f92dd10ea519c7723aa7ca01fb3de19b4cd
      range_to: 66d0b6f5ca258fb30d4508753e58e7dc254b0fda
      diff_sha: c8debb9646584e2e311ce4de84e580e12ded3946b6b61fb254be42d2963894be
      recorded_at: '2026-10-20T15:45:00+09:00'
  task_commits:
    - task: context-search/registry-gates/001
      sha: 0ebeb948
      intent_anchor: task-001
    - task: context-search/registry-gates/002
      sha: 0a5f046e
      intent_anchor: task-002
    - task: context-search/registry-gates/003
      sha: 4327500e
      intent_anchor: task-003
    - task: context-search/registry-gates/004
      sha: 66d0b6f5
      intent_anchor: task-004
---
# Explain

## Background

epic 등록부(`epic-registry`)는 BP-001/002에서 생겼지만 plan gate가 읽지 않아, 미등록 epic이나 `legacy` epic에 새 blueprint를 만들어도, `features` blueprint에 `area`가 없어도 그대로 승인됐다. 이 변경은 등록부 위반을 plan gate의 고유 코드로 막고, 도메인 epic과 `area`는 사용자가 `--yes`로 승인한 명령으로만 등록부에 들어가게 한다.

## Code

- `scripts/src/lib/validate-gates.ts` — `checkRegistryGates`가 plan gate에서 G26~G31을 낸다. 등록부 없음 G26, 미등록 epic G27, 비활성 epic G28, `legacy` epic의 새 draft G29, `area` 규칙 위반 G30, `attribution` 누락 G31. 공통 epic 판정은 숫자 ID가 아니라 slug `features`로만 한다. `repoRoot`가 없는 호출은 이전 결과를 유지한다. 이미 승인된 `legacy` blueprint는 `attribution`·`area` 없이 통과한다.
- `scripts/src/lib/scaffold.ts`, `cli-doc-commands.ts`, `validate-structural.ts` — blueprint에 `area`·`attribution` 선택 키를 추가한다. scaffold 플래그가 잘못되면 exit 2로 거절하고 구조 검사 S36이 형식을 확인한다. slug 정규식이 `scaffold.ts`와 `validate-structural.ts`에 따로 있어, 규칙이 바뀌면 두 곳을 같이 고쳐야 한다.
- `scripts/src/lib/cli-epic-command.ts`, `epic-registry.ts` — `bouncer epic add-domain|add-area`. `--yes`가 없으면 등록부를 읽기 전에 거절한다. 검증 순서는 reason-missing, name-invalid, name-taken, domain-limit이고 모두 통과한 뒤 한 번만 쓴다. id는 등록부 id와 epics 디렉터리 번호 중 큰 값에 1을 더한다. 한계로, 등록부를 `writeFileSync`로 직접 써서 원자적이지 않고, 같은 `add-domain`을 반복하면 domain-limit이 아니라 name-taken이 나온다(후속 작업으로 남김).
- `scripts/src/lib/plan-inspect.ts` — `area` 승격 제안과 도메인 수를 읽기 전용으로 집계한다. 도메인 수는 비활성 항목도 센다.

## Quiz

1. `features` epic이 아닌 도메인 epic의 blueprint에 `area`를 적으면 plan gate는 어떻게 되는가?
   - A) 무시하고 통과한다.
   - B) G30으로 막는다.
   - C) G31로 막는다.
2. 이미 `approved`인 `legacy` epic의 blueprint에 `attribution`이 없으면?
   - A) G29와 G31이 모두 난다.
   - B) G29만 난다.
   - C) 통과한다.
3. `bouncer epic add-domain --slug x --reason y`를 `--yes` 없이 실행하면?
   - A) 등록부에 추가하고 경고를 낸다.
   - B) 등록부를 읽기 전에 confirmation-required로 거절하고 파일은 바뀌지 않는다.
   - C) 등록부를 읽어 검증한 뒤 마지막에 묻는다.
4. 이미 등록된 도메인 slug로 `add-domain --yes`를 한 번 더 실행하면 현재 어떤 거절 사유가 나오는가?
   - A) epic-registry-name-taken
   - B) epic-registry-domain-limit
   - C) epic-registry-invalid

## Tasks

### context-search/registry-gates/001 · `0ebeb948`

#### Goal & intent

blueprint `index.md` frontmatter에 선택 키 `bouncer.area`, `bouncer.attribution`을 두고, `bouncer scaffold blueprint --area <a> --attribution <text>`가 두 값을 쓴다. 키가 있는데 빈 문자열이거나 문자열이 아니면 S36으로 실패한다. gate의 필수 판정은 TASKS-002가 한다. 검증 명령은 `node --test test/validate-structural.test.js test/scaffold.test.js test/rule-ownership.test.js`다.

#### Current behavior

- blueprint frontmatter는 `scaffold.ts:415-434` 리터럴(`id, epic_id, blueprint_id, status, commit_type, scale, review_scope, verification_policy, supersedes`)로 생긴다. 모르는 `bouncer.*` 키를 거절하는 검사는 없다.
- 구조 검사는 `validate-structural.ts:185-191` S20(scale enum), `:193-201` S31(review_scope)처럼 `docType === 'bouncer.blueprint'`에서 "부재 통과, 잘못된 값만 거절"을 따른다.
- CLI `scaffold blueprint`는 `cli-doc-commands.ts:124-137`에서 `--scale`을 검증한 뒤 `scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp, scale })`를 부른다. 값 없는 플래그는 `parseFlags`가 `true`를 준다.
- 스키마 문서 `rules/document-schema.md:55-66`이 blueprint 키를 산문으로 설명한다.
- 테스트: `test/validate-structural.test.js`는 `writeBundleIndex`(`:54`)·`writeDoc`(`:21`), `test/scaffold.test.js`는 테스트별 mkdtemp(`:27`)를 쓴다.

#### Target behavior

- 성공: `scaffold blueprint --area ordering --attribution "주문 기능 동작이 중심"` → frontmatter에 `area: ordering`, `attribution: 주문 기능 동작이 중심`이 `supersedes` 앞에 생긴다. 생략하면 두 키가 없다(지금과 같은 frontmatter).
- 실패: `--area`가 slug 형식(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)이 아니거나 값 없이 오면, `--attribution`이 값 없이 오거나 공백뿐이면 파일을 쓰기 전에 exit 2.
- 실패: blueprint frontmatter의 `area`가 문자열이 아니거나 slug 형식이 아니면, `attribution`이 문자열이 아니거나 trim 후 빈 문자열이면 S36.
- 보존: 두 키가 없는 기존 blueprint는 구조 검사를 통과한다. 등록부 대조(`area`가 등록부에 있는지)는 하지 않는다.

#### Interface

- 제공: `scaffoldBlueprint` 입력 `{ area?: string; attribution?: string }`. 구조 코드 S36. `rules/document-schema.md`의 두 키 설명.
- 거부: 위 실패 항목. `attribution`은 한 줄 문자열이며 줄바꿈이 있으면 S36이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint` | Modify | blueprint frontmatter 리터럴(`:415-434`) | 선택 키 `area`, `attribution` 추가 | REQ-07 기록 위치 |
| `scripts/src/lib/cli-doc-commands.ts` | scaffold blueprint 인자 처리 | Modify | `--scale` 검증(`:124-137`) | `--area`, `--attribution` 검증·전달 | CLI 표면 |
| `scripts/src/lib/validate-structural.ts` | `checkStructural` | Modify | S20·S31 blueprint 검사 | S36 추가 | 필드 모양 검사 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` | Modify | `next` 안내 | S36 hint 추가 | 실패 안내 |
| `rules/document-schema.md` | blueprint 키 설명 | Modify | 키 산문 설명(`:55-66`) | `area`, `attribution` 설명 | 스키마 문서 |
| `test/validate-structural.test.js` | 신규 테스트 | Modify | 구조 검사 테스트 | S36 케이스 | 수용 기준 |
| `test/scaffold.test.js` | 신규 테스트 | Modify | scaffold 테스트 | 플래그 성공·거절 케이스 | 수용 기준 |

#### Constraints

- 두 키가 없는 기존 문서의 구조 검사 결과는 바뀌지 않는다.
- `cli-usage.ts`와 `rules/cli.md`의 scaffold 사용법 갱신은 같은 파일을 고치는 TASKS-003이 맡는다. 이 task는 두 파일을 건드리지 않는다.

### context-search/registry-gates/002 · `0a5f046e`

#### Goal & intent

`bouncer validate --gate plan`(그리고 같은 gate를 쓰는 `bouncer current --set`)이 등록부 위반을 G26~G31로 실패시킨다. 공통 epic은 slug로 판정한다. 기존 plan gate 테스트 fixture 9개 파일은 공용 헬퍼로 등록부를 갖게 한다. 검증 명령은 frontmatter `verify`의 9개 파일 `node --test`다.

#### Current behavior

- plan 분기는 `scripts/src/lib/validate-gates.ts:1108`에서 시작한다. G1(`:1109`), G2(`:1113-1128`) 다음 `planScaleOf`(`:1129`), G22(`:1134-1143`)가 온다. G22는 `typeof repoRoot === 'string' && typeof blueprintDir === 'string'`일 때만 디스크를 본다. 실패는 `add(code, message, fileKey)`(`:1096-1097`)로 `{ code, message, file: rels[fileKey] }`를 쌓는다. frontmatter는 `asData(doc).bouncer`(`:1164-1167`)로 읽는다.
- `next`는 `validate.ts:50-113` `GATE_FAILURE_HINTS`에서 붙는다.
- plan gate를 실제로 부르는 경로: `bouncer validate --gate plan`(`cli-doc-commands.ts:26`), `bouncer current --set`(`cli-current-command.ts:279-283`). `review-dispatch plan`은 `planDraft`(`validate.ts:425`)라 이 분기를 지나지 않는다. `plan approve`와 finalize gate는 plan gate를 부르지 않는다.
- 사용 코드: G1–G3, G5–G8, G10–G14, G16–G25. 다음 빈 코드는 G26이다.
- 디스크 fixture로 plan gate를 실행하는 테스트 9개: `test/validate-gates.test.js`(`writePlanBlueprint` `:1856`, `writePlanBlueprintWithPaths` `:1900`, `writeOkfIndex` `:2039`; ctx 없는 `checkGate('plan', …)` 호출은 영향 없음), `test/cli-validate.test.js`(`writeDoc` `:13`, `:618`, `:972`), `test/cli-current.test.js`(`writePlanPassingBlueprint` `:105`, `writeOtherPlanPassingBlueprint` `:154`, `--set` 29회), `test/scaffold.test.js`(`:873`, `:985-1025`), `test/intent-fence-guard.test.js`(`writeMinimalBlueprint` `:63`), `test/validate-hints.test.js`(`:144`), `test/review-dispatch.test.js`(`writePlanTree` `:201`, `:1524`), `test/import-history.test.js`(`makeExec` `:39`, `:534`), `test/validate-structural.test.js`(`:365`). `current --set`을 부르는 다른 테스트 파일은 없다(`rg "'--set'" test` 결과 `cli-current.test.js`뿐). `test/fixtures/`에 정적 epic 트리는 없다.

#### Target behavior

- 검사는 `repoRoot`가 문자열일 때만 G2 직후에 한다(ctx 없는 단위 호출은 지금과 같다). 순서와 코드:
  1. 등록부 `missing` → G26 `epic registry missing: .bouncer/epics.json`. `next`: `Run \`bouncer init\` to register existing epics as legacy, then plan under a registry epic.` 이후 등록부 검사는 하지 않는다.
  2. 등록부 `invalid` → G 코드를 추가하지 않는다(S35가 이미 실패시킨다).
  3. blueprint의 epic 디렉터리 `<id>-<slug>`에 대해 등록부에 같은 `id`가 없거나 그 항목의 `slug`가 다르면 → G27. G27이면 4~7은 하지 않는다.
  4. 그 항목이 `active: false` → G28.
  5. `kind: 'legacy'`이고 blueprint 상태가 `draft` → G29. `legacy`이면 6·7은 하지 않는다.
  6. `kind !== 'legacy'`인 epic의 blueprint에 `attribution`이 없으면 → G31.
  7. epic `slug === 'features'`이고 `area`가 없거나 `registry.areas`에 없으면 → G30. `features`가 아닌 epic의 blueprint에 `area`가 있으면 → G30.
- 성공: 같은 `features` epic이 `007-features`든 `031-features`든 같은 판정이다.
- 각 코드는 `GATE_FAILURE_HINTS`에 `next`를 갖는다.
- 보존: `legacy` epic의 이미 승인된 blueprint는 attribution·area 없이 통과한다(이 저장소에서 BP001 실행 전 승인된 epic 114 BP002·003 포함).
- 격리: 등록부는 gate에 넘긴 `repoRoot`에서만 읽는다. 플러그인 저장소의 `.bouncer/epics.json` 내용은 임시 repo fixture 결과에 영향을 주지 않는다. finalize·execute gate는 바뀌지 않는다.

#### Interface

- 제공: plan gate 실패 코드 G26, G27, G28, G29, G30, G31과 각 `next`.
- 거부: 위 Target behavior 목록. 용어: "등록부 epic 항목" = `epics[]`에서 `id`가 blueprint 경로 `.bouncer/context/epics/<id>-<slug>/`의 `<id>`와 같은 항목. 예: 경로 `031-features` ↔ 항목 `{ slug: 'features', id: '031', kind: 'common', active: true }`.
- 테스트 헬퍼 확장: `test/helpers/epic-registry.js`에 `registerFixtureEpic(repoRoot, epicDirName, kind = 'domain') → void`를 추가한다. 등록부가 없으면 `domain-only` 등록부(`domainEpicLimit: 99`)를 만들고 해당 epic을 `active: true`, `approval: { reason: 'fixture', approvedAt: '2026-01-01T00:00:00.000Z' }`로 추가한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `runCheckGate` plan 분기 | Modify | G1·G2·G22 등 plan 검사 | G2 직후 등록부 검사 G26–G31 | REQ-06·07·12 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` | Modify | `next` 안내 | G26–G31 hint | 실패 안내 |
| `test/helpers/epic-registry.js` | `registerFixtureEpic` | Modify | `standard` 등록부 작성 | fixture epic 등록 함수 추가 | REQ-16 |
| `test/validate-gates.test.js` | `writePlanBlueprint`, 신규 테스트 | Modify | plan gate 테스트 | fixture 등록·G26–G31 케이스 | 수용 기준 |
| `test/cli-validate.test.js` | fixture | Modify | CLI validate 테스트 | 등록부·attribution 추가 | blast radius |
| `test/cli-current.test.js` | `writePlanPassingBlueprint`, `writeOtherPlanPassingBlueprint` | Modify | `--set` 테스트 | 등록부·attribution 추가 | blast radius |
| `test/scaffold.test.js` | plan gate 호출 fixture | Modify | scaffold 테스트 | 등록부·attribution 추가 | blast radius |
| `test/intent-fence-guard.test.js` | `writeMinimalBlueprint` | Modify | fence guard 테스트 | 등록부·attribution 추가 | blast radius |
| `test/validate-hints.test.js` | fixture | Modify | hint 테스트 | 등록부·attribution 추가, G26 `next` 케이스 | blast radius |
| `test/review-dispatch.test.js` | `writePlanTree` | Modify | dispatch 테스트 | 등록부·attribution 추가 | blast radius |
| `test/import-history.test.js` | `makeExec` | Modify | import 테스트 | 등록부·attribution 추가 | blast radius |
| `test/validate-structural.test.js` | gate 순회 fixture | Modify | 구조 검사 테스트 | 등록부·attribution 추가 | blast radius |

#### Constraints

- ctx(`repoRoot`) 없는 `checkGate('plan', …)` 결과는 바뀌지 않는다.
- 공통 epic 판정은 slug로만 한다. 숫자 ID 상수를 쓰지 않는다.
- fixture 수정은 등록부 등록과 `attribution` 추가만 한다. 기존 assertion 의미를 바꾸지 않는다.
- 등록부는 gate 실행당 한 번 읽는다.

### context-search/registry-gates/003 · `4327500e`

#### Goal & intent

`bouncer epic add-domain --slug <s> --reason <text> --yes`와 `bouncer epic add-area --name <a> --yes`가 등록부에 도메인 epic과 `area`를 추가한다. `--yes`가 사용자 명시 승인이며, 없으면 파일을 읽기 전에 거절한다. 검증 명령은 `node --test test/epic-command.test.js test/cli-help.test.js test/test-tiers.test.js test/rule-ownership.test.js`다.

#### Current behavior

- CLI 라우팅은 `scripts/src/lib/cli.ts:21-50` `COMMANDS`(`{ usage: COMMAND_USAGE[x], load: () => require(...).run }`)이며 `epic` 항목이 없다. 알 수 없는 명령은 exit 2(`cli.ts:64-75`).
- 승인 플래그 선례 `review accept-risk`: 인자 파싱 `cli-review-command.ts:224-246`(중복·누락·금지 플래그 exit 2, `--yes` 누락은 사용법 오류가 아님 `:217-219`), 실행 `:262-276`(`--help` 우선, 모듈 지연 require, JSON 출력, `ok ? 0 : 1`), 승인 확인 `review-record.ts:481-488`(`input.yes !== true`면 파일 접근 전 `fail('review-accept-risk-confirmation-required', cause, next)`).
- 출력 모양 `{ ok: false, reason, cause, next }`(`rules/cli.md:417-426`).
- usage는 `cli-usage.ts:6-36` `COMMAND_USAGE`(순서가 help 순서), `:72` `USAGE`.
- 테스트: `test/cli-help.test.js:9-33` `SUBCOMMANDS` 배열과 `:66-77` usage 줄 시작 검사, `:214-231` 사용법 오류 exit 2 템플릿. `test/test-tiers.test.js:38`이 새 테스트 파일의 `tiers.json` 등록을 요구한다.
- 등록부 모듈(BP001)에 쓰기 함수가 없다.

#### Target behavior

- 성공(`add-domain`): 등록부에 `{ slug, id, kind: 'domain', active: true, approval: { reason, approvedAt } }`를 추가하고 `{ ok: true, path: '.bouncer/epics.json', epic: { slug, id } }`를 출력한다. `id`는 등록부 ID와 `.bouncer/context/epics/` 디렉터리 번호 중 최대값+1의 3자리 문자열이다. `approvedAt`은 `--timestamp`가 있으면 그 값, 없으면 현재 시각(KST ISO)이다.
- 성공(`add-area`): `areas`에 이름을 추가하고 `{ ok: true, path, area }`를 출력한다.
- 실패(exit 1, 파일 무변경): reason
  - `epic-registry-confirmation-required` — `--yes` 없음, 파일 읽기 전.
  - `epic-registry-missing` / `epic-registry-invalid` — 등록부 없음·형식 위반.
  - `epic-registry-domain-limit` — 기존 `kind: 'domain'` 수가 `domainEpicLimit` 이상.
  - `epic-registry-name-invalid` — slug 형식 위반, 공통 epic slug(`COMMON_EPICS`), 목적형 이름(`PURPOSE_NAMES`).
  - `epic-registry-name-taken` — 이미 있는 epic slug 또는 `area`.
  - `epic-registry-reason-missing` — `--reason`이 공백뿐.
- 실패(exit 2): 알 수 없는 하위 명령, 필수 플래그 누락·중복, 알 수 없는 플래그.
- 보존: 등록부의 다른 항목과 키 순서는 바뀌지 않는다.

#### Interface

- 제공: CLI 두 명령과 위 reason. `epic-registry.ts`에 `addDomainEpic(registry, input, existingEpicDirs) → { ok: true; registry; epic } | { ok: false; reason; cause }`, `addArea(registry, name) → …`, `writeEpicRegistry(repoRoot, registry)`(2칸 들여쓰기, 끝 개행).
- 거부: 위 실패 목록. 이 명령은 디렉터리를 만들지 않는다(scaffold는 다음 `/bouncer-plan`이 inspect `nextEpicId`로 한다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/epic-registry.ts` | `addDomainEpic`, `addArea`, `writeEpicRegistry` | Modify | 등록부 읽기·검사 | 순수 추가 함수와 writer | REQ-05 |
| `scripts/src/lib/cli-epic-command.ts` | `run` | Create | 없음 | `epic add-domain`/`add-area` 인자 파싱·실행 | CLI 표면 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | 명령 라우팅 | `epic` 항목 추가 | 라우팅 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.epic`, `COMMAND_USAGE.scaffold` | Modify | usage 문자열 | `epic` usage 추가, scaffold blueprint에 `[--area <a>] [--attribution <text>]` 표기 | help, TASKS-001 플래그 문서화 |
| `rules/cli.md` | 신규 `epic` 절, `scaffold blueprint` 사용법 | Modify | CLI 계약 문서 | 두 명령·reason 문서, scaffold 새 플래그 | 공개 계약 |
| `test/epic-command.test.js` | 신규 테스트 | Create | 없음 | 성공·거절 케이스 | 수용 기준 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | help 테스트 | `'epic'` 추가 | `:9-33` |
| `test/tiers.json` | `unit` 목록 | Modify | 테스트 계층 정본 | `epic-command.test.js` 추가 | `test/test-tiers.test.js:38` |

#### Constraints

- `--yes` 확인은 등록부 읽기 전에 한다(`review-record.ts:481-488` 선례).
- 테스트는 `run(argv, io)`를 프로세스 안에서 호출해 spawn 없이 `unit` 계층에 둔다.
- 쓰기는 검증을 모두 통과한 뒤 한 번만 한다.

### context-search/registry-gates/004 · `66d0b6f5`

#### Goal & intent

`bouncer plan inspect`가 `registry.promotions`로 승격 후보 `area`를 낸다. `skills/bouncer-plan/SKILL.md`는 scaffold 때 `--attribution`(모든 비-legacy epic)과 `--area`(`features`)를 쓰게 하고, 새 `area`·도메인 epic은 사용자 명시 승인 뒤 `bouncer epic add-area|add-domain --yes`로만 추가하게 한다. 검증 명령은 `node --test test/plan-inspect.test.js test/skill-bouncer-surface.test.js test/acq-gate-ids.test.js test/rule-ownership.test.js`다.

#### Current behavior

- BP002 이후 `planInspect`(`scripts/src/lib/plan-inspect.ts:436-505`)는 `registry`를 내지만 승격 제안은 없다.
- inspect는 epic의 blueprint 디렉터리를 `epicInfo`(`:161-168`)에서 번호 계산용으로만 읽고 frontmatter는 읽지 않는다. 문서 읽기 패턴은 `readStatus`(`:147`), `loadRoutingTasks`(`:394-425`)의 `readDoc` + 객체 가드 + try/catch다. epic별 blueprint frontmatter 목록 헬퍼는 없다.
- SKILL.md Step 2(`:113-119`)의 `scaffold blueprint` 예시는 `--area`·`--attribution`을 쓰지 않는다. 승인 명령 안내도 없다.
- ACQ 색인은 `rules/acq-gates.json`과 `test/acq-gate-ids.test.js:24-40`이 고정한다. 새 gate를 추가하면 benchmark 정책 5개도 바뀌어야 한다(`test/acq-gate-ids.test.js:107-113`).

#### Target behavior

- 성공: 등록부 `ok`, `areaPromotionThreshold`가 있고, `kind: 'domain'` 수 < `domainEpicLimit`이면, 활성 `features` epic 디렉터리의 blueprint 중 `bouncer.area`별 개수가 threshold 이상인 항목을 `registry.promotions = [{ area, count }]`(area 이름순)로 낸다.
- 성공: threshold 없음, 기준 미만, 상한 소진, `features` 비활성·디렉터리 없음이면 `promotions: []`.
- 성공: SKILL.md Step 2 scaffold 예시가 `--attribution "<귀속 근거 한 줄>"`과 `features`일 때 `--area <area>`를 쓴다. 맞는 `area`가 없거나 `promotions`가 있으면 사용자에게 보여 주고, 사용자가 명시적으로 승인한 경우에만 `bouncer epic add-area --name <a> --yes` 또는 `bouncer epic add-domain --slug <s> --reason <text> --yes`를 실행한다. 승격 뒤에도 기존 blueprint는 옮기지 않는다.
- 보존: ACQ gate 목록·단계 수 8은 그대로다. 승인은 기존 ACQ가 아니라 채팅의 명시 승인으로 받는다(`AGENTS.md` hard rule 3).

#### Interface

- 제공: `registry.promotions: { area: string; count: number }[]`(`status: 'ok'`일 때만).
- 거부: inspect는 승격을 실행하지 않는다. 스킬은 침묵이나 이전 선택을 승인으로 보지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-inspect.ts` | `planInspect`, 신규 추출 지점: area 집계 | Modify | registry 후보 출력(BP002) | `promotions` 계산 | REQ-11 |
| `test/plan-inspect.test.js` | 신규 테스트 | Modify | inspect 테스트 | 승격 케이스 | 수용 기준 |
| `skills/bouncer-plan/SKILL.md` | Step 2 | Modify | 등록부 epic 선택 안내(BP002) | attribution·area 기록과 승인 명령 안내 | REQ-05·07·11 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | BP003 Added 항목 | 프로젝트 규칙 |

#### Constraints

- inspect는 읽기 전용이며 blueprint frontmatter 읽기 오류는 그 blueprint를 집계에서 빼고 계속한다(`loadRoutingTasks` 패턴).
- `scripts/check-doc-shape.js:857-870`과 `test/skill-bouncer-surface.test.js:124-130` 계약을 지킨다.

### context-search/registry-gates/005

#### Goal & intent

BP003의 네 commit task(필드·gate·명령·승격)가 통합된 상태에서 기존 fixture를 포함한 `npm run ci`가 통과함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.