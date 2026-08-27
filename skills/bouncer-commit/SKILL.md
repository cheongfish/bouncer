---
name: bouncer-commit
description: "This skill should be used only when the user explicitly asks to commit the active Bouncer task (for example /bouncer-commit). It preflights the pointer, dry-runs scope, passes the commit gate, ACQ-confirms `bouncer commit --yes`, then ACQs for the next task via `bouncer current --set`."
---
# /bouncer-commit

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Pointer contract: `rules/current-pointer.md`.

Close one task on the active blueprint. Follow this sequence. Do **not** open a
draft PR, remove the execute worktree, or run `explain-diff` here — those are
`/bouncer-finalize`.

**Preflight.** Load the active blueprint:
```bash
BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
node "${BOUNCER_ROOT}/scripts/bouncer" current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Apply the shared returned-value and task-brief selection contract. This
workflow only supplies the current task's scope and its post-commit handoff.

1. **Scope dry-run.** Ensure the target task frontmatter has
   `bouncer.commit_intent` as **exactly two** Korean `~함` / `~임` strings for
   배경·의도 (task document only — no blueprint fallback). Prefer values
   written at plan time; if missing or not length 2, author them now from
   Goal & intent (no Epic/Blueprint ids, no file paths), then proceed.
   Dry-run first:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" commit --blueprint <pointer.blueprint>
   ```
   This checks every uncommitted change (tracked or untracked) against the
   task's `affected_paths` allowed-set. Anything out of scope is a **hard abort
   — nothing staged**; show the violations and have the user fix
   `affected_paths` or remove the stray files. On a clean dry-run (or empty
   staged set), keep the staged file list + generated commit message for the
   step-4 ACQ. (Empty staged set is fine — still continue; `--yes` will not
   create an empty commit.)

2. **Validate.** Run the commit gate — `validate --gate commit`:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate commit
   ```
   Gate `commit` re-checks G6/G7/G8 for the pointer task and G17 (staged paths
   inside `affected_paths`). Fix and re-run until it passes.

3. **Status before commit.** Set the pointer task documents to the statuses the
   execute gate already required (`tasks → verified`, `verification → passed`,
   `review → accepted` or `required: false`) if any are still open from the
   execute handoff. Do not invent new status names.

4. **Commit (deterministic core).** Show the dry-run staged list + generated
   commit message, then run this **ACQ** before `--yes`:

   **AskUserQuestion — Commit**
   1. **Re-ground**: 이 task 변경을 `bouncer commit --yes`로 커밋할지.
   2. **Recommend-why**: execute가 이미 검증·리뷰를 끝냈고 commit 게이트도
      통과했으므로, 범위를 다시 열어 두지 않고 지금 닫는 편이 다음 task로
      빨리 넘어가게 함.
   3. **Options**:
      - A) `commit --yes` 실행 (Recommended)
      - B) 메시지/스테이징 수정 후 재확인
      - C) 취소 — `--yes` 하지 않음

   On **A**, commit:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" commit --blueprint <pointer.blueprint> --yes
   ```
   On **B**, fix and re-dry-run from step 1. On **C**, stop without `--yes`.
   The CLI does **not** move the pointer — `nextTask` in the JSON is a candidate
   only.

5. **Next-task handoff.** After a successful step 4 (including empty staged set
   with `committed: false`), offer to advance the active pointer with an **ACQ**
   — use the commit payload's `nextTask` as required by `rules/current-pointer.md`.
   This direct invocation keeps the shared confirm-then-set rule.

   If `nextTask` is non-null, show the candidate task id and path
   (`tasks/<NNN>/tasks.md`).

   **AskUserQuestion — Next task**
   1. **Re-ground**: 같은 blueprint의 다음 열린 task로 포인터를 옮길지.
   2. **Recommend-why**: 한 PR(blueprint) 안에 다음 커밋 단위가 남아 있으면
      `/bouncer-execute`로 이어서 닫는 편이 흐름이 짧음.
   3. **Options**:
      - A) `bouncer current --set <blueprint> --task <NNN>` (Recommended)
      - B) 포인터만 보고 — `--set` 하지 않음
      - C) 남은 task 없이 `/bouncer-finalize`로 (when `nextTask` is null, make
        this the recommended proceed)

   - If A, run:
     ```bash
     BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
     node "${BOUNCER_ROOT}/scripts/bouncer" current --set <pointer.blueprint> --task <NNN>
     ```
     Then point the user at `/bouncer-execute` for the next task (same worktree).
   - If `nextTask` is `null`, skip A and recommend `/bouncer-finalize` instead.
   - If B/C leave the pointer as-is (or only report), say so plainly.

6. **Report.** Lead with the outcome, then the detail: whether a commit was
   created (or empty staged set), the commit subject, whether the pointer moved
   to the next task or the user should run `/bouncer-finalize`. Keep it to those
   facts — no recap of the steps the user just watched run.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-commit` is not consent for commit or pointer advance.

**Gates in this skill:** Commit (step 4) · Next task (step 5).
