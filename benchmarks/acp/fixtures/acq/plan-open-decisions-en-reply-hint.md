I'll start `/bouncer-plan` from the plugin rules and preflight, then ground the `-f` short-option PRD in the current checkout.`bouncer` isn't on PATH yet — resolving the plugin root and loading the CLI next.No selection is active. Next I'll discover how `--file` is parsed today and load the discovery brief.Next I'll pull intent provenance for `parseOptions` and related command entry points.Preflight: no blueprint/task/base is selected. Discovery is grounded in `src/args.js` (`parseOptions`), command `OPTIONS` specs, and existing `--file` tests/docs. Intent provenance for `parseOptions` / `main` / `loadEntries` / `run` is **unlinked** (no Explain bodies). No epics yet; no CONTRIBUTING/AGENTS/CI.

Two behaviors are still unsettled — please answer both before the Discover confirm:

---

**Open decision 1 — `src/cli.js` USAGE string**

On unknown/missing command, stderr shows:
`usage: node src/cli.js <list|total|summary> --file <path> [options]`

The PRD requires `-f` in `README.md` and `docs/commands.md`, but does not mention this USAGE line. Updating it documents `-f`; leaving it preserves today’s exact message for that path.

- A) Update USAGE to mention `-f` as well (e.g. `--file|-f <path>`)
- B) Leave USAGE as `--file` only (docs/README still get `-f`)

**Open decision 2 — CHANGELOG**

`CHANGELOG.md` has an empty `## Unreleased` section and prior releases document user-facing options. There is no CONTRIBUTING rule that requires an entry.

- A) Add an Unreleased bullet for `-f`
- B) Skip CHANGELOG for this change

Reply with something like `1A 2A` (or your own wording). After that I’ll present the Discover framing for confirmation.
