# report

Contract card for the `coordinate next` action `report`. Rules are copied from
the coordinator Procedure step 3 (Drive) and step 5 (Judge).

- Judge the implementer's **Brief revision** (`attempt` and
  `task_brief_hash`) against the active dispatch. Matching values: fill
  `judge.fields` and run the `report` `argv`; only an `accepted` report may
  then run the `record` `argv`.
- A missing or mismatched Brief revision is stale — call `coordinate report`
  with the received `attempt` and `task_brief_hash` so runtime can append
  `stale-report`; do not call `accepted` or `coordinate record`, and keep the
  attempt open.
- Turn each report into exactly one of: accepted, scope revision (`coordinate
  revise`), rework with a named cause, task/graph change, or terminal blocked.
  The `--outcome` values are `accepted`, `rework`, `scope_revision`,
  `task_change`, and `blocked`.
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `previous_outcome`. After `ok: false` or a fence refusal,
  call `next` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
- Every judgment gets a ledger entry via the fenced mutation that records it;
  ordinary rework follows the no-progress rule.
