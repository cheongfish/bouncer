---
type: bouncer.blueprint
title: repair task 통합 경로와 preflight 경로 비교
description: Lets coordinator integrate accept repair task documents so repair waves reach verified evidence, and compares run preflight paths after normalization and realpath.
resource: .bouncer/context/epics/099-bouncer-improvements-2026-10-14/blueprints/003-repair-integrate-path/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - repair
  - preflight
  - pointer
timestamp: '2026-10-14T13:28:35.044+09:00'
bouncer:
  id: '003'
  epic_id: '099'
  blueprint_id: '003'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# repair task 통합 경로와 preflight 경로 비교

Epic: [099](../../index.md)

## Intent
coordinate repair가 만든 task 문서 때문에 integrate가 거절되어 수리 wave가 CLI 안에서 끝나지 않던 경로를 열고, 통합 뒤 integration 증적이 verified가 되게 함.
run preflight가 해석 전 문자열로 포인터를 비교하던 것을 정규화·realpath 경로 비교로 바꿈.

## Contract
- 인터페이스:
  - `bouncer coordinate integrate`의 `integration-source-mutated` 판정에서, 원장 task 중 `dynamic: true`인 task의 증적 파일(`evidenceFiles(reviewMode)`가 정하는 `tasks/<id>/` 아래 파일)은 status와 관계없이 허용한다. 실패 이유 문자열과 결과 shape는 바꾸지 않는다.
  - `bouncer run preflight --blueprint <dir>`의 `pointer-mismatch`(`ok: false`, `expected`, `actual`) 조건을 "정규화한 repo 상대 경로가 정규화한 포인터 blueprint와 다르거나, 실재하는 요청 경로의 realpath가 repo realpath 밖"으로 바꾼다. `expected`·`actual`의 의미는 유지한다.
- 데이터·상태:
  - 원장 schema, seed manifest, 포인터 저장 형식은 바꾸지 않는다. integrate는 기존대로 worker 증적을 integration으로 복사해 `tasks.md`를 `verified`로 만든다.
  - preflight는 파일을 쓰지 않는다. 손상된 원장(JSON 파싱 실패)은 지금처럼 miss로 보고 문서 status로 판정하며, 이를 테스트로 고정한다.
- 수용 기준: epic 성공 기준 14–17을 충족한다. 기존 coordinator·finalize·preflight 테스트는 바뀐 계약 외에는 그대로 통과한다.
- 검증 명령: 각 task의 `bouncer.verify`는 `npm run ci`이다. focused 명령은 task Checklist에 둔다.
- 실패 모드·엣지 케이스:
  - blueprint 리뷰 모드에서는 repair가 `review.md`를 만들지 않으므로 허용 목록도 `tasks.md`·`verification.md`뿐이다.
  - dynamic task 증적 밖의 소스·문서 미커밋 변경은 계속 `integration-source-mutated`다.
  - 요청 경로가 실재하지 않으면 realpath를 계산하지 않고 문자열 정규화 결과만으로 판정한다. 그 뒤 문서를 읽지 못하면 기존 `blueprint-status-unknown`이다.
  - repo 루트 자체가 symlink 아래 있어도 양쪽을 realpath로 비교하므로 repo 안 경로는 통과한다.
  - 포인터에 끝 슬래시·`./`가 섞여 저장된 경우도 같은 정규화를 거쳐 비교한다.

## Out of scope
- `bouncer verify --task`, seed manifest에 repair 문서를 등록하는 방식, coordinator 보고 형식(R4).
- 손상된 원장을 fail-closed로 바꾸는 판단(F3), S34 task leaf 중복 순회 리팩터(F4).
- `parsePathIds` 자체와 다른 호출부, `rules/current-pointer.md`의 포인터 계약.

## One-commit justification
- 두 결함(R1·R2, R3)은 099/002 drive에서 함께 드러났지만 서로 다른 파일을 고친다. task 둘로 나눠 한 wave에서 병렬로 진행하고 하나의 PR로 묶는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - repair task 증적을 integrate가 허용
* [Tasks 002](tasks/002/tasks.md) - preflight 정규화·realpath 경로 비교와 손상 원장 테스트
* [Verification](tasks/001/verification.md) - task별 실행 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
