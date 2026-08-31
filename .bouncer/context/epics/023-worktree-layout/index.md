---
type: bouncer.epic
title: worktree 디렉터리를 epic 단위로 중첩
description: execute worktree 경로를 epic과 blueprint가 드러나는 중첩 구조로 바꾼다
resource: .bouncer/context/epics/023-worktree-layout/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-10T15:59:35.401+09:00'
bouncer:
  id: '023'
  epic_id: '023'
  status: approved
---
# worktree 디렉터리를 epic 단위로 중첩

## Intent
- 문제: execute worktree가 `.worktrees/<bp-id>` 평면으로 깔려 있어 디렉터리
  이름만으로는 어느 epic 작업인지 알 수 없다. blueprint id는 epic마다 `001`부터
  다시 시작하므로 서로 다른 epic의 `001`이 같은 경로를 두고 부딪힌다.
- 목표: 경로를 `.worktrees/<epic-id>/<bp-id>`로 중첩해 디렉터리에서 epic이
  보이게 하고, `1 디렉터리 = 1 브랜치`를 지켜 동시에 열 수 있는 BP 수를 줄이지
  않는다.

## Success criteria
1. `/bouncer-execute`가 새 blueprint의 worktree를 `.worktrees/<epic-id>/<bp-id>`에
   만들고, 브랜치 이름은 `<commit_type>/<bp-id>-<slug>`를 그대로 쓴다.
2. 서로 다른 epic의 blueprint `001` 두 개를 동시에 열어도 경로가 겹치지 않고,
   같은 epic의 blueprint 두 개도 각자 디렉터리를 갖는다.
3. 같은 blueprint의 두 번째 task가 이미 있는 중첩 worktree를 재사용하고 새
   브랜치를 만들지 않는다.
4. 평면 경로(`.worktrees/<bp-id>`)로 이미 열려 있는 worktree는 중첩 경로가 없는
   한 그대로 재사용된다 — 진행 중인 작업이 두 번째 worktree로 갈라지지 않는다.
5. `/bouncer-finalize`가 중첩 경로의 worktree를 제거하고, 그 결과 비어버린
   `.worktrees/<epic-id>`도 함께 지운다. 같은 epic의 다른 worktree가 남아 있으면
   epic 디렉터리를 지우지 않는다.
6. worktree 경로 규칙이 `scripts/src/lib/runtime-state.ts`의 함수 하나에만
   있고, 스킬 산문은 그 함수를 호출해 경로를 얻는다.
7. `docs/ARCHITECTURE.md`와 `docs/context-versioning.md`에 옛 평면 경로 표기가
   남지 않는다.
8. `npm test`가 통과한다.

## Out of scope
- 브랜치 이름 규칙. `<commit_type>/<bp-id>-<slug>`를 유지하고 브랜치에 task
  이름을 넣지 않는다 — task는 커밋 제목으로 드러난다.
- 이미 열려 있는 평면 worktree의 일괄 리네임. 감지해서 재사용만 하고 옮기지
  않는다.
- `.gitignore`와 finalize 범위 검사의 `.worktrees/` 패턴. 접두 매칭이라 중첩
  경로도 그대로 걸린다.
- blueprint 하나가 worktree 하나를 재사용한다는 epic 021의 규칙. 위치만 바꾸고
  재사용 규칙은 건드리지 않는다.
- `bouncer seed-worktree`의 인터페이스. 목적지를 `--to`로 받으므로 경로 규칙이
  바뀌어도 그대로다.
- graphify 설치 경로와 `context_dirs` 경량화.

## Blueprints
* [001 nested-worktree-path](blueprints/001-nested-worktree-path/index.md) - execute worktree 경로를 `.worktrees/<epic-id>/<bp-id>`로 중첩하고 해석을 `runtime-state` 헬퍼 하나로 모은다 (`scripts/src/lib/runtime-state.ts`, `skills/bouncer-execute`, `skills/bouncer-finalize`, `docs/`, `test/`)
