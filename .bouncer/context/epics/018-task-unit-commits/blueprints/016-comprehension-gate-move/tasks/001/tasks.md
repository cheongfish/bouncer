---
type: bouncer.tasks
title: comprehension 단일 엔트리 계약과 G16 해시 판정
description: Tasks for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T11:14:29.559+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '016'
  status: verified
  commit_intent:
    - 이해 기록이 task마다가 아니라 blueprint 하나에 남게 됨
    - 기록된 해시를 finalize가 직접 대조해 기록과 실제 diff가 갈라지지 않음
  affected_paths:
    - scripts/src/lib/comprehension.ts
    - scripts/lib/comprehension.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/comprehension.test.js
    - test/validate-gates.test.js
    - test/finalize.test.js
    - test/scaffold.test.js
  graph:
    generated_at: '2026-08-12T12:45:49.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 90 nodes — validate.ts/js, finalize.ts/js, commit.ts/js, commit-guard.ts/js, seed-worktree.ts/js, paths.ts, makeAllowed()/isUnder() in finalize
      - graph: context
        status: updated
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 14 nodes — epic 013-comprehension-gate blueprints 001/002/003 explain.md 섹션
---
# Tasks

Blueprint: [016](../../index.md)

## Goal & intent
`explain.md`의 `bouncer.comprehension`이 blueprint당 엔트리 하나가 되고,
finalize 게이트(G16)가 그 엔트리의 `diff_sha`를 `range_from..HEAD`와 직접
대조한다. task 번호로 엔트리를 찾던 계약과 G16의 task별 루프가 사라진다.
`quiz_score`가 필수 필드로 올라가, 퀴즈를 건너뛰고 `disposition`만 채운
문서는 finalize를 통과하지 못한다. commit 게이트 분기는 이 task에서 손대지
않는다 — TASKS-002가 통째로 다시 쓴다.

## Interface
- 제공:
  - `comprehension.resolveComprehensionEntry(comprehension)` — 배열의 마지막
    엔트리를 반환. `{ ok: true, entry }` 또는
    `{ ok: false, reason: 'not-a-list' | 'missing' | 'incomplete' }`.
    절대 throw하지 않는다.
  - G16이 `computeDiffSha({ repoRoot, base: entry.range_from, exec })`로
    해시를 다시 계산하고 `entry.diff_sha`와 대조한다. 계산 실패와 불일치는
    서로 다른 메시지다.
- 거부:
  - 배열이 아닌 값(구 단일 객체 포함) → `not-a-list`.
  - 빈 배열 → `missing`.
  - `range_from` / `diff_sha` / `disposition` / `quiz_score` 중 하나라도
    비었거나 문자열이 아니면 → `incomplete`. `quiz_score: '0/0'`은 값이
    있으므로 형식상 통과이고, 이 계약이 막는 것은 빈 값이다.
  - `findComprehensionEntry`와 `normalizeTaskKey`는 남기지 않는다. 별칭도
    두지 않는다.

## Touch
- Modify `scripts/src/lib/comprehension.ts` — `findComprehensionEntry`를
  `resolveComprehensionEntry`로 바꾸고 `quiz_score`를 필수 필드에 추가,
  `normalizeTaskKey`와 `duplicate` 사유를 제거한다.
- Modify `scripts/lib/comprehension.js` — 위 변경의 CJS 산출물 동기화.
- Modify `scripts/src/lib/validate.ts` — finalize 분기의 task별 루프를 단일
  엔트리 판정으로 바꾸고 `diff_sha` 대조를 추가한다.
- Modify `scripts/lib/validate.js` — 위 변경의 CJS 산출물 동기화.
- Modify `test/comprehension.test.js` — 엔트리 조회 테스트를 새 계약으로
  바꾸고 `quiz_score` 누락 케이스를 추가한다.
- Modify `test/validate-gates.test.js` — G16 픽스처와 단언을 단일 엔트리 +
  해시 판정으로 바꾼다.
- Modify `test/finalize.test.js` — `fullBlueprint` 픽스처의 comprehension
  엔트리에 `quiz_score`를 넣고 해시가 맞도록 맞춘다.
- Modify `test/scaffold.test.js` — 빈 배열 단언에 붙은 G15 설명 주석을 새
  판정 주체(G16)로 고친다.

## Do not touch
- `skills/` — 스킬 산문 이동은 TASKS-003이다.
- `docs/` — 게이트 문서 갱신은 TASKS-003이다.
- `hooks/commit-safety.js` — 훅은 이 blueprint에서 바꾸지 않는다.
- `scripts/src/lib/scaffold.ts` — `comprehension: []` 기본값은 그대로 둔다.

## Constraints
- `validate.ts`의 `commit` 게이트 분기는 이 task에서 고치지 않는다. G15
  코드가 그대로 남아 있어도 이 커밋은 완결이며, 제거는 TASKS-002가 한다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. `npm run build`(또는 `pretest`)의
  산출물을 그대로 커밋한다.
- 하위 호환 별칭을 남기지 않는다. `findComprehensionEntry`라는 이름이 코드에
  남으면 안 된다.
- 0.7 문서 읽기 호환은 마이그레이션이 아니라 조회 규칙으로만 해결한다.
  변환 함수나 스크립트를 만들지 않는다.
- 실패 메시지는 기존 톤을 유지한다(영문 한 줄). 계산 실패와 해시 불일치는
  서로 다른 문자열이어야 한다.

## Checklist
- [ ] `test/comprehension.test.js`에 실패 테스트를 먼저 추가한다: 엔트리가
      둘인 배열에서 마지막 엔트리를 돌려주고, `quiz_score`가 빈 문자열이면
      `incomplete`를 낸다.
      ```js
      assert.deepStrictEqual(
        resolveComprehensionEntry([{ task: '001', ...ok }, { task: '002', ...ok2 }]).entry.task,
        '002',
      );
      assert.strictEqual(
        resolveComprehensionEntry([{ ...ok, quiz_score: '' }]).reason,
        'incomplete',
      );
      ```
- [ ] `node --test test/comprehension.test.js`로 실패를 확인한다.
- [ ] `scripts/src/lib/comprehension.ts`에서 `findComprehensionEntry` /
      `normalizeTaskKey`를 지우고 `resolveComprehensionEntry`를 구현한다.
      필수 필드는 `range_from`, `diff_sha`, `disposition`, `quiz_score`.
- [ ] `test/validate-gates.test.js`에 실패 테스트를 추가한다: 엔트리는
      완전하지만 `diff_sha`가 틀리면 G16 하나가 나고 메시지가 불일치를
      가리킨다. 계산 실패(`no-base`)는 별도 메시지의 G16이다.
- [ ] `scripts/src/lib/validate.ts` finalize 분기를 고친다. task별 루프와
      `findComprehensionEntry(comp, number)` 호출을 제거하고,
      `resolveComprehensionEntry(comp)` → `computeDiffSha` 순으로 판정한다.
      "모든 task가 verified"인 앞단 검사는 그대로 둔다.
- [ ] `test/finalize.test.js`·`test/scaffold.test.js`의 픽스처와 주석을
      새 계약에 맞춘다.
- [ ] `npm run build`로 `scripts/lib/comprehension.js`·`validate.js`를
      재생성한다.
- [ ] `npm test`가 통과한다.
