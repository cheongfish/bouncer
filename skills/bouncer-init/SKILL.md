---
name: bouncer-init
description: "Use only when the user explicitly asks to bootstrap Bouncer (for example /bouncer-init). Bootstrap the .bouncer/ governance directory for Bouncer (idempotent)."
---
# /bouncer-init

**Plugin root.** Every shell block below opens with

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

because each block runs in a fresh shell — the assignment does not carry over,
so it is repeated rather than exported once. Resolution order:
`BOUNCER_HOME` (manual override) → `CLAUDE_PLUGIN_ROOT` (Claude Code, and Codex
compatibility) → `PLUGIN_ROOT` (Codex native). If none are set, `node` fails on
a path starting with `/scripts` — set `BOUNCER_HOME` to the directory that
contains `scripts/bouncer`.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Bootstrap this project for Bouncer.

1. Run `bouncer init` (idempotent for config; seeds missing project Distill):
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" init
   ```
2. Report the result:
   - If bootstrap is already ready and `.bouncer/Distill.md` exists,
     report `already-initialized` and that no changes were made.
   - If bootstrap is ready but Distill was missing, report that Distill was
     seeded (`project-distill-seeded`) and list `.bouncer/Distill.md`. If init
     migrated a legacy `.bouncer/context/Distill.md`, report the new path.
   - Otherwise, list the created files (`.bouncer/config.json`,
     `.bouncer/context/index.md`, `.bouncer/Distill.md`).
   - Root `context/` is legacy/non-canonical: do not read, migrate, or consume it.
3. If the result carries a non-empty `gitignoreSuggestions`, list those entries and
   tell the user to add them to `.gitignore` themselves. Bouncer never edits
   `.gitignore` — it only reports. Finalize ignores these paths either way, so this
   is housekeeping, not a blocker.
4. Tell the user to commit the bootstrap now, as its own commit, before `/bouncer-plan`:
   ```bash
   git add .bouncer && git commit -m "chore: bootstrap bouncer"
   ```
   Two reasons, both worth stating:
   - `.bouncer/config.json` is not in the scope a blueprint may commit, so leaving
     it uncommitted makes the first `/bouncer-finalize` abort as out-of-scope.
   - The window closes after `/bouncer-plan`: once the active pointer points at a
     blueprint, the commit guard blocks files outside `affected_paths`.

   Do not run the commit yourself unless the user asks — bootstrapping is their
   decision to record.
5. Point the user at `/bouncer-plan` as the next step, and mention they can edit
   `.bouncer/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds `.bouncer/`.
Document skeletons, product rules, and master rules live in the plugin
(`scripts/lib/templates.js`, `docs/governance.md`, `docs/workflow.md`,
`docs/okf.md`, `CLAUDE.md`); init does not install them into the project.
