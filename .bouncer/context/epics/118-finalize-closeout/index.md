---
type: bouncer.epic
title: 118 finalize-closeout
description: 'Finalize workflow: explain, quiz, comprehension, PR body, partial finalize and recovery'
resource: .bouncer/context/epics/118-finalize-closeout/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.483+09:00'
bouncer:
  id: '118'
  epic_id: '118'
  status: approved
  supersedes: []
---
# 118 finalize-closeout

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `finalize-closeout` 영역의 새 blueprint를 받는다. 포함: `/bouncer-finalize`: explain·퀴즈·comprehension, PR 본문, remainder 커밋, 부분 finalize와 복구, 마감 후 정리

## Success criteria
1. `finalize-closeout` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 실행 중 커밋 규칙 → `drive-execution`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
[Epic 기능 분류와 재배치 제안](../../../../EPIC-CLASSIFICATION-PROPOSAL.md)의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [explain-index-intent-exit](../082-explain-index-intent-exit/index.md)
- [finalize-runtime-slimming](../085-finalize-runtime-slimming/index.md)
- [finalize-output-cleanup](../086-finalize-output-cleanup/index.md)
- [partial-finalize-recovery](../113-partial-finalize-recovery/index.md) △

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 009 | 003 adaptive-quiz, 005 pr-single-confirm, 013 structured-pr-body | 퀴즈·PR 본문 |
| 018 | 005~007, 016, 019, 020 | explain·comprehension·승격·마감 |
| 062 | 005 explain-task-context | 마감 시 task 문서 보존 |
| 078 | finalize digest 부분 | 병렬 run은 `drive-execution` |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
