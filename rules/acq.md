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
give a one- or two-sentence Korean `Recommend-why` ending in `~함` or `~임`.
Use this display skeleton, extending the lettered options only when the
workflow's own consequence needs it:

```markdown
**AskUserQuestion:**

1. **Re-ground**: {한 줄 — 무엇을 결정하는지}
2. **Recommend-why**: {왜 1번을 추천하는지}
3. **Options** (recommended-first):
   - A) {Proceed} (Recommended)
   - B) {Revise / alternative}
   - C) {Cancel}
```

Do not combine an ACQ a workflow may skip under `auto` with consent that must
still be obtained. The workflow's gate catalog says which rule applies.
