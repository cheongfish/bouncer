---
type: bouncer.blueprint
title: 공용 helper 통합과 경로 모듈 순환 제거
description: Consolidate duplicated digest, record, error, and path helpers into shared modules and remove the paths/tasks-docs import cycle.
resource: .bouncer/context/epics/runtime-architecture/blueprints/shared-helpers/index.md
tags:
  - bouncer
  - blueprint
  - refactor
  - digest
  - paths
timestamp: '2026-10-11T14:18:15.505+09:00'
bouncer:
  id: shared-helpers
  epic_id: runtime-architecture
  blueprint_id: shared-helpers
  status: closed
  order: 29
  commit_type: refactor
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 공용 helper 통합과 경로 모듈 순환 제거

Epic: [092](../../../source-test-hygiene/index.md)

## Intent
- 승인·검증 digest를 만드는 helper와 작은 판별 helper가 여러 모듈에 복사돼 한 곳만 고치면 계산 결과가 어긋날 수 있었음.
- 정의를 공용 모듈 하나로 모으고 경로 모듈 순환을 없애되, 모든 공개 동작과 digest 값은 그대로 유지함.

## Contract
- 인터페이스: digest helper(`canonicalJson`, `sha256Canonical`), 레코드·오류 판별 helper(`isRecord`, `catchMessage` 등 본문이 같은 helper), 경로 helper(`toPosix`)를 각각 공용 모듈 하나에서 내보낸다. 호출하던 모듈은 그 정의를 import한다. CLI 명령, 게이트 코드, JSON 출력 형태는 바뀌지 않는다.
- 데이터·상태: 승인 snapshot, verify 원장 `source_digest`, plan snapshot이 쓰는 digest 문자열은 같은 입력에 대해 통합 전과 같다. 디스크 형식은 바뀌지 않는다.
- 수용 기준: 에픽 Success criteria 1–3, 10.
- 검증 명령: `npm run ci`.
- 실패 모드·엣지 케이스:
  - digest 직렬화 순서나 배열·`null` 처리가 바뀌면 기존 승인 snapshot이 G24 stale이 된다. 통합 전 값으로 고정한 테스트가 이를 거절한다.
  - 본문이 다른 변형(예: `isRecord`의 배열 판정 방식)은 의미가 같을 때만 합친다. 의미가 다르면 이름을 나눠 남긴다.
  - `toPosix`는 Linux에서도 `\`를 `/`로 바꾼다. 지금 `path.sep`으로 나누던 `symbol-index`는 백슬래시가 든 경로에서 결과가 달라지며, 이 변화는 받아들인다.
  - 순환을 끊으려고 모듈을 옮길 때 새 순환이 생기면 안 된다.

## Out of scope
- 대형 함수(`coordinate`, `runCheckGate`, `finalize`, `prepareFinalizeDigest`) 분해.
- 본문이 다른 helper의 동작 통일(`toPosix` 제외).
- 테스트 계층·문서 테스트 정리(BP 002).

## One-commit justification
- 변경은 정의 이동이고, 동작이 달라지는 곳은 `toPosix` 통일로 Linux에서 백슬래시가 든 경로의 `symbol-index` 출력이 바뀌는 한 군데뿐이다. 리뷰어는 한 PR에서 "이 예외를 빼면 digest 값과 공개 동작이 같다"를 한 번에 판단할 수 있다. task 두 개는 digest·판별 helper와 경로 helper로 나뉘지만 같은 리팩터 기준을 공유한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - digest·레코드·오류 helper 통합
* [Tasks 002](tasks/002/tasks.md) - `toPosix` 통합과 `paths`↔`tasks-docs` 순환 제거
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
