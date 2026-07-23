# Superpowers Integration Strategy

## Summary

`sdd-plugin` and `superpowers` should be composed as separate layers, not treated
as competing workflow systems.

```text
superpowers = agent behavior / methodology layer
sdd-plugin  = project governance / deterministic harness layer
```

`superpowers` is useful for improving how an agent thinks and works: design
discussion, TDD discipline, systematic debugging, planning, code review, and
branch completion. `sdd-plugin` exists for a different problem: standardizing a
team's Spec-Driven Development cycle with shared artifacts, explicit approval
states, verification gates, review records, affected path controls, and
finalization rules.

The intended relationship is:

```text
superpowers helps the agent work well.
sdd-plugin makes the team workflow auditable and enforceable.
```

## Portfolio Positioning

The project should not be positioned as a replacement for Superpowers. A better
framing is:

> Superpowers provides a strong agent methodology layer for brainstorming, TDD,
> debugging, planning, and review. For team use, we also needed a governance
> layer that standardizes development cycles, records approval and verification
> state, constrains commit scope, and turns plans into deterministic gates.
> `sdd-plugin` was built to provide that Spec-Driven Development layer.

Shorter version:

> `sdd-plugin` is a team governance layer for AI-assisted development. It
> complements methodology plugins such as Superpowers by turning specs and plans
> into approved blueprints, verification records, review gates, affected path
> controls, and finalize-ready artifacts.

Avoid framing such as:

- "Superpowers is insufficient."
- "sdd-plugin replaces Superpowers."
- "sdd-plugin is better than Superpowers."

The more accurate distinction is:

```text
Superpowers: agent behavior layer
sdd-plugin: team governance layer
```

## Composition Model

Recommended usage:

```text
General coding:
  superpowers

SDD-governed feature work:
  superpowers + sdd-plugin

Domain-specific work:
  superpowers + sdd-plugin + one focused domain/reference plugin
```

During SDD-governed work:

1. Use Superpowers for brainstorming, TDD, systematic debugging, and review
   discipline.
2. Use `/sdd-plan` to create the official epic, blueprint, tasks, and affected
   path records.
3. Use `/sdd-execute` to create the SDD worktree, implement the task checklist,
   run verification, and pass the execute gate.
4. Use `/sdd-finalize` to publish distillation, validate the final gate, commit
   remaining in-scope files, and prepare push/PR flow.

`sdd-plugin` should be the source of truth for SDD state:

```text
context/epics/**/blueprint.md
context/epics/**/tasks.md
context/epics/**/verification.md
context/epics/**/review.md
context/epics/**/distill.md
.sdd/current
```

Superpowers-generated plans or specs may be useful as drafts, but they should
not replace the SDD artifacts once a blueprint is active.

## Methodology Profile

SDD selects how verify and review work is performed via
`.sdd/config.json` → `methodology.profile`. The default is `native`.

```text
methodology.profile:
  native       — agent-native verify/review; no external plugin required
  superpowers  — delegate verify/review methodology to Superpowers skills
```

`sdd-harness profile` (backed by `resolveProfile`) is the single source of truth
for the active profile. Precedence:

1. Explicit `methodology.profile` when it is a known value.
2. Else legacy `methodology.verification` / `methodology.review` both set to
   `superpowers` → treat as `superpowers`.
3. Else default `native`.

Adapters and `/sdd-execute` preflight resolve the profile before choosing a
verify/review path. Fail-closed plugin absence applies only when the active
profile is `superpowers`.

## Responsibility Boundaries

`sdd-plugin` owns:

- `.sdd/` initialization and governance files
- epic and blueprint scaffolding
- OKF frontmatter schema
- SDD status transitions
- `affected_paths`
- graph suggestions
- worktree creation for active blueprints
- commit safety
- verification and review state records
- plan, execute, and finalize gates
- final commit and PR preparation flow

Superpowers owns (when selected as the methodology profile):

- brainstorming and design refinement
- TDD discipline
- systematic debugging process
- implementation-plan writing style
- code review habits
- receiving review feedback
- verification-before-completion discipline
- general worktree guidance outside SDD-controlled work

When responsibilities overlap, the more specific SDD rule wins for SDD work.

Examples:

- Worktree creation: `/sdd-execute` wins.
- Source of truth for implementation tasks: `tasks.md` wins.
- Verify/review **deliverable contracts**: `validate --gate execute` judges
  status and body evidence — verification is G7 + G13 (`## Command` /
  `## Evidence`); review is G8 + G14 (`## Findings` + finding schema). Skills
  and adapters only write the documents; they do not declare gate success.
- Verify/review **methodology path**: `verification-adapter` /
  `review-adapter` follow `methodology.profile` — `native` is self-contained;
  `superpowers` may delegate to Superpowers skills.
