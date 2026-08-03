# Bouncer

Plugin-owned master rules for Bouncer sessions. This file lives in the **plugin**,
not in the consuming repository — `bouncer init` does not install it.
Project `CLAUDE.md` / `AGENTS.md` / direct user instructions take precedence when
they conflict.

`AGENTS.md` in this plugin is byte-identical to this file (Codex / Cursor naming).

## Hard rules

1. **Documents** — Canonical Bouncer docs live only under `.bouncer/context/`.
   Never author or migrate a root `context/` tree. Scaffold owns OKF frontmatter
   (`type`, `title`, `description`, `resource`, `tags`, `timestamp`) and harness
   ids under `bouncer:`; skills write body prose (and only the frontmatter fields
   a workflow explicitly allows).
2. **One commit per blueprint** — Split work so each blueprint is one reviewable
   commit. Do not add a subtask layer or per-task `affected_paths`.
   Detail: [`docs/governance.md`](docs/governance.md).
3. **Evidence, not claims** — Verification success evidence is written by the
   execute gate running `config.verify`, not by an agent. Do not hand-author a
   passing `verification.md` to skip the harness.
4. **Gates decide done** — `bouncer validate --gate plan|execute|finalize` is
   authoritative. Fix reported G/S codes; do not argue past a failing gate.
5. **Workflow order** — `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` →
   `/bouncer-finalize`. Detail: [`docs/workflow.md`](docs/workflow.md).
6. **OKF shape** — Context documents carry OKF frontmatter; Bouncer fields live
   under `bouncer:`. Bundle-root `okf_version` is only on
   `.bouncer/context/index.md`. Detail: [`docs/okf.md`](docs/okf.md).

## When to invoke

| Intent | Command / skill |
| --- | --- |
| Bootstrap `.bouncer/` once | `/bouncer-init` |
| Clarify goal / scope / success criteria | `discovery` (inside `/bouncer-plan`) |
| Author epic / blueprint / tasks / distill bodies | `spec-authoring` |
| Implement from `tasks.md` | `implementation` (inside `/bouncer-execute`) |
| Investigate a failed verify | `debugging` + `verification` |
| Review the diff against the brief | `review` |
| Close out, commit, draft PR | `/bouncer-finalize` |

## Plugin root

Shell blocks in workflow skills resolve the plugin with:

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

Read this file (and the linked docs) from that root. If none of those variables
are set, ask the user to set `BOUNCER_HOME` to the directory that contains
`scripts/bouncer`.
