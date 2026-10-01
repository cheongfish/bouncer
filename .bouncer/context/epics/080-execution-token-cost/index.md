---
type: bouncer.epic
title: 실행 토큰 비용 절감
description: Close execution-contract gaps and run review once at final verification to cut drive token cost
resource: .bouncer/context/epics/080-execution-token-cost/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - review
  - cli
  - token-cost
timestamp: '2026-09-30T17:23:06.099+09:00'
bouncer:
  id: '080'
  epic_id: '080'
  status: approved
  supersedes: []
---
# 080 실행 토큰 비용 절감

## Intent
- 문제: coordinator가 실행 계약을 지침에서 얻지 못해 플러그인 소스를 읽으며 진행하고, 리뷰가 task마다 반복되어 drive 한 번의 토큰 소비가 커진다.
- 목표: 지침과 CLI 출력만으로 drive가 진행되고, 리뷰는 blueprint의 마지막 검증 시점에 한 번만 열린다.

## Success criteria
1. `references/spec-authoring/`의 `rounds[]` 예제 문서를 `collectFindingFailures`에 넣으면 실패 메시지가 0건이고, 이를 테스트가 고정한다.
2. `rules/subagent-model.md`와 `skills/bouncer-execute/references/agent-dispatch.md`에 `resolveSubagentModel`·`mdToCodexToml` 문자열이 없고, `bouncer subagent-model`과 `bouncer codex-agents check`가 `rules/cli.md`에 있다.
3. `scripts/src/lib/coordinator.ts`가 반환하는 모든 실패 `reason`에 `cause`와 `next`가 붙고, 표에 없는 `reason` 리터럴이 생기면 테스트가 실패한다.
4. 새로 scaffold한 blueprint는 `index.md`에 `bouncer.review_scope: blueprint`와 루트 `review.md` 하나를 갖고 task 묶음에 `review.md`가 없으며, light 계획 문서는 4개·100줄 이하를 유지한다.
5. `review_scope: blueprint`인 blueprint에서 execute·commit gate는 task 리뷰를 요구하지 않고, finalize gate는 루트 리뷰가 없거나 `accepted`가 아니거나 `rounds[]`가 비어 있으면 `G21`로 실패한다.
6. coordinator drive에서 마지막 리뷰 라운드의 `target.head` 뒤에 `.bouncer/` 밖 변경이 있으면 finalize gate가 `G21`로 실패한다.
7. `review_scope` 필드가 없는 기존 blueprint는 루트에 `review.md`가 있더라도 task별 리뷰 계약(G8·G14·S17)으로 이전과 같이 판정된다.
8. `npm run ci`가 통과한다.
9. `bouncer review-dispatch execute`를 `--task` 없이 부르면 `target.task`가 `null`인 분류가 나오고, `bouncer coordinate repair --review-finding <id>`가 repair task 하나를 연다. 두 동작을 테스트가 고정한다.

## Out of scope
- 저장소 루트의 미추적 로컬 문서 `token-cost-audit.md` 6절이 정한 우선순위 중 P2~P6: 리뷰 라운드 기록 CLI, print 디스패치 payload 조립 CLI, CLI 출력 축소, 세션 분할, 벤치마크 PATH 정리.
- 벤치마크 재실행으로 절감률을 입증하는 일.
- 리뷰 관점 구성과 상한(발견 1회, 수정 1회, delta 인증 1회)의 변경.
- 이미 scaffold된 blueprint를 새 리뷰 계약으로 옮기는 migration.
- epic 043(비용 대비 품질), 067(coordinator), 075(adaptive review dispatch)의 기존 결정 재설계.

## Blueprints
* [001 실행 계약 보완과 리뷰 횟수 축소](blueprints/001-contract-gaps-final-review/index.md) - CLI 명령·실패 힌트·리뷰 예제를 보완하고 scaffold·gate·coordinator·워크플로 지침의 리뷰를 blueprint 단위 한 번으로 바꾼다
