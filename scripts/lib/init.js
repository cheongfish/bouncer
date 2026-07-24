'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema');

const CONFIG = {
  okf_version: '0.x',
  source_dirs: ['src', 'test'],
  verify: 'npm test',
  base_branch: 'develop',
  pr: { draft: true, base: 'develop', labels: ['bouncer'] },
  plugin_advisors: {
    ponytail: {
      enabled: true,
      plan: 'lite',
      execute: 'full',
      verify: 'full',
      review: 'review',
      finalize: 'lite',
      auto_switch: false,
    },
  },
};

const GOVERNANCE = `# Governance

## Blueprint sizing rule

A blueprint is split so it fits **one reviewable commit**. If work feels too
large for a single commit, split the blueprint into more blueprints — do **not**
add a subtask layer. Per-task commits and per-task \`affected_paths\` are out of
scope for v1.
`;

const WORKFLOW = `# Workflow

1. \`/bouncer-init\` — bootstrap \`.bouncer/\` once per project.
2. \`/bouncer-plan\` — author epic → blueprint → tasks, scaffold docs, inject
   \`graph.suggested_paths\`, confirm \`affected_paths\`, approve, write
   \`.bouncer/current\`, pass gate \`plan\` (G1–G5, G10–G12).
3. \`/bouncer-execute\` — preflight, worktree, implement from tasks
   brief, verification, review, pass gate \`execute\` (G6–G8,
   G13–G14).
4. \`/bouncer-finalize\` — distill, pass gate \`finalize\` (G9), commit remainder,
   then push + draft PR (skipped gracefully with no remote / no \`gh\`).
5. \`bouncer advise\` — at any point, print the recommended Ponytail mode for
   the current Bouncer phase (advisory only; never switches modes automatically).
`;

const OKF = `# OKF

Pinned OKF version: **0.x**.

Every \`context/**/*.md\` document carries OKF frontmatter
(\`type\`, \`title\`, \`description\`, \`resource\`, \`tags\`, \`timestamp\`); Bouncer
fields live under \`bouncer:\`. See the schema-gates design for the full schema.
`;

const PR_TEMPLATE = `<type>(<bp-id>): <summary>

Epic: <epic-id>
Blueprint: <bp-id>

Implemented:
- <task summary>

Verified:
- <verification summary>

Distilled:
- <distill path>
`;

const TEMPLATES = {
  'epic.md': '# <EPIC-id> <name>\n\nGoal and scope of this epic.\n',
  'blueprint.md': '# <BP-id> <name>\n\nWhat this blueprint delivers and why it fits one reviewable commit.\n',
  'tasks.md': `# Tasks

## Goal & intent

## Interface

## Touch

## Do not touch

## Checklist
- [ ] <task>
`,
  'verification.md': '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n',
  'review.md': '# Review\n\n## Findings\n- <finding>\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

const CONTEXT_INDEX = `# Context Index

Root index of Bouncer epics and blueprints for this project.
`;

function writeFile(repoRoot, rel, content, created) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

function inspectBootstrap({ repoRoot }) {
  if (detectLegacyFormat({ repoRoot }).legacy) return 'legacy';

  const bouncerAbs = path.join(repoRoot, '.bouncer');
  if (!fs.existsSync(bouncerAbs)) return 'missing';

  const configAbs = path.join(bouncerAbs, 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configAbs, 'utf8'));
    if (config && typeof config === 'object' && !Array.isArray(config)) return 'ready';
  } catch (_e) {
    // Existing Bouncer content is preserved when config is absent or invalid.
  }
  return 'partial';
}

function init({ repoRoot, timestamp }) {
  const bootstrap = inspectBootstrap({ repoRoot });
  if (bootstrap === 'legacy') {
    const legacy = detectLegacyFormat({ repoRoot });
    return { ok: false, created: [], skipped: true, reason: legacy.reason };
  }
  if (bootstrap === 'partial') {
    return { ok: false, created: [], skipped: true, reason: 'partial-bouncer-state' };
  }
  if (bootstrap === 'ready') {
    return { ok: true, created: [], skipped: true, reason: 'already-initialized' };
  }

  const created = [];
  writeFile(repoRoot, '.bouncer/governance.md', GOVERNANCE, created);
  writeFile(repoRoot, '.bouncer/workflow.md', WORKFLOW, created);
  writeFile(repoRoot, '.bouncer/okf.md', OKF, created);
  for (const [name, content] of Object.entries(TEMPLATES)) {
    writeFile(repoRoot, `.bouncer/templates/${name}`, content, created);
  }
  writeFile(repoRoot, '.bouncer/context/index.md', CONTEXT_INDEX, created);
  writeFile(repoRoot, '.bouncer/config.json', `${JSON.stringify(CONFIG, null, 2)}\n`, created);
  return { ok: true, created, skipped: false, reason: 'initialized' };
}

module.exports = { init, inspectBootstrap };
