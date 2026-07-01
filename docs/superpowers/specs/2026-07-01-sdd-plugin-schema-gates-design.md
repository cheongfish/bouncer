# SDD Plugin — Schema, Statuses & Gates Design

Date: 2026-07-01
Status: Approved for these five items. Supersedes the "Pending" section of
`2026-06-30-sdd-plugin-session-handoff.md`. Locked decisions in the handoff
still hold except where explicitly noted under "Changes from Handoff".

## Scope

This document resolves the five Pending items left open by the session handoff:

1. Final frontmatter schema per document type.
2. Status enum + transition-enforcement model.
3. `sdd-harness validate` failure conditions.
4. `plan` graphify input/output contract.
5. `finalize` commit & staging rules (incl. worktree isolation).

It does **not** re-open Locked decisions (platform target, directory model,
OKF strict for `context/**`, `plan → execute → finalize`, 3-layer + hooks
command surface).

## Changes from Handoff

- **Auto-commit policy**: handoff said "commit automatically without user
  confirmation". This is changed to **default dry-run + confirm**, with a
  `--yes` flag to skip confirmation. Rationale: a hard-to-reverse action gets a
  human check by default.
- **graphify invocation**: handoff recorded `command: npx sdd-harness graphify`.
  graphify is now invoked as an **MCP tool** driven by the `graphify-runner`
  skill. The frontmatter `graph.command` records the MCP call reference instead.
- **execute isolation**: `execute` now runs in a **blueprint-level git
  worktree** (new). This does not add CLI state to execute; it is a workspace
  isolation strategy.

---

## 1. Frontmatter Schema

### 1.1 Common OKF base (every `context/**/*.md`)

```yaml
type: sdd.<kind>          # sdd.epic | sdd.blueprint | sdd.tasks
                          # | sdd.verification | sdd.review | sdd.distill
title: <string>
description: <string>
resource: context/...     # this document's own relative path
tags: [sdd, <kind>, ...]
timestamp: 2026-07-01T00:00:00+09:00   # last-modified time; git owns history
```

Single `timestamp` only. Status-transition history is intentionally **not**
tracked in frontmatter — git is the source of truth for history.

### 1.2 Common `sdd:` core

Every document carries its own `id` plus its parent ids:

```yaml
sdd:
  id: <self-id>
  epic_id: EPIC-001       # all documents
  blueprint_id: BP-001    # blueprint and below
  status: <type-specific>
```

### 1.3 ID scheme

| Type | `id` prefix | Example |
|---|---|---|
| sdd.epic | `EPIC-` | `EPIC-001` |
| sdd.blueprint | `BP-` | `BP-001` |
| sdd.tasks | `TASKS-` + blueprint_id | `TASKS-BP-001` |
| sdd.verification | `VERIFY-` + blueprint_id | `VERIFY-BP-001` |
| sdd.review | `REVIEW-` + blueprint_id | `REVIEW-BP-001` |
| sdd.distill | `DISTILL-` + blueprint_id | `DISTILL-BP-001` |

Leaf documents (tasks/verification/review/distill) each carry an explicit
`id`. There is exactly one of each leaf type per blueprint, so the leaf `id`
embeds its `blueprint_id`.

### 1.4 Per-type fields

```yaml
# sdd.epic  — context/epics/EPIC-001-name/index.md
sdd:
  id: EPIC-001
  epic_id: EPIC-001
  status: draft            # no blueprint_id at the epic level

# sdd.blueprint  — context/epics/EPIC-001-name/blueprints/BP-001-name/index.md
sdd:
  id: BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: draft

# sdd.tasks  — .../BP-001-name/tasks.md   (owns affected_paths)
sdd:
  id: TASKS-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: draft
  affected_paths:                 # final, human-confirmed; owned here
    - src/auth/
    - test/auth/
  graph:                          # graphify output; suggestion only
    generated_at: 2026-07-01T00:00:00+09:00
    command: mcp:graphify         # MCP tool reference (see §4)
    suggested_paths:
      - src/auth/
      - test/auth/

# sdd.verification  — .../BP-001-name/verification.md
sdd:
  id: VERIFY-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: pending

# sdd.review  — .../BP-001-name/review.md
sdd:
  id: REVIEW-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: pending
  review:
    required: true                # if false, add: reason: <string>

# sdd.distill  — .../BP-001-name/distill.md
sdd:
  id: DISTILL-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: draft
```

Task items themselves live in the **body** of `tasks.md` as a markdown
checklist, not in frontmatter. Frontmatter carries only document-level status.

---

## 2. Status Enum & Transition Model

### 2.1 Enums (per type)

```text
sdd.epic          draft → approved → closed
sdd.blueprint     draft → approved → superseded
sdd.tasks         draft → ready → in_progress → verified
sdd.verification  pending → passed → failed
sdd.review        pending → requested → addressed → accepted
sdd.distill       draft → published
```

Review has **no `skipped` status**. Optional review is recorded as policy:

```yaml
sdd:
  review:
    required: false
    reason: docs-only change
```

### 2.2 Enforcement model — gate-based, not step-by-step

The arrows above are **documentation/convention**, not machine-enforced
transitions. `validate` enforces two things only:

1. **Structural (always):** `status` value is a member of that type's enum.
2. **Gate (on demand):** at `plan` / `execute` / `finalize` completion,
   required terminal states hold (see §3.B).

Intermediate transition ordering (e.g. skipping `ready`) is **not** enforced.
Rationale: `execute` is CLI-free with no state store, so tracking "previous
state" would require infrastructure the design deliberately avoids.

---

## 3. `sdd-harness validate` Failure Conditions

- **Scope:** a **single blueprint directory** (its tasks/verification/review/
  distill plus the ancestor epic & blueprint `index.md`). The target blueprint
  is the one the calling stage is operating on.
