When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference.

**Plugin-root shell contract.** See `${BOUNCER_ROOT}/rules/plugin-root.md`. Apply the shared
model and host-fallback order in [`${BOUNCER_ROOT}/rules/subagent-model.md`](../../../rules/subagent-model.md).

Before approval, judge the plan documents. The `context-review` skill (`${BOUNCER_ROOT}/references/context-review/index.md`) is the behavioral brief. Dispatch **`bouncer-context-reviewer`** (plugin `${BOUNCER_ROOT}/agents/bouncer-context-reviewer.md`) with the resolved model. Compose each prompt inline (no `assets/` template — the paths are already known). Ask for a Findings list only.

1. **Freeze the snapshot** — After `affected_paths` confirmation, stop editing
   the documents under judgment. Run `bouncer review-dispatch plan --blueprint
   <dir>` once and save its JSON to a file (the retained payload); its
   `target.digest` is the frozen snapshot digest — never compute it by hand.
   This first call is allowed without `--previous` only while the blueprint
   has no review evidence. The record format (rounds, findings, enums) is
   printed by `bouncer review-dispatch --help`.
2. **Discovery** — Use the retained payload from step 1 as the dispatch; do
   not classify a second time. Then run `bouncer context-review start
   --blueprint <dir> --dispatch <payload.json>` before any reviewer call (a
   repeated start returns the same cycle and resets nothing). That CLI result
   is the only dispatch authority: do not
   merge, split, combine, or divide its clusters, and do not add an extra
   perspective to a `single` result. When the payload is `ok: false`, or when
   its `target.digest` / document set disagrees with the frozen snapshot,
   or `start` is rejected, stop — do not call a reviewer and do not mark
   `context-review` accepted. A `previous-payload-required`,
   `previous-payload-invalid`, or `previous-payload-stale` rejection means the
   input is unreliable, not that the blueprint is new: recover the stored
   `latest_dispatch` payload and pass it as `--previous`; show the user the
   reason, cause, and next, and stop on a repeated failure.
   On `plan draft validation failed`, show the `failures` to the user and
   return to `/bouncer-plan` step 3 **Author**; after the fix, restart from
   step 1 freeze.

   On `strategy: single`, dispatch one `bouncer-context-reviewer` call with
   perspective `combined` (both rubrics). On `strategy: clustered`,
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
   **Metrics.** Around every reviewer call (discovery and delta) record it:
   `bouncer metrics start --kind context-review --blueprint <dir> --label <perspective> --target-digest <call target_digest>`
   just before dispatch, then `bouncer metrics end --id <id> --tokens <subagent_tokens> --host-duration-ms <duration_ms>`
   from the host's final task notification once the reviewer's hand-back report has arrived, per item 6 of `${BOUNCER_ROOT}/rules/subagent-model.md` (omit flags the host did not give).
   Procedure and rules: `${BOUNCER_ROOT}/skills/bouncer-run/references/drive-metrics.md`. A failed `metrics` call
   never changes the review result.
3. **Merge** — Verify each finding's evidence. Record `category`,
   `brief_clause`, `file`, `symbol`, and the fingerprint
   `context:<category>:<brief_clause>:<file>#<symbol>` (for example
   `fingerprint: context:scope:blueprint success criteria:.bouncer/context/epics/014-auth/blueprints/001-signup/index.md#success-criteria`);
   merge findings with the
   same fingerprint into one (`context-review record` rejects a round that still holds
   duplicates, at any status and without writing anything; merge and record the same round again), and check `warnings` in the `context-review record`
   result (each `finding-merge-candidate` lists findings on the same file and
   symbol under different categories) to decide whether to merge those too; record `severity_changes`; set `origin:
   discovery`; and decide `actionability` (`must_fix` or `advisory`) from the
   plan and the evidence.
4. **Revise once** — As `/bouncer-plan` author, group all `must_fix`
   findings by target document and edit each document once (several edits in
   one pass are fine), so the revision is one pass over each document. Record each `advisory` finding as
   `accepted` with a note instead of editing for it. When no `must_fix`
   exists, skip the revision and the delta; the round sequence stays
   `discovery`.
5. **Certify the delta** — After the revision, rerun `bouncer review-dispatch
   plan --blueprint <dir> --previous <stored-latest-payload.json>` (the
   payload the last `start`/`record`/`restart` stored; `--previous` is
   required once the cycle exists) and copy the new
   `target.digest`. When `follow_up` is `partial`, dispatch one
   `bouncer-context-reviewer` call in mode `delta` with `fork_turns: "none"`
   (exclude full conversation history) and only this controller input
   allowlist (the same fields for named, generic, inline and print calls):
   `{mode:"delta", target, previous_findings, changed_documents, revision_diff,
   related_documents, cwd}`. `target`, `changed_documents`, `revision_diff` and
   `related_documents` come from the new payload unchanged; `related_documents`
   carries each related document's current contract text and does not repeat a
   changed document's before/after. Never pass the full conversation, the full
   history, or documents outside the judged set. When the payload has no actual
   `revision_diff` or `related_documents`, do not dispatch the delta: report the
   missing input (reason, cause, next) to the user. This is not another
   discovery pass and not a second strategy-shaped fan-out.
   When `follow_up` is `full`, do not run delta; use `bouncer context-review
   restart --blueprint <dir> --dispatch <new-payload.json> --reason <text>`
   (counted once per cycle, archives the earlier rounds and findings) and run
   discovery on the current digest instead. A second restart is rejected:
   stop and report the rejection to the user. Delta runs once regardless of
   `single` or `clustered` and of cluster count. Record round 2 as
   `mode: delta` with the new digest. Accept a new delta finding only when it
   is `introduced_by_revision` with a revised passage as evidence, or
   `missed_critical` with `blocker` or `major` severity; its
   `first_seen_round` is 2. Update `last_seen_round` on returning findings.
