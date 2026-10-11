I'll start `/bouncer-run` by resolving the plugin root, loading master rules, and running preflight on the approved blueprint.Preflight is ready — next I'll present the start-drive ACQ and wait for your choice.**AskUserQuestion — run.start_drive**
<!-- acq {"gate":"run.start_drive","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Hand remaining tasks to a coordinator drive?
2. **Recommend-why**: Given the task list, the DAG, and `affected_paths`, delegating now covers each ready wave until the blueprint is done. This approval covers the whole drive: neither autonomy value asks again per task; `interactive` only reports progress at each task boundary.
3. **Options**:
   - A) Start drive (Recommended)
   - B) Revise list/scope and reconfirm
   - C) Cancel

**Blueprint:** `.bouncer/context/epics/001-handler-timeout/blueprints/001-handler-timeout` (`approved`, scale `full`)

**Remaining tasks**

| Task | Status | depends_on | affected_paths |
| --- | --- | --- | --- |
| **001** `TASKS-001` (commit) | ready | — | `build/build-validation.js`, `lib/config-validator.js`, `fastify.js`, `lib/errors.js`, `lib/symbols.js`, `lib/handler-timeout.js`, `lib/context.js`, `lib/route.js`, `lib/request.js`, `lib/reply.js`, `lib/four-oh-four.js`, `test/handler-timeout.test.js`, `test/internals/initial-config.test.js` |
| **002** `TASKS-002` (commit) | ready | `TASKS-001` | `fastify.d.ts`, `types/instance.d.ts`, `types/route.d.ts`, `types/request.d.ts`, `types/errors.d.ts`, type tests, docs under `docs/Reference/*` and `docs/Guides/Detecting-When-Clients-Abort.md` |

**DAG:** `001` → `002` (ready wave: `001` only)

Reply with **A**, **B**, or **C**.