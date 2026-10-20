---
type: bouncer.tasks
title: legacy blueprint 이동 대상을 등록부에 기록하고 옛 trailer를 새 위치로 해석
description: Add a per-blueprint moved_to target to legacy registry entries and resolve old trailers to the domain epic.
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - epic-registry
  - stable-id
  - trailer
timestamp: '2026-10-20T21:02:17.766+09:00'
bouncer:
  id: TASKS-002
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node --test test/context-ids.test.js test/epic-registry.test.js test/finalize.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/epic-registry.ts
    - scripts/src/lib/context-ids.ts
    - scripts/src/lib/finalize.ts
    - rules/commit-scope.md
    - test/context-ids.test.js
    - test/epic-registry.test.js
    - test/finalize.test.js
  commit_intent:
    - blueprint를 도메인 epic으로 옮긴 뒤에도 옛 번호·legacy slug trailer로 설계 의도를 찾게 함.
  commit_summary:
    - legacy 항목의 moved_to 필드를 검사하고 식별자 정규화가 그 대상을 사용함.
    - finalize의 trailer 조회가 등록부를 넘김.
---
# Tasks

Blueprint: [legacy-epic-merge](../../index.md)

## Goal & intent
legacy epic 등록부 항목에 blueprint별 이동 대상 `moved_to`를 두고, 옛 trailer(번호 `EPIC-ddd/BP-ddd[/TASK-ddd]`와 legacy slug `<legacy-epic>/<bp>[/<ddd>]`)를 도메인 epic 위치 `<domain>/<bp>[/<ddd>]`로 정규화한다. finalize의 trailer 조회도 등록부를 넘겨 같은 규칙을 쓴다. 수용 기준: blueprint 수용 기준 2. 검증 명령은 `node --test test/context-ids.test.js test/epic-registry.test.js test/finalize.test.js`.

## Current behavior
- 등록부 타입 `RegistryEpic`(`scripts/src/lib/epic-registry.ts:18-21`)에는 `legacy_id?`, `blueprint_aliases?`만 있고 이동 대상 필드가 없다. 파서 `parseEpicRegistry`(`:121-173`)는 `aliasViolationOf`(`:100-109`)로 별칭만 검사한다.
- `normalizeStableId`(`scripts/src/lib/context-ids.ts:147-157`): slug 형식 ID는 등록부를 보지 않고 그대로 돌려준다(`:150`). 번호 형식은 `legacy_id`로 epic을, `blueprint_aliases`로 blueprint slug를 찾아 `<legacy-epic-slug>/<bp-slug>`를 낸다(`:153-156`). 구조적 입력 타입은 `RegistryLike`(`:18-22`)다.
- 따라서 blueprint를 도메인 epic 아래로 옮기면 두 형식 모두 legacy epic slug를 가리켜 새 위치와 어긋난다.
- `finalize.ts:731`의 `resolveTaskCommits` 호출은 `registry`를 넘기지 않아 묶음 키가 원래 문자열이다(`task-commits.ts:99`). `finalize-digest.ts:891-899`는 이미 `readEpicRegistry`로 읽어 넘긴다.
- `normalizeStableId` 사용처: `task-commits.ts:99`(묶음 키), `intent-provenance.ts:545-552`(Explain 매칭), `migrate-context-slugs.ts:547`(본문 치환). 다른 `parseStableId` 사용처(`intent-provenance.ts:520-531`, `finalize-collect.ts:30`, `intent-bundle.ts:44`)는 형식·키 비교나 task 번호만 읽고 경로를 만들지 않는다.
- 기존 테스트: `test/context-ids.test.js:78-94`(정규화), `test/epic-registry.test.js:96-121`(S35), `test/finalize.test.js:1727`(trailer SHA 우선).

## Target behavior
- 성공: legacy 항목 `{ slug: 'old', legacy_id: '012', blueprint_aliases: { '003': 'bp-a' }, moved_to: { 'bp-a': 'dom' } }`가 있을 때
  - `EPIC-012/BP-003/TASK-001` → `dom/bp-a/001`, `EPIC-012/BP-003` → `dom/bp-a`
  - `old/bp-a/001` → `dom/bp-a/001`
  - `moved_to`에 없는 blueprint는 지금처럼 `old/<bp>`(번호)·그대로(slug)다.
- 성공: `finalize`의 trailer 조회가 `readEpicRegistry` 결과(ok일 때만)를 `registry`로 넘긴다. 등록부가 없거나 깨졌으면 `null`로 넘겨 이전과 같다.
- 실패: `moved_to`가 객체가 아니거나, 키가 slug가 아니거나, 값이 같은 등록부의 `kind: 'domain'` epic slug가 아니면 파서가 `moved_to is invalid: <slug>: <사유>`로 거절한다(S35).
- 보존: `moved_to`가 없는 등록부에서 모든 정규화 결과가 변경 전과 같다. slug ID에 등록부가 `null`이면 그대로 돌려준다.

## Interface
- 제공:
  ```ts
  type RegistryEpic = { /* 기존 필드 */ moved_to?: Record<string, string> };
  // RegistryLike epics[]에도 moved_to?: Record<string, string>
  normalizeStableId(v: unknown, registry: RegistryLike | null): string | null
  ```
  - 용어 `moved_to`: legacy epic 항목의 "현재 blueprint slug → 그 blueprint가 지금 있는 도메인 epic slug" 표. 예: `{ "adaptive-quiz": "plan-workflow" }`.
