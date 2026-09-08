When authoring or refreshing explain and running the quiz, read this reference.

**Plugin-root shell contract.** See `rules/plugin-root.md`; the explain-scaffold shell below remains independent.

Create a missing BP `explain.md` with:
```bash
bouncer scaffold explain --blueprint <pointer.blueprint>
```
Then use `explain-diff` (`references/explain-diff/index.md`) to author or refresh five Korean sections with `stop-slop`, quiz pointer-`base`..HEAD, and write one `bouncer.comprehension` blueprint entry with `quiz_score`.

**Drive sources.** When the finalize payload carries `coordinator`, explain describes what the drive actually did, not what the plan predicted. Add to the explain sources: the approved DAG at plan time and the final one (tasks and edges added, split, or reordered during the drive), each task's `actual_paths` beside its initial `affected_paths` with every `scope_revision` and the reason recorded behind it, and the provenance of each result — which named agent produced it, on which worker branch and SHA, and the integration head those commits landed on. Audit those against the ledger's decision log before writing; the plan document alone is not the record of the run.

No user quiz answer stops finalization before validate or `finalize --yes`. Publish `explain.md` when ready; when only `diff_sha` or prose drifted after later commits, refresh those fields without re-quizzing.
