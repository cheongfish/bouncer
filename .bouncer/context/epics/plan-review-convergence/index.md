---
type: bouncer.epic
title: 계획 리뷰 수렴성 개선
description: Bound planning review restarts, preserve review history, and certify document revisions without resetting the review cycle.
resource: .bouncer/context/epics/plan-review-convergence/index.md
tags:
  - bouncer
  - epic
  - plan
  - context-review
  - convergence
timestamp: '2026-10-12T21:30:41.738+09:00'
bouncer:
  id: plan-review-convergence
  epic_id: plan-review-convergence
  status: approved
  supersedes: []
---
# 096 계획 리뷰 수렴성 개선

## Intent
계획 리뷰가 문서 보완마다 새 discovery를 열어 같은 문제와 새로운 지적을 반복하는 경로를 제한함.
재시작 횟수와 리뷰 이력을 CLI가 보존하고, 승인된 범위가 유지되는 문서 수정은 변경분 인증으로 처리함.

## Success criteria
1. full 계획의 context-review cycle id와 자동 전체 재시작 횟수가 CLI 기록에 남고, 새 프로세스·start 재호출·active rounds 교체 후에도 동일 cycle의 횟수가 유지된다.
2. 최초 discovery 뒤 전체 재시작을 누적 1회 허용한다. 두 번째 restart는 명시적 reason·cause·next와 exit 1을 내고 기존 문서·payload를 보존한다.
3. 재시작은 이전 rounds·findings·미해결 보고·dispatch 참조를 history에 보관하고, active sequence만 새 discovery로 바꾼다. accepted 상태를 requested로 되돌린다.
4. 후속 review-dispatch는 이전 payload를 요구하고, 누락·손상·다른 blueprint·현재 cycle의 최신 기록과 불일치는 명시적 오류다. 최초의 증거 없는 pending 계획만 previous 없이 분류한다.
5. task 문서 집합·affected_paths·정규화한 DAG·execution_kind·blueprint scale/review_scope가 같으면 epic/blueprint 본문, Interface, Touch 수정도 partial이다. 구조 변경과 task 추가·삭제는 full이다.
6. 버전 있는 payload가 현재·이전 문서 내용과 구조를 검증하고, changed_documents·related_documents·문서별 before/after를 제공한다. full에서도 변경 목록을 잃지 않는다.
7. 새 snapshot digest는 문서 경로·경계·본문·판단 구조를 포함한다. affected_paths와 DAG만 바꿔도 G18 stale이 되고 status·title·timestamp·commit metadata 변경은 digest를 바꾸지 않는다.
8. delta 입력은 새 target, 이전 findings, 실제 변경 before/after, changed_documents, 관련 계약 문서, read-only cwd다. 모든 named·generic·inline·print 경로가 같은 입력 계약을 사용한다.
9. active sequence당 delta는 한 번이다. delta 이후 새 stale은 남은 전체 재시작 1회를 소비하고, 한도가 없으면 사용자에게 보고한다. delta 뒤 미해결 must_fix는 사용자에게 올리고, 자동 재시작으로 회피하지 않는다.
10. advisory는 note와 함께 처분하고 must_fix accepted-risk는 사용자 명시 동의 뒤에만 기록한다. 계획 승인·affected_paths 확인·게이트 증거 작성 주체를 유지한다.
11. 새 테스트는 요구사항에서 기대값을 정하고 예상 red를 관측한다. 테스트 이름, 한국어 주석·docstring, 생성 JS와 역할 TOML 동기화가 공통 코딩 기준을 따른다.
12. 각 BP의 최종 검증은 npm run ci이며 CHANGELOG.md의 Unreleased에 해당 BP 변경을 기록한다.

## Out of scope
- light 경로, execute review.md, coordinator·commit·finalize 상태 머신 재설계.
- reviewer 수·모델 변경, Graphify 순위 알고리즘, 벤치마크 하네스와 fixture 변경.
- 자동 승인·자동 accepted-risk·게이트 생략·검증 증거 수기 작성.
- 074의 reviewer 입력 격리와 075의 single/clustered discovery 전략 변경.
- 기존 089의 light 선택 신호와 질문 묶음 정책 변경. 089/BP 002의 후속 분류 조건만 이번 계약으로 바꾼다.
- 재시작 한도를 초기화하는 CLI와 사용자 동의를 대신하는 reset 기능.

## Blueprints
* [001 반복 제어와 이력 보존](../plan-workflow/blueprints/review-cycle-control/index.md) - context-review 상태 CLI, 재시작 1회 제한, immutable dispatch 보관과 previous 필수화를 구현한다.
* [002 변경분 인증과 stale 처리](../plan-workflow/blueprints/delta-certification/index.md) - 구조와 문서 보완을 구분하고 snapshot·delta 입력·stale 전이를 정합하게 바꾼다. BP 001이 대상 base에 통합된 뒤 실행한다.