- 거부 (S35): 형식 위반 `moved_to`(위 실패 경로). legacy가 아닌 항목의 `moved_to`도 `moved_to is only allowed on legacy epics: <slug>`로 거절한다.
- miss: 별칭·대상이 없는 ID는 지금처럼 `null`(번호) 또는 원래 값(slug)이다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/epic-registry.ts` | `RegistryEpic`, `parseEpicRegistry`, `신규 추출 지점: moved_to 검사` | Modify | 별칭만 검사(`:100-109`, `:155-157`) | `moved_to` 타입·검사 추가. 도메인 slug 검사는 모든 항목을 읽은 뒤 한다 | 등록부 계약 진입점 |
| `scripts/src/lib/context-ids.ts` | `RegistryLike`, `normalizeStableId` | Modify | 번호만 별칭으로 해석, slug는 통과(`:147-157`) | 두 형식 모두 `moved_to`로 epic slug를 바꾼다 | trailer 해석 상태 변경 지점 |
| `scripts/src/lib/finalize.ts` | trailer 조회(`resolveTaskCommits` 호출) | Modify | `registry` 미전달(`:731-736`) | `readEpicRegistry` 결과를 넘긴다(`finalize-digest.ts:891-899`와 같은 방식) | 알려진 약점 |
| `rules/commit-scope.md` | legacy trailer 읽기 문단 | Modify | `legacy_id`·`blueprint_aliases`로 매핑한다고 적음(`:28-30`) | `moved_to`로 도메인 epic 위치를 따른다는 한 문장 추가 | 규칙 문서 정합 |
| `test/context-ids.test.js` | `normalizeStableId` 이동 단언 | Modify | 이동 없는 정규화만(`:78-94`) | 번호·slug·미이동 케이스 추가 | 검증 지점 |
| `test/epic-registry.test.js` | `moved_to` S35 단언 | Modify | 별칭·중복 S35만 | 정상·형식 위반·비도메인 대상·비legacy 항목 케이스 추가 | 검증 지점 |
| `test/finalize.test.js` | 구형 trailer + 이동 등록부 단언 | Modify | 번호 trailer 정확 일치만(`:1727-1760`) | `moved_to` 등록부에서 slug 위치 task가 옛 trailer 커밋을 찾는지 단언 | 검증 지점 |

## Do not touch
- `scripts/src/lib/plan-inspect.ts` — TASKS-001 소관.
- `scripts/src/lib/migrate-context-slugs.ts` — TASKS-003이 고친다. `moved_to`가 없는 등록부에서 이 모듈의 결과는 바뀌지 않는다.
- `scripts/src/lib/task-commits.ts` — 이미 `registry`를 받아 정규화한다.
- `scripts/src/lib/intent-provenance.ts` — 정규화 결과만 소비한다.

## Constraints
- `RegistryEpic.id` 타입은 바꾸지 않는다(blueprint Out of scope).
- `context-ids.ts`는 `epic-registry.ts`를 import하지 않는다(순환, `:16-17` 주석). 필요한 필드는 `RegistryLike`에 구조적으로 추가한다.
- 등록부 v1에도 `moved_to`를 허용할지 묻지 않는다: v2에서만 검사·해석한다. v1 항목에 있으면 S35다.
- 정규화 결과 형식은 `formatStableIntentId`/`formatStableTaskId`(slug 형식)로만 만든다.

## Checklist
- [ ] `test/context-ids.test.js`에 실패 테스트 추가. 기대 red: 첫 단언이 `'old/bp-a/001'`을 받아 실패한다.
  ```js
  const MOVED = { version: 2, epics: [
    { slug: 'old', legacy_id: '012', blueprint_aliases: { '003': 'bp-a', '004': 'bp-b' }, moved_to: { 'bp-a': 'dom' } },
    { slug: 'dom', kind: 'domain' },
  ] };
  assert.strictEqual(ids.normalizeStableId('EPIC-012/BP-003/TASK-001', MOVED), 'dom/bp-a/001');
  assert.strictEqual(ids.normalizeStableId('old/bp-a/001', MOVED), 'dom/bp-a/001');
  assert.strictEqual(ids.normalizeStableId('EPIC-012/BP-004', MOVED), 'old/bp-b');
  assert.strictEqual(ids.normalizeStableId('old/bp-b/002', MOVED), 'old/bp-b/002');
  ```
- [ ] `test/epic-registry.test.js`에 S35 케이스 추가: 정상 `moved_to` → S35 없음, `moved_to: []` / 값이 등록부에 없는 slug / 값이 legacy slug / domain 항목의 `moved_to` / v1 등록부 항목의 `moved_to` → 각각 S35. 기대 red: 형식 위반이 S35 없이 통과한다.
- [ ] `test/finalize.test.js`에 이동 등록부 fixture의 trailer 단언 추가. 기대 red: trailer SHA 대신 worker `commit_sha`가 쓰인다.
- [ ] `npm run build && node --test test/context-ids.test.js test/epic-registry.test.js test/finalize.test.js`로 red 확인.
- [ ] 파서·타입·정규화·finalize 호출을 구현하고 `rules/commit-scope.md`에 한 문장을 더한다.
- [ ] `npm run build` 뒤 `node --test test/context-ids.test.js test/epic-registry.test.js test/finalize.test.js`가 통과한다.
