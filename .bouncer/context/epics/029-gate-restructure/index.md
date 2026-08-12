---
type: bouncer.epic
title: 이해 기록을 finalize로 옮기고 게이트를 재배치
description: explain·퀴즈를 commit에서 finalize로 옮기고 commit 게이트를 스코프 검사로 재정의한다
resource: .bouncer/context/epics/029-gate-restructure/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-12T11:14:29.527+09:00'
bouncer:
  id: '029'
  epic_id: '029'
  status: approved
---
# 029 gate-restructure

## Intent
- 문제: 이해 기록(explain + 퀴즈)이 task 커밋마다 걸려 있다. 커밋 단위로 퀴즈를
  보면 PR 하나에 같은 질문이 여러 번 오고, 정작 커밋 직전에 스테이징 범위를
  보는 결정적 검사는 없다. 지금 그 방어선은 우회 가능한 커밋 훅과 너무 늦은
  finalize 두 곳뿐이다.
- 목표: 이해 기록을 blueprint 단위로 finalize에 한 번만 두고, commit 게이트는
  포인터 task 상태 재확인과 스테이징 스코프 검사로 다시 채운다.

## Success criteria
1. `validate --gate commit`이 `explain.md`를 읽지 않고, 포인터 task의
   `tasks`/`verification`/`review` 상태를 G6/G7/G8로 다시 판정한다.
2. 스테이징된 경로 중 그 task의 `affected_paths` 밖이 하나라도 있으면
   `validate --gate commit`이 신규 코드 **G17**로 실패한다.
3. `validate --gate finalize`가 `comprehension` 엔트리의 `diff_sha`를
   `range_from..HEAD`(`.bouncer/context/` 제외)와 대조하고, 불일치는 G16
   hard fail이다.
4. `comprehension` 엔트리에 `quiz_score`가 없거나 비어 있으면 finalize가
   G16으로 막힌다. `disposition`만 채우고 통과하는 경로는 없다.
5. task별 엔트리를 여러 개 가진 0.7 `explain.md`도 형식 거절 없이 finalize
   판정 대상이 된다.
6. G15는 어느 게이트에서도 발생하지 않고, 코드에 결번 주석만 남는다.
7. `/bouncer-commit` 스킬 본문에 `explain-diff` 호출과 퀴즈 단계가 없고,
   `/bouncer-finalize` 본문에 Distill 승격 다음 단계로 들어 있다.
8. `npm test`가 통과한다.

## Out of scope
- `/bouncer-run`과 `autonomy` 설정 — PLANNING-DECISIONS §3·§4 (BP-4).
- 문서 스키마·레이아웃(`bouncer_schema`, OKF `type` 대조, `scale` 승격,
  legacy 컷오버) — §5 (BP-3).
- context reviewer와 신규 plan 게이트 G18 — §7 (BP-5). 같은 `validate.ts`를
  건드리므로 이 에픽 뒤에 온다.
- 퀴즈 문항 생성 로직의 코드화. 적응형 규칙은 계속 `explain-diff` 산문과
  스킬 계약 테스트에만 있다.
- 기존 `explain.md` 문서의 마이그레이션 스크립트. 0.7 문서는 읽기 호환으로만
  받는다.

## Blueprints
* [001 comprehension-gate-move](blueprints/001-comprehension-gate-move/index.md) - comprehension을 BP 단일 엔트리로 축소해 `diff_sha` 판정을 G16으로 옮기고(`scripts/src/lib/comprehension.ts`, `validate.ts`), commit 게이트를 스코프 검사 G17로 재정의하며(`scope.ts` 신설, `commit.ts`·`commit-guard.ts`·`finalize.ts` 배선), explain·퀴즈 단계를 `/bouncer-commit`에서 `/bouncer-finalize`로 옮긴다(`skills/`, `docs/`)
