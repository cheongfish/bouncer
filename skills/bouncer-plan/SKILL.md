---
name: bouncer-plan
description: "Use only when the user explicitly asks to plan a Bouncer blueprint (for example /bouncer-plan). Author an epic/blueprint/tasks, scaffold the docs, inject graph suggestions, confirm affected_paths, approve, and pass the plan gate."
---
# /bouncer-plan

**Plugin root.** Every shell block below opens with

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

because each block runs in a fresh shell — the assignment does not carry over,
so it is repeated rather than exported once. Resolution order:
`BOUNCER_HOME` (manual override) → `CLAUDE_PLUGIN_ROOT` (Claude Code, and Codex
compatibility) → `PLUGIN_ROOT` (Codex native). If none are set, `node` fails on
a path starting with `/scripts` — set `BOUNCER_HOME` to the directory that
contains `scripts/bouncer`.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Re-entrant planning: create a new epic, or add a blueprint to an existing epic.
Follow this sequence exactly.

If the user supplied a description with this invocation, treat it as the request;
otherwise ask before scaffolding.

**Preflight.** If `.bouncer/` is missing, stop and tell the user to run
`/bouncer-init` first.

**Project Distill.** Read `.bouncer/context/Distill.md` before discovery/
authoring. If it is missing, tell the user to run `bouncer init` (or create the
file). Apply matching Invariants / Gotchas / Decisions when framing scope and
Constraints.

Skill flow (recommended): `discovery` (`skills/discovery/SKILL.md`) → `spec-authoring` (`skills/spec-authoring/SKILL.md`) → `graphify-runner` (`skills/graphify-runner/SKILL.md`) → `minimality` (`skills/minimality/SKILL.md`).

1. **Discover.** Use the `discovery` skill (`skills/discovery/SKILL.md`) to clarify the request into goal, scope,
   non-goals, and success criteria. Confirm with the user before scaffolding.
   The success criteria are not scratch work: they become the numbered
   `## Success criteria` list in the epic body in step 4.

2. **ID allocation.** Scan `.bouncer/context/epics` for the next sequential id
   (`EPIC-002` after `EPIC-001`; `BP-002` within an epic). Show the suggested id
   and let the user override it.

3. **Scaffold.** Create the empty document set with correct frontmatter using
   `bouncer scaffold`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold epic --id <EPIC-id> --name <slug>
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold blueprint \
     --epic-dir <.bouncer/context/epics/EPIC-id-slug> --id <BP-id> --name <slug>
   ```
   The epic and blueprint outputs must both remain under
   `.bouncer/context/epics/...`.
   (Skip `scaffold epic` when adding a blueprint to an existing epic.) Scaffold
   defaults: epic/blueprint `draft`, tasks `draft`, verification `pending`,
   review `pending`. Do **not** create BP `distill.md` here — `/bouncer-finalize`
   scaffolds it with `bouncer scaffold distill`.

4. **Author.** Use the `spec-authoring` skill (`skills/spec-authoring/SKILL.md`) to write the epic, blueprint, and
   tasks bodies. Fill every implementation-ready section in `tasks.md` before
   approval — Goal & intent, Interface, Touch, Do not touch, Constraints,
   Checklist. Those sections are the sole brief for `/bouncer-execute`. Write
   Touch per file with a verb rather than per directory, and put non-path rules
   in Constraints.
   Also replace scaffold default frontmatter `title` values (and set
   `bouncer.commit_type` on the blueprint when not `feat`):
   `/bouncer-finalize` turns blueprint `title` into the commit subject and
   tasks/verification `title` into body bullets, following `.gitmessage`.

5. **Graph suggestions.** Use the `graphify-runner` skill (`skills/graphify-runner/SKILL.md`) to
   run `bouncer graph-sync` (plan-time freshness for **source** + **context**
   graphs), query both `graphify-out/source` and `graphify-out/context`, and write
   `bouncer.graph.suggested_paths` into `tasks.md`. If graphify is
   unavailable, it leaves `suggested_paths` empty, records a graceful fallback in
   `bouncer.graph.basis`, tells the user how to install/enable Graphify
   (`pip install graphifyy && graphify install`, then `graphify.enabled: true`),
   and says so so the user can seed paths manually.
   Scaffold leaves `basis` empty on purpose, so this step must run: G4 fails
   until a real basis is recorded.

6. **affected_paths (user-confirmed).** Propose `bouncer.affected_paths` in
   `tasks.md` seeded from `suggested_paths`, then **have the user confirm or
   edit** it. It must be non-empty (gate G5). Write the confirmed value into
   `tasks.md` frontmatter.
   Before finalizing `affected_paths` and the Checklist, you may run the
   `minimality` skill (`skills/minimality/SKILL.md`) (advisory, not a gate) to challenge new dependencies,
   abstractions, or files and record the rationale.

7. **Approval (explicit).** Ask the user to approve. On approval, transition
   `bouncer.status`: epic `draft → approved`, blueprint `draft → approved`, tasks
   `draft → ready`. Never approve silently.

8. **Pointer.** Record the active blueprint:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node -e "require('${BOUNCER_ROOT}/scripts/lib/current').writeCurrent({repoRoot:process.cwd(),blueprint:'<blueprint dir>',base:require('fs').existsSync('.bouncer/config.json')?JSON.parse(require('fs').readFileSync('.bouncer/config.json','utf8')).base_branch:'develop'})"
   ```
   (Equivalently: write `.bouncer/current` as `{ "blueprint": "<dir>", "base": "<config.base_branch>" }`.)

9. **Gate.** Run `bouncer validate --gate plan` and report:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate plan
   ```
   Gate `plan` checks G1 epic approved, G2 blueprint approved, G3 tasks ready,
   G4 `graph.suggested_paths` present and `graph.basis` non-empty, G5
   `affected_paths` non-empty, G10 the five gated sections present and
   placeholder-free (Constraints is authored but not gated), G11 Touch justifies every
   `affected_paths` entry, G12 Do not touch must not overlap `affected_paths`.
   Fix any reported failure and re-run until it passes. Then point the user at
   `/bouncer-execute`.
