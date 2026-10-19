# report

Contract card for the `coordinate next` action `report`, from the coordinator
Procedure step 3 (Drive) and step 5 (Judge). When the report's Brief revision
does not match the active dispatch, read the stale report rule in
[agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md) and run
`coordinate report` only as that rule says.

- Judge the implementer's **Brief revision** (`attempt` and
  `task_brief_hash`) against the active dispatch. Matching values: fill
  `judge.fields` and run the `report` `argv`; only an `accepted` report may
  then run the `record` `argv`. A mismatch is stale and follows agent-dispatch.
- `--outcome accepted` needs a confirmed worker commit: HEAD past
  `integrationHead`, `commit_sha` equal to HEAD's first 8 characters, and no
  dirty file inside the approved scope. Otherwise `coordinate report` refuses
  with `worker-commit-missing`, `worker-commit-stamp-mismatch`, or
  `worker-scope-dirty` without writing the ledger; call `advance` to make the
  task commit, then report again. Other outcomes need no commit.
- A report file that is missing, or lacks `## Brief revision`,
  `## Open choices`, or `## Known weaknesses`, is not stale: `coordinate report`
  refuses with `report-revision-missing` / `report-section-missing` without
  writing the ledger. Redispatch the same attempt or ask the worker to fix the
  file at `report_path`, then retry. `report-revision-conflict` (file differs
  from the arguments) is handled the same way.
- Judge from the report file, not the implementer's hand-back: with
  `report_path` the hand-back carries only a summary, the path, and any
  Needs planning / Scope impact. The file may omit empty Deviations, Scope
  impact, and Needs planning headings — an absent one reads as `none`, not a
  missing section. Changed files, Red run, and the required sections stay.
- Before `accepted`, compare the Contract's storage location, state ownership,
  and interface wording in the task brief with the report's changed files and
  deviations. A mismatch is `rework` or `scope_revision`, never `accepted`.
- Turn each report into exactly one of: accepted, scope revision (`coordinate
  revise`), rework with a named cause, task/graph change, or terminal blocked.
  The `--outcome` values are `accepted`, `rework`, `scope_revision`,
  `task_change`, and `blocked`.
- After `rework`, `scope_revision`, or `task_change`, revise only when the
  outcome requires it, then redispatch so runtime supplies the increased
  `attempt` and `payload.report`. After `ok: false` or a fence refusal,
  call `advance` again; on mismatch re-run `coordinate status` and continue from
  that checkpoint.
- Judge from `payload.report` and the `payload.evidence` pointers (confirm each
  path hash, then read); do not load completed-task bodies or the raw ledger.
- Every judgment gets a ledger entry via the fenced mutation that records it;
  ordinary rework follows the no-progress rule.
