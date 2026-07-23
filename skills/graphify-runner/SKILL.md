---
name: graphify-runner
description: Use during /sdd-plan to query the prebuilt source-code graph for the files a blueprint will likely touch, roll them up to directory granularity, and write sdd.graph.suggested_paths into tasks.md.
---

# Graphify Runner

Turn a blueprint's intent into `sdd.graph.suggested_paths` by querying the
source graph that the `session-graph` hook built at SessionStart into
`graphify-out/`.

## Steps

1. **Availability check.** If `graphify` is not on PATH or `graphify-out/` does
   not exist, **skip gracefully**: leave `suggested_paths` as the scaffolded
   `[]` and tell the caller the graph was unavailable so the user seeds
   `affected_paths` manually. Do not fail the command.
2. **Query.** Build a query string from the blueprint goal plus the tasks
   checklist intent, then run:
   ```bash
   graphify query "<blueprint goal + key task nouns>"
   ```
   Use the returned nodes' file paths as raw hits.
3. **Roll up to directories.** Map each hit file to its containing directory
   (repo-relative, POSIX). Deduplicate. Prefer directory granularity over
   individual files so the set stays stable as files move within a module.
4. **Write frontmatter.** Set `sdd.graph.suggested_paths` in `tasks.md` to the
   deduplicated directory list, and refresh `sdd.graph.generated_at`,
   `sdd.graph.command` (`graphify query`), and `sdd.graph.basis` (the query
   string and a one-line note on why these paths were suggested). Leave every
   other field untouched.
5. **Hand back.** Return the suggested paths to `/sdd-plan`, which proposes
   `affected_paths` seeded from them for the user to confirm/edit.

## Notes

- `suggested_paths` is advisory input for `affected_paths`; the user always
  confirms the authoritative `affected_paths`.
- Never write `affected_paths` here — that is `/sdd-plan`'s user-confirmed step.
- Graph freshness is decided at SessionStart by the `session-graph` hook
  (`planSessionGraph` rebuilds when source mtime exceeds the graph mtime). This
  skill does not rebuild; it queries the current `graphify-out/`, which is a
  local cache (gitignored). If the graph is missing or stale, skip gracefully
  and let the user seed `affected_paths` manually.
