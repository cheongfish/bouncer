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

3. Immediately after the coordinator returns, pass what the host's task notification gave you:

   ```bash
   bouncer metrics end --id <id> --tokens <subagent_tokens> --host-duration-ms <duration_ms>
   ```

   Add `--input-tokens`, `--output-tokens`, and `--model <slug>` only when the host reports them
   separately; they let the CLI compute cost from `metrics.pricing` in `.bouncer/config.json`.
   Omit any flag the host did not give. If the coordinator ended without a notification, still
   call `metrics end` with no token flags so the session closes.

4. The `status` checkpoint exposes the same blueprint's sessions as `sessions[]`. It is an
   observation only: it is not evidence of worker liveness or progress.

## Closing report

Before the terminal report, run `bouncer metrics summary --blueprint <dir>` and include its
per-kind totals (sessions, tokens and missing count, wall time, cost and missing count, tasks
completed). Report missing counts as missing, not as zero.