- Commit scope: `affected_paths` and the commit safety hook win.

## Status Transition Boundary (B.4)

Human approval and agent execution stay on opposite sides of the same status
model. Agents may record progress; they must not self-approve scope or accept
review risk.

Human-owned transitions (require explicit user judgment):

```text
epic / blueprint → approved
review finding status → accepted (accepted risk)
```

Agent-performable transitions (progress and evidence only):

```text
tasks → in_progress
verification → passed (only after real command evidence)
```

Gates and commands enforce this boundary: plan/execute/finalize gates check
recorded state; agents write records and evidence, then run validate. They do
not skip human approval of blueprint scope or accepted review findings.

## Profile Quality Comparison (F.1)

When comparing `native` and `superpowers` on representative feature tasks, use
at least these metrics:

| Metric | What it captures |
| --- | --- |
| Gate pass rate | plan / execute / finalize gate outcomes |
| Test pass rate | project verification commands |
| Review defects | actionable findings found or missed |
| Change volume | diff size / files touched vs `affected_paths` |
| Elapsed time | wall-clock from plan start to finalize-ready |
| User interventions | approvals, corrections, and forced re-plans |

Keep the comparison task-matched and report both profiles against the same
blueprint scope so methodology differences are visible without changing the
governance contract.

## Collision Risks

Running multiple plugins is feasible, but conflicts are possible. The risky
areas are not the number of plugins by itself, but how much they inject or run
automatically.

Common collision points:

| Area | Risk | Mitigation |
| --- | --- | --- |
| SessionStart hooks | Multiple plugins may run startup hooks. | Keep SDD startup hooks short and deterministic. |
| Worktree creation | Superpowers and SDD can both create worktrees. | In SDD work, only `/sdd-execute` creates the worktree. |
| Plan artifacts | Superpowers saves plans under `docs/superpowers/plans`; SDD uses `tasks.md`. | Treat Superpowers plans as drafts or import sources. |
| Review loops | SDD and Superpowers both touch review. | Adapters follow `methodology.profile`; SDD gates (G8+G14) and `review.md` remain authoritative. |
| Verification claims | SDD and Superpowers both touch verification. | Adapters follow `methodology.profile`; SDD gates (G7+G13) and `verification.md` remain authoritative. |
| Commit scope | SDD commit guard may reject files outside `affected_paths`. | Add intentional doc paths to `affected_paths` or keep draft docs out of final commits. |

## Plugin Weight Policy

It is reasonable to use three plugins in a session, but avoid making all of them
equally authoritative.

Recommended layering:

```text
Methodology layer:
  superpowers

Project governance layer:
  sdd-plugin

Domain/reference layer:
  zero or one focused plugin, enabled when needed
```

`sdd-plugin` should stay lean:

- Avoid duplicating generic TDD, debugging, or planning methods already covered
  by Superpowers.
- Verify/review are deliverable contracts (G7+G13, G8+G14). The `native`
  profile needs no external plugin; fail-closed plugin absence applies only
  under the `superpowers` profile.
- Keep startup hooks short.
- Lazy-load project context where possible.
- Let deterministic harness commands own SDD validation.
- Avoid broad automatic file scans during every session.
- Avoid claiming ownership over non-SDD workflows.

## Ponytail Integration

Ponytail can be used as an implementation minimization layer:

```text
superpowers = how the agent works
sdd-plugin  = what the team records and gates
ponytail    = how small the implementation should be
```

This is a useful composition when the responsibilities stay separate.
Ponytail should help reduce unnecessary code, dependencies, abstractions, and
boilerplate inside an approved implementation task. It should not minimize away
SDD governance artifacts, required tests, verification records, review records,
or gate requirements.

Core boundary:

```text
Ponytail may minimize implementation.
Ponytail must not minimize SDD governance.
```

Do not treat these as Ponytail cleanup targets during SDD-governed work:

```text
context/epics/**
.sdd/**
verification.md
review.md
distill.md
sdd.affected_paths
validate gates
required tests
```

Recommended Ponytail usage by SDD phase:

| SDD phase | Ponytail mode | Reason |
| --- | --- | --- |
| `/sdd-plan` | `lite` or `off` | Planning and governance docs need enough context. |
| `/sdd-execute` start | `full` | Approved tasks can benefit from minimal implementation. |
| implementation | `full` | Prefer existing code, stdlib, native features, and small diffs. |
| verification fixes | `full` | Root-cause fixes should stay small, but required tests remain. |
| review | `/ponytail-review` as advisory | Useful for over-engineering review before the SDD review gate. |
| `/sdd-finalize` | `lite` or `off` | Distillation, PR body, and final governance records need clarity. |

