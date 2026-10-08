When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference.

**Plugin-root shell contract.** See `${BOUNCER_ROOT}/rules/plugin-root.md`. Apply the shared
model and host-fallback order in [`${BOUNCER_ROOT}/rules/subagent-model.md`](../../../rules/subagent-model.md).

Before approval, judge the plan documents. The `context-review` skill (`${BOUNCER_ROOT}/references/context-review/index.md`) is the behavioral brief. Dispatch **`bouncer-context-reviewer`** (plugin `${BOUNCER_ROOT}/agents/bouncer-context-reviewer.md`) with the resolved model. Compose each prompt inline (no `assets/` template — the paths are already known). Ask for a Findings list only.

1. **Freeze the snapshot** — After `affected_paths` confirmation, stop editing
   the documents under judgment. Run `bouncer review-dispatch plan --blueprint
   <dir>` and record its `target.digest` as the frozen snapshot digest; never
   compute it by hand. The record format (rounds, findings, enums) is printed
   by `bouncer review-dispatch --help`.
2. **Discovery** — Run `bouncer review-dispatch plan --blueprint <dir>` on the
   frozen blueprint. That CLI result is the only dispatch authority: do not
   merge, split, combine, or divide its clusters, and do not add an extra
   perspective to a `single` result. When the payload is `ok: false`, or when
   its `target.digest` / document set disagrees with the frozen snapshot,
   stop — do not call a reviewer and do not mark `context-review` accepted.
   On `plan draft validation failed`, show the `failures` to the user and
   return to `/bouncer-plan` step 3 **Author**; after the fix, restart from
   step 1 freeze.

   On `strategy: single`, dispatch one `bouncer-context-reviewer` call with
   perspective `combined` (all four rubrics). On `strategy: clustered`,
   dispatch one `local` call per CLI cluster in that same cluster-id order,
   then one `global` call. Record round 1 perspectives in that CLI dispatch
   order (`combined`, or each `local` then `global`). Each named call uses
   `fork_turns: "none"` (exclude full conversation history) and receives only
   this controller input allowlist: `mode: discovery`, its one perspective,
   the frozen digest, the document list for that call (combined/global: the
   full judged epic · blueprint · task set; each `local`: only that cluster's
   task documents — never another cluster's docs), the cluster id when
   perspective is `local`, and the read-only cwd. Do not pass the full
   conversation, another call's findings, the full ledger, or documents
   outside that judged set. Do not share or pass findings between local
   calls, or between local and global. Every discovery `target_digest` equals
   the frozen digest.
3. **Merge** — Verify each finding's evidence. Record `category`,
   `brief_clause`, `file`, `symbol`, and the fingerprint
   `context:<category>:<brief_clause>:<file>#<symbol>` (for example
   `fingerprint: context:scope:blueprint success criteria:.bouncer/context/epics/014-auth/blueprints/001-signup/index.md#success-criteria`);
   merge findings with the
   same fingerprint into one; record `severity_changes`; set `origin:
   discovery`; and decide `actionability` (`must_fix` or `advisory`) from the
   plan and the evidence.
4. **Revise once** — As `/bouncer-plan` author, edit the plan documents once
   for all `must_fix` findings together. Record each `advisory` finding as
   `accepted` with a note instead of editing for it. When no `must_fix`
   exists, skip the revision and the delta; the round sequence stays
   `discovery`.
5. **Certify the delta** — After the revision, rerun `bouncer review-dispatch
   plan --blueprint <dir>` and copy the new `target.digest`.
   Dispatch one `bouncer-context-reviewer` call in mode `delta` with
   `fork_turns: "none"` (exclude full conversation history) and only this
   controller input allowlist: the new digest, previous findings, the actual
   modified document list from the revision (revised documents only — never
   the full ledger or documents out of judgment), and the read-only cwd — not
   another discovery pass and not a second strategy-shaped fan-out. Delta
   runs once regardless of `single` or `clustered` and of cluster count.
   Record round 2 as `mode: delta` with the new digest. Accept a new delta
   finding only when it is `introduced_by_revision` with a revised passage as
   evidence, or `missed_critical` with `blocker` or `major` severity; its
   `first_seen_round` is 2. Update `last_seen_round` on returning findings.
6. **Close** — Delta runs once; context review has no third round and no
   critical recovery. Mark findings the delta certified as `resolved`. When a
   `must_fix` finding stays open after the delta, leave `context-review`
   unaccepted and bring the open finding to the user; only the user's
   accepted-risk note may record it `accepted`.

When the plan gate reports `context review is stale`, the recovery is not a
third round: replace `rounds[]` and `findings[]` with a new round 1 discovery
on the current digest (restart from step 1), then re-approve.

When Cursor print dispatch is opted in, run each step 2 call and the step 5
delta call as a print dispatch from `PROJECT_ROOT`. Per call, the controller
first writes that call's controller input allowlist (and nothing else) to
`<out>/input.md`, then runs:

```bash
# Run from PROJECT_ROOT. <call> is r1-combined | r1-local-<cluster id> | r1-global | r2-delta
bouncer dispatch print --role context-reviewer --cwd "$PROJECT_ROOT" \
  --input .bouncer/runtime/print/context-review/<call>/input.md \
  --out .bouncer/runtime/print/context-review/<call>
```

Use `r1-combined` for discovery `combined`, `r1-local-<cluster id>` (for
example `r1-local-c1`) for each `local`, `r1-global` for `global`, and
`r2-delta` for the delta; relative `--out` and `--input` resolve from
`PROJECT_ROOT`. The result `report` is that call's Findings. Only when the
result is `ok: false`, review that one call inline and record
`- inline context review: dispatch print failed (<reason>)` in
`## Findings`, where `<reason>` is the result `reason`. An inline review
without a `dispatch print` attempt is not allowed under print opt-in, and the
next paragraph applies only after `bouncer dispatch print` fails.

If named agents are unavailable, do **not** skip this step. Per call, use a
fresh generic read-only subagent whose payload carries the entire body of
`${BOUNCER_ROOT}/agents/bouncer-context-reviewer.md` — every section from Authority through
Output contract, verbatim — plus that call's controller input: mode, frozen
target (the digest and the document list it covers), perspective (discovery),
previous findings (delta), and the read-only cwd. Or run the
`context-review` skill inline once per call: the inline pass first reads
`${BOUNCER_ROOT}/agents/bouncer-context-reviewer.md` and follows every section with that
controller input before it judges. A role name or summary alone is not a
fallback payload.

As controller, update existing blueprint-root `context-review.md` body `## Findings`, `bouncer.context_review.findings[]`, and `bouncer.context_review.rounds[]` from the reviewer output — the subagent must not edit documents or flip status. An `accepted` finding requires a note. Only when every finding is `resolved` or `accepted` with a note, set `context-review → accepted`.

When recording finding `note` (and any other author-written frontmatter
scalar on that document), apply the same YAML leading-character quoting
rule as `spec-authoring` (`${BOUNCER_ROOT}/references/spec-authoring/index.md`
`## Author-written frontmatter scalars`): if the value starts with a YAML
reserved indicator such as a leading backtick, write it as a single-quoted
scalar or a block scalar (`>-` / `|`) — never as plain text after `- `. A mid-string
or Markdown-body backtick is out of scope for this rule.
