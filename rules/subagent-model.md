# Subagent model and host fallback

This is the shared contract for every named Bouncer-agent dispatch. It covers
only model selection and host fallback; each calling workflow keeps ownership
of the agent role, its inputs and outputs, read-only permissions, and retry
limits.

**Check first.** Before every dispatch, read `subagents.provider` and
`subagents.dispatch` from `.bouncer/config.json`. When they are `cursor` and
`print`, item 7 applies and the dispatch is never a Task subagent.

1. Resolve the named agent's model with `bouncer subagent-model --agent <name>`.
   It prints one slug line, or `inherit` when the slot is missing or configured
   as `inherit`. Pass only that printed line to the named dispatch; never treat
   the command as returning provider metadata. When the output is `inherit`,
   omit only the model argument so the named dispatch keeps parent-session model
   inheritance.
   `inherit`, `null`, and every non-string configured value have that inheritance
   meaning; they are not a request to select a replacement model.
   Every new dispatch starts without conversation history, whether the resolved
   model is a slug or `inherit`; this covers `bouncer-coordinator`,
   `bouncer-implementer`, `bouncer-reviewer`, `bouncer-debugger`,
   `bouncer-context-reviewer`, and plan evidence agents.
   Host methods: Codex sets `fork_turns: "none"`; Claude Code uses a named
   subagent call and never a fork; Cursor print runs a separate process per
   dispatch.
   The only exception is an implementer continuing its own session for the
   first in-scope verify fix defined in
   `${BOUNCER_ROOT}/references/coordinator-cards/verify.md`.
   On Codex, a dispatch that forks the full conversation does not accept a model
   override, so when a slug is passed, set `fork_turns: "none"` on that same
   call.
2. Attempt the named dispatch. Do not skip it because the host is Codex.
   Only the item 7 opt-in replaces it.
3. Only on a rejected model slug, retry that same named dispatch once with
   `inherit`, and tell the user that the slug was refused.
   A dispatch failure for another reason does not authorize this retry. The
   retry also starts without conversation history.
4. When named agents are unavailable, use the fallback explicitly selected by
   the calling workflow (inline skill/pass or a fresh generic subagent) with
   the same role brief. The same role brief is the entire body of the role
   document `${BOUNCER_ROOT}/agents/bouncer-<role>.md` — every section from Authority through
   Output contract, verbatim — plus the calling workflow's controller input
   for that call, including its actual cwd. A generic fallback carries both in
   its payload; an inline pass first reads that role document and follows
   every section before it judges or edits. A payload that carries only the
   role name, a summary, or a label such as "same brief" or "same prompt" is
   not a fallback payload. The fallback keeps the named role's boundary: a
   read-only role stays read-only, and no fallback gains write, status, scope,
   pointer, or commit authority the named role lacks. The full body is for the
   fallback only; a named dispatch already loads its role file and does not
   carry the body. This unsupported-host fallback follows the named dispatch
   attempt; it does not replace it merely because a host supports a different
   agent mechanism.
5. `/bouncer-run` resolves `bouncer-coordinator` through steps 1-4 like any
   other named agent, and its `subagents.<provider>` slot carries the same
   `inherit` meaning. The unsupported-host fallback for that dispatch is one
   generic subagent carrying the whole coordinator role — the entire body of
   `${BOUNCER_ROOT}/agents/bouncer-coordinator.md`, every section from Authority through Output
   contract, with its authority, hard guards, worker dispatch, and the
   worktree write boundary — plus the `/bouncer-run` dispatch payload exactly as
   `skills/bouncer-run/SKILL.md` step 4 defines it; this rule does not restate
   that list. It is never a shortened brief.
6. Every dispatch, named or fallback, runs in the foreground: the dispatcher
   blocks until the subagent returns its report. Never request a background,
   async, or detached run. When the host still returns a background handle
   instead of a report, keep waiting on that handle before any next step. A
   handle, a "started" or "running" status, or a task id is not a report, and
   the dispatcher must not end its turn while a dispatched subagent still runs.
   A `completed` or waiting notification that carries no result body is not an
   outcome either; keep waiting for the hand-back report (the subagent's final
   result body). Defer `metrics end` and the next step until that report
   arrives. The hand-back message carries no `subagent_tokens`; wait for the
   same agent's `<task-notification>`, read its `usage` (`subagent_tokens`,
   `duration_ms`), and only then call `metrics end` with those values, never an
   intermediate notification's. A session already closed is not corrected.
7. On Cursor, `subagents.dispatch: "print"` in `.bouncer/config.json` is an
   explicit opt-in. Only when `subagents.provider` is `cursor` and that value is
   exactly `print`, read `${BOUNCER_ROOT}/rules/cursor-print-dispatch.md` before the first
   dispatch and follow it in place of items 2-4 for every dispatch, including
   named ones. Otherwise ignore this item.
8. A deferred tool is not callable until its schema is loaded. Load the schema
   first with the host's tool-search mechanism (on Claude Code, `ToolSearch`
   with `select:<name>`), then call the tool.

No workflow may add another provider setting or a subagent helper while applying this
contract. Light and `/bouncer-run` exceptions remain with the run workflow
and `${BOUNCER_ROOT}/skills/bouncer-run/references/light-run.md`, not with this
shared model rule.
