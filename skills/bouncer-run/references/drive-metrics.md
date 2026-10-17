# Drive metrics

Root procedure for recording coordinator sessions with `bouncer metrics`. Records go to
`.bouncer/runtime/drive-metrics.json` in the main worktree (gitignored). Record only values the
host reported; never estimate tokens, time, or cost. A missing value is stored as `null` with a
reason, and totals never count it as 0.

## Per coordinator session

1. Before each coordinator dispatch, the root runs this in the integration cwd, then rewrites
   `coordinate status --write-input` from the checkpoint it returns. On `ok: false`, do not dispatch;
   report the reason.

   ```bash
   bouncer coordinate session-open --blueprint <dir> --ledger-path <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>
   ```

2. Immediately before each coordinator dispatch (the first one and every `continue` re-dispatch):

   ```bash
   bouncer metrics start --kind coordinator-session --blueprint <dir> --label <short-label>
   ```

   Keep the `id` from the JSON result. `ok: false` is reported but never blocks the drive.

3. First receive the coordinator's hand-back report (item 6 of
   `${BOUNCER_ROOT}/rules/subagent-model.md`; a `completed` notification without a result body
   does not count, so keep waiting). Only then read the final usage the host provides, from the
   host usage table below, and close the session once. Missing usage is not an unfinished
   report: it never extends the wait for the report, and the report never waits on usage that
   the host does not emit.

   | Host | Final usage source | When to call `metrics end` |
   | --- | --- | --- |
   | Claude Code | `usage` of the same agent's `<task-notification>` (`subagent_tokens`, `duration_ms`). The hand-back message and intermediate notifications carry none. | When that notification arrives; pass `--tokens <subagent_tokens> --host-duration-ms <duration_ms>`. |
   | Codex | `usage` object of the agent's final result JSON. | Right after the hand-back; pass only token values that object actually carries, each to the flag of the same meaning, and never guess a key. A result JSON with no `usage` closes with no token flags (missing). |
   | Cursor print | `usage` of the last `type: "result"` event in the raw stream-json stdout artifact (the `stdout` path that `bouncer dispatch print` returns). The wrapper JSON itself (`report`, `stdout`, ...) carries no usage. | Right after `dispatch print` returns; a result event with no `usage` closes with no token flags (missing). |
   | Host with no usage event (for example a Cursor Task subagent or an inline pass) | none | Immediately after the hand-back, `metrics end --id <id>` with no token flags; the session is recorded as missing. |

   ```bash
   bouncer metrics end --id <id> --tokens <subagent_tokens> --host-duration-ms <duration_ms>
   ```

   Add `--input-tokens`, `--output-tokens`, and `--model <slug>` only when the host reports them
   separately; they let the CLI compute cost from `metrics.pricing` in `.bouncer/config.json`.
   Add `--cache-read-tokens` and `--cache-write-tokens` only when the host reports them; they are
   stored apart from the totals, and `metrics summary` sums them under `cache`.
   Omit any flag the host did not give, and never estimate one. A session already closed stays
   closed: a later event never closes or corrects it again. The same table tells a controller
   which value to pass as `--tokens` for a worker record
   ([agent-dispatch](./agent-dispatch.md)).

4. The `status` checkpoint exposes the same blueprint's sessions as `sessions[]`. It is an
   observation only: it is not evidence of worker liveness or progress.

## Per root-direct session

A `direct-run.md` drive (start ACQ option D) has no coordinator dispatch. Open one session with
`bouncer metrics start --kind root-direct-session --blueprint <dir> --label direct` after
bootstrap and close it with `metrics end` when the drive hands off to the coordinator or reaches
`done`. A handoff then follows the coordinator steps above, so its session is a separate
`coordinator-session`. The `summary` reports both kinds.

## Closing report

Before the terminal report, run `bouncer metrics summary --blueprint <dir>` and include its
per-kind totals (sessions, tokens and missing count, wall time, cost and missing count, tasks
completed). Report missing counts as missing, not as zero.
