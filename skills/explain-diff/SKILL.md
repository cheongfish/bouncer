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

1. **Author the five sections.** Fill the body under these headings in
   **Korean** (paths, ids, and code fences stay as-is; scaffold leaves
   comment-only stubs — replace with real prose):
   - `## Background` — why this change exists
   - `## Intuition` — one-line picture / analogy
   - `## Code` — key paths and files to read (no long dumps)
   - `## Quiz` — questions and three answer options each (no correct
     answers, no user responses)
   - `## 이해 상태` — correct answers, user responses, right/wrong, and
     disposition (keep in sync with frontmatter below)
   Then apply `stop-slop` (`skills/stop-slop/SKILL.md`) (advisory) before the
   quiz — strip filler and formulaic closers from the five sections.

2. **Quiz the user.** Adapt and run the quiz from the `base..HEAD` diff
   (agent judgment — no mechanical table):
   1. Choose question count in **1–10** (minimum 1; never 0). State the
      count and a one-line rationale (diff scale) before asking.
   2. Each question has **three answer options**. Vary the correct-answer
      position across questions — do not park every key on the same slot
      (한 위치에 몰지 않는다). No RNG required.
   3. Present **all questions at once** (한 번에 제시). Collect **all
      responses at once** (한 번에 응답). Do not run ACQ per question.
   4. Score answers. `quiz_score` is `N/M` where **M is the number of
      questions actually asked** and unanswered items are excluded from the
      denominator (e.g. asked 5, answered 4 with 3 correct → `3/4`).
   5. Write correct answers, responses, and right/wrong under
      `## 이해 상태` only — never into `## Quiz`.
   6. If the quiz was skipped, do not set `quiz_score` to `0/0`; put the
      skip reason in `disposition` (must stay non-empty for G15).

   A low score is fine: **기록만 하고 마감을 막지 않는다.** Do not invent a
   pass threshold or force a re-take.

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
