# dispatch

Contract card for the `coordinate next` action `dispatch`. Before you run its
`argv`, read [agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md)
when this dispatch needs the intent bundle resolve, the implementer model
record, or the metadata and `report_path` it returns; that reference owns those
rules and this card does not restate them.

- **Intent bundle (resolve once).** Before the first role dispatch of a task,
  and again after every `coordinate revise`, resolve the shared intent bundle
  per the agent-dispatch `## Intent bundle` section. Exit 1 or 2 stops role
  dispatch.
- The `intent-symbols` judge is filled by naming the related functions as
  `--symbol <name>...` on that single `bouncer intent bundle` resolve, or by
  `--no-symbols` when there are none.
- Immediately before every `bouncer-implementer` call, run this `argv` from
  that task's worktree with `--model <value>` appended per the agent-dispatch
  `## Worker model and token records` section.
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `previous_outcome`. After `ok: false` or a fence refusal,
  call `next` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
- Keep the returned `metadata` and the top-level `report_path` for the
  `implement` step.
