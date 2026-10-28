When deciding context review for a `scale: full` blueprint, or a light blueprint that carries `bouncer.review_contract: brief`, after `affected_paths` confirmation, read this reference.

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
   merge, split, combine, or divide its clusters or its `perspectives`, and do not add
   an extra perspective to a `single` or `perspectives` result. When the payload is `ok: false`, or when
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

   Resolve `bouncer-context-reviewer` with
   `bouncer subagent-model --agent bouncer-context-reviewer` before dispatch
   and pass the resolved model to the named call. The retained payload's
   `agent_dispatch` snapshot selects the configured `bouncer-context-reviewer`
   model for each call; pass that model to the named dispatch. Immediately
   before each call, compare the snapshot with current config and resolve again
   when they differ, then pass the newly resolved model. When the payload carries
   `reviewer_tier` / `reviewer_tier_applied`, re-resolve as
   `${BOUNCER_ROOT}/rules/subagent-model.md` item 1 describes. Stop on
   model rejection and tell the user provider, role, configured model, host's
   exact reason, and where to correct `.bouncer/config.json`. Report a supported
   model name only if the host explicitly returns it. Do not infer aliases or
   retry with `inherit`. If Claude Code hook `additionalContext` changes
   dispatch facts, tell the user the change.

   A blueprint without the `review_contract` marker is `strategy: single`, whatever the task
   count: dispatch one `bouncer-context-reviewer` call with perspective
   `combined` (both rubrics) and record round 1 with the `combined` perspective. A marked
   blueprint is `strategy: perspectives`: dispatch one `bouncer-context-reviewer` call per
   entry of the payload `perspectives` (full: `consistency`, `scope_minimality`,
   `verifiability`, `risk_security`; light: `verifiability` only), all in one message so they
   run in parallel, and record all of them in round 1 as one `perspectives` list. A stored
   payload with `strategy: clustered` from an older cycle is still read, but never produced.
   Each call uses `fork_turns: "none"` (exclude full
   conversation history) and receives only this controller input allowlist:
   `mode: discovery`, the perspective, the frozen digest, the full judged epic
   · blueprint · task document set, and the read-only cwd. Do not pass the full
   conversation, the full ledger, or documents outside that judged set. The
   discovery `target_digest` equals the frozen digest, and no call sees another
   call's findings.
   **Metrics.** Around every reviewer call (discovery and delta) record it:
   `bouncer metrics start --kind context-review --blueprint <dir> --label <perspective> --target-digest <call target_digest>`
   just before dispatch, then `bouncer metrics end --id <id> --tokens <subagent_tokens> --host-duration-ms <duration_ms>`
   from the host's final task notification once the reviewer's hand-back report has arrived, per item 6 of `${BOUNCER_ROOT}/rules/subagent-model.md` (omit flags the host did not give).
   Also pass `--tier <tier>` and `--effort <effort>` from the `--json` result of the resolution
   that call used, under the rules in `${BOUNCER_ROOT}/skills/bouncer-run/references/drive-metrics.md`
   (omit `--tier` when `model` is `null`, omit `--effort` on Cursor, never pass a `null`). When
   `reviewer_tier_applied` is `true`, record the raised tier by resolving with
   `--tier <reviewer_tier>` and reading that `--json` result. Parallel perspective calls share one
   resolved value and each records it.
   Procedure and rules: `${BOUNCER_ROOT}/skills/bouncer-run/references/drive-metrics.md`. A failed `metrics` call
   never changes the review result.
3. **Merge** — Verify each finding's evidence. With `perspectives`, the findings of every
   call land in round 1; findings that share a fingerprint across perspectives are merged
   into one. Record `category`,
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
4. **Record** — Record the complete merged round with `bouncer context-review
   record` and verify success before editing any judged document. On failure,
   preserve current documents and reports, stop, and follow the reported
   `reason` and `next`. Do not revise the documents or relabel an old report
   with a new digest.
5. **Revise once** — Only after Record succeeds, as `/bouncer-plan` author,
   group all `must_fix`
   findings by target document and edit each document once (several edits in
   one pass are fine), so the revision is one pass over each document. Record each `advisory` finding as
   `accepted` with a note instead of editing for it. When no `must_fix`
   exists, skip the revision and the delta; the round sequence stays
   `discovery`. A body-only edit (no frontmatter structure, Interface or Touch
   change) needs no further review round: certify it with `close` (step 7).
   Editing a task's `affected_paths`, `depends_on`,
   `parallel_safe`, `dependency_gate`, `exclusive_resources` or
   `execution_kind`, a blueprint's `scale` or `review_scope`, or adding or
   removing a document is a structure change: the next `review-dispatch plan
   --previous` returns `follow_up: full`, so the round is a restart, not a
   delta. Editing only bodies, `review_risk`, or epic frontmatter returns
   `partial` (delta). Put any needed structure change into the one revision. Editing only
   a task's Interface or Touch body keeps the structure but changes the
   contract, so `route` returns `delta`; body-only edits elsewhere return
   `close`.
