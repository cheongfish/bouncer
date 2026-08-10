# Governance

## Blueprint sizing rule

Each **task bundle** (`tasks/<NNN>/{tasks,verification,review}.md`) is sized
for **one reviewable commit**. A blueprint may hold several task bundles and
remains the review / PR unit. Root `tasks.md` and `tasks-NNN.md` documents are
legacy migration targets. If a task feels too large for one commit, split it
into more task bundles (or more blueprints). Do **not** invent a further
subtask layer beneath a task bundle.

`/bouncer-commit` closes one task (scope check → comprehension entry →
`bouncer commit`). `/bouncer-execute` does not commit. `/bouncer-finalize`
closes the blueprint (Distill promotion, remainder commit, draft PR, worktree
cleanup) after every task is committed.

## Lightweight cycle

A **lightweight cycle** is in effect only when the user **declares** the
current session is a narrow-scope change. There is no automatic sizing from
diff size, path count, or file count — declaration only. Without a
declaration, the default path applies.

What shrinks (three things only):

1. **Epic allocation** — do not open a new epic. Stack the blueprint under the
   shared **maintenance epic**. If that epic is missing, create it once with
   normal numbering, then keep stacking blueprints under it.
2. **Agent round-trips** — run implementer and reviewer **inline** (same session)
   instead of named-agent dispatch. See `/bouncer-execute`.
3. **Quiz size** — `explain-diff` asks **one question** (still within the usual
   1–10 range rules). See `skills/explain-diff/SKILL.md`.

What stays the same:

- Full document set: `tasks/<NNN>/{tasks,verification,review}.md` and
  `explain.md` are still authored and gated.
- Gate judgments **G1–G16** are unchanged (including G16 Distill promotion).
- Distill promotion at `/bouncer-finalize` is unchanged.

Limit of inline review: the same session judges **its own diff** (self-review).
If that judgment is unclear, return to the named-agent path.
