I'll look up the `/bouncer-plan` skill and follow its plan-gate steps for this PRD.Found the bouncer-plan skill — reading it now and following its plan-gate flow.Loading the master rules and running plan preflight next.No selection yet; next epic id is `001`. Starting discovery against the Ledger CLI codebase.Preflight: no current selection (`current.status: empty`). Related symbols (`parseArgs`, `loadEntries`, `totalCents`, `validateEntries`) are all `unlinked` — no prior intent/Explain. Epics index is empty.

Discovery framing from the PRD and current `src/cli.js` / `src/ledger.js`:

---

**Goal**  
Add a `summary` command that aggregates ledger entries for a given `YYYY-MM` by category (count + amount cents), prints TSV lines sorted by category, then a `TOTAL` line — without changing `list` / `total` I/O.

**Scope**
- CLI: `node src/cli.js summary --file <path> --month <YYYY-MM>` (flag order either way)
- Filter entries whose `date` starts with that month; group by `category`; sort categories ascending; emit `<category>\t<count>\t<amount_cents>`; final `TOTAL\t<count>\t<amount_cents>` (empty month → `TOTAL\t0\t0`)
- Validate `--month` as a real calendar month (`YYYY-MM`, month 01–12); invalid/missing options → stderr + exit 1, no partial stdout
- Tests covering summary aggregation / month validation / CLI behavior as needed; keep existing `list`/`total` behavior

**Non-goals**
- Changing entry schema, amount units, or existing `list`/`total` output formats
- New commands beyond `summary`, UI, persistence writes, or dependency adds
- README update unless you include it (not required by the PRD)

**Success criteria**
1. PRD example against `data/entries.json` / `--month 2026-01` matches expected TSV
2. Invalid months (`2026-00`, `2026-13`, `2026-1`) and bad/missing flags → stderr, exit 1, empty stdout
3. Month with no entries → only `TOTAL\t0\t0`
4. Existing `list` / `total` tests and usage still pass

**Edge cases & failure modes**
- Missing `--file` / `--month`, unknown flags, extra args
- Invalid month strings (padding, out-of-range month)
- Empty result month still prints TOTAL line only
- Errors must not leave partial summary lines on stdout
- `list`/`total` keep current fixed `--file` usage (today’s `parseArgs` is positional)

**Overlap**  
No epic/blueprint streams; intent provenance unlinked. New work only.

---

Open design points I need your call on (included in the options below where they matter):
1. Exact stderr wording for summary errors (mirror existing `usage: …` style vs. more specific messages)
2. Whether a category literally named `TOTAL` is allowed / how it sorts relative to the footer
3. Whether README gets a `summary` example in this blueprint

**AskUserQuestion:**

1. **Re-ground**: Confirm discovery framing (Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap) before scaffolding.
2. **Recommend-why**: Framing matches the PRD and the current CLI shape; treating README and literal-`TOTAL` category as non-goals / undefined-reject keeps scope minimal for the plan gate.
3. **Options** (recommended-first):
   - **A)** Confirm framing as written; stderr may follow existing `usage:…` style; do not special-case a `TOTAL` category; README out of scope (Recommended)
   - **B)** Confirm framing, but revise: (reply with what to change — e.g. README in scope, specific error strings, `TOTAL` category policy, also generalize `list`/`total` flag parsing)
   - **C)** Cancel / stop planning

Reply with **A**, **B** (+ revisions), or **C**.
