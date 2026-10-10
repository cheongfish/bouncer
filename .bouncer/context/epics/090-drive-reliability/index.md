---
type: bouncer.epic
title: 드라이브 실행 안정성
description: Prevent premature coordinator handbacks, recover early returns safely, and prepare dependencies before finalize verification.
resource: .bouncer/context/epics/090-drive-reliability/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - recovery
  - finalize
timestamp: '2026-10-10T11:51:49.894+09:00'
bouncer:
  id: '090'
  epic_id: '090'
  status: approved
  supersedes: []
---
# 090 드라이브 실행 안정성

## Intent
코디네이터가 워커 보고를 회수하기 전에 반환하면 진행 중인 작업이 정체로 분류되고, finalize는 integration checkout의 의존성이 없어 검증에 실패할 수 있음.
반환 계약을 강화하고 조기 반환의 안전한 재개 조건을 정의하며 finalize 검증 직전에 기존 설치 계약으로 의존성을 준비함.

## Success criteria
1. 준비된 wave의 병렬 실행을 유지하면서, 코디네이터가 자신이 시작한 워커의 최종 보고를 모두 회수하기 전에는 어떤 Outcome도 반환하지 않는다.
2. continue는 담당 wave 전체가 integrated이고 이번 세션에 새로 integrated된 task가 하나 이상이며 active_tasks가 남을 때만 허용된다. 기존 wave를 인계받아 마무리한 task도 신규 통합으로 계산한다.
3. coordinate status --write-input으로 생성한 모든 코디네이터 입력에 워커 대기와 continue의 신규 통합 조건이 들어간다.
4. coordinate status는 원장 상태와 실행기 생존 관측을 구분한다. 추적하지 않는 실행 상태를 unknown으로 반환하고 active 상태나 해시 변경을 실행 또는 진전의 증거로 사용하지 않는다.
5. 신규 통합 없는 continue를 받은 루트는 현재 checkpoint와 실제 접근 가능한 호스트 실행 핸들을 한 번 확인한다. running이면 같은 핸들을 기다리고, unknown이면 보존 중단하며, 안전한 종료·보고 회수가 확인된 경우에만 새 checkpoint로 코디네이터를 재개한다.
6. 재개는 코디네이터의 judge·verify·integrate 책임을 유지하고, 동일 워커의 중복 실행과 무한 재개를 허용하지 않는다. 진전 없는 복구 재개는 한 번으로 제한한다.
7. finalize는 실제 검증 경로에서 verify 명령 해석이 성공한 뒤 동일 checkout에 prepareDependencies를 실행한다. package-lock.json이 없거나 npm marker가 있으면 기존대로 설치를 건너뛴다.
8. 의존성 설치 실패는 cause와 next를 포함한 별도 JSON 실패로 반환한다. 검증·문서 종료·삭제·stage·commit·pointer 해제를 수행하지 않으며 CLI stdout의 JSON 계약을 유지한다.
9. finalize prepare, dry-run, 검증 없는 빈 종료 경로에서는 설치하지 않는다. 기존 검증 실패 및 사용자 승인 계약을 유지한다.
10. 변경한 역할 Markdown과 생성 TOML은 바이트 단위로 일치하고 Worker dispatch 절은 기존 20줄 제한을 지킨다.
11. 변경한 TypeScript의 생성 JavaScript를 기존 빌드로 갱신하고 회귀 테스트와 CHANGELOG를 함께 반영한다. 최종 검증 증거는 execute gate만 기록한다.
12. 사용자 승인 없이 affected_paths·계획 승인·pointer를 확정하지 않고, controller가 지정한 실제 write cwd만 수정한다.

## Out of scope
- 제안서 7절의 CLI·digest·컨텍스트·호스트 개선 항목.
- 종료된 089/004의 supplement 분류, repair wave 한도, delta review, digest v2 변경.
- 호스트 Agent API 수정, PID registry·heartbeat·프로세스 탐색 도입, orphan worker 강제 종료.
- 코디네이터 Close 직전 설치와 lockfile 변경 감지. marker 존재만 확인하는 기존 계약을 유지한다.
- finalize 동의·퀴즈·PR 승인 절차, 자동 승인, 직접 원장 수정, 게이트 우회.

## Blueprints
* [001 코디네이터 반환 계약 강화](blueprints/001-coordinator-return-contract/index.md) - 역할 문서·생성 TOML·입력 payload에서 워커 대기와 continue의 조건을 강화한다.
* [002 조기 반환 탐지와 안전한 재개](blueprints/002-early-handback-recovery/index.md) - status의 실행 상태 한계를 명시하고 run의 대기·보존 중단·제한된 재개를 정의한다.
* [003 마감 검증 의존성 준비](blueprints/003-finalize-dependency-readiness/index.md) - finalize의 기존 설치 함수 호출과 구조화된 설치 실패를 구현한다.

## Execution order
BP 001 → BP 002 → BP 003 순서로 실행한다. BP 사이의 순서는 운영 순서이며 TASKS id의 depends_on에 다른 BP를 연결하지 않는다. 공유 run 지침·CHANGELOG·CLI 문서가 있으므로 BP를 동시에 실행하지 않는다.
각 BP는 하나의 commit task로 구성하고 depends_on: [], parallel_safe: false, dependency_gate: integrated를 명시한다.
