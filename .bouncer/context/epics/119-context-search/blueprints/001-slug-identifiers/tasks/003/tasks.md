---
type: bouncer.tasks
title: slug 형식 실행 키 적용
description: Derive pointer keys, approval paths, branches, worktrees and coordinator keys from slug identifiers while old-format paths keep numeric names
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - runtime-state
  - worktree
  - branch
timestamp: '2026-10-20T17:07:45.272+09:00'
bouncer:
  id: TASKS-003
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-001
  parallel_safe: true
  dependency_gate: integrated
  review_risk: []
  verify: node --test test/runtime-state.test.js test/coordinator.test.js
  affected_paths:
    - scripts/src/lib/runtime-state.ts
    - scripts/src/lib/coordinator-commands.ts
    - test/runtime-state.test.js
    - test/coordinator.test.js
  commit_intent:
    - slug blueprint를 drive하려면 pointer·승인·브랜치·worktree 키가 번호 없이도 만들어져야 함.
  commit_summary:
    - 실행 키를 resolver로 만들어 slug 경로에서는 slug 키와 이중 하이픈 브랜치를, 구형 경로에서는 기존 번호 키를 씀.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
slug blueprint 경로에서 pointer 키, pointer·승인 파일 경로, 통합·worker 브랜치, worktree·원장 경로, coordinator lease·scope 키를 slug로 만든다. 구형 경로는 기존 번호 이름을 그대로 쓴다. 그래서 진행 중인 구형 drive는 옛 이름으로 끝난다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- `scripts/src/lib/runtime-state.ts`:
  - `branchNamesFor`(:116-140): 통합 브랜치는 `${commitType}/${epicId}-${blueprintId}-${slug}`(:132), worker 브랜치는 `bouncer/${epicId}-${blueprintId}-${task}`(:134)다. 이름 검증(:135-138)은 `..`·공백·`~^:?*\[]`만 막는다.
  - `pointerKeyFromBlueprint`(:619-626)는 `parsePathIds` 결과로 `${epicId}/${blueprintId}`를 만들고, 없으면 throw한다.
  - `namespacePointerPath`(:631-638)는 `<pointersRoot>/<epic>/<bp>.json`이다. `parsePointerKey`(:640-645)는 `^(\d{3})\/(\d{3})$`만 받는다.
  - `listNamespacePointers`(:704-)는 디렉터리 `^\d{3}$`, 파일 `^(\d{3})\.json$`만 보고 그 밖의 것은 소리 없이 건너뛴다.
  - `approvalSnapshotPathFor`(:849-862)는 `pointerKeyFromBlueprint`로 `<approvalsRoot>/<epic>/<bp>`를 만든다.
  - `worktreePathFor`(:980-1011)는 중첩 `.worktrees/<epic>/<bp>`를 쓰고, 평면 `.worktrees/<bp>`만 있으면 그것을 재사용한다(:1006-1010).
  - `coordinatorPathsFor`(:1033-1055)는 `<root>/<epic>/<bp>/{integration,fanin,workers/<NNN>}`과 integration 아래 원장 파일(:1046)을 만든다.
  - 루트는 `pointersRoot`·`approvalsRoot`(:515-518, git common dir 아래 `bouncer/`)와 `worktreeRoot = <mainRoot>/.worktrees`(:519)다.
- `scripts/src/lib/coordinator-commands.ts`:
  - :1347이 repair용 epic·bp id를 `epics\/(\d{3})[^/]*\/blueprints\/(\d{3})` 정규식으로 직접 뽑는다.
  - lease·scope 키를 `EPIC-${epicId}/BP-${blueprintId}:supplement:${head}`(:860), `…:${headForKey}`(:3049), `…:wave:${candidateHead}`(:3804)로 조립한다.
  - `branchNamesFor` 호출부는 :2632, :2726, :2740, :4047, :4062다.
- task 번호 검사(`coordinator-commands.ts:959,1016,2927,4390,4547,4607,4671`, `runtime-state.ts:1022`)는 `^\d{3}$`이고 바뀌지 않는다.
- 재현: `npm run build && node --test test/runtime-state.test.js test/coordinator.test.js`가 현재 통과한다.

## Target behavior
- 성공 (slug 경로 `.bouncer/context/epics/plan-workflow/blueprints/registry-gates`, `commit_type: feat`):
  - pointer 키는 `plan-workflow/registry-gates`, 파일은 `<pointersRoot>/plan-workflow/registry-gates.json`이다.
  - 승인 경로는 `<approvalsRoot>/plan-workflow/registry-gates`다.
  - 통합 브랜치는 `feat/plan-workflow--registry-gates`, worker 브랜치는 `bouncer/plan-workflow--registry-gates--002`다.
  - worktree는 `.worktrees/plan-workflow/registry-gates/integration`, `…/workers/002`이고 원장은 그 integration 아래 같은 상대 경로에 둔다.
  - lease·scope 키는 `plan-workflow/registry-gates:wave:<head>`처럼 `formatStableIntentId` 값을 접두로 쓴다.
  - `listNamespacePointers`는 구형(`114/003.json`)과 slug(`plan-workflow/registry-gates.json`) pointer를 모두 나열한다. 기존 정렬 규칙은 유지한다.
  - repair 경로(:1347)는 `parseContextPath`로 두 형식을 모두 해석한다.
