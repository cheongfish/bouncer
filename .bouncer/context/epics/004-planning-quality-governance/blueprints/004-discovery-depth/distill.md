---
type: bouncer.distill
title: 발견 핸드오프 여섯 산출과 겹침 판정 재료를 남김
description: Distill for 004
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-04T10:00:49.233+09:00'
bouncer:
  id: DISTILL-BP-004
  epic_id: '004'
  blueprint_id: '004'
  status: published
---
# Distill

## 승격 대상 (durable)

- discovery 확인 단계의 인계 이름은 `Goal` / `Scope` / `Non-goals` /
  `Success criteria` / `Edge cases & failure modes` / `Overlap` 여섯이다.
  `/bouncer-plan` 1단계는 이 이름을 인용하고, `Edge cases & failure modes` →
  blueprint Contract 「실패 모드·엣지 케이스」, `Overlap` → epic Out of scope
  또는 기존 blueprint 재사용으로 옮긴다.
- discovery 사전 읽기(`.bouncer/context/epics/` 인덱스, Distill.md)는 의무이되
  파일이 없으면 Overlap을 `"none"`으로 기록하고 진행한다 — 하드 중단이 아니다.
- Epic `## Blueprints` 한 줄 목적에는 무엇이 바뀌는지(what)와 어디를
  건드리는지(where)를 함께 적는다. 다음 discovery가 목록만으로 겹침을 판단한다.
- `config.source_dirs`가 `scripts`·`hooks`·`test`이면 Graphify source 질의는
  `skills/`를 돌려주지 않는다. 스킬을 만지는 blueprint는 suggested_paths에
  해당 스킬 경로를 수동으로 보태야 한다.
- 「동작을 바꾸면서 테스트를 더하거나 고치지 않은 diff」는 리뷰 Code quality
  후보(`minor`/`major`)이며, 순수 문서·설정 변경에는 걸리지 않는다. 루브릭은
  `skills/review`·`reviewer-prompt`·`agents/bouncer-reviewer` 세 곳이 함께
  바뀌어야 한다(기존 한 커밋 단위 Gotcha와 동일).

## 사이클 회고 (승격하지 않음)

- 표면 테스트를 먼저 넣고 스킬·템플릿·루브릭 본문을 맞추니 Checklist 회귀가
  바로 잡혔다.
- execute 게이트 재실행은 `verification.md` 증적 시각·tail을 다시 써서 트리를
  dirty하게 만든다 — 최종 증적 커밋 뒤에는 확인용 재실행을 하지 않는다.

## 다음 후보

- 002 `init-rules-scaffold` 상태 정리는 이 사이클과 무관하다.
- 겹침 점검의 자동화(그래프 질의·인덱스 파싱)는 Out of scope로 남겼다 — 별도
  BP가 필요하다면 discovery Handoff `Overlap`을 입력으로 받는 쪽이 자연스럽다.
