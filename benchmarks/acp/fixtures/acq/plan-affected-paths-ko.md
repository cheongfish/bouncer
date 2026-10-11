`npm test`로 고정합니다. 검증 태스크를 만들고 증거를 모은 뒤 문서를 작성합니다.문서 본문을 작성합니다.404는 `routeHandler`에서 제외하는 쪽으로 Touch를 정리하고, graph-suggest를 돌립니다.**graph-suggest (advisory)**  
- sync basis: source `updated`, test `updated`  
- first query: `handlerTimeout AbortSignal` + seeds `lib/route.js`, `lib/request.js` → `low-confidence` (`seed.fanout_cap`, `source.omitted`, `test.omitted`)  
- shrink retry: `handlerTimeout` + `lib/route.js` → still `low-confidence` (`traversal.frontier_cap`)  
- **`suggested_paths`: []** — path list not used; Touch/evidence로 제안합니다.

**TASKS-002**는 verification fan-in이라 `affected_paths: []` 유지(ACQ 제외).

---

**AskUserQuestion — plan.affected_paths**
<!-- acq {"gate":"plan.affected_paths","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: `TASKS-001`에 쓸 `bouncer.affected_paths`(비어 있으면 안 됨). graph-suggest는 low-confidence라 비어 있음
2. **Recommend-why**: Touch 표·initialConfig/오류 개수 blast(`test/types/instance.test-d.ts`, `expectedErrors`)까지 포함한 최소 집합임
3. **Options** (recommended-first):
   - A) Accept the proposed `TASKS-001` paths below (Recommended)
   - B) Edit the list (reply with full final path list)
   - C) Cancel planning

**Proposed `TASKS-001` `affected_paths`:**
```
build/build-validation.js
lib/config-validator.js
fastify.js
lib/errors.js
lib/symbols.js
lib/context.js
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
docs/Reference/Lifecycle.md
docs/Reference/Hooks.md
test/handler-timeout.test.js
test/internals/errors.test.js
test/internals/initial-config.test.js
test/types/fastify.test-d.ts
test/types/instance.test-d.ts
test/types/request.test-d.ts
test/types/route.test-d.ts
test/types/errors.test-d.ts
```