---
type: bouncer.blueprint
title: Graphify 질의 가이드 정비
description: Fixes Graphify query guidance to reduce candidate blowup and anchor query principles.
resource: .bouncer/context/epics/063-maintenance/blueprints/001-graphify-query-guidance/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-09-04T21:42:22.437+09:00'
bouncer:
  id: '001'
  epic_id: '063'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: light
  supersedes: []
---
# 001 Graphify 질의 가이드 정비

Epic: [063](../../index.md) · Tasks: [001](tasks/001/tasks.md)

## Intent
- 탐색 질의 시 일반어나 허브 시드 사용으로 인한 후보 폭발을 방지함.
- 검색 공간 축소 4대 원칙을 러너 문서와 테스트에 명문화함.
