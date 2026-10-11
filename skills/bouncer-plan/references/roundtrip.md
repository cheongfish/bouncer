# Plan roundtrip

Rules for batching clarifying questions, separating light declaration from
final approval, and limiting what each `/bouncer-plan` step carries forward.

## Questions to batch

Batch independent non-ACQ questions in one chat message when one answer does
not change another question's options. Examples: scope and risk confirmation,
whether to recommend a verify command, and whether to keep a
`possibly-superseded` constraint. `config.autonomy` never skips these
questions.

## What not to batch

Do not combine two or more ACQ gates into one display. Do not put consent or
approval items into the batched clarifying questions — keep skippable ACQ
prompts and required consent on separate turns (`${BOUNCER_ROOT}/rules/acq.md`).

## Declaration and approval

Ask for the light-scope declaration before scaffolding. Take final approval
(`plan.approval`) only after the plan documents are written. The light
declaration is not approval of the authored plan. After drafting tasks, show
`bouncer plan inspect --blueprint <dir>` routing signals as recommendation
evidence only — do not treat them as selection or approval.

## Step handoff

Between plan steps, carry only the current plan, open decisions, and a short
change summary. Do not re-pass the full discovery transcript or prior-step
chatter.
