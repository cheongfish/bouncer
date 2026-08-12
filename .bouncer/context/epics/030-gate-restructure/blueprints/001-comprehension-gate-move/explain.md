---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T13:20:37.604+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '030'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: d2625d674bbc36983838003eb117073e006427f5
      diff_sha: 6c05e0115dbd4f1c9f692f55a1e88889b0353f751eb996065efb90576f6c416e
      quiz_score: '2/2'
      disposition: 스테이징 읽기 실패→G17, makeAllowed는 scope로 옮겨 순환을 끊음
      recorded_at: '2026-08-12T13:36:46+09:00'
---
# Explain

## Background
이해 기록은 blueprint당 엔트리 하나이고, finalize G16이 그 `diff_sha`를
`range_from..HEAD`와 대조한다. commit 게이트는 `explain.md`를 보지 않는다.
포인터 task의 G6/G7/G8을 다시 보고, 스테이징 경로가 `affected_paths` 안인지
G17로 검사한다. G15 번호는 비운다. `makeAllowed` 등은 `finalize.ts`에 있어
`validate`가 그대로 가져오면 순환이 생기므로 `scope.ts`로 옮겼다.
`/bouncer-commit`에서 explain·퀴즈를 빼고 `/bouncer-finalize`로 옮겼다.

## Intuition
마감 도장은 finalize가 찍고, 커밋 직전엔 「지금 올린 파일이 이 task 칸 안인가」만
본다. 도장 잉크통(`makeAllowed`)은 공통 서랍(`scope`)에 빼 둔다.

## Code
- `scripts/src/lib/comprehension.ts` — `resolveComprehensionEntry`(마지막 엔트리).
- `scripts/src/lib/scope.ts` — `isUnder`·`RUNTIME_ARTIFACTS`·`isRuntimeArtifact`·
  `makeAllowed`. `finalize`/`commit`/`commit-guard`/`seed-worktree`가 여기서 가져온다.
- `scripts/src/lib/validate.ts` — commit: G6/G7/G8 + `deps.stagedFiles` → G17.
  git 실패는 예외가 아니라 G17. G15는 결번 주석만. finalize G16은 BP 단일
  엔트리 `diff_sha` 대조.
- 스킬: `bouncer-commit`에서 explain-diff 제거, `bouncer-finalize`에 Distill 다음
  explain·퀴즈 단계 추가.
- 회귀: `test/validate-gates.test.js`(G17 위반·통과·staged 읽기 실패),
  `test/cli-commit.test.js`, `test/commit-task.test.js`,
  `test/skill-bouncer-finalize.test.js`.

## Quiz
1. `validate --gate commit`이 스테이징 목록을 못 읽으면?
   - A) 조용히 통과한다
   - B) G17 failure로 보고한다
   - C) G15 failure로 보고한다

2. `makeAllowed`를 `finalize.ts`에 그대로 두고 `validate.ts`가 가져오면?
   - A) 문제 없다 — finalize가 validate를 require하지 않는다
   - B) 순환 require가 생긴다 — 그래서 `scope.ts`로 옮긴다
   - C) G9가 막아주므로 옮겨도 그만이다

## 이해 상태
- 점수: 2/2
- Q1 정답 B / 응답 B — 맞음
- Q2 정답 B / 응답 B — 맞음
- disposition: 스테이징 읽기 실패→G17, makeAllowed는 scope로 옮겨 순환을 끊음
