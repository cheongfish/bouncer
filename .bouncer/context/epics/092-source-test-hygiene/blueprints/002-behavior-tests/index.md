---
type: bouncer.blueprint
title: 동작 중심 테스트 지침과 테스트 계층 분리
description: Add behavior-focused testing guidance for consumer projects, split tests into unit and integration tiers, and trim slow git setup and wording tests.
resource: .bouncer/context/epics/092-source-test-hygiene/blueprints/002-behavior-tests/index.md
tags:
  - bouncer
  - blueprint
  - testing
  - ci
  - guidance
timestamp: '2026-10-11T14:18:15.505+09:00'
bouncer:
  id: '002'
  epic_id: '092'
  blueprint_id: '002'
  status: closed
  commit_type: test
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 동작 중심 테스트 지침과 테스트 계층 분리

Epic: [092](../../index.md)

## Intent
- 문서 문구를 정규식으로 검사하는 테스트와 매번 git 저장소를 새로 만드는 테스트가 verify와 CI를 느리게 하고, 소비 프로젝트 워커에게도 동작 중심 테스트 기준이 없었음.
- 워커 지침에 동작 중심 테스트 규칙을 넣고, 테스트를 unit·integration으로 나누며, 느린 저장소 준비와 문구 고정 테스트를 정리함.

## Contract
- 인터페이스:
  - 워커 지침: implementer의 tests-first 규칙, spec-authoring Checklist 규칙, reviewer 판정 기준이 같은 테스트 원칙(관찰 가능한 결과 단언, 문구·내부 구현 단언 금지, 형식 자체가 계약일 때만 정규식, 실제 git·프로세스는 integration에서만)을 적는다.
  - npm 스크립트: `test:unit`, `test:integration`을 추가한다. `test`는 전체를 계속 실행한다. `test:coverage`는 병렬로 실행한다. `ci`는 `test:coverage` 다음에 `test:unit`을 실행해 guard 조건을 매 검증마다 확인한다.
  - 계층 목록: 테스트 파일을 계층에 배정하는 단일 정본을 둔다. 배정이 없거나 두 계층에 동시에 있는 파일은 검사 테스트가 실패시킨다. unit 계층은 자식 프로세스 생성을 막는 guard를 로드한 채 실행한다.
- 데이터·상태: 제품 코드(`scripts/src`, `scripts/lib`)와 CLI 출력은 바뀌지 않는다. 바뀌는 것은 테스트, 테스트 helper, npm 스크립트, 문서 lint 규칙, 워커 지침 문서다.
- 수용 기준: 에픽 Success criteria 4–10.
- 검증 명령: `npm run ci`.
- 실패 모드·엣지 케이스:
  - 병렬 coverage에서 공유 경로나 전역 상태 때문에 흔들리는 테스트가 나오면 deviation으로 보고한다(그 파일은 TASKS-002 `affected_paths` 밖이다). 임계값은 낮추지 않는다.
  - fixture 저장소를 복사할 때 `.git/worktrees`처럼 절대 경로를 담은 메타데이터는 복사본에서 깨진다. worktree는 복사 뒤에 만든다.
  - 동작 계약을 지키던 테스트를 지우면 회귀를 놓친다. 삭제는 문구만 지키는 테스트에 한정하고, 계약이 있으면 동작 테스트로 바꾼다.
  - 테스트 삭제로 coverage가 임계값 아래로 떨어지면 임계값을 낮추지 않는다. 보강할 테스트 파일이 task의 `affected_paths` 안에 있으면 동작 테스트를 추가하고, 밖에 있으면 deviation으로 보고한다.
  - 새 테스트 파일을 계층에 배정하지 않으면 검사 테스트가 실패한다.
  - unit 파일이 `scripts/lib`를 거쳐 자식 프로세스를 띄우면 unit 실행의 spawn guard가 그 테스트를 실패시킨다. 그런 파일은 integration에 둔다.

## Out of scope
- 제품 코드 리팩터(BP 001)와 대형 함수 분해.
- `.bouncer/config.json`의 `verify` 변경.
- `.github/workflows/*.yml` 단계 구성 변경. CI는 계속 `npm run ci`를 실행한다.
- 출력 형식이 계약인 CLI·라이브러리 출력에 대한 정규식 단언. 문서 본문만 읽는 테스트 파일이 정리 대상이다.

## One-commit justification
- 여섯 task가 모두 "테스트는 동작을 검증하고 빠르게 돈다"는 같은 기준을 지침·스크립트·테스트에 적용하므로, 리뷰어가 한 PR에서 지침과 실제 테스트가 일치하는지 대조할 수 있다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 소비 프로젝트용 동작 중심 테스트 지침
* [Tasks 002](tasks/002/tasks.md) - unit·integration 계층과 병렬 coverage
* [Tasks 003](tasks/003/tasks.md) - 느린 git 테스트의 fixture 저장소 재사용
* [Tasks 004](tasks/004/tasks.md) - 에이전트·규칙 문서 문구 테스트 정리와 경로별 문서 lint 계약
* [Tasks 005](tasks/005/tasks.md) - 워크플로 스킬 문서 문구 테스트 정리
* [Tasks 006](tasks/006/tasks.md) - 나머지 문서 전용 테스트 정리와 CHANGELOG
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
