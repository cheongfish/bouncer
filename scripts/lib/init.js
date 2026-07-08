'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CONFIG = {
  okf_version: '0.x',
  source_dirs: ['src', 'test'],
  verify: 'npm test',
  base_branch: 'develop',
  pr: { draft: true, base: 'develop', labels: ['sdd'] },
};

const GOVERNANCE = `# Governance

## Blueprint sizing rule

A blueprint is split so it fits **one reviewable commit**. If work feels too
large for a single commit, split the blueprint into more blueprints — do **not**
add a subtask layer. Per-task commits and per-task \`affected_paths\` are out of
scope for v1.
`;

const WORKFLOW = `# Workflow

1. \`/sdd-init\` — bootstrap \`.sdd/\` once per project.
2. \`/sdd-plan\` — author epic → blueprint → tasks, scaffold docs, inject
   \`graph.suggested_paths\`, confirm \`affected_paths\`, approve, write
   \`.sdd/current\`, pass gate \`plan\` (G1–G5).
3. \`/sdd-execute\` — worktree + branch, implement (guarded multi-commit),
   verification-loop, review-loop, pass gate \`execute\` (G6–G8).
4. \`/sdd-finalize\` — distill, pass gate \`finalize\` (G9), commit remainder,
   then push + draft PR (skipped gracefully with no remote / no \`gh\`).
`;

const OKF = `# OKF

Pinned OKF version: **0.x**.

Every \`context/**/*.md\` document carries OKF frontmatter
(\`type\`, \`title\`, \`description\`, \`resource\`, \`tags\`, \`timestamp\`); SDD
fields live under \`sdd:\`. See the schema-gates design for the full schema.
`;

const SUPERPOWERS = `# Superpowers coexistence

When using Superpowers in this repository:

- During SDD-governed work, official specs and plans live in \`context/epics/**\`.
- Superpowers docs under \`docs/superpowers/**\` are drafts or supporting notes.
- Do not create a separate Superpowers worktree after \`/sdd-execute\` has started.
- Do not edit SDD-owned frontmatter directly.
- SDD gates decide official plan, execute, and finalize status.

Import a Superpowers draft into official SDD docs with
\`/sdd-plan --from-superpowers <path>\` (or \`sdd-harness import-superpowers\`).
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
  'tasks.md': '# Tasks\n\n- [ ] <task>\n',
  'verification.md': '# Verification\n\nCommand run and result.\n',
  'review.md': '# Review\n\nFindings and resolutions.\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

const CONTEXT_INDEX = `# Context Index

Root index of SDD epics and blueprints for this project.
`;

const GITIGNORE_ENTRIES = ['.sdd/worktrees/', 'graphify-out/', '.sdd/current'];

function writeFile(repoRoot, rel, content, created) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

function ensureGitignore(repoRoot) {
  const abs = path.join(repoRoot, '.gitignore');
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  const lines = existing.split('\n');
  const missing = GITIGNORE_ENTRIES.filter((e) => !lines.includes(e));
  if (missing.length === 0) return;
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(abs, `${existing}${prefix}${missing.join('\n')}\n`);
}

function init({ repoRoot, timestamp }) {
  const configAbs = path.join(repoRoot, '.sdd/config.json');
  if (fs.existsSync(configAbs)) return { created: [], skipped: true };

  const created = [];
  writeFile(repoRoot, '.sdd/current', '', created);
  writeFile(repoRoot, '.sdd/governance.md', GOVERNANCE, created);
  writeFile(repoRoot, '.sdd/workflow.md', WORKFLOW, created);
  writeFile(repoRoot, '.sdd/okf.md', OKF, created);
  writeFile(repoRoot, '.sdd/superpowers.md', SUPERPOWERS, created);
  for (const [name, content] of Object.entries(TEMPLATES)) {
    writeFile(repoRoot, `.sdd/templates/${name}`, content, created);
  }
  writeFile(repoRoot, 'context/index.md', CONTEXT_INDEX, created);
  ensureGitignore(repoRoot);
  writeFile(repoRoot, '.sdd/config.json', `${JSON.stringify(CONFIG, null, 2)}\n`, created);
  return { created, skipped: false };
}

module.exports = { init };
