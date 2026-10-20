---
type: bouncer.tasks
title: v2 등록부의 epic 디렉터리와 legacy 목록을 plan inspect에 반영
description: Make plan inspect resolve v2 registry epic dirs by slug and list legacy epics.
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - plan-inspect
  - epic-registry
timestamp: '2026-10-20T21:01:49.382+09:00'
bouncer:
  id: TASKS-001
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node --test test/plan-inspect.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/plan-inspect.ts
    - test/plan-inspect.test.js
  commit_intent:
    - v2 등록부에서 도메인 epic이 모두 디렉터리 없음으로 보이고 legacy 목록이 비는 문제를 바로잡음.
  commit_summary:
    - v2 항목은 slug 디렉터리로 판정하고 legacy_id를 id로 냄.
    - v2에서는 다음 epic 번호를 제안하지 않음.
---
# Tasks

Blueprint: [legacy-epic-merge](../../index.md)

## Goal & intent
v2 등록부(`version: 2`)에서 `bouncer plan inspect`가 도메인·공통 epic의 실제 디렉터리와 legacy epic 목록을 내게 한다. 지금은 v2 항목에 `id`가 없어 모든 epic이 `dir: null`이고 legacy 목록이 비어, `/bouncer-plan`이 "epic 디렉터리 없음 → scaffold epic"으로 잘못 안내한다. 수용 기준: 아래 Checklist의 v2 단언이 통과하고 v1 기존 단언이 그대로 통과한다. 검증 명령은 `node --test test/plan-inspect.test.js`.

## Current behavior
- 입력: `.bouncer/epics.json` v2 항목은 `{ slug, kind, active, legacy_id?, blueprint_aliases? }`이고 `id`가 없다. 디렉터리는 `.bouncer/context/epics/<slug>`다.
- 상태: `summarizeRegistry`(`scripts/src/lib/plan-inspect.ts:188`)의 `dirOf`(`:211-213`)는 `${id}-${slug}` 이름만 찾는다. v2에서 `entry.id`가 `undefined`라 `undefined-<slug>`를 찾고 `null`을 낸다.
- 출력: legacy는 `dir !== null`일 때만 목록에 넣으므로(`:220-223`) v2 legacy 목록이 항상 비고, 도메인은 `pendingDomainIds.push(entry.id)`(`:226`)로 `undefined`가 들어가 `nextEpicId`가 `undefined`가 될 수 있다. payload의 `id: string`(`:97`, `:100`)도 빠진다.
- `features.dir`가 `null`이라 `countAreaPromotions`(`:151-175`)가 `[]`로 조기 반환한다(`:157`).
- I/O 관찰 지점: 등록부 읽기 `readEpicRegistry`(`scripts/src/lib/epic-registry.ts:209`), 디렉터리 목록은 호출부 `inspect`가 `listDirNames(EPICS_REL)`로 넘긴다(`plan-inspect.ts:644-650`).
- 재현: 이 저장소에서 `bouncer plan inspect | jq '.registry.epics[].dir, .registry.legacy'` → 모두 `null`, `[]`.
- 기존 테스트: `test/plan-inspect.test.js:180-244`는 v1 fixture만 다룬다. fixture 등록부는 `test/helpers/epic-registry.js`의 `writeEpicRegistry(repo, overrides)`로 쓰며 `version: 2`도 overrides로 줄 수 있다.

## Target behavior
- 성공(v2): 항목 디렉터리는 `dirNames`에 `slug`가 있으면 `.bouncer/context/epics/<slug>`, 없으면 `null`이다. legacy 항목은 디렉터리가 있으면 `legacy[]`에 들어간다. payload `id`는 `legacy_id ?? null`이다. `nextEpicId`는 `null`이다(slug epic은 번호가 없다).
- 성공(v1): 판정·출력이 변경 전과 같다(`<id>-<slug>`, `nextEpicId`는 디렉터리 없는 도메인 중 가장 작은 id).
- 보존: 등록부 missing/invalid 결과와 `promotions` 계산 규칙은 그대로다. v2에서 `features` 디렉터리가 있으면 promotion 계산이 그 디렉터리를 읽는다.

## Interface
- 제공: `InspectRegistry` ok 분기의 `epics[].id`와 `legacy[].id` 타입이 `string | null`이 된다. v1은 항상 문자열, v2는 `legacy_id`가 없으면 `null`이다.
- 거부: 이 task는 새 거절을 만들지 않는다. 등록부 형식 위반은 지금처럼 `status: 'invalid'`(S35)다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-inspect.ts` | `summarizeRegistry`, `InspectRegistry` | Modify | v1 번호 디렉터리 이름으로만 epic 디렉터리를 판정 | `registry.version`으로 v1/v2 판정을 나누고 v2는 slug 디렉터리·`legacy_id`를 쓴다 | 상태 판정 진입점(`:188-254`)과 payload 타입(`:90-103`) |
| `test/plan-inspect.test.js` | v2 등록부 inspect 단언 | Modify | v1 fixture만 단언(`:180-244`) | v2 도메인 dir·legacy 목록·`nextEpicId: null`·`id` 단언 추가 | 검증 지점 |

## Do not touch
- `scripts/src/lib/epic-registry.ts` — `RegistryEpic.id` 타입 변경은 blueprint Out of scope이고 TASKS-002가 같은 파일을 고친다.
- `scripts/src/lib/scaffold.ts` — scaffold의 v2 처리(`legacy_id ?? id`)는 이미 맞다.
- `skills/bouncer-plan/SKILL.md` — 안내 문구 변경 범위가 아니다.

## Constraints
- v1 등록부의 출력 바이트(필드 순서·값)는 바뀌지 않는다. 기존 v1 테스트를 고치지 않는다.
- v2 판정은 `registry.version === 2`로만 분기한다. 디렉터리 이름 형식으로 버전을 추측하지 않는다.
- 이 저장소의 `.bouncer/epics.json`은 읽기만 하고 고치지 않는다.

## Checklist
- [ ] `test/plan-inspect.test.js`에 v2 실패 테스트를 추가한다. fixture: `writeEpicRegistry(repo, { version: 2, profile: 'domain-only', domainEpicLimit: 8, epics: [{ slug: 'plan-workflow', kind: 'domain', active: true, approval: {...} }, { slug: 'drive-execution', kind: 'domain', active: true, approval: {...} }, { slug: 'old-work', legacy_id: '012', kind: 'legacy', active: true }] })`, 디렉터리 `epics/plan-workflow`, `epics/old-work`만 만든다. 기대 red: `plan-workflow.dir`가 `null`로 나와 아래 첫 단언에서 실패한다.
  ```js
  assert.strictEqual(byslug('plan-workflow').dir, `${EPICS}/plan-workflow`);
  assert.strictEqual(byslug('plan-workflow').id, null);
  assert.strictEqual(byslug('drive-execution').dir, null);
  assert.deepStrictEqual(payload.registry.legacy, [{ slug: 'old-work', id: '012', dir: `${EPICS}/old-work` }]);
  assert.strictEqual(payload.nextEpicId, null);
  ```
- [ ] `npm run build && node --test test/plan-inspect.test.js`로 red를 확인한다.
- [ ] `summarizeRegistry`에서 버전별 `dirOf`·`id`를 나누고 v2 `pendingDomainIds`를 쓰지 않는다. 문서 주석(`:184-186`)의 `<id>-<slug>` 설명을 버전별로 고친다.
- [ ] 기존 v1 단언이 바뀌지 않았는지 확인한다.
- [ ] `npm run build` 뒤 `node --test test/plan-inspect.test.js`가 통과한다.
