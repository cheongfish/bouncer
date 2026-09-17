# Gate protocol

Gates are the completion authority. Before reporting a phase complete, run:

```sh
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
```

Treat every returned `G*` or `S*` failure as a required correction. Do not
reinterpret a failure, bypass it, or hand-author verification success. Read
only the section below that matches the active phase or reported code; the
validator output remains the exact diagnostic authority.

## Phase checks

| Phase | Required result |
| --- | --- |
| `plan` | approved epic and blueprint; every task is implementation-ready; scope is justified; the task DAG is valid |
| `execute` | the current task is verified, harness verification passed, and review is accepted or explicitly not required |
| `commit` | execute evidence remains valid and staged paths are within the current task scope |
| `finalize` | every commit task is `verified`, every verification task is `integrated`, and the published Explain has valid comprehension and diff evidence |

The execute and commit gates inspect only the active pointer task. The plan and
finalize gates inspect the whole blueprint.

## Plan rules

- `G1`, `G2`, `G3`: use approved context and a task status allowed by the
  current plan lifecycle. A closed blueprint cannot be reused.
- `G5`, `G10`–`G12`: a commit task needs non-empty `affected_paths`, complete
  required sections, Touch justification, and no overlap with Do not touch.
  Light plans reduce G10 sections only; they do not weaken scope checks.
- `G18`: a full blueprint needs an accepted `context-review.md`; light plans
  skip it.
- `G19`: dependencies must name existing `TASKS-NNN` nodes without duplicate,
  self, or cyclic edges.
- `G20`: a verification task may not declare source changes in Touch and may
  not precede a commit task. It is a terminal verification node.

## Execution, commit, and finalize rules

- `G6`–`G8`: task, verification, and review status must agree. Do not mark
  them successful by editing frontmatter alone.
- `G13`: run `bouncer verify`; its Git-common-directory ledger must match the
  generated `verification.md`. A new clone or CI checkout must run verification
  again for the active task.
- `G14`: review findings require valid severity and disposition. Accepted or
  deferred findings need a non-empty note; an accepted review cannot retain an
  open must-fix finding.
- `G17`: the document-level staged-path check is weaker than coordinator scope
  enforcement. In a drive, `bouncer commit` and commit safety also require the
  assigned worker worktree and current ledger revision.
- `G16`: finalize only after all task states and Explain evidence satisfy the
  validator. Do not reopen a closed blueprint; plan a sibling instead.

## Structural constraints that affect agent actions

- `S12`: `bouncer.verify` is one allowed executable argv; no shell chaining,
  redirection, or `cd` prefix.
- `S15`–`S17`: a commit task uses
  `tasks/<NNN>/{tasks,verification,review}.md`. Do not create legacy root task
  files or non-canonical task directories.
- `S18`: imported blueprints are not gate targets.
- `S19`, `S20`, `S27`, `S28`: preserve the expected document type, declared
  scale, supersedes shape, and DAG field shapes.
- `S29`: `execution_kind` is `commit` or `verification`. A verification task
  has empty `affected_paths`, non-empty `depends_on`, `parallel_safe: false`,
  `dependency_gate: integrated`, and one valid `verify` command. It has only
  `tasks.md` and `verification.md`; it produces no source commit or review.

Retired codes (`G4`, `G9`, `G15`, `S14`, and `S21`–`S26`) are never reused.
