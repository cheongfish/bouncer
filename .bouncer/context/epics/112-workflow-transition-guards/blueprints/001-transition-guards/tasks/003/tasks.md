---
type: bouncer.tasks
title: 재준비 전 worker 변경 보존 추가
description: Make prepare preserve uncommitted changes and unintegrated commits of a revoked worker before removing it.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - lease
  - salvage
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: TASKS-003
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-002
  parallel_safe: false
  dependency_gate: integrated
  verify: node --test test/coordinator.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/coordinator.ts
    - test/coordinator.test.js
    - agents/bouncer-coordinator.md
    - rules/cli.md
    - .codex/agents/bouncer-coordinator.toml
  commit_intent:
    - revoke 뒤 prepare가 이전 worker를 강제 삭제해 복구할 수 있는 미커밋 수정이 조용히 사라지던 문제를 막음.
  commit_summary:
    - prepare가 worker를 지우기 전에 미커밋 diff를 patch로, 미통합 커밋을 salvage ref로 보존하고 출력과 ledger에 그 위치를 남김.
  commit_sha: 64f2e28e
  scope_revision: r2
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
revoke된 worker를 `prepare`가 다시 만들 때, 지우기 전에 미커밋 변경과 미통합 커밋을 보존한다. 보존 위치는 출력과 ledger에 남긴다. 보존에 실패하면 아무것도 지우지 않는다. 수용 기준은 epic Success criteria 6이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `revokeLease`(`scripts/src/lib/lease.ts:91-121`)는 ledger만 바꾼다. lease를 `revoked`로 두고 `dispatch`·`sha`를 지우고 상태를 `pending`으로 되돌린다. 레거시 task는 generation이 `null`이다(`:101`).
- `prepareCoordinator`(`scripts/src/lib/coordinator.ts:2358`)는 세 단계로 실행된다.
  - phase 1(lock 안, `:2367-2499`): `shouldRemoveRevokedWorker`(`:2238`)가 참이면 `removeRevokedWorker`(`:2211-2229`)를 부른다. 이 함수는 `git worktree remove --force` → `git branch -D`를 실행하고 오류를 삼킨다. dirty 검사·경고·보존은 없다. phase 1은 ledger를 쓰지 않는다(`:2366`).
  - phase 2(`:2517-2558`): `worktree add -b <branch> <worker> HEAD`와 seed.
  - phase 3(`:2562-2607`): `issueLease`, `writeOwnedLedger`, `withCheckpoint` 출력.
- 의도된 폐기라는 설명은 코드 주석에만 있다(`:2205-2206`, `:2442-2445`, 테스트 `:2573`). 문서(`agents/bouncer-coordinator.md:112-114`, `rules/cli.md:354-355`)는 "현재 integration HEAD에서 새로 자른 worker"라고만 쓴다.
- `removeUnreferencedCreatedWorkers`(`:2296-2315`)는 같은 호출에서 방금 만든 seed-only worker만 지운다. 사용자 작업이 없다.
- patch 생성 선례: `coordinator.ts:1725-1740`. `git diff --binary HEAD`에 미추적 파일마다 `git diff --no-index --binary -- /dev/null <rel>`(exit 1을 성공으로 처리)를 더한다. 파일 산출 선례는 integration `.bouncer/runtime/light-promoted.patch`(`:1682`)다.
- `.bouncer/runtime/`는 `.gitignore`와 `RUNTIME_ARTIFACTS`(`scripts/src/lib/scope.ts:41`)에서 제외된다. 다만 테스트 fixture(`test/coordinator.test.js:49-56`)에는 `.gitignore`가 없다. promotion의 미추적 수집(`coordinator.ts:1699-1704`)은 ledger와 lock만 뺀다.
- prepare 출력은 `compactCoordinateOutput`(`scripts/src/lib/coordinate-output.ts:29-42`)을 거친다. 이 함수는 알 수 없는 top-level key를 보존한다.
- 관찰된 사례(blueprint 111/002 ledger, 읽기 전용): revoke #16 뒤 dispatch #18의 `initial_worktree_state`가 깨끗했다. lint 수정 세 파일이 사라졌고 다시 적용해야 했다.
- 테스트: `test/coordinator.test.js:2483`(revoke → prepare gen 2, 이전 커밋이 새 HEAD의 조상이 아님)과 `:2575`(legacy revoke)가 폐기를 정상으로 단언한다.

## Target behavior
- 성공(보존 대상 있음):
  - phase 1에서 삭제 전에, worker가 dirty(추적 변경 또는 미추적 파일)하면 patch를 쓴다. 위치는 integration `.bouncer/runtime/salvage/<task>-g<gen>-<short>.patch`다.
  - worker branch에 `ledger.integrationHead`에 없는 커밋이 있으면 `refs/bouncer/salvage/<task>/g<gen>-<short>`를 만든다.
  - `<gen>`은 revoke된 lease generation(없으면 `0`), `<short>`는 worker HEAD 앞 8자다.
  - 그다음 기존처럼 worktree와 branch를 지우고 재준비한다.
  - phase 3에서 ledger에 `worker-salvage` decision(`task`, `generation`, `head`, `patch`, `ref`, `dirty_paths`)을 append한다. 출력에는 `salvage: [{ task, patch, ref }]`를 싣는다.
