---
type: bouncer.blueprint
title: 조기 반환 탐지와 안전한 재개
description: Separate unobservable executor state from ledger status and bound safe recovery of early coordinator returns.
resource: .bouncer/context/epics/090-drive-reliability/blueprints/002-early-handback-recovery/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - recovery
  - finalize
timestamp: '2026-10-10T11:51:50.177+09:00'
bouncer:
  id: '002'
  epic_id: '090'
  blueprint_id: '002'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 조기 반환 탐지와 안전한 재개

Epic: [090](../../index.md)

## Intent
루트가 원장 상태를 워커 생존으로 오인하지 않도록 관측 한계를 출력하고 조기 반환의 대기·보존 중단·제한된 재개를 정의함.

## Contract
- 인터페이스: coordinate status의 checkpoint에 executor_observation: { state: 'unknown', source: 'unavailable', reason: 'executor-state-not-tracked' }를 추가한다. 현재 CLI는 호스트 실행기를 추적하지 않으므로 running·terminated를 만들지 않는다. 호스트의 실제 실행 핸들 관측은 루트 세션이 별도로 수행한다.
- 데이터·상태: 기존 task dispatch active/reported, ledger.sha256, task lifecycle은 그대로 둔다. executor_observation은 읽기 전용 projection이고 원장·문서·pointer를 수정하지 않는다.
- 복구: 신규 통합 없는 continue에서 status를 한 번 갱신한다. 실제 핸들의 running은 같은 핸들로 기다리고, 종료 뒤 최종 보고 회수와 status를 다시 확인한다. unknown이면 worker-state-unknown으로 보존 중단한다. 모두 종료·보고 회수가 확인됐으면 신규 통합이 있거나 미판정 보고가 있을 때 최신 입력으로 코디네이터를 재개한다.
- 제한: 미판정 보고를 전달하는 무진전 재개는 한 번이다. 재개에서도 신규 통합이 없으면 no-progress로 중단한다. 해시 변경만으로 재개하지 않는다.
- 실패 모드·엣지 케이스: launch 전에 active가 기록된 attempt, stale report가 남긴 해시 변경, 종료됐으나 최종 보고 없는 실행, root가 접근할 수 없는 child handle, Cursor print의 종료 후 남은 orphan 여부 불명을 처리한다.
- 수용 기준: 에픽 수용 기준 4·5·6·11·12.
- 검증: npm run ci로 최종 검증하고 execute gate가 성공 증거를 기록한다. 아래 task Checklist의 focused tests는 구현 중간 검사다.

## Out of scope
- 호스트 API 또는 print runner 비동기화, durable process registry·PID 기반 탐색.
- 정상 terminal Outcome의 재분류, 루트의 judge·verify·integrate 대행.

## One-commit justification
하나의 TASKS-001이 위 계약과 회귀 검사·생성 산출물·변경 기록을 함께 반영한다. 이 BP를 하나의 리뷰와 PR 단위로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - execute가 작성하는 검증 증거
* [Review](review.md) - 실행 결과 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
