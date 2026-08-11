---
type: bouncer.epic
title: 범위가 좁은 작업의 경량 경로
description: Epic 024
resource: .bouncer/context/epics/024-light-path/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-11T10:44:40.031+09:00'
bouncer:
  id: '024'
  epic_id: '024'
  status: approved
---
# 범위가 좁은 작업의 경량 경로

## Intent
- 문제: 오타 수정 한 줄이든 서브시스템 하나든 한 사이클의 비용이 같다. epic을
  새로 세우고, implementer와 reviewer를 named 서브에이전트로 왕복시키고,
  diff 규모에 맞춘 퀴즈를 낸다. 작은 작업일수록 이 고정비가 작업 자체보다 커서
  사용자가 Bouncer 밖에서 고쳐버리게 된다.
- 목표: 문서 6종과 게이트는 그대로 두고 epic 신설·서브에이전트 왕복·퀴즈 규모
  세 가지만 줄이는 경로를 만든다. 새 모드나 새 CLI가 아니라, blueprint에
  선언 한 줄을 남기고 스킬이 그 선언을 읽는 운용 지침이다.

## Success criteria
1. blueprint `index.md`에 `bouncer.scale: light`가 있어도 `bouncer validate`가
   plan·execute·commit·finalize 네 게이트에서 그 키가 없을 때와 동일하게
   판정한다. 게이트 코드도 메시지도 분기하지 않는다.
2. `/bouncer-plan`이 경량 여부를 사용자에게 **묻고**, 자동 판정하지 않는다.
   선언을 받으면 `bouncer.scale: light`를 blueprint에 쓴다.
3. 경량으로 선언한 blueprint는 epic을 새로 만들지 않고 slug가 `maintenance`인
   공용 epic 아래에 붙는다. 그 epic이 아직 없을 때만 한 번 만든다.
4. `/bouncer-execute`가 `scale: light`인 blueprint에서 implementer와 reviewer를
   named 디스패치 대신 인라인으로 돌린다. `bouncer-debugger`는 축소 대상이
   아니며 verify 실패 시 그대로 디스패치된다.
5. named agent를 지원하지 않는 호스트의 기존 fallback 문구가 남아 있어
   `scale` 값과 무관하게 G8이 막히지 않는다.
6. `explain-diff`가 `scale: light`에서 질문 수를 1로 고정하고, 그 외에는
   기존 1–10 판단을 유지한다.
7. `docs/workflow.md`가 경량 경로를 새 모드가 아닌 운용 지침으로 서술하고
   줄이는 세 가지와 줄이지 않는 것(문서 수, 게이트)을 함께 밝힌다.
8. `npm test`가 통과한다.

## Out of scope
- 게이트 완화, 게이트 분기, 게이트 코드 신설.
- 문서 수 축소 — `tasks` / `verification` / `review` / `explain`은 경량 경로에서도
  전부 만든다. 히스토리를 커밋·explain·Distill 셋 다에 남기기로 한 결정이
  이 선택지를 이미 닫았다.
- 신규 CLI 하위 명령, `scripts/src/lib/schema.ts`의 `scale` 등록,
  범위가 좁은지에 대한 자동 판정.
- 공용 `maintenance` epic을 이 저장소에 실제로 만들고 작은 작업 한 건을 그
  경로로 돌리는 dogfood — 경로를 만드는 작업이 그 경로를 쓸 수 없다. 후속 건.
- 서브에이전트 모델 설정(`subagents`)과 `resolveSubagentModel` 동작.

## Blueprints
* [001 scale-light-convention](blueprints/001-scale-light-convention/index.md) - `bouncer.scale: light` 선언 규약과 그것을 읽는 plan·execute·explain-diff 산문을 `skills/` 세 곳과 `docs/workflow.md`에 넣는다
