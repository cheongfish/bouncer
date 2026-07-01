# SDD Plugin — Markdown Surface Design

Date: 2026-07-01
Status: Approved. Builds on the deterministic core delivered by
`docs/superpowers/plans/2026-07-01-sdd-harness-core.md` (Tasks 1–11, complete)
and the locked decisions in
`2026-07-01-sdd-plugin-schema-gates-design.md` and
`2026-06-30-sdd-plugin-session-handoff.md`.

## Scope

This document designs the **markdown surface + wiring** that turns the
finished deterministic core (`sdd-harness` CLI + commit-guard logic) into a
usable `plan → execute → finalize` workflow for Claude Code. It is a **single
spec covering the whole surface**:

- 4 commands: `/sdd-init`, `/sdd-plan`, `/sdd-execute`, `/sdd-finalize`
- 4 skills: `okf-authoring`, `graphify-runner`, `verification-loop`, `review-loop`
- 2 hooks: `commit-safety` (register existing logic), `session-graph` (new)
- `.sdd/` governance, config, templates, and the `current` pointer

It does **not** re-open the locked core (schema, gates, CLI behavior). Where it
changes a previously locked decision, that change is listed explicitly under
"Changes from Prior Design".

## Layer Boundaries (governing principle)

- **Deterministic core = up to the commit.** `sdd-harness` must stay portable
  (Claude Code first, then Codex/Cursor/Gemini), so it carries **no `gh` or
  GitHub dependency**. Its outer edge is a local commit.
- **Markdown layer = GitHub interaction (push + PR).** These are outward-facing,
  hard-to-reverse actions, so they live in the model-driven layer behind a
  confirm gate (dry-run default).
- **Hooks = enforcement outside model discretion.** `commit-safety` enforces
  `affected_paths` on **every** commit in the worktree.

Only `commands/` and `skills/` markdown is rewritten when expanding to other
platforms; `scripts/sdd-harness` and hook logic stay as the shared core.

---

## 1. Component Map

```text
commands/
  sdd-init.md          # bootstrap .sdd/ if absent
  sdd-plan.md          # epic→blueprint→tasks authoring, scaffold, graphify injection
  sdd-execute.md       # worktree entry, implementation, verification/review loops
  sdd-finalize.md      # distill authoring, validate, commit, push, PR
skills/
  okf-authoring/       # (shared) OKF frontmatter + body authoring — plan & finalize
  graphify-runner/     # query the prebuilt source graph → suggested_paths
  verification-loop/   # (new, self-contained) verify-until-pass → update verification.md
  review-loop/         # (new, self-contained) AI review-until-accepted → update review.md
hooks/
  commit-safety.js     # (logic complete) → register as PreToolUse in plugin.json
  session-graph.js     # (new) SessionStart: incremental source-graph build
.sdd/
  config.json          # okf_version, source_dirs, verify, base_branch, pr
  current              # active blueprint pointer (path + base branch)
  governance.md        # blueprint sizing rule (§5.4 of schema-gates design)
  workflow.md          # stage narrative
  okf.md               # pinned OKF version
  templates/{epic,blueprint,tasks,verification,review,distill,pr}.md
```

**Data flow (one line):**
`SessionStart (graph build) → /sdd-init (once) → /sdd-plan (author + scaffold +
suggested_paths, write .sdd/current) → /sdd-execute (worktree implement +
verify + review, guarded multi-commit) → /sdd-finalize (distill + validate +
commit remainder + push + draft PR)`.

### Self-containment note

`verification-loop` and `review-loop` are **fully self-contained** SDD skills
with **no hard dependency on the superpowers plugin**. Claude Code has no formal
cross-plugin skill dependency system — a `superpowers:<skill>` reference only
resolves if that plugin happens to be installed, which a distributable plugin
cannot assume. These skills therefore embody the review/TDD discipline inline
rather than invoking another plugin. (No optional soft reference is included.)

---