- 성공(보존 대상 없음): 깨끗하고 미통합 커밋이 없는 worker는 지금과 같이 처리한다. 산출물·decision·`salvage` 키가 없다.
- 실패:
  - patch 쓰기나 ref 생성이 실패하면 → `worker-salvage-failed`(exit 1). worktree·branch·ledger를 바꾸지 않는다. patch를 쓴 뒤 ref 생성이 실패한 경우 그 patch는 지우지 않는다. 출력 `salvage`에 `patch`만 싣는다(blueprint Contract의 salvage 예외).
  - 같은 이름의 ref가 같은 커밋을 가리키면 no-op으로 성공한다. 다른 커밋을 가리키면 `worker-salvage-failed`로 멈춘다(덮어쓰지 않음).
- 보존:
  - phase 3이 stale·unassigned로 실패해도 patch와 ref는 남는다. 실패 출력에도 `salvage`를 싣는다.
  - revoke는 ledger 전용으로 유지한다. `removeUnreferencedCreatedWorkers`는 바꾸지 않는다. promotion의 미추적 수집은 `.bouncer/runtime/salvage/`를 제외한다.

## Interface
- 제공:
  - prepare 출력에 선택 키 `salvage`를 추가한다.
  - ledger decision kind `worker-salvage`를 추가한다.
  - 새 reason `worker-salvage-failed`의 `cause`·`next`: "patch·ref를 수동으로 확인하고 보고, worker는 그대로 남아 있다".
  - `신규 추출 지점: salvageRevokedWorker(exec, integrationPath, item, integrationHead) → { patch?: string, ref?: string, dirty_paths: string[] }`. 실패는 throw로 알리고 호출부가 reason으로 바꾼다.
- 거부: `worker-salvage-failed`. 사용법 변경은 없다.
- 용어:
  - "미통합 커밋"은 `git rev-list <integrationHead>..<branch>`가 1개 이상인 경우다. 예: worker가 커밋 `239c4129`를 가졌고 integration에 아직 없음.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `removeRevokedWorker`, `prepareCoordinator`, promotion 미추적 수집, hint 표 | Modify | revoke된 worker 강제 삭제와 재준비 | 삭제 전 보존, phase 3 decision, 출력 키, salvage 경로 제외, 새 hint | `:2211-2229`, `:2441-2452`, `:2562-2607`, `:1699-1704`, `:4609` |
| `test/coordinator.test.js` | revoke·prepare 테스트 | Modify | 폐기 동작 고정 | dirty·미통합 커밋 보존, 실패 시 무삭제, 재실행 no-op 케이스. `:2483`·`:2575`는 ref 보존을 추가로 단언 | `:2419`, `:2483`, `:2575`, `:1050` |
| `agents/bouncer-coordinator.md` | revoke·prepare 설명 | Modify | 재준비 설명 | 보존 위치와 확인 방법 | `:112-114`, `:255-256`, `:269` |
| `rules/cli.md` | coordinate prepare 출력·revoke 항목 | Modify | CLI 계약 | `salvage` 출력과 `worker-salvage-failed` | `:171-174`, `:354-355` |

## Do not touch
- `.worktrees/` — blueprint 111 실행 증적.
- `scripts/src/lib/lease.ts` — revoke는 ledger 전용으로 유지한다.
- `scripts/src/lib/coordinate-output.ts` — 알 수 없는 key를 이미 보존한다.
- `scripts/src/lib/drive-metrics.ts` — 예외 집계 변경은 범위 밖.

## Constraints
- 보존은 삭제보다 먼저 하고, 보존이 끝나기 전에는 Git 상태와 worker 파일을 바꾸지 않는다.
- phase 1의 ledger fence(`phase1Hash`)를 깨지 않는다. decision은 phase 3에서만 쓴다.
- patch는 `git apply --binary`로 원래 diff를 재현할 수 있어야 한다(테스트에서 확인).
- 깨끗한 worker의 재준비 결과(새 HEAD = integration HEAD, generation +1)는 지금과 같다.
- 새 reason은 hint 표에 등록한다.

## Checklist
- [ ] `npm run build`.
- [ ] 실패 테스트 작성: revoke된 worker에 미커밋 수정(` M`)과 미추적 파일을 두고 `prepare`를 실행한다. 출력 `salvage[0].patch` 파일이 존재해야 한다. 그 patch를 새 worker에 `git apply --binary`하면 원래 파일 내용이 돌아와야 한다. ledger에 `worker-salvage` decision이 하나 있어야 한다.
- [ ] 실패 테스트 작성: worker에 미통합 커밋이 있으면 `git rev-parse refs/bouncer/salvage/<task>/g1-<short>`가 그 커밋이다.
- [ ] 위 테스트가 patch·ref 부재로 실패하는지 확인한다.
- [ ] `salvageRevokedWorker`를 구현하고 phase 1의 `removeRevokedWorker` 호출 앞에 둔다. 결과를 phase 3까지 전달한다.
- [ ] ref 생성을 injected exec로 실패시키면 `worker-salvage-failed`가 나오고, worker 경로·branch·ledger 바이트가 같다.
- [ ] 같은 tip 재보존 no-op 테스트, 다른 커밋을 가리키는 ref 충돌 거절 테스트.
- [ ] 깨끗한 worker 테스트(`salvage` 키 없음, decision 없음).
- [ ] 문서 2개를 반영한 뒤 `npm run lint:docs`.
- [ ] 완료 명령: `node --test test/coordinator.test.js`.
