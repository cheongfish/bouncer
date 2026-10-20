---
type: bouncer.tasks
title: 두 형식 trailer와 추적 키 해석
description: Write slug-format trailers and stable ids and read old and new trailers as the same task through registry aliases
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - trailer
  - intent-provenance
  - finalize
timestamp: '2026-10-20T17:07:45.380+09:00'
bouncer:
  id: TASKS-004
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
  verify: node --test test/finalize-pure.test.js test/intent-provenance.test.js test/terminal-intent-provenance.test.js test/intent-bundle.test.js test/finalize-digest.test.js test/context-ontology.test.js test/verification-runner.test.js test/commit-task.test.js
  affected_paths:
    - scripts/src/lib/commit-sha.ts
    - scripts/src/lib/task-commits.ts
    - scripts/src/lib/intent-provenance.ts
    - scripts/src/lib/intent-bundle.ts
    - scripts/src/lib/cli-intent-command.ts
    - scripts/src/lib/finalize-collect.ts
    - scripts/src/lib/finalize-explain.ts
    - scripts/src/lib/finalize-digest.ts
    - scripts/src/lib/verification.ts
    - scripts/src/lib/context-ontology.ts
    - test/finalize-pure.test.js
    - test/finalize-digest.test.js
    - test/intent-provenance.test.js
    - test/terminal-intent-provenance.test.js
    - test/intent-bundle.test.js
    - test/context-ontology.test.js
    - test/verification-runner.test.js
    - test/commit-task.test.js
  commit_intent:
    - 과거 커밋 trailer는 바꿀 수 없으므로 slug 형식으로 쓰기 시작해도 구형 trailer를 같은 task로 계속 찾아야 함.
  commit_summary:
    - slug 경로의 task는 slug stable ID로 trailer와 검증 scope 키를 쓰고, 조회는 별칭으로 정규화한 키로 두 형식을 묶음.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
slug 경로 task의 stable ID·trailer·검증 scope 키·ontology ID를 새 형식(`plan-workflow/registry-gates/001`)으로 쓴다. 조회는 구형·새 형식 trailer를 모두 받아 등록부 별칭으로 정규화한 키로 같은 task에 묶는다. 결정 4에 따라 구형 trailer는 영구히 읽는다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- `scripts/src/lib/commit-sha.ts:83-104` `buildStableProvenance`가 trailer를 만드는 유일한 곳이다. `requireThreeDigitId`(:48, :90-91)로 epic·bp를 세 자리로 강제하고 `EPIC-${epic}/BP-${blueprint}`(:93), `${intent}/TASK-${digits}`(:94)를 만든다.
  - 호출부: `commit-message.ts:82`, `verification.ts:556`, `intent-provenance.ts:689`, `intent-bundle.ts:405`, `finalize-digest.ts:831`, `finalize-collect.ts:43,347`.
  - `commit-message.ts:50`은 trailer 키 이름만 본다.
- `scripts/src/lib/intent-provenance.ts`:
  - `STABLE_TASK_RE`·`STABLE_INTENT_RE`(:23-24)와 경로 정규식(:29)은 구형만 받는다.
  - 검증(:495-503)은 구형이 아니면 `reject`하고, intent를 다시 조립해 비교한다(:501).
  - `explainsForTask`(:506-519)는 trailer 번호와 explain 경로 번호(`doc.epicId/bpId`)가 같은지 본다.
  - :636, :673은 구형 ID를 조립한다. :888 explain 제목 정규식은 `### EPIC-\d{3}/BP-\d{3}/TASK-(\d{3})`만 받는다.
- `scripts/src/lib/intent-bundle.ts:28,30` `CANONICAL_TASK_RE`·`CANONICAL_EXPLAIN_RE`와 :32 `STABLE_TASK_RE`는 구형만 받는다(:531, :585 검사). `cli-intent-command.ts:59`도 같은 `CANONICAL_TASK_RE`를 따로 둔다.
- `scripts/src/lib/finalize-collect.ts:25` `STABLE_TASK_RE`, :36-58 `stableIdFromTaskData`(세 자리 위반은 `null`).
- `scripts/src/lib/finalize-explain.ts:104`가 `STABLE_TASK_RE`로 task를 분해하고, :125 제목 주석이 구형 형식을 적는다.
- `scripts/src/lib/finalize-digest.ts:790` `stableBlueprint = EPIC-${…}/BP-${…}`. :881-890에서 `resolveTaskCommits` 결과 `trailerMap.get(item.digest.stable_id)`를 정확 일치로 찾는다.
- `scripts/src/lib/task-commits.ts:81-121` `resolveTaskCommits`:
  - `git log --format=%H%x00%B base..head`를 파싱한다(:46).
  - 본문마다 첫 `Bouncer-Task`를 쓰고, `stableIds`로 만든 정확 일치 Set으로 거른 뒤 ID마다 최신 커밋을 남긴다.
