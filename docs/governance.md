# Governance

## Blueprint sizing rule

Each **task bundle** (`tasks/<NNN>/{tasks,verification,review}.md`) is sized
for **one reviewable commit**. A blueprint may hold several task bundles and
remains the review / PR unit. Root `tasks.md` and `tasks-NNN.md` documents are
input only to `bouncer migrate task-layout`. If a task feels too large for one commit, split it
into more task bundles (or more blueprints). Do **not** invent a further
subtask layer beneath a task bundle.

`/bouncer-commit` closes one task (scope check → `bouncer commit`).
`/bouncer-execute` does not commit. `/bouncer-finalize` closes the blueprint
(Distill promotion, explain + quiz, remainder commit, draft PR, worktree
cleanup) after every task is committed.

## Lightweight cycle

A **lightweight cycle** (ops Korean: `docs/workflow.md` `## 경량 경로`) is in
effect only when the user **declares** a narrow-scope change at `/bouncer-plan`
and the plan changes blueprint `index.md` `bouncer.scale` from the scaffold
default `full` to `light`. There is no automatic sizing from diff size, path
count, or file count. Without that declaration (`scale` absent or not
`light`), the default path applies. `scripts/` does not read `scale`.

What shrinks (three things only):

1. **Epic allocation** — do not open a new epic. Stack the blueprint under the
   shared **maintenance epic** (slug `maintenance`). If that epic is missing,
   create it once with normal numbering, then keep stacking blueprints under it.
   Never close that epic.
2. **Agent round-trips** — when `bouncer.scale` is `light`, run implementer and
   reviewer **inline** (same session) instead of named-agent dispatch. Keep the
   host `named agents are unavailable` fallback wording as a separate sentence
   — do not replace it with the light branch. `bouncer-debugger` stays named.
   See `/bouncer-execute`.
3. **Quiz size** — `explain-diff` asks **one question** when `scale: light`
   (still within the usual 1–10 range rules otherwise). See
   `skills/explain-diff/SKILL.md`.

What stays the same:

- Full document set: `tasks/<NNN>/{tasks,verification,review}.md` and
  `explain.md` are still authored and gated.
- Gate judgments **G1–G17** are unchanged in the light path (G16 Distill /
  comprehension at finalize; G17 staged scope at commit). G15 is retired.
- Distill promotion at `/bouncer-finalize` is unchanged.

Limit of inline review: the same session judges **its own diff** (self-review).
If that judgment is unclear, set `scale` back to `full` and return to the
named-agent path.
