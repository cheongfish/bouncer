---
type: bouncer.blueprint
title: migrate-ids 기능 제거
description: Removes the obsolete legacy-ID migration surface and its remaining references.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/index.md
tags:
  - bouncer
  - blueprint
  - legacy_ids
  - migration
timestamp: '2026-09-04T13:25:50.478+09:00'
bouncer:
  id: '003'
  epic_id: '062'
  blueprint_id: '003'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 003 migrate-ids 기능 제거

Epic: [062](../../index.md)

## Intent
- 문제: 숫자 ID 전환이 끝났는데 레거시 `EPIC-###-*`·`BP-###-*` 이관 기능과 경고 훅이 공개 표면과 문서에 남아 있음.
- 완료 조건: migrate-ids CLI·스킬·훅·검사 특례와 모든 공개 참조를 제거하고, 공유 dirty-worktree 판정은 독립 모듈에서 계속 사용함.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: `bouncer migrate ids`와 `migrate-ids` 스킬은 더 이상 제공하지 않는다. task-layout 이관과 history import의 dirty-worktree 거부 동작은 유지한다.
- 데이터·상태: 레거시 ID 자동 이관 경로와 SessionStart 경고 훅을 삭제한다. 경로 정규화는 숫자 ID 계약만 다룬다.
- 수용 기준: 삭제된 명령·스킬·훅을 참조하는 코드, 테스트, 문서가 남지 않고 `npm test`가 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 레거시 ID가 있는 기존 설치본을 자동 이관하지 않는다. 공유 helper를 지우면 task-layout과 history import가 깨지는 경우는 공용 위치로 옮겨 막는다.

## Out of scope
- 레거시 ID를 새 형식으로 변환하는 대체 명령을 만들지 않는다.
- 기존 context 문서 코퍼스를 재작성하지 않는다.

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 공개 제거와 그 참조·회귀 테스트 갱신은 하나의 호환성 변경으로 함께 검토한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
