---
name: graphify-runner
description: Use during /bouncer-plan to query the prebuilt source-code graph for the files a blueprint will likely touch, roll them up to directory granularity, and write bouncer.graph.suggested_paths into tasks.md.
---

# Graphify Runner

Turn a blueprint's intent into `bouncer.graph.suggested_paths` by querying the
source graph in `graphify-out/`. This directory is user-managed local output;
the SessionStart hook updates it only when `config.graphify.enabled` is `true`.

## Steps

1. **Availability check.** If graphify auto-build is disabled, `graphify` is not
   on PATH, or `graphify-out/` does not exist, **skip gracefully**: leave
   `suggested_paths` as the scaffolded `[]`, record the graceful fallback in
   `bouncer.graph.basis`, and tell the caller the graph was unavailable so the
   user provides and confirms `affected_paths` manually. Do not fail the
   command.
2. **Query.** Build a query string from the blueprint goal plus the tasks
   checklist intent, then run:
   ```bash
   graphify query "<blueprint goal + key task nouns>"
   ```
   Use the returned nodes' file paths as raw hits.
3. **Roll up to directories.** Map each hit file to its containing directory
   (repo-relative, POSIX). Deduplicate. Prefer directory granularity over
   individual files so the set stays stable as files move within a module.
4. **Write frontmatter.** Set `bouncer.graph.suggested_paths` in `tasks.md` to
   the deduplicated directory list, and refresh `bouncer.graph.generated_at`,
   `bouncer.graph.command` (`graphify query`), and `bouncer.graph.basis` (the
   query string and a one-line note on why these paths were suggested). Leave
   every other field untouched.
5. **Hand back.** Return the suggested paths to `/bouncer-plan`, which proposes
   `affected_paths` seeded from them for the user to confirm/edit.

## Notes

- `suggested_paths` is advisory input for `affected_paths`; the user always
  confirms the authoritative `affected_paths`.
- Never write `affected_paths` here — that is `/bouncer-plan`'s user-confirmed
  step.
- When auto-build is enabled, graph freshness is decided at SessionStart by the
  `session-graph` hook (`planSessionGraph` rebuilds when source mtime exceeds the
  graph mtime). This skill does not rebuild; it queries the current
  user-managed local output in `graphify-out/`. If the graph is missing or
  stale, skip gracefully and require the user to confirm `affected_paths`
  manually.
