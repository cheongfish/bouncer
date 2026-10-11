When authoring or refreshing explain and running the quiz, read this reference.

**Plugin-root shell contract.** See `${BOUNCER_ROOT}/rules/plugin-root.md`; the explain-scaffold shell below remains independent.

Create a missing BP `explain.md` with:
```bash
bouncer scaffold explain --blueprint <pointer.blueprint>
```
Then use `explain-diff` (`${BOUNCER_ROOT}/references/explain-diff/index.md`) to author or refresh four Korean sections with `stop-slop`, quiz the digest `range.base..range.head` span from its `diff` summary, and write one `bouncer.comprehension` blueprint entry (prefer digest `range.diff_sha` for `diff_sha`).

Explain holds repository knowledge only. Do not write drive execution records (DAG change, scope revision, worker branch·sha, integration head). Do not re-read the coordinator ledger, task documents, or verification logs. Cite verification and review facts through the digest `evidence` references (`evidence.verification[].evidence_id`, `evidence.review`), and choose quiz targets from `diff.per_file` and `symbols` instead of re-reading the full diff or history.

No user quiz answer stops finalization before validate or `finalize --yes`. Publish `explain.md` when ready; when only `diff_sha` or prose drifted after later commits, refresh those fields without re-quizzing.

## Canonical context boundary

Canonical context remains the only repository-knowledge source at finalize.

## Quiz question count

`${BOUNCER_ROOT}/references/explain-diff/index.md` owns question count sizing (1–10 ordinarily, exactly one question on `scale: light`).
