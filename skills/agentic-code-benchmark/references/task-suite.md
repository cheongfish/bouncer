# Task Suites and A/B Protocol

One task is an anecdote. This file covers how to get from a single scorecard to a
number you can defend.

## Designing tasks

A benchmark task needs three things: a **fixed base commit**, a **prompt given
verbatim to every run**, and a **definition of done** the judge can check without
asking the agent.

Store them as JSON next to your scorecards:

```json
{
  "id": "csv-export",
  "base": "a1b2c3d",
  "prompt": "Add CSV export to the reports page. Same columns as the existing JSON export.",
  "done_when": [
    "Export button on /reports produces a CSV with the JSON export's columns",
    "Quoting and embedded commas handled",
    "Covered by a test that fails without the change"
  ],
  "checks": {
    "test": "npm test",
    "lint": "npm run lint",
    "typecheck": "npx tsc --noEmit"
  }
}
```

Aim for 5-8 tasks spanning the shapes that actually fail differently:

| Shape | Why it belongs |
|---|---|
| Small feature in existing code | The common case; tests codebase fit |
| Bug fix from a real report | Tests diagnosis, not just typing |
| Refactor with no behavior change | Scope discipline lives or dies here |
| Cross-cutting change (3+ modules) | Where agents lose the thread |
| Task with an existing helper to reuse | Catches duplication directly |
| Task with an ambiguous requirement | Does the agent ask, assume loudly, or guess silently? |

Pull tasks from your own merged PRs. Synthetic tasks reward agents that write
plausible code rather than code that fits your repo — the exact failure the
benchmark exists to catch.

## Running an A/B

1. One git worktree per run, all from the same base commit. Runs must not see
   each other's output.
   ```bash
   git worktree add ../bench-default  <base>
   git worktree add ../bench-planmode <base>
   ```
2. Same prompt, verbatim, in every arm. Any prompt difference *is* the variable —
   change one thing at a time.
3. No human intervention mid-run, or the same intervention budget in every arm
   (e.g. "at most one 'continue'"). Log what you did.
4. Collect metrics in each worktree **before** running anything else, then judge
   each run independently against the rubric without looking at the other runs'
   scores.
5. Compare:
   ```bash
   python3 scripts/scorecard.py compare bench-default.card.json bench-planmode.card.json
   ```

## Reading the result honestly

- **Under ~5 points on one task**: noise. Do not conclude anything.
- **Under ~5 points averaged over 5+ tasks**: still weak. Report it as a tie.
- **Consistent direction across most tasks** matters more than the mean. One task
  swinging 30 points can carry an average on its own; look at per-task signs.
- **Different check coverage between arms** invalidates the comparison. The
  compare output flags this; do not argue past it.
- **Caps distort averages.** A run capped at 35 for a blocking finding is not "35
  points of quality" — it is a disqualification. Report capped runs separately
  rather than averaging them in.

## Aggregating a suite

Average composites per configuration, and always report alongside:

- number of tasks (n)
- min and max composite (the spread is usually the story)
- count of capped runs per arm
- which dimension moved most between arms

A one-line summary worth publishing looks like:

> plan-mode: 78.4 avg over 6 tasks (range 61-91, 0 capped) vs default: 71.2
> (range 44-89, 1 capped). Gain is concentrated in scope discipline (+1.3 avg)
> and test quality (+0.8); correctness was flat.

That last clause — what *didn't* move — is the part most benchmark writeups drop
and the part that tells you whether the change was worth its cost.

## CI use

Gate agent-authored PRs on the measured half only. It needs no judge and is fully
deterministic:

```bash
python3 scripts/collect_metrics.py --base origin/main --head HEAD \
  --test-cmd "npm test" --lint-cmd "npm run lint" --out metrics.json
```

Fail the build on any check that ran and did not pass, or on a churn ratio above
your threshold. Keep the judged half in review, where a human can disagree with
it — a rubric score is an argument with evidence attached, not a verdict.
