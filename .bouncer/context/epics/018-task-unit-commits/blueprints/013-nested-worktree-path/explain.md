---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-10T16:36:44.037+09:00'
bouncer:
  id: EXPLAIN-013
  epic_id: '018'
  blueprint_id: '013'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 5ee73de53625b00ea1b3a9dc051a2c04a87cff98
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '1/2'
      disposition: 'Q1 정답, Q2 오답(평면 재사용인데 이관으로 답함), Q3 미응답 → 분모에서 제외'
      recorded_at: '2026-08-10T16:39:03+09:00'
---
# Explain

## Background
execute worktree 경로는 예전엔 `ensureWorktreeRoot()`가 `.worktrees` 루트만
돌려주고, 스킬 두 곳이 `<bp-id>`를 각자 붙였다. blueprint id는 epic마다
`001`부터 다시 시작하므로 서로 다른 epic의 첫 blueprint가 같은 디렉터리를
요구했다. 이번 변경은 경로 규칙을 `worktreePathFor` 한곳으로 모으고
`.worktrees/<epic-id>/<bp-id>`로 중첩한다. 이미 열린 평면
`.worktrees/<bp-id>`는 옮기지 않고 그대로 재사용한다.

## Intuition
주소록을 성만 쓰던 서랍에서 성/이름 두 칸으로 바꾼다. 예전 서랍에 파일이
남아 있으면 그 칸을 그대로 쓰고, 둘 다 있으면 새 칸이 이긴다.

## Code
- `scripts/src/lib/runtime-state.ts` — `worktreePathFor({ repoRoot, blueprint,
  deps })`. `parsePathIds`로 epic/bp id를 뽑고, 중첩이 없고 평면만 디렉터리면
  평면을 돌려준다. `mkdir` 없음. `ensureWorktreeRoot` 삭제.
- `skills/bouncer-execute/SKILL.md` · `skills/bouncer-finalize/SKILL.md` —
  같은 one-liner로 `WORKTREE_PATH`를 얻고, finalize는 중첩 경로일 때만 빈
  epic 부모를 `rmdir`한다.
- 계약: `test/runtime-state.test.js`, `test/skill-bouncer-*.test.js`.
  문서: `docs/ARCHITECTURE.md`, `docs/context-versioning.md`.

## Quiz
1. `worktreePathFor`가 새로 돌려주는 기본 경로 형태는?
   - A) `.worktrees/<bp-id>`
   - B) `.worktrees/<epic-id>/<bp-id>`
   - C) `.bouncer/worktrees/<epic-id>/<bp-id>`

2. 중첩 경로가 없고 평면 `.worktrees/<bp-id>`만 디렉터리로 있으면?
   - A) 평면을 중첩 경로로 옮긴 뒤 중첩을 돌려준다
   - B) 에러를 던진다
   - C) 평면 경로를 그대로 돌려준다

3. finalize가 worktree를 지운 뒤 빈 epic 부모 `rmdir`은 언제 하나?
   - A) `WORKTREE_PATH`의 dirname이면 항상
   - B) 경로가 중첩일 때만 (grandparent basename이 `.worktrees`)
   - C) `--force`를 붙였을 때만

## 이해 상태
- 정답: 1B, 2C, 3B
- 응답: 1B (O), 2A (X — 옮기지 않고 평면을 그대로 씀), 3 미응답 (분모 제외)
- quiz_score: 1/2
- disposition: Q1 정답, Q2 오답(평면 재사용인데 이관으로 답함), Q3 미응답 → 분모에서 제외
