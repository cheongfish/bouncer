---
type: bouncer.epic
title: 118 finalize-closeout
description: 'Finalize workflow: explain, quiz, comprehension, PR body, partial finalize and recovery'
resource: .bouncer/context/epics/finalize-closeout/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.483+09:00'
bouncer:
  id: finalize-closeout
  epic_id: finalize-closeout
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

3. R-X3 범위에서 사용자 확인 이후 이해 기록 메타데이터 생성의 task 수용 기준과 전용 검증을 만족한다.
4. R-X4 범위에서 보존 digest 기반 PR 본문 초안 생성의 task 수용 기준과 전용 검증을 만족한다.
5. 새 변경은 한국어 브리프·커밋 규약과 관찰 가능한 테스트 단언을 지키고, 역할 TOML 생성본을 동기화하며 scripts/lib를 추적하지 않고 각 blueprint의 종단 npm run ci를 통과한다.

## Out of scope
- 이번 drive 후속 계획은 기존 closed blueprint를 재개하지 않으며, 이미 충족된 항목은 새 구현 대신 현재 코드·테스트 근거로 닫는다.
- 실행 중 커밋 규칙 → `drive-execution`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [explain-index-intent-exit](../explain-index-intent-exit/index.md)
- [finalize-runtime-slimming](../finalize-runtime-slimming/index.md)
- [finalize-output-cleanup](../finalize-output-cleanup/index.md)
- [partial-finalize-recovery](../partial-finalize-recovery/index.md) △

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 009 | 003 adaptive-quiz, 005 pr-single-confirm, 013 structured-pr-body | 퀴즈·PR 본문 |
| 018 | 005~007, 016, 019, 020 | explain·comprehension·승격·마감 |
| 062 | 005 explain-task-context | 마감 시 task 문서 보존 |
| 078 | 002 finalize-digest | Explain·Quiz·PR 입력 digest |

## Blueprints
- [release-main-outside-scope](blueprints/release-main-outside-scope/index.md): `finalize release-main`이 `outside_scope`로 분류한 terminal만 남은 drive를 정리하고, `drive-not-closed`에 `cause`·`next`·`tasks`를 싣는다.
- [closeout-record-generation](blueprints/closeout-record-generation/index.md) — 마감 이해 기록과 PR 본문 초안 자동 생성; R-X3·R-X4 처리.
