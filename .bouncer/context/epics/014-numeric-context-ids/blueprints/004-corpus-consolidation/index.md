---
type: bouncer.blueprint
title: 64개 epic을 11개 주제 계층으로 통합
description: Migrates the historical context corpus into eleven canonical epic hierarchies with retrieval regression evidence.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/index.md
tags:
  - bouncer
  - blueprint
  - corpus-migration
  - epic-taxonomy
timestamp: '2026-09-01T21:18:27.347+09:00'
bouncer:
  id: '004'
  epic_id: '014'
  blueprint_id: '004'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 004 64개 epic을 11개 주제 계층으로 통합

Epic: [014](../../index.md)

## Intent
- 문제: 64개 epic이 구현 시점별로 흩어져 검색과 계보 탐색에 과도한 경로 수를 만든다.
- 완료 조건: historical corpus가 11개 canonical epic 아래로 이동하고 ID·링크·검색 회귀가 검증된다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: 001,004,006,007,009,014,018,034,039,043,060만 canonical epic directory로 남고 각 BP는 부모·resource가 새 경로와 일치한다.
- 데이터·상태: 모든 historic BP는 해당 canonical epic의 순차 ID로 이동하며 context index는 11개 행만 남긴다.
- 수용 기준: 중복 024를 포함한 모든 이전 epic ID가 사라지고, 고정 query의 필수 hit와 후보 상한이 보존된다.
- 검증 명령: npm test
- 실패 모드·엣지 케이스: dangling link·stale resource·누락 BP·후보 폭발은 migration 실패다.

## Out of scope
- digest·ranking·tokenizer·graphify graph 형식 변경

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 각 task는 하나의 canonical topic으로 모이는 BP 묶음 하나만 이동하는 독립 커밋이다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
