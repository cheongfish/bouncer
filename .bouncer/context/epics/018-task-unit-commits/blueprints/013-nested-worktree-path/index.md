---
type: bouncer.blueprint
title: execute worktree 경로를 epic 단위로 중첩
description: Blueprint 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-10T15:59:35.434+09:00'
bouncer:
  id: '013'
  epic_id: '018'
  blueprint_id: '013'
  status: approved
  commit_type: feat
  commit_intent:
    - worktree 경로가 `.worktrees/<bp-id>` 평면이라 디렉터리에서 epic이 보이지 않고 epic마다 다시 시작하는 blueprint id가 서로 부딪힘
    - 경로를 epic 단위로 중첩하고 그 규칙을 `runtime-state` 함수 하나에 모아 스킬 두 곳이 같은 값을 읽게 함
---
# execute worktree 경로를 epic 단위로 중첩

Epic: [018](../../index.md)

## Intent
- 문제: worktree 경로 조립이 코드가 아니라 스킬 산문에 있다.
  `runtime-state.ensureWorktreeRoot()`는 `.worktrees` 루트만 돌려주고,
  `<bp-id>`를 붙이는 일은 `skills/bouncer-execute`와 `skills/bouncer-finalize`가
  각자 문자열로 한다. 그래서 규칙이 두 곳에 중복돼 있고, blueprint id가 epic마다
  `001`부터 다시 시작하는 탓에 서로 다른 epic의 첫 blueprint가 같은 디렉터리를
  요구한다.
- 완료 조건: blueprint 디렉터리 경로 하나를 받아 worktree 경로를 돌려주는 함수가
  생기고, 두 스킬이 그 함수만 호출한다. 새 경로는 `.worktrees/<epic-id>/<bp-id>`이며
  평면 경로로 이미 열린 worktree는 그대로 재사용된다.

## Contract
- 인터페이스
  - `worktreePathFor({ repoRoot, blueprint, deps })` — `runtime-state`의 새 export.
    `blueprint`는 repo 상대 blueprint 디렉터리 경로다. 반환은 절대 경로 문자열
    하나이며 디렉터리를 만들지 않는다.
  - `ensureWorktreeRoot`는 export에서 제거한다. 유일한 호출부가
    `skills/bouncer-execute`이고 그 자리를 `worktreePathFor`가 대신한다.
    `runtimePaths().worktreeRoot`는 그대로 남는다.
- 데이터·상태
  - 경로 규칙: `<runtimePaths().worktreeRoot>/<epic-id>/<bp-id>`.
    두 id는 `paths.parsePathIds`가 blueprint 경로에서 뽑는 zero-pad 세 자리다.
  - 레거시 재사용 규칙: 중첩 경로가 없고 평면 경로 `<worktreeRoot>/<bp-id>`가
    디렉터리로 존재하면 평면 경로를 돌려준다. 옮기거나 이름을 바꾸지 않는다.
  - 디렉터리 생성은 `git worktree add`에 맡긴다 — 중간 경로를 스스로 만든다.
- 수용 기준: epic Success criteria 1–8 전부.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - Git 공통 디렉터리를 못 읽으면 기존 `ensureWorktreeRoot`와 같은
    `GIT_REQUIRED` 메시지로 throw한다.
  - `blueprint` 경로에서 epic id나 blueprint id를 못 뽑으면(구형 `EPIC-`/`BP-`
    접두, 잘린 경로) throw한다. 하드 컷 이후 구형 id는 `bouncer migrate ids`가
    선행이므로 조용히 넘기지 않는다.
  - 중첩 경로와 평면 경로가 **둘 다** 있으면 중첩 경로를 쓴다. 새 규칙이 정본이고
    평면은 잔재다.
  - finalize가 worktree를 지운 뒤 남는 `.worktrees/<epic-id>`는 비었을 때만
    지운다. 같은 epic의 다른 BP worktree가 남아 있으면 `rmdir`이 실패하고, 그
    실패는 무시한다.
  - 평면 worktree를 재사용해 마감한 경우 부모는 `.worktrees` 루트다. 루트가
    비었다고 지우면 안 되므로 정리 대상은 중첩 경로일 때로 한정한다.

## Out of scope
- 브랜치 이름 규칙과 `<commit_type>` 결정 로직.
- 평면 worktree의 리네임·이관 도구.
- `bouncer seed-worktree`의 인자와 동작.
- `.gitignore` / finalize `RUNTIME_ARTIFACTS`의 `.worktrees/` 패턴.
- `runtimePaths` 반환 형태와 포인터 파일 경로.
- `.bouncer/Distill.md` 직접 편집. Decision 갱신은 `/bouncer-finalize`가
  `explain.md`에서 승격한다.

## One-commit justification
- 한 커밋이다. 함수를 추가만 하고 스킬을 안 바꾸면 죽은 코드가 남고, 스킬만
  바꾸면 호출할 함수가 없다. `ensureWorktreeRoot` 제거·`worktreePathFor` 추가·
  두 스킬의 호출부 교체·그 산문을 검사하는 계약 테스트가 서로를 참조하므로
  쪼개면 어느 중간 상태에서도 `npm test`가 깨진다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
