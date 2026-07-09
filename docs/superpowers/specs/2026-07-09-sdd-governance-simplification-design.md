# SDD Plugin — Governance Simplification Design

Date: 2026-07-09
Status: Approved
Implementation plan: docs/superpowers/plans/2026-07-09-sdd-governance-simplification.md
Builds on:
- `2026-07-01-sdd-plugin-schema-gates-design.md` (schema, gates G1–G9)
- `2026-07-01-sdd-markdown-surface-design.md` (commands, skills, hooks)
- `docs/superpowers-integration.md` (layer positioning)

## Scope

Simplify the SDD governance layer so it stays thin on top of
**superpowers + ponytail + graphify**, without weakening auditable gates.

In scope:

1. Replace self-contained `verification-loop` / `review-loop` with thin
   **template-injection adapters** that drive superpowers skills to write SDD
   documents.
2. Make **superpowers required** for `/sdd-execute` verify/review (fail closed).
3. Treat completed `tasks.md` as the **sole implementation brief**; add plan-gate
   **implementation-ready** checks (G10–G12).
4. Keep Claude as the first markdown surface; Cursor/Codex later by swapping
   surface only.

Out of scope (unchanged unless noted):

- Deterministic harness ownership (schema, validate, commit-guard, finalize core)
- Ponytail advise (advisory-only)
- Graphify session-graph + suggested_paths (best-effort)
- Cursor/Codex markdown ports
- Adapter registry for non-superpowers methodology (slot reserved only)

## Changes from Prior Design

| Prior | This design |
|---|---|
| `verification-loop` / `review-loop` fully self-contained | Thin adapters; methodology owned by superpowers |
| Superpowers optional soft coexistence | **Required** peer for execute verify/review |
| Implement = “tasks checklist as SoT” (loose) | Tasks-as-brief with mandatory sections + plan gates |
| Plan gate G1–G5 | Plan gate G1–G5 **plus** G10–G12 (implementation-ready) |
| Fallback to inline verify/review if deps missing | **No** self-contained fallback |

Locked decisions that still hold: OKF frontmatter, status enums, G6–G9,
`affected_paths` + commit-safety, worktree isolation, dry-run finalize defaults.

---

## 1. Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Markdown surface (Claude first; Cursor/Codex later)    │
│  /sdd-init  /sdd-plan  /sdd-execute  /sdd-finalize      │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Thin adapters                                          │
│  verification-adapter   review-adapter                  │
│  - inject SDD template + bind paths/status rules        │
│  - invoke superpowers skill                             │
│  - assert frontmatter/status → hand back to command     │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
   superpowers:                   superpowers:
   verification-before-completion requesting-code-review
              │                           │
              └─────────────┬─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Deterministic core                                     │
