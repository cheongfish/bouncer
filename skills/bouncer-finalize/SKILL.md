---
name: bouncer-finalize
description: "Use only when the user explicitly asks to finalize the active Bouncer blueprint (for example /bouncer-finalize). Run explain-diff, promote Distill, validate, ACQ-confirm commit (recommended: --yes + remove worktree), then ACQ for draft PR and next-blueprint handoff (PR skipped gracefully with no remote)."
---
# /bouncer-finalize

**Plugin root.** Every shell block below opens with

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

because each block runs in a fresh shell — the assignment does not carry over,
so it is repeated rather than exported once. Resolution order:
`BOUNCER_HOME` (manual override) → `CLAUDE_PLUGIN_ROOT` (Claude Code, and Codex
compatibility) → `PLUGIN_ROOT` (Codex native). If none are set, `node` fails on
a path starting with `/scripts` — set `BOUNCER_HOME` to the directory that
contains `scripts/bouncer`.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Close out the active blueprint. Follow this sequence.

## ACQ (AskUserQuestion) gates

Human-facing confirmations in this skill are **ACQ** gates. Prefer the host
`AskUserQuestion` / `AskQuestion` UI when available; if the tool is missing,
render the same skeleton in chat and wait for an A/B/… reply. Do **not** treat
a bare `/bouncer-finalize` as consent for commit, PR, or pointer advance.

**Option order (strict):** recommended proceed first → revise → alternative →
cancel/stop last. Mark one `(Recommended)` when you have a clear preference and
put **Recommend-why** (1–2 Korean sentences, `~함`/`~임`) in the prompt body.

```markdown
**AskUserQuestion:**

1. **Re-ground**: {한 줄 — 무엇을 결정하는지}
2. **Recommend-why**: {왜 1번을 추천하는지}
3. **Options** (recommended-first):
   - A) {Proceed} (Recommended)
   - B) {Revise / alternative}
   - C) {Cancel}
```

**Gates in this skill:** Commit+worktree (step 3) · PR (step 4) · PR body
confirm (step 4, when opening) · Next blueprint (step 6, when `next.next`
exists). Worktree removal is **not** a separate gate — it is chosen in step 3.

**Preflight.** Load the active blueprint:
```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
node "${BOUNCER_ROOT}/scripts/bouncer" current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Use the returned `blueprint` value verbatim wherever `<pointer.blueprint>`
appears; do not reconstruct a root `context/` path.

1. **Explain.** Create BP `explain.md` if it is missing (plan scaffold omits it):
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold explain --blueprint <pointer.blueprint>
   ```
   Then use the `explain-diff` skill (`skills/explain-diff/SKILL.md`) to author
   the five sections, quiz the user, record `bouncer.comprehension`, and set
   `explain.md` `bouncer.status → published`.
   After that, use the `spec-authoring` skill (`skills/spec-authoring/SKILL.md`)
   to promote durable items from `explain.md` into
   `.bouncer/context/Distill.md` under `## Invariants` / `## Gotchas` /
   `## Decisions` (add, replace, or drop stale bullets). Decisions stay
   **current only** — no change-log append. Do **not** promote `## 이해 상태`,
   `## Quiz`, or comprehension fields into Distill — 이해 상태는 Distill로
   승격하지 않는다. Cycle retrospectives and next-BP ideas stay in the BP
   `explain.md` only.

2. **Validate.** Run the finalize gate — `validate --gate finalize`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate finalize
   ```
   Gate `finalize` checks G15 (explain sections, comprehension record, diff_sha).
   Fix and re-run until it passes.

3. **Commit the remainder (deterministic core) + worktree choice.** Before
   dry-run, ensure the blueprint frontmatter has `bouncer.commit_intent` as
   **exactly two** Korean `~함` / `~임` strings (배경·의도). Prefer values
   written at plan time; if missing or not length 2, author them now from
   Goal & intent / explain (no Epic/Blueprint ids, no file paths), then proceed.
   Dry-run first:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
   show the violations and have the user fix `affected_paths` or remove the stray
   files. On a clean dry-run (or empty staged set), show the staged file list +
   generated commit message, then run this **ACQ** before `--yes`:

   **AskUserQuestion — Commit + worktree**
   1. **Re-ground**: remainder 커밋(`finalize --yes`)과 execute worktree 정리 여부.
   2. **Recommend-why**: 마감 커밋 후 execute checkout은 보통 불필요하므로 커밋과
      함께 worktree를 지우는 편이 메인 트리로 빨리 돌아가게 함.
   3. **Options**:
      - A) `finalize --yes` 커밋 + execute worktree 제거 (Recommended)
      - B) `finalize --yes` 커밋만 — worktree 유지
      - C) 메시지/스테이징 수정 후 재확인
      - D) 취소 — `--yes` 하지 않음

   On **A** or **B**, commit:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint> --yes
   ```
   Remember the worktree choice for step 5 (`remove` on A, `keep` on B).
   On **C**, fix and re-dry-run. On **D**, stop without `--yes`.
   (Empty staged set is fine — still run the ACQ so worktree choice is explicit.)

