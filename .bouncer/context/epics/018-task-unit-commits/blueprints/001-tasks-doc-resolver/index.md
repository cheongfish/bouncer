---
type: bouncer.blueprint
title: task 문서를 번호별 다중 파일로 다루는 리졸버 도입
description: Blueprint 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T17:29:57.449+09:00'
bouncer:
  id: '001'
  epic_id: '018'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - blueprint 하나가 커밋 하나에 묶여 성격이 다른 변경이 한 브리프에 섞이거나 리뷰 단위가 잘게 부서짐
    - task 문서를 읽는 자리가 다섯 곳으로 흩어져 있어 파일 이름 규칙을 한 곳에서 바꿀 수 없음
---
# task 문서를 번호별 다중 파일로 다루는 리졸버 도입

Epic: [018](../../index.md)

## Intent
- 문제: task 문서는 `tasks.md` 한 이름으로 고정돼 있고, 그 이름을 스캐폴드·검증·
  포인터·커밋 훅·검증 명령 조회가 각자 하드코딩한다. blueprint 안에 task를 여러 개
  두려면 다섯 곳이 동시에 바뀌어야 한다.
- 완료 조건: 파일 이름과 id 규칙을 리졸버 한 곳으로 모으고, 번호가 붙은 task 문서를
  여러 개 둘 수 있으며, 기존 `tasks.md` 하나짜리 blueprint는 그대로 통과한다.

## Contract
- 인터페이스
  - 새 모듈 `scripts/src/lib/tasks-docs.ts`가 blueprint 디렉터리를 받아 task 문서
    목록을 번호 오름차순으로 돌려준다. 목록에는 각 문서의 저장소 상대 경로와
    task id가 들어간다. 레거시 `tasks.md`만 있는 경우와 두 형식이 섞인 경우를
    호출자가 구분할 수 있어야 한다.
  - `parsePathIds`가 `tasks-{ddd}.md`를 tasks 문서로 인식한다.
  - `bouncer scaffold blueprint`가 `tasks.md` 대신 `tasks-001.md`를 만든다.
  - `bouncer validate`가 발견된 모든 task 문서를 구조 검사하고, plan 게이트
    G3·G4·G5·G10·G11·G12를 문서마다 적용한다.
  - `listReadyBlueprints`, finalize의 다음 blueprint 계산, 커밋 훅의 경로 판정,
    검증 명령 조회가 모두 이 리졸버를 거친다.
- 데이터·상태
  - task 문서 `bouncer.id`는 파일 이름에서 나온다. `tasks-{NNN}.md`는
    `TASKS-{NNN}`, 레거시 `tasks.md`는 지금처럼 `TASKS-{blueprint id}`다.
  - 활성 포인터 스키마는 `{blueprint, base}` 그대로다. task 선택은 다음 blueprint.
  - 새 설정 키, 새 CLI 하위 명령을 만들지 않는다.
- 수용 기준: 에픽 성공 기준 1~6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - `tasks.md`와 `tasks-{ddd}.md`가 한 blueprint에 섞임 — 어느 쪽이 정본인지
    판정할 수 없으므로 새 구조 실패 코드로 거절한다. 조용히 한쪽을 고르지 않는다.
  - task 문서가 하나도 없음 — 지금과 같다. blueprint 문서 부재(S11) 또는 G3에서
    걸린다. 새 경로를 만들지 않는다.
  - 번호가 건너뛰어 있음(`001`, `003`) — 허용한다. 번호는 정렬 순서만 정한다.
  - `tasks-1.md`, `tasks-0001.md` 처럼 세 자리가 아닌 이름 — task 문서로 보지
    않는다. 검증 대상에서 빠져 조용히 무시되므로, 이 규칙을 문서에 남긴다.
  - 여러 task 문서가 서로 다른 `bouncer.verify`를 선언함 — 번호가 가장 앞선
    선언을 쓴다. 검증 명령의 task 단위 분리는 이 blueprint 범위 밖이다.
  - 커밋 훅의 `affected_paths` 판정 — 모든 task 문서의 합집합으로 본다. task
    포인터가 없는 동안은 어느 task를 작업 중인지 알 수 없으므로 넓은 쪽이 안전하다.
    좁히는 일은 포인터 스키마 blueprint에서 한다.

## Out of scope
- 포인터에 task 필드 추가, 실행 시점 task 선택.
- `verification.md` / `review.md`를 task별로 나누는 일(G6~G8).
- finalize 커밋 메시지·PR 단위 재정의(G15, `commit_intent`).
- 기존 `tasks.md` 문서 일괄 리네임. 이 저장소에 이미 쌓인 epic 문서는 그대로 둔다.
- `bouncer migrate ids`의 동작 변경. 새 이름은 마이그레이션 대상이 아니다.

## One-commit justification
- 파일 이름 규칙, id 규칙(S5), 리졸버, 그 리졸버를 쓰는 다섯 소비자, 그리고 하드룰
  문구가 서로를 전제한다. 스캐폴드만 새 이름을 내면 검증이 문서를 못 찾고,
  검증만 고치면 만들어지는 문서가 없다. 나누면 반드시 게이트가 깨진 커밋이 남는다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
