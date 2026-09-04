# Governance

## Blueprint sizing rule

Each **task bundle** (`tasks/<NNN>/{tasks,verification,review}.md`) is sized
for **one reviewable commit**. A blueprint may hold several task bundles and
remains the review / PR unit. Root `tasks.md` and `tasks-NNN.md` documents are
input only to `bouncer migrate task-layout`. If a task feels too large for one commit, split it
into more task bundles (or more blueprints). Do **not** invent a further
subtask layer beneath a task bundle.

The plan gate emits a non-blocking `warnings` entry when a task's
`affected_paths` count exceeds 20. That signal only advises splitting when
one-commit review would be hard; it is not a blocking rule, does not invent a
G/S failure code, and does not change gate success or process exit codes.
Legitimate wide tasks (bulk renames, migrations) still pass.

`/bouncer-commit` closes one task (scope check → `bouncer commit`).
`/bouncer-run` repeats that commit unit; it does not change it.
`/bouncer-execute` does not commit. `/bouncer-finalize` closes the blueprint
(Distill promotion, explain + quiz, remainder commit, draft PR, worktree
cleanup) after every task is committed.

Task commits authorize the complete existing candidate set through the shared
scope helper, then stage task outputs only. Task bundles, context documents,
and Distill remain for finalize; finalize stages tracked transient deletions
and removes untracked documents without adding paths that no longer exist. The
task's `commit_sha` stays in its working-tree document until finalize copies it
to `explain.md`.

## Lightweight cycle

A **lightweight cycle** is in
effect only when the user **declares** a narrow-scope change at `/bouncer-plan`
and the plan changes blueprint `index.md` `bouncer.scale` from the scaffold
default `full` to `light`. There is no automatic sizing from diff size, path
count, or file count. Without that declaration (`scale` absent or not
`light`), the default path applies.

The same declaration is the only way to reach the shrunken document set:
`bouncer scaffold blueprint --scale light`. Omitting `--scale`, or passing
`full`, scaffolds the unchanged five plan documents; an unknown value is
refused with exit code 2 before a single file is written.

What shrinks (five things only):

1. **Plan documents** — `--scale light` writes four documents: blueprint
   `index.md` plus `tasks/001/{tasks,verification,review}.md`. It creates no
   `context-review.md`, so `/bouncer-plan` runs no context review on a light
   blueprint and the plan gate applies no **G18** there. The four scaffolded
   documents total **100 lines or fewer**.
2. **Gated task sections** — **G10** requires only `Goal & intent`, `Touch`,
   and `Checklist` on a light blueprint. `Interface` and `Do not touch` are
   neither templated nor demanded. Approved scope is untouched: **G3–G5**,
   and **G11** judge a light plan exactly as they judge a full one, so
   an empty `affected_paths` or an empty `scope_evidence.basis` still fails.
   **G12** stays wired on light and judges a `Do not touch` section the same
   way when one is present — the light template ships none, so a light plan
   normally gives it nothing to judge.
3. **Epic allocation** — do not open a new epic. Stack the blueprint under the
   shared **maintenance epic** (slug `maintenance`). If that epic is missing,
   create it once with normal numbering, then keep stacking blueprints under it.
   Never close that epic.
4. **Agent round-trips** — when `bouncer.scale` is `light`, run the implementer
   **inline** (same session) instead of named-agent dispatch. Keep the host
   `named agents are unavailable` fallback wording as a separate sentence —
   do not replace it with the light branch. Reviewer and `bouncer-debugger`
   stay named. During a `/bouncer-run` drive the loop keeps named dispatch for
   implement too even on `light`: the loop is an orchestrator that reads
   subagent reports, so it must not become the implementer. See
   `/bouncer-execute`.
5. **Quiz size** — `explain-diff` asks **one question** when `scale: light`
   (still within the usual 1–10 range rules otherwise). See
   `references/explain-diff/index.md`.

What stays the same:

- Task document set: `tasks/<NNN>/{tasks,verification,review}.md` and
  `explain.md` are still authored and gated.
- Gate judgments **G1–G8** and **G11–G17** are unchanged in the light path
  (G16 Distill / comprehension at finalize; G17 staged scope at commit).
  G15 is retired. Only **G18** (not applied) and the **G10** section list
  differ, and both differences follow from the document set above rather than
  from any agent judgment.
- Distill promotion at `/bouncer-finalize` is unchanged.

`scripts/` reads `scale` in four places: `scaffoldBlueprint` picks the document
set, `scaffoldTask` inherits the blueprint's declared scale for a later task,
the plan gate picks the G10 / G18 contract, and structural validation (S20)
checks the value against the enum. Every one of them reads the declared
`bouncer.scale` value and nothing else; none infers size.

Limit of implement inline: the writing session still authored the change a
named reviewer will score against **its own diff** (self-review pressure on
the writer, not a same-session review verdict). If that separation feels too
thin, set `scale` back to `full` and return to the named-agent path for
implement too. Returning to `full` on an already-scaffolded light blueprint
means authoring the missing sections and running
`bouncer scaffold context-review --blueprint <dir>` before the plan gate.
