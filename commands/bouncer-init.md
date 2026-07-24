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
   - If `skipped: true`, tell the user `.bouncer/` already exists and **no changes**
     were made (idempotent).
   - Otherwise, list the created files (`.bouncer/config.json`, `.bouncer/current`,
     `.bouncer/governance.md`, `.bouncer/workflow.md`, `.bouncer/okf.md`,
     `.bouncer/templates/*`, `context/index.md`) and note that `.gitignore` gained
     `.bouncer/worktrees/`, `graphify-out/`, and `.bouncer/current`.
3. Point the user at `/bouncer-plan` as the next step, and mention they can edit
   `.bouncer/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds `.bouncer/`.
