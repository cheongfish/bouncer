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
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `previous_outcome`. After `ok: false` or a fence refusal,
  call `next` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
