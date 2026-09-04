---
distill:
  id: plugin-skills
  paths:
    - skills/bouncer-*/**
    - references/**
    - agents/**
    - rules/**
    - docs/ARCHITECTURE.md
    - docs/cli.md
    - docs/compatibility.md
    - docs/configuration.md
    - docs/context-versioning.md
    - docs/contributing.md
    - docs/gates.md
    - docs/install.md
    - docs/PILOT.md
    - docs/README.md
    - docs/security.md
    - docs/troubleshooting.md
    - docs/workflow.md
    - plugin.json
    - .claude-plugin/**
    - .cursor-plugin/**
    - .codex-plugin/**
  pulls: []
---
# plugin-skills

## Invariants

- Root `plugin.json` is the Antigravity surface; host manifests stay under `.claude-plugin` / `.cursor-plugin` / `.codex-plugin`. Do not declare `skills` / `agents` / `hooks` there.
- Do not redeclare `agents` on Claude or Cursor manifests. Codex uses project `.codex/agents/*.toml` (`# bouncer-generated`; unmarked stay user-owned).

## Gotchas

- Skill YAML `description` plain `##` truncates — quote or avoid.
- Each workflow shell block needs its own `BOUNCER_ROOT=`.
- Allowlists that only listed `scripts/lib/*.js` break when `scripts/src/**/*.ts` is tracked.
- Do not assume `.bouncer/templates/` — bodies come from `scripts/lib/templates.js`.
- Graph misses `skills/` / `docs/` / `agents/` under `scripts`-like `source_dirs`.
- `--scale` is `scaffold blueprint` only; `scaffold task` inherits and drops `--scale`.

## Decisions

- `scale: light` (plan asks; never auto) inlines implementer+reviewer only; debugger stays named; `/bouncer-run` keeps named dispatch on `light`. Scaffold defaults `full`/`feat`.
- Only the controller sets `review → accepted`. Implementer/debugger must not commit or flip status; debugger is read-only.
- G18 (plan only; skipped on `light`) checks status/Findings — no auto-edits.
