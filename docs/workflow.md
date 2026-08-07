# Workflow

1. `/bouncer-init`: bootstrap `.bouncer/` once per project.
2. `/bouncer-plan`: author epic → blueprint → task bundles
   (`tasks/<NNN>/{tasks,verification,review}.md`), scaffold docs, inject
   `graph.suggested_paths`, confirm `affected_paths`, approve, write the active
   pointer (`bouncer current --set`, which records the selected task when one
   is open), pass gate `plan` (G1–G5, G10–G12). Add another bundle with
   `bouncer scaffold task --blueprint <dir> --id <NNN>`.
3. `/bouncer-execute`: preflight, reuse or create the blueprint worktree,
   `seed-worktree` (move plan documents from the base checkout into the
   worktree), implement from the pointer's `tasks/<NNN>/tasks.md`, then verify
   and review against that same bundle's `verification.md` and `review.md`,
   pass gate `execute` (G6–G8, G13–G14). Does **not** commit — hand off to
   `/bouncer-commit`. All tasks on one blueprint share one worktree.
4. `/bouncer-commit`: scope dry-run, `explain-diff` (append one comprehension
   entry for `range_from..HEAD`), pass gate `commit` (G15), **ACQ**-confirm
   `bouncer commit --yes`, then **ACQ** next-task `bouncer current --set`.
5. `/bouncer-finalize`: promote durable notes from `explain.md` into
   `.bouncer/Distill.md` via `spec-authoring` (excluding
   `## 이해 상태` / Quiz / comprehension), pass gate `finalize` (G16), then
   **ACQ**-confirm remainder `finalize --yes` (recommended: remove execute
   worktree), one **ACQ** to open a draft PR (show rendered title/body, then
   push + `gh pr create --draft` with no second confirm), filled from
   `explain.md` Background / Intuition / Code, and next-blueprint handoff. PR
   is skipped gracefully with no remote / no `gh`, or when declined. Draft PR
   titles use `[YYMMDD] (→ MergeTarget) [Type] 요약`.
   See [contributing.md](contributing.md). Plan/execute Read that project Distill
   before work.

## How it works

```text
/bouncer-plan     → gate plan     (G1–G5, G10–G12)
/bouncer-execute  → worktree (reuse) + seed → implement · verify · review
                  → gate execute  (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-commit   → explain-diff (entry append) → gate commit (G15)
                  → ACQ(commit --yes) → ACQ(next task --set)
/bouncer-finalize → Distill 승격(from explain)
                  → gate finalize (G16) → ACQ(--yes + worktree)
                  → (ACQ) draft PR (render → push+create, no body confirm)
```

단계별 스킬(권장 순서):

| 단계 | 스킬 |
| --- | --- |
| `/bouncer-plan` | `discovery` → `spec-authoring` → `stop-slop` → `graphify-runner` → `minimality` |
| `/bouncer-execute` | `implementation` → `verification` → `review` → `minimality` (`debugging` / `bouncer-debugger` on verify failure) |
| `/bouncer-commit` | `explain-diff` (explain에 `stop-slop`) |
| `/bouncer-finalize` | `spec-authoring` (explain→Distill 승격) |

Execute에서 구현·리뷰·디버그는 named 서브에이전트 `bouncer-implementer` /
`bouncer-reviewer` / `bouncer-debugger`로 분리할 수 있다.

게이트 표와 실패 코드는 [gates.md](gates.md),
CLI는 [cli.md](cli.md), 설정은 [configuration.md](configuration.md)를
보세요. 커밋 가드의 한계는 [security.md](security.md)에 있습니다.
