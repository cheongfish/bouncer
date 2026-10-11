Writing `bouncer.verify`, applying stop-slop, then proposing `affected_paths`.Updating TASKS-002 Touch to include `test/types/instance.test-d.ts` (initialConfig contract blast), then proposing `affected_paths`.**graph-suggest (advisory)**

| Task | quality | reasons | suggested_paths |
|------|---------|---------|-----------------|
| TASKS-001 | `low-confidence` | `source.omitted`, `test.omitted`, then `seed.fanout_cap` → shrink → `traversal.frontier_cap` | `[]` (forced) |
| TASKS-002 | `low-confidence` | `source.omitted`, `test.omitted`, `implementation.none` (source graph is `lib/` only; types/docs outside) | `[]` (forced) |

Basis: source/test `updated` via `graph-sync`. Candidates empty after caps — paths below come from Touch + contract blast (`initial-config` / `instance.test-d.ts` InitialConfig), not from graph.

---

**AskUserQuestion — plan.affected_paths**
<!-- acq {"gate":"plan.affected_paths","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Confirm each task’s `bouncer.affected_paths` (non-empty; must match Touch).
2. **Recommend-why**: Lists are the minimum files Checklist / `npm test` need for green, including generated `config-validator` and the `initialConfig` type/test blast.

**TASKS-001**
```
build/build-validation.js
lib/config-validator.js
fastify.js
lib/errors.js
lib/symbols.js
lib/handler-timeout.js
lib/context.js
lib/route.js
lib/request.js
lib/reply.js
lib/four-oh-four.js
test/handler-timeout.test.js
test/internals/initial-config.test.js
```

**TASKS-002**
```
fastify.d.ts
types/instance.d.ts
types/route.d.ts
types/request.d.ts
types/errors.d.ts
test/types/fastify.test-d.ts
test/types/instance.test-d.ts
test/types/request.test-d.ts
test/types/route.test-d.ts
test/types/errors.test-d.ts
docs/Reference/Server.md
docs/Reference/Routes.md
docs/Reference/Request.md
docs/Reference/Errors.md
docs/Reference/Lifecycle.md
docs/Reference/Hooks.md
docs/Guides/Detecting-When-Clients-Abort.md
```

3. **Options**:
   - A) Confirm both lists as written (Recommended)
   - B) Edit — reply with adds/removes per task
   - C) Cancel planning