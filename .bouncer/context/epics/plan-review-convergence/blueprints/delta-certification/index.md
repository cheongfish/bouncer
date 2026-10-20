---
type: bouncer.blueprint
title: 계획 변경분 인증과 리뷰 만료 처리
description: Certify plan prose revisions against retained snapshots and route stale reviews through the bounded cycle.
resource: .bouncer/context/epics/plan-review-convergence/blueprints/delta-certification/index.md
tags:
  - bouncer
  - blueprint
  - plan
  - context-review
  - convergence
timestamp: '2026-10-12T21:30:42.158+09:00'
bouncer:
  id: delta-certification
  epic_id: plan-review-convergence
  blueprint_id: delta-certification
  status: closed
  order: 2
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 변경분 인증과 stale 처리

Epic: [096](../../index.md)

## Intent
승인된 구조가 유지되는 문서 보완을 실제 diff와 관련 계약에 대한 delta 인증으로 처리함.
범위 변경과 delta 이후 stale은 누적 재시작 한도 안에서 전이하고 리뷰 기록을 보존함.

## Contract
- 선행 조건: BP 001이 실행 base에 통합되어 context-review 상태 CLI와 previous 검사가 존재해야 한다. 다른 BP task ID를 depends_on에 넣지 않고 이 PR의 진입 조건으로 둔다.
- snapshot_version: 2. target은 digest와 documents이며 digest는 문서 경로·본문·정규화한 판단 구조를 경계가 있는 직렬화로 hash한다. status/title/timestamp와 commit evidence는 제외한다.
- payload는 parts, scope_parts, structure_parts와 documents_content를 가진다. scope_parts의 기존 Interface/Touch 신호는 보관할 수 있으나 full 판정은 structure_parts와 문서 집합으로 결정한다.
- 구조: task의 affected_paths, depends_on, parallel_safe, dependency_gate, exclusive_resources, execution_kind와 blueprint scale/review_scope다. schema의 실제 기본값으로 정규화하며 배열의 표현 순서만 바뀌면 같은 구조다.
- partial: 구조와 문서 집합이 같을 때 모든 plan 본문 보완이 대상이다. epic/blueprint·Interface·Touch도 포함한다. full: task 추가/삭제·구조 변경·실제 이전 내용을 증명할 수 없는 legacy payload migration이다.
- changed_documents는 full과 partial 모두 실제 변경 문서를 돌려준다. revision_diff는 문서별 {file,before,after}이며 body와 정규화 structure를 가진다. 추가/삭제 쪽과 최초·legacy의 알 수 없는 before만 null이다.
- related_documents는 변경 task의 이전·현재 cluster 이웃, DAG 선행·후행 closure, epic·blueprint 계약을 정렬한 판단 문서 목록이다. epic/blueprint가 바뀌면 전체 task 계약을 관련 목록에 포함한다. full에서는 전체 현재 judged set을 사용한다.
- delta reviewer는 이전 findings와 실제 before/after를 보고 수정 해결과 수정이 만든 문제를 판단한다. related_documents는 계약 참조용이며 새 discovery의 범위로 취급하지 않는다. unchanged 텍스트의 새 minor/nit는 금지하고 missed_critical은 blocker/major만 허용한다.
- 상태 전이: 변화 없음은 추가 reviewer 없이 기존 결과를 사용한다. discovery 이후 partial은 delta 1회, full은 남은 restart를 사용한다. delta 이후 새 stale은 partial/full 모두 남은 restart를 사용한다. unresolved must_fix가 남으면 사용자 처분을 기다린다.
- reviewer 입력의 named·generic·inline·print 경로는 같은 필드를 쓰며, print 경로에는 cycle id와 restart_count를 넣어 앞선 실행 결과를 덮어쓰지 않는다.
- 수용 기준: epic Success criteria 5~12. task 001 → task 002로 통합한다.
- 검증 명령: npm run ci. 사용자가 verify ACQ에서 확인했으며 모든 task frontmatter에 설정한다.
- 실패 모드·엣지 케이스:
  - documents_content와 parts/structure_parts가 불일치하거나 다른 blueprint·없는 문서·잘못된 version이 들어오면 previous-payload-invalid로 거부한다.
  - 이전 digest-only payload는 읽기 호환하되 delta 근거로 쓰지 않는다. full migration으로 분류하고 BP 001의 restart 제한과 history 계약을 적용한다.
  - 새 digest 알고리즘으로 기존 modern rounds의 target이 stale이 될 수 있다. 이전 검토가 새 snapshot을 승인했다고 간주하지 않고 migration review를 수행한다. rounds가 없는 legacy gate 계약은 유지한다.
  - 새 구조 정규화는 G18과 review-dispatch가 같은 computePlanSnapshot을 사용하도록 유지한다.

## Out of scope
- 재시작 횟수 초기화, delta 세 번째 round, reviewer 수·모델 변경.
- 다른 BP의 실행 DAG를 자동으로 연결하는 기능, git commit을 이전 문서의 대체 근거로 사용하는 기능.

## One-commit justification
snapshot 분류와 reviewer 소비자가 같은 before/after 계약을 써야 하므로 하나의 PR에서 두 커밋으로 통합한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - CLI와 상태·snapshot 계약
* [Tasks 002](tasks/002/tasks.md) - 소비자 연결과 workflow 계약
* [Verification 001](tasks/001/verification.md) - task 검증 증적
* [Verification 002](tasks/002/verification.md) - task 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 리뷰
