Discovery confirmed. Next: ID allocation and light-scope declaration.

**AskUserQuestion — plan.id_allocation (1/2)**
<!-- acq {"gate":"plan.id_allocation","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: New epic + first blueprint ids for `handlerTimeout`
2. **Recommend-why**: Preflight `nextEpicId` is `001`; first blueprint under that epic is `001`
3. **Options**:
   - A) Epic `001` / blueprint `001`, slug e.g. `handler-timeout` (Recommended)
   - B) Override (send epic id, blueprint id, and/or slug)
   - C) Cancel planning

**AskUserQuestion — plan.light_scope (2/2)**
<!-- acq {"gate":"plan.light_scope","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Full plan vs light (maintenance) blueprint
2. **Recommend-why**: Server/route options, signal, errors, types, docs, multi-module lifecycle — needs full Interface / Do not touch / context-review
3. **Options**:
   - A) Full scope — new epic + full blueprint (Recommended)
   - B) Light scope — blueprint under `maintenance` epic only
   - C) Cancel planning