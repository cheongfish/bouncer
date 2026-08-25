---
distill:
  id: validate-gates
  paths:
    - scripts/**
    - test/**
  pulls: []
---
# validate-gates

Rules for validation, verification, and gate contracts.

## Invariants

- `.bouncer/config.json` is parsed only in `scripts/src/lib/config.ts`
  (`readConfigResult` / `readConfig`). `missing` is ENOENT only; any other read
  or JSON error is `invalid`. Neither function checks value shape. Callers keep
  their own `null` vs `{}` vs typed-throw mapping (`VERIFY_CONFIG_MISSING` /
  `VERIFY_CONFIG_INVALID`).

- `validateBlueprint` stays in `validate.ts` — the public-name-regression
  allowlist keys a retired protocol token to that filename.

- `isValidGraphBasis` is implemented once in `validate-structural.ts`;
  `validate-gates.ts` (G4) imports it and must not reimplement.

- Commit-message subject/body come from document fields, not free-form finalize
  prose: blueprint `commit_type` + task `title` (blueprint `title` only when the
  task title is empty) + task `commit_intent` (exactly two Korean `~함`/`~임`
  strings) + verification `title`. `bouncer.commit_intent` is authored only on task
  documents; a blueprint keeps `commit_type` and `title` but never
  `commit_intent`. Finalize remainder subject is blueprint `title` and its
  배경·의도 is the highest-numbered valid task `commit_intent`. Keep
  Epic/Blueprint/Distill ids and file paths out of those fields.

- Optional `tasks.bouncer.verify` is a single executable argv string only (no
  shell chaining, redirection, or `cd` prefix) so the evidence command is
  reproducible from the repository root.

- `tasks.bouncer.graph.basis` is a non-empty legacy string **or** a non-empty
  array of entries (`graph` `source`|`context`, `status` in
  `updated`|`reused`|`fail-skip`|`skip-disabled`|`missing`, non-empty
  `query`/`result`). S9 and G4 must call the same `isValidGraphBasis` helper.

- Execute G6–G8 / G13 / G14 and finalize commit-bullet titles judge only the
  pointer’s task unit (`loadBlueprintDocs` → `docs.taskUnits`, `resolveTaskUnit`
  via 019 `entriesForVerify`) — never a sibling unit’s documents.

- `runVerification` / `recordVerificationResult` write the target unit’s
  `verification.md` only (`verificationRel`); a missing file is
  `VERIFY_DOCUMENT_MISSING` with no create.

- `closed` is the blueprint lifecycle terminal status: `finalize --yes` stamps
  the blueprint `index.md` and stages that path, `scaffold task` refuses a
  `closed` blueprint, and `listReadyBlueprints` excludes it. Work on a finished
  blueprint goes to a new blueprint, not a new task on the old one.

- `bouncer scaffold blueprint --scale light|full` validates against
  `SCALE_ENUM` before the first write (exit 2 on anything else). `light` writes
  four plan docs — blueprint `index.md` plus
  `tasks/001/{tasks,verification,review}.md`, 97 lines as scaffolded — and no
  `context-review.md`; plan G10 then requires only `Goal & intent`, `Touch`,
  and `Checklist`. G3–G5, G11, G12, and every execute / commit gate are
  unchanged on light.

## Gotchas

- CLI command registry lookup must use own keys (`Object.hasOwn` or
  `Object.create(null)`). `COMMANDS[cmd]` on a plain object treats `toString` /
  `constructor` as hits and throws instead of unknown-command stderr + exit 2.
  Help text follows registry declaration order; dispatch is key lookup and does
  not depend on that order.

- `verification.md` is rewritten by `recordVerificationResult` — never put
  author declarations there; declare an optional verify command on `tasks.md` as
  `bouncer.verify`.

- Empty `diff_sha`, `disposition`, or `quiz_score` on the blueprint
  comprehension entry is G16 **record missing**, not hash mismatch — scaffold
  defaults must not collapse into the wrong failure branch.

- Scaffold defaults `graph.basis` to `[]`; an empty array fails G4 until
  graphify-runner records per-graph entries. Never omit an entry when a query
  cannot run — leave the mapped `status` (graph absence remains a state).

- `scaffoldTask`'s closed-blueprint guard must fire before the `tasks/<NNN>`
  existence check and any `writeRel`, or a partial unit survives and the next
  scaffold fails with `already exists`. A missing or unparsable blueprint
  `index.md` must fall through unjudged — a corrupt index cannot block
  scaffolding.

- finalize decides the `closed` lock **after** the out-of-scope check, and a
  re-run on an already-closed blueprint returns `closed: null` (idempotent).
  `validate` G2 branches its message by blueprint status so `closed` reads as
  already finalized, not as unapproved `draft`.

- Execute G14 review findings entries need `id`, `severity`, and `status`
  (`resolved` | `accepted`) — `disposition` is not the field name — plus a
  non-empty `note` on every `accepted` finding. Plan G18 reuses that contract on
  `context-review.md`; a present non-array `context_review.findings` is a format
  failure, not something to coerce to `[]`.

- Turning on plan G18 before the active blueprint has an `accepted`
  `context-review.md` makes `bouncer current --set` fail on that blueprint.
  Order: document+CLI → skill/agent + this BP’s review file → G18.

- `scaffold context-review` rejects an existing file (explicit throw). Do not
  treat it like `scaffoldExplain`’s silent no-op.

- `bouncer import` without `--yes` is dry-run (plan JSON on stdout only);
  `--message` alone does not apply — apply needs `--yes --message`. Empty
  `entries` on `applyImport` is `ok: true`, `committed: false`, no files and no
  commit, distinct from limit/refusal failures.

- `templateNameFor` uses a `<base>-light.md` template only when that key
  exists and otherwise falls back to the shared template — verification
  deliberately has no light variant. Do not add a duplicate `-light` body that
  is byte-identical to its shared template; the copies drift silently.

## Decisions

- `config.autonomy` (`auto` | `interactive`) lives only in
  `.bouncer/config.json` — not document frontmatter, not validate. Missing or
  out-of-enum → warn and treat as `auto` (do not branch on a dedicated auto
  path). `auto`: start ACQ only; skip commit/next-task ACQs inside the loop.
  `interactive`: same loop plus a next-task boundary ACQ after each closed task.
  On stop (verify re-fail, review bounce cap 2, scope violation, or user
  decline), leave the pointer and execute worktree; resume by manually closing
  that task with `/bouncer-execute`, then invoke `/bouncer-run` again — no
  auto-retry.

- Commit gate does **not** read `explain.md`. It re-checks the pointer task with
  G6/G7/G8 and staged paths with **G17** (`deps.stagedFiles`; git failure is a
  G17 failure, not a throw). G16 (`finalize`) requires every task `verified`,
  explain `published` with written sections, and one blueprint comprehension
  entry (array last; 0.7 multi-entry docs stay readable) whose `diff_sha`
  matches `range_from..HEAD` excluding `.bouncer/context/`. `quiz_score` is
  required — empty fails as record missing. Hash drift after the quiz needs
  body/`diff_sha` refresh only, not a re-quiz. Global Distill is skill promotion
  + `makeAllowed`, not a body-quality gate. G9 and G15 are retired (numbers
  vacant).

- Plan G3–G5·G10–G12 still apply to **every** task document (not narrowed by the
  pointer). G3 accepts `ready` | `in_progress` | `verified` so a finished sibling
  does not block next-task `--set`; `draft` still fails G3. When
  `docs.taskUnits` is present, skip structural checks on root `verification` /
  `review` only if that `rel` was already seen on a unit leaf — orphan root
  leftovers must still be S-checked. Structural **S19** (`type` vs path-expected
  kind) and **S20** (blueprint `scale` outside `SCALE_ENUM`) always run, and
  missing `scale` still passes for 0.7 docs.

- Verify command resolution (`readVerifyCommand`): if the pointer names a task
  doc that exists, read that doc’s `bouncer.verify` only; otherwise walk
  `listTasksDocs` in number order, take
  the first declaration, then fall back to `config.verify`. A present-but-invalid
  `bouncer.verify` must not fall through to `config.verify` — that would hide a
  plan-time `S12` miss. Format rules live only in `isValidVerifyCommand`, which
  plan `S12` and runtime `VERIFY_COMMAND_INVALID` both reuse. `readAffectedPaths`
  follows the same pointer rule: the named task document alone when it exists,
  otherwise the union across task docs.

- `/bouncer-plan` Author asks before writing `tasks.bouncer.verify` when root
  build/container signals exist; never write from detection alone and never edit
  `config.verify` there. Container-up + test must be one project script (single
  argv); the wrapper pattern (worktree compose project name, docker-absent
  skip→0) lives in `docs/configuration.md`.

