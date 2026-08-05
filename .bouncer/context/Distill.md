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

Project-wide cautions for plan/execute. BP `explain.md` is a cycle candidate;
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
- Commit-message subject/body come from document fields (`title`,
  `commit_type`, `commit_intent`), not free-form finalize prose; keep
  Epic/Blueprint/Distill ids and file paths out of those fields.
- Unknown CLI usage goes to **stderr** so stdout stays pipe-clean.
- Optional `tasks.bouncer.verify` is a single executable argv string only
  (no shell chaining, redirection, or `cd` prefix) so the evidence command
  is reproducible from the repository root.
- The supported surface for the active blueprint pointer is `bouncer current`
  (read / `--set` / `--clear`). Workflow skills must not call
  `scripts/lib/current` via `node -e`.
- The pointer file lives under the Git common directory as `bouncer/current`
  — never document it as `.bouncer/current`.

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
- Reviewer rubric, `reviewer-prompt.md`, named agent docs under `agents/`, and
  execute dispatch are one commit unit — change them together.
- Do not redeclare an `agents` path in plugin manifests. Claude rejects the
  plugin when a convention path is listed again; Cursor auto-discovers
  `agents/` when unset.
- Promoting into `.bouncer/context/Distill.md` requires `makeAllowed` to whitelist
  that path; otherwise finalize aborts as out-of-scope.
- Do not assume `.bouncer/templates/` exists — scaffold/PR bodies come from
  built-in `scripts/lib/templates.js` unless a project override is intentionally
  present.
- `BOUNCER_HOME` is not a host/provider signal — it is a manual plugin-root
  override usable on any host. Cursor users must set
  `subagents.provider: "cursor"` explicitly.
- `verification.md` is rewritten by `recordVerificationResult` — never put
  author declarations there; declare an optional verify command on
  `tasks.md` as `bouncer.verify`.
- A present-but-invalid `bouncer.verify` must not fall through to
  `config.verify` — that would hide a plan-time `S12` miss.
- Empty `diff_sha` (or empty `disposition`) on `explain.md` is G15 **record
  missing**, not hash mismatch — scaffold defaults must not collapse into the
  wrong failure branch.
- `finalize` nests the whole `nextBlueprint` return under `next`, so the
  candidate is `next.next` and overlap is `next.next.sharedPaths` — a flat
  `next.sharedPaths` read skips the handoff warning.
- Skills and docs that say the pointer path is `.bouncer/current` are wrong;
  the shared file is `<git-common-dir>/bouncer/current`.
- When `config.source_dirs` is `scripts` / `hooks` / `test`, Graphify source
  queries do not return `skills/` paths — manually add skill directories to
  `suggested_paths` for blueprints that touch skills.
- Changing `docs/ARCHITECTURE.md` §4 generic-skills table also requires
  updating `test/public-name-regression.test.js` `APPROVED_GENERIC_SKILLS`
  (and listing that test in `affected_paths`); otherwise execute cannot put a
  new skill in the table.
- discovery pre-read (`.bouncer/context/epics/` indexes, Distill.md) is
  required for framing, but missing files are not a hard stop — record Overlap
  as `"none"` and continue.
- 「Behavior-changing diff without adding/updating tests」 is a Code quality
  review candidate (`minor` / `major`); docs-only and configuration-only diffs
  are exempt. Keep the rubric in sync across `skills/review`,
  `reviewer-prompt.md`, and `agents/bouncer-reviewer.md`.
- `graphSyncWarnings` missing copy: use “none of … exist” only for
  `skip-no-dirs` / empty `dirs`; scopes already in `failed` must not get a
  missing line (failed covers them).

- newestMtimeUnder skips directories named graphify-out, node_modules, .git, .worktrees and does not descend directory symlinks.

## Decisions

- Project Distill SSOT is `.bouncer/context/Distill.md`; master rules only name
  the path and the read obligation.
- BP `explain.md` + G15 (written sections, `bouncer.comprehension`, matching
  `diff_sha` for `base..HEAD` excluding `.bouncer/context/`) are the finalize
  gate token; global Distill is skill promotion + `makeAllowed`, not a G15
  body-quality gate. G9 is retired (number vacant).
- Project Distill is ungated OKF-shaped meta (no registered `bouncer.*` kind).
- `bouncer init` soft-seeds missing Distill on an already-ready bootstrap and
  never overwrites curated content.
- Mechanical TS migration may keep `strict: false` until a later tightening BP.
- Plan artifacts reach the execute worktree through `bouncer seed-worktree`,
  run in the base checkout right after `git worktree add`; the moved set is the
  plan context documents only, and the base is returned to HEAD.
- Execute worktrees live under `<repo>/.worktrees/<BP-id>` (shared via the
  main worktree root from `git-common-dir`), not under the host XDG state home.
- Review Findings come from named agent `bouncer-reviewer` (or generic /
  inline fallback when named agents are unavailable); only the controller
  sets `review → accepted`. `bouncer-implementer` likewise must not commit
  or flip document status — the controller owns both.
- Named-agent dispatch is four steps: `resolveSubagentModel` → named call →
  slug reject retries with `inherit` (and notify the user) → named-agent
  unsupported falls back to generic/inline. Keep the fallback wording or G8
  blocks on hosts without `agents/` (Codex).
- `reviewer-prompt.md` is a per-run call brief slot; persona, guards, and
  Findings output contract live in `agents/bouncer-reviewer.md`.
- Named-agent model overrides live in `.bouncer/config.json` `subagents` as
  per-provider blocks (model ID namespaces differ by host).
  `resolveSubagentModel` never throws — miss / `'inherit'` / non-string →
  `{ model: null }` (parent-session inherit). `subagents` is project config,
  not OKF/document frontmatter — do not register it in `schema.ts`.
- Codex is out of named-agent routing: the plugin cannot deploy `agents/`, so
  review and execute always take the generic/inline fallback there.
- Verify command resolution is `tasks.bouncer.verify` (when set) then
  `config.verify`; format rules live only in `isValidVerifyCommand`, which
  plan `S12` and runtime `VERIFY_COMMAND_INVALID` both reuse.
- Pointer absence is a state, not an error: bare `bouncer current` always
  exits `0`, and attaches `ready` only when the pointer is null.
- `listReadyBlueprints` includes only blueprint `approved` with tasks
  `ready` / `in_progress` (`verified` is excluded); broken docs are skipped
  per entry.
- `bouncer current --set` writes the pointer only after the plan gate passes;
  failures ship `validateBlueprint` results untouched and leave the pointer
  alone.
- The next blueprint after finalize is a computation (`listReadyBlueprints` +
  epic `## Blueprints` order), not stored state; advancing the pointer is
  confirm-then-`bouncer current --set` only — never automatic and never a new
  CLI.
- discovery Confirmation hands off six named outputs: `Goal`, `Scope`,
  `Non-goals`, `Success criteria`, `Edge cases & failure modes`, `Overlap`.
  `/bouncer-plan` step 1 cites those names and maps Edge cases → blueprint
  Contract 「실패 모드·엣지 케이스」, Overlap → epic Out of scope or reuse of
  an existing blueprint.
- Epic `## Blueprints` one-line purpose must show what changes and where it
  touches so the next discovery can judge stream overlap from the list alone.
- Graph absence is a state, not an error: `syncSessionGraphs.missing` stays
  empty on `NO_GRAPH_WORK` paths and never flips `ok` to false; consumers
  signal via fields / stderr, not exit codes.
- init default source_dirs is the fixed candidate list filtered to existing directories (order preserved); empty yields [] with sourceDirsUnresolved; existing config.json is never overwritten.
