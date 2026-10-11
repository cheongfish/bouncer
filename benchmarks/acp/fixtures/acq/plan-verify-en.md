Scaffolding epic `001` and full-scale blueprint `001`, then authoring from the spec-authoring skill.Collecting evidence inline (`dispatch: print`), then authoring epic, blueprint, and both task briefs.초안을 작성했습니다. 검증 명령을 확정합니다.

**AskUserQuestion — plan.verify_command**
<!-- acq {"gate":"plan.verify_command","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Set each task’s `bouncer.verify` for this blueprint, or leave unset so execute uses global `config.verify` (`npm test`).
2. **Recommend-why**: Project rules and CI use lint + unit + TypeScript via `npm test`, which matches `config.verify` and `package.json#scripts`.
3. **Options**:
   - A) Set `bouncer.verify: npm test` on TASKS-001 and TASKS-002 (Recommended)
   - B) Leave unset (use global `config.verify` only)
   - C) Different single argv — reply with the command (no `&&` / pipes / `cd`)