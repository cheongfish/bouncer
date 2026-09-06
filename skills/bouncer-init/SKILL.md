---
name: bouncer-init
description: "Use only when the user explicitly asks /bouncer-init; it bootstraps the .bouncer/ governance directory for Bouncer (idempotent)."
---
# /bouncer-init

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Output contract: `rules/output.md`. Preserve the step 3 ACQ display; report the
bootstrap outcome, created or migrated targets, Graphify result/recovery, and
the next `/bouncer-plan` action through that shared contract.

Bootstrap this project for Bouncer.

1. Run `bouncer init` (idempotent for config; seeds missing project Distill;
   attempts graphify venv install by default). Codex named-agent TOML is
   written only when `.codex/` already exists or the user passed
   `--seed-codex-agents`:
   ```bash
   bouncer init
   # Codex users without an existing .codex/ directory:
   # bouncer init --seed-codex-agents
   ```
2. After bootstrap completes, read [init-result.md](./references/init-result.md)
   when rendering a result or handling its Promotion, Gitignore, or Branch
   consent branch. That reference owns the result fields and branch effects;
   it never precedes bootstrap and config promotion remains CLI-only.
   Root `context/` is legacy/non-canonical and is never input.
3. Consent gates (ACQ). Apply the conditional choices in `init-result.md`;
   never write config or `.gitignore` without agreement.
4. Tell the user to commit the bootstrap now, as its own commit, before `/bouncer-plan`:
   ```bash
   git add .bouncer/config.json .bouncer/context .bouncer/Distill.md && git commit -m "chore: bootstrap bouncer"
   ```
   If init actually created `.codex/agents`, include that directory in the same
   commit (`git add .codex/agents` in addition to the paths above). Omit it
   when the directory does not exist.
   Two reasons, both worth stating:
   - `.bouncer/config.json` is not in the scope a blueprint may commit, so leaving
     it uncommitted makes the first `/bouncer-finalize` abort as out-of-scope.
   - The window closes after `/bouncer-plan`: once the active pointer points at a
     blueprint, the commit guard blocks files outside `affected_paths`.

   Do not run the commit yourself unless the user asks — bootstrapping is their
   decision to record.
5. Point the user at `/bouncer-plan` as the next step, and mention they can edit
   `.bouncer/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds
`.bouncer/` and, when a Codex signal or `--seed-codex-agents` is present,
named-agent TOML under `.codex/agents/`.
Document skeletons, product rules, and master rules live in the plugin
(`scripts/lib/templates.js`, `rules/governance.md`, `rules/okf.md`,
`CLAUDE.md`); init does not install them into the project.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback.

**Index:**
- Step 3 — Promotion ACQ · Gitignore ACQ · Branch ACQ
