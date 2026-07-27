---
description: Bootstrap the .bouncer/ governance directory for Bouncer (idempotent).
---

# /bouncer-init

**Plugin root.** Every shell block below opens with

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-}}"
```

because each block runs in a fresh shell — the assignment does not carry over,
so it is repeated rather than exported once. `CLAUDE_PLUGIN_ROOT` is what Claude
Code provides; on an agent that exports no plugin-root variable the value comes
back empty and `node` fails on a path starting with `/scripts`. Set
`BOUNCER_HOME` to the installed plugin directory (the one containing
`scripts/bouncer`) and it takes precedence everywhere.

Bootstrap this project for Bouncer.

1. Run `bouncer init` (writes nothing if `.bouncer/` already exists):
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" init
   ```
2. Report the result:
   - If no files were created, report the detected bootstrap state and that no
     changes were made.
   - Otherwise, list the created files (`.bouncer/config.json`,
     `.bouncer/governance.md`, `.bouncer/workflow.md`, `.bouncer/okf.md`,
     `.bouncer/templates/*`, `.bouncer/context/index.md`).
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
   - `.bouncer/config.json`, the governance documents, and `.bouncer/templates/`
     are not in the scope a blueprint may commit, so leaving them uncommitted
     makes the first `/bouncer-finalize` abort as out-of-scope. Scaffold reads
     `.bouncer/templates/` at runtime, so an uncommitted template also means
     teammates generate different documents.
   - The window closes after `/bouncer-plan`: once `.bouncer/current` points at a
     blueprint, the commit guard blocks files outside `affected_paths`.

   Do not run the commit yourself unless the user asks — bootstrapping is their
   decision to record.
5. Point the user at `/bouncer-plan` as the next step, and mention they can edit
   `.bouncer/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds `.bouncer/`.
