---
type: bouncer.blueprint
title: 코디네이터 반환 계약 강화
description: Require worker report collection and complete wave integration before coordinator handback.
resource: .bouncer/context/epics/090-drive-reliability/blueprints/001-coordinator-return-contract/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - recovery
  - finalize
timestamp: '2026-10-10T11:51:50.068+09:00'
bouncer:
  id: '001'
  epic_id: '090'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 코디네이터 반환 계약 강화

Epic: [090](../../index.md)

## Intent
코디네이터 본문과 dispatch 입력에 최종 보고 대기와 continue의 최소 진전을 명시해 조기 반환을 방지함.

## Contract
- 인터페이스: 역할 본문과 buildCoordinatorInput의 기존 텍스트 payload를 강화한다. payload 함수 인자·checkpoint 형식은 유지한다.
- 데이터·상태: continue 허용 조건은 워커 실행·보고 대기 없음, 담당 wave 전체 integrated, 신규 integrated task 하나 이상, active_tasks 잔존이다. 이번 세션에 준비하거나 재개 시 인계받은 wave를 담당 wave로 정의한다.
- 병렬 실행: 준비된 parallel_safe wave의 워커는 함께 실행할 수 있다. foreground는 호출별 직렬화가 아니라 보고 회수 전 코디네이터 반환 금지다.
- 실패 모드·엣지 케이스: 핸들·started/running·task id는 보고가 아니다. 느린 워커는 같은 핸들로 기다린다. 실제 실패로 blocked를 반환할 때도 실행 중인 워커를 남겨 두지 않는다. 보고 회수가 불가능해진 실행은 정상 Outcome 대신 호스트 실패로 보존하고 BP 002의 unknown 복구 경로로 넘긴다.
- 수용 기준: 에픽 수용 기준 1·2·3·10·11·12.
- 검증: npm run ci로 최종 검증하고 execute gate가 성공 증거를 기록한다. 아래 task Checklist의 focused tests는 구현 중간 검사다.

## Out of scope
- BP 002의 status 관측과 no-progress 복구 분기.
- 워커 역할·검증·리뷰·원장 lifecycle과 parallel_safe의 의미 변경.

## One-commit justification
하나의 TASKS-001이 위 계약과 회귀 검사·생성 산출물·변경 기록을 함께 반영한다. 이 BP를 하나의 리뷰와 PR 단위로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - execute가 작성하는 검증 증거
* [Review](review.md) - 실행 결과 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
