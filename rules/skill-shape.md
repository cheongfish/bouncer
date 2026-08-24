# Skill body shape

Authoritative section order for plugin skill and agent bodies. Skills that
consume this plugin follow these shapes; session runtime agents do not load this
file as a hard rule (it is not linked from `CLAUDE.md`).

Body H2 headings in skills and agents are English.

## Companion directories

| Directory | Role |
| --- | --- |
| `assets/` | Fill-in templates the skill writes or hands off as output (e.g. a reviewer prompt). |
| `references/` | Supporting material the skill reads; not an output template. |

Do not treat `references/` as something to copy into a deliverable, and do not
park read-only notes under `assets/`.

## Workflow skills (`skills/bouncer-*/SKILL.md`)

Six entry skills: `bouncer-init`, `bouncer-plan`, `bouncer-execute`,
`bouncer-commit`, `bouncer-finalize`, `bouncer-run`.

Required body order after YAML frontmatter:

1. **No blank line** between the closing `---` and the title.
2. `# /<name>` — slash-command title matching the skill name.
3. **Plugin root** and **Master rules** blocks (labels and `CLAUDE.md` cite stay).
4. Top-level numbered procedure (`1.` `2.` `3.` …) — the only procedural spine.
5. `## ACQ (AskUserQuestion) gates` — **last** H2. Catalog which steps ask what.
   If the skill never asks, say so in this section.

## Subskills (`skills/<name>/SKILL.md`, non-workflow)

Required body order after YAML frontmatter:

1. **One blank line** between the closing `---` and the title.
2. `# Title Case` title.
3. One or two intro paragraphs.
4. `## When this applies`
5. `## Steps`
6. Domain-specific H2s as needed (free).
7. `## Guardrails`
8. `## Return` — last.

### `## Steps` exemptions

These two keep their existing procedural H2 instead of `## Steps`:

| Skill | Procedural H2 |
| --- | --- |
| `minimality` | `## Decision ladder` (ladder is the procedure) |
| `stop-slop` | `## Core rules` (core rules are the procedure) |

## Agents (`agents/*.md`)

Required body order after YAML frontmatter and `# Bouncer <role>` title:

1. `## Authority`
2. `## Hard guards` — read-only agents only: `## Hard guards (read-only)`
3. Domain-specific H2s as needed (Rubric, Scope, Calibration, …)
4. `## Procedure` — only when the agent has an ordered procedure
5. `## Output contract` — always last
