---
type: bouncer.epic
title: 117 drive-execution
description: 'Run workflow: coordinator, DAG, worktrees, worker dispatch, repair and drive cost'
resource: .bouncer/context/epics/drive-execution/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.378+09:00'
bouncer:
  id: drive-execution
  epic_id: drive-execution
  status: approved
  supersedes: []
---
# 117 drive-execution

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `drive-execution` 영역의 새 blueprint를 받는다. 포함: `/bouncer-run`: coordinator, DAG·wave·lease, worktree, worker 디스패치와 모델 설정, repair·재시도, 실행 비용 절감, implementer 탐색

## Success criteria
1. `drive-execution` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

3. R-D1·R-D2·R-D4 범위에서 직접 실행 판정 예시와 인계 순서 명시의 task 수용 기준과 전용 검증을 만족한다.
4. R-D3 범위에서 파일 기반 구현 payload 전달 계약 명시의 task 수용 기준과 전용 검증을 만족한다.
5. R-C1·R-C2·R-C3 범위에서 의도 묶음 재선택 한도와 재사용 조건 명시의 task 수용 기준과 전용 검증을 만족한다.
6. R-X2 범위에서 원장 정리 전 작업자 측정 집계 보존의 task 수용 기준과 전용 검증을 만족한다.
7. R-X1·R-X2 범위에서 측정 불가와 보존 집계의 보고 기준 명시의 task 수용 기준과 전용 검증을 만족한다.
8. 새 변경은 한국어 브리프·커밋 규약과 관찰 가능한 테스트 단언을 지키고, 역할 TOML 생성본을 동기화하며 scripts/lib를 추적하지 않고 각 blueprint의 종단 npm run ci를 통과한다.

9. model-dispatch-enforcement의 리뷰 metadata는 기존 provider별 모델 해석을 재사용하고 모델 변경만으로 문서 digest를 바꾸지 않으며 legacy payload를 읽는다.
10. Claude의 다섯 Bouncer 역할 호출은 config 모델 누락·불일치를 보정해 알리고 관련 runtime 오류 시 호출을 차단하며 다른 도구·에이전트 입력을 보존한다.
11. 모델 거절은 상속 재시도 없이 중단하고 설정 모델명과 원인을 사용자에게 표시한다. plan 리뷰의 record 성공 뒤에만 문서를 수정한다.
12. 기능 구현 완료 후 plugin 0.1.12와 runtimeCompatibility >=0.1.14 <0.2.0을 동기화하고 runtime 0.1.14를 보존한다.
13. 이 변경의 commit task는 전용 검증을, 마지막 verification task는 npm run ci를 실행한다. source 생성본 경계·한국어 브리프 및 커밋 규약을 유지한다.
14. implementer 문서 Guardrails에 변경 ts·js 파일 eslint 실행, `eslint-disable` 우회 금지, task `verify` 비대체 항목이 있고 Codex TOML이 이와 동기화되며 테스트가 이를 고정한다.

## Out of scope
- 이번 drive 후속 계획은 기존 closed blueprint를 재개하지 않으며, 이미 충족된 항목은 새 구현 대신 현재 코드·테스트 근거로 닫는다.
- 검증 증적 재사용·gate 판정 → `gates-review`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [agent-orchestration](../agent-orchestration/index.md) △
- [task-unit-commits](../task-unit-commits/index.md) △
- [task-dag-coordinator](../task-dag-coordinator/index.md)
- [parallel-run-finalize-digest](../parallel-run-finalize-digest/index.md) △
- [execution-token-cost](../execution-token-cost/index.md)
- [drive-context-reduction](../drive-context-reduction/index.md)
- [drive-plan-copy-hygiene](../drive-plan-copy-hygiene/index.md)
- [drive-token-reduction](../drive-token-reduction/index.md)
- [workflow-cost-and-light-path](../workflow-cost-and-light-path/index.md)
- [drive-reliability](../drive-reliability/index.md)
- [drive-observation-cleanup](../drive-observation-cleanup/index.md)
- [drive-plan-cost-control](../drive-plan-cost-control/index.md)
- [bouncer-improvements-2026-10-14](../bouncer-improvements-2026-10-14/index.md) △
- [drive-repair-integrity](../drive-repair-integrity/index.md)
- [drive-retro-103-followups](../drive-retro-103-followups/index.md)
- [implementer-navigation](../implementer-navigation/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 061 | 002 | run 규칙 로딩 |
| 087 | 002 prepare-lock-split | coordinate prepare 원장 잠금 구간 |
| 099 | 003, 005 | repair·dispatch·worker 정리 |

## Blueprints
- [repair-resume-integrity](blueprints/repair-resume-integrity/index.md): `coordinate repair --resume-task`가 통합된 하위 task를 유지하고, rework `next`·`revise` 승인 경로·integration 직접 수정 안내를 고친다.
- [terminal-reverify](blueprints/terminal-reverify/index.md): `coordinate reverify`가 실패한 terminal 검증만 같은 HEAD에서 다시 실행하고, repair wave를 쓰지 않는다.
- [session-handoff-note](blueprints/session-handoff-note/index.md): `coordinate note`가 coordinator 세션 사이 자유 형식 note를 원장에 남기고, status checkpoint `notes`로 다음 세션에 넘긴다.
- [direct-drive-contracts](blueprints/direct-drive-contracts/index.md) — 직접 실행과 구현 입력 전달 절차 명확화; R-D1·R-D2·R-D3·R-D4·R-C1·R-C2·R-C3 처리.
- [metrics-retention](blueprints/metrics-retention/index.md) — 정리 이후 실행 측정값 보존; R-X1·R-X2 처리.

- [model-dispatch-enforcement](blueprints/model-dispatch-enforcement/index.md): 역할별 모델 metadata와 Claude 호출 훅, 모델 거절 및 리뷰 기록 순서를 정리한다.
- [worker-lint-check](blueprints/worker-lint-check/index.md): 구현 worker가 report 전에 변경 파일에 eslint를 실행하는 절차를 implementer 문서에 추가한다.
