---
type: bouncer.blueprint
title: 마감된 blueprint 잠금 status 신설
description: Blueprint 001
resource: .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-08T13:17:10.191+09:00'
bouncer:
  id: '001'
  epic_id: '022'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - finalize가 끝나도 blueprint가 approved로 남아 머지된 단위에 task를 계속 덧붙일 수 있음
    - 마감 시점에 잠금 status를 찍어 후속 작업이 새 blueprint로 가게 함
---
# 마감된 blueprint 잠금 status 신설

Epic: [022](../../index.md)

## Intent
- 문제: blueprint 마감을 나타내는 상태가 없다. `finalize`는 커밋과 포인터 정리만
  하고 status를 건드리지 않아, 마감된 blueprint와 아직 작업 중인 blueprint를
  문서만 보고 구분할 수 없다.
- 완료 조건: finalize가 blueprint를 `closed`로 찍고, 그 blueprint에 새 task를
  붙이려는 두 경로(`scaffold task`, `current --set`)가 모두 막힌다.

## Contract
- 인터페이스
  - `scaffoldTask({ repoRoot, blueprintDir, taskId, timestamp })` — 대상 blueprint
    `index.md`의 `bouncer.status`가 `closed`면 문서를 만들지 않고 throw한다.
    메시지는 잠금 사실과 새 blueprint를 만들라는 안내를 담는다.
  - `finalize({ repoRoot, blueprintDir, yes, ... })` — `yes`일 때 blueprint
    `index.md` status를 `closed`로 쓰고 그 경로를 stage 대상에 포함한다.
    반환값에 이번 실행이 잠금을 수행했는지 알리는 필드를 더한다.
    `yes`가 아니면 파일을 쓰지 않고 예정된 전이만 반환한다.
- 데이터·상태
  - `STATUS_VOCAB['bouncer.blueprint']`에 `closed` 추가
    (`draft` | `approved` | `superseded` | `closed`).
  - blueprint 수명주기: `draft` →(plan 승인)→ `approved` →(finalize)→ `closed`.
    역방향 전이는 도구가 제공하지 않는다.
- 수용 기준: epic Success criteria 1–8 전부.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - Distill 승격분이 없는 finalize: 지금은 stage 대상이 비면 커밋을 건너뛰는데,
    잠금 전이가 항상 파일 하나를 바꾸므로 그 분기가 성립하지 않는다. 잠금이
    실제로 일어난 실행은 커밋을 남기고, 이미 `closed`여서 아무것도 쓰지 않은
    재실행만 빈-커밋 건너뛰기를 유지한다.
  - out-of-scope 검사: `makeAllowed`가 이미 `blueprintDir` 하위를 허용하므로
    status 변경이 위반으로 잡히지 않는다. 이 성질에 기대는 것을 주석으로 남긴다.
  - `scaffoldBlueprint`가 내부에서 `scaffoldTask('001')`을 부른다. 새 blueprint는
    `draft`이므로 거절되면 안 된다.
  - blueprint `index.md`가 없거나 프론트매터 파싱에 실패하면 잠금 여부를 판정할 수
    없다. 이때는 거절하지 않고 기존 동작을 유지한다.
  - `closed` blueprint는 `listReadyBlueprints`의 `approved` 필터에서 이미 빠진다.
    이 성질이 우연이 아니라 계약임을 회귀 테스트로 고정한다.
  - 잠금 해제는 사람이 `index.md` status를 `approved`로 되돌리는 것뿐이다.

## Out of scope
- PR 머지 여부 조회, `reopen` 명령, epic status 전이.
- 잠긴 blueprint에 열린 task가 남은 상태를 잡는 전용 S 코드.
- `superseded`의 의미 정리.
- `skills/bouncer-plan/SKILL.md` 프로즈 변경. 차단은 CLI와 게이트에서 한다.

## One-commit justification
- 한 커밋이 아니라 두 task 커밋으로 나눈다. task 001이 잠금 신호와 finalize
  전이·plan 게이트 문구를 세우고, task 002가 그 신호를 읽어 `scaffold task`를
  거절한다. 002는 001이 만든 status 어휘 없이는 판정할 대상이 없어 순서가 고정된다.
  001만 머지된 중간 상태도 그 자체로 성립한다 — 잠금이 기록되고 `current --set`이
  막히며, 아직 `scaffold task`만 열려 있다. 리뷰·PR 단위는 blueprint 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `closed` 신설과 finalize 전이
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 잠긴 blueprint의 task 스캐폴드 거절
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
