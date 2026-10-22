# Light run

When the ledger is light (`mode: light` from a blueprint whose `bouncer.scale`
is `light`), `/bouncer-run` follows this procedure instead of dispatching
`bouncer-coordinator`. The blueprint has one independent commit task; a
`verification_policy: scoped_terminal` blueprint additionally has exactly one
terminal verification task that depends on it. Do not apply it to a full ledger.

It starts only after the `SKILL.md` step 2 approval (A) and step 3 bootstrap
are done, so the light ledger already exists.

## Procedure

1. **Implement.** When `coordinate next` returns `implement` with
   `payload.inline: true`, this run session performs the `implementation`
   skill itself in the assigned worktree (the light ledger's integration
   path). Read `${BOUNCER_ROOT}/references/implementation/index.md` and
   `${BOUNCER_ROOT}/references/coding-standards/index.md` before
   editing. Do not dispatch named `bouncer-implementer`.

2. **Verify.** Run only the task-assigned verify command (on a
   `scoped_terminal` blueprint never the full-suite command; that belongs to
   the terminal node). On failure, dispatch named
   `bouncer-debugger` (still named — never inline), then re-implement inside
   Touch / `affected_paths` as needed. Review ceilings stay discovery · fix ·
   delta at most once each.

3. **Review.** Freeze base, HEAD, and the task-brief revision, then run
   `bouncer review-dispatch execute --blueprint <dir> --task <NNN> --base
   <frozen-base> --head <frozen-head>`. Dispatch one named `bouncer-reviewer`
   session walking that JSON's `perspectives` in order (light yields
   `strategy: 'single'`, `perspectives: ['combined']`; non-empty `risk_flags`
   still appends `security`). Pass the reviewer the `Red run` line for this
   task as `{{RED_RUN}}`: since this session implemented inline, write
   `TASKS-NNN: <red command run> — <failing assertion or failure point
   observed>` or `TASKS-NNN: 해당 없음: <reason>` yourself (forms in
   `${BOUNCER_ROOT}/references/review/index.md`). The reviewer is read-only — it must not write
   files or flip review status.

4. **Fix in scope.** For in-scope findings, this run session edits; then the
   same reviewer role runs delta review. Do not widen Touch / Interface from a
   reviewer request.

5. **Close.** Call `report` / `record` / `commit` / `integrate` per the CLI.
   This run session must not be the approver of `report --outcome accepted` —
   base that outcome only on recorded reviewer rounds (the independent
   reviewer session, e.g. named `bouncer-reviewer`). Integrating the
   implementation runs no full verification.

6. **Terminal verification.** On a `scoped_terminal` blueprint, once the
   implementation is `integrated`, follow `coordinate next` (`prepare`, then
   `verification_node`) and run the terminal node: its one full verification
   is the first full run. A recovery re-verification after a failure and the
   finalize remainder verification are separate runs. A terminal failure owned
   by the integrated implementation task is recovered with `coordinate repair
   --task <terminal> --resume-task <ddd>` (the same task is reassigned inside
   its approved scope, no new task). A failure proven outside every approved
   scope is recorded with `--disposition outside_scope`: the failure stays
   failed, `next` moves on, and the final report, finalize, and PR carry it as a
   separate warning. The two options are mutually exclusive; an unclear, mixed,
   or stale cause stays `blocked`. If only the environment was fixed and no
   code changed, run `coordinate reverify --task <terminal>` first (no repair
   wave); if code has to change, use `repair`.

## Prohibitions

- 구현 세션이 reviewer를 겸하거나 자기 diff를 승인하는 것을 금지한다.
  Independent reviewer means a separate named session that did not author the
  change.
- Do not invent a separate execution-mode opt-in string. Light vs full is
  ledger / pointer `scale` only.

## Risk stop

Stop the run and report to the user when any of these signals appear: security
risk, out-of-scope change, needed task split, Interface semantics change, or a
reviewer demand that widens approved scope. Persist the stop with:

```sh
bouncer coordinate promote-stop --blueprint <dir> \
  --reason <security-risk|out-of-scope|task-split|interface-semantics|reviewer-wider-scope> \
  --summary <text> --ledger-path <path> --ledger-hash <sha256>
```

That records `status: promotion_stopped` and a `promotion` snapshot (task,
diff_sha, evidence ids). Further light mutations and `run preflight` delegation
are refused. After the main checkout contains the approved full replan, run
`bouncer coordinate bootstrap --blueprint <dir> --promote-light` from the main
checkout. This archives the stopped light ledger, saves integration dirty work
to a patch, resets those files, seeds the approved full plan, and keeps the
same integration branch. The full drive's `implement` payload includes
`promoted_patch`; its worker can inspect and apply that patch within its
assigned paths. A new pointer selection is not needed.