- **Behavior:** collect **all** failures (no fail-fast).
- **Output:** JSON to stdout; exit `0` on pass, `1` on any failure.

```json
{
  "ok": false,
  "failures": [
    { "code": "S3", "message": "resource path mismatch", "file": "context/.../tasks.md" }
  ]
}
```

### 3.A Structural checks (always run)

| Code | Condition |
|---|---|
| S1 | OKF required field missing (type/title/description/resource/tags/timestamp) |
| S2 | `type` not in `sdd.{epic,blueprint,tasks,verification,review,distill}` |
| S3 | `resource` path does not match the file's actual location |
| S4 | `sdd.id` prefix inconsistent with `type` (e.g. tasks doc with `id: BP-001`) |
| S5 | `sdd.id` / `epic_id` / `blueprint_id` disagree with values parsed from the path |
| S6 | `status` not in that type's enum |
| S7 | tasks doc missing `affected_paths`, or it is an empty list |
| S8 | Parent document absent (e.g. tasks present but no ancestor blueprint `index.md`) |

### 3.B Gate checks (`--gate plan|execute|finalize`)

```text
--gate plan
  G1  epic.status == approved
  G2  blueprint.status == approved
  G3  tasks.status == ready
  G4  tasks.graph.suggested_paths exists
  G5  tasks.affected_paths exists and is non-empty

--gate execute
  G6  tasks.status == verified
  G7  verification.status == passed
  G8  review.status == accepted  OR  review.required == false

--gate finalize
  G9  distill.status == published
```

Commit/diff-scope enforcement is **not** part of `validate` — it belongs to the
commit-safety hook (§5).

---

## 4. `plan` graphify Contract

### 4.1 Invocation

`graphify` is invoked as an **MCP tool**, driven by the `graphify-runner`
skill during `plan`. It is not an `sdd-harness` subcommand.

### 4.2 Two graph domains

1. **Source-code graph** — at session start, the source directory is detected
   and a graph is built over the **source code**. This is the graph queried to
   suggest affected paths.
2. **Context navigation** — `context/**` documents are traversed
   **hierarchically via each directory's `index.md`** (the OKF bundle). This is
   navigation, separate from path suggestion.

### 4.3 Input

The blueprint's goal + the tasks intent text is the query against the
**source-code graph**. graphify locates related source nodes (files/modules).

### 4.4 Output → `suggested_paths`

Related source nodes are **rolled up to directory granularity**
(e.g. `src/auth/login.ts`, `src/auth/session.ts` → `src/auth/`). The rolled-up
directory list becomes `sdd.graph.suggested_paths`.

### 4.5 Write responsibility

- The `graphify-runner` skill writes `sdd.graph.suggested_paths` into
  `tasks.md`.
- The `/sdd-plan` command (model) then proposes `sdd.affected_paths`, seeded
  from `suggested_paths`, and the **user confirms/edits** it.
- Gate `G5` fails if `affected_paths` is empty. `tasks.md` owns the final
  `affected_paths`; graphify never owns it.

---

## 5. `finalize` Commit & Staging Rules

### 5.1 Worktree isolation

`/sdd-execute` creates a **blueprint-level git worktree + branch** from base
and performs implementation and review there. `finalize` commits within that
worktree. Isolation makes the worktree diff equal to that blueprint's work,
which keeps affected-path reasoning clean.

### 5.2 Allowed-to-commit set

```text
allowed = affected_paths                    # source / implementation
        ∪ related_artifacts                 # this blueprint's own context docs

related_artifacts =
    context/epics/<EPIC>/blueprints/<BP>/**        # this BP's tasks/verify/review/distill
    context/epics/<EPIC>/blueprints/<BP>/index.md
    context/epics/<EPIC>/index.md                  # ancestor epic index, if modified
    context/index.md                               # root index, if modified
```

Only the **current** blueprint's subtree + modified ancestor `index.md` files
are auto-allowed. Another blueprint's or epic's documents are **not** in the
allowed set.

### 5.3 Out-of-scope behavior — hard abort

If the worktree diff (tracked changes **or** untracked files) contains anything
outside `allowed`, `finalize` **aborts entirely** and prints the violation
list. Nothing is staged. The user either edits `affected_paths` or removes the
stray files, then retries. No partial commits.

### 5.4 Commit granularity — one commit per blueprint (v1)

`finalize` produces a **single commit** for the blueprint, staging source +
all tasks + verification + review + distill together. A blueprint is one
logical, reviewable unit.

Sizing rule (to be recorded in `.sdd/governance.md`): **a blueprint is split so
it fits one reviewable commit.** If work feels too large for one commit, split
the blueprint — do not add a subtask layer.

Per-task commits are explicitly **out of scope for v1**. They would require
per-task path attribution in `tasks.md` to split a blended diff; deferred until
the single-commit flow is validated.

### 5.5 Confirmation policy

`finalize` defaults to **dry-run**: it prints the files that would be staged
and the generated commit message, then waits for confirmation. `--yes` skips
confirmation. The commit-safety hook runs the check and the auto-commit outside
model discretion once confirmed.

### 5.6 Commit message template (deterministic)

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

### 5.7 Future / optional (not v1)

Wave-based execution with parallel subagents inside `/sdd-execute` is a valid
future optimization. It is an **execution strategy only** — it does not change
the schema, the gates, or the commit model. It can be layered onto `execute`
later without touching this design.

---

## Open Items After This Design

None blocking. The following are deliberate v1 exclusions to revisit later:

- Per-task commit granularity + per-task `affected_paths`.
- Wave/subagent parallel execution in `execute`.
- A formal subtask schema layer.

Once this design is approved, proceed to an implementation plan
(writing-plans) — not before.
