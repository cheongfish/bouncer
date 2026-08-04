---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-010-active-pointer-cli/blueprints/BP-001-current-command/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-04T09:15:24.845+09:00'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-010
  blueprint_id: BP-001
  status: published
---
# Distill

## 승격 대상 (durable)

- 활성 포인터의 지원 표면은 `bouncer current`(읽기 / `--set` / `--clear`)다.
  워크플로 스킬은 `node -e`로 `scripts/lib/current`를 직접 부르지 않는다.
- 포인터 파일의 실제 위치는 Git common directory 아래 `bouncer/current`다.
  문서·스킬에 `.bouncer/current`라고 쓰지 않는다.
- 포인터 부재는 오류가 아니다 — 인자 없는 `bouncer current`는 항상 종료 코드
  `0`이고, 포인터가 없을 때만 `ready` 후보 목록을 붙인다.
- `listReadyBlueprints` 후보는 blueprint `approved` + tasks `ready` /
  `in_progress`만 포함한다. `verified`는 후보가 아니다. 깨진 문서는 그
  항목만 건너뛴다.
- `--set`은 plan 게이트를 통과할 때만 포인터를 쓴다. 실패 목록은
  `validateBlueprint` 결과를 가공 없이 싣고 포인터는 그대로 둔다.

## 사이클 회고 (승격하지 않음)

- 후보 선별·정렬·깨진 문서 건너뛰기 실패 테스트를 먼저 넣고 구현하니
  Interface 거부 경로가 Checklist와 바로 맞물렸다.
- execute의 null 안내는 후보 유무로 갈라야 한다 — "다시 계획하라" 일률
  문구가 대기 중인 ready 블루프린트를 숨긴다.

## 다음 후보

- finalize가 커밋 후 다음 후보를 통지하는 것 — `listReadyBlueprints`의
  첫 후속 소비자지만 finalize 반환 계약·테스트를 함께 건드려야 해서
  이 사이클에서는 빼 두었다.
- 포인터 자동 전진은 받지 않는다 — 커밋 가드가 시작하지 않은 블루프린트의
  `affected_paths`를 강제하게 되어 `clearCurrent`가 막으려던 상황을 되살린다.
