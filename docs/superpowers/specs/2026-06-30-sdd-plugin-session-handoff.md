# SDD Plugin Session Handoff

Date: 2026-06-30 (revised 2026-07-01)
Status: Direction + command surface locked; schema and gates still pending. See "Locked vs Pending" below for the honest split.

## Goal

Build a plugin for Spec-Driven Development. The plugin runs inside a project directory and guides work from large context down to executable tasks, then finalizes the work with validation and an automatic commit.

## Platform Target

Build for **Claude Code first**. Once the flow works end-to-end, expand to Codex, Cursor, and Gemini.

Rationale: the deterministic core (the `sdd-harness` CLI + hooks) is portable. Only the markdown surface (commands/skills) must be rewritten per platform. Anchoring on the portable core keeps expansion cheap.

## Command Surface (Locked)

The surface is a **3-layer model plus hooks**:

```text
command  ─┐  both are markdown = model-driven.
          ├─ the command/skill boundary is a CONVENTION we impose,
skill    ─┘  not a platform-enforced layer (in Claude Code they are
             the same mechanism: a SKILL.md / command .md prompt).
            ↓ invokes via Bash
CLI      ──── deterministic executable: scripts/sdd-harness
hooks    ──── deterministic guard, runs OUTSIDE model discretion
```

The only platform-enforced boundary is **markdown (model-driven) ↔ CLI/hooks (deterministic)**. The command→skill split earns its keep only where a skill is reused across commands or auto-invoked; do not split 1:1 as empty ceremony.

| Layer | Role | SDD members |
|---|---|---|
| **command** | User entrypoint, thin stage orchestration | `/sdd-plan`, `/sdd-execute`, `/sdd-finalize` |
| **skill** | Reusable / auto-invoked capability | `okf-authoring` (shared by plan + finalize), `graphify-runner`, `verification-loop`, `review-loop` |
| **CLI** | Deterministic logic the model calls via Bash | `sdd-harness <scaffold\|validate\|finalize>` |
| **hooks** | Deterministic enforcement outside model control | commit-safety guard (affected_paths enforcement, auto-commit gate) |

Per-stage mapping:

| Stage | command (entry) | skills it drives | CLI it calls | hooks |
|---|---|---|---|---|
| plan | `/sdd-plan` | `okf-authoring`, `graphify-runner` | `sdd-harness scaffold` (empty templates + OKF frontmatter), graphify | — |
| execute | `/sdd-execute` | `verification-loop`, `review-loop` | none (reads `tasks.md` only; no CLI state) | — |
| finalize | `/sdd-finalize` | `okf-authoring` | `sdd-harness validate`, `sdd-harness finalize` | commit-safety guard enforces affected_paths + auto-commit |

Key resolutions of the earlier inconsistency:

- `validate` is **not a user-facing stage**. It is a CLI primitive that `finalize` calls (and can be run standalone for debugging).
- `execute` has **no CLI** by design — pure markdown reading `tasks.md`.
- The CLI scaffolds **empty** templates + frontmatter only; the **command/skill writes the content**. The CLI never authors reasoning.
- Commit safety is enforced by **hooks**, not by trusting the model to run the CLI. Validation/commit must run outside model discretion.

## Workflow

Use an issue-centered hierarchy:

```text
epic -> blueprint -> tasks -> execute/review -> finalize/distill
```

The stage naming (one name per stage; layers split by responsibility, see "Command Surface" above):

```text
plan      # epic -> blueprint -> tasks
execute   # markdown-only implementation and review loop
finalize  # distill, validate, auto commit
```

`execute` is intentionally CLI-free so implementation does not depend on extra CLI state. It treats `tasks.md` as the source of truth.

## Directory Model

`.sdd/` stores project governance and plugin rules. It is not part of the OKF bundle.

`context/` stores the actual SDD work products. It is the OKF bundle.

```text
.sdd/
  config.json
  governance.md
  workflow.md
  okf.md
  templates/
    epic.md
    blueprint.md
    tasks.md
    verification.md
    review.md
    distill.md

context/
  index.md
  epics/
    EPIC-001-name/
      index.md
      blueprints/
        BP-001-name/
          index.md
          tasks.md
          verification.md
          review.md
          distill.md
```

## OKF Decision

Adopt Google Cloud Open Knowledge Format in strict mode for `context/`.

Rules:

- `context/**/*.md` is an independent OKF concept.
- Every context document has OKF frontmatter.
- SDD-specific fields live under an `sdd:` namespace.
- OKF version should be pinned in `.sdd/okf.md`.
- `.sdd/` governance documents are not OKF documents for now.

Expected OKF fields:

```yaml
---
type: sdd.tasks
title: Implement login session handling
description: Tasks for BP-001 under EPIC-001.
resource: context/epics/EPIC-001-auth/blueprints/BP-001-login/tasks.md
tags: [sdd, tasks, auth]
timestamp: 2026-06-30T00:00:00+09:00
sdd:
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: ready
---
```

## Graphify Decision

