확인된 `affected_paths`를 기록한 뒤 context review로 진행합니다.must_fix 두 건을 한 번에 수정한 뒤 delta 인증을 진행합니다.에픽 본문 변경으로 `follow_up: full`이라 discovery를 새 digest로 다시 돌립니다.Context review accepted (advisory CR-1 only). Approval 전에 task DAG입니다.

**Task DAG**
| Task | depends_on | parallel_safe | dependency_gate | execution_kind |
|------|------------|---------------|-----------------|----------------|
| TASKS-001 | `[]` | false | integrated | commit |
| TASKS-002 | `[TASKS-001]` | false | integrated | verification |

Shared-contract conflicts: none (`parallel_safe: false`, no overlapping parallel peers, no cycles).

---

**AskUserQuestion — plan.approval**
<!-- acq {"gate":"plan.approval","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Approve epic `001-handler-timeout` + blueprint `001-handler-timeout` (tasks → ready, then activate + plan gate)
2. **Recommend-why**: Discovery framing, paths, verify (`npm test`), and context review are settled; DAG is valid
3. **Options** (recommended-first):
   - A) Approve the plan (Recommended)
   - B) Revise before approval (say what to change)
   - C) Cancel without approving