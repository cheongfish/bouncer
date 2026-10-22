---
type: bouncer.epic
title: 120 gates-review
description: 'Judgement: gate codes, verification evidence, review dispatch and coding standards'
resource: .bouncer/context/epics/gates-review/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.695+09:00'
bouncer:
  id: gates-review
  epic_id: gates-review
  status: approved
  supersedes: []
---
# 120 gates-review

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `gates-review` 영역의 새 blueprint를 받는다. 포함: 검증과 리뷰: `bouncer validate` gate 코드, verify 증적과 재사용, 리뷰 관점·디스패치·라운드, 코딩·테스트 표준

## Success criteria
1. `gates-review` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.
3. G10·G11·G12·G18·G22·G25·G26–G31 조건만 어긋난 approved blueprint에서 `bouncer validate --gate plan`이 `ok: true`이고 출력에 해당 코드가 없다.
4. G1–G3·G5·G19·G20과 S 코드는 삭제 전과 같은 입력에서 같은 코드로 실패한다.
5. execute G14와 finalize G21은 finding·round 형식 위반만으로는 실패하지 않고, open `must_fix`, 열린 finding이 남은 accepted review, review 부재·미승인, round 부재, 배열이 아닌 findings, enum 밖이거나 누락된 finding status·actionability에서는 계속 실패한다.
6. G6·G7·G8·G13·G16·G17·G23·G24 판정은 바뀌지 않는다.
7. plan draft 검사(`review-dispatch plan`)는 G5·G19·G20만 보고한다.
8. 플러그인 rules·references·skills·agents·docs가 삭제된 코드를 gate 판정으로 서술하지 않고, CHANGELOG `[Unreleased]`에 `Removed` 항목이 있으며 `npm run ci`가 통과한다.
9. G-code가 하나 이상 실패한 `bouncer validate` 결과는 최상위 `gates[]`에 실패한 복합 gate만 고정 순서로 싣고, 각 항목은 `gate`·`label`·`codes`·`targets`·`next`(문자열 1개)를 가지며 길이는 7 이하다.
10. 같은 입력에서 `failures[]`의 `code`·`message`·`file`·`next`와 `ok`·`warnings`는 `gates[]` 도입 전과 같고, 실패가 S 코드뿐이거나 `ok: true`이면 결과에 `gates` 키가 없다.
11. `current --set`·`bouncer commit`·`finalize`의 validate 실패 payload는 `failures`와 함께 같은 `gates[]`를 싣는다.
12. 경계 거절 reason 7종(`out-of-scope`·`main-worktree-source-write`·`unassigned-worktree`·`verification-task-no-commit`·`cross-drive-conflict`·`cross-drive-ledger-unreadable`·`stale-revision`)은 commit·coordinator 실패 payload에 `gate` 필드를 갖고 commit hook 거절 줄에 복합 gate 이름이 붙으며, 그 밖의 reason에는 `gate` 키가 없고 `reason` 값은 바뀌지 않는다.
13. 새 테스트 파일은 `test/tiers.json`에 등록되고, `rules/output.md`·`rules/cli.md`가 복합 gate 출력을 서술하며, CHANGELOG `[Unreleased]`에 `Added` 항목이 있고 `npm run ci`가 통과한다.

## Out of scope
- gate가 나오는 계획 문서 형식 → `plan-workflow`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [workflow-reliability](../workflow-reliability/index.md)
- [adaptive-review-dispatch](../adaptive-review-dispatch/index.md)
- [verification-reuse-checkpoint-compaction](../verification-reuse-checkpoint-compaction/index.md)
- [coding-standards-pr-retro](../coding-standards-pr-retro/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 004 | 007 context-review-guard | 리뷰 심사와 G18 |
| 009 | 006 debugger-agent | verify 실패 조사 |
| 018 | 018 gate-integrity | gate 집합과 verify 증적 |
| 061 | 001 | 셸 없는 검증, 커밋 스코프 검사 |
| 087 | 001 commit-enforcement | 커밋 강제력과 게이트 실패 조건 |
| 099 | 001 | 리뷰 입력 일관성 |

## Blueprints
- [doc-quality-gate-removal](blueprints/doc-quality-gate-removal/index.md) — plan gate의 문서 품질 코드(G10–G12·G18·G22·G25–G31)와 G14·G21 형식 메시지를 `validate-gates-*`에서 삭제하고 플러그인 문서를 맞춘다.
- [composite-gate-output](blueprints/composite-gate-output/index.md) — `validate` 실패를 복합 gate 7개(`gates[]`)로 요약하고 commit·coordinator·hook의 경계 거절 reason에 같은 gate 이름을 붙인다.
