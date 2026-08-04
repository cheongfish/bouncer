---
type: bouncer.distill
title: BP-002 distill
description: Distill for BP-002
resource: .bouncer/context/epics/EPIC-011-graphify-signal/blueprints/BP-002-graph-path-contract/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-04T17:22:03.430+09:00'
bouncer:
  id: DISTILL-BP-002
  epic_id: EPIC-011
  blueprint_id: BP-002
  status: published
---
# Distill

## Cycle notes
- `source_dirs: ["."]`는 허용하되, mtime 스캔이 `graphify-out`을 제외해야 두 번째 sync가 skip-fresh가 된다.
- graphify의 manifest.json은 GRAPHIFY_OUT과 무관하게 `<cwd>/graphify-out/manifest.json`에 쓰이므로 part cwd 격리가 필요하다.

## Promote (durable)
- Gotcha: newestMtimeUnder는 graphify-out / node_modules / .git / .worktrees를 이름 기준으로 건너뛰고 디렉터리 심볼릭 링크를 따라가지 않는다.
- Decision: init의 source_dirs 기본값은 고정 후보 중 실재하는 디렉터리만이며, 후보가 없으면 [] + sourceDirsUnresolved로 알린다(기존 config는 덮지 않음).

## Next
- 없음 (EPIC-011 BP 스트림 종료).
