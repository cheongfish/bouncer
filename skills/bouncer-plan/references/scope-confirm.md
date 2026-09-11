When confirming affected_paths, read this reference.

For each `tasks/<NNN>/tasks.md` under the blueprint, first show that task's
structured Graphify evidence — role `candidates` (`implementation` / `test` /
`context`) with scores and basis, `quality.status` / `quality.confidence`, and
non-empty `quality.reasons` (especially on `low-confidence` or `unavailable`).
Then show `scope_evidence.suggested_paths` as the narrower file-path advisory
list (empty when quality is low-confidence/unavailable). Only after that
display, return to the numbered step's **ACQ — affected_paths**. Do not seed or
modify `affected_paths` automatically from `suggested_paths` or `candidates`;
write only the user's confirmed value into that task document's frontmatter.

**Contract blast check (before user confirm).** When the task Interface
changes a serialized shape, gate input, or exported contract (field names,
object→list, helper return shape), search the repo for constructors and
assertions of the *old* shape before locking `affected_paths` — not only
importers of the touched module, and including test fixtures and helpers that
build the shape as a literal (e.g. `fullBlueprint`-style explain frontmatter)
without requiring the changed file. Every file that must be edited for
Checklist / `bouncer.verify` / `config.verify` to go green belongs in Touch
and `affected_paths`. `Do not touch` on a production file does not exempt its
tests when they embed the old contract — list them under Touch, or keep the
contract change out of this task. Stale or empty graph results do not replace
this search.

**Prose / inventory cutovers.** When Goal or Interface closes wording across
docs, skills, or agents (not only code callers), run the Checklist leftover
search *before* locking Touch and `affected_paths`. Draft Touch from that
hit list minus Do not touch; rewrite Goal so it does not claim files outside
the list (Goal ⊆ Touch). Commit scope is the same set: every path that must
be staged for `/bouncer-commit` belongs in `affected_paths`, or commit-safety
blocks it.

**Context re-ground.** After the user confirms each task's `affected_paths`,
run `bouncer context-search --mode implementation --query <english anchors>`
and pass the selected canonical documents to final authoring. Repeat after a
path-list change and preserve broad/zero-hit status without guessed results.

`execution_kind: verification`인 종단 fan-in node는 이 확인의 예외다.
Graphify scope 제안과 ACQ를 만들지 않고 `affected_paths: []`를 유지한다.
대신 non-empty `depends_on`, `parallel_safe: false`, `dependency_gate:
integrated`, 실행 가능한 전체-CI `verify`, source 경로가 없는 Touch를 확인한다.
명시적 public 경로는 `bouncer scaffold task --execution-kind verification
--depends-on TASKS-NNN[,TASKS-NNN...] --verify <command>`이며 `review.md`는
만들지 않는다.
