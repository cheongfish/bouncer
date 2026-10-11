Setting `bouncer.verify` to `npm run test:ci`, then confirming `affected_paths`.Contract blast: `test/types/fastify.test-d.ts` also asserts server timeout options — adding it to Touch before the paths ACQ.### graph-suggest (advisory)

| | |
| --- | --- |
| **quality** | `status: low-confidence`, `confidence: low` |
| **reasons** | `source.omitted`, `test.omitted`, then `seed.fanout_cap` → shrink retry → `traversal.frontier_cap` |
| **candidates** | `implementation: []`, `test: []` |
| **suggested_paths** | `[]` (forced empty on low-confidence) |

**basis**
- source: `updated` — query `handlerTimeout` (retry) — fan-out/frontier capped; no ranked paths
- test: `updated` — same — no linked test candidates

Graphify is optional here; path list below is from Touch + contract blast (`initialConfig` deepEqual, error/type fixtures), not from suggest.

**Minimality (advisory):** no new deps — use native `AbortController`/`AbortSignal`; reuse `validateBodyLimitOption` / `createError` / `initialConfig` patterns. Prefer timer state on request/context symbols over a new module unless `lib/route.js` would become unreadable.

---

**AskUserQuestion — plan.affected_paths**
<!-- acq {"gate":"plan.affected_paths","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: TASKS-001 `bouncer.affected_paths` (non-empty; must match Touch)
2. **Recommend-why**: Covers runtime, generated validator, public types, reference docs, and every fixture that asserts the old `initialConfig`/error/type shapes so `npm run test:ci` can go green
3. **Options**:
   - A) Accept the list below (Recommended)
   - B) Edit (reply with add/remove paths)
   - C) Cancel planning

**Proposed `affected_paths` for TASKS-001:**
```
build/build-validation.js
lib/config-validator.js
fastify.js
lib/errors.js
lib/context.js
lib/symbols.js
lib/route.js
lib/request.js
lib/reply.js
fastify.d.ts
types/instance.d.ts
types/route.d.ts
types/request.d.ts
types/errors.d.ts
docs/Reference/Server.md
docs/Reference/Routes.md
docs/Reference/Request.md
docs/Reference/Errors.md
docs/Reference/Hooks.md
docs/Reference/Lifecycle.md
test/handler-timeout.test.js
test/internals/initial-config.test.js
test/internals/errors.test.js
test/types/fastify.test-d.ts
test/types/instance.test-d.ts
test/types/request.test-d.ts
test/types/route.test-d.ts
test/types/errors.test-d.ts
```