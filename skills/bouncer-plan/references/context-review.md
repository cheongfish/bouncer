When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference.

Before approval, judge the plan documents. The `context-review` skill (`skills/context-review/SKILL.md`) is the behavioral brief. Dispatch **`bouncer-context-reviewer`** (plugin `agents/bouncer-context-reviewer.md`) in this order:

1. Resolve the model:
   ```bash
   BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
   node -e "console.log(JSON.stringify(require('${BOUNCER_ROOT}/scripts/lib/subagents').resolveSubagentModel({repoRoot:process.cwd(),agentName:'bouncer-context-reviewer'})))"
   ```
2. Call named agent `bouncer-context-reviewer` with that `model`, passing the epic `index.md`, the blueprint `index.md`, and every `tasks/<NNN>/tasks.md` under the blueprint as the documents under judgment. Compose that prompt inline (no `assets/` template — the paths are already known). Ask for a Findings list only.
3. If the host rejects the model slug, retry with `inherit` and tell the user.
4. If named agents are unavailable, fall back to running the `context-review` skill inline (or a fresh generic read-only subagent with the same brief). Do not skip named dispatch just because the host is Codex. Do **not** skip this step.

As controller, update existing blueprint-root `context-review.md` body `## Findings` and `bouncer.context_review.findings[]` from the reviewer output — the subagent must not edit documents or flip status. An `accepted` finding requires a note. Only when every finding is `resolved` or `accepted` with a note, set `context-review → accepted`.
