---
type: bouncer.blueprint
title: 활성 포인터 namespace
description: Isolates active blueprint pointers by epic and blueprint while preserving safe legacy migration.
resource: .bouncer/context/epics/064-runtime-policy-pointer-safety/blueprints/002-active-pointer-namespace/index.md
tags:
  - bouncer
  - blueprint
  - pointer
  - namespace
  - worktree
  - migration
timestamp: '2026-09-07T09:46:55.565+09:00'
bouncer:
  id: '002'
  epic_id: '064'
  blueprint_id: '002'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 활성 포인터 namespace

Epic: [064](../../index.md)

## Intent

단일 활성 포인터가 연결된 작업 트리의 실행 주기를 서로 덮어쓰는 문제를 막는다. 식별자별로 상태를 나누고 실행 위치에 맞는 것만 선택하되, 기존 단일 파일은 충돌 없이 이관한다.

## Contract

- 인터페이스: 전환 첫 단계의 `bouncer current --set`은 다른 활성 blueprint를 발견하면 종료 코드 2로 거절하고 `--replace`를 명시한 경우에만 교체한다. namespace 전환 뒤 기본 `--set`은 대상 key를 추가·갱신하며 다른 key를 보존하고, `--replace`는 현재 선택을 지운 뒤 대상으로 바꾸는 명시적 전환으로 남는다.
- 데이터·상태: 최종 포인터는 `<git-common-dir>/bouncer/pointers/<epic-id>/<blueprint-id>.json`에 저장한다. 파일 본문 `{ blueprint, base, task? }`와 CLI의 `current` 표시 구조는 유지한다.
- 해석: 중첩 execute worktree와 유일하게 대응하는 레거시 평면 worktree에서는 해당 blueprint 포인터만 선택한다. 기준 checkout에서는 포인터가 하나일 때만 선택하고, 둘 이상이면 정렬된 후보를 JSON으로 내고 중단한다.
- 이관: `<git-common-dir>/bouncer/current` 레거시 파일은 계속 읽는다. 첫 `current --set`은 충돌이 없을 때 대상 namespace로 원자적으로 옮기고 레거시 파일을 지운다. 레거시와 namespace가 다른 blueprint를 가리키면 둘 다 보고하며 어느 쪽도 수정하지 않는다.
- 수용 기준: epic 성공 기준 5~8을 만족하고, plan·execute가 시작 시 선택된 활성 작업과 Git common directory 공유 범위를 한 줄로 알린다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스: 포인터가 둘 이상인 기준 checkout 실행, 레거시와 namespace 불일치, 깨진 포인터 파일, 숫자 id를 추출할 수 없는 blueprint, 같은 blueprint의 task 이동, 레거시 평면 worktree의 중복 blueprint id, 이관 쓰기·삭제 실패는 상태를 추측하지 않고 중단한다.

## Out of scope

- verify 원장 경로와 기록 형식 변경
- execute worktree 경로와 branch 이름 변경
- 포인터와 별개의 세션 식별자 도입
- relocated worktree를 branch 이름으로 추측해 포인터에 연결
- Windows·macOS CI와 launcher 발견 경로 변경

## One-commit justification

- Task 001은 현재 단일 슬롯의 덮어쓰기 보호와 공개 플래그를 한 커밋으로 고정한다.
- Task 002는 namespace 저장, 위치별 선택, 레거시 이관을 하나의 상태 전환으로 묶는다. 일부만 적용하면 포인터를 썼지만 읽을 수 없거나 레거시 상태를 잃을 수 있다.
- Task 003은 최종 동작에 맞춘 워크플로·규칙·사용자 문서를 한 커밋에서 전환해 오래된 단일 포인터 안내를 남기지 않는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 단일 포인터 덮어쓰기 보호
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - namespace 저장과 레거시 이관
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - 워크플로와 공개 계약 전환
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
