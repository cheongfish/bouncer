---
description: Bootstrap the .bouncer/ governance directory for Bouncer (idempotent).
---

# /bouncer-init

Bootstrap this project for Bouncer.

1. Run `bouncer init` (writes nothing if `.bouncer/` already exists):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" init
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
4. Point the user at `/bouncer-plan` as the next step, and mention they can edit
   `.bouncer/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds `.bouncer/`.