4. **Push + draft PR (markdown layer).** **ACQ** whether to open a PR at all
   before any push or `gh pr create`. Do not assume yes from `/bouncer-finalize`
   or from the commit ACQ.

   **AskUserQuestion — Draft PR**
   1. **Re-ground**: 로컬 커밋 후 원격 draft PR 생성 여부.
   2. **Recommend-why**: remote/`gh`가 있으면 draft PR이 리뷰 시작이 가장 빠름
      (없으면 이 게이트에서 skip만 안내하고 옵션을 생략해도 됨).
   3. **Options**:
      - A) draft PR 열기 (Recommended when remote + `gh` usable)
      - B) PR 생략 — 로컬만
      - C) 취소 (stop further outward steps; still continue worktree step 5)

   - If the user picks omit/decline, skip push/PR, report the local commit, and
     continue at step 5 (apply the step-3 worktree choice).
   - If there is no git remote or `gh` is not installed, **skip gracefully**:
     stop after the local commit and tell the user push/PR was skipped — no PR
     ACQ needed beyond that notice.
   - If the user accepts and remote/`gh` are available, show the rendered
     title + PR body (dry-run) and run a **second ACQ** to confirm that content
     before create. Then push the branch and open a **draft** PR using
     `.bouncer/config.json` `base_branch`/`pr` and the built-in PR body from
     `scripts/lib/templates.js` (`pr.md`). That template follows the team's PR
     format, not the commit message shape. Fill the PR body from `explain.md`
     sections `## Background`, `## Intuition`, and `## Code` — do not author a
     separate PR narrative from blueprint/tasks alone, and do not copy
     `## 이해 상태` / Quiz / comprehension into the PR (이해 상태는 PR에
     옮기지 않는다). Leave the `## 🚦 Bouncer` section for the epic/blueprint
     ids and the Explain path.
   - **PR title** (not the commit subject). Build from the branch commits vs
     `config.base_branch` (or `config.pr.base`), not from free-form prose:
     - Pattern: `[YYMMDD] (→ MergeTarget) [Type/Type] 요약`
     - `YYMMDD` — today's date in **KST**
     - `MergeTarget` — base branch with leading capital (`main` → `Main`,
       `develop` → `Develop`); must match `--base`
     - `Type` — PascalCase from commit types on the branch (`feat` → `Feat`,
       `fix` → `Fix`, …). Multiple distinct types → join with `/`
       (`[Feat/Fix]`). Prefer `git log <base>..HEAD --format=%s` plus blueprint
       `bouncer.commit_type` when the log is sparse
     - `요약` — Korean noun-phrase that covers the commits (blueprint `title` is
       a good default when it already summarizes the branch)
     - Example: `[260803] (→ Develop) [Feat] 전역 Distill을 init·finalize 런타임에 연결`
     - Do **not** put Conventional-Commit subjects or Epic/Blueprint ids in the
       title (ids stay in the `## 🚦 Bouncer` body section)
     Push the execute branch as named at worktree creation
     (`<type>/<BP-id>-<slug>`, `<type>` = blueprint `bouncer.commit_type`,
     default `feat`):
     ```bash
     git push -u origin <type>/<BP-id>-<slug>
     gh pr create --draft --base <config.base_branch> \
       --title "[YYMMDD] (→ MergeTarget) [Type] 요약" \
       --body-file <rendered pr body> \
       <labels from config.pr.labels as --label ...>
     ```

5. **Worktree cleanup (from step 3 choice).** After step 4 (whether PR was
   created, declined, or skipped), apply the Commit+worktree ACQ result.
   Do **not** re-ask.
   - If step 3 chose **remove** (A): from the **main worktree** (not from inside
     the execute checkout), run
     `git worktree remove <repo>/.worktrees/<BP-id>` (add `--force` only after
     an explicit dirty-tree warning ACQ). Leave the feature branch on
     remote/local refs unless the user also asks to delete it — merge remains
     their responsibility.
   - If step 3 chose **keep** (B): leave the worktree in place and note its
     path in the report.

6. **Next blueprint handoff.** After worktree cleanup, if `next.next` is
   non-null, offer to advance the active pointer with an **ACQ** — do **not**
   recompute candidates yourself. Read `next` from the `finalize --yes` JSON
   output (or from the dry-run output when there was nothing left to commit and
   `--yes` was never run). If `next.next` is `null`, skip this step.
   - Show the candidate (`next.next.blueprint`, `next.next.sameEpic`,
     `next.remaining` length).
   - If `next.next.sharedPaths` is non-empty, warn that the next blueprint
     likely needs to branch from this commit (overlap) — do not block
     advancing.
   - If the execute worktree was left in place, warn that the shared pointer
     means that worktree's commit guard will start enforcing the *new*
     blueprint's `affected_paths`.

   **AskUserQuestion — Next blueprint**
   1. **Re-ground**: 다음 ready blueprint로 포인터를 옮길지.
   2. **Recommend-why**: 같은 epic 흐름이면 `--set`이 다음 plan/execute 진입을
      명확히 함 (overlap이 있으면 그 커밋에서 분기해야 함을 사유에 포함).
   3. **Options**:
      - A) `bouncer current --set <next.blueprint>` (Recommended when same epic /
        no blocking overlap surprise)
      - B) 포인터만 비움 — 명령만 보여 줌
      - C) 취소 — 포인터 상태 유지/비움만 보고

   - If yes / A, run:
     ```bash
     BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
     node "${BOUNCER_ROOT}/scripts/bouncer" current --set <next.blueprint>
     ```
     (`<next.blueprint>` is `next.next.blueprint` from the finalize payload.)
   - If B, show that same command only and leave the pointer cleared — do not
     run it.
   - If `current --set` refuses because the plan gate fails, report that and
     still treat finalize as successful — do not retry or bypass `--set`.

7. **Report.** Lead with the outcome, then the detail: what was committed, the
   PR URL (or that push/PR was skipped/declined), whether the worktree was
   removed or left in place, and whether the active pointer was advanced to the
   next blueprint or left cleared. Keep it to those facts — no recap of the
   steps the user just watched run.
