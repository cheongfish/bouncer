I'll run `/bouncer-plan` for the `-f` short-option PRD: load Bouncer rules, preflight the plan state, then work through discovery and the ACQ gates.Bouncer isn't on PATH yet — locating the plugin root and how to invoke the CLI.Preflight is clean: no selection, next epic `001`. Loading discovery rules and grounding the request in the codebase.**Preflight:** `current.status` is `empty` — no blueprint/task/base is selected. Suggested next epic id: `001`. `verifySignals`: `package.json#scripts`.

**Code ground:** `parseOptions` in `src/args.js` only accepts `--name value` (step-by-2). `file` is required on `list` / `total` / `summary`. `-f` today is `unexpected argument`. Intent for `parseOptions` is `unlinked` (no Explain provenance). No existing epics.

---

Two behaviors are not settled by the PRD or current code. Please answer both before the Discover confirmation.

**Open decision 1 — USAGE string in `src/cli.js`**  
Unknown-command / missing-command errors print:
`usage: node src/cli.js <list|total|summary> --file <path> [options]`  
The PRD names `README.md` and `docs/commands.md`, not this string.

- **1A)** Also document `-f` in the USAGE string (e.g. `--file|-f <path>`)
- **1B)** Leave USAGE showing only `--file` (docs-only for the short form)

**Open decision 2 — `CHANGELOG.md` Unreleased**  
There is an empty `## Unreleased` section; no CONTRIBUTING rule says it must be updated.

- **2A)** Add a short Unreleased bullet for `-f`
- **2B)** Leave CHANGELOG unchanged in this plan

Reply like `1A, 2B` (or your own variants). After that I’ll present the full discovery framing for **AskUserQuestion — plan.discovery**.
