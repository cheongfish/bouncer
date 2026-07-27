---
description: Finalize the active Bouncer blueprint — distill, validate, commit the remainder, then push and open a draft PR (skipped gracefully with no remote).
---

# /bouncer-finalize

Close out the active blueprint. Follow this sequence.
Read `.bouncer/current` and use its `blueprint` value verbatim wherever
`<pointer.blueprint>` appears; do not reconstruct a root `context/` path.

1. **Distill.** Use the `spec-authoring` skill to write `distill.md` (durable
   learnings), then set `distill.md` `bouncer.status → published`.

2. **Validate.** Run the finalize gate — `validate --gate finalize`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate finalize
   ```
   Gate `finalize` checks G9 `distill.status == published`. Fix and re-run until
   it passes.

3. **Commit the remainder (deterministic core).** Dry-run first:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
   show the violations and have the user fix `affected_paths` or remove the stray
   files. On a clean dry-run, show the staged file list + generated commit
   message and ask for confirmation, then commit:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" finalize --blueprint <pointer.blueprint> --yes
   ```
   (If there is nothing left to commit because execute already committed
   everything, `finalize` reports an empty staged set — that is fine.)

4. **Push + draft PR (markdown layer).** This is outward-facing — confirm first.
   - If there is no git remote or `gh` is not installed, **skip gracefully**:
     stop after the local commit and tell the user push/PR was skipped. Worktree
     cleanup and merge are the user's responsibility.
   - Otherwise push the branch and open a **draft** PR using `.bouncer/config.json`
     `base_branch`/`pr` and `.bouncer/templates/pr.md`. That template follows the
     team's PR format, not the commit message shape; fill its sections from the
     blueprint and tasks documents and leave the `## 🚦 Bouncer` section for the
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
