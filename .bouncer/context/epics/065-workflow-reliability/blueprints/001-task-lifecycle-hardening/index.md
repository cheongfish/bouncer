---
type: bouncer.blueprint
title: Task 수명주기 안정화
description: Hardens context lint selection and review-round finding contracts across task execution.
resource: .bouncer/context/epics/065-workflow-reliability/blueprints/001-task-lifecycle-hardening/index.md
tags:
  - bouncer
  - blueprint
  - task-lifecycle
  - context-lint
  - review-round
timestamp: '2026-09-06T11:13:59.474+09:00'
bouncer:
  id: '001'
  epic_id: '065'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 task-lifecycle-hardening

Epic: [065](../../index.md)

## Intent
- 아직 작성 중인 이웃 문서 뼈대가 현재 작업의 검사를 막지 않게 하고, 재리뷰가 필요할 때 이전 발견과 처분 근거를 잃지 않게 함.
- 문맥 주석 검사와 리뷰 발견 계약이 문서 상태, 조건부 세 번째 회차, 위험 수용, 후속 이연을 구분하도록 함.

## Contract
- 인터페이스: 인자 없는 context 주석 검사는 active pointer가 가리키는 blueprint에서 문서별 `bouncer.status`가 `pending`인 sibling만 제외한다. 명시적 파일 인자는 모든 전달 파일을 검사한다. `/bouncer-execute`는 기본 두 번 뒤 조건부 세 번째 review round를 한 번 허용하고 `/bouncer-run`은 같은 계약을 참조한다.
- 데이터·상태: execute `bouncer.review.findings[]`는 `resolved | accepted | deferred`를 구분하며 `accepted`와 `deferred`는 각각 근거 `note`를 요구한다. `deferred`는 현재 task 정확성에 영향을 주지 않는 독립 후속 작업에만 사용한다. `bouncer.context_review.findings[]`는 기존 `resolved | accepted`만 유지한다. 선택적 `bouncer.review.rounds[]`는 round 번호, 이전 finding ID, `new`·`resolved`·`regressed` 수를 기록한다.
- 수용 기준: Epic Success criteria 1~7.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - sibling 문서 frontmatter가 없거나 파싱할 수 없거나 status가 `pending`이 아니면 검사 대상에서 숨기지 않는다.
  - 한 task bundle 안에서 문서 status가 섞이면 각 문서를 독립 판정한다.
  - explicit-file 호출에는 sibling 필터를 적용하지 않는다.
  - 세 번째 round 진입 전 기존 blocker·major가 남거나 verify가 실패하면 즉시 재계획한다.
  - 세 번째 round 뒤 finding이 재발하거나 새 설계·dependency·공개 인터페이스·scope 확대가 필요하면 재계획한다.
  - G14는 `deferred`의 형식과 note를 검증한다. reviewer와 controller는 현재 task 정확성 문제를 `deferred`로 분류하거나 그런 finding이 남은 review를 accepted로 바꾸지 않는다.

## Out of scope
- context 문서의 scaffold 본문과 task status 전이 방식 변경
- review severity enum과 `review.required === false` 정책 변경
- reviewer 수, 모델 선택, fan-out 변경
- 기존 review 문서 일괄 마이그레이션

## One-commit justification
- Task 001은 검사기와 전용 회귀 테스트만 묶는다. Task 002는 finding schema, gate, template, reviewer/controller 절차와 계약 테스트를 함께 바꿔 중간 상태에서 문서와 실행 규칙이 어긋나지 않게 한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 리뷰 round와 finding 처리 계약 구현 브리프
* [Verification 002](tasks/002/verification.md) - 리뷰 계약 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 계약 변경 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