6. **Close** — Delta runs once; context review has no third round and no
   critical recovery. Mark findings the delta certified as `resolved`. When a
   `must_fix` finding stays open after the delta, leave `context-review`
   unaccepted and bring the open finding to the user; only the user's
   accepted-risk note may record it `accepted`. Run `bouncer context-review close`
   only after explicit user approval. If plan documents are modified after
   closing the cycle, follow the recovery procedure: close →
   `bouncer review-dispatch plan --previous <stored-latest.json>` →
   `bouncer context-review restart` → discovery.

When the plan gate reports `context review is stale`, rerun
`bouncer review-dispatch plan --blueprint <dir> --previous <stored-latest-payload.json>`,
save that JSON, and run `bouncer context-review route --blueprint <dir> --dispatch <json>`.
It is read-only, derives `follow_up` from the payload and prints `next_action`
(never route by `follow_up` alone):

- the new target equals the last reviewed target → `reuse` the recorded result;
  add no round and overwrite no recorded report;
- no round is recorded yet, or a `must_fix` finding is still open after the
  delta → `user`: stop and report. A restart does not resolve findings;
- only discovery is recorded, the cycle is open and `follow_up` is `partial` →
  `delta` with the allowlist above (do not restart discovery);
- delta is already used, or the change is structural (`full`) → `restart` while
  `restart_count` is below 1: `bouncer context-review restart` archives the
  earlier rounds first, then discovery runs on the current digest, and the plan
  changed by the recovery is re-approved (step 6);
- the restart is already used → `user`: stop with the reason, cause and next.
  There is no second restart, no third round and no automatic new cycle.

Only the user's explicit answer may record an accepted risk, with the finding
ID and a note; recording it is not plan approval or a plan gate pass.

When Cursor print dispatch is opted in, run each step 2 call and the step 5
delta call as a print dispatch from `PROJECT_ROOT`. Per call, the controller
first writes that call's controller input allowlist (and nothing else) to
`<out>/input.md`, then runs:

```bash
# Run from PROJECT_ROOT. <call> is r1-combined | r1-local-<cluster id> | r1-global | r2-delta
bouncer dispatch print --role context-reviewer --cwd "$PROJECT_ROOT" \
  --input .bouncer/runtime/print/context-review/<cycle id>/restart-<0|1>/<call>/input.md \
  --out .bouncer/runtime/print/context-review/<cycle id>/restart-<0|1>/<call>
```

Use `r1-combined` for discovery `combined`, `r1-local-<cluster id>` (for
example `r1-local-c1`) for each `local`, `r1-global` for `global`, and
`r2-delta` for the delta; relative `--out` and `--input` resolve from
`PROJECT_ROOT`. Every call uses its own cycle- and restart-qualified directory,
so a later cycle or restart never reuses or overwrites an earlier output
directory. `input.md` holds the same allowlist as the named call. The result
`report` is that call's Findings. Only when the
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
previous findings plus `changed_documents`, `revision_diff` and
`related_documents` (delta), and the read-only cwd. Or run the
`context-review` skill inline once per call: the inline pass first reads
`${BOUNCER_ROOT}/agents/bouncer-context-reviewer.md` and follows every section with that
controller input before it judges. A role name or summary alone is not a
fallback payload.

As controller, save each raw reviewer report as `{ "round": object, "findings": object[] }`
and record it with `bouncer context-review record --blueprint <dir> --dispatch
<payload.json> --round <report.json> [--status requested|addressed|accepted]` —
the subagent must not edit documents or flip status, and the controller does
not hand-write `rounds[]` or `findings[]`. An `accepted` finding requires a
note. `--status accepted` closes the cycle only when every finding is
`resolved` or `accepted` with a note; a `must_fix` finding is accepted only
with `--accept-risk <id>` after the user explicitly approved that risk.
Alternatively, close an open cycle after the last round using
`bouncer context-review close --blueprint <dir> --dispositions <json> [--accept-risk <id[,id...]>]`
with explicit user approval. `--dispositions` takes a JSON array of `{ id, status, note }`.
The `close` and `record --status accepted` calls that close the cycle write
the blueprint-root `context-review.md` themselves (`bouncer.context_review`,
body `## Findings`, `status: accepted`) and return `written`; do not copy the
returned `projection` by hand. Any `- inline context review: dispatch print
failed (<reason>)` line already in `## Findings` stays ahead of the generated
list after close. Run `close` only after explicit user approval. A recorded success is a review
disposition, not plan approval or a plan gate pass.

When recording finding `note` (and any other author-written frontmatter
scalar on that document), apply the same YAML leading-character quoting
rule as `spec-authoring` (`${BOUNCER_ROOT}/references/spec-authoring/index.md`
`## Author-written frontmatter scalars`): if the value starts with a YAML
reserved indicator such as a leading backtick, write it as a single-quoted
scalar or a block scalar (`>-` / `|`) — never as plain text after `- `. A mid-string
or Markdown-body backtick is out of scope for this rule.
