# revise

Contract card for the `coordinate next` action `revise`. Rules are copied from
the coordinator Hard guards (scope drift).

- A worker write outside the current task's `affected_paths` is drift, not the
  end of the drive: judge it, then record your judgment with `bouncer coordinate
  revise --blueprint <dir> --task <NNN> --paths <p> [--paths <p>…] --reason <r>
  --ledger-path <checkpoint.ledger.path> --ledger-hash <checkpoint.ledger.sha256>`
  from that task's worktree. That command is the only surface that revises
  scope; it moves the task document and the ledger to one revision and appends
  the decision behind it, which is what makes the widening reviewable. `--paths` replaces the task scope with exactly the given set; pass every path
  the task still needs, not only new ones.
  A scope
  revision moves the task document and the ledger to one revision and is
  refused without a reason.
- When a newly added path overlaps an entry of the brief's `## Do not touch`
  section, revise is refused with `scope-do-not-touch-conflict` (`paths` lists
  the entries). Judge each entry, then rerun with `--release-do-not-touch <entry>`
  once per entry you accept to release; the same write removes it from the brief.
  A `release-do-not-touch-unknown` refusal means a value is not an overlapping
  entry: rerun with only the entries listed in the conflict's `paths`, spelled as
  in the brief. Drop the path from `--paths` instead when the entry must stay.
- A revision names repository source paths only — never an absolute or
  escaping path, the whole tree, `.git/`, or the `.bouncer/` governance tree —
  and inside that boundary there is no ceiling (`${BOUNCER_ROOT}/rules/commit-scope.md`).
  Refuse the drift and record rework instead when it belongs to another task.
- While an implementer attempt is active, freeze the task brief: do not call
  `coordinate revise` and do not edit the brief until you have judged the
  implementer's report. If scope must change, wait for the report, record
  `scope_revision`, revise, then open a new dispatch.
- After `coordinate revise`, open a new `coordinate dispatch` and re-call
  `bouncer intent bundle` against the revised brief hash and related function
  set.