- `scripts/src/lib/verification.ts:580`의 task scope 키는 `EPIC-${ids.epicId}/BP-${ids.blueprintId}/TASK-${n}`이다. `evidence_id`는 `scope`를 포함한 identity의 해시다(:901-909).
- `scripts/src/lib/context-ontology.ts`:
  - 경로 정규식(:9-12)은 `(\d{3})-[^/]+`만 잡는다.
  - frontmatter `bouncer.id`를 `EPIC-${id}`(:116), `EPIC-…/BP-…`(:127)와 비교하고, :141과 :563-564에서 구형 ID와 정규식을 조립한다.
- 재현: `npm run build && node --test test/finalize-pure.test.js test/intent-provenance.test.js test/finalize-digest.test.js`가 현재 통과한다.

## Target behavior
- 성공:
  - `buildStableProvenance({epicId:'plan-workflow', blueprintId:'registry-gates', taskId:'TASKS-001'})` → task `plan-workflow/registry-gates/001`, intent `plan-workflow/registry-gates`, trailers `Bouncer-Task: plan-workflow/registry-gates/001`, `Bouncer-Intent: plan-workflow/registry-gates`.
  - 구형 입력(`'114'`, `'003'`)은 지금과 같은 `EPIC-114/BP-003/TASK-001`을 낸다.
  - `resolveTaskCommits`:
    - 묶음 키는 `normalizeStableId(id, registry) ?? id`다.
    - 같은 task의 구형·새 형식 trailer 커밋은 한 키로 묶이고, 기존 규칙대로 가장 최근 커밋이 남는다(답변 15).
    - 반환 Map은 호출자가 넘긴 `stableIds` 원래 값을 키로 쓴다.
  - intent provenance:
    - 두 형식 trailer를 모두 받는다. intent는 task와 같은 형식이어야 한다.
    - `explainsForTask`는 trailer와 explain 경로의 intent를 각각 정규화해 비교한다.
    - 그래서 구형 trailer 커밋도 이관 뒤의 slug `explain.md`에 연결된다.
  - explain 제목은 `### EPIC-…/TASK-NNN`과 `### <epic-slug>/<bp-slug>/NNN`을 모두 읽는다. 새로 쓸 때는 경로 형식을 따른다.
  - slug 경로의 verification scope 키는 `plan-workflow/registry-gates/001`이다.
  - context-ontology는 두 형식의 경로와 frontmatter ID를 검사한다. slug epic의 `bouncer.id`는 epic slug, blueprint는 bp slug다.
- 실패:
  - 형식이 섞인 입력(epic 번호 + bp slug)은 `buildStableProvenance`가 throw한다(커밋 전 거절).
  - 별칭 표에 없는 구형 trailer는 정규화하지 않고 원래 문자열로 비교한다. 이관 전 동작과 같다.
  - task와 intent의 형식이 다른 trailer 쌍은 `reject`한다.
- 보존:
  - 등록부가 v1이거나 별칭이 없으면 모든 조회가 지금과 같은 정확 일치로 동작한다.
  - 구형 경로의 scope 키·`evidence_id`·trailer는 바이트까지 같다.

## Interface
- 제공: `buildStableProvenance({ epicId, blueprintId, taskId })`. 시그니처는 유지하고 형식은 키 모양으로 판정한다(`formatStableTaskId`에 위임).
- 제공: `resolveTaskCommits({ repoRoot, base, head, stableIds, exec, registry? })`.
  - `registry?: EpicRegistry | null`이다. 없으면 정규화 없이 정확 일치로 비교한다.
  - test seam은 기존 `exec(repoRoot, args) → { stdout }` 주입을 그대로 쓴다.
