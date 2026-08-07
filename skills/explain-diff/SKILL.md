---
name: explain-diff
description: "Use from /bouncer-commit after scaffold explain. Author BP explain.md sections, run the quiz for range_from..HEAD, append one bouncer.comprehension entry for the pointer task, and set status published. Not a workflow entry point."
---

# Explain Diff

Author and record comprehension for the active blueprint's `explain.md`.
Called only from `/bouncer-commit` after `scaffold explain` (create the file
if missing). This skill does **not** replace `scaffold explain` — if the file
is missing, stop and tell the caller to scaffold first.

## Steps

1. **Author the five sections.** Fill the body under these headings in
   **Korean** (paths, ids, and code fences stay as-is; scaffold leaves
   comment-only stubs — replace with real prose). On later tasks in the same
   blueprint, refresh the sections so they still cover the whole branch, but
   do **not** delete earlier comprehension entries:
   - `## Background` — why this change exists
   - `## Intuition` — one-line picture / analogy
   - `## Code` — key paths and files to read (no long dumps)
   - `## Quiz` — questions and three answer options each (no correct
     answers, no user responses)
   - `## 이해 상태` — correct answers, user responses, right/wrong, and
     disposition (keep in sync with the new entry below)
   Then apply `stop-slop` (`skills/stop-slop/SKILL.md`) (advisory) before the
   quiz — strip filler and formulaic closers from the five sections.

2. **Resolve `range_from` for this task entry.** Read existing
   `bouncer.comprehension` (must be a list — never a single object):
   - If the list is empty, `range_from` is the pointer `base` from
     `bouncer current` (else `.bouncer/config.json` `base_branch`).
   - If the list already has entries, `range_from` is the **last** entry's
     `range_to` (do not invent a different chain).
   Never rewrite an earlier entry to change its `range_from` / `diff_sha`.

3. **Quiz the user.** Adapt and run the quiz from the `range_from..HEAD` diff
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

4. **Compute `diff_sha`.** Pass the entry's `range_from` as `base` to
   `computeDiffSha`. Run from the **execute worktree root** (`cwd` = that
   worktree):

   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node -e 'const { computeDiffSha } = require(process.argv[1] + "/scripts/lib/comprehension");
   console.log(JSON.stringify(computeDiffSha({ repoRoot: process.cwd(), base: process.argv[2] })));' \
     "${BOUNCER_ROOT}" <range_from>
   ```

   If the JSON has `ok: false`, report the `reason` and **stop** — do not invent
   a hash.

5. **Append one `bouncer.comprehension` entry.** Resolve the pointer task
   number (`\d{3}`). Read `range_to` as the current `HEAD` sha
   (`git rev-parse HEAD`). **Append** a new list item — do **not** overwrite,
   edit in place, or replace earlier entries, and do not add a second entry
   for the same task number:

   ```yaml
   - task: '<NNN>'
     range_from: <sha or base ref from step 2>
     range_to: <HEAD sha>
     diff_sha: <sha from step 4>
     quiz_score: 'N/M'
     disposition: <non-empty free-text>
     recorded_at: <ISO-8601, prefer KST offset>
   ```

   Mirror the outcome under `## 이해 상태` so the body matches the new record.

6. **Publish.** Set `bouncer.status → published` on `explain.md` if it is not
   already. Distill promotion stays with `spec-authoring` at
   `/bouncer-finalize` — do not promote here.

## Guardrails

- No new CLI, quiz engine, or HTML UI — Node stdlib + `computeDiffSha` only.
- Do not edit `scripts/lib/comprehension` or gate logic; call the existing API.
- Do not block the commit step on score. G15 checks the record and hash match
  for this task entry, not the grade.
