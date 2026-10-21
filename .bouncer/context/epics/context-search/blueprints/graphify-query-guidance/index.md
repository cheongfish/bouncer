---
type: bouncer.blueprint
title: Graphify 질의 가이드 정비
description: Fixes Graphify query guidance to reduce candidate blowup and anchor query principles.
resource: .bouncer/context/epics/context-search/blueprints/graphify-query-guidance/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-09-04T21:42:22.437+09:00'
bouncer:
  id: graphify-query-guidance
  epic_id: context-search
  blueprint_id: graphify-query-guidance
  status: closed
  order: 32
  commit_type: feat
  scale: light
  supersedes: []
---
# 001 Graphify 질의 가이드 정비

Epic: [063](../../../maintenance/index.md) · Tasks: [001](tasks/001/tasks.md)

## Intent
- 탐색 질의 시 일반어나 허브 시드 사용으로 인한 후보 폭발을 방지함.
- 검색 공간 축소 4대 원칙을 러너 문서와 테스트에 명문화함.
