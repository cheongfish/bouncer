---
name: graphify-runner
description: "Use during /bouncer-plan to query the prebuilt source-code graph for the files a blueprint will likely touch, roll them up to directory granularity, and write bouncer.graph.suggested_paths into tasks.md. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Graphify Runner

Turn a blueprint's intent into `bouncer.graph.suggested_paths` by querying two
graphs under `graphify-out/`:

| Graph | Default dirs | Output |
| --- | --- | --- |
| **source** | `config.source_dirs` | `graphify-out/source/graph.json` |
| **context** | `config.context_dirs` (default `.bouncer/context`) | `graphify-out/context/graph.json` |

These directories are user-managed local output. SessionStart runs
`syncSessionGraphs` when `config.graphify.enabled` is `true`; this skill runs
the same sync again at plan time so mid-session edits are caught.

`bouncer.graph.basis` is written here as a **non-empty list of per-graph
entries** (canonical write shape). Validate still accepts a non-empty legacy
string; do not author new string bases from this skill. Each entry has four
required fields:

| Field | Values |
| --- | --- |
| `graph` | `source` \| `context` |
| `status` | `updated` \| `reused` \| `fail-skip` \| `skip-disabled` \| `missing` |
| `query` | the actual query string used (or a short reason when no query ran) |
| `result` | a short summary — hit count and top paths, not a raw dump |

Map `graph-sync` outcomes to `status` as follows:

| `graph-sync` outcome | `status` |
| --- | --- |
| listed in `built` | `updated` |
| already fresh / no rebuild | `reused` |
| listed in `failed` | `fail-skip` |
| `skip-no-graphify` / `skip-graph-disabled` | `skip-disabled` |
| listed in `missing` | `missing` |

Never omit an entry because a query could not run — leave the entry with the
matching `status` so G4 still sees a recorded basis (graph absence is a state,
not an error).

## Steps

1. **Freshness re-check (plan-time).** Always sync before querying — do not rely
   on SessionStart alone:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" graph-sync
   ```
   Rebuilds any stale **source** / **context** graph (mtime of configured dirs
   vs that graph's `graph.json`). Keep the JSON `built` / `failed` / `missing`
   (and any skip reason) so step 5 can write one `basis` entry per graph with
   the status mapping above.

2. **Availability check.** If graphify auto-build is disabled, `graphify` is not
   on PATH, sync reports `skip-no-graphify` / `skip-graph-disabled`, or the
   source `graph.json` is still missing after sync (`missing` from `graph-sync`
   includes `"source"`), **skip gracefully**: leave `suggested_paths` as the
   scaffolded `[]`, **leave a `basis` entry for each affected graph** (with
   `status` `skip-disabled` or `missing` as mapped above, plus non-empty
   `query`/`result` explaining why), and tell the caller the graph was
   unavailable so the user provides and confirms `affected_paths` manually. Do
   not fail the command. A context-only graph must not block this skip — source
   absence alone is enough.

   When skipping, tell the user (verbatim or close):

   > Graphify is optional. Path suggestions were skipped — confirm
   > `affected_paths` manually. To enable: `pip install graphifyy && graphify
   > install`, set `.bouncer/config.json` `graphify.enabled` to `true`, then
   > re-run `/bouncer-plan`. See `docs/install.md`.

   If auto-build is disabled but the CLI is present, still leave a
   `skip-disabled` entry in `basis` and mention enabling `graphify.enabled`.

3. **Query both graphs.** Only reach this step when the source graph is
   available (step 2 did not skip). Build a query string from the blueprint
   goal plus the tasks checklist intent, then run:
   ```bash
   graphify query "<blueprint goal + key task nouns>" \
     --graph graphify-out/source/graph.json
   graphify query "<blueprint goal + key task nouns>" \
     --graph graphify-out/context/graph.json
   ```
   Record one planned `basis` entry per graph you attempt. If the context graph
   file is missing, query source alone and leave a `missing` (or `fail-skip`)
   entry for context — do not drop the entry. Use the returned nodes' file
   paths as raw hits (union of both queries when both ran).

4. **Roll up to directories.** Map each hit file to its containing directory
   (repo-relative, POSIX). Deduplicate. Prefer directory granularity over
   individual files so the set stays stable as files move within a module.

5. **Write frontmatter.** Set `bouncer.graph.suggested_paths` in `tasks.md` to
   the deduplicated directory list, and refresh `bouncer.graph.generated_at`
   (KST, `+09:00`), `bouncer.graph.command` (`graphify query` on source+context),
   and `bouncer.graph.basis` as the **array of per-graph entries** collected in
   steps 1–3 (`graph`, `status`, `query`, `result` — all non-empty). For
   successful queries, put hit count and a few top paths in `result`. Leave
   every other field untouched.

6. **Hand back.** Return the suggested paths to `/bouncer-plan`, which proposes
   `affected_paths` seeded from them for the user to confirm/edit.

## Notes

- `suggested_paths` is advisory input for `affected_paths`; the user always
  confirms the authoritative `affected_paths`.
- Never write `affected_paths` here — that is `/bouncer-plan`'s user-confirmed
  step.
- Freshness is `newest mtime under configured dirs <= graph.json mtime` per
  graph. Plan-time `graph-sync` reuses the SessionStart planner so both call
  sites stay aligned. If a graph is missing or rebuild fails, still leave a
  `basis` entry with the mapped `status`, then skip the query and require the user to confirm
  `affected_paths` manually.
