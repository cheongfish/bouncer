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
15. revoke된 worker의 최신 runtime report는 salvage 산출물로 보존되어 `salvage[]`·`worker-salvage` 결정에 경로가 남고, 리뷰어 Red run 입력은 최신 report에 Red run이 없을 때 그 보존본을 쓴다.
16. worker가 이 task의 `Bouncer-Task` 트레일러 없이 직접 만든 커밋이 있으면 `coordinate next`는 `commit` 대신 `blocked`(`worker-commit-untrailered`)를 낸다. `coordinate uncommit`이 그 커밋을 soft reset하고 원장에 기록하면, 되돌린 변경이 index에 staged로 남고 worker 범위에 무트레일러 커밋이 없어져 `next`가 다시 `commit`을 낸다. 이로써 `bouncer commit`의 후보가 비지 않는다.
17. run step 4는 디스패치 직전 `completed_tasks` id 집합에 없던 id가 생기면 진행으로 판별하고 `completed_tasks.length` 비교를 쓰지 않는다. coordinator 문서는 rework 요약 식별자를 원문에서 복사하고 brief 금지 항목 위반 편차를 Open choice로 수락하지 않고 worker가 이미 어긴 금지 항목은 사용자의 명시적 승인 없이 `coordinate revise`로 풀지 않는다는 규칙을, implementer 문서는 provider·env를 고정한 fixture로 정확 단언을 유지한다는 규칙을 가지며, Codex TOML이 동기화되고 테스트가 이를 고정한다.
18. direct-run 문서는 reviewer report에 `must_fix`가 있는 리뷰 라운드를 기록하지 않고 인계하며 그 보고 원문 파일 경로와 리뷰 `target`을 `coordinate note`의 `review-handoff:` note로 coordinator에 data로 넘긴다는 규칙을 갖고, run SKILL과 coordinator 문서가 같은 note를 가리킨다. `coordinate dispatch`는 원장 기록 전에 `report_path` 부모 디렉터리를 만들고 만들 수 없으면 `dispatch-report-dir-failed`로 거절해 원장을 바꾸지 않는다. `coordinate revise` 합집합은 `./src/auth`처럼 정규화로만 같아지는 경로를 한 번만 남기고 테스트가 이를 고정한다.
19. `bouncer plan inspect --blueprint`는 `agents/*.md` ↔ `.codex/agents/*.toml`·`.gitignore` 예외 생성 짝을 `coupledPaths.pairs`로, 테스트 디렉터리에서 task 경로 문자열로 찾은 파일을 근거 줄과 함께 `coupledPaths.candidates`로 내며, 파일을 쓰지 않고 범위 판정에 쓰이지 않는다. plan coordinator는 초안 뒤 덮이지 않은 짝·후보를 `needs_user`로 올리고, root가 `plan.affected_paths`를 다시 물어 사용자가 확정한 경로만 더한다.
20. run SKILL step 4·agent-dispatch·dispatch 카드는 구현자 `--model`이 그 dispatch의 `bouncer subagent-model --agent bouncer-implementer` 출력 한 줄이고 coordinator 자신의 `inherit`가 worker 모델이 아니라고 적는다. brief blueprint 최종 리뷰의 delta 라운드는 그 라운드에서 처음 나온 `minor`·`nit` `must_fix`를 `deferred`+`note`로 기록해 `accepted`로 닫을 수 있고 `major`·`blocker`와 discovery 라운드 deferred는 `review record`와 G21이 함께 거절한다. context reviewer의 검증 가능성 두 절은 Checklist 테스트 단계 입력이 앞선 guard에 막히는지 판정한다. `coordinate worker-tokens --tokens unreported`가 기록되고 `missing`으로 집계되며, 끝난 worker 키에 토큰 기록이 없으면 `coordinate record`·`advance`가 `worker-tokens-missing`으로 거절한다. 역할 TOML이 동기화되고 테스트가 이를 고정한다.

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
- [salvage-red-run-report](blueprints/salvage-red-run-report/index.md): resume으로 지워지는 worker의 runtime report를 salvage로 보존하고 Red run 입력이 이를 쓰게 한다.
- [untrailered-worker-commit](blueprints/untrailered-worker-commit/index.md): `coordinate next`가 트레일러 없는 worker 커밋을 blocked로 판정하고, `coordinate uncommit`으로 되돌려 트레일러 커밋을 다시 만들게 한다.
- [progress-id-set-judge-rules](blueprints/progress-id-set-judge-rules/index.md): run step 4의 진행 판별을 task id 집합 비교로 바꾸고, coordinator·implementer 역할 문서에 식별자 복사·금지 위반 편차·fixture 고정 규칙을 넣는다.
- [retro-friction-and-revise-union](blueprints/retro-friction-and-revise-union/index.md): retro 마찰 4건을 direct-run·coordinator·implementer·dispatch 문서에서 막고, `coordinate revise`가 기본으로 직전 범위에 더하며 교체는 `--replace`로만 하게 한다.
- [retro-followups-coupled-paths](blueprints/retro-followups-coupled-paths/index.md): direct-run의 must_fix 리뷰 원문 인계 규칙, `coordinate dispatch`의 보고 디렉터리 생성, revise 정규화 중복 제거 테스트를 더하고 `plan inspect`가 결합 경로를 읽기 전용으로 출력하게 한다.
- [retro-dispatch-model-tokens-deferred](blueprints/retro-dispatch-model-tokens-deferred/index.md): 구현자 모델 전달 문서, brief delta 라운드의 경미 지적 이연 기록, 계획 리뷰의 테스트 도달 가능성 판정, `worker-tokens --tokens unreported`와 `worker-tokens-missing` 거절을 더한다.
- [worker-tokens-duplicate-guard](blueprints/worker-tokens-duplicate-guard/index.md): `coordinate worker-tokens`가 같은 키의 중복 기록을 거절하고 `--replace`로만 교체하게 하며, coordinator 문서에 worker 보고 대기 불가 종료 문단을, 계획 작성 규칙에 Checklist 분기 matrix 행 규칙과 문서 문구 단언 규칙을 더한다.
