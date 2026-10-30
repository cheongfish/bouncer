# Light run

When the ledger is light (`mode: light` from a blueprint whose `bouncer.scale`
is `light`), `/bouncer-run` follows the same start ACQ and the same direct or
coordinator path as a full ledger. This reference is the policy overlay only —
not a separate implement/review loop. Do not apply it to a full ledger.

It starts only after the `SKILL.md` step 2 approval (A or D) and step 3
bootstrap are done, so the light ledger already exists. Execution still goes
through [direct-run.md](./direct-run.md) (option D) or coordinator dispatch
(option A); workers remain named subagents.

## Policy differences

Mode `light` changes policy, not the execution machine:

- **Root review.** One blueprint-root review in `single` / `combined` form
  (discovery once). When that review is not accepted, one review-cause repair
  is allowed; after that repair there is no delta in this blueprint — remaining
  findings need a user decision (deferred or accept-risk).
- **Commit scope.** Paths outside the approved scope stay `out-of-scope` (no
  unexpected-path deviation path that a full ledger allows).
- **Baseline.** `worktree.baseline` does not run on a light ledger.

## Promotion signals

Stop the light drive with `coordinate promote-stop` when any of these signals
appear. Map each signal to `--reason` before handoff or further light mutation;
the promotion table below outranks the direct-run handoff table.

| Signal | `--reason` |
| --- | --- |
| Security risk | `security-risk` |
| Out-of-scope change (including a CLI `out-of-scope` refusal) | `out-of-scope` |
| `light-scope-revision-requires-promotion` (in-place scope revise refused) | `out-of-scope` |
| Needed task split | `task-split` |
| Interface semantics change | `interface-semantics` |
| Reviewer demand that widens approved scope | `reviewer-wider-scope` |

```sh
bouncer coordinate promote-stop --blueprint <dir> \
  --reason <security-risk|out-of-scope|task-split|interface-semantics|reviewer-wider-scope> \
  --summary <text> --ledger-path <path> --ledger-hash <sha256>
```

That records `status: promotion_stopped` and a `promotion` snapshot (task,
diff_sha, evidence ids). Further light mutations and `run preflight` delegation
are refused. There is no light resume after promotion_stopped.

## Promote to full

After the main checkout contains the approved full replan, run
`bouncer coordinate bootstrap --blueprint <dir> --promote-light` from the main
checkout. This archives the stopped light ledger, saves the open task's worker
dirty work to a patch (and preserves that worker under
`.bouncer/runtime/salvage/`), resets those files, seeds the approved full plan,
and keeps the same integration branch. The full drive's `implement` payload
includes `promoted_patch`; its worker can inspect and apply that patch within
its assigned paths. The response and ledger carry `promoted_from`. A new
pointer selection is not needed.

## Compatibility

- `light-ledger-legacy`: stop and show the CLI `next` to the user. Preserve
  integration worktree diffs and untracked files first. Discard the worktree
  only after the user explicitly approves (irreversible); the CLI does not
  discard anything itself.
- `light-inline-removed`: stop and report a plugin / CLI version mismatch.
  Do not implement from the integration cwd.
- `light-implementer-record-missing`: do not re-report that attempt as
  `accepted`. If a subagent implementer did not implement the change, report
  `rework` and dispatch the named implementer. Record `worker-model` only for
  the implementer model that was actually dispatched.
- If the `implement` payload carries an `inline` key, do not implement; stop and report a CLI version mismatch.

## Prohibitions

- Do not invent a separate execution-mode opt-in string. Light vs full is
  ledger / pointer `scale` only.
- This run session must not implement, review, or debug the change itself, and
  must not approve its own `report --outcome accepted`.