Run `graphify` only during `sdd plan`.

Purpose:

- inspect the project/context graph
- suggest affected paths
- inject suggested paths into `tasks.md`

Execution and finalize should not run graphify as a source of truth. `tasks.md` owns the final `affected_paths`.

Suggested split:

```yaml
sdd:
  affected_paths:
    - src/auth/
    - test/auth/
  graph:
    generated_at: 2026-06-30T00:00:00+09:00
    command: npx sdd-harness graphify
    suggested_paths:
      - src/auth/
      - test/auth/
```

## Affected Paths And Commit Safety

`tasks.md` must define `affected_paths`.

`sdd finalize` should:

- fail if changed files are outside `affected_paths`
- fail if untracked files are outside `affected_paths`
- stage only files covered by `affected_paths`
- generate a commit message from a fixed template
- commit automatically without user confirmation

The commit template should be deterministic:

```text
<type>(<bp-id>): <summary>

Epic: <epic-id>
Blueprint: <bp-id>

Implemented:
- <task summary>

Verified:
- <verification summary>

Distilled:
- <distill path>
```

## Proposed Document Types

```text
sdd.epic
sdd.blueprint
sdd.tasks
sdd.verification
sdd.review
sdd.distill
```

## Proposed Type-Specific Statuses

These are not fully approved yet, but were preferred over one shared status enum.

```text
sdd.epic
  draft -> approved -> closed

sdd.blueprint
  draft -> approved -> superseded

sdd.tasks
  draft -> ready -> in_progress -> verified

sdd.verification
  pending -> passed -> failed

sdd.review
  pending -> requested -> addressed -> accepted

sdd.distill
  draft -> published
```

Review should not use a `skipped` status. If review is optional, record it as policy:

```yaml
sdd:
  review:
    required: false
    reason: docs-only change
```

## Proposed Gates

These still need explicit approval.

```text
sdd plan complete
  epic: approved
  blueprint: approved
  tasks: ready
  graph.suggested_paths exists
  affected_paths confirmed

sdd execute complete
  tasks: verified
  verification: passed
  review: accepted, or review.required: false

sdd finalize complete
  distill: published
  git diff stays inside tasks.affected_paths
  commit metadata is complete
  automatic commit succeeds
```

## Architecture (Claude Code, 3-layer + hooks)

```text
claude-code-plugin/
  .claude-plugin/plugin.json
  commands/                 # user entrypoints (markdown, model-driven)
    sdd-plan.md
    sdd-execute.md
    sdd-finalize.md
  skills/                   # reusable / auto-invoked capabilities
    okf-authoring/SKILL.md
    graphify-runner/SKILL.md
    verification-loop/SKILL.md
    review-loop/SKILL.md
  scripts/
    sdd-harness(.js)        # deterministic CLI: scaffold | validate | finalize
  hooks/                    # deterministic enforcement
    commit-safety.*         # affected_paths + auto-commit guard
```

Responsibilities:

- `/sdd-plan` (command): drive `okf-authoring` + `graphify-runner`; author epic/blueprint/tasks content; call `sdd-harness scaffold` for empty templates + OKF frontmatter; inject graphify `suggested_paths`.
- `/sdd-execute` (command): read `tasks.md`; implement; drive `verification-loop` / `review-loop`; record verification/review outputs. No CLI.
- `sdd-harness validate` (CLI): check OKF fields, SDD fields, resource paths, statuses, and transition gates.
- `/sdd-finalize` (command): call `sdd-harness validate` then `sdd-harness finalize`; the **commit-safety hook** enforces affected_paths, generates the commit message, and runs the auto commit outside model discretion.

Portability note: only `commands/` and `skills/` markdown is rewritten when expanding to Codex / Cursor / Gemini. `scripts/sdd-harness` and the hook logic stay as the shared deterministic core.

## Locked vs Pending (honest split)

**Locked:**

- Platform target: Claude Code first, then Codex / Cursor / Gemini.
- Directory model: `.sdd/` (governance, non-OKF) vs `context/` (OKF bundle).
- OKF strict for `context/**`; SDD fields under `sdd:` namespace.
- graphify only in `plan`; `tasks.md` owns `affected_paths`.
- Stage model `plan -> execute -> finalize`; `execute` is CLI-free.
- Command surface: 3-layer (command / skill / CLI) + hooks, per the table above.

**Pending (decide next):**

1. Final frontmatter schema for each document type.
2. Final status enum and transition rules per type.
3. Exact `sdd-harness validate` failures (machine-checkable conditions).
4. Exact `plan` graphify input/output contract.
5. Exact `finalize` commit and staging rules — including the auto-commit confirmation policy, dry-run output, and partial-staging behavior on failure.

## Next Session Start

Start by saying:

```text
Continue from docs/superpowers/specs/2026-06-30-sdd-plugin-session-handoff.md.
Direction and command surface are locked. Continue brainstorming the Pending items: schema, statuses, and gate conditions.
```

Do not start implementation until the schema and gates are approved.
