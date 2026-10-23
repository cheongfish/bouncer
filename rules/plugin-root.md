# Plugin root

This is the single contract for plugin-root selection and rule loading.
Workflow skills run the `bouncer` CLI from the plugin directory. Install the
`bouncer-root` package bin on `PATH` (how: [`docs/install.md`](../docs/install.md)
plugin root); every independent shell block resolves:

```bash
BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
```

`--auto` searches only supported host installation candidates and selects the
highest strict-semver version (then absolute path). `bouncer-root --select`
prints numbered candidates and requires a TTY; `--host claude`, `--host codex`,
or `--host antigravity` limits the search. `BOUNCER_HOME=/absolute/plugin/root`
is a one-shot manual override and is validated before any candidate search.
Reading plugin assets resolves in this order: `BOUNCER_HOME`, then the running
runtime's own tree (when it passes validation), then host candidates. `bouncer-root --auto`
keeps its order above. A valid root must contain the required assets (`agents/`,
`skills/`, `rules/`, `references/`, `hooks/`, `${BOUNCER_ROOT}/AGENTS.md`). Pure commands
(`commit-guard`, `current`, `project-root`, `validate`, `verify`, `graph-sync`) do
not resolve a root, so they neither validate nor use `BOUNCER_HOME`.

The launcher never infers a host from `BOUNCER_HOME`, does not search the cwd,
and does not fall back to arbitrary home-directory scans. Provider selection is
separate: Cursor and Antigravity projects pin `subagents.provider` in config.

`BOUNCER_ROOT` is the **plugin** install (skills, `scripts/bouncer`, master
rules). The **consuming project's** main worktree is separate: resolve it with
`bouncer project-root` into `PROJECT_ROOT`. Canonical context reads and graph
freshness checks are rooted there; never substitute plugin root or an execute
worktree cwd. When this repository dogfoods the plugin, plugin root and project
root may be the same path — that is a normal input, not a special case.

Hooks resolve independently from workflow launcher shells. A hook passes its own
plugin root as `BOUNCER_HOME` to the child `bouncer` it spawns only; it does not
transmit plugin-root variables to workflow shells.

## Master and product rules

Before a workflow's numbered steps, read `${BOUNCER_ROOT}/AGENTS.md`.
`${BOUNCER_ROOT}/AGENTS.md` is the only default runtime contract. Product rules are conditional detail: the owning numbered
step opens the existing rule directly when its branch needs it; do not preload
`${BOUNCER_ROOT}/rules/document-schema.md` or another product rule for every
workflow. Each master or product rule a workflow opens loads once per session.
A new workflow session loads its needed rules before that rule's use; do not
re-read them when they are already loaded in the same session. The workflow
skill keeps its `Plugin root` and `Master rules` labels so this loading point is
visible; its `Plugin root` line carries only the `bouncer-root --auto` command
and does not restate the selection rules above. `bouncer init` does not install
these plugin-owned rules into the consuming project.
