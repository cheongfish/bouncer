---
type: bouncer.blueprint
title: Codex named dispatch가 config 모델을 쓰도록 fork_turns 조건을 규칙에 명시함
description: State in the shared subagent-model rule that a Codex dispatch carrying a model slug sets fork_turns none, and list copy-ready per-provider models in config.example.json.
resource: .bouncer/context/epics/maintenance/blueprints/codex-subagent-model-fork/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-13T21:47:09.200+09:00'
bouncer:
  id: codex-subagent-model-fork
  epic_id: maintenance
  blueprint_id: codex-subagent-model-fork
  status: closed
  order: 5
  commit_type: fix
  scale: light
  review_scope: blueprint
  supersedes: []
---
# 005 Codex named dispatch가 config 모델을 쓰도록 fork_turns 조건을 규칙에 명시함
Epic: [063](../../index.md) · Tasks: [001](tasks/001/tasks.md)
## Intent
Codex `spawn_agent`는 전체 대화를 잇는 fork에 `model`을 받지 않는데, 공통 규칙 `rules/subagent-model.md`는 `fork_turns: "none"`을 요구하지 않아 run·execute 경로에서 config의 역할별 모델이 적용되지 않을 수 있다.
규칙이 Codex에서 slug를 넘길 때 `fork_turns: "none"`을 함께 지정하도록 명시하고, `config.example.json`에 프로바이더별로 복사해 쓸 모델 목록을 성능 순으로 둔다.
