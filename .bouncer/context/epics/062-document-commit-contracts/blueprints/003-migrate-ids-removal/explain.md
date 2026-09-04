---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T14:03:42.184+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '062'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: d0f04fff9442dcc63bb52f2a648df4bac90dfc40
      diff_sha: b15216240bbac072ff2f0bddd84da066c0712dca38b2bb3d33e994ebe00adebe
      quiz_score: 3/3
      disposition: 공개 이관 경로 제거와 dirty-worktree helper 이전을 정확히 이해함
      recorded_at: '2026-09-04T14:04:26+09:00'
  task_commits:
    - id: '001'
      sha: d0f04fff
---
# Explain

## Background
숫자 ID로 이미 옮긴 뒤에도 `bouncer migrate ids`, `migrate-ids` 스킬, SessionStart 레거시 경고가 남아 있었다. 공개 표면에서 그 경로를 지웠다. `migrate task-layout`과 `import-history`가 쓰던 dirty-worktree 거부는 `runtime-state`의 공용 helper로 옮겨 그대로 둔다.

## Intuition
이관 문은 닫고, 더러운 작업트리를 막는 자물쇠만 공용 열쇠고리로 옮긴다.

## Code
- 삭제: `scripts/src/lib/migrate-ids.ts`, `skills/migrate-ids/SKILL.md`, `hooks/session-legacy-ids.js`
- CLI: `scripts/src/lib/cli-project-commands.ts` — `migrate`는 `task-layout`만 받음
- 공용 dirty 판정: `scripts/src/lib/runtime-state.ts` → `isWorktreeDirty` (`migrate-task-layout`, `import-history`가 import)
- 경로: `scripts/src/lib/paths.ts`에서 `normalizeContextId` 제거
- 회귀: `test/plugin-wiring.test.js`, `test/skill-bouncer-surface.test.js`, `test/paths.test.js` 등

## Quiz
1. dirty-worktree 거부를 이제 어디서 소유하는가?
   - A) `migrate-ids.ts` (삭제된 모듈)
   - B) `runtime-state.ts`의 `isWorktreeDirty`
   - C) `validate-structural.ts`

2. `bouncer migrate ids`를 치면 어떻게 되는가?
   - A) 레거시 ID를 숫자 ID로 자동 변환한다
   - B) SessionStart 훅이 경고만 띄운다
   - C) `task-layout`이 아닌 kind로 거부된다 (unknown migrate kind)

3. 이 변경 뒤에도 유지되는 동작은?
   - A) `migrate task-layout` / `import-history`의 dirty-worktree 거부
   - B) SessionStart 레거시 ID 경고
   - C) `normalizeContextId`로 `EPIC-`/`BP-` prefix 제거

## 이해 상태
quiz_score: 3/3. 정답 B/C/A, 응답 1B 2C 3A — 모두 맞음. disposition: 공개 이관 경로 제거와 dirty-worktree helper 이전을 정확히 이해함.
