# Planning

계획 단계(plan · spec-authoring · template)가 읽는 계약이다.
실행 범위·commit 계약은 `${BOUNCER_ROOT}/rules/commit-scope.md`, coordinator mutation 절차는
`${BOUNCER_ROOT}/agents/bouncer-coordinator.md`에 있다.

## Blueprint sizing rule

Each **task bundle** is sized for **one reviewable commit**. When
`review_scope` is `blueprint`, that bundle is
`tasks/<NNN>/{tasks,verification}.md` and review lives at blueprint-root
`review.md`. When `review_scope` is absent, the bundle is `tasks/<NNN>/{tasks,verification,review}.md`. A blueprint may hold several
task bundles and remains the review / PR unit. Root `tasks.md` and
`tasks-NNN.md` documents are input only to `bouncer migrate task-layout`. If a
task feels too large for one commit, split it into more task bundles (or more
blueprints). Do **not** invent a further subtask layer beneath a task bundle.

예외는 `bouncer.execution_kind: verification`인 종단 fan-in node다. 이
node는 `tasks.md`와 `verification.md`만 scaffold하고, 선행 구현 task가 모두
integrated된 뒤 전체 CI를 한 번 실행해 `verification.md` 증적만 남긴다.
source diff, reviewable commit, task `review.md`와 task별 review 단계,
`affected_paths`를 만들지 않는다. `review_scope`가 `blueprint`이면 최종
리뷰는 이 node가 `integrated`된 뒤에 한 번 열린다. 실패한 실행의 상태 전이 중
verification task 상태 쓰기는 `bouncer coordinate advance`가, terminal failure 복구는
`bouncer coordinate repair`와 `reverify`가 소유한다.

The plan gate emits a non-blocking `warnings` entry when a task's
`affected_paths` count exceeds 20. That signal only advises splitting when
one-commit review would be hard; it is not a blocking rule, does not invent a
G/S failure code, and does not change gate success or process exit codes.
Legitimate wide tasks (bulk renames, migrations) still pass.

## Verification responsibilities

Blueprint `bouncer.verification_policy` is optional and has one value,
`scoped_terminal`; `bouncer scaffold blueprint` writes it for new plans. A
blueprint without the key is **legacy**: the `config.verify` fallback and the
existing topology are unchanged, and nothing is migrated. On a `scoped_terminal`
blueprint the plan gate (**G20**) requires every commit task to carry its own
non-empty, single-argv `bouncer.verify` that is not the terminal full-suite
command, and exactly one terminal verification task that waits (directly or
transitively) on every commit task. Workers run only their task command; the
first full verification runs once in the terminal node after every
implementation task is integrated, and fan-in rejects a worker report whose
`## Tests` section lacks the assigned command or a passing result. Failure
recovery re-verification and the finalize remainder verification are separate
runs. An unknown `verification_policy` value is a **G20** failure, never read
as legacy.

## Complexity declaration

`bouncer.complexity` is `low` or `standard`; absence reads as `standard`. Plan
recommends from discovery handoff and `plan inspect` routing; the user confirms
at the `plan.complexity` ACQ. The declaration is not approval. Do not auto-select
from path count, diff size, or task count.

`low` changes only plan-review perspectives (`verifiability`, plus
`risk_security` when any commit task declares `review_risk`), execute-review
`single`/`combined`, and reviewer-tier task-count thresholds. A declared
`review_risk` still adds the security perspective, and a strong reviewer tier
stays strong on `low`. Document set, task sections, epic assignment, quiz, and
execution path stay the same as `standard`.

Closed documents may still read `scale: light` as a historical value.
Structural validation refuses a new `scale: light` declaration.

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
owned by `${BOUNCER_ROOT}/rules/commit-scope.md` `## Approved and ledger scope`; the revision
procedure itself is `${BOUNCER_ROOT}/agents/bouncer-coordinator.md`.

## Epic naming

At `/bouncer-plan` scaffold, name an epic for the user-facing value or product
area it covers. Do not bind the title to a specific implementation means, file,
or single task. A general title does not widen approved scope — concrete change
scope, acceptance criteria, affected paths, and task breakdown live in the
Blueprint and task documents.

Epic and blueprint directories stay under `.bouncer/context/epics/` as a plain
slug (for example `auth` / `signup`): lowercase kebab-case, at most 40
characters, never digits only and never starting with a three-digit prefix.
A blueprint's position among its siblings is the frontmatter `bouncer.order`
(a positive integer unique within the epic), not a directory prefix.
`bouncer plan inspect --epic-dir <dir>` reports `epic.nextBlueprintOrder` as the
suggested value. The stable IDs are `<epic-slug>/<bp-slug>` and
`<epic-slug>/<bp-slug>/<ddd>` (task number stays three digits); branches are
`<type>/<epic-slug>-<bp-slug>-<slug>` and worktrees are
`.worktrees/<epic-slug>/<bp-slug>`. The registry (v2) keeps `legacy_id` and
`blueprint_aliases` for old numbers. New scaffolds never use `EPIC-` or `BP-`
prefixes. The numbered form (`014-auth` / `001-signup`, `EPIC-<ddd>/BP-<ddd>`) is
only read in a repository that has not run `bouncer migrate context-slugs [--yes]`
yet and in old commit trailers.

## Epic attribution

Every blueprint joins one epic from the registry
(`registry.epics` in `bouncer plan inspect`). Apply these rules in order and
stop at the first that holds:

1. When the acceptance criteria center on the behavior of one domain feature,
   attribute to that domain epic if it exists, otherwise to `features` with an
   `area`. This holds even when the change edits common-layer files.
2. When it changes authentication, authorization, or the account model itself,
   attribute to `identity-access`.
3. When it changes the shared user-facing frame, design system,
   internationalization, or accessibility, attribute to `interface`.
4. When it changes a data foundation shared by two or more features, attribute
   to `data`; an external boundary goes to `integration`; a shared module or
   architecture boundary goes to `core`.
5. When product behavior stays the same and only build, deploy, or environment
   changes, attribute to `foundation`.
6. When it changes testing, observability, or operations tooling itself,
   attribute to `quality-ops`.
7. When none applies, create no epic and report to the user.

When a change touches several epics, pick the one the acceptance criteria center
on as the primary epic. Security, performance, bug-fix, and refactoring work
attributes by the target feature. Inactive epics and `legacy` epics are never
candidates.

## Release-time documents

Plan-stage documents (epic, blueprint, tasks) never plan to edit version
documents. Do not put any of these files in Touch, `affected_paths`,
Checklist, or `bouncer.verify`, and do not plan a change to them:

- `CHANGELOG.md`
- `package.json`
- `packages/cli/package.json`
- `package-lock.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.codex-plugin/plugin.json`
- `.cursor-plugin/plugin.json`

When a request asks for a version bump or a CHANGELOG entry, leave it out of
the plan and tell the user in Korean: "버전 올림과 CHANGELOG 기록은 계획에 넣지
않고 릴리스 시점에 따로 작성합니다." This is a documentation rule only; the plan
gate does not check it, and a separate release task may still edit these files.
