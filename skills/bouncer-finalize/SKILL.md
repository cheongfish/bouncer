---
name: bouncer-finalize
description: "Use only when the user explicitly asks to finalize the active Bouncer blueprint (for example /bouncer-finalize). Distill, validate, commit the remainder, then push and open a draft PR (skipped gracefully with no remote)."
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
(byte-identical `AGENTS.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Close out the active blueprint. Follow this sequence.

**Preflight.** Load the active blueprint from `.bouncer/current`:
```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
node -e "console.log(JSON.stringify(require('${BOUNCER_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
```
If it is `null`, stop and tell the user to run `/bouncer-plan` first.

Read `.bouncer/current` and use its `blueprint` value verbatim wherever
`<pointer.blueprint>` appears; do not reconstruct a root `context/` path.

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

3. **Commit the remainder (deterministic core).** Dry-run first:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
   show the violations and have the user fix `affected_paths` or remove the stray
   files. On a clean dry-run, show the staged file list + generated commit
   message and ask for confirmation, then commit:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint> --yes
   ```
   (If there is nothing left to commit because execute already committed
   everything, `finalize` reports an empty staged set — that is fine.)

4. **Push + draft PR (markdown layer).** This is outward-facing — confirm first.
   - If there is no git remote or `gh` is not installed, **skip gracefully**:
     stop after the local commit and tell the user push/PR was skipped. Worktree
     cleanup and merge are the user's responsibility.
   - Otherwise push the branch and open a **draft** PR using `.bouncer/config.json`
     `base_branch`/`pr` and the built-in PR body from
     `scripts/lib/templates.js` (`pr.md`). That template follows the team's PR
     format, not the commit message shape; fill its sections from the blueprint
     and tasks documents and leave the `## 🚦 Bouncer` section for the
     epic/blueprint ids and the distill path:
     ```bash
     git push -u origin bouncer/<BP-id>-<slug>
     gh pr create --draft --base <config.base_branch> \
       --title "<type>(<bp-id>): <summary>" \
       --body-file <rendered pr body> \
       <labels from config.pr.labels as --label ...>
     ```
     Show the rendered PR body first (dry-run) and create it only on
     confirmation.

5. **Report.** Summarize what was committed, and the PR URL (or that push/PR was
   skipped).
