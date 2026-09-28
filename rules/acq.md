# ACQ display contract

Human-facing confirmations are **ACQ** gates. Each workflow owns when a gate
fires, whether it is required, and what every answer does. This rule owns only
how a gate is displayed.

Use the host `AskUserQuestion` / `AskQuestion` UI when available. Otherwise,
render the **same options** in chat and wait for an explicit A/B/… reply. A
bare `/bouncer-*` workflow command is never consent for a gate's state-changing
action.

Put the recommended proceed option first, then revise, then any alternative,
and cancel/stop last. Mark one clear recommendation with `(Recommended)` and
give a one- or two-sentence `Recommend-why` ending in `~함` or `~임` when the
gate concerns Korean commit-intent style (otherwise plain English is fine).
Use this display skeleton, extending the lettered options only when the
workflow's own consequence needs it:

```markdown
**AskUserQuestion:**

1. **Re-ground**: {one line — what is being decided}
2. **Recommend-why**: {why option 1 is recommended}
3. **Options** (recommended-first):
   - A) {Proceed} (Recommended)
   - B) {Revise / alternative}
   - C) {Cancel}
```

Do not combine an ACQ a workflow may skip under `auto` with consent that must
still be obtained. The workflow's gate catalog says which rule applies.
