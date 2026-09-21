---
type: bouncer.blueprint
title: 규모·위험 기반 리뷰 디스패치
description: Selects bounded plan and execute review strategies from deterministic document, diff, and risk inputs.
resource: .bouncer/context/epics/075-adaptive-review-dispatch/blueprints/001-adaptive-review-dispatch/index.md
tags:
  - bouncer
  - blueprint
  - review
  - dispatch
  - risk
timestamp: '2026-09-21T10:38:33.372+09:00'
bouncer:
  id: '001'
  epic_id: '075'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 규모·위험 기반 리뷰 디스패치

Epic: [075](../../index.md)

## Intent
CLI는 Plan 문서와 Execute diff의 규모·위험 신호를 정규화해 reviewer 호출 전략을 반환함.
Plan과 Execute controller는 같은 결과를 named·fallback·inline 경로에 적용하고 기존 리뷰 수렴 순서를 유지함.

## Contract
- 인터페이스:
  - `bouncer review-dispatch plan --blueprint <dir>`는 structural validation을 먼저 실행하고 `skip | single | clustered` 전략, task cluster, reviewer 관점과 선택 근거를 JSON으로 반환한다.
  - `bouncer review-dispatch execute --blueprint <dir> --task <ddd> --base <sha> --head <sha>`는 frozen diff 통계와 task의 `bouncer.review_risk`를 읽고 `single | parallel` 전략, reviewer 관점과 선택 근거를 JSON으로 반환한다.
  - `bouncer.review_risk`는 `public_interface | authentication | authorization | credential`의 중복 없는 배열이며, Plan authoring이 Interface와 Touch를 근거로 명시한다.
- 데이터·상태:
  - Plan에서 구현 task가 1개면 `single`, 2개 이상이면 Interface의 backtick 식별자 또는 Touch 경로가 겹치는 연결 요소를 cluster로 삼는 `clustered`다. verification node는 task 수와 cluster에서 제외한다.
  - Execute에서 changed file이 3개 이하이고 `additions + deletions <= 200`이면 `single`, 둘 중 하나라도 넘으면 기존 세 관점의 `parallel`이다. 위험 flag가 있으면 두 전략 모두 `security`를 추가한다.
  - 분류 payload는 review 문서에 새 상태를 저장하지 않는다. 기존 round/finding ledger는 실제 호출 관점만 기록하며 legacy 관점 이름도 계속 읽는다.
- 수용 기준: Epic 성공 기준 1~7. CLI JSON, role payload, round ledger가 같은 전략과 frozen target을 가리킨다.
- 검증 명령: `npm test`.
- 실패 모드·엣지 케이스:
  - Plan 문서가 structural validation에 실패하거나 task Interface·Touch를 읽을 수 없으면 dispatch를 시작하지 않고 실패 원인을 반환한다.
  - unknown·duplicate `review_risk`, 존재하지 않는 task, 해석할 수 없는 base/head와 Git diff 실패는 축소 판정으로 대체하지 않고 거부한다.
  - task 간 중첩이 없더라도 2개 이상인 full Plan은 각 task를 local cluster로 판단한 뒤 global review를 수행한다.
  - `scale: light`는 `skip`이며 `context-review.md`를 만들거나 inline 대체 리뷰를 수행하지 않는다.
  - 변경 파일 3개 또는 변경 줄 200개는 작은 diff에 포함하고, 경계값을 하나라도 넘으면 `parallel`이다.
  - 위험 flag가 있는 작은 diff는 combined reviewer와 security reviewer를 서로의 finding 없이 같은 frozen target에서 호출한다.
  - delta certification은 discovery 전략과 관계없이 reviewer 한 명만 호출하고 기존 origin 규칙을 유지한다.

## Out of scope
- `bouncer validate`의 G/S 의미와 finding 필수 필드 변경
- 위험 flag를 경로명·diff 자연어·finding 수로 추론
- review 결과를 다수결로 승인하거나 severity를 dispatch 입력으로 사용
- P2.3 verification reuse와 P2.4 coordinator checkpoint

## One-commit justification
- 이 blueprint는 세 task commit으로 나눈다. 첫 commit이 분류기·CLI·validator 계약을 만들고, 다음 두 commit이 각각 Plan과 Execute dispatch에 연결한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - review dispatch 분류기·CLI·구조 계약
* [Tasks 002](tasks/002/tasks.md) - Plan의 single·clustered context review 연결
* [Tasks 003](tasks/003/tasks.md) - Execute의 single·parallel·security review 연결
* [Verification 001](tasks/001/verification.md) - 분류기·CLI 검증 증적
* [Review 001](tasks/001/review.md) - 분류기·CLI 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - Plan dispatch 검증 증적
* [Review 002](tasks/002/review.md) - Plan dispatch 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - Execute dispatch 검증 증적
* [Review 003](tasks/003/review.md) - Execute dispatch 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
