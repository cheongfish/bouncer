---
description: Author an SDD epic/blueprint/tasks, scaffold the docs, inject graph suggestions, confirm affected_paths, approve, and pass the plan gate.
argument-hint: [epic or blueprint description]
---

# /sdd-plan

Re-entrant planning: create a new epic, or add a blueprint to an existing epic.
Follow this sequence exactly.

## Importing a Superpowers draft (`--from-superpowers`)

When invoked as `/sdd-plan --from-superpowers <spec-or-plan path>`, seed the SDD
docs from an existing Superpowers artifact instead of authoring from scratch:

1. **Allocate ids** as in step 1 below (epic may already exist).
2. **Import.** Run the adapter (it scaffolds the doc set, injects the spec/plan
   into the blueprint and tasks bodies, seeds `sdd.graph.suggested_paths`, and
   proposes `affected_paths` — without changing any status or the source file):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" import-superpowers \
     --epic <EPIC-id> --epic-name <slug> \
     --blueprint <BP-id> --name <slug> \
     --plan <docs/superpowers/plans/...md>   # and/or --spec <...-design.md>
   ```
   (Use `--epic-dir <context/epics/EPIC-id-slug>` instead of `--epic/--epic-name`
   to import into an existing epic.) When both `--spec` and `--plan` are given,
   the spec becomes the blueprint body and the plan supplies the tasks.
3. **Review the draft.** Read the generated `blueprint.md` and `tasks.md`; refine
   the bodies with the `okf-authoring` skill if the imported content needs
   tightening. Do **not** hand-edit the harness-owned frontmatter.
4. **Continue at step 5 below** using the printed `proposed_affected_paths` as the
   seed for the user-confirmed `affected_paths`, then proceed through approval,
   pointer, and the `plan` gate exactly as in the from-scratch flow.

The source Superpowers file stays a draft and is never modified.

---

1. **ID allocation.** Scan `context/epics` for the next sequential id
   (`EPIC-002` after `EPIC-001`; `BP-002` within an epic). Show the suggested id
   and let the user override it.

2. **Scaffold.** Create the empty document set with correct frontmatter using
   `sdd-harness scaffold`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" scaffold epic --id <EPIC-id> --name <slug>
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" scaffold blueprint \
     --epic-dir <context/epics/EPIC-id-slug> --id <BP-id> --name <slug>
   ```
   (Skip `scaffold epic` when adding a blueprint to an existing epic.) Scaffold
   defaults: epic/blueprint `draft`, tasks `draft`, verification `pending`,
   review `pending`, distill `draft`.

3. **Author.** Use the `okf-authoring` skill to write the epic, blueprint, and
   tasks bodies. The `tasks.md` checklist is the execution source of truth.

4. **Graph suggestions.** Use the `graphify-runner` skill to query the source
   graph and write `sdd.graph.suggested_paths` into `tasks.md`. If graphify is
   unavailable, it leaves `suggested_paths` empty and says so.

5. **affected_paths (user-confirmed).** Propose `sdd.affected_paths` in
   `tasks.md` seeded from `suggested_paths`, then **have the user confirm or
   edit** it. It must be non-empty (gate G5). Write the confirmed value into
   `tasks.md` frontmatter.

6. **Approval (explicit).** Ask the user to approve. On approval, transition
   `sdd.status`: epic `draft → approved`, blueprint `draft → approved`, tasks
   `draft → ready`. Never approve silently.

7. **Pointer.** Record the active blueprint:
   ```bash
   node -e "require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').writeCurrent({repoRoot:process.cwd(),blueprint:'<blueprint dir>',base:require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current')&&require('fs').existsSync('.sdd/config.json')?JSON.parse(require('fs').readFileSync('.sdd/config.json','utf8')).base_branch:'develop'})"
   ```
   (Equivalently: write `.sdd/current` as `{ "blueprint": "<dir>", "base": "<config.base_branch>" }`.)

8. **Gate.** Run `sdd-harness validate --gate plan` and report:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate plan
   ```
   Gate `plan` checks G1 epic approved, G2 blueprint approved, G3 tasks ready,
   G4 `graph.suggested_paths` present, G5 `affected_paths` non-empty. Fix any
   reported failure and re-run until it passes. Then point the user at
   `/sdd-execute`.
