# implement

Contract card for the `coordinate next` action `implement`. When dispatching a
named implementer or applying its fallback, read
[agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md): it owns
the named payload, the whole-role fallback, the five dispatch metadata fields,
`report_path`, the brief freeze, the stale Brief revision rule, and the model
record. This card keeps only the implement-phase inputs.

- Dispatch named `bouncer-implementer` through `${BOUNCER_ROOT}/rules/subagent-model.md`.
  Never play that role yourself and never let one worker judge another's
  report.
- Before a `bouncer-implementer` edits a commit task, require it to read
  `${BOUNCER_ROOT}/references/coding-standards/index.md`. This is mandatory, not a suggested
  reference: it holds the Korean comment and docstring contract and the test
  and error-handling standards.
- Inputs for this step: the assigned task worktree as cwd, the current brief
  (the one your latest revision left behind, not the approval snapshot), the
  `metadata` and `report_path` that `coordinate dispatch` returned (or that
  `coordinate next` put in the `implement` payload), and the shared bundle
  identifiers with the implementer's `intent_sections`.

## Test command and report check

On a `verification_policy: scoped_terminal` blueprint the worker runs only the
task's own `bouncer.verify` command; never pass it the full-suite command or ask
it to run `npm test` / `npm run ci`. The worker's report must carry that exact
command and a passing result under `## Tests`. A different command, a missing
result, or a failing result is rejected at fan-in (`worker-test-report-mismatch`),
so judge such a report as rework instead of integrating it. The instruction text
alone does not show which command an agent actually ran; the report check
(and the execute gate) is the evidence. The first full verification is the
terminal verification node's single run after all implementation is integrated.

## Payload

When `payload.promoted_patch` is present, it points to the saved dirty-work patch from a stopped light run. Inspect it as task input and reuse only changes covered by the current task's `affected_paths`; the patch is evidence of prior work, not expanded authority.

## Print dispatch input

When `.bouncer/config.json` has `subagents.provider: "cursor"` and
`subagents.dispatch: "print"`, write only a `--input` text file. Pass cwd
as `--cwd`. `bouncer dispatch print` prepends identity and the role body.
Do not read `${BOUNCER_ROOT}/agents/*.md`. The `--input` file is a file payload:
the same hash check and full read in `agent-dispatch.md` (Implementer file
payload) apply, and the wrapper still prepends the role body.

`--input` file, in this order:

- Drive metadata: `attempt`, `task_brief_hash`, `base_head`,
  `initial_worktree_state`, and `previous_outcome` when present
- Bundle: `intent_bundle_id`, `intent_bundle_revision`
- `intent_sections`
- Brief: Goal & intent, Current behavior, Target behavior, Interface,
  Touch, Do not touch, Constraints, Checklist (omit missing behavior
  sections)
- Report **Brief revision** echoing `attempt` and `task_brief_hash`