- 실패:
  - 해석할 수 없는 blueprint 경로는 지금처럼 `Cannot derive epic/blueprint ids` 오류를 낸다.
  - 브랜치 이름 검증이 실패하는 경우도 지금처럼 거절한다.
  - slug 규칙이 `--`·`.`·숫자만 slug를 막으므로 `--` 분해가 모호해지는 경우는 생기지 않는다.
- 보존:
  - 구형 경로의 pointer 키·파일 경로·승인 경로·브랜치·worktree·원장 경로·lease 키는 바이트까지 같다.
  - 평면 worktree fallback(:1006-1010)은 구형 경로에서만 그대로 동작한다.

## Interface
- 제공: `pointerKeyFromBlueprint(bp)` → `{ epicId, blueprintId, key }`. 반환 모양은 그대로이고, 값은 형식별 키(번호 또는 slug)다.
- 제공: `parsePointerKey(key)`는 `context-ids.parsePointerKey`에 위임해 두 형식을 받는다.
- 제공: `branchNamesFor({ repoRoot, blueprint, task? })` → `{ integration, standalone, worker? }`(시그니처 유지). slug 형식이면 구분자 `--`를 쓰고 bp slug 뒤에 다시 slug를 붙이지 않는다. 구형은 `${commitType}/${epic}-${bp}-${slug}`를 유지한다.
- 거부(throw): 경로 해석 실패(기존 메시지 유지), 브랜치 이름 검증 실패.
- 거부(조용히 건너뜀, 기존과 동일한 성격): pointer 디렉터리·파일 이름이 어느 형식에도 맞지 않는 경우.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/runtime-state.ts` | `branchNamesFor`, `pointerKeyFromBlueprint`, `parsePointerKey`, `listNamespacePointers`, `approvalSnapshotPathFor`, `worktreePathFor`, `coordinatorPathsFor` | Modify | 번호 실행 키 | 형식별 키 | `runtime-state.ts:116-140,619-645,704,849-862,980-1055` |
| `scripts/src/lib/coordinator-commands.ts` | repair id 추출, lease·scope 키 | Modify | 번호 정규식·`EPIC-${…}` 조립 | resolver 사용 | `coordinator-commands.ts:860,1347,3049,3804` |
| `test/runtime-state.test.js` | — | Modify | 실행 키 테스트 | slug 키·브랜치·worktree·pointer 목록 사례 | 수용 기준 3 |
| `test/coordinator.test.js` | — | Modify | coordinator 테스트 | slug lease 키·repair 경로 사례 | 수용 기준 3 |

## Do not touch
- `scripts/src/lib/current.ts` — pointer 키 파싱의 current 쪽은 TASKS-002 소관이다.
- `scripts/src/lib/verification.ts`, `scripts/src/lib/commit-sha.ts` — 추적 키는 TASKS-004 소관이다.
- `scripts/src/lib/context-ids.ts` — 소비만 한다.
- `.worktrees/` — 실제 worktree를 만들거나 옮기지 않는다.

## Constraints
- 구형 경로의 모든 키는 바이트까지 동일해야 한다. 진행 중인 drive가 옛 이름으로 끝나야 하기 때문이다(결정 8).
- 통합 브랜치 접두는 `commit_type`을 유지한다(답변 11).
- 숫자 정규식을 새로 쓰지 않는다. task 번호 `^\d{3}$` 검사는 그대로 둔다.

## Checklist
- [ ] `test/runtime-state.test.js`에 slug 경로의 pointer 키·파일·승인 경로·브랜치·worktree·원장 경로 기대값과 혼합 pointer 목록 사례를 추가한다. 기대 red: `pointerKeyFromBlueprint`가 `Cannot derive epic/blueprint ids from blueprint path`로 throw한다.
  ```js
  // SLUG_BP의 index.md는 commit_type: feat
  assert.deepStrictEqual(branchNamesFor({ repoRoot: repo, blueprint: SLUG_BP, task: '002' }), {
    integration: 'feat/plan-workflow--registry-gates',
    standalone: 'feat/plan-workflow--registry-gates',
    worker: 'bouncer/plan-workflow--registry-gates--002',
  });
  ```
- [ ] `test/coordinator.test.js`에 slug blueprint lease 키(`plan-workflow/registry-gates:wave:`)와 repair 경로 사례를 추가하고 실패를 확인한다.
- [ ] `runtime-state.ts`와 `coordinator-commands.ts`를 resolver 기반으로 바꾼다.
- [ ] 구형 기대값을 담은 기존 테스트가 수정 없이 통과하는지 `git diff test/`로 확인한다. 추가만 있어야 한다.
- [ ] `npm run build` 뒤 `node --test test/runtime-state.test.js test/coordinator.test.js`가 통과한다.
