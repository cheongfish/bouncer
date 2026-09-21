---
type: bouncer.blueprint
title: Plan 컨텍스트 입력 최소화
description: Narrows discovery, context-review dispatch, and Graphify queries while preserving plan-quality contracts.
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/003-plan-context-efficiency/index.md
tags:
  - bouncer
  - blueprint
  - discovery
  - context-review
  - graph-suggest
timestamp: '2026-09-21T09:23:36.767+09:00'
bouncer:
  id: '003'
  epic_id: '074'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Plan 컨텍스트 입력 최소화

Epic: [074](../../index.md)

## Intent
`/bouncer-plan`의 discovery, context reviewer dispatch, Graphify 질의를 판단에 필요한 입력으로 제한함.
기존 digest·관점 격리·delta 인증·Graphify advisory 계약을 유지하면서 전체 대화 fork와 과도한 탐색을 막음.

## Contract
- 인터페이스:
  - discovery는 `rg --files` 또는 `rg -l`로 후보를 먼저 정하고, domain 구현·dispatch·scope revision처럼 질문별로 경로와 glob을 분리하며, 관련 line window만 읽는다.
  - named `bouncer-context-reviewer`는 `fork_turns: "none"`으로 시작하고 mode, perspective, frozen digest, 판단할 문서 목록, read-only cwd만 받는다. delta 호출은 새 digest, previous findings, 수정 문서 목록을 받는다.
  - generic fallback은 전체 대화 대신 `agents/bouncer-context-reviewer.md`의 Authority부터 Output contract까지와 동일한 controller input을 받는다.
  - `references/graphify-runner/index.md`가 plan-time query·seed·debug·retry 한도의 정본이 되고, plan skill과 로컬 suggestion reference는 그 규칙을 참조한다.
- 데이터·상태: frontmatter, gate, CLI payload와 Graphify traversal 상한은 바꾸지 않는다. 변경은 workflow 문서와 이를 판정하는 계약 테스트에 한정한다.
- 수용 기준: Epic 성공 기준 7~9. reviewer 입력에는 전체 대화 이력이 없고, Graphify는 짧은 English ASCII noun query와 entry seed 1~2개를 사용하며 cap 진단에만 debug 1회·축소 재시도 1회를 허용한다.
- 검증 명령: `npm test`.
- 실패 모드·엣지 케이스:
  - 네 discovery reviewer는 서로의 findings를 받지 않으며 digest와 관점 격리를 유지한다.
  - delta reviewer는 수정되지 않은 문서 전체나 전체 대화를 받지 않고 previous findings와 실제 수정 문서만 받는다.
  - named agent가 없을 때도 역할 본문을 요약하거나 생략하지 않는다.
  - `low-confidence` 원인이 `seed.fanout_cap` 또는 `traversal.frontier_cap`이 아니면 debug·재시도를 추가하지 않는다.
  - source graph가 없거나 재시도 뒤에도 신뢰도가 낮으면 `suggested_paths`를 비우고 `affected_paths` 확인을 사용자에게 남긴다.

## Out of scope
- context-review의 네 관점, frozen digest, 단일 delta 인증 횟수 축소
- Graphify traversal 상한, compact/debug payload와 source·test-only graph 동작 변경
- `affected_paths` 자동 확정, token telemetry와 자연어 source symbol 추출
- BP 001의 brief 작성 규칙과 BP 002의 dispatch revision 상태 재설계
- `scripts/src/**`, `scripts/lib/**`와 `agents/**`의 runtime 또는 역할 계약 변경

## One-commit justification
- 이 blueprint는 두 task commit으로 나눈다. 첫 commit이 discovery와 reviewer input을 제한하고, 두 번째 commit이 그 입력 절감 원칙을 Graphify 정본과 plan 소비 지침에 연결한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - discovery와 context reviewer 입력 제한
* [Tasks 002](tasks/002/tasks.md) - Graphify query·debug·retry 규칙 정본화
* [Verification 001](tasks/001/verification.md) - discovery·reviewer 계약 검증 명령과 증적
* [Review 001](tasks/001/review.md) - discovery·reviewer 변경 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - Graphify 계약 검증 명령과 증적
* [Review 002](tasks/002/review.md) - Graphify 변경 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
