Discovery confirmed. Next are the Step 2 decisions: ID allocation and light vs full scope.**AskUserQuestion (1/2) — ID allocation**

1. **Re-ground**: Epic/blueprint ids and slugs for this plan (inspect suggests epic `001`; first blueprint under a new epic is typically `001`).
2. **Recommend-why**: Empty epic index and `nextEpicId: 001` fit a new value-area epic `monthly-summary` with blueprint `001-summary-command`.
3. **Options**:
   - **A) Epic `001-monthly-summary` + Blueprint `001-summary-command`** (Recommended)
   - **B) Override** — reply with epic id/slug and blueprint id/slug (`\d{3}` only; not `EPIC-001` / `1` / `01`)
   - **C) Cancel**

---

**AskUserQuestion (2/2) — Light scope**

1. **Re-ground**: Narrow light path (maintenance epic, 4 docs, no context-review) vs full path (new epic, full sections + context-review).
2. **Recommend-why**: This change adds a public CLI contract, error/exit behavior, and touches `cli` + `ledger` + tests — that fits **full**, not light’s Goal/Touch/Checklist-only brief.
3. **Options**:
   - **A) Full path** (Recommended) — new epic, `scale: full`
   - **B) Light path** — stack under `maintenance` (create if missing), `--scale light`
   - **C) Cancel**

Reply like **1A 2A**, or with overrides for B options.
