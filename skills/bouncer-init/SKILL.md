---
name: bouncer-init
description: "Use only when the user explicitly asks /bouncer-init; it bootstraps the .bouncer/ governance directory for Bouncer (idempotent)."
---
# /bouncer-init

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.

Bootstrap this project for Bouncer.

1. Run `bouncer init` (idempotent for config; seeds missing project Distill;
   attempts graphify venv install by default):
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" init
   ```
2. Report the bootstrap and install result:
   - If bootstrap is already ready and `.bouncer/Distill.md` exists,
     report `already-initialized` and that no scaffold files were created.
   - If bootstrap is ready but Distill was missing, report that Distill was
     seeded (`project-distill-seeded`) and list `.bouncer/Distill.md`. If init
     migrated a legacy `.bouncer/context/Distill.md`, report the new path.
   - If bootstrap is ready but `.codex/agents/*.toml` were missing, report
     `codex-agents-seeded` and list those paths. Codex loads named agents
     from that directory, not from the plugin `agents/*.md`.
   - Otherwise, list the created files (`.bouncer/config.json`,
     `.bouncer/context/index.md`, `.bouncer/Distill.md`,
     `.codex/agents/*.toml`).
   - Root `context/` is legacy/non-canonical: do not read, migrate, or consume it.
   - **Graphify install fork** (from `graphifyInstall` when present):
     - Success / reuse (`status` `installed` or `reused`): report the outcome
       and the recorded `config.graphify.bin` (or the returned `bin`).
     - Failure: report the reason, note that `graphify.enabled` stayed / was
       set `false`, and point at a later return via
       `bouncer init --promote-graphify` after a manual install.
   - Do **not** edit `.bouncer/config.json` yourself — promotion is CLI-only.
3. Consent gates (ACQ). Never write config or `.gitignore` without agreement.
   - **Promotion ACQ** — when the result carries
     `graphifyPromotion: 'candidate'` (existing project with graphify not yet
     enabled), ask:
     - **A)** Enable and install (recommended)
     - **B)** Enable only (no install attempt)
     - **C)** Leave as-is
     On **A** or **B** only, run (A installs; B enables without install):
     ```bash
     BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
     # A) enable + install
     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify
     # B) enable only
     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify --no-graphify
     ```
     **C** writes nothing. In non-interactive environments, print the three
     options and stop — do not promote.
   - **Gitignore ACQ** — when `gitignoreSuggestions` is non-empty, list the
     entries and ask whether to write the `# bouncer` … `# /bouncer` marker
     block. On consent only:
     ```bash
     BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
     node "${BOUNCER_ROOT}/scripts/bouncer" init --write-gitignore
     ```
     On decline, report the suggested entries and leave `.gitignore`
     untouched. Bouncer writes `.gitignore` only after this consent, and only
     inside the marker block.
   - **Branch ACQ** — when the result carries `baseBranchUnresolved: true`,
     ask for the repository default branch. Do not offer `develop` or `main`
     as a guessed default. On an answer, write that same string to both
     `base_branch` and `pr.base` in `.bouncer/config.json`. On skip, leave
     the keys absent. This write is the exception to the promotion-only
     config rule above: graphify still goes through CLI; the branch keys
     have no CLI flag.
4. Tell the user to commit the bootstrap now, as its own commit, before `/bouncer-plan`:
   ```bash
   git add .bouncer .codex/agents && git commit -m "chore: bootstrap bouncer"
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

Do not author any epic or blueprint here — `/bouncer-init` only scaffolds
`.bouncer/` and Codex named-agent TOML under `.codex/agents/`.
Document skeletons, product rules, and master rules live in the plugin
(`scripts/lib/templates.js`, `rules/governance.md`, `rules/okf.md`,
`CLAUDE.md`); init does not install them into the project.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. The numbered
steps hold this workflow's timing and consequences.

**Gates in this skill:**
- Step 3 **Promotion ACQ** — when the init result carries
  `graphifyPromotion: 'candidate'`, ask enable+install / enable-only / leave
  as-is before any config write.
- Step 3 **Gitignore ACQ** — when `gitignoreSuggestions` is non-empty, ask
  whether to write the `# bouncer` … `# /bouncer` marker block before
  `--write-gitignore`.
- Step 3 **Branch ACQ** — when the init result carries
  `baseBranchUnresolved: true`, ask for the default branch and write
  `base_branch` and `pr.base` to that same value, or leave the keys absent.

Steps 1–2 and 4–5 do not ask; they report bootstrap outcome or point at
`/bouncer-plan`.
