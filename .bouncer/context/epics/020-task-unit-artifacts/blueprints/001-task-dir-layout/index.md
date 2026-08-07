---
type: bouncer.blueprint
title: task 문서를 디렉터리 묶음으로 전환
description: Blueprint 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: '001'
  epic_id: '020'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - 커밋 단위는 task인데 증적과 리뷰가 blueprint에 하나뿐이라 두 번째 task부터 증적이 덮이고 리뷰 대상이 흐려짐
    - task 문서와 그 증적·리뷰를 한 디렉터리로 묶어 execute 게이트가 지목된 task만 판정하게 함
---
# task 문서를 디렉터리 묶음으로 전환

Epic: [020](../../index.md)

## Intent
- 문제: `listTasksDocs`는 blueprint 루트의 `tasks-<NNN>.md`만 훑고, 증적과 리뷰는
  `<bp>/verification.md`·`<bp>/review.md` 한 벌뿐이다. `recordVerificationResult`도
  그 고정 경로에 쓴다. task를 두 번 커밋하면 첫 증적이 남지 않는다.
- 완료 조건: `tasks/<NNN>/` 아래 세 문서가 한 task의 브리프·증적·리뷰가 되고,
  execute 게이트가 활성 포인터의 task 묶음만 본다. 이 저장소의 기존 문서가
  마이그레이션 후 validate를 통과한다.

## Contract
- 인터페이스
  - `scripts/src/lib/tasks-docs.ts`: `listTasksDocs`가 `<bp>/tasks/<NNN>/`
    디렉터리를 번호 오름차순으로 돌려주고, 엔트리마다 `tasks`·`verification`·
    `review` 세 경로와 `TASKS-<NNN>`·`VERIFY-<NNN>`·`REVIEW-<NNN>` id를 담는다.
    `expectedTasksId`는 `expectedTaskDocIds(number)`로 확장한다.
  - CLI: `bouncer scaffold task --blueprint <dir> --id <NNN>`,
    `bouncer migrate task-layout [--dry-run|--apply]`.
  - `runtime`: `recordVerificationResult`가 대상 task 디렉터리를 인자로 받는다.
- 데이터·상태
  - 문서 배치가 `<bp>/tasks/<NNN>/{tasks,verification,review}.md`로 바뀐다.
    `index.md`와 `explain.md`는 blueprint 루트에 남는다.
  - frontmatter `resource`가 새 경로로 바뀐다. `bouncer.id`·`epic_id`·
    `blueprint_id` 값 자체는 그대로다.
  - 활성 포인터의 `task`는 계속 repo-relative path 문자열이고, 값이
    `<bp>/tasks/<NNN>/tasks.md` 형태로 바뀐다.
- 수용 기준: epic 020 Success criteria 1~8.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - 구·신 레이아웃 혼재(루트 `tasks-002.md`와 `tasks/001/`가 함께 존재) —
    구조 실패로 거절하고 `migrate task-layout`을 안내한다.
  - `tasks/1/`·`tasks/01/`·`tasks/foo/` — 정본이 아니므로 task 묶음이 아니다.
    무시하지 않고 구조 실패로 보고한다.
  - `tasks/002/`에 `review.md`만 있고 `tasks.md`가 없음 — 묶음 불완전으로 거절.
  - migrate 실행 시 워킹트리가 dirty — validate 단계에서 중단하고 아무것도 옮기지
    않는다. `migrate ids`의 all-or-nothing 규칙을 따른다.
  - migrate 시점에 포인터가 없거나 다른 blueprint를 가리킴 — 파일만 옮기고
    포인터는 건드리지 않는다.
  - 포인터가 지목한 task 디렉터리가 사라진 경우 — 019가 정한 폴백(번호 순
    첫 선언 / 합집합)을 그대로 유지한다.

## Out of scope
- G15 `diff_sha` 범위와 `commit_intent`의 task 단위 재정의.
- 머지된 blueprint를 잠그는 status 신설.
- worktree 디렉터리·브랜치 이름 규칙.
- `bouncer migrate ids`의 동작과 legacy id 접두 처리.
- `explain.md`를 task 디렉터리로 옮기는 일.

## One-commit justification
- 한 커밋이 아니다. 레이아웃 전환은 리졸버·게이트·스킬·마이그레이션이 서로를
  전제해서 하나로 묶으면 리뷰가 불가능하고, 반대로 하드컷과 자기 저장소 이동을
  떼어놓으면 중간 커밋에서 validate가 깨진다. task 문서 4개로 나눠 각각
  커밋하고 blueprint 하나를 PR 단위로 삼는다.
- 004가 하드컷과 이 저장소 트리 이동을 같은 커밋에 담는다. 게이트가 구
  레이아웃을 거절하는 시점과 문서가 새 레이아웃으로 옮겨지는 시점이 갈리면
  그 사이 커밋에서 `bouncer validate`가 자기 문서에 실패한다.

## Documents
* [Tasks 001](tasks-001.md) - 리졸버와 스캐폴드
* [Tasks 002](tasks-002.md) - 게이트와 증적 기록
* [Tasks 003](tasks-003.md) - 스킬과 문서
* [Tasks 004](tasks-004.md) - 마이그레이션과 하드컷
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
