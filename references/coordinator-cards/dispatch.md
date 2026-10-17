# dispatch

Contract card for the `coordinate next` action `dispatch`. Rules are copied
from the coordinator Task round and Worker dispatch.

- **Intent bundle (resolve once).** Before any role dispatch, pin the current
  task-brief bytes as `task_brief_hash` and resolve related functions into one
  shared intent bundle:
  ```bash
  bouncer intent bundle --task <path> --symbol <name>...
  ```
  Pass only source-file functions or methods picked from the Touch table as
  `--symbol`; never document headings, item numbers, or test names. With none,
  run `bouncer intent bundle --task <path> --no-symbols`.
  Capture `intent_bundle_id` and `intent_bundle_revision` from that single
  resolve. For every later named or fallback payload, put the stdout of
  `bouncer intent sections --task <path> --role <role>` as that role's
  `intent_sections` projection. Every later payload must carry the same
  `task_brief_hash`, `intent_bundle_id`, and `intent_bundle_revision`. The
  bundle is advisory only. Handle its result as follows:

  | Result | Dispatch action |
  | --- | --- |
  | `created` or `reused` (exit 0) | Continue with the pinned bundle. |
  | `ambiguous` (exit 0, no `bundle_id`) | Reselect once from evidence; if still ambiguous, rerun with `--no-symbols` and continue. |
  | exit 1 or exit 2 | Stop role dispatch and report the failure. |
- The `intent-symbols` judge is filled by naming the related functions as
  `--symbol <name>...` on that single `bouncer intent bundle` resolve, or by
  `--no-symbols` when there are none.
- **Scope revision revalidation.** After `coordinate revise`, open a new
  `coordinate dispatch` and re-call `bouncer intent bundle` against the
  revised brief hash and the function set re-picked from the revised brief
  (`--no-symbols` when it is empty). When function blob and section
  hashes match, keep the existing `intent_bundle_revision`; when either
  differs, pin the new revision for every later role. If revalidation exits 1
  or 2, stop role dispatch and report the failure. An `ambiguous` result
  follows the one-time evidence reselection rule above.
- Immediately before every `bouncer-implementer` call, run `bouncer coordinate
  dispatch` from that task's worktree. Immediately before
  `bouncer-implementer`, `coordinate dispatch` `argv` already includes
  `--lease-id` / `--generation` plus the held `--ledger-path
  <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>`.
- Before that call, run `bouncer subagent-model --agent bouncer-implementer`
  and append its one-line output to the `coordinate dispatch` argv as `--model
  <value>` (`next` does not put it in `argv`). The ledger then records the model
  argument you pass, so it can be compared with `config.json` later; it is not
  proof of the model the host ran. If a slug rejection forces the `inherit`
  retry from `${BOUNCER_ROOT}/rules/subagent-model.md` item 3, retry only the
  host dispatch. Do not run `coordinate dispatch` again: the attempt is still
  active (`dispatch-already-active`) and a second call would not be a retry. The
  ledger keeps the slug first passed; state the `inherit` retry in your own
  report to the user instead.
- When the implementer's completion notice reports `subagent_tokens`, record it
  from the integration cwd with `bouncer coordinate worker-model --blueprint
  <dir> --role implementer --model <value> --task <NNN> --tokens <n>
  --ledger-path <p> --ledger-hash <h>`. If the notice is not here yet, record
  without `--tokens`; once it arrives, append it with `bouncer coordinate
  worker-tokens --blueprint <dir> --role implementer --task <NNN> --tokens <n>
  --ledger-path <p> --ledger-hash <h>`. If the host gives no value, leave it
  out: it is counted as missing, never estimated.
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `previous_outcome`. After `ok: false` or a fence refusal,
  call `next` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
- `coordinate dispatch` also returns a top-level `report_path` (the implementer's
  per-attempt report file). Keep it and pass it to the `implement` step next to
  the metadata; it is not one of the `metadata` keys.
