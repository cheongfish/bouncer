When the user chooses to consider a draft PR, read this reference.

Use `${BOUNCER_ROOT}/rules/acq.md` for the shared ACQ display and chat fallback; this reference
only defines the draft-PR choices and their consequences below.

ACQ `finalize.pr` before push or `gh pr create`: A) draft PR (recommended when remote and `gh` work), B) local only, C) cancel outward steps but continue cleanup. Decline skips push/PR. With no remote or no `gh`, skip gracefully after local finalize without PR ACQ. On acceptance, render title and body from the prepare digest kept through `--yes`, then push and create a draft without a further confirmation; push/create failures report their reason without re-asking.

Use `.bouncer/config.json` `pr.draft` with `scripts/lib/templates.js` (`pr.md`).
PR base comes from the prepare digest (`pr.base`), not from re-reading config.
Do not pass `pr.labels` or any `--label` flag — leftover `pr.labels` in an
existing config is ignored without error and never attached. Title and push
order stay the same; body follows the section contract below.

### Title (unchanged)

Use digest `pr.title_prefix` plus one space and a Korean summary:
`<pr.title_prefix> <한국어 요약>`. Do not recompute the YYMMDD / MergeTarget /
Type prefix from commits or config — the digest already did. Do not put commit
subjects or ids in the title. When `pr.title_prefix` is `null`, fill
`pr.title_prefix_template` as described below instead of inventing a date or
type set.

### Body sections (fill then drop empties)

Render in this order. Drop a section entirely when it has nothing to say —
leave no empty heading or orphan bullet. Never invent issues, risks, passes, or
Mermaid nodes without evidence. Fill PR body from explain.md sections in the
table and from digest `pr.sections` for the deterministic facts; do not rewrite
Explain or invent a parallel narrative. Never copy Quiz or quiz results into the PR.
Never emit Epic/Blueprint ids, a Bouncer meta section, or Features/Fixes
checkboxes.

| Section | Allowed sources only |
| --- | --- |
| `관련 이슈` | Linked tracker issues with real evidence; plus one Explain Markdown link from `finalize links` (below). No issue → no issue bullet. Prefer `pr.sections.related` when it already lists facts. |
| `배경 · 변경 의도` | Explain `## Background` and `## Intuition`, tightened against the diff. |
| `주요 변경 내용` | Explain `## Code`, plus branch diff and commits for changed files, behavior, and interfaces only. Do not write task DAG, task split/order, repair wave, scope revision, worker·agent, branch·sha, integration head, or 작업 과정. |
| `로직 흐름` | Conditional Mermaid only (rules below). Omit the heading when skipped. |
| `리뷰 포인트` | Digest `pr.sections.review_points` first, then Explain `## Code` + diff hot paths only where the digest left a gap. No guessed risk. |
| `확인 방법` | Digest `pr.sections.verification` in task-number order, then the successful final `finalize --yes` verify as the most recent result. Summarize as `command — result`; do not paste long stdout. Deduplicate same commands by keeping per-task outcomes visible. Do not re-open task `verification.md` files. Reference verification and review through the digest `evidence` field (`evidence.verification[].evidence_id`, `evidence.review`). Do not open verification or review logs. |

### Explain link

After a successful push, run `bouncer finalize links --blueprint <pointer.blueprint>`
(see the push sequence below). Put a real Markdown link under `관련 이슈`, for
example `Explain: [explain.md](<url>)`, using `links[0]` (branch) when present.
If the payload reports a `reason` (or `links` is empty), omit the link — do not
invent a path. Prefer the branch URL over the commit permalink when both exist.

### Mermaid (`로직 흐름`)

Add Mermaid only when the diff or Explain shows a change in call order, control
flow, state transition, data-processing steps, or component responsibility.
Cap core nodes at about eight; add As-Is/To-Be only when both are needed.
Skip (and remove the `로직 흐름` title) when the change is docs/config/tests
only, a simple rename/move, or when a diagram would be denser than the code.

### Push + create

Read the finalize payload's top-level `branch` before running either command.
If `branch` is `null`, do not push or create a draft PR: report that the
checkout branch could not be resolved, then continue with the selected local
finalize/cleanup path. Do not reconstruct a branch name from blueprint data.

```bash
git push -u origin <finalize payload branch>
bouncer finalize links --blueprint <pointer.blueprint>
gh pr create --draft --base <pr.base> --title "<pr.title_prefix> <한국어 요약>" --body-file <rendered pr body>
```

`pr.base` is `null` when config and `origin/HEAD` did not yield a branch. After
the user picks A, ask for the base branch name as a follow-up — do not change
the A/B/C choices. If they give a name, capitalize its first letter and
substitute that for `{base}` in `pr.title_prefix_template` to form the title
prefix; pass the given name unchanged to `--base`. If they give no answer,
treat the choice as B (local only) and continue cleanup.

No `--label` arguments. `pr.labels` is not part of the create contract.
