---
name: migrate-ids
description: "Use when migrating legacy EPIC-/BP- ids or when SessionStart warns, or when named; confirm with the user, then apply."
---

# Migrate Ids

**Plugin-root shell contract.** See `rules/plugin-root.md`; each migration shell resolves independently.

Move legacy `EPIC-\d{3}-*` / `BP-\d{3}-*` context directories (and matching
frontmatter, `resource`, body tokens, bundle index, and the active pointer) to
canonical numeric names (`014-slug`, `001-slug`, `TASKS-001`).

This skill does **not** invent a second procedure — it drives
`bouncer migrate ids`.

## When this applies

When migrating legacy `EPIC-` / `BP-` context directories to numeric ids, or when
SessionStart warns about legacy naming. Runs dry-run, confirms with the user,
then applies. Used when the user asks for this skill by name.

## Steps

1. **Dry-run (required).**
   ```bash
   bouncer migrate ids --dry-run
   ```
   Show the JSON `renames` list to the user. If `hasLegacy` is false / renames
   empty, stop — nothing to migrate.

2. **Confirm.** Ask the user to approve the plan. If they decline, stop. Do
   **not** apply on a silent assumption.

3. **Apply (only after confirmation).**
   ```bash
   bouncer migrate ids
   ```
   On `ok: false`, report `reasons` (mixed / collision / dirty) and do not
   retry with partial manual renames.

4. **Spot-check.** Open one migrated blueprint and confirm body tokens no
   longer say `EPIC-` / `BP-` / `TASKS-BP-`, and that `bouncer validate
   --blueprint <new-dir>` is clean of S5 path/id mismatches.

## Guardrails

- **Never apply without a dry-run and explicit user confirmation.** Show the
  dry-run plan first; only then run apply.
- Do not hand-rename under `.bouncer/context/epics/` — the CLI owns the
  atomic plan (validate → rename bp dirs → rename epic dirs → rewrite).
- Do not run apply on a mixed new+legacy tree, a destination collision, or a
  dirty worktree; fix those first.
- Cursor has no SessionStart equivalent — rely on this skill / the CLI there.
- Do not create skill files at runtime; this skill is already shipped.

## Return

Report the dry-run plan (or that nothing to migrate), whether apply ran after
confirmation, and any `ok: false` reasons. Do not invent a successful migration
without the CLI result.
