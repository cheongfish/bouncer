When authoring or refreshing explain and running the quiz, read this reference.

**Plugin-root shell contract.** See `rules/plugin-root.md`; the explain-scaffold shell below remains independent.

Create a missing BP `explain.md` with:
```bash
bouncer scaffold explain --blueprint <pointer.blueprint>
```
Then use `explain-diff` (`references/explain-diff/index.md`) to author or refresh five Korean sections with `stop-slop`, quiz pointer-`base`..HEAD, and write one `bouncer.comprehension` blueprint entry with `quiz_score`. No user quiz answer stops finalization before validate or `finalize --yes`. Publish `explain.md` when ready; when only `diff_sha` or prose drifted after later commits, refresh those fields without re-quizzing.