- 제공: intent provenance 진입점은 `.bouncer/epics.json`을 `readEpicRegistry`로 한 번 읽어 정규화에 쓴다. 읽기 실패(파일 없음·S35)는 등록부 `null`로 처리한다.
- 거부(throw): 형식이 섞인 `buildStableProvenance` 입력, slug 규칙 위반 키, `TASKS-NNN`이 아닌 task id.
- 거부(miss, throw 아님): 별칭 없는 구형 ID 정규화 → 원래 문자열로 비교. 해석 불가 trailer → 지금처럼 무시하거나 `reject`.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/commit-sha.ts` | `buildStableProvenance`, `requireThreeDigitId` | Modify | 구형 trailer 조립 | 형식별 조립 | `commit-sha.ts:48,83-104` |
| `scripts/src/lib/intent-provenance.ts` | `STABLE_TASK_RE`, `STABLE_INTENT_RE`, `explainsForTask`, explain 제목 파싱 | Modify | 구형 trailer·제목만 해석 | 두 형식 해석·별칭 비교 | `intent-provenance.ts:23-29,495-519,636,673,888` |
| `scripts/src/lib/intent-bundle.ts` | `CANONICAL_TASK_RE`, `CANONICAL_EXPLAIN_RE`, `STABLE_TASK_RE` | Modify | 구형 경로·ID 검사 | `parseContextPath`·`parseStableId` 사용 | `intent-bundle.ts:28-32,531,585` |
| `scripts/src/lib/finalize-collect.ts` | `STABLE_TASK_RE`, `stableIdFromTaskData` | Modify | 구형 ID 분해 | resolver 사용 | `finalize-collect.ts:25,36-58,363` |
| `scripts/src/lib/finalize-explain.ts` | task 분해·제목 | Modify | 구형 제목 | 두 형식 | `finalize-explain.ts:104,125` |
| `scripts/src/lib/finalize-digest.ts` | `stableBlueprint`, trailerMap 조회 | Modify | 구형 조립·정확 일치 | resolver 조립·등록부 전달 | `finalize-digest.ts:790,881-890` |
| `scripts/src/lib/task-commits.ts` | `resolveTaskCommits` | Modify | 정확 일치 Set | 정규화 키로 묶음 | `task-commits.ts:81-121` |
| `scripts/src/lib/verification.ts` | task scope 키 | Modify | 구형 키 조립 | `formatStableTaskId` | `verification.ts:516,580` |
| `scripts/src/lib/context-ontology.ts` | `EPIC_RE`, `BP_RE`, `EXPLAIN_RE`, `TASK_RE`, ID 비교 | Modify | 구형 경로·ID | 두 형식 | `context-ontology.ts:9-12,116-141,563-564` |
| `scripts/src/lib/cli-intent-command.ts` | `CANONICAL_TASK_RE` | Modify | 구형 task 경로만 bundle 인자로 허용 | `parseContextPath`로 두 형식 허용 | `cli-intent-command.ts:59` |
| `test/finalize-pure.test.js` | — | Modify | trailer·stable ID 테스트 | slug trailer 사례 | 수용 기준 3 |
| `test/intent-provenance.test.js` | — | Modify | provenance 테스트 | 혼합 trailer·별칭 연결 사례 | 수용 기준 6 |
| `test/terminal-intent-provenance.test.js` | — | Modify | 종단 provenance 테스트 | slug explain 연결 사례 | 수용 기준 6 |
| `test/intent-bundle.test.js` | — | Modify | bundle 테스트 | slug stable ID 사례 | `intent-bundle.ts:32` 변경 |
| `test/finalize-digest.test.js` | — | Modify | digest·trailerMap 테스트 | 혼합 trailer 묶음 사례 | 답변 15 |
| `test/context-ontology.test.js` | — | Modify | ontology 테스트 | slug 경로·ID 사례 | `context-ontology.ts` 변경 |
| `test/verification-runner.test.js` | — | Modify | 검증 scope 테스트 | slug scope 키 사례 | `verification.ts:580` 변경 |
| `test/commit-task.test.js` | — | Modify | task 커밋 테스트 | slug trailer 커밋 사례 | `commit-message.ts:82` 경유 |

## Do not touch
- `scripts/src/lib/coordinator-commands.ts`, `scripts/src/lib/runtime-state.ts` — TASKS-003 소관이다.
- `scripts/src/lib/context-ids.ts`, `scripts/src/lib/epic-registry.ts` — 소비만 한다.
- `scripts/src/lib/commit-message.ts` — trailer 키 이름 검사는 형식과 무관하다.
- `.bouncer/context/epics/` — 기존 `explain.md`·`verification.md`를 바꾸지 않는다.

## Constraints
- 구형 입력에 대한 출력(`evidence_id` 포함)은 바이트까지 같아야 한다. 이미 저장된 검증 증적이 깨지지 않게 하기 위해서다.
- 과거 커밋을 다시 쓰지 않는다. 구형 trailer는 읽기만 한다.
- 등록부를 읽는 쪽은 진입점 한 곳이고, 하위 함수는 인자로 받는다(순수 함수 테스트 유지).

## Checklist
- [ ] 테스트를 먼저 추가하고 `npm run build && node --test <파일>`로 실패를 확인한다.
  - `finalize-pure.test.js`의 slug trailer 사례가 `must be a three-digit id`로 실패한다.
  - `finalize-digest.test.js`의 혼합 trailer 사례는 구형 trailer 커밋을 찾지 못해 `commit`이 `undefined`가 된다.
- [ ] 혼합 묶음의 기대값을 literal로 둔다.
  ```js
  // 같은 task: 오래된 구형 trailer 커밋 A, 최근 새 형식 커밋 B → B
  assert.equal(map.get('consumer-epic-registry/registry-gates/001').sha, SHA_B);
  ```
- [ ] `commit-sha.ts` → `task-commits.ts` → `finalize-digest.ts`·`finalize-collect.ts`·`finalize-explain.ts` 순서로 고친다.
- [ ] `intent-provenance.ts`·`intent-bundle.ts`·`verification.ts`·`context-ontology.ts`를 고친다.
- [ ] 구형 기대값의 기존 테스트가 수정 없이 통과하는지 `git diff test/`로 확인한다. 추가만 있어야 한다.
- [ ] `npm run build` 뒤 `node --test test/finalize-pure.test.js test/intent-provenance.test.js test/terminal-intent-provenance.test.js test/intent-bundle.test.js test/finalize-digest.test.js test/context-ontology.test.js test/verification-runner.test.js test/commit-task.test.js`가 통과한다.
