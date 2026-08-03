# Workflow

1. `/bouncer-init` — bootstrap `.bouncer/` once per project.
2. `/bouncer-plan` — author epic → blueprint → tasks, scaffold docs, inject
   `graph.suggested_paths`, confirm `affected_paths`, approve, write
   `.bouncer/current`, pass gate `plan` (G1–G5, G10–G12).
3. `/bouncer-execute` — preflight, worktree, `seed-worktree` (move the plan
   documents from the base checkout into the fresh worktree), implement from
   tasks brief, verification, review, pass gate `execute` (G6–G8,
   G13–G14).
4. `/bouncer-finalize` — write BP distill, promote durable notes into
   `.bouncer/context/Distill.md`, pass gate `finalize` (G9), commit remainder,
   then push + draft PR (skipped gracefully with no remote / no `gh`). Draft
   PR titles use `[YYMMDD] (→ MergeTarget) [Type] 요약` — see
   [contributing.md](contributing.md).
   Plan/execute Read that project Distill before work.
5. `bouncer advise` — at any point, print the recommended Ponytail mode for
   the current Bouncer phase (advisory only; never switches modes automatically).
