---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T17:23:11.929+09:00'
bouncer:
  id: EXPLAIN-011
  epic_id: '018'
  blueprint_id: '011'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 097bca2b72ede5415e5cddc26de2ddcda8b7e649
      diff_sha: dfc4dbcffc87ec490178543a3f37d4426ee55d2140affc73b1fae2efa06bf2d5
      quiz_score: skipped
      disposition: Backfilled for G16 — task closed before /bouncer-commit explain flow existed.
      recorded_at: '2026-08-07T17:27:07+09:00'
    - task: '002'
      range_from: 097bca2b72ede5415e5cddc26de2ddcda8b7e649
      range_to: a7aadf3d5347c02ec754253b1e0802d63f6522e4
      diff_sha: ffbf23591c4519241e0f024a52b5a569086d883baf110de919cc518bef9ff21e
      quiz_score: skipped
      disposition: Backfilled for G16 — task closed before /bouncer-commit explain flow existed.
      recorded_at: '2026-08-07T17:27:07+09:00'
    - task: '003'
      range_from: a7aadf3d5347c02ec754253b1e0802d63f6522e4
      range_to: a664edd04e5112d869e06974c07c2fe1ec5f2357
      diff_sha: 854068a8a66cd7998af70863226d4eb78889250b8fbd6fdba54fd225a88eb603
      quiz_score: skipped
      disposition: Backfilled for G16 — task closed before /bouncer-commit explain flow existed.
      recorded_at: '2026-08-07T17:27:07+09:00'
    - task: '004'
      range_from: a664edd04e5112d869e06974c07c2fe1ec5f2357
      range_to: 918450acc2253f7fa6ceba7f4ac5bb042ba0ff9b
      diff_sha: a187d816f2e06d0701d27259ab2b45e938c5ac5c94d3d26fe67592608151e036
      quiz_score: skipped
      disposition: Backfilled for G16 — task closed before /bouncer-commit explain flow existed.
      recorded_at: '2026-08-07T17:27:07+09:00'
    - task: '005'
      range_from: develop
      range_to: 918450acc2253f7fa6ceba7f4ac5bb042ba0ff9b
      diff_sha: 387a02b62da6df55f54f89789eae68aa25b2f3f7d299065e960d3dc2585f81e1
      quiz_score: '3/4'
      disposition: Q2를 range_from..range_to로 골랐음. G15는 range_to를 쓰지 않고 range_from..HEAD를 봄.
      recorded_at: '2026-08-07T17:25:43+09:00'
---
# Explain

## Background
`finalize` 한 번에 task 커밋·이해 기록·PR·worktree 정리를 몰아넣으면, task가
늘수록 subject는 blueprint `title`로 반복되고 `explain.md` comprehension 한
벌이 서로 덮인다. `base..HEAD` 해시도 task마다 어긋난다.

이 blueprint는 커밋 단위를 task로 두고, `bouncer commit`(게이트 `commit` /
G15)과 `bouncer finalize`(게이트 `finalize` / G16)를 나눈다. execute는 구현·
검증·리뷰만 하고 커밋하지 않는다.

## Intuition
한 PR(blueprint) 안에 task마다 커밋 하나씩 — 마감(finalize)은 PR과 정리만.

## Code
- `scripts/src/lib/commit.ts` — `commitTask` (dry-run / `--yes`, `nextTask` 후보만)
- `scripts/src/lib/finalize.ts` — `buildCommitMessage`(task title·intent),
  `buildFinalizeCommitMessage`(blueprint title·intent), `finalize`는 스테이징
  없이 마감 판정
- `scripts/src/lib/comprehension.ts` — `comprehension` 배열 엔트리,
  `computeDiffSha`(`range_from..HEAD`, `.bouncer/context/` 제외)
- `scripts/src/lib/validate.ts` — G15=`commit`, G16=`finalize`
- `skills/bouncer-commit/SKILL.md` — task 마감 워크플로; execute/finalize 스킬은
  커밋·퀴즈를 넘기지 않도록 맞춤

## Quiz
1. task 하나를 닫는 CLI/게이트 쌍으로 맞는 것은?
   - A) `bouncer finalize` / 게이트 `finalize`
   - B) `bouncer commit` / 게이트 `commit`
   - C) `bouncer verify` / 게이트 `execute`

2. G15가 보는 `diff_sha` 범위는?
   - A) 엔트리 `range_from`..`HEAD` (`.bouncer/context/` 제외)
   - B) 포인터 `base`..`HEAD` 고정
   - C) 엔트리 `range_from`..`range_to`만

3. `/bouncer-execute`가 끝난 뒤 커밋은 누가 하나?
   - A) `/bouncer-commit` (또는 `bouncer commit`)이 task 커밋을 맡음
   - B) execute 컨트롤러가 `git commit`으로 바로 닫음
   - C) `/bouncer-finalize`만 커밋하고 execute는 증거를 남기지 않음

4. `explain.md` `bouncer.comprehension` 형식은?
   - A) task마다 덮어쓰는 단일 객체
   - B) epic 단위로 하나만 두는 문자열
   - C) task 번호 엔트리를 append하는 배열

## 이해 상태
- 점수: 3/4 (task 005 quiz)
- 응답: 1B 2C 3A 4C
- 정답: 1B 2A 3A 4C
- 채점: 1○ 2✗ 3○ 4○
- disposition: Q2를 range_from..range_to로 골랐음. G15는 range_to를 쓰지 않고
  range_from..HEAD를 봄.
- 엔트리: task `005` quiz 기록. task `001`–`004`는 `/bouncer-commit` 이전
  마감분이라 G16용으로 disposition `Backfilled for G16` 엔트리를 앞에 둠.
