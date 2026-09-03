---
type: bouncer.blueprint
title: 완료 컨텍스트 보존 수명주기
description: Finalize compacts closed blueprint context while preserving durable explanation and verification evidence.
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/020-completed-context-retention/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-09-03T09:27:43.508+09:00'
bouncer:
  id: '020'
  epic_id: '018'
  blueprint_id: '020'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 완료 컨텍스트 보존 수명주기

Epic: [018](../../index.md)

## Intent
- 문제: 완료된 Blueprint의 task·review·계획 판정 문서가 계속 남아 현재 시스템을
  읽는 데 필요한 설명과 일회성 실행 절차를 섞는다.
- 완료 조건: finalize가 G16 뒤에 일회성 문서를 같은 remainder commit에서 지우고
  Blueprint를 닫으며, 검증·스킬·문서가 축약 레이아웃을 같은 의미로 다룬다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: `finalize --yes`는 G16 통과 뒤 해당 Blueprint의
  `tasks/<NNN>/tasks.md`, `tasks/<NNN>/review.md`, `context-review.md`를
  제거하고 변경한 `index.md`를 `closed`로 함께 stage한다. `verification.md`와
  `explain.md`는 남긴다.
- 데이터·상태: draft·approved Blueprint는 기존의 완전한 task bundle과 full-scale
  `context-review.md` 요구를 유지한다. `closed` Blueprint만 축약 레이아웃을
  허용하며 다시 ready 대상으로 선택하거나 task를 추가하지 않는다.
- 수용 기준: 삭제 목록·stage 목록·stage/commit 실패 복구·다중 task 보존을 테스트로
  고정하고, finalize와 plan 문서가 보존·후속 Blueprint 규칙을 동일하게 설명한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: G16·사전 검증·stage·commit 중 어느 단계가 실패해도
  삭제 전 문서와 `approved` 상태를 복구한다. light Blueprint는 존재하지 않는
  `context-review.md`를 삭제 대상으로 취급하지 않는다. 이미 closed인 Blueprint를
  재실행해도 보존 문서를 추가로 지우지 않는다.

## Out of scope
- archive 저장소·릴리스 아티팩트·규제 보관 체계 구현.
- 기존 closed Blueprint의 보존 문서 소급 삭제 또는 재작성.
- closed Blueprint 재개 명령과 epic 상태 전이 추가.

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 세 task로 나눈다. 001은 finalize·검증 계약과 회귀 테스트를, 002는 스킬 계약과
  그 테스트를, 003은 사용자 문서를 맡는다. 각 변경은 독립적으로 검토·되돌릴 수
  있고 001이 만든 동작을 002와 003이 설명한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - finalize 축약과 구조 검증
* [Tasks 002](tasks/002/tasks.md) - finalize 워크플로 계약
* [Tasks 003](tasks/003/tasks.md) - 보존 정책 사용자 문서
* [Verification 001](tasks/001/verification.md) · [Review 001](tasks/001/review.md)
* [Verification 002](tasks/002/verification.md) · [Review 002](tasks/002/review.md)
* [Verification 003](tasks/003/verification.md) · [Review 003](tasks/003/review.md)
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
