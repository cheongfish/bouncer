---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-08T14:06:31.362+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '022'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 2cb1f7e4643b6f4e924225e4a86fb7dd69c21924
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/3'
      disposition: 잠금 판정이 out-of-scope 검사보다 먼저인지 헷갈림. 점수가
        낮아도 기록만 하고 마감을 막지 않음(explain-diff 스킬 지침).
      recorded_at: '2026-08-08T14:10:02+09:00'
---
# Explain

## Background
`finalize`는 지금 커밋과 포인터 정리만 하고 blueprint `index.md`의 status는
건드리지 않는다. 그래서 마감된 blueprint와 아직 작업 중인 blueprint를 문서만
보고 구분할 수 없고, 마감된 단위에 새 task를 계속 붙이는 일이 막히지 않는다.
이 task는 blueprint 수명주기에 `closed` 상태를 더해 마감 시점에 그 상태를
찍고, plan 게이트가 마감 사유를 미승인 `draft`와 구분해 보고하게 한다.

## Intuition
blueprint 문서에 "마감" 도장을 하나 더 만든 것과 같다. `finalize --yes`가
그 도장을 찍고, plan 게이트는 도장이 찍힌 문서를 보면 "이미 끝났다"는 다른
말로 알려준다.

## Code
- `scripts/src/lib/schema.ts` — `STATUS_ENUM['bouncer.blueprint']`에 `closed`
  추가.
- `scripts/src/lib/finalize.ts` — `resolveLockTarget` / `closedLockPath` /
  `writeClosedLock` / `mergeLocked` 헬퍼. out-of-scope 검사 다음에 잠금을
  판정하고 stage 목록에 합류시키는 순서가 핵심.
- `scripts/src/lib/validate.ts` — G2 판정이 status별로 문구를 분기하는 지점.
- `test/finalize.test.js`, `test/schema.test.js`, `test/validate-gates.test.js`,
  `test/current.test.js` — 잠금 전이·dry-run·재실행 멱등·G2 문구 분기·
  `listReadyBlueprints` 제외 회귀.

## Quiz
1. `finalize({ yes: false })`를 blueprint가 아직 `approved`일 때 부르면
   `closed` 필드와 실제 파일에는 각각 무슨 일이 생기나?
   - A) `closed`에 잠글 경로가 담기고, 파일은 그대로다
   - B) `closed`가 `null`이고, 파일은 이미 잠긴다
   - C) `closed`에 잠글 경로가 담기고, 파일도 즉시 `closed`로 바뀐다
2. 이미 `bouncer.status`가 `closed`인 blueprint에 `--yes`로 다시 finalize를
   부르면 `res.closed`는 무엇이 되나?
   - A) 다시 잠긴 경로 문자열
   - B) `null`
   - C) 에러를 던진다
3. out-of-scope 위반이 있는 실행에서 잠금 판정은 언제 일어나나?
   - A) out-of-scope 검사보다 먼저 잠금부터 판정한다
   - B) out-of-scope 검사를 통과한 뒤에만 잠금을 판정한다
   - C) 위반이 있어도 잠금은 그대로 기록하고 반환에는 반영하지 않는다

## 이해 상태
- 문항 1 정답: A — 사용자 응답: A — 정오: 정답
- 문항 2 정답: B — 사용자 응답: B — 정오: 정답
- 문항 3 정답: B — 사용자 응답: A — 정오: 오답
- `quiz_score`: 2/3
- disposition: 잠금 판정이 out-of-scope 검사보다 먼저인지 헷갈림. 점수가
  낮아도 기록만 하고 마감을 막지 않음(explain-diff 스킬 지침).
