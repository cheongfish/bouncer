# Bouncer

Plugin-owned master rules for Bouncer sessions. This file lives in the **plugin**,
not in the consuming repository — `bouncer init` does not install it.
Project `CLAUDE.md` / `AGENTS.md` / direct user instructions take precedence when
they conflict.

`AGENTS.md` imports `@CLAUDE.md` (Codex / Cursor naming adapter).

## Hard rules

1. **Documents** — Canonical Bouncer docs live only under `.bouncer/context/`.
   Never author or migrate a root `context/` tree. Scaffold owns OKF frontmatter
   (`type`, `title`, `description`, `resource`, `tags`, `timestamp`) and harness
   ids under `bouncer:`; skills write body prose (and only the frontmatter fields
   a workflow explicitly allows). A blueprint may hold multiple task bundles:
   `tasks/<NNN>/{tasks,verification,review}.md` (with ids `TASKS-<NNN>`,
   `VERIFY-<NNN>`, `REVIEW-<NNN>`). Legacy root `tasks.md` and
   `tasks-<NNN>.md` layouts remain migration targets until the layout cutover.
   Project Distill is **not** under `context/` — it is agent runtime at
   `.bouncer/Distill.md` (see rule 7).
2. **One commit per task** — Split work so each task document is one reviewable
   commit. The blueprint remains the review / PR unit. Do not invent a further
   subtask layer beneath a task document.
   Detail: [`docs/governance.md`](docs/governance.md).
3. **Evidence, not claims** — Verification success evidence is written by the
   execute gate running `config.verify`, not by an agent. Do not hand-author a
   passing `verification.md` to skip the harness.
4. **Gates decide done** — `bouncer validate --gate plan|execute|commit|finalize`
   is authoritative. Fix reported G/S codes; do not argue past a failing gate.
5. **Workflow order** — `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` →
   `/bouncer-commit` → `/bouncer-finalize`. Detail:
   [`docs/workflow.md`](docs/workflow.md).
6. **OKF shape** — Context documents carry OKF frontmatter; Bouncer fields live
   under `bouncer:`. Bundle-root `okf_version` is only on
   `.bouncer/context/index.md`. Detail: [`docs/okf.md`](docs/okf.md).
7. **Project Distill** — Before `/bouncer-plan` and `/bouncer-execute` work,
   Read `.bouncer/Distill.md` (create via `bouncer init` if missing). Apply
   matching Invariants / Gotchas / Decisions to the brief. Do **not** put Distill
   body content into these master rules — path and read obligation only.
   `/bouncer-finalize` promotes durable BP `explain.md` notes into that file.
   Distill is English agent runtime; not a human-facing OKF plan doc.
8. **Context language** — Human-facing bodies under `.bouncer/context/epics/**`
   and BP `explain.md` are Korean (identifiers, paths, and fenced code excepted).
   Apply `stop-slop` when drafting or revising that prose; it is advisory, not a
   gate. Distill stays English.
9. **Code comments** — Leave non-obvious intent in implementation code as
   Korean comments. Detail and examples:
   [`skills/implementation/SKILL.md`](skills/implementation/SKILL.md). Do
   **not** put comment examples into these master rules.

## Session conduct

Applies to every Bouncer skill, workflow, and dispatched subagent unless a
numbered step says otherwise.

1. **Scope** — Deliver what the brief asks, at the scope intended. Make routine
   judgment calls yourself; check in only when different readings would lead to
   materially different work. If the brief looks mistaken, say so in a sentence
   and escalate to `/bouncer-plan` — do not quietly narrow, widen, or transform
   it. Finish the whole task: no stubs, TODOs, or placeholder implementations.
2. **Progress updates** — Before the first tool call of a step, say in one
   sentence what you are about to do. While working, speak up only when you find
   something important or change direction. When a step ends, lead with the
   outcome (gate pass/fail, findings count, what was committed), then the
   supporting detail.
3. **Length** — Keep conversational output brief and spend it on the answer, not
   on caveats. Match authored documents (epic, blueprint, tasks, explain,
   PR body) to what the work needs: cover the substance, do not pad with filler
   sections, redundant summaries, or boilerplate.
4. **No self-double-checking** — `bouncer validate` and `config.verify` are the
   verification authority (hard rule 3). Do not add re-check passes,
   "verify my own work" steps, or verification subagents on top of them.
5. **Delegation** — Dispatch only the subagents a workflow step names
   (`bouncer-implementer`, `bouncer-reviewer`). Beyond those, delegate only for
   large, genuinely independent investigation — one agent rather than several,
   never to double-check your own output.
6. **Corrections** — Correct an earlier statement only when the error would
   change the user's code, decisions, or a gate outcome. State it plainly and
   continue; for slips that change nothing, make the fix and move on.

## When to invoke

| Intent | Command / skill |
| --- | --- |
| Bootstrap `.bouncer/` once | `/bouncer-init` |
| Clarify goal / scope / success criteria | `discovery` (inside `/bouncer-plan`) |
| Author epic / blueprint / tasks bodies | `spec-authoring` |
| Strip AI tells from context prose | `stop-slop` (inside plan / explain / Distill) |
| Implement from `tasks/<NNN>/tasks.md` | `implementation` (inside `/bouncer-execute`) |
| Investigate a failed verify | `debugging` + `verification` |
| Review the diff against the brief | `review` |
| Close one task (commit) | `/bouncer-commit` |
| Promote Distill, explain + quiz, draft PR, cleanup | `/bouncer-finalize` |

## Plugin root

Shell blocks in workflow skills resolve the plugin with:

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

Read this file (and the linked docs) from that root. If none of those variables
are set, ask the user to set `BOUNCER_HOME` to the directory that contains
`scripts/bouncer`.
