---
type: bouncer.explain
title: 020 explain
description: Explain for 020
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/020-completed-context-retention/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-03T10:54:54.195+09:00'
bouncer:
  id: EXPLAIN-020
  epic_id: '018'
  blueprint_id: '020'
  status: published
  comprehension:
    - range_from: develop
      range_to: b8176175fb648e302775bd7c0742a90e7f80ef5f
      diff_sha: 837ebae50ed1d568ff4a634b5d85865a81601df6537aaa4ebec184221baadcec
      quiz_score: '3/3'
      disposition: 삭제 목록·closed 축약·후속 경로를 모두 맞춤
      recorded_at: '2026-09-03T10:55:48+09:00'
---
# Explain

## Background

완료된 Blueprint에 task·review·context-review·verification이 그대로 남으면,
지금 시스템을 읽는 설명과 당시 실행 절차가 한 폴더에 섞인다. 이 변경은
`finalize --yes`가 G16과 사전 검증을 통과한 뒤 같은 remainder 커밋에서 그
일회성 문서를 지우고 Blueprint를 `closed`로 잠그게 한다. 장기로 남는 것은
`index.md`와 `explain.md`다. 후속 작업은 closed를 다시 열지 않고 sibling
Blueprint나 새 Epic으로 이어간다.

## Intuition

마감 스위치를 내리면 실행 서류는 치우고, 설명장(`explain.md`)만 책장에 남긴다.

## Code

- `scripts/src/lib/finalize.ts` — `collectTransientRels`가 `tasks.md`·
  `verification.md`·`review.md`와 (있을 때) `context-review.md`를 모아 삭제하고,
  stage/commit 실패 시 바이트와 `approved`를 복구한다.
- `scripts/src/lib/validate-docs.ts` — `requiredTaskLeaves('closed')`는 `[]`.
  열린 Blueprint만 세 leaf를 요구한다.
- `skills/bouncer-finalize/SKILL.md` — 삭제·보존 경계와 sibling/`/bouncer-plan`
  후속을 안내한다. 실제 삭제는 CLI가 한다.
- `docs/context-retention-and-epic-lifecycle.md` — 보존 표와 Epic·sibling 기준
  정본. `docs/workflow.md`·`docs/context-versioning.md`가 같은 목록을 가리킨다.
- 회귀: `test/finalize.test.js`, `test/validate-structural.test.js`,
  `test/skill-bouncer-finalize.test.js`.

## Quiz

1. `finalize --yes`가 G16·verify를 통과한 뒤 같은 remainder 커밋에서 지우는 문서는?
   - A) `explain.md`와 `index.md`
   - B) `tasks.md`, `verification.md`, `review.md`, 있을 때의 `context-review.md`
   - C) Distill 샤드 전체

2. `closed` Blueprint의 구조 검증(S17)은 task leaf를 어떻게 다루나?
   - A) `verification.md`만 필수
   - B) 세 leaf 모두 필수
   - C) 필수 leaf 없음(축약 허용)

3. closed Blueprint에 후속 작업이 생기면 어떻게 하나?
   - A) 같은 Blueprint를 다시 `approved`로 연다
   - B) sibling Blueprint 또는 새 Epic으로 계획한다
   - C) `scaffold task`로 closed 아래에 task를 붙인다

## 이해 상태

- 점수: 3/3
- Q1 정답 B / 응답 B — 맞음 (일회성 task leaf·context-review 삭제)
- Q2 정답 C / 응답 C — 맞음 (closed는 필수 leaf 없음)
- Q3 정답 B / 응답 B — 맞음 (sibling 또는 새 Epic)
- disposition: 삭제 목록·closed 축약·후속 경로를 모두 맞춤
