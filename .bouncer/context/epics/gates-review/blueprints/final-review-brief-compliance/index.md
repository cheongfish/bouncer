---
type: bouncer.blueprint
title: 브리프 이행 기준 최종 리뷰와 수정 1회 허용
description: Narrow the run final review of review_contract brief blueprints to brief-compliance perspectives and allow one review repair plus one delta
resource: .bouncer/context/epics/gates-review/blueprints/final-review-brief-compliance/index.md
tags:
  - bouncer
  - blueprint
  - final-review
  - review-dispatch
  - must-fix
  - review-contract
timestamp: '2026-10-22T22:59:42.756+09:00'
bouncer:
  id: final-review-brief-compliance
  epic_id: gates-review
  blueprint_id: final-review-brief-compliance
  status: closed
  order: 17
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 최종 리뷰의 관점·must_fix 판정·라운드 규칙을 바꾸는 리뷰 판정 정책 변경이라 gates-review에 귀속
  supersedes: []
---
# 브리프 이행 기준 최종 리뷰와 수정 1회 허용

Epic: [gates-review](../../index.md)

## Intent
새 리뷰 계약 표식이 붙은 blueprint의 최종 리뷰는 승인된 브리프를 이행했는지만 두 관점으로 판정하고, 브리프 위반은 수정 1회와 delta 1회로 닫을 수 있게 한다.
표식이 없는 blueprint와 이미 저장된 단일 라운드 리뷰는 지금 동작을 그대로 유지한다.

## Background
session-handoff-note drive의 최종 리뷰는 4관점 합계 약 32만 토큰을 쓰고 minor finding 4건만 냈다.
그중 브리프 Checklist 위반(정확한 reason 대신 정규식 단언)은 고칠 길이 없어 `deferred must_fix`로 PR 경고에 남았다.
EPIC 107 BP 002는 최종 리뷰를 discovery 한 라운드로 줄였는데, 이 blueprint는 표식 blueprint에 한해 그 결정을 되돌린다(사용자 확인).

## Contract
- 인터페이스:
  - blueprint frontmatter `bouncer.review_contract` — 허용 값 `brief` 하나. 새 full `scaffold blueprint`만 쓰고, 부재는 legacy다. light blueprint에는 쓰지 않는다. 구조 검사 S38은 값이 `brief`가 아닌 경우, `scale: light`와 함께 있는 경우, `review_scope: blueprint` 없이 있는 경우를 거절한다.
  - 잘못된 표식(값이 `brief`가 아님)은 S38이고, 런타임 소비자(dispatch·record·coordinator·G21)는 legacy로 접지 않고 `review-contract-invalid`로 거절한다(G21은 이 문자열을 실패 메시지에 담는다).
  - `review-dispatch execute --blueprint <dir>`(task 없음, discovery): 표식 blueprint면 `perspectives`가 `['spec_scope','correctness_tests']`이고, commit task `review_risk` 합집합에 `authentication`·`authorization`·`credential` 중 하나가 있을 때만 `security`를 더한다. 규모 임계값으로 관점을 늘리지 않는다.
  - `review-dispatch execute --blueprint <dir> --mode delta`(task 없음): 표식 blueprint면 받아 `single`/`['combined']`을 낸다. 표식이 없으면 지금처럼 사용법 오류(exit 2)다.
  - root `review.md` record: 표식 blueprint에서 `must_fix` finding의 `brief_clause`는 브리프 조항 참조(`tasks/<NNN> <브리프 8섹션 중 하나>` 또는 `Contract`로 시작)여야 하고, `deferred` `must_fix`가 남은 문서는 accepted로 기록되지 않으며, 라운드 순서는 `discovery` 또는 `discovery,delta`만 받는다. G21은 같은 deferred 규칙과 잘못된 표식만 실패로 남기고 라운드 순서 형식은 record에 맡긴다.
- 데이터·상태:
  - 표식 blueprint의 최종 리뷰 흐름은 discovery → (`must_fix`가 있으면) `repair --review-finding` 1회 → terminal verification 재실행 → delta 1회 → `accepted`, 또는 남은 위반으로 `final-review-blocked`다.
  - 컨트롤러가 reviewer의 `must_fix`를 `advisory`로 낮추면 기존 `severity_changes`에 사유 코드 `no-brief-clause` 또는 `not-brief-violation`을 남긴다.
  - ledger 형식은 바꾸지 않는다. 기존 decision kind와 repair wave 상한을 그대로 쓴다.
- 수용 기준: epic Success criteria 14–17.
- 검증 명령: `npm run ci` (terminal TASKS-005).
- 실패 모드·엣지 케이스:
  - 수정에 승인된 `affected_paths` 밖 경로가 필요하면 repair를 받지 않고 `blocked`로 사용자에게 올린다.
  - 수정 뒤 terminal verification이 실패하면 delta로 가지 않는다.
  - delta가 새 위반을 찾거나 이전 위반이 남으면 두 번째 수정 없이 `final-review-blocked`다. 사용자가 명시적으로 승인한 뒤에만 `review accept-risk`로 닫는다.
  - repair 1회·delta 1회를 쓴 뒤의 delta record와 리뷰 원인 repair·supplement는 `final-review-single-round`로 거절한다.
  - `review_contract` 값이 `brief`가 아니거나 light와 함께 있으면 plan gate에서 S38로 거절한다. 런타임은 값이 `brief`가 아닌 표식을 light 여부와 무관하게 `review-contract-invalid`로 멈추고, 값은 맞지만 light·`review_scope` 조건이 어긋난 조합은 S38에 맡긴다.
  - 같은 fingerprint finding은 관점을 넘어 하나로 병합한다(현행 유지).
  - reviewer 입력의 `intent_bundle_id`·`intent_bundle_revision`이 구현 시점 값과 다르면 리뷰를 열지 않는다(현행 유지).

## Out of scope
- `review_contract`가 없는 blueprint의 동작 변경
- task 단위 리뷰(`review_scope` 없음)와 light run 리뷰
- `critical_recovery`를 최종 리뷰에 도입하는 것
- coordinator ledger 형식, reviewer 모델 설정(`subagents`)
- plan 리뷰 개편 → `plan-workflow` `plan-review-perspectives`
- direct 실행 handoff 문장 → `drive-execution` `direct-run-final-repair`
- 개편 전후 토큰 비교 측정 — 병합 뒤 drive에서 `metrics summary`로 따로 보고한다

## One-commit justification
- 표식, 관점 선택, record·repair·next 라운드 규칙, run 문서가 한 계약을 이룬다. 일부만 병합하면 표식 blueprint가 허용되지 않는 delta를 요청하거나, 문서가 실제 거절 규칙과 다르게 된다.
