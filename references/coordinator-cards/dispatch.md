# dispatch

Contract card for the `coordinate next` action `dispatch`. Rules are copied
from the coordinator Task round and Worker dispatch.

- **Intent bundle (resolve once).** Before any role dispatch, pin the current
  task-brief bytes as `task_brief_hash` and resolve related functions into one
  shared intent bundle:
  ```bash
  bouncer intent bundle --task <path> --symbol <name>...
  ```
  Capture `intent_bundle_id` and `intent_bundle_revision` from that single
  resolve. For every later named or fallback payload, put the stdout of
  `bouncer intent sections --task <path> --role <role>` as that role's
  `intent_sections` projection. Every later payload must carry the same
  `task_brief_hash`, `intent_bundle_id`, and `intent_bundle_revision`. The
  bundle is advisory only. If bundle creation fails, do not start role
  dispatch.
- The `intent-symbols` judge is filled by naming the related functions as
  `--symbol <name>...` on that single `bouncer intent bundle` resolve.
- **Scope revision revalidation.** After `coordinate revise`, open a new
  `coordinate dispatch` and re-call `bouncer intent bundle` against the
  revised brief hash and related function set. When function blob and section
  hashes match, keep the existing `intent_bundle_revision`; when either
  differs, pin the new revision for every later role. If that revalidation
  fails, do not start role dispatch.
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
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `previous_outcome`. After `ok: false` or a fence refusal,
  call `next` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
- `coordinate dispatch` also returns a top-level `report_path` (the implementer's
  per-attempt report file). Keep it and pass it to the `implement` step next to
  the metadata; it is not one of the `metadata` keys.
