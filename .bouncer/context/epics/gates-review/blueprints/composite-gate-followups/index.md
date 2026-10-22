---
type: bouncer.blueprint
title: 복합 gate 출력 후속 정리
description: 복합 gate 출력(#257)의 S10 예시 오류, hook 테스트 누락, next 문구 불일치를 바로잡는다.
resource: .bouncer/context/epics/gates-review/blueprints/composite-gate-followups/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T22:36:18.842+09:00'
bouncer:
  id: composite-gate-followups
  epic_id: gates-review
  blueprint_id: composite-gate-followups
  status: closed
  order: 16
  commit_type: fix
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 복합 gate 출력(#257)의 문서 예시·hook 테스트·next 문구 후속이라 gate 판정·출력 계약 epic에 귀속
  supersedes: []
---
# 복합 gate 출력 후속 정리
Epic: [gates-review](../../index.md) · Tasks: [001](tasks/001/tasks.md), [002](tasks/002/tasks.md)
## Intent
- `rules/output.md`의 "복합 gate가 없는 실패" 예시가 실제 S10이 아니라 G7의 문구를 가져와 있고, hook 테스트와 gate `next` 문구·테스트에 빈 곳이 있다.
- 예시를 실제 S10으로 바꾸고, 빠진 단언과 테스트를 채우고, `next` 문구를 동작에 맞춘다. `summarizeCompositeGates` 동작은 바꾸지 않는다.
