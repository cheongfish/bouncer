# Planning

계획 단계(plan · spec-authoring · template)가 읽는 계약이다.
실행 범위·commit 계약은 `rules/commit-scope.md`, coordinator mutation 절차는
`rules/governance.md`에 있다.

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
`affected_paths`를 만들지 않는다. 실패한 실행의 상태 전이는
`rules/governance.md` `## Blueprint sizing rule`이 소유한다.

The plan gate emits a non-blocking `warnings` entry when a task's
`affected_paths` count exceeds 20. That signal only advises splitting when
one-commit review would be hard; it is not a blocking rule, does not invent a
G/S failure code, and does not change gate success or process exit codes.
Legitimate wide tasks (bulk renames, migrations) still pass.

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
   neither templated nor demanded. Approved scope is untouched: **G3–G5**
   (G4 is retired), and **G11** judge an ordinary commit task exactly as they
   judge a full one, so an empty `affected_paths` still fails.
   **G12** stays wired on light and judges a `Do not touch` section the same
   way when one is present — the light template ships none, so a light plan
   normally gives it nothing to judge.
3. **Epic allocation** — do not open a new epic. Stack the blueprint under the
   shared **maintenance epic** (slug `maintenance`). If that epic is missing,
   create it once with normal numbering, then keep stacking blueprints under it.
   Never close that epic.
4. **Agent round-trips** — light implement routing (inline vs named) is owned
   by `skills/bouncer-execute/references/agent-dispatch.md`.
5. **Quiz size** — light quiz sizing is owned by
   `references/explain-diff/index.md`.

What stays the same:

- Task document set: `tasks/<NNN>/{tasks,verification,review}.md` and
  `explain.md` are still authored and gated.
- Ordinary commit-task gate judgments **G1–G8** and **G11–G17** are unchanged in the light path
  (G16 comprehension at finalize; G17 staged scope at commit).
  G4 and G15 are retired. Only **G18** (not applied) and the **G10** section list
  differ, and both differences follow from the document set above rather than
  from any agent judgment.

Returning to `full` on an already-scaffolded light blueprint
means authoring the missing sections and running
`bouncer scaffold context-review --blueprint <dir>` before the plan gate.
If the separation between writer and named reviewer feels too thin, set
`scale` back to `full` and return to the named-agent path for implement too —
inline implement limits stay in
`skills/bouncer-execute/references/agent-dispatch.md`.

## Task DAG and approved scope

Each task bundle may declare an author-written DAG on its frontmatter:
`depends_on` (`TASKS-NNN` ids), `parallel_safe` (boolean),
`exclusive_resources` (unique resource ids), and
`dependency_gate` (`integrated`, the only accepted value). Task numbers remain
labels and the default sort key only. Execution readiness follows the DAG:
a task enters a ready wave when every listed predecessor has reached the
dependency-gate state, and only `parallel_safe: true` peers may share a wave
when their path sets and `exclusive_resources` do not conflict — path ancestor
or exact overlap, or any shared resource id, keeps them out of the same wave.
Absent DAG fields read as no dependencies, not parallel-safe, empty
`exclusive_resources`, and `integrated` — legacy single-task and number-ordered
plans stay valid as one-node sequential waves.

The plan gate (G19) rejects unknown task ids, self-references, duplicate
edges, and cycles before approval. Structural validation (S28) rejects bad
shapes and enum values. The approved DAG at plan time is the initial
baseline for later coordinator revision; it does not freeze runtime ledger
state.

Coordinator-owned revision of approved `affected_paths` after plan time is
owned by `rules/commit-scope.md` `## Approved and ledger scope`; the revision
procedure itself is `rules/governance.md` `## Coordinator mode`.

## Epic naming

At `/bouncer-plan` scaffold, name an epic for the user-facing value or product
area it covers. Do not bind the title to a specific implementation means, file,
or single task. A general title does not widen approved scope — concrete change
scope, acceptance criteria, affected paths, and task breakdown live in the
Blueprint and task documents.

Epic and blueprint directories stay under `.bouncer/context/epics/` as
`ddd-slug` (for example `014-auth` / `001-signup`). New scaffolds never use
`EPIC-` or `BP-` prefixes on directory names.
