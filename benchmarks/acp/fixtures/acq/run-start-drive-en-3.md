Starting `/bouncer-run`: resolving plugin root and project root, then loading master rules and running preflight.Scale is full. Running preflight and loading the ACQ/CLI rules.Preflight passed. Blueprint is **approved**, scale **full**, autonomy **auto**, delegable.

**Blueprint:** `.bouncer/context/epics/001-handler-timeout/blueprints/001-handler-timeout`  
**Base:** `main`

### Remaining tasks

| ID | Kind | Status | depends_on | affected_paths (summary) |
|---|---|---|---|---|
| **001** `TASKS-001` | commit | ready | — | Core: `fastify.js`, `lib/{config-validator,errors,symbols,context,route,request,reply}.js`, `build/build-validation.js`; Types: `fastify.d.ts`, `types/{instance,route,request,errors}.d.ts`; Docs: Server/Routes/Request/Errors/Lifecycle/Hooks; Tests: `test/handler-timeout.test.js` + internals/types tests |
| **002** `TASKS-002` | verification | ready | `TASKS-001` | (none — runs verification runner) |

### DAG

```text
TASKS-001 (commit) → TASKS-002 (verification)
```

Ready wave now: **001** only.

---

**AskUserQuestion — run.start_drive**
<!-- acq {"gate":"run.start_drive","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Hand remaining tasks to a coordinator drive?
2. **Recommend-why**: Given the task list, the DAG, and `affected_paths`, delegating now covers each ready wave until the blueprint is done. This approval covers the whole drive: neither autonomy value asks again per task; `auto` batches progress reporting.
3. **Options**:
   - A) Start drive (Recommended)
   - B) Revise list/scope and reconfirm
   - C) Cancel

Reply with **A**, **B**, or **C**.