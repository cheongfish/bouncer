When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference.

**Plugin-root shell contract.** See `rules/plugin-root.md`. Apply the shared
model and host-fallback order in [`rules/subagent-model.md`](../../../rules/subagent-model.md).

Before approval, judge the plan documents. The `context-review` skill (`references/context-review/index.md`) is the behavioral brief. Dispatch **`bouncer-context-reviewer`** (plugin `agents/bouncer-context-reviewer.md`) with the resolved model. Compose each prompt inline (no `assets/` template — the paths are already known). Ask for a Findings list only.

1. **Freeze the snapshot** — After `affected_paths` confirmation, stop editing
   the documents under judgment. Compute the target digest as the sha256 of
   their bodies with frontmatter removed, concatenated in this order: the
   epic `index.md`, the blueprint `index.md`, then every
   `tasks/<NNN>/tasks.md` under the blueprint in ascending task number.
2. **Discovery** — Dispatch four `bouncer-context-reviewer` calls in parallel,
   one per perspective: `cross_document`, `scope`, `korean_quality`, and
   `success_criteria`. Each call gets mode `discovery`, its one perspective,
   the digest, and the documents above. Do not pass one call's findings to
   another. Record round 1 as `mode: discovery`, `target: { digest }`, and
   `perspectives: [{ name, target_digest }]`, each `target_digest` equal to the
   digest.
3. **Merge** — Verify each finding's evidence. Record `category`,
   `brief_clause`, `file`, `symbol`, and the fingerprint
   `context:<category>:<brief_clause>:<file>#<symbol>`; merge findings with the
   same fingerprint into one; record `severity_changes`; set `origin:
   discovery`; and decide `actionability` (`must_fix` or `advisory`) from the
   plan and the evidence.
4. **Revise once** — As `/bouncer-plan` author, edit the plan documents once
   for all `must_fix` findings together. Record each `advisory` finding as
   `accepted` with a note instead of editing for it. When no `must_fix`
   exists, skip the revision and the delta; the round sequence stays
   `discovery`.
5. **Certify the delta** — Recompute the digest over the revised snapshot.
   Dispatch one `bouncer-context-reviewer` call in mode `delta` with the
   previous findings and the revised documents only — not another
   four-perspective pass. Record round 2 as `mode: delta` with the new digest.
   Accept a new delta finding only when it is `introduced_by_revision` with a
   revised passage as evidence, or `missed_critical` with `blocker` or `major`
   severity; its `first_seen_round` is 2. Update `last_seen_round` on returning
   findings.
6. **Close** — Delta runs once; context review has no third round and no
   critical recovery. Mark findings the delta certified as `resolved`. When a
   `must_fix` finding stays open after the delta, leave `context-review`
   unaccepted and bring the open finding to the user; only the user's
   accepted-risk note may record it `accepted`.

If named agents are unavailable, run the `context-review` skill inline once
per call (or use a fresh generic read-only subagent with the same brief). Do
**not** skip this step.

As controller, update existing blueprint-root `context-review.md` body `## Findings`, `bouncer.context_review.findings[]`, and `bouncer.context_review.rounds[]` from the reviewer output — the subagent must not edit documents or flip status. An `accepted` finding requires a note. Only when every finding is `resolved` or `accepted` with a note, set `context-review → accepted`.

When recording finding `note` (and any other author-written frontmatter
scalar on that document), apply the same YAML leading-character quoting
rule as `spec-authoring` (`references/spec-authoring/index.md`
`## Author-written frontmatter scalars`): if the value starts with a YAML
reserved indicator such as a leading backtick, write it as a single-quoted
scalar or a block scalar (`>-` / `|`) — never as plain text after `- `. A mid-string
or Markdown-body backtick is out of scope for this rule.
