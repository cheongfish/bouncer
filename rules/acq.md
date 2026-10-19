# ACQ display contract

Human-facing confirmations are **ACQ** gates. Each workflow owns when a gate
fires, whether it is required, and what every answer does. This rule owns only
how a gate is displayed.

Use the host `AskUserQuestion` / `AskQuestion` UI when available. Otherwise,
render the **same options** in chat and wait for an explicit A/B/… reply. A
bare `/bouncer-*` workflow command is never consent for a gate's state-changing
action.

**Gate ID.** Every gate has a stable ID of the form `<workflow>.<gate>` (for
example `plan.discovery`), listed in the owning skill's
`## ACQ (AskUserQuestion) gates` index. Ask only gates that index lists, and
put the gate ID in the heading of every display — `**AskUserQuestion —
<gate-id>**` in chat, and the question title in the host UI. One display holds
exactly one gate: when a step asks two gates, render two displays, each with
its own heading and its own options, and number them `(1/2)`, `(2/2)` after the
ID. Write each option on one line as `- X) label`.

**Machine-readable block.** In a chat display (never in the host UI question),
put one HTML-comment line directly after the heading:
`<!-- acq {"gate":"<gate-id>","options":["A","B"],"recommended":"A"} -->`.
`gate` is the catalog ID (without the `(n/m)` number), `options` is the
letters of the `- X)` lines in display order, and `recommended` is the letter
of the `(Recommended)` line. The JSON stays on one line and one block holds
one gate, so each `(1/2)`, `(2/2)` display has its own block. A free-input
gate with no options (today only `plan.request`) uses `"options":[]` and
`"recommended":null`:

```markdown
**AskUserQuestion — plan.request**
<!-- acq {"gate":"plan.request","options":[],"recommended":null} -->
```

The catalog of gate IDs lives in `rules/acq-gates.json`.

Put the recommended proceed option first, then revise, then any alternative,
and cancel/stop last. Mark one clear recommendation with `(Recommended)` and
give a one- or two-sentence `Recommend-why` in Korean (AGENTS.md hard rule 5),
ending in `~함` or `~임` when the gate concerns Korean commit-intent style.
Write the descriptions and option labels in Korean; the gate ID, the acq JSON
keys and letters, the `- X)` lines, the `Re-ground` / `Recommend-why` /
`Options` labels, and the `(Recommended)` marker stay verbatim because
responders parse them.
Use this display skeleton, extending the lettered options only when the
workflow's own consequence needs it:

```markdown
**AskUserQuestion — <gate-id>**
<!-- acq {"gate":"<gate-id>","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: {무엇을 결정하는지 한 줄}
2. **Recommend-why**: {1번 선택지를 추천하는 이유}
3. **Options** (recommended-first):
   - A) {진행} (Recommended)
   - B) {수정 / 대안}
   - C) {취소}
```

Do not combine an ACQ a workflow may skip under `auto` with consent that must
still be obtained. Each workflow document says which ACQ it may skip under
`auto`.
