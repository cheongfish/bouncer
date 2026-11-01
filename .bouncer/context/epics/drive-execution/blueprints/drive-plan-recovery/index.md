---
type: bouncer.blueprint
title: 실행 및 계획 복구 경로 정비
description: Blueprint drive-plan-recovery
resource: .bouncer/context/epics/drive-execution/blueprints/drive-plan-recovery/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-11-01T21:50:33.627+09:00'
bouncer:
  id: drive-plan-recovery
  epic_id: drive-execution
  blueprint_id: drive-plan-recovery
  status: closed
  order: 80
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
---
# 실행 및 계획 복구 경로 정비

Epic: [drive-execution](../../index.md)

## Intent
실행 정지와 계획 수정 상한에 도달했던 세션을 보존된 근거와 승인 경계에 따라 이어갈 수 있게 한다. 생성 설정이 작업 커밋에 섞이지 않게 하고 계획 검토의 누락을 줄인다.

## Contract
- A: 재시드와 보정은 task 커밋과 분리하며 자동 커밋도 기존 범위 검사를 통과한다. init은 생성·갱신·변경 없음을 구분한다.
- B: blocked 원인별 재개 조건, 금지 조건, 다음 주체와 행동을 안내한다. 지원되는 재개에서 salvage, 새 lease, stale report 거절과 무진척 제한을 유지한다.
- C: planner revision 및 continued 횟수 상한 gate를 삭제해 횟수 초과가 plan을 막지 않게 한다. 별도 감사 가능한 복구 명령으로 기존 열린 원장을 이어가며 사용자 답변, 검토 증거와 checkpoint 보호를 보존한다. 추가 revision 예산은 두지 않는다.
- D·G: 신규 테스트의 tier 등록 경로를 범위 확인에 포함하고 동일 입력의 공개 오류 코드와 검사 순서를 Target behavior 및 Interface에서 대조한다. 기존 G33을 유지하고 새 의미 비교 gate를 만들지 않는다.
- 종단 검증: `npm run ci`.

## Out of scope
- 종료 blueprint 변경, 과거 원장·worktree 복원, 과거 성공 소급 인정.
- 승인 없는 범위 변경, 승인 또는 나머지 gate 우회, 무한 재시도 및 무한 재검토.
