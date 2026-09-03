---
type: bouncer.blueprint
title: 실행 주기 규칙 적재 계약
description: Defines session-scoped rule loading for bouncer-run so repeated task iterations do not reload immutable workflow guidance.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/002-run-rule-reload-elimination/index.md
tags:
  - bouncer
  - blueprint
  - run-loop
  - rule-loading
  - token-efficiency
timestamp: '2026-09-03T13:39:01.745+09:00'
bouncer:
  id: '002'
  epic_id: '061'
  blueprint_id: '002'
  status: closed
  commit_type: docs
  scale: full
  supersedes: []
---
# 실행 주기 규칙 적재 계약

Epic: [061](../../index.md)

## Intent

`/bouncer-run`은 같은 세션에서 task를 반복하면서도 불변 규칙을 다시 읽도록 해 5-task 주행마다 약 71K 토큰을 소비한다. 루프 시작 시 한 번 적재하고 후속 반복에서는 재적재하지 않는 계약을 공통 규칙과 run 절차에 명시한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: workflow 규칙 적재는 세션 단위다. 새 workflow 세션은 numbered steps 전에 필요한 master·product rules를 적재하며, `/bouncer-run`의 같은 drive 안에서 execute·commit 반복을 시작할 때는 이미 적재된 불변 규칙을 다시 읽지 않는다.
- 데이터·상태: CLI, `bouncer.status`, 포인터, `bouncer.scale`, ACQ와 gate 계약은 바뀌지 않는다. 변경은 plugin-root 공통 계약과 `/bouncer-run` 절차의 독해 범위뿐이다.
- 수용 기준: 공통 계약이 최초 세션 적재와 후속 반복 생략을 함께 정의하고, `/bouncer-run`이 loop 진입 시 한 번 적재한다는 사실을 명시하며, 관련 계약 테스트가 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 새 세션이나 독립 workflow 호출에서 규칙 적재를 건너뛰면 안 된다. 반복 생략은 `/bouncer-run`의 동일 drive에만 적용하며, Distill re-ground·task brief·ACQ·gate를 생략하는 근거가 되어서는 안 된다.

## Out of scope

- `rules/governance.md`의 light 규칙 분리와 조건부 적재(감사 8번)
- `rules/okf.md`의 저술 전용 적재 전환(감사 9번)
- `/bouncer-execute`, `/bouncer-commit` 등 독립 workflow의 적재 절차 변경
- CLI·포인터·gate 구현 또는 runtime config 변경

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 공통 계약, `/bouncer-run`의 loop 한정 규칙, 이를 고정하는 테스트는 함께 있어야 새 세션 적재와 반복 생략의 경계가 검증된다.

## Documents
* [Tasks](tasks/001/tasks.md) - 반복 적재 계약과 회귀 단언
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