6. **Certify the delta** — After the revision, rerun `bouncer review-dispatch
   plan --blueprint <dir> --previous <stored-latest-payload.json>` (the
   payload the last `start`/`record`/`restart` stored; `--previous` is
   required once the cycle exists) and copy the new
   `target.digest`. When `follow_up` is `partial`, dispatch one
   `bouncer-context-reviewer` call (perspective `combined` on a full blueprint,
   `verifiability` on a light one) in mode `delta` with `fork_turns: "none"`
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
   stop and report the rejection to the user. Delta runs once. Record round 2 as
   `mode: delta` with the new digest. Accept a new delta finding only when it
   is `introduced_by_revision` with a revised passage as evidence, or
   `missed_critical` with `blocker` or `major` severity; its
   `first_seen_round` is 2. Update `last_seen_round` on returning findings.
7. **Close** — Delta runs once; context review has no third round and no
   critical recovery. Mark findings the delta certified as `resolved`. When a
   `must_fix` finding stays open after the delta, fix its target section
   (the finding's `file` and `symbol`) if the user approves, then rerun
   `bouncer review-dispatch plan --previous <stored-latest.json>` and
   `bouncer context-review route`, and follow only its `next_action`:
   - body-only edit of the target section → `close`: set the fixed finding to
     `resolved` and run `bouncer context-review close`;
   - the edit also changed the contract or structure (Interface/Touch) →
     `restart` while `restart_count` is below 1: run
     `bouncer context-review restart`, rerun discovery, and re-approve the
     changed plan;
   - the target section was not fixed, or only unrelated sections changed →
     `user`: offer the user only an accepted-risk close (restore the reviewed
     baseline documents, then close with `--accept-risk`, and edit after
     approval) or stopping. Only the user's accepted-risk note may record the
     finding `accepted`.

   Leave `context-review` unaccepted until then. Run `bouncer context-review close`
   only after explicit user approval. `close` and `record --status accepted`
   certify the current snapshot: they store `closure_target_digest` in the
   runtime closure and in `context-review.md`, which the record checks compare
   first (an older document without it falls back to the last round digest).
   If plan documents are modified after closing the cycle, rerun
   `bouncer review-dispatch plan --previous <stored-latest.json>` and
   `bouncer context-review route`: `close` re-certifies a body-only edit,
   `delta` or `restart` follow the contract or structure change as below.

When the plan documents changed after the last review (a stale snapshot), rerun
`bouncer review-dispatch plan --blueprint <dir> --previous <stored-latest-payload.json>`,
save that JSON, and run `bouncer context-review route --blueprint <dir> --dispatch <json>`.
It is read-only, derives `follow_up` from the payload and prints `next_action`
(never route by `follow_up` alone):

- the new target equals the last reviewed target → `reuse` the recorded result;
  add no round and overwrite no recorded report;
- no round is recorded yet, or a `must_fix` finding is still open after the
  delta and its target section was not fixed → `user`: stop and report; offer
  only an accepted-risk close (then edit after approval) or stopping. A fixed
  target section routes to `close` or `restart` by the items below;
- the structure and the Interface/Touch contract equal the reviewed baseline
  and only a body changed → `close`: run `bouncer context-review close` again
  (new `closure_target_digest`, no new round), even on an already closed cycle.
  `close` refuses a changed structure or contract;
- only discovery is recorded, the cycle is open and only the Interface/Touch
  contract changed (`partial`) → `delta` with the allowlist above (do not
  restart discovery);
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
# Run from PROJECT_ROOT. <call> is r1-<perspective> | r2-delta
bouncer dispatch print --role context-reviewer --cwd "$PROJECT_ROOT" \
  --input .bouncer/runtime/print/context-review/<cycle id>/restart-<0|1>/<call>/input.md \
  --out .bouncer/runtime/print/context-review/<cycle id>/restart-<0|1>/<call>
```

Use `r1-<perspective>` for each discovery call (`r1-combined` for `single`, `r1-consistency`,
`r1-scope_minimality`, `r1-verifiability`, `r1-risk_security` for `perspectives`) and
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
