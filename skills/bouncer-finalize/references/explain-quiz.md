When authoring or refreshing explain and running the quiz, read this reference.

**Plugin-root shell contract.** See `rules/plugin-root.md`; the explain-scaffold shell below remains independent.

Create a missing BP `explain.md` with:
```bash
bouncer scaffold explain --blueprint <pointer.blueprint>
```
Then use `explain-diff` (`references/explain-diff/index.md`) to author or refresh five Korean sections with `stop-slop`, quiz the digest `range.base..range.head` span, and write one `bouncer.comprehension` blueprint entry with `quiz_score` (prefer digest `range.diff_sha` for `diff_sha`).

**Drive sources.** When the prepare digest carries `coordinator`, explain describes what the drive actually did, not what the plan predicted. Take every fact from that `coordinator` object only:
- plan-versus-run DAG change from `repairWaves[].previousDag` and `repairWaves[].nextDag` (tasks and edges added, split, or reordered);
- each task's `actualPaths` beside its initial `paths` with every `scopeRevision` and the matching reason from `tasks[].decisions` / top-level `decisions`;
- integration head from `integrationHead`, plus each task's worker `branch` and `sha`.
Name an agent only when that name already appears in a decision body — do not invent agent labels from the skill roster. Do not re-read the coordinator ledger, task documents, or verification logs. The plan document alone is not the record of the run.

No user quiz answer stops finalization before validate or `finalize --yes`. Publish `explain.md` when ready; when only `diff_sha` or prose drifted after later commits, refresh those fields without re-quizzing.

## Canonical context boundary

Canonical context remains the only repository-knowledge source at finalize.

## Quiz question count

`references/explain-diff/index.md` owns question count sizing (1–10 ordinarily, exactly one question on `scale: light`).
