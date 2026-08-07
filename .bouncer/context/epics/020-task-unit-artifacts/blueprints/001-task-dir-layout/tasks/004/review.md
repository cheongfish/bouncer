---
type: bouncer.review
title: 004 review
description: review for 004
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-07T03:55:58.196Z'
bouncer:
  id: REVIEW-004
  epic_id: '020'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
        summary: 묶음으로 접힌 verification·review의 id가 blueprint id로 남아 S5에 걸림
      - id: F2
        severity: minor
        status: resolved
        summary: isTasksBasename이 항상 false를 돌려주는 죽은 함수로 남음
      - id: F3
        severity: minor
        status: resolved
        summary: listTasksDocs 주석이 "거절하지 않는다"로 하드컷 이전 동작을 설명함
      - id: F4
        severity: minor
        status: resolved
        summary: docs/gates.md가 S0–S14와 하드컷 이전 문구를 그대로 둠
---
# review

## Findings

- **F1** `major` → `resolved` — `migrate task-layout`이 `rewrite`에서 `bouncer.tasks`
  id만 번호에 맞춰 고쳐, blueprint id를 id로 쓰던 레거시 `verification.md`·`review.md`가
  `tasks/001/`로 접힌 뒤에도 `VERIFY-002` 같은 값을 유지했다. 옮긴 직후 자기 검증기가
  `S5 id VERIFY-002 != expected VERIFY-001`로 거절한다. `rewrite`가 세 종류 모두
  `expectedTaskDocIds(number)`를 따르게 고치고, 이미 apply된 이 저장소 문서 27건의
  id·resource를 같은 규칙으로 맞췄다. 회귀 테스트는
  `legacy blueprint ids are renumbered to the unit, not left at the blueprint id`.

- **F2** `minor` → `resolved` — 레거시 인식을 걷어내면서 `isTasksBasename`이
  `return false` 한 줄만 남았다. 호출자가 없어 함수와 export를 지웠다.

- **F3** `minor` → `resolved` — `listTasksDocs`의 구 레이아웃 주석이 "이 task에서는
  거절하지 않는다"로 남아 S15와 정반대를 설명했다. 잔존 파일은 목록으로만 보고하고
  거절은 validate가 한다는 실제 동작으로 바꿨다.

- **F4** `minor` → `resolved` — `docs/gates.md`가 S 코드 범위를 `S0–S14`로,
  구 레이아웃을 "하드컷 전까지는 거절 규칙을 새로 정의하지 않는다"로 설명했다.
  브리프의 Touch·affected_paths에 `docs/gates.md`가 빠져 있어 사용자에게 확인한 뒤
  범위를 넓히고, S15~S17과 S14 결번을 적었다.

브리프 대비 미구현·범위 이탈은 없다. 테스트 fixture 전환은 `tasks/<NNN>/` 묶음을
직접 쓰는 방향으로 통일했고, `validate-structural`·`cli-current`의 로컬 `writeDoc`은
짝 문서를 pending으로 채워 S17 보일러플레이트만 줄인다.
