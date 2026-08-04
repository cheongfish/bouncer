---
type: bouncer.distill
title: discovery 선행 Read·핸드오프 계약을 남김
description: Distill for BP-004
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-004-discovery-depth/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-04T09:23:59.054+09:00'
bouncer:
  id: DISTILL-BP-004
  epic_id: EPIC-004
  blueprint_id: BP-004
  status: published
---
# Distill

## 승격 대상 (durable)

- Epic `## Blueprints` 한 줄 목적은 목록 한 줄만 보고 새 요청이 그 스트림과
  겹치는지 판단할 수 있게 쓴다 — discovery Prior art가 그 목록에 의존한다.
- `config.source_dirs`가 `scripts`·`hooks`·`test`이면 Graphify source 질의는
  `skills/`를 돌려주지 않는다. 스킬을 만지는 blueprint는 suggested_paths에
  해당 스킬 경로를 수동으로 보태야 한다.
- discovery 선행 Read(`.bouncer/context/Distill.md`, epic Blueprints)는 의무이되
  결과가 비어 있어도(에픽 없음·갓 만든 Distill) 흐름을 막지 않는다. 스킬
  안내는 게이트가 아니다.

## 사이클 회고 (승격하지 않음)

- 표면 테스트(Distill 경로·edge case·failure mode·handoff)를 먼저 넣고 스킬
  본문을 맞추니 Checklist 회귀가 바로 잡혔다.
- execute 게이트 재실행은 `verification.md` 증적 시각·tail을 다시 써서 트리를
  dirty하게 만든다 — 최종 증적 커밋 뒤에는 확인용 재실행을 하지 않는다.

## 다음 후보

- 리뷰 루브릭에 "테스트 없는 동작 변경" 항목을 넣는 일은
  `skills/review`·`reviewer-prompt`·`agents/bouncer-reviewer`와 execute
  디스패치가 한 커밋 단위라 별도 BP가 필요하다.
- BP-002 `init-rules-scaffold` 상태 정리는 이 사이클과 무관하다.
