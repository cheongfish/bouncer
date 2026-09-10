# Governance

## Blueprint sizing rule

Each **task bundle** (`tasks/<NNN>/{tasks,verification,review}.md`) is sized
for **one reviewable commit**. A blueprint may hold several task bundles and
remains the review / PR unit. Root `tasks.md` and `tasks-NNN.md` documents are
input only to `bouncer migrate task-layout`. If a task feels too large for one commit, split it
into more task bundles (or more blueprints). Do **not** invent a further
subtask layer beneath a task bundle.

예외는 `bouncer.execution_kind: verification`인 종단 fan-in node다. 이
node는 `tasks.md`와 `verification.md`만 scaffold하고, 선행 구현 task가 모두
integrated된 뒤 전체 CI를 한 번 실행해 `verification.md` 증적만 남긴다.
source diff, reviewable commit, `review.md`와 review 단계,
`affected_paths`를 만들지 않으며 실패한 실행은 integrated로 전이하지 않는다.

The plan gate emits a non-blocking `warnings` entry when a task's
`affected_paths` count exceeds 20. That signal only advises splitting when
one-commit review would be hard; it is not a blocking rule, does not invent a
G/S failure code, and does not change gate success or process exit codes.
Legitimate wide tasks (bulk renames, migrations) still pass.

`/bouncer-commit` closes one task (scope check → `bouncer commit`).
`/bouncer-run` repeats that commit unit; verification node에서는 commit 대신
integration checkout의 verification runner만 실행한다.
`/bouncer-execute` does not commit. `/bouncer-finalize` closes the blueprint
(Distill promotion, explain + quiz, remainder commit, draft PR, worktree
cleanup) after every task is committed.

Task commits authorize the complete existing candidate set through the shared
scope helper, then stage task outputs only. Task bundles, context documents,
and Distill remain for finalize; finalize stages tracked transient deletions
and removes untracked documents without adding paths that no longer exist. The
task's `commit_sha` stays in its working-tree document until finalize copies it
to `explain.md`.

## Lightweight cycle

A **lightweight cycle** is in
effect only when the user **declares** a narrow-scope change at `/bouncer-plan`
and the plan changes blueprint `index.md` `bouncer.scale` from the scaffold
default `full` to `light`. There is no automatic sizing from diff size, path
count, or file count. Without that declaration (`scale` absent or not
`light`), the default path applies.

The same declaration is the only way to reach the shrunken document set:
`bouncer scaffold blueprint --scale light`. Omitting `--scale`, or passing
`full`, scaffolds the unchanged five plan documents; an unknown value is
refused with exit code 2 before a single file is written.

What shrinks (five things only):

1. **Plan documents** — `--scale light` writes four documents: blueprint
   `index.md` plus `tasks/001/{tasks,verification,review}.md`. It creates no
   `context-review.md`, so `/bouncer-plan` runs no context review on a light
   blueprint and the plan gate applies no **G18** there. The four scaffolded
   documents total **100 lines or fewer**.
2. **Gated task sections** — **G10** requires only `Goal & intent`, `Touch`,
   and `Checklist` on a light blueprint. `Interface` and `Do not touch` are
   neither templated nor demanded. Approved scope is untouched: **G3–G5**,
   and **G11** judge an ordinary commit task exactly as they judge a full one, so
   an empty `affected_paths` or an empty `scope_evidence.basis` still fails.
   **G12** stays wired on light and judges a `Do not touch` section the same
   way when one is present — the light template ships none, so a light plan
   normally gives it nothing to judge.
3. **Epic allocation** — do not open a new epic. Stack the blueprint under the
   shared **maintenance epic** (slug `maintenance`). If that epic is missing,
   create it once with normal numbering, then keep stacking blueprints under it.
   Never close that epic.
4. **Agent round-trips** — when `bouncer.scale` is `light`, run the implementer
   **inline** (same session) instead of named-agent dispatch. Keep the host
   `named agents are unavailable` fallback wording as a separate sentence —
   do not replace it with the light branch. Reviewer and `bouncer-debugger`
   stay named. During a `/bouncer-run` drive the loop keeps named dispatch for
   implement too even on `light`: the loop is an orchestrator that reads
   subagent reports, so it must not become the implementer. See
   `/bouncer-execute`.
5. **Quiz size** — `explain-diff` asks **one question** when `scale: light`
   (still within the usual 1–10 range rules otherwise). See
   `references/explain-diff/index.md`.

What stays the same:

- Task document set: `tasks/<NNN>/{tasks,verification,review}.md` and
  `explain.md` are still authored and gated.
- Ordinary commit-task gate judgments **G1–G8** and **G11–G17** are unchanged in the light path
  (G16 Distill / comprehension at finalize; G17 staged scope at commit).
  G15 is retired. Only **G18** (not applied) and the **G10** section list
  differ, and both differences follow from the document set above rather than
  from any agent judgment.
