---
distill:
  id: context-layout
  paths:
    - .bouncer/context/**
    - scripts/src/lib/layout.ts
  pulls: []
---
# context-layout

## Invariants

- Task layout is `tasks/<NNN>/{tasks,verification,review}.md` with ids `TASKS|VERIFY|REVIEW-<NNN>`. Brief = `tasks/<NNN>/tasks.md`; evidence = that dir's `verification.md` / `review.md`.

## Gotchas

- Wrong `scale` spelling fails S20; omitting `scale` does not.
- Switching `subagents.provider` does not backfill missing provider blocks — repos past `bouncer init` add them to `.bouncer/config.json` by hand.

## Decisions

- Canonical epic/blueprint ids are zero-padded `\d{3}` with no `EPIC-`/`BP-` prefix; child docs use `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-` + `\d{3}`.
