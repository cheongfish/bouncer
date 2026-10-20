---
type: bouncer.tasks
title: 식별자 resolver와 등록부 v2 추가
description: Add one resolver that parses numeric and slug context identifiers and extend the epic registry with v2 aliases and slug limits
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - identifiers
  - epic-registry
  - slug
timestamp: '2026-10-20T17:07:09.130+09:00'
bouncer:
  id: TASKS-001
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: false
  dependency_gate: integrated
  review_risk:
    - public_interface
  verify: node --test test/context-ids.test.js test/paths.test.js test/epic-registry.test.js test/epic-command.test.js
  affected_paths:
    - scripts/src/lib/context-ids.ts
    - scripts/src/lib/paths.ts
    - scripts/src/lib/epic-registry.ts
    - epics.example.json
    - test/context-ids.test.js
    - test/paths.test.js
    - test/epic-registry.test.js
    - test/epic-command.test.js
    - test/tiers.json
  commit_intent:
    - epic·blueprint 번호 정규식이 모듈마다 흩어져 있어 slug 식별자로 바꾸려면 해석을 한곳으로 모아야 함.
  commit_summary:
    - context-ids 모듈이 구형 번호와 slug 형식의 경로·stable ID·pointer 키를 해석하고 별칭으로 정규화함.
    - 등록부를 v2로 넓혀 legacy_id·blueprint_aliases·slug 길이 제한을 검사함.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
epic·blueprint 식별자를 해석하는 단일 모듈 `context-ids.ts`를 만들고 `paths.ts`가 그 모듈에 위임하게 한다. 등록부는 v2(`legacy_id`, `blueprint_aliases`)와 강화한 slug 규칙을 받는다. 이 task 뒤에도 구형 경로의 관찰 가능한 동작은 그대로다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- `scripts/src/lib/paths.ts:18-19` `EPIC_SEG_RE`·`BP_SEG_RE`가 `epics/(\d{3})`, `blueprints/(\d{3})`만 잡는다. slug 경로는 `epicId`/`blueprintId`가 `null`이 된다. `parsePathIds`(:31-50)는 `{epicId, blueprintId, kind}`를 돌려주고 19곳에서 호출된다(`runtime-state.ts:119,620,990,1040`, `coordinator-commands.ts:852,3036,3794,4341`, `scaffold.ts:262,517,561`, `verification.ts:570`, `validate-structural.ts:42,146`, `intent-bundle.ts:396,881` 등).
- `paths.ts:21-22` `isNumericContextId`는 `^\d{3}$`이고 task 번호 검사(`cli-review-command.ts:186`, `cli-doc-commands.ts:99,163`)에도 쓰인다.
- `scripts/src/lib/epic-registry.ts:26` `SLUG_RE`에 길이 제한이 없고, epic slug는 비어 있지 않은지만 본다(:120). area만 `SLUG_RE`로 검사한다(:106). `id`는 세 자리 필수다(:27, :121). `version !== 1`이면 실패한다(`parseEpicRegistry` :94-). 별칭 필드는 없다.
- 등록부 I/O: `readEpicRegistry`(:145-148)가 `.bouncer/epics.json`을 읽고 `writeEpicRegistry`(:345)가 쓴다. 읽는 곳은 `cli-epic-command.ts:106`, `plan-approve.ts:163`, `scaffold.ts:423`, `init.ts:343`, `validate-gates.ts:1111`, `plan-inspect.ts:184`, `validate.ts:442`(S35)다.
- 루트에 `config.example.json`은 있지만 `epics.example.json`은 없다.
- 재현: `npm run build && node --test test/paths.test.js test/epic-registry.test.js`가 현재 통과한다.

