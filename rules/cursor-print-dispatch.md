# Cursor print dispatch

This rule applies only when `.bouncer/config.json` sets both
`subagents.provider` to `"cursor"` and `subagents.dispatch` to `"print"`
(`rules/subagent-model.md` item 7). Any other value or provider leaves that
rule's items 2-4 unchanged, and this document does not apply.

1. **Every dispatch is a print process.** Every Bouncer-agent dispatch — the
   named dispatch and the fallback of `rules/subagent-model.md` items 2 and 4,
   including the `/bouncer-run` coordinator of item 5 and every worker a
   coordinator dispatches — is a fresh `agent --print` process, never a Task
   subagent. Cursor records no token usage for Task subagents; each print
   process is its own logged session.
2. **Prerequisite.** The `agent` CLI is on PATH and `agent status` reports a
   login. Otherwise report that and stop the dispatch; never fall back to a
   Task subagent silently.
3. **Payload.** A print process loads no named agent, so it always carries the
   item 4 fallback payload. Write only the controller input file. Then run
   `bouncer dispatch print`, which writes the prompt file whose first line is
   the identity line below, then the plugin-root line, then the role body:
   - worker, reviewer, or context-reviewer: `You are the dispatched bouncer-<role> itself. Do
     this role's work directly and never dispatch any Bouncer agent.`
   - coordinator: `You are the dispatched bouncer-coordinator itself. Dispatch
     only your workers, each under rules/cursor-print-dispatch.md.`
   - plugin root (one unwrapped line after the identity line): `Plugin root: <absolute path>. Resolve plugin-relative paths (rules/..., references/..., agents/...) against it.`
   The command then appends the role body and the controller input. Do not
   assemble those pieces in the session. Resolve `rules/…`, `references/…`, and
   `agents/…` against that plugin root — do not search the workspace for them.
   `--input` is free UTF-8 text, not JSON, and is appended as-is. The
   coordinator input file is written by `bouncer coordinate status --blueprint
   <dir> --write-input <file>` from the integration worktree; do not hand-write
   its format.
4. **Command.** From the actual cwd, run
   `bouncer dispatch print --role <role> --cwd <actual cwd> --input <file>
   --out <dir>` in the foreground. The command guarantees argv
   `agent --print --force --trust --output-format stream-json --workspace
   <actual cwd> [--model <slug>] -- <prompt>` with empty stdin and
   stdout/stderr on file descriptors — never `$(cat …)`, a shell string, or
   `tee`. Pass `--model` only when `result.model` is not `null`. The `--`
   keeps a payload that starts with `-` from being read as an option. Never
   pipe the process through `tee` or any other reader: a helper it leaves
   behind holds the pipe open after it exits.
5. **Wait.** Run it in the foreground with a wait budget covering the whole
   run, per item 6. The command itself does not time out. A ready wave may
   start its runners from one command that backgrounds each process and then
   `wait`s for all of them; that command returns only after every process
   exits.
6. **Report.** The report is the JSON `report` field from `dispatch print`.
   On `{ ok: false }`, follow `next`. A non-zero exit or a missing `result` event is a dispatch failure, not a report. Never fall back to a Task
   subagent.
