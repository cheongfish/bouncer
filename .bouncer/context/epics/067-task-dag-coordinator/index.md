---
type: bouncer.epic
title: DAG 코디네이터 실행 전환
description: Delegates DAG execution to a coordinator that autonomously completes blueprint work in isolated worktrees.
resource: .bouncer/context/epics/067-task-dag-coordinator/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - dag
  - worktree
  - orchestration
timestamp: '2026-09-07T13:41:00.466+09:00'
bouncer:
  id: '067'
  epic_id: '067'
  status: approved
  supersedes: []
---
# DAG 코디네이터 실행 전환

## Intent

- 문제: `/bouncer-run`의 선형 task 루프는 독립 작업도 직렬화하고, scope drift가 생기면 전체 실행을 계획 단계로 되돌린다.
- 목표: 승인된 DAG에서 출발한 coordinator가 격리된 worktree만 사용해 실행 계획을 조정하고 Blueprint의 구현부터 PR 기록까지 끝낸다.

## Success criteria

1. 계획 문서가 task dependency, 병렬 자격, dependency 해제 상태를 표현하고 plan gate가 cycle, 자기 참조, 누락 task와 잘못된 값을 거절한다.
2. `/bouncer-run`은 named `bouncer-coordinator`를 먼저 디스패치하고, named agent를 지원하지 않는 host에서는 같은 역할 계약의 generic subagent를 한 번 디스패치해 Blueprint 완료 책임을 위임한다.
3. coordinator는 승인된 DAG에서 ready wave를 계산하고 실행 중 task 추가·분할, edge 변경, `affected_paths` 수정을 스스로 결정한다.
4. coordinator와 쓰기 권한을 가진 worker는 할당된 task 또는 integration worktree 안에서만 파일을 수정한다. root run의 bootstrap은 main worktree source를 수정하지 않고 Git worktree 등록과 할당된 integration worktree 생성만 수행한다.
5. 구현·디버깅·리뷰는 역할별 서브에이전트가 수행하고 coordinator는 보고를 바탕으로 재작업, 충돌 해결, 통합 순서를 판정한다.
6. coordinator는 worker commit을 dependency 순서로 integration branch에 반영하고 각 반영 뒤 요구된 검증을 통과시킨다.
7. scope 또는 계획 drift가 생겨도 `/bouncer-plan`으로 후퇴하지 않고 실행 기록과 task 계약을 갱신해 같은 drive에서 해결한다.
8. 완료 시 실제 변경 경로, DAG 변경, 추가 task, 판단 근거, 검증과 agent provenance가 explain, commit, PR에 남는다.
9. coordinator가 중단되면 부분 반영 상태와 worktree를 보존하고 같은 Blueprint drive가 기록된 상태에서 재개된다.
10. `execution_mode` 같은 opt-in 없이 모든 `/bouncer-run` drive가 coordinator를 사용하며, 단일 task Blueprint는 한-node wave로 호환되고 저장소 전체 `npm run ci`가 통과한다.

## Out of scope

- cross-blueprint dependency와 원격·분산 worker scheduler
- coordinator의 저장소 삭제, 자격 증명 사용, 별도 승인이 필요한 외부 시스템 변경
- worker가 coordinator를 거치지 않고 전역 pointer, integration 상태, explain 또는 PR을 갱신하는 흐름
- 기존 완료 Blueprint 문서와 commit 이력을 소급 변환하는 migration
- main worktree에서 coordinator나 worker가 소스 파일을 직접 수정하는 fallback

```mermaid
flowchart LR
  P[계획 DAG 승인] --> R[run 시작]
  R --> B[integration bootstrap]
  B --> C[coordinator 위임]
  C --> W[task worktree 실행]
  W --> F[integration branch 반영]
  F --> V[통합 검증]
  V --> E[explain commit PR 기록]
```

## Blueprints

* [DAG 코디네이터 위임 실행](blueprints/001-delegated-parallel-execution/index.md) - 계획 스키마, 격리 worktree 실행 코어, named coordinator와 workflow·문서 계약을 한 PR에서 전환
