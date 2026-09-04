---
name: explain-diff
description: "Use from /bouncer-finalize after scaffold explain to author explain.md and the quiz; it is not a workflow entry point."
---

# Explain Diff

**Plugin-root shell contract.** See `rules/plugin-root.md`; the CLI shell in this skill resolves independently.

Author and record comprehension for the active blueprint's `explain.md`.
Called only from `/bouncer-finalize` after `scaffold explain`. This skill does
**not** replace `scaffold explain` — if the file is missing, stop and tell the
caller to scaffold first.

`rules/acq.md` governs confirmation display, but the quiz collects one batch of
answers and is **not an ACQ**.

## When this applies

From `/bouncer-finalize` after scaffold explain. Authors BP `explain.md`
sections, runs the quiz for pointer-base..HEAD, writes one
`bouncer.comprehension` blueprint entry with required `quiz_score`, and sets
status published. Not a workflow entry point.

## Steps

1. **Author the five sections.** Fill the body under these headings in
   **Korean** (paths, ids, and code fences stay as-is; scaffold leaves
   comment-only stubs — replace with real prose). Cover the whole blueprint
   branch (all committed tasks), not a single task:
   - `## Background` — why this change exists
   - `## Intuition` — one-line picture / analogy
   - `## Code` — key paths and files to read (no long dumps)
   - `## Quiz` — questions and three answer options each (no correct
     answers, no user responses)
   - `## 이해 상태` — **one block** (no per-task subheadings): correct
     answers, user responses, right/wrong, and disposition (keep in sync with
     the single comprehension entry below)
   Then apply `stop-slop` (`references/stop-slop/index.md`) (advisory) before the
   quiz — strip filler and formulaic closers from the five sections.

2. **Resolve `range_from`.** Always the pointer `base` from `bouncer current`
   (else `.bouncer/config.json` `base_branch`). Do **not** chain from a prior
   entry's `range_to` — comprehension is one blueprint entry, not a task chain.

3. **Quiz the user.** Adapt and run the quiz from the `range_from..HEAD` diff
   (agent judgment — no mechanical table). The quiz is **required** — if the
   user does not answer, stop and tell `/bouncer-finalize` to abort (do not
   invent a skip path or leave `quiz_score` empty):
   1. Choose question count in **1–10** (minimum 1; never 0). State the
      count and a one-line rationale (diff scale) before asking.
      **경량 예외.** blueprint `index.md`의 `bouncer.scale`이 `light`면 질문 수를
      1로 고정한다(1문항) — 1–10 판단을 건너뛴다. 이 경우 `quiz_score`는
      `N/1`이 된다.
   2. Each question has **three answer options**. Vary the correct-answer
      position across questions — do not park every key on the same slot
      (한 위치에 몰지 않는다). No RNG required.
   3. Present **all questions at once** (한 번에 제시). Collect **all
      responses at once** (한 번에 응답). Do not run ACQ per question.
   4. Score answers. `quiz_score` is `N/M` where **M is the number of
      questions actually asked** and unanswered items are excluded from the
      denominator (e.g. asked 5, answered 4 with 3 correct → `3/4`; light path
      → `N/1`). `quiz_score` is **required** and must stay non-empty.
   5. Write correct answers, responses, and right/wrong under
      `## 이해 상태` only — never into `## Quiz`. Keep that section a
      **single block** (단일 블록) — no `### task NNN` or similar per-task
      headings.

   A low score is fine: **기록만 하고 마감을 막지 않는다.** Do not invent a
   pass threshold or force a re-take. Unanswered quiz (user refused) **does**
   block finalize — that is the abort path above, not a recorded skip.

   **Re-hash without re-quiz.** If a comprehension entry already exists and
   later commits only drifted `diff_sha` / section prose, refresh the body and
   `diff_sha` (and `range_to`) — do **not** re-run the quiz.

4. **Compute `diff_sha`.** Pass the entry's `range_from` as `base` to
   `computeDiffSha`. Run from the **execute worktree root** (`cwd` = that
   worktree):

   ```bash
   node -e 'const { computeDiffSha } = require(process.argv[1] + "/scripts/lib/comprehension");
   console.log(JSON.stringify(computeDiffSha({ repoRoot: process.cwd(), base: process.argv[2] })));' \
     "$(bouncer project-root)" <range_from>
   ```

   If the JSON has `ok: false`, report the `reason` and **stop** — do not invent
   a hash.

5. **Write one `bouncer.comprehension` entry.** Read `range_to` as the current
   `HEAD` sha (`git rev-parse HEAD`). Keep the list at **exactly one** blueprint
   entry — replace the sole item if refreshing, do **not** append a second
   entry, and do **not** set a `task` field:

   ```yaml
   - range_from: <pointer base from step 2>
     range_to: <HEAD sha>
     diff_sha: <sha from step 4>
     quiz_score: 'N/M'
     disposition: <non-empty free-text>
     recorded_at: <ISO-8601, prefer KST offset>
   ```

   Mirror the outcome under `## 이해 상태` so the body matches the record.

6. **Publish.** Set `bouncer.status → published` on `explain.md` if it is not
   already. Distill promotion stays with `spec-authoring` at
   `/bouncer-finalize` (before this skill) — do not promote here.

## Preserved task context

`/bouncer-finalize` may add an optional `## Tasks` section immediately before
deleting task documents. It writes one `### Task NNN` subsection per task and
copies only the authored `Goal & intent`, `Interface`, and `Do not touch`
sections. The copied bodies retain the author's semantic line breaks; do not
split or reflow sentences by punctuation. Verification, review, and checklist
content are transient evidence and are not copied. The section is optional and
its absence does not make G16 fail.

## Guardrails

- No new CLI, quiz engine, or HTML UI — Node stdlib + `computeDiffSha` only.
- Do not edit `scripts/lib/comprehension` or gate logic; call the existing API.
- Do not block finalize on score. G16 checks the record and hash match for the
  blueprint entry, not the grade. An unanswered quiz still aborts the caller.

## Return

Report that `explain.md` sections were authored, the quiz outcome
(`quiz_score`), and the single comprehension entry / published status. Do not
invent a skip path or empty `quiz_score`.
