---
type: bouncer.epic
title: task 단위 마감과 blueprint 단위 PR
description: task 하나를 닫는 커밋 단계를 만들고 finalize는 blueprint 마감만 담당하게 한다
resource: .bouncer/context/epics/021-task-commit-stage/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-07T14:13:08.409+09:00'
bouncer:
  id: '021'
  epic_id: '021'
  status: approved
---
# task 단위 마감과 blueprint 단위 PR

## Intent
- 문제: 커밋 단위는 task인데 마감 흐름은 blueprint 하나에 맞춰져 있다.
  `/bouncer-finalize` 한 번이 커밋·explain·PR·정리를 모두 하니, task가 여러 개면
  같은 subject의 커밋이 반복되고(epic 020에서 3회) `explain.md`의 이해 기록
  한 벌이 task마다 덮인다.
- 목표: task 하나를 닫는 `/bouncer-commit`을 신설하고, `/bouncer-finalize`는
  blueprint 하나를 PR로 내보내고 정리하는 단계로 좁힌다.

## Success criteria
1. 워크플로가 `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` →
   `/bouncer-commit` →(task마다 반복)→ `/bouncer-finalize`이고, execute는
   커밋하지 않는다.
2. 커밋 subject가 `<commit_type>: <대상 task의 title>`이고, 배경·의도 2줄은
   대상 task `tasks.md`의 `bouncer.commit_intent`에서, 없으면 blueprint의
   같은 필드에서 온다.
3. `explain.md`의 `bouncer.comprehension`이 task별 엔트리 배열이고,
   `/bouncer-commit`이 대상 task 엔트리 하나만 추가한다. 이전 task의 퀴즈
   기록은 그대로 남는다.
4. `bouncer validate --gate commit`이 포인터가 지목한 task의 explain 엔트리와
   `range_from..HEAD` 해시를 G15로 판정한다.
5. `bouncer validate --gate finalize`가 열린 task가 남았거나 엔트리가 빠진
   blueprint를 G16으로 막는다.
6. `bouncer commit`이 커밋 후 같은 blueprint의 다음 열린 task 후보를 결과에
   담고, `/bouncer-commit`이 ACQ 확인 뒤 `bouncer current --set`으로 포인터를
   옮긴다. 남은 task가 없으면 그 사실을 알리고 finalize로 넘긴다.
7. 한 blueprint의 모든 task가 `.worktrees/<bp-id>` 하나를 재사용하고, 그
   worktree는 finalize에서 한 번만 제거된다.
8. `npm test`가 통과한다.

## Out of scope
- 머지된 blueprint를 잠그는 status 신설. `/bouncer-commit`은 열린 task만 다룬다.
- worktree 디렉터리를 `.worktrees/<epic-id>/<bp-id>`로 중첩하는 변경. 위치는
  `.worktrees/<bp-id>` 그대로 두고 재사용 규칙만 명시한다.
- 브랜치 이름 규칙. `<type>/<bp-id>-<slug>`를 유지한다.
- 이미 마감된 blueprint의 `explain.md`를 새 `comprehension` 형식으로 옮기는 일.
  구 형식은 거절만 하고 변환하지 않는다.
- PR 제목·본문 형식과 `templates.ts`의 `pr.md`.
- graphify 설치·실행 경로와 `context_dirs` 경량화.

## Blueprints
* [001 commit-stage](blueprints/001-commit-stage/index.md) - task 하나를 닫는 `/bouncer-commit`과 `bouncer commit`을 신설하고 커밋 메시지·이해 기록·게이트·finalize 범위를 task 단위로 재배치한다 (`scripts/src/lib/`, `skills/`, `docs/`, `test/`)
