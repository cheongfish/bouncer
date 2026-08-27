When the user chooses to consider a draft PR, read this reference.

Use `rules/acq.md` for the shared ACQ display and chat fallback; this reference
only defines the draft-PR choices and their consequences below.

ACQ before push or `gh pr create`: A) draft PR (recommended when remote and `gh` work), B) local only, C) cancel outward steps but continue cleanup. Decline skips push/PR. With no remote or no `gh`, skip gracefully after local finalize without PR ACQ. On acceptance, render title and body, then push and create a draft without a further confirmation; push/create failures report their reason without re-asking.

Use `.bouncer/config.json` base/pr settings and `scripts/lib/templates.js` (`pr.md`), not commit-message shape. Fill PR body from explain.md `## Background`, `## Intuition`, and `## Code`; do not write a separate narrative or copy `## 이해 상태` / Quiz / comprehension (이해 상태는 PR에 옮기지 않는다). Keep ids and Explain path in `## 🚦 Bouncer`. Build `[YYMMDD] (→ MergeTarget) [Type/Type] 요약` from KST date, base-matching capitalized target, branch commit types (fallback `bouncer.commit_type`), and Korean summary. Do not put commit subjects or ids in the title. Push `<type>/<BP-id>-<slug>` then:
```bash
git push -u origin <type>/<BP-id>-<slug>
gh pr create --draft --base <config.base_branch> --title "[YYMMDD] (→ MergeTarget) [Type] 요약" --body-file <rendered pr body> <labels from config.pr.labels as --label ...>
```
