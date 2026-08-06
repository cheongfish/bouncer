# Workflow

1. `/bouncer-init`: bootstrap `.bouncer/` once per project.
2. `/bouncer-plan`: author epic → blueprint → tasks, scaffold docs, inject
   `graph.suggested_paths`, confirm `affected_paths`, approve, write the active
   pointer (`bouncer current --set`), pass gate `plan` (G1–G5, G10–G12).
3. `/bouncer-execute`: preflight, worktree, `seed-worktree` (move the plan
   documents from the base checkout into the fresh worktree), implement from
   tasks brief, verification, review, pass gate `execute` (G6–G8,
   G13–G14).
4. `/bouncer-finalize`: scaffold + `explain-diff` (BP `explain.md` +
   comprehension), promote durable notes from `explain.md` into
   `.bouncer/Distill.md` via `spec-authoring` (excluding
   `## 이해 상태` / Quiz / comprehension), pass gate `finalize` (G15), then
   **ACQ**-confirm remainder commit (recommended: `--yes` + remove execute
   worktree), one **ACQ** to open a draft PR (show rendered title/body, then
   push + `gh pr create --draft` with no second confirm), filled from
   `explain.md` Background / Intuition / Code, and next-pointer handoff. PR is
   skipped gracefully with no remote / no `gh`, or when declined. Draft PR
   titles use `[YYMMDD] (→ MergeTarget) [Type] 요약`.
   See [contributing.md](contributing.md). Plan/execute Read that project Distill
   before work.
5. `bouncer advise`: at any point, print the recommended Ponytail mode for
   the current Bouncer phase (advisory only; never switches modes automatically).

## How it works

```text
/bouncer-plan     → gate plan     (G1–G5, G10–G12)
/bouncer-execute  → worktree + seed → implement · verify · review
                  → gate execute  (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-finalize → explain-diff · Distill 승격(from explain)
                  → gate finalize (G15) → ACQ(--yes + worktree)
                  → (ACQ) draft PR (render → push+create, no body confirm)
```

단계별 스킬(권장 순서):

| 단계 | 스킬 |
| --- | --- |
| `/bouncer-plan` | `discovery` → `spec-authoring` → `stop-slop` → `graphify-runner` → `minimality` |
| `/bouncer-execute` | `implementation` → `verification` → `review` → `minimality` (`debugging` / `bouncer-debugger` on verify failure) |
| `/bouncer-finalize` | `explain-diff` → `spec-authoring` (explain→Distill 승격; explain에 `stop-slop`) |

Execute에서 구현·리뷰·디버그는 named 서브에이전트 `bouncer-implementer` /
`bouncer-reviewer` / `bouncer-debugger`로 분리할 수 있다.

게이트 표와 실패 코드는 [gates.md](gates.md),
CLI는 [cli.md](cli.md), 설정은 [configuration.md](configuration.md)를
보세요. 커밋 가드의 한계는 [security.md](security.md)에 있습니다.