Avoid `ultra` as a default for SDD-governed work. It can be useful for targeted
complexity reduction, but it may challenge already-approved scope or compress
documentation too aggressively.

## Plugin Composition Advisor

`sdd-plugin` is the right place to detect the current SDD lifecycle phase and
recommend a Ponytail mode. Ponytail owns its own mode, and Superpowers owns the
general methodology. SDD is the only layer that knows whether the active work is
planning, implementation, verification, review, or finalization.

Recommended responsibility split:

```text
sdd-plugin:
  detects the SDD phase
  reads active blueprint state
  recommends the appropriate coding mode

ponytail:
  owns lite/full/ultra/off behavior
  applies YAGNI, stdlib-first, native-first, and minimal-diff rules

superpowers:
  owns brainstorming, TDD, debugging, review discipline, and work habits
```

The advisor should be advisory by default. It should not silently switch another
plugin's persistent mode. Automatic switching can be surprising, make debugging
harder, and accidentally apply implementation-minimization rules to planning or
finalization documents.

Preferred interaction:

```text
SDD phase: execute
Recommendation: enable Ponytail full for implementation minimization.
Run: /ponytail full
Boundary: SDD docs, tests, verification, review, and affected_paths remain required.
```

Possible configuration:

```json
{
  "plugin_advisors": {
    "ponytail": {
      "enabled": true,
      "plan": "lite",
      "execute": "full",
      "verify": "full",
      "review": "review",
      "finalize": "lite",
      "auto_switch": false
    }
  }
}
```

Design rule:

```text
sdd-plugin detects phase.
sdd-plugin recommends mode.
ponytail owns mode.
user confirms activation.
```

## Superpowers Artifact Integration

Superpowers currently defaults to:

```text
brainstorming spec:
  docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md

writing-plans plan:
  docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md
```

Its own instructions allow user preferences to override these locations. That
means `sdd-plugin` does not need to intercept file writes. Interception would be
fragile because it depends on another plugin's internal paths and timing.

Preferred integration model:

```text
superpowers creates draft design/plan artifacts
sdd-plugin imports or adapts them into official SDD artifacts
sdd-harness validates the official SDD artifacts
```

Avoid:

```text
watch docs/superpowers/**
move files automatically into context/epics/**
rewrite SDD frontmatter from foreign free-form Markdown
```

This can cause race conditions, broken gates, unexpected commits, and tight
coupling to Superpowers implementation details.

## Recommended Feature: Import Adapter

A good future enhancement is an explicit import path:

```bash
sdd-harness import-superpowers --spec <path> --plan <path>
```

or a command-level flow:

```text
/sdd-plan --from-superpowers <spec-or-plan>
```

The adapter should:

1. Read a Superpowers spec or plan as draft input.
2. Scaffold the SDD epic and blueprint structure.
3. Convert design content into `blueprint.md` body.
4. Convert implementation tasks into `tasks.md` body.
5. Preserve harness-owned frontmatter.
6. Seed `sdd.graph.suggested_paths` where possible.
7. Propose `sdd.affected_paths` for user confirmation.
8. Require explicit user approval before status transitions.
9. Run `validate --gate plan`.

The source Superpowers files should remain unchanged unless the user explicitly
asks to move or delete them.

## Recommended Feature: SDD Preference Document

`sdd-plugin` can also generate a short preference document during init:

```text
.sdd/superpowers.md
```

Suggested content:

```text
When using Superpowers in this repository:
- During SDD-governed work, official specs and plans live in context/epics/**.
- Superpowers docs under docs/superpowers/** are drafts or supporting notes.
- Do not create a separate Superpowers worktree after /sdd-execute has started.
- Do not edit SDD-owned frontmatter directly.
- SDD gates decide official plan, execute, and finalize status.
- /sdd-execute verify and review follow methodology.profile (default native).
- With the superpowers profile, verify/review skills must be resolvable;
  execute fails closed only if they are missing.
```

This preference document can be referenced from project instructions or surfaced
by `/sdd-init`, but the deterministic behavior should still live in
`sdd-harness`.

## Development Principles

`sdd-plugin` should be developed with these constraints:

```text
Harness validate, scaffold, and finalize run without Superpowers.
Default methodology.profile is native; resolveProfile is the single resolver.
Execute verify/review are judged as deliverable contracts (G7+G13, G8+G14);
skills write docs only.
Fail-closed on missing Superpowers skills only when profile is superpowers.
Should compose cleanly with Superpowers as an optional profile.
Must own SDD state transitions (human approval vs agent progress — B.4).
Must not duplicate Superpowers as a generic methodology plugin.
Must keep SDD artifacts as the source of truth for SDD-governed work.
```

This keeps the plugin independently useful while making it a strong companion to
broader methodology plugins.
