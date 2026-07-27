---
description: Author a Bouncer epic/blueprint/tasks, scaffold the docs, inject graph suggestions, confirm affected_paths, approve, and pass the plan gate.
argument-hint: [epic or blueprint description]
---

# /bouncer-plan

Re-entrant planning: create a new epic, or add a blueprint to an existing epic.
Follow this sequence exactly.

Skill flow (recommended): `discovery` → `spec-authoring` → `graphify-runner` → `minimality`.

1. **Discover.** Use the `discovery` skill to clarify the request into goal, scope,
   non-goals, and success criteria. Confirm with the user before scaffolding.

2. **ID allocation.** Scan `.bouncer/context/epics` for the next sequential id
   (`EPIC-002` after `EPIC-001`; `BP-002` within an epic). Show the suggested id
   and let the user override it.

3. **Scaffold.** Create the empty document set with correct frontmatter using
   `bouncer scaffold`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" scaffold epic --id <EPIC-id> --name <slug>
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" scaffold blueprint \
     --epic-dir <.bouncer/context/epics/EPIC-id-slug> --id <BP-id> --name <slug>
   ```
   The epic and blueprint outputs must both remain under
   `.bouncer/context/epics/...`.
   (Skip `scaffold epic` when adding a blueprint to an existing epic.) Scaffold
   defaults: epic/blueprint `draft`, tasks `draft`, verification `pending`,
   review `pending`, distill `draft`.

4. **Author.** Use the `spec-authoring` skill to write the epic, blueprint, and
   tasks bodies. Fill all five implementation-ready sections in `tasks.md`
   before approval — Goal & intent, Interface, Touch, Do not touch, Checklist.
   Those sections (plus the checklist) are the sole brief for `/bouncer-execute`.

5. **Graph suggestions.** Use the `graphify-runner` skill to query the source
   graph and write `bouncer.graph.suggested_paths` into `tasks.md`. If graphify is
   unavailable, it leaves `suggested_paths` empty, records a graceful fallback in
   `bouncer.graph.basis`, and says so so the user can seed paths manually.
   Scaffold leaves `basis` empty on purpose, so this step must run: G4 fails
   until a real basis is recorded.

6. **affected_paths (user-confirmed).** Propose `bouncer.affected_paths` in
   `tasks.md` seeded from `suggested_paths`, then **have the user confirm or
   edit** it. It must be non-empty (gate G5). Write the confirmed value into
   `tasks.md` frontmatter.
   Before finalizing `affected_paths` and the Checklist, you may run the
   `minimality` skill (advisory, not a gate) to challenge new dependencies,
   abstractions, or files and record the rationale.

7. **Approval (explicit).** Ask the user to approve. On approval, transition
   `bouncer.status`: epic `draft → approved`, blueprint `draft → approved`, tasks
   `draft → ready`. Never approve silently.

8. **Pointer.** Record the active blueprint:
   ```bash
   node -e "require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').writeCurrent({repoRoot:process.cwd(),blueprint:'<blueprint dir>',base:require('fs').existsSync('.bouncer/config.json')?JSON.parse(require('fs').readFileSync('.bouncer/config.json','utf8')).base_branch:'develop'})"
   ```
   (Equivalently: write `.bouncer/current` as `{ "blueprint": "<dir>", "base": "<config.base_branch>" }`.)

9. **Gate.** Run `bouncer validate --gate plan` and report:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate plan
   ```
   Gate `plan` checks G1 epic approved, G2 blueprint approved, G3 tasks ready,
   G4 `graph.suggested_paths` present and `graph.basis` non-empty, G5
   `affected_paths` non-empty, G10 all
   five implementation-ready sections present, G11 Touch justifies every
   `affected_paths` entry, G12 Do not touch must not overlap `affected_paths`.
   Fix any reported failure and re-run until it passes. Then point the user at
   `/bouncer-execute`.
