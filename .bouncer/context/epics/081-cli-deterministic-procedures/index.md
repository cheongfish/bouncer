---
type: bouncer.epic
title: 결정적 실행 절차의 CLI 이전
description: Move intent_sections projection, Cursor print dispatch, and review round recording from hand-assembled steps into CLI commands
resource: .bouncer/context/epics/081-cli-deterministic-procedures/index.md
tags:
  - bouncer
  - epic
  - cli
  - intent
  - dispatch
  - review
  - token-cost
timestamp: '2026-10-01T12:55:01.781+09:00'
bouncer:
  id: '081'
  epic_id: '081'
  status: approved
  supersedes: []
---
# 081 결정적 실행 절차의 CLI 이전

## Intent
- 문제: controller는 역할별 `intent_sections`, Cursor print 디스패치 payload, 리뷰 `rounds[]` 원장을 매 drive마다 손으로 조립한다. 정의가 없는 부분은 플러그인 소스에서 역산하고, 조립 명령과 결과가 이미 큰 문맥에 계속 쌓인다.
- 목표: 세 절차를 각각 CLI 명령 하나로 실행하고, 지침은 손조립 절차 대신 그 명령을 가리킨다.

## Success criteria
1. `bouncer intent sections --task <path> --role <implementer|reviewer|debugger>`는 캐시된 bundle에서 resolved이고 historical이 아닌 함수의 Explain task 절 본문만 낸다. implementer는 Goal & intent·Current behavior·Target behavior·Interface·Touch·Constraints를, reviewer·debugger는 Goal & intent·Interface·Touch·Constraints를 받는다. 이를 테스트가 고정한다.
2. `intent sections`는 bundle이 없거나, 현재 brief hash가 bundle과 다르거나, Explain 절 hash가 저장값과 다르면 `{ ok: false, reason, cause, next }`를 내고 exit 1로 끝난다. 이를 테스트가 고정한다.
3. `bouncer dispatch print --role <role> --cwd <dir> --input <file> --out <dir>`가 만든 prompt 파일은 첫 줄이 역할별 식별 줄이고, 이어서 frontmatter를 뺀 `agents/bouncer-<role>.md` 본문, 그다음 입력 파일 내용이 온다. 이를 테스트가 고정한다.
4. `dispatch print`는 `agent` 실행 결과의 마지막 `result` 이벤트를 `report`로 돌려준다. 설정 불일치·`agent` 부재·미로그인(`agent status`가 exit 0이 아니거나 출력에 `not logged in`이 있음)·non-zero exit·`result` 누락·`is_error`이면 `{ ok: false, reason, cause, next }`를 낸다. 가짜 `agent` 실행 파일로 테스트한다.
5. `bouncer review record --blueprint <dir> [--task <ddd>] --round <json> [--status <s>]`는 합친 결과가 해당 gate(G21 또는 G14)의 `collectFindingFailures` 검사를 통과할 때만 `review.md`를 쓰고, 실패하면 파일 바이트를 바꾸지 않는다. 단 하나의 예외로, 실패 메시지가 `review rounds sequence invalid` 하나뿐이고 mode 순서가 `discovery,delta,critical_recovery`이며 status가 `accepted`가 아닌 진행 중 원장은 쓴다. 이를 테스트가 고정한다.
6. `rules/cli.md`에 `intent bundle`, `intent sections`, `dispatch print`, `review record`가 있다. `rules/cursor-print-dispatch.md`, `skills/bouncer-execute/references/agent-dispatch.md`, `skills/bouncer-execute/references/review-round.md`, `agents/bouncer-coordinator.md`는 각 절차를 이 명령으로 지시한다.
7. `npm run ci`가 통과한다.

## Out of scope
- 저장소 루트의 미추적 로컬 문서 `token-cost-audit.md` 6절의 P3~P6: CLI 출력 축소, 지침 재읽기 축소, 세션 분할, 벤치마크 PATH 정리.
- plan context review(`context-review.md`)의 `context_review.rounds` 기록 CLI.
- Cursor print가 아닌 호스트의 Task subagent fallback payload 조립.
- must_fix 판정, 리뷰 관점 구성, 리뷰 상한 같은 리뷰 판단 규칙의 변경.
- intent bundle record 형식과 bundle 재사용 판정(epic 073), review-dispatch 분류(epic 075), `review_scope`·G21(epic 080)의 재설계.
- 벤치마크 재실행으로 절감률을 입증하는 일.

## Blueprints
* [001 역할 projection·print 디스패치·리뷰 기록 CLI](blueprints/001-role-projection-print-dispatch-review-record/index.md) - `intent sections`·`dispatch print`·`review record` 명령을 `scripts/src/lib`에 더하고 실행 지침을 그 명령으로 바꾼다
