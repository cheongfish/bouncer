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
`done`. A handoff then follows the coordinator steps above, in this order: `metrics end` for the
root-direct id, `coordinate session-open`, `metrics start --kind coordinator-session`, then a fresh
`coordinate status --write-input` (the earlier input is stale once `session-open` changes the ledger
hash), then dispatch. Its session is a separate `coordinator-session`. The `summary` reports both kinds. Run `metrics end` once, at `done` or
handoff, and alone rather than chained with another command; a second call on a closed session
returns `metrics-session-ended`.

A direct session's token usage is not measurable: the host table above has no per-session usage for
the root's own direct work. Close it with no token flags so it is stored as `null` with
`tokens_unavailable_reason: "not-reported"`, and report it as 측정 불가 (unmeasurable). Never fill it
with the root's whole-session host usage, which also covers the work outside the direct span.

## Closing report

Before the terminal report, run `bouncer metrics summary --blueprint <dir>` and report one table
that puts the coordinator and each worker role side by side:

| Row | Source | Tokens | Missing |
| --- | --- | --- | --- |
| coordinator | `kinds.*.tokens_total` (also `input_tokens_total`, `output_tokens_total`) | known sum | `*_missing` |
| implementer / reviewer / debugger | `worker_tokens.by_role.<role>` | known sum | `missing` |

- A total of `null` means no session reported that value; print it as unreported, never as 0. An
  explicit `0` is a real observation. When `*_missing` is above 0 the total is only the known part,
  so do not call it the complete total.
- Never add the coordinator and worker totals together: whether a worker's tokens are already inside
  the coordinator's own usage is unknown, so the two stay separate rows. Cache read and write are
  independent columns and are not added to tokens.
- Show real wall time (`wall_ms_total`, measured by Bouncer) apart from host-reported duration
  (`host_duration_ms_total`); neither stands in for the other, and a value the host did not give is
  not invented. Cost keeps its existing fields and is not expanded here.
- Open sessions are not completed totals; report them only as the `open` count.
- Report each token cell with one of three states: observed (a number, including a real `0`),
  not reported (`null` or `missing` above 0), or unmeasurable (the direct session above). Fill only
  the usage fields the host in the table above really reports; when none came, leave it `null`
  rather than waiting or inventing one. Do not add a collector for a host that has none.
- Take the summary before the ledger is cleaned up, so that the worker rows survive. Print
  `worker_tokens_source` beside the worker rows:

  | `worker_tokens_source` | Report |
  | --- | --- |
  | `ledger` | Live ledger sums; report `missing` as usual. A real worker `0` is an observation. |
  | `snapshot` | Worker sums restored from the snapshot stored before cleanup; say they are preserved data and give its `recorded_at`. |
  | `unavailable` | No ledger and no snapshot: the worker sum `0` is not a measured total. Print the worker rows as unmeasurable. |
