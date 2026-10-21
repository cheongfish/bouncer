---
type: bouncer.blueprint
title: 계획 리뷰 반복 제어와 이력 보존
description: Persist bounded context-review cycles and require the recorded previous dispatch for follow-up reviews.
resource: .bouncer/context/epics/plan-workflow/blueprints/review-cycle-control/index.md
tags:
  - bouncer
  - blueprint
  - plan
  - context-review
  - convergence
timestamp: '2026-10-12T21:30:41.911+09:00'
bouncer:
  id: review-cycle-control
  epic_id: plan-workflow
  blueprint_id: review-cycle-control
  status: closed
  order: 25
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 반복 제어와 이력 보존

Epic: [096](../../../plan-review-convergence/index.md)

## Intent
전체 재시작으로 리뷰 이력과 횟수가 초기화되는 경로를 CLI 기록으로 막음.
후속 리뷰의 previous를 필수로 만들고, 계획 workflow가 저장된 cycle과 dispatch를 사용하게 함.

## Contract
- 공개 명령: bouncer context-review start|record|restart --blueprint <dir>. start는 --dispatch <json>, record는 --dispatch <json> --round <json>와 선택 --status requested|addressed|accepted, restart는 --dispatch <json> --reason <text>를 받는다. accepted-risk는 record의 선택 --accept-risk <finding ids>로 사용자 승인된 ID를 지정한다.
- cycle: 정본 상태는 .bouncer/runtime/context-review/<blueprint 경로의 / 를 __로 바꾼 값>/state.json 이며 id(cr-<16 hex>), restart_count, history, active_reports, latest_dispatch를 둔다. id는 start에서 한 번 생성하고 자동 restart의 최대 횟수는 1이다. restart_count는 runtime 삭제로 초기화되지 않도록 restart가 blueprint-root context-review.md의 bouncer.context_review.restart_count에 같은 값을 하한 기준으로 남기고, state가 없거나 더 작으면 이 값을 따른다.
- dispatch 보관: CLI가 .bouncer/runtime/context-review/<ns>/cycles/<cycle id>/ 아래에 sha256 파일명의 immutable dispatch·보고 payload를 저장한다. latest_dispatch는 경로와 파일 sha256을 가진 참조다. 재시작 history는 당시 rounds/findings와 보고·dispatch 참조·사유를 보존한다. 저장된 dispatch는 읽을 때 현재 blueprint·snapshot에서 parts/scope_parts를 다시 계산해 신뢰하지 않는다.
- open reviewer 보고는 cycle.active_reports에 보관한다. accepted 기록에서만 active 보고를 합쳐 canonical rounds/findings를 만든다. canonical finding status는 resolved|accepted 그대로이며 accepted에는 note가 필요하다.
- start 재호출은 동일 cycle을 반환하고 아무 기록도 초기화하지 않는다. restart는 이전 상태를 보관한 뒤 횟수와 active sequence를 함께 바꾸고 accepted 상태를 requested로 내린다.
- 후속 분류는 latest_dispatch와 일치하는 previous가 필수다. 처음의 증거 없는 pending 문서는 previous 없이 discovery를 분류할 수 있다. 분류 CLI는 읽기 전용이다.
- record의 accepted는 리뷰 처분 기록이며 계획 승인과 plan gate 통과를 대신하지 않는다. unresolved must_fix는 acceptance를 거부한다. 명시적으로 승인받은 accepted-risk ID와 note만 예외로 기록한다.
- 수용 기준: epic Success criteria 1~4, 10~12. task 001 → task 002로 통합한다.
- 검증 명령: npm run ci. 사용자가 verify ACQ에서 확인했으며 모든 task frontmatter에 설정한다.
- 실패 모드·엣지 케이스:
  - malformed 입력·stale target·다른 cycle·잘못된 round 순서·경로 탈출·두 번째 restart는 reason/cause/next와 exit 1로 거부하고 기존 바이트를 보존한다. CLI 인자 오류는 exit 2다.
  - 기존 cycle이 없는 리뷰 증거는 start로 덮어쓰지 않는다. 일치하는 이전 payload를 복구한 뒤 명시적 legacy restart로 import하며, 그 전환은 재시작 1회를 소비하고 기존 증거를 보관한다. previous를 복구할 수 없으면 사용자에게 보고한다.
  - light의 strategy skip은 이 상태 CLI 대상이 아니며, 기존 skip 동작을 유지한다.
  - record·restart의 재호출은 저장된 전이 식별자와 기대 상태를 확인한다. 동일 완료 요청은 no-op이고 오래된 다른 요청은 충돌 오류다.

## Out of scope
- 문서 보완의 partial 확대와 snapshot 버전 변경은 BP 002가 맡는다.
- execute review record, 기존 review.md writer, 승인 자동화, cycle reset 기능.

## One-commit justification
상태 writer와 plan 소비자는 같은 cycle 참조 계약으로 연결되므로 하나의 PR에서 두 커밋으로 순서대로 통합한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - CLI와 상태·snapshot 계약
* [Tasks 002](tasks/002/tasks.md) - 소비자 연결과 workflow 계약
* [Verification 001](tasks/001/verification.md) - task 검증 증적
* [Verification 002](tasks/002/verification.md) - task 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 리뷰
