---
type: bouncer.explain
title: execute 게이트를 포인터 task 묶음으로 좁힘
description: Explain for TASKS-002
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T11:14:36+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '020'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: '75a3d75a77d336567df039ba0c51176e5ca049848e43af8c0777f770136af283'
    quiz_score: '1/3'
    disposition: '퀴즈 3문항 중 1정답. Q1·Q2 오답, Q3 정답. 마감 진행.'
    recorded_at: '2026-08-07T11:14:36+09:00'
---
# Explain

## Background

001에서 task마다 `tasks/<NNN>/` 서류 철을 만들 수 있게 됐지만, execute 게이트는
여전히 blueprint 루트의 `tasks`·`verification`·`review` 한 벌만 봤다. 같은
blueprint에 draft 묶음이 있으면 지금 커밋할 묶음의 G6–G8이 막혔고, verify 증적도
루트 `verification.md`에만 쌓였다.

이번 커밋은 `loadBlueprintDocs`가 `taskUnits`를 돌리고, execute·verify·finalize
bullet이 포인터가 가리킨 묶음만 쓰게 한다. plan 게이트(G3–G5·G10–G12)는 모든
묶음에 그대로 걸린다. 같이, 앞 task가 `verified`여도 next-task `--set`이 되도록
G3를 `ready`|`in_progress`|`verified`로 완화했다.

## Intuition

여러 서류 철 중 손에 든 철만 검사한다. 옆 철이 미완이어도 지금 철의 통과·반려를
정한다.

## Code

- `scripts/src/lib/validate.ts` — `docs.taskUnits`, `resolveTaskUnit`(019
  `entriesForVerify` 재사용), execute G6–G8·G13·G14의 `file`을 묶음 경로로,
  plan G3 상태 허용, 고아 루트 verification/review 구조 검사.
- `scripts/src/lib/verification.ts` — `recordVerificationResult({ verificationRel })`,
  `runVerification`이 대상 묶음 `verification.md`에만 기록. 없으면
  `VERIFY_DOCUMENT_MISSING`이고 파일을 만들지 않음.
- `scripts/src/lib/finalize.ts` — 커밋 bullet title을 `resolveTaskUnit` 대상
  묶음의 tasks/verification `title`에서 읽음.

## Quiz

**Q1.** 포인터가 `tasks/001/tasks.md`를 가리키고 `tasks/002/`가 draft일 때
execute 게이트는?

- A) 002가 draft라 blueprint 전체가 실패한다
- B) 001 묶음만 G6–G8·G13·G14를 판정한다
- C) plan 게이트처럼 모든 묶음을 검사한다

**Q2.** 포인터가 `tasks/002`인데 `tasks/002/verification.md`가 없으면?

- A) 루트 `verification.md`에 증적을 쓴다
- B) `tasks/001/verification.md`로 폴백한다
- C) `VERIFY_DOCUMENT_MISSING`이고 새 파일을 만들지 않는다

**Q3.** plan 게이트 G3가 허용하는 task `status`는?

- A) `ready`만
- B) `ready` · `in_progress` · `verified`
- C) `draft` · `ready` · `verified`

## 이해 상태

- 정답: Q1=B, Q2=C, Q3=B
- 응답: Q1=C, Q2=B, Q3=B
- 채점: 1/3
  - Q1 오답 — execute는 포인터 묶음만 본다(plan이 전 묶음).
  - Q2 오답 — 대상 묶음에 verification이 없으면 `VERIFY_DOCUMENT_MISSING`,
    루트/형제로 폴백하지 않음.
  - Q3 정답 — G3는 `ready`|`in_progress`|`verified` (draft만 실패).
- disposition: 퀴즈 3문항 중 1정답. 마감 진행.
- diff_sha: 75a3d75a77d336567df039ba0c51176e5ca049848e43af8c0777f770136af283
- recorded_at: 2026-08-07T11:14:36+09:00
