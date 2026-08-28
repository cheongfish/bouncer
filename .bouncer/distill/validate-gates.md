---
distill:
  id: validate-gates
  paths:
    - scripts/**
    - test/**
  pulls: []
---
# validate-gates

## Invariants

- `bouncer distill --preflight [--json]` renders `always: true` bodies and ships full registered inventory in `audit`. No path args (exit 2). Missing/invalid index fail-opens to single-file dump. No `always` shard: empty selection OK; inventory still ships (stderr reason).
- `.bouncer/config.json` parsed only in `scripts/src/lib/config.ts` (`readConfigResult`/`readConfig`). `missing` = ENOENT only; any other read/JSON error = `invalid`. Neither checks value shape. Callers own `null`/`{}`/typed-throw (`VERIFY_CONFIG_MISSING`/`VERIFY_CONFIG_INVALID`).
- `validateBlueprint` stays in `validate.ts` (public-name-regression allowlist keys a retired protocol token to that filename). `isValidGraphBasis` once in `validate-structural.ts`; G4 imports it (shared with S9; do not reimplement).
- Commit subject/body from document fields only: blueprint `commit_type` + task `title` (blueprint `title` if task title empty) + task `commit_intent` (exactly two Korean `~함`/`~임` strings) + verification `title`. `commit_intent` only on task docs. Finalize remainder subject = blueprint `title`; 배경·의도 = highest-numbered valid task `commit_intent`. No Epic/Blueprint/Distill ids/paths.
- Optional `tasks.bouncer.verify` is a single executable argv string (no shell chaining, redirection, or `cd`).
- `tasks.bouncer.graph.basis` is a non-empty legacy string **or** non-empty array (`graph` `source`|`context`, `status` in `updated`|`reused`|`fail-skip`|`skip-disabled`|`missing`, non-empty `query`/`result`).
- Execute G6-G8 / G13 / G14 and finalize commit-bullet titles judge only the pointer task unit (`loadBlueprintDocs` -> `docs.taskUnits`, `resolveTaskUnit` via 019 `entriesForVerify`) - no siblings.
- `runVerification`/`recordVerificationResult` write the target unit `verification.md` only (`verificationRel`); missing -> `VERIFY_DOCUMENT_MISSING`, no create. Never author declarations there - optional verify is `tasks.md` `bouncer.verify`.
- `closed` is blueprint lifecycle terminal: `finalize --yes` stamps/stages blueprint `index.md`; `scaffold task` refuses `closed`; `listReadyBlueprints` excludes it. Finished work opens a new blueprint.
- `bouncer scaffold blueprint --scale light|full` validates `SCALE_ENUM` before first write (exit 2 otherwise). `light` writes four plan docs (blueprint `index.md` + `tasks/001/{tasks,verification,review}.md`), no `context-review.md`; light only narrows G10 (+ skips G18) to `Goal & intent`, `Touch`, `Checklist`; G3-G5 / G11 / G12 plus execute/commit stay full/unchanged.

## Gotchas

- CLI registry lookup must use own keys (`Object.hasOwn` or `Object.create(null)`). Plain-object `COMMANDS[cmd]` treats `toString`/`constructor` as hits and throws instead of unknown-command stderr+exit 2.
- Scaffold defaults `graph.basis` to `[]`; empty fails G4 until graphify-runner records. Never omit an entry when a query cannot run - leave mapped `status`.
- `scaffoldTask` closed-blueprint guard must fire before `tasks/<NNN>` existence check and any `writeRel`, or a partial unit survives and next scaffold fails `already exists`. Missing/unparsable blueprint `index.md` falls through.
- finalize decides `closed` **after** the out-of-scope check; re-run on already-closed returns `closed: null`. G2 branches by status so `closed` reads as already finalized, not unapproved `draft`.
- Execute G14 findings need `id`, `severity`, `status` (`resolved`|`accepted`) - not `disposition` - plus non-empty `note` on every `accepted`. Plan G18 reuses that on `context-review.md`; non-array `context_review.findings` is format failure (not coerce-to-`[]`). Enabling G18 before an `accepted` `context-review.md` makes `bouncer current --set` fail.
- `scaffold context-review` rejects an existing file (throw), unlike `scaffoldExplain` no-op.
- `bouncer import` without `--yes` is dry-run (plan JSON on stdout); apply needs `--yes --message`. Empty `entries` on `applyImport` -> `ok: true`, `committed: false` - distinct from limit/refusal.
- `templateNameFor` uses `<base>-light.md` only when that key exists, else shared - verification has no light variant. No byte-identical `-light` copy.

## Decisions

- `config.autonomy` (`auto`|`interactive`) lives only in `.bouncer/config.json` - not frontmatter, not validate. Missing/out-of-enum -> warn, treat as `auto`. `auto`: start ACQ only; skip commit/next-task ACQs in the loop. `interactive`: same plus next-task boundary ACQ after each closed task. On stop, leave pointer and worktree; no auto-retry.
- Commit gate does **not** read `explain.md`. Re-checks pointer task with G6/G7/G8 and staged paths with **G17** (`deps.stagedFiles`; git failure = G17 failure, not throw). G16 requires every task `verified`, explain `published` with written sections, and one blueprint comprehension entry (array last; 0.7 multi-entry readable) whose `diff_sha` matches `range_from..HEAD` excluding `.bouncer/context/`. Empty `diff_sha`/`disposition`/`quiz_score` = G16 **record missing**, not hash mismatch. Hash drift -> body/`diff_sha` refresh only. G9/G15 retired.
- Plan G3-G5·G10-G12 apply to **every** task document (not pointer-narrowed). G3 accepts `ready`|`in_progress`|`verified` so a finished sibling does not block next-task `--set`; `draft` still fails. When `docs.taskUnits` present, skip root `verification`/`review` S-checks only if that `rel` was already seen on a unit leaf - orphan roots still S-checked. **S19** (type vs path-expected kind) and **S20** (`scale` outside `SCALE_ENUM`) always run; missing `scale` passes for 0.7 docs.
- `readVerifyCommand`: pointer names an existing task doc -> that doc `bouncer.verify` only; else walk `listTasksDocs` in number order, first declaration, then `config.verify`. Present-but-invalid `bouncer.verify` must not fall through to `config.verify` (hides plan `S12`). Format rules live only in `isValidVerifyCommand` (plan `S12` + runtime `VERIFY_COMMAND_INVALID`). `readAffectedPaths` uses the same pointer rule: named task alone when it exists, else union across task docs.