## 2. Bootstrap, Config & SessionStart

### 2.1 `/sdd-init`

If the project has no `.sdd/`, scaffold it:

- `config.json` (schema below), empty `current`, `governance.md`, `workflow.md`,
  `okf.md`, `templates/*`, and the root `context/index.md`.
- Add `.sdd/worktrees/` and `graphify-out/` to `.gitignore`.

Idempotent: if `.sdd/` already exists, `/sdd-init` reports and makes no changes.

### 2.2 `.sdd/config.json`

```json
{
  "okf_version": "0.x",
  "source_dirs": ["src", "test"],
  "verify": "npm test",
  "base_branch": "develop",
  "pr": { "draft": true, "base": "develop", "labels": ["sdd"] }
}
```

- `source_dirs` — directories graphify builds the source-code graph over.
- `verify` — command `verification-loop` runs to decide pass/fail.
- `base_branch` — base for worktree branches and the PR.
- `pr` — PR creation defaults (draft state, base, labels).

### 2.3 `hooks/session-graph.js` (SessionStart)

- Runs **only if `.sdd/` exists** in the project (zero cost on non-SDD sessions).
- Builds the source-code graph over `config.source_dirs` **incrementally**,
  reusing the `graphify-out/` cache; if the cache is fresh, it skips.
- Produces the graph that `graphify-runner` queries during `plan`. It does
  **not** write any `context/**` document.

---

## 3. `/sdd-plan`

Re-entrant: can create a new epic, or add a blueprint to an existing epic.

1. **ID allocation** — scan `context/epics` for the next sequential id
   (`EPIC-002` after `EPIC-001`, `BP-002` within an epic, etc.). User may
   override the suggested id.
2. **Scaffold** — call `sdd-harness scaffold epic` and/or `scaffold blueprint`
   to create the empty document set with OKF frontmatter (statuses at their
   scaffold defaults: epic/blueprint `draft`, tasks `draft`, verification
   `pending`, review `pending`, distill `draft`).
3. **Author** — drive the `okf-authoring` skill to write epic / blueprint /
   tasks body content.
4. **graphify** — drive `graphify-runner`: query the prebuilt source graph with
   the blueprint goal + tasks intent, roll matches up to directory granularity,
   and write `sdd.graph.suggested_paths` into `tasks.md`.
5. **affected_paths** — the command proposes `sdd.affected_paths` seeded from
   `suggested_paths`; the **user confirms/edits** it. (Empty → gate G5 fails.)
6. **Approval** — after the user approves, transition epic & blueprint
   `draft→approved` and tasks `draft→ready`. Approval is an **explicit user
   confirmation**, never silent.
7. **Pointer** — write the active blueprint path (and nothing else yet) to
   `.sdd/current`.
8. **Gate** — run `sdd-harness validate --gate plan` (G1–G5) and report.

---

## 4. `/sdd-execute`

1. Read the active blueprint from `.sdd/current`.
2. **Worktree** — create a blueprint-level worktree + branch:
   - branch `sdd/<BP-id>-<slug>`
   - base = the branch checked out at execute time (record base in `.sdd/current`)
   - location `.sdd/worktrees/<BP-id>` (gitignored)
3. **Implement** — treat the `tasks.md` checklist as the source of truth.
   Implementation may produce **one or more commits**. Every commit is guarded
   by the `commit-safety` hook, which rejects any commit touching files outside
   `affected_paths`. Per-task `affected_paths` attribution is **not** required —
   all commits share the one blueprint-level `affected_paths` set.
4. **verification-loop** (self-contained): run `config.verify`; on failure, fix
   and repeat until it passes. On pass, **fill the existing `verification.md`**
   with the command + result and transition statuses: `verification: passed`,
   `tasks: verified`. It does **not** create a new file.
5. **review-loop** (self-contained): run an AI subagent code-review over the
   worktree diff; resolve findings; **update the existing `review.md`** and set
   `review: accepted`. If `review.required: false`, skip the loop (the recorded
   policy already satisfies gate G8).
