# Judged Rubric

Five dimensions, each scored 0-5 with a written evidence line. Score the **diff
as delivered**, not the conversation that produced it, and not the code that was
already there. When a level's description is only partly true, take the lower
level.

Every score needs evidence a third party can check: a file path and line, a test
name, a command output. "Feels clean" is not evidence, and a dimension scored
without evidence is scored 0 by convention — that is a judging failure, not a
free pass for the run.

---

## 1. Correctness & spec fidelity

Does the change actually do what was asked, for the inputs that matter?

| Score | Anchor |
|---|---|
| 5 | Implements the full request; edge cases (empty, null, boundary, concurrent, error paths) handled deliberately; no behavior regressions found on inspection |
| 4 | Full request implemented; one or two minor edge cases unhandled but non-crashing |
| 3 | Happy path correct; a real edge case is wrong or unhandled |
| 2 | Partially implements the request, or the main path has a defect reachable in normal use |
| 1 | Compiles/runs but does not deliver the requested behavior |
| 0 | Does not run, or silently corrupts state |

Probe: name one input for which the change is wrong. If you cannot, that is 4+.

## 2. Scope discipline

Did the agent change what it was asked to change — and nothing else?

| Score | Anchor |
|---|---|
| 5 | Every hunk traces to the request; no drive-by reformatting, renames, dependency additions, or "while I was here" refactors |
| 4 | One small unrelated cleanup, harmless and self-contained |
| 3 | Noticeable unrequested changes (reformatting a file, restructuring a nearby function) that inflate review cost |
| 2 | Unrequested changes touch behavior of code outside the task |
| 1 | Task is buried inside a broad refactor |
| 0 | Deleted, disabled, or weakened tests/checks to make the change pass |

Score 0 is a hard finding — record it in `blocking_findings`, not just here.
Suppressed lint rules, `--no-verify`, skipped tests, loosened assertions and
widened type escapes all land here.

## 3. Test quality

Do the tests establish that the change works and would catch its regression?

| Score | Anchor |
|---|---|
| 5 | Tests cover the new behavior including failure/edge paths; they fail if the change is reverted; they assert outcomes, not implementation details |
| 4 | Good coverage of the main behavior; edge paths thin |
| 3 | Tests exist but only exercise the happy path, or assert on mocks rather than results |
| 2 | Token tests: assert-true, snapshot-only, or tests that pass with the change reverted |
| 1 | No tests where the project clearly expects them |
| 0 | Existing tests weakened, deleted, or marked skip/xfail to get green |

Cheapest check: revert the source hunk, keep the tests, run them. Anything that
still passes is not testing the change. Say in the evidence line whether you ran
this or reasoned about it.

## 4. Codebase fit

Does it read like the surrounding code, or like a bolted-on graft?

| Score | Anchor |
|---|---|
| 5 | Uses existing helpers, patterns, error handling, naming and layering; a reviewer could not pick it out of a blame view |
| 4 | Consistent, with one idiom that differs harmlessly |
| 3 | Works, but reimplements something the repo already has, or introduces a second way of doing an established thing |
| 2 | New dependency or pattern added where an in-repo equivalent existed |
| 1 | Clashes with project architecture (layering violation, wrong module, bypassed abstraction) |
| 0 | Copy-pasted duplication of existing logic |

Probe: grep for one function the change reimplements. Duplication is the most
common agentic failure and the least visible in a green test run.

## 5. Maintainability & clarity

Cost to the next person who has to change this.

| Score | Anchor |
|---|---|
| 5 | Small, well-named units; comments explain *why* where non-obvious; no dead code, no leftover debug output, no speculative generality |
| 4 | Clear overall; one long function or thin naming spot |
| 3 | Understandable but bloated: over-abstracted, over-commented narration of *what*, or redundant defensive layers |
| 2 | Requires real effort to follow; duplicated blocks; stale comments |
| 1 | Dead code, commented-out blocks, debug prints, or TODOs left behind |
| 0 | Actively misleading — comments or names contradict behavior |

Agentic output skews verbose. Comments that restate the line below them, wrapper
functions with one caller, and try/except around code that cannot throw all
belong at 3 or below.

---

## Blocking findings

Independent of scores, record any of these in `blocking_findings`. They cap the
composite in `scorecard.py` regardless of how well the run scored elsewhere:

- Secret, token, or credential committed
- Test/lint/type gate weakened or bypassed to reach green
- Data-destructive operation added without a guard (migrations, deletes, force pushes)
- Known-vulnerable dependency introduced
- Licensed code copied without attribution

## Judging protocol

1. Read the diff in full before scoring anything. Partial reads produce
   inflated correctness scores.
2. Score each dimension in order, writing the evidence line *before* the number.
3. Prefer the lower of two candidate levels. Benchmarks are only useful if the
   scale stays honest across runs; grade inflation destroys comparability faster
   than any single wrong score.
4. Never let a green test suite raise a judged score. The objective half of the
   composite already counts it — counting it twice is how agentic output starts
   looking better than it is.
5. When comparing runs (A/B), score every run against the rubric independently
   before looking at any other run's scores.
