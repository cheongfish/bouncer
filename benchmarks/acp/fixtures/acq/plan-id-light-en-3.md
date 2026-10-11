Discovery 확인됨. Scaffold 전에 ID 할당과 light-scope 선언이 필요합니다.**AskUserQuestion — plan.id_allocation (1/2)**
<!-- acq {"gate":"plan.id_allocation","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Suggested from inspect — epic `001-handler-timeout`, blueprint `001-handler-timeout`; description: add server/route `handlerTimeout` and lazy `request.signal`
2. **Recommend-why**: First free `\d{3}` id is `001` and the slug matches the PRD feature name
3. **Options** (recommended-first):
   - A) Use epic `001-handler-timeout` + blueprint `001-handler-timeout` (Recommended)
   - B) Override (reply with epic id/slug and blueprint id/slug)
   - C) Cancel scaffolding

---

**AskUserQuestion — plan.light_scope (2/2)**
<!-- acq {"gate":"plan.light_scope","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Whether this is narrow-scope light work (maintenance epic, 4 docs) or a normal full plan (new epic + full document set)
2. **Recommend-why**: Core runtime, route options, errors, types, docs, and regenerated config validator span multiple modules — that needs full Interface / Do not touch / context-review, not light
3. **Options** (recommended-first):
   - A) Normal full path — new epic, `scale: full` (Recommended)
   - B) Declare light scope — `maintenance` epic only, `--scale light`
   - C) Cancel scaffolding

Reply like `1A 2A` (or overrides).