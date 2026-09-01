---
type: bouncer.epic
title: task 단위 커밋 전환
description: blueprint 안에 여러 task 문서를 두고 task 하나를 하나의 커밋 단위로 삼는다
resource: .bouncer/context/epics/018-task-unit-commits/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-06T17:29:57.284+09:00'
bouncer:
  id: '018'
  epic_id: '018'
  status: approved
---
# task 단위 커밋 전환

## Intent
- 문제: blueprint 하나가 커밋 하나로 묶여 있어, 성격이 다른 변경을 한 브리프에
  욱여넣거나 blueprint를 잘게 쪼개 리뷰 단위를 잃거나 둘 중 하나가 된다.
- 목표: blueprint 안에 task 문서를 여러 개 두고 task 하나를 커밋 하나로 삼는다.
  blueprint는 리뷰 단위(PR)로 남는다.

## Success criteria
1. 한 blueprint 디렉터리에 `tasks-001.md`, `tasks-002.md` 처럼 번호가 붙은 task
   문서를 여러 개 둘 수 있고, `bouncer scaffold blueprint`는 `tasks-001.md`를 만든다.
2. task 문서 하나뿐인 기존 blueprint(`tasks.md`)는 문서를 고치지 않아도 그대로
   검증을 통과한다.
3. plan 게이트 G3·G4·G5·G10·G11·G12는 발견된 모든 task 문서에 각각 적용되고,
   하나라도 미달이면 그 문서 경로로 실패를 보고한다.
4. 한 blueprint에 `tasks.md`와 `tasks-{ddd}.md`가 섞여 있으면 검증이 거절한다.
5. 하드룰 2가 "one commit per task"로 바뀌고, `docs/governance.md`와
   `docs/gates.md`가 같은 규칙을 말한다.
6. `npm test`가 통과한다.

## Out of scope
- 활성 포인터 스키마를 `{blueprint, task}`로 넓히는 일. 실행 시점에 어떤 task를
  고를지는 다음 blueprint에서 정한다.
- `verification.md` / `review.md`의 task 단위 분할(G6~G8).
- finalize의 커밋 메시지 구성과 PR 단위 재정의(G15, `commit_intent`).
- 머지된 blueprint를 잠그는 status 신설.
- 이미 있는 `tasks.md` 문서를 `tasks-001.md`로 일괄 리네임하는 일.
- worktree 디렉터리·브랜치 이름 규칙 변경.

## Blueprints
* [001 evidence-and-message](blueprints/001-evidence-and-message/index.md) - Blueprint 001
* [002 seed-plan-artifacts](blueprints/002-seed-plan-artifacts/index.md) - Blueprint 001
* [003 current-command](blueprints/003-current-command/index.md) - Blueprint 001
* [004 next-blueprint-handoff](blueprints/004-next-blueprint-handoff/index.md) - Blueprint 001
* [005 explain-doc-contract](blueprints/005-explain-doc-contract/index.md) - explain.md 문서 종류 신설, G9 폐지, G15 이해 게이트
* [006 explain-diff-skill](blueprints/006-explain-diff-skill/index.md) - skills/explain-diff 신설, finalize·spec-authoring·계약 테스트 배선
* [007 promotion-pr-body](blueprints/007-promotion-pr-body/index.md) - Distill 승격과 draft PR 본문의 소스를 explain.md로 통일
* [008 tasks-doc-resolver](blueprints/008-tasks-doc-resolver/index.md) - Blueprint 001
* [009 pointer-task-field](blueprints/009-pointer-task-field/index.md) - Blueprint 001
* [010 task-dir-layout](blueprints/010-task-dir-layout/index.md) - Blueprint 001
* [011 commit-stage](blueprints/011-commit-stage/index.md) - Blueprint 001
* [012 closed-status](blueprints/012-closed-status/index.md) - Blueprint 001
* [013 nested-worktree-path](blueprints/013-nested-worktree-path/index.md) - Blueprint 001
* [014 scale-light-convention](blueprints/014-scale-light-convention/index.md) - Blueprint 001
* [015 lightweight-cycle-guidance](blueprints/015-lightweight-cycle-guidance/index.md) - 경량 선언 시 epic 신설·에이전트 왕복·퀴즈 규모를 줄이는 경로를 문서와 스킬 프로즈에 배선
* [016 comprehension-gate-move](blueprints/016-comprehension-gate-move/index.md) - comprehension을 BP 단일 엔트리로 축소하고 commit 게이트를 G17 스코프 검사로 재정의한다
* [017 mermaid-authoring-convention](blueprints/017-mermaid-authoring-convention/index.md) - Blueprint 001
* [018 gate-integrity](blueprints/018-gate-integrity/index.md) - -a 커밋 검사 집합 확장과 하네스 소유 verify 증적 대조
* [019 promotion-verify](blueprints/019-promotion-verify/index.md) - finalize가 스테이징 전에 검증 명령을 실행하고, Distill 불릿 감사가 손으로 고친 목록에 의존하지 않게 한다
