---
type: bouncer.epic
title: 활성 포인터의 task 단위 전환
description: Epic 019
resource: .bouncer/context/epics/019-task-pointer/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-07T09:00:40.840+09:00'
bouncer:
  id: '019'
  epic_id: '019'
  status: approved
---
# 활성 포인터의 task 단위 전환

## Intent
- 문제: 한 blueprint에 task 문서를 여러 개 둘 수 있게 됐지만 활성 포인터는 아직
  `{blueprint, base}`뿐이라 실행 시점에 어느 task가 작업 대상인지 알 수 없다.
  검증 명령은 번호가 가장 앞선 선언을, 커밋 허용 경로는 모든 task의 합집합을 쓴다.
- 목표: 포인터가 task를 지목하고, 검증 명령 조회와 커밋 허용 경로가 그 task
  하나로 좁혀진다.

## Success criteria
1. `bouncer current --set <blueprint> --task <NNN>`이 포인터에 task를 기록하고,
   `bouncer current`가 그 값을 그대로 돌려준다.
2. `--task` 없이 `--set`하면 번호가 가장 앞선 `ready`/`in_progress` task 문서가
   자동으로 선택되어 포인터에 기록된다.
3. 포인터에 task가 있으면 검증 명령은 그 문서의 `bouncer.verify`만 본다.
   그 문서에 선언이 없으면 `config.verify`로 떨어진다.
4. 포인터에 task가 있으면 커밋 허용 경로는 합집합이 아니라 그 문서의
   `affected_paths`다.
5. task 필드가 없는 기존 포인터 파일은 지금 동작(첫 선언 채택 / 합집합)을 그대로
   유지한다.
6. 존재하지 않는 task를 `--task`로 지정하면 포인터를 쓰지 않고 실패한다.
7. `/bouncer-execute`가 포인터가 지목한 task 문서를 브리프로 삼고,
   `/bouncer-finalize`가 커밋 뒤 같은 blueprint에 남은 task가 있으면 그쪽으로
   포인터를 옮길지 확인한다.
8. `npm test`가 통과한다.

## Out of scope
- `verification.md` / `review.md`를 task별로 나누는 일(G6~G8). 증적과 리뷰 문서는
  당분간 blueprint 하나에 하나다.
- finalize의 커밋 메시지 구성과 PR 단위 재정의(G15, `commit_intent`).
- 머지된 blueprint를 잠그는 status 신설.
- 포인터를 자동으로 전진시키는 일. 전진은 확인 후 `bouncer current --set`뿐이다.
- worktree 디렉터리·브랜치 이름 규칙 변경.
- 이미 쌓인 `tasks.md` 문서의 일괄 리네임.

## Blueprints
* [001 pointer-task-field](blueprints/001-pointer-task-field/index.md) - 활성 포인터에 task 필드를 넣고 검증 명령·커밋 허용 경로·execute 브리프를 그 task로 좁힌다 (`scripts/src/lib/`, `skills/bouncer-execute/`, `test/`, `docs/`)
