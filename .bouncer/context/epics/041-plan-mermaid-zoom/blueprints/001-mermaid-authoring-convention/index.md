---
type: bouncer.blueprint
title: 머메이드 작성 규칙
description: Blueprint 001
resource: .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-18T17:00:46.075+09:00'
bouncer:
  id: '001'
  epic_id: '041'
  blueprint_id: '001'
  status: closed
  commit_type: docs
  scale: full
---
# 001 mermaid-authoring-convention

Epic: [041](../../index.md)

## Intent
- 문제: plan 에이전트가 머메이드를 어디에, 어느 배율로 둘지 스킬에 없다.
- 완료 조건: spec-authoring이 줌 규칙과 예시 차트를 갖고, context-review가 모순만 짚으며, 게이트는 차트 유무로 실패하지 않는다.

## Contract
- 인터페이스: spec-authoring How to author가 문서 종류별 줌을 적는다. 에픽은 Before/After 비즈니스 흐름, 블루프린트는 이번 PR 구간, 태스크는 구현 분기. 차트 원본은 `.bouncer/context/epics/**` 본문의 ` ```mermaid ` 펜스다. 사람은 미리보기에서 그림을 보고, 에이전트는 같은 텍스트를 읽는다.
- 데이터·상태: 게이트 스키마·`bouncer.*` 필드는 그대로다. 차트는 본문 선택 절이다.
- 수용 기준: Success criteria 1–4가 참이다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 설정 키만 바꾸는 작업은 차트 없음이 정상이다. 부모 차트 전체를 태스크에 복사하면 context-review가 지적하고 게이트는 통과한다. `classDef`·색·긴 노드 id는 지침에서 금지한다. Distill·verification·review 본문에 차트를 두면 거절한다.

## Out of scope
- 차트 렌더러·생성 스크립트
- Distill 샤드에 머메이드 승격
- 게이트 코드가 머메이드를 파싱하는 일

## One-commit justification
- 작성 규칙·예시·리뷰 판정·계약 테스트가 한 줌 계약을 가리키므로 한 커밋으로 리뷰한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
