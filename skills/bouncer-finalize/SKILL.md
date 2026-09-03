---
name: bouncer-finalize
description: "Use only when the user explicitly asks /bouncer-finalize; it closes the active blueprint including Distill, explain, quiz, and PR handoff."
---
# /bouncer-finalize

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Pointer contract: `rules/current-pointer.md`.

Close out the active blueprint after every task has been committed via
`/bouncer-commit`. Follow this sequence. Do **not** run `bouncer commit` here —
task commits already landed on `/bouncer-commit`. Comprehension (explain + quiz)
runs in this skill, after the Distill promotion proposal has been handled.

**cwd 계약.** step 1의 Distill audit·승격 쓰기와 step 3의 `bouncer finalize`는
같은 checkout에서 이어진다. execute worktree가 있으면 그 안에서 실행한다.
승격 audit은 `--repo` 없이 돌리며, 그 cwd가 payload `repoRoot`다.
`--repo`만 빼고 cwd를 main worktree에 두면 base가 main으로 돌아간다.
step 5의 worktree 제거만 main worktree에서 한다. execute checkout 안에서
제거하지 않는다.

**Preflight.** Load the active blueprint:
```bash
BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
node "${BOUNCER_ROOT}/scripts/bouncer" current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Apply the shared returned-value contract. This workflow owns the finalize
outcome that clears the pointer and the post-cleanup next-blueprint handoff.

1. **Propose and promote Distill (one consent).** When proposing and promoting Distill, read this reference: [distill-promotion.md](references/distill-promotion.md). It directs the conditional `spec-authoring` handoff (`references/spec-authoring/index.md`); its result is either one consented promotion outcome or a reported mismatch that continues to step 2.

2. **Explain + quiz.** When authoring or refreshing explain and running the quiz, read this reference: [explain-quiz.md](references/explain-quiz.md). It directs `explain-diff` (`references/explain-diff/index.md`). If the user does not answer the quiz, **stop** — do not continue to validate or `finalize --yes`.

3. **Validate + remainder commit (deterministic core) + worktree choice.**
   Run the finalize gate first:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate finalize
   ```
   Gate `finalize` checks G16 (every task `verified`, explain published with one
   blueprint comprehension entry whose `diff_sha` matches `range_from..HEAD`).
   Fix and re-run until it passes.

   **보존·정리 경계 (CLI 계약 안내).** 삭제의 실제 조건·허용 경로는
   `finalize --yes` CLI·검증 계약이 정한다 — 스킬이 목록을 다시 계산하거나
   파일을 지우지 않는다. G16을 통과한 뒤 `--yes`가 검증까지 성공하면, 같은
   remainder / 마감 커밋 안에서 일회성 문서만 지우고 Blueprint `index.md`를
   `closed`로 잠근다. 삭제 대상은 `tasks/<NNN>/tasks.md`,
   `tasks/<NNN>/review.md`, 그리고 있을 때만 `context-review.md`다. 보존 대상은
   각 task의 `verification.md`, Blueprint `explain.md`, `index.md`, Distill이다.
   G16 실패·verify 실패·dry-run·out-of-scope에서는 삭제와 `closed` 전이를
   수행하지 않으며 문서는 무변경이다. archive 보관, closed Blueprint 재개,
   과거 보존 문서의 소급 편집은 제안하지 않는다.

   Before dry-run, ensure at least one task document has `bouncer.commit_intent`
   as **exactly two** Korean `~함` / `~임` strings when you want 배경·의도 on
   any Distill remainder commit. Finalize scans every task in number order and
   uses the highest-numbered valid intent (no blueprint `commit_intent`). Prefer
   values written at plan time; if none are length 2, author them on the latest
   task from Goal & intent / explain (no Epic/Blueprint ids, no file paths),
   then proceed. Dry-run:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set (Distill promotion is always allowed). Anything out of scope
   is a **hard abort — nothing staged**; show the violations and have the user
   fix paths or remove the stray files. On a clean dry-run (or empty staged
   set), show the staged file list + generated commit message, then run this
   **ACQ** before `--yes`:

   **AskUserQuestion — Remainder commit + worktree**
   1. **Re-ground**: Distill 승격분 등 remainder를 `finalize --yes`로 커밋하고
      execute worktree를 정리할지.
   2. **Recommend-why**: task 커밋은 이미 `/bouncer-commit`이 끝냈고, 마감 후
      execute checkout은 보통 불필요하므로 커밋과 함께 worktree를 지우는 편이
      메인 트리로 빨리 돌아가게 함.
   3. **Options**:
      - A) `finalize --yes` 커밋 + execute worktree 제거 (Recommended)
      - B) `finalize --yes` 커밋만 — worktree 유지
      - C) 메시지/스테이징 수정 후 재확인
      - D) 취소 — `--yes` 하지 않음

   On **A** or **B**, commit:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint> --yes
   ```
   `--yes`는 스테이징 전에 검증 명령을 실행한다. Shared contract에 따라 pointer를
   clear한다. `reason: 'verify'` 실패는
   원인을 고쳐 다시 실행하는 것 외의 우회 경로가 없다.
   Remember the worktree choice for step 5 (`remove` on A, `keep` on B).
   On **C**, fix and re-dry-run. On **D**, stop without `--yes`.
   (Empty staged set is fine — still run the ACQ so worktree choice is explicit;
   `--yes` clears the pointer without creating an empty commit.)

4. **Push + draft PR (markdown layer).** When the user chooses to consider a draft PR, read this reference: [draft-pr.md](references/draft-pr.md). A missing remote or `gh` skips this branch gracefully; any accepted PR attempt returns to step 5.

5. **Worktree cleanup (from step 3 choice).** After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference: [cleanup-handoff.md](references/cleanup-handoff.md). Apply the remembered choice without re-asking.

6. **Next-blueprint handoff.** The same [cleanup-handoff.md](references/cleanup-handoff.md) reference handles this only after cleanup and only from the finalize payload; advancement remains confirm-then-`current --set`, never automatic.
   closed Blueprint는 종단이다 — 다시 열거나 task를 붙이지 않는다. 후속 작업은
   같은 Epic의 sibling Blueprint 또는 `/bouncer-plan`으로 새 Epic을 계획한다.
   `--set` 자격(next-only·draft 제외)은 finalize payload와 위 cleanup-handoff
   계약이 정한다 — 열린 형제에 임의로 `--set`하지 않는다.

7. **Report.** Lead with the outcome, then the detail: whether explain/quiz
   landed, whether a remainder commit landed (and whether 일회성 문서 삭제·축약
   레이아웃·`closed`가 CLI에 의해 적용됐는지), the PR URL (or that push/PR was
   skipped/declined), whether the worktree was removed or left in place,
   whether the active pointer was advanced to the next blueprint or left
   cleared, and that follow-up stays on sibling Blueprint / `/bouncer-plan`
   (보존 증적은 `explain.md`·`verification.md`; closed 재개·archive·소급 편집
   없음). Keep it to those facts — no recap of the steps the user just
   watched run.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-finalize` is not consent for remainder commit, PR, or pointer
advance.

**Gates in this skill:** Distill promotion proposal (step 1) · Remainder commit
+ worktree (step 3) · PR (step 4) · Next blueprint (step 6). Worktree removal
is **not** a separate gate — it is chosen in step 3. The supporting references
retain each gate's choices and stop conditions; they are not output templates.
