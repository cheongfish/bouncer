---
type: bouncer.explain
title: BP-001 explain
description: Explain for BP-001
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-001-id-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-05T17:53:06.483+09:00'
bouncer:
  id: EXPLAIN-BP-001
  epic_id: EPIC-014
  blueprint_id: BP-001
  status: published
  comprehension:
    diff_sha: a27f2069516839bb3a745dfe37ddd583fc825be52514e389206846feccb2542d
    quiz_score: 3/5
    disposition: >-
      accepted — Q1/Q2/Q5 correct; Q3 unknown (S5 fails on digit mismatch);
      Q4 missed S in TASKS-001
    recorded_at: '2026-08-05T17:56:30+09:00'
---
# Explain

## Background
에픽 디렉터리가 이미 `epics/` 아래인데 세그먼트·frontmatter에 `EPIC-`/`BP-`를
또 붙였다. `parsePathIds`·layout·S4/S5·scaffold·epic-index가 그 접두를
계약으로 고정해, 정본을 `\d{3}`로 바꾸려면 하네스를 먼저 풀어 줘야 했다.
이 커밋은 읽기 계약만 바꾼다. migrate CLI와 실트리 rename은 다음 BP다.

## Intuition
정본 id는 숫자 세 자리이고, 구형 접두는 읽기 때만 벗겨 비교한다.
scaffold는 접두 없는 경로만 새로 만든다.

## Code
- 파생·정규화: `paths.ts` — `parsePathIds`가 `(?:EPIC-)?(\d{3})` /
  `(?:BP-)?(\d{3})`에서 숫자만 내고, `normalizeContextId`가
  `EPIC-014`→`014`, `TASKS-BP-001`→`TASKS-001` (숫자 자체는 안 고침).
- 경로 판정: `layout.ts` canonical 정규식이 신형 `\d{3}-slug`와 전이
  `EPIC-`/`BP-` 세그먼트를 함께 허용. `epic-index.ts`도 같은 이유로 구형
  실디렉터리를 목록과 맞춘다.
- 스키마·검사: `schema.ts`에서 epic/bp `ID_PREFIX`를 `''`로 두고,
  `validate.ts` S4/S5가 정규화 후 비교. 자식 expectedId는 `TASKS-001` 형태.
- 생성·CLI: `scaffold.ts`·`cli.ts`는 `--id`에 `\d{3}`만 받고 신형 dir/메타만
  씀. `templates.ts`·skills·docs 예시도 숫자 정본으로 맞춤.

## Quiz
1. scaffold `--id EPIC-001`과 `--id 001` 중 어느 쪽이 성공하는가?
2. frontmatter `id: EPIC-014`가 경로 `epics/014-…`에 있을 때 S5는 통과하는가?
   통과한다면 왜인가?
3. 같은 경로에 `id: EPIC-013`이면 결과는?
4. 자식 문서 정본 id는 `TASKS-BP-001`인가 `TASKS-001`인가?
5. 이 BP가 migrate CLI나 `.bouncer/context/` 실트리 rename을 하는가?

## 이해 상태
퀴즈 3/5. Q1·Q2·Q5 맞음. Q3은 숫자 불일치면 S5 실패. Q4 정답은
`TASKS-001`(접두 `TASKS-`). disposition accepted.
