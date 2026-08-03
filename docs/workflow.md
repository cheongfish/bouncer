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

## How it works

```text
/bouncer-plan     → gate plan     (G1–G5, G10–G12)
/bouncer-execute  → worktree + seed → implement · verify · review
                  → gate execute  (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-finalize → BP distill · Distill 승격
                  → gate finalize (G9) → 한 커밋 (+ draft PR)
```

단계별 스킬(권장 순서):

| 단계 | 스킬 |
| --- | --- |
| `/bouncer-plan` | `discovery` → `spec-authoring` → `graphify-runner` → `minimality` |
| `/bouncer-execute` | `implementation` → `verification` → `review` → `minimality` (`debugging` on verify failure) |
| `/bouncer-finalize` | `spec-authoring` (BP distill + project Distill 승격) |

Execute에서 구현·리뷰는 named 서브에이전트 `bouncer-implementer` /
`bouncer-reviewer`로 분리할 수 있다.

게이트 표와 실패 코드는 [gates.md](gates.md),
CLI는 [cli.md](cli.md), 설정은 [configuration.md](configuration.md)를
보세요. 커밋 가드의 한계는 [security.md](security.md)에 있습니다.
