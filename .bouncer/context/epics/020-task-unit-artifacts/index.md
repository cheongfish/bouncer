---
type: bouncer.epic
title: task 단위 증적과 리뷰
description: Epic 020
resource: .bouncer/context/epics/020-task-unit-artifacts/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-07T09:59:09.421+09:00'
bouncer:
  id: '020'
  epic_id: '020'
  status: approved
---
# task 단위 증적과 리뷰

## Intent
- 문제: 커밋 단위는 task 문서인데 증적과 리뷰는 blueprint에 하나씩뿐이다.
  한 blueprint에서 task를 두 번 커밋하면 `verification.md`는 마지막 실행으로
  덮이고, `review.md`의 발견사항은 어느 커밋에 대한 판단인지 드러나지 않는다.
- 목표: task 문서 하나가 자기 증적과 자기 리뷰를 갖고, execute 게이트가 활성
  포인터가 지목한 task의 문서 묶음만 판정한다.

## Success criteria
1. `bouncer scaffold blueprint`가 `tasks/001/`에 `tasks.md`·`verification.md`·
   `review.md`를 만들고 각 id는 `TASKS-001`·`VERIFY-001`·`REVIEW-001`이다.
2. `bouncer scaffold task --blueprint <dir> --id <NNN>`이 기존 blueprint에
   `tasks/<NNN>/` 묶음 3종을 추가한다.
3. 포인터가 `tasks/002/tasks.md`를 지목하면 G6·G7·G8·G13·G14가 `tasks/002/`의
   문서만 읽고 판정한다. 다른 번호의 미완 task는 execute 게이트를 막지 않는다.
4. execute 게이트의 verify 실행 증적이 `tasks/<NNN>/verification.md`에 기록된다.
5. `bouncer migrate task-layout --dry-run`이 이동할 파일 목록을 출력하고,
   apply가 파일 이동과 함께 frontmatter `resource`·활성 포인터의 `task` 경로를
   재작성한다.
6. 구 레이아웃(blueprint 루트의 `tasks.md`·`tasks-<NNN>.md`·`verification.md`·
   `review.md`)은 `bouncer validate`가 구조 실패로 거절한다.
7. 이 저장소의 epic 001~019 문서가 마이그레이션 후 `bouncer validate`를
   그대로 통과한다.
8. `npm test`가 통과한다.

## Out of scope
- G15 `diff_sha` 범위와 `commit_intent`의 task 단위 재정의. finalize 커밋
  메시지와 PR 구성은 다음 blueprint로 넘긴다.
- 머지된 blueprint를 잠그는 status 신설.
- worktree 디렉터리·브랜치 이름 규칙 변경.
- epic·blueprint id 체계와 `bouncer migrate ids`의 동작.
- `explain.md`의 위치. blueprint 루트에 그대로 둔다.

## Blueprints
* [001 task-dir-layout](blueprints/001-task-dir-layout/index.md) - task 문서를 `tasks/<NNN>/` 묶음으로 옮기고 execute 게이트·증적 기록·마이그레이션을 그 묶음 단위로 맞춘다 (`scripts/src/lib/`, `skills/`, `docs/`, `test/`)
