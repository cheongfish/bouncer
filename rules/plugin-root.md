# Plugin root

Workflow skills run the `bouncer` CLI from the plugin directory. The variable
that carries that location differs per agent host, so skill shell blocks resolve
it in this order:

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

| Variable | Set by |
| --- | --- |
| `BOUNCER_HOME` | Manual escape hatch. Always wins when set. |
| `CLAUDE_PLUGIN_ROOT` | Claude Code (and the Codex compatibility alias). |
| `PLUGIN_ROOT` | Codex native. |

Cursor and Antigravity skill shells expose no plugin-root variable. There the
user must export `BOUNCER_HOME` to the install directory — the one containing
`scripts/bouncer`. If none of the three resolve, ask the user to set
`BOUNCER_HOME` rather than guessing a path.

`BOUNCER_ROOT` is the **plugin** install (skills, `scripts/bouncer`, master
rules). The **consuming project's** main worktree is separate: resolve it with
`bouncer project-root` into `PROJECT_ROOT`, and read/write Distill only at
`${PROJECT_ROOT}/.bouncer/Distill.md`. Do not treat plugin root or an execute
worktree cwd as the Distill base. When this repository dogfoods the plugin,
plugin root and project root may be the same path — that is a normal input, not
a special case.

Hooks resolve separately: `hooks/hooks.json` uses `${CLAUDE_PLUGIN_ROOT}`
verbatim (Claude and Codex substitute it), while Cursor hooks use relative
paths.

Human-facing setup steps are in [`../docs/install.md`](../docs/install.md).
