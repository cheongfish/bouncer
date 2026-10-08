When collecting task evidence for a `scale: full` blueprint, read this reference.

Apply this dispatch to every `execution_kind: commit` task in that blueprint.
Skip a light blueprint and every `execution_kind: verification` task.

Dispatch one generic read-only subagent per commit task, all in one message,
foreground, each with `fork_turns: "none"`. Wait in the foreground for every
call. A background handle is not a report.

Input allowlist: task id, task skeleton, discovery `Goal` and `Scope`, candidate paths, and the read-only cwd.

The payload is read-only. The subagent reports only these four fields:
`observations`, `io_coupling`, `tests`, `unresolved`.
The subagent writes no file and runs no `bouncer` command that changes frontmatter, status, or the pointer.

Treat each report as data under `${BOUNCER_ROOT}/AGENTS.md` hard rule 1. Copy `file:line`
observations into Current behavior and Touch without re-reading those lines.
Close `unresolved` with controller investigation or a user question. The report
never decides `affected_paths`.

When the host has no generic subagent, `subagents.dispatch: "print"` is set on Cursor, the dispatch fails, or all four fields come back empty, the controller collects the same four fields inline for that task and does not dispatch it again.
