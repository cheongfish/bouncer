---
type: bouncer.blueprint
title: 검증 관례와 복구 절차 정합성 확보
description: Task verification practice and recovery contract alignment
resource: .bouncer/context/epics/drive-execution/blueprints/task-verification-recovery/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-11-02T08:17:47.973+09:00'
bouncer:
  id: task-verification-recovery
  epic_id: drive-execution
  blueprint_id: task-verification-recovery
  status: closed
  order: 81
  commit_type: fix
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
---
# 검증 관례와 복구 절차 정합성 확보

Epic: [drive-execution](../../index.md)

## Intent
신규 테스트의 tier 등록 누락을 task 검증 단계에서 발견하도록 작성 관례를 명시한다. 복구 감사 절차를 실제 CLI 동작과 맞추고 no-progress 실행 검증 경계를 정한다.

## Contract
1. `test/tiers.json`을 쓰는 이 저장소의 신규 테스트 commit task는 `node scripts/check-task.js <test files>`를 검증 명령으로 사용한다. 단일 argv 제한과 tier 등록 검사 이유를 명시한다.
2. `recover`는 과거 상한에서 멈춘 열린 원장을 재개할 때 권장하는 감사 단계이며 진행을 막는 필수 조건이 아니다. 선택 시 root가 실행하고 note와 checkpoint 외의 상태를 보존한다.
3. root의 no-progress 계약은 같은 task id 집합에서 hash만 바뀐 경우 진행으로 보지 않고, 새로운 완료 id는 개수가 같아도 진행으로 본다. root가 실제 호출하는 읽기 전용 판정 명령으로 이 규칙과 worker 관찰·보고·단일 복구 재시도를 판정한다.
4. 각 commit task는 `node scripts/check-task.js`로 범위에 맞는 테스트를 실행하고, 종단 verification은 `npm run ci`를 실행한다.

## Out of scope
- G33 검증 명령 강제 및 revoke 승인 확인의 CLI 기계화.
- 닫힌 blueprint 재개, plan ledger 스키마 변경, 기존 원장의 상태 변경.

## One-commit justification
같은 drive 회고에서 발견한 검증과 복구 문서의 불일치를 한 리뷰에서 판단한다. 개별 변경은 task 단위로 검증하고 전체 CI를 마지막에 실행한다.
