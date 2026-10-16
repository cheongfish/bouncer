---
type: bouncer.epic
title: drive repair 경로 무결성 보강
description: drive의 다중 attempt fan-in 누락, 리뷰 라운드 순서와 repair wave 상한 불일치, repair brief의 finding 누락을 고친다.
resource: .bouncer/context/epics/103-drive-repair-integrity/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - fan-in
  - repair-wave
  - review-rounds
timestamp: '2026-10-16T10:15:00.867+09:00'
bouncer:
  id: '103'
  epic_id: '103'
  status: approved
  supersedes: []
---
# drive repair 경로 무결성 보강

## Intent
- 문제: blueprint 102/001 drive에서 task 003의 rework 이전 attempt commit(`b576645f`)이 통합되지 않았고, 두 번째 repair wave 뒤 delta 라운드가 `rounds sequence invalid`로 거부됐으며, repair brief에 리뷰 finding 상세가 빠져 수정이 누락됐다.
- 목표: worker commit이 몇 개든 통합에 모두 들어가고, repair wave 상한만큼 delta 라운드가 기록되며, 리뷰 원인 repair task 문서가 finding 필드를 그대로 담는다.

## Success criteria
1. worker 브랜치에 통합 HEAD 위 commit이 2개 쌓인 task를 fan-in하면 두 commit의 변경이 모두 통합 HEAD에 있고, 그 task의 통합 commit은 1개이며 `Bouncer-Worker-Commit` trailer는 마지막 worker SHA다.
2. worker commit이 1개인 task의 fan-in 결과(commit 수·메시지·trailer)는 바뀌지 않는다.
3. 범위 적용 중 내용 충돌이 나면 `fanin-conflict`로 그 task만 revoke된다.
4. blueprint 최종 리뷰(`review_scope: blueprint` root `review.md`)의 라운드 순서 `discovery,delta,delta`는 `review record`와 G21을 통과하고 `discovery,delta,delta,delta`는 `rounds sequence invalid`로 거부된다. task별 리뷰에서는 `discovery,delta,delta`가 계속 거부된다. blueprint 순서의 최대 delta 수와 repair wave 상한 상수가 같은지 테스트가 확인한다.
5. `coordinate repair --review-finding F1 --review-finding F2`가 만든 repair `tasks.md`에 두 finding의 id·severity·category·file·symbol·brief_clause(값이 있으면 actionability·note도)가 들어가고 제목·Goal이 리뷰 repair를 가리킨다. root `review.md`에 없는 id는 "review.md에서 찾지 못함"으로 표시된다. CI 원인 repair 문서는 바뀌지 않는다.
6. 각 동작 변경에 회귀 테스트가 있고 `CHANGELOG.md` `[Unreleased]`에 항목이 있다.
7. `npm run ci`가 통과한다.

## Out of scope
- `bouncer commit`이 재시도 때 이전 commit을 amend하는 방식, `coordinate record`의 다중 commit 거부
- light 원장 fan-in(cherry-pick 없음)
- task별 리뷰 라운드 순서, critical_recovery 라운드 순서, context review 라운드 계약
- repair wave 상한 2의 변경
- `review.md` 본문(Markdown) 파싱
- CI 원인 repair brief 문구

## Blueprints
* [fan-in 범위·라운드 순서·repair brief 보강](blueprints/001-fanin-rounds-repair-brief/index.md) - coordinator fan-in 범위 적용, execute 라운드 순서 계약, 리뷰 repair task 문서 생성을 고친다
