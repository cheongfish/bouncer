---
description: Bootstrap the .sdd/ governance directory for Spec-Driven Development (idempotent).
---

# /sdd-init

Bootstrap this project for SDD.

1. Run `sdd-harness init` (writes nothing if `.sdd/` already exists):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" init
   ```
2. Report the result:
   - If `skipped: true`, tell the user `.sdd/` already exists and **no changes**
     were made (idempotent).
   - Otherwise, list the created files (`.sdd/config.json`, `.sdd/current`,
     `.sdd/governance.md`, `.sdd/workflow.md`, `.sdd/okf.md`,
     `.sdd/templates/*`, `.sdd/superpowers.md`, `context/index.md`) and note that `.gitignore` gained
     `.sdd/worktrees/`, `graphify-out/`, and `.sdd/current`.
3. Point the user at `/sdd-plan` as the next step, and mention they can edit
   `.sdd/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/sdd-init` only scaffolds `.sdd/`.
