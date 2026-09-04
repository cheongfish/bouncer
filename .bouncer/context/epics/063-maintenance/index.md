---
type: bouncer.epic
title: 유지보수
description: Maintains cross-cutting quality, docs, and minor repairs across Bouncer.
resource: .bouncer/context/epics/063-maintenance/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-09-04T21:42:22.343+09:00'
bouncer:
  id: '063'
  epic_id: '063'
  status: approved
  supersedes: []
---
# 063 maintenance

## Intent
- 문제: 기능 개발 후 도출된 운영 관찰과 지침 개선 사항이 공식 문서나 테스트에 반영되지 않으면 동일한 시행착오가 반복됨.
- 목표: 횡단 품질 개선, 문서 정비, 경량 정합성 작업을 일관된 규칙으로 관리하고 지속 반영함.

## Success criteria
1. 새로 도출된 운영 지침이나 원칙이 관련 참조 문서와 스킬 가이드에 구체적으로 명문화된다.
2. 관련 자동화 테스트가 가이드 준수 여부를 검증하고 전체 테스트가 통과한다.
3. 가이드 갱신 작업이 기존 런타임 동작이나 게이트 검사를 깨뜨리지 않는다.

## Out of scope
- Bouncer 코어 로직의 대규모 리팩터링
- 기완료된 과거 에픽/블루프린트 문서의 소급 변경

## Blueprints
* [Graphify 질의 가이드 정비](blueprints/001-graphify-query-guidance/index.md) - Graphify 검색 공간 축소 원칙을 러너 지침과 플랜 제안 참조에 반영하고 테스트로 고정한다.
