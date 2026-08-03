---
title: Project Distill
description: Current project invariants, gotchas, and decisions
resource: .bouncer/context/Distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T05:10:00.000Z'
---
# Distill

Project-wide cautions for plan/execute. BP `distill.md` is a cycle candidate;
`/bouncer-finalize` promotes durable items here (add / replace / drop).
Decisions are **current** only — replace the sentence when it changes; do not
append a change log.

## Invariants

- Canonical Bouncer docs live only under `.bouncer/context/` — never a root
  `context/` tree.
- Plugin consumers stay Node-only: commit `scripts/lib` CJS emit and regenerate
  via `pretest` / `npm run build`; do not require TS runtimes at consume time.
- `tsc` does not rewrite `require('../vendor/…')` — keep `outDir`/`rootDir` so
  emit lands in `scripts/lib` and relative vendor paths stay valid.
- Commit-message subject/body come from document `title` fields (and
  `commit_type`), not free-form finalize prose; keep Epic/Blueprint/Distill ids
  and file paths out of those titles.
- Unknown CLI usage goes to **stderr** so stdout stays pipe-clean.

## Gotchas

- Plain CJS without `import`/`export` needs `moduleDetection: force` or files
  collide as scripts across the program.
- `affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch
  file paths under it and fails G12 — prefer per-file paths.
- Skill YAML `description` plain `##` is truncated as a comment — quote or avoid.
- Name-policy / allowlist scanners that only listed `scripts/lib/*.js` break when
  `scripts/src/**/*.ts` is tracked — update allowlists with the source tree.
- `git worktree add` checks out every tracked file at its HEAD blob — the
  destination is never empty, so "the file is already there" does not mean
  someone else wrote it; compare against the HEAD blob (`git cat-file --filters
  HEAD:<path>`, which respects autocrlf) before calling it a conflict.
- `git checkout -- <path>` restores from the index, so it silently leaves a
  staged change in place; name HEAD (`git checkout HEAD -- <path>`) to reset the
  index and working tree together.
- `git diff --name-only HEAD` reports staged changes and deletions too — feeding
  its output straight into a file read throws on any deleted path.
- Reviewer rubric and `reviewer-prompt.md` are a pair with execute dispatch —
  change them in the same commit.
- Promoting into `.bouncer/context/Distill.md` requires `makeAllowed` to whitelist
  that path; otherwise finalize aborts as out-of-scope.
- Do not assume `.bouncer/templates/` exists — scaffold/PR bodies come from
  built-in `scripts/lib/templates.js` unless a project override is intentionally
  present.
- `BOUNCER_HOME` is not a host/provider signal — it is a manual plugin-root
  override usable on any host. Cursor users must set
  `subagents.provider: "cursor"` explicitly.

## Decisions

- Project Distill SSOT is `.bouncer/context/Distill.md`; master rules only name
  the path and the read obligation.
- BP `distill.md` + G9 `published` remain the finalize gate token; global Distill
  is skill promotion + `makeAllowed`, not a G9 body-quality gate.
- Project Distill is ungated OKF-shaped meta (no registered `bouncer.*` kind).
- `bouncer init` soft-seeds missing Distill on an already-ready bootstrap and
  never overwrites curated content.
- Mechanical TS migration may keep `strict: false` until a later tightening BP.
- Plan artifacts reach the execute worktree through `bouncer seed-worktree`,
  run in the base checkout right after `git worktree add`; the moved set is the
  plan context documents only, and the base is returned to HEAD.
- Execute worktrees live under `<repo>/.worktrees/<BP-id>` (shared via the
  main worktree root from `git-common-dir`), not under the host XDG state home.
- Review Findings come from a fresh generic subagent (or inline read-only
  fallback); only the controller sets `review → accepted`.
- Named-agent model overrides live in `.bouncer/config.json` `subagents` as
  per-provider blocks (model ID namespaces differ by host).
  `resolveSubagentModel` never throws — miss / `'inherit'` / non-string →
  `{ model: null }` (parent-session inherit). `subagents` is project config,
  not OKF/document frontmatter — do not register it in `schema.ts`.