## Target behavior
- 성공:
  - `parseContextPath('.bouncer/context/epics/114-consumer-epic-registry/blueprints/003-registry-gates/index.md')` → `{format:'numeric', epicKey:'114', blueprintKey:'003', epicSlug:'consumer-epic-registry', blueprintSlug:'registry-gates', kind:'blueprint'}`.
  - `parseContextPath('.bouncer/context/epics/consumer-epic-registry/blueprints/registry-gates/tasks/001/tasks.md')` → `{format:'slug', epicKey:'consumer-epic-registry', blueprintKey:'registry-gates', …, kind:'tasks'}`.
  - `formatStableTaskId` / `formatStableIntentId`가 형식에 맞는 문자열을 만든다. `parseStableId`는 두 형식을 모두 해석한다.
  - `normalizeStableId('EPIC-114/BP-003/TASK-001', registry)` → `'consumer-epic-registry/registry-gates/001'`. 이미 새 형식이면 값을 그대로 돌려준다.
  - `paths.parsePathIds`는 `{epicId: epicKey, blueprintId: blueprintKey, kind}`를 유지한다. 구형 경로의 반환값은 바이트까지 같다.
  - 등록부 v2를 읽는다. v1도 그대로 읽고, v1 `id`는 `legacy_id`로 본다.
- 실패:
  - slug 규칙 위반(41자 이상, 숫자만, `^\d{3}-` 시작, `SLUG_RE` 불일치) → `validateSlug`가 이유 문자열을 돌려주고, 등록부 parser는 S35로 거절한다.
  - `blueprint_aliases`의 키가 세 자리 번호도 slug도 아니거나, 값이 slug가 아니면 S35다.
  - 별칭 대상이 겹치는 경우(두 키가 같은 값을 가리키는 것은 허용, 한 키가 두 값은 JSON상 불가)는 검사하지 않는다.
- 보존: `isNumericContextId`는 task 번호 검사용으로 남긴다. `kind` 판정(`FILE_KIND`, `unitDocKind`)은 `paths.ts`에 그대로 둔다.

## Interface
- 제공 (`scripts/src/lib/context-ids.ts`):
  ```ts
  type IdFormat = 'numeric' | 'slug';
  type ContextIds = { format: IdFormat; epicKey: string; blueprintKey: string | null;
    epicSlug: string; blueprintSlug: string | null };
  function parseContextPath(p: unknown): ContextIds | null;      // epics/<seg>[/blueprints/<seg>]
  function formatStableIntentId(ids: { format: IdFormat; epicKey: string; blueprintKey: string }): string;
  function formatStableTaskId(ids: {…; task: string /* NNN */}): string;
  function parseStableId(v: unknown): { format: IdFormat; epicKey: string; blueprintKey: string; task: string | null } | null;
  function normalizeStableId(v: unknown, registry: EpicRegistry | null): string | null;
  function formatPointerKey(ids): string;  function parsePointerKey(k: unknown): {format, epicKey, blueprintKey} | null;
  function validateSlug(s: unknown): string | null;               // null = 통과, 문자열 = 거절 이유
  const SLUG_MAX = 40;
  ```
  - 형식 판정 용어: **numeric 세그먼트**는 `^\d{3}-[a-z0-9-]+$`(예: `114-consumer-epic-registry`), **slug 세그먼트**는 `validateSlug`를 통과하는 값(예: `consumer-epic-registry`)이다. epic과 blueprint 세그먼트의 형식이 다르면 `null`이다.
