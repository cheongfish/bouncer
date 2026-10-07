Starting `/bouncer-plan` for the `-f` short-option PRD. Loading plugin rules and running preflight.Exploring the codebase for `--file` handling and project rules.**Preflight:** `current.status` is `empty` — no blueprint/task/base selected.

**Discovery grounding:** Options live in `src/args.js` (`parseOptions`); `list` / `total` / `summary` all require `file`. Docs: `README.md`, `docs/commands.md`. Intent for `parseOptions` / `UsageError`: unlinked/unresolved (no Explain overlap). No epics yet. Project has `CHANGELOG.md` Unreleased + `npm test`; no CONTRIBUTING/AGENTS/CI.

Two behaviors the PRD and code leave unsettled:

**AskUserQuestion — open decisions (before `plan.discovery`)**

1. **Glued short form** — Should `-fpath` (no space, one argv token) be accepted as `--file path`, or rejected like any other unexpected token?
   - A) Reject `-fpath` / only accept separate `-f` + value (Recommended) — matches today’s `--name value` pairing and the PRD’s `-f <path>` wording
   - B) Accept glued `-fpath` as file path `path`

2. **`src/cli.js` USAGE string** — Today it is `--file <path>`. Updating it changes the stderr message for missing/unknown commands.
   - A) Leave USAGE as `--file` only; document `-f` in README + `docs/commands.md` only (Recommended) — keeps existing error text unchanged
   - B) Also update USAGE to mention `-f` / `--file`

Reply with choices (e.g. `1A 2A`). After that I’ll present the Discover framing for confirmation.