6. **Gate** — run `sdd-harness validate --gate execute` (G6–G8).

---

## 5. `/sdd-finalize`

1. **Distill** — drive `okf-authoring` to write `distill.md`; set
   `distill: published`.
2. **Validate** — `sdd-harness validate --gate finalize` (G9).
3. **Commit remainder (core)** — `sdd-harness finalize` checks any remaining
   uncommitted change against the allowed-set and commits it (if any). Anything
   outside the allowed-set is a **hard abort — nothing staged**. Defaults to
   **dry-run**; `--yes` (or confirmation) commits.
4. **Push + PR (markdown layer)** — on confirmation, push the branch and run
   `gh pr create`:
   - title `<type>(<bp-id>): <summary>`
   - body **reuses the §5.6 commit template** (Epic / Blueprint / Implemented /
     Verified / Distilled) — no separate PR body structure
   - base = `config.base_branch`; created as **draft** by default
   - dry-run shows the PR body first; confirmation creates it.
5. **No remote / no `gh`** — push and PR are **skipped gracefully**; finalize
   stops after the local commit. Worktree cleanup and merge/PR-merge are the
   user's responsibility (or a later enhancement).

`.sdd/templates/pr.md` exists but mirrors the §5.6 structure so the PR body and
the commit message stay identical in shape.

---

## 6. Hook Wiring & Status Ownership

### 6.1 `commit-safety` registration

Register the existing `hooks/commit-safety.js` logic as a **PreToolUse hook**
in `plugin.json`, matching Bash `git commit` invocations.

- Resolve the active blueprint from `.sdd/current` → read `affected_paths` from
  that blueprint's `tasks.md`.
- Compute the files about to be committed itself
  (`git diff --cached --name-only`).
- If any staged file is outside the allowed-set, **reject the commit** (exit 1).
- Applies to **every** commit in the worktree, which is what makes execute-time
  multi-commit safe.

The registered hook adapts the Claude Code PreToolUse payload (the Bash command)
into the guard's `{ files, affectedPaths, blueprintDir }` inputs; the pure
`checkCommitSafety` logic is unchanged.

### 6.2 Status transition ownership

| Transition | Owner |
|---|---|
| epic / blueprint `draft→approved` | `/sdd-plan` (explicit user approval) |
| tasks `draft→ready` | `/sdd-plan` |
| tasks `→verified`, verification `→passed` | `verification-loop` |
| review `→accepted` | `review-loop` |
| distill `→published` | `/sdd-finalize` |

Per the schema-gates design, transitions are **convention**, not machine-
enforced ordering; `validate` only checks enum membership (structural) and the
required terminal states at each gate.

---

## Changes from Prior Design

- **Commit granularity (§5.4 of schema-gates design):** "one commit per
  blueprint (v1)" → **multiple commits allowed during `execute`**. Rationale:
  commits arise naturally during implementation and the `commit-safety` hook
  already guards each one. Per-task `affected_paths` attribution remains
  unnecessary because every commit stays within the single blueprint-level
  `affected_paths` set — so this does not reopen the deferred per-task layer.
- **Finalize endpoint:** finalize no longer stops at the commit. It now **pushes
  and opens a draft PR** (markdown layer), reusing the §5.6 template for the PR
  body. Skipped gracefully when there is no remote or `gh`.
- **graphify build timing:** built automatically at **SessionStart** (incremental,
  `.sdd/`-gated) rather than on-demand inside `plan`.

## Open Items After This Design

Deliberate exclusions to revisit later (none blocking):

- Worktree auto-cleanup and auto-merge after PR merge.
- Per-task commit granularity + per-task `affected_paths`.
- Wave/subagent parallel execution inside `execute`.
- Multi-platform (Codex/Cursor/Gemini) markdown rewrites.

Once this design is approved, proceed to an implementation plan (writing-plans).
