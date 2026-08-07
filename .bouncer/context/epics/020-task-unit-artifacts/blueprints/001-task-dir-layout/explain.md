---
type: bouncer.explain
title: task 묶음 리졸버와 새 레이아웃 스캐폴드
description: Explain for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T10:38:18.400+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '020'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: 'e3864fa6790549506e9f035202d7756d1a8609e8825981447a16b7d289e63c40'
    quiz_score: '2/3'
    disposition: '퀴즈 3문항 중 2정답. Q1 오답(dir vs tasks.rel), Q2·Q3 정답. 마감 진행.'
    recorded_at: '2026-08-07T10:39:36+09:00'
---
# Explain

## Background

한 blueprint에 task 문서가 여러 개여도 증적(`verification.md`)과 리뷰(`review.md`)는
blueprint 루트에 한 벌뿐이었다. 두 번째 task를 커밋하면 첫 증적이 덮이고, 리뷰가
어느 task를 보는지 흐려졌다.

이 커밋은 묶음 단위를 코드로 먼저 세운다. `listTasksDocs`가 `<bp>/tasks/<NNN>/`
아래 `tasks.md`·`verification.md`·`review.md`를 한 엔트리로 돌리고,
`scaffoldBlueprint` / `scaffoldTask`가 그 레이아웃으로 문서를 만든다.
구 레이아웃(루트 `tasks.md`·`tasks-<NNN>.md`)도 그대로 읽는다. 게이트 거절과
기존 트리 이동은 뒤 task가 맡는다.

## Intuition

task마다 서류 철을 하나씩 둔다. 예전에는 책상 위에 서류가 흩어져 있었고,
지금은 `tasks/001/` 폴더에 브리프·증적·리뷰가 같이 들어간다.

## Code

- `scripts/src/lib/tasks-docs.ts` — `listTasksDocs` 엔트리 모양
  (`dir` / `tasks`·`verification`·`review` / `invalidDirs`),
  `expectedTaskDocIds`, `TASK_DIR_RE`, `TASK_UNIT_BASENAMES`. basename·`\d{3}`
  판정은 여기만.
- `scripts/src/lib/paths.ts` — `tasks/<NNN>/{tasks,verification,review}.md` kind.
- `scripts/src/lib/scaffold.ts` — `scaffoldBlueprint` → `tasks/001/` 세 문서,
  `scaffoldTask`는 거절을 먼저 검사한 뒤 쓴다.
- `scripts/src/lib/cli.ts` — `bouncer scaffold task --blueprint --id`.
- `scripts/src/lib/templates.ts` — blueprint Documents 링크가 `tasks/001/…`.

## Quiz

**Q1.** 새 레이아웃 `<bp>/tasks/001/` 묶음을 `listTasksDocs`가 돌려줄 때
`entries[0].dir` 값은?

- A) `null` (레거시와 동일)
- B) `<bp>/tasks/001`
- C) `<bp>/tasks/001/tasks.md`

**Q2.** `tasks.md` / `verification.md` / `review.md` 문자열과 `\d{3}` 디렉터리
판정을 어디에 두어야 하는가?

- A) `scaffold.ts`와 `paths.ts`에 각각 하드코딩
- B) CLI usage 문자열에만
- C) `tasks-docs.ts` export (`TASK_UNIT_BASENAMES`, `TASK_DIR_RE` 등)만 사용

**Q3.** `scaffoldTask`에 이미 있는 `--id 002`를 다시 넘기면?

- A) 예외를 던지고 파일을 덮어쓰지 않는다
- B) 기존 파일을 갱신한 뒤 경로를 반환한다
- C) 경고만 하고 성공으로 끝낸다

## 이해 상태

- 정답: Q1=B, Q2=C, Q3=A
- 응답: Q1=C, Q2=C, Q3=A
- 채점: 2/3 (Q1 오답 — `dir`은 묶음 디렉터리 `<bp>/tasks/001`,
  `tasks.rel`이 `…/tasks.md`. Q2·Q3 정답)
- disposition: 퀴즈 3문항 중 2정답. 마감 진행.
- diff_sha: e3864fa6790549506e9f035202d7756d1a8609e8825981447a16b7d289e63c40
- recorded_at: 2026-08-07T10:39:36+09:00
