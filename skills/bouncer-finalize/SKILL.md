---
name: bouncer-finalize
description: "Use only when the user explicitly asks to finalize the active Bouncer blueprint (for example /bouncer-finalize). Distill, validate, commit the remainder, then ask whether to push a draft PR and whether to remove the execute worktree (PR skipped gracefully with no remote)."
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

**Preflight.** Load the active blueprint:
```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
node "${BOUNCER_ROOT}/scripts/bouncer" current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Use the returned `blueprint` value verbatim wherever `<pointer.blueprint>`
appears; do not reconstruct a root `context/` path.

1. **Distill.** Create BP `distill.md` if it is missing (plan scaffold omits it):
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold distill --blueprint <pointer.blueprint>
   ```
   Then use the `spec-authoring` skill (`skills/spec-authoring/SKILL.md`) to:
   - Write this blueprint's `distill.md` (cycle candidates + durable notes), then
     set `distill.md` `bouncer.status → published`.
   - Promote durable items into `.bouncer/context/Distill.md` under
     `## Invariants` / `## Gotchas` / `## Decisions` (add, replace, or drop
     stale bullets). Decisions stay **current only** — no change-log append.
     Cycle retrospectives and next-BP ideas stay in the BP `distill.md` only.

2. **Validate.** Run the finalize gate — `validate --gate finalize`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate finalize
   ```
   Gate `finalize` checks G9 `distill.status == published`. Fix and re-run until
   it passes.

3. **Commit the remainder (deterministic core).** Before dry-run, ensure the
   blueprint frontmatter has `bouncer.commit_intent` as **exactly two** Korean
   `~함` / `~임` strings (배경·의도). Prefer values written at plan time; if
   missing or not length 2, author them now from Goal & intent / distill (no
   Epic/Blueprint ids, no file paths), then proceed.
   Dry-run first:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
   show the violations and have the user fix `affected_paths` or remove the stray
   files. On a clean dry-run, show the staged file list + generated commit
   message (subject + 의도 2줄 + tasks/verification titles) and ask for
   confirmation, then commit:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint> --yes
   ```
   (If there is nothing left to commit because execute already committed
   everything, `finalize` reports an empty staged set — that is fine.)

4. **Push + draft PR (markdown layer).** Outward-facing — **ask the user
   whether to open a PR at all** before any push or `gh pr create`. Do not
   assume yes from `/bouncer-finalize` alone.
   - If the user declines, skip push/PR, report the local commit, and continue
     at step 5 (worktree cleanup ask still applies).
   - If there is no git remote or `gh` is not installed, **skip gracefully**:
     stop after the local commit and tell the user push/PR was skipped.
   - If the user accepts and remote/`gh` are available, show the rendered
     title + PR body (dry-run) and create only on a second confirmation of that
     content. Then push the branch and open a **draft** PR using
     `.bouncer/config.json` `base_branch`/`pr` and the built-in PR body from
     `scripts/lib/templates.js` (`pr.md`). That template follows the team's PR
     format, not the commit message shape; fill its sections from the blueprint
     and tasks documents and leave the `## 🚦 Bouncer` section for the
     epic/blueprint ids and the distill path.
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

5. **Worktree cleanup.** After step 4 (whether PR was created, declined, or
   skipped), **ask the user whether to remove the execute worktree** at
   `<repo>/.worktrees/<BP-id>`. Do not remove it without an explicit yes.
   - If yes, run cleanup from the **main worktree** (not from inside the
     execute checkout): `git worktree remove <repo>/.worktrees/<BP-id>` (add
     `--force` only if the user agrees after a dirty-tree warning). Leave the
     feature branch on the remote/local refs unless the user also asks to
     delete it — merge remains their responsibility.
   - If no, leave the worktree in place and note its path in the report.

6. **Report.** Lead with the outcome, then the detail: what was committed, the
   PR URL (or that push/PR was skipped/declined), and whether the worktree was
   removed or left in place. Keep it to those facts — no recap of the steps the
   user just watched run.
