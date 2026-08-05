---
name: explain-diff
description: "Use from /bouncer-finalize after scaffold explain. Author BP explain.md sections, run the quiz with the user, record bouncer.comprehension, and set status published. Not a workflow entry point."
---

# Explain Diff

Author and record comprehension for the active blueprint's `explain.md`.
Called only from `/bouncer-finalize` after `scaffold explain`. This skill does
**not** replace `scaffold explain` — if the file is missing, stop and tell the
caller to scaffold first.

## Steps

1. **Author the five sections.** Fill the body under these headings (scaffold
   leaves comment-only stubs; replace with real prose):
   - `## Background` — why this change exists
   - `## Intuition` — one-line picture / analogy
   - `## Code` — key paths and files to read (no long dumps)
   - `## Quiz` — understanding-check questions for the human
   - `## 이해 상태` — quiz outcome and disposition (keep in sync with
     frontmatter below)

2. **Quiz the user.** Present the Quiz questions, score the answers, and
   compute `quiz_score` as `N/M` (e.g. `3/5`). A low score is fine:
   **기록만 하고 마감을 막지 않는다.** Do not invent a pass threshold or force a
   re-take.

3. **Compute `diff_sha`.** Resolve `base` from `bouncer current` (`base`
   field); if absent, use `.bouncer/config.json` `base_branch`. Run from the
   **execute worktree root** (`cwd` = that worktree):

   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node -e 'const { computeDiffSha } = require(process.argv[1] + "/scripts/lib/comprehension");
   console.log(JSON.stringify(computeDiffSha({ repoRoot: process.cwd(), base: process.argv[2] })));' \
     "${BOUNCER_ROOT}" <base>
   ```

   If the JSON has `ok: false`, report the `reason` and **stop** — do not invent
   a hash.

4. **Record `bouncer.comprehension`.** Write all four fields on `explain.md`
   frontmatter:
   - `diff_sha` — `sha` from step 3
   - `quiz_score` — `N/M` from step 2
   - `disposition` — short free-text outcome (must be non-empty for G15)
   - `recorded_at` — ISO-8601 timestamp (prefer KST offset)

   Mirror the outcome under `## 이해 상태` so the body matches the record.

5. **Publish.** Set `bouncer.status → published` on `explain.md`. Distill
   promotion stays with `spec-authoring` (caller runs that next).

## Guardrails

- No new CLI, quiz engine, or HTML UI — Node stdlib + `computeDiffSha` only.
- Do not edit `scripts/lib/comprehension` or gate logic; call the existing API.
- Do not block finalize on score. G15 checks the record and hash match, not the
  grade.