- 제공 (`epic-registry.ts`): v2 타입 `{version: 2, …, epics: [{slug, kind, active, approval?, legacy_id?, blueprint_aliases?}]}`, `resolveBlueprintAlias(registry, epicSlug, key) → string | null`, `epicByLegacyId(registry, id)`. `SLUG_RE` 대신 `validateSlug`를 쓴다.
- 제공: 루트 `epics.example.json`(v2, common·domain·legacy 항목 각 1개, `blueprint_aliases` 예시 포함).
- 거부(throw 아님, 반환값): 해석 불가 경로·ID → `null`. 별칭 표에 없는 구형 ID → `normalizeStableId` `null`.
- 거부(throw): `formatStable*`에 형식과 맞지 않는 key(numeric인데 세 자리 아님, slug인데 `validateSlug` 실패)나 `task`가 세 자리가 아닌 값을 넘기면 `Error`를 던진다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-ids.ts` | `신규 추출 지점: 식별자 해석·조립` | Create | 없음 | 두 형식 해석·조립·정규화·slug 검사 | 수용 기준 1·2의 단일 소유 모듈 |
| `scripts/src/lib/paths.ts` | `parsePathIds`, `EPIC_SEG_RE`, `BP_SEG_RE` | Modify | 번호 경로 파싱 | `parseContextPath`에 위임하고 정규식 삭제 | 19개 호출부의 진입점(`paths.ts:31`) |
| `scripts/src/lib/epic-registry.ts` | `parseEpicRegistry`, `SLUG_RE`, `ID_RE` | Modify | v1 등록부 검사·쓰기 | v2·별칭·slug 규칙, v1 읽기 호환 | `epic-registry.ts:26-27,94-,121` |
| `epics.example.json` | — | Create | 없음 | v2 예시 | 사용자 요청(답변 6) |
| `test/context-ids.test.js` | — | Create | 없음 | resolver 단위 테스트 | 수용 기준 1 |
| `test/paths.test.js` | — | Modify | `parsePathIds` 테스트 | slug 경로 사례 추가 | 위임 후 보존 확인 |
| `test/epic-registry.test.js` | — | Modify | 등록부 parser 테스트 | v2·별칭·slug 거절 사례 | `epic-registry.ts` 계약 변경 |
| `test/epic-command.test.js` | — | Modify | `epic add-*` 테스트 | slug 길이·숫자 slug 거절 사례 | `nameViolation`(:270)이 새 규칙을 씀 |
| `test/tiers.json` | — | Modify | 테스트 tier 목록 | `context-ids.test.js`를 unit에 등록 | `test-tiers.test.js:30-59` |

## Do not touch
- `scripts/src/lib/runtime-state.ts` — 실행 키는 TASKS-003 소관이다.
- `scripts/src/lib/commit-sha.ts` — trailer 조립은 TASKS-004 소관이다.
- `scripts/src/lib/scaffold.ts` — 쓰기 경로는 TASKS-002 소관이다.
- `.bouncer/epics.json` — 실제 등록부는 이관 명령이 병합 뒤 바꾼다.
- `.bouncer/context/epics/` — 이 blueprint는 legacy 문서를 이관하지 않는다.

## Constraints
- 구형 경로에 대한 `parsePathIds` 반환값과 기존 테스트 기대값을 바꾸지 않는다.
- `context-ids.ts`는 fs·git을 읽지 않는 순수 모듈이다. 등록부는 인자로 받는다.
- 등록부를 쓸 때는 읽은 버전을 유지한다. v1을 v2로 올리는 일은 이관 명령만 한다.
- 새 테스트 이름은 ` → `를 포함한 정적 문자열이다(`scripts/check-test-names.js:157-167`).

## Checklist
- [ ] `test/context-ids.test.js`에 두 형식 해석, 정규화, 별칭 miss `null`, slug 거절(41자, `123`, `114-foo`), 형식 불일치 throw 사례를 쓴다. 먼저 export만 있는 빈 stub(`return null`)을 두고 build한 뒤, 해석 사례의 `assert.deepStrictEqual`이 `null`을 받아 실패하는지 확인한다. module-load 실패는 기대 red로 치지 않는다.
- [ ] `context-ids.ts`를 구현하고 `paths.ts`를 위임으로 바꾼다.
- [ ] `test/epic-registry.test.js`·`test/epic-command.test.js`에 v2 읽기, v1 호환, 별칭 키·값 거절, 40자 상한 사례를 먼저 추가하고 실패를 확인한 뒤 `epic-registry.ts`를 고친다.
- [ ] `epics.example.json`을 만들고 테스트에서 `parseEpicRegistry`로 읽어 통과함을 확인한다.
  ```js
  assert.equal(parseEpicRegistry(JSON.parse(fs.readFileSync('epics.example.json','utf8'))).ok, true);
  ```
- [ ] `test/tiers.json` unit 목록에 `context-ids.test.js`를 넣는다.
- [ ] `npm run build` 뒤 `node --test test/context-ids.test.js test/paths.test.js test/epic-registry.test.js test/epic-command.test.js`가 통과한다.
