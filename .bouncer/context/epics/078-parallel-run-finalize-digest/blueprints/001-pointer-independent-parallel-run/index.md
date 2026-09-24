---
type: bouncer.blueprint
title: Pointer 독립 병렬 Task 실행
description: Lets the coordinator run non-conflicting tasks concurrently under leases and fast-forward only verified wave candidates.
resource: .bouncer/context/epics/078-parallel-run-finalize-digest/blueprints/001-pointer-independent-parallel-run/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - lease
  - scheduler
  - fan-in
timestamp: '2026-09-24T11:23:58.677+09:00'
bouncer:
  id: '001'
  epic_id: '078'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 Pointer 독립 병렬 Task 실행

Epic: [078](../../index.md)

## Intent
Coordinator가 공유 pointer 없이 lease로 task를 식별해 충돌하지 않는 task를 설정 한도까지 동시에 실행하게 한다.
Fan-in은 임시 candidate에서 검증을 통과한 wave만 canonical integration branch에 fast-forward해 stale event와 실패한 wave가 통합 결과를 바꾸지 못하게 한다.

## Flow
```mermaid
flowchart LR
  A[DAG ready wave] --> B[충돌 없는 lease 배정]
  B --> C[task runner 병렬 실행]
  C --> D[wave candidate 검증]
  D --> E[canonical fast-forward]
```

## Contract
- 인터페이스:
  - task frontmatter `bouncer.exclusive_resources?: string[]` — 항목은 `^[a-z0-9][a-z0-9._-]*$`, 중복 금지, 부재는 `[]`. S28이 shape를 검사한다.
  - `.bouncer/config.json` `coordinator.max_parallel?: integer >= 1` — 부재 시 2. 잘못된 값이면 `coordinate prepare`가 `coordinator-config-invalid`로 거절한다.
  - `bouncer coordinate dispatch|report|record|integrate --task`는 선택 플래그 `--lease-id <id> --generation <n>`을 받고, 주어진 값이 활성 lease와 다르면 `stale-lease`로 거절한다.
  - `bouncer coordinate revoke --task <NNN> --reason <r>` — lease를 무효화하고 task를 `pending`으로 requeue한다.
  - `bouncer coordinate integrate` — `--task`가 없으면 `recorded` 상태의 wave 전체를 candidate에서 통합한다.
  - `bouncer current` payload에 `effectiveTask`를 추가한다. shape는 TASKS-003 Interface의 `EffectiveTask | null`이 정본이다: `source: 'lease'`(path·id·lease_id·generation), `source: 'pointer'`(path·id), 또는 worker cwd에서 lease를 확인하지 못한 `source: null`(`reason: 'no-active-lease' | 'unreadable-ledger'`).
- 데이터·상태:
  - 원장 task에 `affected_paths`, `exclusive_resources` 스냅샷과 `lease: { id, generation, seq, status: 'active' | 'revoked' }`를 둔다.
  - 원장 최상위에 `leaseSeq`와 진행 중 fan-in 기록 `fanin: { base_head, candidate_head, tasks, status } | null`을 둔다.
  - 모든 fenced mutation은 `withLedgerLock` 안에서 fence 확인·쓰기를 한 번에 수행한다.
- 수용 기준: epic Success criteria 1–7, 그리고 standalone execute·commit의 pointer 판정 유지.
- 검증 명령: commit task는 `npm test`, 종단 TASKS-006은 `npm run ci`. pointer를 옮기지 않으므로 wave·terminal 검증은 `runVerification`에 명시한 task의 `verify`와 `verification.md`를 쓴다(TASKS-004).
- 실패 모드·엣지 케이스:
  - `affected_paths`·scope 스냅샷이 없는 legacy 원장 task는 모든 task와 충돌하는 것으로 본다.
  - 공유 pointer가 다른 task를 가리켜도 worker cwd의 lease가 우선한다. lease를 확인하지 못한 worker cwd는 pointer로 떨어지지 않고 거절된다. 예외는 `lease` 필드가 없는 legacy 원장 task뿐이며, `workerPath`가 cwd와 같고 status가 `prepared`·`recorded`이면 그 task로 판정한다.
  - candidate에서 cherry-pick이 충돌하면 candidate만 abort·삭제하고, 충돌한 task를 revoke한다.
  - CAS 확인 시 canonical HEAD가 `fanin.base_head`와 다르면 `stale-integration-head`로 멈춘다.
  - 재시작 시 canonical HEAD가 이미 `fanin.candidate_head`이면 cherry-pick 없이 원장만 완결한다.
  - 늦게 도착한 이전 generation event는 `stale-lease` decision만 남기고 상태를 바꾸지 않는다.

## Out of scope
- `bouncer drive` 신규 명령과 coordinator 역할의 CLI 대체.
- Finalize, Explain, PR 흐름(BP 002).
- 기본 동시 실행 수 3 이상, 원격·다중 머신 lock.
- Terminal verification의 repair 한도 2와 partial-close 계약 변경.

## One-commit justification
- 한 PR로 리뷰하되 task별 commit 다섯 개로 나눈다. scheduler → lease → effective task → safe fan-in → 문서·e2e 순서의 직렬 DAG다. effective task와 fan-in은 같은 소비자 테스트 fixture를 고치므로 병렬로 두지 않는다. 각 task는 독립적으로 `npm test`가 통과하는 단위다.

## Documents
* [Task 001](tasks/001/tasks.md) - 동시 실행 한도와 경로·자원 충돌 scheduler
* [Task 002](tasks/002/tasks.md) - lease·generation·revoke와 원장 잠금
* [Task 003](tasks/003/tasks.md) - lease 기반 effective task resolver
* [Task 004](tasks/004/tasks.md) - candidate 검증 뒤 CAS fast-forward fan-in
* [Task 005](tasks/005/tasks.md) - coordinator·run 문서 병렬 전환과 e2e 회귀
* [Task 006](tasks/006/tasks.md) - 종단 `npm run ci`
* [Context review](context-review.md) - 계획 문서 정합성 판정
