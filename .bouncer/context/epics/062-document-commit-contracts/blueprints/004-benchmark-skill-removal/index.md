---
type: bouncer.blueprint
title: 벤치마크 스킬 제거
description: Removes the unadopted agentic-code-benchmark skill and every public reference.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/004-benchmark-skill-removal/index.md
tags:
  - bouncer
  - blueprint
  - benchmark
  - skill_removal
timestamp: '2026-09-04T13:25:50.574+09:00'
bouncer:
  id: '004'
  epic_id: '062'
  blueprint_id: '004'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 004 벤치마크 스킬 제거

Epic: [062](../../index.md)

## Intent
- 문제: 실행 경로에서 사용하지 않는 2,110줄 벤치마크 스킬과 결과 문서가 공개 표면과 유지 비용을 차지함.
- 완료 조건: 스킬·전용 테스트·문서·Distill 참조를 함께 삭제하고, 남은 검사와 공개 카탈로그가 현재 표면만 설명함.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: `agentic-code-benchmark` 스킬과 벤치마크 문서는 더 이상 제공하지 않는다.
- 데이터·상태: 벤치마크 결과·프로토콜·전용 테스트를 삭제한다. Bouncer workflow와 게이트는 대체 측정 기능을 받지 않는다.
- 수용 기준: 공개 이름, 설치 목록, Distill, 테스트에 삭제된 스킬·벤치마크 경로가 남지 않고 `npm test`가 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: benchmark 출력의 소비자가 없다는 전제를 코드 검색과 회귀 테스트로 확인한다. 대체 계측은 이번 변경에 포함하지 않는다.

## Out of scope
- 외부 벤치마크 플러그인 설치나 비용 측정 기능을 추가하지 않는다.
- Graphify와 무관한 제품 기능을 변경하지 않는다.

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 하나의 폐기된 공개 스킬과 그 문서·테스트·카탈로그를 같은 제거 커밋에서 닫는다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
