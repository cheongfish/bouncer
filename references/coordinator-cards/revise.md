# revise

Contract card for the `coordinate next` action `revise`. Rules are copied from
the coordinator Hard guards (scope drift).

- A worker write outside the current task's `affected_paths` is drift, not the
  end of the drive: judge it, then record your judgment with `bouncer coordinate
  revise --blueprint <dir> --task <NNN> --paths <p> [--paths <p>…] --reason <r>
  --ledger-path <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>`
  from that task's worktree. That command is the only surface that revises
  scope; it moves the task document and the ledger to one revision and appends
  the decision behind it, which is what makes the widening reviewable. A scope
  revision moves the task document and the ledger to one revision and is
  refused without a reason.
- A revision names repository source paths only — never an absolute or
  escaping path, the whole tree, `.git/`, or the `.bouncer/` governance tree —
  and inside that boundary there is no ceiling (`rules/commit-scope.md`).
  Refuse the drift and record rework instead when it belongs to another task.
- While an implementer attempt is active, freeze the task brief: do not call
  `coordinate revise` and do not edit the brief until you have judged the
  implementer's report. If scope must change, wait for the report, record
  `scope_revision`, revise, then open a new dispatch.
- After `coordinate revise`, open a new `coordinate dispatch` and re-call
  `bouncer intent bundle` against the revised brief hash and related function
  set.
