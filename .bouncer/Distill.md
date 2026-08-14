---
title: Project Distill
description: Current project invariants, gotchas, and decisions
resource: .bouncer/Distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-07T11:14:36+09:00'
distill:
  version: 1
  routing_enabled: false
  shards:
    - id: core
      always: true
      paths:
        - "**"
      pulls: []
    - id: validate-gates
      paths:
        - scripts/**
        - test/**
      pulls: []
    - id: context-layout
      paths:
        - .bouncer/context/**
        - scripts/src/lib/layout.ts
      pulls: []
    - id: git-worktree
      paths:
        - .worktrees/**
        - scripts/src/lib/git*.ts
      pulls: []
    - id: graph
      paths:
        - scripts/src/lib/graph*.ts
        - scripts/src/lib/context-digest.ts
      pulls: []
    - id: plugin-skills
      paths:
        - skills/**
        - agents/**
        - docs/**
        - plugin.json
      pulls: []
    - id: build-ts
      paths:
        - scripts/src/**
        - scripts/lib/**
        - tsconfig.json
      pulls: []
---
# Distill

Project-wide cautions for plan/execute. BP `explain.md` is a cycle candidate;
`/bouncer-finalize` promotes durable items here (add / replace / drop).
Decisions are **current** only — replace the sentence when it changes; do not
append a change log.

## Shards

core: shared workflow, scope, and Distill consumption rules.
validate-gates: validation, verification, and gate contracts.
context-layout: context ids, task layout, and migration rules.
git-worktree: worktree, commit-safety, and finalize boundaries.
graph: Graphify, digest, freshness, and graph absence behavior.
plugin-skills: plugin manifests, skills, agents, and trust boundaries.
build-ts: TypeScript emit and Node-only consumer constraints.
