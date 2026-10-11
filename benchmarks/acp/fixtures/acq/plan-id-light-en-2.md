Discovery confirmed. Next: ID allocation and light-scope declaration.

**AskUserQuestion — plan.id_allocation (1/2)**
<!-- acq {"gate":"plan.id_allocation","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Choose epic and blueprint ids for scaffolding.
2. **Recommend-why**: Preflight `nextEpicId` is `001` and there is no existing epic; first blueprint under a new epic is conventionally `001`.
3. **Options**:
   - A) Epic `001` / blueprint `001` (Recommended)
   - B) Override — reply with `\d{3}` epic id and/or blueprint id
   - C) Cancel planning

**AskUserQuestion — plan.light_scope (2/2)**
<!-- acq {"gate":"plan.light_scope","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Declare whether this plan is narrow-scope light or full.
2. **Recommend-why**: This spans server/route options, lifecycle timer, `request.signal`, errors, types, multiple docs, and tests — full scale fits; light would omit Interface / Do not touch / context-review.
3. **Options**:
   - A) Full scale (normal path) (Recommended)
   - B) Light scope (maintenance epic only; 4 docs, no context-review)
   - C) Cancel planning