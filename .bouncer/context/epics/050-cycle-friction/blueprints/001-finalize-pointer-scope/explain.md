---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T12:20:59.805+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '050'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: afcd7ff40ca3e55eccdbfa21c5e42596dc79bf4f
      diff_sha: 4f3174504dc64724085cb52b61ba2145362366ea0c8aeca054e080215a4e076b
      quiz_score: '3/3'
      disposition: 세 문항 모두 정답. 필드 이름·draft 인계·후보 조건 유지를 구분함.
      recorded_at: '2026-08-25T12:22:59+09:00'
---
# Explain

## Background
`listReadyBlueprints`는 `approved`이고 열린 task가 있는 blueprint만 고른다. 같은 epic에 `draft`만 남으면 `nextBlueprint`의 `next`가 `null`이 되고, finalize step 6은 인계 확인을 건너뛴다. 사용자는 이 epic이 끝난 줄 알고 남은 계획을 스스로 기억해야 했다.

이 변경은 그 잔여를 `sameEpicPending`으로 페이로드에 싣는다. `--set` 후보 조건은 그대로 두고, 스킬이 그 배열로 `--set`과 `/bouncer-plan` 안내를 가른다.

## Intuition
인계 목록과 `--set` 버튼을 한 필터로 쓰지 않는다. 목록은 같은 epic의 미마감 형제, 버튼은 그 안의 ready 하나다.

## Code
- `scripts/src/lib/current.ts` — `listSameEpicPending`이 같은 epic 형제를 스캔한다. `ready`는 `listReadyBlueprints` 경로 집합으로만 붙인다. 필드 이름은 `blueprintStatus`다. 기존 entry `status`는 첫 열린 task 상태라서 겹치면 안 된다. 자신·`closed`·다른 epic·깨진 `index.md`는 빼고, 경로는 사전순이다.
- `scripts/src/lib/finalize.ts` — `next()` throw 폴백도 `{ next: null, remaining: [], sameEpicPending: [] }`다. 필드가 빠지면 스킬이 `undefined`를 순회한다.
- `skills/bouncer-finalize/SKILL.md` step 6 — `next.next`와 `next.sameEpicPending`을 같이 읽는다. 둘 다 비면 건너뛴다. `--set` 대상은 `next.next.blueprint` 하나다. `draft`와 `ready: false`에는 `--set`을 제안하지 않는다. `sharedPaths`와 leftover worktree 경고는 `next.next`가 있을 때만 읽는다.
- 테스트: `test/current.test.js`, `test/finalize.test.js`, `test/skill-bouncer-finalize.test.js`. emit은 `scripts/lib/current.js`, `scripts/lib/finalize.js`.

## Quiz
1. `sameEpicPending` 원소의 상태 필드 이름이 `status`가 아니라 `blueprintStatus`인 이유는?
   - A) `listReadyBlueprints` entry의 `status`가 첫 열린 task 상태라서 뜻이 다르다
   - B) YAML frontmatter 예약어라서 페이로드에 쓸 수 없다
   - C) G2가 `status` 키를 거부한다

2. 같은 epic에 `draft` 형제만 남고 ready 후보가 없으면 finalize 인계는?
   - A) `next`에 그 draft를 넣고 `--set`을 제안한다
   - B) 인계 확인을 통째로 건너뛴다
   - C) `next`는 `null`이고 `sameEpicPending`만 채운 뒤 `/bouncer-plan`으로 안내한다

3. 이 변경이 `listReadyBlueprints`의 후보 조건을 넓히지 않은 이유는?
   - A) 커버리지 바닥을 맞추려고
   - B) `bouncer current`의 `ready`와 `--set` 자동 선택에 승인 전 blueprint가 새면 안 되어서
   - C) `sharedPaths` 계산이 그 함수 안에 있어서

## 이해 상태
정답: 1A, 2C, 3B. 응답: 1A, 2C, 3B. 세 문항 정답. quiz_score 3/3. disposition: 필드 이름·draft 인계·후보 조건 유지를 구분함.
