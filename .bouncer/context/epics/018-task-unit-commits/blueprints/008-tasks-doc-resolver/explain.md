---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/008-tasks-doc-resolver/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T08:47:06.784+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '018'
  blueprint_id: '008'
  status: published
  comprehension:
    diff_sha: 'ab4d4adb208a511ea65b4282b14e8e5c1527bd1296b625682c71056809a2a7f3'
    quiz_score: 1/3
    disposition: >-
      퀴즈 1/3. Q3(리뷰·PR=blueprint)만 맞음. 혼재→S14·verify 첫 선언은 오답.
    recorded_at: '2026-08-07T08:48:33+09:00'
---
# Explain

## Background

blueprint 하나마다 커밋 하나라는 규칙은, 성격이 다른 변경을 한 `tasks.md`에
몰아넣거나 리뷰 단위를 잘게 쪼개는 쪽으로 기울었다. 원인은 파일 이름이었다 —
스캐폴드·검증·포인터·커밋 훅·검증 명령 조회가 각자 `tasks.md`를 하드코딩해서,
이름을 바꾸려면 다섯 곳을 동시에 손대야 했다. 이름·id 규칙을
`tasks-docs` 한 모듈로 모으고, `tasks-001.md`처럼 번호 붙은 문서를 여러 개
둘 수 있게 했다. 이미 쌓인 `tasks.md` 하나만 있는 blueprint는 그대로 통과한다.

## Intuition

이름은 한 곳에서만 판정하고, 여러 task 문서는 번호 순으로 읽되 섞이면 거절한다.

## Code

- `scripts/src/lib/tasks-docs.ts` — `listTasksDocs`, `expectedTasksId`,
  `NUMBERED_TASKS_RE`. 레거시/`tasks-{ddd}.md`/혼재(`mixed`) 판정.
- `scripts/src/lib/validate.ts` — 모든 task 문서에 구조·plan 게이트 적용.
  혼재는 **S14**.
- `scripts/src/lib/current.ts` / `commit-hook.ts` — `affected_paths` **합집합**
  (task 포인터 전 임시 규칙).
- `scripts/src/lib/verification.ts` — `bouncer.verify`는 **번호가 앞선 선언**
  (같은 임시 규칙).
- `scripts/src/lib/scaffold.ts` — 새 blueprint는 `tasks-001.md` / `TASKS-001`.
- `CLAUDE.md` — 하드룰 2는 one commit per task; blueprint는 리뷰·PR 단위.

## Quiz

**Q1.** 한 blueprint 디렉터리에 `tasks.md`와 `tasks-001.md`가 같이 있으면?

- A) 번호 붙은 문서만 정본으로 쓰고 레거시는 무시한다
- B) 레거시 `tasks.md`만 정본으로 쓰고 번호 문서는 무시한다
- C) 어느 쪽이 정본인지 판정할 수 없어 구조 실패(S14)로 거절한다

**Q2.** `tasks-001.md`와 `tasks-003.md`가 서로 다른 `bouncer.verify`를 선언하면?

- A) 두 명령을 순서대로 모두 실행한다
- B) 번호가 앞선 문서(`tasks-001.md`)의 선언을 쓴다
- C) 항상 `config.verify`로 떨어진다

**Q3.** 이 변경 이후 리뷰·PR의 묶음 단위는?

- A) blueprint (커밋은 task 문서 단위)
- B) epic
- C) `affected_paths`의 파일 하나

## 이해 상태

- 점수: 1/3
- disposition: 퀴즈 1/3. Q3만 정답. 혼재→S14·verify 첫 선언은 오답.
- diff_sha: `ab4d4adb208a511ea65b4282b14e8e5c1527bd1296b625682c71056809a2a7f3`
- recorded_at: 2026-08-07T08:48:33+09:00

| # | 정답 | 응답 | 결과 |
| --- | --- | --- | --- |
| Q1 | C | A | 오답 |
| Q2 | B | A | 오답 |
| Q3 | A | A | 정답 |
