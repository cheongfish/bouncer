---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/106-source-restructuring/blueprints/003-execution-planning-boundaries/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-19T15:13:03.167+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '106'
  blueprint_id: '003'
  status: draft
  comprehension: []
---
# Explain

## Background

이 Blueprint는 실행 조정과 planning 읽기 경계를 명확히 한다. 목표는 `coordinator`에 함께 있던 원장 저장, Git 관측, 검증 호출, 명령 오케스트레이션을 책임별로 분리하면서도 기존 CLI·상태 전이·증적 형식과 공개 export를 보존하는 것이다.

planning 쪽에서는 snapshot의 version, 정규화, hash, digest를 순수 계약으로 분리한다. 읽기 API가 승인·scaffold 같은 쓰기 오케스트레이터를 함께 적재하지 않도록 하여, review payload와 context-review 상태가 같은 snapshot 규약을 사용하게 한다.

마지막 축은 측정이다. 기준선 `c94947e7`과 구현 결과를 같은 Node 24·npm·OS 조건 및 동일한 탐색 suite로 측정해, 소스 경계·적재·export·coverage·시간을 원본 JSON과 inventory에 남기는 것이 계획된 결과다. 설치 시간은 제외하고 build, 동일 suite, coverage, `npm test` 시간을 분리한다.

## Code

- `scripts/src/lib/coordinator.ts`는 execution의 공개 facade다. 기존 22개 export, 인자·반환·예외, deps 전달과 실패 reason을 호환 재export로 유지한다.
- `coordinator-ledger.ts`는 ledger bytes, hash, fence, 원자 쓰기를 소유한다. stale checkpoint와 lock 소유 상실은 기존 거절 reason을 보존한다.
- `coordinator-git.ts`는 Git 관측, worker SHA 판정, 등록 worktree 확인을 맡는다. 상태 전이는 호출자가 계속 소유한다.
- `coordinator-verification.ts`는 의존성 준비와 verification runner 호출을 분리한다. ledger lock과 상태 기록을 직접 바꾸지 않는다.
- `coordinator-commands.ts`는 prepare, integrate, fan-in, repair를 포함한 명령 흐름을 가진다. 다른 production 소비자는 이 내부 모듈이 아니라 공개 `coordinator` 경계를 사용한다.
- `plan-snapshot-contract.ts`는 순수 snapshot 계약을, `plan-snapshot.ts`는 읽기 API와 호환 export를 담당한다. 순수 계약은 fs·child_process·approval·scaffold·validate 오케스트레이터를 가져오지 않는다.
- `scripts/measure-source-boundaries.js`는 `snapshot`과 `check-report` CLI를 제공한다. snapshot은 clean checkout과 Node major 24를 요구하며, coverage 누락·중복·임계값 미달·비정상 종료를 성공 수치로 기록하지 않는다.

Node 24 호환성 문제는 coverage 옵션을 test 파일보다 앞에 두고 `--test-reporter=tap`을 명시하는 방식으로 `2c5d1f0a`에서 복구했다. 이 변경은 `scripts/measure-source-boundaries.js`와 해당 단위 테스트에 한정된다.

## Verification and limits

- TASKS-001은 coordinator 책임 분리와 fence·lock·runner 실패 회귀를, TASKS-002는 공개 facade와 내부 import 경계를, TASKS-003은 snapshot digest와 순수 계약 경계를 각각 전용 테스트로 확인하도록 계획됐다.
- TASKS-004는 측정 도구의 집계·LF·require·argv·coverage parser·subprocess fixture를 검증한다. 실제 전체 저장소 suite는 이 단위 테스트의 책임이 아니다.
- TASKS-005는 두 detached checkout의 실제 snapshot, 비교 JSON, inventory 반영을 맡는다. 측정 실패를 손으로 수치로 바꾸지 않으며, 측정 도구의 소스 수정도 이 task 범위에는 포함하지 않는다.
- TASKS-006은 TASKS-001~005가 통합된 뒤 `npm run ci`를 실행하는 종단 verification node다. 이 node만 전체 CI 증적을 남기며 source나 review 문서를 수정하지 않는다.

`fbd3ba00`은 TASKS-001~004의 integration 결과를 finalize 없이 `develop`에 반영한 병합 커밋이다. 이 문서는 해당 이력을 설명하지만 Bouncer ledger, review, task gate, 또는 TASKS-005·006 상태를 완료로 변경하지 않는다.

## Quiz

1. `coordinator` facade를 유지하면서 `coordinator-commands`를 내부 모듈로 둔 이유는 무엇이며, production 소비자가 내부 모듈을 직접 import하면 어떤 경계가 깨지는가?
2. ledger fence가 JSON을 다시 직렬화한 값이 아니라 원본 bytes와 hash를 검사해야 하는 이유는 무엇인가?
3. snapshot 순수 계약이 fs·child process·approval 오케스트레이터에 의존하면 review와 validation에 어떤 문제가 생기는가?
4. 기준선과 구현 결과의 coverage를 비교할 때 Node 24, 탐색 suite, include·임계값, reporter를 동일하게 유지해야 하는 이유는 무엇인가?
5. TASKS-005의 측정 실패를 Explain 문서에 적는 것과 성공 증적으로 기록하는 것은 왜 다른가?

## Tasks

- TASKS-001: 원장·Git·검증 호출 책임을 분리한다.
- TASKS-002: 명령 처리 본문을 내부 모듈로 옮기고 execution 공개 경계를 유지한다. TASKS-001 통합 뒤에 실행되도록 의존한다.
- TASKS-003: planning snapshot 공통 계약을 독립적으로 분리한다.
- TASKS-004: 동일 규약의 source-boundary 측정 도구를 추가한다.
- TASKS-005: TASKS-002·003·004 이후 실제 전후 측정과 inventory를 기록한다.
- TASKS-006: 모든 commit task 뒤 전체 CI를 검증한다.

실행 이력상 TASKS-001~004의 결과는 `develop`에 반영되었고, TASKS-005의 실측·inventory 및 TASKS-006의 종단 검증은 Bouncer ledger에서 완료로 기록되지 않았다. integration worktree와 `.bouncer/runtime` 산출물은 당시 실행 이력 보존을 위해 유지한다.
