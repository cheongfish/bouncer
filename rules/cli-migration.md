# CLI migration contract

Removed light-mode recovery, controlled migrations, and import. Index and result handling
live in `${BOUNCER_ROOT}/rules/cli.md`.

## Removed light mode recovery

Finish the in-progress drive with the
previous CLI through `/bouncer-finalize` before upgrading (the normal path).
If this CLI is already in use, recover in this order: (1) finish with the
previous CLI and `/bouncer-finalize`; (2) preserve worktrees from the main
checkout using `git worktree list`, copy commits with `git bundle`, uncommitted
diff, and the gitignored `coordinator.json`; (3) discard only after
explicit approval; (4) `git worktree remove --force` for integration and each
worker; (5) replan with `/bouncer-plan` and declare complexity. To rerun in the
same directory, step 4 must also delete the integration and worker branches
after approval, or leftover branches make bootstrap `branch-conflict`; to keep
the branches, replan under a new blueprint slug.

## Controlled migrations

```sh
bouncer migrate task-layout [--dry-run]
bouncer migrate context-slugs [--yes]
bouncer migrate merge-legacy-epics [--yes]
bouncer migrate retention
bouncer migrate retention --apply --blueprint <dir>
bouncer import [--source merges|commits] [--since <ref>] [--limit <n>] \
  [--epic-name <slug>] [--yes --message <msg>]
```

Inspect dry-run output before any write. `migrate context-slugs` prints its plan
without `--yes` and, with `--yes`, moves numbered epic and blueprint directories to
slug directories, rewrites ids and hashes, and records `legacy_id` and
`blueprint_aliases` in the v2 registry; it refuses a dirty tree or an in-progress
run. `migrate merge-legacy-epics` likewise prints its plan (moves, rewritten document
count, `movedTo`, `unresolved_rows`) without `--yes`; with `--yes` it `git mv`s each legacy
epic blueprint into its domain epic, rewrites ids, order and hashes, records `moved_to` on the
registry's legacy entries, and validates the moved blueprints. It refuses free-text exception
rows (`merge-mapping-invalid`), a dirty tree, and in-progress runs, and a second run is a no-op.
Retention's default is an audit;
`--apply` modifies one eligible closed blueprint and deletes transient files.
`import` is dry-run unless both `--yes` and `--message` are present.