│  sdd-harness validate/gates · commit-safety · schema    │
│  artifacts: tasks.md · verification.md · review.md      │
└─────────────────────────────────────────────────────────┘
```

### Layer boundaries

| Layer | Owns |
|---|---|
| **SDD** | Templates, status transitions, gates, `affected_paths`, commit scope |
| **Superpowers** | How to verify / how to review (methodology) |
| **Adapters** | Template injection + “write into this SDD doc” contract only |
| **Ponytail** | Phase mode advice (soft) |
| **Graphify** | `suggested_paths` (best-effort) |
| **Other plugins** | Unrestricted coexistence — SDD does not block them |

### Positioning (unchanged intent)

```text
superpowers = agent behavior / methodology
sdd-plugin  = team governance / deterministic harness
```

SDD is not a replacement for superpowers; it is the governance layer that turns
specs into approved blueprints, verification records, review gates, and
finalize-ready artifacts **using** this stack.

---

## 2. Dependency Policy

| Dependency | Policy | On absence |
|---|---|---|
| **superpowers** | **Required** for `/sdd-execute` verify & review | Fail closed; no status transition; install guidance |
| **ponytail** | Soft / advisory | `advise` skips; gates still valid |
| **graphify** | Best-effort | `suggested_paths=[]`; user seeds `affected_paths` |
| **Any other plugin** | Open coexistence | No SDD involvement |

### Why fail closed (no bundled fallback)

The product goal is SDD development **through** superpowers, ponytail, and
graphify. A minimal inline verify/review fallback would re-grow into a second
methodology stack and undo the complexity reduction.

### Future substitution (not in this change)

Reserve config shape only — do not implement multiple adapters yet:

```json
{
  "methodology": {
    "verification": "superpowers",
    "review": "superpowers"
  }
}
```

Default and only supported value today: `"superpowers"`. A later adapter
registry can open substitution without loosening the SDD document contract.

### Detection

At `/sdd-execute` preflight (before worktree implement completes into
verify/review — preferably at execute entry):

1. Resolve whether superpowers skills used by adapters are available in the
   session (plugin installed / skill name resolvable per Claude Code rules).
2. If not → stop with a clear message: install superpowers (or enable the
   plugin), then re-run. Do not enter verify/review adapters.

Exact detection mechanism is an implementation detail of the Claude surface
(skill invocation failure vs explicit plugin check); the **behavior** is fail
closed.

---

## 3. Adapter Contract

Replace:

- `skills/verification-loop/` → `skills/verification-adapter/`
- `skills/review-loop/` → `skills/review-adapter/`

Each adapter is a **short** skill with four steps only.

### Common flow

1. **Load** — existing scaffolded `verification.md` or `review.md`, relevant
   `.sdd/templates/*`, and bind context (`verify` command, worktree cwd, base
   SHA, `tasks.md` path).
2. **Inject** — when invoking the superpowers skill, pass the SDD template and
   rules as input: write **into this file**, with this frontmatter/body schema,
   and these allowed status transitions.
3. **Invoke**
   - verification → `superpowers:verification-before-completion` (and the
     project `verify` command as the evidence command)
   - review → `superpowers:requesting-code-review` (and resolve findings via
     receiving-code-review discipline until clean)
4. **Assert** — file matches schema; statuses transitioned correctly. On
   failure: do not leave partial “success” statuses; report and stop. On
   success: caller runs `sdd-harness validate --gate execute`.

### Verification adapter outputs

- Target: existing `verification.md` only (never create a new file).
- Body: exact command run, exit/evidence summary.
- Status: `verification` `pending → passed`; `tasks` `→ verified`.
- On unresolved failure: no success transitions.

### Review adapter outputs

- Target: existing `review.md` only.
- If `sdd.review.required === false`: skip loop; leave status at scaffold
  default (`pending`); gate G8 still satisfied by policy.
- Body: findings and resolutions.
- Status: `→ accepted` only when no actionable unresolved findings remain.
- Review should judge the diff against tasks checklist, interface section, and
  do-not-touch list.

### Template injection principle

Superpowers does not invent a parallel artifact path. The adapter supplies the
SDD document (or template-bound path) so the methodology skill **authors into
the governance record from the start**, rather than producing a foreign format
that is later converted.

### Command wiring

`/sdd-execute` calls the adapters instead of the old loops. `/sdd-init`
workflow text and any skill references update accordingly. `okf-authoring` and
`graphify-runner` stay.

---

## 4. execute.implement — Tasks as Sole Brief

### Intent

A completed `tasks.md` is the **only work brief** for implementation. The agent
writes code autonomously against that brief. Blueprint/epic are not re-interpreted
during implement; if the brief is ambiguous, return to plan.

### Reading vs deciding

| Allowed | Forbidden |
|---|---|
| Read code, tests, and repo context needed to implement | Treat blueprint/epic as a second requirements source mid-implement |
| Follow tasks sections as the decision SoT | Invent scope, interface, or success criteria not in tasks |

“Tasks only” means **decision authority**, not a ban on reading source.

### Required `tasks.md` body sections (implementation-ready)

Authoring (`/sdd-plan` + `okf-authoring`) and the tasks template must produce:

| Section | Purpose |
|---|---|
| **목적·의도** (Goal & intent) | Why; success conditions |
| **인터페이스** (Interface) | Public contracts, I/O, boundaries that must not drift |
| **수정할 부분** (Touch) | Modules/paths/responsibilities; must align with `affected_paths` |
| **절대 수정 금지** (Do not touch) | Files/modules/behaviors that must not change |
| **체크리스트** (Checklist) | Verifiable completion items (existing task-list shape) |

Section headings may be bilingual or English aliases in the template, but the
gate checks for a stable, documented heading set (implementation picks one
canonical set and tests lock it).

### Implement rules in `/sdd-execute`

1. Use the five sections + checklist as the brief.
2. Modify only within `affected_paths`; commit-safety enforces at commit time.
3. Honor the do-not-touch list; path overlap is blocked at plan (G12); semantic
   violations are caught in review.
4. If blocked by ambiguity or contradiction → stop and send the user back to
   `/sdd-plan` (no speculative expansion of scope).

---

## 5. Plan Gate Extensions (G10–G12)

Existing plan checks G1–G5 remain. Add body/path consistency checks on
`tasks.md`:

| Code | Check |
|---|---|
| **G10** | All five implementation-ready sections present and non-empty |
| **G11** | Every `affected_paths` entry is justified by the Touch section (path prefix or explicit mention — exact rule fixed in implementation plan; must be deterministic) |
| **G12** | Intersection of do-not-touch paths and `affected_paths` is empty |

`validate --gate plan` fails closed on any of G10–G12. Execute must not proceed
on a blueprint that failed plan.

Structural schema checks (S*) unchanged. Empty `affected_paths` remains G5.

### Authoring impact

- `.sdd/templates/tasks.md` (written by init) gains the five section stubs.
- `okf-authoring` / `/sdd-plan` instruct the model to fill them before approval.
- User approval (`draft→ready`) still required; gates run after approval attempt
  as today.

---

## 6. Components & Data Flow

### Unchanged

- `sdd-harness` CLI core (except new plan gate checks)
- `/sdd-init`, `/sdd-plan`, `/sdd-finalize` (plan/init text + tasks template)
- `commit-safety`, `session-graph`
- `okf-authoring`, `graphify-runner`
- Ponytail `advise`

### Changed

| Before | After |
|---|---|
| `verification-loop` | `verification-adapter` |
| `review-loop` | `review-adapter` |
| `/sdd-execute` → self-contained loops | preflight → implement (tasks-as-brief) → adapters → execute gate |
| Plan G1–G5 | Plan G1–G12 |

### Execute flow

```text
/sdd-execute
  ├─ preflight: superpowers resolvable? ──no──► stop (fail closed)
  ├─ worktree + implement from tasks.md brief only
  ├─ verification-adapter
  │    load + inject template → superpowers verify skill
  │    assert verification.md + tasks→verified
  ├─ review-adapter
  │    if review.required=false → skip
  │    else inject → superpowers review skills
  │    assert review.md → accepted
  └─ sdd-harness validate --gate execute   (G6–G8)
```

### Platform

- Claude: adapter skills + command markdown (this delivery).
- Cursor/Codex: same harness and gates; replace markdown surface later.
- No new harness “bind-template” CLI in this redesign (deferred).

---

## 7. Error Handling

### Preflight / entry

| Situation | Behavior |
|---|---|
| Superpowers missing | Fail closed; no verify/review; no success status writes |
| No `.sdd/current` / blueprint | Existing behavior — abort |
| Plan gate failed (incl. G10–G12) | Refuse execute entry |

### Adapters

| Situation | Behavior |
|---|---|
| Verify cannot pass | Do not set `passed` / `verified` |
| Unresolved review findings | Do not set `accepted` |
| Schema/assert failure | No success transition; report |
| `review.required === false` | Skip review loop (G8 via policy) |

### Implement

| Situation | Behavior |
|---|---|
| Ambiguous tasks / interface conflict | Return to plan; no guessing |
| Write outside `affected_paths` | commit-safety blocks commit |
| Do-not-touch vs paths | G12 at plan; review assists at runtime |

### Soft deps

Ponytail/graphify absence does not fail execute gates.

### Non-goals

- No automatic fallback to deleted self-contained loops
- No mid-implement rewrite of requirements from epic/blueprint

---

## 8. Testing

### Unit / structural

| Target | Assert |
|---|---|
| `verification-adapter` / `review-adapter` SKILL.md | Inject, invoke superpowers, assert, fail closed, no fallback prose |
| `/sdd-execute.md` | Preflight, adapter calls (not old loops), tasks-as-brief rules |
| `validate` plan gate | G10–G12 pass/fail fixtures |
| Existing gates, commit-safety, advise | Regression green |

### Fixtures

- Minimal tasks with all five sections → G10 pass
- Missing section → G10 fail
- `affected_paths` vs Touch mismatch → G11 fail
- Do-not-touch ∩ `affected_paths` → G12 fail
- Adapter assert: valid vs invalid frontmatter/status (as far as pure tests allow without live superpowers)

### Explicitly not tested here

- Live superpowers e2e inside CI
- LLM implement quality
- Cursor/Codex surfaces

### Success criteria

- Prior suite remains green
- New adapter structural tests + G10–G12 tests + execute wiring tests pass

---

## 9. Migration

1. Rename/replace skill directories; update tests that targeted `verification-loop`
   / `review-loop`.
2. Update `/sdd-execute`, `/sdd-init` workflow copy, `docs/superpowers-integration.md`
   boundaries (review/verify: SDD record + superpowers methodology via adapter).
3. Extend `checkGate('plan', …)` with G10–G12; extend tasks template at init.
4. Existing in-flight blueprints with old tasks bodies will fail G10 until
   sections are filled — acceptable; document in workflow/governance notes.
5. Remove obsolete self-contained loop skills after adapters land (no dual
   maintain).

---

## 10. Implementation Order (for writing-plans)

Suggested task breakdown (not a full plan):

1. Tasks template + G10–G12 in `validate.js` + tests
2. `verification-adapter` skill + structural tests; delete/replace old loop
3. `review-adapter` skill + structural tests; delete/replace old loop
4. `/sdd-execute` (+ init workflow) wiring + preflight fail-closed
5. Docs: integration strategy + governance/workflow snippets
6. Final review / suite green

---

## Open Points Deferred

- Exact G11 matching algorithm (prefix vs path-token) — fix in implementation plan
- Exact Claude-side superpowers detection API — fix in implementation plan
- `methodology.*` adapter registry — config stub optional; no multi-impl
- Cursor/Codex surface ports
- Elevating template bind into `sdd-harness` CLI (Approach 3)
