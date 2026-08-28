When the user chooses to consider a draft PR, read this reference.

Use `rules/acq.md` for the shared ACQ display and chat fallback; this reference
only defines the draft-PR choices and their consequences below.

ACQ before push or `gh pr create`: A) draft PR (recommended when remote and `gh` work), B) local only, C) cancel outward steps but continue cleanup. Decline skips push/PR. With no remote or no `gh`, skip gracefully after local finalize without PR ACQ. On acceptance, render title and body, then push and create a draft without a further confirmation; push/create failures report their reason without re-asking.

Use `.bouncer/config.json` `pr.draft` / `pr.base` (and `base_branch`) with
`scripts/lib/templates.js` (`pr.md`). Do not pass `pr.labels` or any `--label`
flag — leftover `pr.labels` in an existing config is ignored without error and
never attached. Title and push order stay the same; body follows the section
contract below.

### Title (unchanged)

Build `[YYMMDD] (→ MergeTarget) [Type/Type] 요약` from KST date, base-matching
capitalized target, branch commit types (fallback `bouncer.commit_type`), and
Korean summary. Do not put commit subjects or ids in the title.

### Body sections (fill then drop empties)

Render in this order. Drop a section entirely when it has nothing to say —
leave no empty heading or orphan bullet. Never invent issues, risks, passes, or
Mermaid nodes without evidence. Fill PR body from explain.md sections in the
table; do not rewrite Explain or invent a parallel narrative. Never copy Quiz,
`## 이해 상태`, comprehension scores, or `quiz_score` (이해 상태는 PR에
옮기지 않는다). Never emit Epic/Blueprint ids, a Bouncer meta section, or
Features/Fixes checkboxes.

| Section | Allowed sources only |
| --- | --- |
| `관련 이슈` | Linked tracker issues with real evidence; plus one Explain Markdown link. No issue → no issue bullet. |
| `배경 · 변경 의도` | Explain `## Background` and `## Intuition`, tightened against the diff. |
| `주요 변경 내용` | Explain `## Code`, plus branch diff and commits for concrete files/behaviors. |
| `로직 흐름` | Conditional Mermaid only (rules below). Omit the heading when skipped. |
| `리뷰 포인트` | Explain `## Code` + diff hot paths; blueprint failure modes / Out of scope; task Constraints / Do not touch; accepted review findings. No guessed risk. |
| `확인 방법` | Every task `verification.md` evidence in task-number order, then the successful final `finalize --yes` verify as the most recent result. Summarize as `명령 — 결과`; do not paste long stdout. Deduplicate same commands by keeping per-task outcomes visible. |

### Explain link

Put a real Markdown link under `관련 이슈`, for example
`Explain: [explain.md](<url>)`. The URL must open the Explain file on the
**pushed head branch** or the head **commit** (not a base-only path that 404s).
If head has Explain and base does not, still point at head. If no openable URL
can be built, omit the fake path — do not invent a link.

### Mermaid (`로직 흐름`)

Add Mermaid only when the diff or Explain shows a change in call order, control
flow, state transition, data-processing steps, or component responsibility.
Cap core nodes at about eight; add As-Is/To-Be only when both are needed.
Skip (and remove the `로직 흐름` title) when the change is docs/config/tests
only, a simple rename/move, or when a diagram would be denser than the code.

### Push + create

```bash
git push -u origin <type>/<BP-id>-<slug>
gh pr create --draft --base <config.base_branch> --title "[YYMMDD] (→ MergeTarget) [Type] 요약" --body-file <rendered pr body>
```

No `--label` arguments. `pr.labels` is not part of the create contract.
