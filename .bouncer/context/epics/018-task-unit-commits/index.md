---
type: bouncer.epic
title: task 단위 커밋 전환
description: Epic 018
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
* [001 tasks-doc-resolver](blueprints/001-tasks-doc-resolver/index.md) - task 문서 다중 파일 이름·id 규칙과 공용 리졸버를 도입하고 스캐폴드·검증·포인터·커밋 훅을 그 리졸버로 통일한다 (`scripts/src/lib/`, `test/`, `CLAUDE.md`, `docs/governance.md`, `docs/gates.md`)