- Distill promotion at `/bouncer-finalize` is unchanged.

`scripts/` reads `scale` in four places: `scaffoldBlueprint` picks the document
set, `scaffoldTask` inherits the blueprint's declared scale for a later task,
the plan gate picks the G10 / G18 contract, and structural validation (S20)
checks the value against the enum. Every one of them reads the declared
`bouncer.scale` value and nothing else; none infers size.

Limit of implement inline: the writing session still authored the change a
named reviewer will score against **its own diff** (self-review pressure on
the writer, not a same-session review verdict). If that separation feels too
thin, set `scale` back to `full` and return to the named-agent path for
implement too. Returning to `full` on an already-scaffolded light blueprint
means authoring the missing sections and running
`bouncer scaffold context-review --blueprint <dir>` before the plan gate.

## Task DAG and approved scope

Each task bundle may declare an author-written DAG on its frontmatter:
`depends_on` (`TASKS-NNN` ids), `parallel_safe` (boolean), and
`dependency_gate` (`integrated`, the only accepted value). Task numbers remain
labels and the default sort key only. Execution readiness follows the DAG:
a task enters a ready wave when every listed predecessor has reached the
dependency-gate state, and only `parallel_safe: true` peers may share a wave.
Absent DAG fields read as no dependencies, not parallel-safe, and
`integrated` — legacy single-task and number-ordered plans stay valid as
one-node sequential waves.

The plan gate (G19) rejects unknown task ids, self-references, duplicate
edges, and cycles before approval. Structural validation (S28) rejects bad
shapes and enum values. The approved DAG at plan time is the initial
baseline for later coordinator revision; it does not freeze runtime ledger
state.

Under coordinator-owned execution the approved `affected_paths` is an initial
estimate the coordinator may revise — see **Coordinator mode** below.

## Coordinator mode

A drive delegated to `bouncer-coordinator` runs from an integration worktree
with one assigned worktree per open task. In that mode `affected_paths` is the
**initial expected scope** recorded at approval, and the coordinator ledger
(`.bouncer/runtime/coordinator.json` inside the integration worktree) carries
the current task scope, its `revision`, and an append-only decision log.

- **Dynamic plan** — a scope revision moves the task document and the ledger to
  one shared `revision` and is refused without a reason. Each revision appends a
  decision naming the task, the reason, and the previous and next paths, and the
  read-modify-write is serialized so concurrent workers cannot mint one revision
  twice or drop a log entry. A writer that cannot take the ledger lock in time is
  refused outright, and a writer re-checks ownership twice — once before
  writing the task document and once before writing the ledger — backing off
  without writing at whichever check finds the lock lost. A writer that loses
  the lock between those two checks writes the task document but not the
  ledger: the second check refuses it, so the document is left carrying a
  `scope_revision` the ledger never recorded. That state needs no hand repair —
  `nextRevision` is a function of the ledger revision alone and a revision does
  not pre-check the document's `scope_revision`, so the next scope revision
  writes both sides to one number and reconciles them — but nothing heals on its
  own either: until that revision is issued, a task document whose
  `scope_revision` disagrees with the ledger is stale, and commit safety keeps
  refusing the commit rather than guessing which side is current; so does a
  ledger it cannot read, and a pointer task the ledger does not carry.
- **What a revision may name** — repository source paths only. Absolute paths,
  paths escaping the repository, whole-tree spellings, `.git/`, and the
  `.bouncer/` governance tree are refused. Inside that boundary there is no
  ceiling: a newly discovered source path is accepted on the coordinator's word,
  and the append-only decision log — not a path limit — is what makes the
  widening reviewable. Judge revisions at review time accordingly.
- **Scope audit** — commit safety judges the actual staged paths against the
  ledger's current scope instead of the approval snapshot, and refuses a commit
  made in the main worktree, outside the task's assigned worktree, on a stale
  revision, or with the ledger missing. A completed commit records the paths it
  actually carried back into the ledger beside the initial estimate.
- **Commit ownership** — a task commit is still one task bundle, and it belongs
  to the worktree the coordinator assigned; the main checkout stays read-only
  provenance for the whole drive. Workers report; only the coordinator revises
  scope, moves the pointer, and records the judgment behind either.

The commit gate is the weaker of the three layers. **G17** judges staged paths
against the task document alone and reads no ledger, so it accepts a stale
revision, a main-worktree commit, and an unassigned worktree that `bouncer
commit` and the `commit-safety` hook both refuse. The CLI and the hook are the
enforcement points; treat a passing commit gate as a document-level check, not
as coordinator authorization.

Without a coordinator ledger nothing above applies: plan and commit gates treat
the approved `affected_paths` as the change boundary exactly as before.
