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
  routing_enabled: true
  shards:
    - id: core
      always: true
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
        - scripts/src/lib/seed-worktree.ts
        - scripts/src/lib/runtime-state.ts
        - scripts/src/lib/scope.ts
        - scripts/src/lib/commit-hook.ts
      pulls: []
    - id: graph
      paths:
        - scripts/src/lib/graph*.ts
        - scripts/src/lib/context-digest.ts
      pulls: []
    - id: plugin-skills
      paths:
        - skills/bouncer-*/**
        - references/**
        - agents/**
        - rules/**
        - docs/ARCHITECTURE.md
        - docs/cli.md
        - docs/compatibility.md
        - docs/configuration.md
        - docs/context-versioning.md
        - docs/contributing.md
        - docs/gates.md
        - docs/install.md
        - docs/README.md
        - docs/troubleshooting.md
        - docs/workflow.md
        - plugin.json
        - .claude-plugin/**
        - .cursor-plugin/**
        - .codex-plugin/**
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

core: shared workflow, scope, and Distill consumption rules (always-only).
validate-gates: validation, verification, and gate contracts.
context-layout: context ids, task layout, and schema constants.
git-worktree: worktree, commit-safety, and finalize boundaries.
graph: Graphify, digest, freshness, and graph absence behavior.
plugin-skills: entry skills, helper references, agents, rules, host manifests, top-level docs.
build-ts: TypeScript emit and Node-only consumer constraints.
