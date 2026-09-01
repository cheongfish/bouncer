---
type: bouncer.explain
title: 활성 포인터에 task 필드를 넣고 검증·커밋 경로를 좁힘
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T09:29:43.374+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '018'
  blueprint_id: '009'
  status: published
  comprehension:
    diff_sha: '24bc953dcf924de0c296fe3d2e074379919fd3bfaf8b8346f8df9c322abbd3f5'
    quiz_score: '1/3'
    disposition: '퀴즈 3문항 중 1정답. Q1·Q2 오답(포인터 path vs CLI 객체, verify 좁히기), Q3 정답. 마감 진행.'
    recorded_at: '2026-08-07T09:30:50+09:00'
---
# Explain

## Background

`listTasksDocs`가 task 문서를 여러 개 돌려도 포인터는 blueprint까지만 가리켰다.
그래서 검증 명령은 번호가 앞선 선언을, 커밋 허용 경로는 전 문서 합집합을 썼다.
어느 task를 작업 중인지 포인터에 없고, 두 소비자는 "포인터가 생기면 좁힌다"는
임시 규칙으로 남아 있었다.

이 변경은 포인터에 `task`(문서 상대 경로)를 넣고, 그 값이 있을 때
`readVerifyCommand`와 `readAffectedPaths`가 해당 문서만 보게 한다.
`task`가 없는 기존 포인터는 이전과 같다. CLI는 `bouncer current --task`로
고르거나, `--set`만 주면 열린 task 중 번호 순 첫 문서를 고른다.

## Intuition

책갈피에 책만 꽂혀 있던 자리에 "몇 장째"를 적는다. 적혀 있으면 그 장만 보고,
비어 있으면 예전처럼 전체를 훑는다.

## Code

읽기 순서:

1. `scripts/src/lib/runtime-state.ts` — 포인터 JSON의 `task` 읽기/쓰기.
   문자열만 채택, 없으면 `null`.
2. `scripts/src/lib/current.ts` — `resolvePointerTask`(NNN / `TASKS-NNN` /
   자동 선택), `presentCurrent`(CLI 응답용 `{ path, id }`),
   `listReadyBlueprints`의 열린 task 목록.
3. `scripts/src/lib/cli.ts` — `cmdCurrent`의 `--task` 거부와 출력.
4. `scripts/src/lib/verification.ts` / `commit-hook.ts` — 포인터 task가 있으면
   그 문서만, 없으면 기존 폴백.
5. `skills/bouncer-execute/SKILL.md` — 브리프는 `current.task.path`.
6. `skills/bouncer-finalize/SKILL.md` — 같은 blueprint의 남은 열린 task를
   다음 blueprint보다 먼저 확인.

포인터 파일은 path 문자열만 둔다. id는 CLI 출력에서만 붙인다.

## Quiz

**Q1.** 포인터 파일에 저장되는 `task` 값은?

- A) `{ path, id }` 객체
- B) task 문서의 저장소 상대 경로 문자열 (또는 키 부재)
- C) `TASKS-NNN` id 문자열만

**Q2.** 포인터가 `tasks-002.md`를 가리키고 `bouncer.verify`는 `001`에만 있을 때
`readVerifyCommand`는?

- A) `001`의 선언을 쓴다
- B) `config.verify`로 떨어진다 (또는 선언 부재 취급)
- C) 합집합처럼 첫 선언을 무조건 고른다

**Q3.** `/bouncer-execute`가 `bouncer current` 응답에서 브리프로 쓰는 값은?

- A) `current.task` 전체 객체
- B) `current.task.id`
- C) `current.task.path` (`task`가 null이면 리졸버 폴백)

## 이해 상태

- 점수: `1/3`
- disposition: 퀴즈 3문항 중 1정답. Q1·Q2 오답(포인터 path vs CLI 객체, verify 좁히기), Q3 정답. 마감 진행.
- recorded_at: `2026-08-07T09:30:50+09:00`
- diff_sha: `24bc953dcf924de0c296fe3d2e074379919fd3bfaf8b8346f8df9c322abbd3f5`

| 문항 | 정답 | 응답 | 결과 |
| --- | --- | --- | --- |
| Q1 | B | A | 오답 |
| Q2 | B | A | 오답 |
| Q3 | C | C | 정답 |
