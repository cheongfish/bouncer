---
distill:
  id: validate-gates
  paths:
    - scripts/**
    - test/**
  pulls: []
---
# validate-gates

## Invariants

- Optional `tasks.bouncer.verify` is a single executable argv string (no shell chaining, redirection, or `cd`).
- Execute G6-G8 / G13 / G14 judge only the pointer task unit — no siblings.
- `runVerification` writes the target unit `verification.md` only; missing -> `VERIFY_DOCUMENT_MISSING`. Never author declarations there — verify lives on `tasks.md` `bouncer.verify`.

## Gotchas

- Scaffold defaults `graph.basis` to `[]`; empty fails G4 until graphify-runner records. Never omit an entry when a query cannot run — leave mapped `status`.
- Enabling G18 before an `accepted` `context-review.md` makes `bouncer current --set` fail.
- Tests must not read the repository's Git-ignored `.bouncer/config.json`; use fixtures or the config-absent fallback.

## Decisions

- `config.autonomy` (`auto`|`interactive`) lives only in `.bouncer/config.json`. Missing/out-of-enum -> warn, treat as `auto`.
- Present-but-invalid `bouncer.verify` must not fall through to `config.verify` (hides plan `S12`). `readAffectedPaths`: named task alone when it exists, else union across task docs.
