---
type: bouncer.blueprint
title: 대기 task 주석 검사 범위 보정
description: Excludes pending sibling task scaffolds from active-task context comment linting.
resource: .bouncer/context/epics/063-maintenance/blueprints/002-pending-task-comment-lint/index.md
tags:
  - bouncer
  - blueprint
  - context-lint
  - pending-task
timestamp: '2026-09-05T22:46:06.819+09:00'
bouncer:
  id: '002'
  epic_id: '063'
  blueprint_id: '002'
  status: closed
  commit_type: fix
  scale: light
  supersedes: []
---
# 002 pending-task-comment-lint

Epic: [063](../../index.md) · Tasks: [001](tasks/001/tasks.md)

## Intent

실행 전 형제 작업 단위의 스캐폴드 주석이 현재 작업 단위의 검증을 막지 않도록 검사 대상을 보정함.
