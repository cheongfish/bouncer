Starting `/bouncer-plan` for the monthly summary command PRD. Loading plugin rules and running preflight.`bouncer` isn't on PATH — locating the plugin root and how to invoke the CLI.Preflight: no selection (`current.status: empty`). Next: discovery — grounding the PRD in the repo and loading the discovery skill.Running `bouncer intent` on related symbols and checking for AskUserQuestion tooling.**Preflight:** `.bouncer/` is initialized. `current.status` is `empty` — no blueprint/task/base selected.

**Discovery grounding:** CLI today supports only `list` and `total` via positional `parseArgs` (`command --file <path>`). Aggregation lives in `src/ledger.js` (`loadEntries`, `totalCents`, `validateEntries`); tests cover ledger helpers only. Amounts are integer cents; dates are `YYYY-MM-DD`. Intent on `parseArgs` / `loadEntries` / `totalCents` / `validateEntries` is `unlinked` (no Explain provenance). No epics yet; no CONTRIBUTING/AGENTS/CI rules found. `verifySignals`: `package.json#scripts` (`npm test`).

Before the Discover ACQ, two behaviors are unset by the PRD and current code:

---

**Open decisions** (please answer both)

**1. `list` / `total` misuse error text**

Today a bad `list`/`total` invocation prints exactly:
`usage: node src/cli.js <list|total> --file <path>`

Adding `summary` often widens a shared usage string.

- **A)** Keep `list`/`total` error text byte-identical; give `summary` its own parse/error path  
- **B)** Allow shared usage/error text to mention `summary` (success I/O for `list`/`total` still unchanged)

**2. Invalid / missing option message style for `summary`**

PRD requires stderr + exit 1 and no partial stdout, but not the exact strings.

- **A)** One usage-style line (same pattern as today’s CLI) for wrong/missing options and invalid `--month`  
- **B)** Distinct messages (e.g. usage vs invalid month) while still stderr + exit 1 + empty stdout  
- **C)** Implementer chooses wording as long as stderr + exit 1 + no stdout partials

Reply like: `1A, 2B` (or your variants). After that I’ll present the Discover framing for confirmation.
