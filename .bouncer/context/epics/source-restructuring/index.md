---
type: bouncer.epic
title: 소스 구조 개편
description: Remove the verification-current-coordinator cycle and give DAG, path and policy rules a single source, preserving CLI contracts.
resource: .bouncer/context/epics/source-restructuring/index.md
tags:
  - bouncer
  - epic
  - refactor
  - dag
  - coordinator
  - test-contract
timestamp: '2026-10-16T13:46:29.626+09:00'
bouncer:
  id: source-restructuring
  epic_id: source-restructuring
  status: approved
  supersedes: []
---
# 소스 구조 개편

## Intent
- 문제: 실행 조정 모듈 하나에 DAG 계산·원장 저장·검증 호출이 몰려 있고, `verification → current → coordinator → verification` 순환과 복제된 정책·타입이 남아 있어 한 규칙을 바꿀 때 검토 범위가 커진다. 구현 배치에 고정된 테스트와 넓은 CLI 적재 범위도 내부 구현 교체를 막는다.
- 목표: 순환을 없애고 규칙과 계약의 정본을 하나로 모으며, 선택한 명령의 기능만 불러오는 경계를 만든다. 사용자 CLI 입출력과 동시성 계약은 바꾸지 않는다.

## Success criteria
1. 모듈 의존 그래프(지연 `require` 포함)에서 `verification`·`current`·`coordinator`를 지나는 순환이 없고, 그래프 전체에 순환이 없다는 것을 테스트가 검사한다.
2. DAG·경로 규칙 모듈(`execution-dag`, `path-overlap`)과 정책·계약 모듈(`review-policy`, `execution-contracts`)은 CLI·문서 검증·`coordinator`·`current`·`verification`을 전이적으로도 참조하지 않는다.
3. 리뷰 위험도 enum과 리뷰 관점 목록, Task·ledger 핵심 타입은 각각 정본이 한 곳이고 읽기 타입은 정본에서 파생된다.
4. `coordinator`의 명령 처리에서 원장 저장·Git 작업·검증 호출의 책임이 분리되고, 잠금 밖 검증과 잠금 안 재확인 순서가 보존된다.
5. `finalize`의 증적 수집·검사·표현을 구분할 수 있고, `commit`이 `finalize`를 공통 기반처럼 가져오지 않는다.
6. help와 unknown-command 처리는 업무 기능 모듈을 적재하지 않고, 선택한 명령의 기능만 지연 로딩한다.
7. 기능 간 소비자는 공개 인터페이스와 공통 도메인 계약을 쓰고 다른 기능의 내부 파일을 직접 가져오지 않는다.
8. 내부 helper의 이름·파일·분해 방식을 바꿔도 외부 계약 테스트를 수정하지 않는다.
9. 구현 고정 테스트의 전환 판단이 inventory 문서로 추적되고, 전환 전 테스트가 보호하던 실패 모드는 전환 후에도 다른 검사로 남는다.
10. 모듈 수·테스트 수·로드 범위·실행 시간·coverage를 변경 전후로 비교한 기록이 inventory 문서에 남는다.
11. 기존 CLI 입출력, 상태 전이, 승인·검증·리뷰 증적, 커밋 이력 연결이 보존되어 각 blueprint에서 `npm run ci`가 통과한다.
12. 빌드 생성본(`scripts/lib`)과 배포 경로가 일치한다.

## Out of scope
- Epic 문서의 기능 재분류와 식별자 이관.
- 기존 CLI 명령의 삭제·병합과 사용자 대상 출력 형식 변경.
- 범용 DI 컨테이너와 여러 기능을 모은 `utils` 파일.
- coverage 임계값 하향.
- 파일 줄 수 감소 자체를 목표로 한 변경.

## Blueprints
* [001 공유 계약 정본과 DAG·경로 규칙 추출](blueprints/foundation-cleanup/index.md) - 리뷰 정책·실행 타입 정본, `execution-dag`·`path-overlap` 추출로 순환 제거, 구현 고정 테스트 전환, 소비자·경계 inventory 문서 (`scripts/src/lib`, `test/`, `docs/architecture/`)
* [002 검증 대상 선택·finalize 분리와 CLI 지연 로딩](blueprints/boundary-introduction/index.md) - 검증 대상 선택 모듈, 공통 Git·커밋 메시지와 finalize 단계 모듈, CLI 정적 usage·명령별 지연 로딩, 영역 배치 inventory (`scripts/src/lib`, `test/`, `docs/architecture/`)
* [003 실행 조정 책임과 planning 공개 경계 분리](blueprints/execution-planning-boundaries/index.md) - coordinator 원장·Git·검증·명령 책임 분리, planning snapshot 공통 계약, 동일 조건의 전후 측정과 inventory 반영 (`scripts/src/lib`, `scripts/measure-source-boundaries.js`, `test/`, `docs/architecture/`)
