---
type: bouncer.explain
title: task 문서 배치를 tasks/<NNN>/ 묶음으로 하드컷
description: Explain for TASKS-004
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T13:40:00+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '020'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: 'b038b573f391c17fa00914dca0783e9e98a7435f43a15f3ed76eb11da69c6e6b'
    quiz_score: '2/2'
    disposition: '퀴즈 2문항 정답. 도구·apply·하드컷을 한 커밋에 묶는 이유와 묶음 id가 디렉터리 번호에서 나온다는 점을 이해함.'
    recorded_at: '2026-08-07T13:45:00+09:00'
---
# Explain

## Background

001~003에서 새 배치를 읽고 쓰고 판정하는 쪽은 다 갖췄지만, 저장소에는 여전히
blueprint 루트의 `tasks.md`·`tasks-<NNN>.md`와 한 벌뿐인 `verification.md`·
`review.md`가 남아 있었다. 리졸버가 두 배치를 동시에 이해하는 동안에는 어느
쪽이 정본인지 코드에도 문서에도 답이 없었다.

이번 변경은 옮기는 도구와 옛 배치를 거절하는 규칙을 한 커밋에 넣는다. 둘을
갈라놓으면 그 사이 커밋에서 이 저장소가 자기 문서에 validate 실패한다. 도구를
만들고, 001~020 트리에 실제로 돌리고, 그 다음부터 구 배치를 구조 실패로
거절하는 순서가 한 번에 일어나야 한다.

## Intuition

서류철을 새 캐비닛으로 옮기는 일이다. 옮기는 사람과 "옛 캐비닛은 이제 없는
것으로 친다"는 공지를 따로 보내면, 그 사이에 서류를 찾는 사람이 빈손으로
돌아온다. 이사와 공지를 같은 날 한다.

옮길 때 서류 겉면의 번호도 새 칸 번호에 맞춰 고쳐야 한다. 002번 캐비닛에서
나온 서류라도 새 캐비닛의 001번 칸에 들어가면 겉면은 001이어야 한다.

## Code

- `scripts/src/lib/migrate-task-layout.ts` — 계획(`planTaskLayout`),
  거절 조건(`validateTaskLayout`), 적용을 나눠 담는다. 이동은 `git mv`,
  frontmatter는 `resource`와 묶음 id를 새 경로에서 다시 유도한다. 짝이 없는
  묶음에는 `pending` 증적을 새로 만든다.
- `scripts/src/lib/migrate-ids.ts` — `isWorktreeDirty`·`walkMarkdownFiles`만
  export한다. id 마이그레이션의 동작은 그대로 두고 all-or-nothing 판정을
  재사용한다.
- `scripts/src/lib/tasks-docs.ts` — 구 배치를 묶음으로 세지 않는다. 잔존 파일은
  `legacyFiles` 목록으로만 보고하고, 거절은 validate가 한다.
- `scripts/src/lib/validate.ts` — `S15` 잔존 구 배치, `S16` 비정본 디렉터리 이름,
  `S17` 묶음 문서 누락. 혼재를 막던 `S14`는 결번이 됐다.
- `.bouncer/context/epics/**` — 위 도구를 이 저장소에 실제로 돌린 결과다.
  001~020의 task·verification·review가 `tasks/<NNN>/`로 옮겨졌다.
- `test/**` — fixture가 전부 새 배치를 쓴다. `migrate-task-layout.test.js`는
  dry-run·apply·dirty·혼재·경로 선점·포인터 재작성·id 재번호를 고정한다.

## Quiz

**Q1.** 도구와 하드컷을 한 커밋에 넣은 이유는 무엇인가?

- A) 커밋 수를 줄여 리뷰를 짧게 하려고
- B) 갈라놓으면 그 사이 커밋에서 이 저장소가 자기 문서에 validate 실패하므로
- C) `git mv`가 한 커밋 안에서만 rename으로 잡히므로

**Q2.** blueprint 002의 레거시 `verification.md`가 `tasks/001/`로 접힐 때
`bouncer.id`는 어떻게 되는가?

- A) `VERIFY-002` 그대로 — id는 blueprint에서 유도하므로
- B) `VERIFY-001` — 묶음 안의 id는 디렉터리 번호에서 나오므로
- C) 지우고 scaffold가 다시 채우도록 비운다

## 이해 상태

- 정답: Q1=B, Q2=B
- 응답: Q1=B, Q2=B
- 채점: 2/2 — 하드컷을 한 커밋에 묶는 이유와 묶음 id의 출처를 모두 맞혔다.
- disposition: 퀴즈 2문항 정답. 도구·apply·하드컷을 한 커밋에 묶는 이유와
  묶음 id가 디렉터리 번호에서 나온다는 점을 이해함.
- diff_sha: b038b573f391c17fa00914dca0783e9e98a7435f43a15f3ed76eb11da69c6e6b
- recorded_at: 2026-08-07T13:45:00+09:00
