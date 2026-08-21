---
type: bouncer.blueprint
title: 측정 기반 비용 절감
description: 강화된 게이트 기준선을 고정하고 scaffold 발견 비용을 줄여 같은 프로토콜로 재측정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-21T20:32:39.421+09:00'
bouncer:
  id: '001'
  epic_id: '043'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
---
# 001 측정 기반 비용 절감

Epic: [043](../../index.md)

## Intent
- 문제: 1회차는 PR #53 이전이라 강화된 게이트와 scaffold 힌트의 비용 효과를 분리할 기준선이 없고, scaffold가 유효한 `scope_evidence.basis`와 finding severity 모양을 보여주지 않아 에이전트가 게이트 실패로 계약을 배운다.
- 완료 조건: `c7df084` 기준선을 먼저 남긴 뒤 scaffold 힌트·측정 도구·공유 상태 문서를 고치고 같은 네 on arm을 재실행해 비용과 품질을 비교한다.

## Contract
- 인터페이스: scaffold의 task 주석은 `basis` 엔트리의 `graph`·`status`·`query`·`result`와 허용값을 보여주고, review/context-review 주석은 `severity: blocker | major | minor | nit`를 보여준다. 검증되는 기본값은 계속 비어 있어 작성하지 않은 계획은 plan gate에서 실패한다.
- 데이터·상태: 벤치마크 런은 독립 clone의 임시 상태를 쓴다. 저장소에는 `docs/benchmark/round-2/{baseline,improved}.md`, 회차 비교 인덱스, 상위 benchmark README의 탐색 링크만 남기고 기존 1회차 결과를 덮어쓰지 않는다.
- 수용 기준: Epic 성공 조건 1~3과 7이 참이고, Task 005의 scaffold 개선 후 on-arm 4런에서 G18·S9/G4가 발생하지 않는다.
- 검증 명령: 구현 task는 `npm run ci`; 벤치마크 런은 `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` 네 명령을 모두 기록한다.
- 실패 모드·엣지 케이스: 기준선은 scaffold 수정 전 `c7df084`에서 실행한다. 런마다 독립 clone을 사용하며 `.bouncer/context`나 verify 원장을 재사용하지 않는다. 셸 변수, 모델, 프롬프트, `done_when`, 검증 명령이 달라진 런은 비교에서 제외한다. 원시 산출물이 없거나 블라인드 심사·revert 실행 여부가 빠진 런은 성공 표본으로 세지 않는다.

## Out of scope
- `scale: light` 문서·게이트 축소. BP002에서 breaking change로 다룬다.
- G/S 판정 로직, `scope_evidence` 스키마, finding severity 열거값 변경.
- 1회차 결과 파일 덮어쓰기와 off arm 재실행.

## Delivery order
1. Task 001은 scaffold 변경 전 기준선을 고정한다.
2. Task 002는 scaffold 힌트, Task 003은 측정기 worktree 판정, Task 004는 공유 상태 문서를 각각 한 커밋으로 고친다.
3. Task 005는 개선 후 on arm을 실행하고 기준선과 나란히 비교한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - scaffold 변경 전 `c7df084` on-arm 기준선
* [Tasks 002](tasks/002/tasks.md) - scaffold 스키마 힌트
* [Tasks 003](tasks/003/tasks.md) - benchmark worktree 인식
* [Tasks 004](tasks/004/tasks.md) - 포인터·verify 원장 공유 상태 문서화
* [Tasks 005](tasks/005/tasks.md) - 개선 후 2회차 측정과 비교
* [Verification 001](tasks/001/verification.md) - 기준선 실행 증적
* [Verification 002](tasks/002/verification.md) - scaffold 검증 증적
* [Verification 003](tasks/003/verification.md) - 측정기 검증 증적
* [Verification 004](tasks/004/verification.md) - 문서 계약 검증 증적
* [Verification 005](tasks/005/verification.md) - 재측정 실행 증적
* [Review 001](tasks/001/review.md) - 기준선 리뷰
* [Review 002](tasks/002/review.md) - scaffold 리뷰
* [Review 003](tasks/003/review.md) - 측정기 리뷰
* [Review 004](tasks/004/review.md) - 문서 리뷰
* [Review 005](tasks/005/review.md) - 재측정 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
